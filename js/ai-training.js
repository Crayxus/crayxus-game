/**
 * AI 掼蛋大师 — 教学测评系统
 *
 * 三大功能：
 * 1. 智能测评：AI 实时评估每步出牌质量
 * 2. 对局复盘：回顾关键决策，学习最优打法
 * 3. 实时教练：出牌时 AI 给出建议
 *
 * 设计参考：Chess.com 分析 + Duolingo 进度 + 围棋段位
 */

const AITraining = {
  enabled: false,
  mode: 'off',  // 'off' | 'assess' | 'review' | 'live'

  // 决策质量标签（类似 Chess.com）
  QUALITY: {
    BRILLIANT: { label: '妙手', icon: '💎', color: '#00e5ff', min: 95 },
    GREAT:     { label: '好棋', icon: '✅', color: '#4ade80', min: 85 },
    GOOD:      { label: '稳健', icon: '🟢', color: '#66bb6a', min: 70 },
    OK:        { label: '一般', icon: '🟡', color: '#fbbf24', min: 50 },
    MISTAKE:   { label: '失误', icon: '🟠', color: '#fb923c', min: 30 },
    BLUNDER:   { label: '败着', icon: '❌', color: '#f87171', min: 0 },
  },

  // 段位系统
  RANKS: [
    { name: '青铜·初窥', tier: '青铜', icon: '🛡️', min: 0,    color: '#cd7f32', bg: '#3d2b1f' },
    { name: '青铜·入门', tier: '青铜', icon: '🛡️', min: 600,  color: '#cd7f32', bg: '#3d2b1f' },
    { name: '白银·小成', tier: '白银', icon: '⚔️', min: 800,  color: '#c0c0c0', bg: '#2a2d35' },
    { name: '白银·通达', tier: '白银', icon: '⚔️', min: 1000, color: '#c0c0c0', bg: '#2a2d35' },
    { name: '黄金·精进', tier: '黄金', icon: '🏅', min: 1200, color: '#ffd700', bg: '#3d3520' },
    { name: '黄金·老练', tier: '黄金', icon: '🏅', min: 1400, color: '#ffd700', bg: '#3d3520' },
    { name: '铂金·纵横', tier: '铂金', icon: '💠', min: 1600, color: '#00e5ff', bg: '#1a2d3d' },
    { name: '铂金·无双', tier: '铂金', icon: '💠', min: 1800, color: '#00e5ff', bg: '#1a2d3d' },
    { name: '钻石·宗师', tier: '钻石', icon: '💎', min: 2000, color: '#b388ff', bg: '#2a1d3d' },
    { name: '钻石·大宗师', tier: '钻石', icon: '💎', min: 2200, color: '#b388ff', bg: '#2a1d3d' },
    { name: '王者·掼圣', tier: '王者', icon: '👑', min: 2400, color: '#ff6b35', bg: '#3d1f1f' },
    { name: '王者·掼神', tier: '王者', icon: '👑', min: 2600, color: '#ff6b35', bg: '#3d1f1f' },
    { name: '传奇·掼蛋大师', tier: '传奇', icon: '🏆', min: 2800, color: '#ff4500', bg: '#3d1010' },
  ],

  currentGame: { decisions: [], startTime: null, gameId: 0 },
  history: [],

  rating: {
    score: 1200,
    level: '中级一段',
    icon: '🥇',
    gamesPlayed: 0,
    bestScore: 0,
  },

  init() {
    try {
      const saved = localStorage.getItem('crayxus_ai_master');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.rating) this.rating = data.rating;
        if (data.history) this.history = data.history.slice(-100);
      }
    } catch(e) {}
    this.updateBadge();
  },

  save() {
    try {
      localStorage.setItem('crayxus_ai_master', JSON.stringify({
        rating: this.rating,
        history: this.history.slice(-100),
      }));
    } catch(e) {}
  },

  getQuality(score) {
    for (const key of ['BRILLIANT','GREAT','GOOD','OK','MISTAKE','BLUNDER']) {
      if (score >= this.QUALITY[key].min) return this.QUALITY[key];
    }
    return this.QUALITY.BLUNDER;
  },

  getRank(score) {
    let rank = this.RANKS[0];
    for (const r of this.RANKS) {
      if (score >= r.min) rank = r;
    }
    return rank;
  },

  getNextRank(score) {
    for (const r of this.RANKS) {
      if (r.min > score) return r;
    }
    return null;
  },

  // ===== 测评 =====

  startGame() {
    this.currentGame = {
      decisions: [],
      startTime: Date.now(),
      gameId: (this.currentGame.gameId || 0) + 1,
    };
  },

  async recordDecision(seat, hand, selectedCards, legalMoves, qValues, isPass) {
    if (!this.enabled) return;
    const n = legalMoves ? legalMoves.length : 0;
    if (n <= 1) return;

    let score = 50;
    let selectedIdx = -1;
    let bestIdx = 0;

    if (qValues && qValues.length > 0) {
      // 找最佳
      let bestQ = -Infinity;
      for (let i = 0; i < qValues.length; i++) {
        if (qValues[i] > bestQ) { bestQ = qValues[i]; bestIdx = i; }
      }

      // 找选中的
      if (isPass) {
        for (let i = 0; i < legalMoves.length; i++) {
          if (!legalMoves[i] || legalMoves[i].length === 0) { selectedIdx = i; break; }
        }
      } else if (selectedCards) {
        for (let i = 0; i < legalMoves.length; i++) {
          if (legalMoves[i] && legalMoves[i].length === selectedCards.length) {
            selectedIdx = i; break; // simplified matching
          }
        }
      }

      if (selectedIdx >= 0 && selectedIdx < qValues.length) {
        const selectedQ = qValues[selectedIdx];
        const qGap = bestQ - selectedQ;
        const sorted = [...qValues].sort((a, b) => b - a);
        const rank = sorted.indexOf(selectedQ);
        const percentile = 1 - rank / Math.max(n - 1, 1);

        // 评分公式
        score = Math.round(percentile * 80 + 20);
        if (qGap < 0.005) score = 100;  // 完美选择
        else if (qGap < 0.02) score = Math.max(score, 90);
        else if (qGap > 0.3) score = Math.min(score, 25);
        score = Math.max(0, Math.min(100, score));
      }
    }

    const quality = this.getQuality(score);

    this.currentGame.decisions.push({
      step: this.currentGame.decisions.length,
      seat, score, isPass, selectedIdx, bestIdx,
      quality: quality.label,
      qGap: qValues ? (Math.max(...qValues) - (qValues[selectedIdx] || 0)) : 0,
      nOptions: n,
      ts: Date.now(),
    });

    // 实时反馈
    if (this.mode === 'live' || this.mode === 'assess') {
      this._showMoveQuality(score, quality);
    }
  },

  endGame(win, finishOrder, mySeat) {
    if (!this.enabled || this.currentGame.decisions.length === 0) return;

    const decisions = this.currentGame.decisions;
    const scores = decisions.map(d => d.score);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    // 统计各质量
    const stats = {};
    for (const key of Object.keys(this.QUALITY)) stats[key] = 0;
    decisions.forEach(d => {
      const q = this.getQuality(d.score);
      for (const key of Object.keys(this.QUALITY)) {
        if (q.label === this.QUALITY[key].label) { stats[key]++; break; }
      }
    });

    const report = {
      gameId: this.currentGame.gameId,
      ts: Date.now(),
      win, avgScore,
      totalDecisions: decisions.length,
      stats,
      scores,
    };

    this.history.push(report);
    if (this.history.length > 100) this.history = this.history.slice(-100);

    this.rating.gamesPlayed++;
    this.rating.score = this._calculateRating();
    const rank = this.getRank(this.rating.score);
    this.rating.level = rank.name;
    this.rating.icon = rank.icon;
    if (this.rating.score > this.rating.bestScore) this.rating.bestScore = this.rating.score;

    this.save();
    this.updateBadge();

    if (this.mode !== 'off') {
      setTimeout(() => this._showReport(report), 1500);
    }
    return report;
  },

  _calculateRating() {
    if (this.history.length === 0) return 1200;
    const recent = this.history.slice(-30);
    const avgScore = recent.reduce((a, r) => a + r.avgScore, 0) / recent.length;
    const winRate = recent.filter(r => r.win).length / recent.length;
    return Math.round(avgScore * 18 * 0.7 + winRate * 2000 * 0.3 + 300);
  },

  // ===== UI =====

  updateBadge() {
    const el = document.getElementById('ai-training-badge');
    if (el) {
      const rank = this.getRank(this.rating.score);
      el.innerHTML = `${rank.icon} ${rank.name}`;
      el.style.color = rank.color;
    }
  },

  _showMoveQuality(score, quality) {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);
      z-index:9999;pointer-events:none;text-align:center;
      animation:aitFloat 1.8s ease-out forwards;`;
    el.innerHTML = `<div style="font-size:36px">${quality.icon}</div>
      <div style="font-size:14px;color:${quality.color};font-weight:bold;
        text-shadow:0 0 12px ${quality.color}55">${quality.label} ${score}</div>`;
    document.body.appendChild(el);
    if (!document.getElementById('ait-style')) {
      const s = document.createElement('style');
      s.id = 'ait-style';
      s.textContent = '@keyframes aitFloat{0%{opacity:1;transform:translate(-50%,-50%) scale(1.3)}60%{opacity:0.9}100%{opacity:0;transform:translate(-50%,-130%) scale(0.7)}}';
      document.head.appendChild(s);
    }
    setTimeout(() => el.remove(), 1800);
  },

  _showReport(report) {
    const avgColor = this.getQuality(report.avgScore).color;
    const rank = this.getRank(this.rating.score);
    const nextRank = this.getNextRank(this.rating.score);
    const progress = nextRank ?
      Math.round((this.rating.score - rank.min) / (nextRank.min - rank.min) * 100) : 100;

    // 质量分布条
    let qualityBars = '';
    for (const [key, q] of Object.entries(this.QUALITY)) {
      const cnt = report.stats[key] || 0;
      if (cnt > 0) {
        qualityBars += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">
          <span style="font-size:14px">${q.icon}</span>
          <span style="color:${q.color};font-size:12px;min-width:36px">${q.label}</span>
          <div style="flex:1;height:16px;background:#0d1120;border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${cnt/report.totalDecisions*100}%;background:${q.color};border-radius:4px;
              display:flex;align-items:center;justify-content:flex-end;padding-right:4px;font-size:10px;color:#000;font-weight:bold">
              ${cnt}</div>
          </div>
        </div>`;
      }
    }

    // 分数曲线
    let curveHtml = '';
    const w = 100 / Math.max(report.scores.length, 1);
    report.scores.forEach(s => {
      const c = this.getQuality(s).color;
      curveHtml += `<div style="width:${w}%;height:${Math.max(6,s/100*50)}px;background:${c};display:inline-block;border-radius:1px;margin:0 0.3px"></div>`;
    });

    const html = `<div id="ai-report" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;overflow-y:auto"
      onclick="if(event.target===this)this.remove()">
      <div style="background:linear-gradient(135deg,#0f1628,#151a2e);border:2px solid ${avgColor};border-radius:20px;
        padding:28px;max-width:400px;width:92%;color:#e0e0e0;font-family:'Segoe UI',sans-serif;
        box-shadow:0 0 40px ${avgColor}22" onclick="event.stopPropagation()">

        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:13px;color:#888">${report.win ? '🏆 胜利' : '😤 再接再厉'}</div>
          <div style="font-size:56px;font-weight:900;color:${avgColor};line-height:1.1;
            text-shadow:0 0 20px ${avgColor}44">${report.avgScore}</div>
          <div style="font-size:14px;color:${avgColor}">${this.getQuality(report.avgScore).label}</div>
        </div>

        <div style="margin-bottom:16px">${qualityBars}</div>

        <div style="background:#0a0e1a;padding:10px;border-radius:10px;margin-bottom:16px">
          <div style="color:#666;font-size:10px;margin-bottom:4px">决策质量曲线 (${report.totalDecisions}步)</div>
          <div style="display:flex;align-items:flex-end;height:54px">${curveHtml}</div>
        </div>

        <div style="background:#0a0e1a;padding:12px;border-radius:10px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-size:20px">${rank.icon}</span>
            <div>
              <div style="font-size:14px;font-weight:bold;color:${rank.color}">${rank.name}</div>
              <div style="font-size:11px;color:#888">综合评分 ${this.rating.score}</div>
            </div>
          </div>
          ${nextRank ? `<div style="position:relative;height:8px;background:#1e2642;border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,${rank.color},${nextRank.color});
              border-radius:4px;transition:width 0.5s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px">
            <span style="font-size:10px;color:#888">${rank.name}</span>
            <span style="font-size:10px;color:${nextRank.color}">→ ${nextRank.name} (${nextRank.min}分)</span>
          </div>` : '<div style="color:#ff6b35;font-size:12px;text-align:center">已达最高段位！</div>'}
        </div>

        <button onclick="document.getElementById('ai-report').remove()"
          style="display:block;width:100%;padding:12px;background:${avgColor};color:#000;
          border:none;border-radius:10px;font-weight:bold;cursor:pointer;font-size:15px">继续挑战</button>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  // 复盘
  showReview() {
    const data = this.currentGame.decisions;
    if (data.length === 0) { this._toast('还没有对局数据，先打一局再复盘！'); return; }

    const avgScore = Math.round(data.reduce((a, d) => a + d.score, 0) / data.length);

    let stepsHtml = '';
    data.forEach((d, i) => {
      const q = this.getQuality(d.score);
      const optNote = d.selectedIdx === d.bestIdx ? '最优选择' : `第${d.selectedIdx+1}/${d.nOptions}选`;
      stepsHtml += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;
        border-bottom:1px solid #1e264233">
        <span style="color:#555;font-size:11px;min-width:28px">${i+1}</span>
        <span style="font-size:16px">${q.icon}</span>
        <div style="flex:1">
          <div style="font-size:12px;color:${q.color};font-weight:600">${q.label}</div>
          <div style="font-size:10px;color:#888">${d.isPass?'过牌':'出牌'} · ${optNote}</div>
        </div>
        <span style="color:${q.color};font-weight:bold;font-size:16px">${d.score}</span>
      </div>`;
    });

    const html = `<div id="ai-review" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center"
      onclick="if(event.target===this)this.remove()">
      <div style="background:#151a2e;border:2px solid #fbbf24;border-radius:16px;padding:24px;
        max-width:420px;width:95%;color:#e0e0e0;max-height:85vh;overflow-y:auto" onclick="event.stopPropagation()">
        <h2 style="text-align:center;color:#fbbf24;margin-bottom:4px">🔄 对局复盘</h2>
        <div style="text-align:center;margin-bottom:16px">
          <span style="font-size:24px;font-weight:bold;color:${this.getQuality(avgScore).color}">${avgScore}分</span>
          <span style="color:#888;font-size:12px"> · ${data.length}步决策</span>
        </div>
        <div style="max-height:50vh;overflow-y:auto;padding-right:4px">${stepsHtml}</div>
        <button onclick="document.getElementById('ai-review').remove()"
          style="display:block;width:100%;margin-top:16px;padding:12px;background:#fbbf24;color:#000;
          border:none;border-radius:10px;font-weight:bold;cursor:pointer;font-size:14px">关闭复盘</button>
      </div>
    </div>`;

    const tc = document.getElementById('training-center');
    if (tc) tc.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  },

  // 显示测评入口（20题定级）
  showAssessmentIntro() {
    const rank = this.getRank(this.rating.score);
    const html = `<div id="training-center" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;overflow-y:auto"
      onclick="if(event.target===this)this.remove()">
      <div style="background:linear-gradient(135deg,#1b2838,#1e3148);border:2px solid #58cc02;
        border-radius:24px;padding:40px;max-width:700px;width:95%;color:#e0e0e0;
        font-family:'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif" onclick="event.stopPropagation()">
        <h2 style="text-align:center;color:#58cc02;margin-bottom:8px;font-size:32px">🎓 AI 掼蛋大师</h2>
        <div style="text-align:center;color:#a0b0c0;font-size:16px;margin-bottom:28px">以AI之智 · 行大师之道</div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px">
          <div style="background:#0f1923;padding:16px 10px;border-radius:14px;text-align:center;
            cursor:pointer;border:2px solid rgba(88,204,2,0.3);transition:all 0.2s"
            onclick="document.getElementById('training-center').remove();if(typeof AIQuiz!=='undefined')AIQuiz.startQuiz();else AITraining._toast('题库加载中...');">
            <div style="font-size:40px;margin-bottom:10px">📋</div>
            <div style="font-size:18px;color:#58cc02;font-weight:bold">段位测评</div>
            <div style="font-size:13px;color:#a0b0c0;margin-top:6px">20题定级<br>6维度评分</div>
          </div>
          <div style="background:#0f1923;padding:16px 10px;border-radius:14px;text-align:center;
            cursor:pointer;border:2px solid rgba(251,191,36,0.3);transition:all 0.2s"
            onclick="document.getElementById('training-center').remove();if(typeof AICourses!=='undefined')AICourses.showCourseList();else AITraining._toast('课程加载中...');">
            <div style="font-size:40px;margin-bottom:10px">📚</div>
            <div style="font-size:18px;color:#fbbf24;font-weight:bold">课程学习</div>
            <div style="font-size:13px;color:#a0b0c0;margin-top:6px">6大维度<br>60节课程</div>
          </div>
          <div style="background:#0f1923;padding:16px 10px;border-radius:14px;text-align:center;
            ${this.rating.gamesPlayed > 0 ? 'cursor:pointer;border:2px solid rgba(167,139,250,0.3)' : 'cursor:not-allowed;border:2px solid #1e3148;opacity:0.4'};transition:all 0.2s"
            onclick="${this.rating.gamesPlayed > 0 ? "document.getElementById('training-center').remove();AITraining.showReview();" : "AITraining._toast('请先完成段位测评')"}">
            <div style="font-size:40px;margin-bottom:10px">🔄</div>
            <div style="font-size:18px;color:${this.rating.gamesPlayed > 0 ? '#a78bfa' : '#555'};font-weight:bold">对局复盘</div>
            <div style="font-size:13px;color:#a0b0c0;margin-top:6px">${this.rating.gamesPlayed > 0 ? 'AI分析<br>标记失误' : '请先完成<br>段位测评'}</div>
          </div>
        </div>

        <div style="background:#0f1923;padding:16px;border-radius:14px;margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span style="font-size:36px">${rank.icon}</span>
            <div>
              <div style="font-size:20px;font-weight:bold;color:${rank.color}">${rank.name}</div>
              <div style="font-size:14px;color:#a0b0c0">综合评分 ${this.rating.score} · ${this.rating.gamesPlayed}局</div>
            </div>
          </div>
          <div style="font-size:11px;color:#a0b0c0;line-height:1.6">
            <strong style="color:#58cc02">六维评估体系：</strong>组牌分解 · 大牌控制 · 出牌时机 · 队友配合 · 炸弹使用 · 终局处理
          </div>
        </div>

        <button onclick="document.getElementById('training-center').remove()"
          style="display:block;width:100%;padding:14px;background:#1e3148;color:#a0b0c0;
          border:1px solid #2a4a6b;border-radius:12px;cursor:pointer;font-size:13px">返回</button>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  // 训练中心主面板（保留兼容）
  showTrainingCenter() {
    const rank = this.getRank(this.rating.score);
    const nextRank = this.getNextRank(this.rating.score);
    const recent = this.history.slice(-20);
    const avgScore = recent.length > 0 ? Math.round(recent.reduce((a, r) => a + r.avgScore, 0) / recent.length) : 0;
    const winRate = recent.length > 0 ? Math.round(recent.filter(r => r.win).length / recent.length * 100) : 0;

    let trendHtml = '';
    recent.forEach(r => {
      const c = this.getQuality(r.avgScore).color;
      const h = Math.max(10, r.avgScore / 100 * 60);
      trendHtml += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="font-size:7px;color:${c}">${r.avgScore}</div>
        <div style="width:80%;height:${h}px;background:${c};border-radius:2px"></div>
        <div style="font-size:7px;color:${r.win?'#4ade80':'#f87171'}">${r.win?'胜':'负'}</div>
      </div>`;
    });

    const modes = [
      { id: 'assess', icon: '📊', name: '智能测评', desc: '每步AI打分', color: '#4ade80',
        action: "AITraining.setMode('assess');document.getElementById('training-center').remove();if(typeof selectMode==='function')selectMode('arena');" },
      { id: 'review', icon: '🔄', name: '对局复盘', desc: '回顾关键决策', color: '#fbbf24',
        action: "document.getElementById('training-center').remove();AITraining.showReview();" },
      { id: 'live', icon: '🎯', name: '实时教练', desc: '出牌时AI提示', color: '#a78bfa',
        action: "AITraining.setMode('live');document.getElementById('training-center').remove();if(typeof selectMode==='function')selectMode('arena');" },
    ];

    let modesHtml = '';
    modes.forEach(m => {
      const active = this.mode === m.id;
      const onclick = m.action;
      modesHtml += `<div style="background:${active?m.color+'22':'#0a0e1a'};padding:14px;border-radius:12px;
        text-align:center;cursor:pointer;border:2px solid ${active?m.color:'#1e2642'};transition:all 0.2s"
        onclick="${onclick}" onmouseenter="this.style.borderColor='${m.color}'" onmouseleave="this.style.borderColor='${active?m.color:'#1e2642'}'">
        <div style="font-size:24px;margin-bottom:4px">${m.icon}</div>
        <div style="font-size:13px;color:${m.color};font-weight:bold">${m.name}</div>
        <div style="font-size:10px;color:#888;margin-top:2px">${m.desc}</div>
      </div>`;
    });

    const html = `<div id="training-center" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;overflow-y:auto"
      onclick="if(event.target===this)this.remove()">
      <div style="background:linear-gradient(135deg,#0f1628,#151a2e);border:2px solid ${rank.color};
        border-radius:20px;padding:28px;max-width:440px;width:95%;color:#e0e0e0;
        font-family:'Segoe UI',sans-serif;max-height:90vh;overflow-y:auto" onclick="event.stopPropagation()">

        <h2 style="text-align:center;margin-bottom:16px">
          <span style="color:#fff;font-size:18px">🎓 AI 掼蛋大师</span>
        </h2>

        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:36px">${rank.icon}</div>
          <div style="font-size:18px;font-weight:bold;color:${rank.color}">${rank.name}</div>
          <div style="font-size:28px;font-weight:900;color:#fff">${this.rating.score}</div>
          <div style="color:#888;font-size:12px">${this.rating.gamesPlayed}局测评 · 平均${avgScore}分 · 胜率${winRate}%</div>
          ${nextRank ? `<div style="margin:10px auto;max-width:200px">
            <div style="position:relative;height:6px;background:#1e2642;border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${Math.round((this.rating.score-rank.min)/(nextRank.min-rank.min)*100)}%;
                background:linear-gradient(90deg,${rank.color},${nextRank.color});border-radius:3px"></div>
            </div>
            <div style="font-size:10px;color:#888;margin-top:4px">距${nextRank.icon}${nextRank.name}还差${nextRank.min-this.rating.score}分</div>
          </div>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px">${modesHtml}</div>

        ${recent.length > 0 ? `<div style="background:#0a0e1a;padding:12px;border-radius:12px;margin-bottom:16px">
          <div style="color:#666;font-size:11px;margin-bottom:6px">最近${recent.length}局表现</div>
          <div style="display:flex;align-items:flex-end;height:80px;gap:1px">${trendHtml}</div>
        </div>` : `<div style="text-align:center;color:#555;padding:20px;font-size:13px">
          开始你的第一局测评吧！</div>`}

        <div style="display:flex;gap:8px">
          <button onclick="AITraining.setMode('off');document.getElementById('training-center').remove()"
            style="flex:1;padding:10px;background:#1e2642;color:#888;border:1px solid #333;border-radius:10px;cursor:pointer;font-size:13px">
            关闭训练</button>
          <button onclick="document.getElementById('training-center').remove();if(AITraining.mode==='off')AITraining.setMode('assess');if(typeof selectMode==='function')selectMode('arena');"
            style="flex:1;padding:10px;background:${rank.color};color:#000;border:none;border-radius:10px;
            font-weight:bold;cursor:pointer;font-size:13px">开始挑战</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  setMode(mode) {
    this.mode = mode;
    this.enabled = mode !== 'off';
    const btn = document.getElementById('training-mode-btn');
    if (btn) {
      const labels = { off:'🎓 训练', assess:'📊 测评中', live:'🎯 教练中', review:'🔄 复盘' };
      const colors = { off:'rgba(34,197,94,0.15)', assess:'rgba(34,197,94,0.4)', live:'rgba(167,139,250,0.4)', review:'rgba(251,191,36,0.4)' };
      btn.innerHTML = labels[mode] || labels.off;
      btn.style.background = colors[mode] || colors.off;
      btn.style.color = mode === 'off' ? '#4ade80' : '#fff';
    }
    if (mode !== 'off') this._toast(mode === 'assess' ? '智能测评已开启' : mode === 'live' ? 'AI教练已开启' : '');
  },

  getReviewData() {
    return { decisions: this.currentGame.decisions };
  },

  _toast(msg) {
    if (msg && typeof toast === 'function') toast(msg);
  },
};

if (typeof window !== 'undefined') {
  window.AITraining = AITraining;
  document.addEventListener('DOMContentLoaded', () => AITraining.init());
}
