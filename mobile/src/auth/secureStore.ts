import * as SecureStore from "expo-secure-store";

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
      SecureStore.getItemAsync(KEYS.accessToken),
      SecureStore.getItemAsync(KEYS.refreshToken),
      SecureStore.getItemAsync(KEYS.domain),
      SecureStore.getItemAsync(KEYS.mustResetPassword),
      SecureStore.getItemAsync(KEYS.crewUuid),
      SecureStore.getItemAsync(KEYS.userType),
      SecureStore.getItemAsync(KEYS.firstName),
      SecureStore.getItemAsync(KEYS.familyName),
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
    SecureStore.setItemAsync(KEYS.mustResetPassword, String(state.mustResetPassword)),
    setOrDelete(KEYS.crewUuid, state.crewUuid),
    setOrDelete(KEYS.userType, state.userType),
    setOrDelete(KEYS.firstName, state.firstName),
    setOrDelete(KEYS.familyName, state.familyName),
  ]);
}

export async function clearAuthState(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.accessToken),
    SecureStore.deleteItemAsync(KEYS.refreshToken),
    SecureStore.deleteItemAsync(KEYS.domain),
    SecureStore.deleteItemAsync(KEYS.mustResetPassword),
    SecureStore.deleteItemAsync(KEYS.crewUuid),
    SecureStore.deleteItemAsync(KEYS.userType),
    SecureStore.deleteItemAsync(KEYS.firstName),
    SecureStore.deleteItemAsync(KEYS.familyName),
  ]);
}

export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEYS.deviceId);
  if (existing) return existing;
  const { randomUUID } = await import("expo-crypto");
  const id = randomUUID();
  await SecureStore.setItemAsync(KEYS.deviceId, id);
  return id;
}

async function setOrDelete(key: string, value: string | null): Promise<void> {
  if (value === null) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}
