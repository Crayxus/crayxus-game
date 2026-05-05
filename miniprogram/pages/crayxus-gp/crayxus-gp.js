// Crayxus GP · AI 神经驾驶联赛
const DRIVERS = [
  {
    id: 'alpha', avatar: '🏎️', name: 'Crayxus-Alpha',
    color: '#00eaff',
    dev: 'Crayxus AI 团队',
    aiModel: '自研 V8 强化学习',
    aiBadge: 'CRX-V8',
    mentor: '浙江大学 · 张旭光教授',
    bestLap: '1:23.456',
    races: 47, wins: 12, points: 348,
    delta: 0
  },
  {
    id: 'doubao', avatar: '🚗', name: 'Doubao-X',
    color: '#ff4081',
    dev: '字节跳动 ML 团队',
    aiModel: '豆包 1.5 Pro',
    aiBadge: '豆包',
    mentor: '北京大学 AI 学院',
    bestLap: '1:24.012',
    races: 52, wins: 9, points: 311,
    delta: 0.556
  },
  {
    id: 'kimi', avatar: '🚀', name: 'Kimi-Racer',
    color: '#7c4dff',
    dev: 'Moonshot AI',
    aiModel: 'Kimi K2 Pro',
    aiBadge: 'Kimi',
    mentor: '清华大学交叉信息研究院',
    bestLap: '1:24.789',
    races: 38, wins: 7, points: 268,
    delta: 1.333
  },
  {
    id: 'deepseek', avatar: '⚡', name: 'DeepSeek-Drift',
    color: '#10b981',
    dev: 'DeepSeek AI',
    aiModel: 'DeepSeek V4',
    aiBadge: 'DSV4',
    mentor: '中科院自动化所',
    bestLap: '1:25.234',
    races: 41, wins: 6, points: 245,
    delta: 1.778
  },
  {
    id: 'qwen', avatar: '🌪', name: 'Qwen-Velocity',
    color: '#ffd700',
    dev: '阿里达摩院',
    aiModel: '通义千问 Max',
    aiBadge: 'Qwen',
    mentor: '上海交大人工智能研究院',
    bestLap: '1:25.890',
    races: 45, wins: 5, points: 232,
    delta: 2.434
  },
  {
    id: 'gpt', avatar: '🌐', name: 'GPT-Stratos',
    color: '#ff9500',
    dev: 'OpenAI 海外团队',
    aiModel: 'GPT-4o',
    aiBadge: 'GPT-4o',
    mentor: 'Stanford AI Lab',
    bestLap: '1:26.123',
    races: 33, wins: 4, points: 198,
    delta: 2.667
  }
]

// 4 条赛道（SVG path 用于俯瞰图）
const TRACKS_RAW = [
  {
    id: 't1', name: '杭州 · 西湖盘山道', code: 'WEST LAKE GP',
    length: '4.2 km', turns: 18, diff: 4,
    record: '1:23.456 · Crayxus-Alpha',
    color: '#00eaff',
    path: 'M 60 200 Q 90 80, 230 90 Q 360 100, 420 50 Q 480 30, 480 110 Q 470 200, 380 200 Q 280 200, 280 280 Q 280 360, 180 360 Q 60 360, 60 260 Z'
  },
  {
    id: 't2', name: '上海 · 陆家嘴夜赛', code: 'PUDONG NIGHT',
    length: '5.1 km', turns: 22, diff: 5,
    record: '1:31.890 · Crayxus-Alpha',
    color: '#ff4081',
    path: 'M 80 300 Q 80 200, 180 180 Q 280 160, 280 80 Q 280 40, 380 40 Q 460 40, 460 130 Q 460 200, 380 220 Q 280 240, 280 320 Q 280 380, 180 380 Q 80 380, 80 300 Z'
  },
  {
    id: 't3', name: '浙大 · 紫金港校园', code: 'ZJU CAMPUS',
    length: '3.0 km', turns: 14, diff: 3,
    record: '1:08.234 · Crayxus-Alpha',
    color: '#10b981',
    path: 'M 80 200 Q 80 100, 200 100 Q 320 100, 320 60 Q 320 30, 420 60 Q 480 80, 480 180 Q 480 280, 380 280 Q 200 280, 200 360 Q 200 400, 100 380 Q 50 360, 80 200 Z'
  },
  {
    id: 't4', name: '海岸线 · 长岛环路', code: 'COASTAL CIRCUIT',
    length: '6.8 km', turns: 26, diff: 5,
    record: '2:15.678 · Crayxus-Alpha',
    color: '#ffd700',
    path: 'M 50 220 Q 50 100, 150 80 Q 250 60, 280 140 Q 310 220, 380 180 Q 460 130, 480 220 Q 490 320, 410 350 Q 320 380, 280 320 Q 240 250, 160 290 Q 70 320, 50 220 Z'
  }
]

