"""Hyperparameter configuration for DMC (Deep Monte Carlo) training."""


class DMCConfig:
    # --- Network architecture ---
    lstm_hidden = 128
    lstm_layers = 2
    dense_sizes = [512, 512, 512, 512, 256, 128]
    # Residual connections at layer indices 1 and 3 (0-indexed)
    residual_layers = {1, 3}
    history_dim = 62   # 54 card + 4 seat one-hot + 4 context bits
    seq_len = 15
    state_dim = 326
    move_dim = 54
    use_layer_norm = True
    shared_network = True  # single network for all seats
    use_v2_encoder = False  # True = use state_encoder_v2 (490-dim)
    use_v5_encoder = False  # True = use state_encoder_v5 (572-dim)

    # --- Training ---
    lr = 3e-4
    weight_decay = 1e-5          # AdamW L2 regularization
    batch_size = 512
    max_grad_norm = 40.0
    total_steps = 200_000

    # --- Actor ---
    num_actors = 16
    epsilon_start = 0.25
    epsilon_end = 0.001  # low floor for late-stage exploitation

    # --- Opponent pool ---
    opponent_pool_ratio = 0.0   # fraction of actors using historical checkpoints
    pool_refresh_games = 50     # re-pick a random checkpoint every N games

    # --- Replay buffer ---
    buffer_capacity = 2_000
    min_buffer_size = 1_000
    replay_ratio = 4  # max times each transition is reused on average

    # --- Prioritized replay ---
    priority_alpha = 0.6         # prioritization exponent (0=uniform, 1=full priority)
    priority_beta = 0.4          # IS correction start (anneals to 1.0 over training)

    # --- Synchronization ---
    weight_sync_interval = 50    # learner steps between saving weights
    eval_interval = 1_000        # learner steps between evaluations
    eval_games = 100             # games per evaluation round

    # --- Paths ---
    checkpoint_dir = "dmc_checkpoints"
    weight_file = "dmc_latest.pt"

    # --- Rewards ---
    # Base rewards by finish position (1st through 4th)
    base_rewards = [3.0, 1.0, -1.0, -3.0]
    team_bonus = 1.0  # bonus/penalty for double-win/double-loss


class DMCConfigLarge(DMCConfig):
    """~20M parameter model for browser deployment (3-5s inference OK)."""
    lstm_hidden = 512
    lstm_layers = 2
    dense_sizes = [2048, 2048, 2048, 2048, 1024, 512]
    residual_layers = {1, 3}

    # Larger model needs adjusted training params
    lr = 1e-4               # lower lr for stability
    batch_size = 512         # GPU can handle it
    max_grad_norm = 10.0     # tighter clipping to prevent late-stage instability
    total_steps = 1_000_000  # longer training
    buffer_capacity = 16_000 # large enough for 16 actors
    min_buffer_size = 4_000
    replay_ratio = 6         # lower = fresher data, less off-policy drift
    buffer_max_age = 1000    # discard transitions older than 1000 learner steps
    eval_interval = 2_000
    eval_games = 200         # more games for reliable win rate

    # Opponent pool for diverse self-play
    opponent_pool_ratio = 0.3  # 30% actors use historical checkpoints

    # Separate checkpoint dir to avoid mixing with small model
    checkpoint_dir = "dmc_checkpoints_large"


class DMCConfigV5(DMCConfigLarge):
    """V5: Large model (~22M) + 714-dim state encoding.

    Combines V1 base (326), V2 belief features (164), and new features
    from DanZero+/PerfectDou/GuanZero research:
      - Unseen cards belief (54) - card counting
      - Partner hand estimate (54) - inferred distribution
      - Teammate signals (8) - cooperation patterns
      - Opponent threats (16) - opponent modeling
      - Round context (16) - game flow
      - Strategic position (16) - hand analysis
      - Remaining counts one-hot (84) - from DanZero+ (3 players)
      - Last play full cards (54) - from DanZero+
      - Teammate last play (54) - from DanZero+
      - Hand decomposition (12) - from PerfectDou
      - Cooperation intent (8) - from GuanZero
      - Wild card strategy (12) - from DanZero+ proc_universal()
    Total: 326 + 164 + 84 + 54 + 54 + 12 + 8 + 12 = 714
    """
    state_dim = 714
    use_v5_encoder = True
    checkpoint_dir = "dmc_checkpoints_v5"

    # LR schedule: warmup 5k steps, then cosine decay to lr * 0.01
    lr = 1e-4
    weight_decay = 1e-5         # AdamW regularization
    lr_warmup_steps = 5_000     # linear warmup from 0 to lr
    lr_min_ratio = 0.01         # final lr = 1e-4 * 0.01 = 1e-6

    # More reliable evaluation
    eval_games = 2000           # 2000 games, ±1.1% stderr, GPU eval ~7min
    eval_interval = 2000        # eval every 2000 steps (~7min train + ~7min eval)

    # Prioritized replay: restore alpha=0.6 (consultation: uniform+buffer清空=双杀)
    priority_alpha = 0.6
    priority_beta = 0.4

    # Epsilon: decay over first 30% of training, floor at 0.01
    epsilon_end = 0.01
    epsilon_decay_fraction = 0.3


