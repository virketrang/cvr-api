Implementeringsguide: Valideringskontroller i regnskabs-API'et

Guide til Claude Code. Formål: implementér automatiske kontroller af de udtrukne
regnskabstal i API'et (Hono/TypeScript, Cloud Run), så fejl i XBRL-udtrækket
opdages, før tallene lander i Excel-værdiansættelsen. Kontrollerne er rådgivende:
de ændrer aldrig tal og blokerer aldrig et svar — de beriger svaret med strukturerede
fund, som regnearket senere kan vise som dosmerseddel-noter.

0. Orientering før du koder

Find modulet, der bygger results[] i annual-reports-svaret (objektet med
reportingPeriod, unit, incomeStatement, balancesheet, notes,
relatedEntities, consolidatedFinancialStatements, warnings).
Valideringen skal køre efter udtrækket pr. rapport og efter at hele
selskabets rapportliste er samlet (nogle kontroller er tværgående mellem år).
Undersøg om XBRL-parseren har adgang til decimals-attributten pr. faktum.
Hvis ja: bevar den (bruges til tolerance). Hvis nej: tolerance udledes af
tallene (se §2).
Rør ikke ved eksisterende felter. Backward compatibility er et krav:
Excel-klienten læser i dag status, results, total, skipped — de skal
være uændrede.

1. Datamodel og svarudvidelse

ts// src/validation/types.ts
export type Severity = 'error' | 'warning' | 'info';

export interface ValidationFinding {
id: string; // fx "BAL-001"
severity: Severity;
message: string; // dansk, brugervendt — vises 1:1 i regnearket
expected?: number;
actual?: number;
deviation?: number; // actual - expected
concepts?: string[]; // involverede XBRL-koncepter
period?: string; // "2024-10-01/2025-09-30" — udfyldes altid ved
// periodespecifikke fund
}

export interface ValidationSummary {
errors: number;
warnings: number;
infos: number;
}

Udvid svaret:

Pr. rapport i results[]: nyt felt validation: ValidationFinding[] (tom
array når alt er rent).
Pr. selskab (batch-entry): nyt felt validationSummary: ValidationSummary
der aggregerer på tværs af selskabets rapporter plus de tværgående fund
(som lægges på den nyeste rapports validation med period sat).

2. Tolerance

Alle sammenligninger sker med tolerance — aldrig eksakt lighed.

ts// src/validation/tolerance.ts
export function roundingUnit(values: number[]): number {
// Filings i hele tusinder => alle tal % 1000 === 0.
const nonZero = values.filter(v => v !== 0);
if (nonZero.length === 0) return 1;
for (const unit of [1_000_000, 1_000]) {
if (nonZero.every(v => Math.abs(v) % unit === 0)) return unit;
}
return 1;
}

export function withinTolerance(expected: number, actual: number, unit: number): boolean {
const tol = Math.max(unit, 0.001 \* Math.max(Math.abs(expected), Math.abs(actual)));
return Math.abs(expected - actual) <= tol;
}

Har parseren decimals fra XBRL, så brug den i stedet for heuristikken
(decimals: -3 ⇒ unit 1000). roundingUnit beregnes pr. rapport over alle
udtrukne beløb i den rapport.

3. Arkitektur: kontrolregister

Hver kontrol er en ren funktion. Register-mønster, så kontroller kan slås
fra individuelt via konfiguration (env eller config-fil):

ts// src/validation/registry.ts
export interface ReportContext {
report: ExtractedReport; // én rapport
allReports: ExtractedReport[]; // hele selskabets liste, nyeste først
unit: number; // roundingUnit for rapporten
}

export interface Check {
id: string;
scope: 'report' | 'company'; // company-scope kører én gang pr. selskab
run(ctx: ReportContext): ValidationFinding[];
}

export const registry: Check[] = [ /* alle kontroller */ ];

export function runValidation(reports: ExtractedReport[], disabled: Set<string>): void {
// muterer kun validation-felterne
}

Hjælpere alle kontroller skal bruge:

tsfunction val(section: Record<string, Fact> | undefined, concept: string): number | undefined {
const f = section?.[concept];
return typeof f?.value === 'number' ? f.value : undefined;
}
// present(...) = val(...) !== undefined

