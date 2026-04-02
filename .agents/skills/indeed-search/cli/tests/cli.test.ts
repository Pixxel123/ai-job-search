import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("indeed-search CLI", () => {
  test("--help prints usage info", async () => {
    const result = await runCLI(["--help"])
    expect(result.stdout + result.stderr).toContain("indeed-search")
  })

  test("search --help prints search options", async () => {
    const result = await runCLI(["search", "--help"])
    expect(result.stdout + result.stderr).toContain("keywords")
  })

  test("detail --help prints detail options", async () => {
    const result = await runCLI(["detail", "--help"])
    expect(result.stdout + result.stderr).toContain("format")
  })
})
