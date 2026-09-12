import * as cheerio from "cheerio";

import type { GroupEntityFromNotes, RelatedEntity } from "./annual-report.types.js";
import type XBRLDocument from "./annual-report.utils.js";

/**
 * Extraction of corporate-group information from annual-report NOTES.
 *
 * The CVR register only knows Danish companies with registered ownership, so
 * foreign group members are invisible there — but the notes to the annual report
 * routinely list the whole group. Almost no filers use the taxonomy's structured
 * related-entity facts; the data lives in note text blocks in two shapes:
 *
 *  - XHTML tables ("Navn / Hjemsted / Ejerandel …") — parsed via cheerio with
 *    header-keyword column mapping. Tables can be malformed or HTML-escaped.
 *  - Glued column lists, the common shape in Danish class B/C filings
 *    ("NavnHjemstedEjerandel…Thouber Tax-Free Cars A/SOdense100%4.142.331…"):
 *    the column order is read from the header and each row is parsed from the
 *    right — legal form, glued amount columns, the registered office (a city,
 *    optionally ", Country"), then the name. Section labels ("Dattervirksomheder:",
 *    "Associerede virksomheder:") set `relation`. See parseColumnList.
 *  - Plain concatenated text with no markup at all ("…Ownership %Orifarm Oy
 *    FinlandOy100.00…") — parsed right-anchored: split on percent tokens, peel a
 *    known corporate-form suffix, then a known country name; the rest is the name.
 *  - Prose inside investment notes ("har erhvervet kapitalandele i E Electric ApS",
 *    "datterselskaberne Nicon Industries A/S, …") — names only, no percentage.
 *
 * Filers mis-tag concepts (a subsidiaries list has been seen under
 * "InformationOnShorttermInvestmentsInGroupEnterprises"), so candidates are
 * selected by CONTENT keywords, not by concept name.
 *
 * Carefulness: ownership percentages are only emitted when confidently parsed —
 * from a table with an identified ownership column, or from plain text where EVERY
 * row of the note parses cleanly. Note that the percentages stated in group notes
 * are typically the group's TOTAL share (i.e. usually indirect); direct vs
 * indirect cannot be distinguished from the filing.
 */

const NOTE_KEYWORDS = /ejerandel|ownership\s*[%​]|hjemsted|registered\s+in|kapitalandele/i;

/** Legal-form suffixes recognized at the end of a "name+country+form" text row, longest first. */
const LEGAL_FORMS = [
    "GmbH & Co. KG",
    "GmbH & Co KG",
    "Sp. z o.o. Sp.k.",
    "Sp. z o.o.",
    "Sp. z o. o.",
    "Sp. z.o.o.",
    "Sp.z o.o.",
    "Sp.z.o.o.",
    "Sp.k.",
    "s.r.o.",
    "S.R.L.",
    "S.r.l.",
    "s.r.l.",
    "SRL",
    "S.à r.l.",
    "Sàrl",
    "d.o.o.",
    "d.d.",
    "a.s.",
    "B.V.B.A.",
    "BVBA",
    "GesmbH",
    "GmbH",
    "mbH",
    "SARL",
    "S.A.S.",
    "ApS",
    "A/S",
    "P/S",
    "K/S",
    "I/S",
    "B.V.",
    "Pty Ltd",
    "Pte. Ltd.",
    "Co., Ltd.",
    "Ltd.",
    "Ltd",
    "Inc.",
    "Inc",
    "S.L.U.",
    "S.L.",
    "S.A.",
    "SAS",
    "UAB",
    "OÜ",
    "Oyj",
    "Oy",
    "AB",
    "ASA",
    "AS",
    "AG",
    "BV",
    "N.V.",
    "NV",
    "SIA",
    "Kft.",
    "Kft",
    "Zrt",
    "LLC",
    "LLP",
].sort((a, b) => b.length - a.length);

/** Country names (Danish and English) recognized in group notes. */
const COUNTRIES = [
    "Danmark",
    "Denmark",
    "Norge",
    "Norway",
    "Sverige",
    "Sweden",
    "Finland",
    "Island",
    "Iceland",
    "Tyskland",
    "Germany",
    "Holland",
    "Nederlandene",
    "Netherlands",
    "The Netherlands",
    "Belgien",
    "Belgium",
    "Luxembourg",
    "Luxemburg",
    "Frankrig",
    "France",
    "Spanien",
    "Spain",
    "Portugal",
    "Italien",
    "Italy",
    "Schweiz",
    "Switzerland",
    "Østrig",
    "Austria",
    "Storbritannien",
    "United Kingdom",
    "England",
    "UK",
    "Irland",
    "Ireland",
    "Polen",
    "Poland",
    "Tjekkiet",
    "Czech Republic",
    "Czechia",
    "Slovakiet",
    "Slovakia",
    "Ungarn",
    "Hungary",
    "Rumænien",
    "Romania",
    "Bulgarien",
    "Bulgaria",
    "Kroatien",
    "Croatia",
    "Slovenien",
    "Slovenia",
    "Estland",
    "Estonia",
    "Letland",
    "Latvia",
    "Litauen",
    "Lithuania",
    "Grækenland",
    "Greece",
    "Tyrkiet",
    "Turkey",
    "USA",
    "United States",
    "Canada",
    "Mexico",
    "Brasilien",
    "Brazil",
    "Kina",
    "China",
    "Hong Kong",
    "Japan",
    "Sydkorea",
    "South Korea",
    "Indien",
    "India",
    "Singapore",
    "Malaysia",
    "Thailand",
    "Vietnam",
    "Australien",
    "Australia",
    "New Zealand",
    "Sydafrika",
    "South Africa",
    "Forenede Arabiske Emirater",
    "United Arab Emirates",
    "Dubai",
].sort((a, b) => b.length - a.length);

