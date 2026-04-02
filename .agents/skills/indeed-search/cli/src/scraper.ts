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
    // No consent banner
  }
}

// --- Page-level scraping ---

export async function scrapeSearchResults(page: Page, limit: number): Promise<{ total: number; results: JobListing[] }> {
  await dismissCookieConsent(page)

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

  const cards = await page.$$eval(
    ".job_seen_beacon, .resultContent, [data-jk]",
    (elements) =>
      elements.map((el) => {
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
      // JSON-LD parse failed — fall back to DOM
    }
  }

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