Vigtig regel: en kontrol må kun fyre, når de nødvendige koncepter faktisk
er indberettet. Manglende koncepter er aldrig i sig selv en fejl (B-regnskaber
udelader lovligt store dele af skemaet). Betingede kontroller springes tavst
over — de producerer ikke "kunne ikke kontrolleres"-støj.

4. Kontrollerne

Severity-principper: brud på en regnskabsidentitet = error (udtrækket er
forkert eller ufuldstændigt); afstemning der bør holde men har lovlige
undtagelser = warning; rene opmærksomhedspunkter = info.

Balancen (scope: report)

IdKontrolSeverityBAL-001assets == liabilitiesAndEquityerrorBAL-002assets == nonCurrentAssets + currentAssets (når begge børn findes)errorBAL-003nonCurrentAssets == intangibleAssets + propertyPlantAndEquipment + longtermInvestmentsAndReceivables (kun tilstedeværende led)errorBAL-004liabilitiesAndEquity == equity + provisions + liabilitiesOtherThanProvisionserrorBAL-005Residual-motor: for hver knude i subtotal-træet med mindst ét indberettet barn: parent − Σ(indberettede børn) skal være ≤ toleranceerror

BAL-005 er den vigtigste kontrol i hele sættet. Den kræver et forældre→børn-træ
over koncepterne. Definér det som data:

ts// src/validation/conceptTree.ts — udsnit; udfyld fra den fulde taksonomi
export const conceptTree: Record<string, string[]> = {
assets: ['nonCurrentAssets', 'currentAssets'],
nonCurrentAssets: ['intangibleAssets', 'propertyPlantAndEquipment', 'longtermInvestmentsAndReceivables'],
intangibleAssets: ['goodwill', 'acquiredLicences', 'acquiredTrademarks',
'acquiredOtherSimilarRights', 'completedDevelopmentProjects', /* ... */],
propertyPlantAndEquipment: ['landAndBuildings', 'land', 'buildings', 'planes',
'fixturesFittingsToolsAndEquipment', 'propertyPlantAndEquipmentInProgress', /* ... */],
longtermInvestmentsAndReceivables: ['longtermInvestmentsInGroupEnterprises', 'longtermInvestmentsInAssociates',
'longtermReceivablesFromGroupEnterprises', 'otherLongtermReceivables',
'depositsLongtermInvestmentsAndReceivables', /* ... */],
currentAssets: ['inventories', 'shorttermReceivables', 'shorttermInvestments',
'cashAndCashEquivalents', /* ... */],
shorttermReceivables: ['shorttermTradeReceivables', 'shorttermReceivablesFromGroupEnterprises',
'shorttermReceivablesFromAssociates', 'currentDeferredTaxAssets',
'shorttermTaxReceivables', 'otherShorttermReceivables', 'deferredIncomeAssets'],
equity: ['contributedCapital', 'reserveForNetRevaluationAccordingToEquityMethod',
'reserveForCurrentValueOfHedging', 'restOfOtherReserves', 'retainedEarnings',
'proposedDividendRecognisedInEquity', 'proposedExtraordinaryDividendRecognisedInEquity', /* ... */],
employeeBenefitsExpense: ['wagesAndSalaries', 'postemploymentBenefitExpense',
'socialSecurityContributions', 'otherEmployeeExpense'],
// ... resten af træet. Genbrug klassifikationen fra ASSET_TAXONOMY_TREE i
// regnearket som facitliste for hvilke koncepter der findes.
};

Residualmeddelelsen skal navngive de manglende kroner OG børnene:
"Sammentælling af intangibleAssets afviger 54.135.000 kr. fra summen af indberettede underposter (goodwill, acquiredTrademarks). Muligvis manglende underpost i udtrækket." — det er præcis denne kontrol, der ville have fanget
den manglende acquiredOtherSimilarRights.

Bemærk to fælder: (1) landAndBuildings og land/buildings er alternative
niveauer — hvis både forælder og børn findes, tælles kun børnene i residualen
for propertyPlantAndEquipment, og landAndBuildings kontrolleres separat mod
land + buildings. Generalisér: når en knude selv er forælder og er indberettet
sammen med sine børn, bruges knuden (ikke børnene) i bedsteforælderens residual.
(2) Poster kan lovligt være indberettet på flere niveauer samtidig; motoren skal
aldrig tælle samme krone to gange.

