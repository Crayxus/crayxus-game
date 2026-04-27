// 贝赛思生物 BASIS Biology · 6 维度 × 20 题
const DIMS = [
  { key: 'cells',       name: '细胞',     icon: '🧫', color: '#00d4aa' },
  { key: 'genetics',    name: '遗传',     icon: '🧬', color: '#00d4ff' },
  { key: 'evolution',   name: '进化',     icon: '🐒', color: '#7c4dff' },
  { key: 'ecology',     name: '生态',     icon: '🌳', color: '#ffd700' },
  { key: 'physiology',  name: '生理',     icon: '🫀', color: '#ff9500' },
  { key: 'molecular',   name: '分子生物', icon: '🔬', color: '#ff6b6b' },
]

const QUESTION_BANK = [
  { id: 'q01', dim: 'cells', lesson: 'Cell Theory', difficulty: 1,
    q: 'Which organelle is called "powerhouse of the cell"?',
    options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'], answer: 1,
    solution: '线粒体 = 细胞动力工厂，产生 ATP。' },
  { id: 'q02', dim: 'cells', lesson: 'Prokaryote vs Eukaryote', difficulty: 1,
    q: 'Bacteria are:',
    options: ['Eukaryotes', 'Prokaryotes', 'Viruses', 'Fungi'], answer: 1,
    solution: '细菌无核膜 → 原核生物（prokaryote）。' },
  { id: 'q03', dim: 'cells', lesson: 'Cell Membrane', difficulty: 2,
    q: 'The cell membrane is primarily composed of:',
    options: ['Proteins only', 'Phospholipid bilayer', 'Cellulose', 'Carbohydrates'], answer: 1,
    solution: '磷脂双分子层 (fluid mosaic) 是膜的基本结构。' },

  { id: 'q04', dim: 'genetics', lesson: 'Mendel', difficulty: 1,
    q: 'Aa × Aa cross. Ratio of phenotypes (A dominant):',
    options: ['1:1', '3:1', '1:2:1', '9:3:3:1'], answer: 1,
    solution: '单杂交 Aa × Aa → 显性:隐性 = 3:1。' },
  { id: 'q05', dim: 'genetics', lesson: 'DNA Structure', difficulty: 2,
    q: 'In DNA, A pairs with:',
    options: ['G', 'C', 'T', 'U'], answer: 2,
    solution: 'A-T, G-C 互补配对；U 仅存在于 RNA。' },
  { id: 'q06', dim: 'genetics', lesson: 'Sex-linked', difficulty: 3,
    q: 'Hemophilia is X-linked recessive. Carrier mother × normal father → which child at risk?',
    options: ['Daughters only', 'Sons only (50%)', 'All children', 'None'], answer: 1,
    solution: 'XᴴXʰ × XᴴY → 儿子 50% 得病（XʰY），女儿 50% 携带者。' },

  { id: 'q07', dim: 'evolution', lesson: 'Natural Selection', difficulty: 2,
    q: 'Darwin\'s theory of natural selection requires:',
    options: ['All organisms identical', 'Variation + differential survival', 'Rapid mutation', 'Extinction events'], answer: 1,
    solution: '变异 + 选择 + 繁殖传递 → 适应性进化。' },
  { id: 'q08', dim: 'evolution', lesson: 'Speciation', difficulty: 3,
    q: 'Geographic isolation leading to new species:',
    options: ['Sympatric speciation', 'Allopatric speciation', 'Convergent evolution', 'Adaptive radiation'], answer: 1,
    solution: 'Allopatric = 异域物种形成（地理隔离）。' },
  { id: 'q09', dim: 'evolution', lesson: 'Evidence', difficulty: 2,
    q: 'Homologous structures (e.g., whale fin & human arm) suggest:',
    options: ['Common ancestor', 'Convergent evolution', 'Random design', 'No relation'], answer: 0,
    solution: '同源结构揭示共同祖先 (common ancestry)。' },

  { id: 'q10', dim: 'ecology', lesson: 'Food Chains', difficulty: 1,
    q: 'Primary producers are:',
    options: ['Herbivores', 'Plants/autotrophs', 'Top predators', 'Decomposers'], answer: 1,
    solution: '初级生产者 = 自养生物（植物、藻类）。' },
  { id: 'q11', dim: 'ecology', lesson: 'Energy Pyramid', difficulty: 2,
    q: 'Roughly what % of energy transfers between trophic levels?',
    options: ['1%', '10%', '50%', '90%'], answer: 1,
    solution: '10% 定律 — 每营养级约 10% 能量传递。' },
  { id: 'q12', dim: 'ecology', lesson: 'Biodiversity', difficulty: 2,
    q: 'Keystone species is one that:',
    options: ['Most common', 'Has disproportionately large effect', 'Is largest', 'Lives longest'], answer: 1,
    solution: '关键种对生态系统影响远超其数量占比。' },

  { id: 'q13', dim: 'physiology', lesson: 'Heart', difficulty: 1,
    q: 'The heart has how many chambers (human)?',
    options: ['2', '3', '4', '6'], answer: 2,
    solution: '人类心脏 4 腔：2 心房 + 2 心室。' },
  { id: 'q14', dim: 'physiology', lesson: 'Nervous System', difficulty: 2,
    q: 'Neurotransmitter released at neuromuscular junction:',
    options: ['Dopamine', 'Acetylcholine', 'Serotonin', 'GABA'], answer: 1,
    solution: '神经肌接头释放乙酰胆碱 (ACh)。' },
  { id: 'q15', dim: 'physiology', lesson: 'Homeostasis', difficulty: 2,
    q: 'Negative feedback example:',
    options: ['Childbirth (oxytocin)', 'Blood clotting', 'Thermoregulation', 'Action potential'], answer: 2,
    solution: '体温调节是典型负反馈 — 偏离设定点触发纠正机制。' },

  { id: 'q16', dim: 'molecular', lesson: 'Protein Synthesis', difficulty: 2,
    q: 'The process of making RNA from DNA is called:',
    options: ['Translation', 'Transcription', 'Replication', 'Translation'], answer: 1,
    solution: '中心法则：DNA → RNA 叫转录 (transcription)。' },
  { id: 'q17', dim: 'molecular', lesson: 'Enzymes', difficulty: 2,
    q: 'Enzymes speed reactions by:',
    options: ['Raising temperature', 'Lowering activation energy', 'Adding energy', 'Shifting equilibrium'], answer: 1,
    solution: '酶降低活化能 (Ea)，不改变平衡位置。' },
  { id: 'q18', dim: 'molecular', lesson: 'Mutations', difficulty: 3,
    q: 'A point mutation substituting one base for another in a codon may cause:',
    options: ['Always fatal', 'Silent / missense / nonsense', 'Always beneficial', 'Chromosome loss'], answer: 1,
    solution: '点突变：沉默/错义/无义 — 视密码子冗余而定。' },
  { id: 'q19', dim: 'cells', lesson: 'Mitosis vs Meiosis', difficulty: 3, second: 'genetics',
    q: 'Meiosis produces:',
    options: ['2 diploid cells', '4 haploid cells', '2 haploid cells', '4 diploid cells'], answer: 1,
    solution: '减数分裂：1 个母细胞 → 4 个单倍体配子。' },
  { id: 'q20', dim: 'evolution', lesson: 'Hardy-Weinberg', difficulty: 3, second: 'genetics',
    q: 'HWE requires all EXCEPT:',
    options: ['Random mating', 'No selection', 'Large population', 'Rapid mutation'], answer: 3,
    solution: 'HWE 要求"无突变"（quick mutation 违反）。' },
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
  id: 'basis-biology',
  parentId: 'basis',
  name: '贝赛思生物',
  shortName: '生物',
  icon: '🧬',
  color: '#ff9500',
  gradient: 'linear-gradient(135deg,#ff9500,#ffd700)',
  tag: '校本',
  textbook: {
    title: 'BASIS Biology · Cell → Ecology',
    author: 'BASIS Curriculum',
    grade: 'Grade 9 → 12',
    lessons: 48,
    investigations: 6
  },
  DIMS, QUESTION_BANK, pickAdaptive
}
