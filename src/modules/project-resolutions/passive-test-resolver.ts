import type { Account, AnnualReport } from "../annual-reports/annual-report.types.js";
import { components, getAccountValue, selectAccount } from "./account.js";
import type { TaxonomyIndex } from "./taxonomy-engine.js";
import { NoteCollector, shouldShiftForUnpublishedReport, UNPUBLISHED_REPORT_NOTE } from "./valuation-resolver.js";
import type {
    AccountContainer,
    FinancialIncomeRow,
    PassiveDateOfTransfer,
    PassiveLineItem,
    PassiveYear,
    ResolvedPassiveAssetTest,
    SuccessionMode,
} from "./project-resolution.types.js";

export interface PassiveTestContext {
    mode: SuccessionMode;
    /** 1-based column slot on the passive-test sheet; also the notepad index. */
    passiveSlot: number;
    unpublishedAnnualReport: string;
    taxonomy: TaxonomyIndex;
    financialIncome: Map<string, FinancialIncomeRow>;
    currencyNameOf: (unit: string) => string;
    today: Date;
}

/** The fixed concepts summed as "book value of shares in subsidiaries". */
const SHARES_IN_SUBSIDIARIES_CONCEPTS = [
    "longtermInvestmentsInGroupEnterprises",
    "shorttermInvestmentsInGroupEnterprises",
    "shorttermInvestmentsInAssociates",
    "longtermInvestmentsInAssociates",
    "longtermParticipatingInterests",
    "longtermInvestmentsInJointVentures",
] as const;

/** The fixed concepts summed as "income from subsidiaries". */
const INCOME_FROM_SUBSIDIARIES_CONCEPTS = [
    "incomeFromInvestmentsInGroupEnterprises",
    "otherFinanceIncomeFromGroupEnterprises",
] as const;

/** How many report-years the passive test uses per succession mode. */
export function passiveYearCap(mode: SuccessionMode): number {
    switch (mode) {
        case "DATE_OF_TRANSFER":
        case "ONE_YEAR":
            return 1;
        case "TWO_YEAR":
            return 2;
        default:
            return 3;
    }
}

/**
 * Resolves everything PassiveAssetTest.AutoComplete used to compute for one
 * company column: the transfer-date block, up to three report-years of
 * taxonomy-filtered line items, and the advisory notes.
 */
