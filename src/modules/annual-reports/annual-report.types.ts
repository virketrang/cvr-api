import type { ErrorCode } from "../../utils/api-error.js";

/**
 * A single annual-report document that could not be turned into a usable report,
 * with the reason. Surfaced to the client so the user knows which year/document
 * failed and why (e.g. an unknown taxonomy) instead of it silently vanishing.
 */
export interface ReportSkip {
    reportingPeriodEndDate: string | null;
    documentUrl: string | null;
    errorCode: ErrorCode;
    message: string;
}

/**
 * Result of trying to extract one XBRL document: either a usable report, or a
 * typed reason it was skipped. Replaces the old `AnnualReport | null` so the
 * caller can report *why* a document was dropped.
 */
export type ExtractResult =
    | { ok: true; report: AnnualReport<Account>; priorFigures: PriorPeriodFigures | null }
    | { ok: false; errorCode: ErrorCode; message: string };

/**
 * The comparative (prior-period) figures a filing carries alongside its own
 * period. Never exposed in the API response: they exist so the service can
 * cross-check a year's report against the same year's comparatives in the
 * following year's report and warn on differences (restatements).
 */
export interface PriorPeriodFigures {
    /** End date of the preceding reporting period, i.e. the period the figures cover. */
    endDate: string;
    incomeStatement: Partial<IncomeStatement<Account>>;
    balanceSheet: Partial<BalanceSheet<Account>>;
    consolidated: {
        incomeStatement: Partial<IncomeStatement<Account>>;
        balanceSheet: Partial<BalanceSheet<Account>>;
    } | null;
}

export interface UnprocessedAnnualReport {
    cvrNumber: number;
    reportingPeriod: {
        startDate: string;
        endDate: string;
    };
    documents: Array<{
        dokumentUrl: string;
        dokumentMimeType: string;
        dokumentType: string;
        xmlText: string;
    }>;
}

export type RecursiveXBRLRecord<T> = {
    [K in keyof T]: XBRLRecord;
};

export type XBRLContext = {
    id: string;
    startDate: string | null;
    endDate: string | null;
    identifier: string | null;
    instant: string | null;
    explicitMember: string | null;
    /**
     * All dimension members on the context's scenario, both explicit (QName
     * members like `SubsidiaryMember`) and typed (e.g. a `relatedEntityIdentifier`
     * value). Used to group dimensional facts — such as related entities — that
     * are spread across several contexts (e.g. a duration context for the name and
     * an instant context for the ownership share) but share the same dimensions.
     */
    dimensions: Array<{ dimension: string; member: string }>;
};

export type XBRLRecord = Array<{
    value: string | null;
    context: XBRLContext | null;
    unit: string | null;
    label: string;
    decimals: number | null;
}> | null;

export type TaxonomyFact = {
    name: string;
    namespace: string;
    label: string;
    balance?: "debit" | "credit";
};

export type FilteredRecord = {
    value: string | null;
    unit: string | null;
    label: string;
} | null;

export interface Account {
    value: number;
    unit: string;
    label: string;
}

export interface RelatedEntity {
    cvrNumber: string | null;
    legalEntityIdentifier: string | null;
    pNumber: string | null;
    name: string | null;
    registeredOffice: string | null;
    legalForm: string | null;
    ownershipPercentage: number | null;
}

export interface ConsolidatedFinancialStatementsSubsidiary {
    cvrNumber: string | null;
    legalEntityIdentifier: string | null;
    pNumber: string | null;
    name: string | null;
    registeredOffice: string | null;
    placeWhereConsolidatedFinancialStatementsMayBeObtained: string | null;
}

/** Which statement of the report a warning entry points into. */
export type StatementName =
    | "balanceSheet"
    | "incomeStatement"
    | "notes"
    | "consolidatedBalanceSheet"
    | "consolidatedIncomeStatement";

/**
 * A non-fatal data-quality note attached to a single annual report.
 *
 * SCALING_REPAIRED: an amount carried a negative `decimals` (precision indicator)
 * but lacked the trailing zeros that precision implies — a sign the filer misused
 * `decimals` as a scale — so we multiplied it back up. Surfaced so the consumer
 * knows the value was adjusted and can sanity-check it.
 *
 * PRIOR_YEAR_MISMATCH: one or more amounts in this report differ from the
 * comparative figures for the same period in the following year's report
 * (typically a restatement). Attached to the report the figures are FOR.
 */
