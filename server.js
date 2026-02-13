// server.js - Robust Version
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 10000,
    pingInterval: 5000
});

const PORT = process.env.PORT || 3000;

const POWER={'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15,'Sm':16,'Bg':17};
const SUITS = ['♠','♥','♣','♦']; const POINTS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

function createDeck() {
    let deck = [];
    for(let i=0; i<2; i++) {
        SUITS.forEach(s => POINTS.forEach(v => deck.push({s, v, p:POWER[v], id:Math.random().toString(36).substr(2)})));
        deck.push({s:'JOKER', v:'Sm', p:POWER[v='Sm'], id:Math.random().toString(36).substr(2)});
        deck.push({s:'JOKER', v:'Bg', p:POWER[v='Bg'], id:Math.random().toString(36).substr(2)});
    }
    return deck.sort(() => Math.random() - 0.5);
}

// 房间数据
let room = {
    seats: [null, 'BOT', null, 'BOT'],
    players: {}, // socketId -> seat
    count: 0,
    game: null,
    timer: null
};

function resetRoom() {
    console.log(">> ROOM RESET");
    room.seats = [null, 'BOT', null, 'BOT'];
    room.players = {};
    room.count = 0;
    room.game = null;
    if(room.timer) clearTimeout(room.timer);
    room.timer = null;
}

io.on('connection', (socket) => {
    console.log(`[+] ${socket.id}`);

    // 请求入座
    socket.on('joinGame', () => {
        if (room.players[socket.id] !== undefined) return;

        let seat = -1;
        if (room.seats[0] === null) seat = 0;
        else if (room.seats[2] === null) seat = 2;

        if (seat === -1) {
            // 如果计数器是0但没座，说明状态错乱，重置
            if(room.count === 0) { resetRoom(); seat = 0; }
            else { socket.emit('err', 'Full'); return; }
        }

        room.seats[seat] = socket.id;
        room.players[socket.id] = seat;
        room.count++;
        
        console.log(`Player joined Seat ${seat}. Total: ${room.count}`);
        
        socket.emit('initIdentity', { seat: seat, isHost: (seat===0) });
        io.emit('roomUpdate', { count: room.count });

        if (room.count === 2) {
            console.log("Starting countdown...");
            if(room.timer) clearTimeout(room.timer);
            room.timer = setTimeout(startGame, 3000);
        }
    });

    socket.on('action', (d) => handleAction(d));
    socket.on('botAction', (d) => handleAction(d));

    socket.on('disconnect', () => {
        let seat = room.players[socket.id];
        if (seat !== undefined) {
            console.log(`[-] Seat ${seat} left`);
            room.seats[seat] = null;
            delete room.players[socket.id];
            room.count--;

            if(room.timer) { clearTimeout(room.timer); room.timer = null; }
            
            // 只要有人离开，游戏就结束
            if(room.game && room.game.active) {
                room.game.active = false;
                io.emit('roomUpdate', { count: room.count }); 
            }
            
            if(room.count <= 0) resetRoom();
            else io.emit('roomUpdate', { count: room.count });
        }
    });
});

function startGame() {
    console.log("Game Starting");
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

    Object.keys(room.players).forEach(sid => {
        let s = room.players[sid];
        io.to(sid).emit('dealCards', { cards: hands[s] });
        if(s === 0) io.to(sid).emit('botCards', { bot1: hands[1], bot3: hands[3] });
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
        // 简单维护服务端手牌数
        g.hands[d.seat].splice(0, d.cards.length);
        if(g.hands[d.seat].length === 0 && !g.finished.includes(d.seat)) g.finished.push(d.seat);
    } else {
        g.passCnt++;
    }

    let active = 4 - g.finished.length;
    if(active <= 1) { // 结束
        io.emit('syncAction', { ...d, nextTurn: -1 });
        room.game.active = false;
        return;
    }

    if (g.passCnt >= active - 1) {
        nextTurn = g.lastHand.owner;
        // 如果赢家已出完，找下家
        if(g.finished.includes(nextTurn)) {
            let scan = 1;
            while(g.finished.includes((nextTurn + scan)%4)) scan++;
            nextTurn = (nextTurn + scan) % 4;
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

http.listen(PORT, () => console.log(`Run on ${PORT}`));
