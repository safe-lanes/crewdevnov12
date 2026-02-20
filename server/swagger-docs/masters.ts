/**
 * @swagger
 * /api/v2/masters/nationalities:
 *   get:
 *     tags: [Masters]
 *     summary: Get all nationalities
 *     responses:
 *       200:
 *         description: Nationalities list
 *
 * /api/v2/masters/nationalities/{uuid}:
 *   get:
 *     tags: [Masters]
 *     summary: Get nationality by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Nationality details
 *
 * /api/v2/masters/vessels:
 *   get:
 *     tags: [Masters]
 *     summary: Get all vessels (master data)
 *     responses:
 *       200:
 *         description: Vessels list
 *
 * /api/v2/masters/vessels/{uuid}:
 *   get:
 *     tags: [Masters]
 *     summary: Get vessel by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel details
 *
 * /api/v2/masters/vessel-types:
 *   get:
 *     tags: [Masters]
 *     summary: Get all vessel types
 *     responses:
 *       200:
 *         description: Vessel types list
 *
 * /api/v2/masters/vessel-types/{uuid}:
 *   get:
 *     tags: [Masters]
 *     summary: Get vessel type by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vessel type details
 *
 * /api/v2/masters/additional-groups:
 *   get:
 *     tags: [Masters]
 *     summary: Get all additional groups
 *     responses:
 *       200:
 *         description: Additional groups list
 *
 * /api/v2/masters/additional-groups/{uuid}:
 *   get:
 *     tags: [Masters]
 *     summary: Get additional group by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Additional group details
 *
 * /api/v2/masters/ports:
 *   get:
 *     tags: [Masters]
 *     summary: Get all ports
 *     responses:
 *       200:
 *         description: Ports list
 *
 * /api/v2/masters/ports/{uuid}:
 *   get:
 *     tags: [Masters]
 *     summary: Get port by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Port details
 *
 * /api/v2/masters/fleet-groups:
 *   get:
 *     tags: [Masters]
 *     summary: Get all fleet groups
 *     responses:
 *       200:
 *         description: Fleet groups list
 *
 * /api/v2/masters/fleet-groups/{uuid}:
 *   get:
 *     tags: [Masters]
 *     summary: Get fleet group by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Fleet group details
 *
 * /api/v2/masters/languages:
 *   get:
 *     tags: [Masters]
 *     summary: Get all languages
 *     responses:
 *       200:
 *         description: Languages list
 *
 * /api/v2/masters/languages/{uuid}:
 *   get:
 *     tags: [Masters]
 *     summary: Get language by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Language details
 *
 * /api/v2/masters/countries:
 *   get:
 *     tags: [Masters]
 *     summary: Get all countries
 *     responses:
 *       200:
 *         description: Countries list
 *
 * /api/v2/masters/countries/{uuid}:
 *   get:
 *     tags: [Masters]
 *     summary: Get country by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Country details
 *
 * /api/v2/masters/users:
 *   get:
 *     tags: [Masters]
 *     summary: Get all users
 *     responses:
 *       200:
 *         description: Users list
 *
 * /api/v2/masters/users/{uuid}:
 *   get:
 *     tags: [Masters]
 *     summary: Get user by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User details
 *
 * /api/v2/masters/licenses-dce:
 *   get:
 *     tags: [Masters]
 *     summary: Get all DCE licenses
 *     responses:
 *       200:
 *         description: DCE licenses list
 *
 * /api/v2/masters/licenses-dce/{id}:
 *   get:
 *     tags: [Masters]
 *     summary: Get DCE license by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: DCE license details
 *
 * /api/v2/masters/manning-agents:
 *   get:
 *     tags: [Masters]
 *     summary: Get all manning agents
 *     responses:
 *       200:
 *         description: Manning agents list
 *
 * /api/v2/masters/manning-agents/{id}:
 *   get:
 *     tags: [Masters]
 *     summary: Get manning agent by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Manning agent details
 *
 * /api/v2/masters/crew-pools:
 *   get:
 *     tags: [Masters]
 *     summary: Get all crew pools
 *     responses:
 *       200:
 *         description: Crew pools list
 *
 * /api/v2/masters/crew-pools/{id}:
 *   get:
 *     tags: [Masters]
 *     summary: Get crew pool by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Crew pool details
 *
 * /api/v2/masters/appraisal-types:
 *   get:
 *     tags: [Masters]
 *     summary: Get all appraisal types
 *     responses:
 *       200:
 *         description: Appraisal types list
 *
 * /api/v2/masters/appraisal-types/{id}:
 *   get:
 *     tags: [Masters]
 *     summary: Get appraisal type by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Appraisal type details
 */
