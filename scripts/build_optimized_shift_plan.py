import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


INPUT_DIRS = [
    Path("data") / "processed",
    Path("public") / "data" / "processed",
]

HOTSPOTS_FILENAME = "hotspots.json"
RESOURCES_FILENAME = "station_resources.json"
FORECAST_FILENAME = "model_hotspot_scores.json"

SHIFT_NAMES = ("Morning", "Afternoon", "Night")
STRATEGIES = {
    "balanced": {
        "label": "Balanced",
        "note": "Mixes relief, forecast risk, and unit efficiency for a shift-safe queue.",
        "priority_weight": 0.50,
        "impact_weight": 0.26,
        "risk_weight": 0.52,
        "records_weight": 1.6,
        "confidence_bonus": {"high": 8, "medium": 4, "low": 1},
        "no_forecast_penalty": 0,
        "sort_mode": "efficiency",
        "beam_width": 56,
        "candidate_limit": 18,
    },
    "max_relief": {
        "label": "Max Relief",
        "note": "Pushes the queue toward the biggest expected congestion reduction first.",
        "priority_weight": 0.40,
        "impact_weight": 0.40,
        "risk_weight": 0.58,
        "records_weight": 2.2,
        "confidence_bonus": {"high": 5, "medium": 2, "low": 0},
        "no_forecast_penalty": 0,
        "sort_mode": "score",
        "beam_width": 48,
        "candidate_limit": 18,
    },
    "high_confidence": {
        "label": "High Confidence",
        "note": "Prefers corridors where the model has stronger historical support and more stable evidence.",
        "priority_weight": 0.42,
        "impact_weight": 0.22,
        "risk_weight": 0.62,
        "records_weight": 1.4,
        "confidence_bonus": {"high": 12, "medium": 6, "low": 0},
        "no_forecast_penalty": 10,
        "sort_mode": "confidence",
        "beam_width": 48,
        "candidate_limit": 16,
    },
}


@dataclass
class Demand:
    officers: int = 0
    patrol_cars: int = 0
    tow_trucks: int = 0
    constables: int = 0

    def add(self, other: "Demand") -> "Demand":
        return Demand(
            officers=self.officers + other.officers,
            patrol_cars=self.patrol_cars + other.patrol_cars,
            tow_trucks=self.tow_trucks + other.tow_trucks,
            constables=self.constables + other.constables,
        )

    def subtract(self, other: "Demand") -> "Demand":
        return Demand(
            officers=self.officers - other.officers,
            patrol_cars=self.patrol_cars - other.patrol_cars,
            tow_trucks=self.tow_trucks - other.tow_trucks,
            constables=self.constables - other.constables,
        )

    def fits_within(self, capacity: "Demand") -> bool:
        return (
            self.officers <= capacity.officers
            and self.patrol_cars <= capacity.patrol_cars
            and self.tow_trucks <= capacity.tow_trucks
            and self.constables <= capacity.constables
        )

    def to_dict(self) -> dict:
        return {
            "officers": self.officers,
            "patrol_cars": self.patrol_cars,
            "tow_trucks": self.tow_trucks,
            "constables": self.constables,
        }


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def resource_plan_for_hotspot(item: dict) -> Demand:
    officers = 4 if item["severity_band"] == "critical" else 3 if item["severity_band"] == "high" else 2
    patrol_cars = 2 if item["severity_band"] == "critical" else 1
    tow_trucks = 1
    constables = 2 if item["junction_risk"] or item["peak_hour_events"] >= max(3, item["record_count"] * 0.35) else 1

    if item["repeat_days"] >= 8:
        officers += 1
    if "DOUBLE PARKING" in item["top_violation_labels"]:
        tow_trucks = max(tow_trucks, 1)

    return Demand(
        officers=officers,
        patrol_cars=patrol_cars,
        tow_trucks=tow_trucks,
        constables=constables,
    )


def demand_cost(demand: Demand) -> float:
    return (
        demand.officers * 1.0
        + demand.patrol_cars * 2.8
        + demand.tow_trucks * 3.2
        + demand.constables * 0.9
    )


def confidence_rank(confidence: str | None) -> int:
    if confidence == "high":
        return 3
    if confidence == "medium":
        return 2
    if confidence == "low":
        return 1
    return 0


