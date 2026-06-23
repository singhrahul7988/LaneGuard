# Execution Log

## Status

Project: `LaneGuard`

Theme: `Poor Visibility on Parking-Induced Congestion`

Current phase: `Implementation`

## Done

- Chose final theme: parking-induced congestion
- Audited provided dataset path and structure
- Confirmed the dataset includes usable columns:
  - coordinates
  - timestamps
  - police station
  - parking-related violation labels
- Profiled the dataset at a high level:
  - approx 298,450 rows
  - strong parking categories
  - valid coordinate coverage in the sampled checks
- Created the planning docs set
- Added the recommendation layer:
  - data-driven recommendations
  - explainable intervention suggestions
  - policy decision support
- Added the frontend scaffold:
  - React + Vite + TypeScript project shell
  - route-per-screen workbench
  - HTML parity contract
  - screen region mapping based on stitched HTML
- Installed frontend dependencies
- Ported `Command Center` into a real screen-level React implementation
- Ported `Hotspot Detail Drawer` into a real screen-level React implementation
- Ported `Policy Recommendations` into a real screen-level React implementation
- Ported `Enforcement Planner` into a real screen-level React implementation
- Ported `Daily Brief` into a real screen-level React implementation
- Ported `Station Analytics` into a real screen-level React implementation
- Ported `Data Explorer` into a real screen-level React implementation
- Added the data preprocessing pipeline:
  - `scripts/preprocess_parking_data.py`
  - processed 298,450 parking records
  - generated 7,816 hotspot aggregates
  - emitted JSON outputs for hotspots, stations, brief, and recommendations
- Wired processed JSON into:
  - Command Center
  - Hotspot Detail Drawer
  - Policy Recommendations
  - Enforcement Planner
  - Daily Brief
  - Station Analytics
  - Data Explorer
- Added client-side filtering and inspection flow for the record explorer
- Added station benchmarking, heatmap, and repeat-hotspot analytics views
- Added shift-planning queue behavior and projected relief logic for enforcement planning
- Added cross-screen drilldowns:
  - Command Center -> Hotspot Detail
  - Hotspot Detail -> Enforcement Planner
  - Station Analytics -> Data Explorer
- Replaced remote font/icon dependency in verified screens with local glyph icons
- Extended local glyph icon cleanup to:
  - Daily Brief
  - Policy Recommendations
  - Enforcement Planner nav shell
- Normalized route-based navigation across the main operational screens
- Verified the app still builds successfully after each major step
- Verified the primary UI flow in Playwright using a local static preview:
  - no runtime overlay
  - working drilldowns
  - working planner queue toggle
  - working analytics-to-explorer filter handoff
  - clean console on the validated flow
- Reworked the root experience from a developer workbench into a judge-facing home screen
- Removed developer-only workbench copy and route clutter from the main entry flow
- Standardized top-header navigation across operational screens and removed left-side screen sidebars
- Upgraded map surfaces to interactive Leaflet/OpenStreetMap canvases inside fixed containers:
  - pan
  - wheel zoom
  - zoom controls
  - reset view
  - constrained viewport behavior
- Replaced static/mock map behavior across dashboard screens with shared `GeoMap` interactions
- Added dynamic header/alert navigation so screen actions route into real app flows instead of static buttons
- Tightened map UX and map density:
  - reduced overlay crowding
  - removed extra map attribution copy from the visible UI
  - improved zoom range so far-away hotspots remain reachable
  - made the selected marker visually clearer with a red selection ring
- Refined branding and header presentation:
  - `LaneGuard` shown before `Bengaluru Traffic Police`
  - added live status chip animation
  - replaced placeholder letter icons with actual section icons
  - removed unused notification/settings utility buttons
- Locked split-pane UX for detail-heavy screens:
  - `Hotspot Detail` map stays fixed while only the right-side information column scrolls
  - `Command Center` map stays fixed while the right-side ranking list scrolls below the KPI rail
- Reduced and rebalanced the `Selected Corridor` map card so it occupies less map area while remaining readable
- Normalized filter labels so visible `All` values are capitalized consistently in the UI
- Added AI-upgrade planning docs:
  - AI fit assessment
  - phased AI roadmap
  - engineering task list
- Implemented Phase 1 AI-upgrade artifacts in preprocessing:
  - shift-aware feature extraction
  - model feature manifest
  - model training dataset export
  - baseline benchmark summary
  - next-shift forecast artifact
- Added typed AI forecast data models in the frontend
- Wired `next_shift_forecast` and baseline benchmark outputs into `Daily Brief`:
  - next-shift forecast summary strip
  - confidence mix
  - watchlist cards
  - forecast-linked map and corridor selection
- Wired `next_shift_forecast` into `Command Center`:
  - compact next-shift forecast module in the ops rail
  - forecast risk summary
  - confidence pills
  - click-to-focus into the live station/corridor context
- Implemented the first learned forecast model:
  - `scripts/train_hotspot_risk_model.py`
  - learned historical-rate forecasting based on cluster / station / shift recurrence
  - generated model outputs:
    - `model_hotspot_scores.json`
    - `model_validation_summary.json`
    - `model_explanations.json`
- Switched forecast UI surfaces to prefer trained-model outputs over heuristic baseline outputs when available
- Added a dedicated benchmark artifact for trained-model vs heuristic comparison:
  - `heuristic_vs_model_benchmark.json`
- Added AI forecast reasoning into `Hotspot Detail`:
  - next-shift risk score
  - hotspot likelihood
  - expected records
  - confidence band
  - training support count
  - top model drivers
- Added visible AI benchmark surface in `Station Analytics`:
  - model vs baseline comparison cards
  - validation window
  - comparison summary note
