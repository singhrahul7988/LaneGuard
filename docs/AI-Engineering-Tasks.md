# AI Engineering Tasks

## Objective

Turn `LaneGuard` from a strong heuristic operations dashboard into a stronger `AI-assisted` system with a clear path to a credible `AI-driven` claim.

This document converts the roadmap into actual engineering tasks, concrete file outputs, and implementation order.

## Status Legend

- `Done`
- `In Progress`
- `Pending`

## Phase 1: Modeling Baseline and Training Data

### Goal

Create the first engineering layer required for prediction work:

- modeling-ready training rows
- baseline benchmark metrics
- next-shift forecast artifacts

### Tasks

1. Extend preprocessing to generate shift-aware features
   - Status: `Done`
   - File: [scripts/preprocess_parking_data.py](/abs/path/C:/Users/Asus/Downloads/Gridlock/scripts/preprocess_parking_data.py)
   - Output:
     - `service_date`
     - `shift`
     - cluster shift aggregates
     - station shift aggregates

2. Create a model feature manifest
   - Status: `Done`
   - Output:
     - [data/processed/ai_feature_manifest.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/data/processed/ai_feature_manifest.json)
     - [public/data/processed/ai_feature_manifest.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/public/data/processed/ai_feature_manifest.json)

3. Generate modeling-ready training rows
   - Status: `Done`
   - Output:
     - [data/processed/model_training_rows.csv](/abs/path/C:/Users/Asus/Downloads/Gridlock/data/processed/model_training_rows.csv)
     - [public/data/processed/model_training_rows.csv](/abs/path/C:/Users/Asus/Downloads/Gridlock/public/data/processed/model_training_rows.csv)
     - preview JSON for quick inspection:
       - [data/processed/model_training_preview.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/data/processed/model_training_preview.json)
       - [public/data/processed/model_training_preview.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/public/data/processed/model_training_preview.json)

4. Generate a baseline benchmark summary
   - Status: `Done`
   - Output:
     - [data/processed/ai_baseline_summary.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/data/processed/ai_baseline_summary.json)
     - [public/data/processed/ai_baseline_summary.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/public/data/processed/ai_baseline_summary.json)

5. Generate a next-shift forecast artifact
   - Status: `Done`
   - Output:
     - [data/processed/next_shift_forecast.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/data/processed/next_shift_forecast.json)
     - [public/data/processed/next_shift_forecast.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/public/data/processed/next_shift_forecast.json)

## Phase 2: Real Predictive Model

### Goal

Replace the current heuristic forecast baseline with a trained predictive model.

### Tasks

1. Add Python model-training script
   - Status: `Done`
   - Proposed file:
     - [scripts/train_hotspot_risk_model.py](/abs/path/C:/Users/Asus/Downloads/Gridlock/scripts/train_hotspot_risk_model.py)

2. Train first practical model
   - Status: `Done`
   - Proposed stack:
     - implemented a strict time-split boosted-tree comparison pipeline in `ml/`
     - current candidates:
       - heuristic baseline
       - `XGBoost`
       - `LightGBM`
     - current champion:
       - `lightgbm_hotspot_classifier_v1`

3. Emit model outputs for app consumption
   - Status: `Done`
   - Proposed outputs:
     - [data/processed/model_hotspot_scores.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/data/processed/model_hotspot_scores.json)
     - [data/processed/model_validation_summary.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/data/processed/model_validation_summary.json)
     - [data/processed/model_explanations.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/data/processed/model_explanations.json)
     - [data/processed/model_selection_report.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/data/processed/model_selection_report.json)

4. Compare heuristic vs trained model
   - Status: `Done`
   - Proposed outputs:
     - comparison currently captured in:
       - [model_validation_summary.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/data/processed/model_validation_summary.json)
     - dedicated comparison artifact:
       - [data/processed/heuristic_vs_model_benchmark.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/data/processed/heuristic_vs_model_benchmark.json)
       - [public/data/processed/heuristic_vs_model_benchmark.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/public/data/processed/heuristic_vs_model_benchmark.json)
   - Current state:
     - strict date-disjoint split now used:
       - train: `2023-11-09` to `2024-03-11`
       - validation: `2024-03-12` to `2024-03-25`
       - holdout test: `2024-03-26` to `2024-04-08`
     - champion selected on validation average precision only, then reported on holdout test

## Phase 3: Impact Model

### Goal

Move from pure proxy scoring to a stronger modeled congestion-impact estimate.

### Tasks

1. Build impact labels / calibrated proxy buckets
   - Status: `Pending`
2. Train impact model
   - Status: `Pending`
3. Emit impact explanations and confidence
   - Status: `In Progress`
   - Proposed outputs:
     - `model_impact_scores.json`
     - `model_explanations.json`
   - Current state:
     - plan-level relief confidence now emitted inside:
       - [data/processed/optimized_shift_plan.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/data/processed/optimized_shift_plan.json)
     - includes:
       - `impact_confidence`
       - `impact_confidence_score`
       - `projected_relief_range`
       - `confidence_note`

## Phase 4: Allocation Optimizer

### Goal

Convert the enforcement planner from manual prioritization to constrained recommendation.

### Tasks

1. Define optimization inputs and objective
   - Status: `Done`
2. Implement solver-based recommendation engine
   - Status: `In Progress`
   - Proposed file:
     - [scripts/build_optimized_shift_plan.py](/abs/path/C:/Users/Asus/Downloads/Gridlock/scripts/build_optimized_shift_plan.py)
   - Current state:
     - strategy-aware beam-searched optimizer implemented with:
       - `Balanced`
       - `Max Relief`
       - `High Confidence`
3. Emit optimized plan artifact
   - Status: `Done`
   - Proposed output:
     - [data/processed/optimized_shift_plan.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/data/processed/optimized_shift_plan.json)
     - [public/data/processed/optimized_shift_plan.json](/abs/path/C:/Users/Asus/Downloads/Gridlock/public/data/processed/optimized_shift_plan.json)

## Phase 5: UI Integration

### Goal

Expose the AI layer visibly and credibly in the product.

### Tasks

1. `Command Center`
   - Status: `Done`
   - Add predicted next-shift hotspots
   - Add confidence band

2. `Hotspot Detail`
   - Status: `Done`
   - Add top contributing factors
   - Add confidence / model note

3. `Enforcement Planner`
   - Status: `In Progress`
   - Add optimizer-recommended queue
   - Add recommendation rationale
   - Current state:
     - strategy-aware `AI Suggested Queue`
     - explicit queue-loading flow
     - rationale-backed recommendation cards

4. `Daily Brief`
   - Status: `Done`
   - Add next-shift forecast summary
   - Add expected relief under recommended plan
   - Current state:
     - projected relief section now shows strategy-level relief range and confidence band when optimizer data is present

## Immediate Next Implementation Steps

1. Add trained-model explanations into `Hotspot Detail`.
   - Status: `Done`
2. Add a model-vs-baseline comparison surface in `Station Analytics` or `Daily Brief`.
   - Status: `Done`
3. Emit a dedicated benchmark artifact instead of only embedding comparison values in `model_validation_summary.json`.
   - Status: `Done`
4. Decide whether to upgrade from the current learned-rate model to `scikit-learn`, `LightGBM`, or `XGBoost` once package availability is settled.
   - Status: `Done`
5. Add hotspot-level impact confidence or projected outcome confidence, not only hotspot recurrence confidence.
   - Status: `In Progress`
6. Upgrade the current strategy-aware beam optimizer into a stronger exact or near-exact constraint-aware recommendation engine with tradeoff tuning.
   - Status: `Pending`
