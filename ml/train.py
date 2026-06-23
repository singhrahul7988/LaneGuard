from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import lightgbm as lgb
import numpy as np
import pandas as pd
import xgboost as xgb

from .config import (
    COUNT_TARGET_COLUMN,
    DEFAULT_RISK_THRESHOLD,
    FEATURE_GROUPS,
    FORECAST_OUTPUT_FILENAME,
    MODEL_BENCHMARK_FILENAME,
    MODEL_DESCRIPTION,
    MODEL_ERROR_ANALYSIS_FILENAME,
    MODEL_EVALUATION_SLICES_FILENAME,
    MODEL_EXPLANATIONS_FILENAME,
    MODEL_OPERATING_POLICY_FILENAME,
    MODEL_SELECTION_REPORT_FILENAME,
    MODEL_SPECS,
    MODEL_TUNING_REPORT_FILENAME,
    PROCESSED_DIRS,
    SCORING_FILENAME,
    TARGET_COLUMN,
    TOP_K_METRIC,
    TRAINING_FILENAME,
    VALIDATION_SUMMARY_FILENAME,
)
from .evaluate import (
    PlattCalibrator,
    apply_platt_calibrator,
    choose_threshold,
    choose_threshold_beta,
    evaluate_binary_predictions,
    fit_platt_calibrator,
    reliability_bins,
)
from .features import build_feature_matrix, load_frame, prepare_scoring_frame, prepare_training_frame
from .infer import build_forecast_rows
from .split import DatasetSplit, split_by_target_date


@dataclass
class TrainedOutputs:
    probabilities: np.ndarray
    predicted_counts: np.ndarray


@dataclass
class CandidateTrial:
    family_key: str
    family: str
    model_name: str
    variant_label: str
    tuning_index: int
    params_override: dict[str, Any]
    threshold: float
    calibrator: PlattCalibrator
    validation_raw_metrics: dict[str, float]
    validation_calibrated_metrics: dict[str, float]
    test_calibrated_metrics: dict[str, float]


def _apply_dormancy_guard(
    probabilities: np.ndarray,
    predicted_counts: np.ndarray,
    frame: pd.DataFrame,
) -> tuple[np.ndarray, np.ndarray]:
    guarded_probabilities = probabilities.astype(float).copy()
    guarded_counts = predicted_counts.astype(float).copy()

    staleness = frame["staleness_slots_since_active"].to_numpy(dtype=float)
    dormant_flag = frame["dormant_corridor_flag"].to_numpy(dtype=float)
    current_shift = frame["current_shift_records"].to_numpy(dtype=float)
    same_shift = frame["same_shift_records_7d"].to_numpy(dtype=float)
    active_days = frame["active_days_14d"].to_numpy(dtype=float)
    station_current = frame["station_current_shift_records"].to_numpy(dtype=float)

    factors = np.ones(len(frame), dtype=float)

    dormant_mask = (
        (dormant_flag >= 1)
        & (current_shift <= 0)
        & (same_shift <= 0)
        & (active_days <= 1)
    )
    factors[dormant_mask] = np.minimum(
        factors[dormant_mask],
        np.clip(1.0 - 0.06 * staleness[dormant_mask], 0.12, 0.42),
    )

    stale_low_station_mask = (
        (current_shift <= 0)
        & (same_shift <= 1)
        & (station_current <= 2)
        & (staleness >= 6)
    )
    factors[stale_low_station_mask] = np.minimum(factors[stale_low_station_mask], 0.55)

    guarded_probabilities = np.clip(guarded_probabilities * factors, 1e-6, 1 - 1e-6)
    guarded_counts = np.maximum(0.0, guarded_counts * factors)
    return guarded_probabilities, guarded_counts


def _class_weight(labels: np.ndarray) -> float:
    positives = float(labels.sum())
    negatives = float(len(labels) - positives)
    return max(1.0, negatives / max(1.0, positives))