export type ReportWarning =
    | {
          code: "SCALING_REPAIRED";
          message: string;
          repairedFields: Array<{
              statement: StatementName;
              field: string;
              originalValue: number;
              repairedValue: number;
              factor: number;
          }>;
      }
    | {
          code: "PRIOR_YEAR_MISMATCH";
          message: string;
          differences: Array<{
              statement: StatementName;
              field: string;
              label: string;
              /** The amount as stated in this report. */
              value: number;
              /** The comparative amount for the same period in the following year's report. */
              valueInNextReport: number;
          }>;
      };

export interface ÅRLTaxonomy {
    schema: string[];
    body: {
        reportingPeriod: ReportingPeriod<TaxonomyFact>;
        notes: Notes<TaxonomyFact>;
        informationOnRelatedEntities: InformationOnRelatedEntities<TaxonomyFact>;
        consolidatedFinancialStatements: ConsolidatedFinancialStatements<TaxonomyFact>;
        balanceSheet: BalanceSheet<TaxonomyFact>;
        incomeStatement: IncomeStatement<TaxonomyFact>;
    };
}

export interface ÅRLExtract {
    reportingPeriod: ReportingPeriod<XBRLRecord>;
    balanceSheet: BalanceSheet<XBRLRecord>;
    incomeStatement: IncomeStatement<XBRLRecord>;
}

export type AnnualReportResponse = {
    total: number;
    status: "failed" | "success" | "error";
    results: Array<AnnualReport<Account>>;
    /** Documents that were fetched but could not be parsed into a usable report. */
    skipped: ReportSkip[];
};

export interface AnnualReport<T> {
    reportingPeriod: ReportingPeriod<string>;
    unit: string;
    balancesheet: BalanceSheet<T>;
    incomeStatement: IncomeStatement<T>;
    notes: Notes<T>;
    relatedEntities: RelatedEntity[];
    consolidatedFinancialStatements: ConsolidatedFinancialStatementsSubsidiary[];
    /**
     * Koncernregnskabet: the group's income statement and balance sheet, present
     * when the filing carries facts in ConsolidatedMember contexts (i.e. the
     * company prepares consolidated financial statements). The top-level
     * statements remain the parent company's own (solo) figures. Null when the
     * filing has no consolidated figures.
     */
    consolidated: {
        incomeStatement: IncomeStatement<T>;
        balancesheet: BalanceSheet<T>;
    } | null;
    warnings: ReportWarning[];
}

export interface ReportingPeriod<T> {
    reportingPeriodStartDate: T;
    reportingPeriodEndDate: T;
}

export interface DanishBusinessRegistrationAccountingAPIResponse {
    took: number;
    timed_out: boolean;
    _shards: {
        total: number;
        successful: number;
        skipped: number;
        failed: number;
    };
    hits: {
        total: number;
        max_score: number | null;
        hits: Array<{
            _index: string;
            _type: string;
            _id: string;
            _score: number | null;
            _source: {
                cvrNummer: number;
                regNummer: null;
                omgoerelse: boolean;
                sagsNummer: string;
                offentliggoerelsestype: string;
                regnskab: {
                    godkendelse: {
                        dirigent: string;
                        godkendelsesdato: string;
                    };
                    regnskabsperiode: {
                        startDato: string;
                        slutDato: string;
                    };
                };
                offentliggoerelsesTidspunkt: string;
                indlaesningsTidspunkt: string;
                sidstOpdateret: string;
                dokumenter: Array<{
                    dokumentUrl: string;
                    dokumentMimeType: string;
                    dokumentType: string;
                }>;
                indlaesningsId: string;
            };
        }>;
    };
}

export interface Notes<T> {
    amortisationOfIntangibleAssets: T;
    impairmentLossesOfIntangibleAssets: T;
    accumulatedImpairmentLossesAndAmortisationOfIntangibleAssets: T;
}

export interface InformationOnRelatedEntities<T> {
    identificationNumberCvrOfRelatedEntity: T;
    legalEntityIdentifierOfRelatedEntity: T;
    identificationNumberPnrOfRelatedEntity: T;
    relatedEntityName: T;
    relatedEntityRegisteredOffice: T;
    relatedEntityLegalForm: T;
    shareHeldByEntityOrConsolidatedEnterprisesInRelatedEntity: T;
}

