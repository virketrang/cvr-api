import type { GroupEntityFromNotes } from "../annual-reports/annual-report.types.js";

export interface CorporateForm {
    code: number | null;
    name: string | null;
    abbreviation: string | null;
}

export interface FinancialYear {
    startDate: string | null;
    endDate: string | null;
}

export interface OwnershipPercentage {
    interval: {
        from: number | null;
        to: number | null;
    };
    accurate: boolean;
}

export interface Period {
    gyldigFra: string;
    gyldigTil: string | null;
}

export interface Address {
    landekode: string;
    fritekst: string | null;
    vejkode: number;
    kommune: {
        kommuneKode: number;
        kommuneNavn: string;
        periode: Period;
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
    periode: Period;
    sidstOpdateret: string;
}

export interface ContactInfo {
    kontaktoplysning: string | null;
    hemmelig: boolean;
    periode: Period;
    sidstOpdateret: string;
}

export interface Name {
    navn: string;
    periode: Period;
    sidstOpdateret: string | null;
}

export interface Branch {
    branchekode: string;
    branchetekst: string;
    periode: Period;
    sidstOpdateret: string;
}

export interface VirksomhedsForm {
    virksomhedsformkode: number;
    kortBeskrivelse: string;
    langBeskrivelse: string;
    ansvarligDataleverandoer: string;
    periode: Period;
    sidstOpdateret: string;
}

export interface Attribute {
    sekvensnr: number;
    type: string;
    vaerditype: string;
    vaerdier: Array<{
        vaerdi: string;
        periode: Period;
        sidstOpdateret: string;
    }>;
}

export interface Employment {
    aar: number;
    antalInklusiveEjere?: number | null;
    antalAarsvaerk: number | null;
    antalAnsatte: number | null;
    sidstOpdateret: string;
    intervalKodeAntalInklusivEjere?: string | null;
    intervalKodeAntalAarsvaerk: string | null;
    intervalKodeAntalAnsatte: string | null;
}

export interface QuarterlyEmployment extends Employment {
    kvartal: number;
}

export interface MonthlyEmployment extends Employment {
    maaned: number;
}

export interface Deltager {
    enhedsNummer: number;
    enhedstype: string;
    forretningsnoegle: number | null;
    organisationstype: string | null;
    sidstIndlaest: string;
    sidstOpdateret: string;
    navne: Name[];
    adresseHemmelig: boolean;
    adresseHemmeligUndtagelse: boolean;
    adresseOpdateringOphoert: boolean;
    beliggenhedsadresse: Address[];
    postadresse: Address[];
}

export interface Organisation {
    enhedsNummerOrganisation: number;
    hovedtype: string;
    organisationsNavn: Name[];
    attributter: Attribute[];
    medlemsData: Array<{
        attributter: Attribute[];
    }>;
}

export interface DeltagerRelation {
    deltager: Deltager;
    kontorsteder: [];
    organisationer: Organisation[];
}

/** A merger (fusion) or demerger (spaltning) entry as the registry reports it. */
export interface CorporateEventSource {
    enhedsNummerOrganisation: number;
    organisationsNavn: Name[];
    indgaaende: Attribute[];
    udgaaende: Attribute[];
}

export interface VirksomhedMetadata {
    nyesteNavn: Name;
    nyesteBinavne: string[];
    nyesteVirksomhedsform: VirksomhedsForm;
    nyesteBeliggenhedsadresse: Address;
    nyesteHovedbranche: Branch;
    nyesteBibranche1: Branch;
    nyesteBibranche2: Branch;
    nyesteBibranche3: Branch;
    nyesteStatus: string | null;
    nyesteKontaktoplysninger: ContactInfo[];
    antalPenheder: number;
    nyesteAarsbeskaeftigelse: Employment;
    nyesteKvartalsbeskaeftigelse: QuarterlyEmployment;
    nyesteMaanedsbeskaeftigelse: MonthlyEmployment;
    nyesteErstMaanedsbeskaeftigelse: MonthlyEmployment;
    sammensatStatus: string;
    stiftelsesDato: string;
    virkningsDato: string;
}

export interface Virksomhed {
    cvrNummer: number;
    regNumber: [];
    brancheAnsvarskode: string | null;
    reklamebeskyttet: boolean;
    navne: Name[];
    binavne: Name[];
    postadresse: [];
    beliggenhedsadresse: Address[];
    telefonNummer: ContactInfo[];
    telefaxNummer: ContactInfo[];
    sekundærtTelefonNummer: ContactInfo[];
    sekundærtTelefaxNummer: ContactInfo[];
    elektroniskPost: ContactInfo[];
    hjemmeside: [];
    obligatoriskEmail: [];
    livsforloeb: Array<{
        periode: Period;
        sidstOpdateret: string;
    }>;
    hovedbranche: Branch[];
    bibranche1: Branch[];
    bibranche2: Branch[];
    bibranche3: Branch[];
    status: [];
    virksomhedsstatus: Array<{
        status: string;
        periode: Period;
        sidstOpdateret: string;
    }>;
    virksomhedsform: VirksomhedsForm[];
    aarsbeskaeftigelse: Employment[];
    kvartalsbeskaeftigelse: QuarterlyEmployment[];
    maanedsbeskaeftigelse: MonthlyEmployment[];
    erstMaanedsbeskaeftigelse: MonthlyEmployment[];
    attributter: Attribute[];
    penheder: Array<{
        pNummer: number;
        periode: Period;
        sidstOpdateret: string;
    }>;
    deltagerRelation: DeltagerRelation[];
    fusioner: CorporateEventSource[];
    spaltninger: CorporateEventSource[];
    virksomhedMetadata: VirksomhedMetadata;
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
}

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
                Vrvirksomhed: Virksomhed;
            };
        }>;
    };
}

