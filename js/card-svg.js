/** Card rendering with HTML divs. G.CardSVG */
(function() {
    const G = window.G; const C = G.Card;
    const SUIT_SYMBOLS = {0:'\u2660',1:'\u2665',2:'\u2663',3:'\u2666'};
    const SUIT_RED = {0:false,1:true,2:false,3:true};

    function createCardSVG(uid, opts) {
        opts = opts||{};
        const {selected=false, small=false, faceDown=false} = opts;

        const card = document.createElement('div');
        card.className = 'card';
        if (small) card.classList.add('c-mini');

        if (faceDown) {
            card.classList.add('c-back');
            return card;
        }

        const [suit, val] = C.uidToSuitVal(uid);
        const isJoker = suit === 4;
        const isSJ = uid === C.SMALL_JOKER_UID;
        const isWC = uid === C.WILD_CARD_UID;

        if (isJoker) {
            card.classList.add('joker');
            card.classList.add(isSJ ? 'joker-small' : 'joker-big');
            const color = isSJ ? '#333' : '#dc3545';

            const jt = document.createElement('div');
            jt.className = 'joker-text';
            jt.textContent = 'JOKER';
            jt.style.color = color;
            card.appendChild(jt);

            const ci = document.createElement('div');
            ci.className = 'center-icon';
            ci.textContent = '\u2605';
            ci.style.color = color;
            card.appendChild(ci);

            return card;
        }

        const isRed = SUIT_RED[suit];
        card.classList.add(isRed ? 'c-red' : 'c-blk');

        if (isWC) {
            card.classList.add('c-wild');
        }

        const valStr = C.VAL_NAMES[val];
        const suitSym = SUIT_SYMBOLS[suit];

        // Top-left value
        const vt = document.createElement('div');
        vt.className = 'val-txt';
        vt.textContent = valStr;
        card.appendChild(vt);

        // Suit below value
        const st = document.createElement('div');
        st.className = 'suit-txt';
        st.textContent = suitSym;
        st.style.color = isRed ? '#dc3545' : '#2d2d2d';
        card.appendChild(st);

        // Center icon
        const ci = document.createElement('div');
        ci.className = 'center-icon';
        ci.textContent = suitSym;
        card.appendChild(ci);

        // Wild card label
        if (isWC) {
            const pk = document.createElement('div');
            pk.className = 'peek-label';
            pk.textContent = '\u767e\u642d';
            card.appendChild(pk);
        }

        return card;
    }

    G.CardSVG = { createCardSVG };
})();
