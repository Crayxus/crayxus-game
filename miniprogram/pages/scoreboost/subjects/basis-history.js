// 贝赛思历史 BASIS History & Social Science · 6 维度 × 20 题
const DIMS = [
  { key: 'worldHist',    name: '世界史', icon: '🌍', color: '#00d4aa' },
  { key: 'usHist',       name: '美国史', icon: '🗽', color: '#00d4ff' },
  { key: 'geography',    name: '地理',   icon: '🗺', color: '#7c4dff' },
  { key: 'civics',       name: '公民',   icon: '⚖',  color: '#ffd700' },
  { key: 'economicHist', name: '经济史', icon: '💰', color: '#ff9500' },
  { key: 'culture',      name: '文化',   icon: '🏛', color: '#ff6b6b' },
]

const QUESTION_BANK = [
  { id: 'q01', dim: 'worldHist', lesson: 'Ancient Civilizations', difficulty: 1,
    q: 'The "Cradle of Civilization" refers to:',
    options: ['Egypt only', 'Mesopotamia (Tigris-Euphrates)', 'China', 'Greece'], answer: 1,
    solution: '两河流域（美索不达米亚）被称为文明的摇篮。' },
  { id: 'q02', dim: 'worldHist', lesson: 'Renaissance', difficulty: 2,
    q: 'The Renaissance began in:',
    options: ['France', 'Italy', 'England', 'Germany'], answer: 1,
    solution: '14 世纪意大利佛罗伦萨是文艺复兴发源地。' },
  { id: 'q03', dim: 'worldHist', lesson: 'WWII', difficulty: 2,
    q: 'WWII ended primarily in:',
    options: ['1918', '1939', '1945', '1950'], answer: 2,
    solution: '1945 年欧洲战场 5 月结束，太平洋战场 8 月日本投降。' },

  { id: 'q04', dim: 'usHist', lesson: 'Founding', difficulty: 1,
    q: 'The Declaration of Independence was adopted in:',
    options: ['1774', '1776', '1783', '1787'], answer: 1,
    solution: '1776-07-04 《独立宣言》通过。' },
  { id: 'q05', dim: 'usHist', lesson: 'Civil War', difficulty: 2,
    q: 'The Emancipation Proclamation was issued by:',
    options: ['Washington', 'Jefferson', 'Lincoln', 'Grant'], answer: 2,
    solution: '林肯 1863 年《解放奴隶宣言》。' },
  { id: 'q06', dim: 'usHist', lesson: 'Cold War', difficulty: 3,
    q: 'The Cold War primarily involved:',
    options: ['US vs China', 'US vs USSR', 'US vs UK', 'USSR vs China'], answer: 1,
    solution: '冷战主轴：美苏两极对抗（1947–1991）。' },

  { id: 'q07', dim: 'geography', lesson: 'Continents', difficulty: 1,
    q: 'How many continents are there (standard model)?',
    options: ['5', '6', '7', '8'], answer: 2,
    solution: '七大洲：亚/欧/非/北美/南美/大洋/南极。' },
  { id: 'q08', dim: 'geography', lesson: 'Climate', difficulty: 2,
    q: 'The equator has what climate type?',
    options: ['Polar', 'Temperate', 'Tropical', 'Desert'], answer: 2,
    solution: '赤道直射 → 热带气候 (tropical)。' },
  { id: 'q09', dim: 'geography', lesson: 'Rivers', difficulty: 2,
    q: 'The longest river in the world is:',
    options: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], answer: 1,
    solution: '尼罗河（6650 km）通常被列为最长河流，亚马逊河流量最大。' },

  { id: 'q10', dim: 'civics', lesson: 'Branches of Government', difficulty: 1,
    q: 'US federal government has how many branches?',
    options: ['2', '3', '4', '5'], answer: 1,
    solution: '三权分立：立法 (Legislative) / 行政 (Executive) / 司法 (Judicial)。' },
  { id: 'q11', dim: 'civics', lesson: 'Bill of Rights', difficulty: 2,
    q: 'First Amendment protects:',
    options: ['Right to bear arms', 'Freedom of speech/religion/press', 'Due process', 'No quartering of troops'], answer: 1,
    solution: '第一修正案：言论、宗教、出版、集会、请愿自由。' },
  { id: 'q12', dim: 'civics', lesson: 'Checks & Balances', difficulty: 3,
    q: 'The power to declare war belongs to:',
    options: ['President', 'Congress', 'Supreme Court', 'Governors'], answer: 1,
    solution: '美国宪法规定宣战权属国会，总统为武装部队总司令。' },

  { id: 'q13', dim: 'economicHist', lesson: 'Industrial Revolution', difficulty: 2,
    q: 'The Industrial Revolution began in:',
    options: ['France', 'Germany', 'UK', 'USA'], answer: 2,
    solution: '18 世纪后半叶英国率先开启工业革命。' },
  { id: 'q14', dim: 'economicHist', lesson: 'Great Depression', difficulty: 2,
    q: 'The Great Depression started with:',
    options: ['WWI', '1929 stock market crash', 'WWII', 'Oil crisis'], answer: 1,
    solution: '1929-10 华尔街股市崩盘触发大萧条。' },
  { id: 'q15', dim: 'economicHist', lesson: 'Bretton Woods', difficulty: 3,
    q: 'Bretton Woods (1944) established:',
    options: ['EU', 'IMF and World Bank', 'UN', 'WTO'], answer: 1,
    solution: '布雷顿森林会议创立 IMF、世界银行，确立美元-黄金本位。' },

  { id: 'q16', dim: 'culture', lesson: 'Enlightenment', difficulty: 2,
    q: 'Key Enlightenment thinker advocating social contract:',
    options: ['Darwin', 'Locke', 'Einstein', 'Picasso'], answer: 1,
    solution: '洛克《政府论》提出社会契约论，影响美国建国。' },
  { id: 'q17', dim: 'culture', lesson: 'Religion', difficulty: 2,
    q: 'The Protestant Reformation was started by:',
    options: ['Calvin', 'Luther', 'Erasmus', 'Aquinas'], answer: 1,
    solution: '马丁·路德 1517 年《九十五条论纲》引发宗教改革。' },
  { id: 'q18', dim: 'culture', lesson: 'Art Movements', difficulty: 3,
    q: 'Impressionism originated in:',
    options: ['Italy 1500s', 'France 1870s', 'USA 1920s', 'Germany 1930s'], answer: 1,
    solution: '印象派 19 世纪后期法国（莫奈、雷诺阿）。' },
  { id: 'q19', dim: 'worldHist', lesson: 'Decolonization', difficulty: 3, second: 'culture',
    q: 'Indian independence from Britain occurred in:',
    options: ['1776', '1918', '1947', '1965'], answer: 2,
    solution: '1947 年印巴分治，独立。' },
  { id: 'q20', dim: 'civics', lesson: 'Elections', difficulty: 2, second: 'usHist',
    q: 'US presidents serve a term of:',
    options: ['2 years', '4 years', '5 years', '6 years'], answer: 1,
    solution: '美国总统任期 4 年，最多两届（22 修正案）。' },
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
  id: 'basis-history',
  parentId: 'basis',
  name: '贝赛思历史',
  shortName: '历史',
  icon: '🏛',
  color: '#ff6b6b',
  gradient: 'linear-gradient(135deg,#ff6b6b,#ff9500)',
  tag: '校本',
  textbook: {
    title: 'BASIS History & Social Sciences',
    author: 'BASIS Curriculum',
    grade: 'Grade 6 → 12',
    lessons: 54,
    investigations: 6
  },
  DIMS, QUESTION_BANK, pickAdaptive
}
