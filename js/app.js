/** App entry point. G.App */
(function() {
    const G = window.G;
    const C = G.Card;
    const S = G.Scoring;

    /* ===== Audio System (oscillator-based) ===== */
    const AudioSys = {
        _ctx: null,
        _getCtx() {
            if (!this._ctx) {
                try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); }
                catch(e) { return null; }
            }
            if (this._ctx.state === 'suspended') this._ctx.resume();
            return this._ctx;
        },
        _beep(freq, dur, type, vol) {
            const ctx = this._getCtx(); if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.value = freq;
            gain.gain.value = vol || 0.08;
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + dur);
        },
        deal() { this._beep(800, 0.06, 'square', 0.04); },
        snap() { this._beep(600, 0.1, 'triangle', 0.06); },
        click() { this._beep(1200, 0.03, 'sine', 0.05); },
        bomb() {
            this._beep(200, 0.15, 'sawtooth', 0.08);
            setTimeout(() => this._beep(150, 0.2, 'sawtooth', 0.06), 80);
        },
        win() { this._beep(523, 0.15, 'sine', 0.06); setTimeout(() => this._beep(659, 0.15, 'sine', 0.06), 150); setTimeout(() => this._beep(784, 0.25, 'sine', 0.06), 300); },
        lose() { this._beep(400, 0.2, 'sine', 0.05); setTimeout(() => this._beep(300, 0.3, 'sine', 0.05), 200); },
        rankUp() { this._beep(523, 0.12, 'sine', 0.07); setTimeout(() => this._beep(659, 0.12, 'sine', 0.07), 120); setTimeout(() => this._beep(784, 0.12, 'sine', 0.07), 240); setTimeout(() => this._beep(1047, 0.3, 'sine', 0.08), 360); },
    };

    // Website URL for QR code — set to your deployed URL
    // When running on the real site, uses current URL automatically
    const SITE_URL = (function() {
        const h = window.location.href.split('?')[0];
        if (h.startsWith('file://') || h.includes('localhost') || h.includes('127.0.0.1')) {
            return 'https://aiguandan.au';
        }
        return h;
    })();

    function getTestedCount(myGames) {
        const d = new Date();
        const daySeed = d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
        const base = 8000 + (daySeed % 5000);
        return base + myGames;
    }

    function isUnlocked(stats) {
        return stats.totalGames >= 3 || (stats.finishPositions[0] || 0) >= 1;
    }

    function renderMiniQR(container, size) {
        size = size || 72;
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.width = size * 2; canvas.height = size * 2;
        canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);

        // Use real qrcode-generator library if loaded
        if (typeof qrcode !== 'undefined') {
            try {
                const qr = qrcode(0, 'M');
                qr.addData(SITE_URL);
                qr.make();
                const mc = qr.getModuleCount();
                const cell = size / mc;
                ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = '#000';
                for (let r = 0; r < mc; r++) for (let c = 0; c < mc; c++) {
                    if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell, cell);
                }
                container.appendChild(canvas);
                return;
            } catch(e) {}
        }

        // Fallback: decorative pattern
        const text = SITE_URL;
        const modules = 21, cellSize = size / modules;
        const matrix = Array(modules).fill(null).map(() => Array(modules).fill(false));
        function drawFinder(r, c) { for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) { const border = y === 0 || y === 6 || x === 0 || x === 6; const inner = y >= 2 && y <= 4 && x >= 2 && x <= 4; matrix[r + y][c + x] = border || inner; } }
        drawFinder(0, 0); drawFinder(0, modules - 7); drawFinder(modules - 7, 0);
        for (let i = 8; i < modules - 8; i++) { matrix[6][i] = i % 2 === 0; matrix[i][6] = i % 2 === 0; }
        let hash = 0; for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
        for (let r = 9; r < modules - 8; r++) for (let c = 9; c < modules - 8; c++) { if (c === 6 || r === 6) continue; hash = ((hash << 5) - hash + r * 31 + c * 17) | 0; matrix[r][c] = (Math.abs(hash) % 3) < 1; }
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#000';
        for (let r = 0; r < modules; r++) for (let c = 0; c < modules; c++) if (matrix[r][c]) ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        container.appendChild(canvas);
    }

    class App {
        constructor() {
            this.game = null; this.ai = new G.AIAgent(); this.ui = new G.UIRenderer();
            this.stats = S.loadStats(); this.mySeat = 0; this.gameRunning = false;
            this.aiThinkDelay = 800; this._lastGameScore = null;
            this._timer = null; this._timerSec = 0;
        }

        init() { this._bindEvents(); this._updateSplash(); this._loadModel(); }

        async _loadModel() {
            const bar = document.getElementById('loading-bar-fill');
            const pct = document.getElementById('loading-pct');
            const txt = document.getElementById('loading-text');
            const badge = document.getElementById('ai-status');

            const setProgress = (p, label) => {
                if (bar) bar.style.width = p + '%';
                if (pct) pct.textContent = Math.round(p) + '%';
                if (txt && label) txt.textContent = label;
            };

            // Configure ONNX for iOS Safari: single-threaded wasm (no SharedArrayBuffer needed)
            try {
                if (typeof ort !== 'undefined' && ort.env && ort.env.wasm) {
                    ort.env.wasm.numThreads = 1;
                }
            } catch(e) {}

            setProgress(5, 'Fetching AI model...');

            const MODEL_PATH = 'onnx_model/guandan_dmc.onnx';
            let buffer = null;

            // Step 1: Download model file
            try {
                const response = await fetch(MODEL_PATH);
                if (!response.ok) throw new Error('HTTP ' + response.status);

                const contentLength = response.headers.get('content-length');
                const total = contentLength ? parseInt(contentLength, 10) : 0;

                // Try streaming (for real progress bar) — not supported on all iOS
                if (response.body && typeof response.body.getReader === 'function') {
                    try {
                        const reader = response.body.getReader();
                        const chunks = [];
                        let loaded = 0;
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            chunks.push(value);
                            loaded += value.length;
                            if (total > 0) {
                                const p = 5 + Math.round(loaded / total * 75);
                                const mb = (loaded / 1048576).toFixed(1);
                                const totalMb = (total / 1048576).toFixed(1);
                                setProgress(p, mb + ' / ' + totalMb + ' MB');
                            } else {
                                setProgress(40, (loaded / 1048576).toFixed(1) + ' MB...');
                            }
                        }
                        const merged = new Uint8Array(loaded);
                        let offset = 0;
                        for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
                        buffer = merged.buffer;
                    } catch(streamErr) {
                        // Streaming failed — fall back to arrayBuffer()
                        buffer = null;
                    }
                }

                // Fallback: arrayBuffer() with animated progress (iOS compatible)
                if (!buffer) {
                    setProgress(20, 'Downloading...');
                    // Animate bar while waiting
                    let animP = 20;
                    const animId = setInterval(() => {
                        if (animP < 75) { animP += 2; setProgress(animP, 'Downloading...'); }
                    }, 400);
                    try {
                        buffer = await response.arrayBuffer();
                    } catch(e) {
                        clearInterval(animId);
                        throw e;
                    }
                    clearInterval(animId);
                }
            } catch(fetchErr) {
                console.warn('Fetch failed, trying direct load:', fetchErr);
            }

            // Step 2: Create ONNX session
            setProgress(82, 'Initializing AI...');
            try {
                if (buffer) {
                    await this.ai.loadFromBuffer(buffer);
                } else {
                    // Last resort: pass URL directly to ONNX (may not support streaming on iOS)
                    await this.ai.loadModel(MODEL_PATH);
                }
                setProgress(100, 'AI ready ✓');
                if (badge) { badge.textContent = 'ONNX'; badge.className = 'ai-status ai-ready'; }
            } catch(onnxErr) {
                console.warn('ONNX failed:', onnxErr);
                setProgress(100, 'Using basic AI');
                if (badge) { badge.textContent = 'RNG'; badge.className = 'ai-status ai-fallback'; }
            }
        }

        _bindEvents() {
            document.getElementById('btn-start')?.addEventListener('click', () => this._startGame());
            document.getElementById('btn-play')?.addEventListener('click', () => { AudioSys.click(); this._onPlay(); });
            document.getElementById('btn-pass')?.addEventListener('click', () => { AudioSys.click(); this._onPass(); });
            document.getElementById('btn-hint')?.addEventListener('click', () => { AudioSys.click(); this._onHint(); });
            document.getElementById('btn-menu')?.addEventListener('click', () => this._showSplash());
            document.getElementById('btn-again')?.addEventListener('click', () => this._startGame());
            document.getElementById('btn-share')?.addEventListener('click', () => this._showShareModal());
            document.getElementById('share-save-btn')?.addEventListener('click', () => {
                const c = document.querySelector('#share-modal canvas');
                if (c) G.Share.saveCanvasAsImage(c);
            });
            document.getElementById('share-share-btn')?.addEventListener('click', () => {
                const c = document.querySelector('#share-modal canvas');
                if (c) G.Share.shareCard(c);
            });
            document.getElementById('share-close-btn')?.addEventListener('click', () => this._hideShareModal());
        }

        _updateSplash() {
            const el = document.getElementById('splash-tested');
            if (el) el.textContent = getTestedCount(this.stats.totalGames).toLocaleString() + ' players tested';
        }

        async _startGame() {
            document.getElementById('splash-screen')?.classList.add('hidden');
            document.getElementById('result-screen')?.classList.remove('active');
            document.getElementById('game-screen')?.classList.add('active');
            this.game = new G.GameEngine.GameState();
            this.mySeat = 0; this.gameRunning = true;
            this.ui.clearFinishInfo();
            this.ui.clearAllPlayAreas();
            this._renderFullBoard();
            this._dealAnimation();
            await this._delay(600);
            this._gameLoop();
        }

        _renderFullBoard() {
            const counts = this.game.cardsRemaining();
            const relMap = [
                {pos:'right', seat:(this.mySeat+1)%4, name:'AI-右', tm:false},
                {pos:'top',   seat:(this.mySeat+2)%4, name:'队友', tm:true},
                {pos:'left',  seat:(this.mySeat+3)%4, name:'AI-左', tm:false},
            ];
            for (const {pos, seat, name, tm} of relMap)
                this.ui.renderOpponent(pos, counts[seat], name, tm, seat);
            this.ui.renderMyHand(this.game.hands[this.mySeat], this.game.lastHand);
            this.ui.updateGameInfo('第 ' + (this.stats.totalGames + 1) + ' 局');
        }

        _dealAnimation() {
            const cards = document.querySelectorAll('#hand .stack-card');
            cards.forEach((card, i) => {
                card.classList.add('anim-deal');
                card.style.animationDelay = (i * 0.03) + 's';
                AudioSys.deal();
            });
            setTimeout(() => {
                cards.forEach(c => { c.classList.remove('anim-deal'); c.style.animationDelay = ''; });
            }, cards.length * 30 + 400);
        }

        async _gameLoop() {
            while (this.gameRunning && !this.game.gameOver) {
                const seat = this.game.turn;
                this.ui.showTurnIndicator(seat, this.mySeat);
                if (seat === this.mySeat) {
                    this.ui.setActionsEnabled(true, this.game.lastHand !== null);
                    this._startTimer();
                    return;
                } else {
                    await this._doAITurn(seat);
                }
            }
        }

        async _doAITurn(seat) {
            const rel = ((seat - this.mySeat) + 4) % 4;
            const pos = ['bottom','right','top','left'][rel];
            this.ui.showThinking(pos);
            await this._delay(this.aiThinkDelay + Math.random() * 400);
            let move;
            try { move = await this.ai.chooseMove(this.game, seat); }
            catch(e) { const ms = this.game.getLegalMoves(); move = ms[Math.floor(Math.random() * ms.length)]; }
            this.ui.clearThinking(pos);
            const result = this.game.step(move);

            if (move.length > 0) {
                const ht = result.handType;
                if (ht && (ht.type === 'bomb' || ht.type === 'straight_flush')) AudioSys.bomb();
                else AudioSys.snap();
            }

            const outId = pos === 'top' ? 'out-top' : pos === 'left' ? 'out-left' : 'out-right';
            this.ui.showPlayedCards(pos, move, result.handType || null);
            this.ui.dimOtherAreas(outId);

            const counts = this.game.cardsRemaining();
            const relMap = [
                {pos:'right', seat:(this.mySeat+1)%4, name:'AI-右', tm:false},
                {pos:'top',   seat:(this.mySeat+2)%4, name:'队友', tm:true},
                {pos:'left',  seat:(this.mySeat+3)%4, name:'AI-左', tm:false},
            ];
            for (const {pos:p, seat:s, name, tm} of relMap)
                this.ui.renderOpponent(p, counts[s], name, tm, s);

            if (result.gameOver) {
                this.gameRunning = false;
                await this._delay(500);
                this._showResult(result);
                return;
            }
            if (result.isRoundEnd) {
                await this._delay(600);
                this.ui.clearAllPlayAreas();
            }
        }

        _onPlay() {
            this._stopTimer();
            this._hintOptions = []; this._hintIndex = 0;
            const uids = this.ui.getSelectedUids();
            if (uids.length === 0) return;
            const ht = G.HandDetector.detectHand(uids);
            if (!ht) { this._showToast('无效的牌型'); return; }
            try {
                const result = this.game.step(uids);

                if (ht.type === 'bomb' || ht.type === 'straight_flush') AudioSys.bomb();
                else AudioSys.snap();

                this.ui.showPlayedCards('me', uids, ht);
                this.ui.dimOtherAreas('out-me');
                this.ui.setActionsEnabled(false);
                this.ui.renderMyHand(this.game.hands[this.mySeat], this.game.lastHand);

                if (result.gameOver) {
                    this.gameRunning = false;
                    setTimeout(() => this._showResult(result), 800);
                    return;
                }
                if (result.isRoundEnd) {
                    setTimeout(() => { this.ui.clearAllPlayAreas(); this._gameLoop(); }, 800);
                } else {
                    setTimeout(() => this._gameLoop(), 300);
                }
            } catch(e) {
                this._showToast(e.message.includes('Cannot beat') ? '打不过上家' : '无效出牌');
            }
        }

        _onPass() {
            this._stopTimer();
            this._hintOptions = []; this._hintIndex = 0;
            if (this.game.lastHand === null) { this._showToast('自由出牌，不能跳过'); return; }
            const result = this.game.step([]);
            this.ui.showPlayedCards('me', [], null);
            this.ui.dimOtherAreas('out-me');
            this.ui.setActionsEnabled(false);
            if (result.isRoundEnd) setTimeout(() => { this.ui.clearAllPlayAreas(); this._gameLoop(); }, 800);
            else setTimeout(() => this._gameLoop(), 300);
        }

        _onHint() {
            if (this._hintOptions && this._hintOptions.length > 0 && this._hintIndex > 0) {
                if (this._hintIndex >= this._hintOptions.length) {
                    this._hintOptions = [];
                    this._hintIndex = 0;
                    this._clearSelections();
                    this._showToast('已重选');
                    return;
                }
            }

            const moves = this.game.getLegalMoves().filter(m => m.length > 0);
            if (moves.length === 0) {
                this._showToast('没牌可出');
                return;
            }

            if (!this._hintOptions || this._hintOptions.length === 0) {
                this._hintOptions = this._sortHintMoves(moves);
                this._hintIndex = 0;
            }

            if (this._hintIndex >= this._hintOptions.length) {
                this._hintOptions = [];
                this._hintIndex = 0;
                this._clearSelections();
                this._showToast('已重选');
                return;
            }

            this._clearSelections();
            const hint = this._hintOptions[this._hintIndex];
            const need = new Map();
            for (const uid of hint) need.set(uid, (need.get(uid) || 0) + 1);
            const used = new Map();
            document.querySelectorAll('.stack-card').forEach((card, idx) => {
                const uid = parseInt(card.dataset.uid);
                const n = need.get(uid) || 0, u = used.get(uid) || 0;
                if (u < n) {
                    used.set(uid, u + 1);
                    this.ui.selectedCards.add(idx);
                    card.classList.add('selected');
                }
            });

            const ht = G.HandDetector.detectHand(hint);
            const HAND_NAMES = {
                'single':'单牌','pair':'对子','triple':'三条',
                'fullhouse':'三带二','straight':'顺子','straight_flush':'同花顺',
                'plate':'钢板','tube':'管子','bomb':'炸弹',
            };
            const label = ht ? (HAND_NAMES[ht.type] || ht.type) : '';
            this._showToast('提示: ' + label + ' (' + (this._hintIndex + 1) + '/' + this._hintOptions.length + ')');
            this._hintIndex++;

            const pb = document.getElementById('btn-play');
            if (pb) pb.disabled = this.ui.selectedCards.size === 0;
        }

        _clearSelections() {
            document.querySelectorAll('.stack-card.selected').forEach(e => e.classList.remove('selected'));
            this.ui.selectedCards.clear();
            const pb = document.getElementById('btn-play');
            if (pb) pb.disabled = true;
        }

        _sortHintMoves(moves) {
            const game = this.game;
            const mySeat = this.mySeat;
            const teammate = (mySeat + 2) % 4;
            const lastOwner = game.lastHandOwner;

            let totalCards = 0;
            for (let i = 0; i < C.NUM_UNIQUE; i++) totalCards += game.hands[mySeat][i];

            if (lastOwner === teammate && game.lastHand !== null) {
                const clearMoves = moves.filter(m => m.length >= totalCards);
                if (clearMoves.length > 0) return clearMoves;
                return moves;
            }

            const typed = moves.map(m => {
                const ht = G.HandDetector.detectHand(m);
                return { move: m, handType: ht };
            });

            if (game.lastHand === null) {
                const typePriority = {
                    'straight_flush': 0, 'straight': 1, 'plate': 2, 'tube': 3,
                    'fullhouse': 4, 'pair': 5, 'triple': 6, 'single': 7, 'bomb': 8
                };
                typed.sort((a, b) => {
                    const pa = typePriority[a.handType?.type] ?? 9;
                    const pb = typePriority[b.handType?.type] ?? 9;
                    if (pa !== pb) return pa - pb;
                    return (a.handType?.rank || 0) - (b.handType?.rank || 0);
                });
            } else {
                typed.sort((a, b) => {
                    const aIsBomb = a.handType?.type === 'bomb' || a.handType?.type === 'straight_flush';
                    const bIsBomb = b.handType?.type === 'bomb' || b.handType?.type === 'straight_flush';
                    if (aIsBomb !== bIsBomb) return aIsBomb ? 1 : -1;
                    return (a.handType?.rank || 0) - (b.handType?.rank || 0);
                });
            }
            return typed.map(t => t.move);
        }

        /* ===== Timer ===== */
        _startTimer() {
            this._stopTimer();
            this._timerSec = 60;
            const ctrls = document.getElementById('ctrls');
            let timerEl = document.getElementById('turn-timer');
            if (!timerEl) {
                timerEl = document.createElement('div');
                timerEl.id = 'turn-timer';
                timerEl.className = 'timer';
                ctrls?.parentElement?.appendChild(timerEl);
            }
            if (ctrls) {
                timerEl.style.position = 'absolute';
                timerEl.style.bottom = '300px';
                timerEl.style.left = '50%';
                timerEl.style.transform = 'translateX(-50%)';
                timerEl.style.zIndex = '26';
            }
            this._updateTimerDisplay(timerEl);
            this._timer = setInterval(() => {
                this._timerSec--;
                this._updateTimerDisplay(timerEl);
                if (this._timerSec <= 0) {
                    this._stopTimer();
                    if (this.game.lastHand !== null) this._onPass();
                    else {
                        this._onHint();
                        setTimeout(() => this._onPlay(), 200);
                    }
                }
            }, 1000);
        }

        _updateTimerDisplay(el) {
            if (!el) return;
            el.textContent = this._timerSec + 's';
            if (this._timerSec <= 10) el.classList.add('urgent');
            else el.classList.remove('urgent');
        }

        _stopTimer() {
            if (this._timer) { clearInterval(this._timer); this._timer = null; }
            const timerEl = document.getElementById('turn-timer');
            if (timerEl) timerEl.remove();
        }

        /* ===== ELO Float Animation ===== */
        _showEloFloat(delta) {
            const el = document.createElement('div');
            el.className = 'elo-float ' + (delta >= 0 ? 'positive' : 'negative');
            el.textContent = (delta >= 0 ? '+' : '') + delta;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 2200);
        }

        /* ===== Rank Up Animation ===== */
        _showRankUp(newTier) {
            AudioSys.rankUp();
            const overlay = document.createElement('div');
            overlay.className = 'rank-up-overlay';
            overlay.innerHTML = '<div class="rank-up-burst"></div>' +
                '<div class="rank-up-badge">' + newTier.icon + '</div>' +
                '<div class="rank-up-text">晋级! ' + newTier.name + '</div>';
            document.body.appendChild(overlay);
            setTimeout(() => overlay.remove(), 2800);
        }

        /* ===== Result ===== */
        _showResult(result) {
            this._stopTimer();
            const myTeam = C.TEAM_A.includes(this.mySeat) ? C.TEAM_A : C.TEAM_B;
            const topTwo = result.finishOrder.slice(0, 2);
            const win = result.finishOrder.indexOf(this.mySeat) < 2;
            const gs = S.calculateGameScore(
                {finishOrder: result.finishOrder, bombCounts: this.game.bombCounts}, this.mySeat);

            const updateResult = S.updateStats(this.stats, gs);
            this.stats = updateResult.stats;

            if (win) AudioSys.win(); else AudioSys.lose();
            if (updateResult.tierUp) setTimeout(() => this._showRankUp(updateResult.newTier), 800);

            document.getElementById('game-screen')?.classList.remove('active');
            document.getElementById('result-screen')?.classList.add('active');

            // Outcome bar (weakened)
            const titleEl = document.getElementById('result-title');
            if (titleEl) {
                titleEl.textContent = win ? '胜利' : '失败';
                titleEl.className = 'rout-title ' + (win ? 'win' : 'lose');
            }
            const subEl = document.getElementById('result-subtitle');
            if (subEl) subEl.textContent = myTeam.every(s => topTwo.includes(s)) ? '双上游' : gs.positionLabel;
            const deltaEl = document.getElementById('result-elo-change');
            if (deltaEl) {
                const d = gs.eloDelta;
                deltaEl.textContent = (d >= 0 ? '+' : '') + d + ' ELO';
                deltaEl.className = 'rout-delta ' + (d >= 0 ? 'pos' : 'neg');
            }

            // MAIN: skill index + stars
            const unlocked = isUnlocked(this.stats);
            const starRating = S.getStarRating(this.stats.elo);
            const STAR_NAMES = ['零星','一星','二星','三星','四星','满星'];

            const tierIconEl   = document.getElementById('result-tier-icon');
            const skillIndexEl = document.getElementById('result-skill-index');
            const starsEl      = document.getElementById('result-stars');
            const skillLvlEl   = document.getElementById('result-skill-level');
            const legendRankEl = document.getElementById('result-legend-rank');
            const legendNumEl  = document.getElementById('result-legend-num');
            const lockEl       = document.getElementById('result-elo-lock');
            const lockRemainEl = document.getElementById('result-lock-remain');

            if (tierIconEl) tierIconEl.textContent = unlocked ? starRating.tier.icon : '🔒';

            if (unlocked) {
                if (skillIndexEl) { skillIndexEl.textContent = this.stats.elo.toLocaleString(); skillIndexEl.className = 'result-skill-index'; }
                if (lockEl) lockEl.style.display = 'none';

                if (starRating.isLegend) {
                    if (starsEl) starsEl.innerHTML = '';
                    if (legendRankEl) legendRankEl.style.display = 'block';
                    if (legendNumEl) legendNumEl.textContent = starRating.legendRank.toLocaleString();
                    if (skillLvlEl) skillLvlEl.textContent = '实力等级 · 宗师';
                } else {
                    if (legendRankEl) legendRankEl.style.display = 'none';
                    const starLabel = starRating.starsEarned === 5 ? '满星' : STAR_NAMES[starRating.starsEarned];
                    if (skillLvlEl) skillLvlEl.textContent = '实力等级 · ' + starRating.tier.name + starLabel;
                    if (starsEl) {
                        starsEl.innerHTML = '';
                        for (let i = 0; i < starRating.totalStars; i++) {
                            const star = document.createElement('span');
                            const filled = i < starRating.starsEarned;
                            star.className = 'star-icon ' + (filled ? 'filled' : 'empty');
                            star.textContent = '★';
                            if (filled) star.style.color = starRating.tier.color;
                            starsEl.appendChild(star);
                        }
                    }
                }
            } else {
                if (skillIndexEl) { skillIndexEl.textContent = '???'; skillIndexEl.className = 'result-skill-index locked'; }
                if (starsEl) starsEl.innerHTML = '';
                if (legendRankEl) legendRankEl.style.display = 'none';
                if (skillLvlEl) skillLvlEl.textContent = '实力等级 · 未解锁';
                if (lockEl) lockEl.style.display = 'block';
                if (lockRemainEl) lockRemainEl.textContent = Math.max(0, 3 - this.stats.totalGames);
            }

            // Rankings with thresholds
            const RANK_THRESHOLDS = {national: 5000, province: 1000, city: 200};
            for (const scope of ['national', 'province', 'city']) {
                const el = document.getElementById('rank-' + scope);
                if (!el) continue;
                if (unlocked) {
                    const r = S.estimatePercentile(this.stats.elo, scope);
                    const threshold = RANK_THRESHOLDS[scope];
                    el.textContent = r.rank <= threshold ? '#' + r.rank.toLocaleString() : threshold.toLocaleString() + '+';
                    el.className = 'result-rank-val';
                } else {
                    el.textContent = '—';
                    el.className = 'result-rank-val locked-rank';
                }
            }

            const qrBox = document.getElementById('result-qr-box');
            if (qrBox) renderMiniQR(qrBox, 130);

            const scroll = document.querySelector('.result-scroll');
            if (scroll) scroll.scrollTop = 0;

            this._lastGameScore = gs;
        }



        /* ===== Toast ===== */
        _showToast(msg) {
            const t = document.getElementById('toast');
            if (!t) return;
            t.textContent = msg;
            t.style.opacity = '1';
            setTimeout(() => t.style.opacity = '0', 1500);
        }

        /* ===== Screens ===== */
        _showShareModal() {
            document.getElementById('share-modal')?.classList.add('active');
            const c = document.getElementById('share-card-area');
            if (c) { c.innerHTML = ''; c.appendChild(G.Share.generateShareCard(this.stats, this._lastGameScore)); }
        }
        _hideShareModal() { document.getElementById('share-modal')?.classList.remove('active'); }

        _showSplash() {
            this._stopTimer();
            ['game-screen','result-screen'].forEach(id =>
                document.getElementById(id)?.classList.remove('active'));
            document.getElementById('splash-screen')?.classList.remove('hidden');
            this.gameRunning = false;
            this._updateSplash();
        }

        _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
    }

    window.addEventListener('DOMContentLoaded', () => { const app = new App(); app.init(); window.app = app; });
})();
