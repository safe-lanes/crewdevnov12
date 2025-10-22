import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, isConnected, connectionError } from "./storage";
import { insertFormSchema, insertRankGroupSchema, insertAvailableRankSchema, updateAvailableRankSchema, insertCrewMemberSchema, insertAppraisalResultSchema, insertRecruitmentCandidateSchema, insertPromotionHierarchySchema, insertDataMasterSchema, insertMasterDataEntrySchema, insertVesselGroupSchema, insertVesselDraftSchema, insertVesselRevisionSchema, insertVesselPlanningSchema, insertRotationPlanSchema, insertDrugAlcoholTestRecordSchema } from "@shared/schema";
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

  app.get("/api/forms/for-rank/:rankLabel", async (req, res) => {
    try {
      const rankLabel = req.params.rankLabel;
      const category = req.query.category as string | undefined;
      const form = await storage.getFormForRank(rankLabel, category);
      if (!form) {
        return res.status(404).json({ error: "No form configured for this rank" });
      }
      res.json(form);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch form for rank" });
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

  // Promotion Hierarchies endpoints
  app.get("/api/promotion-hierarchies", async (req, res) => {
    try {
      const hierarchies = await storage.getPromotionHierarchies();
      // Parse rankPath JSON string to array for frontend
      const parsedHierarchies = hierarchies.map(h => ({
        ...h,
        rankPath: typeof h.rankPath === 'string' ? JSON.parse(h.rankPath) : h.rankPath
      }));
      res.json(parsedHierarchies);
    } catch (error) {
      console.error("❌ Failed to fetch promotion hierarchies:", error);
      res.status(500).json({ error: "Failed to fetch promotion hierarchies" });
    }
  });

  app.get("/api/promotion-hierarchies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const hierarchy = await storage.getPromotionHierarchy(id);
      if (!hierarchy) {
        return res.status(404).json({ error: "Promotion hierarchy not found" });
      }
      // Parse rankPath JSON string to array for frontend
      const parsedHierarchy = {
        ...hierarchy,
        rankPath: typeof hierarchy.rankPath === 'string' ? JSON.parse(hierarchy.rankPath) : hierarchy.rankPath
      };
      res.json(parsedHierarchy);
    } catch (error) {
      console.error("❌ Failed to fetch promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to fetch promotion hierarchy" });
    }
  });

  app.post("/api/promotion-hierarchies", async (req, res) => {
    try {
      const result = insertPromotionHierarchySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid promotion hierarchy data", details: result.error.issues });
      }
      const hierarchy = await storage.createPromotionHierarchy(result.data);
      // Parse rankPath JSON string to array for frontend
      const parsedHierarchy = {
        ...hierarchy,
        rankPath: typeof hierarchy.rankPath === 'string' ? JSON.parse(hierarchy.rankPath) : hierarchy.rankPath
      };
      res.status(201).json(parsedHierarchy);
    } catch (error) {
      console.error("❌ Failed to create promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to create promotion hierarchy" });
    }
  });

  app.patch("/api/promotion-hierarchies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertPromotionHierarchySchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid promotion hierarchy data", details: result.error.issues });
      }
      const hierarchy = await storage.updatePromotionHierarchy(id, result.data);
      if (!hierarchy) {
        return res.status(404).json({ error: "Promotion hierarchy not found" });
      }
      // Parse rankPath JSON string to array for frontend
      const parsedHierarchy = {
        ...hierarchy,
        rankPath: typeof hierarchy.rankPath === 'string' ? JSON.parse(hierarchy.rankPath) : hierarchy.rankPath
      };
      res.json(parsedHierarchy);
    } catch (error) {
      console.error("❌ Failed to update promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to update promotion hierarchy" });
    }
  });

  app.delete("/api/promotion-hierarchies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePromotionHierarchy(id);
      if (!success) {
        return res.status(404).json({ error: "Promotion hierarchy not found" });
      }
      res.json({ success: true, message: "Promotion hierarchy deleted successfully" });
    } catch (error) {
      console.error("❌ Failed to delete promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to delete promotion hierarchy" });
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
      let { vesselId } = req.params;
      console.log(`📜 [VESSEL RANKS API] Fetching ranks for vessel: ${vesselId}`);
      
      // BACKWARD COMPATIBILITY: If vesselId doesn't start with VSL-, try to translate to canonical ID
      if (!vesselId.startsWith('VSL-')) {
        console.log(`📜 [VESSEL RANKS API] vesselId doesn't start with VSL-, attempting translation`);
        const vessels = await storage.getMasterDataEntries("014"); // Get all vessels
        
        // Try matching by name first, then by numeric ID
        let matchedVessel = vessels.find((v: any) => 
          v.name === vesselId || v.vessel === vesselId
        );
        
        // If not found by name and vesselId is numeric, try matching by master data entry ID
        if (!matchedVessel && /^\d+$/.test(vesselId)) {
          matchedVessel = vessels.find((v: any) => String(v.id) === vesselId);
          if (matchedVessel) {
            console.log(`📜 [VESSEL RANKS API] Matched numeric ID "${vesselId}" to vessel entry`);
          }
        }
        
        if (matchedVessel) {
          const translatedId = matchedVessel.entryId;
          console.log(`📜 [VESSEL RANKS API] Translated "${vesselId}" to canonical ID "${translatedId}"`);
          vesselId = translatedId;
        } else {
          console.log(`📜 [VESSEL RANKS API] No vessel found matching "${vesselId}"`);
        }
      }
      
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
      
      // JOIN with crew members to get complete data from single source of truth
      const crewMembers = await storage.getCrewMembers();
      const crewMap = new Map(crewMembers.map((c: any) => [c.id || c.employeeId, c]));
      
      // Enrich planning data with crew member information
      const enrichedPlanning = planning.map((p: any) => {
        if (p.crewMemberId) {
          const crew: any = crewMap.get(p.crewMemberId);
          if (crew) {
            return {
              ...p,
              // Override with data from crew members (single source of truth)
              crewName: `${crew.firstName || ''} ${crew.lastName || ''}`.trim(),
              nationality: crew.nationality,
              reliefDue: crew.reliefDue,
              reliefDate: crew.reliefDue, // Alias for backward compatibility
              // Keep crew member reference for future use
              crewMemberData: {
                id: crew.id,
                employeeId: crew.employeeId,
                firstName: crew.firstName,
                lastName: crew.lastName,
                nationality: crew.nationality,
                presentRank: crew.presentRank
              }
            };
          }
        }
        return p;
      });
      
      res.json(enrichedPlanning);
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

  // Drug/Alcohol Test Records API routes
  app.get("/api/drug-alcohol-tests", async (req, res) => {
    try {
      const records = await storage.getDrugAlcoholTestRecords();
      res.json(records);
    } catch (error) {
      console.error("Failed to fetch drug/alcohol test records:", error);
      res.status(500).json({ error: "Failed to fetch drug/alcohol test records" });
    }
  });

  app.get("/api/drug-alcohol-tests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const record = await storage.getDrugAlcoholTestRecord(id);
      if (!record) {
        return res.status(404).json({ error: "Drug/alcohol test record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to fetch drug/alcohol test record:", error);
      res.status(500).json({ error: "Failed to fetch drug/alcohol test record" });
    }
  });

  app.get("/api/drug-alcohol-tests/vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { testType } = req.query;
      const records = await storage.getDrugAlcoholTestRecordsByVessel(
        vesselId,
        testType as string | undefined
      );
      res.json(records);
    } catch (error) {
      console.error("Failed to fetch drug/alcohol test records by vessel:", error);
      res.status(500).json({ error: "Failed to fetch drug/alcohol test records by vessel" });
    }
  });

  app.post("/api/drug-alcohol-tests", async (req, res) => {
    try {
      const result = insertDrugAlcoholTestRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid drug/alcohol test record data", details: result.error.issues });
      }
      const record = await storage.createDrugAlcoholTestRecord(result.data);
      res.status(201).json(record);
    } catch (error) {
      console.error("Failed to create drug/alcohol test record:", error);
      res.status(500).json({ error: "Failed to create drug/alcohol test record" });
    }
  });

  app.put("/api/drug-alcohol-tests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const result = insertDrugAlcoholTestRecordSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid drug/alcohol test record data", details: result.error.issues });
      }
      const record = await storage.updateDrugAlcoholTestRecord(id, result.data);
      if (!record) {
        return res.status(404).json({ error: "Drug/alcohol test record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to update drug/alcohol test record:", error);
      res.status(500).json({ error: "Failed to update drug/alcohol test record" });
    }
  });

  app.delete("/api/drug-alcohol-tests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const deleted = await storage.deleteDrugAlcoholTestRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Drug/alcohol test record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete drug/alcohol test record:", error);
      res.status(500).json({ error: "Failed to delete drug/alcohol test record" });
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

  /**
   * AUTOMATIC SYNCHRONIZATION HELPERS
   * These ensure crew members automatically appear in Planning, Officer Matrix, and Training Matrix
   */
  
  /**
   * Auto-create vessel planning entry when crew has vessel + rank assigned
   */
  async function autoCreateVesselPlanning(crewMember: any) {
    try {
      // Only create if crew has both vessel and rank
      if (!crewMember.presentVessel || !crewMember.presentRank) {
        console.log(`⚡ [AUTO-SYNC] Skipping vessel planning for ${crewMember.id}: no vessel or rank assigned`);
        return null;
      }

      const crewId = crewMember.id || crewMember.employeeId;
      
      // Check if planning entry already exists for this crew member
      const allPlanning = await storage.getVesselPlanningByVessel(crewMember.presentVessel);
      const existingEntry = allPlanning.find((p: any) => p.crewMemberId === crewId);
      
      if (existingEntry) {
        console.log(`⚡ [AUTO-SYNC] Vessel planning already exists for ${crewId}`);
        
        // 🔄 UPDATE CREW MEMBER'S RANK TO MATCH EXISTING PLANNING POSITION
        const assignedPosition = existingEntry.rank;
        const crewRank = crewMember.presentRank;
        if (assignedPosition && assignedPosition !== crewRank) {
          await storage.updateCrewMember(crewId, { 
            presentRank: assignedPosition 
          });
          console.log(`✅ [AUTO-SYNC] Updated crew ${crewId} rank: ${crewRank} → ${assignedPosition}`);
        }
        
        return existingEntry;
      }

      // Get vessel revisions to find the correct rank ID
      const vesselRevisions = await storage.getVesselRevisionsByVessel(crewMember.presentVessel);
      
      if (vesselRevisions.length === 0) {
        console.log(`⚡ [AUTO-SYNC] No vessel revisions found for ${crewMember.presentVessel}`);
        return null;
      }

      // Get latest revision
      const latestRevision = vesselRevisions.sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      })[0];

      const rankData = JSON.parse(latestRevision.revisionData);
      
      // Find matching rank in vessel revision
      // Match by exact role/rank name or by stripping suffix (e.g., "3rd Officer_1" -> "3rd Officer")
      const crewRank = crewMember.presentRank;
      
      // Find ALL matching ranks (handles positions with numeric suffixes like AB_1, AB_2, AB_3)
      const matchingRanks = rankData.filter((r: any) => {
        const rankName = (r.role || r.rank)?.split('_')[0];
        return (r.role === crewRank || r.rank === crewRank || rankName === crewRank);
      });
      
      // 🔧 PRIORITIZE NUMBERED POSITIONS: If both base rank and numbered positions exist,
      // only use numbered positions (rows with 'role' field like AB_1, AB_2, AB_3)
      // Filter to rows that have a role value (excludes base rank rows where role is null)
      const rolePositions = matchingRanks.filter((r: any) => r.role !== null && r.role !== undefined);
      const finalMatchingRanks = rolePositions.length > 0 ? rolePositions : matchingRanks;
      
      console.log(`⚡ [AUTO-SYNC] Matching ranks for ${crewRank}: ${matchingRanks.length}, Role positions: ${rolePositions.length}`);

      if (finalMatchingRanks.length === 0) {
        console.log(`⚡ [AUTO-SYNC] Rank ${crewRank} not found in vessel ${crewMember.presentVessel} revision`);
        return null;
      }

      // If multiple positions exist (e.g., AB_1, AB_2, AB_3), find the first VACANT one
      let matchingRank = null;
      if (finalMatchingRanks.length > 1) {
        // Get existing planning to check which positions are occupied
        for (const rank of finalMatchingRanks) {
          const rankId = rank.id || rank.rankId;
          const isOccupied = allPlanning.some((p: any) => 
            p.rankId === rankId && p.crewMemberId && p.crewMemberId !== crewId
          );
          if (!isOccupied) {
            matchingRank = rank;
            console.log(`⚡ [AUTO-SYNC] Found vacant position: ${rank.role || rank.rank} for ${crewRank}`);
            break;
          }
        }
        
        if (!matchingRank) {
          console.log(`⚡ [AUTO-SYNC] All ${crewRank} positions are occupied on vessel ${crewMember.presentVessel}`);
          return null;
        }
      } else {
        // Only one position, use it
        matchingRank = finalMatchingRanks[0];
      }

      // Create vessel planning entry
      const assignedPosition = matchingRank.role || matchingRank.rank;
      const planningData = {
        vesselId: crewMember.presentVessel,
        rankId: matchingRank.id || matchingRank.rankId,
        rank: assignedPosition,
        crewMemberId: crewId,
        reliefDue: crewMember.reliefDue || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const created = await storage.createVesselPlanning(planningData);
      
      // 🔄 UPDATE CREW MEMBER'S RANK TO MATCH ASSIGNED POSITION
      // This ensures Crew List shows the same position as Planning/Officer Matrix
      if (assignedPosition !== crewRank) {
        await storage.updateCrewMember(crewId, { 
          presentRank: assignedPosition 
        });
        console.log(`✅ [AUTO-SYNC] Updated crew ${crewId} rank: ${crewRank} → ${assignedPosition}`);
      }
      
      console.log(`✅ [AUTO-SYNC] Created vessel planning entry for ${crewId}: ${assignedPosition} on ${crewMember.presentVessel}`);
      return created;
    } catch (error) {
      console.error(`❌ [AUTO-SYNC] Failed to auto-create vessel planning:`, error);
      return null;
    }
  }

  /**
   * Update or create vessel planning when crew's vessel/rank changes
   */
  async function syncVesselPlanning(crewId: string, updates: any, oldCrew: any) {
    try {
      const vesselChanged = updates.presentVessel && updates.presentVessel !== oldCrew.presentVessel;
      const rankChanged = updates.presentRank && updates.presentRank !== oldCrew.presentRank;
      const reliefDueChanged = updates.reliefDue !== undefined && updates.reliefDue !== oldCrew.reliefDue;
      
      if (!vesselChanged && !rankChanged && !reliefDueChanged) {
        return; // No vessel/rank/relief due changes, skip sync
      }

      const newVessel = updates.presentVessel || oldCrew.presentVessel;
      const newRank = updates.presentRank || oldCrew.presentRank;

      console.log(`⚡ [AUTO-SYNC] Syncing vessel planning for ${crewId}: vessel=${newVessel}, rank=${newRank}`);

      // Find existing planning entry for this crew member
      const allPlanning = await storage.getVesselPlanningByVessel(newVessel);
      const existingEntry = allPlanning.find((p: any) => p.crewMemberId === crewId);

      if (!newVessel || !newRank) {
        // Crew unassigned - could delete planning entry, but we'll keep it for history
        console.log(`⚡ [AUTO-SYNC] Crew ${crewId} unassigned from vessel/rank`);
        return;
      }

      // Get the updated crew member data
      const updatedCrew = { ...oldCrew, ...updates };

      if (existingEntry) {
        // Update existing entry if vessel, rank, or relief due changed
        const updateData: any = {};
        
        if (vesselChanged) {
          updateData.vesselId = newVessel;
        }
        
        if (rankChanged) {
          // Need to find new rank ID from vessel revision
          const vesselRevisions = await storage.getVesselRevisionsByVessel(newVessel);
          if (vesselRevisions.length > 0) {
            const latestRevision = vesselRevisions.sort((a, b) => {
              const aDate = new Date(a.createdAt || 0).getTime();
              const bDate = new Date(b.createdAt || 0).getTime();
              return bDate - aDate;
            })[0];

            const rankData = JSON.parse(latestRevision.revisionData);
            
            // Find ALL matching positions to handle multiple ranks (AB_1, AB_2, etc.)
            const matchingRanks = rankData.filter((r: any) => {
              const rankName = (r.role || r.rank)?.split('_')[0];
              return (r.role === newRank || r.rank === newRank || rankName === newRank);
            });

            if (matchingRanks.length > 0) {
              let matchingRank = matchingRanks[0]; // Default to first match
              
              // If multiple positions exist, try to keep the same position or find vacant one
              if (matchingRanks.length > 1) {
                // First, try to find the exact position match (crew already has AB_1, keep it)
                const exactMatch = matchingRanks.find((r: any) => 
                  (r.role === newRank || r.rank === newRank)
                );
                if (exactMatch) {
                  matchingRank = exactMatch;
                } else {
                  // Find first vacant position
                  for (const rank of matchingRanks) {
                    const rankId = rank.id || rank.rankId;
                    const isOccupied = allPlanning.some((p: any) => 
                      p.rankId === rankId && p.crewMemberId && p.crewMemberId !== crewId
                    );
                    if (!isOccupied) {
                      matchingRank = rank;
                      break;
                    }
                  }
                }
              }
              
              const assignedPosition = matchingRank.role || matchingRank.rank;
              updateData.rankId = matchingRank.id || matchingRank.rankId;
              updateData.rank = assignedPosition;
              
              // 🔄 UPDATE CREW MEMBER'S RANK TO MATCH ASSIGNED POSITION
              if (assignedPosition !== newRank) {
                await storage.updateCrewMember(crewId, { 
                  presentRank: assignedPosition 
                });
                console.log(`✅ [AUTO-SYNC] Updated crew ${crewId} rank: ${newRank} → ${assignedPosition}`);
              }
            }
          }
        }

        // 🔄 Sync Relief Due date if changed
        if (updates.reliefDue !== undefined && updates.reliefDue !== oldCrew.reliefDue) {
          updateData.reliefDue = updates.reliefDue;
          console.log(`⚡ [AUTO-SYNC] Relief Due updated: ${oldCrew.reliefDue} → ${updates.reliefDue}`);
        }

        if (Object.keys(updateData).length > 0) {
          updateData.updatedAt = new Date().toISOString();
          await storage.updateVesselPlanning(existingEntry.id, updateData);
          console.log(`✅ [AUTO-SYNC] Updated vessel planning for ${crewId}`);
        }
      } else {
        // No existing entry - create new one
        await autoCreateVesselPlanning(updatedCrew);
      }
    } catch (error) {
      console.error(`❌ [AUTO-SYNC] Failed to sync vessel planning:`, error);
    }
  }

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
      
      // 🔄 AUTOMATIC SYNCHRONIZATION: Create vessel planning entry if crew has vessel + rank
      await autoCreateVesselPlanning(crewMember);
      
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
      
      // Get old crew data before update for sync comparison
      const oldCrew = await storage.getCrewMember(id);
      if (!oldCrew) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      
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
      
      // 🔄 AUTOMATIC SYNCHRONIZATION: Sync vessel planning if vessel/rank changed
      const crewId = crewMember.id || crewMember.employeeId;
      if (crewId) {
        await syncVesselPlanning(crewId, result.data, oldCrew);
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
      
      // Get old crew data before update for sync comparison
      const oldCrew = await storage.getCrewMember(id);
      if (!oldCrew) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      
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
      
      // 🔄 AUTOMATIC SYNCHRONIZATION: Sync vessel planning if vessel/rank changed
      const crewId = crewMember.id || crewMember.employeeId;
      if (crewId) {
        await syncVesselPlanning(crewId, result.data, oldCrew);
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

  // Migration/Re-sync endpoint: Create missing vessel planning entries for existing crew
  app.post("/api/crew-members/resync-planning", async (req, res) => {
    try {
      const crewMembers = await storage.getCrewMembers();
      let created = 0;
      let skipped = 0;
      let errors = 0;
      
      for (const crew of crewMembers) {
        const crewId = crew.id || crew.employeeId;
        if (!crewId || !crew.presentVessel || !crew.presentRank) {
          skipped++;
          continue;
        }
        
        try {
          const result = await autoCreateVesselPlanning(crew);
          if (result) {
            created++;
            console.log(`✅ [RE-SYNC] Created planning for ${crewId}: ${crew.presentRank} on ${crew.presentVessel}`);
          } else {
            skipped++;
          }
        } catch (error) {
          errors++;
          console.error(`❌ [RE-SYNC] Failed for ${crewId}:`, error);
        }
      }
      
      res.json({ 
        success: true, 
        total: crewMembers.length,
        created, 
        skipped, 
        errors,
        message: `Re-sync completed: ${created} planning entries created, ${skipped} skipped, ${errors} errors`
      });
    } catch (error) {
      console.error("Re-sync failed:", error);
      res.status(500).json({ error: "Failed to re-sync vessel planning" });
    }
  });

  // Rotation module - Due crew endpoint
  app.get("/api/rotation/due-crew", async (req, res) => {
    try {
      const { filterType, vessels, fleet, addGroup, dueIn, rank } = req.query;
      
      // Fetch vessel master data for ID-to-name translation
      const vesselMasterData = await storage.getMasterDataEntries("014");
      const vesselIdToNameMap = new Map<string, string>();
      if (vesselMasterData) {
        vesselMasterData.forEach((vessel: any) => {
          if (vessel.entryId && vessel.name) {
            vesselIdToNameMap.set(vessel.entryId, vessel.name);
          }
        });
      }
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
          
          // Find matching planning data by rank (including crew member match)
          const matchingPlan = vesselPlanning.find(p => 
            p.rank === crew.presentRank && p.crewMemberId === crew.id
          );
          
          // Get dates from vesselPlanning if available, otherwise from crew record
          const rawJoiningDate = matchingPlan?.joiningDate || crew.joiningDate;
          const rawReliefDue = matchingPlan?.reliefDueDate || crew.reliefDue;
          
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
            vesselId: crew.presentVessel, // Keep ID for filtering
            vessel: vesselIdToNameMap.get(crew.presentVessel || '') || crew.presentVessel, // Translated name for display
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
        filteredCrew = filteredCrew.filter(crew => vesselList.includes(crew.vesselId));
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
