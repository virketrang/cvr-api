import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    discoverPublicationsAfter,
    ENTRY_LISTING_OID,
    listingUrl,
    parseAnnouncementRate,
    parseAnnouncementRow,
    parseYearTabs,
} from "./rate-of-return-on-capital.skm.js";

/** Markup modelled on info.skat.dk's yearly SKM listing (data.aspx?oid=939 etc.). */
function listing(options: { tabs: [number, number][]; rows: string[] }): string {
    const tabs = options.tabs
        .map(([year, oid]) => `<div class="reportTab"><a href="data.aspx?oid=${oid}">${year}</a></div>`)
        .join("");
    return `<html><body>
        <table class="table table-bordered bleg report report-t86"><thead><tr><th>SKM nummer</th><th>SKM Overskrift</th><th>Dato for off</th></tr></thead>
        <tbody>${options.rows.join("")}</tbody></table>
        <div class="reportTabsWrapper"><div class="reportTabs">${tabs}</div></div>
        </body></html>`;
}

function row(reference: string, title: string, documentOid: number, publishedAt: string, decidedAt: string): string {
    return (
        `<tr class="TableRow"><td class="bleg report text-nowrap">${reference}</td>` +
        `<td class="bleg report"><a href="data.aspx?oid=${documentOid}" title="Tryk her for at se dokumentet">${title}</a></td>` +
        `<td class="bleg report text-nowrap dateShort" data-mode="datetime" data-sort="${publishedAt}">x</td>` +
        `<td class="bleg report text-nowrap dateShort" data-mode="datetime" data-sort="${decidedAt}">y</td>` +
        `<td>Kapitalindkomst og fradrag i kapitalindkomsten</td><td>SKM-meddelelse</td></tr>`
    );
}

/** Markup modelled on an announcement document page. */
function document(year: number, rate: string): string {
    return `<html><body><table class="table edge"><tbody>
        <tr><td><div>Dato for udgivelse</div></td><td>24 Aug ${year} 15:12</td></tr>
        <tr><td><div>SKM-nummer</div></td><td>SKM${year}.414.SKTST</td></tr>
        <tr><td><div>Resumé</div></td><td><p><strong>Kapitalafkastsatsen for ${year} er ${rate} pct.
        Rentekorrektionssatsen for ${year} er 5 pct.&nbsp;</strong></p></td></tr>
        </tbody></table></body></html>`;
}

const otherRow = row("SKM2026.413.LSR", "Fradrag for udgifter til noget helt andet", 111, "2026-08-24 09:00:00", "2026-08-20 12:00:00");
const announcement2026 = row(
    "SKM2026.414.SKTST",
    "Kapitalafkastsatsen og rentekorrektionssatsen for 2026",
    2461742,
    "2026-08-24 15:12:00",
    "2026-08-20 12:00:00",
);

describe("parseYearTabs", () => {
    it("maps each year tab to its listing oid", () => {
        const tabs = parseYearTabs(listing({ tabs: [[2026, 939], [2025, 491], [2024, 69324]], rows: [] }));
        assert.deepEqual([...tabs.entries()], [
            [2026, 939],
            [2025, 491],
            [2024, 69324],
        ]);
    });

    it("returns an empty map when the page has no tabs", () => {
        assert.equal(parseYearTabs("<html><body>Fejl</body></html>").size, 0);
    });
});

describe("parseAnnouncementRow", () => {
    it("finds the announcement row by title and reads reference, publication date and document oid", () => {
        const html = listing({ tabs: [], rows: [otherRow, announcement2026] });
        assert.deepEqual(parseAnnouncementRow(html, 2026), {
            year: 2026,
            reference: "SKM2026.414.SKTST",
            publishedAt: "2026-08-24",
            documentOid: 2461742,
        });
    });

    it("returns null when the year has no announcement yet", () => {
        assert.equal(parseAnnouncementRow(listing({ tabs: [], rows: [otherRow] }), 2026), null);
    });

    it("does not accept another year's announcement", () => {
        assert.equal(parseAnnouncementRow(listing({ tabs: [], rows: [announcement2026] }), 2027), null);
    });

    it("returns null when the row lacks a usable publication date", () => {
        const broken = row("SKM2026.414.SKTST", "Kapitalafkastsatsen og rentekorrektionssatsen for 2026", 1, "", "");
        assert.equal(parseAnnouncementRow(listing({ tabs: [], rows: [broken] }), 2026), null);
    });
});

describe("parseAnnouncementRate", () => {
    it("reads the rate from the résumé as a fraction", () => {
        assert.equal(parseAnnouncementRate(document(2026, "2"), 2026), 0.02);
    });

    it("accepts a decimal comma", () => {
        assert.equal(parseAnnouncementRate(document(2026, "2,5"), 2026), 0.025);
    });

    it("returns null when the document is about another year", () => {
        assert.equal(parseAnnouncementRate(document(2025, "2"), 2026), null);
    });
});

describe("discoverPublicationsAfter", () => {
    const pages = new Map<string, string>([
        [
            listingUrl(ENTRY_LISTING_OID),
            listing({ tabs: [[2028, 5000], [2027, 4000], [2026, ENTRY_LISTING_OID], [2025, 491]], rows: [announcement2026] }),
        ],
        [
            listingUrl(4000),
            listing({
                tabs: [],
                rows: [row("SKM2027.500.SKTST", "Kapitalafkastsatsen og rentekorrektionssatsen for 2027", 7000, "2027-09-02 10:00:00", "2027-09-01 12:00:00")],
            }),
        ],
        [listingUrl(5000), listing({ tabs: [], rows: [otherRow] })],
        [listingUrl(7000), document(2027, "3")],
        [listingUrl(2461742), document(2026, "2")],
    ]);
    const fetched: string[] = [];
    const fetch = async (url: string) => {
        fetched.push(url);
        const html = pages.get(url);
        if (!html) throw new Error(`unexpected fetch ${url}`);
        return html;
    };

    it("walks the year tabs after the given year, reads each announcement and flags years without one", async () => {
        fetched.length = 0;
        const discovery = await discoverPublicationsAfter(2026, fetch);
        assert.deepEqual(discovery.publications, [
            {
                year: 2027,
                value: 0.03,
                publishedAt: "2027-09-02",
                reference: "SKM2027.500.SKTST",
                sourceUrl: listingUrl(7000),
            },
        ]);
        assert.deepEqual(discovery.unresolvedYears, [2028]);
        // Entry listing, 2027 listing, 2027 document, 2028 listing — nothing for the known years.
        assert.deepEqual(fetched, [listingUrl(ENTRY_LISTING_OID), listingUrl(4000), listingUrl(7000), listingUrl(5000)]);
    });

    it("reuses the entry listing instead of fetching it twice when its own year is wanted", async () => {
        fetched.length = 0;
        const discovery = await discoverPublicationsAfter(2025, fetch);
        assert.deepEqual(
            discovery.publications.map((p) => p.year),
            [2026, 2027],
        );
        assert.equal(fetched.filter((url) => url === listingUrl(ENTRY_LISTING_OID)).length, 1);
    });

    it("fails loudly when the entry page has no year tabs", async () => {
        await assert.rejects(discoverPublicationsAfter(2026, async () => "<html><body>Vedligeholdelse</body></html>"), /årsfaner/);
    });
});
