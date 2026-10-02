import AnnualReportService from "../annual-reports/annual-report.service.js";
import type { BatchAnnualReportResult } from "../annual-reports/annual-report.types.js";
import { AppError, ErrorCode } from "../../utils/api-error.js";
import { normalizeCvr } from "../../utils/normalize-cvr.js";
import { computeIndirectOwnerships, passesVotingGate, qualifiesForPassiveTest } from "./ownership.js";
import { buildFinancialIncomeIndex, TaxonomyIndex } from "./taxonomy-engine.js";
import { resolveValuation, type ResolutionContext } from "./valuation-resolver.js";
import { resolvePassiveTest } from "./passive-test-resolver.js";
import type { ProjectResolutionRequestBody } from "./project-resolution.schema.js";
import type {
    AccountContainer,
    GroupCompany,
    ProjectResolutionResponse,
    ProjectWarning,
    ResolutionSettings,
    ResolvedCompany,
    SuccessionMode,
} from "./project-resolution.types.js";

/** Injectable dependencies, overridable in tests. */
export interface ResolveProjectDependencies {
    fetchAnnualReportsBatch: typeof AnnualReportService.getAnnualReportsBatch;
    today: Date;
}

export default abstract class ProjectResolutionService {
    /**
     * Resolves a complete workbook project: qualification, overview rows,
     * valuation inputs, passive-asset-test line items and notes for every
     * company in the corporate group. This is the server-side successor to
     * AppWorkbook.CreateWorkbook's data logic — the workbook only renders the
     * result into its sheets.
     */
    public static async resolveProject(
        body: ProjectResolutionRequestBody,
        dependencies?: Partial<ResolveProjectDependencies>,
    ): Promise<ProjectResolutionResponse> {
        const deps: ResolveProjectDependencies = {
            fetchAnnualReportsBatch: AnnualReportService.getAnnualReportsBatch.bind(AnnualReportService),
            today: new Date(),
            ...dependencies,
        };

        const settings = body.settings as ResolutionSettings;
        const mode = resolveSuccessionMode(body.formData.successionPeriod, settings);
        const group = normalizeGroup(body.formData.corporateGroup);
        const indirectOwnerships = computeIndirectOwnerships(group);

        if (group.length > settings.maximumNumberOfCompanies) {
            throw new AppError(
                ErrorCode.GROUP_TOO_LARGE,
                `Koncernen er for stor. Der er ${group.length} selskaber i koncernen, men kun ` +
                    `${settings.maximumNumberOfCompanies} ark i projektmappen.`,
            );
        }

        // Capacity pre-check for the passive-asset test. Faithful to the VBA
        // original, this counts qualifying companies WITHOUT the voting gate that
        // later excludes some of them from the project.
        if (mode !== "NO_CALCULATION") {
            const qualifyingCount = group.filter((_, i) =>
                qualifiesForPassiveTest(i + 1, indirectOwnerships[i], settings.minIndirectOwnership),
            ).length;

            if (qualifyingCount > settings.maxPassiveAssetTestCompanies) {
                throw new AppError(
                    ErrorCode.TOO_MANY_PASSIVE_COMPANIES,
                    `Koncernen har ${qualifyingCount} selskaber, der skal med i passiv-aktiv-testen ` +
                        `(moderselskabet samt datterselskaber med mindst ` +
                        `${Math.round(settings.minIndirectOwnership * 100)} % indirekte ejerandel), men ` +
                        `Successionsopgørelsen har kun plads til ${settings.maxPassiveAssetTestCompanies} selskaber. ` +
                        `Vælg en mindre koncern, eller bed Sigfred udvide Successionsopgørelsen.`,
                );
            }
        }

        const taxonomy = new TaxonomyIndex(settings.assetTaxonomy);
        const financialIncome = buildFinancialIncomeIndex(settings.financialIncomeTaxonomy);
        const currencyNameOf = buildCurrencyLookup(settings);

        const batch = await deps.fetchAnnualReportsBatch(group.map((company) => Number(company.cvr)));

        // Dedupe batch results by normalized CVR — first entry wins (VBA parity).
        const reportsByCvr = new Map<string, BatchAnnualReportResult>();
        for (const entry of batch.results) {
            const key = normalizeCvr(entry.cvrNumber);
            if (!reportsByCvr.has(key)) reportsByCvr.set(key, entry);
        }

        const warnings: ProjectWarning[] = [];
        const excludedCompanies: ProjectResolutionResponse["excludedCompanies"] = [];
        const companies: ResolvedCompany[] = [];
        let passiveSlots = 0;

        group.forEach((company, i) => {
            const index = i + 1;
            const isParent = index === 1;
            const indirect = indirectOwnerships[i];

            if (!passesVotingGate(index, company.votingRightsFrom, settings.minVotingRights)) {
                excludedCompanies.push({
                    cvr: company.cvr,
                    name: company.name,
                    reason:
                        `Selskabet er udeladt, fordi stemmerettighedernes nedre grænse ` +
                        `(${Math.round((company.votingRightsFrom ?? 0) * 100)} %) er under minimumskravet ` +
                        `(${Math.round(settings.minVotingRights * 100)} %).`,
                });
                return;
            }

            const companyResult = reportsByCvr.get(company.cvr);
            const reportsAvailable = companyResult?.status === "success";
            const reports = reportsAvailable ? companyResult.results : [];

            if (companyResult && companyResult.status !== "success") {
                warnings.push({
                    code: "REPORTS_FAILED",
                    cvr: company.cvr,
                    companyName: company.name,
                    reportingPeriodEndDate: null,
                    message:
                        `Kunne ikke hente årsrapporter for ${company.name} (${company.cvr}): ` +
                        `${companyResult.message ?? "ukendt fejl"}`,
                });
            }
            for (const skip of companyResult?.skipped ?? []) {
                warnings.push({
                    code: "REPORT_SKIPPED",
                    cvr: company.cvr,
                    companyName: company.name,
                    reportingPeriodEndDate: skip.reportingPeriodEndDate,
                    message:
                        `${company.name}: årsrapporten for ${skip.reportingPeriodEndDate ?? "ukendt periode"} ` +
                        `kunne ikke læses – ${skip.message}`,
                });
            }

            // IFRS filers need not tag the parent company's own statements, and most
            // do not: such reports carry group figures only, so the valuation and the
            // passive test get nothing for them. Say so once, with the periods.
            const consolidatedOnly = reports.filter((report) => report.scope === "consolidated");
            if (consolidatedOnly.length > 0) {
                warnings.push({
                    code: "SOLO_FIGURES_MISSING",
                    cvr: company.cvr,
                    companyName: company.name,
                    reportingPeriodEndDate: consolidatedOnly[0].reportingPeriod.reportingPeriodEndDate,
                    message:
                        `${company.name}: årsrapporten er aflagt efter IFRS og indeholder kun koncerntal struktureret ` +
                        `(${consolidatedOnly.map((report) => report.reportingPeriod.reportingPeriodEndDate).join(", ")}). ` +
                        `Selskabets egne tal skal indtastes manuelt fra den læsbare årsrapport.`,
                });
            }

            const ctx: ResolutionContext = {
                mode,
                isParent,
                companyIndex: index,
                unpublishedAnnualReport: body.formData.unpublishedAnnualReport,
                group,
                taxonomy,
                currencyNameOf,
                today: deps.today,
            };

            const valuation = resolveValuation(reports, ctx);

            const includeInPassiveTest =
                mode !== "NO_CALCULATION" && qualifiesForPassiveTest(index, indirect, settings.minIndirectOwnership);

            let passiveAssetTest: ResolvedCompany["passiveAssetTest"] = null;
            let passiveCompanySlot: number | null = null;
            if (includeInPassiveTest) {
                passiveSlots += 1;
                passiveCompanySlot = passiveSlots;
                passiveAssetTest = resolvePassiveTest(reports, {
                    mode,
                    passiveSlot: passiveCompanySlot,
                    unpublishedAnnualReport: body.formData.unpublishedAnnualReport,
                    taxonomy,
                    financialIncome,
                    currencyNameOf,
                    today: deps.today,
                });
            }

            if (reports.length > 0) {
                const firstReport = reports[0];
                for (const issue of taxonomy.checkBalanceCompleteness(
                    firstReport.balancesheet as unknown as AccountContainer,
                )) {
                    warnings.push({
                        code: "BALANCE_INCOMPLETE",
                        cvr: company.cvr,
                        companyName: company.name,
                        reportingPeriodEndDate: firstReport.reportingPeriod.reportingPeriodEndDate,
                        message: `${company.name}: ${issue}`,
                    });
                }
            }

            companies.push({
                index,
                cvr: company.cvr,
                name: company.name,
                isParent,
                overviewRow: {
                    name: company.name,
                    cvr: company.cvr,
                    corporateForm: corporateFormLabel(company.corporateFormCode, settings),
                    owner: company.parent?.name ?? "",
                    reportingPeriods: reportingPeriodsFor(companyResult, mode, settings),
                    taxRate: settings.corporateTaxRate,
                    directOwnershipPercent: (company.directOwnership ?? 0) * 100,
                    // The current VBA batch flow never passes the wizard's checkbox
                    // through to the overview, so it always lands as "NEJ". Kept for
                    // parity; the wizard's choice is in `consolidateRequested`.
                    consolidate: false,
                },
                ownership: {
                    direct: company.directOwnership,
                    indirect,
                    votingRightsFrom: company.votingRightsFrom,
                    votingRightsTo: company.votingRightsTo,
                },
                consolidateRequested: company.consolidate,
                includeInPassiveTest,
                passiveCompanySlot,
                reportStatus: {
                    status: companyResult ? companyResult.status : "missing",
                    errorCode: companyResult?.errorCode ?? null,
                    message: companyResult?.message ?? null,
                    skipped: (companyResult?.skipped ?? []).map((skip) => ({
                        reportingPeriodEndDate: skip.reportingPeriodEndDate,
                        message: skip.message,
                    })),
                },
                unpublishedShift: valuation.unpublishedShift,
                valuation: {
                    notes: valuation.notes,
                    property: valuation.property,
                    years: valuation.years,
                },
                passiveAssetTest,
            });
        });

        const hasFailures = warnings.some((w) => w.code === "REPORTS_FAILED" || w.code === "REPORT_SKIPPED");

        return {
            status: hasFailures ? "partial" : "success",
            successionMode: mode,
            successionPeriodLabel: body.formData.successionPeriod,
            currencyCode: body.formData.currencyCode,
            dateOfTransfer: body.formData.dateOfTransfer,
            numberOfCompanies: companies.length,
            numberOfPassiveTestCompanies: passiveSlots,
            excludedCompanies,
            warnings,
            companies,
        };
    }
}

