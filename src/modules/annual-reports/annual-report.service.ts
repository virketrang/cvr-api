import environment from "../../environment.js";
import ÅRL_TAXONOMY from "./annual-report.taxonomy.js";
import type {
    Account,
    AnnualReport,
    AnnualReportResponse,
    BatchAnnualReportResponse,
    BatchAnnualReportResult,
    DanishBusinessRegistrationAccountingAPIResponse,
    ExtractResult,
    GroupEntityFromNotes,
    PriorPeriodFigures,
    ReportSkip,
    ReportWarning,
    UnprocessedAnnualReport,
} from "./annual-report.types.js";

import { extractGroupEntities } from "./annual-report.notes-extraction.js";

import XBRLDocument from "./annual-report.utils.js";
import { ErrorCode, toAppError } from "../../utils/api-error.js";
import {
    basicAuthHeader,
    fetchUpstreamJson,
    fetchWithTimeout,
    isUrlOnHost,
    readXmlResponseText,
} from "../../utils/http.js";

const CVR_API_URL = "http://distribution.virk.dk/offentliggoerelser/_search";

// Document URLs come from a plain-HTTP upstream response (virk.dk has no TLS), so
// they are only trusted as far as this host; anything else is refused, see isUrlOnHost.
const DOCUMENT_HOST = "virk.dk";

