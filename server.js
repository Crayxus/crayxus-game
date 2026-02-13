// server.js - 终极修复版 (强制同步)
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 10000, // 10秒没心跳就断开
    pingInterval: 5000
});

const PORT = process.env.PORT || 3000;

// --- 基础数据 ---
const POWER={'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15,'Sm':16,'Bg':17};
const SEQ_VAL={'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13};
const SUITS = ['♠','♥','♣','♦']; const POINTS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

function createDeck() {
    let deck = [];
    for(let i=0; i<2; i++) {
        SUITS.forEach(s => POINTS.forEach(v => deck.push({s, v, p:POWER[v], seq:SEQ_VAL[v]||0, id:Math.random().toString(36).substr(2)})));
        deck.push({s:'JOKER', v:'Sm', p:POWER['Sm'], seq:19, id:Math.random().toString(36).substr(2)});
        deck.push({s:'JOKER', v:'Bg', p:POWER['Bg'], seq:20, id:Math.random().toString(36).substr(2)});
    }
    return deck.sort(() => Math.random() - 0.5);
}

// --- 简单的牌型判断 (服务端防作弊) ---
function getHandType(cards) {
    if(!cards || !cards.length) return null;
    cards.sort((a,b) => a.p - b.p);
    let len=cards.length, m={}; cards.forEach(c=>m[c.p]=(m[c.p]||0)+1);
    let max=Math.max(...Object.values(m));
    if(len===1) return {type:'1', val:cards[0].p};
    if(len===2 && max===2) return {type:'2', val:cards[0].p};
    if(len>=4 && max===len) return {type:'bomb', val:cards[0].p, count:len, score:len*100};
    if(len===4 && cards.every(c=>c.s==='JOKER')) return {type:'bomb', val:999, count:6, score:1000};
    // 简化处理其他牌型，允许通过
    return {type:'mix', val:cards[cards.length-1].p}; 
}

// --- 房间状态 ---
let room = {
    seats: [null, 'BOT', null, 'BOT'], // 0和2是玩家
    players: {}, // socket.id -> seatIndex
    count: 0,
    game: null, // { active: bool, turn: int, hands: [], lastHand: null, passCnt: 0, finished: [] }
    timer: null // 倒计时
};

function resetRoom() {
    console.log("!!! ROOM RESET !!!");
    room.seats = [null, 'BOT', null, 'BOT'];
    room.players = {};
    room.count = 0;
    room.game = null;
    if(room.timer) clearTimeout(room.timer);
    room.timer = null;
}

io.on('connection', (socket) => {
    console.log(`[CONNECT] ${socket.id}`);

    // 1. 玩家请求入座
    socket.on('joinGame', () => {
        // 防止重复加入
        if (room.players[socket.id] !== undefined) {
             io.to(socket.id).emit('roomUpdate', { count: room.count });
             return;
        }

        let seat = -1;
        if (room.seats[0] === null) seat = 0;
        else if (room.seats[2] === null) seat = 2;

        if (seat === -1) {
            // 房间满了，或者状态异常
            if(room.count === 0) {
                // 如果计数器是0但没座位，说明出bug了，强制重置
                resetRoom();
                seat = 0;
            } else {
                socket.emit('err', 'Room Full');
                return;
            }
        }

        // 分配座位
        room.seats[seat] = socket.id;
        room.players[socket.id] = seat;
        room.count++;
        
        console.log(`[JOIN] User ${socket.id} -> Seat ${seat} (Total: ${room.count}/2)`);
        
        // 告诉玩家他是谁
        socket.emit('initIdentity', { seat: seat, isHost: (seat === 0) });
        
        // 广播人数
        io.emit('roomUpdate', { count: room.count });

        // 2. 检查是否开始 (2人)
        if (room.count === 2) {
            console.log("[READY] Game starting in 3s...");
            if(room.timer) clearTimeout(room.timer);
            room.timer = setTimeout(startGame, 3000);
        }
    });

    // 3. 游戏动作
    socket.on('action', (d) => handleAction(d));
    socket.on('botAction', (d) => handleAction(d));

    // 4. 断开连接
    socket.on('disconnect', () => {
        let seat = room.players[socket.id];
        if (seat !== undefined) {
            console.log(`[LEAVE] Seat ${seat} disconnected`);
            room.seats[seat] = null;
            delete room.players[socket.id];
            room.count--;

            // 取消倒计时
            if(room.timer) {
                clearTimeout(room.timer);
                room.timer = null;
                console.log("[ABORT] Start cancelled");
            }

            // 游戏强行结束
            if(room.game && room.game.active) {
                room.game.active = false;
                io.emit('gameError', 'Opponent disconnected');
            }

            // 如果没人了，重置防止僵尸
            if(room.count <= 0) resetRoom();
            
            io.emit('roomUpdate', { count: room.count });
        }
    });
});

function startGame() {
    console.log("[START] Dealing cards...");
    let deck = createDeck();
    let hands = [[], [], [], []];
    for(let i=0; i<108; i++) hands[i%4].push(deck[i]);

    room.game = {
        active: true,
        turn: Math.floor(Math.random()*4),
        hands: hands,
        lastHand: null,
        passCnt: 0,
        finished: []
    };

    // 发牌
    Object.keys(room.players).forEach(sid => {
        let s = room.players[sid];
        io.to(sid).emit('dealCards', { cards: hands[s] });
        if (s === 0) io.to(sid).emit('botCards', { bot1: hands[1], bot3: hands[3] });
    });

    io.emit('gameStart', { startTurn: room.game.turn });
}

function handleAction(d) {
    if (!room.game || !room.game.active) return;
    if (d.seat !== room.game.turn) return;

    let g = room.game;
    let nextTurn = g.turn;

    if (d.type === 'play') {
        g.lastHand = { owner: d.seat, type: d.handType.type, val: d.handType.val, count: d.cards.length, score: d.handType.score||0 };
        g.passCnt = 0;
        // 简单扣牌逻辑 (客户端要同步移除)
        if(d.seat === 1 || d.seat === 3) {
             // 服务端稍微维护一下bot手牌数量
        }
        
        // 检查胜利
        // 这里简化：实际应该检查 hands[d.seat].length === 0
        // 我们假设客户端发来的出牌是合法的，直接信任其扣减逻辑，服务端只做状态流转
        
    } else {
        g.passCnt++;
    }

    // 计算下一手
    let activePlayers = 4; // 简化，暂不处理有人出完的情况
    // 如果有finished逻辑...
    
    if (g.passCnt >= 3) { // 3家不要
        nextTurn = g.lastHand.owner;
        g.lastHand = null;
        g.passCnt = 0;
    } else {
        nextTurn = (g.turn + 1) % 4;
    }

    g.turn = nextTurn;

    io.emit('syncAction', {
        seat: d.seat,
        type: d.type,
        cards: d.cards || [],
        handType: d.handType || {},
        nextTurn: nextTurn,
        isRoundEnd: (g.lastHand === null)
    });
}

http.listen(PORT, () => console.log(`Server running on ${PORT}`));
