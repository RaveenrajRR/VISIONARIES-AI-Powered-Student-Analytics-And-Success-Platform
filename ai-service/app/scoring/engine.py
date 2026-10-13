from datetime import datetime, timezone
from math import isfinite
from typing import Any

from app.core.config import SOURCES, THRESHOLDS, WEIGHTS

COMPONENT_METRICS = {
    "academic": ("semester_gpa", "backlogs"),
    "attendance": ("attendance_pct",),
    "lms": ("assignment_completion_pct", "course_progress_pct"),
    "engagement": ("event_participation_pct", "club_activities"),
    "placement": ("aptitude_pct", "coding_pct", "mock_interview_pct"),
    "skills": ("technical_skill_pct", "communication_pct", "portfolio_pct"),
    "feedback": ("wellbeing_support_pct", "course_satisfaction_pct"),
}
PERCENTAGE_METRICS = {
    "attendance_pct", "assignment_completion_pct", "course_progress_pct",
    "event_participation_pct", "aptitude_pct", "coding_pct",
    "mock_interview_pct", "technical_skill_pct", "communication_pct",
    "portfolio_pct", "wellbeing_support_pct", "course_satisfaction_pct",
}


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if isfinite(parsed) else None


def clamp(value: Any) -> float:
    number = _number(value)
    if number is None:
        raise ValueError("Metric values must be finite numbers")
    return max(0.0, min(100.0, number))


def _component_values(metrics: dict[str, Any]) -> dict[str, float]:
    components: dict[str, float] = {}
    gpa = _number(metrics.get("semester_gpa"))
    if gpa is not None:
        backlogs = _number(metrics.get("backlogs")) or 0
        components["academic"] = clamp(gpa * 10 - min(40, max(0, backlogs) * 10))

    attendance = _number(metrics.get("attendance_pct"))
    if attendance is not None:
        components["attendance"] = clamp(attendance)

    lms = [clamp(metrics[key]) for key in COMPONENT_METRICS["lms"] if _number(metrics.get(key)) is not None]
    if lms:
        components["lms"] = sum(lms) / len(lms)

    engagement = []
    event_participation = _number(metrics.get("event_participation_pct"))
    club_activities = _number(metrics.get("club_activities"))
    if event_participation is not None:
        engagement.append(clamp(event_participation))
    if club_activities is not None:
        engagement.append(clamp(club_activities * 12.5))
    if engagement:
        components["engagement"] = sum(engagement) / len(engagement)

    for name in ("placement", "skills", "feedback"):
        values = [clamp(metrics[key]) for key in COMPONENT_METRICS[name] if _number(metrics.get(key)) is not None]
        if values:
            components[name] = sum(values) / len(values)
    return components


def _freshness(
    imported_at: dict[str, Any] | None,
    available_components: dict[str, float],
    weights: dict[str, float],
    now: datetime | None = None,
) -> tuple[float | None, dict[str, dict[str, Any]]]:
    if not imported_at:
        return None, {}
    checked_at = now or datetime.now(timezone.utc)
    freshness: dict[str, dict[str, Any]] = {}
    fresh_weight = 0.0
    has_timestamp = False
    max_age = THRESHOLDS["stale_after_days"]
    for component in available_components:
        value = imported_at.get(component)
        if not value:
            freshness[component] = {"status": "unknown", "imported_at": None, "age_days": None}
            continue
        try:
            timestamp = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            age = (checked_at - timestamp).total_seconds() / 86400
        except (TypeError, ValueError):
            freshness[component] = {"status": "unknown", "imported_at": None, "age_days": None}
            continue
        has_timestamp = True
        fresh = -1 <= age <= max_age
        if fresh:
            fresh_weight += weights[component]
        freshness[component] = {
            "status": "fresh" if fresh else "stale",
            "imported_at": timestamp.isoformat(),
            "age_days": round(max(age, 0), 1),
        }
    freshness_pct = round(fresh_weight / sum(weights[key] for key in available_components) * 100, 1) if has_timestamp else None
    return freshness_pct, freshness