- Fixed AI-screen polish issues after review:
  - removed mojibake separators from user-facing hotspot labels
  - made AI metric cards and benchmark cards fit better in narrow panels
  - corrected benchmark delta wording so lower-is-better metrics are not presented misleadingly
- Implemented the first optimizer artifact for `Interventions`:
  - `scripts/build_optimized_shift_plan.py`
  - generated `optimized_shift_plan.json`
  - added `AI Suggested Queue` load-in flow to the enforcement planner
- Upgraded the planner recommender to strategy-aware AI planning:
  - `Balanced`
  - `Max Relief`
  - `High Confidence`
  - surfaced directly in `Interventions`
- Replaced the planner's greedy queue selector with a stronger constraint-aware beam search optimizer:
  - `strategy_aware_beam_optimizer_v3`
  - evaluates queue combinations under resource limits instead of only picking locally-best next hotspots
- Added plan-level impact confidence to optimizer outputs and key UI surfaces:
  - relief confidence band
  - relief percentage range
  - confidence note based on forecast coverage and support
  - surfaced in `Interventions` and `Daily Brief`

## Tooling Blockers

- Codex in-app browser runtime currently unavailable in this environment
  - browser bootstrap returns `Browser is not available: iab`
  - this is a tooling/runtime blocker, not an app runtime error

## Current

- Continue the AI upgrade from prediction into prescriptive planning
- Continue moving from plan-level relief confidence toward a fuller modeled impact estimator
- Upgrade the current strategy-aware beam optimizer into a stronger exact or near-exact recommendation engine
- Keep validating dense screen layouts as AI cards are added
- Keep sharpening forecast quality with better feature engineering and later tuning now that the strict split pipeline is in place

## Next

1. Move from plan-level relief confidence to hotspot-level or corridor-level impact modeling
2. Upgrade the current beam optimizer with stronger exact or near-exact optimization logic and tunable tradeoff controls
3. Add a second modeling round with calibrated probabilities and hyperparameter tuning on the new `ml/` pipeline
4. Surface model rationale in additional screens where it changes operator decisions
5. Continue responsive QA on dense analytics and planning layouts

## Future

- Add a real hotspot-risk prediction layer
  - predict next-shift illegal parking pressure by station, corridor, hour, and weekday
  - replace purely heuristic ranking with model-assisted prioritization
- Add a modeled congestion-impact estimator
  - move beyond proxy-only impact scoring
  - estimate likely traffic-flow disruption using observed parking pressure features
- Add an allocation optimizer
  - recommend which hotspots to cover first
  - recommend from which station pool to allocate
  - recommend the best unit mix under limited capacity
- Add AI explainability surfaces
  - show why a hotspot was ranked high
  - expose top contributing factors and confidence
- Add outcome feedback and learning
  - capture committed plans and their observed or simulated results
  - use this to recalibrate ranking and resource recommendations
- Add confidence bands and uncertainty
  - show whether a forecast or recommendation is high, medium, or low confidence
- Add scenario forecasting
  - estimate what happens if a hotspot is not covered
  - estimate projected relief if a given unit package is deployed
- Add route-aware planning
- Add forecast view
- Add exportable brief
- Add stronger station benchmarking

## AI Fit Assessment

- Current product position is strongest as an `AI-assisted enforcement planning` platform, not yet a fully `AI-driven` intelligence engine
- Current strengths:
  - real dataset grounding
  - operational workflow design
  - explainable hotspot and enforcement views
  - strong station-wise and shift-wise planning UX
- Current gaps versus the problem statement:
  - no true traffic-impact model yet
  - no confidence / uncertainty layer yet
  - no feedback loop from committed actions back into the intelligence layer
- Best path to category leadership:
  - add one predictive model
  - add one optimization layer
  - add one explainability and confidence layer
  - keep the current UI as the execution and audit surface

## Risks To Track

- Scope creep into generic analytics
- Over-investing in model complexity
- Dataset time ambiguity
- Dependence on external APIs for the core demo
- Claiming `AI-driven` too strongly before predictive and optimization layers are implemented

## Working Rules

- Keep the app web-first
- Optimize for judge clarity
- Prefer explainable heuristics over opaque ML
- Keep every screen tied to an operational decision
- Upgrade AI claims only when a real inference or optimization layer exists in the product

## Latest Upgrade

- Added a root `ml/` workspace for feature prep, strict time splits, evaluation, and inference
- Extended preprocessing to emit `model_scoring_rows.csv` alongside `model_training_rows.csv`
- Replaced the dependency-free learned-rate forecaster with a stricter model-selection pipeline:
  - heuristic baseline benchmark
  - `XGBoost` candidate
  - `LightGBM` candidate
- Enforced date-disjoint `train / validation / test` windows:
  - train: `2023-11-09` to `2024-03-11`
  - validation: `2024-03-12` to `2024-03-25`
  - holdout test: `2024-03-26` to `2024-04-08`
- Shipped new artifacts:
  - `model_hotspot_scores.json`
  - `model_validation_summary.json`
  - `heuristic_vs_model_benchmark.json`
  - `model_explanations.json`
  - `model_selection_report.json`
- Current forecast champion:
  - `lightgbm_hotspot_classifier_v1`
  - chosen threshold: `0.62`
  - validation average precision: `0.6083`
  - holdout average precision: `0.6364`
- Holdout comparison versus heuristic baseline:
  - average precision: `0.6364` vs `0.3194`
  - precision@55: `0.4802` vs `0.3217`
  - recall@55: `0.6107` vs `0.4278`
  - next-shift MAE: `0.8343` vs `2.834`
- Hid `Data Explorer` from the main operator navigation and home flow
- Reframed UI copy around predicted next-shift risk, forecast confidence, and intervention planning instead of raw-record browsing
