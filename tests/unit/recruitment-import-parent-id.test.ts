// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import ExcelJS from "exceljs";
import { PgDialect } from "drizzle-orm/pg-core";
import { masterUsers } from "../../shared/schema";
import { loadCatalogs } from "../../server/v2/recruitment/import/catalogs";
import { persistCandidate } from "../../server/v2/recruitment/import/persistence";
import { accessControlService } from "../../server/v2/admin/services/accessControlService";
import { candidateImportRouter } from "../../server/v2/recruitment/import/routes";
import { authorizeImport } from "../../server/v2/recruitment/import/access";
import { generateTemplate } from "../../server/v2/recruitment/import/workbook";
import { MastersRepository } from "../../server/v2/masters/repositories/mastersRepository";
import { tenantConnectionManager } from "../../server/utils/tenantConnectionManager";

const fixtures = vi.hoisted(() => ({ databases: new Map<string, any>() }));
vi.mock("../../server/utils/tenantConnectionManager", async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const context = new AsyncLocalStorage<any>();
  class TenantNotFoundError extends Error {}
  return {
    TenantNotFoundError,
    TenantInactiveError: class extends Error {},
    TenantDatabaseError: class extends Error {},
    getCurrentTenantDb: () => context.getStore(),
    tenantConnectionManager: {
      isMultiTenantEnabled: true,
      validateTuid: vi.fn(async (id: string) => {
        if (!fixtures.databases.has(id)) throw new TenantNotFoundError();
        return { domain: id === "tenant-one" ? "company-one" : "company-two" };
      }),
      resolveTenant: vi.fn(async (domain: string) => ({
        tuid: domain === "company-one" ? "tenant-one" : "tenant-two",
      })),
      runInTenantContext: async (id: string, callback: () => unknown) =>
        context.run(fixtures.databases.get(id), callback),
    },
  };
});
// Use the real getDb() tenant selector. Any default/global DB access fails this suite.
vi.mock("../../server/storage", () => ({
  storage: { getDb: () => { throw new Error("Unexpected global database access"); } },
}));
vi.mock("../../server/v2/admin/services/accessControlService", () => ({
  accessControlService: { getMyPermissions: vi.fn() },
}));
vi.mock("../../server/v2/recruitment/import/catalogs", () => ({ loadCatalogs: vi.fn() }));
vi.mock("../../server/v2/recruitment/import/persistence", () => ({
  persistCandidate: vi.fn(),
  DuplicateImportError: class extends Error {},
}));

const signingKey = "synthetic-parent-id-test-key-not-a-real-credential";
const catalogs = { ranks: [], countries: [], nationalities: [], languages: [], vesselTypes: [], agents: [] };
const dialect = new PgDialect();
const user = { id: 9999, userUuid: "actor-one", role: "Recruiter", userType: "Office" };
let app: express.Express, valid: Buffer;
let tenantOne: ReturnType<typeof database>, tenantTwo: ReturnType<typeof database>;
function database(users: Record<string, unknown>[]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = {
    users, queries,
    execute: vi.fn(async (_query: any) => []),
    insert: vi.fn((_table: unknown) => ({ values: vi.fn(async (_rows: unknown) => {}) })),
    select: vi.fn(() => {
      const chain: any = {
        from: (table: unknown) => { expect(table).toBe(masterUsers); return chain; },
        where: (condition: any) => { queries.push(dialect.sqlToQuery(condition)); return chain; },
        limit: async () => users.filter(row => row.id === queries.at(-1)!.params[0]),
      };
      return chain;
    }),
  };
  return db;
}
function token(claims: Record<string, unknown> = {}, key = signingKey) {
  return jwt.sign({ id: 9999, domain: "company-one", userType: "Office", ...claims }, key);
}
function call(action: string, bearer = token(), tenant?: string, extra: Record<string, unknown> = {}) {
  const route = `/api/v2/recruitment/import/${action}`;
  const req = action === "template" ? request(app).get(route) : request(app).post(route);
  if (action === "template") req.buffer(true).parse((response: any, done: (error: Error | null, data?: any) => void) => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk: Buffer) => chunks.push(chunk));
    response.on("end", () => {
      const bytes = Buffer.concat(chunks);
      try {
        done(null, response.headers["content-type"]?.includes("application/json") ? JSON.parse(bytes.toString()) : bytes);
      } catch (error) { done(error as Error); }
    });
    response.on("error", done);
  });
  if (bearer) req.set("Authorization", `Bearer ${bearer}`);
  if (tenant) req.set("x-tenant-id", tenant);
  return action === "template" ? req : req.send({ fileName: "synthetic.xlsx", fileData: valid.toString("base64"), ...extra });
}
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", signingKey);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AUTH_BYPASS", "true"); // Must not bypass auth in production.
  const { tenantMiddleware } = await import("../../server/middleware/tenantMiddleware");
  const { authMiddleware } = await import("../../server/middleware/authMiddleware");
  app = express();
  app.use(express.json({ limit: "2mb" }), tenantMiddleware, authMiddleware);
  app.use("/api/v2/recruitment/import", candidateImportRouter);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await generateTemplate(catalogs) as any);
  book.worksheets[0].getCell("F8").value = "Synthetic";
  valid = Buffer.from(await book.xlsx.writeBuffer());
});
beforeEach(() => {
  tenantOne = database([{ ...user }]);
  tenantTwo = database([{ ...user, userUuid: "actor-two" }]);
  fixtures.databases.set("tenant-one", tenantOne);
  fixtures.databases.set("tenant-two", tenantTwo);
  vi.mocked(loadCatalogs).mockResolvedValue(catalogs);
  vi.mocked(persistCandidate).mockResolvedValue("synthetic-candidate");
  vi.mocked(accessControlService.getMyPermissions).mockImplementation(async (_id, role) => ({
    permissions: [{ menuName: "In Progress", canview: true, cancreate: role === "Recruiter" }],
  }) as any);
});
afterAll(() => vi.unstubAllEnvs());

