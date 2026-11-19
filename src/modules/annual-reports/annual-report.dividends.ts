import type { Account, AnnualReport, DividendEquityStatus, DividendInEquity, DividendsInEquity } from "./annual-report.types.js";
import { childContribution, conceptTree } from "../../validation/concept-tree.js";
import { roundingUnitForReport } from "../../validation/tolerance.js";
import { val, type AccountSection } from "../../validation/types.js";
import { formatDanishInteger as formatAmount } from "../../utils/format-number.js";

const PROPOSED = "proposedDividendRecognisedInEquity";
const EXTRAORDINARY = "proposedExtraordinaryDividendRecognisedInEquity";
const PAID_DURING_YEAR = "extraordinaryDividendPaid";
const AFTER_BALANCE_SHEET_DATE = "extraordinaryDividendDistributedAfterEndOfReportingPeriod";

const LABELS = {
    proposedDividend: "Foreslået udbytte indregnet under egenkapitalen",
    extraordinaryDividend: "Ekstraordinært udbytte indregnet under egenkapitalen",
    extraordinaryDividendAfterBalanceSheetDate: "Ekstraordinært udbytte udloddet efter regnskabsårets udløb",
} as const;

/** A dividend is an amount paid out: filers' occasional minus sign is dropped. */
function declared(section: AccountSection, concept: string): number | null {
    const value = val(section, concept);
    return value === undefined || value === 0 ? null : Math.abs(value);
}

/**
 * Whether each dividend line is part of the reported equity, decided by the
 * balance sheet's own arithmetic: equity is the sum of its items, so it adds up
 * either with a dividend line or without it. Without it means the amount has
 * left the company (an extraordinary dividend paid during the year is commonly
 * still tagged on the line). Amounts within the rounding slack, and filings
 * that do not tag the other equity items, leave the question open.
 *
 * When both lines carry the same amount and the equity holds it exactly once,
 * the arithmetic cannot say which line it is — but it need not: the amount is
 * in equity once, and it is counted as the proposed dividend.
 */
function equityMembership(
    balancesheet: AccountSection,
    dividends: Record<string, number | null>,
    unit: number,
): Record<string, DividendEquityStatus> {
    const keys = Object.keys(dividends).filter((key) => dividends[key] !== null);
    const undetermined = Object.fromEntries(keys.map((key) => [key, "undetermined" as DividendEquityStatus]));

    const equity = val(balancesheet, "equity");
    const otherItems = (conceptTree.equity ?? [])
        .filter((child) => child !== PROPOSED && child !== EXTRAORDINARY)
        .map((child) => childContribution(balancesheet, child))
        .filter((contribution) => contribution !== undefined);
    if (equity === undefined || otherItems.length === 0) return undetermined;

    const otherTotal = otherItems.reduce((sum, item) => sum + item.amount, 0);
    const slack = 2 * unit;

    // Every combination of dividend lines that makes the equity add up.
    const reconciling: Array<Set<string>> = [];
    for (let mask = 0; mask < 1 << keys.length; mask++) {
        const included = keys.filter((_, index) => mask & (1 << index));
        const total = otherTotal + included.reduce((sum, key) => sum + (dividends[key] as number), 0);
        if (Math.abs(total - equity) <= slack) reconciling.push(new Set(included));
    }

    const [proposed, extraordinary] = [dividends[PROPOSED], dividends[EXTRAORDINARY]];
    if (proposed != null && extraordinary != null && Math.abs(proposed - extraordinary) <= slack) {
        const sizes = new Set(reconciling.map((combination) => combination.size));
        if (sizes.has(1) && !sizes.has(0) && !sizes.has(2)) return { [PROPOSED]: "inEquity", [EXTRAORDINARY]: "sameAsAnother" };
    }

    return Object.fromEntries(
        keys.map((key) => {
            const withIt = reconciling.some((combination) => combination.has(key));
            const withoutIt = reconciling.some((combination) => !combination.has(key));
            const status: DividendEquityStatus = withIt === withoutIt ? "undetermined" : withIt ? "inEquity" : "notInEquity";
            return [key, status];
        }),
    );
}

/**
 * The company's declared dividends and the part of each that is in the equity
 * on the balance sheet (see DividendsInEquity). `unit` is the filing's rounding
 * unit: 1, 1.000 or 1.000.000.
 *
 *  - The ordinary proposed dividend is by law a separate equity item, so it
 *    counts as in equity unless the balance sheet shows otherwise.
 *  - The extraordinary dividend line most often holds a dividend already paid
 *    during the year, so it counts only when the balance sheet shows it is in
 *    equity.
 *  - A dividend distributed after the balance sheet date had not left equity
 *    on that date. When it is the very amount of one of the two lines above,
 *    it is that dividend and is not counted again.
 */
