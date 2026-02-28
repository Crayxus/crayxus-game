/**
 * Hand comparison. G.HandComparator
 */
(function() {
    const G = window.G;
    const C = G.Card;

    function canBeat(attacker, defender) {
        if (!attacker || !defender) return false;
        const aIsBomb = attacker.type===C.HAND_BOMB||attacker.type===C.HAND_STRAIGHT_FLUSH;
        const dIsBomb = defender.type===C.HAND_BOMB||defender.type===C.HAND_STRAIGHT_FLUSH;
        if (aIsBomb && !dIsBomb) return true;
        if (!aIsBomb && dIsBomb) return false;
        if (aIsBomb && dIsBomb) {
            const as = G.HandDetector.getHandScore(attacker);
            const ds = G.HandDetector.getHandScore(defender);
            if (as > ds) return true;
            if (as < ds) return false;
            return attacker.val > defender.val;
        }
        if (attacker.type !== defender.type) return false;
        if (attacker.count !== defender.count) return false;
        return attacker.val > defender.val;
    }

    G.HandComparator = { canBeat };
})();
