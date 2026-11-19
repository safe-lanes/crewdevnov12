import { vi } from "vitest";

// Resolver/consumer unit suites mock their repositories or replace this
// boundary themselves. Do not import legacy storage or a real tenant pool.
vi.mock("@server/v2/db", () => ({
  getDb: () => {
    throw new Error("Mock the database boundary in released-form unit tests.");
  },
}));