def _merge_params(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    merged.update(override)
    return merged


def _train_xgboost(
    train_x: pd.DataFrame,
    train_y: np.ndarray,
    train_counts: np.ndarray,
    predict_x: pd.DataFrame,
    cls_params: dict[str, Any],
    reg_params: dict[str, Any],
    cls_rounds: int,
    reg_rounds: int,
) -> TrainedOutputs:
    dtrain_cls = xgb.DMatrix(train_x, label=train_y, feature_names=list(train_x.columns))
    dpredict_cls = xgb.DMatrix(predict_x, feature_names=list(train_x.columns))
    classifier_params = dict(cls_params)
    classifier_params["scale_pos_weight"] = _class_weight(train_y)
    classifier = xgb.train(classifier_params, dtrain_cls, num_boost_round=cls_rounds)
    probabilities = classifier.predict(dpredict_cls)

    dtrain_reg = xgb.DMatrix(train_x, label=train_counts, feature_names=list(train_x.columns))
    dpredict_reg = xgb.DMatrix(predict_x, feature_names=list(train_x.columns))
    regressor = xgb.train(dict(reg_params), dtrain_reg, num_boost_round=reg_rounds)
    predicted_counts = np.maximum(0.0, regressor.predict(dpredict_reg))

    return TrainedOutputs(probabilities=probabilities, predicted_counts=predicted_counts)


def _train_lightgbm(
    train_x: pd.DataFrame,
    train_y: np.ndarray,
    train_counts: np.ndarray,
    predict_x: pd.DataFrame,
    cls_params: dict[str, Any],
    reg_params: dict[str, Any],
    cls_rounds: int,
    reg_rounds: int,
) -> TrainedOutputs:
    classifier_params = dict(cls_params)
    classifier_params["scale_pos_weight"] = _class_weight(train_y)
    dtrain_cls = lgb.Dataset(train_x, label=train_y, feature_name=list(train_x.columns), free_raw_data=False)
    classifier = lgb.train(classifier_params, dtrain_cls, num_boost_round=cls_rounds)
    probabilities = classifier.predict(predict_x)

    dtrain_reg = lgb.Dataset(train_x, label=train_counts, feature_name=list(train_x.columns), free_raw_data=False)
    regressor = lgb.train(dict(reg_params), dtrain_reg, num_boost_round=reg_rounds)
    predicted_counts = np.maximum(0.0, regressor.predict(predict_x))

    return TrainedOutputs(probabilities=probabilities, predicted_counts=predicted_counts)


def _predict_for_family(
    family_key: str,
    train_x: pd.DataFrame,
    train_y: np.ndarray,
    train_counts: np.ndarray,
    predict_x: pd.DataFrame,
    params_override: dict[str, Any] | None = None,
) -> TrainedOutputs:
    spec = MODEL_SPECS[family_key]
    params_override = params_override or {}
    cls_params = _merge_params(spec["classification_params"], params_override)
    reg_params = _merge_params(spec["regression_params"], params_override)

    if family_key == "xgboost":
        return _train_xgboost(
            train_x,
            train_y,
            train_counts,
            predict_x,
            cls_params,
            reg_params,
            spec["classification_rounds"],
            spec["regression_rounds"],
        )
    return _train_lightgbm(
        train_x,
        train_y,
        train_counts,
        predict_x,
        cls_params,
        reg_params,
        spec["classification_rounds"],
        spec["regression_rounds"],
    )


def _evaluate_baseline(frame: pd.DataFrame) -> dict[str, float]:
    probabilities = frame["baseline_risk_score"].to_numpy(dtype=float) / 100.0
    predicted_counts = frame["baseline_predicted_next_shift_records"].to_numpy(dtype=float)
    return evaluate_binary_predictions(
        frame[TARGET_COLUMN].to_numpy(dtype=int),
        probabilities,
        DEFAULT_RISK_THRESHOLD,
        frame[COUNT_TARGET_COLUMN].to_numpy(dtype=float),
        predicted_counts,
    )


def _candidate_trials(
    split: DatasetSplit,
    train_x: pd.DataFrame,
    validation_x: pd.DataFrame,
) -> tuple[list[CandidateTrial], dict[str, float], dict[str, float]]:
    train_labels = split.train[TARGET_COLUMN].to_numpy(dtype=int)
    train_counts = split.train[COUNT_TARGET_COLUMN].to_numpy(dtype=float)
    validation_labels = split.validation[TARGET_COLUMN].to_numpy(dtype=int)
    validation_counts = split.validation[COUNT_TARGET_COLUMN].to_numpy(dtype=float)
    test_labels = split.test[TARGET_COLUMN].to_numpy(dtype=int)
    test_counts = split.test[COUNT_TARGET_COLUMN].to_numpy(dtype=float)

    combined_frame = pd.concat([split.train, split.validation], ignore_index=True)
    combined_prepared = prepare_training_frame(combined_frame)
    combined_x, combined_columns = build_feature_matrix(combined_prepared)
    combined_labels = combined_prepared[TARGET_COLUMN].to_numpy(dtype=int)
    combined_counts = combined_prepared[COUNT_TARGET_COLUMN].to_numpy(dtype=float)
    test_x, _ = build_feature_matrix(split.test, combined_columns)

    trials: list[CandidateTrial] = []
    for family_key, spec in MODEL_SPECS.items():
        for index, override in enumerate(spec.get("tuning_grid", [{}]), start=1):
            validation_outputs = _predict_for_family(
                family_key,
                train_x,
                train_labels,
                train_counts,
                validation_x,
                override,
            )
            validation_probabilities, validation_predicted_counts = _apply_dormancy_guard(
                validation_outputs.probabilities,
                validation_outputs.predicted_counts,
                split.validation,
            )
            raw_validation_metrics = evaluate_binary_predictions(
                validation_labels,
                validation_probabilities,
                DEFAULT_RISK_THRESHOLD,
                validation_counts,
                validation_predicted_counts,
            )
            calibrator = fit_platt_calibrator(validation_labels, validation_probabilities)
            calibrated_validation_probabilities = apply_platt_calibrator(validation_probabilities, calibrator)
            threshold = choose_threshold(validation_labels, calibrated_validation_probabilities)
            calibrated_validation_metrics = evaluate_binary_predictions(
                validation_labels,
                calibrated_validation_probabilities,
                threshold.threshold,
                validation_counts,
                validation_predicted_counts,
            )

            test_outputs = _predict_for_family(
                family_key,
                combined_x,
                combined_labels,
                combined_counts,
                test_x,
                override,
            )
            test_probabilities, test_predicted_counts = _apply_dormancy_guard(
                test_outputs.probabilities,
                test_outputs.predicted_counts,
                split.test,
            )
            calibrated_test_probabilities = apply_platt_calibrator(test_probabilities, calibrator)
            calibrated_test_metrics = evaluate_binary_predictions(
                test_labels,
                calibrated_test_probabilities,
                threshold.threshold,
                test_counts,
                test_predicted_counts,
            )

            trials.append(
                CandidateTrial(
                    family_key=family_key,
                    family=spec["family"],
                    model_name=spec["model_name"],
                    variant_label=f"{spec['family']} grid {index}",
                    tuning_index=index,
                    params_override=override,
                    threshold=threshold.threshold,
                    calibrator=calibrator,
                    validation_raw_metrics=raw_validation_metrics,
                    validation_calibrated_metrics=calibrated_validation_metrics,
                    test_calibrated_metrics=calibrated_test_metrics,
                )
            )

    return trials, _evaluate_baseline(split.validation), _evaluate_baseline(split.test)


def _select_champion(trials: list[CandidateTrial]) -> CandidateTrial:
    return max(
        trials,
        key=lambda trial: (
            trial.validation_calibrated_metrics["average_precision"],
            trial.validation_calibrated_metrics["f1_at_selected_threshold"],
            trial.validation_calibrated_metrics["recall_at_selected_threshold"],
        ),
    )


def _build_scoring_forecast(
    champion: CandidateTrial,
    split: DatasetSplit,
    scoring_frame: pd.DataFrame,
) -> list[dict[str, Any]]:
    combined_frame = pd.concat([split.train, split.validation], ignore_index=True)
    combined_prepared = prepare_training_frame(combined_frame)
    scoring_prepared = prepare_scoring_frame(scoring_frame)
    combined_x, feature_columns = build_feature_matrix(combined_prepared)
    scoring_x, _ = build_feature_matrix(scoring_prepared, feature_columns)

    scoring_outputs = _predict_for_family(
        champion.family_key,
        combined_x,
        combined_prepared[TARGET_COLUMN].to_numpy(dtype=int),
        combined_prepared[COUNT_TARGET_COLUMN].to_numpy(dtype=float),
        scoring_x,
        champion.params_override,
    )
    guarded_probabilities, guarded_counts = _apply_dormancy_guard(
        scoring_outputs.probabilities,
        scoring_outputs.predicted_counts,
        scoring_prepared,
    )
    calibrated_probabilities = apply_platt_calibrator(guarded_probabilities, champion.calibrator)
    return build_forecast_rows(
        scoring_prepared,
        calibrated_probabilities,
        guarded_counts,
        champion.model_name,
    )


def _slice_metrics(frame: pd.DataFrame, probability_column: str, top_station_count: int = 8) -> dict[str, dict[str, dict[str, float]]]:
    def summarize(group: pd.DataFrame) -> dict[str, float]:
        labels = group[TARGET_COLUMN].to_numpy(dtype=int)
        probabilities = group[probability_column].to_numpy(dtype=float)
        counts = group[COUNT_TARGET_COLUMN].to_numpy(dtype=float)
        predicted_counts = group.get("predicted_count", pd.Series(np.zeros(len(group)))).to_numpy(dtype=float)
        metrics = evaluate_binary_predictions(labels, probabilities, DEFAULT_RISK_THRESHOLD, counts, predicted_counts)
        return {
            "rows": int(len(group)),
            "positive_rate": round(float(labels.mean()) if len(labels) else 0.0, 4),
            "average_precision": metrics["average_precision"],
            "precision_at_risk_55": metrics["precision_at_risk_55"],
            "recall_at_risk_55": metrics["recall_at_risk_55"],
            "precision_at_top_30": metrics["precision_at_top_30"],
            "recall_at_top_30": metrics["recall_at_top_30"],
            "mae_next_shift_records": metrics["mae_next_shift_records"],
        }

    slices = {"shift": {}, "severity_band": {}, "station": {}}
    for shift_name, group in frame.groupby("target_next_shift"):
        slices["shift"][str(shift_name)] = summarize(group)
    for severity, group in frame.groupby("severity_band"):
        slices["severity_band"][str(severity)] = summarize(group)
    top_stations = frame["police_station"].value_counts().head(top_station_count).index
    for station in top_stations:
        slices["station"][str(station)] = summarize(frame[frame["police_station"] == station])
    return slices


def _confusion_summary(frame: pd.DataFrame, threshold: float) -> dict[str, int | float]:
    predictions = (frame["predicted_probability"].to_numpy(dtype=float) >= threshold).astype(int)
    labels = frame[TARGET_COLUMN].to_numpy(dtype=int)
    tp = int(((predictions == 1) & (labels == 1)).sum())
    fp = int(((predictions == 1) & (labels == 0)).sum())
    tn = int(((predictions == 0) & (labels == 0)).sum())
    fn = int(((predictions == 0) & (labels == 1)).sum())
    return {
        "threshold": round(threshold, 2),
        "true_positive": tp,
        "false_positive": fp,
        "true_negative": tn,
        "false_negative": fn,
    }


def _top_error_rows(frame: pd.DataFrame, threshold: float, error_type: str, limit: int = 12) -> list[dict[str, Any]]:
    if error_type == "false_positive":
        subset = frame[(frame[TARGET_COLUMN] == 0) & (frame["predicted_probability"] >= threshold)].copy()
        subset = subset.sort_values(["predicted_probability", "predicted_count"], ascending=[False, False])
    else:
        subset = frame[(frame[TARGET_COLUMN] == 1) & (frame["predicted_probability"] < threshold)].copy()
        subset = subset.sort_values(["target_next_shift_records", "predicted_probability"], ascending=[False, True])

    rows = []
    for record in subset.head(limit).to_dict("records"):
        rows.append(
            {
                "cluster_id": record["cluster_id"],
                "police_station": record["police_station"],
                "location": record["location"],
                "target_next_shift": record["target_next_shift"],
                "severity_band": record["severity_band"],
                "actual_next_shift_records": int(record["target_next_shift_records"]),
                "predicted_probability": round(float(record["predicted_probability"]), 4),
                "predicted_next_shift_records": round(float(record["predicted_count"]), 2),
                "staleness_slots_since_active": int(record.get("staleness_slots_since_active", 0)),
                "same_shift_records_7d": int(record.get("same_shift_records_7d", 0)),
                "station_same_shift_records_7d": int(record.get("station_same_shift_records_7d", 0)),
            }
        )
    return rows


def _station_error_summary(frame: pd.DataFrame, threshold: float) -> list[dict[str, Any]]:
    working = frame.copy()
    working["predicted_positive"] = (working["predicted_probability"] >= threshold).astype(int)
    summaries = []
    for station, group in working.groupby("police_station"):
        fp = int(((group["predicted_positive"] == 1) & (group[TARGET_COLUMN] == 0)).sum())
        fn = int(((group["predicted_positive"] == 0) & (group[TARGET_COLUMN] == 1)).sum())
        positives = int(group[TARGET_COLUMN].sum())
        if fp == 0 and fn == 0 and positives == 0:
            continue
        summaries.append(
            {
                "station": station,
                "rows": int(len(group)),
                "actual_positive_rows": positives,
                "false_positive": fp,
                "false_negative": fn,
                "avg_predicted_probability": round(float(group["predicted_probability"].mean()), 4),
            }
        )
    return sorted(summaries, key=lambda item: (item["false_negative"], item["false_positive"], item["actual_positive_rows"]), reverse=True)[:12]


def _build_operating_policy(validation_frame: pd.DataFrame, test_frame: pd.DataFrame) -> dict[str, Any]:
    def summarize_scope(scope_name: str, validation_scope: pd.DataFrame, test_scope: pd.DataFrame, beta: float) -> dict[str, Any]:
        selection = choose_threshold_beta(
            validation_scope[TARGET_COLUMN].to_numpy(dtype=int),
            validation_scope["predicted_probability"].to_numpy(dtype=float),
            beta,
        )
        validation_metrics = evaluate_binary_predictions(
            validation_scope[TARGET_COLUMN].to_numpy(dtype=int),
            validation_scope["predicted_probability"].to_numpy(dtype=float),
            selection.threshold,
            validation_scope[COUNT_TARGET_COLUMN].to_numpy(dtype=float),
            validation_scope["predicted_count"].to_numpy(dtype=float),
        )
        test_metrics = evaluate_binary_predictions(
            test_scope[TARGET_COLUMN].to_numpy(dtype=int),
            test_scope["predicted_probability"].to_numpy(dtype=float),
            selection.threshold,
            test_scope[COUNT_TARGET_COLUMN].to_numpy(dtype=float),
            test_scope["predicted_count"].to_numpy(dtype=float),
        )
        return {
            "scope": scope_name,
            "beta": beta,
            "recommended_threshold": round(selection.threshold, 2),
            "validation_selection_score": round(selection.f1, 4),
            "validation_precision": round(selection.precision, 4),
            "validation_recall": round(selection.recall, 4),
            "validation_metrics": validation_metrics,
            "test_audit_metrics": test_metrics,
        }

    shift_policy = {}
    for shift_name in sorted(validation_frame["target_next_shift"].astype(str).unique()):
        validation_scope = validation_frame[validation_frame["target_next_shift"] == shift_name]
        test_scope = test_frame[test_frame["target_next_shift"] == shift_name]
        beta = 2.0 if shift_name == "Night" else 1.5
        shift_policy[shift_name] = summarize_scope(shift_name, validation_scope, test_scope, beta)

    severity_policy = {}
    for severity in sorted(validation_frame["severity_band"].astype(str).unique()):
        validation_scope = validation_frame[validation_frame["severity_band"] == severity]
        test_scope = test_frame[test_frame["severity_band"] == severity]
        severity_policy[severity] = summarize_scope(severity, validation_scope, test_scope, 1.5)

    global_policy = summarize_scope("global", validation_frame, test_frame, 1.5)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "selection_rule": "Choose threshold on validation using F-beta, then audit the same threshold on holdout test.",
        "global": global_policy,
        "by_shift": shift_policy,
        "by_severity": severity_policy,
    }


