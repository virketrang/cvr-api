export default function formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat("da-DK", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(date));
}

/** Danish and English month names and their common abbreviations. */
const MONTH_NAMES: Record<string, number> = {
    januar: 1,
    january: 1,
    jan: 1,
    februar: 2,
    february: 2,
    feb: 2,
    marts: 3,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    maj: 5,
    may: 5,
    juni: 6,
    june: 6,
    jun: 6,
    juli: 7,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    september: 9,
    sept: 9,
    sep: 9,
    oktober: 10,
    october: 10,
    okt: 10,
    oct: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12,
};

/** ISO yyyy-mm-dd when the components form a real calendar date, otherwise null. */
function toIsoIfValid(year: number, month: number, day: number): string | null {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parses a date in any common Danish, ISO, or English format into ISO yyyy-mm-dd,
 * or returns null when the input is not a recognizable, valid calendar date.
 *
 * Accepted: year-first (2025-12-31, 2025/12/31, 2025.12.31), day-first
 * (31-12-2025, 31/12/2025, 31.12.2025), compact (20251231, 31122025), month
 * names in Danish or English ("31. december 2025", "dec 31, 2025"), single-digit
 * day/month (1-2-2025), and a trailing time part is ignored (2025-12-31T00:00:00Z).
 *
 * Numeric day/month is read day-first (Danish convention); month-first (US) is
 * used only when day-first is impossible, e.g. 12/31/2025. The year must always
 * have 4 digits — two-digit years are rejected as ambiguous.
 */
export function parseFlexibleDate(input: string): string | null {
    let text = input.trim().toLowerCase();

    // Ignore a trailing time part: "2025-12-31T00:00:00.000Z", "31-12-2025 12:30".
    text = text.replace(/[t\s]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(z|[+-]\d{2}:?\d{2})?$/i, "");

    // Year first: 2025-12-31, 2025/12/31, 2025.12.31 (single-digit day/month allowed).
    let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (match) return toIsoIfValid(Number(match[1]), Number(match[2]), Number(match[3]));

    // Day first (Danish): 31-12-2025, 31/12/2025, 31.12.2025. If the day-first
    // reading is impossible (e.g. 12/31/2025), fall back to month-first (US).
    match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (match) {
        return (
            toIsoIfValid(Number(match[3]), Number(match[2]), Number(match[1])) ??
            toIsoIfValid(Number(match[3]), Number(match[1]), Number(match[2]))
        );
    }

    // Compact 8 digits: prefer YYYYMMDD, fall back to DDMMYYYY (e.g. 19122025,
    // whose first four digits look like a year but make an invalid YMD date).
    if (/^\d{8}$/.test(text)) {
        return (
            toIsoIfValid(Number(text.slice(0, 4)), Number(text.slice(4, 6)), Number(text.slice(6, 8))) ??
            toIsoIfValid(Number(text.slice(4, 8)), Number(text.slice(2, 4)), Number(text.slice(0, 2)))
        );
    }

    // Day + month name: "31. december 2025", "31 dec 2025".
    match = text.match(/^(\d{1,2})\.?\s+([a-zæøå]+)\.?\s+(\d{4})$/);
    if (match) {
        const month = MONTH_NAMES[match[2]];
        return month ? toIsoIfValid(Number(match[3]), month, Number(match[1])) : null;
    }

    // Month name + day: "december 31, 2025", "dec 31 2025".
    match = text.match(/^([a-zæøå]+)\.?\s+(\d{1,2})\.?,?\s+(\d{4})$/);
    if (match) {
        const month = MONTH_NAMES[match[1]];
        return month ? toIsoIfValid(Number(match[3]), month, Number(match[2])) : null;
    }

    return null;
}
