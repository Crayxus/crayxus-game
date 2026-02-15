// server.js - Crayxus Rewrite (Complete & Stable)
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

// ================== 游戏核心逻辑 ==================
const POWER = {'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15,'Sm':16,'Bg':17};
const SUITS = ['♠','♥','♣','♦'];
const POINTS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

function createDeck() {
    let deck = [];
    for (let i = 0; i < 2; i++) { // 两副牌
        SUITS.forEach(s => POINTS.forEach(v => deck.push({
            s, v, p: POWER[v], id: Math.random().toString(36).substr(2, 9)
        })));
        deck.push({ s:'JOKER', v:'Sm', p:POWER['Sm'], id:Math.random().toString(36).substr(2, 9) });
        deck.push({ s:'JOKER', v:'Bg', p:POWER['Bg'], id:Math.random().toString(36).substr(2, 9) });
    }
    for (let i = deck.length - 1; i > 0; i--) { // 洗牌
        let j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function getHandType(cards) {
    if (!cards || cards.length === 0) return null;
    cards.sort((a, b) => a.p - b.p);
    let counts = {};
    cards.forEach(c => counts[c.p] = (counts[c.p] || 0) + 1);
    let vals = Object.keys(counts).map(Number).sort((a,b) => a-b);
    let len = cards.length;
    let maxFreq = Math.max(...Object.values(counts));

    // 王炸
    if (len === 4 && cards.filter(c => c.s === 'JOKER').length === 4) return { type: 'bomb', val: 999, score: 1000 };
    // 炸弹
    if (len === 4 && maxFreq === 4) return { type: 'bomb', val: vals[0], score: 400 };
    // 单张
    if (len === 1) return { type: '1', val: cards[0].p };
    // 对子
    if (len === 2 && maxFreq === 2) return { type: '2', val: vals[0] };
    // 三张
    if (len === 3 && maxFreq === 3) return { type: '3', val: vals[0] };
    // 顺子 (简化版：5张连续单牌)
    if (len >= 5 && maxFreq === 1) {
        let isSeq = true;
        for(let i=0; i<vals.length-1; i++) {
            if (vals[i+1] - vals[i] !== 1 || vals[i] >= 15) isSeq = false; 
        }
        if (isSeq) return { type: 'straight', val: vals[vals.length-1] };
    }
    return null;
}

function canBeat(newCards, newType, lastHand) {
    if (!lastHand) return true;
    let isNewBomb = newType.type === 'bomb';
    let isLastBomb = lastHand.type === 'bomb';
    if (isNewBomb && !isLastBomb) return true;
    if (!isNewBomb && isLastBomb) return false;
    if (isNewBomb && isLastBomb) return newType.val > lastHand.val; // 简化比较
    if (newType.type !== lastHand.type) return false;
    if (newCards.length !== lastHand.cards.length) return false;
    return newType.val > lastHand.val;
}

// ================== 房间管理 ==================
class GameRoom {
    constructor(id) {
        this.id = id;
        this.players = [null, null, null, null]; // 0:P1, 1:Bot, 2:P2, 3:Bot
        this.sockets = {}; // seatId -> socket
        this.state = 'waiting'; // waiting, playing
        this.gameData = null;
        this.timer = null;
    }

    addPlayer(socket) {
        let seat = -1;
        if (!this.players[0]) seat = 0;
        else if (!this.players[2]) seat = 2;
        
        if (seat === -1) return false;

        this.players[seat] = { id: socket.id, score: 1000 };
        this.sockets[seat] = socket;
        socket.join(this.id);
        
        // 发送身份
        socket.emit('identity', { seat: seat });
        return true;
    }

    removePlayer(socket) {
        let seat = this.players.findIndex(p => p && p.id === socket.id);
        if (seat !== -1) {
            this.players[seat] = null;
            delete this.sockets[seat];
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
                this.players[i] = { id: `bot_${i}`, isBot: true };
            }
        }

        let deck = createDeck();
        let hands = [[], [], [], []];
        for(let i=0; i<deck.length; i++) hands[i%4].push(deck[i]);
        hands.forEach(h => h.sort((a,b) => b.p - a.p)); // 降序排列

        this.gameData = {
            hands: hands,
            currentTurn: Math.floor(Math.random() * 4),
            lastHand: null,
            passCount: 0,
            finishedOrder: []
        };

        this.state = 'playing';

        // 发送消息
        this.broadcast('gameStart', { turn: this.gameData.currentTurn });
        
        for(let i=0; i<4; i++) {
            if (this.sockets[i]) {
                this.sockets[i].emit('dealCards', { cards: hands[i] });
            }
        }

        this.scheduleNextMove();
    }

    handleAction(socket, data) {
        let seat = (data.isBot) ? data.seat : this.players.findIndex(p => p && p.id === socket.id);
        
        if (seat === -1 || this.gameData.currentTurn !== seat) {
            console.log("Action rejected: not your turn or invalid seat");
            return;
        }
        
        let gd = this.gameData;
        
        // 处理 Pass
        if (data.type === 'pass') {
            if (!gd.lastHand) {
                console.log("Cannot pass on new round"); 
                return; 
            }
            gd.passCount++;
            this.broadcast('syncAction', { seat: seat, type: 'pass', cards: [] });
            this.nextTurn();
        }

        // 处理 Play
        else if (data.type === 'play') {
            let type = getHandType(data.cards);
            if (!type || !canBeat(data.cards, type, gd.lastHand)) {
                console.log("Invalid play");
                // 如果是Bot出错了，强制pass
                if (data.isBot) this.handleAction(null, { type: 'pass', isBot: true, seat: seat });
                return;
            }

            // 移除手牌
            data.cards.forEach(c => {
                let idx = gd.hands[seat].findIndex(h => h.id === c.id);
                if (idx !== -1) gd.hands[seat].splice(idx, 1);
            });

            gd.lastHand = { cards: data.cards, type: type, owner: seat };
            gd.passCount = 0;

            if (gd.hands[seat].length === 0) {
                gd.finishedOrder.push(seat);
                // 简化逻辑：一个人出完，游戏结束
                this.broadcast('syncAction', { seat, type: 'play', cards: data.cards, handType: type });
                this.endGame();
                return;
            }

            this.broadcast('syncAction', { seat, type: 'play', cards: data.cards, handType: type });
            this.nextTurn();
        }
    }

    nextTurn() {
        let gd = this.gameData;
        let next = (gd.currentTurn + 1) % 4;
        
        // 检查回合结束
        let activePlayers = 4 - gd.finishedOrder.length;
        if (gd.passCount >= activePlayers - 1) {
            console.log("Round End. Winner takes new round.");
            gd.lastHand = null;
            gd.passCount = 0;
            // 轮转到下一个没出完的人 (赢家已经被跳过或在这里处理)
        }

        // 跳过出完的人
        let safety = 0;
        while (gd.finishedOrder.includes(next) && safety < 4) {
            next = (next + 1) % 4;
            safety++;
        }

        gd.currentTurn = next;
        this.broadcast('turnChange', { turn: next, isRoundEnd: (gd.lastHand === null) });
        this.scheduleNextMove();
    }

    scheduleNextMove() {
        if (this.timer) clearTimeout(this.timer);
        let seat = this.gameData.currentTurn;
        let player = this.players[seat];

        // Bot逻辑
        if (player.isBot) {
            this.timer = setTimeout(() => this.runBotLogic(seat), 1500);
        } 
        // 玩家超时逻辑
        else {
            this.timer = setTimeout(() => {
                console.log(`Player ${seat} timeout.`);
                if (!this.gameData.lastHand) {
                     // 强制出最小牌
                     let hand = this.gameData.hands[seat];
                     if(hand.length > 0) {
                         let card = hand[hand.length - 1]; 
                         this.handleAction(null, { type: 'play', cards: [card], isBot: false, seat: seat });
                     }
                } else {
                     this.handleAction(null, { type: 'pass', isBot: false, seat: seat });
                }
            }, 30000);
        }
    }

    runBotLogic(seat) {
        if (this.state !== 'playing') return;
        let hand = this.gameData.hands[seat];
        let last = this.gameData.lastHand;

        if (!last) {
            // 首出：出最小的一张
            if (hand.length > 0) {
                let card = hand[hand.length - 1];
                this.handleAction(null, { type: 'play', cards: [card], isBot: true, seat: seat });
            }
        } else {
            // 跟牌：尝试找大的
            let found = false;
            if (last.type.type === '1') {
                // 找一张比它大的最小牌
                let card = [...hand].reverse().find(c => c.p > last.type.val);
                if (card) {
                    this.handleAction(null, { type: 'play', cards: [card], isBot: true, seat: seat });
                    found = true;
                }
            }
            // 其他牌型暂略...默认Pass
            
            if (!found) {
                this.handleAction(null, { type: 'pass', isBot: true, seat: seat });
            }
        }
    }

    endGame() {
        this.state = 'waiting';
        this.broadcast('gameOver', { winner: this.gameData.finishedOrder[0] });
        // 重置逻辑可在此添加
    }

    broadcast(event, data) {
        io.to(this.id).emit(event, data);
    }
}

// ================== 路由 ==================
let rooms = {};

app.use(express.static('public')); // 确保有 public 文件夹，或使用下面的事件监听

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('findGame', () => {
        let room = Object.values(rooms).find(r => r.state === 'waiting' && r.players.filter(p=>p&&!p.isBot).length < 2);
        if (!room) {
            let id = Math.random().toString(36).substr(2, 5);
            room = new GameRoom(id);
            rooms[id] = room;
        }
        room.addPlayer(socket);
        
        // 模拟匹配延迟
        setTimeout(() => {
            // 检查人数，如果>=1人即可开始 (Bot补位)
            if (room.players.filter(p=>p&&!p.isBot).length >= 1) {
                room.startGame();
            }
        }, 1500);
    });

    socket.on('action', (d) => {
        let room = Object.values(rooms).find(r => r.sockets[socket.id] || r.players.find(p=>p.id===socket.id));
        if (room) room.handleAction(socket, d);
    });

    socket.on('disconnect', () => {
        let room = Object.values(rooms).find(r => r.sockets[socket.id]);
        if (room) {
            room.removePlayer(socket);
            if (room.isEmpty()) delete rooms[room.id];
        }
    });
});

http.listen(PORT, () => console.log(`Server on ${PORT}`));
