/**
 * Guandan Game Simulator for Tournament Bot Tables
 * Simulates full 4-player guandan games with heuristic AI.
 * Teams: seat0+seat2 vs seat1+seat3
 */

const SUITS = ['s','h','c','d']; // spade, heart, club, diamond
const POINTS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const BASE_POWER = {'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15,'Sm':16,'Bg':17};
const STR_RANK = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};

function getPower(v, wv) {
    if (v === 'Sm') return 16;
    if (v === 'Bg') return 17;
    if (wv && wv !== '2') {
        if (v === wv) return 15;
        if (v === '2') return 2;
    }
    return BASE_POWER[v] || 0;
}

function createDeck(wv) {
    wv = wv || '2';
    let deck = [];
    for (let i = 0; i < 2; i++) {
        for (let s of SUITS) {
            for (let v of POINTS) {
                deck.push({ s, v, p: getPower(v, wv), sr: STR_RANK[v] || 0, isWild: (v === wv && s === 'h') });
            }
        }
        deck.push({ s: 'j', v: 'Sm', p: 16, sr: 0, isWild: false });
        deck.push({ s: 'j', v: 'Bg', p: 17, sr: 0, isWild: false });
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Group cards by power value
function groupByPower(hand) {
    let g = {};
    for (let c of hand) {
        if (!g[c.p]) g[c.p] = [];
        g[c.p].push(c);
    }
    return g;
}

// Group cards by STR_RANK (for straights)
function groupByRank(hand) {
    let g = {};
    for (let c of hand) {
        if (c.sr === 0) continue; // jokers
        if (!g[c.sr]) g[c.sr] = [];
        g[c.sr].push(c);
    }
    return g;
}

/**
 * Generate all legal moves from hand given lastPlay.
 * lastPlay = null means free lead.
 * Returns array of {type, cards, val, score?}
 */
function generateMoves(hand, lastPlay, wv) {
    if (hand.length === 0) return [];

    let gp = groupByPower(hand);
    let gr = groupByRank(hand);
    let powers = Object.keys(gp).map(Number).sort((a, b) => a - b);
    let ranks = Object.keys(gr).map(Number).sort((a, b) => a - b);
    let wilds = hand.filter(c => c.isWild);
    let jokers = hand.filter(c => c.s === 'j');
    let moves = [];

    if (!lastPlay) {
        // Free lead: generate all possible plays
        // Singles
        for (let p of powers) moves.push({ type: '1', cards: [gp[p][0]], val: p });
        // Pairs
        for (let p of powers) {
            if (gp[p].length >= 2) moves.push({ type: '2', cards: gp[p].slice(0, 2), val: p });
            // Wild pair: 1 natural + 1 wild
            if (gp[p].length >= 1 && wilds.length > 0 && !gp[p][0].isWild) {
                moves.push({ type: '2', cards: [gp[p][0], wilds[0]], val: p });
            }
        }
        // Triples
        for (let p of powers) {
            if (gp[p].length >= 3) moves.push({ type: '3', cards: gp[p].slice(0, 3), val: p });
            if (gp[p].length >= 2 && wilds.length > 0 && !gp[p][0].isWild) {
                moves.push({ type: '3', cards: [...gp[p].slice(0, 2), wilds[0]], val: p });
            }
        }
        // 3+2
        for (let p of powers) {
            let triCards = null;
            if (gp[p].length >= 3) triCards = gp[p].slice(0, 3);
            else if (gp[p].length >= 2 && wilds.length > 0 && !gp[p][0].isWild) triCards = [...gp[p].slice(0, 2), wilds[0]];
            if (!triCards) continue;
            for (let p2 of powers) {
                if (p2 === p) continue;
                let avail = gp[p2].filter(c => !triCards.includes(c));
                if (avail.length >= 2) {
                    moves.push({ type: '3+2', cards: [...triCards, ...avail.slice(0, 2)], val: p });
                    break; // one pair is enough for lead
                }
            }
        }
        // Straights (5 consecutive by STR_RANK, range 2-6 through 10-A)
        for (let lo = 2; lo <= 10; lo++) {
            let sCards = [];
            let ok = true;
            for (let r = lo; r < lo + 5; r++) {
                if (gr[r] && gr[r].length > 0) sCards.push(gr[r][0]);
                else { ok = false; break; }
            }
            if (ok && sCards.length === 5) {
                let hi = lo + 4;
                // Check straight flush
                let suits = new Set(sCards.map(c => c.s));
                if (suits.size === 1) {
                    moves.push({ type: 'straight_flush', cards: sCards, val: hi, score: 550 });
                }
                moves.push({ type: 'straight', cards: sCards, val: hi });
            }
        }
        // A-2-3-4-5 straight
        if (gr[14] && gr[2] && gr[3] && gr[4] && gr[5]) {
            let sCards = [gr[14][0], gr[2][0], gr[3][0], gr[4][0], gr[5][0]];
            moves.push({ type: 'straight', cards: sCards, val: 5 });
        }
        // Bombs (4+)
        for (let p of powers) {
            if (gp[p].length >= 4) {
                for (let n = 4; n <= gp[p].length; n++) {
                    moves.push({ type: 'bomb', cards: gp[p].slice(0, n), val: p, score: n * 100 });
                }
            }
            // 3 natural + wild = 4-bomb
            if (gp[p].length === 3 && wilds.length > 0 && !gp[p][0].isWild) {
                moves.push({ type: 'bomb', cards: [...gp[p], wilds[0]], val: p, score: 400 });
            }
        }
        // 4-joker bomb
        if (jokers.length === 4) {
            moves.push({ type: 'bomb', cards: jokers.slice(0, 4), val: 999, score: 1000 });
        }
        // Plates (2 consecutive triples by STR_RANK)
        for (let i = 0; i < ranks.length - 1; i++) {
            let r1 = ranks[i], r2 = ranks[i + 1];
            if (r2 === r1 + 1 && gr[r1].length >= 3 && gr[r2].length >= 3) {
                moves.push({ type: 'plate', cards: [...gr[r1].slice(0, 3), ...gr[r2].slice(0, 3)], val: r1 });
            }
        }
        // Tubes (3 consecutive pairs by STR_RANK)
        for (let i = 0; i < ranks.length - 2; i++) {
            let r1 = ranks[i], r2 = ranks[i + 1], r3 = ranks[i + 2];
            if (r2 === r1 + 1 && r3 === r2 + 1 && gr[r1].length >= 2 && gr[r2].length >= 2 && gr[r3].length >= 2) {
                moves.push({ type: 'tube', cards: [...gr[r1].slice(0, 2), ...gr[r2].slice(0, 2), ...gr[r3].slice(0, 2)], val: r1 });
            }
        }
        return moves;
    }

    // Following a play: must beat it or pass
    let lt = lastPlay.type;
    let lv = lastPlay.val;
    let lc = lastPlay.cards ? lastPlay.cards.length : 0;
    let lScore = lastPlay.score || 0;
    let isLastBomb = (lt === 'bomb' || lt === 'straight_flush');

    // Same type, higher value
    if (lt === '1') {
        for (let p of powers) if (p > lv) moves.push({ type: '1', cards: [gp[p][0]], val: p });
    } else if (lt === '2') {
        for (let p of powers) {
            if (p <= lv) continue;
            if (gp[p].length >= 2) moves.push({ type: '2', cards: gp[p].slice(0, 2), val: p });
            if (gp[p].length >= 1 && wilds.length > 0 && !gp[p][0].isWild && getPower(wv, wv) > lv) {
                moves.push({ type: '2', cards: [gp[p][0], wilds[0]], val: p });
            }
        }
    } else if (lt === '3') {
        for (let p of powers) {
            if (p <= lv) continue;
            if (gp[p].length >= 3) moves.push({ type: '3', cards: gp[p].slice(0, 3), val: p });
            if (gp[p].length >= 2 && wilds.length > 0 && !gp[p][0].isWild) {
                moves.push({ type: '3', cards: [...gp[p].slice(0, 2), wilds[0]], val: p });
            }
        }
    } else if (lt === '3+2') {
        for (let p of powers) {
            if (p <= lv) continue;
            let triCards = null;
            if (gp[p].length >= 3) triCards = gp[p].slice(0, 3);
            else if (gp[p].length >= 2 && wilds.length > 0 && !gp[p][0].isWild) triCards = [...gp[p].slice(0, 2), wilds[0]];
            if (!triCards) continue;
            for (let p2 of powers) {
                if (p2 === p) continue;
                let avail = gp[p2].filter(c => !triCards.includes(c));
                if (avail.length >= 2) {
                    moves.push({ type: '3+2', cards: [...triCards, ...avail.slice(0, 2)], val: p });
                    break;
                }
            }
        }
    } else if (lt === 'straight') {
        for (let lo = 2; lo <= 10; lo++) {
            let hi = lo + 4;
            if (hi <= lv) continue;
            let sCards = [];
            let ok = true;
            for (let r = lo; r < lo + 5; r++) {
                if (gr[r] && gr[r].length > 0) sCards.push(gr[r][0]);
                else { ok = false; break; }
            }
            if (ok) moves.push({ type: 'straight', cards: sCards, val: hi });
        }
    } else if (lt === 'plate') {
        for (let i = 0; i < ranks.length - 1; i++) {
            let r1 = ranks[i], r2 = ranks[i + 1];
            if (r1 <= lv) continue;
            if (r2 === r1 + 1 && gr[r1].length >= 3 && gr[r2].length >= 3) {
                moves.push({ type: 'plate', cards: [...gr[r1].slice(0, 3), ...gr[r2].slice(0, 3)], val: r1 });
            }
        }
    } else if (lt === 'tube') {
        for (let i = 0; i < ranks.length - 2; i++) {
            let r1 = ranks[i], r2 = ranks[i + 1], r3 = ranks[i + 2];
            if (r1 <= lv) continue;
            if (r2 === r1 + 1 && r3 === r2 + 1 && gr[r1].length >= 2 && gr[r2].length >= 2 && gr[r3].length >= 2) {
                moves.push({ type: 'tube', cards: [...gr[r1].slice(0, 2), ...gr[r2].slice(0, 2), ...gr[r3].slice(0, 2)], val: r1 });
            }
        }
    }

    // Bombs can beat anything (and bigger bombs beat smaller)
    if (!isLastBomb) {
        // Any bomb beats non-bomb
        for (let p of powers) {
            if (gp[p].length >= 4) {
                moves.push({ type: 'bomb', cards: gp[p].slice(0, 4), val: p, score: 400 });
                if (gp[p].length >= 5) moves.push({ type: 'bomb', cards: gp[p].slice(0, 5), val: p, score: 500 });
            }
            if (gp[p].length === 3 && wilds.length > 0 && !gp[p][0].isWild) {
                moves.push({ type: 'bomb', cards: [...gp[p], wilds[0]], val: p, score: 400 });
            }
        }
        // Straight flush
        for (let lo = 2; lo <= 10; lo++) {
            let sCards = [];
            let ok = true;
            for (let r = lo; r < lo + 5; r++) {
                if (gr[r] && gr[r].length > 0) sCards.push(gr[r][0]); else { ok = false; break; }
            }
            if (ok) {
                let suits = new Set(sCards.map(c => c.s));
                if (suits.size === 1) moves.push({ type: 'straight_flush', cards: sCards, val: lo + 4, score: 550 });
            }
        }
        if (jokers.length === 4) moves.push({ type: 'bomb', cards: jokers.slice(0, 4), val: 999, score: 1000 });
    } else {
        // Must beat with bigger bomb
        let lastBombScore = lScore || (lt === 'straight_flush' ? 550 : lc * 100);
        for (let p of powers) {
            for (let n = 4; n <= gp[p].length; n++) {
                let sc = n * 100;
                if (sc > lastBombScore || (sc === lastBombScore && p > lv)) {
                    moves.push({ type: 'bomb', cards: gp[p].slice(0, n), val: p, score: sc });
                }
            }
        }
        // Straight flush beats 4-bomb
        if (lastBombScore < 550) {
            for (let lo = 2; lo <= 10; lo++) {
                let sCards = [];
                let ok = true;
                for (let r = lo; r < lo + 5; r++) {
                    if (gr[r] && gr[r].length > 0) sCards.push(gr[r][0]); else { ok = false; break; }
                }
                if (ok) {
                    let suits = new Set(sCards.map(c => c.s));
                    if (suits.size === 1) moves.push({ type: 'straight_flush', cards: sCards, val: lo + 4, score: 550 });
                }
            }
        }
        if (jokers.length === 4 && lastBombScore < 1000) {
            moves.push({ type: 'bomb', cards: jokers.slice(0, 4), val: 999, score: 1000 });
        }
    }

    // Pass is always an option when following
    moves.push({ type: 'pass', cards: [], val: 0 });
    return moves;
}

/**
 * Heuristic bot: pick a move.
 * Strategy:
 * - Leading: play smallest combo, prefer combos that reduce hand count efficiently
 * - Following teammate: usually pass (let teammate win the trick)
 * - Following opponent: play smallest valid beat, or pass if only bombs available
 * - Use bombs only when opponent has <= 5 cards or for critical situations
 */
function botPickMove(moves, hand, lastPlay, lastOwner, seat, finishOrder) {
    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0];

    let teammate = (seat + 2) % 4;
    let isTeammateControl = (lastOwner === teammate);
    let isLeading = !lastPlay;

    // Filter out pass for analysis
    let plays = moves.filter(m => m.type !== 'pass');
    let pass = moves.find(m => m.type === 'pass');
    let bombs = plays.filter(m => m.type === 'bomb' || m.type === 'straight_flush');
    let nonBombs = plays.filter(m => m.type !== 'bomb' && m.type !== 'straight_flush');

    if (isLeading) {
        // Free lead: play smallest combo
        // Prefer singles if we have many isolated cards, pairs if we have many pairs, etc.
        let singles = plays.filter(m => m.type === '1').sort((a, b) => a.val - b.val);
        let pairs = plays.filter(m => m.type === '2').sort((a, b) => a.val - b.val);
        let trips = plays.filter(m => m.type === '3' || m.type === '3+2').sort((a, b) => a.val - b.val);
        let seqs = plays.filter(m => m.type === 'straight' || m.type === 'plate' || m.type === 'tube').sort((a, b) => a.val - b.val);

        // Count hand structure
        let gp = groupByPower(hand);
        let singletons = 0, pairCount = 0;
        for (let p in gp) {
            if (gp[p].length === 1) singletons++;
            if (gp[p].length === 2) pairCount++;
        }

        // If hand is small (<= 5 cards), play aggressively
        if (hand.length <= 5) {
            // Try to play the whole hand or biggest chunk
            let bestSize = plays.sort((a, b) => b.cards.length - a.cards.length);
            if (bestSize[0] && bestSize[0].cards.length === hand.length) return bestSize[0];
        }

        // Prefer sequences (they clear many cards)
        if (seqs.length > 0) return seqs[0];
        // Then trips/3+2
        if (trips.length > 0) return trips[0];
        // Then pairs
        if (pairs.length > 0 && pairCount >= singletons) return pairs[0];
        // Then singles
        if (singles.length > 0) return singles[0];
        if (pairs.length > 0) return pairs[0];
        // Fallback
        return plays[0] || pass;
    }

    // Following
    if (isTeammateControl) {
        // Teammate controls — usually pass unless we can finish
        if (nonBombs.length > 0) {
            // If playing would finish us, do it
            for (let m of nonBombs) {
                if (m.cards.length === hand.length) return m;
            }
        }
        return pass || moves[0];
    }

    // Following opponent
    if (nonBombs.length > 0) {
        // Play smallest valid non-bomb
        nonBombs.sort((a, b) => a.val - b.val);
        return nonBombs[0];
    }

    // Only bombs available — use if opponent has few cards
    // Check if any opponent has <= 5 cards
    // (We don't track exact counts here, so use bomb conservatively)
    if (bombs.length > 0 && hand.length <= 8) {
        bombs.sort((a, b) => a.val - b.val);
        return bombs[0];
    }

    return pass || moves[0];
}

/**
 * Simulate a full 4-player guandan game.
 * Returns finishOrder: [first_seat, second_seat, third_seat, fourth_seat]
 */
function simulateGame(wildValue) {
    let wv = wildValue || '2';
    let deck = createDeck(wv);

    // Deal: 27 cards each
    let hands = [[], [], [], []];
    for (let i = 0; i < deck.length; i++) {
        hands[i % 4].push(deck[i]);
    }

    // Sort each hand by power
    for (let h of hands) h.sort((a, b) => a.p - b.p);

    let finishOrder = [];
    let turn = 0; // seat 0 starts
    let lastPlay = null;
    let lastOwner = -1;
    let passCount = 0;
    let maxTurns = 500; // safety limit

    for (let t = 0; t < maxTurns; t++) {
        // Skip finished players
        if (hands[turn].length === 0) {
            turn = (turn + 1) % 4;
            continue;
        }

        // Check if all passes returned control
        let activePlayers = [0, 1, 2, 3].filter(s => hands[s].length > 0);
        if (activePlayers.length <= 1) {
            // Last player standing
            for (let s of activePlayers) {
                if (!finishOrder.includes(s)) finishOrder.push(s);
            }
            break;
        }

        // If everyone passed back to lastOwner, they lead again
        if (passCount >= activePlayers.length - 1 || lastOwner === turn || lastOwner === -1 || hands[lastOwner].length === 0) {
            lastPlay = null;
            lastOwner = -1;
            passCount = 0;
        }

        let moves = generateMoves(hands[turn], lastPlay, wv);
        if (moves.length === 0) {
            // No moves possible (shouldn't happen with pass), just pass
            passCount++;
            turn = (turn + 1) % 4;
            continue;
        }

        let chosen = botPickMove(moves, hands[turn], lastPlay, lastOwner, turn, finishOrder);
        if (!chosen || chosen.type === 'pass') {
            passCount++;
            turn = (turn + 1) % 4;
            continue;
        }

        // Play the cards
        passCount = 0;
        lastPlay = { type: chosen.type, val: chosen.val, cards: chosen.cards, score: chosen.score || 0 };
        lastOwner = turn;

        // Remove cards from hand
        for (let c of chosen.cards) {
            let idx = hands[turn].findIndex(h => h.s === c.s && h.v === c.v && h.p === c.p);
            if (idx >= 0) hands[turn].splice(idx, 1);
        }

        // Check if player finished
        if (hands[turn].length === 0) {
            finishOrder.push(turn);
            if (finishOrder.length >= 3) {
                // Last player
                let last = [0, 1, 2, 3].find(s => !finishOrder.includes(s));
                if (last !== undefined) finishOrder.push(last);
                break;
            }
        }

        turn = (turn + 1) % 4;
    }

    // Safety: fill any missing
    for (let s = 0; s < 4; s++) {
        if (!finishOrder.includes(s)) finishOrder.push(s);
    }

    return finishOrder.slice(0, 4);
}

/**
 * Simulate with MMR-weighted advantage.
 * Higher MMR players get a slight edge (better starting position).
 * mmrs = [mmr0, mmr1, mmr2, mmr3]
 */
function simulateGameWithMMR(mmrs, wildValue) {
    // Run actual game simulation
    let fo = simulateGame(wildValue);

    // MMR influence: with some probability, swap results to favor higher MMR
    // This models skill difference - better players win more often
    let avgMmr = mmrs.reduce((a, b) => a + b, 0) / 4;
    for (let i = 0; i < fo.length - 1; i++) {
        for (let j = i + 1; j < fo.length; j++) {
            let pi = fo[i], pj = fo[j];
            let mmrDiff = mmrs[pj] - mmrs[pi]; // positive if pj has higher MMR
            if (mmrDiff > 0) {
                // Higher MMR player finished later - consider swapping
                let swapProb = Math.min(0.3, mmrDiff / 1000);
                if (Math.random() < swapProb) {
                    [fo[i], fo[j]] = [fo[j], fo[i]];
                }
            }
        }
    }

    return fo;
}

module.exports = { simulateGame, simulateGameWithMMR, generateMoves };