export function resolveDividendsInEquity(balancesheet: AccountSection, notes: AccountSection, unit: number): DividendsInEquity {
    const proposed = declared(balancesheet, PROPOSED);
    const extraordinary = declared(balancesheet, EXTRAORDINARY);
    const afterBalanceSheetDate = declared(notes, AFTER_BALANCE_SHEET_DATE);
    const paidDuringYear = declared(notes, PAID_DURING_YEAR);

    const membership = equityMembership(balancesheet, { [PROPOSED]: proposed, [EXTRAORDINARY]: extraordinary }, unit);
    const sameAmount = (a: number, b: number) => Math.abs(a - b) <= 2 * unit;

    let proposedDividend: DividendInEquity | null = null;
    if (proposed !== null) {
        const status = membership[PROPOSED];
        proposedDividend = {
            value: status === "notInEquity" ? 0 : proposed,
            reported: proposed,
            status,
            label: LABELS.proposedDividend,
            note:
                status === "notInEquity"
                    ? `Foreslået udbytte på ${formatAmount(proposed)} indgår ifølge balancen ikke i den bogførte egenkapital ` +
                      "(typisk fordi det er indregnet som gæld eller allerede udbetalt) og er ikke medregnet. " +
                      "Er udbyttet i stedet indeholdt i overført resultat, skal det medregnes manuelt."
                    : status === "undetermined"
                      ? `Det kan ikke afgøres af balancen, om foreslået udbytte på ${formatAmount(proposed)} indgår i den bogførte ` +
                        "egenkapital. Beløbet er medregnet; kontrollér egenkapitalens sammensætning i årsrapporten."
                      : null,
        };
    }

    let extraordinaryDividend: DividendInEquity | null = null;
    if (extraordinary !== null) {
        // The statement of changes in equity settles what the balance sheet cannot:
        // the same amount paid out during the year is no longer in equity.
        const paidOut = paidDuringYear !== null && sameAmount(paidDuringYear, extraordinary);
        const status = membership[EXTRAORDINARY] === "undetermined" && paidOut ? "notInEquity" : membership[EXTRAORDINARY];
        extraordinaryDividend = {
            value: status === "inEquity" ? extraordinary : 0,
            reported: extraordinary,
            status,
            label: LABELS.extraordinaryDividend,
            note:
                status === "inEquity"
                    ? `Ekstraordinært udbytte på ${formatAmount(extraordinary)} indgår ifølge balancen i den bogførte egenkapital på balancedagen og er medregnet.`
                    : status === "sameAsAnother"
                      ? `Ekstraordinært udbytte indregnet under egenkapitalen (${formatAmount(extraordinary)}) er samme beløb som det foreslåede ` +
                        "udbytte, og egenkapitalen indeholder beløbet én gang. Det er kun medregnet én gang."
                      : status === "undetermined"
                      ? `Det kan ikke afgøres af balancen, om ekstraordinært udbytte på ${formatAmount(extraordinary)} indgår i den bogførte ` +
                        "egenkapital. Beløbet er ikke medregnet; kontrollér, om udbyttet var udbetalt på balancedagen."
                      : null,
        };
    }

    let extraordinaryDividendAfterBalanceSheetDate: DividendInEquity | null = null;
    if (afterBalanceSheetDate !== null) {
        const counted = [proposedDividend, extraordinaryDividend].find(
            (dividend) => dividend !== null && dividend.value !== 0 && sameAmount(dividend.value, afterBalanceSheetDate),
        );
        extraordinaryDividendAfterBalanceSheetDate = {
            value: counted ? 0 : afterBalanceSheetDate,
            reported: afterBalanceSheetDate,
            status: counted ? "sameAsAnother" : "inEquity",
            label: LABELS.extraordinaryDividendAfterBalanceSheetDate,
            note: counted
                ? `Ekstraordinært udbytte udloddet efter regnskabsårets udløb (${formatAmount(afterBalanceSheetDate)}) er samme beløb som ` +
                  `"${counted.label}" og er kun medregnet én gang.`
                : `Ekstraordinært udbytte på ${formatAmount(afterBalanceSheetDate)} er udloddet efter regnskabsårets udløb. ` +
                  "Det indgår i den bogførte egenkapital på balancedagen og er medregnet.",
        };
    }

    return { proposedDividend, extraordinaryDividend, extraordinaryDividendAfterBalanceSheetDate };
}

/** resolveDividendsInEquity for a report's own (solo) ÅRL statements; null when it has none. */
export function dividendsInEquityOf(report: AnnualReport<Account>): DividendsInEquity | null {
    if (report.soloStandard !== "ÅRL") return null;
    return resolveDividendsInEquity(
        report.balancesheet as unknown as AccountSection,
        report.notes as unknown as AccountSection,
        roundingUnitForReport(report),
    );
}
