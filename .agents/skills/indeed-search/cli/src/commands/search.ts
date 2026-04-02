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
