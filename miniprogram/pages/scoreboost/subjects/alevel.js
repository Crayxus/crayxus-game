// A-Level (CAIE/Edexcel) · 6 学科 × 20 题种子
const DIMS = [
  { key: 'mathematics',  name: '数学',     icon: '📐', color: '#00d4aa' },
  { key: 'furtherMath',  name: '进阶数学', icon: '🧮', color: '#00d4ff' },
  { key: 'physics',      name: '物理',     icon: '⚛',  color: '#7c4dff' },
  { key: 'chemistry',    name: '化学',     icon: '🧪', color: '#ffd700' },
  { key: 'economics',    name: '经济',     icon: '💹', color: '#ff9500' },
  { key: 'biology',      name: '生物',     icon: '🧬', color: '#ff6b6b' },
]

const QUESTION_BANK = [
  // Mathematics (Pure + Mechanics)
  { id: 'q01', dim: 'mathematics', lesson: 'Pure 1 · Quadratics', difficulty: 2,
    q: 'Roots of x² − 5x + 6 = 0:',
    options: ['1, 6', '2, 3', '−2, −3', '1, 5'], answer: 1,
    solution: '(x−2)(x−3)=0 → x=2 或 3。' },
  { id: 'q02', dim: 'mathematics', lesson: 'Pure 2 · Differentiation', difficulty: 2,
    q: 'd/dx [3x⁴] = ?',
    options: ['3x³', '12x³', '4x³', '12x⁴'], answer: 1,
    solution: '幂法则：n·axⁿ⁻¹ = 4·3·x³ = 12x³。' },
  { id: 'q03', dim: 'mathematics', lesson: 'Mechanics · Suvat', difficulty: 2,
    q: 'u=0, a=5 m/s², t=4s. Displacement s = ?',
    options: ['10', '20', '40', '80'], answer: 2,
    solution: 's = ut + ½at² = 0 + ½·5·16 = 40 m。' },

  // Further Mathematics
  { id: 'q04', dim: 'furtherMath', lesson: 'Complex Numbers', difficulty: 3,
    q: '(2 + 3i)(1 − i) = ?',
    options: ['5 + i', '2 − 3i', '−1 + 5i', '5 + 3i'], answer: 0,
    solution: '展开：2 − 2i + 3i − 3i² = 2 + i + 3 = 5 + i。' },
  { id: 'q05', dim: 'furtherMath', lesson: 'Matrices', difficulty: 3,
    q: 'Det of [[2,1],[3,4]] = ?',
    options: ['5', '8', '11', '−5'], answer: 0,
    solution: '|A| = ad − bc = 2·4 − 1·3 = 5。' },
  { id: 'q06', dim: 'furtherMath', lesson: 'Differential Eq', difficulty: 3,
    q: 'Solution of dy/dx = y is:',
    options: ['y = x²', 'y = Ceˣ', 'y = sin x', 'y = ln x'], answer: 1,
    solution: '可分离变量 dy/y = dx → ln|y|=x+C → y=Ceˣ。' },

  // Physics
  { id: 'q07', dim: 'physics', lesson: 'AS · Forces', difficulty: 1,
    q: 'Newton\'s 2nd Law: F = ?',
    options: ['mv', 'ma', 'mg', 'mv²'], answer: 1,
    solution: 'F = ma（force = mass × acceleration）。' },
  { id: 'q08', dim: 'physics', lesson: 'A2 · Circular Motion', difficulty: 3,
    q: 'Centripetal acceleration a = ?',
    options: ['v/r', 'v²/r', 'vr', 'v²r'], answer: 1,
    solution: 'a_c = v²/r，指向圆心。' },
  { id: 'q09', dim: 'physics', lesson: 'A2 · Waves', difficulty: 2,
    q: 'Wave speed v = ? (f = frequency, λ = wavelength)',
    options: ['f + λ', 'f × λ', 'f / λ', 'λ / f'], answer: 1,
    solution: 'v = fλ，基础波速公式。' },

  // Chemistry
  { id: 'q10', dim: 'chemistry', lesson: 'Atomic Structure', difficulty: 1,
    q: 'Number of protons in Carbon-12:',
    options: ['4', '6', '12', '14'], answer: 1,
    solution: '原子序数 = 质子数，Carbon = 6。' },
  { id: 'q11', dim: 'chemistry', lesson: 'Kinetics', difficulty: 3,
    q: 'Catalyst affects rate by:',
    options: ['Increasing ΔH', 'Lowering activation energy', 'Increasing temperature', 'Changing equilibrium'], answer: 1,
    solution: '催化剂降低 Ea，不改变 ΔH 与平衡位置。' },
  { id: 'q12', dim: 'chemistry', lesson: 'Organic · Alkenes', difficulty: 2,
    q: 'C₂H₄ + H₂ → ?',
    options: ['C₂H₂', 'C₂H₆', 'CH₄', 'C₂H₄O'], answer: 1,
    solution: '烯烃催化加氢得烷烃：乙烯 → 乙烷。' },

  // Economics
  { id: 'q13', dim: 'economics', lesson: 'Micro · Elasticity', difficulty: 2,
    q: 'PED = 2.5 means demand is:',
    options: ['Inelastic', 'Unit elastic', 'Elastic', 'Perfectly elastic'], answer: 2,
    solution: '|PED| > 1 → elastic；2.5 为弹性需求。' },
  { id: 'q14', dim: 'economics', lesson: 'Macro · Fiscal Policy', difficulty: 2,
    q: 'Expansionary fiscal policy involves:',
    options: ['Higher taxes', 'Lower gov spending', 'Lower taxes / higher spending', 'Raising interest'], answer: 2,
    solution: '扩张性财政：减税 or 增加政府支出，促进 AD。' },
  { id: 'q15', dim: 'economics', lesson: 'Market Failure', difficulty: 3,
    q: 'Negative externality causes:',
    options: ['Under-production', 'Over-production (MSC > MPC)', 'Equilibrium', 'Perfect allocation'], answer: 1,
    solution: '负外部性下 MSC > MPC，市场过度生产，需税收矫正。' },

  // Biology
  { id: 'q16', dim: 'biology', lesson: 'Cells', difficulty: 1,
    q: 'DNA is found primarily in which organelle?',
    options: ['Nucleus', 'Ribosome', 'Golgi', 'Lysosome'], answer: 0,
    solution: '真核生物 DNA 主要位于细胞核。' },
  { id: 'q17', dim: 'biology', lesson: 'Biochemistry', difficulty: 2,
    q: 'Enzyme active site shape is specific to:',
    options: ['Any molecule', 'Substrate (lock and key)', 'Water', 'ATP only'], answer: 1,
    solution: 'lock-and-key 模型：酶活性位点与底物形状匹配。' },
  { id: 'q18', dim: 'biology', lesson: 'Ecology', difficulty: 2,
    q: 'Top of energy pyramid has:',
    options: ['Most energy', 'Least energy (10% rule)', 'No consumers', 'Producers'], answer: 1,
    solution: '能量金字塔：每层约 10% 能量传递，顶层能量最少。' },

  // Cross
  { id: 'q19', dim: 'mathematics', lesson: 'Pure 3 · Integration', difficulty: 3,
    q: '∫ 1/x dx = ?',
    options: ['x²/2', 'ln|x| + C', '1/(2x)', 'eˣ'], answer: 1,
    solution: '标准积分：∫(1/x)dx = ln|x| + C。' },
  { id: 'q20', dim: 'physics', lesson: 'A2 · Electricity', difficulty: 2, second: 'mathematics',
    q: 'V = IR. If I=2A, R=5Ω, V = ?',
    options: ['0.4 V', '2.5 V', '7 V', '10 V'], answer: 3,
    solution: '欧姆定律：V = IR = 2 × 5 = 10 V。' },
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
  id: 'alevel',
  name: 'A-Level',
  shortName: 'A-Level',
  icon: '🇬🇧',
  color: '#ff6b6b',
  gradient: 'linear-gradient(135deg,#ff6b6b,#ff9500)',
  tag: '课程',
  textbook: {
    title: 'CAIE/Edexcel · 6 Subject',
    author: 'Cambridge / Pearson',
    grade: 'A* → A',
    lessons: 60,
    investigations: 4
  },
  DIMS, QUESTION_BANK, pickAdaptive
}
