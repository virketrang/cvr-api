import { DOMParser, Document, Element as XMLElement } from "@xmldom/xmldom";

import type {
    Account,
    AnnualReport,
    BalanceSheet,
    ConsolidatedFinancialStatementsSubsidiary,
    ExtractionHint,
    FilteredRecord,
    IncomeStatement,
    Notes,
    PriorPeriodFigures,
    RelatedEntity,
    ReportingStandard,
    ReportWarning,
    StatementName,
    TaxonomyFact,
    TaxonomySection,
    XBRLContext,
    XBRLRecord,
} from "./annual-report.types.js";

import ÅRL_TAXONOMY from "./annual-report.taxonomy.js";
import IFRS_TAXONOMY from "./annual-report.taxonomy.ifrs.js";
import { extractGroupEntities, extractIfrsGroupEntities } from "./annual-report.notes-extraction.js";
import { AppError, ErrorCode } from "../../utils/api-error.js";

const XMLParser = new DOMParser();

/**
 * Namespaces whose URI carries a version date, matched by pattern instead of
 * literally. A TaxonomyFact names them by alias ("ifrs-full", "ifrs-dk").
 *
 * - ifrs-full: the IFRS Foundation taxonomy, one URI per yearly release
 *   (http://xbrl.ifrs.org/taxonomy/2014-03-05/ifrs-full …; the 2011 release
 *   used the prefix "ifrs" and the URI …/2011-03-25/ifrs).
 * - ifrs-dk: Erhvervsstyrelsen's Danish IFRS additions, dated per release.
 */
const NAMESPACE_ALIASES: Record<string, RegExp> = {
    "ifrs-full": /^https?:\/\/xbrl\.ifrs\.org\/taxonomy\/\d{4}-\d{2}-\d{2}\/ifrs(-full)?$/,
    "ifrs-dk": /^https?:\/\/xbrl\.dcca\.dk\/ifrs-dk-cor_\d{4}-\d{2}-\d{2}$/,
};

/**
 * How a taxonomy tells the company's own figures from the group's. The two
 * models are mirror images: in ÅRL an undimensioned fact is the company's own
 * (SoloMember is the default member), in IFRS it is the group's
 * (ConsolidatedMember is the default of ifrs-full's axis) and the parent's
 * figures, when tagged at all, carry SeparateMember. See
 * docs/taksonomier-aarl-ifrs-esef.md §5.
 */
interface ScopeModel {
    dimension: string;
    consolidatedMember: string;
    soloMember: string;
    defaultScope: "solo" | "consolidated";
}

const ÅRL_SCOPE: ScopeModel = {
    dimension: "ConsolidatedSoloDimension",
    consolidatedMember: "ConsolidatedMember",
    soloMember: "SoloMember",
    defaultScope: "solo",
};

const IFRS_SCOPE: ScopeModel = {
    dimension: "ConsolidatedAndSeparateFinancialStatementsAxis",
    consolidatedMember: "ConsolidatedMember",
    soloMember: "SeparateMember",
    defaultScope: "consolidated",
};

/** What XBRLDocument.getStandard() found out about the filing. */
export interface StandardInfo {
    standard: ReportingStandard | null;
    /** The schemaRef href, or null when missing/ambiguous. */
    schemaRef: string | null;
    /** True for the figure-less ÅRL instance IFRS filers submit next to their ESEF instance. */
    generalDataOnly: boolean;
}

export default class XBRLDocument {
    public document: Document;
    public elements: XMLElement[];
    public prefix: string | null = null;
    public root: XMLElement;
    public namespaces: Record<string, string> = {};
    private _contextCache: Record<string, XBRLContext> | null = null;
    private _unitCache: Record<string, string> | null = null;

    constructor(public xmlText: string) {
        const document = XMLParser.parseFromString(xmlText, "text/xml");

        const root = document.documentElement;

        if (!root) {
            throw new AppError(ErrorCode.MALFORMED_XML, "Årsrapportens XML mangler et rod-element.");
        }

        this.document = document;
        this.root = root;
        this.elements = Array.from(document.getElementsByTagName("*"));
        this.prefix = root.tagName.includes(":") ? root.tagName.split(":")[0] : null;
        this.extractNamespaces();
    }

    public extractNamespaces() {
        Array.from(this.root.attributes).forEach((attr) => {
            this.namespaces[attr.name] = attr.value;
        });

        const xmlns = this.getNamespacesFromURI("http://www.xbrl.org/2003/instance")[0];

        if (!xmlns)
            throw new AppError(ErrorCode.MISSING_NAMESPACE, "Årsrapportens XML mangler XBRL-namespace (xbrli).");

        const prefix = xmlns.includes(":") ? xmlns.split(":")[0] : xmlns;

        Object.keys(this.namespaces).forEach((key) => {
            if (key.startsWith(`${prefix}:`)) {
                const newKey = key.replace(`${prefix}:`, "");
                this.namespaces[newKey] = this.namespaces[key];
                delete this.namespaces[key];
            }
        });
    }

