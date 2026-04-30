const { getSubject, listTopSubjects, listBasisChildren } = require('./subjects/index.js')

const CURRENT_KEY = 'sb_current_subject'
const VIEW_KEY = 'sb_view_state'  // 'top' | 'basis'
const storageKeyOf = (subjectId) => `sb_progress__${subjectId}`

Page({
  data: {
    statusBarHeight: 44,
    viewState: 'top',            // 'top' = 顶层六宫格, 'basis' = 贝赛思子学科
    currentSubjectId: 'sat',
    currentSubject: null,
    subjectList: [],             // 当前展示的宫格列表
    basisChildren: [],
    hasHistory: false,
    stats: { weekGain: 0, streak: 0, accuracy: 0, totalDone: 0, baseline: 0, latest: 0 },
    dims: [],
    weakness: [],
    curve: [],
    recentHistory: [],

    // 账号状态（示例数据 · 后端接入前占位）
    account: {
      statusKey: 'paid-quarter',    // 'star' | 'paid-month' | 'paid-quarter' | 'paid-year' | 'trial'
      statusText: '已付费',
      planText: '季度付 · ¥499/科/季',
      subjectsText: '已订阅 3 科 · AP数学 · AP物理 · SAT',
      school: '光华国际高中',
      className: '10 年级 2 班',
      expireText: '有效期至 2026-07-31 · 本季总额 ¥1,497'
    },

    // 月度冲榜排行（示例数据 · 前3真名 · 其余匿名保护）
    ranking: {
      monthLabel: '2026 年 4 月',
      daysLeft: 7,
      myRank: 5,
      totalStudents: 32,
      gapToTop3: 12,
      questionsToGo: 40,
      leaderboard: [
        { rank: 1, displayName: '陈嘉慧',      score: 92, gain: 18, isMe: false },
        { rank: 2, displayName: '林若曦',      score: 88, gain: 15, isMe: false },
        { rank: 3, displayName: '王子墨',      score: 85, gain: 12, isMe: false },
        { rank: 4, displayName: '***',    score: 78, gain: 9,  isMe: false },
        { rank: 5, displayName: '张小明（你）', score: 73, gain: 6,  isMe: true  },
        { rank: 6, displayName: '***',    score: 71, gain: 4,  isMe: false },
        { rank: 7, displayName: '***',    score: 68, gain: 3,  isMe: false },
      ]
    },

    // AI 匹配度引擎 · 预诊断结果（默认未测评，完成后写入本地缓存）
    prescreen: {
      done: false,
      score: 0,
      personality: '',
      recommendPlan: '',
      recommendSubject: '',
      boostPotential: '',
      testedAt: ''
    },
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}

    const savedId = wx.getStorageSync(CURRENT_KEY)
    const savedView = wx.getStorageSync(VIEW_KEY)
    let subjectId = savedId || 'sat'
    // 若恢复的是 'basis' 组，回到顶层让用户重新选
    const subj = getSubject(subjectId)
    if (subj.isGroup) {
      subjectId = 'sat'
    }
    this.setData({
      currentSubjectId: subjectId,
      currentSubject: getSubject(subjectId),
      viewState: savedView === 'basis' ? 'basis' : 'top'
    })
  },

  onShow() {
    this.refreshSubjectLists()
    this.loadProgress()
    this.loadPrescreen()
  },

  // 从本地缓存加载预诊断结果
  loadPrescreen() {
    try {
      const saved = wx.getStorageSync('crayxus_prescreen')
      if (saved && saved.done) {
        this.setData({ prescreen: saved })
      }
    } catch(e) { console.warn('[loadPrescreen]', e) }
  },

  refreshSubjectLists() {
    const addScore = (s) => {
      if (s.isGroup) {
        // 组：显示子学科中最高分
        const children = listBasisChildren()
        const scores = children.map(c => {
          const p = wx.getStorageSync(storageKeyOf(c.id)) || { history: [] }
          return p.history && p.history.length > 0 ? p.history[p.history.length - 1].score : null
        }).filter(x => x != null)
        return { ...s, score: scores.length > 0 ? Math.max(...scores) : null }
      }
      const prog = wx.getStorageSync(storageKeyOf(s.id)) || { history: [] }
      const latest = prog.history && prog.history.length > 0 ? prog.history[prog.history.length - 1].score : null
      return { ...s, score: latest }
    }

    const topList = listTopSubjects().map(addScore)
    const basisList = listBasisChildren().map(addScore)
    this.setData({
      subjectList: topList,
      basisChildren: basisList
    })
  },

  selectSubject(e) {
    const id = e.currentTarget.dataset.id
    const subj = getSubject(id)

    // 点击「贝赛思课程」组 → 进入子学科视图
    if (subj.isGroup) {
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
      wx.setStorageSync(VIEW_KEY, 'basis')
      this.setData({ viewState: 'basis' })
      return
    }

    // 已是当前选中，无操作
    if (id === this.data.currentSubjectId && this.data.viewState === 'top') return

    wx.setStorageSync(CURRENT_KEY, id)
    // 若进入贝赛思子学科，视图保持 basis；否则回 top
    const isBasisChild = (subj.parentId === 'basis')
    const newView = isBasisChild ? 'basis' : 'top'
    wx.setStorageSync(VIEW_KEY, newView)
    this.setData({
      currentSubjectId: id,
      currentSubject: subj,
      viewState: newView
    })
    this.refreshSubjectLists()
    this.loadProgress()
  },

  backToTop() {
    wx.setStorageSync(VIEW_KEY, 'top')
    this.setData({ viewState: 'top' })
  },

  loadProgress() {
    const subject = this.data.currentSubject
    if (!subject || subject.isGroup) {
      this.setData({ hasHistory: false, dims: [], weakness: [], curve: [], recentHistory: [],
        stats: { weekGain: 0, streak: 0, accuracy: 0, totalDone: 0, baseline: 0, latest: 0 } })
      return
    }
    const DIMS = subject.DIMS
    const STORAGE_KEY = storageKeyOf(subject.id)
    const prog = wx.getStorageSync(STORAGE_KEY) || { history: [], mastery: {}, baseline: null }
    const history = prog.history || []
    const hasHistory = history.length > 0

    let stats = { weekGain: 0, streak: 0, accuracy: 0, totalDone: history.length, baseline: 0, latest: 0 }
    if (hasHistory) {
      const latest = history[history.length - 1]
      stats.latest = latest.score
      stats.baseline = prog.baseline != null ? prog.baseline : latest.score
      stats.weekGain = Math.max(0, latest.score - stats.baseline)
      const totalCorrect = history.reduce((a, h) => a + h.correct, 0)
      const totalQ = history.reduce((a, h) => a + h.total, 0)
      stats.accuracy = totalQ > 0 ? Math.round(totalCorrect / totalQ * 100) : 0
      const days = new Set(history.map(h => new Date(h.ts).toDateString()))
      stats.streak = days.size
    }

    const mastery = prog.mastery || {}
    const dims = DIMS.map(d => ({
      ...d,
      val: mastery[d.key] != null ? mastery[d.key] : 0
    }))

    const weakness = DIMS
      .map(d => {
        const m = mastery[d.key]
        if (m == null) return null
        const level = m < 50 ? 'high' : m < 70 ? 'mid' : 'low'
        const levelText = m < 50 ? '薄弱' : m < 70 ? '一般' : '掌握'
        return { key: d.key, topic: d.name, mastery: m, level, levelText, color: d.color }
      })
      .filter(w => w && w.level !== 'low')
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 4)

    const recent = history.slice(-7)
    const max = Math.max(60, ...recent.map(h => h.score))
    const curve = recent.map((h, i) => ({
      day: i + 1,
      score: h.score,
      h: max > 0 ? Math.round(h.score / max * 100) : 0,
      color: h.score >= 80 ? '#00d4aa' : h.score >= 60 ? '#ffd700' : '#ff6b6b'
    }))
    while (curve.length < 7) curve.unshift({ day: '-', score: 0, h: 0, color: 'rgba(255,255,255,.08)' })

    const recentHistory = history.slice(-5).reverse().map(h => ({
      ...h,
      when: this._relTime(h.ts),
      modeText: h.mode === 'assess' ? '定级测评' : '自适应训练'
    }))

    this.setData({ hasHistory, stats, dims, weakness, curve, recentHistory })
  },

  _relTime(ts) {
    const diff = Date.now() - ts
    const m = Math.floor(diff / 60000)
    if (m < 1) return '刚刚'
    if (m < 60) return m + '分钟前'
    const h = Math.floor(m / 60)
    if (h < 24) return h + '小时前'
    const d = Math.floor(h / 24)
    return d + '天前'
  },

  startAssessment() {
    if (this.data.currentSubject.isGroup) {
      wx.showToast({ title: '请先选择子学科', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/sb-quiz/sb-quiz?subject=${this.data.currentSubjectId}&mode=assess` })
  },

  startAdaptive() {
    if (this.data.currentSubject.isGroup) {
      wx.showToast({ title: '请先选择子学科', icon: 'none' })
      return
    }
    if (!this.data.hasHistory) {
      wx.showModal({
        title: '需要先完成定级',
        content: `${this.data.currentSubject.name} · AI 需要你先完成一次 20 题测评，才能针对你的弱点出题。`,
        confirmText: '开始测评',
        confirmColor: this.data.currentSubject.color,
        success: (r) => {
          if (r.confirm) this.startAssessment()
        }
      })
      return
    }
    wx.navigateTo({ url: `/pages/sb-quiz/sb-quiz?subject=${this.data.currentSubjectId}&mode=adaptive` })
  },

  // 🎯 单板块定向练习（用户指定 dim）
  practiceDim(e) {
    const dim = e.currentTarget.dataset.key
    const subjectId = this.data.currentSubjectId
    if (!dim || !subjectId) return
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    wx.navigateTo({ url: `/pages/sb-quiz/sb-quiz?subject=${subjectId}&mode=adaptive&dim=${dim}` })
  },

  practiceWeak(e) {
    const topic = e.currentTarget.dataset.topic
    const subject = this.data.currentSubject
    wx.showModal({
      title: '🎯 定向强化',
      content: `大模型将针对「${topic}」从 ${subject.name} 题库中选出最匹配你薄弱点的题目。`,
      confirmText: '开始',
      confirmColor: subject.color,
      success: (r) => {
        if (r.confirm) wx.navigateTo({ url: `/pages/sb-quiz/sb-quiz?subject=${this.data.currentSubjectId}&mode=adaptive` })
      }
    })
  },

  gotoTeacherDashboard() {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    wx.navigateTo({
      url: '/pages/teacher-dashboard/teacher-dashboard'
    })
  },

  gotoPreScreen() {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    wx.navigateTo({
      url: '/pages/pre-screen/pre-screen'
    })
  },

  gotoWrongbook() {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    wx.navigateTo({
      url: '/pages/wrongbook/wrongbook?subject=' + this.data.currentSubjectId
    })
  },

  // MATCH DRIVE · 匹配度测评
  launchMatchTest() {
    try {
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
      const ps = this.data.prescreen || {}
      if (ps.done) {
        // 已测过：提供「查看报告」或「重新测评」
        wx.showActionSheet({
          itemList: ['📊 查看我的匹配报告', '🔄 重新测评'],
          success: (res) => {
            if (res.tapIndex === 0) {
              wx.navigateTo({ url: '/pages/pre-screen/pre-screen' })
            } else if (res.tapIndex === 1) {
              this._startMatchTestFlow()
            }
          }
        })
      } else {
        wx.showModal({
          title: '◆ MATCH DRIVE · 匹配度测评',
          content: '15 题 · 5 分钟 · AI 判定你的学习型人格 + Crayxus 兼容指数 + 推荐方案',
          confirmText: '开始评估',
          confirmColor: '#ffd700',
          success: (r) => {
            if (r.confirm) this._startMatchTestFlow()
          }
        })
      }
    } catch(e) { console.warn('[launchMatchTest]', e) }
  },

  // 跳转到 10 题匹配度测评问卷页（带上学科短名 + id 以便雅思走 AI 路径）
  _startMatchTestFlow() {
    try {
      const subj = this.data.currentSubject
      const shortName = (subj && !subj.isGroup) ? (subj.shortName || subj.name || '') : ''
      const subjectId = (subj && !subj.isGroup) ? (subj.id || '') : ''
      const params = []
      if (shortName) params.push('subject=' + encodeURIComponent(shortName))
      if (subjectId) params.push('subjectId=' + encodeURIComponent(subjectId))
      const q = params.length ? '?' + params.join('&') : ''
      wx.navigateTo({ url: '/pages/pre-screen-test/pre-screen-test' + q })
    } catch(e) { console.warn('[_startMatchTestFlow]', e) }
  },

  // BOOST DRIVE · 提分测评（复用已有定级测评逻辑）
  launchBoostTest() {
    try {
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
      const subj = this.data.currentSubject
      if (!subj) {
        wx.showToast({ title: '请先选择科目', icon: 'none' })
        return
      }
      if (subj.isGroup) {
        wx.showToast({ title: '请先选择子学科', icon: 'none' })
        return
      }
      wx.showModal({
        title: '◆ BOOST DRIVE · 提分测评',
        content: `${subj.name || ''} · 20 题 · AI 自适应定级 + 6 维诊断 + 弱点分析`,
        confirmText: '开始测评',
        confirmColor: '#ff6b35',
        success: (r) => {
          if (r.confirm) {
            wx.navigateTo({ url: `/pages/sb-quiz/sb-quiz?subject=${this.data.currentSubjectId}&mode=assess` })
          }
        }
      })
    } catch(e) { console.warn('[launchBoostTest]', e) }
  },

  upgradePlan() {
    wx.showActionSheet({
      itemList: ['月付 ¥199/人/科/月', '季度付 ¥499/人/科/季（省 16%）', '年付 ¥1,680/人/科/年（省 30%）'],
      success: (res) => {
        const plans = [
          { key: 'paid-month',   text: '月付 · ¥199/科/月',  expire: '2026-05-23' },
          { key: 'paid-quarter', text: '季度付 · ¥499/科/季', expire: '2026-07-23' },
          { key: 'paid-year',    text: '年付 · ¥1,680/科/年', expire: '2027-04-23' }
        ]
        const p = plans[res.tapIndex]
        this.setData({
          'account.statusKey': p.key,
          'account.statusText': '已付费',
          'account.planText': p.text,
          'account.expireText': '有效期至 ' + p.expire
        })
        wx.showToast({ title: '已切换方案', icon: 'success' })
      }
    })
  },

  resetProgress() {
    const subject = this.data.currentSubject
    wx.showModal({
      title: `清除 ${subject.shortName} 进度`,
      content: `确定要清除「${subject.name}」的所有学习记录？其他科目不受影响。`,
      confirmColor: '#ff6b6b',
      success: (r) => {
        if (r.confirm) {
          wx.removeStorageSync(storageKeyOf(subject.id))
          this.refreshSubjectLists()
          this.loadProgress()
          wx.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  }
})
