import type { Request } from "express";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import { getDb } from "../db";
import { accessControlAuthority, authenticatedActor, appendAudit, lockAccessControl } from "../admin/services/accessControlManagement";
import { CompanyFormPermissionError, CompanyFormValidationError } from "./errors";
import { sha256 } from "./documentEvidenceRepository";
import { REAL_FORM_PDF_GENERATION_ENABLED } from "./documentArchive";

async function authorize(req: Request, tx: any) {
  await lockAccessControl(tx);
  const authority = await accessControlAuthority(req, tx);
  if (authority.mode !== "management") {
    throw new CompanyFormPermissionError("Access Control management must be granted to manage the company PDF logo.");
  }
}
export async function readBranding(tx: any, submissionUuid?: string) {
  if (submissionUuid) {
    const sample = (await tx.execute(sql`SELECT b.* FROM frm_document_samples s
      JOIN frm_document_branding b ON b.version_uuid=s.registration->>'brandingVersionUuid'
      WHERE s.submission_uuid=${submissionUuid}`)).rows[0];
    if (sample && await (await import("./documentArchive")).sampleEligible(tx, submissionUuid)) return sample;
  }
  // Deliberate layout-sample branding never becomes this tenant's real branding.
  return (await tx.execute(sql`SELECT b.* FROM frm_document_branding b WHERE NOT EXISTS
    (SELECT 1 FROM frm_document_samples s WHERE s.registration->>'brandingVersionUuid'=b.version_uuid)
    ORDER BY b.id DESC LIMIT 1`)).rows[0] ?? null;
}
export async function getBranding(req: Request) {
  return getDb().transaction(async (tx: any) => {
    await authorize(req, tx);
    const rows = (await tx.execute(sql`SELECT b.* FROM frm_document_branding b WHERE NOT EXISTS
      (SELECT 1 FROM frm_document_samples s WHERE s.registration->>'brandingVersionUuid'=b.version_uuid)
      ORDER BY b.id DESC LIMIT 50`)).rows as any[];
    const latest = rows[0];
    return {
      companyName: latest?.company_name ?? "", logoVersionUuid: latest?.version_uuid ?? null,
      logoDataUrl: latest?.media_type ? `data:${latest.media_type};base64,${latest.bytes_base64}` : null,
      version: latest ? Number(latest.id) : null, realGenerationEnabled: REAL_FORM_PDF_GENERATION_ENABLED,
      history: rows.map(r => ({ version: Number(r.id), companyName: r.company_name,
        createdAt: r.created_at, actorName: r.actor.name ?? `User ${r.actor.masterUserId}` })),
    };
  });
}
export async function saveBranding(req: Request) {
  const parsed = z.object({
    companyName: z.string().trim().min(1).max(200),
    dataUrl: z.string().max(2800000).nullable(),
  }).strict().safeParse(req.body);
  if (!parsed.success) throw new CompanyFormValidationError("Enter the company name and select a PNG or JPEG logo up to 2 MB.");
  const { companyName, dataUrl } = parsed.data;
  let bytes: Buffer | null = null, media: string | null = null;
  if (dataUrl) {
    const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
    if (!match) throw new CompanyFormValidationError("Select a PNG or JPEG logo up to 2 MB.");
    media = match[1]; bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > 2097152) throw new CompanyFormValidationError("The logo must be no larger than 2 MB.");
    try {
      const pdf = await PDFDocument.create();
      const image = media === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      if (image.width > 8000 || image.height > 8000) throw new Error("Large image");
    } catch { throw new CompanyFormValidationError("This logo could not be read. Select a valid PNG or JPEG image."); }
  }
  await getDb().transaction(async (tx: any) => {
    await authorize(req, tx);
    const actor = await authenticatedActor(req, tx);
    const user = (await tx.execute(sql`SELECT fullname,firstname,lastname FROM master_users WHERE id=${actor.masterUserId}`)).rows[0];
    const name = user?.fullname?.trim() || [user?.firstname, user?.lastname].filter(Boolean).join(" ").trim() || `User ${actor.masterUserId}`;
    const before = await readBranding(tx);
    const uuid = randomUUID();
    await tx.execute(sql`INSERT INTO frm_document_branding(version_uuid,company_name,media_type,bytes_base64,sha256,actor)
      VALUES(${uuid},${companyName},${media},${bytes?.toString("base64") ?? null},${bytes ? sha256(bytes) : null},
      ${JSON.stringify({ ...actor, name })}::jsonb)`);
    await appendAudit(tx, actor, "company_document_branding", null, "company_documents", "branding",
      before ? { versionUuid: before.version_uuid, sha256: before.sha256, companyName: before.company_name } : null,
      { versionUuid: uuid, sha256: bytes ? sha256(bytes) : null, companyName });
  });
  return getBranding(req);
}
