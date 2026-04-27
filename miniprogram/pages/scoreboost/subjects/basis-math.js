// 贝赛思数学 (BASIS Math) · 基于 Saxon Math Intermediate 4
const { DIMS, QUESTION_BANK, pickAdaptive } = require('../questions.js')

module.exports = {
  id: 'basis-math',
  name: '贝赛思数学',
  shortName: '贝赛思',
  icon: '🔢',
  color: '#00d4aa',
  gradient: 'linear-gradient(135deg,#00d4aa,#00b894)',
  tag: '校本',
  textbook: {
    title: 'Saxon Math Intermediate 4',
    author: 'Stephen Hake',
    grade: 'Grade 4',
    lessons: 120,
    investigations: 12
  },
  DIMS,
  QUESTION_BANK,
  pickAdaptive
}
