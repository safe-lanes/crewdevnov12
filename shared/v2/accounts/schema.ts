import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
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

// ============================================
// PAY ELEMENTS (Rate Tables & Rules master library)
// ============================================
export const accPayElementsV2 = pgTable(
  "acc_pay_elements_v2",
  {
    id: serial("id").primaryKey(),
    payElementUuid: text("pay_element_uuid").notNull().unique(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(), // 'earning' | 'deduction' | 'contribution'
    category: text("category").notNull(),
    formula: text("formula").notNull(),
    rounding: text("rounding").notNull().default("none"),
    ceiling: integer("ceiling"),
    floor: integer("floor"),
    effectiveDate: text("effective_date"),
    status: text("status").notNull().default("active"), // 'active' | 'inactive'
    vesselGroups: text("vessel_groups"), // JSON array of vessel group IDs
    reflectInContract: boolean("reflect_in_contract").default(true),
    ...auditColumns,
  },
  (table) => ({
    codeIdx: index("idx_acc_pay_elements_v2_code").on(table.code),
    statusIdx: index("idx_acc_pay_elements_v2_status").on(table.status),
  }),
);

// ============================================
// CONTRACTS (per crew member)
// ============================================
export const accContractsV2 = pgTable(
  "acc_contracts_v2",
  {
    id: serial("id").primaryKey(),
    contractUuid: text("contract_uuid").notNull().unique(),
    crewUuid: text("crew_uuid").notNull(),
    vessel: text("vessel"),
    vesselGroup: text("vessel_group").notNull().default("all-vessels"),
    applicableFrom: text("applicable_from"),
    status: text("status").notNull().default("draft"), // 'draft' | 'active'
    currency: text("currency").notNull().default("USD"),
    modifiedBy: text("modified_by"),
    ...auditColumns,
  },
  (table) => ({
    crewIdx: index("idx_acc_contracts_v2_crew").on(table.crewUuid),
    crewGroupIdx: index("idx_acc_contracts_v2_crew_group").on(
      table.crewUuid,
      table.vesselGroup,
    ),
  }),
);

// ============================================
// CONTRACT PAY ELEMENTS (inherited from master + custom)
// ============================================
export const accContractPayElementsV2 = pgTable(
  "acc_contract_pay_elements_v2",
  {
    id: serial("id").primaryKey(),
    contractPayElementUuid: text("contract_pay_element_uuid")
      .notNull()
      .unique(),
    contractUuid: text("contract_uuid").notNull(),
    payElementUuid: text("pay_element_uuid"), // null for custom elements
    payElementCode: text("pay_element_code").notNull(),
    payElementName: text("pay_element_name").notNull(),
    category: text("category").notNull(),
    type: text("type").notNull(), // 'earning' | 'deduction'
    applicable: boolean("applicable").notNull().default(false),
    formula: text("formula").notNull().default("No Formula"),
    value: text("value"),
    isCustom: boolean("is_custom").notNull().default(false),
    isInherited: boolean("is_inherited").notNull().default(true),
    ...auditColumns,
  },
  (table) => ({
    contractIdx: index("idx_acc_contract_pay_elements_v2_contract").on(
      table.contractUuid,
    ),
  }),
);

// ============================================
// ALLOTMENTS
// ============================================
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
    allotmentType: text("allotment_type").notNull(), // 'percentage' | 'fixed'
    value: integer("value").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    bankName: text("bank_name"),
    accountNumber: text("account_number"),
    priority: integer("priority").notNull().default(1),
    validFrom: text("valid_from"),
    validTo: text("valid_to"),
    status: text("status").notNull().default("active"), // 'active' | 'pending' | 'expired'
    kycComplete: boolean("kyc_complete").notNull().default(false),
    bankVerified: boolean("bank_verified").notNull().default(false),
    ...auditColumns,
  },
  (table) => ({
    crewIdx: index("idx_acc_allotments_v2_crew").on(table.crewUuid),
  }),
);

// ============================================
// CASH ADVANCES
// ============================================
export const accAdvancesV2 = pgTable(
  "acc_advances_v2",
  {
    id: serial("id").primaryKey(),
    advanceUuid: text("advance_uuid").notNull().unique(),
    crewUuid: text("crew_uuid").notNull(),
    crewName: text("crew_name"),
    rank: text("rank"),
    amount: integer("amount").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    reason: text("reason"),
    requestDate: text("request_date"),
    approver: text("approver"),
    status: text("status").notNull().default("pending"), // pending | approved | rejected | disbursed | recovered
    capCheck: boolean("cap_check").notNull().default(true),
    remainingCap: integer("remaining_cap").notNull().default(0),
    recoveryAmount: integer("recovery_amount"),
    ctmReference: text("ctm_reference"),
    ...auditColumns,
  },
  (table) => ({
    crewIdx: index("idx_acc_advances_v2_crew").on(table.crewUuid),
  }),
);

// ============================================
// BOND PURCHASES
// ============================================
export const accBondItemsV2 = pgTable(
  "acc_bond_items_v2",
  {
    id: serial("id").primaryKey(),
    bondItemUuid: text("bond_item_uuid").notNull().unique(),
    crewUuid: text("crew_uuid").notNull(),
    crewName: text("crew_name"),
    itemName: text("item_name").notNull(),
    category: text("category"),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: integer("unit_price").notNull().default(0),
    totalPrice: integer("total_price").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    saleDate: text("sale_date"),
    autoDeduct: boolean("auto_deduct").notNull().default(true),
    deductionAmount: integer("deduction_amount"),
    status: text("status").notNull().default("pending"), // pending | deducted | cancelled
    ...auditColumns,
  },
  (table) => ({
    crewIdx: index("idx_acc_bond_items_v2_crew").on(table.crewUuid),
  }),
);
