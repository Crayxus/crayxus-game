// 一笔画通迷宫小游戏 · 5x5 Hamiltonian Path
const SIZE = 5

Component({
  data: {
    cells: [],
    path: [],
    won: false,
    moves: 0,
    totalCells: SIZE * SIZE,
    sizeRange: [0, 1, 2, 3, 4]
  },

  attached() {
    this._init()
  },

  methods: {
    _init() {
      const cells = []
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          cells.push({
            r, c,
            visited: r === 0 && c === 0,
            isStart: r === 0 && c === 0,
            isGoal: r === SIZE - 1 && c === SIZE - 1
          })
        }
      }
      this.setData({
        cells,
        path: [{ r: 0, c: 0 }],
        won: false,
        moves: 0
      })
    },

    onCellTap(e) {
      if (this.data.won) return
      const r = Number(e.currentTarget.dataset.r)
      const c = Number(e.currentTarget.dataset.c)
      const path = this.data.path
      const last = path[path.length - 1]
      const dr = Math.abs(r - last.r), dc = Math.abs(c - last.c)
      if (dr + dc !== 1) {
        wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
        return
      }
      const cells = this.data.cells.slice()
      const idx = r * SIZE + c

      if (cells[idx].visited) {
        // 退一步：点了上一格 → 撤销当前
        if (path.length >= 2) {
          const second = path[path.length - 2]
          if (second.r === r && second.c === c) {
            const lastIdx = last.r * SIZE + last.c
            cells[lastIdx] = { ...cells[lastIdx], visited: false }
            this.setData({
              cells,
              path: path.slice(0, -1),
              moves: this.data.moves + 1
            })
            wx.vibrateShort && wx.vibrateShort({ type: 'light' })
          }
        }
        return
      }

      cells[idx] = { ...cells[idx], visited: true }
      const newPath = [...path, { r, c }]
      const allVisited = cells.every(x => x.visited)
      const isGoal = r === SIZE - 1 && c === SIZE - 1
      const won = allVisited && isGoal
      this.setData({
        cells,
        path: newPath,
        moves: this.data.moves + 1,
        won
      })
      wx.vibrateShort && wx.vibrateShort({ type: won ? 'heavy' : 'light' })
      if (won) this.triggerEvent('win', { moves: newPath.length - 1 })
    },

    onReset() {
      wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
      this._init()
    }
  }
})
