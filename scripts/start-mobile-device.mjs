#!/usr/bin/env node

import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { config as loadEnv } from "dotenv";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileDir = resolve(rootDir, "mobile");
const requireFromRoot = createRequire(resolve(rootDir, "package.json"));
const requireFromMobile = createRequire(resolve(mobileDir, "package.json"));
loadEnv({ path: resolve(rootDir, ".env"), quiet: true });

const isPrivateIpv4 = (address) => {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
};

const findLanAddress = () => {
  const candidates = Object.entries(networkInterfaces())
    .flatMap(([name, addresses]) => (addresses || []).map((address) => ({ name, ...address })))
    .filter((address) => address.family === "IPv4" && !address.internal && isPrivateIpv4(address.address))
    .sort((left, right) => {
      const virtual = /virtual|vmware|vbox|docker|hyper-v|wsl|loopback|tailscale/i;
      return Number(virtual.test(left.name)) - Number(virtual.test(right.name));
    });
  return candidates[0]?.address;
};

const apiPort = process.env.MOBILE_API_PORT || "5001";
const explicitUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const explicitHost = process.env.MOBILE_DEVICE_HOST?.trim();
const startApiServer = !explicitUrl || process.env.MOBILE_START_API_SERVER === "1";
const lanAddress = explicitHost || findLanAddress();

if (!explicitUrl && !lanAddress) {
  console.error([
    "Could not detect a private LAN IPv4 address for Expo Go.",
    "Connect this computer to the same network as your phone, then try again.",
    "Or set MOBILE_DEVICE_HOST to this computer's IPv4 address before running the command.",
    "Example (PowerShell): $env:MOBILE_DEVICE_HOST=\"192.168.1.25\"",
  ].join("\n"));
  process.exit(1);
}

const apiBaseUrl = (explicitUrl || `http://${lanAddress}:${apiPort}`).replace(/\/+$/, "");
let apiUrl;
try {
  apiUrl = new URL(apiBaseUrl);
} catch {
  console.error("EXPO_PUBLIC_API_BASE_URL must be a valid absolute URL.");
  process.exit(1);
}
if (!["http:", "https:"].includes(apiUrl.protocol)) {
  console.error("EXPO_PUBLIC_API_BASE_URL must use http:// or https://");
  process.exit(1);
}

console.log(`Mobile API URL: ${apiBaseUrl}`);
if (explicitUrl) console.log("Using EXPO_PUBLIC_API_BASE_URL override.");
else if (explicitHost) console.log("Using MOBILE_DEVICE_HOST override.");
else console.log(`Detected LAN address: ${lanAddress}`);
console.log("Your phone and computer must be on the same network. Allow Node.js through the firewall if prompted.");

if (process.argv.includes("--print-config")) process.exit(0);

if (startApiServer) {
  const tenancyMode = (process.env.CREW_APP_TENANCY_MODE || "single").toLowerCase();
  if (!["single", "multi", "auto"].includes(tenancyMode)) {
    console.error("CREW_APP_TENANCY_MODE must be single, multi, or auto.");
    process.exit(1);
  }

  const requiredSettings = ["CREW_APP_ACCESS_TOKEN_SECRET", "CREW_APP_REFRESH_TOKEN_SECRET"];
  if (tenancyMode === "single") requiredSettings.push("DATABASE_URL");
  if (tenancyMode === "multi") requiredSettings.push("MASTER_DATABASE_URL");
  if (tenancyMode === "auto" && !process.env.DATABASE_URL && !process.env.MASTER_DATABASE_URL) {
    requiredSettings.push("DATABASE_URL or MASTER_DATABASE_URL");
  }
  const missingSettings = requiredSettings.filter((name) =>
    name.includes(" or ")
      ? !name.split(" or ").some((option) => process.env[option])
      : !process.env[name],
  );
  if (missingSettings.length) {
    console.error([
      `Missing required local API configuration: ${missingSettings.join(", ")}`,
      "Add the development values to the project-root .env file.",
      "See server/v2/crew-app/README.md for the crew-auth requirements.",
    ].join("\n"));
    process.exit(1);
  }

  const signingSecrets = [
    ["CREW_APP_ACCESS_TOKEN_SECRET", process.env.CREW_APP_ACCESS_TOKEN_SECRET],
    ["CREW_APP_REFRESH_TOKEN_SECRET", process.env.CREW_APP_REFRESH_TOKEN_SECRET],
    ["JWT_SECRET", process.env.JWT_SECRET],
  ].filter(([, value]) => value);
  const duplicateSecrets = signingSecrets.some(([, value], index) =>
    signingSecrets.some(([, otherValue], otherIndex) => index !== otherIndex && value === otherValue),
  );
  if (duplicateSecrets) {
    console.error("Crew access, crew refresh, and legacy JWT signing secrets must all be distinct.");
    process.exit(1);
  }
} else {
  console.log("Using an existing API; the local API server will not be started.");
}

