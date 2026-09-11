import { subtreeConcepts } from "../concept-tree.js";
import { formatKr, periodOf } from "../format.js";
import { withinTolerance } from "../tolerance.js";
import type { AccountSection, Check, ValidationFinding } from "../types.js";
import { val } from "../types.js";

/**
 * Alle koncepter under aktiv-træet, fraregnet reguleringskonti der lovligt kan
 * være negative (over-/underdækning og periodiseringskonti for forsyningsvirksomheder).
 */
const NEGATIVE_ALLOWED = new Set([
    "costExceedsIncomeForTheFinancialYearShorttermReceivables",
    "costExceedsIncomeForTheFinancialYearLongtermReceivables",
    "timingDifferencesShorttermReceivablesEspeciallyUtilities",
]);

const ASSET_CONCEPTS = [...subtreeConcepts("assets")].filter((concept) => !NEGATIVE_ALLOWED.has(concept));

/** SGN-001: aktivposter må ikke være negative. */
const sgn001: Check = {
    id: "SGN-001",
    scope: "report",
    run(ctx) {
        const section = ctx.report.balancesheet as unknown as AccountSection;
        const findings: ValidationFinding[] = [];

        for (const concept of ASSET_CONCEPTS) {
            const value = val(section, concept);
            if (value === undefined || value >= 0) continue;
            if (withinTolerance(0, value, ctx.unit)) continue;

            findings.push({
                id: "SGN-001",
                severity: "warning",
                message:
                    `Aktivposten ${concept} er negativ (${formatKr(value)}). ` +
                    `Muligvis en fortegnsfejl i indberetningen eller udtrækket — kontrollér posten.`,
                actual: value,
                expected: 0,
                deviation: value,
                concepts: [concept],
                period: periodOf(ctx.report),
            });
        }

        return findings;
    },
};

/** SGN-002: skat med modsat fortegn af resultat før skat er usædvanligt (men kan være et udskudt skatteaktiv). */
const sgn002: Check = {
    id: "SGN-002",
    scope: "report",
    run(ctx) {
        const section = ctx.report.incomeStatement as unknown as AccountSection;
        const tax = val(section, "taxExpense");
        const beforeTax = val(section, "profitLossFromOrdinaryActivitiesBeforeTax");
        if (tax === undefined || beforeTax === undefined || tax === 0 || beforeTax === 0) return [];
        if (Math.sign(tax) === Math.sign(beforeTax)) return [];

        return [
            {
                id: "SGN-002",
                severity: "info",
                message:
                    `Skatten (${formatKr(tax)}) har modsat fortegn af resultatet før skat (${formatKr(beforeTax)}). ` +
                    `Kan være et udskudt skatteaktiv eller en regulering fra tidligere år — kontrollér skatteposten.`,
                actual: tax,
                concepts: ["taxExpense", "profitLossFromOrdinaryActivitiesBeforeTax"],
                period: periodOf(ctx.report),
            },
        ];
    },
};

/**
 * SRC-001: når selskabet aflægger koncernregnskab, må de udtrukne selskabstal
 * ikke være identiske med koncerntallene — det ville betyde, at koncerntal er
 * udtrukket i stedet for selskabstal (balancesummen sammenlignes).
 */
const src001: Check = {
    id: "SRC-001",
    scope: "report",
    run(ctx) {
        const consolidated = ctx.report.consolidated;
        if (!consolidated) return [];

        const soloAssets = val(ctx.report.balancesheet as unknown as AccountSection, "assets");
        const groupAssets = val(consolidated.balancesheet as unknown as AccountSection, "assets");
        if (soloAssets === undefined || groupAssets === undefined || soloAssets === 0) return [];
        if (soloAssets !== groupAssets) return [];

        return [
            {
                id: "SRC-001",
                severity: "error",
                message:
                    `Selskabets og koncernens balancesum er identiske (${formatKr(soloAssets)}). ` +
                    `Muligvis er koncerntal udtrukket i stedet for selskabstal — kontrollér, hvilke kolonner tallene stammer fra.`,
                expected: soloAssets,
                actual: groupAssets,
                deviation: 0,
                concepts: ["assets"],
                period: periodOf(ctx.report),
            },
        ];
    },
};

// TODO (fase 2, SRC-002): krydstjek af groupEntitiesFromNotes mod CVR-koncernstrukturen.
// Hører til i corporate-groups-endpointet og implementeres ikke her.

export const signAndSourceChecks: Check[] = [sgn001, sgn002, src001];
