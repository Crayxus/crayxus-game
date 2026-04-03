/**
 * DanDan Chat — 豆包大模型驱动的智能对话
 * ==========================================
 * 用户说话 → 语音识别 → 豆包API → 蛋蛋语音回复 + 字幕
 *
 * 命令优先：识别到"出牌""过"等指令直接执行，不走大模型
 * 对话兜底：其他内容发给豆包，蛋蛋用人格化方式回复
 */

const DanDanChat = (function() {

  // 豆包API配置
  const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
  const API_KEY = '9fb81ccb-ed98-496e-8819-7f6ee7c54abb';
  const MODEL = 'doubao-1-5-pro-32k-250115';

  // 对话历史（保留最近10轮，控制token）
  let history = [];
  const MAX_HISTORY = 10;

  // 蛋蛋的人格提示词
  const SYSTEM_PROMPT = `你是"蛋蛋"，一个可爱、专业的AI掼蛋助手。你住在一台掼蛋智能一体机里。

你的性格：
- 热情友好，像一个耐心的朋友
- 说话简短有趣，不超过3句话
- 偶尔用掼蛋术语开玩笑
- 鼓励用户，永远不嘲笑

你的能力：
- 掼蛋规则和策略专家（牌型、出牌时机、队友配合、炸弹使用、终局处理）
- 可以解释M值（最少出牌次数）、Power值（手牌控制力）等AI概念
- 熟悉段位系统（青铜到掼蛋大师13个等级）
- 了解蛋力学院的6门课程

你不能做的：
- 不讨论与掼蛋无关的政治、敏感话题
- 不假装是人类，你就是AI蛋蛋

当前状态：
- AI模型版本：V8，vs冠军胜率53.5%
- 段位测评：20题6维度评估

动作指令：
当用户想执行以下操作时，在回复末尾加上对应标签（用户看不到标签，系统会自动执行）：
- 用户想开始对战 → 回复后加 [ACTION:START_GAME]
- 用户想做段位测评 → 回复后加 [ACTION:START_QUIZ]
- 用户想学习课程 → 回复后加 [ACTION:START_COURSE]
- 用户想看演示/教程 → 回复后加 [ACTION:START_DEMO]
- 用户想看赛事 → 回复后加 [ACTION:SHOW_TOURNAMENT]

示例：
用户："我想打一局" → "好的，马上给你安排一局！[ACTION:START_GAME]"
用户："帮我测一下段位" → "没问题，开始段位测评！[ACTION:START_QUIZ]"
用户："教我打掼蛋" → "好的，带你去蛋力学院！[ACTION:START_COURSE]"
用户："这个怎么玩" → "我来给你演示一遍！[ACTION:START_DEMO]"

回复要求：
- 纯文本，不用markdown
- 不超过50个字（非常重要！因为要语音朗读）
- 标签不算在字数内
- 用中文回复`;

  let isProcessing = false;

  // ── 核心：发送对话到豆包 ──

  async function chat(userText) {
    if (isProcessing) return;
    if (!userText || userText.trim().length === 0) return;

    isProcessing = true;

    // 加入历史
    history.push({ role: 'user', content: userText });
    if (history.length > MAX_HISTORY * 2) {
      history = history.slice(-MAX_HISTORY * 2);
    }

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history,
          ],
          max_tokens: 100,
          temperature: 0.8,
        }),
      });

      if (!resp.ok) {
        console.warn('[DanDanChat] API error:', resp.status);
        isProcessing = false;
        return _fallbackReply(userText);
      }

      const data = await resp.json();
      const reply = data.choices?.[0]?.message?.content || '';

      if (!reply) {
        isProcessing = false;
        return _fallbackReply(userText);
      }

      // 提取并执行动作标签
      const action = _extractAction(reply);
      const cleanReply = reply.replace(/\[ACTION:\w+\]/g, '').trim();

      // 加入历史
      history.push({ role: 'assistant', content: cleanReply });

      // 语音播报 + 字幕（不显示标签）
      _speak(cleanReply);

      // 延迟执行动作（等语音说完再跳转）
      if (action) {
        const delay = cleanReply.length * 150 + 500;
        setTimeout(() => _executeAction(action), delay);
      }

      isProcessing = false;
      return cleanReply;

    } catch(e) {
      console.warn('[DanDanChat] Error:', e);
      isProcessing = false;
      return _fallbackReply(userText);
    }
  }

  // ── 语音播报 ──

  function _speak(text) {
    // 显示字幕
    const el = document.getElementById('dd-speech');
    if (el) {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.15s';
      setTimeout(() => {
        el.textContent = text;
        el.style.opacity = '1';
      }, 150);
    }

    // 悬浮面板字幕
    const fabSpeech = document.getElementById('fab-speech');
    if (fabSpeech) fabSpeech.textContent = text;

    // 语音朗读
    if (typeof VoiceSystem !== 'undefined') {
      VoiceSystem.speak(text);
    }
  }

  // ── 离线/失败时的兜底回复 ──

  function _fallbackReply(userText) {
    const fallbacks = [
      '网络不太好，等会再试试',
      '蛋蛋暂时听不清，你再说一遍',
      '要不先来一局掼蛋？',
    ];
    const reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    _speak(reply);
    return reply;
  }

  // ── 判断是否是闲聊（非指令） ──

  function isConversation(text) {
    // 这些是指令，不走大模型
    const commands = ['出牌', '打牌', '过', '不要', '不出', '提示', '帮我',
                      '看看', '教练', '分析', '开始', '开局', '来一局', '整理', '理牌'];
    for (const cmd of commands) {
      if (text.includes(cmd)) return false;
    }
    return true;
  }

  // ── 动作标签解析与执行 ──

  function _extractAction(text) {
    const match = text.match(/\[ACTION:(\w+)\]/);
    return match ? match[1] : null;
  }

  function _executeAction(action) {
    console.log('[DanDanChat] Executing action:', action);
    switch(action) {
      case 'START_GAME':
        if (typeof selectMode === 'function') selectMode('casual');
        break;
      case 'START_QUIZ':
        if (typeof AITraining !== 'undefined') AITraining.showAssessmentIntro();
        break;
      case 'START_COURSE':
        // 打开蛋力学院
        if (typeof AITraining !== 'undefined') AITraining.showAssessmentIntro();
        break;
      case 'START_DEMO':
        if (typeof Demo !== 'undefined') Demo.start();
        break;
      case 'SHOW_TOURNAMENT':
        window.location.href = '/tournament';
        break;
    }
  }

  // ── 清空历史 ──

  function clearHistory() {
    history = [];
  }

  return {
    chat,
    isConversation,
    clearHistory,
    get isProcessing() { return isProcessing; },
  };

})();
