import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { Icon } from "../components/Icon";
import { type ForecastHotspot, type HotspotRecord, useProcessedJson } from "../lib/data";
import { compactLocation } from "../lib/dashboard";
import { screenRoute } from "../lib/routes";
import { stitchScreens } from "../lib/stitchScreens";

const screen = stitchScreens.find((item) => item.id === "policy-recommendations")!;

const tabs = [
  { key: "immediate", label: "Immediate Operations" },
  { key: "short_term", label: "Short-term Infrastructure" },
  { key: "medium_term", label: "Medium-term Policy" },
] as const;

type PolicyRow = {
  forecast: ForecastHotspot;
  hotspot: HotspotRecord;
};

export function PolicyRecommendationsScreen() {
  const hotspotsState = useProcessedJson<HotspotRecord[]>("/data/processed/hotspots.json");
  const modelForecastState = useProcessedJson<ForecastHotspot[]>("/data/processed/model_hotspot_scores.json");
  const forecastState = useProcessedJson<ForecastHotspot[]>("/data/processed/next_shift_forecast.json");
  const hotspots = hotspotsState.data ?? [];
  const forecastRows = modelForecastState.data ?? forecastState.data ?? [];
  const hotspotIndex = new Map(hotspots.map((hotspot) => [hotspot.cluster_id, hotspot]));
  const rows = forecastRows
    .map((forecast) => {
      const hotspot = hotspotIndex.get(forecast.cluster_id);
      if (!hotspot) {
        return null;
      }
      return { forecast, hotspot };
    })
    .filter((row): row is PolicyRow => Boolean(row))
    .slice(0, 12);
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("immediate");
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(rows[0]?.hotspot.cluster_id ?? null);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (tab === "immediate") return row.hotspot.recommendations.immediate.length > 0;
        if (tab === "short_term") return row.hotspot.recommendations.short_term.length > 0;
        return row.hotspot.recommendations.medium_term.length > 0;
      }),
    [rows, tab],
  );
  const selectedRow =
    filteredRows.find((row) => row.hotspot.cluster_id === selectedClusterId) ?? filteredRows[0] ?? null;
  const selectedSignals = selectedRow ? buildPolicySignals(selectedRow) : [];
  const selectedRiskAccent =
    !selectedRow
      ? "var(--lg-outline-variant)"
      : selectedRow.forecast.predicted_risk_score >= 85
        ? "#d71a18"
        : selectedRow.forecast.predicted_risk_score >= 65
          ? "#ffb211"
          : "var(--lg-primary)";

  return (
    <div className="lg-app" style={{ minHeight: "100vh", overflow: "hidden" }} data-screen-id={screen.id}>
      <AppHeader
        active="Policy"
        actions={
          <>
            <div className="lg-header-chip">Forecast Policy View</div>
          </>
        }
      />

      <main
        style={{
          padding: 20,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 360px",
          gap: 16,
          height: "calc(100vh - 68px)",
          minHeight: "calc(100vh - 68px)",
          overflow: "hidden",
        }}
      >
        <div
          className="lg-stack"
          style={{
            minHeight: 0,
            gridTemplateRows: "auto minmax(0, 1fr)",
            overflow: "hidden",
          }}
        >
          <section className="lg-panel" data-region="tabRail" style={{ padding: 24 }}>
            <div className="lg-kicker">Policy Recommendations</div>
            <div className="lg-subtitle" style={{ marginTop: 8, marginBottom: 18 }}>
              Corridor interventions ranked from next-shift hotspot forecasts, recurrence evidence, and structural road-risk signals.
            </div>
            <div style={{ display: "flex", borderBottom: "1px solid var(--lg-outline-variant)", flexWrap: "wrap" }}>
              {tabs.map((item) => {
                const active = item.key === tab;
                return (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    style={{
                      padding: "12px 18px",
                      border: "none",
                      borderBottom: active ? "2px solid var(--lg-primary)" : "2px solid transparent",
                      color: active ? "var(--lg-primary)" : "var(--lg-text-muted)",
                      background: active ? "var(--lg-surface-highest)" : "transparent",
                      textTransform: "uppercase",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      cursor: "pointer",
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className="lg-panel"
            data-region="rankedList"
            style={{
              padding: 0,
              overflow: "hidden",
              display: "grid",
              gridTemplateRows: "auto minmax(0, 1fr)",
              minHeight: 0,
              height: "100%",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "72px minmax(0, 1fr) 120px",
                gap: 16,
                padding: "12px 16px",
                background: "var(--lg-surface-low)",
                borderBottom: "1px solid var(--lg-outline-variant)",
              }}
            >
              <div className="lg-kicker" style={{ textAlign: "center" }}>
                Rank
              </div>
              <div className="lg-kicker">Hotspot and Intervention Protocol</div>
              <div className="lg-kicker" style={{ textAlign: "right" }}>
                Forecast
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gap: 10,
                padding: 12,
                paddingRight: 8,
                overflowY: "auto",
                minHeight: 0,
                alignContent: "start",
                overscrollBehavior: "contain",
              }}
            >
              {filteredRows.map((row, index) => {
                const active = row.hotspot.cluster_id === selectedRow?.hotspot.cluster_id;
                const accent =
                  row.forecast.predicted_risk_score >= 85
                    ? "#ffb4aa"
                    : row.forecast.predicted_risk_score >= 65
                      ? "#ffd79b"
                      : "#b8c3ff";

                return (
                  <button
                    key={row.hotspot.cluster_id}
                    onClick={() => setSelectedClusterId(row.hotspot.cluster_id)}
                    style={{
                      display: "grid",
                      width: "100%",
                      background: active ? "rgba(46,91,255,0.1)" : "var(--lg-surface)",
                      border: active ? "1px solid var(--lg-primary)" : "1px solid var(--lg-outline-variant)",
                      padding: 16,
                      minHeight: 126,
                      position: "relative",
                      overflow: "hidden",
                      textAlign: "left",
                      color: "var(--lg-text)",
                      cursor: "pointer",
                      alignContent: "start",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        background: accent,
                      }}
                    />
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "72px minmax(0, 1fr) 120px",
                        gap: 16,
                        marginLeft: 8,
                        alignItems: "start",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 42,
                          fontWeight: 800,
                          color: "var(--lg-text-muted)",
                          opacity: 0.55,
                          textAlign: "center",
                        }}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 18 }}>{compactLocation(row.hotspot.location)}</div>
                        <div className="lg-subtitle" style={{ marginTop: 6 }}>
                          {recommendationText(row, tab)}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                          {buildPolicySignals(row).map((chip) => (
                            <span className="lg-chip" key={chip}>
                              {chip}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", display: "grid", gap: 6, justifyItems: "end" }}>
                        <div
                          className="lg-mono"
                          style={{
                            color: row.forecast.predicted_risk_score >= 85 ? "#ffb4aa" : "var(--lg-primary)",
                            fontSize: 18,
                            fontWeight: 700,
                          }}
                        >
                          {row.forecast.predicted_risk_score}%
                        </div>
                        <ForecastConfidenceBadge confidence={row.forecast.confidence} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <aside
          className="lg-stack"
          style={{
            alignContent: "start",
            alignSelf: "start",
            minHeight: 0,
            overflow: "hidden",
            gap: 12,
          }}
        >
          <section
            className="lg-panel"
            data-region="supportPanel"
            style={{
              padding: 18,
              display: "grid",
              gap: 12,
              alignContent: "start",
              borderTop: `2px solid ${selectedRiskAccent}`,
              background:
                "radial-gradient(circle at top left, rgba(46,91,255,0.12), transparent 34%), linear-gradient(180deg, rgba(33,35,42,0.98), rgba(31,33,39,0.98))",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div className="lg-kicker">Selected Hotspot</div>
              <div style={{ fontWeight: 800, fontSize: 22, lineHeight: 1.15 }}>
                {selectedRow ? compactLocation(selectedRow.hotspot.location) : "--"}
              </div>
              <div className="lg-subtitle">
                {selectedRow?.hotspot.police_station ?? "--"}
              </div>
            </div>
            {selectedRow ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                <MiniPolicyMetric
                  label="Risk"
                  value={`${selectedRow.forecast.predicted_risk_score}/100`}
                  accent={selectedRiskAccent}
                />
                <MiniPolicyMetric
                  label="Pred."
                  value={String(selectedRow.forecast.predicted_next_shift_records ?? 0)}
                  accent="var(--lg-primary)"
                />
                <MiniPolicyMetric
                  label="Conf."
                  value={selectedRow.forecast.confidence.toUpperCase()}
                  accent="var(--lg-secondary)"
                />
              </div>
            ) : null}
            <div
              style={{
                display: "grid",
                gap: 10,
                padding: "12px 12px 10px",
                border: "1px solid var(--lg-outline-variant)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div className="lg-kicker">Forecast Outlook</div>
                {selectedRow ? <ForecastConfidenceBadge confidence={selectedRow.forecast.confidence} /> : null}
              </div>
              <div className="lg-subtitle" style={{ lineHeight: "19px" }}>
                {selectedRow
                  ? "This corridor is forecast to stay operationally important in the next shift and should be treated as a monitored enforcement priority."
                  : "--"}
              </div>
            </div>
            {selectedRow ? (
              <Link
                to={`${screenRoute("hotspot-detail")}?cluster=${encodeURIComponent(selectedRow.hotspot.cluster_id)}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  color: "#eef1ff",
                  fontWeight: 700,
                  border: "1px solid rgba(94,122,216,0.5)",
                  background: "rgba(46,91,255,0.14)",
                  padding: "10px 12px",
                }}
              >
                <Icon name="open_in_new" size={14} color="var(--lg-primary)" />
                Open Hotspot Detail
              </Link>
            ) : null}
          </section>
          <section
            className="lg-panel"
            style={{
              padding: 18,
              display: "grid",
              gap: 12,
              alignContent: "start",
              background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
            }}
          >
            <div className="lg-kicker">Reason Signals</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selectedSignals.length ? (
                selectedSignals.map((signal) => (
                  <span
                    key={signal}
                    className="lg-chip"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      borderColor: "rgba(184,195,255,0.22)",
                    }}
                  >
                    {signal}
                  </span>
                ))
              ) : (
                <div className="lg-subtitle">--</div>
              )}
            </div>
          </section>
          <section
            className="lg-panel"
            style={{
              padding: 18,
              display: "grid",
              gap: 12,
              alignContent: "start",
              background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
            }}
          >
            <div className="lg-kicker">Recommendation Guardrail</div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "var(--lg-text-muted)",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <Icon name="warning" size={14} color="var(--lg-text-muted)" />
              Field verification required
            </div>
            <div className="lg-subtitle" style={{ lineHeight: "20px" }}>
              These are forecast-backed decision-support recommendations. Field teams should still verify on-ground conditions before permanent action.
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function recommendationText(row: PolicyRow, tab: (typeof tabs)[number]["key"]) {
  if (tab === "immediate") {
    return sentenceCase(row.hotspot.recommendations.immediate[0] ?? row.hotspot.recommendations.short_term[0] ?? "");
  }
  if (tab === "short_term") {
    return sentenceCase(row.hotspot.recommendations.short_term[0] ?? row.hotspot.recommendations.immediate[0] ?? "");
  }
  return sentenceCase(row.hotspot.recommendations.medium_term[0] ?? row.hotspot.recommendations.short_term[0] ?? "");
}

function sentenceCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : "--";
}

function buildPolicySignals(row: PolicyRow) {
  return Array.from(new Set([...row.hotspot.reason_chips, ...row.forecast.top_factors])).slice(0, 5);
}

function ForecastConfidenceBadge(props: { confidence: ForecastHotspot["confidence"] }) {
  const palette =
    props.confidence === "high"
      ? { bg: "rgba(46,91,255,0.14)", border: "var(--lg-primary)", color: "#d7defe" }
      : props.confidence === "medium"
        ? { bg: "rgba(255,178,17,0.14)", border: "var(--lg-secondary)", color: "#ffd79b" }
        : { bg: "rgba(255,255,255,0.03)", border: "var(--lg-outline-variant)", color: "var(--lg-text-muted)" };

  return (
    <span
      className="lg-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 8px",
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

function MiniPolicyMetric(props: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 3,
        padding: "9px 8px 7px",
        border: "1px solid var(--lg-outline-variant)",
        background: "rgba(255,255,255,0.03)",
        minWidth: 0,
      }}
    >
      <div className="lg-kicker" style={{ fontSize: 9, lineHeight: "11px" }}>
        {props.label}
      </div>
      <div className="lg-mono" style={{ fontSize: 12, lineHeight: "15px", color: props.accent, whiteSpace: "nowrap" }}>
        {props.value}
      </div>
    </div>
  );
}
