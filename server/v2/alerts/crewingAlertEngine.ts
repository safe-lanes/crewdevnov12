/**
 * Crewing Alert Engine
 *
 * Background scanner scheduler that periodically triggers crewing alert scans.
 */

import { AlertsService } from "./services/alertsService";

const alertsService = new AlertsService();

export class CrewingAlertEngine {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private scanIntervalMs = parseInt(process.env.ALERT_SCAN_INTERVAL_MS || "900000", 10); // 15 minutes default

  start(intervalMs?: number): void {
    if (this.isRunning) {
      console.log('[CrewingAlertEngine] Already running');
      return;
    }

    if (intervalMs) {
      this.scanIntervalMs = intervalMs;
    }

    console.log(`[CrewingAlertEngine] Starting scanner scheduler (interval: ${this.scanIntervalMs / 1000 / 60} minutes)`);

    // Defer initial scan to allow database setup and migrations to complete
    setTimeout(() => {
      alertsService.runScan().catch(err => {
        console.error('[CrewingAlertEngine] Error during initial scan:', err);
      });
    }, 30000); // 30s after boot

    this.intervalId = setInterval(() => {
      alertsService.runScan().catch(err => {
        console.error('[CrewingAlertEngine] Error during scheduled scan:', err);
      });
    }, this.scanIntervalMs);

    this.isRunning = true;
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[CrewingAlertEngine] Stopped');
  }
}

export const crewingAlertEngine = new CrewingAlertEngine();
