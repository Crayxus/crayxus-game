// 贝赛思物理 BASIS Physics · 6 维度 × 20 题
const DIMS = [
  { key: 'mechanics',   name: '力学',   icon: '🏃', color: '#00d4aa' },
  { key: 'waves',       name: '波动',   icon: '🌊', color: '#00d4ff' },
  { key: 'electricity', name: '电磁',   icon: '⚡', color: '#7c4dff' },
  { key: 'thermal',     name: '热学',   icon: '🔥', color: '#ffd700' },
  { key: 'optics',      name: '光学',   icon: '🔦', color: '#ff9500' },
  { key: 'modern',      name: '近代',   icon: '⚛',  color: '#ff6b6b' },
]

const QUESTION_BANK = [
  { id: 'q01', dim: 'mechanics', lesson: 'Kinematics · v=u+at', difficulty: 1,
    q: 'u=0, a=2 m/s², t=5s. Velocity v = ?',
    options: ['5 m/s', '10 m/s', '20 m/s', '50 m/s'], answer: 1,
    solution: 'v = u + at = 0 + 2×5 = 10 m/s。' },
  { id: 'q02', dim: 'mechanics', lesson: 'Newton\'s 2nd Law', difficulty: 2,
    q: 'F = 20 N, m = 4 kg. Acceleration a = ?',
    options: ['2 m/s²', '5 m/s²', '10 m/s²', '80 m/s²'], answer: 1,
    solution: 'a = F/m = 20/4 = 5 m/s²。' },
  { id: 'q03', dim: 'mechanics', lesson: 'Energy', difficulty: 2,
    q: 'KE of 2 kg object moving at 3 m/s:',
    options: ['6 J', '9 J', '12 J', '18 J'], answer: 1,
    solution: 'KE = ½mv² = ½·2·9 = 9 J。' },
  { id: 'q04', dim: 'mechanics', lesson: 'Momentum', difficulty: 2,
    q: '"Law of conservation of momentum" applies when:',
    options: ['Any collision', 'No external forces', 'Only elastic', 'Only inelastic'], answer: 1,
    solution: '动量守恒条件：系统不受外力（或外力可忽略）。' },

  { id: 'q05', dim: 'waves', lesson: 'Wave speed', difficulty: 1,
    q: 'v = f × λ. If f = 50 Hz, λ = 2 m, v = ?',
    options: ['25 m/s', '50 m/s', '100 m/s', '200 m/s'], answer: 2,
    solution: 'v = 50 × 2 = 100 m/s。' },
  { id: 'q06', dim: 'waves', lesson: 'Transverse vs Longitudinal', difficulty: 1,
    q: 'Sound waves in air are:',
    options: ['Transverse', 'Longitudinal', 'Electromagnetic', 'Stationary'], answer: 1,
    solution: '声波是纵波（longitudinal），振动方向与传播方向平行。' },
  { id: 'q07', dim: 'waves', lesson: 'Interference', difficulty: 3,
    q: 'Two waves meet in phase → ?',
    options: ['Destructive', 'Constructive', 'No effect', 'Doppler'], answer: 1,
    solution: '同相叠加为相长干涉（constructive interference）。' },

  { id: 'q08', dim: 'electricity', lesson: 'Ohm\'s Law', difficulty: 1,
    q: 'V = 12V, R = 3Ω. Current I = ?',
    options: ['2 A', '4 A', '9 A', '36 A'], answer: 1,
    solution: 'I = V/R = 12/3 = 4 A。' },
  { id: 'q09', dim: 'electricity', lesson: 'Power', difficulty: 2,
    q: 'P = VI. V=10V, I=2A. Power = ?',
    options: ['5 W', '8 W', '12 W', '20 W'], answer: 3,
    solution: 'P = 10 × 2 = 20 W。' },
  { id: 'q10', dim: 'electricity', lesson: 'Magnetic Field', difficulty: 3,
    q: 'Right-hand rule: current upward, field points north. Force on wire:',
    options: ['Upward', 'Downward', 'East (out of page)', 'West (into page)'], answer: 2,
    solution: 'F = IL×B，右手定则：电流向上、磁场向北 → 力向东。' },

  { id: 'q11', dim: 'thermal', lesson: 'Specific Heat', difficulty: 2,
    q: 'Q = mcΔT. 1 kg water (c=4200), ΔT=10°C. Q = ?',
    options: ['420 J', '4200 J', '42000 J', '420000 J'], answer: 2,
    solution: 'Q = 1 × 4200 × 10 = 42000 J。' },
  { id: 'q12', dim: 'thermal', lesson: 'Laws of Thermodynamics', difficulty: 2,
    q: 'First law of thermodynamics is essentially:',
    options: ['Entropy increases', 'Energy conservation', 'Absolute zero unreachable', 'Heat flows hot→cold'], answer: 1,
    solution: '第一定律 = 能量守恒定律（ΔU = Q − W）。' },
  { id: 'q13', dim: 'thermal', lesson: 'Heat Transfer', difficulty: 1,
    q: 'Heat transfer requiring medium:',
    options: ['Radiation', 'Conduction', 'All of above', 'None'], answer: 1,
    solution: '辐射无需介质；传导必须介质直接接触。' },

  { id: 'q14', dim: 'optics', lesson: 'Reflection', difficulty: 1,
    q: 'Angle of incidence = 30°. Angle of reflection = ?',
    options: ['15°', '30°', '60°', '90°'], answer: 1,
    solution: '反射定律：入射角 = 反射角，均对法线。' },
  { id: 'q15', dim: 'optics', lesson: 'Refraction · Snell', difficulty: 3,
    q: 'Light passes from air to water. The light bends:',
    options: ['Away from normal', 'Toward normal', 'Parallel', 'Back'], answer: 1,
    solution: '从光疏→光密介质 (n 变大)，光线向法线靠拢。' },
  { id: 'q16', dim: 'optics', lesson: 'Lenses', difficulty: 2,
    q: 'A convex lens with object beyond 2F produces image that is:',
    options: ['Virtual, upright', 'Real, inverted, smaller', 'Real, inverted, larger', 'No image'], answer: 1,
    solution: '凸透镜物距 > 2f 时，像为倒立、缩小、实像。' },

  { id: 'q17', dim: 'modern', lesson: 'Photoelectric', difficulty: 3,
    q: 'Photoelectric effect experiment showed:',
    options: ['Light is only wave', 'Light is only particle', 'Light has wave-particle duality', 'Electrons are waves only'], answer: 2,
    solution: '光电效应证明光的粒子性，结合波动性 → 波粒二象性。' },
  { id: 'q18', dim: 'modern', lesson: 'Nuclear', difficulty: 2,
    q: 'Alpha particle is equivalent to:',
    options: ['Electron', 'Proton', 'Helium nucleus', 'Photon'], answer: 2,
    solution: 'α 粒子 = ²⁴He 核（2 质子 + 2 中子）。' },
  { id: 'q19', dim: 'modern', lesson: 'Relativity', difficulty: 3,
    q: 'E = mc². If m=2 kg, c=3×10⁸. E ≈ ?',
    options: ['6×10⁸ J', '1.8×10¹⁷ J', '9×10¹⁶ J', '18×10⁸ J'], answer: 1,
    solution: 'E = 2 × 9×10¹⁶ = 1.8×10¹⁷ J。' },
  { id: 'q20', dim: 'mechanics', lesson: 'Circular Motion', difficulty: 3, second: 'modern',
    q: 'Centripetal force direction:',
    options: ['Tangent to circle', 'Away from center', 'Toward center', 'Vertical'], answer: 2,
    solution: '向心力永远指向圆心。' },
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
  id: 'basis-physics',
  parentId: 'basis',
  name: '贝赛思物理',
  shortName: '物理',
  icon: '⚛',
  color: '#7c4dff',
  gradient: 'linear-gradient(135deg,#7c4dff,#00d4ff)',
  tag: '校本',
  textbook: {
    title: 'BASIS Physics · Mechanics → Modern',
    author: 'BASIS Curriculum',
    grade: 'Grade 8 → 11',
    lessons: 60,
    investigations: 6
  },
  DIMS, QUESTION_BANK, pickAdaptive
}
