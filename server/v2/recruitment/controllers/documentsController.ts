import { Request, Response } from "express";
import { documentsService } from "../services";
import {
  createTravelDocumentRequestSchema,
  createVisaRequestSchema,
  createCocRequestSchema,
  createCopRequestSchema,
  createStcwCertificateRequestSchema,
  createFlagEndorsementRequestSchema,
  createMedicalCertificateRequestSchema,
  createVaccinationRequestSchema,
  createTrainingCertificateRequestSchema,
  createEducationRequestSchema,
  createSeaServiceInternalRequestSchema,
  createSeaServiceExternalRequestSchema,
  createLicenseRequestSchema,
  createDocumentAttachmentRequestSchema,
} from "../../../../shared/v2/recruitment/types";

export async function getTravelDocuments(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const docs = await documentsService.getTravelDocuments(recCanUuid);
    res.json(docs);
  } catch (error) {
    console.error("Error fetching travel documents:", error);
    res.status(500).json({ error: "Failed to fetch travel documents" });
  }
}

export async function createTravelDocument(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createTravelDocumentRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const doc = await documentsService.createTravelDocument(recCanUuid, parsed.data);
    res.status(201).json(doc);
  } catch (error) {
    console.error("Error creating travel document:", error);
    res.status(500).json({ error: "Failed to create travel document" });
  }
}

export async function updateTravelDocument(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createTravelDocumentRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const doc = await documentsService.updateTravelDocument(id, parsed.data);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (error) {
    console.error("Error updating travel document:", error);
    res.status(500).json({ error: "Failed to update travel document" });
  }
}

export async function deleteTravelDocument(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteTravelDocument(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting travel document:", error);
    res.status(500).json({ error: "Failed to delete travel document" });
  }
}

export async function getVisas(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const visas = await documentsService.getVisas(recCanUuid);
    res.json(visas);
  } catch (error) {
    console.error("Error fetching visas:", error);
    res.status(500).json({ error: "Failed to fetch visas" });
  }
}

export async function createVisa(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createVisaRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const visa = await documentsService.createVisa(recCanUuid, parsed.data);
    res.status(201).json(visa);
  } catch (error) {
    console.error("Error creating visa:", error);
    res.status(500).json({ error: "Failed to create visa" });
  }
}

export async function updateVisa(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createVisaRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const visa = await documentsService.updateVisa(id, parsed.data);
    if (!visa) return res.status(404).json({ error: "Not found" });
    res.json(visa);
  } catch (error) {
    console.error("Error updating visa:", error);
    res.status(500).json({ error: "Failed to update visa" });
  }
}

export async function deleteVisa(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteVisa(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting visa:", error);
    res.status(500).json({ error: "Failed to delete visa" });
  }
}

export async function getCocs(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const cocs = await documentsService.getCocs(recCanUuid);
    res.json(cocs);
  } catch (error) {
    console.error("Error fetching COCs:", error);
    res.status(500).json({ error: "Failed to fetch COCs" });
  }
}

export async function createCoc(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createCocRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const coc = await documentsService.createCoc(recCanUuid, parsed.data);
    res.status(201).json(coc);
  } catch (error) {
    console.error("Error creating COC:", error);
    res.status(500).json({ error: "Failed to create COC" });
  }
}

export async function updateCoc(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createCocRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const coc = await documentsService.updateCoc(id, parsed.data);
    if (!coc) return res.status(404).json({ error: "Not found" });
    res.json(coc);
  } catch (error) {
    console.error("Error updating COC:", error);
    res.status(500).json({ error: "Failed to update COC" });
  }
}

export async function deleteCoc(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteCoc(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting COC:", error);
    res.status(500).json({ error: "Failed to delete COC" });
  }
}

export async function getCops(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const cops = await documentsService.getCops(recCanUuid);
    res.json(cops);
  } catch (error) {
    console.error("Error fetching COPs:", error);
    res.status(500).json({ error: "Failed to fetch COPs" });
  }
}