export interface ConsolidatedFinancialStatements<T> {
    subsidiaries: {
        identificationNumberCvrOfRelatedEntityConsolidatedFinancialStatements: T;
        legalEntityIdentifierOfRelatedEntityConsolidatedFinancialStatements: T;
        identificationNumberPnrOfRelatedEntityConsolidatedFinancialStatements: T;
        relatedEntityNameConsolidatedFinancialStatements: T;
        relatedEntityRegisteredOfficeConsolidatedFinancialStatements: T;
        placeAtWhichConsolidatedFinancialStatementsMayBeObtainedIfParentIsNondanishEntity: T;
    };
}

export interface BalanceSheet<T> {
    assets: T;
    nonCurrentAssets: T;
    intangibleAssets: T;
    completedDevelopmentProjects: T;
    concessionsOriginatingFromDevelopmentProjects: T;
    patentsOriginatingFromDevelopmentProjects: T;
    trademarksOriginatingFromDevelopmentProjects: T;
    otherSimilarRightsOriginatingFromDevelopmentProjects: T;
    acquiredIntangibleAssets: T;
    acquiredConcessions: T;
    acquiredPatents: T;
    acquiredLicences: T;
    acquiredTrademarks: T;
    acquiredOtherSimilarRights: T;
    goodwill: T;
    developmentProjectsInProgressAndPrepaymentsForIntangibleAssets: T;
    developmentProjectsInProgress: T;
    prepaymentsForIntangibleAssets: T;
    propertyPlantAndEquipment: T;
    landAndBuildings: T;
    land: T;
    buildings: T;
    investmentProperty: T;
    otherInvestmentAssets: T;
    plantAndMachinery: T;
    fixturesFittingsToolsAndEquipment: T;
    biologicalAssets: T;
    leaseholdImprovements: T;
    ships: T;
    planes: T;
    rightOfUseAssets: T;
    propertyPlantAndEquipmentInProgressAndPrepaymentsForPropertyPlantAndEquipment: T;
    propertyPlantAndEquipmentInProgress: T;
    prepaymentsForPropertyPlantAndEquipment: T;
    longtermInvestmentsAndReceivables: T;
    longtermInvestmentsInGroupEnterprises: T;
    shorttermInvestmentsInAssociates: T;
    longtermInvestmentsInAssociates: T;
    longtermParticipatingInterests: T;
    longtermInvestmentsInJointVentures: T;
    longtermReceivablesFromGroupEnterprises: T;
    longtermReceivablesFromAssociates: T;
    longtermReceivablesFromParticipatingInterests: T;
    longtermReceivablesFromJointVentures: T;
    longtermReceivablesFromOwnersOtherCompanies: T;
    otherLongtermInvestments: T;
    otherLongtermReceivables: T;
    longtermReceivablesFromOwnersAndManagement: T;
    nonCurrentDeferredTaxAssets: T;
    depositsLongtermInvestmentsAndReceivables: T;
    costExceedsIncomeForTheFinancialYearLongtermReceivables: T;
    contributedCapitalInArrearsLongTerm: T;
    nonCurrentContractAssets: T;
    currentAssets: T;
    inventories: T;
    rawMaterialsAndConsumables: T;
    workInProgress: T;
    manufacturedGoodsAndGoodsForResale: T;
    prepaymentsForGoods: T;
    livestock: T;
    propertyHeldForSaleInTheOrdinaryCourseOfBusiness: T;
    assetsHeldForSaleInventories: T;
    shorttermReceivables: T;
    shorttermTradeReceivables: T;
    contractWorkInProgress: T;
    shorttermReceivablesFromGroupEnterprises: T;
    shorttermReceivablesFromAssociates: T;
    shorttermReceivablesFromJointVentures: T;
    shorttermReceivablesFromParticipatingInterests: T;
    shorttermReceivablesDividendsFromGroupEnterprises: T;
    shorttermReceivablesDividendsFromAssociates: T;
    shorttermReceivablesDividendsFromJointVentures: T;
    shorttermReceivablesDividendsFromParticipatingInterests: T;
    currentDeferredTaxAssets: T;
    shorttermTaxReceivables: T;
    shorttermTaxReceivablesFromGroupEnterprises: T;
    vatAndDutiesReceivables: T;
    otherShorttermReceivables: T;
    contributedCapitalInArrears: T;
    shorttermReceivablesFromOwnersAndManagement: T;
    deferredIncomeAssets: T;
    costExceedsIncomeForTheFinancialYearShorttermReceivables: T;
    timingDifferencesShorttermReceivablesEspeciallyUtilities: T;
    currentContractAssets: T;
    derivativeFinancialInstrumentsShorttermAssets: T;
    derivativeFinancialInstrumentsAssets: T;
    shorttermInvestments: T;
    otherShorttermPayables: T;
    shorttermInvestmentsInGroupEnterprises: T;
    otherShorttermInvestments: T;
    cashAndCashEquivalents: T;
    assetsMeantForSale: T;
    liabilitiesAndEquity: T;
    equity: T;
    contributedCapital: T;
    paidContributedCapital: T;
    sharePremium: T;
    revaluationReserve: T;
    otherReserves: T;
    reserveForNetRevaluationAccordingToEquityMethod: T;
    reserveForLoansAndCollaterals: T;
    reserveForUnpaidContributedCapital: T;
    reserveForEntrepreneurialCompany: T;
    reserveForDevelopmentExpenditure: T;
    reserveForNetRevaluationOfInvestmentAssets: T;
    reserveForCurrentValueAdjustmentsOfCurrencyGains: T;
    reserveForCurrentValueOfHedging: T;
    otherStatutoryReserves: T;
    reserveAccordingToArticlesOfAssociation: T;
    reserveForBiologicalAssets: T;
    restOfOtherReserves: T;
    retainedEarnings: T;
    distributions: T;
    proposedDividendRecognisedInEquity: T;
    proposedExtraordinaryDividendRecognisedInEquity: T;
    notPaidContributedCapital: T;
    hedgeFund: T;
    reserveFund: T;
    transferredToFromReservesAvailable: T;
    liquidationAccount: T;
    actuarialProfitLossWhichIsAPartOfTheCalculationOfContingentPensions: T;
    equityAttributableToParent: T;
    minorityInterests: T;
    provisions: T;
    provisionsForPensionsAndSimilarLiabilities: T;
    provisionsForDeferredTax: T;
    otherProvisions: T;
    provisionsForInvestmentsInGroupEnterprises: T;
    provisionsForInvestmentsInGroupAssociates: T;
    provisionsForInvestmentsInParticipatingInterests: T;
    provisionsForInvestmentsInJointVentures: T;
    provisionsForIncomeExceedCostForTheFinancialYear: T;
    timingDifferencesProvisionsEspeciallyUtilities: T;
    liabilitiesOtherThanProvisions: T;
    debtToCreditInstitutions: T;
    longtermDebtToCreditInstitutions: T;
    shorttermDebtToCreditInstitutions: T;
    mortgageDebt: T;
    longtermMortgageDebt: T;
    shorttermMortgageDebt: T;
    debtToBanks: T;
    longtermDebtToBanks: T;
    shorttermDebtToBanks: T;
    otherDebtRaisedByIssuanceOfBonds: T;
    otherLongtermDebtRaisedByIssuanceOfBonds: T;
    otherShorttermDebtRaisedByIssuanceOfBonds: T;
    debtToOtherCreditInstitutions: T;
    longtermDebtToOtherCreditInstitutions: T;
    shorttermDebtToOtherCreditInstitutions: T;
    convertibleProfitYieldingOrDividendYieldingDebtInstruments: T;
    convertibleProfitYieldingOrDividendYieldingLongtermDebtInstruments: T;
    convertibleProfitYieldingOrDividendYieldingShorttermDebtInstruments: T;
    prepaymentsReceivedFromCustomers: T;
    longtermPrepaymentsReceivedFromCustomers: T;
    shorttermPrepaymentsReceivedFromCustomers: T;
    tradePayables: T;
    longtermTradePayables: T;
    shorttermTradePayables: T;
    billsOfExchangePayable: T;
    shorttermBillsOfExchangePayable: T;
    longtermBillsOfExchangePayable: T;
    payablesToGroupEnterprises: T;
    longtermPayablesToGroupEnterprises: T;
    shorttermPayablesToGroupEnterprises: T;
    payablesToAssociates: T;
    longtermPayablesToAssociates: T;
    shorttermPayablesToAssociates: T;
    payablesToParticipatingInterests: T;
    longtermPayablesToParticipatingInterests: T;
    shorttermPayablesToParticipatingInterest: T;
    payablesToJointVentures: T;
    shorttermPayablesToJointVentures: T;
    longtermPayablesToJointVentures: T;
    shorttermPayablesToOwnersOtherCompanies: T;
    longtermLPayablesToOwnersOtherCompanies: T;
    taxPayables: T;
    longtermTaxPayables: T;
    shorttermTaxPayables: T;
    taxPayablesToGroupEnterprises: T;
    longtermTaxPayablesToGroupEnterprises: T;
    shorttermTaxPayablesToGroupEnterprises: T;
    vatAndDutiesPayables: T;
    otherPayablesIncludingTaxPayables: T;
    otherPayablesIncludingTaxPayablesLiabilitiesOtherThanProvisionsShortterm: T;
    otherPayablesIncludingTaxPayablesLiabilitiesOtherThanProvisionsLongterm: T;
    holidayAllowance: T;
    holidayAllowanceLiabilitiesShortterm: T;
    holidayAllowanceLiabilitiesLongterm: T;
    deferredIncome: T;
    longtermDeferredIncome: T;
    shorttermDeferredIncome: T;
    negativeGoodwill: T;
    longtermNegativeGoodwill: T;
    shorttermNegativeGoodwill: T;
    leaseCommitments: T;
    longtermLeaseCommitments: T;
    shorttermLeaseCommitments: T;
    proposedDividend: T;
    shorttermPartOfLongtermLiabilitiesOtherThanProvisions: T;
    longtermLiabilitiesOtherThanProvisions: T;
    shorttermLiabilitiesOtherThanProvisions: T;
    equityLoan: T;
    shorttermEquityLoan: T;
    longtermEquityLoan: T;
    payablesToShareholdersAndManagement: T;
    shorttermPayablesToShareholdersAndManagement: T;
    longtermPayablesToShareholdersAndManagement: T;
    prepaymentsOfWorkInProgress: T;
    shorttermPrepaymentsOfWorkInProgress: T;
    longtermPrepaymentsOfWorkInProgress: T;
    contractWorkInProgressLiabilities: T;
    shorttermContractWorkInProgressLiabilities: T;
    longtermContractWorkInProgressLiabilities: T;
    derivativeFinancialInstrumentsLiabilities: T;
    shortermDerivativeFinancialInstrumentsLiabilities: T;
    longtermDerivativeFinancialInstrumentsLiabilities: T;
    depositsLiabilitiesOtherThanProvisions: T;
    depositsShorttermLiabilitiesOtherThanProvisions: T;
    depositsLongtermLiabilitiesOtherThanProvisions: T;
    incomeExceedCostForTheFinancialYear: T;
    incomeExceedCostForTheFinancialYearShortterm: T;
    incomeExceedCostForTheFinancialYearLongterm: T;
    contractLiabilities: T;
    noncurrentContractLiabilities: T;
    currentContractLiabilities: T;
    liabilitiesRelatedToAssetsMeantForSale: T;
    pensionsAndSimilarLiabilitiesLiabilitiesLongterm: T;
    pensionsAndSimilarLiabilitiesLiabilitiesShortterm: T;
    timingDifferencesProvisionsEspeciallyUtilitiesLiabilitiesLongterm: T;
    timingDifferencesProvisionsEspeciallyUtilitiesLiabilitiesShortterm: T;
    otherProvisionsLiabilitiesLongterm: T;
    otherProvisionsLiabilitiesShortterm: T;
    provisionsForInvestmentsInGroupEnterprisesLiabilitiesLongterm: T;
    provisionsForInvestmentsInGroupAssociatesLiabilitiesLongterm: T;
    provisionsForInvestmentsInParticipatingInterestsLiabilitiesLongterm: T;
    provisionsForInvestmentsInParticipatingInterestsLiabilitiesShortterm: T;
    provisionsForInvestmentsInJointVenturesLiabilitiesLongterm: T;
    provisionsForInvestmentsInJointVenturesLiabilitiesShortterm: T;
    provisionsForOverfundingForReportingPeriodLiabilitiesLongterm: T;
    provisionsForOverfundingForReportingPeriodLiabilitiesShortterm: T;
    provisionsForInvestmentsInGroupEnterprisesLiabilitiesShortterm: T;
    provisionsForInvestmentsInGroupAssociatesLiabilitiesShortterm: T;
    deferredTaxLiabilitiesLongterm: T;
}

