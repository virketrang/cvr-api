import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    attributeValueAt,
    bandOf,
    buildOwnershipHistory,
    deriveEvents,
    latestDayIn,
    membershipOf,
    overlapsWindow,
    participantRoleOf,
    stintsOf,
    valueAt,
} from "./corporate-group.periods.js";
import CorporateGroupService from "./corporate-group.service.js";
import type { Attribute, Virksomhed } from "./corporate-group.types.js";

const dated = (gyldigFra: string, gyldigTil: string | null, vaerdi: string, sidstOpdateret = "2020-01-01T00:00:00.000+01:00") => ({
    vaerdi,
    periode: { gyldigFra, gyldigTil },
    sidstOpdateret,
});

describe("valueAt", () => {
    const values = [dated("2016-07-25", "2018-10-22", "1.0"), dated("2018-10-23", null, "0.5")];

    it("returns the currently valid entry when asOf is null", () => {
        assert.equal(valueAt(values, null)?.vaerdi, "0.5");
    });

    it("returns the entry whose inclusive period contains the date", () => {
        assert.equal(valueAt(values, "2017-01-01")?.vaerdi, "1.0");
        assert.equal(valueAt(values, "2018-10-22")?.vaerdi, "1.0");
        assert.equal(valueAt(values, "2018-10-23")?.vaerdi, "0.5");
        assert.equal(valueAt(values, "2030-01-01")?.vaerdi, "0.5");
    });

    it("returns undefined before the first period or when nothing applies", () => {
        assert.equal(valueAt(values, "2016-07-24"), undefined);
        assert.equal(valueAt(undefined, "2017-01-01"), undefined);
        assert.equal(valueAt([dated("2016-01-01", "2016-12-31", "1.0")], null), undefined);
    });

    it("lets the most recently updated entry win when corrected registrations overlap", () => {
        const overlapping = [
            dated("2016-01-01", null, "0.5", "2019-01-01T00:00:00.000+01:00"),
            dated("2016-01-01", null, "1.0", "2021-01-01T00:00:00.000+01:00"),
        ];
        assert.equal(valueAt(overlapping, "2020-06-01")?.vaerdi, "1.0");
    });

    it("tolerates registry timestamps with a time zone suffix", () => {
        const values = [dated("2016-07-25T00:00:00.000+02:00", "2018-10-22T00:00:00.000+02:00", "1.0")];
        assert.equal(valueAt(values, "2018-10-22")?.vaerdi, "1.0");
    });
});

describe("attributeValueAt", () => {
    const attributter: Attribute[] = [
        { sekvensnr: 0, type: "KAPITAL", vaerditype: "decimal", vaerdier: [dated("2010-01-01", "2019-12-31", "80000"), dated("2020-01-01", null, "400000")] },
    ];

    it("reads the attribute as of a date, or now", () => {
        assert.equal(attributeValueAt(attributter, "KAPITAL", "2015-05-05"), "80000");
        assert.equal(attributeValueAt(attributter, "KAPITAL", null), "400000");
        assert.equal(attributeValueAt(attributter, "FORMÅL", null), null);
    });
});

describe("bandOf", () => {
    it("widens the registry's lower bound to its band and marks only 100 pct. as accurate", () => {
        assert.deepEqual(bandOf(0.5), { interval: { from: 0.5, to: 0.6666 }, accurate: false });
        assert.deepEqual(bandOf(1), { interval: { from: 1, to: 1 }, accurate: true });
        assert.deepEqual(bandOf(null), { interval: { from: null, to: null }, accurate: false });
    });
});