export async function createCop(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createCopRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const cop = await documentsService.createCop(recCanUuid, parsed.data);
    res.status(201).json(cop);
  } catch (error) {
    console.error("Error creating COP:", error);
    res.status(500).json({ error: "Failed to create COP" });
  }
}

export async function updateCop(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createCopRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const cop = await documentsService.updateCop(id, parsed.data);
    if (!cop) return res.status(404).json({ error: "Not found" });
    res.json(cop);
  } catch (error) {
    console.error("Error updating COP:", error);
    res.status(500).json({ error: "Failed to update COP" });
  }
}

export async function deleteCop(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteCop(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting COP:", error);
    res.status(500).json({ error: "Failed to delete COP" });
  }
}

export async function getStcwCertificates(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const certs = await documentsService.getStcwCertificates(recCanUuid);
    res.json(certs);
  } catch (error) {
    console.error("Error fetching STCW certificates:", error);
    res.status(500).json({ error: "Failed to fetch STCW certificates" });
  }
}

export async function createStcwCertificate(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createStcwCertificateRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const cert = await documentsService.createStcwCertificate(recCanUuid, parsed.data);
    res.status(201).json(cert);
  } catch (error) {
    console.error("Error creating STCW certificate:", error);
    res.status(500).json({ error: "Failed to create STCW certificate" });
  }
}

export async function updateStcwCertificate(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createStcwCertificateRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const cert = await documentsService.updateStcwCertificate(id, parsed.data);
    if (!cert) return res.status(404).json({ error: "Not found" });
    res.json(cert);
  } catch (error) {
    console.error("Error updating STCW certificate:", error);
    res.status(500).json({ error: "Failed to update STCW certificate" });
  }
}

export async function deleteStcwCertificate(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteStcwCertificate(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting STCW certificate:", error);
    res.status(500).json({ error: "Failed to delete STCW certificate" });
  }
}

export async function getFlagEndorsements(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const endorsements = await documentsService.getFlagEndorsements(recCanUuid);
    res.json(endorsements);
  } catch (error) {
    console.error("Error fetching flag endorsements:", error);
    res.status(500).json({ error: "Failed to fetch flag endorsements" });
  }
}

export async function createFlagEndorsement(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createFlagEndorsementRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const endorsement = await documentsService.createFlagEndorsement(recCanUuid, parsed.data);
    res.status(201).json(endorsement);
  } catch (error) {
    console.error("Error creating flag endorsement:", error);
    res.status(500).json({ error: "Failed to create flag endorsement" });
  }
}

export async function updateFlagEndorsement(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createFlagEndorsementRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const endorsement = await documentsService.updateFlagEndorsement(id, parsed.data);
    if (!endorsement) return res.status(404).json({ error: "Not found" });
    res.json(endorsement);
  } catch (error) {
    console.error("Error updating flag endorsement:", error);
    res.status(500).json({ error: "Failed to update flag endorsement" });
  }
}

export async function deleteFlagEndorsement(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteFlagEndorsement(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting flag endorsement:", error);
    res.status(500).json({ error: "Failed to delete flag endorsement" });
  }
}

export async function getMedicalCertificates(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const certs = await documentsService.getMedicalCertificates(recCanUuid);
    res.json(certs);
  } catch (error) {
    console.error("Error fetching medical certificates:", error);
    res.status(500).json({ error: "Failed to fetch medical certificates" });
  }
}

export async function createMedicalCertificate(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createMedicalCertificateRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const cert = await documentsService.createMedicalCertificate(recCanUuid, parsed.data);
    res.status(201).json(cert);
  } catch (error) {
    console.error("Error creating medical certificate:", error);
    res.status(500).json({ error: "Failed to create medical certificate" });
  }
}

export async function updateMedicalCertificate(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createMedicalCertificateRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const cert = await documentsService.updateMedicalCertificate(id, parsed.data);
    if (!cert) return res.status(404).json({ error: "Not found" });
    res.json(cert);
  } catch (error) {
    console.error("Error updating medical certificate:", error);
    res.status(500).json({ error: "Failed to update medical certificate" });
  }
}

export async function deleteMedicalCertificate(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteMedicalCertificate(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting medical certificate:", error);
    res.status(500).json({ error: "Failed to delete medical certificate" });
  }
}

