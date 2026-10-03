import net from "node:net";
import type { FileScanner, FileScanResult } from "./fileScanner";

export type ClamAvConfig = { host: string; port: number; timeoutMs: number };

export class ClamAvScanner implements FileScanner {
  constructor(private readonly config: ClamAvConfig) {}
  scan(buffer: Buffer, _mime: string): Promise<FileScanResult> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.config.host, port: this.config.port });
      let response = "";
      const fail = (error: Error) => { socket.destroy(); reject(error); };
      socket.setTimeout(this.config.timeoutMs, () => fail(new Error("clamav_timeout")));
      socket.once("error", fail);
      socket.on("data", (chunk) => { response += chunk.toString("utf8"); });
      socket.once("connect", () => {
        socket.write("zINSTREAM\0");
        for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
          const chunk = buffer.subarray(offset, Math.min(offset + 64 * 1024, buffer.length));
          const length = Buffer.allocUnsafe(4); length.writeUInt32BE(chunk.length); socket.write(length); socket.write(chunk);
        }
        socket.end(Buffer.alloc(4));
      });
      socket.once("close", () => {
        const normalized = response.replace(/\0+$/g, "").trim();
        const clean = /: OK$/i.test(normalized);
        const infected = /: .+ FOUND$/i.test(normalized);
        if (!clean && !infected) return reject(new Error("clamav_invalid_response"));
        resolve({ status: clean ? "clean" : "infected", scanner: "clamav", reason: infected ? "malware_detected" : undefined, checksumSha256: "computed-by-boundary" });
      });
    });
  }
}
