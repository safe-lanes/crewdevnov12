import { Request, Response } from "express";
import { documentsService } from "../services";

export async function getDocuments(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const docs = await documentsService.getDocuments(recCanUuid);
    res.json(docs);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
}

export async function createDocument(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const doc = await documentsService.createDocument(recCanUuid, req.body);
    res.status(201).json(doc);
  } catch (error) {
    console.error("Error creating document:", error);
    res.status(500).json({ error: "Failed to create document" });
  }
}

export async function updateDocument(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const doc = await documentsService.updateDocument(id, req.body);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ error: "Failed to update document" });
  }
}

export async function deleteDocument(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const result = await documentsService.deleteDocument(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
}

export async function getDocumentAttachments(req: Request, res: Response) {
  try {
    const { docUuid } = req.params;
    const attachments = await documentsService.getDocumentAttachments(docUuid);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching attachments:", error);
    res.status(500).json({ error: "Failed to fetch attachments" });
  }
}

export async function createDocumentAttachment(req: Request, res: Response) {
  try {
    const { docUuid } = req.params;
    const attachment = await documentsService.createDocumentAttachment(docUuid, req.body);
    res.status(201).json(attachment);
  } catch (error) {
    console.error("Error creating attachment:", error);
    res.status(500).json({ error: "Failed to create attachment" });
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
    const visa = await documentsService.createVisa(recCanUuid, req.body);
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
    const visa = await documentsService.updateVisa(id, req.body);
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
    const result = await documentsService.deleteVisa(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting visa:", error);
    res.status(500).json({ error: "Failed to delete visa" });
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
    const edu = await documentsService.createEducation(recCanUuid, req.body);
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
    const edu = await documentsService.updateEducation(id, req.body);
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
    const result = await documentsService.deleteEducation(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting education:", error);
    res.status(500).json({ error: "Failed to delete education" });
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
    const license = await documentsService.createLicense(recCanUuid, req.body);
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
    const license = await documentsService.updateLicense(id, req.body);
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
    const result = await documentsService.deleteLicense(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting license:", error);
    res.status(500).json({ error: "Failed to delete license" });
  }
}

export async function getTrainingCourses(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const courses = await documentsService.getTrainingCourses(recCanUuid);
    res.json(courses);
  } catch (error) {
    console.error("Error fetching training courses:", error);
    res.status(500).json({ error: "Failed to fetch training courses" });
  }
}

export async function createTrainingCourse(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const course = await documentsService.createTrainingCourse(recCanUuid, req.body);
    res.status(201).json(course);
  } catch (error) {
    console.error("Error creating training course:", error);
    res.status(500).json({ error: "Failed to create training course" });
  }
}

export async function updateTrainingCourse(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const course = await documentsService.updateTrainingCourse(id, req.body);
    if (!course) return res.status(404).json({ error: "Not found" });
    res.json(course);
  } catch (error) {
    console.error("Error updating training course:", error);
    res.status(500).json({ error: "Failed to update training course" });
  }
}

export async function deleteTrainingCourse(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const result = await documentsService.deleteTrainingCourse(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting training course:", error);
    res.status(500).json({ error: "Failed to delete training course" });
  }
}

export async function getSeaService(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const seaService = await documentsService.getSeaService(recCanUuid);
    res.json(seaService);
  } catch (error) {
    console.error("Error fetching sea service:", error);
    res.status(500).json({ error: "Failed to fetch sea service" });
  }
}

export async function createSeaService(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const ss = await documentsService.createSeaService(recCanUuid, req.body);
    res.status(201).json(ss);
  } catch (error) {
    console.error("Error creating sea service:", error);
    res.status(500).json({ error: "Failed to create sea service" });
  }
}

export async function updateSeaService(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const ss = await documentsService.updateSeaService(id, req.body);
    if (!ss) return res.status(404).json({ error: "Not found" });
    res.json(ss);
  } catch (error) {
    console.error("Error updating sea service:", error);
    res.status(500).json({ error: "Failed to update sea service" });
  }
}

export async function deleteSeaService(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const result = await documentsService.deleteSeaService(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting sea service:", error);
    res.status(500).json({ error: "Failed to delete sea service" });
  }
}

export async function getAdditionalInfo(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const info = await documentsService.getAdditionalInfo(recCanUuid);
    res.json(info);
  } catch (error) {
    console.error("Error fetching additional info:", error);
    res.status(500).json({ error: "Failed to fetch additional info" });
  }
}

export async function createAdditionalInfo(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const info = await documentsService.createAdditionalInfo(recCanUuid, req.body);
    res.status(201).json(info);
  } catch (error) {
    console.error("Error creating additional info:", error);
    res.status(500).json({ error: "Failed to create additional info" });
  }
}

export async function updateAdditionalInfo(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const info = await documentsService.updateAdditionalInfo(id, req.body);
    if (!info) return res.status(404).json({ error: "Not found" });
    res.json(info);
  } catch (error) {
    console.error("Error updating additional info:", error);
    res.status(500).json({ error: "Failed to update additional info" });
  }
}

export async function deleteAdditionalInfo(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const result = await documentsService.deleteAdditionalInfo(id);
    res.json({ success: result });
  } catch (error) {
    console.error("Error deleting additional info:", error);
    res.status(500).json({ error: "Failed to delete additional info" });
  }
}
