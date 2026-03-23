"""AI Pro Server: GPU-powered V5 + Belief Search.

Compatible with frontend MCTS API format (localhost:8000).
Endpoints:
  GET  /health     -> {status: "ok", ...}
  POST /pick_move  -> {move_uids: [...], method: str, time_ms: int}

Frontend sends: {seat, hands, played_cards, last_hand, counts,
                 finish_order, bomb_counts, pass_count, move_history}
"""
import argparse
import json
import time
import traceback
import numpy as np
import torch
from flask import Flask, request, jsonify
from flask_cors import CORS

from guandan_ai.game.constants import TEAM_A, TEAM_B, NUM_UNIQUE
from guandan_ai.encoding.state_encoder_v5 import encode_state_v5
from guandan_ai.encoding.move_encoder import encode_move
from guandan_ai.dmc.dmc_model import DMCModel, get_device
from guandan_ai.dmc.config_dmc import DMCConfigV5
from guandan_ai.dmc.utils import encode_history
from guandan_ai.game.game_engine import GameState
from guandan_ai.game.move_generator import get_all_moves
from belief_network import BeliefNetwork, encode_belief_input
from test_belief_search import sample_hands_from_belief

app = Flask(__name__)
CORS(app)

# Globals
dmc_model = None
belief_model = None
dmc_cfg = None
device = None
rng = np.random.default_rng()

# Search params
NUM_WORLDS = 20
TOP_K = 5
Q_WEIGHT = 0.5
DISCOUNT = 0.95


def rebuild_game_state(data):
    """Reconstruct GameState from frontend serialized data."""
    seat = data['seat']
    hands_raw = data.get('hands', {})
    played_raw = data.get('played_cards', {})
    lh = data.get('last_hand')
    cnt = data.get('counts', [27, 27, 27, 27])
    fin = data.get('finish_order', [])
    bc = data.get('bomb_counts', [0, 0, 0, 0])
    pc = data.get('pass_count', 0)
    hist_raw = data.get('move_history', [])

    # Build hands (54-dim vectors)
    hands = []
    for s in range(4):
        uids = hands_raw.get(str(s), [])
        vec = np.zeros(NUM_UNIQUE, dtype=np.int32)
        for uid in uids:
            if 0 <= uid < NUM_UNIQUE:
                vec[uid] += 1
        hands.append(vec)

    # Build played cards
    played = []
    for s in range(4):
        raw = played_raw.get(str(s), [0] * 54)
        vec = np.array(raw[:54], dtype=np.int32)
        played.append(vec)

    # Build GameState
    gs = GameState.__new__(GameState)
    gs.hands = hands
    gs.played = played
    gs.turn = seat
    gs.last_hand = lh
    gs.last_hand_owner = lh.get('owner', -1) if lh else -1
    gs.pass_count = pc
    gs.finish_order = fin[:]
    gs.game_over = False
    gs.bomb_counts = bc[:]
    gs.rng = np.random.default_rng()

    # Build history
    gs.history = []
    for h in hist_raw:
        h_seat = h.get('seat', 0)
        h_cards = h.get('cards', [])
        is_bomb = h.get('is_bomb', False)
        if not h_cards:
            gs.history.append((h_seat, 'pass', [], None))
        else:
            # Reconstruct hand_type (approximate)
            n = len(h_cards)
            ht = None
            if n == 1:
                ht = {'type': 'single', 'val': 0, 'count': 1}
            elif n == 2:
                ht = {'type': 'pair', 'val': 0, 'count': 2}
            elif n == 3:
                ht = {'type': 'triple', 'val': 0, 'count': 3}
            elif is_bomb:
                ht = {'type': 'bomb', 'val': 0, 'count': n}
            elif n == 5:
                ht = {'type': 'straight', 'val': 0, 'count': 5}
            else:
                ht = {'type': 'play', 'val': 0, 'count': n}
            gs.history.append((h_seat, 'play', h_cards, ht))

    # State dict for encoder
    left_opp = (seat + 1) % 4
    partner = (seat + 2) % 4
    right_opp = (seat + 3) % 4

    state_dict = {
        'my_hand': hands[seat].copy(),
        'my_played': played[seat].copy(),
        'left_opp_played': played[left_opp].copy(),
        'partner_played': played[partner].copy(),
        'right_opp_played': played[right_opp].copy(),
        'last_hand': lh,
        'last_hand_owner': gs.last_hand_owner,
        'counts': cnt,
        'my_seat': seat,
        'finish_order': fin[:],
        'bomb_counts': bc[:],
        'turn': seat,
    }

    return state_dict, gs


