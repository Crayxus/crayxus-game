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

const { simulateGameWithMMR } = require('./game-simulator');

const PORT = process.env.PORT || 3000;
const SERVER_VERSION = 'V43';
app.get('/api/version', (req, res) => res.json({ version: SERVER_VERSION }));

// Replay analysis page
app.get('/replay', (req, res) => res.sendFile(path.join(__dirname, 'replay.html')));

// Tournament page
app.get('/tournament', (req, res) => res.sendFile(path.join(__dirname, 'tournament.html')));

// 蛋力值测评
app.get('/danli', (req, res) => res.sendFile(path.join(__dirname, 'danli.html')));

// Dashboard大屏
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/ai-arena', (req, res) => res.sendFile(path.join(__dirname, 'ai-arena.html')));

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

// ========== 用户进度同步 API ==========
const PROGRESS_DIR = path.join(__dirname, 'user_progress');
if (!fs.existsSync(PROGRESS_DIR)) fs.mkdirSync(PROGRESS_DIR);

function getProgressPath(userId) {
    // 安全处理用户ID，防止路径注入
    const safe = String(userId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    return path.join(PROGRESS_DIR, safe + '.json');
}

// 保存进度
app.post('/api/progress', (req, res) => {
    const { userId, data } = req.body || {};
    if (!userId || !data) {
        return res.json({ success: false, msg: 'Missing userId or data' });
    }

    try {
        const filePath = getProgressPath(userId);
        // 读取现有进度，合并更新
        let existing = {};
        if (fs.existsSync(filePath)) {
            existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        // 合并各模块（取最新的）
        const merged = { ...existing, ...data, updatedAt: Date.now() };

        // 课程进度：合并而非覆盖（保留两端各自完成的课）
        if (existing.courses && data.courses) {
            const mc = { ...existing.courses };
            Object.keys(data.courses).forEach(courseId => {
                if (!mc[courseId]) mc[courseId] = {};
                Object.keys(data.courses[courseId]).forEach(lessonIdx => {
                    if (data.courses[courseId][lessonIdx] === 'done') {
                        mc[courseId][lessonIdx] = 'done';
                    }
                });
            });
            merged.courses = mc;
        }

        fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');
        gameLog(`[Progress] Saved for ${userId}`);
        res.json({ success: true, data: merged });
    } catch(e) {
        gameLog(`[Progress] Error saving: ${e.message}`);
        res.json({ success: false, msg: e.message });
    }
});

// 读取进度
app.get('/api/progress/:userId', (req, res) => {
    const userId = req.params.userId;
    const filePath = getProgressPath(userId);

    if (!fs.existsSync(filePath)) {
        return res.json({ success: true, data: null });
    }

    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json({ success: true, data });
    } catch(e) {
        res.json({ success: false, msg: e.message });
    }
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

    /* Seat swap: player clicks an empty seat to move there */
    socket.on('requestSeat', (data) => {
        const rid = playerMap[socket.id];
        if (!rid || !rooms[rid]) return;
        const room = rooms[rid];
        if (room.game && room.game.active) return; // can't swap during game
        const targetSeat = Number(data && data.seat);
        if (targetSeat < 0 || targetSeat > 3) return;
        const currentSeat = room.players[socket.id];
        if (currentSeat === undefined || currentSeat === targetSeat) return;
        // Target must be empty (null)
        if (room.seats[targetSeat] !== null) {
            socket.emit('err', '该座位已被占用');
            return;
        }
        // Swap
        room.seats[currentSeat] = null;
        room.seats[targetSeat] = socket.id;
        room.players[socket.id] = targetSeat;
        if (room.playerInfo[socket.id]) room.playerInfo[socket.id].seat = targetSeat;
        gameLog(`[SeatSwap] Room ${rid}: ${socket.id} moved from seat ${currentSeat} to seat ${targetSeat}`);
        // Notify the player
        socket.emit('seatSwapped', { seat: targetSeat });
        // Notify all: rebuild playersInfo and send roomUpdate
        let playersInfo = {};
        for (let sid in room.playerInfo) {
            let info = room.playerInfo[sid];
            playersInfo[info.seat] = { avatarUrl: info.avatarUrl, nickname: info.nickname };
        }
        io.to(rid).emit('roomUpdate', { count: room.count, seats: room.seats.map(s=>s===null?'EMPTY':(s==='BOT'?'BOT':'HUMAN')), roomId: rid, playersInfo });
        // Update host status
        let hostSid = getHostSid(room);
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
                // Send all other players' cards for VIEW display
                let bc = {};
                for (let i = 0; i < 4; i++) {
                    if (i !== spectateSeat && g.hands[i]) bc[i] = g.hands[i];
                }
                socket.emit('botCards', bc);
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

/* =========================================
   赛事系统 (Tournament System)
   ========================================= */
const TOURNAMENT_DIR = path.join(__dirname, 'tournaments');
if (!fs.existsSync(TOURNAMENT_DIR)) fs.mkdirSync(TOURNAMENT_DIR);

let tournaments = {};

// Load tournaments from disk on startup
try {
    fs.readdirSync(TOURNAMENT_DIR).filter(f => f.endsWith('.json')).forEach(f => {
        let t = JSON.parse(fs.readFileSync(path.join(TOURNAMENT_DIR, f)));
        tournaments[t.code] = t;
    });
    // Clean up stale active/playing tournaments (no live socket after restart)
    let cleaned = 0;
    for (let code in tournaments) {
        let t = tournaments[code];
        if ((t.status === 'active' || t.status === 'playing' || t.status === 'started') && t.format === 'mtt') {
            t.status = 'finished';
            saveTournament(t);
            cleaned++;
        }
    }
    gameLog(`[Tournament] Loaded ${Object.keys(tournaments).length} tournaments from disk` + (cleaned ? `, cleaned ${cleaned} stale active` : ''));
} catch(e) { gameLog(`[Tournament] Load error: ${e.message}`); }

// Seed demo tournaments if none exist
if (Object.keys(tournaments).length === 0) {
    const demoEvents = [
        {
            code: 'HZ0326', name: '企业团建', format: 'swiss', totalRounds: 4, gamesPerRound: 2,
            casualMode: 'fixed', organizer: 'Crayxus',
            status: 'booked', players: [],
            rounds: [], currentRound: 0,
            createdAt: '2026-03-19T09:00:00Z',
            eventType: 'teambuilding', eventDate: '2026-03-26', eventTime: '14:00',
            location: '杭州·滨江区', capacity: 40, fee: 0,
            description: '', bookedBy: '某互联网公司', bookedCount: 32
        },
        {
            code: 'HZ0327', name: '企业团建', format: 'swiss', totalRounds: 4, gamesPerRound: 2,
            casualMode: 'fixed', organizer: 'Crayxus',
            status: 'open', players: [],
            rounds: [], currentRound: 0,
            createdAt: '2026-03-19T09:00:00Z',
            eventType: 'teambuilding', eventDate: '2026-03-27', eventTime: '14:00',
            location: '杭州·可定制', capacity: 40, fee: 0,
            description: '可预约团建场次，填写人数即可'
        },
        {
            code: 'HZ0329', name: 'AI Bounty Solo · 运河站', format: 'swiss', totalRounds: 5, gamesPerRound: 2,
            casualMode: 'fixed', organizer: 'Crayxus',
            status: 'open', players: [
                { nickname: '掼蛋老炮', phone: '133****4444', joinedAt: '2026-03-21T08:00:00Z' },
                { nickname: '运河小哥', phone: '155****5555', team: '运河队', joinedAt: '2026-03-21T09:00:00Z' }
            ],
            rounds: [], currentRound: 0,
            createdAt: '2026-03-21T08:00:00Z',
            eventType: 'bounty_solo', eventDate: '2026-03-29', eventTime: '13:00',
            location: '杭州·拱墅区运河文化广场·茶语轩', capacity: 24, fee: 0,
            description: '免费参赛，个人挑战AI赢奖金！运河畔的周末Solo Bounty，茶歇供应。'
        },
        {
            code: 'HZ0402', name: '企业团建', format: 'swiss', totalRounds: 4, gamesPerRound: 2,
            casualMode: 'fixed', organizer: 'Crayxus',
            status: 'booked', players: [],
            rounds: [], currentRound: 0,
            createdAt: '2026-03-21T11:00:00Z',
            eventType: 'teambuilding', eventDate: '2026-04-02', eventTime: '14:00',
            location: '杭州·余杭区', capacity: 20, fee: 0,
            description: '', bookedBy: '某科技公司', bookedCount: 16
        },
        {
            code: 'HZ0403', name: '企业团建', format: 'swiss', totalRounds: 4, gamesPerRound: 2,
            casualMode: 'fixed', organizer: 'Crayxus',
            status: 'open', players: [],
            rounds: [], currentRound: 0,
            createdAt: '2026-03-21T11:00:00Z',
            eventType: 'teambuilding', eventDate: '2026-04-03', eventTime: '14:00',
            location: '杭州·可定制', capacity: 40, fee: 0,
            description: '可预约团建场次，填写人数即可'
        },
        {
            code: 'HZ0405', name: 'AI Bounty Solo · 西溪站', format: 'swiss', totalRounds: 5, gamesPerRound: 2,
            casualMode: 'fixed', organizer: 'Crayxus',
            status: 'open', players: [
                { nickname: '湿地鸟叔', phone: '177****6666', joinedAt: '2026-03-21T12:00:00Z' },
                { nickname: '花港观鱼', phone: '178****7777', team: '西溪队', joinedAt: '2026-03-21T13:00:00Z' },
                { nickname: '晴天娃娃', phone: '176****8888', joinedAt: '2026-03-21T14:00:00Z' }
            ],
            rounds: [], currentRound: 0,
            createdAt: '2026-03-21T12:00:00Z',
            eventType: 'bounty_solo', eventDate: '2026-04-05', eventTime: '13:30',
            location: '杭州·西湖区西溪湿地·福堤茶室', capacity: 32, fee: 0,
            description: '春日AI Bounty Solo，西溪湿地户外站。免费个人参赛，击败AI赢奖金！'
        },
        // 已满的Solo（过去的周末）
        {
            code: 'HZ0322', name: 'AI Bounty Solo · 钱塘站', format: 'swiss', totalRounds: 5, gamesPerRound: 2,
            casualMode: 'fixed', organizer: 'Crayxus',
            status: 'finished', players: Array.from({length: 24}, (_, i) => ({ nickname: '选手' + (i+1), joinedAt: '2026-03-18T10:00:00Z' })),
            rounds: [], currentRound: 0,
            createdAt: '2026-03-15T10:00:00Z',
            eventType: 'bounty_solo', eventDate: '2026-03-22', eventTime: '13:00',
            location: '杭州·钱塘区金沙湖·棋牌室', capacity: 24, fee: 0,
            description: 'AI Bounty Solo 钱塘站，已结束。'
        },
        {
            code: 'HZ0315', name: 'AI Bounty Solo · 灵隐站', format: 'swiss', totalRounds: 5, gamesPerRound: 2,
            casualMode: 'fixed', organizer: 'Crayxus',
            status: 'finished', players: Array.from({length: 32}, (_, i) => ({ nickname: '玩家' + (i+1), joinedAt: '2026-03-10T10:00:00Z' })),
            rounds: [], currentRound: 0,
            createdAt: '2026-03-10T10:00:00Z',
            eventType: 'bounty_solo', eventDate: '2026-03-15', eventTime: '13:30',
            location: '杭州·西湖区灵隐路·茶馆', capacity: 32, fee: 0,
            description: 'AI Bounty Solo 灵隐站，已结束。'
        },
        // 已占的Team（过去的工作日）
        {
            code: 'HZ0324', name: 'AI Bounty Team · 滨江站', format: 'swiss', totalRounds: 4, gamesPerRound: 2,
            casualMode: 'fixed', organizer: 'Crayxus',
            status: 'booked', players: [],
            rounds: [], currentRound: 0,
            createdAt: '2026-03-18T10:00:00Z',
            eventType: 'bounty_team', eventDate: '2026-03-24', eventTime: '14:00',
            location: '杭州·滨江区网易大厦', capacity: 40, fee: 0,
            description: '', bookedBy: '网易互娱', bookedCount: 36
        },
        {
            code: 'HZ0319', name: 'AI Bounty Team · 未来科技城站', format: 'swiss', totalRounds: 4, gamesPerRound: 2,
            casualMode: 'fixed', organizer: 'Crayxus',
            status: 'booked', players: [],
            rounds: [], currentRound: 0,
            createdAt: '2026-03-12T10:00:00Z',
            eventType: 'bounty_team', eventDate: '2026-03-19', eventTime: '14:00',
            location: '杭州·余杭区未来科技城·海创园', capacity: 32, fee: 0,
            description: '', bookedBy: '阿里云智能', bookedCount: 28
        },
        {
            code: 'HZ0331', name: 'AI Bounty Team · 城西站', format: 'swiss', totalRounds: 4, gamesPerRound: 2,
            casualMode: 'fixed', organizer: 'Crayxus',
            status: 'booked', players: [],
            rounds: [], currentRound: 0,
            createdAt: '2026-03-25T10:00:00Z',
            eventType: 'bounty_team', eventDate: '2026-04-01', eventTime: '14:00',
            location: '杭州·西湖区黄龙体育中心', capacity: 40, fee: 0,
            description: '', bookedBy: '字节跳动杭州', bookedCount: 40
        }
    ];
    demoEvents.forEach(t => {
        tournaments[t.code] = t;
        saveTournament(t);
    });
    gameLog(`[Tournament] Seeded ${demoEvents.length} demo events`);
}

function saveTournament(t) {
    try {
        // Build a clean copy to avoid circular refs from tables→player objects
        let clean = {
            code: t.code, name: t.name, status: t.status, format: t.format,
            currentRound: t.currentRound, totalRounds: t.totalRounds,
            createdAt: t.createdAt, startedAt: t.startedAt,
            refereePin: t.refereePin, structure: t.structure,
            isDemo: t.isDemo,
            eventType: t.eventType, eventDate: t.eventDate, eventTime: t.eventTime,
            location: t.location, capacity: t.capacity, organizer: t.organizer,
            bookedBy: t.bookedBy, bookedCount: t.bookedCount,
            players: (t.players || []).map(p => ({
                nickname: p.nickname, score: p.score||0, mmr: p.mmr||1000,
                eliminated: !!p.eliminated, eliminatedRound: p.eliminatedRound||null,
                isHuman: !!p.isHuman, joinedAt: p.joinedAt,
                phone: p.phone, team: p.team
            }))
        };
        let data = JSON.stringify(clean, null, 2);
        fs.writeFile(path.join(TOURNAMENT_DIR, t.code + '.json'), data, (err) => {
            if (err) gameLog('[Save] Error saving ' + t.code + ': ' + err.message);
        });
    } catch(e) {
        gameLog('[Save] JSON error for ' + t.code + ': ' + e.message);
    }
}

function genTournamentCode() {
    let chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do { code = ''; for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]; }
    while (tournaments[code]);
    return code;
}

// List tournaments (teambuilding shows limited info)
app.get('/api/tournaments', (req, res) => {
    let list = Object.values(tournaments).map(t => {
        let isTeambuilding = t.eventType === 'teambuilding';
        return {
            code: t.code,
            name: t.name,
            format: t.format,
            status: t.status,
            playerCount: isTeambuilding ? (t.bookedCount || 0) : t.players.length,
            players: isTeambuilding ? [] : t.players, // hide player details for teambuilding
            currentRound: t.currentRound,
            totalRounds: t.totalRounds,
            createdAt: t.createdAt,
            eventType: t.eventType || 'open',
            eventDate: t.eventDate || t.createdAt.split('T')[0],
            eventTime: t.eventTime || '14:00',
            location: t.location || '',
            capacity: t.capacity || 0,
            organizer: t.organizer,
            bookedBy: isTeambuilding ? (t.bookedBy || '') : undefined,
            bookedCount: isTeambuilding ? (t.bookedCount || 0) : undefined
        };
    }).sort((a, b) => {
        // Sort by event date, then by creation date
        let da = a.eventDate || a.createdAt;
        let db = b.eventDate || b.createdAt;
        return da.localeCompare(db) || new Date(a.createdAt) - new Date(b.createdAt);
    });
    res.json(list);
});

// Get tournament details
app.get('/api/tournaments/:code', (req, res) => {
    let t = tournaments[req.params.code.toUpperCase()];
    if (!t) return res.status(404).json({ error: '赛事不存在' });
    // Compute standings
    let standings = computeStandings(t);
    res.json({ ...t, standings });
});

// Create tournament
app.post('/api/tournaments', (req, res) => {
    let { name, format, totalRounds, gamesPerRound, casualMode, organizer,
          eventType, eventDate, eventTime, location, capacity, fee, description } = req.body;
    if (!name || !organizer) return res.json({ error: '缺少必要信息' });

    let code = genTournamentCode();
    let t = {
        code,
        name: name.substring(0, 40),
        format: format || 'swiss',
        totalRounds: totalRounds || 5,
        gamesPerRound: gamesPerRound || 2,
        casualMode: casualMode || 'fixed',
        organizer,
        status: 'open', // open → active → finished
        players: [{ nickname: organizer, joinedAt: new Date().toISOString() }],
        rounds: [],
        currentRound: 0,
        createdAt: new Date().toISOString(),
        // Event details
        eventType: eventType || 'open',
        eventDate: eventDate || new Date().toISOString().split('T')[0],
        eventTime: eventTime || '14:00',
        location: (location || '').substring(0, 80),
        capacity: parseInt(capacity) || 0,
        fee: parseFloat(fee) || 0,
        description: (description || '').substring(0, 500)
    };

    tournaments[code] = t;
    saveTournament(t);
    gameLog(`[Tournament] Created: ${code} "${name}" by ${organizer} (${eventType}, ${eventDate} ${eventTime}, ${location || 'TBD'})`);
    res.json(t);
});

// Join tournament (register)
app.post('/api/tournaments/:code/join', (req, res) => {
    let t = tournaments[req.params.code.toUpperCase()];
    if (!t) return res.json({ error: '赛事不存在' });
    if (t.status !== 'open') return res.json({ error: '赛事已开始，无法报名' });

    let { nickname, phone, team, note } = req.body;
    if (!nickname) return res.json({ error: '请输入姓名' });

    // Check capacity
    if (t.capacity > 0 && t.players.length >= t.capacity) {
        return res.json({ error: '报名已满' });
    }

    // Check duplicate by phone (if provided) or nickname
    if (phone && t.players.some(p => p.phone === phone)) {
        return res.json({ error: '该手机号已报名' });
    }
    if (t.players.some(p => p.nickname === nickname && !phone)) {
        return res.json({ error: '该姓名已报名，请填写手机号区分' });
    }

    t.players.push({
        nickname,
        phone: phone || '',
        team: team || '',
        note: note || '',
        joinedAt: new Date().toISOString()
    });
    saveTournament(t);
    gameLog(`[Tournament] ${t.code}: ${nickname}${team ? '(' + team + ')' : ''} registered (${t.players.length}/${t.capacity || '∞'})`);
    res.json({ success: true });
});

// Start tournament (first round pairing)
app.post('/api/tournaments/:code/start', (req, res) => {
    let t = tournaments[req.params.code.toUpperCase()];
    if (!t) return res.json({ error: '赛事不存在' });
    if (t.status !== 'open') return res.json({ error: '赛事已开始' });
    if (t.players.length < 4) return res.json({ error: '至少需要4人' });

    // Pad to multiple of 4 if needed (bye system)
    t.status = 'active';
    t.currentRound = 1;

    // Generate first round pairings
    let pairings = generatePairings(t, 1);
    t.rounds.push(pairings);
    saveTournament(t);
    gameLog(`[Tournament] ${t.code}: Started! Round 1 generated (${pairings.length} tables)`);
    res.json({ success: true, currentRound: 1 });
});

// Next round
app.post('/api/tournaments/:code/next-round', (req, res) => {
    let t = tournaments[req.params.code.toUpperCase()];
    if (!t) return res.json({ error: '赛事不存在' });
    if (t.status !== 'active') return res.json({ error: '赛事未在进行中' });
    if (t.currentRound >= t.totalRounds) return res.json({ error: '已达最大轮次' });

    // Check current round complete
    let lastRound = t.rounds[t.currentRound - 1];
    if (!lastRound || !lastRound.every(m => m.result)) {
        return res.json({ error: '当前轮次尚未全部完成' });
    }

    t.currentRound++;
    let pairings = generatePairings(t, t.currentRound);
    t.rounds.push(pairings);
    saveTournament(t);
    gameLog(`[Tournament] ${t.code}: Round ${t.currentRound} generated (${pairings.length} tables)`);
    res.json({ success: true, currentRound: t.currentRound });
});

// Report result
app.post('/api/tournaments/:code/result', (req, res) => {
    let t = tournaments[req.params.code.toUpperCase()];
    if (!t) return res.json({ error: '赛事不存在' });
    let { round, match, winner, scores } = req.body;

    if (round < 0 || round >= t.rounds.length) return res.json({ error: '无效轮次' });
    let m = t.rounds[round][match];
    if (!m) return res.json({ error: '无效桌号' });

    m.result = { winner, scores, reportedAt: new Date().toISOString() };
    saveTournament(t);
    gameLog(`[Tournament] ${t.code}: R${round+1}M${match+1} result: team${winner} wins, scores=[${scores}]`);
    res.json({ success: true });
});

// Finish tournament
app.post('/api/tournaments/:code/finish', (req, res) => {
    let t = tournaments[req.params.code.toUpperCase()];
    if (!t) return res.json({ error: '赛事不存在' });
    t.status = 'finished';
    t.finishedAt = new Date().toISOString();
    saveTournament(t);
    gameLog(`[Tournament] ${t.code}: Tournament finished`);
    res.json({ success: true });
});

// ===== Pairing Logic =====
function generatePairings(t, roundNum) {
    let players = t.players.map(p => p.nickname);
    let n = players.length;

    // Pad to even number of teams (2 players per team → need multiple of 4)
    // If odd number of players, add a BYE player
    if (n % 4 !== 0) {
        let need = 4 - (n % 4);
        for (let i = 0; i < need; i++) players.push(`轮空${i + 1}`);
    }

    if (t.format === 'swiss') {
        return swissPairing(t, players, roundNum);
    } else if (t.format === 'round-robin') {
        return roundRobinPairing(t, players, roundNum);
    } else {
        return randomPairing(players);
    }
}

function swissPairing(t, players, roundNum) {
    if (roundNum === 1) {
        // First round: random pairing
        return randomPairing(players);
    }

    // Swiss: sort by score, pair adjacent
    let standings = computeStandings(t);
    let sorted = standings.map(s => s.nickname);
    // Add any players not in standings
    players.forEach(p => { if (!sorted.includes(p)) sorted.push(p); });

    // Build previous opponent map to avoid rematches
    let prevOpponents = {};
    players.forEach(p => prevOpponents[p] = new Set());
    for (let round of t.rounds) {
        for (let m of round) {
            let allP = [...m.teams[0], ...m.teams[1]];
            for (let p1 of m.teams[0]) for (let p2 of m.teams[1]) {
                if (prevOpponents[p1]) prevOpponents[p1].add(p2);
                if (prevOpponents[p2]) prevOpponents[p2].add(p1);
            }
        }
    }

    // Pair adjacent players, try to avoid rematches
    let used = new Set();
    let tables = [];

    // Group into teams of 2 first (adjacent pairs in standings)
    let teams = [];
    for (let i = 0; i < sorted.length; i++) {
        if (used.has(sorted[i])) continue;
        for (let j = i + 1; j < sorted.length; j++) {
            if (used.has(sorted[j])) continue;
            teams.push([sorted[i], sorted[j]]);
            used.add(sorted[i]);
            used.add(sorted[j]);
            break;
        }
    }

    // Now pair teams against each other
    used.clear();
    for (let i = 0; i < teams.length; i++) {
        if (used.has(i)) continue;
        let bestJ = -1;
        for (let j = i + 1; j < teams.length; j++) {
            if (used.has(j)) continue;
            // Check rematch
            let hasRematch = false;
            for (let p1 of teams[i]) for (let p2 of teams[j]) {
                if (prevOpponents[p1] && prevOpponents[p1].has(p2)) hasRematch = true;
            }
            if (!hasRematch || bestJ === -1) { bestJ = j; if (!hasRematch) break; }
        }
        if (bestJ >= 0) {
            tables.push({ teams: [teams[i], teams[bestJ]], result: null });
            used.add(i);
            used.add(bestJ);
        }
    }

    return tables;
}

function roundRobinPairing(t, players, roundNum) {
    // Simple: use round number as rotation offset
    let n = players.length;
    let rotated = [...players];
    for (let r = 1; r < roundNum; r++) {
        let last = rotated.pop();
        rotated.splice(1, 0, last);
    }
    return randomPairing(rotated);
}

function randomPairing(players) {
    // Shuffle, then group into tables of 4
    let shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let tables = [];
    for (let i = 0; i < shuffled.length; i += 4) {
        if (i + 3 < shuffled.length) {
            tables.push({
                teams: [[shuffled[i], shuffled[i+2]], [shuffled[i+1], shuffled[i+3]]],
                result: null
            });
        }
    }
    return tables;
}

// ===== Standings Computation =====
function computeStandings(t) {
    let stats = {};
    t.players.forEach(p => {
        stats[p.nickname] = { nickname: p.nickname, score: 0, wins: 0, losses: 0, tiebreak: 0, games: 0 };
    });

    for (let round of t.rounds) {
        for (let m of round) {
            if (!m.result) continue;
            let winTeam = m.teams[m.result.winner];
            let loseTeam = m.teams[1 - m.result.winner];

            winTeam.forEach(p => {
                if (stats[p]) {
                    stats[p].score += m.result.scores[m.result.winner] || 3;
                    stats[p].wins++;
                    stats[p].games++;
                }
            });
            loseTeam.forEach(p => {
                if (stats[p]) {
                    stats[p].score += m.result.scores[1 - m.result.winner] || 0;
                    stats[p].losses++;
                    stats[p].games++;
                }
            });
        }
    }

    // Buchholz tiebreak: sum of opponents' scores
    for (let round of t.rounds) {
        for (let m of round) {
            if (!m.result) continue;
            let team0score = m.teams[0].reduce((s, p) => s + (stats[p] ? stats[p].score : 0), 0);
            let team1score = m.teams[1].reduce((s, p) => s + (stats[p] ? stats[p].score : 0), 0);
            m.teams[0].forEach(p => { if (stats[p]) stats[p].tiebreak += team1score; });
            m.teams[1].forEach(p => { if (stats[p]) stats[p].tiebreak += team0score; });
        }
    }

    return Object.values(stats)
        .filter(s => !s.nickname.startsWith('轮空'))
        .sort((a, b) => b.score - a.score || b.tiebreak - a.tiebreak || b.wins - a.wins);
}

// ===== 48-Player Standard Tournament (Dashboard API) =====

// Scoring constants per V2.1 rulebook
const SCORE_48 = { doubleUp: 20, singleUpWin: 12, singleUpLose: 0, doubleDown: -8, timeout: -12 };
const MMR_48   = { doubleUp: 30, singleUpWin: 15, singleUpLose: -15, doubleDown: -30, timeout: -40 };

// Dashboard data endpoint
app.get('/api/tournaments/:code/dashboard', (req, res) => {
    let t = tournaments[req.params.code.toUpperCase()];
    if (!t) return res.json({ error: '赛事不存在' });

    // Build player list with scores & MMR
    let playerList = (t.players || []).map((p, i) => ({
        nickname: p.nickname,
        score: p.score || 0,
        mmr: p.mmr || 1000,
        eliminated: !!p.eliminated,
        eliminatedRound: p.eliminatedRound || null,
        rank: 0
    }));

    // Compute ranks
    let active = playerList.filter(p => !p.eliminated).sort((a, b) => b.score - a.score);
    active.forEach((p, i) => p.rank = i + 1);
    let elim = playerList.filter(p => p.eliminated).sort((a, b) => (b.eliminatedRound || 0) - (a.eliminatedRound || 0) || b.score - a.score);
    elim.forEach((p, i) => p.rank = active.length + i + 1);

    res.json({
        code: t.code,
        name: t.name,
        status: t.status,
        currentRound: t.currentRound || 0,
        totalRounds: t.totalRounds || 20,
        players: playerList,
        refereePin: t.refereePin || null
    });
});

// Initialize 48-player tournament with MMR fields
app.post('/api/tournaments/:code/init48', (req, res) => {
    let t = tournaments[req.params.code.toUpperCase()];
    if (!t) return res.json({ error: '赛事不存在' });

    // Set referee PIN
    let pin = req.body.refereePin || String(Math.floor(1000 + Math.random() * 9000));
    t.refereePin = pin;
    t.format = 'standard48';
    t.totalRounds = 18;

    // Initialize each player's score/MMR
    for (let p of t.players) {
        if (p.score === undefined) p.score = 0;
        if (p.mmr === undefined) p.mmr = 1000;
        if (p.eliminated === undefined) p.eliminated = false;
        p.eliminatedRound = null;
        p.roundScores = p.roundScores || [];
    }

    saveTournament(t);
    gameLog(`[T48] ${t.code}: Initialized as standard48, PIN=${pin}, ${t.players.length} players`);
    res.json({ success: true, refereePin: pin });
});

// Referee: verify PIN
app.post('/api/tournaments/:code/referee-auth', (req, res) => {
    let t = tournaments[req.params.code.toUpperCase()];
    if (!t) return res.json({ error: '赛事不存在' });
    let { pin } = req.body;
    if (!pin || pin !== t.refereePin) return res.json({ error: '裁判密码错误' });
    res.json({ success: true, isReferee: true });
});

// Referee: report table result
app.post('/api/tournaments/:code/result48', (req, res) => {
    let t = tournaments[req.params.code.toUpperCase()];
    if (!t) return res.json({ error: '赛事不存在' });
    let { pin, results } = req.body;
    // results: [{nickname, outcome}] where outcome is 'doubleUp'|'singleUpWin'|'singleUpLose'|'doubleDown'|'timeout'
    if (pin !== t.refereePin) return res.json({ error: '裁判密码错误' });
    if (!results || !Array.isArray(results)) return res.json({ error: '缺少结果数据' });

    let changes = [];
    for (let r of results) {
        let p = t.players.find(x => x.nickname === r.nickname);
        if (!p || p.eliminated) continue;
        let scoreDelta = SCORE_48[r.outcome] || 0;
        let mmrDelta = MMR_48[r.outcome] || 0;
        p.score = (p.score || 0) + scoreDelta;
        p.mmr = (p.mmr || 1000) + mmrDelta;
        changes.push({
            nickname: p.nickname,
            scoreDelta,
            newScore: p.score,
            mmrDelta,
            newMmr: p.mmr
        });
    }

    saveTournament(t);
    // Broadcast to dashboard
    io.to('dashboard:' + t.code).emit('scoreUpdate', { round: t.currentRound, changes });
    gameLog(`[T48] ${t.code}: R${t.currentRound} results reported for ${changes.length} players`);
    res.json({ success: true, changes });
});

// Referee: trigger elimination (after round >= 10)
app.post('/api/tournaments/:code/eliminate48', (req, res) => {
    let t = tournaments[req.params.code.toUpperCase()];
    if (!t) return res.json({ error: '赛事不存在' });
    let { pin } = req.body;
    if (pin !== t.refereePin) return res.json({ error: '裁判密码错误' });

    let active = t.players.filter(p => !p.eliminated).sort((a, b) => (a.score || 0) - (b.score || 0));
    if (active.length <= 4) return res.json({ error: '人数不足，无法继续淘汰' });

    // Eliminate bottom 4
    let toElim = active.slice(0, 4);
    let eliminated = [];
    for (let p of toElim) {
        p.eliminated = true;
        p.eliminatedRound = t.currentRound;
        eliminated.push({ nickname: p.nickname, finalScore: p.score, finalMmr: p.mmr });
    }

    saveTournament(t);
    io.to('dashboard:' + t.code).emit('elimination', { round: t.currentRound, eliminated });
    gameLog(`[T48] ${t.code}: R${t.currentRound} eliminated: ${eliminated.map(e => e.nickname).join(', ')}`);
    res.json({ success: true, eliminated });
});

// Referee: advance to next round
app.post('/api/tournaments/:code/next-round48', (req, res) => {
    let t = tournaments[req.params.code.toUpperCase()];
    if (!t) return res.json({ error: '赛事不存在' });
    let { pin } = req.body;
    if (pin !== t.refereePin) return res.json({ error: '裁判密码错误' });

    t.currentRound = (t.currentRound || 0) + 1;

    // MMR-based pairing: sort active by MMR, group into tables of 4
    let active = t.players.filter(p => !p.eliminated).sort((a, b) => (b.mmr || 1000) - (a.mmr || 1000));
    let tables = [];
    for (let i = 0; i < active.length - 3; i += 4) {
        let table = active.slice(i, i + 4);
        // Within table: 1+2 vs 3+4 (强强对战弱弱)
        tables.push({
            team1: [table[0].nickname, table[1].nickname],
            team2: [table[2].nickname, table[3].nickname],
            tableNum: tables.length + 1
        });
    }

    saveTournament(t);

    let timer = 300; // 5 minutes per round
    io.to('dashboard:' + t.code).emit('roundStart', { round: t.currentRound, tables, timer });
    gameLog(`[T48] ${t.code}: Round ${t.currentRound} started, ${tables.length} tables`);
    res.json({ success: true, round: t.currentRound, tables });
});

// Referee: manually update a player's score
app.post('/api/tournaments/:code/adjust48', (req, res) => {
    let t = tournaments[req.params.code.toUpperCase()];
    if (!t) return res.json({ error: '赛事不存在' });
    let { pin, nickname, scoreDelta, mmrDelta } = req.body;
    if (pin !== t.refereePin) return res.json({ error: '裁判密码错误' });

    let p = t.players.find(x => x.nickname === nickname);
    if (!p) return res.json({ error: '选手不存在' });

    p.score = (p.score || 0) + (scoreDelta || 0);
    p.mmr = (p.mmr || 1000) + (mmrDelta || 0);
    saveTournament(t);

    let changes = [{ nickname: p.nickname, scoreDelta: scoreDelta || 0, newScore: p.score, mmrDelta: mmrDelta || 0, newMmr: p.mmr }];
    io.to('dashboard:' + t.code).emit('scoreUpdate', { round: t.currentRound, changes });
    res.json({ success: true, player: { nickname: p.nickname, score: p.score, mmr: p.mmr } });
});

// ===== Arena 48-Player Auto-Tournament Engine =====

const BOT_NAMES_48 = [
    '小明','大壮','阿花','铁柱','翠花','建国','美丽','志强','秀兰','国庆',
    '春花','伟民','红梅','胜利','桂兰','永强','淑芬','光明','玉兰','德华',
    '晓红','文明','丽华','少华','月英','天亮','彩霞','海波','冬梅','卫东',
    '春燕','大鹏','金花','长江','巧玲','黄河','雪梅','泰山','丹丹','昆仑',
    '婷婷','天山','晶晶','武当','佳佳','峨眉','圆圆'
];

// Map finishOrder to V2.1 tournament outcomes for 4 players
// finishOrder[0]=头游, [1]=二游, [2]=三游, [3]=末游
// Teams: seat0+seat2 vs seat1+seat3
function classifyTableResult(finishOrder) {
    let head = finishOrder[0];
    let headMate = (head + 2) % 4;
    let matePos = finishOrder.indexOf(headMate);
    // Winners = head's team, Losers = other team
    let winners = [head, headMate];
    let losers = [0,1,2,3].filter(s => !winners.includes(s));
    if (matePos === 1) {
        // 双上游: both teammates 1st+2nd
        return { winners, losers, winType: 'doubleUp', loseType: 'doubleDown' };
    } else {
        // 单边上游: head 1st, mate 3rd or 4th
        return { winners, losers, winType: 'singleUpWin', loseType: 'singleUpLose' };
    }
}

// Simulate a bot-only table with real guandan AI
// mmrs: array of 4 MMR values for the table players
function simulateBotTable(mmrs) {
    try {
        let fo = simulateGameWithMMR(mmrs || [1000,1000,1000,1000]);
        return fo;
    } catch(e) {
        gameLog(`[Sim] Game simulation error: ${e.message}, falling back to random`);
        let seats = [0,1,2,3];
        for (let i = 3; i > 0; i--) { let j = Math.floor(Math.random()*(i+1)); [seats[i],seats[j]]=[seats[j],seats[i]]; }
        return seats;
    }
}

// Active arena tournaments keyed by socket ID
let arenaBySocket = {};


// Socket: dashboard room + Arena48 events
io.on('connection', (socket) => {
    socket.on('joinDashboard', (code) => {
        code = (code || '').toUpperCase();
        socket.join('dashboard:' + code);
        gameLog(`[Dashboard] Client joined dashboard:${code}`);
        let t = tournaments[code];
        if (t) {
            let playerList = (t.players || []).map(p => ({
                nickname: p.nickname,
                score: p.score || 0,
                mmr: p.mmr || 1000,
                eliminated: !!p.eliminated,
                eliminatedRound: p.eliminatedRound || null
            }));
            socket.emit('dashboardState', {
                code: t.code,
                name: t.name,
                currentRound: t.currentRound || 0,
                totalRounds: t.totalRounds || 20,
                players: playerList
            });
        }
    });

    // ---- Arena 48 Tournament ----

    socket.on('startArena48', (data) => {
        let playerNick = (data && data.nickname) || 'YOU';
        let requestedCount = (data && data.playerCount) || 48;

        // Calculate tournament structure
        let structure = calcTournamentStructure(requestedCount);
        let pc = structure.playerCount;

        // Create tournament code
        let code = 'A' + Math.random().toString(36).substr(2, 5).toUpperCase();
        while (tournaments[code]) code = 'A' + Math.random().toString(36).substr(2, 5).toUpperCase();

        // Create players: 1 human + (pc-1) bots
        let botPool = [...BOT_NAMES_48];
        // Extend bot pool if needed for larger tournaments
        while (botPool.length < pc - 1) {
            botPool.push('Bot_' + (botPool.length + 1));
        }
        let shuffledBots = botPool.sort(() => Math.random() - 0.5);
        let players = [{ nickname: playerNick, score: 0, mmr: 1000, eliminated: false, isHuman: true, socketId: socket.id }];
        for (let i = 0; i < pc - 1; i++) {
            players.push({ nickname: shuffledBots[i], score: 0, mmr: 1000, eliminated: false, isHuman: false });
        }

        let tourney = {
            code, name: 'Crayxus MTT ' + pc + '人锦标赛', players,
            currentRound: 0, totalRounds: structure.totalRounds,
            status: 'active', format: 'mtt',
            refereePin: String(Math.floor(1000 + Math.random() * 9000)),
            tables: [], playerTableIdx: -1,
            startedAt: Date.now(),
            structure: structure,
            createdAt: new Date().toISOString()
        };
        tournaments[code] = tourney;
        saveTournament(tourney);

        arenaBySocket[socket.id] = { code, playerNick };
        gameLog(`[Arena48] Created ${pc}-player tournament ${code} for ${playerNick} (${structure.totalRounds} rounds: ${structure.practiceRounds}P+${structure.qualifierRounds}Q+${structure.eliminationRounds}E)`);

        // Start round 1
        startArena48Round(socket, tourney);
    });

    socket.on('arena48GameFinished', (data) => {
        // Player's table game finished, data = { finishOrder: [seat0..3] }
        let arena = arenaBySocket[socket.id];
        if (!arena) return;
        let t = tournaments[arena.code];
        if (!t) return;

        let fo = data.finishOrder || [0,1,2,3];
        let code = t.code;

        // Process round end immediately (bot tables use instant real-game simulation)
        processArena48RoundEndReal(socket, t, fo);
    });

    socket.on('arena48NextRound', () => {
        let arena = arenaBySocket[socket.id];
        if (!arena) return;
        let t = tournaments[arena.code];
        if (!t || t.status !== 'active') return;
        startArena48Round(socket, t);
    });

    socket.on('arena48BreakOver', () => {
        let arena = arenaBySocket[socket.id];
        if (!arena) return;
        let t = tournaments[arena.code];
        if (!t || t.status !== 'active') return;
        t._breakDone = true;
        t._breakPending = null;
        startArena48Round(socket, t);
    });

    socket.on('disconnect', () => {
        delete arenaBySocket[socket.id];
    });
});

/**
 * Auto-calculate tournament structure from player count.
 * Returns { practiceRounds, qualifierRounds, eliminationRounds, totalRounds, breaks }
 */
function calcTournamentStructure(playerCount) {
    let pc = Math.max(8, Math.floor(playerCount / 4) * 4); // round down to multiple of 4, min 8
    let practice = 3;
    let qualifier = Math.max(3, Math.ceil(pc / 16));
    let elimination = (pc - 4) / 4;
    let total = practice + qualifier + elimination;
    let breakAfterPractice = practice; // break after round N
    let breakAfterQualifier = practice + qualifier;
    return {
        playerCount: pc,
        practiceRounds: practice,
        qualifierRounds: qualifier,
        eliminationRounds: elimination,
        totalRounds: total,
        breaks: { [breakAfterPractice]: 300, [breakAfterQualifier]: 600 }, // roundNum: seconds
        elimStartRound: practice + qualifier + 1
    };
}

function getPhase(round, structure) {
    if (!structure) {
        // Legacy fallback
        if (round <= 3) return { name: '热身赛', nameEn: 'WARMUP', scored: false, elimination: false };
        if (round <= 9) return { name: '预赛', nameEn: 'QUALIFIER', scored: true, elimination: false };
        return { name: '决赛', nameEn: 'FINALS', scored: true, elimination: true };
    }
    let { practiceRounds, qualifierRounds } = structure;
    if (round <= practiceRounds) return { name: '热身赛', nameEn: 'WARMUP', scored: false, elimination: false };
    if (round <= practiceRounds + qualifierRounds) return { name: '预赛', nameEn: 'QUALIFIER', scored: true, elimination: false };
    return { name: '决赛', nameEn: 'FINALS', scored: true, elimination: true };
}

function startArena48Round(socket, tourney) {
    tourney.currentRound++;

    // Check if a break is needed (dynamic based on tournament structure)
    let prevRound = tourney.currentRound - 1;
    let breaks = (tourney.structure && tourney.structure.breaks) || { 3: 300, 9: 600 };
    if (breaks[prevRound] && !tourney._breakDone) {
        let breakSec = breaks[prevRound];
        let nextPhase = getPhase(tourney.currentRound, tourney.structure);
        tourney.currentRound--; // Don't advance yet
        tourney._breakPending = prevRound;

        let elapsed = tourney.startedAt ? Math.floor((Date.now() - tourney.startedAt) / 1000) : 0;

        socket.emit('arena48Break', {
            breakSeconds: breakSec,
            nextPhase: nextPhase.name,
            nextPhaseEn: nextPhase.nameEn,
            completedRounds: prevRound,
            totalRounds: tourney.totalRounds,
            elapsedSeconds: elapsed
        });
        io.to('dashboard:' + tourney.code).emit('tournamentBreak', {
            breakSeconds: breakSec,
            nextPhase: nextPhase.name,
            completedRounds: prevRound
        });
        gameLog(`[Arena48] ${tourney.code}: Break ${breakSec}s after R${prevRound}, next phase: ${nextPhase.name}`);
        return;
    }
    tourney._breakDone = false;

    let phase = getPhase(tourney.currentRound, tourney.structure);
    let active = tourney.players.filter(p => !p.eliminated);
    if (active.length < 4) {
        tourney.status = 'finished';
        saveTournament(tourney);
        socket.emit('arena48TournamentEnd', { finalStandings: getArena48Standings(tourney) });
        return;
    }

    // MMR-based pairing: sort by MMR, group into tables of 4
    active.sort((a, b) => (b.mmr || 1000) - (a.mmr || 1000));
    let tables = [];
    for (let i = 0; i < active.length - 3; i += 4) {
        tables.push(active.slice(i, i + 4));
    }

    let playerTableIdx = tables.findIndex(t => t.some(p => p.isHuman));
    tourney.tables = tables;
    tourney.playerTableIdx = playerTableIdx;

    let tableInfo = tables.map((t, i) => ({
        tableNum: i + 1,
        players: t.map(p => ({ nickname: p.nickname, mmr: p.mmr || 1000 }))
    }));

    let humanPlayer = tourney.players.find(p => p.isHuman);
    let rank = active.sort((a, b) => (b.score || 0) - (a.score || 0)).indexOf(humanPlayer) + 1;
    let elapsed = tourney.startedAt ? Math.floor((Date.now() - tourney.startedAt) / 1000) : 0;

    socket.emit('arena48RoundStart', {
        code: tourney.code,
        round: tourney.currentRound,
        totalRounds: tourney.totalRounds,
        playerTable: playerTableIdx,
        tables: tableInfo,
        rank: rank,
        totalActive: active.length,
        totalPlayers: tourney.players.length,
        score: humanPlayer.score || 0,
        phase: phase.name,
        phaseEn: phase.nameEn,
        scored: phase.scored,
        elapsedSeconds: elapsed,
        structure: tourney.structure
    });

    io.to('dashboard:' + tourney.code).emit('roundStart', {
        round: tourney.currentRound,
        timer: 300,
        phase: phase.name,
        tables: tableInfo.map(t => ({
            team1: [t.players[0].nickname, t.players[2] ? t.players[2].nickname : ''],
            team2: [t.players[1].nickname, t.players[3] ? t.players[3].nickname : ''],
            tableNum: t.tableNum
        }))
    });

    gameLog(`[Arena48] ${tourney.code}: R${tourney.currentRound} [${phase.name}] started, ${tables.length} tables`);
}


// Legacy fallback (kept for referee-mode tournaments)
function processArena48RoundEnd(socket, tourney, playerFinishOrder) {
    // Always process immediately in legacy mode
    processArena48RoundEndReal(socket, tourney, playerFinishOrder);
}

/**
 * Process round end using real bot game results from background.
 */
function processArena48RoundEndReal(socket, tourney, playerFinishOrder) {
    let tables = tourney.tables;
    let phase = getPhase(tourney.currentRound, tourney.structure);
    let allResults = [];

    for (let i = 0; i < tables.length; i++) {
        let table = tables[i];
        let fo;
        if (i === tourney.playerTableIdx) {
            fo = playerFinishOrder;
        } else {
            let mmrs = table.map(p => p.mmr || 1000);
            fo = simulateBotTable(mmrs);
        }

        let result = classifyTableResult(fo);

        // Only apply scores if phase is scored (not practice rounds R1-3)
        if (phase.scored) {
            for (let w of result.winners) {
                let p = table[w];
                let sd = SCORE_48[result.winType] || 0;
                let md = MMR_48[result.winType] || 0;
                p.score = (p.score || 0) + sd;
                p.mmr = (p.mmr || 1000) + md;
            }
            for (let l of result.losers) {
                let p = table[l];
                let sd = SCORE_48[result.loseType] || 0;
                let md = MMR_48[result.loseType] || 0;
                p.score = (p.score || 0) + sd;
                p.mmr = (p.mmr || 1000) + md;
            }
        }

        allResults.push({
            tableNum: i + 1,
            players: table.map((p, idx) => ({
                nickname: p.nickname,
                pos: fo.indexOf(idx) + 1
            })),
            winType: result.winType,
            winners: result.winners.map(w => table[w].nickname),
            losers: result.losers.map(l => table[l].nickname)
        });
    }

    // Elimination: only in elimination phase (R10+)
    let eliminated = [];
    if (phase.elimination) {
        let activeP = tourney.players.filter(p => !p.eliminated);
        if (activeP.length > 8) {
            activeP.sort((a, b) => (a.score || 0) - (b.score || 0));
            let toElim = activeP.slice(0, 4);
            for (let p of toElim) {
                p.eliminated = true;
                p.eliminatedRound = tourney.currentRound;
                eliminated.push({ nickname: p.nickname, score: p.score });
            }
        }
    }

    // Check if tournament is over
    let remainActive = tourney.players.filter(p => !p.eliminated);
    if (tourney.currentRound >= tourney.totalRounds || remainActive.length <= 4) {
        tourney.status = 'finished';
    }

    saveTournament(tourney);

    // Compute standings
    let standings = getArena48Standings(tourney);
    let humanPlayer = tourney.players.find(p => p.isHuman);
    let humanRank = standings.findIndex(s => s.nickname === humanPlayer.nickname) + 1;

    let elapsed = tourney.startedAt ? Math.floor((Date.now() - tourney.startedAt) / 1000) : 0;

    // Send round results to player
    socket.emit('arena48RoundResults', {
        round: tourney.currentRound,
        totalRounds: tourney.totalRounds,
        tables: allResults,
        standings: standings.slice(0, 20),
        myRank: humanRank,
        myScore: humanPlayer.score,
        eliminated: eliminated,
        isEliminated: !!humanPlayer.eliminated,
        tournamentOver: tourney.status === 'finished',
        totalActive: remainActive.length,
        phase: phase.name,
        scored: phase.scored,
        elapsedSeconds: elapsed
    });

    // Broadcast to dashboard
    let changes = [];
    for (let p of tourney.players) {
        changes.push({ nickname: p.nickname, scoreDelta: 0, newScore: p.score || 0, mmrDelta: 0, newMmr: p.mmr || 1000 });
    }
    io.to('dashboard:' + tourney.code).emit('scoreUpdate', { round: tourney.currentRound, changes });
    if (eliminated.length > 0) {
        io.to('dashboard:' + tourney.code).emit('elimination', { round: tourney.currentRound, eliminated });
    }

    gameLog(`[Arena48] ${tourney.code}: Round ${tourney.currentRound} complete, rank=${humanRank}, score=${humanPlayer.score}, eliminated=${eliminated.length}`);

    // Auto-continue if human is eliminated — run remaining rounds with bots only
    if (humanPlayer.eliminated && tourney.status === 'active') {
        setTimeout(() => autoRunBotRound(socket, tourney), 3000);
    }
}

/**
 * Auto-run a bot-only round after human is eliminated.
 * Simulates all tables instantly, broadcasts to dashboard, repeats until finished.
 */
function autoRunBotRound(socket, tourney) {
    if (tourney.status !== 'active') return;

    tourney.currentRound++;
    let phase = getPhase(tourney.currentRound, tourney.structure);
    let active = tourney.players.filter(p => !p.eliminated);

    if (active.length < 4 || tourney.currentRound > tourney.totalRounds) {
        tourney.status = 'finished';
        saveTournament(tourney);
        let standings = getArena48Standings(tourney);
        socket.emit('arena48TournamentEnd', { finalStandings: standings });
        io.to('dashboard:' + tourney.code).emit('tournamentEnd', { standings });
        gameLog(`[Arena48] ${tourney.code}: Tournament finished!`);
        return;
    }

    // Pair and simulate all tables
    active.sort((a, b) => (b.mmr || 1000) - (a.mmr || 1000));
    let tables = [];
    for (let i = 0; i < active.length - 3; i += 4) tables.push(active.slice(i, i + 4));

    let changes = [];
    for (let table of tables) {
        let mmrs = table.map(p => p.mmr || 1000);
        let fo = simulateBotTable(mmrs);
        let result = classifyTableResult(fo);
        if (phase.scored) {
            for (let w of result.winners) {
                let p = table[w];
                p.score = (p.score || 0) + (SCORE_48[result.winType] || 0);
                p.mmr = (p.mmr || 1000) + (MMR_48[result.winType] || 0);
            }
            for (let l of result.losers) {
                let p = table[l];
                p.score = (p.score || 0) + (SCORE_48[result.loseType] || 0);
                p.mmr = (p.mmr || 1000) + (MMR_48[result.loseType] || 0);
            }
        }
    }

    // Elimination
    let eliminated = [];
    if (phase.elimination) {
        let activeP = tourney.players.filter(p => !p.eliminated);
        if (activeP.length > 8) {
            activeP.sort((a, b) => (a.score || 0) - (b.score || 0));
            let toElim = activeP.slice(0, 4);
            for (let p of toElim) {
                p.eliminated = true;
                p.eliminatedRound = tourney.currentRound;
                eliminated.push({ nickname: p.nickname, score: p.score });
            }
        }
    }

    let remainActive = tourney.players.filter(p => !p.eliminated);
    if (tourney.currentRound >= tourney.totalRounds || remainActive.length <= 4) {
        tourney.status = 'finished';
    }
    saveTournament(tourney);

    // Broadcast to dashboard
    for (let p of tourney.players) {
        changes.push({ nickname: p.nickname, scoreDelta: 0, newScore: p.score || 0, mmrDelta: 0, newMmr: p.mmr || 1000 });
    }
    io.to('dashboard:' + tourney.code).emit('scoreUpdate', { round: tourney.currentRound, changes });
    io.to('dashboard:' + tourney.code).emit('roundStart', { round: tourney.currentRound, timer: 15, phase: phase.name, tables: [] });
    if (eliminated.length > 0) {
        io.to('dashboard:' + tourney.code).emit('elimination', { round: tourney.currentRound, eliminated });
    }

    // Send update to eliminated human watching
    let standings = getArena48Standings(tourney);
    let humanPlayer = tourney.players.find(p => p.isHuman);
    let humanRank = standings.findIndex(s => s.nickname === humanPlayer.nickname) + 1;
    let elapsed = tourney.startedAt ? Math.floor((Date.now() - tourney.startedAt) / 1000) : 0;
    socket.emit('arena48RoundResults', {
        round: tourney.currentRound, totalRounds: tourney.totalRounds,
        tables: [], standings: standings.slice(0, 20),
        myRank: humanRank, myScore: humanPlayer.score,
        eliminated, isEliminated: true,
        tournamentOver: tourney.status === 'finished',
        totalActive: remainActive.length,
        phase: phase.name, scored: phase.scored, elapsedSeconds: elapsed,
        autoRound: true
    });

    gameLog(`[Arena48] ${tourney.code}: Auto R${tourney.currentRound} [${phase.name}], ${remainActive.length} active, ${eliminated.length} eliminated`);

    // Continue after delay (3s per round for spectating feel)
    if (tourney.status === 'active') {
        setTimeout(() => autoRunBotRound(socket, tourney), 3000);
    } else {
        socket.emit('arena48TournamentEnd', { finalStandings: standings });
    }
}

function getArena48Standings(tourney) {
    let active = tourney.players.filter(p => !p.eliminated)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map((p, i) => ({ nickname: p.nickname, score: p.score || 0, mmr: p.mmr || 1000, rank: i + 1, eliminated: false }));
    let elim = tourney.players.filter(p => p.eliminated)
        .sort((a, b) => (b.eliminatedRound || 0) - (a.eliminatedRound || 0) || (b.score || 0) - (a.score || 0))
        .map((p, i) => ({ nickname: p.nickname, score: p.score || 0, mmr: p.mmr || 1000, rank: active.length + i + 1, eliminated: true, eliminatedRound: p.eliminatedRound }));
    return [...active, ...elim];
}

// ===== Demo: All-Bot Tournament =====
app.post('/api/demo/start', (req, res) => {
    let requestedCount = (req.body && req.body.playerCount) || 48;
    let structure = calcTournamentStructure(requestedCount);
    let pc = structure.playerCount;

    let code = 'D' + Math.random().toString(36).substr(2, 5).toUpperCase();
    while (tournaments[code]) code = 'D' + Math.random().toString(36).substr(2, 5).toUpperCase();

    let botPool = [...BOT_NAMES_48];
    while (botPool.length < pc) botPool.push('Bot_' + (botPool.length + 1));
    let shuffled = botPool.sort(() => Math.random() - 0.5).slice(0, pc);

    let players = shuffled.map(name => ({ nickname: name, score: 0, mmr: 1000, eliminated: false, isHuman: false }));

    let tourney = {
        code, name: 'Demo ' + pc + '人锦标赛', players,
        currentRound: 0, totalRounds: structure.totalRounds,
        status: 'active', format: 'mtt', isDemo: true,
        refereePin: '0000',
        tables: [], startedAt: Date.now(),
        structure: structure,
        createdAt: new Date().toISOString()
    };
    tournaments[code] = tourney;
    saveTournament(tourney);
    gameLog(`[Demo] Created ${pc}-player demo tournament ${code}`);

    // Auto-run rounds with delay
    setTimeout(() => runDemoRound(tourney), 2000);

    res.json({ code, name: tourney.name, playerCount: pc, totalRounds: structure.totalRounds });
});

function runDemoRound(tourney) {
    if (tourney.status !== 'active') return;

    tourney.currentRound++;
    let phase = getPhase(tourney.currentRound, tourney.structure);
    let active = tourney.players.filter(p => !p.eliminated);

    if (active.length < 4 || tourney.currentRound > tourney.totalRounds) {
        tourney.status = 'finished';
        saveTournament(tourney);
        let standings = getArena48Standings(tourney);
        io.to('dashboard:' + tourney.code).emit('tournamentEnd', { standings });
        gameLog(`[Demo] ${tourney.code}: Tournament finished!`);
        return;
    }

    // MMR-based pairing
    active.sort((a, b) => (b.mmr || 1000) - (a.mmr || 1000));
    let tables = [];
    for (let i = 0; i < active.length - 3; i += 4) tables.push(active.slice(i, i + 4));

    let tableInfo = tables.map((t, i) => ({
        tableNum: i + 1,
        team1: [t[0].nickname, t[2] ? t[2].nickname : ''],
        team2: [t[1].nickname, t[3] ? t[3].nickname : ''],
        players: t.map(p => ({ nickname: p.nickname, mmr: p.mmr || 1000 }))
    }));

    // Broadcast round start
    io.to('dashboard:' + tourney.code).emit('roundStart', {
        round: tourney.currentRound, timer: 10, phase: phase.name, tables: tableInfo
    });

    // Simulate all tables
    for (let table of tables) {
        let mmrs = table.map(p => p.mmr || 1000);
        let fo = simulateBotTable(mmrs);
        let result = classifyTableResult(fo);
        if (phase.scored) {
            for (let w of result.winners) {
                let p = table[w];
                p.score = (p.score || 0) + (SCORE_48[result.winType] || 0);
                p.mmr = (p.mmr || 1000) + (MMR_48[result.winType] || 0);
            }
            for (let l of result.losers) {
                let p = table[l];
                p.score = (p.score || 0) + (SCORE_48[result.loseType] || 0);
                p.mmr = (p.mmr || 1000) + (MMR_48[result.loseType] || 0);
            }
        }
    }

    // Elimination
    let eliminated = [];
    if (phase.elimination) {
        let activeP = tourney.players.filter(p => !p.eliminated);
        if (activeP.length > 8) {
            activeP.sort((a, b) => (a.score || 0) - (b.score || 0));
            let toElim = activeP.slice(0, 4);
            for (let p of toElim) {
                p.eliminated = true;
                p.eliminatedRound = tourney.currentRound;
                eliminated.push({ nickname: p.nickname, score: p.score });
            }
        }
    }

    let remainActive = tourney.players.filter(p => !p.eliminated);
    if (tourney.currentRound >= tourney.totalRounds || remainActive.length <= 4) {
        tourney.status = 'finished';
    }
    saveTournament(tourney);

    // Broadcast scores
    let changes = tourney.players.map(p => ({
        nickname: p.nickname, scoreDelta: 0, newScore: p.score || 0, mmrDelta: 0, newMmr: p.mmr || 1000
    }));
    io.to('dashboard:' + tourney.code).emit('scoreUpdate', { round: tourney.currentRound, changes });
    if (eliminated.length > 0) {
        io.to('dashboard:' + tourney.code).emit('elimination', { round: tourney.currentRound, eliminated });
    }

    gameLog(`[Demo] ${tourney.code}: R${tourney.currentRound} [${phase.name}], ${remainActive.length} active, ${eliminated.length} elim`);

    // Continue or finish
    if (tourney.status === 'active') {
        setTimeout(() => runDemoRound(tourney), 3000);
    } else {
        let standings = getArena48Standings(tourney);
        io.to('dashboard:' + tourney.code).emit('tournamentEnd', { standings });
        gameLog(`[Demo] ${tourney.code}: Tournament finished!`);
    }
}

// ═══ Volcengine ASR HTTP API ═══
// Accept raw PCM body (not multipart)
app.post('/api/asr', express.raw({ type: 'application/octet-stream', limit: '5mb' }), (req, res) => {
    const pcmData = req.body;
    if (!pcmData || pcmData.length === 0) return res.json({ text: '' });

    console.log(`[ASR] Received ${(pcmData.length/1024).toFixed(1)}KB PCM`);

    const connectId = Date.now().toString(36) + Math.random().toString(36).substr(2,6);
    const volcWs = new WebSocket(VOLC_ASR_URL, {
        headers: {
            'X-Api-Key': VOLC_ASR_KEY,
            'X-Api-Resource-Id': VOLC_RESOURCE_ID,
            'X-Api-Connect-Id': connectId,
        }
    });

    let finalText = '';
    let responded = false;
    const timeout = setTimeout(() => {
        if (!responded) { responded = true; res.json({ text: finalText }); }
        try { volcWs.close(); } catch(e){}
    }, 10000);

    volcWs.on('open', () => {
        // Send config
        const config = JSON.stringify({
            header: { appid: 'default', namespace: 'SeedASR', connect_id: connectId },
            payload: {
                user: { uid: 'dandan' },
                audio: { format: 'pcm', rate: 16000, bits: 16, channel: 1, codec: 'raw' },
                request: { model_name: 'bigmodel', enable_punc: true, enable_itn: true, result_type: 'full' }
            }
        });
        const configBuf = Buffer.from(config);
        const header1 = Buffer.from([0x11, 0x10, 0x10, 0x00]);
        const size1 = Buffer.alloc(4); size1.writeUInt32BE(configBuf.length);
        volcWs.send(Buffer.concat([header1, size1, configBuf]));

        // Send audio in chunks
        const CHUNK = 6400; // 200ms at 16kHz 16bit mono
        for (let i = 0; i < pcmData.length; i += CHUNK) {
            const isLast = (i + CHUNK >= pcmData.length);
            const chunk = pcmData.slice(i, i + CHUNK);
            const headerByte = isLast ? 0x22 : 0x20;
            const header2 = Buffer.from([0x11, headerByte, 0x00, 0x00]);
            const size2 = Buffer.alloc(4); size2.writeUInt32BE(chunk.length);
            volcWs.send(Buffer.concat([header2, size2, chunk]));
        }
    });

    volcWs.on('message', (data) => {
        try {
            // Parse: skip 8 byte header, rest is JSON
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
            if (buf.length <= 8) return;
            const json = JSON.parse(buf.slice(8).toString('utf8'));
            const text = json?.payload?.result?.text || json?.result?.text || '';
            if (text) finalText = text;

            // Check if final
            const isFinal = json?.payload?.result?.utterances?.some(u => u.definite) ||
                           json?.is_final || false;
            if (isFinal || (json?.payload?.result?.type === 'final')) {
                console.log(`[ASR] Final: "${finalText}"`);
                if (!responded) { responded = true; clearTimeout(timeout); res.json({ text: finalText }); }
                volcWs.close();
            }
        } catch(e) {
            console.error('[ASR] Parse error:', e.message);
        }
    });

    volcWs.on('error', (e) => {
        console.error('[ASR] WS error:', e.message);
        if (!responded) { responded = true; clearTimeout(timeout); res.json({ text: '' }); }
    });

    volcWs.on('close', () => {
        if (!responded) { responded = true; clearTimeout(timeout); res.json({ text: finalText }); }
    });
});

// ═══ Volcengine ASR WebSocket Proxy ═══
// Browser can't set WS headers, so we proxy: Browser → Server → Volcengine
const WebSocket = require('ws');
const wss = new WebSocket.Server({ noServer: true });
const VOLC_ASR_URL = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel';
const VOLC_ASR_KEY = '8280548b-9c87-424c-ba77-238ea3d9f806';
const VOLC_RESOURCE_ID = 'volc.bigasr.sauc.duration';

http.on('upgrade', (request, socket, head) => {
    if (request.url === '/asr') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    }
    // Let socket.io handle its own upgrades (it does this automatically)
});

wss.on('connection', (clientWs) => {
    console.log('[ASR Proxy] Client connected');
    const connectId = Math.random().toString(36).substr(2, 12);

    // Connect to Volcengine with proper auth headers
    const volcWs = new WebSocket(VOLC_ASR_URL, {
        headers: {
            'X-Api-Key': VOLC_ASR_KEY,
            'X-Api-Resource-Id': VOLC_RESOURCE_ID,
            'X-Api-Connect-Id': connectId,
        }
    });
    volcWs.binaryType = 'arraybuffer';

    let volcReady = false;
    let pendingMessages = [];

    volcWs.on('open', () => {
        console.log('[ASR Proxy] Connected to Volcengine');
        volcReady = true;
        // Send any pending messages
        pendingMessages.forEach(msg => volcWs.send(msg));
        pendingMessages = [];
    });

    volcWs.on('message', (data) => {
        // Forward Volcengine responses to browser
        if (clientWs.readyState === 1) {
            clientWs.send(data);
        }
    });

    volcWs.on('error', (e) => {
        console.error('[ASR Proxy] Volcengine error:', e.message);
    });

    volcWs.on('close', () => {
        console.log('[ASR Proxy] Volcengine disconnected');
        if (clientWs.readyState === 1) clientWs.close();
    });

    // Forward browser audio to Volcengine
    clientWs.on('message', (data) => {
        if (volcReady && volcWs.readyState === 1) {
            volcWs.send(data);
        } else {
            pendingMessages.push(data);
        }
    });

    clientWs.on('close', () => {
        console.log('[ASR Proxy] Client disconnected');
        if (volcWs.readyState === 1) volcWs.close();
    });
});

// ================================================================
// 🧠 DeepSeek V4 · IELTS AI 题库生成（Crayxus AI 提分系统）
// ================================================================
const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY || 'sk-276a520fe06a4d12a5480b20ea8ee1d7';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';  // 最新 V4

const IELTS_DIMS = {
    listening:  '听力 (Listening) · Form filling / Map labelling / MCQ / Note completion',
    speaking:   '口语 (Speaking) · Part 1/2/3 · Coherence / Lexical Resource / Fluency',
    reading:    '阅读 (Reading) · True-False-Not Given / Matching Headings / Paraphrasing',
    writing:    '写作 (Writing) · Task 1 图表描述 / Task 2 议论文 · Structure / Cohesion',
    vocabulary: '词汇 (Vocabulary) · Academic Word List / Collocations / Register',
    grammar:    '语法 (Grammar) · Tense / Voice / Relative clauses / Conditionals'
};

app.post('/api/ai/ielts/generate', async (req, res) => {
    try {
        const { dim = 'listening', difficulty = 2, count = 5, mastery = 50 } = req.body || {};
        if (!IELTS_DIMS[dim]) {
            return res.status(400).json({ error: 'invalid dim', valid: Object.keys(IELTS_DIMS) });
        }

        const dimDesc = IELTS_DIMS[dim];
        const band = mastery < 40 ? '5.0-5.5' : mastery < 60 ? '5.5-6.5' : mastery < 80 ? '6.5-7.5' : '7.5-8.5';

        const isListening = (dim === 'listening');
        const listeningNote = isListening ? `

【特别要求 · 听力题必须符合真实考试形式】
- 必须包含 audio_script 字段：一段要朗读的英文对白或独白（40-100 词），模拟雅思听力音频
- q 字段只写问题本身，禁止写"You hear a conversation about..."或复述音频内容
- 选项不要透露音频内容，必须让学生真正听音频才能答对
- audio_script 要自然对话或独白，不要舞台说明文字` : '';

        const schemaField = isListening ?
            `"audio_script": "40-100 词的英文对白/独白，将被 TTS 朗读",
      "audio_speaker": "single | dialogue",
      "audio_duration": 12,
      ` : '';

        const prompt = `你是雅思考试 (IELTS Academic) 资深命题专家。请生成 ${count} 道**高质量的雅思训练题**。

【要求】
- 维度：${dimDesc}
- 难度等级：${difficulty} (1=基础, 2=中等, 3=进阶)
- 学员当前水平：Band ${band}（掌握度 ${mastery}/100）
- 每题 4 个选项（A/B/C/D），只有一个正确
- 避免和标准题库重复，出题角度要新颖${listeningNote}

【输出 JSON 格式】（严格按此结构）
{
  "questions": [
    {
      "id": "ai_${Date.now()}_1",
      "dim": "${dim}",
      "lesson": "简短考点标签",
      "difficulty": ${difficulty},
      ${schemaField}"q": "题干，听力题写问题本身不要复述音频",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": 0,
      "solution": "中文讲解 2-3 句"
    }
  ]
}

只输出 JSON，不要额外文字。`;

        const r = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + DEEPSEEK_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: DEEPSEEK_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.85,
                response_format: { type: 'json_object' },
                max_tokens: 2400
            })
        });

        if (!r.ok) {
            const txt = await r.text();
            console.error('[DeepSeek] HTTP', r.status, txt.slice(0, 300));
            return res.status(502).json({ error: 'deepseek_http_error', status: r.status });
        }

        const data = await r.json();
        const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!content) {
            return res.status(502).json({ error: 'empty_completion' });
        }

        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (e) {
            console.error('[DeepSeek] JSON parse fail:', content.slice(0, 300));
            return res.status(502).json({ error: 'bad_json', raw: content.slice(0, 400) });
        }

        const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
        if (questions.length === 0) {
            return res.status(502).json({ error: 'no_questions' });
        }

        // 补全缺失字段 + 去除危险字段
        const clean = questions.map((q, i) => {
            const obj = {
                id: q.id || `ai_${Date.now()}_${i}`,
                dim: dim,
                lesson: String(q.lesson || '').slice(0, 40),
                difficulty: Number(q.difficulty) || difficulty,
                q: String(q.q || '').slice(0, 500),
                options: Array.isArray(q.options) ? q.options.slice(0, 4).map(o => String(o).slice(0, 200)) : [],
                answer: Math.max(0, Math.min(3, Number(q.answer) || 0)),
                solution: String(q.solution || '').slice(0, 400),
                aiGenerated: true
            };
            if (dim === 'listening' && q.audio_script) {
                obj.audio_script = String(q.audio_script).slice(0, 600);
                obj.audio_speaker = (q.audio_speaker === 'dialogue') ? 'dialogue' : 'single';
                obj.audio_duration = Math.max(8, Math.min(40, Number(q.audio_duration) || 12));
            }
            return obj;
        }).filter(q => q.q && q.options.length === 4);

        gameLog(`[AI-IELTS] Generated ${clean.length} questions for dim=${dim} band=${band} mastery=${mastery}`);
        res.json({ ok: true, questions: clean, model: DEEPSEEK_MODEL, band });
    } catch (err) {
        console.error('[AI-IELTS] Error:', err.message);
        res.status(500).json({ error: 'internal_error', message: err.message });
    }
});

