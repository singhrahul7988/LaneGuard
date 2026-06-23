# ML Context Log

This file exists to preserve modeling context so we do not repeat the same exploration, assumptions, or dead ends again.

## Objective

The ML layer is focused on one primary product question:

`Which corridor is likely to become a hotspot in the next shift?`

This is intentionally narrower than generic traffic prediction.

We are not trying to predict:
- full citywide congestion values
- live traffic speed right now
- travel time or route delay directly

We are trying to predict:
- `target_next_shift_hotspot`
- using historical parking-pressure and hotspot recurrence signals
- so the planner can rank and allocate intervention resources before the next shift worsens

## Product Decision We Locked

We moved the product emphasis away from `raw historical record browsing` and toward:
- predicted next-shift hotspot risk
- forecast confidence
- resource planning

Historical data still matters, but only in the backend / ML pipeline.
It should not dominate the operator-facing story.

## Data Contract We Are Using

Canonical ML inputs:
- `data/processed/model_training_rows.csv`
- `data/processed/model_scoring_rows.csv`

These are produced by:
- [scripts/preprocess_parking_data.py](/abs/path/C:/Users/Asus/Downloads/Gridlock/scripts/preprocess_parking_data.py)

The ML workspace does **not** ingest the raw dataset directly.
If new upstream fields are needed, preprocessing should be extended first.

## Primary Target Choice

Primary target:
- `target_next_shift_hotspot`

Why this was chosen:
- it matches the operator decision better than generic count prediction
- it is easier to evaluate honestly on sparse data
- it fits planner ranking and hotspot triage directly
- it avoids pretending we can already estimate exact traffic congestion values

Secondary output kept for UI/planner continuity:
- `predicted_next_shift_records`

This is supporting context, not the main decision signal.

## Split Policy We Chose

We explicitly chose a strict **date-disjoint time split** to avoid leakage.

Policy:
- `train`: all earlier dates
- `validation`: 14 unique target dates before test
- `test`: last 14 unique target dates

Current realized split:
- train: `2023-11-09` to `2024-03-11`
- validation: `2024-03-12` to `2024-03-25`
- holdout test: `2024-03-26` to `2024-04-08`

Reason:
- random row splitting would overstate performance
- this product needs future prediction credibility, not shuffled accuracy

## Dataset Facts We Designed Around

Current training-table facts:
- rows: `83,762`
- positive rate: `16.44%`
- date span: `2023-11-09` to `2024-04-08`
- severity mix is heavily skewed toward `moderate`

Implications:
- class imbalance matters
- ranking metrics matter more than plain accuracy
- average precision is more meaningful than naive accuracy

## Features We Intentionally Built

We kept the existing recurrence/history features and added engineered features around:
- log-scaled count features
- recent momentum
- current-vs-station share
- repeat density
- weekend and calendar context
- structural interactions
- dormancy / staleness controls

The important design idea:
- active, repeating, high-impact corridors should rank up
- dormant corridors with old history should not keep floating to the top

## Models We Tried

We compared:
- heuristic baseline
- `XGBoost`
- `LightGBM`

We first ran a fair baseline-vs-candidate comparison on the same split.
After that, we added a controlled hyperparameter grid over both boosted-tree families.

## Environment Constraints We Discovered

Available:
- `numpy`
- `pandas`
- `xgboost`
- `lightgbm`

Not available:
- `scikit-learn`

Important implementation note:
- `XGBClassifier` import exists, but its sklearn wrapper cannot actually run without `scikit-learn`
- because of that, we used native `xgboost.train(...)`
- `LightGBM` was also used via native training APIs

Do not waste time later trying to rebuild this pipeline around sklearn-only helpers unless sklearn is intentionally added to the environment.

## Model Selection Policy

Champion selection metric:
- `Average Precision` on validation

Secondary metrics reported:
- `precision_at_risk_55`
- `recall_at_risk_55`
- `precision_at_top_30`
- `recall_at_top_30`
- `log_loss`
- `brier_score`
- `mae_next_shift_records`

