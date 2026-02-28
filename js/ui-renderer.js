/** UI Renderer. G.UIRenderer */
(function() {
    const G = window.G; const C = G.Card;
    const HAND_TYPE_NAMES = {
        'single':'\u5355\u724c','pair':'\u5bf9\u5b50','triple':'\u4e09\u6761',
        'fullhouse':'\u4e09\u5e26\u4e8c','straight':'\u987a\u5b50','straight_flush':'\u540c\u82b1\u987a',
        'plate':'\u94a2\u677f','tube':'\u7ba1\u5b50','bomb':'\u70b8\u5f39','pass':'\u4e0d\u8981',
    };

    class UIRenderer {
        constructor() {
            this.selectedCards = new Set();
            this.myHandUids = [];
            this._finishInfo = {}; // seat -> finish label
        }

        renderMyHand(hand, lastHand) {
            const container = document.getElementById('hand');
            container.innerHTML = '';
            this.selectedCards.clear();
            const uids = C.handToUids(hand);
            uids.sort((a,b) => {
                const [sa,va] = C.uidToSuitVal(a), [sb,vb] = C.uidToSuitVal(b);
                return va !== vb ? vb - va : sa - sb;
            });
            this.myHandUids = uids;

            // Group by power value for stacking
            const groups = []; let cur = null;
            for (let i = 0; i < uids.length; i++) {
                const [, val] = C.uidToSuitVal(uids[i]);
                if (!cur || cur.val !== val) { cur = {val, cards:[]}; groups.push(cur); }
                cur.cards.push({uid: uids[i], index: i});
            }

            for (const group of groups) {
                const wrap = document.createElement('div');
                wrap.className = 'grp-wrap';

                const col = document.createElement('div');
                col.className = 'grp-col';

                const cardEls = [];
                for (let j = 0; j < group.cards.length; j++) {
                    const {uid, index} = group.cards[j];
                    const sc = document.createElement('div');
                    sc.className = 'stack-card';
                    sc.dataset.uid = uid;
                    sc.dataset.index = index;
                    sc.appendChild(G.CardSVG.createCardSVG(uid));
                    sc.addEventListener('click', () => this._toggle(sc, index));
                    col.appendChild(sc);
                    cardEls.push(sc);
                }

                wrap.appendChild(col);

                // Per-group select all button (only if >1 card)
                if (group.cards.length > 1) {
                    const selBtn = document.createElement('div');
                    selBtn.className = 'grp-sel-btn';
                    selBtn.textContent = '\u5168\u9009';
                    selBtn.addEventListener('click', () => {
                        const allSelected = cardEls.every(el => el.classList.contains('selected'));
                        for (const el of cardEls) {
                            const idx = parseInt(el.dataset.index);
                            if (allSelected) {
                                this.selectedCards.delete(idx);
                                el.classList.remove('selected');
                            } else {
                                this.selectedCards.add(idx);
                                el.classList.add('selected');
                            }
                        }
                        this._updateBtns();
                    });
                    wrap.appendChild(selBtn);
                }

                container.appendChild(wrap);
            }

            this._updateBtns();
        }

        _toggle(w, index) {
            if (this.selectedCards.has(index)) {
                this.selectedCards.delete(index);
                w.classList.remove('selected');
            } else {
                this.selectedCards.add(index);
                w.classList.add('selected');
            }
            this._updateBtns();
        }

        _updateBtns() {
            const pb = document.getElementById('btn-play');
            if (pb) pb.disabled = this.selectedCards.size === 0;
        }

        getSelectedUids() { return [...this.selectedCards].map(i => this.myHandUids[i]); }

        renderOpponent(pos, count, name, isTeammate, seat) {
            const zoneId = pos === 'top' ? 'pz-top' : pos === 'left' ? 'pz-left' : 'pz-right';
            const zone = document.getElementById(zoneId);
            if (!zone) return;

            const av = zone.querySelector('.av');
            if (av) {
                av.className = 'av ' + (isTeammate ? 'team-a' : 'team-b');
                av.textContent = name.charAt(0);

                // Card count badge
                let badge = zone.querySelector('.badge-n');
                if (!badge) {
                    badge = document.createElement('div');
                    badge.className = 'badge-n';
                    av.appendChild(badge);
                }
                badge.textContent = count;

                // Finish badge
                const finishLabel = this._finishInfo[seat];
                let fbadge = zone.querySelector('.badge-finish');
                if (finishLabel) {
                    if (!fbadge) {
                        fbadge = document.createElement('div');
                        fbadge.className = 'badge-finish';
                        av.appendChild(fbadge);
                    }
                    fbadge.textContent = finishLabel;
                    av.classList.add('finished');
                } else {
                    if (fbadge) fbadge.remove();
                    av.classList.remove('finished');
                }

                if (count === 0 && !finishLabel) {
                    av.classList.add('finished');
                }
            }
        }

        setFinishInfo(seat, label) {
            this._finishInfo[seat] = label;
        }

        clearFinishInfo() {
            this._finishInfo = {};
        }

        showPlayedCards(pos, moveUids, handType) {
            const areaId = pos === 'top' ? 'out-top' : pos === 'left' ? 'out-left' :
                           pos === 'right' ? 'out-right' : 'out-me';
            const area = document.getElementById(areaId);
            if (!area) return;
            area.innerHTML = '';
            area.classList.remove('dimmed');
            area.classList.add('highlight');

            if (!moveUids || moveUids.length === 0) {
                const lb = document.createElement('div');
                lb.className = 'out-label pass-text';
                lb.textContent = '\u4e0d\u8981';
                area.appendChild(lb);
                return;
            }

            const cd = document.createElement('div');
            cd.className = 'out-cards';
            moveUids.sort((a,b) => C.uidToSuitVal(b)[1] - C.uidToSuitVal(a)[1]);
            moveUids.forEach((uid, i) => {
                const cardEl = G.CardSVG.createCardSVG(uid, {small: true});
                cardEl.classList.add('card-appear');
                cardEl.style.animationDelay = (i * 0.04) + 's';
                cd.appendChild(cardEl);
            });
            area.appendChild(cd);

            if (handType) {
                const tag = document.createElement('div');
                const isBomb = handType.type === 'bomb' || handType.type === 'straight_flush';
                tag.className = 'tag' + (isBomb ? ' bomb-tag' : '');
                tag.textContent = HAND_TYPE_NAMES[handType.type] || handType.type;
                area.appendChild(tag);
            }
        }

        showThinking(pos) {
            const zoneId = pos === 'top' ? 'pz-top' : pos === 'left' ? 'pz-left' : 'pz-right';
            const zone = document.getElementById(zoneId);
            if (!zone) return;
            const av = zone.querySelector('.av');
            if (!av) return;

            // Remove existing thinking dots
            const existing = av.querySelector('.thinking');
            if (existing) existing.remove();

            av.classList.add('active');
            const dots = document.createElement('div');
            dots.className = 'thinking';
            dots.innerHTML = '<span></span><span></span><span></span>';
            av.appendChild(dots);
        }

        clearThinking(pos) {
            const zoneId = pos === 'top' ? 'pz-top' : pos === 'left' ? 'pz-left' : 'pz-right';
            const zone = document.getElementById(zoneId);
            if (!zone) return;
            const av = zone.querySelector('.av');
            if (!av) return;
            const dots = av.querySelector('.thinking');
            if (dots) dots.remove();
            av.classList.remove('active');
        }

        clearAllPlayAreas() {
            ['out-top','out-left','out-right','out-me'].forEach(id => {
                const a = document.getElementById(id);
                if (a) { a.innerHTML = ''; a.classList.remove('dimmed','highlight'); }
            });
        }

        dimOtherAreas(exceptId) {
            ['out-top','out-left','out-right','out-me'].forEach(id => {
                const a = document.getElementById(id);
                if (!a) return;
                if (id === exceptId) {
                    a.classList.remove('dimmed');
                    a.classList.add('highlight');
                } else {
                    a.classList.add('dimmed');
                    a.classList.remove('highlight');
                }
            });
        }

        showTurnIndicator(seat, mySeat) {
            // Clear all active states
            document.querySelectorAll('.av.active').forEach(e => e.classList.remove('active'));
            const rel = ((seat - mySeat) + 4) % 4;
            const positions = ['bottom','right','top','left'];
            const pos = positions[rel];
            if (pos !== 'bottom') {
                const zoneId = pos === 'top' ? 'pz-top' : pos === 'left' ? 'pz-left' : 'pz-right';
                const zone = document.getElementById(zoneId);
                if (zone) {
                    const av = zone.querySelector('.av');
                    if (av) av.classList.add('active');
                }
            }
        }

        setActionsEnabled(enabled, canPass) {
            const ctrls = document.getElementById('ctrls');
            const pb = document.getElementById('btn-play');
            const ps = document.getElementById('btn-pass');
            const ph = document.getElementById('btn-hint');
            if (!enabled) {
                if (ctrls) ctrls.classList.add('hidden');
            } else {
                if (ctrls) ctrls.classList.remove('hidden');
                if (pb) pb.disabled = this.selectedCards.size === 0;
                if (ps) ps.disabled = !canPass;
            }
        }

        updateGameInfo(text) {
            const e = document.getElementById('game-info');
            if (e) e.textContent = text;
        }
    }

    G.UIRenderer = UIRenderer;
})();
