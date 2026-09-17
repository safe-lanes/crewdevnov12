import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Wrappers around expo-secure-store (NOT AsyncStorage — tokens must not sit
// in plain, unencrypted storage on the device).

const KEYS = {
  accessToken: "crew_access_token",
  refreshToken: "crew_refresh_token",
  domain: "crew_domain",
  deviceId: "crew_device_id",
  mustResetPassword: "crew_must_reset_password",
  crewUuid: "crew_uuid",
  userType: "crew_user_type",
  firstName: "crew_first_name",
  familyName: "crew_family_name",
} as const;

const webMemoryStore = new Map<string, string>();

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") return webMemoryStore.get(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    webMemoryStore.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    webMemoryStore.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export type StoredAuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  domain: string | null;
  mustResetPassword: boolean;
  crewUuid: string | null;
  userType: string | null;
  firstName: string | null;
  familyName: string | null;
};

export async function readAuthState(): Promise<StoredAuthState> {
  const [accessToken, refreshToken, domain, mustResetPasswordRaw, crewUuid, userType, firstName, familyName] =
    await Promise.all([
      getItem(KEYS.accessToken),
      getItem(KEYS.refreshToken),
      getItem(KEYS.domain),
      getItem(KEYS.mustResetPassword),
      getItem(KEYS.crewUuid),
      getItem(KEYS.userType),
      getItem(KEYS.firstName),
      getItem(KEYS.familyName),
    ]);
  return {
    accessToken,
    refreshToken,
    domain,
    mustResetPassword: mustResetPasswordRaw === "true",
    crewUuid,
    userType,
    firstName,
    familyName,
  };
}

export async function writeAuthState(state: StoredAuthState): Promise<void> {
  await Promise.all([
    setOrDelete(KEYS.accessToken, state.accessToken),
    setOrDelete(KEYS.refreshToken, state.refreshToken),
    setOrDelete(KEYS.domain, state.domain),
    setItem(KEYS.mustResetPassword, String(state.mustResetPassword)),
    setOrDelete(KEYS.crewUuid, state.crewUuid),
    setOrDelete(KEYS.userType, state.userType),
    setOrDelete(KEYS.firstName, state.firstName),
    setOrDelete(KEYS.familyName, state.familyName),
  ]);
}

export async function clearAuthState(): Promise<void> {
  await Promise.all([
    deleteItem(KEYS.accessToken),
    deleteItem(KEYS.refreshToken),
    deleteItem(KEYS.domain),
    deleteItem(KEYS.mustResetPassword),
    deleteItem(KEYS.crewUuid),
    deleteItem(KEYS.userType),
    deleteItem(KEYS.firstName),
    deleteItem(KEYS.familyName),
  ]);
}

export async function getDeviceId(): Promise<string> {
  const existing = await getItem(KEYS.deviceId);
  if (existing) return existing;
  const { randomUUID } = await import("expo-crypto");
  const id = randomUUID();
  await setItem(KEYS.deviceId, id);
  return id;
}

async function setOrDelete(key: string, value: string | null): Promise<void> {
  if (value === null) {
    await deleteItem(key);
  } else {
    await setItem(key, value);
  }
}
