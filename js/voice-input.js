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
    // Priority: XfyunASR (讯飞) > VolcASR (豆包) > Web Speech API
    if (typeof XfyunASR !== 'undefined' && XfyunASR.available) {
      useVolcASR = true; // reuse flag, means "use external ASR"
      XfyunASR.onResult((text, isFinal) => {
        if (!isFinal) return;
        _handleRecognizedText(text);
      });
      console.log('[VoiceInput] Using iFlytek (讯飞) ASR — direct browser WebSocket');
    } else if (typeof VolcASR !== 'undefined') {
      useVolcASR = true;
      VolcASR.onResult((text, isFinal) => {
        if (!isFinal) return;
        _handleRecognizedText(text);
      });
      console.log('[VoiceInput] Using Volcengine (豆包) ASR');
    } else {
      // Fallback: Web Speech API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.warn('[VoiceInput] No speech recognition available');
        return;
      }

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
      console.log('[VoiceInput] Using Web Speech API (fallback)');
    }

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
      if (typeof DanDanChat !== 'undefined' && DanDanChat.isConversation(text)) {
        DanDanChat.chat(text);
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
        // Wake word — send to DanDan Chat if available, otherwise pre-recorded
        if (typeof DanDanChat !== 'undefined') {
          DanDanChat.chat(_lastHeardText);
        } else if (typeof DanDanAI !== 'undefined' && DanDanAI._qaGreet) {
          DanDanAI._qaGreet();
        }
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