Resultatopgørelsen (scope: report)

IdKontrolSeverityRES-001grossResult == revenue − costOfSales − rawMaterialsAndConsumablesUsed − otherExternalExpenses + otherOperatingIncome — kun de tilstedeværende led; spring helt over hvis hverken revenue eller vareforbrug findes (bruttoresultat-skema)warningRES-002profitLossFromOrdinaryOperatingActivities == grossResult − employeeBenefitsExpense − depreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLosserrorRES-003profitLossFromOrdinaryActivitiesBeforeTax == profitLossFromOrdinaryOperatingActivities + Σ(finansielle indtægter, inkl. kapitalandelsresultater) − Σ(finansielle omkostninger). Indtægtsleddene: incomeFromInvestmentsInGroupEnterprises, incomeFromInvestmentsInAssociates, incomeFromInvestmentsInParticipatingInterests, incomeFromInvestmentsInJointVentures, incomeFromOtherLongtermInvestmentsAndReceivables, otherFinanceIncomeFromGroupEnterprises, otherFinanceIncome. Omkostningsleddene: otherFinanceExpenses, financeExpensesArisingFromGroupEnterprises, restOfOtherFinanceExpenses. Kapitalandelsresultater kan være negative — de indgår med fortegn på indtægtssiden (jf. RES-003-eksemplet nedenfor).errorRES-004profitLoss == profitLossFromOrdinaryActivitiesBeforeTax − taxExpense (± extraordinaryIncome/Expenses hvis indberettet)errorRES-005notes.amortisationOfIntangibleAssets ≤ depreciation...RecognisedInProfitOrLoss (når begge findes)warning

Facit-eksempel til test (Jettime 2024/25): RES-003:
70.326 == 73.874 + (862 + (−95) + 4.233) − 8.548 ✓.
RES-004: 56.721 == 70.326 − 13.605 ✓.

Bemærk: afskrivninger indgår IKKE i RES-003 — resultat af ordinær drift er
allerede efter af- og nedskrivninger. (Dette var en bevidst korrektion af det
oprindelige forslag.)

Tværgående mellem år (scope: company)

IdKontrolSeverityXCH-001Egenkapitalens kontinuitet: for hvert par af nabo-rapporter: equity(n) − equity(n−1) − profitLoss(n) + udbytte(n) − Δreserver(n) ≈ 0, hvor udbytte = proposedDividendRecognisedInEquity + proposedExtraordinaryDividendRecognisedInEquity (nyeste år) og Δreserver = ændring i reserveForCurrentValueOfHedging, reserveForNetRevaluationAccordingToEquityMethod, reserveForCurrentValueAdjustmentsOfCurrencyGains, restOfOtherReserves, hedgeFund. Residual > tolerance×5 ⇒ warning (kapitaludvidelser, ekstraordinære udlodninger m.v. er lovlige forklaringer — brug rummeligere tolerance og formulér meddelelsen som "kan skyldes kapitalbevægelser; kontrollér")warningXCH-002reserveForNetRevaluationAccordingToEquityMethod == longtermInvestmentsInGroupEnterprises når begge findes og indre værdis metode dermed indikeres. Afvigelse ⇒ info (associerede kan indgå i reserven)infoPER-001Periodekontinuitet: sortér perioder nyeste→ældste; kræv start(n) == end(n+1) + 1 dag. Huller ⇒ warning ("manglende regnskabsår i udtrækket"); overlap ⇒ error (dublet/genindberetning, dedup har fejlet)warning/errorSCL-001Skala-kontinuitet: for nøglekoncepter (revenue, assets, equity, profitLoss) mellem nabo-år: hvis begge ≠ 0 og forholdet > 20 eller < 1/20 ⇒ warning ("mulig enhedsfejl kr./t.kr.")warningSCL-002Intern størrelsesorden: revenue og assets i samme rapport må ikke afvige mere end 3 dekader (begge ≠ 0)infoSCL-003Procentfelt-ensartethed: relatedEntities[].ownershipPercentage skal være ensartet brøk (≤ 1) eller ensartet procent (> 1) på tværs af ALLE selskabets rapporter. Blandet ⇒ warning. (Live-eksempel: Jettime rapporterer 1 i nyeste år og 100 i de to foregående — denne kontrol SKAL fyre på den fixture.)warning

