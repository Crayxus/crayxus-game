/**
 * Volcengine (火山引擎/豆包) Streaming ASR
 * ==========================================
 * WebSocket streaming speech recognition using 豆包大模型语音识别
 * Replaces Web Speech API for reliable Chinese speech recognition
 *
 * Protocol: wss://openspeech.bytedance.com/api/v3/sauc/bigmodel
 * Binary framing: 4-byte header + 4-byte payload size + payload
 */

const VolcASR = (function() {

  const WS_URL = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel';
  const API_KEY = '8280548b-9c87-424c-ba77-238ea3d9f806';
  const RESOURCE_ID = 'volc.bigasr.sauc.duration';

  let ws = null;
  let mediaStream = null;
  let audioCtx = null;
  let processor = null;
  let isListening = false;
  let onResultCallback = null;
  let reconnectTimer = null;
  let silenceTimer = null;

  // ── Binary protocol helpers ──

  function buildMessage(headerBytes, payload) {
    const payloadBuf = new TextEncoder().encode(JSON.stringify(payload));
    const msg = new ArrayBuffer(8 + payloadBuf.length);
    const view = new DataView(msg);
    // Header: 4 bytes
    view.setUint8(0, headerBytes[0]);
    view.setUint8(1, headerBytes[1]);
    view.setUint8(2, headerBytes[2]);
    view.setUint8(3, headerBytes[3]);
    // Payload size: 4 bytes big-endian
    view.setUint32(4, payloadBuf.length);
    // Payload
    new Uint8Array(msg, 8).set(payloadBuf);
    return msg;
  }

  function buildAudioMessage(pcmData, isLast) {
    const header = isLast ? [0x11, 0x22, 0x00, 0x00] : [0x11, 0x20, 0x00, 0x00];
    const msg = new ArrayBuffer(8 + pcmData.byteLength);
    const view = new DataView(msg);
    view.setUint8(0, header[0]);
    view.setUint8(1, header[1]);
    view.setUint8(2, header[2]);
    view.setUint8(3, header[3]);
    view.setUint32(4, pcmData.byteLength);
    new Uint8Array(msg, 8).set(new Uint8Array(pcmData));
    return msg;
  }

  function parseResponse(data) {
    try {
      if (data instanceof ArrayBuffer) {
        // Skip 8-byte header, parse JSON payload
        if (data.byteLength <= 8) return null;
        const payload = new TextDecoder().decode(new Uint8Array(data, 8));
        return JSON.parse(payload);
      } else if (typeof data === 'string') {
        return JSON.parse(data);
      }
    } catch(e) {
      return null;
    }
  }

  // ── Float32 PCM → Int16 PCM conversion ──

  function float32ToInt16(float32Array) {
    const int16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }

  // ── Downsample to 16kHz ──

  function downsample(buffer, fromRate, toRate) {
    if (fromRate === toRate) return buffer;
    const ratio = fromRate / toRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const idx = Math.round(i * ratio);
      result[i] = buffer[idx] || 0;
    }
    return result;
  }

  // ── Connect WebSocket ──

  function _connect() {
    if (ws && ws.readyState <= 1) return;

    const connectId = crypto.randomUUID ? crypto.randomUUID() :
      'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random()*16).toString(16));

    // WebSocket with auth headers via URL params (browsers can't set WS headers)
    // Use subprotocol trick or just connect and send auth in first message
    ws = new WebSocket(WS_URL);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('[VolcASR] Connected');
      // Send initial config
      const config = {
        header: {
          appid: 'default',
          namespace: 'SeedASR',
          connect_id: connectId,
        },
        payload: {
          user: { uid: 'dandan_user' },
          audio: {
            format: 'pcm',
            rate: 16000,
            bits: 16,
            channel: 1,
            codec: 'raw',
          },
          request: {
            model_name: 'bigmodel',
            enable_punc: true,
            enable_itn: true,
            result_type: 'full',
            show_utterances: true,
          },
        },
      };

      // Try sending with auth header in config
      config.header['X-Api-Key'] = API_KEY;
      config.header['X-Api-Resource-Id'] = RESOURCE_ID;

      const msg = buildMessage([0x11, 0x10, 0x10, 0x00], config);
      ws.send(msg);
    };

    ws.onmessage = (ev) => {
      const resp = parseResponse(ev.data);
      if (!resp) return;

      // Extract recognized text
      let text = '';
      if (resp.payload && resp.payload.result) {
        text = resp.payload.result.text || '';
      } else if (resp.result) {
        text = resp.result.text || '';
      }

      if (text && onResultCallback) {
        const isFinal = resp.payload?.result?.type === 'final' ||
                        resp.result?.type === 'final' ||
                        resp.is_final === true;
        onResultCallback(text, isFinal);
      }
    };

    ws.onerror = (e) => {
      console.warn('[VolcASR] WebSocket error');
    };

    ws.onclose = () => {
      console.log('[VolcASR] Disconnected');
      ws = null;
      if (isListening) {
        reconnectTimer = setTimeout(_connect, 2000);
      }
    };
  }

  // ── Start listening ──

  async function start() {
    if (isListening) return;

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
    } catch(e) {
      console.error('[VolcASR] Mic access denied:', e);
      return;
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source = audioCtx.createMediaStreamSource(mediaStream);

    // ScriptProcessor for raw PCM (deprecated but widely supported)
    const bufferSize = 4096;
    processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);

    processor.onaudioprocess = (e) => {
      if (!ws || ws.readyState !== 1) return;

      // Get PCM data
      const float32 = e.inputBuffer.getChannelData(0);
      const resampled = downsample(float32, audioCtx.sampleRate, 16000);
      const int16 = float32ToInt16(resampled);

      // Send audio frame
      const msg = buildAudioMessage(int16.buffer, false);
      ws.send(msg);
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);

    isListening = true;
    _connect();

    console.log('[VolcASR] Listening...');
  }

  // ── Stop ──

  function stop() {
    isListening = false;

    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    if (processor) { processor.disconnect(); processor = null; }
    if (audioCtx) { audioCtx.close().catch(()=>{}); audioCtx = null; }
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }

    if (ws) {
      // Send last frame
      try {
        const lastMsg = buildAudioMessage(new ArrayBuffer(0), true);
        ws.send(lastMsg);
      } catch(e) {}
      ws.close();
      ws = null;
    }

    console.log('[VolcASR] Stopped');
  }

  function onResult(cb) {
    onResultCallback = cb;
  }

  return {
    start,
    stop,
    onResult,
    get isListening() { return isListening; },
  };

})();
