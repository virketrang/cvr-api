import { DOMParser, Document, Element as XMLElement } from "@xmldom/xmldom";

import type {
    Account,
    AnnualReport,
    BalanceSheet,
    ConsolidatedFinancialStatementsSubsidiary,
    FilteredRecord,
    IncomeStatement,
    Notes,
    RelatedEntity,
    ReportingPeriod,
    ReportWarning,
    TaxonomyFact,
    XBRLContext,
    XBRLRecord,
} from "./annual-report.types.js";

import ÅRL_TAXONOMY from "./annual-report.taxonomy.js";
import { AppError, ErrorCode } from "../../utils/api-error.js";

const XMLParser = new DOMParser();

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

    public getNamespacesFromURI(uri: string): string[] {
        return Object.keys(this.namespaces).filter((key) => this.namespaces[key] === uri);
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
            const prefixedTagName = Array.isArray(prefix)
                ? prefix.map((p) => `${p}:${lowerCaseTagName}`)
                : `${prefix}:${lowerCaseTagName}`;

            return elements.filter(
                (element) =>
                    prefixedTagName.includes(element.tagName.toLowerCase()) ||
                    element.tagName.toLowerCase() === lowerCaseTagName,
            );
        }

        return this.prefix
            ? elements.filter(
                  (element) =>
                      element.tagName.toLowerCase() === `${this.prefix}:${lowerCaseTagName}` ||
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
                ? prefix.map((p) => `${p}:${lowerCaseAttributeName}`)
                : [`${prefix}:${lowerCaseAttributeName}`]
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
            return namespaces.some((namespace) => tagName.startsWith(`${namespace}:`));
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

    public createAccountFromXBRLRecord(xbrlRecord: XBRLRecord, date: string, allowDimensional: boolean = false) {
        if (!xbrlRecord || !Array.isArray(xbrlRecord)) {
            return null;
        }

        const financialResults = xbrlRecord.filter((record) => {
            // Unless dimensional facts are explicitly allowed, keep only the entity-level
            // total — a context with no dimensions of any kind (explicit OR typed). A null
            // context is excluded (`undefined === 0` is false), as before.
            return (
                (allowDimensional || record.context?.dimensions.length === 0) &&
                (record.context?.endDate === date || record.context?.instant === date)
            );
        });

        if (financialResults.length === 0) {
            return null;
        }

        return {
            value:
                !financialResults[0].value || isNaN(parseInt(financialResults[0].value, 10))
                    ? null
                    : parseInt(financialResults[0].value, 10),
            unit: financialResults[0].unit,
            label: financialResults[0].label,
            decimals: financialResults[0].decimals,
        };
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

    public extractTaxonomyData(): AnnualReport<Account> {
        const reportingPeriodXBRLRecords = {} as ReportingPeriod<XBRLRecord>;
        const notesXBRLRecords = {} as Notes<XBRLRecord>;
        const incomeStatementXBRLRecords = {} as IncomeStatement<XBRLRecord>;
        const balanceSheetXBRLRecords = {} as BalanceSheet<XBRLRecord>;

        for (const key in ÅRL_TAXONOMY.body.reportingPeriod) {
            if (Object.prototype.hasOwnProperty.call(ÅRL_TAXONOMY.body.reportingPeriod, key)) {
                const taxonomyFact =
                    ÅRL_TAXONOMY.body.reportingPeriod[key as keyof typeof ÅRL_TAXONOMY.body.reportingPeriod];
                reportingPeriodXBRLRecords[key as keyof typeof reportingPeriodXBRLRecords] =
                    this.extractTaxonomyField(taxonomyFact);
            }
        }

        for (const key in ÅRL_TAXONOMY.body.notes) {
            if (Object.prototype.hasOwnProperty.call(ÅRL_TAXONOMY.body.notes, key)) {
                const taxonomyFact = ÅRL_TAXONOMY.body.notes[key as keyof typeof ÅRL_TAXONOMY.body.notes];
                notesXBRLRecords[key as keyof typeof notesXBRLRecords] = this.extractTaxonomyField(taxonomyFact);
            }
        }

        for (const key in ÅRL_TAXONOMY.body.incomeStatement) {
            if (Object.prototype.hasOwnProperty.call(ÅRL_TAXONOMY.body.incomeStatement, key)) {
                const taxonomyFact =
                    ÅRL_TAXONOMY.body.incomeStatement[key as keyof typeof ÅRL_TAXONOMY.body.incomeStatement];
                incomeStatementXBRLRecords[key as keyof typeof incomeStatementXBRLRecords] =
                    this.extractTaxonomyField(taxonomyFact);
            }
        }

        for (const key in ÅRL_TAXONOMY.body.balanceSheet) {
            if (Object.prototype.hasOwnProperty.call(ÅRL_TAXONOMY.body.balanceSheet, key)) {
                const taxonomyFact = ÅRL_TAXONOMY.body.balanceSheet[key as keyof typeof ÅRL_TAXONOMY.body.balanceSheet];
                balanceSheetXBRLRecords[key as keyof typeof balanceSheetXBRLRecords] =
                    this.extractTaxonomyField(taxonomyFact);
            }
        }

        if (
            !reportingPeriodXBRLRecords.reportingPeriodStartDate ||
            !reportingPeriodXBRLRecords.reportingPeriodEndDate ||
            !reportingPeriodXBRLRecords.reportingPeriodStartDate[0]?.value ||
            !reportingPeriodXBRLRecords.reportingPeriodEndDate[0]?.value
        ) {
            throw new AppError(
                ErrorCode.MISSING_PERIOD,
                "Årsrapporten mangler en regnskabsperiode (start-/slutdato) og kunne ikke placeres.",
            );
        }

        const reportingPeriod = {
            reportingPeriodStartDate: reportingPeriodXBRLRecords.reportingPeriodStartDate[0].value,
            reportingPeriodEndDate: reportingPeriodXBRLRecords.reportingPeriodEndDate[0].value,
        };

        // Build each statement's accounts, repairing the "decimals as scale" malformation
        // per fact (see repairScaling) and collecting every repair into one warning.
        const repairedFields: ReportWarning["repairedFields"] = [];

        const buildStatement = (
            records: Record<string, XBRLRecord>,
            statement: "balanceSheet" | "incomeStatement" | "notes",
            allowDimensional: boolean,
        ): Record<string, Account> => {
            const result: Record<string, Account> = {};

            for (const [key, record] of Object.entries(records)) {
                const account = this.createAccountFromXBRLRecord(
                    record,
                    reportingPeriod.reportingPeriodEndDate,
                    allowDimensional,
                );

                if (account === null) continue;

                const { account: repaired, repair } = this.repairScaling(account);

                if (repair) {
                    repairedFields.push({ statement, field: key, ...repair });
                }

                result[key] = repaired as Account;
            }

            return result;
        };

        const notes = buildStatement(
            notesXBRLRecords as unknown as Record<string, XBRLRecord>,
            "notes",
            true,
        ) as unknown as Notes<Account>;
        const balanceSheet = buildStatement(
            balanceSheetXBRLRecords as unknown as Record<string, XBRLRecord>,
            "balanceSheet",
            false,
        ) as unknown as BalanceSheet<Account>;
        const incomeStatement = buildStatement(
            incomeStatementXBRLRecords as unknown as Record<string, XBRLRecord>,
            "incomeStatement",
            false,
        ) as unknown as IncomeStatement<Account>;

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

        const relatedEntities: RelatedEntity[] = this.extractDimensionalGroup(
            ÅRL_TAXONOMY.body.informationOnRelatedEntities,
            reportingPeriod.reportingPeriodEndDate,
        )
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

        const consolidatedFinancialStatements: ConsolidatedFinancialStatementsSubsidiary[] =
            this.extractDimensionalGroup(
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

        // Extract unit from the first available account (prioritize key accounts)
        const unit =
            balanceSheet.assets?.unit ||
            incomeStatement.revenue?.unit ||
            incomeStatement.profitLoss?.unit ||
            Object.values(balanceSheet).find((account) => account?.unit)?.unit ||
            Object.values(incomeStatement).find((account) => account?.unit)?.unit ||
            null;

        return {
            reportingPeriod: reportingPeriod,
            unit: unit,
            incomeStatement: incomeStatement,
            balancesheet: balanceSheet,
            notes: notes,
            relatedEntities: relatedEntities,
            consolidatedFinancialStatements: consolidatedFinancialStatements,
            warnings: warnings,
        };
    }
}
