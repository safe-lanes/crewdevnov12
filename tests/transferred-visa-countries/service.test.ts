// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as crewSchema from "../../shared/v2/crew-pool/schema";
import { masterCountries, masterNationalities, masterLanguages, masterVesselTypes, masterVessels } from "../../shared/schema";
import { mapLegacyVisaToV2, mapV2VisaToLegacy } from "../../client/src/modules/crew-pool/mappers/v2ToLegacyMapper";
import { visaCountryForSave } from "../../shared/v2/crew-pool/visaCountry";

const state = vi.hoisted(() => ({
  db: null as any, visas: [] as any[], candidateStatus: "Recruited",
  attachments: vi.fn(), queries: [] as string[],
}));
vi.mock("../../server/v2/db", () => ({ getDb: () => state.db }));
vi.mock("../../server/v2/recruitment/repositories/candidateRepository", () => ({
  candidateRepository: { findByUuid: async () => ({ recCanUuid: "candidate", firstName: "Fixture", status: state.candidateStatus }) },
  vesselTypesAppliedRepository: { findByCandidateUuid: async () => [] },
}));
vi.mock("../../server/v2/recruitment/repositories/approvalsRepository", () => ({
  recruitmentDecisionRepository: { findByCandidateUuid: async () => ({ recruitmentDate: "2026-01-01" }) },
}));
vi.mock("../../server/v2/recruitment/repositories/profileRepository", () => ({
  personalDetailsRepository: { findByCandidateUuid: async () => null },
  addressRepository: { findByCandidateUuid: async () => null },
  familyInfoRepository: { findByCandidateUuid: async () => null },
  childrenRepository: { findByCandidateUuid: async () => [] },
  nextOfKinRepository: { findByCandidateUuid: async () => null },
}));
vi.mock("../../server/v2/recruitment/repositories/documentsRepository", () => ({
  documentsRepository: { findByCandidateUuid: async () => [] },
  documentAttachmentsRepository: {},
  visasRepository: { findByCandidateUuid: async () => state.visas },
  visaAttachmentsRepository: { findByVisaUuid: (...args: any[]) => state.attachments(...args) },
  educationRepository: { findByCandidateUuid: async () => [] },
  educationAttachmentsRepository: {},
  licensesRepository: { findByCandidateUuid: async () => [] },
  licenseAttachmentsRepository: {},
  trainingCoursesRepository: { findByCandidateUuid: async () => [] },
  trainingAttachmentsRepository: {},
  seaServiceRepository: { findByCandidateUuid: async () => [] },
  seaServiceAttachmentsRepository: {},
}));
import { crewTransferService } from "../../server/v2/crew-pool/services/crewTransferService";
import { crewMembersService } from "../../server/v2/crew-pool/services/crewMembersService";
import { crewVisasService } from "../../server/v2/crew-pool/services/crewVisasService";
import { resolveVisaCountryNames } from "../../server/v2/crew-pool/services/visaCountryNames";

const masters = ["UNITED STATES", "UNITED KINGDOM", "AUSTRALIA", "INDIA"].map((name, i) => ({
  countryUuid: `${i + 1}1111111-1111-4111-8111-111111111111`, countryName: name,
}));
const unknown = "99999999-9999-4999-8999-999999999999";
let directory: string, pool: Pool;
const tables = [...Object.values(crewSchema).filter(value => is(value, PgTable)),
  masterCountries, masterNationalities, masterLanguages, masterVesselTypes, masterVessels];
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