// 🧠 DeepSeek 通用调用辅助
async function callDeepSeek(prompt, maxTokens = 3000, temperature = 0.85) {
    const r = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + DEEPSEEK_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature,
            response_format: { type: 'json_object' },
            max_tokens: maxTokens
        })
    });
    if (!r.ok) {
        const txt = await r.text();
        throw new Error(`DeepSeek HTTP ${r.status}: ${txt.slice(0, 200)}`);
    }
    const data = await r.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error('empty_completion');
    return JSON.parse(content);
}

// ================================================================
// 🎯 雅思 · 定级测评 · 20 题覆盖 6 维
// ================================================================
app.post('/api/ai/ielts/assess', async (req, res) => {
    try {
        const prompt = `你是雅思考试 (IELTS Academic) 资深命题专家。请生成 **20 道定级测评题**，用于快速判定学员水平。

【要求】
- 6 个维度均衡覆盖（每维至少 3 题）：listening / speaking / reading / writing / vocabulary / grammar
- 难度混合：6 道简单(difficulty=1)、10 道中等(difficulty=2)、4 道进阶(difficulty=3)
- 每题 4 个选项，只有一个正确
- 出题角度要新颖、多样，覆盖典型考点

【听力题特殊要求】
- listening 维度的题必须附带 audio_script 字段：40-100 词的英文对白或独白（模拟真实音频）
- q 字段只写问题本身，不要复述音频内容
- 选项不要透露音频内容，学生必须真正"听"音频才能答对
- audio_speaker: "single" 或 "dialogue"
- audio_duration: 预计朗读秒数（10-30）

【维度提示】
- listening: Form filling / Map labelling / MCQ / Note completion
- speaking: Part 1/2/3 · Coherence / Lexical / Fluency
- reading: TFNG / Matching Headings / Paraphrasing
- writing: Task 1 图表 / Task 2 议论 · Structure
- vocabulary: Academic Word List / Collocations
- grammar: Tense / Voice / Relative clauses / Conditionals

【输出 JSON 格式】严格：
{
  "questions": [
    {
      "id": "ai_assess_1",
      "dim": "listening|speaking|reading|writing|vocabulary|grammar",
      "lesson": "简短考点标签",
      "difficulty": 1,
      "audio_script": "仅 listening 题需要，其他科目省略此字段",
      "audio_speaker": "single",
      "audio_duration": 12,
      "q": "题干",
      "options": ["A", "B", "C", "D"],
      "answer": 0,
      "solution": "中文讲解 2-3 句"
    }
  ]
}

只输出 JSON，不要额外文字。`;

        const parsed = await callDeepSeek(prompt, 4800, 0.85);
        const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

        const validDims = ['listening','speaking','reading','writing','vocabulary','grammar'];
        const clean = questions.map((q, i) => {
            const dim = validDims.includes(q.dim) ? q.dim : 'listening';
            const obj = {
                id: q.id || `ai_assess_${Date.now()}_${i}`,
                dim: dim,
                lesson: String(q.lesson || '').slice(0, 40),
                difficulty: Math.max(1, Math.min(3, Number(q.difficulty) || 2)),
                q: String(q.q || '').slice(0, 500),
                options: Array.isArray(q.options) ? q.options.slice(0, 4).map(o => String(o).slice(0, 200)) : [],
                answer: Math.max(0, Math.min(3, Number(q.answer) || 0)),
                solution: String(q.solution || '').slice(0, 400),
                aiGenerated: true
            };
            if (dim === 'listening' && q.audio_script) {
                obj.audio_script = String(q.audio_script).slice(0, 600);
                obj.audio_speaker = (q.audio_speaker === 'dialogue') ? 'dialogue' : 'single';
                obj.audio_duration = Math.max(8, Math.min(40, Number(q.audio_duration) || 12));
            }
            return obj;
        }).filter(q => q.q && q.options.length === 4);

        gameLog(`[AI-IELTS-ASSESS] Generated ${clean.length}/20 questions`);
        res.json({ ok: true, questions: clean, model: DEEPSEEK_MODEL });
    } catch (err) {
        console.error('[AI-IELTS-ASSESS] Error:', err.message);
        res.status(500).json({ error: 'internal_error', message: err.message });
    }
});

