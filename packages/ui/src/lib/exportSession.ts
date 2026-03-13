import type { SessionWithMessages, ContentPart } from "@/lib/api";

function formatContent(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;

  const parts: string[] = [];
  for (const part of content) {
    if (part.type === "text" && part.text) {
      parts.push(part.text);
    } else if (part.type === "tool_use") {
      parts.push(
        `<details>\n<summary>Tool: ${part.toolName}</summary>\n\n\`\`\`json\n${JSON.stringify(part.toolArguments, null, 2)}\n\`\`\`\n</details>`,
      );
    } else if (part.type === "tool_result") {
      const label = part.isError ? "Error" : "Result";
      parts.push(
        `<details>\n<summary>${label}</summary>\n\n\`\`\`\n${part.text ?? ""}\n\`\`\`\n</details>`,
      );
    }
  }
  return parts.join("\n\n");
}

export function exportSessionAsMarkdown(session: SessionWithMessages): string {
  const lines: string[] = [];
  lines.push(`# ${session.title}`);
  lines.push("");
  lines.push(`*Exported on ${new Date().toLocaleString()}*`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const msg of session.messages) {
    const role = msg.role === "user" ? "User" : "Assistant";
    lines.push(`### ${role}`);
    lines.push("");
    lines.push(formatContent(msg.content));
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
