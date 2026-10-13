from fastapi import FastAPI

from app.api.decision_support import router as decision_support_router
from app.core.config import THRESHOLDS, WEIGHTS
from app.schemas.analytics import AnalyzeRequest
from app.scoring.engine import (
    COMPONENT_METRICS,
    analyze_risk,
    calculate_score,
    placement_readiness,
    recommend,
    segment,
)

app = FastAPI(
    title="EduAI Nexus AI Service",
    version="1.0.0",
    description="Transparent rule-based student success analytics; not a validated predictive model.",
)
app.include_router(decision_support_router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "eduai-ai",
        "mode": "transparent-rule-based",
        "weights": WEIGHTS,
        "thresholds": THRESHOLDS,
    }


@app.post("/score")
def score(req: AnalyzeRequest):
    return {
        "student_id": req.student_id,
        **calculate_score(req.metrics, req.source_imported_at),
    }


@app.post("/risk")
def risk(req: AnalyzeRequest):
    return {"student_id": req.student_id, **analyze_risk(req.metrics)}


@app.post("/explanations")
def explanations(req: AnalyzeRequest):
    result = calculate_score(req.metrics, req.source_imported_at)
    factors = []
    available_weight = sum(WEIGHTS[key] for key in result["components"])

    for key, value in result["components"].items():
        normalized_weight = WEIGHTS[key] / available_weight
        factors.append({
            "component": key,
            "value": value,
            "weight": WEIGHTS[key],
            "normalized_weight": round(normalized_weight, 4),
            "weighted_points": round(value * normalized_weight, 2),
            "impact_from_neutral": round((value - 50) * normalized_weight, 2),
            "direction": "improves" if value >= 50 else "reduces",
            "observed_metrics": {
                metric: req.metrics.get(metric)
                for metric in COMPONENT_METRICS[key]
                if req.metrics.get(metric) is not None
            },
            "basis": "Deterministic contribution from observed component values; not causal attribution.",
        })

    missing_sources = [
        source for source in COMPONENT_METRICS if source not in result["components"]
    ]
    return {
        "student_id": req.student_id,
        "score": result["score"],
        "coverage_pct": result["coverage_pct"],
        "confidence_pct": result["confidence_pct"],
        "freshness_pct": result["freshness_pct"],
        "source_freshness": result["source_freshness"],
        "missing_sources": missing_sources,
        "factors": factors,
        "method": "Deterministic weighted component contributions; no SHAP or causal claim.",
        "confidence_basis": result["confidence_basis"],
    }


@app.post("/recommendations")
def recommendations(req: AnalyzeRequest):
    result = calculate_score(req.metrics)
    return {
        "student_id": req.student_id,
        "recommendations": recommend(req.metrics, result),
    }


@app.post("/segment")
def segment_endpoint(req: AnalyzeRequest):
    score_result = calculate_score(req.metrics, req.source_imported_at)
    classification = segment(req.metrics, score_result)
    return {
        "student_id": req.student_id,
        "segment": classification["name"],
        "segment_evidence": classification["evidence"],
        "recommended_action": classification["recommended_action"],
        "score": score_result,
    }


@app.post("/placement")
def placement_endpoint(req: AnalyzeRequest):
    return {"student_id": req.student_id, **placement_readiness(req.metrics)}
