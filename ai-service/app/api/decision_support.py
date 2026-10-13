import re
import base64
import binascii
import io
from collections import Counter
from typing import Annotated, Literal

from docx import Document
from fastapi import APIRouter, HTTPException
from pypdf import PdfReader
from pydantic import BaseModel, ConfigDict, Field, field_validator

router = APIRouter(tags=["deterministic decision support"])
SkillPhrase = Annotated[str, Field(min_length=1, max_length=80)]


def _key(value: str) -> str:
    return " ".join(value.casefold().split())


def _validate_unique(values: list[str], field_name: str) -> list[str]:
    keys = [_key(value) for value in values]
    if len(keys) != len(set(keys)):
        raise ValueError(f"{field_name} must not contain duplicates")
    return values


class InputModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class SkillRequirement(InputModel):
    skill: str = Field(min_length=1, max_length=80)
    weight: float = Field(default=1.0, gt=0, le=5)


class SkillGapRequest(InputModel):
    role_name: str | None = Field(default=None, min_length=1, max_length=120)
    required_skills: list[SkillRequirement] = Field(default_factory=list, max_length=100)
    observed_skills: list[SkillPhrase] = Field(default_factory=list, max_length=100)
    self_reported_skills: list[SkillPhrase] = Field(default_factory=list, max_length=100)

    @field_validator("required_skills")
    @classmethod
    def unique_requirements(cls, values: list[SkillRequirement]) -> list[SkillRequirement]:
        keys = [_key(item.skill) for item in values]
        if len(keys) != len(set(keys)):
            raise ValueError("required_skills must not contain duplicates")
        return values

    @field_validator("observed_skills", "self_reported_skills")
    @classmethod
    def unique_skills(cls, values: list[str], info) -> list[str]:
        return _validate_unique(values, info.field_name)


class SkillMatch(InputModel):
    skill: str
    weight: float
    evidence_sources: list[Literal["observed", "self_reported"]]


class SkillGapResponse(InputModel):
    role_name: str | None
    matched_requirements: list[SkillMatch]
    missing_requirements: list[SkillRequirement]
    coverage_pct: float | None
    requirement_count: int
    method: str
    disclaimer: str


class CareerRole(InputModel):
    role_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=120)
    required_skills: list[SkillPhrase] = Field(default_factory=list, max_length=100)
    interests: list[SkillPhrase] = Field(default_factory=list, max_length=100)

    @field_validator("required_skills", "interests")
    @classmethod
    def unique_role_terms(cls, values: list[str], info) -> list[str]:
        return _validate_unique(values, info.field_name)


class CareerSuggestionRequest(InputModel):
    role_catalog: list[CareerRole] = Field(max_length=100)
    observed_skills: list[SkillPhrase] = Field(default_factory=list, max_length=100)
    self_reported_skills: list[SkillPhrase] = Field(default_factory=list, max_length=100)
    interests: list[SkillPhrase] = Field(default_factory=list, max_length=100)

    @field_validator("role_catalog")
    @classmethod
    def unique_role_ids(cls, values: list[CareerRole]) -> list[CareerRole]:
        ids = [role.role_id.casefold() for role in values]
        if len(ids) != len(set(ids)):
            raise ValueError("role_catalog role_id values must be unique")
        return values

    @field_validator("observed_skills", "self_reported_skills", "interests")
    @classmethod
    def unique_evidence(cls, values: list[str], info) -> list[str]:
        return _validate_unique(values, info.field_name)


class CareerMatch(InputModel):
    role_id: str
    title: str
    matched_skills: list[SkillMatch]
    matched_interests: list[str]
    match_pct: float
    scoring_basis: str


class CareerSuggestionResponse(InputModel):
    suggestions: list[CareerMatch]
    evaluated_role_count: int
    method: str
    disclaimer: str


class ResumeGapRequest(InputModel):
    resume_text: str = Field(min_length=1, max_length=20000)
    job_description: str = Field(min_length=1, max_length=20000)
    required_skills: list[SkillPhrase] = Field(
        description="Explicit skill phrases to compare; no skills are inferred from either text.",
        max_length=100,
    )

    @field_validator("required_skills")
    @classmethod
    def unique_required_skills(cls, values: list[str]) -> list[str]:
        return _validate_unique(values, "required_skills")


