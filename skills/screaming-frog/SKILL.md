---
name: screaming-frog
description: "Run Screaming Frog SEO Spider via CLI: crawl websites, find broken links, export SEO data, generate sitemaps. Use when the user asks to crawl a site, run a technical SEO audit, find 404s, or check page titles/meta descriptions. Do NOT use for search performance data (use google-search-console) or keyword research (use dataforseo)."
metadata:
    emoji: "🕷️"
    tags:
        - seo
        - crawl
        - audit
    homepage: https://www.screamingfrog.co.uk/seo-spider/
---

# Screaming Frog SEO Spider CLI

Run the SEO Spider headless from the command line to crawl sites, export data, and generate reports.

## Quick Start (Recommended)

Use the helper scripts that automatically detect your Screaming Frog installation:

```bash
# Detect installation
node {baseDir}/scripts/detect.mjs

# Run a crawl with default exports
node {baseDir}/scripts/crawl.mjs "https://example.com"

# Custom output directory
node {baseDir}/scripts/crawl.mjs "https://example.com" --output "/tmp/my_crawl"

# Custom export tabs
node {baseDir}/scripts/crawl.mjs "https://example.com" --export "Internal:All,Response Codes:Client Error (4xx)"

# Longer timeout for large sites
node {baseDir}/scripts/crawl.mjs "https://example.com" --timeout 600
```

The helper scripts will:

- Automatically find Screaming Frog on Windows, macOS, or Linux
- Use timestamped output folders
- Export common SEO data by default
- Display the output location and CSV files when done

## Binary per OS

- **Windows:** `"C:\Program Files (x86)\Screaming Frog SEO Spider\ScreamingFrogSEOSpiderCli.exe"`
- **macOS:** `/Applications/Screaming\ Frog\ SEO\ Spider.app/Contents/MacOS/ScreamingFrogSEOSpiderLauncher`
- **Linux:** `screamingfrogseospider`

On Windows, do NOT use `which` to check if the binary exists. Use `where` or check if the file exists directly:

```bash
test -f "C:\Program Files (x86)\Screaming Frog SEO Spider\ScreamingFrogSEOSpiderCli.exe" && echo "Found"
```

All examples below use `SFCLI` as shorthand. Replace with the full quoted binary path.

## When to Use

- "Crawl example.com and show me broken links"
- "Run an SEO audit on my site"
- "Export all 404 errors from a crawl"
- "Generate a sitemap for my website"
- "Check page titles and meta descriptions"

## Crawl & Export (Recommended Pattern)

Always use `--timestamped-output` so each crawl gets its own folder. Use `C:\Temp` or `/tmp` as output base — never `%USERPROFILE%` in bash.

```bash
SFCLI --crawl https://www.example.com --headless --save-crawl --timestamped-output --output-folder "C:\Temp\SF_Crawl" --export-tabs "Internal:All,Response Codes:Client Error (4xx),Page Titles:All,Meta Description:All,H1:All,Images:Missing Alt Text"
```

**Important:** The crawl can take minutes for large sites. Use a generous timeout (5-10 min). After the crawl finishes, list the output folder to find the timestamped subfolder with the CSV exports.

### Load a saved crawl and re-export

```bash
SFCLI --headless --load-crawl "/path/to/crawl.seospider" --output-folder "/path/to/output" --export-tabs "Internal:All"
```

## Presenting Results

After the crawl completes, CSV files will be in the output folder. The CSV files may use localized column headers (e.g. German "Adresse" instead of "Address", "Status-Code" instead of "Status Code").

**IMPORTANT: Use the `cortask_csv_artifact` tool to display all exported CSV files.** Do NOT read the CSV files yourself or format them as markdown tables — the tool handles everything and displays interactive filterable tables in the UI.

1. List the timestamped output folder to find all `.csv` files
2. Call `cortask_csv_artifact` with the absolute paths of ALL CSV files at once
3. The tool returns a compact summary of each file (columns, row counts, sample data)
4. Based on the summary, present a brief analysis: key findings, issues found (broken links, missing metadata, redirects, etc.), and recommendations

Do NOT use `bash cat`, `read_file`, or any other method to read CSV contents. The artifact tool reads the files, stores them for the UI, and gives you a summary to work with.

## Export Tab Reference

Format: `"Tab:Filter,Tab:Filter,..."` — names match the UI.

Common tabs:

- `Internal:All` — all internal URLs with on-page data
- `Response Codes:Client Error (4xx)` — broken links
- `Response Codes:Server Error (5xx)` — server errors
- `Response Codes:Redirection (3xx)` — redirects
- `Page Titles:All`, `Page Titles:Missing`, `Page Titles:Duplicate`
- `Meta Description:All`, `Meta Description:Missing`
- `H1:All`, `H1:Missing`, `H1:Duplicate`
- `Images:All`, `Images:Missing Alt Text`
- `Canonicals:All`, `Canonicals:Missing`
- `Directives:All`
- `Hreflang:All`
- `Structured Data:All`

Use `SFCLI --help export-tabs` for the full list.

## Bulk Exports & Reports

```bash
# Bulk exports (names match Bulk Export menu)
--bulk-export "Links:All Inlinks"
--bulk-export "Response Codes:Internal & External:Client Error (4xx) Inlinks"

# Reports (names match Reports menu)
--save-report "Redirects:All Redirects"
```

## Configuration

```bash
--config "/path/to/config.seospiderconfig"
--auth-config "/path/to/auth.seospiderauthconfig"
```

## Sitemaps

```bash
SFCLI --crawl https://www.example.com --headless --create-sitemap --output-folder "/path/to/output"
SFCLI --crawl https://www.example.com --headless --create-images-sitemap --output-folder "/path/to/output"
```

## Output Options

```bash
--output-folder "/path"      # Where to save exports
--timestamped-output          # Create timestamped subfolder (recommended)
--overwrite                   # Overwrite existing files
--export-format csv           # csv, xls, xlsx, gsheet
--project-name "Name"         # Group crawls by project
--task-name "Name"            # Name individual crawl tasks
```

## Notes

- Always use `--headless` for CLI-only operation (no GUI)
- Always use `--output-folder` with `--timestamped-output`
- On Windows use the `Cli.exe` variant, not the regular `.exe`
- CSV column headers may be localized (German, French, etc.) — adapt parsing accordingly
- The SEO Spider requires a paid license for crawls over 500 URLs
- Large sites can take several minutes — use a 5-10 min timeout
- Do NOT use `which` on Windows — use `where` or `test -f` instead
- Do NOT use `%USERPROFILE%` in bash shell — use `$HOME` or absolute paths
