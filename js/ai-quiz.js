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

    // Render: each column stacked vertically, offset 35px per card to show suit+val
    const renderCol = (cards) => {
      const h = 65 + (cards.length - 1) * 35;
      let html = `<div style="position:relative;width:48px;height:${h}px">`;
      cards.forEach((c, i) => {
        html += `<div style="position:absolute;top:${i * 35}px;left:0;z-index:${10 + i}">${this.cardHtml(c)}</div>`;
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
      // 优先加载大题库
      let resp = await fetch('/js/quiz-pool.json');
      if (!resp.ok) resp = await fetch('/js/quiz-data.json');
      const data = await resp.json();
      this.pool = data.questions;
      this.loaded = true;
      console.log(`[Quiz] Loaded ${this.pool.length} questions from AI model`);
    } catch(e) {
      console.warn('[Quiz] Failed to load quiz data:', e);
      this.loaded = false;
    }
  },

  _pickBalanced(pool, n) {
    // 每维度至少2题，随机抽取
    const byDim = {};
    pool.forEach(q => {
      if (!byDim[q.dim]) byDim[q.dim] = [];
      byDim[q.dim].push(q);
    });
    Object.values(byDim).forEach(arr => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    });
    const result = [];
    const dims = Object.keys(byDim);
    const perDim = Math.max(2, Math.floor(n / dims.length));
    dims.forEach(dim => result.push(...(byDim[dim] || []).slice(0, perDim)));
    if (result.length < n) {
      const used = new Set(result);
      const rest = pool.filter(q => !used.has(q));
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      result.push(...rest.slice(0, n - result.length));
    }
    // 打乱最终顺序
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result.slice(0, n);
  },

  async startQuiz() {
    if (!this.loaded) await this.loadQuestions();
    if (!this.pool || !this.pool.length) {
      if (typeof toast === 'function') toast('题库加载失败，请刷新重试');
      return;
    }
    // 随机抽20题
    this.questions = this._pickBalanced(this.pool, 20);
    // 打乱每题选项顺序
    this.questions.forEach(q => {
      const opts = [...q.options];
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      q.options = opts;
    });
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

    let infoHtml = '';

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
      <div style="max-width:800px;width:95%;margin:0 auto;padding:20px 0">
        <div style="margin-bottom:16px">
          <span style="color:#a0b0c0;font-size:16px;font-weight:500">第 ${this.currentQ + 1} / ${this.questions.length} 题</span>
        </div>
        <div style="height:6px;background:#1e3148;border-radius:3px;margin-bottom:20px;overflow:hidden">
          <div style="height:100%;width:${progress}%;background:${dimColor};border-radius:3px;transition:width 0.3s"></div>
        </div>
        <div style="background:#1b2838;padding:24px;border-radius:16px;margin-bottom:20px;border:1px solid #2a4a6b">
          <div style="color:#a0b0c0;font-size:16px;margin-bottom:10px">${q.scenario}</div>
          ${q.last_play ? `<div style="margin:8px 0;padding:8px;background:#0f1923;border-radius:8px;border:1px solid #f8717144">
            <div style="font-size:11px;color:#f87171;margin-bottom:6px">上家出的牌：</div>
            <div style="display:flex;gap:2px">${q.last_play.map(c => this.cardHtmlSm(c)).join('')}</div>
          </div>` : ''}
          <div style="font-size:12px;color:#58cc02;margin:8px 0">你的手牌：</div>
          ${handHtml}
          <div style="color:#fff;font-size:16px;font-weight:bold;margin-top:12px">${q.question}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${optionsHtml}
        </div>
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

    // Assessment mode (段位测评): no feedback, go to next immediately
    // Course mode: show feedback
    const isAssessment = this.questions.length >= 15; // 20-question assessment

    if (isAssessment) {
      // No feedback, just move to next
      document.querySelectorAll('.quiz-option').forEach(opt => opt.style.pointerEvents = 'none');
      // Brief highlight selected
      el.style.borderColor = '#58cc02';
      el.style.background = 'rgba(88,204,2,0.1)';
      setTimeout(() => this.nextQuestion(), 600);
    } else {
      // Course mode: show correct/wrong + explanation
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

      const panel = document.getElementById('quiz-panel');
      const div = document.createElement('div');
      div.style.cssText = 'max-width:800px;width:95%;margin:16px auto;padding:20px;border-radius:14px;' +
        (isCorrect ? 'background:rgba(88,204,2,0.1);border:1px solid rgba(88,204,2,0.3)' :
                     'background:rgba(255,75,75,0.1);border:1px solid rgba(255,75,75,0.3)');
      div.innerHTML = `
        <div style="font-size:20px;font-weight:bold;margin-bottom:10px;color:${isCorrect?'#58cc02':'#ff4b4b'}">
          ${isCorrect ? '✅ 正确！' : '❌ 再想想'}
        </div>
        <div style="color:#e0e0e0;font-size:16px;line-height:1.8">
          <strong style="color:#58cc02">📖 解析：</strong>${AIQuiz._generateExplanation(q, correctOption, selected)}
        </div>
        <button onclick="AIQuiz.nextQuestion()" style="display:block;width:100%;margin-top:16px;padding:14px;
          background:#58cc02;color:#0f1923;border:none;border-radius:12px;font-weight:bold;font-size:16px;cursor:pointer">
          ${this.currentQ < this.questions.length - 1 ? '下一题 →' : '查看结果 →'}
        </button>`;
      panel.querySelector('div').appendChild(div);
      panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
    }
  },

  // 生成教学解析（老师角度，不暴露算法）
  _generateExplanation(q, correctOpt, selectedOpt) {
    const correct = correctOpt.text;
    const isPass = correct === 'PASS';
    const scenario = q.scenario || '';
    const isFollow = scenario.includes('出了');

    // 根据牌型生成解析
    if (isPass) {
      if (isFollow) return '这手牌没有合适的牌可以压过，不必勉强。保留实力，等到自由出牌时再展开攻势，这是老手的选择。';
      return '当前局面选择过牌是明智的。控制节奏比急于出牌更重要，留住手中的好牌等待关键时刻。';
    }

    const type = correct.split(':')[0].trim();
    const explanations = {
      '顺子': [
        '顺子一次出5张牌，是清牌效率最高的牌型之一。优先出顺子可以大幅减少手牌数量，为后续出牌创造有利条件。',
        '先把顺子打出去，不仅一次消耗5张牌，还能保留手中的对子和三条做后续组合，这是组牌的基本功。',
      ],
      '对子': [
        '出对子是稳健的选择。对子出牌效率高于单牌，而且保留了更大的牌型做后续的控制。',
        '先出小对子试探，既消耗了手牌又不暴露大牌实力，进可攻退可守。',
      ],
      '三带二': [
        '三带二一次出5张牌，组牌效率极高。把三条和对子组合在一起出，比分开出节省了一手牌。',
        '三带二是高效的出牌方式，一次性清掉5张牌。记住：能组三带二就不要拆开出。',
      ],
      '三条': [
        '三条虽然不如三带二高效，但在当前局面是最合理的选择。有时候不需要追求完美组合。',
      ],
      '单牌': [
        '出单牌虽然效率不高，但在当前局面是最稳妥的选择。大牌单出可以抢到牌权，小牌单出可以试探对手。',
        '这张单牌出得恰到好处——既不浪费大牌的控制力，又能保持出牌节奏。',
      ],
      '炸弹': [
        '关键时刻果断出炸弹！炸弹是掼蛋中最强的武器，用在正确的时机可以扭转整个牌局。',
        '这个时机用炸弹非常关键——如果不抢回牌权，对手很可能直接走完。',
      ],
      '连对': [
        '连对一次出6张牌，清牌效率极高。能组连对就优先出，这是高手的组牌思维。',
      ],
      '钢板': [
        '钢板（连续三条）一次出6张，是非常高效的出牌方式。',
      ],
    };

    const typeExps = explanations[type];
    if (typeExps) return typeExps[Math.floor(Math.random() * typeExps.length)];

    // 通用解析
    if (correct.includes('张牌')) {
      return '这个出牌选择在当前局面下最为合理。好的掼蛋选手总是在效率和控制之间找到最佳平衡点。';
    }
    return '掼蛋的精髓在于每一手牌都为最终的胜利服务。这个选择在综合考虑手牌结构和场上局势后，是当前最优的出牌方式。';
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

    const rank = typeof AITraining !== 'undefined' ? AITraining.getRank(rating) : { name: '黄金·精进', icon: '🏅', color: '#ffd700' };
    let weakest = this.dimensions[0], weakestScore = 100;
    this.dimensions.forEach(d => { if (dimData[d] < weakestScore) { weakestScore = dimData[d]; weakest = d; } });

    // --- 六边形雷达图 SVG ---
    const dimLabels = ['组牌分解','大牌控制','出牌时机','队友配合','炸弹使用','终局处理'];
    const dimColors = ['#58cc02','#ffc800','#00bcd4','#e91e63','#ff6b35','#a78bfa'];
    const cx = 130, cy = 130, R = 100;
    const angles = dimLabels.map((_, i) => (Math.PI / 2) + (2 * Math.PI * i / 6));
    const ptAt = (r, i) => {
      const a = angles[i];
      return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    };
    // grid rings
    let gridSvg = '';
    [0.25, 0.5, 0.75, 1.0].forEach(f => {
      const pts = dimLabels.map((_, i) => ptAt(R * f, i).join(',')).join(' ');
      gridSvg += `<polygon points="${pts}" fill="none" stroke="rgba(212,175,110,0.15)" stroke-width="1"/>`;
    });
    // axes
    dimLabels.forEach((_, i) => {
      const [x, y] = ptAt(R, i);
      gridSvg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(212,175,110,0.2)" stroke-width="1"/>`;
    });
    // data polygon
    const vals = dimLabels.map(d => (dimData[d] || 0) / 100);
    const dataPts = vals.map((v, i) => ptAt(R * Math.max(v, 0.05), i).join(',')).join(' ');
    // labels
    let labelsSvg = '';
    const labelR = R + 24;
    dimLabels.forEach((d, i) => {
      const [lx, ly] = ptAt(labelR, i);
      const score = dimData[d] || 0;
      labelsSvg += `<text x="${lx}" y="${ly}" fill="${dimColors[i]}" font-size="10" font-weight="bold" text-anchor="middle" dominant-baseline="central">${d}</text>`;
      labelsSvg += `<text x="${lx}" y="${ly + 13}" fill="rgba(255,255,255,0.6)" font-size="9" text-anchor="middle">${score}分</text>`;
    });
    // dot markers
    let dotsSvg = '';
    vals.forEach((v, i) => {
      const [dx, dy] = ptAt(R * Math.max(v, 0.05), i);
      dotsSvg += `<circle cx="${dx}" cy="${dy}" r="3.5" fill="${dimColors[i]}" stroke="#fff" stroke-width="1"/>`;
    });

    const radarSvg = `<svg viewBox="0 0 260 260" width="240" height="240" style="display:block;margin:0 auto">
      ${gridSvg}
      <polygon points="${dataPts}" fill="rgba(212,175,110,0.15)" stroke="#d4af6e" stroke-width="2"/>
      ${dotsSvg}
      ${labelsSvg}
    </svg>`;

    // --- 认证编号 ---
    const certNo = 'CRX-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 90000 + 10000));
    const certDate = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    const old = document.getElementById('quiz-panel');
    if (old) old.remove();

    const html = `<div id="quiz-panel" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:rgba(10,8,6,0.95);display:flex;align-items:center;justify-content:center;overflow-y:auto">
      <div style="max-width:460px;width:95%;padding:16px 0">

        <!-- 证书外框：皮质感 -->
        <div style="background:linear-gradient(145deg,#2c1810,#3d2518,#2a1508);border-radius:16px;padding:4px;
          box-shadow:0 8px 32px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.05);
          border:1px solid rgba(212,175,110,0.3)">

          <!-- 金色内框 -->
          <div style="border:2px solid rgba(212,175,110,0.5);border-radius:13px;padding:3px;
            background:linear-gradient(145deg,rgba(212,175,110,0.08),transparent,rgba(212,175,110,0.05))">

            <!-- 内页：米白纸质感 -->
            <div style="background:linear-gradient(170deg,#f5f0e8,#efe8db,#f2ece2);border-radius:10px;padding:28px 24px;position:relative;
              box-shadow:inset 0 0 60px rgba(180,160,120,0.15)">

              <!-- 水印花纹 -->
              <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                width:200px;height:200px;border:3px solid rgba(212,175,110,0.08);border-radius:50%;
                pointer-events:none"></div>
              <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                width:160px;height:160px;border:2px solid rgba(212,175,110,0.06);border-radius:50%;
                pointer-events:none"></div>

              <!-- 顶部装饰线 -->
              <div style="text-align:center;margin-bottom:6px">
                <div style="display:inline-block;width:60px;height:1px;background:linear-gradient(90deg,transparent,#d4af6e,transparent)"></div>
                <span style="color:#d4af6e;font-size:10px;margin:0 8px;letter-spacing:4px">CRAYXUS AI</span>
                <div style="display:inline-block;width:60px;height:1px;background:linear-gradient(90deg,transparent,#d4af6e,transparent)"></div>
              </div>

              <!-- 标题 -->
              <h2 style="text-align:center;color:#2c1810;font-size:22px;font-weight:900;margin:4px 0 2px;
                letter-spacing:6px;text-shadow:0 1px 0 rgba(212,175,110,0.3)">掼蛋段位认证</h2>
              <div style="text-align:center;color:#8a7a65;font-size:10px;margin-bottom:16px;letter-spacing:2px">
                Crayxus AI 掼蛋能力认证中心
              </div>

              <!-- 分隔线 -->
              <div style="height:1px;background:linear-gradient(90deg,transparent,#d4af6e80,transparent);margin-bottom:16px"></div>

              <!-- 段位+分数 -->
              <div style="text-align:center;margin-bottom:16px">
                <div style="font-size:40px;line-height:1">${rank.icon}</div>
                <div style="font-size:24px;font-weight:900;color:#2c1810;margin:4px 0;letter-spacing:3px;
                  text-shadow:0 1px 0 rgba(212,175,110,0.4)">${rank.name}</div>
                <div style="font-size:42px;font-weight:900;color:#8b6914;font-family:Georgia,serif;letter-spacing:2px">${rating}</div>
                <div style="font-size:11px;color:#8a7a65;letter-spacing:1px">综合评分 · ${correct}/${total} 正确率 ${pct}%</div>
              </div>

              <!-- 分隔线 -->
              <div style="height:1px;background:linear-gradient(90deg,transparent,#d4af6e60,transparent);margin-bottom:14px"></div>

              <!-- 六维雷达图 -->
              <div style="text-align:center;margin-bottom:14px">
                <div style="font-size:11px;color:#8a7a65;font-weight:bold;letter-spacing:3px;margin-bottom:8px">六 维 能 力 评 估</div>
                ${radarSvg}
              </div>

              <!-- 薄弱项 -->
              <div style="background:rgba(180,80,50,0.08);border:1px solid rgba(180,80,50,0.2);padding:10px 14px;border-radius:8px;margin-bottom:16px">
                <div style="font-size:11px;color:#b45032;font-weight:bold">待提升维度：${weakest}</div>
                <div style="font-size:10px;color:#8a7a65;margin-top:2px">建议通过蛋力学院重点练习该维度策略</div>
              </div>

              <!-- 认证信息 -->
              <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px">
                <div style="font-size:9px;color:#a09880;line-height:1.8">
                  <div>认证编号：${certNo}</div>
                  <div>评估日期：${certDate}</div>
                  <div>评估模型：V8 超冠军级 AI</div>
                </div>
                <!-- 红色印章 -->
                <div style="width:64px;height:64px;border:3px solid #c0392b;border-radius:50%;display:flex;
                  align-items:center;justify-content:center;transform:rotate(-15deg);opacity:0.85;
                  box-shadow:0 0 0 2px rgba(192,57,43,0.3)">
                  <div style="text-align:center;line-height:1.15">
                    <div style="font-size:8px;color:#c0392b;font-weight:900">CRAYXUS</div>
                    <div style="font-size:7px;color:#c0392b;font-weight:bold">AI认证</div>
                    <div style="font-size:6px;color:#c0392b">专用章</div>
                  </div>
                </div>
              </div>

              <!-- 底部装饰 -->
              <div style="text-align:center;margin-top:8px">
                <div style="display:inline-block;width:40px;height:1px;background:linear-gradient(90deg,transparent,#d4af6e,transparent)"></div>
                <span style="color:#c0a96e;font-size:8px;margin:0 6px;letter-spacing:2px">以AI之智 行大师之道</span>
                <div style="display:inline-block;width:40px;height:1px;background:linear-gradient(90deg,transparent,#d4af6e,transparent)"></div>
              </div>

            </div><!-- 内页结束 -->
          </div><!-- 金色内框结束 -->
        </div><!-- 皮质外框结束 -->

        <!-- 按钮 -->
        <div style="display:flex;gap:10px;margin-top:14px">
          <button onclick="document.getElementById('quiz-panel').remove()"
            style="flex:1;padding:13px;background:linear-gradient(145deg,#3d2518,#2c1810);color:#d4af6e;
              border:1px solid rgba(212,175,110,0.3);border-radius:12px;cursor:pointer;font-size:13px;
              letter-spacing:2px;font-weight:bold">返回</button>
          <button onclick="AIQuiz.saveCertImage()"
            style="flex:1;padding:13px;background:linear-gradient(145deg,#2c5e1a,#3d7a28);color:#a8e6a0;
              border:1px solid rgba(88,204,2,0.3);border-radius:12px;font-weight:bold;cursor:pointer;font-size:13px;
              letter-spacing:2px">保存图片</button>
          <button onclick="AIQuiz.startQuiz()"
            style="flex:1;padding:13px;background:linear-gradient(145deg,#8b6914,#a07d2e);color:#fff;
              border:none;border-radius:12px;font-weight:bold;cursor:pointer;font-size:13px;
              letter-spacing:2px;box-shadow:0 4px 12px rgba(139,105,20,0.4)">重新测评</button>
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

  // 保存证书为图片
  saveCertImage() {
    const panel = document.getElementById('quiz-panel');
    if (!panel) return;

    // 找到证书区域（皮质外框）
    const cert = panel.querySelector('[style*="linear-gradient(145deg,#2c1810"]');
    if (!cert) {
      // fallback: 截整个面板
      this._captureElement(panel);
      return;
    }
    this._captureElement(cert);
  },

  _captureElement(el) {
    // 使用 html2canvas 如果已加载
    if (typeof html2canvas !== 'undefined') {
      html2canvas(el, {
        backgroundColor: '#0a0806',
        scale: 2,
        useCORS: true,
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = '掼蛋段位认证_Crayxus.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
      return;
    }

    // 动态加载 html2canvas
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    script.onload = () => {
      html2canvas(el, {
        backgroundColor: '#0a0806',
        scale: 2,
        useCORS: true,
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = '掼蛋段位认证_Crayxus.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    };
    document.head.appendChild(script);
  },
};

if (typeof window !== 'undefined') {
  window.AIQuiz = AIQuiz;
  // Pre-load questions
  document.addEventListener('DOMContentLoaded', () => AIQuiz.loadQuestions());
}
