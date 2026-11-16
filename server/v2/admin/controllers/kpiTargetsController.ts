import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import { accessControlHandler } from "./accessControlController";
import { kpiTargetAuthority, kpiYear, readKpiCatalogue, readKpiTargets, saveKpiTargets } from "../services/kpiTargets";

export const kpiTargetsController = {
  catalogue: accessControlHandler(async req => ({
    kpis: await readKpiCatalogue(), canSetTargets: await kpiTargetAuthority(req),
  })),
  read: accessControlHandler(req => readKpiTargets(req, req.params.code, kpiYear(req.params.year))),
  save: accessControlHandler(saveKpiTargets),
  grant: accessControlHandler(async req => ({
    allowed: (await getDb().execute(sql`SELECT allowed FROM adm_resource_action_grants
      WHERE role_id=${req.params.ruid} AND resource='kpi_targets' AND action='set'`)).rows[0]?.allowed === true,
  })),
};
