/**
 * Voice System for Guandan AI All-in-One Machine
 * ================================================
 * Three-layer audio engine:
 *   1. Pre-generated voice lines (edge-tts mp3) — game events, teaching
 *   2. Dynamic TTS (Web Speech API) — reading quiz questions, explanations
 *   3. Sound effects — card dealing, bomb, win/lose
 *
 * Usage:
 *   VoiceSystem.init()
 *   VoiceSystem.say('game_start_1')           // pre-generated
 *   VoiceSystem.speak('这是一道关于炸弹的题目')  // dynamic TTS
 *   VoiceSystem.sfx('bomb')                    // sound effect
 */

const VoiceSystem = (function() {

  // ── State ──
  let enabled = localStorage.getItem('voice_enabled') !== null ? localStorage.getItem('voice_enabled') === 'true' : true;
  let volume = 0.8;
  let manifest = {};      // filename → url mapping
  let audioCache = {};    // filename → Audio element
  let currentAudio = null;
  let speechQueue = [];
  let isSpeaking = false;
  let initialized = false;
  let sfxEnabled = localStorage.getItem('sfx_enabled') !== null ? localStorage.getItem('sfx_enabled') === 'true' : true;

  // ── SFX definitions (generated programmatically via Web Audio API) ──
  let audioCtx = null;

  // ── Pre-generated voice line categories for random selection ──
  const RANDOM_POOLS = {
    game_start:    ['game_start_1', 'game_start_2', 'game_start_3'],
    your_turn:     ['your_turn_1', 'your_turn_2', 'your_turn_3'],
    play_nice:     ['play_nice_1', 'play_nice_2', 'play_nice_3'],
    pass:          ['pass_1', 'pass_2', 'pass_3'],
    win:           ['win_1', 'win_2', 'win_3'],
    lose:          ['lose_1', 'lose_2', 'lose_3'],
    welcome:       ['welcome_1', 'welcome_2', 'welcome_3'],
    idle:          ['idle_1', 'idle_2', 'idle_3'],
  };

  // ── Init ──

  async function init() {
    if (initialized) return;

    // Load manifest
    try {
      const resp = await fetch('audio/voice_manifest.json?t=' + Date.now());
      if (resp.ok) manifest = await resp.json();
    } catch(e) {
      console.warn('[Voice] No manifest found, dynamic TTS only');
    }

    // Init Web Audio for SFX
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {}

    // Load saved preferences
    const saved = localStorage.getItem('voice_settings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.enabled !== undefined) enabled = s.enabled;
        if (s.volume !== undefined) volume = s.volume;
        if (s.sfxEnabled !== undefined) sfxEnabled = s.sfxEnabled;
      } catch(e) {}
    }

    initialized = true;
    console.log(`[Voice] Initialized. ${Object.keys(manifest).length} voice lines loaded.`);
  }

  function saveSettings() {
    localStorage.setItem('voice_settings', JSON.stringify({enabled, volume, sfxEnabled}));
  }

  // ── Layer 1: Pre-generated voice lines ──

  function say(key, options = {}) {
    if (!enabled) return;

    // Support random pools: say('game_start') picks randomly
    if (RANDOM_POOLS[key]) {
      const pool = RANDOM_POOLS[key];
      key = pool[Math.floor(Math.random() * pool.length)];
    }

    const url = manifest[key];
    if (!url) {
      console.warn(`[Voice] Unknown voice line: ${key}`);
      return;
    }

    // Stop current audio if not queuing
    if (!options.queue && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }

    // Cancel any dynamic TTS
    if (!options.queue && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Get or create Audio element
    if (!audioCache[key]) {
      audioCache[key] = new Audio(url);
    }
    const audio = audioCache[key];
    audio.volume = volume;
    audio.currentTime = 0;

    audio._voiceKey = key; // tag with resolved key for hooks

    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(e => {
        // Autoplay blocked — user interaction needed
        console.log('[Voice] Autoplay blocked, will play on next interaction');
      });
    }

    currentAudio = audio;

    // Callback when done
    if (options.onEnd) {
      audio.onended = options.onEnd;
    }

    return audio;
  }

  // Say multiple lines in sequence
  function saySequence(keys, delay = 300) {
    if (!enabled || keys.length === 0) return;

    let idx = 0;
    function next() {
      if (idx >= keys.length) return;
      const audio = say(keys[idx], {
        onEnd: () => {
          idx++;
          if (idx < keys.length) {
            setTimeout(next, delay);
          }
        }
      });
      if (!audio) {
        idx++;
        if (idx < keys.length) setTimeout(next, delay);
      }
    }
    next();
  }

  // ── Layer 2: Dynamic TTS (Web Speech Synthesis) ──

  function speak(text, options = {}) {
    if (!enabled) return;
    if (!window.speechSynthesis) {
      console.warn('[Voice] SpeechSynthesis not available');
      return;
    }

    // Stop pre-generated audio
    if (!options.queue && currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    // Cancel previous
    if (!options.queue) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = options.rate || 1.1;  // slightly faster
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = volume;

    // Try to find a Chinese voice
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) utterance.voice = zhVoice;

    if (options.onEnd) {
      utterance.onend = options.onEnd;
    }

    window.speechSynthesis.speak(utterance);
    return utterance;
  }

  // ── Layer 3: Sound Effects (Web Audio API synthesized) ──

  function sfx(type) {
    if (!sfxEnabled || !audioCtx) return;

    // Resume audio context if suspended (autoplay policy)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    switch(type) {
      case 'click':      _sfxClick(); break;
      case 'deal':       _sfxDeal(); break;
      case 'play_card':  _sfxPlayCard(); break;
      case 'bomb':       _sfxBomb(); break;
      case 'rocket':     _sfxRocket(); break;
      case 'win':        _sfxWin(); break;
      case 'lose':       _sfxLose(); break;
      case 'pass':       _sfxPass(); break;
      case 'turn':       _sfxTurn(); break;
      case 'select':     _sfxSelect(); break;
      case 'error':      _sfxError(); break;
    }
  }

  // ── SFX generators (pure Web Audio, no files needed) ──

  function _tone(freq, duration, type = 'sine', vol = 0.3) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol * volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function _noise(duration, vol = 0.1) {
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * vol;
    }
    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(vol * volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();
  }

  function _sfxClick() {
    _tone(800, 0.08, 'square', 0.15);
  }

  function _sfxSelect() {
    _tone(600, 0.06, 'sine', 0.2);
    setTimeout(() => _tone(900, 0.06, 'sine', 0.15), 40);
  }

  function _sfxDeal() {
    // Card shuffle sound — rapid clicks
    for (let i = 0; i < 5; i++) {
      setTimeout(() => _tone(300 + Math.random() * 200, 0.05, 'square', 0.1), i * 60);
    }
  }

  function _sfxPlayCard() {
    // Card slap on table
    _noise(0.08, 0.3);
    _tone(200, 0.1, 'triangle', 0.2);
  }

  function _sfxBomb() {
    // Explosion: low rumble + impact
    _noise(0.5, 0.4);
    _tone(80, 0.4, 'sawtooth', 0.3);
    setTimeout(() => _tone(60, 0.3, 'sawtooth', 0.2), 100);
    setTimeout(() => _noise(0.3, 0.2), 150);
  }

  function _sfxRocket() {
    // Rising whistle + big explosion
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2000, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3 * volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
    // Then explosion
    setTimeout(() => _sfxBomb(), 350);
  }

  function _sfxWin() {
    // Victory fanfare: ascending notes
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      setTimeout(() => _tone(freq, 0.3, 'sine', 0.25), i * 150);
    });
  }

  function _sfxLose() {
    // Sad descending
    const notes = [400, 350, 300, 250];
    notes.forEach((freq, i) => {
      setTimeout(() => _tone(freq, 0.4, 'triangle', 0.2), i * 200);
    });
  }

  function _sfxPass() {
    _tone(300, 0.15, 'sine', 0.15);
  }

  function _sfxTurn() {
    // Gentle ding
    _tone(880, 0.15, 'sine', 0.2);
    setTimeout(() => _tone(1100, 0.1, 'sine', 0.15), 80);
  }

  function _sfxError() {
    _tone(200, 0.2, 'square', 0.2);
    setTimeout(() => _tone(150, 0.3, 'square', 0.15), 100);
  }

  // ── Stop all audio ──

  function stop() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  // ── Settings ──

  function setEnabled(val) {
    enabled = !!val;
    if (!enabled) stop();
    saveSettings();
  }

  function setVolume(val) {
    volume = Math.max(0, Math.min(1, val));
    saveSettings();
  }

  function setSfxEnabled(val) {
    sfxEnabled = !!val;
    saveSettings();
  }

  // ── Public API ──

  return {
    init,
    say,           // Pre-generated: VoiceSystem.say('game_start')
    saySequence,   // Sequential: VoiceSystem.saySequence(['welcome_1', 'guide_keyboard'])
    speak,         // Dynamic TTS: VoiceSystem.speak('你的手牌有一个炸弹')
    sfx,           // Sound effect: VoiceSystem.sfx('bomb')
    stop,
    setEnabled,
    setVolume,
    setSfxEnabled,
    get enabled() { return enabled; },
    get volume() { return volume; },
    get sfxEnabled() { return sfxEnabled; },
  };

})();
