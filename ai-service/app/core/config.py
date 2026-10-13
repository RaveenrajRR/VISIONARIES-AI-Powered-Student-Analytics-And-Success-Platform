import json
import math
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=False)

DEFAULT_WEIGHTS = {
    "academic": 0.30,
    "attendance": 0.20,
    "lms": 0.10,
    "engagement": 0.10,
    "placement": 0.15,
    "skills": 0.10,
    "feedback": 0.05,
}
DEFAULT_THRESHOLDS = {
    "attendance_below": 75.0,
    "gpa_below": 6.0,
    "backlog_count": 2,
    "placement_below": 50.0,
    "falling_trend_below": 0.0,
    "stale_after_days": 180,
}


def _read_json_setting(name: str, default: dict[str, Any]) -> dict[str, Any]:
    raw = os.getenv(name)
    if not raw:
        return default.copy()
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{name} must contain a JSON object") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{name} must contain a JSON object")
    return value


def _load_weights() -> dict[str, float]:
    values = _read_json_setting("AI_SCORE_WEIGHTS_JSON", DEFAULT_WEIGHTS)
    if set(values) != set(DEFAULT_WEIGHTS):
        raise ValueError("AI_SCORE_WEIGHTS_JSON must specify all seven component weights")
    weights = {key: float(value) for key, value in values.items()}
    if any(not math.isfinite(value) or value < 0 for value in weights.values()):
        raise ValueError("AI_SCORE_WEIGHTS_JSON values must be finite and non-negative")
    total = sum(weights.values())
    if total <= 0:
        raise ValueError("AI_SCORE_WEIGHTS_JSON must have a positive total")
    return {key: value / total for key, value in weights.items()}


def _load_thresholds() -> dict[str, float]:
    values = _read_json_setting("AI_RISK_THRESHOLDS_JSON", DEFAULT_THRESHOLDS)
    if set(values) != set(DEFAULT_THRESHOLDS):
        raise ValueError("AI_RISK_THRESHOLDS_JSON must specify all supported thresholds")
    thresholds = {key: float(value) for key, value in values.items()}
    if any(not math.isfinite(value) or value < 0 for value in thresholds.values()):
        raise ValueError("AI_RISK_THRESHOLDS_JSON values must be finite and non-negative")
    if thresholds["attendance_below"] > 100 or thresholds["placement_below"] > 100:
        raise ValueError("Percentage risk thresholds cannot exceed 100")
    if thresholds["gpa_below"] > 10:
        raise ValueError("GPA risk threshold cannot exceed 10")
    return thresholds


WEIGHTS = _load_weights()
THRESHOLDS = _load_thresholds()
SOURCES = tuple(DEFAULT_WEIGHTS)
