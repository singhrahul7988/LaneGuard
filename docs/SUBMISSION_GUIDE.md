# Submission Guide

## Submission Title

`LaneGuard`

## Theme

`Poor Visibility on Parking-Induced Congestion`

## Submission Description

Use this in the platform description field:

> LaneGuard is an AI-assisted parking-enforcement intelligence system built for Bengaluru Traffic Police. It predicts which corridors are most likely to become high-risk parking hotspots in the next shift, explains why those locations matter, and helps operators convert forecasted risk into actionable intervention plans.  
>  
> The system combines hotspot detection, next-shift risk prediction, explainable signals such as recurrence and junction conflict, station-level analytics, and resource-aware intervention planning. Instead of relying on reactive patrol-based enforcement, LaneGuard gives command-center teams a city-wide operational view of where parking-induced congestion is most likely to escalate next and what action should be prioritized first.  
>  
> Our current model materially outperforms the heuristic baseline on holdout evaluation, improving Average Precision from 0.3194 to 0.6907 while also reducing next-shift count error. The result is a practical, explainable workflow for forecast-backed parking enforcement and congestion reduction.

## Demo Link

Use your final hosted app URL here.

Suggested format:

`https://<your-demo-host>/`

## Repository URL

`https://github.com/singhrahul17988/LaneGuard.git`

## Video URL

Use your final uploaded demo video URL here.

Suggested format:

`https://youtu.be/<video-id>`

## Instructions To Run

Use this in the run-instructions field:

> 1. Install Node.js 18+  
> 2. Run `npm install`  
> 3. Run `npm run dev`  
> 4. Open the local URL shown by Vite in the terminal  
> 5. The app runs from the processed JSON artifacts already included in `public/data/processed/`  
>  
> Optional ML pipeline:  
> - Install Python 3.11+  
> - Run `pip install -r requirements.txt`  
> - Run `python scripts/preprocess_parking_data.py`  
> - Run `python scripts/train_hotspot_risk_model.py`  
> - Run `python scripts/build_optimized_shift_plan.py`

## Snapshots To Upload

Use 5 screenshots:

1. `Live Map` with selected corridor and next-shift forecast panel
2. `Interventions` with ranked targets and projected relief summary
3. `Analytics` showing model-vs-baseline benchmark
4. `Reports / Daily Brief` with top forecast interventions
5. `Policy` showing forecast-backed recommendation view

## Presentation File

Recommended upload:

- PDF export of your pitch deck
- Keep it under 10 to 15 slides

Suggested deck structure:

1. Problem
2. Why current enforcement is reactive
3. What LaneGuard does
4. System workflow
5. AI / ML benchmark
6. Live Map
7. Interventions
8. Analytics
9. Daily Brief / Policy
10. Impact and next steps

## Source Code Zip

### Include

- `src/`
- `public/`
- `scripts/`
- `ml/`
- `docs/`
- `package.json`
- `package-lock.json`
- `requirements.txt`
- `README.md`
- `.env.example`
- `tsconfig*.json`
- `vite.config.*`
- `index.html`

### Do Not Include

- `.git/`
- `node_modules/`
- `dist/`
- `.vscode/`
- `__pycache__/`
- `.tmp/`
- `Dataset/`
- `data/processed/`
- any local archives or exported screenshots not needed for judging

### Why

- `public/data/processed/` already contains the runtime artifacts needed by the app
- `data/processed/` is a duplicate working directory for ML pipeline generation
- excluding `node_modules/`, `dist/`, and raw dataset files keeps the zip within submission limits

## Git Ignore Rules To Keep

- `node_modules/`
- `dist/`
- `Dataset/`
- `data/processed/`
- `__pycache__/`
- local logs, temp files, and archives

## Best Assets To Use

- Logo / favicon: `public/laneguard-mark.svg`
- Demo talking points: `docs/demo-script.md`
- Implementation summary: `docs/execution-log.md`
- Submission narrative: this file
