Page({
  data: {
    teacher: {
      name: '王老师',
      avatar: '👩‍🏫',
      subject: 'SAT / AP',
      school: '光华国际高中'
    },

    classes: [
      { id: 'c10-2', name: '10 年级 2 班' },
      { id: 'c10-3', name: '10 年级 3 班' },
      { id: 'c11-1', name: '11 年级 1 班' }
    ],
    currentClass: { id: 'c10-2', name: '10 年级 2 班' },

    stats: {
      total: 32,
      active: 28,
      avgMatch: 78,        // 班级匹配度均值
      avgGain: 14,         // 班级提分均值
      accuracy: 72,
      monthLabel: '2026 年 4 月'
    },

    classDims: [
      { key: 'algebra', name: '代数运算', val: 78, color: '#00d4aa' },
      { key: 'geometry', name: '几何图形', val: 65, color: '#7c4dff' },
      { key: 'word',     name: '词汇量',   val: 70, color: '#ffd700' },
      { key: 'reading',  name: '阅读理解', val: 68, color: '#ff6b9d' },
      { key: 'writing',  name: '学术写作', val: 62, color: '#4facfe' },
      { key: 'logic',    name: '逻辑推理', val: 74, color: '#43e97b' }
    ],

    top3: [
      { rank: 1, name: '陈嘉慧', score: 92, gain: 18 },
      { rank: 2, name: '林若曦', score: 88, gain: 15 },
      { rank: 3, name: '王子墨', score: 85, gain: 12 }
    ],

    // match = 匹配度 (Match Drive 0-100) · gain = 提分 (Boost Drive)
    roster: [
      { id: 's01', rank: 1, name: '陈嘉慧', match: 92, score: 92, gain: 18, plan: 'star',    planText: '月度之星' },
      { id: 's02', rank: 2, name: '林若曦', match: 88, score: 88, gain: 15, plan: 'star',    planText: '月度之星' },
      { id: 's03', rank: 3, name: '王子墨', match: 85, score: 85, gain: 12, plan: 'star',    planText: '月度之星' },
      { id: 's04', rank: 4, name: '李思远', match: 82, score: 78, gain: 9,  plan: 'year',    planText: '年付' },
      { id: 's05', rank: 5, name: '张小明', match: 86, score: 73, gain: 6,  plan: 'quarter', planText: '季度' },
      { id: 's06', rank: 6, name: '刘雨桐', match: 75, score: 71, gain: 4,  plan: 'quarter', planText: '季度' },
      { id: 's07', rank: 7, name: '赵梓涵', match: 72, score: 68, gain: 3,  plan: 'month',   planText: '月付' },
      { id: 's08', rank: 8, name: '周文浩', match: 68, score: 65, gain: 2,  plan: 'month',   planText: '月付' },
      { id: 's09', rank: 9, name: '吴佳怡', match: 64, score: 62, gain: 0,  plan: 'trial',   planText: '试用' },
      { id: 's10', rank: 10, name: '孙悦',  match: 58, score: 58, gain: -2, plan: 'trial',   planText: '试用' }
    ]
  },

  onLoad() {
    try { wx.vibrateShort && wx.vibrateShort({ type: 'light' }) } catch(e) {}
  },

  onError(err) {
    try {
      const app = getApp()
      if (app && app.globalData && app.globalData.serverUrl) {
        wx.request({
          url: app.globalData.serverUrl + '/api/log',
          method: 'POST',
          data: { type: 'error', page: 'teacher-dashboard', err: String(err).slice(0, 500) },
          fail: () => {}
        })
      }
    } catch(e) {}
  },

  selectClass(e) {
    try {
      const id = e.currentTarget.dataset.id
      const cls = this.data.classes.find(c => c.id === id)
      if (!cls) return
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
      this.setData({ currentClass: cls })
      wx.showToast({ title: '已切换到 ' + cls.name, icon: 'none' })
    } catch(e) {}
  },

  viewStudent(e) {
    const id = e.currentTarget.dataset.id
    const stu = this.data.roster.find(s => s.id === id)
    if (!stu) return
    const gainText = stu.gain > 0 ? '+' + stu.gain : stu.gain
    wx.showModal({
      title: stu.name,
      content: `匹配度 M · ${stu.match} / 100\n提分 B · ${gainText}\n最新分数 · ${stu.score}\n账号类型 · ${stu.planText}`,
      showCancel: false,
      confirmText: '关闭'
    })
  },

  issueCerts() {
    wx.showModal({
      title: '🎓 一键发放月度之星',
      content: `本月 Top 3：\n🥇 陈嘉慧\n🥈 林若曦\n🥉 王子墨\n\n确认后，这三位同学将获得下月免费使用权，并发送电子证书到家长端。`,
      confirmText: '确认发放',
      confirmColor: '#ffd700',
      success: (r) => {
        if (r.confirm) {
          wx.showToast({ title: '证书已发放 🏆', icon: 'success' })
        }
      }
    })
  },

  exportReport() {
    wx.showToast({ title: '报告已生成并发送至邮箱', icon: 'success' })
  },

  startTest() {
    wx.showModal({
      title: '📝 发起班级月度测评',
      content: `将通知 ${this.data.stats.total} 位学生完成 20 题测评，AI 自动出结果并更新榜单。`,
      confirmText: '立即发起',
      confirmColor: '#00d4aa',
      success: (r) => {
        if (r.confirm) {
          wx.showToast({ title: '已发起，学生端已推送', icon: 'success' })
        }
      }
    })
  }
})
