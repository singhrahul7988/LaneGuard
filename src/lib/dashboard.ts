import type {
  HotspotRecord,
  ParkingRecord,
  StationResource,
  StationResourceShift,
  StationSummary,
} from "./data";

export const timeBandOptions = [
  { value: "all", label: "All Day" },
  { value: "peak", label: "Peak Window" },
  { value: "morning", label: "Morning 06:00-11:00" },
  { value: "midday", label: "Midday 11:00-16:00" },
  { value: "evening", label: "Evening 16:00-21:00" },
  { value: "overnight", label: "Overnight 21:00-06:00" },
] as const;

export type TimeBand = (typeof timeBandOptions)[number]["value"];
export type SeverityFilter = "all" | HotspotRecord["severity_band"];

export type DashboardFilters = {
  query: string;
  station: string;
  violation: string;
  severity: SeverityFilter;
  timeBand: TimeBand;
};

export type HotspotPoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  severity: HotspotRecord["severity_band"] | "info";
  weight: number;
  meta?: string;
};

type ClusterAnalytics = {
  records: ParkingRecord[];
  hourlyCounts: number[];
  weekdayCounts: Map<string, number>;
  labelCounts: Map<string, number>;
  latestEvent: string;
  peakCount: number;
};

type StationAnalytics = {
  hourlyCounts: number[];
  weekdayCounts: Map<string, number>;
  clusterIds: Set<string>;
};

export type RecordAnalytics = {
  clusterIndex: Map<string, ClusterAnalytics>;
  stationIndex: Map<string, StationAnalytics>;
  violationOptions: string[];
};

export type PlannerResourceDemand = {
  officers: number;
  patrol_cars: number;
  tow_trucks: number;
  constables: number;
};

const analyticsCache = new WeakMap<ParkingRecord[], RecordAnalytics>();

export function buildRecordAnalytics(records: ParkingRecord[]): RecordAnalytics {
  const cached = analyticsCache.get(records);
  if (cached) {
    return cached;
  }

  const clusterIndex = new Map<string, ClusterAnalytics>();
  const stationIndex = new Map<string, StationAnalytics>();
  const globalLabels = new Map<string, number>();

  for (const record of records) {
    const clusterEntry = getOrCreateClusterAnalytics(clusterIndex, record.cluster_id);
    clusterEntry.records.push(record);
    clusterEntry.hourlyCounts[record.event_hour] += 1;
    clusterEntry.weekdayCounts.set(record.weekday, (clusterEntry.weekdayCounts.get(record.weekday) ?? 0) + 1);
    if (record.is_peak_hour) {
      clusterEntry.peakCount += 1;
    }
    if (!clusterEntry.latestEvent || record.event_ts > clusterEntry.latestEvent) {
      clusterEntry.latestEvent = record.event_ts;
    }
    for (const label of record.parking_labels) {
      clusterEntry.labelCounts.set(label, (clusterEntry.labelCounts.get(label) ?? 0) + 1);
      globalLabels.set(label, (globalLabels.get(label) ?? 0) + 1);
    }

    const stationEntry = getOrCreateStationAnalytics(stationIndex, record.police_station);
    stationEntry.hourlyCounts[record.event_hour] += 1;
    stationEntry.weekdayCounts.set(record.weekday, (stationEntry.weekdayCounts.get(record.weekday) ?? 0) + 1);
    stationEntry.clusterIds.add(record.cluster_id);
  }

  const analytics = {
    clusterIndex,
    stationIndex,
    violationOptions: [...globalLabels.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([label]) => label),
  };

  analyticsCache.set(records, analytics);
  return analytics;
}

