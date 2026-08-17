import type {
    ProviderHttpRequest,
    ScreeningProviderAdapter,
} from "../../../../../shared/v2/recruitment/complianceScreeningTypes";
import {
    ScreeningResultSchema,
    type CheckOutcome,
    type ScreeningPayload,
    type ScreeningResult,
} from "../../../../../shared/v2/recruitment/complianceScreeningTypes";
import { MOCK_OFAC_MATCH, MOCK_SANCTIONS_MATCH } from "../mockData";

function refNo(prefix: string): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export const mockAdapter: ScreeningProviderAdapter = {
    providerName: "mock",
    supportedChecks: ["OFAC", "GLOBAL_SANCTIONS"],

    buildRequest(): ProviderHttpRequest {
        // internal:// = the shared caller short-circuits, no network call ever
        return { url: "internal://mock", method: "POST", headers: {} };
    },

    parseResponse(_raw: unknown, payload: ScreeningPayload): ScreeningResult {
        const family = (payload.person.familyName ?? "").toUpperCase();
        const now = new Date().toISOString();

        const build = (checkType: "OFAC" | "GLOBAL_SANCTIONS"): CheckOutcome => {
            if (family.includes("FAIL")) {
                return {
                    checkType,
                    checkStatus: "UNABLE_TO_CHECK",
                    result: null,
                    checkedOn: null,
                    referenceNo: null,
                    remarks: null,
                    matchCount: 0,
                    matches: [],
                    error: {
                        errorCode: "PROVIDER_UNAVAILABLE",
                        errorMessage: "Simulated API outage (mock provider)",
                        occurredAt: now,
                    },
                };
            }
            const isMatch = family.includes("SANCTION");
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
                matchCount: isMatch ? 1 : 0,
                matches: isMatch
                    ? [
                        checkType === "OFAC"
                            ? { ...MOCK_OFAC_MATCH, providerDetails: { raw: MOCK_OFAC_MATCH } }
                            : { ...MOCK_SANCTIONS_MATCH, providerDetails: { raw: MOCK_SANCTIONS_MATCH } },
                    ]
                    : [],
                error: null,
            };
        };

        const result: ScreeningResult = {
            requestId: payload.requestId,
            provider: "mock",
            checks: payload.checks.map((c) => build(c)),
        };
        // Safety gate — even fake data must fit the fixed skeleton
        return ScreeningResultSchema.parse(result);
    },
};