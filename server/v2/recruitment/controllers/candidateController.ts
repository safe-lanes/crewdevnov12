import { Request, Response } from "express";
import { candidateService } from "../services";
import {
  createCandidateRequestSchema,
  updateCandidateRequestSchema,
  upsertPersonalDetailsRequestSchema,
  upsertAddressRequestSchema,
  upsertFamilyInfoRequestSchema,
  createChildRequestSchema,
  updateChildRequestSchema,
  createNextOfKinRequestSchema,
  updateNextOfKinRequestSchema,
  addVesselTypeAppliedRequestSchema,
} from "../../../../shared/v2/recruitment/types";

// ============================================================================
// CANDIDATE ENDPOINTS
// ============================================================================

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
    
    const parsed = updateCandidateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const candidate = await candidateService.updateCandidate(id, parsed.data);
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
    
    const success = await candidateService.deleteCandidate(id);
    if (!success) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting candidate:", error);
    res.status(500).json({ error: "Failed to delete candidate" });
  }
}

// ============================================================================
// VESSEL TYPES APPLIED ENDPOINTS
// ============================================================================

export async function getVesselTypesApplied(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    
    const candidate = await candidateService.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    const vesselTypes = await candidateService.getVesselTypesApplied(candidate.recCanUuid);
    res.json(vesselTypes);
  } catch (error) {
    console.error("Error fetching vessel types:", error);
    res.status(500).json({ error: "Failed to fetch vessel types" });
  }
}

export async function addVesselTypeApplied(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    
    const candidate = await candidateService.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    const parsed = addVesselTypeAppliedRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const vesselType = await candidateService.addVesselTypeApplied(
      candidate.recCanUuid,
      parsed.data
    );
    res.status(201).json(vesselType);
  } catch (error) {
    console.error("Error adding vessel type:", error);
    res.status(500).json({ error: "Failed to add vessel type" });
  }
}

export async function removeVesselTypeApplied(req: Request, res: Response) {
  try {
    const vtaId = parseInt(req.params.vtaId, 10);
    if (isNaN(vtaId)) {
      return res.status(400).json({ error: "Invalid vessel type ID" });
    }
    
    const success = await candidateService.removeVesselTypeApplied(vtaId);
    if (!success) {
      return res.status(404).json({ error: "Vessel type not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error removing vessel type:", error);
    res.status(500).json({ error: "Failed to remove vessel type" });
  }
}

// ============================================================================
// PERSONAL DETAILS ENDPOINTS
// ============================================================================

export async function getPersonalDetails(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    
    const candidate = await candidateService.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    const details = await candidateService.getPersonalDetails(candidate.recCanUuid);
    res.json(details || {});
  } catch (error) {
    console.error("Error fetching personal details:", error);
    res.status(500).json({ error: "Failed to fetch personal details" });
  }
}

export async function upsertPersonalDetails(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    
    const candidate = await candidateService.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    const parsed = upsertPersonalDetailsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const details = await candidateService.upsertPersonalDetails(
      candidate.recCanUuid,
      parsed.data
    );
    res.json(details);
  } catch (error) {
    console.error("Error upserting personal details:", error);
    res.status(500).json({ error: "Failed to upsert personal details" });
  }
}

// ============================================================================
// ADDRESS ENDPOINTS
// ============================================================================

export async function getAddress(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    
    const candidate = await candidateService.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    const address = await candidateService.getAddress(candidate.recCanUuid);
    res.json(address || {});
  } catch (error) {
    console.error("Error fetching address:", error);
    res.status(500).json({ error: "Failed to fetch address" });
  }
}

export async function upsertAddress(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    
    const candidate = await candidateService.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    const parsed = upsertAddressRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const address = await candidateService.upsertAddress(
      candidate.recCanUuid,
      parsed.data
    );
    res.json(address);
  } catch (error) {
    console.error("Error upserting address:", error);
    res.status(500).json({ error: "Failed to upsert address" });
  }
}

// ============================================================================
// FAMILY INFO ENDPOINTS
// ============================================================================

