const danishInteger = new Intl.NumberFormat("da-DK", {
    maximumFractionDigits: 0,
});

/**
 * Formats a number the way the workbook's note texts do (VBA `Format$(v, "#,##0")`
 * on a Danish locale): thousands separated by '.', no decimals. Used so the
 * server-generated Danish note texts match the ones the VBA code produced.
 */
export function formatDanishInteger(value: number): string {
    return danishInteger.format(value);
}
