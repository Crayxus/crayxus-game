// server.js - Crayxus Fixed & Synchronized (Final)
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

// --- 牌力定义 ---
const POWER = {'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15,'Sm':16,'Bg':17};
const SEQ_VAL = {'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13};
const SUITS = ['♠','♥','♣','♦'];
const POINTS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function createDecks() {
    let deck = [];
    for(let d=0; d<2; d++) {
        SUITS.forEach(s => POINTS.forEach(v => deck.push({ s:s, v:v, p:POWER[v], seq:SEQ_VAL[v], id:Math.random().toString(36).substr(2,9) })));
        deck.push({s:'JOKER', v:'Bg', p:POWER['Bg'], seq:20, id:Math.random().toString(36).substr(2,9)});
        deck.push({s:'JOKER', v:'Sm', p:POWER['Sm'], seq:19, id:Math.random().toString(36).substr(2,9)});
    }
    for(let i=deck.length-1; i>0; i--) { let j = Math.floor(Math.random() * (i+1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    return deck;
}

function getHandType(cards) {
    if(!cards || !cards.length) return null;
    cards.sort((a,b) => a.p - b.p);
    let len = cards.length, map = {}, maxCount = 0;
    cards.forEach(c => map[c.p] = (map[c.p]||0)+1);
    let vals = Object.keys(map).map(Number).sort((a,b)=>a-b);
    let counts = Object.values(map);
    maxCount = Math.max(...counts);

    if(len === 1) return {type:'1', val:cards[0].p};
    if(len === 2 && maxCount === 2) return {type:'2', val:cards[0].p};
    if(len === 3 && maxCount === 3) return {type:'3', val:cards[0].p};
    if(len >= 4 && maxCount === len) return {type:'bomb', val:cards[0].p, count:len, score:len*100};
    if(len === 4 && cards.every(c => c.s === 'JOKER')) return {type:'bomb', val:999, count:6, score:1000};
    if(len === 5 && vals.length === 2 && (map[vals[0]] === 3 || map[vals[1]] === 3)) {
        return {type:'3+2', val: (map[vals[1]] === 3 ? vals[1] : vals[0])};
    }
    if(len === 5 && maxCount === 1) {
        let isSeq = true;
        for(let i=0; i<len-1; i++) if(cards[i+1].p !== cards[i].p + 1) isSeq = false;
        if(!isSeq) {
            let seqs = cards.map(c=>c.seq).sort((a,b)=>a-b);
            if(seqs[0]===1 && seqs[1]===2 && seqs[2]===3 && seqs[3]===4 && seqs[4]===5) isSeq = true;
        }
        if(isSeq) {
            let isFlush = cards.every(c => c.s === cards[0].s);
            let val = cards[4].p;
            if(isFlush) return {type:'straight_flush', val:val, count:5.5, score:550};
            return {type:'straight', val:val};
        }
    }
    if(len === 6 && vals.length === 3 && maxCount === 2 && counts.every(c=>c===2) && vals[1] === vals[0]+1 && vals[2] === vals[1]+1) return {type:'tube', val:vals[0]};
    if(len === 6 && vals.length === 2 && maxCount === 3 && counts.every(c=>c===3) && vals[1] === vals[0]+1) return {type:'plate', val:vals[0]};
    return null;
}

function canBeat(newCards, newType, lastHand) {
    if(!lastHand) return true;
    let isNewBomb = (newType.type === 'bomb' || newType.type === 'straight_flush');
    let isLastBomb = (lastHand.type === 'bomb' || lastHand.type === 'straight_flush');
    if(isNewBomb && !isLastBomb) return true;
    if(!isNewBomb && isLastBomb) return false;
    if(isNewBomb && isLastBomb) {
        if(newType.score > lastHand.score) return true;
        if(newType.score < lastHand.score) return false;
        return newType.val > lastHand.val;
    }
    if(newType.type !== lastHand.type) return false;
    if(newCards.length !== (lastHand.realCount || lastHand.count)) return false; 
    return newType.val > lastHand.val;
}

let room = {
    players: {},
    seats: [null, 'BOT', null, 'BOT'],
    count: 0,
    state: { active: false, deck: [], hands: [[],[],[],[]], turn: 0, lastHand: null, passCount: 0, finished: [] }
};

io.on('connection', (socket) => {
    console.log(`Checking in: ${socket.id}`);
    
    // 如果房间是满的但其实没人（僵尸状态），重置它
    if(room.count === 0 && (room.seats[0] || room.seats[2])) {
        room.seats = [null, 'BOT', null, 'BOT'];
        room.state.active = false;
        console.log("Room reset due to empty state.");
    }

    let seat = -1;
    if(room.seats[0] === null) seat = 0; else if(room.seats[2] === null) seat = 2;

    if(seat === -1) { socket.emit('err', 'Room Full'); socket.disconnect(); return; }

    room.seats[seat] = socket.id;
    room.players[socket.id] = seat;
    room.count++;
    console.log(`Player assigned to Seat ${seat}`);

    socket.emit('initIdentity', { seat: seat, isHost: seat===0 });
    io.emit('roomUpdate', { humanCount: room.count });

    // 延迟 3秒 开局，以便看到 "Waiting" 界面
    if(room.count === 2) setTimeout(startGame, 3000);

    socket.on('action', (data) => handleAction(seat, data));
    socket.on('botAction', (data) => handleAction(data.seat, data));

    socket.on('disconnect', () => {
        if(room.players[socket.id] !== undefined) {
            let s = room.players[socket.id];
            room.seats[s] = null;
            delete room.players[socket.id];
            room.count--;
            room.state.active = false;
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

    room.state = { active: true, hands: hands, turn: Math.floor(Math.random()*4), lastHand: null, passCount: 0, finished: [] };

    Object.keys(room.players).forEach(sid => {
        let s = room.players[sid];
        io.to(sid).emit('dealCards', { cards: hands[s] });
        if(s === 0) io.to(sid).emit('botCards', { bot1: hands[1], bot3: hands[3] });
    });

    setTimeout(() => { io.emit('gameStart', { startTurn: room.state.turn }); }, 2000);
}

function handleAction(seat, data) {
    if(!room.state.active || seat !== room.state.turn) return;

    let nextTurn = room.state.turn;
    let eventType = data.type; 
    
    if(eventType === 'play') {
        let ht = getHandType(data.cards);
        if(!ht || !canBeat(data.cards, ht, room.state.lastHand)) return;

        room.state.lastHand = { owner: seat, type: ht.type, val: ht.val, score: ht.score || 0, count: ht.count || data.cards.length, realCount: data.cards.length };
        room.state.passCount = 0;
        
        // 简单的数量扣除，实际卡牌ID逻辑在客户端处理显示
        room.state.hands[seat].splice(0, data.cards.length);
        
        if(room.state.hands[seat].length === 0 && !room.state.finished.includes(seat)) room.state.finished.push(seat);
    } else {
        if(!room.state.lastHand) return;
        room.state.passCount++;
    }

    let activePlayers = 4 - room.state.finished.length;
    if(activePlayers <= 1) {
        io.emit('syncAction', { seat: seat, type: eventType, cards: data.cards, handType: data.handType, nextTurn: -1 });
        return;
    }

    if(room.state.passCount >= activePlayers - 1) {
        let winner = room.state.lastHand.owner;
        nextTurn = winner;
        if(room.state.finished.includes(winner)) {
             let scan = 1;
             while(room.state.finished.includes((winner + scan)%4) && scan < 5) scan++;
             nextTurn = (winner + scan) % 4;
        }
        room.state.lastHand = null;
        room.state.passCount = 0;
    } else {
        let scan = 1;
        while(room.state.finished.includes((seat + scan)%4) && scan < 5) scan++;
        nextTurn = (seat + scan) % 4;
    }

    room.state.turn = nextTurn;
    io.emit('syncAction', {
        seat: seat,
        type: eventType,
        cards: data.cards,
        handType: data.handType || (eventType==='play'?getHandType(data.cards):null),
        nextTurn: nextTurn,
        isRoundEnd: (room.state.lastHand === null)
    });
}

http.listen(PORT, () => console.log(`Server running on ${PORT}`));
