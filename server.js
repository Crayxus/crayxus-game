// server.js - Robust Matchmaking Fix
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { 
    cors: { origin: "*" },
    // 增加心跳检测，防止连接假死
    pingTimeout: 5000,
    pingInterval: 10000
});

const PORT = process.env.PORT || 3000;

// --- 牌力数据 ---
const POWER = {'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15,'Sm':16,'Bg':17};
const SUITS = ['♠','♥','♣','♦']; 
const POINTS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

function createDeck() {
    let deck = [];
    for(let i=0; i<2; i++) {
        SUITS.forEach(s => POINTS.forEach(v => deck.push({s, v, p:POWER[v], id:Math.random().toString(36).substr(2)})));
        deck.push({s:'JOKER', v:'Sm', p:POWER['Sm'], id:Math.random().toString(36).substr(2)});
        deck.push({s:'JOKER', v:'Bg', p:POWER['Bg'], id:Math.random().toString(36).substr(2)});
    }
    return deck.sort(() => Math.random() - 0.5);
}

// --- 房间状态 ---
let room = {
    seats: [null, 'BOT', null, 'BOT'], // 0=Player, 2=Player
    players: {}, // socketId -> seatIndex
    game: null,
    timer: null
};

// 辅助函数：计算当前真实玩家数
function getActivePlayerCount() {
    // 过滤掉 null 和 'BOT'，剩下的都是真人
    return room.seats.filter(s => s && s !== 'BOT').length;
}

io.on('connection', (socket) => {
    console.log(`[CONN] ${socket.id.substr(0,5)} connected.`);

    socket.on('joinGame', () => {
        // 1. 防止重复加入
        if (room.players[socket.id] !== undefined) {
            console.log(`[JOIN] ${socket.id.substr(0,5)} already in room.`);
            return;
        }

        // 2. 关键修复：清理无效座位
        // 如果座位上有一个 ID，但对应的 socket 已经断开了，就清空这个座位
        for (let i = 0; i < 4; i++) {
            if (room.seats[i] && room.seats[i] !== 'BOT') {
                // 检查这个 socket ID 是否还活着
                if (!io.sockets.sockets.get(room.seats[i])) {
                    console.log(`[CLEAN] Seat ${i} had ghost player. Clearing.`);
                    room.seats[i] = null;
                }
            }
        }

        // 3. 分配座位
        let seat = -1;
        if (room.seats[0] === null) seat = 0;
        else if (room.seats[2] === null) seat = 2;

        if (seat === -1) {
            socket.emit('err', 'Room is full');
            console.log(`[JOIN] ${socket.id.substr(0,5)} rejected - Full.`);
            return;
        }

        // 4. 入座
        room.seats[seat] = socket.id;
        room.players[socket.id] = seat;
        
        // 5. 实时计算人数并通知
        const count = getActivePlayerCount();
        console.log(`[JOIN] Seat ${seat} taken by ${socket.id.substr(0,5)}. Count: ${count}`);

        socket.emit('initIdentity', { seat: seat, isHost: (seat === 0) });
        
        // 向所有人广播最新人数
        io.emit('roomUpdate', { count: count });

        // 6. 开始判定
        if (count === 2) {
            console.log("[WAIT] 2 players confirmed. Starting in 2s...");
            if (room.timer) clearTimeout(room.timer);
            // 缩短等待时间，减少变数
            room.timer = setTimeout(startGame, 2000);
        }
    });

    socket.on('action', (d) => handleAction(d));
    socket.on('botAction', (d) => handleAction(d));

    socket.on('disconnect', () => {
        let seat = room.players[socket.id];
        if (seat !== undefined) {
            console.log(`[DISC] Seat ${seat} (${socket.id.substr(0,5)}) left.`);
            
            // 只有当该座位确实属于这个 socket 时才清空 (防止误清)
            if (room.seats[seat] === socket.id) {
                room.seats[seat] = null;
            }
            
            delete room.players[socket.id];
            
            // 广播最新人数
            const count = getActivePlayerCount();
            io.emit('roomUpdate', { count: count });

            if (room.timer) {
                clearTimeout(room.timer);
                room.timer = null;
                console.log("[STOP] Launch aborted.");
            }
        }
    });
});

function startGame() {
    console.log("[GAME] Starting game session!");
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

    // 发送手牌给客户端
    Object.keys(room.players).forEach(sid => {
        let s = room.players[sid];
        // 确保只发送给还在房间的玩家
        if (io.sockets.sockets.get(sid)) {
            io.to(sid).emit('dealCards', { cards: hands[s] });
            // 只有 Seat 0 接收 Bot 数据
            if (s === 0) {
                io.to(sid).emit('botCards', { bot1: hands[1], bot3: hands[3] });
            }
        }
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
        g.hands[d.seat].splice(0, d.cards.length);
        
        if (g.hands[d.seat].length === 0) {
            if (!g.finished.includes(d.seat)) g.finished.push(d.seat);
        }
    } else {
        g.passCnt++;
    }

    // 计算下一手
    let activePlayers = 4 - g.finished.length;
    if (activePlayers <= 1) {
        io.emit('syncAction', { ...d, nextTurn: -1 });
        room.game.active = false;
        return;
    }

    if (g.passCnt >= activePlayers - 1) {
        let winner = g.lastHand.owner;
        nextTurn = winner;
        if (g.finished.includes(winner)) {
            nextTurn = (winner + 1) % 4;
            while(g.finished.includes(nextTurn)) nextTurn = (nextTurn + 1) % 4;
        }
        g.lastHand = null;
        g.passCnt = 0;
    } else {
        nextTurn = (g.turn + 1) % 4;
        while(g.finished.includes(nextTurn)) nextTurn = (nextTurn + 1) % 4;
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
