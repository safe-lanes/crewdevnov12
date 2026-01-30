import { Request, Response } from "express";
import { vesselPlanningService } from "../services";
import { insertVesselPlanningV2Schema } from "../../../../shared/v2/vessel/schema";
import { z } from "zod";

export const vesselPlanningController = {
  async getByVesselUuid(req: Request, res: Response) {
    try {
      const { vesselUuid } = req.params;
      const planning = await vesselPlanningService.getByVesselUuid(vesselUuid);
      res.json(planning);
    } catch (error) {
      console.error("Error fetching vessel planning:", error);
      res.status(500).json({ error: "Failed to fetch vessel planning" });
    }
  },

  async getByPlanUuid(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const planning = await vesselPlanningService.getByPlanUuid(planUuid);
      res.json(planning);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching planning:", error);
      res.status(500).json({ error: "Failed to fetch planning record" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const validatedData = insertVesselPlanningV2Schema
        .omit({ planUuid: true })
        .parse(req.body);
      const planning = await vesselPlanningService.create(validatedData);
      res.status(201).json(planning);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating planning:", error);
      res.status(500).json({ error: "Failed to create planning record" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const planning = await vesselPlanningService.update(planUuid, req.body);
      res.json(planning);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating planning:", error);
      res.status(500).json({ error: "Failed to update planning record" });
    }
  },

  async archive(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const { archivedByUuid } = req.body;
      const planning = await vesselPlanningService.archive(planUuid, archivedByUuid);
      res.json(planning);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error archiving planning:", error);
      res.status(500).json({ error: "Failed to archive planning record" });
    }
  },

  async addAttachment(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const attachment = await vesselPlanningService.addAttachment(planUuid, req.body);
      res.status(201).json(attachment);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error adding attachment:", error);
      res.status(500).json({ error: "Failed to add attachment" });
    }
  },

  async deleteAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      await vesselPlanningService.deleteAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting attachment:", error);
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  },

  /**
   * Sign on reliever: moves crew from Reliever Status to On Board Status
   * This is triggered when joiningStatus changes from "Planned" to "Signed On"
   */
  async signOnReliever(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const { signOnDate, signOnPort, contractPeriodMonths } = req.body;
      
      const planning = await vesselPlanningService.signOnReliever(planUuid, {
        signOnDate,
        signOnPort,
        contractPeriodMonths,
      });
      
      res.json(planning);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("No reliever")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error signing on reliever:", error);
      res.status(500).json({ error: "Failed to sign on reliever" });
    }
  },

  /**
   * Update reliever status without signing on
   * For status changes: Planned -> Confirmed -> In Transit
   */
  async updateRelieverStatus(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const { joiningStatus, relieverSignOnDate, joiningPortUuid, relieverContractPeriodMonths } = req.body;
      
      if (!joiningStatus) {
        return res.status(400).json({ error: "joiningStatus is required" });
      }

      // If status is "Signed On", use the sign-on endpoint instead
      if (joiningStatus === "Signed On") {
        const planning = await vesselPlanningService.signOnReliever(planUuid, {
          signOnDate: relieverSignOnDate,
          signOnPort: joiningPortUuid,
          contractPeriodMonths: relieverContractPeriodMonths,
        });
        return res.json(planning);
      }

      const planning = await vesselPlanningService.updateRelieverStatus(planUuid, joiningStatus, {
        relieverSignOnDate,
        joiningPortUuid,
        relieverContractPeriodMonths,
      });
      
      res.json(planning);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating reliever status:", error);
      res.status(500).json({ error: "Failed to update reliever status" });
    }
  },

  /**
   * Sign off crew from vessel - updates both vessel_planning_v2 and crew_assignments
   */
  async signOffCrew(req: Request, res: Response) {
    try {
      const { planUuid } = req.params;
      const { signOffDate, signOffReason, signOffPortUuid } = req.body;
      
      if (!signOffDate) {
        return res.status(400).json({ error: "signOffDate is required" });
      }
      
      const planning = await vesselPlanningService.signOffCrew(planUuid, {
        signOffDate,
        signOffReason,
        signOffPortUuid,
      });
      
      res.json(planning);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error signing off crew:", error);
      res.status(500).json({ error: "Failed to sign off crew" });
    }
  },

  /**
   * Get Officer Matrix data for a crew member
   * Returns experience metrics, certifications, and English proficiency
   */
  async getOfficerMatrixData(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const { rank, signOnDate, department } = req.query;
      
      if (!crewUuid) {
        return res.status(400).json({ error: "crewUuid is required" });
      }
      
      const data = await vesselPlanningService.getOfficerMatrixData(
        crewUuid,
        (rank as string) || '',
        (signOnDate as string) || null,
        ((department as string) || 'deck') as 'deck' | 'engine'
      );
      
      res.json(data);
    } catch (error) {
      console.error("Error fetching officer matrix data:", error);
      res.status(500).json({ error: "Failed to fetch officer matrix data" });
    }
  },
};