describe("Existing signed parent IDs reach actual Recruitment import routes", () => {
  it("downloads a real single-sheet workbook without a userUuid JWT claim", async () => {
    const res = await call("template");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["cache-control"]).toBe("no-store");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(res.body);
    expect(book.worksheets.map(sheet => sheet.name)).toEqual(["APPLICATION FORM"]);
    expect(tenantOne.queries[0]).toMatchObject({ params: [9999] });
    expect(tenantOne.queries[0].sql).toContain('"master_users"."id"');
    expect(accessControlService.getMyPermissions).toHaveBeenCalledWith(undefined, "Recruiter");
    expect(persistCandidate).not.toHaveBeenCalled();
  });
  it("validates, then executes with server-derived audit identity", async () => {
    const preview = await call("validate");
    expect(preview.status).toBe(200);
    expect(preview.body.isValid).toBe(true);
    expect(persistCandidate).not.toHaveBeenCalled();
    const imported = await call("execute");
    expect(imported.status).toBe(201);
    expect(imported.body).toEqual({ success: true, recCanUuid: "synthetic-candidate", status: "Applied" });
    expect(persistCandidate).toHaveBeenCalledWith(expect.objectContaining({ isValid: true }), "actor-one");
  });
  it("allows canonical decimal-string IDs without partial numeric parsing", async () => {
    expect((await call("template", token({ id: "9999" }))).status).toBe(200);
    expect(tenantOne.queries[0].params).toEqual([9999]);
  });
  it("accepts a matching optional signed UUID", async () => {
    expect((await call("template", token({ userUuid: "actor-one" }))).status).toBe(200);
  });
  for (const action of ["template", "validate", "execute"]) {
    it(`${action} rejects a mismatched optional signed UUID`, async () => {
      const res = await call(action, token({ userUuid: "different-user" }));
      expect(res.status).toBe(403);
      expect(res.body.message).toContain("signed user UUID does not match");
      expect(loadCatalogs).not.toHaveBeenCalled();
      expect(persistCandidate).not.toHaveBeenCalled();
    });
    it(`${action} still requires the server role's create permission`, async () => {
      tenantOne.users[0].role = "Viewer";
      const res = await call(action, token({ role: "Recruiter" }));
      expect(res.status).toBe(403);
      expect(res.body.message).toContain("create access");
      expect(loadCatalogs).not.toHaveBeenCalled();
      expect(persistCandidate).not.toHaveBeenCalled();
    });
  }
  it("cannot override signed identity or audit UUID using the upload body", async () => {
    const res = await call("execute", token(), undefined, { id: 42, userUuid: "actor-two", auditUserUuid: "actor-two", role: "Recruiter" });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("audit user does not match");
    expect(persistCandidate).not.toHaveBeenCalled();
  });
  it("also requires view permission, not just create permission", async () => {
    vi.mocked(accessControlService.getMyPermissions).mockResolvedValueOnce({
      permissions: [{ menuName: "In Progress", canview: false, cancreate: true }],
    } as any);
    expect((await call("template")).status).toBe(403);
    expect(loadCatalogs).not.toHaveBeenCalled();
  });
  it.each([undefined, null, true, [], {}, 0, -1, 1.5, "9999x", " 9999", "1e4", "09999", "", 2147483648, Number.MAX_SAFE_INTEGER])(
    "rejects malformed or missing signed id %j before any user query", async id => {
      const res = await call("template", token({ id }));
      expect(res.status).toBe(403);
      expect(res.body.message).toContain("valid signed user ID");
      expect(tenantOne.select).not.toHaveBeenCalled();
    },
  );
  it.each([
    [], [{ ...user, userUuid: null }], [{ ...user, userUuid: " " }],
    [{ ...user, role: null }], [{ ...user, role: " " }],
  ])("fails closed for unavailable user mappings %j", async (...rows) => {
    tenantOne.users.splice(0, tenantOne.users.length, ...rows as Record<string, unknown>[]);
    const res = await call("template");
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("user/role mapping is unavailable");
    expect(loadCatalogs).not.toHaveBeenCalled();
  });
  it.each(["Ship", "Vessel", " ship "])("rejects a signed vessel account %s", async userType => {
    expect((await call("template", token({ userType }))).status).toBe(403);
    expect(tenantOne.select).not.toHaveBeenCalled();
  });
  it("also rejects a vessel account in the matched master user", async () => {
    tenantOne.users[0].userType = "Ship";
    expect((await call("template")).body.message).toContain("Vessel users");
  });
  it("does not grant Manning Agents unrestricted access without verified agency scope", async () => {
    tenantOne.users[0].role = "Manning Agent";
    vi.mocked(accessControlService.getMyPermissions).mockResolvedValueOnce({
      permissions: [{ menuName: "In Progress", canview: true, cancreate: true }],
    } as any);
    const res = await call("execute", token(), undefined, { manningAgent: "Other Agency" });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("authenticated agency assignment");
    expect(persistCandidate).not.toHaveBeenCalled();
  });
});