def calculate_score(
    metrics: dict[str, Any],
    source_imported_at: dict[str, Any] | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Calculate a provisional weighted score only from valid, observed components."""
    components = _component_values(metrics)
    available_weight = sum(WEIGHTS[key] for key in components)
    score = round(sum(components[key] * WEIGHTS[key] for key in components) / available_weight, 2) if available_weight else None
    coverage = round(available_weight * 100, 1)
    freshness_pct, freshness = _freshness(source_imported_at, components, WEIGHTS, now)
    confidence = round(coverage * freshness_pct / 100, 1) if freshness_pct is not None else None
    return {
        "score": score,
        "coverage_pct": coverage,
        "confidence_pct": confidence,
        "freshness_pct": freshness_pct,
        "source_freshness": freshness,
        "components": {key: round(value, 2) for key, value in components.items()},
        "weights_used": {key: round(WEIGHTS[key] / available_weight, 4) for key in components} if available_weight else {},
        "provisional_weights": WEIGHTS.copy(),
        "method": "provisional weighted baseline; available component weights renormalized",
        "confidence_basis": "Data-quality proxy from weighted source coverage and observed source freshness; not a probability of success.",
    }


def analyze_risk(metrics: dict[str, Any]) -> dict[str, Any]:
    reasons: list[dict[str, Any]] = []
    placement_reasons: list[dict[str, Any]] = []
    attendance = _number(metrics.get("attendance_pct"))
    gpa = _number(metrics.get("semester_gpa"))
    backlogs = _number(metrics.get("backlogs")) or 0
    trend = _number(metrics.get("trend"))
    thresholds = THRESHOLDS

    if attendance is not None and attendance < thresholds["attendance_below"]:
        reasons.append({
            "metric": "attendance_pct", "value": attendance,
            "threshold": f"<{thresholds['attendance_below']:g}",
            "reason": "Attendance is below the configured support threshold.",
        })
    if gpa is not None and gpa < thresholds["gpa_below"]:
        reasons.append({
            "metric": "semester_gpa", "value": gpa,
            "threshold": f"<{thresholds['gpa_below']:g}/10",
            "reason": "Current GPA is below the configured support threshold.",
        })
    if backlogs >= thresholds["backlog_count"]:
        reasons.append({
            "metric": "backlogs", "value": backlogs,
            "threshold": f">={thresholds['backlog_count']:g}",
            "reason": "Multiple backlogs indicate a need for subject-level review.",
        })
    if trend is not None and trend < thresholds["falling_trend_below"]:
        reasons.append({
            "metric": "trend", "value": trend,
            "threshold": f"<{thresholds['falling_trend_below']:g}",
            "reason": "The observed academic performance trend is falling.",
        })
    for key in ("aptitude_pct", "coding_pct", "mock_interview_pct"):
        value = _number(metrics.get(key))
        if value is not None and value < thresholds["placement_below"]:
            placement_reasons.append({
                "metric": key, "value": value,
                "threshold": f"<{thresholds['placement_below']:g}",
                "reason": f"{key.replace('_pct', '').replace('_', ' ').title()} practice score is below the configured threshold.",
            })

    risk_level = "high" if len(reasons) >= 2 else "moderate" if reasons else "low"
    placement_level = "high" if len(placement_reasons) >= 2 else "moderate" if placement_reasons else "low"
    return {
        "academic_risk": bool(reasons),
        "academic_risk_level": risk_level,
        "academic_reasons": reasons,
        "placement_risk": bool(placement_reasons),
        "placement_risk_level": placement_level,
        "placement_reasons": placement_reasons,
        "thresholds": thresholds.copy(),
        "disclaimer": "Decision support only; rules are configurable and not a validated predictive model.",
    }


def placement_readiness(metrics: dict[str, Any]) -> dict[str, Any]:
    fields = {
        "aptitude": "aptitude_pct",
        "coding": "coding_pct",
        "mock_interview": "mock_interview_pct",
        "technical_skills": "technical_skill_pct",
        "communication": "communication_pct",
        "portfolio": "portfolio_pct",
    }
    observed = {name: _number(metrics.get(key)) for name, key in fields.items()}
    available = {name: value for name, value in observed.items() if value is not None}
    readiness = round(sum(available.values()) / len(available), 2) if available else None
    gaps = [
        {"skill": name.replace("_", " ").title(), "value": value, "target": 70, "gap": round(70 - value, 1)}
        for name, value in available.items() if value < 70
    ]
    focus = sorted(gaps, key=lambda gap: gap["gap"], reverse=True)
    plan = [
        {"skill": gap["skill"], "action": f"Schedule a weekly {gap['skill'].lower()} practice session and review evidence with faculty.", "weeks": 4}
        for gap in focus[:3]
    ]
    return {
        "readiness_pct": readiness,
        "coverage_pct": round(len(available) / len(fields) * 100, 1),
        "observed_metrics": available,
        "skill_gaps": gaps,
        "practice_plan": plan,
        "disclaimer": "Readiness is based only on observed indicators; no placement outcome is predicted or guaranteed.",
    }


def recommend(metrics: dict[str, Any], score_result: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []

    def add(kind: str, title: str, priority: str, evidence: str, rationale: str, days: int, outcome: str) -> None:
        out.append({
            "type": kind, "title": title, "priority": priority,
            "evidence": evidence, "rationale": rationale,
            "suggested_action": rationale, "follow_up_days": days,
            "expected_outcome": outcome,
        })

    attendance = _number(metrics.get("attendance_pct"))
    if attendance is not None and attendance < THRESHOLDS["attendance_below"]:
        add("attendance_follow_up", "Attendance follow-up", "high",
            f"Attendance is {attendance:g}% (configured threshold {THRESHOLDS['attendance_below']:g}%).",
            "Meet with the student to identify barriers and agree on a supportive attendance plan.", 7,
            "Review attendance percentage at the follow-up and agree next support steps.")

    gpa = _number(metrics.get("semester_gpa"))
    backlogs = _number(metrics.get("backlogs")) or 0
    if backlogs >= 1 or (gpa is not None and gpa < THRESHOLDS["gpa_below"]):
        add("subject_mentoring", "Subject mentoring", "high",
            f"Observed GPA={gpa if gpa is not None else 'missing'}; backlogs={backlogs:g}.",
            "Review difficult subjects and offer faculty mentoring or tutoring.", 14,
            "Review subject completion and backlog count at the next check-in.")

    for metric, label, action in (
        ("aptitude_pct", "Aptitude practice", "Practice aptitude questions and review the next scored set."),
        ("coding_pct", "Coding practice", "Work through a weekly coding set and review solutions with a mentor."),
        ("mock_interview_pct", "Mock interview", "Complete a mock interview and review the rubric with a faculty mentor."),
        ("communication_pct", "Communication workshop", "Set one communication practice goal and review it with a mentor."),
        ("technical_skill_pct", "Skills development", "Choose a technical skill milestone and track a demonstrable artifact."),
        ("portfolio_pct", "Portfolio development", "Complete and review one portfolio artifact relevant to the student's goals."),
    ):
        value = _number(metrics.get(metric))
        threshold = THRESHOLDS["placement_below"] if metric in {"aptitude_pct", "coding_pct", "mock_interview_pct"} else 70
        if value is not None and value < threshold:
            add(metric.removesuffix("_pct"), label, "medium",
                f"Observed {metric} is {value:g}%.", action, 14,
                f"Compare the next {label.lower()} evidence with the current observed value.")

    if not out and score_result and score_result.get("score") is not None:
        add("strength_building", "Strength-based development", "low",
            "No configured support threshold was crossed in the available metrics.",
            "Discuss the student's goals and agree on one measurable skill or portfolio milestone.", 30,
            "Review progress against the agreed milestone.")
    return out


def segment(metrics: dict[str, Any], score_result: dict[str, Any]) -> dict[str, Any]:
    coverage = score_result.get("coverage_pct", 0)
    gpa = _number(metrics.get("semester_gpa"))
    attendance = _number(metrics.get("attendance_pct"))
    trend = _number(metrics.get("trend"))
    placement = placement_readiness(metrics)
    readiness = placement["readiness_pct"]
    skills_values = [_number(metrics.get(key)) for key in COMPONENT_METRICS["skills"]]
    skills = [value for value in skills_values if value is not None]
    actions = {
        "Incomplete data requiring review": "Confirm source availability and update missing data before interpreting the profile.",
        "High academic performance, low placement readiness": "Offer a personalized placement practice plan.",
        "Low attendance, falling academic performance": "Arrange a supportive attendance and academic check-in.",
        "Strong skills, weak academic scores": "Review subject-specific tutoring alongside existing skills strengths.",
        "High overall success and consistent performance": "Recognize progress and agree on a student-led development goal.",
        "General development": "Review current evidence with the student and agree on a measurable next step.",
    }
    evidence: list[dict[str, Any]] = []
    if coverage < 60:
        name = "Incomplete data requiring review"
    elif gpa is not None and gpa >= 8 and readiness is not None and readiness < 60:
        name = "High academic performance, low placement readiness"
        evidence = [{"metric": "semester_gpa", "value": gpa}, {"metric": "placement_readiness_pct", "value": readiness}]
    elif attendance is not None and attendance < THRESHOLDS["attendance_below"] and trend is not None and trend < 0:
        name = "Low attendance, falling academic performance"
        evidence = [{"metric": "attendance_pct", "value": attendance}, {"metric": "trend", "value": trend}]
    elif skills and sum(skills) / len(skills) >= 75 and gpa is not None and gpa < 6.5:
        name = "Strong skills, weak academic scores"
        evidence = [{"metric": "skills_average_pct", "value": round(sum(skills) / len(skills), 2)}, {"metric": "semester_gpa", "value": gpa}]
    elif score_result.get("score") is not None and score_result["score"] >= 80 and trend is not None and trend >= 0:
        name = "High overall success and consistent performance"
        evidence = [{"metric": "success_score", "value": score_result["score"]}, {"metric": "trend", "value": trend}]
    else:
        name = "General development"
    return {"name": name, "evidence": evidence, "recommended_action": actions[name]}
