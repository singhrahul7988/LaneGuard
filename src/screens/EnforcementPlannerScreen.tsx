import { startTransition, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppHeader, buildCriticalMapRoute } from "../components/AppHeader";
import { GeoMap } from "../components/map/GeoMap";
import { Icon } from "../components/Icon";
import { stitchScreens } from "../lib/stitchScreens";
import {
  type HotspotRecord,
  type OptimizedShiftPlan,
  type OptimizedShiftPlanArtifact,
  type OptimizerStrategy,
  type StationResource,
  useProcessedJson,
} from "../lib/data";
import {
  aggregateStationShiftResources,
  buildHotspotPoints,
  createPlannerExport,
  downloadTextFile,
  formatPlannerDemand,
  plannerDemandForHotspot,
  sumPlannerDemand,
} from "../lib/dashboard";
import { screenRoute } from "../lib/routes";

const screen = stitchScreens.find((item) => item.id === "enforcement-planner")!;
const shiftOptions = ["Morning", "Afternoon", "Night"] as const;
const defaultAiStrategy: OptimizerStrategy = "balanced";
const plannerTimeOptions = [
  { value: "peak", label: "Peak Window" },
  { value: "morning", label: "Morning 06:00-11:00" },
  { value: "midday", label: "Midday 11:00-16:00" },
  { value: "evening", label: "Evening 16:00-21:00" },
  { value: "overnight", label: "Overnight 21:00-06:00" },
] as const;
type PlannerTimeBand = (typeof plannerTimeOptions)[number]["value"];

