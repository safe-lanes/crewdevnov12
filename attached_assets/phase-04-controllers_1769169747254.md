# Phase 4: Controller Layer

## Context
Phases 1-3 are complete. You have:
- 25 tables in `shared/v2/crew-pool/schema.ts`
- Types in `shared/v2/crew-pool/types.ts`
- 12 repositories in `server/v2/crew-pool/repositories/`
- 8 services in `server/v2/crew-pool/services/`

## Objective
Create the Controller layer that handles HTTP requests. Controllers validate request data, call services, and return responses.

## Reference Files (DO NOT MODIFY - use as patterns only)
- `server/v2/recruitment/controllers/candidateController.ts` - Follow this pattern
- Look at existing controller patterns in the project

## Files to Create

### Folder: `server/v2/crew-pool/controllers/`

### 1. `crewMembersController.ts`

```typescript
import { Request, Response } from 'express';
import { crewMembersService } from '../services';
import { insertCrewMemberV2Schema } from '@shared/v2/crew-pool/types';
import { z } from 'zod';

export const crewMembersController = {
  async getAll(req: Request, res: Response) {
    try {
      const { status, isActive, search } = req.query;
      const crew = await crewMembersService.getAll({
        status: status as string,
        isActive: isActive === 'true',
        search: search as string,
      });
      res.json(crew);
    } catch (error) {
      console.error('Error fetching crew:', error);
      res.status(500).json({ error: 'Failed to fetch crew members' });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const crew = await crewMembersService.getByUuid(crewUuid);
      res.json(crew);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      console.error('Error fetching crew:', error);
      res.status(500).json({ error: 'Failed to fetch crew member' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const validatedData = insertCrewMemberV2Schema.omit({ crewUuid: true }).parse(req.body);
      const crew = await crewMembersService.create(validatedData);
      res.status(201).json(crew);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error creating crew:', error);
      res.status(500).json({ error: 'Failed to create crew member' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewMemberV2Schema.partial().parse(req.body);
      const crew = await crewMembersService.update(crewUuid, validatedData);
      res.json(crew);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      console.error('Error updating crew:', error);
      res.status(500).json({ error: 'Failed to update crew member' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      await crewMembersService.archive(crewUuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      console.error('Error deleting crew:', error);
      res.status(500).json({ error: 'Failed to delete crew member' });
    }
  },
};
```

### 2. `crewAssignmentsController.ts`

```typescript
import { Request, Response } from 'express';
import { crewAssignmentsService } from '../services';
import { insertCrewAssignmentSchema } from '@shared/v2/crew-pool/types';
import { z } from 'zod';

export const crewAssignmentsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const assignments = await crewAssignmentsService.getAll(crewUuid);
      res.json(assignments);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  },

  async getCurrent(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const assignment = await crewAssignmentsService.getCurrent(crewUuid);
      res.json(assignment);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to fetch current assignment' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewAssignmentSchema.omit({ assignUuid: true, crewUuid: true }).parse(req.body);
      const assignment = await crewAssignmentsService.create(crewUuid, validatedData);
      res.status(201).json(assignment);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create assignment' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { assignUuid } = req.params;
      const validatedData = insertCrewAssignmentSchema.partial().parse(req.body);
      const assignment = await crewAssignmentsService.update(assignUuid, validatedData);
      res.json(assignment);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update assignment' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { assignUuid } = req.params;
      await crewAssignmentsService.delete(assignUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete assignment' });
    }
  },
};
```

### 3. `crewDocumentsController.ts` (Pattern for section controllers)

