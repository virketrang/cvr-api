import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";

import XBRLDocument from "./annual-report.utils.js";
import { parseExtensionPackage } from "./annual-report.extension.js";
import { applyExtensionPackage, setUnmappedFacts, unmappedFactsOf, type UnmappedFact } from "./annual-report.unmapped.js";
import type { Account, AnnualReport } from "./annual-report.types.js";
import { readZip } from "../../utils/zip.js";
import { runValidation } from "../../validation/registry.js";

/** A minimal zip archive: the first file stored, the rest deflated. */
function zip(files: Record<string, string>): Uint8Array {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;
    Object.entries(files).forEach(([name, text], index) => {
        const raw = Buffer.from(text, "utf8");
        const method = index === 0 ? 0 : 8;
        const data = method === 0 ? raw : deflateRawSync(raw);
        const nameBytes = Buffer.from(name, "utf8");
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(method, 8);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(raw.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(method, 10);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(raw.length, 24);
        central.writeUInt16LE(nameBytes.length, 28);
        central.writeUInt32LE(offset, 42);
        locals.push(local, nameBytes, data);
        centrals.push(central, nameBytes);
        offset += 30 + nameBytes.length + data.length;
    });
    const directory = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(Object.keys(files).length, 8);
    end.writeUInt16LE(Object.keys(files).length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    return new Uint8Array(Buffer.concat([...locals, directory, end]));
}

// The company's extension package as filed for 2015 (shortened).
const EXTENSION = {
    "Euro/Euro_entry.xsd": `<xsd:schema targetNamespace="http://www.easyx.dk/XBRL">
  <xsd:element name="EasyX_1530104987" id="Euro_EasyX_1530104987" type="xbrli:monetaryItemType" xbrli:balance="debit" xbrli:periodType="instant" />
  <xsd:element name="EasyX_287448517" id="Euro_EasyX_287448517" type="xbrli:monetaryItemType" xbrli:balance="credit" xbrli:periodType="instant" />
  <xsd:element name="EasyX_636917438" id="Euro_EasyX_636917438" type="xbrli:monetaryItemType" xbrli:balance="credit" xbrli:periodType="duration" />
</xsd:schema>`,
    "Euro/Euro_lab.xml": `<link:linkbase><link:labelLink>
  <link:loc xlink:href="Euro_entry.xsd#Euro_EasyX_1530104987" xlink:label="l1"/>
  <link:label xlink:label="t1en" xlink:role="http://www.xbrl.org/2003/role/label" xml:lang="en">non-current loans to subsidiaries</link:label>
  <link:label xlink:label="t1da" xlink:role="http://www.xbrl.org/2003/role/label" xml:lang="da">langfristede lån til datterselskaber</link:label>
  <link:labelArc xlink:from="l1" xlink:to="t1en"/><link:labelArc xlink:from="l1" xlink:to="t1da"/>
</link:labelLink></link:linkbase>`,
    "Euro/Euro_pre.xml": `<link:linkbase>
  <link:presentationLink xlink:role="http://xbrl.dcca.dk/ifrs-dk/role/StatementOfFinancialPositionCurrentNonCurrent">
    <link:loc xlink:href="Euro_entry.xsd#Euro_EasyX_1530104987" xlink:label="a"/>
    <link:loc xlink:href="Euro_entry.xsd#Euro_EasyX_287448517" xlink:label="b"/>
  </link:presentationLink>
  <link:presentationLink xlink:role="http://xbrl.dcca.dk/ifrs-dk/role/IncomeStatementByNatureOfExpense">
    <link:loc xlink:href="Euro_entry.xsd#Euro_EasyX_636917438" xlink:label="c"/>
  </link:presentationLink>
</link:linkbase>`,
};

describe("readZip / parseExtensionPackage", () => {
    it("reads stored and deflated entries", () => {
        const files = readZip(zip({ "a.txt": "stored", "dir/b.txt": "deflated æøå" }));
        assert.equal(files.get("a.txt")?.toString("utf8"), "stored");
        assert.equal(files.get("dir/b.txt")?.toString("utf8"), "deflated æøå");
    });

    it("gives each extension element its Danish label, balance side and whether it is in the balance sheet", () => {
        const concepts = parseExtensionPackage(readZip(zip(EXTENSION)));
        assert.deepEqual(concepts.get("http://www.easyx.dk/XBRL#EasyX_1530104987"), {
            label: "langfristede lån til datterselskaber",
            balance: "debit",
            inBalanceSheet: true,
        });
        assert.equal(concepts.get("http://www.easyx.dk/XBRL#EasyX_636917438")?.inBalanceSheet, false);
    });
});

describe("XBRLDocument.unmappedBalanceFacts", () => {
    it("lists extension amounts and standard balance sheet amounts no field reads, nothing else", () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:link="http://www.xbrl.org/2003/linkbase"
    xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
    xmlns:gsd="http://xbrl.dcca.dk/gsd" xmlns:ifrs-full="http://xbrl.ifrs.org/taxonomy/2014-03-05/ifrs-full"
    xmlns:ifrs-dk="http://xbrl.dcca.dk/ifrs-dk-cor_2014-12-20" xmlns:easyx="http://www.easyx.dk/XBRL">
  <link:schemaRef xlink:type="simple" xlink:href="http://archprod.service.eogs.dk/taxonomy/extension/Euro_20160503/Euro_entry_20160503.xsd"/>
  <xbrli:context id="cy"><xbrli:entity><xbrli:identifier scheme="http://www.dcca.dk/cvr">18351331</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:startDate>2015-01-01</xbrli:startDate><xbrli:endDate>2015-12-31</xbrli:endDate></xbrli:period></xbrli:context>
  <xbrli:context id="end"><xbrli:entity><xbrli:identifier scheme="http://www.dcca.dk/cvr">18351331</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>2015-12-31</xbrli:instant></xbrli:period><xbrli:scenario><xbrldi:explicitMember dimension="ifrs-full:ConsolidatedAndSeparateFinancialStatementsAxis">ifrs-full:SeparateMember</xbrldi:explicitMember></xbrli:scenario></xbrli:context>
  <xbrli:unit id="EUR"><xbrli:measure>iso4217:EUR</xbrli:measure></xbrli:unit>
  <gsd:ReportingPeriodStartDate contextRef="cy">2015-01-01</gsd:ReportingPeriodStartDate>
  <gsd:ReportingPeriodEndDate contextRef="cy">2015-12-31</gsd:ReportingPeriodEndDate>
  <ifrs-full:NoncurrentAssets contextRef="end" unitRef="EUR" decimals="-3">98912000</ifrs-full:NoncurrentAssets>
  <ifrs-full:NoncurrentPrepayments contextRef="end" unitRef="EUR" decimals="-3">1000000</ifrs-full:NoncurrentPrepayments>
  <easyx:EasyX_1530104987 contextRef="end" unitRef="EUR" decimals="-3">37122000</easyx:EasyX_1530104987>
</xbrli:xbrl>`;
        const { report } = new XBRLDocument(xml).extractTaxonomyData();
        const facts = unmappedFactsOf(report);
        assert.deepEqual(
            facts.map((fact) => [fact.concept, fact.value, fact.extension, fact.label, fact.balance]),
            [
                ["ifrs-full:NoncurrentPrepayments", 1000000, false, "Langfristede forudbetalinger", "debit"],
                ["easyx:EasyX_1530104987", 37122000, true, null, null],
            ],
        );
        // Not part of the response: the amounts stay out of the serialised report.
        assert.equal(JSON.stringify(report).includes("37122000"), false);

        applyExtensionPackage(report, parseExtensionPackage(readZip(zip(EXTENSION))));
        assert.equal(unmappedFactsOf(report)[1].label, "langfristede lån til datterselskaber");
        applyExtensionPackage(report, null);
        assert.deepEqual(
            unmappedFactsOf(report).map((fact) => fact.concept),
            ["ifrs-full:NoncurrentPrepayments"],
            "an extension element without its package is never used",
        );
    });
});

describe("BAL-003 explanation", () => {
    const report = (unmapped: Array<Partial<UnmappedFact>>): AnnualReport<Account> => {
        const account = (value: number) => ({ value, unit: "EUR", label: "" });
        const r = {
            reportingPeriod: { reportingPeriodStartDate: "2015-01-01", reportingPeriodEndDate: "2015-12-31" },
            standard: "IFRS-DK",
            scope: "solo",
            soloStandard: "IFRS-DK",
            unit: "EUR",
            balancesheet: {
                nonCurrentAssets: account(98912000),
                propertyPlantAndEquipment: account(99000),
                longtermInvestmentsInGroupEnterprises: account(26570000),
                longtermInvestmentsInAssociates: account(4515000),
                longtermInvestmentsInJointVentures: account(7125000),
                otherLongtermReceivables: account(5099000),
                nonCurrentDeferredTaxAssets: account(1496000),
            },
            incomeStatement: {},
            notes: {},
            groupEntitiesFromNotes: [],
            consolidatedFinancialStatements: [],
            consolidated: null,
            warnings: [],
            validation: [],
        } as unknown as AnnualReport<Account>;
        setUnmappedFacts(
            r,
            unmapped.map((fact) => ({ namespace: "x", name: "x", extension: true, unit: "EUR", label: null, balance: "debit", ...fact }) as UnmappedFact),
        );
        return r;
    };
    const bal003 = (r: AnnualReport<Account>) => {
        runValidation([r], new Set());
        return r.validation.find((finding) => finding.id === "BAL-003")?.message ?? "";
    };
    const LOANS = [
        { concept: "easyx:A", label: "Andre langsigtede investeringer", value: 448000 },
        { concept: "easyx:B", label: "langfristede lån til datterselskaber", value: 37122000 },
        { concept: "easyx:C", label: "langfristede lån til nærtstående parter", value: 16438000 },
    ];

    it("names the amounts that make up the deviation, as a note only", () => {
        const message = bal003(report([...LOANS, { concept: "easyx:Reserve", value: 16292000, balance: "credit" }]));
        assert.match(message, /afviger 54\.008\.000 EUR/);
        assert.match(message, /Forskellen svarer til 3 poster i årsrapporten, som ikke kan henføres sikkert/);
        assert.match(message, /"langfristede lån til datterselskaber" \(selskabets egen post, easyx:B\) 37\.122\.000 EUR/);
        assert.match(message, /I alt 54\.008\.000 EUR\.$/);
        assert.doesNotMatch(message, /Reserve/, "an amount on the other side of the balance sheet is never used");
    });

    it("gives no explanation when the amounts do not add up to the deviation, or when two combinations do", () => {
        assert.match(bal003(report(LOANS.slice(0, 2))), /Muligvis manglende underpost i udtrækket\.$/);
        assert.match(
            bal003(report([...LOANS, { concept: "easyx:D", value: 37122000 + 448000 }])),
            /Muligvis manglende underpost i udtrækket\.$/,
        );
    });
});
