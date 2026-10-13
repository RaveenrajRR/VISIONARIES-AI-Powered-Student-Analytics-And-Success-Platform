"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.me = me;
exports.listStudents = listStudents;
exports.getStudent = getStudent;
exports.analytics = analytics;
exports.overview = overview;
exports.createIntervention = createIntervention;
exports.listInterventions = listInterventions;
exports.updateIntervention = updateIntervention;
exports.previewImport = previewImport;
exports.commitImport = commitImport;
exports.importReport = importReport;
exports.exportStudents = exportStudents;
exports.auditLogs = auditLogs;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const User_1 = require("../models/User");
const Student_1 = require("../models/Student");
const Intervention_1 = require("../models/Intervention");
const studentService_1 = require("../services/studentService");
async function login(req, res) {
    const parsed = zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string().min(1) }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Valid email and password required' });
    const u = await User_1.User.findOne({ email: parsed.data.email.toLowerCase(), active: true });
    if (!u || !await bcryptjs_1.default.compare(parsed.data.password, u.passwordHash))
        return res.status(401).json({ error: 'Invalid credentials' });
    if (process.env.DEMO_MODE === 'true' ? !u.demo : Boolean(u.demo))
        return res.status(401).json({ error: 'Invalid credentials' });
    if (!process.env.JWT_SECRET)
        return res.status(500).json({ error: 'JWT_SECRET not configured' });
    const token = jsonwebtoken_1.default.sign({ sub: String(u._id) }, process.env.JWT_SECRET, { expiresIn: '8h' });
    await Intervention_1.AuditLog.create({ actor: u.email, action: 'login', target: String(u._id) });
    return res.json({ token, user: { email: u.email, role: u.role, department: u.department, studentId: u.studentId, demo: Boolean(u.demo) } });
}
async function me(req, res) { res.json({ user: req.user }); }
async function listStudents(req, res) { const filter = (0, studentService_1.visibleStudentFilter)(req.user, req.query); const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20)); const [items, total] = await Promise.all([Student_1.Student.find(filter).sort({ studentId: 1 }).skip((page - 1) * limit).limit(limit).lean(), Student_1.Student.countDocuments(filter)]); res.json({ items, total, page, limit, pages: Math.ceil(total / limit) }); }
async function getStudent(req, res) { const s = await Student_1.Student.findOne({ studentId: req.params.id }).lean(); if (!s)
    return res.status(404).json({ error: 'Student not found' }); if (req.user?.role === 'student' && req.user.studentId !== s.studentId)
    return res.status(403).json({ error: 'You can only access your own profile' }); if (req.user?.role === 'faculty' && req.user.department !== s.department)
    return res.status(403).json({ error: 'Student is outside your department' }); res.json(s); }
async function analytics(req, res) { const s = await Student_1.Student.findOne({ studentId: req.params.id }); if (!s)
    return res.status(404).json({ error: 'Student not found' }); if (req.user?.role === 'student' && req.user.studentId !== s.studentId)
    return res.status(403).json({ error: 'Forbidden' }); if (req.user?.role === 'faculty' && req.user.department !== s.department)
    return res.status(403).json({ error: 'Forbidden' }); const kind = String(req.params.kind); if (!['score', 'risks', 'explanations', 'recommendations', 'segment', 'placement'].includes(kind))
    return res.status(400).json({ error: 'Unknown analytics type' }); const endpoint = kind === 'risks' ? 'risk' : kind === 'placement' ? 'placement' : kind === 'segment' ? 'segment' : kind; res.json(await (0, studentService_1.studentAnalytics)(s, endpoint)); }
async function overview(req, res) { const f = (0, studentService_1.visibleStudentFilter)(req.user, req.query); const interventionFilter = { status: { $ne: 'completed' } }; if (req.user?.role === 'faculty')
    interventionFilter.department = req.user.department || '__no_department_assigned__'; if (req.user?.role === 'student')
    interventionFilter.studentId = req.user.studentId; const [count, students, interventions] = await Promise.all([Student_1.Student.countDocuments(f), Student_1.Student.find(f).limit(1000).lean(), Intervention_1.Intervention.countDocuments(interventionFilter)]); res.json({ studentCount: count, interventionOpen: interventions, studentsLoaded: students.length, syntheticOnly: students.every(s => s.synthetic), note: 'Scores are computed through the AI service per student; no dashboard statistics are hardcoded.' }); }
async function createIntervention(req, res) { const p = zod_1.z.object({ studentId: zod_1.z.string().min(1).max(100), title: zod_1.z.string().min(2).max(200), type: zod_1.z.string().max(100).optional(), priority: zod_1.z.enum(['low', 'medium', 'high']).default('medium'), evidence: zod_1.z.string().max(2000).optional(), rationale: zod_1.z.string().max(2000).optional(), expectedOutcome: zod_1.z.string().max(1000).optional(), followUpDate: zod_1.z.string().datetime().optional(), notes: zod_1.z.string().max(4000).optional() }).safeParse(req.body); if (!p.success)
    return res.status(400).json({ error: p.error.flatten() }); const s = await Student_1.Student.findOne({ studentId: p.data.studentId }); if (!s)
    return res.status(404).json({ error: 'Student not found' }); if (req.user?.role === 'faculty' && req.user.department !== s.department)
    return res.status(403).json({ error: 'Forbidden' }); const i = await Intervention_1.Intervention.create({ ...p.data, followUpDate: p.data.followUpDate ? new Date(p.data.followUpDate) : undefined, createdBy: req.user?.email, department: s.department }); await Intervention_1.AuditLog.create({ actor: req.user?.email, action: 'intervention.create', target: String(i._id) }); res.status(201).json(i); }
