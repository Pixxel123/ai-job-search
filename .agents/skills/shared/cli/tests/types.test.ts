import { describe, expect, test } from "bun:test"
import { JobListingSchema, JobDetailSchema, SearchFiltersSchema } from "../src/types.js"

describe("JobListingSchema", () => {
  test("validates a complete job listing", () => {
    const listing = {
      id: "12345",
      title: "Senior Software Engineer",
      company: "Acme Corp",
      location: "London, UK",
      jobType: "full-time",
      salary: "\u00a360,000 - \u00a380,000",
      url: "https://linkedin.com/jobs/view/12345",
      posted: "2026-03-28",
      deadline: null,
      source: "linkedin" as const,
    }
    const result = JobListingSchema.safeParse(listing)
    expect(result.success).toBe(true)
  })

  test("validates listing with null optional fields", () => {
    const listing = {
      id: "67890",
      title: "Data Analyst",
      company: "BigCo",
      location: "Manchester",
      jobType: null,
      salary: null,
      url: "https://uk.indeed.com/viewjob?jk=67890",
      posted: null,
      deadline: null,
      source: "indeed" as const,
    }
    const result = JobListingSchema.safeParse(listing)
    expect(result.success).toBe(true)
  })

  test("rejects invalid source", () => {
    const listing = {
      id: "1",
      title: "Test",
      company: "Test",
      location: "Test",
      jobType: null,
      salary: null,
      url: "https://example.com",
      posted: null,
      deadline: null,
      source: "glassdoor",
    }
    const result = JobListingSchema.safeParse(listing)
    expect(result.success).toBe(false)
  })
})

describe("JobDetailSchema", () => {
  test("validates a complete job detail", () => {
    const detail = {
      id: "12345",
      title: "Senior Software Engineer",
      company: "Acme Corp",
      location: "London, UK",
      jobType: "full-time",
      salary: "\u00a360,000 - \u00a380,000",
      url: "https://linkedin.com/jobs/view/12345",
      posted: "2026-03-28",
      deadline: null,
      source: "linkedin" as const,
      description: "<p>We are looking for a senior engineer...</p>",
      employmentType: ["FULL_TIME"],
      remote: "hybrid",
      companyInfo: {
        name: "Acme Corp",
        logo: "https://example.com/logo.png",
        url: "https://acme.com",
      },
      requirements: "5+ years experience in TypeScript",
    }
    const result = JobDetailSchema.safeParse(detail)
    expect(result.success).toBe(true)
  })
})

describe("SearchFiltersSchema", () => {
  test("applies defaults", () => {
    const result = SearchFiltersSchema.parse({})
    expect(result.location).toBe("United Kingdom")
    expect(result.limit).toBe(25)
    expect(result.keywords).toBeNull()
  })

  test("accepts all fields", () => {
    const filters = {
      keywords: "data engineer",
      location: "London",
      radius: 15,
      jobType: "full-time",
      remote: "remote",
      salary: "50000",
      datePosted: "7d",
      experienceLevel: "mid-senior",
      limit: 50,
    }
    const result = SearchFiltersSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })
})
