// server.js - Crayxus V41 (Fixed Rules & Room Logic)
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 10000,
    pingInterval: 5000
});

const path = require('path');
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

/* =========================================
   核心游戏逻辑 (必须与前端完全一致)
   ========================================= */
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

// 这里的逻辑必须与前端 V39 一致，否则服务器会拒绝合法牌型
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

    // 炸弹 (4张以上, 或4王)
    if (len >= 4) {
        let kings = c.filter(x => x.s === 'JOKER');
        if (kings.length === 4) return { type:'bomb', val:999, count:6, score:1000 };
        // 含有红桃2的炸弹
        if (len === 4 && (maxNormFreq + wild.length >= 4) && maxNormFreq >= 1) {
            let v = vals.length ? vals[vals.length - 1] : 15;
            return { type:'bomb', val:v, count:4, score:400 };
        }
        // 普通炸弹
        if (wild.length === 0 && maxNormFreq === len) {
            let v = vals.length ? vals[vals.length - 1] : 15;
            return { type:'bomb', val:v, count:len, score:len * 100 };
        }
    }
    // 单张
    if (len === 1) return { type:'1', val:c[0].p };
    // 对子
    if (len === 2 && (maxNormFreq + wild.length >= 2)) return { type:'2', val:vals.length ? vals[vals.length - 1] : 15 };
    // 三张
    if (len === 3 && (maxNormFreq + wild.length >= 3)) return { type:'3', val:vals.length ? vals[vals.length - 1] : 15 };

    // 顺子 / 同花顺 (5张)
    if (len === 5) {
        const HEART = '♥';
        const isWildCard = x => x.v==='2' && x.s===HEART;
        // 掼蛋顺子面值: 3..K=3..13, A=14, 2=15
        const faceRankG = x => {
            if(x.v==='A') return 14;
            if(x.v==='K') return 13;
            if(x.v==='Q') return 12;
            if(x.v==='J') return 11;
            const n = parseInt(x.v);
            if(!isNaN(n)) return n===2 ? 15 : n; 
            return x.p;
        };

        const strCards = c.filter(x => x.s!=='JOKER' && !isWildCard(x));
        const fWilds   = wild.length;
        const fValsSet = new Set(strCards.map(faceRankG));
        const fVals    = [...fValsSet].sort((a,b)=>a-b);

        // 可能的顺子窗口
        const windows = [];
        for(let lo=3; lo<=10; lo++) windows.push([lo,lo+1,lo+2,lo+3,lo+4]); // 3-7 ... 10-A
        windows.push([11,12,13,14,15]); // J-2
        windows.push([12,13,14,15,3]);  // Q-3 (wrap? usually strictly A-2-3-4-5)
        windows.push([13,14,15,3,4]);   // K-4
        windows.push([14,15,3,4,5]);    // A-5 (Top straight in typical rules, but handled as A=1 below usually)

        let isStraight=false, straightHighVal=0;
        
        // 检查普通顺子
        if(strCards.length + fWilds === 5 && fVals.length >= 1){
            for(const win of windows){
                const winSet = new Set(win);
                const outOfWin = fVals.filter(r=>!winSet.has(r)).length;
                const inWin = fVals.filter(r=>winSet.has(r)).length;
                const missing = win.length - inWin;
                if(outOfWin===0 && missing<=fWilds){
                    isStraight=true;
                    straightHighVal = Math.max(...win.filter(r=>r<=14)); 
                    if(win.includes(15)) straightHighVal=15; 
                    break;
                }
            }
            // A-2-3-4-5 特殊处理 (A=1)
            if(!isStraight){
                const aLowVals = fVals.map(r=> r===14?1 : r===15?2 : r).sort((a,b)=>a-b);
                const missing = [1,2,3,4,5].filter(r=>!new Set(aLowVals).has(r)).length;
                const outOfWin = aLowVals.filter(r=>r>5).length;
                if(outOfWin===0 && missing<=fWilds){ isStraight=true; straightHighVal=5; }
            }
        }

        if(isStraight){
            const nonWild = c.filter(x => !isWildCard(x) && x.s!=='JOKER');
            const suits   = [...new Set(nonWild.map(x=>x.s))];
            const isFlush = suits.length===1;
            if(isFlush) return {type:'straight_flush', val:straightHighVal, score:550};
            else return {type:'straight', val:straightHighVal};
        }

        // 三带二
        if (vals.length <= 2 && maxNormFreq >= 2) {
            let tripleVal = vals[vals.length - 1];
            for (let v of vals) { if (m[v] >= 3) { tripleVal = v; break; } }
            return { type:'3+2', val: tripleVal };
        }
    }
    // 钢板 (两个连续三张)
    if (len === 6 && vals.length === 2 && vals[1] === vals[0] + 1) {
        if (m[vals[0]] + wild.length >= 3) return { type:'plate', val:vals[0] };
    }
    // 木板 (三个连续对子)
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

