# UK Job Search Skills — Design Spec

**Date:** 2026-04-02
**Status:** Draft
**Replaces:** jobbank-search, jobdanmark-search (Danish job boards)

## Overview

Replace the four Danish job board skills (jobbank-search, jobdanmark-search, jobindex-search, jobnet-search) with two UK-focused skills — LinkedIn UK and Indeed UK — plus a shared core library. Both use Playwright for browser automation to handle JavaScript-heavy pages and anti-scraping measures.

## Architecture

```
.agents/skills/
├── shared/
│   └── cli/
│       ├── package.json
│       └── src/
│           ├── browser.ts
│           ├── formatting.ts
│           └── types.ts
├── linkedin-search/
│   ├── SKILL.md
│   └── cli/
│       ├── package.json          # depends on ../../shared/cli
│       └── src/
│           ├── cli.ts
│           ├── commands/
│           │   ├── search.ts
│           │   ├── detail.ts
│           │   └── login.ts
│           └── scraper.ts
├── indeed-search/
│   ├── SKILL.md
│   └── cli/
│       ├── package.json          # depends on ../../shared/cli
│       └── src/
│           ├── cli.ts
│           ├── commands/
│           │   ├── search.ts
│           │   └── detail.ts
│           └── scraper.ts
```

## Shared Core (`shared/cli`)

### `browser.ts` — Playwright browser management

- `launchBrowser(options?: { headed?: boolean })` — launches headless Chromium by default; `--headed` flag for debugging/login flows.
- `newPage(site: string)` — creates a page with realistic viewport (1280x800), desktop user-agent, and loads saved cookies if available.
- `loadCookies(site: string)` — reads cookies from `~/.config/ai-job-search/cookies/<site>.json`. Returns empty array if file doesn't exist.
- `saveCookies(page: Page, site: string)` — persists current page cookies to disk.
- Stealth measures: sets `navigator.webdriver` to false, uses realistic user-agent string, adds randomized delays (200-600ms) between navigation actions.

### `types.ts` — Shared data interfaces

```typescript
interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  jobType: string | null;       // full-time, part-time, contract, etc.
  salary: string | null;        // as displayed on the site
  url: string;
  posted: string | null;        // ISO date or relative string
  deadline: string | null;      // ISO date if available
  source: "linkedin" | "indeed";
}

interface JobDetail extends JobListing {
  description: string;          // full HTML
  employmentType: string[];
  remote: string | null;        // on-site, remote, hybrid
  companyInfo: {
    name: string;
    logo: string | null;
    url: string | null;
  };
  requirements: string | null;  // extracted if structured separately
}

interface SearchFilters {
  keywords: string | null;
  location: string;             // defaults to "United Kingdom"
  radius: number | null;        // miles
  jobType: string | null;
  remote: string | null;
  salary: string | null;
  datePosted: string | null;    // 24h, 7d, 14d, 30d
  experienceLevel: string | null;
  limit: number;                // max results to return
}
```

### `formatting.ts` — Output formatting

- `formatOutput(data: object, format: "json" | "table" | "plain")` — consistent output for both skills. JSON is the default, designed for future dashboard consumption.
- `writeError(error: string, code: string)` — writes `{ "error": error, "code": code }` to stderr.

## LinkedIn Skill (`linkedin-search/`)

### SKILL.md

- **Name:** linkedin-search
- **Description:** Search UK job listings on LinkedIn with authenticated browser sessions.
- **Trigger phrases:** linkedin, linkedin jobs, linkedin uk, jobs uk
- **Context:** fork
- **Allowed tools:** `Bash(bun run skills/linkedin-search/cli/src/cli.ts *)`

### Commands

#### `login`

Opens a **headed** (visible) browser window to `https://www.linkedin.com/login`. The user manually completes login (handles 2FA, CAPTCHA). The command watches for redirect to the LinkedIn feed, then saves session cookies. Subsequent commands reuse cookies. If cookies expire or are invalid, commands print an error instructing the user to run `login` again.

No flags.

#### `search [flags]`

