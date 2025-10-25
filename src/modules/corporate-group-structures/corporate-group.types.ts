export interface DanishBusinessRegistrationCompanyAPIResponse {
    took: number;
    timed_out: boolean;
    _shards: {
        total: number;
        successful: number;
        skipped: number;
        failed: number;
    };
    hits: {
        total: number;
        max_score: number | null;
        hits: Array<{
            _index: string;
            _type: string;
            _id: string;
            _score: number | null;
            _source: {
                Vrvirksomhed: {
                    cvrNummer: number;
                    regNumber: [];
                    brancheAnsvarskode: string | null;
                    reklamebeskyttet: boolean;
                    navne: Array<{
                        navn: string;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    binavne: Array<{
                        navn: string;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    postadresse: [];
                    beliggenhedsadresse: Array<{
                        landekode: string;
                        fritekst: string | null;
                        vejkode: number;
                        kommune: {
                            kommuneKode: number;
                            kommuneNavn: string;
                            periode: {
                                gyldigFra: string;
                                gyldigTil: string | null;
                            };
                            sidstOpdateret: string;
                        };
                        husnummerFra: number;
                        adresseId: string;
                        sidstValideret: string;
                        husnummerTil: number | null;
                        bogstavFra: string | null;
                        bogstavTil: string | null;
                        etage: string | null;
                        sidedoer: string | null;
                        conavn: string | null;
                        postboks: string | null;
                        vejnavn: string;
                        bynavn: string | null;
                        postnummer: number;
                        postdistrikt: string;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    telefonNummer: Array<{
                        kontaktoplysning: string | null;
                        hemmelig: boolean;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    telefaxNummer: Array<{
                        kontaktoplysning: string | null;
                        hemmelig: boolean;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    sekundærtTelefonNummer: Array<{
                        kontaktoplysning: string | null;
                        hemmelig: boolean;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    sekundærtTelefaxNummer: Array<{
                        kontaktoplysning: string | null;
                        hemmelig: boolean;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    elektroniskPost: Array<{
                        kontaktoplysning: string | null;
                        hemmelig: boolean;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    hjemmeside: [];
                    obligatoriskEmail: [];
                    livsforloeb: Array<{
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    hovedbranche: {
                        branchekode: string;
                        branchetekst: string;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    };
                    bibranche1: Array<{
                        branchekode: string;
                        branchetekst: string;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    bibranche2: Array<{
                        branchekode: string;
                        branchetekst: string;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    bibranche3: Array<{
                        branchekode: string;
                        branchetekst: string;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    status: [];
                    virksomhedsstatus: Array<{
                        status: string;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    virksomhedsform: Array<{
                        virksomhedsformkode: number;
                        kortBeskrivelse: string;
                        langBeskrivelse: string;
                        ansvarligDataleverandoer: string;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    aarsbeskaeftigelse: Array<{
                        aar: number;
                        antalInklusiveEjere: number | null;
                        antalAarsvaerk: number | null;
                        antalAnsatte: number | null;
                        sidstOpdateret: string;
                        intervalKodeAntalInklusivEjere: string | null;
                        intervalKodeAntalAarsvaerk: string | null;
                        intervalKodeAntalAnsatte: string | null;
                    }>;
                    kvartalsbeskaeftigelse: Array<{
                        aar: number;
                        kvartal: number;
                        antalAarsvaerk: number | null;
                        antalAnsatte: number | null;
                        sidstOpdateret: string;
                        intervalKodeAntalAarsvaerk: string | null;
                        intervalKodeAntalAnsatte: string | null;
                    }>;
                    maanedsbeskaeftigelse: Array<{
                        aar: number;
                        maaned: number;
                        antalAarsvaerk: number | null;
                        antalAnsatte: number | null;
                        sidstOpdateret: string;
                        intervalKodeAntalAarsvaerk: string | null;
                        intervalKodeAntalAnsatte: string | null;
                    }>;
                    erstMaanedsbeskaeftigelse: Array<{
                        aar: number;
                        maaned: number;
                        antalAarsvaerk: number | null;
                        antalAnsatte: number | null;
                        sidstOpdateret: string;
                        intervalKodeAntalAarsvaerk: string | null;
                        intervalKodeAntalAnsatte: string | null;
                    }>;
                    attributter: Array<{
                        sekvensnr: number;
                        type: string;
                        vaerditype: string;
                        vaerdier: Array<{
                            vaerdi: string;
                            periode: {
                                gyldigFra: string;
                                gyldigTil: string | null;
                            };
                            sidstOpdateret: string;
                        }>;
                    }>;
                    penheder: Array<{
                        pNummer: number;
                        periode: {
                            gyldigFra: string;
                            gyldigTil: string | null;
                        };
                        sidstOpdateret: string;
                    }>;
                    deltagerRelation: Array<{
                        deltager: {
                            enhedsNummer: number;
                            enhedstype: string;
                            forretningsnoegle: number | null;
                            organisationstype: string | null;
                            sidstIndlaest: string;
                            sidstOpdateret: string;
                            navne: Array<{
                                navn: string;
                                periode: {
                                    gyldigFra: string;
                                    gyldigTil: string | null;
                                };
                                sidstOpdateret: string | null;
                            }>;
                            adresseHemmelig: boolean;
                            adresseHemmeligUndtagelse: boolean;
                            adresseOpdateringOphoert: boolean;
                            beliggenhedsadresse: Array<{
                                landekode: string;
                                fritekst: string | null;
                                vejkode: number;
                                kommune: {
                                    kommuneKode: number;
                                    kommuneNavn: string;
                                    periode: {
                                        gyldigFra: string;
                                        gyldigTil: string | null;
                                    };
                                    sidstOpdateret: string;
                                };
                                husnummerFra: number;
                                adresseId: string;
                                sidstValideret: string;
                                husnummerTil: number | null;
                                bogstavFra: string | null;
                                bogstavTil: string | null;
                                etage: string | null;
                                sidedoer: string | null;
                                conavn: string | null;
                                postboks: string | null;
                                vejnavn: string;
                                bynavn: string | null;
                                postnummer: number;
                                postdistrikt: string;
                                periode: {
                                    gyldigFra: string;
                                    gyldigTil: string | null;
                                };
                                sidstOpdateret: string;
                            }>;
                            postadresse: Array<{
                                landekode: string;
                                fritekst: string | null;
                                vejkode: number;
                                kommune: {
                                    kommuneKode: number;
                                    kommuneNavn: string;
                                    periode: {
                                        gyldigFra: string;
                                        gyldigTil: string | null;
                                    };
                                    sidstOpdateret: string;
                                };
                                husnummerFra: number;
                                adresseId: string;
                                sidstValideret: string;
                                husnummerTil: number | null;
                                bogstavFra: string | null;
                                bogstavTil: string | null;
                                etage: string | null;
                                sidedoer: string | null;
                                conavn: string | null;
                                postboks: string | null;
                                vejnavn: string;
                                bynavn: string | null;
                                postnummer: number;
                                postdistrikt: string;
                                periode: {
                                    gyldigFra: string;
                                    gyldigTil: string | null;
                                };
                                sidstOpdateret: string;
                            }>;
                        };
                        kontorsteder: [];
                        organisationer: Array<{
                            enhedsNummerOrganisation: number;
                            hovedtype: string;
                            organisationsNavn: Array<{
                                navn: string;
                                periode: {
                                    gyldigFra: string;
                                    gyldigTil: string | null;
                                };
                                sidstOpdateret: string;
                            }>;
                            attributter: Array<{
                                sekvensnr: number;
                                type: string;
                                vaerditype: string;
                                vaerdier: Array<{
                                    vaerdi: string;
                                    periode: {
                                        gyldigFra: string;
                                        gyldigTil: string | null;
                                    };
                                    sidstOpdateret: string;
                                }>;
                            }>;
                            medlemsData: Array<{
                                attributter: Array<{
                                    sekvensnr: number;
                                    type: string;
                                    vaerditype: string;
                                    vaerdier: Array<{
                                        vaerdi: string;
                                        periode: {
                                            gyldigFra: string;
                                            gyldigTil: string | null;
                                        };
                                        sidstOpdateret: string;
                                    }>;
                                }>;
                            }>;
                        }>;
                    }>;
                    fusioner: Array<{
                        enhedsNummerOrganisation: number;
                        organisationsNavn: Array<{
                            navn: string;
                            periode: {
                                gyldigFra: string;
                                gyldigTil: string | null;
                            };
                            sidstOpdateret: string;
                        }>;
                        indgaaende: Array<{
                            sekvensnr: number;
                            type: string;
                            vaerditype: string;
                            vaerdier: Array<{
                                vaerdi: string;
                                periode: {
                                    gyldigFra: string;
                                    gyldigTil: string | null;
                                };
                                sidstOpdateret: string;
                            }>;
                        }>;
                        udgaaende: Array<{
                            sekvensnr: number;
                            type: string;
                            vaerditype: string;
                            vaerdier: Array<{
                                vaerdi: string;
                                periode: {
                                    gyldigFra: string;
                                    gyldigTil: string | null;
                                };
                                sidstOpdateret: string;
                            }>;
                        }>;
                    }>;
                    spaltninger: [];
                    virksomhedMetadata: {
                        nyesteNavn: {
                            navn: string;
                            periode: {
                                gyldigFra: string;
                                gyldigTil: string | null;
                            };
                            sidstOpdateret: string;
                        };
                        nyesteBinavne: Array<string>;
                        nyesteVirksomhedsform: {
                            virksomhedsformkode: number;
                            kortBeskrivelse: string;
                            langBeskrivelse: string;
                            ansvarligDataleverandoer: string;
                            periode: {
                                gyldigFra: string;
                                gyldigTil: string | null;
                            };
                            sidstOpdateret: string;
                        };
                        nyesteBeliggenhedsadresse: {
                            landekode: string;
                            fritekst: string | null;
                            vejkode: number;
                            kommune: {
                                kommuneKode: number;
                                kommuneNavn: string;
                                periode: {
                                    gyldigFra: string;
                                    gyldigTil: string | null;
                                };
                                sidstOpdateret: string;
                            };
                            husnummerFra: number;
                            adresseId: string;
                            sidstValideret: string;
                            husnummerTil: number | null;
                            bogstavFra: string | null;
                            bogstavTil: string | null;
                            etage: string | null;
                            sidedoer: string | null;
                            conavn: string | null;
                            postboks: string | null;
                            vejnavn: string;
                            bynavn: string | null;
                            postnummer: number;
                            postdistrikt: string;
                            periode: {
                                gyldigFra: string;
                                gyldigTil: string | null;
                            };
                            sidstOpdateret: string;
                        };
                        nyesteHovedbranche: {
                            branchekode: string;
                            branchetekst: string;
                            periode: {
                                gyldigFra: string;
                                gyldigTil: string | null;
                            };
                            sidstOpdateret: string;
                        };
                        nyesteBibranche1: {
                            branchekode: string;
                            branchetekst: string;
                            periode: {
                                gyldigFra: string;
                                gyldigTil: string | null;
                            };
                            sidstOpdateret: string;
                        };
                        nyesteBibranche2: {
                            branchekode: string;
                            branchetekst: string;
                            periode: {
                                gyldigFra: string;
                                gyldigTil: string | null;
                            };
                            sidstOpdateret: string;
                        };
                        nyesteBibranche3: {
                            branchekode: string;
                            branchetekst: string;
                            periode: {
                                gyldigFra: string;
                                gyldigTil: string | null;
                            };
                            sidstOpdateret: string;
                        };
                        nyesteStatus: string | null;
                        nyesteKontaktoplysninger: Array<{
                            kontaktoplysning: string | null;
                            hemmelig: boolean;
                            periode: {
                                gyldigFra: string;
                                gyldigTil: string | null;
                            };
                            sidstOpdateret: string;
                        }>;
                        antalPenheder: number;
                        nyesteAarsbeskaeftigelse: {
                            aar: number;
                            antalInklusivEjere: number | null;
                            antalAarsvaerk: number | null;
                            antalAnsatte: number | null;
                            sidstOpdateret: string;
                            intervalKodeAntalInklusivEjere: string | null;
                            intervalKodeAntalAarsvaerk: string | null;
                            intervalKodeAntalAnsatte: string | null;
                        };
                        nyesteKvartalsbeskaeftigelse: {
                            aar: number;
                            kvartal: number;
                            antalAarsvaerk: number | null;
                            antalAnsatte: number | null;
                            sidstOpdateret: string;
                            intervalKodeAntalAarsvaerk: string | null;
                            intervalKodeAntalAnsatte: string | null;
                        };
                        nyesteMaanedsbeskaeftigelse: {
                            aar: number;
                            maaned: number;
                            antalAarsvaerk: number | null;
                            antalAnsatte: number | null;
                            sidstOpdateret: string;
                            intervalKodeAntalAarsvaerk: string | null;
                            intervalKodeAntalAnsatte: string | null;
                        };
                        nyesteErstMaanedsbeskaeftigelse: {
                            aar: number;
                            maaned: number;
                            antalAarsvaerk: number | null;
                            antalAnsatte: number | null;
                            sidstOpdateret: string;
                            intervalKodeAntalAarsvaerk: string | null;
                            intervalKodeAntalAnsatte: string | null;
                        };
                        sammensatStatus: string;
                        stiftelsesDato: string;
                        virkningsDato: string;
                    };
                    samtId: number;
                    fejlRegistreret: boolean;
                    dataAdgang: 0;
                    enhedsNummer: number;
                    enhedstype: string;
                    sidstIndlaest: string;
                    sidstOpdateret: string;
                    fejlVedIndlaesning: boolean;
                    naermesteFremtidigeDato: string | null;
                    fejlBeskrivelse: null;
                    virkningsAktoer: string;
                };
            };
        }>;
    };
}

export interface CorporateForm {
    code: number | null;
    name: string | null;
    abbreviation: string | null;
}

export interface Company {
    name: string;
    cvr: number;
    corporateForm: CorporateForm;
    financialYear: {
        startDate: string | null;
        endDate: string | null;
    };
    ownershipPercentage: {
        interval: {
            from: number | null;
            to: number | null;
        };
        accurate: number | null;
    };
    dateOfIncorporation: string | null;
}

export interface CorporateGroup {
    name: string;
    cvr: number;
    corporateForm: CorporateForm;
    financialYear: {
        startDate: string | null;
        endDate: string | null;
    };
    ownershipPercentage: {
        interval: {
            from: number | null;
            to: number | null;
        };
        accurate: number | null;
    };
    dateOfIncorporation: string | null;
    subsidiaries: CorporateGroup[] | null;
}

export interface CompanyFlattened {
    name: string;
    cvr: number;
    corporateForm: CorporateForm;
    financialYear: {
        startDate: string | null;
        endDate: string | null;
    };
    ownershipPercentage: {
        interval: {
            from: number | null;
            to: number | null;
        };
        accurate: number | null;
    };
    dateOfIncorporation: string | null;
    level: number;
    parent: {
        name: string;
        cvr: number;
    } | null;
}

export type CorporateGroupFlattened = CompanyFlattened[];
