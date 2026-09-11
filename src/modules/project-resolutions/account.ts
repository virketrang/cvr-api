import type { AccountContainer, AccountValue, Component } from "./project-resolution.types.js";

/**
 * Reads a single account value from a statement section. Mirrors the VBA
 * Report.GetAccount contract: the entry must exist, be an object, and carry a
 * numeric `value` — anything else reads as "not reported" (undefined).
 */
export function getAccount(container: AccountContainer | null | undefined, concept: string): number | undefined {
    if (!container) return undefined;
    const entry = container[concept];
    if (entry === null || entry === undefined || typeof entry !== "object") return undefined;
    const value = entry.value;
    if (typeof value !== "number" || Number.isNaN(value)) return undefined;
    return value;
}

/** GetAccount with the VBA GetAccountValue coercion: missing reads as 0. */
export function getAccountValue(container: AccountContainer | null | undefined, concept: string): number {
    return getAccount(container, concept) ?? 0;
}

/**
 * Picks the first concept in `concepts` that is reported (numeric), mirroring
 * Report.InsertAccount's fallback-array behavior. `usedFallback` is true when a
 * concept other than the first supplied the value.
 */
export function selectWithFallback(
    container: AccountContainer | null | undefined,
    concepts: string[],
): { concept: string; value: number; usedFallback: boolean } | null {
    for (let i = 0; i < concepts.length; i++) {
        const value = getAccount(container, concepts[i]);
        if (value !== undefined) {
            return { concept: concepts[i], value, usedFallback: i > 0 };
        }
    }
    return null;
}

/** selectWithFallback for a single concept, as a plain AccountValue. */
export function selectAccount(container: AccountContainer | null | undefined, concept: string): AccountValue | null {
    const value = getAccount(container, concept);
    return value === undefined ? null : { concept, value };
}

/**
 * Collects the reported, non-zero values of `concepts` as components — exactly
 * the terms Formula.Create would have baked into an "=a+b" formula string. The
 * client rebuilds that formula from these; values stay raw and signed here.
 */
export function components(
    container: AccountContainer | null | undefined,
    concepts: readonly string[],
    labelOf: (concept: string) => string = (concept) => concept,
): Component[] {
    const result: Component[] = [];
    for (const concept of concepts) {
        if (!concept) continue;
        const value = getAccount(container, concept);
        if (value === undefined || value === 0) continue;
        result.push({ concept, label: labelOf(concept), value });
    }
    return result;
}