/** A merger (fusion) or demerger (spaltning), reduced to what the response exposes. */
export interface CorporateEvent {
    /** The registry's name for the event, e.g. "Fusion". */
    name: string | null;
    /** The date the event took effect (periode.gyldigFra). */
    date: string | null;
    /** True when this company was on the receiving end (indgående). */
    incoming: boolean;
    /** True when this company was on the giving end (udgående). */
    outgoing: boolean;
}

/** The company's current registered address (beliggenhedsadresse). */
export interface CompanyAddress {
    street: string | null;
    houseNumberFrom: number | null;
    houseNumberTo: number | null;
    letterFrom: string | null;
    letterTo: string | null;
    floor: string | null;
    sideDoor: string | null;
    coName: string | null;
    poBox: string | null;
    zipCode: number | null;
    city: string | null;
    municipality: string | null;
    countryCode: string | null;
    /** Free-text address used when the address is not structured (e.g. foreign). */
    freeText: string | null;
}

/** Registered capital (KAPITAL + KAPITALVALUTA). */
export interface Capital {
    value: number | null;
    currency: string | null;
}

export interface Company {
    name: string;
    cvr: number;
    corporateForm: CorporateForm;
    financialYear: FinancialYear;
    ownershipPercentage: OwnershipPercentage;
    votingRightsPercentage: OwnershipPercentage;
    selfOwnershipPercentage?: { from: number | null; to: number | null } | null;
    dateOfIncorporation: string | null;
    /** Whether the company is listed on a stock exchange (BØRSNOTERET). */
    listed: boolean;
    /** The company's stated purpose (FORMÅL). */
    purpose: string | null;
    /** Whether the share capital is divided into classes (KAPITALKLASSER). */
    hasShareClasses: boolean;
    /** Current company status (virksomhedsstatus), e.g. "NORMAL". */
    status: string | null;
    /** Current main industry (hovedbranche), as "code - text". */
    mainIndustry: string | null;
    /** Current secondary names (binavne). */
    secondaryNames: string[];
    /** Demergers (spaltninger). */
    demergers: CorporateEvent[];
    /** Mergers (fusioner). */
    mergers: CorporateEvent[];
    /** Current registered address (beliggenhedsadresse). */
    address: CompanyAddress | null;
    /** Registered capital with its currency (KAPITAL / KAPITALVALUTA). */
    capital: Capital;
    /** First financial period (FØRSTE_REGNSKABSPERIODE_START/_SLUT). */
    firstFinancialYear: FinancialYear;
    /** Whether the company is subject to audit — false when audit is opted out (REVISION_FRAVALGT). */
    audited: boolean;
    /** The rule for who can sign on behalf of the company (TEGNINGSREGEL). */
    powerToBind: string | null;
    /**
     * Companies mentioned in the notes of THIS company's newest annual report as
     * (potentially) part of the corporate group — incl. foreign members the CVR
     * register cannot see. Entities matching a registered group member by name are
     * filtered out, so this only holds ADDITIONAL potential members. Empty when the
     * notes carry nothing usable or the annual report could not be fetched.
     * Optional because it is attached in an enrichment pass after the group is built.
     */
    groupEntitiesFromNotes?: GroupEntityFromNotes[];
}

export interface CorporateGroup extends Company {
    subsidiaries: CorporateGroup[] | null;
}

export interface CompanyFlattened extends Company {
    level: number;
    parent: {
        name: string;
        cvr: number;
    } | null;
}

export type CorporateGroupFlattened = CompanyFlattened[];
