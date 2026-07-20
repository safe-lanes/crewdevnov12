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

export interface DevVessel {
  vessel: string;
  vesselId: string;
  imoNumber: string;
}

export interface DevPersonaState {
  personaKey: string;
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
  const header = { alg: "none", typ: "JWT" };
  const payload = {
    id: "dev-persona",
    userType: state.userType,
    role: state.role,
    roleId: state.roleId,
    // MUST be plain string UUIDs — object entries are ignored by getActor
    // (fail-closed) and produce 403s for Ship users.
    vessels: state.vessel ? [state.vessel.vesselId] : [],
  };
  return `${base64Url(header)}.${base64Url(payload)}.devsig`;
}

export function getDevPersonaToken(): string | null {
  if (!DEV_BYPASS) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getActiveDevPersona(): DevPersonaState | null {
  if (!DEV_BYPASS) return null;
  try {
    const raw = localStorage.getItem(PERSONA_KEY);
    return raw ? (JSON.parse(raw) as DevPersonaState) : null;
  } catch {
    return null;
  }
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
    userId: "dev-persona",
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