export function resolvePassiveTest(
    reports: Array<AnnualReport<Account>>,
    ctx: PassiveTestContext,
): ResolvedPassiveAssetTest {
    const notes = new NoteCollector();
    const notepad = `DOSMERSEDDEL_${ctx.passiveSlot}`;
    const years: PassiveYear[] = [];
    let dateOfTransfer: PassiveDateOfTransfer | null = null;

    const cap = passiveYearCap(ctx.mode);
    let slot = 0;

    for (const report of reports) {
        slot += 1;
        if (slot > 3) break;
        if (slot > reports.length) break;
        if (slot > cap) break;

        const { reportingPeriodStartDate: startDate, reportingPeriodEndDate: endDate } = report.reportingPeriod;

        if (slot === 1 && shouldShiftForUnpublishedReport(endDate, ctx.unpublishedAnnualReport, ctx.today)) {
            slot += 1;
            notes.add("PASSIVE_ASSET_TEST", notepad, UNPUBLISHED_REPORT_NOTE);
        }

        const balancesheet = report.balancesheet as unknown as AccountContainer;
        const incomeStatement = report.incomeStatement as unknown as AccountContainer;
        const currencyName = ctx.currencyNameOf(report.unit);
        const exchangeRate = report.unit === "DKK" ? 1 : null;

        // The transfer-date block is only filled when the newest report actually
        // lands in slot 1 — an unpublished-report shift leaves it empty (VBA parity).
        if (slot === 1) {
            if (exchangeRate === null) {
                notes.add("PASSIVE_ASSET_TEST", notepad, "Overdragelsesdato: INDTAST VALUTAKURS", true);
            }
            dateOfTransfer = {
                dateOfValuation: endDate,
                currencyName,
                exchangeRate,
                totalAssets: selectAccount(balancesheet, "assets"),
                assets: assetLineItems("Overdragelsesdato: ", balancesheet, ctx, notes, notepad),
                bookValueOfSharesInSubsidiaries: components(
                    balancesheet,
                    SHARES_IN_SUBSIDIARIES_CONCEPTS,
                    (concept) => ctx.taxonomy.labelOf(concept),
                ),
            };
        }

        if (exchangeRate === null) {
            notes.add("PASSIVE_ASSET_TEST", notepad, `År ${slot}: INDTAST VALUTAKURS`, true);
        }

        const revenue = components(incomeStatement, ["revenue", "otherOperatingIncome"]);
        const hasRevenue =
            getAccountValue(incomeStatement, "revenue") !== 0 ||
            getAccountValue(incomeStatement, "otherOperatingIncome") !== 0;
        if (!hasRevenue) {
            notes.add("PASSIVE_ASSET_TEST", notepad, `År ${slot}: Indsæt nettoomsætningen.`, true);
        }

        years.push({
            slot,
            startDate,
            endDate,
            currencyName,
            exchangeRate,
            totalAssets: selectAccount(balancesheet, "assets"),
            revenue,
            hasRevenue,
            assets: assetLineItems(`År ${slot}: `, balancesheet, ctx, notes, notepad),
            income: incomeLineItems(`År ${slot}: `, incomeStatement, ctx, notes, notepad),
            bookValueOfSharesInSubsidiaries: components(balancesheet, SHARES_IN_SUBSIDIARIES_CONCEPTS, (concept) =>
                ctx.taxonomy.labelOf(concept),
            ),
            incomeFromSubsidiaries: components(incomeStatement, INCOME_FROM_SUBSIDIARIES_CONCEPTS, (concept) =>
                ctx.taxonomy.labelOf(concept),
            ),
        });
    }

    return { notes: notes.list(), dateOfTransfer, years };
}

/**
 * Walks the balance sheet in report order and keeps the taxonomy-approved
 * leaf items, mirroring PassiveAssetTest.InsertAssets: zero and unknown
 * concepts are skipped; a taxonomy note fires even for excluded rows; rows
 * excluded from the test or with a reported descendant are dropped.
 */
function assetLineItems(
    prefix: string,
    balancesheet: AccountContainer,
    ctx: PassiveTestContext,
    notes: NoteCollector,
    notepad: string,
): PassiveLineItem[] {
    const items: PassiveLineItem[] = [];
    for (const concept of Object.keys(balancesheet)) {
        const value = getAccountValue(balancesheet, concept);
        if (value === 0) continue;

        const entry = ctx.taxonomy.entry(concept);
        if (!entry) continue;

        if (entry.passiveNote) {
            notes.add("PASSIVE_ASSET_TEST", notepad, `${prefix}${entry.passiveNote}`, true);
        }
        if (!entry.includeInPassiveTest) continue;
        if (ctx.taxonomy.hasReportedDescendant(concept, balancesheet)) continue;

        items.push({ concept, label: entry.label, category: entry.passiveClassification, value });
    }
    return items;
}

/** The income-statement counterpart, driven by the financial-income taxonomy. */
function incomeLineItems(
    prefix: string,
    incomeStatement: AccountContainer,
    ctx: PassiveTestContext,
    notes: NoteCollector,
    notepad: string,
): PassiveLineItem[] {
    const items: PassiveLineItem[] = [];
    for (const concept of Object.keys(incomeStatement)) {
        const value = getAccountValue(incomeStatement, concept);
        if (value === 0) continue;

        const entry = ctx.financialIncome.get(concept);
        if (!entry) continue;

        if (entry.note) {
            notes.add("PASSIVE_ASSET_TEST", notepad, `${prefix}${entry.note}`, true);
        }
        if (!entry.includeInPassiveTest) continue;

        items.push({ concept, label: entry.label, category: null, value });
    }
    return items;
}
