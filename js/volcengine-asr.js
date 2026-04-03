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

          mediaRecorder = new MediaRecorder(recorderStream, {
            mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus' : 'audio/webm'
          });
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
          };
          mediaRecorder.start(100); // collect in 100ms chunks
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

          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            mediaRecorder.onstop = () => {
              if (speechLen >= MIN_SPEECH_MS && audioChunks.length > 0) {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                console.log(`[VolcASR] Sending ${(blob.size/1024).toFixed(1)}KB audio...`);
                _sendToServer(blob);
              }
            };
          }
        }
      }
    }, 50); // check every 50ms
  }

  // ── Send audio to server for recognition ──

  async function _sendToServer(audioBlob) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'speech.webm');

      const resp = await fetch('/api/asr', {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        console.warn('[VolcASR] Server error:', resp.status);
        return;
      }

      const result = await resp.json();
      if (result.text && onResultCallback) {
        console.log(`[VolcASR] Recognized: "${result.text}"`);
        onResultCallback(result.text, true);
      }
    } catch(e) {
      console.warn('[VolcASR] Recognition error:', e);
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
