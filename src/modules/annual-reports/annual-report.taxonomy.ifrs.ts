import ifrsConcepts from "./ifrs-concepts.json" with { type: "json" };
import type { BalanceSheet, IncomeStatement, Notes, ReportingPeriod, TaxonomyFact } from "./annual-report.types.js";

/**
 * IFRS mapping onto the ÅRL field structure.
 *
 * Every key is an ÅRL field of the API response; the value lists the IFRS
 * concepts that carry that figure, in order of preference — the first one that
 * is tagged for the period wins. Keys without an IFRS counterpart are simply
 * absent, so an IFRS report never invents a figure. Two namespaces are used:
 *
 * - `ifrs-full` — the IFRS Foundation taxonomy that both the Danish IFRS
 *   taxonomy (IFRS-DK, all versions on ifrs-full 2014-03-05) and ESEF (a new
 *   ifrs-full version each year) build on. The namespace URI carries the
 *   version date, so it is matched by pattern in XBRLDocument.
 * - `ifrs-dk` — Erhvervsstyrelsen's Danish additions (227 concepts), only in
 *   IFRS-DK filings from before the 2025 switch to ESEF. They cover the
 *   Danish group vocabulary (receivables from and payables to subsidiaries,
 *   net sales, gross result) that ifrs-full lacks.
 *
 * Labels and balance attributes come from ifrs-concepts.json, generated from
 * the taxonomy packages by scripts/build-ifrs-concepts.ts; a concept named
 * here but missing from that file fails at startup rather than silently.
 *
 * Sources: docs/taksonomier-aarl-ifrs-esef.md §8 and the reading notes.
 */