    /** Prefixes declared for a namespace URI, or for an alias from NAMESPACE_ALIASES. */
    public getNamespacesFromURI(uri: string): string[] {
        const pattern = NAMESPACE_ALIASES[uri];
        return Object.keys(this.namespaces).filter((key) =>
            pattern ? pattern.test(this.namespaces[key]) : this.namespaces[key] === uri,
        );
    }

    /** True when at least one fact in the document belongs to the namespace (URI or alias). */
    private hasFactsIn(uri: string): boolean {
        const prefixes = this.getNamespacesFromURI(uri).map((prefix) => `${prefix.toLowerCase()}:`);
        if (prefixes.length === 0) return false;
        return this.elements.some((element) => {
            const tagName = element.tagName.toLowerCase();
            return prefixes.some((prefix) => tagName.startsWith(prefix));
        });
    }

    private _standardCache: StandardInfo | null = null;

    /**
     * Which taxonomy the filing's figures are tagged with.
     *
     * Detection is by the facts' namespaces, not by the schemaRef: an IFRS filing's
     * schemaRef points at the company's own extension taxonomy (or, for older
     * IFRS-DK filings, at one of 128 entry points), so a list of accepted schemas
     * cannot work there. ÅRL filings keep the schemaRef check against the known
     * entry points, which also tells the figure-less general-data stub apart.
     */
    public getStandard(): StandardInfo {
        if (this._standardCache) return this._standardCache;

        const schemaRef = this.getTaxonomy();
        let info: StandardInfo = { standard: null, schemaRef, generalDataOnly: false };

        if (this.hasFactsIn("ifrs-full")) {
            const isDanishIfrs =
                this.getNamespacesFromURI("ifrs-dk").length > 0 ||
                /\/ifrs\/entry-ifrs-dk|\/taxonomy\/extension\//.test(schemaRef ?? "");
            info = { standard: isDanishIfrs ? "IFRS-DK" : "ESEF", schemaRef, generalDataOnly: false };
        } else if (schemaRef && /ExcludingBalanceSheetIncomeStatement/.test(schemaRef)) {
            info = { standard: "ÅRL", schemaRef, generalDataOnly: true };
        } else if (schemaRef && ÅRL_TAXONOMY.schema.some((accepted) => schemaRef.includes(accepted))) {
            info = { standard: "ÅRL", schemaRef, generalDataOnly: false };
        }

        this._standardCache = info;
        return info;
    }

    /** The solo/consolidated dimension model of the filing's taxonomy. */
    private get scopeModel(): ScopeModel {
        const { standard } = this.getStandard();
        return standard === "IFRS-DK" || standard === "ESEF" ? IFRS_SCOPE : ÅRL_SCOPE;
    }

    /**
     * The reporting period read off the contexts, for instances without period
     * facts (ESEF): the undimensioned duration context that ends last; among
     * several with that end date, the longest one, i.e. the full year rather
     * than a quarter.
     */
    public inferReportingPeriod(): { startDate: string; endDate: string } | null {
        const candidates = Object.values(this.getContext()).filter(
            (context) => context.dimensions.length === 0 && context.startDate && context.endDate,
        );
        if (candidates.length === 0) return null;

        const best = candidates.reduce((a, b) => {
            if (b.endDate! > a.endDate!) return b;
            if (b.endDate! < a.endDate!) return a;
            return b.startDate! < a.startDate! ? b : a;
        });
        return { startDate: best.startDate!, endDate: best.endDate! };
    }

    public getElementsByTagName({
        tag,
        referenceElement,
        prefix,
    }: {
        tag: string;
        referenceElement?: XMLElement;
        prefix?: string | string[];
    }): XMLElement[] {
        const lowerCaseTagName = tag.toLowerCase();
        const elements = referenceElement ? Array.from(referenceElement.getElementsByTagName("*")) : this.elements;

        if (prefix) {
            // Lowercase the prefix too: some filings declare mixed-case prefixes
            // (e.g. "EOGS_202050000" for gsd), and the element tag names are compared
            // in lowercase.
            const prefixedTagName = Array.isArray(prefix)
                ? prefix.map((p) => `${p.toLowerCase()}:${lowerCaseTagName}`)
                : `${prefix.toLowerCase()}:${lowerCaseTagName}`;

            return elements.filter(
                (element) =>
                    prefixedTagName.includes(element.tagName.toLowerCase()) ||
                    element.tagName.toLowerCase() === lowerCaseTagName,
            );
        }

        return this.prefix
            ? elements.filter(
                  (element) =>
                      element.tagName.toLowerCase() === `${this.prefix!.toLowerCase()}:${lowerCaseTagName}` ||
                      element.tagName.toLowerCase() === lowerCaseTagName,
              )
            : elements.filter((element) => element.tagName.toLowerCase() === lowerCaseTagName);
    }

