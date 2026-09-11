import type {
    Attribute,
    Company,
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

const NOW: GroupLookupOptions = { asOf: null, history: false, window: null, includeFullyLiable: false };

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
            ...details,
        };

        if (history) {
            const fullHistory = buildOwnershipHistory(ownership, votingRights, noticeDates);
            company.ownershipHistory = window
                ? fullHistory.filter((segment) => overlapsWindow(segment, window))
                : fullHistory;
            company.membership =
                stints.length > 0 ? { from: stints[0].from, to: stints[stints.length - 1].to } : membershipOf(fullHistory);
        }

        if (window) {
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
    ): CompanyFlattened[] {
        let flattenedCompanies: CompanyFlattened[] = [];

        // Carry every Company field over; only the tree structure is replaced by level/parent.
        const { subsidiaries: _subsidiaries, ...companyFields } = company;

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
                    this.flattenCorporateGroup(subsidiary, level + 1, { name: company.name, cvr: company.cvr }),
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
        );

        const corporateGroup: CorporateGroup = {
            name,
            cvr: cvrNumber,
            selfOwnershipPercentage: selfOwnershipPercentage,
            ownershipPercentage: bandOf(null),
            votingRightsPercentage: bandOf(null),
            fullyLiable: false,
            participantRole: null,
            ...CorporateGroupService.extractCompanyDetails(parentCompany, rootAsOf),
            ...(lookup.history || lookup.window ? { ownershipHistory: [], membership: null } : {}),
            ...(lookup.window ? { events: [] } : {}),
            subsidiaries: subsidiaries,
        };

        if (lookup.window) CorporateGroupService.markOwnerChanges(corporateGroup, lookup.window);

        await CorporateGroupService.attachGroupEntitiesFromNotes(corporateGroup);

        if (options?.flatten) {
            return this.flattenCorporateGroup(corporateGroup);
        }

        return corporateGroup;
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
    ): Promise<{
        subsidiaries: CorporateGroup[] | null;
        selfOwnershipPercentage: { from: number | null; to: number | null } | null;
    }> {
        const subsidiaries = await this.getCompanySubsidiariesFromDanishBusinessRegistrationAPI(cvrNumber, options);

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
                await CorporateGroupService.getSubsidiaries(subsidiary.cvr, nestedVisited, options);
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