export function filterHotspots(
  hotspots: HotspotRecord[],
  analytics: RecordAnalytics | null,
  filters: DashboardFilters,
) {
  const normalizedQuery = filters.query.trim().toLowerCase();

  return hotspots
    .filter((hotspot) => {
      if (filters.station !== "all" && hotspot.police_station !== filters.station) {
        return false;
      }
      if (filters.severity !== "all" && hotspot.severity_band !== filters.severity) {
        return false;
      }
      if (normalizedQuery) {
        const haystack = [
          hotspot.location,
          hotspot.police_station,
          hotspot.reason_chips.join(" "),
          hotspot.top_violation_labels.join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedQuery)) {
          return false;
        }
      }

      const cluster = analytics?.clusterIndex.get(hotspot.cluster_id);

      if (filters.violation !== "all") {
        const hasViolation = cluster
          ? cluster.labelCounts.has(filters.violation)
          : hotspot.top_violation_labels.includes(filters.violation);
        if (!hasViolation) {
          return false;
        }
      }

      if (filters.timeBand !== "all") {
        if (!cluster) {
          return false;
        }
        const matchingRecords = cluster.records.some((record) =>
          matchesTimeBand(record.event_hour, filters.timeBand),
        );
        if (!matchingRecords) {
          return false;
        }
      }

      return true;
    })
    .sort((left, right) => right.priority_score - left.priority_score);
}

export function buildHotspotPoints(hotspots: HotspotRecord[], limit = 180): HotspotPoint[] {
  return hotspots.slice(0, limit).map((hotspot) => ({
    id: hotspot.cluster_id,
    label: compactLocation(hotspot.location),
    latitude: hotspot.latitude,
    longitude: hotspot.longitude,
    severity: hotspot.severity_band,
    weight: hotspot.priority_score,
    meta: `${hotspot.police_station} | ${Math.round(hotspot.impact_proxy_score)} impact`,
  }));
}

export function buildClusterBreakdown(
  hotspot: HotspotRecord | null,
  analytics: RecordAnalytics | null,
) {
  if (!hotspot || !analytics) {
    return {
      hourlyCounts: new Array(24).fill(0),
      labelRows: [] as Array<{ label: string; count: number; share: number }>,
      weekdayRows: [] as Array<{ label: string; count: number }>,
    };
  }

  const cluster = analytics.clusterIndex.get(hotspot.cluster_id);
  if (!cluster) {
    return {
      hourlyCounts: new Array(24).fill(0),
      labelRows: hotspot.top_violation_labels.map((label, index) => ({
        label,
        count: hotspot.record_count - index * 20,
        share: Math.max(12, Math.round(100 / hotspot.top_violation_labels.length)),
      })),
      weekdayRows: [],
    };
  }

  const totalLabels = [...cluster.labelCounts.values()].reduce((sum, value) => sum + value, 0);
  const labelRows = [...cluster.labelCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, count]) => ({
      label,
      count,
      share: totalLabels ? Math.round((count / totalLabels) * 100) : 0,
    }));
  const weekdayRows = [...cluster.weekdayCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => ({ label, count }));

  return {
    hourlyCounts: cluster.hourlyCounts,
    labelRows,
    weekdayRows,
  };
}

export function buildNearbyHotspotPoints(
  hotspot: HotspotRecord | null,
  hotspots: HotspotRecord[],
  limit = 24,
): HotspotPoint[] {
  if (!hotspot) {
    return [];
  }

  return hotspots
    .filter((candidate) => candidate.police_station === hotspot.police_station)
    .sort((left, right) => distanceTo(hotspot, left) - distanceTo(hotspot, right))
    .slice(0, limit)
    .map((candidate) => ({
      id: candidate.cluster_id,
      label: compactLocation(candidate.location),
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      severity: candidate.cluster_id === hotspot.cluster_id ? "info" : candidate.severity_band,
      weight: candidate.cluster_id === hotspot.cluster_id ? 100 : candidate.priority_score,
      meta: candidate.cluster_id === hotspot.cluster_id ? "Selected hotspot" : candidate.police_station,
    }));
}

export function buildStationHourlyMatrix(
  stations: StationSummary[],
  analytics: RecordAnalytics | null,
) {
  return stations.map((station) => ({
    ...station,
    hourlyCounts:
      analytics?.stationIndex.get(station.station)?.hourlyCounts ?? new Array(24).fill(0),
    weekdayCounts: analytics?.stationIndex.get(station.station)?.weekdayCounts ?? new Map<string, number>(),
  }));
}

