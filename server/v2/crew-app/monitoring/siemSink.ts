import { createHmac } from "node:crypto";
import { registerCrewSecurityAlertSink, registerCrewSecurityEventSink, type CrewSecurityAlert, type CrewSecurityEvent } from "./securityEvents";

type Envelope = { kind: "event" | "alert"; record: CrewSecurityEvent | CrewSecurityAlert };
const MAX_QUEUE = 1_000;
const MAX_ATTEMPTS = 8;
let queue: Array<{ envelope: Envelope; attempts: number; dueAt: number }> = [];
let timer: NodeJS.Timeout | null = null;
let sending = false;
let delivered = 0;
let failed = 0;
let dropped = 0;

function config() {
  const url = process.env.CREW_APP_SIEM_URL?.trim();
  const token = process.env.CREW_APP_SIEM_TOKEN?.trim();
  if (!url || !token) return null;
  if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) throw new Error("CREW_APP_SIEM_URL must use HTTPS in production");
  return { url, token };
}

function schedule(delay = 0) {
  if (timer) return;
  timer = setTimeout(() => { timer = null; void drain(); }, delay);
  timer.unref?.();
}

function enqueue(envelope: Envelope): void {
  if (queue.length >= MAX_QUEUE) {
    dropped += 1;
    console.error("[crew-siem] delivery queue capacity exceeded", { dropped });
    return;
  }
  queue.push({ envelope, attempts: 0, dueAt: Date.now() });
  schedule();
}

async function deliver(envelope: Envelope): Promise<void> {
  const selected = config();
  if (!selected) throw new Error("siem_not_configured");
  const body = JSON.stringify(envelope);
  const signature = createHmac("sha256", selected.token).update(body).digest("hex");
  const response = await fetch(selected.url, { method: "POST", headers: { "Content-Type": "application/json", "X-SAIL-Signature": `sha256=${signature}` }, body, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`siem_http_${response.status}`);
}

async function drain(): Promise<void> {
  if (sending) return;
  sending = true;
  try {
    const item = queue[0];
    if (!item) return;
    const wait = item.dueAt - Date.now();
    if (wait > 0) { schedule(wait); return; }
    try {
      await deliver(item.envelope); queue.shift(); delivered += 1;
    } catch {
      item.attempts += 1; failed += 1;
      if (item.attempts >= MAX_ATTEMPTS) { queue.shift(); dropped += 1; console.error("[crew-siem] delivery exhausted", { attempts: item.attempts, dropped }); }
      else item.dueAt = Date.now() + Math.min(300_000, 1_000 * 2 ** (item.attempts - 1)) * (0.75 + Math.random() * 0.5);
    }
  } finally {
    sending = false;
    if (queue.length) schedule(Math.max(0, queue[0].dueAt - Date.now()));
  }
}

export function initializeCrewSiem(): void {
  if (!config()) {
    if (process.env.NODE_ENV === "production") throw new Error("Production requires CREW_APP_SIEM_URL and CREW_APP_SIEM_TOKEN");
    return;
  }
  registerCrewSecurityEventSink((event) => enqueue({ kind: "event", record: event }));
  registerCrewSecurityAlertSink((alert) => enqueue({ kind: "alert", record: alert }));
}

export async function flushCrewSiem(timeoutMs = 10_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (queue.length && Date.now() < deadline) { queue[0].dueAt = Date.now(); await drain(); }
  return queue.length === 0;
}

export function crewSiemHealth() { return { configured: Boolean(config()), queued: queue.length, delivered, failed, dropped }; }
export function resetCrewSiemForTests() { if (timer) clearTimeout(timer); timer = null; queue = []; sending = false; delivered = 0; failed = 0; dropped = 0; }
