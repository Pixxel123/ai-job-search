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
