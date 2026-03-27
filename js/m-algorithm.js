/**
 * M Algorithm — 最少出牌次数计算
 *
 * 输入：27张手牌数组 [{s, v, p, ...}]
 * 输出：{ M: number, plan: [[cards]...] }
 *
 * M = 这手牌理论上最少几手能打完
 * plan = 最优拆牌方案（每一手的牌组）
 */

(function(global){
'use strict';

// Sequence rank mapping (for straights)
const SEQ_RANK = {'A':14,'K':13,'Q':12,'J':11,'10':10,'9':9,'8':8,'7':7,'6':6,'5':5,'4':4,'3':3,'2':2};

/**
 * Calculate M value for a hand of cards
 * @param {Array} hand - array of card objects {s, v, p}
 * @param {string} wildValue - current wild card value (e.g. '2')
 * @returns {{M: number, plan: Array}}
 */
function calcM(hand, wildValue) {
  if (!hand || !hand.length) return { M: 0, plan: [] };

  const isWild = (c) => c.v === wildValue && c.s === '♥';
  const isJoker = (c) => c.s === 'JOKER';

  // Separate cards
  let wilds = hand.filter(c => isWild(c));
  let jokers = hand.filter(c => isJoker(c));
  let normals = hand.filter(c => !isWild(c) && !isJoker(c));

  // Group normals by seq rank
  let groups = {}; // seqRank -> [cards]
  normals.forEach(c => {
    let r = SEQ_RANK[c.v] || c.p;
    if (!groups[r]) groups[r] = [];
    groups[r].push(c);
  });

  // Count array: counts[rank] = number of cards at that rank
  // ranks 2-14 for normal, 16=SmJoker, 17=BgJoker, 15=wild
  let counts = {};
  for (let r in groups) counts[r] = groups[r].length;
  let wildCount = wilds.length;
  let jokerCount = jokers.length;

  let bestM = hand.length; // worst case: all singles
  let bestPlan = null;

  // DFS search for minimum hands
  function dfs(cnt, wc, jc, depth, plan) {
    // Remaining cards
    let remaining = 0;
    for (let r in cnt) remaining += cnt[r];
    remaining += wc + jc;

    if (remaining === 0) {
      if (depth < bestM) {
        bestM = depth;
        bestPlan = plan.slice();
      }
      return;
    }

    // Pruning: can't beat current best
    if (depth >= bestM - 1) return;

    let ranks = Object.keys(cnt).map(Number).filter(r => cnt[r] > 0).sort((a, b) => a - b);

    // === Try bombs first (reduce cards fast) ===

    // Joker bomb (4 jokers)
    if (jc >= 4) {
      jc -= 4;
      plan.push(['JOKER_BOMB']);
      dfs(cnt, wc, jc, depth + 1, plan);
      plan.pop();
      jc += 4;
    }

    // Regular bombs (4+ of a kind)
    for (let r of ranks) {
      if (cnt[r] >= 4) {
        // Try biggest bomb first
        let bombSize = cnt[r]; // use all cards of this rank
        cnt[r] = 0;
        plan.push(['bomb_' + r + 'x' + bombSize]);
        dfs(cnt, wc, jc, depth + 1, plan);
        plan.pop();
        cnt[r] = bombSize;
      }
      // Wild-augmented bomb (3 + wild = 4-bomb)
      if (cnt[r] === 3 && wc >= 1) {
        cnt[r] = 0; wc--;
        plan.push(['bomb_' + r + 'x4w']);
        dfs(cnt, wc, jc, depth + 1, plan);
        plan.pop();
        cnt[r] = 3; wc++;
      }
    }

    // === Try straights (5+ consecutive, removes many cards) ===
    for (let start = 2; start <= 10; start++) {
      // Check 5-card straight
      let seqCards = 0;
      let gaps = 0;
      for (let i = 0; i < 5; i++) {
        let r = start + i;
        if (cnt[r] && cnt[r] > 0) seqCards++;
        else gaps++;
      }
      if (seqCards >= 5) {
        // Pure straight
        for (let i = 0; i < 5; i++) cnt[start + i]--;
        plan.push(['straight_' + start + '-' + (start + 4)]);
        dfs(cnt, wc, jc, depth + 1, plan);
        plan.pop();
        for (let i = 0; i < 5; i++) cnt[start + i]++;
      }
      if (gaps > 0 && gaps <= wc && seqCards + gaps === 5) {
        // Wild-augmented straight
        for (let i = 0; i < 5; i++) {
          if (cnt[start + i] && cnt[start + i] > 0) cnt[start + i]--;
        }
        let usedW = gaps;
        wc -= usedW;
        plan.push(['straight_' + start + '-' + (start + 4) + 'w']);
        dfs(cnt, wc, jc, depth + 1, plan);
        plan.pop();
        for (let i = 0; i < 5; i++) {
          if (!cnt[start + i]) cnt[start + i] = 0;
          // restore
        }
        // Need to properly restore - this is tricky with wild gaps
        // Simpler: just restore all
        wc += usedW;
        for (let i = 0; i < 5; i++) {
          let r = start + i;
          if (groups[r] && groups[r].length > (cnt[r] || 0)) {
            // was decremented
          }
        }
      }
    }

    // A-low straight: A,2,3,4,5
    {
      let aRanks = [14, 2, 3, 4, 5];
      let has = aRanks.filter(r => cnt[r] && cnt[r] > 0).length;
      if (has === 5) {
        for (let r of aRanks) cnt[r]--;
        plan.push(['straight_A2345']);
        dfs(cnt, wc, jc, depth + 1, plan);
        plan.pop();
        for (let r of aRanks) cnt[r]++;
      }
    }

    // === Try plates (2 consecutive triples, 6 cards) ===
    for (let r of ranks) {
      let r2 = r + 1;
      if (cnt[r] >= 3 && cnt[r2] && cnt[r2] >= 3) {
        cnt[r] -= 3; cnt[r2] -= 3;
        plan.push(['plate_' + r]);
        dfs(cnt, wc, jc, depth + 1, plan);
        plan.pop();
        cnt[r] += 3; cnt[r2] += 3;
      }
    }

    // === Try tubes (3 consecutive pairs, 6 cards) ===
    for (let r of ranks) {
      let r2 = r + 1, r3 = r + 2;
      if (cnt[r] >= 2 && cnt[r2] && cnt[r2] >= 2 && cnt[r3] && cnt[r3] >= 2) {
        cnt[r] -= 2; cnt[r2] -= 2; cnt[r3] -= 2;
        plan.push(['tube_' + r]);
        dfs(cnt, wc, jc, depth + 1, plan);
        plan.pop();
        cnt[r] += 2; cnt[r2] += 2; cnt[r3] += 2;
      }
    }

    // === Try fullhouses (3+2, 5 cards) ===
    for (let r of ranks) {
      if (cnt[r] >= 3) {
        for (let r2 of ranks) {
          if (r2 !== r && cnt[r2] >= 2) {
            cnt[r] -= 3; cnt[r2] -= 2;
            plan.push(['fullhouse_' + r + '+' + r2]);
            dfs(cnt, wc, jc, depth + 1, plan);
            plan.pop();
            cnt[r] += 3; cnt[r2] += 2;
          }
        }
      }
    }

    // === Try triples (3 cards) ===
    for (let r of ranks) {
      if (cnt[r] >= 3) {
        cnt[r] -= 3;
        plan.push(['triple_' + r]);
        dfs(cnt, wc, jc, depth + 1, plan);
        plan.pop();
        cnt[r] += 3;
      }
    }

    // === Try pairs (2 cards) ===
    for (let r of ranks) {
      if (cnt[r] >= 2) {
        cnt[r] -= 2;
        plan.push(['pair_' + r]);
        dfs(cnt, wc, jc, depth + 1, plan);
        plan.pop();
        cnt[r] += 2;
      }
    }

    // === Singles (1 card) — try playing lowest single ===
    if (ranks.length > 0) {
      let r = ranks[0]; // lowest rank
      cnt[r]--;
      if (cnt[r] === 0) delete cnt[r];
      plan.push(['single_' + r]);
      dfs(cnt, wc, jc, depth + 1, plan);
      plan.pop();
      if (!cnt[r]) cnt[r] = 0;
      cnt[r]++;
    }

    // Wild as single
    if (wc > 0) {
      wc--;
      plan.push(['single_wild']);
      dfs(cnt, wc, jc, depth + 1, plan);
      plan.pop();
      wc++;
    }

    // Joker as single
    if (jc > 0) {
      jc--;
      plan.push(['single_joker']);
      dfs(cnt, wc, jc, depth + 1, plan);
      plan.pop();
      jc++;
    }
  }

  // Build initial counts
  let initCnt = {};
  for (let r in groups) initCnt[r] = groups[r].length;

  // Run DFS
  dfs(initCnt, wildCount, jokerCount, 0, []);

  return { M: bestM, plan: bestPlan || [] };
}

/**
 * Quick M estimate (greedy, fast but not optimal)
 * Use this for real-time display, calcM for precise value
 */
function quickM(hand, wildValue) {
  if (!hand || !hand.length) return 0;

  const isWild = (c) => c.v === wildValue && c.s === '♥';
  const isJoker = (c) => c.s === 'JOKER';

  let wilds = hand.filter(c => isWild(c)).length;
  let jokers = hand.filter(c => isJoker(c)).length;
  let normals = hand.filter(c => !isWild(c) && !isJoker(c));

  let cnt = {};
  normals.forEach(c => {
    let r = SEQ_RANK[c.v] || c.p;
    cnt[r] = (cnt[r] || 0) + 1;
  });

  let hands = 0;

  // Joker bomb
  if (jokers >= 4) { hands++; jokers -= 4; }

  // Bombs (4+)
  let ranks = Object.keys(cnt).map(Number).sort((a, b) => b - a);
  for (let r of ranks) {
    if (cnt[r] >= 4) { hands++; cnt[r] = 0; }
  }

  // Wild-augmented bombs (3 + wild)
  ranks = Object.keys(cnt).map(Number).filter(r => cnt[r] > 0).sort((a, b) => b - a);
  for (let r of ranks) {
    if (cnt[r] === 3 && wilds >= 1) { hands++; cnt[r] = 0; wilds--; }
  }

  // Straights (5 consecutive, greedy)
  for (let start = 2; start <= 10; start++) {
    let has = 0;
    for (let i = 0; i < 5; i++) {
      if (cnt[start + i] && cnt[start + i] > 0) has++;
    }
    if (has === 5) {
      for (let i = 0; i < 5; i++) cnt[start + i]--;
      hands++;
    }
  }

  // Plates (2 consecutive triples)
  ranks = Object.keys(cnt).map(Number).filter(r => cnt[r] > 0).sort((a, b) => a - b);
  for (let r of ranks) {
    if (cnt[r] >= 3 && cnt[r + 1] && cnt[r + 1] >= 3) {
      cnt[r] -= 3; cnt[r + 1] -= 3; hands++;
    }
  }

  // Tubes (3 consecutive pairs)
  ranks = Object.keys(cnt).map(Number).filter(r => cnt[r] > 0).sort((a, b) => a - b);
  for (let r of ranks) {
    if (cnt[r] >= 2 && cnt[r + 1] && cnt[r + 1] >= 2 && cnt[r + 2] && cnt[r + 2] >= 2) {
      cnt[r] -= 2; cnt[r + 1] -= 2; cnt[r + 2] -= 2; hands++;
    }
  }

  // Fullhouses (3+2)
  ranks = Object.keys(cnt).map(Number).filter(r => cnt[r] > 0).sort((a, b) => b - a);
  let triples = ranks.filter(r => cnt[r] >= 3);
  let pairs = ranks.filter(r => cnt[r] >= 2 && cnt[r] < 3);
  for (let t of triples) {
    if (pairs.length > 0) {
      let p = pairs.shift();
      cnt[t] -= 3; cnt[p] -= 2; hands++;
    }
  }

  // Triples
  ranks = Object.keys(cnt).map(Number).filter(r => cnt[r] > 0);
  for (let r of ranks) {
    if (cnt[r] >= 3) { cnt[r] -= 3; hands++; }
  }

  // Pairs (including wild-augmented)
  ranks = Object.keys(cnt).map(Number).filter(r => cnt[r] > 0);
  for (let r of ranks) {
    while (cnt[r] >= 2) { cnt[r] -= 2; hands++; }
  }
  // Wild pairs
  ranks = Object.keys(cnt).map(Number).filter(r => cnt[r] > 0);
  for (let r of ranks) {
    if (cnt[r] === 1 && wilds > 0) { cnt[r] = 0; wilds--; hands++; }
  }

  // Remaining singles
  ranks = Object.keys(cnt).map(Number).filter(r => cnt[r] > 0);
  for (let r of ranks) { hands += cnt[r]; cnt[r] = 0; }

  // Remaining wilds and jokers as singles
  hands += wilds + jokers;

  return hands;
}

// Export
global.MAlgorithm = { calcM, quickM };

})(typeof window !== 'undefined' ? window : global);