```typescript
import { Request, Response } from 'express';
import { crewDocumentsService } from '../services';
import { insertCrewDocumentSchema } from '@shared/v2/crew-pool/types';
import { z } from 'zod';

export const crewDocumentsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const documents = await crewDocumentsService.getAll(crewUuid);
      res.json(documents);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { crewUuid } = req.params;
      const validatedData = insertCrewDocumentSchema.omit({ docUuid: true, crewUuid: true }).parse(req.body);
      const document = await crewDocumentsService.create(crewUuid, validatedData);
      res.status(201).json(document);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create document' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { docUuid } = req.params;
      const validatedData = insertCrewDocumentSchema.partial().parse(req.body);
      const document = await crewDocumentsService.update(docUuid, validatedData);
      res.json(document);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update document' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { docUuid } = req.params;
      await crewDocumentsService.delete(docUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete document' });
    }
  },

  async addAttachment(req: Request, res: Response) {
    try {
      const { docUuid } = req.params;
      const { fileName, filePath, fileType, fileSize } = req.body;
      
      if (!fileName || !filePath) {
        return res.status(400).json({ error: 'fileName and filePath are required' });
      }
      
      const attachment = await crewDocumentsService.addAttachment(docUuid, {
        fileName,
        filePath,
        fileType: fileType || 'application/octet-stream',
        fileSize: fileSize || 0,
      });
      res.status(201).json(attachment);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add attachment' });
    }
  },

  async removeAttachment(req: Request, res: Response) {
    try {
      const { attUuid } = req.params;
      await crewDocumentsService.removeAttachment(attUuid);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to remove attachment' });
    }
  },
};
```

### All Controllers to Create

| File | Endpoints | Notes |
|------|-----------|-------|
| `crewMembersController.ts` | CRUD for crew | Filters in getAll |
| `crewAssignmentsController.ts` | Assignments | getCurrent endpoint |
| `crewPersonalController.ts` | Personal + Address | PUT for upsert |
| `crewVesselTypesController.ts` | Vessel types | PUT for sync |
| `crewFamilyController.ts` | Family + Children + NOK | Nested structure |
| `crewDocumentsController.ts` | Documents | With attachments |
| `crewVisasController.ts` | Visas | With attachments |
| `crewEducationController.ts` | Education | With attachments |
| `crewLicensesController.ts` | Licenses | With archive endpoint |
| `crewTrainingController.ts` | Training | With attachments |
| `crewSeaServiceController.ts` | Sea service | Type filter |
| `crewMedicalController.ts` | Medicals + Doctor visits | Two entity types |
| `crewTransferController.ts` | Transfer | Single POST endpoint |

### 4. `index.ts`

```typescript
export * from './crewMembersController';
export * from './crewAssignmentsController';
export * from './crewPersonalController';
export * from './crewVesselTypesController';
export * from './crewFamilyController';
export * from './crewDocumentsController';
export * from './crewVisasController';
export * from './crewEducationController';
export * from './crewLicensesController';
export * from './crewTrainingController';
export * from './crewSeaServiceController';
export * from './crewMedicalController';
export * from './crewTransferController';
```

## Key Patterns

### 1. Error Handling
```typescript
try {
  // ... operation
} catch (error: any) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: error.errors });
  }
  if (error.message?.includes('not found')) {
    return res.status(404).json({ error: error.message });
  }
  console.error('Error:', error);
  res.status(500).json({ error: 'Operation failed' });
}
```

### 2. Zod Validation
```typescript
const validatedData = insertSchema.omit({ uuid: true }).parse(req.body);
// For updates:
const validatedData = insertSchema.partial().parse(req.body);
```

### 3. Response Codes
- `200` - Success (GET, PATCH)
- `201` - Created (POST)
- `204` - No Content (DELETE)
- `400` - Bad Request (validation)
- `404` - Not Found
- `500` - Server Error

## Validation Steps

1. TypeScript compiles without errors
2. All controllers export from index.ts
3. Controllers call services, not repositories
4. Proper HTTP status codes
5. Zod validation on request bodies

## DO NOT
- Call repositories directly - use services
- Skip validation on request bodies
- Return 200 for errors
- Forget to log errors
- Skip the index.ts exports

## Success Criteria
- [ ] 13 controller files created
- [ ] All use Zod validation
- [ ] Proper error handling with status codes
- [ ] index.ts exports all controllers
