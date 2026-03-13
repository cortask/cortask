---
name: example
description: "An example skill demonstrating the SKILL.md format and best practices. Use this as a template when creating new skills for Cortask."
metadata:
    emoji: "📚"
    homepage: https://cortask.dev
    tags:
        - example
        - documentation
---

# Example Skill

This skill demonstrates the recommended SKILL.md structure and best practices.

## Description Best Practices

The `description` field in frontmatter is the most important part — it determines when the skill triggers. Always include:

1. **WHAT** the skill does
2. **WHEN** to use it (specific trigger phrases users would say)
3. **Negative triggers** if the skill overlaps with others

```yaml
# Good — specific, includes triggers and negative triggers
description: "Generate images via DALL-E. Use when a user asks to create images
  with DALL-E or OpenAI. Do NOT use for Gemini image requests."

# Bad — too vague, no triggers
description: "Helps with images."
```

## Skill File Structure

```
your-skill-name/           # kebab-case folder name
├── SKILL.md               # Required — main skill file
├── scripts/               # Optional — executable code
│   └── process.py
├── references/            # Optional — detailed docs (loaded on demand)
│   └── api-guide.md
├── credentials.json       # Optional — credential schema
└── index.js               # Optional — code-based tools (Tier 3)
```

## Skill Tiers

### Tier 1: Text-Only Skills

Teach the AI to use existing tools (bash, web fetch, etc.):

```yaml
---
name: my-skill
description: "What it does. Use when user asks to [specific phrases]."
requires:
    bins:
        - curl
---
```

### Tier 2: HTTP Template Skills

Auto-register API tools that the AI can call directly:

```yaml
---
name: api-skill
description: "What it does. Use when user asks to [specific phrases]."
tools:
    - name: my_api
      description: "Call the API"
      input:
          query:
              type: string
              description: "Search query"
      request:
          url: "https://api.example.com/search?q={{query}}"
          method: GET
          headers:
              Authorization: "Bearer {{credential:apiKey}}"
---
```

### Tier 3: Code Skills

Add `index.js` alongside SKILL.md with custom tool handlers:

```js
// index.js
export const tools = [
    {
        name: "my_custom_tool",
        description: "Does something custom",
        inputSchema: {
            type: "object",
            properties: {
                input: { type: "string", description: "The input" },
            },
            required: ["input"],
        },
        async execute(args, context) {
            // Custom logic here
            return { content: `Processed: ${args.input}` };
        },
    },
];
```

## Recommended SKILL.md Body Structure

```markdown
# Skill Name

Brief description of what this skill does.

## When to Use

- "Example user phrase 1"
- "Example user phrase 2"

## When NOT to Use

- Describe overlapping skills or out-of-scope requests

## Setup

Steps to configure the skill (if any).

## Commands / Quick Examples

Most common operations with examples.

## Troubleshooting

### Common error

Cause and solution.

## Notes

- Important caveats and tips
```

## Progressive Disclosure

Keep SKILL.md focused on core instructions. Move detailed reference docs to `references/` and link to them:

```markdown
For detailed API examples, see `references/api-guide.md`.
```

This minimizes token usage — the agent only loads reference files when it needs them.

## Installation

Skills can be installed from Git:

```
cortask skill install https://github.com/user/cortask-skill-name.git
```

Or created via the UI or CLI:

```
cortask skill list
cortask skill set-credential <skill-name>
```
