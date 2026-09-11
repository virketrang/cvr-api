import * as cheerio from "cheerio";

import type { RatePublication } from "./rate-of-return-on-capital.types.js";
import { AppError, ErrorCode } from "../../utils/api-error.js";
import { fetchUpstream, upstreamStatusError } from "../../utils/http.js";

/**
 * Automatic discovery of kapitalafkastsats announcements on info.skat.dk.
 *
 * info.skat.dk lists every SKM document per year ("Afgørelser, domme,
 * styresignaler, kendelser, SKM-meddelelser mv." → year). Each row carries the
 * SKM number, the title and — in the "Dato for off." column — the exact
 * publication date. The yearly announcement is titled
 * "Kapitalafkastsatsen og rentekorrektionssatsen for {year}", and its document
 * page states the rate in the résumé ("Kapitalafkastsatsen for 2026 er 2 pct.").
 *
 * Every year's listing carries tabs linking to every other year's listing,
 * including years added later, so a single known listing is enough as an entry
 * point: read its tabs, visit the listings for the years not yet known, find
 * the announcement row, and read the rate off the linked document.
 */

const INFO_SKAT_BASE = "https://info.skat.dk/";

/** The SKM listing for 2026 — the entry point whose year tabs lead everywhere else. */
export const ENTRY_LISTING_OID = 939;

const TITLE_PATTERN = /^kapitalafkastsatsen og rentekorrektionssatsen for (20\d{2})$/i;
const REFERENCE_PATTERN = /^SKM\d{4}\.\d+\.[A-ZÆØÅ]+$/i;

export type FetchHtml = (url: string) => Promise<string>;

export interface ListingRow {
    year: number;
    reference: string;
    /** ISO yyyy-mm-dd from the listing's "Dato for off." column. */
    publishedAt: string;
    /** info.skat.dk object id of the announcement document. */
    documentOid: number;
}

export interface Discovery {
    /** Announcements found, sorted by publishedAt ascending. */
    publications: RatePublication[];
    /**
     * Years that have a listing but no readable announcement. Normal for the
     * current year until the announcement appears (August/September); after
     * that it means the listing or document could not be parsed.
     */
    unresolvedYears: number[];
}

export function listingUrl(oid: number): string {
    return `${INFO_SKAT_BASE}data.aspx?oid=${oid}`;
}

export async function fetchHtml(url: string): Promise<string> {
    const response = await fetchUpstream(url);
    if (!response.ok) throw upstreamStatusError("info.skat.dk", response);
    return response.text();
}

function normalize(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

function oidFromHref(href: string | undefined): number | null {
    const match = href?.match(/[?&]oid=(\d+)/);
    return match ? Number(match[1]) : null;
}

/** The year tabs of a listing page: year → listing oid. */
export function parseYearTabs(html: string): Map<number, number> {
    const $ = cheerio.load(html);
    const tabs = new Map<number, number>();

    $(".reportTabs a").each((_, anchor) => {
        const year = Number(normalize($(anchor).text()));
        const oid = oidFromHref($(anchor).attr("href"));
        if (Number.isInteger(year) && year >= 2000 && year <= 2100 && oid) tabs.set(year, oid);
    });

    return tabs;
}

/** The announcement row for `year` in a year listing, or null when it has no such row (yet). */
export function parseAnnouncementRow(html: string, year: number): ListingRow | null {
    const $ = cheerio.load(html);

    for (const row of $("table.report tr").toArray()) {
        const link = $(row)
            .find("a")
            .filter((_, anchor) => {
                const match = TITLE_PATTERN.exec(normalize($(anchor).text()));
                return match !== null && Number(match[1]) === year;
            })
            .first();

        if (link.length === 0) continue;

        const reference = normalize($(row).find("td").first().text());
        const publishedAt = $(row).find("td[data-mode='datetime']").first().attr("data-sort")?.slice(0, 10) ?? "";
        const documentOid = oidFromHref(link.attr("href"));

        if (!REFERENCE_PATTERN.test(reference) || !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt) || !documentOid) {
            return null;
        }

        return { year, reference, publishedAt, documentOid };
    }

    return null;
}

/** The rate stated in an announcement document ("Kapitalafkastsatsen for 2026 er 2 pct."), as a fraction. */
export function parseAnnouncementRate(html: string, year: number): number | null {
    const $ = cheerio.load(html);
    const text = normalize($("body").text());
    const match = new RegExp(`kapitalafkastsatsen for ${year} er (\\d+(?:[.,]\\d+)?)\\s*pct\\.`, "i").exec(text);

    if (!match) return null;

    const value = parseFloat(match[1].replace(",", "."));

    return Number.isFinite(value) ? value / 100 : null;
}

/** Discovers the announcements for every year after `afterYear` that info.skat.dk has a listing for. */
export async function discoverPublicationsAfter(afterYear: number, fetch: FetchHtml = fetchHtml): Promise<Discovery> {
    const entryHtml = await fetch(listingUrl(ENTRY_LISTING_OID));
    const tabs = parseYearTabs(entryHtml);

    if (tabs.size === 0) {
        throw new AppError(
            ErrorCode.UPSTREAM_BAD_RESPONSE,
            "Oversigten over SKM-meddelelser på info.skat.dk kunne ikke læses (ingen årsfaner fundet).",
        );
    }

    const years = [...tabs.keys()].filter((year) => year > afterYear).sort((a, b) => a - b);
    const publications: RatePublication[] = [];
    const unresolvedYears: number[] = [];

    for (const year of years) {
        const oid = tabs.get(year)!;
        const listingHtml = oid === ENTRY_LISTING_OID ? entryHtml : await fetch(listingUrl(oid));
        const row = parseAnnouncementRow(listingHtml, year);

        if (!row) {
            unresolvedYears.push(year);
            continue;
        }

        const value = parseAnnouncementRate(await fetch(listingUrl(row.documentOid)), year);

        if (value === null) {
            unresolvedYears.push(year);
            continue;
        }

        publications.push({
            year,
            value,
            publishedAt: row.publishedAt,
            reference: row.reference,
            sourceUrl: listingUrl(row.documentOid),
        });
    }

    publications.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

    return { publications, unresolvedYears };
}
