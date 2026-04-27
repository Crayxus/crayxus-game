// Saxon Math Intermediate 4 — Grade 4 题库
// 基于教材实际目录 (120 Lessons + 12 Investigations, Stephen Hake)
//
// 6 维度对应 Saxon Strands:
//   computation     → Number & Operations (算术)
//   numberSense     → Number & Operations (位值/估算)
//   geometry        → Geometry
//   measurement     → Measurement
//   wordProblem     → Problem Solving / Algebra
//   fractionDecimal → Number & Operations (分数/小数)

const DIMS = [
  { key: 'computation',     name: '计算力', icon: '🔢', color: '#00d4aa' },
  { key: 'numberSense',     name: '数感',   icon: '🧠', color: '#00d4ff' },
  { key: 'geometry',        name: '几何',   icon: '📐', color: '#7c4dff' },
  { key: 'measurement',     name: '测量',   icon: '📏', color: '#ffd700' },
  { key: 'wordProblem',     name: '应用',   icon: '💡', color: '#ff9500' },
  { key: 'fractionDecimal', name: '分数',   icon: '➗', color: '#ff6b6b' },
]

// 20 题 · 每道都锚定 Saxon G4 真实 Lesson (节号来自教材目录)
const QUESTION_BANK = [
  // ---------- Computation ----------
  { id: 'q01', dim: 'computation', lesson: 'L1 Review of Addition', difficulty: 1,
    q: '347 + 285 = ?', options: ['522', '532', '622', '632'], answer: 3,
    solution: '个位 7+5=12 进1，十位 4+8+1=13 进1，百位 3+2+1=6。答案 632。' },
  { id: 'q02', dim: 'computation', lesson: 'L28 Multiplication Table', difficulty: 1,
    q: '8 × 7 = ?', options: ['48', '54', '56', '64'], answer: 2,
    solution: '乘法口诀: 8×7=56。' },
  { id: 'q03', dim: 'computation', lesson: 'L65 Division with Two-Digit Answers', difficulty: 2,
    q: '96 ÷ 4 = ?', options: ['22', '23', '24', '25'], answer: 2,
    solution: '96 = 80 + 16，80÷4=20，16÷4=4，合计 24。' },
  { id: 'q04', dim: 'computation', lesson: 'L6 Review of Subtraction', difficulty: 2, second: 'numberSense',
    q: '1000 − 347 = ?', options: ['653', '663', '753', '657'], answer: 0,
    solution: '借位减法 (Saxon L41 Subtracting Across Zero)。1000−347=653。' },

  // ---------- Number Sense ----------
  { id: 'q05', dim: 'numberSense', lesson: 'L4 Place Value', difficulty: 1,
    q: '在 45,321 中数字 5 代表多少？', options: ['5', '50', '500', '5,000'], answer: 3,
    solution: '5 位于千位 (thousands place)，代表 5,000。' },
  { id: 'q06', dim: 'numberSense', lesson: 'L20 Rounding', difficulty: 1,
    q: '把 486 四舍五入到最近的百位', options: ['400', '480', '500', '490'], answer: 2,
    solution: '十位 8 ≥ 5，进位到百位：500。' },
  { id: 'q07', dim: 'numberSense', lesson: 'L56 Comparing Fractions', difficulty: 2, second: 'fractionDecimal',
    q: '哪个更大？ 3/4 还是 2/3 ?', options: ['3/4', '2/3', '相等', '无法比较'], answer: 0,
    solution: '通分 9/12 vs 8/12，所以 3/4 > 2/3。' },

  // ---------- Geometry ----------
  { id: 'q08', dim: 'geometry', lesson: 'Inv2 Units of Length & Perimeter', difficulty: 2, second: 'measurement',
    q: '一个长方形长 8 cm、宽 5 cm，周长是多少？', options: ['13 cm', '26 cm', '40 cm', '18 cm'], answer: 1,
    solution: '周长 = 2×(长+宽) = 2×(8+5) = 26 cm。' },
  { id: 'q09', dim: 'geometry', lesson: 'L63 Polygons', difficulty: 1,
    q: '六边形 (hexagon) 有几条边？', options: ['5', '6', '7', '8'], answer: 1,
    solution: 'Hexa = 6，六边形有 6 条边和 6 个顶点。' },
  { id: 'q10', dim: 'geometry', lesson: 'Inv3 Area', difficulty: 2, second: 'computation',
    q: '长方形 6×4 的面积是多少？', options: ['10', '20', '24', '28'], answer: 2,
    solution: '面积 = 长 × 宽 = 6×4 = 24 平方单位。' },

  // ---------- Measurement ----------
  { id: 'q11', dim: 'measurement', lesson: 'L39 Reading an Inch Scale', difficulty: 1,
    q: '2 英尺 (feet) 等于多少英寸 (inches)？', options: ['12', '18', '24', '36'], answer: 2,
    solution: '1 ft = 12 in，2 ft = 24 in。' },
  { id: 'q12', dim: 'measurement', lesson: 'L40 Capacity', difficulty: 2,
    q: '一瓶水 2 升 (liters)，等于多少毫升 (mL)？', options: ['200', '20', '2000', '20000'], answer: 2,
    solution: '1 L = 1000 mL，2 L = 2000 mL。' },
  { id: 'q13', dim: 'measurement', lesson: 'L19 Elapsed Time Problems', difficulty: 1, second: 'wordProblem',
    q: '时钟显示 3:45，距离 4:00 还有多少分钟？', options: ['5', '10', '15', '20'], answer: 2,
    solution: '60 − 45 = 15 分钟。' },

  // ---------- Word Problem ----------
  { id: 'q14', dim: 'wordProblem', lesson: 'L70 Word Problems About a Fraction of a Group', difficulty: 2, second: 'fractionDecimal',
    q: 'Sara 有 24 张贴纸，把 1/3 送给朋友，还剩多少张？', options: ['8', '12', '16', '18'], answer: 2,
    solution: '送出 24 ÷ 3 = 8，剩 24 − 8 = 16 张。' },
  { id: 'q15', dim: 'wordProblem', lesson: 'L49 Word Problems About Equal Groups', difficulty: 2, second: 'computation',
    q: '烘焙师烤 8 盘饼干，每盘 12 块，一共多少块？', options: ['20', '84', '96', '108'], answer: 2,
    solution: 'Equal groups: 8 × 12 = 96 块。' },
  { id: 'q16', dim: 'wordProblem', lesson: 'L57 Rate Word Problems', difficulty: 3, second: 'computation',
    q: 'Tom 每天走 3 km，两周一共走多少 km？', options: ['21', '28', '42', '56'], answer: 2,
    solution: '两周 = 14 天，rate × time = 3 × 14 = 42 km。' },
  { id: 'q17', dim: 'wordProblem', lesson: 'L88 Remainders in Word Problems', difficulty: 3, second: 'computation',
    q: '铅笔 2 元一支，你有 15 元，最多买几支？', options: ['6', '7', '8', '15'], answer: 1,
    solution: '15 ÷ 2 = 7 余 1，最多买 7 支。' },

  // ---------- Fraction / Decimal ----------
  { id: 'q18', dim: 'fractionDecimal', lesson: 'L107 Adding & Subtracting Fractions (Common Denom)', difficulty: 2,
    q: '1/2 + 1/4 = ?', options: ['1/6', '2/6', '3/4', '1'], answer: 2,
    solution: '通分 1/2 = 2/4，所以 2/4 + 1/4 = 3/4。' },
  { id: 'q19', dim: 'fractionDecimal', lesson: 'L109 Equivalent Fractions', difficulty: 1,
    q: '哪个分数和 2/4 相等？', options: ['1/2', '1/3', '2/3', '3/4'], answer: 0,
    solution: '2/4 约分 (÷2/÷2) = 1/2，属于等值分数。' },
  { id: 'q20', dim: 'fractionDecimal', lesson: 'Inv4B Relating Fractions and Decimals', difficulty: 2, second: 'numberSense',
    q: '小数 0.5 等于哪个分数？', options: ['1/5', '1/2', '2/10', '1/4'], answer: 1,
    solution: '0.5 = 5/10 = 1/2 (约分)。' },
]

// 自适应训练: 根据薄弱维度从题库中选题
function pickAdaptive(masteryMap, count = 10) {
  const scored = QUESTION_BANK.map(q => {
    const mastery = masteryMap[q.dim] != null ? masteryMap[q.dim] : 50
    const secondBoost = q.second && masteryMap[q.second] != null ? (60 - masteryMap[q.second]) * 0.3 : 0
    const weight = (100 - mastery) + secondBoost + Math.random() * 5
    return { q, weight: Math.max(1, weight) }
  })
  scored.sort((a, b) => b.weight - a.weight)
  return scored.slice(0, count).map(s => s.q)
}

module.exports = { DIMS, QUESTION_BANK, pickAdaptive }
