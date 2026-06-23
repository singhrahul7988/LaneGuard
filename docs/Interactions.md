# Interaction Flows

## Primary User: Control Room Commander

### Flow 1: Identify Today's Top Problem Areas

1. Open Command Center
2. View Bengaluru map with active hotspots
3. Read KPI row
4. Click the highest-severity hotspot
5. Inspect score reasons and time pattern
6. Review suggested actions
7. Add hotspot to shift plan

Outcome:

- Commander knows where to intervene first and what type of intervention to apply

## Secondary User: Station Supervisor

### Flow 2: Build Shift Plan

1. Open Enforcement Planner
2. Filter to station
3. Filter to next shift time band
4. Review ranked hotspot list
5. Review recommended actions for the top hotspots
6. Select top 3 intervention zones
7. Export or present shift brief

Outcome:

- Supervisor gets a practical data-backed tasking list

## Secondary User: Senior Reviewer / Judge

### Flow 3: Understand Product Value Fast

1. Open Daily Brief
2. Read headline metrics
3. View top 5 hotspots
4. Open one hotspot
5. See plain-language explanation
6. See recommended actions
7. View predicted relief summary

Outcome:

- Reviewer understands real-world utility in under 2 minutes

## Key UI Interactions

### Map Cluster Hover

- Show compact tooltip
- Count
- Station
- Severity

### Map Cluster Click

- Zoom in or open hotspot drawer

### Filter Changes

- Update map
- Update KPIs
- Update ranked list
- Update charts

### Add to Plan

- Hotspot moves into planner queue
- Queue updates summary count and projected relief

## Screen-by-Screen Interaction Notes

### Command Center

- User lands on city map
- First visual anchor is the top hotspot rail
- Clicking any rail item focuses the map and opens details

### Hotspot Details

- Details drawer must support:
  - quick summary
  - time pattern
  - reasons
  - action recommendation
  - policy recommendation rationale

### Planner

- User can sort by score, recurrence, or station
- User can save the selected set as "Morning Shift" or "Evening Shift" locally

### Daily Brief

- Pure presentation mode
- Minimal controls
- Built for leadership walkthrough

### Policy Recommendations

- User can compare immediate, short-term, and medium-term interventions
- Each recommendation must be linked to visible evidence

## Demo Interaction Sequence

1. Show city-wide hotspot overview
2. Filter to one station or corridor
3. Open top hotspot
4. Explain scoring
5. Show recommended actions
6. Build shift plan
7. Show expected impact in Daily Brief
