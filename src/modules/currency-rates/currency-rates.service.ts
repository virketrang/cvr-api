import type { CurrencyRate } from "./currency-rates.types.js";
import { AppError, ErrorCode, defaultMessage } from "../../utils/api-error.js";
import { fetchUpstream, parseUpstreamJson, upstreamStatusError } from "../../utils/http.js";

// Statistics Denmark's StatBank API, table DNVALD ("Daily exchange rates"),
// which publishes Nationalbanken's official daily DKK rates.
// Docs: https://www.dst.dk/da/Statistik/hjaelp-til-statistikbanken/api
const DST_API_URL = "https://api.statbank.dk/v1/data";
const TABLE = "DNVALD";
// KURTYP = "KBH": exchange rates quoted as DKK per 100 units of foreign currency.
const RATE_TYPE = "KBH";

const MS_PER_DAY = 86_400_000;

/** A month's worth of rates for one currency: ISO date (yyyy-mm-dd) -> DKK per 100 units. */
interface MonthRates {
    rates: Map<string, number>;
    /** Nationalbanken's description of the currency, e.g. "Svenske kroner". */
    desc: string | null;
}

export default abstract class CurrencyRatesService {
    /**
     * Returns the exchange rate for `code` on `date` (ISO yyyy-mm-dd).
     *
     * If the date is not a banking day (weekend/holiday, or not yet published),
     * it falls back to the most recent preceding banking day — but at most
     * `maxFallbackDays` calendar days back, so an outdated rate is never returned
     * for a currency that has been delisted.
     */
    public static async getRate(code: string, date: string, maxFallbackDays = 10): Promise<CurrencyRate> {
        const currency = code.toUpperCase();

        // DKK against DKK is 1 by definition; the table does not quote it.
        if (currency === "DKK") {
            return {
                requestedDate: date,
                rateDate: date,
                currency,
                description: "Danske kroner",
                ratePer100: 100,
                rate: 1,
            };
        }

        const rates = new Map<string, number>();
        let description: string | null = null;

        const collect = async (monthCode: string): Promise<void> => {
            const month = await CurrencyRatesService.fetchMonth(currency, monthCode);
            for (const [isoDate, value] of month.rates) rates.set(isoDate, value);
            if (!description && month.desc) description = month.desc;
        };

        // Fetch the requested month first; only reach into the previous month if the
        // fallback target (most recent banking day on/before `date`) isn't there yet —
        // e.g. when `date` falls on/just after the 1st and the prior banking day is in
        // the previous month, or the requested month has no data at all.
        await collect(CurrencyRatesService.monthCode(date));
        if (![...rates.keys()].some((d) => d <= date)) {
            await collect(CurrencyRatesService.previousMonthCode(date));
        }

        const candidateDates = [...rates.keys()].filter((d) => d <= date).sort().reverse();

        if (candidateDates.length === 0) {
            throw new AppError(ErrorCode.NOT_FOUND, `Der er ingen noterede valutakurser på eller før ${date}.`);
        }

        const requestedMs = Date.parse(`${date}T00:00:00Z`);

        for (const rateDate of candidateDates) {
            const diffDays = (requestedMs - Date.parse(`${rateDate}T00:00:00Z`)) / MS_PER_DAY;
            if (diffDays > maxFallbackDays) break; // too far back — give up

            const ratePer100 = rates.get(rateDate)!;
            return {
                requestedDate: date,
                rateDate,
                currency,
                description: description ?? currency,
                ratePer100,
                // Round to 6 decimals to avoid binary-float noise (e.g. 7.474500000000001).
                rate: Math.round((ratePer100 / 100) * 1e6) / 1e6,
            };
        }

        throw new AppError(
            ErrorCode.NOT_FOUND,
            `Der blev ikke fundet en kurs for ${currency} inden for ${maxFallbackDays} dage før ${date}.`,
        );
    }

