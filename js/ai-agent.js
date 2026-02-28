/** AI Agent with ONNX inference. G.AIAgent */
(function() {
    const G = window.G;

    class AIAgent {
        constructor() { this.session=null; this.loading=false; this.loaded=false; }

        async loadModel(modelPath) {
            if (this.loaded||this.loading) return;
            this.loading=true;
            try {
                this.session = await ort.InferenceSession.create(modelPath||'model/guandan_dmc.onnx', {
                    executionProviders:['wasm'], graphOptimizationLevel:'all',
                });
                this.loaded=true; console.log('ONNX model loaded');
            } catch(e) { console.error('Model load failed:',e); this.session=null; }
            finally { this.loading=false; }
        }

        async loadFromBuffer(arrayBuffer) {
            if (this.loaded||this.loading) return;
            this.loading=true;
            try {
                this.session = await ort.InferenceSession.create(arrayBuffer, {
                    executionProviders:['wasm'], graphOptimizationLevel:'all',
                });
                this.loaded=true; console.log('ONNX model loaded from buffer');
            } catch(e) { console.error('Model load from buffer failed:',e); this.session=null; throw e; }
            finally { this.loading=false; }
        }

        async chooseMove(game, seat) {
            const lm = game.getLegalMoves();
            if (lm.length===1) return lm[0];
            if (!this.loaded) return lm[Math.floor(Math.random()*lm.length)];
            const qv = await this._evalMoves(game, seat, lm);
            let bi=0, bq=qv[0];
            for (let i=1;i<qv.length;i++) if (qv[i]>bq){bq=qv[i];bi=i;}
            return lm[bi];
        }

        async _evalMoves(game, seat, legalMoves) {
            const SE = G.StateEncoder, ME = G.MoveEncoder, HE = G.HistoryEncoder;
            const stateInfo = game.getStateForPlayer(seat);
            const stateVec = SE.encodeState(stateInfo);
            const historyArr = HE.encodeHistory(game, seat, HE.SEQ_LEN);
            const n = legalMoves.length;
            const hBatch = new Float32Array(n*HE.SEQ_LEN*HE.HISTORY_DIM);
            for (let i=0;i<n;i++) hBatch.set(historyArr, i*HE.SEQ_LEN*HE.HISTORY_DIM);
            const saDim = SE.STATE_DIM+ME.MOVE_DIM;
            const saBatch = new Float32Array(n*saDim);
            for (let i=0;i<n;i++) {
                saBatch.set(stateVec, i*saDim);
                const mv = ME.encodeMove(legalMoves[i]);
                saBatch.set(mv, i*saDim+SE.STATE_DIM);
            }
            const hT = new ort.Tensor('float32',hBatch,[n,HE.SEQ_LEN,HE.HISTORY_DIM]);
            const saT = new ort.Tensor('float32',saBatch,[n,saDim]);
            const res = await this.session.run({history:hT,state_action:saT});
            const qvT = res.q_value||res[Object.keys(res)[0]];
            const qv = new Float32Array(n);
            for (let i=0;i<n;i++) qv[i]=qvT.data[i];
            return qv;
        }
    }

    G.AIAgent = AIAgent;
})();
