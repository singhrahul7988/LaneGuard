import csv
import json
import math
import os
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path


RAW_DATASET = Path("Dataset") / "jan to may police violation_anonymized791b166.csv"
OUTPUT_DIRS = [
    Path("data") / "processed",
    Path("public") / "data" / "processed",
]

PARKING_LABELS = {
    "WRONG PARKING",
    "NO PARKING",
    "PARKING IN A MAIN ROAD",
    "PARKING ON FOOTPATH",
    "DOUBLE PARKING",
    "PARKING NEAR ROAD CROSSING",
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC",
    "PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS",
    "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE",
}

PEAK_HOURS = {8, 9, 10, 17, 18, 19, 20}
SHIFT_NAMES = ("Morning", "Afternoon", "Night")
SHIFT_SLOT_INDEX = {name: index for index, name in enumerate(SHIFT_NAMES)}


def parse_nullable(value: str) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if cleaned == "" or cleaned.upper() == "NULL":
        return None
    return cleaned


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def parse_violation_labels(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
        if isinstance(parsed, list):
            return [str(item).strip().upper() for item in parsed]
    except json.JSONDecodeError:
        pass
    return [raw_value.strip().upper()]


def make_cluster_id(lat: float, lon: float, precision: int = 3) -> str:
    return f"{round(lat, precision):.{precision}f}:{round(lon, precision):.{precision}f}"


def derive_service_date_and_shift(event_ts: datetime) -> tuple[str, str]:
    hour = event_ts.astimezone(timezone.utc).hour
    service_date = event_ts.date()

    if hour < 6:
        return ((service_date - timedelta(days=1)).isoformat(), "Night")
    if hour < 14:
        return (service_date.isoformat(), "Morning")
    if hour < 22:
        return (service_date.isoformat(), "Afternoon")
    return (service_date.isoformat(), "Night")


def slot_position(service_date: str, shift: str) -> int:
    return datetime.fromisoformat(service_date).toordinal() * 3 + SHIFT_SLOT_INDEX[shift]


def previous_shift_slot(service_date: str, shift: str) -> tuple[str, str]:
    date_value = datetime.fromisoformat(service_date)
    shift_index = SHIFT_SLOT_INDEX[shift]
    if shift_index == 0:
        return ((date_value - timedelta(days=1)).date().isoformat(), SHIFT_NAMES[-1])
    return (service_date, SHIFT_NAMES[shift_index - 1])


def next_shift_slot(service_date: str, shift: str) -> tuple[str, str]:
    date_value = datetime.fromisoformat(service_date)
    shift_index = SHIFT_SLOT_INDEX[shift]
    if shift_index == len(SHIFT_NAMES) - 1:
        return ((date_value + timedelta(days=1)).date().isoformat(), SHIFT_NAMES[0])
    return (service_date, SHIFT_NAMES[shift_index + 1])


def severity_from_labels(labels: list[str]) -> int:
    score = 0
    if "PARKING IN A MAIN ROAD" in labels:
        score += 4
    if "PARKING NEAR ROAD CROSSING" in labels:
        score += 3
    if "PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS" in labels:
        score += 3
    if "DOUBLE PARKING" in labels:
        score += 2
    if "PARKING ON FOOTPATH" in labels:
        score += 2
    if "WRONG PARKING" in labels:
        score += 2
    if "NO PARKING" in labels:
        score += 1
    return score


def normalize_scores(hotspots: list[dict]) -> list[dict]:
    if not hotspots:
        return hotspots

    max_volume = max(item["record_count"] for item in hotspots) or 1
    max_repeat_days = max(item["repeat_days"] for item in hotspots) or 1
    max_peak = max(item["peak_hour_events"] for item in hotspots) or 1
    max_severity = max(item["severity_mix"] for item in hotspots) or 1
    max_recency = max(item["recency_weight"] for item in hotspots) or 1

    for item in hotspots:
        volume = item["record_count"] / max_volume
        repeat_days = item["repeat_days"] / max_repeat_days
        peak = item["peak_hour_events"] / max_peak
        severity = item["severity_mix"] / max_severity
        recency = item["recency_weight"] / max_recency
        junction_risk = 1.0 if item["junction_risk"] else 0.0

        priority = (
            0.35 * volume
            + 0.2 * repeat_days
            + 0.15 * recency
            + 0.1 * peak
            + 0.1 * junction_risk
            + 0.1 * severity
        )
        item["priority_score"] = round(priority * 100, 1)
        item["impact_proxy_score"] = min(99, round((priority * 100) + (severity * 8), 1))
        item["severity_band"] = (
            "critical"
            if item["impact_proxy_score"] >= 85
            else "high"
            if item["impact_proxy_score"] >= 60
            else "moderate"
        )
        item["reason_chips"] = build_reason_chips(item)
        item["recommendations"] = build_recommendations(item)

    hotspots.sort(key=lambda record: record["priority_score"], reverse=True)
    return hotspots


def build_reason_chips(item: dict) -> list[str]:
    reasons: list[str] = []
    if item["repeat_days"] >= 6:
        reasons.append(f"Recurring {item['repeat_days']} days")
    if item["peak_hour_events"] >= max(3, item["record_count"] * 0.35):
        reasons.append("Peak-hour dense")
    if item["main_road_flag"]:
        reasons.append("Main-road parking")
    if item["junction_risk"]:
        reasons.append("Crossing / junction risk")
    if not reasons:
        reasons.append("Localized repeat pressure")
    return reasons[:4]


def build_recommendations(item: dict) -> dict:
    immediate: list[str] = []
    short_term: list[str] = []
    medium_term: list[str] = []

    labels = set(item["top_violation_labels"])

    if item["impact_proxy_score"] >= 85:
        immediate.append("Deploy tow-priority enforcement in the next shift")
    if item["peak_hour_events"] >= max(3, item["record_count"] * 0.35):
        immediate.append("Schedule focused peak-hour patrol presence")
    if "PARKING IN A MAIN ROAD" in labels:
        immediate.append("Treat as a zero-tolerance main-road obstruction zone")
    if item["junction_risk"]:
        short_term.append("Evaluate no-parking buffer and signage reinforcement near the junction")
    if "NO PARKING" in labels or "WRONG PARKING" in labels:
        short_term.append("Review timed restriction enforcement for repeat periods")
    if "DOUBLE PARKING" in labels:
        short_term.append("Target curbside loading behavior with stricter monitoring")
    if item["repeat_days"] >= 8:
        medium_term.append("Study nearby managed short-stay parking options")
    if item["main_road_flag"]:
        medium_term.append("Review curb-management policy for this corridor")
    if not medium_term:
        medium_term.append("Monitor recurrence before infrastructure changes")

    return {
        "immediate": immediate[:3],
        "short_term": short_term[:3],
        "medium_term": medium_term[:3],
    }


def resource_plan_for_hotspot(item: dict) -> dict:
    officers = 4 if item["severity_band"] == "critical" else 3 if item["severity_band"] == "high" else 2
    patrol_cars = 2 if item["severity_band"] == "critical" else 1
    tow_trucks = 1
    constables = 2 if item["junction_risk"] or item["peak_hour_events"] >= max(3, item["record_count"] * 0.35) else 1

    if item["repeat_days"] >= 8:
        officers += 1
    if "DOUBLE PARKING" in item["top_violation_labels"]:
        tow_trucks = max(tow_trucks, 1)

    duration_mins = 105 if item["severity_band"] == "critical" else 85 if item["severity_band"] == "high" else 65

    return {
        "officers": officers,
        "patrol_cars": patrol_cars,
        "tow_trucks": tow_trucks,
        "constables": constables,
        "duration_mins": duration_mins,
    }


def build_station_resources(station_rows: list[dict], hotspots: list[dict]) -> list[dict]:
    if not station_rows:
        return []

    max_records = max(row["record_count"] for row in station_rows) or 1
    max_hotspots = max(row["hotspot_count"] for row in station_rows) or 1
    max_peak_events = max(row["peak_hour_events"] for row in station_rows) or 1

    hotspots_by_station: dict[str, list[dict]] = defaultdict(list)
    for hotspot in hotspots:
        hotspots_by_station[hotspot["police_station"]].append(hotspot)

    for station_hotspots in hotspots_by_station.values():
        station_hotspots.sort(key=lambda item: item["priority_score"], reverse=True)

    shift_specs = {
        "Morning": {"commit_ratio": 0.34, "constable_bias": 1, "patrol_bias": 0, "tow_bias": 0},
        "Afternoon": {"commit_ratio": 0.42, "constable_bias": 0, "patrol_bias": 1, "tow_bias": 0},
        "Night": {"commit_ratio": 0.28, "constable_bias": -1, "patrol_bias": 0, "tow_bias": -1},
    }

    station_resources = []
    for row in station_rows:
        pressure_index = round(
            (
                0.52 * (row["record_count"] / max_records)
                + 0.28 * (row["hotspot_count"] / max_hotspots)
                + 0.20 * (row["peak_hour_events"] / max_peak_events)
            )
            * 100,
            1,
        )
        pressure_ratio = pressure_index / 100
        command_tier = "tier_1" if pressure_ratio >= 0.72 else "tier_2" if pressure_ratio >= 0.42 else "tier_3"
        queue_coverage = 4 if command_tier == "tier_1" else 3 if command_tier == "tier_2" else 2

        station_hotspots = hotspots_by_station.get(row["station"], [])
        coverage_demand = {"officers": 0, "patrol_cars": 0, "tow_trucks": 0, "constables": 0}
        for hotspot in station_hotspots[:queue_coverage]:
            demand = resource_plan_for_hotspot(hotspot)
            coverage_demand["officers"] += demand["officers"]
            coverage_demand["patrol_cars"] += demand["patrol_cars"]
            coverage_demand["tow_trucks"] += demand["tow_trucks"]
            coverage_demand["constables"] += demand["constables"]

        totals = {
            "officers": min(
                18,
                max(7, int(round(5 + pressure_ratio * 4 + coverage_demand["officers"] * 0.55))),
            ),
            "patrol_cars": min(
                5,
                max(2, int(round(1 + pressure_ratio * 1.4 + coverage_demand["patrol_cars"] * 0.5))),
            ),
            "tow_trucks": min(
                3,
                max(
                    1,
                    int(
                        round(
                            0.5
                            + pressure_ratio * 0.8
                            + coverage_demand["tow_trucks"] * 0.35
                            + (
                                1
                                if "PARKING IN A MAIN ROAD" in row["top_violation_labels"] and pressure_ratio >= 0.6
                                else 0
                            )
                        )
                    ),
                ),
            ),
            "constables": min(
                12,
                max(4, int(round(3 + pressure_ratio * 2.5 + coverage_demand["constables"] * 0.55))),
            ),
        }

        shift_resources = {}
        for shift_name, spec in shift_specs.items():
            base_ratio = min(0.64, spec["commit_ratio"] + pressure_ratio * 0.14)
            operation_count = 3 if command_tier == "tier_1" else 2 if command_tier == "tier_2" else 1
            active_operations = []
            committed = {"officers": 0, "patrol_cars": 0, "tow_trucks": 0, "constables": 0}

            for index, hotspot in enumerate(station_hotspots[:operation_count]):
                demand = resource_plan_for_hotspot(hotspot)
                operation = {
                    "operation_id": f"{row['station'][:3].upper()}-{shift_name[:2].upper()}-{index + 1:02d}",
                    "cluster_id": hotspot["cluster_id"],
                    "location": hotspot["location"],
                    "priority_score": hotspot["priority_score"],
                    "directive": hotspot["recommendations"]["immediate"][0]
                    if hotspot["recommendations"]["immediate"]
                    else "Focused parking enforcement",
                    "officers": max(1, demand["officers"] - 1),
                    "patrol_cars": max(0, demand["patrol_cars"] + spec["patrol_bias"]),
                    "tow_trucks": max(0, demand["tow_trucks"] + spec["tow_bias"]),
                    "constables": max(1, demand["constables"] + spec["constable_bias"]),
                    "status": "Committed" if index == 0 else "Queued",
                }
                active_operations.append(operation)
                committed["officers"] += operation["officers"]
                committed["patrol_cars"] += operation["patrol_cars"]
                committed["tow_trucks"] += operation["tow_trucks"]
                committed["constables"] += operation["constables"]

            standby_reserve = {
                "officers": max(1, int(round(totals["officers"] * max(0.12, base_ratio - 0.12)))),
                "patrol_cars": max(0, int(round(totals["patrol_cars"] * max(0.10, base_ratio - 0.14)))),
                "tow_trucks": max(0, int(round(totals["tow_trucks"] * max(0.06, base_ratio - 0.18)))),
                "constables": max(0, int(round(totals["constables"] * max(0.10, base_ratio - 0.14)))),
            }
            committed = {
                key: min(totals[key], committed[key] + standby_reserve[key])
                for key in totals
            }
            available = {
                key: max(0, totals[key] - committed[key])
                for key in totals
            }

            shift_resources[shift_name] = {
                "totals": totals,
                "committed": committed,
                "available": available,
                "standby_reserve": standby_reserve,
                "active_operations": active_operations,
            }

        station_resources.append(
            {
                "station": row["station"],
                "pressure_index": pressure_index,
                "command_tier": command_tier,
                "recommended_queue_size": 4 if command_tier == "tier_1" else 3 if command_tier == "tier_2" else 2,
                "shift_resources": shift_resources,
            }
        )

    return station_resources


def build_ai_feature_manifest() -> dict:
    return {
        "purpose": "Model-ready baseline for next-shift parking-pressure prediction and later optimization work.",
        "row_definition": "One observed hotspot-cluster shift window with lag features and the next-shift target.",
        "features": [
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
            "hotspot_priority_score",
            "hotspot_impact_proxy_score",
            "severity_band",
            "junction_risk",
            "main_road_flag",
            "staleness_slots_since_active",
        ],
        "targets": [
            "target_next_shift_records",
            "target_next_shift_peak_events",
            "target_next_shift_hotspot",
        ],
    }


def sum_recent_cluster_shifts(
    cluster_id: str,
    service_date: str,
    shift: str,
    num_slots: int,
    cluster_shift_summary: dict[tuple[str, str, str], dict],
) -> int:
    total = 0
    lookup_date, lookup_shift = service_date, shift
    for _ in range(num_slots):
        lookup_date, lookup_shift = previous_shift_slot(lookup_date, lookup_shift)
        total += cluster_shift_summary.get((cluster_id, lookup_date, lookup_shift), {}).get("record_count", 0)
    return total


def sum_recent_station_shifts(
    station: str,
    service_date: str,
    shift: str,
    num_slots: int,
    station_shift_summary: dict[tuple[str, str, str], int],
) -> int:
    total = 0
    lookup_date, lookup_shift = service_date, shift
    for _ in range(num_slots):
        lookup_date, lookup_shift = previous_shift_slot(lookup_date, lookup_shift)
        total += station_shift_summary.get((station, lookup_date, lookup_shift), 0)
    return total


def sum_same_shift_cluster_days(
    cluster_id: str,
    service_date: str,
    shift: str,
    days_back: int,
    cluster_shift_summary: dict[tuple[str, str, str], dict],
) -> int:
    total = 0
    date_value = datetime.fromisoformat(service_date)
    for offset in range(1, days_back + 1):
        lookup_date = (date_value - timedelta(days=offset)).date().isoformat()
        total += cluster_shift_summary.get((cluster_id, lookup_date, shift), {}).get("record_count", 0)
    return total


def sum_same_shift_station_days(
    station: str,
    service_date: str,
    shift: str,
    days_back: int,
    station_shift_summary: dict[tuple[str, str, str], int],
) -> int:
    total = 0
    date_value = datetime.fromisoformat(service_date)
    for offset in range(1, days_back + 1):
        lookup_date = (date_value - timedelta(days=offset)).date().isoformat()
        total += station_shift_summary.get((station, lookup_date, shift), 0)
    return total


def count_active_cluster_days(
    cluster_id: str,
    service_date: str,
    days_back: int,
    cluster_shift_summary: dict[tuple[str, str, str], dict],
) -> int:
    active_days = 0
    date_value = datetime.fromisoformat(service_date)
    for offset in range(1, days_back + 1):
        lookup_date = (date_value - timedelta(days=offset)).date().isoformat()
        if any(
            cluster_shift_summary.get((cluster_id, lookup_date, shift_name), {}).get("record_count", 0) > 0
            for shift_name in SHIFT_NAMES
        ):
            active_days += 1
    return active_days


def build_ai_feature_row(
    hotspot: dict,
    service_date: str,
    shift: str,
    cluster_shift_summary: dict[tuple[str, str, str], dict],
    station_shift_summary: dict[tuple[str, str, str], int],
) -> dict:
    cluster_id = hotspot["cluster_id"]
    station = hotspot["police_station"]
    current_stats = cluster_shift_summary.get((cluster_id, service_date, shift), {})
    previous_date, previous_shift = previous_shift_slot(service_date, shift)
    previous_shift_records = cluster_shift_summary.get((cluster_id, previous_date, previous_shift), {}).get("record_count", 0)

    return {
        "cluster_id": cluster_id,
        "police_station": station,
        "location": hotspot["location"],
        "service_date": service_date,
        "shift": shift,
        "weekday": datetime.fromisoformat(service_date).strftime("%A"),
        "current_shift_records": current_stats.get("record_count", 0),
        "current_shift_peak_events": current_stats.get("peak_hour_events", 0),
        "previous_shift_records": previous_shift_records,
        "rolling_3_shift_records": sum_recent_cluster_shifts(cluster_id, service_date, shift, 3, cluster_shift_summary),
        "rolling_9_shift_records": sum_recent_cluster_shifts(cluster_id, service_date, shift, 9, cluster_shift_summary),
        "same_shift_records_7d": sum_same_shift_cluster_days(cluster_id, service_date, shift, 7, cluster_shift_summary),
        "active_days_14d": count_active_cluster_days(cluster_id, service_date, 14, cluster_shift_summary),
        "station_current_shift_records": station_shift_summary.get((station, service_date, shift), 0),
        "station_recent_3_shift_records": sum_recent_station_shifts(station, service_date, shift, 3, station_shift_summary),
        "station_same_shift_records_7d": sum_same_shift_station_days(station, service_date, shift, 7, station_shift_summary),
        "hotspot_record_count": hotspot["record_count"],
        "hotspot_repeat_days": hotspot["repeat_days"],
        "hotspot_peak_hour_events": hotspot["peak_hour_events"],
        "hotspot_priority_score": hotspot["priority_score"],
        "hotspot_impact_proxy_score": hotspot["impact_proxy_score"],
        "severity_band": hotspot["severity_band"],
        "junction_risk": int(hotspot["junction_risk"]),
        "main_road_flag": int(hotspot["main_road_flag"]),
    }


def baseline_risk_score(row: dict) -> int:
    score = 0.0
    score += min(1.0, row["current_shift_records"] / 8) * 24
    score += min(1.0, row["rolling_3_shift_records"] / 18) * 18
    score += min(1.0, row["same_shift_records_7d"] / 10) * 14
    score += min(1.0, row["station_same_shift_records_7d"] / 28) * 10
    score += (row["hotspot_impact_proxy_score"] / 100) * 12
    score += (row["hotspot_priority_score"] / 100) * 10
    score += row["junction_risk"] * 6
    score += row["main_road_flag"] * 6
    return max(0, min(99, int(round(score))))


def baseline_predicted_records(row: dict, risk_score: int) -> int:
    estimate = (
        row["current_shift_records"] * 0.34
        + row["previous_shift_records"] * 0.18
        + row["rolling_3_shift_records"] * 0.12
        + row["same_shift_records_7d"] * 0.08
        + (risk_score / 100) * 1.4
    )
    return max(0, int(round(estimate)))


def confidence_band(row: dict) -> str:
    depth = row["rolling_9_shift_records"] + row["same_shift_records_7d"] + row["active_days_14d"]
    if depth >= 18:
        return "high"
    if depth >= 8:
        return "medium"
    return "low"


def explain_baseline_factors(row: dict) -> list[str]:
    factor_scores = [
        ("recent shift activity", row["current_shift_records"] * 4),
        ("repeat same-shift recurrence", row["same_shift_records_7d"] * 3),
        ("station-level repeat pressure", row["station_same_shift_records_7d"] * 1.2),
        ("high modeled impact", row["hotspot_impact_proxy_score"] * 0.18),
        ("junction risk", 18 if row["junction_risk"] else 0),
        ("main-road obstruction signal", 18 if row["main_road_flag"] else 0),
    ]
    ranked = [label for label, value in sorted(factor_scores, key=lambda item: item[1], reverse=True) if value > 0]
    return ranked[:3]


def build_ai_artifacts(
    hotspots: list[dict],
    cluster_shift_summary: dict[tuple[str, str, str], dict],
    station_shift_summary: dict[tuple[str, str, str], int],
) -> dict:
    if not hotspots or not cluster_shift_summary:
        return {
            "feature_manifest": build_ai_feature_manifest(),
            "training_rows": [],
            "training_preview": [],
            "scoring_rows": [],
            "scoring_preview": [],
            "baseline_summary": {},
            "next_shift_forecast": [],
        }

    hotspot_index = {hotspot["cluster_id"]: hotspot for hotspot in hotspots}
    latest_service_date, latest_shift = max(
        ((service_date, shift) for (_, service_date, shift) in cluster_shift_summary.keys()),
        key=lambda item: slot_position(item[0], item[1]),
    )
    latest_slot_position = slot_position(latest_service_date, latest_shift)
    forecast_service_date, forecast_shift = next_shift_slot(latest_service_date, latest_shift)

    training_rows: list[dict] = []
    last_active_slot_by_cluster: dict[str, int] = {}
    for (cluster_id, service_date, shift), _ in sorted(
        cluster_shift_summary.items(),
        key=lambda item: (slot_position(item[0][1], item[0][2]), item[0][0]),
    ):
        if slot_position(service_date, shift) >= latest_slot_position:
            continue

        hotspot = hotspot_index.get(cluster_id)
        if hotspot is None:
            continue

        row = build_ai_feature_row(hotspot, service_date, shift, cluster_shift_summary, station_shift_summary)
        current_slot = slot_position(service_date, shift)
        previous_active_slot = last_active_slot_by_cluster.get(cluster_id)
        row["staleness_slots_since_active"] = (
            0
            if row["current_shift_records"] > 0
            else min(18, current_slot - previous_active_slot) if previous_active_slot is not None else 18
        )
        target_service_date, target_shift = next_shift_slot(service_date, shift)
        target_stats = cluster_shift_summary.get((cluster_id, target_service_date, target_shift), {})
        risk_score = baseline_risk_score(row)
        predicted_records = baseline_predicted_records(row, risk_score)

        row.update(
            {
                "target_next_shift_date": target_service_date,
                "target_next_shift": target_shift,
                "target_next_shift_records": target_stats.get("record_count", 0),
                "target_next_shift_peak_events": target_stats.get("peak_hour_events", 0),
                "target_next_shift_hotspot": int(target_stats.get("record_count", 0) > 0),
                "baseline_risk_score": risk_score,
                "baseline_predicted_next_shift_records": predicted_records,
                "baseline_confidence": confidence_band(row),
                "baseline_top_factors": " | ".join(explain_baseline_factors(row)),
            }
        )
        training_rows.append(row)
        if row["current_shift_records"] > 0:
            last_active_slot_by_cluster[cluster_id] = current_slot

    if not training_rows:
        return {
            "feature_manifest": build_ai_feature_manifest(),
            "training_rows": [],
            "training_preview": [],
            "scoring_rows": [],
            "scoring_preview": [],
            "baseline_summary": {},
            "next_shift_forecast": [],
        }

    positive_rows = [row for row in training_rows if row["target_next_shift_hotspot"]]
    mae = sum(
        abs(row["baseline_predicted_next_shift_records"] - row["target_next_shift_records"])
        for row in training_rows
    ) / len(training_rows)
    predicted_positive_rows = [row for row in training_rows if row["baseline_risk_score"] >= 55]
    true_positives = sum(1 for row in predicted_positive_rows if row["target_next_shift_hotspot"])
    precision = true_positives / len(predicted_positive_rows) if predicted_positive_rows else 0
    recall = true_positives / len(positive_rows) if positive_rows else 0

    forecast_rows = []
    scoring_rows = []
    for hotspot in hotspots:
        feature_row = build_ai_feature_row(
            hotspot,
            latest_service_date,
            latest_shift,
            cluster_shift_summary,
            station_shift_summary,
        )
        risk_score = baseline_risk_score(feature_row)
        predicted_records = baseline_predicted_records(feature_row, risk_score)
        previous_active_slot = last_active_slot_by_cluster.get(hotspot["cluster_id"])
        staleness_slots = (
            0
            if feature_row["current_shift_records"] > 0
            else min(18, latest_slot_position - previous_active_slot) if previous_active_slot is not None else 18
        )
        feature_row["staleness_slots_since_active"] = staleness_slots
        decay = 0.88 ** min(6, staleness_slots)
        adjusted_risk = max(0, min(99, int(round(risk_score * decay))))
        adjusted_records = max(0, int(round(predicted_records * decay)))

        scoring_rows.append(
            {
                **feature_row,
                "target_next_shift_date": forecast_service_date,
                "target_next_shift": forecast_shift,
                "target_next_shift_records": "",
                "target_next_shift_peak_events": "",
                "target_next_shift_hotspot": "",
                "baseline_risk_score": adjusted_risk,
                "baseline_predicted_next_shift_records": adjusted_records,
                "baseline_confidence": confidence_band(feature_row),
                "baseline_top_factors": " | ".join(explain_baseline_factors(feature_row)),
            }
        )

        forecast_rows.append(
            {
                "cluster_id": hotspot["cluster_id"],
                "location": hotspot["location"],
                "police_station": hotspot["police_station"],
                "source_service_date": latest_service_date,
                "source_shift": latest_shift,
                "forecast_service_date": forecast_service_date,
                "forecast_shift": forecast_shift,
                "predicted_risk_score": adjusted_risk,
                "predicted_next_shift_records": adjusted_records,
                "confidence": confidence_band(feature_row),
                "top_factors": explain_baseline_factors(feature_row),
                "staleness_slots": staleness_slots,
                "impact_proxy_score": hotspot["impact_proxy_score"],
                "priority_score": hotspot["priority_score"],
                "severity_band": hotspot["severity_band"],
            }
        )

    forecast_rows.sort(
        key=lambda row: (
            row["predicted_risk_score"],
            row["predicted_next_shift_records"],
            row["impact_proxy_score"],
        ),
        reverse=True,
    )

    return {
        "feature_manifest": build_ai_feature_manifest(),
        "training_rows": training_rows,
        "training_preview": training_rows[:200],
        "scoring_rows": scoring_rows,
        "scoring_preview": scoring_rows[:200],
        "baseline_summary": {
            "model_type": "heuristic_baseline_for_future_ml_benchmarking",
            "training_rows": len(training_rows),
            "positive_next_shift_rows": len(positive_rows),
            "positive_rate": round(len(positive_rows) / len(training_rows), 4),
            "mae_next_shift_records": round(mae, 3),
            "precision_at_risk_55": round(precision, 3),
            "recall_at_risk_55": round(recall, 3),
            "latest_observed_service_date": latest_service_date,
            "latest_observed_shift": latest_shift,
            "forecast_target_service_date": forecast_service_date,
            "forecast_target_shift": forecast_shift,
            "notes": [
                "This is a benchmark artifact, not a trained ML model.",
                "It creates the modeling-ready baseline needed to compare future predictive models honestly.",
            ],
        },
        "next_shift_forecast": forecast_rows[:30],
    }


def write_csv_rows(destination: Path, rows: list[dict]) -> None:
    if not rows:
        destination.write_text("", encoding="utf-8")
        return

    with destination.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def process_dataset() -> None:
    if not RAW_DATASET.exists():
        raise FileNotFoundError(f"Dataset not found: {RAW_DATASET}")

    for output_dir in OUTPUT_DIRS:
        output_dir.mkdir(parents=True, exist_ok=True)

    row_records: list[dict] = []
    station_summary: dict[str, dict] = defaultdict(
        lambda: {
            "station": "",
            "record_count": 0,
            "peak_hour_events": 0,
            "hotspot_ids": set(),
            "top_violation_counter": Counter(),
            "latest_event": None,
        }
    )
    cluster_state: dict[str, dict] = {}
    cluster_shift_summary: dict[tuple[str, str, str], dict] = defaultdict(
        lambda: {"record_count": 0, "peak_hour_events": 0}
    )
    station_shift_summary: dict[tuple[str, str, str], int] = defaultdict(int)
    latest_event: datetime | None = None

    with RAW_DATASET.open(newline="", encoding="utf-8") as handle:
      reader = csv.DictReader(handle)
      for row in reader:
        labels = [label for label in parse_violation_labels(row.get("violation_type")) if label in PARKING_LABELS]
        if not labels:
            continue

        lat = float(row["latitude"])
        lon = float(row["longitude"])
        event_ts = parse_timestamp(parse_nullable(row.get("created_datetime")))
        if event_ts is None:
            continue
        if latest_event is None or event_ts > latest_event:
            latest_event = event_ts

        location = parse_nullable(row.get("location")) or "Unknown location"
        station = parse_nullable(row.get("police_station")) or "Unknown station"
        junction_name = parse_nullable(row.get("junction_name"))
        cluster_id = make_cluster_id(lat, lon)
        hour = event_ts.astimezone(timezone.utc).hour
        is_peak = hour in PEAK_HOURS
        service_date, shift = derive_service_date_and_shift(event_ts)

        record = {
            "id": row["id"],
            "latitude": lat,
            "longitude": lon,
            "location": location,
            "police_station": station,
            "vehicle_type": parse_nullable(row.get("vehicle_type")) or "UNKNOWN",
            "event_ts": event_ts.isoformat(),
            "event_date": event_ts.date().isoformat(),
            "event_hour": hour,
            "weekday": event_ts.strftime("%A"),
            "service_date": service_date,
            "shift": shift,
            "parking_labels": labels,
            "cluster_id": cluster_id,
            "junction_name": junction_name or "No Junction",
            "is_peak_hour": is_peak,
        }
        row_records.append(record)
        cluster_shift_summary[(cluster_id, service_date, shift)]["record_count"] += 1
        cluster_shift_summary[(cluster_id, service_date, shift)]["peak_hour_events"] += int(is_peak)
        station_shift_summary[(station, service_date, shift)] += 1

        cluster = cluster_state.setdefault(
            cluster_id,
            {
                "cluster_id": cluster_id,
                "latitude_sum": 0.0,
                "longitude_sum": 0.0,
                "record_count": 0,
                "locations": Counter(),
                "stations": Counter(),
                "labels": Counter(),
                "event_dates": set(),
                "event_hours": Counter(),
                "peak_hour_events": 0,
                "latest_event": event_ts,
                "latest_location": location,
                "junction_risk": False,
                "main_road_flag": False,
                "records": [],
            },
        )
        cluster["latitude_sum"] += lat
        cluster["longitude_sum"] += lon
        cluster["record_count"] += 1
        cluster["locations"][location] += 1
        cluster["stations"][station] += 1
        cluster["event_dates"].add(event_ts.date().isoformat())
        cluster["event_hours"][hour] += 1
        cluster["latest_event"] = max(cluster["latest_event"], event_ts)
        cluster["latest_location"] = location
        cluster["peak_hour_events"] += int(is_peak)
        cluster["records"].append(row["id"])

        for label in labels:
            cluster["labels"][label] += 1
            if "MAIN ROAD" in label:
                cluster["main_road_flag"] = True
            if "CROSSING" in label or "TRAFFIC LIGHT" in label or "ZEBRA" in label:
                cluster["junction_risk"] = True

        if junction_name and junction_name.lower() != "no junction":
            cluster["junction_risk"] = True

        station_entry = station_summary[station]
        station_entry["station"] = station
        station_entry["record_count"] += 1
        station_entry["peak_hour_events"] += int(is_peak)
        station_entry["hotspot_ids"].add(cluster_id)
        station_entry["latest_event"] = (
            event_ts
            if station_entry["latest_event"] is None or event_ts > station_entry["latest_event"]
            else station_entry["latest_event"]
        )
        for label in labels:
            station_entry["top_violation_counter"][label] += 1

    if latest_event is None:
        raise RuntimeError("No usable parking records were found in the dataset.")

    hotspots: list[dict] = []
    for cluster in cluster_state.values():
        top_station, _ = cluster["stations"].most_common(1)[0]
        top_location, _ = cluster["locations"].most_common(1)[0]
        top_labels = [label for label, _ in cluster["labels"].most_common(3)]
        severity_mix = severity_from_labels(top_labels)
        recency_delta = latest_event - cluster["latest_event"]
        recency_weight = max(1, 14 - min(14, recency_delta.days))

        hotspots.append(
            {
                "cluster_id": cluster["cluster_id"],
                "latitude": round(cluster["latitude_sum"] / cluster["record_count"], 6),
                "longitude": round(cluster["longitude_sum"] / cluster["record_count"], 6),
                "location": top_location,
                "police_station": top_station,
                "record_count": cluster["record_count"],
                "repeat_days": len(cluster["event_dates"]),
                "peak_hour_events": cluster["peak_hour_events"],
                "top_violation_labels": top_labels,
                "severity_mix": severity_mix,
                "junction_risk": cluster["junction_risk"],
                "main_road_flag": cluster["main_road_flag"],
                "latest_event": cluster["latest_event"].isoformat(),
                "recency_weight": recency_weight,
                "records": cluster["records"][:25],
            }
        )

    hotspots = normalize_scores(hotspots)

    station_rows = []
    for station, item in station_summary.items():
        station_rows.append(
            {
                "station": station,
                "record_count": item["record_count"],
                "hotspot_count": len(item["hotspot_ids"]),
                "peak_hour_events": item["peak_hour_events"],
                "top_violation_labels": [label for label, _ in item["top_violation_counter"].most_common(3)],
                "latest_event": item["latest_event"].isoformat() if item["latest_event"] else None,
            }
        )
    station_rows.sort(key=lambda record: record["record_count"], reverse=True)
    station_resources = build_station_resources(station_rows, hotspots)
    ai_artifacts = build_ai_artifacts(hotspots, cluster_shift_summary, station_shift_summary)

    hourly_counts = Counter(record["event_hour"] for record in row_records)
    weekday_counts = Counter(record["weekday"] for record in row_records)

    top_hotspots = hotspots[:5]
    recommendations = [
        {
            "cluster_id": item["cluster_id"],
            "location": item["location"],
            "station": item["police_station"],
            "priority_score": item["priority_score"],
            "impact_proxy_score": item["impact_proxy_score"],
            "reason_chips": item["reason_chips"],
            "recommendations": item["recommendations"],
        }
        for item in hotspots[:20]
    ]

    brief_summary = {
        "headline": "Today's Priority Parking Pressure",
        "total_parking_records": len(row_records),
        "total_hotspots": len(hotspots),
        "top_station": station_rows[0]["station"] if station_rows else None,
        "peak_hour": hourly_counts.most_common(1)[0][0] if hourly_counts else None,
        "top_hotspots": top_hotspots,
        "top_policy_recommendations": recommendations[:5],
    }

    outputs = {
        "parking_records.json": row_records[:3000],
        "hotspots.json": hotspots,
        "station_summary.json": station_rows,
        "station_resources.json": station_resources,
        "time_summary.json": {
            "hourly_counts": dict(sorted(hourly_counts.items())),
            "weekday_counts": dict(weekday_counts),
        },
        "brief_summary.json": brief_summary,
        "policy_recommendations.json": recommendations,
        "ai_feature_manifest.json": ai_artifacts["feature_manifest"],
        "model_training_preview.json": ai_artifacts["training_preview"],
        "model_scoring_preview.json": ai_artifacts["scoring_preview"],
        "ai_baseline_summary.json": ai_artifacts["baseline_summary"],
        "next_shift_forecast.json": ai_artifacts["next_shift_forecast"],
    }

    for output_dir in OUTPUT_DIRS:
        for filename, payload in outputs.items():
            destination = output_dir / filename
            with destination.open("w", encoding="utf-8") as handle:
                json.dump(payload, handle, indent=2)
        write_csv_rows(output_dir / "model_training_rows.csv", ai_artifacts["training_rows"])
        write_csv_rows(output_dir / "model_scoring_rows.csv", ai_artifacts["scoring_rows"])

    print(f"Processed {len(row_records)} parking records into {len(hotspots)} hotspots.")
    for output_dir in OUTPUT_DIRS:
        print(f"Output written to: {output_dir.resolve()}")


if __name__ == "__main__":
    process_dataset()
