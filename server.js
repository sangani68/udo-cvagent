// server.js - thin wrapper to run the Next standalone server in Azure

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This just re-uses the server that `next build` generates
const serverPath = path.join(__dirname, ".next", "standalone", "server.js");

// Dynamically import the standalone server
import(serverPath).catch((err) => {
  console.error("Failed to start Next standalone server:", err);
  process.exit(1);
});
