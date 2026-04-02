# UK Job Search Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Danish job board skills with LinkedIn UK and Indeed UK Playwright-based scrapers, plus a shared browser/output library.

**Architecture:** Three packages under `.agents/skills/` — `shared/cli` (Playwright browser management, types, formatting), `linkedin-search/cli` (authenticated LinkedIn scraping), `indeed-search/cli` (Indeed UK scraping). Each skill CLI uses `@bunli/core` for command definitions and `@bunli/utils` for XDG config paths. Shared lib is a local workspace dependency.

**Tech Stack:** Bun, TypeScript, Playwright (Chromium), `@bunli/core`, `@bunli/utils`, `zod`

---

## File Structure

### Shared Core
- **Create:** `.agents/skills/shared/cli/package.json` — Package manifest; depends on playwright, zod, @bunli/utils
- **Create:** `.agents/skills/shared/cli/src/types.ts` — `JobListing`, `JobDetail`, `SearchFilters` interfaces + Zod schemas
- **Create:** `.agents/skills/shared/cli/src/browser.ts` — Playwright browser launch, cookie persistence, stealth, page factory
- **Create:** `.agents/skills/shared/cli/src/formatting.ts` — `formatOutput()` (json/table/plain), `writeError()`
- **Create:** `.agents/skills/shared/cli/tests/helpers.ts` — Test utilities (CLIResult, runCLI, parseJSON)

### LinkedIn Skill
- **Create:** `.agents/skills/linkedin-search/SKILL.md` — Skill definition with trigger phrases
- **Create:** `.agents/skills/linkedin-search/cli/package.json` — Package manifest; depends on shared/cli, @bunli/core
- **Create:** `.agents/skills/linkedin-search/cli/src/cli.ts` — CLI entry point (createCLI + register commands)
- **Create:** `.agents/skills/linkedin-search/cli/src/scraper.ts` — LinkedIn DOM selectors and extraction functions
- **Create:** `.agents/skills/linkedin-search/cli/src/commands/login.ts` — LinkedIn login command (headed browser, save cookies)
- **Create:** `.agents/skills/linkedin-search/cli/src/commands/search.ts` — LinkedIn job search command
- **Create:** `.agents/skills/linkedin-search/cli/src/commands/detail.ts` — LinkedIn job detail command
- **Create:** `.agents/skills/linkedin-search/cli/tests/helpers.ts` — Test runner for linkedin CLI

### Indeed Skill
- **Create:** `.agents/skills/indeed-search/SKILL.md` — Skill definition with trigger phrases
- **Create:** `.agents/skills/indeed-search/cli/package.json` — Package manifest; depends on shared/cli, @bunli/core
- **Create:** `.agents/skills/indeed-search/cli/src/cli.ts` — CLI entry point (createCLI + register commands)
- **Create:** `.agents/skills/indeed-search/cli/src/scraper.ts` — Indeed DOM selectors and extraction functions
- **Create:** `.agents/skills/indeed-search/cli/src/commands/search.ts` — Indeed job search command
- **Create:** `.agents/skills/indeed-search/cli/src/commands/detail.ts` — Indeed job detail command
- **Create:** `.agents/skills/indeed-search/cli/tests/helpers.ts` — Test runner for indeed CLI

### Cleanup
- **Delete:** `.agents/skills/jobbank-search/` — entire directory
- **Delete:** `.agents/skills/jobdanmark-search/` — entire directory
- **Delete:** `.agents/skills/jobindex-search/` — entire directory
- **Delete:** `.agents/skills/jobnet-search/` — entire directory

---

### Task 1: Delete Danish job board skills

**Files:**
- Delete: `.agents/skills/jobbank-search/` (entire directory)
- Delete: `.agents/skills/jobdanmark-search/` (entire directory)
- Delete: `.agents/skills/jobindex-search/` (entire directory)
- Delete: `.agents/skills/jobnet-search/` (entire directory)

- [ ] **Step 1: Remove all four Danish skill directories**

```bash
rm -rf .agents/skills/jobbank-search .agents/skills/jobdanmark-search .agents/skills/jobindex-search .agents/skills/jobnet-search
```

- [ ] **Step 2: Verify removal**

```bash
ls .agents/skills/
```

Expected: empty directory (no jobbank-search, jobdanmark-search, jobindex-search, jobnet-search)

- [ ] **Step 3: Commit**

```bash
git add -A .agents/skills/
git commit -m "chore: remove Danish job board skills (jobbank, jobdanmark, jobindex, jobnet)"
```

---

### Task 2: Create shared core — package.json and types

**Files:**
- Create: `.agents/skills/shared/cli/package.json`
- Create: `.agents/skills/shared/cli/src/types.ts`

- [ ] **Step 1: Write the test for types**

