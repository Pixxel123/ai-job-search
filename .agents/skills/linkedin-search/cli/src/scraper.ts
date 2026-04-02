import type { Page } from "playwright"
import type { JobListing, JobDetail } from "job-search-shared/types"
import { randomDelay } from "job-search-shared/browser"

// --- LinkedIn URL parameter mappings ---

const JOB_TYPE_MAP: Record<string, string> = {
  "full-time": "F",
  "part-time": "P",
  "contract": "C",
  "permanent": "F",
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

// --- HTML parsing (for unit tests) ---

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
    if (results.length === previousCount) break
    previousCount = results.length

    await page.evaluate(() => {
      const list = document.querySelector(".jobs-search-results-list, .scaffold-layout__list")
      if (list) list.scrollTop = list.scrollHeight
    })
    await randomDelay(500, 1200)
  }

  return results.slice(0, limit)
}

export async function scrapeJobDetail(page: Page): Promise<Omit<JobDetail, "source" | "id" | "url"> | null> {
  try {
    const seeMore = page.locator("button.jobs-description__footer-button, button[aria-label*='See more']")
    if (await seeMore.isVisible({ timeout: 2000 })) {
      await seeMore.click()
      await randomDelay(300, 600)
    }
  } catch {
    // "See more" not present — fine
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