Navigates to `https://www.linkedin.com/jobs/search/` with appropriate URL parameters.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--keywords` | string | (none) | Search terms |
| `--location` | string | "United Kingdom" | Location filter |
| `--radius` | number | (none) | Radius in miles |
| `--type` | string | (none) | full-time, part-time, contract, permanent, internship, volunteer |
| `--remote` | string | (none) | on-site, remote, hybrid |
| `--experience` | string | (none) | internship, entry, associate, mid-senior, director, executive |
| `--salary` | string | (none) | Salary range filter (LinkedIn's buckets) |
| `--since` | string | (none) | past-24h, past-week, past-month |
| `--limit` | number | 25 | Max results to return |
| `--format` | string | "json" | json, table, plain |

**Scraping logic:** Scrolls the job list panel to load results (LinkedIn lazy-loads). For each visible job card, extracts: title, company, location, job type, URL, posting date. Stops when `--limit` is reached or no more results load.

**Output:** `{ "meta": { "total": N }, "results": [JobListing, ...] }`

#### `detail <id-or-url> [--format]`

Accepts a LinkedIn job ID (numeric) or full job URL. Navigates to the job page, clicks "See more" to expand the description if needed, then extracts the full job detail.

**Output:** `JobDetail`

### `scraper.ts` — LinkedIn DOM selectors

Encapsulates all LinkedIn-specific CSS selectors and extraction logic. When LinkedIn changes their DOM (which they do frequently), only this file needs updating. Key extractions:

- Job cards from search results list
- Job title, company, location, metadata from cards
- Full description from detail page
- Company info panel

## Indeed Skill (`indeed-search/`)

### SKILL.md

- **Name:** indeed-search
- **Description:** Search UK job listings on Indeed.
- **Trigger phrases:** indeed, indeed jobs, indeed uk, uk jobs
- **Context:** fork
- **Allowed tools:** `Bash(bun run skills/indeed-search/cli/src/cli.ts *)`

### Commands

#### `search [flags]`

Navigates to `https://uk.indeed.com/jobs` with query parameters.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--keywords` | string | (none) | Search terms |
| `--location` | string | "United Kingdom" | Location filter |
| `--radius` | number | (none) | Radius in miles |
| `--type` | string | (none) | full-time, part-time, contract, permanent, temporary, apprenticeship |
| `--remote` | string | (none) | remote only filter |
| `--salary` | string | (none) | Minimum salary filter |
| `--since` | string | (none) | last-24h, last-3d, last-7d, last-14d |
| `--experience` | string | (none) | Experience level filter |
| `--limit` | number | 25 | Max results to return |
| `--format` | string | "json" | json, table, plain |

**Scraping logic:** Indeed shows ~15 results per page with pagination links. Navigates through pages until `--limit` is reached. Extracts job data from result cards or embedded JSON-LD/structured data if available.

**Output:** `{ "meta": { "total": N }, "results": [JobListing, ...] }`

**Note on domain:** Uses `uk.indeed.com` (Indeed's UK portal).

#### `detail <id-or-url> [--format]`

Accepts an Indeed job ID (alphanumeric `jk` parameter) or full job URL. Navigates to the job page and extracts full details.

**Output:** `JobDetail`

### `scraper.ts` — Indeed DOM selectors

Encapsulates Indeed-specific extraction logic. Indeed embeds some structured data (JSON-LD with Schema.org JobPosting) which should be preferred when available, falling back to DOM extraction.

No `login` command — Indeed does not gate job listings behind authentication.

## Cookie/Session Storage

Cookies stored at `~/.config/ai-job-search/cookies/<site>.json`. Directory created on first use. Each file contains the Playwright cookie array for that site.

LinkedIn session cookies typically last 1-3 months. If a command detects an expired session (redirect to login page), it exits with an error message telling the user to run `login` again.

## Dependencies

### `shared/cli/package.json`
- `playwright` — browser automation
- `zod` — schema validation
- `@bunli/core` — CLI framework
- `@bunli/utils` — CLI utilities

### `linkedin-search/cli/package.json` and `indeed-search/cli/package.json`
- Workspace dependency on `../../shared/cli`
- `@bunli/core` — CLI framework (for command definitions)

After installing, `bunx playwright install chromium` is required to download the browser binary.

## Cleanup

Delete these directories entirely:
- `.agents/skills/jobbank-search/`
- `.agents/skills/jobdanmark-search/`
- `.agents/skills/jobindex-search/` (if exists)
- `.agents/skills/jobnet-search/` (if exists)

Update CLAUDE.md if it references any Danish job board skills.

## Future Considerations

- **Dashboard/frontend:** All CLI output uses stable JSON schemas (`JobListing`, `JobDetail`) designed for programmatic consumption. A future frontend can call these CLIs and parse the output directly.
- **DOM fragility:** LinkedIn and Indeed change their page structure regularly. Each skill isolates selectors in `scraper.ts` to minimize the blast radius of DOM changes.
- **Rate limiting:** Both sites may throttle or block rapid requests. The shared browser module includes randomized delays. If blocking becomes an issue, adding proxy support to `browser.ts` would be the natural extension point.
