import { z } from "@hono/zod-openapi";

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

const taxonomyRowSchema = z
    .object({
        concept: z.string().min(1, { error: () => ({ message: "Taksonomirækker skal have et koncept." }) }),
        label: z.string().default(""),
        parent: z.string().default(""),
        passiveClassification: z.string().default(""),
        includeInPassiveTest: z.boolean(),
        passiveNote: z.string().default(""),
        valuationClassification: z.string().default(""),
        distributionKey: z.number().default(1),
        valuationNote: z.string().default(""),
    })
    .openapi({ description: "Én række fra ASSET_TAXONOMY_TREE-tabellen på Indstillinger-arket." });

const financialIncomeRowSchema = z
    .object({
        concept: z.string().min(1, { error: () => ({ message: "Indkomsttaksonomirækker skal have et koncept." }) }),
        label: z.string().default(""),
        classification: z.string().default(""),
        includeInPassiveTest: z.boolean(),
        note: z.string().default(""),
    })
    .openapi({ description: "Én række fra FINANCIAL_INCOME_TAXONOMY-tabellen på Indstillinger-arket." });

const settingsSchema = z
    .object({
        corporateTaxRate: z.number().openapi({ description: "Selskabsskattesatsen (CORPORATE_TAX_RATE).", example: 0.22 }),
        minVotingRights: z.number().min(0).max(1).openapi({
            description: "Nedre grænse for stemmerettigheder, før et selskab medtages (VALUATION_MIN_VOTING_RIGHTS).",
            example: 0.5,
        }),
        minIndirectOwnership: z.number().min(0).max(1).openapi({
            description: "Mindste indirekte ejerandel for passiv-aktiv-testen (PASSIVE_ASSET_TEST_MIN_INDIRECT_OWNERSHIP).",
            example: 0.5,
        }),
        maximumNumberOfCompanies: z.number().int().positive().openapi({
            description: "Antal værdiansættelsesark i projektmappen (MAXIMUM_NUMBER_OF_COMPANIES).",
            example: 60,
        }),
        maxPassiveAssetTestCompanies: z.number().int().positive().default(47).openapi({
            description: "Antal selskabskolonner i Successionsopgørelsen.",
            example: 47,
        }),
        successionModes: z
            .object({
                noCalculation: z.string().min(1),
                dateOfTransfer: z.string().min(1),
                oneYear: z.string().min(1),
                twoYear: z.string().min(1),
                threeYear: z.string().min(1),
            })
            .openapi({ description: "De fem PASSIVE_ASSET_TEST-tilstandsetiketter fra Indstillinger-arket." }),
        reportingPeriodsLookup: z
            .object({
                oneYear: z.array(z.number()).min(1),
                twoYear: z.array(z.number()).min(1),
                threeYear: z.array(z.number()).min(1),
            })
            .openapi({
                description: "REPORTING_PERIODS_{1,2,3}_YEAR_PASSIVE_ASSET_TEST-kolonnerne som talrækker.",
            }),
        currencies: z
            .array(z.object({ code: z.string(), name: z.string(), symbol: z.string() }))
            .openapi({ description: "Valutatabellen (CURRENCY_CODES/NAMES/SYMBOLS)." }),
        corporateFormLabels: z
            .object({
                limitedLiabilityCompany: z.string(),
                soleProprietorship: z.string(),
            })
            .openapi({ description: "Etiketterne KAPITALSELSKAB og PERSONLIGT_EJET_VIRKSOMHED." }),
        assetTaxonomy: z.array(taxonomyRowSchema).min(1),
        financialIncomeTaxonomy: z.array(financialIncomeRowSchema).min(1),
    })
    .openapi({ description: "Konfigurationen fra projektmappens Indstillinger-ark." });

