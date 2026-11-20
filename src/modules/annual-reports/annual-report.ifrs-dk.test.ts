import { describe, it } from "node:test";
import assert from "node:assert/strict";

import XBRLDocument from "./annual-report.utils.js";
import { residualOf } from "../../validation/concept-tree.js";
import { withinTolerance } from "../../validation/tolerance.js";
import type { AccountSection } from "../../validation/types.js";

/**
 * An IFRS-DK instance with the parent company's balance sheet only (the
 * SeparateMember side), as the 2014 IFRS-DK taxonomy and the company's own
 * extension are filed. `facts` are [qname, amount in EUR] at the year end.
 */
const instance = (year: number, facts: Array<[string, number]>) => {
    const separate = `<xbrli:scenario><xbrldi:explicitMember dimension="ifrs-full:ConsolidatedAndSeparateFinancialStatementsAxis">ifrs-full:SeparateMember</xbrldi:explicitMember></xbrli:scenario>`;
    const entity = `<xbrli:entity><xbrli:identifier scheme="http://www.dcca.dk/cvr">18351331</xbrli:identifier></xbrli:entity>`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:link="http://www.xbrl.org/2003/linkbase"
    xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
    xmlns:gsd="http://xbrl.dcca.dk/gsd" xmlns:ifrs-full="http://xbrl.ifrs.org/taxonomy/2014-03-05/ifrs-full"
    xmlns:ifrs-dk="http://xbrl.dcca.dk/ifrs-dk-cor_2014-12-20">
  <link:schemaRef xlink:type="simple" xlink:href="http://archprod.service.eogs.dk/taxonomy/extension/EEAS_20200513/EEAS_entry_20200513.xsd"/>
  <xbrli:context id="cy">${entity}<xbrli:period><xbrli:startDate>${year}-01-01</xbrli:startDate><xbrli:endDate>${year}-12-31</xbrli:endDate></xbrli:period></xbrli:context>
  <xbrli:context id="end-sep">${entity}<xbrli:period><xbrli:instant>${year}-12-31</xbrli:instant></xbrli:period>${separate}</xbrli:context>
  <xbrli:unit id="EUR"><xbrli:measure>iso4217:EUR</xbrli:measure></xbrli:unit>
  <gsd:ReportingPeriodStartDate contextRef="cy">${year}-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="cy">${year}-12-31</gsd:ReportingPeriodEndDate>
  ${facts.map(([qname, value]) => `<${qname} contextRef="end-sep" decimals="-3" unitRef="EUR">${value}</${qname}>`).join("\n  ")}
</xbrli:xbrl>`;
};

const balanceSheetOf = (year: number, facts: Array<[string, number]>) =>
    new XBRLDocument(instance(year, facts)).extractTaxonomyData().report.balancesheet as unknown as AccountSection;

/**
 * The parent company's non-current assets in the annual reports of CVR
 * 18351331 (a public test company) for 2016-2019, as filed. Before the fix the
 * subsidiary loans, the non-current trade receivables and the other
 * investments were dropped, and the parts fell 54-161 million short.
 */
const FILED: Record<number, Array<[string, number]>> = {
    2016: [
        ["ifrs-full:PropertyPlantAndEquipment", 107000],
        ["ifrs-full:InvestmentsInSubsidiaries", 27060000],
        ["ifrs-full:InvestmentsInJointVentures", 5424000],
        ["ifrs-full:InvestmentsInAssociates", 4984000],
        ["ifrs-full:NoncurrentTradeReceivables", 6331000],
        ["ifrs-dk:NoncurrentReceivablesFromSubsidaries", 47811000],
        ["ifrs-full:NoncurrentReceivablesDueFromRelatedParties", 17076000],
        ["ifrs-full:DeferredTaxAssets", 995000],
        ["ifrs-dk:OtherNoncurrentInvestments", 446000],
        ["ifrs-full:NoncurrentAssets", 110234000],
    ],
    2017: [
        ["ifrs-full:PropertyPlantAndEquipment", 253000],
        ["ifrs-full:InvestmentsInSubsidiaries", 42396000],
        ["ifrs-full:InvestmentsInJointVentures", 8215000],
        ["ifrs-full:InvestmentsInAssociates", 4713000],
        ["ifrs-full:NoncurrentTradeReceivables", 5739000],
        ["ifrs-dk:NoncurrentReceivablesFromSubsidaries", 57928000],
        ["ifrs-full:NoncurrentReceivablesDueFromRelatedParties", 14239000],
        ["ifrs-full:DeferredTaxAssets", 995000],
        ["ifrs-dk:OtherNoncurrentInvestments", 327000],
        ["ifrs-full:NoncurrentAssets", 134805000],
    ],
    2018: [
        ["ifrs-full:PropertyPlantAndEquipment", 906000],
        ["ifrs-full:InvestmentsInSubsidiaries", 54345000],
        ["ifrs-full:InvestmentsInJointVentures", 10304000],
        ["ifrs-full:InvestmentsInAssociates", 3802000],
        ["ifrs-full:NoncurrentTradeReceivables", 3813000],
        ["ifrs-dk:NoncurrentReceivablesFromSubsidaries", 79014000],
        ["ifrs-full:NoncurrentReceivablesDueFromRelatedParties", 31522000],
        ["ifrs-full:DeferredTaxAssets", 935000],
        ["ifrs-dk:OtherNoncurrentInvestments", 2473000],
        ["ifrs-full:NoncurrentAssets", 187114000],
    ],
    2019: [
        ["ifrs-full:PropertyPlantAndEquipment", 897000],
        ["ifrs-full:InvestmentsInSubsidiaries", 73189000],
        ["ifrs-full:InvestmentsInJointVentures", 9129000],
        ["ifrs-full:InvestmentsInAssociates", 4402000],
        ["ifrs-full:NoncurrentTradeReceivables", 1269000],
        ["ifrs-dk:NoncurrentReceivablesFromSubsidaries", 157534000],
        ["ifrs-full:NoncurrentReceivablesDueFromRelatedParties", 34358000],
        ["ifrs-full:OtherNoncurrentReceivables", 2867000],
        ["ifrs-full:DeferredTaxAssets", 968000],
        ["ifrs-dk:OtherNoncurrentInvestments", 2471000],
        ["ifrs-full:NoncurrentAssets", 287084000],
    ],
};

describe("IFRS-DK non-current receivables and investments (CVR 18351331)", () => {
    for (const [year, facts] of Object.entries(FILED)) {
        it(`${year}: the parts of nonCurrentAssets add up to the reported total`, () => {
            const balancesheet = balanceSheetOf(Number(year), facts);
            assert.equal(residualOf(balancesheet, "nonCurrentAssets", 1000, withinTolerance), undefined);
        });
    }

    it("2019: places each amount on its ÅRL line", () => {
        const balancesheet = balanceSheetOf(2019, FILED[2019]);
        // Subsidiaries 157,534 plus the related parties tagged beside them, 34,358.
        assert.equal(balancesheet.longtermReceivablesFromGroupEnterprises?.value, 191892000);
        // Other receivables 2,867 plus non-current trade receivables 1,269.
        assert.equal(balancesheet.otherLongtermReceivables?.value, 4136000);
        assert.equal(balancesheet.otherLongtermInvestments?.value, 2471000);
    });

    it("reads receivables from related parties as the branch total when it is one", () => {
        // Filed the IFRS-DK way: related parties 50 is the total of subsidiaries 30
        // and associates 20, so group enterprises get 30 and associates keep 20.
        const balancesheet = balanceSheetOf(2019, [
            ["ifrs-dk:NoncurrentReceivablesFromSubsidaries", 30000],
            ["ifrs-dk:NoncurrentReceivablesFromAssociates", 20000],
            ["ifrs-full:NoncurrentReceivablesDueFromRelatedParties", 50000],
            ["ifrs-full:NoncurrentAssets", 50000],
        ]);
        assert.equal(balancesheet.longtermReceivablesFromGroupEnterprises?.value, 30000);
        assert.equal(balancesheet.longtermReceivablesFromAssociates?.value, 20000);
        assert.equal(residualOf(balancesheet, "nonCurrentAssets", 1000, withinTolerance), undefined);
    });

    it("keeps related parties as group enterprises when nothing else is tagged", () => {
        const balancesheet = balanceSheetOf(2019, [["ifrs-full:NoncurrentReceivablesDueFromRelatedParties", 40000]]);
        assert.equal(balancesheet.longtermReceivablesFromGroupEnterprises?.value, 40000);
    });
});