/** Matches the raw Danish label against the five Settings-sheet mode labels. */
export function resolveSuccessionMode(label: string, settings: ResolutionSettings): SuccessionMode {
    const normalized = label.trim().toUpperCase();
    const modes: Array<[string, SuccessionMode]> = [
        [settings.successionModes.noCalculation, "NO_CALCULATION"],
        [settings.successionModes.dateOfTransfer, "DATE_OF_TRANSFER"],
        [settings.successionModes.oneYear, "ONE_YEAR"],
        [settings.successionModes.twoYear, "TWO_YEAR"],
        [settings.successionModes.threeYear, "THREE_YEAR"],
    ];
    for (const [candidate, mode] of modes) {
        if (candidate.trim().toUpperCase() === normalized) return mode;
    }
    throw new AppError(
        ErrorCode.INVALID_SUCCESSION_MODE,
        `Ukendt passiv-aktiv-test tilstand: '${normalized}'. Forventede en af de fem PASSIVE_ASSET_TEST-værdier fra Indstillinger.`,
    );
}

function normalizeGroup(corporateGroup: ProjectResolutionRequestBody["formData"]["corporateGroup"]): GroupCompany[] {
    return corporateGroup.map((company) => ({
        cvr: normalizeCvr(company.cvr),
        name: company.name,
        level: company.level,
        parent: company.parent
            ? {
                  name: company.parent.name,
                  cvr: company.parent.cvr === null ? null : normalizeCvr(company.parent.cvr),
              }
            : null,
        corporateFormCode: company.corporateForm?.code ?? null,
        votingRightsFrom: company.votingRightsPercentage?.interval.from ?? null,
        votingRightsTo: company.votingRightsPercentage?.interval.to ?? null,
        directOwnership: company.ownershipPercentage?.directOwnership ?? null,
        consolidate: company.consolidate,
    }));
}

