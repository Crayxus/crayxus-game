// 贝赛思英语 BASIS English Literature · 6 维度 × 20 题
const DIMS = [
  { key: 'reading',    name: '阅读',   icon: '📖', color: '#00d4aa' },
  { key: 'writing',    name: '写作',   icon: '✍',  color: '#00d4ff' },
  { key: 'grammar',    name: '语法',   icon: '🔤', color: '#7c4dff' },
  { key: 'vocabulary', name: '词汇',   icon: '📚', color: '#ffd700' },
  { key: 'literature', name: '文学',   icon: '🎭', color: '#ff9500' },
  { key: 'poetry',     name: '诗歌',   icon: '🖋', color: '#ff6b6b' },
]

const QUESTION_BANK = [
  { id: 'q01', dim: 'reading', lesson: 'Main Idea', difficulty: 1,
    q: 'The central idea of a text is usually supported by:',
    options: ['A single example', 'Supporting details throughout', 'The title only', 'The word count'], answer: 1,
    solution: '主旨由贯穿全文的支持性细节反复强化。' },
  { id: 'q02', dim: 'reading', lesson: 'Author\'s Purpose', difficulty: 2,
    q: 'A persuasive essay\'s primary purpose is to:',
    options: ['Entertain', 'Inform', 'Convince', 'Describe'], answer: 2,
    solution: '议论/说服文的目的是说服读者接受立场。' },
  { id: 'q03', dim: 'reading', lesson: 'Inference', difficulty: 3,
    q: 'If a character "sighs and slumps her shoulders," the reader can infer:',
    options: ['She is excited', 'She is tired or discouraged', 'She is angry', 'She is amused'], answer: 1,
    solution: '肢体语言 "sigh + slumped shoulders" → 疲惫/沮丧。' },

  { id: 'q04', dim: 'writing', lesson: 'Thesis Statement', difficulty: 2,
    q: 'A strong thesis statement should be:',
    options: ['A question', 'A broad, vague claim', 'A specific, arguable claim', 'A quotation'], answer: 2,
    solution: '论文主题句：具体、可辩论、表达立场。' },
  { id: 'q05', dim: 'writing', lesson: 'Topic Sentence', difficulty: 1,
    q: 'A topic sentence typically appears:',
    options: ['At the end of the paragraph', 'At the beginning of the paragraph', 'In the middle', 'It\'s optional'], answer: 1,
    solution: '主题句通常在段落首句引出段落主旨。' },
  { id: 'q06', dim: 'writing', lesson: 'Revision', difficulty: 2,
    q: 'When revising, the FIRST step should be:',
    options: ['Fix spelling', 'Check global content/structure', 'Count words', 'Print final'], answer: 1,
    solution: '修改顺序：先看全局结构 → 段落 → 句子 → 词汇 → 校对。' },

  { id: 'q07', dim: 'grammar', lesson: 'Parts of Speech', difficulty: 1,
    q: 'In "She runs quickly," the word "quickly" is:',
    options: ['Noun', 'Verb', 'Adjective', 'Adverb'], answer: 3,
    solution: 'quickly 修饰动词 runs → 副词。' },
  { id: 'q08', dim: 'grammar', lesson: 'Comma Use', difficulty: 2,
    q: 'Correct punctuation: "After the storm ___ we went outside."',
    options: ['—', ',', ';', ':'], answer: 1,
    solution: '引导性从句后用逗号 (introductory clause)。' },
  { id: 'q09', dim: 'grammar', lesson: 'Tense Consistency', difficulty: 2,
    q: 'Error: "She went to the store and buys milk." Correction:',
    options: ['Went / bought', 'Goes / buys', 'Going / bought', 'Original is correct'], answer: 0,
    solution: '时态一致：过去时 → went + bought。' },

  { id: 'q10', dim: 'vocabulary', lesson: 'Context Clues', difficulty: 2,
    q: '"The stoic soldier showed no emotion, even in danger." STOIC ≈',
    options: ['Emotional', 'Impassive', 'Cowardly', 'Angry'], answer: 1,
    solution: 'stoic = 禁欲/克制/无动于衷 — 与 "no emotion" 对应。' },
  { id: 'q11', dim: 'vocabulary', lesson: 'Roots & Prefixes', difficulty: 2,
    q: 'Prefix "mal-" in MALICIOUS means:',
    options: ['Good', 'Bad / harmful', 'Many', 'Small'], answer: 1,
    solution: 'mal- = 恶的/不良 (malnutrition, malfunction)。' },
  { id: 'q12', dim: 'vocabulary', lesson: 'Connotation', difficulty: 3,
    q: '"Slender" has which connotation vs "skinny"?',
    options: ['Negative', 'Positive', 'Neutral scientific', 'Identical'], answer: 1,
    solution: 'slender 偏正面/赞美；skinny 偏负面/不健康。' },

  { id: 'q13', dim: 'literature', lesson: 'Shakespeare', difficulty: 2,
    q: '"Romeo and Juliet" is classified as a:',
    options: ['Comedy', 'Tragedy', 'History', 'Romance'], answer: 1,
    solution: '莎翁悲剧经典之一。' },
  { id: 'q14', dim: 'literature', lesson: 'Theme', difficulty: 2,
    q: 'The THEME of a literary work is:',
    options: ['What happens (plot)', 'Where it happens (setting)', 'Central underlying message', 'Who tells the story'], answer: 2,
    solution: '主题 = 文本探讨的中心思想，区别于情节/设定。' },
  { id: 'q15', dim: 'literature', lesson: 'Characterization', difficulty: 3,
    q: 'A "dynamic character" is one who:',
    options: ['Never changes', 'Undergoes significant change', 'Is only in one scene', 'Is the villain'], answer: 1,
    solution: '动态人物 (dynamic) 在故事中经历内在/外在转变。' },

  { id: 'q16', dim: 'poetry', lesson: 'Meter', difficulty: 3,
    q: 'Iambic pentameter has how many stressed syllables per line?',
    options: ['3', '4', '5', '6'], answer: 2,
    solution: '抑扬格五步诗：5 个"弱-强"音步 = 5 个重音。' },
  { id: 'q17', dim: 'poetry', lesson: 'Figurative', difficulty: 2,
    q: '"Life is a journey" is an example of:',
    options: ['Simile', 'Metaphor', 'Personification', 'Onomatopoeia'], answer: 1,
    solution: '直接比较不带 like/as → 暗喻 (metaphor)。' },
  { id: 'q18', dim: 'poetry', lesson: 'Sonnet', difficulty: 3,
    q: 'A Shakespearean sonnet has how many lines?',
    options: ['8', '12', '14', '16'], answer: 2,
    solution: '莎士比亚十四行诗：3 个 quatrain + 1 个 couplet = 14 行。' },
  { id: 'q19', dim: 'reading', lesson: 'Irony', difficulty: 3, second: 'literature',
    q: 'A firehouse burning down is an example of:',
    options: ['Verbal irony', 'Situational irony', 'Dramatic irony', 'Metaphor'], answer: 1,
    solution: '情境反讽 (situational irony) — 预期与实际强烈反差。' },
  { id: 'q20', dim: 'writing', lesson: 'Citation (MLA)', difficulty: 2, second: 'grammar',
    q: 'Standard MLA in-text citation format:',
    options: ['(Author Year)', '(Author, page)', '(Author page)', '[page]'], answer: 2,
    solution: 'MLA 格式：(Author page) 无逗号，如 (Smith 23)。' },
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
  id: 'basis-english',
  parentId: 'basis',
  name: '贝赛思英语',
  shortName: '英语',
  icon: '📚',
  color: '#00d4ff',
  gradient: 'linear-gradient(135deg,#00d4ff,#7c4dff)',
  tag: '校本',
  textbook: {
    title: 'BASIS English Literature',
    author: 'BASIS Curriculum',
    grade: 'Grade 6 → 12',
    lessons: 50,
    investigations: 5
  },
  DIMS, QUESTION_BANK, pickAdaptive
}
