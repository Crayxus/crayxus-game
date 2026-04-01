"""从训练好的 AI 模型生成测评题库。

每道题：随机生成牌局 → 模型评估所有合法出牌 → Q 值最高=正确答案。
答案来自大模型，不是人工编写。

Usage:
    python generate_quiz.py --output js/quiz-data.json
"""
import os, sys, json, random
import numpy as np
import torch

sys.path.insert(0, os.path.dirname(__file__))

from guandan_ai.dmc.config_dmc import DMCConfigV5
from guandan_ai.dmc.dmc_model import create_model
from guandan_ai.encoding.state_encoder_v5 import encode_state_v5
from guandan_ai.encoding.move_encoder import encode_move
from guandan_ai.dmc.utils import encode_history
from guandan_ai.game.game_engine import GameState
from guandan_ai.game.card import uid_to_suit_val, uid_to_str
from guandan_ai.game.hand_decomposer import min_plays


SUITS_ZH = {0: '♠', 1: '♥', 2: '♣', 3: '♦', 4: ''}
VALS_ZH = {3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',
           11:'J',12:'Q',13:'K',14:'A',15:'2',16:'小王',17:'大王'}


def uid_to_card(uid):
    s, v = uid_to_suit_val(uid)
    suit_char = ['S','H','C','D','JK'][s]
    return {'s': suit_char, 'v': v, 'name': f"{SUITS_ZH[s]}{VALS_ZH[v]}"}


def move_to_str(move_uids):
    if not move_uids:
        return 'PASS'
    cards = [uid_to_card(u) for u in move_uids]
    return ' '.join(c['name'] for c in cards)


def detect_move_type(move_uids):
    if not move_uids:
        return 'PASS'
    n = len(move_uids)
    powers = [uid_to_suit_val(u)[1] for u in move_uids]
    unique = set(powers)

    if n == 1: return '单牌'
    if n == 2 and len(unique) == 1: return '对子'
    if n == 3 and len(unique) == 1: return '三条'
    if n == 4 and len(unique) == 1: return '炸弹'
    if n == 5:
        sorted_p = sorted(powers)
        if len(unique) == 5 and sorted_p[-1] - sorted_p[0] == 4:
            return '顺子'
        if len(unique) == 2:
            from collections import Counter
            c = Counter(powers)
            if 3 in c.values():
                return '三带二'
    if n >= 5 and len(unique) == n:
        sorted_p = sorted(powers)
        if sorted_p[-1] - sorted_p[0] == n - 1:
            return '顺子'
    if n == 6:
        from collections import Counter
        c = Counter(powers)
        vals = sorted(c.values())
        if vals == [2, 2, 2]:
            ps = sorted(c.keys())
            if ps[-1] - ps[0] == 2:
                return '连对'
        if vals == [3, 3]:
            return '钢板'
    return f'{n}张牌'


