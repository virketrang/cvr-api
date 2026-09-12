import type {
    Attribute,
    Company,
    CorporateEventSource as RegistryEvent,
    DeltagerRelation,
    Owner,
    OwnershipSnapshot,
    Restructuring,
    CompanyAddress,
    CompanyFlattened,
    CorporateEvent,
    CorporateEventSource,
    CorporateGroup,
    CorporateGroupFlattened,
    DanishBusinessRegistrationCompanyAPIResponse,
    GroupLookupOptions,
    Virksomhed,
} from "./corporate-group.types.js";
import {
    attributeValueAt,
    bandOf,
    buildOwnershipHistory,
    deriveEvents,
    dissolutionReasonOf,
    isoDay,
    latestDayIn,
    membershipOf,
    overlapsWindow,
    participantRoleOf,
    stintsOf,
    toDecimal,
    valueAt,
    type DateRange,
} from "./corporate-group.periods.js";
import environment from "../../environment.js";
import AnnualReportService from "../annual-reports/annual-report.service.js";
import { normalizeEntityName } from "../annual-reports/annual-report.notes-extraction.js";
import { AppError, ErrorCode } from "../../utils/api-error.js";
import { basicAuthHeader, fetchUpstreamJson } from "../../utils/http.js";

const CVR_API_URL = "http://distribution.virk.dk/cvr-permanent/virksomhed/_search";

const NOW: GroupLookupOptions = { asOf: null, history: false, window: null, includeFullyLiable: false, dates: null };

/** Registry status texts that mean the company no longer exists. */
const DISSOLVED_STATUS = /OPLØST|SLETTET|TVANGSOPLØST|OPHØRT/i;

