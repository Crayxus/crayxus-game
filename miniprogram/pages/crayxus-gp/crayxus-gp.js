// Crayxus GP · AI 神经驾驶联赛
const DRIVERS = [
  {
    id: 'alpha', avatar: '🏎️', name: 'Crayxus-Alpha',
    color: '#00eaff',
    dev: 'Crayxus AI 团队',
    aiModel: '自研 V8 强化学习',
    aiBadge: 'CRX-V8',
    mentor: '浙江大学 · 张旭光教授',
    bestLap: '1:23.456',
    races: 47, wins: 12, points: 348,
    delta: 0
  },
  {
    id: 'doubao', avatar: '🚗', name: 'Doubao-X',
    color: '#ff4081',
    dev: '字节跳动 ML 团队',
    aiModel: '豆包 1.5 Pro',
    aiBadge: '豆包',
    mentor: '北京大学 AI 学院',
    bestLap: '1:24.012',
    races: 52, wins: 9, points: 311,
    delta: 0.556
  },
  {
    id: 'kimi', avatar: '🚀', name: 'Kimi-Racer',
    color: '#7c4dff',
    dev: 'Moonshot AI',
    aiModel: 'Kimi K2 Pro',
    aiBadge: 'Kimi',
    mentor: '清华大学交叉信息研究院',
    bestLap: '1:24.789',
    races: 38, wins: 7, points: 268,
    delta: 1.333
  },
  {
    id: 'deepseek', avatar: '⚡', name: 'DeepSeek-Drift',
    color: '#10b981',
    dev: 'DeepSeek AI',
    aiModel: 'DeepSeek V4',
    aiBadge: 'DSV4',
    mentor: '中科院自动化所',
    bestLap: '1:25.234',
    races: 41, wins: 6, points: 245,
    delta: 1.778
  },
  {
    id: 'qwen', avatar: '🌪', name: 'Qwen-Velocity',
    color: '#ffd700',
    dev: '阿里达摩院',
    aiModel: '通义千问 Max',
    aiBadge: 'Qwen',
    mentor: '上海交大人工智能研究院',
    bestLap: '1:25.890',
    races: 45, wins: 5, points: 232,
    delta: 2.434
  },
  {
    id: 'gpt', avatar: '🌐', name: 'GPT-Stratos',
    color: '#ff9500',
    dev: 'OpenAI 海外团队',
    aiModel: 'GPT-4o',
    aiBadge: 'GPT-4o',
    mentor: 'Stanford AI Lab',
    bestLap: '1:26.123',
    races: 33, wins: 4, points: 198,
    delta: 2.667
  }
]

// 4 条赛道（SVG path 用于俯瞰图）
const TRACKS_RAW = [
  {
    id: 't1', name: '杭州 · 西湖盘山道', code: 'WEST LAKE GP',
    length: '4.2 km', turns: 18, diff: 4,
    record: '1:23.456 · Crayxus-Alpha',
    color: '#00eaff',
    path: 'M 60 200 Q 90 80, 230 90 Q 360 100, 420 50 Q 480 30, 480 110 Q 470 200, 380 200 Q 280 200, 280 280 Q 280 360, 180 360 Q 60 360, 60 260 Z'
  },
  {
    id: 't2', name: '上海 · 陆家嘴夜赛', code: 'PUDONG NIGHT',
    length: '5.1 km', turns: 22, diff: 5,
    record: '1:31.890 · Crayxus-Alpha',
    color: '#ff4081',
    path: 'M 80 300 Q 80 200, 180 180 Q 280 160, 280 80 Q 280 40, 380 40 Q 460 40, 460 130 Q 460 200, 380 220 Q 280 240, 280 320 Q 280 380, 180 380 Q 80 380, 80 300 Z'
  },
  {
    id: 't3', name: '浙大 · 紫金港校园', code: 'ZJU CAMPUS',
    length: '3.0 km', turns: 14, diff: 3,
    record: '1:08.234 · Crayxus-Alpha',
    color: '#10b981',
    path: 'M 80 200 Q 80 100, 200 100 Q 320 100, 320 60 Q 320 30, 420 60 Q 480 80, 480 180 Q 480 280, 380 280 Q 200 280, 200 360 Q 200 400, 100 380 Q 50 360, 80 200 Z'
  },
  {
    id: 't4', name: '海岸线 · 长岛环路', code: 'COASTAL CIRCUIT',
    length: '6.8 km', turns: 26, diff: 5,
    record: '2:15.678 · Crayxus-Alpha',
    color: '#ffd700',
    path: 'M 50 220 Q 50 100, 150 80 Q 250 60, 280 140 Q 310 220, 380 180 Q 460 130, 480 220 Q 490 320, 410 350 Q 320 380, 280 320 Q 240 250, 160 290 Q 70 320, 50 220 Z'
  }
]

// ===== F1 上海赛道路径 + 1 圈分段定义 =====
// SVG path 在 540x440 viewBox 中描绘上海国际赛车场 (含标志性蜗牛弯)
const SHANGHAI_PATH = 'M 100 360 L 360 360 Q 470 360 470 250 Q 470 140 360 140 Q 270 140 280 220 Q 290 280 350 270 Q 380 280 360 300 Q 280 320 220 290 Q 170 250 200 200 Q 240 150 180 130 Q 80 110 70 220 Q 70 360 100 360 Z'
// 13 段 lap — 弧形 + 急弯混合的 F1 赛车感设计
// 净转 -360° (3 弧形 R + 2 急 R + 1 急 L)
// 节奏: 长直 → 流畅弧形进弯 → 短直 → 急右 → 蜗牛反向 (急左) → 急右 → 弧形 → 长直 → 弧形终点
// 几何闭合考虑弧形位移 R≈20cm (~667ms 时长): d1=d3+d5-667, d2+d4=d6+667
// kind=arc: 'X'/'Y'/'x'/'y' 弧形 (车持续前进+差速)
// kind=turn: 'R'/'L'/'r'/'l' 原地 (车停下原地转)
const SHANGHAI_LAP = [
  { kind: 'straight', dur: 2333, label: '🏁 起跑长直',         x: 360, y: 360 },
  { kind: 'arc',  dir: 'R', deg: 90, label: 'T1 进弯 (弧形)',   x: 470, y: 250 },
  { kind: 'straight', dur: 1500, label: 'T2 短直',              x: 470, y: 140 },
  { kind: 'turn', dir: 'R', deg: 90, label: 'T3 急弯',          x: 360, y: 140 },
  { kind: 'straight', dur: 1500, label: '蜗牛内',               x: 280, y: 220 },
  { kind: 'turn', dir: 'L', deg: 90, label: 'T4 蜗牛反向 (急左)', x: 350, y: 270 },
  { kind: 'straight', dur: 1500, label: '蜗牛出',               x: 220, y: 290 },
  { kind: 'turn', dir: 'R', deg: 90, label: 'T5 出蜗牛',        x: 200, y: 200 },
  { kind: 'straight', dur: 1500, label: '后直道',               x: 180, y: 130 },
  { kind: 'arc',  dir: 'R', deg: 90, label: 'T6 大弧',          x: 80,  y: 200 },
  { kind: 'straight', dur: 2333, label: '长直道 (回环)',         x: 70,  y: 360 },
  { kind: 'arc',  dir: 'R', deg: 90, label: 'T7 终点弧',        x: 100, y: 360 },
  { kind: 'stop', label: '🏁 1 圈完成!',                        x: 100, y: 360 }
]
// 转弯阻塞时长估算 (ms): 经验值 ~8ms/° + 100ms 余量
function turnBlockMs(deg) { return deg * 9 + 200 }

