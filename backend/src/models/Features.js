"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentSkillProfile = exports.ResumeDocument = exports.RoleCatalog = exports.Course = exports.ScholarshipApplication = exports.Scholarship = exports.Certificate = exports.LearningGroup = exports.LearningInvitation = exports.LearningProfile = exports.MentorshipRequest = exports.MentorProfile = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const options = { timestamps: true, strict: true };
exports.MentorProfile = mongoose_1.default.model('MentorProfile', new mongoose_1.Schema({
    ownerUserId: { type: mongoose_1.Schema.Types.ObjectId, required: true, index: true },
    ownerRole: { type: String, enum: ['faculty', 'student'], required: true },
    studentId: { type: String, index: true },
    department: { type: String, required: true, index: true },
    expertise: { type: [String], default: [] },
    availability: { type: [String], default: [] },
    topics: { type: [String], default: [] },
    capacity: { type: Number, default: 1, min: 1, max: 100 },
    acceptingRequests: { type: Boolean, default: true },
}, options));
exports.MentorshipRequest = mongoose_1.default.model('MentorshipRequest', new mongoose_1.Schema({
    profileId: { type: mongoose_1.Schema.Types.ObjectId, required: true, index: true },
    mentorUserId: { type: mongoose_1.Schema.Types.ObjectId, required: true, index: true },
    requesterStudentId: { type: String, required: true, index: true },
    department: { type: String, required: true, index: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', index: true },
}, options));
exports.LearningProfile = mongoose_1.default.model('LearningProfile', new mongoose_1.Schema({
    studentId: { type: String, required: true, unique: true, index: true },
    department: { type: String, required: true, index: true },
    topics: { type: [String], default: [] },
    availability: { type: [String], default: [] },
    discoverable: { type: Boolean, default: true },
}, options));
exports.LearningInvitation = mongoose_1.default.model('LearningInvitation', new mongoose_1.Schema({
    senderStudentId: { type: String, required: true, index: true },
    receiverStudentId: { type: String, required: true, index: true },
    department: { type: String, required: true, index: true },
    message: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', index: true },
}, options));
exports.LearningGroup = mongoose_1.default.model('LearningGroup', new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    ownerStudentId: { type: String, required: true, index: true },
    memberStudentIds: { type: [String], default: [] },
    department: { type: String, required: true, index: true },
    topics: { type: [String], default: [] },
}, options));
exports.Certificate = mongoose_1.default.model('Certificate', new mongoose_1.Schema({
    studentId: { type: String, required: true, index: true },
    department: { type: String, required: true, index: true },
    title: { type: String, required: true },
    issuer: { type: String },
    issuedAt: { type: Date },
    originalFileName: { type: String, required: true },
    contentType: { type: String, enum: ['application/pdf', 'image/png', 'image/jpeg'], required: true },
    size: { type: Number, required: true },
    storageName: { type: String, required: true, select: false },
    reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewerUserId: { type: mongoose_1.Schema.Types.ObjectId },
    reviewedAt: { type: Date },
    reviewNote: { type: String },
}, options));
exports.Scholarship = mongoose_1.default.model('Scholarship', new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    departments: { type: [String], default: [] },
    minimumYear: { type: Number },
    maximumYear: { type: Number },
    requiredDocuments: { type: [String], default: [] },
    metrics: {
        type: [new mongoose_1.Schema({
                key: { type: String, required: true },
                minimum: { type: Number },
                maximum: { type: Number },
            }, { _id: false, strict: true })], default: []
    },
}, options));
exports.ScholarshipApplication = mongoose_1.default.model('ScholarshipApplication', new mongoose_1.Schema({
    scholarshipId: { type: mongoose_1.Schema.Types.ObjectId, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    department: { type: String, required: true, index: true },
    eligible: { type: Boolean, required: true },
    missingCriteria: { type: [String], default: [] },
    missingDocuments: { type: [String], default: [] },
    supportingDocuments: {
        type: [new mongoose_1.Schema({
                certificateId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
                title: { type: String, required: true },
                originalFileName: { type: String, required: true },
                reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected'], required: true },
            }, { _id: false, strict: true })], default: []
    },
    status: { type: String, enum: ['submitted', 'under_review', 'approved', 'rejected'], default: 'submitted', index: true },
    reviewerUserId: { type: mongoose_1.Schema.Types.ObjectId },
    reviewedAt: { type: Date },
    reviewNote: { type: String },
}, options).index({ scholarshipId: 1, studentId: 1 }, { unique: true }));
exports.Course = mongoose_1.default.model('Course', new mongoose_1.Schema({
    code: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    title: { type: String, required: true },
    department: { type: String, required: true, index: true },
    credits: { type: Number, required: true, min: 0.5, max: 30 },
    prerequisites: { type: [String], default: [] },
    teaches: { type: [String], default: [] },
    description: { type: String, default: '' },
}, options));
exports.RoleCatalog = mongoose_1.default.model('RoleCatalog', new mongoose_1.Schema({
    roleId: { type: String, required: true, unique: true, index: true, trim: true },
    title: { type: String, required: true, trim: true },
    department: { type: String, index: true },
    requiredSkills: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    milestones: { type: [String], default: [] },
    active: { type: Boolean, default: true, index: true },
}, options));
exports.ResumeDocument = mongoose_1.default.model('ResumeDocument', new mongoose_1.Schema({
    studentId: { type: String, required: true, index: true },
    department: { type: String, required: true, index: true },
    roleId: { type: String, required: true },
    originalFileName: { type: String, required: true },
    contentType: { type: String, enum: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], required: true },
    size: { type: Number, required: true },
    storageName: { type: String, required: true, select: false },
    analysis: { type: mongoose_1.Schema.Types.Mixed, required: true },
}, options));
exports.StudentSkillProfile = mongoose_1.default.model('StudentSkillProfile', new mongoose_1.Schema({
    studentId: { type: String, required: true, unique: true, index: true },
    selfReportedSkills: { type: [String], default: [] },
    interests: { type: [String], default: [] },
}, options));
