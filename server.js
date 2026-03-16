// server.js - Crayxus V43 (Upgrade Fix)
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000
});

const path = require('path');
const fs = require('fs');
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
const SERVER_VERSION = 'V43';
app.get('/api/version', (req, res) => res.json({ version: SERVER_VERSION }));

// Game event logging
const LOG_FILE = path.join(__dirname, 'game_log.txt');
function gameLog(msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}\n`;
    console.log(msg);
    fs.appendFile(LOG_FILE, line, () => {});
}

// Game replay saving — captures full move history for AI analysis
const REPLAY_DIR = path.join(__dirname, 'replays');
if (!fs.existsSync(REPLAY_DIR)) fs.mkdirSync(REPLAY_DIR);

function saveReplay(room) {
    try {
        const g = room.game;
        if (!g || !g.moveHistory || g.moveHistory.length === 0) return;
        // Identify human vs bot
        const humanSeats = [], botSeats = [];
        for (let i = 0; i < 4; i++) {
            if (room.seats[i] === 'BOT') botSeats.push(i);
            else humanSeats.push(i);
        }
        const replay = {
            timestamp: new Date().toISOString(),
            roomId: room.id,
            gameCount: room.gameCount,
            mode: room.mode,
            casualMode: room.casualMode,
            wildValue: g.wildValue || room.currentWildValue || '2',
            humanSeats: humanSeats,
            botSeats: botSeats,
            playerInfo: Object.values(room.playerInfo || {}).map(p => ({seat: p.seat, nickname: p.nickname})),
            initialHands: g.initialHands || [],
            finishOrder: g.finished || [],
            moves: g.moveHistory,
            totalMoves: g.moveHistory.length
        };
        const fname = `replay_${Date.now()}.json`;
        fs.writeFile(path.join(REPLAY_DIR, fname), JSON.stringify(replay, null, 2), () => {});
        gameLog(`[Replay] Saved ${fname} (${g.moveHistory.length} moves, human=${humanSeats}, bots=${botSeats})`);
    } catch(e) {
        gameLog(`[Replay] Error saving: ${e.message}`);
    }
}

// API to list replays
app.get('/api/replays', (req, res) => {
    try {
        const files = fs.readdirSync(REPLAY_DIR).filter(f => f.endsWith('.json')).sort().reverse();
        const replays = files.slice(0, 50).map(f => {
            const data = JSON.parse(fs.readFileSync(path.join(REPLAY_DIR, f)));
            return {
                file: f,
                timestamp: data.timestamp,
                finishOrder: data.finishOrder,
                humanSeats: data.humanSeats,
                totalMoves: data.totalMoves,
                wildValue: data.wildValue
            };
        });
        res.json(replays);
    } catch(e) { res.json([]); }
});

app.get('/api/rooms', (req, res) => {
    let list = [];
    for (let rid in rooms) {
        let r = rooms[rid];
        let humanCount = 0;
        for (let i = 0; i < 4; i++) if (r.seats[i] && r.seats[i] !== 'BOT') humanCount++;
        if (humanCount > 0) {
            list.push({
                code: rid,
                players: r.count,
                humans: humanCount,
                mode: r.mode || 'arena',
                casualMode: r.casualMode || 'fixed',
                active: !!(r.game && r.game.active)
            });
        }
    }
    res.json(list);
});

app.get('/api/replays/:file', (req, res) => {
    try {
        const fpath = path.join(REPLAY_DIR, req.params.file);
        if (!fs.existsSync(fpath)) return res.status(404).json({error: 'not found'});
        res.json(JSON.parse(fs.readFileSync(fpath)));
    } catch(e) { res.status(500).json({error: e.message}); }
});

/* =========================================
   核心游戏逻辑 (必须与前端完全一致)
   ========================================= */
const BASE_POWER = {'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15,'Sm':16,'Bg':17};
const SEQ_VAL = {'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13};
// Straight sequence rank: 2 sits between A-low and 3; A can be high(14) or low(1)
const STR_RANK = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
const SUITS = ['♠','♥','♣','♦'];
const POINTS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const LEVEL_ORDER = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

let playerScores = {};

// Get power for a card value given current wild value
function getPower(v, wildValue) {
    if (v === 'Sm') return 16;
    if (v === 'Bg') return 17;
    if (wildValue && wildValue !== '2') {
        if (v === wildValue) return 15; // Level card is highest non-joker
        if (v === '2') return 2;        // Regular 2 drops to lowest
    }
    return BASE_POWER[v] || 0;
}

function createDeck(wildValue) {
    let wv = wildValue || '2';
    let deck = [];
    for (let i = 0; i < 2; i++) {
        SUITS.forEach(s => POINTS.forEach(v => deck.push({
            s, v, p: getPower(v, wv), seq: SEQ_VAL[v] || 0, id: Math.random().toString(36).substr(2)
        })));
        deck.push({ s:'JOKER', v:'Sm', p:16, seq:19, id:Math.random().toString(36).substr(2) });
        deck.push({ s:'JOKER', v:'Bg', p:17, seq:20, id:Math.random().toString(36).substr(2) });
    }
    for (let i = deck.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// 这里的逻辑必须与前端一致，否则服务器会拒绝合法牌型
// wildValue: the current level card value (e.g. '5' when playing level 5)
function getHandType(c, wildValue) {
    if (!c || !c.length) return null;
    let wv = wildValue || '2';
    let wild = c.filter(x => x.v === wv && x.s === '♥');
    let jokers = c.filter(x => x.s === 'JOKER');
    let norm = c.filter(x => !(x.v === wv && x.s === '♥'));
    // Wild cards cannot combine with Jokers
    if (wild.length > 0 && jokers.length > 0) return null;
    norm.sort((a, b) => a.p - b.p);
    let len = c.length;
    // Power-based grouping (for singles, pairs, trips, bombs - strength comparison)
    let m = {};
    norm.forEach(x => m[x.p] = (m[x.p] || 0) + 1);
    let vals = Object.keys(m).map(Number).sort((a, b) => a - b);
    let maxNormFreq = vals.length ? Math.max(...Object.values(m)) : 0;
    // Sequence-based grouping (for plates, tubes): uses STR_RANK where 2=2,3=3,...,A=14
    let mSeq = {};
    norm.forEach(x => { let f = STR_RANK[x.v] || x.p; mSeq[f] = (mSeq[f] || 0) + 1; });
    let seqVals = Object.keys(mSeq).map(Number).sort((a, b) => a - b);

    // 炸弹 (4张以上, 或4王)
    if (len >= 4) {
        let kings = c.filter(x => x.s === 'JOKER');
        if (kings.length === 4) return { type:'bomb', val:999, count:6, score:1000 };
        // 含百搭的炸弹
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
        const isWildCard = x => x.v === wv && x.s === '♥';
        // Use STR_RANK for sequence detection: 2=2,3=3,...,K=13,A=14
        const seqRankG = x => STR_RANK[x.v] || 0;

        const strCards = c.filter(x => x.s!=='JOKER' && !isWildCard(x));
        const fWilds   = wild.length;
        const sValsSet = new Set(strCards.map(seqRankG));
        const sVals    = [...sValsSet].sort((a,b)=>a-b);

        // 顺子窗口: 2-3-4-5-6 through 10-J-Q-K-A
        const windows = [];
        for(let lo=2; lo<=10; lo++) windows.push([lo,lo+1,lo+2,lo+3,lo+4]);

        let isStraight=false, straightHighVal=0;

        if(strCards.length + fWilds === 5 && sVals.length >= 1){
            for(const win of windows){
                const winSet = new Set(win);
                const outOfWin = sVals.filter(r=>!winSet.has(r)).length;
                const inWin = sVals.filter(r=>winSet.has(r)).length;
                const missing = win.length - inWin;
                if(outOfWin===0 && missing<=fWilds){
                    isStraight=true;
                    straightHighVal = Math.max(...win);
                    break;
                }
            }
            // A-2-3-4-5 特殊处理 (A wraps to 1)
            if(!isStraight){
                const aLowVals = sVals.map(r=> r===14?1 : r).sort((a,b)=>a-b);
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
    // 钢板 (两个连续三张) - use STR_RANK for sequence check
    if (len === 6 && seqVals.length === 2 && seqVals[1] === seqVals[0] + 1) {
        if (mSeq[seqVals[0]] + wild.length >= 3) return { type:'plate', val:seqVals[0] };
    }
    // 木板 (三个连续对子) - use STR_RANK for sequence check
    if (len === 6 && seqVals.length === 3) {
        if (seqVals[1] === seqVals[0] + 1 && seqVals[2] === seqVals[1] + 1) {
            let hasEnough = (mSeq[seqVals[0]] >= 1 || wild.length > 0) && (mSeq[seqVals[1]] >= 1 || wild.length > 0) && (mSeq[seqVals[2]] >= 1 || wild.length > 0);
            if (hasEnough) return { type:'tube', val:seqVals[0] };
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

function createRoom(id, mode, casualMode) {
    return {
        id: id, mode: mode||'arena', casualMode: casualMode||'fixed',
        seats: [null, null, null, null], players: {}, playerInfo: {}, count: 0,
        game: null, botTimeout: null, gameCount: 0, lastFinished: [],
        // Upgrade mode state
        teamLevels: [0, 0],  // [team0 idx, team1 idx] into LEVEL_ORDER
        currentWildValue: '2',
        lastWinTeam: 0,
        upgradeRound: 0
    };
}

function getRoom(roomId, mode, casualMode) {
    if (!rooms[roomId]) { rooms[roomId] = createRoom(roomId, mode, casualMode); gameLog(`[Room] New room created: ${roomId} (${mode||'arena'}, ${casualMode||'fixed'})`); }
    return rooms[roomId];
}

function getHostSid(room) {
    for (let i = 0; i < 4; i++) { if (room.seats[i] && room.seats[i] !== 'BOT') return room.seats[i]; }
    return null;
}

function destroyRoom(rid) {
    let room = rooms[rid];
    if (!room) return;
    if (room.botTimeout) clearTimeout(room.botTimeout);
    if (room.game) room.game.active = false;
    // Notify remaining players
    io.to(rid).emit('roomDestroyed', { reason: 'Player disconnected' });
    // Clean up all player mappings
    Object.keys(room.players).forEach(sid => { delete playerMap[sid]; });
    delete rooms[rid];
    gameLog(`[Room] Destroyed room ${rid}`);
}

// ========== WeChat QR Login HTTP API (for mini program) ==========
app.post('/api/wx-login', (req, res) => {
    const { sessionId, avatarUrl, nickname } = req.body || {};
    if (!sessionId) {
        return res.json({ success: false, msg: 'Missing sessionId' });
    }

    const session = wxLoginSessions[sessionId];
    if (!session) {
        return res.json({ success: false, msg: 'Session expired or not found' });
    }

    // Relay to the browser via Socket.IO
    io.to(session.browserSocketId).emit('wx-login-success', {
        avatarUrl: avatarUrl || '',
        nickname: nickname || ''
    });

    gameLog(`[WxLogin] HTTP scan success: session=${sessionId}, nickname=${nickname}`);

    // Return player stats if browser sent them
    const stats = session.stats || null;
    delete wxLoginSessions[sessionId];
    res.json({ success: true, stats });
});

// Redirect for /wxlogin QR scan (in case someone opens QR URL in browser)
app.get('/wxlogin', (req, res) => {
    res.send(`
        <html><body style="background:#000;color:#fff;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;text-align:center">
        <div>
            <h1 style="color:#00ffcc">Crayxus</h1>
            <p style="color:#888">Please scan this QR code using<br>the Crayxus WeChat Mini Program</p>
            <p style="color:#555;font-size:12px">Session: ${req.query.session || 'N/A'}</p>
        </div>
        </body></html>
    `);
});

// ========== WeChat QR Login Relay ==========
// Pending login sessions: { sessionId: { browserSocketId, timestamp } }
let wxLoginSessions = {};

// Cleanup stale sessions every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const sid in wxLoginSessions) {
        if (now - wxLoginSessions[sid].timestamp > 5 * 60 * 1000) {
            delete wxLoginSessions[sid];
        }
    }
}, 60000);

io.on('connection', (socket) => {

    // Browser registers a QR login session (with optional stats)
    socket.on('wx-login-register', (data) => {
        if (!data || !data.sessionId) return;
        wxLoginSessions[data.sessionId] = {
            browserSocketId: socket.id,
            timestamp: Date.now(),
            stats: data.stats || null
        };
        gameLog(`[WxLogin] Session registered: ${data.sessionId} by ${socket.id}`);
    });

    // Mini program sends scanned result with avatar & nickname
    socket.on('wx-login-scan', (data) => {
        if (!data || !data.sessionId) return;
        const session = wxLoginSessions[data.sessionId];
        if (!session) {
            socket.emit('wx-login-error', { msg: 'Session expired' });
            return;
        }
        // Relay avatar & nickname to the browser
        io.to(session.browserSocketId).emit('wx-login-success', {
            avatarUrl: data.avatarUrl || '',
            nickname: data.nickname || ''
        });
        gameLog(`[WxLogin] Scan success: session=${data.sessionId}, nickname=${data.nickname}`);
        // Confirm to mini program
        socket.emit('wx-login-confirmed', { success: true });
        // Clean up session
        delete wxLoginSessions[data.sessionId];
    });

    socket.on('joinGame', (data) => {
        gameLog(`[joinGame] sid=${socket.id} mode=${data&&data.mode} casual=${data&&data.casualMode} room=${data&&data.roomCode} alreadyIn=${!!playerMap[socket.id]}`);
        if (playerMap[socket.id]) return; // 已在房间忽略

        // 1. 确定房间号 — 休闲和竞技用不同前缀，升级和定蛋分开
        const mode = (data && data.mode) || 'arena';
        const casualMode = (data && data.casualMode) || 'fixed';
        const prefix = mode === 'casual' ? (casualMode === 'upgrade' ? 'UPG' : 'CAS') : 'PUB';
        let roomId = prefix + "LIC";
        if (data && data.roomCode) roomId = data.roomCode.trim().toUpperCase();
        else {
            // 随机分配逻辑
            for(let rid in rooms){ if(rid.startsWith(prefix) && rooms[rid].count<4 && (!rooms[rid].game||!rooms[rid].game.active)) { roomId=rid; break; } }
            if(rooms[roomId] && rooms[roomId].count>=4) roomId = prefix+Math.floor(Math.random()*1000);
        }

        let room = getRoom(roomId, mode, casualMode);
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
        room.playerInfo[socket.id] = { seat, avatarUrl: (data && data.avatarUrl) || '', nickname: (data && data.nickname) || '' };
        room.count++;
        playerMap[socket.id] = roomId;

        let hostSid = getHostSid(room);

        // Build player info map (seat -> {avatarUrl, nickname})
        let playersInfo = {};
        for (let sid in room.playerInfo) {
            let info = room.playerInfo[sid];
            playersInfo[info.seat] = { avatarUrl: info.avatarUrl, nickname: info.nickname };
        }

        gameLog(`[joinGame] OK: sid=${socket.id} seat=${seat} room=${roomId} host=${socket.id===hostSid}`);
        socket.emit('initIdentity', { seat, score: 1291, isHost: (socket.id===hostSid), roomCode: roomId, playersInfo });
        io.to(roomId).emit('roomUpdate', { count: room.count, seats: room.seats.map(s=>s===null?'EMPTY':(s==='BOT'?'BOT':'HUMAN')), roomId, playersInfo });
        
        if (hostSid) {
            Object.keys(room.players).forEach(sid => io.to(sid).emit('hostStatus', { isHost: (sid===hostSid) }));
        }
    });

    /* Spectator mode: join room without taking a seat */
    socket.on('spectateGame', (data) => {
        let roomId = (data && data.roomCode) ? data.roomCode.trim().toUpperCase() : null;
        if (!roomId) { socket.emit('err', '需要房间码'); return; }
        if (!rooms[roomId]) { socket.emit('err', '房间不存在'); return; }
        let room = rooms[roomId];
        socket.join(roomId);
        let spectateSeat = 0;
        for (let i = 0; i < 4; i++) {
            if (room.seats[i] && room.seats[i] !== 'BOT') { spectateSeat = i; break; }
        }
        socket.emit('spectateInit', { seat: spectateSeat, roomCode: roomId });
        if (room.game && room.game.active) {
            let g = room.game;
            let botSeats = []; for(let i=0;i<4;i++) if(room.seats[i]==='BOT') botSeats.push(i);
            // Send gameStart FIRST so client sets up game UI
            socket.emit('gameStart', { startTurn: g.turn, botSeats, highCards: [] });
            // Then send cards after a small delay so UI is ready
            setTimeout(() => {
                socket.emit('dealCards', { cards: g.hands[spectateSeat] });
            }, 100);
        }
        gameLog(`[Spectator] ${socket.id} spectating room ${roomId} from seat ${spectateSeat}`);
    });

    socket.on('startMatch', () => {
        let r = rooms[playerMap[socket.id]];
        if (!r) return;
        if (getHostSid(r) !== socket.id) return;
        // Don't start if a game is already active
        if (r.game && r.game.active) return;
        // 填补 BOT 并开始
        for (let i = 0; i < 4; i++) if (r.seats[i] === null) r.seats[i] = 'BOT';

        // Upgrade mode: set wild value based on winning team's level
        if (r.casualMode === 'upgrade') {
            r.currentWildValue = LEVEL_ORDER[r.teamLevels[r.lastWinTeam]];
            gameLog(`[StartMatch] Room ${r.id}: UPGRADE casualMode=${r.casualMode}, teamLevels=[${r.teamLevels}], lastWinTeam=${r.lastWinTeam}, wild=${r.currentWildValue}, gameCount=${r.gameCount}`);
        } else {
            r.currentWildValue = '2';
            gameLog(`[StartMatch] Room ${r.id}: NON-UPGRADE casualMode=${r.casualMode}, wild=2`);
        }

        let deck = createDeck(r.currentWildValue);
        let hands = [[],[],[],[]];
        for(let i=0; i<108; i++) hands[i%4].push(deck[i]);

        r.gameCount++;
        let botSeats = [], hostSid = getHostSid(r);
        for(let i=0; i<4; i++) if(r.seats[i]==='BOT') botSeats.push(i);

        // Check if tribute is needed (upgrade mode, gameCount > 1, previous finish order exists)
        let doTribute = r.casualMode === 'upgrade' && r.gameCount > 1 && r.lastFinished && r.lastFinished.length >= 4;
        let startTurn = 0;

        if (doTribute) {
            startTurn = r.lastFinished[0];
        } else {
            let highCards = [];
            for(let i=0; i<4; i++){
                let idx = Math.floor(Math.random() * hands[i].length);
                highCards.push(hands[i][idx]);
            }
            let maxP = -1;
            for(let i=0; i<4; i++){
                if(highCards[i].p > maxP || (highCards[i].p === maxP && Math.random()>0.5)){ maxP = highCards[i].p; startTurn = i; }
            }
            r._highCards = highCards;
        }

        r.game = { active: true, turn: startTurn, hands: hands, lastHand: null, passCnt: 0, finished: [], wildValue: r.currentWildValue,
            moveHistory: [], initialHands: hands.map(h => h.map(c => ({id:c.id, suit:c.suit, val:c.val, p:c.p}))) };

        // 分发牌数据
        Object.keys(r.players).forEach(sid => {
            let s = r.players[sid];
            io.to(sid).emit('dealCards', { cards: hands[s] });
            if(sid === hostSid) {
                let bots = {}; botSeats.forEach(bs => bots[bs] = hands[bs]);
                io.to(sid).emit('botCards', bots);
            }
        });

        // Build upgrade state for clients
        let upgradeState = null;
        if (r.casualMode === 'upgrade') {
            upgradeState = {
                teamLevels: r.teamLevels.slice(),
                currentWildValue: r.currentWildValue,
                upgradeRound: r.upgradeRound
            };
        }

        if (doTribute) {
            io.to(r.id).emit('gameStart', { startTurn, botSeats, tribute: true, upgradeState });
            gameLog(`[Game] Room ${r.id}: Game #${r.gameCount} started with TRIBUTE, wild=${r.currentWildValue}, levels=[${r.teamLevels}]`);
            executeServerTribute(r.id, r.lastFinished, botSeats);
        } else {
            io.to(r.id).emit('gameStart', { startTurn: r.game.turn, botSeats, highCards: r._highCards, upgradeState });
            gameLog(`[Game] Room ${r.id}: Game #${r.gameCount} started, turn=${startTurn}, bots=[${botSeats}]`);
            // If first turn is a bot, schedule auto-pass
            scheduleBotTimeout(r.id);
        }
    });

    // Human player returns a card during tribute 还贡 phase
    socket.on('tributeReturn', (data) => {
        let rid = playerMap[socket.id];
        if (!rid || !rooms[rid]) return;
        let room = rooms[rid];
        if (room._tributeReturnResolve && data && data.card) {
            let resolve = room._tributeReturnResolve;
            delete room._tributeReturnResolve;
            resolve(data.card);
        }
    });

    socket.on('action', d => handleAction(d, socket));
    socket.on('botAction', d => {
        // Only host can control bots
        let rid = playerMap[socket.id];
        if (!rid || !rooms[rid]) return;
        if (getHostSid(rooms[rid]) !== socket.id) {
            gameLog(`[BotAction] Room ${rid}: non-host ${socket.id} tried to send botAction, ignoring`);
            return;
        }
        handleAction(d, socket);
    });

    // 主动离开: 浏览器关闭/刷新时客户端发送
    socket.on('leaveGame', () => {
        let rid = playerMap[socket.id];
        if (rid && rooms[rid]) {
            let r = rooms[rid], seat = r.players[socket.id];
            gameLog(`[Leave] Room ${rid}: seat ${seat} left, destroying room`);
            destroyRoom(rid);
        }
    });

    // 掉线处理: 销毁房间
    socket.on('disconnect', () => {
        let rid = playerMap[socket.id];
        if (rid && rooms[rid]) {
            let r = rooms[rid], seat = r.players[socket.id];
            gameLog(`[Disconnect] Room ${rid}: seat ${seat} disconnected, destroying room`);
            destroyRoom(rid);
        }
    });
});

