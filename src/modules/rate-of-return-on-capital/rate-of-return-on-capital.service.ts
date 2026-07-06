import * as cheerio from "cheerio";
import type { RateEntry } from "./rate-of-return-on-capital.types.js";
import { fetchUpstream, upstreamStatusError } from "../../utils/http.js";

const KEYWORDS = ["kapitalafkastsats", "§ 9, stk. 1"] as const;

const URL = "https://skm.dk/tal-og-metode/satser/satser-og-beloebsgraenser-i-lovgivningen/virksomhedsskatteloven";

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
