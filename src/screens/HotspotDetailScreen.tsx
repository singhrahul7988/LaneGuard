import type { ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { GeoMap } from "../components/map/GeoMap";
import { Icon } from "../components/Icon";
import {
  type ForecastHotspot,
  type HotspotRecord,
  type ModelExplanations,
  type ParkingRecord,
  useProcessedJson,
} from "../lib/data";
import {
  buildClusterBreakdown,
  buildNearbyHotspotPoints,
  buildRecordAnalytics,
  compactLocation,
  formatHourLabel,
} from "../lib/dashboard";
import { screenRoute } from "../lib/routes";
import { stitchScreens } from "../lib/stitchScreens";

const screen = stitchScreens.find((item) => item.id === "hotspot-detail")!;

export function HotspotDetailScreen() {
  const hotspotsState = useProcessedJson<HotspotRecord[]>("/data/processed/hotspots.json");
  const recordsState = useProcessedJson<ParkingRecord[]>("/data/processed/parking_records.json");
  const modelForecastState = useProcessedJson<ForecastHotspot[]>("/data/processed/model_hotspot_scores.json");
  const modelExplanationsState = useProcessedJson<ModelExplanations>("/data/processed/model_explanations.json");
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const hotspots = hotspotsState.data ?? [];
  const records = recordsState.data ?? [];
  const forecastRows = modelForecastState.data ?? [];
  const analytics = records.length ? buildRecordAnalytics(records) : null;
  const clusterId = searchParams.get("cluster");
  const routedHotspot = (location.state as { hotspot?: HotspotRecord } | null)?.hotspot ?? null;
  const hotspot =
    hotspots.find((item) => item.cluster_id === clusterId) ??
    routedHotspot ??
    hotspots[0] ??
    null;
  const breakdown = buildClusterBreakdown(hotspot, analytics);
  const forecastRow = hotspot ? forecastRows.find((item) => item.cluster_id === hotspot.cluster_id) ?? null : null;
  const nearbyPoints =
    hotspots.length > 0
      ? buildNearbyHotspotPoints(hotspot, hotspots, 18)
      : hotspot
        ? [
            {
              id: hotspot.cluster_id,
              label: compactLocation(hotspot.location),
              latitude: hotspot.latitude,
              longitude: hotspot.longitude,
              severity: hotspot.severity_band,
              weight: hotspot.priority_score,
              meta: `${hotspot.police_station} | ${Math.round(hotspot.impact_proxy_score)} impact`,
            },
          ]
        : [];

  return (
    <div className="lg-app" style={{ height: "100vh", overflow: "hidden" }} data-screen-id={screen.id}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 580px",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <section
          data-region="contextCanvas"
          style={{
            position: "relative",
            background: "#0b0f15",
            height: "100vh",
            overflow: "hidden",
          }}
        >
          <GeoMap
            points={nearbyPoints}
            selectedId={hotspot?.cluster_id ?? null}
            title={hotspot ? `${hotspot.police_station} pressure field` : "Hotspot context"}
            subtitle="This map is now zoomable and centered on the selected hotspot's nearby station footprint."
            height="100%"
          />
        </section>
        <aside
          style={{
            background: "var(--lg-surface-container)",
            borderLeft: "1px solid var(--lg-outline-variant)",
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            overflow: "hidden",
            boxShadow: "-10px 0 28px rgba(0,0,0,0.4)",
          }}
        >
          <header
            data-region="drawerHeader"
            style={{
              padding: 24,
              borderBottom: "1px solid var(--lg-outline-variant)",
              background: "var(--lg-surface-high)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 30,
                  lineHeight: "36px",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "-0.02em",
                }}
              >
                {hotspot ? compactLocation(hotspot.location) : "Hotspot"}
              </h1>
              <div className="lg-subtitle" style={{ marginTop: 10, fontSize: 14 }}>
                Hotspot Detail | <span style={{ color: "var(--lg-text)", fontWeight: 700 }}>{hotspot?.police_station ?? "--"}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div className="lg-kicker" style={{ color: "#ffb4aa", textAlign: "right" }}>
                  Priority Score
                </div>
                <div
                  className="lg-mono"
                  style={{
                    background: "#93000a",
                    color: "#ffdad6",
                    border: "1px solid #d71a18",
                    padding: "10px 14px",
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  {hotspot ? `${Math.round(hotspot.priority_score)}/100` : "--"}
                </div>
              </div>
              <Link to={screenRoute("command-center")} style={{ color: "var(--lg-text-muted)", display: "inline-flex" }}>
                <Icon name="close" size={24} color="var(--lg-text-muted)" />
              </Link>
            </div>
          </header>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 24, display: "grid", gap: 24 }}>
            <section data-region="reasonChips" style={{ display: "grid", gap: 16 }}>
              <div className="lg-kicker">Detection Factors</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(hotspot?.reason_chips ?? []).map((label) => (
                  <div
                    key={label}
                    className="lg-mono"
                    style={{
                      border: "1px solid var(--lg-outline-variant)",
                      background: "var(--lg-surface-highest)",
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      textTransform: "uppercase",
                      fontSize: 13,
                    }}
                  >
                    <Icon name={chipIcon(label)} size={16} color={chipColor(label)} />
                    {label}
                  </div>
                ))}
              </div>
            </section>

            <section
              data-region="aiForecast"
              style={{
                display: "grid",
                gap: 14,
                padding: 18,
                border: "1px solid var(--lg-outline-variant)",
                background: "var(--lg-surface)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div className="lg-kicker" style={{ color: "var(--lg-primary)" }}>
                    AI Forecast Readout
                  </div>
                  <div className="lg-subtitle" style={{ marginBottom: 0, maxWidth: 420 }}>
                    {forecastRow
                      ? `Predicted for ${forecastRow.forecast_service_date} ${forecastRow.forecast_shift} shift using ${forecastRow.model_name ?? "the current forecast model"}.`
                      : "No next-shift forecast is available for this hotspot in the current model output."}
                  </div>
                </div>
                {forecastRow ? <ConfidenceBadge confidence={forecastRow.confidence} /> : null}
              </div>

              {forecastRow ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    <ForecastStat
                      label="Risk Score"
                      value={`${forecastRow.predicted_risk_score}/100`}
                      accent="#ffb4aa"
                    />
                    <ForecastStat
                      label="Hotspot Likelihood"
                      value={`${Math.round((forecastRow.predicted_hotspot_probability ?? 0) * 100)}%`}
                      accent="var(--lg-primary)"
                    />
                    <ForecastStat
                      label="Expected Records"
                      value={String(forecastRow.predicted_next_shift_records ?? 0)}
                      accent="var(--lg-secondary)"
                    />
                    <ForecastStat
                      label="Pattern Support"
                      value={forecastRow.support_count?.toLocaleString("en-IN") ?? "--"}
                      accent="var(--lg-text)"
                    />
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <div className="lg-kicker">Top Drivers</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {forecastRow.top_factors.map((factor) => (
                        <div
                          key={factor}
                          className="lg-mono"
                          style={{
                            padding: "10px 12px",
                            background: "rgba(46,91,255,0.1)",
                            border: "1px solid rgba(46,91,255,0.3)",
                            color: "var(--lg-text)",
                            fontSize: 12,
                            textTransform: "uppercase",
                          }}
                        >
                          {formatModelFactor(factor)}
                        </div>
                      ))}
                    </div>
                  </div>

                  {modelExplanationsState.data ? (
                    <div
                      className="lg-subtitle"
                      style={{
                        marginBottom: 0,
                        padding: 12,
                        border: "1px solid var(--lg-outline-variant)",
                        background: "var(--lg-surface-highest)",
                      }}
                    >
                      {modelExplanationsState.data.description}
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>

            <section data-region="charts" style={{ display: "grid", gap: 20 }}>
              <ChartPanel title="Violation Frequency (24H)" rightLabel={`${hotspot?.record_count.toLocaleString("en-IN") ?? 0} records`}>
                <HourlyBars values={breakdown.hourlyCounts} />
              </ChartPanel>
              <ChartPanel title="Violation Composition">
                <CompositionRows rows={breakdown.labelRows} />
              </ChartPanel>
            </section>

            <section data-region="recommendations" style={{ display: "grid", gap: 16 }}>
              <div className="lg-kicker">System Recommendation</div>
              <div
                style={{
                  border: "1px solid var(--lg-primary)",
                  borderLeft: "4px solid var(--lg-primary)",
                  background: "rgba(46,91,255,0.12)",
                  padding: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon name="target" size={16} color="var(--lg-primary)" />
                    <div
                      style={{
                        color: "var(--lg-primary)",
                        fontSize: 18,
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {hotspot ? titleCase(hotspot.recommendations.immediate[0] ?? "Deploy enforcement") : "--"}
                    </div>
                  </div>
                  <Link
                    to={`${screenRoute("enforcement-planner")}?cluster=${encodeURIComponent(hotspot?.cluster_id ?? "")}&station=${encodeURIComponent(hotspot?.police_station ?? "")}`}
                    style={{
                      color: "var(--lg-primary)",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Open Planner
                  </Link>
                </div>
                <div className="lg-subtitle" style={{ marginBottom: 0 }}>
                  {hotspot
                    ? `Priority hotspot at ${compactLocation(hotspot.location)} with ${hotspot.repeat_days} recurring days and ${Math.round(hotspot.impact_proxy_score)} impact score.`
                    : "No hotspot selected."}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {(hotspot ? buildRecommendationRows(hotspot) : []).map((item) => (
                  <RecommendationRow key={item.title} {...item} />
                ))}
              </div>
            </section>

            <section className="lg-panel" style={{ padding: 18 }}>
              <div className="lg-kicker">Observed Weekday Load</div>
              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                {breakdown.weekdayRows.slice(0, 5).map((row) => (
                  <div key={row.label}>
                    <div
                      className="lg-mono"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                        fontSize: 12,
                      }}
                    >
                      <span>{row.label}</span>
                      <span>{row.count.toLocaleString("en-IN")}</span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: "var(--lg-surface-highest)" }}>
                      <div style={{ width: `${Math.min(100, row.count / 6)}%`, height: "100%", background: "var(--lg-primary)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <footer
            style={{
              padding: 24,
              borderTop: "1px solid var(--lg-outline-variant)",
              background: "var(--lg-surface-highest)",
            }}
          >
            <Link
              to={`${screenRoute("enforcement-planner")}?cluster=${encodeURIComponent(hotspot?.cluster_id ?? "")}&station=${encodeURIComponent(hotspot?.police_station ?? "")}`}
              style={{
                width: "100%",
                minHeight: 72,
                background: "#2e5bff",
                color: "#efefff",
                border: "1px solid var(--lg-primary)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
                fontSize: 18,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              <Icon name="add_task" size={16} color="#efefff" />
              Add To Shift Plan
            </Link>
          </footer>
        </aside>
      </div>
    </div>
  );
}

function buildRecommendationRows(hotspot: HotspotRecord) {
  return [
    ...hotspot.recommendations.immediate.map((item) => ({
      icon: "directions_car",
      iconColor: "#ffb4aa",
      iconBg: "rgba(255,180,171,0.12)",
      title: `Immediate: ${titleCase(item)}`,
      rationale: `Rationale: ${hotspot.reason_chips.join(", ").toLowerCase()}.`,
    })),
    ...hotspot.recommendations.short_term.map((item) => ({
      icon: "fence",
      iconColor: "#ffd79b",
      iconBg: "rgba(255,215,155,0.12)",
      title: `Short-term: ${titleCase(item)}`,
      rationale: "Rationale: repeat hotspot patterns justify corridor-level control changes.",
    })),
    ...hotspot.recommendations.medium_term.map((item) => ({
      icon: "policy",
      iconColor: "var(--lg-text)",
      iconBg: "rgba(142,144,162,0.18)",
      title: `Medium-term: ${titleCase(item)}`,
      rationale: "Rationale: structural parking demand appears persistent over multiple days.",
    })),
  ].slice(0, 4);
}

function chipColor(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("recurring")) return "#ffb4aa";
  if (lower.includes("main-road")) return "#ffd79b";
  if (lower.includes("peak")) return "#ffd79b";
  return "var(--lg-primary)";
}

function chipIcon(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("recurring")) return "warning";
  if (lower.includes("main-road")) return "local_parking";
  if (lower.includes("peak")) return "groups";
  return "hub";
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
}

function ChartPanel(props: { title: string; rightLabel?: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--lg-surface)",
        border: "1px solid var(--lg-outline-variant)",
        padding: 20,
        display: "grid",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="lg-kicker" style={{ fontSize: 13, color: "var(--lg-text)" }}>
          {props.title}
        </div>
        {props.rightLabel ? (
          <div className="lg-mono" style={{ color: "var(--lg-primary)", fontSize: 14 }}>
            {props.rightLabel}
          </div>
        ) : null}
      </div>
      {props.children}
    </div>
  );
}

function HourlyBars(props: { values: number[] }) {
  const max = Math.max(1, ...props.values);

  return (
    <div>
      <div
        style={{
          height: 190,
          borderLeft: "1px solid var(--lg-outline-variant)",
          borderBottom: "1px solid var(--lg-outline-variant)",
          position: "relative",
          padding: "14px 0 0 14px",
          display: "flex",
          alignItems: "flex-end",
          gap: 4,
        }}
      >
        {props.values.map((value, index) => {
          const ratio = value / max;
          const color = ratio > 0.72 ? "#ffb4aa" : ratio > 0.45 ? "#ffd79b" : "rgba(67,70,86,0.82)";
          return (
            <div key={index} style={{ width: 14, display: "grid", gap: 6, justifyItems: "center" }}>
              <div style={{ width: "100%", height: `${Math.max(8, ratio * 150)}px`, background: color }} />
            </div>
          );
        })}
      </div>
      <div
        className="lg-mono"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          marginTop: 10,
          color: "var(--lg-text)",
          fontSize: 11,
          gap: 8,
        }}
      >
        {[0, 4, 8, 12, 16, 20].map((hour) => (
          <span key={hour}>{formatHourLabel(hour)}</span>
        ))}
      </div>
    </div>
  );
}

function CompositionRows(props: { rows: Array<{ label: string; count: number; share: number }> }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {props.rows.map((item) => (
        <div key={item.label}>
          <div
            className="lg-mono"
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
              fontSize: 15,
              textTransform: "uppercase",
            }}
          >
            <span>{item.label}</span>
            <span style={{ color: item.share >= 50 ? "#ffb4aa" : item.share >= 25 ? "#ffd79b" : "#b8c3ff", fontWeight: 700 }}>
              {item.share}% | {item.count.toLocaleString("en-IN")}
            </span>
          </div>
          <div style={{ width: "100%", height: 12, background: "var(--lg-surface-highest)" }}>
            <div
              style={{
                width: `${item.share}%`,
                height: "100%",
                background: item.share >= 50 ? "#ffb4aa" : item.share >= 25 ? "#ffd79b" : "#b8c3ff",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationRow(props: {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  rationale: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: 14,
        border: "1px solid var(--lg-outline-variant)",
        background: "var(--lg-surface)",
      }}
    >
      <div
        style={{
          background: props.iconBg,
          padding: 10,
          alignSelf: "flex-start",
        }}
      >
        <Icon name={props.icon} size={16} color={props.iconColor} />
      </div>
      <div>
        <div className="lg-mono" style={{ textTransform: "uppercase", marginBottom: 6, color: "var(--lg-text)" }}>
          {props.title}
        </div>
        <div className="lg-subtitle">{props.rationale}</div>
      </div>
    </div>
  );
}

function ForecastStat(props: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: 12,
        border: "1px solid var(--lg-outline-variant)",
        background: "var(--lg-surface-highest)",
      }}
    >
      <div className="lg-kicker">{props.label}</div>
      <div style={{ fontSize: 26, lineHeight: "28px", fontWeight: 800, color: props.accent }}>{props.value}</div>
    </div>
  );
}

function ConfidenceBadge(props: { confidence: ForecastHotspot["confidence"] }) {
  const tone =
    props.confidence === "high"
      ? { border: "rgba(46,91,255,0.45)", background: "rgba(46,91,255,0.12)", color: "var(--lg-primary)" }
      : props.confidence === "medium"
        ? { border: "rgba(255,178,17,0.45)", background: "rgba(255,178,17,0.12)", color: "var(--lg-secondary)" }
        : { border: "rgba(255,180,170,0.45)", background: "rgba(255,180,170,0.12)", color: "#ffb4aa" };

  return (
    <div
      className="lg-mono"
      style={{
        padding: "8px 10px",
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        textTransform: "uppercase",
        fontSize: 12,
      }}
    >
      {props.confidence} confidence
    </div>
  );
}

function formatModelFactor(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

