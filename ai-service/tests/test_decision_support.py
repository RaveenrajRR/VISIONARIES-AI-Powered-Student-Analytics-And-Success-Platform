import httpx
import pytest

from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


async def post(path: str, body: dict):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post(path, json=body)


@pytest.mark.anyio
async def test_skill_gap_matches_observed_and_reported_evidence():
    response = await post(
        "/features/skills",
        {
            "role_name": "Data analyst",
            "required_skills": [
                {"skill": "SQL", "weight": 2},
                {"skill": "Python"},
                {"skill": "Tableau"},
            ],
            "observed_skills": ["sql"],
            "self_reported_skills": ["Python"],
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result["coverage_pct"] == pytest.approx(75)
    assert [item["skill"] for item in result["missing_requirements"]] == ["Tableau"]
    assert result["matched_requirements"][0]["evidence_sources"] == ["observed"]


@pytest.mark.anyio
async def test_skill_gap_empty_requirements_and_validation_bounds():
    empty = await post("/features/skills", {})
    too_many = await post("/features/skills", {"observed_skills": ["skill"] * 101})
    assert empty.status_code == 200
    assert empty.json()["coverage_pct"] is None
    assert empty.json()["missing_requirements"] == []
    assert too_many.status_code == 422


@pytest.mark.anyio
async def test_career_suggestions_require_actual_evidence_and_are_non_predictive():
    response = await post(
        "/features/careers",
        {
            "role_catalog": [
                {
                    "role_id": "analyst",
                    "title": "Data Analyst",
                    "required_skills": ["SQL", "Python"],
                    "interests": ["research"],
                },
                {
                    "role_id": "designer",
                    "title": "Designer",
                    "required_skills": ["illustration"],
                    "interests": ["art"],
                },
            ],
            "observed_skills": ["SQL"],
            "interests": ["research"],
        },
    )
    result = response.json()
    assert response.status_code == 200
    assert [item["role_id"] for item in result["suggestions"]] == ["analyst"]
    assert "non-predictive" in result["disclaimer"]
    no_evidence = await post("/features/careers", {"role_catalog": []})
    assert no_evidence.json()["suggestions"] == []


@pytest.mark.anyio
async def test_resume_analysis_only_uses_supplied_skills_and_makes_truthful_suggestions():
    response = await post(
        "/features/resume",
        {
            "resume_text": "Built dashboards using SQL and Python.",
            "job_description": "Seeking SQL, Python, and Tableau experience.",
            "required_skills": ["SQL", "Python", "Tableau"],
        },
    )
    result = response.json()
    assert response.status_code == 200
    assert [item["skill"] for item in result["matched_requirements"]] == ["SQL", "Python"]
    assert [item["skill"] for item in result["missing_from_resume"]] == ["Tableau"]
    assert "If you have genuine experience" in result["suggestions"][0]
    assert "ATS" in result["disclaimer"]
    assert "Tableau" not in result["matched_requirements"][0]["skill"]


@pytest.mark.anyio
async def test_feedback_reports_sample_sizes_without_echoing_private_comments():
    private_comment = "The instructor was helpful, but the platform is slow."
    response = await post(
        "/features/feedback",
        {"feedback": [private_comment, "Assignments are confusing.", "Lessons are clear."]},
    )
    result = response.json()
    assert response.status_code == 200
    assert result["sample_size"] == 3
    assert result["sentiment_counts"] == {"positive": 1, "neutral": 1, "negative": 1}
    topics = {item["topic"]: item for item in result["topic_trends"]}
    assert topics["teaching"]["sample_size"] == 1
    assert topics["platform"]["sample_size"] == 1
    assert private_comment not in response.text
    assert "human" in result["caveat"]
    assert "student IDs" in result["caveat"]
    empty = await post("/features/feedback", {"feedback": []})
    assert empty.json()["sample_size"] == 0
    assert empty.json()["topic_trends"] == []


@pytest.mark.anyio
async def test_course_recommendations_respect_prerequisites_and_supplied_gaps():
    response = await post(
        "/features/courses",
        {
            "student_skills": ["SQL"],
            "skill_gaps": ["Python", "statistics"],
            "course_catalog": [
                {
                    "course_id": "python-basics",
                    "title": "Python basics",
                    "teaches": ["Python"],
                    "prerequisites": ["SQL"],
                },
                {
                    "course_id": "advanced-stats",
                    "title": "Advanced statistics",
                    "teaches": ["statistics"],
                    "prerequisites": ["calculus"],
                },
            ],
        },
    )
    result = response.json()
    assert response.status_code == 200
    assert [item["course_id"] for item in result["recommendations"]] == ["python-basics"]
    blocked = next(item for item in result["catalog_evaluations"] if item["course_id"] == "advanced-stats")
    assert blocked["missing_prerequisites"] == ["calculus"]
    assert blocked["prerequisites_met"] is False


@pytest.mark.anyio
async def test_duplicate_catalog_ids_and_blank_feedback_are_rejected():
    duplicate = await post(
        "/features/courses",
        {
            "course_catalog": [
                {"course_id": "x", "title": "First"},
                {"course_id": "X", "title": "Second"},
            ]
        },
    )
    blank = await post("/features/feedback", {"feedback": ["   "]})
    assert duplicate.status_code == 422
    assert blank.status_code == 422
