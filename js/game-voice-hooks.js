/**
 * Game Voice Hooks — Connect VoiceSystem to game events
 * =====================================================
 * Hooks into socket.io events and game functions to trigger
 * voice lines, sound effects, and dynamic commentary.
 *
 * Load AFTER: voice-system.js, socket.io connection
 */

const GameVoiceHooks = (function() {

  let hooked = false;
  let lastTurnTime = 0;
  let idleTimer = null;

  // Hand type → voice key mapping
  const HAND_TYPE_VOICE = {
    '单牌': 'play_single',
    '对子': 'play_pair',
    '三条': 'play_triple',
    '顺子': 'play_straight',
    '连对': 'play_double_straight',
    '钢板': 'play_steel_plate',
    '三带二': 'play_full_house',
    '炸弹': 'play_bomb',
    '王炸': 'play_rocket',
    '同花顺': 'play_flush',
  };

  // Hand type → sfx mapping
  const HAND_TYPE_SFX = {
    '炸弹': 'bomb',
    '王炸': 'rocket',
    '同花顺': 'bomb',
  };

  function init() {
    if (hooked) return;
    if (typeof VoiceSystem === 'undefined') return;

    VoiceSystem.init();

    // Hook socket events
    if (typeof socket !== 'undefined') {
      hookSocketEvents(socket);
    } else {
      // Wait for socket
      const check = setInterval(() => {
        if (typeof socket !== 'undefined') {
          hookSocketEvents(socket);
          clearInterval(check);
        }
      }, 500);
      // Give up after 10s
      setTimeout(() => clearInterval(check), 10000);
    }

    // Start idle timer
    resetIdleTimer();

    hooked = true;
    console.log('[GameVoice] Hooks initialized');
  }

  function hookSocketEvents(sock) {

    // ── Deal cards ──
    sock.on('dealCards', (d) => {
      VoiceSystem.sfx('deal');
      setTimeout(() => {
        VoiceSystem.say('dealing_done');
        // Evaluate hand quality after a delay
        setTimeout(() => evaluateHand(), 1500);
      }, 800);
    });

    // ── Game start ──
    sock.on('gameStart', (d) => {
      VoiceSystem.say('game_start');
    });

    // ── Main game action sync ──
    sock.on('syncAction', (d) => {
      resetIdleTimer();
      handleSyncAction(d);
    });

    // ── Tribute ──
    sock.on('tributeAction', (d) => {
      VoiceSystem.say('tribute_start');
    });

    sock.on('tributeComplete', (d) => {
      VoiceSystem.say('tribute_done');
    });
  }

  function handleSyncAction(d) {
    const isMe = (typeof mySeat !== 'undefined') && d.seat === mySeat;
    const isTeammate = (typeof mySeat !== 'undefined') && (d.seat % 2 === mySeat % 2) && !isMe;
    const isOpponent = !isMe && !isTeammate;

    // ── Someone played cards ──
    if (d.type === 'play') {
      const handType = d.handType || '';

      // Sound effect
      const sfxType = HAND_TYPE_SFX[handType];
      if (sfxType) {
        VoiceSystem.sfx(sfxType);
      } else {
        VoiceSystem.sfx('play_card');
      }

      // Voice for bombs (special treatment)
      if (handType === '炸弹' || handType === '王炸' || handType === '同花顺') {
        setTimeout(() => {
          if (isMe) VoiceSystem.say('bomb_played_by_me');
          else if (isTeammate) VoiceSystem.say('bomb_played_by_teammate');
          else VoiceSystem.say('bomb_played_by_opponent');
        }, 300);
      }
      // Voice for nice plays (occasionally, don't spam)
      else if (isMe && Math.random() < 0.3) {
        setTimeout(() => VoiceSystem.say('play_nice'), 400);
      }
    }

    // ── Someone passed ──
    if (d.type === 'pass') {
      VoiceSystem.sfx('pass');
      if (isTeammate && Math.random() < 0.3) {
        VoiceSystem.say('pass_teammate');
      } else if (isOpponent && Math.random() < 0.2) {
        VoiceSystem.say('pass_opponent');
      }
    }

    // ── Round end (someone won the round) ──
    if (d.isRoundEnd) {
      if (isMe) {
        VoiceSystem.say('round_win');
      }
    }

    // ── Someone finished (played all cards) ──
    if (d.finishOrder && d.finishOrder.length > 0) {
      const justFinished = d.finishOrder[d.finishOrder.length - 1];
      if (typeof mySeat !== 'undefined') {
        if (justFinished % 2 === mySeat % 2 && justFinished !== mySeat) {
          setTimeout(() => VoiceSystem.say('teammate_finish'), 500);
        } else if (justFinished % 2 !== mySeat % 2) {
          setTimeout(() => VoiceSystem.say('opponent_finish'), 500);
        }
      }
    }

    // ── Game end detection ──
    if (d.finishOrder && d.finishOrder.length >= 3) {
      setTimeout(() => handleGameEnd(d), 1000);
    }

    // ── Your turn notification ──
    if (d.nextTurn !== undefined && typeof mySeat !== 'undefined' && d.nextTurn === mySeat) {
      setTimeout(() => {
        VoiceSystem.sfx('turn');
        // Check if free play or must follow
        const isFree = d.isRoundEnd || !d.lastHand;
        if (isFree) {
          VoiceSystem.say('your_turn_free');
        } else {
          VoiceSystem.say('your_turn');
        }
      }, 600);
    }
  }

  function handleGameEnd(d) {
    if (typeof mySeat === 'undefined') return;

    const order = d.finishOrder || [];
    const myTeam = mySeat % 2;

    // Check if my team won (first finisher is on my team)
    const firstSeat = order[0];
    const myTeamWon = firstSeat % 2 === myTeam;

    // Check double win/loss
    const topTwo = order.slice(0, 2);
    const doubleWin = topTwo.every(s => s % 2 === myTeam);
    const doubleLoss = topTwo.every(s => s % 2 !== myTeam);

    if (myTeamWon) {
      if (doubleWin) {
        VoiceSystem.sfx('win');
        VoiceSystem.say('win_double');
      } else {
        VoiceSystem.sfx('win');
        VoiceSystem.say('win');
      }
    } else {
      if (doubleLoss) {
        VoiceSystem.sfx('lose');
        VoiceSystem.say('lose_double');
      } else {
        VoiceSystem.sfx('lose');
        VoiceSystem.say('lose');
      }
    }
  }

  // ── Hand evaluation (after dealing) ──

  function evaluateHand() {
    if (typeof myCards === 'undefined' || !myCards || myCards.length === 0) return;

    const cards = myCards;

    // Check for rockets (big + small joker)
    const bigJoker = cards.some(c => c.s === 'JOKER' && c.v === 'Bg');
    const smallJoker = cards.some(c => c.s === 'JOKER' && c.v === 'Sm');
    if (bigJoker && smallJoker) {
      VoiceSystem.say('hand_rocket');
      return;
    }

    // Check for bombs (4+ of same value)
    const valueCounts = {};
    cards.forEach(c => {
      if (c.s !== 'JOKER') {
        valueCounts[c.v] = (valueCounts[c.v] || 0) + 1;
      }
    });
    const hasBomb = Object.values(valueCounts).some(cnt => cnt >= 4);
    if (hasBomb) {
      VoiceSystem.say('hand_bomb');
      return;
    }

    // Count high cards (A, 2, Jokers)
    let highCards = 0;
    cards.forEach(c => {
      if (c.s === 'JOKER') highCards += 2;
      else if (c.v === 'A' || c.v === '2' || c.v === 14 || c.v === 15) highCards++;
    });

    if (highCards >= 6) VoiceSystem.say('hand_great');
    else if (highCards >= 4) VoiceSystem.say('hand_good');
    else if (highCards >= 2) VoiceSystem.say('hand_ok');
    else VoiceSystem.say('hand_bad');
  }

  // ── Idle detection ──

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (typeof VoiceSystem !== 'undefined' && VoiceSystem.enabled) {
        VoiceSystem.say('idle');
      }
    }, 120000); // 2 minutes idle
  }

  // ── Teaching hooks ──

  function readQuestion(question) {
    if (typeof VoiceSystem === 'undefined') return;

    let text = '';

    // Scenario
    if (question.scenario) {
      text += question.scenario + '。';
    }

    // Describe hand briefly
    if (question.hand && question.hand.length > 0) {
      text += '你的手牌有' + question.hand.length + '张牌。';
    }

    // Question
    text += question.question || '你会怎么出牌？';

    VoiceSystem.speak(text);
  }

  function readExplanation(text) {
    if (typeof VoiceSystem === 'undefined') return;
    VoiceSystem.say('quiz_explain');
    setTimeout(() => VoiceSystem.speak(text), 1500);
  }

  function onQuizCorrect() {
    if (typeof VoiceSystem === 'undefined') return;
    VoiceSystem.sfx('win');
    VoiceSystem.say('quiz_correct');
  }

  function onQuizWrong() {
    if (typeof VoiceSystem === 'undefined') return;
    VoiceSystem.sfx('error');
    VoiceSystem.say('quiz_wrong');
  }

  // ── Init ──
  return {
    init,
    readQuestion,
    readExplanation,
    onQuizCorrect,
    onQuizWrong,
    evaluateHand,
  };

})();

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to let other systems load
  setTimeout(() => GameVoiceHooks.init(), 1000);
});
