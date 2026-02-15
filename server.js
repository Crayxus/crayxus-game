<script>
        const socket = io('https://crayxus-game.onrender.com');
        let mySeat = -1, myCards = [], botCards = {1:[], 3:[]}, turn = -1, lastHand = null, counts = [27,27,27,27];
        let isHost = false, timerInterval = null, timeLeft = 30;
        let dealCardsTimeout = null;
        let gameOver = false;  
        let originalCardsOrder = [];
        let roundEndTimer = null; // New: prevents card swallowing

        let myScore = parseInt(localStorage.getItem('crayxus_score')) || 1291;
        let myRank = parseInt(localStorage.getItem('crayxus_rank')) || 46;
        let ladderData = [];

        const AudioSys = {
            ctx: null,
            init() { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
            play(t) {
                if (!this.ctx) return;
                if (this.ctx.state === 'suspended') this.ctx.resume();
                const o = this.ctx.createOscillator(), g = this.ctx.createGain();
                o.connect(g); g.connect(this.ctx.destination);
                const n = this.ctx.currentTime;
                if (t === 'deal') { o.type='sawtooth'; o.frequency.setValueAtTime(800,n); g.gain.setValueAtTime(0.05,n); g.gain.linearRampToValueAtTime(0,n+0.05); o.start(n); o.stop(n+0.05); }
                else if (t === 'snap') { o.type='square'; o.frequency.setValueAtTime(150,n); g.gain.setValueAtTime(0.2,n); g.gain.linearRampToValueAtTime(0,n+0.1); o.start(n); o.stop(n+0.1); }
                else if (t === 'click') { o.type='triangle'; o.frequency.setValueAtTime(600,n); g.gain.setValueAtTime(0.1,n); g.gain.linearRampToValueAtTime(0,n+0.1); o.start(n); o.stop(n+0.1); }
            }
        };

        function bootSystem() {
            AudioSys.init();
            document.getElementById('lobby-score').innerText = myScore.toLocaleString();
            document.getElementById('lobby-rank').innerText = '#' + myRank;
            switchScreen('lobby');
        }

        function switchScreen(id) {
            document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
            let t = document.getElementById(id);
            t.style.display = 'flex';
            setTimeout(() => t.classList.add('active'), 10);
        }

        socket.on('connect', () => {
            console.log("✅ Socket connected:", socket.id);
            document.getElementById('conn-status').innerText = "Online";
            document.getElementById('conn-status').style.color = "#0f0";
            let btn = document.getElementById('find-btn');
            btn.innerText = "FIND MATCH";
            btn.disabled = false;
        });

        socket.on('disconnect', () => {
            console.log("❌ Socket disconnected");
            document.getElementById('conn-status').innerText = "Offline";
            document.getElementById('conn-status').style.color = "#f00";
        });

        socket.on('initIdentity', (d) => {
            mySeat = d.seat;
            isHost = d.isHost;
        });

        socket.on('roomUpdate', (d) => {
            let msg = document.getElementById('match-status');
            if (d.count < 2) { msg.innerText = `Waiting (${d.count}/2)`; msg.style.color = "var(--neon)"; }
            else { msg.innerText = "FOUND! Starting..."; msg.style.color = "#0f0"; }
        });

        socket.on('gameStart', (d) => {
            gameOver = false;
            turn = d.startTurn;
            lastHand = null;
            counts = [27,27,27,27];
            document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
            let g = document.getElementById('game-ui');
            g.style.display = 'flex';
            g.style.opacity = '1';
            ['out-0','out-1','out-2','out-3'].forEach(id => {
                let el = document.getElementById(id);
                if (el) { el.innerHTML = ''; el.classList.remove('dimmed','highlight'); }
            });
            document.getElementById('result-modal').style.display = 'none';
            initLadder();
            renderUI();
            checkTurn();
        });

        socket.on('dealCards', (d) => {
            if (dealCardsTimeout) { clearTimeout(dealCardsTimeout); dealCardsTimeout = null; }
            if (!d.cards || !Array.isArray(d.cards) || d.cards.length === 0) return;
            myCards = d.cards.sort((a, b) => b.p - a.p);
            originalCardsOrder = [...myCards];
            document.getElementById('deck-center').style.display = 'block';
            setTimeout(() => {
                renderHand(true);
                let cards = document.querySelectorAll('#hand .wrap .card');
                let i = 0;
                let di = setInterval(() => {
                    if (i >= cards.length) {
                        clearInterval(di);
                        document.getElementById('deck-center').style.display = 'none';
                        return;
                    }
                    cards[i].classList.add('anim-deal');
                    if (i % 3 === 0) AudioSys.play('deal');
                    i++;
                }, 40);
            }, 500);
        });

        socket.on('botCards', (d) => {
            botCards[1] = d.bot1.sort((a, b) => b.p - a.p);
            botCards[3] = d.bot3.sort((a, b) => b.p - a.p);
        });

        socket.on('syncAction', (d) => {
            handleSync(d);
        });

        function handleSync(d) {
            if (gameOver && d.nextTurn !== -1) return;
            stopTimer();
            if (mySeat === -1 || mySeat === undefined) return;

            // Fix: Cancel pending clear to avoid swallowing new cards
            if (roundEndTimer) {
                clearTimeout(roundEndTimer);
                roundEndTimer = null;
                // Force reset visuals if interrupted
                ['out-0','out-1','out-2','out-3'].forEach(id => {
                    let el = document.getElementById(id);
                    if (el) { el.classList.remove('dimmed'); el.innerHTML = ''; }
                });
            }

            let viewId = (d.seat - mySeat + 4) % 4;
            let area = document.getElementById(`out-${viewId}`);
            if (!area) return;

            area.innerHTML = '';
            console.log(`🎴 Sync: Seat ${d.seat} -> View ${viewId} (${d.type})`);

            if (d.type === 'pass') {
                area.innerHTML = '<span style="font-size:20px;color:#888;font-weight:bold">PASS</span>';
            } else if (d.type === 'play') {
                AudioSys.play('snap');
                let tag = '';
                if (d.handType && d.handType.type) {
                    const tagMap = { 'bomb':'💣炸弹', 'straight_flush':'🌈同花顺', 'straight':'📊顺子', 'plate':'🛡️钢板', 'tube':'🚀木板', '3+2':'🎯三带二' };
                    tag = tagMap[d.handType.type] || '';
                }
                if (tag) area.innerHTML = `<div class="tag">${tag}</div>`;

                if (d.cards && Array.isArray(d.cards) && d.cards.length > 0) {
                    d.cards.forEach((c, idx) => {
                        let div = document.createElement('div');
                        let cl = (['♥','♦'].includes(c.s) || c.v === 'Bg') ? 'c-red' : 'c-blk';
                        let txt = c.s === 'JOKER' ? (c.v === 'Bg' ? 'JR' : 'jr') : c.v;
                        let ico = c.s === 'JOKER' ? '🤡' : c.s;
                        if (c.v === '2' && c.s === '♥') cl += ' c-wild';
                        div.className = `card c-mini ${cl}`;
                        div.innerHTML = `<div class="val-txt">${txt}</div><div class="center-icon">${ico}</div>`;
                        area.appendChild(div);
                    });
                }
                lastHand = { owner: d.seat, type: d.handType?.type || 'unknown', val: d.handType?.val || 0, count: d.cards?.length || 0, score: d.handType?.score || 0 };
                counts[d.seat] -= (d.cards?.length || 0);
                if (isHost && (d.seat === 1 || d.seat === 3) && d.cards) {
                    let pIds = d.cards.map(x => x.id);
                    botCards[d.seat] = botCards[d.seat].filter(c => !pIds.includes(c.id));
                }
            }

            turn = d.nextTurn;
            if (turn === -1) {
                gameOver = true;
                setTimeout(() => { calcResult(); }, 2500);
                return;
            }

            if (d.isRoundEnd) {
                lastHand = null;
                // Use global timer
                roundEndTimer = setTimeout(() => {
                    ['out-0','out-1','out-2','out-3'].forEach(id => {
                        let el = document.getElementById(id);
                        if (el) { el.classList.add('dimmed'); setTimeout(() => { el.innerHTML = ''; el.classList.remove('dimmed'); }, 300); }
                    });
                    roundEndTimer = null;
                }, 1200);
            } else {
                updateDim();
            }

            renderUI();
            checkTurn();
            resetWatchdog();
        }

        let watchdogTimer = null;
        function resetWatchdog() {
            if (watchdogTimer) clearTimeout(watchdogTimer);
            if (gameOver || turn === -1) return;
            watchdogTimer = setTimeout(() => {
                if (!gameOver && turn !== -1) {
                    console.error("🐕 Watchdog: game stuck for 40s!");
                    toast("游戏似乎卡住了，正在尝试恢复...");
                    if (turn === mySeat) autoPlay();
                    socket.emit('ping_game');
                }
            }, 40000);
        }

        function checkTurn() {
            if (turn === -1 || gameOver) return;
            startTimer();
            let ctrls = document.getElementById('ctrls');
            if (turn === mySeat) {
                ctrls.style.display = 'flex';
                let bp = document.getElementById('btn-pass');
                if (!lastHand) {
                    bp.innerText = "START"; bp.disabled = true; bp.style.opacity = 0.5;
                } else {
                    bp.innerText = "PASS"; bp.disabled = false; bp.style.opacity = 1;
                }
            } else {
                ctrls.style.display = 'none';
                if (isHost && (turn === 1 || turn === 3)) {
                    let botSeat = turn;
                    if (window.botTimer) clearTimeout(window.botTimer);
                    window.botTimer = setTimeout(() => {
                        if (turn === botSeat && !gameOver) {
                            runBot(botSeat);
                        }
                    }, 1000); 
                }
            }
        }

        function sendPlay() {
            let sel = myCards.filter(c => c.sel);
            if (!sel.length) return toast("请选牌");
            let type = getHandType(sel);
            if (!type) return toast("无效牌型");
            if (lastHand && !canBeat(sel, type, lastHand)) return toast("压不过");
            let cardsToSend = sel.map(c => ({ s:c.s, v:c.v, p:c.p, seq:c.seq, id:c.id }));
            socket.emit('action', { seat: mySeat, type: 'play', cards: cardsToSend, handType: type });
            myCards = myCards.filter(c => !c.sel);
            originalCardsOrder = [...myCards];
            renderHand();
            document.getElementById('ctrls').style.display = 'none';
        }

        function sendPass() {
            socket.emit('action', { seat: mySeat, type: 'pass' });
            document.getElementById('ctrls').style.display = 'none';
        }

        function doHint() {
            myCards.forEach(c => c.sel = false);
            if (!lastHand) {
                if (myCards.length) myCards[myCards.length - 1].sel = true;
            } else {
                let g = analyzeHand(myCards), pick = findMatch(g, lastHand);
                if (!pick && lastHand.owner !== (mySeat + 2) % 4) pick = findBomb(g, lastHand);
                if (pick) pick.forEach(c => c.sel = true);
                else toast("没牌可出");
            }
            renderHand();
            AudioSys.play('click');
        }

        function autoPlay() {
            toast("超时自动出牌");
            doHint();
            let s = myCards.filter(c => c.sel);
            if (s.length > 0) setTimeout(sendPlay, 500);
            else if (!lastHand && myCards.length > 0) {
                myCards[myCards.length - 1].sel = true;
                renderHand();
                setTimeout(sendPlay, 500);
            } else sendPass();
        }

        function runBot(seat) {
            try {
                let hand = botCards[seat];
                if (!hand || hand.length === 0) {
                    socket.emit('botAction', { seat, type: 'pass', cards: [] });
                    return;
                }

                let g = analyzeHand(hand), best = null;

                if (!lastHand) {
                    // Must play something
                    if (g.singles.length) {
                        let validSingles = g.singles.filter(s => s[0].s !== 'JOKER');
                        if (validSingles.length > 0) {
                            validSingles.sort((a,b) => a[0].p - b[0].p);
                            best = validSingles[0];
                        } else best = g.singles[0];
                    }
                    if (!best) {
                        hand.sort((a, b) => a.p - b.p);
                        best = [hand[0]];
                    }
                } else {
                    best = findMatch(g, lastHand);
                    if (!best && (lastHand.owner !== (seat + 2) % 4)) best = findBomb(g, lastHand);
                }

                if (best) {
                    let type = getHandType(best);
                    if (type) socket.emit('botAction', { seat, type: 'play', cards: best, handType: type });
                    else {
                        if (!lastHand) {
                            let c = [botCards[seat][0]];
                            socket.emit('botAction', { seat, type: 'play', cards: c, handType: getHandType(c) });
                        } else socket.emit('botAction', { seat, type: 'pass', cards: [] });
                    }
                } else {
                    socket.emit('botAction', { seat, type: 'pass', cards: [] });
                }
            } catch(e) {
                console.error(`🤖 Bot ${seat} error:`, e);
                if (!lastHand && botCards[seat].length > 0) {
                     let c = [botCards[seat][0]];
                     socket.emit('botAction', { seat, type: 'play', cards: c, handType: getHandType(c) });
                } else socket.emit('botAction', { seat, type: 'pass', cards: [] });
            }
        }

        function joinGame() { switchScreen('match'); socket.emit('joinGame'); }

        function renderHand(isDealing = false) {
            let h = document.getElementById('hand');
            h.innerHTML = '';
            myCards.forEach((c, i) => {
                let div = document.createElement('div');
                div.className = `wrap ${c.sel ? 'sel' : ''}`;
                div.style.zIndex = i;
                div.onclick = (e) => { e.stopPropagation(); c.sel = !c.sel; renderHand(); AudioSys.play('click'); };
                let cl = (['♥','♦'].includes(c.s) || c.v === 'Bg') ? 'c-red' : 'c-blk';
                if (c.v === '2' && c.s === '♥') cl += ' c-wild';
                let txt = c.s === 'JOKER' ? (c.v === 'Bg' ? 'JOKER' : 'joker') : c.v;
                let ico = c.s === 'JOKER' ? '🤡' : c.s;
                let style = isDealing ? 'opacity:0' : '';
                div.innerHTML = `<div class="card ${cl}" style="${style}"><div class="val-txt" style="${c.s === 'JOKER' ? 'writing-mode:vertical-rl;font-size:12px;margin-top:5px' : ''}">${txt}</div><div class="center-icon">${ico}</div></div>`;
                h.appendChild(div);
            });
        }

        function renderUI() {
            ['av-1','av-2','av-3'].forEach(id => document.getElementById(id).classList.remove('active'));
            if (turn !== mySeat && turn !== -1) {
                let r = (turn - mySeat + 4) % 4;
                if (r >= 1 && r <= 3) document.getElementById(`av-${r}`).classList.add('active');
            }
            let l = (mySeat + 3) % 4, r = (mySeat + 1) % 4, t = (mySeat + 2) % 4;
            updateBadge('n-3', counts[l]);
            updateBadge('n-1', counts[r]);
            updateBadge('n-2', counts[t]);
            updateDim();
        }

        function updateBadge(nid, cnt) {
            let n = document.getElementById(nid);
            if (cnt > 0 && cnt <= 10) { n.style.display = 'flex'; n.innerText = cnt; }
            else n.style.display = 'none';
        }

        function updateDim() {
            ['out-0','out-1','out-2','out-3'].forEach(id => {
                let el = document.getElementById(id);
                el.classList.remove('dimmed','highlight');
            });
            if (lastHand) {
                let or = (lastHand.owner - mySeat + 4) % 4;
                document.getElementById(`out-${or}`).classList.add('highlight');
                for (let i = 0; i < 4; i++) if (i !== or) document.getElementById(`out-${i}`).classList.add('dimmed');
            }
        }

        function startTimer() {
            clearInterval(timerInterval); timeLeft = 30; updateTimerVisuals();
            timerInterval = setInterval(() => {
                timeLeft--; updateTimerVisuals();
                if (timeLeft <= 0) { clearInterval(timerInterval); if (turn === mySeat) autoPlay(); }
            }, 1000);
        }
        function stopTimer() { clearInterval(timerInterval); resetTimerVisuals(); }
        function updateTimerVisuals() {
            let pct = (timeLeft / 30) * 100, color = '#00ffcc';
            if (timeLeft <= 10) color = '#ffcc00';
            if (timeLeft <= 5) color = '#ff3b30';
            for (let i = 1; i < 4; i++) {
                let viewId = (i - mySeat + 4) % 4;
                if (viewId === 0) continue; 
                let ring = document.getElementById(`tr-${viewId}`);
                if (ring) {
                    if ((turn - mySeat + 4) % 4 === viewId) {
                        ring.style.background = `conic-gradient(${color} ${pct}%, transparent ${pct}%)`;
                    } else {
                        ring.style.background = 'transparent';
                    }
                }
            }
            if (turn === mySeat) {
                let t = document.getElementById('my-timer-txt');
                t.style.display = 'block'; t.innerText = timeLeft + "s"; t.style.color = color;
            } else {
                document.getElementById('my-timer-txt').style.display = 'none';
            }
        }
        function resetTimerVisuals() {
            for (let i = 1; i < 4; i++) document.getElementById(`tr-${i}`).style.background = 'transparent';
            document.getElementById('my-timer-txt').style.display = 'none';
        }

        function calcResult() {
            stopTimer();
            document.getElementById('ctrls').style.display = 'none';
            let finished = [];
            counts.forEach((c, i) => { if (c <= 0) finished.push(i); });
            for (let i = 0; i < 4; i++) { if (!finished.includes(i)) finished.push(i); }
            let mp = finished.indexOf(mySeat) + 1;
            let pp = finished.indexOf((mySeat + 2) % 4) + 1;
            let pt = 0, tt = "LOSS";
            if (mp === 1 && pp === 2) { tt = "PERFECT"; pt = 30; }
            else if (mp === 1 || pp === 1) { if (mp + pp === 4) { tt = "WIN"; pt = 15; } else { tt = "DRAW"; pt = 5; } }
            else { if (mp + pp === 7) { tt = "BIG LOSS"; pt = -15; } else { tt = "LOSS"; pt = -5; } }
            myScore += pt;
            document.getElementById('disp-score').innerText = myScore.toLocaleString();
            localStorage.setItem('crayxus_score', myScore);
            localStorage.setItem('crayxus_rank', myRank);
            document.getElementById('res-title').innerText = tt;
            document.getElementById('res-title').style.color = pt > 0 ? "var(--neon)" : (pt < 0 ? "#ff3b30" : "#aaa");
            document.getElementById('res-points').innerText = (pt >= 0 ? "+" : "") + pt;
            document.getElementById('result-modal').style.display = 'flex';
        }

        function continueGame() {
            if (!socket.connected) {
                toast("连接已断开，正在重连...");
                socket.connect();
                setTimeout(() => { if (socket.connected) continueGame(); else toast("重连失败，请刷新页面"); }, 2000);
                return;
            }
            let btn = document.getElementById('btn-continue');
            btn.disabled = true; btn.style.opacity = 0.5; btn.innerText = "正在准备...";
            gameOver = false; myCards = []; lastHand = null; counts = [27,27,27,27]; turn = -1; originalCardsOrder = [];
            ['out-0','out-1','out-2','out-3'].forEach(id => {
                let el = document.getElementById(id);
                if (el) { el.innerHTML = ''; el.classList.remove('dimmed','highlight'); }
            });
            document.getElementById('hand').innerHTML = '';
            document.getElementById('ctrls').style.display = 'none';
            document.getElementById('vip-panel').style.display = 'none';
            document.getElementById('result-modal').style.display = 'none';
            socket.emit('requestNewGame');
            toast("正在开始新局...");
            if (dealCardsTimeout) clearTimeout(dealCardsTimeout);
            dealCardsTimeout = setTimeout(() => {
                if (myCards.length === 0) {
                    toast("发牌超时，请刷新页面");
                    btn.disabled = false; btn.style.opacity = 1; btn.innerText = "继续游戏";
                    document.getElementById('result-modal').style.display = 'flex';
                }
            }, 5000);
        }

        function toast(m) {
            let t = document.getElementById('tst');
            t.innerText = m; t.style.opacity = 1;
            setTimeout(() => t.style.opacity = 0, 2000);
        }

        function getHandType(c) {
            if (!c.length) return null;
            let wild = c.filter(x => x.v === '2' && x.s === '♥');
            let norm = c.filter(x => !(x.v === '2' && x.s === '♥'));
            norm.sort((a, b) => a.p - b.p);
            let len = c.length;
            let m = {}; norm.forEach(x => m[x.p] = (m[x.p] || 0) + 1);
            let vals = Object.keys(m).map(Number).sort((a, b) => a - b);
            let maxFreq = vals.length ? Math.max(...Object.values(m)) : 0;

            if (len >= 4) {
                let kings = c.filter(x => x.s === 'JOKER');
                if (kings.length === 4) return { type:'bomb', val:999, count:6, score:1000 };
                if (len === 4 && (maxFreq + wild.length >= 4) && maxFreq >= 1) {
                    let v = vals.length ? vals[vals.length - 1] : 15;
                    return { type:'bomb', val:v, count:4, score:400 };
                }
                if (wild.length === 0 && maxFreq === len) {
                    let v = vals.length ? vals[vals.length - 1] : 15;
                    return { type:'bomb', val:v, count:len, score:len * 100 };
                }
            }
            if (len === 1) return { type:'1', val:c[0].p };
            if (len === 2 && (maxFreq + wild.length >= 2)) return { type:'2', val:vals.length ? vals[vals.length - 1] : 15 };
            if (len === 3 && (maxFreq + wild.length >= 3)) return { type:'3', val:vals.length ? vals[vals.length - 1] : 15 };

            if (len === 5) {
                if (vals.length >= 3 && vals.length + wild.length >= 5) {
                    let gap = vals[vals.length - 1] - vals[0];
                    if (gap <= 4) {
                        let isFlush = true;
                        if (norm.length > 0) {
                            let firstSuit = norm[0].s;
                            for (let card of norm) { if (card.s !== firstSuit) { isFlush = false; break; } }
                        }
                        if (isFlush && norm.length === 5) return { type:'straight_flush', val:vals[vals.length - 1], score:550 };
                        else return { type:'straight', val:vals[vals.length - 1] };
                    }
                }
                if (vals.length <= 2 && maxFreq >= 2) return { type:'3+2', val:vals.length ? vals[vals.length - 1] : 15 };
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

        function canBeat(c, t, l) {
            let isNB = (t.type === 'bomb' || t.type === 'straight_flush');
            let isLB = (l.type === 'bomb' || l.type === 'straight_flush');
            if (isNB && !isLB) return true;
            if (!isNB && isLB) return false;
            if (isNB && isLB) {
                let ns = t.score || (t.type === 'bomb' ? t.count * 100 : 550);
                let ls = l.score || (l.type === 'bomb' ? l.count * 100 : 550);
                if (ns > ls) return true; if (ns < ls) return false;
                return t.val > l.val;
            }
            if (t.type !== l.type) return false;
            if (c.length !== l.count) return false;
            return t.val > l.val;
        }

        function analyzeHand(h) {
            let wild = h.filter(x => x.v === '2' && x.s === '♥');
            let norm = h.filter(x => !(x.v === '2' && x.s === '♥'));
            let m = {}; norm.forEach(c => m[c.p] = (m[c.p] || []).concat(c));
            let vals = Object.keys(m).map(Number).sort((a, b) => a - b);
            let r = { singles:[], pairs:[], triples:[], bombs:[], plates:[], tubes:[] };
            vals.forEach(v => {
                let grp = m[v];
                if (grp.length + wild.length >= 4) {
                    let need = 4 - grp.length;
                    if (need <= wild.length) r.bombs.push(grp.concat(wild.slice(0, need)));
                }
                if (grp.length === 1) r.singles.push(grp);
                if (grp.length === 2) r.pairs.push(grp);
                if (grp.length === 3) r.triples.push(grp);
            });
            for (let i = 0; i < r.triples.length - 1; i++) {
                if (r.triples[i+1][0].p === r.triples[i][0].p + 1) {
                    r.plates.push(r.triples[i].concat(r.triples[i+1]));
                }
            }
            for (let i = 0; i < r.pairs.length - 2; i++) {
                if (r.pairs[i+1][0].p === r.pairs[i][0].p + 1 && r.pairs[i+2][0].p === r.pairs[i+1][0].p + 1) {
                    r.tubes.push(r.pairs[i].concat(r.pairs[i+1], r.pairs[i+2]));
                }
            }
            return r;
        }

        function findMatch(g, l) {
            if (l.type === '1') { for (let s of g.singles) if (s[0].p > l.val) return s; }
            if (l.type === '2') { for (let p of g.pairs) if (p[0].p > l.val) return p; }
            if (l.type === '3') { for (let t of g.triples) if (t[0].p > l.val) return t; }
            if (l.type === 'plate') { for (let p of g.plates) if (p[0].p > l.val) return p; }
            if (l.type === 'tube') { for (let t of g.tubes) if (t[0].p > l.val) return t; }
            return null;
        }

        function findBomb(g, l) {
            for (let b of g.bombs) {
                let t = { type:'bomb', val:b[0].p, count:b.length, score:b.length * 100 };
                if (canBeat(b, t, l)) return b;
            }
            return null;
        }

        function initLadder() {
            ladderData = [];
            for (let i = 1; i <= 4; i++) ladderData.push({ r:myRank-i, n:`Player-${900+i}`, s:myScore+i*10 });
            ladderData.push({ r:myRank, n:'YOU', s:myScore, me:true });
            for (let i = 1; i <= 4; i++) ladderData.push({ r:myRank+i, n:`Bot-${800+i}`, s:myScore-i*10 });
            renderLadder();
        }

        function renderLadder() {
            let l = document.getElementById('ladder-list');
            ladderData.sort((a, b) => b.s - a.s);
            let idx = ladderData.findIndex(d => d.me);
            let start = Math.max(1, 46 - 4);
            myRank = start + idx;
            l.innerHTML = '';
            ladderData.forEach((d, i) => {
                let li = document.createElement('li');
                li.className = `l-item ${d.me ? 'me' : ''}`;
                li.innerHTML = `<span class="l-rank">#${start+i}</span><span class="l-name">${d.n}</span><span class="l-score">${d.s}</span>`;
                l.appendChild(li);
            });
            document.getElementById('disp-score').innerText = myScore.toLocaleString();
            document.getElementById('disp-rank').innerHTML = `#${myRank}`;
        }

        function toggleVIP() {
            let panel = document.getElementById('vip-panel');
            panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
            AudioSys.play('click');
        }

        function findCards(type) {
            AudioSys.play('click');
            if (type === 'reset') {
                if (originalCardsOrder.length > 0) {
                    myCards = [...originalCardsOrder];
                    myCards.forEach(c => c.sel = false);
                    renderHand();
                    toast("已恢复原状");
                } else toast("无法恢复");
                return;
            }
            myCards.forEach(c => c.sel = false);
            let found = null;
            if (type === 'straight_flush') {
                for (let suit of ['♠','♥','♣','♦']) {
                    let sameSuit = myCards.filter(c => c.s === suit && c.s !== 'JOKER');
                    if (sameSuit.length >= 5) {
                        sameSuit.sort((a, b) => a.p - b.p);
                        for (let i = 0; i <= sameSuit.length - 5; i++) {
                            let seq = sameSuit.slice(i, i + 5);
                            let isSeq = true;
                            for (let j = 0; j < 4; j++) {
                                if (seq[j+1].p !== seq[j].p + 1) { isSeq = false; break; }
                            }
                            if (isSeq) { found = seq; break; }
                        }
                    }
                    if (found) break;
                }
            }
            if (found && found.length > 0) {
                let foundIds = found.map(c => c.id);
                myCards.forEach(c => { if (foundIds.includes(c.id)) c.sel = true; });
                renderHand();
                toast("找到同花顺!");
            } else toast("未找到同花顺");
        }
    </script>
