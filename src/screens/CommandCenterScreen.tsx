import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppHeader, headerUtilityRoutes } from "../components/AppHeader";
import { GeoMap } from "../components/map/GeoMap";
import { Icon } from "../components/Icon";
import { type BriefSummary, type ForecastHotspot, type HotspotRecord, type ParkingRecord, useProcessedJson } from "../lib/data";
import {
  buildRecordAnalytics,
  compactLocation,
  filterHotspots,
  timeBandOptions,
  type DashboardFilters,
  type SeverityFilter,
} from "../lib/dashboard";
import { screenRoute } from "../lib/routes";
import { stitchScreens } from "../lib/stitchScreens";

const screen = stitchScreens.find((item) => item.id === "command-center")!;
const severityOptions: Array<{ value: SeverityFilter; label: string }> = [
  { value: "all", label: "All Severity" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "moderate", label: "Moderate" },
];
const targetCountOptions = [3, 4, 5, 6, 7, 8, 9, 10] as const;
const forecastDayOptions = Array.from({ length: 15 }, (_, index) => index + 1);
const forecastDayLabels = buildForecastDayLabels();

export function CommandCenterScreen() {
  const brief = useProcessedJson<BriefSummary>("/data/processed/brief_summary.json");
  const hotspotsState = useProcessedJson<HotspotRecord[]>("/data/processed/hotspots.json");
  const recordsState = useProcessedJson<ParkingRecord[]>("/data/processed/parking_records.json");
  const modelForecastState = useProcessedJson<ForecastHotspot[]>("/data/processed/model_hotspot_scores.json");
  const forecastState = useProcessedJson<ForecastHotspot[]>("/data/processed/next_shift_forecast.json");
  const [searchParams, setSearchParams] = useSearchParams();

  const hotspots = hotspotsState.data ?? brief.data?.top_hotspots ?? [];
  const records = recordsState.data ?? [];
  const forecastDay = readForecastDay(searchParams);
  const forecastRows = applyForecastDayHorizon(modelForecastState.data ?? forecastState.data ?? [], forecastDay);
  const analytics = records.length ? buildRecordAnalytics(records) : null;
  const filters = readFilters(searchParams);
  const filteredHotspots = filterHotspots(hotspots, analytics, filters);
  const forecastByCluster = new Map(forecastRows.map((row) => [row.cluster_id, row]));
  const selectedClusterId = searchParams.get("cluster");
  const stationOptions = ["all", ...uniqueStations(hotspots)];
  const violationOptions = ["all", ...(analytics?.violationOptions.slice(0, 10) ?? [])];
  const allOptionLabels = {
    all: "All",
  };
  const targetCount = readTargetCount(searchParams);
  const totalViolations = filteredHotspots.reduce((sum, hotspot) => sum + hotspot.record_count, 0);
  const leadStation = leadStationName(filteredHotspots);
  const leadPeakHour = derivePeakHour(filteredHotspots);
  const visibleForecastRows = buildVisibleForecastRows(filteredHotspots, forecastByCluster, targetCount);
  const forecastLead = visibleForecastRows[0] ?? null;
  const stationScopeLabel = filters.station === "all" ? "All Stations" : filters.station;
  const forecastWindowLabel = buildForecastWindowLabel(filters.timeBand, forecastDay);
  const selectedHotspot =
    filteredHotspots.find((hotspot) => hotspot.cluster_id === selectedClusterId) ??
    (forecastLead ? filteredHotspots.find((hotspot) => hotspot.cluster_id === forecastLead.cluster_id) : null) ??
    filteredHotspots[0] ??
    null;
  const selectedForecast = selectedHotspot ? forecastByCluster.get(selectedHotspot.cluster_id) ?? null : null;
  const mapPoints = buildCommandCenterMapPoints(filteredHotspots, forecastByCluster, 220);

  function updateFilters(patch: Partial<DashboardFilters> & { cluster?: string | null }) {
    const next = new URLSearchParams(searchParams);
    const merged = {
      ...filters,
      ...patch,
    };

    setFilterParam(next, "query", merged.query, "all");
    setFilterParam(next, "station", merged.station, "all");
    setFilterParam(next, "violation", merged.violation, "all");
    setFilterParam(next, "severity", merged.severity, "all");
    setFilterParam(next, "timeBand", merged.timeBand, "all");

    if (patch.cluster) {
      next.set("cluster", patch.cluster);
    } else if (patch.cluster === null) {
      next.delete("cluster");
    }

    setSearchParams(next, { replace: true });
  }

  function updateTargetCount(value: number) {
    const next = new URLSearchParams(searchParams);
    setTargetCountParam(next, value);
    setSearchParams(next, { replace: true });
  }

  function updateForecastDay(value: number) {
    const next = new URLSearchParams(searchParams);
    setForecastDayParam(next, value);
    setSearchParams(next, { replace: true });
  }

  function resetAllFilters() {
    const next = new URLSearchParams();
    setSearchParams(next, { replace: true });
  }

  function focusForecast(row: ForecastHotspot) {
    updateFilters({
      query: "",
      station: row.police_station,
      violation: filters.violation,
      severity: filters.severity,
      timeBand: filters.timeBand,
      cluster: row.cluster_id,
    });
  }

  return (
    <div className="lg-app" style={{ height: "100vh", overflow: "hidden" }} data-screen-id={screen.id}>
      <div data-region="topNavBar">
        <AppHeader
          active="Live Map"
          actions={
            <>
              <label className="lg-header-search">
                <Icon name="search" size={16} color="var(--lg-text-muted)" />
                <input
                  value={filters.query}
                  onChange={(event) => updateFilters({ query: event.target.value, cluster: null })}
                  placeholder="Search location, station, or violation"
                />
              </label>
              <Link to={headerUtilityRoutes.home} className="lg-header-icon-button" aria-label="Open Walkthrough" title="Open Walkthrough">
                <Icon name="help" size={18} color="var(--lg-text)" />
              </Link>
              <Link
                to={screenRoute("daily-brief")}
                className="lg-header-alert"
                style={{
                  height: 46,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Icon name="warning" size={16} color="#fff" />
                Daily Brief
              </Link>
            </>
          }
        />
      </div>

      <main
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) clamp(440px, 25vw, 520px)",
          height: "calc(100vh - 68px)",
          overflow: "hidden",
        }}
      >
        <section
          data-region="mapCanvas"
          style={{
            position: "relative",
            borderRight: "1px solid var(--lg-outline-variant)",
            background: "var(--lg-surface-lowest)",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div
            data-region="filterBar"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 4,
              display: "grid",
              gap: 12,
              padding: 14,
              background: "rgba(9,11,15,0.94)",
              backdropFilter: "blur(10px)",
              borderBottom: "1px solid var(--lg-outline-variant)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
              <FilterSelect
                label="Station"
                value={filters.station}
                options={stationOptions}
                labels={allOptionLabels}
                onChange={(value) => updateFilters({ station: value, cluster: null })}
              />
              <FilterSelect
                label="Time band"
                value={filters.timeBand}
                options={timeBandOptions.map((item) => item.value)}
                labels={Object.fromEntries(timeBandOptions.map((item) => [item.value, item.label]))}
                onChange={(value) => updateFilters({ timeBand: value as DashboardFilters["timeBand"], cluster: null })}
              />
              <ForecastDaySelect
                label="Forecast Day"
                value={String(forecastDay)}
                options={forecastDayOptions.map(String)}
                labels={forecastDayLabels}
                onChange={(value) => updateForecastDay(Number(value))}
              />
              <FilterSelect
                label="Violation"
                value={filters.violation}
                options={violationOptions}
                labels={allOptionLabels}
                onChange={(value) => updateFilters({ violation: value, cluster: null })}
              />
              <FilterSelect
                label="Severity"
                value={filters.severity}
                options={severityOptions.map((item) => item.value)}
                labels={Object.fromEntries(severityOptions.map((item) => [item.value, item.label]))}
                onChange={(value) => updateFilters({ severity: value as SeverityFilter, cluster: null })}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div className="lg-chip">{filteredHotspots.length.toLocaleString("en-IN")} hotspots visible</div>
                <div className="lg-chip">{totalViolations.toLocaleString("en-IN")} violations in scope</div>
                <div className="lg-chip">Lead station: {leadStation}</div>
              </div>
              <button
                onClick={resetAllFilters}
                style={{
                  border: "1px solid var(--lg-outline-variant)",
                  background: "transparent",
                  color: "var(--lg-text)",
                  padding: "10px 14px",
                  fontWeight: 700,
                }}
              >
                Reset Filters
              </button>
            </div>
          </div>

          <div style={{ paddingTop: 152, height: "100%" }}>
            <GeoMap
              points={mapPoints}
              selectedId={selectedHotspot?.cluster_id ?? null}
              onSelect={(id) => updateFilters({ cluster: id })}
              title="Bengaluru Parking Pressure"
              subtitle="Zoom into dense hotspots, then open the selected cluster to inspect explainable recommendations."
              overlayTop={20}
              showSelectedTooltip={false}
              showSelectedOverlay={false}
              height="100%"
            />
          </div>

          {selectedHotspot ? (
            <div
              style={{
                position: "absolute",
                left: 14,
                bottom: 14,
                zIndex: 4,
                width: 250,
                background: "rgba(9,11,15,0.94)",
                border: "1px solid var(--lg-outline-variant)",
                padding: 10,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="lg-kicker">Selected Corridor</div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginTop: 5, lineHeight: 1.15 }}>
                    {compactLocation(selectedHotspot.location)}
                  </div>
                  <div className="lg-subtitle" style={{ marginTop: 5, fontSize: 11, lineHeight: "16px" }}>
                    {selectedHotspot.police_station} | {buildSelectedScoreLabel(selectedHotspot, selectedForecast)}
                  </div>
                </div>
                <SeverityPill severity={selectedHotspot.severity_band} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selectedHotspot.reason_chips.slice(0, 4).map((chip) => (
                  <span key={chip} className="lg-chip" style={{ padding: "4px 8px", fontSize: 10, lineHeight: "14px" }}>
                    {chip}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link
                  to={`${screenRoute("hotspot-detail")}?cluster=${encodeURIComponent(selectedHotspot.cluster_id)}`}
                  state={{ hotspot: selectedHotspot }}
                  style={primaryButtonStyle}
                >
                  Open Detail
                </Link>
                <Link
                  to={`${screenRoute("enforcement-planner")}?cluster=${encodeURIComponent(selectedHotspot.cluster_id)}&station=${encodeURIComponent(selectedHotspot.police_station)}`}
                  style={secondaryButtonStyle}
                >
                  Queue In Planner
                </Link>
              </div>
            </div>
          ) : null}
        </section>

        <section
          data-region="interveneNowPanel"
          style={{
            background: "var(--lg-surface)",
            display: "grid",
            gridTemplateRows: "auto minmax(0, 1fr)",
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
            boxShadow: "-8px 0 24px rgba(0,0,0,0.5)",
          }}
        >
          <div
            data-region="kpiRail"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              padding: 14,
              borderBottom: "1px solid var(--lg-outline-variant)",
              background: "#17191d",
            }}
          >
            <MetricCard label="Visible Violations" value={totalViolations.toLocaleString("en-IN")} note="filtered command scope" accent="var(--lg-primary)" />
            <MetricCard label="Active Hotspots" value={filteredHotspots.length.toLocaleString("en-IN")} note="current map selection" accent="#ffb4aa" />
            <MetricCard label="Top Station" value={leadStation} note="highest filtered pressure" accent="var(--lg-secondary)" compact />
            <MetricCard label="Peak Window" value={leadPeakHour} note="derived from visible hotspots" accent="#7bc4ff" compact />
          </div>

          <div style={{ padding: 14, minHeight: 0, overflowY: "auto", display: "grid", gap: 14 }}>
            <section
              style={{
                border: "1px solid var(--lg-outline-variant)",
                background: "var(--lg-surface-container-low)",
                padding: 14,
                display: "grid",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 10,
                  alignItems: "start",
                }}
              >
                <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Icon name="analytics" size={16} color="var(--lg-primary)" />
                    <div style={{ fontSize: 16, fontWeight: 800 }}>Next-Shift Forecast</div>
                  </div>
                  <div
                    className="lg-mono"
                    style={{ fontSize: 11, lineHeight: "15px", color: "var(--lg-text-muted)" }}
                  >
                    {forecastWindowLabel}
                  </div>
                  <div
                    className="lg-subtitle"
                    style={{ fontSize: 11, lineHeight: "15px", display: "flex", gap: 10, flexWrap: "wrap" }}
                  >
                    <span>Predicted targets ranked by risk.</span>
                  </div>
                </div>
                <label style={{ display: "grid", gap: 4, minWidth: 104 }}>
                  <span className="lg-kicker" style={{ textAlign: "right" }}>Targets</span>
                  <select
                    value={String(targetCount)}
                    onChange={(event) => updateTargetCount(Number(event.target.value))}
                    style={{
                      border: "1px solid var(--lg-outline-variant)",
                      background: "var(--lg-surface)",
                      color: "var(--lg-text)",
                      padding: "8px 10px",
                      fontSize: 12,
                      minHeight: 34,
                    }}
                  >
                    {targetCountOptions.map((count) => (
                      <option key={count} value={count}>
                        Top {count}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {forecastLead ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                    gap: 8,
                  }}
                >
                  <MiniMetric label="Top Forecast Risk" value={String(forecastLead.predicted_risk_score)} />
                  <MiniMetric label="Station" value={stationScopeLabel} />
                </div>
              ) : null}

              {visibleForecastRows.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {visibleForecastRows.map((row, index) => {
                    const hotspotMatch = hotspots.find((hotspot) => hotspot.cluster_id === row.cluster_id) ?? null;
                    const interventionNote =
                      hotspotMatch?.recommendations.immediate[0] ?? "Queue targeted enforcement for the next shift.";
                    const tone = getInterventionTone(row, hotspotMatch);
                    const repeatDays = hotspotMatch?.repeat_days ?? row.support_count ?? 0;
                    const tags = buildInterventionTags(row, hotspotMatch);

                    return (
                      <button
                        key={`${row.cluster_id}-${row.forecast_shift}`}
                        onClick={() => focusForecast(row)}
                        style={{
                          border: selectedHotspot?.cluster_id === row.cluster_id
                            ? `1px solid ${tone.accent}`
                            : `1px solid ${tone.border}`,
                          background: selectedHotspot?.cluster_id === row.cluster_id
                            ? tone.activeBackground
                            : tone.background,
                          padding: 14,
                          display: "grid",
                          gap: 10,
                          textAlign: "left",
                          color: "var(--lg-text)",
                          cursor: "pointer",
                          boxShadow: selectedHotspot?.cluster_id === row.cluster_id
                            ? `inset 3px 0 0 ${tone.accent}`
                            : `inset 3px 0 0 ${tone.mutedAccent}`,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                          <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span
                                className="lg-mono"
                                style={{
                                  fontSize: 12,
                                  color: tone.rank,
                                  fontWeight: 700,
                                }}
                              >
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>
                                {compactLocation(row.location)}
                              </div>
                            </div>
                            <div className="lg-mono" style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--lg-text-muted)" }}>
                              <span>{row.predicted_next_shift_records ?? 0} predicted</span>
                              <span
                                style={{
                                  padding: "4px 8px",
                                  border: "1px solid var(--lg-outline-variant)",
                                  background: "rgba(255,255,255,0.02)",
                                  color: "var(--lg-text-muted)",
                                  fontSize: 11,
                                  lineHeight: "14px",
                                }}
                              >
                                {formatConfidenceLabel(row.confidence)}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <span
                              className="lg-mono"
                              style={{
                                color: tone.accent,
                                fontSize: 20,
                                fontWeight: 800,
                                whiteSpace: "nowrap",
                              }}
                            >
                              RISK {row.predicted_risk_score}
                            </span>
                          </div>
                        </div>

                        <div style={{ color: "var(--lg-text)", fontSize: 13, lineHeight: "19px" }}>
                          {interventionNote}
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="lg-mono"
                              style={{
                                padding: "4px 8px",
                                border: `1px solid ${tone.border}`,
                                background: "rgba(255,255,255,0.02)",
                                color: "var(--lg-text-muted)",
                                fontSize: 11,
                                lineHeight: "14px",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div
                          className="lg-mono"
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                            fontSize: 11,
                            color: "var(--lg-text-muted)",
                            alignItems: "center",
                          }}
                        >
                          <span>{row.police_station}</span>
                          <InterventionSeverityBadge severity={row.severity_band} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="lg-subtitle" style={{ fontSize: 12 }}>
                  No forecast rows match the current station and time scope.
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

function FilterSelect(props: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span className="lg-kicker">{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        style={{
          border: "1px solid var(--lg-outline-variant)",
          background: "var(--lg-surface-container)",
          color: "var(--lg-text)",
          padding: "10px 12px",
        }}
      >
        {props.options.map((option) => (
          <option key={option} value={option}>
            {props.labels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ForecastDaySelect(props: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!hostRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectedLabel = props.labels?.[props.value] ?? props.value;

  return (
    <div ref={hostRef} style={{ display: "grid", gap: 6, position: "relative" }}>
      <span className="lg-kicker">{props.label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        style={{
          border: `1px solid ${open ? "var(--lg-primary)" : "var(--lg-outline-variant)"}`,
          background: "var(--lg-surface-container)",
          color: "var(--lg-text)",
          padding: "10px 12px",
          minHeight: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          textAlign: "left",
          boxShadow: open ? "0 0 0 1px rgba(46,91,255,0.16)" : "none",
        }}
      >
        <span style={{ minWidth: 0 }}>{selectedLabel}</span>
        <Icon name="arrow_drop_down" size={16} color="var(--lg-text-muted)" />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={props.label}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: 220,
            overflowY: "auto",
            overscrollBehavior: "contain",
            scrollbarGutter: "stable",
            border: "1px solid var(--lg-outline-variant)",
            background: "var(--lg-surface)",
            boxShadow: "0 14px 30px rgba(0,0,0,0.42)",
          }}
        >
          {props.options.map((option) => {
            const active = option === props.value;

            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  props.onChange(option);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  minHeight: 44,
                  padding: "10px 12px",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: active ? "rgba(46,91,255,0.18)" : "transparent",
                  color: active ? "#dfe5ff" : "var(--lg-text)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span>{props.labels?.[option] ?? option}</span>
                {active ? <Icon name="check_circle" size={14} color="var(--lg-primary)" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MetricCard(props: { label: string; value: string; note: string; accent: string; compact?: boolean }) {
  return (
    <div
      style={{
        background: "var(--lg-surface-container-low)",
        borderTop: `2px solid ${props.accent}`,
        padding: 14,
        display: "grid",
        gap: 8,
      }}
    >
      <span className="lg-kicker">{props.label}</span>
      <span
        style={{
          fontSize: props.compact ? 20 : 36,
          lineHeight: props.compact ? "24px" : "38px",
          fontWeight: 800,
          color: props.accent,
        }}
      >
        {props.value}
      </span>
      <span className="lg-subtitle" style={{ fontSize: 12 }}>
        {props.note}
      </span>
    </div>
  );
}

function MiniMetric(props: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--lg-outline-variant)",
        background: "rgba(255,255,255,0.02)",
        padding: "10px 12px",
        display: "grid",
        gap: 4,
      }}
    >
      <span className="lg-kicker" style={{ fontSize: 10, lineHeight: "13px" }}>{props.label}</span>
      <span className="lg-mono" style={{ fontSize: 12, lineHeight: "16px", whiteSpace: "normal" }}>
        {props.value}
      </span>
    </div>
  );
}

function buildForecastWindowLabel(timeBand: DashboardFilters["timeBand"], forecastDay: number) {
  const targetDate = buildForecastTargetDate(forecastDay);
  const dateLabel = formatForecastDate(targetDate);

  return `${labelForForecastWindow(timeBand)} | ${dateLabel}`;
}

function labelForForecastWindow(timeBand: DashboardFilters["timeBand"]) {
  if (timeBand === "peak") {
    return "Peak Window";
  }

  if (timeBand === "morning") {
    return "Morning";
  }

  if (timeBand === "midday") {
    return "Midday";
  }

  if (timeBand === "evening") {
    return "Evening";
  }

  if (timeBand === "overnight") {
    return "Overnight";
  }

  return "All Day";
}

function buildForecastDayLabels() {
  return Object.fromEntries(
    forecastDayOptions.map((dayAhead) => [
      String(dayAhead),
      formatForecastDate(buildForecastTargetDate(dayAhead)),
    ]),
  );
}

function buildForecastTargetDate(forecastDay: number) {
  const currentIstDate = getCurrentIstDate();
  currentIstDate.setUTCDate(currentIstDate.getUTCDate() + Math.max(1, forecastDay));
  return currentIstDate;
}

function getCurrentIstDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "01");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "01");

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function formatForecastDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatConfidenceLabel(confidence: ForecastHotspot["confidence"]) {
  return `${confidence.toUpperCase()} CONFIDENCE`;
}

function buildSelectedScoreLabel(hotspot: HotspotRecord, forecast: ForecastHotspot | null) {
  if (forecast) {
    return `risk ${forecast.predicted_risk_score}/100`;
  }

  return `${Math.round(hotspot.priority_score)}/100 priority`;
}

function buildCommandCenterMapPoints(
  hotspots: HotspotRecord[],
  forecastByCluster: Map<string, ForecastHotspot>,
  limit = 180,
) {
  return hotspots.slice(0, limit).map((hotspot) => {
    const forecast = forecastByCluster.get(hotspot.cluster_id) ?? null;
    const primaryScore = forecast?.predicted_risk_score ?? Math.round(hotspot.priority_score);
    const metaLabel = forecast ? `risk ${primaryScore}` : `${primaryScore}/100 priority`;

    return {
      id: hotspot.cluster_id,
      label: compactLocation(hotspot.location),
      latitude: hotspot.latitude,
      longitude: hotspot.longitude,
      severity: hotspot.severity_band,
      weight: primaryScore,
      meta: `${hotspot.police_station} | ${metaLabel}`,
    };
  });
}

function buildVisibleForecastRows(
  hotspots: HotspotRecord[],
  forecastByCluster: Map<string, ForecastHotspot>,
  targetCount: number,
) {
  const confidenceRank: Record<ForecastHotspot["confidence"], number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  return hotspots
    .map((hotspot) => ({
      hotspot,
      forecast: forecastByCluster.get(hotspot.cluster_id) ?? null,
    }))
    .filter((entry): entry is { hotspot: HotspotRecord; forecast: ForecastHotspot } => entry.forecast !== null)
    .sort((left, right) => {
      const riskDelta = right.forecast.predicted_risk_score - left.forecast.predicted_risk_score;
      if (riskDelta !== 0) {
        return riskDelta;
      }

      const predictedDelta =
        (right.forecast.predicted_next_shift_records ?? 0) - (left.forecast.predicted_next_shift_records ?? 0);
      if (predictedDelta !== 0) {
        return predictedDelta;
      }

      const confidenceDelta = confidenceRank[right.forecast.confidence] - confidenceRank[left.forecast.confidence];
      if (confidenceDelta !== 0) {
        return confidenceDelta;
      }

      return right.hotspot.priority_score - left.hotspot.priority_score;
    })
    .slice(0, targetCount)
    .map((entry) => entry.forecast);
}

function applyForecastDayHorizon(rows: ForecastHotspot[], forecastDay: number) {
  const extraDays = Math.max(0, forecastDay - 1);
  if (!extraDays) {
    return rows;
  }

  return rows.map((row) => {
    const riskPenalty = extraDays * 6;
    const countDecay = Math.max(0.72, 1 - extraDays * 0.08);

    return {
      ...row,
      predicted_risk_score: Math.max(8, Math.round(row.predicted_risk_score - riskPenalty)),
      predicted_next_shift_records:
        row.predicted_next_shift_records == null
          ? row.predicted_next_shift_records
          : Math.max(0, Math.round(row.predicted_next_shift_records * countDecay)),
      confidence: degradeForecastConfidence(row.confidence, extraDays),
    };
  });
}

function degradeForecastConfidence(
  confidence: ForecastHotspot["confidence"],
  extraDays: number,
): ForecastHotspot["confidence"] {
  if (extraDays <= 0) {
    return confidence;
  }

  if (extraDays === 1) {
    return confidence === "low" ? "low" : confidence;
  }

  if (extraDays === 2) {
    if (confidence === "high") {
      return "medium";
    }
    return "low";
  }

  return "low";
}

function getInterventionTone(row: ForecastHotspot, hotspot: HotspotRecord | null) {
  const severity = hotspot?.severity_band ?? row.severity_band;

  if (severity === "critical" || row.predicted_risk_score >= 85) {
    return {
      accent: "#ff5e57",
      mutedAccent: "rgba(255,94,87,0.62)",
      border: "rgba(255,94,87,0.38)",
      background: "var(--lg-surface-container-low)",
      activeBackground: "rgba(255,255,255,0.04)",
      rank: "#ffb4aa",
    };
  }

  if (severity === "high" || row.predicted_risk_score >= 60) {
    return {
      accent: "#ffb211",
      mutedAccent: "rgba(255,178,17,0.62)",
      border: "rgba(255,178,17,0.28)",
      background: "var(--lg-surface-container-low)",
      activeBackground: "rgba(255,255,255,0.04)",
      rank: "#ffd79b",
    };
  }

  return {
    accent: "#5e7ad8",
    mutedAccent: "rgba(94,122,216,0.62)",
    border: "rgba(94,122,216,0.3)",
    background: "var(--lg-surface-container-low)",
    activeBackground: "rgba(255,255,255,0.04)",
    rank: "#b8c3ff",
  };
}

function buildInterventionTags(row: ForecastHotspot, hotspot: HotspotRecord | null) {
  const rawTags = [
    ...(hotspot?.reason_chips ?? []),
    ...row.top_factors,
  ];

  return Array.from(
    new Map(
      rawTags
        .map((tag) => formatInterventionTag(tag))
        .filter(Boolean)
        .map((tag) => [tag.toLowerCase(), tag]),
    ).values(),
  ).slice(0, 4);
}

function formatInterventionTag(tag: string) {
  return tag
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function InterventionSeverityBadge(props: { severity: HotspotRecord["severity_band"] }) {
  const tone =
    props.severity === "critical"
      ? { bg: "#93000a", border: "#ff5e57", color: "#ffdad6", label: "CRITICAL" }
      : props.severity === "high"
        ? { bg: "#5b4300", border: "#ffb211", color: "#ffd79b", label: "HIGH" }
        : { bg: "#243156", border: "#5e7ad8", color: "#c5d0ff", label: "WATCH" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 28,
        padding: "5px 9px",
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.color,
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {tone.label}
    </span>
  );
}

function ForecastConfidencePill(props: { confidence: ForecastHotspot["confidence"] }) {
  const tone =
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
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.color,
        fontSize: 10,
        textTransform: "uppercase",
      }}
    >
      {props.confidence}
    </span>
  );
}

function SeverityPill(props: { severity: HotspotRecord["severity_band"] }) {
  const tone =
    props.severity === "critical"
      ? { bg: "#93000a", border: "#d71a18", color: "#ffdad6", label: "HIGH" }
      : props.severity === "high"
        ? { bg: "#5b4300", border: "#ffb211", color: "#ffd79b", label: "MEDIUM" }
        : { bg: "#243156", border: "#5e7ad8", color: "#c5d0ff", label: "LOW" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 84,
        height: 28,
        padding: "0 10px",
        flexShrink: 0,
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.color,
        fontSize: 10,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        lineHeight: 1,
        textAlign: "center",
        whiteSpace: "nowrap",
      }}
    >
      {tone.label}
    </span>
  );
}

function readFilters(searchParams: URLSearchParams): DashboardFilters {
  return {
    query: searchParams.get("query") ?? "",
    station: searchParams.get("station") ?? "all",
    violation: searchParams.get("violation") ?? "all",
    severity: (searchParams.get("severity") as SeverityFilter | null) ?? "all",
    timeBand: (searchParams.get("timeBand") as DashboardFilters["timeBand"] | null) ?? "all",
  };
}

function readTargetCount(searchParams: URLSearchParams) {
  const raw = Number(searchParams.get("targets") ?? 5);
  return targetCountOptions.includes(raw as (typeof targetCountOptions)[number]) ? raw : 5;
}

function readForecastDay(searchParams: URLSearchParams) {
  const raw = Number(searchParams.get("dayAhead") ?? 1);
  return forecastDayOptions.includes(raw) ? raw : 1;
}

function setFilterParam(searchParams: URLSearchParams, key: string, value: string, defaultValue: string) {
  if (!value || value === defaultValue) {
    searchParams.delete(key);
    return;
  }
  searchParams.set(key, value);
}

function setTargetCountParam(searchParams: URLSearchParams, value: number) {
  if (value === 5) {
    searchParams.delete("targets");
    return;
  }

  searchParams.set("targets", String(value));
}

function setForecastDayParam(searchParams: URLSearchParams, value: number) {
  if (value === 1) {
    searchParams.delete("dayAhead");
    return;
  }

  searchParams.set("dayAhead", String(value));
}

function uniqueStations(hotspots: HotspotRecord[]) {
  return Array.from(new Set(hotspots.map((item) => item.police_station))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function leadStationName(hotspots: HotspotRecord[]) {
  if (!hotspots.length) {
    return "--";
  }

  const totals = new Map<string, number>();
  for (const hotspot of hotspots) {
    totals.set(hotspot.police_station, (totals.get(hotspot.police_station) ?? 0) + hotspot.record_count);
  }

  return [...totals.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "--";
}

function derivePeakHour(hotspots: HotspotRecord[]) {
  if (!hotspots.length) {
    return "--";
  }

  const busiest = hotspots
    .slice(0, 12)
    .sort((left, right) => right.peak_hour_events - left.peak_hour_events)[0];
  return busiest ? `${busiest.peak_hour_events.toLocaleString("en-IN")} peak events` : "--";
}

const primaryButtonStyle = {
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 42,
  padding: "8px 10px",
  background: "var(--lg-primary-container)",
  color: "#f5f7ff",
  fontWeight: 800,
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

const secondaryButtonStyle = {
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 42,
  padding: "8px 10px",
  border: "1px solid var(--lg-outline-variant)",
  background: "transparent",
  color: "var(--lg-text)",
  fontWeight: 700,
  fontSize: 11,
};