export default abstract class CorporateGroupService {
    /** Safely turns a date-ish string into an ISO string, or null if unparseable. */
    private static safeIsoDate(value: string | null | undefined): string | null {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    /** Maps a fusion/spaltning registry entry to the reduced shape the response exposes. */
    private static convertCorporateEvent(event: CorporateEventSource): CorporateEvent {
        const name = event.organisationsNavn[0]?.navn ?? null;
        const date =
            event.indgaaende
                .concat(event.udgaaende)
                .flatMap((attr) => attr.vaerdier)
                .map((value) => value.periode?.gyldigFra)
                .filter((from): from is string => Boolean(from))
                .sort()[0] ?? null;

        return {
            name,
            date,
            incoming: event.indgaaende.length > 0,
            outgoing: event.udgaaende.length > 0,
        };
    }

    /** The company's registered address on `asOf` (now when null), or null when none is registered. */
    private static extractAddress(virksomhed: Virksomhed, asOf: string | null): CompanyAddress | null {
        const address =
            valueAt(virksomhed.beliggenhedsadresse, asOf) ??
            (asOf === null ? virksomhed.virksomhedMetadata.nyesteBeliggenhedsadresse : undefined) ??
            null;

        if (!address) return null;

        return {
            street: address.vejnavn ?? null,
            houseNumberFrom: address.husnummerFra ?? null,
            houseNumberTo: address.husnummerTil ?? null,
            letterFrom: address.bogstavFra ?? null,
            letterTo: address.bogstavTil ?? null,
            floor: address.etage ?? null,
            sideDoor: address.sidedoer ?? null,
            coName: address.conavn ?? null,
            poBox: address.postboks ?? null,
            zipCode: address.postnummer ?? null,
            city: address.postdistrikt ?? null,
            municipality: address.kommune?.kommuneNavn ?? null,
            countryCode: address.landekode ?? null,
            freeText: address.fritekst ?? null,
        };
    }

    /** The company's incorporation date: the start of its first life period. */
    private static dateOfIncorporation(virksomhed: Virksomhed): string | null {
        const first = [...(virksomhed.livsforloeb ?? [])].sort((a, b) =>
            a.periode.gyldigFra.localeCompare(b.periode.gyldigFra),
        )[0];
        return CorporateGroupService.safeIsoDate(first?.periode?.gyldigFra ?? virksomhed.virksomhedMetadata.stiftelsesDato);
    }

    /** The registry's last status text when it says the company is gone, else null. */
    private static dissolutionStatus(virksomhed: Virksomhed): string | null {
        const statuses = [...(virksomhed.virksomhedsstatus ?? [])].sort((a, b) =>
            a.periode.gyldigFra.localeCompare(b.periode.gyldigFra),
        );
        const last = statuses[statuses.length - 1]?.status ?? virksomhed.virksomhedMetadata.sammensatStatus ?? null;
        return last && DISSOLVED_STATUS.test(last) ? last : null;
    }

    /**
     * The company's mergers and demergers as the registry records them, without
     * counterparts (those are resolved for the whole group in one query later).
     *
     * Flags as observed in the register: a party dissolved in the event carries
     * only "indgaaende"; a company created by a demerger carries only "udgaaende";
     * a continuing company carries both — which in a MERGER means it received the
     * others (the receiving company), and in a DEMERGER means it contributed a
     * branch and lived on (grenspaltning: the transferring company).
     */
    public static classifyRestructuringRole(
        type: Restructuring["type"],
        event: Pick<RegistryEvent, "indgaaende" | "udgaaende">,
    ): Restructuring["role"] {
        const inbound = event.indgaaende.length > 0;
        const outbound = event.udgaaende.length > 0;
        if (type === "MERGER") return outbound ? "RECEIVING" : "TRANSFERRING";
        return inbound ? "TRANSFERRING" : "RECEIVING";
    }

    private static ownRestructurings(virksomhed: Virksomhed): Restructuring[] {
        const dissolvedOn = CorporateGroupService.dateOfDissolution(virksomhed);
        const toRestructuring = (event: RegistryEvent, type: Restructuring["type"]): Restructuring => {
            const date = isoDay(CorporateGroupService.convertCorporateEvent(event).date);
            const role = CorporateGroupService.classifyRestructuringRole(type, event);
            return {
                eventId: event.enhedsNummerOrganisation,
                type,
                date,
                role,
                dissolved: role === "TRANSFERRING" && dissolvedOn !== null && date === dissolvedOn,
                counterparts: [],
            };
        };
        return [
            ...(virksomhed.fusioner ?? []).map((e) => toRestructuring(e, "MERGER")),
            ...(virksomhed.spaltninger ?? []).map((e) => toRestructuring(e, "DEMERGER")),
        ].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    }

    /** The end of the company's last life period, or null while it still exists. */
    private static dateOfDissolution(virksomhed: Virksomhed): string | null {
        const periods = virksomhed.livsforloeb ?? [];
        if (periods.length === 0 || periods.some((life) => life.periode.gyldigTil === null)) return null;
        return isoDay([...periods].map((life) => life.periode.gyldigTil as string).sort().at(-1));
    }

    /**
     * Extracts the company master data shared by the root company and every
     * subsidiary from the registry's Vrvirksomhed document, as it applied on
     * `asOf` (now when null), so both are computed by the same rules.
     */
    private static extractCompanyDetails(
        virksomhed: Virksomhed,
        asOf: string | null,
    ): Pick<
        Company,
        | "corporateForm"
        | "financialYear"
        | "dateOfIncorporation"
        | "dateOfDissolution"
        | "dissolutionReason"
        | "dissolutionStatus"
        | "restructurings"
        | "registerUpdatedAt"
        | "listed"
        | "purpose"
        | "hasShareClasses"
        | "status"
        | "mainIndustry"
        | "secondaryNames"
        | "demergers"
        | "mergers"
        | "address"
        | "capital"
        | "firstFinancialYear"
        | "audited"
        | "powerToBind"
    > {
        const attributter = virksomhed.attributter ?? [];
        const attribute = (type: string) => attributeValueAt(attributter, type, asOf);

        const corporateForm =
            valueAt(virksomhed.virksomhedsform, asOf) ??
            (asOf === null ? virksomhed.virksomhedMetadata.nyesteVirksomhedsform : undefined);

        const mainIndustry =
            valueAt(virksomhed.hovedbranche, asOf) ??
            (asOf === null ? virksomhed.virksomhedMetadata.nyesteHovedbranche : undefined) ??
            null;

        const status =
            valueAt(virksomhed.virksomhedsstatus, asOf)?.status ??
            (asOf === null ? virksomhed.virksomhedMetadata.sammensatStatus : undefined) ??
            null;

        const secondaryNames = (virksomhed.binavne ?? [])
            .filter((name) => (asOf === null ? name.periode.gyldigTil === null : valueAt([name], asOf) !== undefined))
            .map((name) => name.navn);

        const capitalValue = attribute("KAPITAL");

        return {
            corporateForm: {
                code: corporateForm?.virksomhedsformkode ?? null,
                name: corporateForm?.langBeskrivelse ?? null,
                abbreviation: corporateForm?.kortBeskrivelse ?? null,
            },
            financialYear: {
                startDate: attribute("REGNSKABSÅR_START"),
                endDate: attribute("REGNSKABSÅR_SLUT"),
            },
            dateOfIncorporation: CorporateGroupService.dateOfIncorporation(virksomhed),
            dateOfDissolution: CorporateGroupService.dateOfDissolution(virksomhed),
            dissolutionReason: dissolutionReasonOf(CorporateGroupService.dissolutionStatus(virksomhed)),
            dissolutionStatus: CorporateGroupService.dissolutionStatus(virksomhed),
            restructurings: CorporateGroupService.ownRestructurings(virksomhed),
            registerUpdatedAt: virksomhed.sidstOpdateret ?? null,
            listed: attribute("BØRSNOTERET") === "true",
            purpose: attribute("FORMÅL"),
            hasShareClasses: attribute("KAPITALKLASSER") === "true",
            status,
            mainIndustry: mainIndustry ? `${mainIndustry.branchekode} - ${mainIndustry.branchetekst}` : null,
            secondaryNames,
            demergers: (virksomhed.spaltninger ?? []).map(CorporateGroupService.convertCorporateEvent),
            mergers: (virksomhed.fusioner ?? []).map(CorporateGroupService.convertCorporateEvent),
            address: CorporateGroupService.extractAddress(virksomhed, asOf),
            capital: {
                value: capitalValue !== null ? parseFloat(capitalValue) : null,
                currency: attribute("KAPITALVALUTA"),
            },
            firstFinancialYear: {
                startDate: attribute("FØRSTE_REGNSKABSPERIODE_START"),
                endDate: attribute("FØRSTE_REGNSKABSPERIODE_SLUT"),
            },
            // Audit applies unless it has been explicitly opted out (REVISION_FRAVALGT = true).
            audited: attribute("REVISION_FRAVALGT") !== "true",
            powerToBind: attribute("TEGNINGSREGEL"),
        };
    }

    /** The company's name on `asOf` (now when null), falling back to the registry's newest name. */
    private static nameAt(virksomhed: Virksomhed, asOf: string | null): string | null {
        return valueAt(virksomhed.navne, asOf)?.navn ?? virksomhed.virksomhedMetadata.nyesteNavn?.navn ?? null;
    }

    /**
     * The attribute values of one type in the relation from `parentCvr` to this
     * company, within the organisation of the given hovedtype (and, for
     * REGISTER, the given register name).
     */
    private static relationValues(
        virksomhed: Virksomhed,
        parentCvr: number,
        hovedtype: string,
        type: string,
        registerName?: string,
    ): Attribute["vaerdier"] {
        const relation = virksomhed.deltagerRelation?.find(
            (candidate) => candidate.deltager?.forretningsnoegle === parentCvr,
        );

        return (relation?.organisationer ?? [])
            .filter(
                (org) =>
                    org.hovedtype === hovedtype &&
                    (registerName === undefined || org.organisationsNavn.some((name) => name.navn === registerName)),
            )
            .flatMap((org) => org.medlemsData ?? [])
            .flatMap((data) => data.attributter)
            .filter((attr) => attr.type === type)
            .flatMap((attr) => attr.vaerdier);
    }

    /** The EJERREGISTER attribute values of one type in the relation from `parentCvr` to this company. */
    private static ownerRegisterValues(virksomhed: Virksomhed, parentCvr: number, type: string): Attribute["vaerdier"] {
        return CorporateGroupService.relationValues(virksomhed, parentCvr, "REGISTER", type, "EJERREGISTER");
    }

    /** The periods in which `parentCvr` was registered as a fully liable participant (komplementar/interessent) of this company. */
    private static fullyLiableValues(virksomhed: Virksomhed, parentCvr: number): Attribute["vaerdier"] {
        return CorporateGroupService.relationValues(virksomhed, parentCvr, "FULDT_ANSVARLIG_DELTAGERE", "FUNKTION");
    }

    /** Attribute values of one type in one relation's organisations of a hovedtype (optionally a named register). */
    private static relationOrgValues(relation: DeltagerRelation, hovedtype: string, type: string, registerName?: string): Attribute["vaerdier"] {
        return (relation.organisationer ?? [])
            .filter(
                (org) =>
                    org.hovedtype === hovedtype &&
                    (registerName === undefined || org.organisationsNavn.some((name) => name.navn === registerName)),
            )
            .flatMap((org) => org.medlemsData ?? [])
            .flatMap((data) => data.attributter)
            .filter((attr) => attr.type === type)
            .flatMap((attr) => attr.vaerdier);
    }

    /**
     * Every owner registered for the company on `date` (now when null): legal
     * owners from Ejerregisteret and fully liable participants — companies,
     * persons and other participants alike. `inGroup` is filled in later, once
     * the whole group is known.
     */
    private static ownersAt(virksomhed: Virksomhed, date: string | null): Owner[] {
        const form = valueAt(virksomhed.virksomhedsform, date)?.kortBeskrivelse ?? virksomhed.virksomhedMetadata?.nyesteVirksomhedsform?.kortBeskrivelse ?? null;
        const owners: Owner[] = [];

        for (const relation of virksomhed.deltagerRelation ?? []) {
            const participant = relation.deltager;
            if (!participant) continue;

            const ownership = valueAt(CorporateGroupService.relationOrgValues(relation, "REGISTER", "EJERANDEL_PROCENT", "EJERREGISTER"), date);
            const voting = valueAt(CorporateGroupService.relationOrgValues(relation, "REGISTER", "EJERANDEL_STEMMERET_PROCENT", "EJERREGISTER"), date);
            const liable = valueAt(CorporateGroupService.relationOrgValues(relation, "FULDT_ANSVARLIG_DELTAGERE", "FUNKTION"), date) !== undefined;
            if (!ownership && !liable) continue;

            const isCompany = participant.enhedstype === "VIRKSOMHED" && participant.forretningsnoegle !== null;
            const name =
                valueAt(participant.navne, date)?.navn ??
                participant.navne?.[participant.navne.length - 1]?.navn ??
                (isCompany ? String(participant.forretningsnoegle) : "Ukendt deltager");

            owners.push({
                cvr: isCompany ? participant.forretningsnoegle : null,
                name,
                type: isCompany ? "COMPANY" : participant.enhedstype === "PERSON" ? "PERSON" : "OTHER",
                ownershipPercentage: bandOf(toDecimal(ownership?.vaerdi)),
                votingRightsPercentage: bandOf(toDecimal(voting?.vaerdi)),
                fullyLiable: liable,
                participantRole: participantRoleOf(form, ownership !== undefined, liable),
                inGroup: false,
            });
        }

        return owners.sort((a, b) => (b.ownershipPercentage.interval.from ?? -1) - (a.ownershipPercentage.interval.from ?? -1));
    }

    /**
     * Maps a registry document to the subsidiary it represents under `parentCvr`.
     *
     * Membership is an ownership registered in EJERREGISTER — and, with
     * `includeFullyLiable`, a fully liable participation (komplementar). As of a
     * date (`asOf`, now when null) the company is a subsidiary only if a
     * membership applied on that date. In the period view (`window`) it is one
     * if a membership touched the window at all; its values are then read as of
     * the last day it was in the group within the window, and events are derived.
     * Returns null when the company was not in the group.
     */
    public static mapSubsidiary(virksomhed: Virksomhed, parentCvr: number, options: GroupLookupOptions = NOW): Company | null {
        const { asOf, window, includeFullyLiable } = options;
        const history = options.history || window !== null;

        const ownership = CorporateGroupService.ownerRegisterValues(virksomhed, parentCvr, "EJERANDEL_PROCENT");
        const votingRights = CorporateGroupService.ownerRegisterValues(virksomhed, parentCvr, "EJERANDEL_STEMMERET_PROCENT");
        const noticeDates = CorporateGroupService.ownerRegisterValues(virksomhed, parentCvr, "EJERANDEL_MEDDELELSE_DATO");
        const fullyLiable = CorporateGroupService.fullyLiableValues(virksomhed, parentCvr);

        const toRange = (value: { periode: { gyldigFra: string; gyldigTil: string | null } }): DateRange => ({
            from: value.periode.gyldigFra,
            to: value.periode.gyldigTil,
        });
        const membershipRanges = [...ownership.map(toRange), ...(includeFullyLiable ? fullyLiable.map(toRange) : [])];
        const stints = stintsOf(membershipRanges);

        // The day the company's values are read as of.
        let effective: string | null;
        if (window) {
            const lastDay = latestDayIn(stints, window);
            if (lastDay === null) return null;
            effective = lastDay;
        } else {
            const ownedNow = valueAt(ownership, asOf) !== undefined;
            const liableNow = includeFullyLiable && valueAt(fullyLiable, asOf) !== undefined;
            if (!ownedNow && !liableNow) return null;
            effective = asOf;
        }

        const name = CorporateGroupService.nameAt(virksomhed, effective);
        const cvr = virksomhed.cvrNummer;

        if (!name || !cvr) {
            throw new AppError(
                ErrorCode.UPSTREAM_BAD_RESPONSE,
                "Et selskab i koncernstrukturen mangler navn eller CVR-nummer i registerets svar.",
            );
        }

        const details = CorporateGroupService.extractCompanyDetails(virksomhed, effective);
        const ownershipAt = valueAt(ownership, effective);
        const isOwner = ownershipAt !== undefined;
        const isFullyLiable = valueAt(fullyLiable, effective) !== undefined;

        const company: Company = {
            name,
            cvr,
            ownershipPercentage: bandOf(toDecimal(ownershipAt?.vaerdi)),
            votingRightsPercentage: bandOf(toDecimal(valueAt(votingRights, effective)?.vaerdi)),
            fullyLiable: isFullyLiable,
            participantRole: participantRoleOf(details.corporateForm.abbreviation, isOwner, isFullyLiable),
            retrievedAt: new Date().toISOString(),
            owners: CorporateGroupService.ownersAt(virksomhed, effective),
            ...details,
        };

        if (options.dates) {
            company.snapshots = options.dates.map((date): OwnershipSnapshot => {
                const owned = valueAt(ownership, date);
                const liable = valueAt(fullyLiable, date) !== undefined;
                const form = valueAt(virksomhed.virksomhedsform, date)?.kortBeskrivelse ?? details.corporateForm.abbreviation;
                return {
                    date,
                    member: owned !== undefined || (includeFullyLiable && liable),
                    ownershipPercentage: bandOf(toDecimal(owned?.vaerdi)),
                    votingRightsPercentage: bandOf(toDecimal(valueAt(votingRights, date)?.vaerdi)),
                    fullyLiable: liable,
                    participantRole: participantRoleOf(form, owned !== undefined, liable),
                    owners: CorporateGroupService.ownersAt(virksomhed, date),
                };
            });
        }

        if (history) {
            const fullHistory = buildOwnershipHistory(ownership, votingRights, noticeDates);
            company.ownershipHistory = window
                ? fullHistory.filter((segment) => overlapsWindow(segment, window))
                : fullHistory;
            company.membership =
                stints.length > 0 ? { from: stints[0].from, to: stints[stints.length - 1].to } : membershipOf(fullHistory);
        }

        if (window) {
            company.restructurings = company.restructurings.filter((r) => r.date !== null && overlapsWindow({ from: r.date, to: r.date }, window));
            company.events = deriveEvents(stints, company.ownershipHistory ?? [], window, details.dateOfDissolution);
        }

        return company;
    }

    private static async queryDanishBusinessRegistrationAPI(
        query: object,
    ): Promise<DanishBusinessRegistrationCompanyAPIResponse> {
        return fetchUpstreamJson<DanishBusinessRegistrationCompanyAPIResponse>(
            "Det offentlige register",
            CVR_API_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: basicAuthHeader(environment.CVR_API_USERNAME, environment.CVR_API_PASSWORD),
                },
                body: JSON.stringify(query),
            },
        );
    }

    private static async getCompanyFromTheDanishBusinessRegistrationAPI(
        cvrNumber: number,
    ): Promise<DanishBusinessRegistrationCompanyAPIResponse | null> {
        return await CorporateGroupService.queryDanishBusinessRegistrationAPI({
            query: {
                bool: {
                    must: [{ term: { "Vrvirksomhed.cvrNummer": cvrNumber } }],
                },
            },
        });
    }

    /**
     * Every company that has ever had `cvrNumber` registered as a legal owner
     * (EJERREGISTER with an EJERANDEL_PROCENT) or as a fully liable participant,
     * mapped per `options`. Companies outside the requested date/period (or
     * only fully liable when that is not requested) are dropped in the mapping.
     */
    public static async getCompanySubsidiariesFromDanishBusinessRegistrationAPI(
        cvrNumber: number,
        options: GroupLookupOptions = NOW,
    ): Promise<Array<Company>> {
        const companiesResponse = await CorporateGroupService.queryDanishBusinessRegistrationAPI({
            size: 500,
            query: {
                nested: {
                    path: "Vrvirksomhed.deltagerRelation",
                    query: {
                        bool: {
                            must: [
                                {
                                    match: {
                                        "Vrvirksomhed.deltagerRelation.deltager.forretningsnoegle": cvrNumber,
                                    },
                                },
                                {
                                    nested: {
                                        path: "Vrvirksomhed.deltagerRelation.organisationer",
                                        query: {
                                            bool: {
                                                should: [
                                                    // A legal owner (EJERREGISTER with an ownership share)...
                                                    {
                                                        bool: {
                                                            must: [
                                                                {
                                                                    match: {
                                                                        "Vrvirksomhed.deltagerRelation.organisationer.hovedtype":
                                                                            "REGISTER",
                                                                    },
                                                                },
                                                                {
                                                                    nested: {
                                                                        path: "Vrvirksomhed.deltagerRelation.organisationer.organisationsNavn",
                                                                        query: {
                                                                            match: {
                                                                                "Vrvirksomhed.deltagerRelation.organisationer.organisationsNavn.navn":
                                                                                    "EJERREGISTER",
                                                                            },
                                                                        },
                                                                    },
                                                                },
                                                                {
                                                                    nested: {
                                                                        path: "Vrvirksomhed.deltagerRelation.organisationer.medlemsData",
                                                                        query: {
                                                                            nested: {
                                                                                path: "Vrvirksomhed.deltagerRelation.organisationer.medlemsData.attributter",
                                                                                query: {
                                                                                    match: {
                                                                                        "Vrvirksomhed.deltagerRelation.organisationer.medlemsData.attributter.type":
                                                                                            "EJERANDEL_PROCENT",
                                                                                    },
                                                                                },
                                                                            },
                                                                        },
                                                                    },
                                                                },
                                                            ],
                                                        },
                                                    },
                                                    // ...or a fully liable participant (komplementar/interessent).
                                                    {
                                                        match: {
                                                            "Vrvirksomhed.deltagerRelation.organisationer.hovedtype":
                                                                "FULDT_ANSVARLIG_DELTAGERE",
                                                        },
                                                    },
                                                ],
                                                minimum_should_match: 1,
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        });

        return companiesResponse.hits.hits
            .map((hit) => CorporateGroupService.mapSubsidiary(hit._source.Vrvirksomhed, cvrNumber, options))
            .filter((company): company is Company => company !== null);
    }

    private static flattenCorporateGroup(
        company: CorporateGroup,
        level: number = 0,
        parent?: { name: string; cvr: number },
        seenEdges?: Set<string>,
    ): CompanyFlattened[] {
        let flattenedCompanies: CompanyFlattened[] = [];

        // Carry every Company field over; only the tree structure is replaced by level/parent.
        const { subsidiaries: _subsidiaries, ...companyFields } = company;

        // A company owned by several group members is reached by several paths; its
        // own subtree is the same every time, so each parent→child edge is listed once.
        seenEdges ??= new Set<string>();
        const edgeKey = `${parent?.cvr ?? "root"}>${company.cvr}`;
        if (seenEdges.has(edgeKey)) return [];
        seenEdges.add(edgeKey);

        if (!parent) {
            flattenedCompanies.push({
                ...companyFields,
                level: level,
                parent: null,
            });
        }

        if (level > 0) {
            // Don't add the root company
            flattenedCompanies.push({
                ...companyFields,
                level,
                parent: parent!,
            });
        }

        if (company.subsidiaries) {
            company.subsidiaries.forEach((subsidiary) => {
                flattenedCompanies = flattenedCompanies.concat(
                    this.flattenCorporateGroup(subsidiary, level + 1, { name: company.name, cvr: company.cvr }, seenEdges),
                );
            });
        }

        return flattenedCompanies;
    }

    public static async getCorporateGroup(
        cvrNumber: number,
        options: { flatten: true } & Partial<GroupLookupOptions>,
    ): Promise<CorporateGroupFlattened | null>;
    public static async getCorporateGroup(
        cvrNumber: number,
        options?: { flatten?: false } & Partial<GroupLookupOptions>,
    ): Promise<CorporateGroup | null>;
    public static async getCorporateGroup(
        cvrNumber: number,
        options?: { flatten?: boolean } & Partial<GroupLookupOptions>,
    ): Promise<CorporateGroup | CorporateGroupFlattened | null> {
        const lookup: GroupLookupOptions = {
            asOf: options?.asOf ?? null,
            history: options?.history ?? false,
            window: options?.window ?? null,
            includeFullyLiable: options?.includeFullyLiable ?? false,
            dates: options?.dates ?? null,
        };
        // In the period view the root's values are read as of the window's last day.
        const rootAsOf = lookup.window ? lookup.window.to : lookup.asOf;

        const response = await CorporateGroupService.getCompanyFromTheDanishBusinessRegistrationAPI(cvrNumber);

        if (!response || response.hits.total === 0 || response.hits.hits.length < 1) return null;

        const parentCompany = response.hits.hits[0]._source.Vrvirksomhed;

        const name = CorporateGroupService.nameAt(parentCompany, rootAsOf);

        if (!name) return null;

        const { subsidiaries, selfOwnershipPercentage } = await CorporateGroupService.getSubsidiaries(
            cvrNumber,
            new Set([cvrNumber]),
            lookup,
            new Map(),
        );

        const corporateGroup: CorporateGroup = {
            name,
            cvr: cvrNumber,
            selfOwnershipPercentage: selfOwnershipPercentage,
            ownershipPercentage: bandOf(null),
            votingRightsPercentage: bandOf(null),
            fullyLiable: false,
            participantRole: null,
            retrievedAt: new Date().toISOString(),
            owners: CorporateGroupService.ownersAt(parentCompany, rootAsOf),
            ...CorporateGroupService.extractCompanyDetails(parentCompany, rootAsOf),
            ...(lookup.history || lookup.window ? { ownershipHistory: [], membership: null } : {}),
            ...(lookup.window ? { events: [] } : {}),
            ...(lookup.dates
                ? {
                      snapshots: lookup.dates.map((date) => ({
                          date,
                          member: true,
                          ownershipPercentage: bandOf(null),
                          votingRightsPercentage: bandOf(null),
                          fullyLiable: false,
                          participantRole: null,
                          owners: CorporateGroupService.ownersAt(parentCompany, date),
                      })),
                  }
                : {}),
            subsidiaries: subsidiaries,
        };
        CorporateGroupService.markOwnersInGroup(corporateGroup);
        if (lookup.window) {
            corporateGroup.restructurings = corporateGroup.restructurings.filter(
                (r) => r.date !== null && overlapsWindow({ from: r.date, to: r.date }, lookup.window!),
            );
        }

        if (lookup.window) CorporateGroupService.markOwnerChanges(corporateGroup, lookup.window);
        await CorporateGroupService.resolveRestructuringCounterparts(corporateGroup, lookup.window);

        await CorporateGroupService.attachGroupEntitiesFromNotes(corporateGroup);

        if (options?.flatten) {
            return this.flattenCorporateGroup(corporateGroup);
        }

        return corporateGroup;
    }

    /** Flags every owner that is itself a company in this response. */
    private static markOwnersInGroup(root: CorporateGroup): void {
        const nodes: CorporateGroup[] = [];
        const walk = (node: CorporateGroup): void => {
            nodes.push(node);
            (node.subsidiaries ?? []).forEach(walk);
        };
        walk(root);
        const members = new Set(nodes.map((node) => node.cvr));
        for (const node of nodes) {
            for (const owner of node.owners) owner.inGroup = owner.cvr !== null && members.has(owner.cvr);
            for (const snapshot of node.snapshots ?? []) {
                for (const owner of snapshot.owners) owner.inGroup = owner.cvr !== null && members.has(owner.cvr);
            }
        }
    }

    /**
     * Resolves the other parties of every merger/demerger in the group with one
     * register query per batch of event ids (the ids are shared by all parties),
     * and — in the period/dates views — turns them into MERGED_INTO/MERGED_FROM/SPLIT_INTO/SPLIT_FROM events.
     */
    private static async resolveRestructuringCounterparts(root: CorporateGroup, window: { from: string; to: string } | null): Promise<void> {
        const nodes: CorporateGroup[] = [];
        const walk = (node: CorporateGroup): void => {
            nodes.push(node);
            (node.subsidiaries ?? []).forEach(walk);
        };
        walk(root);

        const eventIds = [...new Set(nodes.flatMap((node) => node.restructurings.map((r) => r.eventId)))];
        if (eventIds.length === 0) return;

        type Party = { cvr: number; name: string; role: "TRANSFERRING" | "RECEIVING"; dissolved: boolean };
        const partiesByEvent = new Map<number, Party[]>();

        for (let i = 0; i < eventIds.length; i += 100) {
            const batch = eventIds.slice(i, i + 100);
            let response: DanishBusinessRegistrationCompanyAPIResponse;
            try {
                response = await CorporateGroupService.queryDanishBusinessRegistrationAPI({
                    size: 1000,
                    _source: [
                        "Vrvirksomhed.cvrNummer",
                        "Vrvirksomhed.navne",
                        "Vrvirksomhed.virksomhedMetadata.nyesteNavn",
                        "Vrvirksomhed.fusioner",
                        "Vrvirksomhed.spaltninger",
                        "Vrvirksomhed.livsforloeb",
                    ],
                    query: {
                        bool: {
                            should: [
                                { terms: { "Vrvirksomhed.fusioner.enhedsNummerOrganisation": batch } },
                                { terms: { "Vrvirksomhed.spaltninger.enhedsNummerOrganisation": batch } },
                            ],
                            minimum_should_match: 1,
                        },
                    },
                });
            } catch {
                // Counterparts are an enrichment; the group itself must still be served.
                return;
            }
            for (const hit of response.hits.hits) {
                const party = hit._source.Vrvirksomhed;
                const name = party.virksomhedMetadata?.nyesteNavn?.navn ?? valueAt(party.navne, null)?.navn ?? String(party.cvrNummer);
                for (const own of CorporateGroupService.ownRestructurings(party)) {
                    if (!batch.includes(own.eventId)) continue;
                    const list = partiesByEvent.get(own.eventId) ?? [];
                    list.push({ cvr: party.cvrNummer, name, role: own.role, dissolved: own.dissolved });
                    partiesByEvent.set(own.eventId, list);
                }
            }
        }

        for (const node of nodes) {
            for (const r of node.restructurings) {
                r.counterparts = (partiesByEvent.get(r.eventId) ?? []).filter((p) => p.cvr !== node.cvr);
            }
            if (!window || !node.events) continue;
            for (const r of node.restructurings) {
                if (!r.date) continue;
                const type =
                    r.type === "MERGER"
                        ? r.role === "TRANSFERRING" ? "MERGED_INTO" : "MERGED_FROM"
                        : r.role === "TRANSFERRING" ? "SPLIT_INTO" : "SPLIT_FROM";
                node.events.push({ date: r.date, type, counterparts: r.counterparts, dissolved: r.dissolved });
            }
            node.events.sort((a, b) => a.date.localeCompare(b.date));
        }
    }

    /**
     * Period view: a company that was owned by two group companies in turn
     * appears under both. Where one membership ends and the next begins inside
     * the window, the later entry gets an OWNER_CHANGED event naming the
     * previous parent, so a move within the group is not read as a sale.
     */
    private static markOwnerChanges(root: CorporateGroup, window: { from: string; to: string }): void {
        const entries = new Map<number, Array<{ node: CorporateGroup; parent: { name: string; cvr: number } }>>();

        const walk = (node: CorporateGroup): void => {
            for (const child of node.subsidiaries ?? []) {
                const list = entries.get(child.cvr) ?? [];
                list.push({ node: child, parent: { name: node.name, cvr: node.cvr } });
                entries.set(child.cvr, list);
                walk(child);
            }
        };
        walk(root);

        for (const list of entries.values()) {
            if (list.length < 2) continue;
            list.sort((a, b) => (a.node.membership?.from ?? "").localeCompare(b.node.membership?.from ?? ""));
            for (let i = 1; i < list.length; i++) {
                const previous = list[i - 1];
                const current = list[i];
                const start = current.node.membership?.from;
                if (!start || previous.parent.cvr === current.parent.cvr) continue;
                if (start < window.from || start > window.to) continue;
                const events = current.node.events ?? [];
                // The move replaces the plain JOINED on the same day.
                current.node.events = [
                    ...events.filter((event) => !(event.type === "JOINED" && event.date === start)),
                    { date: start, type: "OWNER_CHANGED" as const, previousParent: previous.parent },
                ].sort((a, b) => a.date.localeCompare(b.date));
            }
        }
    }

    /**
     * Enriches EVERY company in the group with the group entities mentioned in the
     * notes of its newest annual report (see AnnualReportService). Entities whose
     * name matches a CVR-registered group member are dropped, so the field only
     * holds ADDITIONAL potential members — mainly foreign companies the register
     * cannot see. Fan-out is concurrency-capped, and failures leave a company with
     * an empty list rather than failing the endpoint.
     */
    private static async attachGroupEntitiesFromNotes(root: CorporateGroup): Promise<void> {
        const CONCURRENCY = 10;

        const companies: CorporateGroup[] = [];
        const collect = (company: CorporateGroup): void => {
            companies.push(company);
            (company.subsidiaries ?? []).forEach(collect);
        };
        collect(root);

        const registeredNames = new Set(companies.map((company) => normalizeEntityName(company.name)));
        const registeredCvrs = new Set(companies.map((company) => String(company.cvr).padStart(8, "0")));

        for (let i = 0; i < companies.length; i += CONCURRENCY) {
            const chunk = companies.slice(i, i + CONCURRENCY);

            await Promise.all(
                chunk.map(async (company) => {
                    const entities = await AnnualReportService.getNewestGroupEntitiesFromNotes(company.cvr);
                    company.groupEntitiesFromNotes = entities.filter(
                        (entity) =>
                            !registeredNames.has(normalizeEntityName(entity.name)) &&
                            (entity.cvrNumber === null || !registeredCvrs.has(entity.cvrNumber.padStart(8, "0"))),
                    );
                }),
            );
        }
    }

    private static async getSubsidiaries(
        cvrNumber: number,
        visited: Set<number> = new Set([cvrNumber]),
        options: GroupLookupOptions = NOW,
        // One register lookup per company per request, however many paths lead to it.
        lookups: Map<number, Promise<Company[]>> = new Map(),
    ): Promise<{
        subsidiaries: CorporateGroup[] | null;
        selfOwnershipPercentage: { from: number | null; to: number | null } | null;
    }> {
        let lookup = lookups.get(cvrNumber);
        if (!lookup) {
            lookup = this.getCompanySubsidiariesFromDanishBusinessRegistrationAPI(cvrNumber, options);
            lookups.set(cvrNumber, lookup);
        }
        const subsidiaries = await lookup;

        if (!subsidiaries || subsidiaries.length === 0)
            return {
                subsidiaries: null,
                selfOwnershipPercentage: null,
            };

        const selfOwnership = subsidiaries.find((subsidiary) => subsidiary.cvr === cvrNumber);
        const selfOwnershipPercentage = selfOwnership ? selfOwnership.ownershipPercentage : null;

        // Filter out the company itself AND any CVR already visited up the ownership chain
        // to prevent infinite recursion on circular ownership structures.
        const filteredSubsidiaries = subsidiaries.filter(
            (subsidiary) => subsidiary.cvr !== cvrNumber && !visited.has(subsidiary.cvr),
        );

        if (filteredSubsidiaries.length === 0)
            return {
                subsidiaries: null,
                selfOwnershipPercentage: {
                    from: selfOwnershipPercentage ? selfOwnershipPercentage.interval.from : null,
                    to: selfOwnershipPercentage ? selfOwnershipPercentage.interval.to : null,
                },
            };

        const corporateGroup = filteredSubsidiaries.map(async (subsidiary) => {
            const nestedVisited = new Set(visited);
            nestedVisited.add(subsidiary.cvr);
            const { subsidiaries: nestedSubsidiaries, selfOwnershipPercentage: nestedSelfOwnershipPercentage } =
                await CorporateGroupService.getSubsidiaries(subsidiary.cvr, nestedVisited, options, lookups);
            return {
                ...subsidiary,
                selfOwnershipPercentage: nestedSelfOwnershipPercentage,
                subsidiaries: nestedSubsidiaries,
            } satisfies CorporateGroup;
        });

        return {
            subsidiaries: await Promise.all(corporateGroup),
            selfOwnershipPercentage: {
                from: selfOwnershipPercentage ? selfOwnershipPercentage.interval.from : null,
                to: selfOwnershipPercentage ? selfOwnershipPercentage.interval.to : null,
            },
        };
    }
}
