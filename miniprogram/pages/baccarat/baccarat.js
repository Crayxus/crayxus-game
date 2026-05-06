// Crayxus AI · 百家乐体验厅（Vegas Star 风格 · 虚拟筹码 · 非赌博）
const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = [
  { r: 'A',  v: 1 },  { r: '2',  v: 2 }, { r: '3', v: 3 },
  { r: '4',  v: 4 },  { r: '5',  v: 5 }, { r: '6', v: 6 },
  { r: '7',  v: 7 },  { r: '8',  v: 8 }, { r: '9', v: 9 },
  { r: '10', v: 0 }, { r: 'J',  v: 0 }, { r: 'Q', v: 0 }, { r: 'K', v: 0 }
]

function buildShoe(decks = 8) {
  const shoe = []
  for (let d = 0; d < decks; d++) {
    SUITS.forEach(s => RANKS.forEach(r => shoe.push({ s, r: r.r, v: r.v, id: Math.random() })))
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shoe[i], shoe[j]] = [shoe[j], shoe[i]]
  }
  return shoe
}

function points(cards) { return cards.reduce((a, c) => a + c.v, 0) % 10 }

function playRound(shoe) {
  const playerCards = [shoe.shift(), shoe.shift()]
  const bankerCards = [shoe.shift(), shoe.shift()]
  const pp = points(playerCards), bp = points(bankerCards)

  if (pp >= 8 || bp >= 8) {
    return { playerCards, bankerCards, pp, bp, result: pp > bp ? 'P' : pp < bp ? 'B' : 'T' }
  }

  let player3 = null
  if (pp <= 5) {
    player3 = shoe.shift()
    playerCards.push(player3)
  }

  let bankerNeeds = false
  if (player3 === null) {
    bankerNeeds = bp <= 5
  } else {
    const v = player3.v
    if (bp <= 2) bankerNeeds = true
    else if (bp === 3 && v !== 8) bankerNeeds = true
    else if (bp === 4 && v >= 2 && v <= 7) bankerNeeds = true
    else if (bp === 5 && v >= 4 && v <= 7) bankerNeeds = true
    else if (bp === 6 && (v === 6 || v === 7)) bankerNeeds = true
  }
  if (bankerNeeds) bankerCards.push(shoe.shift())

  const fp = points(playerCards), fb = points(bankerCards)
  return {
    playerCards, bankerCards,
    pp: fp, bp: fb,
    result: fp > fb ? 'P' : fp < fb ? 'B' : 'T'
  }
}

const CHIP_DENOMS = [
  { v: 10,   color: '#ffffff', glow: '#cccccc', label: '10' },
  { v: 50,   color: '#ff4081', glow: '#ff80ab', label: '50' },
  { v: 100,  color: '#00d4aa', glow: '#5eead4', label: '100' },
  { v: 500,  color: '#7c4dff', glow: '#b39dff', label: '500' },
  { v: 1000, color: '#ffd700', glow: '#fff176', label: '1K' }
]

const STARTING_BALANCE = 10000
const STORAGE_KEY = 'crayxus_baccarat_balance'

