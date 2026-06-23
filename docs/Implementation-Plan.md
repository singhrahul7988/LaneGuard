# Implementation Plan

## Theme Choice

Chosen theme: **Poor Visibility on Parking-Induced Congestion**

## Product

Working product name: **LaneGuard**

Core idea:

Build a web-based enforcement intelligence platform that converts parking-violation records into:

- hotspot clusters
- congestion-risk scores
- patrol priority recommendations
- station-wise dashboards
- daily enforcement briefs

This is the best match for a **strong UI/UX-led, realistic, buildable-in-3-days** submission.

## Exact Feature List

### MVP Features

1. **Hotspot Map**
   - Plot parking violations on a Bengaluru basemap
   - Cluster incidents by zoom level
   - Highlight hotspot severity using color and radius

2. **Hotspot Risk Scoring**
   - Compute a priority score per hotspot
   - Explain score drivers such as frequency, recency, main-road signals, junction proximity, and repeat-day density

3. **Command Center Dashboard**
   - Total parking violations
   - Top hotspots
   - Top police stations
   - Peak hours
   - Violation-type split

4. **Hotspot Detail Drawer**
   - Show exact area, violation mix, time distribution, station ownership, and recommended action
   - Display "why this hotspot matters" in plain language

5. **Enforcement Planner**
   - Rank hotspots by impact and urgency
   - Filter by station, time window, violation type, and confidence band
   - Generate a patrol action list for the next shift

6. **Station Insights**
   - Compare station-level parking pressure
   - Surface repeat corridors and recurring time bands

7. **Daily Brief / Report View**
   - One-screen summary for leadership
   - "Top 5 intervene-now zones"
   - "Expected relief if enforced today"

### Strong-If-Time-Permits Features

1. **Before/After Impact Simulator**
   - Estimate congestion relief if the top N hotspots are cleared

2. **Repeat Hotspot Forecast**
   - Predict where parking pressure will recur in the next shift using recent-day and hour patterns

3. **Route-Aware Patrol Order**
   - Order hotspot visits into a practical route for one field unit

### Stretch Features

1. **Officer mobile view**
2. **MapmyIndia route integration**
3. **CSV export / PDF brief**
4. **Saved watchlists for market, metro, and event zones**

## Exact Pages / Screens

1. **Landing / Scenario Intro**
   - Problem framing
   - "Start mission" CTA
   - Optional in final demo, not required in production flow

2. **Command Center**
   - Main map
   - KPI rail
   - Hotspot list
   - Filters

3. **Hotspot Details**
   - Map-centered details panel or slide-over
   - Score explanation
   - Time-of-day pattern
   - Recommended enforcement action

4. **Enforcement Planner**
   - Ranked hotspot queue
   - Shift objective builder
   - Suggested patrol order

5. **Station Analytics**
   - Station comparison charts
   - Hotspot recurrence analysis
   - Violation composition

6. **Daily Brief**
   - Leadership summary
   - Today's critical corridors
   - Expected intervention impact

7. **Data Explorer**
   - Search and inspect raw records
   - Useful for credibility during judging Q&A

## Tech Stack

### Frontend

- **Next.js 15**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **MapLibre GL JS** for interactive maps
- **Recharts** for charts

### Data / Analytics

- **Python 3.11**
- **pandas**
- **DuckDB**
- Optional: **scikit-learn** only for clustering or basic forecasting if needed

### App Data Serving

- Preprocessed JSON / GeoJSON generated locally from the CSV
- Served by Next.js route handlers or loaded from local `data/processed`

### Deployment / Demo

- Local-first demo with `npm run dev`
- Optional deploy to Vercel after local submission package is stable

## Dataset Assumptions

Grounded in the provided CSV:

- File: `Dataset/jan to may police violation_anonymized791b166.csv`
- Approx record count: **298,450**
- Coordinates are present for all sampled and checked rows
- Key useful columns:
  - `latitude`
  - `longitude`
  - `location`
  - `violation_type`
  - `created_datetime`
  - `police_station`
  - `junction_name`
  - `vehicle_type`
  - `validation_status`

### Important dataset assumptions

1. The filename says `jan to may`, but sampled rows show timestamps from **November 2023**.
   - Treat `created_datetime` as the source of truth, not the filename.

2. `violation_type` is stored as a JSON-like list string.
   - The preprocessing step must explode multiple offences per record.

3. The product will focus only on parking-related categories such as:
   - `WRONG PARKING`
   - `NO PARKING`
   - `PARKING IN A MAIN ROAD`
   - `PARKING ON FOOTPATH`
   - `DOUBLE PARKING`
   - `PARKING NEAR ROAD CROSSING`

4. The dataset does not directly contain:
   - speed / travel-time congestion labels
   - lane width
   - road hierarchy
   - images

5. Congestion impact must therefore be modeled as a **proxy score** rather than ground-truth traffic slowdown.

### Proxy assumptions for congestion impact

Use these signals:

- parking violation density within a 100m to 200m cluster
- recurrence across multiple days
- recency
- presence of `main road`, `road crossing`, `traffic light`, `zebra cross`, `footpath` in the violation or location metadata
- junction presence if available
- peak-hour concentration

## Judging Pitch

### 20-second version

`LaneGuard` turns raw parking violation records into an operational command system that shows where illegal parking is most likely choking roads right now, why those hotspots matter, and where enforcement teams should act first.

### 60-second version

Current parking enforcement is reactive. Officers know violations exist, but not which ones are causing the most traffic pain. `LaneGuard` uses real violation data to cluster illegal-parking hotspots, score their likely congestion impact, and generate a shift-ready priority list. Instead of showing a raw heatmap, it gives traffic police a decision tool: where to intervene first, what kind of parking behavior is recurring, and what relief that action is likely to create.

