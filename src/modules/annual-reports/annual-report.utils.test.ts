import { describe, it } from "node:test";
import assert from "node:assert/strict";

import XBRLDocument from "./annual-report.utils.js";

/** A minimal ÅRL instance: contexts and facts are supplied by each test. */
const instance = (contexts: string, facts: string) => `<?xml version="1.0" encoding="UTF-8"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance"
    xmlns:link="http://www.xbrl.org/2003/linkbase"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xbrldi="http://xbrl.org/2006/xbrldi"
    xmlns:iso4217="http://www.iso.org/4217"
    xmlns:gsd="http://xbrl.dcca.dk/gsd"
    xmlns:cmn="http://xbrl.dcca.dk/cmn"
    xmlns:fsa="http://xbrl.dcca.dk/fsa">
  <link:schemaRef xlink:type="simple" xlink:href="http://archprod.service.eogs.dk/taxonomy/20241001/entryDanishGAAPBalanceSheetAccountFormIncomeStatementByNatureIncludingManagementsReviewStatisticsAndTax20241001.xsd"/>
  ${contexts}
  <xbrli:unit id="DKK"><xbrli:measure>iso4217:DKK</xbrli:measure></xbrli:unit>
  <xbrli:unit id="pure"><xbrli:measure>xbrli:pure</xbrli:measure></xbrli:unit>
  ${facts}
</xbrli:xbrl>`;

const context = (id: string, period: string, dimensions = "") => `
  <xbrli:context id="${id}">
    <xbrli:entity><xbrli:identifier scheme="http://www.dcca.dk/cvr">12345678</xbrli:identifier></xbrli:entity>
    <xbrli:period>${period}</xbrli:period>
    ${dimensions ? `<xbrli:scenario>${dimensions}</xbrli:scenario>` : ""}
  </xbrli:context>`;

const duration = (from: string, to: string) => `<xbrli:startDate>${from}</xbrli:startDate><xbrli:endDate>${to}</xbrli:endDate>`;
const instant = (date: string) => `<xbrli:instant>${date}</xbrli:instant>`;
const member = (dimension: string, value: string) =>
    `<xbrldi:explicitMember dimension="${dimension}">${value}</xbrldi:explicitMember>`;

const REGISTERED_PERIOD = member(
    "gsd:TypeOfReportingPeriodDimension",
    "gsd:RegisteredReportingPeriodDeviatingFromReportedReportingPeriodDueArbitraryDatesMember",
);

describe("XBRLDocument.extractTaxonomyData — reporting period", () => {
    it("ignores the CVR-registered period when the financial year floats, even when it is tagged first", () => {
        // A company changing its year end: the accounting period is 1 Jan–30 Sep 2025,
        // the period registered in CVR is the calendar year. The registered dates come
        // first in the document, as they do in real filings.
        const xml = instance(
            context("registered", duration("2025-01-01", "2025-12-31"), REGISTERED_PERIOD) +
                context("actual", duration("2025-01-01", "2025-09-30")) +
                context("end", instant("2025-09-30")),
            `
  <gsd:ReportingPeriodStartDate contextRef="registered">2025-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="registered">2025-12-31</gsd:ReportingPeriodEndDate>
  <gsd:ReportingPeriodStartDate contextRef="actual">2025-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="actual">2025-09-30</gsd:ReportingPeriodEndDate>
  <fsa:Assets contextRef="end" unitRef="DKK" decimals="0">500000</fsa:Assets>
  <fsa:LiabilitiesAndEquity contextRef="end" unitRef="DKK" decimals="0">500000</fsa:LiabilitiesAndEquity>`,
        );

        const { report } = new XBRLDocument(xml).extractTaxonomyData();

        assert.deepEqual(report.reportingPeriod, {
            reportingPeriodStartDate: "2025-01-01",
            reportingPeriodEndDate: "2025-09-30",
        });
        // The balance sheet is read on the accounting period's end date.
        assert.equal(report.balancesheet.assets?.value, 500000);
    });

    it("accepts general data tagged only with the koncern marker, as the IFRS-era ÅRL stub does", () => {
        const xml = instance(
            context("general", duration("2025-01-01", "2025-12-31"), member("cmn:ConsolidatedSoloDimension", "cmn:ConsolidatedMember")),
            `
  <gsd:ReportingPeriodStartDate contextRef="general">2025-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="general">2025-12-31</gsd:ReportingPeriodEndDate>`,
        );

        const { report } = new XBRLDocument(xml).extractTaxonomyData();

        assert.equal(report.reportingPeriod.reportingPeriodEndDate, "2025-12-31");
    });

    it("still fails with MISSING_PERIOD when only a registered period is tagged", () => {
        const xml = instance(
            context("registered", duration("2025-01-01", "2025-12-31"), REGISTERED_PERIOD),
            `
  <gsd:ReportingPeriodStartDate contextRef="registered">2025-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="registered">2025-12-31</gsd:ReportingPeriodEndDate>`,
        );

        assert.throws(() => new XBRLDocument(xml).extractTaxonomyData(), /regnskabsperiode/);
    });
});

