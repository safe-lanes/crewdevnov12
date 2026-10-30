/**
 * PILOT TRIAL (Astra round 2) — masking memory end to end through the trial assistant, with the COMPLETE outbound
 * model requests captured (ASSISTANT_CAPTURE_OUTBOUND). Each turn records its capture line range; inspect_capture.py
 * --json classifies every synthetic name found per range.
 *
 * Scenarios: S1 follow-up (memory hit) · S2 container restart between turns · S3 new conversation id carrying the
 * old history (also = logout: sign-out reloads the page → new conversation) · S4 another user, same conversation id ·
 * S5 another company · S6 another issuer · S7 first name typed alone, before and after a tool returned the full name.
 * Usage: npx tsx scripts/assistant-trial/masking-checks.ts   (writes results/masking-checks.json)
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
  const r = await fetch(`${ASSISTANT}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-assistant-identity": mint(t[target], who) },
    body: JSON.stringify({ message: q, context: { module: "crewing" }, conversationHistory: history, conversationId }),
  });
  const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  const end = lines();
  const row = { scenario, q, conversationId, start, end, answer: String(body.response ?? ""), citations: body.citations ?? null };
  console.log(`${scenario} lines ${start}-${end}  ${q}`);
  return row;
}

(async () => {
  const out: Record<string, unknown>[] = [];
  const A = { tenantDomain: "trial-a.local", tuid: "crew_trial_a" };
  const B = { tenantDomain: "trial-b.local", tuid: "crew_trial_b" };

  // S1 normal follow-up
  const c1 = randomUUID();
  const s1a = await ask("S1-turn1", "single", {}, "List the crew on board MV Alpha Star", [], c1);
  const h1: H = [{ role: "user", content: s1a.q }, { role: "assistant", content: s1a.answer }];
  out.push(s1a, await ask("S1-turn2-followup", "single", {}, "which of them are officers?", h1, c1));

  // S2 restart between turns
  const c2 = randomUUID();
  const s2a = await ask("S2-turn1", "single", {}, "List the crew on board MV Beta Ocean", [], c2);
  out.push(s2a);
  execSync(`${SSH} "docker restart sail-assistant-py-crewtrial"`);
  for (let k = 0; k < 40; k++) {
    try { if ((await fetch(`${ASSISTANT}/health`)).ok) break; } catch { /* restarting */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const h2: H = [{ role: "user", content: s2a.q }, { role: "assistant", content: s2a.answer }];
  out.push(await ask("S2-turn2-after-restart", "single", {}, "which of them are engineers?", h2, c2));

  // S3 new conversation id carrying S1's history (forged / reused history; logout = new conversation)
  out.push(await ask("S3-new-conversation", "single", {}, "which of them are officers?", h1, randomUUID()));
  // S4 another user, same conversation id as S1 (re-establish S1 memory first)
  const c4 = randomUUID();
  const s4a = await ask("S4-turn1-user1", "single", {}, "List the crew on board MV Alpha Star", [], c4);
  const h4: H = [{ role: "user", content: s4a.q }, { role: "assistant", content: s4a.answer }];
  out.push(s4a, await ask("S4-turn2-other-user", "single", { userId: "2" }, "which of them are officers?", h4, c4));
  // S5 another company (multi-tenant instance), same conversation id
  const c5 = randomUUID();
  const s5a = await ask("S5-turn1-companyA", "mt", A, "List the crew on board MV Alpha Star", [], c5);
  const h5: H = [{ role: "user", content: s5a.q }, { role: "assistant", content: s5a.answer }];
  out.push(s5a, await ask("S5-turn2-companyB", "mt", B, "which of them are officers?", h5, c5));
  // S6 another issuer: same tenant ('single-tenant'), user and conversation, but the multi-tenant issuer
  const c6 = randomUUID();
  const s6a = await ask("S6-turn1-issuer-pilot", "single", {}, "List the crew on board MV Alpha Star", [], c6);
  const h6: H = [{ role: "user", content: s6a.q }, { role: "assistant", content: s6a.answer }];
  out.push(s6a, await ask("S6-turn2-issuer-pilotmt", "mt", { tenantDomain: null }, "which of them are officers?", h6, c6));
  // S7 typed first names
  const c7 = randomUUID();
  const s7a = await ask("S7-turn1-typed-first-name", "single", {}, "Is Petra on board?", [], c7);
  const h7: H = [{ role: "user", content: s7a.q }, { role: "assistant", content: s7a.answer }];
  out.push(s7a, await ask("S7-turn2-typed-again-after-lookup", "single", {}, "Which certificates does Petra have expiring in the next 60 days?", h7, c7));
  // S8 manual answer: citations on the tool-loop path
  out.push(await ask("S8-howto-citations", "single", {}, "How do I approve or reject a rotation plan?", [], randomUUID()));

  writeFileSync(new URL("./results/masking-checks.json", import.meta.url), JSON.stringify(out, null, 1));
})();
