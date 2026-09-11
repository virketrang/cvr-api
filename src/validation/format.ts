const kroneFormat = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

/** "#,##0 kr." in da-DK, e.g. 54135000 → "54.135.000 kr." */
export function formatKr(amount: number): string {
    return `${kroneFormat.format(amount)} kr.`;
}

/** The period string used in findings: "2024-10-01/2025-09-30". */
export function periodOf(report: {
    reportingPeriod: { reportingPeriodStartDate: string; reportingPeriodEndDate: string };
}): string {
    return `${report.reportingPeriod.reportingPeriodStartDate}/${report.reportingPeriod.reportingPeriodEndDate}`;
}
