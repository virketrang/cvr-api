import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { TaxonomyIndex, buildFinancialIncomeIndex } from "./taxonomy-engine.js";
import { getAccount, getAccountValue, selectWithFallback, components } from "./account.js";
import { container, financialIncomeRow, smallTaxonomy, taxonomyRow } from "./test-fixtures.js";

describe("account helpers", () => {
    it("getAccount reads numeric values and treats null/missing entries as unreported", () => {
        const section = container({ equity: 1000, assets: null });
        assert.equal(getAccount(section, "equity"), 1000);
        assert.equal(getAccount(section, "assets"), undefined);
        assert.equal(getAccount(section, "revenue"), undefined);
        assert.equal(getAccountValue(section, "revenue"), 0);
    });

    it("selectWithFallback picks the first reported concept and flags fallbacks", () => {
        const section = container({ profitLossFromOrdinaryActivitiesBeforeTax: null, profitLoss: 500 });
        const picked = selectWithFallback(section, ["profitLossFromOrdinaryActivitiesBeforeTax", "profitLoss"]);
        assert.deepEqual(picked, { concept: "profitLoss", value: 500, usedFallback: true });

        const direct = selectWithFallback(container({ profitLossFromOrdinaryActivitiesBeforeTax: 700 }), [
            "profitLossFromOrdinaryActivitiesBeforeTax",
            "profitLoss",
        ]);
        assert.deepEqual(direct, {
            concept: "profitLossFromOrdinaryActivitiesBeforeTax",
            value: 700,
            usedFallback: false,
        });

        assert.equal(selectWithFallback(container({}), ["a", "b"]), null);
    });

    it("components keeps only reported, non-zero values and preserves the sign", () => {
        const section = container({ a: 100, b: 0, c: null, d: -50 });
        assert.deepEqual(components(section, ["a", "b", "c", "d", ""]), [
            { concept: "a", label: "a", value: 100 },
            { concept: "d", label: "d", value: -50 },
        ]);
    });
});

describe("TaxonomyIndex", () => {
    const taxonomy = new TaxonomyIndex(smallTaxonomy());

    it("indexes entries with trimmed, uppercased passive classifications", () => {
        const entry = taxonomy.entry("landAndBuildings");
        assert.equal(entry?.label, "Grunde og bygninger");
        assert.equal(entry?.passiveClassification, "PASSIV");
        assert.deepEqual(taxonomy.childrenOf("assets"), ["nonCurrentAssets", "currentAssets"]);
        assert.equal(taxonomy.isParent("assets"), true);
        assert.equal(taxonomy.isParent("landAndBuildings"), false);
    });

    it("hasReportedDescendant recurses through unreported intermediate levels", () => {
        const balancesheet = container({ landAndBuildings: 100 });
        assert.equal(taxonomy.hasReportedDescendant("assets", balancesheet), true);
        assert.equal(taxonomy.hasReportedDescendant("currentAssets", balancesheet), false);
        // Zero-valued entries do not count as reported.
        assert.equal(taxonomy.hasReportedDescendant("assets", container({ landAndBuildings: 0 })), false);
    });

    it("effectiveSubtreeValue prefers reported descendants over the parent's own value", () => {
        // Parent AND children reported: children win — no double counting.
        const balancesheet = container({ nonCurrentAssets: 999, landAndBuildings: 100, longtermInvestments: 50 });
        assert.equal(taxonomy.effectiveSubtreeValue("nonCurrentAssets", balancesheet), 150);
        // No reported descendants: the node's own value is used.
        assert.equal(taxonomy.effectiveSubtreeValue("nonCurrentAssets", container({ nonCurrentAssets: 999 })), 999);
    });

    it("checkBalanceCompleteness reports missing and excess amounts in Danish", () => {
        const missing = taxonomy.checkBalanceCompleteness(
            container({ assets: 2000, nonCurrentAssets: 1500, landAndBuildings: 1000 }),
        );
        // assets (2000) vs its children's effective sum (1000), nonCurrentAssets
        // (1500) vs its reported child (1000), and the total-assets leaf check.
        assert.equal(missing.length, 3);
        assert.match(missing[0], /^assets: rapporteret 2\.000 men underposterne summer kun til 1\.000 \(mangler 1\.000\)$/);
        assert.match(missing[1], /^nonCurrentAssets: rapporteret 1\.500 men underposterne summer kun til 1\.000 \(mangler 500\)$/);
        assert.match(missing[2], /^assets: aktiver i alt rapporteret 2\.000/);

        const excess = taxonomy.checkBalanceCompleteness(container({ nonCurrentAssets: 800, landAndBuildings: 1000 }));
        assert.equal(excess.length, 1);
        assert.match(excess[0], /underposterne summer til 1\.000 men posten er kun rapporteret til 800 \(overskydende 200\)/);
    });

    it("checkBalanceCompleteness respects the tolerance and passes a consistent sheet", () => {
        const consistent = container({
            assets: 150,
            nonCurrentAssets: 150,
            landAndBuildings: 100,
            longtermInvestments: 50,
        });
        assert.deepEqual(taxonomy.checkBalanceCompleteness(consistent), []);
        const slightlyOff = container({ nonCurrentAssets: 101, landAndBuildings: 100 });
        assert.equal(taxonomy.checkBalanceCompleteness(slightlyOff, 5).length, 0);
    });

    it("filters concepts by valuation class, leaf status and distribution key", () => {
        assert.deepEqual(taxonomy.conceptsByValuationClass("Unoterede aktier"), ["longtermInvestments"]);
        assert.deepEqual(taxonomy.leafConceptsByValuationClass("Værdipapirer"), ["shorttermInvestments"]);
        assert.deepEqual(
            taxonomy.leafConceptsByValuationClassAndKey("Andre ikke-driftsrelaterede poster", 1),
            ["landAndBuildings"],
        );
        assert.deepEqual(taxonomy.leafConceptsByValuationClassAndKey("Andre ikke-driftsrelaterede poster", 0.5), []);
    });

    it("skips rows with a blank concept", () => {
        const index = new TaxonomyIndex([taxonomyRow({ concept: "  " }), taxonomyRow({ concept: "assets" })]);
        assert.equal(index.entry("assets")?.concept, "assets");
        assert.equal(index.entry(""), undefined);
    });
});

describe("buildFinancialIncomeIndex", () => {
    it("indexes rows and uppercases classifications", () => {
        const index = buildFinancialIncomeIndex([
            financialIncomeRow({ concept: "otherFinanceIncome", classification: "passiv" }),
        ]);
        assert.equal(index.get("otherFinanceIncome")?.classification, "PASSIV");
    });

    it("rejects duplicated concepts like the workbook's loader", () => {
        assert.throws(
            () =>
                buildFinancialIncomeIndex([
                    financialIncomeRow({ concept: "otherFinanceIncome" }),
                    financialIncomeRow({ concept: "otherFinanceIncome" }),
                ]),
            /Dublet i indkomsttabellen/,
        );
    });
});
