import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, isConnected, connectionError } from "./storage";
import { insertFormSchema, insertRankGroupSchema, insertAvailableRankSchema, updateAvailableRankSchema, insertCrewMemberSchema, insertAppraisalResultSchema, insertRecruitmentCandidateSchema, insertDataMasterSchema, insertMasterDataEntrySchema, insertVesselGroupSchema, insertVesselDraftSchema, insertVesselRevisionSchema, insertVesselPlanningSchema, insertRotationPlanSchema } from "@shared/schema";
import { z } from "zod";
import { normalizeCrewMemberForTable, mapFormDataToStorage, fromStorageCrew, toStorageCrew } from "@shared/crew-mapping";
import { 
  isVesselMaster,
  filterVesselMasterData,
  mapDatabaseToVesselDisplay,
  validateVesselMasterEntry,
  getVesselMasterInfo,
  isAdditionalGroupsMaster,
  isVesselOwnersMaster,
  needsSpecialHandling,
  applyMasterSpecificFiltering,
  applyMasterSpecificMapping,
  validateMasterSpecificEntry
} from "./vesselMasterSafety";
import { parseFlexibleDate, formatToISO } from "../shared/date-utils";

/**
 * Basic field transformation from snake_case (database) to camelCase (frontend)
 * for all master data entries
 */
