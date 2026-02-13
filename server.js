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
    if(newCards.length !== lastHand.count && newType.type !== '1') {
        // 除非是某些允许张数不同的规则，这里严格限制张数一致(除了单张，虽然单张也是1对1)
        // 修正: lastHand.count 应该存储的是牌的数量
        if(newCards.length !== (lastHand.realCount || lastHand.count)) return false; 
    }
    
    return newType.val > lastHand.val;
}

// --- 房间状态 ---
let room = {
    players: {},
    seats: [null, 'BOT', null, 'BOT'], // 0, 1(AI), 2, 3(AI)
    count: 0,
    state: {
        active: false,
        deck: [],
        hands: [[],[],[],[]],
        turn: 0,
        lastHand: null, // { owner, type, val, score, count }
        passCount: 0,
        finished: [] // 已经出完牌的玩家座位号
    }
};

// --- Socket 逻辑 ---
io.on('connection', (socket) => {
    console.log(`Checking in: ${socket.id}`);

    // 1. 安排座位
    let seat = -1;
    if(room.seats[0] === null) seat = 0;
    else if(room.seats[2] === null) seat = 2;

    if(seat === -1) {
        socket.emit('err', 'Room Full');
        socket.disconnect();
        return;
    }

    room.seats[seat] = socket.id;
    room.players[socket.id] = seat;
    room.count++;
    console.log(`Player assigned to Seat ${seat}`);

    socket.emit('initIdentity', { seat: seat, isHost: seat===0 });
    io.emit('roomUpdate', { humanCount: room.count });

    // 2. 人满开局
    if(room.count === 2) {
        setTimeout(startGame, 1000);
    }

    // 3. 处理动作
    socket.on('action', (data) => handleAction(seat, data));
    // 主机代发 Bot 动作
    socket.on('botAction', (data) => handleAction(data.seat, data));

    // 4. 断开
    socket.on('disconnect', () => {
        if(room.players[socket.id] !== undefined) {
            let s = room.players[socket.id];
            room.seats[s] = null;
            delete room.players[socket.id];
            room.count--;
            room.state.active = false; // 游戏强制结束
            io.emit('roomUpdate', { humanCount: room.count });
            console.log(`Seat ${s} disconnected`);
        }
    });
});

function startGame() {
    console.log("Starting Game...");
    let deck = createDecks();
    let hands = [[],[],[],[]];
    deck.forEach((c, i) => hands[i%4].push(c));

    // 状态重置
    room.state = {
        active: true,
        hands: hands,
        turn: Math.floor(Math.random()*4), // 随机先手
        lastHand: null,
        passCount: 0,
        finished: [] 
    };

    // 发牌
    Object.keys(room.players).forEach(sid => {
        let s = room.players[sid];
        io.to(sid).emit('dealCards', { cards: hands[s] });
        if(s === 0) {
            // 给 Host 发送 AI 的手牌用于计算
            io.to(sid).emit('botCards', { bot1: hands[1], bot3: hands[3] });
        }
    });

    setTimeout(() => {
        io.emit('gameStart', { startTurn: room.state.turn });
    }, 2000); // 留时间做动画
}

function handleAction(seat, data) {
    if(!room.state.active) return;
    if(seat !== room.state.turn) return; // 不是你的回合

    let nextTurn = room.state.turn;
    let eventType = data.type; // 'play' or 'pass'
    
    if(eventType === 'play') {
        // 校验牌型
        let ht = getHandType(data.cards);
        if(!ht) return; // 非法牌型
        if(!canBeat(data.cards, ht, room.state.lastHand)) return; // 打不过

        // 成功出牌
        room.state.lastHand = {
            owner: seat,
            type: ht.type,
            val: ht.val,
            score: ht.score || 0,
            count: ht.count || data.cards.length,
            realCount: data.cards.length
        };
        room.state.passCount = 0; // 重置过牌计数
        
        // 扣除手牌 (服务端简单记录数量即可，具体牌由客户端维护或更严谨的实现)
        room.state.hands[seat].splice(0, data.cards.length);
        
        // 检查是否出完
        if(room.state.hands[seat].length === 0) {
            if(!room.state.finished.includes(seat)) {
                room.state.finished.push(seat);
            }
        }
    } else {
        // PASS
        if(!room.state.lastHand) return; // 首出不能过
        room.state.passCount++;
    }

    // 计算下一手
    // 逻辑: 寻找下一个还没 finished 的人
    // 另外: 如果 passCount >= (未完成人数 - 1)，说明其他人都不要，当前 lastHand.owner 获得球权
    
    let activePlayers = 4 - room.state.finished.length;
    // 如果只剩1个人或者0个人，游戏结束
    if(activePlayers <= 1) {
        // 广播最后一手
        io.emit('syncAction', {
            seat: seat,
            type: eventType,
            cards: data.cards,
            handType: data.handType,
            nextTurn: -1 // -1 表示游戏结束
        });
        return;
    }

    // 判断是否一圈不要
    // 注意：如果有人出完了，他就不参与 passCount。
    // 如果场上剩3人，passCount达到2，则上一手出牌者获胜
    if(room.state.passCount >= activePlayers - 1) {
        // 此时，球权归还给 lastHand.owner
        // 但如果 lastHand.owner 已经出完了(finished)，则顺延给他的下家
        let winner = room.state.lastHand.owner;
        nextTurn = winner;
        
        // 如果赢家已经走了，找他的下家接风
        if(room.state.finished.includes(winner)) {
             // 简单规则：对家接风? 还是下家接风? 
             // 这里使用：找 winner 的下家，如果是队友且还没走，队友接。否则下家接。
             // 简化通用逻辑：直接给下家(如果下家没走)
             let scan = 1;
             while(room.state.finished.includes((winner + scan)%4) && scan < 5) {
                 scan++;
             }
             nextTurn = (winner + scan) % 4;
        }
        
        // 新一轮，清空 lastHand
        room.state.lastHand = null;
        room.state.passCount = 0;
    } else {
        // 正常轮转，找下一个没走的人
        let scan = 1;
        while(room.state.finished.includes((seat + scan)%4) && scan < 5) {
            scan++;
        }
        nextTurn = (seat + scan) % 4;
    }

    room.state.turn = nextTurn;

    // 广播结果
    io.emit('syncAction', {
        seat: seat,
        type: eventType,
        cards: data.cards,
        handType: data.handType || (eventType==='play'?getHandType(data.cards):null),
        nextTurn: nextTurn,
        isRoundEnd: (room.state.lastHand === null) // 告诉客户端这轮结束了，清桌子
    });
}

http.listen(PORT, () => console.log(`Server running on ${PORT}`));
