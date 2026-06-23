/**
 * @swagger
 * tags:
 *   - name: Accounts
 *     description: Maritime payroll — pay elements, contracts, contract pay elements, allotments, advances, bond items (multi-tenant, audited)
 *
 * /api/v2/accounts/pay-elements:
 *   get:
 *     tags: [Accounts]
 *     summary: List pay elements (Rate Tables & Rules master library)
 *     responses:
 *       200: { description: Pay elements list }
 *   post:
 *     tags: [Accounts]
 *     summary: Create a pay element
 *     responses:
 *       201: { description: Pay element created }
 *
 * /api/v2/accounts/pay-elements/{uuid}:
 *   get:
 *     tags: [Accounts]
 *     summary: Get a pay element by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Pay element details }
 *   put:
 *     tags: [Accounts]
 *     summary: Update a pay element
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Pay element updated }
 *   patch:
 *     tags: [Accounts]
 *     summary: Update a pay element (partial)
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Pay element updated }
 *   delete:
 *     tags: [Accounts]
 *     summary: Soft-delete a pay element
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Pay element deleted }
 *
 * /api/v2/accounts/contract-data/{crewUuid}:
 *   get:
 *     tags: [Accounts]
 *     summary: Get a crew member's contract with inherited earnings/deductions
 *     description: Finds or creates a draft contract for the crew member and vessel group, inheriting reflect-in-contract pay elements.
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: vesselGroup
 *         schema: { type: string }
 *         description: Vessel group filter (defaults to all-vessels)
 *     responses:
 *       200: { description: "{ contractData, earnings, deductions }" }
 *
 * /api/v2/accounts/contracts/{uuid}:
 *   get:
 *     tags: [Accounts]
 *     summary: Get a contract by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Contract details }
 *
 * /api/v2/accounts/contracts/{uuid}/status:
 *   put:
 *     tags: [Accounts]
 *     summary: Update contract status (draft/active)
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Contract updated }
 *
 * /api/v2/accounts/contracts/{uuid}/effective-date:
 *   put:
 *     tags: [Accounts]
 *     summary: Update contract effective date
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Contract updated }
 *
 * /api/v2/accounts/contract-pay-elements:
 *   post:
 *     tags: [Accounts]
 *     summary: Create a custom contract pay element
 *     responses:
 *       201: { description: Contract pay element created }
 *
 * /api/v2/accounts/contract-pay-elements/{uuid}:
 *   put:
 *     tags: [Accounts]
 *     summary: Update a contract pay element (applicability/value)
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Contract pay element updated }
 *   patch:
 *     tags: [Accounts]
 *     summary: Update a contract pay element (partial)
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Contract pay element updated }
 *   delete:
 *     tags: [Accounts]
 *     summary: Delete a custom contract pay element
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Contract pay element deleted }
 *
 * /api/v2/accounts/allotments:
 *   get:
 *     tags: [Accounts]
 *     summary: List allotments
 *     responses:
 *       200: { description: Allotments list }
 *   post:
 *     tags: [Accounts]
 *     summary: Create an allotment
 *     responses:
 *       201: { description: Allotment created }
 *
 * /api/v2/accounts/allotments/crew/{crewUuid}:
 *   get:
 *     tags: [Accounts]
 *     summary: List allotments for a crew member
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Allotments list }
 *
 * /api/v2/accounts/allotments/{uuid}:
 *   get:
 *     tags: [Accounts]
 *     summary: Get an allotment by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Allotment details }
 *   put:
 *     tags: [Accounts]
 *     summary: Update an allotment
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Allotment updated }
 *   patch:
 *     tags: [Accounts]
 *     summary: Update an allotment (partial)
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Allotment updated }
 *   delete:
 *     tags: [Accounts]
 *     summary: Soft-delete an allotment
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Allotment deleted }
 *
 * /api/v2/accounts/advances:
 *   get:
 *     tags: [Accounts]
 *     summary: List advances
 *     responses:
 *       200: { description: Advances list }
 *   post:
 *     tags: [Accounts]
 *     summary: Create an advance
 *     responses:
 *       201: { description: Advance created }
 *
 * /api/v2/accounts/advances/crew/{crewUuid}:
 *   get:
 *     tags: [Accounts]
 *     summary: List advances for a crew member
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Advances list }
 *
 * /api/v2/accounts/advances/{uuid}:
 *   get:
 *     tags: [Accounts]
 *     summary: Get an advance by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Advance details }
 *   put:
 *     tags: [Accounts]
 *     summary: Update an advance
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Advance updated }
 *   patch:
 *     tags: [Accounts]
 *     summary: Update an advance (partial)
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Advance updated }
 *   delete:
 *     tags: [Accounts]
 *     summary: Soft-delete an advance
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Advance deleted }
 *
 * /api/v2/accounts/bond-items:
 *   get:
 *     tags: [Accounts]
 *     summary: List bond (slop chest) items
 *     responses:
 *       200: { description: Bond items list }
 *   post:
 *     tags: [Accounts]
 *     summary: Create a bond item
 *     responses:
 *       201: { description: Bond item created }
 *
 * /api/v2/accounts/bond-items/crew/{crewUuid}:
 *   get:
 *     tags: [Accounts]
 *     summary: List bond items for a crew member
 *     parameters:
 *       - in: path
 *         name: crewUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Bond items list }
 *
 * /api/v2/accounts/bond-items/{uuid}:
 *   get:
 *     tags: [Accounts]
 *     summary: Get a bond item by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Bond item details }
 *   put:
 *     tags: [Accounts]
 *     summary: Update a bond item
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Bond item updated }
 *   patch:
 *     tags: [Accounts]
 *     summary: Update a bond item (partial)
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Bond item updated }
 *   delete:
 *     tags: [Accounts]
 *     summary: Soft-delete a bond item
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Bond item deleted }
 */