/** Lowercased name for dedupe: case-, punctuation- and whitespace-insensitive. */
export function normalizeEntityName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9æøå]/g, "");
}

/**
 * Converts the taxonomy's structured related-entity facts into the note-entity
 * shape, so the corporate-group enrichment can expose both through one field.
 *
 * The ShareHeld fact is an XBRL percent item, which filers report either as a
 * fraction (1 = 100 %, 0.53 = 53 %) or directly as a percent (53). Values in
 * (0, 1] are treated as fractions and scaled ×100; values in (1, 100] as
 * percents; anything else is dropped as unreliable.
 */
export function structuredRelatedEntitiesToGroupEntities(relatedEntities: RelatedEntity[]): GroupEntityFromNotes[] {
    return relatedEntities
        .filter((entity): entity is RelatedEntity & { name: string } => Boolean(entity.name))
        .map((entity) => {
            let percentage: number | null = entity.ownershipPercentage;
            if (percentage !== null && Number.isFinite(percentage) && percentage > 0) {
                percentage = percentage <= 1 ? percentage * 100 : percentage <= 100 ? percentage : null;
            } else {
                percentage = null;
            }

            const place = entity.registeredOffice?.trim() || null;
            const isCountry = place !== null && COUNTRIES.some((c) => c.toLowerCase() === place.toLowerCase());

            return {
                name: entity.name,
                cvrNumber: entity.cvrNumber,
                country: isCountry ? place : null,
                registeredOffice: !isCountry ? place : null,
                legalForm: entity.legalForm,
                ownershipPercentage: percentage,
                ownershipPercentageAsReported: entity.ownershipPercentage,
                votingRightsPercentage: null,
                source: "structured" as const,
                sourceConcept: "RelatedEntityName",
                scope: null,
                parent: null,
                relation: null,
            };
        });
}

/**
 * The complete group-entity extraction for one filing: the taxonomy's structured
 * related-entity facts merged with parsed note tables/text (deduped), each entity
 * annotated with its DIRECT parent when that is certain.
 *
 * Parent certainty: a solo-scope note — or any note in a filing that carries no
 * consolidated contexts at all — describes the reporting company's own direct
 * holdings, so the reporting company is the parent and the stated percentage is
 * its direct share. Consolidated-scope notes list the whole group (incl. deep
 * descendants), so no direct parent can be inferred there.
 */
export function extractGroupEntities(doc: XBRLDocument, reportingPeriodEndDate: string): GroupEntityFromNotes[] {
    const relatedEntities = doc.extractRelatedEntities(reportingPeriodEndDate);

    const structured = structuredRelatedEntitiesToGroupEntities(relatedEntities);
    const fromNotes = extractGroupEntitiesFromNotes(doc, reportingPeriodEndDate, relatedEntities);

    const contexts = doc.getContext();
    const docHasConsolidatedContexts = Object.values(contexts).some((context) =>
        context.dimensions.some(
            (d) => d.dimension === "ConsolidatedSoloDimension" && d.member === "ConsolidatedMember",
        ),
    );

    const reportingName =
        doc
            .extractTaxonomyField({
                name: "NameOfReportingEntity",
                namespace: "http://xbrl.dcca.dk/gsd",
                label: "Virksomhedens navn",
            })?.[0]
            ?.value?.trim() ?? null;

    // Every context identifies the reporting entity by its CVR number.
    const reportingCvr = Object.values(contexts).find((context) => context.identifier)?.identifier ?? null;

    const parent = reportingName !== null || reportingCvr !== null ? { name: reportingName, cvrNumber: reportingCvr } : null;

    return [...structured, ...fromNotes].map((entity) => {
        const isDirectHolding = entity.scope === "solo" || !docHasConsolidatedContexts;
        return isDirectHolding && parent ? { ...entity, parent } : entity;
    });
}

/**
 * Parses "100,00", "53%", "100.00 %", "1.234,56" into a number, or null.
 * Only values in (0, 100] are accepted — anything else is not an ownership share.
 */
