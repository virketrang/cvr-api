import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { Account, AnnualReport } from "../annual-reports/annual-report.types.js";
import { buildFinancialIncomeIndex, TaxonomyIndex } from "./taxonomy-engine.js";
import { resolvePassiveTest, type PassiveTestContext } from "./passive-test-resolver.js";
import { container, financialIncomeRow, smallTaxonomy } from "./test-fixtures.js";
import type { SuccessionMode } from "./project-resolution.types.js";

function report(
    endYear: number,
    values: {
        balancesheet?: Record<string, number | null>;
        incomeStatement?: Record<string, number | null>;
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
        notes: container({}) as never,
        relatedEntities: [],
        consolidatedFinancialStatements: [],
        warnings: [],
    };
}

function context(overrides: Partial<PassiveTestContext> = {}): PassiveTestContext {
    return {
        mode: "THREE_YEAR" as SuccessionMode,
        passiveSlot: 1,
        unpublishedAnnualReport: "GØR IKKE PLADS",
        taxonomy: new TaxonomyIndex(smallTaxonomy()),
        financialIncome: buildFinancialIncomeIndex([
            financialIncomeRow({ concept: "otherFinanceIncome", label: "Øvrige finansielle indtægter" }),
            financialIncomeRow({
                concept: "incomeFromInvestmentsInGroupEnterprises",
                label: "Indtægter af kapitalandele",
                includeInPassiveTest: false,
                note: "Indtægter af kapitalandele indgår ikke i testen.",
            }),
        ]),
        currencyNameOf: (unit) => (unit === "DKK" ? "Danske kroner" : ""),
        today: new Date("2026-07-07"),
        ...overrides,
    };
}

describe("resolvePassiveTest — year slotting", () => {
    it("caps the years per succession mode (1/1/2/3)", () => {
        const reports = [2025, 2024, 2023, 2022].map((y) => report(y));
        assert.equal(resolvePassiveTest(reports, context({ mode: "DATE_OF_TRANSFER" })).years.length, 1);
        assert.equal(resolvePassiveTest(reports, context({ mode: "ONE_YEAR" })).years.length, 1);
        assert.equal(resolvePassiveTest(reports, context({ mode: "TWO_YEAR" })).years.length, 2);
        assert.equal(resolvePassiveTest(reports, context({ mode: "THREE_YEAR" })).years.length, 3);
    });

    it("fills the transfer-date block from the newest report when it lands in slot 1", () => {
        const resolved = resolvePassiveTest(
            [report(2025, { balancesheet: { assets: 900 } })],
            context({ mode: "DATE_OF_TRANSFER" }),
        );
        assert.equal(resolved.dateOfTransfer?.dateOfValuation, "2025-12-31");
        assert.deepEqual(resolved.dateOfTransfer?.totalAssets, { concept: "assets", value: 900 });
        assert.equal(resolved.years[0].slot, 1);
    });

    it("suppresses the transfer-date block and shifts the years on an unpublished-report shift", () => {
        const resolved = resolvePassiveTest(
            [report(2024), report(2023), report(2022)],
            context({ unpublishedAnnualReport: "GØR PLADS" }),
        );
        assert.equal(resolved.dateOfTransfer, null);
        // Shift pushes years to slots 2..3 and the oldest report falls off.
        assert.deepEqual(
            resolved.years.map((y) => [y.slot, y.endDate]),
            [
                [2, "2024-12-31"],
                [3, "2023-12-31"],
            ],
        );
    });

    it("writes the shifted year even when the mode only shows one year (VBA parity)", () => {
        const resolved = resolvePassiveTest(
            [report(2024), report(2023)],
            context({ mode: "ONE_YEAR", unpublishedAnnualReport: "GØR PLADS" }),
        );
        // The first report shifts into slot 2 (a hidden row in 1-year mode) and the
        // second iteration stops on the mode cap.
        assert.deepEqual(
            resolved.years.map((y) => y.slot),
            [2],
        );
        assert.equal(resolved.dateOfTransfer, null);
    });
});

