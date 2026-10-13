import { z } from 'zod';

const tags = z.array(z.string().trim().min(1).max(80)).max(30).default([]);
export const learningProfileInput = z.object({
  topics: tags,
  availability: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  discoverable: z.boolean().default(true),
}).strict();

export const invitationInput = z.object({
  receiverStudentId: z.string().trim().min(1).max(100).optional(),
  message: z.string().trim().max(1000).default(''),
  invitationId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  action: z.enum(['accept', 'decline']).optional(),
}).strict().refine(value => (value.invitationId && value.action) || (!value.invitationId && value.receiverStudentId), {
  message: 'Provide a receiverStudentId to invite, or invitationId and action to respond',
});

export const groupInput = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(''),
  topics: tags,
  memberStudentIds: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
}).strict();

export const mentorProfileInput = z.object({
  expertise: tags,
  availability: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  topics: tags,
  capacity: z.number().int().min(1).max(100).default(1),
  acceptingRequests: z.boolean().default(true),
}).strict();

export const scholarshipApplicationInput = z.object({
  certificateIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(20).default([]),
}).strict();

export const mentorshipRequestInput = z.object({
  profileId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  requestId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  message: z.string().trim().min(5).max(2000).optional(),
  action: z.enum(['accept', 'decline']).optional(),
}).strict().refine(value => (value.profileId && value.message && !value.requestId && !value.action) || (value.requestId && value.action && !value.profileId && !value.message), {
  message: 'Provide profileId and message to request mentoring, or requestId and action to respond',
});

export const certificateInput = z.object({
  title: z.string().trim().min(2).max(200),
  issuer: z.string().trim().max(200).optional(),
  issuedAt: z.string().datetime().optional(),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  contentBase64: z.string().min(1).max(4_300_000),
}).strict();

export const certificateReviewInput = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(1000).optional(),
}).strict();

export const scholarshipInput = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).default(''),
  departments: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  minimumYear: z.number().int().min(1).max(20).optional(),
  maximumYear: z.number().int().min(1).max(20).optional(),
  requiredDocuments: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  metrics: z.array(z.object({
    key: z.string().trim().min(1).max(100),
    minimum: z.number().finite().optional(),
    maximum: z.number().finite().optional(),
  }).strict().refine(value => value.minimum !== undefined || value.maximum !== undefined)).max(30).default([]),
}).strict().refine(value => value.minimumYear === undefined || value.maximumYear === undefined || value.minimumYear <= value.maximumYear);

export const courseInput = z.object({
  code: z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9._-]+$/),
  title: z.string().trim().min(2).max(200),
  department: z.string().trim().min(1).max(100),
  credits: z.number().finite().min(0.5).max(30),
  prerequisites: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  teaches: tags,
  description: z.string().trim().max(2000).default(''),
}).strict();

export const recommendationInput = z.object({
  studentId: z.string().trim().min(1).max(100).optional(),
  roleId: z.string().trim().min(1).max(100).optional(),
}).strict();

export const roleInput = z.object({
  roleId: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/),
  title: z.string().trim().min(2).max(120),
  department: z.string().trim().min(1).max(100).optional(),
  requiredSkills: tags,
  interests: tags,
  milestones: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
}).strict().refine(value => value.requiredSkills.length > 0, { path: ['requiredSkills'], message: 'At least one required skill is needed' });

export const resumeAnalysisInput = z.object({
  roleId: z.string().trim().min(1).max(100),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  contentBase64: z.string().min(1).max(4_300_000),
  jobDescription: z.string().trim().min(20).max(12000),
}).strict();

export const studentSkillProfileInput = z.object({
  selfReportedSkills: tags,
  interests: tags,
}).strict();
