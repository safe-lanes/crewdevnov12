import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { masterCountries, masterNationalities, masterLanguages, masterVesselTypes, masterManningAgents } from "../../../../shared/schema";
import { admAvailableRanksV2 } from "../../../../shared/v2/admin/schema";
import type { Catalogs } from "./contract";

export async function loadCatalogs(): Promise<Catalogs> {
  const db = getDb();
  const [countries, nationalities, languages, vesselTypes, agents, ranks] = await Promise.all([
    db.select({ label: masterCountries.countryName, value: masterCountries.countryUuid }).from(masterCountries).where(eq(masterCountries.isDeleted, false)),
    db.select({ label: masterNationalities.nationality, value: masterNationalities.natUuid }).from(masterNationalities).where(eq(masterNationalities.isDeleted, false)),
    db.select({ label: masterLanguages.languageName, value: masterLanguages.langUuid }).from(masterLanguages).where(eq(masterLanguages.isDeleted, false)),
    db.select({ label: masterVesselTypes.vesselType, value: masterVesselTypes.vtUuid }).from(masterVesselTypes).where(and(eq(masterVesselTypes.isDeleted, false), eq(masterVesselTypes.isActive, true))),
    db.select({ label: masterManningAgents.name, value: masterManningAgents.name }).from(masterManningAgents).where(and(eq(masterManningAgents.isDeleted, false), eq(masterManningAgents.isActive, true))),
    db.select({ name: admAvailableRanksV2.name, label: admAvailableRanksV2.label }).from(admAvailableRanksV2).where(and(eq(admAvailableRanksV2.isDeleted, false), eq(admAvailableRanksV2.applicableToCompany, true))),
  ]);
  const result: Catalogs = {};
  for (const [key, rows] of Object.entries({ countries, nationalities, languages, vesselTypes, agents })) {
    result[key] = rows.filter((r: { label: string | null; value: string | null }) => r.label && r.value).map((r: { label: string | null; value: string | null }) => ({ label: r.label!, value: r.value! }));
  }
  // Recruitment stores/display-selects the company label, not the org-chart rank name.
  result.ranks = ranks.map((r: { name: string; label: string | null }) => ({ label: r.label || r.name, value: r.label || r.name }));
  return result;
}
