// server.js - V31 (Tube Support + Score Persistence)
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
const SEQ_VAL={'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13};
const SUITS = ['♠','♥','♣','♦']; 
const POINTS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

// 积分存储（简单内存存储，生产环境用数据库）
let playerScores = {};

function createDeck() {
    let deck = [];
    for(let i=0; i<2; i++) {
        SUITS.forEach(s => POINTS.forEach(v => deck.push({
            s, v, p:POWER[v], seq:SEQ_VAL[v]||0, id:Math.random().toString(36).substr(2)
        })));
        deck.push({s:'JOKER', v:'Sm', p:POWER['Sm'], seq:19, id:Math.random().toString(36).substr(2)});
        deck.push({s:'JOKER', v:'Bg', p:POWER['Bg'], seq:20, id:Math.random().toString(36).substr(2)});
    }
    return deck.sort(() => Math.random() - 0.5);
}

function getHandType(c) {
    if(!c || !c.length) return null;
    let wild = c.filter(x => x.v === '2' && x.s === '♥');
    let norm = c.filter(x => !(x.v === '2' && x.s === '♥'));
    norm.sort((a,b) => a.p - b.p);
    let len = c.length;
    
    let m={}; norm.forEach(x=>m[x.p]=(m[x.p]||0)+1);
    let vals=Object.keys(m).map(Number).sort((a,b)=>a-b);
    let maxNormFreq = vals.length ? Math.max(...Object.values(m)) : 0;

    // 炸弹
    if(len>=4){
        let kings = c.filter(x=>x.s==='JOKER');
        if(kings.length===4) return {type:'bomb', val:999, count:6, score:1000};
        if(len === 4 && (maxNormFreq + wild.length >= 4) && maxNormFreq >= 1) {
            let v = vals.length ? vals[vals.length-1] : 15;
            return {type:'bomb', val:v, count:4, score:400};
        }
        if(wild.length === 0 && maxNormFreq === len) {
            let v = vals.length ? vals[vals.length-1] : 15;
            return {type:'bomb', val:v, count:len, score:len*100};
        }
    }

    if(len===1) return {type:'1', val:c[0].p};
    if(len===2 && (maxNormFreq + wild.length >= 2)) return {type:'2', val:vals.length?vals[vals.length-1]:15};
    if(len===3 && (maxNormFreq + wild.length >= 3)) return {type:'3', val:vals.length?vals[vals.length-1]:15};

    if(len===5) {
        if(vals.length <= 2 && maxNormFreq >= 2) return {type:'3+2', val:vals.length?vals[vals.length-1]:15};
        if(vals.length >= 3 && vals.length + wild.length >= 5) {
            let gap = vals[vals.length-1] - vals[0];
            if(gap <= 4) return {type:'straight', val:vals[vals.length-1]};
        }
    }
    
    // 钢板（连续三张: 333444）
    if(len===6 && vals.length===2 && vals[1]===vals[0]+1) {
        if(m[vals[0]] + wild.length >= 3) return {type:'plate', val:vals[0]};
    }
    
    // 木板（连对: 778899）
    if(len===6 && vals.length===3) {
        if(vals[1]===vals[0]+1 && vals[2]===vals[1]+1) {
            let hasEnough = (m[vals[0]]>=1 || wild.length>0) && 
                           (m[vals[1]]>=1 || wild.length>0) && 
                           (m[vals[2]]>=1 || wild.length>0);
            if(hasEnough) return {type:'tube', val:vals[0]};
        }
    }

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

let room = { seats: [null, 'BOT', null, 'BOT'], players: {}, count: 0, game: null, timer: null, botTimeout: null };

function resetRoom() { 
    room.seats = [null, 'BOT', null, 'BOT']; 
    room.players = {}; 
    room.count = 0; 
    room.game = null; 
    if(room.timer) clearTimeout(room.timer); 
    room.timer = null;
    if(room.botTimeout) clearTimeout(room.botTimeout);
    room.botTimeout = null;
}

io.on('connection', (socket) => {
    socket.on('joinGame', () => {
        if (room.players[socket.id] !== undefined) return;
        let seat = -1;
        if (room.seats[0] === null) seat = 0; else if (room.seats[2] === null) seat = 2;
        if (seat === -1) { 
            if(room.count === 0) { resetRoom(); seat=0; } 
            else { socket.emit('err', 'Full'); return; } 
        }
        
        room.seats[seat] = socket.id; 
        room.players[socket.id] = seat; 
        room.count++;
        
        // 发送玩家当前积分
        let score = playerScores[socket.id] || 1291;
        socket.emit('initIdentity', { seat: seat, isHost: (seat===0), score: score });
        io.emit('roomUpdate', { count: room.count });
        
        if (room.count === 2) { 
            if(room.timer) clearTimeout(room.timer); 
            room.timer = setTimeout(startGame, 3000); 
        }
    });

    socket.on('action', (d) => handleAction(d));
    socket.on('botAction', (d) => handleAction(d));

    socket.on('disconnect', () => {
        let seat = room.players[socket.id];
        if (seat !== undefined) {
            room.seats[seat] = null; 
            delete room.players[socket.id]; 
            room.count--;
            if(room.timer) { clearTimeout(room.timer); room.timer = null; }
            if(room.botTimeout) { clearTimeout(room.botTimeout); room.botTimeout = null; }
            if(room.game && room.game.active) { room.game.active = false; }
            if(room.count <= 0) resetRoom(); 
            else io.emit('roomUpdate', { count: room.count });
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
    
    if(room.botTimeout) { clearTimeout(room.botTimeout); room.botTimeout = null; }
    
    let g = room.game;
    let nextTurn = g.turn;
    let wasPlayAttempt = false;

    if (d.type === 'play') {
        wasPlayAttempt = true;
        let ht = getHandType(d.cards);
        if(!ht || !canBeat(d.cards, ht, g.lastHand)) {
            console.log(`❌ Invalid play from seat ${d.seat}`);
            d.type = 'pass';
            d.cards = [];
        } else {
            console.log(`✅ Seat ${d.seat} plays ${ht.type}`);
            g.lastHand = { owner: d.seat, type: ht.type, val: ht.val, count: d.cards.length, score: ht.score||0 };
            g.passCnt = 0;
            let playedIds = d.cards.map(c => c.id);
            g.hands[d.seat] = g.hands[d.seat].filter(c => !playedIds.includes(c.id));
            if(g.hands[d.seat].length === 0 && !g.finished.includes(d.seat)) g.finished.push(d.seat);
        }
    }
    
    if (d.type === 'pass') {
        if(!g.lastHand && !wasPlayAttempt) return; 
        g.passCnt++;
        console.log(`⏭️ Seat ${d.seat} passes`);
    }

    let active = 4 - g.finished.length;
    if(active <= 1) { 
        console.log("🏁 Game Over");
        
        // 计算积分并更新
        let humanSeats = Object.values(room.players);
        humanSeats.forEach(seat => {
            let sid = Object.keys(room.players).find(k => room.players[k] === seat);
            let mp = g.finished.indexOf(seat) + 1;
            let pp = g.finished.indexOf((seat+2)%4) + 1;
            let pts = 0;
            if(mp===1 && pp===2) pts=30;
            else if(mp===1 || pp===1) pts = (mp+pp===4) ? 15 : 5;
            else pts = (mp+pp===7) ? -15 : -5;
            
            playerScores[sid] = (playerScores[sid] || 1291) + pts;
            console.log(`Player ${seat}: ${pts >= 0 ? '+' : ''}${pts} → ${playerScores[sid]}`);
        });
        
        io.emit('syncAction', { ...d, nextTurn: -1 }); 
        room.game.active = false; 
        return; 
    }

    if (g.passCnt >= active - 1) {
        let winner = g.lastHand.owner;
        nextTurn = winner;
        if(g.finished.includes(winner)) {
            let partner = (winner + 2) % 4;
            if(!g.finished.includes(partner)) nextTurn = partner;
            else {
                let scan = 1; 
                while(g.finished.includes((winner + scan)%4) && scan < 5) scan++;
                nextTurn = (winner + scan) % 4;
            }
        }
        g.lastHand = null; g.passCnt = 0;
    } else {
        nextTurn = (g.turn + 1) % 4;
        let safety = 0;
        while(g.finished.includes(nextTurn) && safety < 10) {
            nextTurn = (nextTurn + 1) % 4;
            safety++;
        }
    }

    g.turn = nextTurn;
    io.emit('syncAction', {
        seat: d.seat, type: d.type, cards: d.cards || [],
        handType: d.handType || (d.type==='play' && d.cards ? getHandType(d.cards) : {}),
        nextTurn: nextTurn, isRoundEnd: (g.lastHand === null)
    });
    
    if(nextTurn === 1 || nextTurn === 3) {
        room.botTimeout = setTimeout(() => {
            if(room.game && room.game.active && room.game.turn === nextTurn) {
                console.log(`⏰ Bot ${nextTurn} timeout`);
                handleAction({seat: nextTurn, type: 'pass', cards: []});
            }
        }, 8000);
    }
}

http.listen(PORT, () => console.log(`✅ Server V31 on ${PORT}`));
