import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { masterVesselTypes, masterFleetGroups } from "../../../../shared/schema";
import {
  approvalsService,
  suitabilityService,
  recruitmentDecisionService,
} from "../services/approvalsService";

// Resolve vessel type name/UUID to the actual vtUuid from master_vessel_types
async function resolveVesselTypeUuid(value: string): Promise<string | null> {
  if (!value) return null;
  
  const db = getDb();
  // First check if it's already a UUID (from master_vessel_types.vt_uuid)
  const byUuid = await db.select().from(masterVesselTypes)
    .where(eq(masterVesselTypes.vtUuid, value))
    .limit(1);
  if (byUuid.length > 0 && byUuid[0].vtUuid) {
    return byUuid[0].vtUuid;
  }
  
  // Otherwise try to match by vessel type name
  const byName = await db.select().from(masterVesselTypes)
    .where(eq(masterVesselTypes.vesselType, value))
    .limit(1);
  if (byName.length > 0 && byName[0].vtUuid) {
    return byName[0].vtUuid;
  }
  
  return null;
}

// Resolve fleet group name/UUID to the actual fgUuid from master_fleet_groups
async function resolveFleetGroupUuid(value: string): Promise<string | null> {
  if (!value) return null;
  
  const db = getDb();
  // First check if it's already a UUID (from master_fleet_groups.fg_uuid)
  const byUuid = await db.select().from(masterFleetGroups)
    .where(eq(masterFleetGroups.fgUuid, value))
    .limit(1);
  if (byUuid.length > 0 && byUuid[0].fgUuid) {
    return byUuid[0].fgUuid;
  }
  
  // Otherwise try to match by name
  const byName = await db.select().from(masterFleetGroups)
    .where(eq(masterFleetGroups.name, value))
    .limit(1);
  if (byName.length > 0 && byName[0].fgUuid) {
    return byName[0].fgUuid;
  }
  
  return null;
}

export const approvalsController = {
  async getApprovals(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await approvalsService.getApprovals(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting approvals:", error);
      res.status(500).json({ error: "Failed to get approvals" });
    }
  },

  async createApproval(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const result = await approvalsService.createApproval(recCanUuid, { ...req.body, auditUserUuid });
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating approval:", error);
      res.status(500).json({ error: "Failed to create approval" });
    }
  },

  async updateApproval(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const result = await approvalsService.updateApproval(id, { ...req.body, auditUserUuid });
      if (!result) return res.status(404).json({ error: "Not found" });
      res.json(result);
    } catch (error) {
      console.error("Error updating approval:", error);
      res.status(500).json({ error: "Failed to update approval" });
    }
  },

  async deleteApproval(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const result = await approvalsService.deleteApproval(id);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting approval:", error);
      res.status(500).json({ error: "Failed to delete approval" });
    }
  },
};

