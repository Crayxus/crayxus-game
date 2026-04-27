const app = getApp()

const AGENTS = {
  scout: {
    name: 'AI 选址侦察兵 · 韩国版',
    icon: '🛰️',
    tagline: '명동 / 강남 / 홍대 / 이태원 · KakaoMap POI × Naver 热力 × 商圈租金 · 出 Top 200 候选',
    painpoint: '韩国市场看似简单实则最贵 · 首尔黄金商圈租金中国 5-8 倍，江南 1 平米月租 ₩280 万，强排第一名"明洞 1 区"商户开口要 ₩500 万入场费。中国玩家直接出海首尔 90% 死在选址：要么定在游客密集但回购率低的免税街、要么定在韩国本地人不会用充电宝的居民区。',
    mechanism: 'AI 侦察兵接入：KakaoMap / Naver Map POI + 韩国통계청（统计厅）人口密度 + KB부동산 商圈租金 + 韩国旅游公社外国游客热力 + 现有 ChargeSPOT/PowerNo 韩国版已铺点位。每个商圈自动出 Top 200 候选点 → 预测日均订单数 + 谈判优先级。BD 拿着排名表直接和韩国本地합작사（合作社）谈，不用瞎跑。',
    rois: [
      { num: '-83%', lbl: 'BD 人力' },
      { num: '6-12m', lbl: '单点回本' },
      { num: '200', lbl: '候选 / 商圈' }
    ]
  },
  dispatch: {
    name: 'AI 调度大脑 · 韩流场景',
    icon: '🔄',
    tagline: 'K-pop 演唱会 · 樱花季 · 学院街晚高峰 · 众包配送韩国大学生 · 类 Coupang Eats 模式',
    painpoint: '韩国充电宝运营最大坑是**事件驱动型订单**：BTS 在잠실 演出当晚周边 50 个站爆仓，第二天空荡 3 天；明洞游客旺季 vs 淡季流量差 8 倍；首尔大学考试周 2 周内 24×7 满负荷。靠人巡检根本来不及 — 韩国人力 ₩300 万/月（USD 2200），一个运维小哥养不起。',
    mechanism: 'AI 调度大脑接入 K-pop 演出日历 + 韩国教育部考试日程 + 旅游公社游客预测 + 实时电量/订单/归还率，预测 6 小时后哪些站会饿。自动派单给韩国大学生兼职配送员（类 Coupang Eats / Baemin Connect 模式），每单 ₩3000-5000，比自营便宜 75%。',
    rois: [
      { num: '-75%', lbl: '调度成本' },
      { num: '99.2%', lbl: '在架率' },
      { num: '0', lbl: '自营车队' }
    ]
  },
  service: {
    name: '韩 / 中 / 英 / 日 客服官',
    icon: '🌍',
    tagline: 'KakaoTalk · Naver Talk · WhatsApp · 邮件四端打通 · 24×7 · 8 秒首响',
    painpoint: '韩国客服一个坐席月薪 ₩400 万（USD 2900），3 班倒 24×7 = 12 个人 USD 3.5 万/月。游客主力来源是中国 + 日本 + 东南亚，韩语客服不够用，多语种坐席更贵。卡机、丢失、退款、商户对接全要人，一个客服平均处理 8 单/小时。',
    mechanism: '基于 DeepSeek + GPT-4o 多语言 Agent，**专精韩语场景**（敬语 / 新造语 / 韩式英语）。接 KakaoTalk Bizmessage + Naver Talk Talk + WhatsApp + 邮箱四端。退款规则、商户分润、卡机申诉、丢失追讨全自动。复杂工单升级到 3 人小组（覆盖韩语/中文/英日）。',
    rois: [
      { num: '4', lbl: '语种' },
      { num: '-92%', lbl: '客服成本' },
      { num: '8s', lbl: '首响' }
    ]
  },
  compliance: {
    name: '韩国合规智能体',
    icon: '📜',
    tagline: 'KC 认证 · PIPA 个保法 · 电池 UN38.3 · 韩国 HS Code · 通信费率 · 全流程托管',
    painpoint: '韩国是亚洲合规最严的国家之一 · 充电宝必过 KC 认证（韩国电气安全协会，单 SKU 测试费 ₩1500-3000 万、6-12 周）。PIPA（个人信息保护法）罚款比 GDPR 还狠 — 单次违规可达营收 3%。电池属危险品需 UN38.3 报告，韩国仁川海关一旦扣货平均 4-6 周。中国玩家不踩坑那是不可能。',
    mechanism: 'AI 合规大脑预入库**韩国全套法规**：KC 认证流程 / PIPA 数据合规清单 / 韩国通讯委员会（KCC）电波认证 / IEC 62133 电池标准 / 仁川海关 HS Code 8504.40 / 月度통신요금（通信费）报送。每批硬件自动出关单+申报材料。PIPA 数据合规每月自动对账，0 罚单。',
    rois: [
      { num: 'KC', lbl: '认证全包' },
      { num: '0', lbl: 'PIPA 罚单' },
      { num: '-95%', lbl: '关务工时' }
    ]
  },
  finance: {
    name: '财务 + 风控智能体',
    icon: '💰',
    tagline: '韩元结算 · KakaoPay / Toss / 信用卡接入 · 商户분배 · 异常订单实时风控',
    painpoint: '韩国支付生态独特：本地用 KakaoPay（70%）+ Toss（20%）+ Naver Pay；游客用银联/支付宝/微信/Apple Pay/Visa。每天 5000+ 笔订单、5 种支付通道、500 家商户분배（分润）、汇率波动 ₩-CNY 月震荡 2-5% 吃毛利。盗刷、刷单、不归还一旦失控直接不挣钱。',
    mechanism: 'AI 财务官打通 KakaoPay / Toss / Naver Pay / Stripe / 银联 5 通道，T+1 自动对账。月度 ₩-CNY 汇率自动对冲（Wise + 韩国新韩银行 API）。商户분배按合同自动算账推送（含 VAT 10%代扣代缴）。AI 风控：异常 IP / 高频借还 / 不归还概率 / 卡复用 → 实时拦截。',
    rois: [
      { num: '5', lbl: '支付通道' },
      { num: '-88%', lbl: '财务工时' },
      { num: '<0.3%', lbl: '坏账率' }
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
    markets: [
      { flag: '🇰🇷', name: '首尔 · 江南', city: '강남역·삼성·역삼', phase: 'P1' },
      { flag: '🇰🇷', name: '首尔 · 明洞', city: '명동·을지로·종로', phase: 'P1' },
      { flag: '🇰🇷', name: '首尔 · 弘大', city: '홍대·합정·연남', phase: 'P1' },
      { flag: '🇰🇷', name: '首尔 · 梨泰院', city: '이태원·한남·용산', phase: 'P1' },
      { flag: '🇰🇷', name: '首尔 · 蚕室', city: '잠실·롯데월드', phase: 'P1' },
      { flag: '🇰🇷', name: '仁川机场 + 金浦', city: 'ICN · GMP', phase: 'P1' },
      { flag: '🇰🇷', name: '釜山', city: '海云台·西面·南浦', phase: 'P2' },
      { flag: '🇰🇷', name: '济州岛', city: 'Jeju City · Seogwipo', phase: 'P2' },
      { flag: '🇰🇷', name: '大邱 + 大田', city: '동성로·둔산', phase: 'P2' },
      { flag: '🇯🇵', name: '日本东京（拓展）', city: '涩谷·新宿·秋叶原', phase: 'P3' }
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
      const path = `${wx.env.USER_DATA_PATH}/powerloop_${Date.now()}.mp3`
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
