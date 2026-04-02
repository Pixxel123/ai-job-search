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

      process.stdout.write(formatOutput(jobDetail, flags.format) + "\n")
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
