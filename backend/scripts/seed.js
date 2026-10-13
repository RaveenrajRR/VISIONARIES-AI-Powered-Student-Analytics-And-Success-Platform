"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("../src/config/env");
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../src/models/User");
async function main() { if (!process.env.MONGODB_URI)
    throw new Error('Set MONGODB_URI'); if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD; no default admin password exists'); await mongoose_1.default.connect(process.env.MONGODB_URI); const passwordHash = await bcryptjs_1.default.hash(process.env.ADMIN_PASSWORD, 12); await User_1.User.updateOne({ email: process.env.ADMIN_EMAIL.toLowerCase() }, { $set: { email: process.env.ADMIN_EMAIL.toLowerCase(), passwordHash, role: 'admin', active: true } }, { upsert: true }); console.log('Environment-configured admin account upserted.'); await mongoose_1.default.disconnect(); }
main().catch(e => { console.error(e.message); process.exit(1); });
