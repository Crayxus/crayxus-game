/**
 * DanDan AI — Master integration module
 * =======================================
 * Connects VoiceSystem + Mascot + VoiceInput + Tutorial + GameVoiceHooks
 * into a unified "AI Robot" experience.
 *
 * This is the single entry point — load this file and it bootstraps everything.
 *
 * Script load order in index.html:
 *   <script src="js/voice-system.js"></script>
 *   <script src="js/mascot.js"></script>
 *   <script src="js/voice-input.js"></script>
 *   <script src="js/tutorial.js"></script>
 *   <script src="js/game-voice-hooks.js"></script>
 *   <script src="js/dandan-ai.js"></script>  <!-- this file, loads last -->
 */

const DanDanAI = (function() {

  let initialized = false;
  let _active = false;         // DanDan starts dormant
  let _idleTimer = null;
  const IDLE_TIMEOUT = 30000;  // 30s no interaction → deactivate

  async function init() {
    if (initialized) return;
    initialized = true;

    console.log('[DanDan] Booting AI assistant...');

    // 1. Init voice system (loads manifest, prepares audio)
    if (typeof VoiceSystem !== 'undefined') {
      await VoiceSystem.init();
    }

    // 2. Init mascot (creates SVG robot in bottom-left)
    if (typeof Mascot !== 'undefined') {
      Mascot.init();
    }

    // 3. Init voice input (microphone recognition)
    if (typeof VoiceInput !== 'undefined') {
      VoiceInput.init();
      // Show mascot feedback on voice command
      VoiceInput.onCommand((cmd, text) => {
        // Wake command activates DanDan
        if (cmd === 'wake') {
          activate();
        } else if (_active) {
          _resetIdleTimer(); // any command resets idle timer
        }
        if (_active && typeof Mascot !== 'undefined') {
          Mascot.setExpression('surprised');
        }
      });
    }

    // 4. Hook VoiceSystem.say to trigger Mascot lip-sync + speech bubble
    if (typeof VoiceSystem !== 'undefined' && typeof Mascot !== 'undefined') {
      const origSay = VoiceSystem.say;
      VoiceSystem.say = function(key, options = {}) {
        const audio = origSay.call(VoiceSystem, key, options);
        if (audio) {
          Mascot.startTalking(audio);
          audio.addEventListener('ended', () => Mascot.stopTalking(), {once: true});
          // Use resolved key (after random pool selection)
          _updateSpeechBubble(audio._voiceKey || key);
        }
        return audio;
      };

      // Also hook speak (dynamic TTS)
      const origSpeak = VoiceSystem.speak;
      VoiceSystem.speak = function(text, options = {}) {
        Mascot.startTalking(null); // fallback lip sync
        const origOnEnd = options.onEnd;
        options.onEnd = () => {
          Mascot.stopTalking();
          if (origOnEnd) origOnEnd();
        };
        // Show text in speech bubble
        _showSpeechBubble(text);
        return origSpeak.call(VoiceSystem, text, options);
      };
    }

    // 5. Hook game events to mascot expressions
    if (typeof socket !== 'undefined' && typeof Mascot !== 'undefined') {
      hookMascotExpressions(socket);
    } else {
      // Wait for socket
      const check = setInterval(() => {
        if (typeof socket !== 'undefined' && typeof Mascot !== 'undefined') {
          hookMascotExpressions(socket);
          clearInterval(check);
        }
      }, 500);
      setTimeout(() => clearInterval(check), 10000);
    }

    // 6. Game voice hooks (auto-inits itself via DOMContentLoaded)

    // 7. Demo/Tutorial auto-start for first-time users
    if (typeof Demo !== 'undefined' && typeof Tutorial !== 'undefined' && Tutorial.shouldShow()) {
      setTimeout(() => Demo.start(), 2000);
      localStorage.setItem('crayxus_tutorial_done', 'true');
    }

    // 8. Create settings button
    createSettingsUI();

    // 9. Start in dormant state
    _setDormantVisual();

    console.log('[DanDan] AI assistant ready (dormant — say "你好蛋蛋" to wake)');
  }

  function hookMascotExpressions(sock) {
    sock.on('syncAction', (d) => {
      const isMe = typeof mySeat !== 'undefined' && d.seat === mySeat;

      // Bomb → surprised
      if (d.type === 'play' && d.handType) {
        if (['炸弹', '王炸', '同花顺'].includes(d.handType)) {
          Mascot.setExpression(isMe ? 'happy' : 'surprised');
        }
      }

      // Game end
      if (d.finishOrder && d.finishOrder.length >= 3 && typeof mySeat !== 'undefined') {
        const myTeamWon = d.finishOrder[0] % 2 === mySeat % 2;
        setTimeout(() => {
          Mascot.setExpression(myTeamWon ? 'cheer' : 'sad');
        }, 500);
      }
    });

    // AI Coach → thinking expression
    if (typeof useAiHelp === 'function') {
      const origHelp = useAiHelp;
      window.useAiHelp = function() {
        Mascot.setExpression('thinking');
        return origHelp.apply(this, arguments);
      };
    }
  }

  // ── Dormant / Active state ──

  function activate() {
    if (_active) { _resetIdleTimer(); return; }
    _active = true;
    console.log('[DanDan] Activated!');
    const face = document.getElementById('dandan-face');
    if (face) { face.style.opacity = '1'; face.style.filter = ''; }
    const fab = document.getElementById('dandan-fab');
    if (fab) { fab.style.opacity = '1'; fab.style.filter = ''; }
    const speech = document.getElementById('dd-speech');
    if (speech) { speech.style.opacity = '1'; }
    // Greet on activation
    if (typeof VoiceSystem !== 'undefined') VoiceSystem.say('welcome');
    _resetIdleTimer();
  }

  function deactivate() {
    if (!_active) return;
    _active = false;
    if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
    console.log('[DanDan] Deactivated (idle)');
    closeFabPanel();
    const face = document.getElementById('dandan-face');
    if (face) { face.style.opacity = '0.3'; face.style.filter = 'grayscale(0.8)'; }
    const fab = document.getElementById('dandan-fab');
    if (fab) { fab.style.opacity = '0.4'; fab.style.filter = 'grayscale(0.6)'; }
    const speech = document.getElementById('dd-speech');
    if (speech) { speech.style.opacity = '0'; }
  }

  function _resetIdleTimer() {
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = setTimeout(deactivate, IDLE_TIMEOUT);
  }

  function _setDormantVisual() {
    // Set initial dormant look (without triggering deactivate logic)
    const face = document.getElementById('dandan-face');
    if (face) { face.style.opacity = '0.3'; face.style.filter = 'grayscale(0.8)'; face.style.transition = 'opacity 0.5s, filter 0.5s'; }
    const fab = document.getElementById('dandan-fab');
    if (fab) { fab.style.opacity = '0.4'; fab.style.filter = 'grayscale(0.6)'; fab.style.transition = 'opacity 0.3s, filter 0.3s'; }
    const speech = document.getElementById('dd-speech');
    if (speech) { speech.style.opacity = '0'; speech.style.transition = 'opacity 0.5s'; }
  }

  // ── Floating DanDan Button (visible on ALL pages) ──

  let fabOpen = false;
  let fabPanel = null;

  function createSettingsUI() {
    // Floating Action Button — mini robot face
    const fab = document.createElement('div');
    fab.id = 'dandan-fab';
    fab.style.cssText = `
      position: fixed; bottom: 24px; left: 24px; z-index: 9999;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, #1a1a2e, #2a2a4a);
      border: 2px solid #ffd700;
      box-shadow: 0 4px 20px rgba(255,215,0,0.3), 0 0 40px rgba(0,229,255,0.1);
      cursor: pointer; transition: all 0.3s;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    `;
    fab.innerHTML = `
      <svg viewBox="0 0 60 60" width="48" height="48">
        <circle cx="30" cy="33" r="22" fill="#1a1a2e" stroke="#ffd700" stroke-width="1.5"/>
        <circle cx="22" cy="30" r="5" fill="#00e5ff"/>
        <circle cx="38" cy="30" r="5" fill="#00e5ff"/>
        <circle cx="20.5" cy="28.5" r="2" fill="#fff" opacity="0.8"/>
        <circle cx="36.5" cy="28.5" r="2" fill="#fff" opacity="0.8"/>
        <line x1="25" y1="40" x2="35" y2="40" stroke="#ffd700" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="30" cy="9" r="3" fill="#ffd700" opacity="0.8"/>
        <line x1="30" y1="12" x2="30" y2="11" stroke="#ffd700" stroke-width="1.5"/>
      </svg>
    `;
    fab.title = '呼叫蛋蛋';

    fab.onmouseover = () => {
      fab.style.transform = 'scale(1.1)';
      fab.style.boxShadow = '0 6px 28px rgba(255,215,0,0.5), 0 0 60px rgba(0,229,255,0.2)';
    };
    fab.onmouseout = () => {
      if (!fabOpen) {
        fab.style.transform = 'scale(1)';
        fab.style.boxShadow = '0 4px 20px rgba(255,215,0,0.3), 0 0 40px rgba(0,229,255,0.1)';
      }
    };
    fab.onclick = (e) => {
      e.stopPropagation();
      if (!_active) { activate(); return; }
      _resetIdleTimer();
      toggleFabPanel();
    };

    document.body.appendChild(fab);

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (fabOpen && fabPanel && !fabPanel.contains(e.target) && e.target.id !== 'dandan-fab') {
        closeFabPanel();
      }
    });
  }

  function toggleFabPanel() {
    if (fabOpen) closeFabPanel();
    else openFabPanel();
  }

  function openFabPanel() {
    if (fabPanel) fabPanel.remove();

    const voiceEnabled = typeof VoiceSystem !== 'undefined' && VoiceSystem.enabled;
    const sfxEnabled = typeof VoiceSystem !== 'undefined' && VoiceSystem.sfxEnabled;
    const micEnabled = typeof VoiceInput !== 'undefined' && VoiceInput.enabled;
    const volVal = typeof VoiceSystem !== 'undefined' ? Math.round(VoiceSystem.volume * 100) : 80;

    fabPanel = document.createElement('div');
    fabPanel.id = 'dandan-fab-panel';
    fabPanel.style.cssText = `
      position: fixed; bottom: 96px; left: 24px; z-index: 9998;
      width: 300px; background: linear-gradient(135deg, #1a1a2e, #16213e);
      border: 1.5px solid #ffd700; border-radius: 20px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 30px rgba(255,215,0,0.15);
      overflow: hidden; animation: ddFabIn 0.25s ease-out;
    `;

    fabPanel.innerHTML = `
      <style>@keyframes ddFabIn{from{opacity:0;transform:translateY(20px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}</style>

      <!-- Mini robot face + speech bubble -->
      <div style="padding:20px 20px 12px;display:flex;align-items:center;gap:14px;
        border-bottom:1px solid rgba(255,215,0,0.1)">
        <div style="flex-shrink:0">
          <svg viewBox="0 0 60 68" width="50" height="56">
            <circle cx="30" cy="36" r="26" fill="#1a1a2e" stroke="#ffd700" stroke-width="1.5"/>
            <circle cx="20" cy="32" r="7" fill="#00e5ff"/>
            <circle cx="40" cy="32" r="7" fill="#00e5ff"/>
            <circle cx="18" cy="30" r="2.8" fill="#fff" opacity="0.8"/>
            <circle cx="38" cy="30" r="2.8" fill="#fff" opacity="0.8"/>
            <ellipse id="fab-panel-mouth" cx="30" cy="48" rx="6" ry="2.5" fill="#1a1a2e" stroke="#ffd700" stroke-width="1"
              style="transition:ry 0.06s"/>
            <circle cx="30" cy="8" r="3.5" fill="#ffd700" opacity="0.8"/>
            <line x1="30" y1="12" x2="30" y2="10" stroke="#ffd700" stroke-width="1.5"/>
          </svg>
        </div>
        <div style="flex:1">
          <div id="fab-speech" style="color:#fff;font-size:14px;line-height:1.5;min-height:40px">
            有什么我能帮你的吗？
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div style="padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap;
        border-bottom:1px solid rgba(255,215,0,0.1)">
        <div class="dd-qa" onclick="DanDanAI._qaHint()" style="flex:1;min-width:80px;padding:8px;border-radius:10px;
          background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.2);
          text-align:center;cursor:pointer;transition:all 0.2s;font-size:12px;color:#00e5ff">
          AI提示
        </div>
        <div class="dd-qa" onclick="DanDanAI._qaTutorial()" style="flex:1;min-width:80px;padding:8px;border-radius:10px;
          background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);
          text-align:center;cursor:pointer;transition:all 0.2s;font-size:12px;color:#ffd700">
          新手教程
        </div>
        <div class="dd-qa" onclick="DanDanAI._qaGreet()" style="flex:1;min-width:80px;padding:8px;border-radius:10px;
          background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.2);
          text-align:center;cursor:pointer;transition:all 0.2s;font-size:12px;color:#ff6b35">
          打个招呼
        </div>
      </div>

      <!-- Settings -->
      <div style="padding:12px 16px">
        <label style="display:flex;align-items:center;gap:8px;margin:6px 0;cursor:pointer;font-size:13px;color:#ccc">
          <input type="checkbox" id="fab-voice" ${voiceEnabled ? 'checked' : ''} style="accent-color:#ffd700">
          语音播报
        </label>
        <label style="display:flex;align-items:center;gap:8px;margin:6px 0;cursor:pointer;font-size:13px;color:#ccc">
          <input type="checkbox" id="fab-sfx" ${sfxEnabled ? 'checked' : ''} style="accent-color:#ffd700">
          音效
        </label>
        <label style="display:flex;align-items:center;gap:8px;margin:6px 0;cursor:pointer;font-size:13px;color:#ccc">
          <input type="checkbox" id="fab-mic" ${micEnabled ? 'checked' : ''} style="accent-color:#ffd700">
          语音控制 (麦克风)
        </label>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
          <span style="font-size:12px;color:#888;flex-shrink:0">音量</span>
          <input type="range" id="fab-volume" min="0" max="100" value="${volVal}"
            style="flex:1;accent-color:#ffd700;height:4px">
        </div>
      </div>
    `;

    document.body.appendChild(fabPanel);
    fabOpen = true;

    // Bind events
    document.getElementById('fab-voice').onchange = (e) => {
      if (typeof VoiceSystem !== 'undefined') VoiceSystem.setEnabled(e.target.checked);
    };
    document.getElementById('fab-sfx').onchange = (e) => {
      if (typeof VoiceSystem !== 'undefined') VoiceSystem.setSfxEnabled(e.target.checked);
    };
    document.getElementById('fab-mic').onchange = (e) => {
      if (typeof VoiceInput !== 'undefined') {
        if (e.target.checked) VoiceInput.start();
        else VoiceInput.stop();
      }
    };
    document.getElementById('fab-volume').oninput = (e) => {
      if (typeof VoiceSystem !== 'undefined') VoiceSystem.setVolume(e.target.value / 100);
    };

    // Greet on open
    const fabSpeech = document.getElementById('fab-speech');
    const greetings = ['有什么我能帮你的吗？', '蛋蛋来啦！', '需要AI教练出手吗？', '想打一局还是学习？'];
    if (fabSpeech) fabSpeech.textContent = greetings[Math.floor(Math.random() * greetings.length)];
  }

  function closeFabPanel() {
    if (fabPanel) {
      fabPanel.style.animation = 'none';
      fabPanel.style.opacity = '0';
      fabPanel.style.transform = 'translateY(10px)';
      fabPanel.style.transition = 'all 0.15s ease-in';
      setTimeout(() => { if (fabPanel) { fabPanel.remove(); fabPanel = null; } }, 150);
    }
    fabOpen = false;
    const fab = document.getElementById('dandan-fab');
    if (fab) {
      fab.style.transform = 'scale(1)';
      fab.style.boxShadow = '0 4px 20px rgba(255,215,0,0.3), 0 0 40px rgba(0,229,255,0.1)';
    }
  }

  // Quick actions
  function _qaHint() {
    closeFabPanel();
    const btn = document.querySelector('.btn.b-hint');
    if (btn && !btn.disabled) btn.click();
    else if (typeof useAiHelp === 'function') useAiHelp();
    else if (typeof VoiceSystem !== 'undefined') VoiceSystem.say('coach_hint');
  }

  function _qaTutorial() {
    closeFabPanel();
    if (typeof Demo !== 'undefined') { Demo.start(); }
    else if (typeof Tutorial !== 'undefined') { Tutorial.reset(); Tutorial.start(); }
  }

  function _qaGreet() {
    if (typeof VoiceSystem !== 'undefined') VoiceSystem.say('welcome');
    const fabSpeech = document.getElementById('fab-speech');
    if (fabSpeech) fabSpeech.textContent = '你好！我是蛋蛋！';
  }

  // ── Speech bubble helpers ──

  // Voice line key → display text (subset for speech bubble)
  const VOICE_TEXTS = {
    // Welcome
    welcome_1: '你好！我是蛋蛋，你的AI掼蛋助手',
    welcome_2: '我会陪你一起学习掼蛋',
    welcome_3: '准备好了吗？让我们开始吧！',
    // Game
    game_start_1: '新的一局开始了，祝你好运！',
    game_start_2: '开局了！看看这手牌',
    game_start_3: '新的一局，新的机会！',
    dealing: '正在发牌',
    dealing_done: '发牌完成，看看你的手牌吧',
    // Turn
    your_turn_1: '轮到你出牌了',
    your_turn_2: '该你了！',
    your_turn_3: '你的回合',
    your_turn_free: '自由出牌，想出什么都行',
    your_turn_follow: '需要跟牌，出更大的牌',
    hurry_up: '时间快到了，赶紧出牌吧',
    // Play feedback
    play_single: '出了一张单牌',
    play_pair: '出了一对',
    play_triple: '出了三条',
    play_straight: '出了一手顺子！',
    play_double_straight: '连对！打得漂亮',
    play_steel_plate: '钢板！威力不小',
    play_full_house: '三带二，很实用',
    play_bomb: '炸弹！威力巨大！',
    play_rocket: '王炸！谁都挡不住！',
    play_flush: '同花顺！最强炸弹！',
    play_nice_1: '打得好！',
    play_nice_2: '漂亮！',
    play_nice_3: '好牌！',
    play_smart: '这手牌出得很聪明',
    play_aggressive: '进攻很果断！',
    play_steady: '稳扎稳打，不错',
    // Pass
    pass_1: '过',
    pass_2: '选择观望',
    pass_3: '先不出，看看情况',
    pass_teammate: '队友过了',
    pass_opponent: '对手选择不出',
    // Events
    round_win: '漂亮！你赢得了牌权',
    round_lose: '牌权被对方拿走了',
    teammate_finish: '队友走完了！继续配合',
    opponent_finish: '注意，对手走完了一个人',
    bomb_played_by_me: '炸弹出击！',
    bomb_played_by_opponent: '对手出了炸弹！小心',
    bomb_played_by_teammate: '队友炸了！配合得好',
    // Hand eval
    hand_great: '这手牌不错！有好几个大牌',
    hand_good: '手牌还可以，合理安排应该能赢',
    hand_ok: '手牌一般，需要配合队友了',
    hand_bad: '这手牌有点难打，要稳住',
    hand_bomb: '手里有炸弹！关键时刻再用',
    hand_rocket: '王炸在手！这是最大的底牌',
    // Win/Lose
    win_1: '恭喜你赢了！',
    win_2: '胜利！你的水平又提升了',
    win_3: '赢了！继续保持',
    win_double: '双上！完美配合！',
    lose_1: '没关系，下局继续加油',
    lose_2: '从失败中也能学到东西',
    lose_3: '别灰心，起起落落',
    lose_double: '双下了，调整一下策略',
    // Coach
    coach_hint: '让我来帮你分析',
    coach_recommend: 'AI教练建议你这样出牌',
    coach_thinking: '让我想想，这手牌可以这样打',
    // Teaching
    lesson_start: '欢迎来到蛋力学院',
    lesson_complete: '恭喜你完成了这节课！',
    lesson_perfect: '满分通过！你真是天才！',
    quiz_correct: '回答正确！',
    quiz_wrong: '答错了，看看解析学习一下',
    quiz_explain: '让我来解释一下这道题',
    rank_start: '欢迎参加段位测评',
    rank_done: '测评结束！让我看看成绩',
    // Tribute
    tribute_start: '进贡环节开始了',
    tribute_done: '进贡结束，正式开始',
    // Idle
    idle_1: '需要帮忙吗？',
    idle_2: '要不要来一局？',
    idle_3: '可以去蛋力学院充充电',
    // Tutorial
    guide_keyboard: '每一列代表一个点数',
    guide_colors: '灯光颜色代表花色',
    guide_select: '按亮着的键选中牌',
    guide_play: '选好牌后按出牌键',
    guide_sort: '选中牌后按空位整理',
    guide_ai_coach: '按模式键呼叫AI教练',
    guide_done: '教程完成！开始掼蛋之旅吧',
    guide_skip: '跳过教程',
  };

  const DEFAULT_GREETING = '你好！我是蛋蛋';
  let idleFadeTimer = null;
  let speechActiveTimer = null;

  function _updateSpeechBubble(key) {
    const text = VOICE_TEXTS[key];
    if (text) _showSpeechBubble(text);
  }

  function _showSpeechBubble(text) {
    if (!_active) return; // don't show bubble when dormant
    const el = document.getElementById('dd-speech');
    if (!el) return;
    _resetIdleTimer();

    // Cancel any pending fade-back
    if (idleFadeTimer) { clearTimeout(idleFadeTimer); idleFadeTimer = null; }
    if (speechActiveTimer) { clearTimeout(speechActiveTimer); speechActiveTimer = null; }

    // Fade out, swap text, fade in
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.15s';
    setTimeout(() => {
      el.textContent = text;
      el.style.opacity = '1';

      // Estimate speech duration: ~200ms per character, min 2s, max 8s
      const duration = Math.max(2000, Math.min(text.length * 200, 8000));

      // After speech ends, wait 3s then fade back to default greeting
      speechActiveTimer = setTimeout(() => {
        _fadeToDefault(el);
      }, duration + 3000);
    }, 150);
  }

  function _fadeToDefault(el) {
    if (!el) el = document.getElementById('dd-speech');
    if (!el) return;

    el.style.transition = 'opacity 1.5s ease';
    el.style.opacity = '0';
    idleFadeTimer = setTimeout(() => {
      el.textContent = DEFAULT_GREETING;
      el.style.transition = 'opacity 2s ease';
      el.style.opacity = '0.7';
      // After fully showing, reset to full opacity slowly
      idleFadeTimer = setTimeout(() => {
        el.style.opacity = '1';
      }, 2000);
    }, 1500);
  }

  // ── Game-screen awareness: hide DanDan during match ──

  function _hookScreenSwitch() {
    if (typeof switchScreen !== 'function') return;
    const origSwitch = switchScreen;
    window.switchScreen = function(id) {
      origSwitch.apply(this, arguments);
      _onScreenChange(id);
    };
  }

  function _onScreenChange(screenId) {
    const fab = document.getElementById('dandan-fab');
    const face = document.getElementById('dandan-face');
    if (screenId === 'match') {
      // Entering game — hide DanDan, stop voice input
      if (fab) fab.style.display = 'none';
      if (face) face.style.display = 'none';
      closeFabPanel();
      if (typeof VoiceInput !== 'undefined' && VoiceInput.isListening) {
        VoiceInput.stop();
      }
    } else {
      // Leaving game — show DanDan
      if (fab) fab.style.display = 'flex';
      if (face) face.style.display = '';
    }
  }

  // ── Boot ──

  document.addEventListener('DOMContentLoaded', () => {
    // Delay init to let game UI load first
    setTimeout(() => {
      init();
      _hookScreenSwitch();
    }, 500);
  });

  return {
    init,
    activate,
    deactivate,
    _qaHint,
    _qaTutorial,
    _qaGreet,
    get initialized() { return initialized; },
    get active() { return _active; },
  };

})();