export const IFRS_CONCEPTS: {
    reportingPeriod: Record<keyof ReportingPeriod<unknown>, string[]>;
    notes: Partial<Record<keyof Notes<unknown>, string[]>>;
    balanceSheet: Partial<Record<keyof BalanceSheet<unknown>, string[]>>;
    incomeStatement: Partial<Record<keyof IncomeStatement<unknown>, string[]>>;
} = {
    reportingPeriod: {
        // IFRS-DK filings carry the ÅRL general data; ESEF instances carry neither,
        // so the period then comes from the contexts (see XBRLDocument.inferReportingPeriod).
        reportingPeriodStartDate: ["gsd:ReportingPeriodStartDate"],
        reportingPeriodEndDate: ["gsd:ReportingPeriodEndDate", "ifrs-full:DateOfEndOfReportingPeriod2013"],
    },
    notes: {
        amortisationOfIntangibleAssets: ["ifrs-full:AmortisationIntangibleAssetsOtherThanGoodwill"],
        impairmentLossesOfIntangibleAssets: ["ifrs-full:ImpairmentLossRecognisedInProfitOrLossIntangibleAssetsOtherThanGoodwill"],
        averageNumberOfEmployees: ["ifrs-full:AverageNumberOfEmployees"],
    },
    balanceSheet: {
        assets: ["ifrs-full:Assets"],
        nonCurrentAssets: ["ifrs-full:NoncurrentAssets"],
        intangibleAssets: ["ifrs-full:IntangibleAssetsAndGoodwill", "ifrs-full:IntangibleAssetsOtherThanGoodwill"],
        goodwill: ["ifrs-full:Goodwill"],
        developmentProjectsInProgress: ["ifrs-full:IntangibleAssetsUnderDevelopment"],
        propertyPlantAndEquipment: ["ifrs-full:PropertyPlantAndEquipment"],
        landAndBuildings: ["ifrs-full:LandAndBuildings"],
        land: ["ifrs-full:Land"],
        buildings: ["ifrs-full:Buildings"],
        investmentProperty: ["ifrs-full:InvestmentProperty"],
        plantAndMachinery: ["ifrs-dk:PlantAndMachinery", "ifrs-full:Machinery"],
        fixturesFittingsToolsAndEquipment: ["ifrs-dk:OtherPlantFixturesAndFittingsToolsAndEquipment", "ifrs-full:FixturesAndFittings"],
        biologicalAssets: ["ifrs-full:BiologicalAssets"],
        leaseholdImprovements: ["ifrs-dk:LeaseholdImprovements"],
        ships: ["ifrs-full:Ships"],
        planes: ["ifrs-full:Aircraft"],
        rightOfUseAssets: ["ifrs-full:RightofuseAssets"],
        propertyPlantAndEquipmentInProgress: ["ifrs-dk:PropertyPlantAndEquipmentInProgress", "ifrs-full:ConstructionInProgress"],
        prepaymentsForPropertyPlantAndEquipment: ["ifrs-dk:PrepaymentsForPropertyPlantAndEquipment"],
        propertyPlantAndEquipmentInProgressAndPrepaymentsForPropertyPlantAndEquipment: [
            "ifrs-dk:PropertyPlantAndEquipmentInProgressAndPrepaymentsForPropertyPlantAndEquipment",
        ],
        longtermInvestmentsInGroupEnterprises: ["ifrs-full:InvestmentsInSubsidiaries"],
        longtermInvestmentsInAssociates: [
            "ifrs-full:InvestmentsInAssociates",
            "ifrs-full:InvestmentsInAssociatesAccountedForUsingEquityMethod",
        ],
        longtermInvestmentsInJointVentures: [
            "ifrs-full:InvestmentsInJointVentures",
            "ifrs-full:InvestmentsInJointVenturesAccountedForUsingEquityMethod",
        ],
        longtermReceivablesFromGroupEnterprises: ["ifrs-full:NoncurrentReceivablesDueFromRelatedParties"],
        longtermReceivablesFromAssociates: ["ifrs-dk:NoncurrentReceivablesFromAssociates"],
        longtermReceivablesFromJointVentures: ["ifrs-dk:NoncurrentReceivablesFromJointVentures"],
        otherLongtermInvestments: [
            "ifrs-full:NoncurrentInvestmentsOtherThanInvestmentsAccountedForUsingEquityMethod",
            "ifrs-dk:NoncurrentInvestments",
            "ifrs-full:OtherNoncurrentFinancialAssets",
        ],
        otherLongtermReceivables: ["ifrs-full:OtherNoncurrentReceivables"],
        nonCurrentDeferredTaxAssets: ["ifrs-full:DeferredTaxAssets"],
        nonCurrentContractAssets: ["ifrs-full:NoncurrentContractAssets"],
        currentAssets: ["ifrs-full:CurrentAssets"],
        inventories: ["ifrs-full:Inventories"],
        rawMaterialsAndConsumables: ["ifrs-full:CurrentRawMaterialsAndCurrentProductionSupplies", "ifrs-full:RawMaterials"],
        workInProgress: ["ifrs-full:WorkInProgress"],
        manufacturedGoodsAndGoodsForResale: ["ifrs-full:FinishedGoods", "ifrs-full:Merchandise"],
        shorttermReceivables: ["ifrs-full:TradeAndOtherCurrentReceivables"],
        shorttermTradeReceivables: ["ifrs-full:CurrentTradeReceivables"],
        contractWorkInProgress: ["ifrs-dk:ConstructionContracts"],
        currentContractAssets: ["ifrs-full:CurrentContractAssets"],
        shorttermReceivablesFromGroupEnterprises: [
            "ifrs-dk:CurrentReceivablesFromSubsidaries",
            "ifrs-full:TradeAndOtherCurrentReceivablesDueFromRelatedParties",
        ],
        shorttermReceivablesFromAssociates: ["ifrs-dk:CurrentReceivablesFromAssociates"],
        shorttermReceivablesFromJointVentures: ["ifrs-dk:CurrentReceivablesFromJointVentures"],
        shorttermTaxReceivables: ["ifrs-full:CurrentTaxAssetsCurrent"],
        otherShorttermReceivables: ["ifrs-full:OtherCurrentReceivables"],
        deferredIncomeAssets: ["ifrs-full:CurrentPrepaymentsAndCurrentAccruedIncomeOtherThanCurrentContractAssets", "ifrs-full:CurrentPrepayments"],
        derivativeFinancialInstrumentsShorttermAssets: ["ifrs-full:CurrentDerivativeFinancialAssets"],
        derivativeFinancialInstrumentsAssets: ["ifrs-full:DerivativeFinancialAssets"],
        shorttermInvestments: ["ifrs-dk:CurrentSecurities", "ifrs-full:OtherCurrentFinancialAssets"],
        cashAndCashEquivalents: ["ifrs-full:CashAndCashEquivalents", "ifrs-full:Cash"],
        assetsMeantForSale: ["ifrs-full:NoncurrentAssetsOrDisposalGroupsClassifiedAsHeldForSale"],
        liabilitiesAndEquity: ["ifrs-full:EquityAndLiabilities"],
        equity: ["ifrs-full:Equity"],
        contributedCapital: ["ifrs-full:IssuedCapital"],
        sharePremium: ["ifrs-full:SharePremium"],
        revaluationReserve: ["ifrs-full:RevaluationSurplus"],
        otherReserves: ["ifrs-full:OtherReserves"],
        reserveForCurrentValueOfHedging: ["ifrs-full:ReserveOfCashFlowHedges"],
        retainedEarnings: ["ifrs-full:RetainedEarnings"],
        equityAttributableToParent: ["ifrs-full:EquityAttributableToOwnersOfParent"],
        minorityInterests: ["ifrs-full:NoncontrollingInterests"],
        // IFRS has no "hensatte forpligtelser" total that includes deferred tax, so the
        // ÅRL split provisions / other liabilities cannot be reproduced. Total
        // liabilities go on liabilitiesOtherThanProvisions (label says so), which keeps
        // the identity assets = equity + liabilities intact; the provision lines below
        // are informational.
        liabilitiesOtherThanProvisions: ["ifrs-full:Liabilities"],
        longtermLiabilitiesOtherThanProvisions: ["ifrs-full:NoncurrentLiabilities"],
        shorttermLiabilitiesOtherThanProvisions: ["ifrs-full:CurrentLiabilities"],
        provisionsForDeferredTax: ["ifrs-full:DeferredTaxLiabilities"],
        otherProvisions: ["ifrs-full:OtherProvisions"],
        otherProvisionsLiabilitiesLongterm: ["ifrs-full:OtherLongtermProvisions"],
        otherProvisionsLiabilitiesShortterm: ["ifrs-full:OtherShorttermProvisions"],
        provisionsForPensionsAndSimilarLiabilities: ["ifrs-full:NoncurrentRecognisedLiabilitiesDefinedBenefitPlan", "ifrs-full:RecognisedLiabilitiesDefinedBenefitPlan"],
        debtToCreditInstitutions: ["ifrs-full:Borrowings"],
        longtermDebtToCreditInstitutions: ["ifrs-full:LongtermBorrowings"],
        shorttermDebtToCreditInstitutions: ["ifrs-full:ShorttermBorrowings"],
        mortgageDebt: ["ifrs-dk:MortgageDebt"],
        longtermMortgageDebt: ["ifrs-dk:NoncurrentMortgageDebt"],
        shorttermMortgageDebt: ["ifrs-dk:CurrentMortgageDebt"],
        debtToBanks: ["ifrs-dk:BankLoans"],
        longtermDebtToBanks: ["ifrs-dk:NoncurrentBankLoans"],
        shorttermDebtToBanks: ["ifrs-dk:CurrentBankLoans"],
        otherDebtRaisedByIssuanceOfBonds: ["ifrs-dk:BondLoans"],
        otherLongtermDebtRaisedByIssuanceOfBonds: ["ifrs-dk:NoncurrentBonds"],
        otherShorttermDebtRaisedByIssuanceOfBonds: ["ifrs-dk:CurrentBondLoans"],
        tradePayables: ["ifrs-full:TradeAndOtherPayablesToTradeSuppliers"],
        shorttermTradePayables: ["ifrs-full:TradeAndOtherCurrentPayablesToTradeSuppliers"],
        longtermTradePayables: ["ifrs-full:NoncurrentPayablesToTradeSuppliers"],
        payablesToGroupEnterprises: ["ifrs-dk:TradeAndOtherPayablesToSubsidiaries"],
        shorttermPayablesToGroupEnterprises: [
            "ifrs-dk:TradeAndOtherCurrentPayablesToSubsidiaries",
            "ifrs-full:TradeAndOtherCurrentPayablesToRelatedParties",
        ],
        longtermPayablesToGroupEnterprises: ["ifrs-dk:NoncurrentPayablesToSubsidiaries", "ifrs-full:NoncurrentPayablesToRelatedParties"],
        payablesToAssociates: ["ifrs-dk:TradeAndOtherPayablesToAssociates"],
        shorttermPayablesToAssociates: ["ifrs-dk:TradeAndOtherCurrentPayablesToAssociates"],
        longtermPayablesToAssociates: ["ifrs-dk:NoncurrentPayablesToAssociates"],
        payablesToJointVentures: ["ifrs-dk:TradeAndOtherPayablesToJointVentures"],
        shorttermPayablesToJointVentures: ["ifrs-dk:TradeAndOtherCurrentPayablesToJointVentures"],
        longtermPayablesToJointVentures: ["ifrs-dk:NoncurrentPayablesToJointVentures"],
        payablesToShareholdersAndManagement: ["ifrs-dk:TradeAndOtherPayablesToShareholdersAndManagement"],
        shorttermPayablesToShareholdersAndManagement: ["ifrs-dk:TradeandOtherCurrentPayablesToShareholdersAndManagement"],
        longtermPayablesToShareholdersAndManagement: ["ifrs-dk:NonCurrentPayablesToShareholdersAndManagement"],
        taxPayables: ["ifrs-full:CurrentTaxLiabilities"],
        shorttermTaxPayables: ["ifrs-full:CurrentTaxLiabilitiesCurrent"],
        longtermTaxPayables: ["ifrs-full:CurrentTaxLiabilitiesNoncurrent"],
        otherPayablesIncludingTaxPayablesLiabilitiesOtherThanProvisionsShortterm: ["ifrs-full:OtherCurrentPayables"],
        otherPayablesIncludingTaxPayablesLiabilitiesOtherThanProvisionsLongterm: ["ifrs-full:OtherNoncurrentPayables"],
        deferredIncome: ["ifrs-full:DeferredIncome"],
        shorttermDeferredIncome: ["ifrs-full:DeferredIncomeClassifiedAsCurrent"],
        longtermDeferredIncome: ["ifrs-full:DeferredIncomeClassifiedAsNoncurrent"],
        leaseCommitments: ["ifrs-full:LeaseLiabilities"],
        shorttermLeaseCommitments: ["ifrs-full:CurrentLeaseLiabilities"],
        longtermLeaseCommitments: ["ifrs-full:NoncurrentLeaseLiabilities"],
        contractLiabilities: ["ifrs-full:ContractLiabilities"],
        currentContractLiabilities: ["ifrs-full:CurrentContractLiabilities"],
        noncurrentContractLiabilities: ["ifrs-full:NoncurrentContractLiabilities"],
        derivativeFinancialInstrumentsLiabilities: ["ifrs-full:DerivativeFinancialLiabilities"],
        shortermDerivativeFinancialInstrumentsLiabilities: ["ifrs-full:CurrentDerivativeFinancialLiabilities"],
        longtermDerivativeFinancialInstrumentsLiabilities: ["ifrs-full:NoncurrentDerivativeFinancialLiabilities"],
        prepaymentsReceivedFromCustomers: ["ifrs-dk:CurrentPrepaymentsFromCustomers"],
        liabilitiesRelatedToAssetsMeantForSale: ["ifrs-full:LiabilitiesIncludedInDisposalGroupsClassifiedAsHeldForSale"],
    },
    incomeStatement: {
        revenue: ["ifrs-full:Revenue", "ifrs-dk:NetSales"],
        costOfSales: ["ifrs-full:CostOfSales"],
        changeInInventoriesOfFinishedGoodsWorkInProgressAndGoodsForResale: [
            "ifrs-full:ChangesInInventoriesOfFinishedGoodsAndWorkInProgress",
        ],
        workPerformedByEntityAndCapitalised: ["ifrs-full:OtherWorkPerformedByEntityAndCapitalised"],
        otherOperatingIncome: ["ifrs-full:OtherIncome", "ifrs-full:OtherOperatingIncomeExpense"],
        grossResult: ["ifrs-dk:GrossResult"],
        grossProfitLoss: ["ifrs-full:GrossProfit"],
        distributionCosts: ["ifrs-full:DistributionCosts", "ifrs-dk:SalesCostAndDistributionsCosts"],
        administrativeExpenses: ["ifrs-full:AdministrativeExpense"],
        employeeBenefitsExpense: ["ifrs-full:EmployeeBenefitsExpense"],
        wagesAndSalaries: ["ifrs-full:WagesAndSalaries"],
        postemploymentBenefitExpense: ["ifrs-full:PostemploymentBenefitExpenseInProfitOrLoss"],
        socialSecurityContributions: ["ifrs-full:SocialSecurityContributions"],
        otherEmployeeExpense: ["ifrs-full:OtherEmployeeExpense"],
        depreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss: [
            "ifrs-dk:DepreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss",
            "ifrs-full:DepreciationAmortisationAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss",
            "ifrs-full:DepreciationAndAmortisationExpense",
        ],
        externalExpenses: ["ifrs-dk:ExternalExpenses"],
        otherExternalExpenses: ["ifrs-dk:OtherExternalExpenses"],
        rawMaterialsAndConsumablesUsed: ["ifrs-full:RawMaterialsAndConsumablesUsed"],
        otherOperatingExpenses: ["ifrs-full:OtherExpenseByNature", "ifrs-full:OtherExpenseByFunction"],
        profitLossFromOrdinaryOperatingActivities: ["ifrs-full:ProfitLossFromOperatingActivities"],
        gainsLossesFromCurrentValueAdjustmentsOfInvestmentProperty: [
            "ifrs-full:GainsLossesOnFairValueAdjustmentInvestmentProperty",
        ],
        researchAndDevelopmentExpenditure: ["ifrs-full:ResearchAndDevelopmentExpense"],
        researchExpenditure: ["ifrs-dk:ResearchExpenditure"],
        developmentExpenditure: ["ifrs-dk:DevelopmentExpenditure"],
        incomeFromInvestmentsInGroupEnterprisesAndAssociates: [
            "ifrs-dk:ProfitLossInSubsidiariesJointVenturesAndAssociates",
            "ifrs-dk:GainsLossesFromSubsidiariesJointVenturesAndAssociates",
        ],
        incomeFromInvestmentsInGroupEnterprises: ["ifrs-dk:ProfitLossInSubsidiaries"],
        incomeFromInvestmentsInAssociates: [
            "ifrs-dk:ProfitLossInAssociates",
            "ifrs-full:ShareOfProfitLossOfAssociatesAccountedForUsingEquityMethod",
            "ifrs-full:ShareOfProfitLossOfAssociatesAndJointVenturesAccountedForUsingEquityMethod",
        ],
        incomeFromInvestmentsInJointVentures: [
            "ifrs-dk:ProfitLossInJointVentures",
            "ifrs-full:ShareOfProfitLossOfJointVenturesAccountedForUsingEquityMethod",
        ],
        otherFinanceIncome: ["ifrs-full:FinanceIncome"],
        impairmentOfFinancialAssets: ["ifrs-dk:ImpairmentOfFinancialAssets", "ifrs-full:ImpairmentLossOnFinancialAssets"],
        otherFinanceExpenses: ["ifrs-full:FinanceCosts"],
        profitLossFromOrdinaryActivitiesBeforeTax: ["ifrs-full:ProfitLossBeforeTax"],
        taxExpense: ["ifrs-full:IncomeTaxExpenseContinuingOperations"],
        profitLossFromContinuingOperations: ["ifrs-full:ProfitLossFromContinuingOperations"],
        profitLossFromDiscontinuedOperations: ["ifrs-full:ProfitLossFromDiscontinuedOperations"],
        profitLoss: ["ifrs-full:ProfitLoss"],
        profitLossAttributableToMinorityInterest: ["ifrs-full:ProfitLossAttributableToNoncontrollingInterests"],
        profitLossAfterAttributableToMinorityInterest: ["ifrs-full:ProfitLossAttributableToOwnersOfParent"],
    },
};

