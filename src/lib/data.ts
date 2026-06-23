import { useEffect, useState } from "react";

export type HotspotRecord = {
  cluster_id: string;
  latitude: number;
  longitude: number;
  location: string;
  police_station: string;
  record_count: number;
  repeat_days: number;
  peak_hour_events: number;
  top_violation_labels: string[];
  severity_mix: number;
  junction_risk: boolean;
  main_road_flag: boolean;
  latest_event: string;
  recency_weight: number;
  records: string[];
  priority_score: number;
  impact_proxy_score: number;
  severity_band: "critical" | "high" | "moderate";
  reason_chips: string[];
  recommendations: {
    immediate: string[];
    short_term: string[];
    medium_term: string[];
  };
};

export type BriefSummary = {
  headline: string;
  total_parking_records: number;
  total_hotspots: number;
  top_station: string | null;
  peak_hour: number | null;
  top_hotspots: HotspotRecord[];
  top_policy_recommendations: Array<{
    cluster_id: string;
    location: string;
    station: string;
    priority_score: number;
    impact_proxy_score: number;
    reason_chips: string[];
    recommendations: HotspotRecord["recommendations"];
  }>;
};

export type ForecastHotspot = {
  cluster_id: string;
  location: string;
  police_station: string;
  source_service_date: string;
  source_shift: "Morning" | "Afternoon" | "Night";
  forecast_service_date: string;
  forecast_shift: "Morning" | "Afternoon" | "Night";
  predicted_risk_score: number;
  predicted_next_shift_records?: number;
  confidence: "high" | "medium" | "low";
  top_factors: string[];
  staleness_slots: number;
  impact_proxy_score: number;
  priority_score: number;
  severity_band: "critical" | "high" | "moderate";
  predicted_hotspot_probability?: number;
  support_count?: number;
  model_name?: string;
};

export type AIBaselineSummary = {
  model_type: string;
  training_rows: number;
  positive_next_shift_rows: number;
  positive_rate: number;
  mae_next_shift_records: number;
  precision_at_risk_55: number;
  recall_at_risk_55: number;
  latest_observed_service_date: string;
  latest_observed_shift: "Morning" | "Afternoon" | "Night";
  forecast_target_service_date: string;
  forecast_target_shift: "Morning" | "Afternoon" | "Night";
  notes: string[];
};

export type ModelValidationSummary = {
  model_name: string;
  train_rows?: number;
  validation_rows: number;
  test_rows?: number;
  train_start_date?: string;
  train_end_date?: string;
  validation_start_date?: string;
  validation_end_date?: string;
  test_start_date?: string;
  test_end_date?: string;
  chosen_threshold?: number;
  primary_metric_name?: string;
  primary_metric_value?: number;
  holdout_primary_metric_value?: number;
  average_precision?: number;
  baseline_average_precision?: number;
  mae_next_shift_records?: number;
  baseline_mae_next_shift_records?: number;
  precision_at_risk_55?: number;
  recall_at_risk_55?: number;
  baseline_precision_at_risk_55?: number;
  baseline_recall_at_risk_55?: number;
  precision_at_top_30?: number;
  recall_at_top_30?: number;
  log_loss?: number;
  brier_score?: number;
  notes: string[];
};

export type ModelExplanations = {
  model_name: string;
  description: string;
  feature_groups: string[];
};

export type ModelBenchmarkMetric = {
  key: string;
  label: string;
  model_value: number;
  baseline_value: number;
  delta: number;
  better: "higher" | "lower";
  winner: "model" | "baseline" | "tie";
};

export type ModelBenchmarkSummary = {
  model_name: string;
  baseline_name: string;
  validation_rows: number;
  test_rows?: number;
  validation_start_date?: string;
  validation_end_date?: string;
  test_start_date?: string;
  test_end_date?: string;
  chosen_threshold?: number;
  primary_metric_name?: string;
  primary_metric_value?: number;
  metrics: ModelBenchmarkMetric[];
  summary_note: string;
};

export type OptimizedShiftPlanDemand = {
  officers: number;
  patrol_cars: number;
  tow_trucks: number;
  constables: number;
};

export type OptimizedShiftPlanItem = {
  cluster_id: string;
  police_station: string;
  location: string;
  severity_band: HotspotRecord["severity_band"];
  optimized_score: number;
  predicted_risk_score?: number;
  predicted_next_shift_records?: number;
  confidence?: ForecastHotspot["confidence"];
  support_count?: number;
  rationale: string[];
  demand: OptimizedShiftPlanDemand;
};

export type OptimizerStrategy = "balanced" | "max_relief" | "high_confidence";

export type PlanImpactConfidence = "high" | "medium" | "low";

export type OptimizedShiftPlan = {
  station_filter: string;
  shift: "Morning" | "Afternoon" | "Night";
  strategy: OptimizerStrategy;
  strategy_label: string;
  strategy_note: string;
  recommended_queue_size: number;
  recommended_items: OptimizedShiftPlanItem[];
  demand: OptimizedShiftPlanDemand;
  remaining_capacity: OptimizedShiftPlanDemand;
  projected_relief: number;
  projected_relief_range: {
    low: number;
    high: number;
  };
  impact_confidence: PlanImpactConfidence;
  impact_confidence_score: number;
  confidence_note: string;
  fits_capacity: boolean;
};

export type OptimizedShiftPlanArtifact = {
  generated_at: string;
  model_name: string;
  plan_method: string;
  strategies: Array<{
    id: OptimizerStrategy;
    label: string;
    note: string;
  }>;
  plans: OptimizedShiftPlan[];
};

export type StationSummary = {
  station: string;
  record_count: number;
  hotspot_count: number;
  peak_hour_events: number;
  top_violation_labels: string[];
  latest_event: string;
};

export type TimeSummary = {
  hourly_counts: Record<string, number>;
  weekday_counts: Record<string, number>;
};

export type StationResourceShift = {
  totals: {
    officers: number;
    patrol_cars: number;
    tow_trucks: number;
    constables: number;
  };
  committed: {
    officers: number;
    patrol_cars: number;
    tow_trucks: number;
    constables: number;
  };
  available: {
    officers: number;
    patrol_cars: number;
    tow_trucks: number;
    constables: number;
  };
  standby_reserve: {
    officers: number;
    patrol_cars: number;
    tow_trucks: number;
    constables: number;
  };
  active_operations: Array<{
    operation_id: string;
    cluster_id: string;
    location: string;
    priority_score: number;
    directive: string;
    officers: number;
    patrol_cars: number;
    tow_trucks: number;
    constables: number;
    status: "Committed" | "Queued";
  }>;
};

export type StationResource = {
  station: string;
  pressure_index: number;
  command_tier: "tier_1" | "tier_2" | "tier_3";
  recommended_queue_size: number;
  shift_resources: {
    Morning: StationResourceShift;
    Afternoon: StationResourceShift;
    Night: StationResourceShift;
  };
};

export type ParkingRecord = {
  id: string;
  latitude: number;
  longitude: number;
  location: string;
  police_station: string;
  vehicle_type: string;
  event_ts: string;
  event_date: string;
  event_hour: number;
  weekday: string;
  parking_labels: string[];
  cluster_id: string;
  junction_name: string;
  is_peak_hour: boolean;
};

type LoadState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

export function useProcessedJson<T>(path: string) {
  const [state, setState] = useState<LoadState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Failed to load ${path}: ${response.status}`);
        }
        const payload = (await response.json()) as T;
        if (!cancelled) {
          setState({ data: payload, error: null, loading: false });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : "Unknown load error",
            loading: false,
          });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [path]);

  return state;
}
