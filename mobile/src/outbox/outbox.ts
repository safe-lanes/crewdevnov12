import { digestStringAsync, CryptoDigestAlgorithm, randomUUID } from "expo-crypto";
import { crewInformationApi } from "../api/crewInformationApi";
import { tokenStore } from "../auth/tokenStore";
import { encryptedOutboxStore } from "./encryptedStore";
import { assertSafeOperation, EnqueueInput, OutboxOperation, Owner } from "./types";
import { queryClient } from "../queryClient";
import * as Network from "expo-network";

const MAX_OPERATIONS = 100;
const MAX_PAYLOAD_BYTES = 64 * 1024;
const COMPLETED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const BASE_RETRY_MS = 2_000;
const MAX_RETRY_MS = 5 * 60 * 1000;
let serial: Promise<unknown> = Promise.resolve();
let timer: ReturnType<typeof setTimeout> | null = null;
let knownOffline = false;
const listeners = new Set<() => void>();
let api = crewInformationApi;
let store = encryptedOutboxStore;
let networkState = () => Network.getNetworkStateAsync();

function currentOwner(): Owner | null {
  const { domain, crewUuid, accessToken } = tokenStore.get();
  return domain && crewUuid && accessToken ? { domain, crewUuid } : null;
}
const sameOwner = (a: Owner, b: Owner) => a.domain === b.domain && a.crewUuid === b.crewUuid;
const stable = (value: any): string => value && typeof value === "object"
  ? Array.isArray(value) ? `[${value.map(stable).join(",")}]` : `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`
  : JSON.stringify(value);
const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
  const next = serial.then(work, work);
  serial = next.catch(() => undefined);
  return next;
};
const notify = () => listeners.forEach((listener) => listener());
const delayFor = (attempts: number) => Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** Math.min(attempts, 8)) * (0.75 + Math.random() * 0.5);

async function fingerprint(owner: Owner, input: EnqueueInput): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, stable({ owner, ...input }));
}

async function send(item: OutboxOperation): Promise<void> {
  if (item.kind === "UPDATE_SINGLETON") await api.updateSection(item.section, item.payload, item.operationId);
  else await api.update(item.section, item.targetUuid!, item.payload, item.operationId);
}

async function confirm(item: OutboxOperation): Promise<"terminal" | "waiting" | "not_found"> {
  try {
    const result = await api.operationStatus(item.operationId);
    item.confirmationFailures = 0;
    item.serverStatus = result.status;
    if (result.status === "COMPLETED") { item.status = "COMPLETED"; item.completedAt = Date.now(); return "terminal"; }
    if (result.status === "REJECTED") { item.status = "REJECTED"; return "terminal"; }
    if (result.status === "NEEDS_OFFICE_REVIEW") { item.status = "NEEDS_RECONCILIATION"; return "terminal"; }
    item.status = "AWAITING_CONFIRMATION";
    item.nextAttemptAt = Date.now() + delayFor(item.attempts);
    return "waiting";
  } catch (error: any) {
    if (error?.status === 404) return "not_found";
    item.confirmationFailures += 1;
    item.lastSafeErrorCode = error?.code === "request_timeout" ? "status_timeout" : "status_unavailable";
    if (item.confirmationFailures >= 10) { item.status = "NEEDS_RECONCILIATION"; return "terminal"; }
    item.status = "AWAITING_CONFIRMATION";
    item.nextAttemptAt = Date.now() + delayFor(item.attempts);
    return "waiting";
  }
}

async function processOne(item: OutboxOperation): Promise<void> {
  if (item.status === "SENDING") {
    item.status = "AWAITING_CONFIRMATION";
    item.updatedAt = Date.now();
    await persistMutation(item);
  }
  if (["SENDING", "AWAITING_CONFIRMATION"].includes(item.status)) {
    const result = await confirm(item);
    if (result !== "not_found") { item.updatedAt = Date.now(); await persistMutation(item); return; }
  }
  item.status = "SENDING"; item.attempts += 1; item.lastAttemptAt = Date.now(); item.updatedAt = Date.now();
  await persistMutation(item);
  try {
    await send(item);
    // A successful authenticated HTTP response is the BFF's explicit receipt.
    // Office review may continue server-side, but transport delivery is complete.
    item.status = "COMPLETED";
    item.serverStatus = "ACCEPTED";
    item.completedAt = Date.now();
    await queryClient.invalidateQueries({ queryKey: ["crew-information"] });
  } catch (error: any) {
    if (error?.status && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
      item.status = "REJECTED";
    } else {
      item.status = "AWAITING_CONFIRMATION";
      item.lastSafeErrorCode = error?.code === "request_timeout" ? "request_timeout" : "network_unknown";
      item.nextAttemptAt = Date.now() + delayFor(item.attempts);
    }
  }
  item.updatedAt = Date.now();
  await persistMutation(item);
}

