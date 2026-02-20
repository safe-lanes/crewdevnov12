/**
 * @swagger
 * /api/v2/vessel/list:
 *   get:
 *     tags: [Vessel]
 *     summary: Get all vessels
 *     responses:
 *       200:
 *         description: Vessel list
 *
 * /api/v2/vessel/planning:
 *   get:
 *     tags: [Vessel]
 *     summary: Get all planning records
 *     responses:
 *       200:
 *         description: Planning records list
 *
 * /api/v2/vessel/crew-counts:
 *   get:
 *     tags: [Vessel]
 *     summary: Get crew on-board counts for all vessels
 *     responses:
 *       200:
 *         description: Crew counts
 *
 * /api/v2/vessel/compliance/matrix/{vesselUuid}:
 *   get:
 *     tags: [Vessel]
 *     summary: Get compliance matrix for vessel
 *     parameters:
 *       - in: path
 *         name: vesselUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Compliance matrix
 *
 * /api/v2/vessel/compliance/matrix/{vesselUuid}/simulated:
 *   post:
 *     tags: [Vessel]
 *     summary: Get simulated compliance matrix with proposed crew changes
 *     parameters:
 *       - in: path
 *         name: vesselUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Simulated compliance matrix
 *
 * /api/v2/vessel/training/{vesselUuid}:
 *   get:
 *     tags: [Vessel]
 *     summary: Get vessel crew training data
 *     parameters:
 *       - in: path
 *         name: vesselUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Training matrix data
 *
 * /api/v2/vessel/oil-major-rules:
 *   get:
 *     tags: [Vessel]
 *     summary: Get all oil major compliance rules
 *     responses:
 *       200:
 *         description: Oil major rules list
 *
 * /api/v2/vessel/{vesselUuid}/planning:
 *   get:
 *     tags: [Vessel]
 *     summary: Get planning records for vessel
 *     parameters:
 *       - in: path
 *         name: vesselUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel planning records
 *   post:
 *     tags: [Vessel]
 *     summary: Create planning record for vessel
 *     parameters:
 *       - in: path
 *         name: vesselUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Planning record created
 *
 * /api/v2/vessel/planning/{planUuid}:
 *   get:
 *     tags: [Vessel]
 *     summary: Get planning record by UUID
 *     parameters:
 *       - in: path
 *         name: planUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Planning record details
 *   patch:
 *     tags: [Vessel]
 *     summary: Update planning record
 *     parameters:
 *       - in: path
 *         name: planUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Planning record updated
 *
 * /api/v2/vessel/planning/{planUuid}/archive:
 *   post:
 *     tags: [Vessel]
 *     summary: Archive planning record
 *     parameters:
 *       - in: path
 *         name: planUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Planning record archived
 *
 * /api/v2/vessel/planning/{planUuid}/attachments:
 *   get:
 *     tags: [Vessel]
 *     summary: Get planning attachments
 *     parameters:
 *       - in: path
 *         name: planUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Attachments list
 *   post:
 *     tags: [Vessel]
 *     summary: Add planning attachment
 *     parameters:
 *       - in: path
 *         name: planUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Attachment added
 *
 * /api/v2/vessel/planning/{planUuid}/attachments/{attUuid}:
 *   delete:
 *     tags: [Vessel]
 *     summary: Delete planning attachment
 *     parameters:
 *       - in: path
 *         name: planUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: attUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Attachment deleted
 *
 * /api/v2/vessel/planning/{planUuid}/sign-on:
 *   post:
 *     tags: [Vessel]
 *     summary: Sign on reliever via planning
 *     parameters:
 *       - in: path
 *         name: planUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Reliever signed on
 *
 * /api/v2/vessel/planning/{planUuid}/reliever-status:
 *   patch:
 *     tags: [Vessel]
 *     summary: Update reliever status
 *     parameters:
 *       - in: path
 *         name: planUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Reliever status updated
 *
 * /api/v2/vessel/planning/{planUuid}/sign-off:
 *   post:
 *     tags: [Vessel]
 *     summary: Sign off crew via planning
 *     parameters:
 *       - in: path
 *         name: planUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Crew signed off
 *
 * /api/v2/vessel/officer-matrix/{crewUuid}:
 *   get:
 *     tags: [Vessel]
 *     summary: Get officer matrix data for crew member
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Officer matrix data
 *
 * /api/v2/rotation/crew/by-rank/{rank}:
 *   get:
 *     tags: [Rotation]
 *     summary: Get available crew by rank for rotation
 *     parameters:
 *       - in: path
 *         name: rank
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Available crew list
 *
 * /api/v2/rotation/proposals:
 *   get:
 *     tags: [Rotation]
 *     summary: Get all rotation proposals
 *     responses:
 *       200:
 *         description: Proposals list
 *
 * /api/v2/rotation/drafts:
 *   get:
 *     tags: [Rotation]
 *     summary: Get all rotation drafts
 *     responses:
 *       200:
 *         description: Drafts list
 *   post:
 *     tags: [Rotation]
 *     summary: Create rotation draft
 *     responses:
 *       201:
 *         description: Draft created
 *
 * /api/v2/rotation/drafts/{draftUuid}:
 *   get:
 *     tags: [Rotation]
 *     summary: Get rotation draft by UUID
 *     parameters:
 *       - in: path
 *         name: draftUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Draft details
 *   patch:
 *     tags: [Rotation]
 *     summary: Update rotation draft
 *     parameters:
 *       - in: path
 *         name: draftUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Draft updated
 *   delete:
 *     tags: [Rotation]
 *     summary: Delete rotation draft
 *     parameters:
 *       - in: path
 *         name: draftUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Draft deleted
 *
 * /api/v2/rotation/drafts/{draftUuid}/propose:
 *   post:
 *     tags: [Rotation]
 *     summary: Submit draft as proposal
 *     parameters:
 *       - in: path
 *         name: draftUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Draft proposed
 *
 * /api/v2/rotation/drafts/{draftUuid}/vessels:
 *   post:
 *     tags: [Rotation]
 *     summary: Add vessel to draft
 *     parameters:
 *       - in: path
 *         name: draftUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Vessel added
 *
 * /api/v2/rotation/draft-vessels/{rvUuid}:
 *   delete:
 *     tags: [Rotation]
 *     summary: Remove vessel from draft
 *     parameters:
 *       - in: path
 *         name: rvUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel removed
 *
 * /api/v2/rotation/drafts/{draftUuid}/ranks:
 *   post:
 *     tags: [Rotation]
 *     summary: Add rank to draft
 *     parameters:
 *       - in: path
 *         name: draftUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Rank added
 *
 * /api/v2/rotation/draft-ranks/{rrUuid}:
 *   delete:
 *     tags: [Rotation]
 *     summary: Remove rank from draft
 *     parameters:
 *       - in: path
 *         name: rrUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Rank removed
 *
 * /api/v2/rotation/entries/{entryUuid}:
 *   get:
 *     tags: [Rotation]
 *     summary: Get rotation entry by UUID
 *     parameters:
 *       - in: path
 *         name: entryUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Entry details
 *   patch:
 *     tags: [Rotation]
 *     summary: Update rotation entry
 *     parameters:
 *       - in: path
 *         name: entryUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Entry updated
 *   delete:
 *     tags: [Rotation]
 *     summary: Delete rotation entry
 *     parameters:
 *       - in: path
 *         name: entryUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Entry deleted
 *
 * /api/v2/rotation/entries:
 *   post:
 *     tags: [Rotation]
 *     summary: Create rotation entry
 *     responses:
 *       201:
 *         description: Entry created
 *
 * /api/v2/rotation/entries/{entryUuid}/deploy:
 *   post:
 *     tags: [Rotation]
 *     summary: Deploy rotation entry (assign crew to vessel)
 *     parameters:
 *       - in: path
 *         name: entryUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Entry deployed
 *
 * /api/v2/rotation/entries/{entryUuid}/reject:
 *   post:
 *     tags: [Rotation]
 *     summary: Reject rotation entry
 *     parameters:
 *       - in: path
 *         name: entryUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Entry rejected
 *
 * /api/v2/rotation/due-crew:
 *   get:
 *     tags: [Rotation]
 *     summary: Get crew members due for rotation
 *     responses:
 *       200:
 *         description: Due crew list
 *
 * /api/v2/rotation/archive:
 *   get:
 *     tags: [Rotation]
 *     summary: Get archived rotation entries
 *     responses:
 *       200:
 *         description: Archived entries
 *
 * /api/v2/drugs-alcohol/test-records:
 *   get:
 *     tags: [Drugs & Alcohol]
 *     summary: Get all test records
 *     responses:
 *       200:
 *         description: Test records list
 *   post:
 *     tags: [Drugs & Alcohol]
 *     summary: Create test record
 *     responses:
 *       201:
 *         description: Test record created
 *
 * /api/v2/drugs-alcohol/test-records/vessel/{vesselId}:
 *   get:
 *     tags: [Drugs & Alcohol]
 *     summary: Get test records by vessel
 *     parameters:
 *       - in: path
 *         name: vesselId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Vessel test records
 *
 * /api/v2/drugs-alcohol/test-records/{uuid}:
 *   get:
 *     tags: [Drugs & Alcohol]
 *     summary: Get test record by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Test record details
 *   patch:
 *     tags: [Drugs & Alcohol]
 *     summary: Update test record
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Test record updated
 *   delete:
 *     tags: [Drugs & Alcohol]
 *     summary: Delete test record
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Test record deleted
 *
 * /api/v2/drugs-alcohol/test-records/{uuid}/planned:
 *   patch:
 *     tags: [Drugs & Alcohol]
 *     summary: Update planned fields of test record
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Planned fields updated
 *
 * /api/v2/drugs-alcohol/attachments/{testRecordUuid}:
 *   get:
 *     tags: [Drugs & Alcohol]
 *     summary: Get attachments for test record
 *     parameters:
 *       - in: path
 *         name: testRecordUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Attachments list
 *   post:
 *     tags: [Drugs & Alcohol]
 *     summary: Add attachment to test record
 *     parameters:
 *       - in: path
 *         name: testRecordUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Attachment added
 *
 * /api/v2/drugs-alcohol/attachments/{attUuid}:
 *   delete:
 *     tags: [Drugs & Alcohol]
 *     summary: Delete attachment
 *     parameters:
 *       - in: path
 *         name: attUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Attachment deleted
 *
 * /api/v2/drugs-alcohol/crew/vessel/{vesselUuid}:
 *   get:
 *     tags: [Drugs & Alcohol]
 *     summary: Get onboard crew for vessel (for D&A module)
 *     parameters:
 *       - in: path
 *         name: vesselUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Onboard crew list
 *
 * /api/v2/ports/search:
 *   get:
 *     tags: [Ports]
 *     summary: Search ports by name, country, or code
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search term (min 2 chars)
 *     responses:
 *       200:
 *         description: Matching ports
 *
 * /api/v2/ports/{portUuid}:
 *   get:
 *     tags: [Ports]
 *     summary: Get port by UUID
 *     parameters:
 *       - in: path
 *         name: portUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Port details
 *
 * /api/v2/promotions/criteria-master:
 *   get:
 *     tags: [Promotions]
 *     summary: Get promotion criteria master list
 *     responses:
 *       200:
 *         description: Criteria master
 *
 * /api/v2/promotions/reviews:
 *   get:
 *     tags: [Promotions]
 *     summary: Get all promotion reviews
 *     responses:
 *       200:
 *         description: Reviews list
 *   post:
 *     tags: [Promotions]
 *     summary: Create promotion review
 *     responses:
 *       201:
 *         description: Review created
 *
 * /api/v2/promotions/reviews/by-uuid/{reviewUuid}:
 *   get:
 *     tags: [Promotions]
 *     summary: Get review by UUID
 *     parameters:
 *       - in: path
 *         name: reviewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Review details
 *
 * /api/v2/promotions/reviews/by-id/{id}:
 *   get:
 *     tags: [Promotions]
 *     summary: Get review by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Review details
 *
 * /api/v2/promotions/reviews/crew/{crewMemberId}:
 *   get:
 *     tags: [Promotions]
 *     summary: Get reviews for crew member
 *     parameters:
 *       - in: path
 *         name: crewMemberId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Crew member reviews
 *
 * /api/v2/promotions/reviews/crew/{crewMemberId}/rank/{promotionToRank}:
 *   get:
 *     tags: [Promotions]
 *     summary: Get review for specific crew member and target rank
 *     parameters:
 *       - in: path
 *         name: crewMemberId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: promotionToRank
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review for crew/rank combination
 *
 * /api/v2/promotions/reviews/{reviewUuid}:
 *   patch:
 *     tags: [Promotions]
 *     summary: Update promotion review
 *     parameters:
 *       - in: path
 *         name: reviewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Review updated
 *   delete:
 *     tags: [Promotions]
 *     summary: Delete promotion review
 *     parameters:
 *       - in: path
 *         name: reviewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Review deleted
 *
 * /api/v2/appraisals:
 *   get:
 *     tags: [Appraisals]
 *     summary: Get all appraisals
 *     responses:
 *       200:
 *         description: Appraisals list
 *   post:
 *     tags: [Appraisals]
 *     summary: Create appraisal
 *     responses:
 *       201:
 *         description: Appraisal created
 *
 * /api/v2/appraisals/crew/{crewMemberId}/promotion-recommendations:
 *   get:
 *     tags: [Appraisals]
 *     summary: Get promotion recommendations from appraisals
 *     parameters:
 *       - in: path
 *         name: crewMemberId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Promotion recommendations
 *
 * /api/v2/appraisals/crew/{crewMemberId}:
 *   get:
 *     tags: [Appraisals]
 *     summary: Get appraisals for crew member
 *     parameters:
 *       - in: path
 *         name: crewMemberId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Crew member appraisals
 *
 * /api/v2/appraisals/{id}:
 *   get:
 *     tags: [Appraisals]
 *     summary: Get appraisal by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Appraisal details
 *   put:
 *     tags: [Appraisals]
 *     summary: Update appraisal
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Appraisal updated
 *   delete:
 *     tags: [Appraisals]
 *     summary: Delete appraisal
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Appraisal deleted
 *
 * /api/v2/appraisals/{id}/submit-stage1:
 *   post:
 *     tags: [Appraisals]
 *     summary: Submit appraisal Stage 1
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Stage 1 submitted
 *
 * /api/v2/appraisals/{id}/submit-stage2:
 *   post:
 *     tags: [Appraisals]
 *     summary: Submit appraisal Stage 2
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Stage 2 submitted
 *
 * /api/v2/appraisals/{id}/submit-stage3:
 *   post:
 *     tags: [Appraisals]
 *     summary: Submit appraisal Stage 3 (final)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Stage 3 submitted (complete)
 */
