import { Router } from 'express';
import { auth, allow } from '../middleware/auth';
import { asyncRoute } from '../middleware/asyncRoute';
import * as features from '../controllers/features';
import * as analysis from '../controllers/featureAnalysis';

export const featureRouter = Router();
featureRouter.use(auth);

featureRouter.get('/learning/matches', asyncRoute(features.learningMatches));
featureRouter.post('/learning/matches', asyncRoute(features.upsertLearningProfile));
featureRouter.get('/learning/invitations', asyncRoute(features.listLearningInvitations));
featureRouter.post('/learning/invitations', asyncRoute(features.learningInvitations));
featureRouter.get('/learning/groups', asyncRoute(features.listLearningGroups));
featureRouter.post('/learning/groups', asyncRoute(features.createLearningGroup));

featureRouter.get('/mentors/matches', asyncRoute(features.mentorMatches));
featureRouter.post('/mentors/matches', asyncRoute(features.upsertMentorProfile));
featureRouter.post('/mentors/profile', asyncRoute(features.upsertFacultyMentorProfile));
featureRouter.put('/mentors/profile', asyncRoute(features.upsertFacultyMentorProfile));
featureRouter.get('/mentors/requests', asyncRoute(features.listMentorshipRequests));
featureRouter.post('/mentors/requests', asyncRoute(features.mentorshipRequests));

featureRouter.get('/certificates', asyncRoute(features.listCertificates));
featureRouter.post('/certificates', asyncRoute(features.createCertificate));
featureRouter.get('/certificates/:id/file', asyncRoute(features.downloadCertificate));
featureRouter.get('/certificates/:id/review', asyncRoute(features.certificateReview));
featureRouter.patch('/certificates/:id/review', allow('admin', 'faculty'), asyncRoute(features.certificateReview));

featureRouter.get('/scholarships', asyncRoute(features.listScholarships));
featureRouter.post('/scholarships', allow('admin'), asyncRoute(features.createScholarship));
featureRouter.get('/scholarships/:id/applications', asyncRoute(features.scholarshipApplications));
featureRouter.post('/scholarships/:id/applications', asyncRoute(features.scholarshipApplications));
featureRouter.patch('/scholarships/:id/applications/:applicationId/review', allow('admin', 'faculty'), asyncRoute(features.reviewScholarshipApplication));

featureRouter.get('/courses', asyncRoute(features.listCourses));
featureRouter.post('/courses', allow('admin', 'faculty'), asyncRoute(features.createCourse));
featureRouter.post('/courses/recommendations', asyncRoute(features.courseRecommendations));

featureRouter.get('/performance/comparison', asyncRoute(features.performanceComparison));
featureRouter.get('/roles', asyncRoute(analysis.listRoles));
featureRouter.post('/roles', allow('admin', 'faculty'), asyncRoute(analysis.createRole));
featureRouter.get('/skills/profile', asyncRoute(analysis.skillProfile));
featureRouter.put('/skills/profile', asyncRoute(analysis.skillProfile));
featureRouter.get('/skills/gap', asyncRoute(analysis.skillGap));
featureRouter.get('/careers/suggestions', asyncRoute(analysis.careerPaths));
featureRouter.post('/resumes/analyze', asyncRoute(analysis.analyzeStudentResume));
featureRouter.get('/resumes', asyncRoute(analysis.listResumes));
featureRouter.get('/feedback/sentiment', asyncRoute(analysis.feedbackSentiment));