// ================================================================
// 🎯 雅思 · 匹配度测评 · 10 题学习人格
// ================================================================
app.post('/api/ai/ielts/match', async (req, res) => {
    try {
        const prompt = `你是 Crayxus AI 教育心理学家。生成 **10 道匹配度测评题**，判定一位准备考雅思的学生的学习人格和系统匹配度。

【要求】
- 每题围绕一个维度：学习动机 / 时间投入 / 自驱力 / 专注耐力 / 竞争意识 / 奖励敏感 / 计划性 / 数据倾向 / 纠错执行 / 长期承诺
- 题目要**针对雅思备考场景**（而不是泛泛而谈），让学生感到"这题懂我"
- 每题 4 个选项，按"匹配度高低"排序打分（5/4/3/2）
- 题目简短直白，每题 20-40 字
- 选项生动具体，不要"同意/不同意"这种敷衍选项

【输出 JSON 格式】严格：
{
  "questions": [
    {
      "id": "ai_match_1",
      "dim": "学习动机",
      "title": "题干（雅思场景化）",
      "options": [
        { "text": "选项 A", "score": 5 },
        { "text": "选项 B", "score": 4 },
        { "text": "选项 C", "score": 3 },
        { "text": "选项 D", "score": 2 }
      ]
    }
  ]
}

10 个维度每题一个，顺序对应。只输出 JSON，不要额外文字。`;

        const parsed = await callDeepSeek(prompt, 3200, 0.85);
        const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

        const clean = questions.map((q, i) => ({
            dim: String(q.dim || '').slice(0, 20),
            title: String(q.title || '').slice(0, 200),
            options: Array.isArray(q.options) ? q.options.slice(0, 4).map(o => ({
                text: String(o.text || o).slice(0, 120),
                score: Math.max(1, Math.min(5, Number(o.score) || 3))
            })) : []
        })).filter(q => q.title && q.options.length === 4);

        gameLog(`[AI-IELTS-MATCH] Generated ${clean.length}/10 questions`);
        res.json({ ok: true, questions: clean, model: DEEPSEEK_MODEL });
    } catch (err) {
        console.error('[AI-IELTS-MATCH] Error:', err.message);
        res.status(500).json({ error: 'internal_error', message: err.message });
    }
});

