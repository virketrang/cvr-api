import type { AccountSection } from "./types.js";
import { val } from "./types.js";

/**
 * A child entry in the subtotal tree: either one concept, or a list of
 * ALTERNATIVE concepts for the same line (e.g. the maturity-specific
 * "shorttermTradePayables" vs the unsplit "tradePayables") of which only the
 * first reported one counts — so the same krone is never counted twice.
 */
export type TreeChild = string | string[];

/**
 * Parent → children over the extracted concepts (the same classification the
 * spreadsheet's ASSET_TAXONOMY_TREE uses). Drives the residual engine: for
 * every reported node with at least one reported child, parent − Σ(children)
 * must be within tolerance.
 *
 * Two deliberate omissions to avoid double counting across ALTERNATIVE legal
 * decompositions: equity is only decomposed by reserve type (not into
 * equityAttributableToParent + minorityInterests), and liabilities are only
 * decomposed by maturity, with the unsplit by-kind concepts as alternatives
 * inside the shortterm bucket (long-term trade payables etc. are rare, and an
 * alternative is only used when the maturity-specific concept is absent).
 */
export const conceptTree: Record<string, TreeChild[]> = {
    // ---- Aktiver ----
    assets: ["nonCurrentAssets", "currentAssets"],
    nonCurrentAssets: ["intangibleAssets", "propertyPlantAndEquipment", "longtermInvestmentsAndReceivables"],
    intangibleAssets: [
        "completedDevelopmentProjects",
        "acquiredIntangibleAssets",
        "goodwill",
        "developmentProjectsInProgressAndPrepaymentsForIntangibleAssets",
    ],
    completedDevelopmentProjects: [
        "concessionsOriginatingFromDevelopmentProjects",
        "patentsOriginatingFromDevelopmentProjects",
        "trademarksOriginatingFromDevelopmentProjects",
        "otherSimilarRightsOriginatingFromDevelopmentProjects",
    ],
    acquiredIntangibleAssets: [
        "acquiredConcessions",
        "acquiredPatents",
        "acquiredLicences",
        "acquiredTrademarks",
        "acquiredOtherSimilarRights",
    ],
    developmentProjectsInProgressAndPrepaymentsForIntangibleAssets: [
        "developmentProjectsInProgress",
        "prepaymentsForIntangibleAssets",
    ],
    propertyPlantAndEquipment: [
        "landAndBuildings",
        "investmentProperty",
        "otherInvestmentAssets",
        "plantAndMachinery",
        "fixturesFittingsToolsAndEquipment",
        "biologicalAssets",
        "leaseholdImprovements",
        "ships",
        "planes",
        "rightOfUseAssets",
        "propertyPlantAndEquipmentInProgressAndPrepaymentsForPropertyPlantAndEquipment",
    ],
    landAndBuildings: ["land", "buildings"],
    propertyPlantAndEquipmentInProgressAndPrepaymentsForPropertyPlantAndEquipment: [
        "propertyPlantAndEquipmentInProgress",
        "prepaymentsForPropertyPlantAndEquipment",
    ],
    longtermInvestmentsAndReceivables: [
        "longtermInvestmentsInGroupEnterprises",
        "longtermInvestmentsInAssociates",
        "longtermParticipatingInterests",
        "longtermInvestmentsInJointVentures",
        "longtermReceivablesFromGroupEnterprises",
        "longtermReceivablesFromAssociates",
        "longtermReceivablesFromParticipatingInterests",
        "longtermReceivablesFromJointVentures",
        "longtermReceivablesFromOwnersOtherCompanies",
        "otherLongtermInvestments",
        "otherLongtermReceivables",
        "longtermReceivablesFromOwnersAndManagement",
        "nonCurrentDeferredTaxAssets",
        "depositsLongtermInvestmentsAndReceivables",
        "costExceedsIncomeForTheFinancialYearLongtermReceivables",
        "contributedCapitalInArrearsLongTerm",
        "nonCurrentContractAssets",
    ],
    currentAssets: ["inventories", "shorttermReceivables", "shorttermInvestments", "cashAndCashEquivalents", "assetsMeantForSale"],
    inventories: [
        "rawMaterialsAndConsumables",
        "workInProgress",
        "manufacturedGoodsAndGoodsForResale",
        "prepaymentsForGoods",
        "livestock",
        "propertyHeldForSaleInTheOrdinaryCourseOfBusiness",
        "assetsHeldForSaleInventories",
    ],
    shorttermReceivables: [
        "shorttermTradeReceivables",
        "contractWorkInProgress",
        "shorttermReceivablesFromGroupEnterprises",
        "shorttermReceivablesFromAssociates",
        "shorttermReceivablesFromJointVentures",
        "shorttermReceivablesFromParticipatingInterests",
        "shorttermReceivablesDividendsFromGroupEnterprises",
        "shorttermReceivablesDividendsFromAssociates",
        "shorttermReceivablesDividendsFromJointVentures",
        "shorttermReceivablesDividendsFromParticipatingInterests",
        "currentDeferredTaxAssets",
        "shorttermTaxReceivables",
        "shorttermTaxReceivablesFromGroupEnterprises",
        "vatAndDutiesReceivables",
        "otherShorttermReceivables",
        "contributedCapitalInArrears",
        "shorttermReceivablesFromOwnersAndManagement",
        "deferredIncomeAssets",
        "costExceedsIncomeForTheFinancialYearShorttermReceivables",
        "timingDifferencesShorttermReceivablesEspeciallyUtilities",
        "currentContractAssets",
        ["derivativeFinancialInstrumentsShorttermAssets", "derivativeFinancialInstrumentsAssets"],
    ],
    shorttermInvestments: ["shorttermInvestmentsInGroupEnterprises", "shorttermInvestmentsInAssociates", "otherShorttermInvestments"],

    // ---- Passiver ----
    liabilitiesAndEquity: ["equity", "provisions", "liabilitiesOtherThanProvisions"],
    equity: [
        "contributedCapital",
        "sharePremium",
        "revaluationReserve",
        "otherReserves",
        "retainedEarnings",
        "proposedDividendRecognisedInEquity",
        "proposedExtraordinaryDividendRecognisedInEquity",
    ],
    otherReserves: [
        "reserveForNetRevaluationAccordingToEquityMethod",
        "reserveForLoansAndCollaterals",
        "reserveForUnpaidContributedCapital",
        "reserveForEntrepreneurialCompany",
        "reserveForDevelopmentExpenditure",
        "reserveForNetRevaluationOfInvestmentAssets",
        "reserveForCurrentValueAdjustmentsOfCurrencyGains",
        "reserveForCurrentValueOfHedging",
        "otherStatutoryReserves",
        "reserveAccordingToArticlesOfAssociation",
        "reserveForBiologicalAssets",
        "hedgeFund",
        "reserveFund",
        "restOfOtherReserves",
    ],
    provisions: [
        "provisionsForPensionsAndSimilarLiabilities",
        "provisionsForDeferredTax",
        "otherProvisions",
        "provisionsForInvestmentsInGroupEnterprises",
        "provisionsForInvestmentsInGroupAssociates",
        "provisionsForInvestmentsInParticipatingInterests",
        "provisionsForInvestmentsInJointVentures",
        "provisionsForIncomeExceedCostForTheFinancialYear",
        "timingDifferencesProvisionsEspeciallyUtilities",
    ],
    liabilitiesOtherThanProvisions: ["longtermLiabilitiesOtherThanProvisions", "shorttermLiabilitiesOtherThanProvisions"],
    longtermLiabilitiesOtherThanProvisions: [
        "longtermDebtToCreditInstitutions",
        "longtermMortgageDebt",
        "longtermDebtToBanks",
        "otherLongtermDebtRaisedByIssuanceOfBonds",
        "longtermDebtToOtherCreditInstitutions",
        "convertibleProfitYieldingOrDividendYieldingLongtermDebtInstruments",
        "longtermPrepaymentsReceivedFromCustomers",
        "longtermTradePayables",
        "longtermBillsOfExchangePayable",
        "longtermPayablesToGroupEnterprises",
        "longtermPayablesToAssociates",
        "longtermPayablesToParticipatingInterests",
        "longtermPayablesToJointVentures",
        "longtermLPayablesToOwnersOtherCompanies",
        "longtermTaxPayables",
        "longtermTaxPayablesToGroupEnterprises",
        "otherPayablesIncludingTaxPayablesLiabilitiesOtherThanProvisionsLongterm",
        "holidayAllowanceLiabilitiesLongterm",
        "longtermDeferredIncome",
        "longtermNegativeGoodwill",
        "longtermLeaseCommitments",
        "longtermEquityLoan",
        "longtermPayablesToShareholdersAndManagement",
        "longtermPrepaymentsOfWorkInProgress",
        "longtermContractWorkInProgressLiabilities",
        "longtermDerivativeFinancialInstrumentsLiabilities",
        "depositsLongtermLiabilitiesOtherThanProvisions",
        "incomeExceedCostForTheFinancialYearLongterm",
        "noncurrentContractLiabilities",
        "pensionsAndSimilarLiabilitiesLiabilitiesLongterm",
        "timingDifferencesProvisionsEspeciallyUtilitiesLiabilitiesLongterm",
        "otherProvisionsLiabilitiesLongterm",
        "provisionsForInvestmentsInGroupEnterprisesLiabilitiesLongterm",
        "provisionsForInvestmentsInGroupAssociatesLiabilitiesLongterm",
        "provisionsForInvestmentsInParticipatingInterestsLiabilitiesLongterm",
        "provisionsForInvestmentsInJointVenturesLiabilitiesLongterm",
        "provisionsForOverfundingForReportingPeriodLiabilitiesLongterm",
        "deferredTaxLiabilitiesLongterm",
    ],
    shorttermLiabilitiesOtherThanProvisions: [
        "shorttermPartOfLongtermLiabilitiesOtherThanProvisions",
        "shorttermDebtToCreditInstitutions",
        "shorttermMortgageDebt",
        "shorttermDebtToBanks",
        "otherShorttermDebtRaisedByIssuanceOfBonds",
        "shorttermDebtToOtherCreditInstitutions",
        "convertibleProfitYieldingOrDividendYieldingShorttermDebtInstruments",
        ["shorttermPrepaymentsReceivedFromCustomers", "prepaymentsReceivedFromCustomers"],
        ["shorttermTradePayables", "tradePayables"],
        ["shorttermBillsOfExchangePayable", "billsOfExchangePayable"],
        ["shorttermPayablesToGroupEnterprises", "payablesToGroupEnterprises"],
        ["shorttermPayablesToAssociates", "payablesToAssociates"],
        ["shorttermPayablesToParticipatingInterest", "payablesToParticipatingInterests"],
        ["shorttermPayablesToJointVentures", "payablesToJointVentures"],
        "shorttermPayablesToOwnersOtherCompanies",
        ["shorttermTaxPayables", "taxPayables"],
        ["shorttermTaxPayablesToGroupEnterprises", "taxPayablesToGroupEnterprises"],
        "vatAndDutiesPayables",
        [
            "otherPayablesIncludingTaxPayablesLiabilitiesOtherThanProvisionsShortterm",
            "otherPayablesIncludingTaxPayables",
            "otherShorttermPayables",
        ],
        ["holidayAllowanceLiabilitiesShortterm", "holidayAllowance"],
        ["shorttermDeferredIncome", "deferredIncome"],
        ["shorttermNegativeGoodwill", "negativeGoodwill"],
        ["shorttermLeaseCommitments", "leaseCommitments"],
        "proposedDividend",
        ["shorttermEquityLoan", "equityLoan"],
        ["shorttermPayablesToShareholdersAndManagement", "payablesToShareholdersAndManagement"],
        ["shorttermPrepaymentsOfWorkInProgress", "prepaymentsOfWorkInProgress"],
        ["shorttermContractWorkInProgressLiabilities", "contractWorkInProgressLiabilities"],
        ["shortermDerivativeFinancialInstrumentsLiabilities", "derivativeFinancialInstrumentsLiabilities"],
        "depositsShorttermLiabilitiesOtherThanProvisions",
        ["incomeExceedCostForTheFinancialYearShortterm", "incomeExceedCostForTheFinancialYear"],
        "currentContractLiabilities",
        "liabilitiesRelatedToAssetsMeantForSale",
        "pensionsAndSimilarLiabilitiesLiabilitiesShortterm",
        "timingDifferencesProvisionsEspeciallyUtilitiesLiabilitiesShortterm",
        "otherProvisionsLiabilitiesShortterm",
        "provisionsForInvestmentsInGroupEnterprisesLiabilitiesShortterm",
        "provisionsForInvestmentsInGroupAssociatesLiabilitiesShortterm",
        "provisionsForInvestmentsInParticipatingInterestsLiabilitiesShortterm",
        "provisionsForInvestmentsInJointVenturesLiabilitiesShortterm",
        "provisionsForOverfundingForReportingPeriodLiabilitiesShortterm",
    ],

    // ---- Resultatopgørelsen ----
    employeeBenefitsExpense: [
        "wagesAndSalaries",
        "postemploymentBenefitExpense",
        "socialSecurityContributions",
        "otherEmployeeExpense",
    ],
};