Udeladt bevidst: kontrol af at perioden er 12 måneder. Værdierne
helårsomregnes i beregningen, så skæve periodelængder er håndteret dér.
Implementér den ikke, heller ikke som info.

Fortegn og kilde (scope: report)

IdKontrolSeveritySGN-001Aktivposter < 0 (alle koncepter under assets-træet undtagen reguleringskonti) ⇒ warning pr. konceptwarningSGN-002taxExpense med modsat fortegn af profitLossFromOrdinaryActivitiesBeforeTax ⇒ info ("kan være udskudt skatteaktiv — kontrollér")infoSRC-001Hvis consolidatedFinancialStatements er ikke-tom: de udtrukne selskabstal må ikke være identiske med koncerntallene (assets sammenlignes). Identiske ⇒ error ("koncerntal udtrukket i stedet for selskabstal")error

SRC-002 (krydstjek af relatedEntities mod CVR-koncernstrukturen) hører til i
corporate-groups-endpointet og udskydes til fase 2 — notér det som TODO i koden,
implementér ikke nu.

5. Integration

I batch-flowet, efter at et selskabs rapporter er udtrukket og sorteret:

tsconst disabled = parseDisabledChecks(process.env.VALIDATION_DISABLED); // "SCL-002,SGN-002"
runValidation(companyEntry.results, disabled);
companyEntry.validationSummary = summarize(companyEntry.results);

Krav:

status forbliver "success" uanset fund. Validering blokerer aldrig.
Kør i try/catch pr. kontrol: en exception i én kontrol må aldrig vælte
svaret eller de øvrige kontroller (log + fortsæt).
Performance er triviel (ren aritmetik) — ingen caching nødvendig.

6. Meddelelser

Alle message-tekster på dansk, selvforklarende uden adgang til details,
med beløb formateret #,##0 kr. (da-DK). Mønster:
"[kontrolnavn]: [hvad afviger] ([forventet] vs. [faktisk], afvigelse [X kr.]). [mulig årsag/handling]."
Ingen tekniske id'er i selve teksten (id'et ligger i feltet). Teksten skal kunne
stå direkte på en dosmerseddel foran en advokat.

7. Test

Opret src/validation/**tests**/ med:

Fixture: Jettime-svaret (det fulde JSON med 6 rapporter — ligger i
sagsmaterialet). Golden-forventninger:

BAL-001..005: ingen fund i 2024/25-rapporten (alle sammentællinger stemmer).
RES-003/RES-004: ingen fund (se facit ovenfor).
XCH-001 for 2024/25→2023/24: residualen forklares af 35.000.000
(ekstraordinært udbytte) + reservebevægelser (hedging −5.317→1.127,
indre værdi 1.296→2.175) ⇒ inden for tolerance, ingen warning.
SCL-003: skal fyre (ownershipPercentage 1 vs. 100).
PER-001: ingen fund (perioderne er sammenhængende, inkl. 1-måneders-perioden
sep. 2021 — og der må IKKE komme fund pga. periodelængden).
SGN-002: skal fyre som info på 2023/24 (taxExpense −9.139 mod positivt
resultat).

Syntetiske minimalrapporter pr. kontrol: én der består, én der bryder,
én hvor koncepterne mangler (forventning: intet fund). Særskilte cases for
BAL-005-fælderne: forælder+børn samtidig indberettet (ingen dobbelt­tælling)
og landAndBuildings vs. land+buildings.
Tolerance-tests: t.kr.-afrunding må ikke give falske positiver
(konstruér en sammentælling der afviger med præcis 1.000 pga. afrunding).

8. Acceptkriterier

Svaret er bagudkompatibelt; kun validation og validationSummary er nye.
Alle kontroller i §4 implementeret, enkeltvist deaktiverbare via env.
12-måneders-kontrol findes ikke i kodebasen.
Jettime-fixturen giver præcis de golden-fund, der er listet i §7.
En exception i en enkelt kontrol logges og påvirker ikke svaret.
Meddelelser på dansk, formateret som beskrevet i §6.
