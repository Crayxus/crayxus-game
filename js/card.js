/**
 * Card system for Guandan. Global namespace: G.Card
 */
(function() {
    const G = window.G = window.G || {};

    const NUM_UNIQUE = 54;
    const WILD_CARD_UID = 25;
    const SMALL_JOKER_UID = 52;
    const BIG_JOKER_UID = 53;
    const SPADE = 0, HEART = 1, CLUB = 2, DIAMOND = 3, JOKER_SUIT = 4;

    const SUIT_NAMES = ['\u2660', '\u2665', '\u2663', '\u2666', 'JOKER'];
    const VAL_NAMES = {
        3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',
        10:'10',11:'J',12:'Q',13:'K',14:'A',15:'2',16:'Sm',17:'Bg'
    };

    const HAND_SINGLE='single', HAND_PAIR='pair', HAND_TRIPLE='triple',
          HAND_FULLHOUSE='fullhouse', HAND_STRAIGHT='straight',
          HAND_STRAIGHT_FLUSH='straight_flush', HAND_PLATE='plate',
          HAND_TUBE='tube', HAND_BOMB='bomb', HAND_PASS='pass';

    const HAND_TYPE_LIST = [
        HAND_SINGLE, HAND_PAIR, HAND_TRIPLE, HAND_FULLHOUSE,
        HAND_STRAIGHT, HAND_STRAIGHT_FLUSH, HAND_PLATE, HAND_TUBE,
        HAND_BOMB, HAND_PASS, 'bomb5','bomb6','bomb7','bomb8','joker_bomb'
    ];
    const HAND_TYPE_TO_IDX = {};
    HAND_TYPE_LIST.forEach((t,i) => HAND_TYPE_TO_IDX[t] = i);
    const NUM_HAND_TYPES = 15;

    const TEAM_A = [0,2], TEAM_B = [1,3];
    const FINISH_REWARDS = [3.0, 1.0, -1.0, -3.0];

    function uidToSuitVal(uid) {
        if (uid === SMALL_JOKER_UID) return [4, 16];
        if (uid === BIG_JOKER_UID) return [4, 17];
        return [Math.floor(uid / 13), (uid % 13) + 3];
    }
    function suitValToUid(suit, val) {
        if (val === 16) return SMALL_JOKER_UID;
        if (val === 17) return BIG_JOKER_UID;
        return suit * 13 + (val - 3);
    }
    function uidToStr(uid) {
        const [suit, val] = uidToSuitVal(uid);
        if (suit === 4) return val === 16 ? 'SmJoker' : 'BgJoker';
        return SUIT_NAMES[suit] + VAL_NAMES[val];
    }
    function isWild(uid) { return uid === WILD_CARD_UID; }

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
    function shuffleAndDeal() {
        const deck = new Int32Array(NUM_UNIQUE * 2);
        for (let i = 0; i < NUM_UNIQUE; i++) { deck[2*i] = i; deck[2*i+1] = i; }
        shuffleArray(deck);
        const hands = [];
        for (let i = 0; i < 4; i++) {
            const hand = new Int32Array(NUM_UNIQUE);
            for (let j = i*27; j < (i+1)*27; j++) hand[deck[j]]++;
            hands.push(hand);
        }
        return hands;
    }
    function handToUids(hand) {
        const uids = [];
        for (let uid = 0; uid < NUM_UNIQUE; uid++)
            for (let c = 0; c < hand[uid]; c++) uids.push(uid);
        return uids;
    }
    function moveToVec(uids) {
        const vec = new Int32Array(NUM_UNIQUE);
        for (const uid of uids) vec[uid]++;
        return vec;
    }

    G.Card = {
        NUM_UNIQUE, WILD_CARD_UID, SMALL_JOKER_UID, BIG_JOKER_UID,
        SPADE, HEART, CLUB, DIAMOND, JOKER_SUIT,
        SUIT_NAMES, VAL_NAMES,
        HAND_SINGLE, HAND_PAIR, HAND_TRIPLE, HAND_FULLHOUSE,
        HAND_STRAIGHT, HAND_STRAIGHT_FLUSH, HAND_PLATE, HAND_TUBE,
        HAND_BOMB, HAND_PASS,
        HAND_TYPE_LIST, HAND_TYPE_TO_IDX, NUM_HAND_TYPES,
        TEAM_A, TEAM_B, FINISH_REWARDS,
        uidToSuitVal, suitValToUid, uidToStr, isWild,
        shuffleAndDeal, handToUids, moveToVec,
    };
})();
