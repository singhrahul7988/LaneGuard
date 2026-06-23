# CatBoost Hotspot Classifier — New Model Approach

## Goal
Create a new model using **CatBoost** (not yet tried in this project) with enhanced engineered features targeting known failure modes (Night shift recall, sparse corridor FNs, station-level pressure FPs) to beat the current champion's 0.6375 Average Precision on holdout.

## Research Summary
- **CatBoost 1.2.10** is already installed in the environment (verified).
- sklearn is NOT available — must use native CatBoost API (`catboost.train()` / `catboost.Pool`).
- Current champion: XGBoost (max_depth=7, eta=0.06) with Platt calibration, Avg Precision **0.6375** on holdout.
- Key weaknesses identified from error analysis:
  - **Night shift**: Recall@risk55 = 0.195 (vs 0.66 for Afternoon) — biggest gap
  - **False negatives**: Corridors with high actual records but low `same_shift_records_7d` (sparse but bursty)
  - **False positives**: High station pressure + low corridor activity — model over-indexes on station-level features
  - **Low-station corridors**: Rajajinagar (AP=0.38), Magadi Road (AP=0.58)
- CatBoost advantages: native ordered target encoding for categoricals (shift, weekday, severity_band), symmetric trees for better generalization on small data, built-in handling of categorical features without one-hot encoding.

## Approach

### Model Architecture
Dual model (same as current): CatBoost classifier for hotspot probability + CatBoost regressor for next-shift record count. Native API via `catboost.train()` and `catboost.Pool`.

### Feature Enhancements (beyond current engineered features)
1. **Night shift × Station Pressure**: interaction of target_next_shift=="Night" with station_same_shift_records_7d
2. **Severity × Recency**: weighted combo of severity_code and recent activity
3. **Station-level positive rate**: rolling station-level hotspot rate
4. **Decayed activity**: exponentially decayed weight for same_shift_records_7d
5. **Cross-corridor station pressure**: mean of other corridors' activity in same station
6. **Burst detection**: ratio of current shift to rolling average (spike signal)

### Hyperparameter Strategy
- Wider grid than current 4-variant-per-model approach:
  - depth: [4, 6, 8]
  - learning_rate: [0.03, 0.05, 0.07, 0.1]
  - l2_leaf_reg: [1, 3, 5, 8]
  - border_count: [32, 64, 128]
- Early stopping on validation loss (od_type='Iter', od_wait=30)
- Auto class weighting via `auto_class_weights='Balanced'`

## Subtasks
1. **Add new features in features.py** — extend `add_engineered_features()` with the 6 new feature groups listed above. Must work seamlessly with existing code (no breakage).
2. **Create ml/train_catboost.py** — new file with CatBoost dual-model (classifier + regressor). Reuses same split.py, features.py, evaluate.py, config.py, infer.py. Produces same artifact schemas.
3. **Add CatBoost config to config.py** — MODEL_SPECS entry for "catboost" with classification_params, regression_params, tuning_grid.
4. **Wire into main pipeline** — modify train.py `build_artifacts` to optionally include CatBoost trials, or make train_catboost.py standalone with its own `main()` that emits same artifacts.
5. **Run the full pipeline** — execute train_catboost.py, collect metrics on validation and holdout test.
6. **Compare and report** — produce a comparison table vs current champion metrics.

## Deliverables
| File Path | Description |
|-----------|-------------|
| `ml/train_catboost.py` | CatBoost dual-model training pipeline |
| `ml/features.py` | Extended with 6 new engineered features |
| `ml/config.py` | CatBoost model specs added |
| `data/processed/catboost_validation_summary.json` | CatBoost champion holdout metrics |
| `data/processed/catboost_vs_xgboost_benchmark.json` | Direct comparison |

## Evaluation Criteria
- Holdout Average Precision > **0.6375** (current champion)
- Holdout Precision@Top 30 >= **1.0** (maintain perfect top-30 precision)
- Night shift recall@risk55 > **0.195** (improvement on worst slice)
- Brier Score < **0.0917** (better calibration)
- MAE next-shift records < **0.8258** (better count regression)

## Notes
- Must use native CatBoost API (no sklearn wrappers)
- Categorical features (shift, weekday, severity_band) passed as categorical via Pool
- Must produce artifacts that match existing schema for downstream consumption
- Same strict date-disjoint time split (train: 2023-11-09 to 2024-03-11, val: 2024-03-12 to 2024-03-25, test: 2024-03-26 to 2024-04-08)