const groupCompanySchema = z
    .object({
        cvr: z.union([z.string(), z.number()]),
        name: z.string().min(1, { error: () => ({ message: "Alle selskaber i koncernen skal have et navn." }) }),
        level: z.number().int().min(0),
        parent: z
            .object({
                name: z.string().nullable(),
                cvr: z.union([z.string(), z.number()]).nullable(),
            })
            .nullable()
            .default(null),
        corporateForm: z
            .object({
                code: z.number().nullable(),
                name: z.string().nullable().optional(),
                abbreviation: z.string().nullable().optional(),
            })
            .nullable()
            .optional(),
        votingRightsPercentage: z
            .object({
                interval: z.object({
                    from: z.number().nullable(),
                    to: z.number().nullable(),
                }),
            })
            .nullable()
            .optional(),
        // Same shape the wizard already produces; indirectOwnership is accepted but
        // ignored — the server recomputes it from the direct ownerships.
        ownershipPercentage: z
            .object({
                directOwnership: z.number().min(0).max(1).nullable().default(null),
            })
            .nullable()
            .optional(),
        consolidate: z.boolean().default(false),
    })
    .openapi({
        description:
            "Ét selskab fra den fladgjorte koncernstruktur, beriget med brugerens direkte ejerandel og konsolideringsvalg.",
    });

const formDataSchema = z
    .object({
        cvr: z.union([z.string(), z.number()]).openapi({
            description: "Moderselskabets CVR-nummer som indtastet i guiden.",
            example: "26647126",
        }),
        unpublishedAnnualReport: z
            .enum(["GØR PLADS", "GØR IKKE PLADS"], {
                error: () => ({ message: "unpublishedAnnualReport skal være 'GØR PLADS' eller 'GØR IKKE PLADS'." }),
            })
            .openapi({ description: "Om år 1 skal friholdes til en uoffentliggjort årsrapport." }),
        owner: z.string().default("").openapi({ description: "Ejertype (FYSISK PERSON, DØDSBO eller SELSKAB)." }),
        autocomplete: z.string().default("JA"),
        currencyCode: z
            .enum(["KODE", "SYMBOL"], {
                error: () => ({ message: "currencyCode skal være 'KODE' eller 'SYMBOL'." }),
            })
            .openapi({ description: "Valutaformatet til CURRENCY_FORMAT-cellen." }),
        successionPeriod: z.string().min(1).openapi({
            description: "Den valgte successionstilstand som rå dansk etiket fra Indstillinger-arket.",
        }),
        dateOfTransfer: z.string().nullable().default(null),
        corporateGroup: z
            .array(groupCompanySchema)
            .min(1, { error: () => ({ message: "Koncernen skal indeholde mindst ét selskab." }) }),
    })
    .openapi({ description: "Guidens formulardata." });

export const bodySchema = z
    .object({
        formData: formDataSchema,
        settings: settingsSchema,
    })
    .openapi("ProjectResolutionRequest");

export type ProjectResolutionRequestBody = z.infer<typeof bodySchema>;

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

const componentSchema = z
    .object({
        concept: z.string(),
        label: z.string(),
        value: z.number(),
    })
    .openapi({
        description:
            "Ét led i en sum. Klienten genskaber den synlige '=a+b'-formel af leddene (med Abs som hidtil).",
    });

const accountValueSchema = z.object({
    concept: z.string(),
    value: z.number(),
});

const noteSchema = z
    .object({
        text: z.string(),
        fit: z.boolean(),
        sheet: z.enum(["VALUATION", "PASSIVE_ASSET_TEST"]),
        notepad: z.string(),
    })
    .openapi({ description: "En dosmerseddel med præcis placering (ark + navngivet notesfelt)." });

const adjustedEquitySchema = z.object({
    equity: accountValueSchema.nullable(),
    intangibleAssets: accountValueSchema.nullable(),
    landAndBuildings: z.number().nullable(),
    sharesInSubsidiaries: z.array(componentSchema),
    proposedDividends: accountValueSchema.nullable(),
});

const capitalisedEarningsSchema = z.object({
    assets: accountValueSchema.nullable(),
    goodwill: accountValueSchema.nullable(),
    cashAndCashEquivalents: accountValueSchema.nullable(),
    deposits: accountValueSchema.nullable(),
    revenue: accountValueSchema.nullable(),
    profitLossBeforeTax: accountValueSchema.extend({ usedFallback: z.boolean() }).nullable(),
    extraordinaryIncome: accountValueSchema.nullable(),
    extraordinaryExpenses: accountValueSchema.nullable(),
    depreciationOfIntangibleAssets: accountValueSchema.nullable(),
    unlistedShares: z.array(componentSchema),
    financialIncome: z.array(componentSchema),
    financialExpenses: z.array(componentSchema),
    financialInstruments: z.array(componentSchema),
    otherNonOperatingAssets: z.object({
        full: z.array(componentSchema),
        half: z.array(componentSchema),
    }),
    intercompanyReceivables: z.array(componentSchema),
});

