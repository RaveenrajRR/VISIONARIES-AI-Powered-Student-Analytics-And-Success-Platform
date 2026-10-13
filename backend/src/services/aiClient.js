"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIServiceError = void 0;
exports.ai = ai;
exports.aiHealth = aiHealth;
const zod_1 = require("zod");
const base = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const timeoutMs = Number(process.env.AI_SERVICE_TIMEOUT_MS || 4000);
class AIServiceError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'AIServiceError';
    }
}
exports.AIServiceError = AIServiceError;
const numberOrNull = zod_1.z.number().finite().nullable();
const scoreSchema = zod_1.z.object({
    student_id: zod_1.z.string().nullable().optional(),
    score: numberOrNull,
    coverage_pct: zod_1.z.number().min(0).max(100),
    confidence_pct: numberOrNull,
    freshness_pct: numberOrNull,
    source_freshness: zod_1.z.record(zod_1.z.object({
        status: zod_1.z.enum(['fresh', 'stale', 'unknown']),
        imported_at: zod_1.z.string().nullable(),
        age_days: numberOrNull,
    })).default({}),
    components: zod_1.z.record(zod_1.z.number().finite()),
    weights_used: zod_1.z.record(zod_1.z.number().finite()),
    provisional_weights: zod_1.z.record(zod_1.z.number().finite()),
    method: zod_1.z.string(),
    confidence_basis: zod_1.z.string(),
});
const reasonSchema = zod_1.z.object({ metric: zod_1.z.string(), value: zod_1.z.number().finite(), threshold: zod_1.z.string(), reason: zod_1.z.string() });
const riskSchema = zod_1.z.object({
    student_id: zod_1.z.string().nullable().optional(),
    academic_risk: zod_1.z.boolean(),
    academic_risk_level: zod_1.z.enum(['low', 'moderate', 'high']),
    academic_reasons: zod_1.z.array(reasonSchema),
    placement_risk: zod_1.z.boolean(),
    placement_risk_level: zod_1.z.enum(['low', 'moderate', 'high']),
    placement_reasons: zod_1.z.array(reasonSchema),
    thresholds: zod_1.z.record(zod_1.z.number().finite()),
    disclaimer: zod_1.z.string(),
});
const explanationsSchema = zod_1.z.object({
    student_id: zod_1.z.string().nullable().optional(),
    score: numberOrNull,
    coverage_pct: zod_1.z.number().min(0).max(100),
    confidence_pct: numberOrNull,
    freshness_pct: numberOrNull,
    source_freshness: zod_1.z.record(zod_1.z.unknown()),
    missing_sources: zod_1.z.array(zod_1.z.string()),
    factors: zod_1.z.array(zod_1.z.object({
        component: zod_1.z.string(),
        value: zod_1.z.number().finite(),
        weight: zod_1.z.number().finite(),
        normalized_weight: zod_1.z.number().finite(),
        weighted_points: zod_1.z.number().finite(),
        impact_from_neutral: zod_1.z.number().finite(),
        direction: zod_1.z.enum(['improves', 'reduces']),
        observed_metrics: zod_1.z.record(zod_1.z.number().finite()),
        basis: zod_1.z.string(),
    })),
    method: zod_1.z.string(),
    confidence_basis: zod_1.z.string(),
});
const recommendationsSchema = zod_1.z.object({
    student_id: zod_1.z.string().nullable().optional(),
    recommendations: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string(),
        title: zod_1.z.string(),
        priority: zod_1.z.enum(['low', 'medium', 'high']),
        evidence: zod_1.z.string(),
        rationale: zod_1.z.string(),
        suggested_action: zod_1.z.string(),
        follow_up_days: zod_1.z.number().int().positive(),
        expected_outcome: zod_1.z.string(),
    })),
});
const segmentSchema = zod_1.z.object({
    student_id: zod_1.z.string().nullable().optional(),
    segment: zod_1.z.string(),
    segment_evidence: zod_1.z.array(zod_1.z.object({ metric: zod_1.z.string(), value: zod_1.z.number().finite() })),
    recommended_action: zod_1.z.string(),
    score: scoreSchema,
});
const placementSchema = zod_1.z.object({
    student_id: zod_1.z.string().nullable().optional(),
    readiness_pct: numberOrNull,
    coverage_pct: zod_1.z.number().min(0).max(100),
    observed_metrics: zod_1.z.record(zod_1.z.number().finite()),
    skill_gaps: zod_1.z.array(zod_1.z.object({ skill: zod_1.z.string(), value: zod_1.z.number().finite(), target: zod_1.z.number().finite(), gap: zod_1.z.number().finite() })),
    practice_plan: zod_1.z.array(zod_1.z.object({ skill: zod_1.z.string(), action: zod_1.z.string(), weeks: zod_1.z.number().positive() })),
    disclaimer: zod_1.z.string(),
});
const responseSchemas = {
    score: scoreSchema,
    risk: riskSchema,
    explanations: explanationsSchema,
    recommendations: recommendationsSchema,
    segment: segmentSchema,
    placement: placementSchema,
};
async function requestAI(path, init) {
    let response;
    try {
        response = await fetch(`${base}/${path}`, {
            ...init,
            signal: AbortSignal.timeout(timeoutMs),
        });
    }
    catch {
        throw new AIServiceError('AI service is unavailable or timed out', 503);
    }
    if (!response.ok)
        throw new AIServiceError('AI service rejected the analytics request', 502);
    try {
        return await response.json();
    }
    catch {
        throw new AIServiceError('AI service returned an invalid response', 502);
    }
}
async function ai(path, studentId, metrics, sourceImportedAt = {}) {
    const body = { student_id: studentId, metrics, source_imported_at: sourceImportedAt };
    const data = await requestAI(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const parsed = responseSchemas[path].safeParse(data);
    if (!parsed.success)
        throw new AIServiceError('AI service returned an invalid analytics response', 502);
    return parsed.data;
}
async function aiHealth() {
    const data = await requestAI('health');
    const parsed = zod_1.z.object({ status: zod_1.z.literal('ok'), service: zod_1.z.literal('eduai-ai'), mode: zod_1.z.string() }).passthrough().safeParse(data);
    if (!parsed.success)
        throw new AIServiceError('AI service returned an invalid health response', 502);
    return parsed.data;
}
