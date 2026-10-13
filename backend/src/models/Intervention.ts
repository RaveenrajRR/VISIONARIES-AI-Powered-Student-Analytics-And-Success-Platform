import mongoose, { Schema } from 'mongoose';

export const Intervention = mongoose.model('Intervention', new Schema({
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

export const AuditLog = mongoose.model('AuditLog', new Schema({
                actor: String,
                action: String,
                target: String,
                metadata: Schema.Types.Mixed,
                createdAt: { type: Date, default: Date.now },
}));

export const ImportRecord = mongoose.model('ImportRecord', new Schema({
                source: String,
                status: String,
                rows: Number,
                errors: [Schema.Types.Mixed],
                createdBy: String,
                createdAt: { type: Date, default: Date.now },
}, { suppressReservedKeysWarning: true }));
