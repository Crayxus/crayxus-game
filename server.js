// server.js - V30.4 (Stable Rule Sync)
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 10000,
    pingInterval: 5000
});

const PORT = process.env.PORT || 3000;

// --- 牌力数据 ---
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

// --- 服务端校验规则 ---
function getHandType(c) {
    if(!c || !c.length) return null;
    let wild = c.filter(x => x.v === '2' && x.s === '♥').length;
    let norm = c.filter(x => !(x.v === '2' && x.s === '♥'));
    norm.sort((a,b) => a.p - b.p);
    let len = c.length;
    
    let m={}; norm.forEach(x=>m[x.p]=(m[x.p]||0)+1);
    let vals=Object.keys(m).map(Number).sort((a,b)=>a-b);
    let maxNormFreq = vals.length ? Math.max(...Object.values(m)) : 0;

    // 1. 炸弹逻辑
    if(len>=4){
        let kings = c.filter(x=>x.s==='JOKER');
        if(kings.length===4) return {type:'bomb', val:999, count:6, score:1000};
        if((maxNormFreq + wild) >= len) {
            let v = vals.length ? vals[vals.length-1] : 15;
            return {type:'bomb', val:v, count:len, score:len*100};
        }
    }

    // 2. 基础牌型
    if(len===1) return {type:'1', val:c[0].p};
    if(len===2 && (maxNormFreq + wild >= 2)) return {type:'2', val:vals.length?vals[vals.length-1]:15};
    if(len===3 && (maxNormFreq + wild >= 3)) return {type:'3', val:vals.length?vals[vals.length-1]:15};

    // 3. 五张牌
    if(len===5) {
        if(vals.length <= 2) return {type:'3+2', val:vals.length?vals[vals.length-1]:15};
        if(vals.length + wild >= 5 && (vals[vals.length-1] - vals[0]) < 5) return {type:'straight', val:vals[vals.length-1]};
    }
    
    if(len===6 && vals.length===2 && (vals[1]===vals[0]+1) && (m[vals[0]]+wild>=3)) return {type:'plate', val:vals[0]};

    return null; 
}

function canBeat(newCards, newType, lastHand) {
    if(!lastHand) return true;
    let isNewBomb = (newType.type === 'bomb'), isLastBomb = (lastHand.type === 'bomb');
    if(isNewBomb && !isLastBomb) return true;
    if(!isNewBomb && isLastBomb) return false;
    if(isNewBomb && isLastBomb) {
        if(newType.score > lastHand.score) return true;
        if(newType.score < lastHand.score) return false;
        return newType.val > lastHand.val;
    }
    if(newType.type !== lastHand.type) return false;
    if(newCards.length !== lastHand.count) return false; 
    return newType.val > lastHand.val;
}

// --- 房间 ---
let room = { seats: [null, 'BOT', null, 'BOT'], players: {}, count: 0, game: null, timer: null };

function resetRoom() { room.seats = [null, 'BOT', null, 'BOT']; room.players = {}; room.count = 0; room.game = null; if(room.timer) clearTimeout(room.timer); room.timer = null; }

io.on('connection', (socket) => {
    socket.on('joinGame', () => {
        if (room.players[socket.id] !== undefined) return;
        let seat = -1;
        if (room.seats[0] === null) seat = 0; else if (room.seats[2] === null) seat = 2;
        if (seat === -1) { if(room.count === 0) { resetRoom(); seat=0; } else { socket.emit('err', 'Full'); return; } }
        room.seats[seat] = socket.id; room.players[socket.id] = seat; room.count++;
        socket.emit('initIdentity', { seat: seat, isHost: (seat===0) });
        io.emit('roomUpdate', { count: room.count });
        if (room.count === 2) { if(room.timer) clearTimeout(room.timer); room.timer = setTimeout(startGame, 3000); }
    });

    socket.on('action', (d) => handleAction(d));
    socket.on('botAction', (d) => handleAction(d));

    socket.on('disconnect', () => {
        let seat = room.players[socket.id];
        if (seat !== undefined) {
            room.seats[seat] = null; delete room.players[socket.id]; room.count--;
            if(room.timer) { clearTimeout(room.timer); room.timer = null; }
            if(room.game && room.game.active) { room.game.active = false; io.emit('roomUpdate', {count:room.count}); }
            if(room.count <= 0) resetRoom(); else io.emit('roomUpdate', { count: room.count });
        }
    });
});

function startGame() {
    let deck = createDeck();
    let hands = [[], [], [], []];
    for(let i=0; i<108; i++) hands[i%4].push(deck[i]);
    room.game = { active: true, turn: Math.floor(Math.random()*4), hands: hands, lastHand: null, passCnt: 0, finished: [] };
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
        let ht = getHandType(d.cards);
        if(!ht || !canBeat(d.cards, ht, g.lastHand)) return; 
        g.lastHand = { owner: d.seat, type: ht.type, val: ht.val, count: d.cards.length, score: ht.score||0 };
        g.passCnt = 0;
        g.hands[d.seat].splice(0, d.cards.length);
        if(g.hands[d.seat].length === 0 && !g.finished.includes(d.seat)) g.finished.push(d.seat);
    } else {
        if(!g.lastHand) return; 
        g.passCnt++;
    }

    let active = 4 - g.finished.length;
    if(active <= 1) { io.emit('syncAction', { ...d, nextTurn: -1 }); room.game.active = false; return; }

    if (g.passCnt >= active - 1) {
        let winner = g.lastHand.owner;
        nextTurn = winner;
        if(g.finished.includes(winner)) {
            let partner = (winner + 2) % 4;
            if(!g.finished.includes(partner)) nextTurn = partner; // 对家接风
            else {
                let scan = 1; while(g.finished.includes((winner + scan)%4)) scan++;
                nextTurn = (winner + scan) % 4;
            }
        }
        g.lastHand = null; g.passCnt = 0;
    } else {
        nextTurn = (g.turn + 1) % 4;
        while(g.finished.includes(nextTurn)) nextTurn = (nextTurn + 1) % 4;
    }

    g.turn = nextTurn;
    io.emit('syncAction', {
        seat: d.seat, type: d.type, cards: d.cards || [],
        handType: d.handType || (d.type==='play'?getHandType(d.cards):{}),
        nextTurn: nextTurn, isRoundEnd: (g.lastHand === null)
    });
}

http.listen(PORT, () => console.log(`Run on ${PORT}`));