// Clean up empty rooms after game ends
function cleanupEmptyRoom(rid) {
    let room = rooms[rid];
    if (room && room.count <= 0) {
        gameLog(`[Cleanup] Room ${rid}: no human players, removing room`);
        if (room.botTimeout) clearTimeout(room.botTimeout);
        delete rooms[rid];
    }
}

function scheduleBotTimeout(rid) {
    let room = rooms[rid];
    if (!room || !room.game || !room.game.active) return;
    // Clear any existing bot timeout
    if (room.botTimeout) { clearTimeout(room.botTimeout); room.botTimeout = null; }
    let r = room.game;
    let currentTurn = r.turn;
    // Only schedule if current turn is a BOT seat
    if (room.seats[currentTurn] !== 'BOT') return;
    // Auto-pass the bot after 8 seconds if no action received
    room.botTimeout = setTimeout(() => {
        room.botTimeout = null;
        if (!room.game || !room.game.active) return;
        if (room.game.turn !== currentTurn) return; // Turn already advanced
        let g = room.game;
        gameLog(`[BotTimeout] Room ${rid}: Auto-acting bot seat ${currentTurn}, lastHand=${g.lastHand?g.lastHand.type:'none'}, hand=${g.hands[currentTurn]?g.hands[currentTurn].length:0} cards`);
        let d;
        // If bot must lead (no lastHand), play weakest card instead of passing
        if (!g.lastHand && g.hands[currentTurn] && g.hands[currentTurn].length > 0) {
            let weakest = g.hands[currentTurn].reduce((a, b) => a.p <= b.p ? a : b);
            d = { seat: currentTurn, type: 'play', cards: [weakest], handType: { type: '1', val: weakest.p } };
            g.lastHand = { owner: currentTurn, type: '1', val: weakest.p, count: 1, score: 0 };
            g.passCnt = 0;
            g.hands[currentTurn] = g.hands[currentTurn].filter(c => c.id !== weakest.id);
            if (g.hands[currentTurn].length === 0) g.finished.push(currentTurn);
        } else {
            // Pass
            d = { seat: currentTurn, type: 'pass', cards: [] };
            g.passCnt++;
        }
        // Record bot timeout move for replay
        if (g.moveHistory) {
            g.moveHistory.push({ step: g.moveHistory.length, seat: d.seat, type: d.type,
                cards: d.cards ? d.cards.map(c => ({id:c.id, suit:c.suit, val:c.val})) : [],
                handType: d.handType || null, handSize: g.hands[currentTurn] ? g.hands[currentTurn].length : 0 });
        }
        let active = 4 - g.finished.length;
        if (active <= 1) {
            // Add remaining players to finish order before computing upgrade result
            for (let s = 0; s < 4; s++) { if (!g.finished.includes(s)) g.finished.push(s); }
            room.lastFinished = g.finished.slice();
            let upgradeResult = computeUpgradeResult(room);
            gameLog(`[GameEnd] Room ${rid}: BotTimeout game over (active<=1), finishOrder=[${g.finished}]`);
            saveReplay(room);
            io.to(room.id).emit('syncAction', { ...d, nextTurn: -1, isRoundEnd: false, finishOrder: g.finished, upgradeResult });
            g.active = false;
            cleanupEmptyRoom(rid);
            return;
        }
        // Check team completion
        if (g.finished.length >= 2) {
            let team0 = [0, 2], team1 = [1, 3];
            let t0done = team0.every(s => g.finished.includes(s));
            let t1done = team1.every(s => g.finished.includes(s));
            if (t0done || t1done) {
                let remaining = [];
                for (let s = 0; s < 4; s++) { if (!g.finished.includes(s)) remaining.push(s); }
                remaining.sort((a, b) => g.hands[a].length - g.hands[b].length);
                remaining.forEach(s => g.finished.push(s));
                room.lastFinished = g.finished.slice();
                let upgradeResult = computeUpgradeResult(room);
                gameLog(`[GameEnd] Room ${rid}: BotTimeout team completion, finishOrder=[${g.finished}]`);
                saveReplay(room);
                io.to(room.id).emit('syncAction', { ...d, nextTurn: -1, isRoundEnd: false, finishOrder: g.finished, upgradeResult });
                g.active = false;
                cleanupEmptyRoom(rid);
                return;
            }
        }
        // Turn advancement
        let roundOwner = g.lastHand ? g.lastHand.owner : g.turn;
        let ownerActive = !g.finished.includes(roundOwner);
        let passesNeeded = ownerActive ? (active - 1) : active;
        let nextTurn;
        if (g.passCnt >= passesNeeded) {
            nextTurn = ownerActive ? roundOwner : (roundOwner + 2) % 4;
            while (g.finished.includes(nextTurn)) nextTurn = (nextTurn + 1) % 4;
            g.lastHand = null; g.passCnt = 0;
        } else {
            nextTurn = (g.turn + 1) % 4;
            while (g.finished.includes(nextTurn)) nextTurn = (nextTurn + 1) % 4;
        }
        g.turn = nextTurn;
        io.to(room.id).emit('syncAction', { ...d, nextTurn, isRoundEnd: (g.lastHand === null), finishOrder: g.finished });
        // Recursively schedule for next bot
        scheduleBotTimeout(rid);
    }, 8000);
}

