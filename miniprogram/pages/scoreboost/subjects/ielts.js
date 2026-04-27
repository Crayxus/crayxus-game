// 雅思 IELTS · 6 维度 × 20 题种子
const DIMS = [
  { key: 'listening',  name: '听力',  icon: '🎧', color: '#00d4aa' },
  { key: 'speaking',   name: '口语',  icon: '🗣', color: '#00d4ff' },
  { key: 'reading',    name: '阅读',  icon: '📖', color: '#7c4dff' },
  { key: 'writing',    name: '写作',  icon: '✍',  color: '#ffd700' },
  { key: 'vocabulary', name: '词汇',  icon: '📚', color: '#ff9500' },
  { key: 'grammar',    name: '语法',  icon: '🔤', color: '#ff6b6b' },
]

const QUESTION_BANK = [
  // Listening
  { id: 'q01', dim: 'listening', lesson: 'Section 1 · Form Filling', difficulty: 1,
    q: 'In IELTS Listening Section 1, what is the most common task type?',
    options: ['Multiple choice', 'Form/note completion', 'Matching headings', 'Summary'], answer: 1,
    solution: 'Section 1 多为表格/笔记填空（人物信息、预订、住宿等）。' },
  { id: 'q02', dim: 'listening', lesson: 'Number Spelling', difficulty: 1,
    q: 'Postcode "BN1 4QP" — which is correct when you hear "B for Bravo, N for November"?',
    options: ['BM1 4QP', 'BN1 4QP', 'VN1 4QP', 'BN1 4KP'], answer: 1,
    solution: 'NATO 字母表用于辨音防混淆，B=Bravo, N=November。' },
  { id: 'q03', dim: 'listening', lesson: 'Map Labelling', difficulty: 2,
    q: '"The library is OPPOSITE the cafeteria." — the library is on which side?',
    options: ['Same side', 'Opposite side', 'Adjacent', 'Inside'], answer: 1,
    solution: 'opposite = 正对面（不同边），adjacent = 相邻同边。' },

  // Speaking
  { id: 'q04', dim: 'speaking', lesson: 'Part 2 · Cue Card', difficulty: 2,
    q: 'IELTS Speaking Part 2 gives you how long to prepare after the cue card?',
    options: ['30 sec', '1 min', '2 min', '3 min'], answer: 1,
    solution: 'Part 2: 1 分钟准备 + 1-2 分钟陈述。' },
  { id: 'q05', dim: 'speaking', lesson: 'Coherence Connectors', difficulty: 2,
    q: 'Which connector best shows CONTRAST?',
    options: ['Moreover', 'Whereas', 'For instance', 'Therefore'], answer: 1,
    solution: 'whereas = 对比；moreover 递进；for instance 举例；therefore 因果。' },
  { id: 'q06', dim: 'speaking', lesson: 'Part 3 · Abstract Discussion', difficulty: 3,
    q: 'A Band 8 answer in Part 3 should primarily demonstrate:',
    options: ['Memorised phrases', 'Developed ideas with examples', 'Long pauses for thought', 'Frequent self-correction'], answer: 1,
    solution: 'Part 3 考察抽象讨论的展开与举例支撑，Band 8 关键在 develop ideas。' },

  // Reading
  { id: 'q07', dim: 'reading', lesson: 'True/False/Not Given', difficulty: 2,
    q: 'Statement says "X is the best option." Passage says "X is one of several good options." Answer?',
    options: ['True', 'False', 'Not Given', 'Both T and F'], answer: 1,
    solution: '原文说"之一"，陈述说"最佳"，与事实矛盾 → False。Not Given 是信息缺失。' },
  { id: 'q08', dim: 'reading', lesson: 'Matching Headings', difficulty: 2,
    q: 'Best strategy for "Matching Headings" is:',
    options: ['Read whole passage first', 'Read first/last sentence of each paragraph', 'Skim headings only', 'Translate every word'], answer: 1,
    solution: '段落主旨通常在首末句（topic sentence），是最高效的匹配策略。' },
  { id: 'q09', dim: 'reading', lesson: 'Paraphrasing', difficulty: 2,
    q: 'Passage: "Urbanisation accelerated in the 19th century." Paraphrase?',
    options: ['Cities declined in 1800s', 'City growth sped up in the 1800s', 'Rural areas expanded', 'Urbanisation started in 1900s'], answer: 1,
    solution: '19th century = 1800s；accelerated = sped up。' },

  // Writing
  { id: 'q10', dim: 'writing', lesson: 'Task 1 · Overview', difficulty: 2,
    q: 'In IELTS Writing Task 1 (Academic), the OVERVIEW should include:',
    options: ['Every data point', 'Main trends without numbers', 'Personal opinion', 'Conclusion from data'], answer: 1,
    solution: 'Overview 总结主要趋势，不包含具体数字，也不加主观评价。' },
  { id: 'q11', dim: 'writing', lesson: 'Task 2 · Structure', difficulty: 2,
    q: 'Standard Task 2 essay has how many paragraphs?',
    options: ['2', '3', '4', '5'], answer: 2,
    solution: '引言 + 2 主体段 + 结论 = 4 段为标准结构。' },
  { id: 'q12', dim: 'writing', lesson: 'Lexical Resource', difficulty: 3,
    q: 'Best academic synonym for "very important"?',
    options: ['Really big', 'Crucial', 'Super nice', 'Way cool'], answer: 1,
    solution: 'crucial 为学术常用正式词汇，其他偏口语。' },

  // Vocabulary
  { id: 'q13', dim: 'vocabulary', lesson: 'Band 7+ Collocations', difficulty: 2,
    q: 'Which collocation is correct?',
    options: ['Make a decision', 'Do a decision', 'Take a decision (AmE wrong)', 'Give a decision'], answer: 0,
    solution: '英式标准搭配 make a decision（take a decision 在英式亦用，但 make 最通用）。' },
  { id: 'q14', dim: 'vocabulary', lesson: 'Academic Word List', difficulty: 2,
    q: '"Analyse" belongs to which AWL sublist-1 function?',
    options: ['Describe', 'Examine in detail', 'Summarise', 'Predict'], answer: 1,
    solution: 'analyse = 详细审视/拆解；非 summarise（概述）。' },
  { id: 'q15', dim: 'vocabulary', lesson: 'Word Formation', difficulty: 2,
    q: 'Noun form of "significant" is:',
    options: ['Signify', 'Significance', 'Significantly', 'Significate'], answer: 1,
    solution: 'significant(adj) → significance(n) / signify(v) / significantly(adv)。' },

  // Grammar
  { id: 'q16', dim: 'grammar', lesson: 'Conditionals', difficulty: 2,
    q: '"If I ___ rich, I would travel." (second conditional)',
    options: ['am', 'was', 'were', 'will be'], answer: 2,
    solution: '虚拟语气第二条件句：If + past subjunctive (were), would + inf.' },
  { id: 'q17', dim: 'grammar', lesson: 'Passive Voice', difficulty: 1,
    q: 'Passive of "They built this school in 1990":',
    options: ['This school built in 1990', 'This school was built in 1990', 'This school is built in 1990', 'This school has built in 1990'], answer: 1,
    solution: '一般过去时被动：was/were + past participle。' },
  { id: 'q18', dim: 'grammar', lesson: 'Articles', difficulty: 2,
    q: '"___ UK is ___ country in Europe." (articles)',
    options: ['A / a', 'The / a', 'The / the', '— / a'], answer: 1,
    solution: '国家名 UK 特指加 the；country 泛指用 a。' },
  { id: 'q19', dim: 'grammar', lesson: 'Relative Clauses', difficulty: 2,
    q: '"The book ___ I bought is expensive." Fill with:',
    options: ['who', 'whose', 'which', 'whom'], answer: 2,
    solution: '先行词 the book 为物，关系代词用 which/that。' },
  { id: 'q20', dim: 'grammar', lesson: 'Subject–Verb Agreement', difficulty: 2,
    q: '"The number of students ___ increasing."',
    options: ['are', 'is', 'have', 'were'], answer: 1,
    solution: 'The number of (+ pl noun) 整体作单数主语 → is。' },
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
  id: 'ielts',
  name: '雅思 IELTS',
  shortName: '雅思',
  icon: '🌍',
  color: '#00d4ff',
  gradient: 'linear-gradient(135deg,#00d4ff,#7c4dff)',
  tag: '语言',
  textbook: {
    title: 'IELTS Academic · Official Guide',
    author: 'Cambridge Assessment',
    grade: 'Band 5.5 → 8.0',
    lessons: 48,
    investigations: 6
  },
  DIMS, QUESTION_BANK, pickAdaptive
}