describe("buildOwnershipHistory / membershipOf", () => {
    const ownership = [dated("2018-10-23", null, "0.5"), dated("2016-07-25", "2018-10-22", "1.0")];
    const voting = [dated("2016-07-25", "2018-10-22", "1.0"), dated("2018-10-23", null, "0.6667")];
    const notices = [dated("2016-07-25", "2018-10-22", "2016-07-01"), dated("2018-10-23", null, "2018-10-15")];

    it("yields one chronological segment per ownership value with matching voting rights and notice date", () => {
        const history = buildOwnershipHistory(ownership, voting, notices);
        assert.deepEqual(
            history.map((s) => [s.from, s.to, s.noticeDate, s.ownershipPercentage.interval.from, s.votingRightsPercentage.interval.from]),
            [
                ["2016-07-25", "2018-10-22", "2016-07-01", 1, 1],
                ["2018-10-23", null, "2018-10-15", 0.5, 0.6667],
            ],
        );
    });

    it("spans membership from the first value to null while still owned, else to the last end", () => {
        assert.deepEqual(membershipOf(buildOwnershipHistory(ownership, voting, notices)), { from: "2016-07-25", to: null });
        assert.deepEqual(membershipOf(buildOwnershipHistory([ownership[1]], voting, notices)), { from: "2016-07-25", to: "2018-10-22" });
        assert.equal(membershipOf([]), null);
    });
});

