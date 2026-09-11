import * as cheerio from "cheerio";
import type { RateAtDate, RateEntry } from "./rate-of-return-on-capital.types.js";
import { SEED_PUBLICATIONS } from "./rate-of-return-on-capital.publications.js";
import { PublicationRegistry } from "./rate-of-return-on-capital.registry.js";
import { discoverPublicationsAfter } from "./rate-of-return-on-capital.skm.js";
import { AppError, ErrorCode } from "../../utils/api-error.js";
import formatDate from "../../utils/format-date.js";
import { fetchUpstream, upstreamStatusError } from "../../utils/http.js";

const KEYWORDS = ["kapitalafkastsats", "§ 9, stk. 1"] as const;

// Skatteministeriet moved its site from skm.dk to svmn.dk (skm.dk now 301-redirects).
const URL = "https://svmn.dk/tal-og-metode/satser/satser-og-beloebsgraenser-i-lovgivningen/virksomhedsskatteloven";

/** The process-wide register: verified seed + announcements discovered on info.skat.dk. */
const registry = new PublicationRegistry(SEED_PUBLICATIONS, discoverPublicationsAfter);

/** Hooks for tests: freeze "today", swap the register, replace the live scrape. */
export interface RateAtDateOptions {
    /** Today's date in Denmark (ISO yyyy-mm-dd). */
    today?: string;
    /** The publication register; defaults to the process-wide one. */
    registry?: PublicationRegistry;
    /** The live skm.dk table; defaults to {@link RateOfReturnOnCapitalService.getRateOfReturnOnCapital}. */
    fetchLive?: () => Promise<RateEntry[] | null>;
}

