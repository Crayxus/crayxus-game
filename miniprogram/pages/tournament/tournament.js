const app = getApp()

const TYPE_TEXTS = { teambuilding: '团建', bounty_team: 'AI Bounty Team', bounty_solo: 'AI Bounty Solo', bounty: 'AI Bounty', open: '公开赛' }
const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

Page({
  data: {
    statusBarHeight: 44,
    loading: true,
    allEvents: [],
    // Calendar
    monthOffset: 0,
    monthLabel: '',
    calCells: [],
    selectedEvent: null,
    // Detail modal
    showDetailModal: false,
    detailEvent: null,
    // Join modal
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

  // === Month navigation ===
  prevMonth() {
    this.setData({ monthOffset: this.data.monthOffset - 1, selectedEvent: null })
    this._buildCalendar()
  },
  nextMonth() {
    this.setData({ monthOffset: this.data.monthOffset + 1, selectedEvent: null })
    this._buildCalendar()
  },

  // === Load events ===
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

  // === Build monthly calendar grid ===
  _buildCalendar() {
    const { allEvents, monthOffset } = this.data
    const now = new Date()
    const today = this._fmtDate(now)

    // Target month
    const year = now.getFullYear()
    const month = now.getMonth() + monthOffset
    const target = new Date(year, month, 1)
    const tYear = target.getFullYear()
    const tMonth = target.getMonth()

    const monthLabel = tYear + '年' + MONTH_NAMES[tMonth]

    // First day of month (0=Sun)
    const firstDay = new Date(tYear, tMonth, 1).getDay()
    // Days in month
    const daysInMonth = new Date(tYear, tMonth + 1, 0).getDate()

    // Monday-based offset: how many cells before day 1
    const startOffset = (firstDay + 6) % 7  // Mon=0, Tue=1, ... Sun=6

    // Build event lookup by date
    const eventMap = {}
    allEvents.forEach(t => {
      const ed = t.eventDate || (t.createdAt || '').split('T')[0]
      if (!eventMap[ed]) eventMap[ed] = []
      eventMap[ed].push(t)
    })

    // Build 42 cells (6 rows × 7 cols)
    const calCells = []
    for (let i = 0; i < 42; i++) {
      const dayNum = i - startOffset + 1
      const isOtherMonth = dayNum < 1 || dayNum > daysInMonth

      let d, ds, actualDay
      if (isOtherMonth) {
        d = new Date(tYear, tMonth, dayNum)
        ds = this._fmtDate(d)
        actualDay = d.getDate()
      } else {
        d = new Date(tYear, tMonth, dayNum)
        ds = this._fmtDate(d)
        actualDay = dayNum
      }

      const dayOfWeek = d.getDay()
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

      // Determine cell type from events
      let type = ''
      let shortName = ''
      const dayEvents = eventMap[ds] || []
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

      if (dayEvents.length > 0) {
        const ev = dayEvents[0]
        if (ev.eventType === 'bounty_team') {
          type = (ev.status === 'booked' || ev.status === 'finished') ? 'booked' : 'bounty_team'
        } else if (ev.eventType === 'bounty_solo' || ev.eventType === 'bounty') {
          type = (ev.status === 'finished' || (ev.capacity > 0 && (ev.players || []).length >= ev.capacity)) ? 'bounty_full' : 'bounty_solo'
        } else if (ev.eventType === 'teambuilding') {
          type = ev.status === 'booked' ? 'booked' : 'available'
        } else if (ev.eventType === 'open') {
          type = 'open'
          shortName = ev.name ? ev.name.substring(0, 4) : '赛事'
        }
      } else if (!isOtherMonth && dayOfWeek === 1) {
        type = 'dayoff'
      } else if (!isOtherMonth && isWeekend) {
        type = 'bounty_solo'
      } else if (!isOtherMonth && !isWeekend) {
        type = 'bounty_team'
      }

      calCells.push({
        date: ds,
        d: actualDay,
        isToday: ds === today,
        isOtherMonth,
        isWeekday,
        type,
        shortName,
        events: dayEvents
      })
    }

    this.setData({ calCells, monthLabel })
  },

  _fmtDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
  },

  // === Cell tap → show detail card or modal ===
  onCellTap(e) {
    const date = e.currentTarget.dataset.date
    const type = e.currentTarget.dataset.type
    if (!type) {
      this.setData({ selectedEvent: null })
      return
    }

    // Find events for this date
    const dayEvents = this.data.allEvents.filter(t => {
      const ed = t.eventDate || (t.createdAt || '').split('T')[0]
      return ed === date
    })

    // Day off - Monday
    if (type === 'dayoff') return

    // Auto-filled date (no API event)
    if (dayEvents.length === 0) {
      const d = new Date(date + 'T12:00:00')
      const dow = d.getDay()
      if (dow === 1) return // Monday is day off
      const isWeekend = dow === 0 || dow === 6

      if (isWeekend) {
        // AI Solo - show signup modal directly
        this.setData({
          selectedEvent: {
            displayName: 'AI Bounty Solo',
            tagText: '免费·个人',
            tagClass: 'tag-bounty-solo',
            eventType: 'bounty_solo',
            eventDate: date,
            eventTime: '13:00',
            location: '杭州 · 待定',
            description: '周末免费参赛，击败AI赢奖金！',
            status: 'upcoming',
            isAutoFill: true
          }
        })
      } else {
        // AI Team - show booking modal
        this.setData({
          selectedEvent: {
            displayName: 'AI Bounty Team',
            tagText: '付费·组队',
            tagClass: 'tag-bounty-team',
            eventType: 'bounty_team',
            eventDate: date,
            eventTime: '14:00',
            location: '杭州 · 可预约',
            description: '工作日组队挑战，付费参赛击败AI赢奖金！',
            status: 'upcoming',
            isAutoFill: true
          }
        })
      }
      return
    }

    const ev = dayEvents[0]
    let tagText = '', tagClass = ''
    if (ev.eventType === 'bounty_team') {
      if (ev.status === 'booked' || ev.status === 'finished') {
        tagText = '已占'
        tagClass = 'tag-booked'
      } else {
        tagText = '付费·组队'
        tagClass = 'tag-bounty-team'
      }
    } else if (ev.eventType === 'bounty_solo' || ev.eventType === 'bounty') {
      if (ev.status === 'finished' || (ev.capacity > 0 && (ev.players || []).length >= ev.capacity)) {
        tagText = '已满'
        tagClass = 'tag-full'
      } else {
        tagText = '免费·个人'
        tagClass = 'tag-bounty-solo'
      }
    } else if (ev.eventType === 'teambuilding' && ev.status === 'booked') {
      tagText = '已预约'
      tagClass = 'tag-booked'
    } else if (ev.eventType === 'teambuilding') {
      tagText = '可预约'
      tagClass = 'tag-avail'
    } else if (ev.status === 'open') {
      tagText = '报名中'
      tagClass = 'tag-open'
    } else {
      tagText = '已结束'
      tagClass = 'tag-closed'
    }

    const displayName = ev.eventType === 'teambuilding'
      ? (ev.status === 'booked' ? (ev.bookedBy || '企业团建') + ' · 已占用' : '企业团建 · 可预约')
      : ev.name

    this.setData({
      selectedEvent: {
        ...ev,
        displayName,
        tagText,
        tagClass,
        eventType: ev.eventType,
        playerCount: (ev.players || []).length,
        capPct: ev.capacity > 0 ? Math.min((ev.players || []).length / ev.capacity * 100, 100) : 0
      }
    })
  },

  // === Auto-fill signup (Solo free) ===
  openAutoSignup() {
    const ev = this.data.selectedEvent
    if (!ev) return
    this.setData({
      showModal: true,
      modalEvent: {
        name: ev.displayName + ' · ' + ev.eventDate,
        code: null,
        isAutoFill: true,
        eventDate: ev.eventDate,
        eventTime: ev.eventTime,
        eventType: ev.eventType
      }
    })
  },

  // === Detail modal ===
  showDetail(e) {
    const code = e.currentTarget.dataset.code
    wx.request({
      url: app.globalData.serverUrl + '/api/tournaments/' + code,
      success: (res) => {
        const t = res.data
        if (!t) return
        t.eventTypeText = TYPE_TEXTS[t.eventType] || '比赛'
        t.playerCount = (t.players || []).length
        this.setData({ showDetailModal: true, detailEvent: t })
      },
      fail: () => wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  closeDetailModal() {
    this.setData({ showDetailModal: false, detailEvent: null })
  },

  // === Join form ===
  openJoinForm() {
    this.setData({
      showDetailModal: false,
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

    // Auto-fill event (no real code yet)
    if (modalEvent.isAutoFill || !modalEvent.code) {
      wx.showToast({ title: '报名成功！开放后通知您', icon: 'success' })
      this.setData({ showModal: false, modalEvent: null })
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
  openBooking() {
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
    const { bkCompany, bkContact, bkPhone } = this.data
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
    this.setData({ showBooking: false, showPaySuccess: true })
  },

  closePaySuccess() {
    this.setData({ showPaySuccess: false })
    this.loadEvents()
  }
})