    public getContext(): Record<string, XBRLContext> {
        if (this._contextCache) return this._contextCache;

        const contextTags = this.getElementsByTagName({ tag: "context" });

        const context: Record<string, XBRLContext> = {};

        contextTags.forEach((contextTag) => {
            const id = contextTag.getAttribute("id");

            if (!id) return;

            const startDate = this.getElementsByTagName({ tag: "startDate", referenceElement: contextTag })[0]
                ?.textContent;
            const endDate = this.getElementsByTagName({ tag: "endDate", referenceElement: contextTag })[0]?.textContent;
            const identifier = this.getElementsByTagName({ tag: "identifier", referenceElement: contextTag })[0]
                ?.textContent;
            const instant = this.getElementsByTagName({ tag: "instant", referenceElement: contextTag })[0]?.textContent;

            const xbrldiNamespaces = this.getNamespacesFromURI("http://xbrl.org/2006/xbrldi");
            const explicitMemberTags = this.getElementsByTagName({
                tag: "explicitMember",
                referenceElement: contextTag,
                prefix: xbrldiNamespaces,
            });
            const typedMemberTags = this.getElementsByTagName({
                tag: "typedMember",
                referenceElement: contextTag,
                prefix: xbrldiNamespaces,
            });

            const dimensions: Array<{ dimension: string; member: string }> = [];

            for (const tag of explicitMemberTags) {
                const dimension = tag.getAttribute("dimension");
                const member = tag.textContent?.trim();
                if (dimension && member) {
                    // Explicit members are QNames (e.g. "c:SubsidiaryMember"); drop the prefix.
                    dimensions.push({
                        dimension: this.removeNamespacePrefix(dimension),
                        member: this.removeNamespacePrefix(member),
                    });
                }
            }

            for (const tag of typedMemberTags) {
                const dimension = tag.getAttribute("dimension");
                // Typed members carry a data value (e.g. "1") in a child element; keep it verbatim.
                const member = tag.textContent?.trim();
                if (dimension && member) {
                    dimensions.push({ dimension: this.removeNamespacePrefix(dimension), member });
                }
            }

            const explicitMember = explicitMemberTags[0]?.textContent?.trim();

            context[id] = {
                id,
                startDate,
                endDate,
                identifier,
                instant,
                explicitMember: explicitMember ? this.removeNamespacePrefix(explicitMember) : null,
                dimensions,
            };
        });

        this._contextCache = context;
        return context;
    }

    public getUnits(): Record<string, string> {
        if (this._unitCache) return this._unitCache;

        const unitTags = this.getElementsByTagName({ tag: "unit" });

        const units: Record<string, string> = {};

        unitTags.forEach((unitTag) => {
            const id = unitTag.getAttribute("id");

            const measure = this.getElementsByTagName({ tag: "measure", referenceElement: unitTag })[0]?.textContent;

            if (!id || !measure) {
                throw new AppError(
                    ErrorCode.MALFORMED_UNIT,
                    "Årsrapporten indeholder en ugyldig enhedsangivelse (unit mangler id eller measure).",
                );
            }

            units[id] = measure;
        });

        this._unitCache = units;
        return units;
    }

    public removeNamespacePrefix(tagName: string): string {
        return tagName.includes(":") ? tagName.split(":")[1] : tagName;
    }

    public getAttribute({
        attribute,
        referenceElement,
        prefix,
    }: {
        attribute: string;
        referenceElement: XMLElement;
        prefix?: string | string[];
    }): string | null {
        const lowerCaseAttributeName = attribute.toLowerCase();

        const prefixedTagNames = prefix
            ? Array.isArray(prefix)
                ? prefix.map((p) => `${p.toLowerCase()}:${lowerCaseAttributeName}`)
                : [`${prefix.toLowerCase()}:${lowerCaseAttributeName}`]
            : [lowerCaseAttributeName];

        for (let i = 0; i < referenceElement.attributes.length; i++) {
            const attribute = referenceElement.attributes[i];
            const attributeName = attribute.name.toLowerCase();

            if (prefixedTagNames.includes(attributeName)) {
                return attribute.value;
            }
        }

        return null;
    }

    public getTaxonomy(): string | null {
        const linkNamespaces = this.getNamespacesFromURI("http://www.xbrl.org/2003/linkbase");
        const xlinkNamespaces = this.getNamespacesFromURI("http://www.w3.org/1999/xlink");

        const schemaTags = this.getElementsByTagName({
            tag: "schemaRef",
            prefix: linkNamespaces,
        });

        if (schemaTags.length !== 1) {
            console.warn("Expected exactly one schemaRef element in the XBRL document.");
            return null;
        }

        const taxonomy = this.getAttribute({
            attribute: "href",
            referenceElement: schemaTags[0],
            prefix: xlinkNamespaces,
        });

        if (!taxonomy) {
            console.warn("SchemaRef element does not have a valid href attribute.");
            return null;
        }

        return taxonomy;
    }

    public getElementsByURI(uri: string): XMLElement[] {
        const namespaces = this.getNamespacesFromURI(uri);

        if (namespaces.length === 0) {
            throw new AppError(ErrorCode.MISSING_NAMESPACE, `Årsrapportens XML mangler namespace for URI: ${uri}`);
        }

        return this.elements.filter((element) => {
            const tagName = element.tagName.toLowerCase();
            return namespaces.some((namespace) => tagName.startsWith(`${namespace.toLowerCase()}:`));
        });
    }

