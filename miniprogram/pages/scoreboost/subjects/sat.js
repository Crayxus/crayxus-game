// SAT · 6 维度 × 20 题种子
const DIMS = [
  { key: 'reading',        name: '阅读',     icon: '📖', color: '#00d4aa' },
  { key: 'grammar',        name: '文法',     icon: '🔤', color: '#00d4ff' },
  { key: 'algebra',        name: '代数',     icon: '➕', color: '#7c4dff' },
  { key: 'advMath',        name: '高阶数学', icon: '📈', color: '#ffd700' },
  { key: 'dataAnalysis',   name: '数据分析', icon: '📊', color: '#ff9500' },
  { key: 'geometry',       name: '几何三角', icon: '📐', color: '#ff6b6b' },
]

const QUESTION_BANK = [
  // Reading
  { id: 'q01', dim: 'reading', lesson: 'Command of Evidence', difficulty: 2,
    q: 'A "best evidence" question asks you to:',
    options: ['Guess author\'s bias', 'Find lines supporting the previous answer', 'Summarise the passage', 'Check grammar'], answer: 1,
    solution: 'Digital SAT 保留 evidence-based 题型：从原文中找最支持前一题答案的句子。' },
  { id: 'q02', dim: 'reading', lesson: 'Words in Context', difficulty: 2,
    q: 'Passage: "Her remarks were TRENCHANT, cutting to the heart of the matter." TRENCHANT ≈',
    options: ['Vague', 'Incisive / sharp', 'Kind', 'Humorous'], answer: 1,
    solution: '语境线索"cutting to the heart" → 尖锐/直击要害。' },
  { id: 'q03', dim: 'reading', lesson: 'Main Idea', difficulty: 2,
    q: 'The main idea of a passage is usually found in:',
    options: ['First example', 'Thesis / topic sentence', 'Last word', 'Footnote'], answer: 1,
    solution: 'SAT 文章主旨通常在开头的 thesis 或首段末句。' },

  // Grammar (Writing & Language)
  { id: 'q04', dim: 'grammar', lesson: 'Subject-Verb Agreement', difficulty: 1,
    q: '"The data ___ been analyzed." (formal)',
    options: ['has', 'have', 'had', 'is'], answer: 1,
    solution: '学术写作中 data 视为复数：have + past participle。' },
  { id: 'q05', dim: 'grammar', lesson: 'Punctuation · Semicolon', difficulty: 2,
    q: 'Correct use of semicolon:',
    options: ['I like tea; and coffee.', 'She studied hard; she passed.', 'We went; to the park.', 'Books; movies; games are fun.'], answer: 1,
    solution: '分号连接两个独立分句（independent clauses），不与 and 并用。' },
  { id: 'q06', dim: 'grammar', lesson: 'Modifier Placement', difficulty: 3,
    q: '"Running to the bus, ___ was lost." Best completion:',
    options: ['my wallet', 'I dropped my wallet, which', 'Tom\'s wallet', 'lost'], answer: 1,
    solution: '分词短语主语须为 running 的动作执行者（人），避免悬垂修饰。' },
  { id: 'q07', dim: 'grammar', lesson: 'Transitions', difficulty: 2,
    q: 'Evidence supports A. Next sentence contradicts A. Best transition:',
    options: ['Therefore', 'However', 'Moreover', 'For example'], answer: 1,
    solution: '句间转折用 however；therefore 表因果，moreover 表递进。' },

  // Algebra (Heart of Algebra)
  { id: 'q08', dim: 'algebra', lesson: 'Linear Equations', difficulty: 1,
    q: '3x + 5 = 20. x = ?',
    options: ['3', '5', '7', '15'], answer: 1,
    solution: '3x = 15 → x = 5。' },
  { id: 'q09', dim: 'algebra', lesson: 'Systems', difficulty: 2,
    q: 'System: x+y=10, x−y=4. (x, y) = ?',
    options: ['(7,3)', '(6,4)', '(5,5)', '(8,2)'], answer: 0,
    solution: '加减消元：2x=14 → x=7, y=3。' },
  { id: 'q10', dim: 'algebra', lesson: 'Inequalities', difficulty: 2,
    q: 'Solve 2x − 3 > 7:',
    options: ['x > 2', 'x > 5', 'x < 5', 'x ≥ 5'], answer: 1,
    solution: '2x > 10 → x > 5。' },

  // Advanced Math (Passport to Advanced Math)
  { id: 'q11', dim: 'advMath', lesson: 'Quadratics', difficulty: 2,
    q: 'Vertex of y = (x−3)² + 2:',
    options: ['(3, 2)', '(−3, 2)', '(3, −2)', '(2, 3)'], answer: 0,
    solution: '顶点式 y = a(x−h)² + k，顶点为 (h, k) = (3, 2)。' },
  { id: 'q12', dim: 'advMath', lesson: 'Functions', difficulty: 3,
    q: 'If f(x) = 2x + 1 and g(x) = x², then f(g(2)) = ?',
    options: ['5', '9', '8', '7'], answer: 1,
    solution: 'g(2)=4 → f(4)=9。' },
  { id: 'q13', dim: 'advMath', lesson: 'Exponentials', difficulty: 3,
    q: '2ˣ = 8 → x = ?',
    options: ['2', '3', '4', '6'], answer: 1,
    solution: '2³ = 8，所以 x = 3。' },

  // Data Analysis (Problem Solving & Data Analysis)
  { id: 'q14', dim: 'dataAnalysis', lesson: 'Percent', difficulty: 1,
    q: '30% of 200 = ?',
    options: ['30', '60', '90', '120'], answer: 1,
    solution: '0.30 × 200 = 60。' },
  { id: 'q15', dim: 'dataAnalysis', lesson: 'Ratio', difficulty: 2,
    q: 'A recipe uses sugar:flour = 2:5. For 15 cups flour, sugar = ?',
    options: ['4', '5', '6', '8'], answer: 2,
    solution: '比例 2/5 = x/15 → x = 6 cups。' },
  { id: 'q16', dim: 'dataAnalysis', lesson: 'Statistics', difficulty: 2,
    q: 'Dataset {2, 4, 4, 6, 9}. Median = ?',
    options: ['4', '5', '6', '9'], answer: 0,
    solution: '排序后中间值为 4（5 个数的第 3 个）。' },
  { id: 'q17', dim: 'dataAnalysis', lesson: 'Probability', difficulty: 2,
    q: 'Coin flipped 3 times. P(all heads) = ?',
    options: ['1/2', '1/4', '1/8', '3/8'], answer: 2,
    solution: '(1/2)³ = 1/8。' },

  // Geometry & Trigonometry
  { id: 'q18', dim: 'geometry', lesson: 'Pythagoras', difficulty: 2,
    q: 'Right triangle, legs 3 and 4. Hypotenuse = ?',
    options: ['5', '6', '7', '12'], answer: 0,
    solution: '3² + 4² = 25 → √25 = 5。' },
  { id: 'q19', dim: 'geometry', lesson: 'Circle', difficulty: 2,
    q: 'Circle area with r=5. (π=3.14)',
    options: ['15.7', '25', '31.4', '78.5'], answer: 3,
    solution: 'A = πr² = 3.14 × 25 = 78.5。' },
  { id: 'q20', dim: 'geometry', lesson: 'Trig · SOH-CAH-TOA', difficulty: 3,
    q: 'In right triangle, if sin θ = 3/5, then cos θ = ?',
    options: ['3/5', '4/5', '5/3', '5/4'], answer: 1,
    solution: '3-4-5 三角形：sin=opp/hyp=3/5 → adj=4 → cos=4/5。' },
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
  id: 'sat',
  name: 'SAT',
  shortName: 'SAT',
  icon: '📝',
  color: '#ff9500',
  gradient: 'linear-gradient(135deg,#ff9500,#ffd700)',
  tag: '标化',
  textbook: {
    title: 'SAT Digital · Official Guide',
    author: 'College Board',
    grade: 'Score 1200 → 1550+',
    lessons: 36,
    investigations: 4
  },
  DIMS, QUESTION_BANK, pickAdaptive
}
