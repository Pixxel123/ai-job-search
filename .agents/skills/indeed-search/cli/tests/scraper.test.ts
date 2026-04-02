import { describe, expect, test } from "bun:test"
import { buildSearchUrl, parseJsonLd } from "../src/scraper.js"

describe("buildSearchUrl", () => {
  test("builds URL with keywords and location", () => {
    const url = buildSearchUrl({ keywords: "data engineer", location: "London" })
    expect(url).toContain("uk.indeed.com/jobs")
    expect(url).toContain("q=data+engineer")
    expect(url).toContain("l=London")
  })

  test("builds URL with job type filter", () => {
    const url = buildSearchUrl({ keywords: "developer", jobType: "full-time" })
    expect(url).toContain("jt=fulltime")
  })

  test("builds URL with since filter", () => {
    const url = buildSearchUrl({ since: "last-24h" })
    expect(url).toContain("fromage=1")
  })

  test("builds URL with remote filter", () => {
    const url = buildSearchUrl({ remote: true })
    expect(url).toContain("remotejob=032b3046-06a3-4876-8dfd-474eb5e7ed11")
  })

  test("builds URL with radius filter", () => {
    const url = buildSearchUrl({ keywords: "test", radius: 15 })
    expect(url).toContain("radius=15")
  })

  test("uses default location when none provided", () => {
    const url = buildSearchUrl({ keywords: "test" })
    expect(url).toContain("l=United+Kingdom")
  })

  test("builds URL with salary filter", () => {
    const url = buildSearchUrl({ keywords: "test", salary: "50000" })
    expect(url).toContain("salary=50000")
  })
})

describe("parseJsonLd", () => {
  test("extracts job data from JSON-LD", () => {
    const jsonLd = {
      "@type": "JobPosting",
      title: "Senior Data Engineer",
      hiringOrganization: {
        "@type": "Organization",
        name: "BigCo Ltd",
        logo: "https://example.com/logo.png",
        sameAs: "https://bigco.com",
      },
      jobLocation: {
        address: {
          addressLocality: "London",
          addressRegion: "England",
          addressCountry: "GB",
        },
      },
      description: "<p>A great role...</p>",
      datePosted: "2026-03-28",
      validThrough: "2026-04-28",
      employmentType: "FULL_TIME",
    }

    const result = parseJsonLd(jsonLd)
    expect(result.title).toBe("Senior Data Engineer")
    expect(result.company).toBe("BigCo Ltd")
    expect(result.location).toContain("London")
    expect(result.description).toContain("A great role")
    expect(result.posted).toBe("2026-03-28")
    expect(result.deadline).toBe("2026-04-28")
    expect(result.employmentType).toContain("FULL_TIME")
    expect(result.companyInfo.name).toBe("BigCo Ltd")
  })

  test("handles array employment type", () => {
    const jsonLd = {
      "@type": "JobPosting",
      title: "Test",
      employmentType: ["FULL_TIME", "CONTRACTOR"],
      hiringOrganization: { name: "X" },
      jobLocation: { address: { addressLocality: "Y" } },
      description: "desc",
    }
    const result = parseJsonLd(jsonLd)
    expect(result.employmentType).toEqual(["FULL_TIME", "CONTRACTOR"])
  })
})
