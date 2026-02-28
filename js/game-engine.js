/**
 * Game engine. G.GameEngine
 */
(function() {
    const G = window.G;
    const C = G.Card;

    class GameState {
        constructor() { this.reset(); }
        reset() {
            this.hands = C.shuffleAndDeal();
            this.played = []; for (let i=0;i<4;i++) this.played.push(new Int32Array(C.NUM_UNIQUE));
            this.turn = Math.floor(Math.random()*4);
            this.lastHand = null; this.lastHandOwner = -1;
            this.passCount = 0; this.finishOrder = [];
            this.gameOver = false; this.bombCounts = [0,0,0,0];
            this.history = [];
            return this;
        }
        currentHand() { return this.hands[this.turn]; }
        getLegalMoves() { return G.MoveGenerator.getAllMoves(this.hands[this.turn], this.lastHand); }
        cardsRemaining() {
            return this.hands.map(h => { let s=0; for (let i=0;i<h.length;i++) s+=h[i]; return s; });
        }
        step(moveUids) {
            const seat = this.turn;
            const result = {seat, gameOver:false, isRoundEnd:false};
            if (!moveUids||moveUids.length===0) {
                result.type = C.HAND_PASS; result.handType = null;
                this.passCount++;
                this.history.push({seat, actionType:C.HAND_PASS, moveUids:[], handType:null});
            } else {
                const handType = G.HandDetector.detectHand(moveUids);
                if (!handType) throw new Error('Invalid hand: '+moveUids);
                if (this.lastHand!==null && !G.HandComparator.canBeat(handType,this.lastHand))
                    throw new Error('Cannot beat');
                const moveVec = C.moveToVec(moveUids);
                for (let i=0;i<C.NUM_UNIQUE;i++) { this.hands[seat][i]-=moveVec[i]; this.played[seat][i]+=moveVec[i]; }
                if (handType.type==='bomb'||handType.type==='straight_flush') this.bombCounts[seat]++;
                this.lastHand = handType; this.lastHandOwner = seat; this.passCount = 0;
                result.type = 'play'; result.handType = handType;
                this.history.push({seat, actionType:'play', moveUids:moveUids.slice(), handType});
                let hs=0; for (let i=0;i<C.NUM_UNIQUE;i++) hs+=this.hands[seat][i];
                if (hs===0 && !this.finishOrder.includes(seat)) this.finishOrder.push(seat);
            }
            let gameOver = false;
            if (this.finishOrder.length>=2) {
                const t0 = C.TEAM_A.every(s=>this.finishOrder.includes(s));
                const t1 = C.TEAM_B.every(s=>this.finishOrder.includes(s));
                if (t0||t1) {
                    const rem = [0,1,2,3].filter(s=>!this.finishOrder.includes(s));
                    rem.sort((a,b)=>{let sa=0,sb=0; for(let i=0;i<C.NUM_UNIQUE;i++){sa+=this.hands[a][i];sb+=this.hands[b][i];} return sa-sb;});
                    this.finishOrder.push(...rem); gameOver=true;
                }
            }
            if (this.finishOrder.length>=3) {
                for (let s=0;s<4;s++) if (!this.finishOrder.includes(s)) this.finishOrder.push(s);
                gameOver=true;
            }
            if (gameOver) {
                this.gameOver=true; result.gameOver=true;
                result.finishOrder=this.finishOrder.slice();
                result.rewards=this._computeRewards(); return result;
            }
            const active = 4-this.finishOrder.length;
            const needed = Math.max(active-1,1);
            if (this.passCount>=needed && this.lastHand!==null) {
                // 接风 (jie feng): if the person whose hand nobody beat has already finished,
                // their PARTNER leads the next round instead of the normal next player.
                let jiefengSeat = -1;
                const lho = this.lastHandOwner;
                if (lho>=0 && this.finishOrder.includes(lho)) {
                    const partner = (lho+2)%4;
                    if (!this.finishOrder.includes(partner)) jiefengSeat = partner;
                }
                this.lastHand=null; this.lastHandOwner=-1; this.passCount=0; result.isRoundEnd=true;
                if (jiefengSeat>=0) { this.turn=jiefengSeat; return result; }
            }
            let next = (seat+1)%4;
            for (let i=0;i<4;i++) { if (!this.finishOrder.includes(next)) break; next=(next+1)%4; }
            this.turn = next;
            return result;
        }
        _computeRewards() {
            const r=[0,0,0,0];
            for (let p=0;p<this.finishOrder.length&&p<4;p++) r[this.finishOrder[p]]=C.FINISH_REWARDS[p];
            return r;
        }
        getStateForPlayer(seat) {
            const lo=(seat+1)%4, pa=(seat+2)%4, ro=(seat+3)%4;
            return {
                my_hand:this.hands[seat].slice(), my_played:this.played[seat].slice(),
                left_opp_played:this.played[lo].slice(), partner_played:this.played[pa].slice(),
                right_opp_played:this.played[ro].slice(),
                last_hand:this.lastHand, last_hand_owner:this.lastHandOwner,
                counts:this.cardsRemaining(), my_seat:seat,
                finish_order:this.finishOrder.slice(), bomb_counts:this.bombCounts.slice(), turn:this.turn,
            };
        }
    }

    G.GameEngine = { GameState };
})();