export const suitabilityController = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      // Return suitability with vessel types and fleet groups for proper data binding
      const result = await suitabilityService.getSuitabilityWithRelations(recCanUuid);
      res.json(result || {});
    } catch (error) {
      console.error("Error getting suitability:", error);
      res.status(500).json({ error: "Failed to get suitability" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const { vesselTypes, fleetGroups, ...suitabilityData } = req.body;
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      
      // Upsert the main suitability record
      const result = await suitabilityService.upsertSuitability(recCanUuid, { ...suitabilityData, auditUserUuid });
      
      // Handle vessel types if provided - use reconciliation pattern
      if (vesselTypes && Array.isArray(vesselTypes) && result.suitUuid) {
        // Resolve all incoming vessel type UUIDs
        const resolvedIncoming: string[] = [];
        for (const vt of vesselTypes) {
          if (vt.vesselTypeUuid) {
            const resolvedUuid = await resolveVesselTypeUuid(vt.vesselTypeUuid);
            if (resolvedUuid) {
              resolvedIncoming.push(resolvedUuid);
            }
          }
        }
        
        // Get existing vessel types
        const existingVesselTypes = await suitabilityService.getVesselTypes(result.suitUuid);
        const existingUuids = existingVesselTypes.map(vt => vt.vesselTypeUuid).filter((u): u is string => !!u);
        
        // Calculate diff: what to add and what to remove
        const toAdd = resolvedIncoming.filter(uuid => !existingUuids.includes(uuid));
        const toRemove = existingVesselTypes.filter(vt => vt.vesselTypeUuid && !resolvedIncoming.includes(vt.vesselTypeUuid));
        
        // Remove obsolete vessel types
        for (const vt of toRemove) {
          await suitabilityService.softDeleteVesselType(vt.svtUuid);
        }
        
        // Add new vessel types with sort order
        for (const uuid of toAdd) {
          const sortOrder = resolvedIncoming.indexOf(uuid);
          await suitabilityService.addVesselType(result.suitUuid, uuid, undefined, auditUserUuid, sortOrder);
        }

        // Update sort order for all kept items
        for (let i = 0; i < resolvedIncoming.length; i++) {
          if (!toAdd.includes(resolvedIncoming[i])) {
            await suitabilityService.updateVesselTypeSortOrder(result.suitUuid, resolvedIncoming[i], i);
          }
        }
      }
      
      // Handle fleet groups if provided - use reconciliation pattern
      if (fleetGroups && Array.isArray(fleetGroups) && result.suitUuid) {
        // Resolve all incoming fleet group UUIDs
        const resolvedIncoming: string[] = [];
        for (const fg of fleetGroups) {
          if (fg.fleetGroupUuid) {
            const resolvedUuid = await resolveFleetGroupUuid(fg.fleetGroupUuid);
            if (resolvedUuid) {
              resolvedIncoming.push(resolvedUuid);
            }
          }
        }
        
        // Get existing fleet groups
        const existingFleetGroups = await suitabilityService.getFleetGroups(result.suitUuid);
        const existingUuids = existingFleetGroups.map(fg => fg.fleetGroupUuid).filter((u): u is string => !!u);
        
        // Calculate diff: what to add and what to remove
        const toAdd = resolvedIncoming.filter(uuid => !existingUuids.includes(uuid));
        const toRemove = existingFleetGroups.filter(fg => fg.fleetGroupUuid && !resolvedIncoming.includes(fg.fleetGroupUuid));
        
        // Remove obsolete fleet groups
        for (const fg of toRemove) {
          await suitabilityService.softDeleteFleetGroup(fg.sfgUuid);
        }
        
        // Add new fleet groups with sort order
        for (const uuid of toAdd) {
          const sortOrder = resolvedIncoming.indexOf(uuid);
          await suitabilityService.addFleetGroup(result.suitUuid, uuid, undefined, auditUserUuid, sortOrder);
        }

        // Update sort order for all kept items
        for (let i = 0; i < resolvedIncoming.length; i++) {
          if (!toAdd.includes(resolvedIncoming[i])) {
            await suitabilityService.updateFleetGroupSortOrder(result.suitUuid, resolvedIncoming[i], i);
          }
        }
      }
      
      // Return the suitability with vessel types and fleet groups
      const finalResult = await suitabilityService.getSuitabilityWithRelations(recCanUuid);
      res.json(finalResult || result);
    } catch (error) {
      console.error("Error upserting suitability:", error);
      res.status(500).json({ error: "Failed to upsert suitability" });
    }
  },

  async getVesselTypes(req: Request, res: Response) {
    try {
      const { suitUuid } = req.params;
      const result = await suitabilityService.getVesselTypes(suitUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting vessel types:", error);
      res.status(500).json({ error: "Failed to get vessel types" });
    }
  },

  async addVesselType(req: Request, res: Response) {
    try {
      const { suitUuid } = req.params;
      const { vesselTypeUuid } = req.body;
      // Resolve the value to actual vtUuid from master_vessel_types
      const resolvedUuid = await resolveVesselTypeUuid(vesselTypeUuid);
      if (!resolvedUuid) {
        return res.status(400).json({ error: `Could not resolve vessel type: ${vesselTypeUuid}` });
      }
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const result = await suitabilityService.addVesselType(suitUuid, resolvedUuid, undefined, auditUserUuid);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error adding vessel type:", error);
      res.status(500).json({ error: "Failed to add vessel type" });
    }
  },

  async getFleetGroups(req: Request, res: Response) {
    try {
      const { suitUuid } = req.params;
      const result = await suitabilityService.getFleetGroups(suitUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting fleet groups:", error);
      res.status(500).json({ error: "Failed to get fleet groups" });
    }
  },

  async addFleetGroup(req: Request, res: Response) {
    try {
      const { suitUuid } = req.params;
      const { fleetGroupUuid } = req.body;
      // Resolve the value to actual fgUuid from master_fleet_groups
      const resolvedUuid = await resolveFleetGroupUuid(fleetGroupUuid);
      if (!resolvedUuid) {
        return res.status(400).json({ error: `Could not resolve fleet group: ${fleetGroupUuid}` });
      }
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const result = await suitabilityService.addFleetGroup(suitUuid, resolvedUuid, undefined, auditUserUuid);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error adding fleet group:", error);
      res.status(500).json({ error: "Failed to add fleet group" });
    }
  },
};

export const recruitmentDecisionController = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      // Return decision with assigned groups for proper data binding
      const result = await recruitmentDecisionService.getDecisionWithRelations(recCanUuid);
      res.json(result || {});
    } catch (error) {
      console.error("Error getting decision:", error);
      res.status(500).json({ error: "Failed to get decision" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const { assignedGroups, ...decisionData } = req.body;
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      
      // Upsert the main decision record
      const result = await recruitmentDecisionService.upsertDecision(recCanUuid, { ...decisionData, auditUserUuid });
      
      // Handle assigned groups if provided
      if (assignedGroups && Array.isArray(assignedGroups) && result.decisionUuid) {
        // Clear existing assigned groups
        await recruitmentDecisionService.clearAssignedGroups(result.decisionUuid);
        // Add new assigned groups
        for (const ag of assignedGroups) {
          if (ag.groupUuid) {
            await recruitmentDecisionService.addAssignedGroup(result.decisionUuid, ag.groupUuid, undefined, auditUserUuid);
          }
        }
      }
      
      // Return the decision with assigned groups
      const finalResult = await recruitmentDecisionService.getDecisionWithRelations(recCanUuid);
      res.json(finalResult || result);
    } catch (error) {
      console.error("Error upserting decision:", error);
      res.status(500).json({ error: "Failed to upsert decision" });
    }
  },

  async getAssignedGroups(req: Request, res: Response) {
    try {
      const { decisionUuid } = req.params;
      const result = await recruitmentDecisionService.getAssignedGroups(decisionUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting assigned groups:", error);
      res.status(500).json({ error: "Failed to get assigned groups" });
    }
  },

  async addAssignedGroup(req: Request, res: Response) {
    try {
      const { decisionUuid } = req.params;
      const { groupUuid } = req.body;
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const result = await recruitmentDecisionService.addAssignedGroup(decisionUuid, groupUuid, undefined, auditUserUuid);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error adding assigned group:", error);
      res.status(500).json({ error: "Failed to add assigned group" });
    }
  },
};
