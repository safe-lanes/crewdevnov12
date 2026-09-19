import { apiFetch, refreshCrewSession, rawPost, parseOrThrow } from "../client";
import { tokenStore } from "../../auth/tokenStore";
import { queryClient } from "../../queryClient";

jest.mock("../../auth/tokenStore", () => ({
  tokenStore: {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
  },
}));
jest.mock("../../queryClient", () => ({
  queryClient: { clear: jest.fn() },
}));

const mockedTokenStore = tokenStore as unknown as {
  get: jest.Mock;
  set: jest.Mock;
  clear: jest.Mock;
};

/** Plain-object fake Response — client.ts only ever touches .ok/.status/.json(). */
function fakeResponse(body: any, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

let tokenState: { accessToken: string | null; refreshToken: string | null; domain: string | null; deviceId: string | null };

beforeEach(() => {
  jest.resetAllMocks();
  tokenState = {
    accessToken: "old-access-token",
    refreshToken: "refresh-token-1",
    domain: "acme",
    deviceId: "device-1",
  };
  // Stateful, like the real tokenStore: .set() actually updates what the next
  // .get() returns, so a test can assert the retry picks up the new token.
  mockedTokenStore.get.mockImplementation(() => tokenState);
  mockedTokenStore.set.mockImplementation((next: Partial<typeof tokenState>) => {
    tokenState = { ...tokenState, ...next };
  });
  global.fetch = jest.fn();
});

describe("apiFetch", () => {
  test("attaches the current access token as a Bearer header", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(fakeResponse({ ok: true }, 200));

    await apiFetch("/api/x");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/x"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer old-access-token" }),
      }),
    );
  });

  test("on a 401, refreshes once and retries the original request with the new token", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(fakeResponse(null, 401)) // original request
      .mockResolvedValueOnce(fakeResponse({ accessToken: "new-access-token", refreshToken: "refresh-token-2" }, 200)) // /auth/refresh
      .mockResolvedValueOnce(fakeResponse({ ok: true }, 200)); // retried original request

    const res = await apiFetch("/api/x");

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(mockedTokenStore.set).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "new-access-token", refreshToken: "refresh-token-2" }),
    );
    // The retry must use the freshly-issued token, not the stale one.
    const retryCall = (global.fetch as jest.Mock).mock.calls[2];
    expect(retryCall[1].headers.Authorization).toBe("Bearer new-access-token");
  });

  test("a request that isn't 401 never calls refresh", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(fakeResponse({ ok: true }, 200));

    await apiFetch("/api/x");

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("concurrent 401s share a single in-flight refresh — the server's refresh tokens are single-use, so a second independent /refresh call would look like reuse and force-logout the session", async () => {
    const callCountByUrl: Record<string, number> = {};
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/auth/refresh")) {
        callCountByUrl.refresh = (callCountByUrl.refresh || 0) + 1;
        return Promise.resolve(
          fakeResponse({ accessToken: "new-access-token", refreshToken: "refresh-token-2" }, 200),
        );
      }
      callCountByUrl[url] = (callCountByUrl[url] || 0) + 1;
      // First call to each distinct endpoint 401s (stale token); the retry succeeds.
      const status = callCountByUrl[url] === 1 ? 401 : 200;
      return Promise.resolve(fakeResponse({ ok: true }, status));
    });

    const [resA, resB] = await Promise.all([apiFetch("/api/a"), apiFetch("/api/b")]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(callCountByUrl.refresh).toBe(1);
  });

  test("refresh failure (invalid/expired/reused token) clears local session state and never retries", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(fakeResponse(null, 401)) // original request
      .mockResolvedValueOnce(fakeResponse({ error: "Invalid refresh token" }, 401)); // /auth/refresh fails

    const res = await apiFetch("/api/x");

    expect(res.status).toBe(401);
    expect(global.fetch).toHaveBeenCalledTimes(2); // no third (retry) call
    expect(mockedTokenStore.clear).toHaveBeenCalled();
    expect(queryClient.clear).toHaveBeenCalled();
  });

  test("refreshCrewSession() returns false immediately when there is no refresh token to use", async () => {
    tokenState = { accessToken: null, refreshToken: null, domain: null, deviceId: "device-1" };

    const refreshed = await refreshCrewSession();

    expect(refreshed).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("parseOrThrow", () => {
  test("returns the parsed body on a successful response", async () => {
    const result = await parseOrThrow<{ ok: boolean }>(fakeResponse({ ok: true }, 200), "fallback");
    expect(result).toEqual({ ok: true });
  });

  test("prefers body.message over body.error, and attaches status/details", async () => {
    const res = fakeResponse({ error: "generic", message: "Specific reason", details: { field: "x" } }, 422);
    await expect(parseOrThrow(res, "fallback")).rejects.toMatchObject({
      message: "Specific reason",
      status: 422,
      details: { field: "x" },
    });
  });

  test("falls back to body.error, then the fallback string, when message is absent", async () => {
    await expect(parseOrThrow(fakeResponse({ error: "generic" }, 400), "fallback")).rejects.toThrow("generic");
    await expect(parseOrThrow(fakeResponse({}, 400), "fallback")).rejects.toThrow("fallback");
  });
});

describe("rawPost", () => {
  test("POSTs JSON and parses the response through parseOrThrow", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(fakeResponse({ accessToken: "t" }, 200));

    const result = await rawPost<{ accessToken: string }>("/api/crew-app/auth/login", { identifier: "x" });

    expect(result).toEqual({ accessToken: "t" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/crew-app/auth/login"),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ identifier: "x" }) }),
    );
  });
});
