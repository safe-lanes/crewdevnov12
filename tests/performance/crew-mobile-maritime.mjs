import { randomUUID } from "node:crypto";

const baseUrl = process.env.PERF_BASE_URL;
const token = process.env.PERF_ACCESS_TOKEN;
const scenario = process.env.PERF_SCENARIO || "unspecified";
const iterations = Math.max(1, Math.min(Number(process.env.PERF_ITERATIONS || 5), 100));
const concurrency = Math.max(1, Math.min(Number(process.env.PERF_CONCURRENCY || 1), 20));
const timeoutMs = Math.max(1000, Math.min(Number(process.env.PERF_TIMEOUT_MS || 45000), 120000));

if (!baseUrl || !token) {
  console.error("PERF_BASE_URL and PERF_ACCESS_TOKEN are required. Token values are never printed.");
  process.exit(2);
}
if (!/^https?:\/\//.test(baseUrl)) throw new Error("PERF_BASE_URL must be an HTTP(S) URL");
if (!/localhost|127\.0\.0\.1|\.test(?::|\/|$)|staging/i.test(baseUrl) && process.env.PERF_NON_PRODUCTION_ACK !== "I_ACKNOWLEDGE_NON_PRODUCTION") {
  throw new Error("Refusing an unrecognized target. Set PERF_NON_PRODUCTION_ACK=I_ACKNOWLEDGE_NON_PRODUCTION only for an authorized non-production environment.");
}

const samples = [];
const endpoints = [
  ["profile", "/api/crew-app/crew-information"],
  ["masters", "/api/crew-app/crew-information/masters"],
  ["documents", "/api/crew-app/crew-information/documents"],
  ["notifications", "/api/crew-app/notifications?limit=20&offset=0"],
  ["notices", "/api/crew-app/notices?limit=20&offset=0"],
];

async function measuredRequest(name, path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(new URL(path, baseUrl), {
      ...options,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    const body = await response.arrayBuffer();
    samples.push({ name, status: response.status, ok: response.ok, durationMs: performance.now() - started, bytes: body.byteLength, timedOut: false });
    return { response, body };
  } catch (error) {
    samples.push({ name, status: 0, ok: false, durationMs: performance.now() - started, bytes: 0, timedOut: error?.name === "AbortError" });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function runReadIteration() {
  for (const [name, path] of endpoints) await measuredRequest(name, path);
  if (process.env.PERF_OPERATION_UUID) {
    await measuredRequest("operation-status", `/api/crew-app/crew-information/operations/${encodeURIComponent(process.env.PERF_OPERATION_UUID)}`);
  }
}

async function runMutationProbe() {
  if (process.env.PERF_ENABLE_MUTATIONS !== "true") return;
  const section = process.env.PERF_MUTATION_SECTION;
  const rawPayload = process.env.PERF_MUTATION_PAYLOAD;
  if (!section || !rawPayload) throw new Error("Mutation probe requires PERF_MUTATION_SECTION and PERF_MUTATION_PAYLOAD");
  JSON.parse(rawPayload);
  const operationId = randomUUID();
  const options = { method: "PUT", headers: { "Content-Type": "application/json", "Idempotency-Key": operationId }, body: rawPayload };
  await measuredRequest("mutation-first", `/api/crew-app/crew-information/${encodeURIComponent(section)}`, options);
  await measuredRequest("operation-reconcile", `/api/crew-app/crew-information/operations/${operationId}`);
  await measuredRequest("mutation-duplicate", `/api/crew-app/crew-information/${encodeURIComponent(section)}`, options);
}

const workers = Array.from({ length: concurrency }, async (_, worker) => {
  for (let i = worker; i < iterations; i += concurrency) await runReadIteration();
});
await Promise.all(workers);
await runMutationProbe();

function percentile(values, value) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)] * 100) / 100;
}

const durations = samples.map(row => row.durationMs);
const report = {
  scenario,
  generatedAt: new Date().toISOString(),
  targetOrigin: new URL(baseUrl).origin,
  iterations,
  concurrency,
  requestCount: samples.length,
  failureCount: samples.filter(row => !row.ok).length,
  timeoutCount: samples.filter(row => row.timedOut).length,
  failureRate: samples.length ? samples.filter(row => !row.ok).length / samples.length : 0,
  responseBytes: samples.reduce((total, row) => total + row.bytes, 0),
  latencyMs: { p50: percentile(durations, 0.5), p95: percentile(durations, 0.95), p99: percentile(durations, 0.99), max: percentile(durations, 1) },
  results: samples,
};
console.log(JSON.stringify(report, null, 2));
if (report.failureCount) process.exitCode = 1;