def confidence_weight(confidence: str | None) -> float:
    if confidence == "high":
        return 1.0
    if confidence == "medium":
        return 0.66
    if confidence == "low":
        return 0.38
    return 0.16


def aggregate_shift_capacity(resources: list[dict], stations: list[str], shift: str) -> tuple[Demand, int]:
    selected = resources if not stations else [resource for resource in resources if resource["station"] in stations]
    capacity = Demand()
    recommended_queue_size = 0

    for resource in selected:
        shift_resource = resource["shift_resources"][shift]["totals"]
        capacity = capacity.add(
            Demand(
                officers=shift_resource["officers"],
                patrol_cars=shift_resource["patrol_cars"],
                tow_trucks=shift_resource["tow_trucks"],
                constables=shift_resource["constables"],
            )
        )
        recommended_queue_size += resource["recommended_queue_size"]

    return capacity, recommended_queue_size


def hotspot_optimizer_score(hotspot: dict, forecast: dict | None, shift: str, strategy_id: str) -> tuple[float, list[str]]:
    strategy = STRATEGIES[strategy_id]
    score = hotspot["priority_score"] * strategy["priority_weight"] + hotspot["impact_proxy_score"] * strategy["impact_weight"]
    rationale = []

    severity_bonus = {"critical": 16, "high": 9, "moderate": 4}[hotspot["severity_band"]]
    score += severity_bonus
    rationale.append(f"{hotspot['severity_band']} severity")

    if hotspot["repeat_days"] >= 8:
        score += 6
        rationale.append("high recurrence")
    if hotspot["junction_risk"]:
        score += 5
        rationale.append("junction risk")
    if hotspot["main_road_flag"]:
        score += 5
        rationale.append("main-road obstruction")

    if forecast and forecast.get("forecast_shift") == shift:
        score += forecast.get("predicted_risk_score", 0) * strategy["risk_weight"]
        score += forecast.get("predicted_next_shift_records", 0) * strategy["records_weight"]
        confidence = forecast.get("confidence")
        score += strategy["confidence_bonus"].get(confidence, 0)
        rationale.extend(forecast.get("top_factors", [])[:2])
    else:
        score -= strategy["no_forecast_penalty"]

    return round(score, 2), rationale[:4]


def sort_key_for_candidate(candidate: dict, strategy_id: str) -> tuple:
    strategy = STRATEGIES[strategy_id]
    if strategy["sort_mode"] == "score":
        return (
            candidate["optimized_score"],
            candidate["efficiency"],
            candidate["confidence_rank"],
            candidate["hotspot"]["priority_score"],
        )
    if strategy["sort_mode"] == "confidence":
        return (
            candidate["confidence_rank"],
            candidate["support_count"],
            candidate["optimized_score"],
            candidate["efficiency"],
        )
    return (
        candidate["efficiency"],
        candidate["optimized_score"],
        candidate["confidence_rank"],
        candidate["hotspot"]["priority_score"],
    )


def state_rank(state: dict, strategy_id: str) -> tuple:
    if strategy_id == "max_relief":
        return (
            state["relief_sum"],
            state["objective_score"],
            state["critical_count"],
            state["high_confidence_count"],
            state["unique_station_count"],
        )
    if strategy_id == "high_confidence":
        return (
            state["high_confidence_count"],
            state["support_sum"],
            state["objective_score"],
            state["critical_count"],
            state["relief_sum"],
        )
    return (
        state["objective_score"],
        state["unique_station_count"],
        state["critical_count"],
        state["relief_sum"],
        state["high_confidence_count"],
    )


