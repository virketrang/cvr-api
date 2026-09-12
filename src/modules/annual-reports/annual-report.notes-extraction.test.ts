import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseColumnList, parseInvestmentProse, parseTables } from "./annual-report.notes-extraction.js";

/** Real note texts (textContent of the XBRL note element) from filings sampled in September 2026. */
const pick = (entities: ReturnType<typeof parseColumnList>) =>
    entities.map((e) => [e.name, e.registeredOffice, e.country, e.ownershipPercentage, e.relation] as const);

describe("parseColumnList — glued column lists in Danish investment notes", () => {
    it("Navn/Hjemsted/Ejerandel then amounts: share before the numeric columns", () => {
        const text = "NavnHjemstedEjerandelEgenkapitalÅrets resultatThouber Tax-Free Cars A/SOdense100%4.142.3312.063.371";
        assert.deepEqual(pick(parseColumnList(text, "DisclosureOfInvestments", null)), [
            ["Thouber Tax-Free Cars A/S", "Odense", null, 100, null],
        ]);
    });

    it("Hjemsted/Retsform/Ejerandel% with a bare share and no separators at all", () => {
        const text =
            "Regnskabsmæssig værdi ultimo40.915.067Kapitalandele i dattervirksomhederHjemstedRetsformEjerandel%Blichfeld Ejendomme A/SKoldingA/S100";
        assert.deepEqual(pick(parseColumnList(text, "DisclosureOfInvestments", null)), [
            ["Blichfeld Ejendomme A/S", "Kolding", null, 100, "subsidiary"],
        ]);
    });

    it("amount columns glued to the share, section labels and several rows", () => {
        const text =
            "Kapitalandele i dattervirksomheder (tkr.) Navn og hjemstedEgenkapitalÅrets resultatEjerandel Nicon Industries A/S, Esbjerg 87.34539.891100 % EOWS ApS, Sæby 12.4501.696100 % Nicon Sperlingvej ApS, Esbjerg --100 % Kapitalandele i associerede virksomheder (tkr.) Navn og hjemstedEgenkapitalÅrets resultatEjerandel E Electric ApS, Esbjerg 12.9585.75640 % E Electric Real Estate ApS, Esbjerg 48850 %";
        const rows = pick(parseColumnList(text, "DisclosureOfInvestments", null));
        assert.deepEqual(rows.slice(0, 3), [
            ["Nicon Industries A/S", "Esbjerg", null, 100, "subsidiary"],
            ["EOWS ApS", "Sæby", null, 100, "subsidiary"],
            ["Nicon Sperlingvej ApS", "Esbjerg", null, 100, "subsidiary"],
        ]);
        // The associates follow a second header in the same note.
        assert.ok(rows.some((r) => r[0] === "E Electric ApS" && r[3] === 40 && r[4] === "associate"));
        assert.ok(rows.some((r) => r[0] === "E Electric Real Estate ApS" && r[3] === 50 && r[4] === "associate"));
    });

    it("section labels set the relation; foreign and branch rows keep their names", () => {
        const text =
            "Kapitalandele - fortsat -Navn og hjemsted:EjerandelDattervirksomheder:HESAH Holding A/S, Nørresundby67%HESA Ejendomme A/S, Nørresundby100%N.R.G. Neue renovierungs Gesellschaft mbH, Berlin67%Associerede virksomheder:Tversted Ferieby A/S, Sindal33%";
        assert.deepEqual(pick(parseColumnList(text, "DisclosureOfInvestments", null)), [
            ["HESAH Holding A/S", "Nørresundby", null, 67, "subsidiary"],
            ["HESA Ejendomme A/S", "Nørresundby", null, 100, "subsidiary"],
            ["N.R.G. Neue renovierungs Gesellschaft mbH", "Berlin", null, 67, "subsidiary"],
            ["Tversted Ferieby A/S", "Sindal", null, 33, "associate"],
        ]);
    });

    it("city and country in the office cell, decimal comma shares", () => {
        const text =
            "Navn Hjemsted Ejerandel Tilknyttede virksomheder: DAVA Foods Denmark A/S Hadsund, Danmark 100,0% DAVA Foods Sweden AB Skara, Sverige 100,0% DAVA Foods Norway AS Larvik, Norge 100,0%";
        assert.deepEqual(pick(parseColumnList(text, "DisclosureOfInvestments", null)), [
            ["DAVA Foods Denmark A/S", "Hadsund", "Danmark", 100, "subsidiary"],
            ["DAVA Foods Sweden AB", "Skara", "Sverige", 100, "subsidiary"],
            ["DAVA Foods Norway AS", "Larvik", "Norge", 100, "subsidiary"],
        ]);
    });

    it("names without a legal form, share capital before the share, amounts after", () => {
        const text =
            "NavnHjemstedSelskabskapitalEjerandelEgenkapitalÅrets resultatSTM Entreprise ApSBornholm225.000100%14.850.5513.264.560Kofoed EjendommeBornholm200.000100%2.671.444445.523";
        assert.deepEqual(pick(parseColumnList(text, "DisclosureOfInvestments", null)), [
            ["STM Entreprise ApS", "Bornholm", null, 100, null],
            ["Kofoed Ejendomme", "Bornholm", null, 100, null],
        ]);
    });

    it("a single row with a spaced share", () => {
        const text = "Kapitalandele i dattervirksomheder Navn og hjemstedEjerandel BPC Holding A/S, Esbjerg 52 %";
        assert.deepEqual(pick(parseColumnList(text, "DisclosureOfInvestments", null)), [["BPC Holding A/S", "Esbjerg", null, 52, "subsidiary"]]);
    });

    it("kapitalinteresser label and a name without legal form", () => {
        const text =
            "Navn og hjemsted:EjerandelEgenkapital DKKÅrets resultat DKKKapitalinteresser:J-Maskiner, Rødekro10%15.018.9335.918.998";
        assert.deepEqual(pick(parseColumnList(text, "DisclosureOfInvestments", null)), [["J-Maskiner", "Rødekro", null, 10, "associate"]]);
    });

    it("drops the reporting company's own share-less row when it is glued to the first subsidiary", () => {
        const text =
            "Konsoliderede virksomhederHjemsted EjerandelQ-Interline A/S DanmarkQ-Interline GmbH Tyskland 100%Q-Interline SARL Frankrig 100%Q-Interline Inc. USA 100%Note 5 Færdige udviklingsprojekter";
        const rows = pick(parseColumnList(text, "DisclosureOfIntangibleAssets", null));
        assert.deepEqual(rows.map((r) => [r[0], r[2], r[3]]), [
            ["Q-Interline GmbH", "Tyskland", 100],
            ["Q-Interline SARL", "Frankrig", 100],
            ["Q-Interline Inc.", "USA", 100],
        ]);
    });

    it("reads a voting-rights column that follows the share", () => {
        const text = "Navn Hjemsted Ejerandel Stemmeandel Alpha ApS Aarhus 60 % 75 % Beta ApS Odense 40 % 25 %";
        const rows = parseColumnList(text, "DisclosureOfInvestments", null).map((e) => [e.name, e.ownershipPercentage, e.votingRightsPercentage]);
        assert.deepEqual(rows, [
            ["Alpha ApS", 60, 75],
            ["Beta ApS", 40, 25],
        ]);
    });

    it("ignores accounting-policy prose that merely mentions ejerandel", () => {
        const text =
            "Kapitalandele i dattervirksomheder indregnes og måles efter indre værdis metode. I balancen indregnes under posten “Kapitalandele i dattervirksomheder” den forholdsmæssige ejerandel af virksomhedernes regnskabsmæssige indre værdi.";
        assert.deepEqual(parseColumnList(text, "DescriptionOfMethods", null), []);
    });
});

