/**
 * iFlytek ASR — Two-stage: Local Wake → Cloud Recognize
 * =======================================================
 * Stage 1: STANDBY — mic listens locally, no API call, near-zero cost
 *          When volume spike detected → "叮~" → transition to Stage 2
 * Stage 2: LISTENING — stream audio to 讯飞 ASR for recognition
 *          When silence detected or result received → execute → back to Stage 1
 *
 * Like 小爱同学 / car voice assistants.
 */

console.log('[XfyunASR] v3 — Two-stage wake mode');

const XfyunASR = (function() {

  const APPID = '3a94f42a';
  const API_KEY = 'ac3109d509e47f24b6ee9a4a8ecbafa5';
  const API_SECRET = 'OGYzOTcwYTZjYjFlNTgwZjdlNzI1Y2I2';
  const HOST = 'iat-api.xfyun.cn';

  // State
  let mediaStream = null;
  let analyser = null;
  let analyserCtx = null;
  let isListening = false;
  let onResultCallback = null;
  let stage = 'standby'; // 'standby' | 'listening'
  let vadInterval = null;

  // Thresholds
  const WAKE_THRESHOLD = 0.12;    // volume to trigger wake (raised to avoid ambient noise)
  const SILENCE_FRAMES = 30;      // ~1.5s of silence to end listening (at 50ms interval)
  let silenceCount = 0;

  // ASR session
  let ws = null;
  let audioCtx = null;
  let processor = null;
  let isFirstFrame = true;
  let resultText = '';
  let resultTextArray = [];

  // ── Auth ──

  async function _getWsUrl() {
    const date = new Date().toUTCString();
    const signatureOrigin = `host: ${HOST}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(API_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureOrigin));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signBuf)));
    const authOrigin = `api_key="${API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authorization = btoa(authOrigin);
    return `wss://${HOST}/v2/iat?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${HOST}`;
  }

  // ── "叮~" sound ──

  function _playDing() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  }

  // ── Visual feedback ──

  function _setEyeGlow(on) {
    const face = document.getElementById('dandan-face');
    if (!face) return;
    const svg = face.querySelector('svg');
    if (!svg) return;
    // Pulse the eyes
    const eyes = svg.querySelectorAll('circle[r="14"]'); // the black eye circles
    if (on) {
      face.style.filter = 'drop-shadow(0 0 20px rgba(0,229,255,0.6))';
    } else {
      face.style.filter = '';
    }
  }

  // ── Stage 1: STANDBY — local volume detection only ──

  function _startStandby() {
    stage = 'standby';
    silenceCount = 0;
    _setEyeGlow(false);

    if (vadInterval) clearInterval(vadInterval);
    vadInterval = setInterval(() => {
      if (stage !== 'standby' || !analyser) return;

      const data = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);

      // Get peak amplitude
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const a = Math.abs(data[i]);
        if (a > peak) peak = a;
      }

      if (peak > WAKE_THRESHOLD) {
        // Voice detected → wake up!
        console.log(`[XfyunASR] Wake! (peak: ${peak.toFixed(3)})`);
        _playDing();
        _setEyeGlow(true);
        _startListening();
      }
    }, 50);
  }

  // ── Stage 2: LISTENING — stream to 讯飞 ──

  async function _startListening() {
    stage = 'listening';
    silenceCount = 0;
    resultText = '';
    resultTextArray = [];
    isFirstFrame = true;

    const url = await _getWsUrl();
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[XfyunASR] Connected — listening...');

      audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(mediaStream);
      processor = audioCtx.createScriptProcessor(4096, 1, 1);

      let audioBuffer = [];

      processor.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== 1 || stage !== 'listening') return;

        const float32 = e.inputBuffer.getChannelData(0);

        // Check if silent
        let peak = 0;
        for (let i = 0; i < float32.length; i += 16) {
          const a = Math.abs(float32[i]);
          if (a > peak) peak = a;
        }

        if (peak < 0.005) {
          silenceCount++;
          if (silenceCount > SILENCE_FRAMES) {
            // Long silence → end session
            console.log('[XfyunASR] Silence detected, ending session');
            _endSession();
            return;
          }
        } else {
          silenceCount = 0;
        }

        // Downsample to 16kHz if needed
        const rate = audioCtx.sampleRate;
        let samples = float32;
        if (rate !== 16000) {
          const ratio = rate / 16000;
          const newLen = Math.round(float32.length / ratio);
          samples = new Float32Array(newLen);
          for (let i = 0; i < newLen; i++) {
            samples[i] = float32[Math.round(i * ratio)] || 0;
          }
        }

        // Float32 → Int16
        const int16 = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
          const s = Math.max(-1, Math.min(1, samples[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Buffer and send in 1280-byte chunks
        audioBuffer.push(...Array.from(new Uint8Array(int16.buffer)));

        while (audioBuffer.length >= 1280) {
          const chunk = audioBuffer.splice(0, 1280);
          const base64 = btoa(String.fromCharCode(...chunk));

          if (isFirstFrame) {
            ws.send(JSON.stringify({
              common: { app_id: APPID },
              business: {
                language: 'zh_cn',
                domain: 'iat',
                accent: 'mandarin',
                dwa: 'wpgs',
                ptt: 1,
                vad_eos: 3000,
              },
              data: {
                status: 0,
                format: 'audio/L16;rate=16000',
                encoding: 'raw',
                audio: base64,
              }
            }));
            isFirstFrame = false;
          } else {
            ws.send(JSON.stringify({
              data: {
                status: 1,
                format: 'audio/L16;rate=16000',
                encoding: 'raw',
                audio: base64,
              }
            }));
          }
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    };

    ws.onmessage = (ev) => {
      try {
        const resp = JSON.parse(ev.data);
        if (resp.code !== 0) {
          console.warn(`[XfyunASR] Error ${resp.code}: ${resp.message}`);
          if (resp.code === 10165) { _cleanupSession(); _startStandby(); }
          return;
        }

        if (resp.data && resp.data.result) {
          const result = resp.data.result;
          let segText = '';
          if (result.ws) {
            result.ws.forEach(w => {
              w.cw.forEach(cw => { segText += cw.w; });
            });
          }

          if (result.pgs === 'rpl' && result.rg) {
            resultTextArray.splice(result.rg[0], result.rg[1] - result.rg[0] + 1, segText);
          } else {
            resultTextArray.push(segText);
          }

          resultText = resultTextArray.join('');
        }

        // Session complete
        if (resp.data && resp.data.status === 2) {
          console.log(`[XfyunASR] Final: "${resultText}"`);
          if (resultText && onResultCallback) {
            onResultCallback(resultText, true);
          }
          _cleanupSession();
          // Back to standby after a pause
          setTimeout(() => { if (isListening) _startStandby(); }, 2000);
        }
      } catch(e) {}
    };

    ws.onerror = () => {
      _cleanupSession();
      if (isListening) setTimeout(() => _startStandby(), 3000);
    };

    ws.onclose = () => {
      // Don't auto-restart, let standby handle it
    };

    // Safety: max 15 seconds per session
    setTimeout(() => {
      if (stage === 'listening') {
        console.log('[XfyunASR] Max session time, ending');
        _endSession();
      }
    }, 15000);
  }

  function _endSession() {
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify({ data: { status: 2 } })); } catch(e) {}
    }
    // Wait for server final response, then cleanup happens in onmessage
    setTimeout(() => {
      if (stage === 'listening') {
        // Force cleanup if no response
        if (resultText && onResultCallback) {
          onResultCallback(resultText, true);
        }
        _cleanupSession();
        if (isListening) _startStandby();
      }
    }, 3000);
  }

  function _cleanupSession() {
    stage = 'standby';
    if (processor) { processor.disconnect(); processor = null; }
    if (audioCtx) { audioCtx.close().catch(()=>{}); audioCtx = null; }
    if (ws) { try { ws.close(); } catch(e) {} ws = null; }
    _setEyeGlow(false);
  }

  // ── Start / Stop ──

  async function start() {
    if (isListening) return;
    if (!APPID || !API_KEY || !API_SECRET) {
      console.warn('[XfyunASR] Missing credentials');
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
    } catch(e) {
      console.error('[XfyunASR] Mic denied:', e);
      return;
    }

    // Set up analyser for standby VAD (always on, very lightweight)
    analyserCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = analyserCtx.createMediaStreamSource(mediaStream);
    analyser = analyserCtx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);

    isListening = true;
    _startStandby();
    console.log('[XfyunASR] Ready — say something to wake up');
  }

  function stop() {
    isListening = false;
    if (vadInterval) { clearInterval(vadInterval); vadInterval = null; }
    _cleanupSession();
    if (analyserCtx) { analyserCtx.close().catch(()=>{}); analyserCtx = null; analyser = null; }
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    console.log('[XfyunASR] Stopped');
  }

  function onResult(cb) { onResultCallback = cb; }

  return {
    start, stop, onResult,
    get isListening() { return isListening; },
    get available() { return !!(APPID && API_KEY && API_SECRET); },
    get stage() { return stage; },
  };

})();
