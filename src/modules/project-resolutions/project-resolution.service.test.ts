import { describe, it } from "node:test";
import assert from "node:assert/strict";

import ProjectResolutionService, { reportingPeriodsFor, resolveSuccessionMode } from "./project-resolution.service.js";
import type { ProjectResolutionRequestBody } from "./project-resolution.schema.js";
import type { BatchAnnualReportResponse } from "../annual-reports/annual-report.types.js";
import type { ResolutionSettings, SuccessionMode } from "./project-resolution.types.js";
import { container, financialIncomeRow, smallTaxonomy } from "./test-fixtures.js";

const MODE_LABELS = {
    noCalculation: "INGEN SUCCESSIONSOPGØRELSE",
    dateOfTransfer: "OVERDRAGELSESDATO",
    oneYear: "1 REGNSKABSÅR",
    twoYear: "2 REGNSKABSÅR",
    threeYear: "3 REGNSKABSÅR",
};

function settings(overrides: Partial<ResolutionSettings> = {}): ResolutionSettings {
    return {
        corporateTaxRate: 0.22,
        minVotingRights: 0.5,
        minIndirectOwnership: 0.5,
        maximumNumberOfCompanies: 60,
        maxPassiveAssetTestCompanies: 47,
        successionModes: MODE_LABELS,
        reportingPeriodsLookup: {
            oneYear: [3, 4, 5, 6],
            twoYear: [4, 5, 6, 7],
            threeYear: [5, 6, 7, 8],
        },
        currencies: [{ code: "DKK", name: "Danske kroner", symbol: "kr." }],
        corporateFormLabels: {
            limitedLiabilityCompany: "Kapitalselskab",
            soleProprietorship: "Personligt ejet virksomhed",
        },
        assetTaxonomy: smallTaxonomy(),
        financialIncomeTaxonomy: [financialIncomeRow({ concept: "otherFinanceIncome" })],
        ...overrides,
    };
}

function requestBody(
    groupOverrides?: Partial<ProjectResolutionRequestBody["formData"]["corporateGroup"][number]>[],
    settingsOverrides: Partial<ResolutionSettings> = {},
    formOverrides: Partial<ProjectResolutionRequestBody["formData"]> = {},
): ProjectResolutionRequestBody {
    const groupDefaults = [
        {
            cvr: "11111111",
            name: "Mor ApS",
            level: 0,
            parent: null,
            corporateForm: { code: 80, name: "ApS", abbreviation: "ApS" },
            votingRightsPercentage: { interval: { from: 1, to: 1 } },
            ownershipPercentage: { directOwnership: 1 },
            consolidate: false,
        },
        {
            cvr: "22222222",
            name: "Datter ApS",
            level: 1,
            parent: { name: "Mor ApS", cvr: "11111111" },
            corporateForm: { code: 60, name: "A/S", abbreviation: "A/S" },
            votingRightsPercentage: { interval: { from: 0.75, to: 1 } },
            ownershipPercentage: { directOwnership: 0.75 },
            consolidate: true,
        },
    ];

    const corporateGroup = (groupOverrides ?? [{}, {}]).map((override, i) => ({
        ...groupDefaults[Math.min(i, groupDefaults.length - 1)],
        ...override,
    }));

    return {
        formData: {
            cvr: "11111111",
            unpublishedAnnualReport: "GØR IKKE PLADS",
            owner: "FYSISK PERSON",
            autocomplete: "JA",
            currencyCode: "SYMBOL",
            successionPeriod: MODE_LABELS.threeYear,
            dateOfTransfer: "2026-01-01",
            corporateGroup,
            ...formOverrides,
        },
        settings: settings(settingsOverrides),
    } as ProjectResolutionRequestBody;
}

function batchResponse(results: BatchAnnualReportResponse["results"]): BatchAnnualReportResponse {
    return { total: results.length, status: "success", results };
}

function makeReport(endYear: number, balancesheet: Record<string, number | null> = { equity: 100 }) {
    return {
        reportingPeriod: {
            reportingPeriodStartDate: `${endYear}-01-01`,
            reportingPeriodEndDate: `${endYear}-12-31`,
        },
        unit: "DKK",
        balancesheet: container(balancesheet) as never,
        incomeStatement: container({ revenue: 10, profitLossFromOrdinaryActivitiesBeforeTax: 5 }) as never,
        notes: container({}) as never,
        relatedEntities: [],
        consolidatedFinancialStatements: [],
        warnings: [],
    };
}