describe("parseInvestmentProse", () => {
    it("finds names after 'kapitalandele i' and 'datterselskaberne'", () => {
        const text =
            "Nicon Holding A/S har erhvervet kapitalandele i E Electric ApS i årets løb. Moderselskabet har afgivet selvskyldnerkaution for datterselskaberne Nicon Industries A/S, EOWS ApS' samt Nicon Energy A/S' engagement.";
        const names = parseInvestmentProse(text, "DisclosureOfInvestments", null).map((e) => [e.name, e.relation]);
        assert.deepEqual(names, [
            ["E Electric ApS", null],
            ["Nicon Industries A/S", "subsidiary"],
        ]);
    });
});

describe("parseTables — bundled name cells", () => {
    it("splits 'Name, City' and 'Name, CVR nnnnnnnn' out of a 'Navn, retsform og hjemsted' cell", () => {
        const html =
            "<table><tr><th>Navn, retsform og hjemsted</th><th>Ejerandel</th><th>Egenkapital</th></tr>" +
            "<tr><td>Høvegaard ApS, Ringsted</td><td>100%</td><td>1.000</td></tr>" +
            "<tr><td>BIKEMEDIA ApS, CVR 36026626</td><td>100 %</td><td>2.000</td></tr></table>";
        const rows = parseTables(html, "DisclosureOfInvestments", null).map((e) => [e.name, e.registeredOffice, e.cvrNumber, e.ownershipPercentage]);
        assert.deepEqual(rows, [
            ["Høvegaard ApS", "Ringsted", null, 100],
            ["BIKEMEDIA ApS", null, "36026626", 100],
        ]);
    });
});
