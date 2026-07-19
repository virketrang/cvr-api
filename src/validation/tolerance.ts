import type { Account, AnnualReport } from "../modules/annual-reports/annual-report.types.js";
import type { AccountSection } from "./types.js";

/**
 * The rounding unit a filing was prepared in, inferred from the amounts:
 * filings in whole thousands have every amount % 1000 === 0. Used as the
 * absolute floor of every comparison tolerance so t.kr.-rounding never
 * produces false positives.
 */
export function roundingUnit(values: number[]): number {
    const nonZero = values.filter((v) => v !== 0);
    if (nonZero.length === 0) return 1;
    for (const unit of [1_000_000, 1_000]) {
        if (nonZero.every((v) => Math.abs(v) % unit === 0)) return unit;
    }
    return 1;
}

/**
 * All comparisons use tolerance — never exact equality. The tolerance is the
 * larger of the filing's rounding unit and 0,1 % of the compared amounts.
 */
export function withinTolerance(expected: number, actual: number, unit: number): boolean {
    const tol = Math.max(unit, 0.001 * Math.max(Math.abs(expected), Math.abs(actual)));
    return Math.abs(expected - actual) <= tol;
}

/**
 * The rounding unit for one report, computed over every extracted amount in the
 * report. When the XBRL `decimals` attribute is available on a fact it takes
 * precedence over the heuristic (decimals -3 ⇒ unit 1.000): the unit is the
 * larger of the two, so a filing that states its own precision is believed.
 */
export function roundingUnitForReport(report: AnnualReport<Account>): number {
    const sections: AccountSection[] = [
        report.balancesheet as unknown as AccountSection,
        report.incomeStatement as unknown as AccountSection,
        report.notes as unknown as AccountSection,
    ];

    const values: number[] = [];
    let decimalsUnit = 1;

    for (const section of sections) {
        for (const account of Object.values(section)) {
            if (typeof account?.value === "number" && Number.isFinite(account.value)) {
                values.push(account.value);
            }
            const decimals = account?.decimals;
            if (typeof decimals === "number" && decimals < 0 && decimals >= -6) {
                decimalsUnit = Math.max(decimalsUnit, Math.pow(10, -decimals));
            }
        }
    }

    return Math.max(roundingUnit(values), decimalsUnit);
}
