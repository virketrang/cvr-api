import { DOMParser, Document, Element as XMLElement } from "@xmldom/xmldom";

import type {
    Account,
    AnnualReport,
    BalanceSheet,
    IncomeStatement,
    ReportingPeriod,
    TaxonomyFact,
    XBRLContext,
    XBRLRecord,
} from "./annual-report.types.js";

import ÅRL_TAXONOMY from "./annual-report.taxonomy.js";

const XMLParser = new DOMParser();

export default class XBRLDocument {
    public document: Document;
    public elements: XMLElement[];
    public prefix: string | null = null;
    public root: XMLElement;
    public namespaces: Record<string, string> = {};

    constructor(public xmlText: string) {
        const document = XMLParser.parseFromString(xmlText, "text/xml");

        const root = document.documentElement;

        if (!root) {
            throw new Error("Invalid XML document: no root element found.");
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

        if (!xmlns) throw new Error("No xmlns found in the XBRL document.");

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
                    element.tagName.toLowerCase() === lowerCaseTagName
            );
        }

        return this.prefix
            ? elements.filter(
                  (element) =>
                      element.tagName.toLowerCase() === `${this.prefix}:${lowerCaseTagName}` ||
                      element.tagName.toLowerCase() === lowerCaseTagName
              )
            : elements.filter((element) => element.tagName.toLowerCase() === lowerCaseTagName);
    }

    public getContext(): Record<string, XBRLContext> {
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
            const explicitMemberTag = this.getElementsByTagName({
                tag: "explicitMember",
                referenceElement: contextTag,
                prefix: xbrldiNamespaces,
            });
            const explicitMember = explicitMemberTag[0]?.textContent;

            context[id] = {
                id,
                startDate,
                endDate,
                identifier,
                instant,
                explicitMember: explicitMember ? this.removeNamespacePrefix(explicitMember) : null,
            };
        });

        return context;
    }

    public getUnits(): Record<string, any> {
        const unitTags = this.getElementsByTagName({ tag: "unit" });

        const units: Record<string, any> = {};

        unitTags.forEach((unitTag) => {
            const id = unitTag.getAttribute("id");

            const measure = this.getElementsByTagName({ tag: "measure", referenceElement: unitTag })[0]?.textContent;

            if (!id || !measure) {
                throw new Error("Unit tag must have an id and a measure.");
            }

            units[id] = measure;
        });

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
            throw new Error(`No namespace found for URI: ${uri}`);
        }

        return this.elements.filter((element) => {
            const tagName = element.tagName.toLowerCase();
            return namespaces.some((namespace) => tagName.startsWith(`${namespace}:`));
        });
    }

    public addDecimalsToValue(value: Account & { decimals: number | null }, numberOfTrailingZeros: number): Account {
        if (!value.decimals)
            return {
                value: value.value,
                unit: value.unit,
                label: value.label,
            };

        if (value.decimals > 0)
            return {
                value: value.value,
                unit: value.unit,
                label: value.label,
            };

        if (-value.decimals <= numberOfTrailingZeros)
            return {
                value: value.value,
                unit: value.unit,
                label: value.label,
            };

        return {
            value: value.value * Math.pow(10, -value.decimals),
            unit: value.unit,
            label: value.label,
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

        // get the elements and content from each element
        const xbrlRecord: XBRLRecord = elements.map((element) => {
            const value = element.textContent?.trim() || null;

            const contextRef = element.getAttribute("contextRef") || null;
            const unitRef = element.getAttribute("unitRef") || null;
            const decimals = element.getAttribute("decimals");

            const contexts = this.getContext();

            const context = contextRef ? contexts[contextRef] : null;

            const units = this.getUnits();

            const unit = unitRef ? this.removeNamespacePrefix(units[unitRef]) : null;

            return {
                value,
                context,
                unit,
                label: field.label,
                decimals: decimals ? parseInt(decimals, 10) : null,
            };
        });

        return xbrlRecord;
    }

    public createAccountFromXBRLRecord(xbrlRecord: XBRLRecord, date: string) {
        if (!xbrlRecord || !Array.isArray(xbrlRecord)) {
            return null;
        }

        const financialResults = xbrlRecord.filter((record) => {
            return (
                record.context?.explicitMember === null &&
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

    public extractTaxonomyData(): AnnualReport<Account> | null {
        const reportingPeriodXBRLRecords = {} as ReportingPeriod<XBRLRecord>;
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
            !reportingPeriodXBRLRecords.reportingPeriodStartDate[0].value ||
            !reportingPeriodXBRLRecords.reportingPeriodEndDate[0].value
        ) {
            return null;
        }

        const reportingPeriod = {
            reportingPeriodStartDate: reportingPeriodXBRLRecords.reportingPeriodStartDate[0].value,
            reportingPeriodEndDate: reportingPeriodXBRLRecords.reportingPeriodEndDate[0].value,
        };

        console.log(
            `Reporting period: ${reportingPeriod.reportingPeriodStartDate} - ${reportingPeriod.reportingPeriodEndDate}`
        );

        const numberOfTrailingZerosIncomeStatementArray: number[] = [];
        const numberOfTrailingZerosBalanceSheetArray: number[] = [];

        const balanceSheetWithoutDecimals = Object.fromEntries(
            Object.entries(balanceSheetXBRLRecords)
                .map(([key, value]) => {
                    const account = [
                        key,
                        this.createAccountFromXBRLRecord(value, reportingPeriod.reportingPeriodEndDate),
                    ];

                    if (typeof account[1] === "object" && account[1]?.value !== 0) {
                        const regex = /0+$/;

                        const match = account[1]?.value?.toString().match(regex);

                        if (match) {
                            numberOfTrailingZerosBalanceSheetArray.push(match[0].length);
                        }
                    }

                    return account;
                })
                .filter(([_, value]) => value !== null)
        ) as BalanceSheet<Account & { decimals: number | null }>;

        const incomeStatementWithoutDecimals = Object.fromEntries(
            Object.entries(incomeStatementXBRLRecords)
                .map(([key, value]) => {
                    const account = [
                        key,
                        this.createAccountFromXBRLRecord(value, reportingPeriod.reportingPeriodEndDate),
                    ];

                    if (typeof account[1] === "object" && account[1]?.value !== 0) {
                        const regex = /0+$/;

                        const match = account[1]?.value?.toString().match(regex);

                        if (match) {
                            numberOfTrailingZerosIncomeStatementArray.push(match[0].length);
                        }
                    }

                    return account;
                })
                .filter(([_, value]) => value !== null)
        ) as IncomeStatement<Account & { decimals: number | null }>;

        const numberOfTrailingZerosIncomeStatement = Math.min(...numberOfTrailingZerosIncomeStatementArray);
        const numberOfTrailingZerosBalanceSheet = Math.min(...numberOfTrailingZerosBalanceSheetArray);

        const balanceSheet = Object.fromEntries(
            Object.entries(balanceSheetWithoutDecimals)
                .map(([key, value]) => {
                    return [key, this.addDecimalsToValue(value, numberOfTrailingZerosBalanceSheet)];
                })
                .filter(([_, value]) => value !== null)
        ) as BalanceSheet<Account & { decimals: number | null }>;

        const incomeStatement = Object.fromEntries(
            Object.entries(incomeStatementWithoutDecimals)
                .map(([key, value]) => {
                    return [key, this.addDecimalsToValue(value, numberOfTrailingZerosIncomeStatement)];
                })
                .filter(([_, value]) => value !== null)
        ) as IncomeStatement<Account & { decimals: number | null }>;

        return {
            reportingPeriod: reportingPeriod,
            incomeStatement: incomeStatement,
            balanceSheet: balanceSheet,
        };
    }
}
