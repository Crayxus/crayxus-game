/**
 * AI 掼蛋大师 · 段位测评题库系统
 *
 * 20 题定级，6 个维度：
 * 1. 组牌分解 (M值) - 4题
 * 2. 大牌控制 (Power) - 3题
 * 3. 出牌时机 - 3题
 * 4. 队友配合 - 3题
 * 5. 炸弹使用 - 3题
 * 6. 终局处理 - 4题
 *
 * 每题展示牌面+局势，4个选项，AI用Q值判断最优
 */

const AIQuiz = {
  questions: [],
  currentQ: 0,
  answers: [],     // [{qIndex, selected, correct, score, dimension}]
  dimensions: ['组牌分解', '大牌控制', '出牌时机', '队友配合', '炸弹使用', '终局处理'],
  dimScores: {},

  // 牌面工具
  SUITS: { S: '♠', H: '♥', C: '♣', D: '♦' },
  SUIT_COLORS: { S: '#e0e0e0', H: '#ff3b3b', C: '#22cc44', D: '#4488ff' },
  VAL_NAMES: { 3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A',15:'2' },

  cardStr(suit, val) {
    return `<span style="color:${this.SUIT_COLORS[suit]}">${this.SUITS[suit]}${this.VAL_NAMES[val]}</span>`;
  },

  cardsStr(cards) {
    return cards.map(c => this.cardStr(c.s, c.v)).join(' ');
  },

  // 生成题库（固定题目，保证质量）
  generateQuestions() {
    const Q = [];

    // ===== 维度1: 组牌分解 (4题) =====
    Q.push({
      dim: '组牌分解', difficulty: 1,
      scenario: '自由出牌，你的手牌有：',
      hand: [
        {s:'S',v:3},{s:'H',v:4},{s:'C',v:5},{s:'D',v:6},{s:'S',v:7},
        {s:'H',v:8},{s:'H',v:8},{s:'C',v:10},{s:'C',v:10},{s:'D',v:14},{s:'D',v:14}
      ],
      question: '第一手你出什么最优？',
      options: [
        { text: '顺子 ♠3♥4♣5♦6♠7', explain: '顺子一次出5张，剩下3对，总共4手清完', correct: true },
        { text: '对10', explain: '出对子只消2张，剩下9张散牌更多手' },
        { text: '单牌 ♠3', explain: '出最小单牌，但手牌变散，M值升高' },
        { text: '对A', explain: '大牌先出浪费控制力' },
      ],
    });

    Q.push({
      dim: '组牌分解', difficulty: 2,
      scenario: '自由出牌，手牌：',
      hand: [
        {s:'S',v:5},{s:'H',v:5},{s:'C',v:6},{s:'D',v:6},{s:'S',v:7},{s:'H',v:7},
        {s:'C',v:9},{s:'D',v:9},{s:'S',v:9},{s:'H',v:14},{s:'C',v:14}
      ],
      question: '怎样组牌最少手数出完？',
      options: [
        { text: '连对556677 + 三条999 + 对A = 3手', correct: true, explain: '连对消6张+三条3张+对子2张=3手最优' },
        { text: '对5+对6+对7+三带二(999+AA) = 4手', explain: '4手，不如连对方案' },
        { text: '三条999+对5+对6+对7+对A = 5手', explain: '5手太多' },
        { text: '顺子56789 + 对5+对6+对7+对A = 不成立', explain: '没有顺子56789（缺8）' },
      ],
    });

    Q.push({
      dim: '组牌分解', difficulty: 3,
      scenario: '手牌剩余：',
      hand: [{s:'S',v:3},{s:'H',v:3},{s:'C',v:3},{s:'D',v:8},{s:'S',v:8},{s:'H',v:13},{s:'C',v:13}],
      question: '怎样组牌最优？',
      options: [
        { text: '三带二(333+88) + 对K = 2手', correct: true, explain: '2手清完，M值最低' },
        { text: '三条333 + 对8 + 对K = 3手', explain: '3手，不如三带二' },
        { text: '对3+单3+对8+对K = 4手', explain: '拆三条是败着' },
        { text: '单3+对3+单8+对8+对K = 5手', explain: '完全散掉了' },
      ],
    });

    Q.push({
      dim: '组牌分解', difficulty: 2,
      scenario: '自由出牌，手牌：',
      hand: [
        {s:'S',v:4},{s:'H',v:5},{s:'C',v:6},{s:'D',v:7},{s:'S',v:8},
        {s:'H',v:6},{s:'C',v:7},{s:'D',v:8},{s:'S',v:14},{s:'H',v:14}
      ],
      question: '出顺子45678后剩下的牌怎样？',
      options: [
        { text: '出顺子，剩对6+对7+对8+对A=不对，剩678AA=散', explain: '顺子拆了对子，剩下变散' },
        { text: '不出顺子，出对6+对7+对8+顺子（不成立）', explain: '组合不成立' },
        { text: '出顺子45678，剩678AA，再出单6单7单8对A=5手，总6手', explain: '拆了对子代价大' },
        { text: '不出顺子，对6+对7+对8+单4单5+对A=6手不如→对6对7对8+单4单5单A单A=7手都不好，但出三连对678678+单45AA=实际没有连对', correct: true, explain: '这手牌没有完美解，但保留对子比拆开好' },
      ],
    });

    // ===== 维度2: 大牌控制 (3题) =====
    Q.push({
      dim: '大牌控制', difficulty: 1,
      scenario: '对手出了单牌5，轮到你。手牌有A和2和小王。',
      hand: [{s:'S',v:14},{s:'H',v:15},{s:'S',v:5},{s:'H',v:5},{s:'C',v:8}],
      question: '你出什么？',
      options: [
        { text: '单牌8 — 用最小的能压过的牌', correct: true, explain: '节省大牌控制力，小牌压小牌' },
        { text: '单牌A — 确保赢这轮', explain: 'A太大了，杀鸡用牛刀' },
        { text: '单牌2 — 绝对压制', explain: '浪费2的控制力' },
        { text: 'PASS — 让队友处理', explain: '能压就压，8就够了' },
      ],
    });

    Q.push({
      dim: '大牌控制', difficulty: 2,
      scenario: '你的手牌剩8张，对手剩3张，对手刚出了单牌Q。',
      hand: [{s:'S',v:14},{s:'H',v:14},{s:'C',v:13},{s:'D',v:13},{s:'S',v:7},{s:'H',v:7},{s:'C',v:5},{s:'D',v:5}],
      question: '对手快走完了，你怎么出？',
      options: [
        { text: '出A — 对手快走完必须压住', correct: true, explain: '对手只剩3张，必须抢控制权' },
        { text: '出K — 省A', explain: 'K可能压不住对手最后的牌' },
        { text: 'PASS — 让队友处理', explain: '对手只剩3张，不能放' },
        { text: '出对A — 过度反应', explain: '出单A就够了，别浪费对A' },
      ],
    });

    Q.push({
      dim: '大牌控制', difficulty: 3,
      scenario: '自由出牌，手牌：AA KK 88 55 3',
      hand: [{s:'S',v:14},{s:'H',v:14},{s:'C',v:13},{s:'D',v:13},{s:'S',v:8},{s:'H',v:8},{s:'C',v:5},{s:'D',v:5},{s:'S',v:3}],
      question: '自由出牌先出什么？',
      options: [
        { text: '对5 — 从小到大出对子', correct: true, explain: '先出小对，保留大牌做后续控制' },
        { text: '对A — 先确立控制', explain: '自由出牌不需要用A，浪费控制力' },
        { text: '单3 — 出最小的', explain: '出单牌让手牌多一手，不如出对子' },
        { text: '对K — 中等大小', explain: '不如先出小的保留大牌' },
      ],
    });

    // ===== 维度3: 出牌时机 (3题) =====
    Q.push({
      dim: '出牌时机', difficulty: 1,
      scenario: '队友出了对7，对手PASS，轮到你。',
      hand: [{s:'S',v:8},{s:'H',v:8},{s:'C',v:10},{s:'D',v:10},{s:'S',v:14},{s:'H',v:14}],
      question: '队友在控制局面，你出不出？',
      options: [
        { text: 'PASS — 让队友继续控制', correct: true, explain: '队友有牌权，不要跟队友抢' },
        { text: '对8 — 顺便出掉', explain: '压队友的牌是大忌' },
        { text: '对10 — 中等大小安全', explain: '别压队友！' },
        { text: '对A — 抢控制权', explain: '严重错误，压自己人' },
      ],
    });

    Q.push({
      dim: '出牌时机', difficulty: 2,
      scenario: '对手出了顺子34567，你手里有顺子45678和一个炸弹。',
      hand: [{s:'S',v:4},{s:'H',v:5},{s:'C',v:6},{s:'D',v:7},{s:'S',v:8},{s:'H',v:9},{s:'H',v:9},{s:'C',v:9},{s:'D',v:9}],
      question: '你怎么应对？',
      options: [
        { text: '出顺子45678压过去', correct: true, explain: '用顺子压顺子，保留炸弹做防守' },
        { text: '出炸弹9999', explain: '炸弹太贵了，顺子就能解决' },
        { text: 'PASS', explain: '能压为什么不压？让对手继续出牌更危险' },
        { text: '先炸再出顺子', explain: '过度使用火力' },
      ],
    });

    Q.push({
      dim: '出牌时机', difficulty: 3,
      scenario: '你手里剩5张：对A + 三条K。对手剩4张，队友剩2张。对手出了对Q。',
      hand: [{s:'S',v:14},{s:'H',v:14},{s:'C',v:13},{s:'D',v:13},{s:'S',v:13}],
      question: '你出什么？',
      options: [
        { text: '对A压住，然后三条K走完', correct: true, explain: '对A压住→自由出牌→三带二不行→三条K出完只剩…等等，出对A后自由出三条K，2手走完！' },
        { text: 'PASS让队友出', explain: '队友只剩2张未必能压对Q' },
        { text: '三条K压（不合法）', explain: '三条不能压对子' },
        { text: '放弃这轮', explain: '你能2手走完为什么放弃？' },
      ],
    });

    // ===== 维度4: 队友配合 (3题) =====
    Q.push({
      dim: '队友配合', difficulty: 1,
      scenario: '队友只剩2张牌了，轮到你自由出牌。你有：对3 对7 对J 对A',
      hand: [{s:'S',v:3},{s:'H',v:3},{s:'C',v:7},{s:'D',v:7},{s:'S',v:11},{s:'H',v:11},{s:'C',v:14},{s:'D',v:14}],
      question: '你出什么帮队友？',
      options: [
        { text: '对3 — 出最小对子让队友能接上', correct: true, explain: '出小对子，队友大概率能压过走完' },
        { text: '对A — 先出最大的', explain: '对A太大队友接不上' },
        { text: '对J — 中间大小', explain: '太大了，队友未必压得过' },
        { text: '对7 — 中小', explain: '对3更好，给队友最大的压过空间' },
      ],
    });

    Q.push({
      dim: '队友配合', difficulty: 2,
      scenario: '队友出了单牌3（明显在送你牌权），对手PASS了。你手里有很多牌。',
      hand: [{s:'S',v:4},{s:'H',v:5},{s:'C',v:6},{s:'D',v:7},{s:'S',v:8},{s:'H',v:10},{s:'C',v:10},{s:'D',v:12},{s:'S',v:12}],
      question: '队友送你牌权，你怎么回应？',
      options: [
        { text: '出单牌4接住，获得自由出牌权', correct: true, explain: '用最小的牌接住队友的牌权，然后自由出牌按计划走' },
        { text: 'PASS — 不需要', explain: '队友在送你机会，不接就浪费了' },
        { text: '出对10', explain: '别人出单你出对？牌型不匹配' },
        { text: '出顺子45678', explain: '牌型不匹配，要出单牌' },
      ],
    });

    Q.push({
      dim: '队友配合', difficulty: 3,
      scenario: '队友只剩1张牌！对手出了单牌J。你手里有K和A。',
      hand: [{s:'S',v:13},{s:'H',v:14},{s:'C',v:8},{s:'D',v:6},{s:'S',v:4}],
      question: '怎么帮队友走完？',
      options: [
        { text: '出K压住，然后自由出最小单牌让队友接', correct: true, explain: '你压住→自由出牌出小牌→队友压过走完' },
        { text: '出A压住', explain: 'K就够了，省A以防万一' },
        { text: 'PASS让队友自己压', explain: '队友最后1张未必压得过J' },
        { text: '出8', explain: '8压不过J' },
      ],
    });

    // ===== 维度5: 炸弹使用 (3题) =====
    Q.push({
      dim: '炸弹使用', difficulty: 1,
      scenario: '你有炸弹8888。当前自由出牌，你手里还有很多散牌，对手也牌多。',
      hand: [{s:'S',v:8},{s:'H',v:8},{s:'C',v:8},{s:'D',v:8},{s:'S',v:3},{s:'H',v:5},{s:'C',v:7},{s:'D',v:10},{s:'S',v:12}],
      question: '自由出牌时要不要出炸弹？',
      options: [
        { text: '不出炸弹，出单牌3', correct: true, explain: '自由出牌时炸弹没意义，留着防守或关键时刻用' },
        { text: '出炸弹8888展示实力', explain: '浪费炸弹，自由出牌不需要用炸弹' },
        { text: '出单牌Q', explain: '应该出最小的3' },
        { text: '出炸弹然后出单牌', explain: '白白浪费一个炸弹' },
      ],
    });

    Q.push({
      dim: '炸弹使用', difficulty: 2,
      scenario: '对手出了大牌对A，你有炸弹5555，手里还剩6张牌。对手剩5张。',
      hand: [{s:'S',v:5},{s:'H',v:5},{s:'C',v:5},{s:'D',v:5},{s:'S',v:7},{s:'H',v:7},{s:'C',v:9},{s:'D',v:9},{s:'S',v:11},{s:'H',v:11}],
      question: '要不要炸？',
      options: [
        { text: '炸！对手快走完了必须阻止', correct: true, explain: '对手只剩5张，如果不炸让对手继续出牌可能直接走完' },
        { text: '不炸，留着更关键的时候', explain: '对手只剩5张，没有比这更关键的了' },
        { text: 'PASS让队友处理', explain: '对A很难压，队友未必有炸弹' },
        { text: '等对手出最后几张再炸', explain: '到时候可能来不及了' },
      ],
    });

    Q.push({
      dim: '炸弹使用', difficulty: 3,
      scenario: '你有两个炸弹：6666和JJJJ，手里还有对3和对K。',
      hand: [{s:'S',v:6},{s:'H',v:6},{s:'C',v:6},{s:'D',v:6},{s:'S',v:11},{s:'H',v:11},{s:'C',v:11},{s:'D',v:11},{s:'S',v:3},{s:'H',v:3},{s:'C',v:13},{s:'D',v:13}],
      question: '规划出牌路线？',
      options: [
        { text: '对3→(被压后)炸6666→对K→炸JJJJ = 4手', correct: true, explain: '先出小的引对手出牌，炸弹抢权，4手清完' },
        { text: '炸JJJJ→炸6666→对K→对3 = 4手', explain: '4手一样，但先出大炸弹浪费，万一被更大的炸弹压住就亏了' },
        { text: '对3→对K→炸6666→炸JJJJ = 4手', explain: '出对K后可能被压，拿不回控制权' },
        { text: '炸6666→对3→对K→炸JJJJ = 4手', explain: '自由出牌先炸没必要' },
      ],
    });

    // ===== 维度6: 终局处理 (4题) =====
    Q.push({
      dim: '终局处理', difficulty: 1,
      scenario: '你只剩3张牌：2 2 小王。轮到你自由出牌。',
      hand: [{s:'S',v:15},{s:'H',v:15},{s:'S',v:16}],
      question: '怎么出？',
      options: [
        { text: '对2 → 小王 = 2手走完', correct: true, explain: '对2+单牌小王，2手搞定' },
        { text: '小王 → 对2 = 2手走完', explain: '也是2手，但先出小王可能被压，不如先出对2更安全' },
        { text: '单2 → 单2 → 小王 = 3手', explain: '拆对2变3手，多了一手' },
        { text: '小王 → 单2 → 单2 = 3手', explain: '3手，不如对2方案' },
      ],
    });

    Q.push({
      dim: '终局处理', difficulty: 2,
      scenario: '你剩4张：对K 和 对7。对手剩3张，对手出了对10。',
      hand: [{s:'S',v:13},{s:'H',v:13},{s:'C',v:7},{s:'D',v:7}],
      question: '你怎么出？',
      options: [
        { text: '对K压住，然后出对7走完', correct: true, explain: '2手清完！对K压过对10，自由出牌出对7' },
        { text: 'PASS', explain: '你能2手走完为什么PASS？' },
        { text: '对7（压不过）', explain: '对7压不过对10' },
        { text: '等下一轮', explain: '对手只剩3张，等不起' },
      ],
    });

    Q.push({
      dim: '终局处理', difficulty: 3,
      scenario: '你剩5张：三条J + 对5。对手剩2张。轮到你自由出牌。',
      hand: [{s:'S',v:11},{s:'H',v:11},{s:'C',v:11},{s:'D',v:5},{s:'S',v:5}],
      question: '怎么走完？',
      options: [
        { text: '三带二(JJJ+55) 一手走完！', correct: true, explain: '三带二一手清完5张，完美！' },
        { text: '对5 → 三条J = 2手', explain: '2手也行但不如1手' },
        { text: '三条J → 对5 = 2手', explain: '2手，不如三带二' },
        { text: '单J → 对J → 对5 = 3手', explain: '3手，拆三条是败着' },
      ],
    });

    Q.push({
      dim: '终局处理', difficulty: 2,
      scenario: '你剩6张：顺子34567 + 单A。自由出牌。',
      hand: [{s:'S',v:3},{s:'H',v:4},{s:'C',v:5},{s:'D',v:6},{s:'S',v:7},{s:'H',v:14}],
      question: '先出什么？',
      options: [
        { text: '顺子34567 → 单A = 2手', correct: true, explain: '顺子消5张，剩A一手走完' },
        { text: '单A → 顺子34567 = 2手', explain: '也是2手，但先出A可能被压，不如先出顺子抢先机' },
        { text: '单3 → 单4 → 单5 → 单6 → 单7 → 单A = 6手', explain: '6手？开玩笑' },
        { text: '单A → 单3 → ... 散出 = 6手', explain: '完全浪费顺子' },
      ],
    });

    // Shuffle questions within each dimension
    this.questions = Q;
    return Q;
  },

  // 开始测评
  startQuiz() {
    this.generateQuestions();
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
    const dimColor = { '组牌分解':'#58cc02', '大牌控制':'#ffc800', '出牌时机':'#00bcd4',
                       '队友配合':'#e91e63', '炸弹使用':'#ff6b35', '终局处理':'#a78bfa' };

    // Shuffle options (but remember which is correct)
    const options = q.options.map((o, i) => ({ ...o, origIdx: i }));
    // Simple shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    let handHtml = '';
    if (q.hand) {
      handHtml = `<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:12px 0">
        ${q.hand.map(c => `<div style="background:#1e3148;padding:4px 8px;border-radius:6px;font-size:14px;
          border:1px solid #2a4a6b">${this.cardStr(c.s, c.v)}</div>`).join('')}
      </div>`;
    }

    let optionsHtml = '';
    options.forEach((o, i) => {
      const letter = ['A', 'B', 'C', 'D'][i];
      optionsHtml += `<div class="quiz-option" data-idx="${o.origIdx}"
        style="background:#0f1923;padding:14px 16px;border-radius:12px;margin:8px 0;
        cursor:pointer;border:2px solid #1e3148;transition:all 0.2s;display:flex;align-items:center;gap:12px"
        onclick="AIQuiz.selectAnswer(${o.origIdx}, this)"
        onmouseenter="this.style.borderColor='#58cc02'" onmouseleave="this.style.borderColor='#1e3148'">
        <span style="background:#1e3148;color:#58cc02;width:28px;height:28px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;flex-shrink:0">${letter}</span>
        <span style="font-size:13px;color:#e0e0e0">${o.text}</span>
      </div>`;
    });

    const html = `<div id="quiz-panel" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:#0f1923;display:flex;flex-direction:column;overflow-y:auto">
      <div style="max-width:500px;width:95%;margin:0 auto;padding:20px 0">

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <span style="color:#a0b0c0;font-size:13px">第 ${this.currentQ + 1} / ${this.questions.length} 题</span>
          <span style="background:${dimColor[q.dim]||'#58cc02'}22;color:${dimColor[q.dim]||'#58cc02'};
            padding:4px 12px;border-radius:20px;font-size:11px;font-weight:bold">${q.dim}</span>
        </div>

        <div style="height:6px;background:#1e3148;border-radius:3px;margin-bottom:20px;overflow:hidden">
          <div style="height:100%;width:${progress}%;background:#58cc02;border-radius:3px;transition:width 0.3s"></div>
        </div>

        <div style="background:#1b2838;padding:20px;border-radius:16px;margin-bottom:16px;
          border:1px solid #2a4a6b">
          <div style="color:#a0b0c0;font-size:12px;margin-bottom:8px">${q.scenario}</div>
          ${handHtml}
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
    const isCorrect = q.options[origIdx].correct === true;
    const explain = q.options[origIdx].explain || '';
    const correctOption = q.options.find(o => o.correct);

    // Record
    this.answers.push({
      qIndex: this.currentQ,
      selected: origIdx,
      correct: isCorrect,
      dimension: q.dim,
    });
    this.dimScores[q.dim].total++;
    if (isCorrect) this.dimScores[q.dim].correct++;

    // Highlight answer
    const allOptions = document.querySelectorAll('.quiz-option');
    allOptions.forEach(opt => {
      opt.style.pointerEvents = 'none';
      const idx = parseInt(opt.dataset.idx);
      if (q.options[idx].correct) {
        opt.style.borderColor = '#58cc02';
        opt.style.background = 'rgba(88,204,2,0.15)';
      } else if (idx === origIdx) {
        opt.style.borderColor = '#ff4b4b';
        opt.style.background = 'rgba(255,75,75,0.15)';
      }
    });

    // Show explanation
    const panel = document.getElementById('quiz-panel');
    const explainDiv = document.createElement('div');
    explainDiv.style.cssText = 'max-width:500px;width:95%;margin:16px auto;padding:16px;border-radius:12px;' +
      (isCorrect ? 'background:rgba(88,204,2,0.1);border:1px solid rgba(88,204,2,0.3)' :
                   'background:rgba(255,75,75,0.1);border:1px solid rgba(255,75,75,0.3)');
    explainDiv.innerHTML = `
      <div style="font-size:18px;font-weight:bold;margin-bottom:8px;color:${isCorrect?'#58cc02':'#ff4b4b'}">
        ${isCorrect ? '✅ 正确！' : '❌ 不正确'}
      </div>
      <div style="color:#a0b0c0;font-size:13px;line-height:1.6">
        <strong style="color:#58cc02">最优答案：</strong>${correctOption.text}<br>
        <strong>解析：</strong>${correctOption.explain}
      </div>
      <button onclick="AIQuiz.nextQuestion()" style="display:block;width:100%;margin-top:16px;padding:12px;
        background:#58cc02;color:#0f1923;border:none;border-radius:10px;font-weight:bold;font-size:14px;cursor:pointer">
        ${this.currentQ < this.questions.length - 1 ? '下一题 →' : '查看结果 →'}
      </button>`;
    panel.querySelector('div').appendChild(explainDiv);
    panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
  },

  nextQuestion() {
    this.currentQ++;
    this._renderQuestion();
  },

  _showResults() {
    const total = this.answers.length;
    const correct = this.answers.filter(a => a.correct).length;
    const pct = Math.round(correct / total * 100);

    // Calculate dimension scores for radar
    const dimData = {};
    this.dimensions.forEach(d => {
      const ds = this.dimScores[d];
      dimData[d] = ds.total > 0 ? Math.round(ds.correct / ds.total * 100) : 0;
    });

    // Overall rating
    const rating = Math.round(pct * 20 + 200);
    const rank = typeof AITraining !== 'undefined' ? AITraining.getRank(rating) : { name: '中级', icon: '🥇', color: '#ffd700' };

    // Find weakest dimension
    let weakest = this.dimensions[0];
    let weakestScore = 100;
    this.dimensions.forEach(d => {
      if (dimData[d] < weakestScore) { weakestScore = dimData[d]; weakest = d; }
    });

    // Radar chart (simple CSS version)
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
        <div style="background:linear-gradient(135deg,#1b2838,#1e3148);border-radius:20px;padding:28px;
          border:2px solid ${rank.color}">

          <h2 style="text-align:center;color:#fff;margin-bottom:4px;font-size:20px">📋 测评报告</h2>
          <div style="text-align:center;color:#a0b0c0;font-size:12px;margin-bottom:20px">AI 掼蛋大师 · 段位测评</div>

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

          <div style="background:rgba(255,75,75,0.1);border:1px solid rgba(255,75,75,0.2);
            padding:12px;border-radius:10px;margin-bottom:16px">
            <div style="font-size:12px;color:#ff4b4b;font-weight:bold">💡 需要提升：${weakest}</div>
            <div style="font-size:11px;color:#a0b0c0;margin-top:4px">建议优先学习《${weakest}》课程提升该项能力</div>
          </div>

          <div style="display:flex;gap:8px">
            <button onclick="document.getElementById('quiz-panel').remove()"
              style="flex:1;padding:12px;background:#1e3148;color:#a0b0c0;border:1px solid #2a4a6b;
              border-radius:10px;cursor:pointer;font-size:13px">返回</button>
            <button onclick="AIQuiz.startQuiz()"
              style="flex:1;padding:12px;background:#58cc02;color:#0f1923;border:none;
              border-radius:10px;font-weight:bold;cursor:pointer;font-size:13px">重新测评</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    // Save to AITraining if available
    if (typeof AITraining !== 'undefined') {
      AITraining.rating.score = rating;
      AITraining.rating.level = rank.name;
      AITraining.rating.icon = rank.icon;
      AITraining.save();
      AITraining.updateBadge();
    }
  },
};

if (typeof window !== 'undefined') window.AIQuiz = AIQuiz;
