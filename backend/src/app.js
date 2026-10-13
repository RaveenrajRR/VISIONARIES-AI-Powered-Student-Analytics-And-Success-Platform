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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const morgan_1 = __importDefault(require("morgan"));
const auth_1 = require("./middleware/auth");
const asyncRoute_1 = require("./middleware/asyncRoute");
const c = __importStar(require("./controllers/api"));
const ai = __importStar(require("./controllers/ai"));
const features_1 = require("./routes/features");
const aiClient_1 = require("./services/aiClient");
exports.app = (0, express_1.default)();
exports.app.use((0, helmet_1.default)());
exports.app.use((0, cors_1.default)({ origin: (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(','), credentials: false }));
exports.app.use(express_1.default.json({ limit: '5mb' }));
exports.app.use((0, morgan_1.default)('tiny'));
exports.app.use((0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
exports.app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'eduai-backend', database: 'connection status exposed through startup logs' }));
exports.app.post('/api/auth/login', (0, asyncRoute_1.asyncRoute)(c.login));
exports.app.post('/api/auth/logout', auth_1.auth, (_req, res) => res.json({ ok: true, note: 'JWT is stateless; client must discard token' }));
exports.app.get('/api/auth/me', auth_1.auth, (0, asyncRoute_1.asyncRoute)(c.me));
exports.app.get('/api/ai/health', auth_1.auth, (0, asyncRoute_1.asyncRoute)(ai.health));
exports.app.get('/api/dashboard/overview', auth_1.auth, (0, asyncRoute_1.asyncRoute)(c.overview));
exports.app.get('/api/students', auth_1.auth, (0, asyncRoute_1.asyncRoute)(c.listStudents));
exports.app.get('/api/students/:id', auth_1.auth, (0, asyncRoute_1.asyncRoute)(c.getStudent));
exports.app.get('/api/students/:id/:kind', auth_1.auth, (0, asyncRoute_1.asyncRoute)(c.analytics));
exports.app.get('/api/interventions', auth_1.auth, (0, asyncRoute_1.asyncRoute)(c.listInterventions));
exports.app.post('/api/interventions', auth_1.auth, (0, auth_1.allow)('admin', 'faculty'), (0, asyncRoute_1.asyncRoute)(c.createIntervention));
exports.app.patch('/api/interventions/:id', auth_1.auth, (0, auth_1.allow)('admin', 'faculty'), (0, asyncRoute_1.asyncRoute)(c.updateIntervention));
exports.app.post('/api/imports/preview', auth_1.auth, (0, auth_1.allow)('admin'), (0, asyncRoute_1.asyncRoute)(c.previewImport));
exports.app.post('/api/imports/commit', auth_1.auth, (0, auth_1.allow)('admin'), (0, asyncRoute_1.asyncRoute)(c.commitImport));
exports.app.get('/api/imports/:id/report', auth_1.auth, (0, auth_1.allow)('admin'), (0, asyncRoute_1.asyncRoute)(c.importReport));
exports.app.get('/api/reports/export', auth_1.auth, (0, asyncRoute_1.asyncRoute)(c.exportStudents));
exports.app.get('/api/audit-logs', auth_1.auth, (0, auth_1.allow)('admin'), (0, asyncRoute_1.asyncRoute)(c.auditLogs));
exports.app.get('/api/analytics/trends', auth_1.auth, (_req, res) => res.json({ items: [], note: 'Trend aggregation is available after importing source data; no fabricated values.' }));
exports.app.get('/api/analytics/segments', auth_1.auth, (0, auth_1.allow)('admin', 'faculty'), (0, asyncRoute_1.asyncRoute)(ai.segments));
exports.app.get('/api/analytics/risk-summary', auth_1.auth, (0, auth_1.allow)('admin', 'faculty'), (0, asyncRoute_1.asyncRoute)(ai.riskSummary));
exports.app.get('/api/analytics/placement-summary', auth_1.auth, (0, auth_1.allow)('admin', 'faculty'), (0, asyncRoute_1.asyncRoute)(ai.placementSummary));
exports.app.use('/api/features', features_1.featureRouter);
exports.app.use((err, _req, res, _next) => {
    const isAIError = err instanceof aiClient_1.AIServiceError;
    const status = isAIError ? err.statusCode : 500;
    const message = isAIError ? err.message : 'Internal server error';
    console.error(JSON.stringify({ level: 'error', message: err instanceof Error ? err.message : 'Unknown error' }));
    res.status(status).json({ error: message });
});