### Why this should score well

- **Feasible:** built on the actual provided data
- **Relevant:** directly addresses the stated challenge
- **Innovative:** prioritization and explainability, not just visualization
- **Impactful:** improves enforcement allocation
- **Scalable:** can extend station-by-station across Bengaluru

## 3-Day Build Plan

### Day 1: Data + Core Shell

- Finalize product scope and screen list
- Build preprocessing script
- Parse parking-only violations
- Create hotspot clusters and summary metrics
- Scaffold Next.js app
- Build design system tokens and layout shell
- Ship Command Center first draft with static processed data

### Day 2: Intelligence + Interactions

- Implement hotspot scoring
- Add filters, detail drawer, and station analytics
- Implement enforcement planner
- Add charts and map interactions
- Write the plain-language "why this hotspot matters" explanation logic

### Day 3: Polish + Submission

- Add daily brief screen
- Add before/after impact estimation
- Tighten loading, empty, and error states
- Rehearse demo flow
- Write README and run instructions
- Record demo video
- Package source, data instructions, and docs

## Final Submission Structure

```text
LaneGuard/
  app/ or src/
  components/
  lib/
  scripts/
    preprocess_parking_data.py
  data/
    raw/
    processed/
  public/
  docs/
  README.md
  package.json
  requirements.txt
  .env.example
```

Submission bundle should include:

- full source code
- local run instructions
- preprocessing instructions
- assumptions and limitations
- demo screenshots
- optional short video link

## Recommendation

Do not spend hackathon time on advanced ML unless the base product is already stable. A clean, explainable, map-first command system is more likely to win than a half-finished "AI" claim.

## AI Upgrade Roadmap

If the goal is to become one of the strongest entries in an `AI-driven` category, the next steps should be executed in this order.

### Phase 1: Baseline and Label Design

1. Freeze the current heuristic system as the baseline
   - keep current hotspot score, planner demand, and station views
   - store benchmark metrics so later AI upgrades can be compared honestly
2. Define the prediction targets
   - next-shift hotspot risk
   - expected violation volume
   - estimated congestion impact bucket
3. Create modeling-ready training rows
   - station
   - cluster
   - hour
   - weekday
   - recurrence
   - peak-hour share
   - violation mix
   - main-road and junction signals
4. Define evaluation criteria
   - ranking quality for top hotspots
   - forecast error for expected pressure
   - planner usefulness for limited-resource coverage

### Phase 2: Predictive Hotspot Risk Model

1. Build a feature generation pipeline in Python
   - temporal features
   - station history features
   - cluster recurrence features
   - violation composition features
2. Train a first practical model
   - start with LightGBM, XGBoost, or random forest
   - use a time-based validation split rather than a random split
3. Produce scored outputs for the app
   - predicted next-shift risk score
   - predicted violation count band
   - confidence band
4. Compare model outputs against the heuristic baseline
   - prove whether the model improves top-N hotspot ranking

### Phase 3: Congestion Impact Estimation

1. Define a stronger impact target
   - impact bucket
   - expected relief bucket
   - congestion severity proxy calibrated from observed signals
2. Train an impact model using available proxy features
   - main-road signal
   - junction proximity
   - peak concentration
   - recurrence
   - cluster density
   - station pressure
3. Expose model outputs in the app
   - predicted impact
   - top reasons
   - confidence

### Phase 4: Allocation Optimization

1. Formalize the planner as an optimization problem
   - inputs: hotspot demand, station pools, shift limits, travel assumptions
   - objective: maximize predicted relief under capacity constraints
2. Implement an optimizer
   - use OR-Tools or PuLP
   - generate recommended coverage sets and unit packages
3. Compare optimizer results with the current manual queue flow
   - show why the recommendation is better than first-come manual selection
4. Add fallback behavior
   - if optimization fails, preserve the current heuristic planner flow

### Phase 5: Explainability and Confidence

1. Add top-factor explanations per hotspot
   - show why the model ranked this corridor highly
2. Add confidence labels
   - high
   - medium
   - low
3. Add recommendation rationale for planner output
   - why this station pool
   - why this unit mix
   - what tradeoff was made

### Phase 6: Feedback Loop and Continuous Learning

1. Capture planner outcomes
   - what was queued
   - what was committed
   - what was cleared or not cleared
2. Add simulated or observed outcome labels
   - relief achieved
   - residual uncovered hotspots
   - repeat occurrence after intervention
3. Retrain periodically using those outcomes
   - improve ranking
   - improve impact estimation
   - improve allocation logic

### Phase 7: Product Story and Judge Positioning

1. Reposition the product language only after the above exists
   - current honest label: `AI-assisted enforcement intelligence`
   - future stronger label: `AI-driven parking enforcement intelligence`
2. Update the demo flow to showcase:
   - prediction
   - impact estimation
   - optimized allocation
   - explainability
3. Show before vs after
   - heuristic ranking
   - AI ranking
   - manual allocation
   - optimized allocation

## Recommended Technical Additions

- Python modeling stack:
  - `pandas`
  - `scikit-learn`
  - `lightgbm` or `xgboost`
  - `shap` for explainability
- Optimization stack:
  - `ortools` or `pulp`
- Output artifacts:
  - `model_hotspot_scores.json`
  - `model_impact_scores.json`
  - `optimized_shift_plan.json`
  - `model_explanations.json`

## What This Changes In The Product

- `Command Center`
  - show predicted next-shift hotspots, not only historical ones
- `Hotspot Detail`
  - show model reasons and confidence
- `Enforcement Planner`
  - add optimizer-recommended queue and unit allocation
- `Station Analytics`
  - compare observed pressure vs predicted pressure
- `Daily Brief`
  - include next-shift forecast and expected relief under the recommended plan
