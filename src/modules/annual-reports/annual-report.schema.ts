import { z } from "@hono/zod-openapi";

export const paramSchema = z.object({
    cvrNumber: z.coerce
        .string({
            error: (issue) => {
                if (issue.input === undefined) {
                    return { message: "CVR-nummeret må ikke være tomt." };
                }
                return { message: "CVR-nummeret skal være en streng." };
            },
        })
        .length(8, {
            error: (issue) => {
                return { message: `CVR-nummeret skal have præcis 8 cifre. Du angav ${issue.input}` };
            },
        })
        .openapi({
            description: "CVR-nummeret for det selskab, hvis årsrapporter skal hentes.",
            example: "12345678",
            param: {
                in: "path",
                name: "cvrNumber",
                required: true,
            },
        }),
});

const accountSchema = z.object({
    value: z.number().openapi({
        description: "Værdien af kontoen.",
        example: 1000000,
    }),
    unit: z.string().openapi({
        description: "Enheden for værdien, f.eks. DKK.",
        example: "DKK",
    }),
    label: z.string().openapi({
        description: "Etiket for kontoen, der beskriver dens formål.",
        example: "Omsætning",
    }),
});

const balanceSheetSchema = z.object({
    assets: accountSchema,
    nonCurrentAssets: accountSchema,
    intangibleAssets: accountSchema,
    completedDevelopmentProjects: accountSchema,
    concessionsOriginatingFromDevelopmentProjects: accountSchema,
    patentsOriginatingFromDevelopmentProjects: accountSchema,
    trademarksOriginatingFromDevelopmentProjects: accountSchema,
    otherSimilarRightsOriginatingFromDevelopmentProjects: accountSchema,
    acquiredIntangibleAssets: accountSchema,
    acquiredConcessions: accountSchema,
    acquiredPatents: accountSchema,
    acquiredLicences: accountSchema,
    acquiredTrademarks: accountSchema,
    acquiredOtherSimilarRights: accountSchema,
    goodwill: accountSchema,
    developmentProjectsInProgressAndPrepaymentsForIntangibleAssets: accountSchema,
    developmentProjectsInProgress: accountSchema,
    prepaymentsForIntangibleAssets: accountSchema,
    propertyPlantAndEquipment: accountSchema,
    landAndBuildings: accountSchema,
    land: accountSchema,
    buildings: accountSchema,
    investmentProperty: accountSchema,
    otherInvestmentAssets: accountSchema,
    plantAndMachinery: accountSchema,
    fixturesFittingsToolsAndEquipment: accountSchema,
    biologicalAssets: accountSchema,
    leaseholdImprovements: accountSchema,
    ships: accountSchema,
    planes: accountSchema,
    rightOfUseAssets: accountSchema,
    propertyPlantAndEquipmentInProgressAndPrepaymentsForPropertyPlantAndEquipment: accountSchema,
    propertyPlantAndEquipmentInProgress: accountSchema,
    prepaymentsForPropertyPlantAndEquipment: accountSchema,
    longtermInvestmentsAndReceivables: accountSchema,
    longtermInvestmentsInGroupEnterprises: accountSchema,
    shorttermInvestmentsInAssociates: accountSchema,
    longtermInvestmentsInAssociates: accountSchema,
    longtermParticipatingInterests: accountSchema,
    longtermInvestmentsInJointVentures: accountSchema,
    longtermReceivablesFromGroupEnterprises: accountSchema,
    longtermReceivablesFromAssociates: accountSchema,
    longtermReceivablesFromParticipatingInterests: accountSchema,
    longtermReceivablesFromJointVentures: accountSchema,
    otherLongtermInvestments: accountSchema,
    otherLongtermReceivables: accountSchema,
    longtermReceivablesFromOwnersAndManagement: accountSchema,
    nonCurrentDeferredTaxAssets: accountSchema,
    depositsLongtermInvestmentsAndReceivables: accountSchema,
    costExceedsIncomeForTheFinancialYearLongtermReceivables: accountSchema,
    contributedCapitalInArrearsLongTerm: accountSchema,
    nonCurrentContractAssets: accountSchema,
    currentAssets: accountSchema,
    inventories: accountSchema,
    rawMaterialsAndConsumables: accountSchema,
    workInProgress: accountSchema,
    manufacturedGoodsAndGoodsForResale: accountSchema,
    prepaymentsForGoods: accountSchema,
    livestock: accountSchema,
    propertyHeldForSaleInTheOrdinaryCourseOfBusiness: accountSchema,
    assetsHeldForSaleInventories: accountSchema,
    shorttermReceivables: accountSchema,
    shorttermTradeReceivables: accountSchema,
    contractWorkInProgress: accountSchema,
    shorttermReceivablesFromGroupEnterprises: accountSchema,
    shorttermReceivablesFromAssociates: accountSchema,
    shorttermReceivablesFromJointVentures: accountSchema,
    shorttermReceivablesFromParticipatingInterests: accountSchema,
    shorttermReceivablesDividendsFromGroupEnterprises: accountSchema,
    shorttermReceivablesDividendsFromAssociates: accountSchema,
    shorttermReceivablesDividendsFromJointVentures: accountSchema,
    shorttermReceivablesDividendsFromParticipatingInterests: accountSchema,
    currentDeferredTaxAssets: accountSchema,
    shorttermTaxReceivables: accountSchema,
    shorttermTaxReceivablesFromGroupEnterprises: accountSchema,
    vatAndDutiesReceivables: accountSchema,
    otherShorttermReceivables: accountSchema,
    contributedCapitalInArrears: accountSchema,
    shorttermReceivablesFromOwnersAndManagement: accountSchema,
    deferredIncomeAssets: accountSchema,
    costExceedsIncomeForTheFinancialYearShorttermReceivables: accountSchema,
    timingDifferencesShorttermReceivablesEspeciallyUtilities: accountSchema,
    currentContractAssets: accountSchema,
    derivativeFinancialInstrumentsShorttermAssets: accountSchema,
    shorttermInvestments: accountSchema,
    otherShorttermPayables: accountSchema,
    shorttermInvestmentsInGroupEnterprises: accountSchema,
    otherShorttermInvestments: accountSchema,
    cashAndCashEquivalents: accountSchema,
    assetsMeantForSale: accountSchema,
    liabilitiesAndEquity: accountSchema,
    equity: accountSchema,
    contributedCapital: accountSchema,
    paidContributedCapital: accountSchema,
    sharePremium: accountSchema,
    revaluationReserve: accountSchema,
    otherReserves: accountSchema,
    reserveForNetRevaluationAccordingToEquityMethod: accountSchema,
    reserveForLoansAndCollaterals: accountSchema,
    reserveForUnpaidContributedCapital: accountSchema,
    reserveForEntrepreneurialCompany: accountSchema,
    reserveForDevelopmentExpenditure: accountSchema,
    reserveForNetRevaluationOfInvestmentAssets: accountSchema,
    reserveForCurrentValueAdjustmentsOfCurrencyGains: accountSchema,
    reserveForCurrentValueOfHedging: accountSchema,
    otherStatutoryReserves: accountSchema,
    reserveAccordingToArticlesOfAssociation: accountSchema,
    reserveForBiologicalAssets: accountSchema,
    restOfOtherReserves: accountSchema,
    retainedEarnings: accountSchema,
    distributions: accountSchema,
    proposedDividendRecognisedInEquity: accountSchema,
    proposedExtraordinaryDividendRecognisedInEquity: accountSchema,
    notPaidContributedCapital: accountSchema,
    hedgeFund: accountSchema,
    reserveFund: accountSchema,
    transferredToFromReservesAvailable: accountSchema,
    liquidationAccount: accountSchema,
    actuarialProfitLossWhichIsAPartOfTheCalculationOfContingentPensions: accountSchema,
    equityAttributableToParent: accountSchema,
    minorityInterests: accountSchema,
    provisions: accountSchema,
    provisionsForPensionsAndSimilarLiabilities: accountSchema,
    provisionsForDeferredTax: accountSchema,
    otherProvisions: accountSchema,
    provisionsForInvestmentsInGroupEnterprises: accountSchema,
    provisionsForInvestmentsInGroupAssociates: accountSchema,
    provisionsForInvestmentsInParticipatingInterests: accountSchema,
    provisionsForInvestmentsInJointVentures: accountSchema,
    provisionsForIncomeExceedCostForTheFinancialYear: accountSchema,
    timingDifferencesProvisionsEspeciallyUtilities: accountSchema,
    liabilitiesOtherThanProvisions: accountSchema,
    debtToCreditInstitutions: accountSchema,
    longtermDebtToCreditInstitutions: accountSchema,
    shorttermDebtToCreditInstitutions: accountSchema,
    mortgageDebt: accountSchema,
    longtermMortgageDebt: accountSchema,
    shorttermMortgageDebt: accountSchema,
    debtToBanks: accountSchema,
    longtermDebtToBanks: accountSchema,
    shorttermDebtToBanks: accountSchema,
    otherDebtRaisedByIssuanceOfBonds: accountSchema,
    otherLongtermDebtRaisedByIssuanceOfBonds: accountSchema,
    otherShorttermDebtRaisedByIssuanceOfBonds: accountSchema,
    debtToOtherCreditInstitutions: accountSchema,
    longtermDebtToOtherCreditInstitutions: accountSchema,
    shorttermDebtToOtherCreditInstitutions: accountSchema,
    convertibleProfitYieldingOrDividendYieldingDebtInstruments: accountSchema,
    convertibleProfitYieldingOrDividendYieldingLongtermDebtInstruments: accountSchema,
    convertibleProfitYieldingOrDividendYieldingShorttermDebtInstruments: accountSchema,
    prepaymentsReceivedFromCustomers: accountSchema,
    longtermPrepaymentsReceivedFromCustomers: accountSchema,
    shorttermPrepaymentsReceivedFromCustomers: accountSchema,
    tradePayables: accountSchema,
    longtermTradePayables: accountSchema,
    shorttermTradePayables: accountSchema,
    billsOfExchangePayable: accountSchema,
    shorttermBillsOfExchangePayable: accountSchema,
    longtermBillsOfExchangePayable: accountSchema,
    payablesToGroupEnterprises: accountSchema,
    longtermPayablesToGroupEnterprises: accountSchema,
    shorttermPayablesToGroupEnterprises: accountSchema,
    payablesToAssociates: accountSchema,
    longtermPayablesToAssociates: accountSchema,
    shorttermPayablesToAssociates: accountSchema,
    payablesToParticipatingInterests: accountSchema,
    longtermPayablesToParticipatingInterests: accountSchema,
    shorttermPayablesToParticipatingInterest: accountSchema,
    payablesToJointVentures: accountSchema,
    shorttermPayablesToJointVentures: accountSchema,
    longtermPayablesToJointVentures: accountSchema,
    taxPayables: accountSchema,
    longtermTaxPayables: accountSchema,
    shorttermTaxPayables: accountSchema,
    taxPayablesToGroupEnterprises: accountSchema,
    longtermTaxPayablesToGroupEnterprises: accountSchema,
    shorttermTaxPayablesToGroupEnterprises: accountSchema,
    vatAndDutiesPayables: accountSchema,
    otherPayablesIncludingTaxPayables: accountSchema,
    otherPayablesIncludingTaxPayablesLiabilitiesOtherThanProvisionsShortterm: accountSchema,
    otherPayablesIncludingTaxPayablesLiabilitiesOtherThanProvisionsLongterm: accountSchema,
    holidayAllowance: accountSchema,
    holidayAllowanceLiabilitiesShortterm: accountSchema,
    holidayAllowanceLiabilitiesLongterm: accountSchema,
    deferredIncome: accountSchema,
    longtermDeferredIncome: accountSchema,
    shorttermDeferredIncome: accountSchema,
    negativeGoodwill: accountSchema,
    longtermNegativeGoodwill: accountSchema,
    shorttermNegativeGoodwill: accountSchema,
    leaseCommitments: accountSchema,
    longtermLeaseCommitments: accountSchema,
    shorttermLeaseCommitments: accountSchema,
    proposedDividend: accountSchema,
    shorttermPartOfLongtermLiabilitiesOtherThanProvisions: accountSchema,
    longtermLiabilitiesOtherThanProvisions: accountSchema,
    shorttermLiabilitiesOtherThanProvisions: accountSchema,
    equityLoan: accountSchema,
    shorttermEquityLoan: accountSchema,
    longtermEquityLoan: accountSchema,
    payablesToShareholdersAndManagement: accountSchema,
    shorttermPayablesToShareholdersAndManagement: accountSchema,
    longtermPayablesToShareholdersAndManagement: accountSchema,
    prepaymentsOfWorkInProgress: accountSchema,
    shorttermPrepaymentsOfWorkInProgress: accountSchema,
    longtermPrepaymentsOfWorkInProgress: accountSchema,
    contractWorkInProgressLiabilities: accountSchema,
    shorttermContractWorkInProgressLiabilities: accountSchema,
    longtermContractWorkInProgressLiabilities: accountSchema,
    derivativeFinancialInstrumentsLiabilities: accountSchema,
    shortermDerivativeFinancialInstrumentsLiabilities: accountSchema,
    longtermDerivativeFinancialInstrumentsLiabilities: accountSchema,
    depositsLiabilitiesOtherThanProvisions: accountSchema,
    depositsShorttermLiabilitiesOtherThanProvisions: accountSchema,
    depositsLongtermLiabilitiesOtherThanProvisions: accountSchema,
    incomeExceedCostForTheFinancialYear: accountSchema,
    incomeExceedCostForTheFinancialYearShortterm: accountSchema,
    incomeExceedCostForTheFinancialYearLongterm: accountSchema,
    contractLiabilities: accountSchema,
    noncurrentContractLiabilities: accountSchema,
    currentContractLiabilities: accountSchema,
    liabilitiesRelatedToAssetsMeantForSale: accountSchema,
    pensionsAndSimilarLiabilitiesLiabilitiesLongterm: accountSchema,
    pensionsAndSimilarLiabilitiesLiabilitiesShortterm: accountSchema,
    timingDifferencesProvisionsEspeciallyUtilitiesLiabilitiesLongterm: accountSchema,
    timingDifferencesProvisionsEspeciallyUtilitiesLiabilitiesShortterm: accountSchema,
    otherProvisionsLiabilitiesLongterm: accountSchema,
    otherProvisionsLiabilitiesShortterm: accountSchema,
    provisionsForInvestmentsInGroupEnterprisesLiabilitiesLongterm: accountSchema,
    provisionsForInvestmentsInGroupAssociatesLiabilitiesLongterm: accountSchema,
    provisionsForInvestmentsInParticipatingInterestsLiabilitiesLongterm: accountSchema,
    provisionsForInvestmentsInParticipatingInterestsLiabilitiesShortterm: accountSchema,
    provisionsForInvestmentsInJointVenturesLiabilitiesLongterm: accountSchema,
    provisionsForInvestmentsInJointVenturesLiabilitiesShortterm: accountSchema,
    provisionsForOverfundingForReportingPeriodLiabilitiesLongterm: accountSchema,
    provisionsForOverfundingForReportingPeriodLiabilitiesShortterm: accountSchema,
    provisionsForInvestmentsInGroupEnterprisesLiabilitiesShortterm: accountSchema,
    provisionsForInvestmentsInGroupAssociatesLiabilitiesShortterm: accountSchema,
    deferredTaxLiabilitiesLongterm: accountSchema,
});

