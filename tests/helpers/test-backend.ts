export const testApiUrl = process.env.TEST_API_URL;
if (!testApiUrl || new URL(testApiUrl).port === "5000")
  throw new Error("A dedicated test backend URL is required; main preview is forbidden.");

export async function verifyTestBackend() {
  const result = await fetch(`${testApiUrl}/api/test-database-identity`);
  if (!result.ok) throw new Error("Dedicated test backend identity endpoint is unavailable.");
  const identity = await result.json();
  const expected = JSON.parse(process.env.TEST_DATABASE_IDENTITY!);
  if (identity.clusterid !== expected.clusterid || identity.databaseoid !== expected.databaseoid)
    throw new Error("API backend does not use the verified test database.");
}
