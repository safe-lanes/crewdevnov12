import pg from "pg";
import { chromium } from "@playwright/test";
import { assertFixtureReleasePolicy, fixtureVesselAllowlist } from "./verification-fixture-policy.mjs";

if (process.env.TEST_DATABASE_VERIFIED === "true")
  throw new Error("Main-preview acceptance scripts are not automated test fixture setup.");
if (process.env.NODE_ENV === "production")
  throw new Error("Main-preview verification is not allowed in production.");

const originalQuery = pg.Client.prototype.query;
// Retired setup paths fail explicitly instead of accumulating new main fixtures.
pg.Client.prototype.query = function(...args) {
  const text = typeof args[0] === "string" ? args[0] : args[0]?.text ?? "";
  if (/\bINSERT\s+INTO\s+(?:"?public"?\.)?"?(crew_members_v2|crew_assignments|master_vessels|adm_forms_v2|adm_form_versions_v2|vessel_planning_v2)"?\b/i.test(text))
    throw new Error("Verification must reuse existing registered fixtures; creating a new operational fixture is refused.");
  if (/\b(INSERT|UPDATE)\b/i.test(text) && /\badm_form_versions_v2\b/i.test(text) && /\bstatus\b/i.test(text))
    throw new Error("Direct SQL fixture releases are refused. Use the guarded release API with a fixture-only vessel condition.");
  return originalQuery.apply(this, args);
};

async function checkRelease(url) {
  const match = new URL(url).pathname.match(/^\/api\/v2\/admin\/form-versions\/(\d+)\/release$/);
  if (!match) return;
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const policy = (await originalQuery.call(db, `
      SELECT p.mode,p.version_uuid FROM frm_version_applicability p
      JOIN adm_form_versions_v2 v ON v.fv_uuid=p.version_uuid WHERE v.id=$1`, [Number(match[1])])).rows[0];
    const conditions = (await originalQuery.call(db, `SELECT s.set_uuid,c.dimension_key,c.operator,c.value
      FROM frm_applicability_sets s LEFT JOIN frm_applicability_conditions c ON c.set_uuid=s.set_uuid
      WHERE s.version_uuid=$1`, [policy?.version_uuid])).rows;
    const sets = [...new Set(conditions.map(c => c.set_uuid))].map(id => ({
      conditions: conditions.filter(c => c.set_uuid === id).map(c => ({
        dimensionKey: c.dimension_key, operator: c.operator, value: c.value,
      })),
    }));
    const vessels = await fixtureVesselAllowlist();
    assertFixtureReleasePolicy({ ...policy, sets }, vessels);
    // A registered vessel is fixture-only only while all its crew/assignments
    // are individually registered acceptance records, not realistic crew.
    const register = await (await import("node:fs/promises")).readFile("docs/company-form-regression-fixtures.md", "utf8");
    for (const vessel of vessels) {
      if (!register.includes(vessel)) throw new Error("Fixture vessel is not in the acceptance register.");
      const crew = (await originalQuery.call(db, `SELECT a.assign_uuid,c.crew_uuid
        FROM crew_assignments a JOIN crew_members_v2 c ON c.crew_uuid=a.crew_uuid
        WHERE a.vessel_uuid=$1`, [vessel])).rows;
      if (crew.some(c => !register.includes(c.crew_uuid) || !register.includes(c.assign_uuid)))
        throw new Error("Verification release refused: the vessel contains unregistered crew or assignments.");
    }
  } finally { await db.end(); }
}

const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  if ((init?.method ?? (typeof input === "object" ? input.method : "GET"))?.toUpperCase() === "POST") {
    if (/^\/api\/(?:v2\/admin\/(?:forms|rank-groups|forms\/\d+\/versions)|crew-members|v2\/crew-members)\/?$/.test(new URL(url).pathname))
      throw new Error("Verification must reuse registered fixtures; creating new definitions or crew is refused.");
    await checkRelease(url);
  }
  return fetchOriginal(input, init);
};
const launchOriginal = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launchOriginal(...args);
  const contextOriginal = browser.newContext.bind(browser);
  browser.newContext = async (...contextArgs) => {
    const context = await contextOriginal(...contextArgs);
    await context.route("**/api/v2/admin/form-versions/*/release", async route => {
      try { await checkRelease(route.request().url()); await route.continue(); }
      catch (error) {
        await route.fulfill({ status: 409, contentType: "application/json",
          body: JSON.stringify({ message: error.message }) });
      }
    });
    return context;
  };
  return browser;
};