describe("Verified tenant context and parent-ID synchronization", () => {
  it("rejects missing, forged and expired JWTs even with AUTH_BYPASS=true in production", async () => {
    expect((await call("template", "", "tenant-one")).status).toBe(401);
    expect((await call("template", token({}, "wrong-synthetic-signing-key"), "tenant-one")).status).toBe(401);
    expect((await call("template", token({ exp: 1 }), "tenant-one")).status).toBe(401);
    expect(tenantOne.select).not.toHaveBeenCalled();
  });
  it("rejects a signed domain conflicting with the selected tenant before lookup", async () => {
    expect((await call("template", token({ domain: "company-two" }), "tenant-one")).status).toBe(403);
    expect(tenantOne.select).not.toHaveBeenCalled();
    expect(tenantTwo.select).not.toHaveBeenCalled();
  });
  it("resolves the same numeric ID independently across concurrent tenant requests", async () => {
    const responses = await Promise.all([
      call("execute", token(), "tenant-one"),
      call("execute", token({ domain: "company-two" }), "tenant-two"),
    ]);
    expect(responses.map(res => res.status)).toEqual([201, 201]);
    expect(vi.mocked(persistCandidate).mock.calls.map(args => args[1]).sort()).toEqual(["actor-one", "actor-two"]);
    expect(tenantOne.queries[0].params).toEqual([9999]);
    expect(tenantTwo.queries[0].params).toEqual([9999]);
  });
  it("does not fall back to another tenant when a signed user's mapping is absent", async () => {
    tenantTwo.users.splice(0);
    expect((await call("template", token({ domain: "company-two" }))).status).toBe(403);
    expect(tenantOne.select).not.toHaveBeenCalled();
  });
  it("preserves nonsequential parent IDs and resets the sequence in a simulated sync only", async () => {
    const values = vi.fn(async (_rows: unknown) => {});
    tenantOne.insert.mockReturnValue({ values });
    await tenantConnectionManager.runInTenantContext("tenant-one", () =>
      new MastersRepository().syncMasterData("users", [
        { id: 9999, uuid: "actor-one", role: "Recruiter" },
        { id: 42, uuid: "actor-two", role: "Viewer" },
      ]));
    expect(values).toHaveBeenCalledWith([
      { id: 9999, userUuid: "actor-one", role: "Recruiter" },
      { id: 42, userUuid: "actor-two", role: "Viewer" },
    ]);
    expect(tenantOne.execute.mock.calls.map(args => dialect.sqlToQuery(args[0]).sql).join("\n")).toContain("setval");
  });
  it("does not permit anonymous development bypass when running in production", async () => {
    await expect(authorizeImport({ body: { auditUserUuid: "actor-one" } } as any)).rejects.toThrow("Authentication is required");
  });
});
