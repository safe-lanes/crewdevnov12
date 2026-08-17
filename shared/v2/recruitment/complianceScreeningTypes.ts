import { z } from "zod";

// ============================================================
// Compliance Screening — canonical (provider-neutral) contracts
// These shapes NEVER change when API providers are added/swapped.
// ============================================================

// ---------- fixed vocabulary ----------
export const CHECK_TYPES = ["OFAC", "GLOBAL_SANCTIONS"] as const;
export type CheckType = (typeof CHECK_TYPES)[number];

// Did the API call complete? (drives the grey/green/red indicator)
export const CHECK_STATUSES = ["PENDING", "COMPLETED", "UNABLE_TO_CHECK"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

// If completed, what was the outcome? (shown inside View Details)
export const CHECK_RESULTS = ["PASSED", "POSSIBLE_MATCH"] as const;
export type CheckResult = (typeof CHECK_RESULTS)[number];

// ---------- fixed OUTGOING payload ----------
export const ScreeningPayloadSchema = z.object({
    requestId: z.string(),
    candidateUuid: z.string(),
    checks: z.array(z.enum(CHECK_TYPES)),
    person: z.object({
        fullName: z.string(),
        firstName: z.string().optional(),
        middleName: z.string().optional(),
        familyName: z.string().optional(),
        dateOfBirth: z.string().optional(),          // as stored in form
        nationality: z.string().optional(),          // resolved name, not UUID
        passportNumber: z.string().optional(),
        passportIssuingCountry: z.string().optional(),
        cdcNumber: z.string().optional(),
        cdcIssuingCountry: z.string().optional(),
    }),
});
export type ScreeningPayload = z.infer<typeof ScreeningPayloadSchema>;

// ---------- fixed INCOMING result ----------
export const PersonMatchSchema = z.object({
    matchedName: z.string(),
    dateOfBirth: z.string().optional(),
    nationality: z.string().optional(),
    passportNumber: z.string().optional(),
    listName: z.string().optional(),               // e.g. "SDN (Specially Designated Nationals) List"
    listSource: z.string().optional(),             // e.g. "UN Consolidated List"
    program: z.string().optional(),                // e.g. "RUSSIA-EO14024"
    referenceId: z.string().optional(),
    providerDetails: z.object({ raw: z.unknown() }), // untouched provider evidence
});
export type PersonMatch = z.infer<typeof PersonMatchSchema>;

export const CheckOutcomeSchema = z.object({
    checkType: z.enum(CHECK_TYPES),
    checkStatus: z.enum(CHECK_STATUSES),
    result: z.enum(CHECK_RESULTS).nullable(),      // null until COMPLETED
    checkedOn: z.string().nullable(),              // ISO datetime
    referenceNo: z.string().nullable(),            // e.g. "OFAC-20260716-112045"
    remarks: z.string().nullable(),                // provider-side remark, e.g. "No record found..."
    matchCount: z.number(),
    matches: z.array(PersonMatchSchema),
    error: z
        .object({ errorCode: z.string(), errorMessage: z.string(), occurredAt: z.string() })
        .nullable(),
});
export type CheckOutcome = z.infer<typeof CheckOutcomeSchema>;

export const ScreeningResultSchema = z.object({
    requestId: z.string(),
    provider: z.string(),                          // "mock" for now
    checks: z.array(CheckOutcomeSchema),           // one entry per check type
});
export type ScreeningResult = z.infer<typeof ScreeningResultSchema>;

// ---------- pre-call validation (the money saver) ----------
export const ValidationIssueSchema = z.object({
    field: z.string(),                             // e.g. "dateOfBirth"
    section: z.string(),                           // e.g. "A1 - Seafarer's Particulars"
    message: z.string(),                           // e.g. "Date of Birth is missing"
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

// ---------- overall status rule, defined ONCE ----------
// PENDING          = no completed/failed checks yet (grey)
// COMPLETED        = every check completed (green) — result may still be Possible Match
// UNABLE_TO_CHECK  = at least one check failed (red)
export function computeOverallStatus(checks: CheckOutcome[]): CheckStatus {
    if (checks.some((c) => c.checkStatus === "UNABLE_TO_CHECK")) return "UNABLE_TO_CHECK";
    if (checks.length > 0 && checks.every((c) => c.checkStatus === "COMPLETED")) return "COMPLETED";
    return "PENDING";
}

// What the shared HTTP caller needs to physically make a call.
export interface ProviderHttpRequest {
    url: string;                        // "internal://mock" short-circuits (no network)
    method: "GET" | "POST";
    headers: Record<string, string>;
    body?: unknown;
}

// The contract every provider adapter (mock or real) must fulfill.
// Adding a real API later = one new file implementing this + one secret + one registry entry.
export interface ScreeningProviderAdapter {
    providerName: string;               // "mock", later "windward", etc.
    supportedChecks: CheckType[];

    // REQUEST BUILDER: our payload -> their API call
    buildRequest(payload: ScreeningPayload): ProviderHttpRequest;

    // RESPONSE BUILDER: their raw reply -> our fixed result (must Zod-validate before returning)
    parseResponse(raw: unknown, payload: ScreeningPayload): ScreeningResult;
}