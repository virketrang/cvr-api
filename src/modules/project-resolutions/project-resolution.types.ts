import type { Account } from "../annual-reports/annual-report.types.js";

/**
 * The five succession modes. The workbook sends its raw Danish mode label
 * (from the Settings sheet); the server normalizes it to one of these.
 */
export type SuccessionMode = "NO_CALCULATION" | "DATE_OF_TRANSFER" | "ONE_YEAR" | "TWO_YEAR" | "THREE_YEAR";

/**
 * A financial-statement section of an annual report viewed as a plain
 * concept → account lookup (the balance sheet, income statement or notes).
 * Missing concepts are null in the upstream extraction.
 */
export type AccountContainer = Record<string, Account | null | undefined>;

/** One row of the workbook's ASSET_TAXONOMY_TREE table (Settings sheet). */
export interface TaxonomyRow {
    concept: string;
    label: string;
    /** Parent concept name, or "" for a root. */
    parent: string;
    /** Uppercased passive-test category (e.g. "PASSIV"). */
    passiveClassification: string;
    includeInPassiveTest: boolean;
    passiveNote: string;
    valuationClassification: string;
    /** Weight for "Andre ikke-driftsrelaterede poster" (1 or 0.5). */
    distributionKey: number;
    valuationNote: string;
}

/** One row of the workbook's FINANCIAL_INCOME_TAXONOMY table (Settings sheet). */
export interface FinancialIncomeRow {
    concept: string;
    label: string;
    classification: string;
    includeInPassiveTest: boolean;
    note: string;
}

/** The Settings-sheet configuration the workbook sends with each request. */
export interface ResolutionSettings {
    corporateTaxRate: number;
    minVotingRights: number;
    minIndirectOwnership: number;
    maximumNumberOfCompanies: number;
    maxPassiveAssetTestCompanies: number;
    successionModes: {
        noCalculation: string;
        dateOfTransfer: string;
        oneYear: string;
        twoYear: string;
        threeYear: string;
    };
    reportingPeriodsLookup: {
        oneYear: number[];
        twoYear: number[];
        threeYear: number[];
    };
    currencies: Array<{ code: string; name: string; symbol: string }>;
    corporateFormLabels: {
        limitedLiabilityCompany: string;
        soleProprietorship: string;
    };
    assetTaxonomy: TaxonomyRow[];
    financialIncomeTaxonomy: FinancialIncomeRow[];
}

/** A corporate-group row after normalization (CVRs padded, ownership unpacked). */
export interface GroupCompany {
    cvr: string;
    name: string;
    level: number;
    parent: { name: string | null; cvr: string | null } | null;
    corporateFormCode: number | null;
    votingRightsFrom: number | null;
    votingRightsTo: number | null;
    /** The wizard-entered direct ownership as a decimal fraction, or null when blank. */
    directOwnership: number | null;
    consolidate: boolean;
}

/** A single summed term of a value that the workbook renders as "=a+b". */
export interface Component {
    concept: string;
    label: string;
    /** Raw signed value; the client applies Abs() when building the formula. */
    value: number;
}

/** A single resolved account value. */
export interface AccountValue {
    concept: string;
    value: number;
}

/**
 * An advisory note ("dosmerseddel"). `sheet`/`notepad` say exactly where the
 * workbook should place it, preserving the current VBA behavior — including the
 * quirk where a non-DKK valuation year sends its note to the passive-test sheet.
 */
export interface ResolvedNote {
    text: string;
    /** Re-fit / word-wrap the notepad cell after writing (VBA AddNote's `fit`). */
    fit: boolean;
    sheet: "VALUATION" | "PASSIVE_ASSET_TEST";
    /** Named range of the notepad, e.g. "DOSMERSEDDEL" or "DOSMERSEDDEL_3". */
    notepad: string;
}

export interface ProjectWarning {
    code: "BALANCE_INCOMPLETE" | "REPORTS_FAILED" | "REPORT_SKIPPED" | "SOLO_FIGURES_MISSING";
    cvr: string | null;
    companyName: string | null;
    reportingPeriodEndDate: string | null;
    message: string;
}

export interface ResolvedProperty {
    address: string;
    remarks: string;
    ownershipShare: number;
    basisOfValuation: string;
    /** PROPERTY_1_YEAR_{slot}_VALUATION values, keyed by year slot (1-3). */
    valuationsBySlot: Record<string, number>;
}

export interface AdjustedEquity {
    equity: AccountValue | null;
    intangibleAssets: AccountValue | null;
    /** Ordinary property book value + fair-value investment property, when non-zero. */
    landAndBuildings: number | null;
    sharesInSubsidiaries: Component[];
    /** Parent company only. */
    proposedDividends: AccountValue | null;
}

