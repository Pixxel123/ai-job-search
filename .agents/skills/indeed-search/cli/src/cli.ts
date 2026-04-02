import { createCLI } from "@bunli/core"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"

const cli = await createCLI({
  name: "indeed-search",
  version: "1.0.0",
  description: "Search UK job listings on Indeed (uk.indeed.com)",
})

cli.command(search)
cli.command(detail)

await cli.run()