export async function getVaccinations(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const vaccinations = await documentsService.getVaccinations(recCanUuid);
    res.json(vaccinations);
  } catch (error) {
    console.error("Error fetching vaccinations:", error);
    res.status(500).json({ error: "Failed to fetch vaccinations" });
  }
}

export async function createVaccination(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createVaccinationRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const vaccination = await documentsService.createVaccination(recCanUuid, parsed.data);
    res.status(201).json(vaccination);
  } catch (error) {
    console.error("Error creating vaccination:", error);
    res.status(500).json({ error: "Failed to create vaccination" });
  }
}

export async function updateVaccination(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createVaccinationRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const vaccination = await documentsService.updateVaccination(id, parsed.data);
    if (!vaccination) return res.status(404).json({ error: "Not found" });
    res.json(vaccination);
  } catch (error) {
    console.error("Error updating vaccination:", error);
    res.status(500).json({ error: "Failed to update vaccination" });
  }
}

export async function deleteVaccination(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteVaccination(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting vaccination:", error);
    res.status(500).json({ error: "Failed to delete vaccination" });
  }
}

export async function getTrainingCertificates(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const certs = await documentsService.getTrainingCertificates(recCanUuid);
    res.json(certs);
  } catch (error) {
    console.error("Error fetching training certificates:", error);
    res.status(500).json({ error: "Failed to fetch training certificates" });
  }
}

export async function createTrainingCertificate(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createTrainingCertificateRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const cert = await documentsService.createTrainingCertificate(recCanUuid, parsed.data);
    res.status(201).json(cert);
  } catch (error) {
    console.error("Error creating training certificate:", error);
    res.status(500).json({ error: "Failed to create training certificate" });
  }
}

export async function updateTrainingCertificate(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createTrainingCertificateRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const cert = await documentsService.updateTrainingCertificate(id, parsed.data);
    if (!cert) return res.status(404).json({ error: "Not found" });
    res.json(cert);
  } catch (error) {
    console.error("Error updating training certificate:", error);
    res.status(500).json({ error: "Failed to update training certificate" });
  }
}

export async function deleteTrainingCertificate(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteTrainingCertificate(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting training certificate:", error);
    res.status(500).json({ error: "Failed to delete training certificate" });
  }
}

export async function getEducation(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const education = await documentsService.getEducation(recCanUuid);
    res.json(education);
  } catch (error) {
    console.error("Error fetching education:", error);
    res.status(500).json({ error: "Failed to fetch education" });
  }
}

export async function createEducation(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createEducationRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const edu = await documentsService.createEducation(recCanUuid, parsed.data);
    res.status(201).json(edu);
  } catch (error) {
    console.error("Error creating education:", error);
    res.status(500).json({ error: "Failed to create education" });
  }
}

export async function updateEducation(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createEducationRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const edu = await documentsService.updateEducation(id, parsed.data);
    if (!edu) return res.status(404).json({ error: "Not found" });
    res.json(edu);
  } catch (error) {
    console.error("Error updating education:", error);
    res.status(500).json({ error: "Failed to update education" });
  }
}

export async function deleteEducation(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteEducation(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting education:", error);
    res.status(500).json({ error: "Failed to delete education" });
  }
}

export async function getSeaServiceInternal(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const service = await documentsService.getSeaServiceInternal(recCanUuid);
    res.json(service);
  } catch (error) {
    console.error("Error fetching internal sea service:", error);
    res.status(500).json({ error: "Failed to fetch internal sea service" });
  }
}

export async function createSeaServiceInternal(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createSeaServiceInternalRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const service = await documentsService.createSeaServiceInternal(recCanUuid, parsed.data);
    res.status(201).json(service);
  } catch (error) {
    console.error("Error creating internal sea service:", error);
    res.status(500).json({ error: "Failed to create internal sea service" });
  }
}

