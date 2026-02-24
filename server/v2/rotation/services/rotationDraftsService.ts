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
import { getDb } from "../../db";
import { masterVessels } from "../../../../shared/schema";
import { eq } from "drizzle-orm";

const crewMembersRepository = new CrewMembersRepository();

function applyAuditUser<T extends object>(data: T, isCreate = false): T & { createdByUuid?: string | null; updatedByUuid?: string | null } {
  const auditUserUuid = (data as any).auditUserUuid || null;
  const result = { ...data } as any;
  delete result.auditUserUuid;
  
  if (isCreate) {
    result.createdByUuid = auditUserUuid;
  }
  result.updatedByUuid = auditUserUuid;
  
  return result;
}

// V2 helper: Get vessel name from master_vessels table by UUID
async function getVesselNameByUuid(vesselUuid: string): Promise<string> {
  try {
    const db = getDb();
    const result = await db
      .select({ vessel: masterVessels.vessel })
      .from(masterVessels)
      .where(eq(masterVessels.vesselUuid, vesselUuid))
      .limit(1);
    
    if (result.length > 0 && result[0].vessel) {
      return result[0].vessel;
    }
    return vesselUuid; // Fallback to UUID if not found
  } catch (error) {
    console.error('Error fetching vessel name:', error);
    return vesselUuid;
  }
}