// ================================================================
// 🔊 Volcengine Seed-TTS 2.0 · 雅思听力音频生成（v3 bidirectional WS）
// ================================================================
const VOLC_TTS_APP_ID     = process.env.VOLC_TTS_APP_ID     || '2111776371';
const VOLC_TTS_ACCESS_KEY = process.env.VOLC_TTS_ACCESS_KEY || '718510c3-3096-460d-9973-5d15f8c9e372';
const VOLC_TTS_WS_URL     = 'wss://openspeech.bytedance.com/api/v3/tts/bidirection';
const VOLC_TTS_RESOURCE   = 'seed-tts-2.0';

// 内存 LRU 缓存
const ttsCache = new Map();
const TTS_CACHE_MAX = 200;
function ttsCacheKey(text, voice) { return voice + ':' + text; }
function ttsCacheGet(key) {
    if (!ttsCache.has(key)) return null;
    const v = ttsCache.get(key);
    ttsCache.delete(key); ttsCache.set(key, v);
    return v;
}
function ttsCacheSet(key, val) {
    if (ttsCache.size >= TTS_CACHE_MAX) {
        const firstKey = ttsCache.keys().next().value;
        ttsCache.delete(firstKey);
    }
    ttsCache.set(key, val);
}

// 音色映射（Volcengine 音色 ID，中文音色 + explicit_language=en 可输出英文）
const TTS_VOICES = {
    'en-female': 'zh_female_shuangkuaisisi_moon_bigtts',
    'en-male':   'zh_male_M392_conversation_wvae_bigtts',
    'us-female': 'zh_female_shuangkuaisisi_moon_bigtts',
    'us-male':   'zh_male_M392_conversation_wvae_bigtts'
};
const TTS_FALLBACK_VOICE = 'zh_female_shuangkuaisisi_moon_bigtts';

