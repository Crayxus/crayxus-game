Page({
  data: {
    statusBarHeight: 44,

    // 全局KPI
    totalStations: 300,
    totalPiles: 3600,
    totalTrucks: 86,
    todayRevenue: 127.5,
    totalRoutes: 12,

    // 地图标记点
    mapPoints: [
      { id: 1, name: '山西朔州', count: 35, x: 58, y: 32, status: 'active' },
      { id: 2, name: '内蒙通辽', count: 28, x: 62, y: 22, status: 'active' },
      { id: 3, name: '甘肃张掖', count: 22, x: 35, y: 35, status: 'building' },
      { id: 4, name: '山东章丘', count: 30, x: 68, y: 40, status: 'active' },
      { id: 5, name: '新疆哈密', count: 18, x: 22, y: 28, status: 'building' },
      { id: 6, name: '广东增城', count: 25, x: 65, y: 72, status: 'planned' },
      { id: 7, name: '辽宁沈阳', count: 20, x: 72, y: 20, status: 'active' },
      { id: 8, name: '黑龙江', count: 15, x: 75, y: 12, status: 'building' },
    ],
    regions: [1,2,3,4,5,6,7,8],

    // 光储充数据
    solarPower: 12.8,
    storageSoc: 68,
    chargingPiles: 847,

    // 站点列表
    stations: [
      { id: 1, name: '朔州平鲁站', location: '山西·朔州', piles: 120, usage: 78, todayRevenue: '8.6万', status: 'online' },
      { id: 2, name: '朔州山阴站', location: '山西·朔州', piles: 120, usage: 65, todayRevenue: '6.2万', status: 'online' },
      { id: 3, name: '通辽科尔沁站', location: '内蒙·通辽', piles: 90, usage: 82, todayRevenue: '9.1万', status: 'online' },
      { id: 4, name: '章丘物流园站', location: '山东·章丘', piles: 120, usage: 71, todayRevenue: '7.3万', status: 'online' },
      { id: 5, name: '张掖甘州站', location: '甘肃·张掖', piles: 60, usage: 0, todayRevenue: '--', status: 'building' },
    ],

    // EPC建设
    epcTotal: 35,
    epcDone: 8,
    epcWip: 12,
    epcPending: 15,
    epcProgress: 23,
    epcProjects: [
      { id: 1, name: '朔州平鲁1号站', stage: '已投运', progress: 100, statusClass: 'done' },
      { id: 2, name: '朔州山阴2号站', stage: '已投运', progress: 100, statusClass: 'done' },
      { id: 3, name: '朔州右玉3号站', stage: '设备调试', progress: 85, statusClass: 'wip' },
      { id: 4, name: '朔州怀仁4号站', stage: '电缆铺设', progress: 60, statusClass: 'wip' },
      { id: 5, name: '朔州应县5号站', stage: '道路硬化', progress: 35, statusClass: 'wip' },
      { id: 6, name: '朔州朔城6号站', stage: '地勘完成', progress: 15, statusClass: 'wip' },
      { id: 7, name: '朔州7号站', stage: '待开工', progress: 0, statusClass: 'pending' },
    ],

    // 氢能车队
    runningCount: 0,
    refuelingCount: 0,
    idleCount: 0,
    maintCount: 0,
    trucks: [
      { id: 'H01', name: 'H-01', status: 'running', speed: 72, h2Level: 68, km: 320 },
      { id: 'H02', name: 'H-02', status: 'running', speed: 65, h2Level: 55, km: 280 },
      { id: 'H03', name: 'H-03', status: 'refueling', speed: 0, h2Level: 12, km: 410 },
      { id: 'H04', name: 'H-04', status: 'running', speed: 78, h2Level: 82, km: 195 },
      { id: 'H05', name: 'H-05', status: 'idle', speed: 0, h2Level: 95, km: 0 },
      { id: 'H06', name: 'H-06', status: 'maint', speed: 0, h2Level: 40, km: 0 },
      { id: 'H07', name: 'H-07', status: 'running', speed: 58, h2Level: 71, km: 260 },
      { id: 'H08', name: 'H-08', status: 'running', speed: 70, h2Level: 48, km: 350 },
      { id: 'H09', name: 'H-09', status: 'refueling', speed: 0, h2Level: 8, km: 445 },
    ],

    // 财务
    finCharge: 385,
    finTransport: 520,
    finSolar: 96,
    finEpc: 1200,
    finTotal: 2201,

    // 动态
    alerts: [
      { id: 1, level: 'info', icon: '🏗️', msg: '朔州右玉3号站 设备调试完成80%', time: '15:20' },
      { id: 2, level: 'success', icon: '✅', msg: 'H-04 完成朔州→大同专线运输', time: '14:52' },
      { id: 3, level: 'warn', icon: '⚡', msg: '通辽科尔沁站 储能SOC降至30%', time: '14:30' },
      { id: 4, level: 'info', icon: '🚛', msg: 'H-03 进入加氢站 预计20分钟', time: '14:15' },
      { id: 5, level: 'success', icon: '💰', msg: '狮桥融资 第3批次回款到账 ¥2400万', time: '12:00' },
      { id: 6, level: 'info', icon: '☀️', msg: '山阴站光伏今日发电 12.8MWh', time: '11:30' },
    ]
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
    this.calcFleetStats()
  },

  calcFleetStats() {
    const trucks = this.data.trucks
    this.setData({
      runningCount: trucks.filter(t => t.status === 'running').length,
      refuelingCount: trucks.filter(t => t.status === 'refueling').length,
      idleCount: trucks.filter(t => t.status === 'idle').length,
      maintCount: trucks.filter(t => t.status === 'maint').length,
    })
  },

  goModule(e) {
    const mod = e.currentTarget.dataset.mod
    wx.showToast({ title: '模块开发中', icon: 'none' })
  },

  goBack() {
    wx.navigateBack()
  }
})
