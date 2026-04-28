// Crayxus Labs · AI 课外项目实践 · Kickstarter 风格
const PROJECTS = [
  {
    key: 'guandan',
    cat: 'hw',
    image: '/assets/products/guandan.jpg',
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
      { icon: '💎', t: '未来营收分润权 1% + NFT 凭证', d: '量产销售期内 享有 10% 营收池按席分配（每席 1%）· 凭 NFT 凭证按年兑付' },
      { icon: '🎓', t: '浙大张教授线下分享会', d: '掼蛋 AI 首席科学家闭门讲座 · 1 次 / 季度' },
      { icon: '🏭', t: '工厂参访权', d: '量产线参观 · 见证自己那台机器从 PCB 到出厂' },
      { icon: '🪪', t: '创始赞助证书', d: '"Crayxus 掼蛋一体机 #001 创始赞助方" 限量 10 席' }
    ]
  },
  {
    key: 'racing',
    cat: 'hw',
    image: '/assets/products/racing.jpg',
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
      { icon: '💎', t: '未来营收分润权 1% + NFT 凭证', d: 'AI 赛车量产销售期内 享 1% 营收分润（凭 NFT 凭证按年兑付）' },
      { icon: '🎓', t: '同济车辆学院教授闭门课', d: '自动驾驶 + AI 私塾 5 节 · 孩子可参加' },
      { icon: '🎨', t: '车队涂装命名权', d: '车身印 LOGO / 名字 · 出现在所有比赛物料上' },
      { icon: '🪪', t: 'Crayxus 创始赞助方证书', d: '可作为孩子留学申请 / 履历亮点' }
    ]
  },
  {
    key: 'tank',
    cat: 'hw',
    image: '/assets/products/tank.jpg',
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
      { icon: '💎', t: '未来营收分润权 1.5% + NFT 凭证', d: '军用 / 文创 转化期内 享 1.5% 营收分润（按年兑付）' },
      { icon: '🏆', t: 'RoboMaster 现场观赛', d: '出差全包 · 国际机器人对抗赛 VIP 席位' },
      { icon: '🎓', t: '多智能体 AI 闭门课', d: '哈工大 / 国防科大 教授 10 节闭门讲座' },
      { icon: '🎁', t: '收藏级周边礼包', d: '金属模型 / 工程图册 / 战术沙盘 / 头盔' }
    ]
  },
  {
    key: 'sub',
    cat: 'hw',
    image: '/assets/products/sub.jpg',
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
      { icon: '💎', t: '未来营收分润权 2% + NFT 凭证', d: '海洋装备转化期内 享 2% 营收分润 + 第二批产品优先购买权' },
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
      { icon: '💎', t: '未来营收分润权 2% + NFT 凭证', d: 'AAAS 系统 SaaS 化期内 享 2% 营收分润（年营收预估 1000w+）按年兑付' },
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
      { icon: '💎', t: '未来营收分润权 2% + NFT 凭证', d: '系统对外 SaaS 化期内 享 2% 营收分润（按年兑付）' },
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
      { icon: '💎', t: '未来营收分润权 2% + NFT 凭证', d: 'SaaS 化对外授权期内 享 2% 营收分润 + 公益项目优先合作权' },
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
      { icon: '💎', t: '未来营收分润权 2% + NFT 凭证', d: '产品商业化期内 享 2% 营收分润 + 蛋力 token 创世期 10w 枚（项目内权益）' },
      { icon: '🪪', t: '国际高中升学 1v1', d: '浙大 + 复旦 + 海归 顾问团队 全程陪跑（ED/RD 时间表）' },
      { icon: '📝', t: '留学申请文书指导', d: 'PS / 简历 / 推荐信 全套定制 · 哈耶普斯麻级别' },
      { icon: '🌍', t: '海外名校提前接入', d: '澳洲 / 加拿大 / 英国 校友访问 + 内部说明会' },
      { icon: '🎁', t: '创始投资人证书', d: '系统启动页永久挂名 · 限量 8 席' }
    ]
  },
  {
    key: 'texas',
    cat: 'model',
    icon: '♠️',
    color: '#e91e63',
    name: '德州扑克大模型',
    short: 'GTO 求解 + 多智能体博弈',
    budget: 150,
    duration: 8,
    seats: 8,
    joined: 3,
    perSeat: 18.75,
    seatUnit: '万',
    tagline: 'Crayxus 自研德扑大模型 · 对标 Pluribus / Libratus · 击败业内顶级玩家',
    painpoint: '德州扑克是博弈论 + 不完美信息博弈的圣杯 — Pluribus / Libratus 是 Facebook AI 顶尖论文。中国此领域空白，能跑 GTO + 实战大模型的团队几乎没有。我们用已经在掼蛋 vs 国际冠军 69.5% 胜率的 V8 框架扩展到德扑：Push-fold 求解 + Counterfactual Regret + 实时偏离纠正。',
    tech: 'CFR+ 求解器 + 抽象化博弈 + 大语言模型策略推理（DeepSeek finetuned）+ 实时对手建模 + 对抗自博弈 RL',
    roles: [
      { r: '项目经理 (PM)', n: 1 },
      { r: 'CFR / 博弈论算法', n: 2 },
      { r: '强化学习', n: 2 },
      { r: '大模型微调', n: 1 },
      { r: '对战平台 + 后端', n: 2 }
    ],
    milestones: [
      { m: 'Push-fold 求解器', t: 'M1-M2' },
      { m: 'CFR+ 抽象化', t: 'M2-M4' },
      { m: '自博弈训练', t: 'M3-M6' },
      { m: '实战平台 + 论文', t: 'M6-M8' }
    ],
    spend: [
      { l: '人员工资', p: 50 },
      { l: 'GPU 算力 (大规模)', p: 30 },
      { l: 'API + 外部数据', p: 8 },
      { l: '论文 + 比赛', p: 7 },
      { l: '储备', p: 5 }
    ],
    benefits: [
      { icon: '♠️', t: 'AI 训练 1v1 模型对战', d: '24x7 AI 教练 · 业内顶级玩家级别 · 终身使用权' },
      { icon: '💎', t: '未来营收分润权 2% + NFT 凭证', d: 'API SaaS + B 端授权 + 比赛场景应用 期内 享 2% 营收分润' },
      { icon: '🌐', t: 'WSOP 海外锦标赛指导', d: '世界扑克巡回赛 · 高级玩法分析 · 顶级专家陪练' },
      { icon: '📚', t: '博弈论顶会论文署名', d: 'NeurIPS / IJCAI / AAMAS · 创始赞助方挂名' },
      { icon: '🎓', t: '浙大 + Stanford CS 联合', d: '博弈论 + RL 闭门课 6 节 · 海外远程导师' },
      { icon: '🪪', t: '限量 8 席创始证书', d: 'NFT 数字证书 + 实体银制纪念奖牌' }
    ]
  },
  {
    key: 'mahjong',
    cat: 'model',
    icon: '🀄',
    color: '#4caf50',
    name: '麻将大模型',
    short: '日麻 / 国标 / 川麻 全规则',
    budget: 120,
    duration: 6,
    seats: 8,
    joined: 4,
    perSeat: 15,
    seatUnit: '万',
    tagline: '对标微软 Suphx 超级人类 · 日麻 / 国标 / 川麻 / 广麻 全规则覆盖',
    painpoint: '麻将是亚洲国民运动但缺乏中国自主大模型 — 微软 Suphx 是日麻顶级 AI，国内麻将 AI 落后 2-3 年。Crayxus 用 V8 框架扩展，对接日麻天凤 / 雀魂 / 国内联众，目标做出 vs 日麻名人级别 60%+ 胜率的中国麻将大模型。',
    tech: 'Suphx-style 多任务 RL + Oracle Guidance + 围牌策略图谱 + 多版本规则适配 + 自博弈联赛',
    roles: [
      { r: '项目经理 (PM)', n: 1 },
      { r: '多任务 RL 算法', n: 2 },
      { r: '规则引擎 + 抽象', n: 2 },
      { r: '平台对接', n: 2 },
      { r: '数据 + 评估', n: 1 }
    ],
    milestones: [
      { m: '单规则原型 (国标)', t: 'M1-M2' },
      { m: 'Oracle Guidance 训练', t: 'M2-M4' },
      { m: '日麻 + 川麻 适配', t: 'M3-M5' },
      { m: '雀魂 / 天凤 段位冲刺', t: 'M5-M6' }
    ],
    spend: [
      { l: '人员工资', p: 55 },
      { l: 'GPU 算力', p: 25 },
      { l: '平台对接 + API', p: 10 },
      { l: '比赛 + 推广', p: 6 },
      { l: '储备', p: 4 }
    ],
    benefits: [
      { icon: '🀄', t: '专属麻将 AI 训练教练', d: '24x7 在线陪练 · 日麻 / 川麻 / 广麻 全部规则' },
      { icon: '🇯🇵', t: '日本天凤 / 雀魂 实战指导', d: '上号陪练 · 段位冲刺顾问 · 出国对战之旅' },
      { icon: '💎', t: '未来营收分润权 2% + NFT 凭证', d: 'API + 移动端授权 + 棋牌室合作 期内 享 2% 营收分润' },
      { icon: '🎓', t: '浙大 + 东京大学 AI 联合', d: '日本东京大学 AI 实验室远程导师 · 私塾 6 节' },
      { icon: '🏆', t: '中日麻将 AI 邀请赛', d: 'Crayxus 主办 · 创始赞助方贵宾席 · 出国机票包' },
      { icon: '🪪', t: '限量 8 席创始证书', d: 'NFT 数字证书 + 限量手工竹麻将 1 套' }
    ]
  },
  {
    key: 'shuangkou',
    cat: 'model',
    icon: '🎴',
    color: '#9c27b0',
    name: '双扣大模型',
    short: '浙江本土 · 与掼蛋同源 · 6 个月顶级',
    budget: 80,
    duration: 5,
    seats: 6,
    joined: 2,
    perSeat: 13.33,
    seatUnit: '万',
    tagline: '浙江最受欢迎的扑克游戏 · 5000 万牌友群体 · 复用 V8 框架 · 6 个月达到顶级水平',
    painpoint: '双扣（浙江温州 / 台州 / 宁波）至今没有任何级别的 AI · 浙江 5000w 牌友群体被互联网大厂忽略。Crayxus 团队是浙江本土，最懂双扣规则，用 V8 框架直接复用，6 个月可以做到 vs 顶级牌友 65%+ 胜率。',
    tech: 'V8 强化学习框架（716 维状态 + Numba JIT 加速）+ 双扣专属规则编码 + 浙江本土玩家数据 + 多版本（杭州 / 温州 / 台州各异）',
    roles: [
      { r: '项目经理 (PM)', n: 1 },
      { r: 'V8 框架移植', n: 1 },
      { r: '规则编码 + 评估', n: 1 },
      { r: '强化学习训练', n: 2 },
      { r: '小程序对战平台', n: 1 }
    ],
    milestones: [
      { m: 'V8 框架移植', t: 'M1' },
      { m: '多版本规则适配', t: 'M2' },
      { m: '自博弈训练', t: 'M2-M4' },
      { m: '对外开放对战', t: 'M4-M5' }
    ],
    spend: [
      { l: '人员工资', p: 55 },
      { l: 'GPU 算力 (V8 复用)', p: 18 },
      { l: '小程序开发', p: 12 },
      { l: '推广 + 浙江本地赛事', p: 10 },
      { l: '储备', p: 5 }
    ],
    benefits: [
      { icon: '🎴', t: '专属双扣 AI 教练', d: '24x7 陪练 · 杭州 / 温州 / 台州 全规则版本' },
      { icon: '🏆', t: '浙江省双扣赛事冠名', d: 'Crayxus AI × 浙江双扣联赛 创始赞助方' },
      { icon: '💎', t: '未来营收分润权 2.5% + NFT 凭证', d: 'AI 移动端 + B 端棋牌室授权 期内 享 2.5% 营收分润（浙江市场专享）' },
      { icon: '🎓', t: '浙大数学系 + AI 系联合', d: '双扣组合数学 / RL 私塾 6 节 · 子女可参加' },
      { icon: '🍵', t: '浙商私董会接入', d: 'Crayxus 浙江企业家高端社群 · 茶会 + 内部活动' },
      { icon: '🪪', t: '限量 6 席创始证书', d: '浙江非遗工艺纸牌 1 套 + 数字证书' }
    ]
  },
  {
    key: 'hydrogen',
    cat: 'hw',
    icon: '⚡',
    color: '#10b981',
    name: 'AI 氢能源生态',
    short: '制氢 / 储氢 / 加氢站 / 燃料电池 全链条 AI 调度',
    budget: 800,
    duration: 12,
    seats: 10,
    joined: 2,
    perSeat: 80,
    seatUnit: '万',
    tagline: '碳中和万亿赛道 · AI 调度全氢能链条 · 央企 / 政府能源局 / 长城/福田 商用车深度合作',
    painpoint: '中国氢能产业是 2030 碳中和的核心赛道（万亿规模），但产业链碎片化：制氢厂（电解水/绿氢/灰氢）、储氢（高压气态/液态/有机液体）、运氢（管道/槽车）、加氢站（70MPa/35MPa）、终端（燃料电池车/船/重卡）— 各环节信息孤岛，调度全靠 Excel 和电话。Crayxus 用 AI 把全链条数字化，做"氢能产业大脑"。',
    tech: 'AI 氢能调度大脑：能源 IoT 实时数据 + 多智能体协同（产销匹配）+ 碳排放追踪（区块链上链）+ 加氢站动态定价 + 燃料电池故障预测 · 已对接 3 个示范城市试点',
    roles: [
      { r: '项目经理 (PM)', n: 1 },
      { r: 'AI 算法 (调度优化)', n: 2 },
      { r: '能源工程师 (氢能)', n: 2 },
      { r: 'IoT + 嵌入式', n: 2 },
      { r: '后端 + 区块链', n: 2 },
      { r: '政策 + 政府关系', n: 1 }
    ],
    milestones: [
      { m: '示范城市试点 (3 城)', t: 'M1-M3' },
      { m: '加氢站动态定价上线', t: 'M3-M5' },
      { m: '碳排放区块链追踪', t: 'M5-M8' },
      { m: '商用车队燃料电池预测', t: 'M8-M10' },
      { m: '5 城规模化推广', t: 'M10-M12' }
    ],
    spend: [
      { l: 'IoT 硬件部署', p: 35 },
      { l: '人员工资', p: 30 },
      { l: 'AI 算力 + 区块链', p: 15 },
      { l: '示范城市补贴', p: 12 },
      { l: '储备', p: 8 }
    ],
    benefits: [
      { icon: '⚡', t: '氢能产业大脑 SaaS 终身席位', d: '可用于自有能源 / 物流 / 工业项目 · 终身使用' },
      { icon: '💎', t: '未来营收分润权 1.5% + NFT 凭证', d: '示范城市 SaaS 营收 + 加氢站调度费 期内 享 1.5% 分润' },
      { icon: '🏛️', t: '政府能源局深度对接', d: '国家能源局 / 工信部氢能司 / 各省能源主管 资源接入' },
      { icon: '🚚', t: '商用车合作伙伴', d: '长城蜂巢氢能 / 福田欧曼 / 三一重卡 燃料电池产业链合作' },
      { icon: '🎓', t: '浙大 + Tsinghua 能源学院联合', d: '能源 + AI 跨学科 私塾 12 节 · 子女可参加' },
      { icon: '🪪', t: '限量 10 席碳中和先锋证书', d: '区块链上链 NFT · 国家碳市场可流通的早期凭证' }
    ]
  }
]

