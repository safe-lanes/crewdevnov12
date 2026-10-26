// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { importRequest } from "../../client/src/modules/recruitment/importRequest";
vi.mock("@/lib/authToken", () => ({ getAuthToken: () => "test-bearer" }));
vi.mock("@/lib/tenantStorage", () => ({ getTenantId: () => "test-tenant" }));
afterEach(() => vi.unstubAllGlobals());
describe("Recruitment import authenticated requests", () => {
  for (const action of ["template", "validate", "execute"] as const) it(`${action} explicitly sends bearer and tenant headers`, async () => {
    const response = new Response("test", { status: 200 });
    const fetchMock = vi.fn(async () => response);
    vi.stubGlobal("fetch", fetchMock);
    const data = action === "template" ? undefined : { fileName: "candidate.xlsx", fileData: "test", auditUserUuid: "actor" };
    expect(await importRequest(action, data)).toBe(response);
    expect(fetchMock).toHaveBeenCalledWith(`/api/v2/recruitment/import/${action}`, expect.objectContaining({
      credentials: "include", method: action === "template" ? "GET" : "POST",
      headers: expect.objectContaining({ Authorization: "Bearer test-bearer", "x-tenant-id": "test-tenant" }),
    }));
    if (data) expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: JSON.stringify(data), headers: { "Content-Type": "application/json" } });
  });
});
