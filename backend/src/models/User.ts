import mongoose, { Schema } from 'mongoose';

export type Role = 'admin' | 'faculty' | 'student';

const userSchema = new Schema({
                email: { type: String, required: true, unique: true, lowercase: true },
                passwordHash: { type: String, required: true },
                role: { type: String, enum: ['admin', 'faculty', 'student'], required: true },
                department: String,
                studentId: String,
                active: { type: Boolean, default: true },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
