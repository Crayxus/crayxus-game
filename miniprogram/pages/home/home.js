const app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    danli: { score: 0, rank: '' },
    quiz: { totalQuestions: 0, correctRate: 0, streak: 0, bestStreak: 0 },
    dims: []
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
  },

  onShow() {
    this.loadData()
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

  // 蛋力值测评 — 跳转原生测评页
  goDanli() {
    wx.navigateTo({ url: '/pages/quiz/quiz?mode=danli' })
  },

  // 每日做题
  goDailyQuiz() {
    wx.navigateTo({ url: '/pages/quiz/quiz?mode=daily' })
  },

  // 赛事报名
  goTournament() {
    wx.navigateTo({ url: '/pages/tournament/tournament' })
  },

  // 扫码登录
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
        this.doLogin(sessionId)
      },
      fail: () => wx.showToast({ title: '已取消', icon: 'none' })
    })
  },

  doLogin(sessionId) {
    wx.request({
      url: app.globalData.serverUrl + '/api/wx-login',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        sessionId,
        avatarUrl: app.globalData.avatarBase64 || app.globalData.avatarUrl,
        nickname: app.globalData.nickname
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
  }
})
