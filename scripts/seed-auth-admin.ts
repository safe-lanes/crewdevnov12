/**
 * Seed an initial admin user for the standalone login system.
 *
 * Usage:
 *   USERNAME=admin PASSWORD='changeMe123!' DOMAIN=rsms EMAIL=admin@example.com \
 *     tsx scripts/seed-auth-admin.ts
 */
import { Pool } from "pg";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const username = process.env.USERNAME || "admin";
  const password = process.env.PASSWORD;
  const domain = process.env.DOMAIN || "rsms";
  const email = process.env.EMAIL || `${username}@${domain}.local`;
  const fullName = process.env.FULL_NAME || "Administrator";

  if (!password) throw new Error("PASSWORD env var is required");

  const rounds = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
  const hash = await bcrypt.hash(password, rounds);
  const uuid = randomUUID();

  const requiresSsl = url.includes("sslmode=require") || url.includes("ssl=true");
  const pool = new Pool({
    connectionString: url,
    ssl: requiresSsl ? { rejectUnauthorized: false } : false,
  });

  try {
    const existing = await pool.query(
      `SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND COALESCE(domain,'') = $2`,
      [username, domain],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      await pool.query(
        `UPDATE users SET password=$1, email=$2, full_name=$3, user_type='admin',
         is_active=TRUE, is_locked=FALSE, failed_login_attempts=0, lockout_until=NULL,
         password_changed_at=NOW(), updated_at=NOW(), domain=$4
         WHERE id=$5`,
        [hash, email, fullName, domain, existing.rows[0].id],
      );
      console.log(`✅ Updated existing admin user '${username}' (id=${existing.rows[0].id})`);
    } else {
      const r = await pool.query(
        `INSERT INTO users (username, password, uuid, email, full_name, user_type, domain, is_active, password_changed_at)
         VALUES ($1,$2,$3,$4,$5,'admin',$6,TRUE,NOW()) RETURNING id`,
        [username, hash, uuid, email, fullName, domain],
      );
      console.log(`✅ Created admin user '${username}' (id=${r.rows[0].id}, uuid=${uuid})`);
    }
    console.log(`   domain=${domain} email=${email}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
