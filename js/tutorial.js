/**
 * Tutorial / Newbie Guidance System for Guandan AI
 * =================================================
 * Interactive step-by-step tutorial with voice narration.
 * Highlights UI elements, waits for user actions, explains mechanics.
 *
 * Usage:
 *   Tutorial.start()   // Start tutorial (auto-triggered on first visit)
 *   Tutorial.skip()    // Skip tutorial
 *   Tutorial.reset()   // Reset tutorial state (show again next time)
 */

const Tutorial = (function() {

  const STORAGE_KEY = 'crayxus_tutorial_done';
  let active = false;
  let currentStep = 0;
  let overlay = null;
  let tooltip = null;
  let mascot = null;

  // ── Tutorial Steps ──
  const STEPS = [
    {
      id: 'welcome',
      voice: ['welcome_1'],
      text: '你好！我是蛋蛋，你的AI掼蛋助手。\n欢迎来到掼蛋的世界！',
      highlight: null, // no element to highlight
      position: 'center',
      waitFor: 'click', // wait for click to proceed
    },
    {
      id: 'intro',
      voice: ['welcome_2'],
      text: '我会陪你一起学习掼蛋，\n从新手到高手，一步一步来。',
      highlight: null,
      position: 'center',
      waitFor: 'click',
    },
    {
      id: 'screen',
      voice: null,
      speak: '这是游戏主屏幕。上方是对手的区域，下方是你的手牌。左右两边是你的队友和另一个对手。',
      text: '这是游戏主屏幕\n上方：对手 | 下方：你的手牌\n左右：队友和另一个对手',
      highlight: '#game-ui',
      position: 'center',
      waitFor: 'click',
    },
    {
      id: 'keyboard',
      voice: ['guide_keyboard'],
      text: '每一列代表一个点数\n从左到右：2 A K Q J 10 9 8 7 6 5 4 3\n灯光颜色代表花色',
      highlight: null, // keyboard is physical
      position: 'bottom',
      waitFor: 'click',
    },
    {
      id: 'colors',
      voice: ['guide_colors'],
      text: '🟡 金色 = 方块♦\n🔵 蓝色 = 黑桃♠\n🔴 红色 = 红心♥\n🟢 绿色 = 梅花♣',
      highlight: null,
      position: 'center',
      waitFor: 'click',
    },
    {
      id: 'select',
      voice: ['guide_select'],
      text: '按亮着的键 → 选中牌（变白色）\n再按一次 → 取消选中',
      highlight: '.hand',
      position: 'above',
      waitFor: 'click',
    },
    {
      id: 'play',
      voice: ['guide_play'],
      text: '选好牌后：\n按「出牌」键打出去\n按「过牌」键跳过',
      highlight: '.ctrls',
      position: 'above',
      waitFor: 'click',
    },
    {
      id: 'sort',
      voice: ['guide_sort'],
      text: '选中几张牌 → 按空白键位\n牌会移过去，方便整理\n双击「模式」键恢复默认排列',
      highlight: null,
      position: 'center',
      waitFor: 'click',
    },
    {
      id: 'coach',
      voice: ['guide_ai_coach'],
      text: '不知道出什么？\n按「模式」键呼叫AI教练\nAI会告诉你最佳出牌方案',
      highlight: '#ai-help-btn',
      position: 'above',
      waitFor: 'click',
    },
    {
      id: 'done',
      voice: ['guide_done'],
      text: '教程完成！🎉\n现在你已经掌握了基本操作\n开始你的掼蛋之旅吧！',
      highlight: null,
      position: 'center',
      waitFor: 'click',
      last: true,
    },
  ];

  // ── Create overlay elements ──

  function createUI() {
    // Overlay backdrop
    overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); z-index: 10000;
      transition: opacity 0.3s ease;
    `;

    // Mascot (蛋蛋 character)
    mascot = document.createElement('div');
    mascot.id = 'tutorial-mascot';
    mascot.style.cssText = `
      position: fixed; z-index: 10003;
      width: 80px; height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ffd700, #ff8c00);
      display: flex; align-items: center; justify-content: center;
      font-size: 40px; box-shadow: 0 4px 20px rgba(255,200,0,0.5);
      transition: all 0.4s ease;
    `;
    mascot.textContent = '🥚';

    // Tooltip
    tooltip = document.createElement('div');
    tooltip.id = 'tutorial-tooltip';
    tooltip.style.cssText = `
      position: fixed; z-index: 10002;
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      border: 2px solid #ffd700;
      border-radius: 16px;
      padding: 20px 24px;
      max-width: 420px; min-width: 280px;
      color: #fff; font-size: 16px; line-height: 1.8;
      white-space: pre-line;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(255,215,0,0.2);
      transition: all 0.4s ease;
    `;

    // Skip button
    const skipBtn = document.createElement('div');
    skipBtn.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10004;
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3);
      border-radius: 8px; padding: 8px 16px;
      color: #aaa; font-size: 14px; cursor: pointer;
      transition: all 0.2s;
    `;
    skipBtn.textContent = '跳过教程';
    skipBtn.onmouseover = () => { skipBtn.style.background = 'rgba(255,255,255,0.2)'; };
    skipBtn.onmouseout = () => { skipBtn.style.background = 'rgba(255,255,255,0.1)'; };
    skipBtn.onclick = (e) => { e.stopPropagation(); skip(); };

    // Next indicator
    const nextHint = document.createElement('div');
    nextHint.id = 'tutorial-next';
    nextHint.style.cssText = `
      margin-top: 16px; color: #ffd700; font-size: 13px;
      opacity: 0.7; text-align: right;
    `;
    nextHint.textContent = '点击任意处继续 ▶';
    tooltip.appendChild(nextHint);

    // Progress dots
    const progress = document.createElement('div');
    progress.id = 'tutorial-progress';
    progress.style.cssText = `
      margin-top: 12px; display: flex; gap: 6px; justify-content: center;
    `;
    tooltip.appendChild(progress);

    document.body.appendChild(overlay);
    document.body.appendChild(mascot);
    document.body.appendChild(tooltip);
    document.body.appendChild(skipBtn);

    // Click to advance
    overlay.onclick = () => nextStep();
    tooltip.onclick = (e) => { e.stopPropagation(); nextStep(); };
  }

  // ── Position tooltip ──

  function positionTooltip(step) {
    const pos = step.position || 'center';

    // Update progress dots
    const progressEl = document.getElementById('tutorial-progress');
    if (progressEl) {
      progressEl.innerHTML = STEPS.map((_, i) =>
        `<div style="width:8px;height:8px;border-radius:50%;background:${i <= currentStep ? '#ffd700' : '#555'};transition:background 0.3s"></div>`
      ).join('');
    }

    // Remove any existing highlight
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight');
      el.style.removeProperty('position');
      el.style.removeProperty('z-index');
      el.style.removeProperty('box-shadow');
    });

    // Highlight target element
    if (step.highlight) {
      const target = document.querySelector(step.highlight);
      if (target) {
        target.classList.add('tutorial-highlight');
        target.style.position = target.style.position || 'relative';
        target.style.zIndex = '10001';
        target.style.boxShadow = '0 0 0 4px #ffd700, 0 0 20px rgba(255,215,0,0.4)';
      }
    }

    // Position tooltip and mascot
    if (pos === 'center') {
      tooltip.style.left = '50%';
      tooltip.style.top = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      mascot.style.left = 'calc(50% - 180px)';
      mascot.style.top = 'calc(50% - 40px)';
      mascot.style.transform = 'none';
    } else if (pos === 'bottom') {
      tooltip.style.left = '50%';
      tooltip.style.top = 'auto';
      tooltip.style.bottom = '40px';
      tooltip.style.transform = 'translateX(-50%)';
      mascot.style.left = 'calc(50% - 180px)';
      mascot.style.bottom = '60px';
      mascot.style.top = 'auto';
    } else if (pos === 'above') {
      const target = step.highlight ? document.querySelector(step.highlight) : null;
      if (target) {
        const rect = target.getBoundingClientRect();
        tooltip.style.left = rect.left + rect.width / 2 + 'px';
        tooltip.style.top = Math.max(20, rect.top - 200) + 'px';
        tooltip.style.transform = 'translateX(-50%)';
        mascot.style.left = (rect.left + rect.width / 2 - 180) + 'px';
        mascot.style.top = Math.max(20, rect.top - 200 + 20) + 'px';
      } else {
        // fallback to center
        tooltip.style.left = '50%';
        tooltip.style.top = '40%';
        tooltip.style.transform = 'translate(-50%, -50%)';
        mascot.style.left = 'calc(50% - 180px)';
        mascot.style.top = 'calc(40% - 40px)';
      }
    }
  }

  // ── Show a step ──

  function showStep(idx) {
    if (idx >= STEPS.length) {
      finish();
      return;
    }

    currentStep = idx;
    const step = STEPS[idx];

    // Update tooltip text
    const textNode = tooltip.childNodes[0];
    if (textNode && textNode.nodeType === 3) {
      textNode.textContent = step.text;
    } else {
      tooltip.insertBefore(document.createTextNode(step.text), tooltip.firstChild);
    }

    // Position
    positionTooltip(step);

    // Play voice
    if (typeof VoiceSystem !== 'undefined') {
      VoiceSystem.stop();
      if (step.voice) {
        setTimeout(() => VoiceSystem.say(step.voice[0]), 300);
      } else if (step.speak) {
        setTimeout(() => VoiceSystem.speak(step.speak), 300);
      }
    }
  }

  // ── Navigation ──

  function nextStep() {
    if (!active) return;
    if (typeof VoiceSystem !== 'undefined') VoiceSystem.sfx('click');
    showStep(currentStep + 1);
  }

  function prevStep() {
    if (!active || currentStep <= 0) return;
    showStep(currentStep - 1);
  }

  // ── Start / Stop ──

  function start() {
    if (active) return;
    active = true;
    currentStep = 0;

    createUI();
    showStep(0);
  }

  function skip() {
    if (typeof VoiceSystem !== 'undefined') {
      VoiceSystem.stop();
      VoiceSystem.say('guide_skip');
    }
    finish();
  }

  function finish() {
    active = false;
    localStorage.setItem(STORAGE_KEY, 'true');

    // Clean up UI
    ['tutorial-overlay', 'tutorial-mascot', 'tutorial-tooltip'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    // Remove skip button
    document.querySelectorAll('[onclick]').forEach(el => {
      if (el.textContent === '跳过教程') el.remove();
    });
    // Remove highlights
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight');
      el.style.removeProperty('z-index');
      el.style.removeProperty('box-shadow');
    });

    overlay = null;
    tooltip = null;
    mascot = null;
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function shouldShow() {
    return !localStorage.getItem(STORAGE_KEY);
  }

  // ── Auto-start on first visit ──

  function autoStart() {
    if (shouldShow()) {
      // Delay to let game UI load
      setTimeout(() => start(), 2000);
    }
  }

  return {
    start,
    skip,
    finish,
    reset,
    shouldShow,
    autoStart,
    get active() { return active; },
  };

})();
