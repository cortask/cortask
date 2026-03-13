---
name: github
description: "GitHub operations via gh CLI: issues, PRs, CI runs, code review, API queries. Use when checking PR status, creating issues, or querying GitHub data."
requires:
  bins:
    - gh
install:
  - kind: brew
    formula: gh
    bins: [gh]
    os: [darwin, linux]
    label: "Install gh (brew)"
  - kind: winget
    package: GitHub.cli
    bins: [gh]
    os: [win32]
    label: "Install gh (winget)"
  - kind: scoop
    package: gh
    bins: [gh]
    os: [win32]
    label: "Install gh (scoop)"
metadata:
  emoji: "🐙"
  homepage: https://github.com
  tags:
    - github
    - development
    - ci
---

# GitHub Skill

Use the `gh` CLI to interact with GitHub repositories, issues, PRs, and CI.

## When to Use

- Checking PR status, reviews, or merge readiness
- Viewing CI/workflow run status and logs
- Creating, closing, or commenting on issues
- Creating or merging pull requests
- Querying GitHub API for repository data

## When NOT to Use

- Local git operations (commit, push, pull) — use `git` directly
- Non-GitHub repos (GitLab, Bitbucket)
- Cloning repositories — use `git clone`

## Common Commands

### Pull Requests

```bash
# List PRs
gh pr list --repo owner/repo

# Check CI status
gh pr checks 55 --repo owner/repo

# View PR details
gh pr view 55 --repo owner/repo

# Create PR
gh pr create --title "feat: add feature" --body "Description"

# Merge PR
gh pr merge 55 --squash --repo owner/repo
```

### Issues

```bash
# List open issues
gh issue list --repo owner/repo --state open

# Create issue
gh issue create --title "Bug: something broken" --body "Details..."

# Close issue
gh issue close 42 --repo owner/repo
```

### CI/Workflow Runs

```bash
# List recent runs
gh run list --repo owner/repo --limit 10

# View failed step logs
gh run view <run-id> --repo owner/repo --log-failed

# Re-run failed jobs
gh run rerun <run-id> --failed --repo owner/repo
```

### API Queries

```bash
# Get PR with specific fields
gh api repos/owner/repo/pulls/55 --jq '.title, .state, .user.login'

# List labels
gh api repos/owner/repo/labels --jq '.[].name'

# Get repo stats
gh api repos/owner/repo --jq '{stars: .stargazers_count, forks: .forks_count}'
```

## JSON Output

Most commands support `--json` for structured output:

```bash
gh issue list --repo owner/repo --json number,title --jq '.[] | "\(.number): \(.title)"'
gh pr list --json number,title,state --jq '.[] | select(.state == "OPEN")'
```

## Notes

- Specify `--repo owner/repo` when not in a git directory
- Use URLs directly: `gh pr view https://github.com/owner/repo/pull/55`
- Use `gh api --cache 1h` for repeated queries to avoid rate limits
- Requires `gh auth login` to be configured
