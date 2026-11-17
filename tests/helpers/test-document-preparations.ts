import http from "node:http";
import { testApiUrl, verifyTestBackend } from "./test-backend";

/** HTTP is deliberate: test fetch mocks and happy-dom must not detach teardown. */
export async function finishTestDocumentPreparations() {
  const identity = await verifyTestBackend();
  if (identity.documentPreparationMode !== "awaited") {
    throw new Error("Fixture cleanup refuses a backend with an unowned periodic PDF worker.");
  }
  const result: any = await new Promise((resolve, reject) => {
    const request = http.request(`${testApiUrl}/api/test-document-preparations/drain`, {
      // Do not reuse a socket that the server may have closed while a test ran.
      // A fresh connection avoids the idle-keepalive race without any retry.
      method: "POST", agent: false, headers: { "X-Test-Backend-Instance": identity.instance },
    }, response => {
      let body = "";
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode !== 200) return reject(new Error("Test PDF work did not finish; fixture cleanup is refused."));
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.on("error", reject);
    request.end();
  });
  if (result.clusterid !== identity.clusterid || result.databaseoid !== identity.databaseoid ||
      result.instance !== identity.instance || result.documentPreparationMode !== "awaited") {
    throw new Error("Document drain did not come from the verified test backend.");
  }
  return result;
}