/* =========================================
   房间管理逻辑
   ========================================= */
let rooms = {};
let playerMap = {};

function createRoom(id) {
    return { id: id, seats: [null, null, null, null], players: {}, count: 0, game: null, botTimeout: null };
}

function getRoom(roomId) {
    if (!rooms[roomId]) { rooms[roomId] = createRoom(roomId); console.log(`🏠 New Room: ${roomId}`); }
    return rooms[roomId];
}

function getHostSid(room) {
    for (let i = 0; i < 4; i++) { if (room.seats[i] && room.seats[i] !== 'BOT') return room.seats[i]; }
    return null;
}

io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        if (playerMap[socket.id]) return; // 已在房间忽略

        // 1. 确定房间号
        let roomId = "PUBLIC";
        if (data && data.roomCode) roomId = data.roomCode.trim().toUpperCase();
        else {
            // 随机分配逻辑
            for(let rid in rooms){ if(rid.startsWith("PUB") && rooms[rid].count<4 && (!rooms[rid].game||!rooms[rid].game.active)) { roomId=rid; break; } }
            if(rooms[roomId] && rooms[roomId].count>=4) roomId = "PUB"+Math.floor(Math.random()*1000);
        }

        let room = getRoom(roomId);
        if (room.game && room.game.active) { socket.emit('err', '游戏进行中'); return; }

        // 2. 分配座位
        let seat = -1;
        for (let i = 0; i < 4; i++) { if (room.seats[i] === null) { seat = i; break; } }
        
        if (seat === -1) {
            // 如果房间满但其实是幽灵数据（比如没人了），重置
            if(room.count === 0) { room.seats=[null,null,null,null]; seat=0; }
            else { socket.emit('err', '房间已满'); return; }
        }

        socket.join(roomId);
        room.seats[seat] = socket.id;
        room.players[socket.id] = seat;
        room.count++;
        playerMap[socket.id] = roomId;

        let hostSid = getHostSid(room);
        
        socket.emit('initIdentity', { seat, score: 1291, isHost: (socket.id===hostSid), roomCode: roomId });
        io.to(roomId).emit('roomUpdate', { count: room.count, seats: room.seats.map(s=>s===null?'EMPTY':(s==='BOT'?'BOT':'HUMAN')), roomId });
        
        if (hostSid) {
            Object.keys(room.players).forEach(sid => io.to(sid).emit('hostStatus', { isHost: (sid===hostSid) }));
        }
    });

    socket.on('startMatch', () => {
        let r = rooms[playerMap[socket.id]];
        if (!r) return;
        if (getHostSid(r) !== socket.id) return;
        // 填补 BOT 并开始
        for (let i = 0; i < 4; i++) if (r.seats[i] === null) r.seats[i] = 'BOT';
        
        let deck = createDeck();
        let hands = [[],[],[],[]];
        for(let i=0; i<108; i++) hands[i%4].push(deck[i]);
        
        r.game = { active: true, turn: Math.floor(Math.random()*4), hands: hands, lastHand: null, passCnt: 0, finished: [] };
        
        // 分发牌数据
        let botSeats = [], hostSid = getHostSid(r);
        for(let i=0; i<4; i++) if(r.seats[i]==='BOT') botSeats.push(i);
        
        Object.keys(r.players).forEach(sid => {
            let s = r.players[sid];
            io.to(sid).emit('dealCards', { cards: hands[s] });
            if(sid === hostSid) {
                let bots = {}; botSeats.forEach(bs => bots[bs] = hands[bs]);
                io.to(sid).emit('botCards', bots);
            }
        });
        
        io.to(r.id).emit('gameStart', { startTurn: r.game.turn, botSeats });
    });

    socket.on('action', d => handleAction(d, socket));
    socket.on('botAction', d => handleAction(d, socket));
    
    // 掉线处理
    socket.on('disconnect', () => {
        let rid = playerMap[socket.id];
        if (rid && rooms[rid]) {
            let r = rooms[rid], seat = r.players[socket.id];
            delete r.players[socket.id]; delete playerMap[socket.id]; r.count--;
            r.seats[seat] = (r.game && r.game.active) ? 'BOT' : null;
            
            if (r.count <= 0) delete rooms[rid];
            else {
                io.to(rid).emit('roomUpdate', { count: r.count, seats: r.seats.map(s=>!s?'EMPTY':(s==='BOT'?'BOT':'HUMAN')), roomId:rid });
                let h = getHostSid(r);
                if(h) Object.keys(r.players).forEach(s => io.to(s).emit('hostStatus', { isHost: (s===h) }));
            }
        }
    });
});

