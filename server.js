// server.js - Final Fix
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

// --- 牌力数据 ---
const POWER={'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15,'Sm':16,'Bg':17};
const SUITS = ['♠','♥','♣','♦']; const POINTS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

function createDeck() {
    let deck = [];
    // 2副牌
    for(let i=0; i<2; i++) {
        SUITS.forEach(s => POINTS.forEach(v => deck.push({s, v, p:POWER[v], id:Math.random().toString(36).substr(2)})));
        deck.push({s:'JOKER', v:'Sm', p:POWER['Sm'], id:Math.random().toString(36).substr(2)});
        deck.push({s:'JOKER', v:'Bg', p:POWER['Bg'], id:Math.random().toString(36).substr(2)});
    }
    return deck.sort(() => Math.random() - 0.5);
}

// --- 房间状态 ---
let room = {
    seats: [null, 'BOT', null, 'BOT'], // 0=Player, 1=Bot, 2=Player, 3=Bot
    players: {}, // socketId -> seatIndex
    count: 0,
    game: null, // { active: bool, turn: int, hands: [], lastHand: null, passCnt: 0, finished: [] }
    timer: null // 倒计时引用
};

io.on('connection', (socket) => {
    console.log(`[CONN] ${socket.id}`);

    // 只有当客户端点击 "FIND MATCH" 发送 joinGame 时，才分配座位
    socket.on('joinGame', () => {
        if (room.players[socket.id] !== undefined) return; // 已经在房间里了

        let seat = -1;
        if (room.seats[0] === null) seat = 0;
        else if (room.seats[2] === null) seat = 2;

        if (seat === -1) {
            socket.emit('err', 'Room is full');
            return;
        }

        // 入座
        room.seats[seat] = socket.id;
        room.players[socket.id] = seat;
        room.count++;
        console.log(`[JOIN] Seat ${seat} taken by ${socket.id}. Count: ${room.count}`);

        socket.emit('initIdentity', { seat: seat, isHost: (seat === 0) });
        io.emit('roomUpdate', { count: room.count });

        // 检查开始条件
        if (room.count === 2) {
            console.log("[WAIT] 2 players ready. Starting in 3s...");
            if (room.timer) clearTimeout(room.timer);
            room.timer = setTimeout(startGame, 3000);
        }
    });

    // 动作处理
    socket.on('action', (d) => handleAction(d));
    socket.on('botAction', (d) => handleAction(d));

    socket.on('disconnect', () => {
        let seat = room.players[socket.id];
        if (seat !== undefined) {
            console.log(`[DISC] Seat ${seat} left.`);
            room.seats[seat] = null;
            delete room.players[socket.id];
            room.count--;

            // 取消开始倒计时
            if (room.timer) {
                clearTimeout(room.timer);
                room.timer = null;
                console.log("[STOP] Launch aborted.");
            }

            // 如果游戏正在进行，强制结束（这里简单处理，实际可加重连）
            if (room.game && room.game.active) {
                room.game.active = false;
                io.emit('roomUpdate', { count: room.count }); // 踢回大厅或显示等待
            } else {
                io.emit('roomUpdate', { count: room.count });
            }
        }
    });
});

function startGame() {
    console.log("[GAME] Starting!");
    let deck = createDeck();
    let hands = [[], [], [], []];
    // 发牌：每人27张
    for(let i=0; i<108; i++) hands[i%4].push(deck[i]);

    room.game = {
        active: true,
        turn: Math.floor(Math.random()*4), // 随机先手
        hands: hands,
        lastHand: null,
        passCnt: 0,
        finished: []
    };

    // 发送手牌
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
        // 简单扣牌逻辑，具体牌ID客户端自己维护，服务端只管数量，防止作弊需要更复杂逻辑
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

    // 接风/轮转逻辑
    if (g.passCnt >= activePlayers - 1) {
        // 大家都不要
        let winner = g.lastHand.owner;
        nextTurn = winner;
        // 如果赢家已经出完了，下家接风
        if (g.finished.includes(winner)) {
            nextTurn = (winner + 1) % 4;
            while(g.finished.includes(nextTurn)) nextTurn = (nextTurn + 1) % 4;
        }
        g.lastHand = null;
        g.passCnt = 0;
    } else {
        // 普通轮转
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
