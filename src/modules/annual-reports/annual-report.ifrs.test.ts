import { describe, it } from "node:test";
import assert from "node:assert/strict";

import AnnualReportService from "./annual-report.service.js";
import XBRLDocument from "./annual-report.utils.js";

const CONTEXT = (id: string, period: string, dimensions = "") => `
  <xbrli:context id="${id}">
    <xbrli:entity><xbrli:identifier scheme="http://standards.iso.org/iso/17442">529900ABCDEFGHIJKL12</xbrli:identifier></xbrli:entity>
    <xbrli:period>${period}</xbrli:period>
    ${dimensions ? `<xbrli:scenario>${dimensions}</xbrli:scenario>` : ""}
  </xbrli:context>`;
const duration = (from: string, to: string) => `<xbrli:startDate>${from}</xbrli:startDate><xbrli:endDate>${to}</xbrli:endDate>`;
const instant = (date: string) => `<xbrli:instant>${date}</xbrli:instant>`;
const member = (dimension: string, value: string) => `<xbrldi:explicitMember dimension="${dimension}">${value}</xbrldi:explicitMember>`;
const SEPARATE = member("ifrs-full:ConsolidatedAndSeparateFinancialStatementsAxis", "ifrs-full:SeparateMember");

/**
 * An ESEF instance as Regnskab Special derives it from the inline document: the
 * company's own extension as schemaRef, ifrs-full facts, no general data.
 */
const esefInstance = (facts: string, contexts = "") => `<?xml version="1.0" encoding="UTF-8"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:link="http://www.xbrl.org/2003/linkbase"
    xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:iso4217="http://www.iso.org/4217"
    xmlns:ifrs-full="https://xbrl.ifrs.org/taxonomy/2024-03-27/ifrs-full" xmlns:esef_cor="https://www.esma.europa.eu/taxonomy/2024-03-27/esef_cor"
    xmlns:vws="http://xbrl.example.com/2025-12-31">
  <link:schemaRef xlink:type="simple" xlink:href="http://xbrl.example.com/2025-12-31/EX-2025-12-31.xsd"/>
  ${CONTEXT("cy", duration("2025-01-01", "2025-12-31"))}
  ${CONTEXT("py", duration("2024-01-01", "2024-12-31"))}
  ${CONTEXT("cy-end", instant("2025-12-31"))}
  ${CONTEXT("py-end", instant("2024-12-31"))}
  ${CONTEXT("cy-end-equity-retained", instant("2025-12-31"), member("ifrs-full:ComponentsOfEquityAxis", "ifrs-full:RetainedEarningsMember"))}
  ${contexts}
  <xbrli:unit id="EUR"><xbrli:measure>iso4217:EUR</xbrli:measure></xbrli:unit>
  <ifrs-full:Assets contextRef="cy-end" unitRef="EUR" decimals="-6">24644000000</ifrs-full:Assets>
  <ifrs-full:Assets contextRef="py-end" unitRef="EUR" decimals="-6">22514000000</ifrs-full:Assets>
  <ifrs-full:Equity contextRef="cy-end" unitRef="EUR" decimals="-6">3542000000</ifrs-full:Equity>
  <ifrs-full:Equity contextRef="cy-end-equity-retained" unitRef="EUR" decimals="-6">3580000000</ifrs-full:Equity>
  <ifrs-full:Liabilities contextRef="cy-end" unitRef="EUR" decimals="-6">21102000000</ifrs-full:Liabilities>
  <ifrs-full:EquityAndLiabilities contextRef="cy-end" unitRef="EUR" decimals="-6">24644000000</ifrs-full:EquityAndLiabilities>
  <ifrs-full:Revenue contextRef="cy" unitRef="EUR" decimals="-6">17300000000</ifrs-full:Revenue>
  <ifrs-full:ProfitLoss contextRef="cy" unitRef="EUR" decimals="-6">494000000</ifrs-full:ProfitLoss>
  <ifrs-full:ProfitLoss contextRef="py" unitRef="EUR" decimals="-6">78000000</ifrs-full:ProfitLoss>
  <vws:SomeExtensionLine contextRef="cy" unitRef="EUR" decimals="-6">1</vws:SomeExtensionLine>
  ${facts}
</xbrli:xbrl>`;

