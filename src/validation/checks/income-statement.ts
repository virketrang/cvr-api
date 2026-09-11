import { formatKr, periodOf } from "../format.js";
import { withinTolerance } from "../tolerance.js";
import type { AccountSection, Check, ReportContext, Severity, ValidationFinding } from "../types.js";
import { val } from "../types.js";

function incomeSection(ctx: ReportContext): AccountSection {
    return ctx.report.incomeStatement as unknown as AccountSection;
}

/**
 * Some lines sit in different legal positions depending on the report scheme
 * (e.g. otherOperatingIncome above or below gross profit). An identity check
 * therefore passes when ANY combination of the ambiguous terms reconciles —
 * only a deviation no legal positioning can explain becomes a finding. Returns
 * the closest expected value when nothing reconciles.
 */
function closestVariant(
    base: number,
    optionalTerms: number[],
    actual: number,
    unit: number,
): { matches: boolean; expected: number } {
    let best = base;
    for (let mask = 0; mask < 1 << optionalTerms.length; mask++) {
        let candidate = base;
        for (let i = 0; i < optionalTerms.length; i++) {
            if (mask & (1 << i)) candidate += optionalTerms[i];
        }
        if (withinTolerance(candidate, actual, unit)) return { matches: true, expected: candidate };
        if (Math.abs(candidate - actual) < Math.abs(best - actual)) best = candidate;
    }
    return { matches: false, expected: best };
}

function identityFinding(
    id: string,
    severity: Severity,
    ctx: ReportContext,
    lineName: string,
    concepts: string[],
    expected: number,
    actual: number,
    hint: string,
): ValidationFinding {
    const deviation = actual - expected;
    return {
        id,
        severity,
        message:
            `${lineName} stemmer ikke med de indberettede led ` +
            `(${formatKr(expected)} vs. ${formatKr(actual)}, afvigelse ${formatKr(Math.abs(deviation))}). ${hint}`,
        expected,
        actual,
        deviation,
        concepts,
        period: periodOf(ctx.report),
    };
}

/** Sum of the present terms among `concepts`, and which of them were present. */
function sumPresent(section: AccountSection, concepts: string[]): { sum: number; used: string[] } {
    let sum = 0;
    const used: string[] = [];
    for (const concept of concepts) {
        const value = val(section, concept);
        if (value !== undefined) {
            sum += value;
            used.push(concept);
        }
    }
    return { sum, used };
}

/**
 * RES-001: bruttoresultat == omsætning − vareforbrug − andre eksterne
 * omkostninger (+ evt. andre driftsindtægter m.v.) — kun de tilstedeværende
 * led. Springes helt over i bruttoresultat-skemaet (hverken omsætning eller
 * vareforbrug indberettet).
 */
const res001: Check = {
    id: "RES-001",
    scope: "report",
    run(ctx) {
        const section = incomeSection(ctx);
        const gross = val(section, "grossProfitLoss") ?? val(section, "grossResult");
        if (gross === undefined) return [];

        const revenue = val(section, "revenue");
        const hasConsumption =
            val(section, "costOfSales") !== undefined || val(section, "rawMaterialsAndConsumablesUsed") !== undefined;
        if (revenue === undefined && !hasConsumption) return [];

        const additions = sumPresent(section, [
            "revenue",
            "changeInInventoriesOfFinishedGoodsWorkInProgressAndGoodsForResale",
            "workPerformedByEntityAndCapitalised",
        ]);
        const deductions = sumPresent(section, [
            "costOfSales",
            "rawMaterialsAndConsumablesUsed",
            "costOfProduction",
            "propertyCost",
        ]);
        const base = additions.sum - deductions.sum;

        // Led hvis placering over/under bruttoresultatet varierer mellem skemaer:
        // andre driftsindtægter og eksterne omkostninger (nogle filers bruttoresultat
        // er FØR eksterne omkostninger, som så fratrækkes før driftsresultatet).
        const optional: number[] = [];
        for (const [concept, sign] of [
            ["otherOperatingIncome", 1],
            ["otherExternalExpenses", -1],
            ["externalExpenses", -1],
        ] as const) {
            const value = val(section, concept);
            if (value !== undefined) optional.push(sign * value);
        }

        const { matches, expected } = closestVariant(base, optional, gross, ctx.unit);
        if (matches) return [];

        return [
            identityFinding(
                "RES-001",
                "warning",
                ctx,
                "Bruttoresultatet",
                ["grossProfitLoss", "grossResult", ...additions.used, ...deductions.used],
                expected,
                gross,
                "Muligvis mangler en post over bruttoresultatet i udtrækket — kontrollér resultatopgørelsen.",
            ),
        ];
    },
};

