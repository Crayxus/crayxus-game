// 托福 TOEFL · 6 维度 × 20 题种子
const DIMS = [
  { key: 'listening',  name: '听力',   icon: '🎧', color: '#00d4aa' },
  { key: 'speaking',   name: '口语',   icon: '🗣', color: '#00d4ff' },
  { key: 'reading',    name: '阅读',   icon: '📖', color: '#7c4dff' },
  { key: 'writing',    name: '写作',   icon: '✍',  color: '#ffd700' },
  { key: 'vocabulary', name: '学术词', icon: '📚', color: '#ff9500' },
  { key: 'integrated', name: '综合',   icon: '🔀', color: '#ff6b6b' },
]

const QUESTION_BANK = [
  { id: 'q01', dim: 'listening', lesson: 'Lecture · Note-taking', difficulty: 2,
    q: 'In TOEFL Listening, what is the MOST efficient note-taking approach?',
    options: ['Write verbatim', 'Use abbreviations & arrows for logic', 'Record audio only', 'Outline after audio'], answer: 1,
    solution: '缩写 + 箭头表关系（因果/对比）是高分标配。' },
  { id: 'q02', dim: 'listening', lesson: 'Conversation · Campus', difficulty: 1,
    q: '"I\'m stuck on this problem set." — the student is asking for:',
    options: ['A grade', 'Help/explanation', 'An extension', 'A refund'], answer: 1,
    solution: 'stuck on = 卡住了；校园对话常见求助场景。' },
  { id: 'q03', dim: 'listening', lesson: 'Attitude Questions', difficulty: 2,
    q: 'Professor says "That\'s an INTERESTING theory" with falling tone — likely means:',
    options: ['Strong support', 'Polite doubt', 'Pure surprise', 'Uncertainty'], answer: 1,
    solution: '降调的 "interesting" 常为委婉质疑，是托福态度题常见考点。' },

  { id: 'q04', dim: 'speaking', lesson: 'Task 1 · Independent', difficulty: 2,
    q: 'TOEFL Speaking Task 1 preparation time / response time:',
    options: ['15s / 30s', '15s / 45s', '30s / 60s', '45s / 90s'], answer: 1,
    solution: 'Task 1 独立题：准备 15 秒，回答 45 秒。' },
  { id: 'q05', dim: 'speaking', lesson: 'Task 2 · Integrated Campus', difficulty: 3, second: 'listening',
    q: 'In integrated Task 2, your response should:',
    options: ['Give your own opinion', 'Summarise reading + listening stance', 'Only describe reading', 'Only describe listening'], answer: 1,
    solution: 'Integrated 题要求综合整合双源信息，不加个人观点。' },
  { id: 'q06', dim: 'speaking', lesson: 'Delivery', difficulty: 2,
    q: 'A key delivery metric in TOEFL Speaking is:',
    options: ['British accent', 'Coherent pace & clear pronunciation', 'Speaking fast', 'Silence for emphasis'], answer: 1,
    solution: '评分三大维度之一 Delivery：语速节奏 + 发音清晰度。' },

  { id: 'q07', dim: 'reading', lesson: 'Factual Information', difficulty: 2,
    q: 'Best strategy for "Factual Information" questions:',
    options: ['Skim whole passage', 'Locate keyword in specific paragraph', 'Read last line', 'Read footnotes'], answer: 1,
    solution: '定位题根据题干 keyword 到原文段落精读，30-40 秒完成。' },
  { id: 'q08', dim: 'reading', lesson: 'Inference', difficulty: 3,
    q: 'Passage implies but does not state X. The question asks "What can be inferred?" — you should:',
    options: ['Choose the direct quote', 'Combine clues logically without overreaching', 'Guess based on title', 'Skip the question'], answer: 1,
    solution: '推理题需小幅推论：基于原文事实的合理延伸，不可脑补。' },
  { id: 'q09', dim: 'reading', lesson: 'Summary Question', difficulty: 3,
    q: 'Prose Summary (last question) asks for:',
    options: ['3 main ideas out of 6 choices', 'All 6 details', 'The thesis only', 'Author\'s opinion'], answer: 0,
    solution: 'Summary 题从 6 个选项中选 3 个主要观点（minor/untrue 不选）。' },

  { id: 'q10', dim: 'writing', lesson: 'Integrated Writing', difficulty: 3, second: 'listening',
    q: 'Integrated Writing reading/listening pass CONTRAST. Your essay should:',
    options: ['Support reading', 'Support listening', 'Explain how listening CASTS DOUBT on reading', 'Give your opinion'], answer: 2,
    solution: '集成写作绝大多数为 listening 反驳 reading，骨架为"听力如何质疑阅读"。' },
  { id: 'q11', dim: 'writing', lesson: 'Academic Discussion', difficulty: 2,
    q: 'New TOEFL Writing Task 2 (Academic Discussion) expects you to:',
    options: ['Write 400+ words with 2 body paragraphs', 'Give opinion + reason + example in ~100 words', 'Summarise a lecture', 'Agree with professor only'], answer: 1,
    solution: '新题型 Academic Discussion 约 100-150 字，陈述立场+理由+示例。' },
  { id: 'q12', dim: 'writing', lesson: 'Coherence', difficulty: 2,
    q: 'To score 4-5 in Writing, you MUST demonstrate:',
    options: ['Complex grammar only', 'Varied vocabulary + clear organisation', 'Longest possible essay', 'Zero errors'], answer: 1,
    solution: '高分依赖词汇多样性 + 逻辑结构清晰，而非长度或零错误。' },

  { id: 'q13', dim: 'vocabulary', lesson: 'Academic Vocabulary', difficulty: 2,
    q: 'Academic synonym for "show":',
    options: ['Demonstrate', 'Look', 'Tell', 'Find'], answer: 0,
    solution: 'demonstrate 为学术正式用词，托福阅读/听力中高频替换 show。' },
  { id: 'q14', dim: 'vocabulary', lesson: 'Word in Context', difficulty: 2,
    q: '"The theory was REFUTED by new evidence." REFUTED means:',
    options: ['Supported', 'Ignored', 'Disproved', 'Repeated'], answer: 2,
    solution: 'refute = 反驳/推翻；托福词汇题根据上下文 evidence 可推断。' },
  { id: 'q15', dim: 'vocabulary', lesson: 'Prefix Decoding', difficulty: 2,
    q: 'Prefix "pre-" in "predict" means:',
    options: ['After', 'Before', 'Against', 'Again'], answer: 1,
    solution: 'pre- = before，predict = 预先说/预测。' },

  { id: 'q16', dim: 'integrated', lesson: 'Reading + Listening Skills', difficulty: 3,
    q: 'In integrated tasks, you usually have how long to read the passage?',
    options: ['30s', '45s-3min', '5min', '10min'], answer: 1,
    solution: 'Integrated Speaking Task 2/3 阅读 45 秒；Writing Task 1 阅读 3 分钟。' },
  { id: 'q17', dim: 'integrated', lesson: 'Notes Transfer', difficulty: 3,
    q: 'Strongest integrated answer typically:',
    options: ['Copies reading wording', 'Paraphrases reading + cites listening', 'Ignores reading', 'Only uses listening examples'], answer: 1,
    solution: '高分 integrated：用自己的话重述 reading + 引用 listening 细节。' },
  { id: 'q18', dim: 'integrated', lesson: 'Signal Words', difficulty: 2,
    q: 'In integrated listening, "However" usually signals:',
    options: ['Example', 'Contrast / disagreement', 'Continuation', 'Conclusion'], answer: 1,
    solution: 'however 转折信号；integrated 任务中最关键信号之一。' },
  { id: 'q19', dim: 'reading', lesson: 'Sentence Simplification', difficulty: 3,
    q: 'The BEST simplification preserves:',
    options: ['Every detail', 'The main clause meaning + key modifiers', 'Only the subject', 'The first words'], answer: 1,
    solution: '句子简化题：保留核心主谓 + 关键限定语，丢次要信息。' },
  { id: 'q20', dim: 'writing', lesson: 'Error Correction', difficulty: 2,
    q: '"Many research show that ..." — correct to:',
    options: ['Many researches shows', 'Much research shows', 'A lot of researches show', 'Many research shows'], answer: 1,
    solution: 'research 为不可数名词，用 much + singular verb。' },
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
  id: 'toefl',
  name: '托福 TOEFL',
  shortName: '托福',
  icon: '🗽',
  color: '#7c4dff',
  gradient: 'linear-gradient(135deg,#7c4dff,#00d4ff)',
  tag: '语言',
  textbook: {
    title: 'TOEFL iBT · Official Guide 6e',
    author: 'ETS',
    grade: 'Score 80 → 110',
    lessons: 40,
    investigations: 4
  },
  DIMS, QUESTION_BANK, pickAdaptive
}
