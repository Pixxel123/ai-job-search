import { describe, expect, test } from "bun:test"
import { getServiceUrl, getComposePath } from "../src/docker.js"

describe("getServiceUrl", () => {
  test("returns localhost URL on port 8004", () => {
    const url = getServiceUrl()
    expect(url).toBe("http://localhost:8004")
  })
})

describe("getComposePath", () => {
  test("returns path ending with docker-compose.yml", () => {
    const path = getComposePath()
    expect(path).toContain("docker-compose.yml")
    expect(path).toContain("shared")
  })
})
