import { describe, expect, test } from "bun:test"
import { parseJobCard, buildSearchUrl } from "../src/scraper.js"

describe("buildSearchUrl", () => {
  test("builds URL with keywords and location", () => {
    const url = buildSearchUrl({ keywords: "data engineer", location: "London" })
    expect(url).toContain("linkedin.com/jobs/search")
    expect(url).toContain("keywords=data+engineer")
    expect(url).toContain("location=London")
  })

  test("builds URL with job type filter", () => {
    const url = buildSearchUrl({ keywords: "developer", jobType: "full-time" })
    expect(url).toContain("f_JT=F")
  })

  test("builds URL with remote filter", () => {
    const url = buildSearchUrl({ remote: "remote" })
    expect(url).toContain("f_WT=2")
  })

  test("builds URL with experience filter", () => {
    const url = buildSearchUrl({ experienceLevel: "mid-senior" })
    expect(url).toContain("f_E=4")
  })

  test("builds URL with since filter", () => {
    const url = buildSearchUrl({ since: "past-24h" })
    expect(url).toContain("f_TPR=r86400")
  })

  test("uses default location when none provided", () => {
    const url = buildSearchUrl({ keywords: "test" })
    expect(url).toContain("location=United+Kingdom")
  })
})

describe("parseJobCard", () => {
  test("extracts fields from HTML card", () => {
    const html = `
      <div class="job-card-container" data-job-id="3847291056">
        <a class="job-card-container__link" href="/jobs/view/3847291056/">
          <span class="sr-only">Senior Data Engineer</span>
        </a>
        <span class="job-card-container__primary-description">Acme Corp</span>
        <li class="job-card-container__metadata-item">London, England, United Kingdom</li>
      </div>
    `
    const card = parseJobCard(html)
    expect(card).not.toBeNull()
    expect(card!.id).toBe("3847291056")
    expect(card!.title).toBe("Senior Data Engineer")
    expect(card!.company).toBe("Acme Corp")
    expect(card!.location).toContain("London")
  })

  test("returns null for empty HTML", () => {
    const card = parseJobCard("")
    expect(card).toBeNull()
  })
})
