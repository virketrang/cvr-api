/**
 * Syntetiske minimalrapporter pr. kontrol: én der består, én der bryder, én
 * hvor koncepterne mangler (forventning: intet fund). Plus de to BAL-005-fælder
 * (forælder+børn indberettet samtidig; landAndBuildings vs land+buildings) og
 * tolerance-testen for t.kr.-afrunding.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import type { Account, AnnualReport, GroupEntityFromNotes } from "../../modules/annual-reports/annual-report.types.js";
import { registry, runValidation } from "../registry.js";
import type { ValidationFinding } from "../types.js";

function account(value: number): Account {
    return { value, unit: "DKK", label: "" };
}

type SparseReport = {
    start?: string;
    end?: string;
    balancesheet?: Record<string, number>;
    incomeStatement?: Record<string, number>;
    notes?: Record<string, number>;
    groupEntitiesFromNotes?: Array<Partial<GroupEntityFromNotes>>;
    consolidated?: { balancesheet?: Record<string, number>; incomeStatement?: Record<string, number> } | null;
};

function makeReport(spec: SparseReport): AnnualReport<Account> {
    const toAccounts = (record: Record<string, number> | undefined) =>
        Object.fromEntries(Object.entries(record ?? {}).map(([key, value]) => [key, account(value)]));
    return {
        reportingPeriod: {
            reportingPeriodStartDate: spec.start ?? "2024-01-01",
            reportingPeriodEndDate: spec.end ?? "2024-12-31",
        },
        unit: "DKK",
        balancesheet: toAccounts(spec.balancesheet),
        incomeStatement: toAccounts(spec.incomeStatement),
        notes: toAccounts(spec.notes),
        groupEntitiesFromNotes: (spec.groupEntitiesFromNotes ?? []) as GroupEntityFromNotes[],
        consolidatedFinancialStatements: [],
        consolidated: spec.consolidated
            ? {
                  incomeStatement: toAccounts(spec.consolidated.incomeStatement),
                  balancesheet: toAccounts(spec.consolidated.balancesheet),
                  notes: {},
              }
            : null,
        warnings: [],
        validation: [],
    } as unknown as AnnualReport<Account>;
}

function findingsFor(reports: AnnualReport<Account> | Array<AnnualReport<Account>>, id?: string): ValidationFinding[] {
    const list = Array.isArray(reports) ? reports : [reports];
    runValidation(list, new Set());
    const all = list.flatMap((r) => r.validation);
    return id ? all.filter((f) => f.id === id) : all;
}

// ---- BAL-001 ----
test("BAL-001: består, bryder, mangler", () => {
    assert.equal(findingsFor(makeReport({ balancesheet: { assets: 100_000, liabilitiesAndEquity: 100_000 } }), "BAL-001").length, 0);
    const broken = findingsFor(makeReport({ balancesheet: { assets: 100_000, liabilitiesAndEquity: 90_000 } }), "BAL-001");
    assert.equal(broken.length, 1);
    assert.equal(broken[0].severity, "error");
    assert.equal(findingsFor(makeReport({ balancesheet: { assets: 100_000 } }), "BAL-001").length, 0);
});

// ---- BAL-002 ----
test("BAL-002: kræver begge børn; bryder ved afvigelse", () => {
    assert.equal(
        findingsFor(makeReport({ balancesheet: { assets: 100_000, nonCurrentAssets: 60_000, currentAssets: 40_000 } }), "BAL-002").length,
        0,
    );
    assert.equal(
        findingsFor(makeReport({ balancesheet: { assets: 100_000, nonCurrentAssets: 60_000, currentAssets: 30_000 } }), "BAL-002").length,
        1,
    );
    // Kun ét barn indberettet: BAL-002 er betinget af begge børn og tier stille.
    assert.equal(findingsFor(makeReport({ balancesheet: { assets: 100_000, currentAssets: 30_000 } }), "BAL-002").length, 0);
});

// ---- BAL-003 (med roll-up gennem uindberettede mellemniveauer) ----
test("BAL-003: består via roll-up af land+buildings uden ppe-subtotal", () => {
    const report = makeReport({
        balancesheet: { nonCurrentAssets: 100_000, land: 60_000, buildings: 40_000 },
    });
    assert.equal(findingsFor(report, "BAL-003").length, 0);
});

test("BAL-003: bryder når et tilstedeværende led ikke forklarer totalen", () => {
    const report = makeReport({
        balancesheet: { nonCurrentAssets: 100_000, intangibleAssets: 40_000, propertyPlantAndEquipment: 30_000 },
    });
    const findings = findingsFor(report, "BAL-003");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].deviation, 30_000);
});

// ---- BAL-004 ----
test("BAL-004: består og bryder", () => {
    assert.equal(
        findingsFor(
            makeReport({ balancesheet: { liabilitiesAndEquity: 100_000, equity: 50_000, provisions: 20_000, liabilitiesOtherThanProvisions: 30_000 } }),
            "BAL-004",
        ).length,
        0,
    );
    assert.equal(
        findingsFor(
            makeReport({ balancesheet: { liabilitiesAndEquity: 100_000, equity: 50_000, liabilitiesOtherThanProvisions: 30_000 } }),
            "BAL-004",
        ).length,
        1,
    );
});

// ---- BAL-005: fælde 1 — forælder og børn indberettet samtidig (ingen dobbelttælling) ----
test("BAL-005: forælder+børn samtidig tæller kun forælderen i bedsteforælderens residual", () => {
    const report = makeReport({
        balancesheet: {
            propertyPlantAndEquipment: 100_000,
            landAndBuildings: 100_000,
            land: 60_000,
            buildings: 40_000,
        },
    });
    assert.equal(findingsFor(report, "BAL-005").length, 0);
});

// ---- BAL-005: fælde 2 — landAndBuildings kontrolleres separat mod land + buildings ----
test("BAL-005: landAndBuildings vs land+buildings", () => {
    const report = makeReport({
        balancesheet: { landAndBuildings: 100_000, land: 50_000, buildings: 40_000 },
    });
    const findings = findingsFor(report, "BAL-005");
    assert.equal(findings.length, 1);
    assert.ok(findings[0].concepts?.includes("landAndBuildings"));
    assert.equal(findings[0].deviation, 10_000);
});

// ---- BAL-005: alternativer tæller kun én gang ----
test("BAL-005: maturitetsopdelt og uopdelt variant af samme linje dobbelttælles ikke", () => {
    const report = makeReport({
        balancesheet: {
            shorttermLiabilitiesOtherThanProvisions: 100_000,
            shorttermTradePayables: 60_000,
            tradePayables: 60_000,
            otherShorttermPayables: 40_000,
        },
    });
    assert.equal(findingsFor(report, "BAL-005").length, 0);
});

// ---- BAL-005: udbytte indregnet i egenkapitalen kan lovligt være en bevægelse ----
test("BAL-005: egenkapitalen består med og uden foreslået ekstraordinært udbytte", () => {
    const base = { contributedCapital: 50_000, retainedEarnings: 50_000, proposedExtraordinaryDividendRecognisedInEquity: 35_000 };
    assert.equal(findingsFor(makeReport({ balancesheet: { equity: 100_000, ...base } }), "BAL-005").length, 0);
    assert.equal(findingsFor(makeReport({ balancesheet: { equity: 135_000, ...base } }), "BAL-005").length, 0);
    assert.equal(findingsFor(makeReport({ balancesheet: { equity: 120_000, ...base } }), "BAL-005").length, 1);
});

// ---- Tolerance: t.kr.-afrunding må ikke give falske positiver ----
test("tolerance: sammentælling der afviger med præcis 1.000 pga. t.kr.-afrunding giver intet fund", () => {
    const report = makeReport({
        balancesheet: { intangibleAssets: 1_000_000, goodwill: 500_000, acquiredLicences: 499_000 },
    });
    assert.equal(findingsFor(report, "BAL-005").length, 0);
});

// ---- RES-001 ----
test("RES-001: består, bryder, springes over i bruttoresultat-skemaet", () => {
    assert.equal(
        findingsFor(makeReport({ incomeStatement: { grossResult: 50_000, revenue: 100_000, otherExternalExpenses: 50_000 } }), "RES-001").length,
        0,
    );
    const broken = findingsFor(
        makeReport({ incomeStatement: { grossResult: 40_000, revenue: 100_000, otherExternalExpenses: 50_000 } }),
        "RES-001",
    );
    assert.equal(broken.length, 1);
    assert.equal(broken[0].severity, "warning");
    // Bruttoresultat-skema: hverken omsætning eller vareforbrug — helt tavs.
    assert.equal(findingsFor(makeReport({ incomeStatement: { grossProfitLoss: 40_000, employeeBenefitsExpense: 20_000 } }), "RES-001").length, 0);
});

// ---- RES-002 ----
test("RES-002: består, bryder, mangler", () => {
    const passing = {
        grossProfitLoss: 50_000,
        employeeBenefitsExpense: 15_000,
        depreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss: 5_000,
        profitLossFromOrdinaryOperatingActivities: 30_000,
    };
    assert.equal(findingsFor(makeReport({ incomeStatement: passing }), "RES-002").length, 0);
    const broken = findingsFor(
        makeReport({ incomeStatement: { ...passing, profitLossFromOrdinaryOperatingActivities: 20_000 } }),
        "RES-002",
    );
    assert.equal(broken.length, 1);
    assert.equal(broken[0].severity, "error");
    assert.equal(findingsFor(makeReport({ incomeStatement: { grossProfitLoss: 50_000 } }), "RES-002").length, 0);
});

// ---- RES-003 (facit-eksempel fra Jettime 2024/25, t.kr.) ----
test("RES-003: Jettime-facit 70.326 == 73.874 + (862 − 95 + 4.233) − 8.548", () => {
    const statement = {
        profitLossFromOrdinaryOperatingActivities: 73_874,
        incomeFromInvestmentsInGroupEnterprises: 862,
        incomeFromInvestmentsInAssociates: -95,
        otherFinanceIncome: 4_233,
        otherFinanceExpenses: 8_548,
        profitLossFromOrdinaryActivitiesBeforeTax: 70_326,
    };
    assert.equal(findingsFor(makeReport({ incomeStatement: statement }), "RES-003").length, 0);
    const broken = findingsFor(
        makeReport({ incomeStatement: { ...statement, profitLossFromOrdinaryActivitiesBeforeTax: 71_326 } }),
        "RES-003",
    );
    assert.equal(broken.length, 1);
});

test("RES-003: otherFinanceExpenses fortrænger sine underled (ingen dobbelttælling)", () => {
    const statement = {
        profitLossFromOrdinaryOperatingActivities: 100_000,
        otherFinanceExpenses: 20_000,
        financeExpensesArisingFromGroupEnterprises: 5_000,
        restOfOtherFinanceExpenses: 15_000,
        profitLossFromOrdinaryActivitiesBeforeTax: 80_000,
    };
    assert.equal(findingsFor(makeReport({ incomeStatement: statement }), "RES-003").length, 0);
});

// ---- RES-004 (facit: 56.721 == 70.326 − 13.605) ----
test("RES-004: består, bryder, mangler", () => {
    const statement = {
        profitLossFromOrdinaryActivitiesBeforeTax: 70_326,
        taxExpense: 13_605,
        profitLoss: 56_721,
    };
    assert.equal(findingsFor(makeReport({ incomeStatement: statement }), "RES-004").length, 0);
    assert.equal(
        findingsFor(makeReport({ incomeStatement: { ...statement, profitLoss: 58_000 } }), "RES-004").length,
        1,
    );
    assert.equal(findingsFor(makeReport({ incomeStatement: { profitLoss: 56_721 } }), "RES-004").length, 0);
});

// ---- RES-005 ----
test("RES-005: note-afskrivninger må ikke overstige resultatopgørelsens linje", () => {
    const line = "depreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss";
    assert.equal(
        findingsFor(makeReport({ notes: { amortisationOfIntangibleAssets: 4_000 }, incomeStatement: { [line]: 5_000 } }), "RES-005").length,
        0,
    );
    const broken = findingsFor(
        makeReport({ notes: { amortisationOfIntangibleAssets: 10_000 }, incomeStatement: { [line]: 5_000 } }),
        "RES-005",
    );
    assert.equal(broken.length, 1);
    assert.equal(broken[0].severity, "warning");
});

// ---- XCH-001 ----
test("XCH-001: består med udbytte, bryder ved uforklaret bevægelse", () => {
    const older = makeReport({ start: "2023-01-01", end: "2023-12-31", balancesheet: { equity: 100_000 } });
    const passing = makeReport({
        start: "2024-01-01",
        end: "2024-12-31",
        balancesheet: { equity: 140_000, proposedDividendRecognisedInEquity: 10_000 },
        incomeStatement: { profitLoss: 50_000 },
    });
    assert.equal(findingsFor([passing, structuredClone(older)], "XCH-001").length, 0);

    const broken = makeReport({
        start: "2024-01-01",
        end: "2024-12-31",
        balancesheet: { equity: 200_000 },
        incomeStatement: { profitLoss: 50_000 },
    });
    const findings = findingsFor([broken, structuredClone(older)], "XCH-001");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "warning");
});

// ---- XCH-002 ----
test("XCH-002: info ved afvigelse, tavs ved lighed og manglende koncepter", () => {
    const equal = makeReport({
        balancesheet: { reserveForNetRevaluationAccordingToEquityMethod: 12_000, longtermInvestmentsInGroupEnterprises: 12_000 },
    });
    assert.equal(findingsFor(equal, "XCH-002").length, 0);
    const differing = makeReport({
        balancesheet: { reserveForNetRevaluationAccordingToEquityMethod: 10_000, longtermInvestmentsInGroupEnterprises: 12_000 },
    });
    const findings = findingsFor(differing, "XCH-002");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "info");
    assert.equal(findingsFor(makeReport({ balancesheet: { longtermInvestmentsInGroupEnterprises: 12_000 } }), "XCH-002").length, 0);
});

// ---- PER-001 ----
test("PER-001: sammenhængende (inkl. 1-måneders periode) tavs; hul warner; overlap er error", () => {
    const contiguous = [
        makeReport({ start: "2022-01-01", end: "2022-12-31" }),
        makeReport({ start: "2021-12-01", end: "2021-12-31" }),
        makeReport({ start: "2021-01-01", end: "2021-11-30" }),
    ];
    assert.equal(findingsFor(contiguous, "PER-001").length, 0);

    const gap = [
        makeReport({ start: "2024-01-01", end: "2024-12-31" }),
        makeReport({ start: "2022-01-01", end: "2022-12-31" }),
    ];
    const gapFindings = findingsFor(gap, "PER-001");
    assert.equal(gapFindings.length, 1);
    assert.equal(gapFindings[0].severity, "warning");

    const overlap = [
        makeReport({ start: "2022-12-01", end: "2023-11-30" }),
        makeReport({ start: "2022-01-01", end: "2022-12-31" }),
    ];
    const overlapFindings = findingsFor(overlap, "PER-001");
    assert.equal(overlapFindings.length, 1);
    assert.equal(overlapFindings[0].severity, "error");
});

// ---- SCL-001 ----
test("SCL-001: faktor > 20 warner; skæv periodelængde helårsomregnes og warner ikke", () => {
    const jump = [
        makeReport({ start: "2024-01-01", end: "2024-12-31", incomeStatement: { revenue: 1_000_000 } }),
        makeReport({ start: "2023-01-01", end: "2023-12-31", incomeStatement: { revenue: 30_000 } }),
    ];
    const findings = findingsFor(jump, "SCL-001");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "warning");

    // 1 måneds omsætning vs. et helt år: proportionalt ens efter helårsomregning.
    const shortPeriod = [
        makeReport({ start: "2024-01-01", end: "2024-12-31", incomeStatement: { revenue: 1_200_000 } }),
        makeReport({ start: "2023-12-01", end: "2023-12-31", incomeStatement: { revenue: 100_000 } }),
    ];
    assert.equal(findingsFor(shortPeriod, "SCL-001").length, 0);
});

// ---- SCL-002 ----
test("SCL-002: mere end 3 dekaders forskel på omsætning og balancesum er info", () => {
    const report = makeReport({ incomeStatement: { revenue: 1_000 }, balancesheet: { assets: 10_000_000 } });
    const findings = findingsFor(report, "SCL-002");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "info");
    assert.equal(
        findingsFor(makeReport({ incomeStatement: { revenue: 5_000_000 }, balancesheet: { assets: 10_000_000 } }), "SCL-002").length,
        0,
    );
});

// ---- SCL-003 ----
test("SCL-003: blandet brøk/procent på tværs af år warner; ensartet er tavs", () => {
    const entity = (raw: number): Partial<GroupEntityFromNotes> => ({
        name: "Datter ApS",
        source: "structured",
        ownershipPercentage: 100,
        ownershipPercentageAsReported: raw,
    });
    const mixed = [
        makeReport({ start: "2024-01-01", end: "2024-12-31", groupEntitiesFromNotes: [entity(1)] }),
        makeReport({ start: "2023-01-01", end: "2023-12-31", groupEntitiesFromNotes: [entity(100)] }),
    ];
    const findings = findingsFor(mixed, "SCL-003");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "warning");

    const uniform = [
        makeReport({ start: "2024-01-01", end: "2024-12-31", groupEntitiesFromNotes: [entity(100)] }),
        makeReport({ start: "2023-01-01", end: "2023-12-31", groupEntitiesFromNotes: [entity(100)] }),
    ];
    assert.equal(findingsFor(uniform, "SCL-003").length, 0);
});

// ---- SGN-001 ----
test("SGN-001: negativ aktivpost warner pr. koncept; reguleringskonti er undtaget", () => {
    const findings = findingsFor(makeReport({ balancesheet: { goodwill: -5_000, assets: 100_000 } }), "SGN-001");
    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0].concepts, ["goodwill"]);
    assert.equal(
        findingsFor(
            makeReport({ balancesheet: { costExceedsIncomeForTheFinancialYearShorttermReceivables: -5_000, assets: 100_000 } }),
            "SGN-001",
        ).length,
        0,
    );
});

// ---- SGN-002 ----
test("SGN-002: modsat fortegn på skat og resultat før skat er info", () => {
    assert.equal(
        findingsFor(
            makeReport({ incomeStatement: { taxExpense: -5_000, profitLossFromOrdinaryActivitiesBeforeTax: 50_000 } }),
            "SGN-002",
        ).length,
        1,
    );
    assert.equal(
        findingsFor(
            makeReport({ incomeStatement: { taxExpense: 11_000, profitLossFromOrdinaryActivitiesBeforeTax: 50_000 } }),
            "SGN-002",
        ).length,
        0,
    );
});

// ---- SRC-001 ----
test("SRC-001: identisk selskabs- og koncernbalancesum er error; forskellig er tavs", () => {
    const identical = makeReport({
        balancesheet: { assets: 100_000 },
        consolidated: { balancesheet: { assets: 100_000 } },
    });
    const findings = findingsFor(identical, "SRC-001");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "error");

    const differing = makeReport({
        balancesheet: { assets: 100_000 },
        consolidated: { balancesheet: { assets: 150_000 } },
    });
    assert.equal(findingsFor(differing, "SRC-001").length, 0);
});

// ---- Robusthed: en kontrol der kaster, vælter ikke de øvrige ----
test("en exception i én kontrol logges og påvirker ikke svaret", () => {
    const throwing = {
        id: "TST-999",
        scope: "report" as const,
        run() {
            throw new Error("kaboom");
        },
    };
    registry.push(throwing);
    try {
        const report = makeReport({ balancesheet: { assets: 100_000, liabilitiesAndEquity: 90_000 } });
        const findings = findingsFor(report, "BAL-001");
        assert.equal(findings.length, 1);
    } finally {
        registry.splice(registry.indexOf(throwing), 1);
    }
});
