import {
  CrewDocumentsRepository,
  type CrewDocumentWithAttachments,
} from "../repositories";
import { crewMembersService } from "./crewMembersService";
import type {
  InsertCrewDocument,
  CrewDocument,
  InsertCrewDocumentAttachment,
  CrewDocumentAttachment,
} from "../../../../shared/v2/crew-pool/types";

const crewDocumentsRepository = new CrewDocumentsRepository();

export const crewDocumentsService = {
  async getAll(crewUuid: string): Promise<CrewDocumentWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewDocumentsRepository.findByCrewUuidWithAttachments(crewUuid);
  },

  async getByUuid(docUuid: string): Promise<CrewDocument> {
    const doc = await crewDocumentsRepository.findByUuid(docUuid);
    if (!doc) {
      throw new Error(`Document not found: ${docUuid}`);
    }
    return doc;
  },

  async create(
    crewUuid: string,
    data: Omit<InsertCrewDocument, "docUuid" | "crewUuid">
  ): Promise<CrewDocument> {
    await crewMembersService.getByUuid(crewUuid);

    if (!data.documentName && !data.documentId) {
      throw new Error("Document name or ID is required");
    }

    return crewDocumentsRepository.create({ ...data, crewUuid });
  },

  async update(
    docUuid: string,
    data: Partial<InsertCrewDocument>
  ): Promise<CrewDocument> {
    await this.getByUuid(docUuid);

    const updated = await crewDocumentsRepository.update(docUuid, data);
    if (!updated) {
      throw new Error(`Failed to update document: ${docUuid}`);
    }
    return updated;
  },

  async delete(docUuid: string): Promise<void> {
    await this.getByUuid(docUuid);
    const success = await crewDocumentsRepository.softDelete(docUuid);
    if (!success) {
      throw new Error(`Failed to delete document: ${docUuid}`);
    }
  },

  async getAttachments(docUuid: string): Promise<CrewDocumentAttachment[]> {
    await this.getByUuid(docUuid);
    return crewDocumentsRepository.findAttachmentsByDocUuid(docUuid);
  },

  async addAttachment(
    docUuid: string,
    file: Omit<InsertCrewDocumentAttachment, "attUuid" | "docUuid">
  ): Promise<CrewDocumentAttachment> {
    await this.getByUuid(docUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewDocumentsRepository.addAttachment({ ...file, docUuid });
  },

  async removeAttachment(attUuid: string): Promise<void> {
    const success = await crewDocumentsRepository.softDeleteAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
  },
};
