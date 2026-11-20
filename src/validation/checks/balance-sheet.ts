import { conceptTree, residualOf, subtreeConcepts } from "../concept-tree.js";
import { explainDeviation, unmappedFactsOf, type UnmappedFact } from "../../modules/annual-reports/annual-report.unmapped.js";
import { formatKr, periodOf } from "../format.js";
import { withinTolerance } from "../tolerance.js";
import type { AccountSection, Check, ReportContext, ValidationFinding } from "../types.js";
import { val } from "../types.js";

/**
 * The residual engine runs over both statements merged (the subtotal tree also
 * holds income-statement roll-ups like employeeBenefitsExpense; concept names
 * never collide between the two statements).
 */
function balanceSection(ctx: ReportContext): AccountSection {
    return {
        ...(ctx.report.incomeStatement as unknown as AccountSection),
        ...(ctx.report.balancesheet as unknown as AccountSection),
    };
}

/** Danish line names for the messages, so a finding reads naturally on a checklist. */
const DANISH_NAMES: Record<string, string> = {
    assets: "aktiver",
    liabilitiesAndEquity: "passiver",
    nonCurrentAssets: "anlægsaktiver",
    currentAssets: "omsætningsaktiver",
    intangibleAssets: "immaterielle anlægsaktiver",
    propertyPlantAndEquipment: "materielle anlægsaktiver",
    longtermInvestmentsAndReceivables: "finansielle anlægsaktiver",
    equity: "egenkapital",
    provisions: "hensatte forpligtelser",
    liabilitiesOtherThanProvisions: "gældsforpligtelser",
};

function danishName(concept: string): string {
    return DANISH_NAMES[concept] ?? concept;
}

/**
 * One residual finding: "parent − Σ(reported children) exceeds tolerance".
 * The message names the missing kroner AND the children that were counted, so
 * the reader can see which sub-item the extraction may have missed.
 */
function residualFinding(
    id: string,
    ctx: ReportContext,
    concept: string,
    intro?: string,
): ValidationFinding | null {
    const residual = residualOf(balanceSection(ctx), concept, ctx.unit, withinTolerance);
    if (!residual) return null;

    const deviation = residual.actual - residual.expected;
    const explanation = explanationOf(ctx, concept, deviation);
    return {
        id,
        severity: "error",
        message:
            (intro ?? `Sammentælling af ${danishName(concept)}`) +
            ` afviger ${amountText(Math.abs(deviation), ctx)} fra summen af indberettede underposter ` +
            `(${residual.childConcepts.join(", ")}). ` +
            (explanation ?? "Muligvis manglende underpost i udtrækket."),
        expected: residual.expected,
        actual: residual.actual,
        deviation,
        concepts: [concept, ...residual.childConcepts],
        period: periodOf(ctx.report),
    };
}

const ASSET_SIDE = subtreeConcepts("assets");

/** An amount in the report's currency: "54.008.000 kr." for DKK, "54.008.000 EUR" otherwise. */
function amountText(amount: number, ctx: ReportContext): string {
    const unit = ctx.report.unit;
    return !unit || unit === "DKK" ? formatKr(amount) : formatKr(amount).replace(/ kr\.$/, ` ${unit}`);
}

/**
 * Names the amounts that make up a deviation, when the filing tags them with
 * elements the mapping does not read (a company's own extension, or a standard
 * element without a field) and exactly one combination of them adds up to the
 * deviation. The amounts are only named here; they never enter the figures.
 */
