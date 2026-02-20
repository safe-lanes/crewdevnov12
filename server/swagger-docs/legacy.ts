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