/**
 * @openapi
 * /api/v2/accounts/payruns:
 *   get:
 *     tags: [Accounts]
 *     summary: List tenant-scoped pay runs (Payrun Board)
 *     parameters:
 *       - in: query
 *         name: vesselUuid
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, validated, approved, paid, posted] }
 *     responses:
 *       200: { description: Array of pay runs }
 *   post:
 *     tags: [Accounts]
 *     summary: Create a pay run
 *     responses:
 *       201: { description: Pay run created }
 *       400: { description: Invalid pay run data }
 *
 * /api/v2/accounts/payruns/{uuid}:
 *   get:
 *     tags: [Accounts]
 *     summary: Get a pay run by uuid
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Pay run details }
 *       404: { description: Pay run not found }
 *   put:
 *     tags: [Accounts]
 *     summary: Update a pay run
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Pay run updated }
 *   patch:
 *     tags: [Accounts]
 *     summary: Update a pay run (partial)
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Pay run updated }
 *   delete:
 *     tags: [Accounts]
 *     summary: Soft-delete a pay run (and its entries)
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Pay run deleted }
 *
 * /api/v2/accounts/payruns/{uuid}/entries:
 *   get:
 *     tags: [Accounts]
 *     summary: List per-crew entries for a pay run
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of pay run entries }
 *       404: { description: Pay run not found }
 *   put:
 *     tags: [Accounts]
 *     summary: Replace the per-crew entries for a pay run (recomputes totals)
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Saved pay run entries }
 *       400: { description: Invalid pay run entries data }
 *       404: { description: Pay run not found }
 */

/**
 * @openapi
 * /api/v2/accounts/contracts:
 *   get:
 *     tags: [Accounts]
 *     summary: List tenant-scoped contracts
 *     parameters:
 *       - in: query
 *         name: crewUuid
 *         schema: { type: string }
 *       - in: query
 *         name: vesselGroup
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of contracts }
 */

export {};
