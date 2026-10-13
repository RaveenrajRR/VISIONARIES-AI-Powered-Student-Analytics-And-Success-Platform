import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { app } = require('../src/app.js');
const { ai } = require('../src/services/aiClient.js');
const { visibleStudentFilter } = require('../src/services/studentService.js');
const { AuditLog, Intervention } = require('../src/models/Intervention.js');
const { Student } = require('../src/models/Student.js');
const { User } = require('../src/models/User.js');

const testSecret = 'test-only-jwt-secret';
const originalSecret = process.env.JWT_SECRET;
const originalDemoMode = process.env.DEMO_MODE;

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalSecret === undefined)
        delete process.env.JWT_SECRET;
    else
        process.env.JWT_SECRET = originalSecret;
    if (originalDemoMode === undefined)
        delete process.env.DEMO_MODE;
    else
        process.env.DEMO_MODE = originalDemoMode;
});

function tokenFor(user) {
    process.env.JWT_SECRET = testSecret;
    return jwt.sign({ sub: user._id }, testSecret);
}

describe('API health and authentication', () => {
    it('returns service health without a database', async () => {
        const response = await request(app).get('/api/health');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
    });

    it('requires authentication for AI health and institution risk analytics', async () => {
        expect((await request(app).get('/api/ai/health')).status).toBe(401);
        expect((await request(app).get('/api/analytics/risk-summary')).status).toBe(401);
        expect((await request(app).get('/api/features/skills/profile')).status).toBe(401);
        expect((await request(app).get('/api/features/certificates/507f1f77bcf86cd799439011/file')).status).toBe(401);
    });

    it('does not expose feedback text analytics to student accounts', async () => {
        const user = { _id: 'student-user', active: true, email: 'student@example.invalid', role: 'student', department: 'Civil', studentId: 'S0001' };
        vi.spyOn(User, 'findById').mockResolvedValue(user);
        const authorization = `Bearer ${tokenFor(user)}`;
        const response = await request(app).get('/api/features/feedback/sentiment')
            .set('Authorization', authorization);
        expect(response.status).toBe(403);
    });

    it('rejects invalid login input before database access', async () => {
        const response = await request(app).post('/api/auth/login').send({ email: 'bad-email', password: '' });
        expect(response.status).toBe(400);
    });

    it('authenticates a valid login and returns the provisioned user', async () => {
        const user = { _id: 'user-1', active: true, email: 'admin@example.invalid', passwordHash: 'stored-hash', role: 'admin', department: null, studentId: null };
        process.env.JWT_SECRET = testSecret;
        vi.spyOn(User, 'findOne').mockResolvedValue(user);
        vi.spyOn(bcrypt, 'compare').mockResolvedValue(true);
        vi.spyOn(AuditLog, 'create').mockResolvedValue({});
        const response = await request(app).post('/api/auth/login').send({ email: user.email, password: 'test-password' });
        expect(response.status).toBe(200);
        expect(response.body.user.email).toBe(user.email);
        expect(response.body.token).toBeTruthy();
    });

    it('authenticates public demo accounts only when demo mode is enabled', async () => {
        process.env.DEMO_MODE = 'true';
        process.env.JWT_SECRET = testSecret;
        const user = { _id: 'demo-admin', active: true, demo: true, email: 'admin@eduanexus.demo', role: 'admin', department: null, studentId: null };
        vi.spyOn(User, 'findOne').mockResolvedValue(user);
        vi.spyOn(bcrypt, 'compare').mockResolvedValue(true);
        vi.spyOn(AuditLog, 'create').mockResolvedValue({});
        const response = await request(app).post('/api/auth/login').send({ email: user.email, password: 'demo-password' });
        expect(response.status).toBe(200);
        expect(response.body.user).toMatchObject({ role: 'admin', demo: true });
    });

    it('keeps demo sessions read-only and rejects them when demo mode is disabled', async () => {
        process.env.DEMO_MODE = 'true';
        const user = { _id: 'demo-admin', active: true, demo: true, email: 'admin@eduanexus.demo', role: 'admin' };
        vi.spyOn(User, 'findById').mockResolvedValue(user);
        const authorization = `Bearer ${tokenFor(user)}`;
        const session = await request(app).get('/api/auth/me').set('Authorization', authorization);
        expect(session.status).toBe(200);
        expect(session.body.user).toMatchObject({ role: 'admin', demo: true });
        const write = await request(app).post('/api/imports/commit').set('Authorization', authorization).send({});
        expect(write.status).toBe(403);
        expect(write.body.error).toBe('Demo accounts are read-only');
        process.env.DEMO_MODE = 'false';
        const disabled = await request(app).get('/api/auth/me').set('Authorization', authorization);
        expect(disabled.status).toBe(401);
    });

    it('denies student access to institution-wide risk analytics', async () => {
        const user = { _id: 'student-user', active: true, email: 'student@example.invalid', role: 'student', department: 'Civil', studentId: 'S0001' };
        vi.spyOn(User, 'findById').mockResolvedValue(user);
        const authorization = `Bearer ${tokenFor(user)}`;
        const response = await request(app).get('/api/analytics/risk-summary').set('Authorization', authorization);
        expect(response.status).toBe(403);
    });

    it('prevents a student from reading another student profile', async () => {
        const user = { _id: 'student-user', active: true, email: 'student@example.invalid', role: 'student', department: 'Civil', studentId: 'S0001' };
        vi.spyOn(User, 'findById').mockResolvedValue(user);
        vi.spyOn(Student, 'findOne').mockReturnValue({ lean: async () => ({ studentId: 'S0002', department: 'Civil' }) });
        const authorization = `Bearer ${tokenFor(user)}`;
        const response = await request(app).get('/api/students/S0002').set('Authorization', authorization);
        expect(response.status).toBe(403);
    });

    it('stores the recommendation outcome when assigning an intervention', async () => {
        const user = { _id: 'admin-user', active: true, email: 'admin@example.invalid', role: 'admin', department: null, studentId: null };
        vi.spyOn(User, 'findById').mockResolvedValue(user);
        vi.spyOn(Student, 'findOne').mockResolvedValue({ studentId: 'S0001', department: 'Civil' });
        const create = vi.spyOn(Intervention, 'create').mockResolvedValue({ _id: 'intervention-1' });
        vi.spyOn(AuditLog, 'create').mockResolvedValue({});
        const authorization = `Bearer ${tokenFor(user)}`;
        const response = await request(app).post('/api/interventions')
            .set('Authorization', authorization)
            .send({
                studentId: 'S0001',
                title: 'Attendance follow-up',
                priority: 'high',
                expectedOutcome: 'Review attendance percentage at the next check-in.',
                followUpDate: '2026-10-20T12:00:00.000Z',
            });
        expect(response.status).toBe(201);
        expect(create.mock.calls[0][0]).toMatchObject({
            expectedOutcome: 'Review attendance percentage at the next check-in.',
            department: 'Civil',
        });
    });

    it('returns a safe service-unavailable response when protected analytics cannot reach AI', async () => {
        const user = { _id: 'admin-user', active: true, email: 'admin@example.invalid', role: 'admin', department: null, studentId: null };
        vi.spyOn(User, 'findById').mockResolvedValue(user);
        vi.spyOn(Student, 'findOne').mockResolvedValue({
            studentId: 'S0001',
            department: 'Civil',
            sources: new Map(),
            sourceMetadata: new Map(),
        });
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
        const authorization = `Bearer ${tokenFor(user)}`;
        const response = await request(app).get('/api/students/S0001/score')
            .set('Authorization', authorization);
        expect(response.status).toBe(503);
        expect(response.body.error).toBe('AI service is unavailable or timed out');
        expect(response.body.stack).toBeUndefined();
    });
});

describe('authorization filters and persisted intervention shape', () => {
    it('does not allow faculty query filters to escape their department', () => {
        expect(visibleStudentFilter({ role: 'faculty', department: 'Civil' }, { department: 'Computer Science' }))
            .toEqual({ department: 'Civil' });
    });

    it('escapes search text so it is treated literally', () => {
        const filter = visibleStudentFilter({ role: 'admin' }, { q: '.*' });
        expect(filter.$or[0].studentId.source).toBe('\.\*');
    });

    it('persists the expected intervention outcome field', () => {
        expect(Intervention.schema.path('expectedOutcome')).toBeDefined();
    });
});

describe('AI service failure handling', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('returns a safe 503 error when the AI service cannot be reached', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
        await expect(ai('score', 'S0001', {})).rejects.toMatchObject({
            statusCode: 503,
            message: 'AI service is unavailable or timed out',
        });
    });

    it('rejects malformed AI responses instead of passing them through', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ score: 'not-a-score' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })));
        await expect(ai('score', 'S0001', {})).rejects.toMatchObject({
            statusCode: 502,
            message: 'AI service returned an invalid analytics response',
        });
    });
});
