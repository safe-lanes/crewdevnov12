import { Request, Response } from "express";
import { insertDataMasterSchema, insertMasterDataEntrySchema } from "@shared/schema";
import {
  needsSpecialHandling,
  applyMasterSpecificFiltering,
  applyMasterSpecificMapping,
  validateMasterSpecificEntry
} from "../../../vesselMasterSafety";
import { MastersRepository } from "../repositories/mastersRepository";

const mastersRepo = new MastersRepository();

function applyBasicFieldTransformation(entry: any): any {
  if (!entry) return entry;

  const transformed = { ...entry };

  if (entry.entry_id !== undefined) {
    transformed.entryId = entry.entry_id;
    delete transformed.entry_id;
  }

  if (entry.master_id !== undefined) {
    transformed.masterId = entry.master_id;
    delete transformed.master_id;
  }

  if (entry.created_at !== undefined) {
    transformed.createdAt = entry.created_at;
    delete transformed.created_at;
  }

  if (entry.updated_at !== undefined) {
    transformed.updatedAt = entry.updated_at;
    delete transformed.updated_at;
  }

  return transformed;
}

const VALID_MASTER_TYPES = [
  'nationalities', 'vessels', 'vesselTypes', 'additionalGroups',
  'ports', 'fleetGroups', 'languages', 'countries', 'users', 'roles'
];

const API_KEY_MAP: Record<string, string> = {
  'nationalities': 'nationalities',
  'vessels': 'vessels',
  'vesselTypes': 'vesseltypes',
  'additionalGroups': 'additionalGroups',
  'ports': 'ports',
  'fleetGroups': 'fleetGroups',
  'languages': 'languages',
  'countries': 'countries',
  'users': 'users',
  'roles': 'roles',
};

