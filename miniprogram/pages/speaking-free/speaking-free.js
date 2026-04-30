const app = getApp()

const TOPICS = [
  { part: 2, title: 'Describe a city you have visited', bullets: ['where it is', 'when you went there', 'what you did there', 'and explain why you remember it'] },
  { part: 2, title: 'Describe a person who has influenced you', bullets: ['who this person is', 'how you know them', 'what they did', 'and explain how they influenced you'] },
  { part: 2, title: 'Describe a memorable meal you had', bullets: ['where it was', 'who you were with', 'what you ate', 'and explain why it was memorable'] },
  { part: 2, title: 'Describe a book that changed your perspective', bullets: ['what the book is about', 'when you read it', 'why you chose it', 'and explain how it changed you'] },
  { part: 2, title: 'Describe a place where you feel relaxed', bullets: ['where it is', 'how often you go there', 'what you do there', 'and explain why you feel relaxed there'] },
  { part: 2, title: 'Describe a skill you would like to learn', bullets: ['what skill it is', 'why you want to learn it', 'how you would learn it', 'and explain how it would benefit you'] },
  { part: 2, title: 'Describe a memorable journey you took', bullets: ['where you went', 'who you went with', 'what happened', 'and explain why it was memorable'] },
  { part: 2, title: 'Describe a piece of technology you find useful', bullets: ['what it is', 'when you started using it', 'how you use it', 'and explain why it is useful'] },
  { part: 2, title: 'Describe a goal you achieved recently', bullets: ['what the goal was', 'why you set it', 'how you achieved it', 'and explain how you felt'] },
  { part: 2, title: 'Describe a friend who is important to you', bullets: ['who this person is', 'how you met', 'what you do together', 'and explain why they are important to you'] }
]

Page({
  data: {
    phase: 'topic',  // topic | recording | uploading | result
    topic: null,
    recordSecLeft: 60,
    recordPlaying: false,
    recordPath: '',
    result: null,
    errMsg: ''
  },

  onLoad() {
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)]
    this.setData({ topic })

    // 录音管理器
    this._rm = wx.getRecorderManager()
    this._rm.onStart(() => { this._startTimer() })
    this._rm.onStop((r) => {
      this._stopTimer()
      this.setData({ recordPath: r.tempFilePath, phase: 'reviewing' })
    })
    this._rm.onError((e) => {
      this._stopTimer()
      this.setData({ errMsg: e.errMsg || '录音失败', phase: 'topic' })
      wx.showToast({ title: '录音失败 · 请检查权限', icon: 'none' })
    })

    // 播放器
    this._player = wx.createInnerAudioContext()
    this._player.onPlay(() => this.setData({ recordPlaying: true }))
    this._player.onStop(() => this.setData({ recordPlaying: false }))
    this._player.onPause(() => this.setData({ recordPlaying: false }))
    this._player.onEnded(() => this.setData({ recordPlaying: false }))
  },

  onUnload() {
    this._stopTimer()
    if (this._rm) { try { this._rm.stop() } catch(e) {} }
    if (this._player) { try { this._player.stop(); this._player.destroy() } catch(e) {} }
  },

  changeTopic() {
    if (this.data.phase !== 'topic' && this.data.phase !== 'reviewing') return
    const cur = this.data.topic
    let next = cur
    while (next === cur) {
      next = TOPICS[Math.floor(Math.random() * TOPICS.length)]
    }
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ topic: next, recordPath: '', phase: 'topic', errMsg: '' })
  },

  startRecord() {
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    this.setData({ phase: 'recording', recordSecLeft: 60, errMsg: '' })
    this._rm.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'wav',
      frameSize: 50
    })
  },

  stopRecord() {
    if (this.data.phase !== 'recording') return
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    try { this._rm.stop() } catch(e) {}
  },

  _startTimer() {
    if (this._timer) clearInterval(this._timer)
    this._timer = setInterval(() => {
      const left = this.data.recordSecLeft - 1
      if (left <= 0) {
        this.stopRecord()
      } else {
        this.setData({ recordSecLeft: left })
      }
    }, 1000)
  },

  _stopTimer() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
  },

  playRecord() {
    if (!this.data.recordPath) return
    if (this.data.recordPlaying) {
      this._player.pause()
      return
    }
    this._player.src = this.data.recordPath
    this._player.play()
  },

  redoRecord() {
    if (this.data.recordPlaying) { try { this._player.stop() } catch(e) {} }
    this.setData({ recordPath: '', phase: 'topic', errMsg: '' })
  },

  submitForEval() {
    const path = this.data.recordPath
    const topic = this.data.topic
    if (!path) return
    this.setData({ phase: 'uploading', errMsg: '' })
    const fs = wx.getFileSystemManager()
    fs.readFile({
      filePath: path,
      encoding: 'base64',
      success: (r) => {
        const audio = 'data:audio/wav;base64,' + r.data
        const serverUrl = (app && app.globalData && app.globalData.serverUrl) || 'https://crayxus-game.onrender.com'
        wx.request({
          url: serverUrl + '/api/ai/ielts/speaking-eval',
          method: 'POST',
          data: { audio, topic: topic.title, part: topic.part },
          timeout: 90000,
          success: (resp) => {
            const d = resp.data
            if (d && d.ok) {
              this.setData({ phase: 'result', result: d })
              wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
            } else {
              const hint = d && d.hint ? '\n' + d.hint : ''
              this.setData({ phase: 'reviewing', errMsg: '评分失败：' + (d && d.error ? d.error : '未知') + hint })
              wx.showToast({ title: '评分失败 · 请重录', icon: 'none', duration: 2000 })
            }
          },
          fail: () => {
            this.setData({ phase: 'reviewing', errMsg: '网络异常 · 请重试' })
          }
        })
      },
      fail: () => {
        this.setData({ phase: 'reviewing', errMsg: '读取录音失败' })
      }
    })
  },

  again() {
    if (this.data.recordPlaying) { try { this._player.stop() } catch(e) {} }
    this.changeTopic()
  },

  goBack() {
    wx.navigateBack({ delta: 1, fail: () => wx.reLaunch({ url: '/pages/landing/landing' }) })
  }
})
