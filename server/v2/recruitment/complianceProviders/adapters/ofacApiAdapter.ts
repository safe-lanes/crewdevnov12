import type {
    ProviderHttpRequest,
    ScreeningProviderAdapter,
} from "../../../../../shared/v2/recruitment/complianceScreeningTypes";
import {
    ScreeningResultSchema,
    type CheckOutcome,
    type CheckType,
    type PersonMatch,
    type ScreeningPayload,
    type ScreeningResult,
} from "../../../../../shared/v2/recruitment/complianceScreeningTypes";

// ── Which sanction lists feed which of our two indicators ───────────────────
// Codes from https://docs.ofac-api.com/datasources
const OFAC_SOURCES = ["SDN", "NONSDN"];
const GLOBAL_SOURCES = ["UN", "FSF", "OFSI", "FCDO", "SECO", "DFAT", "SEMA"];

const SOURCE_NAMES: Record<string, string> = {
    SDN: "OFAC SDN List",
    NONSDN: "OFAC Consolidated (non-SDN) List",
    UN: "UN Security Council Consolidated Sanctions",
    FSF: "EU Financial Sanctions Files (FSF)",
    OFSI: "Office of Financial Sanctions Implementation (UK)",
    FCDO: "FCDO UK Sanctions List",
    SECO: "Swiss SECO Sanctions and Embargoes",
    DFAT: "Australian DFAT Sanctions",
    SEMA: "Canadian SEMA Sanctions",
};

function refNo(prefix: string): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// The API wants dob as YYYY-MM-DD. Pass through if already that shape,
// otherwise try to parse; if unparseable, omit (name screening still works).
function toApiDate(v: string | undefined): string | undefined {
    if (!v) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (isNaN(d.getTime())) return undefined;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Convert one raw API match into our fixed PersonMatch shape.
function toPersonMatch(m: any): PersonMatch {
    const s = m?.sanction ?? {};
    const pd = s?.personDetails ?? {};
    const ids: any[] = Array.isArray(s?.identifications) ? s.identifications : [];
    const passport = ids.find((i: any) =>
        String(i?.type ?? "").toLowerCase().includes("passport"),
    );
    return {
        matchedName: String(s.name ?? s.nameFormatted ?? "Unknown"),
        dateOfBirth: Array.isArray(pd.birthDates) && pd.birthDates.length > 0 ? String(pd.birthDates[0]) : undefined,
        nationality: Array.isArray(pd.nationalities) && pd.nationalities.length > 0 ? String(pd.nationalities[0]) : undefined,
        passportNumber: passport?.idNumber ? String(passport.idNumber) : undefined,
        listName: SOURCE_NAMES[String(s.source ?? "")] ?? (s.source ? String(s.source) : undefined),
        listSource: s.source ? String(s.source) : undefined,
        program: Array.isArray(s.programs) && s.programs.length > 0 ? s.programs.join(", ") : undefined,
        referenceId: s.sourceId ? String(s.sourceId) : s.id ? String(s.id) : undefined,
        providerDetails: { raw: m }, // full untouched evidence (score, matchSummary, sanction)
    };
}

export const ofacApiAdapter: ScreeningProviderAdapter = {
    providerName: "ofac-api.com",
    supportedChecks: ["OFAC", "GLOBAL_SANCTIONS"],

    buildRequest(payload: ScreeningPayload): ProviderHttpRequest {
        const apiKey = process.env.SCREENING_API_KEY;
        if (!apiKey) {
            // Clear failure -> service catch turns this into UNABLE_TO_CHECK (red), never a crash
            throw new Error("SCREENING_API_KEY is not set in the environment");
        }
        const url = process.env.SCREENING_API_URL || "https://api.ofac-api.com/v4/screen";
        const p = payload.person;
        const identification: Array<{ type: string; idNumber: string; country?: string }> = [];
        if (p.passportNumber) {
            identification.push({
                type: "Passport",
                idNumber: p.passportNumber,
                country: p.passportIssuingCountry || undefined,
            });
        }
        return {
            url: url,
            method: "POST",
            headers: {},
            body: {
                apiKey,
                minScore: 95, // docs-recommended threshold
                sources: [...OFAC_SOURCES, ...GLOBAL_SOURCES], // ONE call covers both indicators
                types: ["person"],
                cases: [
                    {
                        id: payload.requestId, // maps the result back to this request
                        name: p.fullName,
                        type: "person",
                        dob: toApiDate(p.dateOfBirth),
                        nationality: p.nationality || undefined,
                        citizenship: p.nationality || undefined,
                        ...(identification.length > 0 ? { identification } : {}),
                    },
                ],
            },
        };
    },

    parseResponse(raw: unknown, payload: ScreeningPayload): ScreeningResult {
        const data = raw as any;

        // Their error signal: some responses carry an "error" / non-results body.
        if (!data || !Array.isArray(data.results)) {
            const msg = data?.error?.message ?? data?.message ?? "Unexpected response from ofac-api.com (no results array)";
            throw new Error(String(msg));
        }

        // Find OUR case (we sent exactly one, keyed by requestId)
        const result =
            data.results.find((r: any) => r?.id === payload.requestId) ?? data.results[0];
        const allMatches: any[] = Array.isArray(result?.matches) ? result.matches : [];

        const now = new Date().toISOString();

        const build = (checkType: CheckType): CheckOutcome => {
            const wanted = checkType === "OFAC" ? OFAC_SOURCES : GLOBAL_SOURCES;
            const hits = allMatches.filter((m: any) =>
                wanted.includes(String(m?.sanction?.source ?? "")),
            );
            const isMatch = hits.length > 0;
            const prefix = checkType === "OFAC" ? "OFAC" : "SAN";
            return {
                checkType,
                checkStatus: "COMPLETED",
                result: isMatch ? "POSSIBLE_MATCH" : "PASSED",
                checkedOn: now,
                referenceNo: refNo(prefix),
                remarks: isMatch
                    ? null
                    : checkType === "OFAC"
                        ? "No record found for the provided details."
                        : "No record found in Global Sanctions List.",
                matchCount: hits.length,
                matches: hits.map(toPersonMatch),
                error: null,
            };
        };

        const parsed: ScreeningResult = {
            requestId: payload.requestId,
            provider: "ofac-api.com",
            checks: payload.checks.map((c) => build(c)),
        };
        // Safety gate — real data must fit the fixed skeleton too
        return ScreeningResultSchema.parse(parsed);
    },
};