function handleAction(d, socket) {
    let rid = playerMap[socket.id];
    if (!rid || !rooms[rid] || !rooms[rid].game || !rooms[rid].game.active) return;
    let r = rooms[rid].game;
    // Clear bot timeout since a real action is coming in
    if (rooms[rid].botTimeout) { clearTimeout(rooms[rid].botTimeout); rooms[rid].botTimeout = null; }
    if (d.seat !== r.turn) {
        // Send turn correction so client can resync
        gameLog(`[TurnMismatch] Room ${rid}: seat ${d.seat} tried to act but turn is ${r.turn}`);
        socket.emit('turnCorrection', { serverTurn: r.turn, yourSeat: d.seat, finishOrder: r.finished, lastHand: r.lastHand });
        return;
    }

    // Record move for replay
    if (r.moveHistory) {
        r.moveHistory.push({
            step: r.moveHistory.length,
            seat: d.seat,
            type: d.type,
            cards: d.cards ? d.cards.map(c => ({id:c.id, suit:c.suit, val:c.val})) : [],
            handType: d.handType || null,
            handSize: r.hands[d.seat] ? r.hands[d.seat].length : 0
        });
    }

    // 核心出牌逻辑
    let wv = r.wildValue || rooms[rid].currentWildValue || '2';
    let nextTurn = r.turn;
    if (d.type === 'play') {
        let ht = d.handType || getHandType(d.cards, wv);
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
    if (active <= 1) { // 游戏结束 (3+ players finished)
        // Add remaining players to finish order before computing upgrade result
        for (let s = 0; s < 4; s++) { if (!r.finished.includes(s)) r.finished.push(s); }
        rooms[rid].lastFinished = r.finished.slice();
        let upgradeResult = computeUpgradeResult(rooms[rid]);
        gameLog(`[GameEnd] Room ${rid}: Game over (active<=1), finishOrder=[${r.finished}], casualMode=${rooms[rid].casualMode}, teamLevels=[${rooms[rid].teamLevels}], lastWinTeam=${rooms[rid].lastWinTeam}, upgradeResult=${JSON.stringify(upgradeResult)}`);
        saveReplay(rooms[rid]);
        io.to(rooms[rid].id).emit('syncAction', { ...d, nextTurn: -1, isRoundEnd: false, finishOrder: r.finished, upgradeResult });
        rooms[rid].game.active = false;
        cleanupEmptyRoom(rid);
        return;
    }

    // Check team completion: both teammates finished → game over
    if (r.finished.length >= 2) {
        let team0 = [0, 2], team1 = [1, 3];
        let t0done = team0.every(s => r.finished.includes(s));
        let t1done = team1.every(s => r.finished.includes(s));
        if (t0done || t1done) {
            let remaining = [];
            for (let s = 0; s < 4; s++) { if (!r.finished.includes(s)) remaining.push(s); }
            remaining.sort((a, b) => r.hands[a].length - r.hands[b].length);
            remaining.forEach(s => r.finished.push(s));
            rooms[rid].lastFinished = r.finished.slice();
            let upgradeResult = computeUpgradeResult(rooms[rid]);
            gameLog(`[GameEnd] Room ${rid}: Team completion, finishOrder=[${r.finished}], casualMode=${rooms[rid].casualMode}, teamLevels=[${rooms[rid].teamLevels}], lastWinTeam=${rooms[rid].lastWinTeam}, upgradeResult=${JSON.stringify(upgradeResult)}`);
            saveReplay(rooms[rid]);
            io.to(rooms[rid].id).emit('syncAction', { ...d, nextTurn: -1, isRoundEnd: false, finishOrder: r.finished, upgradeResult });
            rooms[rid].game.active = false;
            cleanupEmptyRoom(rid);
            return;
        }
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
    gameLog(`[Action] Room ${rid}: seat ${d.seat} ${d.type}${d.type==='play'?' '+((d.handType||{}).type||'?'):''}→next=${nextTurn} pass=${r.passCnt} finished=[${r.finished}]`);
    io.to(rooms[rid].id).emit('syncAction', { ...d, nextTurn, isRoundEnd: (r.lastHand === null), finishOrder: r.finished });
    // Schedule server-side bot auto-pass if it's a bot's turn
    scheduleBotTimeout(rid);
}

/* =========================================
   Upgrade Mode: Level Advancement
   ========================================= */
function computeUpgradeResult(room) {
    gameLog(`[computeUpgrade] casualMode=${room.casualMode}, lastFinished=${JSON.stringify(room.lastFinished)}, teamLevels=[${room.teamLevels}]`);
    if (room.casualMode !== 'upgrade') return null;
    let fo = room.lastFinished;
    if (!fo || fo.length < 4) return null;

    let headSeat = fo[0];
    let headMate = (headSeat + 2) % 4;
    let matePos = fo.indexOf(headMate);

    // Determine winning team and points
    let winTeam = [headSeat, headMate];
    let teamPts = 0;
    if (matePos === 1) teamPts = 4;      // 双上
    else if (matePos === 2) teamPts = 2;  // 头游+三游
    else teamPts = 1;                     // 头游+末游

    // Determine which team index won (team0=[0,2], team1=[1,3])
    let winTeamIdx = (headSeat % 2 === 0) ? 0 : 1;
    room.lastWinTeam = winTeamIdx;

    // Compute advancement
    let advance = 0;
    if (teamPts === 4) advance = 3;
    else if (teamPts === 2) advance = 2;
    else advance = 1;

    let curLvl = room.teamLevels[winTeamIdx];
    let newLvl = curLvl + advance;
    let idxA = LEVEL_ORDER.length - 1; // A = index 12

    // Before reaching A: can't skip over A
    if (curLvl < idxA && newLvl > idxA) newLvl = idxA;
    // At A: must get 双上 to pass
    if (curLvl >= idxA) {
        if (teamPts === 4) newLvl = idxA + 1; // 双上过A
        else newLvl = idxA; // Stay at A
    }

    room.teamLevels[winTeamIdx] = Math.min(newLvl, LEVEL_ORDER.length - 1);
    room.upgradeRound++;

    let gameOver = (curLvl >= idxA && teamPts === 4); // Passed A = game victory

    let result = {
        winTeamIdx,
        winTeam,
        teamPts,
        advance,
        teamLevels: room.teamLevels.slice(),
        myLvl: LEVEL_ORDER[room.teamLevels[0]],
        opLvl: LEVEL_ORDER[room.teamLevels[1]],
        currentWildValue: LEVEL_ORDER[room.teamLevels[room.lastWinTeam]],
        upgradeRound: room.upgradeRound,
        upgradeFinished: gameOver
    };

    gameLog(`[Upgrade] Room ${room.id}: team${winTeamIdx} wins ${teamPts}pts, advance ${advance}, levels=[${room.teamLevels}], wild=${result.currentWildValue}${gameOver ? ' GAME OVER' : ''}`);
    return result;
}

/* =========================================
   Server-side Tribute (进贡/还贡/抗贡)
   ========================================= */
function executeServerTribute(rid, finishOrder, botSeats) {
    let room = rooms[rid];
    if (!room || !room.game) return;
    let g = room.game;
    let fo = finishOrder;
    let headSeat = fo[0]; // 头游 (1st place)
    let lastSeat = fo[3]; // 末游 (4th place)

    // Check 双上: both teammates finished 1st & 2nd
    let isDualUp = fo.length >= 2 && ((fo[0] + 2) % 4 === fo[1]);

    // Check 抗贡: 末游 has 2+ big jokers
    let lastHand = g.hands[lastSeat];
    let bigJokers = lastHand.filter(c => c.s === 'JOKER' && c.v === 'Bg');

    if (bigJokers.length >= 2) {
        // === 抗贡 (Shield) ===
        gameLog(`[Tribute] Room ${rid}: 抗贡! Seat ${lastSeat} has ${bigJokers.length} big jokers`);
        io.to(rid).emit('tributeAction', {
            action: 'shield',
            seat: lastSeat,
            cards: bigJokers.map(c => ({ s: c.s, v: c.v, p: c.p, id: c.id }))
        });
        // 抗贡: 头游先出
        g.turn = headSeat;
        setTimeout(() => {
            if (!room.game || !room.game.active) return;
            io.to(rid).emit('tributeComplete', { startTurn: headSeat });
            // Re-send updated hands to all players
            broadcastUpdatedHands(room, botSeats);
            scheduleBotTimeout(rid);
        }, 2500);
        return;
    }

    // === 进贡/还贡 ===
    let pairs = isDualUp ? [[lastSeat, headSeat], [fo[2], fo[1]]] : [[lastSeat, headSeat]];
    gameLog(`[Tribute] Room ${rid}: ${isDualUp ? '双上' : '普通'}进贡, pairs=${JSON.stringify(pairs)}`);

    // Process tribute pairs sequentially with delays
    processTributePairs(rid, pairs, 0, botSeats);
}

function processTributePairs(rid, pairs, pairIndex, botSeats) {
    let room = rooms[rid];
    if (!room || !room.game || !room.game.active) return;
    if (pairIndex >= pairs.length) {
        // All tribute done - 末游先出 (giver of first pair starts)
        let startTurn = pairs[0][0]; // lastSeat
        room.game.turn = startTurn;
        io.to(rid).emit('tributeComplete', { startTurn });
        broadcastUpdatedHands(room, botSeats);
        gameLog(`[Tribute] Room ${rid}: Tribute complete, startTurn=${startTurn}`);
        scheduleBotTimeout(rid);
        return;
    }

    let [fromSeat, toSeat] = pairs[pairIndex];
    let g = room.game;
    let fromHand = g.hands[fromSeat];
    let toHand = g.hands[toSeat];

    // --- 进贡: giver sends highest card ---
    let best = fromHand.reduce((a, b) => b.p > a.p ? b : a, fromHand[0]);
    let bestIdx = fromHand.indexOf(best);
    if (bestIdx >= 0) fromHand.splice(bestIdx, 1);
    toHand.push(best);
    toHand.sort((a, b) => b.p - a.p);

    let bestCard = { s: best.s, v: best.v, p: best.p, seq: best.seq, id: best.id };
    io.to(rid).emit('tributeAction', {
        action: 'give',
        fromSeat, toSeat,
        card: bestCard,
        pairIndex
    });
    gameLog(`[Tribute] Room ${rid}: 进贡 seat ${fromSeat} → seat ${toSeat}, card=${best.v}${best.s}`);

    // Update hands for affected human players
    sendHandUpdate(room, fromSeat);
    sendHandUpdate(room, toSeat);

    // After animation delay, proceed to 还贡
    setTimeout(() => {
        if (!room.game || !room.game.active) return;
        processTributeReturn(rid, pairs, pairIndex, fromSeat, toSeat, botSeats);
    }, 2800);
}

function processTributeReturn(rid, pairs, pairIndex, fromSeat, toSeat, botSeats) {
    let room = rooms[rid];
    if (!room || !room.game || !room.game.active) return;
    let g = room.game;

    // Check if receiver (toSeat) is a human player
    let isHuman = room.seats[toSeat] !== 'BOT';

    if (isHuman) {
        // Ask human player to pick a return card
        let receiverSid = room.seats[toSeat];
        io.to(receiverSid).emit('tributePickReturn', { fromSeat, toSeat });
        gameLog(`[Tribute] Room ${rid}: Waiting for human seat ${toSeat} to pick return card`);

        // Set up a promise-like mechanism with timeout
        let resolved = false;
        room._tributeReturnResolve = (card) => {
            if (resolved) return;
            resolved = true;
            completeTributeReturn(rid, pairs, pairIndex, fromSeat, toSeat, card, botSeats);
        };

        // Timeout: auto-pick lowest card after 30 seconds
        setTimeout(() => {
            if (resolved) return;
            resolved = true;
            delete room._tributeReturnResolve;
            let toHand = g.hands[toSeat];
            toHand.sort((a, b) => b.p - a.p);
            let autoCard = toHand[toHand.length - 1];
            gameLog(`[Tribute] Room ${rid}: Human seat ${toSeat} timeout, auto-returning lowest card`);
            completeTributeReturn(rid, pairs, pairIndex, fromSeat, toSeat, autoCard, botSeats);
        }, 30000);
    } else {
        // Bot auto-returns lowest card
        let toHand = g.hands[toSeat];
        toHand.sort((a, b) => b.p - a.p);
        let retCard = toHand[toHand.length - 1];
        completeTributeReturn(rid, pairs, pairIndex, fromSeat, toSeat, retCard, botSeats);
    }
}

function completeTributeReturn(rid, pairs, pairIndex, fromSeat, toSeat, retCard, botSeats) {
    let room = rooms[rid];
    if (!room || !room.game || !room.game.active) return;
    let g = room.game;
    let toHand = g.hands[toSeat];
    let fromHand = g.hands[fromSeat];

    // Find and remove the card from receiver's hand (match by id)
    let retIdx = toHand.findIndex(c => c.id === retCard.id);
    if (retIdx >= 0) {
        retCard = toHand[retIdx]; // Use the actual card object
        toHand.splice(retIdx, 1);
    } else {
        // Fallback: remove lowest card
        toHand.sort((a, b) => b.p - a.p);
        retCard = toHand.pop();
    }
    fromHand.push(retCard);
    fromHand.sort((a, b) => b.p - a.p);
    toHand.sort((a, b) => b.p - a.p);

    let retCardData = { s: retCard.s, v: retCard.v, p: retCard.p, seq: retCard.seq, id: retCard.id };
    io.to(rid).emit('tributeAction', {
        action: 'return',
        fromSeat, toSeat,
        card: retCardData,
        pairIndex
    });
    gameLog(`[Tribute] Room ${rid}: 还贡 seat ${toSeat} → seat ${fromSeat}, card=${retCard.v}${retCard.s}`);

    // Update hands for affected human players
    sendHandUpdate(room, fromSeat);
    sendHandUpdate(room, toSeat);

    // After animation delay, proceed to next pair or complete
    setTimeout(() => {
        if (!room.game || !room.game.active) return;
        processTributePairs(rid, pairs, pairIndex + 1, botSeats);
    }, 2500);
}

function sendHandUpdate(room, seat) {
    let sid = room.seats[seat];
    if (sid && sid !== 'BOT') {
        io.to(sid).emit('handUpdate', { cards: room.game.hands[seat].sort((a, b) => b.p - a.p) });
    }
}

function broadcastUpdatedHands(room, botSeats) {
    let hostSid = getHostSid(room);
    Object.keys(room.players).forEach(sid => {
        let s = room.players[sid];
        io.to(sid).emit('handUpdate', { cards: room.game.hands[s].sort((a, b) => b.p - a.p) });
        if (sid === hostSid) {
            let bots = {}; botSeats.forEach(bs => bots[bs] = room.game.hands[bs]);
            io.to(sid).emit('botCards', bots);
        }
    });
}

http.listen(PORT, () => {
    gameLog(`Crayxus V42 (Local Mode) Running on port ${PORT}`);
});
