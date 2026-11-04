/**
 * PILOT TRIAL (Astra round 3, 28-Oct-2026) — whole-conversation separation, proven on the COMPLETE outbound model
 * requests (ASSISTANT_CAPTURE_OUTBOUND). Synthetic names appear in BOTH the user questions and the assistant answers of
 * the history that each scenario presents; inspect_roles.py then reports, per outbound request, which roles were sent
 * and every synthetic name found in them.
 *
 * Scenarios:
 *  T1 legitimate follow-up (state hit): history must be sent, masked (no synthetic names on the wire).
 *  T2 container restart inside the same legitimate conversation: history (both roles) must NOT be sent; the answer
 *     carries the 'could not be verified' notice; the model asks for a restatement or answers only the current message.
 *  T3 another user presents the conversation id + history: history must NOT be sent; 'different session or user' notice.
 *  T4 the original user continues T3's conversation afterwards: still theirs (state hit) — not taken over.
 *  T5 another company (multi-tenant instance), same id + history: not sent; notice.
 *  T6 another issuer, same tenant/user/id + history: not sent; notice.
 *  T7 new conversation id carrying old history (= logout / new session): not sent; notice.
 *  T8 no history, foreign id (a second identity reusing an id without history): answered standalone, nothing remembered
 *     under that id for the second identity (T4-style re-check by the owner still hits).
 * Usage: npx tsx scripts/assistant-trial/masking-checks-r3.ts   (writes results/masking-checks-r3.json)
 */
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { writeFileSync } from "fs";
import { mint, targets, type Who } from "./trialClient";

const ASSISTANT = process.env.TRIAL_ASSISTANT || "http://127.0.0.1:18062";
// SSH command to the pilot host (reads the capture line count); kept out of the repository — set TRIAL_SSH, e.g. 'ssh -i <key> user@host'.
const SSH = process.env.TRIAL_SSH || (() => { throw new Error('TRIAL_SSH not set (ssh command to the pilot host)'); })();
const lines = () => parseInt(execSync(`${SSH} "wc -l < ~/central-assistant-py/crewtrial-captures/capture.jsonl"`, { encoding: "utf8" }).trim(), 10);
const t = targets();
type H = { role: string; content: string }[];

async function ask(scenario: string, target: "single" | "mt", who: Who, q: string, history: H, conversationId: string) {
  const start = lines() + 1;
  let body: Record<string, unknown> = {};
  for (let attempt = 0; attempt < 3; attempt++) {   // transport retry only (tunnel socket drops); a reached request is never repeated
    try {
      const r = await fetch(`${ASSISTANT}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-assistant-identity": mint(t[target], who) },
        body: JSON.stringify({ message: q, context: { module: "crewing" }, conversationHistory: history, conversationId }),
      });
      body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      break;
    } catch (e) {
      if (lines() >= start) throw e;            // the request reached the assistant (a model call was captured) — do not repeat
      console.log(`  transport error on ${scenario}, retrying: ${String(e).slice(0, 80)}`);
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
  const end = lines();
  const row = { scenario, q, conversationId, start, end, historyTurns: history.length, historyDiscarded: body.historyDiscarded ?? null,
    answer: String(body.response ?? ""), toolsUsed: body.toolsUsed ?? null };
  console.log(`${scenario} lines ${start}-${end} discarded=${row.historyDiscarded}  ${q}`);
  return row;
}
const hist = (...rows: { q: string; answer: string }[]): H => rows.flatMap((r) => [{ role: "user", content: r.q }, { role: "assistant", content: r.answer }]);
const Q1 = "Which certificates does Petra Wintermarsh hold, and on which vessel is she?";   // user-typed synthetic name
const Q2 = "When do they expire?";                                                          // depends on the earlier context

(async () => {
  const out: Record<string, unknown>[] = [];
  const A = { tenantDomain: "trial-a.local", tuid: "crew_trial_a" };
  const B = { tenantDomain: "trial-b.local", tuid: "crew_trial_b" };

  // T1 legitimate follow-up
  const c1 = randomUUID();
  const t1a = await ask("T1-turn1", "single", {}, Q1, [], c1);
  out.push(t1a, await ask("T1-turn2-followup-hit", "single", {}, Q2, hist(t1a), c1));

  // T2 restart inside the same legitimate conversation
  const c2 = randomUUID();
  const t2a = await ask("T2-turn1", "single", {}, Q1, [], c2);
  out.push(t2a);
  execSync(`${SSH} "docker restart sail-assistant-py-crewtrial"`);
  for (let k = 0; k < 60; k++) {
    try { if ((await fetch(`${ASSISTANT}/health`)).ok) break; } catch { /* restarting */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  out.push(await ask("T2-turn2-after-restart", "single", {}, Q2, hist(t2a), c2));

  // T3 another user presents the id + history; T4 the owner continues afterwards
  const c3 = randomUUID();
  const t3a = await ask("T3-turn1-owner", "single", {}, Q1, [], c3);
  out.push(t3a, await ask("T3-turn2-other-user", "single", { userId: "2" }, Q2, hist(t3a), c3));
  out.push(await ask("T4-owner-continues", "single", {}, Q2, hist(t3a), c3));

  // T5 another company (multi-tenant), same id + history
  const c5 = randomUUID();
  const t5a = await ask("T5-turn1-companyA", "mt", A, Q1, [], c5);
  out.push(t5a, await ask("T5-turn2-companyB", "mt", B, Q2, hist(t5a), c5));

  // T6 another issuer: same 'single-tenant' tenant, user and id, multi-tenant issuer
  const c6 = randomUUID();
  const t6a = await ask("T6-turn1-issuer-pilot", "single", {}, Q1, [], c6);
  out.push(t6a, await ask("T6-turn2-issuer-pilotmt", "mt", { tenantDomain: null }, Q2, hist(t6a), c6));

  // T7 new conversation id carrying T1's history (logout / new session)
  out.push(await ask("T7-new-conversation-old-history", "single", {}, Q2, hist(t1a), randomUUID()));

  // T8 foreign id without history, then the owner re-checks
  const c8 = randomUUID();
  const t8a = await ask("T8-turn1-owner", "single", {}, Q1, [], c8);
  out.push(t8a, await ask("T8-turn2-other-user-no-history", "single", { userId: "2" }, "List the crew on board MV Alpha Star", [], c8));
  out.push(await ask("T8-turn3-owner-still-hit", "single", {}, Q2, hist(t8a), c8));

  writeFileSync(new URL("./results/masking-checks-r3.json", import.meta.url), JSON.stringify(out, null, 1));
})();
