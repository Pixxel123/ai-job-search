# JobSpy API Integration — Design Spec

**Date:** 2026-04-02
**Status:** Draft
**Extends:** 2026-04-02-uk-job-search-skills-design.md

## Overview

Replace the raw Playwright scraping in the LinkedIn and Indeed skills with a self-hosted jobspy-api (Docker) as the primary search backend. Playwright scraping remains as an automatic fallback when Docker/jobspy-api is unavailable. A single shared Docker container serves both skills.

## Why

- JobSpy is an actively maintained open-source scraper (speedyapply/JobSpy, ~3,100 GitHub stars) that handles Indeed UK with no rate limiting and LinkedIn with moderate volume support
- jobspy-api (rainmanjam/jobspy-api) wraps JobSpy in a Dockerized FastAPI service with caching, rate limiting, and a clean REST interface
- Raw Playwright DOM scraping is fragile — LinkedIn and Indeed change their page structure frequently. JobSpy is maintained by the community and adapts faster than our custom scrapers.
- Keeping Playwright as fallback means the skills always work, even without Docker

## Architecture

```
.agents/skills/
├── shared/
│   └── cli/
│       ├── package.json                 # (existing, no new deps needed)
│       ├── docker-compose.yml           # NEW: jobspy-api service definition
│       └── src/
│           ├── index.ts                 # (existing, add new exports)
│           ├── types.ts                 # (existing, unchanged)
│           ├── formatting.ts            # (existing, unchanged)
│           ├── browser.ts               # (existing, unchanged — still used for login + fallback)
│           ├── docker.ts                # NEW: Docker container lifecycle management
│           └── jobspy-client.ts         # NEW: HTTP client for jobspy-api
├── linkedin-search/
│   ├── SKILL.md                         # (existing, add setup command docs)
│   └── cli/
│       └── src/
│           ├── cli.ts                   # (modify: register setup command)
│           ├── commands/
│           │   ├── setup.ts             # NEW: start jobspy-api container
│           │   ├── login.ts             # (existing, unchanged)
│           │   ├── search.ts            # (modify: try jobspy-client first, fallback to scraper)
│           │   └── detail.ts            # (modify: try jobspy-client first, fallback to scraper)
│           └── scraper.ts               # (existing, unchanged — Playwright fallback)
├── indeed-search/
│   ├── SKILL.md                         # (existing, add setup command docs)
│   └── cli/
│       └── src/
│           ├── cli.ts                   # (modify: register setup command)
│           ├── commands/
│           │   ├── setup.ts             # NEW: start jobspy-api container
│           │   ├── search.ts            # (modify: try jobspy-client first, fallback to scraper)
│           │   └── detail.ts            # (modify: try jobspy-client first, fallback to scraper)
│           └── scraper.ts               # (existing, unchanged — Playwright fallback)
```

## Shared Core — New Modules

### `docker-compose.yml`

Bundled at `.agents/skills/shared/cli/docker-compose.yml`:

```yaml
services:
  jobspy-api:
    image: rainmanjam/jobspy-api:latest
    container_name: jobspy-api
    ports:
      - "8004:8004"
    restart: unless-stopped
```

Port 8004 is jobspy-api's default. Container name `jobspy-api` is used for lifecycle checks.

### `docker.ts` — Container lifecycle management

Functions:

- `isDockerAvailable(): Promise<boolean>` — checks if `docker` CLI is on PATH by running `docker --version`. Returns false if not found.
- `isContainerRunning(): Promise<boolean>` — runs `docker inspect --format='{{.State.Running}}' jobspy-api`. Returns true if output is `true`.
- `startService(): Promise<void>` — runs `docker compose -f <path-to-docker-compose.yml> up -d`. Waits up to 30 seconds for the health check endpoint to respond.
- `stopService(): Promise<void>` — runs `docker compose -f <path-to-docker-compose.yml> down`.
- `getServiceUrl(): string` — returns `http://localhost:8004`.

All docker commands use `Bun.spawn` with stdout/stderr piped. Errors are caught and returned as structured error objects, not thrown — the caller decides whether to fall back.

### `jobspy-client.ts` — HTTP client for jobspy-api

The jobspy-api exposes `GET /api/v1/search_jobs` with these key parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `site_name` | string | `linkedin`, `indeed`, `glassdoor`, `google`, `zip_recruiter` |
| `search_term` | string | Keywords |
| `location` | string | Location text |
| `distance` | number | Radius in miles |
| `job_type` | string | `fulltime`, `parttime`, `contract`, `internship` |
| `is_remote` | boolean | Remote only filter |
| `results_wanted` | number | Max results (default 20) |
| `hours_old` | number | Max age in hours (24, 72, 168, 336) |
| `linkedin_fetch_description` | boolean | Fetch full descriptions (LinkedIn) |
| `linkedin_company_ids` | string | Company filter for LinkedIn |
| `country_indeed` | string | Indeed country code (default `USA`, set to `UK`) |

Functions:

- `isServiceAvailable(): Promise<boolean>` — `GET http://localhost:8004/docs` or similar health check. Returns true if 200.
- `searchJobs(params: JobSpySearchParams): Promise<JobListing[]>` — calls the search endpoint, maps the response fields to our `JobListing` schema.
- `getLinkedInCookie(): string | null` — reads the saved Playwright cookies from `~/.config/ai-job-search/cookies/linkedin.json`, finds the `li_at` cookie, returns its value. This is passed as `linkedin_cookie` to jobspy-api for authenticated LinkedIn searches.