/** An IFRS-DK instance: ÅRL general data plus ifrs-full/ifrs-dk facts, parent figures under SeparateMember. */
const ifrsDkInstance = `<?xml version="1.0" encoding="UTF-8"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:link="http://www.xbrl.org/2003/linkbase"
    xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:iso4217="http://www.iso.org/4217"
    xmlns:gsd="http://xbrl.dcca.dk/gsd" xmlns:cmn="http://xbrl.dcca.dk/cmn"
    xmlns:ifrs-full="http://xbrl.ifrs.org/taxonomy/2014-03-05/ifrs-full" xmlns:ifrs-dk="http://xbrl.dcca.dk/ifrs-dk-cor_2021-12-20">
  <link:schemaRef xlink:type="simple" xlink:href="http://archprod.service.eogs.dk/taxonomy/20211220/ifrs/entry-ifrs-dk_03_IS-ByFunction_SFP-CurrentNoncurrent_OCI-BeforeTax_CF-IndirectMethod_2021-12-20.xsd"/>
  ${CONTEXT("cy", duration("2021-01-01", "2021-12-31"))}
  ${CONTEXT("cy-end", instant("2021-12-31"))}
  ${CONTEXT("cy-sep", duration("2021-01-01", "2021-12-31"), SEPARATE)}
  ${CONTEXT("cy-end-sep", instant("2021-12-31"), SEPARATE)}
  <xbrli:unit id="DKK"><xbrli:measure>iso4217:DKK</xbrli:measure></xbrli:unit>
  <gsd:ReportingPeriodStartDate contextRef="cy">2021-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="cy">2021-12-31</gsd:ReportingPeriodEndDate>
  <ifrs-full:Assets contextRef="cy-end" unitRef="DKK" decimals="-6">9330000000</ifrs-full:Assets>
  <ifrs-full:Assets contextRef="cy-end-sep" unitRef="DKK" decimals="-6">5445000000</ifrs-full:Assets>
  <ifrs-full:InvestmentsInSubsidiaries contextRef="cy-end-sep" unitRef="DKK" decimals="-6">2100000000</ifrs-full:InvestmentsInSubsidiaries>
  <ifrs-dk:CurrentReceivablesFromSubsidaries contextRef="cy-end-sep" unitRef="DKK" decimals="-6">300000000</ifrs-dk:CurrentReceivablesFromSubsidaries>
  <ifrs-dk:NetSales contextRef="cy" unitRef="DKK" decimals="-6">13400000000</ifrs-dk:NetSales>
  <ifrs-full:ProfitLoss contextRef="cy" unitRef="DKK" decimals="-6">417000000</ifrs-full:ProfitLoss>
  <ifrs-full:ProfitLoss contextRef="cy-sep" unitRef="DKK" decimals="-6">331000000</ifrs-full:ProfitLoss>
</xbrli:xbrl>`;

/** The figure-less ÅRL instance IFRS filers submit next to the ESEF instance. */
const stubInstance = `<?xml version="1.0" encoding="UTF-8"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:link="http://www.xbrl.org/2003/linkbase"
    xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xbrldi="http://xbrl.org/2006/xbrldi"
    xmlns:gsd="http://xbrl.dcca.dk/gsd" xmlns:cmn="http://xbrl.dcca.dk/cmn" xmlns:fsa="http://xbrl.dcca.dk/fsa">
  <link:schemaRef xlink:type="simple" xlink:href="http://archprod.service.eogs.dk/taxonomy/20241001/entryDanishGAAPExcludingBalanceSheetIncomeStatementIncludingManagementsReview20241001.xsd"/>
  ${CONTEXT("cy", duration("2025-01-01", "2025-12-31"), member("cmn:ConsolidatedSoloDimension", "cmn:ConsolidatedMember"))}
  <gsd:ReportingPeriodStartDate contextRef="cy">2025-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="cy">2025-12-31</gsd:ReportingPeriodEndDate>
  <gsd:NameOfReportingEntity contextRef="cy">Example A/S</gsd:NameOfReportingEntity>
</xbrli:xbrl>`;

/** A full ÅRL instance for the parent company, as some IFRS groups file next to ESEF. */
const parentAarlInstance = `<?xml version="1.0" encoding="UTF-8"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:link="http://www.xbrl.org/2003/linkbase"
    xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:iso4217="http://www.iso.org/4217"
    xmlns:gsd="http://xbrl.dcca.dk/gsd" xmlns:fsa="http://xbrl.dcca.dk/fsa">
  <link:schemaRef xlink:type="simple" xlink:href="http://archprod.service.eogs.dk/taxonomy/20241001/entryDanishGAAPBalanceSheetAccountFormIncomeStatementByNatureIncludingManagementsReviewStatisticsAndTax20241001.xsd"/>
  ${CONTEXT("cy", duration("2025-01-01", "2025-12-31"))}
  ${CONTEXT("cy-end", instant("2025-12-31"))}
  <xbrli:unit id="DKK"><xbrli:measure>iso4217:DKK</xbrli:measure></xbrli:unit>
  <gsd:ReportingPeriodStartDate contextRef="cy">2025-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="cy">2025-12-31</gsd:ReportingPeriodEndDate>
  <fsa:Assets contextRef="cy-end" unitRef="DKK" decimals="0">1183000000</fsa:Assets>
  <fsa:LiabilitiesAndEquity contextRef="cy-end" unitRef="DKK" decimals="0">1183000000</fsa:LiabilitiesAndEquity>
  <fsa:Equity contextRef="cy-end" unitRef="DKK" decimals="0">963000000</fsa:Equity>
  <fsa:ProfitLoss contextRef="cy" unitRef="DKK" decimals="0">108000000</fsa:ProfitLoss>
</xbrli:xbrl>`;

