/** Scoring system with ELO rating. G.Scoring */
(function() {
    const G = window.G;
    const TIERS = [
        {name:'青铜',icon:'🥉',minElo:800,color:'#cd7f32'},
        {name:'白银',icon:'🥈',minElo:1200,color:'#c0c0c0'},
        {name:'黄金',icon:'🏅',minElo:1500,color:'#ffd700'},
        {name:'铂金',icon:'💎',minElo:1700,color:'#00bcd4'},
        {name:'钻石',icon:'⭐',minElo:1900,color:'#e040fb'},
        {name:'大师',icon:'👑',minElo:2100,color:'#ff6f00'},
        {name:'宗师',icon:'🔥',minElo:2300,color:'#ff1744'},
    ];
    const RANK_LABELS = ['头游','二游','三游','末游'];
    const LS_KEY = 'guandan_ai_stats';
    const K_FACTOR = 32;
    const AI_ELO = 1500;
    const ELO_FLOOR = 800;

    function defaultStats() {
        return {elo:1500,totalGames:0,wins:0,losses:0,maxElo:1500,
                winStreak:0,maxWinStreak:0,bombsUsed:0,
                finishPositions:[0,0,0,0],region:null,nickname:null,recentGames:[]};
    }

    function loadStats() {
        try {
            const d = JSON.parse(localStorage.getItem(LS_KEY));
            if (d) {
                const stats = {...defaultStats(), ...d};
                // Migrate from old point-based system
                if (stats.score !== undefined && stats.elo === undefined) {
                    stats.elo = 1500;
                    stats.maxElo = 1500;
                    delete stats.score;
                    delete stats.maxScore;
                }
                if (stats.elo === undefined) stats.elo = 1500;
                if (stats.maxElo === undefined) stats.maxElo = stats.elo;
                return stats;
            }
        } catch(e) {}
        return defaultStats();
    }
    function saveStats(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }

    function expectedScore(myElo, opElo) {
        return 1 / (1 + Math.pow(10, (opElo - myElo) / 400));
    }

    function calculateGameScore(result, mySeat) {
        const myPos = result.finishOrder.indexOf(mySeat);
        const details = [];

        // Actual score: win (top 2) = 1, lose (bottom 2) = 0
        const win = myPos < 2;
        const actual = win ? 1 : 0;

        // Load current stats for ELO calc
        let currentElo;
        try {
            const d = JSON.parse(localStorage.getItem(LS_KEY));
            currentElo = (d && d.elo) ? d.elo : 1500;
        } catch(e) { currentElo = 1500; }

        const E = expectedScore(currentElo, AI_ELO);
        let eloDelta = Math.round(K_FACTOR * (actual - E));

        // Position bonus
        const posBonus = [8, 0, 0, -8];
        eloDelta += posBonus[myPos];
        details.push({label: RANK_LABELS[myPos], value: posBonus[myPos]});

        // Bomb bonus
        const myBombs = result.bombCounts[mySeat] || 0;
        if (myBombs > 0) {
            const bb = myBombs * 2;
            eloDelta += bb;
            details.push({label: '炸弹x' + myBombs, value: bb});
        }

        // Double win bonus
        const partner = (mySeat + 2) % 4;
        const partnerPos = result.finishOrder.indexOf(partner);
        if (myPos < 2 && partnerPos < 2) {
            eloDelta += 12;
            details.push({label: '双上游', value: 12});
        }

        return {eloDelta, details, position: myPos, positionLabel: RANK_LABELS[myPos], win};
    }

    function updateStats(stats, gs) {
        const oldElo = stats.elo;
        const oldTier = getTier(oldElo);

        stats.totalGames++;
        stats.finishPositions[gs.position]++;
        if (gs.win) {
            stats.wins++;
            stats.winStreak++;
            if (stats.winStreak > stats.maxWinStreak) stats.maxWinStreak = stats.winStreak;
        } else {
            stats.losses++;
            stats.winStreak = 0;
        }

        stats.elo = Math.max(ELO_FLOOR, stats.elo + gs.eloDelta);
        if (stats.elo > stats.maxElo) stats.maxElo = stats.elo;

        const newTier = getTier(stats.elo);
        const tierChanged = newTier.minElo !== oldTier.minElo;
        const tierUp = newTier.minElo > oldTier.minElo;

        stats.recentGames.push({time: Date.now(), position: gs.position, eloDelta: gs.eloDelta});
        if (stats.recentGames.length > 20) stats.recentGames = stats.recentGames.slice(-20);

        saveStats(stats);
        return {stats, oldElo, newElo: stats.elo, tierChanged, tierUp, oldTier, newTier};
    }

    function getTier(elo) {
        let tier = TIERS[0];
        for (const t of TIERS) if (elo >= t.minElo) tier = t;
        const idx = TIERS.indexOf(tier);
        const next = TIERS[idx + 1] || null;
        const progress = next ? (elo - tier.minElo) / (next.minElo - tier.minElo) : 1.0;
        return {...tier, progress, nextTier: next, tierIndex: idx};
    }

    function normalCDF(x) {
        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x) / Math.SQRT2;
        const t = 1 / (1 + 0.3275911 * x);
        const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
        return 0.5 * (1 + sign * y);
    }

    function estimatePercentile(elo, scope) {
        // ELO normal distribution: mean ~1500, sigma ~200
        const params = {
            national: {mu: 1500, sigma: 200, pop: 28000000},
            province: {mu: 1480, sigma: 190, pop: 800000},
            city:     {mu: 1460, sigma: 180, pop: 120000}
        };
        const p = params[scope] || params.national;
        const z = (elo - p.mu) / p.sigma;
        const pct = normalCDF(z);
        return {rank: Math.max(1, Math.round(p.pop * (1 - pct))), percentile: Math.round(pct * 10000) / 100, total: p.pop};
    }

    function generateLeaderboard(myElo, scope, count) {
        count = count || 50;
        const board = [];
        let seed = 0;
        for (const c of (scope || 'national')) seed += c.charCodeAt(0);
        const sr = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
        const names = ['牌神小明','掘弹达人','张三丰','王炸弹','李天王',
            '赵铁柱','周游冠军','钱多多','孙小小','吴用强',
            '郑百搞','林志玄','黄老邪','刘必赢','杨无敌',
            '周天天','吴美丽','郑小龙','王小虎','张红色',
            '林强','李明明','周星星','丁真一','赵牛牛',
            '钱满贯','吴不服','游戏达人','掘子手','炸弹侠',
            '顺子王','对子王','三条王','全开火','小强强',
            '大强强','老强强','强中强','花花公子','花开富贵',
            '一路向前','永不言败','必胜客','最强王者','牛转乾坤',
            '飞龙在天','虎虎生威','龙马精神','开心果','快乐星'];
        for (let i = 0; i < count; i++) {
            // Generate ELO scores that decrease from top
            const topElo = Math.max(myElo + 300, 2200);
            const decay = Math.pow(0.985, i);
            const baseElo = Math.round(topElo * decay + (sr() % 60 - 30));
            const elo = Math.max(baseElo, 800);
            const ni = (i + sr() % names.length) % names.length;
            const tier = getTier(elo);
            board.push({rank: i + 1, name: names[ni], elo: elo, tier: tier.name, tierIcon: tier.icon, isMe: false});
        }
        board.sort((a, b) => b.elo - a.elo);
        board.forEach((item, i) => item.rank = i + 1);
        return board;
    }

    function getWinRate(s) { return s.totalGames === 0 ? 0 : Math.round(s.wins / s.totalGames * 100); }

    // Star-based tier rating (Hearthstone style)
    // Each tier has 5 stars; Legend tier shows a rank number instead
    const STAR_TIER_DEF = [
        {name:'青铜', icon:'🥉', color:'#cd7f32', minElo:800,  totalElo:400, stars:5},
        {name:'白银', icon:'🥈', color:'#b0b8c8', minElo:1200, totalElo:300, stars:5},
        {name:'黄金', icon:'🏅', color:'#ffd700', minElo:1500, totalElo:200, stars:5},
        {name:'铂金', icon:'💎', color:'#4dd0e1', minElo:1700, totalElo:200, stars:5},
        {name:'钻石', icon:'✨', color:'#ce93d8', minElo:1900, totalElo:200, stars:5},
        {name:'大师', icon:'👑', color:'#ffb300', minElo:2100, totalElo:200, stars:5},
        {name:'宗师', icon:'🔥', color:'#ff4444', minElo:2300, totalElo:Infinity, stars:0},
    ];

    function getStarRating(elo) {
        elo = Math.max(800, elo);
        let tier = STAR_TIER_DEF[0];
        for (const t of STAR_TIER_DEF) { if (elo >= t.minElo) tier = t; }

        if (tier.name === '宗师') {
            const over = elo - 2300;
            const legendRank = Math.max(1, Math.ceil(5000 / (1 + over / 60)));
            return { tier, starsEarned: 0, totalStars: 0, starProgress: 0, isLegend: true, legendRank };
        }

        const eloInTier = elo - tier.minElo;
        const eloPerStar = tier.totalElo / tier.stars;
        const starsEarned = Math.min(tier.stars, Math.floor(eloInTier / eloPerStar));
        const starProgress = (eloInTier % eloPerStar) / eloPerStar;
        return { tier, starsEarned, totalStars: tier.stars, starProgress, isLegend: false, legendRank: 0 };
    }

    G.Scoring = {TIERS, RANK_LABELS, loadStats, saveStats, calculateGameScore, updateStats, getTier, getStarRating, estimatePercentile, generateLeaderboard, getWinRate};
})();