describe("resolvePassiveTest — line items", () => {
    it("keeps only taxonomy-approved leaves and fires notes even for excluded rows", () => {
        const resolved = resolvePassiveTest(
            [
                report(2025, {
                    balancesheet: {
                        assets: 1000, // parent with reported descendants → dropped
                        nonCurrentAssets: 800, // parent with reported descendant → dropped
                        landAndBuildings: 500, // leaf with a passive note → kept + note
                        cashAndCashEquivalents: 200, // includeInPassiveTest = false → dropped
                        shorttermInvestments: 0, // zero → dropped
                        unknownConcept: 300, // not in the taxonomy → dropped
                    },
                }),
            ],
            context({ passiveSlot: 4 }),
        );

        assert.deepEqual(resolved.years[0].assets, [
            { concept: "landAndBuildings", label: "Grunde og bygninger", category: "PASSIV", value: 500 },
        ]);
        // The transfer-date block fills from slot 1 in every mode (VBA parity), so
        // its prefixed copy of the taxonomy note fires as well.
        assert.deepEqual(resolved.dateOfTransfer?.assets, resolved.years[0].assets);
        const taxonomyNotes = resolved.notes.filter((n) => n.text.includes("passiv kapitalanbringelse"));
        assert.deepEqual(taxonomyNotes, [
            {
                text: "Overdragelsesdato: Vurder om ejendommen er passiv kapitalanbringelse.",
                fit: true,
                sheet: "PASSIVE_ASSET_TEST",
                notepad: "DOSMERSEDDEL_4",
            },
            {
                text: "År 1: Vurder om ejendommen er passiv kapitalanbringelse.",
                fit: true,
                sheet: "PASSIVE_ASSET_TEST",
                notepad: "DOSMERSEDDEL_4",
            },
        ]);
    });

    it("builds income items from the financial-income taxonomy with its notes and filters", () => {
        const resolved = resolvePassiveTest(
            [
                report(2025, {
                    incomeStatement: {
                        revenue: 100,
                        otherFinanceIncome: 40, // included
                        incomeFromInvestmentsInGroupEnterprises: 60, // excluded, but note fires
                    },
                }),
            ],
            context(),
        );

        assert.deepEqual(resolved.years[0].income, [
            { concept: "otherFinanceIncome", label: "Øvrige finansielle indtægter", category: null, value: 40 },
        ]);
        assert.ok(
            resolved.notes.some((n) => n.text === "År 1: Indtægter af kapitalandele indgår ikke i testen."),
        );
        // Income from subsidiaries still sums the fixed concept list regardless.
        assert.deepEqual(
            resolved.years[0].incomeFromSubsidiaries.map((c) => [c.concept, c.value]),
            [["incomeFromInvestmentsInGroupEnterprises", 60]],
        );
    });

    it("sums revenue components and notes a missing revenue", () => {
        const withRevenue = resolvePassiveTest(
            [report(2025, { incomeStatement: { revenue: 100, otherOperatingIncome: 25 } })],
            context(),
        );
        assert.deepEqual(
            withRevenue.years[0].revenue.map((c) => c.value),
            [100, 25],
        );
        assert.equal(withRevenue.years[0].hasRevenue, true);

        const withoutRevenue = resolvePassiveTest([report(2025)], context());
        assert.equal(withoutRevenue.years[0].hasRevenue, false);
        assert.ok(withoutRevenue.notes.some((n) => n.text === "År 1: Indsæt nettoomsætningen."));
    });

    it("sums the six shares-in-subsidiaries concepts", () => {
        const resolved = resolvePassiveTest(
            [
                report(2025, {
                    balancesheet: {
                        longtermInvestmentsInGroupEnterprises: 100,
                        longtermParticipatingInterests: 50,
                        shorttermInvestmentsInGroupEnterprises: 0,
                    },
                }),
            ],
            context(),
        );
        assert.deepEqual(
            resolved.years[0].bookValueOfSharesInSubsidiaries.map((c) => [c.concept, c.value]),
            [
                ["longtermInvestmentsInGroupEnterprises", 100],
                ["longtermParticipatingInterests", 50],
            ],
        );
    });

    it("notes a missing exchange rate for non-DKK reports on both blocks", () => {
        const resolved = resolvePassiveTest(
            [report(2025, { unit: "EUR" })],
            context({ mode: "DATE_OF_TRANSFER", passiveSlot: 2 }),
        );
        assert.equal(resolved.dateOfTransfer?.exchangeRate, null);
        assert.deepEqual(
            resolved.notes.filter((n) => n.text.includes("VALUTAKURS")).map((n) => n.text),
            ["Overdragelsesdato: INDTAST VALUTAKURS", "År 1: INDTAST VALUTAKURS"],
        );
    });
});