export function buildStationMapPoints(
  stationName: string,
  hotspots: HotspotRecord[],
  limit = 12,
): HotspotPoint[] {
  return hotspots
    .filter((hotspot) => hotspot.police_station === stationName)
    .sort((left, right) => right.priority_score - left.priority_score)
    .slice(0, limit)
    .map((hotspot) => ({
      id: hotspot.cluster_id,
      label: compactLocation(hotspot.location),
      latitude: hotspot.latitude,
      longitude: hotspot.longitude,
      severity: hotspot.severity_band,
      weight: hotspot.priority_score,
      meta: `${Math.round(hotspot.impact_proxy_score)} impact`,
    }));
}

export function createPlannerExport(
  shift: string,
  hotspots: HotspotRecord[],
  projectedRelief: number,
) {
  const totalDemand = sumPlannerDemand(hotspots);
  const lines = [
    `LaneGuard Shift Plan`,
    `Shift: ${shift}`,
    `Projected relief: ${projectedRelief}%`,
    `Deployment demand: ${formatPlannerDemand(totalDemand)}`,
    "",
    ...hotspots.map(
      (hotspot, index) => {
        const demand = plannerDemandForHotspot(hotspot);
        return `${index + 1}. ${compactLocation(hotspot.location)} | ${hotspot.police_station} | Score ${Math.round(
          hotspot.priority_score,
        )} | ${formatPlannerDemand(demand)} | ${hotspot.recommendations.immediate[0] ?? "Dispatch enforcement"}`;
      },
    ),
  ];

  return lines.join("\n");
}

export function plannerDemandForHotspot(hotspot: HotspotRecord): PlannerResourceDemand {
  let officers = hotspot.severity_band === "critical" ? 4 : hotspot.severity_band === "high" ? 3 : 2;
  const patrolCars = hotspot.severity_band === "critical" ? 2 : 1;
  let towTrucks = 1;
  let constables =
    hotspot.junction_risk || hotspot.peak_hour_events >= Math.max(3, hotspot.record_count * 0.35)
      ? 2
      : 1;

  if (hotspot.repeat_days >= 8) {
    officers += 1;
  }
  if (hotspot.top_violation_labels.includes("DOUBLE PARKING")) {
    towTrucks = Math.max(towTrucks, 1);
  }
  if (hotspot.junction_risk && hotspot.severity_band === "critical") {
    constables += 1;
  }

  return {
    officers,
    patrol_cars: patrolCars,
    tow_trucks: towTrucks,
    constables,
  };
}

export function sumPlannerDemand(hotspots: HotspotRecord[]) {
  return hotspots.reduce<PlannerResourceDemand>(
    (totals, hotspot) => {
      const demand = plannerDemandForHotspot(hotspot);
      return {
        officers: totals.officers + demand.officers,
        patrol_cars: totals.patrol_cars + demand.patrol_cars,
        tow_trucks: totals.tow_trucks + demand.tow_trucks,
        constables: totals.constables + demand.constables,
      };
    },
    { officers: 0, patrol_cars: 0, tow_trucks: 0, constables: 0 },
  );
}

export function formatPlannerDemand(demand: PlannerResourceDemand) {
  const tokens = [
    `${demand.officers} OFF`,
    `${demand.patrol_cars} CAR`,
    `${demand.tow_trucks} TOW`,
    `${demand.constables} TC`,
  ];
  return tokens.join(" | ");
}

