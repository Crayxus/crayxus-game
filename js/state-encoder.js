/**
 * State encoder (322-dim). G.StateEncoder
 */
(function() {
    const G = window.G; const C = G.Card;
    const STATE_DIM = 322;

    function encodeState(state) {
        const vec = new Float32Array(STATE_DIM);
        let o = 0;
        for (let i=0;i<C.NUM_UNIQUE;i++) vec[o+i]=state.my_hand[i]; o+=C.NUM_UNIQUE;
        for (let i=0;i<C.NUM_UNIQUE;i++) vec[o+i]=state.my_played[i]; o+=C.NUM_UNIQUE;
        for (let i=0;i<C.NUM_UNIQUE;i++) vec[o+i]=state.left_opp_played[i]; o+=C.NUM_UNIQUE;
        for (let i=0;i<C.NUM_UNIQUE;i++) vec[o+i]=state.partner_played[i]; o+=C.NUM_UNIQUE;
        for (let i=0;i<C.NUM_UNIQUE;i++) vec[o+i]=state.right_opp_played[i]; o+=C.NUM_UNIQUE;
        const lh = state.last_hand;
        if (lh) {
            let mapped = lh.type||'pass';
            if (mapped==='bomb'&&lh.val===999) mapped='joker_bomb';
            else if (mapped==='bomb'&&(lh.count||4)>4) mapped='bomb'+Math.min(lh.count||4,8);
            const idx = C.HAND_TYPE_TO_IDX[mapped]!==undefined?C.HAND_TYPE_TO_IDX[mapped]:9;
            if (idx<C.NUM_HAND_TYPES) vec[o+idx]=1.0;
        } else { vec[o+9]=1.0; }
        o+=C.NUM_HAND_TYPES;
        if (lh&&lh.val!==undefined&&lh.val!==999) vec[o+Math.min(Math.max(lh.val-3,0),14)]=1.0;
        o+=15;
        if (lh) vec[o]=(lh.count||0)/8.0; o+=1;
        const counts=state.counts, seat=state.my_seat;
        for (let i=0;i<4;i++) vec[o+i]=counts[(seat+i)%4]/27.0; o+=4;
        const fo=state.finish_order||[];
        for (let i=0;i<4;i++) vec[o+i]=fo.includes((seat+i)%4)?1.0:0.0; o+=4;
        const ac=[]; for (let i=0;i<4;i++){const rs=(seat+i)%4; if(!fo.includes(rs)) ac.push([counts[rs],i]);}
        if (ac.length>0) {
            const mc=counts[seat], mn=Math.min(...ac.map(([c])=>c));
            vec[o]=(mc===mn&&mc>0)?1.0:0.0;
            const pa=(seat+2)%4; vec[o+1]=(counts[pa]===mn&&!fo.includes(pa))?1.0:0.0;
        }
        vec[o+2]=lh===null?1.0:0.0; o+=3;
        for (let i=0;i<4;i++) vec[o+i]=(27-counts[(seat+i)%4])/27.0; o+=4;
        const bc=state.bomb_counts||[0,0,0,0];
        for (let i=0;i<4;i++) vec[o+i]=bc[(seat+i)%4]/4.0; o+=4;
        vec[o]=state.my_hand[C.WILD_CARD_UID]/2.0;
        let ws=0; for (const k of ['my_played','left_opp_played','partner_played','right_opp_played']) ws+=state[k][C.WILD_CARD_UID];
        vec[o+1]=ws/4.0;
        return vec;
    }

    G.StateEncoder = { STATE_DIM, encodeState };
})();
