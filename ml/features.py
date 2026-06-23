from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from .config import CATEGORICAL_FEATURE_COLUMNS, COUNT_TARGET_COLUMN, META_COLUMNS, NUMERIC_FEATURE_COLUMNS, TARGET_COLUMN


def load_frame(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path)
    if frame.empty:
        raise ValueError(f"No rows found in {path}.")

    for column in META_COLUMNS:
        if column not in frame.columns:
            frame[column] = ""

    for column in NUMERIC_FEATURE_COLUMNS + [COUNT_TARGET_COLUMN, TARGET_COLUMN]:
        if column not in frame.columns:
            frame[column] = 0

    return frame


def prepare_training_frame(frame: pd.DataFrame) -> pd.DataFrame:
    prepared = frame.copy()
    prepared["service_date"] = prepared["service_date"].astype(str)
    prepared["target_next_shift_date"] = prepared["target_next_shift_date"].astype(str)
    prepared["shift"] = prepared["shift"].astype(str)
    prepared["weekday"] = prepared["weekday"].astype(str)
    prepared["severity_band"] = prepared["severity_band"].astype(str)
    prepared[TARGET_COLUMN] = prepared[TARGET_COLUMN].fillna(0).astype(int)
    prepared[COUNT_TARGET_COLUMN] = prepared[COUNT_TARGET_COLUMN].fillna(0).astype(int)
    for column in NUMERIC_FEATURE_COLUMNS:
        prepared[column] = pd.to_numeric(prepared[column], errors="coerce").fillna(0.0)
    return add_engineered_features(prepared)


def prepare_scoring_frame(frame: pd.DataFrame) -> pd.DataFrame:
    prepared = frame.copy()
    prepared["service_date"] = prepared["service_date"].astype(str)
    prepared["target_next_shift_date"] = prepared["target_next_shift_date"].astype(str)
    prepared["shift"] = prepared["shift"].astype(str)
    prepared["weekday"] = prepared["weekday"].astype(str)
    prepared["severity_band"] = prepared["severity_band"].astype(str)
    for column in NUMERIC_FEATURE_COLUMNS:
        prepared[column] = pd.to_numeric(prepared[column], errors="coerce").fillna(0.0)
    return add_engineered_features(prepared)


