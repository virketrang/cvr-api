import type { RatePublication } from "./rate-of-return-on-capital.types.js";

/**
 * Verified history of Skattestyrelsen's yearly kapitalafkastsats announcements
 * (virksomhedsskattelovens § 9), keyed by the day each one was published.
 *
 * Why publication dates matter: the rate for income year Y is computed from the
 * first six months of Y and announced in August/September of Y. For a transfer
 * valued under boafgiftslovens § 12 a the applicable rate is the one most
 * recently published on the transfer date — not the calendar year's rate — so a
 * transfer in March 2025 uses the 2024 rate (published 15 August 2024), while
 * one in October 2025 uses the 2025 rate (published 19 September 2025).
 *
 * This list is only a seed: announcements for years after the last row are
 * discovered automatically from info.skat.dk's yearly SKM listings (see
 * rate-of-return-on-capital.skm.ts), so nothing here needs updating when a new
 * rate is announced. Rows may be appended to save a lookup, but never need to be.
 *
 * Every row was verified against the "Dato for off." column of the year's SKM
 * listing on info.skat.dk. Coverage starts at the 2018 announcement. Rows are
 * sorted by publishedAt ascending.
 */
export const SEED_PUBLICATIONS: readonly RatePublication[] = [
    {
        year: 2018,
        value: 0,
        publishedAt: "2018-08-06",
        reference: "SKM2018.397.SKTST",
        sourceUrl: "https://info.skat.dk/data.aspx?oid=2273809",
    },
    {
        year: 2019,
        value: 0,
        publishedAt: "2019-08-14",
        reference: "SKM2019.392.SKTST",
        sourceUrl: "https://info.skat.dk/data.aspx?oid=2290421",
    },
    {
        year: 2020,
        value: 0,
        publishedAt: "2020-08-25",
        reference: "SKM2020.362.SKTST",
        sourceUrl: "https://info.skat.dk/data.aspx?oid=2297186",
    },
    {
        year: 2021,
        value: 0,
        publishedAt: "2021-09-10",
        reference: "SKM2021.472.SKTST",
        sourceUrl: "https://info.skat.dk/data.aspx?oid=2335186",
    },
    {
        year: 2022,
        value: 0,
        publishedAt: "2022-08-11",
        reference: "SKM2022.389.SKTST",
        sourceUrl: "https://info.skat.dk/data.aspx?oid=2351249",
    },
    {
        year: 2023,
        value: 0.03,
        publishedAt: "2023-08-29",
        reference: "SKM2023.414.SKTST",
        sourceUrl: "https://info.skat.dk/data.aspx?oid=2387663",
    },
    {
        year: 2024,
        value: 0.04,
        publishedAt: "2024-08-15",
        reference: "SKM2024.399.SKTST",
        sourceUrl: "https://info.skat.dk/data.aspx?oid=2401230",
    },
    {
        year: 2025,
        value: 0.02,
        publishedAt: "2025-09-19",
        reference: "SKM2025.530.SKTST",
        sourceUrl: "https://info.skat.dk/data.aspx?oid=2459074",
    },
    {
        year: 2026,
        value: 0.02,
        publishedAt: "2026-08-24",
        reference: "SKM2026.414.SKTST",
        sourceUrl: "https://info.skat.dk/data.aspx?oid=2461742",
    },
];