/**
 * RES-002: resultat af ordinær drift == bruttoresultat − personaleomkostninger
 * − af- og nedskrivninger (− evt. andre driftsomkostninger m.v.).
 */
const res002: Check = {
    id: "RES-002",
    scope: "report",
    run(ctx) {
        const section = incomeSection(ctx);
        const operating = val(section, "profitLossFromOrdinaryOperatingActivities");
        const gross = val(section, "grossProfitLoss") ?? val(section, "grossResult");
        if (operating === undefined || gross === undefined) return [];

        const deductions = sumPresent(section, [
            "employeeBenefitsExpense",
            "depreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss",
        ]);
        const base = gross - deductions.sum;

        // Led hvis placering (over/under bruttoresultatet hhv. driftsresultatet)
        // varierer mellem skemaer — bl.a. eksterne omkostninger, som nogle filers
        // bruttoresultat ikke omfatter.
        const optional: number[] = [];
        for (const [concept, sign] of [
            ["otherOperatingExpenses", -1],
            ["otherOperatingIncome", 1],
            ["otherExternalExpenses", -1],
            ["externalExpenses", -1],
            ["writedownsOfCurrentAssetsOtherThanCurrentFinancialAssets", -1],
            ["gainsLossesFromCurrentValueAdjustmentsOfInvestmentAssets", 1],
        ] as const) {
            const value = val(section, concept);
            if (value !== undefined) optional.push(sign * value);
        }

        const { matches, expected } = closestVariant(base, optional, operating, ctx.unit);
        if (matches) return [];

        return [
            identityFinding(
                "RES-002",
                "error",
                ctx,
                "Resultat af ordinær primær drift",
                ["profitLossFromOrdinaryOperatingActivities", "grossProfitLoss", "grossResult", ...deductions.used],
                expected,
                operating,
                "Muligvis mangler en omkostningspost i udtrækket — kontrollér resultatopgørelsen.",
            ),
        ];
    },
};

/**
 * RES-003: resultat før skat == resultat af ordinær drift + finansielle
 * indtægter (inkl. kapitalandelsresultater, med fortegn) − finansielle
 * omkostninger. Af- og nedskrivninger indgår IKKE — resultat af ordinær drift
 * er allerede efter af- og nedskrivninger.
 */
const res003: Check = {
    id: "RES-003",
    scope: "report",
    run(ctx) {
        const section = incomeSection(ctx);
        const beforeTax = val(section, "profitLossFromOrdinaryActivitiesBeforeTax");
        const operating = val(section, "profitLossFromOrdinaryOperatingActivities");
        if (beforeTax === undefined || operating === undefined) return [];

        // Kapitalandelsresultater: det kombinerede koncept fortrænger sine to
        // underled, så samme beløb aldrig tælles to gange.
        const incomeConcepts = ["incomeFromInvestmentsInParticipatingInterests", "incomeFromInvestmentsInJointVentures", "incomeFromOtherLongtermInvestmentsAndReceivables", "otherFinanceIncomeFromGroupEnterprises", "otherFinanceIncome"];
        if (val(section, "incomeFromInvestmentsInGroupEnterprisesAndAssociates") !== undefined) {
            incomeConcepts.unshift("incomeFromInvestmentsInGroupEnterprisesAndAssociates");
        } else {
            incomeConcepts.unshift("incomeFromInvestmentsInGroupEnterprises", "incomeFromInvestmentsInAssociates");
        }
        const income = sumPresent(section, incomeConcepts);

        // Samme forældre-fortrængning på omkostningssiden: otherFinanceExpenses
        // er forælder til de to underopdelte led.
        const expenseConcepts = ["financeExpensesArisingFromGroupEnterprises", "restOfOtherFinanceExpenses"];
        if (val(section, "otherFinanceExpenses") !== undefined) {
            expenseConcepts.length = 0;
            expenseConcepts.push("otherFinanceExpenses");
        }
        expenseConcepts.push("impairmentOfFinancialAssets");
        const expenses = sumPresent(section, expenseConcepts);

        if (income.used.length === 0 && expenses.used.length === 0 && withinTolerance(operating, beforeTax, ctx.unit)) {
            return [];
        }

        const expected = operating + income.sum - expenses.sum;
        if (withinTolerance(expected, beforeTax, ctx.unit)) return [];

        return [
            identityFinding(
                "RES-003",
                "error",
                ctx,
                "Resultat før skat",
                ["profitLossFromOrdinaryActivitiesBeforeTax", "profitLossFromOrdinaryOperatingActivities", ...income.used, ...expenses.used],
                expected,
                beforeTax,
                "Muligvis mangler en finansiel post i udtrækket — kontrollér de finansielle poster.",
            ),
        ];
    },
};

