"""SWA: Average top V8 checkpoints for a stronger Phase 2 starting point.

Takes top-N checkpoints by vs Champion winrate, averages their weights.
Then evaluates the SWA model to verify it's stronger than any individual.
"""
import sys, os, glob, re
sys.path.insert(0, os.path.dirname(__file__))

import torch
import numpy as np
from guandan_ai.dmc.dmc_model import create_model
from guandan_ai.dmc.config_dmc import DMCConfigV8

def get_wr_from_filename(f):
    m = re.search(r'wr([0-9.]+)', f)
    return float(m.group(1)) if m else 0

def main():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    cfg = DMCConfigV8()

    # Find top checkpoints (skip early warmstart ones with wr > 0.7)
    ckpts = glob.glob('dmc_checkpoints_v8/dmc_step*_wr*.pt')
    ckpts = [(f, get_wr_from_filename(f)) for f in ckpts]
    # Filter: only mature checkpoints (step >= 1M, wr format is vs Champion ≤ 0.6)
    ckpts = [(f, wr) for f, wr in ckpts if wr <= 0.65 and wr >= 0.50]
    ckpts.sort(key=lambda x: -x[1])

    # Also include latest
    latest = 'dmc_checkpoints_v8/dmc_latest.pt'

    top_n = 3
    top = ckpts[:top_n]

    print(f'=== SWA: Averaging top {top_n} V8 checkpoints ===')
    for f, wr in top:
        step = re.search(r'step(\d+)', f)
        step_str = f'{int(step.group(1)):,}' if step else '?'
        print(f'  {wr*100:.1f}% vs Champion @ Step {step_str}: {os.path.basename(f)}')

    # Load and average
    print(f'\nAveraging weights...')
    avg_state = None
    for i, (f, wr) in enumerate(top):
        sd = torch.load(f, map_location=device, weights_only=False)
        if avg_state is None:
            avg_state = {k: v.float() for k, v in sd.items()}
        else:
            for k in avg_state:
                avg_state[k] += sd[k].float()

    for k in avg_state:
        avg_state[k] /= len(top)

    # Convert back to original dtype
    first_sd = torch.load(top[0][0], map_location=device, weights_only=False)
    for k in avg_state:
        avg_state[k] = avg_state[k].to(first_sd[k].dtype)

    # Save
    out_path = f'dmc_checkpoints_v8/dmc_v8_swa_top{top_n}.pt'
    torch.save(avg_state, out_path)
    size_mb = os.path.getsize(out_path) / 1024 / 1024
    print(f'Saved: {out_path} ({size_mb:.1f} MB)')

    # Quick eval vs Champion
    print(f'\nEvaluating SWA model vs V7 Champion (200 games)...')
    from guandan_ai.dmc.learner import evaluate_vs_champion, evaluate_vs_rule

    model = create_model(cfg).to(device)
    model.load_state_dict(avg_state)

    wr_champ = evaluate_vs_champion(model, cfg, device, cfg.eval_champion_path, num_games=200)
    wr_rule = evaluate_vs_rule(model, cfg, device, num_games=200)

    print(f'\n=== SWA Result ===')
    print(f'  vs Champion: {wr_champ*100:.1f}%')
    print(f'  vs Rule:     {wr_rule*100:.1f}%')
    print(f'  (Best single: {top[0][1]*100:.1f}%)')

    if wr_champ > top[0][1]:
        print(f'  ✅ SWA is STRONGER than best single! Use as Phase 2 start.')
    else:
        print(f'  ⚠️ SWA slightly weaker. Consider using best single instead.')

    print(f'\nPhase 2 command:')
    print(f'  python -m guandan_ai.dmc.train_dmc --v8p2 --gpu-inference --resume {out_path} --start-step 0')

if __name__ == '__main__':
    main()