**Response mapping:** JobSpy returns objects with fields like `title`, `company_name`, `location`, `job_url`, `description`, `date_posted`, `job_type`, `salary_source`, `min_amount`, `max_amount`, `currency`, `is_remote`. These are mapped to our `JobListing`/`JobDetail` types:

```typescript
// JobSpy response → our JobListing
{
  id: extractIdFromUrl(job.job_url),     // extract job ID from URL
  title: job.title,
  company: job.company_name,
  location: job.location,
  jobType: job.job_type ?? null,
  salary: formatSalary(job),             // combine min/max/currency
  url: job.job_url,
  posted: job.date_posted ?? null,
  deadline: null,                        // JobSpy doesn't provide this
  source: params.site_name,              // "linkedin" or "indeed"
}
```

When `linkedin_fetch_description: true` or for Indeed (which includes descriptions by default), the response also contains `description` which maps to `JobDetail.description`.

### `index.ts` — Updated barrel export

Add exports for the new modules:

```typescript
export { isDockerAvailable, isContainerRunning, startService, stopService, getServiceUrl } from "./docker.js"
export { searchJobs, isServiceAvailable, getLinkedInCookie } from "./jobspy-client.js"
```

## Command Changes

### `setup` command (new, both skills)

Both skills get an identical `setup` command:

```
bun run skills/linkedin-search/cli/src/cli.ts setup
```

- Checks if Docker is available. If not, prints error with install instructions.
- Checks if jobspy-api container is already running. If yes, prints "already running".
- Runs `docker compose up -d` to pull image and start container.
- Waits for health check (up to 30s, polling every 2s).
- Prints success message with the service URL.

### `search` command (modified, both skills)

New flow:

1. Try jobspy-api:
   - Check if container is running. If not, auto-start it.
   - If Docker is unavailable or container fails to start, go to step 2.
   - Call `searchJobs()` with the appropriate `site_name` (`linkedin` or `indeed`).
   - For LinkedIn, pass `linkedin_cookie` from saved cookies.
   - For Indeed, pass `country_indeed: "UK"`.
   - Map results to `SearchResponse`, output, done.
2. Fallback to Playwright:
   - Print warning to stderr: `{"warning": "jobspy-api unavailable, using Playwright fallback"}`
   - Use existing scraper logic (unchanged from current implementation).

### `detail` command (modified, both skills)

New flow:

1. Try jobspy-api:
   - Same container check/auto-start as search.
   - Call `searchJobs()` with `linkedin_fetch_description: true` and narrow search to find the specific job. For Indeed, descriptions are included by default.
   - If the job is found in results, map to `JobDetail`, output, done.
2. Fallback to Playwright:
   - Same warning as search.
   - Use existing Playwright detail scraping.

Note: jobspy-api doesn't have a dedicated "get job by ID" endpoint. For detail, we search with enough context to find the specific job, or fall back to Playwright which can navigate directly to the job URL.

### `login` command (unchanged, LinkedIn only)

No changes. Still uses Playwright to open a headed browser for manual LinkedIn login. The saved `li_at` cookie is now also consumed by jobspy-client for API requests.

## SKILL.md Updates

Both SKILL.md files get:
- A new `setup` command documented
- A note that jobspy-api is the primary backend with Playwright fallback
- Updated prerequisites section mentioning Docker

## Dependencies

No new npm/bun dependencies. The implementation uses:
- Native `fetch()` for HTTP calls to jobspy-api
- `Bun.spawn()` for Docker CLI commands
- Existing `@bunli/core` for command definitions
- Existing shared modules for types, formatting, cookies

Docker (with Docker Compose) must be installed on the host. The `setup` command checks for this and provides guidance if missing.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Docker not installed | Fallback to Playwright, warn on stderr |
| Container won't start | Fallback to Playwright, warn on stderr |
| jobspy-api returns error | Fallback to Playwright, warn on stderr |
| jobspy-api timeout (>10s) | Fallback to Playwright, warn on stderr |
| Playwright also fails | Error to stderr, exit code 1 |
| No LinkedIn cookie for LinkedIn search | jobspy-api proceeds without auth (limited results), warn on stderr |

## Testing

- `docker.ts` — unit tests using mock `Bun.spawn` responses for docker commands
- `jobspy-client.ts` — unit tests with mock HTTP responses for the mapping logic
- `setup` command — smoke test (--help)
- `search`/`detail` commands — existing tests still pass (they test the Playwright path which is unchanged)
- Integration test (manual): run `setup`, then `search` with a real query

## Future Considerations

- **Dashboard/frontend:** jobspy-api itself has a REST interface. A future dashboard could call it directly rather than going through the CLI.
- **Proxy support:** jobspy-api supports proxies via config. Can be added to docker-compose.yml environment variables if LinkedIn rate limiting becomes an issue.
- **Additional sources:** JobSpy also supports Glassdoor, Google Jobs, and ZipRecruiter. Adding these would be a new SKILL.md + thin CLI wrapper, no new infrastructure.
