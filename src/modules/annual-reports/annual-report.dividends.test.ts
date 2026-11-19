import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveDividendsInEquity } from "./annual-report.dividends.js";
import type { AccountSection } from "../../validation/types.js";

const section = (values: Record<string, number>): AccountSection =>
    Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value, unit: "DKK", label: key }]));

const resolve = (balancesheet: Record<string, number>, notes: Record<string, number> = {}, unit = 1) =>
    resolveDividendsInEquity(section(balancesheet), section(notes), unit);

describe("resolveDividendsInEquity", () => {
    it("counts the proposed dividend when the equity only adds up with it", () => {
        const { proposedDividend, extraordinaryDividend, extraordinaryDividendAfterBalanceSheetDate } = resolve({
            equity: 1_500_000,
            contributedCapital: 500_000,
            retainedEarnings: 800_000,
            proposedDividendRecognisedInEquity: 200_000,
        });

        assert.deepEqual(proposedDividend, {
            value: 200_000,
            reported: 200_000,
            status: "inEquity",
            label: "Foreslået udbytte indregnet under egenkapitalen",
            note: null,
        });
        assert.equal(extraordinaryDividend, null);
        assert.equal(extraordinaryDividendAfterBalanceSheetDate, null);
    });

    it("leaves out an extraordinary dividend that was paid during the year", () => {
        // The usual filing: the line carries the year's extraordinary dividend, but
        // equity is capital plus retained earnings — the money has left the company.
        const { extraordinaryDividend } = resolve({
            equity: 1_300_000,
            contributedCapital: 500_000,
            retainedEarnings: 800_000,
            proposedExtraordinaryDividendRecognisedInEquity: 700_000,
        });

        assert.equal(extraordinaryDividend?.status, "notInEquity");
        assert.equal(extraordinaryDividend?.value, 0);
        assert.equal(extraordinaryDividend?.reported, 700_000);
        assert.equal(extraordinaryDividend?.note, null);
    });

    it("counts an extraordinary dividend that is still in equity, and says so", () => {
        const { extraordinaryDividend } = resolve({
            equity: 2_000_000,
            contributedCapital: 500_000,
            retainedEarnings: 800_000,
            proposedExtraordinaryDividendRecognisedInEquity: 700_000,
        });

        assert.equal(extraordinaryDividend?.status, "inEquity");
        assert.equal(extraordinaryDividend?.value, 700_000);
        assert.match(extraordinaryDividend?.note ?? "", /700\.000 indgår ifølge balancen i den bogførte egenkapital/);
    });

    it("tells the two dividend lines apart when only one of them is in equity", () => {
        const { proposedDividend, extraordinaryDividend } = resolve({
            equity: 1_500_000,
            contributedCapital: 500_000,
            retainedEarnings: 800_000,
            proposedDividendRecognisedInEquity: 200_000,
            proposedExtraordinaryDividendRecognisedInEquity: 300_000,
        });

        assert.equal(proposedDividend?.status, "inEquity");
        assert.equal(extraordinaryDividend?.status, "notInEquity");
    });

    it("does not count a proposed dividend the equity adds up without", () => {
        const { proposedDividend } = resolve({
            equity: 1_300_000,
            contributedCapital: 500_000,
            retainedEarnings: 800_000,
            proposedDividendRecognisedInEquity: 200_000,
        });

        assert.equal(proposedDividend?.status, "notInEquity");
        assert.equal(proposedDividend?.value, 0);
        assert.match(proposedDividend?.note ?? "", /indgår ifølge balancen ikke i den bogførte egenkapital/);
    });

    it("falls back to the rule of each dividend when the equity items cannot tell", () => {
        // No other equity items tagged: the proposed dividend counts (it is a
        // separate equity item by law), the extraordinary one does not.
        const untagged = resolve({ equity: 1_000_000, proposedDividendRecognisedInEquity: 200_000, proposedExtraordinaryDividendRecognisedInEquity: 300_000 });
        assert.equal(untagged.proposedDividend?.status, "undetermined");
        assert.equal(untagged.proposedDividend?.value, 200_000);
        assert.match(untagged.proposedDividend?.note ?? "", /Beløbet er medregnet/);
        assert.equal(untagged.extraordinaryDividend?.status, "undetermined");
        assert.equal(untagged.extraordinaryDividend?.value, 0);
        assert.match(untagged.extraordinaryDividend?.note ?? "", /Beløbet er ikke medregnet/);

        // An amount within the rounding slack of a filing in whole thousands.
        const tiny = resolve(
            { equity: 1_300_000, contributedCapital: 500_000, retainedEarnings: 800_000, proposedDividendRecognisedInEquity: 1_000 },
            {},
            1_000,
        );
        assert.equal(tiny.proposedDividend?.status, "undetermined");
    });

    it("lets the statement of changes in equity settle an extraordinary dividend the balance sheet cannot", () => {
        const { extraordinaryDividend } = resolve(
            { equity: 1_000_000, proposedExtraordinaryDividendRecognisedInEquity: 300_000 },
            { extraordinaryDividendPaid: 300_000 },
        );

        assert.equal(extraordinaryDividend?.status, "notInEquity");
        assert.equal(extraordinaryDividend?.note, null);
    });

    it("counts a dividend distributed after the balance sheet date, next to the proposed one", () => {
        // The after-year-end dividend sits inside retained earnings at the balance sheet date.
        const { proposedDividend, extraordinaryDividendAfterBalanceSheetDate } = resolve(
            {
                equity: 27_600_000,
                contributedCapital: 600_000,
                retainedEarnings: 26_000_000,
                proposedDividendRecognisedInEquity: 1_000_000,
            },
            { extraordinaryDividendDistributedAfterEndOfReportingPeriod: 500_000 },
        );

        assert.equal(proposedDividend?.value, 1_000_000);
        assert.equal(extraordinaryDividendAfterBalanceSheetDate?.status, "inEquity");
        assert.equal(extraordinaryDividendAfterBalanceSheetDate?.value, 500_000);
        assert.match(extraordinaryDividendAfterBalanceSheetDate?.note ?? "", /500\.000 er udloddet efter regnskabsårets udløb/);
    });

    it("counts the same amount once when the after-year-end dividend is the proposed dividend", () => {
        const { proposedDividend, extraordinaryDividendAfterBalanceSheetDate } = resolve(
            { equity: 1_500_000, contributedCapital: 500_000, retainedEarnings: 800_000, proposedDividendRecognisedInEquity: 200_000 },
            { extraordinaryDividendDistributedAfterEndOfReportingPeriod: 200_000 },
        );

        assert.equal(proposedDividend?.value, 200_000);
        assert.equal(extraordinaryDividendAfterBalanceSheetDate?.status, "sameAsAnother");
        assert.equal(extraordinaryDividendAfterBalanceSheetDate?.value, 0);
        assert.match(extraordinaryDividendAfterBalanceSheetDate?.note ?? "", /kun medregnet én gang/);
    });

    it("counts one amount tagged on both dividend lines once, as the proposed dividend", () => {
        const { proposedDividend, extraordinaryDividend } = resolve({
            equity: 2_300_000,
            contributedCapital: 500_000,
            retainedEarnings: 800_000,
            proposedDividendRecognisedInEquity: 1_000_000,
            proposedExtraordinaryDividendRecognisedInEquity: 1_000_000,
        });

        assert.equal(proposedDividend?.status, "inEquity");
        assert.equal(proposedDividend?.value, 1_000_000);
        assert.equal(proposedDividend?.note, null);
        assert.equal(extraordinaryDividend?.status, "sameAsAnother");
        assert.equal(extraordinaryDividend?.value, 0);
        assert.match(extraordinaryDividend?.note ?? "", /kun medregnet én gang/);
    });

    it("reads a dividend tagged with a minus sign as the amount it is", () => {
        const { proposedDividend } = resolve({
            equity: 1_500_000,
            contributedCapital: 500_000,
            retainedEarnings: 800_000,
            proposedDividendRecognisedInEquity: -200_000,
        });

        assert.equal(proposedDividend?.status, "inEquity");
        assert.equal(proposedDividend?.value, 200_000);
    });
});