/**
 * The result of resolving one child entry: the amount it contributes to its
 * parent's sum, plus the concepts that carried it (for the finding message).
 */
export interface Contribution {
    amount: number;
    /** The concepts whose reported values make up the amount. */
    concepts: string[];
}

/**
 * A node's effective value: its own reported value when present (a node
 * reported together with its children counts as itself — never both), else the
 * sum of its children's effective values, else undefined. This is what lets
 * land/buildings roll up into landAndBuildings and on into
 * propertyPlantAndEquipment without ever counting the same krone twice.
 */
export function effectiveValue(section: AccountSection, concept: string): Contribution | undefined {
    const own = val(section, concept);
    if (own !== undefined) return { amount: own, concepts: [concept] };

    const children = conceptTree[concept];
    if (!children) return undefined;

    const contributions = children
        .map((child) => childContribution(section, child))
        .filter((c): c is Contribution => c !== undefined);
    if (contributions.length === 0) return undefined;

    return {
        amount: contributions.reduce((sum, c) => sum + c.amount, 0),
        concepts: contributions.flatMap((c) => c.concepts),
    };
}

/** Resolves one child entry; for an alternatives group the first reported alternative wins. */
export function childContribution(section: AccountSection, child: TreeChild): Contribution | undefined {
    if (typeof child === "string") return effectiveValue(section, child);
    for (const alternative of child) {
        const contribution = effectiveValue(section, alternative);
        if (contribution !== undefined) return contribution;
    }
    return undefined;
}