beforeAll(async () => {
  // Independent PostgreSQL, with no connection to application or production data.
  directory = mkdtempSync(join(tmpdir(), "visa-transfer-regression-"));
  execFileSync("initdb", ["-D", join(directory, "data"), "-U", "visa_test", "-A", "trust", "--no-locale"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", join(directory, "data"), "-l", join(directory, "postgres.log"),
    "-o", `-k ${directory} -p 55443 -c listen_addresses=''`, "-w", "start"], { stdio: "pipe" });
  pool = new Pool({ host: directory, port: 55443, user: "visa_test", database: "postgres" });
  state.db = drizzle(pool, { logger: { logQuery: query => state.queries.push(query) } });
  for (const table of tables) {
    const config = getTableConfig(table);
    const columns = config.columns.map((column: any) => {
      let definition = `${quote(column.name)} ${column.getSQLType()}`;
      if (column.primary) definition += " PRIMARY KEY";
      else if (column.isUnique) definition += " UNIQUE";
      if (column.notNull) definition += " NOT NULL";
      if (column.default !== undefined && !/serial/i.test(column.getSQLType())) {
        if (typeof column.default === "string") definition += ` DEFAULT '${column.default.replaceAll("'", "''")}'`;
        else if (typeof column.default === "boolean" || typeof column.default === "number") definition += ` DEFAULT ${column.default}`;
        else if (column.dataType === "date") definition += " DEFAULT now()";
      }
      return definition;
    });
    await pool.query(`CREATE TABLE ${quote(config.name)} (${columns.join(",")})`);
  }
}, 60000);
afterAll(async () => {
  if (pool) await pool.end();
  if (directory) {
    try { execFileSync("pg_ctl", ["-D", join(directory, "data"), "-m", "immediate", "-w", "stop"], { stdio: "pipe" }); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  }
});
beforeEach(async () => {
  await pool.query(`TRUNCATE ${tables.map(t => quote(getTableConfig(t).name)).join(",")} RESTART IDENTITY`);
  await state.db.insert(masterCountries).values(masters);
  state.candidateStatus = "Recruited";
  state.attachments.mockReset().mockImplementation(async (uuid: string) => [{
    fileName: `${uuid}.pdf`, filePath: `/fixture/${uuid}.pdf`, sortOrder: 0,
  }]);
  state.visas = [...masters.map(m => m.countryUuid), "China"].map((countryUuid, i) => ({
    visaUuid: `source-${i}`, countryUuid, serialNo: `serial-${i}`, visaType: "work",
    issued: "2025-01-01", expiry: "2029-01-01", sortOrder: i,
  }));
  state.queries = [];
});
const transfer = () => crewTransferService.transferFromRecruitment("candidate", { empNo: "FIXTURE-001" });
async function historicalCrew(country = masters[0].countryUuid, reference: string | null = country) {
  await state.db.insert(crewSchema.crewMembersV2).values({ crewUuid: "historical", empNo: "HIST-001", firstName: "Fixture" });
  await state.db.insert(crewSchema.crewVisas).values({
    visaUuid: "historical-visa", crewUuid: "historical", country, countryUuid: reference, visaType: "work",
  });
}
async function storedVisas() { return state.db.select().from(crewSchema.crewVisas).orderBy(crewSchema.crewVisas.sortOrder); }

describe("Real transfer and read paths on isolated PostgreSQL", () => {
  it("transfers five readable countries with references, fields, ordering and attachments preserved", async () => {
    const result = await transfer();
    expect(result.counts.visas).toBe(5);
    const stored = await storedVisas();
    expect(stored.map((v: any) => v.country)).toEqual([...masters.map(m => m.countryName), "China"]);
    expect(stored.map((v: any) => v.countryUuid)).toEqual(state.visas.map(v => v.countryUuid));
    expect(stored.map((v: any) => v.serialNo)).toEqual(state.visas.map(v => v.serialNo));
    expect(stored.every((v: any) => v.issued === "2025-01-01" && v.expiry === "2029-01-01" && v.visaType === "work")).toBe(true);
    const attachments = await state.db.select().from(crewSchema.crewVisasAttachments);
    expect(attachments).toHaveLength(5);
    expect(attachments.every((att: any) => stored.some((v: any) => v.visaUuid === att.visaUuid))).toBe(true);
    expect(state.queries.filter(q => q.includes('from "master_countries"'))).toHaveLength(1);
    expect(state.queries.some(q => /^(update|delete)/i.test(q))).toBe(false);
  });
  it("resolves historical UUIDs identically on full-profile and standalone list reads without writes", async () => {
    await historicalCrew();
    state.queries = [];
    const profile = await crewMembersService.getFullProfile("historical");
    const list = await crewVisasService.getAll("historical");
    expect(profile?.visas).toHaveLength(1);
    expect(profile?.visas[0].countryName).toBe("UNITED STATES");
    expect(list[0]).toMatchObject({ country: masters[0].countryUuid, countryUuid: masters[0].countryUuid, countryName: "UNITED STATES" });
    expect(mapV2VisaToLegacy(profile?.visas[0]).issuingCountry).toBe(mapV2VisaToLegacy(list[0]).issuingCountry);
    expect(state.queries.every(q => /^select/i.test(q))).toBe(true);
    expect((await storedVisas())[0].country).toBe(masters[0].countryUuid);
  });
  it("keeps C2 identity, dates, type, ordering and attachment IDs across an edit/save/reload", async () => {
    const result = await transfer();
    const list = await crewVisasService.getAll(result.crewUuid);
    const local = mapV2VisaToLegacy(list[0]);
    const payload = mapLegacyVisaToV2({ ...local, serialNo: "edited-serial" });
    await crewVisasService.update(local.visaUuid, payload);
    const reloaded = (await crewVisasService.getAll(result.crewUuid))[0];
    expect(reloaded).toMatchObject({ visaUuid: local.visaUuid, countryUuid: masters[0].countryUuid,
      country: "UNITED STATES", serialNo: "edited-serial", issued: "2025-01-01", expiry: "2029-01-01", sortOrder: 0, visaType: "work" });
    expect(reloaded.attachments.map(a => a.attUuid)).toEqual(list[0].attachments.map(a => a.attUuid));
  });
  it("shows unavailable for missing masters while a normal C2 save preserves the original reference", async () => {
    await historicalCrew(unknown);
    const raw = (await crewVisasService.getAll("historical"))[0];
    const local = mapV2VisaToLegacy(raw);
    expect(raw.countryName).toBeNull();
    expect(local.issuingCountry).toBe("");
    expect(local.countryUnavailable).toBe(true);
    // Mirrors the form's save payload construction; never serializes a UI message.
    await crewVisasService.update(local.visaUuid, mapLegacyVisaToV2({
      ...local, country: visaCountryForSave(local), serialNo: "edited",
    }));
    expect((await storedVisas())[0]).toMatchObject({ countryUuid: unknown, country: unknown, serialNo: "edited" });
  });
  it("preserves genuine manual country text and editability", async () => {
    await historicalCrew("  Custom country  ", null);
    const local = mapV2VisaToLegacy((await crewVisasService.getAll("historical"))[0]);
    expect(local.countryId).toBe("");
    expect(local.issuingCountry).toBe("  Custom country  ");
    await crewVisasService.update(local.visaUuid, mapLegacyVisaToV2({ ...local, issuingCountry: "Schengen" }));
    expect((await storedVisas())[0].country).toBe("Schengen");
  });
  it("rejects unresolved references before starting a transfer or inserting any crew", async () => {
    state.visas[0].countryUuid = unknown;
    await expect(transfer()).rejects.toThrow("country cannot be resolved");
    expect(await state.db.select().from(crewSchema.crewMembersV2)).toEqual([]);
    expect(state.queries.some(q => /^(begin|insert|update)/i.test(q))).toBe(false);
  });
  it("rolls back all transfer writes when an attachment insert fails", async () => {
    state.attachments.mockResolvedValue([{ fileName: "fixture.pdf", sortOrder: "not-an-integer" }]);
    await expect(transfer()).rejects.toThrow();
    expect(await state.db.select().from(crewSchema.crewMembersV2)).toEqual([]);
    expect(await storedVisas()).toEqual([]);
  });
  it("retains the existing duplicate-transfer and eligibility checks", async () => {
    const result = await transfer();
    await expect(transfer()).rejects.toThrow("already been transferred");
    expect((await state.db.select().from(crewSchema.crewMembersV2))).toHaveLength(1);
    expect(result.empNo).toBe("FIXTURE-001");
    state.candidateStatus = "Applied";
    await expect(transfer()).rejects.toThrow("Candidate status must be");
  });
  it("does no lookup for readable text or empty batches, and only one lookup for repeated UUIDs", async () => {
    await resolveVisaCountryNames([]);
    await resolveVisaCountryNames([{ country: "China" }, { country: "Custom", countryUuid: unknown }]);
    expect(state.queries).toHaveLength(0);
    const named = await resolveVisaCountryNames(Array.from({ length: 10 }, () => ({ country: masters[0].countryUuid })));
    expect(named.every(row => row.countryName === "UNITED STATES")).toBe(true);
    expect(state.queries).toHaveLength(1);
  });
  it("does not invent names from deleted masters", async () => {
    await state.db.update(masterCountries).set({ isDeleted: true }).where(eq(masterCountries.countryUuid, masters[0].countryUuid));
    const named = await resolveVisaCountryNames([{ country: masters[0].countryUuid }]);
    expect(named[0].countryUnavailable).toBe(true);
    state.visas = [state.visas[0]];
    await expect(transfer()).rejects.toThrow("country cannot be resolved");
  });
});
