App({
  globalData: {
    userInfo: null,
    avatarUrl: '',
    nickname: '',
    avatarBase64: '',
    serverUrl: 'https://crayxus-game.onrender.com',

    // 蛋力值
    danli: {
      score: 0,
      timing: 0,
      teamwork: 0,
      bombing: 0,
      memory: 0,
      strategy: 0,
      mental: 0,
      rank: '',
      testedAt: ''
    },

    // 训练数据
    training: {
      totalSessions: 0,
      totalHands: 0,
      accuracy: 0,
      bestAccuracy: 0
    }
  },

  onLaunch() {
    const cached = wx.getStorageSync('crayxus_user')
    if (cached) {
      this.globalData.avatarUrl = cached.avatarUrl || ''
      this.globalData.nickname = cached.nickname || ''
      this.globalData.avatarBase64 = cached.avatarBase64 || ''
    }
    const danli = wx.getStorageSync('crayxus_danli')
    if (danli) {
      this.globalData.danli = danli
    }
    const training = wx.getStorageSync('crayxus_training')
    if (training) {
      this.globalData.training = training
    }
  }
})
