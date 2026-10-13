
"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { default: mod };
};

Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;

const mongoose_1 = __importDefault(require("mongoose"));

async function connectDB(uri = process.env.MONGODB_URI) {
    if (!uri) {
        throw new Error(
            "MONGODB_URI is missing. Check your backend .env file."
        );
    }

    try {
        console.log("[MongoDB] Starting connection...");

        await mongoose_1.default.connect(uri, {
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            retryWrites: true,
        });

        console.log(
            JSON.stringify({
                level: "info",
                message: "MongoDB connected successfully",
                database: mongoose_1.default.connection.name,
                host: mongoose_1.default.connection.host,
            })
        );

        return mongoose_1.default.connection;
    } catch (error) {
        console.error("[MongoDB] Connection failed");
        console.error("Name:", error.name);
        console.error("Message:", error.message);

        // Show details for each server when available.
        const servers = error.reason?.servers;

        if (servers && typeof servers[Symbol.iterator] === "function") {
            for (const [address, server] of servers) {
                console.error(`[MongoDB] Server: ${address}`);
                console.error("  Type:", server.type);
                console.error(
                    "  Error:",
                    server.error?.message || "No server-specific error"
                );
                console.error(
                    "  Round-trip time:",
                    server.roundTripTime ?? "Unavailable"
                );
            }
        }

        throw error;
    }
}