async function persistMutation(changed: OutboxOperation): Promise<void> {
  const all = await store.load();
  const index = all.findIndex((item) => item.localId === changed.localId);
  if (index >= 0) all[index] = changed;
  await store.save(all);
}

async function run(): Promise<void> {
  await exclusive(async () => {
    const owner = currentOwner();
    if (!owner) return;
    try {
      const network = await networkState();
      knownOffline = network.isConnected === false || network.isInternetReachable === false;
    } catch { /* Network state is only a hint; request classification remains authoritative. */ }
    if (knownOffline) return;
    let items = await store.load();
    const now = Date.now();
    items = items.filter((item) => item.status !== "COMPLETED" || !item.completedAt || now - item.completedAt < COMPLETED_RETENTION_MS);
    const candidate = items.find((item) => sameOwner(item.owner, owner) && !["COMPLETED", "REJECTED", "NEEDS_RECONCILIATION"].includes(item.status) && item.nextAttemptAt <= now);
    if (candidate) await processOne(candidate);
    else await store.save(items);
    notify();
  });
  schedule();
}

function schedule(delay = 2_000): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void run(); }, delay);
}

export const mobileOutbox = {
  async enqueue(input: EnqueueInput): Promise<OutboxOperation> {
    assertSafeOperation(input);
    const owner = currentOwner();
    if (!owner) throw new Error("Sign in before saving changes.");
    const bytes = new TextEncoder().encode(JSON.stringify(input.payload)).byteLength;
    if (bytes > MAX_PAYLOAD_BYTES) throw new Error("This change is too large to store safely for synchronization.");
    const fp = await fingerprint(owner, input);
    const result = await exclusive(async () => {
      const items = await store.load();
      const duplicate = items.find((item) => item.fingerprint === fp && !["COMPLETED", "REJECTED"].includes(item.status));
      if (duplicate) return duplicate;
      if (items.filter((item) => item.status !== "COMPLETED").length >= MAX_OPERATIONS) throw new Error("The secure sync queue is full. Reconnect and let pending changes finish.");
      const now = Date.now();
      const item: OutboxOperation = { version: 1, localId: randomUUID(), operationId: randomUUID(), owner, ...input, fingerprint: fp, status: "QUEUED", attempts: 0, confirmationFailures: 0, nextAttemptAt: now, createdAt: now, updatedAt: now };
      await store.save([...items, item]);
      return item;
    });
    notify(); schedule(0); return result;
  },
  async listCurrent(): Promise<OutboxOperation[]> {
    const owner = currentOwner();
    if (!owner) return [];
    return (await store.load()).filter((item) => sameOwner(item.owner, owner));
  },
  syncNow: () => run(),
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  metrics: async () => {
    const items = await mobileOutbox.listCurrent();
    const pending = items.filter((item) => !["COMPLETED", "REJECTED"].includes(item.status));
    return {
      queuedCount: pending.length,
      completedCount: items.filter((item) => item.status === "COMPLETED").length,
      failedCount: items.filter((item) => item.status === "REJECTED").length,
      reconciliationCount: items.filter((item) => item.status === "NEEDS_RECONCILIATION").length,
      retryCount: items.reduce((sum, item) => sum + Math.max(0, item.attempts - 1), 0),
      oldestQueuedAgeMs: pending.length ? Date.now() - Math.min(...pending.map((item) => item.createdAt)) : 0,
    };
  },
  start() {
    tokenStore.subscribe(() => schedule(0));
    Network.addNetworkStateListener((network) => {
      const wasOffline = knownOffline;
      knownOffline = network.isConnected === false || network.isInternetReachable === false;
      if (wasOffline && !knownOffline) schedule(0);
    });
    schedule(0);
  },
  stop() { if (timer) clearTimeout(timer); timer = null; },
};

/** Dependency seam used only by deterministic fault tests. */
export function configureOutboxForTests(deps: { api?: typeof crewInformationApi; store?: typeof encryptedOutboxStore; networkState?: typeof networkState }): void {
  if (deps.api) api = deps.api;
  if (deps.store) store = deps.store;
  if (deps.networkState) networkState = deps.networkState;
  knownOffline = false;
}