const document = (dokumentType: string, xmlText: string) => ({
    dokumentUrl: `http://regnskaber.virk.dk/${dokumentType}.xml`,
    dokumentMimeType: "application/xml",
    dokumentType,
    xmlText,
});

describe("XBRLDocument.getStandard", () => {
    it("recognises an ESEF instance by its ifrs-full facts, not its schemaRef", () => {
        const info = new XBRLDocument(esefInstance("")).getStandard();
        assert.equal(info.standard, "ESEF");
        assert.equal(info.generalDataOnly, false);
    });

    it("recognises an IFRS-DK instance by the ifrs-dk namespace", () => {
        assert.equal(new XBRLDocument(ifrsDkInstance).getStandard().standard, "IFRS-DK");
    });

    it("tells the general-data stub apart from an ÅRL report", () => {
        assert.deepEqual(new XBRLDocument(stubInstance).getStandard(), {
            standard: "ÅRL",
            schemaRef:
                "http://archprod.service.eogs.dk/taxonomy/20241001/entryDanishGAAPExcludingBalanceSheetIncomeStatementIncludingManagementsReview20241001.xsd",
            generalDataOnly: true,
        });
        assert.equal(new XBRLDocument(parentAarlInstance).getStandard().generalDataOnly, false);
    });
});

describe("ESEF extraction", () => {
    it("reads undimensioned facts as the group's figures, infers the period from the contexts, and ignores equity components", () => {
        const { report } = new XBRLDocument(esefInstance("")).extractTaxonomyData();

        assert.equal(report.standard, "ESEF");
        assert.equal(report.scope, "consolidated");
        assert.equal(report.soloStandard, null);
        assert.deepEqual(report.reportingPeriod, { reportingPeriodStartDate: "2025-01-01", reportingPeriodEndDate: "2025-12-31" });
        assert.deepEqual(report.balancesheet, {});
        assert.equal(report.consolidated?.balancesheet.assets?.value, 24644000000);
        // The ComponentsOfEquityAxis fact (retained earnings) must not replace total equity.
        assert.equal(report.consolidated?.balancesheet.equity?.value, 3542000000);
        assert.equal(report.consolidated?.balancesheet.liabilitiesOtherThanProvisions?.value, 21102000000);
        assert.equal(report.consolidated?.balancesheet.liabilitiesAndEquity?.value, 24644000000);
        assert.equal(report.consolidated?.incomeStatement.revenue?.value, 17300000000);
        assert.equal(report.consolidated?.incomeStatement.profitLoss?.value, 494000000);
        assert.equal(report.consolidated?.balancesheet.assets?.label, "Aktiver");
        assert.equal(report.unit, "EUR");
    });

    it("falls back to the registry's period when the contexts cannot tell", () => {
        const xml = esefInstance("").replace(/<xbrli:context id="cy">[\s\S]*?<\/xbrli:context>/, "").replace(/<xbrli:context id="py">[\s\S]*?<\/xbrli:context>/, "");
        const { report } = new XBRLDocument(xml).extractTaxonomyData({ reportingPeriod: { startDate: "2025-01-01", endDate: "2025-12-31" } });
        assert.equal(report.reportingPeriod.reportingPeriodEndDate, "2025-12-31");
    });

    it("puts SeparateMember facts on the solo side", () => {
        const xml = esefInstance(
            `<ifrs-full:Assets contextRef="cy-end-sep" unitRef="EUR" decimals="-6">5000000000</ifrs-full:Assets>`,
            CONTEXT("cy-end-sep", instant("2025-12-31"), SEPARATE),
        );
        const { report } = new XBRLDocument(xml).extractTaxonomyData();
        assert.equal(report.scope, "both");
        assert.equal(report.soloStandard, "ESEF");
        assert.equal(report.balancesheet.assets?.value, 5000000000);
        assert.equal(report.consolidated?.balancesheet.assets?.value, 24644000000);
    });

    it("lists tagged subsidiaries as group entities", () => {
        const subsidiary = member("ifrs-full:SubsidiariesAxis", "vws:SubsidiaryOneMember");
        const xml = esefInstance(
            `<ifrs-full:NameOfSubsidiary contextRef="cy-sub">Example Wind Systems GmbH</ifrs-full:NameOfSubsidiary>
             <ifrs-full:ProportionOfOwnershipInterestInSubsidiary contextRef="cy-sub" unitRef="pure" decimals="2">1</ifrs-full:ProportionOfOwnershipInterestInSubsidiary>
             <ifrs-full:CountryOfIncorporationOrResidenceOfSubsidiary contextRef="cy-sub">Tyskland</ifrs-full:CountryOfIncorporationOrResidenceOfSubsidiary>
             <xbrli:unit id="pure"><xbrli:measure>xbrli:pure</xbrli:measure></xbrli:unit>`,
            CONTEXT("cy-sub", duration("2025-01-01", "2025-12-31"), subsidiary),
        );
        const { report } = new XBRLDocument(xml).extractTaxonomyData();
        assert.deepEqual(
            report.groupEntitiesFromNotes.map((e) => [e.name, e.ownershipPercentage, e.country, e.relation, e.source]),
            [["Example Wind Systems GmbH", 100, "Tyskland", "subsidiary", "structured"]],
        );
    });
});

