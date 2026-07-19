import type { Account, AnnualReport } from "../../modules/annual-reports/annual-report.types.js";
import { formatKr, periodOf } from "../format.js";
import { roundingUnitForReport, withinTolerance } from "../tolerance.js";
import type { AccountSection, Check, ValidationFinding } from "../types.js";
import { val } from "../types.js";

function balance(report: AnnualReport<Account>): AccountSection {
    return report.balancesheet as unknown as AccountSection;
}

function income(report: AnnualReport<Account>): AccountSection {
    return report.incomeStatement as unknown as AccountSection;
}

/** The reserves whose movements bypass the resultatopgørelse (jf. XCH-001). */
const EQUITY_RESERVES = [
    "reserveForCurrentValueOfHedging",
    "reserveForNetRevaluationAccordingToEquityMethod",
    "reserveForCurrentValueAdjustmentsOfCurrencyGains",
    "restOfOtherReserves",
    "hedgeFund",
];

/** "2024-09-30" + 1 dag → "2024-10-01" (UTC, uafhængig af lokal tidszone). */
function nextDay(date: string): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setUTCDate(parsed.getUTCDate() + 1);
    return parsed.toISOString().slice(0, 10);
}

/** True når to nabo-rapporter dækker sammenhængende perioder (ingen huller/overlap). */
function isConsecutive(newer: AnnualReport<Account>, older: AnnualReport<Account>): boolean {
    return newer.reportingPeriod.reportingPeriodStartDate === nextDay(older.reportingPeriod.reportingPeriodEndDate);
}

/**
 * XCH-001 — egenkapitalens kontinuitet mellem nabo-år:
 * equity(n) − equity(n−1) − profitLoss(n) + udbytte − Δreserver ≈ 0.
 *
 * Udbyttets timing varierer lovligt (foreslået udbytte indregnet i egenkapitalen
 * betales året efter), og reservebevægelser kan være rene omposteringer inden
 * for egenkapitalen — derfor prøves begge udbytte-årgange og formlen med og
 * uden reserveled, og kun en residual ingen af varianterne forklarer (ud over
 * 5× tolerance) bliver en warning. Kapitaludvidelser m.v. er fortsat lovlige
 * forklaringer, så meddelelsen formuleres som "kontrollér".
 */
const xch001: Check = {
    id: "XCH-001",
    scope: "company",
    run(ctx) {
        const findings: ValidationFinding[] = [];

        for (let i = 0; i + 1 < ctx.allReports.length; i++) {
            const newer = ctx.allReports[i];
            const older = ctx.allReports[i + 1];
            if (!isConsecutive(newer, older)) continue;

            const equityNew = val(balance(newer), "equity");
            const equityOld = val(balance(older), "equity");
            const profit = val(income(newer), "profitLoss");
            if (equityNew === undefined || equityOld === undefined || profit === undefined) continue;

            const dividendOf = (report: AnnualReport<Account>) =>
                (val(balance(report), "proposedDividendRecognisedInEquity") ?? 0) +
                (val(balance(report), "proposedExtraordinaryDividendRecognisedInEquity") ?? 0);

            const reserveDeltaOf = (reserves: string[]) => {
                let delta = 0;
                for (const reserve of reserves) {
                    const now = val(balance(newer), reserve);
                    const before = val(balance(older), reserve);
                    if (now !== undefined || before !== undefined) delta += (now ?? 0) - (before ?? 0);
                }
                return delta;
            };

            // Reserven for indre værdis metode er ofte en ren ompostering fra
            // overført resultat (ingen effekt på den samlede egenkapital) —
            // derfor prøves formlen både med og uden den, og helt uden reserveled.
            const bypassReserves = EQUITY_RESERVES.filter(
                (reserve) => reserve !== "reserveForNetRevaluationAccordingToEquityMethod",
            );
            const base = equityNew - equityOld - profit;
            const dividendVintages: Array<[number, string]> = [
                [dividendOf(newer), "udbytte foreslået i året"],
                [dividendOf(older), "udbytte foreslået året før (betalt i året)"],
            ];
            const reserveVariants: Array<[number, string]> = [
                [reserveDeltaOf(EQUITY_RESERVES), "alle reservebevægelser"],
                [reserveDeltaOf(bypassReserves), "reservebevægelser uden indre værdis metode"],
                [0, "uden reserveled"],
            ];
            const candidates: Array<{ residual: number; explanation: string }> = [];
            for (const [dividend, dividendLabel] of dividendVintages) {
                for (const [reserveDelta, reserveLabel] of reserveVariants) {
                    candidates.push({
                        residual: base + dividend - reserveDelta,
                        explanation: `${dividendLabel}, ${reserveLabel}`,
                    });
                }
            }
            const best = candidates.reduce((a, b) => (Math.abs(b.residual) < Math.abs(a.residual) ? b : a));
            const residual = best.residual;

            const unit = roundingUnitForReport(newer);
            const tolerance = Math.max(unit, 0.001 * Math.max(Math.abs(equityNew), Math.abs(equityOld))) * 5;
            if (Math.abs(residual) <= tolerance) {
                // Audit trail for the silent pass: a check that accepts any of
                // several legal explanations must record WHICH one reconciled,
                // so a reviewer can see e.g. "udbytte + hedging-reserven" instead
                // of a bare pass.
                console.debug(
                    `XCH-001 ${periodOf(newer)}: egenkapitalen afstemt via ${best.explanation} ` +
                        `(residual ${formatKr(Math.abs(residual))}).`,
                );
                continue;
            }

            findings.push({
                id: "XCH-001",
                severity: "warning",
                message:
                    `Egenkapitalens udvikling stemmer ikke med årets resultat, udbytte og reservebevægelser ` +
                    `(uforklaret bevægelse ${formatKr(Math.abs(residual))} fra ${formatKr(equityOld)} til ${formatKr(equityNew)}). ` +
                    `Kan skyldes kapitalbevægelser (kapitaludvidelse, ekstraordinær udlodning m.v.) — kontrollér egenkapitalopgørelsen.`,
                expected: equityNew - residual,
                actual: equityNew,
                deviation: residual,
                concepts: ["equity", "profitLoss", "proposedDividendRecognisedInEquity", "proposedExtraordinaryDividendRecognisedInEquity", ...EQUITY_RESERVES],
                period: periodOf(newer),
            });
        }

        return findings;
    },
};

