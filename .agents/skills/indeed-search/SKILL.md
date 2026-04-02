---
name: indeed-search
version: 1.0.0
description: >
  Make sure to use this skill whenever the user mentions anything related to
  searching for jobs on Indeed, finding UK job listings, or looking for
  positions via Indeed — even if they don't mention Indeed explicitly.
  Also invoke this skill for questions about UK employment, job hunting in
  Britain, or finding work in the United Kingdom. Trigger phrases include:
  indeed, indeed jobs, indeed uk, uk jobs indeed, find job indeed,
  job search uk, indeed job search, software engineer indeed, data scientist
  indeed, remote job uk indeed, london jobs indeed, manchester jobs indeed,
  full-time uk indeed, contract uk indeed, indeed search, uk vacancies,
  jobs near me uk, employment uk, british jobs, england jobs.
context: fork
allowed-tools: Bash(bun run skills/indeed-search/cli/src/cli.ts *)
---

# Indeed Search Skill

Search UK job listings on Indeed (uk.indeed.com) using Playwright browser automation. No login required.

## When to use this skill

Invoke this skill when the user wants to:

- Search for jobs on Indeed, particularly in the UK
- Get full details for a specific Indeed job posting
- Find remote or on-site positions on Indeed UK
- Filter Indeed jobs by type, salary, experience level, or posting date

## Commands

### Search jobs

```bash
bun run skills/indeed-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--keywords <text>` — search terms (job title, skill, company)
- `--location <text>` — location (default: "United Kingdom")
- `--radius <miles>` — radius from location
- `--type <value>` — full-time, part-time, contract, permanent, temporary, apprenticeship
- `--remote` — remote jobs only
- `--salary <value>` — minimum salary filter
- `--since <value>` — last-24h, last-3d, last-7d, last-14d
- `--experience <value>` — experience level filter
- `--limit <n>` — max results (default: 25)
- `--format json|table|plain`

### Full job detail

```bash
bun run skills/indeed-search/cli/src/cli.ts detail <id-or-url> [--format json|plain]
```

Accepts an Indeed job key or full URL. Returns full job description, company info, and requirements.

---

## Usage examples

### Search for data engineer jobs in London

```bash
bun run skills/indeed-search/cli/src/cli.ts search \
  --keywords "data engineer" \
  --location "London" \
  --type full-time \
  --format table
```

### Remote software engineering roles posted this week

```bash
bun run skills/indeed-search/cli/src/cli.ts search \
  --keywords "software engineer" \
  --remote \
  --since last-7d \
  --format table
```

### Full details for a specific job

```bash
bun run skills/indeed-search/cli/src/cli.ts detail abc123xyz --format plain
```

---

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable list of results |
| `plain` | Single-job detail views (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

---

## Notes

- No login required — Indeed shows job listings without authentication.
- Indeed may present cookie consent banners — the scraper handles dismissing them.
- Indeed may change their page structure — if scraping breaks, `scraper.ts` is the file to update.
- Uses uk.indeed.com (indeed.co.uk redirects there).
