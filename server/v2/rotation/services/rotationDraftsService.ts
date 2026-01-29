import { 
  rotationDraftsRepository, 
  rotationDraftVesselsRepository, 
  rotationDraftRanksRepository 
} from "../repositories";
import { rotationEntriesRepository, rotationArchiveRepository } from "../repositories";
import type { 
  RotationDraftsV2, 
  InsertRotationDraftsV2,
  InsertRotationDraftVesselsV2,
  InsertRotationDraftRanksV2,
  InsertRotationEntriesV2
} from "../../../../shared/v2/rotation/schema";

export const rotationDraftsService = {
  async getAll(filters?: { planStatus?: string }) {
    return rotationDraftsRepository.findAll(filters);
  },

  async getByDraftUuid(draftUuid: string) {
    const draft = await rotationDraftsRepository.findByDraftUuid(draftUuid);
    if (!draft) {
      throw new Error(`Draft not found: ${draftUuid}`);
    }

    const vessels = await rotationDraftVesselsRepository.findByDraftUuid(draftUuid);
    const ranks = await rotationDraftRanksRepository.findByDraftUuid(draftUuid);
    const entries = await rotationEntriesRepository.findByDraftUuid(draftUuid);

    return {
      ...draft,
      vessels,
      ranks,
      entries,
    };
  },

  async create(data: Omit<InsertRotationDraftsV2, "draftUuid">) {
    return rotationDraftsRepository.create(data);
  },

  async update(draftUuid: string, data: Partial<InsertRotationDraftsV2>) {
    const existing = await rotationDraftsRepository.findByDraftUuid(draftUuid);
    if (!existing) {
      throw new Error(`Draft not found: ${draftUuid}`);
    }
    return rotationDraftsRepository.update(draftUuid, data);
  },

  async addVessel(draftUuid: string, data: Omit<InsertRotationDraftVesselsV2, "rvUuid" | "draftUuid">) {
    const existing = await rotationDraftsRepository.findByDraftUuid(draftUuid);
    if (!existing) {
      throw new Error(`Draft not found: ${draftUuid}`);
    }
    return rotationDraftVesselsRepository.create({ ...data, draftUuid });
  },

  async removeVessel(rvUuid: string) {
    return rotationDraftVesselsRepository.softDelete(rvUuid);
  },

  async addRank(draftUuid: string, data: Omit<InsertRotationDraftRanksV2, "rrUuid" | "draftUuid">) {
    const existing = await rotationDraftsRepository.findByDraftUuid(draftUuid);
    if (!existing) {
      throw new Error(`Draft not found: ${draftUuid}`);
    }
    return rotationDraftRanksRepository.create({ ...data, draftUuid });
  },

  async removeRank(rrUuid: string) {
    return rotationDraftRanksRepository.softDelete(rrUuid);
  },

  async proposeDraft(draftUuid: string, proposedByUuid: string) {
    const existing = await rotationDraftsRepository.findByDraftUuid(draftUuid);
    if (!existing) {
      throw new Error(`Draft not found: ${draftUuid}`);
    }
    return rotationDraftsRepository.update(draftUuid, {
      planStatus: "Proposed",
      proposedByUuid,
      proposedDate: new Date().toISOString().split("T")[0],
    });
  },

  async deleteDraft(draftUuid: string) {
    return rotationDraftsRepository.softDelete(draftUuid);
  },
};

export const rotationEntriesService = {
  async getByDraftUuid(draftUuid: string) {
    return rotationEntriesRepository.findByDraftUuid(draftUuid);
  },

  async getByEntryUuid(entryUuid: string) {
    const entry = await rotationEntriesRepository.findByEntryUuid(entryUuid);
    if (!entry) {
      throw new Error(`Entry not found: ${entryUuid}`);
    }
    return entry;
  },

  async create(data: Omit<InsertRotationEntriesV2, "entryUuid">) {
    return rotationEntriesRepository.create(data);
  },

  async update(entryUuid: string, data: Partial<InsertRotationEntriesV2>) {
    const existing = await rotationEntriesRepository.findByEntryUuid(entryUuid);
    if (!existing) {
      throw new Error(`Entry not found: ${entryUuid}`);
    }
    return rotationEntriesRepository.update(entryUuid, data);
  },

  async delete(entryUuid: string) {
    return rotationEntriesRepository.softDelete(entryUuid);
  },
};

export const rotationArchiveService = {
  async getAll(filters?: { result?: string; vesselUuid?: string }) {
    return rotationArchiveRepository.findAll(filters);
  },
};
