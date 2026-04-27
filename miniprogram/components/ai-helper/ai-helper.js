const HELPER_MESSAGES = {
  landing: {
    title: '欢迎来到 Crayxus',
    text: '这是浙大研发的 AI 提分系统。点击下方的提分系统卡片，开始你的雅思学习之旅。',
    tips: ['投资者版本只开放 AI 提分', '所有功能免费体验，欢迎探索']
  },
  scoreboost_step1: {
    title: '第一步 · 匹配度测评',
    text: '你好新同学！建议先点右上的金色光球，完成 15 题匹配度测评。AI 会判断你的学习人格和系统契合度。',
    tips: ['约 5 分钟', '题目每次都不一样', '完成后有详细报告']
  },
  scoreboost_step2: {
    title: '第二步 · 提分测评',
    text: '匹配度测评完成！现在点左侧橙色光球，做 20 题定级测评。AI 会评估你的雅思 Band 等级。',
    tips: ['覆盖听力、口语、阅读、写作、词汇、语法 6 个维度', '听力题有真人英音朗读', 'AI 根据你水平自动调整难度']
  },
  scoreboost_step3: {
    title: '第三步 · 定向强化',
    text: '做完定级测评，看到下方的"AI 弱点诊断"了吗？点击任一薄弱点的定向强化按钮，AI 会针对该维度出题刷题。',
    tips: ['每轮 10 题', '每日刷 3 轮，1 周可提 Band 0.5 到 1 分', '答错的题自动进错题本']
  },
  scoreboost_step4: {
    title: '第四步 · 错题本复习',
    text: '刷完题别忘了打开错题本！这里汇总了你所有答错的题。根据艾宾浩斯记忆曲线，建议 1、3、7、15 天各复习一次。',
    tips: ['AI 自动按维度分类错题', '看到错题分布立刻知道薄弱点', '再战一遍随机抽 10 道重做']
  },
  'pre-screen': {
    title: '匹配报告解读',
    text: '这是你的 Crayxus 兼容报告。兼容度分数越高，提分潜力越大。根据推荐方案选择合适的学习节奏。',
    tips: ['六维能力雷达显示你的学习偏好', '80+ 分为极佳匹配', '建议方案按你的学习风格定制']
  },
  'pre-screen-test': {
    title: '匹配度测评中',
    text: '认真回答 10 道题，选最贴近你真实情况的选项。AI 会据此生成专属学习人格报告。',
    tips: ['没有标准答案', '诚实作答结果最准', '完成后立刻出报告']
  },
  'sb-quiz-assess': {
    title: '定级测评进行中',
    text: '专心做题，遇到听力题点击播放按钮听音频。完成后 AI 会给出你的雅思 Band 等级和 6 维评估。',
    tips: ['20 题覆盖全部 6 个维度', '不会的不要乱猜，宁可选错不要瞎选', '听力可以点字幕辅助']
  },
  'sb-quiz-adaptive': {
    title: '定向强化训练',
    text: 'AI 正在针对你的薄弱点出题。连续做 3 轮效果最好，配合错题本复习事半功倍。',
    tips: ['每题都是 AI 实时为你生成', '题目和难度随水平变化', '错题自动进错题本']
  },
  'teacher-dashboard': {
    title: '教师后台使用指南',
    text: '这里展示班级所有学生的匹配度 M 和提分值 B。每月系统自动评出 Top 3 学生，你可一键发放次月免费使用权。',
    tips: ['M 值高的学生更适合 Crayxus', 'B 值显示实际进步', '建议每周浏览一次，跟进薄弱学生']
  },
  wrongbook: {
    title: '错题本使用法',
    text: '这里汇总了你所有答错的题。根据艾宾浩斯记忆曲线，建议错题在 1、3、7、15 天各复习一次，能把记忆保留率提到 90%+。',
    tips: ['AI 会标注错题类型分布', '点击题目可看详细解析', '再战一遍：随机抽 10 道错题重做']
  },
  falang: {
    title: '法良 AAAS 智能体平台',
    text: '欢迎来到法良 AAAS 平台。这里基于法良 21 年棉羽专家积累，部署了四大 AI 智能体：智能选款、产能调度、视觉质检、客户画像。点击任一智能体卡片可以查看详细方案与量化收益。',
    tips: ['为法良 26 个国际品牌客户专属定制', '与 2027 黄冈智能基地战略对齐', '点卡片右下角播放语音详细介绍']
  }
}

// 向导步进模式：这些 pageKey 会在每次点击时循环切换到下一步
const GUIDED_FLOWS = {
  scoreboost: ['scoreboost_step1', 'scoreboost_step2', 'scoreboost_step3', 'scoreboost_step4']
}