// 构造 Volc 二进制帧：[11][type][ser|comp][rsv][size:4][payload]
function buildFrame(msgTypeFlags, payload) {
    const header = Buffer.from([0x11, msgTypeFlags, 0x10, 0x00]); // ver1, JSON ser, no compress
    const payloadBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const sizeBuf = Buffer.alloc(4);
    sizeBuf.writeUInt32BE(payloadBuf.length);
    return Buffer.concat([header, sizeBuf, payloadBuf]);
}

// 核心：调用 Volc TTS WebSocket 返回完整 MP3
function callVolcTTS(text, voiceType) {
    return new Promise((resolve, reject) => {
        if (!VOLC_TTS_APP_ID || !VOLC_TTS_ACCESS_KEY) {
            return reject(new Error('tts_not_configured'));
        }
        const reqid = 'crayxus_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        let ws;
        try {
            // 新版控制台只需 X-Api-Key 鉴权（文档明确："新版控制台只需要 X-Api-Key 即可"）
            const headers = {
                'X-Api-Key':         VOLC_TTS_ACCESS_KEY,
                'X-Api-Resource-Id': VOLC_TTS_RESOURCE,
                'X-Api-Request-Id':  reqid
            };
            console.log('[TTS] Connect URL:', VOLC_TTS_WS_URL);
            console.log('[TTS] Headers:', JSON.stringify({ ...headers, 'X-Api-Key': VOLC_TTS_ACCESS_KEY.slice(0,8)+'...' }));
            ws = new WebSocket(VOLC_TTS_WS_URL, { headers });

            // 捕获握手阶段的完整 HTTP 响应（关键诊断信息）
            ws.on('unexpected-response', (req, response) => {
                let body = '';
                response.on('data', (chunk) => { body += chunk.toString(); });
                response.on('end', () => {
                    console.error('[TTS] 401 response headers:', JSON.stringify(response.headers));
                    console.error('[TTS] 401 response body:', body.slice(0, 500));
                    if (!finished) {
                        finished = true;
                        clearTimeout(timer);
                        reject(new Error(`volc_${response.statusCode}: ${body.slice(0, 200)}`));
                    }
                });
            });
        } catch (e) {
            return reject(e);
        }

        const audioChunks = [];
        let finished = false;
        const timer = setTimeout(() => {
            if (!finished) {
                finished = true;
                try { ws.close(); } catch(e){}
                reject(new Error('tts_timeout'));
            }
        }, 45000);

        ws.on('open', () => {
            const payload = JSON.stringify({
                user: { uid: 'crayxus' },
                event: 100,
                req_params: {
                    text,
                    speaker: voiceType,
                    audio_params: { format: 'mp3', sample_rate: 24000 },
                    additions: { explicit_language: 'en' }
                }
            });
            ws.send(buildFrame(0x10, payload));
        });

        ws.on('message', (data) => {
            try {
                const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
                if (buf.length < 8) return;
                // 解析头部
                const msgType = buf[1];
                const serType = (buf[2] >> 4) & 0x0f;
                // const size = buf.readUInt32BE(4);  // payload size, not always needed
                const payload = buf.slice(8);

                // 0x20-0x2F = server response（含事件号）
                // 音频帧通常是 serType == 0 (binary) 的消息
                if (serType === 0) {
                    // 二进制音频块
                    audioChunks.push(payload);
                } else {
                    // JSON 消息（task started / finished / error）
                    const json = JSON.parse(payload.toString('utf8'));
                    const event = json.event;
                    if (event === 353 || event === 152) {
                        // 任务完成
                        if (!finished) {
                            finished = true;
                            clearTimeout(timer);
                            try { ws.close(); } catch(e){}
                            if (audioChunks.length === 0) {
                                return reject(new Error('no_audio_received'));
                            }
                            resolve(Buffer.concat(audioChunks));
                        }
                    } else if (event >= 400) {
                        // 错误
                        if (!finished) {
                            finished = true;
                            clearTimeout(timer);
                            try { ws.close(); } catch(e){}
                            reject(new Error('volc_event_' + event + ': ' + (json.message || 'unknown')));
                        }
                    }
                }
            } catch (e) {
                console.error('[TTS] parse error:', e.message);
            }
        });

        ws.on('error', (err) => {
            if (!finished) {
                finished = true;
                clearTimeout(timer);
                reject(err);
            }
        });

        ws.on('close', () => {
            if (!finished) {
                finished = true;
                clearTimeout(timer);
                if (audioChunks.length > 0) {
                    resolve(Buffer.concat(audioChunks));
                } else {
                    reject(new Error('ws_closed_without_audio'));
                }
            }
        });
    });
}

