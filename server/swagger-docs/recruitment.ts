/**
 * @swagger
 * /api/v2/recruitment/candidates:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get all recruitment candidates
 *     responses:
 *       200:
 *         description: Candidates list
 *   post:
 *     tags: [Recruitment]
 *     summary: Create recruitment candidate
 *     responses:
 *       201:
 *         description: Candidate created
 *
 * /api/v2/recruitment/candidates/next-file-number:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get next available file number
 *     responses:
 *       200:
 *         description: Next file number
 *
 * /api/v2/recruitment/candidates/{id}:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get candidate by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Candidate details
 *   put:
 *     tags: [Recruitment]
 *     summary: Update candidate by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Candidate updated
 *   delete:
 *     tags: [Recruitment]
 *     summary: Delete candidate by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Candidate deleted
 *
 * /api/v2/recruitment/candidates/by-uuid/{recCanUuid}:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get candidate by UUID
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Candidate details
 *   patch:
 *     tags: [Recruitment]
 *     summary: Update candidate by UUID
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Candidate updated
 *   delete:
 *     tags: [Recruitment]
 *     summary: Delete candidate by UUID
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Candidate deleted
 *
 * /api/v2/recruitment/candidates/{recCanUuid}/vessel-types:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get vessel types applied by candidate
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel types list
 *   post:
 *     tags: [Recruitment]
 *     summary: Add vessel type for candidate
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Vessel type added
 *   put:
 *     tags: [Recruitment]
 *     summary: Replace all vessel types for candidate
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel types replaced
 *
 * /api/v2/recruitment/candidates/{recCanUuid}/vessel-types/{vtUuid}:
 *   delete:
 *     tags: [Recruitment]
 *     summary: Remove vessel type from candidate
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: vtUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel type removed
 *
 * /api/v2/recruitment/candidates/{recCanUuid}/personal:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get candidate personal details
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Personal details
 *   put:
 *     tags: [Recruitment]
 *     summary: Upsert candidate personal details
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Personal details upserted
 *
 * /api/v2/recruitment/candidates/{recCanUuid}/address:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get candidate address
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Address details
 *   put:
 *     tags: [Recruitment]
 *     summary: Upsert candidate address
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Address upserted
 *
 * /api/v2/recruitment/candidates/{recCanUuid}/family:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get candidate family info
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Family info
 *   put:
 *     tags: [Recruitment]
 *     summary: Upsert candidate family info
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Family info upserted
 *
 * /api/v2/recruitment/candidates/{recCanUuid}/next-of-kin:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get candidate next of kin
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Next of kin details
 *   put:
 *     tags: [Recruitment]
 *     summary: Upsert candidate next of kin
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Next of kin upserted
 *
 * /api/v2/recruitment/candidates/{recCanUuid}/children:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get candidate children records
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Children list
 *   post:
 *     tags: [Recruitment]
 *     summary: Add child record
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Child added
 *   put:
 *     tags: [Recruitment]
 *     summary: Replace all children records
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Children replaced
 *
 * /api/v2/recruitment/candidates/{recCanUuid}/documents:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get candidate documents
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Documents list
 *   post:
 *     tags: [Recruitment]
 *     summary: Create candidate document
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Document created
 *
 * /api/v2/recruitment/candidates/{recCanUuid}/screening/b8:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get B8 screening data
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: B8 screening data
 *   put:
 *     tags: [Recruitment]
 *     summary: Upsert B8 screening data
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: B8 screening upserted
 *
 * /api/v2/recruitment/candidates/{recCanUuid}/approvals:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get candidate approvals
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Approvals list
 *   post:
 *     tags: [Recruitment]
 *     summary: Create approval
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Approval created
 *
 * /api/v2/recruitment/candidates/{recCanUuid}/suitability:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get candidate suitability assessment
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Suitability assessment
 *   put:
 *     tags: [Recruitment]
 *     summary: Upsert suitability assessment
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Suitability upserted
 *
 * /api/v2/recruitment/candidates/{recCanUuid}/decision:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get recruitment decision
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Decision details
 *   put:
 *     tags: [Recruitment]
 *     summary: Upsert recruitment decision
 *     parameters:
 *       - in: path
 *         name: recCanUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Decision upserted
 *
 * /api/v2/recruitment/fleet-groups:
 *   get:
 *     tags: [Recruitment]
 *     summary: Get fleet groups for recruitment dropdowns
 *     responses:
 *       200:
 *         description: Fleet groups list
 */
