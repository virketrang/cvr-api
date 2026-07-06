import { z } from "@hono/zod-openapi";

/**
 * Machine-readable error codes shared between the API and the VBA client.
 * The VBA side switches on these to show the right Danish message and decide
 * whether the failure is recoverable. KEEP IN SYNC with the VBA ApiErrorCode list.
 */
export const ErrorCode = {
    // Transport / upstream (the whole request could not be served)
    UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE", // could not reach virk.dk / skm.dk
    UPSTREAM_ERROR: "UPSTREAM_ERROR", // upstream returned a non-2xx status
    UPSTREAM_BAD_RESPONSE: "UPSTREAM_BAD_RESPONSE", // upstream body was not parseable JSON

    // Input / not-found
    NOT_FOUND: "NOT_FOUND", // no company / group / rate data
    INVALID_CVR: "INVALID_CVR", // CVR failed validation

    // Per-report (annual reports) — surfaced as `skipped` entries
    UNKNOWN_TAXONOMY: "UNKNOWN_TAXONOMY",
    MALFORMED_XML: "MALFORMED_XML",
    MISSING_NAMESPACE: "MISSING_NAMESPACE",
    MALFORMED_UNIT: "MALFORMED_UNIT",
    MISSING_PERIOD: "MISSING_PERIOD",
    NO_DATA: "NO_DATA",

    // Catch-all
    INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** The JSON body every error response carries. */
export interface ApiErrorBody {
    status: "error";
    errorCode: ErrorCode;
    message: string;
}

/**
 * A typed error that carries an ErrorCode and a human (Danish) message.
 * Throw this anywhere in a service or controller; the app-level onError handler
 * maps it to the right HTTP status and structured body.
 */
export class AppError extends Error {
    public readonly errorCode: ErrorCode;
    public readonly httpStatus: number;

    constructor(errorCode: ErrorCode, message: string, httpStatus?: number) {
        super(message);
        this.name = "AppError";
        this.errorCode = errorCode;
        this.httpStatus = httpStatus ?? AppError.defaultHttpStatus(errorCode);
    }

    private static defaultHttpStatus(code: ErrorCode): number {
        switch (code) {
            case ErrorCode.UPSTREAM_UNAVAILABLE:
            case ErrorCode.UPSTREAM_ERROR:
            case ErrorCode.UPSTREAM_BAD_RESPONSE:
                return 503; // service (upstream) unavailable
            case ErrorCode.NOT_FOUND:
                return 404;
            case ErrorCode.INVALID_CVR:
                return 422;
            default:
                return 500;
        }
    }
}

/** Default Danish messages by code (used when no specific message is supplied). */
export const defaultMessage: Record<ErrorCode, string> = {
    UPSTREAM_UNAVAILABLE: "Kunne ikke få forbindelse til det offentlige register. Prøv igen senere.",
    UPSTREAM_ERROR: "Det offentlige register svarede med en fejl. Prøv igen senere.",
    UPSTREAM_BAD_RESPONSE: "Det offentlige register returnerede et uforståeligt svar.",
    NOT_FOUND: "Der blev ikke fundet data for det angivne CVR-nummer.",
    INVALID_CVR: "CVR-nummeret er ugyldigt.",
    UNKNOWN_TAXONOMY: "Årsrapporten anvender en ukendt taksonomi og kunne ikke læses.",
    MALFORMED_XML: "Årsrapportens XML kunne ikke læses (ugyldigt format).",
    MISSING_NAMESPACE: "Årsrapportens XML mangler det forventede XBRL-namespace.",
    MALFORMED_UNIT: "Årsrapporten indeholder en ugyldig enhedsangivelse.",
    MISSING_PERIOD: "Årsrapporten mangler en regnskabsperiode og kunne ikke placeres.",
    NO_DATA: "Årsrapporten indeholdt ingen anvendelige data.",
    INTERNAL: "Der opstod en intern fejl. Kontakt Sigfred, hvis problemet fortsætter.",
};

/**
 * Zod schema for {@link ApiErrorBody} — the shape of every error response.
 * Shared across all routes so the OpenAPI docs and the handler return types
 * stay in sync.
 */
export const apiErrorSchema = z
    .object({
        status: z.string().openapi({ example: "error" }),
        errorCode: z.enum(Object.values(ErrorCode) as [ErrorCode, ...ErrorCode[]]).openapi({
            description: "Maskinlæsbar fejlkode, som klienten kan reagere på.",
            example: ErrorCode.INTERNAL,
        }),
        message: z.string().openapi({
            description: "Menneskelæsbar (dansk) fejlbesked.",
            example: defaultMessage.INTERNAL,
        }),
    })
    .openapi("ApiError");

/**
 * The set of error responses every route can return, keyed by HTTP status.
 * Spread into a route's `responses` (`...errorResponses`) so the handler — which
 * lets failures propagate to the app-level onError handler — documents them all.
 * The status codes mirror `AppError.defaultHttpStatus`.
 */
export const errorResponses = {
    404: {
        description: "Ingen data fundet for det angivne input.",
        content: { "application/json": { schema: apiErrorSchema } },
    },
    422: {
        description: "Ugyldigt input (f.eks. et forkert CVR-nummer).",
        content: { "application/json": { schema: apiErrorSchema } },
    },
    500: {
        description: "Intern serverfejl.",
        content: { "application/json": { schema: apiErrorSchema } },
    },
    503: {
        description: "Det offentlige register (upstream) er ikke tilgængeligt.",
        content: { "application/json": { schema: apiErrorSchema } },
    },
};

/**
 * Normalizes any thrown value into an AppError. A raw fetch rejection becomes
 * UPSTREAM_UNAVAILABLE; an explicit AppError passes through; anything else is INTERNAL.
 */
export function toAppError(error: unknown): AppError {
    if (error instanceof AppError) return error;

    // An aborted/timed-out fetch (AbortSignal.timeout) rejects with a DOMException.
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
        return new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, defaultMessage.UPSTREAM_UNAVAILABLE);
    }

    // node-fetch / undici network failures surface as TypeError("fetch failed")
    // or carry a `cause` with a system errno. Treat those as upstream-unavailable.
    if (
        error instanceof TypeError &&
        (error.message.toLowerCase().includes("fetch") || "cause" in error)
    ) {
        return new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, defaultMessage.UPSTREAM_UNAVAILABLE);
    }

    const message = error instanceof Error ? error.message : String(error);
    return new AppError(ErrorCode.INTERNAL, message || defaultMessage.INTERNAL);
}