class DMCConfigV7(DMCConfigV5):
    """V7: N-step TD + dense rewards + target network.

    Fixes the root cause of poor Q-value quality:
      - MC return gives same reward to all decisions → noisy Q
      - N-step TD bootstraps from Q-network after n steps → sharper signal
      - Dense rewards give per-step feedback → better credit assignment
      - Target network stabilizes training
    """
    # N-step TD
    n_step = 5
    gamma = 0.99

    # Dense step rewards (small, terminal reward still dominates)
    use_dense_rewards = True
    reward_win_round = 0.05       # gain control (all others pass)
    reward_play_cards = 0.01      # per card played (incentivize emptying hand)
    reward_teammate_finish = 0.15 # teammate empties hand
    reward_opponent_finish = -0.10 # opponent empties hand

    # Target network
    use_target_network = True
    target_update_tau = 0.005     # soft update: target = τ*online + (1-τ)*target

    # Training adjustments
    lr = 5e-5                     # lower LR for warm-start stability
    lr_warmup_steps = 2_000       # short warmup (resuming from trained model)
    lr_min_ratio = 0.1            # floor at 5e-6
    total_steps = 1_500_000
    epsilon_start = 0.10          # lower start (resuming from good model)
    epsilon_end = 0.02
    epsilon_decay_fraction = 0.2  # faster decay to exploit learned policy
    eval_interval = 2000
    eval_games = 2000

    # Opponent pool: 30% actors use historical checkpoints for diversity
    opponent_pool_ratio = 0.3

    checkpoint_dir = "dmc_checkpoints_v7"


class DMCConfigV8(DMCConfigV7):
    """V8: V7 recipe + M-value + Power features.

    716-dim state = V5(714) + M-value(1) + Power(1)
    From V7 Human BC (92.6%) warm-start.
    """
    state_dim = 716              # 714 + 1 (M-value) + 1 (Power)
    use_m_value = True           # flag to enable M-value + Power features
    checkpoint_dir = "dmc_checkpoints_v8"

    # Same stable recipe as V7
    lr = 5e-5
    lr_warmup_steps = 2_000
    lr_min_ratio = 0.1
    total_steps = 5_000_000
    epsilon_start = 0.10
    epsilon_end = 0.02
    epsilon_decay_fraction = 0.05  # decay over 5% = 250K steps, then exploit

    use_target_network = True
    target_update_tau = 0.005

    # Eval: vs champion model (not RuleAgent)
    eval_games = 200             # 200 games vs champion (fast enough)
    eval_interval = 10000        # every 10K steps (less frequent for long run)
    eval_champion_path = "dmc_checkpoints_v7/dmc_v7_human.pt"  # V7 Human BC (92.6%)

    # Dense rewards (same as V7)
    n_step = 5
    gamma = 0.99
    use_dense_rewards = True
    reward_win_round = 0.05
    reward_play_cards = 0.01
    reward_teammate_finish = 0.15
    reward_opponent_finish = -0.10


class DMCConfigV8Phase2(DMCConfigV8):
    """V8 Phase 2: Warm restart from best checkpoint.

    Key changes vs V8:
      - LR 3e-5 (slightly lower, model is already strong)
      - Epsilon 0.04→0.01 (less exploration, more exploitation)
      - Opponent pool 0.3 (mix of historical checkpoints)
      - New checkpoint dir to preserve V8 originals
    """
    lr = 3e-5                        # lower than V8's 5e-5, avoid overshooting
    lr_warmup_steps = 1_000          # short warmup (model already warmed)
    lr_min_ratio = 0.1               # cosine to 3e-6

    epsilon_start = 0.04             # already know how to play, less explore
    epsilon_end = 0.01
    epsilon_decay_fraction = 0.03    # decay over 3% = 150K steps

    total_steps = 5_000_000
    checkpoint_dir = "dmc_checkpoints_v8p2"

    # Eval still vs V7 champion (same baseline, comparable with Phase 1)
    eval_champion_path = "dmc_checkpoints_v7/dmc_v7_human.pt"


