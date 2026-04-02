import { join } from "path"
import { runCLI as _runCLI, type CLIResult } from "../../../shared/cli/tests/test-utils.js"

export type { CLIResult }
export { parseJSON } from "../../../shared/cli/tests/test-utils.js"

const CLI_PATH = join(import.meta.dir, "../src/cli.ts")

export function runCLI(args: string[]): Promise<CLIResult> {
  return _runCLI(CLI_PATH, args)
}
