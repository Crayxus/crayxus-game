const app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    isLight: false,
    selectedCar: 0,
    car: { topSpeed: 327, lapBest: '1:42.318', elo: 2156 },
    cars: [
      { id: 'phoenix', emoji: '🏎️', name: 'Phoenix-X1', class: 'GT NEURAL', power: 92, color: '#ff0080' },
      { id: 'apex', emoji: '🚗', name: 'Apex-V8', class: 'PROTOTYPE', power: 88, color: '#00d4ff' },
      { id: 'storm', emoji: '🚙', name: 'Storm-EV', class: 'EV CLASS', power: 85, color: '#7c4dff' },
      { id: 'fury', emoji: '🏁', name: 'Fury-RS',  class: 'TOURING',   power: 79, color: '#ffd700' },
      { id: 'nova',  emoji: '🛻', name: 'Nova-MK3', class: 'RALLY',    power: 74, color: '#00d4aa' },
    ],
    tunes: [
      { key: 'steer',   name: '转向灵敏度', icon: '🎯', val: 65, color: '#00d4ff', desc: '神经网络对转向输入的响应曲线' },
      { key: 'throttle',name: '油门响应',   icon: '⚡', val: 80, color: '#ffd700', desc: '加速度输出阶跃 (0-100)' },
      { key: 'brake',   name: '制动平衡',   icon: '🛑', val: 55, color: '#ff6b6b', desc: '前后制动力分配 / ABS 干预' },
      { key: 'aggro',   name: 'AI 激进度',  icon: '🔥', val: 70, color: '#ff0080', desc: '超车决策的风险阈值' },
      { key: 'aero',    name: '空气动力学', icon: '💨', val: 60, color: '#7c4dff', desc: '下压力 vs 直线速度' },
      { key: 'predict', name: '路径预测',   icon: '🧠', val: 75, color: '#00d4aa', desc: '前瞻 horizon (帧数)' },
    ],
    telemetry: { speed: 287, rpm: 11.4, gforce: '2.8', confidence: 94, throttle: 82 },
    tracks: [
      { id: 'monza',    emoji: '🏟️', name: 'Monza',       length: 5.79, corners: 11, difficulty: '★★★☆☆', sectors: [85, 92, 70, 88, 60, 95, 75] },
      { id: 'suzuka',   emoji: '🗾', name: 'Suzuka',      length: 5.81, corners: 18, difficulty: '★★★★★', sectors: [70, 85, 55, 90, 65, 80, 50] },
      { id: 'spa',      emoji: '🌲', name: 'Spa',         length: 7.00, corners: 19, difficulty: '★★★★☆', sectors: [88, 60, 75, 92, 70, 85, 78] },
      { id: 'shanghai', emoji: '🏯', name: 'Shanghai Intl', length: 5.45, corners: 16, difficulty: '★★★★☆', sectors: [78, 70, 88, 65, 90, 72, 85] },
    ],
    trackIdx: 0,
    currentTrack: null,
    leaderboard: [
      { rank: 1, emoji: '🏎️', name: 'Phoenix-X1', team: 'CRAYXUS R&D', time: '1:41.892' },
      { rank: 2, emoji: '🏎️', name: 'NeuroDrift', team: 'DeepMind GP', time: '1:42.105' },
      { rank: 3, emoji: '🚗', name: 'Apex-V8',    team: 'CRAYXUS R&D', time: '1:42.418' },
      { rank: 4, emoji: '🚙', name: 'Velocity',   team: 'Tesla AI',    time: '1:42.667' },
      { rank: 5, emoji: '🛻', name: 'Phantom',    team: 'Waymo Lab',   time: '1:43.012' },
    ],
    _telemTimer: null,
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
    this.setData({ currentTrack: this.data.tracks[0] })
  },


  onShow() {
    const theme = wx.getStorageSync('theme') || 'dark'
    this.setData({ isLight: theme === 'light' })
    this.startTelemetryLoop()
  },

  onHide() { this.stopTelemetryLoop() },
  onUnload() { this.stopTelemetryLoop() },

  startTelemetryLoop() {
    this.stopTelemetryLoop()
    const timer = setInterval(() => {
      const t = this.data.telemetry
      const speed = Math.max(180, Math.min(340, t.speed + (Math.random() - 0.5) * 30))
      const rpm = (8 + Math.random() * 5).toFixed(1)
      const gforce = (1.5 + Math.random() * 2.5).toFixed(1)
      const confidence = Math.max(82, Math.min(99, t.confidence + (Math.random() - 0.5) * 6 | 0))
      const throttle = Math.max(40, Math.min(100, t.throttle + (Math.random() - 0.5) * 25 | 0))
      this.setData({ telemetry: { speed: speed | 0, rpm, gforce, confidence, throttle } })
    }, 800)
    this.data._telemTimer = timer
  },

  stopTelemetryLoop() {
    if (this.data._telemTimer) {
      clearInterval(this.data._telemTimer)
      this.data._telemTimer = null
    }
  },

  selectCar(e) {
    const idx = e.currentTarget.dataset.idx
    this.setData({ selectedCar: idx })
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
  },

  onTuneChange(e) {
    const key = e.currentTarget.dataset.key
    const val = e.detail.value
    const tunes = this.data.tunes.map(t => t.key === key ? { ...t, val } : t)
    this.setData({ tunes })
  },

  resetTune() {
    const defaults = { steer: 65, throttle: 80, brake: 55, aggro: 70, aero: 60, predict: 75 }
    const tunes = this.data.tunes.map(t => ({ ...t, val: defaults[t.key] }))
    this.setData({ tunes })
    wx.showToast({ title: '已重置默认值', icon: 'none' })
  },

  changeTrack() {
    const next = (this.data.trackIdx + 1) % this.data.tracks.length
    this.setData({ trackIdx: next, currentTrack: this.data.tracks[next] })
  },

  goTraining() {
    wx.showToast({ title: '训练模式开发中', icon: 'none' })
  },

  startRace() {
    const car = this.data.cars[this.data.selectedCar]
    wx.showModal({
      title: '🏁 START RACE',
      content: `战车: ${car.name}\n赛道: ${this.data.currentTrack.name}\n\n准备好让 AI 接管驾驶?`,
      confirmText: 'GO',
      confirmColor: '#ff0080',
      success: (r) => {
        if (r.confirm) {
          wx.showLoading({ title: 'AI 启动中...' })
          setTimeout(() => {
            wx.hideLoading()
            wx.showToast({ title: '比赛已开始 🏎️', icon: 'success' })
          }, 1200)
        }
      }
    })
  }
})