    /**
     * Repairs the "decimals used as a scale factor" malformation.
     *
     * XBRL `decimals` is a *precision* indicator, not a scale — the instance value is
     * already the full amount, so normally we return it untouched. But some filings
     * misuse a negative `decimals` and strip the trailing zeros it implies (e.g. report
     * `247483` with `decimals="-3"` to mean `247,483,000`). We detect that per fact —
     * `decimals < 0` and the value is not a multiple of `10^|decimals|` (i.e. it lacks
     * the zeros its precision claims) — and multiply it back up by `10^|decimals|`,
     * returning a `repair` record so the caller can warn the consumer.
     *
     * A genuinely full value that merely carries a wrong `decimals` tag is
     * indistinguishable per fact and will also be scaled — hence the warning, so the
     * adjustment is never silent.
     */
    public repairScaling(account: {
        value: number | null;
        unit: string | null;
        label: string;
        decimals: number | null;
    }): {
        account: { value: number | null; unit: string | null; label: string };
        repair: { originalValue: number; repairedValue: number; factor: number } | null;
    } {
        const base = { value: account.value, unit: account.unit, label: account.label };
        const decimals = account.decimals;

        // `!(decimals < 0)` (rather than `decimals >= 0`) also rejects NaN, so a
        // malformed decimals value can never produce a NaN repair factor.
        if (account.value == null || account.value === 0 || decimals == null || !(decimals < 0)) {
            return { account: base, repair: null };
        }

        const factor = Math.pow(10, -decimals); // 10^|decimals|

        // Already carries the precision its decimals claims (>= |decimals| trailing zeros).
        if (Math.abs(account.value) % factor === 0) {
            return { account: base, repair: null };
        }

        const repairedValue = account.value * factor;
        return {
            account: { value: repairedValue, unit: account.unit, label: account.label },
            repair: { originalValue: account.value, repairedValue, factor },
        };
    }

    public extractTaxonomyField(field: TaxonomyFact) {
        const namespaces = this.getNamespacesFromURI(field.namespace);

        const elements = this.getElementsByTagName({
            tag: field.name,
            prefix: namespaces,
        });

        if (!elements || elements.length === 0) {
            return null;
        }

        const contexts = this.getContext();
        const units = this.getUnits();

        const xbrlRecord: XBRLRecord = elements.map((element) => {
            const value = element.textContent?.trim() || null;

            const contextRef = element.getAttribute("contextRef") || null;
            const unitRef = element.getAttribute("unitRef") || null;
            const decimals = element.getAttribute("decimals");

            const context = contextRef ? contexts[contextRef] : null;
            const unit = unitRef && units[unitRef] ? this.removeNamespacePrefix(units[unitRef]) : null;

            // decimals="INF" (an exact value, common in Danish filings) and other
            // non-numeric values parse to NaN — normalize to null so no scaling
            // arithmetic is ever done on them.
            const parsedDecimals = decimals !== null ? parseInt(decimals, 10) : NaN;

            return {
                value,
                context,
                unit,
                label: field.label,
                decimals: Number.isFinite(parsedDecimals) ? parsedDecimals : null,
            };
        });

        return xbrlRecord;
    }

    /**
     * True when a context belongs to the requested reporting scope. The Danish
     * taxonomy separates the parent's own figures from the group's via
     * ConsolidatedSoloDimension: consolidated (koncern) facts carry
     * ConsolidatedMember, solo facts carry either no dimensions at all or an
     * explicit SoloMember.
     */
    private matchesScope(context: XBRLContext, scope: "solo" | "consolidated"): boolean {
        const model = this.scopeModel;
        const scopeMembers = context.dimensions.filter((d) => d.dimension === model.dimension);

        // Any other dimension (a note breakdown, a rounding variant, an equity
        // component) means the fact is not the statement total.
        if (scopeMembers.length !== context.dimensions.length) return false;
        if (scopeMembers.length === 0) return model.defaultScope === scope;

        const wanted = scope === "consolidated" ? model.consolidatedMember : model.soloMember;
        return scopeMembers.length === 1 && scopeMembers[0].member === wanted;
    }

    /** True when the context's scope dimension (or its default) says "group". */
    private isConsolidatedContext(context: XBRLContext): boolean {
        const model = this.scopeModel;
        const scopeMember = context.dimensions.find((d) => d.dimension === model.dimension);
        return scopeMember ? scopeMember.member === model.consolidatedMember : model.defaultScope === "consolidated";
    }