export const rotationDraftsService = {
  async getAll(filters?: { planStatus?: string }) {
    const drafts = await rotationDraftsRepository.findAll(filters);
    
    // Enrich each draft with vessel names and rank names for the list view
    const enrichedDrafts = await Promise.all(
      drafts.map(async (draft) => {
        const vessels = await rotationDraftVesselsRepository.findByDraftUuid(draft.draftUuid);
        const ranks = await rotationDraftRanksRepository.findByDraftUuid(draft.draftUuid);
        
        // Translate vessel UUIDs to human-readable names from master_vessels table
        const vesselNamePromises = vessels.map(v => getVesselNameByUuid(v.vesselUuid));
        const vesselNamesList = await Promise.all(vesselNamePromises);
        const vesselNames = vesselNamesList.join(', ') || '—';
        
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
        
        const vesselName = entry.vesselUuid ? await getVesselNameByUuid(entry.vesselUuid) : 'Unknown Vessel';
        
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

  async create(data: Omit<InsertRotationDraftsV2, "draftUuid" | "draftId"> & { vessels?: string; crew?: string; assignments?: string; auditUserUuid?: string }) {
    // Extract vessels, crew, and assignments from data before creating draft
    const { vessels: vesselsJson, crew: crewString, assignments: assignmentsJson, ...draftData } = data;
    
    // Apply audit user fields
    const auditedDraftData = applyAuditUser(draftData, true);
    
    // Create the draft first
    const draft = await rotationDraftsRepository.create(auditedDraftData);
    
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

  async update(draftUuid: string, data: Partial<InsertRotationDraftsV2> & { vessels?: string; crew?: string; assignments?: string; auditUserUuid?: string }) {
    const existing = await rotationDraftsRepository.findByDraftUuid(draftUuid);
    if (!existing) {
      throw new Error(`Draft not found: ${draftUuid}`);
    }
    
    // Extract vessels, crew, and assignments from data
    const { vessels: vesselsJson, crew: crewString, assignments: assignmentsJson, ...rawDraftData } = data;
    
    // Apply audit user fields
    const draftData = applyAuditUser(rawDraftData, false);
    
    // UPSERT LOGIC: Update existing records, create new ones, soft-delete removed ones
    
    // Update vessels if provided using UPSERT pattern with reactivation
    if (vesselsJson !== undefined) {
      try {
        const vesselUuids: string[] = JSON.parse(vesselsJson);
        // Get ALL vessels including soft-deleted to enable reactivation
        const allVessels = await rotationDraftVesselsRepository.findAllByDraftUuid(draftUuid, true);
        const activeVessels = allVessels.filter(v => !v.isDeleted);
        const deletedVesselMap = new Map(allVessels.filter(v => v.isDeleted).map(v => [v.vesselUuid, v]));
        const activeVesselMap = new Map(activeVessels.map(v => [v.vesselUuid, v]));
        const incomingVesselSet = new Set(vesselUuids);
        
        // Update existing, reactivate deleted, or create new vessels
        for (let i = 0; i < vesselUuids.length; i++) {
          const vesselUuid = vesselUuids[i];
          const activeVessel = activeVesselMap.get(vesselUuid);
          const deletedVessel = deletedVesselMap.get(vesselUuid);
          
          if (activeVessel) {
            // Update existing active record
            await rotationDraftVesselsRepository.update(activeVessel.rvUuid, { sortOrder: i });
          } else if (deletedVessel) {
            // Reactivate soft-deleted record
            await rotationDraftVesselsRepository.reactivate(deletedVessel.rvUuid, { sortOrder: i });
          } else {
            // Create new record
            await rotationDraftVesselsRepository.create({
              draftUuid,
              vesselUuid,
              sortOrder: i,
            });
          }
        }
        
        // Soft-delete active vessels that are no longer in the list
        for (const activeVessel of activeVessels) {
          if (!incomingVesselSet.has(activeVessel.vesselUuid)) {
            await rotationDraftVesselsRepository.softDelete(activeVessel.rvUuid);
          }
        }
      } catch (e) {
        console.error("Failed to parse vessels JSON:", e);
      }
    }
    
    // Update ranks if provided using UPSERT pattern with reactivation
    if (crewString !== undefined) {
      const rankNames = crewString.split(',').map(r => r.trim()).filter(r => r);
      // Get ALL ranks including soft-deleted to enable reactivation
      const allRanks = await rotationDraftRanksRepository.findAllByDraftUuid(draftUuid, true);
      const activeRanks = allRanks.filter(r => !r.isDeleted);
      const deletedRankMap = new Map(allRanks.filter(r => r.isDeleted).map(r => [r.rankName, r]));
      const activeRankMap = new Map(activeRanks.map(r => [r.rankName, r]));
      const incomingRankSet = new Set(rankNames);
      
      // Update existing, reactivate deleted, or create new ranks
      for (let i = 0; i < rankNames.length; i++) {
        const rankName = rankNames[i];
        const activeRank = activeRankMap.get(rankName);
        const deletedRank = deletedRankMap.get(rankName);
        
        if (activeRank) {
          // Update existing active record
          await rotationDraftRanksRepository.update(activeRank.rrUuid, { sortOrder: i });
        } else if (deletedRank) {
          // Reactivate soft-deleted record
          await rotationDraftRanksRepository.reactivate(deletedRank.rrUuid, { sortOrder: i });
        } else {
          // Create new record
          await rotationDraftRanksRepository.create({
            draftUuid,
            rankName,
            sortOrder: i,
          });
        }
      }
      
      // Soft-delete active ranks that are no longer in the list
      for (const activeRank of activeRanks) {
        if (!incomingRankSet.has(activeRank.rankName)) {
          await rotationDraftRanksRepository.softDelete(activeRank.rrUuid);
        }
      }
    }
    
    // Update assignments if provided using UPSERT pattern with reactivation
    if (assignmentsJson !== undefined) {
      try {
        const assignments = JSON.parse(assignmentsJson);
        // Get ALL entries including soft-deleted to enable reactivation
        const allEntries = await rotationEntriesRepository.findAllByDraftUuid(draftUuid, true);
        const activeEntries = allEntries.filter(e => !e.isDeleted);
        const deletedEntries = allEntries.filter(e => e.isDeleted);
        
        // Build maps by entryUuid for direct lookup
        const activeByUuid = new Map(activeEntries.map(e => [e.entryUuid, e]));
        const deletedByUuid = new Map(deletedEntries.map(e => [e.entryUuid, e]));
        
        // Build maps by composite key (vesselUuid|rank|crewUuid) for fallback
        // For null crewUuid, use array to handle multiple entries with same vessel/rank
        const activeByCompositeKey = new Map<string, any[]>();
        for (const e of activeEntries) {
          const key = `${e.vesselUuid}|${e.rank}|${e.crewUuid || ''}`;
          if (!activeByCompositeKey.has(key)) activeByCompositeKey.set(key, []);
          activeByCompositeKey.get(key)!.push(e);
        }
        const deletedByCompositeKey = new Map<string, any[]>();
        for (const e of deletedEntries) {
          const key = `${e.vesselUuid}|${e.rank}|${e.crewUuid || ''}`;
          if (!deletedByCompositeKey.has(key)) deletedByCompositeKey.set(key, []);
          deletedByCompositeKey.get(key)!.push(e);
        }
        
        const processedEntryUuids = new Set<string>();
        
        // Update existing, reactivate deleted, or create new entries
        for (let idx = 0; idx < assignments.length; idx++) {
          const assignment = assignments[idx];
          const vesselUuid = assignment.vesselUuid || assignment.vessel;
          const compositeKey = `${vesselUuid}|${assignment.rank}|${assignment.crewUuid || ''}`;
          
          // Try to find existing entry by entryUuid first (most reliable)
          let existingEntry = assignment.entryUuid ? activeByUuid.get(assignment.entryUuid) : undefined;
          let deletedEntry = assignment.entryUuid ? deletedByUuid.get(assignment.entryUuid) : undefined;
          
          // Fallback to composite key match (take first unprocessed from array)
          if (!existingEntry && !deletedEntry) {
            const activeMatches = activeByCompositeKey.get(compositeKey) || [];
            existingEntry = activeMatches.find(e => !processedEntryUuids.has(e.entryUuid));
            
            if (!existingEntry) {
              const deletedMatches = deletedByCompositeKey.get(compositeKey) || [];
              deletedEntry = deletedMatches.find(e => !processedEntryUuids.has(e.entryUuid));
            }
          }
          
          const entryData = {
            vesselUuid,
            rank: assignment.rank,
            rankId: assignment.rankId,
            crewUuid: assignment.crewUuid,
            signOnDate: assignment.joiningDate,
            contractPeriod: assignment.contractPeriod || 3,
          };
          
          if (existingEntry) {
            // Update existing active record
            processedEntryUuids.add(existingEntry.entryUuid);
            await rotationEntriesRepository.update(existingEntry.entryUuid, entryData);
          } else if (deletedEntry) {
            // Reactivate soft-deleted record
            processedEntryUuids.add(deletedEntry.entryUuid);
            await rotationEntriesRepository.reactivate(deletedEntry.entryUuid, entryData);
          } else {
            // Create new record
            const newEntry = await rotationEntriesRepository.create({
              draftUuid,
              ...entryData,
            });
            processedEntryUuids.add(newEntry.entryUuid);
          }
        }
        
        // Soft-delete active entries that are no longer in the list
        for (const activeEntry of activeEntries) {
          if (!processedEntryUuids.has(activeEntry.entryUuid)) {
            await rotationEntriesRepository.softDelete(activeEntry.entryUuid);
          }
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

  async getProposals(filters?: { vessels?: string[]; ranks?: string[]; draftId?: string; dateFrom?: string; dateTo?: string; archived?: boolean }) {
    // Get all drafts without status filter (we'll filter in memory to include both Proposed and Partially Approved)
    const allDrafts = await rotationDraftsRepository.findAll();
    
    // Filter to only include Proposed, Partially Approved, or Completed (for archived view)
    const filteredDrafts = allDrafts.filter(draft => {
      const status = draft.planStatus;
      if (filters?.archived) {
        return status === "Proposed" || status === "Partially Approved" || status === "Completed";
      }
      return status === "Proposed" || status === "Partially Approved";
    });
    
    // Get all entries for these drafts and flatten into proposals
    const proposals: any[] = [];
    
    for (const draft of filteredDrafts) {
      // Filter by draftId if provided
      if (filters?.draftId && draft.draftId !== filters.draftId) {
        continue;
      }
      
      const rawEntries = await rotationEntriesRepository.findByDraftUuid(draft.draftUuid);
      
      for (const entry of rawEntries) {
        // Filter by vessels
        if (filters?.vessels && filters.vessels.length > 0 && entry.vesselUuid) {
          if (!filters.vessels.includes(entry.vesselUuid)) {
            continue;
          }
        }
        
        // Filter by ranks
        if (filters?.ranks && filters.ranks.length > 0 && entry.rank) {
          if (!filters.ranks.includes(entry.rank)) {
            continue;
          }
        }
        
        // Filter by date range
        if (filters?.dateFrom && entry.signOnDate) {
          if (entry.signOnDate < filters.dateFrom) {
            continue;
          }
        }
        if (filters?.dateTo && entry.signOnDate) {
          if (entry.signOnDate > filters.dateTo) {
            continue;
          }
        }
        
        // For archived view, only include deployed/rejected entries
        // For active view, exclude deployed/rejected entries
        const proposalStatus = entry.proposalStatus?.toLowerCase() || '';
        const isEntryArchived = proposalStatus === "deployed" || proposalStatus === "rejected";
        
        if (filters?.archived && !isEntryArchived) {
          continue;
        }
        if (!filters?.archived && isEntryArchived) {
          continue;
        }
        
        // Enrich with crew name
        let crewName = 'Unknown Crew';
        if (entry.crewUuid) {
          const crew = await crewMembersRepository.findByUuid(entry.crewUuid);
          if (crew) {
            crewName = `${crew.firstName || ''} ${crew.familyName || ''}`.trim() || 'Unknown Crew';
          }
        }
        
        // Get vessel name
        const vesselName = entry.vesselUuid ? await getVesselNameByUuid(entry.vesselUuid) : 'Unknown Vessel';
        
        // Determine the archived date (deployedDate for deployed entries)
        // and capitalize result for display (Deployed, Rejected)
        let displayResult = entry.proposalStatus;
        if (entry.proposalStatus?.toLowerCase() === 'deployed') {
          displayResult = 'Deployed';
        } else if (entry.proposalStatus?.toLowerCase() === 'rejected') {
          displayResult = 'Rejected';
        }
        
        // Use deployedDate as archivedDate for archived entries
        const archivedDate = entry.deployedDate || null;
        
        proposals.push({
          // Entry identifiers
          entryUuid: entry.entryUuid,
          draftUuid: draft.draftUuid,
          draftId: draft.draftId,
          // Legacy compatibility - V1 uses planId (numeric) and assignmentIndex
          planId: draft.id,
          assignmentIndex: entry.id,
          // Core assignment data
          vessel: vesselName,
          vesselId: entry.vesselUuid,
          vesselUuid: entry.vesselUuid,
          rank: entry.rank,
          rankId: entry.rankId,
          crewId: entry.crewUuid,
          crewUuid: entry.crewUuid,
          crewMemberId: entry.crewUuid,
          crewName,
          signOnDate: entry.signOnDate,
          joiningDate: entry.signOnDate, // Timeline uses joiningDate
          contractPeriod: entry.contractPeriod || 6,
          // Proposal metadata
          proposedBy: draft.proposedByUuid || 'Unknown',
          proposedDate: draft.proposedDate,
          // Entry status
          proposalStatus: entry.proposalStatus,
          result: displayResult,
          // Archived date (for archived view)
          archivedDate: archivedDate,
        });
      }
    }
    
    return proposals;
  },

  async archiveDraft(draftUuid: string) {
    const existing = await rotationDraftsRepository.findByDraftUuid(draftUuid);
    if (!existing) {
      throw new Error(`Draft not found: ${draftUuid}`);
    }
    if (existing.planStatus === "Archived") {
      throw new Error(`Draft is already archived: ${draftUuid}`);
    }
    return rotationDraftsRepository.update(draftUuid, {
      previousPlanStatus: existing.planStatus,
      planStatus: "Archived",
    });
  },

  async unarchiveDraft(draftUuid: string) {
    const existing = await rotationDraftsRepository.findByDraftUuid(draftUuid);
    if (!existing) {
      throw new Error(`Draft not found: ${draftUuid}`);
    }
    if (existing.planStatus !== "Archived") {
      throw new Error(`Draft is not archived: ${draftUuid}`);
    }
    const restoreStatus = existing.previousPlanStatus || "In Draft";
    return rotationDraftsRepository.update(draftUuid, {
      planStatus: restoreStatus,
      previousPlanStatus: null,
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

  async create(data: Omit<InsertRotationEntriesV2, "entryUuid"> & { auditUserUuid?: string }) {
    const auditedData = applyAuditUser(data, true);
    return rotationEntriesRepository.create(auditedData);
  },

  async update(entryUuid: string, data: Partial<InsertRotationEntriesV2> & { auditUserUuid?: string }) {
    const existing = await rotationEntriesRepository.findByEntryUuid(entryUuid);
    if (!existing) {
      throw new Error(`Entry not found: ${entryUuid}`);
    }
    const auditedData = applyAuditUser(data, false);
    return rotationEntriesRepository.update(entryUuid, auditedData);
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
