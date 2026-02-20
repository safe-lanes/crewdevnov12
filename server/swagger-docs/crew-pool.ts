/**
 * @swagger
 * /api/v2/crew-pool/crew:
 *   get:
 *     tags: [Crew Pool]
 *     summary: List all crew members
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: rankLabel
 *         schema: { type: string }
 *       - in: query
 *         name: vesselUuid
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: includeArchived
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Paginated crew member list
 *   post:
 *     tags: [Crew Pool]
 *     summary: Create a new crew member
 *     responses:
 *       201:
 *         description: Crew member created
 *
 * /api/v2/crew-pool/crew/enriched:
 *   get:
 *     tags: [Crew Pool]
 *     summary: List all crew members with enriched data (current assignment, vessel info)
 *     responses:
 *       200:
 *         description: Enriched crew member list
 *
 * /api/v2/crew-pool/crew/details:
 *   get:
 *     tags: [Crew Pool]
 *     summary: List all crew members with full details
 *     responses:
 *       200:
 *         description: Detailed crew member list
 *
 * /api/v2/crew-pool/crew/with-data:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Create crew member with related data (personal, family, documents)
 *     responses:
 *       201:
 *         description: Crew member and related data created
 *
 * /api/v2/crew-pool/crew/by-emp-no/{empNo}:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get crew member by employee number
 *     parameters:
 *       - in: path
 *         name: empNo
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Crew member details
 *
 * /api/v2/crew-pool/crew/by-emp-no/{empNo}/dashboard:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get crew dashboard by employee number
 *     parameters:
 *       - in: path
 *         name: empNo
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Dashboard summary
 *
 * /api/v2/crew-pool/crew/{crewUuid}:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get crew member by UUID
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Crew member details
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Update crew member
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Crew member updated
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Soft-delete (archive) crew member
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Crew member archived
 *
 * /api/v2/crew-pool/crew/{crewUuid}/profile:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get full crew profile (personal, family, documents, training, etc.)
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Full crew profile
 *
 * /api/v2/crew-pool/crew/{crewUuid}/dashboard:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get crew dashboard summary
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dashboard summary
 *
 * /api/v2/crew-pool/crew/{crewUuid}/protected:
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Update crew member with field-level protection
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Crew member updated (protected fields)
 *
 * /api/v2/crew-pool/crew/{crewUuid}/unarchive:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Restore archived crew member
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Crew member unarchived
 *
 * /api/v2/crew-pool/crew/{crewUuid}/assignments:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get all assignments for crew member
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Assignment list
 *   post:
 *     tags: [Crew Pool]
 *     summary: Create new assignment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Assignment created
 *
 * /api/v2/crew-pool/crew/{crewUuid}/assignments/current:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get current active assignment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Current assignment
 *
 * /api/v2/crew-pool/crew/{crewUuid}/assignments/history:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get assignment history
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Assignment history
 *
 * /api/v2/crew-pool/crew/{crewUuid}/assign:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Assign crew member to vessel
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Crew assigned to vessel
 *
 * /api/v2/crew-pool/crew/{crewUuid}/sign-off:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Sign off crew member from vessel
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Crew signed off
 *
 * /api/v2/crew-pool/crew/{crewUuid}/assignments/{assignUuid}:
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Update assignment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: assignUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Assignment updated
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Delete assignment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: assignUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Assignment deleted
 *
 * /api/v2/crew-pool/vessels/{vesselUuid}/crew:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get all crew assigned to a vessel
 *     parameters:
 *       - in: path
 *         name: vesselUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel crew list
 *
 * /api/v2/crew-pool/crew/{crewUuid}/vessel-types:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get vessel types applied for crew member
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel types list
 *   put:
 *     tags: [Crew Pool]
 *     summary: Sync vessel types for crew member
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel types synced
 *
 * /api/v2/crew-pool/crew/{crewUuid}/personal:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get personal details
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Personal details
 *   put:
 *     tags: [Crew Pool]
 *     summary: Create or update personal details
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Personal details upserted
 *
 * /api/v2/crew-pool/crew/{crewUuid}/address:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get crew address
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Address details
 *   put:
 *     tags: [Crew Pool]
 *     summary: Create or update crew address
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Address upserted
 *
 * /api/v2/crew-pool/crew/{crewUuid}/family:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get family information
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Family info
 *   put:
 *     tags: [Crew Pool]
 *     summary: Create or update family information
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Family info upserted
 *
 * /api/v2/crew-pool/crew/{crewUuid}/children:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get children records
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Children list
 *   post:
 *     tags: [Crew Pool]
 *     summary: Add child record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Child created
 *
 * /api/v2/crew-pool/crew/{crewUuid}/children/{childUuid}:
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Update child record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: childUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Child updated
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Delete child record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: childUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Child deleted
 *
 * /api/v2/crew-pool/crew/{crewUuid}/next-of-kin:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get next of kin details
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Next of kin details
 *   put:
 *     tags: [Crew Pool]
 *     summary: Create or update next of kin
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Next of kin upserted
 *
 * /api/v2/crew-pool/crew/{crewUuid}/documents:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get all documents for crew member
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Documents list
 *   post:
 *     tags: [Crew Pool]
 *     summary: Create document
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Document created
 *
 * /api/v2/crew-pool/crew/{crewUuid}/documents/{docUuid}:
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Update document
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: docUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Document updated
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Delete document
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: docUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Document deleted
 *
 * /api/v2/crew-pool/crew/{crewUuid}/documents/{docUuid}/attachments:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Add attachment to document
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: docUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Attachment added
 *
 * /api/v2/crew-pool/crew/{crewUuid}/documents/{docUuid}/attachments/{attUuid}:
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Remove attachment from document
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: docUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: attUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Attachment removed
 *
 * /api/v2/crew-pool/crew/{crewUuid}/visas:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get all visas
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Visa list
 *   post:
 *     tags: [Crew Pool]
 *     summary: Create visa
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Visa created
 *
 * /api/v2/crew-pool/crew/{crewUuid}/visas/expiring:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get expiring visas
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Expiring visa list
 *
 * /api/v2/crew-pool/crew/{crewUuid}/visas/{visaUuid}:
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Update visa
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: visaUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Visa updated
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Delete visa
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: visaUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Visa deleted
 *
 * /api/v2/crew-pool/crew/{crewUuid}/visas/{visaUuid}/attachments:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Add visa attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: visaUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Attachment added
 *
 * /api/v2/crew-pool/crew/{crewUuid}/visas/{visaUuid}/attachments/{attUuid}:
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Remove visa attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: visaUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: attUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Attachment removed
 *
 * /api/v2/crew-pool/crew/{crewUuid}/education:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get education records
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Education list
 *   post:
 *     tags: [Crew Pool]
 *     summary: Create education record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Education created
 *
 * /api/v2/crew-pool/crew/{crewUuid}/education/{eduUuid}:
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Update education record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: eduUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Education updated
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Delete education record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: eduUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Education deleted
 *
 * /api/v2/crew-pool/crew/{crewUuid}/education/{eduUuid}/attachments:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Add education attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: eduUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Attachment added
 *
 * /api/v2/crew-pool/crew/{crewUuid}/education/{eduUuid}/attachments/{attUuid}:
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Remove education attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: eduUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: attUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Attachment removed
 *
 * /api/v2/crew-pool/crew/{crewUuid}/licenses:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get all licenses
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: License list
 *   post:
 *     tags: [Crew Pool]
 *     summary: Create license
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: License created
 *
 * /api/v2/crew-pool/crew/{crewUuid}/licenses/expiring:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get expiring licenses
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Expiring license list
 *
 * /api/v2/crew-pool/crew/{crewUuid}/licenses/{licUuid}:
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Update license
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: licUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: License updated
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Delete license
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: licUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: License deleted
 *
 * /api/v2/crew-pool/crew/{crewUuid}/licenses/{licUuid}/archive:
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Archive license
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: licUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: License archived
 *
 * /api/v2/crew-pool/crew/{crewUuid}/licenses/{licUuid}/unarchive:
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Unarchive license
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: licUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: License unarchived
 *
 * /api/v2/crew-pool/crew/{crewUuid}/licenses/{licUuid}/attachments:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Add license attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: licUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Attachment added
 *
 * /api/v2/crew-pool/crew/{crewUuid}/licenses/{licUuid}/attachments/{attUuid}:
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Remove license attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: licUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: attUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Attachment removed
 *
 * /api/v2/crew-pool/crew/{crewUuid}/training:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get training records
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Training list
 *   post:
 *     tags: [Crew Pool]
 *     summary: Create training record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Training created
 *
 * /api/v2/crew-pool/crew/{crewUuid}/training/expiring:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get expiring training certifications
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Expiring training list
 *
 * /api/v2/crew-pool/crew/{crewUuid}/training/{trainUuid}:
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Update training record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: trainUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Training updated
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Delete training record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: trainUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Training deleted
 *
 * /api/v2/crew-pool/crew/{crewUuid}/training/{trainUuid}/attachments:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Add training attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: trainUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Attachment added
 *
 * /api/v2/crew-pool/crew/{crewUuid}/training/{trainUuid}/attachments/{attUuid}:
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Remove training attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: trainUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: attUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Attachment removed
 *
 * /api/v2/crew-pool/crew/{crewUuid}/sea-service:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get sea service records
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sea service list
 *   post:
 *     tags: [Crew Pool]
 *     summary: Create sea service record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Sea service created
 *
 * /api/v2/crew-pool/crew/{crewUuid}/sea-service/by-type:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get sea service grouped by vessel type
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sea service by type
 *
 * /api/v2/crew-pool/crew/{crewUuid}/sea-service/experience:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get total sea service experience summary
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Experience summary
 *
 * /api/v2/crew-pool/crew/{crewUuid}/sea-service/{seaUuid}:
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Update sea service record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: seaUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sea service updated
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Delete sea service record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: seaUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sea service deleted
 *
 * /api/v2/crew-pool/crew/{crewUuid}/sea-service/{seaUuid}/attachments:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Add sea service attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: seaUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Attachment added
 *
 * /api/v2/crew-pool/crew/{crewUuid}/sea-service/{seaUuid}/attachments/{attUuid}:
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Remove sea service attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: seaUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: attUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Attachment removed
 *
 * /api/v2/crew-pool/crew/{crewUuid}/medicals:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get medical records
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Medical records list
 *   post:
 *     tags: [Crew Pool]
 *     summary: Create medical record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Medical record created
 *
 * /api/v2/crew-pool/crew/{crewUuid}/medicals/fitness-status:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get crew fitness status
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Fitness status
 *
 * /api/v2/crew-pool/crew/{crewUuid}/medicals/all:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get all medical data (medicals + doctor visits)
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: All medical data
 *
 * /api/v2/crew-pool/crew/{crewUuid}/medicals/{medUuid}:
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Update medical record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: medUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Medical record updated
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Delete medical record
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: medUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Medical record deleted
 *
 * /api/v2/crew-pool/crew/{crewUuid}/medicals/{medUuid}/attachments:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Add medical attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: medUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Attachment added
 *
 * /api/v2/crew-pool/crew/{crewUuid}/medicals/{medUuid}/attachments/{attUuid}:
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Remove medical attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: medUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: attUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Attachment removed
 *
 * /api/v2/crew-pool/crew/{crewUuid}/doctor-visits:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Get doctor visit records
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Doctor visits list
 *   post:
 *     tags: [Crew Pool]
 *     summary: Create doctor visit
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Doctor visit created
 *
 * /api/v2/crew-pool/crew/{crewUuid}/doctor-visits/{visitUuid}:
 *   patch:
 *     tags: [Crew Pool]
 *     summary: Update doctor visit
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: visitUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Doctor visit updated
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Delete doctor visit
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: visitUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Doctor visit deleted
 *
 * /api/v2/crew-pool/crew/{crewUuid}/doctor-visits/{visitUuid}/attachments:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Add doctor visit attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: visitUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Attachment added
 *
 * /api/v2/crew-pool/crew/{crewUuid}/doctor-visits/{visitUuid}/attachments/{attUuid}:
 *   delete:
 *     tags: [Crew Pool]
 *     summary: Remove doctor visit attachment
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: visitUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: attUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Attachment removed
 *
 * /api/v2/crew-pool/transfer/recruitment:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Transfer candidate from recruitment to crew pool
 *     responses:
 *       201:
 *         description: Candidate transferred
 *
 * /api/v2/crew-pool/transfer/recruitment/{recCanUuid}/check-duplicate:
 *   get:
 *     tags: [Crew Pool]
 *     summary: Check for duplicate before recruitment transfer
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Duplicate check result
 *
 * /api/v2/crew-pool/transfer/validate:
 *   post:
 *     tags: [Crew Pool]
 *     summary: Validate transfer data
 *     responses:
 *       200:
 *         description: Validation result
 */
