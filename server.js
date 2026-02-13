// server.js - Crayxus 2人协作版服务端 (Render 适配版)
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // 允许所有域名连接 (关键：允许你的Hostinger前端连接)
        methods: ["GET", "POST"]
    }
});

// 1. 健康检查路由 (让 Render 知道服务正常)
app.get('/', (req, res) => {
    res.send('Crayxus Server is Running! 🟢 Status: Online');
});

// 2. 房间状态 (单房间模式)
let room = {
    players: {}, // 映射 socket.id -> seatIndex
    seats: [null, 'BOT', null, 'BOT'], // 座位表: 0(Host), 1(Bot), 2(Guest), 3(Bot)
    count: 0 // 当前真人数量
};

io.on('connection', (socket) => {
    console.log('🔗 新连接接入:', socket.id);

    // --- A. 进房分座 ---
    // 逻辑：优先填 Seat 0 (主机)，然后填 Seat 2 (僚机)
    let mySeat = -1;
    if (room.seats[0] === null) mySeat = 0;
    else if (room.seats[2] === null) mySeat = 2;

    if (mySeat !== -1) {
        // 入座成功
        room.seats[mySeat] = socket.id;
        room.players[socket.id] = mySeat;
        room.count++;

        console.log(`玩家入座 Seat ${mySeat}。当前人数: ${room.count}`);

        // 1. 告诉玩家身份
        socket.emit('initIdentity', { 
            seat: mySeat, 
            isHost: (mySeat === 0) // 0号位负责运算Bot逻辑
        });

        // 2. 广播房间状态 (更新大厅UI)
        io.emit('roomUpdate', { 
            humanCount: room.count,
            seats: room.seats.map(s => s ? (s === 'BOT' ? 'AI' : 'HUMAN') : null)
        });

        // 3. 人满 (2人) -> 自动发车
        if (room.count === 2) {
            console.log("🚀 双人集结完毕，游戏开始");
            // 延迟一点点，让UI动画跑完
            setTimeout(() => {
                io.emit('gameStart', { startTurn: 0 }); 
            }, 1000);
        }
    } else {
        // 房间满了
        socket.emit('roomFull');
    }

    // --- B. 游戏交互 ---
    
    // 1. 转发真人动作
    socket.on('action', (data) => {
        // data: { seat, type, cards... }
        // 广播给除自己以外的所有人(其实广播给所有人也可以，前端做过滤)
        // 这里为了简单，直接广播给所有人，前端根据 seat 判断是谁出的
        io.emit('syncAction', data);
    });

    // 2. 转发主机算出来的 Bot 动作
    socket.on('botAction', (data) => {
        // 只有 Host (Seat 0) 会发送这个事件
        // 广播给所有人 (包括 Guest)
        io.emit('syncAction', data);
    });

    // --- C. 断开连接 ---
    socket.on('disconnect', () => {
        let seat = room.players[socket.id];
        if (seat !== undefined) {
            console.log(`❌ 玩家 Seat ${seat} 断开连接`);
            // 清理座位
            room.seats[seat] = null;
            delete room.players[socket.id];
            room.count--;
            
            // 通知前端有人掉了 (简单处理：前端收到这个可以让用户刷新)
            io.emit('playerLeft');
            io.emit('roomUpdate', { humanCount: room.count });
        }
    });
});

// Render 会动态分配端口，必须使用 process.env.PORT
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});