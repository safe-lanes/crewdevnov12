import { Request, Response } from "express";
import {
  screeningB1Service,
  screeningB2Service,
  screeningB3Service,
  screeningB4Service,
  screeningB5Service,
  screeningB6Service,
  screeningB7Service,
  screeningB8Service,
} from "../services/screeningService";

export const screeningB1Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB1Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B1:", error);
      res.status(500).json({ error: "Failed to get B1 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB1Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B1:", error);
      res.status(500).json({ error: "Failed to upsert B1 screening" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b1Uuid } = req.params;
      const result = await screeningB1Service.getComments(b1Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B1 comments:", error);
      res.status(500).json({ error: "Failed to get B1 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b1Uuid } = req.params;
      const result = await screeningB1Service.createComment(b1Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B1 comment:", error);
      res.status(500).json({ error: "Failed to create B1 comment" });
    }
  },

  async getAttachments(req: Request, res: Response) {
    try {
      const { b1Uuid } = req.params;
      const result = await screeningB1Service.getAttachments(b1Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B1 attachments:", error);
      res.status(500).json({ error: "Failed to get B1 attachments" });
    }
  },

  async createAttachment(req: Request, res: Response) {
    try {
      const { b1Uuid } = req.params;
      const result = await screeningB1Service.createAttachment(b1Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B1 attachment:", error);
      res.status(500).json({ error: "Failed to create B1 attachment" });
    }
  },
};

export const screeningB2Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB2Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B2:", error);
      res.status(500).json({ error: "Failed to get B2 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB2Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B2:", error);
      res.status(500).json({ error: "Failed to upsert B2 screening" });
    }
  },

  async getItems(req: Request, res: Response) {
    try {
      const { b2Uuid } = req.params;
      const result = await screeningB2Service.getItems(b2Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B2 items:", error);
      res.status(500).json({ error: "Failed to get B2 items" });
    }
  },

  async createItem(req: Request, res: Response) {
    try {
      const { b2Uuid } = req.params;
      const result = await screeningB2Service.createItem(b2Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B2 item:", error);
      res.status(500).json({ error: "Failed to create B2 item" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b2Uuid } = req.params;
      const result = await screeningB2Service.getComments(b2Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B2 comments:", error);
      res.status(500).json({ error: "Failed to get B2 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b2Uuid } = req.params;
      const result = await screeningB2Service.createComment(b2Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B2 comment:", error);
      res.status(500).json({ error: "Failed to create B2 comment" });
    }
  },
};

export const screeningB3Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB3Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B3:", error);
      res.status(500).json({ error: "Failed to get B3 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB3Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B3:", error);
      res.status(500).json({ error: "Failed to upsert B3 screening" });
    }
  },

  async getAuthorities(req: Request, res: Response) {
    try {
      const { b3Uuid } = req.params;
      const result = await screeningB3Service.getAuthorities(b3Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B3 authorities:", error);
      res.status(500).json({ error: "Failed to get B3 authorities" });
    }
  },

  async createAuthority(req: Request, res: Response) {
    try {
      const { b3Uuid } = req.params;
      const result = await screeningB3Service.createAuthority(b3Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B3 authority:", error);
      res.status(500).json({ error: "Failed to create B3 authority" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b3Uuid } = req.params;
      const result = await screeningB3Service.getComments(b3Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B3 comments:", error);
      res.status(500).json({ error: "Failed to get B3 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b3Uuid } = req.params;
      const result = await screeningB3Service.createComment(b3Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B3 comment:", error);
      res.status(500).json({ error: "Failed to create B3 comment" });
    }
  },

  async updateAuthority(req: Request, res: Response) {
    try {
      const { authUuid } = req.params;
      const result = await screeningB3Service.updateAuthority(authUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B3 authority:", error);
      res.status(500).json({ error: "Failed to update B3 authority" });
    }
  },
};

export const screeningB4Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB4Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B4:", error);
      res.status(500).json({ error: "Failed to get B4 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB4Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B4:", error);
      res.status(500).json({ error: "Failed to upsert B4 screening" });
    }
  },

  async getCertItems(req: Request, res: Response) {
    try {
      const { b4Uuid } = req.params;
      const result = await screeningB4Service.getCertItems(b4Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B4 cert items:", error);
      res.status(500).json({ error: "Failed to get B4 cert items" });
    }
  },

  async createCertItem(req: Request, res: Response) {
    try {
      const { b4Uuid } = req.params;
      const result = await screeningB4Service.createCertItem(b4Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B4 cert item:", error);
      res.status(500).json({ error: "Failed to create B4 cert item" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b4Uuid } = req.params;
      const result = await screeningB4Service.getComments(b4Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B4 comments:", error);
      res.status(500).json({ error: "Failed to get B4 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b4Uuid } = req.params;
      const result = await screeningB4Service.createComment(b4Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B4 comment:", error);
      res.status(500).json({ error: "Failed to create B4 comment" });
    }
  },

  async updateCertItem(req: Request, res: Response) {
    try {
      const { certUuid } = req.params;
      const result = await screeningB4Service.updateCertItem(certUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B4 cert item:", error);
      res.status(500).json({ error: "Failed to update B4 cert item" });
    }
  },
};

export const screeningB5Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB5Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B5:", error);
      res.status(500).json({ error: "Failed to get B5 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB5Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B5:", error);
      res.status(500).json({ error: "Failed to upsert B5 screening" });
    }
  },

  async getTestItems(req: Request, res: Response) {
    try {
      const { b5Uuid } = req.params;
      const result = await screeningB5Service.getTestItems(b5Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B5 test items:", error);
      res.status(500).json({ error: "Failed to get B5 test items" });
    }
  },

  async createTestItem(req: Request, res: Response) {
    try {
      const { b5Uuid } = req.params;
      const result = await screeningB5Service.createTestItem(b5Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B5 test item:", error);
      res.status(500).json({ error: "Failed to create B5 test item" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b5Uuid } = req.params;
      const result = await screeningB5Service.getComments(b5Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B5 comments:", error);
      res.status(500).json({ error: "Failed to get B5 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b5Uuid } = req.params;
      const result = await screeningB5Service.createComment(b5Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B5 comment:", error);
      res.status(500).json({ error: "Failed to create B5 comment" });
    }
  },

  async updateTestItem(req: Request, res: Response) {
    try {
      const { testUuid } = req.params;
      const result = await screeningB5Service.updateTestItem(testUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B5 test item:", error);
      res.status(500).json({ error: "Failed to update B5 test item" });
    }
  },
};

export const screeningB6Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB6Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B6:", error);
      res.status(500).json({ error: "Failed to get B6 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB6Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B6:", error);
      res.status(500).json({ error: "Failed to upsert B6 screening" });
    }
  },

  async getInterviewItems(req: Request, res: Response) {
    try {
      const { b6Uuid } = req.params;
      const result = await screeningB6Service.getInterviewItems(b6Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B6 interview items:", error);
      res.status(500).json({ error: "Failed to get B6 interview items" });
    }
  },

  async createInterviewItem(req: Request, res: Response) {
    try {
      const { b6Uuid } = req.params;
      const result = await screeningB6Service.createInterviewItem(b6Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B6 interview item:", error);
      res.status(500).json({ error: "Failed to create B6 interview item" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b6Uuid } = req.params;
      const result = await screeningB6Service.getComments(b6Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B6 comments:", error);
      res.status(500).json({ error: "Failed to get B6 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b6Uuid } = req.params;
      const result = await screeningB6Service.createComment(b6Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B6 comment:", error);
      res.status(500).json({ error: "Failed to create B6 comment" });
    }
  },

  async updateInterviewItem(req: Request, res: Response) {
    try {
      const { intUuid } = req.params;
      const result = await screeningB6Service.updateInterviewItem(intUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating B6 interview item:", error);
      res.status(500).json({ error: "Failed to update B6 interview item" });
    }
  },
};

export const screeningB7Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB7Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B7:", error);
      res.status(500).json({ error: "Failed to get B7 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB7Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B7:", error);
      res.status(500).json({ error: "Failed to upsert B7 screening" });
    }
  },

  async getTrainingItems(req: Request, res: Response) {
    try {
      const { b7Uuid } = req.params;
      const result = await screeningB7Service.getTrainingItems(b7Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B7 training items:", error);
      res.status(500).json({ error: "Failed to get B7 training items" });
    }
  },

  async createTrainingItem(req: Request, res: Response) {
    try {
      const { b7Uuid } = req.params;
      const result = await screeningB7Service.createTrainingItem(b7Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B7 training item:", error);
      res.status(500).json({ error: "Failed to create B7 training item" });
    }
  },
};

export const screeningB8Controller = {
  async get(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB8Service.getByCandidate(recCanUuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B8:", error);
      res.status(500).json({ error: "Failed to get B8 screening" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { recCanUuid } = req.params;
      const result = await screeningB8Service.upsert(recCanUuid, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error upserting B8:", error);
      res.status(500).json({ error: "Failed to upsert B8 screening" });
    }
  },

  async getApprovers(req: Request, res: Response) {
    try {
      const { b8Uuid } = req.params;
      const result = await screeningB8Service.getApprovers(b8Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B8 approvers:", error);
      res.status(500).json({ error: "Failed to get B8 approvers" });
    }
  },

  async createApprover(req: Request, res: Response) {
    try {
      const { b8Uuid } = req.params;
      const result = await screeningB8Service.createApprover(b8Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B8 approver:", error);
      res.status(500).json({ error: "Failed to create B8 approver" });
    }
  },

  async getComments(req: Request, res: Response) {
    try {
      const { b8Uuid } = req.params;
      const result = await screeningB8Service.getComments(b8Uuid);
      res.json(result);
    } catch (error) {
      console.error("Error getting B8 comments:", error);
      res.status(500).json({ error: "Failed to get B8 comments" });
    }
  },

  async createComment(req: Request, res: Response) {
    try {
      const { b8Uuid } = req.params;
      const result = await screeningB8Service.createComment(b8Uuid, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating B8 comment:", error);
      res.status(500).json({ error: "Failed to create B8 comment" });
    }
  },
};
