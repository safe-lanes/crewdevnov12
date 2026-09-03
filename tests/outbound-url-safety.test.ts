import { describe, expect, it, vi } from "vitest";
import {
  OutboundUrlValidationError,
  validateMasterDataUrl,
} from "../server/utils/outboundUrlSafety";

describe("validateMasterDataUrl", () => {
  it("accepts an allowlisted HTTPS host resolving only to public addresses", async () => {
    const resolveHost = vi.fn().mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);

    const result = await validateMasterDataUrl(
      "https://api.example.com/master-data",
      "api.example.com",
      resolveHost,
    );

    expect(result.toString()).toBe("https://api.example.com/master-data");
    expect(resolveHost).toHaveBeenCalledWith("api.example.com");
  });

  it.each([
    [undefined, "api.example.com", "MASTER_DATA_API_URL is not configured"],
    ["not a url", "api.example.com", "malformed"],
    ["http://api.example.com/data", "api.example.com", "must use HTTPS"],
    ["https://user:pass@api.example.com/data", "api.example.com", "must not contain credentials"],
    ["https://localhost/data", "localhost", "local hostname"],
    ["https://api.example.com/data", undefined, "MASTER_DATA_API_ALLOWED_HOSTS is not configured"],
    ["https://other.example.com/data", "api.example.com", "not allowlisted"],
  ])("rejects invalid configuration %#", async (url, hosts, message) => {
    await expect(
      validateMasterDataUrl(url, hosts, vi.fn()),
    ).rejects.toThrow(message);
  });

  it.each([
    ["127.0.0.1"],
    ["10.2.3.4"],
    ["169.254.169.254"],
    ["172.16.0.1"],
    ["192.168.1.1"],
    ["::1"],
    ["fe80::1"],
    ["fd00::1"],
  ])("rejects private or link-local address %s", async (address) => {
    await expect(
      validateMasterDataUrl(
        "https://api.example.com/data",
        "api.example.com",
        async () => [{ address, family: address.includes(":") ? 6 : 4 }],
      ),
    ).rejects.toBeInstanceOf(OutboundUrlValidationError);
  });

  it("rejects a hostname if any DNS result is private", async () => {
    await expect(
      validateMasterDataUrl(
        "https://api.example.com/data",
        "api.example.com",
        async () => [
          { address: "93.184.216.34", family: 4 },
          { address: "169.254.169.254", family: 4 },
        ],
      ),
    ).rejects.toThrow("private, local, or reserved");
  });
});