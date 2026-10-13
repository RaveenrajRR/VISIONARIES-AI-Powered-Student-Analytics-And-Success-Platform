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
exports.featureRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const asyncRoute_1 = require("../middleware/asyncRoute");
const features = __importStar(require("../controllers/features"));
const analysis = __importStar(require("../controllers/featureAnalysis"));
exports.featureRouter = (0, express_1.Router)();
exports.featureRouter.use(auth_1.auth);
exports.featureRouter.get('/learning/matches', (0, asyncRoute_1.asyncRoute)(features.learningMatches));
exports.featureRouter.post('/learning/matches', (0, asyncRoute_1.asyncRoute)(features.upsertLearningProfile));
exports.featureRouter.get('/learning/invitations', (0, asyncRoute_1.asyncRoute)(features.listLearningInvitations));
exports.featureRouter.post('/learning/invitations', (0, asyncRoute_1.asyncRoute)(features.learningInvitations));
exports.featureRouter.get('/learning/groups', (0, asyncRoute_1.asyncRoute)(features.listLearningGroups));
exports.featureRouter.post('/learning/groups', (0, asyncRoute_1.asyncRoute)(features.createLearningGroup));
exports.featureRouter.get('/mentors/matches', (0, asyncRoute_1.asyncRoute)(features.mentorMatches));
exports.featureRouter.post('/mentors/matches', (0, asyncRoute_1.asyncRoute)(features.upsertMentorProfile));
exports.featureRouter.post('/mentors/profile', (0, asyncRoute_1.asyncRoute)(features.upsertFacultyMentorProfile));
exports.featureRouter.put('/mentors/profile', (0, asyncRoute_1.asyncRoute)(features.upsertFacultyMentorProfile));
exports.featureRouter.get('/mentors/requests', (0, asyncRoute_1.asyncRoute)(features.listMentorshipRequests));
exports.featureRouter.post('/mentors/requests', (0, asyncRoute_1.asyncRoute)(features.mentorshipRequests));
exports.featureRouter.get('/certificates', (0, asyncRoute_1.asyncRoute)(features.listCertificates));
exports.featureRouter.post('/certificates', (0, asyncRoute_1.asyncRoute)(features.createCertificate));
exports.featureRouter.get('/certificates/:id/file', (0, asyncRoute_1.asyncRoute)(features.downloadCertificate));
exports.featureRouter.get('/certificates/:id/review', (0, asyncRoute_1.asyncRoute)(features.certificateReview));
exports.featureRouter.patch('/certificates/:id/review', (0, auth_1.allow)('admin', 'faculty'), (0, asyncRoute_1.asyncRoute)(features.certificateReview));
exports.featureRouter.get('/scholarships', (0, asyncRoute_1.asyncRoute)(features.listScholarships));
exports.featureRouter.post('/scholarships', (0, auth_1.allow)('admin'), (0, asyncRoute_1.asyncRoute)(features.createScholarship));
exports.featureRouter.get('/scholarships/:id/applications', (0, asyncRoute_1.asyncRoute)(features.scholarshipApplications));
exports.featureRouter.post('/scholarships/:id/applications', (0, asyncRoute_1.asyncRoute)(features.scholarshipApplications));
exports.featureRouter.patch('/scholarships/:id/applications/:applicationId/review', (0, auth_1.allow)('admin', 'faculty'), (0, asyncRoute_1.asyncRoute)(features.reviewScholarshipApplication));
exports.featureRouter.get('/courses', (0, asyncRoute_1.asyncRoute)(features.listCourses));
exports.featureRouter.post('/courses', (0, auth_1.allow)('admin', 'faculty'), (0, asyncRoute_1.asyncRoute)(features.createCourse));
exports.featureRouter.post('/courses/recommendations', (0, asyncRoute_1.asyncRoute)(features.courseRecommendations));
exports.featureRouter.get('/performance/comparison', (0, asyncRoute_1.asyncRoute)(features.performanceComparison));
exports.featureRouter.get('/roles', (0, asyncRoute_1.asyncRoute)(analysis.listRoles));
exports.featureRouter.post('/roles', (0, auth_1.allow)('admin', 'faculty'), (0, asyncRoute_1.asyncRoute)(analysis.createRole));
exports.featureRouter.get('/skills/profile', (0, asyncRoute_1.asyncRoute)(analysis.skillProfile));
exports.featureRouter.put('/skills/profile', (0, asyncRoute_1.asyncRoute)(analysis.skillProfile));
exports.featureRouter.get('/skills/gap', (0, asyncRoute_1.asyncRoute)(analysis.skillGap));
exports.featureRouter.get('/careers/suggestions', (0, asyncRoute_1.asyncRoute)(analysis.careerPaths));
exports.featureRouter.post('/resumes/analyze', (0, asyncRoute_1.asyncRoute)(analysis.analyzeStudentResume));
exports.featureRouter.get('/resumes', (0, asyncRoute_1.asyncRoute)(analysis.listResumes));
exports.featureRouter.get('/feedback/sentiment', (0, asyncRoute_1.asyncRoute)(analysis.feedbackSentiment));
