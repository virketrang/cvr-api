import type {
    Company,
    CompanyFlattened,
    CorporateGroup,
    CorporateGroupFlattened,
    DanishBusinessRegistrationCompanyAPIResponse,
} from "./corporate-group.types.js";
import environment from "../../environment.js";

const CVR_API_URL = "http://distribution.virk.dk/cvr-permanent/virksomhed/_search";

export default abstract class CorporateGroupService {
    private static async queryDanishBusinessRegistrationAPI(
        query: object
    ): Promise<DanishBusinessRegistrationCompanyAPIResponse> {
        const response = await fetch(CVR_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${Buffer.from(
                    `${environment.CVR_API_USERNAME}:${environment.CVR_API_PASSWORD}`
                ).toString("base64")}`,
            },
            body: JSON.stringify(query),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch data from CVR API: ${response.statusText}`);
        }

        const data: DanishBusinessRegistrationCompanyAPIResponse = await response.json();

        return data;
    }

    private static async getCompanyFromTheDanishBusinessRegistrationAPI(
        cvrNumber: number
    ): Promise<DanishBusinessRegistrationCompanyAPIResponse | null> {
        const data = await CorporateGroupService.queryDanishBusinessRegistrationAPI({
            query: {
                bool: {
                    must: [{ term: { "Vrvirksomhed.cvrNummer": cvrNumber } }],
                },
            },
        });

        return data;
    }

    public static async getCompanySubsidiariesFromDanishBusinessRegistrationAPI(
        cvrNumber: number
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
                throw new Error("Company name or CVR number is missing in the response.");
            }

            const coorporateForm = subsidiary.virksomhedsform.find((f) => f.periode.gyldigTil === null) ??
                subsidiary.virksomhedMetadata.nyesteVirksomhedsform ?? {
                    virksomhedsformkode: null,
                    langBeskrivelse: null,
                    kortBeskrivelse: null,
                };

            const dateOfIncorporation =
                subsidiary.livsforloeb.sort(
                    (a, b) => new Date(a.periode.gyldigFra).getTime() - new Date(b.periode.gyldigFra).getTime()
                )[0]?.periode?.gyldigFra ??
                subsidiary.virksomhedMetadata.stiftelsesDato ??
                null;

            const financialYearStartDate =
                subsidiary.attributter
                    .find((attr) => attr.type === "REGNSKABSÅR_SLUT")
                    ?.vaerdier.find((value) => value.periode?.gyldigTil === null)?.vaerdi ?? null;
            const financialYearEndDate =
                subsidiary.attributter
                    .find((attr) => attr.type === "REGNSKABSÅR_START")
                    ?.vaerdier.find((value) => value.periode?.gyldigTil === null)?.vaerdi ?? null;

            const parent = subsidiary.deltagerRelation?.find(
                (relation) => relation.deltager.forretningsnoegle === cvrNumber
            );

            const ownershipOrganisation = parent?.organisationer?.find(
                (org) =>
                    org.hovedtype === "REGISTER" && org.organisationsNavn.some((name) => name.navn === "EJERREGISTER")
            );

            const ownershipAttribute = ownershipOrganisation?.medlemsData?.find((data) =>
                data.attributter.some((attr) => attr.type === "EJERANDEL_PROCENT")
            );

            const ownershipRegister = ownershipAttribute?.attributter.find((attr) => attr.type === "EJERANDEL_PROCENT");

            const ownershipPercentage = ownershipRegister?.vaerdier.find((value) => value.periode?.gyldigTil === null);

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
                    interval: {
                        from: ownershipPercentage?.vaerdi ? parseFloat(ownershipPercentage.vaerdi) : null,
                        to: ownershipPercentage?.vaerdi ? parseFloat(ownershipPercentage.vaerdi) : null,
                    },
                    accurate: null,
                },
                dateOfIncorporation: dateOfIncorporation ? new Date(dateOfIncorporation).toISOString() : null,
            };
        });
    }

    private static flattenCorporateGroup(
        company: CorporateGroup,
        level: number = 0,
        parent?: { name: string; cvr: number }
    ): CompanyFlattened[] {
        let flattenedCompanies: CompanyFlattened[] = [];

        if (!parent) {
            const parentCompany: CompanyFlattened = {
                name: company.name,
                cvr: company.cvr,
                corporateForm: company.corporateForm,
                financialYear: company.financialYear,
                ownershipPercentage: company.ownershipPercentage,
                dateOfIncorporation: company.dateOfIncorporation,
                level: level,
                parent: null,
            };

            flattenedCompanies.push(parentCompany);
        }

        if (level > 0) {
            // Don't add the root company
            flattenedCompanies.push({
                name: company.name,
                cvr: company.cvr,
                corporateForm: company.corporateForm,
                financialYear: company.financialYear,
                ownershipPercentage: company.ownershipPercentage,
                dateOfIncorporation: company.dateOfIncorporation,
                level,
                parent: parent!,
            });
        }

        if (company.subsidiaries) {
            company.subsidiaries.forEach((subsidiary) => {
                flattenedCompanies = flattenedCompanies.concat(
                    this.flattenCorporateGroup(subsidiary, level + 1, { name: company.name, cvr: company.cvr })
                );
            });
        }

        return flattenedCompanies;
    }

    public static async getCorporateGroup(
        cvrNumber: number,
        options: { flatten: true }
    ): Promise<CorporateGroupFlattened | null>;
    public static async getCorporateGroup(
        cvrNumber: number,
        options?: { flatten?: false }
    ): Promise<CorporateGroup | null>;
    public static async getCorporateGroup(
        cvrNumber: number,
        options?: {
            flatten?: boolean;
        }
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
                (a, b) => new Date(a.periode.gyldigFra).getTime() - new Date(b.periode.gyldigFra).getTime()
            )[0]?.periode?.gyldigFra ??
            parentCompany.virksomhedMetadata.stiftelsesDato ??
            null;

        const financialYearStartDate =
            parentCompany.attributter
                .find((attr) => attr.type === "REGNSKABSÅR_SLUT")
                ?.vaerdier.find((value) => value.periode?.gyldigTil === null)?.vaerdi ?? null;
        const financialYearEndDate =
            parentCompany.attributter
                .find((attr) => attr.type === "REGNSKABSÅR_START")
                ?.vaerdier.find((value) => value.periode?.gyldigTil === null)?.vaerdi ?? null;

        const subsidiaries = await CorporateGroupService.getSubsidiaries(cvrNumber);

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
            ownershipPercentage: {
                interval: {
                    from: null,
                    to: null,
                },
                accurate: null,
            },
            dateOfIncorporation: dateOfIncorporation ? new Date(dateOfIncorporation).toISOString() : null,
            subsidiaries: subsidiaries,
        };

        if (options?.flatten) {
            return this.flattenCorporateGroup(corporateGroup);
        }

        return corporateGroup;
    }

    private static async getSubsidiaries(cvrNumber: number): Promise<CorporateGroup[] | null> {
        const subsidiaries = await this.getCompanySubsidiariesFromDanishBusinessRegistrationAPI(cvrNumber);

        if (!subsidiaries || subsidiaries.length === 0) return null;

        const corporateGroup = subsidiaries.map(async (subsidiary) => {
            const subsidiaries = await CorporateGroupService.getSubsidiaries(subsidiary.cvr);
            return {
                name: subsidiary.name,
                cvr: subsidiary.cvr,
                corporateForm: subsidiary.corporateForm,
                financialYear: subsidiary.financialYear,
                ownershipPercentage: subsidiary.ownershipPercentage,
                dateOfIncorporation: subsidiary.dateOfIncorporation,
                subsidiaries: subsidiaries, // Subsidiaries of this subsidiary are not fetched here
            } as CorporateGroup;
        });
        return Promise.all(corporateGroup);
    }
}
