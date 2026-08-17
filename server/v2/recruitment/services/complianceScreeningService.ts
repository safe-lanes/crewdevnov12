import { v4 as uuidv4 } from "uuid";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import {
    recruitmentCandidatesV2,
    candDocuments,
} from "../../../../shared/v2/recruitment/schema";
import { masterNationalities, masterCountries } from "../../../../shared/schema";
import {
    ScreeningPayloadSchema,
    computeOverallStatus,
    type CheckOutcome,
    type ScreeningPayload,
    type ValidationIssue,
} from "../../../../shared/v2/recruitment/complianceScreeningTypes";
import { tenantConfigService } from "../../accounts/services/tenantConfigService";
import { getAdapterFor } from "../complianceProviders/providerRegistry";
import { callProvider } from "../complianceProviders/httpCaller";
import { screeningRepository } from "../repositories/complianceScreeningRepository";

// Which fields are REQUIRED before any (paid) call is allowed.
// When the real API is chosen, adjust this ONE list to its requirements.
const REQUIRED_PERSON_FIELDS: Array<{
    key: "fullName" | "dateOfBirth" | "nationality" | "passportNumber";
    section: string;
    message: string;
}> = [
        { key: "fullName", section: "A1 - Seafarer's Particulars", message: "Full name is missing" },
        { key: "dateOfBirth", section: "A1 - Seafarer's Particulars", message: "Date of Birth is missing" },
        { key: "nationality", section: "A1 - Seafarer's Particulars", message: "Nationality is missing" },
        { key: "passportNumber", section: "A2 - Travel & ID Documents", message: "Passport number is missing" },
    ];

export class ScreeningService {
    /** Feature flag: acc_tenant_config_v2.settings.complianceScreeningEnabled === true */
    async isEnabled(): Promise<boolean> {
        try {
            const cfg = await tenantConfigService.get();
            const settings = (cfg?.settings ?? {}) as Record<string, unknown>;
            return settings.complianceScreeningEnabled === true;
        } catch {
            return false; // any problem reading config = feature off (safe default)
        }
    }

    /** Build our canonical payload from A1/A2 data (read-only). */
    async buildPayload(recCanUuid: string): Promise<ScreeningPayload> {
        const db = getDb();

        const candRows = await db
            .select({
                firstName: recruitmentCandidatesV2.firstName,
                middleName: recruitmentCandidatesV2.middleName,
                familyName: recruitmentCandidatesV2.familyName,
                dob: recruitmentCandidatesV2.dob,
                nationalityName: masterNationalities.nationality,
            })
            .from(recruitmentCandidatesV2)
            .leftJoin(
                masterNationalities,
                eq(recruitmentCandidatesV2.nationalityUuid, masterNationalities.natUuid),
            )
            .where(
                and(
                    eq(recruitmentCandidatesV2.recCanUuid, recCanUuid),
                    eq(recruitmentCandidatesV2.isDeleted, false),
                ),
            )
            .limit(1);

        const cand = candRows[0];
        if (!cand) throw new Error(`Candidate not found: ${recCanUuid}`);

        const docs = await db
            .select({
                documentName: candDocuments.documentName,
                number: candDocuments.number,
                issuingCountryName: masterCountries.countryName,
            })
            .from(candDocuments)
            .leftJoin(
                masterCountries,
                eq(candDocuments.issuingCountryUuid, masterCountries.countryUuid),
            )
            .where(
                and(eq(candDocuments.recCanUuid, recCanUuid), eq(candDocuments.isDeleted, false)),
            );

        const findDoc = (needle: string) =>
            docs.find((d: any) => (d.documentName ?? "").toLowerCase().includes(needle));
        const passport = findDoc("passport");
        const cdc = findDoc("cdc") ?? findDoc("seaman");

        const fullName = [cand.firstName, cand.middleName, cand.familyName]
            .filter((p) => p && String(p).trim())
            .join(" ")
            .trim();

        const payload: ScreeningPayload = {
            requestId: uuidv4(),
            candidateUuid: recCanUuid,
            checks: ["OFAC", "GLOBAL_SANCTIONS"],
            person: {
                fullName,
                firstName: cand.firstName ?? undefined,
                middleName: cand.middleName ?? undefined,
                familyName: cand.familyName ?? undefined,
                dateOfBirth: cand.dob ?? undefined,
                nationality: cand.nationalityName ?? undefined,
                passportNumber: passport?.number ?? undefined,
                passportIssuingCountry: passport?.issuingCountryName ?? undefined,
                cdcNumber: cdc?.number ?? undefined,
                cdcIssuingCountry: cdc?.issuingCountryName ?? undefined,
            },
        };
        return ScreeningPayloadSchema.parse(payload);
    }

