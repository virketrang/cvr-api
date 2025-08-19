import environment from "../../environment.js";
import ÅRL_TAXONOMY from "./annual-report.taxonomy.js";
import type {
    AnnualReportResponse,
    DanishBusinessRegistrationAccountingAPIResponse,
    FilteredRecord,
    UnprocessedAnnualReport,
    XBRLRecord,
} from "./annual-report.types.js";

import XBRLDocument from "./annual-report.utils.js";
import Utils from "../../utils/index.js";

const CVR_API_URL = "http://distribution.virk.dk/offentliggoerelser/_search";

export default abstract class AnnualReportService {
    public static async getAnnualReportsFromDanishBusinessRegistrationAPI(
        cvrNumber: number
    ): Promise<Array<UnprocessedAnnualReport>> {
        const response = await fetch(CVR_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${Buffer.from(
                    `${environment.CVR_API_USERNAME}:${environment.CVR_API_PASSWORD}`
                ).toString("base64")}`,
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
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch data from CVR API: ${response.statusText}`);
        }

        const data: DanishBusinessRegistrationAccountingAPIResponse = await response.json();

        const financialStatements = data.hits.hits.map((hit) => hit._source);

        const annualReports = await Promise.all(
            financialStatements.map(async (report) => {
                const documents = await Promise.all(
                    report.dokumenter
                        .filter((document) => document.dokumentMimeType === "application/xml")
                        .map(async (document) => {
                            const xmlResponse = await fetch(document.dokumentUrl);
                            // remove all xbrli: prefixes and :xbrli suffixes from the XML document
                            const xmlText = await xmlResponse.text();

                            return {
                                ...document,
                                xmlText,
                            };
                        })
                );

                return {
                    cvrNumber: report.cvrNummer,
                    reportingPeriod: {
                        startDate: report.regnskab.regnskabsperiode.startDato,
                        endDate: report.regnskab.regnskabsperiode.slutDato,
                    },
                    documents,
                };
            })
        );

        return annualReports;
    }

    public static extractAnnualReportFromXML(xml: string) {
        const xbrlDocument = new XBRLDocument(xml);

        const taxonomy = xbrlDocument.getTaxonomy();

        if (!taxonomy) {
            console.warn("No taxonomy found in the annual report XML.");
            return null;
        }

        const acceptedTaxonomies: string[] = ÅRL_TAXONOMY.schema;

        if (!acceptedTaxonomies.some((t) => taxonomy.includes(t))) {
            console.warn(
                `The taxonomy ${taxonomy} is not accepted. Accepted taxonomies are: ${acceptedTaxonomies.join(", ")}`
            );
            return null;
        }

        const annualReport = xbrlDocument.extractTaxonomyData();

        return annualReport;
    }

    public static async getAnnualReports(cvrNumber: number): Promise<AnnualReportResponse> {
        const xmlAnnualReports = await AnnualReportService.getAnnualReportsFromDanishBusinessRegistrationAPI(cvrNumber);

        if (xmlAnnualReports.length === 0) {
            return {
                total: 0,
                status: "success",
                results: [],
            };
        }

        const annualReports = xmlAnnualReports
            .map((xmlAnnualReport) => {
                const documents = xmlAnnualReport.documents
                    .map((document) => {
                        const annualReport = AnnualReportService.extractAnnualReportFromXML(document.xmlText);

                        if (!annualReport) {
                            console.warn(
                                `No valid annual report found for CVR number ${xmlAnnualReport.cvrNumber} in document ${document.dokumentUrl}`
                            );
                            return null;
                        }

                        return AnnualReportService.extractAnnualReportFromXML(document.xmlText);
                    })
                    .filter((doc) => doc !== null);

                return documents;
            })
            .flat();

        return {
            results: annualReports,
            total: annualReports.length,
            status: "success",
        };
    }
}