    public createAccountFromXBRLRecord(
        xbrlRecord: XBRLRecord,
        date: string,
        allowDimensional: boolean = false,
        scope: "solo" | "consolidated" = "solo",
    ) {
        if (!xbrlRecord || !Array.isArray(xbrlRecord)) {
            return null;
        }

        const financialResults = xbrlRecord.filter((record) => {
            const context = record.context;
            if (context == null || (context.endDate !== date && context.instant !== date)) return false;

            // Dimensional facts allowed (used for notes): any dimensions are fine,
            // but the ConsolidatedSoloDimension still decides which scope the fact
            // belongs to — a solo note must not pick up koncern figures and vice versa.
            if (allowDimensional) {
                const isConsolidated = this.isConsolidatedContext(context);
                return scope === "consolidated" ? isConsolidated : !isConsolidated;
            }

            return this.matchesScope(context, scope);
        });

        if (financialResults.length === 0) {
            return null;
        }

        // Statement facts: no non-scope dimensions ever match, so every match is the
        // total; when it is tagged more than once, take the most precise one.
        if (!allowDimensional) {
            return this.toAccount(this.mostPreciseRecord(financialResults));
        }

        // Notes: a note figure (e.g. AmortisationOfIntangibleAssets) may be tagged
        // either at entity level (no axis beyond the scope marker) OR only split per
        // intangible-asset class on a dimension. Prefer the entity-level total; only
        // when it is absent do we sum the per-class facts (one value per distinct
        // member) to reconstruct the total. Both routes are unit-tagged, so the scale
        // is unambiguous — unlike the free-text roll-forward note, which we never
        // parse into a number.
        const scopeDimension = this.scopeModel.dimension;
        const nonScopeDimensions = (record: NonNullable<XBRLRecord>[number]) =>
            record.context!.dimensions.filter((d) => d.dimension !== scopeDimension);

        const entityLevel = financialResults.filter((record) => nonScopeDimensions(record).length === 0);
        if (entityLevel.length > 0) {
            return this.toAccount(this.mostPreciseRecord(entityLevel));
        }

        return this.sumDimensionalFacts(financialResults, nonScopeDimensions);
    }

    /** Turns one XBRL record into an account, parsing the integer value (null if non-numeric). */
    private toAccount(record: NonNullable<XBRLRecord>[number]) {
        return {
            value: !record.value || isNaN(parseInt(record.value, 10)) ? null : parseInt(record.value, 10),
            unit: record.unit,
            label: record.label,
            decimals: record.decimals,
        };
    }

    /**
     * Sums a note figure that was only tagged per intangible-asset class (a
     * dimensional roll-forward), reconstructing the entity total. Keeps one value
     * per distinct dimension-member signature (so duplicate contexts can't
     * double-count) and only sums facts sharing the first fact's unit. Returns null
     * if no numeric value is present.
     */
    private sumDimensionalFacts(
        records: NonNullable<XBRLRecord>,
        nonScopeDimensions: (record: NonNullable<XBRLRecord>[number]) => XBRLContext["dimensions"],
    ) {
        const byMember = new Map<string, NonNullable<XBRLRecord>[number]>();
        for (const record of records) {
            const signature = nonScopeDimensions(record)
                .map((d) => `${d.dimension}=${d.member}`)
                .sort()
                .join("|");
            if (!byMember.has(signature)) byMember.set(signature, record);
        }

        const unit = [...byMember.values()][0]?.unit ?? null;
        const decimals = [...byMember.values()][0]?.decimals ?? null;
        const label = [...byMember.values()][0]?.label ?? "";

        let total = 0;
        let sawNumber = false;
        for (const record of byMember.values()) {
            if (record.unit !== unit) continue;
            const parsed = record.value ? parseInt(record.value, 10) : NaN;
            if (!isNaN(parsed)) {
                total += parsed;
                sawNumber = true;
            }
        }

        return sawNumber ? { value: total, unit, label, decimals } : null;
    }

    /**
     * Builds a stable key from a context's dimension members (ignoring the period),
     * so that facts about the same entity are grouped together even when they live
     * in different contexts — e.g. an entity's name in a duration context and its
     * ownership share in an instant context, both carrying the same
     * `IdentificationOfRelatedEntityDimension` typed member.
     */
    private getDimensionSignature(context: XBRLContext): string {
        return context.dimensions
            .map((d) => `${d.dimension}=${d.member}`)
            .sort()
            .join("|");
    }

    /**
     * Extracts a group of dimensional facts (e.g. related entities) where each
     * distinct entity is identified by its dimension members. Facts for one entity
     * may be split across several contexts, so we group every field value by the
     * context's dimension signature and return one record per entity, scoped to the
     * given reporting period.
     */
    public extractDimensionalGroup<T extends Record<keyof T, TaxonomyFact>>(
        group: T,
        endDate: string,
    ): Array<Partial<Record<keyof T, FilteredRecord>>> {
        const byEntity = new Map<string, Partial<Record<keyof T, FilteredRecord>>>();
        const entityOrder: string[] = [];

        for (const key in group) {
            if (!Object.prototype.hasOwnProperty.call(group, key)) continue;

            const records = this.extractTaxonomyField(group[key as keyof T]);

            if (!records) continue;

            for (const record of records) {
                const context = record.context;

                // Only keep dimensional facts for the current reporting period.
                if (
                    !context ||
                    context.dimensions.length === 0 ||
                    (context.endDate !== endDate && context.instant !== endDate)
                ) {
                    continue;
                }

                const signature = this.getDimensionSignature(context);

                if (!byEntity.has(signature)) {
                    byEntity.set(signature, {});
                    entityOrder.push(signature);
                }

                byEntity.get(signature)![key as keyof T] = {
                    value: record.value,
                    unit: record.unit,
                    label: record.label,
                };
            }
        }

        return entityOrder.map((signature) => byEntity.get(signature)!);
    }

