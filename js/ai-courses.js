/**
 * AI 掼蛋大师 · 课程系统
 *
 * 6 大课程 × 5 节课 × 5 题 = 150 题
 * Duolingo 风格：完成一课解锁下一课
 */

const AICourses = {

  // 课程定义
  COURSES: [
    {
      id: 'decompose',
      name: '组牌分解',
      icon: '🃏',
      color: '#58cc02',
      desc: '学会用最少的手数出完牌',
      lessons: [
        { id: 1, name: '认识牌型', desc: '满手牌的基础判断' },
        { id: 2, name: '初步组牌', desc: '简单手牌的最优分解' },
        { id: 3, name: '顺子优先', desc: '什么时候该凑顺子' },
        { id: 4, name: '连对与钢板', desc: '大组合的识别' },
        { id: 5, name: '三带二策略', desc: '三条+对子的组合技巧' },
        { id: 6, name: '中期组牌', desc: '15张左右的分解' },
        { id: 7, name: '灵活拆牌', desc: '拆牌的取舍判断' },
        { id: 8, name: '多路线分析', desc: '同一手牌的多种走法' },
        { id: 9, name: '进阶分解', desc: '10张牌的精准计算' },
        { id: 10, name: '大师分解', desc: '复杂局面的最优路线' },
      ]
    },
    {
      id: 'power',
      name: '大牌控制',
      icon: '👑',
      color: '#ffc800',
      desc: '掌握大牌的使用时机',
      lessons: [
        { id: 1, name: '大牌认知', desc: 'A、2、王的控制力' },
        { id: 2, name: '小牌压小牌', desc: '节省大牌的基本原则' },
        { id: 3, name: '抢权时机', desc: '什么时候必须出大牌' },
        { id: 4, name: '中局控制', desc: '中期大牌的运用' },
        { id: 5, name: '大牌留守', desc: '保留大牌做防守' },
        { id: 6, name: '压制对手', desc: '用大牌限制对手出牌' },
        { id: 7, name: '牌权争夺', desc: '关键回合的大牌博弈' },
        { id: 8, name: '残局大牌', desc: '少量牌时的大牌使用' },
        { id: 9, name: '王牌策略', desc: '小王大王的高级用法' },
        { id: 10, name: '控场大师', desc: '大牌的极致运用' },
      ]
    },
    {
      id: 'timing',
      name: '出牌时机',
      icon: '⏱️',
      color: '#00bcd4',
      desc: '该出手时出手，该忍时忍',
      lessons: [
        { id: 1, name: '出还是过', desc: '基本的跟牌判断' },
        { id: 2, name: '顺势而为', desc: '利用对手消自己的牌' },
        { id: 3, name: '忍耐的艺术', desc: '什么时候该过牌' },
        { id: 4, name: '主动出击', desc: '抢先出牌的时机' },
        { id: 5, name: '攻防转换', desc: '从防守到进攻' },
        { id: 6, name: '牌型选择', desc: '出哪种牌型最优' },
        { id: 7, name: '中局判断', desc: '中期的出牌决策' },
        { id: 8, name: '读牌出牌', desc: '根据场面判断' },
        { id: 9, name: '节奏掌控', desc: '控制全局出牌节奏' },
        { id: 10, name: '时机大师', desc: '出牌时机的极致把握' },
      ]
    },
    {
      id: 'teamwork',
      name: '队友配合',
      icon: '🤝',
      color: '#e91e63',
      desc: '2V2的精髓在于配合',
      lessons: [
        { id: 1, name: '不压队友', desc: '队友出牌时的基本礼仪' },
        { id: 2, name: '送牌权', desc: '给队友创造出牌机会' },
        { id: 3, name: '接牌技巧', desc: '队友给机会怎么接' },
        { id: 4, name: '帮队友走完', desc: '队友快走完时怎么帮' },
        { id: 5, name: '让路策略', desc: '什么时候让队友先走' },
        { id: 6, name: '读懂信号', desc: '从队友出牌推断意图' },
        { id: 7, name: '联合进攻', desc: '两人配合压制对手' },
        { id: 8, name: '掩护队友', desc: '用大牌为队友开路' },
        { id: 9, name: '默契配合', desc: '高级团队策略' },
        { id: 10, name: '双人大师', desc: '配合的极致境界' },
      ]
    },
    {
      id: 'bomb',
      name: '炸弹使用',
      icon: '💣',
      color: '#ff6b35',
      desc: '炸弹是最强的武器，也最容易浪费',
      lessons: [
        { id: 1, name: '炸弹基础', desc: '什么时候不该用炸弹' },
        { id: 2, name: '防守炸弹', desc: '用炸弹阻止对手走完' },
        { id: 3, name: '进攻炸弹', desc: '用炸弹抢夺牌权' },
        { id: 4, name: '炸弹时机', desc: '最佳炸弹时间点' },
        { id: 5, name: '炸弹留存', desc: '多个炸弹的使用顺序' },
        { id: 6, name: '小炸弹策略', desc: '4张炸弹的灵活使用' },
        { id: 7, name: '大炸弹威慑', desc: '5张以上炸弹的时机' },
        { id: 8, name: '炸弹与牌权', desc: '炸弹后如何出牌' },
        { id: 9, name: '炸弹博弈', desc: '对手也有炸弹时怎么办' },
        { id: 10, name: '炸弹大师', desc: '炸弹的极致运用' },
      ]
    },
    {
      id: 'endgame',
      name: '终局处理',
      icon: '🏁',
      color: '#a78bfa',
      desc: '最后几张牌决定胜负',
      lessons: [
        { id: 1, name: '收尾入门', desc: '12张牌的基础收尾' },
        { id: 2, name: '中期收尾', desc: '10张牌的出牌规划' },
        { id: 3, name: '精准计算', desc: '9张牌的路线选择' },
        { id: 4, name: '对子收尾', desc: '用对子结束战斗' },
        { id: 5, name: '三带二走完', desc: '一手清完的技巧' },
        { id: 6, name: '6张残局', desc: '6张牌的最优路线' },
        { id: 7, name: '5张残局', desc: '关键的5张牌决策' },
        { id: 8, name: '4张残局', desc: '4张牌的精确计算' },
        { id: 9, name: '绝杀收尾', desc: '3张牌的必胜走法' },
        { id: 10, name: '终局大师', desc: '最后2张的极限操作' },
      ]
    },
  ],

  // 进度管理
  progress: {},  // { courseId: { lessonId: { completed: bool, score: int, stars: int } } }

  init() {
    try {
      const saved = localStorage.getItem('crayxus_courses');
      if (saved) this.progress = JSON.parse(saved);
    } catch(e) {}
  },

  save() {
    try {
      localStorage.setItem('crayxus_courses', JSON.stringify(this.progress));
    } catch(e) {}
  },

  getLessonProgress(courseId, lessonId) {
    return this.progress[courseId]?.[lessonId] || { completed: false, score: 0, stars: 0 };
  },

  isLessonUnlocked(courseId, lessonId) {
    if (lessonId === 1) return true;  // First lesson always unlocked
    return this.getLessonProgress(courseId, lessonId - 1).completed;
  },

  completeLesson(courseId, lessonId, score) {
    if (!this.progress[courseId]) this.progress[courseId] = {};
    const stars = score >= 90 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0;
    const prev = this.getLessonProgress(courseId, lessonId);
    this.progress[courseId][lessonId] = {
      completed: true,
      score: Math.max(prev.score, score),
      stars: Math.max(prev.stars, stars),
    };
    this.save();
  },

  getCourseProgress(courseId) {
    const course = this.COURSES.find(c => c.id === courseId);
    if (!course) return 0;
    const completed = course.lessons.filter(l => this.getLessonProgress(courseId, l.id).completed).length;
    return Math.round(completed / course.lessons.length * 100);
  },

  // ===== UI =====

  showCourseList() {
    let coursesHtml = '';
    this.COURSES.forEach(course => {
      const progress = this.getCourseProgress(course.id);
      const completedLessons = course.lessons.filter(l => this.getLessonProgress(course.id, l.id).completed).length;

      coursesHtml += `
        <div style="background:#1b2838;border:2px solid ${course.color}33;border-radius:16px;padding:16px;
          cursor:pointer;transition:all 0.2s"
          onclick="AICourses.showCourse('${course.id}')"
          onmouseenter="this.style.borderColor='${course.color}';this.style.transform='translateY(-2px)'"
          onmouseleave="this.style.borderColor='${course.color}33';this.style.transform='none'">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
            <span style="font-size:28px">${course.icon}</span>
            <div style="flex:1">
              <div style="font-size:15px;font-weight:bold;color:#fff">${course.name}</div>
              <div style="font-size:11px;color:#a0b0c0">${course.desc}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:13px;font-weight:bold;color:${course.color}">${completedLessons}/${course.lessons.length}</div>
            </div>
          </div>
          <div style="height:6px;background:#0f1923;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${progress}%;background:${course.color};border-radius:3px;transition:width 0.3s"></div>
          </div>
        </div>`;
    });

    const totalLessons = this.COURSES.reduce((a, c) => a + c.lessons.length, 0);
    const completedTotal = this.COURSES.reduce((a, c) =>
      a + c.lessons.filter(l => this.getLessonProgress(c.id, l.id).completed).length, 0);

    const html = `<div id="course-panel" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:#0f1923;overflow-y:auto">
      <div style="max-width:600px;margin:0 auto;padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div>
            <div style="font-size:20px;font-weight:bold;color:#fff">📚 课程中心</div>
            <div style="font-size:12px;color:#a0b0c0">完成课程提升你的掼蛋水平</div>
          </div>
          <button onclick="document.getElementById('course-panel').remove()"
            style="background:#1e3148;border:1px solid #2a4a6b;color:#a0b0c0;padding:8px 16px;
            border-radius:8px;cursor:pointer;font-size:13px">返回</button>
        </div>

        <div style="background:#1b2838;padding:12px 16px;border-radius:12px;margin-bottom:20px;
          display:flex;align-items:center;justify-content:space-between">
          <span style="color:#a0b0c0;font-size:13px">总进度</span>
          <span style="color:#58cc02;font-weight:bold">${completedTotal} / ${totalLessons} 课</span>
        </div>

        <div style="display:grid;gap:12px">
          ${coursesHtml}
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  showCourse(courseId) {
    const course = this.COURSES.find(c => c.id === courseId);
    if (!course) return;

    // Remove course list
    const panel = document.getElementById('course-panel');
    if (panel) panel.remove();

    let lessonsHtml = '';
    course.lessons.forEach(lesson => {
      const prog = this.getLessonProgress(courseId, lesson.id);
      const unlocked = this.isLessonUnlocked(courseId, lesson.id);
      const stars = prog.stars;

      const starsHtml = prog.completed ?
        '⭐'.repeat(stars) + '☆'.repeat(3 - stars) :
        '☆☆☆';

      const statusIcon = prog.completed ? '✅' : unlocked ? '🔓' : '🔒';

      lessonsHtml += `
        <div style="display:flex;align-items:center;gap:14px;padding:14px;
          background:${unlocked ? '#1b2838' : '#0f1923'};border-radius:14px;
          border:2px solid ${prog.completed ? course.color + '66' : unlocked ? '#2a4a6b' : '#1a2030'};
          cursor:${unlocked ? 'pointer' : 'not-allowed'};
          opacity:${unlocked ? '1' : '0.5'};transition:all 0.2s"
          onclick="${unlocked ? `AICourses.startLesson('${courseId}', ${lesson.id})` : ''}"
          ${unlocked ? `onmouseenter="this.style.borderColor='${course.color}'" onmouseleave="this.style.borderColor='${prog.completed ? course.color + '66' : '#2a4a6b'}'"` : ''}>
          <div style="font-size:20px;width:32px;text-align:center">${statusIcon}</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:bold;color:${unlocked ? '#fff' : '#555'}">${lesson.name}</div>
            <div style="font-size:11px;color:#a0b0c0">${lesson.desc}</div>
          </div>
          <div style="font-size:14px;letter-spacing:2px">${starsHtml}</div>
        </div>`;
    });

    const html = `<div id="course-panel" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:#0f1923;overflow-y:auto">
      <div style="max-width:600px;margin:0 auto;padding:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <button onclick="document.getElementById('course-panel').remove();AICourses.showCourseList()"
            style="background:#1e3148;border:1px solid #2a4a6b;color:#a0b0c0;padding:6px 12px;
            border-radius:8px;cursor:pointer;font-size:16px">←</button>
          <span style="font-size:28px">${course.icon}</span>
          <div>
            <div style="font-size:18px;font-weight:bold;color:${course.color}">${course.name}</div>
            <div style="font-size:12px;color:#a0b0c0">${course.desc}</div>
          </div>
        </div>

        <div style="display:grid;gap:10px">
          ${lessonsHtml}
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  async startLesson(courseId, lessonId) {
    // Load questions for this lesson
    const panel = document.getElementById('course-panel');
    if (panel) panel.remove();

    // Try to load course questions
    let questions = [];
    try {
      const resp = await fetch(`/js/course-${courseId}.json`);
      const data = await resp.json();
      questions = data.lessons?.[lessonId] || [];
    } catch(e) {
      console.warn('Course data not found, using quiz fallback');
    }

    if (questions.length === 0) {
      // Fallback: use general quiz questions filtered by dimension
      if (typeof AIQuiz !== 'undefined') {
        if (!AIQuiz.loaded) await AIQuiz.loadQuestions();
        const dimMap = {
          'decompose': '组牌分解', 'power': '大牌控制', 'timing': '出牌时机',
          'teamwork': '队友配合', 'bomb': '炸弹使用', 'endgame': '终局处理'
        };
        const dim = dimMap[courseId];
        questions = AIQuiz.questions.filter(q => q.dim === dim);
        if (questions.length === 0) questions = AIQuiz.questions.slice(0, 5);
      }
    }

    if (questions.length === 0) {
      if (typeof toast === 'function') toast('课程题目加载中，请稍后再试');
      return;
    }

    // Run lesson quiz
    this._runLesson(courseId, lessonId, questions.slice(0, 5));
  },

  _runLesson(courseId, lessonId, questions) {
    const course = this.COURSES.find(c => c.id === courseId);
    const lesson = course.lessons.find(l => l.id === lessonId);

    // Use AIQuiz engine to run the questions
    if (typeof AIQuiz !== 'undefined') {
      // Override quiz questions temporarily
      const origQuestions = AIQuiz.questions;
      AIQuiz.questions = questions;

      // Override results to show lesson completion
      const origShowResults = AIQuiz._showResults.bind(AIQuiz);
      AIQuiz._showResults = () => {
        const total = AIQuiz.answers.length;
        const correct = AIQuiz.answers.filter(a => a.correct).length;
        const score = Math.round(correct / total * 100);
        const stars = score >= 90 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0;

        this.completeLesson(courseId, lessonId, score);

        // Show lesson result
        const old = document.getElementById('quiz-panel');
        if (old) old.remove();

        const html = `<div id="quiz-panel" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
          background:#0f1923;display:flex;align-items:center;justify-content:center">
          <div style="background:#1b2838;border:2px solid ${course.color};border-radius:20px;padding:32px;
            max-width:400px;width:90%;text-align:center">
            <div style="font-size:48px;margin-bottom:12px">${stars >= 2 ? '🎉' : stars >= 1 ? '👍' : '💪'}</div>
            <div style="font-size:20px;font-weight:bold;color:#fff;margin-bottom:4px">
              ${stars >= 2 ? '太棒了！' : stars >= 1 ? '不错！' : '继续努力！'}
            </div>
            <div style="font-size:14px;color:#a0b0c0;margin-bottom:16px">${lesson.name} · ${correct}/${total} 正确</div>
            <div style="font-size:32px;letter-spacing:4px;margin-bottom:20px">
              ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}
            </div>
            <div style="display:flex;gap:8px">
              <button onclick="document.getElementById('quiz-panel').remove();AICourses.showCourse('${courseId}')"
                style="flex:1;padding:12px;background:#1e3148;color:#a0b0c0;border:1px solid #2a4a6b;
                border-radius:10px;cursor:pointer;font-size:13px">返回课程</button>
              ${this.isLessonUnlocked(courseId, lessonId + 1) ? `
              <button onclick="document.getElementById('quiz-panel').remove();AICourses.startLesson('${courseId}', ${lessonId + 1})"
                style="flex:1;padding:12px;background:${course.color};color:#0f1923;border:none;
                border-radius:10px;font-weight:bold;cursor:pointer;font-size:13px">下一课 →</button>` : `
              <button onclick="document.getElementById('quiz-panel').remove();AICourses.startLesson('${courseId}', ${lessonId})"
                style="flex:1;padding:12px;background:${course.color};color:#0f1923;border:none;
                border-radius:10px;font-weight:bold;cursor:pointer;font-size:13px">再试一次</button>`}
            </div>
          </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);

        // Restore
        AIQuiz.questions = origQuestions;
        AIQuiz._showResults = origShowResults;
      };

      AIQuiz.currentQ = 0;
      AIQuiz.answers = [];
      AIQuiz.dimScores = {};
      AIQuiz.dimensions.forEach(d => AIQuiz.dimScores[d] = { total: 0, correct: 0 });
      AIQuiz._renderQuestion();
    }
  },
};

if (typeof window !== 'undefined') {
  window.AICourses = AICourses;
  document.addEventListener('DOMContentLoaded', () => AICourses.init());
}