const apiEnv = {
  ...process.env,
  NODE_ENV: "development",
  PORT: apiPort,
  EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
  CREW_APP_TENANCY_MODE: process.env.CREW_APP_TENANCY_MODE || "single",
  CREW_APP_SINGLE_TENANT_DOMAIN: process.env.CREW_APP_SINGLE_TENANT_DOMAIN || "local",
};

const expoSafeKeys = new Set([
  "PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC",
  "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "PROGRAMDATA",
  "CI", "TERM", "FORCE_COLOR", "NO_COLOR", "NODE_ENV", "NODE_OPTIONS",
]);
const expoEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => {
  const normalized = name.toUpperCase();
  return expoSafeKeys.has(normalized)
    || normalized.startsWith("EXPO_")
    || normalized.startsWith("REACT_NATIVE_");
}));
expoEnv.NODE_ENV = "development";
expoEnv.EXPO_PUBLIC_API_BASE_URL = apiBaseUrl;

const children = [];
let stopping = false;
let requestedExitCode = 0;

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

const terminateWindowsTree = (pid, force = false) => new Promise((resolveTermination) => {
  const args = ["/PID", String(pid), "/T", ...(force ? ["/F"] : [])];
  const terminator = spawn("taskkill", args, { stdio: "ignore" });
  terminator.on("error", () => resolveTermination());
  terminator.on("exit", () => resolveTermination());
});

const signalChildTree = async (child, force = false) => {
  if (!child.pid) return;
  if (process.platform === "win32") {
    await terminateWindowsTree(child.pid, force);
    return;
  }
  try {
    process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
};

const stop = async (exitCode = 0) => {
  requestedExitCode = requestedExitCode || exitCode;
  if (stopping) return;
  stopping = true;
  await Promise.all(children.map(({ child }) => signalChildTree(child)));
  const allExited = Promise.all(children.map(({ exited }) => exited));
  const graceful = await Promise.race([allExited.then(() => true), delay(11000).then(() => false)]);
  if (!graceful) {
    console.error("Forcing remaining development processes to stop.");
    await Promise.all(children.map(({ child }) => signalChildTree(child, true)));
    await Promise.race([allExited, delay(2000)]);
  }
  process.exit(requestedExitCode);
};

const start = (name, entry, args, cwd, childEnv) => {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd,
    env: childEnv,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  let resolveExit;
  const exited = new Promise((resolveChildExit) => { resolveExit = resolveChildExit; });
  children.push({ child, exited });
  child.on("error", (error) => {
    console.error(`${name} could not start: ${error.message}`);
    void stop(1);
  });
  child.on("exit", (code, signal) => {
    resolveExit();
    if (!stopping) {
      console.error(`${name} stopped${signal ? ` (${signal})` : ` with code ${code ?? 1}`}.`);
      void stop(code || 1);
    }
  });
};

process.on("SIGINT", () => { void stop(0); });
process.on("SIGTERM", () => { void stop(0); });

const tsxCli = requireFromRoot.resolve("tsx/cli");
const expoCli = requireFromMobile.resolve("expo/bin/cli");
const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== "--print-config");
const hasExpoConnectionMode = forwardedArgs.some((arg) =>
  ["--lan", "--localhost", "--tunnel", "--offline", "--host"].includes(arg)
  || arg.startsWith("--host="),
);
const expoArgs = ["start", ...(hasExpoConnectionMode ? [] : ["--lan"]), ...forwardedArgs];

if (startApiServer) start("API server", tsxCli, ["server/index.ts"], rootDir, apiEnv);
start("Expo", expoCli, expoArgs, mobileDir, expoEnv);