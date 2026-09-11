import type { GroupCompany } from "./project-resolution.types.js";

/**
 * Computes each company's indirect ownership by multiplying the wizard-entered
 * direct ownership up the parent chain. This is the exact algorithm the wizard's
 * `addExactOwnershipPercentages()` JavaScript ran client-side (and the old
 * `indirect-share.js` prototype), including its JS coercion semantics:
 *
 * - Level 0 (the ultimate parent): indirect = its own direct ownership.
 * - Ancestors at level 0 are skipped — only intermediate owners multiply in.
 * - An ancestor with unknown (null) direct ownership makes the result null.
 * - A company with null direct ownership that still gets multiplied ends at 0
 *   (JS `null * x === 0`) — kept for parity with the wizard.
 *
 * Returns the indirect ownership per company, in input order.
 */
export function computeIndirectOwnerships(companies: GroupCompany[]): Array<number | null> {
    const byCvr = new Map<string, GroupCompany>();
    for (const company of companies) {
        byCvr.set(company.cvr, company);
    }

    return companies.map((company) => {
        if (company.level === 0) return company.directOwnership;

        let indirect: number | null = company.directOwnership;
        let currentParent = company.parent;

        while (currentParent) {
            const parentCompany = currentParent.cvr === null ? undefined : byCvr.get(currentParent.cvr);

            if (parentCompany && parentCompany.level > 0) {
                const parentOwnership = parentCompany.directOwnership;
                if (parentOwnership === null) {
                    indirect = null;
                    break;
                }
                indirect = (indirect ?? 0) * parentOwnership;
            }

            currentParent = parentCompany ? parentCompany.parent : null;
        }

        return indirect;
    });
}

/**
 * Whether a company is included in the passive-asset test: the ultimate parent
 * always is; every other company needs an indirect ownership of at least the
 * configured minimum.
 */
export function qualifiesForPassiveTest(
    index: number,
    indirectOwnership: number | null,
    minIndirectOwnership: number,
): boolean {
    if (index === 1) return true;
    return indirectOwnership !== null && indirectOwnership >= minIndirectOwnership;
}

/**
 * Whether a company is included in the project at all. Non-parent companies with
 * a voting-rights lower bound below the configured minimum are skipped entirely
 * (no overview row, no sheets) — mirroring AppWorkbook.CreateWorkbook. A missing
 * voting-rights interval counts as 0.
 */
export function passesVotingGate(index: number, votingRightsFrom: number | null, minVotingRights: number): boolean {
    if (index === 1) return true;
    return (votingRightsFrom ?? 0) >= minVotingRights;
}
