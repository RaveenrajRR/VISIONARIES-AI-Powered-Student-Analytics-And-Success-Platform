"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentSkillProfileInput = exports.resumeAnalysisInput = exports.roleInput = exports.recommendationInput = exports.courseInput = exports.scholarshipInput = exports.certificateReviewInput = exports.certificateInput = exports.mentorshipRequestInput = exports.scholarshipApplicationInput = exports.mentorProfileInput = exports.groupInput = exports.invitationInput = exports.learningProfileInput = void 0;
const zod_1 = require("zod");
const tags = zod_1.z.array(zod_1.z.string().trim().min(1).max(80)).max(30).default([]);
exports.learningProfileInput = zod_1.z.object({
    topics: tags,
    availability: zod_1.z.array(zod_1.z.string().trim().min(1).max(80)).max(20).default([]),
    discoverable: zod_1.z.boolean().default(true),
}).strict();
exports.invitationInput = zod_1.z.object({
    receiverStudentId: zod_1.z.string().trim().min(1).max(100).optional(),
    message: zod_1.z.string().trim().max(1000).default(''),
    invitationId: zod_1.z.string().regex(/^[a-f\d]{24}$/i).optional(),
    action: zod_1.z.enum(['accept', 'decline']).optional(),
}).strict().refine(value => (value.invitationId && value.action) || (!value.invitationId && value.receiverStudentId), {
    message: 'Provide a receiverStudentId to invite, or invitationId and action to respond',
});
exports.groupInput = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(120),
    description: zod_1.z.string().trim().max(1000).default(''),
    topics: tags,
    memberStudentIds: zod_1.z.array(zod_1.z.string().trim().min(1).max(100)).max(30).default([]),
}).strict();
exports.mentorProfileInput = zod_1.z.object({
    expertise: tags,
    availability: zod_1.z.array(zod_1.z.string().trim().min(1).max(120)).max(30).default([]),
    topics: tags,
    capacity: zod_1.z.number().int().min(1).max(100).default(1),
    acceptingRequests: zod_1.z.boolean().default(true),
}).strict();
exports.scholarshipApplicationInput = zod_1.z.object({
    certificateIds: zod_1.z.array(zod_1.z.string().regex(/^[a-f\d]{24}$/i)).max(20).default([]),
}).strict();
exports.mentorshipRequestInput = zod_1.z.object({
    profileId: zod_1.z.string().regex(/^[a-f\d]{24}$/i).optional(),
    requestId: zod_1.z.string().regex(/^[a-f\d]{24}$/i).optional(),
    message: zod_1.z.string().trim().min(5).max(2000).optional(),
    action: zod_1.z.enum(['accept', 'decline']).optional(),
}).strict().refine(value => (value.profileId && value.message && !value.requestId && !value.action) || (value.requestId && value.action && !value.profileId && !value.message), {
    message: 'Provide profileId and message to request mentoring, or requestId and action to respond',
});
exports.certificateInput = zod_1.z.object({
    title: zod_1.z.string().trim().min(2).max(200),
    issuer: zod_1.z.string().trim().max(200).optional(),
    issuedAt: zod_1.z.string().datetime().optional(),
    fileName: zod_1.z.string().trim().min(1).max(255),
    contentType: zod_1.z.enum(['application/pdf', 'image/png', 'image/jpeg']),
    contentBase64: zod_1.z.string().min(1).max(4_300_000),
}).strict();
exports.certificateReviewInput = zod_1.z.object({
    status: zod_1.z.enum(['approved', 'rejected']),
    note: zod_1.z.string().trim().max(1000).optional(),
}).strict();
exports.scholarshipInput = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(200),
    description: zod_1.z.string().trim().max(2000).default(''),
    departments: zod_1.z.array(zod_1.z.string().trim().min(1).max(100)).max(100).default([]),
    minimumYear: zod_1.z.number().int().min(1).max(20).optional(),
    maximumYear: zod_1.z.number().int().min(1).max(20).optional(),
    requiredDocuments: zod_1.z.array(zod_1.z.string().trim().min(1).max(120)).max(30).default([]),
    metrics: zod_1.z.array(zod_1.z.object({
        key: zod_1.z.string().trim().min(1).max(100),
        minimum: zod_1.z.number().finite().optional(),
        maximum: zod_1.z.number().finite().optional(),
    }).strict().refine(value => value.minimum !== undefined || value.maximum !== undefined)).max(30).default([]),
}).strict().refine(value => value.minimumYear === undefined || value.maximumYear === undefined || value.minimumYear <= value.maximumYear);
exports.courseInput = zod_1.z.object({
    code: zod_1.z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9._-]+$/),
    title: zod_1.z.string().trim().min(2).max(200),
    department: zod_1.z.string().trim().min(1).max(100),
    credits: zod_1.z.number().finite().min(0.5).max(30),
    prerequisites: zod_1.z.array(zod_1.z.string().trim().min(1).max(40)).max(30).default([]),
    teaches: tags,
    description: zod_1.z.string().trim().max(2000).default(''),
}).strict();
exports.recommendationInput = zod_1.z.object({
    studentId: zod_1.z.string().trim().min(1).max(100).optional(),
    roleId: zod_1.z.string().trim().min(1).max(100).optional(),
}).strict();
exports.roleInput = zod_1.z.object({
    roleId: zod_1.z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/),
    title: zod_1.z.string().trim().min(2).max(120),
    department: zod_1.z.string().trim().min(1).max(100).optional(),
    requiredSkills: tags,
    interests: tags,
    milestones: zod_1.z.array(zod_1.z.string().trim().min(1).max(240)).max(30).default([]),
}).strict().refine(value => value.requiredSkills.length > 0, { path: ['requiredSkills'], message: 'At least one required skill is needed' });
exports.resumeAnalysisInput = zod_1.z.object({
    roleId: zod_1.z.string().trim().min(1).max(100),
    fileName: zod_1.z.string().trim().min(1).max(255),
    contentType: zod_1.z.enum(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    contentBase64: zod_1.z.string().min(1).max(4_300_000),
    jobDescription: zod_1.z.string().trim().min(20).max(12000),
}).strict();
exports.studentSkillProfileInput = zod_1.z.object({
    selfReportedSkills: tags,
    interests: tags,
}).strict();
