import math
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.scoring.engine import PERCENTAGE_METRICS


class AnalyzeRequest(BaseModel):
    student_id: str | None = Field(default=None, min_length=1, max_length=100)
    metrics: dict[str, float | None] = Field(default_factory=dict)
    source_imported_at: dict[str, str | None] = Field(default_factory=dict)

    @field_validator("metrics", mode="before")
    @classmethod
    def validate_metrics(cls, values: Any) -> dict[str, float | None]:
        if not isinstance(values, dict):
            raise ValueError("metrics must be an object")
        parsed: dict[str, float | None] = {}
        for name, value in values.items():
            if value is None or value == "":
                parsed[name] = None
                continue
            if isinstance(value, bool):
                raise ValueError(f"{name} must be numeric")
            try:
                number = float(value)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{name} must be numeric") from exc
            if not math.isfinite(number):
                raise ValueError(f"{name} must be finite")
            if name in PERCENTAGE_METRICS and not 0 <= number <= 100:
                raise ValueError(f"{name} must be between 0 and 100")
            if name == "semester_gpa" and not 0 <= number <= 10:
                raise ValueError("semester_gpa must be between 0 and 10")
            if name in {"backlogs", "weekly_active_days", "club_activities", "faculty_interactions"} and number < 0:
                raise ValueError(f"{name} cannot be negative")
            if name in {"backlogs", "weekly_active_days", "club_activities", "faculty_interactions"} and not number.is_integer():
                raise ValueError(f"{name} must be an integer")
            parsed[name] = number
        return parsed

    @field_validator("source_imported_at")
    @classmethod
    def validate_sources(cls, values: dict[str, str | None]) -> dict[str, str | None]:
        allowed = {"academic", "attendance", "lms", "engagement", "placement", "skills", "feedback"}
        if not set(values).issubset(allowed):
            raise ValueError("source_imported_at contains an unknown source")
        return values
