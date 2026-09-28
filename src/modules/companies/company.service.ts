import type { CompanyLookupResponse, CompanyLookupSource, CompanySummary } from "./company.types.js";
import environment from "../../environment.js";
import { basicAuthHeader, fetchUpstreamJson } from "../../utils/http.js";

const CVR_API_URL = "http://distribution.virk.dk/cvr-permanent/virksomhed/_search";

/** Registry status texts that mean the company no longer exists (mirrors the group service). */
const DISSOLVED_STATUS = /OPLØST|SLETTET|TVANGSOPLØST|OPHØRT/i;

/**
 * The lookup backs a "did the user type a real CVR number?" check that fires on
 * every blur of an input, so it is built for latency, not completeness:
 *
 * - `_source` filtering asks the registry for four fields (~600 B) instead of the
 *   whole company document (~130 KB for a large company).
 * - A short upstream timeout: the client would rather show nothing than wait.
 * - An in-memory cache per instance, so re-typing the same number, or several
 *   users looking at the same group, never hits the registry twice in a row.
 *   Names change rarely; a miss is cached briefly in case the user just mistyped.
 */
const UPSTREAM_TIMEOUT_MS = 5_000;
const HIT_TTL_MS = 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 1000;
const CACHE_MAX_ENTRIES = 5_000;

interface CacheEntry {
    value: CompanySummary | null;
    expiresAt: number;
}

export default abstract class CompanyService {
    private static readonly cache = new Map<number, CacheEntry>();

    /** Maps a registry hit to the summary; null when the hit carries no usable name. */
    static toSummary(source: CompanyLookupSource): CompanySummary | null {
        const company = source.Vrvirksomhed;
        const name = company.virksomhedMetadata?.nyesteNavn?.navn?.trim();
        if (!name) return null;

        const status = company.virksomhedMetadata?.sammensatStatus?.trim() || null;

        return {
            cvr: company.cvrNummer,
            name,
            status,
            active: status === null || !DISSOLVED_STATUS.test(status),
        };
    }

    /** The company's summary, or null when the CVR number is not in the registry. */
    static async lookup(cvrNumber: number, now: number = Date.now()): Promise<CompanySummary | null> {
        const cached = CompanyService.cache.get(cvrNumber);
        if (cached && cached.expiresAt > now) return cached.value;

        const response = await CompanyService.queryRegistry(cvrNumber);
        const hit = response.hits.hits[0];
        const value = hit ? CompanyService.toSummary(hit._source) : null;

        CompanyService.remember(cvrNumber, value, now);
        return value;
    }

    private static remember(cvrNumber: number, value: CompanySummary | null, now: number): void {
        if (CompanyService.cache.size >= CACHE_MAX_ENTRIES) {
            // Drop the oldest insertion; a Map iterates in insertion order.
            const oldest = CompanyService.cache.keys().next().value;
            if (oldest !== undefined) CompanyService.cache.delete(oldest);
        }
        CompanyService.cache.set(cvrNumber, { value, expiresAt: now + (value ? HIT_TTL_MS : MISS_TTL_MS) });
    }

    private static queryRegistry(cvrNumber: number): Promise<CompanyLookupResponse> {
        return fetchUpstreamJson<CompanyLookupResponse>(
            "Det offentlige register",
            CVR_API_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: basicAuthHeader(environment.CVR_API_USERNAME, environment.CVR_API_PASSWORD),
                },
                body: JSON.stringify({
                    size: 1,
                    _source: [
                        "Vrvirksomhed.cvrNummer",
                        "Vrvirksomhed.virksomhedMetadata.nyesteNavn.navn",
                        "Vrvirksomhed.virksomhedMetadata.sammensatStatus",
                    ],
                    query: { term: { "Vrvirksomhed.cvrNummer": cvrNumber } },
                }),
            },
            UPSTREAM_TIMEOUT_MS,
        );
    }

    /** Test hook. */
    static clearCache(): void {
        CompanyService.cache.clear();
    }
}
