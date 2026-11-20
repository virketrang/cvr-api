import { readZip } from "../../utils/zip.js";
import { fetchWithTimeout, isUrlOnHost } from "../../utils/http.js";

/**
 * A company's own XBRL elements, read from the extension package filed with an
 * IFRS-DK or ESEF annual report: what the company calls the element, which
 * side of the balance sheet it belongs to and whether the company presents it
 * in the balance sheet at all. Used only to explain a balance that does not
 * add up; extension elements are never mapped onto the report's fields.
 */
export interface ExtensionConcept {
    label: string | null;
    balance: "debit" | "credit" | null;
    /** Presented in a role that is the balance sheet (statement of financial position). */
    inBalanceSheet: boolean;
}

/** Keyed by `${namespace}#${name}`, the way an instance fact identifies its element. */
export type ExtensionConcepts = Map<string, ExtensionConcept>;

const BALANCE_SHEET_ROLE = /financialposition|balance|\/210000|\/220000/i;

/** Reads the schema, labels and presentation of an unpacked extension package. */
export function parseExtensionPackage(files: Map<string, Buffer>): ExtensionConcepts {
    const byId = new Map<string, { key: string; balance: "debit" | "credit" | null }>();
    for (const [path, content] of files) {
        if (!path.endsWith(".xsd")) continue;
        const text = content.toString("utf8");
        const namespace = /targetNamespace="([^"]+)"/.exec(text)?.[1];
        if (!namespace) continue;
        for (const match of text.matchAll(/<(?:\w+:)?element\s([^>]*)>/g)) {
            const attributes = match[1];
            const name = /\bname="([^"]+)"/.exec(attributes)?.[1];
            const id = /\bid="([^"]+)"/.exec(attributes)?.[1];
            if (!name || !id || /abstract="true"/.test(attributes)) continue;
            const balance = (/balance="(debit|credit)"/.exec(attributes)?.[1] ?? null) as "debit" | "credit" | null;
            byId.set(id, { key: `${namespace}#${name}`, balance });
        }
    }

    const labelOf = new Map<string, { text: string; danish: boolean }>();
    const labelFiles = [...files.keys()].filter((path) => /lab[^/]*\.xml$/i.test(path));
    // Danish first, then any other language.
    labelFiles.sort((a, b) => Number(/-da\b|_da\b|da\.xml$/i.test(b)) - Number(/-da\b|_da\b|da\.xml$/i.test(a)));
    for (const path of labelFiles) {
        const text = files.get(path)!.toString("utf8");
        const locs = new Map<string, string>();
        for (const match of text.matchAll(/<(?:\w+:)?loc\b[^>]*>/g)) {
            const href = /xlink:href="[^"#]*#([^"]+)"/.exec(match[0])?.[1];
            const label = /xlink:label="([^"]+)"/.exec(match[0])?.[1];
            if (href && label) locs.set(label, href);
        }
        const resources = new Map<string, { text: string; danish: boolean }>();
        for (const match of text.matchAll(/<(?:\w+:)?label\b([^>]*)>([^<]*)<\/(?:\w+:)?label>/g)) {
            const role = /xlink:role="([^"]+)"/.exec(match[1])?.[1] ?? "";
            if (role && !role.endsWith("/role/label")) continue;
            const label = /xlink:label="([^"]+)"/.exec(match[1])?.[1];
            const language = /xml:lang="([^"]+)"/.exec(match[1])?.[1] ?? "";
            const existing = label ? resources.get(label) : undefined;
            const danish = language.toLowerCase().startsWith("da");
            if (label && (!existing || (danish && !existing.danish))) resources.set(label, { text: match[2].trim(), danish });
        }
        for (const match of text.matchAll(/<(?:\w+:)?labelArc\b[^>]*>/g)) {
            const from = /xlink:from="([^"]+)"/.exec(match[0])?.[1];
            const to = /xlink:to="([^"]+)"/.exec(match[0])?.[1];
            const id = from ? locs.get(from) : undefined;
            const resource = to ? resources.get(to) : undefined;
            if (!id || !resource || !resource.text) continue;
            const existing = labelOf.get(id);
            if (!existing || (resource.danish && !existing.danish)) labelOf.set(id, resource);
        }
    }

    const inBalanceSheet = new Set<string>();
    for (const [path, content] of files) {
        if (!/pre[^/]*\.xml$/i.test(path)) continue;
        const text = content.toString("utf8");
        for (const match of text.matchAll(/<(?:\w+:)?presentationLink\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?presentationLink>/g)) {
            const role = /xlink:role="([^"]+)"/.exec(match[1])?.[1] ?? "";
            if (!BALANCE_SHEET_ROLE.test(role)) continue;
            for (const href of match[2].matchAll(/xlink:href="[^"#]*#([^"]+)"/g)) inBalanceSheet.add(href[1]);
        }
    }

    const concepts: ExtensionConcepts = new Map();
    for (const [id, { key, balance }] of byId) {
        concepts.set(key, { label: labelOf.get(id)?.text ?? null, balance, inBalanceSheet: inBalanceSheet.has(id) });
    }
    return concepts;
}

/**
 * Extension packages larger than this are not fetched: ESEF packages carry the
 * whole inline XBRL report (tens of MB) and are served gzip-encoded, so the
 * few small files needed cannot be read with a range request. IFRS-DK
 * packages are a few KB.
 */
const MAX_PACKAGE_BYTES = 5_000_000;
const DOCUMENT_HOST = "virk.dk";
const cache = new Map<string, Promise<ExtensionConcepts | null>>();
const CACHE_SIZE = 200;

/** Downloads and reads an extension package; null when it cannot be had. Cached per URL. */
export function fetchExtensionPackage(url: string): Promise<ExtensionConcepts | null> {
    const cached = cache.get(url);
    if (cached) return cached;

    const pending = (async () => {
        if (!isUrlOnHost(url, DOCUMENT_HOST)) return null;
        try {
            const response = await fetchWithTimeout(url);
            if (!response.ok || !isUrlOnHost(response.url, DOCUMENT_HOST)) return null;
            const declared = Number(response.headers.get("content-length") ?? "0");
            if (declared > MAX_PACKAGE_BYTES) {
                await response.body?.cancel();
                return null;
            }
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.byteLength > MAX_PACKAGE_BYTES) return null;
            return parseExtensionPackage(readZip(bytes));
        } catch {
            return null;
        }
    })();

    cache.set(url, pending);
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
    return pending;
}
