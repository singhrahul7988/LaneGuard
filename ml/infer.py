from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def confidence_from_probability(probability: float, support_count: int) -> str:
    if probability >= 0.72 and support_count >= 14:
        return "high"
    if probability >= 0.45 and support_count >= 6:
        return "medium"
    return "low"


def driver_labels(row: pd.Series) -> list[str]:
    factors: list[tuple[str, float]] = [
        ("recent shift activity", float(row.get("current_shift_records", 0)) * 1.3),
        ("same-shift recurrence", float(row.get("same_shift_records_7d", 0)) * 1.1),
        ("station pressure", float(row.get("station_same_shift_records_7d", 0)) * 0.6),
        ("high impact corridor", float(row.get("hotspot_impact_proxy_score", 0)) * 0.05),
        ("repeat hotspot history", float(row.get("hotspot_repeat_days", 0)) * 0.75),
        ("junction conflict", 8.0 if float(row.get("junction_risk", 0)) > 0 else 0.0),
        ("main-road obstruction", 8.0 if float(row.get("main_road_flag", 0)) > 0 else 0.0),
        ("dormant corridor", 7.0 if float(row.get("dormant_corridor_flag", 0)) > 0 else 0.0),
    ]
    ranked = [label for label, value in sorted(factors, key=lambda item: item[1], reverse=True) if value > 0]
    return ranked[:3]


def build_forecast_rows(
    scoring_frame: pd.DataFrame,
    probabilities: np.ndarray,
    predicted_counts: np.ndarray,
    model_name: str,
) -> list[dict[str, Any]]:
    rows = []
    for row, probability, predicted_count in zip(scoring_frame.to_dict("records"), probabilities, predicted_counts, strict=False):
        support_count = int(
            row.get("active_days_14d", 0)
            + row.get("same_shift_records_7d", 0)
            + row.get("rolling_3_shift_records", 0)
        )
        confidence = confidence_from_probability(float(probability), support_count)
        record = pd.Series(row)
        rows.append(
            {
                "cluster_id": row["cluster_id"],
                "location": row["location"],
                "police_station": row["police_station"],
                "source_service_date": row["service_date"],
                "source_shift": row["shift"],
                "forecast_service_date": row["target_next_shift_date"],
                "forecast_shift": row["target_next_shift"],
                "predicted_risk_score": int(round(float(probability) * 100)),
                "predicted_next_shift_records": max(0, int(round(float(predicted_count)))),
                "predicted_hotspot_probability": round(float(probability), 4),
                "confidence": confidence,
                "support_count": support_count,
                "top_factors": driver_labels(record),
                "staleness_slots": int(row.get("staleness_slots_since_active", 0)),
                "impact_proxy_score": round(float(row.get("hotspot_impact_proxy_score", 0)), 1),
                "priority_score": round(float(row.get("hotspot_priority_score", 0)), 1),
                "severity_band": row["severity_band"],
                "model_name": model_name,
            }
        )

    rows.sort(
        key=lambda item: (
            item["predicted_risk_score"],
            item["predicted_hotspot_probability"],
            item["predicted_next_shift_records"],
            item["impact_proxy_score"],
        ),
        reverse=True,
    )
    return rows
