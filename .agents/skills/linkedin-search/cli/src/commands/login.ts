import { defineCommand } from "@bunli/core"
import { launchBrowser, newPage, saveCookies } from "job-search-shared/browser"
import { writeError } from "job-search-shared/formatting"

export const login = defineCommand({
  name: "login",
  description: "Log in to LinkedIn (opens a visible browser window for manual login)",
  handler: async () => {
    const browser = await launchBrowser({ headed: true })

    try {
      const page = await newPage(browser, "linkedin")
      await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" })

      console.log("Please log in to LinkedIn in the browser window.")
      console.log("Waiting for login to complete...")

      await page.waitForURL((url) => {
        const path = url.pathname
        return !path.includes("/login") && !path.includes("/checkpoint") && !path.includes("/authwall")
      }, { timeout: 300_000 })

      await saveCookies(page, "linkedin")
      console.log("Login successful! Cookies saved.")
    } catch (error) {
      writeError(
        error instanceof Error ? error.message : "Login failed or timed out",
        "LOGIN_FAILED"
      )
      process.exit(1)
    } finally {
      await browser.close()
    }
  },
})
