import mongoose, { Schema } from 'mongoose';

const sourceSchema = new Schema({
                studentId: { type: String, required: true, index: true },
                synthetic: { type: Boolean, default: true },
                data: { type: Schema.Types.Mixed, required: true },
                sourceFile: String,
                importedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const Student = mongoose.model('Student', new Schema({
                studentId: { type: String, required: true, unique: true, index: true },
                synthetic: { type: Boolean, default: true },
                displayName: { type: String, required: true },
                department: { type: String, required: true },
                year: { type: Number, required: true },
                email: { type: String, required: true },
                status: { type: String, default: 'active' },
                sources: { type: Map, of: Schema.Types.Mixed, default: {} },
                sourceMetadata: { type: Map, of: Schema.Types.Mixed, default: {} },
}, { timestamps: true }));

export const SourceRecord = mongoose.model('SourceRecord', sourceSchema);
