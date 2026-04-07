const app = getApp()

const COURSES = [
  {
    id: 'decompose', name: '组牌分解', icon: '🃏', color: '#58cc02',
    desc: '学习最优手牌拆分策略',
    lessons: [
      { id: 1, name: '认识牌型', free: true },
      { id: 2, name: '单张与对子' },
      { id: 3, name: '三条与三带' },
      { id: 4, name: '顺子构造' },
      { id: 5, name: '连对技巧' },
      { id: 6, name: '钢板与飞机' },
      { id: 7, name: '拆牌取舍' },
      { id: 8, name: '多策略对比' },
      { id: 9, name: 'M值最优化' },
      { id: 10, name: '综合实战' },
    ]
  },
  {
    id: 'power', name: '大牌控制', icon: '👑', color: '#ffc800',
    desc: '掌握牌权与大牌时机',
    lessons: [
      { id: 1, name: '什么是牌权', free: true },
      { id: 2, name: 'A的使用' },
      { id: 3, name: '2的价值' },
      { id: 4, name: '王牌策略' },
      { id: 5, name: '蛋牌妙用' },
      { id: 6, name: '控场节奏' },
      { id: 7, name: '牌权转换' },
      { id: 8, name: '压制与放行' },
      { id: 9, name: '尾牌控制' },
      { id: 10, name: '综合实战' },
    ]
  },
  {
    id: 'timing', name: '出牌时机', icon: '⏱️', color: '#00bcd4',
    desc: '选择最佳出牌节奏',
    lessons: [
      { id: 1, name: '先手出牌', free: true },
      { id: 2, name: '跟牌策略' },
      { id: 3, name: '过牌时机' },
      { id: 4, name: '速攻节奏' },
      { id: 5, name: '稳守反击' },
      { id: 6, name: '末家优势' },
      { id: 7, name: '牌数压制' },
      { id: 8, name: '读牌出牌' },
      { id: 9, name: '终局时机' },
      { id: 10, name: '综合实战' },
    ]
  },
  {
    id: 'teamwork', name: '队友配合', icon: '🤝', color: '#e91e63',
    desc: '学会与队友高效协作',
    lessons: [
      { id: 1, name: '配合基础', free: true },
      { id: 2, name: '送牌技术' },
      { id: 3, name: '让牌时机' },
      { id: 4, name: '信号传递' },
      { id: 5, name: '接风策略' },
      { id: 6, name: '保护队友' },
      { id: 7, name: '双上战术' },
      { id: 8, name: '牺牲打法' },
      { id: 9, name: '默契配合' },
      { id: 10, name: '综合实战' },
    ]
  },
  {
    id: 'bomb', name: '炸弹使用', icon: '💣', color: '#ff6b35',
    desc: '精准使用炸弹资源',
    lessons: [
      { id: 1, name: '炸弹类型', free: true },
      { id: 2, name: '炸弹时机' },
      { id: 3, name: '炸弹选择' },
      { id: 4, name: '留炸策略' },
      { id: 5, name: '多炸管理' },
      { id: 6, name: '对炸博弈' },
      { id: 7, name: '拆炸出牌' },
      { id: 8, name: '造炸技巧' },
      { id: 9, name: '炸弹心理' },
      { id: 10, name: '综合实战' },
    ]
  },
  {
    id: 'endgame', name: '终局处理', icon: '🏁', color: '#a78bfa',
    desc: '关键时刻决定胜负',
    lessons: [
      { id: 1, name: '残局基础', free: true },
      { id: 2, name: '计算剩牌' },
      { id: 3, name: '必胜判断' },
      { id: 4, name: '三家残局' },
      { id: 5, name: '双人对抗' },
      { id: 6, name: '逼牌技术' },
      { id: 7, name: '守末策略' },
      { id: 8, name: '翻盘时机' },
      { id: 9, name: '比分策略' },
      { id: 10, name: '综合实战' },
    ]
  }
]

