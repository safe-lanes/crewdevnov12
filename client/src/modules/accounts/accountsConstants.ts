/**
 * Enum option lists and display-label maps for the Accounts admin UI.
 * The allowed values mirror the CHECK constraints in migrations 0153/0154 and
 * the inline comments in `shared/v2/accounts/schema.ts`.
 */

export interface Option {
  value: string;
  label: string;
}

const opt = (value: string, label: string): Option => ({ value, label });

// --- Tenant config ---------------------------------------------------------
export const PREPARATION_MODES: Option[] = [
  opt("office_prepares", "Office prepares"),
  opt("vessel_prepares", "Vessel prepares"),
];

export const PRORATION_BASES: Option[] = [
  opt("thirty_day_month", "30-day month"),
  opt("calendar_days", "Calendar days"),
];

export const FX_RATE_POLICIES: Option[] = [
  opt("month_end", "Month-end rate"),
  opt("transaction_date", "Transaction-date rate"),
  opt("manual", "Manual entry"),
];

export const SENIORITY_BASES: Option[] = [
  opt("rank_service_all_employers", "Rank service (all employers)"),
  opt("rank_service_company", "Rank service (this company)"),
  opt("company_tenure", "Company tenure"),
];

export const EMPLOYMENT_MODELS: Option[] = [
  opt("voyage_contract", "Voyage contract"),
  opt("annual_employment", "Annual employment"),
];

export const CURRENCIES: Option[] = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "PHP",
  "SGD",
  "AED",
  "JPY",
].map((c) => opt(c, c));

// --- Pay elements ----------------------------------------------------------
export const PAY_ELEMENT_TYPES: Option[] = [
  opt("earning", "Earning"),
  opt("deduction", "Deduction"),
  opt("employer_contribution", "Employer contribution"),
];

export const PAY_ELEMENT_CATEGORIES: Option[] = [
  opt("basic", "Basic"),
  opt("overtime_fixed", "Overtime (fixed)"),
  opt("overtime_variable", "Overtime (variable)"),
  opt("allowance", "Allowance"),
  opt("bonus", "Bonus"),
  opt("statutory", "Statutory"),
  opt("allotment", "Allotment"),
  opt("advance_recovery", "Advance recovery"),
  opt("bond_slop_chest", "Bond / slop chest"),
  opt("communication", "Communication"),
  opt("one_off", "One-off"),
  opt("other", "Other"),
];

export const CALC_METHODS: Option[] = [
  opt("scale_lookup", "Scale lookup"),
  opt("fixed_amount", "Fixed amount"),
  opt("rate_times_qty", "Rate x quantity"),
  opt("percentage_of_base", "Percentage of base"),
  opt("manual_entry", "Manual entry"),
];

export const PAYMENT_TIMINGS: Option[] = [
  opt("paid_on_board", "Paid on board"),
  opt("payable_at_settlement", "Payable at settlement"),
  opt("remitted_to_fund", "Remitted to fund"),
];

export const ROUNDING_RULES: Option[] = [
  opt("nearest", "Nearest"),
  opt("up", "Up"),
  opt("down", "Down"),
];

export const PAY_ELEMENT_STATUSES: Option[] = [
  opt("active", "Active"),
  opt("inactive", "Inactive"),
];

/** Look up a human label for an enum value, falling back to the raw value. */
export function labelOf(options: Option[], value: string | null | undefined) {
  if (!value) return "";
  return options.find((o) => o.value === value)?.label ?? value;
}
