// This file is for production PostgreSQL database configuration (not used in development)
// Using conditional exports to avoid TypeScript errors when @neondatabase/serverless is not installed

let pool: any;
let db: any;

try {
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