describe("XBRLDocument.extractTaxonomyData — duplicate facts", () => {
    it("takes the most precise of several facts for the same account and date", () => {
        // The primary statement shows the amount in thousands; a note carries the exact
        // figure. Both are undimensioned facts on the same instant.
        const xml = instance(
            context("period", duration("2025-01-01", "2025-12-31")) +
                context("end", instant("2025-12-31")) +
                context("end-note", instant("2025-12-31")),
            `
  <gsd:ReportingPeriodStartDate contextRef="period">2025-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="period">2025-12-31</gsd:ReportingPeriodEndDate>
  <fsa:Assets contextRef="end" unitRef="DKK" decimals="-3">1235000</fsa:Assets>
  <fsa:Assets contextRef="end-note" unitRef="DKK" decimals="0">1234567</fsa:Assets>
  <fsa:AverageNumberOfEmployees contextRef="period" unitRef="pure" decimals="0">12</fsa:AverageNumberOfEmployees>`,
        );

        const { report } = new XBRLDocument(xml).extractTaxonomyData();

        assert.equal(report.balancesheet.assets?.value, 1234567);
        assert.equal(report.notes.averageNumberOfEmployees?.value, 12);
        assert.equal(report.notes.averageNumberOfEmployees?.unit, "pure");
    });

    it("leaves facts with a rounding dimension out of the statements", () => {
        // ÅRL 2024 added ReportedValueOtherRenderingOfReportedValueDimension so a figure
        // can be stated twice with different rounding; the undimensioned fact is the one.
        const xml = instance(
            context("period", duration("2025-01-01", "2025-12-31")) +
                context("end", instant("2025-12-31")) +
                context(
                    "end-rounded",
                    instant("2025-12-31"),
                    member("fsa:ReportedValueOtherRenderingOfReportedValueDimension", "fsa:OtherRenderingOfReportedValueMember"),
                ),
            `
  <gsd:ReportingPeriodStartDate contextRef="period">2025-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="period">2025-12-31</gsd:ReportingPeriodEndDate>
  <fsa:Assets contextRef="end-rounded" unitRef="DKK" decimals="-3">1235000</fsa:Assets>
  <fsa:Assets contextRef="end" unitRef="DKK" decimals="0">1234567</fsa:Assets>`,
        );

        const { report } = new XBRLDocument(xml).extractTaxonomyData();

        assert.equal(report.balancesheet.assets?.value, 1234567);
    });
});

