from __future__ import annotations

from dataclasses import dataclass
from math import isfinite

import numpy as np

from .config import DEFAULT_RISK_THRESHOLD, THRESHOLD_GRID, TOP_K_METRIC


@dataclass(frozen=True)
class ThresholdSelection:
    threshold: float
    precision: float
    recall: float
    f1: float


@dataclass(frozen=True)
class PlattCalibrator:
    slope: float
    intercept: float


def clip_probabilities(probabilities: np.ndarray) -> np.ndarray:
    return np.clip(probabilities.astype(float), 1e-6, 1 - 1e-6)


def logit(probabilities: np.ndarray) -> np.ndarray:
    clipped = clip_probabilities(probabilities)
    return np.log(clipped / (1.0 - clipped))


def sigmoid(values: np.ndarray) -> np.ndarray:
    clipped = np.clip(values, -40.0, 40.0)
    return 1.0 / (1.0 + np.exp(-clipped))


def average_precision_score(labels: np.ndarray, probabilities: np.ndarray) -> float:
    labels = labels.astype(int)
    probabilities = probabilities.astype(float)
    positives = int(labels.sum())
    if positives <= 0:
        return 0.0

    order = np.argsort(-probabilities, kind="mergesort")
    ranked = labels[order]
    cumulative_true = np.cumsum(ranked)
    precision = cumulative_true / np.arange(1, len(ranked) + 1)
    return float((precision * ranked).sum() / positives)


def log_loss_score(labels: np.ndarray, probabilities: np.ndarray) -> float:
    labels = labels.astype(float)
    probabilities = clip_probabilities(probabilities)
    losses = -(labels * np.log(probabilities) + (1 - labels) * np.log(1 - probabilities))
    return float(losses.mean())


def brier_score(labels: np.ndarray, probabilities: np.ndarray) -> float:
    labels = labels.astype(float)
    probabilities = probabilities.astype(float)
    return float(np.mean((probabilities - labels) ** 2))


def precision_recall_f1(labels: np.ndarray, probabilities: np.ndarray, threshold: float) -> tuple[float, float, float]:
    labels = labels.astype(int)
    predictions = (probabilities >= threshold).astype(int)
    true_positive = int(((predictions == 1) & (labels == 1)).sum())
    predicted_positive = int((predictions == 1).sum())
    actual_positive = int((labels == 1).sum())

    precision = true_positive / predicted_positive if predicted_positive else 0.0
    recall = true_positive / actual_positive if actual_positive else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if precision + recall else 0.0
    return float(precision), float(recall), float(f1)


def precision_recall_fbeta(
    labels: np.ndarray,
    probabilities: np.ndarray,
    threshold: float,
    beta: float,
) -> tuple[float, float, float]:
    precision, recall, _ = precision_recall_f1(labels, probabilities, threshold)
    beta_sq = beta * beta
    denominator = beta_sq * precision + recall
    score = ((1 + beta_sq) * precision * recall) / denominator if denominator else 0.0
    return precision, recall, float(score)


def top_k_metrics(labels: np.ndarray, probabilities: np.ndarray, top_k: int = TOP_K_METRIC) -> tuple[float, float]:
    labels = labels.astype(int)
    if len(labels) == 0:
        return 0.0, 0.0

    top_k = max(1, min(top_k, len(labels)))
    order = np.argsort(-probabilities, kind="mergesort")[:top_k]
    hits = labels[order].sum()
    precision = float(hits / top_k)
    recall = float(hits / labels.sum()) if labels.sum() else 0.0
    return precision, recall


def mean_absolute_error(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.mean(np.abs(actual.astype(float) - predicted.astype(float))))


def choose_threshold(labels: np.ndarray, probabilities: np.ndarray) -> ThresholdSelection:
    best = ThresholdSelection(threshold=DEFAULT_RISK_THRESHOLD, precision=0.0, recall=0.0, f1=0.0)

    for threshold in THRESHOLD_GRID:
        precision, recall, f1 = precision_recall_f1(labels, probabilities, threshold)
        candidate = ThresholdSelection(threshold=threshold, precision=precision, recall=recall, f1=f1)
        if candidate.f1 > best.f1:
            best = candidate
            continue
        if isfinite(candidate.f1) and abs(candidate.f1 - best.f1) <= 1e-9 and candidate.recall > best.recall:
            best = candidate

    return best


