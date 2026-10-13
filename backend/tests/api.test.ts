import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { AIServiceError, ai } from '../src/services/aiClient';
import { visibleStudentFilter } from '../src/services/studentService';
import { AuditLog, Intervention } from '../src/models/Intervention';
import { Student } from '../src/models/Student';
import { User } from '../src/models/User';

const testSecret = 'test-only-jwt-secret';
const originalSecret = process.env.JWT_SECRET;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

function tokenFor(user: { _id: string; role: string; department?: string; studentId?: string; email: string }) {
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
    vi.spyOn(User, 'findById').mockResolvedValue(user as never);
    const response = await request(app).get('/api/features/feedback/sentiment')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(response.status).toBe(403);
  });

  it('rejects invalid login input before database access', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'bad-email', password: '' });
    expect(response.status).toBe(400);
  });

  it('authenticates a valid login and returns the provisioned user', async () => {
    const user = { _id: 'user-1', active: true, email: 'admin@example.invalid', passwordHash: 'stored-hash', role: 'admin', department: null, studentId: null };
    process.env.JWT_SECRET = testSecret;
    vi.spyOn(User, 'findOne').mockResolvedValue(user as never);
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as never);
    const response = await request(app).post('/api/auth/login').send({ email: user.email, password: 'test-password' });
    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(user.email);
    expect(response.body.token).toBeTruthy();
  });

  it('denies student access to institution-wide risk analytics', async () => {
    const user = { _id: 'student-user', active: true, email: 'student@example.invalid', role: 'student', department: 'Civil', studentId: 'S0001' };
    vi.spyOn(User, 'findById').mockResolvedValue(user as never);
    const response = await request(app).get('/api/analytics/risk-summary').set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(response.status).toBe(403);
  });

  it('prevents a student from reading another student profile', async () => {
    const user = { _id: 'student-user', active: true, email: 'student@example.invalid', role: 'student', department: 'Civil', studentId: 'S0001' };
    vi.spyOn(User, 'findById').mockResolvedValue(user as never);
    vi.spyOn(Student, 'findOne').mockReturnValue({ lean: async () => ({ studentId: 'S0002', department: 'Civil' }) } as never);
    const response = await request(app).get('/api/students/S0002').set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(response.status).toBe(403);
  });

  it('stores the recommendation outcome when assigning an intervention', async () => {
    const user = { _id: 'admin-user', active: true, email: 'admin@example.invalid', role: 'admin', department: null, studentId: null };
    vi.spyOn(User, 'findById').mockResolvedValue(user as never);
    vi.spyOn(Student, 'findOne').mockResolvedValue({ studentId: 'S0001', department: 'Civil' } as never);
    const create = vi.spyOn(Intervention, 'create').mockResolvedValue({ _id: 'intervention-1' } as never);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as never);
    const response = await request(app).post('/api/interventions')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
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
    vi.spyOn(User, 'findById').mockResolvedValue(user as never);
    vi.spyOn(Student, 'findOne').mockResolvedValue({
      studentId: 'S0001',
      department: 'Civil',
      sources: new Map(),
      sourceMetadata: new Map(),
    } as never);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    const response = await request(app).get('/api/students/S0001/score')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
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
    expect(filter.$or[0].studentId.source).toBe('\\.\\*');
  });

  it('persists the expected intervention outcome field', () => {
    expect(Intervention.schema.path('expectedOutcome')).toBeDefined();
  });
});

describe('AI service failure handling', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns a safe 503 error when the AI service cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    await expect(ai('score', 'S0001', {})).rejects.toMatchObject<Partial<AIServiceError>>({
      statusCode: 503,
      message: 'AI service is unavailable or timed out',
    });
  });

  it('rejects malformed AI responses instead of passing them through', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ score: 'not-a-score' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    await expect(ai('score', 'S0001', {})).rejects.toMatchObject<Partial<AIServiceError>>({
      statusCode: 502,
      message: 'AI service returned an invalid analytics response',
    });
  });
});
