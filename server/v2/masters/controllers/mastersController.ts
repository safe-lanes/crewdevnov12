import { Request, Response } from "express";
import { mastersService } from "../services";
import { EntryIdConflictError } from "../repositories/mastersRepository";
import {
  createMasterLicenseDceSchema,
  updateMasterLicenseDceSchema,
  createMasterCrewPoolSchema,
  updateMasterCrewPoolSchema,
  createMasterAppraisalTypeSchema,
  updateMasterAppraisalTypeSchema,
} from "../../../../shared/schema";

export const mastersController = {
  async getNationalities(req: Request, res: Response) {
    try {
      const data = await mastersService.getNationalities();
      res.json(data);
    } catch (error) {
      console.error("Error fetching nationalities:", error);
      res.status(500).json({ error: "Failed to fetch nationalities" });
    }
  },

  async getNationalityByUuid(req: Request, res: Response) {
    try {
      const data = await mastersService.getNationalityByUuid(req.params.uuid);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching nationality:", error);
      res.status(500).json({ error: "Failed to fetch nationality" });
    }
  },

  async getVessels(req: Request, res: Response) {
    try {
      const data = await mastersService.getVessels();
      res.json(data);
    } catch (error) {
      console.error("Error fetching vessels:", error);
      res.status(500).json({ error: "Failed to fetch vessels" });
    }
  },

  /** Returns all vessels including inactive/deleted — for sea service & import template dropdowns. */
  async getAllVessels(req: Request, res: Response) {
    try {
      const data = await mastersService.getAllVessels();
      res.json(data);
    } catch (error) {
      console.error("Error fetching all vessels:", error);
      res.status(500).json({ error: "Failed to fetch vessels" });
    }
  },

  async getVesselByUuid(req: Request, res: Response) {
    try {
      const data = await mastersService.getVesselByUuid(req.params.uuid);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching vessel:", error);
      res.status(500).json({ error: "Failed to fetch vessel" });
    }
  },

  async getVesselTypes(req: Request, res: Response) {
    try {
      const data = await mastersService.getVesselTypes();
      res.json(data);
    } catch (error) {
      console.error("Error fetching vessel types:", error);
      res.status(500).json({ error: "Failed to fetch vessel types" });
    }
  },

  async getVesselTypeByUuid(req: Request, res: Response) {
    try {
      const data = await mastersService.getVesselTypeByUuid(req.params.uuid);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching vessel type:", error);
      res.status(500).json({ error: "Failed to fetch vessel type" });
    }
  },

  async getDepartments(req: Request, res: Response) {
    try {
      const data = await mastersService.getDepartments();
      res.json(data);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  },

  async getAdditionalGroups(req: Request, res: Response) {
    try {
      const data = await mastersService.getAdditionalGroups();
      res.json(data);
    } catch (error) {
      console.error("Error fetching additional groups:", error);
      res.status(500).json({ error: "Failed to fetch additional groups" });
    }
  },

  async getAdditionalGroupByUuid(req: Request, res: Response) {
    try {
      const data = await mastersService.getAdditionalGroupByUuid(req.params.uuid);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching additional group:", error);
      res.status(500).json({ error: "Failed to fetch additional group" });
    }
  },

  async getPorts(req: Request, res: Response) {
    try {
      const data = await mastersService.getPorts();
      res.json(data);
    } catch (error) {
      console.error("Error fetching ports:", error);
      res.status(500).json({ error: "Failed to fetch ports" });
    }
  },

  async getPortByUuid(req: Request, res: Response) {
    try {
      const data = await mastersService.getPortByUuid(req.params.uuid);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching port:", error);
      res.status(500).json({ error: "Failed to fetch port" });
    }
  },

  async getFleetGroups(req: Request, res: Response) {
    try {
      const data = await mastersService.getFleetGroups();
      res.json(data);
    } catch (error) {
      console.error("Error fetching fleet groups:", error);
      res.status(500).json({ error: "Failed to fetch fleet groups" });
    }
  },

  async getFleetGroupByUuid(req: Request, res: Response) {
    try {
      const data = await mastersService.getFleetGroupByUuid(req.params.uuid);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching fleet group:", error);
      res.status(500).json({ error: "Failed to fetch fleet group" });
    }
  },

  async getLanguages(req: Request, res: Response) {
    try {
      const data = await mastersService.getLanguages();
      res.json(data);
    } catch (error) {
      console.error("Error fetching languages:", error);
      res.status(500).json({ error: "Failed to fetch languages" });
    }
  },

  async getLanguageByUuid(req: Request, res: Response) {
    try {
      const data = await mastersService.getLanguageByUuid(req.params.uuid);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching language:", error);
      res.status(500).json({ error: "Failed to fetch language" });
    }
  },

  async getCountries(req: Request, res: Response) {
    try {
      const data = await mastersService.getCountries();
      res.json(data);
    } catch (error) {
      console.error("Error fetching countries:", error);
      res.status(500).json({ error: "Failed to fetch countries" });
    }
  },

  async getCountryByUuid(req: Request, res: Response) {
    try {
      const data = await mastersService.getCountryByUuid(req.params.uuid);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching country:", error);
      res.status(500).json({ error: "Failed to fetch country" });
    }
  },

  async getUsers(req: Request, res: Response) {
    try {
      const data = await mastersService.getUsers();
      res.json(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  },

  async getUserByUuid(req: Request, res: Response) {
    try {
      const data = await mastersService.getUserByUuid(req.params.uuid);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  },

  async getLicensesDce(req: Request, res: Response) {
    try {
      const data = await mastersService.getLicensesDce();
      res.json(data);
    } catch (error) {
      console.error("Error fetching licenses/DCE:", error);
      res.status(500).json({ error: "Failed to fetch licenses/DCE" });
    }
  },

  async getLicenseDceById(req: Request, res: Response) {
    try {
      const data = await mastersService.getLicenseDceById(req.params.id);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching license/DCE:", error);
      res.status(500).json({ error: "Failed to fetch license/DCE" });
    }
  },

  async getManningAgents(req: Request, res: Response) {
    try {
      const data = await mastersService.getManningAgents();
      res.json(data);
    } catch (error) {
      console.error("Error fetching manning agents:", error);
      res.status(500).json({ error: "Failed to fetch manning agents" });
    }
  },

  async getManningAgentsWithActiveCrew(req: Request, res: Response) {
    try {
      const data = await mastersService.getManningAgentsWithActiveCrew();
      res.json(data);
    } catch (error) {
      console.error("Error fetching manning agents with active crew:", error);
      res.status(500).json({ error: "Failed to fetch manning agents with active crew" });
    }
  },

  async getManningAgentById(req: Request, res: Response) {
    try {
      const data = await mastersService.getManningAgentById(req.params.id);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching manning agent:", error);
      res.status(500).json({ error: "Failed to fetch manning agent" });
    }
  },

  async getCrewPools(req: Request, res: Response) {
    try {
      const data = await mastersService.getCrewPools();
      res.json(data);
    } catch (error) {
      console.error("Error fetching crew pools:", error);
      res.status(500).json({ error: "Failed to fetch crew pools" });
    }
  },

  async getCrewPoolById(req: Request, res: Response) {
    try {
      const data = await mastersService.getCrewPoolById(req.params.id);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching crew pool:", error);
      res.status(500).json({ error: "Failed to fetch crew pool" });
    }
  },

  async getAppraisalTypes(req: Request, res: Response) {
    try {
      const data = await mastersService.getAppraisalTypes();
      res.json(data);
    } catch (error) {
      console.error("Error fetching appraisal types:", error);
      res.status(500).json({ error: "Failed to fetch appraisal types" });
    }
  },

  async getAppraisalTypeById(req: Request, res: Response) {
    try {
      const data = await mastersService.getAppraisalTypeById(req.params.id);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching appraisal type:", error);
      res.status(500).json({ error: "Failed to fetch appraisal type" });
    }
  },

  async createLicenseDce(req: Request, res: Response) {
    try {
      const parsed = createMasterLicenseDceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid license/DCE data", details: parsed.error.issues });
      }
      const data = await mastersService.createLicenseDce(parsed.data);
      res.status(201).json(data);
    } catch (error: any) {
      if (error instanceof EntryIdConflictError) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Error creating license/DCE:", error);
      res.status(500).json({ error: "Failed to create license/DCE" });
    }
  },

  async updateLicenseDce(req: Request, res: Response) {
    try {
      const parsed = updateMasterLicenseDceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid license/DCE data", details: parsed.error.issues });
      }
      const data = await mastersService.updateLicenseDce(req.params.id, parsed.data);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating license/DCE:", error);
      res.status(500).json({ error: "Failed to update license/DCE" });
    }
  },

  async deleteLicenseDce(req: Request, res: Response) {
    try {
      const data = await mastersService.deleteLicenseDce(req.params.id);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting license/DCE:", error);
      res.status(500).json({ error: "Failed to delete license/DCE" });
    }
  },

  async createCrewPool(req: Request, res: Response) {
    try {
      const parsed = createMasterCrewPoolSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid crew pool data", details: parsed.error.issues });
      }
      const data = await mastersService.createCrewPool(parsed.data);
      res.status(201).json(data);
    } catch (error) {
      console.error("Error creating crew pool:", error);
      res.status(500).json({ error: "Failed to create crew pool" });
    }
  },

  async updateCrewPool(req: Request, res: Response) {
    try {
      const parsed = updateMasterCrewPoolSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid crew pool data", details: parsed.error.issues });
      }
      const data = await mastersService.updateCrewPool(req.params.id, parsed.data);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating crew pool:", error);
      res.status(500).json({ error: "Failed to update crew pool" });
    }
  },

  async deleteCrewPool(req: Request, res: Response) {
    try {
      const data = await mastersService.deleteCrewPool(req.params.id);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting crew pool:", error);
      res.status(500).json({ error: "Failed to delete crew pool" });
    }
  },

  async createAppraisalType(req: Request, res: Response) {
    try {
      const parsed = createMasterAppraisalTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid appraisal type data", details: parsed.error.issues });
      }
      const data = await mastersService.createAppraisalType(parsed.data);
      res.status(201).json(data);
    } catch (error: any) {
      if (error instanceof EntryIdConflictError) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Error creating appraisal type:", error);
      res.status(500).json({ error: "Failed to create appraisal type" });
    }
  },

  async updateAppraisalType(req: Request, res: Response) {
    try {
      const parsed = updateMasterAppraisalTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid appraisal type data", details: parsed.error.issues });
      }
      const data = await mastersService.updateAppraisalType(req.params.id, parsed.data);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating appraisal type:", error);
      res.status(500).json({ error: "Failed to update appraisal type" });
    }
  },

  async deleteAppraisalType(req: Request, res: Response) {
    try {
      const data = await mastersService.deleteAppraisalType(req.params.id);
      res.json(data);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting appraisal type:", error);
      res.status(500).json({ error: "Failed to delete appraisal type" });
    }
  },
};
