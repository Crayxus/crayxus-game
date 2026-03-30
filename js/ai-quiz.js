/**
 * AI 掼蛋大师 · 段位测评题库系统
 * 题目由 V7 92.6% 大模型自动生成，答案基于 Q 值排名
 */

const AIQuiz = {
  questions: [],
  currentQ: 0,
  answers: [],
  dimensions: ['组牌分解', '大牌控制', '出牌时机', '队友配合', '炸弹使用', '终局处理'],
  dimScores: {},
  loaded: false,

  SUIT_SYMBOLS: { S: '♠', H: '♥', C: '♣', D: '♦', JK: '★' },
  SUIT_CLASS: { S: 'suit-s', H: 'suit-h', C: 'suit-c', D: 'suit-d', JK: 'suit-jk' },
  VAL_NAMES: {3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A',15:'2',16:'小王',17:'大王'},

  // 大卡片（手牌展示）
  cardHtml(card) {
    const sc = this.SUIT_CLASS[card.s] || 'suit-s';
    const sym = this.SUIT_SYMBOLS[card.s] || '';
    const val = this.VAL_NAMES[card.v] || card.v;
    if (card.v >= 16) return `<div class="quiz-card ${sc}"><span class="qc-val">${val}</span></div>`;
    return `<div class="quiz-card ${sc}"><span class="qc-val">${val}</span><span class="qc-suit">${sym}</span></div>`;
  },

  // 小卡片（选项中的出牌）
  cardHtmlSm(card) {
    const sc = this.SUIT_CLASS[card.s] || 'suit-s';
    const sym = this.SUIT_SYMBOLS[card.s] || '';
    const val = this.VAL_NAMES[card.v] || card.v;
    if (card.v >= 16) return `<div class="quiz-card-sm ${sc}"><span class="qc-val">${val}</span></div>`;
    return `<div class="quiz-card-sm ${sc}"><span class="qc-val">${val}</span><span class="qc-suit">${sym}</span></div>`;
  },

  // 解析选项文字中的牌，提取卡片
  parseOptionCards(text) {
    // text format: "顺子: ♥6 ♣7 ♠8 ♥9 ♥10" or "PASS"
    if (text === 'PASS') return { label: 'PASS', cards: [] };
    const colonIdx = text.indexOf(':');
    const label = colonIdx >= 0 ? text.substring(0, colonIdx).trim() : '';
    const cardPart = colonIdx >= 0 ? text.substring(colonIdx + 1).trim() : text;

    const suitMap = {'♠':'S','♥':'H','♣':'C','♦':'D'};
    const valMap = {'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15};

    const cards = [];
    const regex = /([♠♥♣♦])(\d+|[JQKA])|小王|大王/g;
    let m;
    while ((m = regex.exec(cardPart)) !== null) {
      if (m[0] === '小王') cards.push({s:'JK',v:16});
      else if (m[0] === '大王') cards.push({s:'JK',v:17});
      else cards.push({s: suitMap[m[1]] || 'S', v: valMap[m[2]] || 0});
    }
    return { label, cards };
  },

  // 手牌分组展示：炸弹 | 三条 | 对子 | 散牌，同组内按大小排列
  _renderGroupedHand(hand) {
    // Count by value
    const counts = {};
    hand.forEach(c => {
      const key = c.v;
      if (!counts[key]) counts[key] = [];
      counts[key].push(c);
    });

    // Group: 4+=炸弹, 3=三条, 2=对子, 1=散牌
    const groups = { bomb: [], triple: [], pair: [], single: [] };
    const jokers = [];

    Object.entries(counts).forEach(([val, cards]) => {
      const v = parseInt(val);
      if (v >= 16) { jokers.push(...cards); return; }
      if (cards.length >= 4) groups.bomb.push({ val: v, cards });
      else if (cards.length === 3) groups.triple.push({ val: v, cards });
      else if (cards.length === 2) groups.pair.push({ val: v, cards });
      else groups.single.push({ val: v, cards });
    });

    // Sort each group by value (high to low)
    const sortGroup = g => g.sort((a, b) => b.val - a.val);
    sortGroup(groups.bomb);
    sortGroup(groups.triple);
    sortGroup(groups.pair);
    sortGroup(groups.single);

    // Arena style: sorted by power (王>2>A>K>...>3), same value stacked vertically
    // Each card in stack visible (offset down, showing suit+value)

    // Sort order: 大王(17) > 小王(16) > 2(15) > A(14) > K(13) > ... > 3(3)
    const allCards = [...jokers];
    [...groups.bomb, ...groups.triple, ...groups.pair, ...groups.single].forEach(g => {
      g.cards.forEach(c => allCards.push(c));
    });
    allCards.sort((a, b) => b.v - a.v);

    // Group by value
    const columns = [];
    let col = [];
    allCards.forEach(c => {
      if (col.length === 0 || col[0].v === c.v) {
        col.push(c);
      } else {
        columns.push([...col]);
        col = [c];
      }
    });
    if (col.length > 0) columns.push(col);

    // Render: each column stacked vertically, offset 18px per card to show suit+val
    const renderCol = (cards) => {
      const h = 58 + (cards.length - 1) * 18;
      let html = `<div style="position:relative;width:42px;height:${h}px">`;
      cards.forEach((c, i) => {
        html += `<div style="position:absolute;top:${i * 18}px;left:0;z-index:${10 + i}">${this.cardHtml(c)}</div>`;
      });
      html += '</div>';
      return html;
    };

    return `<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;align-items:flex-start;
      margin:12px 0;padding:12px 8px;background:#0a1218;border-radius:12px">
      ${columns.map(c => renderCol(c)).join('')}
    </div>`;
  },

  async loadQuestions() {
    try {
      const resp = await fetch('/js/quiz-data.json');
      const data = await resp.json();
      this.questions = data.questions;
      this.loaded = true;
      console.log(`[Quiz] Loaded ${this.questions.length} questions from AI model`);
    } catch(e) {
      console.warn('[Quiz] Failed to load quiz data:', e);
      this.loaded = false;
    }
  },

  async startQuiz() {
    if (!this.loaded) await this.loadQuestions();
    if (!this.questions.length) {
      if (typeof toast === 'function') toast('题库加载失败，请刷新重试');
      return;
    }
    this.currentQ = 0;
    this.answers = [];
    this.dimScores = {};
    this.dimensions.forEach(d => this.dimScores[d] = { total: 0, correct: 0 });
    this._renderQuestion();
  },

  _renderQuestion() {
    const q = this.questions[this.currentQ];
    if (!q) { this._showResults(); return; }

    const progress = Math.round((this.currentQ / this.questions.length) * 100);
    const dimColors = {
      '组牌分解':'#58cc02', '大牌控制':'#ffc800', '出牌时机':'#00bcd4',
      '队友配合':'#e91e63', '炸弹使用':'#ff6b35', '终局处理':'#a78bfa'
    };
    const dimColor = dimColors[q.dim] || '#58cc02';

    // Hand display — grouped by count (like real hand sorting)
    let handHtml = '';
    if (q.hand && q.hand.length > 0) {
      handHtml = this._renderGroupedHand(q.hand);
    }

    // Info line
    let infoHtml = '';
    if (q.counts) {
      infoHtml = `<div style="display:flex;gap:12px;justify-content:center;margin:8px 0;font-size:11px;color:#a0b0c0">
        <span>我方 ${q.counts[0]}张</span>
        <span>对手 ${q.counts[1]}张</span>
        <span>队友 ${q.counts[2]}张</span>
        <span>对手 ${q.counts[3]}张</span>
        ${q.m_value ? `<span style="color:#58cc02">M值=${q.m_value}</span>` : ''}
      </div>`;
    }

    // Shuffle options
    const options = q.options.map((o, i) => ({ ...o, origIdx: i }));
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    let optionsHtml = '';
    options.forEach((o, i) => {
      const letter = ['A', 'B', 'C', 'D'][i];
      const parsed = this.parseOptionCards(o.text);
      const cardsHtml = parsed.cards.length > 0 ?
        `<div style="display:flex;flex-wrap:wrap;gap:1px;margin-top:4px">${parsed.cards.map(c => this.cardHtmlSm(c)).join('')}</div>` :
        '';
      const labelText = parsed.label || o.text;

      optionsHtml += `<div class="quiz-option" data-idx="${o.origIdx}"
        style="background:#0f1923;padding:12px 14px;border-radius:12px;margin:8px 0;
        cursor:pointer;border:2px solid #1e3148;transition:all 0.2s;display:flex;align-items:center;gap:12px"
        onclick="AIQuiz.selectAnswer(${o.origIdx}, this)"
        onmouseenter="this.style.borderColor='${dimColor}'" onmouseleave="this.style.borderColor='#1e3148'">
        <span style="background:#1e3148;color:${dimColor};width:28px;height:28px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;flex-shrink:0">${letter}</span>
        <div>
          <div style="font-size:13px;color:#e0e0e0;font-weight:600">${labelText}</div>
          ${cardsHtml}
        </div>
      </div>`;
    });

    const html = `<div id="quiz-panel" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:#0f1923;display:flex;flex-direction:column;overflow-y:auto">
      <div style="max-width:500px;width:95%;margin:0 auto;padding:20px 0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <span style="color:#a0b0c0;font-size:13px">第 ${this.currentQ + 1} / ${this.questions.length} 题</span>
          <span style="background:${dimColor}22;color:${dimColor};
            padding:4px 12px;border-radius:20px;font-size:11px;font-weight:bold">${q.dim}</span>
        </div>
        <div style="height:6px;background:#1e3148;border-radius:3px;margin-bottom:20px;overflow:hidden">
          <div style="height:100%;width:${progress}%;background:${dimColor};border-radius:3px;transition:width 0.3s"></div>
        </div>
        <div style="background:#1b2838;padding:20px;border-radius:16px;margin-bottom:16px;border:1px solid #2a4a6b">
          <div style="color:#a0b0c0;font-size:12px;margin-bottom:4px">${q.scenario}</div>
          ${handHtml}
          ${infoHtml}
          <div style="color:#fff;font-size:16px;font-weight:bold;margin-top:8px">${q.question}</div>
        </div>
        ${optionsHtml}
      </div>
    </div>`;

    const old = document.getElementById('quiz-panel');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  },

  selectAnswer(origIdx, el) {
    const q = this.questions[this.currentQ];
    const selected = q.options[origIdx];
    const isCorrect = selected.correct === true;
    const correctOption = q.options.find(o => o.correct);

    this.answers.push({ qIndex: this.currentQ, selected: origIdx, correct: isCorrect, dimension: q.dim });
    this.dimScores[q.dim].total++;
    if (isCorrect) this.dimScores[q.dim].correct++;

    // Highlight
    document.querySelectorAll('.quiz-option').forEach(opt => {
      opt.style.pointerEvents = 'none';
      const idx = parseInt(opt.dataset.idx);
      if (q.options[idx].correct) {
        opt.style.borderColor = '#58cc02';
        opt.style.background = 'rgba(88,204,2,0.15)';
      } else if (idx === origIdx && !isCorrect) {
        opt.style.borderColor = '#ff4b4b';
        opt.style.background = 'rgba(255,75,75,0.15)';
      }
    });

    // Explanation
    const panel = document.getElementById('quiz-panel');
    const div = document.createElement('div');
    div.style.cssText = 'max-width:500px;width:95%;margin:16px auto;padding:16px;border-radius:12px;' +
      (isCorrect ? 'background:rgba(88,204,2,0.1);border:1px solid rgba(88,204,2,0.3)' :
                   'background:rgba(255,75,75,0.1);border:1px solid rgba(255,75,75,0.3)');
    div.innerHTML = `
      <div style="font-size:18px;font-weight:bold;margin-bottom:8px;color:${isCorrect?'#58cc02':'#ff4b4b'}">
        ${isCorrect ? '✅ 正确！' : '❌ 不正确'}
      </div>
      <div style="color:#a0b0c0;font-size:13px;line-height:1.6">
        <strong style="color:#58cc02">AI最优选择：</strong>${correctOption.text}<br>
        <strong>解析：</strong>${correctOption.explain}
      </div>
      <button onclick="AIQuiz.nextQuestion()" style="display:block;width:100%;margin-top:16px;padding:12px;
        background:#58cc02;color:#0f1923;border:none;border-radius:10px;font-weight:bold;font-size:14px;cursor:pointer">
        ${this.currentQ < this.questions.length - 1 ? '下一题 →' : '查看结果 →'}
      </button>`;
    panel.querySelector('div').appendChild(div);
    panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
  },

  nextQuestion() { this.currentQ++; this._renderQuestion(); },

  _showResults() {
    const total = this.answers.length;
    const correct = this.answers.filter(a => a.correct).length;
    const pct = Math.round(correct / total * 100);
    const rating = Math.round(pct * 20 + 200);

    const dimData = {};
    this.dimensions.forEach(d => {
      const ds = this.dimScores[d];
      dimData[d] = ds.total > 0 ? Math.round(ds.correct / ds.total * 100) : 0;
    });

    const rank = typeof AITraining !== 'undefined' ? AITraining.getRank(rating) : { name: '中级一段', icon: '🥇', color: '#ffd700' };
    let weakest = this.dimensions[0], weakestScore = 100;
    this.dimensions.forEach(d => { if (dimData[d] < weakestScore) { weakestScore = dimData[d]; weakest = d; } });

    const dimColors = ['#58cc02','#ffc800','#00bcd4','#e91e63','#ff6b35','#a78bfa'];
    let radarHtml = '';
    this.dimensions.forEach((d, i) => {
      const score = dimData[d];
      radarHtml += `<div style="display:flex;align-items:center;gap:8px;margin:6px 0">
        <span style="min-width:70px;font-size:12px;color:${dimColors[i]}">${d}</span>
        <div style="flex:1;height:20px;background:#0f1923;border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${score}%;background:${dimColors[i]};border-radius:4px;
            display:flex;align-items:center;justify-content:flex-end;padding-right:6px;
            font-size:10px;color:#000;font-weight:bold;min-width:24px">${score}</div>
        </div>
      </div>`;
    });

    const old = document.getElementById('quiz-panel');
    if (old) old.remove();

    const html = `<div id="quiz-panel" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:#0f1923;display:flex;align-items:center;justify-content:center;overflow-y:auto">
      <div style="max-width:440px;width:95%;padding:20px 0">
        <div style="background:linear-gradient(135deg,#1b2838,#1e3148);border-radius:20px;padding:28px;border:2px solid ${rank.color}">
          <h2 style="text-align:center;color:#fff;margin-bottom:4px;font-size:20px">📋 AI 测评报告</h2>
          <div style="text-align:center;color:#a0b0c0;font-size:12px;margin-bottom:20px">基于 V7 92.6% 大模型评估</div>
          <div style="text-align:center;margin-bottom:20px">
            <div style="font-size:48px">${rank.icon}</div>
            <div style="font-size:22px;font-weight:bold;color:${rank.color}">${rank.name}</div>
            <div style="font-size:36px;font-weight:900;color:#fff">${rating}分</div>
            <div style="color:#a0b0c0;font-size:13px">${correct}/${total} 正确 (${pct}%)</div>
          </div>
          <div style="background:#0f1923;padding:16px;border-radius:14px;margin-bottom:16px">
            <div style="color:#a0b0c0;font-size:11px;margin-bottom:10px;font-weight:bold">六维能力评估</div>
            ${radarHtml}
          </div>
          <div style="background:rgba(255,75,75,0.1);border:1px solid rgba(255,75,75,0.2);padding:12px;border-radius:10px;margin-bottom:16px">
            <div style="font-size:12px;color:#ff4b4b;font-weight:bold">💡 需要提升：${weakest}</div>
            <div style="font-size:11px;color:#a0b0c0;margin-top:4px">建议重点练习该维度相关策略</div>
          </div>
          <div style="display:flex;gap:8px">
            <button onclick="document.getElementById('quiz-panel').remove()"
              style="flex:1;padding:12px;background:#1e3148;color:#a0b0c0;border:1px solid #2a4a6b;border-radius:10px;cursor:pointer;font-size:13px">返回</button>
            <button onclick="AIQuiz.startQuiz()"
              style="flex:1;padding:12px;background:#58cc02;color:#0f1923;border:none;border-radius:10px;font-weight:bold;cursor:pointer;font-size:13px">重新测评</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    if (typeof AITraining !== 'undefined') {
      AITraining.rating.score = rating;
      AITraining.rating.level = rank.name;
      AITraining.rating.gamesPlayed++;
      AITraining.save();
      AITraining.updateBadge();
    }
  },
};

if (typeof window !== 'undefined') {
  window.AIQuiz = AIQuiz;
  // Pre-load questions
  document.addEventListener('DOMContentLoaded', () => AIQuiz.loadQuestions());
}
