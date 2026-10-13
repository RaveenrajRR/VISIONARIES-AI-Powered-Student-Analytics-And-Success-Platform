
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

require("./config/env");

const dns = require("node:dns");

// Use public DNS resolvers for MongoDB SRV lookup.
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app_1 = require("./app");
const db_1 = require("./config/db");

const port = Number(process.env.PORT || 4000);

(0, db_1.connectDB)()
  .then(() => {
    console.log(
      JSON.stringify({
        level: "info",
        message: "MongoDB connected",
      })
    );

    app_1.app.listen(port, () => {
      console.log(`EduAI backend listening on ${port}`);
    });
  })
  .catch((error) => {
    console.error(
      JSON.stringify({
        level: "error",
        message: "MongoDB connection failed",
        detail: error.message,
      })
    );

    process.exit(1);
  });
