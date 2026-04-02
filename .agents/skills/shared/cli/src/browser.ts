import { chromium, type Browser, type Page, type Cookie } from "playwright"
import { join } from "path"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs"
import { configDir } from "@bunli/utils"

const APP_NAME = "ai-job-search"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

export function getConfigDir(): string {
  return configDir(APP_NAME)
}

export function cookiePath(site: string, baseDir?: string): string {
  const dir = join(baseDir ?? getConfigDir(), "cookies")
  mkdirSync(dir, { recursive: true })
  return join(dir, `${site}.json`)
}

export function loadCookies(site: string, baseDir?: string): Cookie[] {
  const path = cookiePath(site, baseDir)
  if (!existsSync(path)) return []
  try {
    const raw = readFileSync(path, "utf-8")
    return JSON.parse(raw) as Cookie[]
  } catch {
    return []
  }
}

export function saveCookiesToDisk(cookies: Cookie[], site: string, baseDir?: string): void {
  const path = cookiePath(site, baseDir)
  writeFileSync(path, JSON.stringify(cookies, null, 2))
}

export async function launchBrowser(options?: { headed?: boolean }): Promise<Browser> {
  return chromium.launch({
    headless: !(options?.headed),
    args: ["--disable-blink-features=AutomationControlled"],
  })
}

export async function newPage(browser: Browser, site: string): Promise<Page> {
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: "en-GB",
  })

  // Load saved cookies if available
  const cookies = loadCookies(site)
  if (cookies.length > 0) {
    await context.addCookies(cookies)
  }

  // Stealth: override navigator.webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false })
  })

  return context.newPage()
}

export async function saveCookies(page: Page, site: string): Promise<void> {
  const context = page.context()
  const cookies = await context.cookies()
  saveCookiesToDisk(cookies, site)
}

export async function randomDelay(min = 200, max = 600): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  await new Promise((resolve) => setTimeout(resolve, ms))
}
