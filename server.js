// server.js - Crayxus V36 (4-Player Support)
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 10000,
    pingInterval: 5000
});

const PORT = process.env.PORT || 3000;

const POWER = {'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15,'Sm':16,'Bg':17};
const SEQ_VAL = {'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13};
const SUITS = ['♠','♥','♣','♦'];
const POINTS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

let playerScores = {};

function createDeck() {
    let deck = [];
    for (let i = 0; i < 2; i++) {
        SUITS.forEach(s => POINTS.forEach(v => deck.push({
            s, v, p: POWER[v], seq: SEQ_VAL[v] || 0, id: Math.random().toString(36).substr(2)
        })));
        deck.push({ s:'JOKER', v:'Sm', p:POWER['Sm'], seq:19, id:Math.random().toString(36).substr(2) });
        deck.push({ s:'JOKER', v:'Bg', p:POWER['Bg'], seq:20, id:Math.random().toString(36).substr(2) });
    }
    for (let i = deck.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function getHandType(c) {
    if (!c || !c.length) return null;
    let wild = c.filter(x => x.v === '2' && x.s === '♥');
    let norm = c.filter(x => !(x.v === '2' && x.s === '♥'));
    norm.sort((a, b) => a.p - b.p);
    let len = c.length;
    let m = {};
    norm.forEach(x => m[x.p] = (m[x.p] || 0) + 1);
    let vals = Object.keys(m).map(Number).sort((a, b) => a - b);
    let maxNormFreq = vals.length ? Math.max(...Object.values(m)) : 0;

    if (len >= 4) {
        let kings = c.filter(x => x.s === 'JOKER');
        if (kings.length === 4) return { type:'bomb', val:999, count:6, score:1000 };
        if (len === 4 && (maxNormFreq + wild.length >= 4) && maxNormFreq >= 1) {
            let v = vals.length ? vals[vals.length - 1] : 15;
            return { type:'bomb', val:v, count:4, score:400 };
        }
        if (wild.length === 0 && maxNormFreq === len) {
            let v = vals.length ? vals[vals.length - 1] : 15;
            return { type:'bomb', val:v, count:len, score:len * 100 };
        }
    }
    if (len === 1) return { type:'1', val:c[0].p };
    if (len === 2 && (maxNormFreq + wild.length >= 2)) return { type:'2', val:vals.length ? vals[vals.length - 1] : 15 };
    if (len === 3 && (maxNormFreq + wild.length >= 3)) return { type:'3', val:vals.length ? vals[vals.length - 1] : 15 };

    if (len === 5) {
        // Straights cannot contain 2s (p=15) or jokers
        let straightNorm = norm.filter(x => x.p <= 14);
        if (straightNorm.length + wild.length >= 5 && vals.filter(v => v <= 14).length >= 3) {
            let sVals = vals.filter(v => v <= 14);
            let gap = sVals[sVals.length - 1] - sVals[0];
            if (gap <= 4 && sVals.length + wild.length >= 5) {
                let isFlush = true;
                if (norm.length > 0) {
                    let firstSuit = norm[0].s;
                    for (let card of norm) { if (card.s !== firstSuit) { isFlush = false; break; } }
                }
                if (isFlush && norm.length === 5) return { type:'straight_flush', val:vals[vals.length - 1], score:550 };
                else return { type:'straight', val:vals[vals.length - 1] };
            }
        }
        // 3+2: val must be the TRIPLE's value, not just highest
        if (vals.length <= 2 && maxNormFreq >= 2) {
            let tripleVal = vals[vals.length - 1];
            for (let v of vals) { if (m[v] >= 3) { tripleVal = v; break; } }
            return { type:'3+2', val: tripleVal };
        }
    }
    if (len === 6 && vals.length === 2 && vals[1] === vals[0] + 1) {
        if (m[vals[0]] + wild.length >= 3) return { type:'plate', val:vals[0] };
    }
    if (len === 6 && vals.length === 3) {
        if (vals[1] === vals[0] + 1 && vals[2] === vals[1] + 1) {
            let hasEnough = (m[vals[0]] >= 1 || wild.length > 0) && (m[vals[1]] >= 1 || wild.length > 0) && (m[vals[2]] >= 1 || wild.length > 0);
            if (hasEnough) return { type:'tube', val:vals[0] };
        }
    }
    return null;
}

function canBeat(newCards, newType, lastHand) {
    if (!lastHand) return true;
    let isNewBomb = (newType.type === 'bomb' || newType.type === 'straight_flush');
    let isLastBomb = (lastHand.type === 'bomb' || lastHand.type === 'straight_flush');
    if (isNewBomb && !isLastBomb) return true;
    if (!isNewBomb && isLastBomb) return false;
    if (isNewBomb && isLastBomb) {
        let newScore = newType.score || (newType.type === 'bomb' ? newType.count * 100 : 550);
        let lastScore = lastHand.score || (lastHand.type === 'bomb' ? lastHand.count * 100 : 550);
        if (newScore > lastScore) return true;
        if (newScore < lastScore) return false;
        return newType.val > lastHand.val;
    }
    if (newType.type !== lastHand.type) return false;
    if (newCards.length !== lastHand.count) return false;
    return newType.val > lastHand.val;
}

let room = {
    // seats: null = empty, 'BOT' = AI, socket.id = human
    seats: [null, null, null, null],
    players: {},  // socket.id -> seat
    count: 0,     // human count
    game: null,
    timer: null,
    botTimeout: null
};

function resetRoom() {
    room.seats = [null, null, null, null];
    room.players = {};
    room.count = 0;
    room.game = null;
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    if (room.botTimeout) clearTimeout(room.botTimeout);
    room.botTimeout = null;
}

function isBotSeat(seat) {
    return room.seats[seat] === 'BOT';
}

function isHumanSeat(seat) {
    return room.seats[seat] !== null && room.seats[seat] !== 'BOT';
}

function getHostSid() {
    // Host is the first human player (lowest seat number)
    for (let i = 0; i < 4; i++) {
        if (isHumanSeat(i)) return room.seats[i];
    }
    return null;
}

function fillBotsAndStart() {
    // Fill empty seats with bots
    for (let i = 0; i < 4; i++) {
        if (room.seats[i] === null) room.seats[i] = 'BOT';
    }
    // Determine host (first human seat)
    let hostSid = getHostSid();
    // Identify which seats are bots
    let botSeats = [];
    for (let i = 0; i < 4; i++) {
        if (isBotSeat(i)) botSeats.push(i);
    }
    // Tell all players the seat layout
    Object.keys(room.players).forEach(sid => {
        let seat = room.players[sid];
        io.to(sid).emit('seatLayout', {
            seats: room.seats.map((s, i) => {
                if (s === 'BOT') return 'BOT';
                if (s === sid) return 'YOU';
                return 'HUMAN';
            }),
            isHost: (sid === hostSid),
            botSeats: botSeats
        });
    });
    startGame();
}

io.on('connection', (socket) => {
    console.log(`🔌 Connected: ${socket.id}`);

    socket.on('joinGame', () => {
        if (room.players[socket.id] !== undefined) return;
        
        // Find first empty seat
        let seat = -1;
        for (let i = 0; i < 4; i++) {
            if (room.seats[i] === null) { seat = i; break; }
        }
        
        if (seat === -1) {
            // All seats taken - if all bots + 0 humans, reset
            if (room.count === 0) { resetRoom(); seat = 0; }
            else { socket.emit('err', '房间已满 (Room Full)'); return; }
        }

        room.seats[seat] = socket.id;
        room.players[socket.id] = seat;
        room.count++;

        let score = playerScores[socket.id] || 1291;
        socket.emit('initIdentity', { seat: seat, score: score, playerCount: room.count });
        
        // Broadcast room update to all
        io.emit('roomUpdate', { 
            count: room.count,
            seats: room.seats.map(s => s === null ? 'EMPTY' : (s === 'BOT' ? 'BOT' : 'HUMAN'))
        });

        console.log(`👤 Player ${socket.id} joined seat ${seat} (${room.count}/4 humans)`);

        // Notify host status: seat 0 is always host
        let hostSid = getHostSid();
        if (hostSid) {
            io.to(hostSid).emit('hostStatus', { isHost: true });
        }
    });

    // Host clicks START - fill bots and begin
    socket.on('startMatch', () => {
        let seat = room.players[socket.id];
        let hostSid = getHostSid();
        if (socket.id !== hostSid) {
            socket.emit('err', '只有房主可以开始游戏');
            return;
        }
        if (room.count < 1) {
            socket.emit('err', '至少需要1名玩家');
            return;
        }
        if (room.game && room.game.active) {
            socket.emit('err', '游戏已在进行中');
            return;
        }
        console.log(`🎮 Host started match with ${room.count} humans`);
        fillBotsAndStart();
    });

    socket.on('action', (d) => handleAction(d));
    socket.on('botAction', (d) => handleAction(d));
    
    socket.on('ping_game', () => {
        if (room.game && room.game.active) {
            let currentTurn = room.game.turn;
            console.log(`📡 ping_game: current turn = seat ${currentTurn}, isBotSeat = ${isBotSeat(currentTurn)}`);
            if (isBotSeat(currentTurn)) {
                console.log(`🔧 Forcing bot play for stuck seat ${currentTurn}`);
                forceAutoPlay(currentTurn);
            }
        }
    });

    socket.on('requestNewGame', () => {
        console.log("🔄 requestNewGame received");
        if (room.count >= 1) {
            if (room.game) {
                room.game.active = false;
                room.game.finished = [];
            }
            if (room.botTimeout) { clearTimeout(room.botTimeout); room.botTimeout = null; }
            console.log("✅ Starting new game in 1.5 seconds...");
            // Re-fill bots for empty seats
            setTimeout(() => {
                for (let i = 0; i < 4; i++) {
                    if (room.seats[i] === null) room.seats[i] = 'BOT';
                }
                startGame();
            }, 1500);
        } else {
            socket.emit('err', '玩家不足，请刷新页面重新匹配');
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Disconnected: ${socket.id}`);
        let seat = room.players[socket.id];
        if (seat !== undefined) {
            room.seats[seat] = null;
            delete room.players[socket.id];
            room.count--;
            if (room.timer) { clearTimeout(room.timer); room.timer = null; }
            if (room.botTimeout) { clearTimeout(room.botTimeout); room.botTimeout = null; }
            
            // If game active, replace disconnected player with bot
            if (room.game && room.game.active) {
                room.seats[seat] = 'BOT';
                io.emit('playerLeft', { seat: seat, replaced: 'BOT' });
                console.log(`🤖 Seat ${seat} replaced with bot`);
            }
            
            if (room.count <= 0) resetRoom();
            else io.emit('roomUpdate', { 
                count: room.count,
                seats: room.seats.map(s => s === null ? 'EMPTY' : (s === 'BOT' ? 'BOT' : 'HUMAN'))
            });
        }
    });

});

function startGame() {
    console.log("🎮 Starting game...");

    let deck = createDeck();
    let hands = [[], [], [], []];
    for (let i = 0; i < 108; i++) hands[i % 4].push(deck[i]);

    room.game = {
        active: true,
        turn: Math.floor(Math.random() * 4),
        hands: hands,
        lastHand: null,
        passCnt: 0,
        finished: []   // Ordered list of seats as they finish
    };

    // Determine which seats are bots for the host to manage
    let botSeats = [];
    for (let i = 0; i < 4; i++) {
        if (isBotSeat(i)) botSeats.push(i);
    }

    let hostSid = getHostSid();

    console.log("🃏 Dealing cards...");
    Object.keys(room.players).forEach(sid => {
        let s = room.players[sid];
        io.to(sid).emit('dealCards', { cards: hands[s] });
        
        // Host gets bot cards to run bot AI client-side
        if (sid === hostSid) {
            let botCardData = {};
            botSeats.forEach(bs => { botCardData[bs] = hands[bs]; });
            io.to(sid).emit('botCards', botCardData);
        }
    });

    console.log(`📢 gameStart, turn: ${room.game.turn}, bots: [${botSeats}]`);
    io.emit('gameStart', { startTurn: room.game.turn, botSeats: botSeats });
}

function forceAutoPlay(seatToPlay) {
    if (!room.game || !room.game.active || room.game.turn !== seatToPlay) return;
    if (room.game.finished.includes(seatToPlay)) {
        console.log(`⚠️ forceAutoPlay: seat ${seatToPlay} is finished, skipping to next`);
        let next = (seatToPlay + 1) % 4;
        let s = 0;
        while (room.game.finished.includes(next) && s < 4) { next = (next + 1) % 4; s++; }
        if (!room.game.finished.includes(next)) {
            room.game.turn = next;
            room.game.lastHand = null;
            room.game.passCnt = 0;
            io.emit('syncAction', { seat: seatToPlay, type: 'pass', cards: [], nextTurn: next, isRoundEnd: true, finishOrder: room.game.finished });
            if (isBotSeat(next)) { room.botTimeout = setTimeout(() => forceAutoPlay(next), 3000); }
        }
        return;
    }
    console.log(`⚡ Force Auto-Play for seat ${seatToPlay}`);
    let g = room.game;
    let hand = g.hands[seatToPlay];
    if (!g.lastHand) {
        if (hand && hand.length > 0) {
            hand.sort((a, b) => a.p - b.p);
            let smallest = hand[0];
            handleAction({ seat: seatToPlay, type: 'play', cards: [smallest], handType: { type: '1', val: smallest.p } });
        } else {
            handleAction({ seat: seatToPlay, type: 'pass', cards: [] });
        }
    } else {
        handleAction({ seat: seatToPlay, type: 'pass', cards: [] });
    }
}

function handleAction(d) {
    if (!room.game || !room.game.active) return;
    if (d.seat !== room.game.turn) return;

    try {
    let g = room.game;
    let nextTurn = g.turn;
    let wasPlayAttempt = false;

    if (d.type === 'play') {
        wasPlayAttempt = true;
        if (!d.cards || !Array.isArray(d.cards) || d.cards.length === 0) {
            d.type = 'pass'; d.cards = [];
        } else {
            let validCards = d.cards.filter(c => c && c.s && c.v && c.p !== undefined);
            d.cards = validCards;
            let ht = d.handType || getHandType(d.cards);
            if (!ht || !canBeat(d.cards, ht, g.lastHand)) {
                console.log(`❌ Seat ${d.seat}: invalid play`);
                d.type = 'pass'; d.cards = [];
            } else {
                console.log(`✅ Seat ${d.seat} plays ${ht.type}`);
                d.handType = ht;
                g.lastHand = { owner: d.seat, type: ht.type, val: ht.val, count: d.cards.length, score: ht.score || 0 };
                g.passCnt = 0;
                let playedIds = d.cards.map(c => c.id);
                g.hands[d.seat] = g.hands[d.seat].filter(c => !playedIds.includes(c.id));
                if (g.hands[d.seat].length === 0 && !g.finished.includes(d.seat)) {
                    g.finished.push(d.seat);
                    console.log(`🏁 Seat ${d.seat} finished! Position: ${g.finished.length}`);
                }
            }
        }
    }

    if (d.type === 'pass') {
        if (!g.lastHand && !wasPlayAttempt) {
            console.log(`⚠️ Seat ${d.seat}: illegal pass, forcing play`);
            let hand = g.hands[d.seat];
            if (hand && hand.length > 0) {
                hand.sort((a, b) => a.p - b.p);
                let smallest = hand[0];
                d.type = 'play'; d.cards = [smallest];
                d.handType = { type: '1', val: smallest.p };
                g.lastHand = { owner: d.seat, type: '1', val: smallest.p, count: 1, score: 0 };
                g.passCnt = 0;
                g.hands[d.seat] = g.hands[d.seat].filter(c => c.id !== smallest.id);
                if (g.hands[d.seat].length === 0 && !g.finished.includes(d.seat)) g.finished.push(d.seat);
            } else { g.passCnt++; }
        } else { g.passCnt++; }
    }

    let active = 4 - g.finished.length;
    if (active <= 1) {
        // Add last remaining player
        for (let i = 0; i < 4; i++) {
            if (!g.finished.includes(i)) g.finished.push(i);
        }
        console.log("🏁 Game Over! Finish order:", g.finished);
        
        Object.keys(room.players).forEach(sid => {
            let seat = room.players[sid];
            let mp = g.finished.indexOf(seat) + 1;
            let pp = g.finished.indexOf((seat + 2) % 4) + 1;
            let pts = 0;
            if (mp === 1 && pp === 2) pts = 30;
            else if (mp === 1 || pp === 1) pts = (mp + pp === 4) ? 15 : 5;
            else pts = (mp + pp === 7) ? -15 : -5;
            playerScores[sid] = (playerScores[sid] || 1291) + pts;
        });

        io.emit('syncAction', {
            seat: d.seat, type: d.type, cards: d.cards || [],
            handType: d.handType, nextTurn: -1, isRoundEnd: false,
            finishOrder: g.finished
        });
        g.active = false;
        
        return;
    }

    // Next Turn — round ends when all OTHER active players have passed
    // passCnt counts consecutive passes. Round ends when passCnt >= active-1
    // BUT: if lastHand.owner is finished, we need passCnt >= active (everyone active passed)
    let roundOwner = g.lastHand ? g.lastHand.owner : g.turn;
    let ownerStillActive = !g.finished.includes(roundOwner);
    let passesNeeded = ownerStillActive ? (active - 1) : active;
    
    if (g.passCnt >= passesNeeded) {
        // Round ends — 接风 logic
        if (ownerStillActive) {
            nextTurn = roundOwner;
        } else {
            // Owner finished: give turn to partner, else next active
            let partner = (roundOwner + 2) % 4;
            if (!g.finished.includes(partner)) {
                nextTurn = partner;
            } else {
                let scan = 1;
                while (g.finished.includes((roundOwner + scan) % 4) && scan < 5) scan++;
                nextTurn = (roundOwner + scan) % 4;
            }
        }
        g.lastHand = null;
        g.passCnt = 0;
    } else {
        nextTurn = (g.turn + 1) % 4;
        let safety = 0;
        while (g.finished.includes(nextTurn) && safety < 10) {
            nextTurn = (nextTurn + 1) % 4;
            safety++;
        }
    }

    // SAFETY: never give turn to a finished player
    if (g.finished.includes(nextTurn)) {
        console.log(`🚨 WARNING: nextTurn ${nextTurn} is finished! Finding next active...`);
        let safety2 = 0;
        while (g.finished.includes(nextTurn) && safety2 < 8) {
            nextTurn = (nextTurn + 1) % 4;
            safety2++;
        }
        // If ALL finished (shouldn't happen since active>1 check above)
        if (g.finished.includes(nextTurn)) {
            console.log(`🚨 ALL PLAYERS FINISHED - ending game`);
            for (let i = 0; i < 4; i++) { if (!g.finished.includes(i)) g.finished.push(i); }
            io.emit('syncAction', { seat: d.seat, type: d.type, cards: d.cards || [], handType: d.handType, nextTurn: -1, isRoundEnd: false, finishOrder: g.finished });
            g.active = false;
            
            return;
        }
    }

    g.turn = nextTurn;
    

    io.emit('syncAction', {
        seat: d.seat, type: d.type, cards: d.cards || [],
        handType: d.handType, nextTurn: nextTurn, isRoundEnd: (g.lastHand === null),
        finishOrder: g.finished
    });

    // Timeout for next player
    if (room.botTimeout) { clearTimeout(room.botTimeout); room.botTimeout = null; }
    if (isBotSeat(nextTurn)) {
        room.botTimeout = setTimeout(() => { 
            if (room.game && room.game.active && room.game.turn === nextTurn) {
                console.log(`⏰ Bot timeout fired for seat ${nextTurn}`);
                forceAutoPlay(nextTurn); 
            }
        }, 2000);
    } else {
        room.botTimeout = setTimeout(() => { 
            if (room.game && room.game.active && room.game.turn === nextTurn) {
                console.log(`⏰ Human timeout fired for seat ${nextTurn}`);
                forceAutoPlay(nextTurn); 
            }
        }, 65000);
    }
    
    // Safety: stuck detector - only for bots
    if (isBotSeat(nextTurn)) {
        setTimeout(() => {
            if (room.game && room.game.active && room.game.turn === nextTurn) {
                console.log(`🚨 STUCK DETECTED! Forcing bot seat ${nextTurn}`);
                forceAutoPlay(nextTurn);
            }
        }, 8000);
    }

    } catch(err) {
        console.error('handleAction error:', err);
        if (room.game) 
    }
}

http.listen(PORT, () => console.log(`✅ Crayxus Server V36 running on port ${PORT}`));
