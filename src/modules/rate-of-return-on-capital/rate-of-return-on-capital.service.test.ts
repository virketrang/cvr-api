import { describe, it } from "node:test";
import assert from "node:assert/strict";

import RateOfReturnOnCapitalService from "./rate-of-return-on-capital.service.js";
import { SEED_PUBLICATIONS } from "./rate-of-return-on-capital.publications.js";
import { PublicationRegistry } from "./rate-of-return-on-capital.registry.js";
import type { Discovery } from "./rate-of-return-on-capital.skm.js";
import type { RateEntry, RatePublication } from "./rate-of-return-on-capital.types.js";
import { AppError, ErrorCode } from "../../utils/api-error.js";

const { getRateOfReturnOnCapitalAtDate } = RateOfReturnOnCapitalService;

const seedNewest = SEED_PUBLICATIONS[SEED_PUBLICATIONS.length - 1];

const publication2027: RatePublication = {
    year: 2027,
    value: 0.03,
    publishedAt: "2027-09-02",
    reference: "SKM2027.500.SKTST",
    sourceUrl: "https://info.skat.dk/data.aspx?oid=7000",
};

function registryWith(discovery: Discovery | Error, ttlMs?: number, now?: () => number): PublicationRegistry {
    return new PublicationRegistry(
        SEED_PUBLICATIONS,
        async () => {
            if (discovery instanceof Error) throw discovery;
            return discovery;
        },
        ttlMs,
        now,
    );
}

const nothingNew = registryWith({ publications: [], unresolvedYears: [] });
const with2027 = registryWith({ publications: [publication2027], unresolvedYears: [] });
const discoveryDown = registryWith(new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, "info.skat.dk nede"));

describe("SEED_PUBLICATIONS", () => {
    it("is sorted by publication date with strictly increasing years", () => {
        for (let i = 1; i < SEED_PUBLICATIONS.length; i++) {
            assert.ok(SEED_PUBLICATIONS[i - 1].publishedAt < SEED_PUBLICATIONS[i].publishedAt);
            assert.equal(SEED_PUBLICATIONS[i].year, SEED_PUBLICATIONS[i - 1].year + 1);
        }
    });

    it("publishes each year's rate within that year, in its second half", () => {
        for (const publication of SEED_PUBLICATIONS) {
            assert.equal(Number(publication.publishedAt.slice(0, 4)), publication.year);
            assert.ok(Number(publication.publishedAt.slice(5, 7)) >= 7, `${publication.reference} published before July`);
        }
    });
});

describe("PublicationRegistry", () => {
    it("appends discovered years after the seed and keeps the list sorted", async () => {
        const snapshot = await with2027.get();
        assert.deepEqual(snapshot.publications.slice(-2).map((p) => p.year), [seedNewest.year, 2027]);
        assert.equal(snapshot.discoveryError, null);
    });

    it("discovers once per TTL and shares the result", async () => {
        let calls = 0;
        let clock = 0;
        const registry = new PublicationRegistry(
            SEED_PUBLICATIONS,
            async () => {
                calls++;
                return { publications: [], unresolvedYears: [] };
            },
            1000,
            () => clock,
        );
        await Promise.all([registry.get(), registry.get()]);
        await registry.get();
        assert.equal(calls, 1);
        clock = 1001;
        await registry.get();
        assert.equal(calls, 2);
    });

    it("keeps serving the last good discovery when a refresh fails, and reports the error", async () => {
        let fail = false;
        let clock = 0;
        const registry = new PublicationRegistry(
            SEED_PUBLICATIONS,
            async () => {
                if (fail) throw new Error("nede");
                return { publications: [publication2027], unresolvedYears: [] };
            },
            1000,
            () => clock,
        );
        await registry.get();
        fail = true;
        clock = 5000;
        const snapshot = await registry.get();
        assert.equal(snapshot.discoveryError, "nede");
        assert.equal(snapshot.publications.at(-1)?.year, 2027);
    });
});

