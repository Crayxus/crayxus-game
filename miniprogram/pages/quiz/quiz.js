const app = getApp()

// 花色映射
const SUIT_SYMBOLS = { S: '♠', H: '♥', C: '♣', D: '♦', JK: '★' }
const SUIT_COLORS = { S: '#e0e0e0', H: '#ff3b3b', C: '#22cc44', D: '#4488ff', JK: '#ffc800' }
const VAL_NAMES = {3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A',15:'2',16:'小王',17:'大王'}

// 维度配色
const DIM_COLORS = {
  '组牌分解': '#58cc02', '大牌控制': '#ffc800', '出牌时机': '#00bcd4',
  '队友配合': '#e91e63', '炸弹使用': '#ff6b35', '终局处理': '#a78bfa'
}

Page({
  data: {
    statusBarHeight: 44,
    mode: 'danli',
    started: false,
    finished: false,
    questions: [],
    currentIndex: 0,
    currentQ: null,
    selectedAnswer: -1,
    showResult: false,
    answers: [],
    result: null,
    pool: [],
    poolLoaded: false
  },

  onLoad(options) {
    const mode = options.mode || 'danli'
    const lessonDim = options.dim ? decodeURIComponent(options.dim) : ''
    const courseId = options.courseId || ''
    const lessonIdx = options.lessonIdx || '0'
    const lessonName = options.lessonName ? decodeURIComponent(options.lessonName) : ''
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44, mode, lessonDim, courseId, lessonIdx, lessonName })
    } catch(e) {
      this.setData({ mode, lessonDim, courseId, lessonIdx, lessonName })
    }
    this.loadPool()
  },

  // 加载题库
  loadPool() {
    // 优先从服务器加载大题库
    wx.request({
      url: app.globalData.serverUrl + '/js/quiz-pool.json',
      success: (res) => {
        if (res.data && res.data.questions && res.data.questions.length > 0) {
          this.processPool(res.data.questions)
        } else {
          this.loadFallback()
        }
      },
      fail: () => this.loadFallback()
    })
  },

  loadFallback() {
    // 回退：加载原始20题
    wx.request({
      url: app.globalData.serverUrl + '/js/quiz-data.json',
      success: (res) => {
        if (res.data && res.data.questions) {
          this.processPool(res.data.questions)
        }
      }
    })
  },

  processPool(questions) {
    // 为每道题处理牌面数据
    const pool = questions.map(q => {
      // 手牌处理
      const hand = (q.hand || []).map(c => ({
        ...c,
        val: VAL_NAMES[c.v] || String(c.v),
        suit: SUIT_SYMBOLS[c.s] || '',
        color: SUIT_COLORS[c.s] || '#fff'
      }))

      // 上一手牌
      const lastPlay = (q.last_play || []).map(c => ({
        ...c,
        val: VAL_NAMES[c.v] || String(c.v),
        suit: SUIT_SYMBOLS[c.s] || '',
        color: SUIT_COLORS[c.s] || '#fff'
      }))

      // 选项：解析牌面
      const options = (q.options || []).map(opt => {
        const cards = this._parseOptionCards(opt.text)
        return { ...opt, cards, dimColor: DIM_COLORS[q.dim] || '#fff' }
      })

      return {
        ...q,
        hand,
        lastPlay,
        options,
        dimColor: DIM_COLORS[q.dim] || '#fff'
      }
    })

    this.setData({ pool, poolLoaded: true })
  },

  _parseOptionCards(text) {
    if (text === 'PASS') return []
    const cards = []
    const suitMap = {'♠':'S','♥':'H','♣':'C','♦':'D'}
    const regex = /([♠♥♣♦])(\d+|[JQKA])|小王|大王/g
    let m
    while ((m = regex.exec(text)) !== null) {
      if (m[0] === '小王') {
        cards.push({ s: 'JK', v: 16, val: '小王', suit: '★', color: SUIT_COLORS.JK })
      } else if (m[0] === '大王') {
        cards.push({ s: 'JK', v: 17, val: '大王', suit: '★', color: SUIT_COLORS.JK })
      } else {
        const s = suitMap[m[1]] || 'S'
        const valMap = {'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15}
        const v = valMap[m[2]] || 0
        cards.push({ s, v, val: m[2], suit: SUIT_SYMBOLS[s], color: SUIT_COLORS[s] })
      }
    }
    return cards
  },

  goBack() { wx.navigateBack() },

  startQuiz() {
    if (!this.data.poolLoaded || this.data.pool.length === 0) {
      wx.showToast({ title: '题库加载中...', icon: 'none' })
      return
    }

    let questions
    if (this.data.mode === 'lesson') {
      // 课程模式：从指定维度抽5题
      const dim = this.data.lessonDim
      const dimPool = this.data.pool.filter(q => q.dim === dim)
      if (dimPool.length === 0) {
        // 该维度没题，从全库随机抽
        questions = this._pickRandom(5)
      } else {
        this._shuffle(dimPool)
        questions = dimPool.slice(0, 5)
      }
    } else if (this.data.mode === 'danli') {
      // 段位测评：从大题库随机抽20题（每维度至少2题）
      questions = this._pickBalanced(20)
    } else {
      // 每日做题：随机3题
      questions = this._pickRandom(3)
    }

    // 打乱每题的选项顺序
    questions = questions.map(q => {
      const shuffled = this._shuffleOptions(q.options)
      return { ...q, options: shuffled }
    })

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

  _pickBalanced(n) {
    const pool = [...this.data.pool]
    const byDim = {}
    pool.forEach(q => {
      if (!byDim[q.dim]) byDim[q.dim] = []
      byDim[q.dim].push(q)
    })

    // 每维度打乱
    Object.values(byDim).forEach(arr => this._shuffle(arr))

    // 每维度至少取2题
    const result = []
    const dims = Object.keys(byDim)
    const perDim = Math.max(2, Math.floor(n / dims.length))

    dims.forEach(dim => {
      const qs = byDim[dim] || []
      result.push(...qs.slice(0, perDim))
    })

    // 如果不够n题，从剩余随机补
    if (result.length < n) {
      const used = new Set(result.map(q => JSON.stringify(q.hand)))
      const remaining = pool.filter(q => !used.has(JSON.stringify(q.hand)))
      this._shuffle(remaining)
      result.push(...remaining.slice(0, n - result.length))
    }

    // 截取n题并打乱顺序
    return this._shuffle(result.slice(0, n))
  },

  _pickRandom(n) {
    const pool = [...this.data.pool]
    this._shuffle(pool)
    return pool.slice(0, n)
  },

  _shuffleOptions(options) {
    const arr = options.map((opt, i) => ({ ...opt, _origIdx: i }))
    this._shuffle(arr)
    return arr
  },

  selectAnswer(e) {
    if (this.data.showResult) return
    const idx = e.currentTarget.dataset.idx
    const q = this.data.currentQ
    const isCorrect = q.options[idx].correct

    if (this.data.mode === 'danli') {
      // 段位测评模式：不显示解析，自动进入下一题
      const answers = [...this.data.answers, { idx, correct: isCorrect, dim: q.dim }]
      this.setData({ answers })

      setTimeout(() => {
        const nextIdx = this.data.currentIndex + 1
        if (nextIdx >= this.data.questions.length) {
          this._finishQuiz()
        } else {
          this.setData({
            currentIndex: nextIdx,
            currentQ: this.data.questions[nextIdx],
            selectedAnswer: -1,
            showResult: false
          })
        }
      }, 500)
    } else {
      // 每日做题：显示解析
      const answers = [...this.data.answers, { idx, correct: isCorrect, dim: q.dim }]
      this.setData({ selectedAnswer: idx, showResult: true, answers })
    }
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
      // 计算各维度得分
      const dimScores = {}
      const dimTotals = {}
      const allDims = Object.keys(DIM_COLORS)
      allDims.forEach(d => { dimScores[d] = 0; dimTotals[d] = 0 })

      answers.forEach(a => {
        dimTotals[a.dim] = (dimTotals[a.dim] || 0) + 1
        if (a.correct) dimScores[a.dim] = (dimScores[a.dim] || 0) + 1
      })

      const dimConfig = [
        { key: '组牌分解', name: '组牌', icon: '🃏', color: '#58cc02' },
        { key: '大牌控制', name: '大牌', icon: '👑', color: '#ffc800' },
        { key: '出牌时机', name: '时机', icon: '⏱️', color: '#00bcd4' },
        { key: '队友配合', name: '配合', icon: '🤝', color: '#e91e63' },
        { key: '炸弹使用', name: '炸弹', icon: '💣', color: '#ff6b35' },
        { key: '终局处理', name: '终局', icon: '🏁', color: '#a78bfa' }
      ]

      const correct = answers.filter(a => a.correct).length
      const total = answers.length
      const pct = Math.round(correct / total * 100)

      const dims = dimConfig.map(d => {
        const t = dimTotals[d.key] || 1
        const s = dimScores[d.key] || 0
        const dimPct = Math.round(s / t * 100)
        const val = Math.round(dimPct * 1.67) // 映射到0-167
        return { ...d, val, pct: dimPct }
      })

      const totalScore = dims.reduce((s, d) => s + d.val, 0)
      const rating = Math.round(pct * 20 + 200)

      const RANKS = [
        { name: '青铜·初窥', icon: '🛡️', min: 0, color: '#cd7f32' },
        { name: '青铜·入门', icon: '🛡️', min: 600, color: '#cd7f32' },
        { name: '白银·小成', icon: '⚔️', min: 800, color: '#c0c0c0' },
        { name: '白银·通达', icon: '⚔️', min: 1000, color: '#c0c0c0' },
        { name: '黄金·精进', icon: '🏅', min: 1200, color: '#ffd700' },
        { name: '黄金·老练', icon: '🏅', min: 1400, color: '#ffd700' },
        { name: '铂金·纵横', icon: '💠', min: 1600, color: '#00e5ff' },
        { name: '铂金·无双', icon: '💠', min: 1800, color: '#00e5ff' },
        { name: '钻石·宗师', icon: '💎', min: 2000, color: '#b388ff' },
        { name: '钻石·大宗师', icon: '💎', min: 2200, color: '#b388ff' },
        { name: '王者·掼圣', icon: '👑', min: 2400, color: '#ff6b35' },
        { name: '传奇·掼蛋大师', icon: '🏆', min: 2800, color: '#ff4500' },
      ]
      let rankObj = RANKS[0]
      for (const r of RANKS) { if (rating >= r.min) rankObj = r }

      const certNo = 'CRX-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 90000 + 10000))
      const certDate = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })

      let weakest = dims[0]
      dims.forEach(d => { if (d.pct < weakest.pct) weakest = d })

      // 保存
      const danliData = { score: totalScore, rank: rankObj.name, rating, testedAt: Date.now() }
      dims.forEach(d => { danliData[d.key] = d.val })
      app.globalData.danli = danliData
      wx.setStorageSync('crayxus_danli', danliData)

      // 奖励蛋力Token
      const egg = wx.getStorageSync('crayxus_egg') || { balance: 100, history: [] }
      egg.balance += 20
      egg.history.unshift({ type: 'earn', amount: 20, reason: '段位测评', time: Date.now() })
      wx.setStorageSync('crayxus_egg', egg)

      // 同步到服务器
      this._syncToServer(danliData, egg)

      this.setData({
        finished: true,
        result: {
          score: totalScore, rating, correct, total, pct,
          rank: rankObj.name, rankIcon: rankObj.icon, rankColor: rankObj.color,
          dims, certNo, certDate, weakest: weakest.name
        }
      })
    } else if (mode === 'lesson') {
      // 课程答题完成
      const correct = answers.filter(a => a.correct).length
      const total = answers.length
      const pct = Math.round(correct / total * 100)
      const passed = pct >= 60 // 60%及格

      if (passed) {
        // 标记课程完成
        const progress = wx.getStorageSync('crayxus_academy') || {}
        const courseId = this.data.courseId
        const lessonIdx = this.data.lessonIdx
        if (!progress[courseId]) progress[courseId] = {}
        progress[courseId][String(lessonIdx)] = 'done'
        wx.setStorageSync('crayxus_academy', progress)

        // 奖励蛋力Token
        const egg = wx.getStorageSync('crayxus_egg') || { balance: 100, history: [] }
        const bonus = pct === 100 ? 15 : pct >= 80 ? 10 : 5
        egg.balance += bonus
        egg.history.unshift({ type: 'earn', amount: bonus, reason: this.data.lessonName + (pct === 100 ? ' 满分!' : ''), time: Date.now() })
        wx.setStorageSync('crayxus_egg', egg)

        // 同步到服务器
        const uid = wx.getStorageSync('crayxus_uid') || ''
        if (uid) {
          wx.request({
            url: app.globalData.serverUrl + '/api/progress',
            method: 'POST',
            header: { 'content-type': 'application/json' },
            data: { userId: uid, data: { courses: progress, egg, source: 'miniprogram' } }
          })
        }
      }

      this.setData({
        finished: true,
        result: {
          correct, total, pct, passed,
          bonus: passed ? (pct === 100 ? 15 : pct >= 80 ? 10 : 5) : 0,
          lessonName: this.data.lessonName,
          dim: this.data.lessonDim
        }
      })
    } else {
      // 每日做题
      const correct = answers.filter(a => a.correct).length
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

  _syncToServer(danli, egg) {
    let uid = wx.getStorageSync('crayxus_uid')
    if (!uid) {
      uid = 'wx-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      wx.setStorageSync('crayxus_uid', uid)
    }
    const courses = wx.getStorageSync('crayxus_academy') || {}
    wx.request({
      url: app.globalData.serverUrl + '/api/progress',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        userId: uid,
        data: { danli, egg, courses, source: 'miniprogram' }
      }
    })
  },

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
})
