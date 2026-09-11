import { AppError, ErrorCode, defaultMessage } from "./api-error.js";

/** Default time budget for a single outbound request to an upstream. */
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

/**
 * `fetch` with a hard timeout. Without this a slow/hung upstream (virk.dk, skm.dk,
 * Statistics Denmark, or a document download) would stall the request until the
 * platform kills it. On timeout the underlying `AbortSignal.timeout` rejects with a
 * `DOMException` ("TimeoutError"), which `toAppError` maps to UPSTREAM_UNAVAILABLE.
 */
export function fetchWithTimeout(
    input: string | URL,
    init: RequestInit = {},
    timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
    return fetch(input, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });
}

/**
 * True when `url` points at the given host or one of its subdomains (http/https
 * only). Used to allowlist URLs that arrive from upstreams we can only reach over
 * plain HTTP (virk.dk offers no TLS): a tampered response must never be able to
 * steer this server into fetching an arbitrary URL — e.g. the Cloud Run metadata
 * service — so such URLs are validated against the expected host before AND after
 * redirects.
 */
export function isUrlOnHost(url: string, host: string): boolean {
    try {
        const parsed = new URL(url);
        return (
            (parsed.protocol === "http:" || parsed.protocol === "https:") &&
            (parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
        );
    } catch {
        return false;
    }
}

/** Basic-auth Authorization header value for the given credentials. */
export function basicAuthHeader(username: string, password: string): string {
    return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

/**
 * Fetches from an upstream, mapping a network failure or timeout to
 * UPSTREAM_UNAVAILABLE. Status handling is left to the caller (some upstreams,
 * like StatBank, use error statuses for expected "no data" answers).
 */
export async function fetchUpstream(
    input: string | URL,
    init: RequestInit = {},
    timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
    try {
        return await fetchWithTimeout(input, init, timeoutMs);
    } catch {
        throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, defaultMessage.UPSTREAM_UNAVAILABLE);
    }
}

/** The UPSTREAM_ERROR for a non-2xx upstream response, named after the upstream. */
export function upstreamStatusError(upstreamName: string, response: Response): AppError {
    return new AppError(
        ErrorCode.UPSTREAM_ERROR,
        `${upstreamName} svarede med ${response.status} ${response.statusText}.`,
    );
}

/** Parses an upstream response body as JSON, mapping failure to UPSTREAM_BAD_RESPONSE. */
export async function parseUpstreamJson<T>(response: Response): Promise<T> {
    try {
        return (await response.json()) as T;
    } catch {
        throw new AppError(ErrorCode.UPSTREAM_BAD_RESPONSE, defaultMessage.UPSTREAM_BAD_RESPONSE);
    }
}

/**
 * Reads an XML response body honoring the document's actual encoding.
 *
 * `Response.text()` always decodes as UTF-8 unless the Content-Type header carries a
 * charset, but XBRL documents on virk.dk are often ISO-8859-1 (or UTF-16) and declare
 * it only in the XML prolog — decoding those as UTF-8 mangles Æ/Ø/Å. Trust order:
 * BOM, then the XML declaration's encoding attribute, then the Content-Type charset
 * (last of the explicit signals: when names arrive mangled the header is exactly the
 * signal that has proven absent or wrong), then UTF-8.
 */
export async function readXmlResponseText(response: Response): Promise<string> {
    return decodeXml(Buffer.from(await response.arrayBuffer()), response.headers.get("content-type"));
}

export function decodeXml(bytes: Uint8Array, contentType?: string | null): string {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
        return new TextDecoder("utf-16le").decode(bytes);
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        return new TextDecoder("utf-16be").decode(bytes);
    }
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        return new TextDecoder("utf-8").decode(bytes);
    }

    // The XML declaration is ASCII-only, so peeking at the first bytes via latin1 is safe.
    const prolog = Buffer.from(bytes.subarray(0, 256)).toString("latin1");
    const declaredEncoding = /<\?xml[^>]*\bencoding=["']([\w.-]+)["']/i.exec(prolog)?.[1];
    const headerCharset = contentType ? /charset=["']?([\w.-]+)/i.exec(contentType)?.[1] : undefined;

    const encoding = (declaredEncoding ?? headerCharset ?? "utf-8").toLowerCase();

    if (encoding !== "utf-8" && encoding !== "utf8") {
        try {
            return new TextDecoder(encoding).decode(bytes);
        } catch {
            // Unknown encoding label — fall through to the UTF-8 path below.
        }
    }

    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        // Not valid UTF-8 after all (e.g. latin-1 with no declaration): windows-1252 is a
        // superset of ISO-8859-1 and decodes every byte, so this can't throw.
        return new TextDecoder("windows-1252").decode(bytes);
    }
}

/**
 * The full upstream error ladder shared by the services: network failure/timeout →
 * UPSTREAM_UNAVAILABLE, non-2xx → UPSTREAM_ERROR (named after the upstream), and an
 * unparseable JSON body → UPSTREAM_BAD_RESPONSE.
 */
export async function fetchUpstreamJson<T>(
    upstreamName: string,
    input: string | URL,
    init: RequestInit = {},
    timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<T> {
    const response = await fetchUpstream(input, init, timeoutMs);

    if (!response.ok) {
        throw upstreamStatusError(upstreamName, response);
    }

    return parseUpstreamJson<T>(response);
}
