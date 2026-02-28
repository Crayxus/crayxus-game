/** History encoder (15x62). G.HistoryEncoder */
(function() {
    const G = window.G;
    const HISTORY_DIM = 62, SEQ_LEN = 15;

    function encodeHistoryStep(moveUids, actorSeat, observerSeat, isBomb) {
        const vec = new Float32Array(HISTORY_DIM);
        if (moveUids&&moveUids.length>0) { for (const uid of moveUids) vec[uid]+=1.0; }
        else { vec[58]=1.0; }
        const rel = ((actorSeat-observerSeat)%4+4)%4;
        vec[54+rel]=1.0;
        vec[59]=isBomb?1.0:0.0;
        vec[60]=(moveUids&&moveUids.length>0)?moveUids.length/8.0:0.0;
        return vec;
    }

    function encodeHistory(gameState, seat, seqLen) {
        seqLen = seqLen||SEQ_LEN;
        const history = new Float32Array(seqLen*HISTORY_DIM);
        const raw = gameState.history;
        const n = raw.length, start = Math.max(0,n-seqLen);
        const steps = raw.slice(start);
        const offset = seqLen-steps.length;
        for (let i=0;i<steps.length;i++) {
            const {seat:as, actionType, moveUids, handType} = steps[i];
            const isBomb = handType&&(handType.type==='bomb'||handType.type==='straight_flush');
            const sv = encodeHistoryStep(moveUids, as, seat, isBomb);
            const row = offset+i;
            for (let j=0;j<HISTORY_DIM;j++) history[row*HISTORY_DIM+j]=sv[j];
        }
        return history;
    }

    G.HistoryEncoder = { HISTORY_DIM, SEQ_LEN, encodeHistory };
})();
