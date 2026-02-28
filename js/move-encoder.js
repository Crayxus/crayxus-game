/** Move encoder (54-dim). G.MoveEncoder */
(function() {
    const G = window.G;
    const MOVE_DIM = 54;
    function encodeMove(uids) {
        const vec = new Float32Array(MOVE_DIM);
        for (const uid of uids) vec[uid]+=1.0;
        return vec;
    }
    G.MoveEncoder = { MOVE_DIM, encodeMove };
})();