def generate_question(model, cfg, device, game, seat, dim_label):
    """Generate one quiz question from a game state."""
    state_info = game.get_state_for_player(seat)
    legal_moves = game.get_legal_moves()

    if len(legal_moves) < 3:
        return None

    # Encode and evaluate all moves
    sv = encode_state_v5(state_info, game_state=game)
    hist = encode_history(game, seat, cfg.seq_len)
    n = len(legal_moves)
    h_b = np.tile(hist, (n, 1, 1))
    sa_b = np.zeros((n, cfg.state_dim + cfg.move_dim), dtype=np.float32)
    for i, mv in enumerate(legal_moves):
        sa_b[i, :cfg.state_dim] = sv
        sa_b[i, cfg.state_dim:] = encode_move(mv)

    with torch.no_grad():
        h_t = torch.from_numpy(h_b).to(device)
        sa_t = torch.from_numpy(sa_b).to(device)
        q_values = model(h_t, sa_t).cpu().numpy().flatten()

    # Sort by Q-value
    ranked = sorted(range(n), key=lambda i: -q_values[i])

    # Need at least 4 distinct options
    if len(ranked) < 4:
        return None

    # Pick top 1 (correct) + 3 others (wrong but plausible)
    best_idx = ranked[0]
    # Pick options: best, 2nd, middle, worst-ish
    option_indices = [ranked[0]]
    if len(ranked) > 1: option_indices.append(ranked[1])
    if len(ranked) > 3: option_indices.append(ranked[len(ranked)//2])
    if len(ranked) > 2: option_indices.append(ranked[-1])

    # Deduplicate
    seen = set()
    unique_options = []
    for idx in option_indices:
        key = str(legal_moves[idx])
        if key not in seen:
            seen.add(key)
            unique_options.append(idx)
    if len(unique_options) < 4:
        # Fill with random
        for idx in ranked:
            key = str(legal_moves[idx])
            if key not in seen:
                seen.add(key)
                unique_options.append(idx)
            if len(unique_options) >= 4:
                break

    if len(unique_options) < 4:
        return None

    unique_options = unique_options[:4]

    # Build question
    hand = state_info['my_hand']
    hand_cards = []
    for uid in range(54):
        for _ in range(int(hand[uid])):
            hand_cards.append(uid_to_card(uid))

    counts = state_info['counts']
    last_hand = state_info['last_hand']
    m_value = min_plays(hand)

    # Scenario text + last played cards
    last_play_cards = []
    if last_hand is None or last_hand.get('type') == 'pass':
        scenario = '自由出牌'
    else:
        lh_owner = state_info.get('last_hand_owner', -1)
        rel = (lh_owner - seat) % 4
        who = ['你', '下家(对手)', '队友', '上家(对手)'][rel]
        # Get the actual cards from game history
        if game.history:
            for h_seat, h_type, h_uids, h_ht in reversed(game.history):
                if h_type != 'pass' and h_uids:
                    last_play_cards = [uid_to_card(u) for u in h_uids]
                    lh_type = detect_move_type(h_uids)
                    scenario = f'{who}出了{lh_type}，轮到你'
                    break
            if not last_play_cards:
                scenario = f'{who}出了牌，轮到你'
        else:
            scenario = f'{who}出了牌，轮到你'

    # Options
    options = []
    for oi, idx in enumerate(unique_options):
        mv = legal_moves[idx]
        mv_str = move_to_str(mv)
        mv_type = detect_move_type(mv)
        q = float(q_values[idx])
        is_best = (idx == best_idx)

        # Calculate M-value after this move
        if mv:
            from guandan_ai.game.card import move_to_vec
            after = hand.copy()
            after -= move_to_vec(mv)
            m_after = min_plays(after) if after.sum() > 0 else 0
        else:
            m_after = m_value

        options.append({
            'text': f'{mv_type}: {mv_str}' if mv else 'PASS',
            'correct': is_best,
            'q_value': round(q, 4),
            'q_rank': ranked.index(idx) + 1,
            'm_after': m_after,
            'explain': f'Q值={q:.3f} (排名第{ranked.index(idx)+1}/{n}), 出牌后M值={m_after}'
        })

    # Best option explain
    best_opt = [o for o in options if o['correct']][0]
    best_opt['explain'] = f'AI推荐最优选择 (Q值最高={best_opt["q_value"]:.3f}), 出牌后M值={best_opt["m_after"]}'

    return {
        'dim': dim_label,
        'scenario': scenario,
        'hand': hand_cards,
        'last_play': last_play_cards if last_play_cards else None,
        'question': '你会怎么出牌？',
        'options': options,
        'n_legal': n,
    }


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', default='dmc_checkpoints_v7/dmc_v7_human.pt')
    parser.add_argument('--output', default='js/quiz-data.json')
    parser.add_argument('--n', type=int, default=60)  # generate more, pick best 20
    args = parser.parse_args()

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    cfg = DMCConfigV5()
    model = create_model(cfg).to(device)
    sd = torch.load(args.model, map_location=device, weights_only=False)
    model.load_state_dict(sd)
    model.eval()
    print(f'Model loaded: {args.model}')

    # Generate questions at different game stages
    dims = {
        '组牌分解': [],  # early game, free play
        '大牌控制': [],  # mid game, following
        '出牌时机': [],  # various
        '队友配合': [],  # teammate context
        '炸弹使用': [],  # bomb situations
        '终局处理': [],  # late game
    }

    target_per_dim = {'组牌分解': 60, '大牌控制': 55, '出牌时机': 55,
                      '队友配合': 55, '炸弹使用': 55, '终局处理': 60}

    print('Generating questions...')
    attempts = 0
    max_attempts = 8000

    while attempts < max_attempts:
        attempts += 1
        rng = np.random.default_rng(seed=attempts + 10000)
        game = GameState(rng)

        # Play random number of steps to get various game stages
        steps_to_play = random.randint(0, 60)
        from guandan_ai.agents.rule_agent import RuleAgent
        rule = RuleAgent()

        for _ in range(steps_to_play):
            if game.game_over:
                break
            seat = game.turn
            try:
                move = rule(game, seat)
                game.step(move)
            except:
                break

        if game.game_over:
            continue

        seat = game.turn
        cards_left = int(game.hands[seat].sum())
        has_last = game.last_hand is not None

        # Determine dimension based on game state
        if cards_left > 20 and not has_last:
            dim = '组牌分解'
        elif cards_left > 15 and has_last:
            dim = '大牌控制'
        elif cards_left > 10:
            dim = '出牌时机' if random.random() > 0.5 else '队友配合'
        elif cards_left > 5:
            dim = '炸弹使用' if random.random() > 0.5 else '出牌时机'
        else:
            dim = '终局处理'

        if len(dims[dim]) >= target_per_dim[dim]:
            # Check if all full
            if all(len(v) >= target_per_dim[k] for k, v in dims.items()):
                break
            continue

        q = generate_question(model, cfg, device, game, seat, dim)
        if q:
            dims[dim].append(q)
            total = sum(len(v) for v in dims.values())
            print(f'  [{total}] {dim}: {cards_left} cards, {q["n_legal"]} moves')

    # Select best questions per dimension
    final_questions = []
    pick = {'组牌分解': 55, '大牌控制': 50, '出牌时机': 50,
            '队友配合': 50, '炸弹使用': 50, '终局处理': 55}

    for dim, qs in dims.items():
        # Sort by number of legal moves (more options = more interesting)
        qs.sort(key=lambda q: -q['n_legal'])
        selected = qs[:pick[dim]]
        final_questions.extend(selected)
        print(f'{dim}: {len(selected)}/{pick[dim]} questions')

    # Shuffle
    random.shuffle(final_questions)

    # Save
    output = {
        'version': 'v1_model_generated',
        'model': args.model,
        'total': len(final_questions),
        'dimensions': list(dims.keys()),
        'questions': final_questions,
    }

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f'\nSaved {len(final_questions)} questions to {args.output}')


if __name__ == '__main__':
    main()