def get_legal_moves(gs, seat):
    """Get legal moves for this seat."""
    return get_all_moves(gs.hands[seat], gs.last_hand)


def evaluate_moves(state_dict, gs, legal_moves):
    """Evaluate all legal moves with V5 model."""
    sv = encode_state_v5(state_dict, game_state=gs)
    hist = encode_history(gs, state_dict['my_seat'], dmc_cfg.seq_len)
    n = len(legal_moves)
    h_b = np.tile(hist, (n, 1, 1))
    sa_b = np.zeros((n, dmc_cfg.state_dim + dmc_cfg.move_dim), dtype=np.float32)
    for i, move in enumerate(legal_moves):
        sa_b[i, :dmc_cfg.state_dim] = sv
        sa_b[i, dmc_cfg.state_dim:] = encode_move(move)
    with torch.no_grad():
        h_t = torch.from_numpy(h_b).to(device)
        sa_t = torch.from_numpy(sa_b).to(device)
        return dmc_model(h_t, sa_t).cpu().numpy().flatten()


def belief_search(state_dict, gs, legal_moves, q_values):
    """Belief-guided 1-step lookahead search."""
    global rng
    seat = state_dict['my_seat']
    my_team = TEAM_A if seat in TEAM_A else TEAM_B

    k = min(TOP_K, len(legal_moves))
    top_idx = np.argsort(-q_values)[:k]
    candidates = [legal_moves[i] for i in top_idx]
    cand_q = q_values[top_idx]

    if k <= 1:
        return candidates[0] if candidates else [], 'v5_greedy'

    # Get belief
    inp = encode_belief_input(gs, seat)
    inp_t = torch.from_numpy(inp).unsqueeze(0).to(device)
    with torch.no_grad():
        belief_probs = torch.sigmoid(belief_model(inp_t)).cpu().numpy().flatten()

    lookahead = np.zeros(k, dtype=np.float64)

    for w in range(NUM_WORLDS):
        hands = sample_hands_from_belief(gs, seat, belief_probs, rng)
        if hands is None:
            continue
        world = gs.clone()
        world.hands = hands

        next_pairs = []
        for ci, move in enumerate(candidates):
            sim = world.clone()
            try:
                sim.step(move)
            except (ValueError, IndexError):
                lookahead[ci] += -1.0
                continue

            if sim.game_over:
                fo = sim.finish_order
                my_ranks = sorted([fo.index(s) for s in my_team])
                score_map = {
                    (0, 1): 1.0, (0, 2): 0.7, (0, 3): 0.3,
                    (1, 2): 0.3, (1, 3): -0.3, (2, 3): -1.0,
                }
                lookahead[ci] += score_map.get(tuple(my_ranks), 0.0)
            else:
                next_pairs.append((ci, sim, sim.turn))

        if next_pairs:
            all_h, all_sa, cnts = [], [], []
            for (ci, sim, ns) in next_pairs:
                legal = get_all_moves(sim.hands[ns], sim.last_hand)
                if not legal:
                    cnts.append(0)
                    continue
                sv = encode_state_v5(sim.get_state_for_player(ns), game_state=sim)
                hist = encode_history(sim, ns, dmc_cfg.seq_len)
                cnts.append(len(legal))
                for m in legal:
                    all_h.append(hist)
                    sa = np.zeros(dmc_cfg.state_dim + dmc_cfg.move_dim, dtype=np.float32)
                    sa[:dmc_cfg.state_dim] = sv
                    sa[dmc_cfg.state_dim:] = encode_move(m)
                    all_sa.append(sa)

            if all_sa:
                with torch.no_grad():
                    h_t = torch.from_numpy(np.array(all_h)).to(device)
                    sa_t = torch.from_numpy(np.array(all_sa)).to(device)
                    q_all = dmc_model(h_t, sa_t).cpu().numpy().flatten()

                idx = 0
                pi = 0
                for (ci, sim, ns) in next_pairs:
                    c = cnts[pi]
                    pi += 1
                    if c == 0:
                        continue
                    best_q = float(np.max(q_all[idx:idx + c]))
                    idx += c
                    if ns in my_team:
                        lookahead[ci] += best_q * DISCOUNT
                    else:
                        lookahead[ci] += -best_q * DISCOUNT

    lookahead /= max(NUM_WORLDS, 1)

    cq_norm = (cand_q - cand_q.mean()) / (cand_q.std() + 1e-8)
    lk_norm = (lookahead - lookahead.mean()) / (lookahead.std() + 1e-8)
    combined = (1 - Q_WEIGHT) * cq_norm + Q_WEIGHT * lk_norm
    best_idx = int(np.argmax(combined))

    return candidates[best_idx], 'v5_belief_pro'


