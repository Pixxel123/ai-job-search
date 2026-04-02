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

    let jobUrl: string
    if (idOrUrl.startsWith("http")) {
      jobUrl = idOrUrl
    } else {
      jobUrl = `https://www.linkedin.com/jobs/view/${idOrUrl}/`
    }

    const idMatch = jobUrl.match(/\/jobs\/view\/(\d+)/)
    const jobId = idMatch?.[1] ?? idOrUrl

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