/**
 * XCH-002: når både reserven for indre værdis metode og kapitalandele i
 * tilknyttede virksomheder er indberettet, følges de typisk ad. Afvigelse er
 * kun info — associerede virksomheder kan også indgå i reserven.
 */
const xch002: Check = {
    id: "XCH-002",
    scope: "company",
    run(ctx) {
        const findings: ValidationFinding[] = [];

        for (const report of ctx.allReports) {
            const reserve = val(balance(report), "reserveForNetRevaluationAccordingToEquityMethod");
            const investments = val(balance(report), "longtermInvestmentsInGroupEnterprises");
            if (reserve === undefined || investments === undefined) continue;
            if (withinTolerance(investments, reserve, roundingUnitForReport(report))) continue;

            findings.push({
                id: "XCH-002",
                severity: "info",
                message:
                    `Reserven for indre værdis metode afviger fra kapitalandele i tilknyttede virksomheder ` +
                    `(${formatKr(investments)} vs. ${formatKr(reserve)}, afvigelse ${formatKr(Math.abs(reserve - investments))}). ` +
                    `Kan skyldes, at associerede virksomheder eller kostpriselementer indgår — kontrollér noten om kapitalandele.`,
                expected: investments,
                actual: reserve,
                deviation: reserve - investments,
                concepts: ["reserveForNetRevaluationAccordingToEquityMethod", "longtermInvestmentsInGroupEnterprises"],
                period: periodOf(report),
            });
        }

        return findings;
    },
};

/**
 * PER-001 — periodekontinuitet: nyeste→ældste skal hvert års start være dagen
 * efter det foregående års slut. Huller ⇒ warning (manglende regnskabsår i
 * udtrækket); overlap ⇒ error (dublet/genindberetning — dedup har fejlet).
 */
const per001: Check = {
    id: "PER-001",
    scope: "company",
    run(ctx) {
        const findings: ValidationFinding[] = [];

        for (let i = 0; i + 1 < ctx.allReports.length; i++) {
            const newer = ctx.allReports[i];
            const older = ctx.allReports[i + 1];
            const expectedStart = nextDay(older.reportingPeriod.reportingPeriodEndDate);
            const actualStart = newer.reportingPeriod.reportingPeriodStartDate;
            if (expectedStart === null || actualStart === expectedStart) continue;

            const overlap = actualStart < expectedStart;
            findings.push({
                id: "PER-001",
                severity: overlap ? "error" : "warning",
                message: overlap
                    ? `Regnskabsperioderne overlapper: perioden ${periodOf(newer)} begynder før den foregående periode ` +
                      `(${periodOf(older)}) er slut. Muligvis en dublet eller genindberetning i udtrækket.`
                    : `Der mangler et regnskabsår i udtrækket: perioden ${periodOf(older)} efterfølges først af ` +
                      `${periodOf(newer)}. Kontrollér, om et mellemliggende år mangler.`,
                concepts: ["reportingPeriodStartDate", "reportingPeriodEndDate"],
                period: periodOf(newer),
            });
        }

        return findings;
    },
};

/** Periodens længde i dage, eller null når datoerne ikke kan læses. */
function periodDays(report: AnnualReport<Account>): number | null {
    const start = new Date(`${report.reportingPeriod.reportingPeriodStartDate}T00:00:00Z`).getTime();
    const end = new Date(`${report.reportingPeriod.reportingPeriodEndDate}T00:00:00Z`).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
    return (end - start) / 86_400_000 + 1;
}

