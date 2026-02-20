/**
 * @swagger
 * /api/v2/rest-hours/vessel-records:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get all vessel records
 *     parameters:
 *       - in: query
 *         name: monthValue
 *         schema: { type: string }
 *         description: Month filter (YYYY-MM)
 *       - in: query
 *         name: vesselId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Vessel records list
 *   post:
 *     tags: [Rest Hours]
 *     summary: Create vessel record
 *     responses:
 *       201:
 *         description: Vessel record created
 *
 * /api/v2/rest-hours/vessel-records/{uuid}:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get vessel record by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel record details
 *   patch:
 *     tags: [Rest Hours]
 *     summary: Update vessel record
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel record updated
 *   delete:
 *     tags: [Rest Hours]
 *     summary: Delete vessel record
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel record deleted
 *
 * /api/v2/rest-hours/vessel-records/{uuid}/submit-vessel-review:
 *   post:
 *     tags: [Rest Hours]
 *     summary: Submit vessel review for a vessel record
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel review submitted
 *
 * /api/v2/rest-hours/vessel-records/{uuid}/submit-office-review:
 *   post:
 *     tags: [Rest Hours]
 *     summary: Submit office review for a vessel record
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Office review submitted
 *
 * /api/v2/rest-hours/crew-records:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get all crew records
 *     parameters:
 *       - in: query
 *         name: vesselId
 *         schema: { type: string }
 *       - in: query
 *         name: monthValue
 *         schema: { type: string }
 *       - in: query
 *         name: crewMemberId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Crew records list
 *   post:
 *     tags: [Rest Hours]
 *     summary: Create crew record
 *     responses:
 *       201:
 *         description: Crew record created
 *
 * /api/v2/rest-hours/violations-by-rank:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get violations aggregated by rank
 *     responses:
 *       200:
 *         description: Violations by rank
 *
 * /api/v2/rest-hours/ncs-by-rank:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get non-conformities aggregated by rank
 *     responses:
 *       200:
 *         description: NCs by rank
 *
 * /api/v2/rest-hours/crew-records/{uuid}:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get crew record by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Crew record details
 *   patch:
 *     tags: [Rest Hours]
 *     summary: Update crew record
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Crew record updated
 *   delete:
 *     tags: [Rest Hours]
 *     summary: Delete crew record
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Crew record deleted
 *
 * /api/v2/rest-hours/daily-records:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get all daily records
 *     responses:
 *       200:
 *         description: Daily records list
 *   post:
 *     tags: [Rest Hours]
 *     summary: Create daily record
 *     responses:
 *       201:
 *         description: Daily record created
 *
 * /api/v2/rest-hours/daily-records/by-key/{crewMemberId}/{vesselId}/{monthYear}:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get daily records by composite key
 *     parameters:
 *       - in: path
 *         name: crewMemberId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: vesselId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: monthYear
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Daily records for key
 *
 * /api/v2/rest-hours/daily-records/backfill-violations:
 *   post:
 *     tags: [Rest Hours]
 *     summary: Backfill violation calculations for daily records
 *     responses:
 *       200:
 *         description: Violations backfilled
 *
 * /api/v2/rest-hours/daily-records/resync:
 *   post:
 *     tags: [Rest Hours]
 *     summary: Resync all daily records
 *     responses:
 *       200:
 *         description: Records resynced
 *
 * /api/v2/rest-hours/daily-records/{uuid}:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get daily record by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Daily record details
 *   patch:
 *     tags: [Rest Hours]
 *     summary: Update daily record
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Daily record updated
 *   delete:
 *     tags: [Rest Hours]
 *     summary: Delete daily record
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Daily record deleted
 *
 * /api/v2/rest-hours/vessel-comments:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get all vessel comments
 *     responses:
 *       200:
 *         description: Vessel comments list
 *   post:
 *     tags: [Rest Hours]
 *     summary: Create vessel comment
 *     responses:
 *       201:
 *         description: Vessel comment created
 *
 * /api/v2/rest-hours/vessel-comments/{uuid}:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get vessel comment by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel comment details
 *   patch:
 *     tags: [Rest Hours]
 *     summary: Update vessel comment
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel comment updated
 *   delete:
 *     tags: [Rest Hours]
 *     summary: Delete vessel comment
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel comment deleted
 *
 * /api/v2/rest-hours/office-comments:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get all office comments
 *     responses:
 *       200:
 *         description: Office comments list
 *   post:
 *     tags: [Rest Hours]
 *     summary: Create office comment
 *     responses:
 *       201:
 *         description: Office comment created
 *
 * /api/v2/rest-hours/office-comments/{uuid}:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get office comment by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Office comment details
 *   patch:
 *     tags: [Rest Hours]
 *     summary: Update office comment
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Office comment updated
 *   delete:
 *     tags: [Rest Hours]
 *     summary: Delete office comment
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Office comment deleted
 *
 * /api/v2/rest-hours/nc-reports/all:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get all NC reports (unfiltered)
 *     responses:
 *       200:
 *         description: All NC reports
 *
 * /api/v2/rest-hours/nc-reports:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get NC reports (filtered by crew/vessel/month)
 *     parameters:
 *       - in: query
 *         name: crewMemberId
 *         schema: { type: string }
 *       - in: query
 *         name: vesselId
 *         schema: { type: string }
 *       - in: query
 *         name: monthValue
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Filtered NC reports
 *   post:
 *     tags: [Rest Hours]
 *     summary: Create NC report
 *     responses:
 *       201:
 *         description: NC report created
 *
 * /api/v2/rest-hours/nc-reports/{uuid}:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get NC report by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: NC report details
 *   patch:
 *     tags: [Rest Hours]
 *     summary: Update NC report
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: NC report updated
 *   delete:
 *     tags: [Rest Hours]
 *     summary: Delete NC report
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: NC report deleted
 *
 * /api/v2/rest-hours/fixed-tasks:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get all fixed tasks
 *     responses:
 *       200:
 *         description: Fixed tasks list
 *   post:
 *     tags: [Rest Hours]
 *     summary: Create fixed task
 *     responses:
 *       201:
 *         description: Fixed task created
 *
 * /api/v2/rest-hours/fixed-tasks/by-key/{crewMemberId}/{vesselId}/{monthYear}:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get fixed tasks by composite key
 *     parameters:
 *       - in: path
 *         name: crewMemberId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: vesselId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: monthYear
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Fixed tasks for key
 *
 * /api/v2/rest-hours/fixed-tasks/{uuid}:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get fixed task by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Fixed task details
 *   patch:
 *     tags: [Rest Hours]
 *     summary: Update fixed task
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Fixed task updated
 *   delete:
 *     tags: [Rest Hours]
 *     summary: Delete fixed task
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Fixed task deleted
 *
 * /api/v2/rest-hours/variable-tasks:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get all variable tasks
 *     responses:
 *       200:
 *         description: Variable tasks list
 *   post:
 *     tags: [Rest Hours]
 *     summary: Create variable task
 *     responses:
 *       201:
 *         description: Variable task created
 *
 * /api/v2/rest-hours/variable-tasks/drafts:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get draft variable tasks
 *     responses:
 *       200:
 *         description: Draft variable tasks
 *
 * /api/v2/rest-hours/variable-tasks/{uuid}:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get variable task by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Variable task details
 *   patch:
 *     tags: [Rest Hours]
 *     summary: Update variable task
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Variable task updated
 *   delete:
 *     tags: [Rest Hours]
 *     summary: Delete variable task
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Variable task deleted
 *
 * /api/v2/rest-hours/variable-tasks/{uuid}/publish:
 *   post:
 *     tags: [Rest Hours]
 *     summary: Publish variable task (draft to active)
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Variable task published
 *
 * /api/v2/rest-hours/dateline:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get all dateline adjustments
 *     responses:
 *       200:
 *         description: Dateline adjustments list
 *   post:
 *     tags: [Rest Hours]
 *     summary: Create dateline adjustment
 *     responses:
 *       201:
 *         description: Dateline adjustment created
 *
 * /api/v2/rest-hours/dateline/{uuid}:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get dateline adjustment by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dateline adjustment details
 *   patch:
 *     tags: [Rest Hours]
 *     summary: Update dateline adjustment
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dateline adjustment updated
 *   delete:
 *     tags: [Rest Hours]
 *     summary: Delete dateline adjustment
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dateline adjustment deleted
 *
 * /api/v2/rest-hours/masters/vessels:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get vessels master data for rest hours module
 *     responses:
 *       200:
 *         description: Vessels list
 *
 * /api/v2/rest-hours/masters/crew-members:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get crew members master data for rest hours module
 *     responses:
 *       200:
 *         description: Crew members list
 *
 * /api/v2/rest-hours/masters/crew-count-by-vessel:
 *   get:
 *     tags: [Rest Hours]
 *     summary: Get crew count by vessel
 *     responses:
 *       200:
 *         description: Crew counts per vessel
 */
