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
