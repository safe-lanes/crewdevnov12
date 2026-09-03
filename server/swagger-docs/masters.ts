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
 *
 * /api/v2/masters/data:
 *   get:
 *     tags: [Masters - Data]
 *     summary: List all data masters
 *     description: Returns all configurable master data tables (e.g., visa types, travel documents, licenses)
 *     responses:
 *       200:
 *         description: Data masters list
 *   post:
 *     tags: [Masters - Data]
 *     summary: Create a new data master
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Data master created
 *
 * /api/v2/masters/data/{id}:
 *   get:
 *     tags: [Masters - Data]
 *     summary: Get data master by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Data master details
 *   put:
 *     tags: [Masters - Data]
 *     summary: Update data master
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Data master updated
 *   delete:
 *     tags: [Masters - Data]
 *     summary: Delete data master
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Data master deleted
 *
 * /api/v2/masters/data/{id}/entries:
 *   get:
 *     tags: [Masters - Data]
 *     summary: Get all entries for a data master
 *     description: Returns all entries for a specific master table with field transformations applied
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Master ID (e.g., "001" for visa types, "016" for licenses, "018" for travel documents)
 *     responses:
 *       200:
 *         description: Master data entries list
 *   post:
 *     tags: [Masters - Data]
 *     summary: Create a new entry in a data master
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Entry created
 *
 * /api/v2/masters/data-entries/{id}:
 *   get:
 *     tags: [Masters - Data]
 *     summary: Get a single master data entry by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Master data entry details
 *   put:
 *     tags: [Masters - Data]
 *     summary: Update a master data entry
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Entry updated
 *   delete:
 *     tags: [Masters - Data]
 *     summary: Delete a master data entry
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Entry deleted
 *
 * /api/v2/masters/external/{type}:
 *   get:
 *     tags: [Masters - External Sync]
 *     summary: Get cached external master data by type
 *     description: Returns locally cached master data synced from SAIL ERP
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [nationalities, vessels, vesselTypes, additionalGroups, ports, fleetGroups, languages, countries, users]
 *     responses:
 *       200:
 *         description: Cached external master data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                 cached:
 *                   type: boolean
 *                 timestamp:
 *                   type: string
 *
 * /api/v2/masters/external/sync-all:
 *   post:
 *     tags: [Masters - External Sync]
 *     summary: Sync all master data from external API
 *     description: Fetches and syncs all master data types from the server-configured SAIL ERP endpoint. Requires Masters edit permission; the tenant domain comes from authenticated server context.
 *     responses:
 *       200:
 *         description: Sync results for all master types
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: object
 *                 totalSynced:
 *                   type: integer
 *                 source:
 *                   type: string
 *                 timestamp:
 *                   type: string
 */