function handleAction(d, socket) {
    let rid = playerMap[socket.id];
    if (!rid || !rooms[rid] || !rooms[rid].game || !rooms[rid].game.active) return;
    let r = rooms[rid].game;
    if (d.seat !== r.turn) return;

    // 核心出牌逻辑
    let nextTurn = r.turn;
    if (d.type === 'play') {
        let ht = d.handType || getHandType(d.cards);
        // 服务器端二次验证：如果不合法，视为PASS
        if (!ht || !canBeat(d.cards, ht, r.lastHand)) {
            d.type = 'pass'; d.cards = [];
        } else {
            r.lastHand = { owner: d.seat, type: ht.type, val: ht.val, count: d.cards.length, score: ht.score||0 };
            r.passCnt = 0;
            // 扣除手牌
            let pIds = d.cards.map(c=>c.id);
            r.hands[d.seat] = r.hands[d.seat].filter(c => !pIds.includes(c.id));
            if(r.hands[d.seat].length === 0) r.finished.push(d.seat);
        }
    } else {
        // PASS
        if (!r.lastHand) { /* 首出不能过，强制出最小牌逻辑略，简化为过 */ r.passCnt++; }
        else r.passCnt++;
    }

    // 结算与流转
    let active = 4 - r.finished.length;
    if (active <= 1) { // 游戏结束
        io.to(rooms[rid].id).emit('syncAction', { ...d, nextTurn: -1, isRoundEnd: false, finishOrder: r.finished });
        rooms[rid].game.active = false;
        return;
    }

    // 轮转逻辑
    let roundOwner = r.lastHand ? r.lastHand.owner : r.turn;
    let ownerActive = !r.finished.includes(roundOwner);
    let passesNeeded = ownerActive ? (active - 1) : active;

    if (r.passCnt >= passesNeeded) {
        // 一轮结束
        nextTurn = ownerActive ? roundOwner : (roundOwner+2)%4; // 接风逻辑简化
        while(r.finished.includes(nextTurn)) nextTurn = (nextTurn+1)%4;
        r.lastHand = null; r.passCnt = 0;
    } else {
        nextTurn = (r.turn + 1) % 4;
        while (r.finished.includes(nextTurn)) nextTurn = (nextTurn + 1) % 4;
    }
    
    r.turn = nextTurn;
    io.to(rooms[rid].id).emit('syncAction', { ...d, nextTurn, isRoundEnd: (r.lastHand === null), finishOrder: r.finished });
}

http.listen(PORT, () => console.log(`✅ Crayxus V41 Running on port ${PORT}`));
