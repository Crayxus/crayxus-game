// Crayxus Labs · AI 课外项目实践 · Kickstarter 风格
const PROJECTS = [
  {
    key: 'guandan',
    cat: 'hw',
    icon: '🃏',
    color: '#ff6b35',
    name: '掼蛋 AI 一体机',
    short: '世界冠军级 AI · 实体对战',
    budget: 100,
    duration: 6,
    seats: 10,
    joined: 7,
    tagline: '把全球第一的掼蛋 AI 装进一台一体机 · 老人也能在家陪 AI 打牌',
    painpoint: '掼蛋是江浙沪国民运动，但水平差距大、找不到对手是日常。我们的 AI 是真实击败 DeepSeek V3 / 通义千问 / 智谱 GLM 全胜的世界冠军级模型（vs 国际冠军 V8 模型 69.5% 胜率），训练成本 320 小时 GPU。把它装进一台带 13.3" 屏 + 自定义键盘的一体机，老人在家就能和"网易掼蛋大神"打。',
    tech: 'V8 强化学习模型（716 维状态编码 + Target Network + Numba JIT 加速）+ 实体桌面 PCB + 13.3 寸高刷屏 + 自定义紧凑键盘 + 联动语音播报 · 一台机器 = 4 个真人对手',
    roles: [
      { r: '项目经理 (PM)', n: 1 },
      { r: 'AI 算法工程师', n: 3 },
      { r: '硬件 / PCB 工程师', n: 3 },
      { r: '嵌入式 / 全栈', n: 2 },
      { r: 'UI / 交互设计', n: 1 }
    ],
    milestones: [
      { m: '原型机出样', t: 'M1-M2' },
      { m: 'AI 模型移植到本地推理', t: 'M2-M3' },
      { m: '量产工艺打通', t: 'M4-M5' },
      { m: '首批 100 台 + 用户内测', t: 'M5-M6' }
    ],
    spend: [
      { l: '硬件与开模', p: 35 },
      { l: '人员工资', p: 40 },
      { l: 'AI 训练算力', p: 12 },
      { l: '认证 + 量产', p: 10 },
      { l: '储备', p: 3 }
    ],
    perSeat: 10,
    seatUnit: '万',
    perSeat: 10,
    seatUnit: '万',
    benefits: [
      { icon: '🃏', t: '一台专属编号一体机', d: '独家版 · 背板烙刻您的姓名 / 命名权 · 终身固件升级' },
      { icon: '👨‍👩‍👧', t: '全家陪 AI 打掼蛋', d: '4 人对战位 · AI 教练 1v1 教孩子 / 老人' },
      { icon: '💎', t: '产品上市后股权 1%', d: '产品 IPO / 被收购时 创始赞助方共享 10% 股权池（每席 1%）' },
      { icon: '🎓', t: '浙大张教授线下分享会', d: '掼蛋 AI 首席科学家闭门讲座 · 1 次 / 季度' },
      { icon: '🏭', t: '工厂参访权', d: '量产线参观 · 见证自己那台机器从 PCB 到出厂' },
      { icon: '🪪', t: '创始赞助证书', d: '"Crayxus 掼蛋一体机 #001 创始赞助方" 限量 10 席' }
    ]
  },
  {
    key: 'racing',
    cat: 'hw',
    icon: '🏎️',
    color: '#00d2ff',
    name: 'AI 赛车 · 自动驾驶',
    short: '1:8 等比 · 自学习赛道',
    budget: 200,
    duration: 8,
    seats: 10,
    joined: 4,
    tagline: '1:8 等比模型车 · 摄像头 + LiDAR + 强化学习 · 学生主导端到端自动驾驶',
    painpoint: '学生想做自动驾驶但拿不到真车，仿真环境又不真实。我们做 1:8 等比电动 RC 车，搭载一组真实的传感器（双目相机 + 64 线 LiDAR mini + IMU），让学生在校园场地训练强化学习模型，做出**能在校园里自主跑赛道**的真实自动驾驶车。',
    tech: 'Jetson Orin Nano + 双目立体视觉 + 64 线 LiDAR + IMU 9 轴 + 端到端策略网络（CARLA 仿真 → 真车迁移）+ 校园 GPS 高精度地图',
    roles: [
      { r: '项目经理 (PM)', n: 1 },
      { r: '感知算法 (CV)', n: 2 },
      { r: '决策算法 (RL)', n: 2 },
      { r: '硬件集成', n: 2 },
      { r: '机械结构', n: 2 },
      { r: '仿真环境', n: 1 }
    ],
    milestones: [
      { m: '车架 + 电控搭建', t: 'M1-M2' },
      { m: '感知 stack 联调', t: 'M2-M4' },
      { m: '仿真训练 RL', t: 'M3-M6' },
      { m: '真车迁移 + 校园路测', t: 'M6-M8' }
    ],
    spend: [
      { l: '硬件 (车 + 传感器)', p: 45 },
      { l: '人员工资', p: 35 },
      { l: '算力 (Jetson + 服务器)', p: 12 },
      { l: '场地 + 标定', p: 5 },
      { l: '储备', p: 3 }
    ],
    perSeat: 20,
    seatUnit: '万',
    benefits: [
      { icon: '🏎️', t: '专属 1:8 自动驾驶赛车', d: '涂装 + 命名权 · 编号 #001-#010 · 永久固件升级' },
      { icon: '🏁', t: '校园场地试驾日', d: '亲自上手开自动驾驶车 · 全家可参与' },
      { icon: '💎', t: '产品上市后股权 1%', d: 'AI 赛车量产销售时 每席享 1% 股权 / 销售分润' },
      { icon: '🎓', t: '同济车辆学院教授闭门课', d: '自动驾驶 + AI 私塾 5 节 · 孩子可参加' },
      { icon: '🎨', t: '车队涂装命名权', d: '车身印 LOGO / 名字 · 出现在所有比赛物料上' },
      { icon: '🪪', t: 'Crayxus 创始赞助方证书', d: '可作为孩子留学申请 / 履历亮点' }
    ]
  },
  {
    key: 'tank',
    cat: 'hw',
    icon: '🛡️',
    color: '#ffb84d',
    name: 'AI 坦克 · 战术对抗',
    short: '集群对抗 · 多智能体协同',
    budget: 500,
    duration: 10,
    seats: 10,
    joined: 2,
    tagline: '5 v 5 实体坦克对抗 · 多智能体协同 · 红外激光对抗系统 + 战术决策 AI',
    painpoint: '机器人对抗赛缺乏真正"集群智能"对抗的项目 — RoboMaster 单兵作战为主。我们做 5 v 5 履带式坦克，配红外激光对抗 + 实体装甲检测板，研究**多智能体协同**：包夹 / 诱敌 / 阵型变换 / 资源博弈。这是博士论文级的项目，学生发顶会 paper 的好载体。',
    tech: '履带底盘（双电机闭环）+ 云台稳定（陀螺仪 + PID）+ 红外发射 + 装甲检测 + 多智能体强化学习 (MAPPO) + ROS2 集群通信 + 战场 SLAM',
    roles: [
      { r: '项目经理 (PM)', n: 1 },
      { r: '多智能体算法', n: 2 },
      { r: '机械工程师', n: 3 },
      { r: '电控工程师', n: 2 },
      { r: 'SLAM / 定位', n: 1 },
      { r: '上位机 (战场 UI)', n: 1 }
    ],
    milestones: [
      { m: '单车原型 + 红外对抗', t: 'M1-M3' },
      { m: '5 车量产 + ROS2 集群', t: 'M3-M5' },
      { m: 'MAPPO 训练 + 仿真', t: 'M4-M7' },
      { m: '5v5 实战 + 论文撰写', t: 'M7-M10' }
    ],
    spend: [
      { l: '硬件 (10 辆坦克)', p: 40 },
      { l: '人员工资', p: 35 },
      { l: '算力 + 服务器', p: 12 },
      { l: '论文 + 比赛报名', p: 8 },
      { l: '储备', p: 5 }
    ],
    perSeat: 50,
    seatUnit: '万',
    benefits: [
      { icon: '🛡️', t: '专属编号 1:5 履带坦克', d: '战旗 + 涂装 + 编号 全自定义 · 收藏级实物' },
      { icon: '⚔️', t: '5v5 实战日参与', d: '您的坦克进入正式对抗赛 · 全家旁观' },
      { icon: '💎', t: '产品上市后股权 1.5%', d: '军用 / 文创 转化时 每席享 1.5% 股权池' },
      { icon: '🏆', t: 'RoboMaster 现场观赛', d: '出差全包 · 国际机器人对抗赛 VIP 席位' },
      { icon: '🎓', t: '多智能体 AI 闭门课', d: '哈工大 / 国防科大 教授 10 节闭门讲座' },
      { icon: '🎁', t: '收藏级周边礼包', d: '金属模型 / 工程图册 / 战术沙盘 / 头盔' }
    ]
  },
  {
    key: 'sub',
    cat: 'hw',
    icon: '🌊',
    color: '#5b6cff',
    name: 'AI 潜水艇 · 水下探测',
    short: '自主导航 · 水下声呐 + 视觉',
    budget: 1000,
    duration: 12,
    seats: 10,
    joined: 1,
    tagline: '50m 级 AUV 潜水艇 · 水下声呐 + 视觉融合 · AI 自主搜寻沉没物 / 水质监测',
    painpoint: '中国学生在水下机器人这个赛道 90% 玩的是 ROV（有缆遥控），AUV（无缆自主）项目极少。50m 级 AUV 是比赛、海洋监测、考古的真正生产工具。我们做学生 fully-owned 的 AUV，导航靠惯导 + 多波束声呐，目标识别靠水下视觉模型。最终参加国际 RoboSub / SAUVC 比赛拿名次。',
    tech: '耐压壳体 (铝合金 5052) + 惯导 INS + 多波束声呐 + 水下高清 + 多旋翼推进器 × 6 + Jetson Orin + 自训水下 YOLO + Kalman 融合定位',
    roles: [
      { r: '项目经理 (PM)', n: 1 },
      { r: '机械结构 + 耐压', n: 2 },
      { r: '电气 + 推进控制', n: 2 },
      { r: '声呐 / 水下感知', n: 2 },
      { r: 'AI 视觉算法', n: 2 },
      { r: '导航 + SLAM', n: 1 }
    ],
    milestones: [
      { m: '耐压壳测试 (50m)', t: 'M1-M3' },
      { m: '推进 + 姿态控制', t: 'M2-M5' },
      { m: '感知融合', t: 'M4-M8' },
      { m: '湖试 + 海试', t: 'M8-M11' },
      { m: '国际比赛参赛', t: 'M11-M12' }
    ],
    spend: [
      { l: '硬件 (耐压 + 声呐)', p: 50 },
      { l: '人员工资', p: 25 },
      { l: '湖海试 + 物流', p: 12 },
      { l: '比赛 + 出国', p: 8 },
      { l: '储备', p: 5 }
    ],
    perSeat: 100,
    seatUnit: '万',
    benefits: [
      { icon: '🌊', t: '1:5 缩比 AUV 命名权', d: '您命名的潜艇编入 Crayxus 海洋舰队 · 永久铭牌' },
      { icon: '🇸🇬 / 🇺🇸', t: '国际比赛随行 VIP', d: 'SAUVC 新加坡 + RoboSub 圣地亚哥 全程出国包机食宿' },
      { icon: '💎', t: '产品上市后股权 2%', d: '海洋装备 / 国防转化时 每席享 2% 股权 + 优先认购权' },
      { icon: '🎬', t: '项目纪录片署名', d: 'BBC 级深海项目纪录片 · 您是赞助方 / 出品人之一' },
      { icon: '🌍', t: '海洋科考随行', d: '杭州千岛湖湖试 + 三亚海试 全程参与' },
      { icon: '🎓', t: '哈工程 / 上交大教授闭门会', d: '深海装备 + AI 私塾 12 节 · 顶级海工资源对接' }
    ]
  },
  {
    key: 'fashion',
    cat: 'sw',
    icon: '👔',
    color: '#c1121c',
    name: 'AI 服装产业大脑',
    short: '法良时装 AAAS · 5 智能体',
    budget: 80,
    duration: 4,
    seats: 6,
    joined: 5,
    tagline: '为高端代工厂打造的 AAAS · 已与法良时装（26 个国际品牌）落地',
    painpoint: '中国服装代工厂年均流转 1000+ 款，每款几十种辅料，靠人脑跟单。ERP 上线两年推不动，前端采购就是不愿用。我们做 5 个智能体（采购跟单 / 物料标准化 / 供应商评估 / 翻译 / 编码）让 AI 替代繁琐手填，**从订单流转、物料编码到供应商打分全自动化**。',
    tech: 'DeepSeek V4 + 21 年法良物料库 + 26 个品牌历史 BOM + 自训垂域模型 + ERP API 对接 + 微信小程序前端',
    roles: [
      { r: '项目经理 (PM)', n: 1 },
      { r: 'AI 算法 (NLP)', n: 2 },
      { r: '后端 (ERP 对接)', n: 1 },
      { r: '小程序前端', n: 1 },
      { r: '业务调研 + 标注', n: 1 }
    ],
    milestones: [
      { m: '物料标准化大脑', t: 'M1' },
      { m: '采购 AI 跟单官', t: 'M2' },
      { m: '供应商评估官', t: 'M3' },
      { m: '翻译 + 编码 + 上线', t: 'M4' }
    ],
    spend: [
      { l: '人员工资', p: 60 },
      { l: 'API 调用 (DeepSeek)', p: 15 },
      { l: '服务器 + 数据', p: 12 },
      { l: '现场实施', p: 8 },
      { l: '储备', p: 5 }
    ],
    perSeat: 13.3,
    seatUnit: '万',
    benefits: [
      { icon: '👔', t: '26 个国际品牌内购权', d: 'KARL LAGERFELD / BOSIDENG / NOBIS / Blauer USA 等 终身 50% off' },
      { icon: '🏭', t: '法良工厂 + 工作室参访', d: '上海宝山总部 + 6 个智能工厂 私人导览' },
      { icon: '💎', t: '产品上市后股权 2%', d: 'AAAS 系统 SaaS 化时 每席享 2% 股权（年营收预估 1000w+）' },
      { icon: '🌍', t: '欧洲品牌总部访问', d: '荷兰 KING LOUIE / 德国 WELLENSTEYN 总部行程 全包' },
      { icon: '🎁', t: '法良 × Crayxus 限量联名款', d: '棉羽 / 冲锋衣 创始版 1 套 (市场价 ~¥8000)' },
      { icon: '🎓', t: '东华纺织教授闭门课', d: '纺织 + AI 跨学科 私塾 8 节 · 含子女学习名额' }
    ]
  },
  {
    key: 'material',
    cat: 'sw',
    icon: '🧬',
    color: '#7c4dff',
    name: 'AI 材料编码大脑',
    short: '上千种物料 · 8 位标准编码',
    budget: 50,
    duration: 3,
    seats: 5,
    joined: 3,
    tagline: '一键生成全行业通用 8 位物料编码 · 拉链/钮扣/棉羽/绣标全覆盖',
    painpoint: '服装、电子、汽车、家具等行业物料编码混乱：拉链 A 厂叫 "YKK 5# 黑"、B 厂叫 "5号YKK黑色"、C 厂又叫 "Vislon 黑"，ERP 入库重复浪费仓位。我们用 AI 学习行业共性 → 输出 8 位标准编码（如 YK-5C-OH-PL），任何描述粘进来 → 秒出编码 + 结构化字段。',
    tech: 'DeepSeek + 行业字典 + 编码规则引擎 + 描述归一化模型 + ERP / SAP 对接 SDK',
    roles: [
      { r: '项目经理 (PM)', n: 1 },
      { r: 'AI 算法 (规则 + LLM)', n: 2 },
      { r: '后端 + ERP 集成', n: 1 },
      { r: '行业调研', n: 1 }
    ],
    milestones: [
      { m: '编码规则建模', t: 'M1' },
      { m: 'AI 描述归一化', t: 'M2' },
      { m: 'ERP/SAP 对接 + 上线', t: 'M3' }
    ],
    spend: [
      { l: '人员工资', p: 55 },
      { l: 'API + 算力', p: 18 },
      { l: '行业数据', p: 15 },
      { l: '储备', p: 12 }
    ],
    perSeat: 10,
    seatUnit: '万',
    benefits: [
      { icon: '🧬', t: '编码 SaaS 终身授权', d: '可用于自家或自有公司 ERP 接入 · 终身免费' },
      { icon: '💎', t: '产品上市后股权 2%', d: '系统对外 SaaS 化后 每席享 2% 股权 + 营收分润' },
      { icon: '🏭', t: '跨行业工厂参访', d: '服装 / 电子 / 汽车 / 家具 4 大行业 标杆工厂走访' },
      { icon: '🤝', t: 'CTO 朋友圈接入', d: 'Crayxus 行业 CTO 私董会 · 内部资源对接' },
      { icon: '📜', t: '编码方法专利赞助方署名', d: '专利证书上印创始赞助方姓名 / 公司' }
    ]
  },
  {
    key: 'tripitaka',
    cat: 'sw',
    icon: '🪷',
    color: '#00d4aa',
    name: 'AI 大藏经智库',
    short: '2 万卷 · 1.4 亿字 · 千年活智慧',
    budget: 60,
    duration: 4,
    seats: 6,
    joined: 4,
    tagline: '让千年佛经成为手机里随时请教的善知识 · "慧明法师"AI 化身',
    painpoint: '《大藏经》2 万卷 1.4 亿字，文言艰深，普通人翻开就劝退；学术研究找原文要翻 CBETA 半天；寺院弘法对外语弱。我们做"慧明法师"AI 化身，用大模型理解经文 → 任何白话提问 → 给出经典原文 + 古德注疏 + 现代义解三重应答。',
    tech: '豆包 + 自训垂域佛学模型 + RAG（1.4 亿字向量检索）+ 知识图谱（人物/法相/宗派/法脉）+ TTS（梵呗诵读）',
    roles: [
      { r: '项目经理 (PM)', n: 1 },
      { r: 'NLP + RAG', n: 2 },
      { r: '后端 + 数据', n: 1 },
      { r: '前端 (Web + 小程序)', n: 1 },
      { r: '佛学顾问 (合作高校)', n: 1 }
    ],
    milestones: [
      { m: '大藏经入库 + RAG', t: 'M1' },
      { m: '解经 + 问答', t: 'M2' },
      { m: '诵读 TTS', t: 'M3' },
      { m: '上线 + 寺院合作', t: 'M4' }
    ],
    spend: [
      { l: '人员工资', p: 55 },
      { l: 'API + 向量库', p: 20 },
      { l: '佛学数据授权', p: 15 },
      { l: '储备', p: 10 }
    ],
    perSeat: 10,
    seatUnit: '万',
    benefits: [
      { icon: '🪷', t: '慧明 AI 法师终身 VIP', d: '不限次数问答 · 个人冠名经文专集（永久 TTS 朗读）' },
      { icon: '🛕', t: '寺院深度参访', d: '灵隐寺 / 龙泉寺 / 灵山书院 私人禅修体验' },
      { icon: '💎', t: '产品上市后股权 2%', d: 'SaaS 化对外授权后 每席享 2% 股权 + 公益项目优先权' },
      { icon: '📿', t: '限量法物礼包', d: '高僧加持手抄经 + 限量念珠 + 抄经册' },
      { icon: '🎓', t: '复旦哲学学院教授闭门讲', d: '宗教学 / 中国哲学 私塾 6 节' },
      { icon: '🌏', t: '国际弘法之旅', d: '台湾 / 新马泰 / 北美华人寺院 走访机会' }
    ]
  },
  {
    key: 'scoreboost',
    cat: 'sw',
    icon: '🎓',
    color: '#ffd700',
    name: 'AI 提分系统 · ScoreBoost',
    short: 'IELTS/TOEFL/AP/A-Level/SAT · Twin Drive',
    budget: 120,
    duration: 999,
    seats: 8,
    joined: 8,
    tagline: '面向国际高中生 · 匹配度 + 提分双引擎 · 已运营 · 持续招新',
    painpoint: '国际高中学生备考 6 套体系（IELTS/TOEFL/AP/A-Level/SAT/Basis），传统机构按时间收费，学生买课没动力坚持。我们用 Twin Drive 模型：先 AI 测匹配度（动机/时间/自驱）→ 再针对薄弱维度自适应出题 → 进步可视化。已上线，60 节课 300 题持续运营。',
    tech: 'DeepSeek V4 实时出题 + Azure Neural TTS + 自适应 RL 推荐引擎 + 蛋力 token 经济 + 蛋力盲盒 + 段位认证',
    roles: [
      { r: '产品经理', n: 1 },
      { r: 'AI 算法 (出题 + 评估)', n: 2 },
      { r: '后端 + 题库', n: 1 },
      { r: '小程序前端', n: 2 },
      { r: '内容 (题库审核)', n: 1 },
      { r: '运营 + 增长', n: 1 }
    ],
    milestones: [
      { m: '6 体系题库 (持续)', t: 'ongoing' },
      { m: '段位认证体系', t: 'Q1' },
      { m: '家长端 + 老师端', t: 'Q2' },
      { m: '海外推广', t: 'Q3-Q4' }
    ],
    spend: [
      { l: '人员工资', p: 50 },
      { l: 'API (DeepSeek + Azure)', p: 22 },
      { l: '内容生产', p: 15 },
      { l: '增长 + 推广', p: 10 },
      { l: '储备', p: 3 }
    ],
    perSeat: 15,
    seatUnit: '万',
    benefits: [
      { icon: '🎓', t: '全家终身免费用 ScoreBoost', d: '6 体系（IELTS/TOEFL/AP/A-Level/SAT/Basis）2-3 个孩子全包' },
      { icon: '💎', t: '产品上市后股权 2%', d: 'IPO / 收购时 每席享 2% 股权 + 蛋力 token 创世期 10w 枚' },
      { icon: '🪪', t: '国际高中升学 1v1', d: '浙大 + 复旦 + 海归 顾问团队 全程陪跑（ED/RD 时间表）' },
      { icon: '📝', t: '留学申请文书指导', d: 'PS / 简历 / 推荐信 全套定制 · 哈耶普斯麻级别' },
      { icon: '🌍', t: '海外名校提前接入', d: '澳洲 / 加拿大 / 英国 校友访问 + 内部说明会' },
      { icon: '🎁', t: '创始投资人证书', d: '系统启动页永久挂名 · 限量 8 席' }
    ]
  }
]

