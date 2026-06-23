# Product Requirements Document

## Product Name

LaneGuard

## Problem

Illegal and spillover parking near commercial areas, metro stations, and busy corridors causes localized congestion. Enforcement is reactive and patrol-driven. Police need a way to identify the most harmful hotspots, understand recurring patterns, prioritize intervention, and decide what type of action should be taken next.

## Vision

Create a map-first operational intelligence product that helps traffic police see where parking violations are clustering, estimate which clusters are causing the most disruption, act on the right zones first, and receive **data-driven recommendations** for enforcement and policy response.

## Goal

Win the prototype round by delivering a product that is:

- visually strong
- operationally credible
- clearly tied to Bengaluru traffic enforcement workflows
- functional enough to demo end-to-end in under 3 minutes

## Users

### Primary User

- Traffic Control Room Commander

### Secondary Users

- Police Station Supervisor
- Field Enforcement Officer
- Policy / operations reviewer

## User Problems

- I can see violations, but not which hotspots matter most.
- I cannot quickly compare station-level parking pressure.
- I do not have a practical shift plan based on data.
- I need a simple leadership summary, not a raw spreadsheet.
- I need guidance on what action to take, not only where the problem is.

## Product Goals

1. Identify repeated parking hotspots
2. Rank them by likely congestion impact
3. Help supervisors assign enforcement effort
4. Produce a concise leadership brief
5. Recommend explainable policy and enforcement actions

## Non-Goals

- Real-time camera ingestion
- Automated challan issuance
- Full patrol workforce management
- High-accuracy travel-time forecasting
- Native mobile app
- Final civil-engineering approval for new parking infrastructure

## Core User Stories

1. As a control-room commander, I want to see top parking hotspots on a map so I can understand current pressure zones quickly.
2. As a station supervisor, I want a ranked list of intervention areas so I can deploy limited staff more effectively.
3. As a field officer, I want to know why a hotspot is prioritized so I trust the recommendation.
4. As a senior reviewer, I want a simple summary of likely impact so I can understand the value of intervention.
5. As a policy or operations lead, I want recommended interventions with rationale so I can test better parking-management decisions.

## Functional Requirements

### FR1. Hotspot Visualization

- System must render parking incidents on a city map
- System must cluster nearby incidents into hotspots
- System must visually encode severity

### FR2. Filtering

- Filter by police station
- Filter by violation type
- Filter by date and hour
- Filter by hotspot severity

### FR3. Scoring

- Each hotspot must have a score
- Score must be explainable via visible contributing factors

### FR4. Hotspot Drilldown

- System must show hotspot details
- System must show top violation mix
- System must show recurrence pattern

### FR5. Enforcement Planning

- System must rank hotspots
- System must generate a shift-ready priority list

### FR6. Recommendation Engine

- System must recommend immediate enforcement actions
- System must recommend short-term policy actions
- System must recommend medium-term curb or parking-management actions
- System must show rationale for each recommendation

### FR7. Leadership Reporting

- System must provide a summary screen with top zones and metrics
- System must provide a summary of recommended actions

## Non-Functional Requirements

- Fast local startup
- Works on laptop screen during live demo
- Clear UI state transitions
- No dependence on unstable external APIs for the core flow

## Success Criteria

- Judge understands the problem and solution in under 60 seconds
- At least one believable end-to-end intervention flow is demoed
- Dashboard looks polished and intentional
- Recommendation logic is understandable and defensible
- Data lineage is defensible during Q&A

## Risks

- No direct congestion label in dataset
- Data date ambiguity in filename vs timestamps
- Overbuilding analytics instead of demo flow
- Overclaiming parking-capacity planning from incomplete data

## Risk Response

- Use an explainable proxy impact score
- State all assumptions clearly
- Optimize for interaction quality and operational clarity
- Frame policy output as recommendation support, not final planning truth
