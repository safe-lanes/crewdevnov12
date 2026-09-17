/**
 * Background scanner for crew-app notifications (document/visa expiry).
 * Shape-mirrors server/v2/alerts/crewingAlertEngine.ts but is a fully separate
 * instance — does not import from server/v2/alerts/.
 */
import { crewNotificationsService } from "./services";

export class CrewNotificationScanner {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private initialScanTimeoutId: NodeJS.Timeout | null = null;
  private scanIntervalMs = parseInt(process.env.CREW_APP_NOTIFICATION_SCAN_INTERVAL_MS || "900000", 10); // 15 min default

  start(intervalMs?: number): void {
    if (this.isRunning) {
      console.log("[CrewNotificationScanner] Already running");
      return;
    }
    if (intervalMs) {
      this.scanIntervalMs = intervalMs;
    }

    console.log(
      `[CrewNotificationScanner] Starting scanner scheduler (interval: ${this.scanIntervalMs / 1000 / 60} minutes)`,
    );

    this.initialScanTimeoutId = setTimeout(() => {
      this.initialScanTimeoutId = null;
      crewNotificationsService.runScan().catch((err) => {
        console.error("[CrewNotificationScanner] Error during initial scan:", err);
      });
    }, 30000); // 30s after boot, same as crewingAlertEngine

    this.intervalId = setInterval(() => {
      crewNotificationsService.runScan().catch((err) => {
        console.error("[CrewNotificationScanner] Error during scheduled scan:", err);
      });
    }, this.scanIntervalMs);

    this.isRunning = true;
  }

  stop(): void {
    if (this.initialScanTimeoutId) {
      clearTimeout(this.initialScanTimeoutId);
      this.initialScanTimeoutId = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("[CrewNotificationScanner] Stopped");
  }
}

export const crewNotificationScanner = new CrewNotificationScanner();
