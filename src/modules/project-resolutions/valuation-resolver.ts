import type { Account, AnnualReport } from "../annual-reports/annual-report.types.js";
import { components, getAccount, selectAccount, selectWithFallback } from "./account.js";
import type { TaxonomyIndex } from "./taxonomy-engine.js";
import { formatDanishInteger } from "../../utils/format-number.js";
import type {
    AccountContainer,
    AccountValue,
    AdjustedEquity,
    CapitalisedEarnings,
    GroupCompany,
    ResolvedNote,
    ResolvedProperty,
    ResolvedValuation,
    SuccessionMode,
    ValuationYear,
} from "./project-resolution.types.js";

/** Context shared by the valuation and passive-test resolvers. */
export interface ResolutionContext {
    mode: SuccessionMode;
    isParent: boolean;
    /** 1-based position in the corporate group. */
    companyIndex: number;
    /** "GØR PLADS" leaves year slot 1 open for an unpublished annual report. */
    unpublishedAnnualReport: string;
    group: GroupCompany[];
    taxonomy: TaxonomyIndex;
    currencyNameOf: (unit: string) => string;
    /** Injectable clock so the unpublished-report shift is testable. */
    today: Date;
}

export const UNPUBLISHED_REPORT_NOTE =
    "Selskabet har endnu ikke offentliggjort årsrapporten for sit seneste afsluttede regnskabsår. " +
    "Bed klienten om at fremsende seneste årsregnskab og indtast herefter oplysningerne i arket.";

/** The curated finance concepts split into income/expense by the sign of their value. */
const FINANCE_INCOME_SOURCE = [
    "incomeFromInvestmentsInGroupEnterprises",
    "incomeFromInvestmentsInAssociates",
    "incomeFromInvestmentsInParticipatingInterests",
    "incomeFromInvestmentsInJointVentures",
    "incomeFromOtherLongtermInvestmentsAndReceivables",
    "otherFinanceIncomeFromGroupEnterprises",
    "otherFinanceIncome",
    "impairmentOfFinancialAssets",
] as const;

const FINANCE_EXPENSE_SOURCE = [
    "otherFinanceExpenses",
    "financeExpensesArisingFromGroupEnterprises",
    "restOfOtherFinanceExpenses",
] as const;

/** How many annual reports fit on a valuation sheet per succession mode. */
export function valuationYearCap(mode: SuccessionMode): number {
    switch (mode) {
        case "TWO_YEAR":
            return 6;
        case "THREE_YEAR":
            return 7;
        default:
            return 5;
    }
}

/**
 * Whether year slot 1 must be left open because the newest available report is
 * older than one year and the user asked to make room ("GØR PLADS").
 */
export function shouldShiftForUnpublishedReport(
    newestReportEndDate: string,
    unpublishedAnnualReport: string,
    today: Date,
): boolean {
    if (unpublishedAnnualReport !== "GØR PLADS") return false;
    const endDate = new Date(newestReportEndDate);
    if (Number.isNaN(endDate.getTime())) return false;
    const oneYearLater = new Date(endDate);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    return today.getTime() > oneYearLater.getTime();
}

/**
 * Resolves everything Valuation.AutoComplete used to compute for one company:
 * per-year adjusted-equity and capitalised-earnings inputs, the investment-
 * property block, and every advisory note — leaving only the writing of those
 * values into named ranges to the workbook.
 */
