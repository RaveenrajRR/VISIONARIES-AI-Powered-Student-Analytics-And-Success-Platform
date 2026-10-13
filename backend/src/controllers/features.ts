import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { Student } from '../models/Student';
import {
  Certificate, Course, LearningGroup, LearningInvitation, LearningProfile, MentorProfile,
  MentorshipRequest, Scholarship, ScholarshipApplication, RoleCatalog, StudentSkillProfile,
} from '../models/Features';
import {
  certificateInput, certificateReviewInput, courseInput, groupInput, invitationInput,
  learningProfileInput, mentorProfileInput, mentorshipRequestInput, recommendationInput,
  scholarshipApplicationInput, scholarshipInput,
} from '../validators/features';
import { analyzeCourses } from '../services/featureAnalysis';

type Actor = { id: string; role: string; department?: string; studentId?: string; email?: string };
const isObject = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const plain = (value: any): any => value instanceof Map ? Object.fromEntries(value) : value;

function validated<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { flatten(): unknown } } }, body: unknown, res: Response): T | undefined {
  const parsed = schema.safeParse(body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return undefined; }
  return parsed.data;
}
function actor(req: Request): Actor | undefined { return req.user; }
function routeParam(value: string | string[] | undefined): string { return typeof value === 'string' ? value : ''; }
function forbidden(res: Response): void { res.status(403).json({ error: 'Forbidden' }); }
function studentOnly(req: Request, res: Response): boolean {
  if (actor(req)?.role !== 'student' || !actor(req)?.studentId) { forbidden(res); return false; }
  return true;
}
async function studentInScope(req: Request, res: Response, studentId: string): Promise<any | null> {
  const student = await Student.findOne({ studentId }).lean();
  if (!student) return null;
  const user = actor(req);
  if (user?.role === 'student' && user.studentId !== student.studentId) { forbidden(res); return null; }
  if (user?.role === 'faculty' && user.department !== student.department) { forbidden(res); return null; }
  if (user?.role !== 'student' && user?.role !== 'faculty' && user?.role !== 'admin') { forbidden(res); return null; }
  return student;
}
async function ownStudent(req: Request, res: Response): Promise<any | null> {
  const user = actor(req);
  if (user?.role !== 'student' || !user.studentId) { forbidden(res); return null; }
  return Student.findOne({ studentId: user.studentId }).lean();
}
function source(student: any, name: string): any {
  const sources = plain(student?.sources);
  return plain(sources?.[name]);
}
function sourceList(student: any, name: string): any[] {
  const value = source(student, name);
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return [];
  const list = value.items ?? value.records ?? value.courses ?? value.semesters;
  return Array.isArray(list) ? list : [];
}
function flattenMetrics(student: any): Record<string, number> {
  const result: Record<string, number> = {};
  const visit = (value: any, prefix: string) => {
    if (value instanceof Map) value = Object.fromEntries(value);
    if (Array.isArray(value)) return;
    if (isObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        if (['student_id', 'studentId', 'synthetic', 'importedAt'].includes(key)) continue;
        visit(item, prefix ? `${prefix}.${key}` : key);
      }
      return;
    }
    if (typeof value === 'number' && Number.isFinite(value)) result[prefix] = value;
    else if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) result[prefix] = Number(value);
  };
  for (const name of ['academic', 'attendance', 'lms', 'engagement', 'placement', 'skills', 'feedback']) visit(source(student, name), name);
  return result;
}
function allTerms(student: any): string[] {
  const terms = new Set<string>();
  for (const name of ['skills', 'academic', 'lms']) {
    const data = source(student, name);
    if (!isObject(data)) continue;
    for (const field of ['skills', 'interests', 'topics', 'subjects']) {
      const values = data[field];
      if (Array.isArray(values)) for (const item of values) if (typeof item === 'string') terms.add(item.trim().toLowerCase());
    }
  }
  return [...terms];
}
function studentDepartmentFilter(user: Actor, query: any = {}): Record<string, unknown> {
  if (user.role === 'faculty') return { department: user.department || '__no_department_assigned__' };
  if (user.role === 'student') return { studentId: user.studentId || '__no_student_assigned__' };
  return typeof query.department === 'string' && query.department ? { department: query.department } : {};
}
function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function upsertLearningProfile(req: Request, res: Response) {
  if (!studentOnly(req, res)) return;
  const input = validated(learningProfileInput, req.body, res); if (!input) return;
  const student = await ownStudent(req, res); if (!student) return res.status(404).json({ error: 'Student record not found' });
  const profile = await LearningProfile.findOneAndUpdate(
    { studentId: student.studentId },
    { $set: { ...input, studentId: student.studentId, department: student.department } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  return res.json(profile);
}

export async function learningMatches(req: Request, res: Response) {
  if (!studentOnly(req, res)) return;
  const me = await ownStudent(req, res); if (!me) return res.status(404).json({ error: 'Student record not found' });
  const profile = await LearningProfile.findOne({ studentId: me.studentId, discoverable: true }).lean();
  if (!profile) return res.json({ items: [], note: 'Create a discoverable learning profile to see matches.' });
  const candidates = await LearningProfile.find({
    department: me.department, discoverable: true, studentId: { $ne: me.studentId },
  }).select('studentId topics availability').lean();
  const items = candidates.map(candidate => {
    const overlap = candidate.topics.filter((topic: string) => profile.topics.some((mine: string) => mine.toLowerCase() === topic.toLowerCase()));
    const sharedAvailability = candidate.availability.filter((slot: string) => profile.availability.some((mine: string) => mine.toLowerCase() === slot.toLowerCase()));
    return {
      studentId: candidate.studentId,
      topics: candidate.topics,
      availability: candidate.availability,
      sharedTopics: overlap,
      sharedAvailability,
      compatibility: { sharedTopicCount: overlap.length, sharedAvailabilityCount: sharedAvailability.length },
      explanation: [
        overlap.length ? `Shared study topics: ${overlap.join(', ')}` : 'No shared study topics yet',
        sharedAvailability.length ? `Shared availability: ${sharedAvailability.join(', ')}` : 'No matching availability provided',
      ],
    };
  }).sort((a, b) => b.compatibility.sharedTopicCount - a.compatibility.sharedTopicCount || b.compatibility.sharedAvailabilityCount - a.compatibility.sharedAvailabilityCount || a.studentId.localeCompare(b.studentId));
  return res.json({ items });
}

export async function learningInvitations(req: Request, res: Response) {
  const input = validated(invitationInput, req.body, res); if (!input) return;
  if (!studentOnly(req, res)) return;
  const me = await ownStudent(req, res); if (!me) return res.status(404).json({ error: 'Student record not found' });
  if (input.invitationId && input.action) {
    const invite = await LearningInvitation.findById(input.invitationId);
    if (!invite) return res.status(404).json({ error: 'Invitation not found' });
    if (invite.receiverStudentId !== me.studentId) return forbidden(res);
    if (invite.status !== 'pending') return res.status(409).json({ error: 'Invitation is no longer pending' });
    invite.status = input.action === 'accept' ? 'accepted' : 'declined';
    await invite.save();
    return res.json(invite);
  }
  const target = await Student.findOne({ studentId: input.receiverStudentId }).lean();
  if (!target) return res.status(404).json({ error: 'Student not found' });
  if (target.studentId === me.studentId) return res.status(400).json({ error: 'Cannot invite yourself' });
  if (target.department !== me.department) return forbidden(res);
  const discoverable = await LearningProfile.exists({ studentId: target.studentId, discoverable: true });
  if (!discoverable) return res.status(404).json({ error: 'Student does not have a discoverable learning profile' });
  const invitation = await LearningInvitation.create({
    senderStudentId: me.studentId, receiverStudentId: target.studentId,
    department: me.department, message: input.message,
  });
  return res.status(201).json(invitation);
}

export async function listLearningInvitations(req: Request, res: Response) {
  if (!studentOnly(req, res)) return;
  const id = actor(req)!.studentId!;
  const items = await LearningInvitation.find({ $or: [{ senderStudentId: id }, { receiverStudentId: id }] }).sort({ createdAt: -1 }).lean();
  return res.json({ items });
}

export async function listLearningGroups(req: Request, res: Response) {
  const user = actor(req)!;
  if (user.role === 'student') {
    if (!user.studentId) return forbidden(res);
    const items = await LearningGroup.find({ memberStudentIds: user.studentId }).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  }
  if (user.role !== 'admin' && user.role !== 'faculty') return forbidden(res);
  const filter = studentDepartmentFilter(user, req.query);
  const items = await LearningGroup.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  return res.json({ items });
}

export async function createLearningGroup(req: Request, res: Response) {
  if (!studentOnly(req, res)) return;
  const input = validated(groupInput, req.body, res); if (!input) return;
  const me = await ownStudent(req, res); if (!me) return res.status(404).json({ error: 'Student record not found' });
  const members = [...new Set([me.studentId, ...input.memberStudentIds])];
  if (members.length !== input.memberStudentIds.length + 1) return res.status(400).json({ error: 'Duplicate group member' });
  const others = members.filter(id => id !== me.studentId);
  const candidates = others.length ? await Student.find({ studentId: { $in: others } }).select('studentId department').lean() : [];
  if (candidates.length !== others.length) return res.status(400).json({ error: 'One or more students do not exist' });
  if (candidates.some(student => student.department !== me.department)) return forbidden(res);
  for (const studentId of others) {
    const accepted = await LearningInvitation.exists({
      status: 'accepted',
      $or: [
        { senderStudentId: me.studentId, receiverStudentId: studentId },
        { senderStudentId: studentId, receiverStudentId: me.studentId },
      ],
    });
    if (!accepted) return res.status(403).json({ error: 'An accepted learning invitation is required for each additional member' });
  }
  const group = await LearningGroup.create({
    ...input, ownerStudentId: me.studentId, memberStudentIds: members, department: me.department,
  });
  return res.status(201).json(group);
}

export async function upsertFacultyMentorProfile(req: Request, res: Response) {
  const user = actor(req)!;
  if (user.role !== 'faculty') return forbidden(res);
  if (!user.department) return res.status(400).json({ error: 'Faculty department is required' });
  const input = validated(mentorProfileInput, req.body, res); if (!input) return;
  const profile = await MentorProfile.findOneAndUpdate(
    { ownerUserId: user.id },
    { $set: { ...input, ownerUserId: user.id, ownerRole: 'faculty', department: user.department } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  return res.json(profile);
}

export async function upsertMentorProfile(req: Request, res: Response) {
  const user = actor(req)!;
  if (!['student', 'faculty'].includes(user.role)) return forbidden(res);
  if (user.role === 'student' && !user.studentId) return forbidden(res);
  if (user.role === 'faculty' && !user.department) return res.status(400).json({ error: 'Faculty department is required' });
  const input = validated(mentorProfileInput, req.body, res); if (!input) return;
  let student: any = null;
  if (user.role === 'student') {
    student = await Student.findOne({ studentId: user.studentId }).lean();
    if (!student) return res.status(404).json({ error: 'Student record not found' });
  }
  const department = user.role === 'faculty' ? user.department : student.department;
  const profile = await MentorProfile.findOneAndUpdate(
    { ownerUserId: user.id },
    { $set: { ...input, ownerUserId: user.id, ownerRole: user.role, studentId: student?.studentId, department } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  return res.json(profile);
}

export async function mentorMatches(req: Request, res: Response) {
  if (!studentOnly(req, res)) return;
  const me = await ownStudent(req, res); if (!me) return res.status(404).json({ error: 'Student record not found' });
  const interests = allTerms(me);
  const profiles = await MentorProfile.find({
    department: me.department, acceptingRequests: true, ownerUserId: { $ne: actor(req)!.id },
  }).select('ownerRole studentId department expertise availability capacity topics').lean();
  const activeRequests = await MentorshipRequest.aggregate([
    { $match: { profileId: { $in: profiles.map(profile => profile._id) }, status: { $in: ['pending', 'accepted'] } } },
    { $group: { _id: '$profileId', count: { $sum: 1 } } },
  ]);
  const activeByProfile = new Map(activeRequests.map(row => [String(row._id), row.count]));
  const items = profiles.map(profile => {
    const tags = [...profile.expertise, ...profile.topics];
    const shared = tags.filter((tag: string) => interests.includes(tag.toLowerCase()));
    const activeCount = activeByProfile.get(String(profile._id)) || 0;
    return {
      profileId: String(profile._id), mentorRole: profile.ownerRole, department: profile.department,
      expertise: profile.expertise, availability: profile.availability, capacity: profile.capacity,
      topics: profile.topics, sharedTopics: shared, activeRequestCount: activeCount,
      compatibility: { sharedTopicCount: shared.length, remainingCapacity: Math.max(0, profile.capacity - activeCount) },
      explanation: shared.length ? [`Relevant expertise/topics: ${shared.join(', ')}`] : ['No exact skill or interest overlap found'],
    };
  }).filter(item => item.compatibility.remainingCapacity > 0).sort((a, b) => b.compatibility.sharedTopicCount - a.compatibility.sharedTopicCount || b.compatibility.remainingCapacity - a.compatibility.remainingCapacity || a.profileId.localeCompare(b.profileId));
  return res.json({ items });
}

export async function mentorshipRequests(req: Request, res: Response) {
  const input = validated(mentorshipRequestInput, req.body, res); if (!input) return;
  const user = actor(req)!;
  if (input.profileId && input.message) {
    if (!studentOnly(req, res)) return;
    const me = await ownStudent(req, res); if (!me) return res.status(404).json({ error: 'Student record not found' });
    const profile = await MentorProfile.findById(input.profileId).lean();
    if (!profile) return res.status(404).json({ error: 'Mentor profile not found' });
    if (!profile.acceptingRequests) return res.status(409).json({ error: 'Mentor is not accepting requests' });
    if (profile.department !== me.department) return forbidden(res);
    if (profile.studentId === me.studentId) return res.status(400).json({ error: 'Cannot request mentorship from your own profile' });
    const activeCount = await MentorshipRequest.countDocuments({ profileId: profile._id, status: { $in: ['pending', 'accepted'] } });
    if (activeCount >= profile.capacity) return res.status(409).json({ error: 'Mentor capacity has been reached' });
    const duplicate = await MentorshipRequest.exists({ profileId: profile._id, requesterStudentId: me.studentId, status: { $in: ['pending', 'accepted'] } });
    if (duplicate) return res.status(409).json({ error: 'An active request already exists' });
    const request = await MentorshipRequest.create({
      profileId: profile._id, mentorUserId: profile.ownerUserId, requesterStudentId: me.studentId,
      department: me.department, message: input.message,
    });
    return res.status(201).json(request);
  }
  if (!input.requestId || !input.action) return;
  const request = await MentorshipRequest.findById(input.requestId);
  if (!request) return res.status(404).json({ error: 'Mentorship request not found' });
  if (user.role === 'student' || (user.role !== 'admin' && user.role !== 'faculty')) return forbidden(res);
  if (user.role === 'faculty' && (user.id !== String(request.mentorUserId) || user.department !== request.department)) return forbidden(res);
  if (request.status !== 'pending') return res.status(409).json({ error: 'Request is no longer pending' });
  request.status = input.action === 'accept' ? 'accepted' : 'declined';
  await request.save();
  return res.json(request);
}

export async function listMentorshipRequests(req: Request, res: Response) {
  const user = actor(req)!; let filter: any = {};
  if (user.role === 'student') {
    if (!user.studentId) return forbidden(res);
    filter.requesterStudentId = user.studentId;
  } else if (user.role === 'faculty') {
    filter.mentorUserId = user.id;
    filter.department = user.department || '__no_department_assigned__';
  } else if (user.role === 'admin') {
    Object.assign(filter, studentDepartmentFilter(user, req.query));
  } else return forbidden(res);
  return res.json({ items: await MentorshipRequest.find(filter).sort({ createdAt: -1 }).limit(200).lean() });
}

function publicCertificate(certificate: any) {
  const result = { ...certificate };
  delete result.storageName;
  return result;
}
export async function createCertificate(req: Request, res: Response) {
  if (!studentOnly(req, res)) return;
  const input = validated(certificateInput, req.body, res); if (!input) return;
  const me = await ownStudent(req, res); if (!me) return res.status(404).json({ error: 'Student record not found' });
  let bytes: Buffer;
  try { bytes = Buffer.from(input.contentBase64, 'base64'); }
  catch { return res.status(400).json({ error: 'Invalid base64 file content' }); }
  if (bytes.length === 0 || bytes.length > 3 * 1024 * 1024) return res.status(413).json({ error: 'Certificate file must be no larger than 3 MiB' });
  const signatures: Record<string, (data: Buffer) => boolean> = {
    'application/pdf': data => data.subarray(0, 5).toString('ascii') === '%PDF-',
    'image/png': data => data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    'image/jpeg': data => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
  };
  if (!signatures[input.contentType](bytes)) return res.status(400).json({ error: 'File content does not match the declared PDF, PNG, or JPEG type' });
  const safeName = input.fileName.replace(/\\/g, '/').split('/').pop()!.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255);
  const storageName = `${randomUUID()}.${input.contentType === 'application/pdf' ? 'pdf' : input.contentType === 'image/png' ? 'png' : 'jpg'}`;
  const storageDirectory = path.resolve(__dirname, '..', '..', 'private-files', 'certificates');
  await mkdir(storageDirectory, { recursive: true, mode: 0o700 });
  const storagePath = path.join(storageDirectory, storageName);
  await writeFile(storagePath, bytes, { flag: 'wx', mode: 0o600 });
  try {
    const certificate = await Certificate.create({
      studentId: me.studentId, department: me.department, title: input.title,
      issuer: input.issuer, issuedAt: input.issuedAt ? new Date(input.issuedAt) : undefined,
      originalFileName: safeName, contentType: input.contentType, size: bytes.length,
      storageName,
    });
    return res.status(201).json(publicCertificate(certificate.toObject()));
  } catch (error) {
    await unlink(storagePath).catch(() => undefined);
    throw error;
  }
}

export async function listCertificates(req: Request, res: Response) {
  const user = actor(req)!;
  let filter: any = {};
  if (user.role === 'student') {
    if (!user.studentId) return forbidden(res);
    filter.studentId = user.studentId;
  } else if (user.role === 'faculty' || user.role === 'admin') {
    filter = studentDepartmentFilter(user, req.query);
  } else return forbidden(res);
  const items = await Certificate.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  return res.json({ items: items.map(publicCertificate) });
}

export async function certificateReview(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ error: 'Invalid certificate id' });
  const user = actor(req)!;
  const certificate = await Certificate.findById(id);
  if (!certificate) return res.status(404).json({ error: 'Certificate not found' });
  if (user.role === 'student') {
    if (certificate.studentId !== user.studentId) return forbidden(res);
    return res.json(publicCertificate(certificate.toObject()));
  }
  if (user.role !== 'admin' && user.role !== 'faculty') return forbidden(res);
  if (user.role === 'faculty' && user.department !== certificate.department) return forbidden(res);
  if (req.method === 'GET') return res.json(publicCertificate(certificate.toObject()));
  const input = validated(certificateReviewInput, req.body, res); if (!input) return;
  certificate.reviewStatus = input.status;
  certificate.reviewNote = input.note;
  certificate.reviewerUserId = user.id as any;
  certificate.reviewedAt = new Date();
  await certificate.save();
  return res.json(publicCertificate(certificate.toObject()));
}

export async function downloadCertificate(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ error: 'Invalid certificate id' });
  const certificate = await Certificate.findById(id).select('+storageName');
  if (!certificate) return res.status(404).json({ error: 'Certificate not found' });
  const user = actor(req)!;
  if (user.role === 'student' && certificate.studentId !== user.studentId) return forbidden(res);
  if (user.role === 'faculty' && certificate.department !== user.department) return forbidden(res);
  if (!['student', 'faculty', 'admin'].includes(user.role)) return forbidden(res);
  const storageDirectory = path.resolve(__dirname, '..', '..', 'private-files', 'certificates');
  const storagePath = path.resolve(storageDirectory, certificate.storageName);
  if (path.dirname(storagePath) !== storageDirectory) return res.status(404).json({ error: 'Certificate file not found' });
  let bytes: Buffer;
  try { bytes = await readFile(storagePath); }
  catch { return res.status(404).json({ error: 'Certificate file not found' }); }
  const fileName = certificate.originalFileName.replace(/[\r\n"\\]/g, '_');
  res.setHeader('Content-Type', certificate.contentType);
  res.setHeader('Content-Length', bytes.length);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(bytes);
}

function scholarshipEligibility(scholarship: any, student: any, certificates: any[] = []): { eligible: boolean; missingCriteria: string[]; missingDocuments: string[] } {
  const missing: string[] = [];
  if (scholarship.departments.length && !scholarship.departments.includes(student.department)) missing.push('department');
  if (scholarship.minimumYear !== undefined && student.year < scholarship.minimumYear) missing.push(`year >= ${scholarship.minimumYear}`);
  if (scholarship.maximumYear !== undefined && student.year > scholarship.maximumYear) missing.push(`year <= ${scholarship.maximumYear}`);
  const metrics = flattenMetrics(student);
  for (const criterion of scholarship.metrics) {
    const value = metrics[criterion.key] ?? metrics[criterion.key.toLowerCase()];
    if (value === undefined) { missing.push(`${criterion.key}:missing`); continue; }
    if (criterion.minimum !== undefined && value < criterion.minimum) missing.push(`${criterion.key} >= ${criterion.minimum}`);
    if (criterion.maximum !== undefined && value > criterion.maximum) missing.push(`${criterion.key} <= ${criterion.maximum}`);
  }
  const approvedTitles = certificates.filter(certificate => certificate.reviewStatus === 'approved').map(certificate => String(certificate.title).toLowerCase());
  const missingDocuments = (scholarship.requiredDocuments || []).filter((required: string) => !approvedTitles.some((title: string) => title.includes(required.toLowerCase())));
  return { eligible: missing.length === 0 && missingDocuments.length === 0, missingCriteria: missing, missingDocuments };
}

export async function listScholarships(req: Request, res: Response) {
  const scholarships = await Scholarship.find({}).sort({ name: 1 }).lean();
  if (actor(req)?.role !== 'student') return res.json({ items: scholarships });
  const me = await ownStudent(req, res); if (!me) return res.status(404).json({ error: 'Student record not found' });
  const certificates = await Certificate.find({ studentId: me.studentId }).select('title reviewStatus').lean();
  return res.json({ items: scholarships.map(s => ({ ...s, eligibility: scholarshipEligibility(s, me, certificates) })) });
}

export async function createScholarship(req: Request, res: Response) {
  if (actor(req)?.role !== 'admin') return forbidden(res);
  const input = validated(scholarshipInput, req.body, res); if (!input) return;
  const scholarship = await Scholarship.create(input);
  return res.status(201).json(scholarship);
}

export async function scholarshipApplications(req: Request, res: Response) {
  const scholarshipId = routeParam(req.params.id);
  if (!/^[a-f\d]{24}$/i.test(scholarshipId)) return res.status(400).json({ error: 'Invalid scholarship id' });
  const scholarship = await Scholarship.findById(scholarshipId).lean();
  if (!scholarship) return res.status(404).json({ error: 'Scholarship not found' });
  const user = actor(req)!;
  if (req.method === 'GET') {
    let filter: any = { scholarshipId: scholarship._id };
    if (user.role === 'student') {
      if (!user.studentId) return forbidden(res);
      filter.studentId = user.studentId;
    } else if (user.role === 'faculty') filter.department = user.department || '__no_department_assigned__';
    else if (user.role !== 'admin') return forbidden(res);
    return res.json({ items: await ScholarshipApplication.find(filter).sort({ createdAt: -1 }).limit(200).lean() });
  }
  if (user.role !== 'student' || !user.studentId) return forbidden(res);
  const input = validated(scholarshipApplicationInput, req.body, res); if (!input) return;
  const me = await ownStudent(req, res); if (!me) return res.status(404).json({ error: 'Student record not found' });
  const allCertificates = await Certificate.find({ studentId: me.studentId }).select('title reviewStatus').lean();
  const eligibility = scholarshipEligibility(scholarship, me, allCertificates);
  const certificateIds = input.certificateIds;
  const certificates = certificateIds.length ? await Certificate.find({
    _id: { $in: certificateIds }, studentId: me.studentId,
  }).select('title originalFileName reviewStatus').lean() : [];
  if (certificates.length !== new Set(certificateIds).size) return res.status(400).json({ error: 'Supporting certificate must belong to the applicant' });
  const supportingDocuments = certificates.map(certificate => ({
    certificateId: certificate._id, title: certificate.title,
    originalFileName: certificate.originalFileName, reviewStatus: certificate.reviewStatus,
  }));
  const existing = await ScholarshipApplication.exists({ scholarshipId: scholarship._id, studentId: me.studentId });
  const application = await ScholarshipApplication.findOneAndUpdate(
    { scholarshipId: scholarship._id, studentId: me.studentId },
    {
      $setOnInsert: {
        scholarshipId: scholarship._id, studentId: me.studentId, department: me.department,
        ...eligibility, supportingDocuments, status: 'submitted',
      }
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  return res.status(existing ? 200 : 201).json(application);
}

export async function reviewScholarshipApplication(req: Request, res: Response) {
  const user = actor(req)!;
  if (user.role !== 'admin' && user.role !== 'faculty') return forbidden(res);
  const statusSchema = {
    safeParse(value: unknown) {
      if (!isObject(value) || !['under_review', 'approved', 'rejected'].includes(value.status) || ('note' in value && (typeof value.note !== 'string' || value.note.length > 1000))) return { success: false as const, error: { flatten: () => ({ fieldErrors: { status: ['Invalid review input'] } }) } };
      return { success: true as const, data: { status: value.status as string, note: value.note as string | undefined } };
    }
  };
  const input = validated(statusSchema, req.body, res); if (!input) return;
  const scholarshipId = routeParam(req.params.id), applicationId = routeParam(req.params.applicationId);
  if (!/^[a-f\d]{24}$/i.test(scholarshipId) || !/^[a-f\d]{24}$/i.test(applicationId)) return res.status(400).json({ error: 'Invalid id' });
  const application = await ScholarshipApplication.findOne({ _id: applicationId, scholarshipId });
  if (!application) return res.status(404).json({ error: 'Application not found' });
  if (user.role === 'faculty' && user.department !== application.department) return forbidden(res);
  application.status = input.status as 'under_review' | 'approved' | 'rejected';
  application.reviewNote = input.note;
  application.reviewerUserId = user.id as any;
  application.reviewedAt = new Date();
  await application.save();
  return res.json(application);
}

export async function listCourses(req: Request, res: Response) {
  const filter: any = {};
  if (typeof req.query.department === 'string' && req.query.department) filter.department = req.query.department;
  const items = await Course.find(filter).sort({ department: 1, code: 1 }).limit(500).lean();
  return res.json({ items });
}

export async function createCourse(req: Request, res: Response) {
  const user = actor(req)!;
  if (user.role !== 'admin' && user.role !== 'faculty') return forbidden(res);
  const input = validated(courseInput, req.body, res); if (!input) return;
  if (user.role === 'faculty' && input.department !== user.department) return forbidden(res);
  const course = await Course.create({ ...input, code: input.code.toUpperCase() });
  return res.status(201).json(course);
}

export async function courseRecommendations(req: Request, res: Response) {
  const input = validated(recommendationInput, req.body, res); if (!input) return;
  const user = actor(req)!;
  const studentId = user.role === 'student' ? user.studentId : input.studentId;
  if (!studentId) return res.status(400).json({ error: 'studentId is required' });
  const me = await studentInScope(req, res, studentId); if (!me) return res.status(404).json({ error: 'Student record not found' });
  const academic = source(me, 'academic');
  const history = sourceList(me, 'academic').filter(item => isObject(item));
  const explicit = Array.isArray(academic?.completedCourses) ? academic.completedCourses : Array.isArray(academic?.courses) ? academic.courses : [];
  const prerequisiteEvidenceAvailable = explicit.length > 0 || history.length > 0;
  const completed = new Set<string>();
  for (const item of explicit) {
    if (typeof item === 'string') completed.add(item.toUpperCase());
    else if (isObject(item) && (item.completed === true || ['completed', 'passed'].includes(String(item.status || '').toLowerCase()))) {
      const code = item.courseCode || item.code; if (typeof code === 'string') completed.add(code.toUpperCase());
    }
  }
  for (const item of history) {
    if (item.completed === true || ['completed', 'passed'].includes(String(item.status || '').toLowerCase())) {
      const code = item.courseCode || item.code; if (typeof code === 'string') completed.add(code.toUpperCase());
    }
  }
  const courses = await Course.find({ department: me.department }).sort({ code: 1 }).lean();
  const eligibleCourses = courses.filter(course => !completed.has(course.code.toUpperCase())).map(course => ({
    course,
    missingPrerequisites: course.prerequisites.filter((prerequisite: string) => !completed.has(prerequisite.toUpperCase())),
  }));
  const role = input.roleId ? await RoleCatalog.findOne({ roleId: input.roleId, active: true }).lean() : null;
  if (input.roleId && (!role || (role.department && role.department !== me.department))) return res.status(404).json({ error: 'Role requirements not found' });
  const skillProfile = await StudentSkillProfile.findOne({ studentId: me.studentId }).lean();
  const skillsSource = source(me, 'skills');
  const verifiedSkills = Array.isArray(skillsSource?.verifiedSkills) ? skillsSource.verifiedSkills : [];
  const skillEvidence = [...new Set([...verifiedSkills, ...(skillProfile?.selfReportedSkills || [])].map((item: any) => typeof item === 'string' ? item : item?.skill || item?.name).filter((name: unknown): name is string => typeof name === 'string'))];
  const skillGaps = role ? role.requiredSkills.filter((required: string) => !skillEvidence.some(skill => skill.toLowerCase() === required.toLowerCase())) : [];
  const analysis = await analyzeCourses({
    course_catalog: eligibleCourses.map(({ course }) => ({ course_id: course.code, title: course.title, teaches: course.teaches, prerequisites: [] })),
    student_skills: skillEvidence,
    skill_gaps: skillGaps,
  });
  const gapIds = new Set(analysis.recommendations.map(item => item.course_id));
  const items = eligibleCourses.map(({ course, missingPrerequisites }) => ({
    course,
    eligible: missingPrerequisites.length === 0,
    missingPrerequisites,
    matchedSkillGaps: analysis.catalog_evaluations.find(item => item.course_id === course.code)?.matched_gaps || [],
    recommended: missingPrerequisites.length === 0 && gapIds.has(course.code),
    explanation: missingPrerequisites.length ? 'Complete the listed course prerequisites first.' : gapIds.has(course.code) ? 'Teaches one or more missing requirements for the selected role.' : 'No overlap with the selected role gaps, or no mapped skill gaps exist.',
  }));
  return res.json({ studentId: me.studentId, prerequisiteEvidenceAvailable, role: role ? { roleId: role.roleId, title: role.title } : null, items, method: analysis.method, disclaimer: analysis.disclaimer });
}

function semesterMetrics(student: any): Array<{ semester: string; metric: string; value: number }> {
  const academic = source(student, 'academic');
  const raw = Array.isArray(academic?.semesters) ? academic.semesters : sourceList(student, 'academic').filter(item => isObject(item) && item.semester !== undefined);
  const result: Array<{ semester: string; metric: string; value: number }> = [];
  for (const record of raw) {
    if (!isObject(record)) continue;
    const semester = String(record.semester ?? record.term ?? '').trim();
    if (!semester) continue;
    for (const [metric, value] of Object.entries(record)) {
      if (['semester', 'term', 'studentId', 'student_id', 'synthetic'].includes(metric)) continue;
      const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
      if (Number.isFinite(number)) result.push({ semester, metric, value: number });
    }
  }
  return result;
}

export async function performanceComparison(req: Request, res: Response) {
  const user = actor(req)!;
  if (!['student', 'faculty', 'admin'].includes(user.role)) return forbidden(res);
  let filter: any = {};
  if (user.role === 'student') {
    if (!user.studentId) return forbidden(res);
    filter.studentId = user.studentId;
  } else filter = studentDepartmentFilter(user, req.query);
  const students = await Student.find(filter).select('studentId department sources').limit(1000).lean();
  const records = students.flatMap(student => semesterMetrics(student)
    .filter(row => typeof req.query.semester !== 'string' || row.semester === req.query.semester)
    .filter(row => typeof req.query.metric !== 'string' || row.metric === req.query.metric)
    .map(row => ({ ...row, department: student.department })));
  const groups = new Map<string, { department: string; semester: string; metric: string; sum: number; count: number }>();
  for (const record of records) {
    const key = `${record.department}\u0000${record.semester}\u0000${record.metric}`;
    const group = groups.get(key) || { department: record.department, semester: record.semester, metric: record.metric, sum: 0, count: 0 };
    group.sum += record.value; group.count++; groups.set(key, group);
  }
  const items = [...groups.values()].map(group => {
    const suppressed = user.role !== 'student' && group.count < 5;
    return {
      department: group.department, semester: group.semester, metric: group.metric,
      average: suppressed ? null : group.sum / group.count,
      count: suppressed ? null : group.count,
      suppressed,
    };
  }).sort((a, b) => a.department.localeCompare(b.department) || a.semester.localeCompare(b.semester) || a.metric.localeCompare(b.metric));
  if (req.query.format === 'csv') {
    const csv = [['department', 'semester', 'metric', 'average', 'count', 'suppressed'], ...items.map(row => [row.department, row.semester, row.metric, row.average ?? '', row.count ?? '', row.suppressed])]
      .map(row => row.map(csvCell).join(',')).join('\r\n');
    res.type('text/csv').attachment('semester-performance.csv').send(csv);
    return;
  }
  return res.json({ items });
}
