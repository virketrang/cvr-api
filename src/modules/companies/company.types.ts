/** The few registry fields the lookup asks for (`_source` filter), nothing else. */
export interface CompanyLookupSource {
    Vrvirksomhed: {
        cvrNummer: number;
        virksomhedMetadata?: {
            nyesteNavn?: { navn?: string | null } | null;
            sammensatStatus?: string | null;
        } | null;
    };
}

export interface CompanyLookupResponse {
    hits: {
        total: number | { value: number };
        hits: { _source: CompanyLookupSource }[];
    };
}

/** What the lookup endpoint returns: enough to confirm the CVR number and show a name. */
export interface CompanySummary {
    cvr: number;
    name: string;
    /** The registry's composite status text, e.g. "NORMAL", "OPLØST EFTER FUSION". */
    status: string | null;
    /** False when the status says the company is dissolved, deleted or ceased. */
    active: boolean;
}
