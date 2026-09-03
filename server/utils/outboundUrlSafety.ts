import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

type ResolvedAddress = {
  address: string;
  family: number;
};

export type HostLookup = (hostname: string) => Promise<ResolvedAddress[]>;

export class OutboundUrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboundUrlValidationError";
  }
}

const blockedAddresses = new BlockList();

([
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
] satisfies Array<[string, number]>).forEach(([network, prefix]) =>
  blockedAddresses.addSubnet(network, prefix, "ipv4"),
);

([
  ["::", 128],
  ["::1", 128],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] satisfies Array<[string, number]>).forEach(([network, prefix]) =>
  blockedAddresses.addSubnet(network, prefix, "ipv6"),
);

const defaultLookup: HostLookup = async (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

function normalizeHostname(hostname: string): string {
  return hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLocaleLowerCase();
}

function parseAllowedHosts(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map(normalizeHostname)
      .filter(Boolean),
  );
}

function assertPublicAddress(address: string): void {
  const family = isIP(address);
  if (family === 0) {
    throw new OutboundUrlValidationError(
      "Configured master-data hostname resolved to an invalid IP address.",
    );
  }

  if (family === 6 && normalizeHostname(address).startsWith("::ffff:")) {
    throw new OutboundUrlValidationError(
      "Configured master-data URL resolves to a private, local, or reserved address.",
    );
  }

  const type = family === 4 ? "ipv4" : "ipv6";
  if (blockedAddresses.check(address, type)) {
    throw new OutboundUrlValidationError(
      "Configured master-data URL resolves to a private, local, or reserved address.",
    );
  }
}

export async function validateMasterDataUrl(
  rawUrl: string | undefined,
  rawAllowedHosts: string | undefined,
  resolveHost: HostLookup = defaultLookup,
): Promise<URL> {
  if (!rawUrl?.trim()) {
    throw new OutboundUrlValidationError(
      "MASTER_DATA_API_URL is not configured.",
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new OutboundUrlValidationError(
      "MASTER_DATA_API_URL is malformed.",
    );
  }

  if (url.protocol !== "https:") {
    throw new OutboundUrlValidationError(
      "MASTER_DATA_API_URL must use HTTPS.",
    );
  }

  if (url.username || url.password) {
    throw new OutboundUrlValidationError(
      "MASTER_DATA_API_URL must not contain credentials.",
    );
  }

  const hostname = normalizeHostname(url.hostname);
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home.arpa")
  ) {
    throw new OutboundUrlValidationError(
      "MASTER_DATA_API_URL must not target a local hostname.",
    );
  }

  const allowedHosts = parseAllowedHosts(rawAllowedHosts);
  if (allowedHosts.size === 0) {
    throw new OutboundUrlValidationError(
      "MASTER_DATA_API_ALLOWED_HOSTS is not configured.",
    );
  }
  if (!allowedHosts.has(hostname)) {
    throw new OutboundUrlValidationError(
      "MASTER_DATA_API_URL hostname is not allowlisted.",
    );
  }

  if (isIP(hostname)) {
    assertPublicAddress(hostname);
    return url;
  }

  let addresses: ResolvedAddress[];
  try {
    addresses = await resolveHost(hostname);
  } catch {
    throw new OutboundUrlValidationError(
      "MASTER_DATA_API_URL hostname could not be resolved.",
    );
  }

  if (addresses.length === 0) {
    throw new OutboundUrlValidationError(
      "MASTER_DATA_API_URL hostname did not resolve to an address.",
    );
  }

  addresses.forEach(({ address }) => assertPublicAddress(address));
  return url;
}