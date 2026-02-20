/**
 * @swagger
 * /api/v2/admin/forms:
 *   get:
 *     tags: [Admin]
 *     summary: Get all forms
 *     responses:
 *       200:
 *         description: Forms list
 *   post:
 *     tags: [Admin]
 *     summary: Create form
 *     responses:
 *       201:
 *         description: Form created
 *
 * /api/v2/admin/forms/for-rank/{rankLabel}:
 *   get:
 *     tags: [Admin]
 *     summary: Get form assigned to a rank
 *     parameters:
 *       - in: path
 *         name: rankLabel
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Form for rank
 *
 * /api/v2/admin/forms/cleanup-duplicates:
 *   post:
 *     tags: [Admin]
 *     summary: Clean up duplicate form entries
 *     responses:
 *       200:
 *         description: Duplicates cleaned
 *
 * /api/v2/admin/forms/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get form by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Form details
 *   put:
 *     tags: [Admin]
 *     summary: Update form
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Form updated
 *   delete:
 *     tags: [Admin]
 *     summary: Delete form
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Form deleted
 *
 * /api/v2/admin/forms/{id}/versions:
 *   get:
 *     tags: [Admin]
 *     summary: Get form versions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Form versions list
 *   post:
 *     tags: [Admin]
 *     summary: Create form version
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201:
 *         description: Version created
 *
 * /api/v2/admin/form-versions/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get form version by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Form version details
 *   put:
 *     tags: [Admin]
 *     summary: Update form version
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Version updated
 *   delete:
 *     tags: [Admin]
 *     summary: Delete form version
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Version deleted
 *
 * /api/v2/admin/form-versions/{id}/release:
 *   post:
 *     tags: [Admin]
 *     summary: Release form version
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Version released
 *
 * /api/v2/admin/rank-groups:
 *   get:
 *     tags: [Admin]
 *     summary: Get all rank groups
 *     responses:
 *       200:
 *         description: Rank groups list
 *   post:
 *     tags: [Admin]
 *     summary: Create rank group
 *     responses:
 *       201:
 *         description: Rank group created
 *
 * /api/v2/admin/rank-groups/check-assignment:
 *   get:
 *     tags: [Admin]
 *     summary: Check rank-to-group assignment
 *     responses:
 *       200:
 *         description: Assignment check result
 *
 * /api/v2/admin/rank-groups/form/{formId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get rank groups for form
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Rank groups for form
 *
 * /api/v2/admin/rank-groups/form/{formId}/rank-conflicts:
 *   get:
 *     tags: [Admin]
 *     summary: Get rank conflicts for form
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Rank conflicts
 *
 * /api/v2/admin/rank-groups/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get rank group by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Rank group details
 *   put:
 *     tags: [Admin]
 *     summary: Update rank group
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Rank group updated
 *   delete:
 *     tags: [Admin]
 *     summary: Delete rank group
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Rank group deleted
 *
 * /api/v2/admin/rank-groups/{id}/configuration:
 *   put:
 *     tags: [Admin]
 *     summary: Update rank group configuration
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Configuration updated
 *
 * /api/v2/admin/rank-groups/{id}/archive:
 *   post:
 *     tags: [Admin]
 *     summary: Archive rank group
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Rank group archived
 *
 * /api/v2/admin/rank-groups/{id}/unarchive:
 *   post:
 *     tags: [Admin]
 *     summary: Unarchive rank group
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Rank group unarchived
 *
 * /api/v2/admin/available-ranks:
 *   get:
 *     tags: [Admin]
 *     summary: Get all available ranks
 *     responses:
 *       200:
 *         description: Available ranks list
 *   post:
 *     tags: [Admin]
 *     summary: Create available rank
 *     responses:
 *       201:
 *         description: Rank created
 *   delete:
 *     tags: [Admin]
 *     summary: Delete all available ranks
 *     responses:
 *       200:
 *         description: All ranks deleted
 *
 * /api/v2/admin/available-ranks/reorder:
 *   post:
 *     tags: [Admin]
 *     summary: Reorder available ranks
 *     responses:
 *       200:
 *         description: Ranks reordered
 *
 * /api/v2/admin/available-ranks/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update available rank
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Rank updated
 *   delete:
 *     tags: [Admin]
 *     summary: Delete available rank
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Rank deleted
 *
 * /api/v2/admin/promotion-hierarchies:
 *   get:
 *     tags: [Admin]
 *     summary: Get all promotion hierarchies
 *     responses:
 *       200:
 *         description: Promotion hierarchies
 *   post:
 *     tags: [Admin]
 *     summary: Create promotion hierarchy
 *     responses:
 *       201:
 *         description: Hierarchy created
 *
 * /api/v2/admin/promotion-hierarchies/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get promotion hierarchy by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Hierarchy details
 *   patch:
 *     tags: [Admin]
 *     summary: Update promotion hierarchy
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Hierarchy updated
 *   delete:
 *     tags: [Admin]
 *     summary: Delete promotion hierarchy
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Hierarchy deleted
 *
 * /api/v2/admin/training-master:
 *   get:
 *     tags: [Admin]
 *     summary: Get all training master records
 *     responses:
 *       200:
 *         description: Training master list
 *   post:
 *     tags: [Admin]
 *     summary: Create training master record
 *     responses:
 *       201:
 *         description: Training master created
 *
 * /api/v2/admin/training-master/batch:
 *   patch:
 *     tags: [Admin]
 *     summary: Batch update training master records
 *     responses:
 *       200:
 *         description: Batch updated
 *
 * /api/v2/admin/training-master/reorder:
 *   post:
 *     tags: [Admin]
 *     summary: Reorder training master records
 *     responses:
 *       200:
 *         description: Reordered
 *
 * /api/v2/admin/training-master/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get training master by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Training master details
 *   patch:
 *     tags: [Admin]
 *     summary: Update training master
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Training master updated
 *   delete:
 *     tags: [Admin]
 *     summary: Delete training master
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Training master deleted
 *
 * /api/v2/admin/company-training-groups:
 *   get:
 *     tags: [Admin]
 *     summary: Get all company training groups
 *     responses:
 *       200:
 *         description: Training groups list
 *
 * /api/v2/admin/company-training-groups/{code}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update company training group by code
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Training group updated
 *
 * /api/v2/admin/company-trainings:
 *   get:
 *     tags: [Admin]
 *     summary: Get all company trainings
 *     responses:
 *       200:
 *         description: Company trainings list
 *   post:
 *     tags: [Admin]
 *     summary: Create company training
 *     responses:
 *       201:
 *         description: Company training created
 *
 * /api/v2/admin/company-trainings/import:
 *   post:
 *     tags: [Admin]
 *     summary: Import company trainings
 *     responses:
 *       200:
 *         description: Trainings imported
 *
 * /api/v2/admin/company-trainings/reorder:
 *   post:
 *     tags: [Admin]
 *     summary: Reorder company trainings
 *     responses:
 *       200:
 *         description: Trainings reordered
 *
 * /api/v2/admin/company-trainings/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get company training by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Company training details
 *   patch:
 *     tags: [Admin]
 *     summary: Update company training
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Company training updated
 *   delete:
 *     tags: [Admin]
 *     summary: Delete company training
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Company training deleted
 *
 * /api/v2/admin/company-training-requirements:
 *   get:
 *     tags: [Admin]
 *     summary: Get all company training requirements
 *     responses:
 *       200:
 *         description: Requirements list
 *
 * /api/v2/admin/company-training-requirements/batch:
 *   post:
 *     tags: [Admin]
 *     summary: Batch upsert training requirements
 *     responses:
 *       200:
 *         description: Requirements upserted
 *
 * /api/v2/admin/company-ranks:
 *   get:
 *     tags: [Admin]
 *     summary: Get all company ranks
 *     responses:
 *       200:
 *         description: Company ranks list
 *   post:
 *     tags: [Admin]
 *     summary: Save all company ranks
 *     responses:
 *       200:
 *         description: Company ranks saved
 *
 * /api/v2/admin/company-ranks/by-name/{rankName}:
 *   get:
 *     tags: [Admin]
 *     summary: Get company rank by name
 *     parameters:
 *       - in: path
 *         name: rankName
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Company rank details
 *
 * /api/v2/admin/vessel-groups:
 *   get:
 *     tags: [Admin]
 *     summary: Get all vessel groups
 *     responses:
 *       200:
 *         description: Vessel groups list
 *   post:
 *     tags: [Admin]
 *     summary: Create vessel group
 *     responses:
 *       201:
 *         description: Vessel group created
 *
 * /api/v2/admin/vessel-groups/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get vessel group by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vessel group details
 *   patch:
 *     tags: [Admin]
 *     summary: Update vessel group
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vessel group updated
 *   delete:
 *     tags: [Admin]
 *     summary: Delete vessel group
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vessel group deleted
 *
 * /api/v2/admin/vessel-drafts:
 *   get:
 *     tags: [Admin]
 *     summary: Get all vessel drafts
 *     responses:
 *       200:
 *         description: Vessel drafts list
 *   post:
 *     tags: [Admin]
 *     summary: Create vessel draft
 *     responses:
 *       201:
 *         description: Vessel draft created
 *
 * /api/v2/admin/vessel-drafts/upsert:
 *   post:
 *     tags: [Admin]
 *     summary: Upsert vessel draft
 *     responses:
 *       200:
 *         description: Vessel draft upserted
 *
 * /api/v2/admin/vessel-drafts/by-vessel/{vesselId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get vessel draft by vessel ID
 *     parameters:
 *       - in: path
 *         name: vesselId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Vessel draft details
 *
 * /api/v2/admin/vessel-drafts/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get vessel draft by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vessel draft details
 *   patch:
 *     tags: [Admin]
 *     summary: Update vessel draft
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vessel draft updated
 *   delete:
 *     tags: [Admin]
 *     summary: Delete vessel draft
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vessel draft deleted
 *
 * /api/v2/admin/vessel-revisions:
 *   get:
 *     tags: [Admin]
 *     summary: Get all vessel revisions
 *     responses:
 *       200:
 *         description: Vessel revisions list
 *   post:
 *     tags: [Admin]
 *     summary: Create vessel revision
 *     responses:
 *       201:
 *         description: Vessel revision created
 *
 * /api/v2/admin/vessel-revisions/submit:
 *   post:
 *     tags: [Admin]
 *     summary: Submit vessel revision
 *     responses:
 *       200:
 *         description: Revision submitted
 *
 * /api/v2/admin/vessel-revisions/by-vessel/{vesselId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get vessel revisions by vessel ID
 *     parameters:
 *       - in: path
 *         name: vesselId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Vessel revisions
 *
 * /api/v2/admin/vessel-revisions/ranks/{vesselId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get revision ranks for vessel
 *     parameters:
 *       - in: path
 *         name: vesselId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Revision ranks
 *
 * /api/v2/admin/vessel-revisions/next-revision/{vesselId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get next revision number for vessel
 *     parameters:
 *       - in: path
 *         name: vesselId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Next revision number
 *
 * /api/v2/admin/vessel-revisions/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get vessel revision by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Revision details
 *
 * /api/v2/admin/training-matrix-vessel-drafts:
 *   get:
 *     tags: [Admin]
 *     summary: Get all training matrix vessel drafts
 *     responses:
 *       200:
 *         description: Training matrix drafts list
 *   post:
 *     tags: [Admin]
 *     summary: Create training matrix vessel draft
 *     responses:
 *       201:
 *         description: Draft created
 *
 * /api/v2/admin/training-matrix-vessel-drafts/upsert:
 *   post:
 *     tags: [Admin]
 *     summary: Upsert training matrix vessel draft
 *     responses:
 *       200:
 *         description: Draft upserted
 *
 * /api/v2/admin/training-matrix-vessel-drafts/by-vessel/{vesselId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get training matrix draft by vessel
 *     parameters:
 *       - in: path
 *         name: vesselId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Training matrix draft
 *
 * /api/v2/admin/training-matrix-vessel-drafts/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get training matrix draft by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Draft details
 *   patch:
 *     tags: [Admin]
 *     summary: Update training matrix draft
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Draft updated
 *   delete:
 *     tags: [Admin]
 *     summary: Delete training matrix draft
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Draft deleted
 *
 * /api/v2/admin/training-matrix-vessel-revisions:
 *   get:
 *     tags: [Admin]
 *     summary: Get all training matrix vessel revisions
 *     responses:
 *       200:
 *         description: Revisions list
 *   post:
 *     tags: [Admin]
 *     summary: Create training matrix vessel revision
 *     responses:
 *       201:
 *         description: Revision created
 *
 * /api/v2/admin/training-matrix-vessel-revisions/submit:
 *   post:
 *     tags: [Admin]
 *     summary: Submit training matrix revision
 *     responses:
 *       200:
 *         description: Revision submitted
 *
 * /api/v2/admin/training-matrix-vessel-revisions/by-vessel/{vesselId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get training matrix revisions by vessel
 *     parameters:
 *       - in: path
 *         name: vesselId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Training matrix revisions
 *
 * /api/v2/admin/training-matrix-vessel-revisions/next-revision/{vesselId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get next training matrix revision number
 *     parameters:
 *       - in: path
 *         name: vesselId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Next revision number
 *
 * /api/v2/admin/training-matrix-vessel-revisions/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get training matrix revision by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Revision details
 */
