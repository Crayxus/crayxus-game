const { getSubject } = require('../scoreboost/subjects/index.js')
const app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    subjectId: 'ielts',
    subjectName: '雅思',
    items: [],
    total: 0,
    todayReview: 0,
    mastered: 0,
    dimDist: [],
    // 详情面板
    detailOpen: false,
    detailItem: null,
    aiExplanation: '',
    aiExplainLoading: false,
    aieTtsLoading: false,
    aieTtsPlaying: false
  },

  onLoad(opts) {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}

    const subjectId = opts.subject || wx.getStorageSync('sb_current_subject') || 'ielts'
    this.setData({ subjectId })
  },

  onShow() {
    this.loadWrongBook()
  },

  loadWrongBook() {
    const subjectId = this.data.subjectId
    const subject = getSubject(subjectId)
    if (!subject) return
    const storageKey = `crayxus_wrongbook_${subjectId}`
    const data = wx.getStorageSync(storageKey) || { items: [] }
    const rawItems = data.items || []

    const dimMap = {}
    subject.DIMS.forEach(d => { dimMap[d.key] = d })

    const now = Date.now()
    const ONE_DAY = 86400 * 1000

    const items = rawItems.map(it => {
      const dim = dimMap[it.dim] || { name: '其他', color: '#888' }
      const age = now - (it.wrongAt || now)
      return {
        ...it,
        dimName: dim.name,
        dimColor: dim.color,
        qShort: (it.q || '').slice(0, 80) + ((it.q || '').length > 80 ? '...' : ''),
        whenText: this._relTime(it.wrongAt),
        ageDay: age / ONE_DAY,
        attempts: it.attempts || 1
      }
    }).sort((a, b) => (b.wrongAt || 0) - (a.wrongAt || 0))

    // 维度分布
    const dimCount = {}
    items.forEach(it => { dimCount[it.dim] = (dimCount[it.dim] || 0) + 1 })
    const maxCount = Math.max(1, ...Object.values(dimCount))
    const dimDist = subject.DIMS.map(d => ({
      key: d.key,
      name: d.name,
      color: d.color,
      count: dimCount[d.key] || 0,
      pct: ((dimCount[d.key] || 0) / maxCount) * 100
    })).filter(d => d.count > 0).sort((a, b) => b.count - a.count)

    // 今日待复习：艾宾浩斯节点 1/3/7/15 天
    const reviewDays = [1, 3, 7, 15]
    const todayReview = items.filter(it => {
      const age = it.ageDay
      return reviewDays.some(d => Math.abs(age - d) < 0.5)
    }).length

    // 掌握度：错 1 次以上、最近 3 天没再出现的 → 算掌握
    const mastered = items.filter(it => it.ageDay > 3 && it.attempts === 1).length

    this.setData({
      subjectName: subject.shortName || subject.name || '',
      items,
      total: items.length,
      todayReview,
      mastered,
      dimDist
    })
  },

  _relTime(ts) {
    if (!ts) return ''
    const diff = Date.now() - ts
    const m = Math.floor(diff / 60000)
    if (m < 1) return '刚刚'
    if (m < 60) return m + '分钟前'
    const h = Math.floor(m / 60)
    if (h < 24) return h + '小时前'
    const d = Math.floor(h / 24)
    if (d < 30) return d + '天前'
    return Math.floor(d / 30) + '月前'
  },

  viewItem(e) {
    const idx = e.currentTarget.dataset.idx
    const it = this.data.items[idx]
    if (!it) return
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({
      detailOpen: true,
      detailItem: it,
      aiExplanation: '',
      aiExplainLoading: false
    })
    this._aiExplainCache = {}
  },

  closeDetail() {
    this._stopAieTts()
    this.setData({ detailOpen: false, aiExplanation: '', aiExplainLoading: false })
  },

  _noop() {},

  askAIExplain() {
    try {
      const it = this.data.detailItem
      if (!it) return
      this.setData({ aiExplainLoading: true, aiExplanation: '' })
      const serverUrl = (app && app.globalData && app.globalData.serverUrl) || 'https://crayxus-game.onrender.com'
      wx.request({
        url: serverUrl + '/api/ai/ielts/explain-wrong',
        method: 'POST',
        data: {
          q: it.q,
          options: it.options,
          correctAnswer: it.answer,
          userAnswer: it.selected,
          dim: it.dimName,
          solution: it.solution || ''
        },
        timeout: 45000,
        success: (r) => {
          const d = r.data
          if (d && d.ok && d.explanation) {
            this.setData({ aiExplanation: d.explanation, aiExplainLoading: false })
            this._aieTempPath = null  // 新讲解需要新 TTS
          } else {
            this.setData({ aiExplainLoading: false })
            wx.showToast({ title: 'AI 暂时繁忙，稍后再试', icon: 'none' })
          }
        },
        fail: () => {
          this.setData({ aiExplainLoading: false })
          wx.showToast({ title: '网络异常', icon: 'none' })
        }
      })
    } catch(e) { console.warn('[askAIExplain]', e); this.setData({ aiExplainLoading: false }) }
  },

  playAIExplainTTS() {
    try {
      const text = this.data.aiExplanation
      if (!text) return
      if (this.data.aieTtsPlaying && this._aieAudioCtx) {
        this._aieAudioCtx.pause()
        this.setData({ aieTtsPlaying: false })
        return
      }
      if (this._aieTempPath) {
        this._playAieFromPath(this._aieTempPath)
        return
      }
      this.setData({ aieTtsLoading: true })
      const serverUrl = (app && app.globalData && app.globalData.serverUrl) || 'https://crayxus-game.onrender.com'
      wx.request({
        url: serverUrl + '/api/ai/ielts/tts',
        method: 'POST',
        data: { text, voice: 'zh-female' },
        timeout: 30000,
        success: (r) => {
          const d = r.data
          if (d && d.ok && d.audio) {
            this._writeAieAndPlay(d.audio)
          } else {
            this.setData({ aieTtsLoading: false })
            wx.showToast({ title: '语音暂不可用', icon: 'none' })
          }
        },
        fail: () => { this.setData({ aieTtsLoading: false }) }
      })
    } catch(e) { this.setData({ aieTtsLoading: false }) }
  },

  _writeAieAndPlay(dataUri) {
    try {
      const m = dataUri.match(/^data:audio\/(\w+);base64,(.*)$/)
      if (!m) { this.setData({ aieTtsLoading: false }); return }
      const ext = m[1] === 'mpeg' ? 'mp3' : m[1]
      const fs = wx.getFileSystemManager()
      const tempPath = `${wx.env.USER_DATA_PATH}/aie_${Date.now()}.${ext}`
      fs.writeFile({
        filePath: tempPath,
        data: m[2],
        encoding: 'base64',
        success: () => {
          this._aieTempPath = tempPath
          this.setData({ aieTtsLoading: false })
          this._playAieFromPath(tempPath)
        },
        fail: () => { this.setData({ aieTtsLoading: false }) }
      })
    } catch(e) { this.setData({ aieTtsLoading: false }) }
  },

  _playAieFromPath(path) {
    try {
      this._stopAieTts()
      const ctx = wx.createInnerAudioContext()
      ctx.src = path
      ctx.onPlay(() => this.setData({ aieTtsPlaying: true }))
      ctx.onPause(() => this.setData({ aieTtsPlaying: false }))
      ctx.onEnded(() => this.setData({ aieTtsPlaying: false }))
      ctx.onError(() => this.setData({ aieTtsPlaying: false }))
      this._aieAudioCtx = ctx
      ctx.play()
    } catch(e) {}
  },

  _stopAieTts() {
    if (this._aieAudioCtx) {
      try { this._aieAudioCtx.stop(); this._aieAudioCtx.destroy() } catch(e) {}
      this._aieAudioCtx = null
    }
    this.setData({ aieTtsPlaying: false })
  },

  onUnload() {
    this._stopAieTts()
  },

  clearAll() {
    if (this.data.total === 0) return
    wx.showModal({
      title: '清空错题本？',
      content: `将永久删除 ${this.data.total} 道错题。`,
      confirmColor: '#ff6b6b',
      success: (r) => {
        if (r.confirm) {
          const key = `crayxus_wrongbook_${this.data.subjectId}`
          wx.removeStorageSync(key)
          this.loadWrongBook()
          wx.showToast({ title: '已清空', icon: 'success' })
        }
      }
    })
  },

  battleAgain() {
    if (this.data.total === 0) return
    wx.showToast({ title: '功能即将上线', icon: 'none' })
  }
})
