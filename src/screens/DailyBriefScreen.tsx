import { useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { GeoMap } from "../components/map/GeoMap";
import { Icon } from "../components/Icon";
import { screenRoute } from "../lib/routes";
import { stitchScreens } from "../lib/stitchScreens";
import {
  type AIBaselineSummary,
  type BriefSummary,
  type ForecastHotspot,
  type HotspotRecord,
  type ModelValidationSummary,
  type OptimizedShiftPlan,
  type OptimizedShiftPlanArtifact,
  type StationSummary,
  useProcessedJson,
} from "../lib/data";
import { buildHotspotPoints, compactLocation } from "../lib/dashboard";

const screen = stitchScreens.find((item) => item.id === "daily-brief")!;

export function DailyBriefScreen() {
  const brief = useProcessedJson<BriefSummary>("/data/processed/brief_summary.json");
  const stations = useProcessedJson<StationSummary[]>("/data/processed/station_summary.json");
  const hotspotsState = useProcessedJson<HotspotRecord[]>("/data/processed/hotspots.json");
  const modelForecastState = useProcessedJson<ForecastHotspot[]>("/data/processed/model_hotspot_scores.json");
  const forecastState = useProcessedJson<ForecastHotspot[]>("/data/processed/next_shift_forecast.json");
  const modelValidationState = useProcessedJson<ModelValidationSummary>("/data/processed/model_validation_summary.json");
  const baselineState = useProcessedJson<AIBaselineSummary>("/data/processed/ai_baseline_summary.json");
  const optimizedPlanState = useProcessedJson<OptimizedShiftPlanArtifact>("/data/processed/optimized_shift_plan.json");
  const hotspots = brief.data?.top_hotspots ?? [];
  const allHotspots = hotspotsState.data ?? hotspots;
  const policyRows = brief.data?.top_policy_recommendations ?? [];
  const forecastRows = modelForecastState.data ?? forecastState.data ?? [];
  const hotspotIndex = new Map(allHotspots.map((hotspot) => [hotspot.cluster_id, hotspot]));
  const topForecastRows = forecastRows.slice(0, 5);
  const forecastLeader = topForecastRows[0] ?? null;
  const priorityStations = Array.from(new Set(forecastRows.map((row) => row.police_station)));
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(topForecastRows[0]?.cluster_id ?? hotspots[0]?.cluster_id ?? null);
  const selectedHotspot = allHotspots.find((item) => item.cluster_id === selectedClusterId) ?? allHotspots[0] ?? null;
  const forecastSelection = topForecastRows.find((item) => item.cluster_id === selectedClusterId) ?? forecastLeader;
  const forecastConfidenceMix = {
    high: topForecastRows.filter((row) => row.confidence === "high").length,
    medium: topForecastRows.filter((row) => row.confidence === "medium").length,
    low: topForecastRows.filter((row) => row.confidence === "low").length,
  };
  const forecastMapHotspots = topForecastRows
    .map((row) => allHotspots.find((item) => item.cluster_id === row.cluster_id))
    .filter((item): item is HotspotRecord => Boolean(item));
  const mapHotspots = Array.from(
    new Map(
      [...hotspots.slice(0, 5), ...forecastMapHotspots].map((item) => [item.cluster_id, item]),
    ).values(),
  );
  const topInterventionRows = topForecastRows
    .map((forecast) => {
      const hotspot = hotspotIndex.get(forecast.cluster_id);
      if (!hotspot) {
        return null;
      }
      return { forecast, hotspot };
    })
    .filter((row): row is { forecast: ForecastHotspot; hotspot: HotspotRecord } => Boolean(row));
  const reliefPlans = (optimizedPlanState.data?.strategies ?? [])
    .map((strategy) =>
      optimizedPlanState.data?.plans.find(
        (plan) =>
          plan.station_filter === "All Stations" &&
          plan.shift === "Morning" &&
          plan.strategy === strategy.id,
      ),
    )
    .filter((plan): plan is OptimizedShiftPlan => Boolean(plan));
  const balancedReliefPlan = reliefPlans.find((plan) => plan.strategy === "balanced") ?? reliefPlans[0] ?? null;
  const projectedReliefRows = reliefPlans.length
    ? reliefPlans.map((plan, index) => ({
        label: plan.strategy_label,
        value: plan.projected_relief,
        color: index === 0 ? "var(--lg-primary)" : index === 1 ? "var(--lg-secondary)" : "#ffb4aa",
        range: `${plan.projected_relief_range.low}% to ${plan.projected_relief_range.high}%`,
        confidence: plan.impact_confidence,
      }))
    : policyRows.slice(0, 3).map((row, index) => ({
        label:
          index === 0
            ? "CBD Sector Relief"
            : index === 1
              ? "Transit Hub Clearance"
              : "Managed Curb Relief",
        value: Math.min(48, Math.max(12, Math.round(row.impact_proxy_score / (index === 0 ? 2.15 : 3.1)))),
        color: index === 0 ? "var(--lg-primary)" : index === 1 ? "var(--lg-secondary)" : "#ffb4aa",
        range: null,
        confidence: null,
      }));

  return (
    <div className="lg-app" style={{ minHeight: "100vh", overflow: "hidden" }} data-screen-id={screen.id}>
      <AppHeader
        active="Reports"
        actions={
          <>
            <Link to={screenRoute("command-center")} className="lg-header-alert">
              Return To Ops
            </Link>
          </>
        }
      />

      <main
        style={{
          overflowY: "auto",
          background: "var(--lg-background)",
          padding: 24,
          display: "grid",
          gap: 16,
          alignContent: "start",
          minHeight: "calc(100vh - 68px)",
        }}
      >
        <section data-region="briefHeader" style={{ display: "grid", gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: "32px", fontWeight: 700, textTransform: "uppercase" }}>
            Daily Brief
          </h1>
          <p style={{ margin: 0, color: "var(--lg-text-muted)" }}>
            {brief.data?.headline ?? "Today's Priority Parking Pressure"}
          </p>
          {forecastLeader ? (
            <div className="lg-mono" style={{ fontSize: 12, color: "var(--lg-primary)" }}>
              Forecast window: {forecastLeader.forecast_service_date} {forecastLeader.forecast_shift} shift
            </div>
          ) : null}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 16 }}>
          <section
            data-region="headlineMetrics"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}
          >
            <MetricCard
              label="Forecasted Corridors"
              value={forecastRows.length.toLocaleString("en-IN")}
              accent="#ffb4aa"
              detail={`${topForecastRows.length || 5} top-ranked for briefing`}
            />
            <MetricCard
              label="Forecast Stations"
              value={String(priorityStations.length || 0)}
              accent="var(--lg-secondary)"
              detail={`${forecastLeader?.police_station ?? brief.data?.top_station ?? "Upparpet"} leading`}
            />
            <MetricCard
              label="Forecast Window"
              value={forecastLeader ? forecastLeader.forecast_shift : "--"}
              accent="var(--lg-primary)"
              detail={forecastLeader ? forecastLeader.forecast_service_date : "Awaiting forecast"}
            />
          </section>

          <section
            style={{
              background: "var(--lg-surface-container)",
              border: "1px solid var(--lg-outline-variant)",
              padding: 16,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700 }}>
              <Icon name="timeline" size={16} color="var(--lg-primary)" />
              Projected Relief Forecast
            </div>
            {projectedReliefRows.map((row) => (
              <div key={row.label}>
                <div
                  className="lg-mono"
                  style={{
                    fontSize: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: "var(--lg-text-muted)" }}>{row.label}</span>
                  <span style={{ color: row.color }}>{row.value}%</span>
                </div>
                <div style={{ width: "100%", height: 8, background: "var(--lg-surface-highest)" }}>
                  <div style={{ width: `${row.value}%`, height: "100%", background: row.color }} />
                </div>
                {row.range || row.confidence ? (
                  <div
                    className="lg-mono"
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "var(--lg-text-muted)",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <span>{row.range ?? "Heuristic relief estimate"}</span>
                    <span style={{ textTransform: "uppercase" }}>{row.confidence ? `${row.confidence} confidence` : "baseline"}</span>
                  </div>
                ) : null}
              </div>
            ))}
            <div
              className="lg-subtitle"
              style={{
                padding: 10,
                background: "var(--lg-surface-highest)",
                border: "1px solid var(--lg-outline-variant)",
              }}
            >
              {balancedReliefPlan
                ? balancedReliefPlan.confidence_note
                : "Relief projections are derived from immediate hotspot interventions and corridor-level policy controls."}
            </div>
          </section>
        </div>

        <section
          data-region="forecastStrip"
          style={{
            background: "var(--lg-surface-container)",
            border: "1px solid var(--lg-outline-variant)",
            padding: 16,
            display: "grid",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700 }}>
                <Icon name="analytics" size={16} color="var(--lg-primary)" />
                Next-Shift Forecast
              </div>
              <div className="lg-subtitle" style={{ maxWidth: 680 }}>
                Classifier-backed hotspot forecast using time-split evaluation, corridor recurrence, station pressure, and structural road-risk signals.
              </div>
            </div>
            {modelValidationState.data ?? baselineState.data ? (
              <div
                style={{
                  display: "grid",
                  gap: 6,
                  minWidth: 220,
                  padding: 12,
                  border: "1px solid var(--lg-outline-variant)",
                  background: "var(--lg-surface)",
                }}
              >
                <div className="lg-kicker" style={{ color: "var(--lg-primary)" }}>
                  {modelValidationState.data ? "Forecast Model" : "Baseline Model"}
                </div>
                <div className="lg-mono" style={{ fontSize: 12, color: "var(--lg-text-muted)" }}>
                  {modelValidationState.data
                    ? `${modelValidationState.data.test_rows?.toLocaleString("en-IN") ?? modelValidationState.data.validation_rows.toLocaleString("en-IN")} holdout rows`
                    : `${baselineState.data?.positive_next_shift_rows.toLocaleString("en-IN")} positive next-shift rows`}
                </div>
                <div className="lg-mono" style={{ fontSize: 12, color: "var(--lg-text-muted)" }}>
                  {modelValidationState.data
                    ? `${modelValidationState.data.primary_metric_name === "average_precision" ? "Avg Precision" : "Primary"} ${Math.round((modelValidationState.data.holdout_primary_metric_value ?? modelValidationState.data.primary_metric_value ?? 0) * 100)}% | threshold ${Math.round((modelValidationState.data.chosen_threshold ?? 0.55) * 100)}`
                    : `Precision@55 ${Math.round((baselineState.data?.precision_at_risk_55 ?? 0) * 100)}% | Recall ${Math.round((baselineState.data?.recall_at_risk_55 ?? 0) * 100)}%`}
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
            <ForecastMetricCard
              label="Highest Forecast Risk"
              value={forecastLeader ? `${forecastLeader.predicted_risk_score}` : "--"}
              detail={forecastLeader ? compactLocation(forecastLeader.location) : "No forecast"}
              accent="#ffb4aa"
            />
            <ForecastMetricCard
              label="Next-Shift Watchlist"
              value={String(topForecastRows.length)}
              detail={forecastLeader ? `${forecastLeader.forecast_shift} shift corridors` : "Awaiting forecast"}
              accent="var(--lg-secondary)"
            />
            <ForecastMetricCard
              label="High Confidence"
              value={String(forecastConfidenceMix.high)}
              detail="forecasted corridors"
              accent="var(--lg-primary)"
            />
            <ForecastMetricCard
              label="Predicted Violations"
              value={String(topForecastRows.reduce((sum, row) => sum + (row.predicted_next_shift_records ?? 0), 0))}
              detail="top forecast set"
              accent="#7bc4ff"
            />
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: 16 }}>
          <section
            data-region="mapInset"
            style={{
              background: "var(--lg-surface)",
              border: "1px solid var(--lg-outline-variant)",
              padding: 16,
              height: 640,
              display: "grid",
              gridTemplateRows: "auto minmax(0, 1fr)",
              gap: 12,
              minHeight: 0,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Priority Corridors Map</div>
              <div style={{ display: "flex", gap: 8 }}>
                <SeverityPill label="Critical" bg="#93000a" color="#ffdad6" />
                <SeverityPill label="Monitor" bg="#ffb211" color="#432c00" />
              </div>
            </div>
            <div style={{ minHeight: 0, height: "100%" }}>
              <GeoMap
                points={buildHotspotPoints(mapHotspots, 24)}
                selectedId={selectedHotspot?.cluster_id ?? null}
                onSelect={setSelectedClusterId}
                title={selectedHotspot ? `${compactLocation(selectedHotspot.location)} selected` : "Priority corridors"}
                subtitle="Use this map during the brief to zoom into the corridor you are discussing."
                height="100%"
              />
            </div>
          </section>

          <section data-region="topHotspots" style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <section
              style={{
                background: "var(--lg-surface-container)",
                border: "1px solid var(--lg-outline-variant)",
                padding: 14,
                display: "grid",
                gridTemplateRows: "auto minmax(0, 1fr) auto",
                height: 640,
                minHeight: 0,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Top Forecast Interventions</div>
                {forecastLeader ? (
                  <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
                    {forecastLeader.forecast_shift}
                  </div>
                ) : null}
              </div>
              <div style={{ display: "grid", gap: 10, overflowY: "auto", minHeight: 0, paddingRight: 4 }}>
                {topForecastRows.length ? (
                  topForecastRows.map((row, index) => (
                    <button
                      key={`${row.cluster_id}-${row.forecast_shift}`}
                      onClick={() => setSelectedClusterId(row.cluster_id)}
                      style={{
                        background: forecastSelection?.cluster_id === row.cluster_id ? "rgba(46,91,255,0.1)" : "var(--lg-surface)",
                        border: forecastSelection?.cluster_id === row.cluster_id ? "1px solid var(--lg-primary)" : "1px solid var(--lg-outline-variant)",
                        padding: 12,
                        display: "grid",
                        gap: 6,
                        textAlign: "left",
                        color: "var(--lg-text)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="lg-kicker" style={{ color: index === 0 ? "#ffb4aa" : "var(--lg-primary)" }}>
                            Rank {String(index + 1).padStart(2, "0")}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2, marginTop: 4 }}>
                            {compactLocation(row.location)}
                          </div>
                          <div className="lg-subtitle" style={{ marginTop: 4 }}>
                            {row.police_station} | risk {row.predicted_risk_score}
                          </div>
                        </div>
                        <ForecastConfidencePill confidence={row.confidence} />
                      </div>
                      <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
                        {row.predicted_next_shift_records ?? 0} predicted next-shift violations{row.predicted_hotspot_probability !== undefined ? ` | ${Math.round(row.predicted_hotspot_probability * 100)}% hotspot likelihood` : ""}
                      </div>
                      <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-primary)" }}>
                        {row.top_factors.join(" | ")}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="lg-subtitle">Forecast artifact not available.</div>
                )}
              </div>
              {selectedHotspot ? (
                <Link
                  to={`${screenRoute("hotspot-detail")}?cluster=${encodeURIComponent(selectedHotspot.cluster_id)}`}
                  style={{
                    marginTop: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    background: "var(--lg-primary-container)",
                    color: "#f5f7ff",
                    padding: "12px 14px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Open Selected Corridor
                </Link>
              ) : null}
            </section>
          </section>
        </div>

        <section
          data-region="policySummary"
          style={{
            background: "var(--lg-surface-container)",
            border: "1px solid var(--lg-outline-variant)",
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700 }}>
            <Icon name="policy" size={16} color="var(--lg-text-muted)" />
            Strategic Policy Summary
          </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            {(topInterventionRows.length ? topInterventionRows : []).slice(0, 3).map(({ hotspot }, index) => (
              <div
                key={hotspot.cluster_id}
                style={{
                  background: "var(--lg-surface)",
                  border: "1px solid var(--lg-outline-variant)",
                  padding: 14,
                  display: "grid",
                  gap: 8,
                }}
                >
                  <div className="lg-kicker" style={{ color: "var(--lg-primary)" }}>
                    {index === 0 ? "Directive Alpha" : index === 1 ? "Resource Allocation" : "Public Comms"}
                  </div>
                  <div className="lg-subtitle">
                  {(hotspot.recommendations.short_term[0] ??
                    hotspot.recommendations.immediate[0] ??
                    hotspot.recommendations.medium_term[0] ??
                    "").replace(/^./, (match) => match.toUpperCase())}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard(props: { label: string; value: string; accent: string; detail: string }) {
  return (
    <div
      style={{
        background: "var(--lg-surface)",
        border: "1px solid var(--lg-outline-variant)",
        borderTop: `2px solid ${props.accent}`,
        padding: 16,
        display: "grid",
        gap: 8,
      }}
    >
      <div className="lg-kicker">{props.label}</div>
      <div style={{ fontSize: 42, lineHeight: "42px", fontWeight: 800, color: props.accent }}>{props.value}</div>
      <div className="lg-mono" style={{ fontSize: 12, color: "var(--lg-text-muted)" }}>
        {props.detail}
      </div>
    </div>
  );
}

function ForecastMetricCard(props: { label: string; value: string; detail: string; accent: string }) {
  return (
    <div
      style={{
        background: "var(--lg-surface)",
        border: "1px solid var(--lg-outline-variant)",
        padding: 14,
        display: "grid",
        gap: 6,
      }}
    >
      <div className="lg-kicker">{props.label}</div>
      <div style={{ fontSize: 28, lineHeight: "30px", fontWeight: 800, color: props.accent }}>{props.value}</div>
      <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
        {props.detail}
      </div>
    </div>
  );
}

function ForecastConfidencePill(props: { confidence: ForecastHotspot["confidence"] }) {
  const palette =
    props.confidence === "high"
      ? { bg: "rgba(46,91,255,0.16)", border: "var(--lg-primary)", color: "#d7defe" }
      : props.confidence === "medium"
        ? { bg: "rgba(255,178,17,0.16)", border: "var(--lg-secondary)", color: "#ffd79b" }
        : { bg: "rgba(255,255,255,0.04)", border: "var(--lg-outline-variant)", color: "var(--lg-text-muted)" };

  return (
    <span
      className="lg-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 7px",
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        color: palette.color,
        fontSize: 10,
        textTransform: "uppercase",
      }}
    >
      {props.confidence}
    </span>
  );
}

function SeverityPill(props: { label: string; bg: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: props.bg,
        color: props.color,
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {props.label}
    </span>
  );
}