/** SCL-001 — skala-kontinuitet for nøgletal mellem nabo-år: faktor > 20 indikerer mulig enhedsfejl (kr. vs. t.kr.). */
const scl001: Check = {
    id: "SCL-001",
    scope: "company",
    run(ctx) {
        const findings: ValidationFinding[] = [];
        const keyConcepts: Array<{
            concept: string;
            section: (r: AnnualReport<Account>) => AccountSection;
            name: string;
            /** Flow-poster helårsomregnes, så skæve periodelængder (fx en 1-måneders periode) ikke støjer. */
            isFlow: boolean;
        }> = [
            { concept: "revenue", section: income, name: "omsætningen", isFlow: true },
            { concept: "assets", section: balance, name: "balancesummen", isFlow: false },
            { concept: "equity", section: balance, name: "egenkapitalen", isFlow: false },
            { concept: "profitLoss", section: income, name: "årets resultat", isFlow: true },
        ];

        for (let i = 0; i + 1 < ctx.allReports.length; i++) {
            const newer = ctx.allReports[i];
            const older = ctx.allReports[i + 1];
            const newerDays = periodDays(newer);
            const olderDays = periodDays(older);

            for (const { concept, section, name, isFlow } of keyConcepts) {
                const now = val(section(newer), concept);
                const before = val(section(older), concept);
                if (now === undefined || before === undefined || now === 0 || before === 0) continue;

                const annualise = isFlow && newerDays !== null && olderDays !== null;
                const nowComparable = annualise ? (now * 365) / (newerDays as number) : now;
                const beforeComparable = annualise ? (before * 365) / (olderDays as number) : before;
                const ratio = Math.abs(nowComparable) / Math.abs(beforeComparable);
                if (ratio <= 20 && ratio >= 1 / 20) continue;

                findings.push({
                    id: "SCL-001",
                    severity: "warning",
                    message:
                        `Springet i ${name} mellem ${older.reportingPeriod.reportingPeriodEndDate} og ` +
                        `${newer.reportingPeriod.reportingPeriodEndDate} er en faktor ${Math.round(Math.max(ratio, 1 / ratio))} ` +
                        `(${formatKr(before)} vs. ${formatKr(now)}). Mulig enhedsfejl (kr. vs. t.kr.) — kontrollér skalaen.`,
                    expected: before,
                    actual: now,
                    deviation: now - before,
                    concepts: [concept],
                    period: periodOf(newer),
                });
            }
        }

        return findings;
    },
};

/** SCL-002 — intern størrelsesorden: omsætning og balancesum i samme rapport bør ligge inden for 3 dekader. */
const scl002: Check = {
    id: "SCL-002",
    scope: "report",
    run(ctx) {
        const revenue = val(income(ctx.report), "revenue");
        const assets = val(balance(ctx.report), "assets");
        if (revenue === undefined || assets === undefined || revenue === 0 || assets === 0) return [];

        const decades = Math.abs(Math.log10(Math.abs(revenue) / Math.abs(assets)));
        if (decades <= 3) return [];

        return [
            {
                id: "SCL-002",
                severity: "info",
                message:
                    `Omsætningen og balancesummen ligger mere end 1000× fra hinanden ` +
                    `(${formatKr(revenue)} vs. ${formatKr(assets)}). Mulig enhedsfejl i en af posterne — kontrollér skalaen.`,
                actual: revenue,
                expected: assets,
                concepts: ["revenue", "assets"],
                period: periodOf(ctx.report),
            },
        ];
    },
};

/**
 * SCL-003 — procentfelt-ensartethed: ejerandele i de strukturerede noter skal
 * være angivet ensartet på tværs af alle årene — enten som brøk (≤ 1) eller som
 * procent (> 1). Blandet angivelse betyder, at normaliseringen (1 tolkes som
 * 100 %) kan have gættet forkert i et af årene.
 */
const scl003: Check = {
    id: "SCL-003",
    scope: "company",
    run(ctx) {
        const fractionPeriods = new Set<string>();
        const percentPeriods = new Set<string>();

        for (const report of ctx.allReports) {
            for (const entity of report.groupEntitiesFromNotes) {
                if (entity.source !== "structured") continue;
                const raw = entity.ownershipPercentageAsReported;
                if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;
                (raw <= 1 ? fractionPeriods : percentPeriods).add(periodOf(report));
            }
        }

        if (fractionPeriods.size === 0 || percentPeriods.size === 0) return [];

        return [
            {
                id: "SCL-003",
                severity: "warning",
                message:
                    `Ejerandelene er, som indberettet i årsrapporterne, angivet inkonsistent på tværs af årene: ` +
                    `som brøk (≤ 1) i ${[...fractionPeriods].join(", ")} og som procent (> 1) i ` +
                    `${[...percentPeriods].join(", ")}. I dette svar er værdierne normaliseret til procent ` +
                    `(en indberettet '1' er tolket som 100 %) — kontrollér i selve årsrapporten, om 1 betyder 1 % eller 100 %.`,
                concepts: ["shareHeldByEntityOrConsolidatedEnterprisesInRelatedEntity"],
                period: periodOf(ctx.report),
            },
        ];
    },
};

export const crossYearChecks: Check[] = [xch001, xch002, per001, scl001, scl002, scl003];