function buildTrackSvgUri(path, color) {
  // 加 width/height 显式属性, 某些 mini-program 渲染器需要才能正确绘制 SVG
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='540' height='440' viewBox='0 0 540 440'>
    <path d='${path}' stroke='${color}' stroke-width='14' stroke-linejoin='round' fill='none' opacity='0.18'/>
    <path d='${path}' stroke='${color}' stroke-width='5' stroke-linejoin='round' fill='none'/>
    <path d='${path}' stroke='#fff' stroke-width='1.5' stroke-linejoin='round' fill='none' stroke-dasharray='6 4' opacity='0.6'/>
  </svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

const TRACKS = TRACKS_RAW.map(t => ({
  ...t,
  diffStars: '★'.repeat(t.diff) + '☆'.repeat(5 - t.diff),
  svgUri: buildTrackSvgUri(t.path, t.color)
}))

// ===== 五段课程梯度 (跟硬件梯度 LV1-LV5 对应) =====
const COURSE_TIERS = [
  {
    id: 'lv1', lv: 'LV.1', name: '启航班', emoji: '📚', color: '#95a5a6',
    title: '积木编程入门',
    learn: ['流程·循环·条件三件套', '蓝牙+红外双控基础', '一句话指挥赛车'],
    project: '跑 8 字 / 写名字 / 自然语言指令',
    hours: '8 课时', age: '小学低年级', rank: '段位 1-3 段',
    hardware: 'KE3051 麦轮车', price: 488,
    state: 'current'  // 'current' | 'locked' | 'unlocked'
  },
  {
    id: 'lv2', lv: 'LV.2', name: '智控班', emoji: '🌐', color: '#4aa8ff',
    title: '大模型驾驶',
    learn: ['API 调用 · JSON 数据', '提示工程 · NLP 解析', '云端 LLM 接入'],
    project: '聊天指挥车 / 自然语言控车',
    hours: '12 课时', age: '小学高年级', rank: '段位 4-6 段',
    hardware: 'ESP32-S3 联网车', price: 988,
    state: 'locked'
  },
  {
    id: 'lv3', lv: 'LV.3', name: '视觉班', emoji: '👁️', color: '#2ecc71',
    title: '视觉 AI',
    learn: ['图像识别 · 巡线算法', '物体追踪 · 特征提取', 'OpenCV 实战'],
    project: '自动巡线赛 / 路标识别 / 追小球',
    hours: '16 课时', age: '初中', rank: '段位 7-9 段',
    hardware: 'K230 / RV1106 视觉车', price: 1988,
    state: 'locked'
  },
  {
    id: 'lv4', lv: 'LV.4', name: '决策班', emoji: '🧠', color: '#f39c12',
    title: '强化学习',
    learn: ['RL 原理 · 奖励函数', '策略网络 · 端侧推理', '多车协作训练'],
    project: '训练自己的 AI 赛车手 / 多车竞赛',
    hours: '24 课时', age: '高中', rank: '段位 10-12 段',
    hardware: 'RK3566 + NPU 竞速车', price: 3988,
    state: 'locked'
  },
  {
    id: 'lv5', lv: 'LV.5', name: '大师班', emoji: '🚀', color: '#C8102E',
    title: '自主智能',
    learn: ['ROS 机器人系统 · SLAM', '端到端深度学习', '自训练新技能'],
    project: '自主跑赛道 / 论文级项目',
    hours: '32 课时', age: '高中竞赛 / 大学预备', rank: '段位 13 段',
    hardware: '树莓派 5 + ROS 冠军车', price: 8888,
    state: 'locked'
  }
]

// ===== 微信同传插件 (STT) - 容错加载 =====
let voicePlugin = null
let voiceManager = null
try {
  if (typeof requirePlugin === 'function') {
    voicePlugin = requirePlugin('WechatSI')
    if (voicePlugin && typeof voicePlugin.getRecordRecognitionManager === 'function') {
      voiceManager = voicePlugin.getRecordRecognitionManager()
    }
  }
} catch (e) {
  console.warn('WechatSI plugin not available (语音功能将禁用):', e && e.message)
  voicePlugin = null
  voiceManager = null
}

// ===== 语音指令关键词表 =====
// 用户说什么 → 调哪个 action (页面方法名)
const VOICE_COMMANDS = [
  // 演示动作
  { keywords: ['原地转圈', '转圈圈', '转圈', '转个圈', '原地转', '旋转'], action: 'demoSpin',     label: '🌀 原地转圈' },
  { keywords: ['绕圆', '画圆', '绕个圈', '圆圈'],                          action: 'demoCircle',   label: '⭕ 绕圆' },
  { keywords: ['八字', '走八字', '8字', '8 字', '绕八字', '走 8'],          action: 'demoFigure8',  label: '∞ 走 8 字' },
  // 赛道
  { keywords: ['跑赛道', '跑一圈', 'F1', '上海赛道', '比赛', '开始比赛', '开跑'], action: 'voiceStartLap', label: '🏁 跑 F1 赛道' },
  // 停止
  { keywords: ['停', '停下', '停止', '停车', '别动', '停一下'],            action: 'demoStop',     label: '⏹ 停止' },
  // 手动方向
  { keywords: ['前进', '往前', '直走', '直行', '向前走', '往前走'],         action: 'voiceForward', label: '▲ 前进' },
  { keywords: ['后退', '倒车', '退回', '往后退', '后退一下'],              action: 'voiceBack',    label: '▼ 后退' },
  { keywords: ['左转', '往左', '向左', '左拐'],                            action: 'voiceLeft',    label: '◀ 左转' },
  { keywords: ['右转', '往右', '向右', '右拐'],                            action: 'voiceRight',   label: '▶ 右转' },
  // MPU 闭环精确转弯
  { keywords: ['原地左转九十度', '左转 90', '精确左转', '急左'],            action: 'testTurnL90',  label: '⟲ 精确左 90°' },
  { keywords: ['原地右转九十度', '右转 90', '精确右转', '急右'],            action: 'testTurnR90',  label: '⟳ 精确右 90°' },
]

// ===== AI 教练 (AAaaS) 人设 =====
const TUTOR_PROFILES = {
  lv1: {
    id: 'lv1', name: '小启', emoji: '😊', style: '鼓励型', color: '#95a5a6', lv: 'LV.1 启航班',
    welcome: '嗨! 我是小启, 你的 AI 教练! 今天想学什么? 比如"什么是循环"、"教我跑 8 字"——直接按住麦克风问我也行! 🚗',
    systemPrompt: '你是 Crayxus AI·GP 的 AI 教练"小启", 服务 LV.1 启航班 (小学 1-3 年级). 你的风格是鼓励型, 多用 emoji 和小贴纸, 回答简短(50 字内)、易懂. 学生有问题时, 先鼓励, 再给提示而不是直接答案. 教学主题: 蓝牙控制赛车、流程·循环·条件、一句话指挥车. 不要长篇大论, 像哥哥姐姐一样亲切.',
    quickAsks: ['什么是循环?', '车跑不直怎么办?', '教我跑 8 字', '怎么用一句话开车?']
  },
  lv2: {
    id: 'lv2', name: '小通', emoji: '🤔', style: '解释型', color: '#4aa8ff', lv: 'LV.2 智控班',
    welcome: '你好, 我是小通! 我会用类比的方法帮你理解大模型怎么开车. 比如"什么是 API"、"提示工程是什么"——问吧!',
    systemPrompt: '你是 Crayxus AI·GP 的 AI 教练"小通", 服务 LV.2 智控班 (小学高年级). 你善于用生活类比解释抽象概念 (比如把 API 比作点外卖). 回答简洁但清楚, 100 字内. 教学主题: API 调用、JSON、提示工程、NLP 控车.',
    quickAsks: ['什么是 API?', '怎么写好 Prompt?', 'JSON 是什么?', '让大模型记得我']
  },
  lv3: {
    id: 'lv3', name: '小视', emoji: '🔍', style: '实战型', color: '#2ecc71', lv: 'LV.3 视觉班',
    welcome: '我是小视, 实战派! 视觉 AI 重在动手. 想学巡线、识别、追踪? 直接问我具体场景!',
    systemPrompt: '你是 Crayxus AI·GP 的 AI 教练"小视", 服务 LV.3 视觉班 (初中). 你重实战, 喜欢给具体案例和代码片段. 回答 150 字内. 教学主题: OpenCV、巡线、物体检测、多模态大模型 VLM.',
    quickAsks: ['怎么做巡线?', 'HSV 跟 RGB 区别', '什么是 YOLO?', 'VLM 是什么?']
  },
  lv4: {
    id: 'lv4', name: '小策', emoji: '📊', style: '学术型', color: '#f39c12', lv: 'LV.4 决策班',
    welcome: '我是小策. 强化学习是真正的硬核, 但也最有趣. 想问 RL 原理、PPO、奖励函数? 来吧.',
    systemPrompt: '你是 Crayxus AI·GP 的 AI 教练"小策", 服务 LV.4 决策班 (高一-高二). 你像研究生学长, 会引用论文和具体算法. 回答 200 字内. 教学主题: 强化学习 RL、DQN/PPO/SAC、奖励函数、端侧推理、多智能体.',
    quickAsks: ['什么是 RL?', 'PPO 怎么工作?', '奖励函数怎么设计?', '什么是 Actor-Critic?']
  },
  lv5: {
    id: 'lv5', name: '小博', emoji: '🎓', style: '教授型', color: '#C8102E', lv: 'LV.5 大师班',
    welcome: '我是小博. 大师班讲究学术深度和系统思维. 想讨论 ROS、SLAM、端到端、VLA、AI Agent? 我们深入聊.',
    systemPrompt: '你是 Crayxus AI·GP 的 AI 教练"小博", 服务 LV.5 大师班 (高二-高三). 你像论文导师, 严谨但开放, 善于引导思考而非给答案. 回答 250 字内, 必要时给文献建议. 教学主题: ROS、SLAM、端到端 DL、Transformer、VLA、Robot LLM、AI Agent.',
    quickAsks: ['什么是 SLAM?', 'VLA 模型是什么?', 'ROS 入门怎么学?', '推荐几篇论文']
  }
}

// 兜底 mock 回复 (API 失败时用)
const MOCK_REPLIES = {
  lv1: {
    '循环': '循环就是让车反复做一件事! 🌀 比如画 5 个方形, 不用写 5 遍代码, 用 for(int i=0; i<5; i++) 就够啦. 你想试试吗?',
    '车跑不直|不直|偏': '车跑不直多半是 4 个轮子速度不一样! 试试电机微调 (trim), 或者跟我说说你写的代码~ 🔧',
    '8字|八字|8 字': '8 字 = 先右转一个圆 + 再左转一个圆 ∞ 试试: 先 Turn_Right 一段时间, 然后切换 Turn_Left! 加油~',
    '一句话|语音': '直接按住语音键说"原地转圈"、"绕个圆"、"跑赛道"——AI 就会自己执行哦! 🎤',
    '段位': '8 节课全部完成 + 通过段位测评 = 1 段证书! 你已经在路上啦 ⭐',
    '_default': '好问题! 我想想呀... 你可以多说一点吗? 比如"我想让车____"这样, 我就更容易帮你 😊'
  }
}

function mockReply(lv, userText) {
  const profile = MOCK_REPLIES[lv] || MOCK_REPLIES.lv1
  for (const key in profile) {
    if (key === '_default') continue
    const patterns = key.split('|')
    if (patterns.some(p => userText.indexOf(p) !== -1)) return profile[key]
  }
  return profile._default
}

// ===== 四大板块 =====
const MODULES = [
  { id: 'training', icon: '🎓', name: '训练', desc: '实车演示 + F1 赛道训练' },
  { id: 'racing',   icon: '🏆', name: '赛事', desc: '神驾联赛 · 积分榜' },
  { id: 'register', icon: '📝', name: '报名', desc: '五段课程 · 段位测评' },
  { id: 'lab',      icon: '🧪', name: '实验室', desc: '训练自己的 AI 车手' }
]

// ===== 赛事列表 (mock) =====
const TOURNAMENTS = [
  { id: 'spring2026', name: '2026 春季神驾杯', date: '2026-05-25', stage: '报名中', prize: '¥10,000', enrolled: 86 },
  { id: 'school',     name: '校园车王争霸赛', date: '2026-06-15', stage: '即将开始', prize: '段位证书+奖牌', enrolled: 142 },
  { id: 'national',   name: '全国 AI 编程车锦标赛', date: '2026-08-20', stage: '预告',   prize: '保送/直推+¥50,000', enrolled: 0 }
]

// ===== 实验室功能 =====
const LAB_FEATURES = [
  { icon: '📊', name: '我的训练数据', desc: 'RL 训练曲线 / 圈速 / 段位提升轨迹' },
  { icon: '🤖', name: '上传我的 AI', desc: '把训练好的模型部署到实车' },
  { icon: '⚔️', name: 'AI vs AI 对战', desc: '我的 AI 车手对战其他玩家的 AI' },
  { icon: '📜', name: '战绩证书', desc: '段位认证 + 区块链存证' }
]

Page({
  data: {
    statusBarHeight: 44,
    drivers: DRIVERS,
    tracks: TRACKS,
    selectedDriverId: 'alpha',
    selectedTrackId: 't1',
    raceState: 'idle',  // idle | racing | paused | finished
    lap: 0,
    totalLaps: 40,
    liveTiming: [],
    elapsedSec: 0,
    selectedDriver: null,
    selectedTrack: null,
    driverPickerOpen: false,
    trackPickerOpen: false,
    // === BLE 实车演示状态 ===
    bleConnecting: false,
    bleConnected: false,
    bleDeviceId: '',
    bleServiceId: '',
    bleCharId: '',
    // === Shanghai 赛道模拟 ===
    shanghaiSvg: buildTrackSvgUri(SHANGHAI_PATH, '#ff4081'),
    markerX: 100,
    markerY: 360,
    markerDur: 0,
    lapRunning: false,
    lapStep: 0,
    lapTotal: SHANGHAI_LAP.length,
    lapLabel: '准备就绪',
    // === 四大板块 + 五段课程 + 当前阶段 ===
    modules: MODULES,
    activeModule: 'training',
    courseTiers: COURSE_TIERS,
    tournaments: TOURNAMENTS,
    labFeatures: LAB_FEATURES,
    currentRank: { lv: 'LV.1', name: '启航班', progress: 32, totalLessons: 8, doneLessons: 2, racePoints: 320 },
    // === 电机微调 (-50 ~ +50, 保留但 UI 不显示) ===
    trimUL: 0, trimUR: 0, trimLL: 0, trimLR: 0,
    manualActive: '',
    // === BLE 遥测 (Arduino 回传) ===
    bleNotifyCharId: '',
    lapLog: [],          // [{kind:'T'|'S'|'?', raw, ...parsed}]
    lapLogModalOpen: false,
    // === 语音控制 ===
    voiceSupported: !!voiceManager,
    voiceListening: false,
    voiceText: '',
    voiceLastCmd: '',
    voiceErrorMsg: '',
    // === AI 教练 (AAaaS) ===
    tutorOpen: false,
    tutorProfile: null,
    tutorMessages: [],
    tutorTyping: false,
    tutorInputText: '',
    tutorVoiceListening: false
  },

  _noop() {},

  // ============ 语音控制 ============
  _initVoice() {
    if (!voiceManager) return
    voiceManager.onStart = () => {
      this.setData({ voiceListening: true, voiceText: '', voiceErrorMsg: '' })
    }
    voiceManager.onRecognize = (res) => {
      // 实时识别 (按住说话过程中持续触发)
      if (res && res.result) {
        this.setData({ voiceText: res.result })
      }
    }
    voiceManager.onStop = (res) => {
      const text = (res && res.result) ? res.result.trim() : ''
      this.setData({ voiceListening: false, tutorVoiceListening: false, voiceText: text })
      if (!text) return
      // 区分: AI 教练模式 vs 控车模式
      if (this._tutorVoiceMode) {
        this._tutorVoiceMode = false
        this.setData({ tutorInputText: text })
        this.sendTutorMessage()
      } else {
        this._matchAndExecuteVoice(text)
      }
    }
    voiceManager.onError = (err) => {
      console.error('Voice error:', err)
      this.setData({
        voiceListening: false,
        voiceErrorMsg: (err && err.msg) ? err.msg : '识别失败'
      })
      wx.showToast({ title: '识别失败, 请重试', icon: 'none', duration: 1500 })
    }
  },

  voiceTouchStart() {
    if (!voiceManager) {
      wx.showToast({ title: '请到小程序后台添加"微信同声传译"插件', icon: 'none', duration: 2500 })
      return
    }
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    voiceManager.start({ duration: 10000, lang: 'zh_CN' })
  },

  voiceTouchEnd() {
    if (!voiceManager || !this.data.voiceListening) return
    voiceManager.stop()
  },

  _matchAndExecuteVoice(text) {
    // 去除标点 + 空白便于匹配
    const cleaned = String(text).replace(/[\s,.。!！?？、,]/g, '')
    for (const cmd of VOICE_COMMANDS) {
      for (const kw of cmd.keywords) {
        const kwClean = kw.replace(/\s+/g, '')
        if (cleaned.indexOf(kwClean) !== -1) {
          this.setData({ voiceLastCmd: cmd.label })
          wx.vibrateShort && wx.vibrateShort({ type: 'light' })
          // 调对应方法
          if (typeof this[cmd.action] === 'function') {
            this[cmd.action]()
          }
          wx.showToast({
            title: '✓ ' + cmd.label,
            icon: 'none',
            duration: 1200
          })
          return
        }
      }
    }
    // 没匹配上
    this.setData({ voiceLastCmd: '未识别: ' + text })
    wx.showToast({
      title: '没听懂: ' + text,
      icon: 'none', duration: 1800
    })
  },

  // === 语音指令的适配函数 (复用现有方法但语音模式下不需要 touchstart/touchend) ===
  async voiceStartLap() {
    if (!this.data.lapRunning) {
      await this.startShanghaiLap()
    }
  },
  async voiceForward() {
    // 模拟"按 5 秒"前进
    await this._voiceManualPulse('a', '前进', 3000)
  },
  async voiceBack() {
    await this._voiceManualPulse('c', '后退', 2500)
  },
  async voiceLeft() {
    await this._voiceManualPulse('b', '左转', 800)
  },
  async voiceRight() {
    await this._voiceManualPulse('d', '右转', 800)
  },
  async _voiceManualPulse(cmd, label, durationMs) {
    const ok = await this._bleEnsureConnected()
    if (!ok) return
    this._stopManualHeartbeat()
    this._manualCmd = cmd
    this.setData({ manualActive: cmd })
    this._bleSend(cmd).catch(() => {})
    this._manualHeartbeat = setInterval(() => {
      if (this._manualCmd) this._bleSend(this._manualCmd).catch(() => {})
    }, 400)
    setTimeout(() => {
      this._stopManualHeartbeat()
      this._bleSend('s').catch(() => {})
      this.setData({ manualActive: '' })
    }, durationMs)
  },

  // ============ AI 教练 (AAaaS) ============
  openTutor(e) {
    const lv = (e && e.currentTarget && e.currentTarget.dataset.lv) || 'lv1'
    const profile = TUTOR_PROFILES[lv]
    if (!profile) return
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({
      tutorOpen: true,
      tutorProfile: profile,
      tutorMessages: [{ role: 'tutor', text: profile.welcome, t: Date.now() }],
      tutorInputText: ''
    })
  },

  closeTutor() {
    this.setData({ tutorOpen: false })
  },

  onTutorInput(e) {
    this.setData({ tutorInputText: e.detail.value })
  },

  quickAskTutor(e) {
    const text = e.currentTarget.dataset.text
    if (!text) return
    this.setData({ tutorInputText: text })
    this.sendTutorMessage()
  },

  async sendTutorMessage() {
    const text = String(this.data.tutorInputText || '').trim()
    if (!text || this.data.tutorTyping) return
    const profile = this.data.tutorProfile
    if (!profile) return

    const msgs = this.data.tutorMessages.slice()
    msgs.push({ role: 'user', text, t: Date.now() })
    this.setData({
      tutorMessages: msgs,
      tutorInputText: '',
      tutorTyping: true
    })

    // 调豆包 API, 失败回退 mock
    let reply
    try {
      reply = await this._callTutorLLM(profile, msgs, text)
    } catch (err) {
      console.warn('Tutor LLM error, fallback to mock:', err)
      reply = mockReply(profile.id, text)
    }

    const msgs2 = this.data.tutorMessages.slice()
    msgs2.push({ role: 'tutor', text: reply || mockReply(profile.id, text), t: Date.now() })
    this.setData({ tutorMessages: msgs2, tutorTyping: false })
  },

  _callTutorLLM(profile, history, userText) {
    // 豆包 API
    const recent = history.slice(-8).map(m => ({
      role: m.role === 'tutor' ? 'assistant' : 'user',
      content: m.text
    }))
    return new Promise((resolve, reject) => {
      wx.request({
        url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        method: 'POST',
        timeout: 10000,
        header: {
          'Authorization': 'Bearer 9fb81ccb-ed98-496e-8819-7f6ee7c54abb',
          'Content-Type': 'application/json'
        },
        data: {
          model: 'doubao-1-5-pro-32k-250115',
          messages: [
            { role: 'system', content: profile.systemPrompt },
            ...recent
          ],
          max_tokens: 300,
          temperature: 0.7
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data && res.data.choices && res.data.choices[0]) {
            resolve(res.data.choices[0].message.content)
          } else {
            reject(new Error('LLM API non-200 or empty: ' + JSON.stringify(res.data)))
          }
        },
        fail: reject
      })
    })
  },

  tutorVoiceStart() {
    if (!voiceManager) {
      wx.showToast({ title: '请添加微信同传插件', icon: 'none' })
      return
    }
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    this._tutorVoiceMode = true
    this.setData({ tutorVoiceListening: true })
    voiceManager.start({ duration: 12000, lang: 'zh_CN' })
  },

  tutorVoiceEnd() {
    if (this._tutorVoiceMode && voiceManager) voiceManager.stop()
  },

  // ============ 四大板块切换 ============
  switchModule(e) {
    const id = e.currentTarget.dataset.id
    if (id === this.data.activeModule) return
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ activeModule: id })
  },

  // ============ 课程报名 ============
  enrollCourse(e) {
    const id = e.currentTarget.dataset.id
    const tier = COURSE_TIERS.find(t => t.id === id)
    if (!tier) return
    wx.showModal({
      title: `${tier.lv} · ${tier.name}`,
      content: `${tier.title}\n\n配套硬件: ${tier.hardware}\n${tier.hours} · ${tier.age}\n\n费用: ¥${tier.price}\n\n确认报名 / 加入候补?`,
      confirmText: '立即报名',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '已加入候补名单', icon: 'success' })
        }
      }
    })
  },

  // ============ 赛事报名 ============
  enrollTournament(e) {
    const id = e.currentTarget.dataset.id
    const t = TOURNAMENTS.find(x => x.id === id)
    if (!t) return
    wx.showModal({
      title: t.name,
      content: `开赛日期: ${t.date}\n奖金: ${t.prize}\n已报名: ${t.enrolled} 人\n\n确认报名?`,
      confirmText: '我要报名',
      success: (res) => {
        if (res.confirm) wx.showToast({ title: '报名成功!', icon: 'success' })
      }
    })
  },

  // ============ 实验室功能 ============
  openLabFeature(e) {
    const name = e.currentTarget.dataset.name
    wx.showToast({ title: `${name} (敬请期待)`, icon: 'none', duration: 1500 })
  },

  openDriverPicker() {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ driverPickerOpen: true, trackPickerOpen: false })
  },
  closeDriverPicker() {
    this.setData({ driverPickerOpen: false })
  },
  selectDriverAndClose(e) {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ selectedDriverId: e.currentTarget.dataset.id, driverPickerOpen: false })
    this._refreshSelected()
  },

  openTrackPicker() {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ trackPickerOpen: true, driverPickerOpen: false })
  },
  closeTrackPicker() {
    this.setData({ trackPickerOpen: false })
  },
  selectTrackAndClose(e) {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ selectedTrackId: e.currentTarget.dataset.id, trackPickerOpen: false })
    this._refreshSelected()
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
    this._refreshSelected()
    this._initVoice()
  },

  onReady() {
    // canvas 在页面就绪后绘制
    this._drawShanghaiTrack()
  },

  _drawShanghaiTrack() {
    const query = this.createSelectorQuery()
    query.select('#shTrackCanvas').node().exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        // canvas 可能还没渲染好, 50ms 后重试
        setTimeout(() => this._drawShanghaiTrack(), 100)
        return
      }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      let dpr = 2
      try { dpr = wx.getSystemInfoSync().pixelRatio || 2 } catch (e) {}

      // 物理像素 = SVG 单位 * dpr
      canvas.width = 540 * dpr
      canvas.height = 440 * dpr
      ctx.scale(dpr, dpr)

      const drawPath = () => {
        ctx.beginPath()
        ctx.moveTo(100, 360)
        ctx.lineTo(360, 360)
        ctx.quadraticCurveTo(470, 360, 470, 250)
        ctx.quadraticCurveTo(470, 140, 360, 140)
        ctx.quadraticCurveTo(270, 140, 280, 220)
        ctx.quadraticCurveTo(290, 280, 350, 270)
        ctx.quadraticCurveTo(380, 280, 360, 300)
        ctx.quadraticCurveTo(280, 320, 220, 290)
        ctx.quadraticCurveTo(170, 250, 200, 200)
        ctx.quadraticCurveTo(240, 150, 180, 130)
        ctx.quadraticCurveTo(80, 110, 70, 220)
        ctx.quadraticCurveTo(70, 360, 100, 360)
        ctx.closePath()
      }

      // 第 1 层: 粗外环 (淡色)
      drawPath()
      ctx.strokeStyle = 'rgba(255, 64, 129, 0.35)'
      ctx.lineWidth = 16
      ctx.lineJoin = 'round'
      ctx.stroke()

      // 第 2 层: 主线 (鲜艳)
      drawPath()
      ctx.strokeStyle = '#ff4081'
      ctx.lineWidth = 6
      ctx.lineJoin = 'round'
      ctx.stroke()

      // 第 3 层: 白色虚线
      drawPath()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.lineWidth = 1.5
      try { ctx.setLineDash([6, 4]) } catch (e) {}
      ctx.stroke()
      try { ctx.setLineDash([]) } catch (e) {}

      // 第 4 层: 物理预测路径 (按 SHANGHAI_LAP 时长+转角推算)
      // 画在右上角小窗 (约 150x150), 标题 "实测预测"
      this._drawPredictedTrack(ctx)
    })
  },

  // 推算物理小车路径: 起点 (0,0) 朝 +Y
  // 直行段按速度*时间, 原地转弯瞬时改朝向, 弧形转弯沿圆弧位移
  _predictTrack() {
    const SPEED = 30   // cm/s
    const ARC_R = 20   // 弧形半径 cm (按 ARC_INNER=60 / ARC_OUTER=180 估)
    let x = 0, y = 0, theta = Math.PI / 2
    const pts = [{ x, y }]
    for (const seg of SHANGHAI_LAP) {
      if (seg.kind === 'straight') {
        const d = seg.dur * SPEED / 1000
        x += d * Math.cos(theta)
        y += d * Math.sin(theta)
        pts.push({ x, y })
      } else if (seg.kind === 'turn') {
        const rad = seg.deg * Math.PI / 180
        if (seg.dir === 'R') theta -= rad
        else                 theta += rad
      } else if (seg.kind === 'arc') {
        // 弧形: 沿半径 R 圆弧滑过 deg, 末位置 = 起始 + 弧线积分
        // 以 N 步线性逼近圆弧, 让预测窗看到弧形轨迹
        const N = 12
        const step = (seg.deg / N) * Math.PI / 180
        const dArc = ARC_R * step  // 每步弧长
        for (let k = 0; k < N; k++) {
          x += dArc * Math.cos(theta)
          y += dArc * Math.sin(theta)
          if (seg.dir === 'R') theta -= step
          else                 theta += step
          pts.push({ x, y })
        }
      }
    }
    return pts
  },

  _drawPredictedTrack(ctx) {
    const pts = this._predictTrack()
    if (pts.length < 2) return

    // 求 bounding box
    let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
    }
    const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY)

    // 右上角窗口 (canvas 坐标系, viewBox 540x440)
    const winX = 380, winY = 12, winW = 145, winH = 145
    const pad = 12
    const innerW = winW - 2 * pad, innerH = winH - 2 * pad
    const scale = Math.min(innerW / w, innerH / h)
    // 居中
    const offX = winX + pad + (innerW - w * scale) / 2
    const offY = winY + pad + (innerH - h * scale) / 2

    // SVG y 轴向下, 但物理 +Y 朝前; 画的时候上下翻一下让 +Y 朝上
    const toCanvas = (p) => ({
      cx: offX + (p.x - minX) * scale,
      cy: offY + (maxY - p.y) * scale  // y 反转
    })

    // 半透明深色底
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.rect(winX, winY, winW, winH)
    ctx.fill()
    ctx.stroke()

    // 标题
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.font = '11px sans-serif'
    ctx.fillText('物理预测', winX + 6, winY + 14)

    // 路径线
    ctx.beginPath()
    const p0 = toCanvas(pts[0])
    ctx.moveTo(p0.cx, p0.cy)
    for (let i = 1; i < pts.length; i++) {
      const p = toCanvas(pts[i])
      ctx.lineTo(p.cx, p.cy)
    }
    ctx.strokeStyle = '#4dd0e1'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.stroke()

    // 起点 (绿点) + 终点 (红点)
    const start = toCanvas(pts[0])
    const end = toCanvas(pts[pts.length - 1])
    ctx.fillStyle = '#4caf50'
    ctx.beginPath(); ctx.arc(start.cx, start.cy, 3.5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ff5252'
    ctx.beginPath(); ctx.arc(end.cx, end.cy, 3.5, 0, Math.PI * 2); ctx.fill()

    // 闭合误差文本
    const dx = pts[pts.length - 1].x - pts[0].x
    const dy = pts[pts.length - 1].y - pts[0].y
    const err = Math.sqrt(dx * dx + dy * dy)
    ctx.fillStyle = err < 5 ? '#80e27e' : '#ffab91'
    ctx.font = '10px sans-serif'
    ctx.fillText(`闭合误差 ${err.toFixed(1)}cm`, winX + 6, winY + winH - 6)
  },

  _refreshSelected() {
    const sd = DRIVERS.find(d => d.id === this.data.selectedDriverId) || DRIVERS[0]
    const st = TRACKS.find(t => t.id === this.data.selectedTrackId) || TRACKS[0]
    this.setData({ selectedDriver: sd, selectedTrack: st })
  },

  selectDriver(e) {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ selectedDriverId: e.currentTarget.dataset.id })
    this._refreshSelected()
  },

  selectTrack(e) {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ selectedTrackId: e.currentTarget.dataset.id })
    this._refreshSelected()
  },

  startRace() {
    if (this.data.raceState === 'racing') return
    wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
    this.setData({
      raceState: 'racing',
      lap: 1,
      elapsedSec: 0,
      liveTiming: this._initTiming()
    })
    this._raceTimer = setInterval(() => this._tickRace(), 800)
  },

  pauseRace() {
    if (this.data.raceState !== 'racing') return
    if (this._raceTimer) { clearInterval(this._raceTimer); this._raceTimer = null }
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    this.setData({ raceState: 'paused' })
  },

  resumeRace() {
    if (this.data.raceState !== 'paused') return
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    this.setData({ raceState: 'racing' })
    this._raceTimer = setInterval(() => this._tickRace(), 800)
  },

  stopRace() {
    if (this._raceTimer) { clearInterval(this._raceTimer); this._raceTimer = null }
    wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
    this.setData({ raceState: 'finished' })
  },

  resetRace() {
    if (this._raceTimer) { clearInterval(this._raceTimer); this._raceTimer = null }
    this.setData({ raceState: 'idle', lap: 0, elapsedSec: 0, liveTiming: [] })
  },

  _initTiming() {
    return DRIVERS.map((d, i) => ({
      pos: i + 1,
      id: d.id,
      name: d.name,
      avatar: d.avatar,
      color: d.color,
      lapTime: d.bestLap,
      gap: i === 0 ? '---' : `+${d.delta.toFixed(3)}`,
      lastLap: d.bestLap
    }))
  },

  _tickRace() {
    const d = this.data
    const newSec = d.elapsedSec + 1
    const newLap = Math.min(d.totalLaps, Math.floor(newSec / 4) + 1)

    // 模拟实时排位变化（相邻位置随机互换）
    const t = d.liveTiming.slice()
    for (let i = 0; i < t.length - 1; i++) {
      if (Math.random() < 0.08) {
        ;[t[i], t[i+1]] = [t[i+1], t[i]]
      }
    }
    // 更新 pos + gap
    t.forEach((row, i) => {
      row.pos = i + 1
      row.gap = i === 0 ? '---' : '+' + (Math.random() * 2 + i * 0.3).toFixed(3)
      row.lastLap = `1:${(23 + Math.random() * 5).toFixed(3)}`
    })

    if (newLap >= d.totalLaps) {
      if (this._raceTimer) { clearInterval(this._raceTimer); this._raceTimer = null }
      this.setData({ raceState: 'finished', lap: d.totalLaps, elapsedSec: newSec, liveTiming: t })
      wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
      return
    }

    this.setData({ lap: newLap, elapsedSec: newSec, liveTiming: t })
  },

  liveSpectate() {
    wx.showToast({ title: '🔴 直播观战开发中', icon: 'none', duration: 1500 })
  },

  replayData() {
    wx.showToast({ title: '📊 数据回放开发中', icon: 'none', duration: 1500 })
  },

  goBack() {
    if (this._raceTimer) { clearInterval(this._raceTimer); this._raceTimer = null }
    wx.navigateBack({ delta: 1, fail: () => wx.reLaunch({ url: '/pages/landing/landing' }) })
  },

  // ============ BLE 实车演示 ============
  // 协议: 'A'=原地转圈 'B'=绕圆圈 'C'=绕8字 'S'=停止
  // (与 D:/car-control/arduino/car_ble.ino 对齐)

  demoSpin()    { this._bleDoAction('A', '原地转圈', 5500) },
  demoCircle()  { this._bleDoAction('B', '绕圆圈',  8500) },
  demoFigure8() { this._bleDoAction('C', '绕 8 字', 10500) },

  // === MPU 闭环转弯单步测试 (调试用) ===
  async testTurnR90() { await this._testSingleTurn('R', '右转 90°') },
  async testTurnL90() { await this._testSingleTurn('L', '左转 90°') },
  async _testSingleTurn(ch, label) {
    const ok = await this._bleEnsureConnected()
    if (!ok) return
    this.setData({ lapLog: [] })
    this._telemetryBuf = ''
    try {
      await this._bleSend(ch)
      wx.showToast({ title: label + ' 已发送', icon: 'none', duration: 1200 })
    } catch (e) {
      wx.showToast({ title: '发送失败', icon: 'none' })
      return
    }
    // 等 ~1.2s 让 Arduino 闭环完成 + 回传 T,...
    await new Promise(r => setTimeout(r, 1500))
    if (this.data.lapLog.length > 0) {
      this.setData({ lapLogModalOpen: true })
    } else {
      wx.showToast({
        title: '没收到遥测 (检查 notify)',
        icon: 'none', duration: 2000
      })
    }
  },

  showLastLog() {
    if (this.data.lapLog.length === 0) {
      wx.showToast({ title: '日志为空', icon: 'none' })
      return
    }
    this.setData({ lapLogModalOpen: true })
  },

  async demoStop() {
    // 中止赛道模拟
    const wasRunning = this.data.lapRunning
    if (this.data.lapRunning) {
      this.setData({ lapRunning: false })
    }
    if (this._bleActionTimer) {
      clearTimeout(this._bleActionTimer)
      this._bleActionTimer = null
    }
    this._stopManualHeartbeat()
    if (!this.data.bleConnected) {
      wx.showToast({ title: '尚未连接', icon: 'none', duration: 1200 })
      return
    }
    try {
      await this._bleSend('S')
      wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
      wx.showToast({ title: '已停止', icon: 'success', duration: 800 })
    } catch (e) {
      wx.showToast({ title: '发送失败', icon: 'none' })
    }
    // 中断时也展示已收到的遥测 (撞墙调试用)
    if (wasRunning) {
      await new Promise(r => setTimeout(r, 250))
      if (this.data.lapLog.length > 0) {
        this.setData({ lapLogModalOpen: true })
      }
    }
  },

  // ============ 手动方向盘 (按住持续走, 松手停) ============

  manualForwardStart() { this._startManual('a', '前进') },
  manualBackStart()    { this._startManual('c', '后退') },
  manualLeftStart()    { this._startManual('b', '左转') },
  manualRightStart()   { this._startManual('d', '右转') },
  manualForwardEnd()   { this._stopManual() },
  manualBackEnd()      { this._stopManual() },
  manualLeftEnd()      { this._stopManual() },
  manualRightEnd()     { this._stopManual() },

  async _startManual(cmd, label) {
    const ok = await this._bleEnsureConnected()
    if (!ok) return
    this._stopManualHeartbeat()
    this._manualCmd = cmd
    this.setData({ manualActive: cmd })
    // 立刻发送 + 每 400ms 心跳维持 (Arduino 600ms 自停)
    try { await this._bleSend(cmd) } catch (e) {}
    this._manualHeartbeat = setInterval(() => {
      if (this._manualCmd) {
        this._bleSend(this._manualCmd).catch(() => {})
      }
    }, 400)
  },

  _stopManual() {
    this._stopManualHeartbeat()
    if (this.data.bleConnected) {
      this._bleSend('s').catch(() => {})
    }
    this.setData({ manualActive: '' })
  },

  _stopManualHeartbeat() {
    if (this._manualHeartbeat) {
      clearInterval(this._manualHeartbeat)
      this._manualHeartbeat = null
    }
    this._manualCmd = null
  },

  // ============ 电机微调 (Trim) ============

  onTrimChange(e) {
    const motor = e.currentTarget.dataset.motor  // 'UL' / 'UR' / 'LL' / 'LR'
    const value = e.detail.value
    this.setData({ ['trim' + motor]: value })
    this._sendTrimNow()
  },

  resetTrims() {
    this.setData({ trimUL: 0, trimUR: 0, trimLL: 0, trimLR: 0 })
    this._sendTrimNow()
    wx.showToast({ title: '已归零', icon: 'none', duration: 800 })
  },

  async saveTrims() {
    if (!this.data.bleConnected) {
      wx.showToast({ title: '请先连接车', icon: 'none' })
      return
    }
    await this._sendTrimNow()
    try {
      await this._bleSend('V')
      wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
      wx.showToast({ title: '✓ 已写入车的存储', icon: 'success', duration: 1200 })
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  _sendTrimNow() {
    if (!this.data.bleConnected) return Promise.resolve()
    const { trimUL, trimUR, trimLL, trimLR } = this.data
    const buf = new ArrayBuffer(5)
    const view = new DataView(buf)
    view.setUint8(0, 0x54)        // 'T'
    view.setInt8(1, trimUL)
    view.setInt8(2, trimUR)
    view.setInt8(3, trimLL)
    view.setInt8(4, trimLR)
    return new Promise((resolve, reject) => {
      wx.writeBLECharacteristicValue({
        deviceId: this.data.bleDeviceId,
        serviceId: this.data.bleServiceId,
        characteristicId: this.data.bleCharId,
        value: buf,
        success: resolve,
        fail: reject
      })
    }).catch(() => {})
  },

  // ============ Shanghai 赛道模拟 (1 圈) ============

  onShanghaiBtnTap() {
    if (this.data.lapRunning) {
      this.demoStop()
    } else {
      this.startShanghaiLap()
    }
  },

  async startShanghaiLap() {
    if (this.data.lapRunning) return
    const ok = await this._bleEnsureConnected()
    if (!ok) return

    // 重置标记位置 (无过渡) + 清空遥测日志
    this._telemetryBuf = ''
    this.setData({
      markerX: 100, markerY: 360, markerDur: 0,
      lapRunning: true, lapStep: 0, lapLabel: '出发...',
      lapLog: []
    })
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
    await new Promise(r => setTimeout(r, 250))

    // 逐段执行
    for (let i = 0; i < SHANGHAI_LAP.length; i++) {
      if (!this.data.lapRunning) break
      const seg = SHANGHAI_LAP[i]

      if (seg.kind === 'turn' || seg.kind === 'arc') {
        // 闭环转弯命令:
        //   原地 turn: 'R'/'L'=90°, 'r'/'l'=45°
        //   弧形 arc:  'X'/'Y'=90°, 'x'/'y'=45° (车持续前进, 圆弧赛车感)
        let ch
        if (seg.kind === 'arc') {
          if (seg.deg === 45) ch = (seg.dir === 'R') ? 'x' : 'y'
          else                ch = (seg.dir === 'R') ? 'X' : 'Y'
        } else {
          if (seg.deg === 45) ch = (seg.dir === 'R') ? 'r' : 'l'
          else                ch = (seg.dir === 'R') ? 'R' : 'L'
        }
        // 弧形转弯耗时更长 (车在转 + 走), 留更多 block time
        const blockMs = seg.kind === 'arc' ? (seg.deg * 18 + 300) : turnBlockMs(seg.deg)
        this.setData({
          markerX: seg.x, markerY: seg.y, markerDur: blockMs,
          lapStep: i + 1, lapLabel: seg.label
        })
        try {
          await this._bleSend(ch)
        } catch (e) {
          this.setData({ lapRunning: false, lapLabel: '通信失败' })
          return
        }
        const t0 = Date.now()
        while (Date.now() - t0 < blockMs && this.data.lapRunning) {
          await new Promise(r => setTimeout(r, 50))
        }
      } else if (seg.kind === 'straight') {
        this.setData({
          markerX: seg.x, markerY: seg.y, markerDur: seg.dur,
          lapStep: i + 1, lapLabel: seg.label
        })
        // 心跳式发 'a' (PID 航向锁直行, 避免 600ms 自停)
        let elapsed = 0
        const HEARTBEAT = 400
        while (elapsed < seg.dur && this.data.lapRunning) {
          try { await this._bleSend('a') } catch (e) {
            this.setData({ lapRunning: false, lapLabel: '通信失败' })
            return
          }
          const wait = Math.min(HEARTBEAT, seg.dur - elapsed)
          await new Promise(r => setTimeout(r, wait))
          elapsed += wait
        }
      } else if (seg.kind === 'stop') {
        this.setData({
          markerX: seg.x, markerY: seg.y, markerDur: 200,
          lapStep: i + 1, lapLabel: seg.label
        })
        try { await this._bleSend('s') } catch (e) {}
      }
    }

    // 末段 stop
    if (this.data.bleConnected) {
      this._bleSend('s').catch(() => {})
    }

    if (this.data.lapStep === SHANGHAI_LAP.length) {
      wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
      this.setData({ lapLabel: '🏁 完成 1 圈!' })
    }
    this.setData({ lapRunning: false })

    // 等 200ms 让最后的 S 行从 Arduino 飞过来 (BLE notify 有延迟)
    await new Promise(r => setTimeout(r, 250))
    if (this.data.lapLog.length > 0) {
      this.setData({ lapLogModalOpen: true })
    }
  },

  // 把日志格式化成可发的纯文本
  _formatLapLog() {
    const lines = ['# crayxus-gp lap log']
    let segIdx = 0
    for (const e of this.data.lapLog) {
      segIdx++
      if (e.kind === 'T') {
        const err = e.actual - e.target
        lines.push(`[${segIdx}] TURN ${e.dir}  target=${e.target}°  actual=${e.actual}°  err=${err.toFixed(1)}°  t=${e.ms}ms`)
      } else if (e.kind === 'S') {
        lines.push(`[${segIdx}] STRAIGHT  t=${e.ms}ms  yaw_drift=${e.drift.toFixed(1)}°`)
      }
    }
    // 简单汇总
    const turns = this.data.lapLog.filter(e => e.kind === 'T')
    if (turns.length > 0) {
      const totalErr = turns.reduce((a, e) => a + (e.actual - e.target), 0)
      const avgErr = totalErr / turns.length
      lines.push(`# turns=${turns.length}  total_err=${totalErr.toFixed(1)}°  avg_err=${avgErr.toFixed(1)}°`)
    }
    return lines.join('\n')
  },

  copyLapLog() {
    const txt = this._formatLapLog()
    wx.setClipboardData({
      data: txt,
      success: () => {
        wx.showToast({ title: '已复制, 粘贴给 Claude', icon: 'success', duration: 1500 })
      }
    })
  },

  closeLapLogModal() {
    this.setData({ lapLogModalOpen: false })
  },

  async _bleDoAction(cmd, label, durationMs) {
    const ok = await this._bleEnsureConnected()
    if (!ok) return
    try {
      await this._bleSend(cmd)
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
      wx.showToast({ title: label, icon: 'none', duration: 1500 })
      if (this._bleActionTimer) clearTimeout(this._bleActionTimer)
      this._bleActionTimer = setTimeout(() => { this._bleActionTimer = null }, durationMs)
    } catch (e) {
      wx.showToast({ title: '发送失败', icon: 'none' })
    }
  },

  async _bleEnsureConnected() {
    if (this.data.bleConnected) return true
    if (this.data.bleConnecting) return false
    this.setData({ bleConnecting: true })
    try {
      await new Promise((resolve, reject) => {
        wx.openBluetoothAdapter({
          success: resolve,
          fail: (err) => err.errCode === 10001 ? reject(new Error('请打开手机蓝牙')) : reject(err)
        })
      })
      const device = await this._bleScan()
      await new Promise((resolve, reject) => {
        wx.createBLEConnection({ deviceId: device.deviceId, success: resolve, fail: reject })
      })
      await new Promise(r => setTimeout(r, 800))
      const { serviceId, characteristicId, notifyCharacteristicId } = await this._bleFindWritable(device.deviceId)

      wx.onBLEConnectionStateChange((res) => {
        if (!res.connected) {
          this.setData({ bleConnected: false, bleDeviceId: '' })
        }
      })

      // 订阅 notify, 监听 Arduino 回传遥测 (T,... 和 S,...)
      if (notifyCharacteristicId) {
        try {
          await new Promise((resolve, reject) => {
            wx.notifyBLECharacteristicValueChange({
              deviceId: device.deviceId,
              serviceId,
              characteristicId: notifyCharacteristicId,
              state: true,
              success: resolve, fail: reject
            })
          })
          this._telemetryBuf = ''
          wx.onBLECharacteristicValueChange((res) => {
            this._onTelemetryBytes(res.value)
          })
        } catch (e) {
          console.warn('notify 订阅失败 (不影响控制):', e)
        }
      }

      this.setData({
        bleConnecting: false, bleConnected: true,
        bleDeviceId: device.deviceId,
        bleServiceId: serviceId,
        bleCharId: characteristicId,
        bleNotifyCharId: notifyCharacteristicId || ''
      })
      wx.showToast({ title: `已连接 ${device.name || device.localName}`, icon: 'success', duration: 1200 })
      return true
    } catch (err) {
      this.setData({ bleConnecting: false })
      wx.showToast({
        title: err.errMsg || err.message || '连接失败',
        icon: 'none', duration: 2500
      })
      return false
    }
  },

  _bleScan() {
    const targets = ['BT24', 'KE3051', 'KEYES', 'CAR', 'MLT']
    return new Promise((resolve, reject) => {
      let resolved = false
      const cleanup = () => {
        wx.stopBluetoothDevicesDiscovery()
        wx.offBluetoothDeviceFound()
      }
      const timeout = setTimeout(() => {
        if (resolved) return
        resolved = true; cleanup()
        reject(new Error('未找到智能车 (10秒超时)'))
      }, 10000)
      wx.onBluetoothDeviceFound((res) => {
        for (const d of res.devices) {
          const name = (d.name || d.localName || '').toUpperCase()
          if (!name) continue
          if (targets.some(h => name.includes(h))) {
            if (resolved) return
            resolved = true; clearTimeout(timeout); cleanup()
            resolve(d)
            return
          }
        }
      })
      wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false, powerLevel: 'high',
        fail: (err) => { clearTimeout(timeout); reject(err) }
      })
    })
  },

  async _bleFindWritable(deviceId) {
    const svcRes = await new Promise((resolve, reject) => {
      wx.getBLEDeviceServices({ deviceId, success: resolve, fail: reject })
    })
    // 优先尝试 FFE0 (DX-BT24 默认 UART 服务)
    const services = [...svcRes.services].sort((a, b) => {
      const ap = a.uuid.toUpperCase().includes('FFE0') ? 0 : 1
      const bp = b.uuid.toUpperCase().includes('FFE0') ? 0 : 1
      return ap - bp
    })
    for (const svc of services) {
      try {
        const charRes = await new Promise((resolve, reject) => {
          wx.getBLEDeviceCharacteristics({
            deviceId, serviceId: svc.uuid, success: resolve, fail: reject
          })
        })
        let writeChar = null, notifyChar = null
        for (const ch of charRes.characteristics) {
          if (!writeChar && (ch.properties.write || ch.properties.writeNoResponse)) {
            writeChar = ch.uuid
          }
          if (!notifyChar && (ch.properties.notify || ch.properties.indicate)) {
            notifyChar = ch.uuid
          }
        }
        if (writeChar) {
          return {
            serviceId: svc.uuid,
            characteristicId: writeChar,
            notifyCharacteristicId: notifyChar  // 可能跟 write 同 char (FFE1)
          }
        }
      } catch (e) { /* 试下一个服务 */ }
    }
    throw new Error('未找到可写蓝牙特征值')
  },

  _bleSend(charCode) {
    if (!this.data.bleConnected) return Promise.reject()
    const buf = new ArrayBuffer(1)
    new DataView(buf).setUint8(0, charCode.charCodeAt(0))
    return new Promise((resolve, reject) => {
      wx.writeBLECharacteristicValue({
        deviceId: this.data.bleDeviceId,
        serviceId: this.data.bleServiceId,
        characteristicId: this.data.bleCharId,
        value: buf, success: resolve, fail: reject
      })
    })
  },

  // 处理 Arduino 通过 BLE notify 回传的字节, 按 \n 分行解析
  _onTelemetryBytes(arrayBuf) {
    const view = new Uint8Array(arrayBuf)
    let s = ''
    for (let i = 0; i < view.length; i++) s += String.fromCharCode(view[i])
    this._telemetryBuf = (this._telemetryBuf || '') + s

    // 按 \n 切, 留下最后未完整行
    const lines = this._telemetryBuf.split('\n')
    this._telemetryBuf = lines.pop()
    for (const raw0 of lines) {
      const raw = raw0.replace(/\r/g, '').trim()
      if (!raw) continue
      this._parseTelemetryLine(raw)
    }
  },

  _parseTelemetryLine(raw) {
    // T,方向,目标°,实际°,耗时ms  或  S,耗时ms,漂移°
    const parts = raw.split(',')
    const log = this.data.lapLog.slice()
    if (parts[0] === 'T' && parts.length >= 5) {
      log.push({
        kind: 'T', raw,
        dir: parts[1],
        target: parseFloat(parts[2]),
        actual: parseFloat(parts[3]),
        ms: parseInt(parts[4], 10)
      })
    } else if (parts[0] === 'S' && parts.length >= 3) {
      log.push({
        kind: 'S', raw,
        ms: parseInt(parts[1], 10),
        drift: parseFloat(parts[2])
      })
    } else {
      // 启动调试信息等, 忽略不入主日志
      console.log('[bt rx]', raw)
      return
    }
    this.setData({ lapLog: log })
  },

  // 发送多字节命令 (用于 'R'/'L' + 角度 这类 MPU 闭环命令)
  _bleSendBytes(bytes) {
    if (!this.data.bleConnected) return Promise.reject()
    const buf = new ArrayBuffer(bytes.length)
    const view = new DataView(buf)
    for (let i = 0; i < bytes.length; i++) view.setUint8(i, bytes[i] & 0xff)
    return new Promise((resolve, reject) => {
      wx.writeBLECharacteristicValue({
        deviceId: this.data.bleDeviceId,
        serviceId: this.data.bleServiceId,
        characteristicId: this.data.bleCharId,
        value: buf, success: resolve, fail: reject
      })
    })
  },

  onUnload() {
    if (this._raceTimer) { clearInterval(this._raceTimer); this._raceTimer = null }
    if (this._bleActionTimer) { clearTimeout(this._bleActionTimer); this._bleActionTimer = null }
    this._stopManualHeartbeat()
    this.setData({ lapRunning: false })
    if (this.data.bleConnected && this.data.bleDeviceId) {
      try { wx.closeBLEConnection({ deviceId: this.data.bleDeviceId }) } catch (e) {}
    }
    try { wx.closeBluetoothAdapter() } catch (e) {}
  }
})
