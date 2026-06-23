# UX Specification

## UX Goal

Make judges feel they are looking at a real traffic command product, not a student dashboard.

## Design Direction

- Civic operations interface
- Bright map layer over dark command canvas
- Strong use of cobalt, amber, red, and off-white
- Dense but readable information hierarchy
- Minimal decorative noise

## Primary Experience Principles

1. **Map first**
   The city is the main stage.

2. **Action over analysis**
   Every screen should lead toward a decision.

3. **Explainable intelligence**
   Scores must always answer "why."

4. **Recommendations must feel accountable**
   Every suggested action must show evidence and rationale.

5. **Fast scanning**
   Judges should understand state within 5 to 10 seconds.

## Information Architecture

- Command Center
- Hotspot Details
- Enforcement Planner
- Policy Recommendations
- Station Analytics
- Daily Brief
- Data Explorer

## Screen Requirements

### Command Center

Must include:

- full-height city map
- filter bar
- KPI row
- "intervene now" panel

### Hotspot Details

Must include:

- score
- reason chips
- recent trend
- violation composition
- recommended action
- policy suggestion groupings

### Enforcement Planner

Must include:

- ranked list
- urgency tags
- shift selector
- station filter
- selected action queue
- projected relief summary

### Policy Recommendations

Must include:

- immediate actions
- short-term policy suggestions
- medium-term parking-management suggestions
- rationale tied to hotspot evidence
- confidence or strength label

### Station Analytics

Must include:

- comparison chart
- repeat hotspot counts
- time-band trends

### Daily Brief

Must include:

- executive headline
- top 5 hotspots
- predicted relief
- station status summary
- top recommended actions

## Interaction Patterns

- Hover map cluster -> quick preview
- Click hotspot -> detail drawer
- Adjust filters -> charts and planner update
- Click "Build shift plan" -> pre-ranked intervention list
- Review recommendation cards -> understand action rationale

## Visual Tokens

### Colors

- `bg-canvas`: near-black charcoal
- `surface`: deep slate
- `primary`: civic blue
- `warning`: amber
- `critical`: traffic red
- `success`: signal green

### Typography

- Headlines: bold geometric sans
- Body: highly legible neutral sans
- Numeric KPIs: large, condensed, high contrast

## Components

- Map panel
- KPI cards
- Severity legend
- Filter chips
- Data table
- Detail drawer
- Insight cards
- Ranked action list
- Recommendation cards

## Empty / Loading / Error States

- Empty states must guide the next action
- Loading states should use skeletons, not spinners-only
- Error states should degrade gracefully to cached or sample data

## Responsive Behavior

Primary target:

- Laptop and projector demo

Secondary target:

- Tablet

Mobile:

- Nice to have, not submission critical

## Accessibility

- Sufficient contrast on dark background
- Keyboard focus styles
- Charts should always have visible textual summaries
