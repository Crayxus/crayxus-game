/**
 * Demo Mode — Full scripted walkthrough of Guandan AI
 * ====================================================
 * Uses the REAL game UI with FAKE data. Every step is pre-scripted.
 * User clicks to advance. 蛋蛋 narrates the whole thing.
 *
 * Scenes:
 *   1. Welcome        — 蛋蛋 greets on home screen
 *   2. Enter game      — transition to game UI
 *   3. Deal cards      — dealing animation with fake hand
 *   4. Hand evaluation — 蛋蛋 comments on the hand
 *   5. Free play       — auto-select and play cards
 *   6. Opponent plays   — opponent takes turn
 *   7. Follow play     — your turn, must beat opponent
 *   8. AI Coach        — show hint panel
 *   9. Pass            — demonstrate passing
 *  10. Bomb!           — opponent plays bomb
 *  11. Victory         — game end, you win
 *  12. Back to home    — return to main menu
 *  13. Quiz intro      — enter training mode
 *  14. Quiz question   — show a fake question
 *  15. Quiz result     — answer and show feedback
 *  16. Done            — demo complete
 *
 * Usage:
 *   Demo.start()
 */

const Demo = (function() {

  let active = false;
  let step = 0;
  let overlay = null;
  let savedState = {};

  // ── Fake card data ──

  // Use same format as server's createDeck
  const BP = {'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15};
  const SQ = {'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13};
  let _cid = 0;
  function card(s, v) {
    const p = s === 'JOKER' ? (v === 'Bg' ? 17 : 16) : BP[v];
    const seq = s === 'JOKER' ? (v === 'Bg' ? 20 : 19) : (SQ[v] || 0);
    return { s, v, p, seq, id: 'demo_' + (++_cid), sel: false };
  }

  // Demo hand: 27 cards, has bomb(4x7), pair of A, jokers
  const DEMO_HAND = [
    card('JOKER', 'Bg'),
    card('JOKER', 'Sm'),
    card('♥', '2'),
    card('♥', 'A'), card('♠', 'A'),
    card('♦', 'K'), card('♣', 'K'),
    card('♥', 'Q'),
    card('♠', 'J'),
    card('♣', '10'), card('♥', '10'),
    card('♠', '9'), card('♦', '9'),
    card('♦', '8'),
    card('♥', '7'), card('♠', '7'), card('♦', '7'), card('♣', '7'),
    card('♥', '6'), card('♠', '6'),
    card('♠', '5'), card('♦', '5'),
    card('♣', '4'), card('♥', '4'),
    card('♥', '3'), card('♠', '3'), card('♦', '3'),
  ];

  // Opponent's cards for demo
  const OPP_SINGLE = [card('♠', 'Q', 12, 30)];
  const OPP_PAIR = [card('♥', '9', 9, 31), card('♦', '9', 9, 32)];
  const OPP_BOMB = [card('♥', 'K', 13, 33), card('♦', 'K', 13, 34), card('♠', 'K', 13, 35), card('♣', 'K', 13, 36)];

  // Fake quiz question
  const FAKE_QUIZ = {
    dim: '出牌时机',
    scenario: '上家(对手)出了单牌♠Q，轮到你出牌',
    hand: [
      { s: '♥', v: 'A', name: '♥A' },
      { s: '♠', v: 'K', name: '♠K' },
      { s: '♦', v: '8', name: '♦8' },
      { s: '♣', v: '5', name: '♣5' },
    ],
    question: '你会怎么出牌？',
    options: [
      { text: '单牌: ♠K', correct: true, explain: 'AI推荐：用K压住Q，夺取牌权，保留A做最后的控制牌' },
      { text: '单牌: ♥A', correct: false, explain: '虽然能压住，但A是最大单牌，过早使用会失去后续控制力' },
      { text: 'PASS', correct: false, explain: '对手只出了Q，有更大的牌可以压，不需要放弃牌权' },
      { text: '单牌: ♦8', correct: false, explain: '8比Q小，无法压住对手的牌' },
    ],
  };

  // ── Scene definitions ──

  const SCENES = [
    // === HOME SCREEN ===
    {
      id: 'welcome',
      setup() {
        _ensureHomeScreen();
      },
      voice: 'welcome_1',
      subtitle: '你好！我是蛋蛋，你的AI掼蛋助手',
      hint: '点击继续',
    },
    {
      id: 'intro',
      voice: 'welcome_2',
      subtitle: '我会陪你一起学习掼蛋，从新手到高手',
      hint: '点击继续',
    },
    {
      id: 'home_explain',
      speak: '这是主界面。左边两个圆球是对战和训练，右边是赛事和大屏控制。现在我带你体验一局完整的掼蛋。',
      subtitle: '左边：对战·训练 | 右边：赛事·大屏',
      hint: '点击进入对战演示',
    },

    // === ENTER GAME ===
    {
      id: 'enter_game',
      setup() {
        _enterFakeGame();
      },
      voice: 'game_start_1',
      subtitle: '新的一局开始了，祝你好运！',
      delay: 500,
      hint: '点击继续',
    },
    {
      id: 'deal',
      setup() {
        _dealFakeCards();
      },
      voice: 'dealing_done',
      subtitle: '发牌完成，看看你的手牌吧',
      delay: 800,
      hint: '点击继续',
    },

    // === HAND EVALUATION ===
    {
      id: 'hand_eval',
      setup() {
        _highlightByMatch([{v:'7',s:'♥'},{v:'7',s:'♠'},{v:'7',s:'♦'},{v:'7',s:'♣'}]);
      },
      voice: 'hand_bomb',
      subtitle: '手里有炸弹！四个7，关键时刻再用',
      hint: '点击继续',
    },
    {
      id: 'hand_eval2',
      setup() {
        _clearHighlight();
        _highlightByMatch([{v:'Bg',s:'JOKER'},{v:'Sm',s:'JOKER'}]);
      },
      speak: '还有大小王，这手牌很强！可以打得积极一些。',
      subtitle: '大小王在手，可以打得积极',
      hint: '点击继续',
    },

    // === YOUR TURN - FREE PLAY ===
    {
      id: 'free_turn',
      setup() {
        _clearHighlight();
        _setMyTurn(true);
      },
      voice: 'your_turn_free',
      subtitle: '自由出牌，你想出什么都行',
      hint: '点击出牌',
    },
    {
      id: 'play_pair',
      setup() {
        const cards = G().myCards;
        cards.forEach(c => c.sel = false);
        const c1 = cards.find(c => c.v === '5' && c.s === '♠');
        const c2 = cards.find(c => c.v === '5' && c.s === '♦');
        if (c1) c1.sel = true;
        if (c2) c2.sel = true;
        console.log('[Demo] Selected 5s:', c1, c2, 'total cards:', cards.length);
        _demoRenderHand();
        // Auto play after delay
        setTimeout(() => {
          _playSelectedCards();
          // Update subtitle
          const sub = document.getElementById('demo-subtitle');
          if (sub) sub.textContent = '出了一对5！';
        }, 2000);
      },
      speak: '我选中一对5，打出去。',
      subtitle: '选中了一对5...',
      autoAdvance: 3500,
      hint: '自动出牌中...',
    },

    // === OPPONENT PLAYS ===
    {
      id: 'opp_plays',
      setup() {
        _opponentPlays(1, OPP_PAIR, { type: '2', val: 9, count: 2 });
      },
      speak: '右边对手出了一对9，比你的5大。',
      subtitle: '对手出了一对9',
      delay: 300,
      hint: '点击继续',
    },

    // === PASS ===
    {
      id: 'partner_pass',
      setup() {
        _opponentPass(2); // partner passes
      },
      voice: 'pass_teammate',
      subtitle: '队友过了',
      delay: 300,
      hint: '点击继续',
    },
    {
      id: 'opp2_pass',
      setup() {
        _opponentPass(3); // left opponent passes
        setTimeout(() => {
          // Round ends, back to seat 1 free play
          _opponentPlays(1, OPP_SINGLE, { type: '1', val: 12, count: 1 });
        }, 500);
      },
      speak: '左边对手也过了。对手拿到牌权，出了一张Q。',
      subtitle: '对手拿到牌权，出了♠Q',
      delay: 600,
      hint: '点击继续',
    },

    // === AI COACH ===
    {
      id: 'coach_intro',
      setup() {
        _setMyTurn(true);
      },
      speak: '现在轮到你了。不知道出什么？可以呼叫AI教练帮你分析。',
      subtitle: '不知道出什么？呼叫AI教练！',
      hint: '点击查看AI建议',
    },
    {
      id: 'coach_show',
      setup() {
        _showFakeCoach();
      },
      voice: 'coach_recommend',
      subtitle: 'AI教练建议你这样出牌',
      hint: '点击关闭教练面板',
    },
    {
      id: 'coach_play',
      setup() {
        _dismissFakeCoach();
        const cards = G().myCards;
        cards.forEach(c => c.sel = false);
        const kd = cards.find(c => c.v === 'K' && c.s === '♦');
        if (kd) kd.sel = true;
        _demoRenderHand();
        setTimeout(() => {
          _playSelectedCards();
          const sub = document.getElementById('demo-subtitle');
          if (sub) sub.textContent = '打得好！用K压住Q';
          if (typeof VoiceSystem !== 'undefined') VoiceSystem.say('play_nice_1');
        }, 2000);
      },
      speak: '按照AI教练建议，出♦K压住对手的Q。',
      subtitle: '选中♦K...',
      autoAdvance: 4000,
      hint: '自动出牌中...',
    },

    // === BOMB ===
    {
      id: 'bomb_scene',
      setup() {
        _opponentPass(2);
        setTimeout(() => _opponentPass(3), 300);
        setTimeout(() => {
          _opponentPlays(1, OPP_BOMB, { type: 'bomb', val: 13, count: 4, score: 400 });
        }, 600);
      },
      voice: 'bomb_played_by_opponent',
      subtitle: '对手出了炸弹！四个K！',
      delay: 800,
      hint: '点击继续',
    },

    // === VICTORY ===
    {
      id: 'victory',
      setup() {
        _showVictory();
      },
      voice: 'win_1',
      subtitle: '恭喜你赢了！表现非常出色',
      delay: 500,
      hint: '点击继续',
    },

    // === BACK TO HOME ===
    {
      id: 'back_home',
      setup() {
        _exitFakeGame();
      },
      speak: '对战演示结束。接下来看看训练模式。',
      subtitle: '接下来体验训练模式',
      delay: 500,
      hint: '点击进入训练演示',
    },

    // === QUIZ ===
    {
      id: 'quiz_intro',
      setup() {
        _showFakeQuiz();
      },
      voice: 'rank_start',
      subtitle: '欢迎参加段位测评',
      delay: 300,
      hint: '点击选择答案',
    },
    {
      id: 'quiz_answer',
      setup() {
        _selectFakeAnswer(0); // select correct answer
      },
      voice: 'quiz_correct',
      subtitle: '回答正确！',
      delay: 500,
      hint: '点击查看解析',
    },
    {
      id: 'quiz_explain',
      setup() {
        _showFakeExplanation();
      },
      speak: FAKE_QUIZ.options[0].explain,
      subtitle: 'AI推荐：用K压Q，保留A控制',
      hint: '点击继续',
    },

    // === CERTIFICATE ===
    {
      id: 'cert',
      setup() {
        _closeFakeQuiz();
        _showFakeCert();
      },
      voice: 'rank_gold',
      subtitle: '黄金段位！你已经是有经验的玩家了',
      hint: '点击继续',
    },

    // === TOURNAMENT ===
    {
      id: 'tournament_intro',
      setup() {
        _closeFakeCert();
        _showFakeTournament();
      },
      speak: '达到黄金段位以上，就可以报名参加我们的线下掼蛋比赛了！',
      subtitle: '黄金段位以上可参加线下比赛！',
      hint: '点击查看报名',
    },
    {
      id: 'tournament_signup',
      setup() {
        _showFakeSignup();
      },
      speak: '选择赛事，填写信息，支付报名费，就能参加比赛了。我们在杭州等你！',
      subtitle: '选择赛事 → 填写信息 → 完成报名',
      hint: '点击继续',
    },

    // === DONE ===
    {
      id: 'done',
      setup() {
        _closeFakeTournament();
        _closeFakeCert();
        _closeFakeQuiz();
        _ensureHomeScreen();
      },
      voice: 'guide_done',
      subtitle: '教程完成！开始你的掼蛋之旅吧！',
      hint: '点击结束演示',
    },
  ];

  // ── Overlay UI ──

  function _createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'demo-overlay';
    overlay.innerHTML = `
      <style>
      #demo-bar{position:fixed;bottom:0;left:0;right:0;z-index:10010;
        background:linear-gradient(0deg,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.5) 70%,transparent 100%);
        padding:12px 30px 16px;text-align:center;pointer-events:all;cursor:pointer;
        transition:opacity 0.3s}
      #demo-subtitle{color:#fff;font-size:22px;font-weight:600;letter-spacing:1px;
        text-shadow:0 0 20px rgba(255,215,0,0.4);margin-bottom:8px;
        min-height:30px;transition:opacity 0.2s}
      #demo-hint{color:rgba(255,215,0,0.6);font-size:13px}
      #demo-progress{display:flex;gap:4px;justify-content:center;margin-top:10px}
      #demo-progress .dp{width:6px;height:6px;border-radius:50%;background:#444;transition:background 0.3s}
      #demo-progress .dp.done{background:#ffd700}
      #demo-progress .dp.cur{background:#00e5ff;box-shadow:0 0 8px #00e5ff}
      #demo-skip{position:fixed;top:20px;right:20px;z-index:10011;
        padding:8px 18px;border-radius:8px;cursor:pointer;pointer-events:all;
        background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);
        color:#aaa;font-size:13px;transition:all 0.2s}
      #demo-skip:hover{background:rgba(255,255,255,0.2);color:#fff}
      #demo-badge{position:fixed;top:20px;left:20px;z-index:10011;
        padding:6px 14px;border-radius:20px;pointer-events:none;
        background:rgba(255,107,53,0.2);border:1px solid rgba(255,107,53,0.4);
        color:#ff6b35;font-size:12px;font-weight:700;letter-spacing:1px}
      </style>
      <div id="demo-badge">DEMO</div>
      <div id="demo-skip" onclick="Demo.stop()">跳过演示</div>
      <div id="demo-bar" onclick="Demo.next()">
        <div id="demo-subtitle"></div>
        <div id="demo-hint"></div>
        <div id="demo-progress"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Build progress dots
    const prog = document.getElementById('demo-progress');
    for (let i = 0; i < SCENES.length; i++) {
      const d = document.createElement('div');
      d.className = 'dp';
      prog.appendChild(d);
    }
  }

  function _updateOverlay(scene, idx) {
    const sub = document.getElementById('demo-subtitle');
    const hint = document.getElementById('demo-hint');
    if (sub) {
      sub.style.opacity = '0';
      setTimeout(() => {
        sub.textContent = scene.subtitle || '';
        sub.style.opacity = '1';
      }, 150);
    }
    if (hint) hint.textContent = scene.hint || '';

    // Update progress dots
    const dots = document.querySelectorAll('#demo-progress .dp');
    dots.forEach((d, i) => {
      d.className = 'dp' + (i < idx ? ' done' : '') + (i === idx ? ' cur' : '');
    });
  }

  // ── Scene helpers ──

  function _ensureHomeScreen() {
    if (typeof switchScreen === 'function') {
      switchScreen('mode-select');
    }
    const g = document.getElementById('game-ui');
    if (g) g.style.display = 'none';
  }

  // Accessor — use _gameState bridge to reach let-scoped game variables
  const G = () => window._gameState || {};

  function _enterFakeGame() {
    // Save state
    savedState.myCards = G().myCards ? [...G().myCards] : [];
    savedState.mySeat = G().mySeat || 0;
    savedState.turn = G().turn || -1;
    savedState.gameOver = G().gameOver || false;
    savedState.gameMode = G().gameMode || 'casual';

    // Hide screens
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
      s.style.display = 'none';
    });

    // Init game state via bridge
    G().mySeat = 0;
    G().turn = -1;
    G().gameOver = false;
    G().isMyTurn = false;
    G().lastHand = null;
    G().counts = [27, 27, 27, 27];
    G().finishOrder = [];
    G().myCards = [];
    G().currentWildValue = '2';
    G().gameMode = 'casual';

    // Show game UI
    const g = document.getElementById('game-ui');
    if (g) {
      g.style.display = 'flex';
      g.style.opacity = '1';
    }

    // Clear output zones
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById('out-' + i);
      if (el) el.innerHTML = '';
    }

    // Clear hand and reset its style to original CSS
    const hand = document.getElementById('hand');
    if (hand) { hand.innerHTML = ''; hand.removeAttribute('style'); }

    try { if (typeof renderUI === 'function') renderUI(); } catch(e) { console.warn('[Demo] renderUI error:', e); }
  }

  function _dealFakeCards() {
    G().myCards = DEMO_HAND.map(c => ({ ...c, sel: false }));
    G().counts = [27, 27, 27, 27];

    // Reset #hand to original CSS (remove any demo overrides)
    const hand = document.getElementById('hand');
    if (hand) hand.removeAttribute('style');

    _demoRenderHand();
  }

  function _demoRenderHand() {
    const hand = document.getElementById('hand');
    if (!hand) return;
    hand.innerHTML = '';

    // Position above demo bar, full control
    hand.style.cssText = `
      position:absolute !important; bottom:100px; left:0; right:0;
      display:flex !important; justify-content:center; align-items:flex-end;
      gap:4px; z-index:300; height:auto !important;
      padding:0 20px; overflow:visible !important;
    `;

    const cards = G().myCards || [];
    cards.sort((a,b) => b.p - a.p || (a.s > b.s ? 1 : -1));

    // Group by p value (same as original engine)
    const groups = [];
    let curP = null, curGrp = null;
    cards.forEach(c => {
      if (c.p !== curP) { curGrp = { p: c.p, cards: [c] }; groups.push(curGrp); curP = c.p; }
      else curGrp.cards.push(c);
    });

    // Sizing
    const viewW = window.innerWidth - 40;
    const CW = Math.max(50, Math.min(80, Math.floor((viewW - (groups.length - 1) * 4) / groups.length)));
    const CH = Math.round(CW * 1.42);
    const PEEK = Math.round(CW * 0.38);

    groups.forEach(gr => {
      const n = gr.cards.length;
      const stackH = CH + (n - 1) * PEEK;
      const wrap = document.createElement('div');
      wrap.style.cssText = `position:relative; width:${CW}px; height:${stackH}px; flex-shrink:0;`;

      gr.cards.forEach((c, ci) => {
        const isBottom = ci === n - 1;
        const topPos = ci * PEEK;
        const isRed = ['♥', '♦'].includes(c.s) || c.v === 'Bg';
        const isJoker = c.s === 'JOKER';
        const dispVal = isJoker ? '★' : c.v;
        const dispSuit = isJoker ? '' : c.s;
        const jokerLabel = c.v === 'Bg' ? 'BIG' : 'SM';

        // Suit-specific colors
        let suitColorStyle = '';
        if (c.s === '♥') suitColorStyle = 'color:#ff4444;';
        else if (c.s === '♦') suitColorStyle = 'color:#ff8800;';
        else if (c.s === '♣') suitColorStyle = 'color:#22aa44;';
        else if (c.s === '♠') suitColorStyle = 'color:#4488ff;';
        else if (isJoker) suitColorStyle = c.v === 'Bg' ? 'color:#ff2222;' : 'color:#4466ff;';

        const cardDiv = document.createElement('div');
        cardDiv.style.cssText = `
          position:absolute; top:${topPos}px; left:0;
          width:${CW}px; height:${isBottom ? CH : PEEK}px;
          overflow:hidden; z-index:${ci + 1}; cursor:pointer;
          transition: transform 0.15s ease;
          ${c.sel ? 'transform:translateY(-16px);' : ''}
        `;

        const inner = document.createElement('div');
        inner.style.cssText = `
          width:${CW}px; height:${CH}px;
          border-radius:${Math.round(CW * 0.1)}px;
          background:${c.sel ? 'linear-gradient(135deg,#2a2a1a,#1a1a0a)' : 'linear-gradient(135deg,#fff,#e8e8e8)'};
          border:${c.sel ? '2px solid #ffd700' : '1.5px solid #bbb'};
          box-shadow:${c.sel ? '0 0 12px rgba(255,215,0,0.5)' : '0 1px 3px rgba(0,0,0,0.2)'};
          position:relative; box-sizing:border-box;
        `;

        // Peek label (top-left corner)
        const peekSize = Math.max(12, Math.round(CW * 0.22));
        const suitSize = Math.max(10, Math.round(CW * 0.18));
        const centerSize = Math.max(18, Math.round(CW * 0.38));

        inner.innerHTML = `
          <div style="position:absolute;top:3px;left:5px;line-height:1;${suitColorStyle}">
            <div style="font-size:${peekSize}px;font-weight:900">${dispVal}</div>
            <div style="font-size:${suitSize}px;margin-top:1px">${isJoker ? jokerLabel : dispSuit}</div>
          </div>
          ${isBottom ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
            font-size:${centerSize}px;${suitColorStyle};opacity:0.6">${isJoker ? '★' : dispSuit}</div>` : ''}
        `;

        cardDiv.appendChild(inner);
        cardDiv.onclick = (e) => {
          e.stopPropagation();
          c.sel = !c.sel;
          _demoRenderHand();
        };
        wrap.appendChild(cardDiv);
      });

      hand.appendChild(wrap);
    });
  }

  function _renderSafe() {
    _demoRenderHand();
  }

  // Select cards by value+suit match instead of array index
  function _selectByMatch(matches) {
    const cards = G().myCards;
    if (!cards) return;
    cards.forEach(c => c.sel = false);
    matches.forEach(m => {
      const found = cards.find(c => !c.sel && c.v === m.v && (m.s === '*' || c.s === m.s));
      if (found) found.sel = true;
    });
    _renderSafe();
  }

  function _highlightByMatch(matches) {
    const cards = G().myCards;
    if (!cards) return;
    matches.forEach(m => {
      const found = cards.find(c => !c.sel && c.v === m.v && (m.s === '*' || c.s === m.s));
      if (found) found.sel = true;
    });
    _renderSafe();
  }

  function _clearHighlight() {
    const cards = G().myCards;
    if (!cards) return;
    cards.forEach(c => c.sel = false);
    _renderSafe();
  }

  function _setMyTurn(isMine) {
    G().turn = isMine ? G().mySeat : 1;
    G().isMyTurn = isMine;
    const ctrls = document.getElementById('ctrls');
    if (ctrls) ctrls.style.display = isMine ? 'flex' : 'none';
    if (typeof renderUI === 'function') renderUI();
  }

  // _selectCards removed — use _selectByMatch instead

  function _playSelectedCards() {
    const cards = G().myCards;
    if (!cards) return;
    const sel = cards.filter(c => c.sel);
    if (!sel.length) {
      console.warn('[Demo] No cards selected to play');
      return;
    }

    // Determine hand type
    let handType = null;
    try {
      if (typeof getHandType === 'function') handType = getHandType(sel, currentWildValue);
    } catch(e) {}
    if (!handType) {
      // Manual fallback
      if (sel.length === 1) handType = { type: '1', val: sel[0].p, count: 1 };
      else if (sel.length === 2) handType = { type: '2', val: sel[0].p, count: 2 };
      else handType = { type: String(sel.length), val: sel[0].p, count: sel.length };
    }

    // Remove played cards
    const selIds = new Set(sel.map(c => c.id));
    G().myCards = cards.filter(c => !selIds.has(c.id));
    G().counts[0] = G().myCards.length;

    // Clear all output zones first
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById('out-' + i);
      if (el) el.innerHTML = '';
    }

    // Show played cards in my output zone
    _syncSafe({
      seat: 0, type: 'play', cards: sel, handType: handType,
      nextTurn: 1, finishOrder: [], isRoundEnd: true,
    });

    // Re-render remaining hand
    _renderSafe();

    // Hide controls
    const ctrls = document.getElementById('ctrls');
    if (ctrls) ctrls.style.display = 'none';
  }

  function _syncSafe(d) {
    // Always render in output zones ourselves for demo reliability
    const outEl = document.getElementById('out-' + d.seat);
    if (outEl) {
      if (d.type === 'play' && d.cards && d.cards.length) {
        outEl.innerHTML = d.cards.map(c => {
          const isJoker = c.s === 'JOKER';
          const suitColor = c.s === '♥' ? '#ff4444' : c.s === '♦' ? '#ff8800' : c.s === '♣' ? '#44bb44' : c.s === '♠' ? '#6688ff' : (c.v === 'Bg' ? '#ff4444' : '#6688ff');
          const label = isJoker ? (c.v === 'Bg' ? '王' : '王') : c.v;
          const suitIcon = isJoker ? (c.v === 'Bg' ? '大' : '小') : c.s;
          return `<div style="display:inline-flex;flex-direction:column;align-items:center;
            width:44px;height:64px;margin:1px;border-radius:6px;padding-top:5px;
            background:rgba(20,20,35,0.95);border:1.5px solid rgba(255,255,255,0.2);
            box-shadow:0 2px 8px rgba(0,0,0,0.3)">
            <div style="font-size:14px;font-weight:900;color:${suitColor}">${label}</div>
            <div style="font-size:10px;color:${suitColor};opacity:0.7">${suitIcon}</div>
          </div>`;
        }).join('');
      } else if (d.type === 'pass') {
        outEl.innerHTML = '<div style="color:#888;font-size:16px;padding:10px 20px;background:rgba(255,255,255,0.03);border-radius:10px">过</div>';
      }
    }
    // Update turn indicator
    G().turn = d.nextTurn;
    try { if (typeof renderUI === 'function') renderUI(); } catch(e) {}
  }

  function _opponentPlays(seat, cards, handType) {
    G().counts[seat] = Math.max(0, (G().counts[seat] || 27) - cards.length);
    _syncSafe({
      seat: seat, type: 'play', cards: cards,
      handType: handType || { type: String(cards.length), val: cards[0].p, count: cards.length },
      nextTurn: (seat + 1) % 4, finishOrder: [], isRoundEnd: false,
    });
  }

  function _opponentPass(seat) {
    _syncSafe({
      seat: seat, type: 'pass', cards: [],
      nextTurn: (seat + 1) % 4, finishOrder: [],
    });
  }

  function _showFakeCoach() {
    const panel = document.getElementById('coach-panel');
    if (!panel) return;

    panel.style.display = 'flex';
    const box = panel.querySelector('.coach-box');
    if (box) {
      box.innerHTML = `
        <div class="coach-title">AI 教练分析</div>
        <div class="coach-move best" style="padding:14px">
          <div class="coach-rank r1">1</div>
          <div style="flex:1">
            <div style="font-size:15px;font-weight:bold;color:#fff">单牌: ♦K</div>
            <div style="font-size:12px;color:#aaa;margin-top:4px">用K压住Q，夺取牌权</div>
          </div>
          <div class="coach-info"><div class="coach-type">单牌</div><div class="coach-wr">78%</div></div>
        </div>
        <div class="coach-move" style="padding:14px">
          <div class="coach-rank r2">2</div>
          <div style="flex:1">
            <div style="font-size:15px;color:#ccc">单牌: ♥A</div>
            <div style="font-size:12px;color:#666;margin-top:4px">能压住但浪费大牌</div>
          </div>
          <div class="coach-info"><div class="coach-type">单牌</div><div class="coach-wr">65%</div></div>
        </div>
        <div class="coach-move" style="padding:14px">
          <div class="coach-rank r3">3</div>
          <div style="flex:1">
            <div style="font-size:15px;color:#888">PASS</div>
            <div style="font-size:12px;color:#666;margin-top:4px">放弃牌权</div>
          </div>
          <div class="coach-info"><div class="coach-type">过牌</div><div class="coach-wr">42%</div></div>
        </div>
        <div class="coach-dismiss"><button onclick="Demo.next()">确定</button></div>
      `;
    }
  }

  function _dismissFakeCoach() {
    const panel = document.getElementById('coach-panel');
    if (panel) panel.style.display = 'none';
  }

  function _showVictory() {
    G().gameOver = true;
    G().finishOrder = [0, 2, 1, 3];

    // Show result modal
    const modal = document.getElementById('result-modal');
    if (modal) {
      modal.style.display = 'flex';
      const title = document.getElementById('res-title');
      const desc = document.getElementById('res-desc');
      if (title) title.innerText = 'VICTORY';
      if (desc) desc.innerText = '双上！完美配合';
    } else {
      // Fallback: create simple result overlay
      const r = document.createElement('div');
      r.id = 'demo-result';
      r.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;z-index:9000;
        background:rgba(0,0,0,0.8);display:flex;flex-direction:column;
        align-items:center;justify-content:center;color:#fff`;
      r.innerHTML = `
        <div style="font-size:60px;font-weight:900;color:#ffd700;text-shadow:0 0 40px rgba(255,215,0,0.5)">VICTORY</div>
        <div style="font-size:24px;margin-top:16px;color:#00e5ff">双上！完美配合</div>
      `;
      document.body.appendChild(r);
    }

    if (typeof VoiceSystem !== 'undefined') VoiceSystem.sfx('win');
  }

  function _exitFakeGame() {
    // Close result modal
    const modal = document.getElementById('result-modal');
    if (modal) modal.style.display = 'none';
    const demoResult = document.getElementById('demo-result');
    if (demoResult) demoResult.remove();

    // Dismiss coach
    _dismissFakeCoach();

    // Hide game UI
    const g = document.getElementById('game-ui');
    if (g) g.style.display = 'none';

    // Restore state
    if (window._gameState) {
      G().myCards = savedState.myCards || [];
      G().mySeat = savedState.mySeat || 0;
      G().turn = savedState.turn || -1;
      G().gameOver = savedState.gameOver || false;
    }

    // Show home
    _ensureHomeScreen();
  }

  // ── Quiz simulation ──

  let quizOverlay = null;

  function _showFakeQuiz() {
    quizOverlay = document.createElement('div');
    quizOverlay.id = 'demo-quiz';
    quizOverlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;z-index:9500;
      background:rgba(0,0,0,0.95);display:flex;flex-direction:column;
      align-items:center;justify-content:center;padding:40px`;
    quizOverlay.innerHTML = `
      <div style="width:520px;max-width:90vw">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <span style="color:#ffd700;font-size:14px;font-weight:bold">段位测评</span>
          <span style="color:#666;font-size:13px">第 1 / 20 题</span>
        </div>
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
          border-radius:16px;padding:24px;margin-bottom:20px">
          <div style="color:#aaa;font-size:14px;margin-bottom:12px">${FAKE_QUIZ.scenario}</div>
          <div style="display:flex;gap:6px;margin-bottom:16px">
            ${FAKE_QUIZ.hand.map(c => `<div style="width:48px;height:68px;border-radius:8px;
              background:#1a1a2e;border:1px solid #444;display:flex;flex-direction:column;
              align-items:center;justify-content:center;font-size:14px;font-weight:bold;
              color:${c.s === '♥' || c.s === '♦' ? '#ff4444' : '#fff'}">${c.name}</div>`).join('')}
          </div>
          <div style="color:#fff;font-size:18px;font-weight:600">${FAKE_QUIZ.question}</div>
        </div>
        <div id="demo-quiz-options" style="display:flex;flex-direction:column;gap:10px">
          ${FAKE_QUIZ.options.map((o, i) => `
            <div class="demo-quiz-opt" data-idx="${i}" style="padding:14px 18px;border-radius:12px;
              background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);
              color:#ccc;font-size:15px;cursor:pointer;transition:all 0.2s"
              onmouseover="this.style.borderColor='#ffd700';this.style.background='rgba(255,215,0,0.06)'"
              onmouseout="this.style.borderColor='rgba(255,255,255,0.1)';this.style.background='rgba(255,255,255,0.04)'"
            >${String.fromCharCode(65 + i)}. ${o.text}</div>
          `).join('')}
        </div>
        <div id="demo-quiz-explain" style="display:none;margin-top:16px;padding:16px;border-radius:12px;
          background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.2);
          color:#00e5ff;font-size:14px;line-height:1.6"></div>
      </div>
    `;
    document.body.appendChild(quizOverlay);
  }

  function _selectFakeAnswer(idx) {
    const opts = document.querySelectorAll('.demo-quiz-opt');
    opts.forEach((o, i) => {
      const isCorrect = FAKE_QUIZ.options[i].correct;
      if (i === idx) {
        o.style.borderColor = isCorrect ? '#4ade80' : '#ff4444';
        o.style.background = isCorrect ? 'rgba(74,222,128,0.1)' : 'rgba(255,68,68,0.1)';
        o.style.color = isCorrect ? '#4ade80' : '#ff4444';
        o.style.fontWeight = 'bold';
      }
      if (isCorrect && i !== idx) {
        o.style.borderColor = '#4ade80';
        o.style.color = '#4ade80';
      }
      o.style.cursor = 'default';
      o.onmouseover = null;
      o.onmouseout = null;
    });
  }

  function _showFakeExplanation() {
    const el = document.getElementById('demo-quiz-explain');
    if (el) {
      el.style.display = 'block';
      el.innerHTML = `<strong>AI解析：</strong>${FAKE_QUIZ.options[0].explain}`;
    }
  }

  function _closeFakeQuiz() {
    if (quizOverlay) {
      quizOverlay.remove();
      quizOverlay = null;
    }
  }

  // ── Certificate ──

  let certOverlay = null;

  function _showFakeCert() {
    certOverlay = document.createElement('div');
    certOverlay.id = 'demo-cert';
    certOverlay.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;z-index:9500;
      background:rgba(10,8,6,0.95);display:flex;align-items:center;justify-content:center;overflow-y:auto`;
    certOverlay.innerHTML = `
      <div style="max-width:460px;width:95%;padding:16px 0">
        <!-- 证书皮质外框 -->
        <div style="background:linear-gradient(145deg,#2c1810,#3d2518,#2a1508);border-radius:16px;padding:4px;
          box-shadow:0 8px 32px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.05);
          border:1px solid rgba(212,175,110,0.3)">
          <!-- 金色内框 -->
          <div style="border:2px solid rgba(212,175,110,0.5);border-radius:13px;padding:3px;
            background:linear-gradient(145deg,rgba(212,175,110,0.08),transparent,rgba(212,175,110,0.05))">
            <!-- 内页 -->
            <div style="background:linear-gradient(170deg,#f5f0e8,#efe8db,#f2ece2);border-radius:10px;padding:28px 24px;position:relative;
              box-shadow:inset 0 0 60px rgba(180,160,120,0.15)">

              <!-- 水印 -->
              <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                width:200px;height:200px;border:3px solid rgba(212,175,110,0.08);border-radius:50%;pointer-events:none"></div>

              <!-- 顶部装饰 -->
              <div style="text-align:center;margin-bottom:6px">
                <div style="display:inline-block;width:60px;height:1px;background:linear-gradient(90deg,transparent,#d4af6e,transparent)"></div>
                <span style="color:#d4af6e;font-size:10px;margin:0 8px;letter-spacing:4px">CRAYXUS AI</span>
                <div style="display:inline-block;width:60px;height:1px;background:linear-gradient(90deg,transparent,#d4af6e,transparent)"></div>
              </div>

              <h2 style="text-align:center;color:#2c1810;font-size:22px;font-weight:900;margin:4px 0 2px;
                letter-spacing:6px;text-shadow:0 1px 0 rgba(212,175,110,0.3)">掼蛋段位认证</h2>
              <div style="text-align:center;color:#8a7a65;font-size:10px;margin-bottom:16px;letter-spacing:2px">
                Crayxus AI 掼蛋能力认证中心</div>

              <div style="height:1px;background:linear-gradient(90deg,transparent,#d4af6e80,transparent);margin-bottom:16px"></div>

              <!-- 段位 -->
              <div style="text-align:center;margin-bottom:16px">
                <div style="font-size:40px;line-height:1">🏅</div>
                <div style="font-size:24px;font-weight:900;color:#2c1810;margin:4px 0;letter-spacing:3px">黄金·精进</div>
                <div style="font-size:42px;font-weight:900;color:#8b6914;font-family:Georgia,serif">1350</div>
                <div style="font-size:11px;color:#8a7a65">综合评分 · 16/20 正确率 80%</div>
              </div>

              <div style="height:1px;background:linear-gradient(90deg,transparent,#d4af6e60,transparent);margin-bottom:14px"></div>

              <!-- 六维雷达（简化版） -->
              <div style="text-align:center;margin-bottom:14px">
                <div style="font-size:11px;color:#8a7a65;font-weight:bold;letter-spacing:3px;margin-bottom:8px">六 维 能 力 评 估</div>
                <svg viewBox="0 0 200 180" width="200" height="180">
                  <!-- 背景六边形 -->
                  <polygon points="100,10 175,50 175,130 100,170 25,130 25,50" fill="none" stroke="#d4af6e20" stroke-width="1"/>
                  <polygon points="100,40 150,65 150,115 100,140 50,115 50,65" fill="none" stroke="#d4af6e15" stroke-width="1"/>
                  <!-- 数据 -->
                  <polygon points="100,25 165,58 155,125 85,155 35,110 55,55" fill="rgba(139,105,20,0.15)" stroke="#8b6914" stroke-width="1.5"/>
                  <!-- 维度标签 -->
                  <text x="100" y="8" text-anchor="middle" font-size="8" fill="#8a7a65">组牌分解</text>
                  <text x="185" y="52" text-anchor="start" font-size="8" fill="#8a7a65">大牌控制</text>
                  <text x="185" y="135" text-anchor="start" font-size="8" fill="#8a7a65">出牌时机</text>
                  <text x="100" y="178" text-anchor="middle" font-size="8" fill="#8a7a65">队友配合</text>
                  <text x="15" y="135" text-anchor="end" font-size="8" fill="#8a7a65">炸弹使用</text>
                  <text x="15" y="52" text-anchor="end" font-size="8" fill="#8a7a65">终局处理</text>
                </svg>
              </div>

              <!-- 薄弱项 -->
              <div style="background:rgba(180,80,50,0.08);border:1px solid rgba(180,80,50,0.2);padding:10px 14px;border-radius:8px;margin-bottom:16px">
                <div style="font-size:11px;color:#b45032;font-weight:bold">待提升维度：队友配合</div>
                <div style="font-size:10px;color:#8a7a65;margin-top:2px">建议通过蛋力学院重点练习该维度策略</div>
              </div>

              <!-- 认证信息 + 印章 -->
              <div style="display:flex;justify-content:space-between;align-items:flex-end">
                <div style="font-size:9px;color:#a09880;line-height:1.8">
                  <div>认证编号：CRX-2026-88888</div>
                  <div>评估日期：2026年4月2日</div>
                  <div>评估模型：V8 超冠军级 AI</div>
                </div>
                <div style="width:64px;height:64px;border:3px solid #c0392b;border-radius:50%;display:flex;
                  align-items:center;justify-content:center;transform:rotate(-15deg);opacity:0.85">
                  <div style="text-align:center;line-height:1.15">
                    <div style="font-size:8px;color:#c0392b;font-weight:900">CRAYXUS</div>
                    <div style="font-size:7px;color:#c0392b;font-weight:bold">AI认证</div>
                    <div style="font-size:6px;color:#c0392b">专用章</div>
                  </div>
                </div>
              </div>

              <div style="text-align:center;margin-top:8px">
                <div style="display:inline-block;width:40px;height:1px;background:linear-gradient(90deg,transparent,#d4af6e,transparent)"></div>
                <span style="color:#c0a96e;font-size:8px;margin:0 6px;letter-spacing:2px">以AI之智 行大师之道</span>
                <div style="display:inline-block;width:40px;height:1px;background:linear-gradient(90deg,transparent,#d4af6e,transparent)"></div>
              </div>

            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(certOverlay);
  }

  function _closeFakeCert() {
    if (certOverlay) { certOverlay.remove(); certOverlay = null; }
  }

  // ── Tournament & Signup ──

  let tournamentOverlay = null;

  function _showFakeTournament() {
    tournamentOverlay = document.createElement('div');
    tournamentOverlay.id = 'demo-tournament';
    tournamentOverlay.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;z-index:9500;
      background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;overflow-y:auto`;
    tournamentOverlay.innerHTML = `
      <div style="max-width:500px;width:95%;padding:20px 0">
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:36px;margin-bottom:8px">🏆</div>
          <div style="font-size:24px;font-weight:900;color:#ffd700;letter-spacing:3px">线下掼蛋赛事</div>
          <div style="color:#888;font-size:13px;margin-top:6px">黄金段位以上可报名参赛</div>
        </div>

        <!-- 赛事列表 -->
        <div id="demo-events" style="display:flex;flex-direction:column;gap:12px">
          <div style="background:rgba(255,215,0,0.06);border:1.5px solid rgba(255,215,0,0.25);border-radius:16px;padding:18px;cursor:pointer;transition:all 0.2s"
            onmouseover="this.style.borderColor='#ffd700'" onmouseout="this.style.borderColor='rgba(255,215,0,0.25)'">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:17px;font-weight:bold;color:#fff">杭州西湖掼蛋精英赛</div>
                <div style="color:#888;font-size:12px;margin-top:4px">2026年5月15日 · 杭州西湖文化广场</div>
                <div style="display:flex;gap:8px;margin-top:8px">
                  <span style="font-size:11px;padding:3px 10px;border-radius:12px;background:rgba(255,215,0,0.1);color:#ffd700;border:1px solid rgba(255,215,0,0.2)">32人赛</span>
                  <span style="font-size:11px;padding:3px 10px;border-radius:12px;background:rgba(0,229,255,0.1);color:#00e5ff;border:1px solid rgba(0,229,255,0.2)">奖金 ¥5,000</span>
                  <span style="font-size:11px;padding:3px 10px;border-radius:12px;background:rgba(74,222,128,0.1);color:#4ade80;border:1px solid rgba(74,222,128,0.2)">报名中</span>
                </div>
              </div>
              <div style="font-size:28px;opacity:0.5">▸</div>
            </div>
          </div>

          <div style="background:rgba(255,255,255,0.03);border:1.5px solid rgba(255,255,255,0.1);border-radius:16px;padding:18px;cursor:pointer;transition:all 0.2s">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:17px;font-weight:bold;color:#fff">浙大AI掼蛋邀请赛</div>
                <div style="color:#888;font-size:12px;margin-top:4px">2026年6月8日 · 浙江大学紫金港校区</div>
                <div style="display:flex;gap:8px;margin-top:8px">
                  <span style="font-size:11px;padding:3px 10px;border-radius:12px;background:rgba(255,0,255,0.1);color:#ff00ff;border:1px solid rgba(255,0,255,0.2)">64人赛</span>
                  <span style="font-size:11px;padding:3px 10px;border-radius:12px;background:rgba(0,229,255,0.1);color:#00e5ff;border:1px solid rgba(0,229,255,0.2)">奖金 ¥10,000</span>
                  <span style="font-size:11px;padding:3px 10px;border-radius:12px;background:rgba(255,215,0,0.1);color:#ffd700;border:1px solid rgba(255,215,0,0.2)">即将开放</span>
                </div>
              </div>
              <div style="font-size:28px;opacity:0.5">▸</div>
            </div>
          </div>

          <div style="background:rgba(255,255,255,0.03);border:1.5px solid rgba(255,255,255,0.1);border-radius:16px;padding:18px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:17px;font-weight:bold;color:#888">长三角掼蛋大师赛</div>
                <div style="color:#666;font-size:12px;margin-top:4px">2026年8月 · 地点待定</div>
                <div style="display:flex;gap:8px;margin-top:8px">
                  <span style="font-size:11px;padding:3px 10px;border-radius:12px;background:rgba(255,255,255,0.05);color:#666;border:1px solid rgba(255,255,255,0.1)">128人赛</span>
                  <span style="font-size:11px;padding:3px 10px;border-radius:12px;background:rgba(255,255,255,0.05);color:#666;border:1px solid rgba(255,255,255,0.1)">钻石段位限定</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(tournamentOverlay);
  }

  function _showFakeSignup() {
    if (!tournamentOverlay) return;
    const events = document.getElementById('demo-events');
    if (!events) return;
    events.innerHTML = `
      <!-- 报名表单 -->
      <div style="background:rgba(255,215,0,0.04);border:1.5px solid rgba(255,215,0,0.2);border-radius:16px;padding:24px">
        <div style="font-size:18px;font-weight:bold;color:#ffd700;margin-bottom:16px">杭州西湖掼蛋精英赛 · 报名</div>

        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <div style="font-size:12px;color:#888;margin-bottom:4px">选手昵称</div>
            <div style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:14px">PLAYER_ONE</div>
          </div>
          <div>
            <div style="font-size:12px;color:#888;margin-bottom:4px">段位认证</div>
            <div style="padding:10px 14px;border-radius:10px;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);color:#ffd700;font-size:14px;font-weight:bold">🏅 黄金·精进 (1350分)</div>
          </div>
          <div>
            <div style="font-size:12px;color:#888;margin-bottom:4px">联系方式</div>
            <div style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#aaa;font-size:14px">138****8888</div>
          </div>
          <div>
            <div style="font-size:12px;color:#888;margin-bottom:4px">报名费用</div>
            <div style="display:flex;align-items:center;gap:12px">
              <span style="font-size:24px;font-weight:900;color:#ffd700">¥99</span>
              <span style="font-size:12px;color:#888;text-decoration:line-through">¥199</span>
              <span style="font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(255,107,53,0.15);color:#ff6b35;border:1px solid rgba(255,107,53,0.3)">黄金段位8折</span>
            </div>
          </div>
        </div>

        <div style="margin-top:20px;display:flex;gap:10px">
          <div style="flex:1;padding:14px;text-align:center;border-radius:12px;
            background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-weight:900;font-size:15px;
            cursor:pointer;letter-spacing:2px;box-shadow:0 4px 16px rgba(255,215,0,0.3)">
            确认报名
          </div>
        </div>

        <div style="margin-top:12px;text-align:center;font-size:11px;color:#666">
          报名成功后将收到微信通知 · 比赛当天请携带身份证
        </div>
      </div>

      <!-- 报名成功提示（模拟） -->
      <div style="margin-top:12px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);
        border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:24px;margin-bottom:6px">✅</div>
        <div style="font-size:15px;font-weight:bold;color:#4ade80">报名成功！</div>
        <div style="font-size:12px;color:#888;margin-top:4px">请于2026年5月15日 08:30到场签到</div>
        <div style="font-size:12px;color:#888;margin-top:2px">地点：杭州西湖文化广场3层A厅</div>
      </div>
    `;
  }

  function _closeFakeTournament() {
    if (tournamentOverlay) { tournamentOverlay.remove(); tournamentOverlay = null; }
  }

  // ── Navigation ──

  function next() {
    step++;
    if (step >= SCENES.length) {
      stop();
      return;
    }
    _runScene(step);
  }

  let autoAdvanceTimer = null;

  function _runScene(idx) {
    const scene = SCENES[idx];
    if (!scene) { stop(); return; }

    // Clear any pending auto-advance
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }

    // Run setup
    const delay = scene.delay || 0;
    setTimeout(() => {
      if (scene.setup) scene.setup();

      // Update overlay
      _updateOverlay(scene, idx);

      // Play voice
      if (typeof VoiceSystem !== 'undefined') {
        VoiceSystem.stop();
        setTimeout(() => {
          if (scene.voice) {
            VoiceSystem.say(scene.voice);
          } else if (scene.speak) {
            VoiceSystem.speak(scene.speak);
          }
        }, 200);
      }

      // Auto-advance if specified
      if (scene.autoAdvance) {
        autoAdvanceTimer = setTimeout(() => {
          autoAdvanceTimer = null;
          next();
        }, scene.autoAdvance);
      }
    }, delay);
  }

  // ── Start / Stop ──

  function start() {
    if (active) return;
    active = true;
    step = 0;

    _createOverlay();
    _runScene(0);

    console.log('[Demo] Started');
  }

  function stop() {
    active = false;

    // Clean up
    _dismissFakeCoach();
    _closeFakeQuiz();
    _closeFakeCert();
    _closeFakeTournament();
    const demoResult = document.getElementById('demo-result');
    if (demoResult) demoResult.remove();

    // Hide game UI if showing
    const g = document.getElementById('game-ui');
    if (g && g.style.display === 'flex' && typeof switchScreen === 'function') {
      g.style.display = 'none';
      _ensureHomeScreen();
    }

    // Remove overlay
    if (overlay) { overlay.remove(); overlay = null; }

    // Restore state
    if (window._gameState && savedState.myCards !== undefined) {
      G().myCards = savedState.myCards;
      G().mySeat = savedState.mySeat;
    }

    if (typeof VoiceSystem !== 'undefined') VoiceSystem.stop();

    console.log('[Demo] Stopped');
  }

  return {
    start,
    stop,
    next,
    get active() { return active; },
    get step() { return step; },
  };

})();
