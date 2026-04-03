/**
 * Volcengine ASR — Simple record-then-recognize approach
 * =======================================================
 * Records audio when user speaks, sends to server for recognition.
 * Server calls Volcengine ASR API with proper auth.
 *
 * Simpler and more reliable than WebSocket streaming.
 * Uses Voice Activity Detection (volume threshold) to auto-segment.
 */

console.log('[VolcASR] v2 - HTTP recording mode loaded');
const VolcASR = (function() {

  let mediaStream = null;
  let audioCtx = null;
  let analyser = null;
  let processor = null;
  let isListening = false;
  let onResultCallback = null;

  // Voice activity detection
  let isSpeaking = false;
  let silenceStart = 0;
  let audioChunks = [];
  const SILENCE_THRESHOLD = 8;    // volume below this = silence (lowered for sensitivity)
  const SILENCE_DURATION = 1200;  // ms of silence before processing
  const MIN_SPEECH_MS = 300;      // minimum speech length to process
  let speechStart = 0;

  // ── Start listening ──

  async function start() {
    if (isListening) return;

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
    } catch(e) {
      console.error('[VolcASR] Mic access denied:', e);
      return;
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(mediaStream);

    // Analyser for volume detection
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);

    // MediaRecorder for capturing audio
    _startVAD();

    isListening = true;
    console.log('[VolcASR] Listening...');
  }

  // ── Voice Activity Detection loop ──

  let vadInterval = null;
  let mediaRecorder = null;

  function _startVAD() {
    // Use MediaRecorder to capture audio
    const recorderStream = mediaStream;

    vadInterval = setInterval(() => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);

      // Average volume in speech range
      let sum = 0;
      for (let i = 2; i < 40; i++) sum += data[i];
      const vol = sum / 38;

      // Debug: log volume every 2 seconds
      if (Date.now() % 2000 < 60) console.log(`[VolcASR] vol: ${vol.toFixed(1)}`);

      if (vol > SILENCE_THRESHOLD) {
        if (!isSpeaking) {
          // Speech started
          isSpeaking = true;
          speechStart = Date.now();
          audioChunks = [];

          // Record raw PCM using ScriptProcessor (Volcengine needs PCM, not webm)
          _startPCMCapture();
          console.log('[VolcASR] Speech detected...');
        }
        silenceStart = 0;
      } else {
        if (isSpeaking && silenceStart === 0) {
          silenceStart = Date.now();
        }
        // Check if silence long enough to end utterance
        if (isSpeaking && silenceStart > 0 && (Date.now() - silenceStart) > SILENCE_DURATION) {
          const speechLen = Date.now() - speechStart;
          isSpeaking = false;
          silenceStart = 0;

          _stopPCMCapture();
          if (speechLen >= MIN_SPEECH_MS && audioChunks.length > 0) {
            // Merge PCM chunks into single Int16Array
            const totalLen = audioChunks.reduce((s, c) => s + c.length, 0);
            const pcm = new Int16Array(totalLen);
            let offset = 0;
            audioChunks.forEach(chunk => { pcm.set(chunk, offset); offset += chunk.length; });
            console.log(`[VolcASR] Sending ${(pcm.byteLength/1024).toFixed(1)}KB PCM...`);
            _sendPCMToServer(pcm.buffer);
          }
        }
      }
    }, 50); // check every 50ms
  }

  // ── PCM capture using ScriptProcessor ──

  let pcmProcessor = null;
  let pcmSource = null;
  let isCapturing = false;

  function _startPCMCapture() {
    if (isCapturing) return;
    isCapturing = true;
    audioChunks = [];

    pcmSource = audioCtx.createMediaStreamSource(mediaStream);
    pcmProcessor = audioCtx.createScriptProcessor(4096, 1, 1);

    pcmProcessor.onaudioprocess = (e) => {
      if (!isCapturing) return;
      const float32 = e.inputBuffer.getChannelData(0);
      // Downsample to 16kHz
      const ratio = audioCtx.sampleRate / 16000;
      const newLen = Math.round(float32.length / ratio);
      const int16 = new Int16Array(newLen);
      for (let i = 0; i < newLen; i++) {
        const idx = Math.round(i * ratio);
        const s = Math.max(-1, Math.min(1, float32[idx] || 0));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      audioChunks.push(int16);
    };

    pcmSource.connect(pcmProcessor);
    pcmProcessor.connect(audioCtx.destination);
  }

  function _stopPCMCapture() {
    isCapturing = false;
    if (pcmProcessor) { pcmProcessor.disconnect(); pcmProcessor = null; }
    if (pcmSource) { pcmSource.disconnect(); pcmSource = null; }
  }

  // ── Send PCM to server ──

  async function _sendPCMToServer(pcmBuffer) {
    try {
      const resp = await fetch('/api/asr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: pcmBuffer,
      });

      if (!resp.ok) {
        console.warn('[VolcASR] Server error:', resp.status);
        return;
      }

      const result = await resp.json();
      if (result.text && onResultCallback) {
        console.log(`[VolcASR] Recognized: "${result.text}"`);
        onResultCallback(result.text, true);
      } else {
        console.log('[VolcASR] No text in response:', result);
      }
    } catch(e) {
      console.warn('[VolcASR] Error:', e);
    }
  }

  // ── Stop ──

  function stop() {
    isListening = false;
    if (vadInterval) { clearInterval(vadInterval); vadInterval = null; }
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    if (audioCtx) { audioCtx.close().catch(()=>{}); audioCtx = null; }
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
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
