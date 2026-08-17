import type { ScreeningProviderAdapter } from "../../../../shared/v2/recruitment/complianceScreeningTypes";
import { mockAdapter } from "./adapters/mockAdapter";
import { ofacApiAdapter } from "./adapters/ofacApiAdapter";

// All known providers. Adding a new provider = write its adapter + add one line here.
const ADAPTERS: Record<string, ScreeningProviderAdapter> = {
    mock: mockAdapter,
    ofacApi: ofacApiAdapter,
};

/**
 * Provider selection is driven ENTIRELY by .env:
 *   SCREENING_PROVIDER=mock | ofacApi
 * Change the value + restart = provider switched. No code changes.
 */
export function getAdapterFor(_check: "OFAC" | "GLOBAL_SANCTIONS"): ScreeningProviderAdapter {
    const key = (process.env.SCREENING_PROVIDER ?? "mock").trim();
    const adapter = ADAPTERS[key];
    if (!adapter) {
        // Clear failure → service turns this into red UNABLE_TO_CHECK, never a silent green
        throw new Error(
            `Unknown SCREENING_PROVIDER "${key}" in .env. Valid values: ${Object.keys(ADAPTERS).join(", ")}`,
        );
    }
    return adapter;
}