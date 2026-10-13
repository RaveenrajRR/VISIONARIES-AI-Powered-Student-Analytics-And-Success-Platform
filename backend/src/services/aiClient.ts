import {z} from 'zod';

const base=(process.env.AI_SERVICE_URL||'http://127.0.0.1:8000').replace(/\/+$/,'');
const timeoutMs=Number(process.env.AI_SERVICE_TIMEOUT_MS||4000);

export class AIServiceError extends Error{
  constructor(message:string,readonly statusCode:502|503){
    super(message);
    this.name='AIServiceError';
  }
}

const numberOrNull=z.number().finite().nullable();
const scoreSchema=z.object({
  student_id:z.string().nullable().optional(),
  score:numberOrNull,
  coverage_pct:z.number().min(0).max(100),
  confidence_pct:numberOrNull,
  freshness_pct:numberOrNull,
  source_freshness:z.record(z.object({
    status:z.enum(['fresh','stale','unknown']),
    imported_at:z.string().nullable(),
    age_days:numberOrNull,
  })).default({}),
  components:z.record(z.number().finite()),
  weights_used:z.record(z.number().finite()),
  provisional_weights:z.record(z.number().finite()),
  method:z.string(),
  confidence_basis:z.string(),
});
const reasonSchema=z.object({metric:z.string(),value:z.number().finite(),threshold:z.string(),reason:z.string()});
const riskSchema=z.object({
  student_id:z.string().nullable().optional(),
  academic_risk:z.boolean(),
  academic_risk_level:z.enum(['low','moderate','high']),
  academic_reasons:z.array(reasonSchema),
  placement_risk:z.boolean(),
  placement_risk_level:z.enum(['low','moderate','high']),
  placement_reasons:z.array(reasonSchema),
  thresholds:z.record(z.number().finite()),
  disclaimer:z.string(),
});
const explanationsSchema=z.object({
  student_id:z.string().nullable().optional(),
  score:numberOrNull,
  coverage_pct:z.number().min(0).max(100),
  confidence_pct:numberOrNull,
  freshness_pct:numberOrNull,
  source_freshness:z.record(z.unknown()),
  missing_sources:z.array(z.string()),
  factors:z.array(z.object({
    component:z.string(),
    value:z.number().finite(),
    weight:z.number().finite(),
    normalized_weight:z.number().finite(),
    weighted_points:z.number().finite(),
    impact_from_neutral:z.number().finite(),
    direction:z.enum(['improves','reduces']),
    observed_metrics:z.record(z.number().finite()),
    basis:z.string(),
  })),
  method:z.string(),
  confidence_basis:z.string(),
});
const recommendationsSchema=z.object({
  student_id:z.string().nullable().optional(),
  recommendations:z.array(z.object({
    type:z.string(),
    title:z.string(),
    priority:z.enum(['low','medium','high']),
    evidence:z.string(),
    rationale:z.string(),
    suggested_action:z.string(),
    follow_up_days:z.number().int().positive(),
    expected_outcome:z.string(),
  })),
});
const segmentSchema=z.object({
  student_id:z.string().nullable().optional(),
  segment:z.string(),
  segment_evidence:z.array(z.object({metric:z.string(),value:z.number().finite()})),
  recommended_action:z.string(),
  score:scoreSchema,
});
const placementSchema=z.object({
  student_id:z.string().nullable().optional(),
  readiness_pct:numberOrNull,
  coverage_pct:z.number().min(0).max(100),
  observed_metrics:z.record(z.number().finite()),
  skill_gaps:z.array(z.object({skill:z.string(),value:z.number().finite(),target:z.number().finite(),gap:z.number().finite()})),
  practice_plan:z.array(z.object({skill:z.string(),action:z.string(),weeks:z.number().positive()})),
  disclaimer:z.string(),
});

const responseSchemas={
  score:scoreSchema,
  risk:riskSchema,
  explanations:explanationsSchema,
  recommendations:recommendationsSchema,
  segment:segmentSchema,
  placement:placementSchema,
} as const;

export type AIPath=keyof typeof responseSchemas;
export type AIResponse<P extends AIPath=AIPath>=z.infer<(typeof responseSchemas)[P]>;
export interface AIRequestData{
  student_id:string;
  metrics:Record<string,number|null>;
  source_imported_at:Record<string,string|null>;
}

async function requestAI<T>(path:string,init?:RequestInit):Promise<T>{
  let response:Response;
  try{
    response=await fetch(`${base}/${path}`,{
      ...init,
      signal:AbortSignal.timeout(timeoutMs),
    });
  }catch{
    throw new AIServiceError('AI service is unavailable or timed out',503);
  }
  if(!response.ok)throw new AIServiceError('AI service rejected the analytics request',502);
  try{return await response.json() as T;}
  catch{throw new AIServiceError('AI service returned an invalid response',502);}
}

export async function ai<P extends AIPath>(path:P,studentId:string,metrics:Record<string,number|null>,sourceImportedAt:Record<string,string|null>={}):Promise<AIResponse<P>>{
  const body:AIRequestData={student_id:studentId,metrics,source_imported_at:sourceImportedAt};
  const data=await requestAI<unknown>(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const parsed=responseSchemas[path].safeParse(data);
  if(!parsed.success)throw new AIServiceError('AI service returned an invalid analytics response',502);
  return parsed.data as AIResponse<P>;
}

export async function aiHealth(){
  const data=await requestAI<unknown>('health');
  const parsed=z.object({status:z.literal('ok'),service:z.literal('eduai-ai'),mode:z.string()}).passthrough().safeParse(data);
  if(!parsed.success)throw new AIServiceError('AI service returned an invalid health response',502);
  return parsed.data;
}
