import { describe, it, expect, vi, beforeEach } from "vitest";

const { getDecryptedSessionStorageItemMock } = vi.hoisted(() => ({
  getDecryptedSessionStorageItemMock: vi.fn(),
}));

vi.mock("@/lib/encryptionService", async () => {
  const actual = await vi.importActual<typeof import("@/lib/encryptionService")>(
    "@/lib/encryptionService",
  );
  return {
    ...actual,
    getDecryptedSessionStorageItem: getDecryptedSessionStorageItemMock,
  };
});

// Real shape confirmed against production: the same JWT wrapped in literal
// quotes gets 401 invalid_token; unwrapped it gets 200. See authToken.ts.
const RAW_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzIwLCJkb21haW4iOiJyc21zIiwidXNlclR5cGUiOiJPZmZpY2UiLCJpYXQiOjE3ODg4NjU3MDQsImV4cCI6MTc4ODk1MjEwNH0.pO8clf8xe3vBHeQiQxnD5Wl3I-5-KDgpQz4YGz7wGEs";

// authToken.ts reads VITE_AUTH_BYPASS at module-import time to decide
// whether getAuthToken() short-circuits to the dev persona token. Stub it
// to "false" and force a fresh module instance so this test exercises the
// real-credential path regardless of the developer's local .env.
async function loadGetAuthToken() {
  vi.resetModules();
  vi.stubEnv("VITE_AUTH_BYPASS", "false");
  const mod = await import("@/lib/authToken");
  return mod.getAuthToken;
}

describe("getAuthToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("unwraps a double-JSON-encoded token into the bare JWT", async () => {
    // Simulates the parent app's handoff double-stringifying the token
    // before encrypting it: after decryptData's single JSON.parse, the
    // result is still a JSON string literal (literal wrapping quotes).
    getDecryptedSessionStorageItemMock.mockReturnValue(`"${RAW_TOKEN}"`);
    const getAuthToken = await loadGetAuthToken();

    expect(getAuthToken()).toBe(RAW_TOKEN);
  });

  it("returns an already-bare token unchanged (no regression)", async () => {
    getDecryptedSessionStorageItemMock.mockReturnValue(RAW_TOKEN);
    const getAuthToken = await loadGetAuthToken();

    expect(getAuthToken()).toBe(RAW_TOKEN);
  });

  it("returns null when no credentials are stored", async () => {
    getDecryptedSessionStorageItemMock.mockReturnValue(null);
    const getAuthToken = await loadGetAuthToken();

    expect(getAuthToken()).toBeNull();
  });
});
