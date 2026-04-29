const app = getApp()

const AGENTS = {
  scout: {
    name: 'AI 选题侦察兵',
    icon: '🔍',
    tagline: '7×24 监控 50+ 信息源 · 每日 50 个高质量选题 · 附"为什么会火"预测分',
    painpoint: '中小老板做内容 90% 的时间花在"今天发什么"上 — 翻竞品、查热搜、刷小红书、看抖音榜，2 小时过去了一条没写出来。一周憋出 3 条还没流量，最后干脆不发了，账号慢慢死掉。',
    mechanism: 'AI 侦察兵 7×24 监控：小红书话题榜 / 抖音热点 / 微博热搜 / 知乎日报 / 行业社群 / 竞品账号 / 用户提问 共 50+ 信息源。基于你的产品定位 + 历史爆款数据 → 每日推送 50 个高质量选题，附「为什么会火」预测分（流量预估 / 受众契合度 / 转化潜力）。',
    rois: [
      { num: '50/天', lbl: '高质量选题' },
      { num: '+5x', lbl: '选题效率' },
      { num: '0.5h', lbl: 'vs 5h/天' }
    ]
  },
  content: {
    name: 'AI 内容工厂',
    icon: '✍️',
    tagline: '一稿多平台 · 朋友圈 / 小红书 / 抖音 / 视频号 / 公众号 风格自适配',
    painpoint: '一个老板一周写不出 5 条内容。同一个产品，朋友圈是带感、小红书是温柔、抖音要 hook + 节奏 + 字幕、视频号要日常感、公众号要深度。5 个平台 = 5 种文笔，找文案外包一条 ¥200-500，一周 5 条 = 一月 ¥2 万还嫌写得不行。',
    mechanism: '喂入产品资料（图 / 视频 / 文档 / 卖点）→ DeepSeek V4 + 自训行业风格模型 → 一键生成：朋友圈短文 ×5 + 小红书图文 ×3 + 抖音脚本 ×3 + 视频号封面文案 ×3 + 公众号长文 ×1。每平台风格 / 长度 / emoji / 话题标签 / hook 节奏 自动适配。一键 A/B 测试多版本。',
    rois: [
      { num: '30/周', lbl: '自动出内容' },
      { num: '5 平台', lbl: '一键多发' },
      { num: '-95%', lbl: '文案成本' }
    ]
  },
  matrix: {
    name: '矩阵号调度官',
    icon: '🌐',
    tagline: '10+ 实名号统一管理 · 反限流策略 · 跨平台一键铺量 · 风控预警',
    painpoint: '老板手机里 10 个微信号 + 5 个小红书号 + 3 个抖音号 → 每个号每天发内容 → 切来切去 4 小时人都麻了。一不小心还被平台限流、风控、封号，养了半年的号秒变废铁。',
    mechanism: '矩阵号统一后台管理：每号绑定独立设备 / IP / 行为指纹 → 按账号人设 + 发布时段 + 平台规则 自动发布。反限流策略（不规则间隔 / 真人行为 / 风险打分） + 限流自动检测 + 备用号热切换。一个老板一台手机，10 个号自动跑。',
    rois: [
      { num: '10+', lbl: '矩阵号' },
      { num: '99.5%', lbl: '安全率' },
      { num: '3min', lbl: '一键全发' }
    ]
  },
  cs: {
    name: 'AI 私域客服',
    icon: '💬',
    tagline: '评论 / 私信 / 微信 / WhatsApp / 邮箱 24×7 自动接待 + 转化 · 8 秒首响',
    painpoint: '内容发出去客户来咨询，老板 30 分钟回不上 → 客户跑了去找竞品。请客服月薪 ¥6000，6 班倒 = 月 ¥3.6w，还是大量重复问题没人答；下班 / 凌晨 / 周末 客户问什么都石沉大海。',
    mechanism: 'AI 客服深度对话（DeepSeek + 产品知识库 + 价格话术库 + FAQ）。处理 80% 重复问题（"价格 / 发货 / 售后"），复杂工单 + 高意向客户 自动同步给销售微信 / CRM。多端打通：抖音评论 / 小红书私信 / 微信好友 / 企业微信 / WhatsApp / 公众号 / 邮箱。',
    rois: [
      { num: '<10s', lbl: '首响' },
      { num: '24×7', lbl: '不下班' },
      { num: '-92%', lbl: '客服成本' }
    ]
  },
  growth: {
    name: '数据增长大脑',
    icon: '📊',
    tagline: '实时 ROI · 投流回报 · 客户旅程归因 · AI 每周自动出优化建议',
    painpoint: '中小老板做营销 90% 凭感觉 —"上周发的怎么样？" "好像还行吧" → 没数据。投流花了 5w 不知道转化了几个客户，更别说哪条内容带来的。月底一看预算烧完成交没几个，复盘也复不了。',
    mechanism: 'AI 增长大脑实时追踪：每条内容 → 每个曝光 → 每个点击 → 每个加微 → 每个咨询 → 每个成交，全链路归因。每周自动出 ROI 排名（哪条内容最赚、哪个平台最值），AI 诊断失败原因（标题 / 时段 / 受众 错配），下周该多做什么 / 砍掉什么 直接给出建议。',
    rois: [
      { num: '+3x', lbl: '投流 ROI' },
      { num: '0', lbl: '靠猜' },
      { num: '周报', lbl: '自动出' }
    ]
  }
}

