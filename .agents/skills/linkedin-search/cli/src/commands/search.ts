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
  },
})