Component({
  properties: {
    pageKey: {
      type: String,
      value: 'landing'
    },
    autoShow: {
      type: Boolean,
      value: false
    }
  },

  data: {
    panelOpen: false,
    ttsLoading: false,
    ttsPlaying: false,
    showHint: true,
    msg: { title: 'AI 向导', text: '', tips: [] }
  },

  attached() {
    this._refreshMessage()
    setTimeout(() => { this.setData({ showHint: false }) }, 3500)
    if (this.properties.autoShow) {
      setTimeout(() => { this.setData({ panelOpen: true }) }, 600)
    }
  },

  detached() {
    this._stopAudio()
  },

  methods: {
    _refreshMessage() {
      const key = this.properties.pageKey
      const flow = GUIDED_FLOWS[key]
      let msgKey
      if (flow) {
        // 读缓存的当前步，默认 0
        const stepKey = `crayxus_helper_step_${key}`
        const step = wx.getStorageSync(stepKey) || 0
        msgKey = flow[step % flow.length]
      } else {
        msgKey = key
      }
      const msg = HELPER_MESSAGES[msgKey] || HELPER_MESSAGES.landing
      this.setData({ msg })
    },

    _advanceStep() {
      const key = this.properties.pageKey
      const flow = GUIDED_FLOWS[key]
      if (!flow) return
      const stepKey = `crayxus_helper_step_${key}`
      const step = wx.getStorageSync(stepKey) || 0
      const nextStep = (step + 1) % flow.length
      try { wx.setStorageSync(stepKey, nextStep) } catch(e) {}
    },

    togglePanel() {
      const open = !this.data.panelOpen
      if (open) {
        // 打开前刷新消息（可能被上次推进过）
        this._refreshMessage()
      }
      this.setData({ panelOpen: open })
      if (!open) {
        this._stopAudio()
      } else {
        wx.vibrateShort && wx.vibrateShort({ type: 'light' })
        // 首次打开时才推进步进 + 清 TTS 缓存
        this._advanceStep()
        this._cachedTempPath = null   // 清上一步的音频缓存，新消息需要新音频
        setTimeout(() => { if (this.data.panelOpen) this.playTTS() }, 550)
      }
    },

    playTTS() {
      try {
        if (this.data.ttsPlaying && this._audioCtx) {
          this._audioCtx.pause()
          this.setData({ ttsPlaying: false })
          return
        }
        // 已有缓存文件 → 直接播放
        if (this._cachedTempPath) {
          this._playFromPath(this._cachedTempPath)
          return
        }
        this.setData({ ttsLoading: true })
        const app = getApp()
        const serverUrl = (app && app.globalData && app.globalData.serverUrl) || 'https://crayxus-game.onrender.com'
        wx.request({
          url: serverUrl + '/api/ai/ielts/tts',
          method: 'POST',
          data: { text: this.data.msg.text, voice: 'zh-female' },
          timeout: 30000,
          success: (r) => {
            const d = r.data
            if (d && d.ok && d.audio) {
              this._writeAndPlay(d.audio)
            } else {
              this.setData({ ttsLoading: false })
              wx.showToast({ title: 'AI 语音暂不可用', icon: 'none' })
            }
          },
          fail: () => {
            this.setData({ ttsLoading: false })
            wx.showToast({ title: '网络异常', icon: 'none' })
          }
        })
      } catch(e) { console.warn('[ai-helper playTTS]', e); this.setData({ ttsLoading: false }) }
    },

    _writeAndPlay(dataUri) {
      try {
        const m = dataUri.match(/^data:audio\/(\w+);base64,(.*)$/)
        if (!m) { this.setData({ ttsLoading: false }); return }
        const ext = m[1] === 'mpeg' ? 'mp3' : m[1]
        const fs = wx.getFileSystemManager()
        const tempPath = `${wx.env.USER_DATA_PATH}/aihelp_${Date.now()}.${ext}`
        fs.writeFile({
          filePath: tempPath,
          data: m[2],
          encoding: 'base64',
          success: () => {
            this._cachedTempPath = tempPath
            this.setData({ ttsLoading: false })
            this._playFromPath(tempPath)
          },
          fail: () => { this.setData({ ttsLoading: false }) }
        })
      } catch(e) { this.setData({ ttsLoading: false }) }
    },

    _playFromPath(path) {
      try {
        this._stopAudio()
        const ctx = wx.createInnerAudioContext()
        ctx.src = path
        ctx.onPlay(() => this.setData({ ttsPlaying: true }))
        ctx.onPause(() => this.setData({ ttsPlaying: false }))
        ctx.onEnded(() => this.setData({ ttsPlaying: false }))
        ctx.onError((err) => { console.warn('[ai-helper audio]', err); this.setData({ ttsPlaying: false }) })
        this._audioCtx = ctx
        ctx.play()
      } catch(e) {}
    },

    _stopAudio() {
      if (this._audioCtx) {
        try { this._audioCtx.stop(); this._audioCtx.destroy() } catch(e) {}
        this._audioCtx = null
      }
      this.setData({ ttsPlaying: false })
    }
  }
})
