// 10 题 AI 匹配度测评问卷（{{subject}} 会在 onLoad 里被实际学科替换）
const QUESTIONS = [
  {
    dim: '学习动机',
    title: '面对一道从未见过的 {{subject}}难题，你的第一反应是？',
    options: [
      { text: '立刻尝试解答，喜欢挑战', score: 5 },
      { text: '先通读题目理清思路',       score: 4 },
      { text: '跳过先做简单的',          score: 3 },
      { text: '感觉有点畏难',            score: 2 }
    ]
  },
  {
    dim: '时间投入',
    title: '每周你能拿出多少时间专门用于提分课程？',
    options: [
      { text: '10 小时以上',   score: 5 },
      { text: '5 – 10 小时',   score: 4 },
      { text: '2 – 5 小时',    score: 3 },
      { text: '不确定或很少',  score: 2 }
    ]
  },
  {
    dim: '自驱力',
    title: '学习时遇到难题，你更倾向于？',
    options: [
      { text: '独立思考直到解决',   score: 5 },
      { text: '搜索网上资料自学',   score: 4 },
      { text: '请教老师或同学',     score: 4 },
      { text: '先标记后跳过',       score: 3 }
    ]
  },
  {
    dim: '专注耐力',
    title: '你做题时连续专注能持续多久？',
    options: [
      { text: '1 小时以上',          score: 5 },
      { text: '30 – 60 分钟',        score: 4 },
      { text: '15 – 30 分钟',        score: 3 },
      { text: '不到 15 分钟',        score: 2 }
    ]
  },
  {
    dim: '竞争意识',
    title: '看到同学考得比你好，你会？',
    options: [
      { text: '非常在意，想超过对方',  score: 5 },
      { text: '分析差距，改进方法',    score: 5 },
      { text: '觉得各有所长',          score: 3 },
      { text: '不太关注排名',          score: 2 }
    ]
  },
  {
    dim: '奖励敏感',
    title: '对"每月 Top 3 免费使用"的机制你感兴趣吗？',
    options: [
      { text: '非常期待，会全力争取',  score: 5 },
      { text: '感兴趣，会努力试试',    score: 4 },
      { text: '如果机会合适会参与',    score: 3 },
      { text: '无所谓',                score: 2 }
    ]
  },
  {
    dim: '计划性',
    title: '考试前一周你通常？',
    options: [
      { text: '提前制定详细复习计划',  score: 5 },
      { text: '重点复习薄弱知识点',    score: 4 },
      { text: '加大练习题量',          score: 4 },
      { text: '临时抱佛脚',            score: 2 }
    ]
  },
  {
    dim: '数据倾向',
    title: '你更愿意接受哪种学习反馈？',
    options: [
      { text: '详细数据 + AI 建议',     score: 5 },
      { text: '老师口头点评',           score: 4 },
      { text: '同学互相讨论',           score: 3 },
      { text: '自己看结果就行',         score: 2 }
    ]
  },
  {
    dim: '纠错执行',
    title: '如果 AI 告诉你某个知识点薄弱，你会？',
    options: [
      { text: '立刻针对性练习',        score: 5 },
      { text: '制定补强计划',          score: 5 },
      { text: '找时间再看',            score: 3 },
      { text: '觉得影响不大',          score: 2 }
    ]
  },
  {
    dim: '长期承诺',
    title: '你希望提分系统陪你多久？',
    options: [
      { text: '到出国 / 毕业为止',      score: 5 },
      { text: '至少一个学年',           score: 4 },
      { text: '一个学期试试',           score: 3 },
      { text: '看效果再说',             score: 2 }
    ]
  }
]

const app = getApp()

const AI_MESSAGES = [
  '启动 Crayxus AI 大模型...',
  '读取你的雅思备考画像...',
  '生成 10 道学习人格题...',
  'Crayxus AI 审核题目质量...',
  '即将完成，准备就绪...'
]

