import { z } from 'zod';
import { AIServiceError } from './aiClient';

const base = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const timeoutMs = Number(process.env.AI_SERVICE_TIMEOUT_MS || 4000);

const skillResponse = z.object({
                role_name: z.string().nullable(),
                matched_requirements: z.array(z.object({ skill: z.string(), weight: z.number(), evidence_sources: z.array(z.enum(['observed', 'self_reported'])) })),
                missing_requirements: z.array(z.object({ skill: z.string(), weight: z.number() })),
                coverage_pct: z.number().nullable(), requirement_count: z.number(), method: z.string(), disclaimer: z.string(),
});
const careerResponse = z.object({
                suggestions: z.array(z.object({ role_id: z.string(), title: z.string(), matched_skills: z.array(z.object({ skill: z.string(), weight: z.number(), evidence_sources: z.array(z.enum(['observed', 'self_reported'])) })), matched_interests: z.array(z.string()), match_pct: z.number(), scoring_basis: z.string() })),
                evaluated_role_count: z.number(), method: z.string(), disclaimer: z.string(),
});
const resumeResponse = z.object({
                matched_requirements: z.array(z.object({ skill: z.string(), mentioned_in_resume: z.boolean(), mentioned_in_job_description: z.boolean() })),
                missing_from_resume: z.array(z.object({ skill: z.string(), mentioned_in_resume: z.boolean(), mentioned_in_job_description: z.boolean() })),
                not_verified_in_job_description: z.array(z.string()), coverage_pct: z.number().nullable(), requirement_count: z.number(), suggestions: z.array(z.string()), method: z.string(), disclaimer: z.string(),
});
const feedbackResponse = z.object({
                sample_size: z.number(), sentiment_counts: z.object({ positive: z.number(), neutral: z.number(), negative: z.number() }),
                topic_trends: z.array(z.object({ topic: z.string(), sample_size: z.number(), sentiment_counts: z.object({ positive: z.number(), neutral: z.number(), negative: z.number() }) })), method: z.string(), caveat: z.string(),
});
const coursesResponse = z.object({
                recommendations: z.array(z.object({ course_id: z.string(), title: z.string(), matched_gaps: z.array(z.string()), missing_prerequisites: z.array(z.string()), prerequisites_met: z.boolean(), gap_coverage_pct: z.number().nullable() })),
                catalog_evaluations: z.array(z.object({ course_id: z.string(), title: z.string(), matched_gaps: z.array(z.string()), missing_prerequisites: z.array(z.string()), prerequisites_met: z.boolean(), gap_coverage_pct: z.number().nullable() })),
                skill_gap_count: z.number(), method: z.string(), disclaimer: z.string(),
});
const extractionResponse = z.object({ extracted_text: z.string(), page_count: z.number().optional(), method: z.string(), warning: z.string() });

async function analyze<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
                let response: Response;
                try {
                                response = await fetch(`${base}/${path}`, {
                                                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
                                                signal: AbortSignal.timeout(timeoutMs),
                                });
                } catch {
                                throw new AIServiceError('AI service is unavailable or timed out', 503);
                }
                if (!response.ok) throw new AIServiceError('AI service rejected the feature-analysis request', 502);
                const parsed = schema.safeParse(await response.json().catch(() => null));
                if (!parsed.success) throw new AIServiceError('AI service returned an invalid feature-analysis response', 502);
                return parsed.data;
}

export const analyzeSkillGap = (body: unknown) => analyze('features/skills', body, skillResponse);
export const analyzeCareers = (body: unknown) => analyze('features/careers', body, careerResponse);
export const analyzeResume = (body: unknown) => analyze('features/resume', body, resumeResponse);
export const analyzeFeedback = (body: unknown) => analyze('features/feedback', body, feedbackResponse);
export const analyzeCourses = (body: unknown) => analyze('features/courses', body, coursesResponse);
export const extractResume = (body: unknown) => analyze('features/extract-resume', body, extractionResponse);