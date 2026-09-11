import type { Account } from "../annual-reports/annual-report.types.js";
import type { AccountContainer, FinancialIncomeRow, TaxonomyRow } from "./project-resolution.types.js";

/** Builds a statement section from plain numbers, in the given key order. */
export function container(values: Record<string, number | null>): AccountContainer {
    const result: AccountContainer = {};
    for (const [concept, value] of Object.entries(values)) {
        result[concept] =
            value === null ? null : ({ value, unit: "DKK", label: concept } satisfies Account);
    }
    return result;
}

export function taxonomyRow(overrides: Partial<TaxonomyRow> & { concept: string }): TaxonomyRow {
    return {
        label: overrides.concept,
        parent: "",
        passiveClassification: "PASSIV",
        includeInPassiveTest: true,
        passiveNote: "",
        valuationClassification: "",
        distributionKey: 1,
        valuationNote: "",
        ...overrides,
    };
}

export function financialIncomeRow(
    overrides: Partial<FinancialIncomeRow> & { concept: string },
): FinancialIncomeRow {
    return {
        label: overrides.concept,
        classification: "PASSIV",
        includeInPassiveTest: true,
        note: "",
        ...overrides,
    };
}

/**
 * A small taxonomy tree used across tests:
 *
 *   assets
 *   ├── nonCurrentAssets
 *   │   ├── landAndBuildings          (Andre ikke-driftsrelaterede poster, key 1)
 *   │   └── longtermInvestments       (Unoterede aktier)
 *   └── currentAssets
 *       ├── cashAndCashEquivalents    (excluded from the passive test)
 *       └── shorttermInvestments      (Værdipapirer, key 0.5)
 */
export function smallTaxonomy(): TaxonomyRow[] {
    return [
        taxonomyRow({ concept: "assets", label: "Aktiver" }),
        taxonomyRow({ concept: "nonCurrentAssets", label: "Anlægsaktiver", parent: "assets" }),
        taxonomyRow({
            concept: "landAndBuildings",
            label: "Grunde og bygninger",
            parent: "nonCurrentAssets",
            valuationClassification: "Andre ikke-driftsrelaterede poster",
            distributionKey: 1,
            passiveNote: "Vurder om ejendommen er passiv kapitalanbringelse.",
        }),
        taxonomyRow({
            concept: "longtermInvestments",
            label: "Kapitalandele",
            parent: "nonCurrentAssets",
            valuationClassification: "Unoterede aktier",
        }),
        taxonomyRow({ concept: "currentAssets", label: "Omsætningsaktiver", parent: "assets" }),
        taxonomyRow({
            concept: "cashAndCashEquivalents",
            label: "Likvide beholdninger",
            parent: "currentAssets",
            includeInPassiveTest: false,
        }),
        taxonomyRow({
            concept: "shorttermInvestments",
            label: "Værdipapirer",
            parent: "currentAssets",
            valuationClassification: "Værdipapirer",
            distributionKey: 0.5,
        }),
    ];
}
