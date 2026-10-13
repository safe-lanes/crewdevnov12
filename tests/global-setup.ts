import { spawn } from "node:child_process";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { prepareTestEnvironment } from "../scripts/test-database-guard.mjs";

export default async function setup() {
  const expected = await prepareTestEnvironment();
  fs.mkdirSync("test-logs", { recursive: true });
  const log = fs.openSync("test-logs/backend.log", "w");
  const instance = randomUUID();
  const child = spawn("node", ["--import", "tsx", "scripts/start-test-backend.ts"], {
    env: { ...process.env, TEST_BACKEND_INSTANCE: instance }, stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  try {
    for (let attempt = 0; attempt < 180; attempt++) {
      if (child.exitCode !== null)
        throw new Error("Test backend failed to start. Read test-logs/backend.log.");
      try {
        const response = await fetch(`${process.env.TEST_API_URL}/api/test-database-identity`);
        const actual = await response.json();
        if (actual.clusterid !== expected.clusterid || actual.databaseoid !== expected.databaseoid)
          throw new Error("The occupied test port belongs to a different database.");
        if (actual.instance !== instance)
          throw new Error("The occupied test port belongs to a different backend instance.");
        // Never silently reuse an existing backend: wait for this child's startup.
        if (attempt > 1) return async () => { child.kill("SIGTERM"); };
      } catch (error) {
        if (String(error).includes("different database") || String(error).includes("different backend")) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error("Dedicated test backend startup timed out. Read test-logs/backend.log.");
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }
}
