import type { ProviderHttpRequest } from "../../../../shared/v2/recruitment/complianceScreeningTypes";

// Shared HTTP caller for ALL providers: timeout + clear errors.
// "internal://" URLs (mock) never touch the network.
export async function callProvider(
    req: ProviderHttpRequest,
    timeoutMs = 15000,
): Promise<unknown> {
    if (req.url.startsWith("internal://")) return {};

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(req.url, {
            method: req.method,
            headers: { "Content-Type": "application/json", ...req.headers },
            body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
            signal: ctrl.signal,
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Provider HTTP ${res.status}: ${text.slice(0, 500)}`);
        }
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}