/**
 * Group-structure facts in IFRS instances: one entity per member on the
 * subsidiaries/associates/joint-ventures axes, all facts sharing the member.
 * The ownership share is a decimal fraction (0.6 = 60 %) in ifrs-full.
 */
export const IFRS_GROUP_ENTITY_CONCEPTS = {
    subsidiary: {
        name: "ifrs-full:NameOfSubsidiary",
        ownership: "ifrs-full:ProportionOfOwnershipInterestInSubsidiary",
        country: "ifrs-full:CountryOfIncorporationOrResidenceOfSubsidiary",
        place: "ifrs-full:PrincipalPlaceOfBusinessOfSubsidiary",
    },
    associate: {
        name: "ifrs-full:NameOfAssociate",
        ownership: "ifrs-full:ProportionOfOwnershipInterestInAssociate",
        country: "ifrs-full:CountryOfIncorporationOrResidenceOfAssociate",
        place: "ifrs-full:PrincipalPlaceOfBusinessOfAssociate",
    },
    jointVenture: {
        name: "ifrs-full:NameOfJointVenture",
        ownership: "ifrs-full:ProportionOfOwnershipInterestInJointVenture",
        votingRights: "ifrs-full:ProportionOfVotingRightsHeldInJointVenture",
        country: "ifrs-full:CountryOfIncorporationOfJointVenture",
        place: "ifrs-full:PrincipalPlaceOfBusinessOfJointVenture",
    },
} as const;

