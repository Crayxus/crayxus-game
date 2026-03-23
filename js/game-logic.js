// game-logic.js — Extracted game logic for replay analysis
// Shared between index.html (live game) and replay.html (post-game review)

(function(exports) {
'use strict';

// ===== Card Constants =====
const SUIT_IDX_MAP = {'♠':0,'♥':1,'♣':2,'♦':3};
const HT_IDX_MAP = {single:0,pair:1,triple:2,fullhouse:3,straight:4,straight_flush:5,plate:6,tube:7,bomb:8,pass:9,bomb5:10,bomb6:11,bomb7:12,bomb8:13,joker_bomb:14};
const FE_TYPE_MAP = {'1':'single','2':'pair','3':'triple','3+2':'fullhouse',bomb:'bomb',straight:'straight',straight_flush:'straight_flush',plate:'plate',tube:'tube'};
const _SR = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};

let _wildValue = '2'; // current wild card value

function setWildValue(v) { _wildValue = v; }
function getWildValue() { return _wildValue; }

function isWildCard(c) { return c.v === _wildValue && c.s === '♥'; }

function cardToUid(c) {
  if (c.s === 'JOKER') return c.v === 'Bg' ? 53 : 52;
  return SUIT_IDX_MAP[c.s] * 13 + (c.p - 3);
}

function uidToCard(uid) {
  if (uid === 52) return {s:'JOKER', v:'Sm', p:16};
  if (uid === 53) return {s:'JOKER', v:'Bg', p:17};
  const suits = ['♠','♥','♣','♦'];
  const suit = suits[Math.floor(uid / 13)];
  const p = (uid % 13) + 3;
  const vals = {3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A',15:'2'};
  return {s: suit, v: vals[p], p: p};
}

function cardsToVec54(cards) {
  const v = new Float32Array(54);
  for (const c of cards) v[cardToUid(c)] += 1;
  return v;
}

function straightVal(cards) {
  let ps = cards.map(c => _SR[c.v] || c.p).filter(v => v <= 14);
  let mn = Math.min(...ps), mx = Math.max(...ps);
  if (mx === 14 && mn <= 5 && (mx - Math.max(...ps.filter(v => v < 14))) > 4) return 5;
  return mx;
}

function getHandType(c) {
  if (!c.length) return null;
  let wild = c.filter(x => isWildCard(x)), jokers = c.filter(x => x.s === 'JOKER'), norm = c.filter(x => !isWildCard(x));
  if (wild.length > 0 && jokers.length > 0) return null;
  norm.sort((a, b) => a.p - b.p);
  let len = c.length, m = {};
  norm.forEach(x => m[x.p] = (m[x.p] || 0) + 1);
  let vals = Object.keys(m).map(Number).sort((a, b) => a - b), mf = vals.length ? Math.max(...Object.values(m)) : 0;

  // Bombs (4+)
  if (len >= 4) {
    let k = c.filter(x => x.s === 'JOKER');
    if (k.length === 4) return {type:'bomb', val:999, count:6, score:1000};
    if (vals.length === 1 && mf >= 1 && mf + wild.length >= 4 && mf + wild.length === len) {
      return {type:'bomb', val:vals[0], count:len, score:len*100};
    }
    if (wild.length === 0 && mf === len && vals.length === 1) {
      return {type:'bomb', val:vals[0], count:len, score:len*100};
    }
  }

  if (len === 1) return {type:'1', val:c[0].p};
  if (len === 2 && (mf + wild.length >= 2)) return {type:'2', val:vals.length ? vals[vals.length-1] : 15};
  if (len === 3 && (mf + wild.length >= 3)) return {type:'3', val:vals.length ? vals[vals.length-1] : 15};

  if (len === 5) {
    let seqNorm = norm.filter(x => x.s !== 'JOKER' && _SR[x.v]);
    let sVals = [...new Set(seqNorm.map(x => _SR[x.v]))].sort((a, b) => a - b);
    let fWilds = wild.length;
    if (sVals.length >= 1 && seqNorm.length + fWilds >= 5) {
      let isStr = false, strVal = 0;
      for (let lo = 2; lo <= 10; lo++) {
        let win = [lo, lo+1, lo+2, lo+3, lo+4];
        let winSet = new Set(win);
        let outOfWin = sVals.filter(r => !winSet.has(r)).length;
        let inWin = sVals.filter(r => winSet.has(r)).length;
        let missing = win.length - inWin;
        if (outOfWin === 0 && missing <= fWilds) { isStr = true; strVal = Math.max(...win); break; }
      }
      if (!isStr) {
        let aLow = sVals.map(v => v === 14 ? 1 : v).sort((a, b) => a - b);
        let outOf = aLow.filter(v => v > 5).length;
        let miss = [1,2,3,4,5].filter(v => !new Set(aLow).has(v)).length;
        if (outOf === 0 && miss <= fWilds) { isStr = true; strVal = 5; }
      }
      if (isStr) {
        let isF = true;
        if (seqNorm.length > 0) {
          let fs = seqNorm[0].s;
          for (let cd of seqNorm) { if (cd.s !== fs) { isF = false; break; } }
        }
        if (isF && seqNorm.length + fWilds >= 5) return {type:'straight_flush', val:strVal, score:550};
        else return {type:'straight', val:strVal};
      }
    }
    if (vals.length <= 2 && mf >= 2) {
      let tv = vals[vals.length-1];
      for (let vv of vals) { if (m[vv] >= 3) { tv = vv; break; } }
      return {type:'3+2', val:tv};
    }
  }

  let mSqPT = {};
  norm.forEach(x => { let f = _SR[x.v] || x.p; mSqPT[f] = (mSqPT[f] || 0) + 1; });
  let svPT = Object.keys(mSqPT).map(Number).sort((a, b) => a - b);
  if (len === 6 && svPT.length === 2 && svPT[1] === svPT[0] + 1) {
    if (mSqPT[svPT[0]] + wild.length >= 3) return {type:'plate', val:svPT[0]};
  }
  if (len === 6 && svPT.length === 3) {
    if (svPT[1] === svPT[0] + 1 && svPT[2] === svPT[1] + 1) {
      let ok = (mSqPT[svPT[0]] >= 1 || wild.length > 0) && (mSqPT[svPT[1]] >= 1 || wild.length > 0) && (mSqPT[svPT[2]] >= 1 || wild.length > 0);
      if (ok) return {type:'tube', val:svPT[0]};
    }
  }
  return null;
}

function canBeat(c, t, l) {
  let nb = (t.type === 'bomb' || t.type === 'straight_flush');
  let lb = (l.type === 'bomb' || l.type === 'straight_flush');
  if (nb && !lb) return true;
  if (!nb && lb) return false;
  if (nb && lb) {
    let ns = t.score || (t.type === 'bomb' ? t.count * 100 : 550);
    let ls = l.score || (l.type === 'bomb' ? l.count * 100 : 550);
    if (ns > ls) return true;
    if (ns < ls) return false;
    return t.val > l.val;
  }
  if (t.type !== l.type) return false;
  if (c.length !== l.count) return false;
  return t.val > l.val;
}

// ===== Hand Analysis =====
function analyzeHand(h) {
  let wild = h.filter(x => isWildCard(x));
  let norm = h.filter(x => !isWildCard(x));
  let nw = wild.length;

  let m = {};
  norm.forEach(c => m[c.p] = (m[c.p] || []).concat(c));
  let vals = Object.keys(m).map(Number).sort((a, b) => a - b);

  let r = {
    singles: [], pairs: [], triples: [], bombs: [],
    plates: [], tubes: [], straights: [], straight_flushes: [], fullhouses: []
  };

  // Singles
  vals.forEach(v => { let g = m[v]; if (g.length >= 1) r.singles.push(g.slice(0, 1)); });
  if (nw > 0) r.singles.push(wild.slice(0, 1));

  // Pairs
  vals.forEach(v => {
    let g = m[v], n = g.length;
    if (n >= 2) r.pairs.push(g.slice(0, 2));
    else if (n === 1 && nw >= 1) r.pairs.push(g.slice(0, 1).concat(wild.slice(0, 1)));
  });
  if (nw >= 2) r.pairs.push(wild.slice(0, 2));

  // Triples
  vals.forEach(v => {
    let g = m[v], n = g.length;
    if (n >= 3) r.triples.push(g.slice(0, 3));
    else if (n === 2 && nw >= 1) r.triples.push(g.slice(0, 2).concat(wild.slice(0, 1)));
    else if (n === 1 && nw >= 2) r.triples.push(g.slice(0, 1).concat(wild.slice(0, 2)));
  });

  // Bombs
  let jokers = h.filter(x => x.s === 'JOKER');
  if (jokers.length === 4) r.bombs.push([...jokers]);
  vals.forEach(v => {
    let g = m[v], n = g.length;
    if (g.some(x => x.s === 'JOKER')) return;
    if (n >= 4) r.bombs.push(g.slice());
    if (n >= 4 && nw >= 1) r.bombs.push(g.slice().concat(wild.slice(0, 1)));
    if (n >= 4 && nw >= 2) r.bombs.push(g.slice().concat(wild.slice(0, 2)));
    if (n === 3 && nw >= 1) r.bombs.push(g.slice(0, 3).concat(wild.slice(0, 1)));
    if (n === 3 && nw >= 2) r.bombs.push(g.slice(0, 3).concat(wild.slice(0, 2)));
    if (n === 2 && nw >= 2) r.bombs.push(g.slice(0, 2).concat(wild.slice(0, 2)));
  });
  r.bombs.sort((a, b) => {
    let aj = a.some(x => x.s === 'JOKER' && a.length === 4) ? 1 : 0;
    let bj = b.some(x => x.s === 'JOKER' && b.length === 4) ? 1 : 0;
    if (aj !== bj) return bj - aj;
    return b.length - a.length || b[0].p - a[0].p;
  });

  // Straights
  let mSeqA = {};
  norm.filter(c => c.s !== 'JOKER' && _SR[c.v]).forEach(c => {
    let sr = _SR[c.v];
    if (!mSeqA[sr]) mSeqA[sr] = [];
    mSeqA[sr].push(c);
  });
  let seqValsA = Object.keys(mSeqA).map(Number).sort((a, b) => a - b);

  for (let i = 0; i < seqValsA.length - 4; i++) {
    let ok = true;
    for (let j = 0; j < 4; j++) {
      if (seqValsA[i + j + 1] !== seqValsA[i + j] + 1) { ok = false; break; }
    }
    if (ok) {
      let seq = [];
      for (let j = 0; j < 5; j++) seq.push(mSeqA[seqValsA[i + j]][0]);
      r.straights.push(seq);
    }
  }
  // A-low: A2345
  if (mSeqA[14]) {
    let aLowNeeded = [2, 3, 4, 5];
    let have = aLowNeeded.filter(v => mSeqA[v]);
    if (have.length >= 4) {
      let seq = [mSeqA[14][0]];
      for (let v of aLowNeeded) seq.push(mSeqA[v][0]);
      r.straights.push(seq);
    }
  }
  // Wild-augmented straights
  if (nw > 0) {
    let straightValsArr = seqValsA.filter(v => v <= 14);
    for (let start = 3; start <= 10; start++) {
      let needed = [];
      for (let k = 0; k < 5; k++) needed.push(start + k);
      let haveSet = new Set(straightValsArr);
      let inWin = needed.filter(v => haveSet.has(v)).length;
      let gaps = 5 - inWin;
      if (gaps > 0 && gaps <= nw) {
        let seq = [];
        for (let v of needed) {
          if (mSeqA[v]) seq.push(mSeqA[v][0]);
          else seq.push(wild[0]);
        }
        r.straights.push(seq);
      }
    }
  }

  // Straight flushes
  let nj = norm.filter(c => c.s !== 'JOKER' && _SR[c.v]);
  for (let suit of ['♠','♥','♣','♦']) {
    let sc = nj.filter(c => c.s === suit);
    if (sc.length >= 5) {
      let bySR = {};
      sc.forEach(c => { let sr = _SR[c.v]; if (!bySR[sr]) bySR[sr] = c; });
      let srs = Object.keys(bySR).map(Number).sort((a, b) => a - b);
      for (let i = 0; i <= srs.length - 5; i++) {
        let ok = true;
        for (let j = 0; j < 4; j++) {
          if (srs[i + j + 1] !== srs[i + j] + 1) { ok = false; break; }
        }
        if (ok) {
          let seq = [];
          for (let j = 0; j < 5; j++) seq.push(bySR[srs[i + j]]);
          r.straight_flushes.push(seq);
        }
      }
    }
  }
  // A-low straight flush
  for (let suit of ['♠','♥','♣','♦']) {
    let sc = nj.filter(c => c.s === suit);
    let bySR = {};
    sc.forEach(c => { let sr = _SR[c.v]; if (!bySR[sr]) bySR[sr] = c; });
    if (bySR[14]) {
      let aLowOk = [2, 3, 4, 5].every(v => bySR[v]);
      if (aLowOk) {
        let seq = [bySR[14]];
        for (let v of [2, 3, 4, 5]) seq.push(bySR[v]);
        r.straight_flushes.push(seq);
      }
    }
  }
  // Wild straight flush
  if (nw > 0) {
    for (let suit of ['♠','♥','♣','♦']) {
      let sc = nj.filter(c => c.s === suit);
      let bySR = {};
      sc.forEach(c => { let sr = _SR[c.v]; if (!bySR[sr]) bySR[sr] = c; });
      let srsSet = new Set(Object.keys(bySR).map(Number));
      for (let start = 3; start <= 10; start++) {
        let needed = [];
        for (let k = 0; k < 5; k++) needed.push(start + k);
        let inWin = needed.filter(v => srsSet.has(v)).length;
        let gaps = 5 - inWin;
        if (gaps > 0 && gaps <= nw) {
          let seq = [];
          for (let v of needed) {
            if (bySR[v]) seq.push(bySR[v]);
            else seq.push(wild[0]);
          }
          r.straight_flushes.push(seq);
        }
      }
    }
  }

  // Plates (2 consecutive triples)
  let plateVals = vals.filter(v => {
    let g = m[v];
    return g.length > 0 && !g.some(x => x.s === 'JOKER') && (_SR[g[0].v] || g[0].p <= 15);
  });
  for (let i = 0; i < plateVals.length - 1; i++) {
    let v0 = plateVals[i], v1 = plateVals[i + 1];
    let sr0 = _SR[m[v0][0].v] || v0, sr1 = _SR[m[v1][0].v] || v1;
    if (sr1 !== sr0 + 1) continue;
    let c0 = m[v0].length, c1 = m[v1].length;
    let need0 = Math.max(0, 3 - c0), need1 = Math.max(0, 3 - c1);
    let totalNeed = need0 + need1;
    if (totalNeed === 0) {
      r.plates.push(m[v0].slice(0, 3).concat(m[v1].slice(0, 3)));
    } else if (totalNeed <= nw) {
      let p = m[v0].slice(0, Math.min(3, c0)).concat(wild.slice(0, need0));
      p = p.concat(m[v1].slice(0, Math.min(3, c1))).concat(wild.slice(0, need1));
      r.plates.push(p);
    }
  }

  // Tubes (3 consecutive pairs)
  let tubeVals = vals.filter(v => {
    let g = m[v];
    return g.length > 0 && !g.some(x => x.s === 'JOKER') && (_SR[g[0].v] || false);
  });
  for (let i = 0; i < tubeVals.length - 2; i++) {
    let v0 = tubeVals[i], v1 = tubeVals[i + 1], v2 = tubeVals[i + 2];
    let sr0 = _SR[m[v0][0].v] || v0, sr1 = _SR[m[v1][0].v] || v1, sr2 = _SR[m[v2][0].v] || v2;
    if (sr1 !== sr0 + 1 || sr2 !== sr1 + 1 || sr2 > 14) continue;
    let c0 = m[v0].length, c1 = m[v1].length, c2 = m[v2].length;
    let need0 = Math.max(0, 2 - c0), need1 = Math.max(0, 2 - c1), need2 = Math.max(0, 2 - c2);
    let totalNeed = need0 + need1 + need2;
    if (totalNeed === 0) {
      r.tubes.push(m[v0].slice(0, 2).concat(m[v1].slice(0, 2), m[v2].slice(0, 2)));
    } else if (totalNeed <= nw) {
      let t = m[v0].slice(0, Math.min(2, c0)).concat(wild.slice(0, need0));
      t = t.concat(m[v1].slice(0, Math.min(2, c1))).concat(wild.slice(0, need1));
      t = t.concat(m[v2].slice(0, Math.min(2, c2))).concat(wild.slice(0, need2));
      r.tubes.push(t);
    }
  }

  // Fullhouses (triple + pair)
  let allTriples = [], allPairs = [];
  vals.forEach(v => {
    let g = m[v], n = g.length;
    if (g.some(x => x.s === 'JOKER')) return;
    if (n >= 3) allTriples.push({v, cards: g.slice(0, 3), w: 0});
    if (n === 2 && nw >= 1) allTriples.push({v, cards: g.slice(0, 2).concat(wild.slice(0, 1)), w: 1});
    if (n === 1 && nw >= 2) allTriples.push({v, cards: g.slice(0, 1).concat(wild.slice(0, 2)), w: 2});
    if (n >= 2) allPairs.push({v, cards: g.slice(0, 2), w: 0});
    if (n === 1 && nw >= 1) allPairs.push({v, cards: g.slice(0, 1).concat(wild.slice(0, 1)), w: 1});
  });
  if (nw >= 2) allPairs.push({v: 15, cards: wild.slice(0, 2), w: 2});

  for (let ti = 0; ti < allTriples.length; ti++) {
    for (let pi = 0; pi < allPairs.length; pi++) {
      if (allTriples[ti].v !== allPairs[pi].v && allTriples[ti].w + allPairs[pi].w <= nw) {
        r.fullhouses.push(allTriples[ti].cards.concat(allPairs[pi].cards));
      }
    }
  }

  return r;
}

// ===== Generate all legal moves =====
function genLegalMoves(hand, lastHand, seat, finishOrder) {
  let moves = [], g = analyzeHand(hand);
  let isTeammate = lastHand && lastHand.owner === (seat + 2) % 4;

  if (!lastHand) {
    // Leading: all possible plays
    g.singles.forEach(s => moves.push({cards: s, label: '单牌'}));
    g.pairs.forEach(p => moves.push({cards: p, label: '对子'}));
    g.triples.forEach(t => moves.push({cards: t, label: '三条'}));
    g.fullhouses.forEach(f => moves.push({cards: f, label: '三带二'}));
    g.straights.forEach(s => moves.push({cards: s, label: '顺子'}));
    g.straight_flushes.forEach(s => moves.push({cards: s, label: '同花顺'}));
    g.plates.forEach(p => moves.push({cards: p, label: '钢板'}));
    g.tubes.forEach(t => moves.push({cards: t, label: '木板'}));
    g.bombs.forEach(b => moves.push({cards: b, label: '炸弹'}));
  } else {
    // Following
    if (lastHand.type === '1') g.singles.filter(s => s[0].p > lastHand.val).forEach(s => moves.push({cards: s, label: '单牌'}));
    if (lastHand.type === '2') g.pairs.filter(p => p[0].p > lastHand.val).forEach(p => moves.push({cards: p, label: '对子'}));
    if (lastHand.type === '3') g.triples.filter(t => t[0].p > lastHand.val).forEach(t => moves.push({cards: t, label: '三条'}));
    if (lastHand.type === '3+2') g.fullhouses.filter(f => {
      let tm = {}; f.forEach(c => tm[c.p] = (tm[c.p]||0)+1);
      let tv = 0; for (let v in tm) if (tm[v] >= 3) tv = Number(v);
      return tv > lastHand.val;
    }).forEach(f => moves.push({cards: f, label: '三带二'}));
    if (lastHand.type === 'straight') g.straights.filter(s => straightVal(s) > lastHand.val).forEach(s => moves.push({cards: s, label: '顺子'}));
    if (lastHand.type === 'straight_flush') g.straight_flushes.filter(s => straightVal(s) > lastHand.val).forEach(s => moves.push({cards: s, label: '同花顺'}));
    if (lastHand.type === 'plate') g.plates.filter(p => p[0].p > lastHand.val).forEach(p => moves.push({cards: p, label: '钢板'}));
    if (lastHand.type === 'tube') g.tubes.filter(t => t[0].p > lastHand.val).forEach(t => moves.push({cards: t, label: '木板'}));
    // Bombs that can beat
    g.bombs.forEach(b => {
      let bt = {type:'bomb', val:b[0].p, count:b.length, score:b.length*100};
      if (canBeat(b, bt, lastHand)) moves.push({cards: b, label: '炸弹'});
    });
    g.straight_flushes.forEach(sf => {
      let sft = {type:'straight_flush', val:straightVal(sf), score:550};
      if (canBeat(sf, sft, lastHand)) moves.push({cards: sf, label: '同花顺'});
    });
    moves.push({cards: [], label: 'PASS'});
  }

  // Dedup
  let seen = new Set();
  return moves.filter(m => {
    let key = m.cards.map(c => c.id).sort().join(',') + ':' + m.label;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

// ===== Heuristic move for simulation =====
function simHeuristicMove(hand, simLastHand, seat) {
  if (!hand || hand.length === 0) return [];
  let g = analyzeHand(hand);
  if (!simLastHand) {
    // Lead: play smallest single
    if (g.singles.length) {
      let normals = g.singles.filter(s => s[0].s !== 'JOKER' && s[0].v !== '2');
      normals.sort((a, b) => a[0].p - b[0].p);
      return normals.length ? normals[0] : g.singles[0];
    }
    let h = [...hand].sort((a, b) => a.p - b.p);
    return [h[0]];
  }
  // Teammate winning → pass
  if (simLastHand.owner === (seat + 2) % 4) return [];
  // Try to beat
  if (simLastHand.type === '1') { for (let s of g.singles) if (s[0].p > simLastHand.val) return s; }
  else if (simLastHand.type === '2') { for (let p of g.pairs) if (p[0].p > simLastHand.val) return p; }
  else if (simLastHand.type === '3') { for (let t of g.triples) if (t[0].p > simLastHand.val) return t; }
  else if (simLastHand.type === 'straight') { for (let s of g.straights) if (straightVal(s) > simLastHand.val) return s; }
  else if (simLastHand.type === '3+2') {
    for (let f of g.fullhouses) {
      let tm = {}; f.forEach(c => tm[c.p] = (tm[c.p]||0)+1);
      let tv = 0; for (let v in tm) if (tm[v] >= 3) tv = Number(v);
      if (tv > simLastHand.val) return f;
    }
  }
  else if (simLastHand.type === 'plate') { for (let p of g.plates) if (p[0].p > simLastHand.val) return p; }
  else if (simLastHand.type === 'tube') { for (let t of g.tubes) if (t[0].p > simLastHand.val) return t; }
  return [];
}

// ===== Perfect info forward search =====
// Simulate game to completion, return finish order
function simulateToEnd(hands, startTurn, lastHand, finishOrder, passCount, maxSteps) {
  maxSteps = maxSteps || 300;
  let simHands = {};
  for (let s = 0; s < 4; s++) simHands[s] = hands[s] ? [...hands[s]] : [];
  let simFO = [...finishOrder];
  let simLH = lastHand ? {...lastHand} : null;
  let simPC = passCount || 0;
  let turn = startTurn;

  function nextActive(from) {
    for (let i = 0; i < 4; i++) {
      let s = (from + i) % 4;
      if (!simFO.includes(s)) return s;
    }
    return -1; // all finished
  }

  turn = nextActive(turn);

  for (let step = 0; step < maxSteps && simFO.length < 4; step++) {
    if (turn < 0) break;

    let hand = simHands[turn];
    // Auto-finish empty hands
    if (!hand || hand.length === 0) {
      if (!simFO.includes(turn)) simFO.push(turn);
      turn = nextActive(turn + 1);
      continue;
    }

    let move = simHeuristicMove(hand, simLH, turn);
    if (move.length > 0) {
      let ids = new Set(move.map(c => c.id));
      simHands[turn] = hand.filter(c => !ids.has(c.id));
      let ht = getHandType(move);
      simLH = ht ? {owner: turn, type: ht.type, val: ht.val, count: move.length, score: ht.score || 0} : null;
      simPC = 0;
      if (simHands[turn].length === 0 && !simFO.includes(turn)) simFO.push(turn);
    } else {
      simPC++;
    }

    // Check round end: all other active players passed
    if (simLH) {
      let activeCount = 4 - simFO.length;
      if (activeCount <= 0) break;
      let ownerActive = !simFO.includes(simLH.owner);
      let passesNeeded = ownerActive ? activeCount - 1 : activeCount;
      if (simPC >= passesNeeded) {
        let roundOwner = simLH.owner;
        simLH = null;
        simPC = 0;
        // Owner leads next; if finished, partner (接风)
        let nextLead = roundOwner;
        if (simFO.includes(nextLead)) nextLead = (nextLead + 2) % 4;
        turn = nextActive(nextLead);
        continue;
      }
    }

    // Advance to next active player
    turn = nextActive(turn + 1);
  }

  // Fill remaining by card count
  let remaining = [];
  for (let s = 0; s < 4; s++) {
    if (!simFO.includes(s)) remaining.push({seat: s, cards: simHands[s] ? simHands[s].length : 99});
  }
  remaining.sort((a, b) => a.cards - b.cards);
  remaining.forEach(r => simFO.push(r.seat));

  return simFO;
}

// Score a finish order from perspective of seat
function scoreFinishOrder(finishOrder, seat) {
  let partner = (seat + 2) % 4;
  let myPos = finishOrder.indexOf(seat);
  let partnerPos = finishOrder.indexOf(partner);

  // Scoring: 1st+2nd(same team) = 100, 1st+3rd = 70, 1st+4th = 50
  // 2nd+3rd = 30, 2nd+4th = 10, 3rd+4th = 0
  let team = [myPos, partnerPos].sort((a,b) => a-b);
  if (team[0] === 0 && team[1] === 1) return 100; // 双上
  if (team[0] === 0 && team[1] === 2) return 70;  // 上游+第三
  if (team[0] === 0 && team[1] === 3) return 50;  // 上游+末游
  if (team[0] === 1 && team[1] === 2) return 30;  // 第二+第三
  if (team[0] === 1 && team[1] === 3) return 10;  // 第二+末游
  return 0; // 双下
}

// ===== Heuristic score for quick move ranking =====
function quickMoveScore(cards, hand, lastHand, seat) {
  if (cards.length === 0) return 20; // PASS: neutral
  let ht = getHandType(cards);
  if (!ht) return 10;

  let score = 30;
  let remaining = hand.length - cards.length;

  // Finishing is great
  if (remaining === 0) return 95;

  // Big combos are generally good
  if (ht.type === 'straight' || ht.type === 'straight_flush') score += 15;
  if (ht.type === 'plate' || ht.type === 'tube') score += 12;
  if (ht.type === '3+2') score += 10;

  // Playing more cards at once is better
  score += cards.length * 2;

  // Playing small cards is better (save big ones)
  let avgVal = cards.reduce((s, c) => s + c.p, 0) / cards.length;
  score -= avgVal * 0.5;

  // Bombs: high value but costly
  if (ht.type === 'bomb') score += 5;

  return Math.max(0, Math.min(100, score));
}

// ===== Main analysis: evaluate all moves at a decision point =====
// Perfect info: we know all 4 hands
// Two-phase: quick heuristic filter → deep simulation on top candidates
function analyzeDecisionPoint(hands, seat, lastHand, finishOrder, passCount, numSimulations) {
  numSimulations = numSimulations || 20;
  let hand = hands[seat];
  if (!hand || hand.length === 0) return [];

  let moves = genLegalMoves(hand, lastHand, seat, finishOrder);
  if (moves.length === 0) return [];

  // Phase 1: Quick heuristic scoring for all moves
  let scored = moves.map(m => ({
    ...m,
    quickScore: quickMoveScore(m.cards, hand, lastHand, seat)
  }));
  scored.sort((a, b) => b.quickScore - a.quickScore);

  // Phase 2: Deep simulation on top N candidates
  let MAX_DEEP = 15; // simulate at most 15 candidates
  let deepCandidates = scored.slice(0, MAX_DEEP);

  let results = [];
  for (let mi = 0; mi < deepCandidates.length; mi++) {
    let move = deepCandidates[mi];
    let totalScore = 0;

    for (let sim = 0; sim < numSimulations; sim++) {
      let simHands = {};
      for (let s = 0; s < 4; s++) simHands[s] = hands[s] ? hands[s].map(c => ({...c})) : [];

      let simFO = [...finishOrder];
      let simLH = lastHand ? {...lastHand} : null;
      let simPC = passCount || 0;

      if (move.cards.length > 0) {
        let ids = new Set(move.cards.map(c => c.id));
        simHands[seat] = simHands[seat].filter(c => !ids.has(c.id));
        let ht = getHandType(move.cards);
        simLH = ht ? {owner: seat, type: ht.type, val: ht.val, count: move.cards.length, score: ht.score || 0} : null;
        simPC = 0;
        if (simHands[seat].length === 0 && !simFO.includes(seat)) simFO.push(seat);
      } else {
        simPC++;
        if (simLH) {
          let activeCount = 4 - simFO.length;
          let ownerActive = !simFO.includes(simLH.owner);
          let passesNeeded = ownerActive ? activeCount - 1 : activeCount;
          if (simPC >= passesNeeded) { simLH = null; simPC = 0; }
        }
      }

      // Next turn
      let nextTurn;
      if (simLH === null) {
        nextTurn = move.cards.length > 0 ? seat : (lastHand ? lastHand.owner : (seat + 1) % 4);
        while (simFO.includes(nextTurn)) nextTurn = (nextTurn + 1) % 4;
      } else {
        nextTurn = (seat + 1) % 4;
        while (simFO.includes(nextTurn)) nextTurn = (nextTurn + 1) % 4;
      }

      let fo = simulateToEnd(simHands, nextTurn, simLH, simFO, simPC);
      totalScore += scoreFinishOrder(fo, seat);
    }

    let avgScore = totalScore / numSimulations;
    results.push({
      cards: move.cards,
      label: move.label,
      score: avgScore,
      winRate: avgScore
    });
  }

  // Add remaining moves with heuristic-only scores (scaled to match)
  if (scored.length > MAX_DEEP) {
    let minDeep = results.length > 0 ? Math.min(...results.map(r => r.winRate)) : 0;
    for (let mi = MAX_DEEP; mi < scored.length; mi++) {
      let move = scored[mi];
      results.push({
        cards: move.cards,
        label: move.label,
        score: Math.max(0, minDeep - 5),
        winRate: Math.max(0, minDeep - 5)
      });
    }
  }

  results.sort((a, b) => b.winRate - a.winRate);
  return results;
}

// Build a deck
function buildDeck(wildValue) {
  const suits = ['♠','♥','♣','♦'];
  const baseVals = [
    {v:'3',p:3},{v:'4',p:4},{v:'5',p:5},{v:'6',p:6},{v:'7',p:7},
    {v:'8',p:8},{v:'9',p:9},{v:'10',p:10},{v:'J',p:11},{v:'Q',p:12},
    {v:'K',p:13},{v:'A',p:14},{v:'2',p:15}
  ];
  const vals = baseVals.map(vv => {
    if (wildValue && wildValue !== '2') {
      if (vv.v === wildValue) return {v:vv.v, p:15};
      if (vv.v === '2') return {v:'2', p:2};
    }
    return vv;
  });
  let deck = [], id = 0;
  for (let d = 0; d < 2; d++) {
    for (let s of suits) {
      for (let vv of vals) {
        deck.push({s, v:vv.v, p:vv.p, seq:id, id:id}); id++;
      }
    }
    deck.push({s:'JOKER', v:'Sm', p:16, seq:id, id:id}); id++;
    deck.push({s:'JOKER', v:'Bg', p:17, seq:id, id:id}); id++;
  }
  return deck;
}

// Export
exports.GL = {
  setWildValue, getWildValue, isWildCard,
  cardToUid, uidToCard, cardsToVec54,
  straightVal, getHandType, canBeat,
  analyzeHand, genLegalMoves,
  simHeuristicMove, simulateToEnd,
  scoreFinishOrder, analyzeDecisionPoint,
  buildDeck,
  SUIT_IDX_MAP, HT_IDX_MAP, FE_TYPE_MAP, _SR
};

})(typeof window !== 'undefined' ? window : global);