def add_engineered_features(frame: pd.DataFrame) -> pd.DataFrame:
    enriched = frame.copy()

    count_columns = [
        "current_shift_records",
        "current_shift_peak_events",
        "previous_shift_records",
        "rolling_3_shift_records",
        "rolling_9_shift_records",
        "same_shift_records_7d",
        "active_days_14d",
        "station_current_shift_records",
        "station_recent_3_shift_records",
        "station_same_shift_records_7d",
        "hotspot_record_count",
        "hotspot_repeat_days",
        "hotspot_peak_hour_events",
        "staleness_slots_since_active",
    ]

    for column in count_columns:
        enriched[f"{column}_log1p"] = np.log1p(enriched[column].astype(float))

    enriched["weekend_flag"] = enriched["weekday"].isin(["Saturday", "Sunday"]).astype(int)
    service_dates = pd.to_datetime(enriched["service_date"], errors="coerce")
    enriched["service_month"] = service_dates.dt.month.fillna(0).astype(int)
    enriched["service_week_of_year"] = service_dates.dt.isocalendar().week.astype(int)
    enriched["morning_shift_flag"] = (enriched["shift"] == "Morning").astype(int)
    enriched["afternoon_shift_flag"] = (enriched["shift"] == "Afternoon").astype(int)
    enriched["night_shift_flag"] = (enriched["shift"] == "Night").astype(int)

    enriched["current_vs_rolling3_ratio"] = enriched["current_shift_records"] / (1.0 + enriched["rolling_3_shift_records"])
    enriched["current_vs_station_share"] = enriched["current_shift_records"] / (1.0 + enriched["station_current_shift_records"])
    enriched["repeat_density_14d"] = enriched["same_shift_records_7d"] / (1.0 + enriched["active_days_14d"])
    enriched["station_repeat_intensity"] = enriched["station_same_shift_records_7d"] / (1.0 + enriched["station_recent_3_shift_records"])
    enriched["recent_acceleration"] = enriched["current_shift_records"] - enriched["previous_shift_records"]
    enriched["station_acceleration"] = enriched["station_current_shift_records"] - enriched["station_recent_3_shift_records"] / 3.0
    enriched["peak_event_density"] = enriched["current_shift_peak_events"] / (1.0 + enriched["current_shift_records"])
    enriched["priority_x_impact"] = (
        enriched["hotspot_priority_score"] * enriched["hotspot_impact_proxy_score"]
    ) / 100.0
    enriched["junction_x_recent_activity"] = enriched["junction_risk"] * enriched["current_shift_records"]
    enriched["main_road_x_recent_activity"] = enriched["main_road_flag"] * enriched["current_shift_records"]
    enriched["station_pressure_x_repeat"] = enriched["station_same_shift_records_7d"] * enriched["hotspot_repeat_days"]
    enriched["dormant_corridor_flag"] = (
        (enriched["current_shift_records"] <= 0)
        & (enriched["same_shift_records_7d"] <= 0)
        & (enriched["staleness_slots_since_active"] >= 4)
    ).astype(int)
    enriched["sparse_corridor_flag"] = (
        (enriched["hotspot_record_count"] <= 12)
        | (
            (enriched["active_days_14d"] <= 2)
            & (enriched["same_shift_records_7d"] <= 1)
            & (enriched["rolling_3_shift_records"] <= 1)
        )
    ).astype(int)
    enriched["sparse_station_backed_flag"] = (
        (enriched["sparse_corridor_flag"] == 1)
        & (enriched["station_same_shift_records_7d"] >= 6)
    ).astype(int)
    enriched["sparse_x_station_pressure"] = enriched["sparse_corridor_flag"] * enriched["station_same_shift_records_7d"]
    enriched["sparse_x_priority"] = enriched["sparse_corridor_flag"] * enriched["hotspot_priority_score"]
    enriched["sparse_x_impact"] = enriched["sparse_corridor_flag"] * enriched["hotspot_impact_proxy_score"]
    enriched["fresh_repeat_corridor_flag"] = (
        (enriched["hotspot_repeat_days"] <= 4)
        & (enriched["same_shift_records_7d"] >= 2)
    ).astype(int)

    severity_code = enriched["severity_band"].map({"moderate": 1, "high": 2, "critical": 3}).fillna(0)
    enriched["severity_code"] = severity_code.astype(int)
    enriched["main_road_x_severity"] = enriched["main_road_flag"] * enriched["severity_code"]
    enriched["junction_x_severity"] = enriched["junction_risk"] * enriched["severity_code"]
    enriched["night_x_recent_activity"] = enriched["night_shift_flag"] * enriched["current_shift_records"]
    enriched["night_x_repeat_density"] = enriched["night_shift_flag"] * enriched["same_shift_records_7d"]
    enriched["night_x_main_road"] = enriched["night_shift_flag"] * enriched["main_road_flag"]
    enriched["night_x_junction"] = enriched["night_shift_flag"] * enriched["junction_risk"]
    enriched["night_weekend_flag"] = enriched["night_shift_flag"] * enriched["weekend_flag"]
    enriched["night_x_priority"] = enriched["night_shift_flag"] * enriched["hotspot_priority_score"]
    enriched["night_x_sparse_station"] = enriched["night_shift_flag"] * enriched["sparse_station_backed_flag"]

    # --- New target-shift-aware features (uses target_next_shift instead of current shift) ---
    target_night_flag = (enriched["target_next_shift"] == "Night").astype(int)
    enriched["night_x_station_pressure"] = target_night_flag * enriched["station_same_shift_records_7d"]
    enriched["severity_x_recent_activity"] = enriched["severity_code"] * (
        enriched["same_shift_records_7d"] + enriched["current_shift_records"]
    )
    enriched["station_positive_rate_14d"] = enriched["station_same_shift_records_7d"] / (
        1.0 + enriched["station_recent_3_shift_records"]
    )
    enriched["decayed_same_shift_records_7d"] = enriched["same_shift_records_7d"] * (
        0.9 ** enriched["staleness_slots_since_active"]
    )
    enriched["burst_spike_ratio"] = enriched["current_shift_records"] / (
        1.0 + enriched["rolling_3_shift_records"]
    )
    enriched["other_corridors_station_pressure"] = (
        enriched["station_current_shift_records"] - enriched["current_shift_records"]
    )

    return enriched


def build_feature_matrix(
    frame: pd.DataFrame,
    reference_columns: list[str] | None = None,
) -> tuple[pd.DataFrame, list[str]]:
    base_columns = [
        column
        for column in frame.columns
        if column not in set(META_COLUMNS + [TARGET_COLUMN, COUNT_TARGET_COLUMN, "baseline_top_factors", "baseline_confidence"])
        and column not in {"location", "cluster_id", "police_station", "service_date", "target_next_shift_date", "target_next_shift"}
    ]

    encoded = pd.get_dummies(
        frame[base_columns],
        columns=[column for column in CATEGORICAL_FEATURE_COLUMNS if column in base_columns],
        dummy_na=False,
    )

    if reference_columns is None:
        reference_columns = list(encoded.columns)
    else:
        encoded = encoded.reindex(columns=reference_columns, fill_value=0)

    return encoded.astype(float), reference_columns