@app.route('/pick_move', methods=['POST'])
def pick_move():
    t0 = time.time()
    try:
        data = request.json
        seat = data.get('seat', 0)

        state_dict, gs = rebuild_game_state(data)
        legal_moves = get_legal_moves(gs, seat)

        if not legal_moves:
            return jsonify({'move_uids': [], 'method': 'no_moves',
                           'time_ms': 0})

        if len(legal_moves) == 1:
            return jsonify({'move_uids': legal_moves[0],
                           'method': 'forced',
                           'time_ms': int((time.time() - t0) * 1000)})

        q_values = evaluate_moves(state_dict, gs, legal_moves)

        if belief_model is not None:
            move, method = belief_search(state_dict, gs, legal_moves, q_values)
        else:
            best_idx = int(np.argmax(q_values))
            move = legal_moves[best_idx]
            method = 'v5_greedy'

        elapsed = time.time() - t0
        print(f"[AI] seat={seat} move={move} method={method} "
              f"time={elapsed*1000:.0f}ms")

        return jsonify({
            'move_uids': move,
            'method': method,
            'time_ms': int(elapsed * 1000),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'move_uids': []}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model': 'V5 Pro',
        'belief': belief_model is not None,
        'device': str(device),
        'worlds': NUM_WORLDS,
    })


def main():
    global dmc_model, belief_model, dmc_cfg, device

    parser = argparse.ArgumentParser(description='AI Pro Server')
    parser.add_argument('--v5-model',
                        default='dmc_checkpoints_v5/dmc_swa_top3.pt')
    parser.add_argument('--belief-model', default='belief_model.pt')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()

    device = get_device()
    print(f"Device: {device}")
    if device.type == 'cuda':
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    dmc_cfg = DMCConfigV5()
    dmc_model = DMCModel(dmc_cfg).to(device)
    sd = torch.load(args.v5_model, map_location=device, weights_only=False)
    if 'model_state_dict' in sd:
        dmc_model.load_state_dict(sd['model_state_dict'])
    else:
        dmc_model.load_state_dict(sd)
    dmc_model.eval()
    print(f"V5 model loaded: {args.v5_model}")

    try:
        belief_model = BeliefNetwork().to(device)
        belief_model.load_state_dict(torch.load(
            args.belief_model, map_location=device, weights_only=True))
        belief_model.eval()
        print(f"Belief model loaded: {args.belief_model}")
    except Exception as e:
        print(f"No belief model: {e}")
        belief_model = None

    # Warm up
    dummy_h = torch.randn(1, dmc_cfg.seq_len, dmc_cfg.history_dim, device=device)
    dummy_sa = torch.randn(1, dmc_cfg.state_dim + dmc_cfg.move_dim, device=device)
    with torch.no_grad():
        for _ in range(10):
            dmc_model(dummy_h, dummy_sa)

    print(f"\n{'='*50}")
    print(f"AI Pro Server on http://localhost:{args.port}")
    print(f"  V5 + Belief Search ({NUM_WORLDS} worlds)")
    print(f"  GPU: {torch.cuda.get_device_name(0) if device.type == 'cuda' else 'CPU'}")
    print(f"{'='*50}\n")

    app.run(host='0.0.0.0', port=args.port, debug=False, threaded=True)


if __name__ == '__main__':
    main()
