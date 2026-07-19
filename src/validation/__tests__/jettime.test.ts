/**
 * Golden-test af valideringen mod Jettime a/s (CVR 41410639) — det fulde,
 * faktiske API-svar med 6 årsrapporter gemt som fixture. Forventningerne
 * følger implementeringsguidens §7.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import type { Account, AnnualReport } from "../../modules/annual-reports/annual-report.types.js";
import { parseDisabledChecks, runValidation, summarize } from "../registry.js";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "jettime-41410639.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8")) as { results: Array<AnnualReport<Account>> };

function validatedReports(): Array<AnnualReport<Account>> {
    // Dyb kopi, så testene ikke deler mutation af fixturen.
    const reports = structuredClone(fixture.results);
    runValidation(reports, new Set());
    return reports;
}

const NEWEST_PERIOD = "2024-10-01/2025-09-30";

test("Jettime: 2024/25-rapporten har ingen balance- eller resultatfund (BAL/RES)", () => {
    const [newest] = validatedReports();
    assert.equal(newest.reportingPeriod.reportingPeriodEndDate, "2025-09-30");
    const balresFindings = newest.validation.filter((f) => f.id.startsWith("BAL") || f.id.startsWith("RES"));
    assert.deepEqual(balresFindings, []);
});

test("Jettime: XCH-001 fyrer ikke for 2024/25→2023/24 (35 mio. ekstraordinært udbytte + reserver forklarer bevægelsen)", () => {
    const [newest] = validatedReports();
    const xch = newest.validation.filter((f) => f.id === "XCH-001");
    assert.ok(
        xch.every((f) => f.period !== NEWEST_PERIOD),
        `Uventet XCH-001 for nyeste periode: ${JSON.stringify(xch, null, 2)}`,
    );
});

test("Jettime: SCL-003 SKAL fyre (ejerandel angivet som 1 i nyeste år, 100 i de foregående)", () => {
    const [newest] = validatedReports();
    const scl003 = newest.validation.filter((f) => f.id === "SCL-003");
    assert.equal(scl003.length, 1);
    assert.equal(scl003[0].severity, "warning");
});

test("Jettime: PER-001 har ingen fund (perioderne er sammenhængende, inkl. 1-måneders-perioden sep. 2021)", () => {
    const reports = validatedReports();
    const per = reports.flatMap((r) => r.validation).filter((f) => f.id === "PER-001");
    assert.deepEqual(per, []);
});

test("Jettime: SGN-002 fyrer som info på 2023/24 (skat -9.139 t.kr. mod positivt resultat)", () => {
    const reports = validatedReports();
    const report2024 = reports.find((r) => r.reportingPeriod.reportingPeriodEndDate === "2024-09-30");
    assert.ok(report2024);
    const sgn = report2024.validation.filter((f) => f.id === "SGN-002");
    assert.equal(sgn.length, 1);
    assert.equal(sgn[0].severity, "info");
});

test("Jettime: SCL-001 fyrer ikke (skæve periodelængder helårsomregnes)", () => {
    const reports = validatedReports();
    const scl = reports.flatMap((r) => r.validation).filter((f) => f.id === "SCL-001");
    assert.deepEqual(scl, []);
});

test("Jettime: tværgående fund ligger på den nyeste rapport med period sat", () => {
    const reports = validatedReports();
    const [newest, ...older] = reports;
    for (const finding of newest.validation) {
        assert.ok(finding.period, `Fund uden period: ${finding.id}`);
    }
    for (const report of older) {
        for (const finding of report.validation) {
            assert.ok(["BAL", "RES", "SGN", "SRC", "SCL-002"].some((prefix) => finding.id.startsWith(prefix)));
        }
    }
});

test("Jettime: deaktivering via VALIDATION_DISABLED-format fjerner netop de kontroller", () => {
    const reports = structuredClone(fixture.results);
    runValidation(reports, parseDisabledChecks("scl-003, SGN-002"));
    const all = reports.flatMap((r) => r.validation);
    assert.deepEqual(all.filter((f) => f.id === "SCL-003" || f.id === "SGN-002"), []);
});

test("Jettime: summarize tæller på tværs af alle rapporter", () => {
    const reports = validatedReports();
    const summary = summarize(reports);
    const all = reports.flatMap((r) => r.validation);
    assert.equal(summary.errors, all.filter((f) => f.severity === "error").length);
    assert.equal(summary.warnings, all.filter((f) => f.severity === "warning").length);
    assert.equal(summary.infos, all.filter((f) => f.severity === "info").length);
});
