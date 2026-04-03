/**
 * Mascot System — 蛋蛋 AI Robot with Lip-Sync
 * ==============================================
 * Lightweight SVG robot character with:
 *   - Audio-driven lip sync (AnalyserNode volume → mouth shape)
 *   - Expression states (idle, talking, happy, thinking, cheer)
 *   - Blink animation (CSS only, no JS timer)
 *   - Designed for RPi5 performance (no canvas, no WebGL)
 *
 * Usage:
 *   Mascot.init('#mascot-container')
 *   Mascot.setExpression('happy')
 *   Mascot.startTalking(audioElement)
 *   Mascot.stopTalking()
 */

const Mascot = (function() {

  let container = null;
  let mouthEl = null;
  let eyeLEl = null;
  let eyeREl = null;
  let browLEl = null;
  let browREl = null;
  let glowEl = null;
  let analyser = null;
  let audioCtx = null;
  let animFrame = null;
  let currentExpression = 'idle';
  let isTalking = false;

  // ── SVG Robot ──
  // Egg-shaped robot head, simple geometry, pure CSS animations
  const SVG_TEMPLATE = `
<div id="mascot-root" style="position:relative;width:120px;height:140px;">
  <!-- Glow ring -->
  <div id="mascot-glow" style="
    position:absolute; top:-8px; left:-8px; width:136px; height:156px;
    border-radius:50%; opacity:0.3;
    background: radial-gradient(ellipse, rgba(255,215,0,0.4) 0%, transparent 70%);
    transition: opacity 0.3s;
  "></div>

  <svg viewBox="0 0 120 140" width="120" height="140" xmlns="http://www.w3.org/2000/svg">
    <!-- Head (egg shape) -->
    <ellipse cx="60" cy="70" rx="50" ry="58"
      fill="url(#headGrad)" stroke="#ffd700" stroke-width="2"/>

    <!-- Antenna -->
    <line x1="60" y1="12" x2="60" y2="2" stroke="#ffd700" stroke-width="2" stroke-linecap="round"/>
    <circle cx="60" cy="2" r="4" fill="#ff6b35" id="mascot-antenna">
      <animate attributeName="fill" values="#ff6b35;#ffd700;#ff6b35" dur="2s" repeatCount="indefinite"/>
    </circle>

    <!-- Eyes -->
    <g id="mascot-eye-l">
      <ellipse cx="40" cy="60" rx="10" ry="11" fill="#1a1a2e"/>
      <ellipse cx="40" cy="60" rx="8" ry="9" fill="#00e5ff"/>
      <ellipse cx="40" cy="58" rx="4" ry="4.5" fill="#fff" opacity="0.8"/>
      <ellipse cx="42" cy="62" rx="2" ry="2" fill="#fff" opacity="0.4"/>
    </g>
    <g id="mascot-eye-r">
      <ellipse cx="80" cy="60" rx="10" ry="11" fill="#1a1a2e"/>
      <ellipse cx="80" cy="60" rx="8" ry="9" fill="#00e5ff"/>
      <ellipse cx="80" cy="58" rx="4" ry="4.5" fill="#fff" opacity="0.8"/>
      <ellipse cx="82" cy="62" rx="2" ry="2" fill="#fff" opacity="0.4"/>
    </g>

    <!-- Eyebrows -->
    <line id="mascot-brow-l" x1="30" y1="46" x2="48" y2="44"
      stroke="#ffd700" stroke-width="2.5" stroke-linecap="round"
      style="transition: all 0.3s"/>
    <line id="mascot-brow-r" x1="72" y1="44" x2="90" y2="46"
      stroke="#ffd700" stroke-width="2.5" stroke-linecap="round"
      style="transition: all 0.3s"/>

    <!-- Cheek blush -->
    <ellipse cx="25" cy="75" rx="8" ry="5" fill="#ff6b6b" opacity="0.25"/>
    <ellipse cx="95" cy="75" rx="8" ry="5" fill="#ff6b6b" opacity="0.25"/>

    <!-- Mouth (dynamic) -->
    <ellipse id="mascot-mouth" cx="60" cy="90" rx="8" ry="3"
      fill="#1a1a2e" stroke="#ffd700" stroke-width="1"
      style="transition: ry 0.05s, rx 0.05s"/>

    <!-- Speaker grille (chin decoration) -->
    <g opacity="0.3" stroke="#ffd700" stroke-width="0.8">
      <line x1="48" y1="108" x2="72" y2="108"/>
      <line x1="50" y1="112" x2="70" y2="112"/>
      <line x1="52" y1="116" x2="68" y2="116"/>
    </g>

    <!-- Gradients -->
    <defs>
      <radialGradient id="headGrad" cx="40%" cy="35%">
        <stop offset="0%" stop-color="#2a2a4a"/>
        <stop offset="100%" stop-color="#1a1a2e"/>
      </radialGradient>
    </defs>
  </svg>

  <!-- Blink overlay (CSS animation, zero JS cost) -->
  <div id="mascot-blink-l" style="
    position:absolute; top:47px; left:20px; width:22px; height:24px;
    background:#1a1a2e; border-radius:50%; opacity:0; pointer-events:none;
    animation: mascotBlink 4s ease-in-out infinite;
  "></div>
  <div id="mascot-blink-r" style="
    position:absolute; top:47px; left:60px; width:22px; height:24px;
    background:#1a1a2e; border-radius:50%; opacity:0; pointer-events:none;
    animation: mascotBlink 4s ease-in-out infinite;
    animation-delay: 0.05s;
  "></div>
</div>

<style>
@keyframes mascotBlink {
  0%, 90%, 100% { transform: scaleY(0); opacity: 0; }
  95% { transform: scaleY(1); opacity: 1; }
}
</style>
`;

  // ── Init ──

  function init(selector) {
    // Check if big face exists on homepage (dandan-face)
    const bigFace = document.getElementById('dandan-face');
    if (bigFace) {
      // Use the homepage big face — wire up its mouth for lip-sync
      mouthEl = document.getElementById('dd-mouth');
      browLEl = document.getElementById('dd-brow-l');
      browREl = document.getElementById('dd-brow-r');
      glowEl = null;
      container = bigFace;

      // Init audio context
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
      } catch(e) {}

      console.log('[Mascot] Wired to homepage big face');
      return;
    }

    container = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;

    if (!container) {
      // Create default container (bottom-left corner for in-game)
      container = document.createElement('div');
      container.id = 'mascot-container';
      container.style.cssText = `
        position: fixed; bottom: 20px; left: 20px; z-index: 999;
        pointer-events: none; transition: all 0.3s;
      `;
      document.body.appendChild(container);
    }

    container.innerHTML = SVG_TEMPLATE;

    // Cache element refs
    mouthEl = document.getElementById('mascot-mouth');
    eyeLEl = document.getElementById('mascot-eye-l');
    eyeREl = document.getElementById('mascot-eye-r');
    browLEl = document.getElementById('mascot-brow-l');
    browREl = document.getElementById('mascot-brow-r');
    glowEl = document.getElementById('mascot-glow');

    // Init audio context for lip-sync analyser
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
    } catch(e) {
      console.warn('[Mascot] No AudioContext for lip-sync');
    }

    console.log('[Mascot] Initialized');
  }

  // ── Lip Sync ──

  function startTalking(audioEl) {
    if (!analyser || !audioCtx || !audioEl) {
      // Fallback: simple toggle animation without audio analysis
      isTalking = true;
      _fallbackLipSync();
      return;
    }

    // Resume audio context
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // Connect audio element to analyser
    try {
      const source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
    } catch(e) {
      // Already connected or error — use fallback
      isTalking = true;
      _fallbackLipSync();
      return;
    }

    isTalking = true;
    _lipSyncLoop();

    // Auto-stop when audio ends
    audioEl.addEventListener('ended', stopTalking, {once: true});
  }

  function _lipSyncLoop() {
    if (!isTalking || !analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    // Get average volume from speech range (300-3000Hz)
    // For 44100Hz sample rate, bin width = 44100/256 ≈ 172Hz
    // Bins 2-17 ≈ 344-2924Hz (speech range)
    let sum = 0;
    const start = 2, end = 17;
    for (let i = start; i < end; i++) sum += data[i];
    const avg = sum / (end - start);

    // Map volume (0-255) to mouth open amount
    const openness = Math.min(avg / 120, 1); // 0-1 normalized

    // Update mouth shape
    if (mouthEl) {
      if (mouthEl.tagName === 'path') {
        // Pac-Man style: curve the smile arc more/less
        const y = 120 + openness * 20; // 120 (smile) to 140 (wide open)
        mouthEl.setAttribute('d', `M60 120 Q100 ${y} 140 120`);
      } else {
        // Ellipse style fallback
        mouthEl.setAttribute('ry', 3 + openness * 9);
        mouthEl.setAttribute('rx', 8 + openness * 4);
      }
    }

    // Glow pulses with speech
    if (glowEl) {
      glowEl.style.opacity = 0.3 + openness * 0.4;
    }

    animFrame = requestAnimationFrame(_lipSyncLoop);
  }

  // Fallback for when AudioContext can't connect (e.g. SpeechSynthesis)
  function _fallbackLipSync() {
    if (!isTalking) return;

    const openness = 0.3 + Math.random() * 0.5;
    if (mouthEl) {
      if (mouthEl.tagName === 'path') {
        const y = 120 + openness * 20;
        mouthEl.setAttribute('d', `M60 120 Q100 ${y} 140 120`);
      } else {
        mouthEl.setAttribute('ry', 3 + openness * 9);
        mouthEl.setAttribute('rx', 8 + openness * 4);
      }
    }

    setTimeout(() => {
      if (isTalking) _fallbackLipSync();
    }, 80 + Math.random() * 60);  // ~80-140ms per frame, light on CPU
  }

  function stopTalking() {
    isTalking = false;
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }

    // Close mouth
    if (mouthEl) {
      if (mouthEl.tagName === 'path') {
        mouthEl.setAttribute('d', 'M60 120 Q100 145 140 120');
      } else {
        mouthEl.setAttribute('ry', '3');
        mouthEl.setAttribute('rx', '8');
      }
    }
    if (glowEl) {
      glowEl.style.opacity = '0.3';
    }
  }

  // ── Expressions ──

  function setExpression(expr) {
    currentExpression = expr;

    switch(expr) {
      case 'idle':
        _browNormal();
        _mouthSmile();
        break;

      case 'happy':
        _browUp();
        _mouthBigSmile();
        if (glowEl) glowEl.style.opacity = '0.6';
        setTimeout(() => {
          if (currentExpression === 'happy') setExpression('idle');
        }, 3000);
        break;

      case 'thinking':
        _browFurrow();
        _mouthFlat();
        break;

      case 'cheer':
        _browUp();
        _mouthBigSmile();
        if (glowEl) glowEl.style.opacity = '0.7';
        setTimeout(() => {
          if (currentExpression === 'cheer') setExpression('idle');
        }, 4000);
        break;

      case 'sad':
        _browSad();
        _mouthSad();
        setTimeout(() => {
          if (currentExpression === 'sad') setExpression('idle');
        }, 3000);
        break;

      case 'surprised':
        _browUp();
        _mouthOpen();
        setTimeout(() => {
          if (currentExpression === 'surprised') setExpression('idle');
        }, 1500);
        break;
    }
  }

  // Expression helpers (modify SVG attributes)
  function _browNormal() {
    if (browLEl) { browLEl.setAttribute('y1', '46'); browLEl.setAttribute('y2', '44'); }
    if (browREl) { browREl.setAttribute('y1', '44'); browREl.setAttribute('y2', '46'); }
  }
  function _browUp() {
    if (browLEl) { browLEl.setAttribute('y1', '42'); browLEl.setAttribute('y2', '40'); }
    if (browREl) { browREl.setAttribute('y1', '40'); browREl.setAttribute('y2', '42'); }
  }
  function _browFurrow() {
    if (browLEl) { browLEl.setAttribute('y1', '44'); browLEl.setAttribute('y2', '48'); }
    if (browREl) { browREl.setAttribute('y1', '48'); browREl.setAttribute('y2', '44'); }
  }
  function _browSad() {
    if (browLEl) { browLEl.setAttribute('y1', '48'); browLEl.setAttribute('y2', '44'); }
    if (browREl) { browREl.setAttribute('y1', '44'); browREl.setAttribute('y2', '48'); }
  }
  function _mouthSmile() {
    if (mouthEl) { mouthEl.setAttribute('rx', '8'); mouthEl.setAttribute('ry', '3'); }
  }
  function _mouthBigSmile() {
    if (mouthEl) { mouthEl.setAttribute('rx', '12'); mouthEl.setAttribute('ry', '5'); }
  }
  function _mouthFlat() {
    if (mouthEl) { mouthEl.setAttribute('rx', '10'); mouthEl.setAttribute('ry', '1.5'); }
  }
  function _mouthSad() {
    if (mouthEl) { mouthEl.setAttribute('rx', '8'); mouthEl.setAttribute('ry', '2'); mouthEl.setAttribute('cy', '92'); }
    setTimeout(() => { if (mouthEl) mouthEl.setAttribute('cy', '90'); }, 3000);
  }
  function _mouthOpen() {
    if (mouthEl) { mouthEl.setAttribute('rx', '10'); mouthEl.setAttribute('ry', '8'); }
  }

  // ── Show/hide ──

  function show() {
    if (container) container.style.display = '';
  }

  function hide() {
    if (container) container.style.display = 'none';
  }

  function moveTo(x, y) {
    if (!container) return;
    container.style.left = x + 'px';
    container.style.bottom = y + 'px';
  }

  // ── Public API ──

  return {
    init,
    startTalking,
    stopTalking,
    setExpression,
    show,
    hide,
    moveTo,
    get isTalking() { return isTalking; },
    get expression() { return currentExpression; },
  };

})();
