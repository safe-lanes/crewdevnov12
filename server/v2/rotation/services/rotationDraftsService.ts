import { 
  rotationDraftsRepository, 
  rotationDraftVesselsRepository, 
  rotationDraftRanksRepository 
} from "../repositories";
import { rotationEntriesRepository, rotationArchiveRepository } from "../repositories";
import { CrewMembersRepository } from "../../crew-pool/repositories";
import type { 
  RotationDraftsV2, 
  InsertRotationDraftsV2,
  InsertRotationDraftVesselsV2,
  InsertRotationDraftRanksV2,
  InsertRotationEntriesV2
} from "../../../../shared/v2/rotation/schema";
import { translateVesselCodeToName } from "../../../storage";

const crewMembersRepository = new CrewMembersRepository();

export const rotationDraftsService = {
  async getAll(filters?: { planStatus?: string }) {
    const drafts = await rotationDraftsRepository.findAll(filters);
    
    // Enrich each draft with vessel names and rank names for the list view
    const enrichedDrafts = await Promise.all(
      drafts.map(async (draft) => {
        const vessels = await rotationDraftVesselsRepository.findByDraftUuid(draft.draftUuid);
        const ranks = await rotationDraftRanksRepository.findByDraftUuid(draft.draftUuid);
        
        // Translate vessel UUIDs to human-readable names
        const vesselNames = vessels.map(v => translateVesselCodeToName(v.vesselUuid)).join(', ') || '—';
        
        return {
          ...draft,
          vesselNames,
          crewRanks: ranks.map(r => r.rankName).join(', ') || '—',
          createdByName: 'Current User', // Placeholder - user lookup not yet implemented
        };
      })
    );
    
    return enrichedDrafts;
  },

  async getByDraftUuid(draftUuid: string) {
    const draft = await rotationDraftsRepository.findByDraftUuid(draftUuid);
    if (!draft) {
      throw new Error(`Draft not found: ${draftUuid}`);
    }

    const vessels = await rotationDraftVesselsRepository.findByDraftUuid(draftUuid);
    const ranks = await rotationDraftRanksRepository.findByDraftUuid(draftUuid);
    const rawEntries = await rotationEntriesRepository.findByDraftUuid(draftUuid);
    
    // Enrich entries with crew names and vessel names
    const entries = await Promise.all(
      rawEntries.map(async (entry) => {
        let crewName = 'Unknown Crew';
        if (entry.crewUuid) {
          const crew = await crewMembersRepository.findByUuid(entry.crewUuid);
          if (crew) {
            crewName = `${crew.firstName || ''} ${crew.familyName || ''}`.trim() || 'Unknown Crew';
          }
        }
        
        const vesselName = entry.vesselUuid ? translateVesselCodeToName(entry.vesselUuid) : 'Unknown Vessel';
        
        return {
          ...entry,
          crewName,
          vesselName,
        };
      })
    );

    return {
      ...draft,
      vessels,
      ranks,
      entries,
    };
  },

  async create(data: Omit<InsertRotationDraftsV2, "draftUuid" | "draftId"> & { vessels?: string; crew?: string; assignments?: string }) {
    // Extract vessels, crew, and assignments from data before creating draft
    const { vessels: vesselsJson, crew: crewString, assignments: assignmentsJson, ...draftData } = data;
    
    // Create the draft first
    const draft = await rotationDraftsRepository.create(draftData);
    
    // Save vessels to child table
    if (vesselsJson) {
      try {
        const vesselUuids: string[] = JSON.parse(vesselsJson);
        for (let i = 0; i < vesselUuids.length; i++) {
          await rotationDraftVesselsRepository.create({
            draftUuid: draft.draftUuid,
            vesselUuid: vesselUuids[i],
            sortOrder: i,
          });
        }
      } catch (e) {
        console.error("Failed to parse vessels JSON:", e);
      }
    }
    
    // Save ranks to child table
    if (crewString) {
      const rankNames = crewString.split(',').map(r => r.trim()).filter(r => r);
      for (let i = 0; i < rankNames.length; i++) {
        await rotationDraftRanksRepository.create({
          draftUuid: draft.draftUuid,
          rankName: rankNames[i],
          sortOrder: i,
        });
      }
    }
    
    // Save assignments to entries table
    if (assignmentsJson) {
      try {
        const assignments = JSON.parse(assignmentsJson);
        for (const assignment of assignments) {
          await rotationEntriesRepository.create({
            draftUuid: draft.draftUuid,
            vesselUuid: assignment.vesselUuid || assignment.vessel,
            rank: assignment.rank,
            rankId: assignment.rankId,
            crewUuid: assignment.crewUuid,
            signOnDate: assignment.joiningDate,
            contractPeriod: assignment.contractPeriod || 3,
          });
        }
      } catch (e) {
        console.error("Failed to parse assignments JSON:", e);
      }
    }
    
    return draft;
  },

  async update(draftUuid: string, data: Partial<InsertRotationDraftsV2> & { vessels?: string; crew?: string; assignments?: string }) {
    const existing = await rotationDraftsRepository.findByDraftUuid(draftUuid);
    if (!existing) {
      throw new Error(`Draft not found: ${draftUuid}`);
    }
    
    // Extract vessels, crew, and assignments from data
    const { vessels: vesselsJson, crew: crewString, assignments: assignmentsJson, ...draftData } = data;
    
    // Update vessels if provided (replace all)
    if (vesselsJson !== undefined) {
      // Delete existing vessels for this draft
      const existingVessels = await rotationDraftVesselsRepository.findByDraftUuid(draftUuid);
      for (const v of existingVessels) {
        await rotationDraftVesselsRepository.softDelete(v.rvUuid);
      }
      
      // Add new vessels
      try {
        const vesselUuids: string[] = JSON.parse(vesselsJson);
        for (let i = 0; i < vesselUuids.length; i++) {
          await rotationDraftVesselsRepository.create({
            draftUuid,
            vesselUuid: vesselUuids[i],
            sortOrder: i,
          });
        }
      } catch (e) {
        console.error("Failed to parse vessels JSON:", e);
      }
    }
    
    // Update ranks if provided (replace all)
    if (crewString !== undefined) {
      // Delete existing ranks for this draft
      const existingRanks = await rotationDraftRanksRepository.findByDraftUuid(draftUuid);
      for (const r of existingRanks) {
        await rotationDraftRanksRepository.softDelete(r.rrUuid);
      }
      
      // Add new ranks
      const rankNames = crewString.split(',').map(r => r.trim()).filter(r => r);
      for (let i = 0; i < rankNames.length; i++) {
        await rotationDraftRanksRepository.create({
          draftUuid,
          rankName: rankNames[i],
          sortOrder: i,
        });
      }
    }
    
    // Update assignments if provided (replace all)
    if (assignmentsJson !== undefined) {
      // Delete existing entries for this draft
      const existingEntries = await rotationEntriesRepository.findByDraftUuid(draftUuid);
      for (const e of existingEntries) {
        await rotationEntriesRepository.softDelete(e.entryUuid);
      }
      
      // Add new assignments
      try {
        const assignments = JSON.parse(assignmentsJson);
        for (const assignment of assignments) {
          await rotationEntriesRepository.create({
            draftUuid,
            vesselUuid: assignment.vesselUuid || assignment.vessel,
            rank: assignment.rank,
            rankId: assignment.rankId,
            crewUuid: assignment.crewUuid,
            signOnDate: assignment.joiningDate,
            contractPeriod: assignment.contractPeriod || 3,
          });
        }
      } catch (e) {
        console.error("Failed to parse assignments JSON:", e);
      }
    }
    
    return rotationDraftsRepository.update(draftUuid, draftData);
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
