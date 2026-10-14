import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import companyFormSubmissionsRoutes from "../../server/v2/company-forms/routes";

describe("Company Form lifecycle rules", () => {
  it("rejects a forged section completion payload instead of trusting caller point lists", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v2/company-form-submissions", companyFormSubmissionsRoutes);
    const response = await request(app)
      .post("/api/v2/company-form-submissions/7ebbb8c6-dac0-4edc-9be2-c6ff75fb9e9c/sections/9a24ca3e-3d6d-4515-bcde-64fca7681f64/submit")
      .send({ answers: [], signatures: [] });
    expect(response.status).toBe(400);
  });

  it("rejects body-supplied signer identity and designation", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v2/company-form-submissions", companyFormSubmissionsRoutes);
    const response = await request(app)
      .post("/api/v2/company-form-submissions/7ebbb8c6-dac0-4edc-9be2-c6ff75fb9e9c/sections/9a24ca3e-3d6d-4515-bcde-64fca7681f64/signatures")
      .send({
        signatureType: "officer",
        method: "officer",
        data: "data:image/png;base64,AA==",
        signerName: "Untrusted",
        designation: "Captain",
      });
    expect(response.status).toBe(400);
  });

  it("requires a written void reason", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v2/company-form-submissions", companyFormSubmissionsRoutes);
    const response = await request(app)
      .post("/api/v2/company-form-submissions/7ebbb8c6-dac0-4edc-9be2-c6ff75fb9e9c/void")
      .send({});
    expect(response.status).toBe(400);
  });
});