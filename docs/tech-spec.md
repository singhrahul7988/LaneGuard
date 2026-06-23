# Technical Specification

## System Overview

LaneGuard is a local-first web application with offline preprocessing.

Flow:

1. Raw CSV is processed by Python scripts
2. Processed outputs are written as JSON and GeoJSON
3. Next.js app loads processed outputs and renders maps, charts, ranked recommendations, and policy suggestions

## Architecture

```text
Raw CSV
  -> Python preprocessing
  -> cleaned parking records
  -> hotspot aggregates
  -> station aggregates
  -> temporal summaries
  -> recommendation rules engine
  -> JSON / GeoJSON
  -> Next.js app
  -> map + dashboard + planner + brief + policy recommendations
```

## Modules

### 1. Data Ingestion

Input:

- `Dataset/jan to may police violation_anonymized791b166.csv`

Responsibilities:

- load CSV
- normalize nulls
- parse timestamps
- parse `violation_type`
- filter parking-related categories

### 2. Spatial Aggregation

Responsibilities:

- generate hotspot clusters
- aggregate records by rounded geospatial cells or DBSCAN clusters
- compute cluster centroid, count, recency, station ownership

### 3. Scoring Engine

Produce:

- `hotspot_priority_score`
- `impact_proxy_score`
- human-readable score reasons

### 4. Recommendation Engine

Produce:

- `immediate_actions[]`
- `short_term_actions[]`
- `medium_term_actions[]`
- `recommendation_reasons[]`

Implementation approach:

- deterministic rules engine
- optional ranking score for recommendations
- no LLM dependency in core product logic

### 5. Presentation Layer

Responsibilities:

- map rendering
- charts
- detail panels
- planner list
- leadership brief
- recommendation cards

## Proposed Data Outputs

### `parking_records.json`

- cleaned row-level records for explorer and details

### `hotspots.geojson`

- centroid, bounds, station, score, record count, top violation labels

### `station_summary.json`

- violations, hotspots, top categories, peak hours

### `time_summary.json`

- hourly and weekday distributions

### `brief_summary.json`

- top five actionable hotspots and leadership metrics

### `policy_recommendations.json`

- hotspot-linked recommendations
- action type
- confidence band
- reason strings

## Hotspot Scoring Formula

Use a transparent weighted score:

```text
priority_score =
  0.35 * normalized(cluster_volume_14d)
  0.20 * normalized(repeat_days_count)
  0.15 * normalized(recency_weight)
  0.10 * normalized(peak_hour_density)
  0.10 * normalized(junction_risk)
  0.10 * normalized(severity_mix)
```

### Definitions

- `cluster_volume_14d`: violations in hotspot over recent period
- `repeat_days_count`: number of distinct days the hotspot appears
- `recency_weight`: stronger if seen in the latest days
- `peak_hour_density`: concentration during commute windows
- `junction_risk`: boosted when metadata suggests junction or crossing risk
- `severity_mix`: boosted for main-road, crossing, double-parking, or footpath-related mixes

## Explainability Rules

Each hotspot must show 2 to 4 reason chips such as:

- `Recurring across 9 days`
- `High peak-hour density`
- `Near road crossing`
- `Main-road parking incidents`

## Recommendation Rules

Generate intervention suggestions from data signals, for example:

- If hotspot has high recurrence + peak-hour concentration + `NO PARKING`:
  - suggest timed enforcement and peak-hour restriction review
- If hotspot includes `PARKING IN A MAIN ROAD`:
  - suggest tow-priority enforcement and stricter main-road curb control
- If hotspot includes crossing or junction risk:
  - suggest no-parking buffer and signage reinforcement
- If hotspot shows repeat spillover across many days:
  - suggest evaluating nearby managed short-stay parking supply
- If hotspot appears commercial and short-duration:
  - suggest loading / unloading slot experiment

## Recommendation Guardrails

- Recommendations must be explainable from visible features
- Recommendations must be phrased as support for decision-making
- The system must not claim legal or engineering certainty

## APIs / Data Access

For MVP, prefer local JSON loads or simple Next.js route handlers:

- `GET /api/hotspots`
- `GET /api/stations`
- `GET /api/records`
- `GET /api/brief`
- `GET /api/recommendations`

## Performance Targets

- Initial load under 3 seconds on processed local data
- No map freeze on zooming
- Filter interactions under 300ms for visible summaries

## Implementation Notes

- Avoid server complexity unless needed
- Pre-aggregate heavily before UI
- Keep the core flow independent of third-party keys
- External map services should enhance the product, not block it

## Libraries

### Python

- `pandas`
- `duckdb`
- `pyarrow`
- optional `scikit-learn`

### Web

- `next`
- `react`
- `tailwindcss`
- `shadcn/ui`
- `maplibre-gl`
- `recharts`
- `zod`

## Open Questions

- Whether to use grid-based clustering or DBSCAN
- Whether to add a small forecast model on Day 3
- Whether to integrate MapmyIndia only visually or functionally