def _build_champion_test_frame(split: DatasetSplit, champion: CandidateTrial) -> pd.DataFrame:
    combined_frame = pd.concat([split.train, split.validation], ignore_index=True)
    combined_prepared = prepare_training_frame(combined_frame)
    test_prepared = prepare_training_frame(split.test)
    combined_x, feature_columns = build_feature_matrix(combined_prepared)
    test_x, _ = build_feature_matrix(test_prepared, feature_columns)
    final_outputs = _predict_for_family(
        champion.family_key,
        combined_x,
        combined_prepared[TARGET_COLUMN].to_numpy(dtype=int),
        combined_prepared[COUNT_TARGET_COLUMN].to_numpy(dtype=float),
        test_x,
        champion.params_override,
    )
    guarded_probabilities, guarded_counts = _apply_dormancy_guard(
        final_outputs.probabilities,
        final_outputs.predicted_counts,
        test_prepared,
    )
    frame = test_prepared.copy()
    frame["raw_probability"] = guarded_probabilities
    frame["predicted_probability"] = apply_platt_calibrator(guarded_probabilities, champion.calibrator)
    frame["predicted_count"] = guarded_counts
    return frame


def _build_champion_validation_frame(split: DatasetSplit, champion: CandidateTrial) -> pd.DataFrame:
    train_prepared = prepare_training_frame(split.train)
    validation_prepared = prepare_training_frame(split.validation)
    train_x, feature_columns = build_feature_matrix(train_prepared)
    validation_x, _ = build_feature_matrix(validation_prepared, feature_columns)
    outputs = _predict_for_family(
        champion.family_key,
        train_x,
        train_prepared[TARGET_COLUMN].to_numpy(dtype=int),
        train_prepared[COUNT_TARGET_COLUMN].to_numpy(dtype=float),
        validation_x,
        champion.params_override,
    )
    guarded_probabilities, guarded_counts = _apply_dormancy_guard(
        outputs.probabilities,
        outputs.predicted_counts,
        validation_prepared,
    )
    frame = validation_prepared.copy()
    frame["raw_probability"] = guarded_probabilities
    frame["predicted_probability"] = apply_platt_calibrator(guarded_probabilities, champion.calibrator)
    frame["predicted_count"] = guarded_counts
    return frame


