// replay-engine.js — State reconstruction engine for post-game review
// Reconstructs complete game state at each decision point from replay JSON

(function(exports) {
'use strict';

const G = exports.GL;

class ReplayEngine {
  constructor(replayData) {
    this.data = replayData;
    this.wildValue = replayData.wildValue || '2';
    G.setWildValue(this.wildValue);

    // Reconstruct initial hands with proper card objects
    this.initialHands = this._buildInitialHands(replayData.initialHands);
    this.moves = replayData.moves || [];
    this.humanSeats = replayData.humanSeats || [];
    this.playerInfo = replayData.playerInfo || [];

    // Build decision points
    this.decisionPoints = [];
    this.states = [];
    this._reconstruct();
  }

  _buildInitialHands(rawHands) {
    // rawHands is array of 4 arrays, each card has {id, suit, val, p}
    let hands = [];
    for (let s = 0; s < 4; s++) {
      let raw = rawHands[s] || [];
      hands.push(raw.map(c => ({
        id: c.id,
        s: c.suit,
        v: c.val,
        p: c.p,
        seq: c.id
      })));
    }
    return hands;
  }

  _reconstruct() {
    // State at each point
    let hands = {};
    for (let s = 0; s < 4; s++) {
      hands[s] = this.initialHands[s].map(c => ({...c}));
    }
    let counts = [27, 27, 27, 27];
    let finishOrder = [];
    let lastHand = null;
    let passCount = 0;
    let moveHistory = []; // for context

    // Save initial state
    this.states.push(this._snapshot(hands, counts, finishOrder, lastHand, passCount, -1, null));

    for (let i = 0; i < this.moves.length; i++) {
      let move = this.moves[i];
      let seat = move.seat;

      // This is a decision point for this seat
      let isHuman = this.humanSeats.includes(seat);
      let dp = {
        moveIndex: i,
        seat: seat,
        isHuman: isHuman,
        hand: hands[seat].map(c => ({...c})),
        allHands: {},
        lastHand: lastHand ? {...lastHand} : null,
        finishOrder: [...finishOrder],
        passCount: passCount,
        counts: [...counts],
        actualMove: move,
        analysis: null // filled later
      };
      for (let s = 0; s < 4; s++) dp.allHands[s] = hands[s].map(c => ({...c}));
      this.decisionPoints.push(dp);

      // Apply move
      if (move.type === 'pass') {
        passCount++;
        moveHistory.push({seat, cards: [], isBomb: false, handType: null});
      } else if (move.type === 'play' && move.cards && move.cards.length > 0) {
        // Remove played cards from hand
        let playedIds = new Set(move.cards.map(c => c.id));
        hands[seat] = hands[seat].filter(c => !playedIds.has(c.id));
        counts[seat] = hands[seat].length;

        let ht = move.handType || G.getHandType(move.cards.map(c => ({
          id: c.id, s: c.suit || c.s, v: c.val || c.v, p: c.p
        })));

        lastHand = {
          owner: seat,
          type: ht ? ht.type : 'unknown',
          val: ht ? ht.val : 0,
          count: move.cards.length,
          score: ht ? (ht.score || 0) : 0
        };
        passCount = 0;

        // Check finish
        if (hands[seat].length === 0 && !finishOrder.includes(seat)) {
          finishOrder.push(seat);
        }

        let isBomb = ht && (ht.type === 'bomb' || ht.type === 'straight_flush');
        moveHistory.push({
          seat,
          cards: move.cards.map(c => G.cardToUid({s: c.suit || c.s, v: c.val || c.v, p: c.p})),
          isBomb: !!isBomb,
          handType: ht
        });
      }

      // Check round end
      if (lastHand) {
        let activeCount = 4 - finishOrder.length;
        let ownerActive = !finishOrder.includes(lastHand.owner);
        let passesNeeded = ownerActive ? activeCount - 1 : activeCount;
        if (passCount >= passesNeeded) {
          lastHand = null;
          passCount = 0;
        }
      }

      this.states.push(this._snapshot(hands, counts, finishOrder, lastHand, passCount, i, move));
    }
  }

  _snapshot(hands, counts, finishOrder, lastHand, passCount, moveIndex, move) {
    let h = {};
    for (let s = 0; s < 4; s++) h[s] = hands[s].map(c => ({...c}));
    return {
      hands: h,
      counts: [...counts],
      finishOrder: [...finishOrder],
      lastHand: lastHand ? {...lastHand} : null,
      passCount,
      moveIndex,
      move: move ? {...move} : null
    };
  }

  // Get all human decision points
  getHumanDecisionPoints() {
    return this.decisionPoints.filter(dp => dp.isHuman);
  }

  // Get all decision points
  getAllDecisionPoints() {
    return this.decisionPoints;
  }

  // Analyze a specific decision point using perfect-info forward search
  analyzePoint(dpIndex, numSims) {
    numSims = numSims || 50;
    let dp = this.decisionPoints[dpIndex];
    if (!dp) return null;

    // Normalize card objects for analysis
    let normHands = {};
    for (let s = 0; s < 4; s++) {
      normHands[s] = dp.allHands[s].map(c => ({
        id: c.id, s: c.s, v: c.v, p: c.p, seq: c.id
      }));
    }

    let results = G.analyzeDecisionPoint(
      normHands, dp.seat, dp.lastHand, dp.finishOrder, dp.passCount, numSims
    );

    // Find what the player actually played
    let actualCards = [];
    if (dp.actualMove.type === 'play' && dp.actualMove.cards) {
      actualCards = dp.actualMove.cards;
    }
    let actualIds = new Set(actualCards.map(c => c.id));
    let isPass = dp.actualMove.type === 'pass';

    // Match actual move to results
    for (let r of results) {
      if (isPass && r.cards.length === 0) {
        r.isActual = true;
      } else if (!isPass && r.cards.length > 0) {
        let rIds = new Set(r.cards.map(c => c.id));
        if (rIds.size === actualIds.size && [...actualIds].every(id => rIds.has(id))) {
          r.isActual = true;
        }
      }
    }

    // Calculate loss vs optimal
    let bestScore = results.length > 0 ? results[0].winRate : 0;
    let actualResult = results.find(r => r.isActual);
    let actualScore = actualResult ? actualResult.winRate : 0;
    let loss = bestScore - actualScore;

    dp.analysis = {
      moves: results,
      bestScore,
      actualScore,
      loss,
      rating: loss < 2 ? 'perfect' : loss < 10 ? 'good' : loss < 25 ? 'inaccuracy' : 'mistake'
    };

    return dp.analysis;
  }

  // Analyze all human decision points
  analyzeAll(numSims, progressCallback) {
    let humanDPs = this.getHumanDecisionPoints();
    let totalLoss = 0;
    let mistakes = 0;
    let inaccuracies = 0;
    let perfect = 0;

    for (let i = 0; i < this.decisionPoints.length; i++) {
      let dp = this.decisionPoints[i];
      if (!dp.isHuman) continue;

      this.analyzePoint(i, numSims);

      if (dp.analysis) {
        totalLoss += dp.analysis.loss;
        if (dp.analysis.rating === 'mistake') mistakes++;
        else if (dp.analysis.rating === 'inaccuracy') inaccuracies++;
        else if (dp.analysis.rating === 'perfect') perfect++;
      }

      if (progressCallback) {
        progressCallback(i, this.decisionPoints.length, dp);
      }
    }

    let humanCount = humanDPs.length;
    return {
      totalDecisions: humanCount,
      avgAccuracy: humanCount > 0 ? ((humanCount * 100 - totalLoss) / humanCount) : 0,
      totalLoss,
      mistakes,
      inaccuracies,
      perfect,
      rating: mistakes === 0 && inaccuracies <= 2 ? '优秀' :
              mistakes <= 1 && inaccuracies <= 4 ? '良好' :
              mistakes <= 3 ? '一般' : '需要提高'
    };
  }

  // Get card display info
  static cardDisplay(c) {
    if (!c) return '?';
    let suit = c.suit || c.s;
    let val = c.val || c.v;
    if (suit === 'JOKER') return val === 'Bg' ? '大王' : '小王';
    return val + suit;
  }
}

exports.ReplayEngine = ReplayEngine;

})(typeof window !== 'undefined' ? window : global);