/**
 * The overview's corporate-form label: registry codes 60 and 80 are limited
 * liability companies, anything else with a known corporate form counts as
 * personally owned. Companies without corporate-form data get an empty label.
 */
function corporateFormLabel(code: number | null, settings: ResolutionSettings): string {
    if (code === null) return "";
    return code === 60 || code === 80
        ? settings.corporateFormLabels.limitedLiabilityCompany
        : settings.corporateFormLabels.soleProprietorship;
}

/**
 * Number of reporting periods for the overview row, from the Settings-sheet
 * lookup vector for the mode. Mirrors CreateWorkbook's Select Case exactly:
 * fewer than 3 reports use the first entry, 7+ the last, and 3-6 index the
 * vector at (totalReports - 1), clamped to its length. Companies without
 * fetched reports default to 3.
 */
export function reportingPeriodsFor(
    companyResult: { status: string; total: number } | undefined,
    mode: SuccessionMode,
    settings: ResolutionSettings,
): number {
    if (!companyResult || companyResult.status !== "success") return 3;

    const vector =
        mode === "THREE_YEAR"
            ? settings.reportingPeriodsLookup.threeYear
            : mode === "TWO_YEAR"
              ? settings.reportingPeriodsLookup.twoYear
              : settings.reportingPeriodsLookup.oneYear;
    if (vector.length === 0) return 3;

    const totalReports = companyResult.total;
    if (totalReports < 3) return vector[0];
    if (totalReports >= 7) return vector[vector.length - 1];

    const oneBasedIndex = totalReports >= vector.length + 2 ? vector.length : totalReports - 1;
    return vector[Math.min(oneBasedIndex, vector.length) - 1];
}

function buildCurrencyLookup(settings: ResolutionSettings): (unit: string) => string {
    const byCode = new Map<string, string>();
    for (const currency of settings.currencies) {
        const code = currency.code.trim().toUpperCase();
        if (code && !byCode.has(code)) byCode.set(code, currency.name.trim());
    }
    return (unit: string) => byCode.get(unit.trim().toUpperCase()) ?? "";
}