def build_artifacts(processed_dir: Path) -> dict[str, Any]:
    training_frame = prepare_training_frame(load_frame(processed_dir / TRAINING_FILENAME))
    scoring_frame = load_frame(processed_dir / SCORING_FILENAME)
    split = split_by_target_date(training_frame)

    train_x, feature_columns = build_feature_matrix(split.train)
    validation_x, _ = build_feature_matrix(split.validation, feature_columns)
    trials, baseline_validation, baseline_test = _candidate_trials(split, train_x, validation_x)
    champion = _select_champion(trials)
    forecast_rows = _build_scoring_forecast(champion, split, scoring_frame)
    validation_frame = _build_champion_validation_frame(split, champion)
    test_frame = _build_champion_test_frame(split, champion)

    tuning_report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "selection_metric": "average_precision",
        "calibration_method": "platt_logit_scaling",
        "candidates": [
            {
                "family_key": trial.family_key,
                "family": trial.family,
                "model_name": trial.model_name,
                "variant_label": trial.variant_label,
                "tuning_index": trial.tuning_index,
                "params_override": trial.params_override,
                "chosen_threshold": round(trial.threshold, 2),
                "calibration": {
                    "method": "platt_logit_scaling",
                    "slope": round(trial.calibrator.slope, 6),
                    "intercept": round(trial.calibrator.intercept, 6),
                },
                "validation_raw_metrics": trial.validation_raw_metrics,
                "validation_calibrated_metrics": trial.validation_calibrated_metrics,
                "test_calibrated_metrics": trial.test_calibrated_metrics,
                "validation_average_precision_gain": round(
                    trial.validation_calibrated_metrics["average_precision"] - trial.validation_raw_metrics["average_precision"], 4
                ),
                "validation_brier_gain": round(
                    trial.validation_raw_metrics["brier_score"] - trial.validation_calibrated_metrics["brier_score"], 4
                ),
            }
            for trial in trials
        ],
        "champion": {
            "model_name": champion.model_name,
            "variant_label": champion.variant_label,
            "params_override": champion.params_override,
            "chosen_threshold": round(champion.threshold, 2),
            "selection_reason": "Highest calibrated validation average precision with F1 and recall tie-breaks.",
        },
    }

    validation_summary = {
        "model_name": champion.model_name,
        "train_rows": int(len(split.train)),
        "validation_rows": int(len(split.validation)),
        "test_rows": int(len(split.test)),
        "train_start_date": split.train_range.start,
        "train_end_date": split.train_range.end,
        "validation_start_date": split.validation_range.start,
        "validation_end_date": split.validation_range.end,
        "test_start_date": split.test_range.start,
        "test_end_date": split.test_range.end,
        "chosen_threshold": round(champion.threshold, 2),
        "primary_metric_name": "average_precision",
        "primary_metric_value": champion.validation_calibrated_metrics["average_precision"],
        "holdout_primary_metric_value": champion.test_calibrated_metrics["average_precision"],
        "average_precision": champion.test_calibrated_metrics["average_precision"],
        "baseline_average_precision": baseline_test["average_precision"],
        "mae_next_shift_records": champion.test_calibrated_metrics["mae_next_shift_records"],
        "baseline_mae_next_shift_records": baseline_test["mae_next_shift_records"],
        "precision_at_risk_55": champion.test_calibrated_metrics["precision_at_risk_55"],
        "recall_at_risk_55": champion.test_calibrated_metrics["recall_at_risk_55"],
        "baseline_precision_at_risk_55": baseline_test["precision_at_risk_55"],
        "baseline_recall_at_risk_55": baseline_test["recall_at_risk_55"],
        "precision_at_top_30": champion.test_calibrated_metrics["precision_at_top_30"],
        "recall_at_top_30": champion.test_calibrated_metrics["recall_at_top_30"],
        "log_loss": champion.test_calibrated_metrics["log_loss"],
        "brier_score": champion.test_calibrated_metrics["brier_score"],
        "calibration_method": "platt_logit_scaling",
        "calibration_slope": round(champion.calibrator.slope, 6),
        "calibration_intercept": round(champion.calibrator.intercept, 6),
        "notes": [
            "Hyperparameter tuning was run over fixed grid variants for XGBoost and LightGBM on the validation window.",
            "Probability calibration uses Platt-style logit scaling fit on validation predictions, then applied to the final champion outputs.",
            "Predicted next-shift records remain a supporting regression output for planner continuity; hotspot risk ranking is still the main decision signal.",
        ],
    }

    benchmark_summary = {
        "model_name": champion.model_name,
        "baseline_name": "heuristic_baseline_v1",
        "validation_rows": int(len(split.validation)),
        "test_rows": int(len(split.test)),
        "validation_start_date": split.validation_range.start,
        "validation_end_date": split.validation_range.end,
        "test_start_date": split.test_range.start,
        "test_end_date": split.test_range.end,
        "chosen_threshold": round(champion.threshold, 2),
        "primary_metric_name": "average_precision",
        "primary_metric_value": champion.validation_calibrated_metrics["average_precision"],
        "metrics": [
            _metric_entry("average_precision", "Average Precision", champion.test_calibrated_metrics["average_precision"], baseline_test["average_precision"], "higher"),
            _metric_entry("precision_at_risk_55", "Precision @ Risk 55", champion.test_calibrated_metrics["precision_at_risk_55"], baseline_test["precision_at_risk_55"], "higher"),
            _metric_entry("recall_at_risk_55", "Recall @ Risk 55", champion.test_calibrated_metrics["recall_at_risk_55"], baseline_test["recall_at_risk_55"], "higher"),
            _metric_entry("precision_at_top_30", "Precision @ Top 30", champion.test_calibrated_metrics["precision_at_top_30"], baseline_test["precision_at_top_30"], "higher"),
            _metric_entry("recall_at_top_30", "Recall @ Top 30", champion.test_calibrated_metrics["recall_at_top_30"], baseline_test["recall_at_top_30"], "higher"),
            _metric_entry("mae_next_shift_records", "Next-shift MAE", champion.test_calibrated_metrics["mae_next_shift_records"], baseline_test["mae_next_shift_records"], "lower"),
            _metric_entry("log_loss", "Log Loss", champion.test_calibrated_metrics["log_loss"], baseline_test["log_loss"], "lower"),
            _metric_entry("brier_score", "Brier Score", champion.test_calibrated_metrics["brier_score"], baseline_test["brier_score"], "lower"),
        ],
        "summary_note": (
            f"{champion.model_name} was selected after tuning and calibration on the validation window, "
            "then compared against the heuristic baseline on the untouched holdout test window."
        ),
    }

    evaluation_slices = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_name": champion.model_name,
        "chosen_threshold": round(champion.threshold, 2),
        "validation_slices": _slice_metrics(validation_frame, "predicted_probability"),
        "test_slices": _slice_metrics(test_frame, "predicted_probability"),
    }
    operating_policy = _build_operating_policy(validation_frame, test_frame)

    error_analysis_report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_name": champion.model_name,
        "chosen_threshold": round(champion.threshold, 2),
        "validation_confusion": _confusion_summary(validation_frame, champion.threshold),
        "test_confusion": _confusion_summary(test_frame, champion.threshold),
        "validation_reliability": {
            "raw": reliability_bins(validation_frame[TARGET_COLUMN].to_numpy(dtype=int), validation_frame["raw_probability"].to_numpy(dtype=float)),
            "calibrated": reliability_bins(validation_frame[TARGET_COLUMN].to_numpy(dtype=int), validation_frame["predicted_probability"].to_numpy(dtype=float)),
        },
        "test_reliability": {
            "raw": reliability_bins(test_frame[TARGET_COLUMN].to_numpy(dtype=int), test_frame["raw_probability"].to_numpy(dtype=float)),
            "calibrated": reliability_bins(test_frame[TARGET_COLUMN].to_numpy(dtype=int), test_frame["predicted_probability"].to_numpy(dtype=float)),
        },
        "top_false_positives": _top_error_rows(test_frame, champion.threshold, "false_positive"),
        "top_false_negatives": _top_error_rows(test_frame, champion.threshold, "false_negative"),
        "station_error_summary": _station_error_summary(test_frame, champion.threshold),
    }

    selection_report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "split_policy": {
            "validation_days": 14,
            "test_days": 14,
            "target_column": TARGET_COLUMN,
            "selection_metric": "average_precision",
            "top_k_metric": TOP_K_METRIC,
        },
        "baseline_reference": {
            "model_name": "heuristic_baseline_v1",
            "validation_metrics": baseline_validation,
            "test_metrics": baseline_test,
        },
        "candidates": [
            {
                "family_key": trial.family_key,
                "family": trial.family,
                "model_name": trial.model_name,
                "variant_label": trial.variant_label,
                "params_override": trial.params_override,
                "chosen_threshold": round(trial.threshold, 2),
                "calibration": {
                    "method": "platt_logit_scaling",
                    "slope": round(trial.calibrator.slope, 6),
                    "intercept": round(trial.calibrator.intercept, 6),
                },
                "validation_raw_metrics": trial.validation_raw_metrics,
                "validation_calibrated_metrics": trial.validation_calibrated_metrics,
                "test_calibrated_metrics": trial.test_calibrated_metrics,
            }
            for trial in trials
        ],
        "champion": {
            "family_key": champion.family_key,
            "model_name": champion.model_name,
            "variant_label": champion.variant_label,
            "params_override": champion.params_override,
            "chosen_threshold": round(champion.threshold, 2),
            "selection_reason": "Highest calibrated validation average precision with F1 and recall tie-break.",
            "validation_calibrated_metrics": champion.validation_calibrated_metrics,
            "test_calibrated_metrics": champion.test_calibrated_metrics,
        },
    }

    explanations = {
        "model_name": champion.model_name,
        "description": MODEL_DESCRIPTION,
        "feature_groups": FEATURE_GROUPS,
    }

    return {
        FORECAST_OUTPUT_FILENAME: forecast_rows,
        VALIDATION_SUMMARY_FILENAME: validation_summary,
        MODEL_EXPLANATIONS_FILENAME: explanations,
        MODEL_BENCHMARK_FILENAME: benchmark_summary,
        MODEL_SELECTION_REPORT_FILENAME: selection_report,
        MODEL_TUNING_REPORT_FILENAME: tuning_report,
        MODEL_EVALUATION_SLICES_FILENAME: evaluation_slices,
        MODEL_OPERATING_POLICY_FILENAME: operating_policy,
        MODEL_ERROR_ANALYSIS_FILENAME: error_analysis_report,
    }


def _metric_entry(key: str, label: str, model_value: float, baseline_value: float, better: str) -> dict[str, Any]:
    delta = round(model_value - baseline_value, 4)
    if model_value == baseline_value:
        winner = "tie"
    elif better == "higher":
        winner = "model" if model_value > baseline_value else "baseline"
    else:
        winner = "model" if model_value < baseline_value else "baseline"
    return {
        "key": key,
        "label": label,
        "model_value": round(model_value, 4),
        "baseline_value": round(baseline_value, 4),
        "delta": delta,
        "better": better,
        "winner": winner,
    }


def write_artifacts(processed_dir: Path, artifacts: dict[str, Any]) -> None:
    for filename, payload in artifacts.items():
        destination = processed_dir / filename
        with destination.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)


def main() -> None:
    for processed_dir in PROCESSED_DIRS:
        artifacts = build_artifacts(processed_dir)
        write_artifacts(processed_dir, artifacts)
        print(f"ML artifacts written to: {processed_dir.resolve()}")


if __name__ == "__main__":
    main()
