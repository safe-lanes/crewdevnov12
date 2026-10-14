import { test } from "node:test";
import assert from "node:assert/strict";
import { assertFixtureReleasePolicy } from "./verification-fixture-policy.mjs";

const fixture = "fixture-only-vessel";
const restriction = { dimensionKey: "vessel", operator: "in", value: [fixture] };
test("unrestricted verification releases are refused", () => {
  assert.throws(() => assertFixtureReleasePolicy({ mode: "all" }, [fixture]));
  assert.throws(() => assertFixtureReleasePolicy({ mode: "conditional", sets: [{ conditions: [] }] }, [fixture]));
});
test("every alternative must restrict to fixture-only vessels", () => {
  assert.throws(() => assertFixtureReleasePolicy({ mode: "conditional", sets: [
    { conditions: [restriction] }, { conditions: [] },
  ] }, [fixture]));
  assert.throws(() => assertFixtureReleasePolicy({ mode: "conditional", sets: [
    { conditions: [{ ...restriction, value: ["real-vessel"] }] },
  ] }, [fixture]));
  assertFixtureReleasePolicy({ mode: "conditional", sets: [
    { conditions: [restriction] }, { conditions: [restriction] },
  ] }, [fixture]);
});
