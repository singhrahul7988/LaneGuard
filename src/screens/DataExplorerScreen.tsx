import { useDeferredValue, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppHeader, buildCriticalMapRoute } from "../components/AppHeader";
import { GeoMap } from "../components/map/GeoMap";
import { Icon } from "../components/Icon";
import { stitchScreens } from "../lib/stitchScreens";
import { type ParkingRecord, useProcessedJson } from "../lib/data";
import { downloadTextFile } from "../lib/dashboard";

const screen = stitchScreens.find((item) => item.id === "data-explorer")!;

export function DataExplorerScreen() {
  const recordsState = useProcessedJson<ParkingRecord[]>("/data/processed/parking_records.json");
  const records = recordsState.data ?? [];
  const [searchParams] = useSearchParams();
  const initialStation = searchParams.get("station") ?? "ALL_STATIONS";
  const initialQuery = searchParams.get("query") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [stationFilter, setStationFilter] = useState(initialStation);
  const [classificationFilter, setClassificationFilter] = useState("ALL_TYPES");
  const [severityFilter, setSeverityFilter] = useState("ALL_LEVELS");
  const [peakFilter, setPeakFilter] = useState("ANY_WINDOW");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query);

  const stationOptions = ["ALL_STATIONS", ...uniqueValues(records.map((record) => record.police_station))];
  const classificationOptions = ["ALL_TYPES", ...topLabels(records)];
  const filteredRecords = records.filter((record) => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const severity = severityLabel(record);
    const queryMatches =
      !normalizedQuery ||
      record.id.toLowerCase().includes(normalizedQuery) ||
      record.location.toLowerCase().includes(normalizedQuery) ||
      record.police_station.toLowerCase().includes(normalizedQuery) ||
      record.parking_labels.some((label) => label.toLowerCase().includes(normalizedQuery));
    const stationMatches = stationFilter === "ALL_STATIONS" || record.police_station === stationFilter;
    const classMatches =
      classificationFilter === "ALL_TYPES" || record.parking_labels.includes(classificationFilter);
    const severityMatches = severityFilter === "ALL_LEVELS" || severity === severityFilter;
    const peakMatches =
      peakFilter === "ANY_WINDOW" ||
      (peakFilter === "PEAK_ONLY" && record.is_peak_hour) ||
      (peakFilter === "OFF_PEAK" && !record.is_peak_hour);
    return queryMatches && stationMatches && classMatches && severityMatches && peakMatches;
  });
  const visibleRecords = filteredRecords.slice(0, 24);
  const selectedRecord = filteredRecords.find((record) => record.id === selectedId) ?? filteredRecords[0] ?? null;

  function issueCitation() {
    if (!selectedRecord) {
      return;
    }

    const payload = [
      "LaneGuard Citation Draft",
      `Record: ${selectedRecord.id}`,
      `Station: ${selectedRecord.police_station}`,
      `Location: ${selectedRecord.location}`,
      `Timestamp: ${selectedRecord.event_ts}`,
      `Violations: ${selectedRecord.parking_labels.join(", ")}`,
    ].join("\n");
    downloadTextFile(`citation-${selectedRecord.id}.txt`, payload);
  }

  function toggleManualReview() {
    if (!selectedRecord) {
      return;
    }
    setReviewIds((current) =>
      current.includes(selectedRecord.id)
        ? current.filter((id) => id !== selectedRecord.id)
        : [...current, selectedRecord.id],
    );
  }

  return (
    <div className="lg-app" style={{ minHeight: "100vh", overflow: "hidden" }} data-screen-id={screen.id}>
      <AppHeader
        active="Stations"
        actions={
          <>
            <div className="lg-header-chip">Data Explorer</div>
            <Link
              to={buildCriticalMapRoute(selectedRecord?.police_station ?? stationFilter)}
              className="lg-header-alert"
            >
              Emergency Alert
            </Link>
          </>
        }
      />

      <main
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 380px",
          overflow: "hidden",
          minHeight: "calc(100vh - 68px)",
        }}
      >
        <section
          style={{
            display: "grid",
            gridTemplateRows: "auto auto minmax(0, 1fr)",
            padding: 12,
            borderRight: "1px solid var(--lg-outline-variant)",
            minWidth: 0,
          }}
        >
          <section
            data-region="searchBar"
            style={{
              border: "1px solid var(--lg-outline-variant)",
              background: "var(--lg-surface-low)",
              padding: 12,
              marginBottom: 12,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div className="lg-kicker" style={{ color: "var(--lg-text)" }}>
                Query Parameters
              </div>
              <button
                onClick={() => {
                  setQuery("");
                  setStationFilter("ALL_STATIONS");
                  setClassificationFilter("ALL_TYPES");
                  setSeverityFilter("ALL_LEVELS");
                  setPeakFilter("ANY_WINDOW");
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--lg-primary)",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                Clear Filters
              </button>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid var(--lg-outline-variant)",
                background: "var(--lg-surface-container)",
                padding: "10px 12px",
              }}
            >
              <Icon name="search" size={16} color="var(--lg-text-muted)" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search record, station, location, or violation"
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "var(--lg-text)",
                  fontFamily: "var(--lg-font-mono)",
                  fontSize: 12,
                }}
              />
            </label>
          </section>

          <section
            data-region="filters"
            style={{
              border: "1px solid var(--lg-outline-variant)",
              background: "var(--lg-surface-low)",
              padding: 12,
              marginBottom: 12,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 16,
            }}
          >
            <FilterSelect label="Station ID" value={stationFilter} options={stationOptions} onChange={setStationFilter} />
            <FilterSelect label="Classification" value={classificationFilter} options={classificationOptions} onChange={setClassificationFilter} />
            <FilterSelect label="Severity" value={severityFilter} options={["ALL_LEVELS", "High", "Med", "Low"]} onChange={setSeverityFilter} />
            <FilterSelect label="Timeframe" value={peakFilter} options={["ANY_WINDOW", "PEAK_ONLY", "OFF_PEAK"]} onChange={setPeakFilter} />
          </section>

          <section
            data-region="recordsTable"
            style={{
              border: "1px solid var(--lg-outline-variant)",
              background: "var(--lg-surface-lowest)",
              overflow: "hidden",
              display: "grid",
              gridTemplateRows: "auto minmax(0, 1fr) auto",
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 2fr 2fr 3fr 1fr 2fr",
                gap: 8,
                padding: "10px 16px",
                borderBottom: "1px solid var(--lg-outline-variant)",
                background: "var(--lg-surface-high)",
              }}
            >
              {["Record ID", "Timestamp", "Station", "Violation Type", "Severity", "Status"].map((label, index) => (
                <div key={label} className="lg-kicker" style={{ textAlign: index >= 4 ? "center" : "left" }}>
                  {label}
                </div>
              ))}
            </div>
            <div style={{ overflowY: "auto" }}>
              {visibleRecords.map((record) => {
                const selected = selectedRecord?.id === record.id;
                const severity = severityLabel(record);
                const status = reviewIds.includes(record.id) ? "Review" : recordStatus(record);
                return (
                  <button
                    key={record.id}
                    onClick={() => setSelectedId(record.id)}
                    style={{
                      width: "100%",
                      border: "none",
                      background: selected ? "rgba(46,91,255,0.1)" : "transparent",
                      borderLeft: selected ? "2px solid var(--lg-primary)" : "2px solid transparent",
                      borderBottom: "1px solid rgba(67,70,86,0.25)",
                      padding: "10px 16px",
                      display: "grid",
                      gridTemplateColumns: "2fr 2fr 2fr 3fr 1fr 2fr",
                      gap: 8,
                      textAlign: "left",
                      color: "var(--lg-text)",
                      cursor: "pointer",
                    }}
                  >
                    <div className="lg-mono" style={{ fontSize: 12, color: selected ? "var(--lg-primary)" : "var(--lg-text)" }}>
                      {record.id}
                    </div>
                    <div className="lg-mono" style={{ fontSize: 12 }}>{formatTimestamp(record.event_ts)}</div>
                    <div className="lg-mono" style={{ fontSize: 12, color: "var(--lg-text-muted)" }}>{record.police_station}</div>
                    <div className="lg-mono" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {record.parking_labels.join(", ")}
                    </div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Tag label={severity} tone={severityTone(severity)} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Tag label={status} tone={statusTone(status)} />
                    </div>
                  </button>
                );
              })}
            </div>
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid var(--lg-outline-variant)",
                background: "var(--lg-surface-low)",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div className="lg-mono" style={{ fontSize: 11, color: "var(--lg-text-muted)" }}>
                SHOWING {visibleRecords.length ? 1 : 0}-{visibleRecords.length} OF {filteredRecords.length.toLocaleString("en-IN")} RECORDS
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["chevron_left", "chevron_right"].map((icon) => (
                  <button
                    key={icon}
                    style={{
                      width: 28,
                      height: 28,
                      border: "1px solid var(--lg-outline-variant)",
                      background: "var(--lg-surface-container)",
                      color: "var(--lg-text)",
                    }}
                  >
                    <Icon name={icon} size={14} color="var(--lg-text)" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        </section>

        <aside
          style={{
            background: "var(--lg-surface-container)",
            display: "grid",
            gridTemplateRows: "auto auto minmax(0, 1fr)",
            overflow: "hidden",
          }}
        >
          <section
            data-region="recordInspector"
            style={{
              padding: 16,
              borderBottom: "1px solid var(--lg-outline-variant)",
              background: "var(--lg-surface-high)",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "start",
            }}
          >
            <div>
              <div className="lg-kicker">Record Preview</div>
              <div className="lg-mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--lg-primary)", marginTop: 6 }}>
                {selectedRecord?.id ?? "NO_RECORD"}
              </div>
            </div>
            {selectedRecord ? (
              <Tag
                label={reviewIds.includes(selectedRecord.id) ? "Review" : recordStatus(selectedRecord)}
                tone={statusTone(reviewIds.includes(selectedRecord.id) ? "Review" : recordStatus(selectedRecord))}
              />
            ) : null}
          </section>

          <section
            data-region="mapPreview"
            style={{ padding: 16, borderBottom: "1px solid var(--lg-outline-variant)", display: "grid", gap: 10 }}
          >
            <div className="lg-kicker" style={{ color: "var(--lg-text)" }}>
              Geospatial Context
            </div>
            <GeoMap
              points={
                selectedRecord
                  ? [
                      {
                        id: selectedRecord.id,
                        label: selectedRecord.location.split(",")[0],
                        latitude: selectedRecord.latitude,
                        longitude: selectedRecord.longitude,
                        severity:
                          severityLabel(selectedRecord) === "High"
                            ? "critical"
                            : severityLabel(selectedRecord) === "Med"
                              ? "high"
                              : "moderate",
                        weight: 72,
                        meta: `${selectedRecord.police_station} - ${selectedRecord.parking_labels.join(", ")}`,
                      },
                    ]
                  : []
              }
              selectedId={selectedRecord?.id ?? null}
              compact
              title={selectedRecord ? "Selected record" : "No record"}
              subtitle={
                selectedRecord
                  ? `Lat ${selectedRecord.latitude.toFixed(4)} - Lng ${selectedRecord.longitude.toFixed(4)}`
                  : undefined
              }
              height={220}
            />
          </section>

          <section style={{ padding: 16, overflowY: "auto", display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div className="lg-kicker" style={{ color: "var(--lg-text)" }}>
                Telemetry Data
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <MetaPair label="Timestamp (UTC)" value={selectedRecord?.event_ts ?? "--"} />
                <MetaPair label="Police Station" value={selectedRecord?.police_station ?? "--"} />
                <MetaPair label="Vehicle Class" value={selectedRecord?.vehicle_type ?? "--"} />
                <MetaPair label="Peak Window" value={selectedRecord ? (selectedRecord.is_peak_hour ? "TRUE" : "FALSE") : "--"} />
                <MetaPair label="Junction" value={selectedRecord?.junction_name ?? "--"} span={2} />
                <MetaPair label="Violation Labels" value={selectedRecord?.parking_labels.join(", ") ?? "--"} span={2} />
                <MetaPair label="Location" value={selectedRecord?.location ?? "--"} span={2} />
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div className="lg-kicker" style={{ color: "var(--lg-text)" }}>
                Action Panel
              </div>
              <button
                onClick={issueCitation}
                style={{
                  width: "100%",
                  border: "1px solid var(--lg-primary)",
                  background: "var(--lg-primary-container)",
                  color: "#efefff",
                  padding: "12px 16px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Issue Citation
              </button>
              <button
                onClick={toggleManualReview}
                style={{
                  width: "100%",
                  border: "1px solid var(--lg-outline)",
                  background: "transparent",
                  color: "var(--lg-text)",
                  padding: "12px 16px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {selectedRecord && reviewIds.includes(selectedRecord.id) ? "Remove Review Flag" : "Flag For Manual Review"}
              </button>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function topLabels(records: ParkingRecord[]) {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const label of record.parking_labels) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([label]) => label);
}

function severityLabel(record: ParkingRecord) {
  if (
    record.parking_labels.some((label) =>
      ["DOUBLE PARKING", "PARKING IN A MAIN ROAD", "PARKING NEAR ROAD CROSSING"].includes(label),
    )
  ) {
    return "High";
  }
  if (record.parking_labels.length >= 2 || record.is_peak_hour) {
    return "Med";
  }
  return "Low";
}

function recordStatus(record: ParkingRecord) {
  if (record.is_peak_hour && record.parking_labels.length >= 2) return "Verified";
  if (record.parking_labels.length >= 2) return "Pending";
  return "Actioned";
}

function statusTone(status: string) {
  if (status === "Verified") return { bg: "rgba(18,74,240,0.12)", border: "#124af0", color: "#b8c3ff" };
  if (status === "Pending") return { bg: "rgba(255,178,17,0.12)", border: "#ffb211", color: "#ffd79b" };
  if (status === "Review") return { bg: "rgba(255,180,171,0.12)", border: "#d71a18", color: "#ffb4aa" };
  return { bg: "rgba(51,53,57,0.75)", border: "#434656", color: "#c4c5d9" };
}

function severityTone(severity: string) {
  if (severity === "High") return { bg: "#93000a", border: "#d71a18", color: "#ffdad6" };
  if (severity === "Med") return { bg: "rgba(255,178,17,0.18)", border: "#ffb211", color: "#ffd79b" };
  return { bg: "rgba(51,53,57,0.75)", border: "#434656", color: "#c4c5d9" };
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

function FilterSelect(props: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span className="lg-mono" style={{ fontSize: 10, color: "var(--lg-text-muted)" }}>
        {props.label.toUpperCase()}
      </span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        style={{
          border: "1px solid var(--lg-outline-variant)",
          background: "var(--lg-surface-container)",
          color: "var(--lg-text)",
          padding: "8px 10px",
          fontFamily: "var(--lg-font-mono)",
          fontSize: 12,
        }}
      >
        {props.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Tag(props: { label: string; tone: { bg: string; border: string; color: string } }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${props.tone.border}`,
        background: props.tone.bg,
        color: props.tone.color,
        padding: "4px 8px",
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}
    >
      {props.label}
    </span>
  );
}

function MetaPair(props: { label: string; value: string; span?: 1 | 2 }) {
  return (
    <div style={{ display: "grid", gap: 4, gridColumn: props.span === 2 ? "span 2" : undefined }}>
      <span className="lg-kicker">{props.label}</span>
      <span className="lg-mono" style={{ fontSize: 12, color: "var(--lg-text)" }}>
        {props.value}
      </span>
    </div>
  );
}
