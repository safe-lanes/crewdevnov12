import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { ClamAvScanner } from "@server/v2/crew-app/files/clamAvScanner";
import { initializeCrewFileSecurity } from "@server/v2/crew-app/files/fileSecurityBootstrap";
import { clearCrewFileScanner } from "@server/v2/crew-app/files/fileScanner";

afterEach(clearCrewFileScanner);

async function fakeClam(response: string): Promise<{ port: number; close: () => Promise<void> }> {
  const server = net.createServer((socket) => {
    let received = Buffer.alloc(0);
    socket.on("data", (part) => {
      received = Buffer.concat([received, part]);
      if (received.length >= 4 && received.subarray(-4).equals(Buffer.alloc(4))) socket.end(response);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { port: (server.address() as net.AddressInfo).port, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

describe("real ClamAV adapter", () => {
  it("streams a file using INSTREAM and accepts only an explicit clean response", async () => {
    const daemon = await fakeClam("stream: OK\0");
    try {
      const result = await new ClamAvScanner({ host: "127.0.0.1", port: daemon.port, timeoutMs: 2_000 }).scan(Buffer.from("content"), "application/pdf");
      expect(result.status).toBe("clean");
      expect(result.scanner).toBe("clamav");
    } finally { await daemon.close(); }
  });

  it("maps a FOUND response to infected", async () => {
    const daemon = await fakeClam("stream: Eicar-Test-Signature FOUND\0");
    try {
      expect((await new ClamAvScanner({ host: "127.0.0.1", port: daemon.port, timeoutMs: 2_000 }).scan(Buffer.from("content"), "application/pdf")).status).toBe("infected");
    } finally { await daemon.close(); }
  });

  it("fails production bootstrap closed without a configured scanner", () => {
    expect(() => initializeCrewFileSecurity({ NODE_ENV: "production" })).toThrow("requires CREW_APP_FILE_SCANNER=clamav");
    expect(() => initializeCrewFileSecurity({ NODE_ENV: "production", CREW_APP_FILE_SCANNER: "clamav" })).toThrow("CLAMAV_HOST");
  });
});
