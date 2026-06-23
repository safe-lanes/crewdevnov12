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
 */
