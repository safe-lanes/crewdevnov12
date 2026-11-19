import { Request, Response } from "express";
import { z } from "zod";
import {
  analyzeAttachmentZip,
  convertAttachmentZip,
} from "../services/attachment-converter/converter";
import {
  getAttachmentConverterProfile,
  listAttachmentConverterProfiles,
} from "../services/attachment-converter/profiles";
import { createDatabaseAttachmentConverterResolvers } from "../services/attachment-converter/resolvers";
import { resolutionOverridesSchema } from "../services/attachment-converter/types";

function streamRequested(req: Request): boolean {
  return req.query.stream === "1";
}

function beginProgressStream(res: Response) {
  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}

function sendStreamEvent(res: Response, event: unknown) {
  res.write(`${JSON.stringify(event)}\n`);
}

function uploadedBuffer(req: Request): Buffer | null {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body?.fileData === "string") {
    return Buffer.from(req.body.fileData, "base64");
  }
  return null;
}

function profileIdFrom(req: Request): string {
  const profileId = typeof req.query.profileId === "string" ? req.query.profileId : "";
  if (!profileId) throw new Error("profileId query parameter is required.");
  return profileId;
}

function overridesFrom(req: Request) {
  const raw = req.body?.resolutions ?? req.body?.overrides ?? [];
  return resolutionOverridesSchema.parse(raw);
}

function tenantIdFrom(req: Request): string | null {
  return (req as Request & { tenantId?: string }).tenantId ?? null;
}

export const attachmentConverterController = {
  listProfiles(req: Request, res: Response) {
    res.json(listAttachmentConverterProfiles(tenantIdFrom(req)).map((profile) => ({
      profileId: profile.profileId,
      name: profile.name,
      version: profile.version,
      tenantScope: profile.tenantScope,
      active: profile.active,
      supportedFileTypes: profile.supportedFileTypes,
      sections: profile.sections,
    })));
  },

  async analyze(req: Request, res: Response) {
    try {
      const buffer = uploadedBuffer(req);
      if (!buffer) return res.status(400).json({ error: "No ZIP file provided." });
      const profile = getAttachmentConverterProfile(profileIdFrom(req), tenantIdFrom(req));
      const overrides = overridesFrom(req);
      if (streamRequested(req)) {
        beginProgressStream(res);
        try {
          const result = await analyzeAttachmentZip(
            buffer,
            profile,
            createDatabaseAttachmentConverterResolvers(),
            overrides,
            (progress) => sendStreamEvent(res, { type: "progress", progress }),
          );
          sendStreamEvent(res, { type: "result", result });
        } catch (error: any) {
          sendStreamEvent(res, { type: "error", message: error?.message ?? "Attachment conversion analysis failed." });
        } finally {
          res.end();
        }
        return;
      }
      const result = await analyzeAttachmentZip(
        buffer,
        profile,
        createDatabaseAttachmentConverterResolvers(),
        overrides,
      );
      return res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid conversion request.", details: error.errors });
      }
      return res.status(400).json({ error: error?.message ?? "Attachment conversion analysis failed." });
    }
  },

  async convert(req: Request, res: Response) {
    try {
      const buffer = uploadedBuffer(req);
      if (!buffer) return res.status(400).json({ error: "No ZIP file provided." });
      const profile = getAttachmentConverterProfile(profileIdFrom(req), tenantIdFrom(req));
      const overrides = overridesFrom(req);
      if (streamRequested(req)) {
        beginProgressStream(res);
        try {
          const result = await convertAttachmentZip(
            buffer,
            profile,
            createDatabaseAttachmentConverterResolvers(),
            overrides,
            (progress) => sendStreamEvent(res, { type: "progress", progress }),
          );
          sendStreamEvent(res, {
            type: "result",
            result: {
              profile: result.profile,
              convertedZip: result.convertedZip.toString("base64"),
              report: result.report,
              convertedCount: result.convertedCount,
              skippedCount: result.skippedCount,
              manualReviewCount: result.manualReviewCount,
            },
          });
        } catch (error: any) {
          sendStreamEvent(res, { type: "error", message: error?.message ?? "Attachment conversion failed." });
        } finally {
          res.end();
        }
        return;
      }
      const result = await convertAttachmentZip(
        buffer,
        profile,
        createDatabaseAttachmentConverterResolvers(),
        overrides,
      );
      return res.json({
        profile: result.profile,
        convertedZip: result.convertedZip.toString("base64"),
        report: result.report,
        convertedCount: result.convertedCount,
        skippedCount: result.skippedCount,
        manualReviewCount: result.manualReviewCount,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid conversion request.", details: error.errors });
      }
      return res.status(400).json({ error: error?.message ?? "Attachment conversion failed." });
    }
  },
};
