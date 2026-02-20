import type { Express } from "express";
import { createServer, type Server } from "http";
import recruitmentV2Routes from "./routes/v2/recruitment";
import crewPoolV2Routes from "./v2/crew-pool/routes";
import { vesselV2Routes } from "./v2/vessel";
import { rotationV2Routes } from "./v2/rotation";
import portsV2Routes from "./v2/ports/portsRoutes";
import restHoursV2Routes from "./v2/rest-hours/routes";
import drugsAlcoholV2Routes from "./v2/drugs-alcohol/routes";
import { adminV2Routes } from "./v2/admin";
import mastersV2Routes from "./v2/masters/routes";
import promotionsV2Routes from "./v2/promotions/routes";
import appraisalsV2Routes from "./v2/appraisals/routes";
import { setupSwagger } from "./swagger";
import { storage, isConnected, connectionError, calculateExperienceFromSeaService, calculateVesselTypeSpecificExperience } from "./storage";
import { storageAccount } from "./storage-accounts";
import { insertDataMasterSchema, insertMasterDataEntrySchema, insertPayElementSchema, insertContractPayElementSchema } from "@shared/schema";
import { normalizeCrewMemberForTable, calculateCrewStatus } from "@shared/crew-mapping";
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Mount v2 recruitment routes (isolated from existing functionality)
  app.use("/api/v2/recruitment", recruitmentV2Routes);
  
  // Mount v2 crew pool routes
  app.use("/api/v2/crew-pool", crewPoolV2Routes);
  
  // Mount v2 vessel routes
  app.use("/api/v2/vessel", vesselV2Routes);
  
  // Mount v2 rotation routes
  app.use("/api/v2/rotation", rotationV2Routes);
  
  // Mount v2 ports routes
  app.use("/api/v2/ports", portsV2Routes);

  // Mount v2 rest hours routes
  app.use("/api/v2/rest-hours", restHoursV2Routes);

  // Mount v2 drugs & alcohol routes
  app.use("/api/v2/drugs-alcohol", drugsAlcoholV2Routes);

  // Mount v2 admin routes
  app.use("/api/v2/admin", adminV2Routes);

  // Mount v2 masters routes
  app.use("/api/v2/masters", mastersV2Routes);

  // Mount v2 promotions routes
  app.use("/api/v2/promotions", promotionsV2Routes);

  // Mount v2 appraisals routes
  app.use("/api/v2/appraisals", appraisalsV2Routes);

  // Mount Swagger API documentation
  setupSwagger(app);

  // Health check endpoint for database connectivity
  app.get("/api/health", async (req, res) => {
    // Get connection manager metrics if available
    let connectionMetrics = null;
    try {
      if (storage && typeof (storage as any).getConnectionManager === 'function') {
        const cm = (storage as any).getConnectionManager();
        if (cm && typeof cm.getMetrics === 'function') {
          connectionMetrics = cm.getMetrics();
        }
      }
    } catch (e) {
      // Ignore - metrics not available
    }

    const healthStatus = {
      server: "running",
      database: isConnected ? "connected" : "disconnected",
      // Gate sensitive information behind development environment check
      ...(process.env.NODE_ENV === 'development' && {
        rds_instance: "ls-d153072fe29fcd7dc7c484a33fd3130e29abae1b.cxock8yskd1i.ap-southeast-1.rds.amazonaws.com:3306",
        database_name: "crew_database",
        connectionMetrics,
      }),
      connection_error: connectionError?.message || null,
      timestamp: new Date().toISOString()
    };

    if (isConnected) {
      try {
        // Test with actual query
        await storage.getCrewMembers();
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

  // Helper function to find next promotion rank (replicates frontend promotionUtils.ts logic)
  // rankPath is stored senior→junior (index 0 = most senior like Master)
  // So we need to move towards index 0 to get more senior ranks
  function findNextPromotionRank(currentRank: string, hierarchies: any[]): string | null {
    // Find the hierarchy that contains the current rank
    for (const hierarchy of hierarchies) {
      let rankPath: string[];
      try {
        rankPath = typeof hierarchy.rankPath === 'string' 
          ? JSON.parse(hierarchy.rankPath) 
          : (Array.isArray(hierarchy.rankPath) ? hierarchy.rankPath : []);
      } catch (e) {
        rankPath = [];
      }
      
      // Check if this hierarchy contains the current rank
      if (!rankPath.includes(currentRank)) {
        continue; // Try next hierarchy
      }
      
      const currentIndex = rankPath.indexOf(currentRank);
      
      // Check if there's a next rank (more senior position)
      if (currentIndex > 0) {
        // Next rank exists (one position lower index = more senior)
        return rankPath[currentIndex - 1];
      } else {
        // Already at senior position (index 0 = top of the ladder)
        return null;
      }
    }
    // No hierarchy found containing this rank
    return null;
  }

  // Helper function to sync promotion reviews for eligible crew members
  async function ensurePromotionReviewsForEligibleCrew(): Promise<{ created: number; existing: number }> {
    let created = 0;
    let existing = 0;
    
    try {
      // Get all crew members and promotion hierarchies
      const [crewMembers, hierarchies, existingReviews] = await Promise.all([
        storage.getCrewMembers(),
        storage.getPromotionHierarchies(),
        storage.getPromotionReviews()
      ]);

      // Build a set of existing review keys for fast lookup
      const existingKeys = new Set(
        existingReviews.map(r => `${r.crewMemberId}__${r.promotionToRank}`)
      );

      // Build set of all ranks that appear in any hierarchy
      const ranksInHierarchies = new Set<string>();
      for (const h of hierarchies) {
        const rankPath: string[] = typeof h.rankPath === 'string' 
          ? JSON.parse(h.rankPath) 
          : h.rankPath || [];
        rankPath.forEach(r => ranksInHierarchies.add(r));
      }

      // Find eligible crew and create missing reviews
      const reviewsToCreate: { crewMemberId: string; promotionToRank: string }[] = [];
      
      for (const crew of crewMembers) {
        const currentRank = crew.presentRank || '';
        
        // Skip if crew has no rank or rank not in any hierarchy
        if (!currentRank || !ranksInHierarchies.has(currentRank)) {
          continue;
        }

        // Find next promotion rank
        const nextRank = findNextPromotionRank(currentRank, hierarchies);
        
        // Skip if at top of hierarchy (no next rank)
        if (!nextRank) {
          continue;
        }

        // Check if review already exists
        const key = `${crew.id}__${nextRank}`;
        if (existingKeys.has(key)) {
          existing++;
          continue;
        }

        // Add to batch for creation
        reviewsToCreate.push({
          crewMemberId: crew.id,
          promotionToRank: nextRank
        });
      }

      // Create missing reviews in batches
      for (const reviewData of reviewsToCreate) {
        try {
          await storage.createPromotionReview({
            crewMemberId: reviewData.crewMemberId,
            promotionToRank: reviewData.promotionToRank,
            status: 'In Progress'
          });
          created++;
        } catch (error: any) {
          // Handle duplicate key errors gracefully (race condition protection)
          if (error?.code === '23505') {
            existing++;
          } else {
            console.error(`Failed to create promotion review for ${reviewData.crewMemberId}:`, error);
          }
        }
      }

      if (created > 0) {
        console.log(`✅ [Sync] Created ${created} new promotion reviews, ${existing} already existed`);
      }

      return { created, existing };
    } catch (error) {
      console.error("❌ Failed to sync promotion reviews:", error);
      return { created: 0, existing: 0 };
    }
  }

  // Helper function to get visible violation codes based on compliance mode and OPA mode
  function getVisibleViolationCodes(complianceMode: string, opaMode: boolean): number[] {
    const codes: number[] = [];
    
    // Add codes based on compliance mode
    if (complianceMode === 'Rest') {
      codes.push(1, 2, 3, 4); // Rest mode violations
    } else {
      codes.push(5, 6); // Work mode violations
    }
    
    // Add OPA codes if OPA mode is enabled
    if (opaMode) {
      codes.push(7, 8);
    }
    
    return codes;
  }

  // Crew Members API routes (list only - other CRUD migrated to /api/v2/crew-pool)

  // Legacy crew list endpoint - used by accounts, vessel module
  // Individual crew CRUD migrated to /api/v2/crew-pool
  // Helpers (autoCreateVesselPlanning, syncVesselPlanning) migrated to v2 vessel revisions service

  app.get("/api/crew-members", async (req, res) => {
    try {
      // Parse query parameters for filtering
      const filters: {
        rank?: string;
        nationality?: string;
        status?: string;
        search?: string;
      } = {};
      
      if (req.query.rank) filters.rank = req.query.rank as string;
      if (req.query.nationality) filters.nationality = req.query.nationality as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.search) filters.search = req.query.search as string;
      
      const crewMembers = await storage.getCrewMembers(Object.keys(filters).length > 0 ? filters : undefined);
      
      // Get all vessel planning records to derive vessel assignments
      const allVesselPlanning = await storage.getAllVesselPlanning();
      
      // Get vessel master data (Master 014) for vessel type lookup
      const vesselMasterData = await storage.getMasterDataEntries('014');
      const vesselMap = new Map(vesselMasterData.map((v: any) => [v.entryId || v.entry_id, v]));
      
      // Get vessel type master data (Master 004) for vessel type display names
      const vesselTypeMasterData = await storage.getMasterDataEntries('004');
      const vesselTypeMap = new Map(vesselTypeMasterData.map((vt: any) => [vt.code, vt.name]));
      
      // Build a map of crewMemberId -> vessel assignment (vesselId, crewStatus, joiningDate, reliefDue, contractPeriodMonths)
      // A crew can have multiple assignments (primary on one vessel, secondary on another)
      // For "Present Vessel" in Crew Database, show the PRIMARY assignment
      // IMPORTANT: Filter out archived records - archived crew have been signed off and are not currently on board
      // Note: Convert crewMemberId to string for consistent key matching
      const crewVesselMap = new Map<string, { vesselId: string; crewStatus: string; joiningDate: string | null; reliefDue: string | null; contractPeriodMonths: number | null }[]>();
      
      for (const planning of allVesselPlanning) {
        // Skip archived records - these crew members have been signed off
        if (planning.isArchived) {
          continue;
        }
        
        if (planning.crewMemberId) {
          // Convert to string for consistent key matching (handles both string and number IDs)
          const crewIdKey = String(planning.crewMemberId);
          const existing = crewVesselMap.get(crewIdKey) || [];
          // Normalize crewStatus to lowercase (handles 'Primary', 'primary', 'P', 'Secondary', 'secondary', 'S')
          const normalizedStatus = (planning.crewStatus || 'primary').toLowerCase();
          const isPrimary = normalizedStatus === 'primary' || normalizedStatus === 'p';
          existing.push({
            vesselId: planning.vesselId,
            crewStatus: isPrimary ? 'primary' : 'secondary',
            joiningDate: planning.signOnDate || null,
            reliefDue: planning.reliefDue || null,
            contractPeriodMonths: planning.contractPeriodMonths !== undefined && planning.contractPeriodMonths !== null 
              ? planning.contractPeriodMonths 
              : null
          });
          crewVesselMap.set(crewIdKey, existing);
        }
      }
      
      // Normalize crew members for table/frontend consumption
      // Override presentVessel with vessel assignment from vessel_planning
      const normalizedCrewMembers = crewMembers.map((crew: any) => {
        const normalized = normalizeCrewMemberForTable(crew) as any;
        
        // Get vessel assignments from vessel_planning (convert crew.id to string for matching)
        const crewIdKey = String(crew.id);
        const vesselAssignments = crewVesselMap.get(crewIdKey) || [];
        
        // Determine if crew has active vessel assignment
        const hasVesselAssignment = vesselAssignments.length > 0;
        
        if (hasVesselAssignment) {
          // Find primary assignment first, fallback to first assignment
          const primaryAssignment = vesselAssignments.find(a => a.crewStatus === 'primary') || vesselAssignments[0];
          
          // Override presentVessel with vessel from vessel_planning
          normalized.presentVessel = primaryAssignment.vesselId;
          
          // Include all assignments for display (both P and S)
          normalized.vesselAssignments = vesselAssignments;
          
          // Override joiningDate, reliefDue, and contractPeriodMonths from vessel_planning if available
          if (primaryAssignment.joiningDate) {
            normalized.joiningDate = primaryAssignment.joiningDate;
          }
          if (primaryAssignment.reliefDue) {
            normalized.reliefDue = primaryAssignment.reliefDue;
          }
          if (primaryAssignment.contractPeriodMonths !== undefined && primaryAssignment.contractPeriodMonths !== null) {
            normalized.contractPeriodMonths = primaryAssignment.contractPeriodMonths;
          }
        } else {
          // No vessel_planning assignment - clear presentVessel
          normalized.presentVessel = null;
        }
        
        // Use unified status calculation logic:
        // isActive=false → "Inactive", else check vessel assignment → "On Board"/"On Leave"
        const isActive = crew.isActive !== false; // Default to active if null/undefined
        normalized.status = calculateCrewStatus(isActive ? true : false, hasVesselAssignment);
        normalized.isActive = isActive;
        normalized.nextAvailability = crew.nextAvailability || null;
        
        // Calculate experience metrics for Officer Matrix display
        const companySeaService = normalized.currentCompanySeaService || [];
        const externalSeaService = normalized.externalSeaService || [];
        const currentRank = normalized.presentRank || '';
        
        // Parse sea service if stored as JSON string, with error handling
        let parsedCompanySeaService: any[] = [];
        let parsedExternalSeaService: any[] = [];
        
        try {
          if (typeof companySeaService === 'string') {
            const parsed = JSON.parse(companySeaService);
            parsedCompanySeaService = Array.isArray(parsed) ? parsed : [];
          } else if (Array.isArray(companySeaService)) {
            parsedCompanySeaService = companySeaService;
          }
        } catch (e) {
          // Invalid JSON, default to empty array
          parsedCompanySeaService = [];
        }
        
        try {
          if (typeof externalSeaService === 'string') {
            const parsed = JSON.parse(externalSeaService);
            parsedExternalSeaService = Array.isArray(parsed) ? parsed : [];
          } else if (Array.isArray(externalSeaService)) {
            parsedExternalSeaService = externalSeaService;
          }
        } catch (e) {
          // Invalid JSON, default to empty array
          parsedExternalSeaService = [];
        }
        
        // Calculate experience metrics
        normalized.experienceMetrics = calculateExperienceFromSeaService(
          parsedCompanySeaService,
          parsedExternalSeaService,
          currentRank
        );
        
        // Calculate time on board (months from sign-on date to today)
        if (normalized.signOnDate) {
          try {
            const signOnDate = new Date(normalized.signOnDate);
            const today = new Date();
            const diffMs = today.getTime() - signOnDate.getTime();
            const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44); // Average days per month
            normalized.experienceMetrics.timeOnBoard = Math.round(diffMonths * 10) / 10;
          } catch (e) {
            normalized.experienceMetrics.timeOnBoard = 0;
          }
        } else {
          normalized.experienceMetrics.timeOnBoard = 0;
        }
        
        // Calculate vessel type-specific experience for Officer Matrix "Tanker Type" column
        if (normalized.presentVessel) {
          const vessel = vesselMap.get(normalized.presentVessel);
          if (vessel && vessel.vesselType) {
            const vesselTypeCode = vessel.vesselType;
            const vesselTypeName = vesselTypeMap.get(vesselTypeCode) || vesselTypeCode;
            const vesselTypeYears = calculateVesselTypeSpecificExperience(
              parsedCompanySeaService,
              parsedExternalSeaService,
              vesselTypeCode
            );
            normalized.experienceMetrics.vesselType = {
              code: vesselTypeCode,
              name: vesselTypeName,
              years: vesselTypeYears
            };
          } else {
            normalized.experienceMetrics.vesselType = null;
          }
        } else {
          normalized.experienceMetrics.vesselType = null;
        }
        
        return normalized;
      });
      
      res.json(normalizedCrewMembers);
    } catch (error) {
      console.error("❌ Failed to fetch crew members with filters:", error);
      res.status(500).json({ error: "Failed to fetch crew members" });
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
      } else if (entries) {
        // Apply basic field transformation for regular masters (snake_case to camelCase)
        responseEntries = entries.map((entry: any) => applyBasicFieldTransformation(entry));
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
      } else {
        // Apply basic field transformation for regular masters (snake_case to camelCase)
        responseEntry = applyBasicFieldTransformation(entry);
      }
      
      res.json(responseEntry);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master data entry" });
    }
  });

  app.post("/api/masters/:id/data", async (req, res) => {
    try {
      const masterId = req.params.id;
      
      // Apply master-specific filtering and transformation BEFORE validation
      let requestData = { ...req.body, masterId };
      if (needsSpecialHandling(masterId)) {
        // Apply appropriate filtering/transformation based on master type
        requestData = applyMasterSpecificFiltering(requestData, masterId);
        
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
        return res.status(400).json({ error: "Invalid master data entry", details: result.error.issues });
      }
      
      const entry = await storage.createMasterDataEntry(result.data);
      
      // Apply master-specific response mapping if needed
      let responseEntry = entry;
      if (needsSpecialHandling(masterId) && entry) {
        responseEntry = applyMasterSpecificMapping(entry, masterId);
      }
      
      res.status(201).json(responseEntry);
    } catch (error) {
      console.error(`Failed to create master data entry:`, error);
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
        // Apply appropriate filtering/transformation based on master type
        requestData = applyMasterSpecificFiltering(req.body, masterId);
        
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
      }
      
      res.json(responseEntry);
    } catch (error) {
      console.error(`Failed to update master data entry:`, error);
      res.status(500).json({ error: "Failed to update master data entry" });
    }
  });

  app.delete("/api/master-data/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteMasterDataEntry(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Master data entry not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error(`Failed to delete master data entry:`, error);
      res.status(500).json({ error: "Failed to delete master data entry" });
    }
  });

 // =============================================================================
  // External API Master Data Routes
  // These routes handle fetching cached data and syncing from external API
  // =============================================================================

  // Valid master data types
  const validMasterTypes = [
    'nationalities', 'vessels', 'vesselTypes', 'additionalGroups',
    'ports', 'fleetGroups', 'languages', 'countries', 'users'
  ];

  // GET /api/master-data/external/:type - Fetch cached master data from local database
  app.get("/api/master-data/external/:type", async (req, res) => {
    try {
      const { type } = req.params;
      
      if (!validMasterTypes.includes(type)) {
        return res.status(400).json({ 
          error: `Invalid master type: ${type}. Valid types: ${validMasterTypes.join(', ')}` 
        });
      }

      const data = await storage.getMasterData(type);
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
  });

  // Map internal type names to external API response keys
  const apiKeyMap: Record<string, string> = {
    'nationalities': 'nationalities',
    'vessels': 'vessels',
    'vesselTypes': 'vesseltypes',
    'additionalGroups': 'additionalGroups',
    'ports': 'ports',
    'fleetGroups': 'fleetGroups',
    'languages': 'languages',
    'countries': 'countries',
    'users': 'users',
  };

// POST /api/master-data/external/sync-all - Sync all master data types at once
  app.post("/api/master-data/external/sync-all", async (req, res) => {
    try {
      const { apiBaseUrl, domain } = req.body;
      
      if (!apiBaseUrl || !domain) {
        return res.status(400).json({ 
          error: "Missing required parameters: apiBaseUrl and domain are required" 
        });
      }
      
      console.log(`[Sync All] Fetching all master data from external API: ${apiBaseUrl} (domain: ${domain})`);
      
      const results: Record<string, { synced: number; error?: string }> = {};
      
      // Fetch main data from base endpoint
      console.log(`[Sync All] Fetching main data from: ${apiBaseUrl}`);
      const mainResponse = await fetch(`${apiBaseUrl}?domain=${domain}`);
      if (!mainResponse.ok) {
        throw new Error(`External API responded with status ${mainResponse.status}`);
      }
      const externalData = await mainResponse.json();
      // Sync types available in main response
      for (const type of validMasterTypes) {
        try {
          // Use main response data
            const apiKey = apiKeyMap[type];
            const typeData = externalData[apiKey];
            if (typeData && Array.isArray(typeData)) {
              const result = await storage.syncMasterData(type, typeData);
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
  });

  // Accounts Payable / Payroll Integration API Routes
  // Pay Elements API routes (Rate Tables & Rules)
  app.get("/api/pay-elements", async (req, res) => {
    try {
      const payElements = await storageAccount.getPayElements();
      res.json(payElements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pay elements" });
    }
  });

  app.post("/api/pay-elements", async (req, res) => {
    try {
      const result = insertPayElementSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid pay element data", details: result.error.issues });
      }
      const payElement = await storageAccount.createPayElement(result.data);
      res.json(payElement);
    } catch (error) {
      res.status(500).json({ error: "Failed to create pay element" });
    }
  });

  app.put("/api/pay-elements/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertPayElementSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid pay element data", details: result.error.issues });
      }
      const payElement = await storageAccount.updatePayElement(id, result.data);
      if (!payElement) {
        return res.status(404).json({ error: "Pay element not found" });
      }
      res.json(payElement);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pay element" });
    }
  });

  app.put("/api/pay-elements/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertPayElementSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid pay element data", details: result.error.issues });
      }
      const payElement = await storageAccount.updatePayElement(id, result.data);
      if (!payElement) {
        return res.status(404).json({ error: "Pay element not found" });
      }
      res.json(payElement);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pay element" });
    }
  });

  // Contract Pay Elements API routes
  app.put("/api/contract-pay-elements/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertContractPayElementSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid contract pay element data", details: result.error.issues });
      }
      const contractPayElement = await storageAccount.updateContractPayElement(id, result.data);
      if (!contractPayElement) {
        return res.status(404).json({ error: "Contract pay element not found" });
      }
      res.json(contractPayElement);
    } catch (error) {
      res.status(500).json({ error: "Failed to update contract pay element" });
    }
  });

  app.post("/api/contract-pay-elements", async (req, res) => {
    try {
      const result = insertContractPayElementSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid contract pay element data", details: result.error.issues });
      }
      const contractPayElement = await storageAccount.createContractPayElement(result.data);
      res.json(contractPayElement);
    } catch (error) {
      res.status(500).json({ error: "Failed to create contract pay element" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
