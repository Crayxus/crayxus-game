/**
 * CRAYXUS 掼蛋键盘桥接客户端 (浏览器端, Windows + Linux 都用这个)
 *
 * 架构:
 *   浏览器 KeyboardEvent  -> KB.onKey 回调 (键盘按键)
 *   KB.deal/sort/... API  -> WebSocket -> Python 桥接 -> USB 串口 -> Pico
 *
 * 用法:
 *   粘贴到 indexrp.html 的 <script> 里, 或单独保存用 <script src="bridge_client.js"></script>
 *
 *   KB.deal('S2');              // 发一张 ♠2
 *   KB.deal(['S2','HA','CK']);  // 批量发牌
 *   KB.sort();                   // 发完后触发下落动画
 *   KB.select('SA', true);       // 选中 ♠A
 *   KB.select('SA', false);      // 取消选中
 *   KB.columnFlash('A');         // A 点数整列闪 + 选中
 *   KB.play(['S2','HA']);        // 出牌 (上飞动画)
 *   KB.pass();                   // 过牌效果
 *   KB.clear();                  // 清空所有, 回 IDLE
 *
 *   KB.onKey((token) => {
 *     // token: 'S2' / 'HA' / 'BJ' / 'SJ' / 'PLAY' / 'PASS' / 'MODE' / 'COL_A' 等
 *   });
 */
(function(global){
  const WS_URL = 'ws://localhost:8765';

  let ws = null;
  let reconnectTimer = null;
  let keyHandlers = [];

  // ============================================================
  // 浏览器原生按键监听 (替代 Linux 的 evdev HID 监听)
  // 键盘发出 'S', '2', Enter 三次 keydown, 我们累积成 'S2'
  // ============================================================
  let kbBuffer = '';
  let kbEnabled = true;

  document.addEventListener('keydown', (e) => {
    if (!kbEnabled) return;

    // 忽略修饰键
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    // Enter = 提交 token
    if (e.key === 'Enter') {
      if (kbBuffer) {
        const token = kbBuffer;
        kbBuffer = '';
        // 只有符合掼蛋键盘格式的才派发
        if (/^(S|H|C|D)[0-9AKQJT]+$/.test(token) ||    // 牌: S2, HA ...
            token === 'BJ' || token === 'SJ' ||         // 大小王
            token === 'PLAY' || token === 'PASS' || token === 'MODE' ||
            /^COL_[0-9AKQJT]+$/.test(token)) {          // 列: COL_A 等
          keyHandlers.forEach(h => {
            try { h(token); } catch(err) { console.error(err); }
          });
          e.preventDefault();  // 阻止默认 Enter 行为
        }
      }
      return;
    }

    // 普通字符累积
    if (e.key.length === 1) {
      kbBuffer += e.key.toUpperCase();
      // 防止键盘输入跑到输入框里 (可选, 按需开关)
      if (document.activeElement &&
          (document.activeElement.tagName === 'INPUT' ||
           document.activeElement.tagName === 'TEXTAREA')) {
        // 输入框聚焦时不拦截, 让用户正常输入
      } else {
        e.preventDefault();
      }
    }
  });

  // 切换是否拦截按键 (比如聊天输入时可禁用)
  function setKeyboardEnabled(on) { kbEnabled = on; }

  // ============================================================
  // WebSocket (game -> pico 灯光命令)
  // ============================================================
  function connect() {
    try {
      ws = new WebSocket(WS_URL);
    } catch(e) {
      console.warn('[KB] WebSocket 创建失败', e);
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
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[KB] 命令未发送 (未连接):', cmd, arg);
      return;
    }
    ws.send(JSON.stringify({cmd, arg: arg || ''}));
  }

  // ============================================================
  // 对外 API
  // ============================================================
  const KB = {
    // 灯光命令
    deal(cards, intervalMs = 200) {
      if (Array.isArray(cards)) {
        cards.forEach((c, i) => setTimeout(() => send('DEAL', c), i * intervalMs));
      } else {
        send('DEAL', cards);
      }
    },
    sort() { send('SORT'); },
    select(card, on = true) { send(on ? 'SEL' : 'UNSEL', card); },
    columnFlash(rank) { send('COL_FLASH', rank); },
    play(cards) {
      const list = Array.isArray(cards) ? cards.join(',') : cards;
      send('PLAY', list);
    },
    pass() { send('PASS'); },
    clear() { send('CLEAR'); },
    mode(name) { send('MODE', name); },

    // 按键事件订阅
    onKey(handler) {
      keyHandlers.push(handler);
      return () => {
        const i = keyHandlers.indexOf(handler);
        if (i >= 0) keyHandlers.splice(i, 1);
      };
    },

    // 暂停/恢复按键拦截 (比如弹出聊天输入框时)
    setKeyboardEnabled,

    // 连接状态
    isConnected() {
      return ws && ws.readyState === WebSocket.OPEN;
    },
  };

  connect();
  global.KB = KB;
  console.log('[KB] 桥接客户端已加载. 使用 KB.deal / KB.sort / KB.onKey 等');
})(window);