Page({
  data: {
    statusBarHeight: 44,
    balance: STARTING_BALANCE,
    chips: CHIP_DENOMS,
    selectedChipIdx: 2,  // default ¥100
    bets: { P: 0, B: 0, T: 0, PP: 0, BP: 0 },  // 五种下注
    state: 'betting',  // betting | dealing | revealed
    pCards: [],
    bCards: [],
    pp: 0,
    bp: 0,
    result: null,
    payout: 0,
    history: [],
    historyGrid: [],
    lastWin: 0,
    showLastWin: false,
    aiSignal: { pattern: '等待开局', streakLen: 0, streakSide: null, nextProb: 50, recommend: 'B', recommendProb: 45.86, insight: '本局基础概率 · 庄 45.86% / 闲 44.62% / 和 9.52%', confidence: 'low' }
  },

  _computeSignal() {
    const h = this.data.history.filter(x => x.r !== 'T').slice(-12)  // 忽略和局
    if (h.length === 0) {
      return {
        pattern: '等待开局', streakLen: 0, streakSide: null, nextProb: 50,
        recommend: 'B', recommendProb: 45.86,
        insight: '本局基础概率 · 庄 45.86% / 闲 44.62% / 和 9.52%',
        confidence: 'low'
      }
    }
    // 统计当前连胜
    let streakSide = h[h.length - 1].r
    let streakLen = 0
    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i].r === streakSide) streakLen++
      else break
    }

    // 模式识别
    let pattern, recommend, recommendProb, insight, confidence
    if (streakLen >= 3) {
      // 连开 N → 概率回归提示
      const continueProb = (Math.pow(0.5, streakLen + 1) * 100).toFixed(2)
      const breakProb = (50).toFixed(0)
      const opp = streakSide === 'B' ? 'P' : 'B'
      pattern = `连${streakSide === 'B' ? '庄' : '闲'} ${streakLen}`
      recommend = opp
      recommendProb = breakProb
      insight = `已连开 ${streakLen} ${streakSide === 'B' ? '庄' : '闲'} · 再连一${streakSide === 'B' ? '庄' : '闲'}基础概率仅 ${continueProb}% · 概率回归推荐反向投${opp === 'B' ? '庄' : '闲'}`
      confidence = streakLen >= 4 ? 'high' : 'mid'
    } else if (h.length >= 4) {
      // 检测交替 / 双跳
      const last4 = h.slice(-4).map(x => x.r).join('')
      if (last4 === 'BPBP' || last4 === 'PBPB') {
        pattern = '单跳 · 交替'
        // 跳路反向延续
        recommend = streakSide === 'B' ? 'P' : 'B'
        recommendProb = 56
        insight = `近 4 局完美单跳 · 跳路延续概率上升 · AI 推荐顺跳投${recommend === 'B' ? '庄' : '闲'}`
        confidence = 'high'
      } else if (last4 === 'BBPP' || last4 === 'PPBB') {
        pattern = '双跳 · 双连'
        recommend = streakSide
        recommendProb = 53
        insight = `近 4 局双跳形态 · 同向延续概率上升 · AI 推荐顺势投${recommend === 'B' ? '庄' : '闲'}`
        confidence = 'mid'
      } else {
        pattern = streakLen === 2 ? `连${streakSide === 'B' ? '庄' : '闲'} 2` : '混合'
        recommend = streakSide === 'B' ? 'B' : 'P'
        recommendProb = streakSide === 'B' ? 46 : 45
        insight = '暂无强信号 · 按基础概率推荐'
        confidence = 'low'
      }
    } else {
      pattern = streakLen >= 2 ? `连${streakSide === 'B' ? '庄' : '闲'} ${streakLen}` : '观望'
      recommend = 'B'
      recommendProb = 46
      insight = '样本不足 · 等待更多牌局形成信号'
      confidence = 'low'
    }

    const continueProbN = (Math.pow(0.5, streakLen + 1) * 100).toFixed(2)
    return { pattern, streakLen, streakSide, nextProb: continueProbN, recommend, recommendProb, insight, confidence }
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
    const saved = wx.getStorageSync(STORAGE_KEY)
    if (typeof saved === 'number' && saved > 0) {
      this.setData({ balance: saved })
    }
    this._shoe = buildShoe(8)
  },

  selectChip(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ selectedChipIdx: idx })
  },

  placeBet(e) {
    if (this.data.state !== 'betting') return
    const zone = e.currentTarget.dataset.zone
    const chip = this.data.chips[this.data.selectedChipIdx]
    if (this.data.balance < chip.v) {
      wx.showToast({ title: '余额不足', icon: 'none', duration: 1000 })
      return
    }
    const newBets = { ...this.data.bets }
    newBets[zone] = (newBets[zone] || 0) + chip.v
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    this.setData({
      bets: newBets,
      balance: this.data.balance - chip.v
    })
  },

  clearBets() {
    if (this.data.state !== 'betting') return
    const refund = Object.values(this.data.bets).reduce((a, b) => a + b, 0)
    if (refund === 0) return
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    this.setData({
      bets: { P: 0, B: 0, T: 0, PP: 0, BP: 0 },
      balance: this.data.balance + refund
    })
  },

  deal() {
    if (this.data.state !== 'betting') return
    const total = Object.values(this.data.bets).reduce((a, b) => a + b, 0)
    if (total === 0) {
      wx.showToast({ title: '请先下注', icon: 'none', duration: 800 })
      return
    }
    wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
    this.setData({ state: 'dealing', pCards: [], bCards: [], result: null, showLastWin: false })

    if (this._shoe.length < 6) this._shoe = buildShoe(8)
    const round = playRound(this._shoe)

    const order = []
    order.push({ side: 'p', card: round.playerCards[0] })
    order.push({ side: 'b', card: round.bankerCards[0] })
    order.push({ side: 'p', card: round.playerCards[1] })
    order.push({ side: 'b', card: round.bankerCards[1] })
    if (round.playerCards[2]) order.push({ side: 'p', card: round.playerCards[2] })
    if (round.bankerCards[2]) order.push({ side: 'b', card: round.bankerCards[2] })

    let i = 0
    const reveal = () => {
      if (i >= order.length) {
        this._finalize(round)
        return
      }
      const o = order[i++]
      const key = o.side === 'p' ? 'pCards' : 'bCards'
      this.setData({ [key]: [...this.data[key], o.card] })
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
      setTimeout(reveal, 360)
    }
    reveal()
  },

  _finalize(round) {
    const bets = this.data.bets
    const r = round.result
    let payout = 0

    // 主线赔付
    if (r === 'P' && bets.P) payout += bets.P * 2  // 1:1 (返本+1)
    if (r === 'B' && bets.B) payout += Math.floor(bets.B * 1.95)  // 1:0.95
    if (r === 'T' && bets.T) payout += bets.T * 9  // 1:8 (返本+8)
    // 闲家平局也返还闲注/庄注的本金（标准百家乐规则）
    if (r === 'T' && bets.P) payout += bets.P
    if (r === 'T' && bets.B) payout += bets.B

    // 对子
    const playerPair = round.playerCards[0].r === round.playerCards[1].r
    const bankerPair = round.bankerCards[0].r === round.bankerCards[1].r
    if (playerPair && bets.PP) payout += bets.PP * 12  // 1:11
    if (bankerPair && bets.BP) payout += bets.BP * 12

    const totalBet = Object.values(bets).reduce((a, b) => a + b, 0)
    const lastWin = payout - totalBet

    const history = [...this.data.history, { r, win: lastWin > 0 }].slice(-36)
    const historyGrid = this._buildBigRoad(history)
    const newBalance = this.data.balance + payout

    this.setData({
      pp: round.pp,
      bp: round.bp,
      result: r,
      state: 'revealed',
      payout,
      lastWin,
      showLastWin: true,
      history,
      historyGrid,
      balance: newBalance
    })
    // 重算 AI 信号
    this.setData({ aiSignal: this._computeSignal() })

    wx.setStorageSync(STORAGE_KEY, newBalance)

    if (lastWin > 0) {
      wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
    }
  },

  _buildBigRoad(history) {
    const rows = [[], [], [], [], [], []]
    history.forEach((h, i) => {
      const row = i % 6
      rows[row].push(h)
    })
    return rows
  },

  next() {
    if (this.data.state !== 'revealed') return
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({
      bets: { P: 0, B: 0, T: 0, PP: 0, BP: 0 },
      state: 'betting',
      pCards: [],
      bCards: [],
      pp: 0,
      bp: 0,
      result: null,
      payout: 0,
      showLastWin: false
    })
  },

  rebuy() {
    wx.showModal({
      title: '充值虚拟筹码',
      content: `充值 ¥${STARTING_BALANCE} 体验金（无任何真实金钱关联）`,
      confirmText: '充值',
      success: (r) => {
        if (r.confirm) {
          this.setData({ balance: this.data.balance + STARTING_BALANCE })
          wx.setStorageSync(STORAGE_KEY, this.data.balance + STARTING_BALANCE)
          wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
        }
      }
    })
  },

  reset() {
    wx.showModal({
      title: '重置游戏？',
      content: '清空记录，余额恢复至 ¥10000',
      success: (r) => {
        if (r.confirm) {
          this._shoe = buildShoe(8)
          this.setData({
            balance: STARTING_BALANCE,
            bets: { P: 0, B: 0, T: 0, PP: 0, BP: 0 },
            state: 'betting',
            pCards: [],
            bCards: [],
            pp: 0,
            bp: 0,
            result: null,
            payout: 0,
            history: [],
            historyGrid: [],
            showLastWin: false
          })
          wx.setStorageSync(STORAGE_KEY, STARTING_BALANCE)
          wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
        }
      }
    })
  },

  goBack() {
    wx.navigateBack({ delta: 1, fail: () => wx.reLaunch({ url: '/pages/landing/landing' }) })
  }
})
