"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = auth;
exports.allow = allow;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
async function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Authentication required' });
    const secret = process.env.JWT_SECRET;
    if (!secret)
        return res.status(500).json({ error: 'JWT_SECRET is not configured' });
    let subject;
    try {
        const payload = jsonwebtoken_1.default.verify(header.slice(7), secret);
        if (typeof payload === 'string' || typeof payload.sub !== 'string')
            return res.status(401).json({ error: 'Invalid or expired token' });
        subject = payload.sub;
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    try {
        const user = await User_1.User.findById(subject);
        if (!user || !user.active)
            return res.status(401).json({ error: 'Invalid account' });
        if (user.demo && process.env.DEMO_MODE !== 'true')
            return res.status(401).json({ error: 'Demo mode is disabled' });
        req.user = {
            id: String(user._id),
            role: user.role,
            department: user.department ?? undefined,
            studentId: user.studentId ?? undefined,
            email: user.email,
            demo: Boolean(user.demo),
        };
        if (user.demo && req.method !== 'GET' && req.method !== 'HEAD' && req.path !== '/api/auth/logout')
            return res.status(403).json({ error: 'Demo accounts are read-only' });
        return next();
    }
    catch (error) {
        return next(error);
    }
}
function allow(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role))
            return res.status(403).json({ error: 'Forbidden for this role' });
        return next();
    };
}