    /**
     * The record of a general-data (gsd) fact that describes the report itself.
     *
     * Since the 2019 taxonomy the reporting-period dates can appear twice: once for
     * the accounting period (no dimension, or the default AllReportingPeriodsMember)
     * and once for the period registered in CVR, tagged with
     * TypeOfReportingPeriodDimension = RegisteredReportingPeriodDeviating…Member,
     * when the financial year floats (mergers, demergers, changed year end). Only the
     * accounting period may drive the contexts (technical rules TR05/TR06), so the
     * registered-period fact is never used. Among the rest a context without any
     * dimension wins, then one whose only dimension is the solo/koncern marker (the
     * IFRS-era ÅRL stub tags its general data with ConsolidatedMember).
     */
    private primaryGeneralDataRecord(records: XBRLRecord): NonNullable<XBRLRecord>[number] | null {
        if (!records) return null;

        const isRegisteredPeriod = (record: NonNullable<XBRLRecord>[number]) =>
            record.context?.dimensions.some(
                (d) => d.dimension === "TypeOfReportingPeriodDimension" && d.member !== "AllReportingPeriodsMember",
            ) ?? false;

        const candidates = records.filter((record) => record.value && !isRegisteredPeriod(record));

        return (
            candidates.find((record) => (record.context?.dimensions.length ?? 0) === 0) ??
            candidates.find((record) =>
                record.context!.dimensions.every((d) => d.dimension === this.scopeModel.dimension),
            ) ??
            candidates[0] ??
            null
        );
    }

    /**
     * Of several facts for the same account and date, the one to report: a numeric
     * value with the highest `decimals`. Filings may legitimately carry the same
     * figure twice with different precision (a rounded presentation in the primary
     * statement and the exact amount in a note), and the exact one is wanted.
     */
    private mostPreciseRecord(records: NonNullable<XBRLRecord>): NonNullable<XBRLRecord>[number] {
        const numeric = records.filter((record) => record.value && !isNaN(parseInt(record.value, 10)));
        if (numeric.length === 0) return records[0];

        return numeric.reduce((best, record) => ((record.decimals ?? -Infinity) > (best.decimals ?? -Infinity) ? record : best));
    }

    /**
     * The end date of the reporting period preceding this filing's own — the
     * period its comparative figures cover. Declared gsd facts are preferred
     * ("PredingReportingPeriodEndDate" is the taxonomy's official spelling; the
     * corrected spelling is tried too); otherwise it falls back to the day before
     * the reporting period starts.
     */
    private getPriorPeriodEndDate(reportingPeriodStartDate: string): string | null {
        for (const name of ["PredingReportingPeriodEndDate", "PrecedingReportingPeriodEndDate"]) {
            const records = this.extractTaxonomyField({
                name,
                namespace: "http://xbrl.dcca.dk/gsd",
                label: "Foregående regnskabsperiodes slutdato",
            });
            const value = this.primaryGeneralDataRecord(records)?.value;
            if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(reportingPeriodStartDate)) return null;

        const dayBefore = new Date(`${reportingPeriodStartDate}T00:00:00Z`);
        dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
        return dayBefore.toISOString().slice(0, 10);
    }

    /**
     * The structured related-entity facts (fsa:RelatedEntityName + typed dimension)
     * for the given reporting period — the tagged version of the kapitalandele
     * note. Public so the corporate-group enrichment can extract these without
     * running the full statement extraction.
     */
    public extractRelatedEntities(reportingPeriodEndDate: string): RelatedEntity[] {
        return this.extractDimensionalGroup(ÅRL_TAXONOMY.body.informationOnRelatedEntities, reportingPeriodEndDate)
            .map((group) => ({
                cvrNumber: group.identificationNumberCvrOfRelatedEntity?.value ?? null,
                legalEntityIdentifier: group.legalEntityIdentifierOfRelatedEntity?.value ?? null,
                pNumber: group.identificationNumberPnrOfRelatedEntity?.value ?? null,
                name: group.relatedEntityName?.value ?? null,
                registeredOffice: group.relatedEntityRegisteredOffice?.value ?? null,
                legalForm: group.relatedEntityLegalForm?.value ?? null,
                ownershipPercentage:
                    group.shareHeldByEntityOrConsolidatedEnterprisesInRelatedEntity?.value != null
                        ? parseFloat(group.shareHeldByEntityOrConsolidatedEnterprisesInRelatedEntity.value)
                        : null,
            }))
            .filter((entity) => Object.values(entity).some((value) => value !== null));
    }

