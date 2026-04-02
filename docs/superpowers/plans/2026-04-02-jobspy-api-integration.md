# JobSpy API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add self-hosted jobspy-api (Docker) as the primary search backend for both LinkedIn and Indeed skills, with automatic Playwright fallback.

**Architecture:** A shared `docker.ts` manages the jobspy-api container lifecycle (start/stop/status). A shared `jobspy-client.ts` handles HTTP requests to the API and maps responses to our `JobListing`/`JobDetail` types. Both skills' search/detail commands are modified to try jobspy-client first and fall back to existing Playwright scrapers on failure. A new `setup` command in each skill starts the Docker container.

**Tech Stack:** Bun, TypeScript, Docker, jobspy-api (rainmanjam/jobspy-api), existing `@bunli/core` CLI framework

---

## File Structure

### Shared Core (new files)
- **Create:** `.agents/skills/shared/cli/docker-compose.yml` — jobspy-api Docker service definition
- **Create:** `.agents/skills/shared/cli/src/docker.ts` — Docker container lifecycle (isDockerAvailable, isContainerRunning, startService, stopService, getServiceUrl)
- **Create:** `.agents/skills/shared/cli/src/jobspy-client.ts` — HTTP client for jobspy-api (searchJobs, isServiceAvailable, getLinkedInCookie, mapJobSpyResult)
- **Create:** `.agents/skills/shared/cli/tests/docker.test.ts` — Unit tests for docker.ts
- **Create:** `.agents/skills/shared/cli/tests/jobspy-client.test.ts` — Unit tests for jobspy-client.ts

### Shared Core (modified files)
- **Modify:** `.agents/skills/shared/cli/src/index.ts` — Add exports for docker.ts and jobspy-client.ts
- **Modify:** `.agents/skills/shared/cli/package.json` — Add exports for new subpaths

### LinkedIn Skill (new files)
- **Create:** `.agents/skills/linkedin-search/cli/src/commands/setup.ts` — Setup command

### LinkedIn Skill (modified files)
- **Modify:** `.agents/skills/linkedin-search/cli/src/cli.ts` — Register setup command
- **Modify:** `.agents/skills/linkedin-search/cli/src/commands/search.ts` — Try jobspy-client first, fallback to Playwright
- **Modify:** `.agents/skills/linkedin-search/cli/src/commands/detail.ts` — Try jobspy-client first, fallback to Playwright

### Indeed Skill (new files)
- **Create:** `.agents/skills/indeed-search/cli/src/commands/setup.ts` — Setup command

### Indeed Skill (modified files)
- **Modify:** `.agents/skills/indeed-search/cli/src/cli.ts` — Register setup command
- **Modify:** `.agents/skills/indeed-search/cli/src/commands/search.ts` — Try jobspy-client first, fallback to Playwright
- **Modify:** `.agents/skills/indeed-search/cli/src/commands/detail.ts` — Try jobspy-client first, fallback to Playwright

---

### Task 1: Create docker-compose.yml and docker.ts

**Files:**
- Create: `.agents/skills/shared/cli/docker-compose.yml`
- Create: `.agents/skills/shared/cli/src/docker.ts`
- Create: `.agents/skills/shared/cli/tests/docker.test.ts`

- [ ] **Step 1: Write the test for docker.ts**

Create `.agents/skills/shared/cli/tests/docker.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import { getServiceUrl, getComposePath } from "../src/docker.js"

describe("getServiceUrl", () => {
  test("returns localhost URL on port 8004", () => {
    const url = getServiceUrl()
    expect(url).toBe("http://localhost:8004")
  })
})

describe("getComposePath", () => {
  test("returns path ending with docker-compose.yml", () => {
    const path = getComposePath()
    expect(path).toContain("docker-compose.yml")
    expect(path).toContain("shared")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd .agents/skills/shared/cli && bun test tests/docker.test.ts
```

Expected: FAIL — imports not found

- [ ] **Step 3: Create docker-compose.yml**

Create `.agents/skills/shared/cli/docker-compose.yml`:

```yaml
services:
  jobspy-api:
    image: rainmanjam/jobspy-api:latest
    container_name: jobspy-api
    ports:
      - "8004:8004"
    restart: unless-stopped
```

- [ ] **Step 4: Write docker.ts**

Create `.agents/skills/shared/cli/src/docker.ts`:

```typescript
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const CONTAINER_NAME = "jobspy-api"
const SERVICE_PORT = 8004

export function getServiceUrl(): string {
  return `http://localhost:${SERVICE_PORT}`
}

export function getComposePath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url))
  return join(thisDir, "..", "docker-compose.yml")
}

async function runCommand(cmd: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}

export async function isDockerAvailable(): Promise<boolean> {
  try {
    const result = await runCommand(["docker", "--version"])
    return result.exitCode === 0
  } catch {
    return false
  }
}

export async function isContainerRunning(): Promise<boolean> {
  try {
    const result = await runCommand([
      "docker", "inspect", "--format", "{{.State.Running}}", CONTAINER_NAME,
    ])
    return result.stdout === "true"
  } catch {
    return false
  }
}

export async function startService(): Promise<{ ok: boolean; error?: string }> {
  if (!(await isDockerAvailable())) {
    return { ok: false, error: "Docker is not installed. Install Docker from https://docs.docker.com/get-docker/" }
  }

  const composePath = getComposePath()
  const result = await runCommand([
    "docker", "compose", "-f", composePath, "up", "-d",
  ])

  if (result.exitCode !== 0) {
    return { ok: false, error: `Failed to start jobspy-api: ${result.stderr}` }
  }

  // Wait for service to be ready (up to 30s)
  const serviceUrl = getServiceUrl()
  for (let i = 0; i < 15; i++) {
    try {
      const resp = await fetch(`${serviceUrl}/docs`, { signal: AbortSignal.timeout(2000) })
      if (resp.ok) return { ok: true }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 2000))
  }

  return { ok: false, error: "jobspy-api started but health check timed out after 30s" }
}

