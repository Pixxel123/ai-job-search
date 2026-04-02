import { describe, expect, test } from "bun:test"
import { mapJobSpyResult, mapJobSpyToDetail, buildSearchParams, getLinkedInCookie } from "../src/jobspy-client.js"

describe("mapJobSpyResult", () => {
  test("maps a LinkedIn result to JobListing", () => {
    const raw = {
      title: "Senior Data Engineer",
      company_name: "Acme Corp",
      location: "London, England, United Kingdom",
      job_url: "https://www.linkedin.com/jobs/view/3847291056",
      date_posted: "2026-03-28",
      job_type: "fulltime",
      min_amount: 60000,
      max_amount: 80000,
      currency: "GBP",
      is_remote: false,
      description: "<p>Great role</p>",
    }
    const listing = mapJobSpyResult(raw, "linkedin")
    expect(listing.id).toBe("3847291056")
    expect(listing.title).toBe("Senior Data Engineer")
    expect(listing.company).toBe("Acme Corp")
    expect(listing.location).toBe("London, England, United Kingdom")
    expect(listing.source).toBe("linkedin")
    expect(listing.url).toBe("https://www.linkedin.com/jobs/view/3847291056")
    expect(listing.posted).toBe("2026-03-28")
    expect(listing.salary).toContain("60,000")
    expect(listing.salary).toContain("80,000")
  })

  test("maps an Indeed result to JobListing", () => {
    const raw = {
      title: "Python Developer",
      company_name: "BigCo",
      location: "Manchester",
      job_url: "https://uk.indeed.com/viewjob?jk=abc123xyz",
      date_posted: "2026-03-30",
      job_type: null,
      min_amount: null,
      max_amount: null,
      currency: null,
      is_remote: true,
      description: "A Python role",
    }
    const listing = mapJobSpyResult(raw, "indeed")
    expect(listing.id).toBe("abc123xyz")
    expect(listing.source).toBe("indeed")
    expect(listing.salary).toBeNull()
  })

  test("extracts ID from LinkedIn URL", () => {
    const raw = {
      title: "Test",
      company_name: "Test",
      location: "Test",
      job_url: "https://www.linkedin.com/jobs/view/9999999999",
      date_posted: null,
      job_type: null,
      min_amount: null,
      max_amount: null,
      currency: null,
      is_remote: false,
      description: "",
    }
    const listing = mapJobSpyResult(raw, "linkedin")
    expect(listing.id).toBe("9999999999")
  })

  test("falls back to full URL as ID when no pattern matches", () => {
    const raw = {
      title: "Test",
      company_name: "Test",
      location: "Test",
      job_url: "https://example.com/some-job",
      date_posted: null,
      job_type: null,
      min_amount: null,
      max_amount: null,
      currency: null,
      is_remote: false,
      description: "",
    }
    const listing = mapJobSpyResult(raw, "linkedin")
    expect(listing.id).toBe("https://example.com/some-job")
  })
})

describe("mapJobSpyToDetail", () => {
  test("maps a full result to JobDetail", () => {
    const raw = {
      title: "Senior Data Engineer",
      company_name: "Acme Corp",
      location: "London",
      job_url: "https://www.linkedin.com/jobs/view/12345",
      date_posted: "2026-03-28",
      job_type: "fulltime",
      min_amount: 60000,
      max_amount: 80000,
      currency: "GBP",
      is_remote: true,
      description: "<p>We need a senior engineer</p>",
      company_url: "https://acme.com",
      logo_photo_url: "https://acme.com/logo.png",
    }
    const detail = mapJobSpyToDetail(raw, "linkedin")
    expect(detail.description).toBe("<p>We need a senior engineer</p>")
    expect(detail.remote).toBe("remote")
    expect(detail.companyInfo.name).toBe("Acme Corp")
    expect(detail.companyInfo.url).toBe("https://acme.com")
    expect(detail.companyInfo.logo).toBe("https://acme.com/logo.png")
    expect(detail.employmentType).toContain("FULL_TIME")
  })
})

describe("buildSearchParams", () => {
  test("builds params for LinkedIn search", () => {
    const params = buildSearchParams({
      site: "linkedin",
      keywords: "data engineer",
      location: "London",
      limit: 25,
    })
    expect(params.get("site_name")).toBe("linkedin")
    expect(params.get("search_term")).toBe("data engineer")
    expect(params.get("location")).toBe("London")
    expect(params.get("results_wanted")).toBe("25")
    expect(params.get("linkedin_fetch_description")).toBe("true")
  })

  test("builds params for Indeed search with UK country", () => {
    const params = buildSearchParams({
      site: "indeed",
      keywords: "developer",
      location: "Manchester",
      limit: 10,
    })
    expect(params.get("site_name")).toBe("indeed")
    expect(params.get("country_indeed")).toBe("UK")
  })

  test("includes job type when provided", () => {
    const params = buildSearchParams({
      site: "linkedin",
      keywords: "test",
      jobType: "fulltime",
      limit: 10,
    })
    expect(params.get("job_type")).toBe("fulltime")
  })

  test("includes remote flag", () => {
    const params = buildSearchParams({
      site: "indeed",
      keywords: "test",
      isRemote: true,
      limit: 10,
    })
    expect(params.get("is_remote")).toBe("true")
  })

  test("includes hours_old for date filter", () => {
    const params = buildSearchParams({
      site: "linkedin",
      keywords: "test",
      hoursOld: 24,
      limit: 10,
    })
    expect(params.get("hours_old")).toBe("24")
  })

  test("includes distance when provided", () => {
    const params = buildSearchParams({
      site: "linkedin",
      keywords: "test",
      distance: 25,
      limit: 10,
    })
    expect(params.get("distance")).toBe("25")
  })
})

describe("getLinkedInCookie", () => {
  test("returns null when no cookies file exists", () => {
    const cookie = getLinkedInCookie("/tmp/nonexistent-config-dir-12345")
    expect(cookie).toBeNull()
  })
})