export async function updateSeaServiceInternal(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createSeaServiceInternalRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const service = await documentsService.updateSeaServiceInternal(id, parsed.data);
    if (!service) return res.status(404).json({ error: "Not found" });
    res.json(service);
  } catch (error) {
    console.error("Error updating internal sea service:", error);
    res.status(500).json({ error: "Failed to update internal sea service" });
  }
}

export async function deleteSeaServiceInternal(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteSeaServiceInternal(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting internal sea service:", error);
    res.status(500).json({ error: "Failed to delete internal sea service" });
  }
}

export async function getSeaServiceExternal(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const service = await documentsService.getSeaServiceExternal(recCanUuid);
    res.json(service);
  } catch (error) {
    console.error("Error fetching external sea service:", error);
    res.status(500).json({ error: "Failed to fetch external sea service" });
  }
}

export async function createSeaServiceExternal(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createSeaServiceExternalRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const service = await documentsService.createSeaServiceExternal(recCanUuid, parsed.data);
    res.status(201).json(service);
  } catch (error) {
    console.error("Error creating external sea service:", error);
    res.status(500).json({ error: "Failed to create external sea service" });
  }
}

export async function updateSeaServiceExternal(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createSeaServiceExternalRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const service = await documentsService.updateSeaServiceExternal(id, parsed.data);
    if (!service) return res.status(404).json({ error: "Not found" });
    res.json(service);
  } catch (error) {
    console.error("Error updating external sea service:", error);
    res.status(500).json({ error: "Failed to update external sea service" });
  }
}

export async function deleteSeaServiceExternal(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteSeaServiceExternal(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting external sea service:", error);
    res.status(500).json({ error: "Failed to delete external sea service" });
  }
}

export async function getLicenses(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const licenses = await documentsService.getLicenses(recCanUuid);
    res.json(licenses);
  } catch (error) {
    console.error("Error fetching licenses:", error);
    res.status(500).json({ error: "Failed to fetch licenses" });
  }
}

export async function createLicense(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createLicenseRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const license = await documentsService.createLicense(recCanUuid, parsed.data);
    res.status(201).json(license);
  } catch (error) {
    console.error("Error creating license:", error);
    res.status(500).json({ error: "Failed to create license" });
  }
}

export async function updateLicense(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createLicenseRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const license = await documentsService.updateLicense(id, parsed.data);
    if (!license) return res.status(404).json({ error: "Not found" });
    res.json(license);
  } catch (error) {
    console.error("Error updating license:", error);
    res.status(500).json({ error: "Failed to update license" });
  }
}

export async function deleteLicense(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteLicense(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting license:", error);
    res.status(500).json({ error: "Failed to delete license" });
  }
}

export async function getDocumentAttachments(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const attachments = await documentsService.getDocumentAttachments(recCanUuid);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching document attachments:", error);
    res.status(500).json({ error: "Failed to fetch document attachments" });
  }
}

export async function getDocumentAttachmentsByParent(req: Request, res: Response) {
  try {
    const { parentTableName, parentRecordUuid } = req.params;
    const attachments = await documentsService.getDocumentAttachmentsByParent(
      parentTableName,
      parentRecordUuid
    );
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching document attachments by parent:", error);
    res.status(500).json({ error: "Failed to fetch document attachments" });
  }
}

export async function createDocumentAttachment(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const parsed = createDocumentAttachmentRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const attachment = await documentsService.createDocumentAttachment(recCanUuid, parsed.data);
    res.status(201).json(attachment);
  } catch (error) {
    console.error("Error creating document attachment:", error);
    res.status(500).json({ error: "Failed to create document attachment" });
  }
}

export async function updateDocumentAttachment(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const parsed = createDocumentAttachmentRequestSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const attachment = await documentsService.updateDocumentAttachment(id, parsed.data);
    if (!attachment) return res.status(404).json({ error: "Not found" });
    res.json(attachment);
  } catch (error) {
    console.error("Error updating document attachment:", error);
    res.status(500).json({ error: "Failed to update document attachment" });
  }
}

export async function deleteDocumentAttachment(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const success = await documentsService.deleteDocumentAttachment(id);
    if (!success) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting document attachment:", error);
    res.status(500).json({ error: "Failed to delete document attachment" });
  }
}
