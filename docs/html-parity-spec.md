# HTML Parity Spec

## Purpose

This file defines how stitched HTML screens must be translated into the implementation codebase without structural drift.

## Source Of Truth

The authoritative screen references are the HTML files in `stitch_screens/*/code.html`.

The screenshot PNGs are visual references.

The DESIGN system reference is:

- `stitch_screens/laneguard/DESIGN.md`

## Implementation Rule

When converting stitched HTML into React, Vue, backend templates, or any other rendering system:

- preserve the main region hierarchy
- preserve the role of each container
- preserve the relative order of sections
- preserve the map-first or panel-first weighting
- do not rename structural regions arbitrarily

## Required Region Naming

Use `data-region` attributes or component names that map clearly to the source structure.

### Command Center

- `topNavBar`
- `filterBar`
- `mapCanvas`
- `kpiRail`
- `interveneNowPanel`

### Hotspot Detail Drawer

- `contextCanvas`
- `drawerHeader`
- `reasonChips`
- `charts`
- `recommendations`

### Policy Recommendations

- `topNavBar`
- `sideNavBar`
- `tabRail`
- `rankedList`
- `supportPanel`

### Enforcement Planner

- `plannerFilters`
- `rankedQueue`
- `selectedActionQueue`
- `reliefSummary`

### Daily Brief

- `briefHeader`
- `headlineMetrics`
- `topHotspots`
- `policySummary`
- `mapInset`

### Station Analytics

- `stationTable`
- `barChart`
- `heatmap`
- `trendChart`
- `mapSnippets`

### Data Explorer

- `searchBar`
- `filters`
- `recordsTable`
- `recordInspector`
- `mapPreview`

## Conversion Rules

1. Keep the HTML section order intact unless interaction logic requires a wrapper.
2. Add accessibility and state hooks freely, but do not flatten the screen into generic reusable cards too early.
3. Shared styles can be abstracted, but screen containers should remain recognizable from the stitched HTML.
4. If a screen uses a side rail or top rail in the stitched HTML, keep that layout model in the implementation.
5. If a screen uses grouped recommendation cards, keep grouped cards rather than collapsing them into a table by default.

## Allowed Changes

- replacing CDN Tailwind setup with app-level tokens
- moving repeated controls into reusable components
- replacing static text with bound data
- replacing mock charts with real chart components
- replacing placeholder map backgrounds with interactive maps

## Not Allowed Without Explicit Intent

- converting map-first screens into chart-first screens
- replacing right-rail action panels with bottom sections
- renaming or removing core layout regions
- merging multiple regions into one generic content block
- changing the recommendation grouping model

## Workflow

1. Preserve structure
2. Port styling tokens
3. Bind real data
4. Add interactions
5. Validate against original stitched HTML
