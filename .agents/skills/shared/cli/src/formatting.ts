import type { JobListing } from "./types.js"

type OutputFormat = "json" | "table" | "plain"

export function formatOutput(data: unknown, format: OutputFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2)

    case "table":
      return formatTable(data)

    case "plain":
      return formatPlain(data)
  }
}

function formatTable(data: unknown): string {
  const obj = data as Record<string, unknown>
  const results = (obj.results ?? [obj]) as Record<string, unknown>[]

  const columns = ["ID", "TITLE", "COMPANY", "LOCATION", "TYPE", "POSTED"]
  const rows = results.map((r) => [
    String(r.id ?? ""),
    String(r.title ?? ""),
    String(r.company ?? ""),
    String(r.location ?? ""),
    String(r.jobType ?? ""),
    String(r.posted ?? ""),
  ])

  const widths = columns.map((col, i) =>
    Math.max(col.length, ...rows.map((r) => r[i].length))
  )

  const header = columns.map((col, i) => col.padEnd(widths[i])).join("\t")
  const body = rows
    .map((row) => row.map((cell, i) => cell.padEnd(widths[i])).join("\t"))
    .join("\n")

  const meta = obj.meta as { total?: number } | undefined
  const totalLine = meta?.total != null ? `\n\nTotal: ${meta.total}` : ""

  return header + "\n" + body + totalLine
}

function formatPlain(data: unknown): string {
  const obj = data as Record<string, unknown>
  const lines: string[] = []

  if (obj.title) lines.push(`Title: ${obj.title}`)
  if (obj.company) lines.push(`Company: ${obj.company}`)
  if (obj.location) lines.push(`Location: ${obj.location}`)
  if (obj.jobType) lines.push(`Type: ${obj.jobType}`)
  if (obj.salary) lines.push(`Salary: ${obj.salary}`)
  if (obj.remote) lines.push(`Remote: ${obj.remote}`)
  if (obj.posted) lines.push(`Posted: ${obj.posted}`)
  if (obj.deadline) lines.push(`Deadline: ${obj.deadline}`)
  if (obj.url) lines.push(`URL: ${obj.url}`)
  if (obj.source) lines.push(`Source: ${obj.source}`)

  if (obj.description) {
    lines.push("")
    lines.push("--- Description ---")
    lines.push(stripHtml(String(obj.description)))
  }

  if (obj.requirements) {
    lines.push("")
    lines.push("--- Requirements ---")
    lines.push(String(obj.requirements))
  }

  return lines.join("\n")
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}