def build_optimizer_subset(candidates: list[dict], capacity: Demand, target_queue_size: int, strategy_id: str) -> list[dict]:
    strategy = STRATEGIES[strategy_id]
    limited_candidates = candidates[: strategy["candidate_limit"]]
    beam = [
        {
            "selected": [],
            "used": Demand(),
            "objective_score": 0.0,
            "relief_sum": 0.0,
            "critical_count": 0,
            "high_confidence_count": 0,
            "support_sum": 0,
            "unique_station_count": 0,
            "stations": frozenset(),
        }
    ]

    for candidate in limited_candidates:
        next_states = list(beam)

        for state in beam:
            if len(state["selected"]) >= target_queue_size:
                continue

            next_used = state["used"].add(candidate["demand"])
            if not next_used.fits_within(capacity):
                continue

            next_stations = state["stations"] | {candidate["hotspot"]["police_station"]}
            next_states.append(
                {
                    "selected": [*state["selected"], candidate],
                    "used": next_used,
                    "objective_score": state["objective_score"] + candidate["optimized_score"],
                    "relief_sum": state["relief_sum"] + candidate["hotspot"]["impact_proxy_score"],
                    "critical_count": state["critical_count"] + (1 if candidate["hotspot"]["severity_band"] == "critical" else 0),
                    "high_confidence_count": state["high_confidence_count"] + (1 if candidate["confidence_rank"] == 3 else 0),
                    "support_sum": state["support_sum"] + candidate["support_count"],
                    "unique_station_count": len(next_stations),
                    "stations": next_stations,
                }
            )

        deduped = {}
        for state in next_states:
            signature = (
                len(state["selected"]),
                state["used"].officers,
                state["used"].patrol_cars,
                state["used"].tow_trucks,
                state["used"].constables,
                tuple(sorted(state["stations"])),
            )
            existing = deduped.get(signature)
            if existing is None or state_rank(state, strategy_id) > state_rank(existing, strategy_id):
                deduped[signature] = state

        beam = sorted(deduped.values(), key=lambda item: state_rank(item, strategy_id), reverse=True)[: strategy["beam_width"]]

    best_state = max(beam, key=lambda item: state_rank(item, strategy_id))
    selected = best_state["selected"]
    selected.sort(
        key=lambda item: (
            item["optimized_score"],
            item["hotspot"]["impact_proxy_score"],
            item["confidence_rank"],
        ),
        reverse=True,
    )
    return selected


def build_plan_confidence(selected: list[dict], projected_relief: int) -> tuple[str, float, dict, str]:
    if not selected:
        return (
            "low",
            0.0,
            {"low": 0, "high": 0},
            "No modeled hotspot package is selected yet, so relief confidence is not established.",
        )

    weighted_sum = 0.0
    weight_total = 0.0
    forecast_coverage = 0

    for item in selected:
        hotspot_weight = max(1.0, item["hotspot"]["impact_proxy_score"] / 25)
        base_confidence = confidence_weight(item["forecast"].get("confidence") if item["forecast"] else None)
        support_weight = min(1.0, item["support_count"] / 90) if item["support_count"] else 0.18
        signal = base_confidence * 0.65 + support_weight * 0.35
        weighted_sum += signal * hotspot_weight
        weight_total += hotspot_weight
        if item["forecast"]:
            forecast_coverage += 1

    coverage_ratio = forecast_coverage / len(selected)
    confidence_score = ((weighted_sum / max(1.0, weight_total)) * 0.78) + coverage_ratio * 0.22
    confidence_score = round(max(0.0, min(1.0, confidence_score)), 3)

    if confidence_score >= 0.72:
        band = "high"
        spread = 5
    elif confidence_score >= 0.46:
        band = "medium"
        spread = 9
    else:
        band = "low"
        spread = 14

    range_low = max(0, projected_relief - spread)
    range_high = min(60, projected_relief + spread)
    range_payload = {"low": range_low, "high": range_high}

    if coverage_ratio >= 0.8:
        note = "Most queued corridors have direct forecast support, so the projected relief band is relatively stable."
    elif coverage_ratio >= 0.45:
        note = "The relief band combines modeled corridors with partially inferred ones, so moderate variance should be expected."
    else:
        note = "Much of this relief estimate is inferred from structural hotspot signals rather than direct forecast coverage."

    return band, confidence_score, range_payload, note


