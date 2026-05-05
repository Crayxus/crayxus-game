// 占位文件 (Labs 暂时拿掉, 保留空 stub 防编译报错)
Page({
  data: {},
  onLoad() {
    wx.showToast({ title: 'Labs 暂未开放', icon: 'none', duration: 1200 })
    setTimeout(() => wx.navigateBack({ delta: 1 }), 800)
  }
})
