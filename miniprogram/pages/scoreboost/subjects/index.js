// 科目注册表 —— 支持「组」结构
const ielts = require('./ielts.js')
const toefl = require('./toefl.js')
const ap = require('./ap.js')
const alevel = require('./alevel.js')
const sat = require('./sat.js')

// 贝赛思 6 子学科
const basisMath = require('./basis-math.js')
const basisPhysics = require('./basis-physics.js')
const basisChemistry = require('./basis-chemistry.js')
const basisBiology = require('./basis-biology.js')
const basisEnglish = require('./basis-english.js')
const basisHistory = require('./basis-history.js')

const BASIS_CHILDREN = [basisMath, basisPhysics, basisChemistry, basisBiology, basisEnglish, basisHistory]

// 贝赛思组（顶层展示用）
const basisGroup = {
  id: 'basis',
  name: '贝赛思课程',
  shortName: '贝赛思',
  icon: '🏛',
  color: '#00d4aa',
  gradient: 'linear-gradient(135deg,#00d4aa,#00d4ff 50%,#7c4dff)',
  tag: '校本',
  isGroup: true,
  children: BASIS_CHILDREN.map(s => s.id),
  textbook: {
    title: 'BASIS Curriculum · 6 学科精品课',
    author: 'BASIS Independent',
    grade: 'K-12 全阶段',
    lessons: 300,
    investigations: 36
  }
}

// 顶层 6 科目（UI 展示顺序）
const TOP_SUBJECTS = [ielts, toefl, ap, alevel, basisGroup, sat]

// 所有可测评科目（含贝赛思子学科，不含贝赛思组本身）
const ALL_SUBJECTS = [ielts, toefl, ap, alevel, ...BASIS_CHILDREN, sat]
const ALL_MAP = ALL_SUBJECTS.reduce((m, s) => (m[s.id] = s, m), {})
ALL_MAP['basis'] = basisGroup

function getSubject(id) {
  return ALL_MAP[id] || TOP_SUBJECTS[0]
}

// 顶层列表（首页宫格使用）
function listTopSubjects() {
  return TOP_SUBJECTS.map(s => ({
    id: s.id,
    name: s.name,
    shortName: s.shortName,
    icon: s.icon,
    color: s.color,
    gradient: s.gradient,
    tag: s.tag,
    isGroup: !!s.isGroup,
    textbook: s.textbook
  }))
}

// 贝赛思子学科列表
function listBasisChildren() {
  return BASIS_CHILDREN.map(s => ({
    id: s.id,
    name: s.name,
    shortName: s.shortName,
    icon: s.icon,
    color: s.color,
    gradient: s.gradient,
    tag: s.tag,
    textbook: s.textbook
  }))
}

module.exports = {
  TOP_SUBJECTS,
  ALL_SUBJECTS,
  getSubject,
  listTopSubjects,
  listBasisChildren,
  // 向后兼容
  listSubjects: listTopSubjects
}
