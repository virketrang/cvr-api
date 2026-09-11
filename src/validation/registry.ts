import type { Account, AnnualReport } from "../modules/annual-reports/annual-report.types.js";
import { balanceSheetChecks } from "./checks/balance-sheet.js";
import { crossYearChecks } from "./checks/cross-year.js";
import { incomeStatementChecks } from "./checks/income-statement.js";
import { signAndSourceChecks } from "./checks/signs-and-source.js";
import { roundingUnitForReport } from "./tolerance.js";
import type { Check, ReportContext, ValidationFinding, ValidationSummary } from "./types.js";

/**
 * Every registered check. Individual checks can be disabled via the
 * VALIDATION_DISABLED env var, e.g. VALIDATION_DISABLED="SCL-002,SGN-002".
 */
export const registry: Check[] = [
    ...balanceSheetChecks,
    ...incomeStatementChecks,
    ...crossYearChecks,
    ...signAndSourceChecks,
];

/** Parses "SCL-002, SGN-002" into a set of disabled check ids. */
export function parseDisabledChecks(env: string | undefined): Set<string> {
    return new Set(
        (env ?? "")
            .split(",")
            .map((id) => id.trim().toUpperCase())
            .filter((id) => id.length > 0),
    );
}

/**
 * Runs every enabled check over a company's reports (newest first) and fills
 * each report's `validation` array. Advisory only: figures are never changed,
 * a response is never blocked, and an exception in one check is logged and
 * skipped without affecting the other checks. Cross-year (company-scope)
 * findings land on the NEWEST report's validation with `period` set to the
 * year they concern.
 */
export function runValidation(reports: Array<AnnualReport<Account>>, disabled: Set<string>): void {
    for (const report of reports) {
        report.validation = [];
    }
    if (reports.length === 0) return;

    const runCheck = (check: Check, ctx: ReportContext, target: ValidationFinding[]) => {
        try {
            target.push(...check.run(ctx));
        } catch (error) {
            console.warn(`Valideringskontrol ${check.id} fejlede og blev sprunget over:`, error);
        }
    };

    for (const report of reports) {
        const ctx: ReportContext = { report, allReports: reports, unit: roundingUnitForReport(report) };
        for (const check of registry) {
            if (check.scope !== "report" || disabled.has(check.id)) continue;
            runCheck(check, ctx, report.validation);
        }
    }

    const newest = reports[0];
    const companyCtx: ReportContext = { report: newest, allReports: reports, unit: roundingUnitForReport(newest) };
    for (const check of registry) {
        if (check.scope !== "company" || disabled.has(check.id)) continue;
        runCheck(check, companyCtx, newest.validation);
    }
}

/** Aggregates every report's findings (incl. the cross-year ones on the newest report). */
export function summarize(reports: Array<AnnualReport<Account>>): ValidationSummary {
    const summary: ValidationSummary = { errors: 0, warnings: 0, infos: 0 };
    for (const report of reports) {
        for (const finding of report.validation ?? []) {
            if (finding.severity === "error") summary.errors += 1;
            else if (finding.severity === "warning") summary.warnings += 1;
            else summary.infos += 1;
        }
    }
    return summary;
}
