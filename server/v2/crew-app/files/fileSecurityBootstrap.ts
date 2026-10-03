import { ClamAvScanner } from "./clamAvScanner";
import { clearCrewFileScanner, registerCrewFileScanner } from "./fileScanner";

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export function initializeCrewFileSecurity(env: NodeJS.ProcessEnv = process.env): void {
  clearCrewFileScanner();
  const provider = (env.CREW_APP_FILE_SCANNER || "").trim().toLowerCase();
  if (provider === "clamav") {
    if (!env.CLAMAV_HOST?.trim()) throw new Error("CLAMAV_HOST is required when CREW_APP_FILE_SCANNER=clamav");
    registerCrewFileScanner(new ClamAvScanner({ host: env.CLAMAV_HOST.trim(), port: positiveInteger(env.CLAMAV_PORT, 3310), timeoutMs: positiveInteger(env.CLAMAV_TIMEOUT_MS, 20_000) }));
  } else if (env.NODE_ENV === "production") {
    throw new Error("Production requires CREW_APP_FILE_SCANNER=clamav");
  }
}