Threshold policy:
- search thresholds from `0.30` to `0.80`
- choose best validation `F1`
- tie-break toward higher recall
- continue reporting fixed `55` risk-threshold metrics for UI/backward comparability

## Current Champion

Current winner:
- `xgboost_hotspot_classifier_v2`

Chosen threshold:
- `0.30`

Why it won:
- highest calibrated validation average precision after the tuning grid
- strongest combined holdout ranking and calibration-quality metrics after the calibration pass
- remained the best overall option after the sparse-corridor and `Night`-shift feature pass

## Current Holdout Results

Champion vs heuristic baseline on untouched test:

- Average Precision: `0.6907` vs `0.3194`
- Precision @ 55: `0.8652` vs `0.3217`
- Recall @ 55: `0.3830` vs `0.4278`
- Precision @ Top 30: `1.0` vs `0.6`
- Next-shift MAE: `0.7698` vs `2.834`
- Log Loss: `0.2843` vs `0.5638`
- Brier Score: `0.0841` vs `0.1879`

This is the main reason the rebuilt ML stack is worth keeping.

## Artifacts We Now Emit

Current ML outputs:
- `model_hotspot_scores.json`
- `model_validation_summary.json`
- `heuristic_vs_model_benchmark.json`
- `model_explanations.json`
- `model_selection_report.json`
- `model_tuning_report.json`
- `model_evaluation_slices.json`
- `model_error_analysis_report.json`
- `model_operating_policy.json`

These are written to both:
- `data/processed`
- `public/data/processed`

## Things We Explicitly Did Not Do Yet

Still not implemented:
- live data ingestion
- continuous retraining
- traffic-speed or route-delay prediction
- congestion-impact model
- outcome-feedback learning from committed plans

Already implemented since the first rebuild:
- fixed tuning grids for `XGBoost` and `LightGBM`
- Platt-style probability calibration
- per-shift / per-station slice reporting
- dedicated error-analysis artifacts
- sparse-corridor / dormant-corridor guardrails in scoring
- operating-threshold recommendations by shift and severity

## Things We Should Not Repeat

Avoid repeating these mistakes or detours:

1. Do not center the product story around raw record browsing again.
2. Do not use random train/test splits for this task.
3. Do not optimize hyperparameters before confirming the target and split are correct.
4. Do not treat `predicted_next_shift_records` as the main planning truth.
5. Do not assume API/live traffic access is required for demo-grade predictive credibility.
6. Do not assume sklearn wrappers will work just because the library imports.

## Best Next ML Steps

When we resume ML work, the highest-value next steps are:

1. Separate planner operating modes that can use the new shift-specific threshold policy rather than one global cutoff everywhere.
2. Target the remaining false negatives in `Morning` and `moderate` severity rows with better station-context and corridor-shape features.
3. Add a separate impact / relief model tied to the actual problem statement instead of relying only on hotspot risk.
4. Add post-commit outcome feedback once committed-plan results are available.
5. Only then consider a second narrow tuning round around the current XGBoost champion.

## Current Weaknesses We Observed

The latest evaluation pass improved ranking and calibration, but these weak spots remain:

- `Night` shift is better recall-wise, but still noisier than `Morning` / `Afternoon`
- the largest false positives are still mostly `Night` rows with real recent activity but zero next-shift follow-through
- the largest false negatives are still dominated by `moderate` severity rows that spike despite weaker repeat history
- station performance is uneven, with weaker ranking quality in low-positive or noisier jurisdictions such as `Rajajinagar`

## Current Operating Policy

We now emit `model_operating_policy.json` so the planner can use clearer thresholds by context.

Current recommended thresholds:

- Global: `0.30`
- Morning: `0.30`
- Afternoon: `0.32`
- Night: `0.30` with `beta = 2.0` to bias toward higher recall

Why this matters:

- the global threshold is still good for simple UX
- `Night` needs a more recall-friendly operating policy
- this lets the planner evolve from a single fixed cutoff toward a more operationally realistic dispatch policy

## Source Of Truth

If future work changes the target, split policy, candidate models, or champion metric, this file should be updated in the same change.
