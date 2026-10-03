import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { safeRequestLogging } from "@server/middleware/safeRequestLogging";

const canaries = ["TEST_ACCESS_TOKEN_123456", "TEST_REFRESH_TOKEN_123456", "TEST_PASSWORD_123456", "TEST_PASSPORT_123456", "TEST_MEDICAL_123456"];

function response(status = 200): any {
  const res: any = new EventEmitter(); res.statusCode = status; res.setHeader = vi.fn(); return res;
}

describe("safe request logging", () => {
  it("excludes headers, query, request body, and response data", () => {
    const lines: string[] = [];
    const req: any = { method: "POST", path: "/api/login", baseUrl: "/api/crew-app/auth", route: { path: "/login" }, headers: { authorization: canaries[0] }, query: { token: canaries[1] }, body: { password: canaries[2], passport: canaries[3], medical: canaries[4] }, header: () => undefined };
    const res = response();
    safeRequestLogging(line => lines.push(line))(req, res, vi.fn()); res.emit("finish");
    expect(lines).toHaveLength(1);
    canaries.forEach(value => expect(lines[0]).not.toContain(value));
    expect(JSON.parse(lines[0])).toMatchObject({ event: "http_request", method: "POST", route: "/api/crew-app/auth/login", status: 200 });
  });

  it("does not fall back to URLs containing IDs or query tokens", () => {
    const lines: string[] = [];
    const req: any = { method: "GET", path: "/api/private-id", originalUrl: `/api/private-id?sail=${canaries[0]}`, headers: {}, header: () => undefined };
    const res = response(404);
    safeRequestLogging(line => lines.push(line))(req, res, vi.fn()); res.emit("finish");
    expect(lines[0]).toContain("/api/<unmatched>");
    expect(lines[0]).not.toContain("private-id");
    expect(lines[0]).not.toContain(canaries[0]);
  });
});
