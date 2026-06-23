import { Link } from "react-router-dom";
import { GeoMap } from "../components/map/GeoMap";
import { Icon } from "../components/Icon";
import { type BriefSummary, type StationSummary, useProcessedJson } from "../lib/data";
import { buildHotspotPoints } from "../lib/dashboard";
import { screenRoute } from "../lib/routes";

const quickRoutes = [
  { label: "Command Center", route: screenRoute("command-center"), icon: "map" },
  { label: "Planner", route: screenRoute("enforcement-planner"), icon: "security_update_warning" },
  { label: "Policy", route: screenRoute("policy-recommendations"), icon: "policy" },
  { label: "Analytics", route: screenRoute("station-analytics"), icon: "analytics" },
];

export function HomeScreen() {
  const brief = useProcessedJson<BriefSummary>("/data/processed/brief_summary.json");
  const stations = useProcessedJson<StationSummary[]>("/data/processed/station_summary.json");
  const topHotspots = brief.data?.top_hotspots ?? [];
  const leadStations = (stations.data ?? []).slice(0, 4);
  const mapPoints = buildHotspotPoints(topHotspots, 18);

  return (
    <div className="lg-app" style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ display: "grid", gap: 16 }}>
        <section
          className="lg-panel"
          style={{
            padding: 24,
            background:
              "radial-gradient(circle at top left, rgba(46,91,255,0.24), transparent 24%), linear-gradient(135deg, rgba(12,14,18,0.96), rgba(17,19,23,0.98))",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.15fr) minmax(340px, 0.85fr)",
              gap: 20,
            }}
          >
            <div style={{ display: "grid", gap: 18 }}>
              <div className="lg-kicker" style={{ color: "var(--lg-primary)" }}>
                LaneGuard - Bengaluru Traffic Police
              </div>
              <div style={{ maxWidth: 760 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 48,
                    lineHeight: "52px",
                    letterSpacing: "-0.04em",
                    fontWeight: 900,
                  }}
                >
                  Parking-pressure command system for fast corridor intervention.
                </h1>
                <p className="lg-subtitle" style={{ fontSize: 17, lineHeight: "26px", margin: "14px 0 0" }}>
                  Turn parking-pressure history into next-shift hotspot forecasts, shift-ready intervention plans,
                  station pressure diagnostics, and concise command briefings.
                </p>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link
                  to={screenRoute("command-center")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    background: "var(--lg-primary-container)",
                    color: "#f5f7ff",
                    border: "1px solid var(--lg-primary)",
                    padding: "14px 18px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  <Icon name="map" size={16} color="#f5f7ff" />
                  Open Command Center
                </Link>
                <Link
                  to={screenRoute("daily-brief")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    border: "1px solid var(--lg-outline-variant)",
                    background: "rgba(255,255,255,0.02)",
                    padding: "14px 18px",
                    fontWeight: 700,
                  }}
                >
                  <Icon name="open_in_new" size={14} color="var(--lg-text)" />
                  Open Daily Brief
                </Link>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                <MetricBlock
                  label="Tracked Violations"
                  value={brief.data?.total_parking_records.toLocaleString("en-IN") ?? "--"}
                  note="observed parking incidents in scope"
                  accent="var(--lg-primary)"
                />
                <MetricBlock
                  label="Active Hotspots"
                  value={brief.data?.total_hotspots.toLocaleString("en-IN") ?? "--"}
                  note="clustered enforcement targets"
                  accent="#ffb4aa"
                />
                <MetricBlock
                  label="Lead Station"
                  value={brief.data?.top_station ?? "--"}
                  note="highest parking pressure"
                  accent="var(--lg-secondary)"
                />
                <MetricBlock
                  label="Peak Window"
                  value={
                    brief.data?.peak_hour !== undefined && brief.data?.peak_hour !== null
                      ? `${String(brief.data.peak_hour).padStart(2, "0")}:00`
                      : "--"
                  }
                  note="current modeled surge"
                  accent="#7bc4ff"
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <GeoMap
                points={mapPoints}
                title="Top Intervention Footprint"
                subtitle="Zoom to inspect hotspot clusters"
                height={360}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <InfoStrip
                  title="Immediate Action"
                  text={
                    topHotspots[0]?.recommendations.immediate[0] ??
                    "Tow-priority enforcement deployment"
                  }
                />
                <InfoStrip
                  title="Review Angle"
                  text="Map-first evidence, ranked hotspots, and clear station accountability."
                />
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.08fr) minmax(320px, 0.92fr)",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          <section className="lg-panel" style={{ padding: 18, display: "grid", alignContent: "start" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div className="lg-kicker">Mission Modules</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>
                  Launch any operational surface
                </div>
              </div>
              <div className="lg-chip lg-live-chip">
                <span className="lg-live-dot" aria-hidden="true" />
                5 mission modules
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 12,
                marginTop: 18,
              }}
            >
              {quickRoutes.map((item) => (
                <Link
                  key={item.label}
                  to={item.route}
                  style={{
                    display: "grid",
                    gap: 8,
                    border: "1px solid var(--lg-outline-variant)",
                    background: "var(--lg-surface)",
                    padding: 16,
                    alignContent: "start",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Icon name={item.icon} size={18} color="var(--lg-primary)" />
                    <Icon name="open_in_new" size={12} color="var(--lg-text-muted)" />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{item.label}</div>
                  <div className="lg-subtitle">{moduleDescription(item.label)}</div>
                </Link>
              ))}
            </div>
          </section>

          <section className="lg-panel" style={{ padding: 18, display: "grid", alignContent: "start" }}>
            <div className="lg-kicker">Priority Stations</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, marginBottom: 14 }}>
              Highest pressure jurisdictions
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {leadStations.map((station, index) => (
                <Link
                  key={station.station}
                  to={`${screenRoute("command-center")}?station=${encodeURIComponent(station.station)}`}
                  style={{
                    display: "grid",
                    gap: 6,
                    border: "1px solid var(--lg-outline-variant)",
                    background: "var(--lg-surface)",
                    padding: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 700 }}>
                      {index + 1}. {station.station}
                    </div>
                    <div
                      className="lg-mono"
                      style={{ color: index === 0 ? "#ffb4aa" : "var(--lg-primary)" }}
                    >
                      {station.record_count.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="lg-subtitle">
                    {station.hotspot_count} active hotspot clusters - latest{" "}
                    {formatTimestamp(station.latest_event)}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}

function MetricBlock(props: { label: string; value: string; note: string; accent: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(184,195,255,0.16)",
        background: "rgba(255,255,255,0.02)",
        padding: 14,
        display: "grid",
        gap: 6,
      }}
    >
      <div className="lg-kicker">{props.label}</div>
      <div style={{ fontSize: 28, lineHeight: "30px", fontWeight: 800, color: props.accent }}>
        {props.value}
      </div>
      <div className="lg-subtitle" style={{ fontSize: 12 }}>
        {props.note}
      </div>
    </div>
  );
}

function InfoStrip(props: { title: string; text: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--lg-outline-variant)",
        background: "var(--lg-surface)",
        padding: 14,
        display: "grid",
        gap: 6,
      }}
    >
      <div className="lg-kicker">{props.title}</div>
      <div className="lg-subtitle" style={{ color: "var(--lg-text)" }}>
        {props.text}
      </div>
    </div>
  );
}

function moduleDescription(label: string) {
  if (label === "Command Center") return "Map the predicted hotspots, filters, and ranked intervention queue.";
  if (label === "Planner") return "Build a shift-ready action list from forecast-backed corridors.";
  if (label === "Policy") return "Review explainable intervention recommendations.";
  return "Compare stations and inspect forecast quality and pressure trends.";
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
