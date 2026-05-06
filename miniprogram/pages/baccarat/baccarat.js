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
    historyGrid: [],   // 大路（列式）
    beadPlate: [],     // 珠盘路
    // 三层揽策略
    strategyOn: false,
    strategyTier: 1,           // 1 / 2 / 3
    tierMul: 1.0,              // 1.0 / 1.1 / 1.21
    strategyStep: 0,           // 当前阶梯位置 (0 = 第 1 注, 1 = 第 2 注)
    strategyActive: false,     // 是否处于胜进中
    bbbColIdx: [],             // 历史中所有 BBB+ 列号
    totalCols: 0,              // 当前累计列数
    gapSinceBBB: 0,            // 距上次 BBB+ 的列数
    suggestBet: null,          // { unit: 数值, reason: 文字 }
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

  // 计算列结构（剔除 T）
  _computeColumns(history) {
    const cols = []
    let cur = null
    history.forEach(h => {
      if (h.r === 'T') return
      if (!cur || cur.side !== h.r) { cur = { side: h.r, len: 1 }; cols.push(cur) }
      else cur.len++
    })
    return cols
  },

  // 每局结束后更新策略状态
  _updateStrategyAfterRound(round, r, lastWin) {
    const cols = this._computeColumns(this.data.history)
    const bbbIdx = []
    cols.forEach((c, i) => { if (c.side === 'B' && c.len >= 3) bbbIdx.push(i) })
    const totalCols = cols.length

    if (this.data.strategyActive) {
      // 本局是下注局，根据结果更新
      if (r === 'B') {
        const newStep = this.data.strategyStep + 1
        if (newStep >= 2) {
          // 完成 1-2 → 列达到 BBB+
          const newBBB = bbbIdx[bbbIdx.length - 1]
          const prevBBB = bbbIdx.length >= 2 ? bbbIdx[bbbIdx.length - 2] : -1
          const gap = prevBBB >= 0 ? newBBB - prevBBB : 999
          let newTier = this.data.strategyTier
          if (gap < 7 && prevBBB >= 0) newTier = Math.min(3, newTier + 1)
          else newTier = 1
          this.setData({
            strategyActive: false,
            strategyStep: 0,
            strategyTier: newTier,
            tierMul: +Math.pow(1.1, newTier - 1).toFixed(3),
            bbbColIdx: bbbIdx,
            totalCols,
            gapSinceBBB: 0
          })
        } else {
          this.setData({ strategyStep: newStep, totalCols, bbbColIdx: bbbIdx })
        }
      } else {
        // P → 失败, 重置
        this.setData({
          strategyActive: false,
          strategyStep: 0,
          strategyTier: 1,
          tierMul: 1.0,
          bbbColIdx: bbbIdx,
          totalCols
        })
      }
    } else {
      // 等待新 B 列触发
      const lastCol = cols[cols.length - 1]
      if (lastCol && lastCol.side === 'B' && lastCol.len === 1) {
        // 新 B 列刚开 → 下一局起算第 1 注
        this.setData({
          strategyActive: true,
          strategyStep: 0,
          bbbColIdx: bbbIdx,
          totalCols
        })
      } else {
        // 计算距上次 BBB+ 列数
        const lastBBB = bbbIdx.length > 0 ? bbbIdx[bbbIdx.length - 1] : -1
        const gap = lastBBB >= 0 ? totalCols - 1 - lastBBB : totalCols
        this.setData({ bbbColIdx: bbbIdx, totalCols, gapSinceBBB: gap })
      }
    }

    this._refreshStrategyState()
  },

  // 切换策略
  toggleStrategy() {
    const on = !this.data.strategyOn
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    if (on) {
      // 启动: 重置策略状态, 但保留历史 (用于判断当前位置)
      this.setData({
        strategyOn: true,
        strategyTier: 1,
        tierMul: 1.0,
        strategyStep: 0,
        strategyActive: false
      })
      this._refreshStrategyState()
      wx.showToast({ title: '🎯 策略已启动', icon: 'none', duration: 1200 })
    } else {
      this.setData({ strategyOn: false, suggestBet: null })
      wx.showToast({ title: '策略已关闭', icon: 'none', duration: 1000 })
    }
  },

  // 根据当前牌路计算建议
  _refreshStrategyState() {
    if (!this.data.strategyOn) { this.setData({ suggestBet: null }); return }
    // 已在胜进中，下一注就是 ladder[step]
    if (this.data.strategyActive) {
      const baseBet = [1, 2][this.data.strategyStep] * this.data.tierMul
      this.setData({
        suggestBet: {
          unit: +baseBet.toFixed(2),
          tierLabel: 'L' + this.data.strategyTier,
          step: this.data.strategyStep + 1,
          reason: '🎯 第 ' + (this.data.strategyStep + 1) + ' 注 · 押庄 ' + baseBet.toFixed(2)
        }
      })
      return
    }
    // 尚未触发: 看上局是否是 P 或起始, 当前是否将开 B (无法预知)
    // 实际逻辑在 _finalize 后判断: 上局 result 是否打开新 B 列, 来决定本轮要不要下注
    const last = this.data.history[this.data.history.length - 1]
    if (!last || last.r !== 'B') {
      // 等待 B 出现 (不下注本局, 等下一局)
      this.setData({
        suggestBet: {
          unit: 0, tierLabel: 'L' + this.data.strategyTier, step: 0,
          reason: '等待新 B 列触发 · 当前 ' + (last ? (last.r === 'P' ? '上局闲' : '上局和') : '尚未开始')
        }
      })
    } else {
      // 上局是 B 但还未触发 (可能列内非起始, 不算新 B 列)
      this.setData({
        suggestBet: {
          unit: 0, tierLabel: 'L' + this.data.strategyTier, step: 0,
          reason: '当前 B 列已开, 等下一新 B 列再触发'
        }
      })
    }
  },

  // 智能下注: 根据策略自动放筹码
  autoBet() {
    if (!this.data.strategyOn) {
      wx.showToast({ title: '请先开启策略', icon: 'none' })
      return
    }
    const sb = this.data.suggestBet
    if (!sb || sb.unit <= 0) {
      wx.showToast({ title: '当前不下注 · 等触发', icon: 'none', duration: 1200 })
      return
    }
    // 单位 = 100 元 (默认)
    const amount = Math.round(sb.unit * 100)
    if (this.data.balance < amount) {
      wx.showToast({ title: '余额不足', icon: 'none' })
      return
    }
    const newBets = { ...this.data.bets, B: (this.data.bets.B || 0) + amount }
    wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
    this.setData({
      bets: newBets,
      balance: this.data.balance - amount
    })
    wx.showToast({ title: '✓ 已下 ' + amount + ' 押庄', icon: 'none', duration: 1000 })
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
    // 允许零注码发牌（只看牌路）
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
      // 不再每张牌震动手机（之前太颠了）
      setTimeout(reveal, 380)
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

    const playerPair2 = round.playerCards[0].r === round.playerCards[1].r
    const bankerPair2 = round.bankerCards[0].r === round.bankerCards[1].r
    const history = [...this.data.history, { r, pp: playerPair2, bp: bankerPair2, win: lastWin > 0 }].slice(-72)
    const historyGrid = this._buildBigRoad(history)
    const beadPlate = this._buildBeadPlate(history)
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
      beadPlate,
      balance: newBalance
    })
    // 重算 AI 信号
    this.setData({ aiSignal: this._computeSignal() })

    // 更新策略状态
    if (this.data.strategyOn) this._updateStrategyAfterRound(round, r, lastWin)

    wx.setStorageSync(STORAGE_KEY, newBalance)

    if (lastWin > 0) {
      wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
    }
  },

  // 珠盘路：6 行 × N 列，从左上往下填，满 6 个换列
  _buildBeadPlate(history) {
    const rows = [[], [], [], [], [], []]
    history.forEach((h, i) => {
      rows[i % 6].push(h)
    })
    return rows
  },

  // 大路：忽略和局，同色同列下移，异色新列右移，最多 6 行（拐弯）
  _buildBigRoad(history) {
    const cols = []  // 每列: [{ r, ties: 该格上累计和局数 }, ...]
    let curCol = -1
    let lastNonTie = null
    let pendingTies = 0
    history.forEach(h => {
      if (h.r === 'T') {
        pendingTies++
        return
      }
      if (lastNonTie === null || h.r !== lastNonTie) {
        // 新列
        curCol++
        cols[curCol] = []
        cols[curCol].push({ r: h.r, ties: pendingTies, pp: h.pp, bp: h.bp })
        pendingTies = 0
      } else {
        // 同色 - 同列下移（不超 6 行则下，超则右拐）
        if (cols[curCol].length < 6) {
          cols[curCol].push({ r: h.r, ties: pendingTies, pp: h.pp, bp: h.bp })
        } else {
          curCol++
          cols[curCol] = [{ r: h.r, ties: pendingTies, pp: h.pp, bp: h.bp }]
        }
        pendingTies = 0
      }
      lastNonTie = h.r
    })
    // 把和局累在最后一格
    if (pendingTies > 0 && cols.length > 0) {
      const lastCol = cols[cols.length - 1]
      lastCol[lastCol.length - 1].ties += pendingTies
    }
    // 转成网格 6 行 × N 列方便 WXML 渲染
    const grid = [[], [], [], [], [], []]
    cols.forEach((col, ci) => {
      for (let r = 0; r < 6; r++) {
        grid[r].push(col[r] || null)
      }
    })
    return grid
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
            beadPlate: [],
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
