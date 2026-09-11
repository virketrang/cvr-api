import { AppError, ErrorCode } from "../../utils/api-error.js";
import { formatDanishInteger } from "../../utils/format-number.js";
import { getAccount } from "./account.js";
import type { AccountContainer, FinancialIncomeRow, TaxonomyRow } from "./project-resolution.types.js";

/**
 * The workbook's asset taxonomy (ASSET_TAXONOMY_TREE) loaded into an index.
 * Pure port of the VBA Taxonomy class: the tables still live on the Settings
 * sheet and arrive with each request; only the computation moved here.
 */
export class TaxonomyIndex {
    private readonly meta = new Map<string, TaxonomyRow>();
    private readonly children = new Map<string, string[]>();

    constructor(rows: TaxonomyRow[]) {
        for (const row of rows) {
            const concept = row.concept.trim();
            if (!concept) continue;

            const entry: TaxonomyRow = {
                ...row,
                concept,
                label: row.label.trim(),
                parent: row.parent.trim(),
                passiveClassification: row.passiveClassification.trim().toUpperCase(),
                passiveNote: row.passiveNote.trim(),
                valuationClassification: row.valuationClassification.trim(),
                valuationNote: row.valuationNote.trim(),
            };
            this.meta.set(concept, entry);

            if (entry.parent) {
                const siblings = this.children.get(entry.parent) ?? [];
                siblings.push(concept);
                this.children.set(entry.parent, siblings);
            }
        }
    }

    public entry(concept: string): TaxonomyRow | undefined {
        return this.meta.get(concept);
    }

    public childrenOf(concept: string): string[] {
        return this.children.get(concept) ?? [];
    }

    public isParent(concept: string): boolean {
        return this.children.has(concept);
    }

    /** The label of a concept, falling back to the concept name itself. */
    public labelOf(concept: string): string {
        return this.meta.get(concept)?.label || concept;
    }

    /** Whether any descendant of `concept` is reported with a non-zero value. */
    public hasReportedDescendant(concept: string, balancesheet: AccountContainer): boolean {
        for (const child of this.childrenOf(concept)) {
            if (isConceptReported(child, balancesheet)) return true;
            if (this.hasReportedDescendant(child, balancesheet)) return true;
        }
        return false;
    }

    /**
     * The effective value of a concept's subtree: its own value when no
     * descendant is reported, otherwise the sum of its children's effective
     * values — avoiding parent/child double counting.
     */
    public effectiveSubtreeValue(concept: string, balancesheet: AccountContainer): number {
        if (!this.hasReportedDescendant(concept, balancesheet)) {
            return getAccount(balancesheet, concept) ?? 0;
        }
        let total = 0;
        for (const child of this.childrenOf(concept)) {
            total += this.effectiveSubtreeValue(child, balancesheet);
        }
        return total;
    }

    /**
     * Verifies that every reported parent equals the sum of its children's
     * effective values (within `tolerance`), and that total assets match the
     * sum of all leaves. Returns Danish issue texts matching the VBA ones.
     */
    public checkBalanceCompleteness(balancesheet: AccountContainer | null, tolerance = 0): string[] {
        const issues: string[] = [];
        if (!balancesheet) return issues;

        for (const parentConcept of this.children.keys()) {
            if (!isConceptReported(parentConcept, balancesheet)) continue;
            if (!this.hasReportedDescendant(parentConcept, balancesheet)) continue;

            const parentValue = getAccount(balancesheet, parentConcept) ?? 0;
            let childSum = 0;
            for (const child of this.childrenOf(parentConcept)) {
                childSum += this.effectiveSubtreeValue(child, balancesheet);
            }

            const diff = parentValue - childSum;
            if (Math.abs(diff) > tolerance) {
                if (diff > 0) {
                    issues.push(
                        `${parentConcept}: rapporteret ${formatDanishInteger(parentValue)} men underposterne summer kun til ` +
                            `${formatDanishInteger(childSum)} (mangler ${formatDanishInteger(diff)})`,
                    );
                } else {
                    issues.push(
                        `${parentConcept}: underposterne summer til ${formatDanishInteger(childSum)} men posten er kun ` +
                            `rapporteret til ${formatDanishInteger(parentValue)} (overskydende ${formatDanishInteger(-diff)})`,
                    );
                }
            }
        }

        // The VBA original meant to compare total assets against the leaf sum but
        // read the value from the wrong object, so its check never ran. This is
        // the intended comparison.
        if (isConceptReported("assets", balancesheet)) {
            const assetsValue = getAccount(balancesheet, "assets") ?? 0;
            const leafSum = this.effectiveSubtreeValue("assets", balancesheet);
            const totalDiff = assetsValue - leafSum;
            if (Math.abs(totalDiff) > tolerance) {
                issues.push(
                    `assets: aktiver i alt rapporteret ${formatDanishInteger(assetsValue)} men summen af alle leaves er ` +
                        `${formatDanishInteger(leafSum)} (difference ${formatDanishInteger(totalDiff)})`,
                );
            }
        }

        return issues;
    }

    /** All concepts (parents and leaves) with the given valuation classification. */
    public conceptsByValuationClass(className: string): string[] {
        const result: string[] = [];
        for (const [concept, entry] of this.meta) {
            if (entry.valuationClassification === className) result.push(concept);
        }
        return result;
    }

    /** Leaf concepts (no children) with the given valuation classification. */
    public leafConceptsByValuationClass(className: string): string[] {
        return this.conceptsByValuationClass(className).filter((concept) => !this.isParent(concept));
    }

    /** Leaf concepts of a class with a specific distribution-key weight. */
    public leafConceptsByValuationClassAndKey(className: string, distributionKey: number): string[] {
        return this.leafConceptsByValuationClass(className).filter(
            (concept) => this.meta.get(concept)?.distributionKey === distributionKey,
        );
    }
}

/**
 * The workbook's financial-income taxonomy (FINANCIAL_INCOME_TAXONOMY) as a
 * concept → row lookup. A duplicated concept is a configuration error in the
 * Settings sheet and rejected, matching the VBA loader.
 */
export function buildFinancialIncomeIndex(rows: FinancialIncomeRow[]): Map<string, FinancialIncomeRow> {
    const index = new Map<string, FinancialIncomeRow>();
    rows.forEach((row, i) => {
        const concept = row.concept.trim();
        if (!concept) return;
        if (index.has(concept)) {
            throw new AppError(
                ErrorCode.INVALID_INPUT,
                `Dublet i indkomsttabellen: konceptet '${concept}' optræder mere end én gang (række ${i + 1}).`,
            );
        }
        index.set(concept, {
            ...row,
            concept,
            label: row.label.trim(),
            classification: row.classification.trim().toUpperCase(),
            note: row.note.trim(),
        });
    });
    return index;
}

function isConceptReported(concept: string, balancesheet: AccountContainer): boolean {
    const value = getAccount(balancesheet, concept);
    return value !== undefined && value !== 0;
}
