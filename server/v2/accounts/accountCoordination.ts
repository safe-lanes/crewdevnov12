import { drizzle } from "drizzle-orm/node-postgres";
import { getBaseDb } from "../db";
import { accountDbScope, type AccountLockMode } from "./accountDbScope";

const conflict = (message: string) => Object.assign(new Error(message), { code: "CONFLICT" });

export async function coordinateAccounts<T>(mode: AccountLockMode, work: () => Promise<T>): Promise<T> {
  const baseDb = getBaseDb();
  const parent = accountDbScope.getStore();
  if (parent) {
    if (!parent.lifecycle.active) throw new Error("Accounts database scope has ended");
    if (parent.baseDb !== baseDb) throw new Error("Tenant database changed during Accounts operation");
    if (mode === "exclusive" && parent.mode !== "exclusive") {
      throw conflict("Cannot upgrade an Accounts operation to activation");
    }
    return work();
  }
  const pool = baseDb.$client;
  if (!pool || typeof pool.connect !== "function") {
    throw new Error("Accounts coordination requires a PostgreSQL pool connection");
  }
  const client = await pool.connect();
  const lifecycle = { active: true };
  let locked = false;
  let discardConnection = false;
  const lock = mode === "exclusive" ? "pg_try_advisory_lock" : "pg_try_advisory_lock_shared";
  const unlock = mode === "exclusive" ? "pg_advisory_unlock" : "pg_advisory_unlock_shared";
  try {
    const result = await client.query(`SELECT ${lock}($1, $2) AS acquired`, [605, 1]);
    if (result.rows[0]?.acquired !== true) {
      throw conflict("Another Accounts operation is in progress. Please retry.");
    }
    locked = true;
    return await accountDbScope.run({ baseDb, db: drizzle(client), mode, lifecycle }, work);
  } finally {
    lifecycle.active = false;
    if (locked) {
      try {
        const result = await client.query(`SELECT ${unlock}($1, $2) AS released`, [605, 1]);
        discardConnection = result.rows[0]?.released !== true;
      } catch { discardConnection = true; }
    }
    client.release(discardConnection);
  }
}