Page({
  data: {
    statusBarHeight: 44,
    courses: [],
    selectedCourse: null,
    progress: {}
  },

  onLoad() {
    try {
      const sys = wx.getWindowInfo()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
  },

  onShow() {
    this.syncFromServer(() => this.loadProgress())
  },

  _getUserId() {
    let uid = wx.getStorageSync('crayxus_uid')
    if (!uid) {
      uid = 'wx-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      wx.setStorageSync('crayxus_uid', uid)
    }
    return uid
  },

  syncFromServer(cb) {
    const userId = this._getUserId()
    wx.request({
      url: app.globalData.serverUrl + '/api/progress/' + userId,
      success: (res) => {
        if (res.data && res.data.success && res.data.data && res.data.data.courses) {
          // 合并远程进度
          const local = wx.getStorageSync('crayxus_academy') || {}
          const remote = res.data.data.courses
          Object.keys(remote).forEach(courseId => {
            if (!local[courseId]) local[courseId] = {}
            Object.keys(remote[courseId]).forEach(lessonIdx => {
              if (remote[courseId][lessonIdx] === 'done') {
                local[courseId][lessonIdx] = 'done'
              }
            })
          })
          wx.setStorageSync('crayxus_academy', local)
        }
        if (cb) cb()
      },
      fail: () => { if (cb) cb() }
    })
  },

  syncToServer() {
    const userId = this._getUserId()
    const progress = wx.getStorageSync('crayxus_academy') || {}
    const danli = wx.getStorageSync('crayxus_danli') || {}
    const egg = wx.getStorageSync('crayxus_egg') || {}
    wx.request({
      url: app.globalData.serverUrl + '/api/progress',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        userId,
        data: { courses: progress, danli, egg, source: 'miniprogram' }
      }
    })
  },

  loadProgress() {
    const progress = wx.getStorageSync('crayxus_academy') || {}

    const courses = COURSES.map(c => {
      const cp = progress[c.id] || {}
      const completed = Object.keys(cp).filter(k => cp[k] === 'done').length
      const total = c.lessons.length
      const pct = Math.round(completed / total * 100)
      const stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0

      const lessons = c.lessons.map((l, i) => {
        const unlocked = i === 0 || l.free || (cp[String(i)] === 'done')
        // 上一课完成则解锁下一课
        const prevDone = i === 0 || cp[String(i - 1)] === 'done'
        return { ...l, unlocked: unlocked || prevDone, done: cp[String(i)] === 'done' }
      })

      return { ...c, lessons, completed, total, pct, stars }
    })

    this.setData({ courses, progress })
  },

  goBack() {
    wx.navigateBack()
  },

  selectCourse(e) {
    const id = e.currentTarget.dataset.id
    const course = this.data.courses.find(c => c.id === id)
    this.setData({ selectedCourse: course })
  },

  backToList() {
    this.setData({ selectedCourse: null })
  },

  startLesson(e) {
    const lessonIdx = e.currentTarget.dataset.idx
    const course = this.data.selectedCourse
    const lesson = course.lessons[lessonIdx]

    if (!lesson.unlocked) {
      wx.showToast({ title: '请先完成上一课', icon: 'none' })
      return
    }

    // 维度映射: courseId → quiz dimension name
    const dimMap = {
      decompose: '组牌分解',
      power: '大牌控制',
      timing: '出牌时机',
      teamwork: '队友配合',
      bomb: '炸弹使用',
      endgame: '终局处理'
    }
    const dim = dimMap[course.id] || course.name

    // 跳转到quiz页面，lesson模式：从该维度抽5题
    wx.navigateTo({
      url: `/pages/quiz/quiz?mode=lesson&dim=${encodeURIComponent(dim)}&courseId=${course.id}&lessonIdx=${lessonIdx}&lessonName=${encodeURIComponent(lesson.name)}`
    })
  }
})
