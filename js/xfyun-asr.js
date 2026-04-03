/**
 * iFlytek (讯飞) Real-time ASR — Browser Direct WebSocket
 * =========================================================
 * No server proxy needed. Auth signature computed in browser.
 * ~0.3s latency, best Chinese recognition accuracy.
 *
 * Usage:
 *   XfyunASR.onResult((text, isFinal) => { ... })
 *   XfyunASR.start()
 *   XfyunASR.stop()
 */

console.log('[XfyunASR] Module loaded');

const XfyunASR = (function() {

  // ── 讯飞开放平台凭证 (需要用户在 xfyun.cn 注册获取) ──
  const APPID = '3a94f42a';
  const API_KEY = 'ac3109d509e47f24b6ee9a4a8ecbafa5';
  const API_SECRET = 'OGYzOTcwYTZjYjFlNTgwZjdlNzI1Y2I2';
  const HOST = 'iat-api.xfyun.cn';

  let ws = null;
  let mediaStream = null;
  let audioCtx = null;
  let processor = null;
  let isListening = false;
  let onResultCallback = null;
  let resultText = '';
  let resultTextArray = [];

  // ── Auth: generate signed WebSocket URL ──

  async function _getWsUrl() {
    const date = new Date().toUTCString();
    const signatureOrigin = `host: ${HOST}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;

    // HMAC-SHA256 using Web Crypto API (no library needed)
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

  // ── Start listening ──

  async function start() {
    if (isListening) return;
    if (!APPID || !API_KEY || !API_SECRET) {
      console.warn('[XfyunASR] Missing credentials. Need APPID, API_KEY, API_SECRET from xfyun.cn');
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
      });
    } catch(e) {
      console.error('[XfyunASR] Mic access denied:', e);
      return;
    }

    isListening = true;
    _listen();
    console.log('[XfyunASR] Listening...');
  }

  // ── One recognition session (auto-restarts) ──

  async function _listen() {
    if (!isListening) return;

    resultText = '';
    resultTextArray = [];

    // Get signed URL
    const url = await _getWsUrl();

    ws = new WebSocket(url);

    let isFirstFrame = true;
    let frameInterval = null;

    ws.onopen = () => {
      console.log('[XfyunASR] Connected');

      // Set up audio processing
      audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(mediaStream);
      processor = audioCtx.createScriptProcessor(4096, 1, 1);

      // Send audio frames every 40ms (1280 bytes = 640 samples at 16kHz 16bit)
      let audioBuffer = [];

      processor.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== 1) return;
        const float32 = e.inputBuffer.getChannelData(0);

        // VAD: skip silent frames (don't send noise to讯飞)
        let maxAmp = 0;
        for (let i = 0; i < float32.length; i += 32) {
          const a = Math.abs(float32[i]);
          if (a > maxAmp) maxAmp = a;
        }
        if (maxAmp < 0.01 && !isFirstFrame) return; // skip silence

        // Downsample if needed
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

        // Convert to Int16
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
            // First frame includes config
            ws.send(JSON.stringify({
              common: { app_id: APPID },
              business: {
                language: 'zh_cn',
                domain: 'iat',
                accent: 'mandarin',
                dwa: 'wpgs',  // dynamic correction
                ptt: 1,       // auto punctuation
                vad_eos: 3000 // 3s silence = end of speech
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
          return;
        }

        if (resp.data && resp.data.result) {
          const result = resp.data.result;
          // Extract text from ws[].cw[].w
          let segText = '';
          if (result.ws) {
            result.ws.forEach(w => {
              w.cw.forEach(cw => { segText += cw.w; });
            });
          }

          // Handle dynamic correction (pgs: "apd" = append, "rpl" = replace)
          if (result.pgs === 'rpl' && result.rg) {
            // Replace range
            resultTextArray.splice(result.rg[0], result.rg[1] - result.rg[0] + 1, segText);
          } else {
            resultTextArray.push(segText);
          }

          resultText = resultTextArray.join('');

          // Emit intermediate result
          if (onResultCallback && resultText) {
            const isFinal = resp.data.status === 2;
            onResultCallback(resultText, isFinal);
            if (isFinal) {
              console.log(`[XfyunASR] Final: "${resultText}"`);
            }
          }
        }

        // Session complete
        if (resp.data && resp.data.status === 2) {
          _cleanup();
          // Auto-restart for continuous listening (with delay to avoid 10165)
          if (isListening) {
            setTimeout(_listen, 2000);
          }
        }
      } catch(e) {
        console.warn('[XfyunASR] Parse error:', e);
      }
    };

    ws.onerror = () => {
      console.warn('[XfyunASR] WebSocket error');
      _cleanup();
      if (isListening) setTimeout(_listen, 3000);
    };

    ws.onclose = () => {
      _cleanup();
      // Don't auto-restart here, onmessage status=2 handles it
    };
  }

  function _cleanup() {
    if (processor) { processor.disconnect(); processor = null; }
    if (audioCtx) { audioCtx.close().catch(()=>{}); audioCtx = null; }
    if (ws && ws.readyState <= 1) {
      try { ws.send(JSON.stringify({ data: { status: 2 } })); } catch(e) {}
    }
    ws = null;
  }

  // ── Stop ──

  function stop() {
    isListening = false;
    _cleanup();
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    console.log('[XfyunASR] Stopped');
  }

  function onResult(cb) {
    onResultCallback = cb;
  }

  return {
    start,
    stop,
    onResult,
    get isListening() { return isListening; },
    get available() { return !!(APPID && API_KEY && API_SECRET); },
  };

})();
