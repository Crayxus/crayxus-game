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
    }
  },

  onLaunch(options) {
    // 🔒 冷启动标记：由 landing.js onLoad 清除；tabBar 页 onShow 检测到为 true 就跳回 landing
    this.__coldBoot = true

    // 全局错误兜底 —— 防单点崩溃带崩启动
    try {
      wx.onError && wx.onError((err) => {
        console.error('[onError]', err)
        try {
          wx.request({
            url: this.globalData.serverUrl + '/api/log',
            method: 'POST',
            data: {
              type: 'error',
              err: String(err).slice(0, 800),
              sys: (function () { try { return wx.getSystemInfoSync() } catch (e) { return {} } })()
            },
            fail: function () {}
          })
        } catch (e) {}
      })
      wx.onUnhandledRejection && wx.onUnhandledRejection((res) => {
        console.error('[unhandledRejection]', res && res.reason)
      })
    } catch (e) {}

    // 读本地缓存：每段独立 try/catch，任何一段抛错都不影响其他
    try {
      const cached = wx.getStorageSync('crayxus_user')
      if (cached && typeof cached === 'object') {
        this.globalData.avatarUrl = cached.avatarUrl || ''
        this.globalData.nickname = cached.nickname || ''
        this.globalData.avatarBase64 = cached.avatarBase64 || ''
      }
    } catch (e) { console.warn('[onLaunch] load crayxus_user fail:', e) }

    try {
      const danli = wx.getStorageSync('crayxus_danli')
      if (danli && typeof danli === 'object') {
        this.globalData.danli = Object.assign({}, this.globalData.danli, danli)
      }
    } catch (e) { console.warn('[onLaunch] load crayxus_danli fail:', e) }
  }
})
