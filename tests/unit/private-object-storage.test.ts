import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { deleteAttachmentForCurrentTenant, setAttachmentObjectClientForTests, writeAttachment } from "@server/v2/shared/fileStorageService";
import { tenantConnectionManager } from "@server/utils/tenantConnectionManager";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
  setAttachmentObjectClientForTests(null);
  vi.restoreAllMocks();
});

describe("private durable object storage", () => {
  it("writes a tenant-prefixed private object with server-side encryption", async () => {
    process.env.ATTACHMENT_STORAGE_DRIVER = "s3";
    process.env.ATTACHMENT_S3_BUCKET = "private-bucket";
    process.env.ATTACHMENT_S3_REGION = "ap-south-1";
    const send = vi.fn().mockResolvedValue({});
    setAttachmentObjectClientForTests({ send } as any);
    const reference = await writeAttachment("crew-pool/documents", "passport.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xd9]), "tenant-a");
    expect(reference).toMatch(/^object:\/\/tenant-a\/crew-pool\/documents\//);
    expect(send).toHaveBeenCalledOnce();
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({ Bucket: "private-bucket", ServerSideEncryption: "AES256", ContentType: "image/jpeg" });
    expect(command.input).not.toHaveProperty("ACL", "public-read");
  });

  it("rejects cross-tenant object deletion before contacting storage", async () => {
    process.env.ATTACHMENT_STORAGE_DRIVER = "s3";
    process.env.ATTACHMENT_S3_BUCKET = "private-bucket";
    const send = vi.fn().mockResolvedValue({});
    setAttachmentObjectClientForTests({ send } as any);
    await expect(tenantConnectionManager.tenantStorage.run({ db: {} as any, tenantId: "tenant-a", domain: "tenant-a" }, () => deleteAttachmentForCurrentTenant("object://tenant-b/crew-pool/file.pdf"))).rejects.toThrow("outside the authenticated tenant root");
    expect(send).not.toHaveBeenCalled();
  });

  it("deletes only an authorized tenant object", async () => {
    process.env.ATTACHMENT_STORAGE_DRIVER = "s3";
    process.env.ATTACHMENT_S3_BUCKET = "private-bucket";
    const send = vi.fn().mockResolvedValue({});
    setAttachmentObjectClientForTests({ send } as any);
    await tenantConnectionManager.tenantStorage.run({ db: {} as any, tenantId: "tenant-a", domain: "tenant-a" }, () => deleteAttachmentForCurrentTenant("object://tenant-a/crew-pool/file.pdf"));
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
  });
});
