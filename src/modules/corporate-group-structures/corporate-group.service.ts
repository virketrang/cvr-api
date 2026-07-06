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
    Virksomhed,
} from "./corporate-group.types.js";
import environment from "../../environment.js";
import { AppError, ErrorCode } from "../../utils/api-error.js";
import { basicAuthHeader, fetchUpstreamJson } from "../../utils/http.js";

const CVR_API_URL = "http://distribution.virk.dk/cvr-permanent/virksomhed/_search";

export default abstract class CorporateGroupService {
    /** Safely turns a date-ish string into an ISO string, or null if unparseable. */
    private static safeIsoDate(value: string | null | undefined): string | null {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    private static convertDecimalToRange(decimal: number | null): { from: number | null; to: number | null } {
        switch (decimal) {
            case 0:
                return { from: 0, to: 0.0499 };
            case 0.05:
                return { from: 0.05, to: 0.0999 };
            case 0.1:
                return { from: 0.1, to: 0.1499 };
            case 0.15:
                return { from: 0.15, to: 0.1999 };
            case 0.2:
                return { from: 0.2, to: 0.2499 };
            case 0.25:
                return { from: 0.25, to: 0.3332 };
            case 0.3333:
                return { from: 0.3333, to: 0.4999 };
            case 0.5:
                return { from: 0.5, to: 0.6666 };
            case 0.6667:
                return { from: 0.6667, to: 0.8999 };
            case 0.9:
                return { from: 0.9, to: 0.9999 };
            case 1:
                return { from: 1, to: 1 };
            default:
                return { from: null, to: null };
        }
    }

    /** The currently valid (periode.gyldigTil === null) value of a company attribute, or null. */
    private static currentAttributeValue(attributter: Attribute[], type: string): string | null {
        return (
            attributter
                .find((attr) => attr.type === type)
                ?.vaerdier.find((value) => value.periode?.gyldigTil === null)?.vaerdi ?? null
        );
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

    /** The company's current registered address, or null when none is registered. */
    private static extractAddress(virksomhed: Virksomhed): CompanyAddress | null {
        const address =
            virksomhed.beliggenhedsadresse.find((a) => a.periode.gyldigTil === null) ??
            virksomhed.virksomhedMetadata.nyesteBeliggenhedsadresse ??
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

    /**
     * Extracts the company master data shared by the root company and every
     * subsidiary from the registry's Vrvirksomhed document, so both are computed
     * by the same rules.
     */
    private static extractCompanyDetails(
        virksomhed: Virksomhed,
    ): Pick<
        Company,
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

        const capitalValue = CorporateGroupService.currentAttributeValue(attributter, "KAPITAL");

        const mainIndustry =
            (virksomhed.hovedbranche ?? []).find((branch) => branch.periode.gyldigTil === null) ??
            virksomhed.virksomhedMetadata.nyesteHovedbranche ??
            null;

        const status =
            (virksomhed.virksomhedsstatus ?? []).find((s) => s.periode.gyldigTil === null)?.status ??
            virksomhed.virksomhedMetadata.sammensatStatus ??
            null;

        const secondaryNames = (virksomhed.binavne ?? [])
            .filter((name) => name.periode.gyldigTil === null)
            .map((name) => name.navn);

        return {
            listed: CorporateGroupService.currentAttributeValue(attributter, "BØRSNOTERET") === "true",
            purpose: CorporateGroupService.currentAttributeValue(attributter, "FORMÅL"),
            hasShareClasses: CorporateGroupService.currentAttributeValue(attributter, "KAPITALKLASSER") === "true",
            status,
            mainIndustry: mainIndustry ? `${mainIndustry.branchekode} - ${mainIndustry.branchetekst}` : null,
            secondaryNames,
            demergers: (virksomhed.spaltninger ?? []).map(CorporateGroupService.convertCorporateEvent),
            mergers: (virksomhed.fusioner ?? []).map(CorporateGroupService.convertCorporateEvent),
            address: CorporateGroupService.extractAddress(virksomhed),
            capital: {
                value: capitalValue !== null ? parseFloat(capitalValue) : null,
                currency: CorporateGroupService.currentAttributeValue(attributter, "KAPITALVALUTA"),
            },
            firstFinancialYear: {
                startDate: CorporateGroupService.currentAttributeValue(attributter, "FØRSTE_REGNSKABSPERIODE_START"),
                endDate: CorporateGroupService.currentAttributeValue(attributter, "FØRSTE_REGNSKABSPERIODE_SLUT"),
            },
            // Audit applies unless it has been explicitly opted out (REVISION_FRAVALGT = true).
            audited: CorporateGroupService.currentAttributeValue(attributter, "REVISION_FRAVALGT") !== "true",
            powerToBind: CorporateGroupService.currentAttributeValue(attributter, "TEGNINGSREGEL"),
        };
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

    public static async getCompanySubsidiariesFromDanishBusinessRegistrationAPI(
        cvrNumber: number,
    ): Promise<Array<Company>> {
        const companiesResponse = await CorporateGroupService.queryDanishBusinessRegistrationAPI({
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
                                                                        bool: {
                                                                            must: [
                                                                                {
                                                                                    match: {
                                                                                        "Vrvirksomhed.deltagerRelation.organisationer.medlemsData.attributter.type":
                                                                                            "EJERANDEL_PROCENT",
                                                                                    },
                                                                                },
                                                                                {
                                                                                    nested: {
                                                                                        path: "Vrvirksomhed.deltagerRelation.organisationer.medlemsData.attributter.vaerdier",
                                                                                        query: {
                                                                                            bool: {
                                                                                                must: [
                                                                                                    {
                                                                                                        bool: {
                                                                                                            must_not: {
                                                                                                                exists: {
                                                                                                                    field: "Vrvirksomhed.deltagerRelation.organisationer.medlemsData.attributter.vaerdier.periode.gyldigTil",
                                                                                                                },
                                                                                                            },
                                                                                                        },
                                                                                                    },
                                                                                                ],
                                                                                            },
                                                                                        },
                                                                                    },
                                                                                },
                                                                            ],
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                ],
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

        return companiesResponse.hits.hits.map((hit) => {
            const subsidiary = hit._source.Vrvirksomhed;

            const name =
                subsidiary.navne.find((n) => n.periode.gyldigTil === null)?.navn ??
                subsidiary.virksomhedMetadata.nyesteNavn?.navn;
            const cvr = subsidiary.cvrNummer;

            if (!name || !cvr) {
                throw new AppError(
                    ErrorCode.UPSTREAM_BAD_RESPONSE,
                    "Et selskab i koncernstrukturen mangler navn eller CVR-nummer i registerets svar.",
                );
            }

            const coorporateForm = subsidiary.virksomhedsform.find((f) => f.periode.gyldigTil === null) ??
                subsidiary.virksomhedMetadata.nyesteVirksomhedsform ?? {
                    virksomhedsformkode: null,
                    langBeskrivelse: null,
                    kortBeskrivelse: null,
                };

            const dateOfIncorporation =
                subsidiary.livsforloeb.sort(
                    (a, b) => new Date(a.periode.gyldigFra).getTime() - new Date(b.periode.gyldigFra).getTime(),
                )[0]?.periode?.gyldigFra ??
                subsidiary.virksomhedMetadata.stiftelsesDato ??
                null;

            const financialYearStartDate = CorporateGroupService.currentAttributeValue(
                subsidiary.attributter,
                "REGNSKABSÅR_START",
            );
            const financialYearEndDate = CorporateGroupService.currentAttributeValue(
                subsidiary.attributter,
                "REGNSKABSÅR_SLUT",
            );

            const parent = subsidiary.deltagerRelation?.find(
                (relation) => relation.deltager.forretningsnoegle === cvrNumber,
            );

            const ownershipOrganisation = parent?.organisationer?.find(
                (org) =>
                    org.hovedtype === "REGISTER" && org.organisationsNavn.some((name) => name.navn === "EJERREGISTER"),
            );

            const ownershipAttribute = ownershipOrganisation?.medlemsData?.find((data) =>
                data.attributter.some((attr) => attr.type === "EJERANDEL_PROCENT"),
            );

            const ownershipRegister = ownershipAttribute?.attributter.find((attr) => attr.type === "EJERANDEL_PROCENT");

            const ownershipPercentage = ownershipRegister?.vaerdier.find((value) => value.periode?.gyldigTil === null);

            const votingRightsAttribute = ownershipOrganisation?.medlemsData?.find((data) =>
                data.attributter.some((attr) => attr.type === "EJERANDEL_STEMMERET_PROCENT"),
            );

            const votingRightsRegister = votingRightsAttribute?.attributter.find(
                (attr) => attr.type === "EJERANDEL_STEMMERET_PROCENT",
            );

            const votingRightsPercentage = votingRightsRegister?.vaerdier.find(
                (value) => value.periode?.gyldigTil === null,
            );

            const ownershipDecimal = ownershipPercentage?.vaerdi ? parseFloat(ownershipPercentage.vaerdi) : null;
            const votingRightsDecimal = votingRightsPercentage?.vaerdi
                ? parseFloat(votingRightsPercentage.vaerdi)
                : null;

            return {
                name,
                cvr,
                corporateForm: {
                    code: coorporateForm?.virksomhedsformkode ?? null,
                    name: coorporateForm?.langBeskrivelse ?? null,
                    abbreviation: coorporateForm?.kortBeskrivelse ?? null,
                },
                financialYear: {
                    startDate: financialYearStartDate ?? null,
                    endDate: financialYearEndDate ?? null,
                },
                ownershipPercentage: {
                    interval: CorporateGroupService.convertDecimalToRange(ownershipDecimal),
                    accurate: ownershipDecimal === 1 ? true : false,
                },
                votingRightsPercentage: {
                    interval: CorporateGroupService.convertDecimalToRange(votingRightsDecimal),
                    accurate: votingRightsDecimal === 1 ? true : false,
                },
                dateOfIncorporation: CorporateGroupService.safeIsoDate(dateOfIncorporation),
                ...CorporateGroupService.extractCompanyDetails(subsidiary),
            };
        });
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
        options: { flatten: true },
    ): Promise<CorporateGroupFlattened | null>;
    public static async getCorporateGroup(
        cvrNumber: number,
        options?: { flatten?: false },
    ): Promise<CorporateGroup | null>;
    public static async getCorporateGroup(
        cvrNumber: number,
        options?: {
            flatten?: boolean;
        },
    ): Promise<CorporateGroup | CorporateGroupFlattened | null> {
        const response = await CorporateGroupService.getCompanyFromTheDanishBusinessRegistrationAPI(cvrNumber);

        if (!response || response.hits.total === 0 || response.hits.hits.length < 1) return null;

        const parentCompany = response.hits.hits[0]._source.Vrvirksomhed;

        const name = parentCompany.navne.find((n) => n.periode.gyldigTil === null)?.navn;

        if (!name) return null;

        const coorporateForm = parentCompany.virksomhedsform.find((f) => f.periode.gyldigTil === null) ??
            parentCompany.virksomhedMetadata.nyesteVirksomhedsform ?? {
                virksomhedsformkode: null,
                langBeskrivelse: null,
                kortBeskrivelse: null,
            };

        const dateOfIncorporation =
            parentCompany.livsforloeb.sort(
                (a, b) => new Date(a.periode.gyldigFra).getTime() - new Date(b.periode.gyldigFra).getTime(),
            )[0]?.periode?.gyldigFra ??
            parentCompany.virksomhedMetadata.stiftelsesDato ??
            null;

        const financialYearStartDate = CorporateGroupService.currentAttributeValue(
            parentCompany.attributter,
            "REGNSKABSÅR_START",
        );
        const financialYearEndDate = CorporateGroupService.currentAttributeValue(
            parentCompany.attributter,
            "REGNSKABSÅR_SLUT",
        );

        const { subsidiaries, selfOwnershipPercentage } = await CorporateGroupService.getSubsidiaries(
            cvrNumber,
            new Set([cvrNumber]),
        );

        const corporateGroup = {
            name,
            cvr: cvrNumber,
            corporateForm: {
                code: coorporateForm.virksomhedsformkode,
                name: coorporateForm.langBeskrivelse,
                abbreviation: coorporateForm.kortBeskrivelse,
            },
            financialYear: {
                startDate: financialYearStartDate ?? null,
                endDate: financialYearEndDate ?? null,
            },
            selfOwnershipPercentage: selfOwnershipPercentage,
            ownershipPercentage: {
                interval: {
                    from: null,
                    to: null,
                },
                accurate: false,
            },
            votingRightsPercentage: {
                interval: {
                    from: null,
                    to: null,
                },
                accurate: false,
            },
            dateOfIncorporation: CorporateGroupService.safeIsoDate(dateOfIncorporation),
            ...CorporateGroupService.extractCompanyDetails(parentCompany),
            subsidiaries: subsidiaries,
        };

        if (options?.flatten) {
            return this.flattenCorporateGroup(corporateGroup);
        }

        return corporateGroup;
    }

    private static async getSubsidiaries(
        cvrNumber: number,
        visited: Set<number> = new Set([cvrNumber]),
    ): Promise<{
        subsidiaries: CorporateGroup[] | null;
        selfOwnershipPercentage: { from: number | null; to: number | null } | null;
    }> {
        const subsidiaries = await this.getCompanySubsidiariesFromDanishBusinessRegistrationAPI(cvrNumber);

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
                await CorporateGroupService.getSubsidiaries(subsidiary.cvr, nestedVisited);
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