describe("getRateOfReturnOnCapitalAtDate", () => {
    it("uses the most recently published rate, not the calendar year's rate", async () => {
        // March 2025: the 2025 rate (2 pct.) was not announced until 19 Sep 2025,
        // so the 2024 rate (4 pct., published 15 Aug 2024) is the one in force.
        const rate = await getRateOfReturnOnCapitalAtDate("2025-03-01", { registry: nothingNew });
        assert.deepEqual(rate, {
            requestedDate: "2025-03-01",
            year: 2024,
            value: 0.04,
            publishedAt: "2024-08-15",
            reference: "SKM2024.399.SKTST",
            warning: null,
        });
    });

    it("switches to the new rate on its publication day", async () => {
        const before = await getRateOfReturnOnCapitalAtDate("2025-09-18", { registry: nothingNew });
        const on = await getRateOfReturnOnCapitalAtDate("2025-09-19", { registry: nothingNew });
        assert.equal(before.year, 2024);
        assert.equal(on.year, 2025);
        assert.equal(on.value, 0.02);
    });

    it("rejects dates before the register starts", async () => {
        await assert.rejects(
            getRateOfReturnOnCapitalAtDate("2018-08-05", { registry: nothingNew }),
            (error: unknown) => error instanceof AppError && error.errorCode === ErrorCode.NOT_FOUND,
        );
        const first = await getRateOfReturnOnCapitalAtDate("2018-08-06", { registry: nothingNew });
        assert.equal(first.year, 2018);
        assert.equal(first.value, 0);
    });

    it("answers from a discovered announcement without any warning", async () => {
        const before = await getRateOfReturnOnCapitalAtDate("2027-09-01", { registry: with2027 });
        const after = await getRateOfReturnOnCapitalAtDate("2027-09-02", { registry: with2027 });
        assert.equal(before.year, seedNewest.year);
        assert.equal(before.warning, null);
        assert.equal(after.year, 2027);
        assert.equal(after.value, 0.03);
        assert.equal(after.reference, "SKM2027.500.SKTST");
        assert.equal(after.warning, null);
    });

    describe("a year whose announcement could not be found", () => {
        const registry = registryWith({ publications: [], unresolvedYears: [2027] });

        it("is silent before October — the announcement is simply not out yet", async () => {
            const rate = await getRateOfReturnOnCapitalAtDate("2027-09-30", { registry });
            assert.equal(rate.year, seedNewest.year);
            assert.equal(rate.warning, null);
        });

        it("warns from 1 October, when the announcement should have appeared", async () => {
            const rate = await getRateOfReturnOnCapitalAtDate("2027-10-01", { registry });
            assert.equal(rate.year, seedNewest.year);
            assert.match(rate.warning ?? "", /2027/);
            assert.match(rate.warning ?? "", /bør kontrolleres/);
        });
    });

    describe("when discovery on info.skat.dk fails", () => {
        const later = "2027-03-01";
        const today = "2027-04-01";
        const liveUnchanged = async (): Promise<RateEntry[]> => [{ year: seedNewest.year, value: seedNewest.value }, { year: seedNewest.year + 1, value: null }];
        const liveWithNewYear = async (): Promise<RateEntry[]> => [{ year: seedNewest.year + 1, value: 0.03 }];
        const liveFails = async (): Promise<RateEntry[]> => {
            throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, "nede");
        };

        it("is still decisive for dates inside the known span", async () => {
            const rate = await getRateOfReturnOnCapitalAtDate("2025-03-01", { registry: discoveryDown, fetchLive: liveFails });
            assert.equal(rate.year, 2024);
            assert.equal(rate.warning, null);
        });

        it("returns the newest known rate without warning when skm.dk shows nothing newer", async () => {
            const rate = await getRateOfReturnOnCapitalAtDate(later, { registry: discoveryDown, today, fetchLive: liveUnchanged });
            assert.equal(rate.year, seedNewest.year);
            assert.equal(rate.warning, null);
        });

        it("returns skm.dk's newer rate with a warning for today or later", async () => {
            const rate = await getRateOfReturnOnCapitalAtDate(today, { registry: discoveryDown, today, fetchLive: liveWithNewYear });
            assert.equal(rate.year, seedNewest.year + 1);
            assert.equal(rate.value, 0.03);
            assert.equal(rate.publishedAt, null);
            assert.equal(rate.reference, null);
            assert.match(rate.warning ?? "", /info.skat.dk nede/);
        });

        it("keeps the known rate but warns for a past date when skm.dk shows a newer year", async () => {
            const rate = await getRateOfReturnOnCapitalAtDate(later, { registry: discoveryDown, today, fetchLive: liveWithNewYear });
            assert.equal(rate.year, seedNewest.year);
            assert.match(rate.warning ?? "", /kan derfor ikke afgøres/);
        });

        it("warns when skm.dk is down as well", async () => {
            const rate = await getRateOfReturnOnCapitalAtDate(later, { registry: discoveryDown, today, fetchLive: liveFails });
            assert.equal(rate.year, seedNewest.year);
            assert.match(rate.warning ?? "", /heller ikke nås/);
        });
    });
});