Page({
  data: {
    statusBarHeight: 44,
    agentOpen: false,
    currentAgent: null,
    aiLoading: false,
    aiPlaying: false,
    industries: [
      { icon: '👔', name: '服装服饰' },
      { icon: '🎨', name: '美容化妆' },
      { icon: '🍴', name: '餐饮零售' },
      { icon: '💍', name: '珠宝首饰' },
      { icon: '🏠', name: '家居建材' },
      { icon: '🚗', name: '汽车后市' },
      { icon: '🎓', name: '教育培训' },
      { icon: '💊', name: '健康医美' },
      { icon: '🏨', name: '本地服务' },
      { icon: '📦', name: '电商代理' }
    ]
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
  },

  goBack() {
    wx.navigateBack({ delta: 1, fail: () => wx.reLaunch({ url: '/pages/landing/landing' }) })
  },

  openAgent(e) {
    const key = e.currentTarget.dataset.key
    const agent = AGENTS[key]
    if (!agent) return
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this._stopTts()
    this._cachedTtsPath = null
    this.setData({ agentOpen: true, currentAgent: agent, aiLoading: false, aiPlaying: false })
  },

  closeAgent() {
    this._stopTts()
    this.setData({ agentOpen: false })
  },

  _noop() {},

  playAgentTTS() {
    try {
      const a = this.data.currentAgent
      if (!a) return
      if (this.data.aiPlaying && this._audioCtx) {
        this._audioCtx.pause()
        this.setData({ aiPlaying: false })
        return
      }
      if (this._cachedTtsPath) {
        this._playFromPath(this._cachedTtsPath)
        return
      }
      const text = `${a.name}。${a.tagline}。${a.painpoint} ${a.mechanism}`.slice(0, 500)
      this.setData({ aiLoading: true })
      const serverUrl = (app && app.globalData && app.globalData.serverUrl) || 'https://crayxus-game.onrender.com'
      wx.request({
        url: serverUrl + '/api/ai/ielts/tts',
        method: 'POST',
        data: { text, voice: 'zh-female' },
        timeout: 30000,
        success: (r) => {
          const d = r.data
          if (d && d.ok && d.audio) this._writeAndPlay(d.audio)
          else { this.setData({ aiLoading: false }); wx.showToast({ title: 'AI 语音暂不可用', icon: 'none' }) }
        },
        fail: () => { this.setData({ aiLoading: false }); wx.showToast({ title: '网络异常', icon: 'none' }) }
      })
    } catch(e) { this.setData({ aiLoading: false }) }
  },

  _writeAndPlay(uri) {
    try {
      const m = uri.match(/^data:audio\/(\w+);base64,(.*)$/)
      if (!m) { this.setData({ aiLoading: false }); return }
      const fs = wx.getFileSystemManager()
      const path = `${wx.env.USER_DATA_PATH}/admind_${Date.now()}.mp3`
      fs.writeFile({
        filePath: path, data: m[2], encoding: 'base64',
        success: () => { this._cachedTtsPath = path; this.setData({ aiLoading: false }); this._playFromPath(path) },
        fail: () => this.setData({ aiLoading: false })
      })
    } catch(e) { this.setData({ aiLoading: false }) }
  },

  _playFromPath(path) {
    try {
      this._stopTts()
      const ctx = wx.createInnerAudioContext()
      ctx.src = path
      ctx.onPlay(() => this.setData({ aiPlaying: true }))
      ctx.onPause(() => this.setData({ aiPlaying: false }))
      ctx.onEnded(() => this.setData({ aiPlaying: false }))
      ctx.onError(() => this.setData({ aiPlaying: false }))
      this._audioCtx = ctx
      ctx.play()
    } catch(e) {}
  },

  _stopTts() {
    if (this._audioCtx) { try { this._audioCtx.stop(); this._audioCtx.destroy() } catch(e){} this._audioCtx = null }
    this.setData({ aiPlaying: false })
  },

  onUnload() { this._stopTts() }
})
