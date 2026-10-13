"use strict";
require("../src/config/env");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { User } = require("../src/models/User");
const { Student } = require("../src/models/Student");

const demoAccounts = [
    {
        email: "admin@eduanexus.demo",
        password: "AdminDemo@123",
        role: "admin",
    },
    {
        email: "student@eduanexus.demo",
        password: "StudentDemo@123",
        role: "student",
        studentId: "S0001",
    },
];

async function seedDemoAccounts() {
    if (process.env.DEMO_MODE !== "true")
        throw new Error("Refusing to seed public demo accounts unless DEMO_MODE=true.");
    if (!process.env.MONGODB_URI)
        throw new Error("MONGODB_URI is required.");
    if (!process.env.JWT_SECRET)
        throw new Error("JWT_SECRET is required.");

    await mongoose.connect(process.env.MONGODB_URI);
    try {
        const student = await Student.findOne({ studentId: "S0001" }).lean();
        if (!student)
            throw new Error("Synthetic student S0001 is missing; run npm run import:dataset first.");

        for (const account of demoAccounts) {
            const passwordHash = await bcrypt.hash(account.password, 12);
            await User.updateOne(
                { email: account.email },
                {
                    $set: {
                        email: account.email,
                        passwordHash,
                        role: account.role,
                        department: student.department,
                        studentId: account.studentId,
                        active: true,
                        demo: true,
                    },
                },
                { upsert: true },
            );
        }
        console.log("Read-only demo accounts are ready in the configured demo database.");
    } finally {
        await mongoose.disconnect();
    }
}

seedDemoAccounts().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
