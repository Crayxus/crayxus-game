Page({
  data: {
    reportId: '0427A',

    compat: {
      score: 86,
      tier: 'high',
      tierText: '极佳匹配',
      personality: '策略型学习者',
      boostPotential: '强',
      testedAt: '2026-04-15 14:22'
    },

    dims: [
      { key: 'logic',    name: '逻辑推理', icon: '🧠', val: 92, color: '#00eaff' },
      { key: 'memory',   name: '记忆速度', icon: '💡', val: 78, color: '#ffd700' },
      { key: 'visual',   name: '视觉空间', icon: '👁', val: 82, color: '#7c4dff' },
      { key: 'language', name: '语言组织', icon: '💬', val: 88, color: '#00d4aa' },
      { key: 'focus',    name: '专注耐力', icon: '🎯', val: 74, color: '#ff6b35' },
      { key: 'motiv',    name: '学习动机', icon: '🔥', val: 95, color: '#ff3b30' }
    ],

    recommendations: [
      {
        title: '建议主攻 AP / SAT 方向',
        desc: '你的逻辑推理与学习动机双高，更适合结构化、长周期的标化考试冲刺。'
      },
      {
        title: '专注耐力相对薄弱',
        desc: '建议单次学习 25-30 分钟为一个单元，中间穿插 5 分钟休息，提升效率 30%+。'
      },
      {
        title: '充分利用自适应训练',
        desc: 'BOOST 引擎会根据你的薄弱点每周自动推 40-60 道高质量题，坚持 6 周可提分 15-25。'
      },
      {
        title: '每月冲榜 · Top 3 免费',
        desc: '以你当前能力，只要每周完成 5 小时训练，预计第 2 个月可进 Top 3，获得次月免费使用权。'
      }
    ],

    plan: {
      name: '季度付方案',
      price: 499,
      unit: '科/季',
      reason: '基于你的动机 + 兼容指数，季度付是最适合你的节奏 —— 既有足够时间看到成绩，又保留换档灵活性。按学科独立计费，选几门修几门。',
      subject: 'AP · SAT',
      weeklyHours: 5,
      expectedGain: 18
    }
  },

  onLoad() {
    try { wx.vibrateShort && wx.vibrateShort({ type: 'light' }) } catch(e) {}
    this._loadFromStorage()
  },

  onShow() {
    this._loadFromStorage()
  },

  _loadFromStorage() {
    try {
      const saved = wx.getStorageSync('crayxus_prescreen')
      if (saved && saved.done) {
        const score = saved.score || 0
        const tier = score >= 80 ? 'high' : score >= 65 ? 'mid' : 'low'
        const tierText = score >= 80 ? '极佳匹配' : score >= 65 ? '良好匹配' : '一般匹配'
        // 根据实际分数生成报告数据
        const plan = {
          name: saved.recommendPlan || '季度付方案',
          price: saved.recommendPlan === '月付方案' ? 199 : saved.recommendPlan === '年付方案' ? 1680 : 499,
          unit: saved.recommendPlan === '月付方案' ? '科/月' : saved.recommendPlan === '年付方案' ? '科/年' : '科/季',
          reason: `基于你的动机 + 兼容指数 ${score}，${saved.recommendPlan || '季度付方案'}是最适合你的节奏。按学科独立计费，选几门修几门。`,
          subject: saved.recommendSubject || 'AP · SAT',
          weeklyHours: score >= 85 ? 6 : score >= 75 ? 5 : 4,
          expectedGain: Math.round(score / 5) + 5
        }
        this.setData({
          compat: {
            score,
            tier,
            tierText,
            personality: saved.personality || '策略型学习者',
            boostPotential: saved.boostPotential || '中',
            testedAt: (saved.testedAt || '') + ' 14:22'
          },
          plan
        })
      } else {
        // 未测评：直接回 scoreboost 提示先做测评
        wx.showToast({ title: '请先完成匹配度测评', icon: 'none', duration: 1500 })
        setTimeout(() => { wx.navigateBack() }, 1000)
      }
    } catch(e) { console.warn('[pre-screen load]', e) }
  },

  onError(err) {
    try {
      const app = getApp()
      if (app && app.globalData && app.globalData.serverUrl) {
        wx.request({
          url: app.globalData.serverUrl + '/api/log',
          method: 'POST',
          data: { type: 'error', page: 'pre-screen', err: String(err).slice(0, 500) },
          fail: () => {}
        })
      }
    } catch(e) {}
  },

  shareReport() {
    wx.showModal({
      title: '📤 分享给家长',
      content: '生成专属链接后，可发送给家长端查看完整报告（含详细策略分析）。',
      confirmText: '生成链接',
      confirmColor: '#00eaff',
      success: (r) => {
        if (r.confirm) {
          wx.showToast({ title: '链接已复制', icon: 'success' })
        }
      }
    })
  },

  backToHub() {
    wx.navigateBack()
  }
})