export function EnforcementPlannerScreen() {
  const hotspotsState = useProcessedJson<HotspotRecord[]>("/data/processed/hotspots.json");
  const resourcesState = useProcessedJson<StationResource[]>("/data/processed/station_resources.json");
  const optimizedPlanState = useProcessedJson<OptimizedShiftPlanArtifact>("/data/processed/optimized_shift_plan.json");
  const hotspots = hotspotsState.data ?? [];
  const stationResources = resourcesState.data ?? [];
  const [searchParams] = useSearchParams();
  const initialStation = searchParams.get("station") ?? "All Stations";
  const [timeBand, setTimeBand] = useState<PlannerTimeBand>(readPlannerTimeBand(searchParams.get("shift")));
  const [stationFilter, setStationFilter] = useState(initialStation);
  const [aiStrategy, setAiStrategy] = useState<OptimizerStrategy>(defaultAiStrategy);
  const [queuedIds, setQueuedIds] = useState<string[]>([]);
  const [committedIds, setCommittedIds] = useState<string[]>([]);
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(null);

  const stationOptions = ["All Stations", ...uniqueStations(hotspots)];
  const hotspotIndex = new Map(hotspots.map((hotspot) => [hotspot.cluster_id, hotspot]));
  const planningShift = resolvePlannerShift(timeBand, optimizedPlanState.data?.plans ?? [], stationFilter, aiStrategy);
  const selectedTimeBandLabel =
    plannerTimeOptions.find((option) => option.value === timeBand)?.label ?? "Morning 06:00-11:00";
  const optimizedPlan =
    optimizedPlanState.data?.plans.find(
      (plan) => plan.shift === planningShift && plan.station_filter === stationFilter && plan.strategy === aiStrategy,
    ) ?? null;
  const rankedRows = optimizedPlan
    ? optimizedPlan.recommended_items
        .map((item) => {
          const hotspot = hotspotIndex.get(item.cluster_id);
          if (!hotspot) {
            return null;
          }
          return { hotspot, planItem: item };
        })
        .filter((item): item is { hotspot: HotspotRecord; planItem: OptimizedShiftPlan["recommended_items"][number] } => Boolean(item))
    : hotspots
        .filter((hotspot) => stationFilter === "All Stations" || hotspot.police_station === stationFilter)
        .slice(0, 12)
        .map((hotspot) => ({ hotspot, planItem: null }));
  const rankedHotspots = rankedRows.map((row) => row.hotspot);
  const queueHotspots = queuedIds
    .map((clusterId) => hotspots.find((item) => item.cluster_id === clusterId))
    .filter((item): item is HotspotRecord => Boolean(item));
  const committedHotspots = committedIds
    .map((clusterId) => hotspots.find((item) => item.cluster_id === clusterId))
    .filter((item): item is HotspotRecord => Boolean(item));
  const queueDemand = sumPlannerDemand(queueHotspots);
  const committedDemand = sumPlannerDemand(committedHotspots);
  const projectedRelief = queueHotspots.length
    ? Math.min(
        48,
        Math.round(
          queueHotspots.reduce((sum, hotspot) => sum + hotspot.impact_proxy_score, 0) /
            Math.max(1, queueHotspots.length) /
            2.2,
        ),
      )
    : 0;
  const criticalUncovered = rankedHotspots.filter(
    (hotspot) => hotspot.severity_band === "critical" && !queuedIds.includes(hotspot.cluster_id) && !committedIds.includes(hotspot.cluster_id),
  ).length;
  const scopedHotspots = queueHotspots.length ? queueHotspots : committedHotspots;
  const resourceScopeStations = stationFilter !== "All Stations"
    ? [stationFilter]
    : Array.from(new Set(scopedHotspots.map((hotspot) => hotspot.police_station)));
  const allocationScopeLabel = resourceScopeStations.length <= 1
    ? resourceScopeStations[0] ?? "None"
    : `${resourceScopeStations[0]} + ${resourceScopeStations.length - 1} linked station${resourceScopeStations.length > 2 ? "s" : ""}`;
  const aggregatedResources = aggregateStationShiftResources(stationResources, resourceScopeStations, planningShift);
  const totalCapacity = aggregatedResources.shift.totals;
  const availableNow = {
    officers: totalCapacity.officers - committedDemand.officers,
    patrol_cars: totalCapacity.patrol_cars - committedDemand.patrol_cars,
    tow_trucks: totalCapacity.tow_trucks - committedDemand.tow_trucks,
    constables: totalCapacity.constables - committedDemand.constables,
  };
  const remainingAfterPlan = {
    officers: availableNow.officers - queueDemand.officers,
    patrol_cars: availableNow.patrol_cars - queueDemand.patrol_cars,
    tow_trucks: availableNow.tow_trucks - queueDemand.tow_trucks,
    constables: availableNow.constables - queueDemand.constables,
  };
  const hasShortfall = Object.values(remainingAfterPlan).some((value) => value < 0);
  const aiSuggestedIds = (optimizedPlan?.recommended_items ?? [])
    .map((item) => item.cluster_id)
    .filter((clusterId) => !committedIds.includes(clusterId));

  function loadAiQueue() {
    if (!aiSuggestedIds.length) {
      return;
    }
    startTransition(() => {
      setQueuedIds(aiSuggestedIds);
    });
  }

  function toggleQueue(clusterId: string) {
    startTransition(() => {
      setQueuedIds((current) => {
        if (committedIds.includes(clusterId)) {
          return current;
        }
        return current.includes(clusterId)
          ? current.filter((item) => item !== clusterId)
          : [...current, clusterId];
      });
    });
  }

  function commitPlan() {
    if (!queueHotspots.length) {
      return;
    }
    startTransition(() => {
      setCommittedIds((current) => {
        const next = new Set(current);
        queueHotspots.forEach((hotspot) => next.add(hotspot.cluster_id));
        return Array.from(next);
      });
      setQueuedIds([]);
    });
  }

  function exportPlan() {
    const exportHotspots = queueHotspots.length ? queueHotspots : committedHotspots;
    if (!exportHotspots.length) {
      return;
    }
    setLastExportedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    downloadTextFile(
      `laneguard-${timeBand}-plan.txt`,
      createPlannerExport(selectedTimeBandLabel, exportHotspots, projectedRelief),
    );
  }

  function resetPlanner() {
    startTransition(() => {
      setQueuedIds([]);
      setCommittedIds([]);
      setLastExportedAt(null);
    });
  }

  return (
    <div className="lg-app" style={{ minHeight: "100vh", overflow: "hidden" }} data-screen-id={screen.id}>
      <AppHeader
        active="Interventions"
        actions={
          <>
            <Link to={buildCriticalMapRoute(stationFilter)} className="lg-header-alert">
              Emergency Alert
            </Link>
          </>
        }
      />

      <main
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.62fr) minmax(400px, 0.88fr)",
          gap: 14,
          padding: 14,
          height: "calc(100vh - 68px)",
          background: "var(--lg-background)",
          overflow: "hidden",
        }}
      >
        <section
          style={{
            display: "grid",
            gridTemplateRows: "auto minmax(0, 1fr)",
            alignContent: "start",
            gap: 12,
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <div
            data-region="plannerFilters"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "end",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 520 }}>
              <h1 style={{ margin: 0, fontSize: 22, lineHeight: "30px", fontWeight: 700 }}>Enforcement Planner</h1>
              <div className="lg-subtitle" style={{ marginTop: 4, fontSize: 13, lineHeight: "18px" }}>
                Queue predicted next-shift hotspots, preview coverage, and export a shift-ready assignment list.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ position: "relative", display: "inline-flex" }}>
                <select
                  value={timeBand}
                  onChange={(event) => setTimeBand(event.target.value as PlannerTimeBand)}
                  style={{
                    appearance: "none",
                    minWidth: 208,
                    height: 46,
                    border: "1px solid var(--lg-outline-variant)",
                    background: "var(--lg-surface-container)",
                    color: "var(--lg-text)",
                    padding: "10px 34px 10px 12px",
                  }}
                >
                  {plannerTimeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                  }}
                >
                  <Icon name="arrow_drop_down" size={16} color="var(--lg-text-muted)" />
                </span>
              </label>
              <label style={{ position: "relative", display: "inline-flex" }}>
                <select
                  value={stationFilter}
                  onChange={(event) => setStationFilter(event.target.value)}
                  style={{
                    appearance: "none",
                    minWidth: 188,
                    height: 46,
                    border: "1px solid var(--lg-outline-variant)",
                    background: "var(--lg-surface-container)",
                    color: "var(--lg-text)",
                    padding: "10px 34px 10px 12px",
                  }}
                >
                  {stationOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                  }}
                >
                  <Icon name="arrow_drop_down" size={16} color="var(--lg-text-muted)" />
                </span>
              </label>
            </div>
          </div>

          <section
            data-region="rankedQueue"
            style={{
              background: "var(--lg-surface)",
              border: "1px solid var(--lg-outline-variant)",
              display: "grid",
              gridTemplateRows: "auto minmax(0, 1fr)",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                background: "var(--lg-surface-low)",
                borderBottom: "1px solid var(--lg-outline-variant)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>Prioritized Hotspots</div>
              <div className="lg-kicker">Time Band: {selectedTimeBandLabel}</div>
            </div>
            <div style={{ overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "250px" }} />
                  <col style={{ width: "170px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "260px" }} />
                  <col style={{ width: "44px" }} />
                </colgroup>
                <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--lg-surface-lowest)" }}>
                  <tr>
                    {["Rank", "Location", "Urgency", "Pred. Vol.", "Assigned Units", ""].map((label, index) => (
                      <th
                        key={label}
                        style={{
                          padding: "12px 16px",
                          textAlign: index === 5 ? "center" : "left",
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--lg-text-muted)",
                          borderBottom: "1px solid var(--lg-outline-variant)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankedRows.map(({ hotspot, planItem }, index) => {
                    const queued = queuedIds.includes(hotspot.cluster_id);
                    const committed = committedIds.includes(hotspot.cluster_id);
                    const severity = severityPresentation(hotspot.severity_band);
                    const predictedVolume = planItem?.predicted_next_shift_records ?? hotspot.record_count;
                    const displayedDemand = planItem?.demand ?? plannerDemandForHotspot(hotspot);
                    return (
                      <tr
                        key={hotspot.cluster_id}
                        style={{
                          background: committed
                            ? "rgba(255,180,170,0.06)"
                            : queued
                              ? "rgba(46,91,255,0.08)"
                              : "transparent",
                          borderLeft: committed
                            ? "2px solid #ffb4aa"
                            : queued
                              ? "2px solid var(--lg-primary)"
                              : "2px solid transparent",
                        }}
                      >
                        <td style={cellStyle("center", severity.textColor)}>
                          {String(index + 1).padStart(2, "0")}
                        </td>
                        <td style={cellStyle()}>
                          <div style={{ fontWeight: 700 }}>{compactLocation(hotspot.location)}</div>
                          <div className="lg-subtitle" style={{ marginTop: 4 }}>
                            {hotspot.police_station}
                          </div>
                        </td>
                        <td style={cellStyle()}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              background: severity.bg,
                              color: severity.textColor,
                              border: `1px solid ${severity.border}`,
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                background: severity.dot,
                                display: "inline-block",
                              }}
                            />
                            {hotspot.severity_band}
                          </span>
                        </td>
                        <td style={cellStyle()}>{predictedVolume.toLocaleString("en-IN")}</td>
                        <td style={cellStyle()}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {committed ? (
                              <span className="lg-mono" style={{ fontSize: 11, color: "#ffb4aa" }}>
                                Committed
                              </span>
                            ) : queued ? (
                              <span className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text)" }}>
                                {formatPlannerDemand(displayedDemand)}
                              </span>
                            ) : planItem ? (
                              <span className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
                                {formatPlannerDemand(displayedDemand)}
                              </span>
                            ) : (
                              <span className="lg-mono" style={{ fontSize: 11, color: "var(--lg-outline)" }}>
                                Unassigned
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={cellStyle("center")}>
                          <button
                            onClick={() => toggleQueue(hotspot.cluster_id)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: committed ? "#ffb4aa" : queued ? "var(--lg-primary)" : "var(--lg-text-muted)",
                              cursor: committed ? "not-allowed" : "pointer",
                              opacity: committed ? 0.6 : 1,
                            }}
                            disabled={committed}
                          >
                            <Icon
                              name={committed ? "check_circle" : queued ? "remove_circle" : "add_circle"}
                              size={18}
                              color={committed ? "#ffb4aa" : queued ? "var(--lg-primary)" : "var(--lg-text-muted)"}
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <aside
          style={{
            display: "grid",
            alignContent: "start",
            gap: 12,
            minWidth: 0,
            minHeight: 0,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          <section
            data-region="reliefSummary"
            style={{
              background: "var(--lg-surface)",
              border: "1px solid var(--lg-outline-variant)",
              borderTop: "2px solid var(--lg-primary)",
              backgroundImage:
                "radial-gradient(circle at top left, rgba(46,91,255,0.14), transparent 32%), linear-gradient(180deg, rgba(17,19,23,0.98), rgba(17,19,23,0.98))",
              padding: 16,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
              <div className="lg-kicker" style={{ color: "#d7defe" }}>Projected Relief Summary</div>
              <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
                {selectedTimeBandLabel}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontSize: 48, lineHeight: "48px", fontWeight: 800, color: "var(--lg-primary)" }}>
                {projectedRelief}%
              </div>
              <div className="lg-subtitle">Est. congestion reduction</div>
            </div>
            <div
              style={{
                height: 8,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(184,195,255,0.12)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(10, projectedRelief)}%`,
                  height: "100%",
                  background: hasShortfall
                    ? "linear-gradient(90deg, #d71a18, #ff7b6d)"
                    : "linear-gradient(90deg, #2e5bff, #8aa0ff)",
                }}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                paddingTop: 12,
                borderTop: "1px solid var(--lg-outline-variant)",
              }}
            >
              <MetricTile label="Queue Targets" value={`${queueHotspots.length}/${Math.max(aggregatedResources.recommendedQueueSize, 1)}`} color="var(--lg-text)" />
              <MetricTile label="Critical Uncovered" value={String(criticalUncovered)} color="#ffb4aa" />
            </div>
            <div style={{ display: "grid", gap: 10, paddingTop: 12, borderTop: "1px solid var(--lg-outline-variant)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div className="lg-kicker">Resource Scope</div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    color: "var(--lg-text-muted)",
                  }}
                >
                  <Icon name="target" size={18} color="currentColor" />
                </span>
              </div>
              <div
                className="lg-mono"
                style={{
                  fontSize: 12,
                  lineHeight: "18px",
                  color: "var(--lg-text)",
                }}
              >
                Allocating from: <span style={{ color: "var(--lg-primary)" }}>{allocationScopeLabel}</span>
              </div>
              <div className="lg-subtitle" style={{ fontSize: 12, lineHeight: "17px" }}>
                Shift capacity for the selected station pool. Committed values below come only from plans you commit here.
              </div>
              <div style={{ borderTop: "1px solid var(--lg-outline-variant)" }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <ResourceTile
                  label="Officers"
                  icon="policy"
                  available={availableNow.officers}
                  committed={committedDemand.officers}
                  total={totalCapacity.officers}
                  postPlan={remainingAfterPlan.officers}
                />
                <ResourceTile
                  label="Patrol Cars"
                  icon="directions_car"
                  available={availableNow.patrol_cars}
                  committed={committedDemand.patrol_cars}
                  total={totalCapacity.patrol_cars}
                  postPlan={remainingAfterPlan.patrol_cars}
                />
                <ResourceTile
                  label="Tow Units"
                  icon="local_shipping"
                  available={availableNow.tow_trucks}
                  committed={committedDemand.tow_trucks}
                  total={totalCapacity.tow_trucks}
                  postPlan={remainingAfterPlan.tow_trucks}
                />
                <ResourceTile
                  label="Traffic Constables"
                  icon="groups"
                  available={availableNow.constables}
                  committed={committedDemand.constables}
                  total={totalCapacity.constables}
                  postPlan={remainingAfterPlan.constables}
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 12,
                  alignItems: "center",
                  border: "1px solid var(--lg-outline-variant)",
                  background: hasShortfall ? "rgba(147,0,10,0.26)" : "rgba(46,91,255,0.08)",
                  padding: "10px 12px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="lg-kicker" style={{ color: hasShortfall ? "#ffb4aa" : "var(--lg-primary)" }}>
                    Allocation Status
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                    {hasShortfall ? "Over capacity for selected shift" : "Queue fits current shift capacity"}
                  </div>
                </div>
                <div
                  className="lg-mono"
                  style={{
                    flex: "0 0 auto",
                    fontSize: 10,
                    lineHeight: "15px",
                    color: hasShortfall ? "#ffb4aa" : "var(--lg-text-muted)",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  Demand {formatPlannerDemand(queueDemand)}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 10, paddingTop: 12, borderTop: "1px solid var(--lg-outline-variant)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div className="lg-kicker">Already Committed</div>
                <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
                  {committedHotspots.length} committed
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {committedHotspots.length ? (
                  committedHotspots.map((hotspot, index) => (
                    <div
                      key={hotspot.cluster_id}
                      style={{
                        border: "1px solid var(--lg-outline-variant)",
                        background: "var(--lg-surface-container-low)",
                        padding: 10,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div className="lg-mono" style={{ fontSize: 12 }}>
                          {`${stationCode(hotspot.police_station)}-${shiftCode(planningShift)}-${String(index + 1).padStart(2, "0")}`}
                        </div>
                        <StatusPill tone="alert" label="Committed" />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>
                        {compactLocation(hotspot.location)}
                      </div>
                      <div className="lg-subtitle" style={{ fontSize: 12, lineHeight: "17px" }}>
                        {hotspot.recommendations.immediate[0] ?? "Deploy enforcement unit"}
                      </div>
                      <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
                        {formatPlannerDemand(plannerDemandForHotspot(hotspot))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      border: "1px dashed var(--lg-outline-variant)",
                      background: "rgba(255,255,255,0.02)",
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700 }}>No committed interventions yet</div>
                    <div className="lg-subtitle" style={{ marginTop: 4, fontSize: 12, lineHeight: "17px" }}>
                      Add hotspots from the table to the action queue, then use Commit Plan to move them here.
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(132px, auto)", gap: 10 }}>
              <button
                onClick={exportPlan}
                style={{
                  width: "100%",
                  border: `1px solid ${(queueHotspots.length || committedHotspots.length) ? "var(--lg-primary)" : "var(--lg-outline-variant)"}`,
                  background: (queueHotspots.length || committedHotspots.length) ? "var(--lg-primary-container)" : "rgba(255,255,255,0.04)",
                  color: (queueHotspots.length || committedHotspots.length) ? "#efefff" : "var(--lg-text-muted)",
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
                disabled={!queueHotspots.length && !committedHotspots.length}
              >
                Export Shift Plan
              </button>
              <button
                onClick={resetPlanner}
                style={{
                  width: "100%",
                  border: "1px solid var(--lg-outline-variant)",
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--lg-text)",
                  padding: "12px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Reset
              </button>
            </div>
            {lastExportedAt ? (
              <div className="lg-subtitle" style={{ fontSize: 12 }}>
                Last export generated at {lastExportedAt}.
              </div>
            ) : null}
          </section>

          {optimizedPlan ? (
            <AiQueueSection
              strategies={optimizedPlanState.data?.strategies ?? []}
              selectedStrategy={aiStrategy}
              onStrategyChange={setAiStrategy}
              plan={optimizedPlan}
              queuedIds={queuedIds}
              committedIds={committedIds}
              onLoadQueue={loadAiQueue}
            />
          ) : null}

          <section style={{ background: "var(--lg-surface)", border: "1px solid var(--lg-outline-variant)", overflow: "hidden" }}>
            <GeoMap
              points={buildHotspotPoints(queueHotspots, 18)}
              selectedId={queueHotspots[0]?.cluster_id ?? null}
              title="Queue Map"
              compact
              height={196}
              showSelectedOverlay={false}
            />
          </section>

          <section
            data-region="selectedActionQueue"
            style={{
              background: "var(--lg-surface)",
              border: "1px solid var(--lg-outline-variant)",
              display: "grid",
              gridTemplateRows: "auto minmax(0, 1fr) auto",
              minHeight: 360,
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                background: "var(--lg-surface-low)",
                borderBottom: "1px solid var(--lg-outline-variant)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>Action Queue</div>
              <span
                className="lg-mono"
                style={{
                  background: "var(--lg-primary-container)",
                  color: "#efefff",
                  padding: "4px 6px",
                  fontSize: 11,
                }}
              >
                {queueHotspots.length} Pending
              </span>
            </div>
            <div style={{ padding: 12, display: "grid", gap: 10, overflowY: "auto" }}>
              {queueHotspots.length ? (
                queueHotspots.map((hotspot) => (
                  <div
                    key={hotspot.cluster_id}
                    style={{
                      background: "var(--lg-surface-container)",
                      border: "1px solid var(--lg-outline-variant)",
                      padding: 12,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div className="lg-mono" style={{ color: "var(--lg-primary)" }}>
                        {hotspot.police_station} {"->"} {compactLocation(hotspot.location)}
                      </div>
                      <Icon name="schedule" size={16} color="var(--lg-outline)" />
                    </div>
                    <div className="lg-subtitle">
                      {hotspot.recommendations.immediate[0] ?? "Deploy enforcement unit"}
                    </div>
                    <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
                      {formatPlannerDemand(plannerDemandForHotspot(hotspot))}
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    border: "1px dashed var(--lg-outline-variant)",
                    background: "rgba(255,255,255,0.02)",
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>No queued interventions</div>
                  <div className="lg-subtitle" style={{ marginTop: 4, fontSize: 12, lineHeight: "17px" }}>
                    Use the + control in the hotspot table to build a fresh queue for this shift.
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: 16, borderTop: "1px solid var(--lg-outline-variant)", background: "var(--lg-surface-lowest)" }}>
              <button
                onClick={commitPlan}
                style={{
                  width: "100%",
                  border: `1px solid ${queueHotspots.length ? "var(--lg-primary)" : "var(--lg-outline-variant)"}`,
                  background: queueHotspots.length ? "var(--lg-primary-container)" : "rgba(255,255,255,0.04)",
                  color: queueHotspots.length ? "#efefff" : "var(--lg-text-muted)",
                  padding: "12px 16px",
                  fontSize: 18,
                  fontWeight: 700,
                }}
                disabled={!queueHotspots.length}
              >
                Commit Plan
              </button>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function uniqueStations(hotspots: HotspotRecord[]) {
  return Array.from(new Set(hotspots.map((item) => item.police_station))).sort((a, b) => a.localeCompare(b));
}

function readPlannerTimeBand(value: string | null): PlannerTimeBand {
  if (value === "peak" || value === "morning" || value === "midday" || value === "evening" || value === "overnight") {
    return value;
  }
  if (value === "Morning") {
    return "morning";
  }
  if (value === "Afternoon") {
    return "midday";
  }
  if (value === "Night") {
    return "evening";
  }
  return "morning";
}

function plannerTimeBandToShift(timeBand: PlannerTimeBand): (typeof shiftOptions)[number] {
  if (timeBand === "morning") {
    return "Morning";
  }
  if (timeBand === "midday") {
    return "Afternoon";
  }
  return "Night";
}

function resolvePlannerShift(
  timeBand: PlannerTimeBand,
  plans: OptimizedShiftPlan[],
  stationFilter: string,
  aiStrategy: OptimizerStrategy,
): (typeof shiftOptions)[number] {
  if (timeBand !== "peak") {
    return plannerTimeBandToShift(timeBand);
  }

  const relevantPlans = plans.filter((plan) => plan.station_filter === stationFilter && plan.strategy === aiStrategy);
  const peakPlan = relevantPlans.sort((left, right) => {
    const riskDelta = (right.recommended_items[0]?.predicted_risk_score ?? 0) - (left.recommended_items[0]?.predicted_risk_score ?? 0);
    if (riskDelta !== 0) {
      return riskDelta;
    }
    const reliefDelta = right.projected_relief - left.projected_relief;
    if (reliefDelta !== 0) {
      return reliefDelta;
    }
    return right.impact_confidence_score - left.impact_confidence_score;
  })[0];

  return peakPlan?.shift ?? "Morning";
}

function compactLocation(location: string) {
  return location.split(",")[0]?.trim() || location;
}

function stationCode(station: string) {
  return station
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3) || "OPS";
}

function shiftCode(shift: (typeof shiftOptions)[number]) {
  if (shift === "Morning") {
    return "MO";
  }
  if (shift === "Afternoon") {
    return "AF";
  }
  return "NI";
}

function severityPresentation(band: HotspotRecord["severity_band"]) {
  if (band === "critical") {
    return { bg: "#93000a", textColor: "#ffdad6", border: "#d71a18", dot: "#ffb4aa" };
  }
  if (band === "high") {
    return { bg: "#ffb211", textColor: "#432c00", border: "#ffb211", dot: "#ffd79b" };
  }
  return { bg: "#333539", textColor: "#c4c5d9", border: "#434656", dot: "#b8c3ff" };
}

function cellStyle(align: "left" | "right" | "center" = "left", color = "var(--lg-text)") {
  return {
    padding: "12px 12px",
    borderBottom: "1px solid rgba(67,70,86,0.45)",
    textAlign: align,
    color,
    verticalAlign: "top" as const,
  };
}

function MetricTile(props: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="lg-mono" style={{ fontSize: 16, color: props.color }}>
        {props.value}
      </div>
      <div className="lg-kicker" style={{ marginTop: 4 }}>
        {props.label}
      </div>
    </div>
  );
}

function ResourceTile(props: {
  label: string;
  icon: string;
  available: number;
  committed: number;
  total: number;
  postPlan: number;
}) {
  const alert = props.available <= 0 || props.postPlan < 0;
  const labelColor = alert ? "#ff9d8e" : "var(--lg-text)";
  const valueColor = alert ? "#ffb4aa" : "var(--lg-primary)";
  const progressWidth = Math.min(100, Math.max(0, (props.available / Math.max(1, props.total)) * 100));

  return (
    <div
      style={{
        border: `1px solid ${alert ? "rgba(215,26,24,0.82)" : "var(--lg-outline-variant)"}`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
        padding: "10px 12px 12px",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <Icon name={props.icon} size={13} color={labelColor} />
          <div
            className="lg-kicker"
            style={{
              color: labelColor,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {props.label}
            {alert && props.label === "Tow Units" ? <Icon name="warning" size={12} color={labelColor} /> : null}
          </div>
        </div>
        <div className="lg-mono" style={{ fontSize: 14, color: "var(--lg-text)", whiteSpace: "nowrap" }}>
          <span style={{ color: valueColor, fontWeight: 700 }}>{props.available}</span>
          <span style={{ color: "var(--lg-text-muted)" }}> / {props.total}</span>
        </div>
      </div>
      <div
        style={{
          height: 6,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progressWidth}%`,
            height: "100%",
            borderRadius: 999,
            background: alert ? "#d71a18" : "#2e5bff",
          }}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
          paddingTop: 4,
        }}
      >
        <div style={{ display: "grid", gap: 2 }}>
          <div className="lg-kicker" style={{ fontSize: 10, lineHeight: "12px", color: "var(--lg-text-muted)" }}>
            Committed
          </div>
          <div className="lg-mono" style={{ fontSize: 13, color: "var(--lg-text)" }}>
            {props.committed}
          </div>
        </div>
        <div style={{ display: "grid", gap: 2 }}>
          <div className="lg-kicker" style={{ fontSize: 10, lineHeight: "12px", color: "var(--lg-text-muted)" }}>
            Remaining
          </div>
          <div className="lg-mono" style={{ fontSize: 13, color: alert ? "#ffb4aa" : "var(--lg-text)" }}>
            {props.postPlan}
          </div>
        </div>
      </div>
    </div>
  );
}

function AiQueueSection(props: {
  strategies: OptimizedShiftPlanArtifact["strategies"];
  selectedStrategy: OptimizerStrategy;
  onStrategyChange: (strategy: OptimizerStrategy) => void;
  plan: OptimizedShiftPlan;
  queuedIds: string[];
  committedIds: string[];
  onLoadQueue: () => void;
}) {
  const queuedSet = new Set(props.queuedIds);
  const committedSet = new Set(props.committedIds);

  return (
    <section
      style={{
        background: "var(--lg-surface)",
        border: "1px solid var(--lg-outline-variant)",
        padding: 14,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div className="lg-kicker" style={{ color: "var(--lg-primary)" }}>
            AI Suggested Queue
          </div>
          <div className="lg-subtitle" style={{ marginBottom: 0, fontSize: 12, lineHeight: "17px" }}>
            {props.plan.strategy_note}
          </div>
        </div>
        <button
          onClick={props.onLoadQueue}
          style={{
            border: `1px solid ${props.plan.recommended_items.length ? "var(--lg-primary)" : "var(--lg-outline-variant)"}`,
            background: props.plan.recommended_items.length ? "var(--lg-primary-container)" : "rgba(255,255,255,0.04)",
            color: props.plan.recommended_items.length ? "#efefff" : "var(--lg-text-muted)",
            padding: "8px 10px",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
          disabled={!props.plan.recommended_items.length}
        >
          Load AI Queue
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {props.strategies.map((strategy) => (
          <button
            key={strategy.id}
            onClick={() => props.onStrategyChange(strategy.id)}
            style={{
              border: `1px solid ${props.selectedStrategy === strategy.id ? "var(--lg-primary)" : "var(--lg-outline-variant)"}`,
              background: props.selectedStrategy === strategy.id ? "rgba(46,91,255,0.12)" : "rgba(255,255,255,0.03)",
              color: props.selectedStrategy === strategy.id ? "var(--lg-primary)" : "var(--lg-text-muted)",
              padding: "8px 10px",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {strategy.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <MetricTile label="Targets" value={String(props.plan.recommended_items.length)} color="var(--lg-text)" />
        <MetricTile label="Relief" value={`${props.plan.projected_relief}%`} color="var(--lg-primary)" />
        <MetricTile
          label="Capacity"
          value={props.plan.fits_capacity ? "Fit" : "Tight"}
          color={props.plan.fits_capacity ? "var(--lg-secondary)" : "#ffb4aa"}
        />
      </div>

      <div
        style={{
          border: "1px solid var(--lg-outline-variant)",
          background: "var(--lg-surface-container-low)",
          padding: 10,
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="lg-kicker">Relief Confidence</div>
          <span
            className="lg-mono"
            style={{
              fontSize: 11,
              color:
                props.plan.impact_confidence === "high"
                  ? "var(--lg-primary)"
                  : props.plan.impact_confidence === "medium"
                    ? "var(--lg-secondary)"
                    : "#ffb4aa",
              textTransform: "uppercase",
            }}
          >
            {props.plan.impact_confidence} confidence
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            Likely relief range {props.plan.projected_relief_range.low}% to {props.plan.projected_relief_range.high}%
          </div>
          <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
            score {Math.round(props.plan.impact_confidence_score * 100)} / 100
          </div>
        </div>
        <div className="lg-subtitle" style={{ marginBottom: 0, fontSize: 12, lineHeight: "17px" }}>
          {props.plan.confidence_note}
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {props.plan.recommended_items.slice(0, 3).map((item) => {
          const status = committedSet.has(item.cluster_id)
            ? { label: "Committed", color: "#ffb4aa" }
            : queuedSet.has(item.cluster_id)
              ? { label: "Queued", color: "var(--lg-primary)" }
              : { label: "Suggested", color: "var(--lg-text-muted)" };

          return (
            <div
              key={item.cluster_id}
              style={{
                border: "1px solid var(--lg-outline-variant)",
                background: "var(--lg-surface-container-low)",
                padding: 10,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{compactLocation(item.location)}</div>
                <div className="lg-mono" style={{ fontSize: 11, color: status.color }}>
                  {status.label}
                </div>
              </div>
              <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
                Score {Math.round(item.optimized_score)} | {item.police_station}
              </div>
              <div className="lg-subtitle" style={{ fontSize: 12, lineHeight: "17px", marginBottom: 0 }}>
                {item.rationale.map(formatAiRationale).join(" | ")}
              </div>
              <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
                {formatAiDemand(item.demand)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatAiDemand(demand: OptimizedShiftPlan["demand"]) {
  return `${demand.officers} OFF | ${demand.patrol_cars} CAR | ${demand.tow_trucks} TOW | ${demand.constables} TC`;
}

function formatAiRationale(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function StatusPill(props: { tone: "alert" | "muted"; label: string }) {
  const colors =
    props.tone === "alert"
      ? { bg: "rgba(215,26,24,0.16)", border: "#d71a18", color: "#ffdad6" }
      : { bg: "rgba(255,255,255,0.04)", border: "var(--lg-outline-variant)", color: "var(--lg-text-muted)" };

  return (
    <span
      className="lg-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.color,
        padding: "4px 6px",
        fontSize: 10,
        textTransform: "uppercase",
      }}
    >
      {props.label}
    </span>
  );
}
