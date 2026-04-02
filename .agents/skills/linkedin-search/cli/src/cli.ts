import { createCLI } from "@bunli/core"
import { setup } from "./commands/setup.js"
import { login } from "./commands/login.js"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"

const cli = await createCLI({
  name: "linkedin-search",
  version: "1.0.0",
  description: "Search UK job listings on LinkedIn with authenticated browser sessions",
})

cli.command(setup)
cli.command(login)
cli.command(search)
cli.command(detail)

await cli.run()
