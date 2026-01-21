import { Request, Response } from "express";
import { candidateService } from "../services";
import { createCandidateRequestSchema } from "../../../../shared/v2/recruitment/types";

export async function getAllCandidates(req: Request, res: Response) {
  try {
    const candidates = await candidateService.getAllCandidates();
    res.json(candidates);
  } catch (error) {
    console.error("Error fetching candidates:", error);
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
}

export async function getCandidateById(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    const candidate = await candidateService.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    res.json(candidate);
  } catch (error) {
    console.error("Error fetching candidate:", error);
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
}

export async function getCandidateByUuid(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const candidate = await candidateService.getCandidateByUuid(recCanUuid);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    res.json(candidate);
  } catch (error) {
    console.error("Error fetching candidate:", error);
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
}

export async function createCandidate(req: Request, res: Response) {
  try {
    const parsed = createCandidateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const candidate = await candidateService.createCandidate(parsed.data);
    res.status(201).json(candidate);
  } catch (error) {
    console.error("Error creating candidate:", error);
    res.status(500).json({ error: "Failed to create candidate" });
  }
}

export async function updateCandidate(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    const candidate = await candidateService.updateCandidate(id, req.body);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    res.json(candidate);
  } catch (error) {
    console.error("Error updating candidate:", error);
    res.status(500).json({ error: "Failed to update candidate" });
  }
}

export async function updateCandidateByUuid(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const candidate = await candidateService.updateCandidateByUuid(recCanUuid, req.body);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    res.json(candidate);
  } catch (error) {
    console.error("Error updating candidate:", error);
    res.status(500).json({ error: "Failed to update candidate" });
  }
}

export async function deleteCandidate(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    const deleted = await candidateService.deleteCandidate(id);
    res.json({ success: deleted });
  } catch (error) {
    console.error("Error deleting candidate:", error);
    res.status(500).json({ error: "Failed to delete candidate" });
  }
}

export async function deleteCandidateByUuid(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const deleted = await candidateService.deleteCandidateByUuid(recCanUuid);
    res.json({ success: deleted });
  } catch (error) {
    console.error("Error deleting candidate:", error);
    res.status(500).json({ error: "Failed to delete candidate" });
  }
}

export async function getVesselTypesApplied(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const vesselTypes = await candidateService.getVesselTypesApplied(recCanUuid);
    res.json(vesselTypes);
  } catch (error) {
    console.error("Error fetching vessel types:", error);
    res.status(500).json({ error: "Failed to fetch vessel types" });
  }
}

export async function addVesselTypeApplied(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const { vesselTypeUuid } = req.body;
    const vesselType = await candidateService.addVesselTypeApplied(recCanUuid, vesselTypeUuid);
    res.status(201).json(vesselType);
  } catch (error) {
    console.error("Error adding vessel type:", error);
    res.status(500).json({ error: "Failed to add vessel type" });
  }
}

export async function removeVesselTypeApplied(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    const deleted = await candidateService.removeVesselTypeApplied(id);
    res.json({ success: deleted });
  } catch (error) {
    console.error("Error removing vessel type:", error);
    res.status(500).json({ error: "Failed to remove vessel type" });
  }
}

export async function replaceVesselTypes(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const vesselTypes = req.body;
    if (!Array.isArray(vesselTypes)) {
      return res.status(400).json({ error: "Expected array of vessel types" });
    }
    const vesselTypeUuids = vesselTypes.map((vt: any) => vt.vesselTypeUuid);
    const results = await candidateService.replaceVesselTypes(recCanUuid, vesselTypeUuids);
    res.json(results);
  } catch (error) {
    console.error("Error replacing vessel types:", error);
    res.status(500).json({ error: "Failed to replace vessel types" });
  }
}

export async function getPersonalDetails(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const details = await candidateService.getPersonalDetails(recCanUuid);
    res.json(details);
  } catch (error) {
    console.error("Error fetching personal details:", error);
    res.status(500).json({ error: "Failed to fetch personal details" });
  }
}

export async function upsertPersonalDetails(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const details = await candidateService.upsertPersonalDetails(recCanUuid, req.body);
    res.json(details);
  } catch (error) {
    console.error("Error upserting personal details:", error);
    res.status(500).json({ error: "Failed to upsert personal details" });
  }
}

export async function getAddress(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const address = await candidateService.getAddress(recCanUuid);
    res.json(address);
  } catch (error) {
    console.error("Error fetching address:", error);
    res.status(500).json({ error: "Failed to fetch address" });
  }
}

export async function upsertAddress(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const address = await candidateService.upsertAddress(recCanUuid, req.body);
    res.json(address);
  } catch (error) {
    console.error("Error upserting address:", error);
    res.status(500).json({ error: "Failed to upsert address" });
  }
}

export async function getFamilyInfo(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const info = await candidateService.getFamilyInfo(recCanUuid);
    res.json(info);
  } catch (error) {
    console.error("Error fetching family info:", error);
    res.status(500).json({ error: "Failed to fetch family info" });
  }
}

export async function upsertFamilyInfo(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const info = await candidateService.upsertFamilyInfo(recCanUuid, req.body);
    res.json(info);
  } catch (error) {
    console.error("Error upserting family info:", error);
    res.status(500).json({ error: "Failed to upsert family info" });
  }
}

export async function getChildren(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const children = await candidateService.getChildren(recCanUuid);
    res.json(children);
  } catch (error) {
    console.error("Error fetching children:", error);
    res.status(500).json({ error: "Failed to fetch children" });
  }
}

export async function createChild(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const child = await candidateService.createChild(recCanUuid, req.body);
    res.status(201).json(child);
  } catch (error) {
    console.error("Error creating child:", error);
    res.status(500).json({ error: "Failed to create child" });
  }
}

export async function updateChild(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    const child = await candidateService.updateChild(id, req.body);
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }
    res.json(child);
  } catch (error) {
    console.error("Error updating child:", error);
    res.status(500).json({ error: "Failed to update child" });
  }
}

export async function deleteChild(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    const deleted = await candidateService.deleteChild(id);
    res.json({ success: deleted });
  } catch (error) {
    console.error("Error deleting child:", error);
    res.status(500).json({ error: "Failed to delete child" });
  }
}

export async function replaceChildren(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const children = req.body;
    if (!Array.isArray(children)) {
      return res.status(400).json({ error: "Expected array of children" });
    }
    const results = await candidateService.replaceChildren(recCanUuid, children);
    res.json(results);
  } catch (error) {
    console.error("Error replacing children:", error);
    res.status(500).json({ error: "Failed to replace children" });
  }
}

export async function getNextOfKin(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const nok = await candidateService.getNextOfKin(recCanUuid);
    res.json(nok);
  } catch (error) {
    console.error("Error fetching next of kin:", error);
    res.status(500).json({ error: "Failed to fetch next of kin" });
  }
}

export async function upsertNextOfKin(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const nok = await candidateService.upsertNextOfKin(recCanUuid, req.body);
    res.json(nok);
  } catch (error) {
    console.error("Error upserting next of kin:", error);
    res.status(500).json({ error: "Failed to upsert next of kin" });
  }
}
