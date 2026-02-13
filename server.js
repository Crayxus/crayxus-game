// server.js - Crayxus Fixed & Synchronized
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- 核心配置 ---
const PORT = process.env.PORT || 3000;

// --- 牌力定义 (与客户端保持完全一致) ---
const POWER = {'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15,'Sm':16,'Bg':17};
const SEQ_VAL = {'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13};
const SUITS = ['♠','♥','♣','♦'];
const POINTS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

// --- 工具函数 ---
function createDecks() {
    let deck = [];
    // 2副牌
    for(let d=0; d<2; d++) {
        SUITS.forEach(s => {
            POINTS.forEach(v => {
                deck.push({ s:s, v:v, p:POWER[v], seq:SEQ_VAL[v], id:Math.random().toString(36).substr(2,9) });
            });
        });
        deck.push({s:'JOKER', v:'Bg', p:POWER['Bg'], seq:20, id:Math.random().toString(36).substr(2,9)});
        deck.push({s:'JOKER', v:'Sm', p:POWER['Sm'], seq:19, id:Math.random().toString(36).substr(2,9)});
    }
    // 洗牌
    for(let i=deck.length-1; i>0; i--) {
        let j = Math.floor(Math.random() * (i+1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// --- 核心算法: 牌型识别 (服务端校验) ---
function getHandType(cards) {
    if(!cards || !cards.length) return null;
    cards.sort((a,b) => a.p - b.p); // 升序排序用于判断
    
    let len = cards.length;
    let map = {};
    cards.forEach(c => map[c.p] = (map[c.p]||0)+1);
    let vals = Object.keys(map).map(Number).sort((a,b)=>a-b);
    let counts = Object.values(map);
    let maxCount = Math.max(...counts);

    // 1. 单张
    if(len === 1) return {type:'1', val:cards[0].p};

    // 2. 对子
    if(len === 2 && maxCount === 2) return {type:'2', val:cards[0].p};

    // 3. 三张
    if(len === 3 && maxCount === 3) return {type:'3', val:cards[0].p};

    // 4. 炸弹 (4张及以上同点数)
    if(len >= 4 && maxCount === len) return {type:'bomb', val:cards[0].p, count:len, score:len*100};

    // 5. 天王炸 (四鬼)
    if(len === 4 && cards.every(c => c.s === 'JOKER')) return {type:'bomb', val:999, count:6, score:1000};

    // 6. 三带二 (Full House)
    if(len === 5 && vals.length === 2 && (map[vals[0]] === 3 || map[vals[1]] === 3)) {
        let tripleVal = map[vals[1]] === 3 ? vals[1] : vals[0];
        return {type:'3+2', val:tripleVal};
    }

    // 7. 顺子 (5张连号, 也就是A2345, 23456... 10JQKA)
    // 注意: 这里简化处理，A只能做高牌或者A2345的低牌，不做复杂的循环判断
    if(len === 5 && maxCount === 1) {
        let isSeq = true;
        for(let i=0; i<len-1; i++) {
            if(cards[i+1].p !== cards[i].p + 1) isSeq = false;
        }
        // 特殊处理 A2345 (A=14, 2=15, 3=3...) 在POWER表里A和2很大，所以要看SEQ
        if(!isSeq) {
            let seqs = cards.map(c=>c.seq).sort((a,b)=>a-b);
            // 检查是不是 1,2,3,4,5 (A,2,3,4,5)
            if(seqs[0]===1 && seqs[1]===2 && seqs[2]===3 && seqs[3]===4 && seqs[4]===5) {
                isSeq = true; // A2345
            }
        }
        
        if(isSeq) {
            let isFlush = cards.every(c => c.s === cards[0].s);
            let val = cards[4].p; // 最大牌
            if(isFlush) return {type:'straight_flush', val:val, count:5.5, score:550};
            return {type:'straight', val:val};
        }
    }

    // 8. 连对 (木板) - 3连对
    if(len === 6 && vals.length === 3 && maxCount === 2 && counts.every(c=>c===2)) {
        if(vals[1] === vals[0]+1 && vals[2] === vals[1]+1) return {type:'tube', val:vals[0]};
    }

    // 9. 钢板 (连三张) - 2连三
    if(len === 6 && vals.length === 2 && maxCount === 3 && counts.every(c=>c===3)) {
        if(vals[1] === vals[0]+1) return {type:'plate', val:vals[0]};
    }

    return null;
}

function canBeat(newCards, newType, lastHand) {
    if(!lastHand) return true;
    
    // 1. 炸弹比较
    let isNewBomb = (newType.type === 'bomb' || newType.type === 'straight_flush');
    let isLastBomb = (lastHand.type === 'bomb' || lastHand.type === 'straight_flush');

    if(isNewBomb && !isLastBomb) return true;
    if(!isNewBomb && isLastBomb) return false;
    if(isNewBomb && isLastBomb) {
        // 比较炸弹分数: score大的赢，score一样比val
        // straight_flush score 550. 4 bomb = 400, 5 bomb = 500, 6 bomb = 600.
        // 所以 6炸 > 同花顺 > 5炸 > 4炸
        if(newType.score > lastHand.score) return true;
        if(newType.score < lastHand.score) return false;
        return newType.val > lastHand.val;
    }

    // 2. 普通牌型比较 (必须类型相同，张数相同)
    if(newType.type !== lastHand.type) return false;
    if(newCards.length !== lastHand.count && newType.type !== '
