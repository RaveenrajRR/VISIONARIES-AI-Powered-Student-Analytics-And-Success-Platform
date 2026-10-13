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
exports.ImportRecord = exports.AuditLog = exports.Intervention = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.Intervention = mongoose_1.default.model('Intervention', new mongoose_1.Schema({
    studentId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    type: String,
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    evidence: String,
    rationale: String,
    expectedOutcome: String,
    status: { type: String, enum: ['open', 'in_progress', 'completed'], default: 'open' },
    followUpDate: Date,
    notes: String,
    createdBy: String,
    department: String,
}, { timestamps: true }));
exports.AuditLog = mongoose_1.default.model('AuditLog', new mongoose_1.Schema({
    actor: String,
    action: String,
    target: String,
    metadata: mongoose_1.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now },
}));
exports.ImportRecord = mongoose_1.default.model('ImportRecord', new mongoose_1.Schema({
    source: String,
    status: String,
    rows: Number,
    errors: [mongoose_1.Schema.Types.Mixed],
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
}, { suppressReservedKeysWarning: true }));
