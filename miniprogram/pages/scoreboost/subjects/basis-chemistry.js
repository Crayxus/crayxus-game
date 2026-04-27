// 贝赛思化学 BASIS Chemistry · 6 维度 × 20 题
const DIMS = [
  { key: 'atoms',     name: '原子',   icon: '⚛',  color: '#00d4aa' },
  { key: 'bonds',     name: '化学键', icon: '🔗', color: '#00d4ff' },
  { key: 'reactions', name: '反应',   icon: '🔄', color: '#7c4dff' },
  { key: 'acids',     name: '酸碱',   icon: '🧴', color: '#ffd700' },
  { key: 'organic',   name: '有机',   icon: '🌿', color: '#ff9500' },
  { key: 'states',    name: '物态',   icon: '❄',  color: '#ff6b6b' },
]

const QUESTION_BANK = [
  { id: 'q01', dim: 'atoms', lesson: 'Atomic Structure', difficulty: 1,
    q: 'The atomic number of an element equals the number of:',
    options: ['Neutrons', 'Protons', 'Electrons+neutrons', 'Mass'], answer: 1,
    solution: '原子序数 = 质子数。' },
  { id: 'q02', dim: 'atoms', lesson: 'Isotopes', difficulty: 2,
    q: 'Isotopes of an element differ in:',
    options: ['Protons', 'Neutrons', 'Electrons', 'Charge'], answer: 1,
    solution: '同位素：质子数相同，中子数不同。' },
  { id: 'q03', dim: 'atoms', lesson: 'Electron Config', difficulty: 2,
    q: 'Carbon (Z=6) electron configuration is:',
    options: ['1s² 2s² 2p²', '1s² 2s² 2p⁴', '1s² 2s⁴', '2s² 2p⁴'], answer: 0,
    solution: '6 电子：1s²2s²2p²。' },

  { id: 'q04', dim: 'bonds', lesson: 'Ionic vs Covalent', difficulty: 1,
    q: 'NaCl is an example of:',
    options: ['Covalent bond', 'Ionic bond', 'Metallic bond', 'Hydrogen bond'], answer: 1,
    solution: 'Na⁺ + Cl⁻ → 离子键（电子完全转移）。' },
  { id: 'q05', dim: 'bonds', lesson: 'Polarity', difficulty: 2,
    q: 'H₂O is a polar molecule because:',
    options: ['It has 3 atoms', 'Bent geometry + electronegativity difference', 'It\'s a liquid', 'It has 2 H'], answer: 1,
    solution: '弯曲几何 + O-H 电负性差 → 偶极矩不抵消，极性分子。' },
  { id: 'q06', dim: 'bonds', lesson: 'Hybridization', difficulty: 3,
    q: 'Carbon in CH₄ has hybridization:',
    options: ['sp', 'sp²', 'sp³', 'sp³d'], answer: 2,
    solution: '甲烷中 C 4 个 σ 键 → sp³ 杂化。' },

  { id: 'q07', dim: 'reactions', lesson: 'Balancing', difficulty: 2,
    q: 'Balance: __ H₂ + O₂ → __ H₂O',
    options: ['1,1,1', '2,1,2', '1,2,1', '2,2,4'], answer: 1,
    solution: '2H₂ + O₂ → 2H₂O（配平后 H:4/O:2 两边相等）。' },
  { id: 'q08', dim: 'reactions', lesson: 'Stoichiometry', difficulty: 2,
    q: '1 mol CaCO₃ → CaO + CO₂. How many moles CO₂?',
    options: ['0.5', '1', '2', '3'], answer: 1,
    solution: '反应 1:1 摩尔比，1 mol CaCO₃ 得 1 mol CO₂。' },
  { id: 'q09', dim: 'reactions', lesson: 'Equilibrium', difficulty: 3,
    q: 'Le Chatelier\'s principle: add more reactant → equilibrium shifts:',
    options: ['Toward reactants', 'Toward products', 'No shift', 'Stops'], answer: 1,
    solution: '勒夏特列：反应物增加 → 向产物方向移动。' },

  { id: 'q10', dim: 'acids', lesson: 'pH Scale', difficulty: 1,
    q: 'pH of pure water at 25°C:',
    options: ['0', '7', '10', '14'], answer: 1,
    solution: '中性水 pH = 7。' },
  { id: 'q11', dim: 'acids', lesson: 'Strong Acids', difficulty: 2,
    q: 'Which is a STRONG acid?',
    options: ['CH₃COOH', 'H₂CO₃', 'HCl', 'HF'], answer: 2,
    solution: 'HCl 完全电离 → 强酸。HF 是弱酸。' },
  { id: 'q12', dim: 'acids', lesson: 'Buffer', difficulty: 3,
    q: 'A buffer solution typically contains:',
    options: ['Strong acid + strong base', 'Weak acid + conjugate base', 'Water only', 'Any salt'], answer: 1,
    solution: '缓冲液 = 弱酸 + 其共轭碱（如 CH₃COOH + CH₃COONa）。' },

  { id: 'q13', dim: 'organic', lesson: 'Alkanes', difficulty: 1,
    q: 'Methane formula is:',
    options: ['CH₂', 'CH₃', 'CH₄', 'C₂H₆'], answer: 2,
    solution: '甲烷 = CH₄（最简单烷烃）。' },
  { id: 'q14', dim: 'organic', lesson: 'Functional Groups', difficulty: 2,
    q: '-OH group indicates:',
    options: ['Alkene', 'Alcohol', 'Acid', 'Aldehyde'], answer: 1,
    solution: '-OH 是羟基 → 醇类（alcohol）。' },
  { id: 'q15', dim: 'organic', lesson: 'Isomerism', difficulty: 3,
    q: 'Butane C₄H₁₀ has how many structural isomers?',
    options: ['1', '2', '3', '4'], answer: 1,
    solution: 'n-butane 和 isobutane 两种结构异构体。' },

  { id: 'q16', dim: 'states', lesson: 'Phase Changes', difficulty: 1,
    q: 'Solid → gas directly is called:',
    options: ['Melting', 'Sublimation', 'Condensation', 'Evaporation'], answer: 1,
    solution: '升华（sublimation）：固态跳过液态直接变气。' },
  { id: 'q17', dim: 'states', lesson: 'Ideal Gas Law', difficulty: 2,
    q: 'PV = nRT. Increase T at constant V → P:',
    options: ['Decreases', 'Increases', 'Unchanged', 'Zero'], answer: 1,
    solution: '定容下 P 正比 T，温度升高压强增大。' },
  { id: 'q18', dim: 'states', lesson: 'Intermolecular Forces', difficulty: 2,
    q: 'Strongest intermolecular force:',
    options: ['London dispersion', 'Dipole-dipole', 'Hydrogen bond', 'Ion-dipole'], answer: 3,
    solution: 'Ion-dipole > H-bond > dipole-dipole > London。' },
  { id: 'q19', dim: 'reactions', lesson: 'Redox', difficulty: 3, second: 'atoms',
    q: 'Oxidation is:',
    options: ['Gain of electrons', 'Loss of electrons', 'Gain of H', 'Gain of oxygen only'], answer: 1,
    solution: 'OIL RIG: Oxidation Is Loss of electrons。' },
  { id: 'q20', dim: 'acids', lesson: 'Neutralization', difficulty: 2, second: 'reactions',
    q: 'HCl + NaOH → ?',
    options: ['HCl + NaOH', 'H₂O + NaCl', 'H₂ + NaCl', 'HClO + Na'], answer: 1,
    solution: '酸碱中和：生成盐 + 水。' },
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
  id: 'basis-chemistry',
  parentId: 'basis',
  name: '贝赛思化学',
  shortName: '化学',
  icon: '🧪',
  color: '#ffd700',
  gradient: 'linear-gradient(135deg,#ffd700,#ff9500)',
  tag: '校本',
  textbook: {
    title: 'BASIS Chemistry · General & Organic',
    author: 'BASIS Curriculum',
    grade: 'Grade 9 → 12',
    lessons: 54,
    investigations: 6
  },
  DIMS, QUESTION_BANK, pickAdaptive
}