export async function getFamilyInfo(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    
    const candidate = await candidateService.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    const familyInfo = await candidateService.getFamilyInfo(candidate.recCanUuid);
    res.json(familyInfo || {});
  } catch (error) {
    console.error("Error fetching family info:", error);
    res.status(500).json({ error: "Failed to fetch family info" });
  }
}

export async function upsertFamilyInfo(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    
    const candidate = await candidateService.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    const parsed = upsertFamilyInfoRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const familyInfo = await candidateService.upsertFamilyInfo(
      candidate.recCanUuid,
      parsed.data
    );
    res.json(familyInfo);
  } catch (error) {
    console.error("Error upserting family info:", error);
    res.status(500).json({ error: "Failed to upsert family info" });
  }
}

// ============================================================================
// CHILDREN ENDPOINTS
// ============================================================================

export async function getChildren(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    
    const candidate = await candidateService.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    const children = await candidateService.getChildren(candidate.recCanUuid);
    res.json(children);
  } catch (error) {
    console.error("Error fetching children:", error);
    res.status(500).json({ error: "Failed to fetch children" });
  }
}

export async function createChild(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    
    const candidate = await candidateService.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    const parsed = createChildRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const child = await candidateService.createChild(
      candidate.recCanUuid,
      parsed.data
    );
    res.status(201).json(child);
  } catch (error) {
    console.error("Error creating child:", error);
    res.status(500).json({ error: "Failed to create child" });
  }
}

export async function updateChild(req: Request, res: Response) {
  try {
    const childId = parseInt(req.params.childId, 10);
    if (isNaN(childId)) {
      return res.status(400).json({ error: "Invalid child ID" });
    }
    
    const parsed = updateChildRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const child = await candidateService.updateChild(childId, parsed.data);
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
    const childId = parseInt(req.params.childId, 10);
    if (isNaN(childId)) {
      return res.status(400).json({ error: "Invalid child ID" });
    }
    
    const success = await candidateService.deleteChild(childId);
    if (!success) {
      return res.status(404).json({ error: "Child not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting child:", error);
    res.status(500).json({ error: "Failed to delete child" });
  }
}

// ============================================================================
// NEXT OF KIN ENDPOINTS
// ============================================================================

export async function getNextOfKin(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    
    const candidate = await candidateService.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    const nextOfKin = await candidateService.getNextOfKin(candidate.recCanUuid);
    res.json(nextOfKin);
  } catch (error) {
    console.error("Error fetching next of kin:", error);
    res.status(500).json({ error: "Failed to fetch next of kin" });
  }
}

export async function createNextOfKin(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid candidate ID" });
    }
    
    const candidate = await candidateService.getCandidateById(id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    const parsed = createNextOfKinRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const nextOfKin = await candidateService.createNextOfKin(
      candidate.recCanUuid,
      parsed.data
    );
    res.status(201).json(nextOfKin);
  } catch (error) {
    console.error("Error creating next of kin:", error);
    res.status(500).json({ error: "Failed to create next of kin" });
  }
}

export async function updateNextOfKin(req: Request, res: Response) {
  try {
    const nokId = parseInt(req.params.nokId, 10);
    if (isNaN(nokId)) {
      return res.status(400).json({ error: "Invalid next of kin ID" });
    }
    
    const parsed = updateNextOfKinRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const nextOfKin = await candidateService.updateNextOfKin(nokId, parsed.data);
    if (!nextOfKin) {
      return res.status(404).json({ error: "Next of kin not found" });
    }
    
    res.json(nextOfKin);
  } catch (error) {
    console.error("Error updating next of kin:", error);
    res.status(500).json({ error: "Failed to update next of kin" });
  }
}

export async function deleteNextOfKin(req: Request, res: Response) {
  try {
    const nokId = parseInt(req.params.nokId, 10);
    if (isNaN(nokId)) {
      return res.status(400).json({ error: "Invalid next of kin ID" });
    }
    
    const success = await candidateService.deleteNextOfKin(nokId);
    if (!success) {
      return res.status(404).json({ error: "Next of kin not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting next of kin:", error);
    res.status(500).json({ error: "Failed to delete next of kin" });
  }
}
