import { defineCommand } from "@bunli/core"
import { isDockerAvailable, isContainerRunning, startService, getServiceUrl } from "./docker.js"
import { writeError } from "./formatting.js"

export const setup = defineCommand({
  name: "setup",
  description: "Start the jobspy-api Docker container for job searching",
  handler: async () => {
    if (!(await isDockerAvailable())) {
      writeError(
        "Docker is not installed. Install Docker from https://docs.docker.com/get-docker/",
        "DOCKER_NOT_FOUND"
      )
      process.exit(1)
    }

    if (await isContainerRunning()) {
      console.log(`jobspy-api is already running at ${getServiceUrl()}`)
      return
    }

    console.log("Starting jobspy-api container...")
    const result = await startService()

    if (!result.ok) {
      writeError(result.error ?? "Failed to start jobspy-api", "SETUP_FAILED")
      process.exit(1)
    }

    console.log(`jobspy-api is running at ${getServiceUrl()}`)
  },
})
