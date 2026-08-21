// Dev-only persona switcher support. Everything in this module is inert
// unless the app is built with VITE_AUTH_BYPASS=true (dev bypass mode).
// It writes BOTH identity surfaces atomically so they can never diverge:
//   1. localStorage `userProfile` (plain JSON, read by PermissionsContext)
//   2. localStorage `devAuthToken` (unsigned JWT sent by tenantFetch so the
//      backend's AUTH_BYPASS jwt.decode path sees the same identity)

export const DEV_BYPASS = import.meta.env.VITE_AUTH_BYPASS === "true";

const PERSONA_KEY = "devPersona";
const TOKEN_KEY = "devAuthToken";
const LAST_VESSEL_KEY = "devLastVesselId";

const DEV_PERSONA_MASTER_USER_IDS: Readonly<Record<string, number>> = {
  "sail-admin": 1,
  admin: 24,
  "vessel-admin": 7,
  "vessel-user": 8,
};

export interface DevVessel {
  vessel: string;
  vesselId: string;
  imoNumber: string;
}

export interface DevPersonaState {
  personaKey: string;
  masterUserId: number;
  role: string;
  roleId: string;
  userType: string;
  designation?: string;
  vessel?: DevVessel;
}

function base64Url(obj: Record<string, unknown>): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Unsigned dev JWT (header.payload.devsig). Only meaningful when the backend
// runs with AUTH_BYPASS=true, where the token is jwt.decode'd unverified.
function buildDevToken(state: DevPersonaState): string {
  if (!Number.isInteger(state.masterUserId) || state.masterUserId <= 0) {
    throw new Error("Dev persona requires a positive integer master user ID.");
  }

  const header = { alg: "none", typ: "JWT" };
  const payload = {
    id: state.masterUserId,
    userType: state.userType,
    role: state.role,
    roleId: state.roleId,
    // MUST be plain string UUIDs — object entries are ignored by getActor
    // (fail-closed) and produce 403s for Ship users.
    vessels: state.vessel ? [state.vessel.vesselId] : [],
  };
  return `${base64Url(header)}.${base64Url(payload)}.devsig`;
}

export function getDevPersonaMasterUserId(personaKey: string): number | undefined {
  return DEV_PERSONA_MASTER_USER_IDS[personaKey];
}

function readStoredDevPersona(): DevPersonaState | null {
  try {
    const raw = localStorage.getItem(PERSONA_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as Partial<DevPersonaState>;
    const masterUserId = Number.isInteger(stored.masterUserId)
      ? stored.masterUserId
      : getDevPersonaMasterUserId(stored.personaKey ?? "");

    if (
      !masterUserId ||
      typeof stored.personaKey !== "string" ||
      typeof stored.role !== "string" ||
      typeof stored.roleId !== "string" ||
      typeof stored.userType !== "string"
    ) {
      return null;
    }

    return { ...stored, masterUserId } as DevPersonaState;
  } catch {
    return null;
  }
}

export function getDevPersonaToken(): string | null {
  if (!DEV_BYPASS) return null;
  try {
    const state = readStoredDevPersona();
    if (!state) return null;

    const token = buildDevToken(state);
    localStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
}

export function getActiveDevPersona(): DevPersonaState | null {
  if (!DEV_BYPASS) return null;
  return readStoredDevPersona();
}

export function getLastVesselId(): string | null {
  if (!DEV_BYPASS) return null;
  try {
    return localStorage.getItem(LAST_VESSEL_KEY);
  } catch {
    return null;
  }
}

export function applyDevPersona(state: DevPersonaState): void {
  if (!DEV_BYPASS) return;
  const profile = {
    role: state.role,
    roleId: state.roleId,
    userId: String(state.masterUserId),
    userType: state.userType,
    ...(state.designation ? { designation: state.designation } : {}),
    myVessels: state.vessel ? [state.vessel] : [],
  };
  localStorage.setItem("userProfile", JSON.stringify(profile));
  localStorage.setItem(TOKEN_KEY, buildDevToken(state));
  localStorage.setItem(PERSONA_KEY, JSON.stringify(state));
  if (state.vessel) {
    localStorage.setItem(LAST_VESSEL_KEY, state.vessel.vesselId);
  }
  window.location.reload();
}

export function clearDevPersona(): void {
  if (!DEV_BYPASS) return;
  localStorage.removeItem("userProfile");
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PERSONA_KEY);
  window.location.reload();
}
