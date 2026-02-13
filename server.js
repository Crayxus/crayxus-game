// server.js - Crayxus 联机版服务端 (完整发牌 + 验证)
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 健康检查
app.get('/', (req, res) => {
    res.send('Crayxus Server V28.2 Running! 🟢');
});

// --- 牌力和规则定义 (与客户端一致) ---
const POWER = {'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15,'Sm':16,'Bg':17};
const SEQ_VAL = {'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13};
const SUITS = ['♠','♥','♣','♦'];
const POINTS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

// --- 发牌系统 (服务器权威) ---
function createFullDeck() {
    let deck = [];
    // 2副牌
    for(let d = 0; d < 2; d++) {
        SUITS.forEach(s => {
            POINTS.forEach(v => {
                deck.push({
                    s: s,
                    v: v,
                    p: POWER[v],
                    seq: SEQ_VAL[v],
                    id: Math.random().toString()
                });
            });
        });
        // 大小王
        deck.push({s:'JOKER', v:'Bg', p:POWER['Bg'], seq:0, id:Math.random().toString()});
        deck.push({s:'JOKER', v:'Sm', p:POWER['Sm'], seq:0, id:Math.random().toString()});
    }
    return deck;
}

function shuffleDeck(deck) {
    for(let i = deck.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealCards() {
    let deck = shuffleDeck(createFullDeck());
    let hands = [[], [], [], []];
    deck.forEach((card, i) => {
        hands[i % 4].push(card);
    });
    return hands;
}

// --- 牌型验证 (服务器验证防作弊) ---
function getHandType(cards) {
    if(!cards || !cards.length) return null;
    cards.sort((a,b) => a.p - b.p);
    let len = cards.length;
    let map = {};
    cards.forEach(c => map[c.p] = (map[c.p] || 0) + 1);
    let vals = Object.keys(map).map(Number).sort((a,b) => a - b);
    let max = Math.max(...Object.values(map));
    
    // 炸弹
    if(len >= 4 && max === len) return {type:'bomb', val:cards[0].p, count:len, score:len*100};
    // 四王
    if(len === 4 && cards[0].s === 'JOKER' && cards[3].s === 'JOKER') return {type:'bomb', val:999, count:6, score:1000};
    // 顺子/同花顺
    if(len === 5) {
        let seq = [...cards].sort((a,b) => (a.seq||0) - (b.seq||0));
        let isA2345 = (seq[0].seq === 1 && seq[4].seq === 5);
        let isSeq = true;
        for(let i = 0; i < 4; i++) if(cards[i+1].p !== cards[i].p + 1) isSeq = false;
        if(isA2345 || isSeq) {
            let flush = cards.every(c => c.s === cards[0].s);
            let maxV = isA2345 ? 5 : cards[4].p;
            if(flush) return {type:'straight_flush', val:maxV, count:5.5, score:550};
            else return {type:'straight', val:maxV};
        }
    }
    // 单牌
    if(len === 1) return {type:'1', val:cards[0].p};
    // 对子
    if(len === 2 && max === 2) return {type:'2', val:cards[0].p};
    // 三张
    if(len === 3 && max === 3) return {type:'3', val:cards[0].p};
    // 钢板 (连三张: AAABBB)
    if(len === 6 && vals.length === 2 && map[vals[0]] === 3 && map[vals[1]] === 3 && vals[1] === vals[0] + 1) {
        return {type:'plate', val:vals[0], count:6};
    }
    // 木板 (连对: AABBCC)
    if(len === 6 && vals.length === 3 && max === 2 && vals[1] === vals[0] + 1 && vals[2] === vals[1] + 1) {
        return {type:'tube', val:vals[0], count:3};
    }
    // 三带二
    if(len === 5 && vals.length === 2 && (map[vals[0]] === 3 || map[vals[1]] === 3)) return {type:'3+2', val:(map[vals[1]] === 3 ? vals[1] : vals[0])};
    
    return null;
}

function canBeat(cards, cardType, lastHand) {
    let ts = cardType.type === 'straight_flush' ? 550 : (cardType.type === 'bomb' ? cardType.score : 0);
    let ls = lastHand.type === 'straight_flush' ? 550 : (lastHand.type === 'bomb' ? (lastHand.count === 6 && lastHand.val === 999 ? 600 : lastHand.count * 100) : 0);
    
    if(ts > 0) {
        if(ls === 0) return true;
        if(ts > ls) return true;
        if(ts < ls) return false;
        return cardType.val > lastHand.val;
    }
    if(ls > 0) return false;
    if(cardType.type !== lastHand.type) return false;
    
    // plate 和 tube 需要长度相同
    if(cardType.type === 'plate' || cardType.type === 'tube') {
        if(cards.length !== 6) return false;
    }
    if(cardType.type === 'straight') {
        if(cards.length !== 5) return false;
    }
    
    return cardType.val > lastHand.val;
}

// --- 房间状态 ---
let room = {
    players: {},
    seats: [null, 'BOT', null, 'BOT'],
    count: 0,
    gameState: null // 游戏状态
};

io.on('connection', (socket) => {
    console.log('🔗 玩家连接:', socket.id);

    // 分配座位
    let mySeat = -1;
    if(room.seats[0] === null) mySeat = 0;
    else if(room.seats[2] === null) mySeat = 2;

    if(mySeat !== -1) {
        room.seats[mySeat] = socket.id;
        room.players[socket.id] = mySeat;
        room.count++;

        console.log(`✅ 玩家入座 Seat ${mySeat}，当前人数: ${room.count}`);

        socket.emit('initIdentity', { 
            seat: mySeat, 
            isHost: (mySeat === 0)
        });

        io.emit('roomUpdate', { 
            humanCount: room.count,
            seats: room.seats.map(s => s ? (s === 'BOT' ? 'AI' : 'HUMAN') : null)
        });

        // 2人满 -> 发牌开始游戏
        if(room.count === 2) {
            console.log("🎮 双人集结，开始游戏");
            setTimeout(() => {
                startGame();
            }, 1000);
        }
    } else {
        socket.emit('roomFull');
    }

    // --- 处理玩家出牌 ---
    socket.on('action', (data) => {
        // data: { seat, type, cards, handType }
        console.log(`📤 Seat ${data.seat} 动作:`, data.type);
        
        // 服务器验证（防作弊）
        if(data.type === 'play') {
            let cardType = getHandType(data.cards);
            if(!cardType) {
                socket.emit('error', {msg: '非法牌型'});
                return;
            }
            
            // 验证是否能打过上家
            if(room.gameState && room.gameState.lastHand && room.gameState.lastHand.owner !== data.seat) {
                if(!canBeat(data.cards, cardType, room.gameState.lastHand)) {
                    socket.emit('error', {msg: '打不过上家'});
                    return;
                }
            }
            
            // 更新游戏状态
            if(!room.gameState) room.gameState = {};
            room.gameState.lastHand = {
                owner: data.seat,
                type: cardType.type,
                val: cardType.val,
                count: cardType.count,
                score: cardType.score
            };
        }
        
        // 验证通过，广播给所有人
        io.emit('syncAction', data);
    });

    // Bot 动作（仅主机发送）
    socket.on('botAction', (data) => {
        console.log(`🤖 Bot Seat ${data.seat} 动作:`, data.type);
        io.emit('syncAction', data);
    });

    // 断线
    socket.on('disconnect', () => {
        let seat = room.players[socket.id];
        if(seat !== undefined) {
            console.log(`❌ Seat ${seat} 断线`);
            room.seats[seat] = null;
            delete room.players[socket.id];
            room.count--;
            room.gameState = null; // 重置游戏
            io.emit('playerLeft');
            io.emit('roomUpdate', { humanCount: room.count });
        }
    });
});

// --- 服务器发牌 ---
function startGame() {
    console.log('🃏 服务器开始发牌...');
    
    let hands = dealCards();
    room.gameState = {
        hands: hands,
        turn: 0,
        lastHand: null,
        passCount: 0,
        finished: [],
        counts: [27, 27, 27, 27]
    };
    
    console.log('📤 发送手牌给玩家...');
    
    // 先发送每个玩家的手牌
    Object.keys(room.players).forEach(socketId => {
        let seat = room.players[socketId];
        console.log(`  -> Seat ${seat}: ${hands[seat].length} 张牌`);
        io.to(socketId).emit('dealCards', {
            seat: seat,
            cards: hands[seat]
        });
    });
    
    // 主机额外获得 Bot 的牌（用于计算）
    let hostId = Object.keys(room.players).find(id => room.players[id] === 0);
    if(hostId) {
        console.log(`  -> 主机收到 Bot 牌`);
        io.to(hostId).emit('botCards', {
            bot1: hands[1],
            bot3: hands[3]
        });
    }
    
    // 延迟一点再广播游戏开始，确保牌都发完了
    setTimeout(() => {
        console.log('✅ 发牌完成，广播 gameStart');
        io.emit('gameStart', { startTurn: 0 });
    }, 200);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
