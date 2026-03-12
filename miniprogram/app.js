App({
  globalData: {
    userInfo: null,    // WeChat user info (avatar, nickname)
    avatarUrl: '',     // WeChat avatar URL
    nickname: '',      // WeChat nickname

    playerData: {
      name: 'PLAYER_ONE',
      title: 'Guandan Warrior',
      level: 41,
      casual: {
        rankKey: 'gold', rankName: 'GOLD III', rankColor: '#FFD700',
        stars: 2, starsMax: 3,
        winRate: 0.62, totalGames: 147, wins: 91,
        streak: 3, bestStreak: 7
      },
      training: {
        totalSessions: 86, totalHands: 1240, coachUsed: 324,
        accuracy: 0.71, bestAccuracy: 0.85,
        favoriteMove: 'Bomb', avgHandPower: 72
      },
      arena: {
        elo: 1850, peakElo: 1920,
        rank: 12, totalPlayers: 200,
        wins: 48, losses: 22,
        winRate: 0.686, doubleRate: 0.34, avgSteps: 87
      }
    }
  },

  onLaunch() {
    // Restore cached avatar & nickname
    const cached = wx.getStorageSync('crayxus_user')
    if (cached) {
      this.globalData.avatarUrl = cached.avatarUrl || ''
      this.globalData.nickname = cached.nickname || ''
    }
  }
})
