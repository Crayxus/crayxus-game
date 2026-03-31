/**
 * 蛋力 Token 系统
 *
 * 获得蛋力: 每日登录+10, 完成课程+5~15, 段位测评+20, 赢大乱斗+8
 * 消耗蛋力: 解锁进阶课程-30, 报名锦标赛-50, AI教练模式-20
 * 新用户赠送: 100 蛋力
 */

const EggToken = {
  balance: 0,
  lastLogin: null,
  history: [],  // [{type, amount, desc, ts}]

  // 蛋力价格表
  PRICES: {
    course_unlock: 30,    // 解锁进阶课程
    tournament_entry: 50, // 报名锦标赛
    ai_coach: 20,         // AI教练模式
  },

  // 蛋力奖励表
  REWARDS: {
    daily_login: 10,
    course_1star: 5,
    course_2star: 10,
    course_3star: 15,
    assessment: 20,
    win_game: 8,
    lose_game: 3,
    first_login: 100,     // 新用户注册奖励
  },

  init() {
    try {
      const saved = localStorage.getItem('crayxus_egg_token');
      if (saved) {
        const data = JSON.parse(saved);
        this.balance = data.balance || 0;
        this.lastLogin = data.lastLogin || null;
        this.history = data.history || [];
      } else {
        // 新用户
        this.balance = this.REWARDS.first_login;
        this.history.push({
          type: 'reward', amount: this.REWARDS.first_login,
          desc: '🎁 新用户注册奖励', ts: Date.now()
        });
        this.save();
      }
    } catch(e) {}

    // 每日登录奖励
    this._checkDailyLogin();
    this._updateUI();
  },

  save() {
    try {
      localStorage.setItem('crayxus_egg_token', JSON.stringify({
        balance: this.balance,
        lastLogin: this.lastLogin,
        history: this.history.slice(-100),
      }));
    } catch(e) {}
  },

  // 获得蛋力
  earn(amount, desc) {
    this.balance += amount;
    this.history.push({ type: 'earn', amount, desc, ts: Date.now() });
    this.save();
    this._updateUI();
    this._showFloat('+' + amount, '#58cc02');
  },

  // 消耗蛋力
  spend(amount, desc) {
    if (this.balance < amount) {
      this._showInsufficent(amount);
      return false;
    }
    this.balance -= amount;
    this.history.push({ type: 'spend', amount: -amount, desc, ts: Date.now() });
    this.save();
    this._updateUI();
    this._showFloat('-' + amount, '#ff4b4b');
    return true;
  },

  // 检查余额是否足够
  canAfford(amount) {
    return this.balance >= amount;
  },

  // 每日登录奖励
  _checkDailyLogin() {
    const today = new Date().toDateString();
    if (this.lastLogin !== today) {
      this.lastLogin = today;
      this.earn(this.REWARDS.daily_login, '📅 每日登录奖励');
    }
  },

  // 课程完成奖励
  onCourseComplete(stars) {
    const rewards = [0, this.REWARDS.course_1star, this.REWARDS.course_2star, this.REWARDS.course_3star];
    const amount = rewards[Math.min(stars, 3)];
    if (amount > 0) {
      this.earn(amount, `📚 完成课程 (${stars}⭐)`);
    }
  },

  // 测评完成奖励
  onAssessmentComplete() {
    this.earn(this.REWARDS.assessment, '📋 完成段位测评');
  },

  // 赢/输大乱斗
  onGameResult(win) {
    const amount = win ? this.REWARDS.win_game : this.REWARDS.lose_game;
    this.earn(amount, win ? '🏆 大乱斗胜利' : '💪 大乱斗参与');
  },

  // ===== UI =====

  _updateUI() {
    const el = document.getElementById('egg-token-display');
    if (el) {
      el.innerHTML = `🥚 ${this.balance}`;
    }
  },

  _showFloat(text, color) {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:60px;right:80px;z-index:9999;
      font-size:24px;font-weight:bold;color:${color};
      pointer-events:none;animation:eggFloat 1.5s ease-out forwards;`;
    el.textContent = text + ' 🥚';
    document.body.appendChild(el);
    if (!document.getElementById('egg-float-style')) {
      const s = document.createElement('style');
      s.id = 'egg-float-style';
      s.textContent = '@keyframes eggFloat{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-40px)}}';
      document.head.appendChild(s);
    }
    setTimeout(() => el.remove(), 1500);
  },

  _showInsufficent(needed) {
    const html = `<div id="egg-insufficient" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center"
      onclick="this.remove()">
      <div style="background:#1b2838;border:2px solid #ff4b4b;border-radius:20px;padding:32px;
        max-width:360px;width:90%;text-align:center" onclick="event.stopPropagation()">
        <div style="font-size:48px;margin-bottom:12px">🥚</div>
        <div style="font-size:20px;font-weight:bold;color:#ff4b4b;margin-bottom:8px">蛋力不足</div>
        <div style="color:#a0b0c0;font-size:14px;margin-bottom:16px">
          需要 <strong style="color:#ffc800">${needed}</strong> 蛋力，当前余额 <strong style="color:#58cc02">${this.balance}</strong>
        </div>
        <div style="color:#8899aa;font-size:12px;margin-bottom:20px">
          完成课程、段位测评、大乱斗可获得蛋力
        </div>
        <button onclick="document.getElementById('egg-insufficient').remove()"
          style="padding:12px 32px;background:#ff4b4b;color:#fff;border:none;border-radius:12px;
          font-weight:bold;font-size:14px;cursor:pointer">知道了</button>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  // 蛋力钱包面板
  showWallet() {
    const recent = this.history.slice(-20).reverse();
    let historyHtml = '';
    recent.forEach(h => {
      const color = h.amount > 0 ? '#58cc02' : '#ff4b4b';
      const sign = h.amount > 0 ? '+' : '';
      const date = new Date(h.ts);
      const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}`;
      historyHtml += `<div style="display:flex;justify-content:space-between;align-items:center;
        padding:8px 0;border-bottom:1px solid #1e314833">
        <div>
          <div style="font-size:13px;color:#e0e0e0">${h.desc}</div>
          <div style="font-size:10px;color:#8899aa">${dateStr}</div>
        </div>
        <div style="font-size:16px;font-weight:bold;color:${color}">${sign}${h.amount}</div>
      </div>`;
    });

    const html = `<div id="egg-wallet" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center"
      onclick="if(event.target===this)this.remove()">
      <div style="background:#1b2838;border:2px solid #ffc800;border-radius:20px;padding:32px;
        max-width:420px;width:95%;max-height:80vh;overflow-y:auto" onclick="event.stopPropagation()">
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:48px">🥚</div>
          <div style="font-size:14px;color:#a0b0c0;margin-bottom:4px">蛋力余额</div>
          <div style="font-size:42px;font-weight:900;color:#ffc800">${this.balance}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px">
          <div style="background:#0f1923;padding:12px;border-radius:12px;text-align:center">
            <div style="font-size:11px;color:#8899aa">获得方式</div>
            <div style="font-size:12px;color:#58cc02;margin-top:4px;line-height:1.8">
              每日登录 +${this.REWARDS.daily_login}<br>
              完成课程 +${this.REWARDS.course_1star}~${this.REWARDS.course_3star}<br>
              段位测评 +${this.REWARDS.assessment}<br>
              赢大乱斗 +${this.REWARDS.win_game}
            </div>
          </div>
          <div style="background:#0f1923;padding:12px;border-radius:12px;text-align:center">
            <div style="font-size:11px;color:#8899aa">消费场景</div>
            <div style="font-size:12px;color:#ff4b4b;margin-top:4px;line-height:1.8">
              进阶课程 -${this.PRICES.course_unlock}<br>
              报名锦标赛 -${this.PRICES.tournament_entry}<br>
              AI教练 -${this.PRICES.ai_coach}<br>
              &nbsp;
            </div>
          </div>
        </div>

        ${recent.length > 0 ? `
        <div style="background:#0f1923;padding:12px;border-radius:12px;margin-bottom:16px">
          <div style="font-size:11px;color:#8899aa;margin-bottom:8px">最近记录</div>
          ${historyHtml}
        </div>` : ''}

        <button onclick="document.getElementById('egg-wallet').remove()"
          style="display:block;width:100%;padding:14px;background:#ffc800;color:#1b2838;
          border:none;border-radius:12px;font-weight:bold;font-size:15px;cursor:pointer">关闭</button>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },
};

if (typeof window !== 'undefined') {
  window.EggToken = EggToken;
  document.addEventListener('DOMContentLoaded', () => EggToken.init());
}