export const dataMasterController = {
  async listMasters(req: Request, res: Response) {
    try {
      const masters = await mastersRepo.getDataMasters();
      res.json(masters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch masters" });
    }
  },

  async getMaster(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const master = await mastersRepo.getDataMaster(id);
      if (!master) {
        return res.status(404).json({ error: "Master not found" });
      }
      res.json(master);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master" });
    }
  },

  async createMaster(req: Request, res: Response) {
    try {
      const result = insertDataMasterSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data", details: result.error.issues });
      }
      const master = await mastersRepo.createDataMaster(result.data);
      res.status(201).json(master);
    } catch (error) {
      res.status(500).json({ error: "Failed to create master" });
    }
  },

  async updateMaster(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const result = insertDataMasterSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data", details: result.error.issues });
      }
      const master = await mastersRepo.updateDataMaster(id, result.data);
      if (!master) {
        return res.status(404).json({ error: "Master not found" });
      }
      res.json(master);
    } catch (error) {
      res.status(500).json({ error: "Failed to update master" });
    }
  },

  async deleteMaster(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const deleted = await mastersRepo.deleteDataMaster(id);
      if (!deleted) {
        return res.status(404).json({ error: "Master not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete master" });
    }
  },

  async getMasterEntries(req: Request, res: Response) {
    try {
      const masterId = req.params.id;
      const entries = await mastersRepo.getMasterDataEntries(masterId);

      let responseEntries = entries;
      if (needsSpecialHandling(masterId) && entries) {
        responseEntries = entries.map((entry: any) => applyMasterSpecificMapping(entry, masterId));
      } else if (entries) {
        responseEntries = entries.map((entry: any) => applyBasicFieldTransformation(entry));
      }

      res.json(responseEntries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master data entries" });
    }
  },

  async getMasterEntry(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const entry = await mastersRepo.getMasterDataEntry(id);
      if (!entry) {
        return res.status(404).json({ error: "Master data entry not found" });
      }

      let responseEntry = entry;
      const masterId = (entry as any).master_id || (entry as any).masterId;
      if (needsSpecialHandling(masterId)) {
        responseEntry = applyMasterSpecificMapping(entry, masterId);
      } else {
        responseEntry = applyBasicFieldTransformation(entry);
      }

      res.json(responseEntry);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master data entry" });
    }
  },

  async createMasterEntry(req: Request, res: Response) {
    try {
      const masterId = req.params.id;

      let requestData = { ...req.body, masterId };
      if (needsSpecialHandling(masterId)) {
        requestData = applyMasterSpecificFiltering(requestData, masterId);

        const validation = validateMasterSpecificEntry(requestData, masterId);
        if (!validation.isValid) {
          return res.status(400).json({
            error: `Invalid ${masterId} master data`,
            details: validation.error
          });
        }
      }

      const result = insertMasterDataEntrySchema.safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data entry", details: result.error.issues });
      }

      const entry = await mastersRepo.createMasterDataEntry(result.data);

      let responseEntry = entry;
      if (needsSpecialHandling(masterId) && entry) {
        responseEntry = applyMasterSpecificMapping(entry, masterId);
      }

      res.status(201).json(responseEntry);
    } catch (error) {
      console.error(`Failed to create master data entry:`, error);
      res.status(500).json({ error: "Failed to create master data entry" });
    }
  },

  async updateMasterEntry(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      const existingEntry = await mastersRepo.getMasterDataEntry(id);
      if (!existingEntry) {
        return res.status(404).json({ error: "Master data entry not found" });
      }

      const masterId = (existingEntry as any).master_id;

      let requestData = req.body;

      const isDescriptionOnlyUpdate = req.body.description !== undefined &&
        Object.keys(req.body).filter(key => key !== 'masterId' && key !== 'description').length === 0;

      if (needsSpecialHandling(masterId) && !isDescriptionOnlyUpdate) {
        requestData = applyMasterSpecificFiltering(req.body, masterId);

        if (req.body.vessel || req.body.name || req.body.vesselIds || req.body.VesselIDs) {
          const validation = validateMasterSpecificEntry(requestData, masterId);
          if (!validation.isValid) {
            return res.status(400).json({
              error: `Invalid ${masterId} master data`,
              details: validation.error
            });
          }
        }
      }

      const result = insertMasterDataEntrySchema.partial().safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data entry", details: result.error.issues });
      }

      const entry = await mastersRepo.updateMasterDataEntry(id, result.data);
      if (!entry) {
        return res.status(404).json({ error: "Master data entry not found" });
      }

      let responseEntry = entry;
      if (needsSpecialHandling(masterId)) {
        responseEntry = applyMasterSpecificMapping(entry, masterId);
      }

      res.json(responseEntry);
    } catch (error) {
      console.error(`Failed to update master data entry:`, error);
      res.status(500).json({ error: "Failed to update master data entry" });
    }
  },

  async deleteMasterEntry(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const deleted = await mastersRepo.deleteMasterDataEntry(id);

      if (!deleted) {
        return res.status(404).json({ error: "Master data entry not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error(`Failed to delete master data entry:`, error);
      res.status(500).json({ error: "Failed to delete master data entry" });
    }
  },

  async getExternalMasterData(req: Request, res: Response) {
    try {
      const { type } = req.params;

      if (!VALID_MASTER_TYPES.includes(type)) {
        return res.status(400).json({
          error: `Invalid master type: ${type}. Valid types: ${VALID_MASTER_TYPES.join(', ')}`
        });
      }

      const data = await mastersRepo.getMasterData(type);
      res.json({
        type,
        count: data.length,
        data,
        cached: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error fetching master data:`, error);
      res.status(500).json({ error: "Failed to fetch master data from cache" });
    }
  },

  async syncAllExternalMasterData(req: Request, res: Response) {
    try {
      const { apiBaseUrl, domain } = req.body;

      if (!apiBaseUrl || !domain) {
        return res.status(400).json({
          error: "Missing required parameters: apiBaseUrl and domain are required"
        });
      }

      console.log(`[Sync All] Fetching all master data from external API: ${apiBaseUrl}`);

      const results: Record<string, { synced: number; error?: string }> = {};

      console.log(`[Sync All] Fetching main data from: ${apiBaseUrl}`);
      const mainResponse = await fetch(`${apiBaseUrl}?domain=${domain}`);
      if (!mainResponse.ok) {
        throw new Error(`External API responded with status ${mainResponse.status}`);
      }
      const externalData = await mainResponse.json();

      for (const type of VALID_MASTER_TYPES) {
        try {
          const apiKey = API_KEY_MAP[type];
          const typeData = externalData[apiKey];
          if (typeData && Array.isArray(typeData)) {
            const result = await mastersRepo.syncMasterData(type, typeData);
            results[type] = { synced: result.count };
          } else {
            results[type] = { synced: 0, error: `No data for key: ${apiKey}` };
          }
        } catch (typeError) {
          results[type] = {
            synced: 0,
            error: typeError instanceof Error ? typeError.message : 'Unknown error'
          };
        }
      }

      const totalSynced = Object.values(results).reduce((sum, r) => sum + r.synced, 0);
      console.log(`[Sync All] Completed. Total synced: ${totalSynced} records`);

      res.json({
        results,
        totalSynced,
        source: 'external_api',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error syncing all master data:`, error);
      res.status(500).json({
        error: "Failed to sync master data from external API",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },
};
