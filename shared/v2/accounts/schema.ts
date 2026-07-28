import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ============================================
// Shared audit columns (mirrors shared/v2/rest-hours/schema.ts)
// ============================================
export const auditColumns = {
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

// NOTE ON TYPES
// - Money columns use numeric(14,2); rates numeric(10,4); FX numeric(12,6).
//   In drizzle-orm 0.39 numeric() maps to a TS `string` (pg returns numeric as
//   strings at runtime), so all money/rate fields below are string-typed.
// - Dates use the `date` type (defaults to a TS `string`).
// - Periods are text in `YYYY-MM` format (CHECK constraint enforced in migration).
// - Enum-like fields are `text`; the allowed values are enforced by CHECK
//   constraints in the migration and noted in the inline comments here.

// ============================================================================
// A. TENANT CONFIGURATION
// ============================================================================

// 1. acc_tenant_config_v2 — single-row tenant behaviour configuration.
export const accTenantConfigV2 = pgTable("acc_tenant_config_v2", {
  id: serial("id").primaryKey(),
  configUuid: text("config_uuid").notNull().unique(),
  preparationMode: text("preparation_mode").notNull().default("office_prepares"), // vessel_prepares | office_prepares
  prorationBasis: text("proration_basis").notNull().default("thirty_day_month"), // thirty_day_month | calendar_days
  dayInclusionRule: text("day_inclusion_rule").notNull().default("both_inclusive"), // both_inclusive | exclude_sign_off_day
  functionalCurrency: text("functional_currency").notNull().default("USD"), // ISO 4217
  fxRatePolicy: text("fx_rate_policy").notNull().default("month_end"), // month_end | transaction_date | manual
  employmentModelsEnabled: text("employment_models_enabled").array(), // voyage_contract | annual_employment
  seniorityBasis: text("seniority_basis").notNull().default("rank_service_all_employers"), // rank_service_all_employers | rank_service_company | company_tenure
  allowManualSeniorityAnchor: boolean("allow_manual_seniority_anchor").notNull().default(true),
  autoLockOnApproval: boolean("auto_lock_on_approval").notNull().default(true),
  // 0163: allotment soft cap (% of scale-resolved monthly gross; null = no check)
  maxAllotmentPercent: numeric("max_allotment_percent", {
    precision: 10,
    scale: 4,
  }),
  // 0165: balancing GL account for net wages payable (GL export); null = UNMAPPED
  glWagesPayableCode: text("gl_wages_payable_code"),
  // 0179: configurable extra vessel-entry tab slots (Vessel Portage)
  extraTab1Enabled: boolean("extra_tab_1_enabled").notNull().default(false),
  extraTab1Label: text("extra_tab_1_label"),
  extraTab1PayElementUuid: text("extra_tab_1_pay_element_uuid"),
  extraTab2Enabled: boolean("extra_tab_2_enabled").notNull().default(false),
  extraTab2Label: text("extra_tab_2_label"),
  extraTab2PayElementUuid: text("extra_tab_2_pay_element_uuid"),
  settings: jsonb("settings"),
  ...auditColumns,
});

// ============================================================================
// B. MASTER TIER
// ============================================================================

// 2. acc_pay_elements_v2 (rebuilt) — master pay element library.
export const accPayElementsV2 = pgTable(
  "acc_pay_elements_v2",
  {
    id: serial("id").primaryKey(),
    payElementUuid: text("pay_element_uuid").notNull().unique(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").notNull(), // earning | deduction | employer_contribution
    category: text("category").notNull(), // basic, overtime_fixed, overtime_variable, allowance, bonus, statutory, allotment, advance_recovery, bond_slop_chest, communication, one_off, other
    calcMethod: text("calc_method").notNull(), // scale_lookup | fixed_amount | rate_times_qty | percentage_of_base | manual_entry
    percentageBaseElementUuid: text("percentage_base_element_uuid"), // self-FK; required when calc_method=percentage_of_base (service-layer rule)
    prorate: boolean("prorate").notNull().default(false),
    prorationBasisOverride: text("proration_basis_override"), // thirty_day_month | calendar_days
    roundingRule: text("rounding_rule").notNull().default("nearest"), // nearest | up | down
    roundingPrecision: numeric("rounding_precision", {
      precision: 6,
      scale: 2,
    }).default("0.01"),
    nationalityConditional: boolean("nationality_conditional")
      .notNull()
      .default(false),
    applicableNationalityUuids: text("applicable_nationality_uuids").array(),
    showsOnPayslip: boolean("shows_on_payslip").notNull().default(true),
    showsOnPortage: boolean("shows_on_portage").notNull().default(true),
    status: text("status").notNull().default("active"), // active | inactive
    paymentTiming: text("payment_timing").notNull().default("paid_on_board"), // paid_on_board | payable_at_settlement | remitted_to_fund
    glCode: text("gl_code"), // client GL account code (reporting)
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    ...auditColumns,
  },
  (table) => ({
    codeIdx: index("idx_acc_pay_elements_v2_code").on(table.code),
    statusIdx: index("idx_acc_pay_elements_v2_status").on(table.status),
  }),
);

// 3. acc_wage_scales_v2 — effective-dated wage scale headers.
export const accWageScalesV2 = pgTable(
  "acc_wage_scales_v2",
  {
    id: serial("id").primaryKey(),
    scaleUuid: text("scale_uuid").notNull().unique(),
    scaleName: text("scale_name").notNull(),
    description: text("description"),
    vesselTypeUuid: text("vessel_type_uuid"), // null + vesselGroupUuid null = fleet-wide
    vesselGroupUuid: text("vessel_group_uuid"),
    currency: text("currency").notNull().default("USD"), // ISO 4217
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    status: text("status").notNull().default("draft"), // draft | active | superseded
    supersededByScaleUuid: text("superseded_by_scale_uuid"),
    floorAckByUuid: text("floor_ack_by_uuid"), // who acknowledged CBA-floor violations on activation
    floorAckAt: date("floor_ack_at"),
    floorViolations: jsonb("floor_violations"), // snapshot of acknowledged violations
    ...auditColumns,
  },
  (table) => ({
    statusIdx: index("idx_acc_wage_scales_v2_status").on(table.status),
    scopeIdx: index("idx_acc_wage_scales_v2_scope").on(
      table.vesselTypeUuid,
      table.vesselGroupUuid,
    ),
  }),
);

// 4. acc_wage_scale_lines_v2 — per rank/nationality/experience rate rows.
export const accWageScaleLinesV2 = pgTable(
  "acc_wage_scale_lines_v2",
  {
    id: serial("id").primaryKey(),
    scaleLineUuid: text("scale_line_uuid").notNull().unique(),
    scaleUuid: text("scale_uuid").notNull(),
    rankId: text("rank_id").notNull(), // matches adm_company_ranks_v2.rank_id (stored as text)
    nationalityUuid: text("nationality_uuid"), // null = any
    experienceMinMonths: integer("experience_min_months"),
    experienceMaxMonths: integer("experience_max_months"),
    payElementUuid: text("pay_element_uuid").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    rate: numeric("rate", { precision: 10, scale: 4 }),
    ...auditColumns,
  },
  (table) => ({
    scaleIdx: index("idx_acc_wage_scale_lines_v2_scale").on(table.scaleUuid),
    uniq: uniqueIndex("uq_acc_wage_scale_lines_v2").on(
      table.scaleUuid,
      table.rankId,
      table.nationalityUuid,
      table.experienceMinMonths,
      table.payElementUuid,
    ),
  }),
);

// 5. acc_cba_reference_v2 — reference-only CBA minimums.
export const accCbaReferenceV2 = pgTable("acc_cba_reference_v2", {
  id: serial("id").primaryKey(),
  cbaRefUuid: text("cba_ref_uuid").notNull().unique(),
  cbaName: text("cba_name").notNull(),
  rankId: text("rank_id"),
  payElementUuid: text("pay_element_uuid"),
  category: text("category"),
  minimumAmount: numeric("minimum_amount", { precision: 14, scale: 2 }),
  currency: text("currency").notNull().default("USD"),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  sourceNote: text("source_note"),
  ...auditColumns,
});

// ============================================================================
// C. ENGAGEMENT TIER (ledger spine)
// ============================================================================

// 6. acc_engagements_v2 — the engagement spine (one per voyage/annual employment).
export const accEngagementsV2 = pgTable(
  "acc_engagements_v2",
  {
    id: serial("id").primaryKey(),
    engagementUuid: text("engagement_uuid").notNull().unique(),
    crewUuid: text("crew_uuid").notNull(),
    engagementType: text("engagement_type").notNull(), // voyage_contract | annual_employment
    assignmentUuid: text("assignment_uuid"), // -> crew_assignments.assign_uuid; required for voyage_contract (service-layer rule)
    vesselUuid: text("vessel_uuid"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    // 0181: true when a user set the end date by hand; sync must not
    // overwrite it (differences are reported in the sync attention list).
    endDateManual: boolean("end_date_manual").notNull().default(false),
    wageScaleUuid: text("wage_scale_uuid"),
    rankIdAtStart: text("rank_id_at_start"),
    scaleYearAtStart: integer("scale_year_at_start"), // 1-based seniority step in force at start
    nextStepDate: date("next_step_date"), // due date to advance to the next step
    currency: text("currency").notNull().default("USD"), // ISO 4217
    status: text("status").notNull().default("draft"), // draft | active | completed | settled | cancelled
    notes: text("notes"),
    ...auditColumns,
  },
  (table) => ({
    crewIdx: index("idx_acc_engagements_v2_crew").on(table.crewUuid),
    vesselIdx: index("idx_acc_engagements_v2_vessel").on(table.vesselUuid),
    statusIdx: index("idx_acc_engagements_v2_status").on(table.status),
  }),
);

// 7. acc_engagement_phases_v2 — on_board/on_leave/standby/training phases.
export const accEngagementPhasesV2 = pgTable(
  "acc_engagement_phases_v2",
  {
    id: serial("id").primaryKey(),
    phaseUuid: text("phase_uuid").notNull().unique(),
    engagementUuid: text("engagement_uuid").notNull(),
    phaseType: text("phase_type").notNull(), // on_board | on_leave | standby | training
    fromDate: date("from_date"),
    toDate: date("to_date"),
    vesselUuid: text("vessel_uuid"),
    ...auditColumns,
  },
  (table) => ({
    engagementIdx: index("idx_acc_engagement_phases_v2_engagement").on(
      table.engagementUuid,
    ),
  }),
);

// 8. acc_engagement_pay_elements_v2 — contract-level overrides of scale values.
export const accEngagementPayElementsV2 = pgTable(
  "acc_engagement_pay_elements_v2",
  {
    id: serial("id").primaryKey(),
    epeUuid: text("epe_uuid").notNull().unique(),
    engagementUuid: text("engagement_uuid").notNull(),
    payElementUuid: text("pay_element_uuid").notNull(),
    overrideMode: text("override_mode").notNull(), // replace_scale_value | add_element | suppress_element
    amount: numeric("amount", { precision: 14, scale: 2 }),
    rate: numeric("rate", { precision: 10, scale: 4 }),
    paymentTimingOverride: text("payment_timing_override"), // paid_on_board | payable_at_settlement | remitted_to_fund (per-engagement timing override, e.g. "Pay Leave On Board Y/N")
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    remarks: text("remarks"),
    ...auditColumns,
  },
  (table) => ({
    engagementIdx: index("idx_acc_engagement_pay_elements_v2_engagement").on(
      table.engagementUuid,
    ),
  }),
);

// ============================================================================
// D. TRANSACTION TIER
// ============================================================================

// 9. acc_monthly_transactions_v2 — variable per-period transactions.
export const accMonthlyTransactionsV2 = pgTable(
  "acc_monthly_transactions_v2",
  {
    id: serial("id").primaryKey(),
    txnUuid: text("txn_uuid").notNull().unique(),
    engagementUuid: text("engagement_uuid").notNull(),
    crewUuid: text("crew_uuid").notNull(),
    vesselUuid: text("vessel_uuid"),
    period: text("period").notNull(), // YYYY-MM
    payElementUuid: text("pay_element_uuid").notNull(),
    qty: numeric("qty", { precision: 10, scale: 2 }),
    rate: numeric("rate", { precision: 10, scale: 4 }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    fxRate: numeric("fx_rate", { precision: 12, scale: 6 }),
    origin: text("origin").notNull(), // vessel | office
    status: text("status").notNull().default("draft"), // draft | submitted | accepted | rejected
    sourceType: text("source_type"), // advance | bond | ctm | manual
    sourceUuid: text("source_uuid"),
    remarks: text("remarks"),
    // 0161 vessel submission package
    reviewComment: text("review_comment"), // office comment on reject/return
    ctmLineUuid: text("ctm_line_uuid"), // linked CTM line for on-board cash advances
    // 0179: optional day-level date for dated vessel entries (advances, bond)
    txnDate: date("txn_date"),
    ...auditColumns,
  },
  (table) => ({
    engagementIdx: index("idx_acc_monthly_transactions_v2_engagement").on(
      table.engagementUuid,
    ),
    crewPeriodIdx: index("idx_acc_monthly_transactions_v2_crew_period").on(
      table.crewUuid,
      table.period,
    ),
  }),
);

// 10. acc_advances_v2 (retained/altered) — cash advances.
export const accAdvancesV2 = pgTable(
  "acc_advances_v2",
  {
    id: serial("id").primaryKey(),
    advanceUuid: text("advance_uuid").notNull().unique(),
    crewUuid: text("crew_uuid").notNull(),
    crewName: text("crew_name"),
    rank: text("rank"),
    amount: numeric("amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    currency: text("currency").notNull().default("USD"),
    reason: text("reason"),
    requestDate: date("request_date"),
    approver: text("approver"),
    status: text("status").notNull().default("pending"), // pending | approved | rejected | disbursed | recovered
    capCheck: boolean("cap_check").notNull().default(true),
    // remaining_cap widened INTEGER -> numeric(14,2) in migration 0154
    remainingCap: numeric("remaining_cap", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    recoveryAmount: numeric("recovery_amount", { precision: 14, scale: 2 }),
    ctmReference: text("ctm_reference"),
    // new columns
    engagementUuid: text("engagement_uuid"),
    period: text("period"), // YYYY-MM
    recoveryPayElementUuid: text("recovery_pay_element_uuid"),
    ...auditColumns,
  },
  (table) => ({
    crewIdx: index("idx_acc_advances_v2_crew").on(table.crewUuid),
  }),
);

// 11. acc_bond_items_v2 (retained/altered) — bond / slop chest purchases.
export const accBondItemsV2 = pgTable(
  "acc_bond_items_v2",
  {
    id: serial("id").primaryKey(),
    bondItemUuid: text("bond_item_uuid").notNull().unique(),
    crewUuid: text("crew_uuid").notNull(),
    crewName: text("crew_name"),
    itemName: text("item_name").notNull(),
    category: text("category"),
    // widened integer -> numeric(10,2) in migration 0163
    quantity: numeric("quantity", { precision: 10, scale: 2 })
      .notNull()
      .default("1"),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    totalPrice: numeric("total_price", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    currency: text("currency").notNull().default("USD"),
    saleDate: date("sale_date"),
    autoDeduct: boolean("auto_deduct").notNull().default(true),
    deductionAmount: numeric("deduction_amount", { precision: 14, scale: 2 }),
    status: text("status").notNull().default("pending"), // pending | deducted | cancelled
    // new columns
    engagementUuid: text("engagement_uuid"),
    period: text("period"), // YYYY-MM
    // 0163: link to the rolled-up monthly transaction for the crew-month
    txnUuid: text("txn_uuid"),
    ...auditColumns,
  },
  (table) => ({
    crewIdx: index("idx_acc_bond_items_v2_crew").on(table.crewUuid),
  }),
);

// 12. acc_allotments_v2 (retained/altered) — crew allotments to beneficiaries.
export const accAllotmentsV2 = pgTable(
  "acc_allotments_v2",
  {
    id: serial("id").primaryKey(),
    allotmentUuid: text("allotment_uuid").notNull().unique(),
    crewUuid: text("crew_uuid").notNull(),
    crewName: text("crew_name"),
    rank: text("rank"),
    beneficiaryName: text("beneficiary_name").notNull(),
    relationship: text("relationship"),
    allotmentType: text("allotment_type").notNull(), // percentage | fixed
    value: numeric("value", { precision: 14, scale: 2 }).notNull().default("0"),
    currency: text("currency").notNull().default("USD"),
    bankName: text("bank_name"),
    accountNumber: text("account_number"),
    priority: integer("priority").notNull().default(1),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    status: text("status").notNull().default("active"), // active | suspended | ended (0163)
    kycComplete: boolean("kyc_complete").notNull().default(false),
    bankVerified: boolean("bank_verified").notNull().default(false),
    // new columns
    engagementUuid: text("engagement_uuid"),
    payeeCurrency: text("payee_currency"),
    // 0163: bank detail columns (payee_name -> beneficiary_name,
    // payee_relationship -> relationship, bank_account_number -> account_number)
    ibanSwift: text("iban_swift"),
    bankCountry: text("bank_country"),
    ...auditColumns,
  },
  (table) => ({
    crewIdx: index("idx_acc_allotments_v2_crew").on(table.crewUuid),
  }),
);

// 13. acc_ctm_v2 — cash-to-master per vessel + period.
export const accCtmV2 = pgTable(
  "acc_ctm_v2",
  {
    id: serial("id").primaryKey(),
    ctmUuid: text("ctm_uuid").notNull().unique(),
    vesselUuid: text("vessel_uuid").notNull(),
    period: text("period").notNull(), // YYYY-MM
    openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }),
    receivedAmount: numeric("received_amount", { precision: 14, scale: 2 }),
    closingBalance: numeric("closing_balance", { precision: 14, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    status: text("status").notNull().default("open"), // open | submitted | reconciled | locked
    // 0161 vessel submission package
    submittedByUuid: text("submitted_by_uuid"),
    submittedDate: date("submitted_date"),
    portageUuid: text("portage_uuid"), // link to the vessel-month portage bill
    ...auditColumns,
  },
  (table) => ({
    vesselPeriodIdx: index("idx_acc_ctm_v2_vessel_period").on(
      table.vesselUuid,
      table.period,
    ),
  }),
);

// 14. acc_ctm_lines_v2 — individual cash-to-master movements.
export const accCtmLinesV2 = pgTable(
  "acc_ctm_lines_v2",
  {
    id: serial("id").primaryKey(),
    ctmLineUuid: text("ctm_line_uuid").notNull().unique(),
    ctmUuid: text("ctm_uuid").notNull(),
    lineDate: date("line_date"),
    lineType: text("line_type").notNull(), // cash_advance_to_crew | receipt | expense | adjustment
    crewUuid: text("crew_uuid"),
    advanceUuid: text("advance_uuid"),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    description: text("description"),
    ...auditColumns,
  },
  (table) => ({
    ctmIdx: index("idx_acc_ctm_lines_v2_ctm").on(table.ctmUuid),
  }),
);

// ============================================================================
// E. LEDGER & LIFECYCLE (core)
// ============================================================================

// 15. acc_portage_bills_v2 — per vessel + period portage bill (projection header).
export const accPortageBillsV2 = pgTable(
  "acc_portage_bills_v2",
  {
    id: serial("id").primaryKey(),
    portageUuid: text("portage_uuid").notNull().unique(),
    vesselUuid: text("vessel_uuid").notNull(),
    period: text("period").notNull(), // YYYY-MM
    status: text("status").notNull().default("open"), // open | vessel_draft | submitted | office_review | returned | approved | locked
    preparedMode: text("prepared_mode"), // vessel_prepares | office_prepares (snapshot of tenant config)
    crewCount: integer("crew_count").default(0),
    totalEarnings: numeric("total_earnings", { precision: 14, scale: 2 }),
    totalDeductions: numeric("total_deductions", { precision: 14, scale: 2 }),
    netTotal: numeric("net_total", { precision: 14, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    submittedByUuid: text("submitted_by_uuid"),
    submittedDate: date("submitted_date"),
    lockedByUuid: text("locked_by_uuid"),
    lockedDate: date("locked_date"),
    isLocked: boolean("is_locked").notNull().default(false),
    ...auditColumns,
  },
  (table) => ({
    vesselPeriodUniq: uniqueIndex("uq_acc_portage_bills_v2_vessel_period").on(
      table.vesselUuid,
      table.period,
    ),
    statusIdx: index("idx_acc_portage_bills_v2_status").on(table.status),
  }),
);

// 16. acc_portage_approvals_v2 — approval trail (models promo_approvals_v2).
export const accPortageApprovalsV2 = pgTable(
  "acc_portage_approvals_v2",
  {
    id: serial("id").primaryKey(),
    pbApprovalUuid: text("pb_approval_uuid").notNull().unique(),
    portageUuid: text("portage_uuid").notNull(),
    approverId: text("approver_id"),
    approver: text("approver"), // name snapshot
    status: text("status").notNull().default("Pending"), // Pending | Approved | Rejected
    comments: text("comments"),
    date: date("date"),
    ...auditColumns,
  },
  (table) => ({
    portageIdx: index("idx_acc_portage_approvals_v2_portage").on(
      table.portageUuid,
    ),
  }),
);

// 17. acc_calculation_runs_v2 — audit of every calculation run.
export const accCalculationRunsV2 = pgTable("acc_calculation_runs_v2", {
  id: serial("id").primaryKey(),
  calcRunUuid: text("calc_run_uuid").notNull().unique(),
  portageUuid: text("portage_uuid"),
  engagementUuid: text("engagement_uuid"),
  runType: text("run_type").notNull(), // monthly | settlement | recalculation | adjustment
  runDate: timestamp("run_date"),
  runByUuid: text("run_by_uuid"),
  inputSnapshot: jsonb("input_snapshot"),
  status: text("status").notNull(), // running | completed | failed
  errorDetail: text("error_detail"),
  warnings: jsonb("warnings"), // array of {crewUuid, code, message} (0159)
  ...auditColumns,
});

// 18. acc_wage_ledger_v2 — THE SYSTEM OF RECORD (append-only).
export const accWageLedgerV2 = pgTable(
  "acc_wage_ledger_v2",
  {
    id: serial("id").primaryKey(),
    ledgerUuid: text("ledger_uuid").notNull().unique(),
    calcRunUuid: text("calc_run_uuid").notNull(),
    portageUuid: text("portage_uuid"),
    engagementUuid: text("engagement_uuid").notNull(),
    crewUuid: text("crew_uuid").notNull(),
    vesselUuid: text("vessel_uuid"),
    period: text("period").notNull(), // YYYY-MM
    periodFrom: date("period_from"), // sub-period start
    periodTo: date("period_to"), // sub-period end
    daysBasis: integer("days_basis"),
    daysServed: numeric("days_served", { precision: 6, scale: 2 }),
    rankId: text("rank_id"),
    payElementUuid: text("pay_element_uuid").notNull(),
    elementType: text("element_type"), // earning | deduction | employer_contribution (denormalised)
    elementCode: text("element_code"), // snapshot
    paymentTiming: text("payment_timing"), // paid_on_board | payable_at_settlement | remitted_to_fund (snapshot)
    qty: numeric("qty", { precision: 10, scale: 2 }),
    rate: numeric("rate", { precision: 10, scale: 4 }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(), // always positive; element_type carries the sign
    currency: text("currency").notNull().default("USD"),
    fxRate: numeric("fx_rate", { precision: 12, scale: 6 }),
    amountFunctional: numeric("amount_functional", { precision: 14, scale: 2 }),
    sourceType: text("source_type").notNull(), // scale | engagement_override | monthly_txn | allotment | advance_recovery | bond | adjustment | settlement
    sourceUuid: text("source_uuid"),
    calcSnapshot: jsonb("calc_snapshot"),
    isAdjustment: boolean("is_adjustment").notNull().default(false),
    adjustsLedgerUuid: text("adjusts_ledger_uuid"), // self-FK to the line being adjusted
    ...auditColumns,
  },
  (table) => ({
    crewPeriodIdx: index("idx_acc_wage_ledger_v2_crew_period").on(
      table.crewUuid,
      table.period,
    ),
    portageIdx: index("idx_acc_wage_ledger_v2_portage").on(table.portageUuid),
    engagementIdx: index("idx_acc_wage_ledger_v2_engagement").on(
      table.engagementUuid,
    ),
  }),
);

// 19. acc_settlements_v2 — final settlement per engagement (projection).
export const accSettlementsV2 = pgTable(
  "acc_settlements_v2",
  {
    id: serial("id").primaryKey(),
    settlementUuid: text("settlement_uuid").notNull().unique(),
    engagementUuid: text("engagement_uuid").notNull().unique(), // one settlement per engagement
    crewUuid: text("crew_uuid").notNull(),
    settlementDate: date("settlement_date"),
    period: text("period"), // YYYY-MM
    status: text("status").notNull().default("draft"), // draft | submitted | approved | paid | locked
    grossEarnings: numeric("gross_earnings", { precision: 14, scale: 2 }),
    totalDeductions: numeric("total_deductions", { precision: 14, scale: 2 }),
    netPayable: numeric("net_payable", { precision: 14, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    remarks: text("remarks"),
    // 0159 settlement components. Rationale: the balance service subtracts
    // ONLY balance_paid from the running on-board balance; accruals_paid is
    // consumed against the leave/accrual mini-ledger. Subtracting the whole
    // net_payable would double-count accruals (they never entered the
    // on-board balance) and drive balances negative.
    // net_payable (cached) = balance_paid + accruals_paid
    //                      + adjustments_earnings - adjustments_deductions.
    balancePaid: numeric("balance_paid", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    accrualsPaid: numeric("accruals_paid", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    adjustmentsEarnings: numeric("adjustments_earnings", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    adjustmentsDeductions: numeric("adjustments_deductions", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    paidDate: date("paid_date"),
    paymentReference: text("payment_reference"),
    statementSnapshot: jsonb("statement_snapshot"),
    ...auditColumns,
  },
  (table) => ({
    crewIdx: index("idx_acc_settlements_v2_crew").on(table.crewUuid),
  }),
);

// 20. acc_settlement_approvals_v2 — settlement approval rows (0159),
// mirrors acc_portage_approvals_v2.
export const accSettlementApprovalsV2 = pgTable(
  "acc_settlement_approvals_v2",
  {
    id: serial("id").primaryKey(),
    stApprovalUuid: text("st_approval_uuid").notNull().unique(),
    settlementUuid: text("settlement_uuid").notNull(),
    approverId: text("approver_id"),
    approver: text("approver"), // name snapshot
    status: text("status").notNull().default("Pending"), // Pending | Approved | Rejected
    comments: text("comments"),
    date: date("date"),
    ...auditColumns,
  },
  (table) => ({
    settlementIdx: index("idx_acc_settlement_approvals_v2_settlement").on(
      table.settlementUuid,
    ),
  }),
);

// 21. acc_settlement_adjustments_v2 — settlement-specific one-offs (0159):
// travel wages, final claims, recovery of outstanding advances. Editable
// only while the settlement is draft (service-enforced).
export const accSettlementAdjustmentsV2 = pgTable(
  "acc_settlement_adjustments_v2",
  {
    id: serial("id").primaryKey(),
    adjustmentUuid: text("adjustment_uuid").notNull().unique(),
    settlementUuid: text("settlement_uuid").notNull(),
    payElementUuid: text("pay_element_uuid").notNull(),
    type: text("type").notNull(), // earning | deduction (CHECK in migration)
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    remarks: text("remarks"),
    ...auditColumns,
  },
  (table) => ({
    settlementIdx: index("idx_acc_settlement_adjustments_v2_settlement").on(
      table.settlementUuid,
    ),
  }),
);
