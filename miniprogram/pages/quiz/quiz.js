const app = getApp()

// 蛋力值测评题库 — 6维度 × 3题 × 3难度 = 18题
const DANLI_QUESTIONS = [
  // === 出牌 (timing) ===
  { dim: 'timing', dimName: '出牌', dimIcon: '🎯', dimColor: '#ff6b6b', difficulty: 1,
    question: '你手上有对A和对K，轮到你出牌，场上没人管牌。你会先出哪个？',
    options: ['先出对A，压制对手', '先出对K，留A收尾', '随便出，差不多', '看队友出了什么再决定'],
    correct: 1, explain: '对K先出可以试探，对A留在手里作为最后的控制权。好的出牌时机是掌握节奏的关键。' },
  { dim: 'timing', dimName: '出牌', dimIcon: '🎯', dimColor: '#ff6b6b', difficulty: 2,
    question: '队友已经走了，你手上还有8张牌，对手各有3张和5张。你应该？',
    options: ['全力出最大的牌压制', '配合3张的对手节奏，让5张的接不上', '随便出，等对手自己失误', '留炸弹不出，等关键时刻'],
    correct: 1, explain: '队友已走，你要帮队友守住。配合节奏，压制多牌的对手，让少牌的对手无法顺利出完。' },
  { dim: 'timing', dimName: '出牌', dimIcon: '🎯', dimColor: '#ff6b6b', difficulty: 3,
    question: '你是末家，手牌剩3张（三条）。场上头家剩2张，闲家出了对子。你应该？',
    options: ['过牌，等头家出完再管', '炸掉这对子然后出三条', '用三条中的一对管上', '看情况等下一轮'],
    correct: 0, explain: '头家只剩2张，大概率是对子。你过牌让头家接上并走完，你和队友赢。管上反而帮了对手。' },

  // === 配合 (teamwork) ===
  { dim: 'teamwork', dimName: '配合', dimIcon: '🤝', dimColor: '#ffd93d', difficulty: 1,
    question: '队友出了一手小单张，你手上有A。你会？',
    options: ['出A管上，展示实力', '过牌，让队友自己走牌', '出一个小的配合队友', '出炸弹翻倍'],
    correct: 1, explain: '队友出小单张是在试探或者走牌，你过牌把出牌权留给他，才是好的配合。' },
  { dim: 'teamwork', dimName: '配合', dimIcon: '🤝', dimColor: '#ffd93d', difficulty: 2,
    question: '队友手上只剩一对牌了，轮到你出牌。你手上有很多单张。你应该？',
    options: ['出单张，反正自己也要走', '出对子，给队友送牌', '出最大的牌压制对手', '出三条带一个'],
    correct: 1, explain: '队友只剩一对，你出对子让队友有机会接上走完，这才是默契配合。' },
  { dim: 'teamwork', dimName: '配合', dimIcon: '🤝', dimColor: '#ffd93d', difficulty: 3,
    question: '你的队友上家出了炸弹接管了牌权，然后出了个小顺子。你判断他大概率在走牌。你应该？',
    options: ['过牌让他继续走', '出更大的顺子表示支持', '管上然后自己走', '出炸弹压制'],
    correct: 0, explain: '队友炸弹拿权后走小顺子，明确在走牌。你要做的是过牌保他走完，别抢牌权。' },

  // === 炸弹 (bombing) ===
  { dim: 'bombing', dimName: '炸弹', dimIcon: '💣', dimColor: '#ff9500', difficulty: 1,
    question: '你手上有4个8（炸弹）。在什么情况下你会使用它？',
    options: ['一上来就炸，先声夺人', '对方要走完时炸掉他', '队友出牌时炸上去', '留到最后再说'],
    correct: 1, explain: '炸弹是稀缺资源，最佳使用时机是在关键时刻阻止对手走完，或为自己/队友创造走牌机会。' },
  { dim: 'bombing', dimName: '炸弹', dimIcon: '💣', dimColor: '#ff9500', difficulty: 2,
    question: '你有两个炸弹（4个6和4个J）。对手出了一个4个9的炸弹。你用哪个？',
    options: ['不管，留炸弹', '用4个J刚好压过', '用4个6（反正是小的）', '两个都不用，等更好时机'],
    correct: 1, explain: '用4个J刚好压过9的炸弹，既达到了压制目的，又保留了更小的炸弹作为后续资源。' },
  { dim: 'bombing', dimName: '炸弹', dimIcon: '💣', dimColor: '#ff9500', difficulty: 3,
    question: '双方比分2:2平，你手上有天王炸（大小王）。对手出了一个5张同花顺炸弹。你应该？',
    options: ['天王炸压过去', '过牌保留实力', '等队友处理', '认输这一手'],
    correct: 0, explain: '天王炸是最大的炸弹，在决胜局压制对方的强力炸弹，确保拿回牌权至关重要。' },

  // === 记牌 (memory) ===
  { dim: 'memory', dimName: '记牌', dimIcon: '🧠', dimColor: '#00d4aa', difficulty: 1,
    question: '关于记牌，以下哪种说法是正确的？',
    options: ['只需要记大牌（A、K、Q）', '记住蛋牌出了几张最重要', '不用记牌，靠感觉打', '只记自己的牌就行'],
    correct: 1, explain: '蛋牌（当前主牌）是掼蛋中最重要的记牌对象，它决定了炸弹的构成和关键牌力。' },
  { dim: 'memory', dimName: '记牌', dimIcon: '🧠', dimColor: '#00d4aa', difficulty: 2,
    question: '场上已经出了3张A，你手上有1张A。你能得出什么结论？',
    options: ['A已经出完了，没有意义了', '我的A是场上最后一张，价值很高', '应该马上出A', '记不住那么多'],
    correct: 1, explain: '4张A已出3张，你的A是最后一张。这意味着你出单张A时没人能管（除了炸弹），非常有价值。' },
  { dim: 'memory', dimName: '记牌', dimIcon: '🧠', dimColor: '#00d4aa', difficulty: 3,
    question: '通过记牌你判断对手只剩一对小牌。你手上有一个三条和几张散牌。你应该？',
    options: ['出三条走牌', '出对子管住不让他走', '随便出单张', '出最大的单张'],
    correct: 1, explain: '知道对手只剩一对，就不能让他有出对子的机会。出对子管住他的出牌路线，这就是记牌的实战价值。' },

  // === 大局 (strategy) ===
  { dim: 'strategy', dimName: '大局', dimIcon: '♟️', dimColor: '#7c4dff', difficulty: 1,
    question: '掼蛋比赛中，"头游"和"末游"分别指什么？',
    options: ['第一个和最后一个出完牌的人', '分数最高和最低的人', '最强和最弱的选手', '庄家和闲家'],
    correct: 0, explain: '头游是第一个出完所有手牌的选手，末游是最后一个。掼蛋的核心目标就是争头游避末游。' },
  { dim: 'strategy', dimName: '大局', dimIcon: '♟️', dimColor: '#7c4dff', difficulty: 2,
    question: '当前比分你们落后1级。这局你应该采取什么策略？',
    options: ['保守打法，别输太多', '激进打法，争取双上扳回来', '正常打，一局一局来', '放弃这局等下一局'],
    correct: 1, explain: '落后时需要争取双上（两人都在前两位）来多升级。保守只会越打越被动。' },
  { dim: 'strategy', dimName: '大局', dimIcon: '♟️', dimColor: '#7c4dff', difficulty: 3,
    question: '你们目前领先2级打到A，对方打J。这局策略上你应该？',
    options: ['全力进攻，一把打完', '稳扎稳打，确保不被双上', '让队友先走，自己辅助', '全力保队友走完'],
    correct: 1, explain: '大幅领先时最重要的是稳住不被翻盘。确保不被双上就能继续保持优势，不必冒险求双上。' },

  // === 心态 (mental) ===
  { dim: 'mental', dimName: '心态', dimIcon: '💪', dimColor: '#3d9dff', difficulty: 1,
    question: '连输3局后，你的心态是？',
    options: ['很急，下一局一定要赢', '冷静分析之前输的原因', '怪队友不给力', '随便了，无所谓'],
    correct: 1, explain: '好的心态是冷静复盘。急躁会导致更多失误，怪队友会破坏配合。稳定心态是高手的标志。' },
  { dim: 'mental', dimName: '心态', dimIcon: '💪', dimColor: '#3d9dff', difficulty: 2,
    question: '你拿到一手很差的牌（没有炸弹，缺少大牌）。你会怎么做？',
    options: ['摊牌，这局没法打了', '尽量配合队友，做好辅助', '赌一把，激进出牌', '消极打，等下一局'],
    correct: 1, explain: '牌差不代表没用。配合队友辅助走牌，承担送牌角色，也能为团队做贡献。心态决定牌桌表现。' },
  { dim: 'mental', dimName: '心态', dimIcon: '💪', dimColor: '#3d9dff', difficulty: 3,
    question: '决胜局最后一手，你犯了一个错误导致输了。你应该？',
    options: ['非常沮丧，久久不能释怀', '承认错误，记住教训，翻篇', '怪对手运气好', '觉得是队友没配合好'],
    correct: 1, explain: '承认错误、总结教训、然后翻篇。好的竞技心态是快速从失败中学习，而不是沉溺情绪。' }
]

