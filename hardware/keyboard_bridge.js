/**
 * Guandan Physical Keyboard Bridge — WebSocket (RPi5 GPIO Direct)
 * ================================================================
 * 动态LED映射：键盘灯光排列与屏幕牌堆完全一致
 * 发牌动画：每张牌从顶行下落到最终位置
 * 整理牌：选中牌后点击空位，逐张移到新位置
 *
 * 列(COL1-13) = 点数(2 A K Q J T 9 8 7 6 5 4 3)，固定
 * 行 = 动态堆叠，同点数的牌从底行(Row7)往上堆
 * LED颜色 = 花色（金♦ 蓝♠ 红♥ 绿♣）
 * 选中 = 白色，没有 = 灯灭
 *
 * 操作：
 *   按有牌的键 = 选中/取消选中（白色高亮）
 *   选中牌后按空位 = 把牌移过去（逐张）
 *   MODE双击 = 重置排列回默认
 */

const KeyboardBridge = (function(){

  const RANKS = ['2','A','K','Q','J','10','9','8','7','6','5','4','3'];
  const NUM_ROWS = 8;

  // LED chain index
  const LED_STARTS = [1, 14, 28, 41, 55, 68, 82, 96];
  const FUNC_LED = { MODE:0, PASS:27, PLAY:54, JOKER_BIG:81, JOKER_SMALL:95 };

  function cardLedIndex(row, col) {
    if(row < 0 || row >= NUM_ROWS || col < 1 || col > 13) return -1;
    return LED_STARTS[row] + (col - 1);
  }

  // Colors
  const SUIT_COLORS = {
    '♦': {r:255, g:200, b:0},
    '♠': {r:60,  g:120, b:255},
    '♥': {r:255, g:40,  b:40},
    '♣': {r:100, g:255, b:100},
  };
  const COLOR_SEL      = {r:255, g:255, b:255};
  const COLOR_FUNC     = {r:40,  g:30,  b:0};
  const COLOR_JOKER_BIG  = {r:255, g:50,  b:50};
  const COLOR_JOKER_SM   = {r:50,  g:50,  b:255};
  const COLOR_OFF      = {r:0, g:0, b:0};

  // ── WebSocket ──
  let ws = null;
  let connected = false;
  let reconnectTimer = null;

  function connect() {
    if(ws && ws.readyState <= 1) return;
    ws = new WebSocket('ws://127.0.0.1:9000');
    ws.onopen = () => {
      connected = true;
      console.log('[KB] Connected');
      if(reconnectTimer) { clearInterval(reconnectTimer); reconnectTimer = null; }
      syncLeds();
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if(data.type === 'keydown') handleKeyDown(data);
      } catch(e) {}
    };
    ws.onclose = () => {
      connected = false;
      if(!reconnectTimer) reconnectTimer = setInterval(connect, 2000);
    };
    ws.onerror = () => { ws.close(); };
  }

  function send(obj) {
    if(connected && ws && ws.readyState === 1)
      ws.send(JSON.stringify(obj));
  }

  // ── LED → card mapping (rebuilt each sync) ──
  let ledMap = [];
  function clearLedMap() {
    ledMap = [];
    for(let r = 0; r < NUM_ROWS; r++)
      ledMap[r] = new Array(14).fill(null);
  }

  // ── Deal animation state ──
  let dealAnimTimer = null;
  let isDealing = false;

  // ── Rearrangement state ──
  // null = use default layout from computeLayout()
  // array of {card, row, col, color} = custom arrangement
  let arranged = null;

  function resetArrangement() {
    arranged = null;
    console.log('[KB] Arrangement reset');
  }

  // Initialize arranged from current default layout (lazy, on first rearrange)
  function ensureArranged() {
    if(arranged) return arranged;
    const layout = computeLayout();
    arranged = layout.cards.map(e => ({card: e.card, row: e.row, col: e.col, color: e.color}));
    return arranged;
  }

  // Get current card positions (custom or default)
  function getPositions() {
    if(arranged) return arranged;
    return computeLayout().cards;
  }

  // ── MODE double-click detection ──
  let lastModePress = 0;

  // ── Key handlers ──

  function handleKeyDown(data) {
    if(isDealing) return;

    const key = data.key;

    // MODE: double-press = reset arrangement, single = hint
    if(key === 'MODE') {
      const now = Date.now();
      if(now - lastModePress < 500) {
        // Double press → reset arrangement
        resetArrangement();
        syncLeds();
        if(typeof AudioSys !== 'undefined') AudioSys.play('click');
        lastModePress = 0;
        return;
      }
      lastModePress = now;

      const ms = document.getElementById('mode-select');
      if(ms && ms.classList.contains('active')) {
        if(typeof selectMode === 'function') selectMode('casual');
        return;
      }
      const btn = document.querySelector('.btn.b-hint');
      if(btn && !btn.disabled) btn.click();
      return;
    }
    if(key === 'PASS') {
      const btn = document.querySelector('.btn.b-pass');
      if(btn && !btn.disabled) btn.click();
      return;
    }
    if(key === 'PLAY') {
      const btn = document.querySelector('.btn.b-play');
      if(btn && !btn.disabled) btn.click();
      return;
    }
    if(key === 'JOKER_BIG' || key === 'JOKER_SMALL') {
      toggleJoker(key === 'JOKER_BIG' ? 'Bg' : 'Sm');
      return;
    }

    // Card key
    const row = data.row;
    const col = data.col;
    if(col === 0) return;

    const card = ledMap[row] && ledMap[row][col];

    if(card) {
      // Key has a card → toggle selection
      card.sel = !card.sel;
    } else {
      // Empty key → try to place a selected card here
      const positions = ensureArranged();
      const selected = positions
        .filter(e => e.card.sel)
        .sort((a, b) => {
          // Sort by col (left→right), then row (top→bottom) for predictable order
          if(a.col !== b.col) return a.col - b.col;
          return a.row - b.row;
        });

      if(selected.length === 0) return;

      // Check target is not occupied
      const occupied = positions.some(e => e.row === row && e.col === col);
      if(occupied) return;

      // Move first selected card to this position
      const moving = selected[0];
      moving.row = row;
      moving.col = col;
      moving.card.sel = false;
    }

    syncLeds();
    if(typeof renderHand === 'function') renderHand();
    if(typeof AudioSys !== 'undefined') AudioSys.play('click');
  }

  function toggleJoker(val) {
    if(typeof myCards === 'undefined') return;
    const jokers = myCards.filter(c => c.s === 'JOKER' && c.v === val);
    if(!jokers.length) return;
    const unsel = jokers.find(c => !c.sel);
    if(unsel) unsel.sel = true;
    else jokers.forEach(c => c.sel = false);
    syncLeds();
    if(typeof renderHand === 'function') renderHand();
    if(typeof AudioSys !== 'undefined') AudioSys.play('click');
  }

  // ── Compute default layout (where each card goes by rank stacking) ──

  function computeLayout() {
    if(typeof myCards === 'undefined') return {cards: [], jokers: []};

    const regulars = myCards.filter(c => c.s !== 'JOKER');
    const jokers = myCards.filter(c => c.s === 'JOKER');
    const sorted = [...regulars].sort((a, b) => b.p - a.p);

    // Group by rank
    const groups = {};
    sorted.forEach(c => {
      if(!groups[c.v]) groups[c.v] = [];
      groups[c.v].push(c);
    });

    // Compute final (row, col) for each card
    const result = [];
    for(const [rank, cards] of Object.entries(groups)) {
      const colIdx = RANKS.indexOf(rank);
      if(colIdx < 0) continue;
      const col = colIdx + 1;
      cards.forEach((c, stackIdx) => {
        const row = (NUM_ROWS - 1) - stackIdx;
        if(row < 0) return;
        const color = SUIT_COLORS[c.s] || COLOR_FUNC;
        result.push({card: c, row, col, color});
      });
    }

    // Jokers
    const jokerResult = [];
    const allJokers = [...jokers.filter(c=>c.v==='Bg'), ...jokers.filter(c=>c.v==='Sm')];
    allJokers.forEach((c, idx) => {
      const color = c.v === 'Bg' ? COLOR_JOKER_BIG : COLOR_JOKER_SM;
      jokerResult.push({card: c, ledIdx: c.v==='Bg' ? FUNC_LED.JOKER_BIG : FUNC_LED.JOKER_SMALL, color});
    });

    return {cards: result, jokers: jokerResult};
  }

  // ── Sync LEDs to current state ──

  function syncLeds() {
    if(!connected || isDealing) return;
    if(typeof myCards === 'undefined') return;

    clearLedMap();
    const layout = computeLayout();
    const positions = arranged || layout.cards;

    // If arranged, remove entries for cards no longer in hand (played cards)
    if(arranged) {
      const handSet = new Set(myCards);
      for(let i = arranged.length - 1; i >= 0; i--) {
        if(!handSet.has(arranged[i].card)) {
          arranged.splice(i, 1);
        }
      }
      // If all cards gone, reset
      if(arranged.length === 0) {
        arranged = null;
      }
    }

    const activePositions = arranged || layout.cards;

    // Build ledMap for key press lookup
    activePositions.forEach(entry => {
      if(entry.row >= 0 && entry.row < NUM_ROWS && entry.col >= 1 && entry.col <= 13) {
        ledMap[entry.row][entry.col] = entry.card;
      }
    });

    // Build LED frame
    const leds = [];

    // Function keys
    leds.push({index: FUNC_LED.MODE, ...COLOR_FUNC});
    leds.push({index: FUNC_LED.PASS, ...COLOR_FUNC});
    leds.push({index: FUNC_LED.PLAY, ...COLOR_FUNC});

    // Jokers
    layout.jokers.forEach(j => {
      const color = j.card.sel ? COLOR_SEL : j.color;
      leds.push({index: j.ledIdx, ...color});
    });

    // Cards
    activePositions.forEach(entry => {
      const ledIdx = cardLedIndex(entry.row, entry.col);
      if(ledIdx < 0) return;
      const color = entry.card.sel ? COLOR_SEL : entry.color;
      leds.push({index: ledIdx, ...color});
    });

    send({cmd: 'led_update', leds});
  }

  // ── Deal animation: cards drop from top to final position ──

  function playDealAnimation() {
    if(!connected) return;
    if(typeof myCards === 'undefined' || myCards.length === 0) return;

    // Reset any custom arrangement on new deal
    resetArrangement();

    // Cancel any running animation
    if(dealAnimTimer) { clearTimeout(dealAnimTimer); dealAnimTimer = null; }
    isDealing = true;

    const layout = computeLayout();
    // Sort cards by priority (high first = dealt left to right, matching screen)
    const allCards = [...layout.cards].sort((a, b) => {
      if(a.col !== b.col) return a.col - b.col; // left columns first
      return b.row - a.row; // bottom card first in each column
    });

    // State: which cards have been "dealt" (reached final position)
    const settled = []; // entries that are done falling
    let cardIdx = 0;    // next card to start dealing
    let fallingCards = []; // {entry, currentRow} — currently falling

    const DROP_SPEED = 40;   // ms per row drop
    const DEAL_INTERVAL = 120; // ms between dealing each card

    let lastDealTime = 0;

    function animFrame() {
      const now = Date.now();

      // Start dealing next card
      if(cardIdx < allCards.length && (now - lastDealTime) >= DEAL_INTERVAL) {
        const entry = allCards[cardIdx];
        fallingCards.push({entry, currentRow: 0}); // start at row 0 (top)
        cardIdx++;
        lastDealTime = now;
      }

      // Advance falling cards
      const stillFalling = [];
      fallingCards.forEach(fc => {
        if(fc.currentRow < fc.entry.row) {
          fc.currentRow++;
          stillFalling.push(fc);
        } else {
          // Reached final position
          settled.push(fc.entry);
        }
      });
      fallingCards = stillFalling;

      // Build current frame
      const leds = [];
      leds.push({index: FUNC_LED.MODE, ...COLOR_FUNC});
      leds.push({index: FUNC_LED.PASS, ...COLOR_FUNC});
      leds.push({index: FUNC_LED.PLAY, ...COLOR_FUNC});

      // Settled cards (at final position)
      settled.forEach(entry => {
        const ledIdx = cardLedIndex(entry.row, entry.col);
        if(ledIdx >= 0) leds.push({index: ledIdx, ...entry.color});
      });

      // Falling cards (at current position)
      fallingCards.forEach(fc => {
        const ledIdx = cardLedIndex(fc.currentRow, fc.entry.col);
        if(ledIdx >= 0) leds.push({index: ledIdx, ...fc.entry.color});
      });

      // Jokers: appear at the end
      if(cardIdx >= allCards.length) {
        layout.jokers.forEach(j => {
          leds.push({index: j.ledIdx, ...j.color});
        });
      }

      send({cmd: 'led_update', leds});

      // Continue?
      if(settled.length < allCards.length || fallingCards.length > 0) {
        dealAnimTimer = setTimeout(animFrame, DROP_SPEED);
      } else {
        // Animation complete — sync to final state
        isDealing = false;
        clearLedMap();
        layout.cards.forEach(entry => {
          ledMap[entry.row][entry.col] = entry.card;
        });
        syncLeds();
      }
    }

    // Clear all LEDs first, then start
    send({cmd: 'led_clear'});
    setTimeout(() => {
      lastDealTime = Date.now();
      animFrame();
    }, 300);
  }

  // ── Init ──

  function init() {
    connect();

    // Hook renderHand to auto-sync LEDs
    if(typeof renderHand === 'function') {
      const orig = renderHand;
      window.renderHand = function(dealing) {
        orig(dealing);
        if(dealing) {
          playDealAnimation();
        } else {
          syncLeds();
        }
      };
    }

    if(typeof socket !== 'undefined') {
      ['sync','turnUpdate','roundEnd','gameEnd'].forEach(evt => {
        socket.on(evt, () => {
          resetArrangement();
          setTimeout(syncLeds, 100);
        });
      });
    }

    console.log('[KB] Keyboard bridge initialized (deal animation + card rearrangement)');
  }

  return {
    init,
    connect,
    syncLeds,
    playDealAnimation,
    resetArrangement,
    send,
    get connected() { return connected; },
  };

})();

document.addEventListener('DOMContentLoaded', () => {
  KeyboardBridge.init();
});