export function resolveValuation(
    reports: Array<AnnualReport<Account>>,
    ctx: ResolutionContext,
): ResolvedValuation & { unpublishedShift: boolean } {
    const notes = new NoteCollector();
    const years: ValuationYear[] = [];
    let property: ResolvedProperty | null = null;
    let unpublishedShift = false;

    const cap = valuationYearCap(ctx.mode);
    let slot = 0;

    for (const report of reports) {
        slot += 1;
        // Faithful to the VBA loop: after a shift the slot counter runs one ahead
        // of the report counter, so the oldest report falls off this check.
        if (slot > reports.length) break;
        if (slot > cap) break;

        const { reportingPeriodStartDate: startDate, reportingPeriodEndDate: endDate } = report.reportingPeriod;

        if (slot === 1 && shouldShiftForUnpublishedReport(endDate, ctx.unpublishedAnnualReport, ctx.today)) {
            slot += 1;
            unpublishedShift = true;
            notes.add("VALUATION", "DOSMERSEDDEL", UNPUBLISHED_REPORT_NOTE);
        }

        const balancesheet = report.balancesheet as unknown as AccountContainer;
        const incomeStatement = report.incomeStatement as unknown as AccountContainer;
        const reportNotes = report.notes as unknown as AccountContainer;

        const fairValueProperty = getAccount(balancesheet, "investmentProperty") ?? 0;

        let adjustedEquity: AdjustedEquity | null = null;
        if (includeAdjustedEquity(ctx.mode, slot)) {
            const result = resolveAdjustedEquity(balancesheet, slot, fairValueProperty, ctx, notes);
            adjustedEquity = result.adjustedEquity;
            if (result.property) property = result.property;
            // The property row only becomes visible when the block was created for
            // slot 1; without it, the VBA wrote the year valuation into a hidden
            // row, so it never surfaced — hence the `property &&` here.
            if (fairValueProperty !== 0 && property) {
                property.valuationsBySlot[String(slot)] = fairValueProperty;
            }
        }

        if (report.unit !== "DKK") {
            // Quirk kept from the VBA original: the "enter an exchange rate" note for
            // a valuation year is written to the PASSIVE-TEST sheet's notepad indexed
            // by the company's group position.
            notes.add("PASSIVE_ASSET_TEST", `DOSMERSEDDEL_${ctx.companyIndex}`, "INDTAST VALUTAKURS", true);
        }

        let capitalisedEarnings: CapitalisedEarnings | null = null;
        if (fairValueProperty !== 0) {
            notes.add(
                "VALUATION",
                "DOSMERSEDDEL",
                `${notePrefix(slot)}Der er ikke lavet en merindtjeningsberegning, da selskabets ejendomme indgår til dagsværdi i seneste årsregnskab.`,
            );
        } else {
            capitalisedEarnings = resolveCapitalisedEarnings(
                balancesheet,
                incomeStatement,
                reportNotes,
                slot,
                startDate,
                endDate,
                ctx,
                notes,
            );
        }

        years.push({
            slot,
            startDate,
            endDate,
            currencyName: ctx.currencyNameOf(report.unit),
            exchangeRate: report.unit === "DKK" ? 1 : null,
            adjustedEquity,
            capitalisedEarnings,
        });
    }

    return { notes: notes.list(), property, years, unpublishedShift };
}

function includeAdjustedEquity(mode: SuccessionMode, slot: number): boolean {
    if (slot === 1) return true;
    if ((mode === "TWO_YEAR" || mode === "THREE_YEAR") && slot <= 2) return true;
    if (mode === "THREE_YEAR" && slot <= 3) return true;
    return false;
}

function resolveAdjustedEquity(
    balancesheet: AccountContainer,
    slot: number,
    fairValueProperty: number,
    ctx: ResolutionContext,
    notes: NoteCollector,
): { adjustedEquity: AdjustedEquity; property: ResolvedProperty | null } {
    const landAndBuildings = getAccount(balancesheet, "landAndBuildings");
    const land = getAccount(balancesheet, "land");
    const buildings = getAccount(balancesheet, "buildings");
    const participatingInterests = getAccount(balancesheet, "longtermParticipatingInterests");

    const ordinaryProperty = landAndBuildings !== undefined ? landAndBuildings : (land ?? 0) + (buildings ?? 0);
    const totalPropertyBookValue = ordinaryProperty + fairValueProperty;

    let property: ResolvedProperty | null = null;
    if (slot === 1 && fairValueProperty !== 0) {
        property = emptyPropertyBlock();
    }

    const equity = insertAccount(balancesheet, "equity", notes, {
        note: "Den bogførte egenkapital mangler for regnskabsperioden.",
    });
    const intangibleAssets = selectAccount(balancesheet, "intangibleAssets");

    const sharesInSubsidiaries = components(
        balancesheet,
        ctx.taxonomy.conceptsByValuationClass("Unoterede aktier"),
        (concept) => ctx.taxonomy.labelOf(concept),
    );

    if ((getAccount(balancesheet, "longtermInvestmentsInJointVentures") ?? 0) !== 0) {
        notes.add(
            "VALUATION",
            "DOSMERSEDDEL",
            "Bemærk: Selskabet har kapitalandele i joint ventures. Vurder, om de skal indgå i unoterede aktier.",
        );
    }

    if (participatingInterests !== undefined && participatingInterests !== 0) {
        const lowVotingNames = lowVotingRightsSubsidiaries(ctx.group);
        if (lowVotingNames) {
            notes.add(
                "VALUATION",
                "DOSMERSEDDEL",
                `Bemærk: Der er datterselskaber med under 20% stemmerettigheder: ${lowVotingNames}. Overvej behandling af kapitalinteresser.`,
            );
        }
    }

    if (ordinaryProperty !== 0) {
        notes.add("VALUATION", "DOSMERSEDDEL", `${notePrefix(slot)}Indtast værdi af fast ejendom.`);
        notes.add(
            "VALUATION",
            "DOSMERSEDDEL",
            `${notePrefix(slot)}Overvej, hvorvidt udskudt skat på ejendomme skal korrigeres.`,
        );
    }

    const proposedDividends = ctx.isParent ? selectAccount(balancesheet, "proposedDividendRecognisedInEquity") : null;

    return {
        adjustedEquity: {
            equity,
            intangibleAssets,
            landAndBuildings: totalPropertyBookValue !== 0 ? totalPropertyBookValue : null,
            sharesInSubsidiaries,
            proposedDividends,
        },
        property,
    };
}

