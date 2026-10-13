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
exports.SourceRecord = exports.Student = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const sourceSchema = new mongoose_1.Schema({
    studentId: { type: String, required: true, index: true },
    synthetic: { type: Boolean, default: true },
    data: { type: mongoose_1.Schema.Types.Mixed, required: true },
    sourceFile: String,
    importedAt: { type: Date, default: Date.now },
}, { timestamps: true });
exports.Student = mongoose_1.default.model('Student', new mongoose_1.Schema({
    studentId: { type: String, required: true, unique: true, index: true },
    synthetic: { type: Boolean, default: true },
    displayName: { type: String, required: true },
    department: { type: String, required: true },
    year: { type: Number, required: true },
    email: { type: String, required: true },
    status: { type: String, default: 'active' },
    sources: { type: Map, of: mongoose_1.Schema.Types.Mixed, default: {} },
    sourceMetadata: { type: Map, of: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true }));
exports.SourceRecord = mongoose_1.default.model('SourceRecord', sourceSchema);
