// Preflight must precede dynamic application imports and their startup effects.
// @ts-ignore Node ESM helper lives outside the application's TypeScript project.
import { prepareTestEnvironment } from "./test-database-guard.mjs";

await prepareTestEnvironment();
process.env.PORT = process.env.TEST_BACKEND_PORT;
process.env.NODE_ENV = "development";
process.env.AUTH_BYPASS = "true";
process.env.TEST_BACKEND = "true";
const { runMigrations } = await import("../server/migrationRunner");
await runMigrations();
const { seedIsolatedTests } = await import("./seed-isolated-tests");
await seedIsolatedTests();
await import("../server/index");