describe("resolveSuccessionMode", () => {
    it("matches labels case- and whitespace-insensitively", () => {
        assert.equal(resolveSuccessionMode("  3 regnskabsår ", settings()), "THREE_YEAR");
        assert.equal(resolveSuccessionMode("OVERDRAGELSESDATO", settings()), "DATE_OF_TRANSFER");
    });

    it("rejects unknown labels", () => {
        assert.throws(() => resolveSuccessionMode("noget helt andet", settings()), /Ukendt passiv-aktiv-test tilstand/);
    });
});

describe("reportingPeriodsFor", () => {
    const config = settings();
    const success = (total: number) => ({ status: "success", total });

    it("defaults to 3 without fetched reports", () => {
        assert.equal(reportingPeriodsFor(undefined, "ONE_YEAR", config), 3);
        assert.equal(reportingPeriodsFor({ status: "error", total: 0 }, "ONE_YEAR", config), 3);
    });

    it("uses the first entry below 3 reports and the last from 7 reports", () => {
        assert.equal(reportingPeriodsFor(success(0), "ONE_YEAR", config), 3);
        assert.equal(reportingPeriodsFor(success(2), "TWO_YEAR", config), 4);
        assert.equal(reportingPeriodsFor(success(7), "THREE_YEAR", config), 8);
        assert.equal(reportingPeriodsFor(success(12), "ONE_YEAR", config), 6);
    });

    it("indexes the vector at totalReports - 1 for 3-6 reports (VBA Select Case)", () => {
        // oneYear vector is [3, 4, 5, 6]; 1-based index totalReports - 1.
        assert.equal(reportingPeriodsFor(success(3), "ONE_YEAR", config), 4);
        assert.equal(reportingPeriodsFor(success(4), "ONE_YEAR", config), 5);
        assert.equal(reportingPeriodsFor(success(6), "ONE_YEAR", config), 6);
    });

    it("picks the vector by mode, with 1-year doubling for date-of-transfer/no-calculation", () => {
        assert.equal(reportingPeriodsFor(success(4), "THREE_YEAR", config), 7);
        assert.equal(reportingPeriodsFor(success(4), "DATE_OF_TRANSFER", config), 5);
    });
});

