/**
 * Legal move generation. G.MoveGenerator
 */
(function() {
    const G = window.G;
    const C = G.Card;

    function analyzeHand(hand) {
        const wildUids = [];
        for (let c = 0; c < hand[25]; c++) wildUids.push(25);
        const byPower = {};
        for (let uid = 0; uid < C.NUM_UNIQUE; uid++) {
            if (uid === 25) continue;
            if (hand[uid] > 0) {
                const [,power] = C.uidToSuitVal(uid);
                if (!byPower[power]) byPower[power] = [];
                for (let c = 0; c < hand[uid]; c++) byPower[power].push(uid);
            }
        }
        const vals = Object.keys(byPower).map(Number).sort((a,b)=>a-b);
        const nw = wildUids.length;
        const result = {
            singles:[], pairs:[], triples:[],
            bombs:[], plates:[], tubes:[],
            straights:[], straight_flushes:[], fullhouses:[]
        };
        for (const v of vals) {
            const cards = byPower[v]; const n = cards.length;
            if (n >= 4) result.bombs.push(cards.slice());
            if (n < 4 && n+nw >= 4) result.bombs.push(cards.slice().concat(wildUids.slice(0,4-n)));
            if (n >= 3) result.triples.push(cards.slice(0,3));
            if (n >= 2) result.pairs.push(cards.slice(0,2));
            if (n >= 1) result.singles.push(cards.slice(0,1));
        }
        if (nw > 0) result.singles.push([25]);
        result.bombs.sort((a,b) => {
            if (a.length!==b.length) return b.length-a.length;
            return C.uidToSuitVal(b[0])[1]-C.uidToSuitVal(a[0])[1];
        });
        const sjc = hand[C.SMALL_JOKER_UID], bjc = hand[C.BIG_JOKER_UID];
        if (sjc>=2 && bjc>=2) {
            const jb = [];
            for (let c=0;c<sjc;c++) jb.push(C.SMALL_JOKER_UID);
            for (let c=0;c<bjc;c++) jb.push(C.BIG_JOKER_UID);
            result.bombs.unshift(jb);
        }
        for (let i=0;i<result.triples.length-1;i++) {
            const p1=C.uidToSuitVal(result.triples[i][0])[1];
            const p2=C.uidToSuitVal(result.triples[i+1][0])[1];
            if (p1<=14&&p2<=14&&p2===p1+1) result.plates.push(result.triples[i].concat(result.triples[i+1]));
        }
        for (let i=0;i<result.pairs.length-2;i++) {
            const p1=C.uidToSuitVal(result.pairs[i][0])[1];
            const p2=C.uidToSuitVal(result.pairs[i+1][0])[1];
            const p3=C.uidToSuitVal(result.pairs[i+2][0])[1];
            if (p1<=14&&p3<=14&&p2===p1+1&&p3===p2+1) result.tubes.push(result.pairs[i].concat(result.pairs[i+1],result.pairs[i+2]));
        }
        const straightVals = vals.filter(v=>v<=14);
        for (let i=0;i<=straightVals.length-5;i++) {
            let ok=true;
            for (let j=0;j<4;j++) if (straightVals[i+j+1]!==straightVals[i+j]+1){ok=false;break;}
            if (ok) { const seq=[]; for (let j=0;j<5;j++) seq.push(byPower[straightVals[i+j]][0]); result.straights.push(seq); }
        }
        const bySuit = {};
        for (let uid=0;uid<C.NUM_UNIQUE;uid++) {
            if (uid===25||uid===C.SMALL_JOKER_UID||uid===C.BIG_JOKER_UID) continue;
            if (hand[uid]>0) {
                const [suit,power]=C.uidToSuitVal(uid);
                if (power<=14) { if (!bySuit[suit]) bySuit[suit]=[]; bySuit[suit].push([power,uid]); }
            }
        }
        for (const suit in bySuit) {
            const cards=bySuit[suit].sort((a,b)=>a[0]-b[0]);
            for (let i=0;i<=cards.length-5;i++) {
                const seq=cards.slice(i,i+5);
                let ok=true;
                for (let j=0;j<4;j++) if (seq[j+1][0]!==seq[j][0]+1){ok=false;break;}
                if (ok) result.straight_flushes.push(seq.map(([,uid])=>uid));
            }
        }
        for (let ti=0;ti<result.triples.length;ti++)
            for (let pi=0;pi<result.pairs.length;pi++) {
                const tp=C.uidToSuitVal(result.triples[ti][0])[1];
                const pp=C.uidToSuitVal(result.pairs[pi][0])[1];
                if (tp!==pp) result.fullhouses.push(result.triples[ti].concat(result.pairs[pi]));
            }
        return result;
    }

    function getAllMoves(hand, lastHand) {
        let sum=0; for (let i=0;i<hand.length;i++) sum+=hand[i];
        if (sum===0) return [[]];
        const analysis = analyzeHand(hand);
        const moves = [];
        if (lastHand===null||lastHand===undefined) {
            for (const key of ['singles','pairs','triples','fullhouses','straights','straight_flushes','plates','tubes','bombs'])
                for (const m of analysis[key]) moves.push(m);
        } else {
            const lt=lastHand.type, lv=lastHand.val;
            if (lt==='single') { for (const s of analysis.singles) if (C.uidToSuitVal(s[0])[1]>lv) moves.push(s); }
            else if (lt==='pair') { for (const p of analysis.pairs) if (C.uidToSuitVal(p[0])[1]>lv) moves.push(p); }
            else if (lt==='triple') { for (const t of analysis.triples) if (C.uidToSuitVal(t[0])[1]>lv) moves.push(t); }
            else if (lt==='fullhouse') {
                for (const fh of analysis.fullhouses) {
                    const pc={}; for (const u of fh){const p=C.uidToSuitVal(u)[1];pc[p]=(pc[p]||0)+1;}
                    let tv=0,tc=0; for (const p in pc) if (pc[p]>tc){tc=pc[p];tv=Number(p);}
                    if (tv>lv) moves.push(fh);
                }
            }
            else if (lt==='straight') { for (const s of analysis.straights){const mv=Math.max(...s.map(u=>C.uidToSuitVal(u)[1])); if (mv>lv) moves.push(s);} }
            else if (lt==='straight_flush') { for (const sf of analysis.straight_flushes){const mv=Math.max(...sf.map(u=>C.uidToSuitVal(u)[1])); if (mv>lv) moves.push(sf);} }
            else if (lt==='plate') { for (const p of analysis.plates) if (C.uidToSuitVal(p[0])[1]>lv) moves.push(p); }
            else if (lt==='tube') { for (const t of analysis.tubes) if (C.uidToSuitVal(t[0])[1]>lv) moves.push(t); }
            for (const b of analysis.bombs) { const bt=G.HandDetector.detectHand(b); if (bt&&G.HandComparator.canBeat(bt,lastHand)) moves.push(b); }
            if (lt!=='straight_flush') {
                for (const sf of analysis.straight_flushes) {
                    const sft=G.HandDetector.detectHand(sf);
                    if (sft&&G.HandComparator.canBeat(sft,lastHand)) {
                        const k=sf.slice().sort((a,b)=>a-b).join(',');
                        if (!moves.some(m=>m.slice().sort((a,b)=>a-b).join(',')=== k)) moves.push(sf);
                    }
                }
            }
            moves.push([]);
        }
        const seen=new Set(), unique=[];
        for (const m of moves){const k=m.slice().sort((a,b)=>a-b).join(','); if (!seen.has(k)){seen.add(k);unique.push(m);}}
        return unique.length>0?unique:[[]];
    }

    G.MoveGenerator = { analyzeHand, getAllMoves };
})();
