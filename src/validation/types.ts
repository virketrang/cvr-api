import type { Account, AnnualReport } from "../modules/annual-reports/annual-report.types.js";

export type Severity = "error" | "warning" | "info";

/**
 * One advisory finding from the automatic validation of an extracted annual
 * report. Findings never change any figures and never block a response — they
 * enrich it, so the spreadsheet can show them as checklist notes.
 */
export interface ValidationFinding {
    /** Stable check id, e.g. "BAL-001". */
    id: string;
    severity: Severity;
    /** Danish, user-facing — shown 1:1 in the spreadsheet. */
    message: string;
    expected?: number;
    actual?: number;
    /** actual - expected */
    deviation?: number;
    /** The XBRL concepts involved. */
    concepts?: string[];
    /** "2024-10-01/2025-09-30" — always set for period-specific findings. */
    period?: string;
}

export interface ValidationSummary {
    errors: number;
    warnings: number;
    infos: number;
}

/**
 * The context a check runs in. Report-scope checks run once per report;
 * company-scope checks run once per company with `report` set to the newest
 * report (their findings carry `period` to say which year they concern).
 */
export interface ReportContext {
    report: AnnualReport<Account>;
    /** The company's full report list, newest first. */
    allReports: Array<AnnualReport<Account>>;
    /** The report's rounding unit (1, 1.000 or 1.000.000 kr.) — see tolerance.ts. */
    unit: number;
}

export interface Check {
    id: string;
    scope: "report" | "company";
    run(ctx: ReportContext): ValidationFinding[];
}

/**
 * At runtime every account may also carry the XBRL `decimals` attribute (the
 * extraction includes it even though the public Account type does not declare
 * it), and `value` can be null for facts without a numeric value.
 */
export type LooseAccount = {
    value: number | null;
    unit: string | null;
    label: string;
    decimals?: number | null;
};

/** A statement as validation sees it: only the reported concepts are present. */
export type AccountSection = Partial<Record<string, LooseAccount>>;

/**
 * Numeric value of a reported concept, or undefined when the concept is absent
 * or carries no numeric value. A check may only fire when the concepts it needs
 * are actually reported — a missing concept is never in itself an error.
 */
export function val(section: AccountSection | undefined | null, concept: string): number | undefined {
    const fact = section?.[concept];
    return typeof fact?.value === "number" && Number.isFinite(fact.value) ? fact.value : undefined;
}

export function present(section: AccountSection | undefined | null, concept: string): boolean {
    return val(section, concept) !== undefined;
}