export async function stopService(): Promise<{ ok: boolean; error?: string }> {
  const composePath = getComposePath()
  const result = await runCommand([
    "docker", "compose", "-f", composePath, "down",
  ])

  if (result.exitCode !== 0) {
    return { ok: false, error: `Failed to stop jobspy-api: ${result.stderr}` }
  }

  return { ok: true }
}

export async function ensureServiceRunning(): Promise<{ ok: boolean; error?: string }> {
  if (await isContainerRunning()) {
    // Verify it's actually responding
    try {
      const resp = await fetch(`${getServiceUrl()}/docs`, { signal: AbortSignal.timeout(3000) })
      if (resp.ok) return { ok: true }
    } catch {
      // Container running but not responding — restart
    }
  }

  return startService()
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd .agents/skills/shared/cli && bun test tests/docker.test.ts
```

Expected: 2 tests pass

- [ ] **Step 6: Commit**

```bash
git add .agents/skills/shared/cli/docker-compose.yml .agents/skills/shared/cli/src/docker.ts .agents/skills/shared/cli/tests/docker.test.ts
git commit -m "feat: add Docker lifecycle management for jobspy-api"
```

---

### Task 2: Create jobspy-client.ts

**Files:**
- Create: `.agents/skills/shared/cli/src/jobspy-client.ts`
- Create: `.agents/skills/shared/cli/tests/jobspy-client.test.ts`

- [ ] **Step 1: Write the test for jobspy-client.ts**

Create `.agents/skills/shared/cli/tests/jobspy-client.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import { mapJobSpyResult, mapJobSpyToDetail, buildSearchParams, getLinkedInCookie } from "../src/jobspy-client.js"

describe("mapJobSpyResult", () => {
  test("maps a LinkedIn result to JobListing", () => {
    const raw = {
      title: "Senior Data Engineer",
      company_name: "Acme Corp",
      location: "London, England, United Kingdom",
      job_url: "https://www.linkedin.com/jobs/view/3847291056",
      date_posted: "2026-03-28",
      job_type: "fulltime",
      min_amount: 60000,
      max_amount: 80000,
      currency: "GBP",
      is_remote: false,
      description: "<p>Great role</p>",
    }
    const listing = mapJobSpyResult(raw, "linkedin")
    expect(listing.id).toBe("3847291056")
    expect(listing.title).toBe("Senior Data Engineer")
    expect(listing.company).toBe("Acme Corp")
    expect(listing.location).toBe("London, England, United Kingdom")
    expect(listing.source).toBe("linkedin")
    expect(listing.url).toBe("https://www.linkedin.com/jobs/view/3847291056")
    expect(listing.posted).toBe("2026-03-28")
    expect(listing.salary).toContain("60,000")
    expect(listing.salary).toContain("80,000")
  })

  test("maps an Indeed result to JobListing", () => {
    const raw = {
      title: "Python Developer",
      company_name: "BigCo",
      location: "Manchester",
      job_url: "https://uk.indeed.com/viewjob?jk=abc123xyz",
      date_posted: "2026-03-30",
      job_type: null,
      min_amount: null,
      max_amount: null,
      currency: null,
      is_remote: true,
      description: "A Python role",
    }
    const listing = mapJobSpyResult(raw, "indeed")
    expect(listing.id).toBe("abc123xyz")
    expect(listing.source).toBe("indeed")
    expect(listing.salary).toBeNull()
  })

  test("extracts ID from LinkedIn URL", () => {
    const raw = {
      title: "Test",
      company_name: "Test",
      location: "Test",
      job_url: "https://www.linkedin.com/jobs/view/9999999999",
      date_posted: null,
      job_type: null,
      min_amount: null,
      max_amount: null,
      currency: null,
      is_remote: false,
      description: "",
    }
    const listing = mapJobSpyResult(raw, "linkedin")
    expect(listing.id).toBe("9999999999")
  })

  test("falls back to full URL as ID when no pattern matches", () => {
    const raw = {
      title: "Test",
      company_name: "Test",
      location: "Test",
      job_url: "https://example.com/some-job",
      date_posted: null,
      job_type: null,
      min_amount: null,
      max_amount: null,
      currency: null,
      is_remote: false,
      description: "",
    }
    const listing = mapJobSpyResult(raw, "linkedin")
    expect(listing.id).toBe("https://example.com/some-job")
  })
})

describe("mapJobSpyToDetail", () => {
  test("maps a full result to JobDetail", () => {
    const raw = {
      title: "Senior Data Engineer",
      company_name: "Acme Corp",
      location: "London",
      job_url: "https://www.linkedin.com/jobs/view/12345",
      date_posted: "2026-03-28",
      job_type: "fulltime",
      min_amount: 60000,
      max_amount: 80000,
      currency: "GBP",
      is_remote: true,
      description: "<p>We need a senior engineer</p>",
      company_url: "https://acme.com",
      logo_photo_url: "https://acme.com/logo.png",
    }
    const detail = mapJobSpyToDetail(raw, "linkedin")
    expect(detail.description).toBe("<p>We need a senior engineer</p>")
    expect(detail.remote).toBe("remote")
    expect(detail.companyInfo.name).toBe("Acme Corp")
    expect(detail.companyInfo.url).toBe("https://acme.com")
    expect(detail.companyInfo.logo).toBe("https://acme.com/logo.png")
    expect(detail.employmentType).toContain("FULL_TIME")
  })
})

describe("buildSearchParams", () => {
  test("builds params for LinkedIn search", () => {
    const params = buildSearchParams({
      site: "linkedin",
      keywords: "data engineer",
      location: "London",
      limit: 25,
    })
    expect(params.get("site_name")).toBe("linkedin")
    expect(params.get("search_term")).toBe("data engineer")
    expect(params.get("location")).toBe("London")
    expect(params.get("results_wanted")).toBe("25")
    expect(params.get("linkedin_fetch_description")).toBe("true")
  })

  test("builds params for Indeed search with UK country", () => {
    const params = buildSearchParams({
      site: "indeed",
      keywords: "developer",
      location: "Manchester",
      limit: 10,
    })
    expect(params.get("site_name")).toBe("indeed")
    expect(params.get("country_indeed")).toBe("UK")
  })

  test("includes job type when provided", () => {
    const params = buildSearchParams({
      site: "linkedin",
      keywords: "test",
      jobType: "fulltime",
      limit: 10,
    })
    expect(params.get("job_type")).toBe("fulltime")
  })

  test("includes remote flag", () => {
    const params = buildSearchParams({
      site: "indeed",
      keywords: "test",
      isRemote: true,
      limit: 10,
    })
    expect(params.get("is_remote")).toBe("true")
  })

  test("includes hours_old for date filter", () => {
    const params = buildSearchParams({
      site: "linkedin",
      keywords: "test",
      hoursOld: 24,
      limit: 10,
    })
    expect(params.get("hours_old")).toBe("24")
  })

  test("includes distance when provided", () => {
    const params = buildSearchParams({
      site: "linkedin",
      keywords: "test",
      distance: 25,
      limit: 10,
    })
    expect(params.get("distance")).toBe("25")
  })
})

describe("getLinkedInCookie", () => {
  test("returns null when no cookies file exists", () => {
    const cookie = getLinkedInCookie("/tmp/nonexistent-config-dir-12345")
    expect(cookie).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd .agents/skills/shared/cli && bun test tests/jobspy-client.test.ts
```

Expected: FAIL — imports not found

- [ ] **Step 3: Write jobspy-client.ts**

Create `.agents/skills/shared/cli/src/jobspy-client.ts`:

```typescript
import { getServiceUrl } from "./docker.js"
import { loadCookies } from "./browser.js"
import type { JobListing, JobDetail } from "./types.js"

// --- JobSpy response types ---

export interface JobSpyResult {
  title: string
  company_name: string
  location: string
  job_url: string
  date_posted: string | null
  job_type: string | null
  min_amount: number | null
  max_amount: number | null
  currency: string | null
  is_remote: boolean
  description: string
  company_url?: string | null
  logo_photo_url?: string | null
}

// --- ID extraction ---

function extractIdFromUrl(url: string, source: "linkedin" | "indeed"): string {
  if (source === "linkedin") {
    const match = url.match(/\/jobs\/view\/(\d+)/)
    if (match) return match[1]
  }
  if (source === "indeed") {
    const match = url.match(/jk=([a-zA-Z0-9]+)/)
    if (match) return match[1]
  }
  return url
}

// --- Salary formatting ---

function formatSalary(raw: JobSpyResult): string | null {
  if (raw.min_amount == null && raw.max_amount == null) return null
  const currency = raw.currency === "GBP" ? "\u00a3" : raw.currency === "USD" ? "$" : (raw.currency ?? "")
  if (raw.min_amount != null && raw.max_amount != null) {
    return `${currency}${raw.min_amount.toLocaleString()} - ${currency}${raw.max_amount.toLocaleString()}`
  }
  if (raw.min_amount != null) {
    return `${currency}${raw.min_amount.toLocaleString()}`
  }
  return `${currency}${raw.max_amount!.toLocaleString()}`
}

// --- Job type mapping ---

const JOB_TYPE_MAP: Record<string, string> = {
  fulltime: "FULL_TIME",
  parttime: "PART_TIME",
  contract: "CONTRACT",
  internship: "INTERNSHIP",
  temporary: "TEMPORARY",
}

// --- Result mapping ---

export function mapJobSpyResult(raw: JobSpyResult, source: "linkedin" | "indeed"): JobListing {
  return {
    id: extractIdFromUrl(raw.job_url, source),
    title: raw.title,
    company: raw.company_name,
    location: raw.location,
    jobType: raw.job_type ?? null,
    salary: formatSalary(raw),
    url: raw.job_url,
    posted: raw.date_posted ?? null,
    deadline: null,
    source,
  }
}

export function mapJobSpyToDetail(raw: JobSpyResult, source: "linkedin" | "indeed"): JobDetail {
  const listing = mapJobSpyResult(raw, source)
  return {
    ...listing,
    description: raw.description,
    employmentType: raw.job_type && JOB_TYPE_MAP[raw.job_type] ? [JOB_TYPE_MAP[raw.job_type]] : [],
    remote: raw.is_remote ? "remote" : null,
    companyInfo: {
      name: raw.company_name,
      logo: raw.logo_photo_url ?? null,
      url: raw.company_url ?? null,
    },
    requirements: null,
  }
}

// --- Search params builder ---

export interface JobSpySearchInput {
  site: "linkedin" | "indeed"
  keywords?: string | null
  location?: string | null
  distance?: number | null
  jobType?: string | null
  isRemote?: boolean | null
  hoursOld?: number | null
  limit?: number
  linkedInCookie?: string | null
}

export function buildSearchParams(input: JobSpySearchInput): URLSearchParams {
  const params = new URLSearchParams()
  params.set("site_name", input.site)
  if (input.keywords) params.set("search_term", input.keywords)
  if (input.location) params.set("location", input.location)
  if (input.distance != null) params.set("distance", String(input.distance))
  if (input.jobType) params.set("job_type", input.jobType)
  if (input.isRemote) params.set("is_remote", "true")
  if (input.hoursOld != null) params.set("hours_old", String(input.hoursOld))
  params.set("results_wanted", String(input.limit ?? 25))

  if (input.site === "linkedin") {
    params.set("linkedin_fetch_description", "true")
    if (input.linkedInCookie) params.set("linkedin_cookie", input.linkedInCookie)
  }

  if (input.site === "indeed") {
    params.set("country_indeed", "UK")
  }

  return params
}

// --- API calls ---

export async function isServiceAvailable(): Promise<boolean> {
  try {
    const resp = await fetch(`${getServiceUrl()}/docs`, { signal: AbortSignal.timeout(3000) })
    return resp.ok
  } catch {
    return false
  }
}

export async function searchJobs(input: JobSpySearchInput): Promise<{ results: JobListing[]; raw: JobSpyResult[] }> {
  const params = buildSearchParams(input)
  const url = `${getServiceUrl()}/api/v1/search_jobs?${params.toString()}`

  const resp = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!resp.ok) {
    throw new Error(`jobspy-api returned ${resp.status}: ${await resp.text()}`)
  }

  const data = await resp.json() as JobSpyResult[]
  const results = data.map((r) => mapJobSpyResult(r, input.site))
  return { results, raw: data }
}

export function getLinkedInCookie(baseDir?: string): string | null {
  const cookies = loadCookies("linkedin", baseDir)
  const liAt = cookies.find((c) => c.name === "li_at")
  return liAt?.value ?? null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd .agents/skills/shared/cli && bun test tests/jobspy-client.test.ts
```

Expected: 11 tests pass

- [ ] **Step 5: Commit**

```bash
git add .agents/skills/shared/cli/src/jobspy-client.ts .agents/skills/shared/cli/tests/jobspy-client.test.ts
git commit -m "feat: add jobspy-api HTTP client with result mapping"
```

---

### Task 3: Update shared index.ts and package.json exports

**Files:**
- Modify: `.agents/skills/shared/cli/src/index.ts`
- Modify: `.agents/skills/shared/cli/package.json`

- [ ] **Step 1: Update index.ts to export new modules**

In `.agents/skills/shared/cli/src/index.ts`, append after the existing browser exports:

```typescript
export {
  isDockerAvailable,
  isContainerRunning,
  startService,
  stopService,
  ensureServiceRunning,
  getServiceUrl,
  getComposePath,
} from "./docker.js"

export {
  searchJobs,
  isServiceAvailable,
  getLinkedInCookie,
  mapJobSpyResult,
  mapJobSpyToDetail,
  buildSearchParams,
  type JobSpyResult,
  type JobSpySearchInput,
} from "./jobspy-client.js"
```

- [ ] **Step 2: Update package.json exports**

In `.agents/skills/shared/cli/package.json`, add to the `"exports"` object:

```json
"./docker": "./src/docker.ts",
"./jobspy-client": "./src/jobspy-client.ts"
```

The full exports section should be:

```json
"exports": {
  ".": "./src/index.ts",
  "./types": "./src/types.ts",
  "./browser": "./src/browser.ts",
  "./formatting": "./src/formatting.ts",
  "./docker": "./src/docker.ts",
  "./jobspy-client": "./src/jobspy-client.ts"
}
```

- [ ] **Step 3: Run all shared tests to verify nothing broke**

```bash
cd .agents/skills/shared/cli && bun test
```

Expected: All tests pass (types + formatting + browser + docker + jobspy-client)

- [ ] **Step 4: Commit**

```bash
git add .agents/skills/shared/cli/src/index.ts .agents/skills/shared/cli/package.json
git commit -m "feat: export docker and jobspy-client modules from shared core"
```

---

### Task 4: Create LinkedIn setup command and update cli.ts

**Files:**
- Create: `.agents/skills/linkedin-search/cli/src/commands/setup.ts`
- Modify: `.agents/skills/linkedin-search/cli/src/cli.ts`

- [ ] **Step 1: Write setup command**

Create `.agents/skills/linkedin-search/cli/src/commands/setup.ts`:

```typescript
import { defineCommand } from "@bunli/core"
import { isDockerAvailable, isContainerRunning, startService, getServiceUrl } from "job-search-shared/docker"
import { writeError } from "job-search-shared/formatting"

export const setup = defineCommand({
  name: "setup",
  description: "Start the jobspy-api Docker container for job searching",
  handler: async () => {
    if (!(await isDockerAvailable())) {
      writeError(
        "Docker is not installed. Install Docker from https://docs.docker.com/get-docker/",
        "DOCKER_NOT_FOUND"
      )
      process.exit(1)
    }

    if (await isContainerRunning()) {
      console.log(`jobspy-api is already running at ${getServiceUrl()}`)
      return
    }

    console.log("Starting jobspy-api container...")
    const result = await startService()

    if (!result.ok) {
      writeError(result.error ?? "Failed to start jobspy-api", "SETUP_FAILED")
      process.exit(1)
    }

    console.log(`jobspy-api is running at ${getServiceUrl()}`)
  },
})
```

- [ ] **Step 2: Update cli.ts to register setup command**

Replace `.agents/skills/linkedin-search/cli/src/cli.ts` with:

```typescript
import { createCLI } from "@bunli/core"
import { setup } from "./commands/setup.js"
import { login } from "./commands/login.js"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"

const cli = await createCLI({
  name: "linkedin-search",
  version: "1.0.0",
  description: "Search UK job listings on LinkedIn with authenticated browser sessions",
})

cli.command(setup)
cli.command(login)
cli.command(search)
cli.command(detail)

await cli.run()
```

- [ ] **Step 3: Reinstall to pick up new shared exports**

```bash
cd .agents/skills/linkedin-search/cli && bun install
```

- [ ] **Step 4: Verify setup --help works**

```bash
cd .agents/skills/linkedin-search/cli && bun run src/cli.ts setup --help
```

Expected: Prints setup command help text

- [ ] **Step 5: Commit**

```bash
git add .agents/skills/linkedin-search/cli/src/commands/setup.ts .agents/skills/linkedin-search/cli/src/cli.ts
git commit -m "feat: add LinkedIn setup command for jobspy-api Docker container"
```

---

### Task 5: Modify LinkedIn search command with jobspy-api + fallback

**Files:**
- Modify: `.agents/skills/linkedin-search/cli/src/commands/search.ts`

- [ ] **Step 1: Rewrite search.ts with jobspy-api primary and Playwright fallback**

Replace `.agents/skills/linkedin-search/cli/src/commands/search.ts` with:

```typescript
import { z } from "zod"
import { defineCommand, option } from "@bunli/core"
import { launchBrowser, newPage, saveCookies } from "job-search-shared/browser"
import { formatOutput, writeError } from "job-search-shared/formatting"
import { ensureServiceRunning } from "job-search-shared/docker"
import { searchJobs, getLinkedInCookie } from "job-search-shared/jobspy-client"
import type { SearchResponse } from "job-search-shared/types"
import { buildSearchUrl, scrapeSearchResults, isLoginPage } from "../scraper.js"

const SINCE_TO_HOURS: Record<string, number> = {
  "past-24h": 24,
  "past-week": 168,
  "past-month": 720,
}

const JOB_TYPE_TO_JOBSPY: Record<string, string> = {
  "full-time": "fulltime",
  "part-time": "parttime",
  "contract": "contract",
  "permanent": "fulltime",
  "internship": "internship",
  "volunteer": "volunteer",
}

export const search = defineCommand({
  name: "search",
  description: "Search LinkedIn job listings",
  options: {
    keywords: option(z.string().optional(), { description: "Search terms (job title, skill, company)" }),
    location: option(z.string().default("United Kingdom"), { description: "Location filter" }),
    radius: option(z.coerce.number().optional(), { description: "Radius in miles" }),
    type: option(z.string().optional(), { description: "Job type: full-time, part-time, contract, permanent, internship, volunteer" }),
    remote: option(z.string().optional(), { description: "Remote filter: on-site, remote, hybrid" }),
    experience: option(z.string().optional(), { description: "Experience: internship, entry, associate, mid-senior, director, executive" }),
    salary: option(z.string().optional(), { description: "Salary range filter" }),
    since: option(z.string().optional(), { description: "Date posted: past-24h, past-week, past-month" }),
    limit: option(z.coerce.number().default(25), { description: "Max results to return" }),
    format: option(z.enum(["json", "table", "plain"]).default("json"), { description: "Output format" }),
  },
  handler: async ({ flags }) => {
    // Try jobspy-api first
    const jobspyResult = await tryJobSpySearch(flags)
    if (jobspyResult) {
      process.stdout.write(formatOutput(jobspyResult, flags.format) + "\n")
      return
    }

    // Fallback to Playwright
    process.stderr.write(JSON.stringify({ warning: "jobspy-api unavailable, using Playwright fallback" }) + "\n")
    await playwrightSearch(flags)
  },
})

async function tryJobSpySearch(flags: Record<string, any>): Promise<SearchResponse | null> {
  try {
    const serviceResult = await ensureServiceRunning()
    if (!serviceResult.ok) return null

    const linkedInCookie = getLinkedInCookie()

    const { results } = await searchJobs({
      site: "linkedin",
      keywords: flags.keywords ?? null,
      location: flags.location,
      distance: flags.radius ?? null,
      jobType: flags.type ? JOB_TYPE_TO_JOBSPY[flags.type] ?? flags.type : null,
      isRemote: flags.remote === "remote" ? true : null,
      hoursOld: flags.since ? SINCE_TO_HOURS[flags.since] ?? null : null,
      limit: flags.limit,
      linkedInCookie,
    })

    return { meta: { total: results.length }, results }
  } catch {
    return null
  }
}

async function playwrightSearch(flags: Record<string, any>): Promise<void> {
  const browser = await launchBrowser()

  try {
    const page = await newPage(browser, "linkedin")

    const url = buildSearchUrl({
      keywords: flags.keywords ?? null,
      location: flags.location,
      radius: flags.radius ?? null,
      jobType: flags.type ?? null,
      remote: flags.remote ?? null,
      experienceLevel: flags.experience ?? null,
      salary: flags.salary ?? null,
      since: flags.since ?? null,
    })

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })

    if (isLoginPage(page.url())) {
      writeError("LinkedIn session expired. Please run 'login' first.", "AUTH_REQUIRED")
      process.exit(1)
    }

    try {
      await page.waitForSelector(
        ".job-card-container, .jobs-search-results__list-item",
        { timeout: 10_000 }
      )
    } catch {
      const response: SearchResponse = { meta: { total: 0 }, results: [] }
      process.stdout.write(formatOutput(response, flags.format) + "\n")
      return
    }

    const total = await page.$eval(
      ".jobs-search-results-list__subtitle, .jobs-search-results-list__title-heading small",
      (el) => {
        const text = el.textContent ?? ""
        const match = text.replace(/,/g, "").match(/(\d+)/)
        return match ? parseInt(match[1], 10) : 0
      }
    ).catch(() => 0)

    const results = await scrapeSearchResults(page, flags.limit)
    await saveCookies(page, "linkedin")

    const response: SearchResponse = { meta: { total }, results }
    process.stdout.write(formatOutput(response, flags.format) + "\n")
  } catch (error) {
    writeError(
      error instanceof Error ? error.message : "Search failed",
      "SEARCH_FAILED"
    )
    process.exit(1)
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 2: Run existing LinkedIn tests to verify nothing broke**

```bash
cd .agents/skills/linkedin-search/cli && bun test
```

Expected: All existing tests still pass (scraper tests + CLI smoke tests)

- [ ] **Step 3: Commit**

```bash
git add .agents/skills/linkedin-search/cli/src/commands/search.ts
git commit -m "feat: LinkedIn search uses jobspy-api with Playwright fallback"
```

---

### Task 6: Modify LinkedIn detail command with jobspy-api + fallback

**Files:**
- Modify: `.agents/skills/linkedin-search/cli/src/commands/detail.ts`

- [ ] **Step 1: Rewrite detail.ts with jobspy-api primary and Playwright fallback**

Replace `.agents/skills/linkedin-search/cli/src/commands/detail.ts` with:

```typescript
import { z } from "zod"
import { defineCommand, option } from "@bunli/core"
import { launchBrowser, newPage, saveCookies } from "job-search-shared/browser"
import { formatOutput, writeError } from "job-search-shared/formatting"
import { ensureServiceRunning } from "job-search-shared/docker"
import { searchJobs, getLinkedInCookie, mapJobSpyToDetail } from "job-search-shared/jobspy-client"
import type { JobDetail } from "job-search-shared/types"
import { scrapeJobDetail, isLoginPage } from "../scraper.js"

export const detail = defineCommand({
  name: "detail",
  description: "Get full details for a LinkedIn job posting",
  options: {
    format: option(z.enum(["json", "table", "plain"]).default("json"), { description: "Output format" }),
  },
  handler: async ({ flags, positional }) => {
    const idOrUrl = positional[0]
    if (!idOrUrl) {
      writeError("Please provide a job ID or URL", "MISSING_ARGUMENT")
      process.exit(1)
    }

    let jobUrl: string
    if (idOrUrl.startsWith("http")) {
      jobUrl = idOrUrl
    } else {
      jobUrl = `https://www.linkedin.com/jobs/view/${idOrUrl}/`
    }

    const idMatch = jobUrl.match(/\/jobs\/view\/(\d+)/)
    const jobId = idMatch?.[1] ?? idOrUrl

    // Try jobspy-api first — search for this specific job
    const jobspyResult = await tryJobSpyDetail(jobId)
    if (jobspyResult) {
      process.stdout.write(formatOutput(jobspyResult, flags.format) + "\n")
      return
    }

    // Fallback to Playwright
    process.stderr.write(JSON.stringify({ warning: "jobspy-api unavailable, using Playwright fallback" }) + "\n")
    await playwrightDetail(jobUrl, jobId, flags.format)
  },
})

async function tryJobSpyDetail(jobId: string): Promise<JobDetail | null> {
  try {
    const serviceResult = await ensureServiceRunning()
    if (!serviceResult.ok) return null

    const linkedInCookie = getLinkedInCookie()

    // Search with the job ID as keyword — jobspy-api doesn't have a get-by-ID endpoint
    const { raw } = await searchJobs({
      site: "linkedin",
      keywords: jobId,
      limit: 5,
      linkedInCookie,
    })

    // Find the matching job in results
    const match = raw.find((r) => r.job_url.includes(jobId))
    if (!match) return null

    return mapJobSpyToDetail(match, "linkedin")
  } catch {
    return null
  }
}

async function playwrightDetail(jobUrl: string, jobId: string, format: "json" | "table" | "plain"): Promise<void> {
  const browser = await launchBrowser()

  try {
    const page = await newPage(browser, "linkedin")
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })

    if (isLoginPage(page.url())) {
      writeError("LinkedIn session expired. Please run 'login' first.", "AUTH_REQUIRED")
      process.exit(1)
    }

    try {
      await page.waitForSelector(
        ".jobs-description__content, .jobs-description-content__text, #job-details",
        { timeout: 10_000 }
      )
    } catch {
      writeError("Could not load job details. The page structure may have changed.", "SCRAPE_FAILED")
      process.exit(1)
    }

    const scraped = await scrapeJobDetail(page)

    if (!scraped) {
      writeError("Failed to extract job details from the page.", "SCRAPE_FAILED")
      process.exit(1)
    }

    await saveCookies(page, "linkedin")

    const jobDetail: JobDetail = {
      ...scraped,
      id: jobId,
      url: jobUrl,
      source: "linkedin",
    }

    process.stdout.write(formatOutput(jobDetail, format) + "\n")
  } catch (error) {
    writeError(
      error instanceof Error ? error.message : "Detail fetch failed",
      "DETAIL_FAILED"
    )
    process.exit(1)
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 2: Run LinkedIn tests**

```bash
cd .agents/skills/linkedin-search/cli && bun test
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add .agents/skills/linkedin-search/cli/src/commands/detail.ts
git commit -m "feat: LinkedIn detail uses jobspy-api with Playwright fallback"
```

---

### Task 7: Create Indeed setup command and update cli.ts

**Files:**
- Create: `.agents/skills/indeed-search/cli/src/commands/setup.ts`
- Modify: `.agents/skills/indeed-search/cli/src/cli.ts`

- [ ] **Step 1: Write setup command**

Create `.agents/skills/indeed-search/cli/src/commands/setup.ts`:

```typescript
import { defineCommand } from "@bunli/core"
import { isDockerAvailable, isContainerRunning, startService, getServiceUrl } from "job-search-shared/docker"
import { writeError } from "job-search-shared/formatting"

export const setup = defineCommand({
  name: "setup",
  description: "Start the jobspy-api Docker container for job searching",
  handler: async () => {
    if (!(await isDockerAvailable())) {
      writeError(
        "Docker is not installed. Install Docker from https://docs.docker.com/get-docker/",
        "DOCKER_NOT_FOUND"
      )
      process.exit(1)
    }

    if (await isContainerRunning()) {
      console.log(`jobspy-api is already running at ${getServiceUrl()}`)
      return
    }

    console.log("Starting jobspy-api container...")
    const result = await startService()

    if (!result.ok) {
      writeError(result.error ?? "Failed to start jobspy-api", "SETUP_FAILED")
      process.exit(1)
    }

    console.log(`jobspy-api is running at ${getServiceUrl()}`)
  },
})
```

- [ ] **Step 2: Update cli.ts to register setup command**

Replace `.agents/skills/indeed-search/cli/src/cli.ts` with:

```typescript
import { createCLI } from "@bunli/core"
import { setup } from "./commands/setup.js"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"

const cli = await createCLI({
  name: "indeed-search",
  version: "1.0.0",
  description: "Search UK job listings on Indeed (uk.indeed.com)",
})

cli.command(setup)
cli.command(search)
cli.command(detail)

await cli.run()
```

- [ ] **Step 3: Reinstall to pick up new shared exports**

```bash
cd .agents/skills/indeed-search/cli && bun install
```

- [ ] **Step 4: Commit**

```bash
git add .agents/skills/indeed-search/cli/src/commands/setup.ts .agents/skills/indeed-search/cli/src/cli.ts
git commit -m "feat: add Indeed setup command for jobspy-api Docker container"
```

---

### Task 8: Modify Indeed search command with jobspy-api + fallback

**Files:**
- Modify: `.agents/skills/indeed-search/cli/src/commands/search.ts`

- [ ] **Step 1: Rewrite search.ts with jobspy-api primary and Playwright fallback**

Replace `.agents/skills/indeed-search/cli/src/commands/search.ts` with:

```typescript
import { z } from "zod"
import { defineCommand, option } from "@bunli/core"
import { launchBrowser, newPage, randomDelay } from "job-search-shared/browser"
import { formatOutput, writeError } from "job-search-shared/formatting"
import { ensureServiceRunning } from "job-search-shared/docker"
import { searchJobs } from "job-search-shared/jobspy-client"
import type { JobListing, SearchResponse } from "job-search-shared/types"
import { buildSearchUrl, scrapeSearchResults } from "../scraper.js"

const SINCE_TO_HOURS: Record<string, number> = {
  "last-24h": 24,
  "last-3d": 72,
  "last-7d": 168,
  "last-14d": 336,
}

const JOB_TYPE_TO_JOBSPY: Record<string, string> = {
  "full-time": "fulltime",
  "part-time": "parttime",
  "contract": "contract",
  "permanent": "fulltime",
  "temporary": "temporary",
  "apprenticeship": "internship",
}

export const search = defineCommand({
  name: "search",
  description: "Search Indeed UK job listings",
  options: {
    keywords: option(z.string().optional(), { description: "Search terms (job title, skill, company)" }),
    location: option(z.string().default("United Kingdom"), { description: "Location filter" }),
    radius: option(z.coerce.number().optional(), { description: "Radius in miles" }),
    type: option(z.string().optional(), { description: "Job type: full-time, part-time, contract, permanent, temporary, apprenticeship" }),
    remote: option(z.boolean().default(false), { description: "Remote jobs only", short: "r" }),
    salary: option(z.string().optional(), { description: "Minimum salary filter" }),
    since: option(z.string().optional(), { description: "Date posted: last-24h, last-3d, last-7d, last-14d" }),
    experience: option(z.string().optional(), { description: "Experience level filter" }),
    limit: option(z.coerce.number().default(25), { description: "Max results to return" }),
    format: option(z.enum(["json", "table", "plain"]).default("json"), { description: "Output format" }),
  },
  handler: async ({ flags }) => {
    // Try jobspy-api first
    const jobspyResult = await tryJobSpySearch(flags)
    if (jobspyResult) {
      process.stdout.write(formatOutput(jobspyResult, flags.format) + "\n")
      return
    }

    // Fallback to Playwright
    process.stderr.write(JSON.stringify({ warning: "jobspy-api unavailable, using Playwright fallback" }) + "\n")
    await playwrightSearch(flags)
  },
})

async function tryJobSpySearch(flags: Record<string, any>): Promise<SearchResponse | null> {
  try {
    const serviceResult = await ensureServiceRunning()
    if (!serviceResult.ok) return null

    const { results } = await searchJobs({
      site: "indeed",
      keywords: flags.keywords ?? null,
      location: flags.location,
      distance: flags.radius ?? null,
      jobType: flags.type ? JOB_TYPE_TO_JOBSPY[flags.type] ?? flags.type : null,
      isRemote: flags.remote || null,
      hoursOld: flags.since ? SINCE_TO_HOURS[flags.since] ?? null : null,
      limit: flags.limit,
    })

    return { meta: { total: results.length }, results }
  } catch {
    return null
  }
}

async function playwrightSearch(flags: Record<string, any>): Promise<void> {
  const browser = await launchBrowser()

  try {
    const page = await newPage(browser, "indeed")
    const allResults: JobListing[] = []
    let totalCount = 0
    let start = 0

    while (allResults.length < flags.limit) {
      const url = buildSearchUrl({
        keywords: flags.keywords ?? null,
        location: flags.location,
        radius: flags.radius ?? null,
        jobType: flags.type ?? null,
        remote: flags.remote || null,
        salary: flags.salary ?? null,
        since: flags.since ?? null,
        start,
      })

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })

      try {
        await page.waitForSelector(
          ".job_seen_beacon, .resultContent, [data-jk]",
          { timeout: 10_000 }
        )
      } catch {
        break
      }

      const { total, results } = await scrapeSearchResults(page, flags.limit - allResults.length)

      if (start === 0) totalCount = total
      if (results.length === 0) break

      allResults.push(...results)
      start += results.length

      if (allResults.length < flags.limit) {
        await randomDelay(800, 1500)
      }
    }

    const response: SearchResponse = {
      meta: { total: totalCount },
      results: allResults.slice(0, flags.limit),
    }
    process.stdout.write(formatOutput(response, flags.format) + "\n")
  } catch (error) {
    writeError(
      error instanceof Error ? error.message : "Search failed",
      "SEARCH_FAILED"
    )
    process.exit(1)
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 2: Run Indeed tests**

```bash
cd .agents/skills/indeed-search/cli && bun test
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add .agents/skills/indeed-search/cli/src/commands/search.ts
git commit -m "feat: Indeed search uses jobspy-api with Playwright fallback"
```

---

### Task 9: Modify Indeed detail command with jobspy-api + fallback

**Files:**
- Modify: `.agents/skills/indeed-search/cli/src/commands/detail.ts`

- [ ] **Step 1: Rewrite detail.ts with jobspy-api primary and Playwright fallback**

Replace `.agents/skills/indeed-search/cli/src/commands/detail.ts` with:

```typescript
import { z } from "zod"
import { defineCommand, option } from "@bunli/core"
import { launchBrowser, newPage } from "job-search-shared/browser"
import { formatOutput, writeError } from "job-search-shared/formatting"
import { ensureServiceRunning } from "job-search-shared/docker"
import { searchJobs, mapJobSpyToDetail } from "job-search-shared/jobspy-client"
import type { JobDetail } from "job-search-shared/types"
import { scrapeJobDetail } from "../scraper.js"

export const detail = defineCommand({
  name: "detail",
  description: "Get full details for an Indeed UK job posting",
  options: {
    format: option(z.enum(["json", "table", "plain"]).default("json"), { description: "Output format" }),
  },
  handler: async ({ flags, positional }) => {
    const idOrUrl = positional[0]
    if (!idOrUrl) {
      writeError("Please provide a job ID (jk) or URL", "MISSING_ARGUMENT")
      process.exit(1)
    }

    let jobUrl: string
    let jobId: string
    if (idOrUrl.startsWith("http")) {
      jobUrl = idOrUrl
      const match = idOrUrl.match(/jk=([a-zA-Z0-9]+)/)
      jobId = match?.[1] ?? idOrUrl
    } else {
      jobId = idOrUrl
      jobUrl = `https://uk.indeed.com/viewjob?jk=${idOrUrl}`
    }

    // Try jobspy-api first
    const jobspyResult = await tryJobSpyDetail(jobId)
    if (jobspyResult) {
      process.stdout.write(formatOutput(jobspyResult, flags.format) + "\n")
      return
    }

    // Fallback to Playwright
    process.stderr.write(JSON.stringify({ warning: "jobspy-api unavailable, using Playwright fallback" }) + "\n")
    await playwrightDetail(jobUrl, jobId, flags.format)
  },
})

async function tryJobSpyDetail(jobId: string): Promise<JobDetail | null> {
  try {
    const serviceResult = await ensureServiceRunning()
    if (!serviceResult.ok) return null

    const { raw } = await searchJobs({
      site: "indeed",
      keywords: jobId,
      limit: 5,
    })

    const match = raw.find((r) => r.job_url.includes(jobId))
    if (!match) return null

    return mapJobSpyToDetail(match, "indeed")
  } catch {
    return null
  }
}

async function playwrightDetail(jobUrl: string, jobId: string, format: "json" | "table" | "plain"): Promise<void> {
  const browser = await launchBrowser()

  try {
    const page = await newPage(browser, "indeed")
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })

    try {
      await page.waitForSelector(
        "#jobDescriptionText, .jobsearch-jobDescriptionText, [data-testid='jobsearch-JobInfoHeader-title']",
        { timeout: 10_000 }
      )
    } catch {
      writeError("Could not load job details. The page structure may have changed.", "SCRAPE_FAILED")
      process.exit(1)
    }

    const scraped = await scrapeJobDetail(page)

    if (!scraped) {
      writeError("Failed to extract job details from the page.", "SCRAPE_FAILED")
      process.exit(1)
    }

    const jobDetail: JobDetail = {
      ...scraped,
      id: jobId,
      url: jobUrl,
      source: "indeed",
    }

    process.stdout.write(formatOutput(jobDetail, format) + "\n")
  } catch (error) {
    writeError(
      error instanceof Error ? error.message : "Detail fetch failed",
      "DETAIL_FAILED"
    )
    process.exit(1)
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 2: Run Indeed tests**

```bash
cd .agents/skills/indeed-search/cli && bun test
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add .agents/skills/indeed-search/cli/src/commands/detail.ts
git commit -m "feat: Indeed detail uses jobspy-api with Playwright fallback"
```

---

### Task 10: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Run all shared tests**

```bash
cd .agents/skills/shared/cli && bun test
```

Expected: All tests pass (types + formatting + browser + docker + jobspy-client)

- [ ] **Step 2: Run all LinkedIn tests**

```bash
cd .agents/skills/linkedin-search/cli && bun test
```

Expected: All tests pass

- [ ] **Step 3: Run all Indeed tests**

```bash
cd .agents/skills/indeed-search/cli && bun test
```

Expected: All tests pass

- [ ] **Step 4: Verify setup --help works for both skills**

```bash
cd .agents/skills/linkedin-search/cli && bun run src/cli.ts setup --help
cd .agents/skills/indeed-search/cli && bun run src/cli.ts setup --help
```

Expected: Both print setup command help

- [ ] **Step 5: Verify new files are in the right places**

```bash
find .agents/skills -type f \( -name "*.ts" -o -name "*.json" -o -name "*.yml" -o -name "*.md" \) | grep -v node_modules | sort
```

Expected: docker-compose.yml, docker.ts, jobspy-client.ts, setup.ts (x2) all present alongside existing files

- [ ] **Step 6: Final commit if any uncommitted changes**

```bash
git status
```

If clean, done. Otherwise:

```bash
git add -A .agents/skills/
git commit -m "chore: final verification for jobspy-api integration"
```
