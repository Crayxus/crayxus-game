const app = getApp()

const WEEKDAYS = ['周日','周一','周二','周三','周四','周五','周六']
const TYPE_TEXTS = { teambuilding: '团建', charity: '公益赛', open: '公开赛' }

Page({
  data: {
    statusBarHeight: 44,
    loading: true,
    dayGroups: [],
    weekLabel: '',
    weekOffset: 0,
    allEvents: [],
    showDetail: false,
    detailEvent: null,
    showModal: false,
    modalEvent: null,
    formNickname: '',
    formPhone: '',
    formTeam: '',
    formNote: '',
    // Booking
    showBooking: false,
    showPaySuccess: false,
    bookingTier: 20,
    bkCompany: '',
    bkContact: '',
    bkPhone: ''
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
    const nickname = app.globalData.nickname || ''
    this.setData({ formNickname: nickname })
  },

  onShow() {
    this.loadEvents()
  },

  goBack() { wx.navigateBack() },

  // Week navigation
  prevWeek() {
    this.setData({ weekOffset: this.data.weekOffset - 1 })
    this._buildCalendar()
  },
  nextWeek() {
    this.setData({ weekOffset: this.data.weekOffset + 1 })
    this._buildCalendar()
  },

  loadEvents() {
    this.setData({ loading: true })
    wx.request({
      url: app.globalData.serverUrl + '/api/tournaments',
      success: (res) => {
        const list = (res.data || []).map(t => ({
          ...t,
          playerCount: (t.players || []).length,
          eventTypeText: TYPE_TEXTS[t.eventType] || '比赛',
          capPct: t.capacity > 0 ? Math.min((t.players || []).length / t.capacity * 100, 100) : 0
        }))
        this.setData({ allEvents: list, loading: false })
        this._buildCalendar()
      },
      fail: () => {
        wx.showToast({ title: '加载失败', icon: 'none' })
        this.setData({ loading: false })
      }
    })
  },

  _buildCalendar() {
    const { allEvents, weekOffset } = this.data
    const now = new Date()
    const day = now.getDay()

    // Monday of current week + offset
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((day + 6) % 7) + weekOffset * 7)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const weekLabel = (monday.getMonth()+1) + '/' + monday.getDate() + ' - ' + (sunday.getMonth()+1) + '/' + sunday.getDate()

    const today = this._fmtDate(now)
    const startStr = this._fmtDate(monday)
    const endStr = this._fmtDate(sunday)

    // Build 7 day slots
    const dayGroups = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const ds = this._fmtDate(d)
      const dayEvents = allEvents.filter(t => {
        const ed = t.eventDate || (t.createdAt || '').split('T')[0]
        return ed === ds
      })

      // Only show days that have events or are today
      if (dayEvents.length > 0 || ds === today) {
        dayGroups.push({
          date: ds,
          label: (d.getMonth()+1) + '/' + d.getDate(),
          weekday: WEEKDAYS[d.getDay()],
          isToday: ds === today,
          events: dayEvents
        })
      }
    }

    // Also show future events beyond this week
    const futureEvents = allEvents.filter(t => {
      const ed = t.eventDate || (t.createdAt || '').split('T')[0]
      return ed > endStr && t.status === 'open'
    }).slice(0, 5)

    if (futureEvents.length > 0) {
      dayGroups.push({
        date: 'future',
        label: '即将到来',
        weekday: '',
        isToday: false,
        events: futureEvents
      })
    }

    this.setData({ dayGroups, weekLabel })
  },

  _fmtDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
  },

  showDetail(e) {
    const code = e.currentTarget.dataset.code
    wx.request({
      url: app.globalData.serverUrl + '/api/tournaments/' + code,
      success: (res) => {
        const t = res.data
        if (!t) return
        t.eventTypeText = TYPE_TEXTS[t.eventType] || '比赛'
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

    wx.request({
      url: app.globalData.serverUrl + '/api/tournaments/' + modalEvent.code + '/join',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        nickname: formNickname.trim(),
        phone: formPhone.trim(),
        team: formTeam.trim(),
        note: formNote.trim()
      },
      success: (res) => {
        if (res.data && res.data.success !== false && !res.data.error) {
          wx.showToast({ title: '报名成功！', icon: 'success' })
          this.setData({ showModal: false, modalEvent: null })
          this.loadEvents()
        } else {
          wx.showToast({ title: res.data.error || '报名失败', icon: 'none' })
        }
      },
      fail: () => wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  // === Teambuilding Booking ===
  openBooking(e) {
    const nickname = app.globalData.nickname || ''
    this.setData({ showBooking: true, bookingTier: 20, bkContact: nickname })
  },

  closeBooking() {
    this.setData({ showBooking: false })
  },

  selectTier(e) {
    const tier = parseInt(e.currentTarget.dataset.tier)
    this.setData({ bookingTier: tier })
  },

  onBkCompany(e) { this.setData({ bkCompany: e.detail.value }) },
  onBkContact(e) { this.setData({ bkContact: e.detail.value }) },
  onBkPhone(e) { this.setData({ bkPhone: e.detail.value }) },

  submitBooking() {
    const { bkCompany, bkContact, bkPhone, bookingTier } = this.data
    if (!bkCompany.trim()) {
      wx.showToast({ title: '请输入公司名称', icon: 'none' })
      return
    }
    if (!bkContact.trim()) {
      wx.showToast({ title: '请输入联系人', icon: 'none' })
      return
    }
    if (!bkPhone.trim()) {
      wx.showToast({ title: '请输入联系电话', icon: 'none' })
      return
    }

    // Dummy payment — show success directly
    this.setData({ showBooking: false, showPaySuccess: true })
  },

  closePaySuccess() {
    this.setData({ showPaySuccess: false })
    this.loadEvents()
  }
})