export interface CapitalisedEarnings {
    assets: AccountValue | null;
    goodwill: AccountValue | null;
    cashAndCashEquivalents: AccountValue | null;
    deposits: AccountValue | null;
    revenue: AccountValue | null;
    profitLossBeforeTax: { concept: string; value: number; usedFallback: boolean } | null;
    extraordinaryIncome: AccountValue | null;
    extraordinaryExpenses: AccountValue | null;
    depreciationOfIntangibleAssets: AccountValue | null;
    unlistedShares: Component[];
    financialIncome: Component[];
    financialExpenses: Component[];
    financialInstruments: Component[];
    otherNonOperatingAssets: { full: Component[]; half: Component[] };
    intercompanyReceivables: Component[];
}

export interface ValuationYear {
    /** 1-7; already shifted when room was made for an unpublished report. */
    slot: number;
    startDate: string;
    endDate: string;
    currencyName: string;
    /** 1 for DKK, null otherwise (the user enters the rate manually). */
    exchangeRate: number | null;
    adjustedEquity: AdjustedEquity | null;
    /** Null when the year's investment property is carried at fair value. */
    capitalisedEarnings: CapitalisedEarnings | null;
}

export interface ResolvedValuation {
    notes: ResolvedNote[];
    property: ResolvedProperty | null;
    years: ValuationYear[];
}

export interface PassiveLineItem {
    concept: string;
    label: string;
    /** Passive classification for asset items; null for income items. */
    category: string | null;
    value: number;
}

export interface PassiveYear {
    /** 1-3; already shifted when room was made for an unpublished report. */
    slot: number;
    startDate: string;
    endDate: string;
    currencyName: string;
    exchangeRate: number | null;
    totalAssets: AccountValue | null;
    revenue: Component[];
    /** False when neither revenue nor other operating income was reported. */
    hasRevenue: boolean;
    assets: PassiveLineItem[];
    income: PassiveLineItem[];
    bookValueOfSharesInSubsidiaries: Component[];
    incomeFromSubsidiaries: Component[];
}

export interface PassiveDateOfTransfer {
    dateOfValuation: string;
    currencyName: string;
    exchangeRate: number | null;
    totalAssets: AccountValue | null;
    assets: PassiveLineItem[];
    bookValueOfSharesInSubsidiaries: Component[];
}

export interface ResolvedPassiveAssetTest {
    notes: ResolvedNote[];
    /**
     * Only set when the newest report lands in year slot 1 (i.e. no unpublished-
     * report shift happened) — faithful to the current VBA behavior.
     */
    dateOfTransfer: PassiveDateOfTransfer | null;
    years: PassiveYear[];
}

export interface OverviewRow {
    name: string;
    cvr: string;
    corporateForm: string;
    owner: string;
    reportingPeriods: number;
    taxRate: number;
    /** Percent (0-100), as written to the overview sheet. */
    directOwnershipPercent: number;
    /**
     * What the overview's KONSOLIDERET cell should say. Faithful to the current
     * VBA batch flow this is always false; the wizard's checkbox value is exposed
     * separately as `consolidateRequested` on the company.
     */
    consolidate: boolean;
}

export interface ResolvedCompany {
    /** 1-based position in the corporate group (1 = ultimate parent). */
    index: number;
    cvr: string;
    name: string;
    isParent: boolean;
    overviewRow: OverviewRow;
    ownership: {
        direct: number | null;
        indirect: number | null;
        votingRightsFrom: number | null;
        votingRightsTo: number | null;
    };
    /** The wizard's consolidation checkbox for this company. */
    consolidateRequested: boolean;
    includeInPassiveTest: boolean;
    /** 1-based column slot on the passive-test sheet, or null when not included. */
    passiveCompanySlot: number | null;
    reportStatus: {
        status: "success" | "failed" | "error" | "missing";
        errorCode: string | null;
        message: string | null;
        skipped: Array<{ reportingPeriodEndDate: string | null; message: string }>;
    };
    /** True when year slot 1 was left open for an unpublished annual report. */
    unpublishedShift: boolean;
    valuation: ResolvedValuation;
    passiveAssetTest: ResolvedPassiveAssetTest | null;
}

export interface ProjectResolutionResponse {
    status: "success" | "partial";
    successionMode: SuccessionMode;
    /** The raw Danish mode label, echoed for the workbook's PASSIVE_ASSET_TEST cell. */
    successionPeriodLabel: string;
    currencyCode: string;
    dateOfTransfer: string | null;
    numberOfCompanies: number;
    numberOfPassiveTestCompanies: number;
    excludedCompanies: Array<{ cvr: string; name: string; reason: string }>;
    warnings: ProjectWarning[];
    companies: ResolvedCompany[];
}
