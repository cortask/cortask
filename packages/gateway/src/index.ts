import { startServer as _startServer } from "./server.js";

export { startServer } from "./server.js";
export type { GatewayContext, AgentRunnerOptions } from "./server.js";

// When run directly (not imported by CLI), start the server
const entryScript = process.argv[1] ?? "";
const isMainModule =
  typeof process !== "undefined" &&
  (entryScript.includes("gateway") && entryScript.endsWith("index.js"));

if (isMainModule) {
  _startServer().catch((err: unknown) => {
    console.error("Failed to start gateway:", err);
    process.exit(1);
  });
}
