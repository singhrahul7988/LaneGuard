---
name: LaneGuard
colors:
  surface: '#111317'
  surface-dim: '#111317'
  surface-bright: '#37393e'
  surface-container-lowest: '#0c0e12'
  surface-container-low: '#1a1c20'
  surface-container: '#1e2024'
  surface-container-high: '#282a2e'
  surface-container-highest: '#333539'
  on-surface: '#e2e2e8'
  on-surface-variant: '#c4c5d9'
  inverse-surface: '#e2e2e8'
  inverse-on-surface: '#2f3035'
  outline: '#8e90a2'
  outline-variant: '#434656'
  surface-tint: '#b8c3ff'
  primary: '#b8c3ff'
  on-primary: '#002388'
  primary-container: '#2e5bff'
  on-primary-container: '#efefff'
  inverse-primary: '#124af0'
  secondary: '#ffd79b'
  on-secondary: '#432c00'
  secondary-container: '#ffb211'
  on-secondary-container: '#6b4800'
  tertiary: '#ffb4aa'
  on-tertiary: '#690003'
  tertiary-container: '#d71a18'
  on-tertiary-container: '#ffece9'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c3ff'
  on-primary-fixed: '#001356'
  on-primary-fixed-variant: '#0035be'
  secondary-fixed: '#ffdeae'
  secondary-fixed-dim: '#ffba3f'
  on-secondary-fixed: '#281800'
  on-secondary-fixed-variant: '#604100'
  tertiary-fixed: '#ffdad5'
  tertiary-fixed-dim: '#ffb4aa'
  on-tertiary-fixed: '#410001'
  on-tertiary-fixed-variant: '#930005'
  background: '#111317'
  on-background: '#e2e2e8'
  surface-variant: '#333539'
typography:
  display-kpi:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
spacing:
  unit: 4px
  gutter: 16px
  margin: 24px
  panel-padding: 12px
---

## Brand & Style
The design system is engineered for high-stakes operational environments, specifically the Bengaluru Traffic Police command centers. The brand personality is authoritative, systematic, and urgent. It prioritizes information density and split-second legibility over aesthetic fluff. 

The design style is **Corporate / Modern** with a lean toward **Functional Brutalism**. This means a focus on high-contrast data visualization, sharp geometric precision, and a total absence of decorative effects. The interface should feel like a specialized tool—rugged, reliable, and precise—mimicking the "government-tech" aesthetic of aerospace or infrastructure control systems.

Key attributes:
- **Mission Critical:** Every pixel serves a data-driven purpose.
- **Dense but Clear:** Maximizing screen real estate for map-heavy and table-heavy views.
- **Authoritative:** A "Command and Control" aesthetic that instills confidence in decision-making.

## Colors
The color palette is optimized for a dark, low-light command center environment to reduce eye strain over long shifts.

- **Canvas:** The primary background is a deep charcoal/navy (`#0F1115`), providing a non-reflective base.
- **Primary (Cobalt Blue):** Used strictly for high-priority actions, primary navigation, and official status indicators.
- **Severity Scales:** 
    - **Amber (#FFB100):** Moderate congestion, caution, or secondary alerts.
    - **Red (#FF3B30):** Gridlock, accidents, or immediate intervention required.
- **High-Contrast White (#FFFFFF):** Reserved for critical values and primary labels to ensure maximum readability against the dark canvas.
- **Muted Slate (#64748B):** Used for secondary text, grid lines, and non-essential UI borders to maintain hierarchy.

## Typography
This design system utilizes **Inter** for its exceptional legibility at small sizes and high-density layouts. For specialized data points like vehicle numbers or timestamps, **JetBrains Mono** is introduced to ensure character distinction.

- **KPI Typography:** Large numerals use `display-kpi` for immediate recognition from a distance.
- **Functional Labels:** All labels for data points (e.g., "Avg. Speed", "Congestion Index") use `label-caps` to distinguish them from the data itself.
- **Hierarchy:** Use weight (SemiBold/Bold) rather than size increases to differentiate information, maintaining a compact vertical footprint.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a strictly enforced 4px baseline rhythm. 

- **Density:** Padding is intentionally tight (8px to 12px within cards) to allow for more data on screen.
- **Structure:** Use a 12-column grid for the main dashboard. Side panels (like the Intervention Support panel) should be fixed-width (approx. 320px - 400px) to ensure the map area remains the focal point.
- **Map Overlays:** Tooltips and data-overlays must not obscure key junctions. Use "lead lines" if necessary to anchor tooltips to specific geographic coordinates.
- **Responsiveness:** On smaller screens, the side panels collapse into icons, and the 12-column grid reflows to a single column, prioritizing the Map and KPI cards.

## Elevation & Depth
In this design system, depth is communicated through **Tonal Layers** and **Low-Contrast Outlines** rather than traditional shadows.

- **Layer 0:** Deepest background (Canvas).
- **Layer 1:** Surfaces for widgets and panels (`#1A1D23`).
- **Layer 2:** Hover states or active selections within lists.
- **Borders:** Use 1px solid borders (`#2D3139`) to define container edges. Avoid drop shadows entirely to maintain a crisp, digital-first look. 
- **Focus:** High-priority alerts may use a subtle outer glow of the severity color (Amber/Red) to "break" the flat plane and draw the operator's eye.

## Shapes
The shape language is strictly **Sharp (0px)**. 

Every UI element—from buttons to cards to input fields—must have 90-degree corners. This reinforces the authoritative, "no-nonsense" nature of the software. Circular elements are reserved exclusively for status indicators (LED-style lamps) or map markers to create a clear visual distinction between UI structure and data points.

## Components
- **KPI Cards:** Flat boxes with a 2px top-border color-coded to status. Large numerals left-aligned.
- **Buttons:** 
  - **Primary:** Solid Cobalt Blue, white uppercase text.
  - **Ghost:** 1px white or slate border, no fill.
- **Data Tables:** Sharp-edged, no cell borders, alternating row stripes (subtle). Headers are all-caps with sort icons.
- **Input Fields:** Darker than the surface layer, 1px slate border, sharp corners. Monospaced text for data entry.
- **Intervention Support Panel:** A specialized vertical container using high-contrast "Evidence-Based Indicators" (e.g., "Conflict Point Detected" with a small Red LED icon).
- **Map Overlays:** Semi-transparent black backgrounds (85% opacity) with 1px Cobalt Blue borders for tooltips.
- **Severity Chips:** Rectangular tags with solid background colors (Red/Amber) and black or white text for maximum contrast.