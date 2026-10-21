import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { accessControlHandler } from "./accessControlController";
import { managedWrite, appendAudit, saveActionDecisions } from "../services/accessControlManagement";
import { trainingOverrideAllowed } from "../../shared/training-compliance/authority";

export const trainingComplianceSettingsController = {
  mine: accessControlHandler(async req => ({ allowed: await trainingOverrideAllowed(req) })),
  get: accessControlHandler(async () => {
    const row = (await getDb().execute(sql`SELECT block_expiring_during_contract AS "blockExpiringDuringContract"
      FROM adm_training_compliance_settings WHERE singleton`)).rows[0];
    if (!row) throw new Error("Training compliance settings upgrade required.");
    return row;
  }),
  save: accessControlHandler(async req => {
    const parsed = z.object({ blockExpiringDuringContract: z.boolean() }).strict().safeParse(req.body);
    if (!parsed.success) throw Object.assign(new Error("Supply only the training expiry setting. Identity is recorded by the server."), { status: 400 });
    return managedWrite(req, async (tx, actor) => {
      const before = (await tx.execute(sql`SELECT block_expiring_during_contract FROM adm_training_compliance_settings
        WHERE singleton FOR UPDATE`)).rows[0];
      if (!before) throw new Error("Training compliance settings upgrade required.");
      await tx.execute(sql`UPDATE adm_training_compliance_settings
        SET block_expiring_during_contract=${parsed.data.blockExpiringDuringContract} WHERE singleton`);
      await appendAudit(tx, actor, "training_setting_changed", null, "training_compliance", "block_expiring_during_contract",
        before.block_expiring_during_contract, parsed.data.blockExpiringDuringContract);
      return parsed.data;
    });
  }),
  grant: accessControlHandler(async req => {
    const row = (await getDb().execute(sql`SELECT g.allowed FROM adm_resource_action_grants g
      JOIN adm_rolemaster_ac r ON r.ruid=g.role_id
      WHERE g.role_id=${req.params.ruid} AND g.resource='training_compliance' AND g.action='override'
        AND r.is_active AND NOT r.is_deleted`)).rows[0];
    return { allowed: row?.allowed === true };
  }),
  saveGrant: accessControlHandler(async req => {
    const parsed = z.object({ allowed: z.boolean() }).strict().safeParse(req.body);
    if (!parsed.success) throw Object.assign(new Error("Supply only the Override training compliance flag."), { status: 400 });
    const saved = await saveActionDecisions(req, req.params.ruid, "training_compliance", { override: parsed.data.allowed });
    return { allowed: saved.override };
  }),
};