const incomeStatementSchema = z.object({
    revenue: accountSchema,
    costOfSales: accountSchema,
    changeInInventoriesOfFinishedGoodsWorkInProgressAndGoodsForResale: accountSchema,
    workPerformedByEntityAndCapitalised: accountSchema,
    costOfProduction: accountSchema,
    otherOperatingIncome: accountSchema,
    propertyCost: accountSchema,
    grossResult: accountSchema,
    grossProfitLoss: accountSchema,
    distributionCosts: accountSchema,
    administrativeExpenses: accountSchema,
    employeeBenefitsExpense: accountSchema,
    wagesAndSalaries: accountSchema,
    postemploymentBenefitExpense: accountSchema,
    socialSecurityContributions: accountSchema,
    employeeExpensesTransferredToAssets: accountSchema,
    otherEmployeeExpense: accountSchema,
    depreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss:
        accountSchema,
    writedownsOfCurrentAssetsOtherThanCurrentFinancialAssets: accountSchema,
    writedownsOfCurrentAssetsThatExceedNormalWritedowns: accountSchema,
    externalExpenses: accountSchema,
    rawMaterialsAndConsumablesUsed: accountSchema,
    otherExternalExpenses: accountSchema,
    otherOperatingExpenses: accountSchema,
    incomeFromNegativeGoodwill: accountSchema,
    profitLossFromOrdinaryOperatingActivitiesBeforeGainsLossesFromFairValueAdjustments: accountSchema,
    gainsLossesFromCurrentValueAdjustmentsOfInvestmentAssets: accountSchema,
    gainsLossesFromCurrentValueAdjustmentsOfInvestmentProperty: accountSchema,
    gainsLossesFromCurrentValueAdjustmentsOfOtherInvestmentAssets: accountSchema,
    gainsLossesFromCurrentValueAdjustmentsOfBiologicalAssets: accountSchema,
    gainsLossesFromCurrentValueAdjustmentsOfDebtLiabilities: accountSchema,
    gainsLossesFromCurrentValueAdjustmentsOfDebtLiabilitiesConcerningInvestmentProperty: accountSchema,
    gainsLossesFromCurrentValueAdjustmentsOfDebtLiabilitiesConcerningOtherInvestmentAssets: accountSchema,
    researchAndDevelopmentExpenditure: accountSchema,
    researchExpenditure: accountSchema,
    developmentExpenditure: accountSchema,
    profitLossFromOrdinaryOperatingActivities: accountSchema,
    extraordinaryIncome: accountSchema,
    extraordinaryExpenses: accountSchema,
    extraordinaryProfitLossBeforeTax: accountSchema,
    taxExpenseOnExtraordinaryEvents: accountSchema,
    extraordinaryProfitLossAfterTax: accountSchema,
    incomeFromInvestmentsInGroupEnterprisesAndAssociates: accountSchema,
    incomeFromInvestmentsInGroupEnterprises: accountSchema,
    incomeFromInvestmentsInAssociates: accountSchema,
    incomeFromInvestmentsInParticipatingInterests: accountSchema,
    incomeFromInvestmentsInJointVentures: accountSchema,
    incomeFromOtherLongtermInvestmentsAndReceivables: accountSchema,
    otherFinanceIncomeFromGroupEnterprises: accountSchema,
    otherFinanceIncome: accountSchema,
    impairmentOfFinancialAssets: accountSchema,
    otherFinanceExpenses: accountSchema,
    financeExpensesArisingFromGroupEnterprises: accountSchema,
    restOfOtherFinanceExpenses: accountSchema,
    profitLossFromOrdinaryActivitiesBeforeTax: accountSchema,
    profitLossFromOrdinaryActivitiesAfterTax: accountSchema,
    taxExpenseOnOrdinaryActivities: accountSchema,
    taxExpense: accountSchema,
    otherTaxExpenses: accountSchema,
    profitLossFromDiscontinuedOperations: accountSchema,
    profitLossFromContinuingOperations: accountSchema,
    profitLoss: accountSchema,
    profitLossAttributableToMinorityInterest: accountSchema,
    profitLossAfterAttributableToMinorityInterest: accountSchema,
});

