import environment from "../../environment.js";
import ÅRL_TAXONOMY from "./annual-report.taxonomy.js";
import type {
    AnnualReportResponse,
    BatchAnnualReportResponse,
    BatchAnnualReportResult,
    DanishBusinessRegistrationAccountingAPIResponse,
    ExtractResult,
    ReportSkip,
    UnprocessedAnnualReport,
} from "./annual-report.types.js";

import XBRLDocument from "./annual-report.utils.js";
import { ErrorCode, toAppError } from "../../utils/api-error.js";
import { basicAuthHeader, fetchUpstreamJson, fetchWithTimeout, isUrlOnHost } from "../../utils/http.js";

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
                                    xmlText = await xmlResponse.text();
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
                    message: `Årsrapporten anvender en ukendt taksonomi (${taxonomy}) og kunne ikke læses.`,
                };
            }

            const report = xbrlDocument.extractTaxonomyData();

            return { ok: true, report };
        } catch (error) {
            const appError = toAppError(error);
            return { ok: false, errorCode: appError.errorCode, message: appError.message };
        }
    }

    public static async getAnnualReports(cvrNumber: number): Promise<AnnualReportResponse> {
        const xmlAnnualReports = await AnnualReportService.getAnnualReportsFromDanishBusinessRegistrationAPI(cvrNumber);

        if (xmlAnnualReports.length === 0) {
            return {
                total: 0,
                status: "success",
                results: [],
                skipped: [],
            };
        }

        const annualReports: AnnualReportResponse["results"] = [];
        const skipped: ReportSkip[] = [];

        for (const xmlAnnualReport of xmlAnnualReports) {
            for (const document of xmlAnnualReport.documents) {
                const result = AnnualReportService.extractAnnualReportFromXML(document.xmlText);

                if (result.ok) {
                    annualReports.push(result.report);
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

        annualReports.sort((a, b) => {
            const dateA = new Date(a.reportingPeriod.reportingPeriodEndDate);
            const dateB = new Date(b.reportingPeriod.reportingPeriodEndDate);
            return dateB.getTime() - dateA.getTime();
        });

        return {
            results: annualReports,
            total: annualReports.length,
            status: "success",
            skipped,
        };
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