function applyBasicFieldTransformation(entry: any): any {
  if (!entry) return entry;
  
  const transformed = { ...entry };
  
  // Convert snake_case database fields to camelCase frontend fields
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

// Schema for rank reorder request
const rankReorderSchema = z.array(z.object({
  id: z.number(),
  sortOrder: z.number().int().nonnegative()
}));

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for database connectivity
  app.get("/api/health", async (req, res) => {
    const healthStatus = {
      server: "running",
      database: isConnected ? "connected" : "disconnected",
      // Gate sensitive information behind development environment check
      ...(process.env.NODE_ENV === 'development' && {
        rds_instance: "ls-d153072fe29fcd7dc7c484a33fd3130e29abae1b.cxock8yskd1i.ap-southeast-1.rds.amazonaws.com:3306",
        database_name: "crew_database"
      }),
      connection_error: connectionError?.message || null,
      timestamp: new Date().toISOString()
    };

    if (isConnected) {
      try {
        // Test with actual query
        await storage.getForms();
        res.status(200).json({ 
          status: "healthy", 
          ...healthStatus
        });
      } catch (error) {
        res.status(500).json({ 
          status: "unhealthy - query failed", 
          ...healthStatus,
          query_error: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      res.status(500).json({ 
        status: "unhealthy - no database connection", 
        ...healthStatus,
        troubleshooting: {
          check_security_groups: "Ensure RDS security group allows connections from this environment",
          check_database_exists: "Verify 'crew_database' database exists on RDS instance",
          check_credentials: "Verify DB_USER and DB_PASSWORD are correct",
          check_network: "Ensure network connectivity to RDS endpoint"
        }
      });
    }
  });

  // Database connectivity test endpoint
  app.get("/api/db-test", async (req, res) => {
    try {
      const startTime = Date.now();
      await storage.getForms();
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      res.status(200).json({ 
        message: "Database connection successful",
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Database test failed:", error);
      res.status(500).json({ 
        error: "Database connection failed",
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Forms API routes
  app.get("/api/forms", async (req, res) => {
    try {
      const forms = await storage.getForms();
      res.json(forms);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch forms" });
    }
  });

  app.get("/api/forms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const form = await storage.getForm(id);
      if (!form) {
        return res.status(404).json({ error: "Form not found" });
      }
      res.json(form);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch form" });
    }
  });

  app.post("/api/forms", async (req, res) => {
    try {
      const result = insertFormSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form data", details: result.error.issues });
      }
      const form = await storage.createForm(result.data);
      res.json(form);
    } catch (error) {
      res.status(500).json({ error: "Failed to create form" });
    }
  });

  app.put("/api/forms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertFormSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form data", details: result.error.issues });
      }
      const form = await storage.updateForm(id, result.data);
      if (!form) {
        return res.status(404).json({ error: "Form not found" });
      }
      res.json(form);
    } catch (error) {
      res.status(500).json({ error: "Failed to update form" });
    }
  });

  app.delete("/api/forms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteForm(id);
      if (!deleted) {
        return res.status(404).json({ error: "Form not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete form" });
    }
  });

  // Cleanup duplicate forms (admin endpoint)
  app.post("/api/forms/cleanup-duplicates", async (req, res) => {
    try {
      const forms = await storage.getForms();
      const duplicateForms = forms.filter(f => f.name === "Crew Appraisal Form");
      
      if (duplicateForms.length <= 1) {
        return res.json({ 
          message: "No duplicates found", 
          totalForms: duplicateForms.length 
        });
      }

      // Keep the first form (lowest ID), delete the rest
      const formToKeep = duplicateForms.reduce((prev, curr) => 
        prev.id < curr.id ? prev : curr
      );
      const formsToDelete = duplicateForms.filter(f => f.id !== formToKeep.id);
      
      let deletedCount = 0;
      for (const form of formsToDelete) {
        const success = await storage.deleteForm(form.id);
        if (success) {
          deletedCount++;
          console.log(`🗑️ Deleted duplicate form ID: ${form.id}`);
        }
      }

      res.json({ 
        message: "Cleanup completed", 
        kept: formToKeep.id,
        deletedCount,
        totalOriginal: duplicateForms.length 
      });
    } catch (error) {
      console.error("Error cleaning up duplicate forms:", error);
      res.status(500).json({ error: "Failed to cleanup duplicate forms" });
    }
  });

  // Rank Groups API routes
  app.get("/api/rank-groups/:formId", async (req, res) => {
    try {
      const formId = parseInt(req.params.formId);
      const rankGroups = await storage.getRankGroups(formId);
      res.json(rankGroups);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rank groups" });
    }
  });

  app.post("/api/rank-groups", async (req, res) => {
    try {
      const validatedData = insertRankGroupSchema.parse(req.body);
      const rankGroup = await storage.createRankGroup(validatedData);
      res.status(201).json(rankGroup);
    } catch (error) {
      res.status(400).json({ error: "Invalid rank group data" });
    }
  });

  app.put("/api/rank-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertRankGroupSchema.partial().parse(req.body);
      const rankGroup = await storage.updateRankGroup(id, validatedData);
      if (!rankGroup) {
        return res.status(404).json({ error: "Rank group not found" });
      }
      res.json(rankGroup);
    } catch (error) {
      res.status(400).json({ error: "Invalid rank group data" });
    }
  });

  app.delete("/api/rank-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteRankGroup(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rank group not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete rank group" });
    }
  });

  // Available Ranks API routes
  app.get("/api/available-ranks", async (req, res) => {
    try {
      const ranks = await storage.getAvailableRanks();
      res.json(ranks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch available ranks" });
    }
  });

  app.post("/api/available-ranks", async (req, res) => {
    try {
      const validatedData = insertAvailableRankSchema.parse(req.body);
      const rank = await storage.createAvailableRank(validatedData);
      res.status(201).json(rank);
    } catch (error) {
      res.status(400).json({ error: "Invalid rank data" });
    }
  });

  app.put("/api/available-ranks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertAvailableRankSchema.partial().parse(req.body);
      const rank = await storage.updateAvailableRank(id, validatedData);
      if (!rank) {
        return res.status(404).json({ error: "Rank not found" });
      }
      res.json(rank);
    } catch (error) {
      res.status(400).json({ error: "Invalid rank data" });
    }
  });

  app.delete("/api/available-ranks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteAvailableRank(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rank not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete rank" });
    }
  });

  // Cleanup endpoint to clear all available ranks
  app.delete("/api/available-ranks", async (req, res) => {
    try {
      await storage.clearAllAvailableRanks();
      res.json({ success: true, message: "All ranks cleared successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear ranks" });
    }
  });

  // Rank reorder endpoint for drag-and-drop functionality
  app.post("/api/available-ranks/reorder", async (req, res) => {
    try {
      const validatedData = rankReorderSchema.parse(req.body);
      const success = await storage.updateRankOrders(validatedData);
      if (!success) {
        return res.status(500).json({ error: "Failed to update rank orders" });
      }
      res.json({ success: true, message: "Rank orders updated successfully" });
    } catch (error) {
      console.error('Rank reorder error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid reorder data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to reorder ranks" });
    }
  });

  // Company Ranks endpoints - PERSISTENT STORAGE FOR ROLE ENTRIES!
  app.get("/api/company-ranks", async (req, res) => {
    try {
      const companyRanks = await storage.getCompanyRanks();
      res.json(companyRanks);
    } catch (error) {
      console.error("❌ Failed to fetch company ranks:", error);
      res.status(500).json({ error: "Failed to fetch company ranks" });
    }
  });

  app.post("/api/company-ranks", async (req, res) => {
    try {
      // Use saveAllCompanyRanks for bulk save (frontend sends entire array)
      const companyRanks = await storage.saveAllCompanyRanks(req.body);
      console.log(`💾 [API] Successfully saved ${companyRanks.length} company ranks to persistent storage`);
      res.json({ success: true, data: companyRanks });
    } catch (error) {
      console.error("❌ Failed to save company ranks:", error);
      res.status(500).json({ error: "Failed to save company ranks" });
    }
  });

  // Vessel Groups API routes
  app.get("/api/vessel-groups", async (req, res) => {
    try {
      const vesselGroups = await storage.getVesselGroups();
      res.json(vesselGroups);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vessel groups" });
    }
  });

  app.get("/api/vessel-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const vesselGroup = await storage.getVesselGroup(id);
      if (!vesselGroup) {
        return res.status(404).json({ error: "Vessel group not found" });
      }
      res.json(vesselGroup);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vessel group" });
    }
  });

  app.post("/api/vessel-groups", async (req, res) => {
    try {
      // Normalize vesselIds to JSON string before validation if it's an array
      const normalizedBody = {
        ...req.body,
        vesselIds: Array.isArray(req.body.vesselIds) 
          ? JSON.stringify(req.body.vesselIds) 
          : req.body.vesselIds
      };
      
      const result = insertVesselGroupSchema.safeParse(normalizedBody);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel group data", details: result.error.issues });
      }
      
      const vesselGroup = await storage.createVesselGroup(result.data);
      res.status(201).json(vesselGroup);
    } catch (error) {
      res.status(500).json({ error: "Failed to create vessel group" });
    }
  });

  app.patch("/api/vessel-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Normalize vesselIds to JSON string before validation if it's an array
      const normalizedBody = {
        ...req.body,
        ...(req.body.vesselIds && {
          vesselIds: Array.isArray(req.body.vesselIds) 
            ? JSON.stringify(req.body.vesselIds) 
            : req.body.vesselIds
        })
      };
      
      const result = insertVesselGroupSchema.partial().safeParse(normalizedBody);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel group data", details: result.error.issues });
      }
      
      const vesselGroup = await storage.updateVesselGroup(id, result.data);
      if (!vesselGroup) {
        return res.status(404).json({ error: "Vessel group not found" });
      }
      res.json(vesselGroup);
    } catch (error) {
      res.status(500).json({ error: "Failed to update vessel group" });
    }
  });

  app.delete("/api/vessel-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteVesselGroup(id);
      if (!success) {
        return res.status(404).json({ error: "Vessel group not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vessel group" });
    }
  });

  // Vessel Drafts API routes
  app.get("/api/vessel-drafts", async (req, res) => {
    try {
      const vesselDrafts = await storage.getVesselDrafts();
      res.json(vesselDrafts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vessel drafts" });
    }
  });

  app.get("/api/vessel-drafts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const vesselDraft = await storage.getVesselDraft(id);
      if (!vesselDraft) {
        return res.status(404).json({ error: "Vessel draft not found" });
      }
      res.json(vesselDraft);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vessel draft" });
    }
  });

  app.get("/api/vessel-drafts/by-vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      console.log(`🚢 [VESSEL DRAFT API] Fetching drafts for vessel: ${vesselId}`);
      const vesselDrafts = await storage.getVesselDraftsByVessel(vesselId);
      console.log(`🚢 [VESSEL DRAFT API] Found ${vesselDrafts.length} drafts for vessel ${vesselId}`);
      res.json(vesselDrafts);
    } catch (error) {
      console.error(`🚢 [VESSEL DRAFT API ERROR] Failed to fetch vessel drafts for vessel ${req.params.vesselId}:`, error);
      res.status(500).json({ error: "Failed to fetch vessel drafts for vessel" });
    }
  });

  app.post("/api/vessel-drafts", async (req, res) => {
    try {
      console.log(`🚢 [VESSEL DRAFT CREATE] Attempting to create vessel draft with data:`, req.body);
      const result = insertVesselDraftSchema.safeParse(req.body);
      if (!result.success) {
        console.error(`🚢 [VESSEL DRAFT VALIDATION ERROR] Schema validation failed:`, result.error.issues);
        return res.status(400).json({ error: "Invalid vessel draft data", details: result.error.issues });
      }
      
      console.log(`🚢 [VESSEL DRAFT CREATE] Validation passed, creating draft for vessel ${result.data.vesselId}`);
      const vesselDraft = await storage.createVesselDraft(result.data);
      console.log(`🚢 [VESSEL DRAFT CREATE] Successfully created draft with ID: ${vesselDraft.id}`);
      res.status(201).json(vesselDraft);
    } catch (error) {
      console.error(`🚢 [VESSEL DRAFT CREATE ERROR] Failed to create vessel draft:`, error);
      res.status(500).json({ error: "Failed to create vessel draft" });
    }
  });

  app.patch("/api/vessel-drafts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const result = insertVesselDraftSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel draft data", details: result.error.issues });
      }
      
      const vesselDraft = await storage.updateVesselDraft(id, result.data);
      if (!vesselDraft) {
        return res.status(404).json({ error: "Vessel draft not found" });
      }
      res.json(vesselDraft);
    } catch (error) {
      res.status(500).json({ error: "Failed to update vessel draft" });
    }
  });

  app.delete("/api/vessel-drafts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteVesselDraft(id);
      if (!success) {
        return res.status(404).json({ error: "Vessel draft not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vessel draft" });
    }
  });

  // Upsert vessel draft (update if exists, create if not) - convenience endpoint for Save Draft functionality
  app.post("/api/vessel-drafts/upsert", async (req, res) => {
    try {
      console.log(`💾 [DRAFT UPSERT] Attempting to save draft for vessel:`, req.body.vesselId);
      
      // Validate the request body
      const result = insertVesselDraftSchema.safeParse(req.body);
      if (!result.success) {
        console.error(`💾 [DRAFT UPSERT ERROR] Validation failed:`, result.error.issues);
        return res.status(400).json({ error: "Invalid vessel draft data", details: result.error.issues });
      }
      
      // Check if a draft already exists for this vessel
      const existingDrafts = await storage.getVesselDraftsByVessel(result.data.vesselId);
      
      if (existingDrafts.length > 0) {
        // Update the existing draft
        const existingDraft = existingDrafts[0]; // Use the first draft if multiple exist
        console.log(`💾 [DRAFT UPSERT] Found existing draft (ID: ${existingDraft.id}), updating...`);
        const updatedDraft = await storage.updateVesselDraft(existingDraft.id, result.data);
        console.log(`💾 [DRAFT UPSERT] Successfully updated draft ID: ${existingDraft.id}`);
        res.json({ action: "updated", draft: updatedDraft });
      } else {
        // Create a new draft
        console.log(`💾 [DRAFT UPSERT] No existing draft found, creating new draft...`);
        const newDraft = await storage.createVesselDraft(result.data);
        console.log(`💾 [DRAFT UPSERT] Successfully created new draft ID: ${newDraft.id}`);
        res.status(201).json({ action: "created", draft: newDraft });
      }
    } catch (error) {
      console.error(`💾 [DRAFT UPSERT ERROR] Failed to upsert vessel draft:`, error);
      res.status(500).json({ error: "Failed to save vessel draft" });
    }
  });

  // Vessel Revisions API routes
  app.get("/api/vessel-revisions", async (req, res) => {
    try {
      const vesselRevisions = await storage.getVesselRevisions();
      res.json(vesselRevisions);
    } catch (error) {
      console.error("Failed to fetch vessel revisions:", error);
      res.status(500).json({ error: "Failed to fetch vessel revisions" });
    }
  });

  // IMPORTANT: Literal path segments must come BEFORE parameterized routes to avoid shadowing
  app.get("/api/vessel-revisions/by-vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      console.log(`📜 [VESSEL REVISION API] Fetching revisions for vessel: ${vesselId}`);
      const vesselRevisions = await storage.getVesselRevisionsByVessel(vesselId);
      console.log(`📜 [VESSEL REVISION API] Found ${vesselRevisions.length} revisions for vessel ${vesselId}`);
      res.json(vesselRevisions);
    } catch (error) {
      console.error("Failed to fetch vessel revisions by vessel:", error);
      res.status(500).json({ error: "Failed to fetch vessel revisions" });
    }
  });

  // Debug endpoint to inspect all revisions for a vessel
  app.get("/api/vessel-revisions/debug/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      console.log(`🔍 [DEBUG API] Fetching revision metadata for vessel: ${vesselId}`);
      
      const vesselRevisions = await storage.getVesselRevisionsByVessel(vesselId);
      
      if (vesselRevisions.length === 0) {
        return res.json({ vesselId, message: "No revisions found", revisions: [] });
      }
      
      // Build debug info for each revision
      const debugInfo = vesselRevisions.map((rev) => {
        let rankCount = 0;
        let activeRankCount = 0;
        
        try {
          const rankData = JSON.parse(rev.revisionData);
          rankCount = rankData.length;
          activeRankCount = rankData.filter((rank: any) => 
            rank.actualManningFlag || rank.safeManning || rank.optimumManning || rank.highWorkloadManning
          ).length;
        } catch (e) {
          // Invalid JSON
        }
        
        return {
          id: rev.id,
          revision: rev.revision,
          revisionDate: rev.revisionDate,
          createdAt: rev.createdAt,
          totalRanks: rankCount,
          activeRanks: activeRankCount,
          hasData: rankCount > 0
        };
      });
      
      // Sort by creation date to show which would be selected
      const sorted = [...debugInfo].sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      });
      
      res.json({
        vesselId,
        totalRevisions: vesselRevisions.length,
        selectedRevision: sorted[0],
        allRevisions: sorted
      });
    } catch (error) {
      console.error("Failed to debug vessel revisions:", error);
      res.status(500).json({ error: "Failed to debug vessel revisions" });
    }
  });

  // Get vessel ranks from latest revision (must come before :id route)
  app.get("/api/vessel-revisions/ranks/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      console.log(`📜 [VESSEL RANKS API] Fetching ranks for vessel: ${vesselId}`);
      
      // Get all revisions for this vessel
      const vesselRevisions = await storage.getVesselRevisionsByVessel(vesselId);
      
      if (vesselRevisions.length === 0) {
        console.log(`📜 [VESSEL RANKS API] No revisions found for vessel ${vesselId}`);
        return res.json([]);
      }
      
      // Sort revisions by creation date (most recent first) to get the truly latest configuration
      // This handles cases where multiple revisions with the same number exist
      const sortedRevisions = vesselRevisions.sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate; // Most recent first
      });
      
      const latestRevision = sortedRevisions[0];
      console.log(`📜 [VESSEL RANKS API] Latest revision for vessel ${vesselId}: ${latestRevision.revision} (id: ${latestRevision.id}, created: ${latestRevision.createdAt})`);
      
      // Parse the revisionData JSON to get the ranks
      const rankData = JSON.parse(latestRevision.revisionData);
      
      // Merge with current company ranks to ensure designation fields are up-to-date
      // This handles legacy data that was saved before designation sync was implemented
      const companyRanks = await storage.getCompanyRanks();
      const companyRanksMap = new Map(companyRanks.map((cr: any) => [cr.id, cr]));
      
      const mergedRankData = rankData.map((vesselRank: any) => {
        const companyRank: any = companyRanksMap.get(vesselRank.id);
        
        if (companyRank) {
          return {
            ...vesselRank,
            // Update company-only designation fields from current company ranks
            officer: companyRank.officer ?? vesselRank.officer ?? false,
            rating: companyRank.rating ?? vesselRank.rating ?? false,
            seniorOfficer: companyRank.seniorOfficer ?? vesselRank.seniorOfficer ?? false,
            deckOfficer: companyRank.deckOfficer ?? vesselRank.deckOfficer ?? false,
            engOfficer: companyRank.engOfficer ?? vesselRank.engOfficer ?? false,
            pettyOfficer: companyRank.pettyOfficer ?? vesselRank.pettyOfficer ?? false,
            deckRating: companyRank.deckRating ?? vesselRank.deckRating ?? false,
            engineRating: companyRank.engineRating ?? vesselRank.engineRating ?? false,
            generalRating: companyRank.generalRating ?? vesselRank.generalRating ?? false,
            cateringRating: companyRank.cateringRating ?? vesselRank.cateringRating ?? false,
            // Preserve vessel-specific overrides if they exist
            safetyOfficer: vesselRank.safetyOfficer ?? companyRank.safetyOfficer ?? false,
            sso: vesselRank.sso ?? companyRank.sso ?? false,
            medicalOfficer: vesselRank.medicalOfficer ?? companyRank.medicalOfficer ?? false,
            navigatingOfficer: vesselRank.navigatingOfficer ?? companyRank.navigatingOfficer ?? false,
            emtOfficer: vesselRank.emtOfficer ?? companyRank.emtOfficer ?? false,
          };
        }
        return vesselRank;
      });
      
      // Filter ranks that have "Actual Manning" checked
      // The crew list should only display ranks with actualManningFlag = true
      const activeRanks = mergedRankData.filter((rank: any) => 
        rank.actualManningFlag
      );
      
      console.log(`📜 [VESSEL RANKS API] Found ${activeRanks.length} active ranks for vessel ${vesselId} (merged with company ranks)`);
      res.json(activeRanks);
    } catch (error) {
      console.error("Failed to fetch vessel ranks:", error);
      res.status(500).json({ error: "Failed to fetch vessel ranks" });
    }
  });

  // Get next revision number for a vessel (must come before :id route)
  app.get("/api/vessel-revisions/next-revision/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      console.log(`📜 [NEXT REVISION] Getting next revision number for vessel: ${vesselId}`);
      
      // Get all existing revisions for this vessel
      const existingRevisions = await storage.getVesselRevisionsByVessel(vesselId);
      
      // Extract revision numbers and find the highest one
      // Expected format: "R0", "R1", "R2", etc.
      let maxRevisionNumber = -1;
      for (const revision of existingRevisions) {
        const match = revision.revision.match(/^R(\d+)$/);
        if (match) {
          const revisionNumber = parseInt(match[1], 10);
          if (revisionNumber > maxRevisionNumber) {
            maxRevisionNumber = revisionNumber;
          }
        }
      }
      
      // Next revision is maxRevisionNumber + 1, formatted as "R{n}"
      const nextRevisionNumber = maxRevisionNumber + 1;
      const nextRevision = `R${nextRevisionNumber}`;
      
      console.log(`📜 [NEXT REVISION] Vessel ${vesselId} has ${existingRevisions.length} existing revisions, next: ${nextRevision}`);
      res.json({ vesselId, nextRevision, revisionNumber: nextRevisionNumber });
    } catch (error) {
      console.error("Failed to get next revision number:", error);
      res.status(500).json({ error: "Failed to get next revision number" });
    }
  });

  app.get("/api/vessel-revisions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Validate that id is a valid number
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid revision ID - must be a number" });
      }
      const vesselRevision = await storage.getVesselRevision(id);
      if (!vesselRevision) {
        return res.status(404).json({ error: "Vessel revision not found" });
      }
      res.json(vesselRevision);
    } catch (error) {
      console.error("Failed to fetch vessel revision:", error);
      res.status(500).json({ error: "Failed to fetch vessel revision" });
    }
  });

  app.post("/api/vessel-revisions", async (req, res) => {
    try {
      console.log(`📜 [VESSEL REVISION CREATE] Attempting to create vessel revision with data:`, req.body);
      const result = insertVesselRevisionSchema.safeParse(req.body);
      if (!result.success) {
        console.error(`📜 [VESSEL REVISION VALIDATION ERROR] Schema validation failed:`, result.error.issues);
        return res.status(400).json({ error: "Invalid vessel revision data", details: result.error.issues });
      }
      
      const vesselRevision = await storage.createVesselRevision(result.data);
      console.log(`📜 [VESSEL REVISION CREATED] Successfully created revision with ID: ${vesselRevision.id}`);
      res.status(201).json(vesselRevision);
    } catch (error) {
      console.error(`📜 [VESSEL REVISION CREATE ERROR] Failed to create vessel revision:`, error);
      res.status(500).json({ error: "Failed to create vessel revision" });
    }
  });

  // Submit vessel revision - comprehensive endpoint that handles the entire Submit workflow
  app.post("/api/vessel-revisions/submit", async (req, res) => {
    try {
      console.log(`✅ [SUBMIT] Starting Submit workflow for vessel:`, req.body.vesselId);
      
      // Step 1: Validate the request body (excluding revision since it will be auto-assigned)
      // Submit schema omits "revision" field because it's computed server-side
      const submitSchema = insertVesselRevisionSchema.omit({ revision: true });
      const validationResult = submitSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.error(`✅ [SUBMIT ERROR] Validation failed:`, validationResult.error.issues);
        return res.status(400).json({ 
          error: "Invalid vessel revision data", 
          details: validationResult.error.issues 
        });
      }
      
      const { vesselId, revisionData, revisionDate } = validationResult.data;
      console.log(`✅ [SUBMIT] Validation passed for vessel ${vesselId}, date: ${revisionDate}`);
      
      // Step 2: Get the next revision number for this vessel
      const existingRevisions = await storage.getVesselRevisionsByVessel(vesselId);
      let maxRevisionNumber = -1;
      for (const revision of existingRevisions) {
        const match = revision.revision.match(/^R(\d+)$/);
        if (match) {
          const revisionNumber = parseInt(match[1], 10);
          if (revisionNumber > maxRevisionNumber) {
            maxRevisionNumber = revisionNumber;
          }
        }
      }
      const nextRevisionNumber = maxRevisionNumber + 1;
      const nextRevision = `R${nextRevisionNumber}`;
      console.log(`✅ [SUBMIT] Auto-assigned revision: ${nextRevision} (vessel has ${existingRevisions.length} existing revisions)`);
      
      // Step 3: Create the finalized vessel revision with the auto-assigned revision number
      const revisionToCreate = {
        vesselId,
        revision: nextRevision,
        revisionDate,
        revisionData
      };
      const createdRevision = await storage.createVesselRevision(revisionToCreate);
      console.log(`✅ [SUBMIT] Created revision with ID: ${createdRevision.id}, revision: ${nextRevision}`);
      
      // Step 4: Delete any existing drafts for this vessel (best-effort cleanup)
      const existingDrafts = await storage.getVesselDraftsByVessel(vesselId);
      let deletedDraftsCount = 0;
      const failedDraftIds: number[] = [];
      for (const draft of existingDrafts) {
        try {
          const deleted = await storage.deleteVesselDraft(draft.id);
          if (deleted) {
            deletedDraftsCount++;
          } else {
            failedDraftIds.push(draft.id);
          }
        } catch (deleteError) {
          console.warn(`✅ [SUBMIT WARNING] Failed to delete draft ${draft.id}:`, deleteError);
          failedDraftIds.push(draft.id);
        }
      }
      console.log(`✅ [SUBMIT] Cleaned up ${deletedDraftsCount} draft(s) for vessel ${vesselId}${failedDraftIds.length > 0 ? `, failed to delete ${failedDraftIds.length} draft(s)` : ''}`);
      
      // Step 5: Return the created revision with metadata
      res.status(201).json({
        success: true,
        revision: createdRevision,
        metadata: {
          autoAssignedRevision: nextRevision,
          deletedDrafts: deletedDraftsCount,
          failedDraftIds: failedDraftIds.length > 0 ? failedDraftIds : undefined
        }
      });
      console.log(`✅ [SUBMIT] Submit workflow completed successfully for vessel ${vesselId}`);
    } catch (error) {
      console.error(`✅ [SUBMIT ERROR] Submit workflow failed:`, error);
      res.status(500).json({ error: "Failed to submit vessel revision" });
    }
  });

  // Vessel Planning API routes
  app.get("/api/vessel-planning/vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const planning = await storage.getVesselPlanningByVessel(vesselId);
      res.json(planning);
    } catch (error) {
      console.error("Failed to fetch vessel planning:", error);
      res.status(500).json({ error: "Failed to fetch vessel planning" });
    }
  });

  app.get("/api/vessel-planning/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const planning = await storage.getVesselPlanningById(id);
      if (!planning) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      res.json(planning);
    } catch (error) {
      console.error("Failed to fetch vessel planning:", error);
      res.status(500).json({ error: "Failed to fetch vessel planning" });
    }
  });

  app.post("/api/vessel-planning", async (req, res) => {
    try {
      const result = insertVesselPlanningSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel planning data", details: result.error.issues });
      }
      const planning = await storage.createVesselPlanning(result.data);
      res.status(201).json(planning);
    } catch (error) {
      console.error("Failed to create vessel planning:", error);
      res.status(500).json({ error: "Failed to create vessel planning" });
    }
  });

  app.put("/api/vessel-planning/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const planning = await storage.updateVesselPlanning(id, req.body);
      if (!planning) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      res.json(planning);
    } catch (error) {
      console.error("Failed to update vessel planning:", error);
      res.status(500).json({ error: "Failed to update vessel planning" });
    }
  });

  app.patch("/api/vessel-planning/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const planning = await storage.updateVesselPlanning(id, req.body);
      if (!planning) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      res.json(planning);
    } catch (error) {
      console.error("Failed to update vessel planning:", error);
      res.status(500).json({ error: "Failed to update vessel planning" });
    }
  });

  app.delete("/api/vessel-planning/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const deleted = await storage.deleteVesselPlanning(id);
      if (!deleted) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete vessel planning:", error);
      res.status(500).json({ error: "Failed to delete vessel planning" });
    }
  });

  // Rotation Plans API routes
  app.get("/api/rotation-plans", async (req, res) => {
    try {
      const plans = await storage.getRotationPlans();
      res.json(plans);
    } catch (error) {
      console.error("Failed to fetch rotation plans:", error);
      res.status(500).json({ error: "Failed to fetch rotation plans" });
    }
  });

  app.get("/api/rotation-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID - must be a number" });
      }
      const plan = await storage.getRotationPlan(id);
      if (!plan) {
        return res.status(404).json({ error: "Rotation plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Failed to fetch rotation plan:", error);
      res.status(500).json({ error: "Failed to fetch rotation plan" });
    }
  });

  app.post("/api/rotation-plans", async (req, res) => {
    try {
      const result = insertRotationPlanSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rotation plan data", details: result.error.issues });
      }
      const plan = await storage.createRotationPlan(result.data);
      res.status(201).json(plan);
    } catch (error) {
      console.error("Failed to create rotation plan:", error);
      res.status(500).json({ error: "Failed to create rotation plan" });
    }
  });

  app.patch("/api/rotation-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID - must be a number" });
      }
      const result = insertRotationPlanSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rotation plan data", details: result.error.issues });
      }
      
      // Update lastEdited timestamp
      const updateData = {
        ...result.data,
        lastEdited: new Date().toISOString(),
      };
      
      const plan = await storage.updateRotationPlan(id, updateData);
      if (!plan) {
        return res.status(404).json({ error: "Rotation plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Failed to update rotation plan:", error);
      res.status(500).json({ error: "Failed to update rotation plan" });
    }
  });

  app.delete("/api/rotation-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID - must be a number" });
      }
      const deleted = await storage.deleteRotationPlan(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rotation plan not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete rotation plan:", error);
      res.status(500).json({ error: "Failed to delete rotation plan" });
    }
  });

  // Rotation Approval Workflow API routes
  app.post("/api/rotation-plans/:id/propose", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID - must be a number" });
      }
      const { proposedBy } = req.body;
      if (!proposedBy) {
        return res.status(400).json({ error: "proposedBy is required" });
      }
      const plan = await storage.proposeRotationPlan(id, proposedBy);
      if (!plan) {
        return res.status(404).json({ error: "Rotation plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Failed to propose rotation plan:", error);
      res.status(500).json({ error: "Failed to propose rotation plan" });
    }
  });

  app.get("/api/rotation/proposals", async (req, res) => {
    try {
      const filters = {
        vessels: req.query.vessels ? JSON.parse(req.query.vessels as string) : undefined,
        ranks: req.query.ranks ? JSON.parse(req.query.ranks as string) : undefined,
        draftId: req.query.draftId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const proposals = await storage.getProposedAssignments(filters);
      res.json(proposals);
    } catch (error) {
      console.error("Failed to fetch proposals:", error);
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  });

  app.post("/api/rotation/proposals/deploy", async (req, res) => {
    try {
      const { planId, assignmentIndex, deployedBy } = req.body;
      if (typeof planId !== 'number' || typeof assignmentIndex !== 'number' || !deployedBy) {
        return res.status(400).json({ error: "planId, assignmentIndex, and deployedBy are required" });
      }
      const result = await storage.deployAssignment(planId, assignmentIndex, deployedBy);
      
      // Return 409 Conflict status for conflicts - this ensures frontend sees it as an error
      if (!result.success && result.conflicts && result.conflicts.length > 0) {
        return res.status(409).json({ error: "Assignment conflicts detected", conflicts: result.conflicts });
      }
      
      // Return 400 Bad Request for other failures
      if (!result.success) {
        return res.status(400).json({ error: "Failed to deploy assignment" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to deploy assignment:", error);
      res.status(500).json({ error: "Failed to deploy assignment" });
    }
  });

  app.post("/api/rotation/proposals/reject", async (req, res) => {
    try {
      const { planId, assignmentIndex } = req.body;
      if (typeof planId !== 'number' || typeof assignmentIndex !== 'number') {
        return res.status(400).json({ error: "planId and assignmentIndex are required" });
      }
      const plan = await storage.rejectAssignment(planId, assignmentIndex);
      if (!plan) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Failed to reject assignment:", error);
      res.status(500).json({ error: "Failed to reject assignment" });
    }
  });

  app.get("/api/rotation/proposals/conflicts", async (req, res) => {
    try {
      const { crewId, joiningDate, contractPeriod } = req.query;
      if (!crewId || !joiningDate || !contractPeriod) {
        return res.status(400).json({ error: "crewId, joiningDate, and contractPeriod are required" });
      }
      const conflicts = await storage.checkAssignmentConflicts(
        crewId as string,
        joiningDate as string,
        parseInt(contractPeriod as string)
      );
      res.json(conflicts);
    } catch (error) {
      console.error("Failed to check conflicts:", error);
      res.status(500).json({ error: "Failed to check conflicts" });
    }
  });

  // Crew Members API routes
  app.get("/api/crew-members/next-crew-id", async (req, res) => {
    try {
      const nextCrewId = await storage.getNextCrewId();
      res.json({ crewId: nextCrewId });
    } catch (error) {
      console.error("❌ Failed to generate next crew ID:", error);
      res.status(500).json({ error: "Failed to generate next crew ID" });
    }
  });

  app.get("/api/crew-members/by-rank/:rank", async (req, res) => {
    try {
      const { rank } = req.params;
      const crewMembers = await storage.getCrewMembers();
      
      // Filter by rank and add experience data
      const filteredCrew = crewMembers
        .filter(crew => crew.presentRank === rank)
        .map(crew => {
          // Calculate experience metrics from sea service data
          // For now, using placeholder data - will be enhanced with real calculations
          const experience = {
            company: Math.floor(Math.random() * 10) + 1, // 1-10 years
            rank: Math.floor(Math.random() * 8) + 1, // 1-8 years
            tankers: Math.floor(Math.random() * 6) + 1, // 1-6 years
            oow: Math.floor(Math.random() * 12) + 1, // 1-12 years
            endorsements: ['OGC', 'IGC', 'STW'][Math.floor(Math.random() * 3)] || 'OGC'
          };
          
          // Extract pool from status or use placeholder
          const pools = ['Pool A', 'Pool B', 'Pool C'];
          const pool = pools[Math.floor(Math.random() * pools.length)];
          
          // Get ship type from vesselType or vesselTypes array
          const shipType = crew.vesselType || (crew.vesselTypes && crew.vesselTypes.length > 0 ? crew.vesselTypes[0] : undefined);
          
          // Placeholder data for travel status, higher cert, and performance
          const travelStatuses = ['Available', 'On Leave', 'Traveling'];
          const travelStatus = travelStatuses[Math.floor(Math.random() * travelStatuses.length)];
          
          const higherCerts = ['Master Unlimited', 'Chief Engineer Unlimited', 'None'];
          const higherCert = higherCerts[Math.floor(Math.random() * higherCerts.length)];
          
          const performances = ['Excellent', 'Good', 'Average'];
          const performance = performances[Math.floor(Math.random() * performances.length)];
          
          return {
            id: crew.id,
            name: `${crew.firstName} ${crew.middleName || ''} ${crew.familyName || ''}`.trim(),
            rank: crew.presentRank,
            pool,
            manningAgent: crew.manningAgent,
            shipType,
            nationality: crew.nationality,
            travelStatus,
            higherCert,
            performance,
            experience
          };
        });
      
      res.json(filteredCrew);
    } catch (error) {
      console.error("Failed to fetch crew by rank:", error);
      res.status(500).json({ error: "Failed to fetch crew members by rank" });
    }
  });

  app.get("/api/crew-members", async (req, res) => {
    try {
      const crewMembers = await storage.getCrewMembers();
      // Normalize crew members for table/frontend consumption
      const normalizedCrewMembers = crewMembers.map(normalizeCrewMemberForTable);
      res.json(normalizedCrewMembers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crew members" });
    }
  });

  app.get("/api/crew-members/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const crewMember = await storage.getCrewMember(id);
      if (!crewMember) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      // Use same normalization as list endpoint for consistency
      const normalizedCrewMember = normalizeCrewMemberForTable(crewMember);
      res.json(normalizedCrewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crew member" });
    }
  });

  app.post("/api/crew-members", async (req, res) => {
    try {
      // Check if this is form data from CrewInfoForm (comprehensive)
      // or simple crew member data (basic fields only)
      let mappedData;
      if (req.body.documents || req.body.education || req.body.licenses || req.body.currentCompanySeaService) {
        // This is comprehensive form data - use form mapping
        mappedData = mapFormDataToStorage(req.body);
      } else {
        // This is basic crew member data - use direct storage mapping
        mappedData = toStorageCrew(req.body);
      }
      
      // Auto-assign crew ID if not provided (backwards compatibility)
      if (!mappedData.employeeId) {
        mappedData.employeeId = await storage.getNextCrewId();
      }
      
      const result = insertCrewMemberSchema.safeParse(mappedData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid crew member data", details: result.error.issues });
      }
      const crewMember = await storage.createCrewMember(result.data);
      
      // Return normalized data to frontend
      const normalizedCrewMember = fromStorageCrew(crewMember);
      res.status(201).json(normalizedCrewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to create crew member" });
    }
  });

  app.put("/api/crew-members/:id", async (req, res) => {
    try {
      const id = req.params.id;
      
      // Check if this is form data from CrewInfoForm (comprehensive)
      // or simple crew member data (basic fields only)
      let mappedData;
      if (req.body.documents || req.body.education || req.body.licenses || req.body.currentCompanySeaService) {
        // This is comprehensive form data - use form mapping
        mappedData = mapFormDataToStorage(req.body);
      } else {
        // This is basic crew member data - use direct storage mapping
        mappedData = toStorageCrew(req.body);
      }
      
      const result = insertCrewMemberSchema.partial().safeParse(mappedData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid crew member data", details: result.error.issues });
      }
      const crewMember = await storage.updateCrewMember(id, result.data);
      if (!crewMember) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      
      // Return normalized data to frontend
      const normalizedCrewMember = fromStorageCrew(crewMember);
      res.json(normalizedCrewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to update crew member" });
    }
  });

  // PATCH route for partial updates (used by CrewInfoForm)
  app.patch("/api/crew-members/:id", async (req, res) => {
    try {
      const id = req.params.id;
      
      // Check if this is form data from CrewInfoForm (comprehensive)
      // or simple crew member data (basic fields only)
      let mappedData;
      if (req.body.documents || req.body.education || req.body.licenses || req.body.currentCompanySeaService) {
        // This is comprehensive form data - use form mapping
        mappedData = mapFormDataToStorage(req.body);
      } else {
        // This is basic crew member data - use direct storage mapping
        mappedData = toStorageCrew(req.body);
      }
      
      const result = insertCrewMemberSchema.partial().safeParse(mappedData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid crew member data", details: result.error.issues });
      }
      const crewMember = await storage.updateCrewMember(id, result.data);
      if (!crewMember) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      
      // Return normalized data to frontend
      const normalizedCrewMember = fromStorageCrew(crewMember);
      res.json(normalizedCrewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to update crew member" });
    }
  });

  app.delete("/api/crew-members/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteCrewMember(id);
      if (!deleted) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete crew member" });
    }
  });

  // Rotation module - Due crew endpoint
  app.get("/api/rotation/due-crew", async (req, res) => {
    try {
      const { filterType, vessels, fleet, addGroup, dueIn, rank } = req.query;
      
      // Fetch all crew members and vessel planning data
      const crewMembers = await storage.getCrewMembers();
      
      // Get all vessel planning data (we'll need to join this)
      const allPlanningPromises = crewMembers.map(async (crew) => {
        if (!crew.presentVessel) return null;
        try {
          const planning = await storage.getVesselPlanningByVessel(crew.presentVessel);
          return planning;
        } catch {
          return [];
        }
      });
      const allPlanning = await Promise.all(allPlanningPromises);
      const planningMap = new Map<string, any[]>();
      allPlanning.forEach((planning, idx) => {
        if (planning && crewMembers[idx]) {
          const vessel = crewMembers[idx].presentVessel;
          if (vessel) {
            planningMap.set(vessel, planning);
          }
        }
      });

      // Process crew members with contract date calculations
      const processedCrew = crewMembers
        .filter(crew => crew.presentRank && crew.presentVessel)
        .map(crew => {
          const vesselPlanning = planningMap.get(crew.presentVessel || '') || [];
          
          // Debug vessel planning data
          if (crew.id === 'A000304' || crew.id === 'A000502') {
            console.log(`🔍 [VESSEL PLANNING] ${crew.id} - presentVessel: "${crew.presentVessel}"`, {
              planningCount: vesselPlanning.length,
              planningCrewIds: vesselPlanning.map((p: any) => `${p.crewMemberId} (${p.rank})`),
            });
          }
          
          // Find matching planning data by rank (including crew member match)
          const matchingPlan = vesselPlanning.find(p => 
            p.rank === crew.presentRank && p.crewMemberId === crew.id
          );
          
          // Get dates from vesselPlanning if available, otherwise from crew record
          const rawJoiningDate = matchingPlan?.joiningDate || crew.joiningDate;
          const rawReliefDue = matchingPlan?.reliefDueDate || crew.reliefDue;
          
          // Debug logging
          if (crew.id === 'A000304' || crew.id === 'A000502') {
            console.log(`🔍 [PLANNING DEBUG] ${crew.presentRank} - ${crew.firstName} (${crew.id}):`, {
              matchingPlan: matchingPlan ? `Found (crewId: ${matchingPlan.crewMemberId})` : 'Not found',
              rawJoiningDate,
              rawReliefDue,
            });
          }
          
          // Calculate range dates with defaults (1 month if no planning data)
          const rangeEndMonths = matchingPlan?.contractEndRangeEndMonths ?? 1;
          const rangeStartMonths = matchingPlan?.contractEndRangeStartMonths ?? 0;
          
          // Parse dates using centralized utility (handles all formats)
          const joiningDate = parseFlexibleDate(rawJoiningDate || '');
          const reliefDue = parseFlexibleDate(rawReliefDue || '');
          
          // Only include crew with valid relief due date
          if (!reliefDue) return null;

          // Calculate range dates
          const rangeStartDate = new Date(reliefDue);
          rangeStartDate.setMonth(rangeStartDate.getMonth() + rangeStartMonths);
          
          const rangeEndDate = new Date(reliefDue);
          rangeEndDate.setMonth(rangeEndDate.getMonth() + rangeEndMonths);

          return {
            id: crew.id,
            vessel: crew.presentVessel,
            rank: crew.presentRank,
            name: `${crew.firstName} ${crew.middleName || ''} ${crew.familyName || ''}`.trim(),
            reliefDue: rawReliefDue,
            contractStartDate: rawJoiningDate,
            contractEndDate: rawReliefDue,
            rangeStartDate: rangeStartDate.toISOString().split('T')[0],
            rangeEndDate: rangeEndDate.toISOString().split('T')[0],
            nationality: crew.nationality,
            // Include raw dates for filtering
            _reliefDueDate: reliefDue,
            _rangeEndDate: rangeEndDate,
          };
        })
        .filter((crew): crew is NonNullable<typeof crew> => crew !== null);

      // Apply filters
      let filteredCrew = processedCrew;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Apply vessel/fleet/addGroup filter
      if (filterType === 'vessel' && vessels) {
        const vesselList = Array.isArray(vessels) ? vessels : [vessels];
        filteredCrew = filteredCrew.filter(crew => vesselList.includes(crew.vessel));
      } else if (filterType === 'fleet' && fleet) {
        // TODO: Implement fleet filtering when fleet master data is available
      } else if (filterType === 'addGroup' && addGroup) {
        // TODO: Implement additional group filtering when group master data is available
      }

      // Apply rank filter (handle both single rank and multiple ranks)
      if (rank) {
        const rankList = Array.isArray(rank) 
          ? rank.filter(r => typeof r === 'string' && r.trim())
          : typeof rank === 'string' ? [rank] : [];
        if (rankList.length > 0) {
          // Build a set of base ranks from role variants (normalize "_1", "_2" suffixes)
          const baseRanksFromVariants = new Set<string>();
          rankList.forEach(r => {
            if (typeof r === 'string' && r.includes('_')) {
              const baseRank = r.substring(0, r.lastIndexOf('_'));
              baseRanksFromVariants.add(baseRank);
            }
          });
          
          filteredCrew = filteredCrew.filter(crew => {
            // Direct match (crew rank exactly in query list)
            if (rankList.includes(crew.rank)) return true;
            // Base rank match (crew rank is the base of a queried variant)
            if (baseRanksFromVariants.has(crew.rank)) return true;
            return false;
          });
        }
      }

      // Apply dueIn filter
      if (dueIn) {
        const monthsMap: Record<string, number> = {
          '3m': 3,
          '2m': 2,
          '1m': 1,
        };

        if (dueIn === 'overdue') {
          // Range End Date is before today
          filteredCrew = filteredCrew.filter(crew => crew._rangeEndDate < today);
        } else if (dueIn === 'overdue1m') {
          // Range End Date is within next month and >= today
          const oneMonthFromNow = new Date(today);
          oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
          filteredCrew = filteredCrew.filter(crew => 
            crew._rangeEndDate >= today && crew._rangeEndDate <= oneMonthFromNow
          );
        } else if (monthsMap[dueIn as string]) {
          // Relief Due is within X months from today
          const months = monthsMap[dueIn as string];
          const targetDate = new Date(today);
          targetDate.setMonth(targetDate.getMonth() + months);
          filteredCrew = filteredCrew.filter(crew => 
            crew._reliefDueDate >= today && crew._reliefDueDate <= targetDate
          );
        }
      }

      // Remove temporary fields before sending
      const cleanedCrew = filteredCrew.map(crew => {
        const { _reliefDueDate, _rangeEndDate, ...cleanCrew } = crew as any;
        return cleanCrew;
      });

      res.json(cleanedCrew);
    } catch (error) {
      console.error("Failed to fetch rotation due crew:", error);
      res.status(500).json({ error: "Failed to fetch rotation due crew" });
    }
  });

  // Assign crew IDs to existing crew members who don't have them
  app.post("/api/crew-members/assign-ids", async (req, res) => {
    try {
      const crewMembers = await storage.getCrewMembers();
      const crewMembersWithoutIds = crewMembers.filter(cm => !cm.employeeId);
      
      if (crewMembersWithoutIds.length === 0) {
        return res.json({ 
          message: "All crew members already have IDs", 
          totalCrew: crewMembers.length 
        });
      }

      let updatedCount = 0;
      for (const crewMember of crewMembersWithoutIds) {
        const crewId = await storage.getNextCrewId();
        const updated = await storage.updateCrewMember(crewMember.id, { employeeId: crewId });
        if (updated) {
          updatedCount++;
          console.log(`✅ Assigned crew ID ${crewId} to ${crewMember.firstName} ${crewMember.familyName || 'Unknown'}`);
        }
      }

      res.json({ 
        message: "Crew ID assignment completed", 
        updatedCount,
        totalWithoutIds: crewMembersWithoutIds.length 
      });
    } catch (error) {
      console.error("Error assigning crew IDs:", error);
      res.status(500).json({ error: "Failed to assign crew IDs" });
    }
  });

  // Dashboard Summary endpoint
  app.get("/api/crew-members/:id/dashboard", async (req, res) => {
    try {
      const id = req.params.id;
      const dashboardSummary = await storage.getCrewDashboardSummary(id);
      if (!dashboardSummary) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      res.json(dashboardSummary);
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });

  // Retroactive crew ID assignment endpoint
  app.post("/api/crew-members/assign-missing-ids", async (req, res) => {
    try {
      console.log("🔄 Starting retroactive crew ID assignment...");
      
      // Get all crew members
      const allCrewMembers = await storage.getCrewMembers();
      
      // Find crew members without crew IDs (employeeId is null or empty)
      const crewMembersNeedingIds = allCrewMembers.filter(member => 
        !member.employeeId || member.employeeId === null || member.employeeId === ''
      );
      
      console.log(`📊 Found ${crewMembersNeedingIds.length} crew members needing crew IDs`);
      
      if (crewMembersNeedingIds.length === 0) {
        return res.json({ 
          success: true, 
          message: "No crew members need crew ID assignment",
          assigned: []
        });
      }
      
      const assignments = [];
      
      // Assign crew IDs to each crew member needing one
      for (const crewMember of crewMembersNeedingIds) {
        try {
          // Get next crew ID
          const newCrewId = await storage.getNextCrewId();
          
          // Update the crew member with the new ID
          await storage.updateCrewMember(crewMember.id, { employeeId: newCrewId });
          
          assignments.push({
            id: crewMember.id,
            name: `${crewMember.firstName} ${crewMember.familyName}`,
            assignedId: newCrewId
          });
          
          console.log(`✅ Assigned ${newCrewId} to ${crewMember.firstName} ${crewMember.familyName}`);
        } catch (error) {
          console.error(`❌ Failed to assign crew ID to ${crewMember.firstName} ${crewMember.familyName}:`, error);
        }
      }
      
      console.log(`🎉 Successfully assigned crew IDs to ${assignments.length} crew members`);
      
      res.json({ 
        success: true,
        message: `Successfully assigned crew IDs to ${assignments.length} crew members`,
        assigned: assignments
      });
      
    } catch (error) {
      console.error("❌ Failed to assign missing crew IDs:", error);
      res.status(500).json({ error: "Failed to assign missing crew IDs" });
    }
  });

  // Appraisal Results API routes
  app.get("/api/appraisals", async (req, res) => {
    try {
      const appraisals = await storage.getAppraisalResults();
      res.json(appraisals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appraisals" });
    }
  });

  app.get("/api/appraisals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const appraisal = await storage.getAppraisalResult(id);
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appraisal" });
    }
  });

  app.get("/api/appraisals/crew/:crewMemberId", async (req, res) => {
    try {
      const crewMemberId = req.params.crewMemberId;
      const appraisals = await storage.getAppraisalResultsByCrewMember(crewMemberId);
      res.json(appraisals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appraisals for crew member" });
    }
  });

  app.post("/api/appraisals", async (req, res) => {
    try {
      const result = insertAppraisalResultSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid appraisal data", details: result.error.issues });
      }
      const appraisal = await storage.createAppraisalResult(result.data);
      res.status(201).json(appraisal);
    } catch (error) {
      res.status(500).json({ error: "Failed to create appraisal" });
    }
  });

  app.put("/api/appraisals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertAppraisalResultSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid appraisal data", details: result.error.issues });
      }
      const appraisal = await storage.updateAppraisalResult(id, result.data);
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error) {
      res.status(500).json({ error: "Failed to update appraisal" });
    }
  });

  app.delete("/api/appraisals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteAppraisalResult(id);
      if (!deleted) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete appraisal" });
    }
  });

  // Recruitment Candidates API routes
  app.get("/api/recruitment-candidates", async (req, res) => {
    try {
      const { status } = req.query;
      let candidates;
      
      if (status && typeof status === 'string') {
        candidates = await storage.getRecruitmentCandidatesByStatus(status);
      } else {
        candidates = await storage.getRecruitmentCandidates();
      }
      
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recruitment candidates" });
    }
  });

  app.get("/api/recruitment-candidates/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const candidate = await storage.getRecruitmentCandidate(id);
      if (!candidate) {
        return res.status(404).json({ error: "Recruitment candidate not found" });
      }
      res.json(candidate);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recruitment candidate" });
    }
  });

  app.post("/api/recruitment-candidates", async (req, res) => {
    try {
      const result = insertRecruitmentCandidateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid recruitment candidate data", details: result.error.issues });
      }
      const candidate = await storage.createRecruitmentCandidate(result.data);
      res.status(201).json(candidate);
    } catch (error) {
      res.status(500).json({ error: "Failed to create recruitment candidate" });
    }
  });

  app.patch("/api/recruitment-candidates/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertRecruitmentCandidateSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid recruitment candidate data", details: result.error.issues });
      }
      const candidate = await storage.updateRecruitmentCandidate(id, result.data);
      if (!candidate) {
        return res.status(404).json({ error: "Recruitment candidate not found" });
      }
      res.json(candidate);
    } catch (error) {
      res.status(500).json({ error: "Failed to update recruitment candidate" });
    }
  });

  app.delete("/api/recruitment-candidates/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteRecruitmentCandidate(id);
      if (!deleted) {
        return res.status(404).json({ error: "Recruitment candidate not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete recruitment candidate" });
    }
  });

  // Data Masters API routes
  app.get("/api/masters", async (req, res) => {
    try {
      const masters = await storage.getDataMasters();
      res.json(masters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch masters" });
    }
  });

  app.get("/api/masters/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const master = await storage.getDataMaster(id);
      if (!master) {
        return res.status(404).json({ error: "Master not found" });
      }
      res.json(master);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master" });
    }
  });

  app.post("/api/masters", async (req, res) => {
    try {
      const result = insertDataMasterSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data", details: result.error.issues });
      }
      const master = await storage.createDataMaster(result.data);
      res.status(201).json(master);
    } catch (error) {
      res.status(500).json({ error: "Failed to create master" });
    }
  });

  app.put("/api/masters/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertDataMasterSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data", details: result.error.issues });
      }
      const master = await storage.updateDataMaster(id, result.data);
      if (!master) {
        return res.status(404).json({ error: "Master not found" });
      }
      res.json(master);
    } catch (error) {
      res.status(500).json({ error: "Failed to update master" });
    }
  });

  app.delete("/api/masters/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteDataMaster(id);
      if (!deleted) {
        return res.status(404).json({ error: "Master not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete master" });
    }
  });

  // Master Data Entries API routes
  app.get("/api/masters/:id/data", async (req, res) => {
    try {
      const masterId = req.params.id;
      const entries = await storage.getMasterDataEntries(masterId);
      
      // Apply master-specific response mapping if needed
      let responseEntries = entries;
      if (needsSpecialHandling(masterId) && entries) {
        responseEntries = entries.map((entry: any) => applyMasterSpecificMapping(entry, masterId));
        // Only log in development mode for performance
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔧 [GET_LIST] Applied transformations for master ${masterId}, entries count: ${responseEntries.length}`);
        }
      } else if (entries) {
        // Apply basic field transformation for regular masters (snake_case to camelCase)
        responseEntries = entries.map((entry: any) => applyBasicFieldTransformation(entry));
        // Only log in development mode for performance
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔧 [GET_LIST] Applied basic field transformation for master ${masterId}, entries count: ${responseEntries.length}`);
        }
      }
      
      res.json(responseEntries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master data entries" });
    }
  });

  app.get("/api/master-data/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.getMasterDataEntry(id);
      if (!entry) {
        return res.status(404).json({ error: "Master data entry not found" });
      }
      
      // Apply master-specific response mapping if needed
      let responseEntry = entry;
      const masterId = (entry as any).master_id || (entry as any).masterId;
      if (needsSpecialHandling(masterId)) {
        responseEntry = applyMasterSpecificMapping(entry, masterId);
        console.log(`🔧 [GET_SINGLE] Applied transformations for master ${masterId}:`, responseEntry);
      } else {
        // Apply basic field transformation for regular masters (snake_case to camelCase)
        responseEntry = applyBasicFieldTransformation(entry);
        console.log(`🔧 [GET_SINGLE] Applied basic field transformation for master ${masterId}`);
      }
      
      res.json(responseEntry);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master data entry" });
    }
  });

  app.post("/api/masters/:id/data", async (req, res) => {
    try {
      const masterId = req.params.id;
      console.log(`🔍 [DEBUG CREATE] Storage type: ${storage.constructor.name}, Master ID: ${masterId}, Payload:`, req.body);
      
      // Apply master-specific filtering and transformation BEFORE validation
      let requestData = { ...req.body, masterId };
      if (needsSpecialHandling(masterId)) {
        console.log(`🔧 [CREATE] Special master detected (${masterId}) - applying transformations BEFORE validation`);
        
        // Apply appropriate filtering/transformation based on master type
        requestData = applyMasterSpecificFiltering(requestData, masterId);
        console.log(`🔧 [CREATE] Filtered request data for validation:`, requestData);
        
        // Validate entry after transformation
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
        console.log(`❌ [DEBUG CREATE] Validation failed:`, result.error.issues);
        return res.status(400).json({ error: "Invalid master data entry", details: result.error.issues });
      }
      
      console.log(`📤 [DEBUG CREATE] Calling storage.createMasterDataEntry with:`, result.data);
      const entry = await storage.createMasterDataEntry(result.data);
      console.log(`✅ [DEBUG CREATE] Created entry:`, entry);
      
      // Apply master-specific response mapping if needed
      let responseEntry = entry;
      if (needsSpecialHandling(masterId) && entry) {
        responseEntry = applyMasterSpecificMapping(entry, masterId);
        console.log(`🔧 [CREATE] Mapped response for master ${masterId}:`, responseEntry);
      }
      
      // Verify persistence by immediately fetching the entry
      if (entry && entry.id) {
        try {
          const fetchedEntry = await storage.getMasterDataEntry(entry.id);
          console.log(`🔎 [DEBUG CREATE] Immediate fetch result:`, fetchedEntry);
        } catch (fetchError) {
          console.log(`❌ [DEBUG CREATE] Immediate fetch failed:`, fetchError);
        }
      }
      
      res.status(201).json(responseEntry);
    } catch (error) {
      console.log(`💥 [DEBUG CREATE] Exception:`, error);
      res.status(500).json({ error: "Failed to create master data entry" });
    }
  });

  app.put("/api/master-data/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get existing entry to check master ID for special handling
      const existingEntry = await storage.getMasterDataEntry(id);
      if (!existingEntry) {
        return res.status(404).json({ error: "Master data entry not found" });
      }
      
      const masterId = (existingEntry as any).master_id;
      
      // Apply master-specific filtering and transformation BEFORE validation if needed
      let requestData = req.body;
      
      // Check if this is a description-only update (simple text entry)
      const isDescriptionOnlyUpdate = req.body.description !== undefined && 
        Object.keys(req.body).filter(key => key !== 'masterId' && key !== 'description').length === 0;
      
      if (needsSpecialHandling(masterId) && !isDescriptionOnlyUpdate) {
        console.log(`🔧 [UPDATE] Special master detected (${masterId}) for entry ${id} - applying transformations BEFORE validation`);
        
        // Apply appropriate filtering/transformation based on master type
        requestData = applyMasterSpecificFiltering(req.body, masterId);
        console.log(`🔧 [UPDATE] Original update data:`, req.body);
        console.log(`🔧 [UPDATE] Filtered update data for validation:`, requestData);
        
        // Validate entry after transformation
        if (req.body.vessel || req.body.name || req.body.vesselIds || req.body.VesselIDs) {
          const validation = validateMasterSpecificEntry(requestData, masterId);
          if (!validation.isValid) {
            return res.status(400).json({ 
              error: `Invalid ${masterId} master data`, 
              details: validation.error 
            });
          }
        }
      } else if (isDescriptionOnlyUpdate) {
        console.log(`📝 [UPDATE] Description-only update detected for entry ${id} - bypassing special transformations`);
      }
      
      const result = insertMasterDataEntrySchema.partial().safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data entry", details: result.error.issues });
      }
      
      const entry = await storage.updateMasterDataEntry(id, result.data);
      if (!entry) {
        return res.status(404).json({ error: "Master data entry not found" });
      }
      
      // Apply master-specific response mapping if needed
      let responseEntry = entry;
      if (needsSpecialHandling(masterId)) {
        responseEntry = applyMasterSpecificMapping(entry, masterId);
        console.log(`🔧 [UPDATE] Mapped response for master ${masterId}:`, responseEntry);
      }
      
      res.json(responseEntry);
    } catch (error) {
      console.error(`💥 [UPDATE] Exception:`, error);
      res.status(500).json({ error: "Failed to update master data entry" });
    }
  });

  app.delete("/api/master-data/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`🔍 [DEBUG DELETE] Storage type: ${storage.constructor.name}, Entry ID: ${id}`);
      
      // First check if entry exists
      try {
        const existingEntry = await storage.getMasterDataEntry(id);
        console.log(`🔎 [DEBUG DELETE] Pre-delete fetch result:`, existingEntry);
      } catch (fetchError) {
        console.log(`❌ [DEBUG DELETE] Pre-delete fetch failed:`, fetchError);
      }
      
      console.log(`📤 [DEBUG DELETE] Calling storage.deleteMasterDataEntry with ID: ${id}`);
      const deleted = await storage.deleteMasterDataEntry(id);
      console.log(`✅ [DEBUG DELETE] Delete result: ${deleted}`);
      
      if (!deleted) {
        console.log(`❌ [DEBUG DELETE] Entry not found in storage for ID: ${id}`);
        return res.status(404).json({ error: "Master data entry not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.log(`💥 [DEBUG DELETE] Exception:`, error);
      res.status(500).json({ error: "Failed to delete master data entry" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