Page({
  data: {
    statusBarHeight: 44,
    filter: 'all',
    projects: PROJECTS,
    filtered: PROJECTS,
    detailOpen: false,
    currentProject: null,
    totalBudget: 0,
    totalSeats: 0,
    totalJoined: 0
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch(e) {}
    let totalBudget = 0, totalSeats = 0, totalJoined = 0
    PROJECTS.forEach(p => {
      totalBudget += p.budget
      totalSeats += p.seats
      totalJoined += p.joined
    })
    this.setData({ totalBudget, totalSeats, totalJoined })
  },

  setFilter(e) {
    const f = e.currentTarget.dataset.f
    const filtered = f === 'all' ? PROJECTS : PROJECTS.filter(p => p.cat === f)
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ filter: f, filtered })
  },

  openDetail(e) {
    const key = e.currentTarget.dataset.key
    const p = PROJECTS.find(x => x.key === key)
    if (!p) return
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    // 计算进度百分比
    const progress = Math.round((p.joined / p.seats) * 100)
    this.setData({ detailOpen: true, currentProject: { ...p, progress } })
  },

  closeDetail() {
    this.setData({ detailOpen: false })
  },

  _noop() {},

  goBack() {
    wx.navigateBack({ delta: 1, fail: () => wx.reLaunch({ url: '/pages/landing/landing' }) })
  },

  onApply() {
    wx.showToast({ title: '🎯 已记录你的兴趣', icon: 'none', duration: 1800 })
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
  }
})
