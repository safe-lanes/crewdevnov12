import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { tokenStore } from "./tokenStore";
import { authApi } from "../api/authApi";

export type AuthStatus = "loading" | "loggedOut" | "mustResetPassword" | "loggedIn";

interface AuthContextValue {
  status: AuthStatus;
  crewUuid: string | null;
  userType: string | null;
  firstName: string | null;
  familyName: string | null;
  isAdmin: boolean;
  login: (identifier: string, password: string, domain: string) => Promise<void>;
  logout: () => Promise<void>;
  setPassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function statusFromStore(store: ReturnType<typeof tokenStore.get>): AuthStatus {
  if (!store.hydrated) return "loading";
  if (!store.accessToken || !store.refreshToken) return "loggedOut";
  if (store.mustResetPassword) return "mustResetPassword";
  return "loggedIn";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [crewUuid, setCrewUuid] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = tokenStore.subscribe((s) => {
      setStatus(statusFromStore(s));
      setCrewUuid(s.crewUuid);
      setUserType(s.userType);
      setFirstName(s.firstName);
      setFamilyName(s.familyName);
    });
    tokenStore.hydrate();
    return unsubscribe;
  }, []);

  const login = useCallback(async (identifier: string, password: string, domain: string) => {
    const { deviceId } = tokenStore.get();
    const result = await authApi.login({ identifier, password, domain, deviceId: deviceId ?? undefined });
    await tokenStore.set({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      domain,
      mustResetPassword: result.mustResetPassword,
      crewUuid: result.crew.crewUuid,
      userType: result.crew.userType,
      firstName: result.crew.firstName,
      familyName: result.crew.familyName,
    });
  }, []);

  const logout = useCallback(async () => {
    const { refreshToken } = tokenStore.get();
    await authApi.logout({ refreshToken: refreshToken ?? undefined });
    await tokenStore.clear();
  }, []);

  const setPassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await authApi.setPassword({ currentPassword, newPassword });
    await tokenStore.set({ mustResetPassword: false });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        crewUuid,
        userType,
        firstName,
        familyName,
        isAdmin: userType === "Admin",
        login,
        logout,
        setPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
