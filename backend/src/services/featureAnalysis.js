"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractResume = exports.analyzeCourses = exports.analyzeFeedback = exports.analyzeResume = exports.analyzeCareers = exports.analyzeSkillGap = void 0;
const zod_1 = require("zod");
const aiClient_1 = require("./aiClient");
const base = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const timeoutMs = Number(process.env.AI_SERVICE_TIMEOUT_MS || 4000);
const skillResponse = zod_1.z.object({
    role_name: zod_1.z.string().nullable(),
    matched_requirements: zod_1.z.array(zod_1.z.object({ skill: zod_1.z.string(), weight: zod_1.z.number(), evidence_sources: zod_1.z.array(zod_1.z.enum(['observed', 'self_reported'])) })),
    missing_requirements: zod_1.z.array(zod_1.z.object({ skill: zod_1.z.string(), weight: zod_1.z.number() })),
    coverage_pct: zod_1.z.number().nullable(), requirement_count: zod_1.z.number(), method: zod_1.z.string(), disclaimer: zod_1.z.string(),
});
const careerResponse = zod_1.z.object({
    suggestions: zod_1.z.array(zod_1.z.object({ role_id: zod_1.z.string(), title: zod_1.z.string(), matched_skills: zod_1.z.array(zod_1.z.object({ skill: zod_1.z.string(), weight: zod_1.z.number(), evidence_sources: zod_1.z.array(zod_1.z.enum(['observed', 'self_reported'])) })), matched_interests: zod_1.z.array(zod_1.z.string()), match_pct: zod_1.z.number(), scoring_basis: zod_1.z.string() })),
    evaluated_role_count: zod_1.z.number(), method: zod_1.z.string(), disclaimer: zod_1.z.string(),
});
const resumeResponse = zod_1.z.object({
    matched_requirements: zod_1.z.array(zod_1.z.object({ skill: zod_1.z.string(), mentioned_in_resume: zod_1.z.boolean(), mentioned_in_job_description: zod_1.z.boolean() })),
    missing_from_resume: zod_1.z.array(zod_1.z.object({ skill: zod_1.z.string(), mentioned_in_resume: zod_1.z.boolean(), mentioned_in_job_description: zod_1.z.boolean() })),
    not_verified_in_job_description: zod_1.z.array(zod_1.z.string()), coverage_pct: zod_1.z.number().nullable(), requirement_count: zod_1.z.number(), suggestions: zod_1.z.array(zod_1.z.string()), method: zod_1.z.string(), disclaimer: zod_1.z.string(),
});
const feedbackResponse = zod_1.z.object({
    sample_size: zod_1.z.number(), sentiment_counts: zod_1.z.object({ positive: zod_1.z.number(), neutral: zod_1.z.number(), negative: zod_1.z.number() }),
    topic_trends: zod_1.z.array(zod_1.z.object({ topic: zod_1.z.string(), sample_size: zod_1.z.number(), sentiment_counts: zod_1.z.object({ positive: zod_1.z.number(), neutral: zod_1.z.number(), negative: zod_1.z.number() }) })), method: zod_1.z.string(), caveat: zod_1.z.string(),
});
const coursesResponse = zod_1.z.object({
    recommendations: zod_1.z.array(zod_1.z.object({ course_id: zod_1.z.string(), title: zod_1.z.string(), matched_gaps: zod_1.z.array(zod_1.z.string()), missing_prerequisites: zod_1.z.array(zod_1.z.string()), prerequisites_met: zod_1.z.boolean(), gap_coverage_pct: zod_1.z.number().nullable() })),
    catalog_evaluations: zod_1.z.array(zod_1.z.object({ course_id: zod_1.z.string(), title: zod_1.z.string(), matched_gaps: zod_1.z.array(zod_1.z.string()), missing_prerequisites: zod_1.z.array(zod_1.z.string()), prerequisites_met: zod_1.z.boolean(), gap_coverage_pct: zod_1.z.number().nullable() })),
    skill_gap_count: zod_1.z.number(), method: zod_1.z.string(), disclaimer: zod_1.z.string(),
});
const extractionResponse = zod_1.z.object({ extracted_text: zod_1.z.string(), page_count: zod_1.z.number().optional(), method: zod_1.z.string(), warning: zod_1.z.string() });
async function analyze(path, body, schema) {
    let response;
    try {
        response = await fetch(`${base}/${path}`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
        });
    }
    catch {
        throw new aiClient_1.AIServiceError('AI service is unavailable or timed out', 503);
    }
    if (!response.ok)
        throw new aiClient_1.AIServiceError('AI service rejected the feature-analysis request', 502);
    const parsed = schema.safeParse(await response.json().catch(() => null));
    if (!parsed.success)
        throw new aiClient_1.AIServiceError('AI service returned an invalid feature-analysis response', 502);
    return parsed.data;
}
const analyzeSkillGap = (body) => analyze('features/skills', body, skillResponse);
exports.analyzeSkillGap = analyzeSkillGap;
const analyzeCareers = (body) => analyze('features/careers', body, careerResponse);
exports.analyzeCareers = analyzeCareers;
const analyzeResume = (body) => analyze('features/resume', body, resumeResponse);
exports.analyzeResume = analyzeResume;
const analyzeFeedback = (body) => analyze('features/feedback', body, feedbackResponse);
exports.analyzeFeedback = analyzeFeedback;
const analyzeCourses = (body) => analyze('features/courses', body, coursesResponse);
exports.analyzeCourses = analyzeCourses;
const extractResume = (body) => analyze('features/extract-resume', body, extractionResponse);
exports.extractResume = extractResume;