def build_plan_for_scope(
    hotspots: list[dict],
    resources: list[dict],
    forecasts_by_cluster: dict[str, dict],
    shift: str,
    station_filter: str,
    strategy_id: str,
) -> dict:
    stations = [] if station_filter == "All Stations" else [station_filter]
    capacity, recommended_queue_size = aggregate_shift_capacity(resources, stations, shift)
    strategy = STRATEGIES[strategy_id]

    candidates = [
        hotspot
        for hotspot in hotspots
        if station_filter == "All Stations" or hotspot["police_station"] == station_filter
    ]
    scored_candidates = []

    for hotspot in candidates:
        forecast = forecasts_by_cluster.get(hotspot["cluster_id"])
        demand = resource_plan_for_hotspot(hotspot)
        optimized_score, rationale = hotspot_optimizer_score(hotspot, forecast, shift, strategy_id)
        scored_candidates.append(
            {
                "hotspot": hotspot,
                "forecast": forecast,
                "demand": demand,
                "optimized_score": optimized_score,
                "rationale": rationale,
                "efficiency": optimized_score / max(1.0, demand_cost(demand)),
                "confidence_rank": confidence_rank(forecast.get("confidence") if forecast else None),
                "support_count": forecast.get("support_count", 0) if forecast else 0,
            }
        )

    scored_candidates.sort(key=lambda item: sort_key_for_candidate(item, strategy_id), reverse=True)

    target_queue_size = max(1, recommended_queue_size if station_filter != "All Stations" else min(12, recommended_queue_size))
    selected = build_optimizer_subset(scored_candidates, capacity, target_queue_size, strategy_id)
    used = Demand()
    for item in selected:
        used = used.add(item["demand"])

    remaining = capacity.subtract(used)
    projected_relief = (
        min(
            52,
            round(
                sum(item["hotspot"]["impact_proxy_score"] for item in selected)
                / max(1, len(selected))
                / 2.15
            ),
        )
        if selected
        else 0
    )
    impact_confidence, impact_confidence_score, projected_relief_range, confidence_note = build_plan_confidence(
        selected,
        projected_relief,
    )

    return {
        "station_filter": station_filter,
        "shift": shift,
        "strategy": strategy_id,
        "strategy_label": strategy["label"],
        "strategy_note": strategy["note"],
        "recommended_queue_size": target_queue_size,
        "recommended_items": [
            {
                "cluster_id": item["hotspot"]["cluster_id"],
                "police_station": item["hotspot"]["police_station"],
                "location": item["hotspot"]["location"],
                "severity_band": item["hotspot"]["severity_band"],
                "optimized_score": item["optimized_score"],
                "predicted_risk_score": item["forecast"].get("predicted_risk_score") if item["forecast"] else None,
                "predicted_next_shift_records": item["forecast"].get("predicted_next_shift_records") if item["forecast"] else None,
                "confidence": item["forecast"].get("confidence") if item["forecast"] else None,
                "support_count": item["forecast"].get("support_count") if item["forecast"] else None,
                "rationale": item["rationale"],
                "demand": item["demand"].to_dict(),
            }
            for item in selected
        ],
        "demand": used.to_dict(),
        "remaining_capacity": remaining.to_dict(),
        "projected_relief": projected_relief,
        "projected_relief_range": projected_relief_range,
        "impact_confidence": impact_confidence,
        "impact_confidence_score": impact_confidence_score,
        "confidence_note": confidence_note,
        "fits_capacity": used.fits_within(capacity),
    }


def build_optimizer_artifact(processed_dir: Path) -> dict:
    hotspots = load_json(processed_dir / HOTSPOTS_FILENAME)
    resources = load_json(processed_dir / RESOURCES_FILENAME)
    forecasts = load_json(processed_dir / FORECAST_FILENAME)
    forecasts_by_cluster = {row["cluster_id"]: row for row in forecasts}

    station_names = sorted({resource["station"] for resource in resources})
    plans = []

    for shift in SHIFT_NAMES:
        for station_filter in ("All Stations", *station_names):
            for strategy_id in STRATEGIES:
                plans.append(build_plan_for_scope(hotspots, resources, forecasts_by_cluster, shift, station_filter, strategy_id))

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_name": forecasts[0]["model_name"] if forecasts else "historical_rate_model_v1",
        "plan_method": "strategy_aware_beam_optimizer_v3",
        "strategies": [
            {"id": strategy_id, "label": spec["label"], "note": spec["note"]}
            for strategy_id, spec in STRATEGIES.items()
        ],
        "plans": plans,
    }


def main() -> None:
    for output_dir in INPUT_DIRS:
        artifact = build_optimizer_artifact(output_dir)
        destination = output_dir / "optimized_shift_plan.json"
        with destination.open("w", encoding="utf-8") as handle:
            json.dump(artifact, handle, indent=2)
        print(f"Optimized shift plan written to: {destination.resolve()}")


if __name__ == "__main__":
    main()
