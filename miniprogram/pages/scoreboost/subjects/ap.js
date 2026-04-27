// AP (Advanced Placement) · 6 学科 × 20 题种子
const DIMS = [
  { key: 'calculus',   name: '微积分', icon: '∫',  color: '#00d4aa' },
  { key: 'statistics', name: '统计',   icon: '📊', color: '#00d4ff' },
  { key: 'physicsC',   name: '物理C',  icon: '⚛',  color: '#7c4dff' },
  { key: 'chemistry',  name: '化学',   icon: '🧪', color: '#ffd700' },
  { key: 'biology',    name: '生物',   icon: '🧬', color: '#ff9500' },
  { key: 'economics',  name: '经济',   icon: '💹', color: '#ff6b6b' },
]

const QUESTION_BANK = [
  // AP Calculus AB/BC
  { id: 'q01', dim: 'calculus', lesson: 'AB · Limits', difficulty: 2,
    q: 'lim(x→2) (x²−4)/(x−2) = ?',
    options: ['0', '2', '4', 'DNE'], answer: 2,
    solution: '因式分解 (x−2)(x+2)/(x−2) = x+2，代入 x=2 得 4。' },
  { id: 'q02', dim: 'calculus', lesson: 'AB · Derivatives', difficulty: 2,
    q: 'd/dx [x³ + sin(x)] = ?',
    options: ['3x² + cos(x)', '3x² − cos(x)', 'x² + cos(x)', '3x² + sin(x)'], answer: 0,
    solution: '幂法则 + sin 导数为 cos。' },
  { id: 'q03', dim: 'calculus', lesson: 'BC · Series', difficulty: 3,
    q: 'Taylor series of eˣ at x=0 starts with:',
    options: ['1+x+x²/2+x³/6+...', '1−x+x²−...', 'x+x²+x³+...', '1+x²+x⁴+...'], answer: 0,
    solution: 'Maclaurin: eˣ = Σ xⁿ/n!' },

  // AP Statistics
  { id: 'q04', dim: 'statistics', lesson: 'Descriptive', difficulty: 1,
    q: 'Best measure of CENTER for a skewed distribution:',
    options: ['Mean', 'Median', 'Mode', 'Range'], answer: 1,
    solution: '偏态分布下中位数更稳健，均值会被极值拉偏。' },
  { id: 'q05', dim: 'statistics', lesson: 'Inference', difficulty: 3,
    q: 'A p-value of 0.03 at α=0.05 means:',
    options: ['Accept H₀', 'Reject H₀', 'Test inconclusive', 'Error rate 3%'], answer: 1,
    solution: 'p < α → 拒绝原假设（0.03 < 0.05）。' },
  { id: 'q06', dim: 'statistics', lesson: 'Probability', difficulty: 2,
    q: 'P(A) = 0.5, P(B) = 0.4, A & B independent. P(A ∩ B) = ?',
    options: ['0.9', '0.1', '0.2', '0.4'], answer: 2,
    solution: '独立事件：P(A∩B) = P(A) × P(B) = 0.5 × 0.4 = 0.2。' },

  // AP Physics C
  { id: 'q07', dim: 'physicsC', lesson: 'Mechanics · Kinematics', difficulty: 2,
    q: 'Object dropped from rest. Velocity after 3s (g=10 m/s²)?',
    options: ['10 m/s', '20 m/s', '30 m/s', '45 m/s'], answer: 2,
    solution: 'v = gt = 10 × 3 = 30 m/s。' },
  { id: 'q08', dim: 'physicsC', lesson: 'E&M · Gauss', difficulty: 3,
    q: 'Electric flux through closed surface enclosing charge Q:',
    options: ['Q', 'Q/ε₀', 'ε₀Q', 'Q·ε₀'], answer: 1,
    solution: '高斯定律：Φ = Q_enc / ε₀。' },
  { id: 'q09', dim: 'physicsC', lesson: 'Mechanics · Energy', difficulty: 2,
    q: 'Mass 2 kg at 10 m height. PE = ? (g=10)',
    options: ['20 J', '100 J', '200 J', '2000 J'], answer: 2,
    solution: 'PE = mgh = 2×10×10 = 200 J。' },

  // AP Chemistry
  { id: 'q10', dim: 'chemistry', lesson: 'Stoichiometry', difficulty: 2,
    q: 'How many moles in 36 g of H₂O? (M=18)',
    options: ['0.5', '1', '2', '18'], answer: 2,
    solution: 'n = m/M = 36/18 = 2 mol。' },
  { id: 'q11', dim: 'chemistry', lesson: 'Equilibrium', difficulty: 3,
    q: 'Le Chatelier: increasing pressure shifts equilibrium toward:',
    options: ['More gas moles', 'Fewer gas moles', 'No shift', 'Depends on temp only'], answer: 1,
    solution: '加压 → 系统向减少气体总摩尔数的方向移动。' },
  { id: 'q12', dim: 'chemistry', lesson: 'Acid-Base', difficulty: 2,
    q: 'pH of 0.01 M HCl solution?',
    options: ['1', '2', '7', '12'], answer: 1,
    solution: '强酸完全电离：[H⁺] = 0.01 → pH = −log(0.01) = 2。' },

  // AP Biology
  { id: 'q13', dim: 'biology', lesson: 'Cell Biology', difficulty: 1,
    q: 'Site of cellular respiration (ATP production) is:',
    options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'], answer: 1,
    solution: '线粒体是 ATP 生产基地（Krebs + ETC）。' },
  { id: 'q14', dim: 'biology', lesson: 'Genetics · Punnett', difficulty: 2,
    q: 'Cross Aa × Aa. Probability of aa offspring?',
    options: ['0%', '25%', '50%', '75%'], answer: 1,
    solution: 'Punnett 方格：AA:Aa:aa = 1:2:1，aa 为 25%。' },
  { id: 'q15', dim: 'biology', lesson: 'Evolution', difficulty: 2,
    q: 'Hardy-Weinberg p² + 2pq + q² = 1 assumes:',
    options: ['Small population', 'Selection occurs', 'No migration & random mating', 'High mutation'], answer: 2,
    solution: 'HWE 五个假设之一：无迁移 + 随机交配 + 大种群 + 无突变 + 无选择。' },

  // AP Economics
  { id: 'q16', dim: 'economics', lesson: 'Micro · Supply/Demand', difficulty: 1,
    q: 'Price ceiling BELOW equilibrium causes:',
    options: ['Surplus', 'Shortage', 'No change', 'Higher prices'], answer: 1,
    solution: '最高限价低于均衡价 → 需求 > 供给 → 短缺（shortage）。' },
  { id: 'q17', dim: 'economics', lesson: 'Macro · GDP', difficulty: 2,
    q: 'GDP = C + I + G + ?',
    options: ['Imports − Exports', 'Exports − Imports (NX)', 'Savings', 'Taxes'], answer: 1,
    solution: '恒等式 GDP = C + I + G + (X − M)，即净出口 NX。' },
  { id: 'q18', dim: 'economics', lesson: 'Macro · Inflation', difficulty: 2,
    q: 'CPI measures:',
    options: ['GDP growth', 'Consumer price level change', 'Unemployment', 'Interest rates'], answer: 1,
    solution: 'CPI = Consumer Price Index，衡量物价变动。' },

  // Cross
  { id: 'q19', dim: 'calculus', lesson: 'BC · Integrals', difficulty: 3, second: 'physicsC',
    q: '∫ 2x dx from 0 to 3 = ?',
    options: ['3', '6', '9', '12'], answer: 2,
    solution: '∫2x dx = x²，代入：9 − 0 = 9。' },
  { id: 'q20', dim: 'statistics', lesson: 'Regression', difficulty: 3, second: 'economics',
    q: 'R² = 0.85 means:',
    options: ['85% correlation', '85% of variation explained', 'Strong causation', 'Model is wrong'], answer: 1,
    solution: 'R² = 解释方差占比，不等于相关性或因果性。' },
]

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

module.exports = {
  id: 'ap',
  name: 'AP 美高',
  shortName: 'AP',
  icon: '🎓',
  color: '#ffd700',
  gradient: 'linear-gradient(135deg,#ffd700,#ff9500)',
  tag: '课程',
  textbook: {
    title: 'AP · 6 Subject Bundle',
    author: 'College Board',
    grade: 'Score 3 → 5',
    lessons: 72,
    investigations: 6
  },
  DIMS, QUESTION_BANK, pickAdaptive
}