describe("ProjectResolutionService.resolveProject", () => {
    it("resolves a two-company group end to end with a stubbed batch", async () => {
        const fetched: number[][] = [];
        const result = await ProjectResolutionService.resolveProject(requestBody(), {
            today: new Date("2026-07-07"),
            fetchAnnualReportsBatch: async (cvrNumbers) => {
                fetched.push(cvrNumbers);
                return batchResponse([
                    {
                        cvrNumber: "11111111",
                        status: "success",
                        total: 2,
                        results: [makeReport(2025), makeReport(2024)] as never,
                        skipped: [],
                    },
                    {
                        cvrNumber: "22222222",
                        status: "success",
                        total: 1,
                        results: [makeReport(2025)] as never,
                        skipped: [],
                    },
                ]);
            },
        });

        assert.deepEqual(fetched, [[11111111, 22222222]]);
        assert.equal(result.status, "success");
        assert.equal(result.successionMode, "THREE_YEAR");
        assert.equal(result.numberOfCompanies, 2);
        assert.equal(result.numberOfPassiveTestCompanies, 2);

        const [parent, subsidiary] = result.companies;
        assert.equal(parent.isParent, true);
        assert.equal(parent.overviewRow.corporateForm, "Kapitalselskab");
        assert.equal(parent.overviewRow.owner, "");
        assert.equal(parent.overviewRow.directOwnershipPercent, 100);
        assert.equal(parent.valuation.years.length, 2);
        assert.equal(parent.passiveCompanySlot, 1);

        assert.equal(subsidiary.overviewRow.owner, "Mor ApS");
        assert.equal(subsidiary.ownership.indirect, 0.75);
        assert.equal(subsidiary.passiveCompanySlot, 2);
        // Wizard checkbox exposed but the overview stays "NEJ" (VBA batch parity).
        assert.equal(subsidiary.consolidateRequested, true);
        assert.equal(subsidiary.overviewRow.consolidate, false);
        // reportingPeriods: totalReports=1 < 3 → first entry of threeYear vector.
        assert.equal(subsidiary.overviewRow.reportingPeriods, 5);
    });

    it("excludes companies below the voting gate and reports them", async () => {
        const result = await ProjectResolutionService.resolveProject(
            requestBody([{}, { votingRightsPercentage: { interval: { from: 0.25, to: 0.5 } } }]),
            {
                today: new Date("2026-07-07"),
                fetchAnnualReportsBatch: async () => batchResponse([]),
            },
        );

        assert.equal(result.numberOfCompanies, 1);
        assert.equal(result.excludedCompanies.length, 1);
        assert.equal(result.excludedCompanies[0].cvr, "22222222");
        assert.match(result.excludedCompanies[0].reason, /under minimumskravet/);
    });

    it("dedupes batch results by normalized CVR (first wins) and defaults missing reports", async () => {
        const result = await ProjectResolutionService.resolveProject(requestBody(), {
            today: new Date("2026-07-07"),
            fetchAnnualReportsBatch: async () =>
                batchResponse([
                    {
                        cvrNumber: "11111111",
                        status: "success",
                        total: 1,
                        results: [makeReport(2025)] as never,
                        skipped: [],
                    },
                    {
                        // Duplicate with different padding — must lose to the first.
                        cvrNumber: "11111111",
                        status: "error",
                        total: 0,
                        results: [],
                        skipped: [],
                        message: "burde ikke vinde",
                    },
                ]),
        });

        const [parent, subsidiary] = result.companies;
        assert.equal(parent.reportStatus.status, "success");
        assert.equal(parent.valuation.years.length, 1);
        // No batch entry for the subsidiary at all.
        assert.equal(subsidiary.reportStatus.status, "missing");
        assert.equal(subsidiary.valuation.years.length, 0);
        assert.equal(subsidiary.overviewRow.reportingPeriods, 3);
    });

    it("turns failed and skipped reports into warnings and a partial status", async () => {
        const result = await ProjectResolutionService.resolveProject(requestBody(), {
            today: new Date("2026-07-07"),
            fetchAnnualReportsBatch: async () =>
                batchResponse([
                    {
                        cvrNumber: "11111111",
                        status: "success",
                        total: 1,
                        results: [makeReport(2025)] as never,
                        skipped: [{ reportingPeriodEndDate: "2023-12-31", documentUrl: null, errorCode: "UNKNOWN_TAXONOMY" as never, message: "ukendt taksonomi" }],
                    },
                    {
                        cvrNumber: "22222222",
                        status: "error",
                        total: 0,
                        results: [],
                        skipped: [],
                        errorCode: "UPSTREAM_UNAVAILABLE" as never,
                        message: "upstream nede",
                    },
                ]),
        });

        assert.equal(result.status, "partial");
        const codes = result.warnings.map((w) => w.code).sort();
        assert.deepEqual(codes, ["REPORTS_FAILED", "REPORT_SKIPPED"]);
        assert.ok(result.warnings.some((w) => w.message.includes("upstream nede")));
        assert.ok(result.warnings.some((w) => w.message.includes("ukendt taksonomi")));
    });

    it("emits balance-completeness warnings from the newest report", async () => {
        const result = await ProjectResolutionService.resolveProject(requestBody([{}]), {
            today: new Date("2026-07-07"),
            fetchAnnualReportsBatch: async () =>
                batchResponse([
                    {
                        cvrNumber: "11111111",
                        status: "success",
                        total: 1,
                        results: [
                            makeReport(2025, { nonCurrentAssets: 1500, landAndBuildings: 1000, equity: 1 }),
                        ] as never,
                        skipped: [],
                    },
                ]),
        });

        const balanceWarnings = result.warnings.filter((w) => w.code === "BALANCE_INCOMPLETE");
        assert.equal(balanceWarnings.length, 1);
        assert.match(balanceWarnings[0].message, /Mor ApS: nonCurrentAssets/);
        // Completeness problems alone do not make the response partial.
        assert.equal(result.status, "success");
    });

    it("rejects oversized groups and passive-test overflows before fetching anything", async () => {
        await assert.rejects(
            ProjectResolutionService.resolveProject(requestBody(undefined, { maximumNumberOfCompanies: 1 }), {
                fetchAnnualReportsBatch: async () => {
                    throw new Error("must not fetch");
                },
            }),
            /Koncernen er for stor/,
        );

        await assert.rejects(
            ProjectResolutionService.resolveProject(requestBody(undefined, { maxPassiveAssetTestCompanies: 1 }), {
                fetchAnnualReportsBatch: async () => {
                    throw new Error("must not fetch");
                },
            }),
            /Successionsopgørelsen har kun plads til 1 selskaber/,
        );
    });

    it("skips the passive test entirely in no-calculation mode", async () => {
        const result = await ProjectResolutionService.resolveProject(
            requestBody(undefined, {}, { successionPeriod: MODE_LABELS.noCalculation }),
            {
                today: new Date("2026-07-07"),
                fetchAnnualReportsBatch: async () => batchResponse([]),
            },
        );
        assert.equal(result.successionMode, "NO_CALCULATION");
        assert.equal(result.numberOfPassiveTestCompanies, 0);
        assert.ok(result.companies.every((c) => c.passiveAssetTest === null && !c.includeInPassiveTest));
    });
});
