export type RateEntry = { year: number; value: number | null };

/** One yearly announcement of the kapitalafkastsats (virksomhedsskattelovens § 9). */
export interface RatePublication {
    /** The income year the rate applies to. */
    year: number;
    /** The rate as a decimal fraction, e.g. 0.04 for 4 pct. */
    value: number;
    /** The day Skattestyrelsen published the announcement (ISO yyyy-mm-dd). */
    publishedAt: string;
    /** The SKM reference of the announcement, e.g. "SKM2024.399.SKTST". */
    reference: string;
    /** Where the publication date was verified. */
    sourceUrl: string;
}

/** The rate that was the most recently published one on a given date. */
export interface RateAtDate {
    /** The date that was asked about (ISO yyyy-mm-dd). */
    requestedDate: string;
    /** The income year the returned rate was announced for. */
    year: number;
    /** The rate as a decimal fraction, e.g. 0.04 for 4 pct. */
    value: number;
    /** Publication date of the announcement (ISO), or null when only known from the live skm.dk table. */
    publishedAt: string | null;
    /** SKM reference of the announcement, or null when only known from the live skm.dk table. */
    reference: string | null;
    /** A Danish caveat when the answer could not be settled from the register alone. */
    warning: string | null;
}