function parsePercentage(raw: string | null | undefined): number | null {
    if (!raw) return null;
    let s = raw.replace(/[%\s ​]/g, "");
    if (!s) return null;

    if (s.includes(".") && s.includes(",")) {
        // European format: "." thousands, "," decimals.
        s = s.replace(/\./g, "").replace(",", ".");
    } else {
        s = s.replace(",", ".");
    }

    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    const value = parseFloat(s);
    return value > 0 && value <= 100 ? value : null;
}

/** Strips tags/entities and collapses whitespace (incl. zero-width chars) to single spaces. */
function cleanText(s: string): string {
    return s
        .replace(/[​­]/g, "")
        .replace(/ /g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

type ColumnMap = {
    name: number;
    place: number | null;
    legalForm: number | null;
    ownership: number | null;
    voting: number | null;
};

const HEADER_PATTERNS = {
    name: /^(navn|selskab(?:snavn)?|name|company|virksomhed)\b/i,
    place: /^(?:hjemsted|registered(?:\s+(?:office|in))?|domicile|country|land|by)\b/i,
    legalForm: /retsform|selskabsform|corporate\s*form|legal\s*form/i,
    ownership: /ejerandel|ownership|kapitalandel|andel/i,
    voting: /stemme|voting/i,
};

/** Identifies which column holds what, from a candidate header row's cell texts. */
function mapColumns(cells: string[]): ColumnMap | null {
    const map: ColumnMap = { name: -1, place: null, legalForm: null, ownership: null, voting: null };

    cells.forEach((cell, index) => {
        const text = cleanText(cell);
        if (!text) return;
        if (map.name === -1 && HEADER_PATTERNS.name.test(text)) map.name = index;
        else if (map.voting === null && HEADER_PATTERNS.voting.test(text)) map.voting = index;
        else if (map.ownership === null && HEADER_PATTERNS.ownership.test(text)) map.ownership = index;
        else if (map.place === null && HEADER_PATTERNS.place.test(text)) map.place = index;
        else if (map.legalForm === null && HEADER_PATTERNS.legalForm.test(text)) map.legalForm = index;
    });

    // A usable header names the entity column plus at least one data column.
    if (map.name === -1) return null;
    if (map.place === null && map.legalForm === null && map.ownership === null) return null;
    return map;
}

/** True when a text looks like a header cell rather than a company name. */
function looksLikeHeader(text: string): boolean {
    return (
        HEADER_PATTERNS.name.test(text) ||
        HEADER_PATTERNS.ownership.test(text) ||
        HEADER_PATTERNS.place.test(text) ||
        HEADER_PATTERNS.legalForm.test(text)
    );
}

/** Extracts group entities from XHTML tables in a note fragment (tier 2). */
export function parseTables(html: string, sourceConcept: string, scope: GroupEntityFromNotes["scope"]): GroupEntityFromNotes[] {
    const entities: GroupEntityFromNotes[] = [];
    const $ = cheerio.load(html);

    $("table").each((_, table) => {
        const rows = $(table).find("tr").toArray();
        let columns: ColumnMap | null = null;

        for (const row of rows) {
            const cells = $(row)
                .find("td, th")
                .toArray()
                .map((cell) => cleanText($(cell).text()));

            if (cells.every((cell) => !cell)) continue;

            const asHeader = mapColumns(cells);
            if (asHeader) {
                // (Re-)encountered a header row — e.g. repeated after a page break.
                columns = asHeader;
                continue;
            }

            if (!columns) continue;

            let name = cells[columns.name] ?? "";
            if (!name || looksLikeHeader(name)) continue;
            // A name is a proper noun, not a number.
            if (/^[\d.,%\s]+$/.test(name)) continue;

            // "Navn, retsform og hjemsted" cells bundle the office or CVR into the name.
            let cvrNumber: string | null = null;
            const cvrInName = /,?\s*CVR(?:-?nr\.?)?\s*:?\s*(\d{2}\s?\d{2}\s?\d{2}\s?\d{2})\s*$/i.exec(name);
            if (cvrInName) {
                cvrNumber = cvrInName[1].replace(/\s/g, "");
                name = name.slice(0, cvrInName.index).trim();
            }
            let placeInName: string | null = null;
            const officeInName = /,\s*([A-ZÆØÅ][a-zæøå.\-]+(?:\s[A-ZÆØÅ][a-zæøå.\-]+)?)$/.exec(name);
            if (officeInName && columns.place === null) {
                placeInName = officeInName[1];
                name = name.slice(0, officeInName.index).trim();
            }

            const placeRaw = columns.place !== null ? cells[columns.place] || null : placeInName;
            const isCountry =
                placeRaw !== null && COUNTRIES.some((c) => c.toLowerCase() === placeRaw.trim().toLowerCase());

            entities.push({
                name,
                cvrNumber,
                country: isCountry ? placeRaw : null,
                registeredOffice: !isCountry ? placeRaw : null,
                legalForm: columns.legalForm !== null ? cells[columns.legalForm] || null : trailingLegalForm(name),
                ownershipPercentage: columns.ownership !== null ? parsePercentage(cells[columns.ownership]) : null,
                votingRightsPercentage: columns.voting !== null ? parsePercentage(cells[columns.voting]) : null,
                source: "noteTable",
                sourceConcept,
                scope,
                parent: null,
                relation: null,
            });
        }
    });

    return entities;
}

type ColumnKey = "name" | "place" | "form" | "amount" | "pct" | "voting";

const COLUMN_LABELS: Array<[ColumnKey | "skip", RegExp]> = [
    ["name", /^navn(?:\s*,\s*retsform)?(?:\s+og\s+hjemsted)?\s*:?/i],
    ["amount", /^(?:selskabskapital|aktiekapital|anpartskapital|egenkapital|equity|årets\s+resultat|share\s+capital|profit(?:\/loss)?)\s*(?:\(?(?:t\.?\s*)?(?:dkk|kr\.?|eur|tkr\.?)\)?)?\s*:?/i],
    ["name", /^(?:selskab(?:snavn)?|virksomhed(?:snavn)?|company(?:\s+name)?|name)(?![a-zæøå])\s*:?/i],
    ["place", /^(?:hjemsted|registered\s+(?:office|in)|domicile|country|land)\s*:?/i],
    ["form", /^(?:retsform|selskabsform|legal\s+form|corporate\s+form)\s*:?/i],
    ["voting", /^(?:stemme(?:andel|ret)(?:sandel)?|voting(?:\s+rights?)?)\s*(?:i\s*)?%?\s*:?/i],
    ["pct", /^(?:ejerandel(?:\s+i)?|ownership(?:\s+share|\s+interest)?|kapitalandel|andel)\s*%?\s*:?/i],
    ["amount", /^(?:kapital|resultat|result)(?![a-zæøå])\s*(?:\(?(?:t\.?\s*)?(?:dkk|kr\.?|eur|tkr\.?)\)?)?\s*:?/i],
    ["skip", /^(?:\(?(?:t\.?\s*)?(?:dkk|kr\.?|eur|tkr\.?)\)?|%|:|,|\.|i\s+alt)\s*/i],
];

/** Section labels inside a list that say what the following rows are. */
const SECTION_LABEL =
    /^(?:(datter(?:virksomhed|selskab)(?:er)?|tilknyttede\s+virksomheder|subsidiaries|group\s+enterprises)|(associerede\s+virksomheder|kapitalinteresser|associates))\s*:?\s*/i;

/**
 * Drops a leading row that has no share and is glued to the next one, typically
 * the reporting company itself: "Q-Interline A/S DanmarkQ-Interline GmbH Tyskland"
 * → "Q-Interline GmbH Tyskland". Only a country name directly followed by an
 * uppercase letter counts as such a seam.
 */
function dropGluedLeadingRow(chunk: string): string {
    const countries = COUNTRIES.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const seam = new RegExp(`^.{3,}?(?:${countries})(?=\\p{Lu})`, "u");
    const match = seam.exec(chunk);
    return match ? chunk.slice(match[0].length) : chunk;
}

/** True when a would-be row name is really a stray column label ("Navn", "Ejerandel i %"). */
function looksLikeListHeaderCell(text: string): boolean {
    return (
        text.length < 40 &&
        /^(?:navn|selskab|name|company|virksomhed|hjemsted|retsform|ejerandel|ownership|egenkapital|årets\s+resultat|resultat|kapital)\b/i.test(text)
    );
}

/** Legal-form suffix at the end of a text, or null. Case-insensitive, longest first. */
function trailingLegalForm(text: string): string | null {
    const lower = text.toLowerCase();
    const form = LEGAL_FORMS.find((candidate) => lower.endsWith(candidate.toLowerCase()));
    if (!form) return null;
    // Must be a whole token: "Oy" in "Orifarm Oy" yes, "ab" in "Kebab" no.
    const before = text[text.length - form.length - 1];
    return before === undefined || !/[a-zæøå0-9]/i.test(before) || /[A-ZÆØÅ]$/.test(text.slice(-form.length, -form.length + 1)) ? text.slice(-form.length) : null;
}

interface ListHeader {
    columns: ColumnKey[];
    /** Where the header starts and where its rows start. */
    start: number;
    rowsStart: number;
    /** What the text just before the header says the rows are. */
    relation: GroupEntityFromNotes["relation"];
}

/**
 * Reads every column-list header in a note ("Navn Hjemsted Ejerandel …"), in
 * order. A header that opens with Hjemsted/Retsform has an implicit name column
 * in front. The rows of one header run until the next header.
 */
export function readListHeaders(text: string): ListHeader[] {
    const headerStart = /navn|selskab(?![a-zæøå])|virksomhed(?![a-zæøå])|company|\bname\b|hjemsted|retsform/gi;
    const pctLabel = /ejerandel|ownership|kapitalandel/i;
    const headers: ListHeader[] = [];
    let match: RegExpExecArray | null;

    while ((match = headerStart.exec(text)) !== null) {
        const start = match.index;
        if (headers.length && start < headers[headers.length - 1].rowsStart) continue;
        // A header lists its column labels within a short span.
        if (!pctLabel.test(text.slice(start, start + 160))) continue;

        const columns: ColumnKey[] = [];
        let pos = start;
        while (pos < text.length) {
            const rest = text.slice(pos);
            const ws = /^\s+/.exec(rest);
            if (ws) {
                pos += ws[0].length;
                continue;
            }
            let advanced = false;
            for (const [key, pattern] of COLUMN_LABELS) {
                const m = pattern.exec(rest);
                if (!m || m[0].length === 0) continue;
                // "Navn, retsform og hjemsted" / "Navn og hjemsted" bundle columns into the name cell.
                if (key === "name") {
                    columns.push("name");
                    if (/retsform/i.test(m[0])) columns.push("form");
                    if (/hjemsted/i.test(m[0])) columns.push("place");
                } else if (key !== "skip") {
                    columns.push(key);
                }
                pos += m[0].length;
                advanced = true;
                break;
            }
            if (!advanced) break;
        }
        if (!columns.includes("pct")) continue;
        if (!columns.includes("name")) {
            // "HjemstedRetsformEjerandel": the name column has no label but comes first.
            if (columns[0] !== "place" && columns[0] !== "form") continue;
            columns.unshift("name");
        }
        const before = text.slice(Math.max(0, start - 70), start);
        const relation: GroupEntityFromNotes["relation"] = /associere|kapitalinteresse/i.test(before)
            ? "associate"
            : /datter|tilknyttede|subsidiar/i.test(before)
              ? "subsidiary"
              : null;
        headers.push({ columns, start, rowsStart: pos, relation });
        headerStart.lastIndex = pos;
    }

    return headers;
}

/** The first list header of a note (kept for callers that only need one). */
export function readListHeader(text: string): { columns: ColumnKey[]; rowsStart: number } | null {
    const first = readListHeaders(text)[0];
    return first ? { columns: first.columns, rowsStart: first.rowsStart } : null;
}

/**
 * Picks the ownership share out of a digit run that may be glued to a preceding
 * amount ("87.34539.891100" → 100, "48850" → 50). Prefers 100, then the longest
 * suffix that is a valid share. Returns null when the run is not clearly a share.
 */
export function shareFromGluedDigits(run: string): number | null {
    const clean = run.replace(/\s/g, "");
    if (/^\d{1,3}([.,]\d{1,2})?$/.test(clean)) return parsePercentage(clean);
    if (clean.endsWith("100")) return 100;
    const decimal = /(\d{1,2}[.,]\d{1,2})$/.exec(clean);
    if (decimal) return parsePercentage(decimal[1]);
    const twoDigits = /(\d{2})$/.exec(clean);
    if (twoDigits && twoDigits[1] !== "00") return parsePercentage(twoDigits[1]);
    return null;
}

/**
 * Extracts group entities from a column list whose cells arrived glued together
 * (tier 3a): "NavnHjemstedEjerandel…Thouber Tax-Free Cars A/SOdense100%4.142.331…".
 *
 * The column order is read from the header, then every row is cut at its
 * ownership token and parsed from the right: legal form (retsform column),
 * glued amount columns, the registered office (the last capitalised word, with
 * an optional ", Country"), and what remains is the name. Section labels
 * ("Dattervirksomheder:", "Associerede virksomheder:") classify the rows that
 * follow. Rows that do not parse are skipped; the note is rejected when fewer
 * than half of its rows parse.
 */
export function parseColumnList(text: string, sourceConcept: string, scope: GroupEntityFromNotes["scope"]): GroupEntityFromNotes[] {
    const normalized = cleanText(text);
    const headers = readListHeaders(normalized);
    const entities: GroupEntityFromNotes[] = [];
    let rows = 0;

    headers.forEach((header, index) => {
        const segmentEnd = headers[index + 1]?.start ?? normalized.length;
        const parsed = parseListSegment(normalized.slice(header.rowsStart, segmentEnd), header, sourceConcept, scope);
        rows += parsed.rows;
        entities.push(...parsed.entities);
    });

    // The note is rejected when fewer than half of its rows parse.
    return rows > 0 && entities.length * 2 >= rows ? entities : [];
}

function parseListSegment(
    body: string,
    header: ListHeader,
    sourceConcept: string,
    scope: GroupEntityFromNotes["scope"],
): { entities: GroupEntityFromNotes[]; rows: number } {
    const { columns } = header;
    const pctIndex = columns.indexOf("pct");
    const amountsAfterPct = columns.slice(pctIndex + 1).some((c) => c === "amount" || c === "voting");
    const amountsBeforePct = columns.slice(0, pctIndex).some((c) => c === "amount");
    const hasFormColumn = columns.includes("form");
    const hasPlace = columns.includes("place");
    const usesPercentSign = /%/.test(body);

    // Row terminator: a share with "%" — or, in lists without "%", a bare share
    // right before the next capitalised name (only safe when nothing follows it).
    const pctToken = usesPercentSign
        ? /(\d[\d.,]*?)\s*%/g
        : amountsAfterPct
          ? null
          : /(?<![\d.,])(100|\d{1,2}(?:[.,]\d{1,2})?)(?=\s*(?:[A-ZÆØÅ"“]|$))/g;
    if (!pctToken) return { entities: [], rows: 0 };

    const entities: GroupEntityFromNotes[] = [];
    let rows = 0;
    let relation = header.relation;
    let cursor = 0;
    let match: RegExpExecArray | null;
    const votingFollowsShare = usesPercentSign && columns[pctIndex + 1] === "voting";

    while ((match = pctToken.exec(body)) !== null) {
        let chunk = body.slice(cursor, match.index);
        cursor = pctToken.lastIndex;

        // A voting-rights column right after the share: "…100 % 100 %".
        let votingShare: number | null = null;
        if (votingFollowsShare) {
            const voting = /^\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%/.exec(body.slice(cursor));
            if (voting) {
                votingShare = parsePercentage(voting[1]);
                cursor += voting[0].length;
                pctToken.lastIndex = cursor;
            }
        }

        // Amounts that trail the previous row's share belong to no name.
        if (amountsAfterPct) chunk = chunk.replace(/^[\s\d.,\-–%]+/, "");
        chunk = chunk.trim();

        const section = SECTION_LABEL.exec(chunk);
        if (section) {
            relation = section[1] ? "subsidiary" : "associate";
            chunk = chunk.slice(section[0].length).trim();
        }
        chunk = dropGluedLeadingRow(chunk);
        if (!chunk) continue;
        rows++;

        const rawShare = match[1];
        const share = shareFromGluedDigits(rawShare);
        // A share glued to an amount column is only trusted when it resolves cleanly.
        const shareTrusted = /^\d{1,3}([.,]\d{1,2})?$/.test(rawShare.replace(/\s/g, "")) || (amountsBeforePct && share !== null);

        let rest = chunk;
        let legalForm: string | null = null;
        if (hasFormColumn) {
            legalForm = trailingLegalForm(rest);
            if (legalForm) rest = rest.slice(0, -legalForm.length).trim();
        }
        // Amount columns between the name/place and the share (equity, result…).
        if (amountsBeforePct) rest = rest.replace(/[\s\d.,\-–]+$/, "").trim();

        let place: string | null = null;
        if (hasPlace) {
            // A known country at the end is stripped as written ("USA", "Tyskland",
            // "Hadsund, Danmark"); then the last capitalised word is the city — unless
            // the remainder ends in a legal form ("Q-Interline GmbH"), which means the
            // note only gave a country. "J-Maskiner, Rødekro" stays name + city.
            const restLower = rest.toLowerCase();
            const countryHit = COUNTRIES.find(
                (c) => restLower.endsWith(c.toLowerCase()) && /[\s,]/.test(rest[rest.length - c.length - 1] ?? " "),
            );
            let countryText: string | null = null;
            if (countryHit) {
                countryText = rest.slice(-countryHit.length);
                rest = rest.slice(0, -countryHit.length).replace(/[\s,]+$/, "");
            }
            let city: string | null = null;
            if (!trailingLegalForm(rest)) {
                const cityMatch = /(?:,\s*)?(\p{Lu}[\p{Ll}.\-]+(?:\s\p{Lu}[\p{Ll}.\-]+)?)$/u.exec(rest);
                if (cityMatch && cityMatch[1].length < rest.length) {
                    city = cityMatch[1].trim();
                    rest = rest.slice(0, cityMatch.index).trim();
                }
            }
            place = city && countryText ? `${city}, ${countryText}` : (city ?? countryText);
        }

        let cvrNumber: string | null = null;
        const cvr = /,?\s*CVR(?:-?nr\.?)?\s*:?\s*(\d{2}\s?\d{2}\s?\d{2}\s?\d{2})\s*$/i.exec(rest);
        if (cvr) {
            cvrNumber = cvr[1].replace(/\s/g, "");
            rest = rest.slice(0, cvr.index).trim();
        }

        // Footnote markers ("*)", "**", "1)") and separators do not belong to the name.
        const name = rest
            .replace(/\s*(?:\*+\)?|\d\))\s*$/, "")
            .replace(/[,;:·|\s]+$/, "")
            .replace(/^[+•·–\-\s]+(?=\S)/, "")
            .trim();
        if (!name || name.length < 3 || !/[a-zæøå]/i.test(name) || looksLikeListHeaderCell(name) || SECTION_LABEL.test(name)) continue;
        // Without any corroborating column the row is too weak to trust.
        if (!place && !legalForm && !trailingLegalForm(name) && !shareTrusted) continue;

        const isCountry = place !== null && COUNTRIES.some((c) => c.toLowerCase() === place.toLowerCase());
        const country = place && !isCountry ? (COUNTRIES.find((c) => place!.toLowerCase().endsWith(", " + c.toLowerCase())) ?? null) : place;

        entities.push({
            name,
            cvrNumber,
            country,
            registeredOffice: isCountry ? null : country ? place!.slice(0, -country.length).replace(/,\s*$/, "") : place,
            legalForm: legalForm ?? trailingLegalForm(name),
            ownershipPercentage: shareTrusted ? share : null,
            votingRightsPercentage: votingShare,
            source: "noteText",
            sourceConcept,
            scope,
            parent: null,
            relation,
        });
    }

    return { entities, rows };
}

/** Names mentioned in the prose of an investments note (tier 3b): "kapitalandele i X ApS", "dattervirksomheden X A/S". */
export function parseInvestmentProse(text: string, sourceConcept: string, scope: GroupEntityFromNotes["scope"]): GroupEntityFromNotes[] {
    const normalized = cleanText(text);
    const formAlt = LEGAL_FORMS.map((f) => f.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&")).join("|");
    const pattern = new RegExp(
        `(?:kapitalandele(?:ne)?\\s+i|(datter(?:virksomhed|selskab)(?:en|et|erne|er)?|tilknyttede\\s+virksomhed(?:en|er)?)|(associerede\\s+virksomhed(?:en|er)?|kapitalinteresse[rn]?))\\s+((?:[A-ZÆØÅ0-9][^\\s,.;()]*\\s){0,6}?(?:${formAlt}))(?=[\\s,.;:)]|$)`,
        "g",
    );
    const entities: GroupEntityFromNotes[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalized)) !== null) {
        const name = match[3].trim();
        if (name.length < 4 || /^(?:tilknyttede|associerede|datter)/i.test(name)) continue;
        entities.push({
            name,
            cvrNumber: null,
            country: null,
            registeredOffice: null,
            legalForm: trailingLegalForm(name),
            ownershipPercentage: null,
            votingRightsPercentage: null,
            source: "noteText",
            sourceConcept,
            scope,
            parent: null,
            relation: match[2] ? "associate" : match[1] ? "subsidiary" : null,
        });
    }
    return entities;
}

/**
 * Extracts group entities from an unstructured text note (tier 3): rows like
 * "<name><country><legal form><pct>" concatenated with no separators. Anchored on
 * the percent token, a known legal-form suffix and a known country name are peeled
 * from the right; the remainder is the entity name. STRICT: if any row fails to
 * parse, the whole note is discarded — better nothing than half-parsed garbage.
 */
export function parsePlainText(
    text: string,
    sourceConcept: string,
    scope: GroupEntityFromNotes["scope"],
): GroupEntityFromNotes[] {
    const normalized = cleanText(text);

    // Only attempt notes that present an ownership column of some kind.
    if (!/ejerandel|ownership\s*%?/i.test(normalized)) return [];

    // A percent token ends each row: decimals ("100.00", "53,5") or an explicit "%".
    // No lookahead after the decimals: a company name may start with a digit right
    // after the percent ("…100.00" + "1 0 1 Carefarm GmbH…"). A false match inside
    // an unrelated large number produces a failing row, which the strictness rule
    // below turns into "discard the whole note" — safe either way.
    const percentToken = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%|(\d{1,3}[.,]\d{2})/g;

    const entities: GroupEntityFromNotes[] = [];
    let lastIndex = 0;
    let sawFailure = false;
    let match: RegExpExecArray | null;

    while ((match = percentToken.exec(normalized)) !== null) {
        let chunk = normalized.slice(lastIndex, match.index).trim();
        lastIndex = percentToken.lastIndex;

        // Cut leading header text (also repeated headers after page breaks):
        // everything up to and including the last ownership/ejerandel keyword.
        const headerCut = /.*(?:ownership|ejerandel)[\s%i]*/is.exec(chunk);
        if (headerCut) chunk = chunk.slice(headerCut[0].length).trim();

        chunk = dropGluedLeadingRow(chunk);
        if (!chunk) continue;

        const percentage = parsePercentage(match[1] ?? match[2]);

        // Case-insensitive: filings write "Oy"/"OY", "GmbH"/"GMBH" interchangeably.
        // The country check below still gates every row, so this cannot misfire alone.
        const chunkLower = chunk.toLowerCase();
        const matchedForm = LEGAL_FORMS.find((form) => chunkLower.endsWith(form.toLowerCase())) ?? null;
        const legalForm = matchedForm ? chunk.slice(chunk.length - matchedForm.length) : null;
        if (matchedForm) chunk = chunk.slice(0, -matchedForm.length).trim();

        const country =
            COUNTRIES.find((c) => chunk.toLowerCase().endsWith(c.toLowerCase()))
                ?.trim() ?? null;
        if (country) chunk = chunk.slice(0, -country.length).trim();

        // Trailing separators, and leading "+"/bullet markers some reports use to
        // flag additions to the group.
        const name = chunk
            .replace(/[,;·|]+$/, "")
            .replace(/^[+•·–\-\s]+(?=\S)/, "")
            .trim();

        if (!name || !country || percentage === null) {
            sawFailure = true;
            break;
        }

        entities.push({
            name,
            cvrNumber: null,
            country,
            registeredOffice: null,
            legalForm,
            ownershipPercentage: percentage,
            votingRightsPercentage: null,
            source: "noteText",
            sourceConcept,
            scope,
            parent: null,
            relation: null,
        });
    }

    // Strictness rule: one bad row invalidates the whole note.
    return sawFailure ? [] : entities;
}

/**
 * Extracts companies that are potentially part of the corporate group from the
 * notes of an annual report. Deduped by normalized name across notes; the
 * reporting entity itself and entities already present in the structured
 * `relatedEntities` facts are dropped (structured facts win).
 */
export function extractGroupEntitiesFromNotes(
    doc: XBRLDocument,
    reportingPeriodEndDate: string,
    relatedEntities: RelatedEntity[] = [],
): GroupEntityFromNotes[] {
    const fsaPrefixes = doc.getNamespacesFromURI("http://xbrl.dcca.dk/fsa").map((p) => p.toLowerCase());
    if (fsaPrefixes.length === 0) return [];

    const contexts = doc.getContext();

    const reportingEntityName =
        doc
            .extractTaxonomyField({
                name: "NameOfReportingEntity",
                namespace: "http://xbrl.dcca.dk/gsd",
                label: "Virksomhedens navn",
            })?.[0]
            ?.value?.trim() ?? null;

    const excluded = new Set<string>();
    if (reportingEntityName) excluded.add(normalizeEntityName(reportingEntityName));
    for (const entity of relatedEntities) {
        if (entity.name) excluded.add(normalizeEntityName(entity.name));
    }

    const results: GroupEntityFromNotes[] = [];
    const seen = new Set<string>();

    for (const element of doc.elements) {
        const tagName = element.tagName.toLowerCase();
        const prefix = tagName.includes(":") ? tagName.split(":")[0] : "";
        if (!fsaPrefixes.includes(prefix)) continue;

        // Numeric facts (unitRef) can never hold a note.
        if (element.getAttribute("unitRef")) continue;

        const text = element.textContent ?? "";
        if (text.length < 30 || !NOTE_KEYWORDS.test(text)) continue;

        // Only notes for the current reporting period.
        const contextRef = element.getAttribute("contextRef");
        const context = contextRef ? contexts[contextRef] : null;
        if (!context || (context.endDate !== reportingPeriodEndDate && context.instant !== reportingPeriodEndDate)) {
            continue;
        }

        const consolidatedSolo = context.dimensions.find((d) => d.dimension === "ConsolidatedSoloDimension");
        const scope: GroupEntityFromNotes["scope"] =
            consolidatedSolo?.member === "ConsolidatedMember"
                ? "consolidated"
                : consolidatedSolo?.member === "SoloMember"
                  ? "solo"
                  : null;

        const sourceConcept = doc.removeNamespacePrefix(element.tagName);

        // Tier 2: the fragment's own markup, or table markup that arrived
        // HTML-escaped and thus surfaces in the decoded text content.
        const serialized = element.toString();
        let entities: GroupEntityFromNotes[] = [];
        if (/<table/i.test(serialized)) {
            entities = parseTables(serialized, sourceConcept, scope);
        } else if (/<table/i.test(text)) {
            entities = parseTables(text, sourceConcept, scope);
        }

        // Tier 3: plain concatenated text — a glued column list first, then the
        // right-anchored country/legal-form rows, then prose in investment notes.
        if (entities.length === 0 && !/<table/i.test(serialized) && !/<table/i.test(text)) {
            entities = parseColumnList(text, sourceConcept, scope);
            if (entities.length === 0) entities = parsePlainText(text, sourceConcept, scope);
        }
        if (/invest|subsidiar|groupenterprise|kapitalandel/i.test(sourceConcept) || /kapitalandele i/i.test(text)) {
            entities = entities.concat(parseInvestmentProse(text, sourceConcept, scope));
        }

        for (const entity of entities) {
            const key = normalizeEntityName(entity.name);
            if (!key || excluded.has(key) || seen.has(key)) continue;
            seen.add(key);
            results.push(entity);
        }
    }

    return results;
}