const relatedEntitySchema = z.object({
    cvrNumber: z.string().nullable().openapi({
        description: "Den nærtstående virksomheds CVR-nummer",
        example: "12345678",
    }),
    legalEntityIdentifier: z.string().nullable().openapi({
        description: "Den nærtstående virksomheds LEI-kode",
        example: "5299000J2N45DDNE4Y28",
    }),
    pNumber: z.string().nullable().openapi({
        description: "Den nærtstående virksomheds P-nummer",
        example: "1012345678",
    }),
    name: z.string().nullable().openapi({
        description: "Navnet på den nærtstående virksomhed",
        example: "Gamma 26 ApS",
    }),
    registeredOffice: z.string().nullable().openapi({
        description: "Virksomhedens hjemsted",
        example: "Haderslev",
    }),
    legalForm: z.string().nullable().openapi({
        description: "Virksomhedens selskabsform",
        example: "ApS",
    }),
    ownershipPercentage: z.number().nullable().openapi({
        description: "Ejerandel i tilknyttet virksomhed (i procent)",
        example: 100,
    }),
});

const consolidatedFinancialStatementsSchema = z.object({
    cvrNumber: z.string().nullable().openapi({
        description: "Den tilknyttede virksomheds CVR-nummer [koncernregnskab]",
        example: "12345678",
    }),
    legalEntityIdentifier: z.string().nullable().openapi({
        description: "Den tilknyttede virksomheds LEI-kode [koncernregnskab]",
        example: "5299000J2N45DDNE4Y28",
    }),
    pNumber: z.string().nullable().openapi({
        description: "Den tilknyttede virksomheds P-nummer [koncernregnskab]",
        example: "1012345678",
    }),
    name: z.string().nullable().openapi({
        description: "Den tilknyttede virksomheds navn [koncernregnskab]",
        example: "Datterselskab A/S",
    }),
    registeredOffice: z.string().nullable().openapi({
        description: "Den tilknyttede virksomheds hjemsted [koncernregnskab]",
        example: "København",
    }),
    placeWhereConsolidatedFinancialStatementsMayBeObtained: z.string().nullable().openapi({
        description: "Oplysning om hvor de pågældende udenlandske modervirksomheders koncernregnskaber kan rekvireres",
        example: "Stockholm, Sverige",
    }),
});

