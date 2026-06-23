import { useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader, buildCriticalMapRoute } from "../components/AppHeader";
import { GeoMap } from "../components/map/GeoMap";
import { Icon } from "../components/Icon";
import { stitchScreens } from "../lib/stitchScreens";
import {
  type ForecastHotspot,
  type HotspotRecord,
  type ModelBenchmarkSummary,
  type ParkingRecord,
  type StationSummary,
  type TimeSummary,
  useProcessedJson,
} from "../lib/data";
import {
  buildRecordAnalytics,
  buildStationHourlyMatrix,
  buildStationMapPoints,
  downloadTextFile,
  stationRowsToCsv,
} from "../lib/dashboard";

const screen = stitchScreens.find((item) => item.id === "station-analytics")!;

type SortKey = "station" | "predicted_load" | "avg_risk" | "confidence";

export function StationAnalyticsScreen() {
  const stations = useProcessedJson<StationSummary[]>("/data/processed/station_summary.json");
  const timeSummary = useProcessedJson<TimeSummary>("/data/processed/time_summary.json");
  const recordsState = useProcessedJson<ParkingRecord[]>("/data/processed/parking_records.json");
  const hotspotsState = useProcessedJson<HotspotRecord[]>("/data/processed/hotspots.json");
  const modelForecastState = useProcessedJson<ForecastHotspot[]>("/data/processed/model_hotspot_scores.json");
  const forecastState = useProcessedJson<ForecastHotspot[]>("/data/processed/next_shift_forecast.json");
  const benchmarkState = useProcessedJson<ModelBenchmarkSummary>("/data/processed/heuristic_vs_model_benchmark.json");
  const [sortKey, setSortKey] = useState<SortKey>("predicted_load");
  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  const analytics = recordsState.data?.length ? buildRecordAnalytics(recordsState.data) : null;
  const forecastRows = modelForecastState.data ?? forecastState.data ?? [];
  const forecastWindow = forecastRows[0] ? `${forecastRows[0].forecast_service_date} ${forecastRows[0].forecast_shift}` : "Current model window";
  const stationRows = buildStationHourlyMatrix(stations.data ?? [], analytics).map((station) => {
    const stationForecasts = forecastRows.filter((row) => row.police_station === station.station);
    const forecastCorridors = stationForecasts.length;
    const predictedLoad = stationForecasts.reduce((sum, row) => sum + (row.predicted_next_shift_records ?? 0), 0);
    const avgRisk = forecastCorridors
      ? Number((stationForecasts.reduce((sum, row) => sum + row.predicted_risk_score, 0) / forecastCorridors).toFixed(1))
      : 0;
    const highConfidenceShare = forecastCorridors
      ? Math.round((stationForecasts.filter((row) => row.confidence === "high").length / forecastCorridors) * 100)
      : 0;
    return {
      ...station,
      forecastCorridors,
      predictedLoad,
      avgRisk,
      highConfidenceShare,
      status: avgRisk >= 85 ? "Critical" : avgRisk >= 65 ? "Elevated" : "Stable",
    };
  });
  const sortedRows = [...stationRows].sort((left, right) => compareRows(left, right, sortKey));
  const visibleRows = sortedRows.slice(0, 10);
  const totalForecastCorridors = forecastRows.length;
  const avgForecastRisk = forecastRows.length
    ? (forecastRows.reduce((sum, row) => sum + row.predicted_risk_score, 0) / forecastRows.length).toFixed(1)
    : "0.0";
  const highConfidenceRate = forecastRows.length
    ? Math.round((forecastRows.filter((row) => row.confidence === "high").length / forecastRows.length) * 100)
    : 0;
  const focusedStation = visibleRows.find((row) => row.station === selectedStation) ?? visibleRows[0] ?? null;
  const barChartRows = visibleRows.slice(0, 6);
  const chartMaxLoad = Math.max(1, ...barChartRows.map((row) => row.predictedLoad));
  const trendRows = visibleRows.slice(0, 8);
  const firstMappableStation =
    visibleRows.find((row) => buildForecastStationMapPoints(row.station, hotspotsState.data ?? [], forecastRows, 16).length > 0) ?? null;
  const mapStation = focusedStation && buildForecastStationMapPoints(focusedStation.station, hotspotsState.data ?? [], forecastRows, 16).length
    ? focusedStation
    : firstMappableStation;
  const mapPoints = buildForecastStationMapPoints(mapStation?.station ?? "", hotspotsState.data ?? [], forecastRows, 16);
  const mapStationRows = mapStation
    ? [mapStation, ...visibleRows.filter((row) => row.station !== mapStation.station).slice(0, 2)]
    : visibleRows.slice(0, 3);

  function exportCsv() {
    downloadTextFile(
      "laneguard-station-analytics.csv",
      stationRowsToCsv(
        visibleRows.map((row) => ({
          ...row,
          impact: row.avgRisk,
          response: row.highConfidenceShare,
        })),
      ),
    );
  }

  return (
    <div className="lg-app" style={{ minHeight: "100vh", overflow: "hidden" }} data-screen-id={screen.id}>
      <AppHeader
        active="Analytics"
        actions={
          <>
            <Link to={buildCriticalMapRoute(focusedStation?.station)} className="lg-header-alert">
              Emergency Alert
            </Link>
          </>
        }
      />

      <main
        style={{
          padding: 24,
          overflowY: "auto",
          display: "grid",
          gap: 16,
          alignContent: "start",
          minHeight: "calc(100vh - 68px)",
        }}
      >
        <section style={{ display: "grid", gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: "32px", fontWeight: 700, textTransform: "uppercase" }}>
            Forecast Performance and Station Pressure
          </h1>
          <div className="lg-mono" style={{ fontSize: 12, color: "var(--lg-text-muted)" }}>
            Analysis scope: Bengaluru traffic stations | Forecast window: {forecastWindow}
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <KpiCard
            label="Forecasted Corridors"
            value={totalForecastCorridors.toLocaleString("en-IN")}
            accent="var(--lg-primary)"
            note="Current next-shift scoring set"
          />
          <KpiCard
            label="Avg Forecast Risk"
            value={`${avgForecastRisk}/100`}
            accent="var(--lg-secondary)"
            note="Mean corridor risk across the forecast window"
          />
          <KpiCard
            label="High Confidence Share"
            value={`${highConfidenceRate}%`}
            accent="var(--lg-text)"
            note="Forecast rows marked high confidence"
          />
        </div>

        {benchmarkState.data ? (
          <section
            style={{
              background: "var(--lg-surface-container)",
              border: "1px solid var(--lg-outline-variant)",
              padding: 16,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div className="lg-kicker" style={{ color: "var(--lg-primary)" }}>
                  AI Benchmark Check
                </div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Model vs Heuristic Baseline</div>
                <div className="lg-subtitle" style={{ marginBottom: 0, maxWidth: 760 }}>
                  {benchmarkState.data.summary_note}
                </div>
              </div>
              <div className="lg-mono" style={{ fontSize: 12, color: "var(--lg-text-muted)", textAlign: "right" }}>
                {(benchmarkState.data.test_rows ?? benchmarkState.data.validation_rows).toLocaleString("en-IN")} holdout rows
                <br />
                {formatValidationWindow(
                  benchmarkState.data.test_start_date ?? benchmarkState.data.validation_start_date,
                  benchmarkState.data.test_end_date ?? benchmarkState.data.validation_end_date,
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {benchmarkState.data.metrics.map((metric) => (
                <BenchmarkMetricCard key={metric.key} metric={metric} />
              ))}
            </div>
          </section>
        ) : null}

        <section
          data-region="stationTable"
          style={{
            background: "var(--lg-surface-lowest)",
            border: "1px solid var(--lg-outline-variant)",
            display: "grid",
            gridTemplateRows: "auto minmax(0, 1fr)",
            minHeight: 0,
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--lg-outline-variant)",
              background: "var(--lg-surface-container)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div className="lg-kicker" style={{ color: "var(--lg-text)" }}>
              Station Metrics Comparison
            </div>
            <button
              onClick={exportCsv}
              className="lg-mono"
              style={{
                border: "none",
                background: "transparent",
                color: "var(--lg-primary)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Export CSV
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--lg-surface)", borderBottom: "1px solid var(--lg-outline-variant)" }}>
                <tr>
                  <SortableHeader label="Station" active={sortKey === "station"} onClick={() => setSortKey("station")} />
                  <SortableHeader
                    label="Pred. Load"
                    active={sortKey === "predicted_load"}
                    align="right"
                    onClick={() => setSortKey("predicted_load")}
                  />
                  <SortableHeader
                    label="Avg Risk"
                    active={sortKey === "avg_risk"}
                    align="right"
                    onClick={() => setSortKey("avg_risk")}
                  />
                  <SortableHeader
                    label="Confidence"
                    active={sortKey === "confidence"}
                    align="right"
                    onClick={() => setSortKey("confidence")}
                  />
                  <th style={tableHeadStyle("center")}>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr
                    key={row.station}
                    style={{ background: index % 2 === 0 ? "var(--lg-surface-lowest)" : "var(--lg-surface)" }}
                  >
                    <td style={tableCellStyle()}>
                      <button
                        onClick={() => setSelectedStation(row.station)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--lg-text)",
                          padding: 0,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{row.station}</div>
                        <div className="lg-subtitle" style={{ marginTop: 4 }}>
                          {row.forecastCorridors} forecasted corridors
                        </div>
                      </button>
                    </td>
                    <td style={tableCellStyle("right")}>{row.predictedLoad.toLocaleString("en-IN")}</td>
                    <td
                      style={tableCellStyle(
                        "right",
                        row.avgRisk >= 85 ? "#ffb4aa" : row.avgRisk >= 65 ? "var(--lg-secondary)" : "var(--lg-text)",
                      )}
                    >
                      {row.avgRisk.toFixed(1)}
                    </td>
                    <td style={tableCellStyle("right")}>{row.highConfidenceShare}%</td>
                    <td style={tableCellStyle("center")}>
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, alignItems: "stretch" }}>
          <div style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
            <section
              data-region="barChart"
              style={{
                background: "var(--lg-surface-container)",
                border: "1px solid var(--lg-outline-variant)",
                padding: 16,
                display: "grid",
                gap: 12,
                overflow: "hidden",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>Predicted Load by Station</div>
              <div
                style={{
                  height: 248,
                  display: "flex",
                  alignItems: "end",
                  gap: 12,
                  borderLeft: "1px solid var(--lg-outline-variant)",
                  borderBottom: "1px solid var(--lg-outline-variant)",
                  padding: "12px 0 0 12px",
                  overflow: "hidden",
                }}
              >
                {barChartRows.map((row, index) => {
                  const ratio = row.predictedLoad / chartMaxLoad;
                  const barHeight = Math.max(28, Math.round(ratio * 200));
                  const selected = row.station === focusedStation?.station || row.station === mapStation?.station;
                  return (
                    <button
                      key={row.station}
                      onClick={() => setSelectedStation(row.station)}
                      style={{
                        flex: 1,
                        display: "grid",
                        gap: 8,
                        justifyItems: "center",
                        border: "none",
                        background: "transparent",
                        color: "var(--lg-text)",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          maxHeight: 200,
                          height: barHeight,
                          background: selected ? "#ffb4aa" : index < 2 ? "var(--lg-secondary)" : "var(--lg-primary)",
                          outline: selected ? "2px solid rgba(255,180,170,0.45)" : "none",
                          outlineOffset: 2,
                          alignSelf: "end",
                        }}
                      />
                      <div
                        className="lg-mono"
                        style={{
                          fontSize: 10,
                          textAlign: "center",
                          color: selected ? "var(--lg-text)" : "var(--lg-text-muted)",
                        }}
                      >
                        {shortStation(row.station)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section
              data-region="mapSnippets"
              style={{
                background: "var(--lg-surface-container)",
                border: "1px solid var(--lg-outline-variant)",
                padding: 16,
                display: "grid",
                gap: 12,
                overflow: "hidden",
                alignContent: "start",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>Forecast Map Snippets</div>
              {mapStation ? (
                <GeoMap
                  points={mapPoints}
                  title={mapStation.station}
                  subtitle={`${mapStation.forecastCorridors} forecasted corridors in next-shift window`}
                  compact
                  height={340}
                />
              ) : null}
              <div style={{ display: "grid", gap: 12 }}>
                {mapStationRows.map((row) => (
                  <button
                    key={row.station}
                    onClick={() => setSelectedStation(row.station)}
                    style={{
                      display: "grid",
                      gap: 6,
                      border: row.station === mapStation?.station ? "1px solid var(--lg-primary)" : "1px solid var(--lg-outline-variant)",
                      background: row.station === mapStation?.station ? "rgba(46,91,255,0.08)" : "var(--lg-surface)",
                      padding: 12,
                      textAlign: "left",
                      color: "var(--lg-text)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{row.station}</div>
                    <div className="lg-subtitle">{row.forecastCorridors} forecasted corridors | {row.predictedLoad} predicted load</div>
                    <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-primary)" }}>
                      Window: {forecastWindow}
                    </div>
                  </button>
                ))}
              </div>
            </section>

          </div>

          <div style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
            <section
              style={{
                background: "var(--lg-surface-container)",
                border: "1px solid var(--lg-outline-variant)",
                padding: 16,
                display: "grid",
                gap: 12,
                alignContent: "start",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>Forecast Focus</div>
              <div className="lg-subtitle">
                Stations are ranked by next-shift predicted load, average forecast risk, and confidence share. Use the charts and map to compare where the model expects the strongest parking-pressure escalation.
              </div>
            </section>

            <section
              data-region="trendChart"
              style={{
                background: "var(--lg-surface-container)",
                border: "1px solid var(--lg-outline-variant)",
                padding: 16,
                display: "grid",
                gap: 14,
                alignContent: "start",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>High-Risk Corridor Density</div>
              <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
                {trendRows.map((row) => {
                  const highRiskDensity = Math.round((row.forecastCorridors / Math.max(1, row.hotspot_count)) * 100);
                  return (
                    <div key={row.station} style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                        <div
                          className="lg-mono"
                          style={{
                            fontSize: 12,
                            color:
                              row.station === focusedStation?.station || row.station === mapStation?.station
                                ? "var(--lg-text)"
                                : "var(--lg-text-muted)",
                          }}
                        >
                          {row.station}
                        </div>
                        <div className="lg-mono" style={{ fontSize: 12, color: "var(--lg-primary)", whiteSpace: "nowrap" }}>
                          {highRiskDensity} forecast corridors / 100 hotspots
                        </div>
                      </div>
                      <div style={{ width: "100%", height: 10, background: "var(--lg-surface-highest)" }}>
                        <div
                          style={{
                            width: `${Math.min(100, highRiskDensity)}%`,
                            height: "100%",
                            background:
                              highRiskDensity > 45
                                ? "#ffb4aa"
                                : highRiskDensity > 25
                                  ? "var(--lg-secondary)"
                                  : "var(--lg-primary)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function compareRows(
  left: StationSummary & { predictedLoad: number; avgRisk: number; highConfidenceShare: number },
  right: StationSummary & { predictedLoad: number; avgRisk: number; highConfidenceShare: number },
  sortKey: SortKey,
) {
  if (sortKey === "station") {
    return left.station.localeCompare(right.station);
  }
  if (sortKey === "avg_risk") {
    return right.avgRisk - left.avgRisk;
  }
  if (sortKey === "confidence") {
    return right.highConfidenceShare - left.highConfidenceShare;
  }
  return right.predictedLoad - left.predictedLoad;
}

function shortStation(station: string) {
  return station.length <= 8 ? station.toUpperCase() : station.slice(0, 7).toUpperCase();
}

function tableHeadStyle(align: "left" | "right" | "center" = "left") {
  return {
    padding: "12px 16px",
    textAlign: align,
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "var(--lg-text-muted)",
    whiteSpace: "nowrap" as const,
  };
}

function tableCellStyle(align: "left" | "right" | "center" = "left", color = "var(--lg-text)") {
  return {
    padding: "14px 16px",
    textAlign: align,
    color,
    borderBottom: "1px solid rgba(67,70,86,0.28)",
    verticalAlign: "top" as const,
  };
}

function KpiCard(props: { label: string; value: string; accent: string; note: string }) {
  return (
    <div
      style={{
        background: "var(--lg-surface-low)",
        borderTop: `2px solid ${props.accent}`,
        padding: 16,
        display: "grid",
        gap: 8,
      }}
    >
      <div className="lg-kicker">{props.label}</div>
      <div style={{ fontSize: 42, lineHeight: "42px", fontWeight: 800, color: props.accent }}>{props.value}</div>
      <div className="lg-mono" style={{ fontSize: 12, color: "var(--lg-text-muted)" }}>
        {props.note}
      </div>
    </div>
  );
}

function SortableHeader(props: {
  label: string;
  active: boolean;
  align?: "left" | "right" | "center";
  onClick: () => void;
}) {
  return (
    <th style={tableHeadStyle(props.align)}>
      <button
        onClick={props.onClick}
        style={{
          border: "none",
          background: "transparent",
          color: props.active ? "var(--lg-text)" : "var(--lg-text-muted)",
          font: "inherit",
          cursor: "pointer",
        }}
      >
        {props.label}{" "}
        <Icon
          name="unfold_more"
          size={10}
          color={props.active ? "var(--lg-text)" : "var(--lg-text-muted)"}
        />
      </button>
    </th>
  );
}

function StatusBadge(props: { status: string }) {
  const colors =
    props.status === "Critical"
      ? { bg: "rgba(215,26,24,0.16)", border: "#d71a18", color: "#ffdad6" }
      : props.status === "Elevated"
        ? { bg: "rgba(255,178,17,0.18)", border: "#ffb211", color: "#ffd79b" }
        : { bg: "var(--lg-surface-high)", border: "var(--lg-outline)", color: "var(--lg-text-muted)" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.color,
        padding: "4px 8px",
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {props.status}
    </span>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValidationWindow(start?: string, end?: string) {
  if (!start || !end) return "Validation window unavailable";
  return `${start} to ${end}`;
}

function buildForecastStationMapPoints(
  stationName: string,
  hotspots: HotspotRecord[],
  forecastRows: ForecastHotspot[],
  limit = 12,
) {
  const hotspotIndex = new Map(hotspots.map((hotspot) => [hotspot.cluster_id, hotspot]));

  return forecastRows
    .filter((row) => row.police_station === stationName)
    .map((row) => {
      const hotspot = hotspotIndex.get(row.cluster_id);
      if (!hotspot) {
        return null;
      }
      return {
        id: row.cluster_id,
        label: shortStation(hotspot.location.split(",")[0] ?? hotspot.location),
        latitude: hotspot.latitude,
        longitude: hotspot.longitude,
        severity: hotspot.severity_band,
        weight: row.predicted_risk_score,
        meta: `${row.predicted_risk_score} risk | ${row.predicted_next_shift_records ?? 0} predicted`,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, limit);
}

function BenchmarkMetricCard(props: { metric: ModelBenchmarkSummary["metrics"][number] }) {
  const { metric } = props;
  const isModelWinner = metric.winner === "model";
  const isBaselineWinner = metric.winner === "baseline";
  const accent = isModelWinner ? "var(--lg-primary)" : isBaselineWinner ? "#ffb4aa" : "var(--lg-text)";
  const deltaLabel = benchmarkDeltaLabel(metric);

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        padding: 14,
        border: `1px solid ${isModelWinner ? "rgba(46,91,255,0.45)" : isBaselineWinner ? "rgba(255,180,170,0.45)" : "var(--lg-outline-variant)"}`,
        background: "var(--lg-surface)",
      }}
    >
      <div className="lg-kicker">{metric.label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end" }}>
        <div>
          <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
            MODEL
          </div>
          <div style={{ fontSize: 28, lineHeight: "30px", fontWeight: 800, color: accent }}>
            {formatBenchmarkValue(metric.model_value, metric.key)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
            BASELINE
          </div>
          <div style={{ fontSize: 18, lineHeight: "20px", fontWeight: 700, color: "var(--lg-text)" }}>
            {formatBenchmarkValue(metric.baseline_value, metric.key)}
          </div>
        </div>
      </div>
      <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
        {metric.better === "lower" ? "Lower is better" : "Higher is better"} | {deltaLabel}
      </div>
    </div>
  );
}

function formatBenchmarkValue(value: number, metricKey: string) {
  if (metricKey.includes("precision") || metricKey.includes("recall")) {
    return `${Math.round(value * 100)}%`;
  }
  return value.toFixed(2);
}

function benchmarkDeltaLabel(metric: ModelBenchmarkSummary["metrics"][number]) {
  if (metric.winner === "tie") {
    return "Model matches baseline";
  }

  const difference =
    metric.better === "lower"
      ? Math.abs(metric.model_value - metric.baseline_value)
      : Math.abs(metric.model_value - metric.baseline_value);
  const formatted = formatBenchmarkValue(difference, metric.key);

  return metric.winner === "model"
    ? `Model leads by ${formatted}`
    : `Baseline leads by ${formatted}`;
}