function explanationOf(ctx: ReportContext, concept: string, deviation: number): string | null {
    const side = ASSET_SIDE.has(concept) ? "debit" : "credit";
    const facts = explainDeviation(unmappedFactsOf(ctx.report), side, (sum) => withinTolerance(deviation, sum, ctx.unit));
    if (!facts) return null;

    const describe = (fact: UnmappedFact) =>
        `${fact.label ? `"${fact.label}"` : fact.concept} (${fact.extension ? "selskabets egen post" : "taksonomiens post"}, ` +
        `${fact.concept}) ${amountText(fact.value, ctx)}`;
    const total = facts.reduce((sum, fact) => sum + fact.value, 0);
    return (
        `Forskellen svarer til ${facts.length === 1 ? "en post" : `${facts.length} poster`} i årsrapporten, ` +
        `som ikke kan henføres sikkert til en post i udtrækket og derfor ikke indgår i tallene: ` +
        facts.map(describe).join("; ") +
        (facts.length > 1 ? `. I alt ${amountText(total, ctx)}` : "")
    ).replace(/([^.])$/, "$1.");
}

/** BAL-001: aktiver == passiver. */
const bal001: Check = {
    id: "BAL-001",
    scope: "report",
    run(ctx) {
        const section = balanceSection(ctx);
        const assets = val(section, "assets");
        const liabilitiesAndEquity = val(section, "liabilitiesAndEquity");
        if (assets === undefined || liabilitiesAndEquity === undefined) return [];
        if (withinTolerance(liabilitiesAndEquity, assets, ctx.unit)) return [];

        const deviation = assets - liabilitiesAndEquity;
        return [
            {
                id: "BAL-001",
                severity: "error",
                message:
                    `Balancen stemmer ikke: aktiver afviger fra passiver ` +
                    `(${formatKr(assets)} vs. ${formatKr(liabilitiesAndEquity)}, afvigelse ${formatKr(Math.abs(deviation))}). ` +
                    `Udtrækket er muligvis ufuldstændigt — kontrollér balancen i årsrapporten.`,
                expected: liabilitiesAndEquity,
                actual: assets,
                deviation,
                concepts: ["assets", "liabilitiesAndEquity"],
                period: periodOf(ctx.report),
            },
        ];
    },
};

/** BAL-002: aktiver == anlægsaktiver + omsætningsaktiver (kun når begge børn findes). */
const bal002: Check = {
    id: "BAL-002",
    scope: "report",
    run(ctx) {
        const section = balanceSection(ctx);
        if (val(section, "nonCurrentAssets") === undefined || val(section, "currentAssets") === undefined) return [];
        const finding = residualFinding("BAL-002", ctx, "assets", "Sammentælling af aktiver");
        return finding ? [finding] : [];
    },
};

/** BAL-003: anlægsaktiver == immaterielle + materielle + finansielle (kun tilstedeværende led). */
const bal003: Check = {
    id: "BAL-003",
    scope: "report",
    run(ctx) {
        const finding = residualFinding("BAL-003", ctx, "nonCurrentAssets", "Sammentælling af anlægsaktiver");
        return finding ? [finding] : [];
    },
};

/** BAL-004: passiver == egenkapital + hensatte forpligtelser + gældsforpligtelser. */
const bal004: Check = {
    id: "BAL-004",
    scope: "report",
    standards: ["ÅRL"],
    run(ctx) {
        const finding = residualFinding("BAL-004", ctx, "liabilitiesAndEquity", "Sammentælling af passiver");
        return finding ? [finding] : [];
    },
};

/**
 * BAL-005 — the residual engine over the WHOLE subtotal tree: every reported
 * node with at least one reported child must equal the sum of its children
 * within tolerance. The nodes BAL-001..004 already cover are skipped so the
 * same deviation is not reported twice.
 */
const COVERED_BY_DEDICATED_CHECKS = new Set(["assets", "nonCurrentAssets", "liabilitiesAndEquity"]);

const bal005: Check = {
    id: "BAL-005",
    scope: "report",
    standards: ["ÅRL"],
    run(ctx) {
        const findings: ValidationFinding[] = [];
        for (const concept of Object.keys(conceptTree)) {
            if (COVERED_BY_DEDICATED_CHECKS.has(concept)) continue;
            const finding = residualFinding("BAL-005", ctx, concept);
            if (finding) findings.push(finding);
        }
        return findings;
    },
};

export const balanceSheetChecks: Check[] = [bal001, bal002, bal003, bal004, bal005];
