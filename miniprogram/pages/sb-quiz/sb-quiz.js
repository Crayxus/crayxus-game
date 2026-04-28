const { getSubject } = require('../scoreboost/subjects/index.js')
const app = getApp()

const storageKeyOf = (subjectId) => `sb_progress__${subjectId}`

Page({
  data: {
    statusBarHeight: 44,
    subjectId: 'sat',
    subject: null,
    mode: 'assess',
    total: 20,
    currentIdx: 0,
    currentQ: null,
    selectedIdx: null,
    showResult: false,
    progressPct: 0,
    questions: [],
    answers: [],
    finished: false,
    totalScore: 0,
    correctCount: 0,
    gain: 0,
    dimResults: [],
    weakDimKey: null,
    weakDimName: null,
    dimMap: {},
    aiLoading: false,
    aiProgress: 0,
    aiMessage: '',
    aiBadge: false,
    // 听力音频
    audioLoading: false,
    audioPlaying: false,
    audioLoaded: false,
    showSubtitle: false,
    showTranslation: false,
    audioCache: {},    // qid → audio URL
    // 奖励 + 生词本
    correctStreak: 0,
    rewardOpen: false,
    rewardItem: null,
    boxOpen: false,
    vocabSaved: {}    // qid → bool
  },

  onToggleTranslation() {
    this.setData({ showTranslation: !this.data.showTranslation })
  },

  // 📚 收藏到生词本
  onSaveVocab() {
    try {
      const q = this.data.currentQ
      if (!q) return
      const KEY = 'crayxus_vocab_book'
      const vb = wx.getStorageSync(KEY) || { items: [] }
      const exists = vb.items.find(x => x.id === q.id)
      if (exists) {
        wx.showToast({ title: '已在生词本', icon: 'none' })
        return
      }
      vb.items.unshift({
        id: q.id,
        dim: q.dim,
        q: q.q,
        q_zh: q.q_zh || '',
        solution: q.solution || '',
        savedAt: Date.now()
      })
      vb.items = vb.items.slice(0, 500)
      wx.setStorageSync(KEY, vb)
      const vs = { ...this.data.vocabSaved, [q.id]: true }
      this.setData({ vocabSaved: vs })
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
      wx.showToast({ title: '✓ 已加入生词本', icon: 'none' })
    } catch(e) { console.warn('[saveVocab]', e) }
  },

  // 🎁 抽盲盒（连对 3 题触发）
  _maybeOpenReward() {
    if (this.data.correctStreak < 3) return
    const rewards = [
      { type: 'token', icon: '⚡', label: '蛋力 +10', value: 10, rare: false },
      { type: 'token', icon: '⚡', label: '蛋力 +5',  value: 5,  rare: false },
      { type: 'token', icon: '💎', label: '蛋力 +20', value: 20, rare: true },
      { type: 'card',  icon: '🃏', label: '专注卡 · 罕见', value: 0, rare: true },
      { type: 'card',  icon: '🎴', label: '智慧卡 · 普通', value: 0, rare: false },
      { type: 'praise',icon: '🌟', label: '"再连 3 题继续抽！"', value: 0, rare: false }
    ]
    const isRareRoll = Math.random() < 0.18  // 18% rare
    const pool = rewards.filter(r => r.rare === isRareRoll)
    const item = pool[Math.floor(Math.random() * pool.length)]
    this.setData({ rewardItem: item, rewardOpen: true, boxOpen: false, correctStreak: 0 })
    wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
    // 累加蛋力
    if (item.type === 'token' && item.value) {
      try {
        const k = 'crayxus_token_balance'
        const cur = wx.getStorageSync(k) || 0
        wx.setStorageSync(k, cur + item.value)
      } catch(e) {}
    }
  },

  onOpenBox() {
    this.setData({ boxOpen: true })
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
  },

  closeReward() {
    this.setData({ rewardOpen: false, rewardItem: null, boxOpen: false })
  },

  onLoad(opts) {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}

    const subjectId = opts.subject || wx.getStorageSync('sb_current_subject') || 'sat'
    const subject = getSubject(subjectId)
    const DIMS = subject.DIMS
    const dimMap = {}
    DIMS.forEach(d => { dimMap[d.key] = d })

    const mode = opts.mode === 'adaptive' ? 'adaptive' : 'assess'

    // 🧠 雅思全部走 DeepSeek V4（assess 定级 + adaptive 自适应）
    if (subjectId === 'ielts') {
      if (mode === 'assess') {
        this._loadAIAssessIELTS(subject, dimMap, mode, subjectId)
      } else {
        this._loadAIQuestionsForIELTS(subject, dimMap, mode, subjectId)
      }
      return
    }

    // 其他科目 → 用本地题库
    let questions
    if (mode === 'assess') {
      questions = subject.QUESTION_BANK.slice(0, 20)
    } else {
      const prog = wx.getStorageSync(storageKeyOf(subjectId)) || {}
      const mastery = prog.mastery || {}
      questions = subject.pickAdaptive(mastery, 10)
    }

    this._initQuestions(questions, subject, dimMap, mode, subjectId, false)
  },

  _AI_MESSAGES_ASSESS: [
    '启动 Crayxus AI 命题引擎...',
    '覆盖雅思 6 大维度...',
    '混合难度梯度（简单/中等/进阶）...',
    'Crayxus AI 校对题目与答案...',
    '即将完成，准备就绪...'
  ],

  _AI_MESSAGES_ADAPTIVE: [
    '分析你的薄弱维度...',
    '定位你的 Band 水平...',
    'Crayxus AI 定制专属强化题目...',
    'Crayxus AI 校对质量...',
    '即将完成，准备就绪...'
  ],

  _startAIProgress(messages) {
    this.setData({ aiLoading: true, aiProgress: 0, aiMessage: messages[0] })
    let p = 0, idx = 0
    this._progressTimer = setInterval(() => {
      if (p < 25) p += 1.8
      else if (p < 55) p += 0.7
      else if (p < 80) p += 0.35
      else if (p < 92) p += 0.12
      else if (p < 95) p += 0.03
      if (p > 95) p = 95
      const newIdx = Math.min(messages.length - 1, Math.floor(p / 20))
      if (newIdx !== idx) { idx = newIdx; this.setData({ aiMessage: messages[idx] }) }
      this.setData({ aiProgress: Math.round(p) })
    }, 180)
  },

  _finishAIProgress(cb) {
    if (this._progressTimer) { clearInterval(this._progressTimer); this._progressTimer = null }
    this.setData({ aiProgress: 100, aiMessage: '生成完成 ✓' })
    setTimeout(() => {
      this.setData({ aiLoading: false })
      cb && cb()
    }, 450)
  },

  onUnload() {
    if (this._progressTimer) clearInterval(this._progressTimer)
    if (this._audioCtx) { try { this._audioCtx.destroy() } catch(e) {} this._audioCtx = null }
  },

  // 🔊 听力音频：播放/暂停切换
  onToggleAudio() {
    try {
      const q = this.data.currentQ
      if (!q || q.dim !== 'listening' || !q.audio_script) return

      // 已在播放 → 暂停
      if (this.data.audioPlaying && this._audioCtx) {
        this._audioCtx.pause()
        return
      }

      // 对话题：分段男女声播放
      if (q.audio_speaker === 'dialogue' && Array.isArray(q.audio_segments) && q.audio_segments.length >= 2) {
        const cachedPaths = this.data.audioCache[q.id]
        if (cachedPaths && Array.isArray(cachedPaths)) {
          this._playSegmentsSequential(cachedPaths)
          return
        }
        this.setData({ audioLoading: true })
        this._fetchAllSegments(q)
        return
      }

      // 单声道：单段播放
      const cachedPath = this.data.audioCache[q.id]
      if (cachedPath && typeof cachedPath === 'string') {
        this._playAudioFromPath(cachedPath)
        return
      }

      // 首次播放 → 请求 TTS
      this.setData({ audioLoading: true })
      const serverUrl = (app && app.globalData && app.globalData.serverUrl) || 'https://crayxus-game.onrender.com'
      const voice = 'us-female'
      wx.request({
        url: serverUrl + '/api/ai/ielts/tts',
        method: 'POST',
        data: { text: q.audio_script, voice },
        timeout: 30000,
        success: (r) => {
          const d = r.data
          if (d && d.ok && d.audio) {
            this._writeAndPlay(q.id, d.audio)
          } else {
            this.setData({ audioLoading: false })
            wx.showToast({ title: d && d.error === 'tts_not_configured' ? 'TTS 未配置 · 点击字幕查看' : '音频加载失败', icon: 'none', duration: 2000 })
            if (!this.data.showSubtitle) this.setData({ showSubtitle: true })
          }
        },
        fail: () => {
          this.setData({ audioLoading: false })
          wx.showToast({ title: '网络错误，可看字幕', icon: 'none' })
          if (!this.data.showSubtitle) this.setData({ showSubtitle: true })
        }
      })
    } catch(e) { console.warn('[onToggleAudio]', e) }
  },

  // 对话题：依次请求所有段落 TTS
  _fetchAllSegments(q) {
    const serverUrl = (app && app.globalData && app.globalData.serverUrl) || 'https://crayxus-game.onrender.com'
    const segs = q.audio_segments
    const paths = new Array(segs.length)
    let done = 0, failed = false

    segs.forEach((seg, idx) => {
      wx.request({
        url: serverUrl + '/api/ai/ielts/tts',
        method: 'POST',
        data: { text: seg.text, voice: seg.voice || 'us-female' },
        timeout: 30000,
        success: (r) => {
          const d = r.data
          if (d && d.ok && d.audio) {
            const m = d.audio.match(/^data:audio\/(\w+);base64,(.*)$/)
            if (!m) { failed = true; return }
            const ext = m[1] === 'mpeg' ? 'mp3' : m[1]
            const fs = wx.getFileSystemManager()
            const tempPath = `${wx.env.USER_DATA_PATH}/tts_${q.id}_seg${idx}_${Date.now()}.${ext}`
            fs.writeFile({
              filePath: tempPath, data: m[2], encoding: 'base64',
              success: () => {
                paths[idx] = tempPath
                done++
                if (done === segs.length && !failed) {
                  const newCache = { ...this.data.audioCache, [q.id]: paths }
                  this.setData({ audioCache: newCache, audioLoading: false, audioLoaded: true })
                  this._playSegmentsSequential(paths)
                }
              },
              fail: () => { failed = true; this.setData({ audioLoading: false }) }
            })
          } else {
            failed = true
            this.setData({ audioLoading: false })
            wx.showToast({ title: '音频加载失败', icon: 'none' })
          }
        },
        fail: () => {
          failed = true
          this.setData({ audioLoading: false })
          wx.showToast({ title: '网络异常', icon: 'none' })
        }
      })
    })
  },

  _playSegmentsSequential(paths) {
    if (!paths || paths.length === 0) return
    if (this._audioCtx) { try { this._audioCtx.destroy() } catch(e){} this._audioCtx = null }
    let idx = 0
    const playNext = () => {
      if (idx >= paths.length) {
        this.setData({ audioPlaying: false })
        return
      }
      const ctx = wx.createInnerAudioContext()
      ctx.src = paths[idx]
      ctx.onPlay(() => this.setData({ audioPlaying: true }))
      ctx.onEnded(() => {
        try { ctx.destroy() } catch(e){}
        idx++
        playNext()
      })
      ctx.onError(() => {
        try { ctx.destroy() } catch(e){}
        this.setData({ audioPlaying: false })
      })
      this._audioCtx = ctx
      ctx.play()
    }
    playNext()
  },

  _writeAndPlay(qid, dataUri) {
    try {
      const m = dataUri.match(/^data:audio\/(\w+);base64,(.*)$/)
      if (!m) {
        this.setData({ audioLoading: false })
        return wx.showToast({ title: '音频格式错误', icon: 'none' })
      }
      const ext = m[1] === 'mpeg' ? 'mp3' : m[1]
      const base64Data = m[2]
      const fs = wx.getFileSystemManager()
      const tempPath = `${wx.env.USER_DATA_PATH}/tts_${qid}_${Date.now()}.${ext}`
      fs.writeFile({
        filePath: tempPath,
        data: base64Data,
        encoding: 'base64',
        success: () => {
          const newCache = { ...this.data.audioCache, [qid]: tempPath }
          this.setData({ audioCache: newCache, audioLoading: false, audioLoaded: true })
          this._playAudioFromPath(tempPath)
        },
        fail: (err) => {
          console.warn('[writeFile fail]', err)
          this.setData({ audioLoading: false })
          wx.showToast({ title: '音频保存失败', icon: 'none' })
        }
      })
    } catch(e) {
      console.warn('[_writeAndPlay]', e)
      this.setData({ audioLoading: false })
    }
  },

  _playAudio(url) {
    try {
      // WeChat 不支持 data:audio/mp3;base64,... 直接播放
      // → 把 base64 写到临时文件，再用文件路径播放（这是微信官方推荐方式）
      if (url.startsWith('data:audio/')) {
        const m = url.match(/^data:audio\/(\w+);base64,(.*)$/)
        if (!m) return wx.showToast({ title: '音频格式错误', icon: 'none' })
        const ext = m[1] === 'mpeg' ? 'mp3' : m[1]
        const base64Data = m[2]
        const fs = wx.getFileSystemManager()
        const tempPath = `${wx.env.USER_DATA_PATH}/tts_${Date.now()}.${ext}`
        fs.writeFile({
          filePath: tempPath,
          data: base64Data,
          encoding: 'base64',
          success: () => {
            this._playAudioFromPath(tempPath)
          },
          fail: (err) => {
            console.warn('[writeFile fail]', err)
            wx.showToast({ title: '音频保存失败', icon: 'none' })
          }
        })
      } else {
        this._playAudioFromPath(url)
      }
    } catch(e) { console.warn('[_playAudio]', e) }
  },

  _playAudioFromPath(path) {
    try {
      if (this._audioCtx) { try { this._audioCtx.destroy() } catch(e){} }
      const ctx = wx.createInnerAudioContext()
      ctx.src = path
      ctx.onPlay(() => this.setData({ audioPlaying: true }))
      ctx.onPause(() => this.setData({ audioPlaying: false }))
      ctx.onEnded(() => this.setData({ audioPlaying: false }))
      ctx.onStop(() => this.setData({ audioPlaying: false }))
      ctx.onError((err) => {
        console.warn('[audio error]', err)
        this.setData({ audioPlaying: false })
        wx.showToast({ title: '播放失败，请重试', icon: 'none' })
      })
      this._audioCtx = ctx
      ctx.play()
    } catch(e) { console.warn('[_playAudioFromPath]', e) }
  },

  onToggleSubtitle() {
    this.setData({ showSubtitle: !this.data.showSubtitle })
  },

  // 雅思 · 定级测评 · 调 DeepSeek V4
  _loadAIAssessIELTS(subject, dimMap, mode, subjectId) {
    this._startAIProgress(this._AI_MESSAGES_ASSESS)
    const serverUrl = (app && app.globalData && app.globalData.serverUrl) || 'https://crayxus-game.onrender.com'
    wx.request({
      url: serverUrl + '/api/ai/ielts/assess',
      method: 'POST',
      data: {},
      timeout: 60000,
      success: (r) => {
        const d = r.data
        if (d && d.ok && Array.isArray(d.questions) && d.questions.length >= 15) {
          this._finishAIProgress(() => {
            this._initQuestions(d.questions, subject, dimMap, mode, subjectId, true)
          })
        } else {
          console.warn('[AI-ASSESS] fallback', d)
          this._finishAIProgress(() => {
            this._initQuestions(subject.QUESTION_BANK.slice(0, 20), subject, dimMap, mode, subjectId, false)
            wx.showToast({ title: 'AI 繁忙，用本地题库', icon: 'none', duration: 1500 })
          })
        }
      },
      fail: () => {
        this._finishAIProgress(() => {
          this._initQuestions(subject.QUESTION_BANK.slice(0, 20), subject, dimMap, mode, subjectId, false)
          wx.showToast({ title: '网络异常，用本地题库', icon: 'none', duration: 1500 })
        })
      }
    })
  },

  _initQuestions(questions, subject, dimMap, mode, subjectId, aiBadge) {
    this.setData({
      subjectId,
      subject,
      dimMap,
      mode,
      questions,
      total: questions.length,
      currentQ: questions[0],
      currentIdx: 0,
      progressPct: (1 / questions.length) * 100,
      aiLoading: false,
      aiBadge: !!aiBadge
    })
    wx.setNavigationBarTitle({
      title: `${subject.shortName} · ${mode === 'assess' ? '定级测评' : (aiBadge ? 'AI 实时出题' : 'AI 自适应训练')}`
    })
  },

  // 雅思 · 自适应训练 · 调 DeepSeek V4（针对薄弱维度）
  _loadAIQuestionsForIELTS(subject, dimMap, mode, subjectId) {
    this._startAIProgress(this._AI_MESSAGES_ADAPTIVE)

    const prog = wx.getStorageSync(storageKeyOf(subjectId)) || {}
    const mastery = prog.mastery || {}
    // 找最弱维度
    const dims = subject.DIMS
    let weakDim = dims[0].key
    let weakVal = mastery[dims[0].key] != null ? mastery[dims[0].key] : 50
    dims.forEach(d => {
      const v = mastery[d.key] != null ? mastery[d.key] : 50
      if (v < weakVal) { weakVal = v; weakDim = d.key }
    })

    const serverUrl = (app && app.globalData && app.globalData.serverUrl) || 'https://crayxus-game.onrender.com'
    wx.request({
      url: serverUrl + '/api/ai/ielts/generate',
      method: 'POST',
      data: {
        dim: weakDim,
        difficulty: weakVal < 40 ? 1 : weakVal < 70 ? 2 : 3,
        count: 10,
        mastery: weakVal
      },
      timeout: 50000,
      success: (r) => {
        const d = r.data
        if (d && d.ok && Array.isArray(d.questions) && d.questions.length > 0) {
          this._finishAIProgress(() => {
            this._initQuestions(d.questions, subject, dimMap, mode, subjectId, true)
          })
        } else {
          this._finishAIProgress(() => {
            this._initQuestions(subject.pickAdaptive(mastery, 10), subject, dimMap, mode, subjectId, false)
            wx.showToast({ title: 'AI 繁忙，用本地题库', icon: 'none', duration: 1500 })
          })
        }
      },
      fail: () => {
        this._finishAIProgress(() => {
          this._initQuestions(subject.pickAdaptive(mastery, 10), subject, dimMap, mode, subjectId, false)
          wx.showToast({ title: '网络异常，用本地题库', icon: 'none', duration: 1500 })
        })
      }
    })
  },


  selectOption(e) {
    if (this.data.showResult) return
    this.setData({ selectedIdx: e.currentTarget.dataset.idx })
  },

  onNext() {
    if (this.data.selectedIdx === null) return

    if (!this.data.showResult) {
      const q = this.data.currentQ
      const correct = this.data.selectedIdx === q.answer
      const ans = { qid: q.id, selected: this.data.selectedIdx, correct, dim: q.dim, second: q.second }
      const newStreak = correct ? this.data.correctStreak + 1 : 0
      this.setData({
        showResult: true,
        answers: [...this.data.answers, ans],
        correctStreak: newStreak
      })
      wx.vibrateShort && wx.vibrateShort({ type: correct ? 'light' : 'medium' })
      // 连对 3 题 → 触发盲盒
      if (newStreak >= 3) {
        setTimeout(() => this._maybeOpenReward(), 600)
      }
      return
    }

    const next = this.data.currentIdx + 1
    if (next >= this.data.total) {
      this.finishQuiz()
      return
    }
    // 切题时停止当前音频 + 清状态
    if (this._audioCtx) { try { this._audioCtx.stop() } catch(e){} }
    this.setData({
      currentIdx: next,
      currentQ: this.data.questions[next],
      selectedIdx: null,
      showResult: false,
      progressPct: ((next + 1) / this.data.total) * 100,
      audioPlaying: false,
      audioLoading: false,
      audioLoaded: false,
      showSubtitle: false,
      showTranslation: false
    })
  },

  finishQuiz() {
    const { answers, questions, subject, subjectId } = this.data
    const DIMS = subject.DIMS
    const STORAGE_KEY = storageKeyOf(subjectId)
    const correctCount = answers.filter(a => a.correct).length
    const totalScore = Math.round(correctCount / questions.length * 100)

    const dimStats = {}
    DIMS.forEach(d => { dimStats[d.key] = { total: 0, correct: 0 } })
    answers.forEach(a => {
      if (!dimStats[a.dim]) return
      dimStats[a.dim].total += 1
      if (a.correct) dimStats[a.dim].correct += 1
    })
    const dimResults = DIMS.map(d => {
      const s = dimStats[d.key]
      const pct = s.total > 0 ? Math.round(s.correct / s.total * 100) : null
      return { ...d, pct: pct != null ? pct : 0, attempted: s.total > 0 }
    }).filter(d => d.attempted)

    const weak = dimResults.length > 0
      ? dimResults.reduce((a, b) => a.pct < b.pct ? a : b)
      : null

    const prog = wx.getStorageSync(STORAGE_KEY) || { history: [], mastery: {}, baseline: null }
    const gain = prog.baseline != null ? totalScore - prog.baseline : 0

    const mastery = { ...prog.mastery }
    dimResults.forEach(d => {
      const prev = mastery[d.key] != null ? mastery[d.key] : 50
      mastery[d.key] = Math.round(prev * 0.5 + d.pct * 0.5)
    })

    const entry = {
      ts: Date.now(),
      mode: this.data.mode,
      score: totalScore,
      correct: correctCount,
      total: questions.length,
      dimResults: dimResults.map(d => ({ key: d.key, pct: d.pct }))
    }

    const newProg = {
      history: [...prog.history, entry].slice(-30),
      mastery,
      baseline: prog.baseline != null ? prog.baseline : totalScore,
      updatedAt: Date.now()
    }
    wx.setStorageSync(STORAGE_KEY, newProg)

    // 📚 把答错的题写入错题本
    this._saveWrongAnswers(answers, questions, subjectId)

    this.setData({
      finished: true,
      totalScore,
      correctCount,
      gain: Math.max(0, gain),
      dimResults,
      weakDimKey: weak ? weak.key : null,
      weakDimName: weak ? weak.name : null
    })
  },

  _saveWrongAnswers(answers, questions, subjectId) {
    try {
      const WB_KEY = `crayxus_wrongbook_${subjectId}`
      const wb = wx.getStorageSync(WB_KEY) || { items: [] }
      const existing = new Map(wb.items.map(it => [it.id, it]))
      const now = Date.now()
      answers.forEach((ans, i) => {
        if (ans.correct) return
        const q = questions[i]
        if (!q) return
        const existIt = existing.get(q.id)
        if (existIt) {
          // 已有：累加 attempts
          existIt.attempts = (existIt.attempts || 1) + 1
          existIt.wrongAt = now
          existIt.selected = ans.selected
        } else {
          existing.set(q.id, {
            id: q.id,
            dim: q.dim,
            q: q.q,
            options: q.options,
            answer: q.answer,
            selected: ans.selected,
            solution: q.solution,
            wrongAt: now,
            attempts: 1
          })
        }
      })
      // 限制最多 200 道，保留最近的
      const all = Array.from(existing.values()).sort((a, b) => (b.wrongAt || 0) - (a.wrongAt || 0)).slice(0, 200)
      wx.setStorageSync(WB_KEY, { items: all, lastUpdated: now })
    } catch(e) { console.warn('[saveWrongAnswers]', e) }
  },

  startAdaptiveAgain() {
    wx.redirectTo({ url: `/pages/sb-quiz/sb-quiz?subject=${this.data.subjectId}&mode=adaptive` })
  },

  onClose() {
    wx.navigateBack({ delta: 1, fail: () => wx.switchTab && wx.switchTab({ url: '/pages/home/home' }) })
  }
})