class ResumeExtractionRequest(InputModel):
    content_type: Literal[
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    content_base64: str = Field(min_length=1, max_length=4_300_000)


class ResumeExtractionResponse(InputModel):
    extracted_text: str
    page_count: int | None = None
    method: str
    warning: str


@router.post("/features/extract-resume", response_model=ResumeExtractionResponse)
def extract_resume(request: ResumeExtractionRequest) -> ResumeExtractionResponse:
    try:
        content = base64.b64decode(request.content_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 file content") from exc
    if not content or len(content) > 3 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Resume must be no larger than 3 MiB")

    try:
        if request.content_type == "application/pdf":
            if not content.startswith(b"%PDF-"):
                raise HTTPException(status_code=400, detail="File content is not a PDF")
            reader = PdfReader(io.BytesIO(content), strict=True)
            if len(reader.pages) > 30:
                raise HTTPException(status_code=413, detail="Resume PDF cannot exceed 30 pages")
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            page_count = len(reader.pages)
            warning = (
                "No selectable text was extracted. This may be a scanned PDF; OCR is not enabled. Extraction does not verify authenticity or qualifications."
                if not text.strip()
                else "Text extraction does not verify document authenticity or qualifications."
            )
            method = "Text-only extraction from PDF text layers; no OCR or authenticity verification."
        else:
            if not content.startswith(b"PK\x03\x04"):
                raise HTTPException(status_code=400, detail="File content is not a DOCX document")
            document = Document(io.BytesIO(content))
            text = "\n".join(paragraph.text for paragraph in document.paragraphs)
            page_count = None
            warning = "Text extraction does not verify document authenticity or qualifications."
            method = "Text extraction from DOCX paragraphs; no OCR or authenticity verification."
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Resume document could not be parsed") from exc

    return ResumeExtractionResponse(
        extracted_text=text[:20_000],
        page_count=page_count,
        method=method,
        warning=warning,
    )


class ResumeSkillResult(InputModel):
    skill: str
    mentioned_in_resume: bool
    mentioned_in_job_description: bool


class ResumeGapResponse(InputModel):
    matched_requirements: list[ResumeSkillResult]
    missing_from_resume: list[ResumeSkillResult]
    not_verified_in_job_description: list[str]
    coverage_pct: float | None
    requirement_count: int
    suggestions: list[str]
    method: str
    disclaimer: str


class FeedbackRequest(InputModel):
    feedback: list[Annotated[str, Field(min_length=1, max_length=2000)]] = Field(max_length=500)

    @field_validator("feedback")
    @classmethod
    def validate_feedback(cls, values: list[str]) -> list[str]:
        if any(not value for value in values):
            raise ValueError("feedback items must not be blank")
        return values


class SentimentCounts(InputModel):
    positive: int
    neutral: int
    negative: int


class TopicTrend(InputModel):
    topic: str
    sample_size: int
    sentiment_counts: SentimentCounts


class FeedbackResponse(InputModel):
    sample_size: int
    sentiment_counts: SentimentCounts
    topic_trends: list[TopicTrend]
    method: str
    caveat: str


class Course(InputModel):
    course_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=160)
    teaches: list[SkillPhrase] = Field(default_factory=list, max_length=100)
    prerequisites: list[SkillPhrase] = Field(default_factory=list, max_length=100)

    @field_validator("teaches", "prerequisites")
    @classmethod
    def unique_course_terms(cls, values: list[str], info) -> list[str]:
        return _validate_unique(values, info.field_name)


class CourseRecommendationRequest(InputModel):
    course_catalog: list[Course] = Field(max_length=200)
    student_skills: list[SkillPhrase] = Field(default_factory=list, max_length=100)
    skill_gaps: list[SkillPhrase] = Field(default_factory=list, max_length=100)

    @field_validator("course_catalog")
    @classmethod
    def unique_course_ids(cls, values: list[Course]) -> list[Course]:
        ids = [course.course_id.casefold() for course in values]
        if len(ids) != len(set(ids)):
            raise ValueError("course_catalog course_id values must be unique")
        return values

    @field_validator("student_skills", "skill_gaps")
    @classmethod
    def unique_student_terms(cls, values: list[str], info) -> list[str]:
        return _validate_unique(values, info.field_name)


class CourseEvaluation(InputModel):
    course_id: str
    title: str
    matched_gaps: list[str]
    missing_prerequisites: list[str]
    prerequisites_met: bool
    gap_coverage_pct: float | None


class CourseRecommendationResponse(InputModel):
    recommendations: list[CourseEvaluation]
    catalog_evaluations: list[CourseEvaluation]
    skill_gap_count: int
    method: str
    disclaimer: str


@router.post("/features/skills", response_model=SkillGapResponse)
def skill_gap(request: SkillGapRequest) -> SkillGapResponse:
    observed = {_key(skill) for skill in request.observed_skills}
    reported = {_key(skill) for skill in request.self_reported_skills}
    matched: list[SkillMatch] = []
    missing: list[SkillRequirement] = []
    matched_weight = 0.0
    total_weight = sum(item.weight for item in request.required_skills)

    for requirement in request.required_skills:
        key = _key(requirement.skill)
        sources = []
        if key in observed:
            sources.append("observed")
        if key in reported:
            sources.append("self_reported")
        if sources:
            matched.append(
                SkillMatch(
                    skill=requirement.skill,
                    weight=requirement.weight,
                    evidence_sources=sources,
                )
            )
            matched_weight += requirement.weight
        else:
            missing.append(requirement)

    return SkillGapResponse(
        role_name=request.role_name,
        matched_requirements=matched,
        missing_requirements=missing,
        coverage_pct=round(100 * matched_weight / total_weight, 2) if total_weight else None,
        requirement_count=len(request.required_skills),
        method="Exact phrase matching after case-folding and whitespace normalization; requirement weights are supplied by the caller.",
        disclaimer="This is a deterministic comparison of supplied information, not a validated assessment of ability.",
    )


@router.post("/features/careers", response_model=CareerSuggestionResponse)
def suggest_careers(request: CareerSuggestionRequest) -> CareerSuggestionResponse:
    observed = {_key(skill) for skill in request.observed_skills}
    reported = {_key(skill) for skill in request.self_reported_skills}
    evidence_skills = observed | reported
    student_interests = {_key(interest) for interest in request.interests}
    ranked: list[CareerMatch] = []

    for role in request.role_catalog:
        matched_skills = [
            SkillMatch(
                skill=skill,
                weight=1.0,
                evidence_sources=[
                    source
                    for source, evidence in (("observed", observed), ("self_reported", reported))
                    if _key(skill) in evidence
                ],
            )
            for skill in role.required_skills
            if _key(skill) in evidence_skills
        ]
        matched_interests = [
            interest for interest in role.interests if _key(interest) in student_interests
        ]
        has_skill_evidence = bool(evidence_skills) and bool(role.required_skills)
        has_interest_evidence = bool(student_interests) and bool(role.interests)
        if not matched_skills and not matched_interests:
            continue

        dimensions: list[tuple[float, float]] = []
        if has_skill_evidence:
            dimensions.append((0.7, len(matched_skills) / len(role.required_skills)))
        if has_interest_evidence:
            dimensions.append((0.3, len(matched_interests) / len(role.interests)))
        normalized_weight = sum(weight for weight, _ in dimensions)
        match_pct = 100 * sum(weight * value for weight, value in dimensions) / normalized_weight
        ranked.append(
            CareerMatch(
                role_id=role.role_id,
                title=role.title,
                matched_skills=matched_skills,
                matched_interests=matched_interests,
                match_pct=round(match_pct, 2),
                scoring_basis=(
                    "Exact supplied skill/interest overlap; skill and interest dimensions use "
                    "70/30 weights when both are available, otherwise available weights are renormalized."
                ),
            )
        )

    ranked.sort(key=lambda item: (-item.match_pct, item.role_id.casefold()))
    return CareerSuggestionResponse(
        suggestions=ranked,
        evaluated_role_count=len(request.role_catalog),
        method="Ranks only catalog roles with at least one exact skill or interest match; case and repeated whitespace are normalized.",
        disclaimer="These are non-predictive matches to the supplied role catalog, not career forecasts, aptitude results, or employment probabilities.",
    )


def _mentions(text: str, phrase: str) -> bool:
    escaped = re.escape(_key(phrase)).replace(r"\ ", r"\s+")
    return re.search(rf"(?<![A-Za-z0-9]){escaped}(?![A-Za-z0-9])", text, re.IGNORECASE) is not None


@router.post("/features/resume", response_model=ResumeGapResponse)
def analyze_resume(request: ResumeGapRequest) -> ResumeGapResponse:
    results = [
        ResumeSkillResult(
            skill=skill,
            mentioned_in_resume=_mentions(request.resume_text, skill),
            mentioned_in_job_description=_mentions(request.job_description, skill),
        )
        for skill in request.required_skills
    ]
    matched = [item for item in results if item.mentioned_in_resume]
    missing = [item for item in results if not item.mentioned_in_resume]
    not_verified = [
        item.skill for item in results if not item.mentioned_in_job_description
    ]
    suggestions = [
        (
            f"If you have genuine experience with {item.skill}, consider adding a specific, "
            "truthful example and your contribution. Otherwise, do not claim this qualification."
        )
        for item in missing
    ]
    return ResumeGapResponse(
        matched_requirements=matched,
        missing_from_resume=missing,
        not_verified_in_job_description=not_verified,
        coverage_pct=round(100 * len(matched) / len(results), 2) if results else None,
        requirement_count=len(results),
        suggestions=suggestions,
        method="Checks only caller-supplied skill phrases for case-insensitive whole-phrase mentions in the two supplied texts; it does not infer qualifications.",
        disclaimer="This is not an ATS score or a claim of ATS success. Add a missing qualification only if it is truthful; this endpoint does not verify credentials.",
    )


POSITIVE_WORDS = {
    "clear", "engaging", "enjoyed", "excellent", "good", "great", "helpful",
    "improved", "easy", "recommend", "supportive", "useful",
}
NEGATIVE_WORDS = {
    "bad", "boring", "broken", "confusing", "difficult", "frustrating", "hard",
    "late", "poor", "slow", "stressful", "unclear", "unavailable", "unhelpful",
}
TOPIC_TERMS = {
    "course_content": {"course", "content", "lesson", "material", "module"},
    "teaching": {"instructor", "lecture", "professor", "teacher"},
    "platform": {"app", "login", "platform", "website"},
    "workload": {"assignment", "deadline", "homework", "workload"},
    "support": {"help", "response", "staff", "support"},
}


def _word_set(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9']+", text.casefold()))


def _classify_sentiment(text: str) -> Literal["positive", "neutral", "negative"]:
    words = _word_set(text)
    score = len(words & POSITIVE_WORDS) - len(words & NEGATIVE_WORDS)
    if score > 0:
        return "positive"
    if score < 0:
        return "negative"
    return "neutral"


@router.post("/features/feedback", response_model=FeedbackResponse)
def analyze_feedback(request: FeedbackRequest) -> FeedbackResponse:
    sentiment_counts: Counter[str] = Counter()
    topic_counts: dict[str, Counter[str]] = {}

    for feedback in request.feedback:
        sentiment = _classify_sentiment(feedback)
        sentiment_counts[sentiment] += 1
        words = _word_set(feedback)
        for topic, terms in TOPIC_TERMS.items():
            if words & terms:
                topic_counts.setdefault(topic, Counter())[sentiment] += 1

    totals = SentimentCounts(
        positive=sentiment_counts["positive"],
        neutral=sentiment_counts["neutral"],
        negative=sentiment_counts["negative"],
    )
    trends = [
        TopicTrend(
            topic=topic,
            sample_size=sum(counts.values()),
            sentiment_counts=SentimentCounts(
                positive=counts["positive"],
                neutral=counts["neutral"],
                negative=counts["negative"],
            ),
        )
        for topic, counts in sorted(topic_counts.items())
    ]
    return FeedbackResponse(
        sample_size=len(request.feedback),
        sentiment_counts=totals,
        topic_trends=trends,
        method="Counts fixed English positive/negative terms per feedback item; ties and items without matched terms are neutral. Topics use fixed keyword sets; one item may count for multiple topics.",
        caveat="Small or unrepresentative samples can mislead. This rule-based result can miss context, negation, sarcasm, and language variation; review feedback with a human. Do not submit names, student IDs, or sensitive personal information. Original comments are not returned.",
    )


@router.post("/features/courses", response_model=CourseRecommendationResponse)
def recommend_courses(request: CourseRecommendationRequest) -> CourseRecommendationResponse:
    student_skills = {_key(skill) for skill in request.student_skills}
    gaps = {_key(skill): skill for skill in request.skill_gaps}
    evaluations: list[CourseEvaluation] = []

    for course in request.course_catalog:
        missing_prerequisites = [
            prerequisite
            for prerequisite in course.prerequisites
            if _key(prerequisite) not in student_skills
        ]
        matched_gaps = [
            original for key, original in gaps.items() if key in {_key(skill) for skill in course.teaches}
        ]
        evaluations.append(
            CourseEvaluation(
                course_id=course.course_id,
                title=course.title,
                matched_gaps=matched_gaps,
                missing_prerequisites=missing_prerequisites,
                prerequisites_met=not missing_prerequisites,
                gap_coverage_pct=(
                    round(100 * len(matched_gaps) / len(gaps), 2) if gaps else None
                ),
            )
        )

    recommendations = [
        item
        for item in evaluations
        if item.prerequisites_met and bool(item.matched_gaps)
    ]
    recommendations.sort(
        key=lambda item: (-len(item.matched_gaps), -item.gap_coverage_pct, item.course_id.casefold())
    )
    return CourseRecommendationResponse(
        recommendations=recommendations,
        catalog_evaluations=evaluations,
        skill_gap_count=len(gaps),
        method="Exact supplied-skill matching after case-folding and whitespace normalization; a course is recommended only if its listed prerequisites are met and it teaches at least one listed gap.",
        disclaimer="Recommendations compare only the supplied catalog and student evidence; they do not establish course quality, enrollment availability, or learning outcomes.",
    )