function resolveCapitalisedEarnings(
    balancesheet: AccountContainer,
    incomeStatement: AccountContainer,
    reportNotes: AccountContainer,
    slot: number,
    startDate: string,
    endDate: string,
    ctx: ResolutionContext,
    notes: NoteCollector,
): CapitalisedEarnings {
    const labelOf = (concept: string) => ctx.taxonomy.labelOf(concept);

    const assets = insertAccount(balancesheet, "assets", notes, {
        note: `Den bogførte værdi af aktiver i alt mangler for regnskabsperioden ${startDate}-${endDate}.`,
    });
    const goodwill = selectAccount(balancesheet, "goodwill");
    const cashAndCashEquivalents = selectAccount(balancesheet, "cashAndCashEquivalents");
    const deposits = selectAccount(balancesheet, "depositsLongtermInvestmentsAndReceivables");

    const revenue = insertAccount(incomeStatement, "revenue", notes, {
        note: `Nettoomsætningen mangler for regnskabsperioden ${startDate}-${endDate}.`,
    });

    const profitLossBeforeTax = selectWithFallback(incomeStatement, [
        "profitLossFromOrdinaryActivitiesBeforeTax",
        "profitLoss",
    ]);
    if (!profitLossBeforeTax || profitLossBeforeTax.value === 0 || profitLossBeforeTax.usedFallback) {
        notes.add(
            "VALUATION",
            "DOSMERSEDDEL",
            "BEMÆRK: Årsrapporten indeholdte ikke 'Resultat før skat'. 'Årets resultat anvendes i stedet.",
        );
    }

    const extraordinaryIncome = selectAccount(incomeStatement, "extraordinaryIncome");
    const extraordinaryExpenses = selectAccount(incomeStatement, "extraordinaryExpenses");

    const depreciationTotal = getAccount(
        incomeStatement,
        "depreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss",
    );
    const amortisation = getAccount(reportNotes, "amortisationOfIntangibleAssets");
    const intangibleAssets = getAccount(balancesheet, "intangibleAssets");

    const depreciationOfIntangibleAssets = selectAccount(reportNotes, "amortisationOfIntangibleAssets");

    if (
        amortisation === undefined &&
        depreciationTotal !== undefined &&
        depreciationTotal !== 0 &&
        intangibleAssets !== undefined &&
        intangibleAssets !== 0
    ) {
        notes.add(
            "VALUATION",
            "DOSMERSEDDEL",
            `Tjek efter afskrivninger på immaterielle aktiver for regnskabsperioden ${startDate}-${endDate}.`,
        );
    }

    const unlistedShares = components(balancesheet, ctx.taxonomy.conceptsByValuationClass("Unoterede aktier"), labelOf);

    const financialIncome: CapitalisedEarnings["financialIncome"] = [];
    const financialExpenses: CapitalisedEarnings["financialExpenses"] = [];
    for (const concept of FINANCE_INCOME_SOURCE) {
        const value = getAccount(incomeStatement, concept);
        if (value === undefined || value === 0) continue;
        (value >= 0 ? financialIncome : financialExpenses).push({ concept, label: labelOf(concept), value });
    }
    for (const concept of FINANCE_EXPENSE_SOURCE) {
        const value = getAccount(incomeStatement, concept);
        if (value === undefined || value === 0) continue;
        (value < 0 ? financialIncome : financialExpenses).push({ concept, label: labelOf(concept), value });
    }

    const financialInstruments = components(
        balancesheet,
        ctx.taxonomy.leafConceptsByValuationClass("Værdipapirer"),
        labelOf,
    );

    const nonOpFullConcepts = ctx.taxonomy.leafConceptsByValuationClassAndKey("Andre ikke-driftsrelaterede poster", 1);
    const nonOpHalfConcepts = ctx.taxonomy.leafConceptsByValuationClassAndKey(
        "Andre ikke-driftsrelaterede poster",
        0.5,
    );
    const otherNonOperatingAssets = {
        full: components(balancesheet, nonOpFullConcepts, labelOf),
        half: components(balancesheet, nonOpHalfConcepts, labelOf),
    };

    const noteFull = nonOperatingAssetsNote(otherNonOperatingAssets.full, "100 %");
    if (noteFull) notes.add("VALUATION", "DOSMERSEDDEL", `${notePrefix(slot)}${noteFull}`);
    const noteHalf = nonOperatingAssetsNote(otherNonOperatingAssets.half, "50 %");
    if (noteHalf) notes.add("VALUATION", "DOSMERSEDDEL", `${notePrefix(slot)}${noteHalf}`);

    const intercompanyReceivables = components(
        balancesheet,
        ctx.taxonomy.conceptsByValuationClass("Tilgodehavender hos associerede eller tilknyttede selskaber"),
        labelOf,
    );

    return {
        assets,
        goodwill,
        cashAndCashEquivalents,
        deposits,
        revenue,
        profitLossBeforeTax,
        extraordinaryIncome,
        extraordinaryExpenses,
        depreciationOfIntangibleAssets,
        unlistedShares,
        financialIncome,
        financialExpenses,
        financialInstruments,
        otherNonOperatingAssets,
        intercompanyReceivables,
    };
}

