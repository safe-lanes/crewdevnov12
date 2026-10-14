import http from "node:http";

export const testApiUrl = process.env.TEST_API_URL;
if (!testApiUrl || new URL(testApiUrl).port === "5000")
  throw new Error("A dedicated test backend URL is required; main preview is forbidden.");

export async function verifyTestBackend() {
  // Node HTTP deliberately avoids happy-dom CORS, cache and test fetch mocks.
  const identity: any = await new Promise((resolve, reject) => {
    const request = http.get(`${testApiUrl}/api/test-database-identity`, response => {
      let body = "";
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode !== 200) return reject(new Error("Dedicated test backend identity endpoint is unavailable."));
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.on("error", reject);
    request.setTimeout(10000, () => { request.destroy(new Error("Test backend identity check timed out.")); });
  });
  const expected = JSON.parse(process.env.TEST_DATABASE_IDENTITY!);
  if (identity.clusterid !== expected.clusterid || identity.databaseoid !== expected.databaseoid)
    throw new Error("API backend does not use the verified test database.");
}
