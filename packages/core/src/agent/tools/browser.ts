import type { ToolHandler, ToolExecutionContext } from "../types.js";
import type { ToolResult } from "../../providers/types.js";
import type { ArtifactStore } from "../../artifacts/store.js";
import { ensureBrowser, closeBrowser, resetBrowserInstance } from "./browser-manager.js";

const MAX_CONTENT = 50_000;

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "\n...(truncated)" : text;
}

export function createBrowserTool(artifactStore: ArtifactStore): ToolHandler {
  return {
    definition: {
      name: "browser",
      description:
        "Control a visible browser window using agent-browser. " +
        "Use 'navigate' to open a URL, then 'snapshot' to see interactive elements with refs (@e1, @e2...). " +
        "Use those refs with click, fill, type, select actions for reliable interaction. " +
        "The browser is visible to the user. Prefer web_fetch for simple content retrieval.",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "navigate",
              "snapshot",
              "screenshot",
              "click",
              "fill",
              "type",
              "select",
              "press",
              "evaluate",
              "get_text",
              "get_content",
              "wait",
              "back",
              "forward",
              "reload",
              "close",
            ],
            description:
              "navigate: go to URL. snapshot: get accessibility tree with element refs (@e1, @e2...). " +
              "screenshot: capture page. click: click element (use @eN ref or selector). " +
              "fill: clear and fill input. type: type into focused/selected element. " +
              "select: select dropdown option. press: press a key (Enter, Tab, etc). " +
              "evaluate: run JS. get_text: get text of element. get_content: get page title, URL and snapshot. " +
              "wait: wait for selector, text, or milliseconds. back/forward/reload: navigate history. close: close browser.",
          },
          url: {
            type: "string",
            description: "URL to navigate to (for navigate action)",
          },
          selector: {
            type: "string",
            description:
              "Element ref from snapshot (@e1, @e2...) or CSS selector (for click, fill, type, select, get_text actions)",
          },
          text: {
            type: "string",
            description: "Text to type/fill (for fill and type actions)",
          },
          value: {
            type: "string",
            description: "Value for select action",
          },
          key: {
            type: "string",
            description: "Key to press (for press action, e.g. Enter, Tab, Escape)",
          },
          script: {
            type: "string",
            description: "JavaScript to evaluate (for evaluate action)",
          },
          target: {
            type: "string",
            description:
              "Wait target: CSS selector, milliseconds, or URL pattern (for wait action)",
          },
        },
        required: ["action"],
      },
    },

    async execute(
      args: Record<string, unknown>,
      _context: ToolExecutionContext,
    ): Promise<ToolResult> {
      const action = args.action as string;

      if (action === "close") {
        await closeBrowser();
        return { toolCallId: "", content: "Browser closed." };
      }

      const executeAction = async (): Promise<ToolResult> => {
        const browser = await ensureBrowser();

        switch (action) {
          case "navigate": {
            const url = args.url as string;
            if (!url) {
              return {
                toolCallId: "",
                content: "url is required for navigate action",
                isError: true,
              };
            }
            const result = await browser.navigate(url);
            return {
              toolCallId: "",
              content: truncate(
                `Navigated to: ${result.url}\nTitle: ${result.title}\n\nInteractive elements:\n${result.content}`,
                MAX_CONTENT,
              ),
            };
          }

          case "snapshot": {
            const snapshot = await browser.snapshot(true);
            return {
              toolCallId: "",
              content: truncate(snapshot, MAX_CONTENT),
            };
          }

          case "screenshot": {
            const buffer = await browser.screenshot();
            const base64 = buffer.toString("base64");
            const artifact = artifactStore.create(
              "image",
              "Browser Screenshot",
              base64,
            );
            return {
              toolCallId: "",
              content: JSON.stringify({
                artifactId: artifact.id,
                type: artifact.type,
                title: artifact.title,
                mimeType: artifact.mimeType,
              }),
            };
          }

          case "click": {
            const selector = args.selector as string;
            if (!selector) {
              return {
                toolCallId: "",
                content: "selector is required for click action (use @eN ref or CSS selector)",
                isError: true,
              };
            }
            await browser.click(selector);
            return { toolCallId: "", content: `Clicked: ${selector}` };
          }

          case "fill": {
            const selector = args.selector as string;
            const text = args.text as string;
            if (!selector || text == null) {
              return {
                toolCallId: "",
                content: "selector and text are required for fill action",
                isError: true,
              };
            }
            await browser.fill(selector, text);
            return {
              toolCallId: "",
              content: `Filled ${selector} with: ${text}`,
            };
          }

          case "type": {
            const selector = args.selector as string;
            const text = args.text as string;
            if (!selector || !text) {
              return {
                toolCallId: "",
                content: "selector and text are required for type action",
                isError: true,
              };
            }
            await browser.type(selector, text);
            return {
              toolCallId: "",
              content: `Typed into ${selector}: ${text}`,
            };
          }

          case "select": {
            const selector = args.selector as string;
            const value = args.value as string;
            if (!selector || !value) {
              return {
                toolCallId: "",
                content: "selector and value are required for select action",
                isError: true,
              };
            }
            await browser.select(selector, value);
            return {
              toolCallId: "",
              content: `Selected "${value}" in ${selector}`,
            };
          }

          case "press": {
            const key = args.key as string;
            if (!key) {
              return {
                toolCallId: "",
                content: "key is required for press action",
                isError: true,
              };
            }
            await browser.press(key);
            return { toolCallId: "", content: `Pressed: ${key}` };
          }

          case "evaluate": {
            const script = args.script as string;
            if (!script) {
              return {
                toolCallId: "",
                content: "script is required for evaluate action",
                isError: true,
              };
            }
            const result = await browser.evaluate(script);
            return {
              toolCallId: "",
              content: truncate(result, MAX_CONTENT),
            };
          }

          case "get_text": {
            const selector = args.selector as string;
            if (!selector) {
              return {
                toolCallId: "",
                content: "selector is required for get_text action",
                isError: true,
              };
            }
            const result = await browser.run(["get", "text", selector]);
            return {
              toolCallId: "",
              content: truncate(result, MAX_CONTENT),
            };
          }

          case "get_content": {
            const result = await browser.getContent();
            return {
              toolCallId: "",
              content: truncate(
                `URL: ${result.url}\nTitle: ${result.title}\n\nInteractive elements:\n${result.content}`,
                MAX_CONTENT,
              ),
            };
          }

          case "wait": {
            const target = (args.target as string) || "2000";
            await browser.wait(target);
            return { toolCallId: "", content: `Waited for: ${target}` };
          }

          case "back": {
            await browser.run(["back"]);
            return { toolCallId: "", content: "Navigated back" };
          }

          case "forward": {
            await browser.run(["forward"]);
            return { toolCallId: "", content: "Navigated forward" };
          }

          case "reload": {
            await browser.run(["reload"]);
            return { toolCallId: "", content: "Page reloaded" };
          }

          default:
            return {
              toolCallId: "",
              content: `Unknown action: ${action}`,
              isError: true,
            };
        }
      };

      try {
        return await executeAction();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Stale daemon — reset and retry once
        if (msg.includes("has been closed") || msg.includes("Target page")) {
          await closeBrowser().catch(() => {});
          resetBrowserInstance();
          try {
            return await executeAction();
          } catch (retryErr) {
            return {
              toolCallId: "",
              content: `Browser error (after retry): ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
              isError: true,
            };
          }
        }
        return {
          toolCallId: "",
          content: `Browser error: ${msg}`,
          isError: true,
        };
      }
    },
  };
}