async function listInterventions(req, res) { const filter = {}; if (req.user?.role === 'faculty')
    filter.department = req.user.department || '__no_department_assigned__'; if (req.user?.role === 'student')
    filter.studentId = req.user.studentId; if (req.query.status)
    filter.status = req.query.status; res.json(await Intervention_1.Intervention.find(filter).sort({ createdAt: -1 }).limit(500).lean()); }
async function updateIntervention(req, res) { const p = zod_1.z.object({ status: zod_1.z.enum(['open', 'in_progress', 'completed']).optional(), notes: zod_1.z.string().max(4000).optional(), followUpDate: zod_1.z.string().datetime().optional() }).strict().safeParse(req.body); if (!p.success)
    return res.status(400).json({ error: p.error.flatten() }); const i = await Intervention_1.Intervention.findById(req.params.id); if (!i)
    return res.status(404).json({ error: 'Intervention not found' }); if (req.user?.role === 'faculty' && req.user.department !== i.department)
    return res.status(403).json({ error: 'Forbidden' }); Object.assign(i, p.data); if (p.data.followUpDate)
    i.followUpDate = new Date(p.data.followUpDate); await i.save(); await Intervention_1.AuditLog.create({ actor: req.user?.email, action: 'intervention.update', target: String(i._id) }); res.json(i); }
async function previewImport(req, res) { const { source, rows } = req.body || {}; if (!['students', 'academic', 'attendance', 'lms', 'engagement', 'placement', 'skills', 'feedback'].includes(source) || !Array.isArray(rows) || rows.length > 10000)
    return res.status(400).json({ error: 'A valid source and rows[] (up to 10000 rows) are required' }); const ids = rows.map((r) => String(r.student_id || '')); const existing = await Student_1.Student.find({ studentId: { $in: ids } }).select('studentId').lean(); const seen = new Set(); const errors = []; rows.forEach((r, index) => { if (!r.student_id)
    errors.push({ row: index + 1, error: 'student_id is required' }); if (seen.has(String(r.student_id)))
    errors.push({ row: index + 1, error: 'Duplicate student_id in upload' }); seen.add(String(r.student_id)); }); res.json({ source, rowCount: rows.length, existingStudentIds: existing.map(x => x.studentId), errors, validRows: rows.length - errors.length, preview: rows.slice(0, 10) }); }
async function commitImport(req, res) { if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Admin only' }); const { source, rows } = req.body || {}; if (!['students', 'academic', 'attendance', 'lms', 'engagement', 'placement', 'skills', 'feedback'].includes(source) || !Array.isArray(rows) || rows.length > 10000)
    return res.status(400).json({ error: 'A valid source and rows[] (up to 10000 rows) are required' }); const errors = []; let imported = 0; for (let n = 0; n < rows.length; n++) {
    const r = rows[n];
    try {
        const sid = String(r.student_id || '');
        if (!sid)
            throw new Error('student_id required');
        if (source === 'students') {
            await Student_1.Student.updateOne({ studentId: sid }, { $set: { studentId: sid, synthetic: String(r.synthetic) !== 'false', displayName: r.display_name || `Synthetic ${sid}`, department: r.department || 'Unassigned', year: Number(r.year) || 1, email: r.email || `${sid.toLowerCase()}@example.invalid`, status: r.status || 'active' } }, { upsert: true });
        }
        else {
            const s = await Student_1.Student.findOne({ studentId: sid });
            if (!s)
                throw new Error('Unknown student_id; import students.csv first');
            s.sources.set(source, Object.fromEntries(Object.entries(r).filter(([k]) => !['student_id', 'synthetic'].includes(k))));
            s.sourceMetadata.set(source, { importedAt: new Date().toISOString() });
            await s.save();
            await Student_1.SourceRecord.updateOne({ studentId: sid, sourceFile: source }, { $set: { studentId: sid, synthetic: String(r.synthetic) !== 'false', data: r, sourceFile: source } }, { upsert: true });
        }
        imported++;
    }
    catch (e) {
        errors.push({ row: n + 1, student_id: r?.student_id, error: e.message });
    }
} const report = await Intervention_1.ImportRecord.create({ source, status: errors.length ? 'completed_with_errors' : 'completed', rows: imported, errors, createdBy: req.user?.email }); await Intervention_1.AuditLog.create({ actor: req.user?.email, action: 'import.commit', target: String(report._id), metadata: { source, imported, errorCount: errors.length } }); res.status(201).json({ importId: String(report._id), source, received: rows.length, imported, errorCount: errors.length, errors }); }
async function importReport(req, res) { const r = await Intervention_1.ImportRecord.findById(req.params.id).lean(); if (!r)
    return res.status(404).json({ error: 'Import report not found' }); res.json(r); }
async function exportStudents(req, res) { const items = await Student_1.Student.find((0, studentService_1.visibleStudentFilter)(req.user, req.query)).lean(); const cols = ['studentId', 'displayName', 'department', 'year', 'status', 'synthetic']; const csv = [cols.join(','), ...items.map(s => cols.map(k => JSON.stringify(s[k] ?? '')).join(','))].join('\n'); res.setHeader('content-type', 'text/csv'); res.setHeader('content-disposition', 'attachment; filename="eduai-authorized-students.csv"'); res.send(csv); }
async function auditLogs(req, res) { if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Admin only' }); res.json(await Intervention_1.AuditLog.find().sort({ createdAt: -1 }).limit(500).lean()); }