const valuationYearSchema = z.object({
    slot: z.number().int(),
    startDate: z.string(),
    endDate: z.string(),
    currencyName: z.string(),
    exchangeRate: z.number().nullable(),
    adjustedEquity: adjustedEquitySchema.nullable(),
    capitalisedEarnings: capitalisedEarningsSchema.nullable(),
});

const propertySchema = z.object({
    address: z.string(),
    remarks: z.string(),
    ownershipShare: z.number(),
    basisOfValuation: z.string(),
    valuationsBySlot: z.record(z.string(), z.number()),
});

const passiveLineItemSchema = z.object({
    concept: z.string(),
    label: z.string(),
    category: z.string().nullable(),
    value: z.number(),
});

const passiveYearSchema = z.object({
    slot: z.number().int(),
    startDate: z.string(),
    endDate: z.string(),
    currencyName: z.string(),
    exchangeRate: z.number().nullable(),
    totalAssets: accountValueSchema.nullable(),
    revenue: z.array(componentSchema),
    hasRevenue: z.boolean(),
    assets: z.array(passiveLineItemSchema),
    income: z.array(passiveLineItemSchema),
    bookValueOfSharesInSubsidiaries: z.array(componentSchema),
    incomeFromSubsidiaries: z.array(componentSchema),
});

const passiveDateOfTransferSchema = z.object({
    dateOfValuation: z.string(),
    currencyName: z.string(),
    exchangeRate: z.number().nullable(),
    totalAssets: accountValueSchema.nullable(),
    assets: z.array(passiveLineItemSchema),
    bookValueOfSharesInSubsidiaries: z.array(componentSchema),
});

const resolvedCompanySchema = z.object({
    index: z.number().int(),
    cvr: z.string(),
    name: z.string(),
    isParent: z.boolean(),
    overviewRow: z.object({
        name: z.string(),
        cvr: z.string(),
        corporateForm: z.string(),
        owner: z.string(),
        reportingPeriods: z.number(),
        taxRate: z.number(),
        directOwnershipPercent: z.number(),
        consolidate: z.boolean(),
    }),
    ownership: z.object({
        direct: z.number().nullable(),
        indirect: z.number().nullable(),
        votingRightsFrom: z.number().nullable(),
        votingRightsTo: z.number().nullable(),
    }),
    consolidateRequested: z.boolean(),
    includeInPassiveTest: z.boolean(),
    passiveCompanySlot: z.number().int().nullable(),
    reportStatus: z.object({
        status: z.enum(["success", "failed", "error", "missing"]),
        errorCode: z.string().nullable(),
        message: z.string().nullable(),
        skipped: z.array(
            z.object({
                reportingPeriodEndDate: z.string().nullable(),
                message: z.string(),
            }),
        ),
    }),
    unpublishedShift: z.boolean(),
    valuation: z.object({
        notes: z.array(noteSchema),
        property: propertySchema.nullable(),
        years: z.array(valuationYearSchema),
    }),
    passiveAssetTest: z
        .object({
            notes: z.array(noteSchema),
            dateOfTransfer: passiveDateOfTransferSchema.nullable(),
            years: z.array(passiveYearSchema),
        })
        .nullable(),
});

export const responseSchema = z
    .object({
        status: z.enum(["success", "partial"]).openapi({
            description: "'partial' når mindst ét selskabs årsrapporter fejlede eller blev sprunget over.",
        }),
        successionMode: z.enum(["NO_CALCULATION", "DATE_OF_TRANSFER", "ONE_YEAR", "TWO_YEAR", "THREE_YEAR"]),
        successionPeriodLabel: z.string(),
        currencyCode: z.string(),
        dateOfTransfer: z.string().nullable(),
        numberOfCompanies: z.number().int(),
        numberOfPassiveTestCompanies: z.number().int(),
        excludedCompanies: z.array(
            z.object({
                cvr: z.string(),
                name: z.string(),
                reason: z.string(),
            }),
        ),
        warnings: z.array(
            z.object({
                code: z.enum(["BALANCE_INCOMPLETE", "REPORTS_FAILED", "REPORT_SKIPPED"]),
                cvr: z.string().nullable(),
                companyName: z.string().nullable(),
                reportingPeriodEndDate: z.string().nullable(),
                message: z.string(),
            }),
        ),
        companies: z.array(resolvedCompanySchema),
    })
    .openapi("ProjectResolutionResponse");
