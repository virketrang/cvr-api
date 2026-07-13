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
 *  - Plain concatenated text with no markup at all ("…Ownership %Orifarm Oy
 *    FinlandOy100.00…") — parsed right-anchored: split on percent tokens, peel a
 *    known corporate-form suffix, then a known country name; the rest is the name.
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
                votingRightsPercentage: null,
                source: "structured" as const,
                sourceConcept: "RelatedEntityName",
                scope: null,
                parent: null,
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
    place: /hjemsted|registered|domicile|country|land\b|by\b/i,
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
function parseTables(html: string, sourceConcept: string, scope: GroupEntityFromNotes["scope"]): GroupEntityFromNotes[] {
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

            const name = cells[columns.name] ?? "";
            if (!name || looksLikeHeader(name)) continue;
            // A name is a proper noun, not a number.
            if (/^[\d.,%\s]+$/.test(name)) continue;

            const placeRaw = columns.place !== null ? cells[columns.place] || null : null;
            const isCountry =
                placeRaw !== null && COUNTRIES.some((c) => c.toLowerCase() === placeRaw.trim().toLowerCase());

            entities.push({
                name,
                cvrNumber: null,
                country: isCountry ? placeRaw : null,
                registeredOffice: !isCountry ? placeRaw : null,
                legalForm: columns.legalForm !== null ? cells[columns.legalForm] || null : null,
                ownershipPercentage: columns.ownership !== null ? parsePercentage(cells[columns.ownership]) : null,
                votingRightsPercentage: columns.voting !== null ? parsePercentage(cells[columns.voting]) : null,
                source: "noteTable",
                sourceConcept,
                scope,
                parent: null,
            });
        }
    });

    return entities;
}

/**
 * Extracts group entities from an unstructured text note (tier 3): rows like
 * "<name><country><legal form><pct>" concatenated with no separators. Anchored on
 * the percent token, a known legal-form suffix and a known country name are peeled
 * from the right; the remainder is the entity name. STRICT: if any row fails to
 * parse, the whole note is discarded — better nothing than half-parsed garbage.
 */
function parsePlainText(
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

        // Tier 3: plain concatenated text.
        if (entities.length === 0 && !/<table/i.test(serialized) && !/<table/i.test(text)) {
            entities = parsePlainText(text, sourceConcept, scope);
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