    /**
     * Fetches every banking day's rate for `currency` in `monthCode` (e.g. "2025M12")
     * from DNVALD. Returns an empty result when StatBank reports the month/currency has
     * no matching values (weekend-only, a future month, or an unknown currency) so the
     * caller can fall back instead of failing.
     */
    private static async fetchMonth(currency: string, monthCode: string): Promise<MonthRates> {
        const body = {
            table: TABLE,
            format: "JSONSTAT",
            lang: "da",
            variables: [
                { code: "VALUTA", values: [currency] },
                { code: "KURTYP", values: [RATE_TYPE] },
                { code: "Tid", values: [`${monthCode}*`] },
            ],
        };

        const response = await fetchUpstream(DST_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            // StatBank answers 400 when the wildcard (or the currency) matches no data:
            // EXTRACT-NOTFOUND (no such value) or EXTRACT-EMPTY (wildcard resolved to
            // nothing, e.g. a month outside the table's range). Both mean "nothing here"
            // — an expected miss the caller can fall back from, not an outage.
            const payload = (await response.json().catch(() => null)) as { errorTypeCode?: string } | null;
            if (
                response.status === 400 &&
                (payload?.errorTypeCode === "EXTRACT-NOTFOUND" || payload?.errorTypeCode === "EXTRACT-EMPTY")
            ) {
                return { rates: new Map(), desc: null };
            }
            throw upstreamStatusError("Danmarks Statistik", response);
        }

        return CurrencyRatesService.parseJsonStat(await parseUpstreamJson<unknown>(response));
    }

    /** Extracts the date -> rate map and the currency description from a JSON-stat response. */
    private static parseJsonStat(data: unknown): MonthRates {
        const dataset = (data as { dataset?: JsonStatDataset })?.dataset;
        const tidIndex = dataset?.dimension?.Tid?.category?.index;
        const values = dataset?.value;

        if (!dataset || !tidIndex || !Array.isArray(values)) {
            throw new AppError(ErrorCode.UPSTREAM_BAD_RESPONSE, defaultMessage.UPSTREAM_BAD_RESPONSE);
        }

        const rates = new Map<string, number>();

        // Only the Tid dimension has size > 1, so a fact's position in `value`
        // equals its Tid index (row-major, all other dimensions are size 1).
        for (const [tidCode, position] of Object.entries(tidIndex)) {
            const value = values[position];
            if (typeof value === "number") {
                rates.set(CurrencyRatesService.dstTidToIso(tidCode), value);
            }
        }

        const currencyLabels = dataset.dimension?.VALUTA?.category?.label;
        const rawDesc = currencyLabels ? Object.values(currencyLabels)[0] : null;

        return { rates, desc: rawDesc ? CurrencyRatesService.cleanDescription(rawDesc) : null };
    }

    /** "2025-12-06" -> "2025M12" (StatBank month code, used with a `*` day wildcard). */
    private static monthCode(date: string): string {
        const [year, month] = date.split("-");
        return `${year}M${month}`;
    }

    /** Month code for the month before `date`, e.g. "2025-01-15" -> "2024M12". */
    private static previousMonthCode(date: string): string {
        const [year, month] = date.split("-").map(Number);
        const previous = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
        return `${previous.y}M${String(previous.m).padStart(2, "0")}`;
    }

    /** "2025M12D06" -> "2025-12-06". */
    private static dstTidToIso(tidCode: string): string {
        const match = tidCode.match(/^(\d{4})M(\d{2})D(\d{2})$/);
        if (!match) return tidCode;
        return `${match[1]}-${match[2]}-${match[3]}`;
    }

    /** Strips StatBank's trailing availability note, e.g. "Euro  (Jan. 1999-)" -> "Euro". */
    private static cleanDescription(label: string): string {
        return label.replace(/\s*\([^)]*\)\s*$/, "").trim();
    }
}

interface JsonStatDataset {
    value: Array<number | null>;
    dimension?: {
        Tid?: { category?: { index?: Record<string, number> } };
        VALUTA?: { category?: { label?: Record<string, string> } };
    };
}
