/**
 * PILOT TRIAL — runs test-set.json through the pilot assistant exactly as the widget calls it (POST /chat with the
 * forwarded identity, context.module=crewing, conversationHistory, conversationId) and scores each turn on three
 * independent axes: query (logged tool call), data (its result), answer (regexes). Scoring rules are fixed in
 * test-set.json and are never edited to make an answer pass.
 *
 * Usage: npx tsx scripts/assistant-trial/run-chat-trial.ts <label> [--only=C01,C02]
 * Env:   TRIAL_ASSISTANT (default http://127.0.0.1:18062), TRIAL_ARG_LOG_SINGLE / TRIAL_ARG_LOG_MT (Crewing arg logs),
 *        TRIAL_CAPTURE_CMD (optional shell command printing the capture file's line count — model calls per turn)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { mint, targets } from "./trialClient";

type Call = { tool: string; args?: Record<string, unknown>; result?: Record<string, unknown> };
type Turn = { q: string; calls?: Call[]; noDataTool?: boolean; answerAll?: string[]; answerNone?: string[] };
type Case = { id: string; cat: string; heldOut?: boolean; instance?: "single" | "mt"; who?: Record<string, unknown>; turns: Turn[] };

const ASSISTANT = process.env.TRIAL_ASSISTANT || "http://127.0.0.1:18062";
const LOGS = { single: process.env.TRIAL_ARG_LOG_SINGLE || "", mt: process.env.TRIAL_ARG_LOG_MT || "" };

function get(o: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), o);
}
function matches(actual: unknown, expected: unknown): boolean {
  if (typeof expected === "string") {
    const e = expected.toLowerCase();
    if (Array.isArray(actual)) return actual.some((a) => String(typeof a === "object" ? JSON.stringify(a) : a).toLowerCase().includes(e));
    return typeof actual === "string" && actual.toLowerCase().includes(e);
  }
  return actual === expected;
}
function callMatches(entry: Record<string, unknown>, c: Call, part: "args" | "result"): boolean {
  if (entry.tool !== c.tool) return false;
  const spec = part === "args" ? c.args ?? {} : c.result ?? {};
  const src = part === "args" ? entry.args : entry;
  return Object.entries(spec).every(([k, v]) => matches(get(src, k), v));
}
function lines(file: string): string[] {
  return file && existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean) : [];
}
function captureCount(): number | null {
  const cmd = process.env.TRIAL_CAPTURE_CMD;
  if (!cmd) return null;
  try {
    return parseInt(execSync(cmd, { encoding: "utf8", timeout: 20000 }).trim(), 10);
  } catch {
    return null;
  }
}

(async () => {
  const label = process.argv[2] || "run";
  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1]?.split(",");
  const setFile = process.env.TRIAL_TEST_SET || "test-set.json";
  const set = JSON.parse(readFileSync(new URL(`./${setFile}`, import.meta.url), "utf8")) as { cases: Case[] };
  const t = targets();
  const out: Record<string, unknown>[] = [];
  for (const c of set.cases) {
    if (only && !only.includes(c.id)) continue;
    const inst = c.instance ?? "single";
    const target = t[inst];
    const conversationId = randomUUID();
    const history: { role: string; content: string }[] = [];
    for (const [i, turn] of c.turns.entries()) {
      const before = lines(LOGS[inst]).length;
      const capBefore = captureCount();
      const token = mint(target, { ...(c.who ?? {}) } as never);
      const started = Date.now();
      let resp: Record<string, unknown> = {};
      let status = 0;
      try {
        const r = await fetch(`${ASSISTANT}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-assistant-identity": token },
          body: JSON.stringify({ message: turn.q, context: { module: "crewing" }, conversationHistory: history, conversationId }),
        });
        status = r.status;
        resp = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      } catch (e) {
        resp = { error: String(e) };
      }
      const latencyMs = Date.now() - started;
      await new Promise((r) => setTimeout(r, 300));
      const logged = lines(LOGS[inst]).slice(before).map((l) => JSON.parse(l) as Record<string, unknown>);
      const capAfter = captureCount();
      const answer = String(resp.response ?? resp.error ?? "");
      const crewingCalls = logged.filter((e) => String(e.tool).startsWith("crewing_"));
      let queryOk: boolean | null = null;
      let dataOk: boolean | null = null;
      if (turn.calls?.length) {
        const qHits = turn.calls.filter((cs) => crewingCalls.some((e) => callMatches(e, cs, "args")));
        queryOk = qHits.length > 0;
        dataOk = turn.calls.some((cs) => crewingCalls.some((e) => callMatches(e, cs, "args") && callMatches(e, cs, "result")));
      } else if (turn.noDataTool) {
        queryOk = crewingCalls.length === 0;
        dataOk = null;
      }
      const missing = (turn.answerAll ?? []).filter((re) => !new RegExp(re, "i").test(answer));
      const forbidden = (turn.answerNone ?? []).filter((re) => new RegExp(re, "i").test(answer));
      const answerOk = missing.length === 0 && forbidden.length === 0;
      const pass = answerOk && queryOk !== false && dataOk !== false && status === 200;
      out.push({
        id: c.id, turn: i + 1, cat: c.cat, heldOut: !!c.heldOut, instance: inst, q: turn.q, status, pass, queryOk, dataOk, answerOk,
        missing, forbidden, latencyMs, modelCalls: capBefore !== null && capAfter !== null ? capAfter - capBefore : null,
        usage: resp.usage ?? null, toolsUsed: resp.toolsUsed ?? [], partial: resp.partial ?? null, gate: resp.gate ?? null,
        calls: crewingCalls.map((e) => ({ tool: e.tool, args: e.args, ok: e.ok, code: e.code, total: e.total, totals: e.totals, returned: e.returned, nextOffset: e.nextOffset, excluded: e.excluded, ms: e.ms })),
        answer,
      });
      console.log(`${pass ? "PASS" : "FAIL"} ${c.id}.${i + 1}${c.heldOut ? " [H]" : ""} q=${queryOk} d=${dataOk} a=${answerOk} ${latencyMs}ms` +
        (missing.length ? ` missing=${JSON.stringify(missing)}` : "") + (forbidden.length ? ` forbidden=${JSON.stringify(forbidden)}` : ""));
      history.push({ role: "user", content: turn.q }, { role: "assistant", content: answer });
    }
  }
  const dir = new URL("./results/", import.meta.url);
  if (!existsSync(dir)) mkdirSync(dir);
  writeFileSync(new URL(`./results/${label}.json`, import.meta.url), JSON.stringify(out, null, 1));
  const n = out.length;
  const p = out.filter((r) => r.pass).length;
  const h = out.filter((r) => r.heldOut);
  console.log(`\n${label}: ${p}/${n} turns pass · held-out ${h.filter((r) => r.pass).length}/${h.length}`);
})();
