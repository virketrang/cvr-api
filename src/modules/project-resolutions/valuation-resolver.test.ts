import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { Account, AnnualReport } from "../annual-reports/annual-report.types.js";
import { TaxonomyIndex } from "./taxonomy-engine.js";
import { resolveValuation, UNPUBLISHED_REPORT_NOTE, type ResolutionContext } from "./valuation-resolver.js";
import { container, smallTaxonomy } from "./test-fixtures.js";
import type { SuccessionMode } from "./project-resolution.types.js";

function report(
    endYear: number,
    values: {
        balancesheet?: Record<string, number | null>;
        incomeStatement?: Record<string, number | null>;
        notes?: Record<string, number | null>;
        unit?: string;
    } = {},
): AnnualReport<Account> {
    return {
        reportingPeriod: {
            reportingPeriodStartDate: `${endYear}-01-01`,
            reportingPeriodEndDate: `${endYear}-12-31`,
        },
        unit: values.unit ?? "DKK",
        balancesheet: container(values.balancesheet ?? {}) as never,
        incomeStatement: container(values.incomeStatement ?? {}) as never,
        notes: container(values.notes ?? {}) as never,
        relatedEntities: [],
        consolidatedFinancialStatements: [],
        warnings: [],
    };
}

function context(overrides: Partial<ResolutionContext> = {}): ResolutionContext {
    return {
        mode: "THREE_YEAR" as SuccessionMode,
        isParent: true,
        companyIndex: 1,
        unpublishedAnnualReport: "GØR IKKE PLADS",
        group: [],
        taxonomy: new TaxonomyIndex(smallTaxonomy()),
        currencyNameOf: (unit) => (unit === "DKK" ? "Danske kroner" : ""),
        today: new Date("2026-07-07"),
        ...overrides,
    };
}

describe("resolveValuation — year slotting", () => {
    it("caps the years at 5/6/7 depending on the succession mode", () => {
        const reports = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map((y) => report(y));
        assert.equal(resolveValuation(reports, context({ mode: "ONE_YEAR" })).years.length, 5);
        assert.equal(resolveValuation(reports, context({ mode: "DATE_OF_TRANSFER" })).years.length, 5);
        assert.equal(resolveValuation(reports, context({ mode: "TWO_YEAR" })).years.length, 6);
        assert.equal(resolveValuation(reports, context({ mode: "THREE_YEAR" })).years.length, 7);
    });

    it("shifts every year one slot down when making room for an unpublished report", () => {
        // Newest report ended 2024-12-31, "today" is 2026-07-07 (> one year later).
        const reports = [2024, 2023, 2022].map((y) => report(y));
        const resolved = resolveValuation(reports, context({ unpublishedAnnualReport: "GØR PLADS" }));

        assert.equal(resolved.unpublishedShift, true);
        // The shift consumes a slot AND the last report falls off the total check.
        assert.deepEqual(
            resolved.years.map((y) => [y.slot, y.endDate]),
            [
                [2, "2024-12-31"],
                [3, "2023-12-31"],
            ],
        );
        assert.ok(resolved.notes.some((n) => n.text === UNPUBLISHED_REPORT_NOTE));
    });

    it("does not shift when the newest report is recent or the user said no", () => {
        const recent = [report(2025)];
        const noShift = resolveValuation(recent, context({ unpublishedAnnualReport: "GØR PLADS" }));
        assert.equal(noShift.unpublishedShift, false);
        assert.equal(noShift.years[0].slot, 1);

        const declined = resolveValuation([report(2020)], context({ unpublishedAnnualReport: "GØR IKKE PLADS" }));
        assert.equal(declined.unpublishedShift, false);
    });

    it("only resolves adjusted equity for the slots the mode calls for", () => {
        const reports = [2025, 2024, 2023, 2022].map((y) => report(y, { balancesheet: { equity: 100 } }));

        const oneYear = resolveValuation(reports, context({ mode: "ONE_YEAR" }));
        assert.deepEqual(
            oneYear.years.map((y) => y.adjustedEquity !== null),
            [true, false, false, false],
        );

        const twoYear = resolveValuation(reports, context({ mode: "TWO_YEAR" }));
        assert.deepEqual(
            twoYear.years.map((y) => y.adjustedEquity !== null),
            [true, true, false, false],
        );

        const threeYear = resolveValuation(reports, context({ mode: "THREE_YEAR" }));
        assert.deepEqual(
            threeYear.years.map((y) => y.adjustedEquity !== null),
            [true, true, true, false],
        );
    });
});

