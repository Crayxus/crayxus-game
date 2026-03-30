/**
 * AI Training Module — 测评 + 复盘 + 实时训练
 *
 * 三个核心功能：
 * 1. 测评 (Assessment): 每步出牌 AI 打分，局后给等级
 * 2. 复盘 (Review): 回放每步决策，标记失误和最优解
 * 3. 实时训练 (Live Training): 出牌时显示 AI 建议
 *
 * 依赖: onnxSession, encodeStateV5, runModelBatch, analyzeHand 等
 */

// ===== 全局状态 =====
const AITraining = {
  enabled: false,
  mode: 'off',  // 'off' | 'assess' | 'review' | 'live'

  // 当前局的决策记录
  currentGame: {
    decisions: [],   // [{step, seat, hand, selected, aiTop3, qValues, score, mBefore, mAfter}]
    startTime: null,
    gameId: 0,
  },

  // 历史数据
  history: [],      // 最近 50 局的评测结果

  // 等级系统
  rating: {
    score: 1200,     // 综合评分 (非 ELO)
    level: '银牌一星',
    gamesPlayed: 0,
    avgScore: 0,
  },

  // 初始化
  init() {
    // 从 localStorage 恢复
    try {
      const saved = localStorage.getItem('crayxus_ai_training');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.rating) this.rating = data.rating;
        if (data.history) this.history = data.history.slice(-50);
      }
    } catch(e) {}
    this.updateBadge();
  },

  // 保存到 localStorage
  save() {
    try {
      localStorage.setItem('crayxus_ai_training', JSON.stringify({
        rating: this.rating,
        history: this.history.slice(-50),
      }));
    } catch(e) {}
  },

  // ===== 1. 测评模块 =====

  // 开始新一局测评
  startGame() {
    this.currentGame = {
      decisions: [],
      startTime: Date.now(),
      gameId: (this.currentGame.gameId || 0) + 1,
    };
  },

  // 记录一步决策并打分
  async recordDecision(seat, hand, selectedCards, legalMoves, qValues, isPass) {
    if (!this.enabled) return;

    const n = legalMoves.length;
    if (n <= 1) return;  // 无选择不计分

    // 找到选中牌的 Q 值排名
    let selectedIdx = -1;
    const selectedVec = typeof cardsToVec54 === 'function' ? cardsToVec54(selectedCards) : null;

    if (selectedVec && qValues) {
      // 找匹配
      for (let i = 0; i < n; i++) {
        const mv = legalMoves[i];
        if (isPass && mv.length === 0) { selectedIdx = i; break; }
        if (!isPass && mv.length === selectedCards.length) {
          let match = true;
          for (let j = 0; j < mv.length; j++) {
            if (mv[j] !== selectedCards[j]) { match = false; break; }
          }
          if (match) { selectedIdx = i; break; }
        }
      }
    }

    // 计算分数
    let score = 50;  // 默认
    if (qValues && qValues.length > 0 && selectedIdx >= 0) {
      // 排名
      const sorted = [...qValues].sort((a, b) => b - a);
      const selectedQ = qValues[selectedIdx];
      const bestQ = sorted[0];
      const rank = sorted.indexOf(selectedQ);

      // 分数 = 基于排名百分位
      if (rank === 0) score = 100;        // 最优选择
      else if (rank === 1) score = 85;    // 第二好
      else if (rank === 2) score = 70;    // 第三
      else if (rank < n * 0.3) score = 55;
      else if (rank < n * 0.6) score = 40;
      else score = 20;                    // 差选择

      // Q 值差距 bonus/penalty
      const qGap = bestQ - selectedQ;
      if (qGap < 0.01) score = Math.min(100, score + 10);  // 几乎最优
      else if (qGap > 0.2) score = Math.max(10, score - 15); // 明显差
    }

    // M 值变化 bonus
    // (需要外部传入，这里预留)

    this.currentGame.decisions.push({
      step: this.currentGame.decisions.length,
      seat, score, isPass,
      selectedIdx,
      bestIdx: qValues ? qValues.indexOf(Math.max(...qValues)) : 0,
      qGap: qValues ? (Math.max(...qValues) - (qValues[selectedIdx] || 0)) : 0,
      nOptions: n,
      ts: Date.now(),
    });

    // 实时训练模式：显示分数浮标
    if (this.mode === 'live' || this.mode === 'assess') {
      this._showScoreFloat(score);
    }
  },

  // 局结束，生成评测报告
  endGame(win, finishOrder, mySeat) {
    if (!this.enabled || this.currentGame.decisions.length === 0) return;

    const decisions = this.currentGame.decisions;
    const scores = decisions.map(d => d.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const perfectMoves = scores.filter(s => s >= 95).length;
    const mistakes = scores.filter(s => s <= 30).length;
    const bigMistakes = decisions.filter(d => d.qGap > 0.15).length;

    const report = {
      gameId: this.currentGame.gameId,
      ts: Date.now(),
      win,
      avgScore: Math.round(avgScore),
      totalDecisions: decisions.length,
      perfectMoves,
      mistakes,
      bigMistakes,
      scores,
    };

    // 更新等级
    this.history.push(report);
    if (this.history.length > 50) this.history = this.history.slice(-50);

    this.rating.gamesPlayed++;
    this.rating.avgScore = Math.round(
      this.history.reduce((a, r) => a + r.avgScore, 0) / this.history.length
    );
    this.rating.score = this._calculateRating();
    this.rating.level = this._scoreToLevel(this.rating.score);

    this.save();
    this.updateBadge();

    // 显示评测面板
    if (this.mode === 'assess' || this.mode === 'live') {
      this._showAssessment(report);
    }

    return report;
  },

  // ===== 2. 复盘模块 =====

  getReviewData() {
    // 返回当前局的所有决策用于复盘
    return {
      decisions: this.currentGame.decisions,
      summary: {
        total: this.currentGame.decisions.length,
        avgScore: this.currentGame.decisions.length > 0 ?
          Math.round(this.currentGame.decisions.reduce((a, d) => a + d.score, 0) / this.currentGame.decisions.length) : 0,
        perfect: this.currentGame.decisions.filter(d => d.score >= 95).length,
        mistakes: this.currentGame.decisions.filter(d => d.score <= 30).length,
      }
    };
  },

  // ===== 3. 等级计算 =====

  _calculateRating() {
    if (this.history.length === 0) return 1200;
    const recent = this.history.slice(-20);
    const avgScore = recent.reduce((a, r) => a + r.avgScore, 0) / recent.length;
    const winRate = recent.filter(r => r.win).length / recent.length;

    // 综合评分 = 决策质量 70% + 胜率 30%
    return Math.round(avgScore * 20 * 0.7 + winRate * 2000 * 0.3 + 200);
  },

  _scoreToLevel(score) {
    if (score >= 2000) return '👑 大师';
    if (score >= 1800) return '💎 钻石三星';
    if (score >= 1700) return '💎 钻石二星';
    if (score >= 1600) return '💎 钻石一星';
    if (score >= 1500) return '🥇 金牌三星';
    if (score >= 1400) return '🥇 金牌二星';
    if (score >= 1300) return '🥇 金牌一星';
    if (score >= 1200) return '🥈 银牌三星';
    if (score >= 1100) return '🥈 银牌二星';
    if (score >= 1000) return '🥈 银牌一星';
    if (score >= 900) return '🥉 铜牌三星';
    if (score >= 800) return '🥉 铜牌二星';
    return '🥉 铜牌一星';
  },

  // ===== UI 组件 =====

  updateBadge() {
    const el = document.getElementById('ai-training-badge');
    if (el) {
      el.innerHTML = `${this.rating.level} <span style="font-size:10px;color:#888">${this.rating.score}</span>`;
    }
  },

  _showScoreFloat(score) {
    const color = score >= 90 ? '#4ade80' : score >= 60 ? '#fbbf24' : '#f87171';
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:45%;left:50%;transform:translate(-50%,-50%);
      z-index:9999;font-size:32px;font-weight:bold;color:${color};
      text-shadow:0 0 10px ${color}55;pointer-events:none;
      animation:scoreFloat 1.5s ease-out forwards;`;
    el.textContent = score >= 90 ? `${score} ✨` : score >= 60 ? `${score}` : `${score} ⚠`;
    document.body.appendChild(el);

    // Add animation
    if (!document.getElementById('score-float-style')) {
      const style = document.createElement('style');
      style.id = 'score-float-style';
      style.textContent = `@keyframes scoreFloat{0%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}50%{opacity:0.8}100%{opacity:0;transform:translate(-50%,-120%) scale(0.8)}}`;
      document.head.appendChild(style);
    }
    setTimeout(() => el.remove(), 1500);
  },

  _showAssessment(report) {
    const color = report.avgScore >= 80 ? '#4ade80' : report.avgScore >= 60 ? '#fbbf24' : '#f87171';

    // Score distribution bar
    let barHtml = '';
    report.scores.forEach((s, i) => {
      const c = s >= 90 ? '#4ade80' : s >= 60 ? '#fbbf24' : '#f87171';
      const h = Math.max(4, s / 100 * 40);
      barHtml += `<div style="width:${100/report.scores.length}%;height:${h}px;background:${c};display:inline-block;border-radius:1px;margin:0 0.5px"></div>`;
    });

    const html = `<div id="ai-assessment" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center"
      onclick="if(event.target===this)this.remove()">
      <div style="background:#151a2e;border:2px solid ${color};border-radius:16px;padding:28px;
        max-width:420px;width:90%;color:#e0e0e0;font-family:'Segoe UI',sans-serif" onclick="event.stopPropagation()">
        <h2 style="text-align:center;color:${color};margin-bottom:16px">
          ${report.win ? '🏆 胜利' : '😤 失败'} · AI 评测报告
        </h2>
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:48px;font-weight:bold;color:${color}">${report.avgScore}</div>
          <div style="color:#888;font-size:13px">决策质量评分</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
          <div style="background:#0d1120;padding:10px;border-radius:8px;text-align:center">
            <div style="color:#4ade80;font-size:20px;font-weight:bold">${report.perfectMoves}</div>
            <div style="color:#888;font-size:11px">最优决策</div>
          </div>
          <div style="background:#0d1120;padding:10px;border-radius:8px;text-align:center">
            <div style="color:#fff;font-size:20px;font-weight:bold">${report.totalDecisions}</div>
            <div style="color:#888;font-size:11px">总决策数</div>
          </div>
          <div style="background:#0d1120;padding:10px;border-radius:8px;text-align:center">
            <div style="color:#f87171;font-size:20px;font-weight:bold">${report.mistakes}</div>
            <div style="color:#888;font-size:11px">失误</div>
          </div>
        </div>
        <div style="background:#0d1120;padding:10px;border-radius:8px;margin-bottom:16px">
          <div style="color:#888;font-size:11px;margin-bottom:6px">每步决策质量</div>
          <div style="display:flex;align-items:flex-end;height:44px">${barHtml}</div>
        </div>
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:14px;color:#888">当前等级</div>
          <div style="font-size:20px;font-weight:bold">${this.rating.level}</div>
          <div style="color:#888;font-size:12px">综合评分 ${this.rating.score} · 已测评 ${this.rating.gamesPlayed} 局</div>
        </div>
        <button onclick="document.getElementById('ai-assessment').remove()"
          style="display:block;margin:0 auto;padding:10px 32px;background:${color};color:#000;
          border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px">关闭</button>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  // 显示完整的训练中心面板
  showTrainingCenter() {
    const recent = this.history.slice(-20);
    const avgScore = recent.length > 0 ? Math.round(recent.reduce((a, r) => a + r.avgScore, 0) / recent.length) : 0;
    const winRate = recent.length > 0 ? Math.round(recent.filter(r => r.win).length / recent.length * 100) : 0;
    const totalGames = this.rating.gamesPlayed;

    // Win/loss streak
    const results = recent.map(r => r.win ? 'W' : 'L').join(' ');

    // Score trend
    let trendHtml = '';
    recent.forEach((r, i) => {
      const c = r.avgScore >= 80 ? '#4ade80' : r.avgScore >= 60 ? '#fbbf24' : '#f87171';
      const h = Math.max(8, r.avgScore / 100 * 60);
      trendHtml += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="font-size:8px;color:${c}">${r.avgScore}</div>
        <div style="width:80%;height:${h}px;background:${c};border-radius:2px"></div>
        <div style="font-size:8px;color:#555">${r.win?'W':'L'}</div>
      </div>`;
    });

    const html = `<div id="training-center" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;overflow-y:auto"
      onclick="if(event.target===this)this.remove()">
      <div style="background:#151a2e;border:2px solid #22c55e;border-radius:16px;padding:28px;
        max-width:500px;width:95%;color:#e0e0e0;font-family:'Segoe UI',sans-serif;max-height:90vh;overflow-y:auto"
        onclick="event.stopPropagation()">
        <h2 style="text-align:center;color:#22c55e;margin-bottom:20px">🎓 AI Training Center</h2>

        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:24px;font-weight:bold">${this.rating.level}</div>
          <div style="font-size:36px;font-weight:bold;color:#22c55e">${this.rating.score}</div>
          <div style="color:#888;font-size:12px">${totalGames} 局测评 · 平均 ${avgScore} 分 · 胜率 ${winRate}%</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
          <div style="background:#0d1120;padding:12px;border-radius:8px;text-align:center;cursor:pointer;border:1px solid ${this.mode==='assess'?'#22c55e':'#1e2642'}"
            onclick="AITraining.setMode('assess');document.getElementById('training-center').remove()">
            <div style="font-size:20px">📊</div>
            <div style="font-size:12px;color:#22c55e;font-weight:bold">测评</div>
            <div style="font-size:10px;color:#888">每步打分</div>
          </div>
          <div style="background:#0d1120;padding:12px;border-radius:8px;text-align:center;cursor:pointer;border:1px solid ${this.mode==='review'?'#22c55e':'#1e2642'}"
            onclick="AITraining.showReview()">
            <div style="font-size:20px">🔄</div>
            <div style="font-size:12px;color:#fbbf24;font-weight:bold">复盘</div>
            <div style="font-size:10px;color:#888">回顾决策</div>
          </div>
          <div style="background:#0d1120;padding:12px;border-radius:8px;text-align:center;cursor:pointer;border:1px solid ${this.mode==='live'?'#22c55e':'#1e2642'}"
            onclick="AITraining.setMode('live');document.getElementById('training-center').remove()">
            <div style="font-size:20px">🎯</div>
            <div style="font-size:12px;color:#a78bfa;font-weight:bold">实时训练</div>
            <div style="font-size:10px;color:#888">AI 教练</div>
          </div>
        </div>

        ${recent.length > 0 ? `
        <div style="background:#0d1120;padding:12px;border-radius:8px;margin-bottom:16px">
          <div style="color:#888;font-size:11px;margin-bottom:8px">最近 ${recent.length} 局决策趋势</div>
          <div style="display:flex;align-items:flex-end;height:80px;gap:1px">${trendHtml}</div>
        </div>` : ''}

        <div style="display:flex;gap:8px">
          <button onclick="AITraining.setMode('off');document.getElementById('training-center').remove()"
            style="flex:1;padding:10px;background:#1e2642;color:#888;border:1px solid #333;border-radius:8px;cursor:pointer">关闭训练</button>
          <button onclick="document.getElementById('training-center').remove()"
            style="flex:1;padding:10px;background:#22c55e;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer">继续</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  // 复盘面板
  showReview() {
    const data = this.getReviewData();
    if (data.decisions.length === 0) {
      alert('没有当前对局数据，先打一局再复盘！');
      return;
    }

    let stepsHtml = '';
    data.decisions.forEach((d, i) => {
      const c = d.score >= 90 ? '#4ade80' : d.score >= 60 ? '#fbbf24' : '#f87171';
      const icon = d.score >= 90 ? '✅' : d.score >= 60 ? '🟡' : '❌';
      const action = d.isPass ? 'PASS' : '出牌';
      const optimal = d.selectedIdx === d.bestIdx ? '最优' : `第${d.selectedIdx+1}选择(共${d.nOptions}个)`;
      stepsHtml += `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1e264233">
        <span style="color:#555;font-size:11px;min-width:30px">#${i+1}</span>
        <span style="font-size:14px">${icon}</span>
        <span style="flex:1;font-size:12px;color:#ccc">${action} · ${optimal}</span>
        <span style="color:${c};font-weight:bold;font-size:14px">${d.score}</span>
      </div>`;
    });

    const html = `<div id="ai-review" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center"
      onclick="if(event.target===this)this.remove()">
      <div style="background:#151a2e;border:2px solid #fbbf24;border-radius:16px;padding:24px;
        max-width:450px;width:95%;color:#e0e0e0;max-height:80vh;overflow-y:auto" onclick="event.stopPropagation()">
        <h2 style="text-align:center;color:#fbbf24;margin-bottom:16px">🔄 对局复盘</h2>
        <div style="text-align:center;margin-bottom:16px">
          <span style="font-size:28px;font-weight:bold;color:${data.summary.avgScore>=70?'#4ade80':'#fbbf24'}">${data.summary.avgScore}</span>
          <span style="color:#888;font-size:13px"> 平均分</span>
          <div style="color:#888;font-size:12px">${data.summary.total} 步 · ${data.summary.perfect} 最优 · ${data.summary.mistakes} 失误</div>
        </div>
        <div style="max-height:400px;overflow-y:auto">${stepsHtml}</div>
        <button onclick="document.getElementById('ai-review').remove()"
          style="display:block;margin:16px auto 0;padding:10px 32px;background:#fbbf24;color:#000;
          border:none;border-radius:8px;font-weight:bold;cursor:pointer">关闭</button>
      </div>
    </div>`;

    // Remove training center if open
    const tc = document.getElementById('training-center');
    if (tc) tc.remove();

    document.body.insertAdjacentHTML('beforeend', html);
  },

  // 设置模式
  setMode(mode) {
    this.mode = mode;
    this.enabled = mode !== 'off';
    const btn = document.getElementById('training-mode-btn');
    if (btn) {
      if (mode === 'off') {
        btn.style.background = 'rgba(34,197,94,0.15)';
        btn.style.color = '#4ade80';
        btn.innerHTML = '🎓 训练';
      } else if (mode === 'assess') {
        btn.style.background = 'rgba(34,197,94,0.4)';
        btn.style.color = '#fff';
        btn.innerHTML = '📊 测评中';
      } else if (mode === 'live') {
        btn.style.background = 'rgba(167,139,250,0.4)';
        btn.style.color = '#fff';
        btn.innerHTML = '🎯 训练中';
      }
    }
    if (mode !== 'off') {
      this._toast(`AI Training: ${mode === 'assess' ? '测评模式' : mode === 'live' ? '实时训练模式' : '复盘模式'} 已开启`);
    }
  },

  _toast(msg) {
    if (typeof toast === 'function') toast(msg);
    else console.log('[AITraining]', msg);
  },
};

// Auto-init
if (typeof window !== 'undefined') {
  window.AITraining = AITraining;
  document.addEventListener('DOMContentLoaded', () => AITraining.init());
}
