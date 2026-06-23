# LaneGuard ML Pipeline

This workspace owns the predictive hotspot-risk pipeline for the demo.

## Goal

Predict whether a corridor will become a `next-shift hotspot`, evaluate that prediction honestly on a strict time split, and emit forecast artifacts that the planner and brief screens can consume.

## Inputs

- `data/processed/model_training_rows.csv`
- `data/processed/model_scoring_rows.csv`

The ML layer does not ingest raw datasets directly. Upstream feature extraction stays in `scripts/preprocess_parking_data.py`.

## Outputs

- `model_hotspot_scores.json`
- `model_validation_summary.json`
- `heuristic_vs_model_benchmark.json`
- `model_explanations.json`
- `model_selection_report.json`

These are written to both:

- `data/processed`
- `public/data/processed`

## Workflow

1. Run preprocessing to refresh training and scoring rows.
2. Run the ML pipeline to compare baseline models and emit the forecast champion outputs.
3. Run the optimizer so the planner consumes the latest forecast artifact.

## Commands

```powershell
python scripts\preprocess_parking_data.py
python scripts\train_hotspot_risk_model.py
python scripts\build_optimized_shift_plan.py
```

## Split policy

- train: all dates before the validation window
- validation: 14 unique target dates before test
- test: last 14 unique target dates

Model selection uses validation only. Final holdout reporting and deployment scoring use the chosen model after retraining on train plus validation.
