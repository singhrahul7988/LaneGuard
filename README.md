# LaneGuard

LaneGuard is an AI-assisted parking-enforcement intelligence system for Bengaluru Traffic Police. It turns historical parking violation records into:

- predicted next-shift hotspot risk
- explainable hotspot prioritization
- intervention planning
- station analytics
- policy-facing recommendations

The project is built for the Gridlock Hackathon theme: `Poor Visibility on Parking-Induced Congestion`.

## What LaneGuard Solves

Parking-induced congestion is usually handled reactively. Officers see violations after they accumulate, but they do not get a clear prediction of where the next shift is most likely to face parking pressure.

LaneGuard addresses that by combining:

- hotspot detection from the provided parking dataset
- forecasted corridor risk for the next shift
- explainable reason signals
- resource-aware intervention planning

## Key Screens

- `Live Map`: city-wide forecast and hotspot exploration
- `Interventions`: queue-building and shift-ready enforcement planning
- `Analytics`: station-level forecast benchmarking and pressure analysis
- `Reports / Daily Brief`: leadership summary for top next-shift targets
- `Policy`: forecast-backed intervention and policy guidance

## AI / ML Status

LaneGuard includes a trained predictive model for `next-shift hotspot risk`.

Current benchmark summary from the holdout test window:

- Model: `xgboost_hotspot_classifier_v2`
- Average Precision: `0.6907`
- Baseline Average Precision: `0.3194`
- Precision @ Risk 55: `0.8652`
- Next-shift MAE: `0.7698`

This means the current model materially improves ranking quality over the heuristic baseline and is suitable for demo-grade predictive prioritization.

## Tech Stack

- Frontend: `React`, `Vite`, `TypeScript`
- Maps: `Leaflet`, `OpenStreetMap`
- ML / data pipeline: `Python`, `pandas`, `numpy`, `xgboost`, `lightgbm`, `catboost`

## Project Structure

- `src/`: frontend application
- `public/data/processed/`: runtime JSON artifacts used by the frontend
- `scripts/`: preprocessing and optimizer scripts
- `ml/`: training, evaluation, and inference pipeline
- `docs/`: planning, execution, and submission support docs

## Run The App Locally

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Start the app

```bash
npm run dev
```

### 3. Open the local URL shown by Vite

The demo runs directly from the processed files already included in `public/data/processed/`.

## Build For Production

```bash
npm run build
```

## Optional: ML / Data Pipeline

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Run preprocessing:

```bash
python scripts/preprocess_parking_data.py
```

Run model training:

```bash
python scripts/train_hotspot_risk_model.py
```

Run optimizer artifact generation:

```bash
python scripts/build_optimized_shift_plan.py
```

## Submission Notes

- The frontend runtime depends on `public/data/processed/`
- Raw dataset files and duplicate working artifacts under `data/processed/` are not required for judge-facing demo execution
- Source zip should exclude local build outputs and cache folders such as `node_modules/`, `dist/`, `.git/`, and `__pycache__/`

For exact form text, asset suggestions, and zip guidance, see:

- [docs/SUBMISSION_GUIDE.md](docs/SUBMISSION_GUIDE.md)

## Known Limitations

- Current demo uses offline processed data and offline forecast artifacts
- No live traffic API is integrated in this phase
- Forecast presentation is aligned to current operational context, but underlying training data is historical
- Resource planning is decision-support, not live dispatch integration
