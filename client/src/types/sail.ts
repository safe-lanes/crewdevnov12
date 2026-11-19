/**
 * SAIL Web (NestJS) Types
 * Purpose: Request/response contracts for the parent SAIL Web user APIs
 * used by the Common Login integration.
 */

export type SailUserType = "Office" | "Ship";
export type SailUserStatus = "Active" | "Inactive";

export interface CreateSailUserPayload {
  username: string;
  /** Omitted for crew users: SAIL generates a temporary password and emails it. */
  password?: string;
  firstname: string;
  lastname: string;
  email?: string;
  /** Crew login: temporary password + forced change on first login. */
  isCrew?: boolean;
  /** Crew employee number stored on the SAIL user (defaults to username). */
  crewID?: string;
  /**
   * Crew rank (e.g. "Master"). Required for crew users: SAIL uses it to find the
   * rolemaster role, designation and crewing rank with the same name.
   */
  rankName?: string;
  /** Required unless isCrew + rankName are sent. */
  roleId?: string;
  designationId?: string;
  type: SailUserType;
  userStatus: SailUserStatus;
}

/**
 * POST /user currently responds { statusCode, message }; the user fields are
 * optional until SAIL returns the created user (needed to store the SAIL user id).
 */
export interface SailUser {
  statusCode?: number;
  message?: string;
  id?: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  [key: string]: unknown;
}
