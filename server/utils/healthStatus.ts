export type DatabaseHealthStatus =
  | "connected"
  | "disconnected"
  | "master-connected"
  | "master-disconnected";

export function getDatabaseHealthStatus(
  isConnected: boolean,
  isMultiTenantEnabled: boolean,
  masterHealthy: boolean | null,
): DatabaseHealthStatus {
  if (isConnected) return "connected";
  if (!isMultiTenantEnabled) return "disconnected";
  return masterHealthy ? "master-connected" : "master-disconnected";
}