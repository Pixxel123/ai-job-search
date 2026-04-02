import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { resolve } from "path"
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs"
import { cookiePath, loadCookies, saveCookiesToDisk } from "../src/browser.js"

const TEST_CONFIG_DIR = resolve(import.meta.dir, "../.test-config")

describe("cookiePath", () => {
  test("returns path ending with site.json", () => {
    const p = cookiePath("linkedin", TEST_CONFIG_DIR)
    expect(p).toContain("linkedin.json")
    expect(p).toContain("cookies")
  })
})

describe("cookie persistence", () => {
  beforeAll(() => {
    mkdirSync(resolve(TEST_CONFIG_DIR, "cookies"), { recursive: true })
  })

  afterAll(() => {
    rmSync(TEST_CONFIG_DIR, { recursive: true, force: true })
  })

  test("loadCookies returns empty array when no file exists", () => {
    const cookies = loadCookies("nonexistent-site", TEST_CONFIG_DIR)
    expect(cookies).toEqual([])
  })

  test("saveCookiesToDisk writes and loadCookies reads back", () => {
    const fakeCookies = [
      { name: "session", value: "abc123", domain: ".linkedin.com", path: "/", expires: -1, httpOnly: true, secure: true, sameSite: "Lax" as const },
    ]
    saveCookiesToDisk(fakeCookies, "test-site", TEST_CONFIG_DIR)

    const loaded = loadCookies("test-site", TEST_CONFIG_DIR)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe("session")
    expect(loaded[0].value).toBe("abc123")
  })
})
