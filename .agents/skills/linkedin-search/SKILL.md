---
name: linkedin-search
version: 1.0.0
description: >
  Make sure to use this skill whenever the user mentions anything related to
  searching for jobs on LinkedIn, finding UK job listings, or looking for
  positions via LinkedIn — even if they don't mention LinkedIn explicitly.
  Also invoke this skill for questions about LinkedIn job search, UK employment,
  or finding work in the United Kingdom. Trigger phrases include:
  linkedin, linkedin jobs, linkedin uk, uk jobs linkedin, find job linkedin,
  job search uk, linkedin job search, software engineer linkedin, data scientist
  linkedin, remote job uk linkedin, london jobs linkedin, manchester jobs,
  full-time uk, contract uk, hybrid uk, linkedin login, linkedin search.
context: fork
allowed-tools: Bash(bun run skills/linkedin-search/cli/src/cli.ts *)
---

# LinkedIn Search Skill

Search job listings on LinkedIn using jobspy-api (Docker) as the primary backend, with Playwright browser automation as fallback.

## When to use this skill

Invoke this skill when the user wants to:

- Search for jobs on LinkedIn
- Log in to LinkedIn to enable authenticated job searches
- Get full details for a specific LinkedIn job posting
- Find remote, hybrid, or on-site positions on LinkedIn
- Filter LinkedIn jobs by type, experience level, or date posted

## Prerequisites

1. **Docker (recommended):** Install Docker for the jobspy-api backend. Run `setup` to start the container. If Docker is unavailable, the skill falls back to Playwright browser automation automatically.

2. **LinkedIn login:** Before searching, log in once:

```bash
bun run skills/linkedin-search/cli/src/cli.ts login
```

This opens a visible browser window. The user logs in manually (handles 2FA/CAPTCHA). Session cookies are saved and reused — both by jobspy-api (via `li_at` cookie) and by the Playwright fallback.

## Commands

### Setup (optional)

```bash
bun run skills/linkedin-search/cli/src/cli.ts setup
```

Pulls and starts the jobspy-api Docker container. Shared with the Indeed skill — only needs to run once. Search commands also auto-start the container if needed.

### Log in to LinkedIn

```bash
bun run skills/linkedin-search/cli/src/cli.ts login
```

Opens a headed browser for manual login. Saves session cookies on success.

### Search jobs

```bash
bun run skills/linkedin-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--keywords <text>` — search terms (job title, skill, company)
- `--location <text>` — location (default: "United Kingdom")
- `--radius <miles>` — radius from location
- `--type <value>` — full-time, part-time, contract, permanent, internship, volunteer
- `--remote <value>` — on-site, remote, hybrid
- `--experience <value>` — internship, entry, associate, mid-senior, director, executive
- `--since <value>` — past-24h, past-week, past-month
- `--limit <n>` — max results (default: 25)
- `--format json|table|plain`

### Full job detail

```bash
bun run skills/linkedin-search/cli/src/cli.ts detail <id-or-url> [--format json|plain]
```

Accepts a LinkedIn job ID or full URL. Returns full job description, company info, and requirements.

---

## Usage examples

### Search for data engineer jobs in London

```bash
bun run skills/linkedin-search/cli/src/cli.ts search \
  --keywords "data engineer" \
  --location "London" \
  --type full-time \
  --format table
```

### Remote software engineering roles

```bash
bun run skills/linkedin-search/cli/src/cli.ts search \
  --keywords "software engineer" \
  --remote remote \
  --since past-week \
  --format table
```

### Full details for a specific job

```bash
bun run skills/linkedin-search/cli/src/cli.ts detail 3847291056 --format plain
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

- **jobspy-api** is the primary search backend (Docker). Falls back to Playwright if unavailable.
- Requires a LinkedIn login session. Run `login` first.
- If cookies expire, commands will print an error asking you to run `login` again.
- The `detail` command always uses Playwright to navigate directly to the job page.
- LinkedIn may change their page structure — if Playwright scraping breaks, `scraper.ts` is the file to update.
