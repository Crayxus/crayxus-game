// 📌 投资者专用版本：设为 true 只展示 AI 提分系统，其他三个板块屏蔽
const INVESTOR_MODE = true

Page({
  data: {
    statusBarHeight: 44,
    investorMode: INVESTOR_MODE
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
    // 用户已经到达 landing，清除冷启动标记
    try { const app = getApp(); if (app) app.__coldBoot = false } catch(e) {}
  },

  goGuandan() {
    wx.switchTab({ url: '/pages/home/home' })
  },

  goTruck() {
    wx.navigateTo({ url: '/pages/truck/home' })
  },

  goRacing() {
    wx.navigateTo({ url: '/pages/racing/racing' })
  },

  goScoreBoost() {
    wx.navigateTo({ url: '/pages/scoreboost/scoreboost' })
  },

  // 🔒 长按 logo 解锁 AAAS demo 列表（隐藏入口）
  onLogoLongPress() {
    wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
    wx.showActionSheet({
      itemList: ['法良时装 AAAS Demo', 'PowerLoop · 韩国 AI 充电宝 AAAS Demo', 'AdMind · AI 营销自动执行官 Demo', '🏁 Crayxus AI GP · AI 神经驾驶大奖赛'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/falang/falang' })
        } else if (res.tapIndex === 1) {
          wx.navigateTo({ url: '/pages/powerloop/powerloop' })
        } else if (res.tapIndex === 2) {
          wx.navigateTo({ url: '/pages/admind/admind' })
        } else if (res.tapIndex === 3) {
          wx.navigateTo({ url: '/pages/crayxus-gp/crayxus-gp' })
        }
      }
    })
  }
})
