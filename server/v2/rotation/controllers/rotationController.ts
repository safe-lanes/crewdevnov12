import { Request, Response } from "express";
import { 
  crewAvailabilityService, 
  rotationDeployService, 
  rotationDraftsService, 
  rotationEntriesService,
  rotationArchiveService 
} from "../services";
import { 
  insertRotationDraftsV2Schema, 
  insertRotationEntriesV2Schema 
} from "../../../../shared/v2/rotation/schema";
import { z } from "zod";

export const rotationCrewController = {
  async getByRank(req: Request, res: Response) {
    try {
      const { rank } = req.params;
      const { search, availableOnly } = req.query;
      
      let crew;
      if (search) {
        crew = await crewAvailabilityService.searchCrewByRank(rank, search as string);
      } else if (availableOnly === "true") {
        crew = await crewAvailabilityService.getAvailableCrewByRank(rank);
      } else {
        crew = await crewAvailabilityService.getCrewByRank(rank);
      }
      
      res.json(crew);
    } catch (error) {
      console.error("Error fetching crew by rank:", error);
      res.status(500).json({ error: "Failed to fetch crew by rank" });
    }
  },
};

export const rotationDraftsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { planStatus } = req.query;
      const drafts = await rotationDraftsService.getAll({
        planStatus: planStatus as string | undefined,
      });
      res.json(drafts);
    } catch (error) {
      console.error("Error fetching drafts:", error);
      res.status(500).json({ error: "Failed to fetch drafts" });
    }
  },

  async getByDraftUuid(req: Request, res: Response) {
    try {
      const { draftUuid } = req.params;
      const draft = await rotationDraftsService.getByDraftUuid(draftUuid);
      res.json(draft);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching draft:", error);
      res.status(500).json({ error: "Failed to fetch draft" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      // Extract extra fields before validation (vessels/crew/assignments for child tables)
      const { vessels, crew, assignments, ...draftFields } = req.body;
      
      const validatedData = insertRotationDraftsV2Schema
        .omit({ draftUuid: true, draftId: true })
        .parse(draftFields);
      
      // Pass vessels, crew, and assignments to service for child table population
      const draft = await rotationDraftsService.create({
        ...validatedData,
        vessels,
        crew,
        assignments,
      });
      res.status(201).json(draft);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating draft:", error);
      res.status(500).json({ error: "Failed to create draft" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { draftUuid } = req.params;
      // Extract extra fields that go to child tables
      const { vessels, crew, assignments, ...draftFields } = req.body;
      
      // Pass all fields including child table data to service
      const draft = await rotationDraftsService.update(draftUuid, {
        ...draftFields,
        vessels,
        crew,
        assignments,
      });
      res.json(draft);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating draft:", error);
      res.status(500).json({ error: "Failed to update draft" });
    }
  },

  async propose(req: Request, res: Response) {
    try {
      const { draftUuid } = req.params;
      const { proposedByUuid } = req.body;
      const draft = await rotationDraftsService.proposeDraft(draftUuid, proposedByUuid);
      res.json(draft);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error proposing draft:", error);
      res.status(500).json({ error: "Failed to propose draft" });
    }
  },

  async getProposals(req: Request, res: Response) {
    try {
      const filters = {
        vessels: req.query.vessels ? JSON.parse(req.query.vessels as string) : undefined,
        ranks: req.query.ranks ? JSON.parse(req.query.ranks as string) : undefined,
        draftId: req.query.draftId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        archived: req.query.archived === 'true',
      };
      const proposals = await rotationDraftsService.getProposals(filters);
      res.json(proposals);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { draftUuid } = req.params;
      await rotationDraftsService.deleteDraft(draftUuid);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting draft:", error);
      res.status(500).json({ error: "Failed to delete draft" });
    }
  },

  async addVessel(req: Request, res: Response) {
    try {
      const { draftUuid } = req.params;
      const vessel = await rotationDraftsService.addVessel(draftUuid, req.body);
      res.status(201).json(vessel);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error adding vessel:", error);
      res.status(500).json({ error: "Failed to add vessel" });
    }
  },

  async removeVessel(req: Request, res: Response) {
    try {
      const { rvUuid } = req.params;
      await rotationDraftsService.removeVessel(rvUuid);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing vessel:", error);
      res.status(500).json({ error: "Failed to remove vessel" });
    }
  },

  async addRank(req: Request, res: Response) {
    try {
      const { draftUuid } = req.params;
      const rank = await rotationDraftsService.addRank(draftUuid, req.body);
      res.status(201).json(rank);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error adding rank:", error);
      res.status(500).json({ error: "Failed to add rank" });
    }
  },

  async removeRank(req: Request, res: Response) {
    try {
      const { rrUuid } = req.params;
      await rotationDraftsService.removeRank(rrUuid);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing rank:", error);
      res.status(500).json({ error: "Failed to remove rank" });
    }
  },
};

export const rotationEntriesController = {
  async getByEntryUuid(req: Request, res: Response) {
    try {
      const { entryUuid } = req.params;
      const entry = await rotationEntriesService.getByEntryUuid(entryUuid);
      res.json(entry);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching entry:", error);
      res.status(500).json({ error: "Failed to fetch entry" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const validatedData = insertRotationEntriesV2Schema
        .omit({ entryUuid: true })
        .parse(req.body);
      const entry = await rotationEntriesService.create(validatedData);
      res.status(201).json(entry);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating entry:", error);
      res.status(500).json({ error: "Failed to create entry" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { entryUuid } = req.params;
      const entry = await rotationEntriesService.update(entryUuid, req.body);
      res.json(entry);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating entry:", error);
      res.status(500).json({ error: "Failed to update entry" });
    }
  },

  async deploy(req: Request, res: Response) {
    try {
      const { entryUuid } = req.params;
      const { deployedByUuid, auditUserUuid } = req.body;
      const result = await rotationDeployService.deployEntry(entryUuid, deployedByUuid, auditUserUuid);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error deploying entry:", error);
      res.status(500).json({ error: "Failed to deploy entry" });
    }
  },

  async reject(req: Request, res: Response) {
    try {
      const { entryUuid } = req.params;
      const { rejectedByUuid, reason, auditUserUuid } = req.body;
      const result = await rotationDeployService.rejectEntry(entryUuid, rejectedByUuid, reason, auditUserUuid);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error rejecting entry:", error);
      res.status(500).json({ error: "Failed to reject entry" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { entryUuid } = req.params;
      await rotationEntriesService.delete(entryUuid);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting entry:", error);
      res.status(500).json({ error: "Failed to delete entry" });
    }
  },
};

export const rotationArchiveController = {
  async getAll(req: Request, res: Response) {
    try {
      const { result, vesselUuid } = req.query;
      const archive = await rotationArchiveService.getAll({
        result: result as string | undefined,
        vesselUuid: vesselUuid as string | undefined,
      });
      res.json(archive);
    } catch (error) {
      console.error("Error fetching archive:", error);
      res.status(500).json({ error: "Failed to fetch archive" });
    }
  },
};
