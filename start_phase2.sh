#!/bin/bash
# ============================================================
# V8 Phase 2 — Warm Restart
# ============================================================
# Step 1: SWA average top checkpoints (stronger starting point)
# Step 2: Launch Phase 2 training from SWA model
# ============================================================

echo "============================================================"
echo "  Step 1: SWA — Averaging top V8 checkpoints"
echo "============================================================"

python swa_v8_top.py
SWA_RESULT=$?

# Determine starting checkpoint
SWA_PATH="dmc_checkpoints_v8/dmc_v8_swa_top3.pt"
BEST_SINGLE="dmc_checkpoints_v8/dmc_step4960000_wr0.605.pt"

if [ $SWA_RESULT -eq 0 ] && [ -f "$SWA_PATH" ]; then
    START_CKPT="$SWA_PATH"
    echo ""
    echo "Using SWA model as starting point"
else
    START_CKPT="$BEST_SINGLE"
    echo ""
    echo "SWA failed, using best single checkpoint"
fi

echo ""
echo "============================================================"
echo "  Step 2: Phase 2 Training"
echo "============================================================"
echo "  From:          $START_CKPT"
echo "  Config:        V8 Phase 2"
echo "  LR:            3e-5 → 3e-6 (cosine)"
echo "  Epsilon:       0.04 → 0.01"
echo "  Steps:         5,000,000 (~11 days)"
echo "  Eval:          vs V7 Champion (same baseline)"
echo "  Output:        dmc_checkpoints_v8p2/"
echo "============================================================"
echo ""
read -p "Start training? (Y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "Aborted."
    exit 0
fi

mkdir -p dmc_checkpoints_v8p2

python -m guandan_ai.dmc.train_dmc \
    --v8p2 \
    --gpu-inference \
    --resume "$START_CKPT" \
    --start-step 0 \
    --opponent-pool 0.3 \
    2>&1 | tee v8_phase2_training.log
