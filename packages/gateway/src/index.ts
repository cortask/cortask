import { startServer as _startServer } from "./server.js";

export { startServer } from "./server.js";
export type { GatewayContext, AgentRunnerOptions } from "./server.js";

// When run directly, start the server
const isMainModule =
  typeof process !== "undefined" &&
  process.argv[1]?.endsWith("index.js");

if (isMainModule) {
  _startServer().catch((err: unknown) => {
    console.error("Failed to start gateway:", err);
    process.exit(1);
  });
}
