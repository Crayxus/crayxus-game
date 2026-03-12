const app = getApp()

Page({
  data: {
    // WeChat user
    avatarUrl: '',
    nickname: '',
    hasNickname: false,
    showNicknameInput: false,

    // Player info
    title: 'Guandan Warrior',
    level: 41,

    activeTab: 'casual',

    casual: {
      rankKey: 'gold', rankName: 'GOLD III', rankColor: '#FFD700',
      stars: 2, starsMax: 3, starsArr: [],
      winRate: '62%', totalGames: 147, wins: 91,
      streak: 3, bestStreak: 7
    },
    training: {
      totalSessions: 86, totalHands: 1240, coachUsed: 324,
      accuracy: '71%', bestAccuracy: '85%',
      favoriteMove: 'Bomb', avgHandPower: 72
    },
    arena: {
      elo: 1850, peakElo: 1920,
      rank: 12, totalPlayers: 200,
      wins: 48, losses: 22,
      winRate: '69%', doubleRate: '34%', avgSteps: 87
    },

    cardAnimClass: 'card-enter',
    statusBarHeight: 44
  },

  onLoad() {
    // Get status bar height for safe area
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
    this.loadCachedUser()
    this.loadPlayerData()
    this.buildStars()
  },

  onShow() {
    this.setData({ cardAnimClass: '' })
    setTimeout(() => this.setData({ cardAnimClass: 'card-enter' }), 50)
  },

  // ========== WeChat Avatar & Nickname ==========

  loadCachedUser() {
    const cached = wx.getStorageSync('crayxus_user') || {}
    const avatarUrl = cached.avatarUrl || app.globalData.avatarUrl || ''
    const nickname = cached.nickname || app.globalData.nickname || ''
    this.setData({
      avatarUrl,
      nickname,
      hasNickname: !!nickname
    })
  },

  // User taps the avatar placeholder → WeChat chooseAvatar popup
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    if (!avatarUrl) return

    // Save to app global + local storage
    app.globalData.avatarUrl = avatarUrl
    this.setData({ avatarUrl })
    this.saveUser()

    wx.showToast({ title: 'Avatar set!', icon: 'success' })
  },

  // Tap existing avatar → allow re-choosing
  onTapAvatar() {
    wx.showActionSheet({
      itemList: ['Change Avatar'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // Reset to trigger chooseAvatar button
          this.setData({ avatarUrl: '' })
        }
      }
    })
  },

  // WeChat nickname input (type="nickname" auto-fills WeChat name)
  onNicknameChange(e) {
    const nickname = (e.detail.value || '').trim()
    if (!nickname) return

    app.globalData.nickname = nickname
    this.setData({ nickname, hasNickname: true })
    this.saveUser()
  },

  // Tap nickname to edit
  onTapNickname() {
    this.setData({ hasNickname: false })
  },

  saveUser() {
    const data = {
      avatarUrl: this.data.avatarUrl,
      nickname: this.data.nickname
    }
    wx.setStorageSync('crayxus_user', data)

    // TODO: sync to game server so index.html can display the avatar
    // wx.request({ url: 'https://your-server/api/user/avatar', method: 'POST', data })
  },

  // ========== Player Data ==========

  loadPlayerData() {
    const pd = app.globalData.playerData
    if (!pd) return

    const c = pd.casual
    const t = pd.training
    const a = pd.arena

    this.setData({
      title: pd.title,
      level: pd.level,
      casual: {
        rankKey: c.rankKey, rankName: c.rankName, rankColor: c.rankColor,
        stars: c.stars, starsMax: c.starsMax, starsArr: [],
        winRate: Math.round(c.winRate * 100) + '%',
        totalGames: c.totalGames, wins: c.wins,
        streak: c.streak, bestStreak: c.bestStreak
      },
      training: {
        totalSessions: t.totalSessions, totalHands: t.totalHands,
        coachUsed: t.coachUsed,
        accuracy: Math.round(t.accuracy * 100) + '%',
        bestAccuracy: Math.round(t.bestAccuracy * 100) + '%',
        favoriteMove: t.favoriteMove, avgHandPower: t.avgHandPower
      },
      arena: {
        elo: a.elo, peakElo: a.peakElo,
        rank: a.rank, totalPlayers: a.totalPlayers,
        wins: a.wins, losses: a.losses,
        winRate: Math.round(a.winRate * 100) + '%',
        doubleRate: Math.round(a.doubleRate * 100) + '%',
        avgSteps: a.avgSteps
      }
    })
    this.buildStars()
  },

  buildStars() {
    const c = this.data.casual
    const arr = []
    for (let i = 0; i < c.starsMax; i++) {
      arr.push({ filled: i < c.stars })
    }
    this.setData({ 'casual.starsArr': arr })
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  // ========== Scan & Share ==========

  onScanLogin() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        console.log('Scan result:', res.result)

        // Parse session ID from QR URL
        // Format: https://crayxus-game.onrender.com/wxlogin?session=CX-XXXXX
        let sessionId = ''
        try {
          const url = new URL(res.result)
          sessionId = url.searchParams.get('session') || ''
        } catch(e) {
          // Try extracting session from plain text
          const match = res.result.match(/session=([A-Z0-9-]+)/i)
          if (match) sessionId = match[1]
        }

        if (!sessionId) {
          wx.showToast({ title: 'Invalid QR code', icon: 'none' })
          return
        }

        // Send avatar + nickname to server via Socket relay
        const SERVER = 'https://crayxus-game.onrender.com'
        wx.request({
          url: SERVER + '/api/wx-login',
          method: 'POST',
          header: { 'content-type': 'application/json' },
          data: {
            sessionId: sessionId,
            avatarUrl: this.data.avatarUrl,
            nickname: this.data.nickname
          },
          success: (resp) => {
            console.log('Login response:', resp.data)
            if (resp.data && resp.data.success) {
              // Also receive stats from server if available
              if (resp.data.stats) {
                this.applyServerStats(resp.data.stats)
              }
              wx.showToast({ title: 'Login Success!', icon: 'success' })
            } else {
              wx.showToast({ title: resp.data.msg || 'Login failed', icon: 'none' })
            }
          },
          fail: (err) => {
            console.error('Login request failed:', err)
            wx.showToast({ title: 'Network error', icon: 'none' })
          }
        })
      },
      fail: () => {
        wx.showToast({ title: 'Cancelled', icon: 'none' })
      }
    })
  },

  // Apply stats received from game server
  applyServerStats(stats) {
    if (!stats) return
    const updates = {}

    if (stats.casual) {
      updates.casual = {
        ...this.data.casual,
        winRate: stats.casual.winRate || this.data.casual.winRate,
        totalGames: stats.casual.totalGames || this.data.casual.totalGames,
        wins: stats.casual.wins || this.data.casual.wins,
        streak: stats.casual.streak || this.data.casual.streak,
        bestStreak: stats.casual.bestStreak || this.data.casual.bestStreak,
        rankName: stats.casual.rankName || this.data.casual.rankName,
        rankColor: stats.casual.rankColor || this.data.casual.rankColor,
        stars: stats.casual.stars != null ? stats.casual.stars : this.data.casual.stars,
        starsMax: stats.casual.starsMax || this.data.casual.starsMax,
        starsArr: this.data.casual.starsArr
      }
    }
    if (stats.training) {
      updates.training = { ...this.data.training, ...stats.training }
    }
    if (stats.arena) {
      updates.arena = {
        ...this.data.arena,
        elo: stats.arena.elo || this.data.arena.elo,
        peakElo: stats.arena.peakElo || this.data.arena.peakElo,
        rank: stats.arena.rank || this.data.arena.rank,
        wins: stats.arena.wins || this.data.arena.wins,
        losses: stats.arena.losses || this.data.arena.losses,
        winRate: stats.arena.winRate || this.data.arena.winRate
      }
    }

    this.setData(updates)
    if (updates.casual) this.buildStars()

    // Cache stats locally
    wx.setStorageSync('crayxus_stats', stats)
  },

  onShareCard() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  onShareAppMessage() {
    return {
      title: `${this.data.nickname || 'Player'} | Crayxus Guandan`,
      path: '/pages/profile/profile',
      imageUrl: this.data.avatarUrl || ''
    }
  },

  onShareTimeline() {
    return {
      title: `${this.data.nickname || 'Player'} | ELO ${this.data.arena.elo} | Crayxus`
    }
  }
})
