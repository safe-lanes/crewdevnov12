import { Request, Response } from "express";
import { AttachmentsRepository } from "../repositories";
import { v4 as uuidv4 } from "uuid";

const attachmentsRepository = new AttachmentsRepository();

export const attachmentsController = {
  async getByTestRecord(req: Request, res: Response) {
    try {
      const { testRecordUuid } = req.params;
      if (!testRecordUuid) {
        return res.status(400).json({ error: "testRecordUuid is required" });
      }

      const attachments = await attachmentsRepository.findByTestRecordUuid(testRecordUuid);

      const result = attachments.map((a) => ({
        id: a.attUuid,
        attUuid: a.attUuid,
        name: a.fileName || "",
        type: a.fileType || "",
        size: a.fileSize ? parseInt(a.fileSize, 10) : 0,
        data: a.fileData || "",
        uploadedAt: a.uploadDate || a.createdAt?.toISOString() || "",
        testRecordUuid: a.testRecordUuid,
      }));

      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.json(result);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { testRecordUuid } = req.params;
      if (!testRecordUuid) {
        return res.status(400).json({ error: "testRecordUuid is required" });
      }

      const { name, type, size, data, uploadedAt } = req.body;

      if (!name || !data) {
        return res.status(400).json({ error: "name and data are required" });
      }

      const auditUserUuid = req.body.auditUserUuid || null;

      const attachment = await attachmentsRepository.create({
        testRecordUuid,
        fileName: name,
        fileType: type || null,
        fileSize: size?.toString() || null,
        fileData: data,
        uploadDate: uploadedAt || new Date().toISOString(),
        uploadedBy: auditUserUuid,
        filePath: null,
        sortOrder: 0,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      });

      res.status(201).json({
        id: attachment.attUuid,
        attUuid: attachment.attUuid,
        name: attachment.fileName || "",
        type: attachment.fileType || "",
        size: attachment.fileSize ? parseInt(attachment.fileSize, 10) : 0,
        data: attachment.fileData || "",
        uploadedAt: attachment.uploadDate || attachment.createdAt?.toISOString() || "",
        testRecordUuid: attachment.testRecordUuid,
      });
    } catch (error) {
      console.error("Error creating attachment:", error);
      res.status(500).json({ error: "Failed to create attachment" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      if (!attUuid) {
        return res.status(400).json({ error: "attUuid is required" });
      }

      const existing = await attachmentsRepository.findByUuid(attUuid);
      if (!existing) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      await attachmentsRepository.softDeleteByUuid(attUuid);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting attachment:", error);
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  },
};
