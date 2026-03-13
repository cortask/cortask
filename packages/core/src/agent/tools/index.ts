import type { ToolHandler } from "../types.js";
import { readFileTool } from "./read-file.js";
import { writeFileTool } from "./write-file.js";
import { listFilesTool } from "./list-files.js";
import { bashTool } from "./bash.js";
import { webFetchTool } from "./web-fetch.js";
import { webSearchTool } from "./web-search.js";
import { questionnaireTool } from "./questionnaire.js";
import { memoryReadTool, memorySaveTool, memoryAppendTool } from "./memory.js";
import { showFileTool } from "./show-file.js";
import { dataFileTool } from "./data-file.js";

export const builtinTools: ToolHandler[] = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  bashTool,
  webFetchTool,
  webSearchTool,

  questionnaireTool,
  memoryReadTool,
  memorySaveTool,
  memoryAppendTool,
  showFileTool,
  dataFileTool,
];

export {
  readFileTool,
  writeFileTool,
  listFilesTool,
  bashTool,
  webFetchTool,
  webSearchTool,

  questionnaireTool,
  memoryReadTool,
  memorySaveTool,
  memoryAppendTool,
  showFileTool,
  dataFileTool,
};

export { createCronTool } from "./cron.js";
export { createArtifactTool } from "./artifact.js";
export { createBrowserTool } from "./browser.js";
export { createSubagentTool, setSubagentRunner } from "./subagent.js";
export { createSwitchWorkspaceTool } from "./switch-workspace.js";
