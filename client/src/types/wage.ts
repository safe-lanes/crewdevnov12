/**
 * Wage and Payroll Types
 * Purpose: Core types for payroll calculations and pay element management
 */

export type PayElementType = "EARNING" | "DEDUCTION" | "CONTRIBUTION";
export type Basis = "fixed" | "hours" | "days" | "percent";

export interface PayElementLine {
  id: string;
  code: string;             // BASIC, OT_PREM, TAX…
  name: string;             // "Basic Salary"
  type: PayElementType;
  basis: Basis;
  hours?: number;
  days?: number;
  rate?: number;
  multiplier?: number;      // e.g. 1.5
  currency: string;         // e.g. USD
  amount: number;           // computed or manual
  rounding?: "bankers" | "half_up" | "none";
  notes?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isManual?: boolean;       // manual override flag
}

export interface CrewPayrollSnapshot {
  crewId: string;
  name: string;
  rank: string;
  lines: PayElementLine[];
  totals: { earnings: number; deductions: number; net: number };
}

export type PayRunStatus = "draft" | "validated" | "approved" | "paid" | "posted";

export interface PayElement {
  code: string;
  name: string;
  type: PayElementType;
  defaultBasis: Basis;
  defaultRate?: number;
  defaultMultiplier?: number;
  currency: string;
  isActive: boolean;
}