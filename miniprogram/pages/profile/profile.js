const app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    avatarUrl: '',
    nickname: '',
    hasNickname: false,
    danli: { score: 0, rank: '' },
    quiz: { totalQuestions: 0, correctRate: 0, streak: 0, bestStreak: 0 },
    dims: []
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
    this.loadCachedUser()
  },

  onShow() {
    this.loadData()
  },

  loadCachedUser() {
    const cached = wx.getStorageSync('crayxus_user') || {}
    const avatarUrl = cached.avatarUrl || app.globalData.avatarUrl || ''
    const nickname = cached.nickname || app.globalData.nickname || ''
    if (cached.avatarBase64) app.globalData.avatarBase64 = cached.avatarBase64
    this.setData({ avatarUrl, nickname, hasNickname: !!nickname })
  },

  loadData() {
    const danli = app.globalData.danli || {}
    const quiz = wx.getStorageSync('crayxus_quiz') || {}

    const dimConfig = [
      { key: 'timing', name: '出牌', icon: '🎯', color: '#ff6b6b' },
      { key: 'teamwork', name: '配合', icon: '🤝', color: '#ffd93d' },
      { key: 'bombing', name: '炸弹', icon: '💣', color: '#ff9500' },
      { key: 'memory', name: '记牌', icon: '🧠', color: '#00d4aa' },
      { key: 'strategy', name: '大局', icon: '♟️', color: '#7c4dff' },
      { key: 'mental', name: '心态', icon: '💪', color: '#3d9dff' }
    ]

    const dims = dimConfig.map(d => ({
      ...d,
      val: danli[d.key] || 0,
      pct: ((danli[d.key] || 0) / 10).toFixed(0)
    }))

    this.setData({ danli, quiz, dims })
  },

  // Avatar
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    if (!avatarUrl) return
    app.globalData.avatarUrl = avatarUrl
    this.setData({ avatarUrl })

    const fs = wx.getFileSystemManager()
    fs.readFile({
      filePath: avatarUrl,
      encoding: 'base64',
      success: (res) => {
        app.globalData.avatarBase64 = 'data:image/png;base64,' + res.data
        this.saveUser()
      },
      fail: () => this.saveUser()
    })
  },

  onTapAvatar() {
    wx.showActionSheet({
      itemList: ['更换头像'],
      success: (res) => {
        if (res.tapIndex === 0) this.setData({ avatarUrl: '' })
      }
    })
  },

  onNicknameChange(e) {
    const nickname = (e.detail.value || '').trim()
    if (!nickname) return
    app.globalData.nickname = nickname
    this.setData({ nickname, hasNickname: true })
    this.saveUser()
  },

  onTapNickname() {
    this.setData({ hasNickname: false })
  },

  saveUser() {
    wx.setStorageSync('crayxus_user', {
      avatarUrl: this.data.avatarUrl,
      avatarBase64: app.globalData.avatarBase64 || '',
      nickname: this.data.nickname
    })
  },

  // Scan login
  onScanLogin() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        let sessionId = ''
        try {
          const url = new URL(res.result)
          sessionId = url.searchParams.get('session') || ''
        } catch(e) {
          const match = res.result.match(/session=([A-Z0-9-]+)/i)
          if (match) sessionId = match[1]
        }
        if (!sessionId) {
          wx.showToast({ title: '无效二维码', icon: 'none' })
          return
        }
        wx.request({
          url: app.globalData.serverUrl + '/api/wx-login',
          method: 'POST',
          header: { 'content-type': 'application/json' },
          data: {
            sessionId,
            avatarUrl: app.globalData.avatarBase64 || this.data.avatarUrl,
            nickname: this.data.nickname
          },
          success: (resp) => {
            if (resp.data && resp.data.success) {
              wx.showToast({ title: '登录成功', icon: 'success' })
            } else {
              wx.showToast({ title: resp.data.msg || '登录失败', icon: 'none' })
            }
          },
          fail: () => wx.showToast({ title: '网络错误', icon: 'none' })
        })
      },
      fail: () => wx.showToast({ title: '已取消', icon: 'none' })
    })
  },

  // Share
  onShareCard() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] })
  },

  onShareAppMessage() {
    const d = this.data.danli
    const title = d.score
      ? `我的蛋力值${d.score}分，你敢来测吗？`
      : '测测你的掼蛋水平，六边形战士等你挑战！'
    return { title, path: '/pages/home/home' }
  },

  onShareTimeline() {
    const d = this.data.danli
    return {
      title: d.score ? `蛋力值${d.score} | ${d.rank}` : '掼蛋蛋力值测评'
    }
  }
})
