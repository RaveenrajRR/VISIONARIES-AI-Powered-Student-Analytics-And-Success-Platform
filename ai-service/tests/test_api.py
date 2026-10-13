import httpx
import pytest
import base64
from io import BytesIO
from pypdf import PdfWriter

from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


async def request(path: str, body: dict | None = None):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        if body is None:
            return await client.get(path)
        return await client.post(path, json=body)


@pytest.mark.anyio
async def test_health():
    result = (await request("/health")).json()
    assert result["status"] == "ok"
    assert result["mode"] == "transparent-rule-based"
    assert sum(result["weights"].values()) == pytest.approx(1)


@pytest.mark.anyio
async def test_score_endpoint():
    response = await request("/score", {"student_id": "S0001", "metrics": {"semester_gpa": 8, "backlogs": 0}})
    assert response.status_code == 200
    assert response.json()["score"] is not None


@pytest.mark.anyio
async def test_invalid_metrics_are_rejected():
    response = await request("/score", {"metrics": {"attendance_pct": 140}})
    assert response.status_code == 422


@pytest.mark.anyio
async def test_explanations_use_deterministic_observed_contributions():
    response = await request("/explanations", {"metrics": {"semester_gpa": 8, "backlogs": 1}})
    assert response.status_code == 200
    result = response.json()
    assert result["factors"][0]["observed_metrics"] == {"semester_gpa": 8.0, "backlogs": 1.0}
    assert result["confidence_pct"] is None
    assert result["missing_sources"]


@pytest.mark.anyio
async def test_placement_and_segment_endpoints_include_actions():
    metrics = {"semester_gpa": 8.5, "attendance_pct": 90, "aptitude_pct": 40, "coding_pct": 55}
    placement_response = await request("/placement", {"metrics": metrics})
    segment_response = await request("/segment", {"metrics": metrics})
    assert placement_response.status_code == 200
    assert placement_response.json()["skill_gaps"]
    assert segment_response.status_code == 200
    assert segment_response.json()["segment_evidence"]
    assert segment_response.json()["recommended_action"]


@pytest.mark.anyio
async def test_recommendations_include_measurable_outcome():
    response = await request("/recommendations", {"metrics": {"attendance_pct": 60}})
    assert response.status_code == 200
    recommendation = response.json()["recommendations"][0]
    assert recommendation["expected_outcome"]


@pytest.mark.anyio
async def test_resume_extraction_rejects_content_type_spoofing():
    response = await request("/features/extract-resume", {
        "content_type": "application/pdf",
        "content_base64": base64.b64encode(b"not a pdf").decode(),
    })
    assert response.status_code == 400


@pytest.mark.anyio
async def test_resume_extraction_accepts_pdf_signature_and_disclaims_verification():
    pdf = BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    writer.write(pdf)
    response = await request("/features/extract-resume", {
        "content_type": "application/pdf",
        "content_base64": base64.b64encode(pdf.getvalue()).decode(),
    })
    assert response.status_code == 200
    assert "authenticity" in response.json()["warning"]


@pytest.mark.anyio
async def test_skill_gap_keeps_self_reported_evidence_explicit():
    response = await request("/features/skills", {
        "role_name": "Data Analyst",
        "required_skills": [{"skill": "SQL"}, {"skill": "Python"}],
        "observed_skills": ["SQL"],
        "self_reported_skills": ["Python"],
    })
    assert response.status_code == 200
    matched = {item["skill"]: item["evidence_sources"] for item in response.json()["matched_requirements"]}
    assert matched == {"SQL": ["observed"], "Python": ["self_reported"]}


@pytest.mark.anyio
async def test_career_suggestions_are_exploratory_and_require_evidence():
    response = await request("/features/careers", {
        "role_catalog": [{"role_id": "analyst", "title": "Analyst", "required_skills": ["SQL"], "interests": ["research"]}],
        "observed_skills": [], "self_reported_skills": [], "interests": [],
    })
    assert response.status_code == 200
    assert response.json()["suggestions"] == []
    assert "not career forecasts" in response.json()["disclaimer"]


@pytest.mark.anyio
async def test_resume_gap_does_not_claim_ats_success_or_infer_skills():
    response = await request("/features/resume", {
        "resume_text": "Built reports with SQL.",
        "job_description": "SQL and Python experience required for this position.",
        "required_skills": ["SQL", "Python"],
    })
    assert response.status_code == 200
    assert [item["skill"] for item in response.json()["missing_from_resume"]] == ["Python"]
    assert "not an ATS score" in response.json()["disclaimer"]


@pytest.mark.anyio
async def test_feedback_sentiment_returns_sample_size_and_caveat():
    response = await request("/features/feedback", {"feedback": ["The course was helpful", "The platform was confusing"]})
    assert response.status_code == 200
    assert response.json()["sample_size"] == 2
    assert response.json()["sentiment_counts"] == {"positive": 1, "neutral": 0, "negative": 1}
    assert "human" in response.json()["caveat"]
