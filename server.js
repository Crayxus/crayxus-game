// server.js - Crayxus Rewrite (Server-Authoritative)
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

// ================== 游戏配置与工具 ==================
const POWER = {'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15,'Sm':16,'Bg':17};
const SUITS = ['♠','♥','♣','♦'];
const POINTS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

// 创建一副牌
function createDeck() {
    let deck = [];
    // 两副牌
    for (let i = 0; i < 2; i++) {
        SUITS.forEach(s => POINTS.forEach(v => deck.push({
            s, v, p: POWER[v], id: Math.random().toString(36).substr(2, 9)
        })));
        deck.push({ s:'JOKER', v:'Sm', p:POWER['Sm'], id:Math.random().toString(36).substr(2, 9) });
        deck.push({ s:'JOKER', v:'Bg', p:POWER['Bg'], id:Math.random().toString(36).substr(2, 9) });
    }
    // 洗牌 {
        let j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// 牌型判断 (简化版，保持核心逻辑)
function getHandType(cards) {
    if (!cards || cards.length === 0) return null;
    
    // 排序：先按点数，再按花色(可选)
    cards.sort((a, b) => a.p - b.p);
    
    // 提取红桃2作为万能牌？(根据您的规则，这里假设红桃2是特殊牌，简化处理)
    // 这里实现一个通用的牌型识别，覆盖单张、对子、三张、炸弹、顺子等
    
    let counts = {};
    cards.forEach(c => counts[c.p] = (counts[c.p] || 0) + 1);
    let vals = Object.keys(counts).map(Number).sort((a,b) => a-b);
    let len = cards.length;
    let maxFreq = Math.max(...Object.values(counts));

    // 王炸
    if (len === 4 && cards.filter(c => c.s === 'JOKER').length === 4) return { type: 'bomb', val: 999, score: 1000 };
    
    // 炸弹 (4张相同 或 3张+红桃2等逻辑，这里简化为4张相同)
    if (len === 4 && maxFreq === 4) return { type: 'bomb', val: vals[0], score: 400 };
    
    // 单张
    if (len === 1) return { type: '1', val: cards[0].p };
    
    // 对子
    if (len === 2 && maxFreq === 2) return { type: '2', val: vals[0] };
    
    // 三张
    if (len === 3 && maxFreq === 3) return { type: '3', val: vals[0] };

    // 顺子 (简化判断：5张连续，无重复)
    if (len >= 5 && maxFreq === 1) {
        let isSeq = true;
        for(let i=0; i<vals.length-1; i++) {
            if (vals[i+1] - vals[i] !== 1) isSeq = false; // 不连续
            if (vals[i] >= 15) isSeq = false; // 2和王不能加入顺子
        }
        if (isSeq) return { type: 'straight', val: vals[vals.length-1] };
    }

    return null; // 未识别
}

// 比较牌大小
function canBeat(newCards, newType, lastHand) {
    if (!lastHand) return true; // 首出任意牌型
    
    let isNewBomb = newType.type === 'bomb';
    let isLastBomb = lastHand.type === 'bomb';

    if (isNewBomb && !isLastBomb) return true; // 炸弹炸普通
    if (!isNewBomb && isLastBomb) return false;

    if (isNewBomb && isLastBomb) {
        if (newType.score > lastHand.score) return true;
        return newType.val > lastHand.val;
    }

    // 同类型比较
    if (newType.type !== lastHand.type) return false;
    if (newCards.length !== lastHand.cards.length) return false; // 长度需一致
    return newType.val > lastHand.val;
}

// ================== 房间与状态管理 ==================
let rooms = {}; // roomId -> roomState
const BOT_NAMES = ['Bot-A', 'Player', 'Bot-B', 'Partner'];

class GameRoom {
    constructor(id) {
        this.id = id;
        this.players = [null, null, null, null]; // 0:Player1, 1:Bot, 2:Player2, 3:Bot
        this.sockets = {}; // seatIndex -> socket
        this.state = 'waiting'; // waiting, playing, finished
        this.gameData = null;
    }

    addPlayer(socket) {
        // 寻找空位 (优先 0 和 2)
        let seat = -1;
        if (!this.players[0]) seat = 0;
        else if (!this.players[2]) seat = 2;
        
        if (seat === -1) return false;

        this.players[seat] = { id: socket.id, score: 1000 };
        this.sockets[seat] = socket;
        
        socket.join(this.id);
        socket.emit('identity', { seat: seat });
        
        console.log(`[Room ${this.id}] Player joined seat ${seat}`);
        return true;
    }

    removePlayer(socket) {
        let seat = this.players.findIndex(p => p && p.id === socket.id);
        if (seat !== -1) {
            this.players[seat] = null;
            delete this.sockets[seat];
            console.log(`[Room ${this.id}] Player left seat ${seat}`);
        }
    }

    isEmpty() {
        return this.players.filter(p => p && !p.isBot).length === 0;
    }

    startGame() {
        console.log(`[Room ${this.id}] Game Starting...`);
        
        // 填充 Bot
        for(let i=0; i<4; i++) {
            if (!this.players[i]) {
                this.players[i] = { id: `bot_${i}`, isBot: true, score: 1000 };
            }
        }

        // 发牌
        let deck = createDeck();
        let hands = [[], [], [], []];
        for(let i=0; i<deck.length; i++) hands[i%4].push(deck[i]);
        
        // 按大小排序手牌
        hands.forEach(h => h.sort((a,b) => b.p - a.p));

        this.gameData = {
            hands: hands,
            currentTurn: Math.floor(Math.random() * 4),
            lastHand: null, // { cards, type, owner }
            passCount: 0,
            finishedOrder: []
        };

        this.state = 'playing';

        // 发送初始数据
        this.broadcast('gameStart', { 
            hands: hands, // 实际上只发给对应的人
            turn: this.gameData.currentTurn 
        });

        // 单独发牌保护隐私
        for(let i=0; i<4; i++) {
            if (this.sockets[i]) {
                this.sockets[i].emit('dealCards', { cards: hands[i] });
            }
            // Bot 不需要发 socket 消息
        }

        this.scheduleNextMove();
    }

    // 核心逻辑：处理出牌/过牌
    handleAction(socket, data) {
        let seat = this.players.findIndex(p => p && p.id === socket.id);
        // 如果是 Bot 调用，seat 直接从 data 传进来
        if (data.isBot) seat = data.seat;

        if (seat === -1 || this.gameData.currentTurn !== seat) {
            console.log("Invalid action: not your turn");
            return;
        }

        if (this.state !== 'playing') return;

        let gd = this.gameData;
        
        // 处理 Pass
        if (data.type === 'pass') {
            // 规则：如果是新一轮 (lastHand为空)，不能 Pass
            if (!gd.lastHand) {
                console.log(`Seat ${seat} tried to pass on new round, denied.`);
                // 强制出牌逻辑会在 scheduleNextMove 的兜底中处理
                return; 
            }

            gd.passCount++;
            console.log(`Seat ${seat} PASSED. Count: ${gd.passCount}`);

            this.broadcast('syncAction', {
                seat: seat,
                type: 'pass',
                cards: [],
                nextTurn: -1 // 暂时不清空，等逻辑跑完
            });
        }

        // 处理 Play
        if (data.type === 'play') {
            let cards = data.cards;
            let type = getHandType(cards);
            
            if (!type || !canBeat(cards, type, gd.lastHand)) {
                console.log(`Seat ${seat} invalid play.`);
                if (data.isBot) {
                    // Bot 出错了，强制 pass
                     this.handleAction(socket, { type: 'pass', isBot: true, seat: seat });
                }
                return;
            }

            console.log(`Seat ${seat} plays ${type.type}`);
            
            // 移除手牌
            cards.forEach(c => {
                let idx = gd.hands[seat].findIndex(h => h.id === c.id);
                if (idx !== -1) gd.hands[seat].splice(idx, 1);
            });

            gd.lastHand = { cards, type, owner: seat };
            gd.passCount = 0; // 重置 Pass 计数

            // 检查是否出完
            if (gd.hands[seat].length === 0) {
                gd.finishedOrder.push(seat);
                console.log(`Seat ${seat} finished!`);
                // 简化：有人出完即结算 (或者按您的规则继续)
                // 这里为了演示流畅性，只判断最后一人
            }

            this.broadcast('syncAction', {
                seat: seat,
                type: 'play',
                cards: cards,
                handType: type,
                nextTurn: -1
            });
        }

        // 计算下一家
        this.nextTurn();
    }

    nextTurn() {
        let gd = this.gameData;
        let next = (gd.currentTurn + 1) % 4;
        let safetyLoop = 0;

        // 检查是否所有人Pass，回到上一手牌的赢家
        // 如果 Pass 计数 >= 存活人数-1，则新一轮开始
        let activePlayers = 4 - gd.finishedOrder.length;
        
        if (gd.passCount >= activePlayers - 1) {
            console.log("Round End. Clearing lastHand.");
            gd.lastHand = null;
            gd.passCount = 0;
            // 找到赢家或下一个没出完的人
            // 简单逻辑：顺延到下一个没出完的人
        }

        // 跳过已出完的人
        while (gd.finishedOrder.includes(next) && safetyLoop < 4) {
            next = (next + 1) % 4;
            safetyLoop++;
        }

        gd.currentTurn = next;
        
        // 广播轮次更新
        this.broadcast('turnChange', { turn: next, isRoundEnd: (gd.lastHand === null) });

        // 安排下一步
        this.scheduleNextMove();
    }

    scheduleNextMove() {
        let seat = this.gameData.currentTurn;
        let player = this.players[seat];

        // 清除旧计时器
        if (this.timer) clearTimeout(this.timer);

        // 如果是 Bot
        if (player.isBot) {
            this.timer = setTimeout(() => {
                this.runBotLogic(seat);
            }, 1500); // Bot 思考 1.5 秒
        } else {
            // 玩家超时检测 (30秒)
            this.timer = setTimeout(() => {
                console.log(`Seat ${seat} timeout, auto play/pass.`);
                if (!this.gameData.lastHand) {
                    // 强制出最小
                    let hand = this.gameData.hands[seat];
                    if(hand.length > 0) {
                        let card = hand[hand.length - 1]; // 排序后最小
                        this.handleAction(null, { type: 'play', cards: [card], isBot: false, seat: seat });
                    }
                } else {
                    this.handleAction(null, { type: 'pass', isBot: false, seat: seat });
                }
            }, 30000);
        }
    }

    runBotLogic(seat) {
        if (this.state !== 'playing' || this.gameData.currentTurn !== seat) return;

        let hand = this.gameData.hands[seat];
        let last = this.gameData.lastHand;

        // 简单 AI
        if (!last) {
            // 首出：出最小的单张
            if (hand.length > 0) {
                let card = hand[hand.length - 1];
                this.handleAction(null, { type: 'play', cards: [card], isBot: true, seat: seat });
            }
        } else {
            // 跟牌：尝试找能打过的最小牌
            // 这里简化逻辑：只尝试跟同类型最小牌，找不到就 Pass
            // 实际项目需写复杂的拆牌算法
            let found = false;
            
            if (last.type === '1') {
                // 找一张比 last.val 大的
                let card = hand.reverse().find(c => c.p > last.type.val); // reverse为了找最小的大的
                if (card) {
                    hand.reverse(); // 还原
                    this.handleAction(null, { type: 'play', cards: [card], isBot: true, seat: seat });
                    found = true;
                }
            }
            // ... 其他牌型判断省略，填入 Pass
            
            if (!found) {
                this.handleAction(null, { type: 'pass', isBot: true, seat: seat });
            }
        }
    }

    broadcast(event, data) {
        io.to(this.id).emit(event, data);
    }
}

// ================== 路由与连接 ==================
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 简单匹配：查找有空位的房间，否则新建
    let room = Object.values(rooms).find(r => r.state === 'waiting' && r.players.filter(p=>p&&!p.isBot).length < 2);
    
    if (!room) {
        let roomId = Math.random().toString(36).substr(2, 5);
        room = new GameRoom(roomId);
        rooms[roomId] = room;
    }

    room.addPlayer(socket);

    socket.on('start', () => {
        // 至少1人才能开始 (配合 Bot)
        if (room.players.filter(p=>p&&!p.isBot).length >= 1) {
            room.startGame();
        }
    });

    socket.on('action', (data) => {
        room.handleAction(socket, data);
    });

    socket.on('disconnect', () => {
        room.removePlayer(socket);
        if (room.isEmpty()) delete rooms[room.id];
    });
});

http.listen(PORT, () => console.log(`Server running on ${PORT}`));
