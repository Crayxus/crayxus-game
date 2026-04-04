/**
 * Voice Input — Microphone speech recognition for Guandan AI
 * ===========================================================
 * Uses Web Speech API (Chrome built-in, zero CPU cost on RPi5).
 * Falls back gracefully if no mic or no speech API.
 *
 * Supported commands:
 *   "出牌" / "打" → click PLAY button
 *   "过" / "不要" → click PASS button
 *   "提示" / "帮我看看" → trigger AI Coach
 *   "开始" → start game
 *
 * Usage:
 *   VoiceInput.init()
 *   VoiceInput.start()  // start listening
 *   VoiceInput.stop()   // stop listening
 */

const VoiceInput = (function() {

  let recognition = null;
  let isListening = false;
  let enabled = false;
  let onCommandCallback = null;

  // Command mapping: keyword → action
  const COMMANDS = [
    { keywords: ['你好蛋蛋', '蛋蛋你好', '嗨蛋蛋', '蛋蛋'], action: 'wake' },
    { keywords: ['出牌', '打', '出', '打牌'], action: 'play' },
    { keywords: ['过', '不要', '不出', '过牌'], action: 'pass' },
    { keywords: ['提示', '帮我', '看看', '教练', '分析'], action: 'hint' },
    { keywords: ['开始', '开局', '来一局'], action: 'start' },
    { keywords: ['整理', '理牌', '排列'], action: 'sort' },
  ];

  let useVolcASR = false; // true = 豆包ASR, false = Web Speech API

  function init() {
    // Use Web Speech API — works great on localhost with proxy
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[VoiceInput] No speech recognition available');
      return;
    }

    useVolcASR = false;
    recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;
      _handleRecognizedText(last[0].transcript.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.warn(`[VoiceInput] Error: ${event.error}`);
      if (event.error === 'network' && isListening) {
        setTimeout(() => { if (isListening) restart(); }, 2000);
      }
    };

    recognition.onend = () => {
      if (isListening) {
        setTimeout(() => {
          if (isListening) { try { recognition.start(); } catch(e) {} }
        }, 300);
      }
    };
    console.log('[VoiceInput] Using Web Speech API');

    // Load saved preference
    enabled = localStorage.getItem('voice_input_enabled') === 'true';
    if (enabled) start();

    // Kiosk mode: auto-start on first user interaction
    if (!enabled) {
      const autoEnable = () => {
        if (!isListening) start();
        document.removeEventListener('click', autoEnable);
        document.removeEventListener('keydown', autoEnable);
      };
      document.addEventListener('click', autoEnable, { once: true });
      document.addEventListener('keydown', autoEnable, { once: true });
    }

    console.log('[VoiceInput] Initialized');
  }

  // ── Centralized text handler (shared by both ASR engines) ──

  function _handleRecognizedText(text) {
    if (!text) return;
    console.log(`[VoiceInput] Heard: "${text}"`);

    // Anti-echo: ignore if DanDan is speaking
    if (typeof Mascot !== 'undefined' && Mascot.isTalking) {
      console.log('[VoiceInput] Ignored (DanDan is speaking)');
      return;
    }
    if (text.includes('我是蛋蛋') || text.includes('AI掼蛋助手') || text.includes('蛋力学院')) {
      console.log('[VoiceInput] Ignored (echo detected)');
      return;
    }

    _lastHeardText = text;

    // Match command
    const cmd = matchCommand(text);
    if (cmd) {
      console.log(`[VoiceInput] Command: ${cmd}`);
      executeCommand(cmd);
      if (onCommandCallback) onCommandCallback(cmd, text);
    } else if (text.length >= 2) {
      console.log(`[VoiceInput] Chat: "${text}"`);
      // Fixed replies only (no API, instant response)
      if (!_tryFixedReply(text)) {
        // Fallback: didn't match any keyword
        if (typeof VoiceSystem !== 'undefined') VoiceSystem.say('idle_1');
        const el = document.getElementById('dd-speech');
        if (el) { el.textContent = '蛋蛋没听清，你再说一遍？'; el.style.opacity = '1'; }
      }
    }
  }

  function matchCommand(text) {
    for (const cmd of COMMANDS) {
      for (const kw of cmd.keywords) {
        if (text.includes(kw)) return cmd.action;
      }
    }
    return null;
  }

  let _lastHeardText = '';

  function executeCommand(action) {
    switch(action) {
      case 'play': {
        const btn = document.querySelector('.btn.b-play');
        if (btn && !btn.disabled) {
          btn.click();
          if (typeof VoiceSystem !== 'undefined') VoiceSystem.sfx('play_card');
        }
        break;
      }
      case 'pass': {
        const btn = document.querySelector('.btn.b-pass');
        if (btn && !btn.disabled) {
          btn.click();
          if (typeof VoiceSystem !== 'undefined') VoiceSystem.sfx('pass');
        }
        break;
      }
      case 'hint': {
        const btn = document.querySelector('.btn.b-hint');
        if (btn && !btn.disabled) btn.click();
        else if (typeof useAiHelp === 'function') useAiHelp();
        break;
      }
      case 'start': {
        // Try to find and click start/ready button
        const btn = document.querySelector('.btn-start, .btn-ready, [data-action="start"]');
        if (btn) btn.click();
        break;
      }
      case 'sort': {
        // Reset arrangement via keyboard bridge
        if (typeof KeyboardBridge !== 'undefined' && KeyboardBridge.resetArrangement) {
          KeyboardBridge.resetArrangement();
        }
        break;
      }
      case 'wake': {
        // Wake word — fixed reply, no API
        _tryFixedReply(_lastHeardText);
        break;
      }
    }
  }

  function start() {
    isListening = true;
    enabled = true;
    localStorage.setItem('voice_input_enabled', 'true');
    if (typeof XfyunASR !== 'undefined' && XfyunASR.available) {
      XfyunASR.start();
    } else if (useVolcASR) {
      VolcASR.start();
    } else if (recognition) {
      try { recognition.start(); } catch(e) {}
    }
    console.log('[VoiceInput] Listening...');
  }

  function stop() {
    isListening = false;
    enabled = false;
    localStorage.setItem('voice_input_enabled', 'false');
    if (typeof XfyunASR !== 'undefined' && XfyunASR.available) {
      XfyunASR.stop();
    } else if (useVolcASR) {
      VolcASR.stop();
    } else if (recognition) {
      try { recognition.stop(); } catch(e) {}
    }
    console.log('[VoiceInput] Stopped');
  }

  function restart() {
    if (typeof XfyunASR !== 'undefined' && XfyunASR.available) {
      XfyunASR.stop();
      setTimeout(() => XfyunASR.start(), 500);
    } else if (useVolcASR) {
      VolcASR.stop();
      setTimeout(() => VolcASR.start(), 500);
    } else if (recognition) {
      try { recognition.stop(); } catch(e) {}
      setTimeout(() => { try { recognition.start(); } catch(e) {} }, 200);
    }
  }

  function toggle() {
    if (isListening) stop();
    else start();
  }

  // ── Fixed replies (instant, no API) ──

  const FIXED_REPLIES = [
    { keywords: ['你好', '嗨', '哈喽', '好', '嘿'], voice: 'welcome_1', text: '你好！我是蛋蛋，你的AI掼蛋助手' },
    { keywords: ['你是谁', '你叫什么', '介绍', '是谁'], voice: 'welcome_2', text: '我是蛋蛋，我会陪你学习掼蛋' },
    { keywords: ['怎么玩', '怎么打', '教我', '规则', '玩法'], voice: 'guide_keyboard', text: '我来教你！每一列代表一个点数' },
    { keywords: ['炸弹', '什么是炸弹', '炸'], voice: 'play_bomb', text: '炸弹是四张相同的牌，威力巨大！' },
    { keywords: ['测评', '段位', '考试', '测试', '考'], voice: 'rank_start', text: '欢迎参加段位测评', action: 'START_QUIZ' },
    { keywords: ['打牌', '来一局', '开始', '对战', '打', '来'], voice: 'game_start_1', text: '好的，开始一局！', action: 'START_GAME' },
    { keywords: ['学习', '课程', '学院', '学'], voice: 'lesson_start', text: '欢迎来到蛋力学院', action: 'START_COURSE' },
    { keywords: ['演示', '教程', '展示', '看看', '示范'], voice: 'guide_done', text: '我来给你演示一遍', action: 'START_DEMO' },
    { keywords: ['比赛', '赛事', '锦标', '竞赛'], voice: null, text: '带你去看赛事！', action: 'SHOW_TOURNAMENT' },
    { keywords: ['谢谢', '感谢', '谢'], voice: 'play_nice_1', text: '不客气！随时找我' },
    { keywords: ['厉害', '牛', '强', '棒'], voice: 'play_nice_2', text: '谢谢夸奖！一起加油' },
    { keywords: ['再见', '拜拜', '退出', '走了'], voice: null, text: '下次再来找蛋蛋玩！' },
    { keywords: ['掼蛋', '干嘛', '什么', '这个'], voice: 'welcome_2', text: '我是蛋蛋，专门教你打掼蛋的AI助手' },
  ];

  function _tryFixedReply(text) {
    // Clean text: remove punctuation, deduplicate consecutive chars
    let clean = text.replace(/[。，？！、\.\,\?\!]/g, '').trim();
    clean = clean.replace(/(.)\1{1,}/g, '$1'); // "好好好" → "好", "展展示" → "展示"
    console.log(`[VoiceInput] Cleaned: "${clean}"`);

    for (const rule of FIXED_REPLIES) {
      for (const kw of rule.keywords) {
        if (clean.includes(kw)) {
          console.log(`[VoiceInput] Fixed reply: "${rule.text}"`);

          // Play voice
          if (rule.voice && typeof VoiceSystem !== 'undefined') {
            VoiceSystem.say(rule.voice);
          } else if (typeof VoiceSystem !== 'undefined') {
            VoiceSystem.speak(rule.text);
          }

          // Show subtitle
          const el = document.getElementById('dd-speech');
          if (el) { el.textContent = rule.text; el.style.opacity = '1'; }
          const fab = document.getElementById('fab-speech');
          if (fab) fab.textContent = rule.text;

          // Execute action if any
          if (rule.action) {
            setTimeout(() => {
              if (rule.action === 'START_GAME' && typeof selectMode === 'function') selectMode('casual');
              else if (rule.action === 'START_QUIZ' && typeof AITraining !== 'undefined') AITraining.showAssessmentIntro();
              else if (rule.action === 'START_COURSE' && typeof AITraining !== 'undefined') AITraining.showAssessmentIntro();
              else if (rule.action === 'START_DEMO' && typeof Demo !== 'undefined') Demo.start();
              else if (rule.action === 'SHOW_TOURNAMENT') window.location.href = '/tournament';
            }, 2000);
          }

          return true;
        }
      }
    }
    return false;
  }

  function onCommand(cb) {
    onCommandCallback = cb;
  }

  return {
    init,
    start,
    stop,
    toggle,
    onCommand,
    get isListening() { return isListening; },
    get enabled() { return enabled; },
  };

})();