    /** Pre-call validation gate: returns [] when OK, otherwise the list of problems. */
    validatePayload(payload: ScreeningPayload): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        for (const f of REQUIRED_PERSON_FIELDS) {
            const value =
                f.key === "fullName" ? payload.person.fullName : payload.person[f.key];
            if (!value || !String(value).trim()) {
                issues.push({ field: f.key, section: f.section, message: f.message });
            }
        }
        return issues;
    }

    /**
 * Screen (or re-screen) a candidate. Overwrites the single row.
 * Returns { screening, validationIssues } — issues are LIVE-ONLY, never stored.
 */
    async screen(recCanUuid: string, checkedByUuid?: string) {
        // 1. Build payload (read-only). If even this fails, record the failure.
        let payload: ScreeningPayload;
        try {
            payload = await this.buildPayload(recCanUuid);
        } catch (e) {
            const screening = await screeningRepository.upsert(recCanUuid, {
                overallStatus: "UNABLE_TO_CHECK",
                result: {
                    error: e instanceof Error ? e.message : String(e),
                },
                provider: null,
                checkedByUuid: checkedByUuid ?? null,
                checkedOn: new Date(),
            });
            return { screening, validationIssues: [] as ValidationIssue[] };
        }

        // 2. Validation gate — missing data = NO provider call, row stays PENDING.
        //    Issues are returned to the caller but NOT stored.
        const issues = this.validatePayload(payload);
        if (issues.length > 0) {
            const screening = await screeningRepository.upsert(recCanUuid, {
                overallStatus: "PENDING",
                result: null,
                provider: null,
                checkedByUuid: checkedByUuid ?? null,
                checkedOn: new Date(),
            });
            return { screening, validationIssues: issues };
        }

        // 3. Call the provider(s) and store the outcome.
        try {
            const adapter = getAdapterFor("OFAC"); // mock handles both checks in one pass
            const request = adapter.buildRequest(payload);
            const raw = await callProvider(request);
            const result = adapter.parseResponse(raw, payload); // Zod safety gate inside

            const screening = await screeningRepository.upsert(recCanUuid, {
                overallStatus: computeOverallStatus(result.checks),
                result,
                provider: adapter.providerName,
                checkedByUuid: checkedByUuid ?? null,
                checkedOn: new Date(),
            });
            return { screening, validationIssues: [] as ValidationIssue[] };
        } catch (e) {
            // Any failure = UNABLE_TO_CHECK. Never crashes the caller.
            const now = new Date().toISOString();
            const failedChecks: CheckOutcome[] = payload.checks.map((checkType) => ({
                checkType,
                checkStatus: "UNABLE_TO_CHECK",
                result: null,
                checkedOn: null,
                referenceNo: null,
                remarks: null,
                matchCount: 0,
                matches: [],
                error: {
                    errorCode: "SCREENING_FAILED",
                    errorMessage: e instanceof Error ? e.message : String(e),
                    occurredAt: now,
                },
            }));
            const screening = await screeningRepository.upsert(recCanUuid, {
                overallStatus: "UNABLE_TO_CHECK",
                result: { requestId: payload.requestId, provider: "unknown", checks: failedChecks },
                provider: null,
                checkedByUuid: checkedByUuid ?? null,
                checkedOn: new Date(),
            });
            return { screening, validationIssues: [] as ValidationIssue[] };
        }
    }

    /** Fetch the single screening row for a candidate (undefined = never screened). */
    async getScreening(recCanUuid: string) {
        return screeningRepository.findByCandidate(recCanUuid);
    }

    /** Edit the single remark (editable indefinitely). */
    async setRemark(recCanUuid: string, remark: string, remarkByUuid?: string) {
        return screeningRepository.updateRemark(recCanUuid, remark, remarkByUuid ?? null);
    }
}

export const screeningService = new ScreeningService();