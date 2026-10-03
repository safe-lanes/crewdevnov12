import { afterEach, describe, expect, it } from "vitest";
import { clearCrewFileScanner, registerCrewFileScanner, scanCrewFile } from "@server/v2/crew-app/files/fileScanner";

const pdf = Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF");

describe("crew file scanner", () => {
  afterEach(clearCrewFileScanner);

  it("fails closed when no malware scanner is configured", async () => {
    expect((await scanCrewFile(pdf, "application/pdf")).status).toBe("failed");
  });

  it("rejects malformed and active-content PDFs before scanner invocation", async () => {
    registerCrewFileScanner({ scan: async () => ({ status: "clean", scanner: "test", checksumSha256: "ignored" }) });
    expect((await scanCrewFile(Buffer.from("%PDF-1.7 no eof"), "application/pdf")).status).toBe("rejected");
    expect((await scanCrewFile(Buffer.from("%PDF-1.7 /JavaScript bad %%EOF"), "application/pdf")).status).toBe("rejected");
  });

  it("accepts only an explicit clean scanner result and computes checksum itself", async () => {
    registerCrewFileScanner({ scan: async () => ({ status: "clean", scanner: "test-av", version: "1", checksumSha256: "untrusted" }) });
    const result = await scanCrewFile(pdf, "application/pdf");
    expect(result.status).toBe("clean");
    expect(result.scanner).toBe("test-av");
    expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.checksumSha256).not.toBe("untrusted");
  });
});
