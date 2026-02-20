/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: System health check
 *     description: Returns database connectivity status
 *     responses:
 *       200:
 *         description: Health status
 *
 * /api/crew-members:
 *   get:
 *     tags: ["[LEGACY] Crew Members"]
 *     summary: List all crew members
 *     deprecated: true
 *     description: "[LEGACY] Used by accounts module. Migrate to /api/v2/crew-pool/crew"
 *     responses:
 *       200:
 *         description: Crew members list
 *
 * /api/masters:
 *   get:
 *     tags: ["[LEGACY] Masters"]
 *     summary: Get all masters
 *     deprecated: true
 *     description: "[LEGACY] Generic master data management"
 *     responses:
 *       200:
 *         description: Masters list
 *   post:
 *     tags: ["[LEGACY] Masters"]
 *     summary: Create master
 *     deprecated: true
 *     description: "[LEGACY] Generic master data management"
 *     responses:
 *       201:
 *         description: Master created
 *
 * /api/masters/{id}:
 *   get:
 *     tags: ["[LEGACY] Masters"]
 *     summary: Get master by ID
 *     deprecated: true
 *     description: "[LEGACY] Generic master data management"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Master details
 *   put:
 *     tags: ["[LEGACY] Masters"]
 *     summary: Update master
 *     deprecated: true
 *     description: "[LEGACY] Generic master data management"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Master updated
 *   delete:
 *     tags: ["[LEGACY] Masters"]
 *     summary: Delete master
 *     deprecated: true
 *     description: "[LEGACY] Generic master data management"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Master deleted
 *
 * /api/masters/{id}/data:
 *   get:
 *     tags: ["[LEGACY] Masters"]
 *     summary: Get master data entries
 *     deprecated: true
 *     description: "[LEGACY] Get all data entries for a master"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Master data entries
 *   post:
 *     tags: ["[LEGACY] Masters"]
 *     summary: Create master data entry
 *     deprecated: true
 *     description: "[LEGACY] Add data entry to a master"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201:
 *         description: Data entry created
 *
 * /api/master-data/{id}:
 *   get:
 *     tags: ["[LEGACY] Masters"]
 *     summary: Get master data entry by ID
 *     deprecated: true
 *     description: "[LEGACY] Get specific master data entry"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Data entry details
 *   put:
 *     tags: ["[LEGACY] Masters"]
 *     summary: Update master data entry
 *     deprecated: true
 *     description: "[LEGACY] Update specific master data entry"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Data entry updated
 *   delete:
 *     tags: ["[LEGACY] Masters"]
 *     summary: Delete master data entry
 *     deprecated: true
 *     description: "[LEGACY] Delete specific master data entry"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Data entry deleted
 *
 * /api/master-data/external/{type}:
 *   get:
 *     tags: ["[LEGACY] Masters"]
 *     summary: Get external master data by type
 *     deprecated: true
 *     description: "[LEGACY] Get external master data (from SAIL ERP)"
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: External master data
 *
 * /api/master-data/external/sync-all:
 *   post:
 *     tags: ["[LEGACY] Masters"]
 *     summary: Sync all external master data
 *     deprecated: true
 *     description: "[LEGACY] Sync master data from external sources (SAIL ERP)"
 *     responses:
 *       200:
 *         description: Sync complete
 *
 * /api/pay-elements:
 *   get:
 *     tags: ["[LEGACY] Pay Elements"]
 *     summary: Get all pay elements
 *     deprecated: true
 *     description: "[LEGACY] Payroll element management"
 *     responses:
 *       200:
 *         description: Pay elements list
 *   post:
 *     tags: ["[LEGACY] Pay Elements"]
 *     summary: Create pay element
 *     deprecated: true
 *     description: "[LEGACY] Payroll element management"
 *     responses:
 *       201:
 *         description: Pay element created
 *
 * /api/pay-elements/{id}:
 *   put:
 *     tags: ["[LEGACY] Pay Elements"]
 *     summary: Update pay element
 *     deprecated: true
 *     description: "[LEGACY] Payroll element management"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pay element updated
 *
 * /api/contract-pay-elements/{id}:
 *   put:
 *     tags: ["[LEGACY] Pay Elements"]
 *     summary: Update contract pay element
 *     deprecated: true
 *     description: "[LEGACY] Contract payroll element management"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Contract pay element updated
 *
 * /api/contract-pay-elements:
 *   post:
 *     tags: ["[LEGACY] Pay Elements"]
 *     summary: Create contract pay element
 *     deprecated: true
 *     description: "[LEGACY] Contract payroll element management"
 *     responses:
 *       201:
 *         description: Contract pay element created
 */