/**
 * Children that filers sometimes tag as a MOVEMENT rather than a closing
 * balance, so their amount may legally be absent from the parent's total: an
 * extraordinary dividend declared and paid during the year is often tagged
 * with proposedExtraordinaryDividendRecognisedInEquity even though it is no
 * longer part of closing equity. The residual passes when it reconciles with
 * OR without these children.
 */
const OPTIONAL_IN_SUM: Record<string, string[]> = {
    equity: ["proposedDividendRecognisedInEquity", "proposedExtraordinaryDividendRecognisedInEquity"],
};

/**
 * The residual of one reported node against its reported children:
 * node − Σ(children), evaluated with tolerance. Undefined when the node itself
 * or all children are unreported (missing concepts are never an error), or when
 * any legal combination of the optional children reconciles. When nothing
 * reconciles, the closest combination is returned for the finding message.
 */
export function residualOf(
    section: AccountSection,
    concept: string,
    unit: number,
    withinTolerance: (expected: number, actual: number, unit: number) => boolean,
): { expected: number; actual: number; childConcepts: string[] } | undefined {
    const own = val(section, concept);
    const children = conceptTree[concept];
    if (own === undefined || !children) return undefined;

    const contributions = children
        .map((child) => childContribution(section, child))
        .filter((c): c is Contribution => c !== undefined);
    if (contributions.length === 0) return undefined;

    const optional = new Set(OPTIONAL_IN_SUM[concept] ?? []);
    const droppable = contributions.filter((c) => c.concepts.length === 1 && optional.has(c.concepts[0]));
    const total = contributions.reduce((sum, c) => sum + c.amount, 0);

    let best: { expected: number; childConcepts: string[] } = {
        expected: total,
        childConcepts: contributions.flatMap((c) => c.concepts),
    };
    for (let mask = 0; mask < 1 << droppable.length; mask++) {
        const dropped = droppable.filter((_, i) => mask & (1 << i));
        const expected = total - dropped.reduce((sum, c) => sum + c.amount, 0);
        if (withinTolerance(expected, own, unit)) return undefined;
        if (Math.abs(expected - own) < Math.abs(best.expected - own)) {
            const droppedConcepts = new Set(dropped.flatMap((c) => c.concepts));
            best = {
                expected,
                childConcepts: contributions.flatMap((c) => c.concepts).filter((c) => !droppedConcepts.has(c)),
            };
        }
    }

    return { expected: best.expected, actual: own, childConcepts: best.childConcepts };
}

/** Every concept in the subtree rooted at `root` (excluding the root itself unless included). */
export function subtreeConcepts(root: string): Set<string> {
    const result = new Set<string>();
    const queue = [root];
    while (queue.length > 0) {
        const concept = queue.pop() as string;
        if (result.has(concept)) continue;
        result.add(concept);
        for (const child of conceptTree[concept] ?? []) {
            if (typeof child === "string") queue.push(child);
            else queue.push(...child);
        }
    }
    return result;
}
