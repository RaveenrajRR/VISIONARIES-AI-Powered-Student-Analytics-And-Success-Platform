"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.health = health;
exports.segments = segments;
exports.riskSummary = riskSummary;
exports.placementSummary = placementSummary;
const Student_1 = require("../models/Student");
const aiClient_1 = require("../services/aiClient");
const studentService_1 = require("../services/studentService");
async function mapConcurrent(items, limit, worker) {
    const output = new Array(items.length);
    let next = 0;
    async function run() {
        while (next < items.length) {
            const index = next++;
            output[index] = await worker(items[index]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return output;
}
async function health(_req, res) {
    const service = await (0, aiClient_1.aiHealth)();
    res.json({ status: 'ok', service: service.service, mode: service.mode, weights: service.weights, thresholds: service.thresholds });
}
async function segments(req, res) {
    const filter = (0, studentService_1.visibleStudentFilter)(req.user, req.query);
    const students = await Student_1.Student.find(filter).sort({ studentId: 1 }).limit(1000).lean();
    const results = await mapConcurrent(students, 12, async (student) => {
        const result = await (0, studentService_1.studentAnalytics)(student, 'segment');
        return {
            studentId: student.studentId,
            displayName: student.displayName,
            department: student.department,
            segment: result.segment,
            evidence: result.segment_evidence,
            recommendedAction: result.recommended_action,
        };
    });
    const counts = results.reduce((all, item) => {
        all[item.segment] = (all[item.segment] || 0) + 1;
        return all;
    }, {});
    const selected = typeof req.query.segment === 'string' ? results.filter(item => item.segment === req.query.segment) : results;
    res.json({ total: results.length, counts, items: selected });
}
async function riskSummary(req, res) {
    const students = await Student_1.Student.find((0, studentService_1.visibleStudentFilter)(req.user, req.query)).sort({ studentId: 1 }).limit(1000).lean();
    const results = await mapConcurrent(students, 12, async (student) => {
        const risk = await (0, studentService_1.studentAnalytics)(student, 'risk');
        return {
            studentId: student.studentId,
            displayName: student.displayName,
            department: student.department,
            academicRisk: risk.academic_risk,
            academicRiskLevel: risk.academic_risk_level,
            academicReasons: risk.academic_reasons,
            placementRisk: risk.placement_risk,
            placementRiskLevel: risk.placement_risk_level,
            placementReasons: risk.placement_reasons,
        };
    });
    const selectedType = typeof req.query.type === 'string' ? req.query.type : 'all';
    if (!['all', 'academic', 'placement'].includes(selectedType))
        return res.status(400).json({ error: 'type must be all, academic, or placement' });
    const items = selectedType === 'academic' ? results.filter(item => item.academicRisk) : selectedType === 'placement' ? results.filter(item => item.placementRisk) : results;
    res.json({
        total: results.length,
        academicRiskCount: results.filter(item => item.academicRisk).length,
        placementRiskCount: results.filter(item => item.placementRisk).length,
        items,
    });
}
async function placementSummary(req, res) {
    const students = await Student_1.Student.find((0, studentService_1.visibleStudentFilter)(req.user, req.query)).sort({ studentId: 1 }).limit(1000).lean();
    const results = await mapConcurrent(students, 12, async (student) => {
        const placement = await (0, studentService_1.studentAnalytics)(student, 'placement');
        return {
            studentId: student.studentId,
            displayName: student.displayName,
            department: student.department,
            readinessPct: placement.readiness_pct,
            coveragePct: placement.coverage_pct,
            skillGaps: placement.skill_gaps,
            practicePlan: placement.practice_plan,
        };
    });
    const scores = results.map(item => item.readinessPct).filter((value) => typeof value === 'number');
    res.json({
        total: results.length,
        observedCount: scores.length,
        averageReadinessPct: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length * 10) / 10 : null,
        items: results,
    });
}
