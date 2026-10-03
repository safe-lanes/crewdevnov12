import { describe, expect, it } from "vitest";
import { validateProductionConfig } from "@server/config/productionConfig";

const valid = { NODE_ENV:"production", JWT_SECRET:"a".repeat(40), CREW_APP_ACCESS_TOKEN_SECRET:"b".repeat(40), CREW_APP_REFRESH_TOKEN_SECRET:"c".repeat(40), CREW_APP_SECURITY_EVENT_KEY:"d".repeat(40), CREW_APP_MFA_ENCRYPTION_KEY:"0123456789abcdef".repeat(4), CREW_APP_ACCESS_TOKEN_TTL:"15m", CREW_APP_ALLOWED_ORIGINS:"https://crew.sail.example", CREW_APP_TENANCY_MODE:"multi", MASTER_DATABASE_URL:"postgres://master/db", CREW_APP_FILE_SCANNER:"clamav", CLAMAV_HOST:"clamav.internal", ATTACHMENT_STORAGE_DRIVER:"s3", ATTACHMENT_S3_BUCKET:"sail-private-attachments", ATTACHMENT_S3_REGION:"ap-south-1", CREW_APP_SIEM_URL:"https://siem.example/ingest", CREW_APP_SIEM_TOKEN:"e".repeat(40) };
describe("production configuration", () => {
  it("accepts a coherent production configuration", () => expect(() => validateProductionConfig(valid)).not.toThrow());
  it.each([
    [{ ...valid, CREW_APP_ACCESS_TOKEN_SECRET: valid.JWT_SECRET }, "distinct"],
    [{ ...valid, CREW_APP_ALLOWED_ORIGINS: "*" }, "origins"],
    [{ ...valid, CREW_APP_ALLOWED_ORIGINS: "http://localhost:5000" }, "origins"],
    [{ ...valid, CREW_APP_TENANCY_MODE: "multi", MASTER_DATABASE_URL: undefined }, "MASTER_DATABASE_URL"],
    [{ ...valid, CREW_APP_ACCESS_TOKEN_TTL: "forever" }, "duration"],
  ] as const)("rejects unsafe configuration", (env, message) => expect(() => validateProductionConfig(env as any)).toThrow(message));

  it("rejects plaintext object-storage endpoints and incomplete static credentials", () => {
    expect(() => validateProductionConfig({ ...valid, ATTACHMENT_S3_ENDPOINT: "http://storage.internal" })).toThrow("https://");
    expect(() => validateProductionConfig({ ...valid, ATTACHMENT_S3_ACCESS_KEY_ID: "access-key-only" })).toThrow("supplied together");
  });
});
