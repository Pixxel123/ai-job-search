import { join, dirname } from "path"
import { fileURLToPath } from "url"

const CONTAINER_NAME = "jobspy-api"
const SERVICE_PORT = 8004

export function getServiceUrl(): string {
  return `http://localhost:${SERVICE_PORT}`
}

export function getComposePath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url))
  return join(thisDir, "..", "docker-compose.yml")
}

async function runCommand(cmd: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}

export async function isDockerAvailable(): Promise<boolean> {
  try {
    const result = await runCommand(["docker", "--version"])
    return result.exitCode === 0
  } catch {
    return false
  }
}

export async function isContainerRunning(): Promise<boolean> {
  try {
    const result = await runCommand([
      "docker", "inspect", "--format", "{{.State.Running}}", CONTAINER_NAME,
    ])
    return result.stdout === "true"
  } catch {
    return false
  }
}

export async function startService(): Promise<{ ok: boolean; error?: string }> {
  if (!(await isDockerAvailable())) {
    return { ok: false, error: "Docker is not installed. Install Docker from https://docs.docker.com/get-docker/" }
  }

  const composePath = getComposePath()
  const result = await runCommand([
    "docker", "compose", "-f", composePath, "up", "-d",
  ])

  if (result.exitCode !== 0) {
    return { ok: false, error: `Failed to start jobspy-api: ${result.stderr}` }
  }

  // Wait for service to be ready (up to 30s)
  const serviceUrl = getServiceUrl()
  for (let i = 0; i < 15; i++) {
    try {
      const resp = await fetch(`${serviceUrl}/docs`, { signal: AbortSignal.timeout(2000) })
      if (resp.ok) return { ok: true }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 2000))
  }

  return { ok: false, error: "jobspy-api started but health check timed out after 30s" }
}

export async function stopService(): Promise<{ ok: boolean; error?: string }> {
  const composePath = getComposePath()
  const result = await runCommand([
    "docker", "compose", "-f", composePath, "down",
  ])

  if (result.exitCode !== 0) {
    return { ok: false, error: `Failed to stop jobspy-api: ${result.stderr}` }
  }

  return { ok: true }
}

export async function ensureServiceRunning(): Promise<{ ok: boolean; error?: string }> {
  if (await isContainerRunning()) {
    try {
      const resp = await fetch(`${getServiceUrl()}/docs`, { signal: AbortSignal.timeout(3000) })
      if (resp.ok) return { ok: true }
    } catch {
      // Container running but not responding — restart
    }
  }

  return startService()
}
