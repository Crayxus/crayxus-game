const app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    loading: true,
    events: [],
    weekLabel: '',
    showDetail: false,
    detailEvent: null,
    showModal: false,
    modalEvent: null,
    formNickname: '',
    formPhone: '',
    formTeam: '',
    formNote: ''
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}

    // 预填昵称
    const nickname = app.globalData.nickname || ''
    this.setData({ formNickname: nickname })
  },

  onShow() {
    this.loadEvents()
  },

  goBack() {
    wx.navigateBack()
  },

  loadEvents() {
    this.setData({ loading: true })
    const serverUrl = app.globalData.serverUrl

    wx.request({
      url: serverUrl + '/api/tournaments',
      success: (res) => {
        const list = res.data || []
        const typeTexts = { tuanjian: '团建', gongyi: '公益赛', open: '公开赛' }
        const events = list.map(t => ({
          ...t,
          playerCount: (t.players || []).length,
          eventTypeText: typeTexts[t.eventType] || '比赛'
        }))

        // 本周标签
        const now = new Date()
        const monday = new Date(now)
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        const weekLabel = (monday.getMonth()+1) + '/' + monday.getDate() + ' - ' + (sunday.getMonth()+1) + '/' + sunday.getDate()

        this.setData({ events, weekLabel, loading: false })
      },
      fail: () => {
        wx.showToast({ title: '加载失败', icon: 'none' })
        this.setData({ loading: false })
      }
    })
  },

  showDetail(e) {
    const code = e.currentTarget.dataset.code
    const serverUrl = app.globalData.serverUrl

    wx.request({
      url: serverUrl + '/api/tournaments/' + code,
      success: (res) => {
        const t = res.data
        if (!t) return
        const typeTexts = { tuanjian: '团建', gongyi: '公益赛', open: '公开赛' }
        t.eventTypeText = typeTexts[t.eventType] || '比赛'
        t.playerCount = (t.players || []).length
        this.setData({ showDetail: true, detailEvent: t })
      },
      fail: () => wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  closeDetail() {
    this.setData({ showDetail: false, detailEvent: null })
  },

  openJoinForm() {
    this.setData({
      showDetail: false,
      showModal: true,
      modalEvent: this.data.detailEvent
    })
  },

  closeModal() {
    this.setData({ showModal: false, modalEvent: null })
  },

  onNickname(e) { this.setData({ formNickname: e.detail.value }) },
  onPhone(e) { this.setData({ formPhone: e.detail.value }) },
  onTeam(e) { this.setData({ formTeam: e.detail.value }) },
  onNote(e) { this.setData({ formNote: e.detail.value }) },

  submitJoin() {
    const { formNickname, formPhone, formTeam, formNote, modalEvent } = this.data
    if (!formNickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    if (!formPhone.trim()) {
      wx.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }

    const serverUrl = app.globalData.serverUrl

    wx.request({
      url: serverUrl + '/api/tournaments/' + modalEvent.code + '/join',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        nickname: formNickname.trim(),
        phone: formPhone.trim(),
        team: formTeam.trim(),
        note: formNote.trim()
      },
      success: (res) => {
        if (res.data && res.data.success !== false) {
          wx.showToast({ title: '报名成功！', icon: 'success' })
          this.setData({ showModal: false, modalEvent: null })
          this.loadEvents() // 刷新列表
        } else {
          wx.showToast({ title: res.data.error || '报名失败', icon: 'none' })
        }
      },
      fail: () => wx.showToast({ title: '网络错误', icon: 'none' })
    })
  }
})