/**
 * Selects an account and emits the given note when it is missing, zero, or (for
 * fallback selections) not the first-choice concept — Report.InsertAccount's rules.
 */
function insertAccount(
    container: AccountContainer,
    concept: string,
    notes: NoteCollector,
    options?: { note?: string },
): AccountValue | null {
    const selected = selectAccount(container, concept);
    if (options?.note && (!selected || selected.value === 0)) {
        notes.add("VALUATION", "DOSMERSEDDEL", options.note);
    }
    return selected;
}

function emptyPropertyBlock(): ResolvedProperty {
    return {
        address: "Investeringsejendomme",
        remarks: "Dagsværdien fra årsrapporten er anvendt.",
        ownershipShare: 1,
        basisOfValuation: "DAGSVÆRDI",
        valuationsBySlot: {},
    };
}

function nonOperatingAssetsNote(items: Array<{ label: string; value: number }>, percentLabel: string): string {
    if (items.length === 0) return "";
    const labels = items.map((item) => `${item.label} (${formatDanishInteger(item.value)})`).join(", ");
    return `Andre ikke-driftsrelaterede poster (${percentLabel}): ${labels}.`;
}

/**
 * Names (with voting intervals) of subsidiaries whose voting-rights lower bound
 * is below 20 % — the hardcoded threshold from Valuation.HasLowVotingRightsSubsidiaries.
 */
function lowVotingRightsSubsidiaries(group: GroupCompany[]): string {
    const entries: string[] = [];
    for (const company of group) {
        if (company.level <= 0) continue;
        const from = company.votingRightsFrom;
        if (from === null || from >= 0.2) continue;
        let interval = `${formatPercentNumber(from * 100)}%`;
        if (company.votingRightsTo !== null) {
            interval += ` - ${formatPercentNumber(company.votingRightsTo * 100)}%`;
        }
        entries.push(`${company.name} (${interval})`);
    }
    return entries.join(", ");
}

/** Danish decimal comma, no trailing zeros — matches VBA's string coercion of a Double. */
function formatPercentNumber(value: number): string {
    return String(Math.round(value * 100) / 100).replace(".", ",");
}

export function notePrefix(slot: number): string {
    return `År ${slot}: `;
}

/**
 * Collects notes and drops exact duplicates per notepad, matching the dedupe
 * the workbook's AddNote does when it finds the same text already present.
 */
export class NoteCollector {
    private readonly seen = new Set<string>();
    private readonly notes: ResolvedNote[] = [];

    public add(sheet: ResolvedNote["sheet"], notepad: string, text: string, fit = false): void {
        const key = `${sheet} ${notepad} ${text}`;
        if (this.seen.has(key)) return;
        this.seen.add(key);
        this.notes.push({ text, fit, sheet, notepad });
    }

    public list(): ResolvedNote[] {
        return this.notes;
    }
}
