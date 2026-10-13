"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertLearningProfile = upsertLearningProfile;
exports.learningMatches = learningMatches;
exports.learningInvitations = learningInvitations;
exports.listLearningInvitations = listLearningInvitations;
exports.listLearningGroups = listLearningGroups;
exports.createLearningGroup = createLearningGroup;
exports.upsertFacultyMentorProfile = upsertFacultyMentorProfile;
exports.upsertMentorProfile = upsertMentorProfile;
exports.mentorMatches = mentorMatches;
exports.mentorshipRequests = mentorshipRequests;
exports.listMentorshipRequests = listMentorshipRequests;
exports.createCertificate = createCertificate;
exports.listCertificates = listCertificates;
exports.certificateReview = certificateReview;
exports.downloadCertificate = downloadCertificate;
exports.listScholarships = listScholarships;
exports.createScholarship = createScholarship;
exports.scholarshipApplications = scholarshipApplications;
exports.reviewScholarshipApplication = reviewScholarshipApplication;
exports.listCourses = listCourses;
exports.createCourse = createCourse;
exports.courseRecommendations = courseRecommendations;
exports.performanceComparison = performanceComparison;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const Student_1 = require("../models/Student");
const Features_1 = require("../models/Features");
const features_1 = require("../validators/features");
const featureAnalysis_1 = require("../services/featureAnalysis");
const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const plain = (value) => value instanceof Map ? Object.fromEntries(value) : value;
function validated(schema, body, res) {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return undefined;
    }
    return parsed.data;
}
function actor(req) { return req.user; }
function routeParam(value) { return typeof value === 'string' ? value : ''; }
function forbidden(res) { res.status(403).json({ error: 'Forbidden' }); }
function studentOnly(req, res) {
    if (actor(req)?.role !== 'student' || !actor(req)?.studentId) {
        forbidden(res);
        return false;
    }
    return true;
}
async function studentInScope(req, res, studentId) {
    const student = await Student_1.Student.findOne({ studentId }).lean();
    if (!student)
        return null;
    const user = actor(req);
    if (user?.role === 'student' && user.studentId !== student.studentId) {
        forbidden(res);
        return null;
    }
    if (user?.role === 'faculty' && user.department !== student.department) {
        forbidden(res);
        return null;
    }
    if (user?.role !== 'student' && user?.role !== 'faculty' && user?.role !== 'admin') {
        forbidden(res);
        return null;
    }
    return student;
}
async function ownStudent(req, res) {
    const user = actor(req);
    if (user?.role !== 'student' || !user.studentId) {
        forbidden(res);
        return null;
    }
    return Student_1.Student.findOne({ studentId: user.studentId }).lean();
}
function source(student, name) {
    const sources = plain(student?.sources);
    return plain(sources?.[name]);
}
function sourceList(student, name) {
    const value = source(student, name);
    if (Array.isArray(value))
        return value;
    if (!isObject(value))
        return [];
    const list = value.items ?? value.records ?? value.courses ?? value.semesters;
    return Array.isArray(list) ? list : [];
}
function flattenMetrics(student) {
    const result = {};
    const visit = (value, prefix) => {
        if (value instanceof Map)
            value = Object.fromEntries(value);
        if (Array.isArray(value))
            return;
        if (isObject(value)) {
            for (const [key, item] of Object.entries(value)) {
                if (['student_id', 'studentId', 'synthetic', 'importedAt'].includes(key))
                    continue;
                visit(item, prefix ? `${prefix}.${key}` : key);
            }
            return;
        }
        if (typeof value === 'number' && Number.isFinite(value))
            result[prefix] = value;
        else if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
            result[prefix] = Number(value);
    };
    for (const name of ['academic', 'attendance', 'lms', 'engagement', 'placement', 'skills', 'feedback'])
        visit(source(student, name), name);
    return result;
}
function allTerms(student) {
    const terms = new Set();
    for (const name of ['skills', 'academic', 'lms']) {
        const data = source(student, name);
        if (!isObject(data))
            continue;
        for (const field of ['skills', 'interests', 'topics', 'subjects']) {
            const values = data[field];
            if (Array.isArray(values))
                for (const item of values)
                    if (typeof item === 'string')
                        terms.add(item.trim().toLowerCase());
        }
    }
    return [...terms];
}
function studentDepartmentFilter(user, query = {}) {
    if (user.role === 'faculty')
        return { department: user.department || '__no_department_assigned__' };
    if (user.role === 'student')
        return { studentId: user.studentId || '__no_student_assigned__' };
    return typeof query.department === 'string' && query.department ? { department: query.department } : {};
}
function csvCell(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
async function upsertLearningProfile(req, res) {
    if (!studentOnly(req, res))
        return;
    const input = validated(features_1.learningProfileInput, req.body, res);
    if (!input)
        return;
    const student = await ownStudent(req, res);
    if (!student)
        return res.status(404).json({ error: 'Student record not found' });
    const profile = await Features_1.LearningProfile.findOneAndUpdate({ studentId: student.studentId }, { $set: { ...input, studentId: student.studentId, department: student.department } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).lean();
    return res.json(profile);
}
async function learningMatches(req, res) {
    if (!studentOnly(req, res))
        return;
    const me = await ownStudent(req, res);
    if (!me)
        return res.status(404).json({ error: 'Student record not found' });
    const profile = await Features_1.LearningProfile.findOne({ studentId: me.studentId, discoverable: true }).lean();
    if (!profile)
        return res.json({ items: [], note: 'Create a discoverable learning profile to see matches.' });
    const candidates = await Features_1.LearningProfile.find({
        department: me.department, discoverable: true, studentId: { $ne: me.studentId },
    }).select('studentId topics availability').lean();
    const items = candidates.map(candidate => {
        const overlap = candidate.topics.filter((topic) => profile.topics.some((mine) => mine.toLowerCase() === topic.toLowerCase()));
        const sharedAvailability = candidate.availability.filter((slot) => profile.availability.some((mine) => mine.toLowerCase() === slot.toLowerCase()));
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
async function learningInvitations(req, res) {
    const input = validated(features_1.invitationInput, req.body, res);
    if (!input)
        return;
    if (!studentOnly(req, res))
        return;
    const me = await ownStudent(req, res);
    if (!me)
        return res.status(404).json({ error: 'Student record not found' });
    if (input.invitationId && input.action) {
        const invite = await Features_1.LearningInvitation.findById(input.invitationId);
        if (!invite)
            return res.status(404).json({ error: 'Invitation not found' });
        if (invite.receiverStudentId !== me.studentId)
            return forbidden(res);
        if (invite.status !== 'pending')
            return res.status(409).json({ error: 'Invitation is no longer pending' });
        invite.status = input.action === 'accept' ? 'accepted' : 'declined';
        await invite.save();
        return res.json(invite);
    }
    const target = await Student_1.Student.findOne({ studentId: input.receiverStudentId }).lean();
    if (!target)
        return res.status(404).json({ error: 'Student not found' });
    if (target.studentId === me.studentId)
        return res.status(400).json({ error: 'Cannot invite yourself' });
    if (target.department !== me.department)
        return forbidden(res);
    const discoverable = await Features_1.LearningProfile.exists({ studentId: target.studentId, discoverable: true });
    if (!discoverable)
        return res.status(404).json({ error: 'Student does not have a discoverable learning profile' });
    const invitation = await Features_1.LearningInvitation.create({
        senderStudentId: me.studentId, receiverStudentId: target.studentId,
        department: me.department, message: input.message,
    });
    return res.status(201).json(invitation);
}
async function listLearningInvitations(req, res) {
    if (!studentOnly(req, res))
        return;
    const id = actor(req).studentId;
    const items = await Features_1.LearningInvitation.find({ $or: [{ senderStudentId: id }, { receiverStudentId: id }] }).sort({ createdAt: -1 }).lean();
    return res.json({ items });
}
async function listLearningGroups(req, res) {
    const user = actor(req);
    if (user.role === 'student') {
        if (!user.studentId)
            return forbidden(res);
        const items = await Features_1.LearningGroup.find({ memberStudentIds: user.studentId }).sort({ createdAt: -1 }).lean();
        return res.json({ items });
    }
    if (user.role !== 'admin' && user.role !== 'faculty')
        return forbidden(res);
    const filter = studentDepartmentFilter(user, req.query);
    const items = await Features_1.LearningGroup.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ items });
}
async function createLearningGroup(req, res) {
    if (!studentOnly(req, res))
        return;
    const input = validated(features_1.groupInput, req.body, res);
    if (!input)
        return;
    const me = await ownStudent(req, res);
    if (!me)
        return res.status(404).json({ error: 'Student record not found' });
    const members = [...new Set([me.studentId, ...input.memberStudentIds])];
    if (members.length !== input.memberStudentIds.length + 1)
        return res.status(400).json({ error: 'Duplicate group member' });
    const others = members.filter(id => id !== me.studentId);
    const candidates = others.length ? await Student_1.Student.find({ studentId: { $in: others } }).select('studentId department').lean() : [];
    if (candidates.length !== others.length)
        return res.status(400).json({ error: 'One or more students do not exist' });
    if (candidates.some(student => student.department !== me.department))
        return forbidden(res);
    for (const studentId of others) {
        const accepted = await Features_1.LearningInvitation.exists({
            status: 'accepted',
            $or: [
                { senderStudentId: me.studentId, receiverStudentId: studentId },
                { senderStudentId: studentId, receiverStudentId: me.studentId },
            ],
        });
        if (!accepted)
            return res.status(403).json({ error: 'An accepted learning invitation is required for each additional member' });
    }
    const group = await Features_1.LearningGroup.create({
        ...input, ownerStudentId: me.studentId, memberStudentIds: members, department: me.department,
    });
    return res.status(201).json(group);
}
async function upsertFacultyMentorProfile(req, res) {
    const user = actor(req);
    if (user.role !== 'faculty')
        return forbidden(res);
    if (!user.department)
        return res.status(400).json({ error: 'Faculty department is required' });
    const input = validated(features_1.mentorProfileInput, req.body, res);
    if (!input)
        return;
    const profile = await Features_1.MentorProfile.findOneAndUpdate({ ownerUserId: user.id }, { $set: { ...input, ownerUserId: user.id, ownerRole: 'faculty', department: user.department } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).lean();
    return res.json(profile);
}
async function upsertMentorProfile(req, res) {
    const user = actor(req);
    if (!['student', 'faculty'].includes(user.role))
        return forbidden(res);
    if (user.role === 'student' && !user.studentId)
        return forbidden(res);
    if (user.role === 'faculty' && !user.department)
        return res.status(400).json({ error: 'Faculty department is required' });
    const input = validated(features_1.mentorProfileInput, req.body, res);
    if (!input)
        return;
    let student = null;
    if (user.role === 'student') {
        student = await Student_1.Student.findOne({ studentId: user.studentId }).lean();
        if (!student)
            return res.status(404).json({ error: 'Student record not found' });
    }
    const department = user.role === 'faculty' ? user.department : student.department;
    const profile = await Features_1.MentorProfile.findOneAndUpdate({ ownerUserId: user.id }, { $set: { ...input, ownerUserId: user.id, ownerRole: user.role, studentId: student?.studentId, department } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).lean();
    return res.json(profile);
}
async function mentorMatches(req, res) {
    if (!studentOnly(req, res))
        return;
    const me = await ownStudent(req, res);
    if (!me)
        return res.status(404).json({ error: 'Student record not found' });
    const interests = allTerms(me);
    const profiles = await Features_1.MentorProfile.find({
        department: me.department, acceptingRequests: true, ownerUserId: { $ne: actor(req).id },
    }).select('ownerRole studentId department expertise availability capacity topics').lean();
    const activeRequests = await Features_1.MentorshipRequest.aggregate([
        { $match: { profileId: { $in: profiles.map(profile => profile._id) }, status: { $in: ['pending', 'accepted'] } } },
        { $group: { _id: '$profileId', count: { $sum: 1 } } },
    ]);
    const activeByProfile = new Map(activeRequests.map(row => [String(row._id), row.count]));
    const items = profiles.map(profile => {
        const tags = [...profile.expertise, ...profile.topics];
        const shared = tags.filter((tag) => interests.includes(tag.toLowerCase()));
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
async function mentorshipRequests(req, res) {
    const input = validated(features_1.mentorshipRequestInput, req.body, res);
    if (!input)
        return;
    const user = actor(req);
    if (input.profileId && input.message) {
        if (!studentOnly(req, res))
            return;
        const me = await ownStudent(req, res);
        if (!me)
            return res.status(404).json({ error: 'Student record not found' });
        const profile = await Features_1.MentorProfile.findById(input.profileId).lean();
        if (!profile)
            return res.status(404).json({ error: 'Mentor profile not found' });
        if (!profile.acceptingRequests)
            return res.status(409).json({ error: 'Mentor is not accepting requests' });
        if (profile.department !== me.department)
            return forbidden(res);
        if (profile.studentId === me.studentId)
            return res.status(400).json({ error: 'Cannot request mentorship from your own profile' });
        const activeCount = await Features_1.MentorshipRequest.countDocuments({ profileId: profile._id, status: { $in: ['pending', 'accepted'] } });
        if (activeCount >= profile.capacity)
            return res.status(409).json({ error: 'Mentor capacity has been reached' });
        const duplicate = await Features_1.MentorshipRequest.exists({ profileId: profile._id, requesterStudentId: me.studentId, status: { $in: ['pending', 'accepted'] } });
        if (duplicate)
            return res.status(409).json({ error: 'An active request already exists' });
        const request = await Features_1.MentorshipRequest.create({
            profileId: profile._id, mentorUserId: profile.ownerUserId, requesterStudentId: me.studentId,
            department: me.department, message: input.message,
        });
        return res.status(201).json(request);
    }
    if (!input.requestId || !input.action)
        return;
    const request = await Features_1.MentorshipRequest.findById(input.requestId);
    if (!request)
        return res.status(404).json({ error: 'Mentorship request not found' });
    if (user.role === 'student' || (user.role !== 'admin' && user.role !== 'faculty'))
        return forbidden(res);
    if (user.role === 'faculty' && (user.id !== String(request.mentorUserId) || user.department !== request.department))
        return forbidden(res);
    if (request.status !== 'pending')
        return res.status(409).json({ error: 'Request is no longer pending' });
    request.status = input.action === 'accept' ? 'accepted' : 'declined';
    await request.save();
    return res.json(request);
}
async function listMentorshipRequests(req, res) {
    const user = actor(req);
    let filter = {};
    if (user.role === 'student') {
        if (!user.studentId)
            return forbidden(res);
        filter.requesterStudentId = user.studentId;
    }
    else if (user.role === 'faculty') {
        filter.mentorUserId = user.id;
        filter.department = user.department || '__no_department_assigned__';
    }
    else if (user.role === 'admin') {
        Object.assign(filter, studentDepartmentFilter(user, req.query));
    }
    else
        return forbidden(res);
    return res.json({ items: await Features_1.MentorshipRequest.find(filter).sort({ createdAt: -1 }).limit(200).lean() });
}
function publicCertificate(certificate) {
    const result = { ...certificate };
    delete result.storageName;
    return result;
}
async function createCertificate(req, res) {
    if (!studentOnly(req, res))
        return;
    const input = validated(features_1.certificateInput, req.body, res);
    if (!input)
        return;
    const me = await ownStudent(req, res);
    if (!me)
        return res.status(404).json({ error: 'Student record not found' });
    let bytes;
    try {
        bytes = Buffer.from(input.contentBase64, 'base64');
    }
    catch {
        return res.status(400).json({ error: 'Invalid base64 file content' });
    }
    if (bytes.length === 0 || bytes.length > 3 * 1024 * 1024)
        return res.status(413).json({ error: 'Certificate file must be no larger than 3 MiB' });
    const signatures = {
        'application/pdf': data => data.subarray(0, 5).toString('ascii') === '%PDF-',
        'image/png': data => data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        'image/jpeg': data => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
    };
    if (!signatures[input.contentType](bytes))
        return res.status(400).json({ error: 'File content does not match the declared PDF, PNG, or JPEG type' });
    const safeName = input.fileName.replace(/\\/g, '/').split('/').pop().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255);
    const storageName = `${(0, crypto_1.randomUUID)()}.${input.contentType === 'application/pdf' ? 'pdf' : input.contentType === 'image/png' ? 'png' : 'jpg'}`;
    const storageDirectory = path_1.default.resolve(__dirname, '..', '..', 'private-files', 'certificates');
    await (0, promises_1.mkdir)(storageDirectory, { recursive: true, mode: 0o700 });
    const storagePath = path_1.default.join(storageDirectory, storageName);
    await (0, promises_1.writeFile)(storagePath, bytes, { flag: 'wx', mode: 0o600 });
    try {
        const certificate = await Features_1.Certificate.create({
            studentId: me.studentId, department: me.department, title: input.title,
            issuer: input.issuer, issuedAt: input.issuedAt ? new Date(input.issuedAt) : undefined,
            originalFileName: safeName, contentType: input.contentType, size: bytes.length,
            storageName,
        });
        return res.status(201).json(publicCertificate(certificate.toObject()));
    }
    catch (error) {
        await (0, promises_1.unlink)(storagePath).catch(() => undefined);
        throw error;
    }
}
async function listCertificates(req, res) {
    const user = actor(req);
    let filter = {};
    if (user.role === 'student') {
        if (!user.studentId)
            return forbidden(res);
        filter.studentId = user.studentId;
    }
    else if (user.role === 'faculty' || user.role === 'admin') {
        filter = studentDepartmentFilter(user, req.query);
    }
    else
        return forbidden(res);
    const items = await Features_1.Certificate.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ items: items.map(publicCertificate) });
}
async function certificateReview(req, res) {
    const id = routeParam(req.params.id);
    if (!/^[a-f\d]{24}$/i.test(id))
        return res.status(400).json({ error: 'Invalid certificate id' });
    const user = actor(req);
    const certificate = await Features_1.Certificate.findById(id);
    if (!certificate)
        return res.status(404).json({ error: 'Certificate not found' });
    if (user.role === 'student') {
        if (certificate.studentId !== user.studentId)
            return forbidden(res);
        return res.json(publicCertificate(certificate.toObject()));
    }
    if (user.role !== 'admin' && user.role !== 'faculty')
        return forbidden(res);
    if (user.role === 'faculty' && user.department !== certificate.department)
        return forbidden(res);
    if (req.method === 'GET')
        return res.json(publicCertificate(certificate.toObject()));
    const input = validated(features_1.certificateReviewInput, req.body, res);
    if (!input)
        return;
    certificate.reviewStatus = input.status;
    certificate.reviewNote = input.note;
    certificate.reviewerUserId = user.id;
    certificate.reviewedAt = new Date();
    await certificate.save();
    return res.json(publicCertificate(certificate.toObject()));
}
async function downloadCertificate(req, res) {
    const id = routeParam(req.params.id);
    if (!/^[a-f\d]{24}$/i.test(id))
        return res.status(400).json({ error: 'Invalid certificate id' });
    const certificate = await Features_1.Certificate.findById(id).select('+storageName');
    if (!certificate)
        return res.status(404).json({ error: 'Certificate not found' });
    const user = actor(req);
    if (user.role === 'student' && certificate.studentId !== user.studentId)
        return forbidden(res);
    if (user.role === 'faculty' && certificate.department !== user.department)
        return forbidden(res);
    if (!['student', 'faculty', 'admin'].includes(user.role))
        return forbidden(res);
    const storageDirectory = path_1.default.resolve(__dirname, '..', '..', 'private-files', 'certificates');
    const storagePath = path_1.default.resolve(storageDirectory, certificate.storageName);
    if (path_1.default.dirname(storagePath) !== storageDirectory)
        return res.status(404).json({ error: 'Certificate file not found' });
    let bytes;
    try {
        bytes = await (0, promises_1.readFile)(storagePath);
    }
    catch {
        return res.status(404).json({ error: 'Certificate file not found' });
    }
    const fileName = certificate.originalFileName.replace(/[\r\n"\\]/g, '_');
    res.setHeader('Content-Type', certificate.contentType);
    res.setHeader('Content-Length', bytes.length);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(bytes);
}
function scholarshipEligibility(scholarship, student, certificates = []) {
    const missing = [];
    if (scholarship.departments.length && !scholarship.departments.includes(student.department))
        missing.push('department');
    if (scholarship.minimumYear !== undefined && student.year < scholarship.minimumYear)
        missing.push(`year >= ${scholarship.minimumYear}`);
    if (scholarship.maximumYear !== undefined && student.year > scholarship.maximumYear)
        missing.push(`year <= ${scholarship.maximumYear}`);
    const metrics = flattenMetrics(student);
    for (const criterion of scholarship.metrics) {
        const value = metrics[criterion.key] ?? metrics[criterion.key.toLowerCase()];
        if (value === undefined) {
            missing.push(`${criterion.key}:missing`);
            continue;
        }
        if (criterion.minimum !== undefined && value < criterion.minimum)
            missing.push(`${criterion.key} >= ${criterion.minimum}`);
        if (criterion.maximum !== undefined && value > criterion.maximum)
            missing.push(`${criterion.key} <= ${criterion.maximum}`);
    }
    const approvedTitles = certificates.filter(certificate => certificate.reviewStatus === 'approved').map(certificate => String(certificate.title).toLowerCase());
    const missingDocuments = (scholarship.requiredDocuments || []).filter((required) => !approvedTitles.some((title) => title.includes(required.toLowerCase())));
    return { eligible: missing.length === 0 && missingDocuments.length === 0, missingCriteria: missing, missingDocuments };
}
async function listScholarships(req, res) {
    const scholarships = await Features_1.Scholarship.find({}).sort({ name: 1 }).lean();
    if (actor(req)?.role !== 'student')
        return res.json({ items: scholarships });
    const me = await ownStudent(req, res);
    if (!me)
        return res.status(404).json({ error: 'Student record not found' });
    const certificates = await Features_1.Certificate.find({ studentId: me.studentId }).select('title reviewStatus').lean();
    return res.json({ items: scholarships.map(s => ({ ...s, eligibility: scholarshipEligibility(s, me, certificates) })) });
}
async function createScholarship(req, res) {
    if (actor(req)?.role !== 'admin')
        return forbidden(res);
    const input = validated(features_1.scholarshipInput, req.body, res);
    if (!input)
        return;
    const scholarship = await Features_1.Scholarship.create(input);
    return res.status(201).json(scholarship);
}
async function scholarshipApplications(req, res) {
    const scholarshipId = routeParam(req.params.id);
    if (!/^[a-f\d]{24}$/i.test(scholarshipId))
        return res.status(400).json({ error: 'Invalid scholarship id' });
    const scholarship = await Features_1.Scholarship.findById(scholarshipId).lean();
    if (!scholarship)
        return res.status(404).json({ error: 'Scholarship not found' });
    const user = actor(req);
    if (req.method === 'GET') {
        let filter = { scholarshipId: scholarship._id };
        if (user.role === 'student') {
            if (!user.studentId)
                return forbidden(res);
            filter.studentId = user.studentId;
        }
        else if (user.role === 'faculty')
            filter.department = user.department || '__no_department_assigned__';
        else if (user.role !== 'admin')
            return forbidden(res);
        return res.json({ items: await Features_1.ScholarshipApplication.find(filter).sort({ createdAt: -1 }).limit(200).lean() });
    }
    if (user.role !== 'student' || !user.studentId)
        return forbidden(res);
    const input = validated(features_1.scholarshipApplicationInput, req.body, res);
    if (!input)
        return;
    const me = await ownStudent(req, res);
    if (!me)
        return res.status(404).json({ error: 'Student record not found' });
    const allCertificates = await Features_1.Certificate.find({ studentId: me.studentId }).select('title reviewStatus').lean();
    const eligibility = scholarshipEligibility(scholarship, me, allCertificates);
    const certificateIds = input.certificateIds;
    const certificates = certificateIds.length ? await Features_1.Certificate.find({
        _id: { $in: certificateIds }, studentId: me.studentId,
    }).select('title originalFileName reviewStatus').lean() : [];
    if (certificates.length !== new Set(certificateIds).size)
        return res.status(400).json({ error: 'Supporting certificate must belong to the applicant' });
    const supportingDocuments = certificates.map(certificate => ({
        certificateId: certificate._id, title: certificate.title,
        originalFileName: certificate.originalFileName, reviewStatus: certificate.reviewStatus,
    }));
    const existing = await Features_1.ScholarshipApplication.exists({ scholarshipId: scholarship._id, studentId: me.studentId });
    const application = await Features_1.ScholarshipApplication.findOneAndUpdate({ scholarshipId: scholarship._id, studentId: me.studentId }, {
        $setOnInsert: {
            scholarshipId: scholarship._id, studentId: me.studentId, department: me.department,
            ...eligibility, supportingDocuments, status: 'submitted',
        }
    }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).lean();
    return res.status(existing ? 200 : 201).json(application);
}
async function reviewScholarshipApplication(req, res) {
    const user = actor(req);
    if (user.role !== 'admin' && user.role !== 'faculty')
        return forbidden(res);
    const statusSchema = {
        safeParse(value) {
            if (!isObject(value) || !['under_review', 'approved', 'rejected'].includes(value.status) || ('note' in value && (typeof value.note !== 'string' || value.note.length > 1000)))
                return { success: false, error: { flatten: () => ({ fieldErrors: { status: ['Invalid review input'] } }) } };
            return { success: true, data: { status: value.status, note: value.note } };
        }
    };
    const input = validated(statusSchema, req.body, res);
    if (!input)
        return;
    const scholarshipId = routeParam(req.params.id), applicationId = routeParam(req.params.applicationId);
    if (!/^[a-f\d]{24}$/i.test(scholarshipId) || !/^[a-f\d]{24}$/i.test(applicationId))
        return res.status(400).json({ error: 'Invalid id' });
    const application = await Features_1.ScholarshipApplication.findOne({ _id: applicationId, scholarshipId });
    if (!application)
        return res.status(404).json({ error: 'Application not found' });
    if (user.role === 'faculty' && user.department !== application.department)
        return forbidden(res);
    application.status = input.status;
    application.reviewNote = input.note;
    application.reviewerUserId = user.id;
    application.reviewedAt = new Date();
    await application.save();
    return res.json(application);
}
async function listCourses(req, res) {
    const filter = {};
    if (typeof req.query.department === 'string' && req.query.department)
        filter.department = req.query.department;
    const items = await Features_1.Course.find(filter).sort({ department: 1, code: 1 }).limit(500).lean();
    return res.json({ items });
}
async function createCourse(req, res) {
    const user = actor(req);
    if (user.role !== 'admin' && user.role !== 'faculty')
        return forbidden(res);
    const input = validated(features_1.courseInput, req.body, res);
    if (!input)
        return;
    if (user.role === 'faculty' && input.department !== user.department)
        return forbidden(res);
    const course = await Features_1.Course.create({ ...input, code: input.code.toUpperCase() });
    return res.status(201).json(course);
}
async function courseRecommendations(req, res) {
    const input = validated(features_1.recommendationInput, req.body, res);
    if (!input)
        return;
    const user = actor(req);
    const studentId = user.role === 'student' ? user.studentId : input.studentId;
    if (!studentId)
        return res.status(400).json({ error: 'studentId is required' });
    const me = await studentInScope(req, res, studentId);
    if (!me)
        return res.status(404).json({ error: 'Student record not found' });
    const academic = source(me, 'academic');
    const history = sourceList(me, 'academic').filter(item => isObject(item));
    const explicit = Array.isArray(academic?.completedCourses) ? academic.completedCourses : Array.isArray(academic?.courses) ? academic.courses : [];
    const prerequisiteEvidenceAvailable = explicit.length > 0 || history.length > 0;
    const completed = new Set();
    for (const item of explicit) {
        if (typeof item === 'string')
            completed.add(item.toUpperCase());
        else if (isObject(item) && (item.completed === true || ['completed', 'passed'].includes(String(item.status || '').toLowerCase()))) {
            const code = item.courseCode || item.code;
            if (typeof code === 'string')
                completed.add(code.toUpperCase());
        }
    }
    for (const item of history) {
        if (item.completed === true || ['completed', 'passed'].includes(String(item.status || '').toLowerCase())) {
            const code = item.courseCode || item.code;
            if (typeof code === 'string')
                completed.add(code.toUpperCase());
        }
    }
    const courses = await Features_1.Course.find({ department: me.department }).sort({ code: 1 }).lean();
    const eligibleCourses = courses.filter(course => !completed.has(course.code.toUpperCase())).map(course => ({
        course,
        missingPrerequisites: course.prerequisites.filter((prerequisite) => !completed.has(prerequisite.toUpperCase())),
    }));
    const role = input.roleId ? await Features_1.RoleCatalog.findOne({ roleId: input.roleId, active: true }).lean() : null;
    if (input.roleId && (!role || (role.department && role.department !== me.department)))
        return res.status(404).json({ error: 'Role requirements not found' });
    const skillProfile = await Features_1.StudentSkillProfile.findOne({ studentId: me.studentId }).lean();
    const skillsSource = source(me, 'skills');
    const verifiedSkills = Array.isArray(skillsSource?.verifiedSkills) ? skillsSource.verifiedSkills : [];
    const skillEvidence = [...new Set([...verifiedSkills, ...(skillProfile?.selfReportedSkills || [])].map((item) => typeof item === 'string' ? item : item?.skill || item?.name).filter((name) => typeof name === 'string'))];
    const skillGaps = role ? role.requiredSkills.filter((required) => !skillEvidence.some(skill => skill.toLowerCase() === required.toLowerCase())) : [];
    const analysis = await (0, featureAnalysis_1.analyzeCourses)({
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
function semesterMetrics(student) {
    const academic = source(student, 'academic');
    const raw = Array.isArray(academic?.semesters) ? academic.semesters : sourceList(student, 'academic').filter(item => isObject(item) && item.semester !== undefined);
    const result = [];
    for (const record of raw) {
        if (!isObject(record))
            continue;
        const semester = String(record.semester ?? record.term ?? '').trim();
        if (!semester)
            continue;
        for (const [metric, value] of Object.entries(record)) {
            if (['semester', 'term', 'studentId', 'student_id', 'synthetic'].includes(metric))
                continue;
            const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
            if (Number.isFinite(number))
                result.push({ semester, metric, value: number });
        }
    }
    return result;
}
async function performanceComparison(req, res) {
    const user = actor(req);
    if (!['student', 'faculty', 'admin'].includes(user.role))
        return forbidden(res);
    let filter = {};
    if (user.role === 'student') {
        if (!user.studentId)
            return forbidden(res);
        filter.studentId = user.studentId;
    }
    else
        filter = studentDepartmentFilter(user, req.query);
    const students = await Student_1.Student.find(filter).select('studentId department sources').limit(1000).lean();
    const records = students.flatMap(student => semesterMetrics(student)
        .filter(row => typeof req.query.semester !== 'string' || row.semester === req.query.semester)
        .filter(row => typeof req.query.metric !== 'string' || row.metric === req.query.metric)
        .map(row => ({ ...row, department: student.department })));
    const groups = new Map();
    for (const record of records) {
        const key = `${record.department}\u0000${record.semester}\u0000${record.metric}`;
        const group = groups.get(key) || { department: record.department, semester: record.semester, metric: record.metric, sum: 0, count: 0 };
        group.sum += record.value;
        group.count++;
        groups.set(key, group);
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