describe("resolveValuation — adjusted equity", () => {
    it("notes missing equity, and combines ordinary and fair-value property", () => {
        const resolved = resolveValuation(
            [
                report(2025, {
                    balancesheet: { land: 300, buildings: 200, investmentProperty: 1000 },
                }),
            ],
            context(),
        );

        const year = resolved.years[0];
        assert.equal(year.adjustedEquity?.equity, null);
        assert.ok(resolved.notes.some((n) => n.text === "Den bogførte egenkapital mangler for regnskabsperioden."));
        // land + buildings + fair-value investment property
        assert.equal(year.adjustedEquity?.landAndBuildings, 1500);
        // Fair-value property present in slot 1 → property block with the year valuation.
        assert.equal(resolved.property?.address, "Investeringsejendomme");
        assert.deepEqual(resolved.property?.valuationsBySlot, { "1": 1000 });
        // Fair value ≠ 0 suppresses the capitalised-earnings section with a note.
        assert.equal(year.capitalisedEarnings, null);
        assert.ok(resolved.notes.some((n) => n.text.includes("merindtjeningsberegning")));
        // Ordinary property triggers the two property prompts, prefixed with the year.
        assert.ok(resolved.notes.some((n) => n.text === "År 1: Indtast værdi af fast ejendom."));
        assert.ok(resolved.notes.some((n) => n.text === "År 1: Overvej, hvorvidt udskudt skat på ejendomme skal korrigeres."));
    });

    it("prefers landAndBuildings over land+buildings when reported", () => {
        const resolved = resolveValuation(
            [report(2025, { balancesheet: { landAndBuildings: 700, land: 300, buildings: 200, equity: 1 } })],
            context(),
        );
        assert.equal(resolved.years[0].adjustedEquity?.landAndBuildings, 700);
    });

    it("collects unlisted-share components and only gives the parent proposed dividends", () => {
        const balancesheet = {
            equity: 1,
            longtermInvestments: 400,
            proposedDividendRecognisedInEquity: 50,
        };
        const asParent = resolveValuation([report(2025, { balancesheet })], context({ isParent: true }));
        assert.deepEqual(asParent.years[0].adjustedEquity?.sharesInSubsidiaries, [
            { concept: "longtermInvestments", label: "Kapitalandele", value: 400 },
        ]);
        assert.deepEqual(asParent.years[0].adjustedEquity?.proposedDividends, {
            concept: "proposedDividendRecognisedInEquity",
            value: 50,
        });

        const asSubsidiary = resolveValuation(
            [report(2025, { balancesheet })],
            context({ isParent: false, companyIndex: 2 }),
        );
        assert.equal(asSubsidiary.years[0].adjustedEquity?.proposedDividends, null);
    });

    it("flags subsidiaries with under 20% voting rights when participating interests exist", () => {
        const group = [
            {
                cvr: "00000001",
                name: "Mor",
                level: 0,
                parent: null,
                corporateFormCode: 60,
                votingRightsFrom: 1,
                votingRightsTo: 1,
                directOwnership: 1,
                consolidate: false,
            },
            {
                cvr: "00000002",
                name: "Datter",
                level: 1,
                parent: { name: "Mor", cvr: "00000001" },
                corporateFormCode: 60,
                votingRightsFrom: 0.05,
                votingRightsTo: 0.1,
                directOwnership: 0.05,
                consolidate: false,
            },
        ];
        const resolved = resolveValuation(
            [report(2025, { balancesheet: { equity: 1, longtermParticipatingInterests: 100 } })],
            context({ group }),
        );
        assert.ok(
            resolved.notes.some(
                (n) =>
                    n.text ===
                    "Bemærk: Der er datterselskaber med under 20% stemmerettigheder: Datter (5% - 10%). Overvej behandling af kapitalinteresser.",
            ),
        );
    });
});

