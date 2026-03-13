---
name: nano-pdf
description: "Edit PDFs with natural-language instructions using the nano-pdf CLI. Use when a user asks to modify a PDF, fix a typo in a PDF, change text on a specific page, or update content in an existing PDF file."
requires:
  bins:
    - nano-pdf
install:
  - kind: uv
    package: nano-pdf
    bins: [nano-pdf]
    label: "Install nano-pdf (uv)"
metadata:
  emoji: "📄"
  tags:
    - pdf
    - editing
    - utility
  homepage: https://pypi.org/project/nano-pdf/
---

# PDF Editor Skill

Use `nano-pdf` to edit PDFs with natural-language instructions.

## When to Use

- "Change the title in this PDF"
- "Fix the typo on page 2"
- "Update the date in the header"

## Commands

```bash
# Edit a specific page with natural-language instructions
nano-pdf edit document.pdf 1 "Change the title to 'Q3 Results' and fix the typo in the subtitle"

# Edit page 0
nano-pdf edit deck.pdf 0 "Replace 'Draft' with 'Final' in the header"
```

## Notes

- Page numbers may be 0-based or 1-based depending on the version — if the result looks off by one, retry with the other numbering
- Always verify the output PDF before sharing
- Requires Python (installed via `uv`)
