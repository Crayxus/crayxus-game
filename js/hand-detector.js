/**
 * Hand type detection. G.HandDetector
 */
(function() {
    const G = window.G;
    const C = G.Card;

    function detectHand(uids) {
        if (!uids || uids.length === 0) return null;
        const n = uids.length;
        const wilds = uids.filter(u => C.isWild(u));
        const norms = uids.filter(u => !C.isWild(u));
        const nw = wilds.length;
        const normInfo = norms.map(u => C.uidToSuitVal(u));
        const normPowers = normInfo.map(([,p]) => p);
        const normSuits = normInfo.map(([s]) => s);
        const powerCounts = {};
        for (const p of normPowers) powerCounts[p] = (powerCounts[p]||0)+1;
        const vals = Object.keys(powerCounts).map(Number).sort((a,b)=>a-b);
        let maxFreq = 0;
        for (const v of vals) if (powerCounts[v] > maxFreq) maxFreq = powerCounts[v];

        if (n >= 4) {
            const jokerUids = uids.filter(u => u===C.SMALL_JOKER_UID||u===C.BIG_JOKER_UID);
            if (jokerUids.length === 4) return {type:C.HAND_BOMB,val:999,count:4,score:1000};
            if (vals.length===1 && maxFreq>=1 && maxFreq+nw>=4 && maxFreq+nw===n)
                return {type:C.HAND_BOMB,val:vals[0],count:n,score:n*100};
            if (nw===0 && maxFreq===n && vals.length===1)
                return {type:C.HAND_BOMB,val:vals[0],count:n,score:n*100};
        }
        if (n===1) { const [,p]=C.uidToSuitVal(uids[0]); return {type:C.HAND_SINGLE,val:p,count:1,score:0}; }
        if (n===2 && maxFreq+nw>=2) { const v=vals.length>0?vals[vals.length-1]:15; return {type:C.HAND_PAIR,val:v,count:2,score:0}; }
        if (n===3 && maxFreq+nw>=3) { const v=vals.length>0?vals[vals.length-1]:15; return {type:C.HAND_TRIPLE,val:v,count:3,score:0}; }
        if (n===5) {
            const straightVals = vals.filter(v=>v<=14);
            if (straightVals.length>=3 && straightVals.length+nw>=5) {
                const gap = straightVals[straightVals.length-1]-straightVals[0];
                if (gap<=4) {
                    const allStraightable = normPowers.every(p=>p<=14);
                    if (allStraightable) {
                        let isFlush = false;
                        if (normSuits.length>0) {
                            const fs = normSuits[0];
                            isFlush = normSuits.every(s=>s===fs) && allStraightable;
                        }
                        if (isFlush && norms.length+nw>=5)
                            return {type:C.HAND_STRAIGHT_FLUSH,val:straightVals[straightVals.length-1],count:5,score:550};
                        else
                            return {type:C.HAND_STRAIGHT,val:straightVals[straightVals.length-1],count:5,score:0};
                    }
                }
            }
            if (vals.length<=2 && maxFreq>=2) {
                let tripleVal = vals[vals.length-1];
                for (const v of vals) { if (powerCounts[v]>=3) { tripleVal=v; break; } }
                if (maxFreq+nw>=3) return {type:C.HAND_FULLHOUSE,val:tripleVal,count:5,score:0};
            }
        }
        if (n===6 && vals.length===2 && vals[1]===vals[0]+1) {
            if (powerCounts[vals[0]]+nw>=3) return {type:C.HAND_PLATE,val:vals[0],count:6,score:0};
        }
        if (n===6 && vals.length===3) {
            if (vals[1]===vals[0]+1 && vals[2]===vals[1]+1) {
                if (vals.every(v=>(powerCounts[v]||0)>=1))
                    return {type:C.HAND_TUBE,val:vals[0],count:6,score:0};
            }
        }
        return null;
    }

    function getHandScore(ht) {
        if (!ht) return -1;
        if (ht.type===C.HAND_BOMB) return ht.score||ht.count*100;
        if (ht.type===C.HAND_STRAIGHT_FLUSH) return ht.score||550;
        return 0;
    }

    G.HandDetector = { detectHand, getHandScore };
})();