describe("CorporateGroupService.mapSubsidiary", () => {
    const parentCvr = 37888508;

    /** A registry document shaped like the probe: owned 100 pct. by the parent 2016-07-25..2018-10-22, then sold. */
    const virksomhed = {
        cvrNummer: 37889644,
        navne: [
            { navn: "Gammelt Navn ApS", periode: { gyldigFra: "2016-07-01", gyldigTil: "2017-12-31" }, sidstOpdateret: null },
            { navn: "Silkeborg Bilservice ApS", periode: { gyldigFra: "2018-01-01", gyldigTil: null }, sidstOpdateret: null },
        ],
        binavne: [],
        livsforloeb: [{ periode: { gyldigFra: "2016-07-01", gyldigTil: null }, sidstOpdateret: "" }],
        virksomhedsform: [{ virksomhedsformkode: 80, kortBeskrivelse: "APS", langBeskrivelse: "Anpartsselskab", periode: { gyldigFra: "2016-07-01", gyldigTil: null } }],
        virksomhedsstatus: [],
        hovedbranche: [],
        beliggenhedsadresse: [],
        attributter: [],
        fusioner: [],
        spaltninger: [],
        virksomhedMetadata: { nyesteNavn: { navn: "Silkeborg Bilservice ApS" } },
        deltagerRelation: [
            {
                deltager: { enhedstype: "VIRKSOMHED", forretningsnoegle: parentCvr },
                organisationer: [
                    {
                        hovedtype: "REGISTER",
                        organisationsNavn: [{ navn: "EJERREGISTER" }],
                        medlemsData: [
                            {
                                attributter: [
                                    { type: "EJERANDEL_PROCENT", vaerdier: [dated("2016-07-25", "2018-10-22", "1.0")] },
                                    { type: "EJERANDEL_STEMMERET_PROCENT", vaerdier: [dated("2016-07-25", "2018-10-22", "1.0")] },
                                    { type: "EJERANDEL_MEDDELELSE_DATO", vaerdier: [dated("2016-07-25", "2018-10-22", "2016-07-25")] },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    } as unknown as Virksomhed;

    it("is not a subsidiary as of now, because the ownership has ended", () => {
        assert.equal(CorporateGroupService.mapSubsidiary(virksomhed, parentCvr), null);
    });

    it("is a subsidiary as of a date inside the ownership period, with the name it had then", () => {
        const company = CorporateGroupService.mapSubsidiary(virksomhed, parentCvr, { asOf: "2017-06-30", history: false, window: null, includeFullyLiable: false });
        assert.equal(company?.name, "Gammelt Navn ApS");
        assert.equal(company?.ownershipPercentage.interval.from, 1);
        assert.equal(company?.votingRightsPercentage.accurate, true);
        assert.equal(company?.corporateForm.abbreviation, "APS");
        assert.equal(company?.dateOfDissolution, null);
        assert.equal(company?.ownershipHistory, undefined);
    });

    it("adds ownershipHistory and membership when history is requested", () => {
        const company = CorporateGroupService.mapSubsidiary(virksomhed, parentCvr, { asOf: "2017-06-30", history: true, window: null, includeFullyLiable: false });
        assert.deepEqual(company?.membership, { from: "2016-07-25", to: "2018-10-22" });
        assert.equal(company?.ownershipHistory?.length, 1);
        assert.equal(company?.ownershipHistory?.[0].noticeDate, "2016-07-25");
    });

    it("is not a subsidiary of a company that was never its owner", () => {
        assert.equal(CorporateGroupService.mapSubsidiary(virksomhed, 11111111, { asOf: "2017-06-30", history: true, window: null, includeFullyLiable: false }), null);
    });
});

describe("stintsOf / latestDayIn / overlapsWindow", () => {
    it("merges overlapping and adjacent ranges and keeps gaps apart", () => {
        assert.deepEqual(
            stintsOf([
                { from: "2018-10-23", to: null },
                { from: "2016-07-25", to: "2018-10-22" },
                { from: "2012-01-01", to: "2013-06-30" },
            ]),
            [
                { from: "2012-01-01", to: "2013-06-30" },
                { from: "2016-07-25", to: null },
            ],
        );
    });

    it("finds the last day inside the window on which a stint applied", () => {
        const stints = [{ from: "2016-07-25", to: "2018-10-22" }];
        const window = { from: "2017-01-01", to: "2019-12-31" };
        assert.equal(latestDayIn(stints, window), "2018-10-22");
        assert.equal(latestDayIn(stints, { from: "2017-01-01", to: "2017-12-31" }), "2017-12-31");
        assert.equal(latestDayIn(stints, { from: "2019-01-01", to: "2019-12-31" }), null);
        assert.equal(overlapsWindow({ from: "2016-07-25", to: null }, window), true);
    });
});

describe("deriveEvents", () => {
    const window = { from: "2022-01-01", to: "2024-12-31" };
    const segment = (from: string, to: string | null, share: number, votes = share) => ({
        from,
        to,
        noticeDate: from,
        ownershipPercentage: bandOf(share),
        votingRightsPercentage: bandOf(votes),
    });

    it("emits JOINED, OWNERSHIP_CHANGED, LEFT and DISSOLVED inside the window, in date order", () => {
        const history = [segment("2022-03-01", "2023-05-31", 0.5), segment("2023-06-01", "2024-06-30", 1)];
        const events = deriveEvents(stintsOf(history), history, window, "2024-08-15");
        assert.deepEqual(
            events.map((e) => [e.date, e.type]),
            [
                ["2022-03-01", "JOINED"],
                ["2023-06-01", "OWNERSHIP_CHANGED"],
                ["2024-06-30", "LEFT"],
                ["2024-08-15", "DISSOLVED"],
            ],
        );
        assert.equal(events[1].before?.ownershipPercentage.interval.from, 0.5);
        assert.equal(events[1].after?.ownershipPercentage.interval.from, 1);
    });

    it("stays silent for a company that was in the group throughout with no change", () => {
        const history = [segment("2015-01-01", null, 1)];
        assert.deepEqual(deriveEvents(stintsOf(history), history, window, null), []);
    });

    it("treats a re-registration with the same bands as no change", () => {
        const history = [segment("2015-01-01", "2023-01-31", 1), segment("2023-02-01", null, 1)];
        assert.deepEqual(deriveEvents(stintsOf(history), history, window, null), []);
    });

    it("reports a change in voting rights alone", () => {
        const history = [segment("2015-01-01", "2023-01-31", 0.5, 0.5), segment("2023-02-01", null, 0.5, 0.6667)];
        assert.deepEqual(deriveEvents(stintsOf(history), history, window, null).map((e) => e.type), ["OWNERSHIP_CHANGED"]);
    });
});

describe("participantRoleOf", () => {
    it("names the role by legal form", () => {
        assert.equal(participantRoleOf("K/S", false, true), "KOMPLEMENTAR");
        assert.equal(participantRoleOf("K/S", true, false), "KOMMANDITIST");
        assert.equal(participantRoleOf("K/S", true, true), "KOMPLEMENTAR_OG_KOMMANDITIST");
        assert.equal(participantRoleOf("P/S", true, false), "KOMMANDITAKTIONÆR");
        assert.equal(participantRoleOf("I/S", false, true), "INTERESSENT");
        assert.equal(participantRoleOf("ApS", true, false), null);
        assert.equal(participantRoleOf("ApS", false, true), "FULDT_ANSVARLIG_DELTAGER");
    });
});

describe("CorporateGroupService.mapSubsidiary — period view and roles", () => {
    const parentCvr = 26337364;
    const window = { from: "2022-01-01", to: "2024-12-31" };

    /** A K/S where the parent is komplementar throughout and held a 50 pct. share 2020..2023-06-30. */
    const ks = {
        cvrNummer: 26882494,
        navne: [{ navn: "K/S BYTOFTEN 2002", periode: { gyldigFra: "2002-01-01", gyldigTil: null }, sidstOpdateret: null }],
        binavne: [],
        livsforloeb: [{ periode: { gyldigFra: "2002-01-01", gyldigTil: null }, sidstOpdateret: "" }],
        virksomhedsform: [{ virksomhedsformkode: 40, kortBeskrivelse: "K/S", langBeskrivelse: "Kommanditselskab", periode: { gyldigFra: "2002-01-01", gyldigTil: null } }],
        virksomhedsstatus: [],
        hovedbranche: [],
        beliggenhedsadresse: [],
        attributter: [],
        fusioner: [],
        spaltninger: [],
        virksomhedMetadata: { nyesteNavn: { navn: "K/S BYTOFTEN 2002" } },
        deltagerRelation: [
            {
                deltager: { enhedstype: "VIRKSOMHED", forretningsnoegle: parentCvr },
                organisationer: [
                    {
                        hovedtype: "FULDT_ANSVARLIG_DELTAGERE",
                        organisationsNavn: [{ navn: "Interessenter" }],
                        medlemsData: [{ attributter: [{ type: "FUNKTION", vaerdier: [dated("2002-01-01", null, "INTERESSENTER")] }] }],
                    },
                    {
                        hovedtype: "REGISTER",
                        organisationsNavn: [{ navn: "EJERREGISTER" }],
                        medlemsData: [
                            {
                                attributter: [
                                    { type: "EJERANDEL_PROCENT", vaerdier: [dated("2020-01-01", "2023-06-30", "0.5")] },
                                    { type: "EJERANDEL_STEMMERET_PROCENT", vaerdier: [dated("2020-01-01", "2023-06-30", "0.5")] },
                                    { type: "EJERANDEL_MEDDELELSE_DATO", vaerdier: [dated("2020-01-01", "2023-06-30", "2019-12-15")] },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    } as unknown as Virksomhed;

    const base = { asOf: null, history: false, window: null, includeFullyLiable: false };

    it("is out of the group today by ownership alone, but in it as komplementar when fully liable relations count", () => {
        assert.equal(CorporateGroupService.mapSubsidiary(ks, parentCvr, base), null);
        const company = CorporateGroupService.mapSubsidiary(ks, parentCvr, { ...base, includeFullyLiable: true });
        assert.equal(company?.participantRole, "KOMPLEMENTAR");
        assert.equal(company?.fullyLiable, true);
        assert.equal(company?.ownershipPercentage.interval.from, null);
    });

    it("was komplementar and kommanditist while the share was held", () => {
        const company = CorporateGroupService.mapSubsidiary(ks, parentCvr, { ...base, asOf: "2022-06-30" });
        assert.equal(company?.participantRole, "KOMPLEMENTAR_OG_KOMMANDITIST");
        assert.equal(company?.ownershipPercentage.interval.from, 0.5);
    });

    it("period view: included because the share touched the window, read as of the last owned day, with events", () => {
        const company = CorporateGroupService.mapSubsidiary(ks, parentCvr, { ...base, window });
        assert.equal(company?.ownershipPercentage.interval.from, 0.5);
        assert.deepEqual(company?.membership, { from: "2020-01-01", to: "2023-06-30" });
        assert.deepEqual(company?.events?.map((e) => [e.date, e.type]), [["2023-06-30", "LEFT"]]);
        assert.equal(company?.ownershipHistory?.length, 1);
    });

    it("period view: not included when the share ended before the window", () => {
        assert.equal(CorporateGroupService.mapSubsidiary(ks, parentCvr, { ...base, window: { from: "2024-01-01", to: "2024-12-31" } }), null);
    });

    it("period view with fully liable relations: membership never ends, so no events", () => {
        const company = CorporateGroupService.mapSubsidiary(ks, parentCvr, { ...base, window, includeFullyLiable: true });
        assert.deepEqual(company?.membership, { from: "2002-01-01", to: null });
        assert.equal(company?.participantRole, "KOMPLEMENTAR");
        assert.deepEqual(company?.events, []);
    });
});
