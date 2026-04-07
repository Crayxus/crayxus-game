"""Main entry point for DMC training.

Usage:
    python -m dmc.train_dmc --actors 16 --buffer-size 2000 --steps 200000

Uses multiprocessing for actors to bypass Python GIL and utilize all CPU cores.
Actors run as separate processes on CPU, learner runs on the main process with GPU.
"""
import os
import sys
import argparse
import multiprocessing as mp
import time

from .config_dmc import DMCConfig, DMCConfigLarge, DMCConfigV5, DMCConfigV7, DMCConfigV8, DMCConfigV5Finetune, DMCConfigHuge, DMCConfigTransformer
from .actor import actor_loop
from .learner import learner_loop


def main():
    parser = argparse.ArgumentParser(description='DMC Training for Guandan AI')
    parser.add_argument('--actors', type=int, default=None,
                        help=f'Number of actor processes '
                             f'(default: {DMCConfig.num_actors})')
    parser.add_argument('--steps', type=int, default=None,
                        help=f'Total training steps '
                             f'(default: {DMCConfig.total_steps})')
    parser.add_argument('--lr', type=float, default=None,
                        help=f'Learning rate (default: {DMCConfig.lr})')
    parser.add_argument('--batch-size', type=int, default=None,
                        help=f'Batch size (default: {DMCConfig.batch_size})')
    parser.add_argument('--buffer-size', type=int, default=None,
                        help=f'Replay buffer capacity '
                             f'(default: {DMCConfig.buffer_capacity})')
    parser.add_argument('--min-buffer', type=int, default=None,
                        help=f'Min buffer size before training starts '
                             f'(default: {DMCConfig.min_buffer_size})')
    parser.add_argument('--checkpoint-dir', type=str, default=None,
                        help=f'Checkpoint directory '
                             f'(default: {DMCConfig.checkpoint_dir})')
    parser.add_argument('--resume', type=str, default=None,
                        help='Path to .pt checkpoint to resume training from')
    parser.add_argument('--start-step', type=int, default=0,
                        help='Step offset when resuming (e.g. 456000)')
    parser.add_argument('--large', action='store_true',
                        help='Use large ~20M parameter model config')
    parser.add_argument('--v5', action='store_true',
                        help='Use V5 config: Large (20M) + 486-dim v2 encoder')
    parser.add_argument('--v8', action='store_true',
                        help='V8: V7 recipe + M-value feature (716-dim)')
    parser.add_argument('--v8p2', action='store_true',
                        help='V8 Phase 2: warm restart from best checkpoint')
    parser.add_argument('--v7', action='store_true',
                        help='V7: N-step TD + dense rewards + target network')
    parser.add_argument('--v5-finetune', action='store_true',
                        help='Fine-tune V5 from SWA checkpoint (lower LR, shorter run)')
    parser.add_argument('--huge', action='store_true',
                        help='Use huge ~100M parameter model config (Stage 3)')
    parser.add_argument('--transformer', action='store_true',
                        help='Use Transformer instead of LSTM (~20M params)')
    parser.add_argument('--teacher', type=str, default=None,
                        help='Path to teacher model .pt for knowledge distillation')
    parser.add_argument('--opponent-pool', type=float, default=None,
                        help='Fraction of actors using historical checkpoints '
                             '(e.g., 0.2 = 20%%)')
    parser.add_argument('--gpu-inference', action='store_true',
                        help='Use centralized GPU inference for actors '
                             '(recommended for large models)')
    args = parser.parse_args()

    # Build config with overrides
    if args.transformer:
        cfg = DMCConfigTransformer()
    elif args.huge:
        cfg = DMCConfigHuge()
    elif getattr(args, 'v8p2', False):
        from .config_dmc import DMCConfigV8Phase2
        cfg = DMCConfigV8Phase2()
    elif getattr(args, 'v8', False):
        cfg = DMCConfigV8()
    elif getattr(args, 'v7', False):
        cfg = DMCConfigV7()
    elif getattr(args, 'v5_finetune', False):
        cfg = DMCConfigV5Finetune()
    elif args.v5:
        cfg = DMCConfigV5()
    elif args.large:
        cfg = DMCConfigLarge()
    else:
        cfg = DMCConfig()
    if args.teacher is not None:
        cfg.distill_teacher_path = args.teacher
    if args.actors is not None:
        cfg.num_actors = args.actors
    if args.steps is not None:
        cfg.total_steps = args.steps
    if args.lr is not None:
        cfg.lr = args.lr
    if args.batch_size is not None:
        cfg.batch_size = args.batch_size
    if args.buffer_size is not None:
        cfg.buffer_capacity = args.buffer_size
    if args.min_buffer is not None:
        cfg.min_buffer_size = args.min_buffer
    if args.checkpoint_dir is not None:
        cfg.checkpoint_dir = args.checkpoint_dir
    if args.opponent_pool is not None:
        cfg.opponent_pool_ratio = args.opponent_pool

    weight_dir = cfg.checkpoint_dir
    os.makedirs(weight_dir, exist_ok=True)

    print("=" * 60)
    print("DMC Training for Guandan AI")
    print("=" * 60)
    print(f"Actors:          {cfg.num_actors}")
    print(f"Total steps:     {cfg.total_steps}")
    print(f"Learning rate:   {cfg.lr}")
    print(f"Batch size:      {cfg.batch_size}")
    print(f"Buffer capacity: {cfg.buffer_capacity}")
    print(f"Min buffer:      {cfg.min_buffer_size}")
    print(f"Checkpoint dir:  {weight_dir}")
    print(f"Epsilon:         {cfg.epsilon_start} -> {cfg.epsilon_end}")
    print(f"Weight sync:     every {cfg.weight_sync_interval} steps")
    print(f"Eval interval:   every {cfg.eval_interval} steps")
    print(f"Opponent pool:   {cfg.opponent_pool_ratio:.0%}")
    model_label = 'Transformer (~20M)' if args.transformer else ('Huge (~100M)' if args.huge else ('V7 N-step (~22M)' if getattr(args, 'v7', False) else ('V5 (~22M)' if args.v5 else ('Large (~20M)' if args.large else 'Standard (~1.4M)'))))
    print(f"Model config:    {model_label}")
    print(f"GPU inference:   {'ON' if args.gpu_inference else 'OFF'}")
    if getattr(cfg, 'distill_teacher_path', None):
        print(f"Teacher model:   {cfg.distill_teacher_path}")
        print(f"Distill alpha:   {cfg.distill_alpha}")
    print("=" * 60)

    # Shared state (process-safe queue + event + counter)
    data_queue = mp.Queue(maxsize=2048)
    stop_event = mp.Event()
    step_counter = mp.Value('i', 0)

    # GPU inference queues (optional)
    inference_queue = None
    response_queues = None
    if args.gpu_inference:
        inference_queue = mp.Queue(maxsize=512)
        response_queues = {i: mp.Queue(maxsize=16) for i in range(cfg.num_actors)}

    # Launch actor processes
    actors = []
    for i in range(cfg.num_actors):
        kwargs = {}
        if args.gpu_inference:
            kwargs['inference_queue'] = inference_queue
            kwargs['response_queue'] = response_queues[i]
        p = mp.Process(
            target=actor_loop,
            args=(i, data_queue, weight_dir, stop_event, step_counter, cfg),
            kwargs=kwargs,
            daemon=True,
            name=f"actor-{i}",
        )
        p.start()
        actors.append(p)
        print(f"Launched actor process {i}")

    # Run learner on main process (uses GPU)
    try:
        learner_loop(data_queue, weight_dir, stop_event, step_counter, cfg,
                     resume_path=args.resume,
                     inference_queue=inference_queue,
                     response_queues=response_queues,
                     start_step=args.start_step)
    except KeyboardInterrupt:
        print("\n[Main] KeyboardInterrupt, shutting down...")
    finally:
        stop_event.set()
        for i, p in enumerate(actors):
            p.join(timeout=10)
            if p.is_alive():
                p.terminate()
        print("[Main] All processes stopped.")


if __name__ == '__main__':
    main()
