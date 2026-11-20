import balanceSheetConcepts from "./balance-sheet-concepts.json" with { type: "json" };
import type { ExtensionConcepts } from "./annual-report.extension.js";
import type { Account, AnnualReport } from "./annual-report.types.js";

/**
 * A balance sheet amount a filing tags but the mapping does not use: an
 * element of the company's own extension, or a standard element with no field
 * of its own. These amounts never enter the report's statements. They exist
 * only to explain, in a validation note, why a total does not add up.
 */
export interface UnmappedFact {
    /** The element as tagged, e.g. "easyx:EasyX_1530104987" or "ifrs-full:NoncurrentPrepayments". */
    concept: string;
    /** Namespace URI and local name, which identify an extension element in its package. */
    namespace: string;
    name: string;
    /** True for elements the filer defined itself. */
    extension: boolean;
    value: number;
    unit: string | null;
    /** Danish label: the taxonomy's for a standard element, the company's for an extension. */
    label: string | null;
    /** Debit = asset side, credit = equity and liabilities; null when not known. */
    balance: "debit" | "credit" | null;
}

type StandardConcept = { label: string | null; balance: "debit" | "credit" };
const STANDARD_BALANCE_SHEET = balanceSheetConcepts as Record<string, StandardConcept>;

/** The standard balance sheet concept behind "fsa:X" / "ifrs-full:X" / "ifrs-dk:X", if the taxonomies place it there. */
export function standardBalanceSheetConcept(qname: string): StandardConcept | undefined {
    return STANDARD_BALANCE_SHEET[qname];
}

// Kept beside the report rather than in it, so the amounts can never be
// serialised into the response alongside the known figures.
const unmappedByReport = new WeakMap<AnnualReport<Account>, UnmappedFact[]>();
const extensionPackageByReport = new WeakMap<AnnualReport<Account>, string>();

export function setUnmappedFacts(report: AnnualReport<Account>, facts: UnmappedFact[]): void {
    unmappedByReport.set(report, facts);
}

export function unmappedFactsOf(report: AnnualReport<Account>): UnmappedFact[] {
    return unmappedByReport.get(report) ?? [];
}

/** The filing's extension package, when it has one (IFRS-DK and ESEF filings). */
export function setExtensionPackageUrl(report: AnnualReport<Account>, url: string): void {
    extensionPackageByReport.set(report, url);
}

export function extensionPackageUrlOf(report: AnnualReport<Account>): string | undefined {
    return extensionPackageByReport.get(report);
}

/**
 * Fills in label and balance side of extension elements from the company's
 * package, and drops those the company does not present in its balance sheet.
 * Extension elements without a package stay unknown and are never used.
 */
export function applyExtensionPackage(report: AnnualReport<Account>, concepts: ExtensionConcepts | null): void {
    const facts = unmappedFactsOf(report);
    unmappedByReport.set(
        report,
        facts.flatMap((fact) => {
            if (!fact.extension) return [fact];
            const concept = concepts?.get(`${fact.namespace}#${fact.name}`);
            if (!concept || !concept.inBalanceSheet || !concept.balance) return [];
            return [{ ...fact, label: concept.label, balance: concept.balance }];
        }),
    );
}

/**
 * The unmapped amounts that make up a deviation exactly: the one combination
 * of amounts on the right side whose sum `matches` the deviation. Null when
 * no combination does, or when more than one does — the explanation must be
 * unambiguous, or it is not given.
 */
export function explainDeviation(
    facts: UnmappedFact[],
    side: "debit" | "credit",
    matches: (sum: number) => boolean,
): UnmappedFact[] | null {
    const pool = facts.filter((fact) => fact.balance === side && fact.value !== 0);
    if (pool.length === 0 || pool.length > 16) return null;

    let found: UnmappedFact[] | null = null;
    for (let mask = 1; mask < 1 << pool.length; mask++) {
        let sum = 0;
        for (let i = 0; i < pool.length; i++) if (mask & (1 << i)) sum += pool[i].value;
        if (!matches(sum)) continue;
        if (found) return null;
        found = pool.filter((_, i) => mask & (1 << i));
    }
    return found;
}