/** RES-004: årets resultat == resultat før skat − skat (± ekstraordinære poster, hvis indberettet). */
const res004: Check = {
    id: "RES-004",
    scope: "report",
    run(ctx) {
        const section = incomeSection(ctx);
        const profitLoss = val(section, "profitLoss");
        const beforeTax = val(section, "profitLossFromOrdinaryActivitiesBeforeTax");
        if (profitLoss === undefined || beforeTax === undefined) return [];

        // Skat: totalen fortrænger sine underled.
        const taxTotal = val(section, "taxExpense");
        const tax =
            taxTotal !== undefined
                ? { sum: taxTotal, used: ["taxExpense"] }
                : sumPresent(section, ["taxExpenseOnOrdinaryActivities", "otherTaxExpenses"]);

        // Ekstraordinære poster: efter-skat-totalen fortrænger de enkelte led.
        const extraordinaryAfterTax = val(section, "extraordinaryProfitLossAfterTax");
        let extraordinary: { sum: number; used: string[] };
        if (extraordinaryAfterTax !== undefined) {
            extraordinary = { sum: extraordinaryAfterTax, used: ["extraordinaryProfitLossAfterTax"] };
        } else {
            const income = sumPresent(section, ["extraordinaryIncome"]);
            const expense = sumPresent(section, ["extraordinaryExpenses", "taxExpenseOnExtraordinaryEvents"]);
            extraordinary = { sum: income.sum - expense.sum, used: [...income.used, ...expense.used] };
        }

        const expected = beforeTax - tax.sum + extraordinary.sum;
        if (withinTolerance(expected, profitLoss, ctx.unit)) return [];

        return [
            identityFinding(
                "RES-004",
                "error",
                ctx,
                "Årets resultat",
                ["profitLoss", "profitLossFromOrdinaryActivitiesBeforeTax", ...tax.used, ...extraordinary.used],
                expected,
                profitLoss,
                "Muligvis mangler skat eller en ekstraordinær post i udtrækket.",
            ),
        ];
    },
};

/**
 * RES-005: afskrivninger på immaterielle aktiver (noten) kan ikke overstige
 * resultatopgørelsens samlede af- og nedskrivningslinje.
 */
const res005: Check = {
    id: "RES-005",
    scope: "report",
    run(ctx) {
        const notes = ctx.report.notes as unknown as AccountSection;
        const amortisation = val(notes, "amortisationOfIntangibleAssets");
        const depreciationLine = val(
            incomeSection(ctx),
            "depreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss",
        );
        if (amortisation === undefined || depreciationLine === undefined) return [];

        const amortAbs = Math.abs(amortisation);
        const depreciationAbs = Math.abs(depreciationLine);
        if (amortAbs <= depreciationAbs || withinTolerance(depreciationAbs, amortAbs, ctx.unit)) return [];

        return [
            {
                id: "RES-005",
                severity: "warning",
                message:
                    `Afskrivninger på immaterielle aktiver ifølge noten overstiger resultatopgørelsens samlede ` +
                    `af- og nedskrivninger (${formatKr(amortAbs)} vs. ${formatKr(depreciationAbs)}, ` +
                    `afvigelse ${formatKr(amortAbs - depreciationAbs)}). Kontrollér notens tal.`,
                expected: depreciationAbs,
                actual: amortAbs,
                deviation: amortAbs - depreciationAbs,
                concepts: [
                    "amortisationOfIntangibleAssets",
                    "depreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss",
                ],
                period: periodOf(ctx.report),
            },
        ];
    },
};

export const incomeStatementChecks: Check[] = [res001, res002, res003, res004, res005];