describe("XBRLDocument.extractTaxonomyData — extraordinary dividend paid", () => {
    const equityClass = (name: string) => member("fsa:ClassesOfEquityDimension", `fsa:${name}`);
    const CONSOLIDATED = member("cmn:ConsolidatedSoloDimension", "cmn:ConsolidatedMember");
    const YEAR = duration("2025-01-01", "2025-12-31");

    /** An ÅRL report for 2025 with the given extra contexts and equity-statement facts. */
    const report = (contexts: string, facts: string) =>
        new XBRLDocument(
            instance(
                context("cy", YEAR) + context("end", instant("2025-12-31")) + contexts,
                `
  <gsd:ReportingPeriodStartDate contextRef="cy">2025-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="cy">2025-12-31</gsd:ReportingPeriodEndDate>
  <fsa:Equity contextRef="end" unitRef="DKK" decimals="0">900000</fsa:Equity>
  ${facts}`,
            ),
        ).extractTaxonomyData().report;

    it("reads it from the dedicated equity column, positive whatever sign the filer used", () => {
        // The commonest pattern: the year's result is moved into the column and paid
        // out of it again, so the column — and the balance sheet — ends at zero.
        const { notes, balancesheet } = report(
            context("col", YEAR, equityClass("ProposedExtraordinaryDividendRecognisedInEquityMember")) +
                context("col-end", instant("2025-12-31"), equityClass("ProposedExtraordinaryDividendRecognisedInEquityMember")),
            `
  <fsa:ProfitLoss contextRef="col" unitRef="DKK" decimals="0">158800</fsa:ProfitLoss>
  <fsa:ExtraordinaryDividendPaid contextRef="col" unitRef="DKK" decimals="0">-158800</fsa:ExtraordinaryDividendPaid>
  <fsa:Equity contextRef="col-end" unitRef="DKK" decimals="0">0</fsa:Equity>`,
        );

        assert.deepEqual(notes.extraordinaryDividendPaid, { value: 158800, unit: "DKK", label: "Betalt ekstraordinært udbytte" });
        assert.equal(balancesheet.proposedExtraordinaryDividendRecognisedInEquity, undefined);
        assert.equal(balancesheet.equity.value, 900000);
    });

    it("prefers the line's own total and does not add a subtotal column to its parts", () => {
        const withTotal = report(
            context("retained", YEAR, equityClass("RetainedEarningsMember")),
            `
  <fsa:ExtraordinaryDividendPaid contextRef="cy" unitRef="DKK" decimals="0">1175757</fsa:ExtraordinaryDividendPaid>
  <fsa:ExtraordinaryDividendPaid contextRef="retained" unitRef="DKK" decimals="0">1175757</fsa:ExtraordinaryDividendPaid>`,
        );
        assert.equal(withTotal.notes.extraordinaryDividendPaid.value, 1175757);

        const withSubtotalColumn = report(
            context("retained", YEAR, equityClass("RetainedEarningsMember")) +
                context("parent", YEAR, equityClass("EquityAttributableToParentMember")),
            `
  <fsa:ExtraordinaryDividendPaid contextRef="retained" unitRef="DKK" decimals="0">2000000</fsa:ExtraordinaryDividendPaid>
  <fsa:ExtraordinaryDividendPaid contextRef="parent" unitRef="DKK" decimals="0">2000000</fsa:ExtraordinaryDividendPaid>`,
        );
        assert.equal(withSubtotalColumn.notes.extraordinaryDividendPaid.value, 2000000);
    });

    it("falls back to a dividend paid out of the dedicated column, but never out of another column", () => {
        const dedicated = report(
            context("col", YEAR, equityClass("ProposedExtraordinaryDividendRecognisedInEquityMember")),
            `<fsa:DividendPaid contextRef="col" unitRef="DKK" decimals="0">-146900</fsa:DividendPaid>`,
        );
        assert.equal(dedicated.notes.extraordinaryDividendPaid.value, 146900);

        // An ordinary dividend paid out of the proposed-dividend column is not extraordinary.
        const ordinary = report(
            context("col", YEAR, equityClass("ProposedDividendRecognisedInEquityMember")),
            `<fsa:DividendPaid contextRef="col" unitRef="DKK" decimals="0">-500000</fsa:DividendPaid>`,
        );
        assert.equal(ordinary.notes.extraordinaryDividendPaid, undefined);
    });

    it("keeps the parent's and the group's amounts apart", () => {
        const both = report(
            context("col", YEAR, equityClass("ProposedExtraordinaryDividendRecognisedInEquityMember")) +
                context("group-end", instant("2025-12-31"), CONSOLIDATED) +
                context("group-col", YEAR, CONSOLIDATED + equityClass("ProposedExtraordinaryDividendRecognisedInEquityMember")),
            `
  <fsa:Equity contextRef="group-end" unitRef="DKK" decimals="0">5000000</fsa:Equity>
  <fsa:ExtraordinaryDividendPaid contextRef="col" unitRef="DKK" decimals="0">300000</fsa:ExtraordinaryDividendPaid>
  <fsa:ExtraordinaryDividendPaid contextRef="group-col" unitRef="DKK" decimals="0">3000000</fsa:ExtraordinaryDividendPaid>`,
        );

        assert.equal(both.notes.extraordinaryDividendPaid.value, 300000);
        assert.equal(both.consolidated?.notes.extraordinaryDividendPaid.value, 3000000);
    });
});