// 每日做题题库（从大池子中随机抽3道）
const DAILY_POOL = DANLI_QUESTIONS

const dimConfig = [
  { key: 'timing', name: '出牌', icon: '🎯', color: '#ff6b6b' },
  { key: 'teamwork', name: '配合', icon: '🤝', color: '#ffd93d' },
  { key: 'bombing', name: '炸弹', icon: '💣', color: '#ff9500' },
  { key: 'memory', name: '记牌', icon: '🧠', color: '#00d4aa' },
  { key: 'strategy', name: '大局', icon: '♟️', color: '#7c4dff' },
  { key: 'mental', name: '心态', icon: '💪', color: '#3d9dff' }
]

Page({
  data: {
    statusBarHeight: 44,
    mode: 'danli', // 'danli' or 'daily'
    started: false,
    finished: false,
    questions: [],
    currentIndex: 0,
    currentQ: null,
    selectedAnswer: -1,
    showResult: false,
    answers: [],
    result: null
  },

  onLoad(options) {
    const mode = options.mode || 'danli'
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44, mode })
    } catch(e) {
      this.setData({ mode })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  startQuiz() {
    let questions
    if (this.data.mode === 'danli') {
      // 全18题，随机打乱顺序
      questions = this._shuffle([...DANLI_QUESTIONS])
    } else {
      // 每日做题：随机抽3题，每次不重复维度
      questions = this._pickDaily(3)
    }

    this.setData({
      started: true,
      finished: false,
      questions,
      currentIndex: 0,
      currentQ: questions[0],
      selectedAnswer: -1,
      showResult: false,
      answers: []
    })
  },

  selectAnswer(e) {
    if (this.data.showResult) return
    const idx = e.currentTarget.dataset.idx
    const answers = [...this.data.answers, idx]
    this.setData({ selectedAnswer: idx, showResult: true, answers })
  },

  nextQuestion() {
    const nextIdx = this.data.currentIndex + 1
    if (nextIdx >= this.data.questions.length) {
      this._finishQuiz()
      return
    }
    this.setData({
      currentIndex: nextIdx,
      currentQ: this.data.questions[nextIdx],
      selectedAnswer: -1,
      showResult: false
    })
  },

  retryQuiz() {
    this.setData({ started: false, finished: false })
  },

  _finishQuiz() {
    const { questions, answers, mode } = this.data

    if (mode === 'danli') {
      // 计算蛋力值
      const dimScores = {}
      dimConfig.forEach(d => { dimScores[d.key] = 0 })

      questions.forEach((q, i) => {
        if (answers[i] === q.correct) {
          // 难度1=30分, 难度2=35分, 难度3=40分 (满分 3题×(30+35+40)=315, 归一化到约167/维度)
          const pts = [30, 35, 40][q.difficulty - 1] || 30
          dimScores[q.dim] = (dimScores[q.dim] || 0) + pts
        }
      })

      // 每个维度满分105分(30+35+40), 映射到0-167 (总分1000)
      const dims = dimConfig.map(d => {
        const raw = dimScores[d.key] || 0
        const val = Math.round(raw / 105 * 167)
        return { ...d, val, pct: Math.round(val / 167 * 100) }
      })

      const totalScore = dims.reduce((s, d) => s + d.val, 0)
      const rank = totalScore >= 900 ? '蛋王' :
                   totalScore >= 750 ? '蛋帝' :
                   totalScore >= 600 ? '蛋将' :
                   totalScore >= 400 ? '蛋士' :
                   totalScore >= 200 ? '蛋兵' : '蛋徒'

      // 保存到globalData和本地存储
      const danliData = { score: totalScore, rank, testedAt: Date.now() }
      dims.forEach(d => { danliData[d.key] = d.val })
      app.globalData.danli = danliData
      wx.setStorageSync('crayxus_danli', danliData)

      this.setData({
        finished: true,
        result: { score: totalScore, rank, dims }
      })
    } else {
      // 每日做题 — 记录统计
      const correct = questions.filter((q, i) => answers[i] === q.correct).length
      const quiz = wx.getStorageSync('crayxus_quiz') || { totalQuestions: 0, totalCorrect: 0, streak: 0, bestStreak: 0, lastDate: '' }

      const today = new Date().toISOString().slice(0, 10)
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

      quiz.totalQuestions += questions.length
      quiz.totalCorrect += correct
      quiz.correctRate = Math.round(quiz.totalCorrect / quiz.totalQuestions * 100)

      if (quiz.lastDate === yesterday || quiz.lastDate === today) {
        if (quiz.lastDate !== today) quiz.streak += 1
      } else {
        quiz.streak = 1
      }
      quiz.lastDate = today
      if (quiz.streak > quiz.bestStreak) quiz.bestStreak = quiz.streak

      wx.setStorageSync('crayxus_quiz', quiz)

      this.setData({
        finished: true,
        result: { correct, total: questions.length }
      })
    }
  },

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  },

  _pickDaily(n) {
    // 尽量从不同维度抽题
    const byDim = {}
    DAILY_POOL.forEach(q => {
      if (!byDim[q.dim]) byDim[q.dim] = []
      byDim[q.dim].push(q)
    })
    const dims = this._shuffle(Object.keys(byDim))
    const result = []
    for (let i = 0; i < n && i < dims.length; i++) {
      const pool = byDim[dims[i]]
      result.push(pool[Math.floor(Math.random() * pool.length)])
    }
    return result
  }
})
