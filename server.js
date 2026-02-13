// server.js - Ghost Player Fix
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { 
    cors: { origin: "*" },
    // 增加心跳检测，快速发现断线
    pingTimeout: 2000,
    pingInterval: 5000
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

// 辅助：获取真实的在线人数
function getActiveCount() {
    let count = 0;
    // 检查座位 0 和 2
    [0, 2].forEach(i => {
        if (room.seats[i] && room.seats[i] !== 'BOT') {
            // 关键：检查这个 socket ID 是否真的还活着
            if (io.sockets.sockets.get(room.seats[i])) {
                count++;
            } else {
                // 如果不活着，直接清空座位
                console.log(`[CLEAN] Cleaned up ghost at seat ${i}`);
                room.seats[i] = null;
            }
        }
    });
    return count;
}

io.on('connection', (socket) => {
    console.log(`[CONN] ${socket.id.substring(0,5)} connected.`);

    socket.on('joinGame', () => {
        // 1. 如果已经在房间里，直接忽略
        if (room.players[socket.id] !== undefined) return;

        // 2. 关键修复：清理幽灵玩家，获取真实人数
        let currentCount = getActiveCount();
        console.log(`[CHECK] Current active players: ${currentCount}`);

        // 3. 寻找空位
        let seat = -1;
        // 优先坐 0 号位
        if (room.seats[0] === null) seat = 0;
        else if (room.seats[2] === null) seat = 2;

        // 4. 如果没座位，尝试强制清理（双重保险）
        if (seat === -1) {
             // 理论上 getActiveCount 已经清理过了，如果还没座位说明真的满了
             socket.emit('err', 'Room is full');
             console.log(`[JOIN] ${socket.id.substring(0,5)} rejected.`);
             return;
        }

        // 5. 入座
        room.seats[seat] = socket.id;
        room.players[socket.id] = seat;
        
        const newCount = getActiveCount(); // 再次计算确认
        console.log(`[JOIN] Seat ${seat} taken by ${socket.id.substring(0,5)}. Total: ${newCount}`);

        socket.emit('initIdentity', { seat: seat, isHost: (seat === 0) });
        io.emit('roomUpdate', { count: newCount });

        // 6. 开始判定
        if (newCount === 2) {
            console.log("[START] 2 players detected! Game starting...");
            if (room.timer) clearTimeout(room.timer);
            room.timer = setTimeout(startGame, 1500); // 缩短等待时间
        }
    });

    socket.on('action', (d) => handleAction(d));
    socket.on('botAction', (d) => handleAction(d));

    socket.on('disconnect', () => {
        let seat = room.players[socket.id];
        if (seat !== undefined) {
            console.log(`[DISC] Seat ${seat} (${socket.id.substring(0,5)}) left.`);
            if (room.seats[seat] === socket.id) {
                room.seats[seat] = null;
            }
            delete room.players[socket.id];
            
            const count = getActiveCount();
            io.emit('roomUpdate', { count: count });

            if (room.timer) {
                clearTimeout(room.timer);
                room.timer = null;
            }
        }
    });
});

function startGame() {
    console.log("[GAME] Dealing cards...");
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

    // 发送手牌
    Object.keys(room.players).forEach(sid => {
        let s = room.players[sid];
        if (io.sockets.sockets.get(sid)) {
            io.to(sid).emit('dealCards', { cards: hands[s] });
            if (s === 0) io.to(sid).emit('botCards', { bot1: hands[1], bot3: hands[3] });
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