describe("XBRLDocument.extractTaxonomyData — dividends in equity", () => {
    const YEAR = duration("2025-01-01", "2025-12-31");
    const distribution = (id: string) =>
        `<xbrldi:typedMember dimension="fsa:IdentificationOfExtraordinaryDividendDistributedAfterEndOfReportingDimension"><fsa:extraordinaryDividendDistributedAfterEndOfReportingIdentifier>${id}</fsa:extraordinaryDividendDistributedAfterEndOfReportingIdentifier></xbrldi:typedMember>`;

    const report = (contexts: string, facts: string) =>
        new XBRLDocument(
            instance(
                context("cy", YEAR) + context("end", instant("2025-12-31")) + contexts,
                `
  <gsd:ReportingPeriodStartDate contextRef="cy">2025-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="cy">2025-12-31</gsd:ReportingPeriodEndDate>
  <fsa:Equity contextRef="end" unitRef="DKK" decimals="0">1500000</fsa:Equity>
  <fsa:ContributedCapital contextRef="end" unitRef="DKK" decimals="0">500000</fsa:ContributedCapital>
  <fsa:RetainedEarnings contextRef="end" unitRef="DKK" decimals="0">800000</fsa:RetainedEarnings>
  <fsa:ProposedDividendRecognisedInEquity contextRef="end" unitRef="DKK" decimals="0">200000</fsa:ProposedDividendRecognisedInEquity>
  ${facts}`,
            ),
        ).extractTaxonomyData().report;

    it("reports the proposed dividend and the total distributed after the balance sheet date", () => {
        const { notes, dividendsInEquity } = report(
            "",
            `<fsa:ExtraordinaryDividendDistributedAfterEndOfReportingPeriodGross contextRef="cy" unitRef="DKK" decimals="0">300000</fsa:ExtraordinaryDividendDistributedAfterEndOfReportingPeriodGross>`,
        );

        assert.equal(notes.extraordinaryDividendDistributedAfterEndOfReportingPeriod.value, 300000);
        assert.equal(dividendsInEquity?.proposedDividend?.value, 200000);
        assert.equal(dividendsInEquity?.proposedDividend?.status, "inEquity");
        assert.equal(dividendsInEquity?.extraordinaryDividend, null);
        assert.equal(dividendsInEquity?.extraordinaryDividendAfterBalanceSheetDate?.value, 300000);
    });

    it("adds up the individual distributions when the total is not tagged", () => {
        const { notes, dividendsInEquity } = report(
            context("first", YEAR, distribution("1")) + context("second", YEAR, distribution("2")),
            `
  <fsa:ExtraordinaryDividendDistributedAfterEndOfReportingPeriod contextRef="first" unitRef="DKK" decimals="0">100000</fsa:ExtraordinaryDividendDistributedAfterEndOfReportingPeriod>
  <fsa:ExtraordinaryDividendDistributedAfterEndOfReportingPeriod contextRef="second" unitRef="DKK" decimals="0">250000</fsa:ExtraordinaryDividendDistributedAfterEndOfReportingPeriod>`,
        );

        assert.equal(notes.extraordinaryDividendDistributedAfterEndOfReportingPeriod.value, 350000);
        assert.equal(dividendsInEquity?.extraordinaryDividendAfterBalanceSheetDate?.value, 350000);
    });
});

describe("XBRLDocument.extractTaxonomyData — investment property at fair value", () => {
    const YEAR = duration("2025-01-01", "2025-12-31");
    const report = (facts: string) =>
        new XBRLDocument(
            instance(
                context("cy", YEAR) + context("end", instant("2025-12-31")),
                `
  <gsd:ReportingPeriodStartDate contextRef="cy">2025-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="cy">2025-12-31</gsd:ReportingPeriodEndDate>
  <fsa:Equity contextRef="end" unitRef="DKK" decimals="0">5000000</fsa:Equity>
  ${facts}`,
            ),
        ).extractTaxonomyData().report;

    it("reads fair value from the accounting policy", () => {
        const { propertiesAtFairValue } = report(`
  <fsa:InvestmentProperty contextRef="end" unitRef="DKK" decimals="0">8000000</fsa:InvestmentProperty>
  <fsa:DescriptionOfMethodsOfRecognitionAndMeasurementBasisOfInvestmentProperty contextRef="cy">Investeringsejendomme måles efter første indregning til dagsværdi.</fsa:DescriptionOfMethodsOfRecognitionAndMeasurementBasisOfInvestmentProperty>`);
        assert.equal(propertiesAtFairValue, true);
    });

    it("reads fair value from a tagged adjustment line, also when it is zero", () => {
        const { propertiesAtFairValue } = report(`
  <fsa:InvestmentProperty contextRef="end" unitRef="DKK" decimals="0">8000000</fsa:InvestmentProperty>
  <fsa:GainsLossesFromCurrentValueAdjustmentsOfInvestmentProperty contextRef="cy" unitRef="DKK" decimals="0">0</fsa:GainsLossesFromCurrentValueAdjustmentsOfInvestmentProperty>`);
        assert.equal(propertiesAtFairValue, true);
    });

    it("is null without investment property, whatever the policy says", () => {
        const { propertiesAtFairValue } = report(`
  <fsa:LandAndBuildings contextRef="end" unitRef="DKK" decimals="0">3000000</fsa:LandAndBuildings>
  <fsa:DescriptionOfMethodsOfRecognitionAndMeasurementBasisOfInvestmentProperty contextRef="cy">Investeringsejendomme måles til dagsværdi.</fsa:DescriptionOfMethodsOfRecognitionAndMeasurementBasisOfInvestmentProperty>`);
        assert.equal(propertiesAtFairValue, null);
    });
});
