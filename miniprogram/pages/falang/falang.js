const app = getApp()

const AGENTS = {
  design: {
    name: '辅料采购智能跟单官',
    icon: '📦',
    tagline: '一年 1000+ 款不再漏单 · ERP 之上的"AI 督办员" · 直击辅料采购遗忘痛点',
    painpoint: '法良一年流转超 1000 个款，每个款数十种辅料（拉链、扣子、绗棉、压胶、绣标、吊牌……），采购员靠人脑记忆跟进，常因遗忘跟单导致辅料晚到、缝制线停工、整批订单延期出运。ERP 上线两年，但操作繁琐、录入复杂，前端采购就是不愿用。',
    mechanism: 'AI 跟单官常驻在每位采购员的微信/小程序：每天自动扫描全部 1000+ 款的辅料状态（已下单/在途/到货/缺货），用大模型按交期紧急度生成"今日必跟" Top 20 名单，附带每条的 5 秒话术（"提醒 XX 供应商 KING LOUIE 这单的拉链交期还有 3 天"）。采购员一键发起跟进，AI 记录回复并自动更新 ERP，绕开繁琐手填。',
    rois: [
      { num: '0', lbl: '漏跟单数' },
      { num: '-70%', lbl: '生产延误' },
      { num: '5s', lbl: '一条跟单' }
    ]
  },
  schedule: {
    name: '物料标准化大脑',
    icon: '🧬',
    tagline: '物料描述不统一 · 多 Excel 混乱 · AI 自动归一 · ERP 不再录入痛苦',
    painpoint: '不同业务组 Excel 表格式不一、字段名称不统一，同一根拉链在 A 组叫"YKK 5# 黑"、B 组叫"5号YKK黑色"、C 组又叫"日本 YKK Vislon 黑"，多人录入混乱，物料字段几十项，一人录不完。ERP 上线两年推不动，根源就在这里。',
    mechanism: 'AI 物料大脑学习法良 21 年物料库 + 26 个品牌历史 BOM，建立标准物料词典（物料 ID/规格/颜色/克重/供应商等固定字段）。任何业务员上传杂乱 Excel，AI 自动识别 → 字段映射 → 描述归一 → 一键写入 ERP。下拉选择 + 固定字段 + 操作视频自动生成（按法良会议提议）。',
    rois: [
      { num: '95%', lbl: '描述准确率' },
      { num: '-90%', lbl: '录入工时' },
      { num: '1人', lbl: '可顶 5 人' }
    ]
  },
  quality: {
    name: 'AI 供应商评估官',
    icon: '🏆',
    tagline: '降本 / 增效 / 提质 / 创新 · AI 给所有供应商打分排名 · 用数据说话',
    painpoint: '法良会议提到："智能体在数据分析、供应商评估排名上或优于 ERP"。事实就是：法良有几百家辅料/面料供应商，但谁交期准、谁价格优、谁品质稳，目前靠采购员的"经验印象"，没有量化排名，新业务员上手要踩坑半年。',
    mechanism: 'AI 实时分析每家供应商的全维度数据：交期达成率、报价波动、来料合格率、订单响应时长、央采/军采合规等级。每月自动出榜 → 红榜（推荐扩单）/ 黄榜（关注）/ 黑榜（替换）。新业务员一打开 AI 助手就能看到"这个款 YKK 拉链的最佳供应商前 3 名"，免去经验依赖。',
    rois: [
      { num: 'A/B/C', lbl: '三档评级' },
      { num: '降本', lbl: '5-12%' },
      { num: '0', lbl: '经验门槛' }
    ]
  },
  customer: {
    name: '服装行业翻译官',
    icon: '🌐',
    tagline: '中英文合并 · 服装行业垂域定制 · Token 计费透明 · 比通用翻译便宜 80%',
    painpoint: '法良 26 个国际品牌客户，每天大量邮件、订单、技术文件需中英互译。通用翻译服务（DeepL、Google）贵且不懂服装行业术语（"拉舍尔绗缝""冲锋衣压胶""高弹梭织")，翻得不准；找人工翻译费用更高。法良会议明确提出"需要中英文合并 + 服装行业定制 + 透明 token 计费"。',
    mechanism: '基于 DeepSeek + 法良 21 年中英对照档案训练垂域翻译模型。专精棉羽 / 户外 / 冲锋衣 / 西装 / 标化术语。一个邮件粘进来 → AI 自动出**中英对照合并版**（左中右英，方便外贸来回沟通）。Token 实际用量透明计费，按使用付费，约 ¥0.001/千字。',
    rois: [
      { num: '-80%', lbl: '翻译成本' },
      { num: '中英', lbl: '合并对照' },
      { num: '行业级', lbl: '术语准' }
    ]
  },
  coding: {
    name: '物料编码 + 基础资料录入助手',
    icon: '🏷️',
    tagline: '基础资料没人愿意录？拉链编码上千种？AI 一键搞定 · 直击 11/16 会议痛点',
    painpoint: '法良 11 月会议明确提出三大基础资料痛点：① 基础资料录入枯燥，懂行的人不愿做，工作一直被推诿；② 拉链等服装物料编码繁多，缺统一规则，业务员只能手动输入易出错；③ Excel 表应用不完善，需"下拉选择"代替"手动输入"才能推动 ERP 落地。',
    mechanism: 'AI 编码大脑学习服装物料分类逻辑，**按共性自动分类编码**：拉链按 [尺寸 × 开口/闭口 × 挂拉头/无 × 拉头工艺] 四维度自动生成 8 位标准编码（如 YK-5C-OH-PL = YKK 5#闭口挂拉头普拉头）。供应商发的 PI / 技术包 / 报价单粘进来 → AI 自动提取参数 → 编码 → 写 ERP。基础录入工作交给 AI，懂行的人只需做最后审核。Excel 模板自动生成下拉选项，禁止手动输入。',
    rois: [
      { num: '8 位', lbl: '统一编码' },
      { num: '-95%', lbl: '人工录入' },
      { num: '0', lbl: '推诿空间' }
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
    // 物料编码 demo
    encInput: '',
    encLoading: false,
    encResult: null,
    brands: [
      { name: 'KING LOUIE', year: '20 年' },
      { name: 'KARL LAGERFELD', year: '2024' },
      { name: 'BOSIDENG 波司登', year: '2022' },
      { name: 'Blauer USA', year: '10 年' },
      { name: 'WELLENSTEYN', year: '14 年' },
      { name: 'J.LINDEBERG', year: '7 年' },
      { name: 'NICOLE BENISTI', year: '5 年' },
      { name: 'K-WAY', year: '5 年' },
      { name: 'AIRFORCE', year: '22 年' },
      { name: 'NOBIS', year: '加拿大' },
      { name: 'SAIL RACING', year: '北欧' },
      { name: 'MEILLEUR MOMENT', year: '法国' }
    ]
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
  },

  onEncInput(e) {
    this.setData({ encInput: e.detail.value })
  },

  useQuick(e) {
    this.setData({ encInput: e.currentTarget.dataset.text }, () => {
      this.runEncode()
    })
  },

  resetEncode() {
    this.setData({ encResult: null, encInput: '' })
  },

  runEncode() {
    const desc = (this.data.encInput || '').trim()
    if (!desc) {
      wx.showToast({ title: '请先输入物料描述', icon: 'none' })
      return
    }
    if (this.data.encLoading) return
    this.setData({ encLoading: true })
    const serverUrl = (app && app.globalData && app.globalData.serverUrl) || 'https://crayxus-game.onrender.com'
    wx.request({
      url: serverUrl + '/api/ai/falang/encode-material',
      method: 'POST',
      data: { description: desc },
      timeout: 45000,
      success: (r) => {
        const d = r.data
        if (d && d.ok && d.code) {
          const erpKeys = d.erp_record ? Object.keys(d.erp_record) : []
          const confMap = { '高': 'high', '中': 'mid', '低': 'low' }
          const confClass = confMap[d.confidence] || 'mid'
          this.setData({
            encLoading: false,
            encResult: { ...d, erpKeys, confClass }
          })
          wx.vibrateShort && wx.vibrateShort({ type: 'light' })
        } else {
          this.setData({ encLoading: false })
          wx.showToast({ title: 'AI 解析失败，请换个描述', icon: 'none' })
        }
      },
      fail: () => {
        this.setData({ encLoading: false })
        wx.showToast({ title: '网络异常', icon: 'none' })
      }
    })
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
      const path = `${wx.env.USER_DATA_PATH}/falang_${Date.now()}.mp3`
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