const annualReportSchema = z.object({
    reportingPeriod: z.object({
        reportingPeriodStartDate: z.string().openapi({
            description: "Startdatoen for den regnskabsperiode, som årsrapporten dækker.",
            example: "01-01-2022",
        }),
        reportingPeriodEndDate: z.string().openapi({
            description: "Slutdatoen for den regnskabsperiode, som årsrapporten dækker.",
            example: "31-12-2022",
        }),
    }),
    unit: z.string().openapi({
        description: "Den valutaenhed, som alle beløb i årsrapporten er angivet i.",
        example: "DKK",
    }),
    notes: z.record(z.string(), accountSchema).openapi({
        description: "En samling af noter, hvor hver note har en nøgle og en tilknyttet konto.",
        example: {
            amortisationOfIntangibleAssets: {
                value: 1000000,
                unit: "DKK",
                label: "Afskrivninger af immaterielle aktiver",
            },
            accumulatedImpairmentLossesAndAmortisationOfIntangibleAssets: {
                value: 500000,
                unit: "DKK",
                label: "Akkumulerede nedskrivninger og afskrivninger af immaterielle anlægsaktiver",
            },
        },
    }),
    relatedEntities: z.array(relatedEntitySchema).openapi({
        description: "En liste over relaterede enheder, der har en betydelig indflydelse på virksomheden.",
        example: [
            {
                cvrNumber: "12345678",
                legalEntityIdentifier: null,
                pNumber: null,
                name: "Datterselskab A/S",
                registeredOffice: "København",
                legalForm: "Aktieselskab",
                ownershipPercentage: 100,
            },
        ],
    }),
    consolidatedFinancialStatements: z.array(consolidatedFinancialStatementsSchema).openapi({
        description: "En liste over tilknyttede virksomheder, der indgår i koncernregnskabet.",
        example: [
            {
                cvrNumber: "12345678",
                legalEntityIdentifier: null,
                pNumber: null,
                name: "Datterselskab A/S",
                registeredOffice: "København",
                placeWhereConsolidatedFinancialStatementsMayBeObtained: null,
            },
        ],
    }),
    warnings: z
        .array(
            z.object({
                code: z.literal("SCALING_REPAIRED").openapi({ example: "SCALING_REPAIRED" }),
                message: z.string().openapi({
                    description: "Menneskelæsbar (dansk) beskrivelse af justeringen.",
                }),
                repairedFields: z.array(
                    z.object({
                        statement: z.enum(["balanceSheet", "incomeStatement", "notes"]),
                        field: z.string().openapi({ example: "assets" }),
                        originalValue: z.number().openapi({ example: 247483 }),
                        repairedValue: z.number().openapi({ example: 247483000 }),
                        factor: z.number().openapi({ example: 1000 }),
                    }),
                ),
            }),
        )
        .openapi({
            description:
                "Datakvalitets-advarsler for denne årsrapport. 'SCALING_REPAIRED' betyder, at et eller flere " +
                "beløb manglede de nuller, som deres decimals-angivelse tilsiger, og er ganget op — kontrollér tallene.",
            example: [],
        }),
    incomeStatement: incomeStatementSchema.partial(),
    balancesheet: balanceSheetSchema.partial(),
});

