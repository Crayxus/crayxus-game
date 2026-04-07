Page({
  data: {
    statusBarHeight: 44,
  },

  onLoad() {
    try {
      const sys = wx.getWindowInfo()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
  },

  selectPlan(e) {
    const plan = e.currentTarget.dataset.plan
    const names = { day: '单日租赁', weekend: '周末套餐', week: '周租赁' }
    wx.showModal({
      title: names[plan] || '租赁咨询',
      content: '请联系 general@crayxus.com.au 预约租赁',
      confirmText: '复制邮箱',
      success(res) {
        if (res.confirm) {
          wx.setClipboardData({ data: 'general@crayxus.com.au' })
        }
      }
    })
  },

  copyEmail() {
    wx.setClipboardData({
      data: 'general@crayxus.com.au',
      success() {
        wx.showToast({ title: '邮箱已复制', icon: 'success' })
      }
    })
  },
})