app.post('/api/ai/ielts/tts', async (req, res) => {
    try {
        const { text, voice = 'us-female' } = req.body || {};
        if (!text || typeof text !== 'string' || text.length < 5) {
            return res.status(400).json({ error: 'invalid_text' });
        }
        if (text.length > 600) {
            return res.status(400).json({ error: 'text_too_long', max: 600 });
        }

        const voiceType = TTS_VOICES[voice] || TTS_FALLBACK_VOICE;
        const cacheKey = ttsCacheKey(text, voiceType);
        const cached = ttsCacheGet(cacheKey);
        if (cached) {
            return res.json({ ok: true, audio: cached, cached: true });
        }

        if (!VOLC_TTS_APP_ID || !VOLC_TTS_ACCESS_KEY) {
            return res.status(503).json({
                error: 'tts_not_configured',
                hint: '需要在 Render 环境变量添加 VOLC_TTS_APP_ID 和 VOLC_TTS_ACCESS_KEY'
            });
        }

        const mp3Buf = await callVolcTTS(text, voiceType);
        const audioBase64 = mp3Buf.toString('base64');
        const dataUri = 'data:audio/mp3;base64,' + audioBase64;
        ttsCacheSet(cacheKey, dataUri);

        gameLog(`[TTS] Generated ${text.length} chars · voice=${voiceType} · mp3=${mp3Buf.length}B`);
        res.json({ ok: true, audio: dataUri, cached: false });
    } catch (err) {
        console.error('[TTS] Error:', err.message);
        res.status(502).json({ error: 'tts_failed', message: err.message });
    }
});

// ================================================================

http.listen(PORT, () => {
    gameLog(`Crayxus V43 (Tournament + ASR + IELTS-AI-Full + TTS ${DEEPSEEK_MODEL}) Running on port ${PORT}`);
});
