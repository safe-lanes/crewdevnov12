import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, isConnected, connectionError } from "./storage";
import { insertFormSchema, insertRankGroupSchema, insertAvailableRankSchema, insertCrewMemberSchema, insertAppraisalResultSchema, insertRecruitmentCandidateSchema, insertDataMasterSchema, insertMasterDataEntrySchema } from "@shared/schema";
import { 
  isVesselMaster,
  filterVesselMasterData,
  mapDatabaseToVesselDisplay,
  validateVesselMasterEntry,
  getVesselMasterInfo,
  isAdditionalGroupsMaster,
  needsSpecialHandling,
  applyMasterSpecificFiltering,
  applyMasterSpecificMapping,
  validateMasterSpecificEntry
} from "./vesselMasterSafety";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for database connectivity
  app.get("/api/health", async (req, res) => {
    const healthStatus = {
      server: "running",
      database: isConnected ? "connected" : "disconnected",
      rds_instance: "ls-d153072fe29fcd7dc7c484a33fd3130e29abae1b.cxock8yskd1i.ap-southeast-1.rds.amazonaws.com:3306",
      database_name: "crew_database",
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

  // Crew Members API routes
  app.get("/api/crew-members", async (req, res) => {
    try {
      const crewMembers = await storage.getCrewMembers();
      res.json(crewMembers);
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
      res.json(crewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crew member" });
    }
  });

  app.post("/api/crew-members", async (req, res) => {
    try {
      const result = insertCrewMemberSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid crew member data", details: result.error.issues });
      }
      const crewMember = await storage.createCrewMember(result.data);
      res.status(201).json(crewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to create crew member" });
    }
  });

  app.put("/api/crew-members/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertCrewMemberSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid crew member data", details: result.error.issues });
      }
      const crewMember = await storage.updateCrewMember(id, result.data);
      if (!crewMember) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      res.json(crewMember);
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
        console.log(`🔧 [GET_LIST] Applied transformations for master ${masterId}, entries count: ${responseEntries.length}`);
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
      if (needsSpecialHandling(masterId)) {
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
