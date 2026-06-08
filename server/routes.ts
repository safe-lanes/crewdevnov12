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
import trainingNeedsV2Routes from "./v2/training-needs/routes";
import trainingRetentionV2Routes from "./v2/training-retention/routes";
import reportsV2Routes from "./v2/reports/routes";
import testCasesV2Routes from "./v2/test-cases/routes";
import { setupSwagger } from "./swagger";
import { storage, isConnected, connectionError, calculateExperienceFromSeaService, calculateVesselTypeSpecificExperience } from "./storage";
import { storageAccount } from "./storage-accounts";
import { insertPayElementSchema, insertContractPayElementSchema } from "@shared/schema";
import { normalizeCrewMemberForTable, calculateCrewStatus } from "@shared/crew-mapping";
import { tenantConnectionManager, TenantNotFoundError, TenantInactiveError } from "./utils/tenantConnectionManager";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/v2/tenant/init", async (req, res) => {
    try {
      const { domain } = req.body;
      if (!domain || typeof domain !== "string") {
        return res.status(400).json({
          error: "Invalid request",
          message: "domain is required and must be a string",
        });
      }

      if (!tenantConnectionManager.isMultiTenantEnabled) {
        return res.status(503).json({
          error: "Multi-tenant not configured",
          message: "This server is running in single-tenant mode",
        });
      }

      const tenant = await tenantConnectionManager.resolveTenant(domain.trim());
      return res.json({
        tenantId: tenant.tuid,
        companyName: tenant.companyName,
      });
    } catch (err: any) {
      if (err instanceof TenantNotFoundError) {
        return res.status(404).json({
          error: "domain_not_found",
          message: err.message,
        });
      }
      if (err instanceof TenantInactiveError) {
        return res.status(403).json({
          error: "tenant_inactive",
          message: err.message,
        });
      }
      console.error("Tenant init error:", err.message);
      return res.status(500).json({
        error: "Failed to resolve tenant",
        message: "An error occurred while resolving the tenant database",
      });
    }
  });

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

  // Mount v2 training needs routes (Training & Ret. > Training)
  app.use("/api/v2/training-needs", trainingNeedsV2Routes);

  // Mount v2 training retention routes (Training & Ret. > Retention)
  app.use("/api/v2/training-retention", trainingRetentionV2Routes);

  // Mount v2 reports routes (Reports Generator framework)
  app.use("/api/v2/reports", reportsV2Routes);

  // Mount v2 test cases routes (Crewing Test Case Manager)
  app.use("/api/v2/test-cases", testCasesV2Routes);

  // Mount Swagger API documentation
  setupSwagger(app);

  app.get("/api/health", async (req, res) => {
    let connectionMetrics = null;
    try {
      if (storage && typeof (storage as any).getConnectionManager === 'function') {
        const cm = (storage as any).getConnectionManager();
        if (cm && typeof cm.getMetrics === 'function') {
          connectionMetrics = cm.getMetrics();
        }
      }
    } catch (e) {
    }

    let tenantPoolMetrics = null;
    if (tenantConnectionManager.isMultiTenantEnabled) {
      tenantPoolMetrics = tenantConnectionManager.getPoolMetrics();
    }

    const healthStatus = {
      server: "running",
      database: isConnected ? "connected" : "disconnected",
      multiTenant: tenantConnectionManager.isMultiTenantEnabled,
      ...(tenantPoolMetrics && { tenantPoolMetrics }),
      ...(process.env.NODE_ENV === 'development' && (() => {
        try {
          const dbUrl = new URL(process.env.DATABASE_URL || '');
          return {
            db_host: dbUrl.hostname + (dbUrl.port ? `:${dbUrl.port}` : ''),
            database_name: dbUrl.pathname.replace('/', ''),
            connectionMetrics,
          };
        } catch {
          return { connectionMetrics };
        }
      })()),
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
          check_database_exists: "Verify the database specified in DATABASE_URL exists on the PostgreSQL server",
          check_credentials: "Verify DB_USER and DB_PASSWORD are correct",
          check_network: "Ensure network connectivity to the database host"
        }
      });
    }
  });

  // Helper function to find next promotion rank (replicates frontend promotionUtils.ts logic)
  // rankPath is stored junior→senior (index 0 = most junior, last index = most senior)
  // So we move towards the last index to get more senior ranks
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
      if (currentIndex < rankPath.length - 1) {
        // Next rank exists (one position higher index = more senior)
        return rankPath[currentIndex + 1];
      } else {
        // Already at senior position (last index = top of the ladder)
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

  function getVisibleViolationCodes(complianceMode: string, opaMode: boolean): string[] {
    const codes: string[] = [];
    
    if (complianceMode === 'Rest') {
      codes.push('A', 'C', 'E', 'F', 'G');
    } else {
      codes.push('B', 'D');
    }
    
    if (opaMode) {
      codes.push('I', 'H');
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
        const rawCrewStatus =
          typeof (crew as { status?: unknown }).status === "string"
            ? ((crew as { status?: string }).status ?? null)
            : null;
        normalized.status = calculateCrewStatus(
          isActive ? true : false,
          hasVesselAssignment,
          rawCrewStatus,
        );
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
