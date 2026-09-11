import type { RatePublication } from "./rate-of-return-on-capital.types.js";
import type { Discovery } from "./rate-of-return-on-capital.skm.js";

export interface RegistrySnapshot {
    /** Seed rows plus everything discovered, sorted by publishedAt ascending. */
    publications: RatePublication[];
    /** Years with a listing but no readable announcement (see {@link Discovery.unresolvedYears}). */
    unresolvedYears: number[];
    /** Why the latest discovery attempt failed, or null when it succeeded (or a fresh result was cached). */
    discoveryError: string | null;
}

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * The publication register: a verified seed extended by automatic discovery on
 * info.skat.dk, cached in memory for `ttlMs`. A failed refresh keeps serving the
 * last good discovery (with `discoveryError` set so callers can warn); with no
 * prior discovery the seed alone is served.
 */
export class PublicationRegistry {
    private cache: { discovery: Discovery; fetchedAt: number } | null = null;
    private inflight: Promise<Discovery> | null = null;

    constructor(
        private readonly seed: readonly RatePublication[],
        private readonly discover: (afterYear: number) => Promise<Discovery>,
        private readonly ttlMs: number = DEFAULT_TTL_MS,
        private readonly now: () => number = () => Date.now(),
    ) {}

    public async get(): Promise<RegistrySnapshot> {
        const seedNewestYear = this.seed[this.seed.length - 1]?.year ?? 0;
        let discoveryError: string | null = null;

        if (!this.cache || this.now() - this.cache.fetchedAt > this.ttlMs) {
            try {
                // Concurrent requests share one discovery instead of each hitting info.skat.dk.
                this.inflight ??= this.discover(seedNewestYear).finally(() => {
                    this.inflight = null;
                });
                const discovery = await this.inflight;
                this.cache = { discovery, fetchedAt: this.now() };
            } catch (error) {
                discoveryError = error instanceof Error ? error.message : String(error);
            }
        }

        const discovered = this.cache?.discovery.publications ?? [];
        const publications = [...this.seed, ...discovered.filter((p) => p.year > seedNewestYear)].sort((a, b) =>
            a.publishedAt.localeCompare(b.publishedAt),
        );

        return {
            publications,
            unresolvedYears: this.cache?.discovery.unresolvedYears ?? [],
            discoveryError,
        };
    }
}