// Codes must stay in sync with shared/api-error.ts ErrorCode and the VBA ApiErrorCode list.
const errorCodeSchema = z.enum([
    "UPSTREAM_UNAVAILABLE",
    "UPSTREAM_ERROR",
    "UPSTREAM_BAD_RESPONSE",
    "NOT_FOUND",
    "INVALID_CVR",
    "UNKNOWN_TAXONOMY",
    "MALFORMED_XML",
    "MISSING_NAMESPACE",
    "MALFORMED_UNIT",
    "MISSING_PERIOD",
    "NO_DATA",
    "INTERNAL",
]);

const skipSchema = z.object({
    reportingPeriodEndDate: z.string().nullable().openapi({
        description: "Regnskabsperiodens slutdato for den årsrapport, der ikke kunne læses.",
        example: "2023-12-31",
    }),
    documentUrl: z.string().nullable().openapi({
        description: "URL til det XBRL-dokument, der ikke kunne læses.",
        example: "https://distribution.virk.dk/...",
    }),
    errorCode: errorCodeSchema.openapi({
        description: "Maskinlæsbar årsag til, at årsrapporten blev sprunget over.",
        example: "UNKNOWN_TAXONOMY",
    }),
    message: z.string().openapi({
        description: "Menneskelæsbar (dansk) årsag.",
        example: "Årsrapporten anvender en ukendt taksonomi og kunne ikke læses.",
    }),
});