export default abstract class AnnualReportService {
    public static async getAnnualReportsFromDanishBusinessRegistrationAPI(
        cvrNumber: number,
    ): Promise<Array<UnprocessedAnnualReport>> {
        const data = await fetchUpstreamJson<DanishBusinessRegistrationAccountingAPIResponse>(
            "Det offentlige register",
            CVR_API_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: basicAuthHeader(environment.CVR_API_USERNAME, environment.CVR_API_PASSWORD),
                },
                body: JSON.stringify({
                    query: {
                        bool: {
                            must: [
                                {
                                    term: {
                                        cvrNummer: cvrNumber,
                                    },
                                },
                                {
                                    term: {
                                        offentliggoerelsestype: "regnskab",
                                    },
                                },
                                {
                                    query_string: {
                                        query: 'dokumenter.dokumentMimeType:"application/xml"',
                                    },
                                },
                            ],
                        },
                    },
                    size: 2999,
                }),
            },
        );

        const financialStatements = data.hits.hits.map((hit) => hit._source);

        const annualReports = await Promise.all(
            financialStatements.map(async (report) => {
                const documents = await Promise.all(
                    report.dokumenter
                        .filter((document) => document.dokumentMimeType === "application/xml")
                        .map(async (document) => {
                            let xmlText = "";
                            if (!isUrlOnHost(document.dokumentUrl, DOCUMENT_HOST)) {
                                console.warn(
                                    `Refused to download document from unexpected host (not ${DOCUMENT_HOST}): ${document.dokumentUrl}`,
                                );
                                return { ...document, xmlText };
                            }
                            try {
                                const xmlResponse = await fetchWithTimeout(document.dokumentUrl);
                                // Re-check the FINAL url: a redirect must not escape the
                                // allowlisted host either.
                                if (xmlResponse.ok && isUrlOnHost(xmlResponse.url, DOCUMENT_HOST)) {
                                    // Encoding-aware: many XBRL filings are ISO-8859-1/UTF-16
                                    // and only say so in the XML prolog, which .text() ignores.
                                    xmlText = await readXmlResponseText(xmlResponse);
                                }
                            } catch {
                                // Leave xmlText empty; extractAnnualReportFromXML will record
                                // this document as a MALFORMED_XML skip rather than crashing.
                            }

                            return {
                                ...document,
                                xmlText,
                            };
                        }),
                );

                return {
                    cvrNumber: report.cvrNummer,
                    reportingPeriod: {
                        startDate: report.regnskab.regnskabsperiode.startDato,
                        endDate: report.regnskab.regnskabsperiode.slutDato,
                    },
                    documents,
                };
            }),
        );

        return annualReports;
    }

    /**
     * Group entities mentioned in the notes of a company's NEWEST annual report.
     * Deliberately lightweight (used to enrich every company in a corporate-group
     * response): one search sorted newest-first with size 1, one document download,
     * and only the notes extractor — no full statement extraction. Any failure
     * yields an empty list; enrichment must never break the caller's endpoint.
     */
    public static async getNewestGroupEntitiesFromNotes(cvrNumber: number): Promise<GroupEntityFromNotes[]> {
        try {
            const data = await fetchUpstreamJson<DanishBusinessRegistrationAccountingAPIResponse>(
                "Det offentlige register",
                CVR_API_URL,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: basicAuthHeader(environment.CVR_API_USERNAME, environment.CVR_API_PASSWORD),
                    },
                    body: JSON.stringify({
                        query: {
                            bool: {
                                must: [
                                    { term: { cvrNummer: cvrNumber } },
                                    { term: { offentliggoerelsestype: "regnskab" } },
                                    { query_string: { query: 'dokumenter.dokumentMimeType:"application/xml"' } },
                                ],
                            },
                        },
                        sort: [{ "regnskab.regnskabsperiode.slutDato": { order: "desc" } }],
                        size: 1,
                    }),
                },
            );

            const newest = data.hits.hits[0]?._source;
            if (!newest) return [];

            const document = newest.dokumenter.find((doc) => doc.dokumentMimeType === "application/xml");
            if (!document || !isUrlOnHost(document.dokumentUrl, DOCUMENT_HOST)) return [];

            const xmlResponse = await fetchWithTimeout(document.dokumentUrl);
            if (!xmlResponse.ok || !isUrlOnHost(xmlResponse.url, DOCUMENT_HOST)) return [];

            const xml = await readXmlResponseText(xmlResponse);
            const xbrlDocument = new XBRLDocument(xml);

            return extractGroupEntities(xbrlDocument, newest.regnskab.regnskabsperiode.slutDato);
        } catch (error) {
            console.warn(
                `Kunne ikke udlæse koncernoplysninger fra noterne for CVR ${cvrNumber}: ` +
                    `${toAppError(error).message}`,
            );
            return [];
        }
    }

    /**
     * A human-readable (Danish) explanation of an unsupported taxonomy. IFRS/ESEF
     * filings (used by listed and other large companies) are the common case and get
     * a specific message; otherwise the schema file name is included so the user can
     * report exactly which taxonomy was encountered.
     */
    private static describeUnsupportedTaxonomy(taxonomy: string): string {
        if (/ifrs|esef/i.test(taxonomy)) {
            return (
                "Årsrapporten er aflagt efter IFRS/ESEF-taksonomien, som ikke understøttes. " +
                "Det gælder typisk børsnoterede og andre store virksomheder — tallene skal indtastes manuelt."
            );
        }

        const schemaFile = taxonomy.split("/").pop() ?? taxonomy;
        return `Årsrapporten anvender en ikke-understøttet taksonomi (${schemaFile}) og kunne ikke læses.`;
    }

    public static extractAnnualReportFromXML(xml: string): ExtractResult {
        // The XBRLDocument constructor and extractTaxonomyData throw AppErrors with
        // specific codes (MALFORMED_XML, MISSING_NAMESPACE, MALFORMED_UNIT,
        // MISSING_PERIOD). Catch them here and convert to a typed skip reason so the
        // caller can report *which* document failed and why.
        try {
            const xbrlDocument = new XBRLDocument(xml);

            const taxonomy = xbrlDocument.getTaxonomy();

            if (!taxonomy) {
                return {
                    ok: false,
                    errorCode: ErrorCode.UNKNOWN_TAXONOMY,
                    message: "Årsrapporten angiver ingen taksonomi (schemaRef mangler eller er ugyldig).",
                };
            }

            const acceptedTaxonomies: string[] = ÅRL_TAXONOMY.schema;

            if (!acceptedTaxonomies.some((t) => taxonomy.includes(t))) {
                return {
                    ok: false,
                    errorCode: ErrorCode.UNKNOWN_TAXONOMY,
                    message: AnnualReportService.describeUnsupportedTaxonomy(taxonomy),
                };
            }

            const { report, priorFigures } = xbrlDocument.extractTaxonomyData();

            return { ok: true, report, priorFigures };
        } catch (error) {
            const appError = toAppError(error);
            return { ok: false, errorCode: appError.errorCode, message: appError.message };
        }
    }

    public static async getAnnualReports(cvrNumber: number): Promise<AnnualReportResponse> {
        const xmlAnnualReports = await AnnualReportService.getAnnualReportsFromDanishBusinessRegistrationAPI(cvrNumber);

        // Nothing published at all (e.g. a newly founded company whose first annual
        // report is not due yet). Say so explicitly — an empty "success" is
        // indistinguishable from a working extraction that found nothing, and has
        // been mistaken for a bug.
        if (xmlAnnualReports.length === 0) {
            return {
                total: 0,
                status: "failed",
                results: [],
                skipped: [],
                errorCode: ErrorCode.NO_DATA,
                message:
                    "Der er endnu ikke offentliggjort nogen årsrapport for selskabet " +
                    "(fx fordi det er nystiftet, eller fordi første regnskabsår ikke er afsluttet).",
            };
        }

        const extracted: Array<{ report: AnnualReport<Account>; priorFigures: PriorPeriodFigures | null }> = [];
        const skipped: ReportSkip[] = [];

        for (const xmlAnnualReport of xmlAnnualReports) {
            for (const document of xmlAnnualReport.documents) {
                const result = AnnualReportService.extractAnnualReportFromXML(document.xmlText);

                if (result.ok) {
                    extracted.push({ report: result.report, priorFigures: result.priorFigures });
                } else {
                    // Record WHY this document was dropped, with the year + document URL,
                    // so the client can tell the user (e.g. "2023: unknown taxonomy").
                    skipped.push({
                        reportingPeriodEndDate: xmlAnnualReport.reportingPeriod?.endDate ?? null,
                        documentUrl: document.dokumentUrl ?? null,
                        errorCode: result.errorCode,
                        message: result.message,
                    });
                    console.warn(
                        `Skipped report for CVR ${xmlAnnualReport.cvrNumber} (${result.errorCode}) ` +
                            `[${xmlAnnualReport.reportingPeriod?.endDate ?? "ukendt periode"}]: ${result.message}`,
                    );
                }
            }
        }

        AnnualReportService.addPriorYearMismatchWarnings(extracted);

        const annualReports = extracted.map((entry) => entry.report);

        annualReports.sort((a, b) => {
            const dateA = new Date(a.reportingPeriod.reportingPeriodEndDate);
            const dateB = new Date(b.reportingPeriod.reportingPeriodEndDate);
            return dateB.getTime() - dateA.getTime();
        });

        // Filings exist but not a single document could be read: report that as a
        // company-level failure with a typed reason, so a client (e.g. the VBA
        // workbook) can tell the user WHY there are no numbers — most commonly an
        // unsupported (IFRS/ESEF) taxonomy — instead of showing an empty company.
        if (annualReports.length === 0 && skipped.length > 0) {
            const dominant = AnnualReportService.dominantSkipReason(skipped);
            return {
                results: [],
                total: 0,
                status: "failed",
                skipped,
                errorCode: dominant.errorCode,
                message: dominant.message,
            };
        }

        return {
            results: annualReports,
            total: annualReports.length,
            status: "success",
            skipped,
        };
    }

    /** The most frequent skip reason, used as the company-level error when nothing parsed. */
    private static dominantSkipReason(skipped: ReportSkip[]): Pick<ReportSkip, "errorCode" | "message"> {
        const byCode = new Map<string, { count: number; skip: ReportSkip }>();
        for (const skip of skipped) {
            const entry = byCode.get(skip.errorCode) ?? { count: 0, skip };
            entry.count += 1;
            byCode.set(skip.errorCode, entry);
        }
        const dominant = [...byCode.values()].sort((a, b) => b.count - a.count)[0].skip;
        return { errorCode: dominant.errorCode, message: dominant.message };
    }

    /**
     * Cross-checks every report against the following year's report: the figures a
     * report states for its own period should reappear unchanged as that period's
     * comparative figures in the next report. Any field where the two disagree
     * (typically a restatement) is added as a PRIOR_YEAR_MISMATCH warning on the
     * report the figures are FOR — e.g. 2022 figures restated in the 2023 report
     * warn on the 2022 report.
     */
    private static addPriorYearMismatchWarnings(
        extracted: Array<{ report: AnnualReport<Account>; priorFigures: PriorPeriodFigures | null }>,
    ): void {
        type Difference = Extract<ReportWarning, { code: "PRIOR_YEAR_MISMATCH" }>["differences"][number];

        const compareStatements = (
            statement: Difference["statement"],
            current: Partial<Record<string, Account>>,
            comparative: Partial<Record<string, Account>>,
        ): Difference[] => {
            const differences: Difference[] = [];

            for (const [field, account] of Object.entries(current)) {
                const comparativeAccount = comparative[field];

                // Only fields present in both reports can be compared; differing
                // units would make the amounts incomparable, so skip those too.
                if (
                    account == null ||
                    comparativeAccount == null ||
                    (account.unit && comparativeAccount.unit && account.unit !== comparativeAccount.unit)
                ) {
                    continue;
                }

                if (account.value !== comparativeAccount.value) {
                    differences.push({
                        statement,
                        field,
                        label: account.label,
                        value: account.value,
                        valueInNextReport: comparativeAccount.value,
                    });
                }
            }

            return differences;
        };

        for (const entry of extracted) {
            const endDate = entry.report.reportingPeriod.reportingPeriodEndDate;

            // The next year's report is the one whose comparative (prior) period ends
            // exactly where this report's own period ends.
            const next = extracted.find((candidate) => candidate !== entry && candidate.priorFigures?.endDate === endDate);

            if (!next?.priorFigures) continue;

            const differences: Difference[] = [
                ...compareStatements(
                    "incomeStatement",
                    entry.report.incomeStatement as unknown as Partial<Record<string, Account>>,
                    next.priorFigures.incomeStatement as Partial<Record<string, Account>>,
                ),
                ...compareStatements(
                    "balanceSheet",
                    entry.report.balancesheet as unknown as Partial<Record<string, Account>>,
                    next.priorFigures.balanceSheet as Partial<Record<string, Account>>,
                ),
            ];

            if (entry.report.consolidated && next.priorFigures.consolidated) {
                differences.push(
                    ...compareStatements(
                        "consolidatedIncomeStatement",
                        entry.report.consolidated.incomeStatement as unknown as Partial<Record<string, Account>>,
                        next.priorFigures.consolidated.incomeStatement as Partial<Record<string, Account>>,
                    ),
                    ...compareStatements(
                        "consolidatedBalanceSheet",
                        entry.report.consolidated.balancesheet as unknown as Partial<Record<string, Account>>,
                        next.priorFigures.consolidated.balanceSheet as Partial<Record<string, Account>>,
                    ),
                );
            }

            if (differences.length > 0) {
                entry.report.warnings.push({
                    code: "PRIOR_YEAR_MISMATCH",
                    message:
                        "Et eller flere beløb i denne årsrapport afviger fra sammenligningstallene for samme " +
                        "periode i den efterfølgende årsrapport (typisk en korrektion/omarbejdelse). Kontrollér tallene.",
                    differences,
                });
            }
        }
    }

    public static async getAnnualReportsBatch(cvrNumbers: number[]): Promise<BatchAnnualReportResponse> {
        // Concurrency limit: fan out, but not unboundedly — distribution.virk.dk
        // is an upstream we don't want to flood. Process in chunks of CONCURRENCY.
        const CONCURRENCY = 10;

        const results: BatchAnnualReportResult[] = [];

        for (let i = 0; i < cvrNumbers.length; i += CONCURRENCY) {
            const chunk = cvrNumbers.slice(i, i + CONCURRENCY);

            const chunkResults = await Promise.all(
                chunk.map(async (cvrNumber): Promise<BatchAnnualReportResult> => {
                    try {
                        const response = await AnnualReportService.getAnnualReports(cvrNumber);
                        return {
                            cvrNumber: String(cvrNumber).padStart(8, "0"),
                            status: response.status,
                            total: response.total,
                            results: response.results,
                            skipped: response.skipped,
                            // Carried when the whole company failed (e.g. every filing
                            // uses an unsupported taxonomy), so batch clients can tell
                            // the user why this company came back empty.
                            errorCode: response.errorCode,
                            message: response.message,
                        };
                    } catch (error) {
                        // Isolate the failure to this one company and carry a typed code
                        // so the client can distinguish "upstream down" from "bad data".
                        const appError = toAppError(error);
                        console.warn(
                            `Batch: failed to fetch annual reports for CVR ${cvrNumber} ` +
                                `(${appError.errorCode}): ${appError.message}`,
                        );
                        return {
                            cvrNumber: String(cvrNumber).padStart(8, "0"),
                            status: "error",
                            total: 0,
                            results: [],
                            skipped: [],
                            errorCode: appError.errorCode,
                            message: appError.message,
                        };
                    }
                }),
            );

            results.push(...chunkResults);
        }

        // Roll the per-company statuses up into one overall status.
        const successCount = results.filter((r) => r.status === "success").length;
        let overallStatus: "success" | "partial" | "error";
        if (successCount === results.length) {
            overallStatus = "success";
        } else if (successCount === 0) {
            overallStatus = "error";
        } else {
            overallStatus = "partial";
        }

        return {
            total: results.length,
            status: overallStatus,
            results,
        };
    }
}
