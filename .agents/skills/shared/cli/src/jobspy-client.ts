import { getServiceUrl } from "./docker.js"
import { loadCookies } from "./browser.js"
import type { JobListing, JobDetail } from "./types.js"

// --- JobSpy response types ---

export interface JobSpyResult {
  title: string
  company_name: string
  location: string
  job_url: string
  date_posted: string | null
  job_type: string | null
  min_amount: number | null
  max_amount: number | null
  currency: string | null
  is_remote: boolean
  description: string
  company_url?: string | null
  logo_photo_url?: string | null
}

// --- ID extraction ---

function extractIdFromUrl(url: string, source: "linkedin" | "indeed"): string {
  if (source === "linkedin") {
    const match = url.match(/\/jobs\/view\/(\d+)/)
    if (match) return match[1]
  }
  if (source === "indeed") {
    const match = url.match(/jk=([a-zA-Z0-9]+)/)
    if (match) return match[1]
  }
  return url
}

// --- Salary formatting ---

function formatSalary(raw: JobSpyResult): string | null {
  if (raw.min_amount == null && raw.max_amount == null) return null
  const currency = raw.currency === "GBP" ? "\u00a3" : raw.currency === "USD" ? "$" : (raw.currency ?? "")
  if (raw.min_amount != null && raw.max_amount != null) {
    return `${currency}${raw.min_amount.toLocaleString()} - ${currency}${raw.max_amount.toLocaleString()}`
  }
  if (raw.min_amount != null) {
    return `${currency}${raw.min_amount.toLocaleString()}`
  }
  return `${currency}${raw.max_amount!.toLocaleString()}`
}

// --- Job type mapping ---

const JOB_TYPE_MAP: Record<string, string> = {
  fulltime: "FULL_TIME",
  parttime: "PART_TIME",
  contract: "CONTRACT",
  internship: "INTERNSHIP",
  temporary: "TEMPORARY",
}

// --- Result mapping ---

export function mapJobSpyResult(raw: JobSpyResult, source: "linkedin" | "indeed"): JobListing {
  return {
    id: extractIdFromUrl(raw.job_url, source),
    title: raw.title,
    company: raw.company_name,
    location: raw.location,
    jobType: raw.job_type ?? null,
    salary: formatSalary(raw),
    url: raw.job_url,
    posted: raw.date_posted ?? null,
    deadline: null,
    source,
  }
}

export function mapJobSpyToDetail(raw: JobSpyResult, source: "linkedin" | "indeed"): JobDetail {
  const listing = mapJobSpyResult(raw, source)
  return {
    ...listing,
    description: raw.description,
    employmentType: raw.job_type && JOB_TYPE_MAP[raw.job_type] ? [JOB_TYPE_MAP[raw.job_type]] : [],
    remote: raw.is_remote ? "remote" : null,
    companyInfo: {
      name: raw.company_name,
      logo: raw.logo_photo_url ?? null,
      url: raw.company_url ?? null,
    },
    requirements: null,
  }
}

// --- Search params builder ---

export interface JobSpySearchInput {
  site: "linkedin" | "indeed"
  keywords?: string | null
  location?: string | null
  distance?: number | null
  jobType?: string | null
  isRemote?: boolean | null
  hoursOld?: number | null
  limit?: number
  linkedInCookie?: string | null
}

export function buildSearchParams(input: JobSpySearchInput): URLSearchParams {
  const params = new URLSearchParams()
  params.set("site_name", input.site)
  if (input.keywords) params.set("search_term", input.keywords)
  if (input.location) params.set("location", input.location)
  if (input.distance != null) params.set("distance", String(input.distance))
  if (input.jobType) params.set("job_type", input.jobType)
  if (input.isRemote) params.set("is_remote", "true")
  if (input.hoursOld != null) params.set("hours_old", String(input.hoursOld))
  params.set("results_wanted", String(input.limit ?? 25))

  if (input.site === "linkedin") {
    params.set("linkedin_fetch_description", "true")
    if (input.linkedInCookie) params.set("linkedin_cookie", input.linkedInCookie)
  }

  if (input.site === "indeed") {
    params.set("country_indeed", "UK")
  }

  return params
}

// --- API calls ---

export async function isServiceAvailable(): Promise<boolean> {
  try {
    const resp = await fetch(`${getServiceUrl()}/docs`, { signal: AbortSignal.timeout(3000) })
    return resp.ok
  } catch {
    return false
  }
}

export async function searchJobs(input: JobSpySearchInput): Promise<{ results: JobListing[]; raw: JobSpyResult[] }> {
  const params = buildSearchParams(input)
  const url = `${getServiceUrl()}/api/v1/search_jobs?${params.toString()}`

  const resp = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!resp.ok) {
    throw new Error(`jobspy-api returned ${resp.status}: ${await resp.text()}`)
  }

  const data = await resp.json() as JobSpyResult[]
  const results = data.map((r) => mapJobSpyResult(r, input.site))
  return { results, raw: data }
}

export function getLinkedInCookie(baseDir?: string): string | null {
  const cookies = loadCookies("linkedin", baseDir)
  const liAt = cookies.find((c) => c.name === "li_at")
  return liAt?.value ?? null
}
