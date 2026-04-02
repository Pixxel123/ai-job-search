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