export const responseSchema = z.object({
    total: z.number().int().openapi({
        description: "Det samlede antal årsrapporter, der blev fundet for det angivne CVR-nummer.",
        example: 10,
    }),
    status: z.enum(["success", "failed", "error"]).openapi({
        description: "Status for forespørgslen.",
        example: "success",
    }),
    results: z.array(annualReportSchema).openapi({
        description: "En liste over årsrapporter for det angivne CVR-nummer.",
        example: [
            {
                reportingPeriod: {
                    reportingPeriodStartDate: "2022-01-01",
                    reportingPeriodEndDate: "2022-12-31",
                },
                unit: "DKK",
                notes: {},
                relatedEntities: [],
                consolidatedFinancialStatements: [],
                warnings: [],
                incomeStatement: {},
                balancesheet: {},
            },
        ],
    }),
    skipped: z.array(skipSchema).openapi({
        description: "Dokumenter der blev hentet, men ikke kunne læses (med årsag).",
        example: [],
    }),
});

export const batchBodySchema = z.object({
    cvrNumbers: z
        .array(
            z.coerce.string().length(8, {
                error: (issue) => ({
                    message: `Hvert CVR-nummer skal have præcis 8 cifre. Du angav ${issue.input}`,
                }),
            }),
        )
        .min(1, { error: () => ({ message: "Mindst ét CVR-nummer skal angives." }) })
        .max(500, { error: () => ({ message: "Maksimalt 500 CVR-numre kan hentes ad gangen." }) })
        .openapi({
            description: "En liste over CVR-numre, hvis årsrapporter skal hentes.",
            example: ["12345678", "23456789"],
        }),
});

