# Search Queries for Job Scraper

<!-- SETUP: Customize these queries based on your skills, target roles, and location -->

## Search Sites

Primary (CLI tools via jobspy-api):
- **LinkedIn** - via `linkedin-search` CLI skill (`.agents/skills/linkedin-search/`)
- **Indeed** - via `indeed-search` CLI skill (`.agents/skills/indeed-search/`)

Both use a self-hosted jobspy-api Docker backend with Playwright as fallback. Run `setup` in either CLI to start the Docker container.

Secondary (company career pages via Google):
- Direct Google searches with `site:` filters for known target companies

## Query Categories

Queries are grouped by priority. Each query should be combined with your location terms where the site supports it. Use the LinkedIn and Indeed CLI skills for structured searches, and Google `site:` queries for supplementary coverage.

### Priority 1: [YOUR_PRIMARY_ROLE_TYPE]

These match your strongest and most desired career direction.

```bash
# LinkedIn CLI
bun run skills/linkedin-search/cli/src/cli.ts search --keywords "[YOUR_PRIMARY_JOB_TITLE]" --location "[YOUR_CITY]" --format json

# Indeed CLI
bun run skills/indeed-search/cli/src/cli.ts search --keywords "[YOUR_PRIMARY_JOB_TITLE]" --location "[YOUR_CITY]" --format json

# Google fallback
site:linkedin.com/jobs "[YOUR_PRIMARY_JOB_TITLE]" [YOUR_COUNTRY]
```

### Priority 2: [YOUR_DOMAIN_EXPERTISE]

These match your domain expertise.

```bash
# LinkedIn CLI
bun run skills/linkedin-search/cli/src/cli.ts search --keywords "[YOUR_DOMAIN_KEYWORD_1]" --location "[YOUR_CITY]" --format json

# Indeed CLI
bun run skills/indeed-search/cli/src/cli.ts search --keywords "[YOUR_DOMAIN_KEYWORD_1]" --location "[YOUR_REGION]" --format json
```

### Priority 3: [YOUR_ADJACENT_ROLE_TYPE]

Adjacent roles you could pivot into.

```bash
# LinkedIn CLI
bun run skills/linkedin-search/cli/src/cli.ts search --keywords "[YOUR_ADJACENT_TITLE_1] [YOUR_KEY_SKILL]" --location "[YOUR_CITY]" --format json

# Indeed CLI
bun run skills/indeed-search/cli/src/cli.ts search --keywords "[YOUR_ADJACENT_TITLE_2] [YOUR_KEY_SKILL]" --location "[YOUR_CITY]" --format json
```

### Priority 4: Broader Technical / Consulting

Wider net for general technical roles.

```bash
# LinkedIn CLI
bun run skills/linkedin-search/cli/src/cli.ts search --keywords "[YOUR_KEY_SKILL] developer" --location "[YOUR_CITY]" --format json

# Indeed CLI
bun run skills/indeed-search/cli/src/cli.ts search --keywords "technical consultant [YOUR_DOMAIN]" --location "[YOUR_CITY]" --format json
```

## Location Filter

When evaluating results, verify the job location is within reasonable commute distance from your home. Define acceptable areas:
- [YOUR_CITY] and surrounding areas
- [ACCEPTABLE_AREA_1]
- [ACCEPTABLE_AREA_2]
- [BORDERLINE_AREA] (borderline - ~X min by transit)
- [TOO_FAR_AREA] (too far)

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries
