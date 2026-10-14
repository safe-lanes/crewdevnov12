import { test } from "node:test";
import assert from "node:assert/strict";
import { assertTestIdentity, assertRegisteredIdentity, sameIdentity, prepareTestEnvironment } from "./test-database-guard.mjs";

const development = { clusterid: "cluster", databaseoid: "1" };
const production = { clusterid: "production-cluster", databaseoid: "1" };
test("development aliases cannot bypass identity protection", () => {
  assert.throws(() => assertTestIdentity({ ...development, database: "different-label" }, [development]));
});
test("production identity is protected", () => {
  assert.throws(() => assertTestIdentity(production, [development, production]));
});
test("unknown identity is refused", () => {
  assert.throws(() => assertTestIdentity({}, [development]));
  assert.throws(() => assertTestIdentity(development, []));
});
test("another database on the same cluster is distinct", () => {
  assert.equal(sameIdentity({ ...development, databaseoid: "2" }, development), false);
  assertTestIdentity({ ...development, databaseoid: "2" }, [development]);
});
test("only THE registered test identity is allowed", () => {
  const registered = { clusterid: "cluster", databaseoid: "2" };
  assertRegisteredIdentity(registered, registered, [development]);
  assert.throws(() => assertRegisteredIdentity({ ...registered, databaseoid: "3" }, registered, [development]));
  assert.throws(() => assertRegisteredIdentity({ ...registered, clusterid: "other" }, registered, [development]));
  assert.throws(() => assertRegisteredIdentity(registered, {}, [development]));
  assert.throws(() => assertRegisteredIdentity(development, development, [development]));
});
test("missing TEST_DATABASE_URL never falls back", async () => {
  const previous = process.env.TEST_DATABASE_URL;
  delete process.env.TEST_DATABASE_URL;
  try { await assert.rejects(prepareTestEnvironment(), /TEST_DATABASE_URL is required/); }
  finally { if (previous) process.env.TEST_DATABASE_URL = previous; }
});