export interface IncomeStatement<T> {
    revenue: T;
    costOfSales: T;
    changeInInventoriesOfFinishedGoodsWorkInProgressAndGoodsForResale: T;
    workPerformedByEntityAndCapitalised: T;
    costOfProduction: T;
    otherOperatingIncome: T;
    propertyCost: T;
    grossResult: T;
    grossProfitLoss: T;
    distributionCosts: T;
    administrativeExpenses: T;
    employeeBenefitsExpense: T;
    wagesAndSalaries: T;
    postemploymentBenefitExpense: T;
    socialSecurityContributions: T;
    employeeExpensesTransferredToAssets: T;
    otherEmployeeExpense: T;
    depreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss: T;
    writedownsOfCurrentAssetsOtherThanCurrentFinancialAssets: T;
    writedownsOfCurrentAssetsThatExceedNormalWritedowns: T;
    externalExpenses: T;
    rawMaterialsAndConsumablesUsed: T;
    otherExternalExpenses: T;
    otherOperatingExpenses: T;
    incomeFromNegativeGoodwill: T;
    profitLossFromOrdinaryOperatingActivitiesBeforeGainsLossesFromFairValueAdjustments: T;
    gainsLossesFromCurrentValueAdjustmentsOfInvestmentAssets: T;
    gainsLossesFromCurrentValueAdjustmentsOfInvestmentProperty: T;
    gainsLossesFromCurrentValueAdjustmentsOfOtherInvestmentAssets: T;
    gainsLossesFromCurrentValueAdjustmentsOfBiologicalAssets: T;
    gainsLossesFromCurrentValueAdjustmentsOfDebtLiabilities: T;
    gainsLossesFromCurrentValueAdjustmentsOfDebtLiabilitiesConcerningInvestmentProperty: T;
    gainsLossesFromCurrentValueAdjustmentsOfDebtLiabilitiesConcerningOtherInvestmentAssets: T;
    researchAndDevelopmentExpenditure: T;
    researchExpenditure: T;
    developmentExpenditure: T;
    profitLossFromOrdinaryOperatingActivities: T;
    extraordinaryIncome: T;
    extraordinaryExpenses: T;
    extraordinaryProfitLossBeforeTax: T;
    taxExpenseOnExtraordinaryEvents: T;
    extraordinaryProfitLossAfterTax: T;
    incomeFromInvestmentsInGroupEnterprisesAndAssociates: T;
    incomeFromInvestmentsInGroupEnterprises: T;
    incomeFromInvestmentsInAssociates: T;
    incomeFromInvestmentsInParticipatingInterests: T;
    incomeFromInvestmentsInJointVentures: T;
    incomeFromOtherLongtermInvestmentsAndReceivables: T;
    otherFinanceIncomeFromGroupEnterprises: T;
    otherFinanceIncome: T;
    impairmentOfFinancialAssets: T;
    otherFinanceExpenses: T;
    financeExpensesArisingFromGroupEnterprises: T;
    restOfOtherFinanceExpenses: T;
    profitLossFromOrdinaryActivitiesBeforeTax: T;
    profitLossFromOrdinaryActivitiesAfterTax: T;
    taxExpenseOnOrdinaryActivities: T;
    taxExpense: T;
    otherTaxExpenses: T;
    profitLossFromDiscontinuedOperations: T;
    profitLossFromContinuingOperations: T;
    profitLoss: T;
    profitLossAttributableToMinorityInterest: T;
    profitLossAfterAttributableToMinorityInterest: T;
}