const batchResultSchema = z.object({
    cvrNumber: z.string().openapi({
        description: "CVR-nummeret som dette resultat vedrører.",
        example: "12345678",
    }),
    status: z.enum(["success", "failed", "error"]).openapi({
        description: "Status for netop dette CVR-nummer.",
        example: "success",
    }),
    total: z.number().int().openapi({
        description: "Antal årsrapporter fundet for dette CVR-nummer.",
        example: 10,
    }),
    results: z.array(annualReportSchema).openapi({
        description: "Årsrapporterne for dette CVR-nummer.",
    }),
    skipped: z.array(skipSchema).openapi({
        description: "Dokumenter for dette CVR-nummer, der ikke kunne læses (med årsag).",
        example: [],
    }),
    errorCode: errorCodeSchema.optional().openapi({
        description: "Maskinlæsbar fejlkode, hvis hele selskabet fejlede.",
        example: "UPSTREAM_UNAVAILABLE",
    }),
    message: z.string().optional().openapi({
        description: "Fejlbesked, hvis status er 'error' eller 'failed'.",
        example: "Kunne ikke hente data fra CVR-registret.",
    }),
});

export const batchResponseSchema = z.object({
    total: z.number().int().openapi({
        description: "Antal CVR-numre der blev behandlet.",
        example: 2,
    }),
    status: z.enum(["success", "partial", "error"]).openapi({
        description: "Samlet status. 'success' = alle lykkedes, 'partial' = nogle fejlede, 'error' = alle fejlede.",
        example: "success",
    }),
    results: z.array(batchResultSchema).openapi({
        description: "Et resultat per CVR-nummer, i samme rækkefølge som forespørgslen.",
    }),
});
