# Job Scraper

**name:** job-scraper
**description:** Searches LinkedIn and Indeed for new positions matching your profile using jobspy-api CLI tools. Deduplicates across runs. Triggers on: job scrape, find jobs, search jobs, new jobs, job search, scrape jobs, /scrape
**allowed-tools:** Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch, Agent, AskUserQuestion

---

## How It Works

This skill searches LinkedIn and Indeed using the CLI tools in `.agents/skills/` (powered by jobspy-api with Playwright fallback), deduplicates against previously seen jobs and the application tracker, and presents new matches with a quick fit assessment.

## Invocation

The user triggers this skill by saying things like:
- "Find new jobs"
- "Scrape for jobs"
- "Any new positions?"
- "/scrape"

Optional arguments:
- A focus area, e.g. "/scrape data science" or "/scrape geophysics"
- "broad" to run all search categories, e.g. "/scrape broad"

---

## Execution Steps

### Step 0: Load State

1. Read `job_scraper/seen_jobs.json` (create if missing - start with `{"seen": {}}`)
2. Read `job_search_tracker.csv` to extract already-applied companies+roles
3. Read `search-queries.md` (this directory) for the search strategy

### Step 1: Search via CLI tools

Use the LinkedIn and Indeed CLI tools as the **primary** search method. Build commands from `search-queries.md`, adapting the keywords, location, and filters for each priority category. By default, run the top 3 priority categories. If the user said "broad", run all categories.

If the user specified a focus area (e.g. "data science"), use it as the `--keywords` value.

**LinkedIn searches:**
```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run .agents/skills/linkedin-search/cli/src/cli.ts search \
  --keywords "<search terms>" \
  --location "<location>" \
  --since past-week \
  --limit 25 \
  --format json
```

**Indeed searches:**
```bash
bun run .agents/skills/indeed-search/cli/src/cli.ts search \
  --keywords "<search terms>" \
  --location "<location>" \
  --since last-7d \
  --limit 25 \
  --format json
```

Both output JSON with `{ "meta": { "total": N }, "results": [...] }`. Parse the JSON from stdout.

Use `WebSearch` with Google `site:` queries only as supplementary coverage for sites not covered by the CLI tools.

**Parallel execution:** Use the Agent tool to run LinkedIn and Indeed searches in parallel for speed.

### Step 2: Parse & Deduplicate

For each result from Step 1:
- The CLI tools return structured JSON — no need to fetch/parse HTML
- Each result has: `id`, `title`, `company`, `location`, `jobType`, `salary`, `url`, `posted`
- Skip if the URL or company+title combo already exists in `seen_jobs.json`
- Skip if the company+role already appears in `job_search_tracker.csv`
- For supplementary WebSearch results, use `WebFetch` to extract details from the job page

### Step 3: Quick Fit Assessment

For each new job, do a rapid fit check (NOT the full evaluation from `04-job-evaluation.md` - just a quick signal):

- **High match**: Role directly involves your core skills
- **Medium match**: Role is adjacent to your experience
- **Low match**: Role requires significant skills you lack

### Step 4: Deduplicate & Store

1. Add ALL fetched jobs (new and skipped) to `seen_jobs.json` with structure:
```json
{
  "seen": {
    "<url_or_company_title_key>": {
      "title": "...",
      "company": "...",
      "url": "...",
      "first_seen": "YYYY-MM-DD",
      "fit": "high/medium/low",
      "status": "new/skipped/evaluated"
    }
  }
}
```
2. Only present jobs NOT already in the seen list or tracker.

### Step 5: Present Results

Present new jobs in a table sorted by fit (high first):

```
## New Job Matches - YYYY-MM-DD

Found X new positions (Y high, Z medium, W low match).

| # | Fit | Title | Company | Location | Deadline | URL |
|---|-----|-------|---------|----------|----------|-----|
| 1 | High | ... | ... | ... | ... | [Link](...) |

### High-Match Highlights
For each high-match job, add 2-3 bullet points:
- Why it matches your profile
- Key requirements to check
- Any red flags
```

After presenting, ask:
> "Want me to evaluate any of these in detail? Just give me the number(s)."

If the user picks a number, invoke the **job-application-assistant** skill workflow (fit evaluation first, then CV + cover letter if approved).

### Step 6: Update Tracker (Optional)

If the user decides to apply to any job, add a row to `job_search_tracker.csv`.

---

## Important Rules

1. **Never fabricate job postings.** Only present jobs found via actual CLI tool or WebSearch/WebFetch results.
2. **Respect deduplication.** Always check seen_jobs.json AND job_search_tracker.csv before presenting.
3. **Focus on configured geographic area.** Skip jobs that require relocation or are clearly outside commute range.
4. **Only open positions.** Skip postings with expired deadlines or those marked as closed.
5. **CLI tools first.** Always use the LinkedIn and Indeed CLI tools as the primary search method. Fall back to WebSearch only for supplementary coverage.
6. **Parallel searches.** Use the Agent tool to run LinkedIn and Indeed CLI searches in parallel for speed.
7. **Bun path.** Always `export PATH="$HOME/.bun/bin:$PATH"` before running CLI tools.