enum DocumentType {
    "KONCERNREGNSKAB" = "KONCERNREGNSKAB",
    "AARSRAPPORT" = "AARSRAPPORT",
    "AARSRAPPORT_ESEF" = "AARSRAPPORT_ESEF",
    "AFSLUTTENDE_LIKVIDATIONSREGNSKAB" = "AFSLUTTENDE_LIKVIDATIONSREGNSKAB",
    "INDLEDENDE_LIKVIDATIONSREGNSKAB" = "INDLEDENDE_LIKVIDATIONSREGNSKAB",
    "DELAARSRAPPORT" = "DELAARSRAPPORT",
    "HALVAARSRAPPORT" = "HALVAARSRAPPORT",
    "DELAARSRAPPORT_ESEF" = "DELAARSRAPPORT_ESEF",
    "HALVAARSRAPPORT_ESEF" = "HALVAARSRAPPORT_ESEF",
}

export type BatchAnnualReportResult = {
    cvrNumber: string;
    status: "failed" | "success" | "error";
    total: number;
    results: AnnualReportResponse["results"];
    /** Per-document failures for THIS company (e.g. unknown taxonomy for one year). */
    skipped: ReportSkip[];
    /** Set when the whole company failed (e.g. upstream unavailable). */
    errorCode?: ErrorCode;
    message?: string;
};

export type BatchAnnualReportResponse = {
    total: number;
    status: "success" | "partial" | "error";
    results: BatchAnnualReportResult[];
};