Page({
  data: {
    totalQuestions: QUESTIONS.length,
    currentIdx: 0,
    currentQuestion: null,
    selectedOption: null,
    answers: [],
    progress: 10,
    finished: false,
    letters: ['A', 'B', 'C', 'D'],
    subjectName: '',
    // AI loading
    aiLoading: false,
    aiProgress: 0,
    aiMessage: '初始化中...'
  },

  onLoad(options) {
    try { wx.vibrateShort && wx.vibrateShort({ type: 'light' }) } catch(e) {}
    const subjectName = (options && options.subject) ? decodeURIComponent(options.subject) : ''
    const subjectId = (options && options.subjectId) ? options.subjectId : ''
    this.setData({ subjectName })

    // 雅思 → 调 DeepSeek 实时生成匹配度题
    if (subjectId === 'ielts' || subjectName === '雅思') {
      this._fetchAIMatchQuestions(subjectName)
    } else {
      // 其他学科用本地题库
      this._localQuestions = this._interpolateSubject(subjectName)
      this.setData({
        currentQuestion: this._localQuestions[0],
        progress: Math.round((1 / QUESTIONS.length) * 100)
      })
    }
  },

  // 假进度条：0-95% 平滑逼近，100% 在收到数据时跳
  _startFakeProgress() {
    this.setData({ aiLoading: true, aiProgress: 0, aiMessage: AI_MESSAGES[0] })
    let p = 0
    let msgIdx = 0
    this._progressTimer = setInterval(() => {
      // 非线性逼近：前快后慢
      if (p < 25) p += 1.8
      else if (p < 55) p += 0.7
      else if (p < 80) p += 0.35
      else if (p < 92) p += 0.12
      else if (p < 95) p += 0.03
      if (p > 95) p = 95
      // 消息轮换
      const newIdx = Math.min(AI_MESSAGES.length - 1, Math.floor(p / 20))
      if (newIdx !== msgIdx) {
        msgIdx = newIdx
        this.setData({ aiMessage: AI_MESSAGES[msgIdx] })
      }
      this.setData({ aiProgress: Math.round(p) })
    }, 180)
  },

  _finishProgress(cb) {
    // 收到数据，快速跳到 100
    if (this._progressTimer) { clearInterval(this._progressTimer); this._progressTimer = null }
    this.setData({ aiProgress: 100, aiMessage: '分析完成 ✓' })
    setTimeout(() => {
      this.setData({ aiLoading: false })
      cb && cb()
    }, 450)
  },

  _fetchAIMatchQuestions(subjectName) {
    this._startFakeProgress()
    const serverUrl = (app && app.globalData && app.globalData.serverUrl) || 'https://crayxus-game.onrender.com'
    wx.request({
      url: serverUrl + '/api/ai/ielts/match',
      method: 'POST',
      data: {},
      timeout: 50000,
      success: (r) => {
        const d = r.data
        if (d && d.ok && Array.isArray(d.questions) && d.questions.length >= 8) {
          // 用 AI 题替换本地题库
          const aiQuestions = d.questions.map(q => ({
            dim: q.dim,
            title: q.title,
            options: q.options
          }))
          this._localQuestions = aiQuestions
          this._finishProgress(() => {
            this.setData({
              totalQuestions: aiQuestions.length,
              currentQuestion: aiQuestions[0],
              progress: Math.round((1 / aiQuestions.length) * 100)
            })
          })
        } else {
          this._fallbackToLocal(subjectName)
        }
      },
      fail: () => this._fallbackToLocal(subjectName)
    })
  },

  _fallbackToLocal(subjectName) {
    this._localQuestions = this._interpolateSubject(subjectName)
    this._finishProgress(() => {
      this.setData({
        currentQuestion: this._localQuestions[0],
        progress: Math.round((1 / QUESTIONS.length) * 100)
      })
      wx.showToast({ title: 'AI 繁忙，使用本地题库', icon: 'none', duration: 1500 })
    })
  },

  onUnload() {
    if (this._progressTimer) clearInterval(this._progressTimer)
  },

  // 把 {{subject}} 占位符替换成当前学科
  _interpolateSubject(subjectName) {
    const label = subjectName ? (subjectName + ' ') : ''
    return QUESTIONS.map(q => ({
      ...q,
      title: q.title.replace(/\{\{subject\}\}/g, label),
      options: q.options.slice()
    }))
  },

  selectOption(e) {
    try {
      const idx = e.currentTarget.dataset.idx
      this.setData({ selectedOption: idx })
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    } catch(e) {}
  },

  nextQuestion() {
    try {
      if (this.data.selectedOption === null) return
      const answers = this.data.answers.slice()
      answers[this.data.currentIdx] = this.data.selectedOption

      if (this.data.currentIdx < this.data.totalQuestions - 1) {
        const nextIdx = this.data.currentIdx + 1
        this.setData({
          answers,
          currentIdx: nextIdx,
          currentQuestion: this._localQuestions[nextIdx],
          selectedOption: answers[nextIdx] !== undefined ? answers[nextIdx] : null,
          progress: Math.round(((nextIdx + 1) / this.data.totalQuestions) * 100)
        })
      } else {
        // 最后一题 → 生成报告
        this.setData({ answers, finished: true, progress: 100 })
        this._generateResult(answers)
      }
    } catch(e) { console.warn('[nextQuestion]', e) }
  },

  prevQuestion() {
    try {
      if (this.data.currentIdx === 0) return
      const prevIdx = this.data.currentIdx - 1
      this.setData({
        currentIdx: prevIdx,
        currentQuestion: this._localQuestions[prevIdx],
        selectedOption: this.data.answers[prevIdx] !== undefined ? this.data.answers[prevIdx] : null,
        progress: Math.round(((prevIdx + 1) / this.data.totalQuestions) * 100)
      })
    } catch(e) {}
  },

  _generateResult(answers) {
    try {
      // 计算原始总分：10 题 × 最低 2 分～最高 5 分 = 20-50
      let rawScore = 0
      for (let i = 0; i < answers.length; i++) {
        const optIdx = answers[i]
        rawScore += QUESTIONS[i].options[optIdx].score
      }
      // 归一化到 40-100 显示区间
      const score = Math.min(100, Math.max(40, Math.round((rawScore / 50) * 100)))

      // 判定学习型人格
      let personality
      if (score >= 88) personality = '策略型学习者'
      else if (score >= 78) personality = '逻辑型学习者'
      else if (score >= 68) personality = '均衡型学习者'
      else personality = '探索型学习者'

      // 推荐方案
      const recommendPlan = score >= 85 ? '年付方案' : score >= 70 ? '季度付方案' : '月付方案'
      const subjects = ['AP · SAT', 'AP · A-Level', 'IB · SAT', 'A-Level · IGCSE']
      const recommendSubject = subjects[Math.floor(Math.random() * subjects.length)]
      const boostPotential = score >= 85 ? '强' : score >= 70 ? '中' : '弱'

      const result = {
        done: true,
        score,
        personality,
        recommendPlan,
        recommendSubject,
        boostPotential,
        testedAt: new Date().toISOString().slice(0, 10)
      }

      // 写入缓存
      try { wx.setStorageSync('crayxus_prescreen', result) } catch(e) {}

      // 2 秒后跳到报告页
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/pre-screen/pre-screen' })
      }, 2200)
    } catch(e) { console.warn('[generateResult]', e) }
  }
})
