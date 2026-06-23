from __future__ import annotations

from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIRS = [
    ROOT_DIR / "data" / "processed",
    ROOT_DIR / "public" / "data" / "processed",
]

TRAINING_FILENAME = "model_training_rows.csv"
SCORING_FILENAME = "model_scoring_rows.csv"

FORECAST_OUTPUT_FILENAME = "model_hotspot_scores.json"
VALIDATION_SUMMARY_FILENAME = "model_validation_summary.json"
MODEL_EXPLANATIONS_FILENAME = "model_explanations.json"
MODEL_BENCHMARK_FILENAME = "heuristic_vs_model_benchmark.json"
MODEL_SELECTION_REPORT_FILENAME = "model_selection_report.json"
MODEL_TUNING_REPORT_FILENAME = "model_tuning_report.json"
MODEL_EVALUATION_SLICES_FILENAME = "model_evaluation_slices.json"
MODEL_ERROR_ANALYSIS_FILENAME = "model_error_analysis_report.json"
MODEL_OPERATING_POLICY_FILENAME = "model_operating_policy.json"

TARGET_COLUMN = "target_next_shift_hotspot"
COUNT_TARGET_COLUMN = "target_next_shift_records"

META_COLUMNS = [
    "cluster_id",
    "police_station",
    "location",
    "service_date",
    "shift",
    "weekday",
    "target_next_shift_date",
    "target_next_shift",
]

NUMERIC_FEATURE_COLUMNS = [
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
    "junction_risk",
    "main_road_flag",
    "staleness_slots_since_active",
]

CATEGORICAL_FEATURE_COLUMNS = [
    "shift",
    "weekday",
    "severity_band",
]

VAL_DAYS = 14
TEST_DAYS = 14
DEFAULT_RISK_THRESHOLD = 0.55
TOP_K_METRIC = 30
THRESHOLD_GRID = [round(value, 2) for value in [x / 100 for x in range(30, 81)]]

SEED = 42

MODEL_SPECS = {
    "xgboost": {
        "model_name": "xgboost_hotspot_classifier_v2",
        "family": "XGBoost",
        "classification_params": {
            "objective": "binary:logistic",
            "eval_metric": "logloss",
            "eta": 0.05,
            "max_depth": 6,
            "subsample": 0.85,
            "colsample_bytree": 0.85,
            "min_child_weight": 3.0,
            "lambda": 1.0,
            "alpha": 0.0,
            "tree_method": "hist",
            "seed": SEED,
        },
        "classification_rounds": 220,
        "tuning_grid": [
            {
                "max_depth": 4,
                "eta": 0.05,
                "subsample": 0.85,
                "colsample_bytree": 0.85,
                "min_child_weight": 2.0,
            },
            {
                "max_depth": 5,
                "eta": 0.05,
                "subsample": 0.9,
                "colsample_bytree": 0.85,
                "min_child_weight": 3.0,
            },
            {
                "max_depth": 6,
                "eta": 0.04,
                "subsample": 0.85,
                "colsample_bytree": 0.9,
                "min_child_weight": 4.0,
            },
            {
                "max_depth": 7,
                "eta": 0.06,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
                "min_child_weight": 3.0,
            },
        ],
        "regression_params": {
            "objective": "reg:squarederror",
            "eval_metric": "rmse",
            "eta": 0.05,
            "max_depth": 6,
            "subsample": 0.85,
            "colsample_bytree": 0.85,
            "min_child_weight": 3.0,
            "lambda": 1.0,
            "alpha": 0.0,
            "tree_method": "hist",
            "seed": SEED,
        },
        "regression_rounds": 180,
    },
    "lightgbm": {
        "model_name": "lightgbm_hotspot_classifier_v2",
        "family": "LightGBM",
        "classification_params": {
            "objective": "binary",
            "metric": "binary_logloss",
            "learning_rate": 0.05,
            "num_leaves": 48,
            "feature_fraction": 0.86,
            "bagging_fraction": 0.88,
            "bagging_freq": 1,
            "min_data_in_leaf": 24,
            "lambda_l2": 1.0,
            "verbosity": -1,
            "seed": SEED,
        },
        "classification_rounds": 220,
        "tuning_grid": [
            {
                "learning_rate": 0.04,
                "num_leaves": 31,
                "feature_fraction": 0.82,
                "bagging_fraction": 0.86,
                "min_data_in_leaf": 16,
            },
            {
                "learning_rate": 0.05,
                "num_leaves": 48,
                "feature_fraction": 0.86,
                "bagging_fraction": 0.88,
                "min_data_in_leaf": 24,
            },
            {
                "learning_rate": 0.06,
                "num_leaves": 63,
                "feature_fraction": 0.9,
                "bagging_fraction": 0.88,
                "min_data_in_leaf": 20,
            },
            {
                "learning_rate": 0.05,
                "num_leaves": 56,
                "feature_fraction": 0.84,
                "bagging_fraction": 0.9,
                "min_data_in_leaf": 32,
            },
        ],
        "regression_params": {
            "objective": "regression",
            "metric": "l2",
            "learning_rate": 0.05,
            "num_leaves": 48,
            "feature_fraction": 0.86,
            "bagging_fraction": 0.88,
            "bagging_freq": 1,
            "min_data_in_leaf": 24,
            "lambda_l2": 1.0,
            "verbosity": -1,
            "seed": SEED,
        },
        "regression_rounds": 180,
    },
}

MODEL_DESCRIPTION = (
    "Tuned and probability-calibrated time-split next-shift hotspot classifier using corridor recurrence, "
    "station pressure, structural road-risk signals, and recency-aware momentum features."
)

FEATURE_GROUPS = [
    "current-shift activity and recent momentum",
    "same-corridor recurrence history",
    "station pressure context",
    "severity and structural road risk",
    "calendar timing and weekend context",
    "dormancy and staleness controls",
    "night-shift interactions",
    "sparse-corridor recovery features",
]
