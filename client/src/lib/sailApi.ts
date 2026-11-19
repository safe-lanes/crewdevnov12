/**
 * SAIL Web (NestJS) API client.
 *
 * All calls from Crew to the parent SAIL Web backend (API_BASE_URL) live here
 * so the Common Login integration has a single place to evolve.
 */
import { API_BASE_URL } from "@/config/api";
import { getAuthToken } from "@/lib/authToken";
import type { CreateSailUserPayload, SailUser } from "@/types/sail";

/**
 * TEMPORARY – local testing only. Paste a real SAIL token here (copy it from the
 * Authorization header of any localhost:3000 request in the Angular app).
 * When non-empty it overrides getAuthToken(). Clear it before committing.
 */
const SAIL_TEST_TOKEN = "";

function buildHeaders(hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (hasBody) headers["Content-Type"] = "application/json";

  const token = SAIL_TEST_TOKEN || getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return headers;
}

/** NestJS errors come back as { message: string | string[], error, statusCode }. */
async function toSailError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const body = await response.json().catch(() => null);
  const message = Array.isArray(body?.message)
    ? body.message.join(", ")
    : body?.message || body?.error || response.statusText;
  return new Error(message || fallback);
}

async function sailRequest<T>(
  method: string,
  path: string,
  data?: unknown,
  fallbackError = "SAIL request failed",
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(data !== undefined),
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) throw await toSailError(response, fallbackError);
  if (response.status === 204) return undefined as T;
  return response.json();
}

/**
 * Builds the SAIL user payload for a crew member created in Crew.
 * - empNo becomes the SAIL username.
 * - rankName (the Present Rank label, e.g. "Master") is resolved by SAIL to the
 *   rolemaster role and the designation with the same name.
 * - No password: SAIL generates a temporary one, emails it, and forces a
 *   change on first login.
 */
export interface CrewSailUserInput {
  empNo: string;
  firstName: string;
  lastName?: string | null;
  email: string;
  rankName: string;
}

export function buildCrewSailUserPayload({
  empNo,
  firstName,
  lastName,
  email,
  rankName,
}: CrewSailUserInput): CreateSailUserPayload {
  return {
    username: empNo,
    email: email.trim(),
    isCrew: true,
    crewID: empNo,
    rankName: rankName.trim(),
    firstname: firstName.trim(),
    lastname: (lastName ?? "").trim(),
    // Crew logins are always Vessel users ("Ship" in the SAIL API).
    type: "Ship",
    userStatus: "Active",
  };
}

export const sailApi = {
  async createUser(payload: CreateSailUserPayload): Promise<SailUser> {
    return sailRequest<SailUser>(
      "POST",
      "/user",
      payload,
      "Failed to create SAIL user",
    );
  },

  /**
   * Crew termination: soft-deletes the SAIL user linked to this employee number
   * (isDeleted = 1, login inactive) and ends its sessions. Safe to retry.
   */
  async deleteCrewUser(crewID: string): Promise<SailUser> {
    return sailRequest<SailUser>(
      "DELETE",
      `/user/crew/${encodeURIComponent(crewID)}`,
      undefined,
      "Failed to delete SAIL user",
    );
  },

  /**
   * Vessel sign-on / sign-off: replaces the vessels assigned to the crew user
   * (user.vesselIds + vesseluser). [vesselUuid] on sign-on, [] on sign-off.
   */
  async setCrewVessels(
    crewID: string,
    vesselUuids: string[],
  ): Promise<SailUser> {
    return sailRequest<SailUser>(
      "PUT",
      `/user/crew/${encodeURIComponent(crewID)}/vessels`,
      { vesselUuids },
      "Failed to update SAIL user vessels",
    );
  },

  /**
   * Profile edit: updates name / email of the crew user and, when rankName is
   * sent, the role / designation / crewing rank with that name (only fields sent).
   */
  async updateCrewProfile(
    crewID: string,
    data: { firstname?: string; lastname?: string; email?: string; rankName?: string },
  ): Promise<SailUser> {
    return sailRequest<SailUser>(
      "PATCH",
      `/user/crew/${encodeURIComponent(crewID)}`,
      data,
      "Failed to update SAIL user profile",
    );
  },
};

// ---------------------------------------------------------------------------
// Common Login sync helpers – called after a Crew change succeeds.
// They never throw: the Crew change is already saved, so a SAIL failure is
// only logged. They take the Crew crewUuid and look up the employee number
// (the SAIL crewID / username).
// ---------------------------------------------------------------------------

async function getCrewEmpNo(crewUuid: string): Promise<string | null> {
  const response = await fetch(
    `/api/v2/crew-pool/crew/${encodeURIComponent(crewUuid)}`,
  );
  if (!response.ok) return null;
  const crew = await response.json().catch(() => null);
  return crew?.empNo || crew?.employeeId || null;
}

async function runSailSync(
  label: string,
  task: () => Promise<unknown>,
): Promise<void> {
  try {
    const result = await task();
    console.log(`[Common Login] ${label}`, result);
  } catch (error) {
    console.error(`[Common Login] ${label} failed:`, error);
  }
}

/** After sign-on: give the crew member's SAIL login access to the vessel. */
export function syncSailVesselSignOn(
  crewUuid: string | null | undefined,
  vesselUuid: string | null | undefined,
): Promise<void> {
  if (!crewUuid || !vesselUuid) return Promise.resolve();
  return runSailSync(`vessel sign-on ${vesselUuid}`, async () => {
    const empNo = await getCrewEmpNo(crewUuid);
    return empNo ? sailApi.setCrewVessels(empNo, [vesselUuid]) : "no empNo";
  });
}

/** After sign-off: remove all vessel access from the crew member's SAIL login. */
export function syncSailVesselSignOff(
  crewUuid: string | null | undefined,
): Promise<void> {
  if (!crewUuid) return Promise.resolve();
  return runSailSync("vessel sign-off", async () => {
    const empNo = await getCrewEmpNo(crewUuid);
    return empNo ? sailApi.setCrewVessels(empNo, []) : "no empNo";
  });
}

/**
 * After a profile save: push name / email / rank changes to the crew member's
 * SAIL login. A rank change updates the SAIL role, designation and crewing rank.
 */
export function syncSailProfile(
  crewUuid: string | null | undefined,
  changes: {
    firstName?: string | null;
    familyName?: string | null;
    email?: string | null;
    presentRank?: string | null;
  },
): Promise<void> {
  if (!crewUuid) return Promise.resolve();
  const data: { firstname?: string; lastname?: string; email?: string; rankName?: string } = {};
  if (typeof changes.firstName === "string" && changes.firstName.trim())
    data.firstname = changes.firstName.trim();
  if (typeof changes.familyName === "string")
    data.lastname = changes.familyName.trim();
  if (typeof changes.email === "string" && changes.email.trim())
    data.email = changes.email.trim();
  if (typeof changes.presentRank === "string" && changes.presentRank.trim())
    data.rankName = changes.presentRank.trim();
  if (Object.keys(data).length === 0) return Promise.resolve();
  return runSailSync("profile sync", async () => {
    const empNo = await getCrewEmpNo(crewUuid);
    return empNo ? sailApi.updateCrewProfile(empNo, data) : "no empNo";
  });
}
