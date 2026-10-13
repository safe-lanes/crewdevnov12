// This file is for production PostgreSQL database configuration (not used in development)
// Using conditional exports to avoid TypeScript errors when @neondatabase/serverless is not installed
import { Pool as TestPool } from "pg";
import { drizzle as testDrizzle } from "drizzle-orm/node-postgres";
import * as testSchema from "../shared/schema";

let pool: any;
let db: any;

if (process.env.NODE_ENV === "test" || process.env.TEST_DATABASE_VERIFIED === "true") {
  if (process.env.TEST_DATABASE_VERIFIED !== "true" || !process.env.TEST_DATABASE_URL)
    throw new Error("Automated database access requires verified TEST_DATABASE_URL; no file fallback.");
  pool = new TestPool({ connectionString: process.env.TEST_DATABASE_URL });
  db = testDrizzle(pool, { schema: testSchema });
} else try {
  // Only load Neon dependencies if they're installed
  const { Pool: NeonPool, neonConfig } = require('@neondatabase/serverless');
  const { drizzle: neonDrizzle } = require('drizzle-orm/neon-serverless');
  const ws = require("ws");
  const schema = require("@shared/schema");

  neonConfig.webSocketConstructor = ws;

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = neonDrizzle({ client: pool, schema });
} catch (error) {
  // Neon dependencies not installed - using PersistentFileStorage in development
  console.log('Database dependencies not available, using file-based storage');
  pool = null;
  db = null;
}

export { pool, db };
