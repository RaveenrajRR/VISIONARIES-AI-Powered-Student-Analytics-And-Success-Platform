"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRoles = listRoles;
exports.createRole = createRole;
exports.skillProfile = skillProfile;
exports.skillGap = skillGap;
exports.careerPaths = careerPaths;
exports.analyzeStudentResume = analyzeStudentResume;
exports.listResumes = listResumes;
exports.feedbackSentiment = feedbackSentiment;
exports.certificateStatus = certificateStatus;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const Student_1 = require("../models/Student");
const Features_1 = require("../models/Features");
const features_1 = require("../validators/features");
const featureAnalysis_1 = require("../services/featureAnalysis");
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const asList = (value) => Array.isArray(value) ? value : [];
const privateDir = (kind) => path_1.default.resolve(__dirname, '..', '..', 'private-files', kind);
function input(schema, body, res) {
    const result = schema.safeParse(body);
    if (!result.success) {
        res.status(400).json({ error: result.error.flatten() });
        return undefined;
    }
    return result.data;
}
async function studentInScope(req, res, id) {
    const user = req.user;
    const studentId = user.role === 'student' ? user.studentId : id;
    if (!studentId) {
        res.status(400).json({ error: 'studentId is required for this role' });
        return null;
    }
    const student = await Student_1.Student.findOne({ studentId }).lean();
    if (!student) {
        res.status(404).json({ error: 'Student record not found' });
        return null;
    }
    if (user.role === 'student' && student.studentId !== user.studentId) {
        res.status(403).json({ error: 'You can only access your own record' });
        return null;
    }
    if (user.role === 'faculty' && student.department !== user.department) {
        res.status(403).json({ error: 'Student is outside your department' });
        return null;
    }
    if (!['student', 'faculty', 'admin'].includes(user.role)) {
        res.status(403).json({ error: 'Forbidden' });
        return null;
    }
    return student;
}
function skillSource(student) {
    let source = student.sources?.skills;
    if (source instanceof Map)
        source = Object.fromEntries(source);
    return object(source);
}
function observedSkills(student) {
    const source = skillSource(student);
    const verified = [...asList(source.verifiedSkills), ...asList(source.skills).filter(item => item && typeof item === 'object' && item.verified === true)];
    return [...new Set(verified.map(item => typeof item === 'string' ? item : item?.skill || item?.name).filter((name) => typeof name === 'string' && name.trim().length > 0).map(name => name.trim()))];
}
async function evidenceFor(student) {
    const profile = await Features_1.StudentSkillProfile.findOne({ studentId: student.studentId }).lean();
    return { observed: observedSkills(student), reported: profile?.selfReportedSkills || [], interests: profile?.interests || [] };
}
async function listRoles(req, res) {
    const filter = { active: true };
    if (req.user?.role === 'faculty')
        filter.department = req.user.department || '__no_department_assigned__';
    else if (typeof req.query.department === 'string' && req.query.department)
        filter.department = req.query.department;
    return res.json({ items: await Features_1.RoleCatalog.find(filter).sort({ title: 1 }).limit(300).lean() });
}
async function createRole(req, res) {
    const user = req.user;
    if (user.role !== 'admin' && user.role !== 'faculty')
        return res.status(403).json({ error: 'Forbidden' });
    const data = input(features_1.roleInput, req.body, res);
    if (!data)
        return;
    if (user.role === 'faculty' && data.department !== user.department)
        return res.status(403).json({ error: 'Role department must match your department' });
    const existing = await Features_1.RoleCatalog.exists({ roleId: data.roleId });
    if (existing)
        return res.status(409).json({ error: 'Role ID already exists' });
    return res.status(201).json(await Features_1.RoleCatalog.create(data));
}
async function skillProfile(req, res) {
    if (req.user?.role !== 'student' || !req.user.studentId)
        return res.status(403).json({ error: 'Student role required' });
    if (req.method === 'GET')
        return res.json(await Features_1.StudentSkillProfile.findOne({ studentId: req.user.studentId }).lean() || { studentId: req.user.studentId, selfReportedSkills: [], interests: [] });
    const data = input(features_1.studentSkillProfileInput, req.body, res);
    if (!data)
        return;
    return res.json(await Features_1.StudentSkillProfile.findOneAndUpdate({ studentId: req.user.studentId }, { $set: data }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).lean());
}
async function skillGap(req, res) {
    const query = zod_1.z.object({ roleId: zod_1.z.string().trim().min(1).max(100), studentId: zod_1.z.string().trim().min(1).max(100).optional() }).safeParse(req.query);
    if (!query.success)
        return res.status(400).json({ error: query.error.flatten() });
    const student = await studentInScope(req, res, query.data.studentId);
    if (!student)
        return;
    const role = await Features_1.RoleCatalog.findOne({ roleId: query.data.roleId, active: true }).lean();
    if (!role)
        return res.status(404).json({ error: 'Role requirements not found' });
    if (role.department && role.department !== student.department)
        return res.status(404).json({ error: 'Role requirements not found' });
    const evidence = await evidenceFor(student);
    const result = await (0, featureAnalysis_1.analyzeSkillGap)({ role_name: role.title, required_skills: role.requiredSkills.map(skill => ({ skill, weight: 1 })), observed_skills: evidence.observed, self_reported_skills: evidence.reported });
    return res.json({ studentId: student.studentId, role, ...result, milestones: role.milestones });
}
async function careerPaths(req, res) {
    const query = zod_1.z.object({ studentId: zod_1.z.string().trim().min(1).max(100).optional() }).safeParse(req.query);
    if (!query.success)
        return res.status(400).json({ error: query.error.flatten() });
    const student = await studentInScope(req, res, query.data.studentId);
    if (!student)
        return;
    const [roles, evidence] = await Promise.all([
        Features_1.RoleCatalog.find({ active: true, $or: [{ department: student.department }, { department: { $exists: false } }] }).sort({ title: 1 }).limit(100).lean(),
        evidenceFor(student),
    ]);
    const result = await (0, featureAnalysis_1.analyzeCareers)({
        role_catalog: roles.map(role => ({ role_id: role.roleId, title: role.title, required_skills: role.requiredSkills, interests: role.interests })),
        observed_skills: evidence.observed, self_reported_skills: evidence.reported, interests: evidence.interests,
    });
    return res.json({ studentId: student.studentId, suggestions: result.suggestions.map(suggestion => ({ ...suggestion, milestones: roles.find(role => role.roleId === suggestion.role_id)?.milestones || [] })), evaluated_role_count: result.evaluated_role_count, method: result.method, disclaimer: result.disclaimer });
}
async function analyzeStudentResume(req, res) {
    if (req.user?.role !== 'student' || !req.user.studentId)
        return res.status(403).json({ error: 'Resume uploads are available only to the student account owner' });
    const data = input(features_1.resumeAnalysisInput, req.body, res);
    if (!data)
        return;
    const student = await Student_1.Student.findOne({ studentId: req.user.studentId }).lean();
    if (!student)
        return res.status(404).json({ error: 'Student record not found' });
    const role = await Features_1.RoleCatalog.findOne({ roleId: data.roleId, active: true }).lean();
    if (!role)
        return res.status(404).json({ error: 'Role requirements not found' });
    if (role.department && role.department !== student.department)
        return res.status(404).json({ error: 'Role requirements not found' });
    let bytes;
    try {
        bytes = Buffer.from(data.contentBase64, 'base64');
    }
    catch {
        return res.status(400).json({ error: 'Invalid base64 file content' });
    }
    if (!bytes.length || bytes.length > 3 * 1024 * 1024)
        return res.status(413).json({ error: 'Resume must be no larger than 3 MiB' });
    const isPdf = data.contentType === 'application/pdf' && bytes.subarray(0, 5).toString('ascii') === '%PDF-';
    const isDocx = data.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    if (!isPdf && !isDocx)
        return res.status(400).json({ error: 'File content does not match the declared PDF or DOCX type' });
    const extracted = await (0, featureAnalysis_1.extractResume)({ content_type: data.contentType, content_base64: data.contentBase64 });
    if (!extracted.extracted_text.trim())
        return res.status(422).json({ error: extracted.warning });
    const analysis = await (0, featureAnalysis_1.analyzeResume)({ resume_text: extracted.extracted_text, job_description: data.jobDescription, required_skills: role.requiredSkills });
    const safeName = data.fileName.replace(/[\\/\r\n\0]/g, '_').slice(0, 255);
    const storageName = `${(0, crypto_1.randomUUID)()}.${isPdf ? 'pdf' : 'docx'}`;
    const directory = privateDir('resumes');
    await (0, promises_1.mkdir)(directory, { recursive: true, mode: 0o700 });
    const storagePath = path_1.default.join(directory, storageName);
    await (0, promises_1.writeFile)(storagePath, bytes, { flag: 'wx', mode: 0o600 });
    try {
        const record = await Features_1.ResumeDocument.create({ studentId: student.studentId, department: student.department, roleId: role.roleId, originalFileName: safeName, contentType: data.contentType, size: bytes.length, storageName, analysis });
        return res.status(201).json({ resumeId: String(record._id), fileName: safeName, roleTitle: role.title, analysis, extraction: { method: extracted.method, warning: extracted.warning } });
    }
    catch (error) {
        await (0, promises_1.unlink)(storagePath).catch(() => undefined);
        throw error;
    }
}
async function listResumes(req, res) {
    if (req.user?.role !== 'student' || !req.user.studentId)
        return res.status(403).json({ error: 'Student role required' });
    const items = await Features_1.ResumeDocument.find({ studentId: req.user.studentId }).select('-analysis -storageName').sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ items });
}
async function feedbackSentiment(req, res) {
    const user = req.user;
    if (user.role !== 'admin' && user.role !== 'faculty')
        return res.status(403).json({ error: 'Aggregate feedback is limited to faculty and administrators' });
    const filter = {};
    if (user.role === 'faculty')
        filter.department = user.department || '__no_department_assigned__';
    else if (typeof req.query.department === 'string' && req.query.department)
        filter.department = req.query.department;
    const students = await Student_1.Student.find(filter).select('sources').limit(2000).lean();
    const comments = [];
    for (const student of students) {
        let feedback = student.sources?.feedback;
        if (feedback instanceof Map)
            feedback = Object.fromEntries(feedback);
        const data = object(feedback);
        const values = [...asList(data.comments), ...asList(data.responses), ...asList(data.text_feedback), ...asList(data.feedback)];
        for (const value of values) {
            const text = typeof value === 'string' ? value : typeof value?.comment === 'string' ? value.comment : typeof value?.text === 'string' ? value.text : undefined;
            if (text?.trim())
                comments.push(text.trim().slice(0, 2000));
        }
    }
    if (comments.length < 5)
        return res.json({ sample_size: null, suppressed: true, sentiment_counts: null, topic_trends: [], note: 'Aggregate output is suppressed below five text responses. No raw feedback or exact sample count is returned.' });
    return res.json({ ...(await (0, featureAnalysis_1.analyzeFeedback)({ feedback: comments.slice(0, 500) })), suppressed: false });
}
async function certificateStatus(req, res) {
    const user = req.user;
    if (user.role !== 'student' || !user.studentId)
        return res.status(403).json({ error: 'Student role required' });
    const certificates = await Features_1.Certificate.find({ studentId: user.studentId }).select('title reviewStatus').lean();
    return res.json({ certificates: certificates.map(item => ({ title: item.title, status: item.reviewStatus })) });
}