describe("resolveValuation — capitalised earnings", () => {
    it("uses profitLoss as fallback and notes it", () => {
        const resolved = resolveValuation(
            [report(2025, { incomeStatement: { profitLoss: 500, revenue: 100 } })],
            context(),
        );
        assert.deepEqual(resolved.years[0].capitalisedEarnings?.profitLossBeforeTax, {
            concept: "profitLoss",
            value: 500,
            usedFallback: true,
        });
        assert.ok(resolved.notes.some((n) => n.text.startsWith("BEMÆRK: Årsrapporten indeholdte ikke")));
    });

    it("splits finance items into income and expenses by sign", () => {
        const resolved = resolveValuation(
            [
                report(2025, {
                    incomeStatement: {
                        revenue: 1,
                        profitLossFromOrdinaryActivitiesBeforeTax: 1,
                        incomeFromInvestmentsInGroupEnterprises: 100, // income list, positive → income
                        otherFinanceIncome: -25, // income list, negative → expense
                        otherFinanceExpenses: 40, // expense list, non-negative → expense
                        restOfOtherFinanceExpenses: -10, // expense list, negative → income
                        financeExpensesArisingFromGroupEnterprises: 0, // zero → dropped
                    },
                }),
            ],
            context(),
        );
        const earnings = resolved.years[0].capitalisedEarnings;
        assert.deepEqual(
            earnings?.financialIncome.map((c) => [c.concept, c.value]),
            [
                ["incomeFromInvestmentsInGroupEnterprises", 100],
                ["restOfOtherFinanceExpenses", -10],
            ],
        );
        assert.deepEqual(
            earnings?.financialExpenses.map((c) => [c.concept, c.value]),
            [
                ["otherFinanceIncome", -25],
                ["otherFinanceExpenses", 40],
            ],
        );
    });

    it("collects non-operating assets by distribution key and writes the Danish note", () => {
        const resolved = resolveValuation(
            [
                report(2025, {
                    balancesheet: {
                        landAndBuildings: 1234567, // key 1 in the fixture taxonomy
                        shorttermInvestments: 200, // Værdipapirer, key 0.5 — not "Andre ikke-driftsrelaterede"
                        equity: 1,
                    },
                    incomeStatement: { revenue: 1, profitLossFromOrdinaryActivitiesBeforeTax: 1 },
                }),
            ],
            context(),
        );
        const earnings = resolved.years[0].capitalisedEarnings;
        assert.deepEqual(earnings?.otherNonOperatingAssets.full, [
            { concept: "landAndBuildings", label: "Grunde og bygninger", value: 1234567 },
        ]);
        assert.deepEqual(earnings?.otherNonOperatingAssets.half, []);
        assert.ok(
            resolved.notes.some(
                (n) => n.text === "År 1: Andre ikke-driftsrelaterede poster (100 %): Grunde og bygninger (1.234.567).",
            ),
        );
        assert.deepEqual(earnings?.financialInstruments, [
            { concept: "shorttermInvestments", label: "Værdipapirer", value: 200 },
        ]);
    });

    it("notes possible missing amortisation only when the cascade conditions all hold", () => {
        const triggering = resolveValuation(
            [
                report(2025, {
                    balancesheet: { intangibleAssets: 100, equity: 1 },
                    incomeStatement: {
                        revenue: 1,
                        profitLossFromOrdinaryActivitiesBeforeTax: 1,
                        depreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss: 50,
                    },
                }),
            ],
            context(),
        );
        assert.ok(triggering.notes.some((n) => n.text.startsWith("Tjek efter afskrivninger")));

        const reported = resolveValuation(
            [
                report(2025, {
                    balancesheet: { intangibleAssets: 100, equity: 1 },
                    incomeStatement: {
                        revenue: 1,
                        profitLossFromOrdinaryActivitiesBeforeTax: 1,
                        depreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss: 50,
                    },
                    notes: { amortisationOfIntangibleAssets: 20 },
                }),
            ],
            context(),
        );
        assert.ok(!reported.notes.some((n) => n.text.startsWith("Tjek efter afskrivninger")));
    });
});

describe("resolveValuation — currency", () => {
    it("sets the exchange rate for DKK and routes the non-DKK note to the passive sheet", () => {
        const resolved = resolveValuation(
            [report(2025, { unit: "EUR" }), report(2024)],
            context({ companyIndex: 3, mode: "TWO_YEAR" }),
        );
        assert.equal(resolved.years[0].exchangeRate, null);
        assert.equal(resolved.years[1].exchangeRate, 1);
        assert.equal(resolved.years[1].currencyName, "Danske kroner");

        // Quirk parity: the note targets the passive-test notepad by GROUP index.
        const note = resolved.notes.find((n) => n.text === "INDTAST VALUTAKURS");
        assert.deepEqual(note, {
            text: "INDTAST VALUTAKURS",
            fit: true,
            sheet: "PASSIVE_ASSET_TEST",
            notepad: "DOSMERSEDDEL_3",
        });
    });
});