function todayInDenmark(): string {
    // en-CA formats as yyyy-mm-dd.
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Copenhagen",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

function formatPct(value: number): string {
    return `${(value * 100).toLocaleString("da-DK")} pct.`;
}

export default abstract class RateOfReturnOnCapitalService {
    public static parsePctValue(text: string | null): number | null {
        if (!text) return null;

        const match = text.match(/(\d+(?:[.,]\d+)?)\s*pct\./i);

        if (!match) return null;

        const value = parseFloat(match[1].replace(",", "."));

        return Number.isFinite(value) ? value / 100 : null;
    }

    public static normalizeText(text: string): string {
        return text.replace(/\s+/g, " ").trim().toLowerCase();
    }

    /**
     * The kapitalafkastsats that was the most recently published one on `date`
     * (ISO yyyy-mm-dd) — the rate boafgiftslovens § 12 a, stk. 7-8 refers to as
     * "den på overdragelsestidspunktet gældende kapitalafkastsats".
     *
     * The answer comes from the publication register (verified seed + automatic
     * discovery on info.skat.dk). Two situations produce a `warning`:
     * - A year has a listing on info.skat.dk but no readable announcement even
     *   though the date is past 1 October of that year — announcements have
     *   always appeared in August/September, so the register may be incomplete.
     * - Discovery failed and `date` lies after the newest known announcement.
     *   The live skm.dk table is then used as a second opinion: if it shows a
     *   newer year and `date` is today or later, that rate is returned (without
     *   a publication date); for a past date the register's answer stands.
     */
    public static async getRateOfReturnOnCapitalAtDate(date: string, options: RateAtDateOptions = {}): Promise<RateAtDate> {
        const { publications, unresolvedYears, discoveryError } = await (options.registry ?? registry).get();
        const earliest = publications[0];
        const newest = publications[publications.length - 1];

        if (!earliest || !newest || date < earliest.publishedAt) {
            throw new AppError(
                ErrorCode.NOT_FOUND,
                earliest
                    ? `Registret over kapitalafkastsatser dækker først fra ${formatDate(earliest.publishedAt)} ` +
                      `(${earliest.reference}); der kan ikke slås en sats op for den ${formatDate(date)}.`
                    : "Registret over kapitalafkastsatser er tomt.",
            );
        }

        // Publications are sorted ascending, so the last one on/before `date` wins.
        let current = earliest;
        for (const publication of publications) {
            if (publication.publishedAt <= date) current = publication;
        }

        const answer: RateAtDate = {
            requestedDate: date,
            year: current.year,
            value: current.value,
            publishedAt: current.publishedAt,
            reference: current.reference,
            warning: null,
        };

        // An announcement that should be out by now but was not found: the
        // register may be missing the rate that was in force on `date`.
        const missing = unresolvedYears.find((year) => year > current.year && date >= `${year}-10-01`);
        if (missing) {
            return {
                ...answer,
                warning:
                    `Der er ikke fundet nogen SKM-meddelelse om kapitalafkastsatsen for ${missing} på info.skat.dk, ` +
                    `selvom den normalt er offentliggjort i august/september. Svaret bygger på satsen for ${current.year} ` +
                    `(${current.reference}) og bør kontrolleres.`,
            };
        }

        // Inside the register's known span the register is decisive; beyond it
        // only a failed discovery leaves room for an unknown newer announcement.
        if (date <= newest.publishedAt || discoveryError === null) return answer;

        let live: RateEntry[] | null;
        try {
            live = await (options.fetchLive ?? RateOfReturnOnCapitalService.getRateOfReturnOnCapital)();
        } catch {
            return {
                ...answer,
                warning:
                    `Det kunne ikke kontrolleres, om der er offentliggjort en nyere kapitalafkastsats end satsen for ` +
                    `${newest.year} (${newest.reference}): info.skat.dk svarede "${discoveryError}", og skm.dk kunne ` +
                    `heller ikke nås. Svaret bygger alene på API'ets register.`,
            };
        }

        const newer = (live ?? [])
            .filter((entry): entry is { year: number; value: number } => entry.value !== null && entry.year > newest.year)
            .sort((a, b) => b.year - a.year)[0];

        if (!newer) return answer;

        const today = options.today ?? todayInDenmark();

        if (date >= today) {
            return {
                requestedDate: date,
                year: newer.year,
                value: newer.value,
                publishedAt: null,
                reference: null,
                warning:
                    `Kapitalafkastsatsen for ${newer.year} (${formatPct(newer.value)}) er offentliggjort ifølge skm.dk, ` +
                    `men offentliggørelsesdatoen kunne ikke hentes fra info.skat.dk ("${discoveryError}").`,
            };
        }

        return {
            ...answer,
            warning:
                `Kapitalafkastsatsen for ${newer.year} (${formatPct(newer.value)}) er offentliggjort ifølge skm.dk efter ` +
                `${formatDate(newest.publishedAt)}, men offentliggørelsesdatoen kunne ikke hentes fra info.skat.dk ` +
                `("${discoveryError}"). Det kan derfor ikke afgøres, om den var gældende den ${formatDate(date)}.`,
        };
    }

    public static async getRateOfReturnOnCapital(): Promise<RateEntry[] | null> {
        const response = await fetchUpstream(URL);

        if (!response.ok) {
            // Without this check we would scrape an error page and return a misleading
            // 404 "data not found" instead of a truthful "source site is down".
            throw upstreamStatusError("Skat.dk", response);
        }

        const html = await response.text();

        const $ = cheerio.load(html);

        // find the table that mentions both 'kapitalafkast' and the section
        const table = $("table")
            .toArray()
            .find((t) => {
                const txt = $(t).text().toLowerCase();
                return txt.includes(KEYWORDS[0]) && txt.includes(KEYWORDS[1].toLowerCase());
            });

        if (!table) return null;

        const $table = $(table);

        // find a header row (thead tr) or fallback to first tr in table
        let headerRow = $table.find("thead tr").first();
        if (!headerRow || headerRow.length === 0) {
            headerRow = $table.find("tr").first();
        }
        if (!headerRow || headerRow.length === 0) return null;

        const headerCells = headerRow.find("th,td").toArray();

        // map header cell index => year (only keep cells that contain a 4-digit year)
        const yearMap = new Map<number, number>();

        headerCells.forEach((cell, idx) => {
            const text = RateOfReturnOnCapitalService.normalizeText($(cell).text());
            const match = text.match(/\b(20\d{2})\b/);
            if (match) {
                yearMap.set(idx, Number(match[1]));
            }
        });

        // if we didn't find year headers, try to interpret numeric headers as years (e.g. "25" => "2025")
        if (yearMap.size === 0) {
            headerCells.forEach((cell, idx) => {
                const text = RateOfReturnOnCapitalService.normalizeText($(cell).text());
                const match = text.match(/\b(\d{2})\b/);
                if (match) {
                    const twoDigitYear = parseInt(match[1], 10);
                    if (twoDigitYear >= 0 && twoDigitYear <= 99) {
                        const fullYear = twoDigitYear < 50 ? 2000 + twoDigitYear : 1900 + twoDigitYear;
                        if (fullYear >= 2000) {
                            yearMap.set(idx, fullYear);
                        }
                    }
                }
            });
        }

        // find the row that contains the label (prefer rows containing both keyword and section)
        let rows = $table.find("tbody tr").toArray();

        const exactMatch = rows.find((row) => {
            const labelText = RateOfReturnOnCapitalService.normalizeText($(row).find("td, th").first().text());
            return KEYWORDS.every((keyword) => labelText.includes(keyword.toLowerCase()));
        });

        if (!exactMatch) return null;

        // use the same index positions as the header to pick values from the found row
        const dataCells = $(exactMatch).find("th,td").toArray();

        const entries: RateEntry[] = Array.from(yearMap.entries()).map(([idx, year]) => {
            const cell = dataCells[idx];
            const rawText = cell ? RateOfReturnOnCapitalService.normalizeText($(cell).text()) : null;
            const value = RateOfReturnOnCapitalService.parsePctValue(rawText);
            return { year, value };
        });

        // Sort by year
        return entries.sort((a, b) => a.year - b.year);
    }
}
