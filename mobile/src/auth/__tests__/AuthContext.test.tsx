import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "../AuthContext";
import { authApi } from "../../api/authApi";
import { tokenStore } from "../tokenStore";

jest.mock("../../api/authApi", () => ({
  authApi: {
    login: jest.fn(),
    logout: jest.fn(),
    setPassword: jest.fn(),
  },
}));

jest.mock("../../queryClient", () => ({
  queryClient: { clear: jest.fn() },
}));

// A minimal in-memory stand-in for tokenStore, implementing the same
// get/subscribe/hydrate/set/clear contract AuthContext relies on — this
// isolates the test to AuthContext's own status-derivation logic (the thing
// flagged as a high-risk untested path) rather than also depending on
// expo-secure-store via the real tokenStore/secureStore chain.
jest.mock("../tokenStore", () => {
  const initialState = {
    accessToken: null,
    refreshToken: null,
    domain: null,
    mustResetPassword: false,
    crewUuid: null,
    userType: null,
    firstName: null,
    familyName: null,
    deviceId: "device-1",
    hydrated: false,
  };
  let state: any = { ...initialState };
  const listeners: any[] = [];
  const notify = () => listeners.forEach((l) => l(state));
  return {
    tokenStore: {
      // Test-only escape hatch — the mock's module-level state would
      // otherwise leak from one test case into the next within this file.
      __reset: () => {
        state = { ...initialState };
        listeners.length = 0;
      },
      get: () => state,
      subscribe: (listener: any) => {
        listeners.push(listener);
        return () => {
          const i = listeners.indexOf(listener);
          if (i >= 0) listeners.splice(i, 1);
        };
      },
      hydrate: jest.fn(async () => {
        state = { ...state, hydrated: true };
        notify();
        return state;
      }),
      set: jest.fn(async (next: any) => {
        state = { ...state, ...next };
        notify();
      }),
      clear: jest.fn(async () => {
        state = {
          ...state,
          accessToken: null,
          refreshToken: null,
          domain: null,
          mustResetPassword: false,
          crewUuid: null,
          userType: null,
          firstName: null,
          familyName: null,
        };
        notify();
      }),
    },
  };
});

const mockedAuthApi = authApi as jest.Mocked<typeof authApi>;

function crewLoginResult(overrides: Partial<{ mustResetPassword: boolean; crewUuid: string; userType: string }> = {}) {
  return {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    mustResetPassword: overrides.mustResetPassword ?? false,
    crew: {
      crewUuid: overrides.crewUuid ?? "crew-1",
      empNo: "E1",
      mobile: null,
      email: null,
      userType: overrides.userType ?? "Crew",
      firstName: "Jo",
      familyName: "Doe",
    },
  };
}

function renderAuth() {
  return renderHook(() => useAuth(), {
    wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (tokenStore as any).__reset();
});

describe("AuthContext status machine", () => {
  test("settles to loggedOut once hydrated with no stored tokens", async () => {
    // Status starts as "loading" (see the initial useState in AuthContext) and
    // transitions once tokenStore.hydrate() resolves and notifies — with the
    // mocked store resolving instantly, RTL's act() may already flush past
    // "loading" by the time control returns here, so the terminal state is
    // what's actually verified.
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe("loggedOut"));
  });

  test("a hydrate() failure surfaces status 'error' with a friendly message, not a stuck 'loading'", async () => {
    (tokenStore.hydrate as jest.Mock).mockRejectedValueOnce(new Error("Requiring unknown module \"658\""));
    const { result } = renderAuth();

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.hydrationError).toBeTruthy();
    expect(result.current.hydrationError).not.toContain("658");
  });

  test("retryHydration() recovers from a prior hydrate() failure", async () => {
    (tokenStore.hydrate as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe("error"));

    await act(async () => {
      result.current.retryHydration();
    });

    await waitFor(() => expect(result.current.status).toBe("loggedOut"));
    expect(result.current.hydrationError).toBeNull();
  });

  test("login() with mustResetPassword: true lands on mustResetPassword, not loggedIn", async () => {
    mockedAuthApi.login.mockResolvedValue(crewLoginResult({ mustResetPassword: true, crewUuid: "crew-2" }));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe("loggedOut"));

    await act(async () => {
      await result.current.login("E1", "pw", "acme");
    });

    expect(result.current.status).toBe("mustResetPassword");
    expect(result.current.crewUuid).toBe("crew-2");
  });

  test("login() with mustResetPassword: false lands directly on loggedIn, isAdmin reflects userType", async () => {
    mockedAuthApi.login.mockResolvedValue(crewLoginResult({ mustResetPassword: false, userType: "Admin" }));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe("loggedOut"));

    await act(async () => {
      await result.current.login("E1", "pw", "acme");
    });

    expect(result.current.status).toBe("loggedIn");
    expect(result.current.isAdmin).toBe(true);
  });

  test("a Crew-type login is never treated as admin", async () => {
    mockedAuthApi.login.mockResolvedValue(crewLoginResult({ userType: "Crew" }));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe("loggedOut"));

    await act(async () => {
      await result.current.login("E1", "pw", "acme");
    });

    expect(result.current.isAdmin).toBe(false);
  });

  test("setPassword() moves status from mustResetPassword to loggedIn without a fresh login", async () => {
    mockedAuthApi.login.mockResolvedValue(crewLoginResult({ mustResetPassword: true }));
    mockedAuthApi.setPassword.mockResolvedValue(undefined);

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe("loggedOut"));
    await act(async () => {
      await result.current.login("E1", "pw", "acme");
    });
    expect(result.current.status).toBe("mustResetPassword");

    await act(async () => {
      await result.current.setPassword("oldpw", "newpw");
    });

    expect(result.current.status).toBe("loggedIn");
  });

  test("a rejected login leaves status at loggedOut rather than advancing it", async () => {
    mockedAuthApi.login.mockRejectedValue(new Error("Invalid credentials"));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe("loggedOut"));

    await act(async () => {
      await expect(result.current.login("E1", "wrong", "acme")).rejects.toThrow("Invalid credentials");
    });

    expect(result.current.status).toBe("loggedOut");
  });

  test("logout() returns to loggedOut, clears crew identity, and clears the query cache", async () => {
    mockedAuthApi.login.mockResolvedValue(crewLoginResult());
    mockedAuthApi.logout.mockResolvedValue(undefined);
    const { queryClient } = require("../../queryClient");

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe("loggedOut"));
    await act(async () => {
      await result.current.login("E1", "pw", "acme");
    });
    expect(result.current.status).toBe("loggedIn");

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe("loggedOut");
    expect(result.current.crewUuid).toBeNull();
    expect(queryClient.clear).toHaveBeenCalled();
  });
});