describe("IFRS-DK extraction", () => {
    it("reads the parent under SeparateMember and the group without a dimension, with Danish labels and ifrs-dk concepts", () => {
        const { report } = new XBRLDocument(ifrsDkInstance).extractTaxonomyData();

        assert.equal(report.standard, "IFRS-DK");
        assert.equal(report.scope, "both");
        assert.equal(report.soloStandard, "IFRS-DK");
        assert.equal(report.reportingPeriod.reportingPeriodEndDate, "2021-12-31");
        assert.equal(report.balancesheet.assets?.value, 5445000000);
        assert.equal(report.balancesheet.longtermInvestmentsInGroupEnterprises?.value, 2100000000);
        assert.equal(report.balancesheet.shorttermReceivablesFromGroupEnterprises?.value, 300000000);
        assert.equal(report.balancesheet.shorttermReceivablesFromGroupEnterprises?.label, "Kortfristede tilgodehavender hos datterselskaber");
        assert.equal(report.incomeStatement.profitLoss?.value, 331000000);
        assert.equal(report.consolidated?.balancesheet.assets?.value, 9330000000);
        assert.equal(report.consolidated?.incomeStatement.revenue?.value, 13400000000);
        assert.equal(report.consolidated?.incomeStatement.profitLoss?.value, 417000000);
    });
});

describe("AnnualReportService.assembleFiling", () => {
    const extract = (dokumentType: string, xml: string) => {
        const doc = document(dokumentType, xml);
        return { document: doc, result: AnnualReportService.extractAnnualReportFromXML(xml) };
    };

    it("drops the general-data stub when the ESEF instance was read", () => {
        const { reports, skipped } = AnnualReportService.assembleFiling([
            extract("AARSRAPPORT", stubInstance),
            extract("AARSRAPPORT_ESEF", esefInstance("")),
        ]);
        assert.equal(reports.length, 1);
        assert.equal(reports[0].report.standard, "ESEF");
        assert.equal(skipped.length, 0);
    });

    it("reports a stub on its own, so the caller learns that the figures are elsewhere", () => {
        const { reports, skipped } = AnnualReportService.assembleFiling([extract("AARSRAPPORT", stubInstance)]);
        assert.equal(reports.length, 0);
        assert.equal(skipped.length, 1);
        assert.match(skipped[0].result.message, /stamdata/);
    });

    it("takes the parent company's ÅRL statements as the solo side of an ESEF report", () => {
        const { reports } = AnnualReportService.assembleFiling([
            extract("AARSRAPPORT", parentAarlInstance),
            extract("AARSRAPPORT_ESEF", esefInstance("")),
        ]);
        assert.equal(reports.length, 1);
        const report = reports[0].report;
        assert.equal(report.standard, "ESEF");
        assert.equal(report.scope, "both");
        assert.equal(report.soloStandard, "ÅRL");
        assert.equal(report.balancesheet.assets?.value, 1183000000);
        assert.equal(report.incomeStatement.profitLoss?.value, 108000000);
        assert.equal(report.consolidated?.balancesheet.assets?.value, 24644000000);
    });

    it("keeps an ordinary ÅRL filing as it was", () => {
        const { reports, skipped } = AnnualReportService.assembleFiling([extract("AARSRAPPORT", parentAarlInstance)]);
        assert.equal(reports.length, 1);
        assert.equal(reports[0].report.standard, "ÅRL");
        assert.equal(reports[0].report.scope, "solo");
        assert.equal(skipped.length, 0);
    });
});