Create `.agents/skills/shared/cli/tests/types.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import { JobListingSchema, JobDetailSchema, SearchFiltersSchema } from "../src/types.js"

describe("JobListingSchema", () => {
  test("validates a complete job listing", () => {
    const listing = {
      id: "12345",
      title: "Senior Software Engineer",
      company: "Acme Corp",
      location: "London, UK",
      jobType: "full-time",
      salary: "\u00a360,000 - \u00a380,000",
      url: "https://linkedin.com/jobs/view/12345",
      posted: "2026-03-28",
      deadline: null,
      source: "linkedin" as const,
    }
    const result = JobListingSchema.safeParse(listing)
    expect(result.success).toBe(true)
  })

  test("validates listing with null optional fields", () => {
    const listing = {
      id: "67890",
      title: "Data Analyst",
      company: "BigCo",
      location: "Manchester",
      jobType: null,
      salary: null,
      url: "https://uk.indeed.com/viewjob?jk=67890",
      posted: null,
      deadline: null,
      source: "indeed" as const,
    }
    const result = JobListingSchema.safeParse(listing)
    expect(result.success).toBe(true)
  })

  test("rejects invalid source", () => {
    const listing = {
      id: "1",
      title: "Test",
      company: "Test",
      location: "Test",
      jobType: null,
      salary: null,
      url: "https://example.com",
      posted: null,
      deadline: null,
      source: "glassdoor",
    }
    const result = JobListingSchema.safeParse(listing)
    expect(result.success).toBe(false)
  })
})

describe("JobDetailSchema", () => {
  test("validates a complete job detail", () => {
    const detail = {
      id: "12345",
      title: "Senior Software Engineer",
      company: "Acme Corp",
      location: "London, UK",
      jobType: "full-time",
      salary: "\u00a360,000 - \u00a380,000",
      url: "https://linkedin.com/jobs/view/12345",
      posted: "2026-03-28",
      deadline: null,
      source: "linkedin" as const,
      description: "<p>We are looking for a senior engineer...</p>",
      employmentType: ["FULL_TIME"],
      remote: "hybrid",
      companyInfo: {
        name: "Acme Corp",
        logo: "https://example.com/logo.png",
        url: "https://acme.com",
      },
      requirements: "5+ years experience in TypeScript",
    }
    const result = JobDetailSchema.safeParse(detail)
    expect(result.success).toBe(true)
  })
})

describe("SearchFiltersSchema", () => {
  test("applies defaults", () => {
    const result = SearchFiltersSchema.parse({})
    expect(result.location).toBe("United Kingdom")
    expect(result.limit).toBe(25)
    expect(result.keywords).toBeNull()
  })

  test("accepts all fields", () => {
    const filters = {
      keywords: "data engineer",
      location: "London",
      radius: 15,
      jobType: "full-time",
      remote: "remote",
      salary: "50000",
      datePosted: "7d",
      experienceLevel: "mid-senior",
      limit: 50,
    }
    const result = SearchFiltersSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Create package.json**

Create `.agents/skills/shared/cli/package.json`:

```json
{
  "name": "job-search-shared",
  "version": "1.0.0",
  "description": "Shared core library for UK job search skills (Playwright browser management, types, formatting)",
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types.ts",
    "./browser": "./src/browser.ts",
    "./formatting": "./src/formatting.ts"
  },
  "scripts": {
    "test": "bun test --timeout 30000",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "playwright": "^1.52.0",
    "zod": "^3.23.0",
    "@bunli/utils": "latest"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Write types.ts**

Create `.agents/skills/shared/cli/src/types.ts`:

```typescript
import { z } from "zod"

// --- Job Listing (search results) ---

export const JobListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  jobType: z.string().nullable(),
  salary: z.string().nullable(),
  url: z.string(),
  posted: z.string().nullable(),
  deadline: z.string().nullable(),
  source: z.enum(["linkedin", "indeed"]),
})

export type JobListing = z.infer<typeof JobListingSchema>

// --- Job Detail (full posting) ---

export const CompanyInfoSchema = z.object({
  name: z.string(),
  logo: z.string().nullable(),
  url: z.string().nullable(),
})

export type CompanyInfo = z.infer<typeof CompanyInfoSchema>

export const JobDetailSchema = JobListingSchema.extend({
  description: z.string(),
  employmentType: z.array(z.string()),
  remote: z.string().nullable(),
  companyInfo: CompanyInfoSchema,
  requirements: z.string().nullable(),
})

export type JobDetail = z.infer<typeof JobDetailSchema>

// --- Search Filters ---

export const SearchFiltersSchema = z.object({
  keywords: z.string().nullable().default(null),
  location: z.string().default("United Kingdom"),
  radius: z.number().nullable().default(null),
  jobType: z.string().nullable().default(null),
  remote: z.string().nullable().default(null),
  salary: z.string().nullable().default(null),
  datePosted: z.string().nullable().default(null),
  experienceLevel: z.string().nullable().default(null),
  limit: z.number().default(25),
})

export type SearchFilters = z.infer<typeof SearchFiltersSchema>

// --- Search Response ---

export interface SearchResponse {
  meta: { total: number }
  results: JobListing[]
}
```

- [ ] **Step 4: Run tests to verify types**

```bash
cd .agents/skills/shared/cli && bun install && bun test
```

Expected: 5 tests pass (3 JobListing, 1 JobDetail, 1 SearchFilters with defaults — plus the rejection test)

- [ ] **Step 5: Commit**

```bash
git add .agents/skills/shared/
git commit -m "feat: add shared types with Zod schemas for UK job search skills"
```

---

### Task 3: Create shared core — formatting

**Files:**
- Create: `.agents/skills/shared/cli/src/formatting.ts`

- [ ] **Step 1: Write the test for formatting**

Create `.agents/skills/shared/cli/tests/formatting.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import { formatOutput, writeError } from "../src/formatting.js"
import type { JobListing } from "../src/types.js"

const sampleListing: JobListing = {
  id: "12345",
  title: "Senior Software Engineer",
  company: "Acme Corp",
  location: "London, UK",
  jobType: "full-time",
  salary: "\u00a360,000 - \u00a380,000",
  url: "https://linkedin.com/jobs/view/12345",
  posted: "2026-03-28",
  deadline: null,
  source: "linkedin",
}

describe("formatOutput", () => {
  test("json format returns valid JSON string", () => {
    const output = formatOutput({ meta: { total: 1 }, results: [sampleListing] }, "json")
    const parsed = JSON.parse(output)
    expect(parsed.meta.total).toBe(1)
    expect(parsed.results).toHaveLength(1)
    expect(parsed.results[0].title).toBe("Senior Software Engineer")
  })

  test("table format returns tab-separated rows with header", () => {
    const output = formatOutput({ meta: { total: 1 }, results: [sampleListing] }, "table")
    const lines = output.split("\n")
    expect(lines[0]).toContain("ID")
    expect(lines[0]).toContain("TITLE")
    expect(lines[0]).toContain("COMPANY")
    expect(lines[1]).toContain("12345")
    expect(lines[1]).toContain("Senior Software Engineer")
  })

  test("plain format returns human-readable text", () => {
    const output = formatOutput(sampleListing, "plain")
    expect(output).toContain("Senior Software Engineer")
    expect(output).toContain("Acme Corp")
    expect(output).toContain("London, UK")
  })

  test("json format handles single object (detail)", () => {
    const output = formatOutput(sampleListing, "json")
    const parsed = JSON.parse(output)
    expect(parsed.title).toBe("Senior Software Engineer")
  })
})

describe("writeError", () => {
  test("returns JSON error string", () => {
    // writeError writes to stderr, but we can test the formatting logic
    // by checking it doesn't throw
    expect(() => writeError("Not found", "NOT_FOUND")).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd .agents/skills/shared/cli && bun test tests/formatting.test.ts
```

Expected: FAIL — `formatOutput` and `writeError` not found

- [ ] **Step 3: Write formatting.ts**

Create `.agents/skills/shared/cli/src/formatting.ts`:

```typescript
import type { JobListing } from "./types.js"

type OutputFormat = "json" | "table" | "plain"

export function formatOutput(data: unknown, format: OutputFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2)

    case "table":
      return formatTable(data)

    case "plain":
      return formatPlain(data)
  }
}

function formatTable(data: unknown): string {
  // If it's a search response with results array, format as table
  const obj = data as Record<string, unknown>
  const results = (obj.results ?? [obj]) as Record<string, unknown>[]

  const columns = ["ID", "TITLE", "COMPANY", "LOCATION", "TYPE", "POSTED"]
  const rows = results.map((r) => [
    String(r.id ?? ""),
    String(r.title ?? ""),
    String(r.company ?? ""),
    String(r.location ?? ""),
    String(r.jobType ?? ""),
    String(r.posted ?? ""),
  ])

  const widths = columns.map((col, i) =>
    Math.max(col.length, ...rows.map((r) => r[i].length))
  )

  const header = columns.map((col, i) => col.padEnd(widths[i])).join("\t")
  const body = rows
    .map((row) => row.map((cell, i) => cell.padEnd(widths[i])).join("\t"))
    .join("\n")

  const meta = obj.meta as { total?: number } | undefined
  const totalLine = meta?.total != null ? `\n\nTotal: ${meta.total}` : ""

  return header + "\n" + body + totalLine
}

function formatPlain(data: unknown): string {
  const obj = data as Record<string, unknown>
  const lines: string[] = []

  if (obj.title) lines.push(`Title: ${obj.title}`)
  if (obj.company) lines.push(`Company: ${obj.company}`)
  if (obj.location) lines.push(`Location: ${obj.location}`)
  if (obj.jobType) lines.push(`Type: ${obj.jobType}`)
  if (obj.salary) lines.push(`Salary: ${obj.salary}`)
  if (obj.remote) lines.push(`Remote: ${obj.remote}`)
  if (obj.posted) lines.push(`Posted: ${obj.posted}`)
  if (obj.deadline) lines.push(`Deadline: ${obj.deadline}`)
  if (obj.url) lines.push(`URL: ${obj.url}`)
  if (obj.source) lines.push(`Source: ${obj.source}`)

  if (obj.description) {
    lines.push("")
    lines.push("--- Description ---")
    lines.push(stripHtml(String(obj.description)))
  }

  if (obj.requirements) {
    lines.push("")
    lines.push("--- Requirements ---")
    lines.push(String(obj.requirements))
  }

  return lines.join("\n")
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd .agents/skills/shared/cli && bun test tests/formatting.test.ts
```

Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add .agents/skills/shared/cli/src/formatting.ts .agents/skills/shared/cli/tests/formatting.test.ts
git commit -m "feat: add shared formatting module (json/table/plain output)"
```

---

### Task 4: Create shared core — browser management

**Files:**
- Create: `.agents/skills/shared/cli/src/browser.ts`

- [ ] **Step 1: Write the test for browser utilities**

Create `.agents/skills/shared/cli/tests/browser.test.ts`:

```typescript
import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { resolve } from "path"
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs"
import { cookiePath, loadCookies, saveCookiesToDisk } from "../src/browser.js"

const TEST_CONFIG_DIR = resolve(import.meta.dir, "../.test-config")

describe("cookiePath", () => {
  test("returns path ending with site.json", () => {
    const p = cookiePath("linkedin", TEST_CONFIG_DIR)
    expect(p).toContain("linkedin.json")
    expect(p).toContain("cookies")
  })
})

describe("cookie persistence", () => {
  beforeAll(() => {
    mkdirSync(resolve(TEST_CONFIG_DIR, "cookies"), { recursive: true })
  })

  afterAll(() => {
    rmSync(TEST_CONFIG_DIR, { recursive: true, force: true })
  })

  test("loadCookies returns empty array when no file exists", () => {
    const cookies = loadCookies("nonexistent-site", TEST_CONFIG_DIR)
    expect(cookies).toEqual([])
  })

  test("saveCookiesToDisk writes and loadCookies reads back", () => {
    const fakeCookies = [
      { name: "session", value: "abc123", domain: ".linkedin.com", path: "/", expires: -1, httpOnly: true, secure: true, sameSite: "Lax" as const },
    ]
    saveCookiesToDisk(fakeCookies, "test-site", TEST_CONFIG_DIR)

    const loaded = loadCookies("test-site", TEST_CONFIG_DIR)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe("session")
    expect(loaded[0].value).toBe("abc123")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd .agents/skills/shared/cli && bun test tests/browser.test.ts
```

Expected: FAIL — imports not found

- [ ] **Step 3: Write browser.ts**

Create `.agents/skills/shared/cli/src/browser.ts`:

```typescript
import { chromium, type Browser, type Page, type Cookie } from "playwright"
import { join } from "path"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs"
import { configDir } from "@bunli/utils"

const APP_NAME = "ai-job-search"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

export function getConfigDir(): string {
  return configDir(APP_NAME)
}

export function cookiePath(site: string, baseDir?: string): string {
  const dir = join(baseDir ?? getConfigDir(), "cookies")
  mkdirSync(dir, { recursive: true })
  return join(dir, `${site}.json`)
}

export function loadCookies(site: string, baseDir?: string): Cookie[] {
  const path = cookiePath(site, baseDir)
  if (!existsSync(path)) return []
  try {
    const raw = readFileSync(path, "utf-8")
    return JSON.parse(raw) as Cookie[]
  } catch {
    return []
  }
}

export function saveCookiesToDisk(cookies: Cookie[], site: string, baseDir?: string): void {
  const path = cookiePath(site, baseDir)
  writeFileSync(path, JSON.stringify(cookies, null, 2))
}

export async function launchBrowser(options?: { headed?: boolean }): Promise<Browser> {
  return chromium.launch({
    headless: !(options?.headed),
    args: ["--disable-blink-features=AutomationControlled"],
  })
}

export async function newPage(browser: Browser, site: string): Promise<Page> {
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: "en-GB",
  })

  // Load saved cookies if available
  const cookies = loadCookies(site)
  if (cookies.length > 0) {
    await context.addCookies(cookies)
  }

  // Stealth: override navigator.webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false })
  })

  return context.newPage()
}

export async function saveCookies(page: Page, site: string): Promise<void> {
  const context = page.context()
  const cookies = await context.cookies()
  saveCookiesToDisk(cookies, site)
}

export async function randomDelay(min = 200, max = 600): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  await new Promise((resolve) => setTimeout(resolve, ms))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd .agents/skills/shared/cli && bun test tests/browser.test.ts
```

Expected: 3 tests pass (cookiePath, loadCookies empty, save+load roundtrip)

- [ ] **Step 5: Commit**

```bash
git add .agents/skills/shared/cli/src/browser.ts .agents/skills/shared/cli/tests/browser.test.ts
git commit -m "feat: add shared browser module (Playwright launch, cookie persistence, stealth)"
```

---

### Task 5: Create shared core — index and install Playwright

**Files:**
- Create: `.agents/skills/shared/cli/src/index.ts`

- [ ] **Step 1: Create barrel export**

Create `.agents/skills/shared/cli/src/index.ts`:

```typescript
export {
  JobListingSchema,
  JobDetailSchema,
  SearchFiltersSchema,
  CompanyInfoSchema,
  type JobListing,
  type JobDetail,
  type SearchFilters,
  type CompanyInfo,
  type SearchResponse,
} from "./types.js"

export {
  formatOutput,
  writeError,
} from "./formatting.js"

export {
  launchBrowser,
  newPage,
  saveCookies,
  loadCookies,
  saveCookiesToDisk,
  cookiePath,
  randomDelay,
  getConfigDir,
} from "./browser.js"
```

- [ ] **Step 2: Install dependencies and Playwright browser**

```bash
cd .agents/skills/shared/cli && bun install && bunx playwright install chromium
```

- [ ] **Step 3: Run all shared tests**

```bash
cd .agents/skills/shared/cli && bun test
```

Expected: All tests pass (types, formatting, browser)

- [ ] **Step 4: Commit**

```bash
git add .agents/skills/shared/cli/src/index.ts .agents/skills/shared/cli/bun.lock
git commit -m "feat: add shared index barrel export, install Playwright Chromium"
```

---

### Task 6: Create LinkedIn skill — package.json, SKILL.md, CLI entry point

**Files:**
- Create: `.agents/skills/linkedin-search/SKILL.md`
- Create: `.agents/skills/linkedin-search/cli/package.json`
- Create: `.agents/skills/linkedin-search/cli/src/cli.ts`

- [ ] **Step 1: Create SKILL.md**

Create `.agents/skills/linkedin-search/SKILL.md`:

```markdown
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

Search UK job listings on LinkedIn with authenticated browser sessions. Uses Playwright to automate Chromium for full page rendering and JavaScript execution.

## When to use this skill

Invoke this skill when the user wants to:

- Search for jobs on LinkedIn, particularly in the UK
- Log in to LinkedIn to enable authenticated job searches
- Get full details for a specific LinkedIn job posting
- Find remote, hybrid, or on-site positions on LinkedIn
- Filter LinkedIn jobs by type, experience level, or salary

## Prerequisites

Before searching, the user must log in once:

\`\`\`bash
bun run skills/linkedin-search/cli/src/cli.ts login
\`\`\`

This opens a visible browser window. The user logs in manually (handles 2FA/CAPTCHA). Session cookies are saved and reused for subsequent commands.

## Commands

### Log in to LinkedIn

\`\`\`bash
bun run skills/linkedin-search/cli/src/cli.ts login
\`\`\`

Opens a headed browser for manual login. Saves session cookies on success.

### Search jobs

\`\`\`bash
bun run skills/linkedin-search/cli/src/cli.ts search [flags]
\`\`\`

Key flags:
- \`--keywords <text>\` — search terms (job title, skill, company)
- \`--location <text>\` — location (default: "United Kingdom")
- \`--radius <miles>\` — radius from location
- \`--type <value>\` — full-time, part-time, contract, permanent, internship, volunteer
- \`--remote <value>\` — on-site, remote, hybrid
- \`--experience <value>\` — internship, entry, associate, mid-senior, director, executive
- \`--salary <value>\` — salary range filter
- \`--since <value>\` — past-24h, past-week, past-month
- \`--limit <n>\` — max results (default: 25)
- \`--format json|table|plain\`

### Full job detail

\`\`\`bash
bun run skills/linkedin-search/cli/src/cli.ts detail <id-or-url> [--format json|plain]
\`\`\`

Accepts a LinkedIn job ID or full URL. Returns full job description, company info, and requirements.

---

## Usage examples

### Search for data engineer jobs in London

\`\`\`bash
bun run skills/linkedin-search/cli/src/cli.ts search \
  --keywords "data engineer" \
  --location "London" \
  --type full-time \
  --format table
\`\`\`

### Remote software engineering roles

\`\`\`bash
bun run skills/linkedin-search/cli/src/cli.ts search \
  --keywords "software engineer" \
  --remote remote \
  --since past-week \
  --format table
\`\`\`

### Full details for a specific job

\`\`\`bash
bun run skills/linkedin-search/cli/src/cli.ts detail 3847291056 --format plain
\`\`\`

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

- Requires a LinkedIn login session. Run `login` first.
- If cookies expire, commands will print an error asking you to run `login` again.
- LinkedIn may change their page structure — if scraping breaks, `scraper.ts` is the file to update.
- Stealth measures (realistic user-agent, disabled webdriver flag) are applied automatically.
```

- [ ] **Step 2: Create package.json**

Create `.agents/skills/linkedin-search/cli/package.json`:

```json
{
  "name": "linkedin-search-cli",
  "version": "1.0.0",
  "description": "CLI for LinkedIn UK job search using Playwright",
  "type": "module",
  "main": "src/cli.ts",
  "bin": {
    "linkedin-search": "src/cli.ts"
  },
  "scripts": {
    "start": "bun run src/cli.ts",
    "test": "bun test --timeout 30000",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@bunli/core": "latest",
    "@bunli/utils": "latest",
    "job-search-shared": "file:../../shared/cli",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Create CLI entry point**

Create `.agents/skills/linkedin-search/cli/src/cli.ts`:

```typescript
import { createCLI } from "@bunli/core"
import { login } from "./commands/login.js"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"

const cli = await createCLI({
  name: "linkedin-search",
  version: "1.0.0",
  description: "Search UK job listings on LinkedIn with authenticated browser sessions",
})

cli.command(login)
cli.command(search)
cli.command(detail)

await cli.run()
```

- [ ] **Step 4: Install dependencies**

```bash
cd .agents/skills/linkedin-search/cli && bun install
```

- [ ] **Step 5: Commit**

```bash
git add .agents/skills/linkedin-search/
git commit -m "feat: scaffold linkedin-search skill (SKILL.md, package.json, cli entry)"
```

---

### Task 7: Create LinkedIn skill — scraper module

**Files:**
- Create: `.agents/skills/linkedin-search/cli/src/scraper.ts`

- [ ] **Step 1: Write tests for scraper extraction functions**

Create `.agents/skills/linkedin-search/cli/tests/scraper.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import { parseJobCard, parseJobDetail, buildSearchUrl } from "../src/scraper.js"

describe("buildSearchUrl", () => {
  test("builds URL with keywords and location", () => {
    const url = buildSearchUrl({ keywords: "data engineer", location: "London" })
    expect(url).toContain("linkedin.com/jobs/search")
    expect(url).toContain("keywords=data+engineer")
    expect(url).toContain("location=London")
  })

  test("builds URL with job type filter", () => {
    const url = buildSearchUrl({ keywords: "developer", jobType: "full-time" })
    expect(url).toContain("f_JT=F")
  })

  test("builds URL with remote filter", () => {
    const url = buildSearchUrl({ remote: "remote" })
    expect(url).toContain("f_WT=2")
  })

  test("builds URL with experience filter", () => {
    const url = buildSearchUrl({ experienceLevel: "mid-senior" })
    expect(url).toContain("f_E=4")
  })

  test("builds URL with since filter", () => {
    const url = buildSearchUrl({ since: "past-24h" })
    expect(url).toContain("f_TPR=r86400")
  })

  test("uses default location when none provided", () => {
    const url = buildSearchUrl({ keywords: "test" })
    expect(url).toContain("location=United+Kingdom")
  })
})

describe("parseJobCard", () => {
  test("extracts fields from HTML card", () => {
    const html = `
      <div class="job-card-container" data-job-id="3847291056">
        <a class="job-card-container__link" href="/jobs/view/3847291056/">
          <span class="sr-only">Senior Data Engineer</span>
        </a>
        <span class="job-card-container__primary-description">Acme Corp</span>
        <li class="job-card-container__metadata-item">London, England, United Kingdom</li>
      </div>
    `
    const card = parseJobCard(html)
    expect(card).not.toBeNull()
    expect(card!.id).toBe("3847291056")
    expect(card!.title).toBe("Senior Data Engineer")
    expect(card!.company).toBe("Acme Corp")
    expect(card!.location).toContain("London")
  })

  test("returns null for empty HTML", () => {
    const card = parseJobCard("")
    expect(card).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd .agents/skills/linkedin-search/cli && bun test tests/scraper.test.ts
```

Expected: FAIL — imports not found

- [ ] **Step 3: Write scraper.ts**

Create `.agents/skills/linkedin-search/cli/src/scraper.ts`:

```typescript
import type { Page } from "playwright"
import type { JobListing, JobDetail } from "job-search-shared/types"
import { randomDelay } from "job-search-shared/browser"

// --- LinkedIn URL parameter mappings ---

const JOB_TYPE_MAP: Record<string, string> = {
  "full-time": "F",
  "part-time": "P",
  "contract": "C",
  "permanent": "F",       // LinkedIn maps permanent to full-time
  "internship": "I",
  "volunteer": "V",
}

const REMOTE_MAP: Record<string, string> = {
  "on-site": "1",
  "remote": "2",
  "hybrid": "3",
}

const EXPERIENCE_MAP: Record<string, string> = {
  "internship": "1",
  "entry": "2",
  "associate": "3",
  "mid-senior": "4",
  "director": "5",
  "executive": "6",
}

const SINCE_MAP: Record<string, string> = {
  "past-24h": "r86400",
  "past-week": "r604800",
  "past-month": "r2592000",
}

// --- URL builder ---

interface SearchParams {
  keywords?: string | null
  location?: string | null
  radius?: number | null
  jobType?: string | null
  remote?: string | null
  experienceLevel?: string | null
  salary?: string | null
  since?: string | null
}

export function buildSearchUrl(params: SearchParams): string {
  const base = "https://www.linkedin.com/jobs/search/"
  const qs = new URLSearchParams()

  if (params.keywords) qs.set("keywords", params.keywords)
  qs.set("location", params.location ?? "United Kingdom")
  if (params.radius != null) qs.set("distance", String(params.radius))
  if (params.jobType && JOB_TYPE_MAP[params.jobType]) qs.set("f_JT", JOB_TYPE_MAP[params.jobType])
  if (params.remote && REMOTE_MAP[params.remote]) qs.set("f_WT", REMOTE_MAP[params.remote])
  if (params.experienceLevel && EXPERIENCE_MAP[params.experienceLevel]) qs.set("f_E", EXPERIENCE_MAP[params.experienceLevel])
  if (params.since && SINCE_MAP[params.since]) qs.set("f_TPR", SINCE_MAP[params.since])

  return `${base}?${qs.toString()}`
}

// --- HTML parsing (for unit tests — these parse raw HTML strings) ---

export function parseJobCard(html: string): Omit<JobListing, "source"> | null {
  if (!html.trim()) return null

  const idMatch = html.match(/data-job-id="(\d+)"/)
  const titleMatch = html.match(/<span class="sr-only">(.*?)<\/span>/s)
  const companyMatch = html.match(/job-card-container__primary-description[^>]*>(.*?)<\//s)
  const locationMatch = html.match(/job-card-container__metadata-item[^>]*>(.*?)<\//s)

  if (!idMatch) return null

  return {
    id: idMatch[1],
    title: titleMatch?.[1]?.trim() ?? "",
    company: companyMatch?.[1]?.trim() ?? "",
    location: locationMatch?.[1]?.trim() ?? "",
    jobType: null,
    salary: null,
    url: `https://www.linkedin.com/jobs/view/${idMatch[1]}/`,
    posted: null,
    deadline: null,
  }
}

// --- Page-level scraping (uses Playwright Page) ---

export async function scrapeSearchResults(page: Page, limit: number): Promise<JobListing[]> {
  const results: JobListing[] = []
  let previousCount = 0
  const maxScrollAttempts = 20

  for (let scroll = 0; scroll < maxScrollAttempts && results.length < limit; scroll++) {
    // Extract job cards from the current page state
    const cards = await page.$$eval(
      ".job-card-container, .jobs-search-results__list-item",
      (elements) =>
        elements.map((el) => {
          const id = el.getAttribute("data-job-id") ?? el.querySelector("[data-job-id]")?.getAttribute("data-job-id") ?? ""
          const titleEl = el.querySelector(".job-card-list__title, .job-card-container__link span.sr-only, a[class*='job-card'] span")
          const companyEl = el.querySelector(".job-card-container__primary-description, .artdeco-entity-lockup__subtitle span")
          const locationEl = el.querySelector(".job-card-container__metadata-item, .artdeco-entity-lockup__caption span")
          const timeEl = el.querySelector("time")

          return {
            id,
            title: titleEl?.textContent?.trim() ?? "",
            company: companyEl?.textContent?.trim() ?? "",
            location: locationEl?.textContent?.trim() ?? "",
            posted: timeEl?.getAttribute("datetime") ?? null,
          }
        })
    )

    // Add new cards (dedup by id)
    const seenIds = new Set(results.map((r) => r.id))
    for (const card of cards) {
      if (!card.id || seenIds.has(card.id)) continue
      seenIds.add(card.id)
      results.push({
        ...card,
        jobType: null,
        salary: null,
        deadline: null,
        url: `https://www.linkedin.com/jobs/view/${card.id}/`,
        source: "linkedin",
      })
      if (results.length >= limit) break
    }

    if (results.length >= limit) break
    if (results.length === previousCount) break // no new results after scroll
    previousCount = results.length

    // Scroll the job list to load more
    await page.evaluate(() => {
      const list = document.querySelector(".jobs-search-results-list, .scaffold-layout__list")
      if (list) list.scrollTop = list.scrollHeight
    })
    await randomDelay(500, 1200)
  }

  return results.slice(0, limit)
}

export async function scrapeJobDetail(page: Page): Promise<Omit<JobDetail, "source" | "id" | "url"> | null> {
  // Click "See more" to expand description if present
  try {
    const seeMore = page.locator("button.jobs-description__footer-button, button[aria-label*='See more']")
    if (await seeMore.isVisible({ timeout: 2000 })) {
      await seeMore.click()
      await randomDelay(300, 600)
    }
  } catch {
    // "See more" button not present or not clickable — that's fine
  }

  return page.evaluate(() => {
    const titleEl = document.querySelector(".job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1")
    const companyEl = document.querySelector(".job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name a")
    const locationEl = document.querySelector(".job-details-jobs-unified-top-card__primary-description-container .tvm__text, .jobs-unified-top-card__bullet")
    const descEl = document.querySelector(".jobs-description__content, .jobs-description-content__text, #job-details")
    const typeEls = document.querySelectorAll(".job-details-jobs-unified-top-card__job-insight span, .jobs-unified-top-card__job-insight span")

    const companyLogo = document.querySelector(".job-details-jobs-unified-top-card__company-logo img, .jobs-unified-top-card__company-logo img") as HTMLImageElement | null
    const companyLink = document.querySelector(".job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name a") as HTMLAnchorElement | null

    const insights = Array.from(typeEls).map((el) => el.textContent?.trim() ?? "")
    const employmentType: string[] = []
    let remote: string | null = null
    let salary: string | null = null

    for (const insight of insights) {
      const lower = insight.toLowerCase()
      if (lower.includes("full-time")) employmentType.push("FULL_TIME")
      if (lower.includes("part-time")) employmentType.push("PART_TIME")
      if (lower.includes("contract")) employmentType.push("CONTRACT")
      if (lower.includes("remote")) remote = "remote"
      if (lower.includes("hybrid")) remote = "hybrid"
      if (lower.includes("on-site")) remote = "on-site"
      if (insight.includes("\u00a3") || insight.includes("$") || lower.includes("/yr") || lower.includes("/hr")) {
        salary = insight
      }
    }

    return {
      title: titleEl?.textContent?.trim() ?? "",
      company: companyEl?.textContent?.trim() ?? "",
      location: locationEl?.textContent?.trim() ?? "",
      jobType: employmentType[0]?.toLowerCase().replace("_", "-") ?? null,
      salary,
      posted: null,
      deadline: null,
      description: descEl?.innerHTML?.trim() ?? "",
      employmentType,
      remote,
      companyInfo: {
        name: companyEl?.textContent?.trim() ?? "",
        logo: companyLogo?.src ?? null,
        url: companyLink?.href ?? null,
      },
      requirements: null,
    }
  })
}

export function isLoginPage(url: string): boolean {
  return url.includes("/login") || url.includes("/authwall") || url.includes("/checkpoint")
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd .agents/skills/linkedin-search/cli && bun test tests/scraper.test.ts
```

Expected: 7 tests pass (6 buildSearchUrl + 2 parseJobCard)

- [ ] **Step 5: Commit**

```bash
git add .agents/skills/linkedin-search/cli/src/scraper.ts .agents/skills/linkedin-search/cli/tests/scraper.test.ts
git commit -m "feat: add LinkedIn scraper module (URL builder, DOM extraction, page scraping)"
```

---

### Task 8: Create LinkedIn skill — login command

**Files:**
- Create: `.agents/skills/linkedin-search/cli/src/commands/login.ts`

- [ ] **Step 1: Write login command**

Create `.agents/skills/linkedin-search/cli/src/commands/login.ts`:

```typescript
import { defineCommand } from "@bunli/core"
import { launchBrowser, newPage, saveCookies } from "job-search-shared/browser"
import { writeError } from "job-search-shared/formatting"

export const login = defineCommand({
  name: "login",
  description: "Log in to LinkedIn (opens a visible browser window for manual login)",
  handler: async () => {
    const browser = await launchBrowser({ headed: true })

    try {
      const page = await newPage(browser, "linkedin")
      await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" })

      console.log("Please log in to LinkedIn in the browser window.")
      console.log("Waiting for login to complete...")

      // Wait for navigation away from login page (up to 5 minutes for 2FA/CAPTCHA)
      await page.waitForURL((url) => {
        const path = url.pathname
        return !path.includes("/login") && !path.includes("/checkpoint") && !path.includes("/authwall")
      }, { timeout: 300_000 })

      // Save cookies
      await saveCookies(page, "linkedin")
      console.log("Login successful! Cookies saved.")
    } catch (error) {
      writeError(
        error instanceof Error ? error.message : "Login failed or timed out",
        "LOGIN_FAILED"
      )
      process.exit(1)
    } finally {
      await browser.close()
    }
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add .agents/skills/linkedin-search/cli/src/commands/login.ts
git commit -m "feat: add LinkedIn login command (headed browser, cookie persistence)"
```

---

### Task 9: Create LinkedIn skill — search command

**Files:**
- Create: `.agents/skills/linkedin-search/cli/src/commands/search.ts`

- [ ] **Step 1: Write search command**

Create `.agents/skills/linkedin-search/cli/src/commands/search.ts`:

```typescript
import { z } from "zod"
import { defineCommand, option } from "@bunli/core"
import { launchBrowser, newPage, saveCookies } from "job-search-shared/browser"
import { formatOutput, writeError } from "job-search-shared/formatting"
import type { SearchResponse } from "job-search-shared/types"
import { buildSearchUrl, scrapeSearchResults, isLoginPage } from "../scraper.js"

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

      // Check if we hit a login wall
      if (isLoginPage(page.url())) {
        writeError("LinkedIn session expired. Please run 'login' first.", "AUTH_REQUIRED")
        process.exit(1)
      }

      // Wait for job cards to appear
      try {
        await page.waitForSelector(
          ".job-card-container, .jobs-search-results__list-item",
          { timeout: 10_000 }
        )
      } catch {
        // No results or page layout changed
        const response: SearchResponse = { meta: { total: 0 }, results: [] }
        process.stdout.write(formatOutput(response, flags.format) + "\n")
        return
      }

      // Extract total count
      const total = await page.$eval(
        ".jobs-search-results-list__subtitle, .jobs-search-results-list__title-heading small",
        (el) => {
          const text = el.textContent ?? ""
          const match = text.replace(/,/g, "").match(/(\d+)/)
          return match ? parseInt(match[1], 10) : 0
        }
      ).catch(() => 0)

      const results = await scrapeSearchResults(page, flags.limit)

      // Save cookies to keep session fresh
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
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add .agents/skills/linkedin-search/cli/src/commands/search.ts
git commit -m "feat: add LinkedIn search command (filters, pagination, auth check)"
```

---

### Task 10: Create LinkedIn skill — detail command

**Files:**
- Create: `.agents/skills/linkedin-search/cli/src/commands/detail.ts`

- [ ] **Step 1: Write detail command**

Create `.agents/skills/linkedin-search/cli/src/commands/detail.ts`:

```typescript
import { z } from "zod"
import { defineCommand, option } from "@bunli/core"
import { launchBrowser, newPage, saveCookies } from "job-search-shared/browser"
import { formatOutput, writeError } from "job-search-shared/formatting"
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

    // Determine the job URL
    let jobUrl: string
    if (idOrUrl.startsWith("http")) {
      jobUrl = idOrUrl
    } else {
      jobUrl = `https://www.linkedin.com/jobs/view/${idOrUrl}/`
    }

    // Extract job ID from URL
    const idMatch = jobUrl.match(/\/jobs\/view\/(\d+)/)
    const jobId = idMatch?.[1] ?? idOrUrl

    const browser = await launchBrowser()

    try {
      const page = await newPage(browser, "linkedin")
      await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })

      // Check if we hit a login wall
      if (isLoginPage(page.url())) {
        writeError("LinkedIn session expired. Please run 'login' first.", "AUTH_REQUIRED")
        process.exit(1)
      }

      // Wait for job detail content
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

      // Save cookies to keep session fresh
      await saveCookies(page, "linkedin")

      const detail: JobDetail = {
        ...scraped,
        id: jobId,
        url: jobUrl,
        source: "linkedin",
      }

      process.stdout.write(formatOutput(detail, flags.format) + "\n")
    } catch (error) {
      writeError(
        error instanceof Error ? error.message : "Detail fetch failed",
        "DETAIL_FAILED"
      )
      process.exit(1)
    } finally {
      await browser.close()
    }
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add .agents/skills/linkedin-search/cli/src/commands/detail.ts
git commit -m "feat: add LinkedIn detail command (full job description extraction)"
```

---

### Task 11: Create LinkedIn skill — test helper and smoke test

**Files:**
- Create: `.agents/skills/linkedin-search/cli/tests/helpers.ts`

- [ ] **Step 1: Create test helper**

Create `.agents/skills/linkedin-search/cli/tests/helpers.ts`:

```typescript
import { join } from "path"

const CLI_PATH = join(import.meta.dir, "../src/cli.ts")

export interface CLIResult {
  stdout: string
  stderr: string
  exitCode: number
}

export async function runCLI(args: string[]): Promise<CLIResult> {
  const proc = Bun.spawn(["bun", "run", CLI_PATH, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}

export function parseJSON<T = unknown>(result: CLIResult): T {
  if (result.exitCode !== 0) {
    throw new Error(
      `CLI exited with code ${result.exitCode}. stderr: ${result.stderr}`
    )
  }
  try {
    return JSON.parse(result.stdout) as T
  } catch {
    throw new Error(
      `Failed to parse JSON. stdout: ${result.stdout}\nstderr: ${result.stderr}`
    )
  }
}
```

- [ ] **Step 2: Write smoke test for --help**

Create `.agents/skills/linkedin-search/cli/tests/cli.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("linkedin-search CLI", () => {
  test("--help prints usage info", async () => {
    const result = await runCLI(["--help"])
    expect(result.stdout + result.stderr).toContain("linkedin-search")
  })

  test("search --help prints search options", async () => {
    const result = await runCLI(["search", "--help"])
    expect(result.stdout + result.stderr).toContain("keywords")
  })

  test("detail --help prints detail options", async () => {
    const result = await runCLI(["detail", "--help"])
    expect(result.stdout + result.stderr).toContain("format")
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd .agents/skills/linkedin-search/cli && bun test
```

Expected: All tests pass (scraper unit tests + CLI smoke tests)

- [ ] **Step 4: Commit**

```bash
git add .agents/skills/linkedin-search/cli/tests/
git commit -m "test: add LinkedIn CLI test helpers and smoke tests"
```

---

### Task 12: Create Indeed skill — package.json, SKILL.md, CLI entry point

**Files:**
- Create: `.agents/skills/indeed-search/SKILL.md`
- Create: `.agents/skills/indeed-search/cli/package.json`
- Create: `.agents/skills/indeed-search/cli/src/cli.ts`

- [ ] **Step 1: Create SKILL.md**

Create `.agents/skills/indeed-search/SKILL.md`:

```markdown
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

\`\`\`bash
bun run skills/indeed-search/cli/src/cli.ts search [flags]
\`\`\`

Key flags:
- \`--keywords <text>\` — search terms (job title, skill, company)
- \`--location <text>\` — location (default: "United Kingdom")
- \`--radius <miles>\` — radius from location
- \`--type <value>\` — full-time, part-time, contract, permanent, temporary, apprenticeship
- \`--remote\` — remote jobs only
- \`--salary <value>\` — minimum salary filter
- \`--since <value>\` — last-24h, last-3d, last-7d, last-14d
- \`--experience <value>\` — experience level filter
- \`--limit <n>\` — max results (default: 25)
- \`--format json|table|plain\`

### Full job detail

\`\`\`bash
bun run skills/indeed-search/cli/src/cli.ts detail <id-or-url> [--format json|plain]
\`\`\`

Accepts an Indeed job key or full URL. Returns full job description, company info, and requirements.

---

## Usage examples

### Search for data engineer jobs in London

\`\`\`bash
bun run skills/indeed-search/cli/src/cli.ts search \
  --keywords "data engineer" \
  --location "London" \
  --type full-time \
  --format table
\`\`\`

### Remote software engineering roles posted this week

\`\`\`bash
bun run skills/indeed-search/cli/src/cli.ts search \
  --keywords "software engineer" \
  --remote \
  --since last-7d \
  --format table
\`\`\`

### Full details for a specific job

\`\`\`bash
bun run skills/indeed-search/cli/src/cli.ts detail abc123xyz --format plain
\`\`\`

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
```

- [ ] **Step 2: Create package.json**

Create `.agents/skills/indeed-search/cli/package.json`:

```json
{
  "name": "indeed-search-cli",
  "version": "1.0.0",
  "description": "CLI for Indeed UK job search using Playwright",
  "type": "module",
  "main": "src/cli.ts",
  "bin": {
    "indeed-search": "src/cli.ts"
  },
  "scripts": {
    "start": "bun run src/cli.ts",
    "test": "bun test --timeout 30000",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@bunli/core": "latest",
    "@bunli/utils": "latest",
    "job-search-shared": "file:../../shared/cli",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Create CLI entry point**

Create `.agents/skills/indeed-search/cli/src/cli.ts`:

```typescript
import { createCLI } from "@bunli/core"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"

const cli = await createCLI({
  name: "indeed-search",
  version: "1.0.0",
  description: "Search UK job listings on Indeed (uk.indeed.com)",
})

cli.command(search)
cli.command(detail)

await cli.run()
```

- [ ] **Step 4: Install dependencies**

```bash
cd .agents/skills/indeed-search/cli && bun install
```

- [ ] **Step 5: Commit**

```bash
git add .agents/skills/indeed-search/
git commit -m "feat: scaffold indeed-search skill (SKILL.md, package.json, cli entry)"
```

---

### Task 13: Create Indeed skill — scraper module

**Files:**
- Create: `.agents/skills/indeed-search/cli/src/scraper.ts`

- [ ] **Step 1: Write tests for scraper extraction functions**

Create `.agents/skills/indeed-search/cli/tests/scraper.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import { buildSearchUrl, parseJsonLd } from "../src/scraper.js"

describe("buildSearchUrl", () => {
  test("builds URL with keywords and location", () => {
    const url = buildSearchUrl({ keywords: "data engineer", location: "London" })
    expect(url).toContain("uk.indeed.com/jobs")
    expect(url).toContain("q=data+engineer")
    expect(url).toContain("l=London")
  })

  test("builds URL with job type filter", () => {
    const url = buildSearchUrl({ keywords: "developer", jobType: "full-time" })
    expect(url).toContain("jt=fulltime")
  })

  test("builds URL with since filter", () => {
    const url = buildSearchUrl({ since: "last-24h" })
    expect(url).toContain("fromage=1")
  })

  test("builds URL with remote filter", () => {
    const url = buildSearchUrl({ remote: true })
    expect(url).toContain("remotejob=032b3046-06a3-4876-8dfd-474eb5e7ed11")
  })

  test("builds URL with radius filter", () => {
    const url = buildSearchUrl({ keywords: "test", radius: 15 })
    expect(url).toContain("radius=15")
  })

  test("uses default location when none provided", () => {
    const url = buildSearchUrl({ keywords: "test" })
    expect(url).toContain("l=United+Kingdom")
  })

  test("builds URL with salary filter", () => {
    const url = buildSearchUrl({ keywords: "test", salary: "50000" })
    expect(url).toContain("salary=50000")
  })
})

describe("parseJsonLd", () => {
  test("extracts job data from JSON-LD", () => {
    const jsonLd = {
      "@type": "JobPosting",
      title: "Senior Data Engineer",
      hiringOrganization: {
        "@type": "Organization",
        name: "BigCo Ltd",
        logo: "https://example.com/logo.png",
        sameAs: "https://bigco.com",
      },
      jobLocation: {
        address: {
          addressLocality: "London",
          addressRegion: "England",
          addressCountry: "GB",
        },
      },
      description: "<p>A great role...</p>",
      datePosted: "2026-03-28",
      validThrough: "2026-04-28",
      employmentType: "FULL_TIME",
    }

    const result = parseJsonLd(jsonLd)
    expect(result.title).toBe("Senior Data Engineer")
    expect(result.company).toBe("BigCo Ltd")
    expect(result.location).toContain("London")
    expect(result.description).toContain("A great role")
    expect(result.posted).toBe("2026-03-28")
    expect(result.deadline).toBe("2026-04-28")
    expect(result.employmentType).toContain("FULL_TIME")
    expect(result.companyInfo.name).toBe("BigCo Ltd")
  })

  test("handles array employment type", () => {
    const jsonLd = {
      "@type": "JobPosting",
      title: "Test",
      employmentType: ["FULL_TIME", "CONTRACTOR"],
      hiringOrganization: { name: "X" },
      jobLocation: { address: { addressLocality: "Y" } },
      description: "desc",
    }
    const result = parseJsonLd(jsonLd)
    expect(result.employmentType).toEqual(["FULL_TIME", "CONTRACTOR"])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd .agents/skills/indeed-search/cli && bun test tests/scraper.test.ts
```

Expected: FAIL — imports not found

- [ ] **Step 3: Write scraper.ts**

Create `.agents/skills/indeed-search/cli/src/scraper.ts`:

```typescript
import type { Page } from "playwright"
import type { JobListing, JobDetail } from "job-search-shared/types"
import { randomDelay } from "job-search-shared/browser"

// --- Indeed URL parameter mappings ---

const JOB_TYPE_MAP: Record<string, string> = {
  "full-time": "fulltime",
  "part-time": "parttime",
  "contract": "contract",
  "permanent": "permanent",
  "temporary": "temporary",
  "apprenticeship": "apprenticeship",
}

const SINCE_MAP: Record<string, string> = {
  "last-24h": "1",
  "last-3d": "3",
  "last-7d": "7",
  "last-14d": "14",
}

// Indeed's remote job attribute ID
const REMOTE_ATTR = "032b3046-06a3-4876-8dfd-474eb5e7ed11"

// --- URL builder ---

interface SearchParams {
  keywords?: string | null
  location?: string | null
  radius?: number | null
  jobType?: string | null
  remote?: boolean | null
  salary?: string | null
  since?: string | null
  start?: number
}

export function buildSearchUrl(params: SearchParams): string {
  const base = "https://uk.indeed.com/jobs"
  const qs = new URLSearchParams()

  if (params.keywords) qs.set("q", params.keywords)
  qs.set("l", params.location ?? "United Kingdom")
  if (params.radius != null) qs.set("radius", String(params.radius))
  if (params.jobType && JOB_TYPE_MAP[params.jobType]) qs.set("jt", JOB_TYPE_MAP[params.jobType])
  if (params.remote) qs.set("remotejob", REMOTE_ATTR)
  if (params.salary) qs.set("salary", params.salary)
  if (params.since && SINCE_MAP[params.since]) qs.set("fromage", SINCE_MAP[params.since])
  if (params.start && params.start > 0) qs.set("start", String(params.start))

  return `${base}?${qs.toString()}`
}

// --- JSON-LD parsing ---

interface JsonLdData {
  "@type"?: string
  title?: string
  hiringOrganization?: {
    "@type"?: string
    name?: string
    logo?: string
    sameAs?: string
  }
  jobLocation?: {
    address?: {
      streetAddress?: string
      addressLocality?: string
      addressRegion?: string
      postalCode?: string
      addressCountry?: string
    }
  }
  description?: string
  datePosted?: string
  validThrough?: string
  employmentType?: string | string[]
  baseSalary?: {
    value?: { minValue?: number; maxValue?: number; unitText?: string }
  }
}

export function parseJsonLd(data: JsonLdData): {
  title: string
  company: string
  location: string
  description: string
  posted: string | null
  deadline: string | null
  employmentType: string[]
  salary: string | null
  companyInfo: { name: string; logo: string | null; url: string | null }
} {
  const org = data.hiringOrganization ?? {}
  const addr = data.jobLocation?.address ?? {}

  const locationParts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean)

  const employmentType = Array.isArray(data.employmentType)
    ? data.employmentType
    : data.employmentType
      ? [data.employmentType]
      : []

  let salary: string | null = null
  if (data.baseSalary?.value) {
    const v = data.baseSalary.value
    if (v.minValue && v.maxValue) {
      salary = `\u00a3${v.minValue.toLocaleString()} - \u00a3${v.maxValue.toLocaleString()} ${v.unitText ?? ""}`
    } else if (v.minValue) {
      salary = `\u00a3${v.minValue.toLocaleString()} ${v.unitText ?? ""}`
    }
  }

  return {
    title: data.title ?? "",
    company: org.name ?? "",
    location: locationParts.join(", "),
    description: data.description ?? "",
    posted: data.datePosted ?? null,
    deadline: data.validThrough ?? null,
    employmentType,
    salary,
    companyInfo: {
      name: org.name ?? "",
      logo: org.logo ?? null,
      url: org.sameAs ?? null,
    },
  }
}

// --- Cookie consent handling ---

async function dismissCookieConsent(page: Page): Promise<void> {
  try {
    const consentButton = page.locator(
      "#onetrust-accept-btn-handler, [data-testid='consent-accept'], button:has-text('Accept')"
    )
    if (await consentButton.isVisible({ timeout: 3000 })) {
      await consentButton.click()
      await randomDelay(300, 500)
    }
  } catch {
    // No consent banner — that's fine
  }
}

// --- Page-level scraping ---

export async function scrapeSearchResults(page: Page, limit: number): Promise<{ total: number; results: JobListing[] }> {
  await dismissCookieConsent(page)

  // Extract total count from search header
  const total = await page.$eval(
    ".jobsearch-JobCountAndSortPane-jobCount, [data-testid='jobCount']",
    (el) => {
      const text = el.textContent ?? ""
      const match = text.replace(/,/g, "").match(/(\d+)/)
      return match ? parseInt(match[1], 10) : 0
    }
  ).catch(() => 0)

  const results: JobListing[] = []
  const seenIds = new Set<string>()

  // Extract job cards from current page
  const cards = await page.$$eval(
    ".job_seen_beacon, .resultContent, [data-jk]",
    (elements) =>
      elements.map((el) => {
        // Job key is in data-jk attribute or parent
        const jk = el.getAttribute("data-jk")
          ?? el.closest("[data-jk]")?.getAttribute("data-jk")
          ?? ""

        const titleEl = el.querySelector("h2.jobTitle a, [data-testid='jobTitle'] a, a[id^='job_']")
        const companyEl = el.querySelector("[data-testid='company-name'], .companyName, .company")
        const locationEl = el.querySelector("[data-testid='text-location'], .companyLocation, .location")
        const salaryEl = el.querySelector("[data-testid='attribute_snippet_testid'], .salary-snippet-container, .estimated-salary")
        const dateEl = el.querySelector(".date, [data-testid='myJobsStateDate']")

        return {
          id: jk,
          title: titleEl?.textContent?.trim() ?? "",
          company: companyEl?.textContent?.trim() ?? "",
          location: locationEl?.textContent?.trim() ?? "",
          salary: salaryEl?.textContent?.trim() ?? null,
          posted: dateEl?.textContent?.trim() ?? null,
        }
      })
  )

  for (const card of cards) {
    if (!card.id || seenIds.has(card.id)) continue
    seenIds.add(card.id)
    results.push({
      ...card,
      jobType: null,
      deadline: null,
      url: `https://uk.indeed.com/viewjob?jk=${card.id}`,
      source: "indeed",
    })
    if (results.length >= limit) break
  }

  return { total, results }
}

export async function scrapeJobDetail(page: Page): Promise<Omit<JobDetail, "source" | "id" | "url"> | null> {
  await dismissCookieConsent(page)

  // Try JSON-LD first
  const jsonLdText = await page.$eval(
    'script[type="application/ld+json"]',
    (el) => el.textContent ?? ""
  ).catch(() => "")

  if (jsonLdText) {
    try {
      const jsonLdData = JSON.parse(jsonLdText) as JsonLdData
      if (jsonLdData["@type"] === "JobPosting") {
        const parsed = parseJsonLd(jsonLdData)
        return {
          ...parsed,
          jobType: parsed.employmentType[0]?.toLowerCase().replace("_", "-") ?? null,
          remote: null,
          requirements: null,
        }
      }
    } catch {
      // JSON-LD parse failed — fall back to DOM extraction
    }
  }

  // Fallback: DOM extraction
  return page.evaluate(() => {
    const titleEl = document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"], .jobsearch-JobInfoHeader-title, h1')
    const companyEl = document.querySelector('[data-testid="inlineHeader-companyName"] a, .jobsearch-InlineCompanyRating a, [data-company-name]')
    const locationEl = document.querySelector('[data-testid="inlineHeader-companyLocation"], .jobsearch-InlineCompanyRating + div')
    const descEl = document.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText')
    const salaryEl = document.querySelector('#salaryInfoAndJobType, [data-testid="attribute_snippet_testid"]')

    return {
      title: titleEl?.textContent?.trim() ?? "",
      company: companyEl?.textContent?.trim() ?? "",
      location: locationEl?.textContent?.trim() ?? "",
      jobType: null,
      salary: salaryEl?.textContent?.trim() ?? null,
      posted: null,
      deadline: null,
      description: descEl?.innerHTML?.trim() ?? "",
      employmentType: [],
      remote: null,
      companyInfo: {
        name: companyEl?.textContent?.trim() ?? "",
        logo: null,
        url: (companyEl as HTMLAnchorElement | null)?.href ?? null,
      },
      requirements: null,
    }
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd .agents/skills/indeed-search/cli && bun test tests/scraper.test.ts
```

Expected: 9 tests pass (7 buildSearchUrl + 2 parseJsonLd)

- [ ] **Step 5: Commit**

```bash
git add .agents/skills/indeed-search/cli/src/scraper.ts .agents/skills/indeed-search/cli/tests/scraper.test.ts
git commit -m "feat: add Indeed scraper module (URL builder, JSON-LD parser, page scraping)"
```

---

### Task 14: Create Indeed skill — search command

**Files:**
- Create: `.agents/skills/indeed-search/cli/src/commands/search.ts`

- [ ] **Step 1: Write search command**

Create `.agents/skills/indeed-search/cli/src/commands/search.ts`:

```typescript
import { z } from "zod"
import { defineCommand, option } from "@bunli/core"
import { launchBrowser, newPage, randomDelay } from "job-search-shared/browser"
import { formatOutput, writeError } from "job-search-shared/formatting"
import type { JobListing, SearchResponse } from "job-search-shared/types"
import { buildSearchUrl, scrapeSearchResults } from "../scraper.js"

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

        // Wait for job results to appear
        try {
          await page.waitForSelector(
            ".job_seen_beacon, .resultContent, [data-jk]",
            { timeout: 10_000 }
          )
        } catch {
          // No results on this page
          break
        }

        const { total, results } = await scrapeSearchResults(page, flags.limit - allResults.length)

        if (start === 0) totalCount = total
        if (results.length === 0) break

        allResults.push(...results)
        start += results.length

        // Rate limiting between pages
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
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add .agents/skills/indeed-search/cli/src/commands/search.ts
git commit -m "feat: add Indeed search command (filters, pagination, cookie consent)"
```

---

### Task 15: Create Indeed skill — detail command

**Files:**
- Create: `.agents/skills/indeed-search/cli/src/commands/detail.ts`

- [ ] **Step 1: Write detail command**

Create `.agents/skills/indeed-search/cli/src/commands/detail.ts`:

```typescript
import { z } from "zod"
import { defineCommand, option } from "@bunli/core"
import { launchBrowser, newPage } from "job-search-shared/browser"
import { formatOutput, writeError } from "job-search-shared/formatting"
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

    // Determine the job URL
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

    const browser = await launchBrowser()

    try {
      const page = await newPage(browser, "indeed")
      await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })

      // Wait for job content to appear
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

      const detail: JobDetail = {
        ...scraped,
        id: jobId,
        url: jobUrl,
        source: "indeed",
      }

      process.stdout.write(formatOutput(detail, flags.format) + "\n")
    } catch (error) {
      writeError(
        error instanceof Error ? error.message : "Detail fetch failed",
        "DETAIL_FAILED"
      )
      process.exit(1)
    } finally {
      await browser.close()
    }
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add .agents/skills/indeed-search/cli/src/commands/detail.ts
git commit -m "feat: add Indeed detail command (JSON-LD + DOM extraction)"
```

---

### Task 16: Create Indeed skill — test helper and smoke test

**Files:**
- Create: `.agents/skills/indeed-search/cli/tests/helpers.ts`

- [ ] **Step 1: Create test helper**

Create `.agents/skills/indeed-search/cli/tests/helpers.ts`:

```typescript
import { join } from "path"

const CLI_PATH = join(import.meta.dir, "../src/cli.ts")

export interface CLIResult {
  stdout: string
  stderr: string
  exitCode: number
}

export async function runCLI(args: string[]): Promise<CLIResult> {
  const proc = Bun.spawn(["bun", "run", CLI_PATH, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}

export function parseJSON<T = unknown>(result: CLIResult): T {
  if (result.exitCode !== 0) {
    throw new Error(
      `CLI exited with code ${result.exitCode}. stderr: ${result.stderr}`
    )
  }
  try {
    return JSON.parse(result.stdout) as T
  } catch {
    throw new Error(
      `Failed to parse JSON. stdout: ${result.stdout}\nstderr: ${result.stderr}`
    )
  }
}
```

- [ ] **Step 2: Write smoke test for --help**

Create `.agents/skills/indeed-search/cli/tests/cli.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("indeed-search CLI", () => {
  test("--help prints usage info", async () => {
    const result = await runCLI(["--help"])
    expect(result.stdout + result.stderr).toContain("indeed-search")
  })

  test("search --help prints search options", async () => {
    const result = await runCLI(["search", "--help"])
    expect(result.stdout + result.stderr).toContain("keywords")
  })

  test("detail --help prints detail options", async () => {
    const result = await runCLI(["detail", "--help"])
    expect(result.stdout + result.stderr).toContain("format")
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd .agents/skills/indeed-search/cli && bun test
```

Expected: All tests pass (scraper unit tests + CLI smoke tests)

- [ ] **Step 4: Commit**

```bash
git add .agents/skills/indeed-search/cli/tests/
git commit -m "test: add Indeed CLI test helpers and smoke tests"
```

---

### Task 17: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Run all shared tests**

```bash
cd .agents/skills/shared/cli && bun test
```

Expected: All types, formatting, and browser tests pass.

- [ ] **Step 2: Run all LinkedIn tests**

```bash
cd .agents/skills/linkedin-search/cli && bun test
```

Expected: All scraper unit tests and CLI smoke tests pass.

- [ ] **Step 3: Run all Indeed tests**

```bash
cd .agents/skills/indeed-search/cli && bun test
```

Expected: All scraper unit tests and CLI smoke tests pass.

- [ ] **Step 4: Verify directory structure is correct**

```bash
find .agents/skills -type f -name "*.ts" -o -name "*.json" -o -name "*.md" | sort
```

Expected output should show:
- `.agents/skills/shared/cli/` with package.json, src/ (types, browser, formatting, index), tests/
- `.agents/skills/linkedin-search/` with SKILL.md, cli/ (package.json, src/cli, commands/*, scraper), tests/
- `.agents/skills/indeed-search/` with SKILL.md, cli/ (package.json, src/cli, commands/*, scraper), tests/
- No `jobbank-search`, `jobdanmark-search`, `jobindex-search`, or `jobnet-search` directories

- [ ] **Step 5: Verify Playwright browser is installed**

```bash
cd .agents/skills/shared/cli && bunx playwright install chromium --dry-run 2>&1 || echo "Playwright Chromium check done"
```

- [ ] **Step 6: Final commit (if any uncommitted changes)**

```bash
git status
```

If clean, move on. Otherwise:

```bash
git add -A .agents/skills/
git commit -m "chore: final verification and cleanup for UK job search skills"
```