type ConceptMetadata = { label: string; balance?: "debit" | "credit"; periodType?: "instant" | "duration" };

const metadata = ifrsConcepts as Record<string, ConceptMetadata>;

/** Turns "ifrs-full:Assets" into the TaxonomyFact the extractor reads, with label and balance from the packages. */
export function ifrsFact(qname: string): TaxonomyFact {
    const [namespace, name] = qname.split(":");
    const meta = metadata[qname];
    if (!meta) {
        throw new Error(`IFRS concept ${qname} is not in ifrs-concepts.json; run scripts/build-ifrs-concepts.ts`);
    }
    return {
        name,
        namespace: namespace === "gsd" ? "http://xbrl.dcca.dk/gsd" : namespace,
        label: meta.label,
        ...(meta.balance ? { balance: meta.balance } : {}),
    };
}

/** Every mapped concept as a list of candidate facts per ÅRL key, ready for XBRLDocument. */
function toFacts<K extends string>(section: Partial<Record<K, string[]>>): Partial<Record<K, TaxonomyFact[]>> {
    const out: Partial<Record<K, TaxonomyFact[]>> = {};
    for (const key of Object.keys(section) as K[]) {
        out[key] = section[key]!.map(ifrsFact);
    }
    return out;
}

const IFRS_TAXONOMY = {
    body: {
        reportingPeriod: toFacts(IFRS_CONCEPTS.reportingPeriod) as ReportingPeriod<TaxonomyFact[]>,
        notes: toFacts(IFRS_CONCEPTS.notes),
        balanceSheet: toFacts(IFRS_CONCEPTS.balanceSheet),
        incomeStatement: toFacts(IFRS_CONCEPTS.incomeStatement),
    },
};

export default IFRS_TAXONOMY;