function _statsOf(arr) {
  let budget = 0, seats = 0, joined = 0
  arr.forEach(p => { budget += p.budget; seats += p.seats; joined += p.joined })
  return { count: arr.length, budget, seats, joined, fillPct: seats ? Math.round(joined / seats * 100) : 0 }
}

Page({
  data: {
    statusBarHeight: 44,
    view: 'menu',          // 'menu' | 'hw' | 'model' | 'sw'
    activeProjects: [],
    activeTitle: '',
    activeIcon: '',
    activeColor: '',
    projects: PROJECTS,
    hwProjects: [],
    modelProjects: [],
    swProjects: [],
    hwStats: {},
    modelStats: {},
    swStats: {},
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
    const hw = PROJECTS.filter(p => p.cat === 'hw')
    const model = PROJECTS.filter(p => p.cat === 'model')
    const sw = PROJECTS.filter(p => p.cat === 'sw')
    let totalBudget = 0, totalSeats = 0, totalJoined = 0
    PROJECTS.forEach(p => {
      totalBudget += p.budget
      totalSeats += p.seats
      totalJoined += p.joined
    })
    this.setData({
      totalBudget,
      totalSeats,
      totalJoined,
      hwProjects: hw,
      modelProjects: model,
      swProjects: sw,
      hwStats: _statsOf(hw),
      modelStats: _statsOf(model),
      swStats: _statsOf(sw)
    })
  },

  enterCategory(e) {
    const cat = e.currentTarget.dataset.cat
    let projects, title, icon, color
    if (cat === 'hw') {
      projects = this.data.hwProjects; title = '软硬件综合'; icon = '🛠'; color = '#ff6b35'
    } else if (cat === 'model') {
      projects = this.data.modelProjects; title = 'AI 大模型开发'; icon = '🧠'; color = '#e91e63'
    } else if (cat === 'sw') {
      projects = this.data.swProjects; title = 'AAAS 项目'; icon = '💻'; color = '#7c4dff'
    } else { return }
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ view: cat, activeProjects: projects, activeTitle: title, activeIcon: icon, activeColor: color })
  },

  backToMenu() {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.setData({ view: 'menu' })
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
    // 如果在子板块，先回主菜单，再点一次才退出
    if (this.data.view !== 'menu') {
      this.backToMenu()
      return
    }
    wx.navigateBack({ delta: 1, fail: () => wx.reLaunch({ url: '/pages/landing/landing' }) })
  },

  onApply() {
    wx.showToast({ title: '🎯 已记录你的兴趣', icon: 'none', duration: 1800 })
    wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
  }
})