function buildTrackSvgUri(path, color) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 540 440'>
    <path d='${path}' stroke='${color}' stroke-width='14' stroke-linejoin='round' fill='none' opacity='0.18'/>
    <path d='${path}' stroke='${color}' stroke-width='5' stroke-linejoin='round' fill='none'/>
    <path d='${path}' stroke='#fff' stroke-width='1.5' stroke-linejoin='round' fill='none' stroke-dasharray='6 4' opacity='0.6'/>
  </svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

const TRACKS = TRACKS_RAW.map(t => ({
  ...t,
  diffStars: '★'.repeat(t.diff) + '☆'.repeat(5 - t.diff),
  svgUri: buildTrackSvgUri(t.path, t.color)
}))

Page({
  data: {
    statusBarHeight: 44,
    drivers: DRIVERS,
    tracks: TRACKS,
    selectedDriverId: 'alpha',
    selectedTrackId: 't1',
    raceState: 'idle',  // idle | racing | paused | finished
    lap: 0,
    totalLaps: 40,
    liveTiming: [],
    elapsedSec: 0,
    selectedDriver: null,
    selectedTrack: null
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
    this._refreshSelected()
  },

  _refreshSelected() {
    const sd = DRIVERS.find(d => d.id === this.data.selectedDriverId) || DRIVERS[0]
    const st = TRACKS.find(t => t.id === this.data.selectedTrackId) || TRACKS[0]
    this.setData({ selectedDriver: sd, selectedTrack: st })
  },

  selectDriver(e) {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ selectedDriverId: e.currentTarget.dataset.id })
    this._refreshSelected()
  },

  selectTrack(e) {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ selectedTrackId: e.currentTarget.dataset.id })
    this._refreshSelected()
  },

  startRace() {
    if (this.data.raceState === 'racing') return
    wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
    this.setData({
      raceState: 'racing',
      lap: 1,
      elapsedSec: 0,
      liveTiming: this._initTiming()
    })
    this._raceTimer = setInterval(() => this._tickRace(), 800)
  },

  pauseRace() {
    if (this.data.raceState !== 'racing') return
    if (this._raceTimer) { clearInterval(this._raceTimer); this._raceTimer = null }
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    this.setData({ raceState: 'paused' })
  },

  resumeRace() {
    if (this.data.raceState !== 'paused') return
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    this.setData({ raceState: 'racing' })
    this._raceTimer = setInterval(() => this._tickRace(), 800)
  },

  stopRace() {
    if (this._raceTimer) { clearInterval(this._raceTimer); this._raceTimer = null }
    wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
    this.setData({ raceState: 'finished' })
  },

  resetRace() {
    if (this._raceTimer) { clearInterval(this._raceTimer); this._raceTimer = null }
    this.setData({ raceState: 'idle', lap: 0, elapsedSec: 0, liveTiming: [] })
  },

  _initTiming() {
    return DRIVERS.map((d, i) => ({
      pos: i + 1,
      id: d.id,
      name: d.name,
      avatar: d.avatar,
      color: d.color,
      lapTime: d.bestLap,
      gap: i === 0 ? '---' : `+${d.delta.toFixed(3)}`,
      lastLap: d.bestLap
    }))
  },

  _tickRace() {
    const d = this.data
    const newSec = d.elapsedSec + 1
    const newLap = Math.min(d.totalLaps, Math.floor(newSec / 4) + 1)

    // 模拟实时排位变化（相邻位置随机互换）
    const t = d.liveTiming.slice()
    for (let i = 0; i < t.length - 1; i++) {
      if (Math.random() < 0.08) {
        ;[t[i], t[i+1]] = [t[i+1], t[i]]
      }
    }
    // 更新 pos + gap
    t.forEach((row, i) => {
      row.pos = i + 1
      row.gap = i === 0 ? '---' : '+' + (Math.random() * 2 + i * 0.3).toFixed(3)
      row.lastLap = `1:${(23 + Math.random() * 5).toFixed(3)}`
    })

    if (newLap >= d.totalLaps) {
      if (this._raceTimer) { clearInterval(this._raceTimer); this._raceTimer = null }
      this.setData({ raceState: 'finished', lap: d.totalLaps, elapsedSec: newSec, liveTiming: t })
      wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
      return
    }

    this.setData({ lap: newLap, elapsedSec: newSec, liveTiming: t })
  },

  liveSpectate() {
    wx.showToast({ title: '🔴 直播观战开发中', icon: 'none', duration: 1500 })
  },

  replayData() {
    wx.showToast({ title: '📊 数据回放开发中', icon: 'none', duration: 1500 })
  },

  goBack() {
    if (this._raceTimer) { clearInterval(this._raceTimer); this._raceTimer = null }
    wx.navigateBack({ delta: 1, fail: () => wx.reLaunch({ url: '/pages/landing/landing' }) })
  },

  onUnload() {
    if (this._raceTimer) { clearInterval(this._raceTimer); this._raceTimer = null }
  }
})