export function aggregateStationShiftResources(
  resources: StationResource[],
  stationNames: string[],
  shift: keyof StationResource["shift_resources"],
) {
  const selectedNames = stationNames.length
    ? Array.from(new Set(stationNames))
    : resources.map((resource) => resource.station);
  const selectedResources = resources.filter((resource) => selectedNames.includes(resource.station));

  const emptyShift: StationResourceShift = {
    totals: { officers: 0, patrol_cars: 0, tow_trucks: 0, constables: 0 },
    committed: { officers: 0, patrol_cars: 0, tow_trucks: 0, constables: 0 },
    available: { officers: 0, patrol_cars: 0, tow_trucks: 0, constables: 0 },
    standby_reserve: { officers: 0, patrol_cars: 0, tow_trucks: 0, constables: 0 },
    active_operations: [],
  };

  return selectedResources.reduce(
    (aggregate, resource) => {
      const shiftResource = resource.shift_resources[shift];
      return {
        stations: [...aggregate.stations, resource.station],
        pressureIndex:
          aggregate.pressureIndex + resource.pressure_index / Math.max(1, selectedResources.length),
        recommendedQueueSize: aggregate.recommendedQueueSize + resource.recommended_queue_size,
        shift: {
          totals: sumDemandLike(aggregate.shift.totals, shiftResource.totals),
          committed: sumDemandLike(aggregate.shift.committed, shiftResource.committed),
          available: sumDemandLike(aggregate.shift.available, shiftResource.available),
          standby_reserve: sumDemandLike(aggregate.shift.standby_reserve, shiftResource.standby_reserve),
          active_operations: [...aggregate.shift.active_operations, ...shiftResource.active_operations],
        },
      };
    },
    {
      stations: [] as string[],
      pressureIndex: 0,
      recommendedQueueSize: 0,
      shift: emptyShift,
    },
  );
}

export function stationRowsToCsv(
  rows: Array<StationSummary & { impact: number; response: number; status: string }>,
) {
  const header = ["Station", "Violations", "Hotspots", "PeakHourEvents", "Impact", "Response", "Status"];
  const body = rows.map((row) =>
    [
      csvEscape(row.station),
      row.record_count,
      row.hotspot_count,
      row.peak_hour_events,
      row.impact.toFixed(1),
      row.response,
      row.status,
    ].join(","),
  );
  return [header.join(","), ...body].join("\n");
}

export function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function compactLocation(location: string) {
  return location.split(",")[0]?.trim() || location;
}

export function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function matchesTimeBand(hour: number, band: TimeBand) {
  if (band === "peak") {
    return hour >= 4 && hour <= 6;
  }
  if (band === "morning") {
    return hour >= 6 && hour <= 10;
  }
  if (band === "midday") {
    return hour >= 11 && hour <= 15;
  }
  if (band === "evening") {
    return hour >= 16 && hour <= 20;
  }
  if (band === "overnight") {
    return hour >= 21 || hour <= 5;
  }
  return true;
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function getOrCreateClusterAnalytics(
  clusterIndex: Map<string, ClusterAnalytics>,
  clusterId: string,
) {
  const existing = clusterIndex.get(clusterId);
  if (existing) {
    return existing;
  }

  const created: ClusterAnalytics = {
    records: [],
    hourlyCounts: new Array(24).fill(0),
    weekdayCounts: new Map<string, number>(),
    labelCounts: new Map<string, number>(),
    latestEvent: "",
    peakCount: 0,
  };
  clusterIndex.set(clusterId, created);
  return created;
}

function getOrCreateStationAnalytics(
  stationIndex: Map<string, StationAnalytics>,
  stationName: string,
) {
  const existing = stationIndex.get(stationName);
  if (existing) {
    return existing;
  }

  const created: StationAnalytics = {
    hourlyCounts: new Array(24).fill(0),
    weekdayCounts: new Map<string, number>(),
    clusterIds: new Set<string>(),
  };
  stationIndex.set(stationName, created);
  return created;
}

function distanceTo(origin: HotspotRecord, candidate: HotspotRecord) {
  const latDelta = origin.latitude - candidate.latitude;
  const lngDelta = origin.longitude - candidate.longitude;
  return latDelta * latDelta + lngDelta * lngDelta;
}

function sumDemandLike(
  left: PlannerResourceDemand,
  right: PlannerResourceDemand,
): PlannerResourceDemand {
  return {
    officers: left.officers + right.officers,
    patrol_cars: left.patrol_cars + right.patrol_cars,
    tow_trucks: left.tow_trucks + right.tow_trucks,
    constables: left.constables + right.constables,
  };
}