def choose_threshold_beta(labels: np.ndarray, probabilities: np.ndarray, beta: float) -> ThresholdSelection:
    best = ThresholdSelection(threshold=DEFAULT_RISK_THRESHOLD, precision=0.0, recall=0.0, f1=0.0)

    for threshold in THRESHOLD_GRID:
        precision, recall, score = precision_recall_fbeta(labels, probabilities, threshold, beta)
        candidate = ThresholdSelection(threshold=threshold, precision=precision, recall=recall, f1=score)
        if candidate.f1 > best.f1:
            best = candidate
            continue
        if isfinite(candidate.f1) and abs(candidate.f1 - best.f1) <= 1e-9 and candidate.recall > best.recall:
            best = candidate

    return best


def fit_platt_calibrator(labels: np.ndarray, probabilities: np.ndarray, max_iter: int = 40) -> PlattCalibrator:
    labels = labels.astype(float)
    logits = logit(probabilities)
    slope = 1.0
    intercept = 0.0

    for _ in range(max_iter):
        calibrated = sigmoid(slope * logits + intercept)
        residual = calibrated - labels
        weights = calibrated * (1.0 - calibrated)

        grad_slope = float(np.sum(residual * logits))
        grad_intercept = float(np.sum(residual))
        h_aa = float(np.sum(weights * logits * logits) + 1e-6)
        h_ab = float(np.sum(weights * logits))
        h_bb = float(np.sum(weights) + 1e-6)
        determinant = h_aa * h_bb - h_ab * h_ab
        if abs(determinant) < 1e-9:
            break

        step_slope = (h_bb * grad_slope - h_ab * grad_intercept) / determinant
        step_intercept = (-h_ab * grad_slope + h_aa * grad_intercept) / determinant

        slope -= step_slope
        intercept -= step_intercept
        slope = max(0.05, min(6.0, slope))

        if abs(step_slope) < 1e-5 and abs(step_intercept) < 1e-5:
            break

    return PlattCalibrator(slope=float(slope), intercept=float(intercept))


def apply_platt_calibrator(probabilities: np.ndarray, calibrator: PlattCalibrator) -> np.ndarray:
    logits = logit(probabilities)
    return clip_probabilities(sigmoid(calibrator.slope * logits + calibrator.intercept))


def reliability_bins(labels: np.ndarray, probabilities: np.ndarray, bins: int = 10) -> list[dict]:
    labels = labels.astype(int)
    probabilities = probabilities.astype(float)
    edges = np.linspace(0.0, 1.0, bins + 1)
    rows: list[dict] = []
    for index in range(bins):
        low = float(edges[index])
        high = float(edges[index + 1])
        if index == bins - 1:
            mask = (probabilities >= low) & (probabilities <= high)
        else:
            mask = (probabilities >= low) & (probabilities < high)
        bucket_labels = labels[mask]
        bucket_probabilities = probabilities[mask]
        if len(bucket_labels) == 0:
            rows.append(
                {
                    "bin": index + 1,
                    "range_start": round(low, 2),
                    "range_end": round(high, 2),
                    "rows": 0,
                    "mean_predicted_probability": None,
                    "empirical_positive_rate": None,
                }
            )
            continue
        rows.append(
            {
                "bin": index + 1,
                "range_start": round(low, 2),
                "range_end": round(high, 2),
                "rows": int(len(bucket_labels)),
                "mean_predicted_probability": round(float(bucket_probabilities.mean()), 4),
                "empirical_positive_rate": round(float(bucket_labels.mean()), 4),
            }
        )
    return rows


def evaluate_binary_predictions(
    labels: np.ndarray,
    probabilities: np.ndarray,
    threshold: float,
    count_actual: np.ndarray,
    count_predicted: np.ndarray,
) -> dict:
    precision_55, recall_55, _ = precision_recall_f1(labels, probabilities, DEFAULT_RISK_THRESHOLD)
    precision_selected, recall_selected, f1_selected = precision_recall_f1(labels, probabilities, threshold)
    precision_top_k, recall_top_k = top_k_metrics(labels, probabilities)

    return {
        "average_precision": round(average_precision_score(labels, probabilities), 4),
        "precision_at_risk_55": round(precision_55, 4),
        "recall_at_risk_55": round(recall_55, 4),
        "precision_at_selected_threshold": round(precision_selected, 4),
        "recall_at_selected_threshold": round(recall_selected, 4),
        "f1_at_selected_threshold": round(f1_selected, 4),
        "precision_at_top_30": round(precision_top_k, 4),
        "recall_at_top_30": round(recall_top_k, 4),
        "log_loss": round(log_loss_score(labels, probabilities), 4),
        "brier_score": round(brier_score(labels, probabilities), 4),
        "mae_next_shift_records": round(mean_absolute_error(count_actual, count_predicted), 4),
    }
