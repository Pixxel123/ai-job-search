import { describe, expect, test } from "bun:test"
import { formatOutput, writeError } from "../src/formatting.js"
import type { JobListing } from "../src/types.js"

const sampleListing: JobListing = {
  id: "12345",
  title: "Senior Software Engineer",
  company: "Acme Corp",
  location: "London, UK",
  jobType: "full-time",
  salary: "\u00a360,000 - \u00a380,000",
  url: "https://linkedin.com/jobs/view/12345",
  posted: "2026-03-28",
  deadline: null,
  source: "linkedin",
}

describe("formatOutput", () => {
  test("json format returns valid JSON string", () => {
    const output = formatOutput({ meta: { total: 1 }, results: [sampleListing] }, "json")
    const parsed = JSON.parse(output)
    expect(parsed.meta.total).toBe(1)
    expect(parsed.results).toHaveLength(1)
    expect(parsed.results[0].title).toBe("Senior Software Engineer")
  })

  test("table format returns tab-separated rows with header", () => {
    const output = formatOutput({ meta: { total: 1 }, results: [sampleListing] }, "table")
    const lines = output.split("\n")
    expect(lines[0]).toContain("ID")
    expect(lines[0]).toContain("TITLE")
    expect(lines[0]).toContain("COMPANY")
    expect(lines[1]).toContain("12345")
    expect(lines[1]).toContain("Senior Software Engineer")
  })

  test("plain format returns human-readable text", () => {
    const output = formatOutput(sampleListing, "plain")
    expect(output).toContain("Senior Software Engineer")
    expect(output).toContain("Acme Corp")
    expect(output).toContain("London, UK")
  })

  test("json format handles single object (detail)", () => {
    const output = formatOutput(sampleListing, "json")
    const parsed = JSON.parse(output)
    expect(parsed.title).toBe("Senior Software Engineer")
  })
})

describe("writeError", () => {
  test("returns JSON error string", () => {
    expect(() => writeError("Not found", "NOT_FOUND")).not.toThrow()
  })
})