class DMCConfigV5Finetune(DMCConfigV5):
    """V5 fine-tuning from SWA checkpoint.

    Key changes vs V5:
      - Lower LR (3e-5) with higher floor (lr_min_ratio=0.1 -> 3e-6)
      - No warmup (already trained)
      - Shorter schedule (200k steps)
      - Higher epsilon floor (0.03) to prevent overfitting
      - Saves to separate dir to preserve V5 originals
    """
    lr = 3e-5                    # lower LR for fine-tuning
    lr_warmup_steps = 0          # no warmup needed
    lr_min_ratio = 0.1           # floor at 3e-6 (not 1e-6)
    total_steps = 200_000        # shorter fine-tune run
    epsilon_start = 0.05         # start low (already good model)
    epsilon_end = 0.03           # keep some exploration to prevent collapse
    epsilon_decay_fraction = 0.1 # decay quickly in first 10%
    checkpoint_dir = "dmc_checkpoints_v5_ft"
    eval_interval = 2000
    eval_games = 2000


class DMCConfigTransformer(DMCConfigLarge):
    """~20M model with Transformer replacing LSTM."""
    use_transformer = True     # flag for train_dmc to pick TransformerDMCModel
    seq_len = 40               # longer history (Transformer handles it well)

    # Transformer architecture
    transformer_d_model = 256
    transformer_nhead = 4
    transformer_layers = 4
    transformer_ff_dim = 512
    transformer_dropout = 0.1

    # Training
    lr = 1e-4
    total_steps = 1_000_000
    eval_games = 2000          # 2000 games for accurate WR (±1.1%)
    checkpoint_dir = "dmc_checkpoints_transformer"


class DMCConfigHuge(DMCConfig):
    """~100M parameter model for server-side training (Stage 3).

    Designed for rented GPU servers (A100/H100). Uses 3-layer LSTM and
    deep 4096-wide MLP to maximize representation capacity. Requires
    multi-GPU or high-VRAM GPU (>= 24GB recommended).

    Architecture: ~102.5M parameters
      LSTM: 1024 hidden x 3 layers
      MLP:  [4096, 4096, 4096, 4096, 4096, 2048] with residual at layers 1,3
    """
    lstm_hidden = 1024
    lstm_layers = 3
    dense_sizes = [4096, 4096, 4096, 4096, 4096, 2048]
    residual_layers = {1, 3}

    # Training params tuned for large-scale server training
    lr = 5e-5                 # lower lr for 100M model stability
    batch_size = 1024         # larger batch for GPU efficiency
    max_grad_norm = 10.0      # tighter gradient clipping
    total_steps = 5_000_000   # much longer training for convergence

    # More actors for faster data generation on server
    num_actors = 64
    epsilon_start = 0.25
    epsilon_end = 0.005       # lower final epsilon for exploitation

    # Larger buffer for diversity
    buffer_capacity = 10_000
    min_buffer_size = 5_000
    replay_ratio = 16         # GPU is fast, reuse data more

    # Synchronization
    weight_sync_interval = 100
    eval_interval = 5_000
    eval_games = 200

    # Opponent pool for robust self-play
    opponent_pool_ratio = 0.25

    # Paths
    checkpoint_dir = "dmc_checkpoints_huge"

    # Enhanced state encoding (v2: 490 dims instead of 326)
    state_dim = 490
    use_v2_encoder = True
    seq_len = 20                  # longer history for better pattern recognition
    history_dim = 62              # same history step encoding

    # Knowledge distillation from Stage 2 (20M) teacher
    distill_teacher_path = None    # path to Stage 2 best .pt checkpoint
    distill_alpha = 0.3            # blend: (1-alpha)*MSE + alpha*KD_loss
    distill_temperature = 3.0      # softmax temperature for KD

    # ELO evaluation
    elo_enabled = True
    elo_initial = 1500
    elo_k = 32
