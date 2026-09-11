import type { Context, Next } from "hono";

import { ErrorCode, defaultMessage, type ApiErrorBody } from "./api-error.js";

/**
 * Rate-limit budget. Deliberately generous: legitimate clients fetch large
 * amounts of data per request (the batch endpoint takes up to 500 CVR numbers
 * in ONE request), so even heavy use needs few requests. The limit exists to
 * stop runaway loops and abuse of a leaked credential, not to throttle normal
 * work.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 300;

/** How often expired counters are purged, so the map cannot grow unboundedly. */
const CLEANUP_INTERVAL_MS = 10 * WINDOW_MS;

interface WindowEntry {
    count: number;
    /** Epoch ms at which this window resets. */
    resetAt: number;
}

const windows = new Map<string, WindowEntry>();

let lastCleanup = Date.now();

function cleanup(now: number): void {
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;
    for (const [key, entry] of windows) {
        if (entry.resetAt <= now) windows.delete(key);
    }
}

/**
 * Identifies the client for rate-limiting purposes. The API key is shared by
 * all users of the VBA client, so the key alone would pool everyone into one
 * bucket; combine it with the caller's IP (Cloud Run sets x-forwarded-for,
 * client-first) so each machine gets its own budget.
 */
function clientKey(ctx: Context): string {
    const forwardedFor = ctx.req.header("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
    const auth = ctx.req.header("authorization") ?? "anonymous";
    return `${ip}|${auth}`;
}

/**
 * Fixed-window in-memory rate limiter (per Cloud Run instance). Requests over
 * the budget get a 429 with the shared ApiErrorBody shape and a Retry-After
 * header, so the VBA client can back off and retry.
 */
export function rateLimit() {
    return async (ctx: Context, next: Next) => {
        const now = Date.now();
        cleanup(now);

        const key = clientKey(ctx);
        const entry = windows.get(key);

        if (!entry || entry.resetAt <= now) {
            windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
            return next();
        }

        entry.count += 1;

        if (entry.count > MAX_REQUESTS_PER_WINDOW) {
            const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

            const body: ApiErrorBody = {
                status: "error",
                errorCode: ErrorCode.RATE_LIMITED,
                message: defaultMessage.RATE_LIMITED,
            };

            ctx.header("Retry-After", String(retryAfterSeconds));
            return ctx.json(body, 429);
        }

        return next();
    };
}