    /**
     * Builds the report from the taxonomy that matches the filing's standard —
     * ÅRL, or the IFRS mapping for IFRS-DK and ESEF instances (same field keys,
     * candidate concepts in order of preference). `hint` is what the registry
     * lists the filing under; it is used only when the document carries no
     * period facts, which ESEF instances never do.
     */
    public extractTaxonomyData(hint: ExtractionHint = {}): {
        report: AnnualReport<Account>;
        priorFigures: PriorPeriodFigures | null;
    } {
        const { standard } = this.getStandard();
        const isIfrs = standard === "IFRS-DK" || standard === "ESEF";
        const taxonomy = isIfrs ? IFRS_TAXONOMY.body : ÅRL_TAXONOMY.body;

        // A field may name several candidate concepts; keep each candidate's records, in order.
        const recordsOf = (section: TaxonomySection): Record<string, XBRLRecord[]> => {
            const out: Record<string, XBRLRecord[]> = {};
            for (const [key, candidates] of Object.entries(section)) {
                const facts = Array.isArray(candidates) ? candidates : [candidates];
                out[key] = facts.map((fact) => this.extractTaxonomyField(fact));
            }
            return out;
        };

        const reportingPeriodRecords = recordsOf(taxonomy.reportingPeriod as unknown as TaxonomySection);
        const notesRecords = recordsOf(taxonomy.notes as unknown as TaxonomySection);
        const incomeStatementRecords = recordsOf(taxonomy.incomeStatement as unknown as TaxonomySection);
        const balanceSheetRecords = recordsOf(taxonomy.balanceSheet as unknown as TaxonomySection);

        const periodDate = (key: string): string | null => {
            for (const records of reportingPeriodRecords[key] ?? []) {
                const value = this.primaryGeneralDataRecord(records)?.value;
                if (value) return value;
            }
            return null;
        };

        let startDate = periodDate("reportingPeriodStartDate");
        let endDate = periodDate("reportingPeriodEndDate");

        if (isIfrs && (!startDate || !endDate)) {
            const inferred = this.inferReportingPeriod() ?? hint.reportingPeriod ?? null;
            startDate = startDate ?? inferred?.startDate ?? null;
            endDate = endDate ?? inferred?.endDate ?? null;
        }

        if (!startDate || !endDate) {
            throw new AppError(
                ErrorCode.MISSING_PERIOD,
                "Årsrapporten mangler en regnskabsperiode (start-/slutdato) og kunne ikke placeres.",
            );
        }

        const reportingPeriod = { reportingPeriodStartDate: startDate, reportingPeriodEndDate: endDate };

        // Build each statement's accounts, repairing the "decimals as scale" malformation
        // per fact (see repairScaling) and collecting every repair into one warning.
        // Prior-period repairs go into a discarded sink: they describe the NEXT year's
        // comparatives and must not surface as warnings on this report.
        type RepairedFields = Extract<ReportWarning, { code: "SCALING_REPAIRED" }>["repairedFields"];
        const repairedFields: RepairedFields = [];

        const buildStatement = (
            records: Record<string, XBRLRecord[]>,
            statement: StatementName,
            allowDimensional: boolean,
            date: string = reportingPeriod.reportingPeriodEndDate,
            scope: "solo" | "consolidated" = "solo",
            sink: RepairedFields = repairedFields,
        ): Record<string, Account> => {
            const result: Record<string, Account> = {};

            for (const [key, candidates] of Object.entries(records)) {
                // The first candidate concept tagged for the date and scope wins.
                let account: ReturnType<XBRLDocument["createAccountFromXBRLRecord"]> = null;
                for (const candidate of candidates) {
                    account = this.createAccountFromXBRLRecord(candidate, date, allowDimensional, scope);
                    if (account !== null) break;
                }

                if (account === null) continue;

                const { account: repaired, repair } = this.repairScaling(account);

                if (repair) {
                    sink.push({ statement, field: key, ...repair });
                }

                result[key] = repaired as Account;
            }

            return result;
        };

        const notes = buildStatement(notesRecords, "notes", true) as unknown as Notes<Account>;
        const balanceSheet = buildStatement(balanceSheetRecords, "balanceSheet", false) as unknown as BalanceSheet<Account>;
        const incomeStatement = buildStatement(incomeStatementRecords, "incomeStatement", false) as unknown as IncomeStatement<Account>;

        // Koncernregnskabet: the same fields valued in consolidated contexts. Only
        // present when the filing actually carries such facts. For IFRS filings the
        // undimensioned facts ARE the group's, so this is normally the fuller side.
        const consolidatedBalanceSheet = buildStatement(
            balanceSheetRecords,
            "consolidatedBalanceSheet",
            false,
            reportingPeriod.reportingPeriodEndDate,
            "consolidated",
        );
        const consolidatedIncomeStatement = buildStatement(
            incomeStatementRecords,
            "consolidatedIncomeStatement",
            false,
            reportingPeriod.reportingPeriodEndDate,
            "consolidated",
        );
        const consolidatedNotes = buildStatement(
            notesRecords,
            "consolidatedNotes",
            true,
            reportingPeriod.reportingPeriodEndDate,
            "consolidated",
        );
        const hasConsolidated =
            Object.keys(consolidatedBalanceSheet).length > 0 ||
            Object.keys(consolidatedIncomeStatement).length > 0 ||
            Object.keys(consolidatedNotes).length > 0;
        const consolidated = hasConsolidated
            ? {
                  incomeStatement: consolidatedIncomeStatement as unknown as IncomeStatement<Account>,
                  balancesheet: consolidatedBalanceSheet as unknown as BalanceSheet<Account>,
                  notes: consolidatedNotes as unknown as Notes<Account>,
              }
            : null;

        const hasSolo = Object.keys(balanceSheet).length > 0 || Object.keys(incomeStatement).length > 0;
        const scope: AnnualReport<Account>["scope"] = hasSolo ? (consolidated ? "both" : "solo") : consolidated ? "consolidated" : "solo";

        // Comparative figures for the preceding period, used by the service to
        // cross-check the previous year's report. Repairs are discarded (see above).
        const priorEndDate = this.getPriorPeriodEndDate(reportingPeriod.reportingPeriodStartDate);
        let priorFigures: PriorPeriodFigures | null = null;

        if (priorEndDate) {
            const priorSink: RepairedFields = [];
            const priorBalanceSheet = buildStatement(balanceSheetRecords, "balanceSheet", false, priorEndDate, "solo", priorSink);
            const priorIncomeStatement = buildStatement(incomeStatementRecords, "incomeStatement", false, priorEndDate, "solo", priorSink);
            const priorConsolidatedBalanceSheet = buildStatement(
                balanceSheetRecords,
                "consolidatedBalanceSheet",
                false,
                priorEndDate,
                "consolidated",
                priorSink,
            );
            const priorConsolidatedIncomeStatement = buildStatement(
                incomeStatementRecords,
                "consolidatedIncomeStatement",
                false,
                priorEndDate,
                "consolidated",
                priorSink,
            );

            const hasPriorConsolidated =
                Object.keys(priorConsolidatedBalanceSheet).length > 0 ||
                Object.keys(priorConsolidatedIncomeStatement).length > 0;

            priorFigures = {
                endDate: priorEndDate,
                incomeStatement: priorIncomeStatement,
                balanceSheet: priorBalanceSheet,
                consolidated: hasPriorConsolidated
                    ? {
                          incomeStatement: priorConsolidatedIncomeStatement,
                          balanceSheet: priorConsolidatedBalanceSheet,
                      }
                    : null,
            };
        }

        const warnings: ReportWarning[] = [];
        if (repairedFields.length > 0) {
            warnings.push({
                code: "SCALING_REPAIRED",
                message:
                    "Et eller flere beløb manglede de nuller, som deres decimals-angivelse tilsiger, " +
                    "og er ganget op (decimals brugt som skaleringsfaktor). Kontrollér tallene.",
                repairedFields,
            });
        }

        const groupEntitiesFromNotes = isIfrs
            ? extractIfrsGroupEntities(this, reportingPeriod.reportingPeriodEndDate)
            : extractGroupEntities(this, reportingPeriod.reportingPeriodEndDate);

        // The ÅRL note on which group's consolidated statements the company is part of.
        const consolidatedFinancialStatements: ConsolidatedFinancialStatementsSubsidiary[] = isIfrs
            ? []
            : this.extractDimensionalGroup(
                  ÅRL_TAXONOMY.body.consolidatedFinancialStatements.subsidiaries,
                  reportingPeriod.reportingPeriodEndDate,
              )
                  .map((group) => ({
                      cvrNumber:
                          group.identificationNumberCvrOfRelatedEntityConsolidatedFinancialStatements?.value ?? null,
                      legalEntityIdentifier:
                          group.legalEntityIdentifierOfRelatedEntityConsolidatedFinancialStatements?.value ?? null,
                      pNumber: group.identificationNumberPnrOfRelatedEntityConsolidatedFinancialStatements?.value ?? null,
                      name: group.relatedEntityNameConsolidatedFinancialStatements?.value ?? null,
                      registeredOffice: group.relatedEntityRegisteredOfficeConsolidatedFinancialStatements?.value ?? null,
                      placeWhereConsolidatedFinancialStatementsMayBeObtained:
                          group.placeAtWhichConsolidatedFinancialStatementsMayBeObtainedIfParentIsNondanishEntity
                              ?.value ?? null,
                  }))
                  .filter((subsidiary) => Object.values(subsidiary).some((value) => value !== null));

        // The currency: from the key accounts, solo first, then the group's.
        const unit =
            balanceSheet.assets?.unit ||
            incomeStatement.revenue?.unit ||
            incomeStatement.profitLoss?.unit ||
            consolidated?.balancesheet.assets?.unit ||
            Object.values(balanceSheet).find((account) => account?.unit)?.unit ||
            Object.values(incomeStatement).find((account) => account?.unit)?.unit ||
            Object.values(consolidated?.balancesheet ?? {}).find((account) => account?.unit)?.unit ||
            null;

        return {
            report: {
                reportingPeriod,
                standard: standard ?? "ÅRL",
                scope,
                soloStandard: hasSolo ? (standard ?? "ÅRL") : null,
                unit: unit as string,
                incomeStatement,
                balancesheet: balanceSheet,
                notes,
                groupEntitiesFromNotes,
                consolidatedFinancialStatements,
                consolidated,
                warnings,
                // Filled by the validation engine (src/validation) after the
                // company's full report list is assembled — some checks are
                // cross-year and need every report.
                validation: [],
            },
            priorFigures,
        };
    }
}
