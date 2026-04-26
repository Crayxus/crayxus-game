/**
 * CRAYXUS 掼蛋键盘桥接 v3 (动态位置映射)
 *
 * 浏览器 → 键盘:
 *   KB.dealStart()                    - 发牌开始 (全键盘 dim 白)
 *   KB.layout(myCards)                - 根据手牌算出每张牌位置并全部点亮
 *   KB.ledAt(row, col, suit)          - 单个位置亮灯 (爆白闪 → 花色色)
 *   KB.ledOff(row, col)               - 关单个位置
 *   KB.selPos(row, col, on)           - 选中/取消位置
 *   KB.colFlash(col)                  - 整列闪电
 *   KB.playPos(posArray)              - 出牌动画, posArray = [[r,c],...]
 *   KB.pass() / KB.clear() / KB.idle()
 *
 * 键盘 → 浏览器:
 *   KB.onKey(fn)   -> fn(token)
 *   token: 'P73' (row 7 col 3) / 'PLAY' / 'PASS' / 'MODE' / 'BJ' / 'SJ'
 *
 * 动态映射查询:
 *   KB.posToCard(row, col)   // -> card 对象或 null
 */
(function(global){
  const WS_URL = 'ws://localhost:8765';

  // 游戏层规约 (和 indexrp.html 里 _findKbKey 完全一致)
  const KB_SUITS = ['♠','♥','♣','♦'];
  const KB_VAL_MAP = {'2':0,'A':1,'K':2,'Q':3,'J':4,'10':5,'9':6,'8':7,'7':8,'6':9,'5':10,'4':11,'3':12};
  const SUIT_TO_CODE = {'♠':'S','♥':'H','♣':'C','♦':'D'};

  let ws = null;
  let reconnectTimer = null;
  let keyHandlers = [];
  let posMap = {};    // "r,c" -> card 对象

  // ============================================================
  // 键盘按键监听 (位置 token "P<row><col_hex>" + 固定 token)
  // ============================================================
  let kbBuffer = '';
  let kbEnabled = true;
  let kbFlushTimer = null;

  function _splitTokens(buf) {
    const patterns = [
      /^(PLAY|PASS|MODE|BJ|SJ)/,
      /^P[0-7][0-9A-E]/,
    ];
    const out = [];
    while (buf.length > 0) {
      let matched = null;
      for (const p of patterns) {
        const m = buf.match(p);
        if (m) { matched = m[0]; break; }
      }
      if (!matched) {
        buf = buf.substring(1);
        continue;
      }
      out.push(matched);
      buf = buf.substring(matched.length);
    }
    return out;
  }

  // 去重: 防止 2x2 大键瞬间多颗轴同时触发 (本质同一次按)
  const _kbDebounce = {};
  function _kbShouldFire(token) {
    const debounceTokens = ['MODE', 'PLAY', 'PASS', 'BJ', 'SJ'];
    if (debounceTokens.indexOf(token) < 0) return true;
    const now = Date.now();
    const last = _kbDebounce[token] || 0;
    // 80ms 只过滤同一物理按键的反复抖动, 不影响正常快速按键
    if (now - last < 80) {
      return false;
    }
    _kbDebounce[token] = now;
    return true;
  }

  // 首次按键时模拟一次用户激活, 让 focus()/autoplay 等 API 解锁
  let _kbActivated = false;
  function _kbEnsureActivation() {
    if (_kbActivated) return;
    try {
      document.body.click();
      document.body.focus();
      // 触发一次合成 click 事件 (可能不算 user-activation 但试试)
      const evt = new MouseEvent('click', {bubbles:true, cancelable:true});
      document.body.dispatchEvent(evt);
    } catch(e) {}
    _kbActivated = true;
    console.log('[KB] 首次激活页面交互');
  }

  // 浮动提示 (调试用, 显示 token 真的被接收到)
  function _kbToast(text) {
    let t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
      'background:rgba(0,200,150,0.9);color:white;padding:6px 18px;border-radius:8px;' +
      'z-index:99999;font-size:16px;font-family:sans-serif;pointer-events:none;font-weight:bold;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.4)';
    t.textContent = '⌨ ' + text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 800);
  }

  function _flush() {
    if (!kbBuffer) return;
    const raw = kbBuffer;
    kbBuffer = '';
    _kbEnsureActivation();
    const tokens = _splitTokens(raw);
    for (const t of tokens) {
      if (!_kbShouldFire(t)) continue;
      console.log('[KB] 按键', t);
      // 关键键 (MODE/PLAY/PASS/BJ/SJ) 显示 toast
      if (['MODE','PLAY','PASS','BJ','SJ'].indexOf(t) >= 0) _kbToast(t);
      keyHandlers.forEach(h => {
        try { h(t); } catch(err) { console.error(err); }
      });
    }
  }

  function _scheduleFlush() {
    if (kbFlushTimer) clearTimeout(kbFlushTimer);
    kbFlushTimer = setTimeout(_flush, 150);
  }

  document.addEventListener('keydown', (e) => {
    if (!kbEnabled) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const code = e.code || '';
    if (code === 'Enter' || e.key === 'Enter') {
      _flush();
      e.preventDefault();
      return;
    }

    let ch = '';
    if (code.startsWith('Key')) ch = code.substring(3);
    else if (code.startsWith('Digit')) ch = code.substring(5);
    else if (code === 'Minus') ch = '_';
    else if (e.key && e.key.length === 1) ch = e.key.toUpperCase();

    if (ch) {
      kbBuffer += ch;
      _scheduleFlush();
      if (!(document.activeElement &&
            (document.activeElement.tagName === 'INPUT' ||
             document.activeElement.tagName === 'TEXTAREA'))) {
        e.preventDefault();
      }
    }
  });

  function setKeyboardEnabled(on) { kbEnabled = on; }

  // ============================================================
  // WebSocket
  // ============================================================
  function connect() {
    try { ws = new WebSocket(WS_URL); }
    catch(e) {
      reconnectTimer = setTimeout(connect, 3000);
      return;
    }
    ws.onopen = () => {
      console.log('[KB] WebSocket 已连接');
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    };
    ws.onclose = () => {
      console.log('[KB] WebSocket 断开, 3 秒后重连');
      reconnectTimer = setTimeout(connect, 3000);
    };
    ws.onerror = () => {};
  }

  function send(cmd, arg) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({cmd, arg: arg == null ? '' : String(arg)}));
  }

  // ============================================================
  // 计算手牌的物理位置 (与游戏 _findKbKey + _kbApplySort 完全一致)
  // 返回 { "row,col": card }
  // ============================================================
  function _computeLayout(myCards) {
    const initial = {};   // "row,col" -> card
    const placed = {};
    const sorted = [...myCards].sort((a, b) => b.p - a.p);

    for (const c of sorted) {
      let row, col;
      if (c.s === 'JOKER') {
        col = c.v === 'Bg' ? 0 : 1;
        const pkey = `joker-${c.v}`;
        const count = placed[pkey] || 0;
        placed[pkey] = count + 1;
        row = 6 + count;
        if (row > 7) continue;
      } else {
        const colIdx = KB_VAL_MAP[c.v];
        if (colIdx === undefined) continue;
        col = colIdx + 2;
        const suitIdx = KB_SUITS.indexOf(c.s);
        if (suitIdx < 0) continue;
        const baseRow = suitIdx * 2;
        const pkey = `${c.s}-${c.v}`;
        const count = placed[pkey] || 0;
        placed[pkey] = count + 1;
        row = baseRow + count;
        if (row > baseRow + 1) continue;
      }
      initial[`${row},${col}`] = c;
    }

    // 重力排序: 每列 lit 沉底, 保持行顺序
    const finalMap = {};
    for (let col = 0; col < 15; col++) {
      const cardsInCol = [];
      for (let row = 0; row < 8; row++) {
        const key = `${row},${col}`;
        if (initial[key]) cardsInCol.push({row, card: initial[key]});
      }
      cardsInCol.sort((a, b) => a.row - b.row);
      cardsInCol.forEach((item, i) => {
        const finalRow = 8 - cardsInCol.length + i;
        finalMap[`${finalRow},${col}`] = item.card;
      });
    }
    return finalMap;
  }

  // ============================================================
  // 对外 API
  // ============================================================
  const KB = {
    // 原始命令
    raw(cmd, arg) { send(cmd, arg); },

    // 发牌开始 - 整键盘 dim 白
    dealStart() { send('DEAL_START'); },

    // 根据手牌重建映射 + 点亮所有位置
    // 可选 animated=true 会逐张发, 否则一次性点亮
    layout(myCards, animated = false, interval = 200) {
      const finalMap = _computeLayout(myCards);
      posMap = finalMap;
      // 先清 LED (保留 dim 白底)
      send('LED_CLEAR');
      const entries = Object.entries(finalMap);
      if (animated) {
        entries.forEach(([key, card], i) => {
          setTimeout(() => {
            const [r, c] = key.split(',').map(Number);
            const suit = SUIT_TO_CODE[card.s] || 'S';
            send('LED', `${r},${c},${suit}`);
            // 最后一张发完后关 dim 白底
            if (i === entries.length - 1) {
              setTimeout(() => send('LAYOUT_DONE'), 300);
            }
          }, i * interval);
        });
      } else {
        for (const [key, card] of entries) {
          const [r, c] = key.split(',').map(Number);
          const suit = SUIT_TO_CODE[card.s] || 'S';
          send('LED', `${r},${c},${suit}`);
        }
        send('LAYOUT_DONE');
      }
    },

    // 动态映射: 查询位置对应的 card
    posToCard(row, col) {
      return posMap[`${row},${col}`] || null;
    },

    // 单个位置操作
    ledAt(row, col, suit) { send('LED', `${row},${col},${suit}`); },
    ledOff(row, col) { send('LED_OFF', `${row},${col}`); },
    selPos(row, col, on = true) { send(on ? 'SEL' : 'UNSEL', `${row},${col}`); },
    colFlash(col) { send('COL_FLASH', col); },
    playPos(positions) {
      const s = positions.map(([r, c]) => `${r},${c}`).join(';');
      send('PLAY', s);
    },
    pass() { send('PASS'); },
    clear() {
      posMap = {};
      send('CLEAR');
    },
    idle() { send('IDLE'); },

    onKey(handler) {
      keyHandlers.push(handler);
      return () => {
        const i = keyHandlers.indexOf(handler);
        if (i >= 0) keyHandlers.splice(i, 1);
      };
    },

    setKeyboardEnabled,
    isConnected() { return ws && ws.readyState === WebSocket.OPEN; },

    // 测试用: 返回当前映射
    _getPosMap() { return posMap; },
  };

  connect();
  global.KB = KB;
  console.log('[KB] 桥接客户端 v3 (位置映射) 已加载');
})(window);
