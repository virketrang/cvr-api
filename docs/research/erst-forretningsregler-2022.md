# ERST "Forretningsregler" (March 2022, v2.1) — notes for IFRS-DK/ESEF support

Source: `erst_forretningsregler_2022.txt` (pdftotext of "Oversigt over kontroller af
forretningsregler ved indsendelse af digitale årsrapporter", 153 pp., read in full,
lines 1–5192).

**Headline caveat, established by full-text grep before writing this note:** the
document's own foreword scopes it explicitly: *"Dette dokument omfatter kun
indberetninger foretaget på baggrund af ÅRL- og DK-IFRS-taksonomien"* ("this document
covers only filings made on the basis of the ÅRL and DK-IFRS taxonomies") — i.e. it
does **not** cover the ESEF taxonomy, which is mentioned exactly once, in the
foreword, and never again. There are zero occurrences anywhere in the document of:
`ifrs-full:`, `ifrs-dk:`, `RelatedEntity`, `ConsolidatedAndSeparate`,
`ConsolidatedSolo`, or `ExcludingBalanceSheetIncomeStatement`. Every element QName
cited in the whole document uses the ÅRL-taxonomy prefixes `fsa:`, `gsd:`, `arr:`,
`mrv:`, `sob:`, `cmn:` — plus, in a handful of rules (FR21–23, FR57), a generic
pseudo-notation `BalanceSheet:Assets` / `BalanceSheet:LiabilitiesAndEquity` that is
never expanded into a real namespace. Anywhere this note says something is "not
covered," that means a full-text search found nothing, not that I inferred absence.

---

## 1. Document structure

### Rule families
- **FR** — Forretningsregler (general business rules). The bulk of the document.
- **FRI** — Forretningsregler vedrørende fritagelsesansøgninger (exemption
  applications from digital filing).
- **FRU** — Forretningsregler vedrørende undtagelseserklæringer (exception
  declarations under ÅRL §§4, 5(1–3), 6, 144 — e.g. a dormant subsidiary filing a
  declaration instead of its own annual report because it's covered by a parent's
  koncernregnskab).
- **FRM** — Forretningsregler ved brug af machine learning (ML-based plausibility
  checks, e.g. "you tagged a balance-sheet figure for real property but the
  accounting-policy text doesn't clearly say cost or fair value").

### Rule metadata (every rule has all of these)
`Version`, `Fase` (phase — only 0 and 4 are ever used in the document; 0 appears for
FRU01–11 and FR99, everything else is 4), `Type` (`FEJL` / `ADVIS`, plus **one
exception**: FR98 is typed `INTERNKONTROL` — an internal flag with no error message
shown to the filer, used only to route a filing into ERST's own regnskabskontrol
process), short description, the exact message text shown to the filer, `Anvendelse`
(which entrypoints/taxonomies it applies to), long description, and "Typiske fejl"
(typical mistakes).

### Fejl vs. Advis
- **FEJL** (error): submission cannot proceed until fixed.
- **ADVIS** (warning): filer is shown the message but can continue regardless.
  Quote: *"Ved 'Advis' kan indberetter vælge at indberette uagtet adviseringen."*
  The document itself flags that ADVIS rules can have false positives: *"Der kan dog
  være tale om særtilfælde, hvor adviseringen ikke er 100 pct. dækkende."*
- Many ADVIS (and some FEJL) rules also carry a `Mærkat` (label) code like `K411`,
  `K478` etc. — an internal cross-reference the document never explains further.

### The 9 logical areas (Områder) and their ÅRL/IFRS scope
This is the single most important structural fact for this project, because the
document states area-wide applicability explicitly, and it's inconsistent with what
individual rules' `Anvendelse` lines say (see §7):

| Area | Content | Stated applicability |
| --- | --- | --- |
| A: Korrekte datoer | FR4,5,6,7,8,39,42,43,44,55,91 | *"Området finder anvendelse for indberetninger efter både ÅRL og IFRS."* |
| B: Årsrapportens bestanddele | FR3,9,10,20,22,23,31,32,33,34,35,40,41,48,52,54,56,57,61,62,63,64,68,69,70,74a,74b,75,77a,77b | *"Området finder anvendelse for indberetninger efter ÅRL. IFRS er ikke omfattet af kontrollerne."* — **explicitly ÅRL-only, IFRS excluded** |
| C: Revision | FR14–19,24–30,36,37,49–51,53,58,59,65–67,72,73,76,84a–c,85b–c,89,90,92,98 | *"Området finder anvendelse for både indberetninger efter ÅRL og IFRS."* |
| D: Omgørelse (restatement) | FR78,79,80 | not restated, but individual rules say "Taksonomier: alle" |
| E: FRI (fritagelsesansøgninger) | FRI01,02 | exemption applications only |
| F: FRU (undtagelseserklæringer) | FRU01–11 | exception declarations only |
| G: FRM (machine learning) | FRM01–10b | not restated per-area; individual rules say "Taksonomier: alle" |
| H: inlineXBRL | FR82,83,87,88 | FR82 = IFRS only, FR83 = ÅRL only, FR87/88 = both |
| I: Supplerende indberetning om nettoomsætning | FR93–97,99 | explicitly `Entrypoints: alle ÅRL` — **ÅRL-only mechanism** |
| Ø: Øvrige kontroller | FR1,3,21,38,47,71,81 | mixed; FR21 (Assets=Liabilities+Equity) carries no ÅRL/IFRS restriction of its own |

**Practical reading:** Area B is where almost every "the balance sheet/income
statement must be filled in" rule lives (FR9 ProfitLoss required, FR10 Equity
required, FR34 balance sheet non-empty, FR62–64 non-negativity, FR74a/b and FR77a/b
provisions/liabilities-vs-equity checks, FR57 comparative-year identities). Per the
area statement, **none of these are enforced for IFRS-DK filings** — see §7/§8.

---

## 2. Rules guaranteeing arithmetic identities

All balance-sheet/P&L element names below are ÅRL-taxonomy `fsa:` QNames unless
noted; the document gives no `ifrs-full:`/`ifrs-dk:` equivalents anywhere.

| Rule | Identity | Elements | Type | Scope note |
| --- | --- | --- | --- | --- |
| **FR21** | Assets = LiabilitiesAndEquity | `BalanceSheet:Assets` = `BalanceSheet:LiabilitiesAndEquity` (generic notation, not `fsa:`-prefixed) | **FEJL** | No "(ÅRL)" qualifier on the rule; area Ø has no area-wide ÅRL restriction — likely the one identity enforced for both taxonomies (see §7) |
| **FR22** | Assets ≥ 0 | `BalanceSheet:Assets` | **FEJL** | Same generic notation as FR21 |
| **FR23** | LiabilitiesAndEquity ≥ 0 | `BalanceSheet:LiabilitiesAndEquity` | **FEJL** | Same generic notation |
| **FR9** | ProfitLoss must be filled | `fsa:ProfitLoss` | **FEJL** | `Taksonomier: alle (ÅRL)` — explicit ÅRL-only, and inside Area B |
| **FR10** | Equity must be filled | `fsa:Equity` | **FEJL** | `Taksonomier: alle (ÅRL)` — explicit ÅRL-only, inside Area B |
| **FR34** | If Equity ≠ 0, ≥1 other balance-sheet field must be filled | `fsa:Equity` + any other balance-sheet fact | **FEJL** | Inside Area B → ÅRL-only per area statement (rule's own line doesn't repeat "(ÅRL)") |
| **FR57** | Both current-year *and* comparative-year figures must independently satisfy: ProfitLoss filled, Equity filled, Assets≥0, LiabilitiesAndEquity≥0, Assets=LiabilitiesAndEquity | `fsa:ProfitLoss`, `fsa:Equity`, `fsa:Assets`, `fsa:LiabilitiesAndEquity` (note: explicit `fsa:` prefix here, unlike FR21) | **FEJL** | Inside Area B, `fsa:`-prefixed → ÅRL-only |
| **FR62** | Assets, Provisions, LiabilitiesOtherThanProvisions and sub-items ≥ 0 | `fsa:Assets`, `fsa:Provisions`, `fsa:LiabilitiesOtherThanProvisions` | **FEJL** | Entrypoint-restricted to "balance i kontoform" (account-form balance sheet); ±1000 tolerance "uanset valuta" |
| **FR63** | Assets and sub-items ≤ balance sum | `fsa:Assets` | **FEJL** | "balance i kontoform" entrypoint only |
| **FR64** | Same non-negativity as FR62 but for the long/short-term-split account-form entrypoint | `fsa:Assets`, `fsa:LongtermLiabilitiesOtherThanProvisions`, `fsa:ShorttermLiabilitiesOtherThanProvisions` | **ADVIS** (warning only, unlike FR62) | ±1000 tolerance |
| **FR74a** | Provisions ≤ LiabilitiesAndEquity − Equity | `fsa:Provisions`, `fsa:LiabilitiesAndEquity`, `fsa:Equity` | **ADVIS** | ±1000 kr tolerance |
| **FR74b** | LiabilitiesOtherThanProvisions ≤ LiabilitiesAndEquity − Equity | `fsa:LiabilitiesOtherThanProvisions`, `fsa:LiabilitiesAndEquity`, `fsa:Equity` | **FEJL** | ±1000 kr tolerance; *"Kontrollen ser bort fra andre valutaer end DKK"* (ignores non-DKK) |
| **FR77a** | LongtermLiabilitiesOtherThanProvisions ≤ LiabilitiesAndEquity − Equity | as named | **ADVIS** | ±1000 kr tolerance |
| **FR77b** | ShorttermLiabilitiesOtherThanProvisions ≤ LiabilitiesAndEquity − Equity | as named | **ADVIS** | ±1000 kr tolerance |
| **FR33** | Equity roll-forward completeness: ≥3 fields under `fsa:StatementOfChangesInEquity`, OR ≥2 fields under `fsa:DisclosureOfEquity` | hierarchy roots only, no leaf elements named | **FEJL** | Regnskabsklasse C & D, koncerner |
| **FR41** | If ProfitLoss > 1000 kr, tax expense must be present | `fsa:TaxExpense` or `fsa:TaxExpenseOnOrdinaryActivities` | **ADVIS** | Skips I/S, K/S, P/S |
| **FR56** | If \|ProfitLoss\| > 1000 kr, a "resultatdisponering" (profit appropriation) must be present | hierarchy under resultatdisponering | **ADVIS** | ÅRL §§31, 95a; periods starting ≥1/1/2016 |

No rule anywhere computes a subtotal *sum* check across P&L line items (e.g.
"gross profit = revenue − cost of sales") — the document's arithmetic checks are all
of the "X ≤/≥/= Y" comparison-between-totals form shown above, not intra-statement
summation checks.

---

## 3. Consolidated (koncern) vs. solo (moderselskab)

The document **never** names a dimension/axis for koncern-vs-solo. All it ever cites
is a single **member**, `ConsolidatedMember`, used as (implicitly) the value of some
unnamed default dimension. Verbatim, five rules (FR9, FR10, FR21, FR22, FR23) share
this identical clause:

> *"Kontrollen ser kun på i forekomster uden dimensioner i eller forekomster, der kun
> har dimensionen koncern (ConsolidatedMember) i context. Forekomster af [...] med
> andre dimensioner afløfter ikke indberetningsforpligtelsen."*

Translation: the control only looks at facts with **no dimensions at all**, or facts
whose *only* dimension is the koncern member (`ConsolidatedMember`). A fact tagged
with any *other* dimension (e.g. as part of a note breakdown) does not satisfy the
requirement. And for FR21/22/23 specifically: *"Sammenligningen sker indenfor talpar
for henholdsvis valuta og koncern/moder"* — comparisons are scoped within matched
pairs of (currency, koncern/moder), i.e. the identity is checked separately for the
solo (no-dimension) figures and for the koncern (`ConsolidatedMember`) figures, and
separately per currency.

**Implication for "must a parent that presents consolidated statements also tag its
own separate statements":** the document doesn't state this as an affirmative
requirement in so many words, but the mechanics strongly imply it. Because a
no-dimension context is read as the parent/solo figures and the `ConsolidatedMember`
context as the group figures, and each of FR9/FR10/FR21/22/23 requires the relevant
fact to exist in **at least the no-dimension context** to be satisfied (a
koncern-only fact does not discharge the "must be filled" obligation) — a filer who
tags ProfitLoss/Equity/Assets/LiabilitiesAndEquity only under `ConsolidatedMember`
and never in the default context will trip FR9/FR10/FR21/22/23. This is reinforced by
the recurring "Typiske fejl" line repeated verbatim across a dozen or more rules
(FR1, FR3, FR9, FR10, FR14, FR15–20, FR21–23, etc.):

> *"Dele af det indberettede er opmærket som koncern, mens dette element kun er
> opmærket på moderen."* ("Parts of the filing are tagged as koncern, while this
> element is only tagged for the parent [i.e. missing at the koncern level].")

Note this is the *mirror* mistake — the document lists both failure directions as
common ("tagged as koncern but this element is parent-only" appears far more often
than the reverse), which is consistent with filers under-tagging the solo view when
their systems default to producing consolidated figures. Either way, the practical
reading for a downstream reader/validator is: **do not assume a report that presents
consolidated figures necessarily also carries separate (solo) figures for every line
— ERST's controls check for their presence only on ProfitLoss, Equity, Assets and
LiabilitiesAndEquity (FR9/10/21/22/23), not on every fsa: element.**

**"Årsrapport" vs. "Koncernregnskab":** the document does not define these as an
enumerated `TypeOfSubmittedReport` list. The only report-type enumeration that
appears anywhere is in FR94, restricting the supplementary net-revenue annex to:

> *"Årsrapport / årsrapport / Annual report"* and *"Likvidationsregnskab /
> likvidationsregnskab / Liquidation accounts"*

via `gsd:InformationOnTypeOfSubmittedReport`. FR55 separately excludes
*"del- og halvårsrapporter"* (interim/half-year reports) from its scope, implying
those are also valid report types in the system, but "Koncernregnskab" as a distinct
submitted-report-type value is never spelled out. **This document does not cover
what a standalone "Koncernregnskab" filing implies** beyond the FRU02–08 exemption
rules about subsidiaries being covered by a parent's koncernregnskab (conditions
described in prose, no XBRL facts named — see §6).

**IFRS-DK dimension (`ifrs-full:ConsolidatedAndSeparateFinancialStatementsAxis`):
not covered.** Zero occurrences in the document.

---

## 4. Mandatory `gsd:` elements and reporting-class rules

All `gsd:` elements that appear anywhere in the document (exhaustive, via grep):

| Element | Used by | Note |
| --- | --- | --- |
| `gsd:ReportingPeriodStartDate` (with default `TypeOfReportingPeriodDimension`) | FR4, FR42/43/FRU09/10 | must precede end date (FR4) |
| `gsd:ReportingPeriodEndDate` (default `TypeOfReportingPeriodDimension`) | FR4,5,7,39,44/FRU11 | must be ≤ general-meeting date, ≤ approval date |
| `gsd:DateOfGeneralMeeting` | FR1,5,6,91 | must be > period end, ≤ filing date, must equal `DateOfApprovalOfReport` if both given (FR91, funds only) |
| `gsd:DateOfApprovalOfReport` | FR7,8,91 | must be > period end, ≤ filing date; **removed from taxonomy 1.10.2020 onward** per FR91 |
| `gsd:NameAndSurnameOfChairmanOfGeneralMeeting` | FR1 | required if `DateOfGeneralMeeting` given |
| `gsd:IdentificationNumberOfAuditor` (MNE number) | FR65,66,67 | required whenever any auditor statement is present; must be an approved MNE and linked (same XBRL context) to the audit firm's CVR |
| `gsd:IdentificationNumberCvrOfReportingEntity` | FR96 | supplementary net-revenue annex must match the main filing's CVR |
| `gsd:InformationOnTypeOfSubmittedReport` / `gsd:InformationOnTypeOfRelatedSubmittedReport` | FR94, FR96 | report type; supplementary annex's related-report-type field must equal the main filing's |

Other mandatory/near-mandatory elements outside `gsd:`:

- **`fsa:ClassOfReportingEntity`** (FR3, **ÅRL-only**: `Taksonomier: alle (ÅRL)`) —
  mandatory; enumerated choices are *Regnskabsklasse A / B, mikrovirksomhed / B / C,
  mellemstor virksomhed / C, stor virksomhed / D* (and English equivalents). Note:
  **"IFRS" is not one of the enumerated values** — this field is an ÅRL-taxonomy
  concept only. Thresholds quoted: B-mikro ≤ DKK 2.7m balance sum / ≤ DKK 5.4m
  revenue / ≤10 employees; B ≤ DKK 44m / ≤ DKK 89m / ≤50 employees.
- **`cmn:TypeOfAuditorAssistance`** (FR14, both ÅRL & IFRS per Area C) — mandatory;
  choices: Revisionspåtegning / Erklæring om udvidet gennemgang / Den uafhængige
  revisors erklæringer (review) / Andre erklæringer med sikkerhed / Andre
  erklæringer uden sikkerhed / Ingen bistand ("No audit assistance" is itself a
  valid, required tag when there's no auditor's report at all).
- **`cmn:IdentificationNumberCvrOfAuditFirm`**, **`cmn:NameOfAuditFirm`** (FR51, FR53)
  — required whenever there's an auditor's statement of any assurance type.
- **`fsa:AverageNumberOfEmployees`** (FR75, ADVIS) — required if
  `fsa:EmployeeBenefitsExpense` or `fsa:WagesAndSalaries` > DKK 200,000; B-mikro
  entities can be exempt if they flag the micro-exception.
- **`fsa:ContributedCapital`** (FR54, ADVIS) — must match CVR's registered capital,
  ±DKK 1000 tolerance; not checked for I/S, K/S, P/S.
- **Audit-obligation thresholds** (FR84a/b/c, FR85b/c — entry/exit of statutory
  audit for regnskabsklasse B / B-mikro): balance sum DKK 4m, net revenue incl.
  financial income DKK 8m, employees 12 — must exceed 2 of 3 in two consecutive
  years to require (or continue requiring) audit. Net revenue for this test can be
  topped up with specific financial-income elements when financial income ≥ revenue
  (list of `fsa:GainsLossesFromCurrentValueAdjustmentsOf...`,
  `fsa:IncomeFromInvestmentsIn...`, `fsa:OtherFinanceIncome...` elements given in
  full under FR84a).
- **`fsa:Revenue`** (net turnover) — must always be disclosed to ERST, either in the
  report itself or via a supplementary annex (FR93/94/95/96/97), per ÅRL §138(6).
  The supplementary annex is an **ÅRL-only** mechanism (`Entrypoints: alle ÅRL`) and
  must use entrypoint **`entryDKGAAPRequiredInformation`** (FR99, FEJL, Fase 0). If
  the filing is at koncern level, the annex must also be at koncern level (FR97); if
  not, it must not be tagged with the koncern dimension at all (FR96: *"stamdata må
  ikke opmærkes som koncern-data"*).
- **Language tag** (FR81, ADVIS) — at least one fact must carry `xml:lang="da"` or
  `"en"`. This is the one rule that gives separate effective taxonomy dates for ÅRL
  vs. IFRS: *"Taksonomier: fra og med taksonomi af 10.01.2017 (ÅRL) og 12.20.2017
  (IFRS)"*.
- **InlineXBRL mandate** — FR82 (IFRS) and FR83 (ÅRL) are separate rules requiring
  inline XBRL instead of plain XBRL/PDF, but both are explicitly noted as
  **"Kontrollen er pt. inaktiv"** (currently inactive) as of this document's version.
  FR87 (no external CSS) and FR88 (no XBRL facts in print-only sections) apply to
  inline XBRL generally, both taxonomies.

---

## 5. Sign and value conventions

- **Expenses generally positive**, with a system-specific wrinkle (FR71, ADVIS,
  checks `fsa:EmployeeBenefitsExpense`, `fsa:WagesAndSalaries`,
  `fsa:PostemploymentBenefitExpense`, `fsa:OtherEmployeeExpense`, both current and
  comparative year): *"Omkostninger skal som udgangspunkt indberettes som positive
  tal i den strukturerede fil (XBRL-filen)."* But for ERST's own "Regnskab Basis"
  authoring tool specifically, the convention is inverted: *"Omkostninger skal altid
  indtastes med negativt fortegn"* — i.e. the sign convention is tool/system
  dependent, and this rule flags whichever direction looks anomalous as a probable
  setup error (unless it's a genuine negative expense, i.e. income).
- **Non-negativity of totals**: `Assets ≥ 0` (FR22, FEJL), `LiabilitiesAndEquity ≥ 0`
  (FR23, FEJL) at top level, with no tolerance mentioned; `fsa:Assets`,
  `fsa:Provisions`, `fsa:LiabilitiesOtherThanProvisions` and sub-items ≥ 0 in the
  account-form ("kontoform") balance sheet entrypoint — **FEJL** for the
  undivided form (FR62), but only **ADVIS** for the long/short-term-split form
  (FR64) — both with **±1000, "uanset valuta"** (regardless of currency) rounding
  tolerance.
- **Subtotal-vs-total ceilings**: Assets ≤ balance sum (FR63, FEJL, no stated
  tolerance); Provisions ≤ balance sum − Equity (FR74a, ADVIS, ±1000 kr);
  LiabilitiesOtherThanProvisions ≤ balance sum − Equity (FR74b, **FEJL**, ±1000 kr,
  **DKK-only**: *"Kontrollen ser bort fra andre valutaer end DKK"*); long/short-term
  liabilities ≤ balance sum − Equity (FR77a/b, ADVIS, ±1000 kr each).
- **"Positive" thresholds are not zero**: FR41 defines "positivt resultat" as
  ProfitLoss **> 1000 kr** (not merely > 0); FR56 requires a resultatdisponering
  whenever \|ProfitLoss\| **> 1000 kr**.
- **Registered-capital match**: `fsa:ContributedCapital` vs. CVR's registered capital
  — ±1000 kr tolerance (FR54).
- **Currency/koncern-moder pairing rule** for FR21/22/23: *"Sammenligningen sker
  indenfor talpar for henholdsvis valuta og koncern/moder"* — every comparison is
  scoped to a matched (currency, koncern-or-moder) pair; multi-currency facts are
  never compared cross-currency, and koncern figures are never compared against
  moder figures for these identities.
- **Not covered at all**: the document never discusses `decimals`/`precision`
  attributes, `xbrli:unit` mechanics, or any general rounding rule beyond the
  specific ±1000 kr tolerances called out per-rule above (which only apply to the
  handful of rules that mention them — FR54, FR62, FR64, FR74a, FR74b, FR77a, FR77b).
  There is no general "±1 tolerance" or systematic rounding policy stated anywhere;
  I did not find a document-wide tolerance rule, only these per-rule ±1000 kr ones.

---

## 6. Related entities / subsidiaries / group structure facts

**Not covered.** A full-text search for `RelatedEntity` returns zero hits anywhere in
the document, so there is no rule here for `fsa:RelatedEntityName`,
`IdentificationNumberCvrOfRelatedEntity`,
`ShareHeldByEntityOrConsolidatedEnterprisesInRelatedEntity`, or any IFRS equivalent.

The only group-structure-adjacent material is the **FRU02–08** family
(undtagelseserklæringer under ÅRL §§4, 5(1)–(3), 6, 144), which describes *legal
conditions* in prose for when a subsidiary/partner entity may file an exception
declaration instead of its own annual report because it's covered by a parent's
koncernregnskab — but names no XBRL facts at all. Representative conditions (FRU06,
§6, dormant subsidiary):
1. *dattervirksomheden indgår i et koncernregnskab aflagt af en modervirksomhed*
2. *modervirksomheden henhører under lovgivningen i et EU/EØS-land*
3. *koncernregnskabet er udarbejdet efter årsregnskabsloven eller efter anden
   regnskabslovgivning inden for EU/EØS*
4. dattervirksomhedens ejere har erklæret sig indforstået
5. modervirksomheden har erklæret, at den indestår for dattervirksomhedens
   forpligtelser
6. det oplyses i koncernregnskabet, at dattervirksomheden har undladt at udarbejde
   årsrapport

**Conclusion for this project:** since the API extracts group structure from
free-text/structured notes, none of that extraction can be cross-checked against any
ERST submission-time control — no such control exists in this document. Any group
structure invariant the API wants to assert (e.g. "sum of ownership % ≤ 100",
"subsidiary appears in only one immediate parent's note") would be the API's own
invention, not something ERST guarantees at filing time.

---

## 7. IFRS-DK vs. ÅRL distinctions; ESEF / `ExcludingBalanceSheetIncomeStatement`

Everything the document says that distinguishes IFRS-DK from ÅRL filings, in full:

1. **Foreword scope statement**: the document covers ÅRL and DK-IFRS taxonomies;
   ESEF taxonomy filings are explicitly out of scope (quoted in the header above).
2. **Area B is ÅRL-only**: *"Området finder anvendelse for indberetninger efter ÅRL.
   IFRS er ikke omfattet af kontrollerne."* This area contains essentially all of the
   "the report must contain X" completeness rules — FR9 (ProfitLoss filled), FR10
   (Equity filled), FR31 (management review non-empty), FR32 (cash flow statement),
   FR33 (equity statement), FR34 (balance sheet non-empty), FR35 (accounting
   policies present), FR56 (profit appropriation), FR57 (comparative-year
   identities), FR62–64 (non-negativity), FR74a/b, FR77a/b (provisions/liabilities
   ceilings), FR40/75 (note requirements), FR61/68/69/70 (management-review
   requirements). **None of these are enforced for IFRS-DK filings**, per this
   explicit area-level statement — even though several of the individual rule
   entries don't repeat "(ÅRL)" on their own `Anvendelse` line (e.g. FR34, FR56,
   FR57 just say "Taksonomier: fra og med taksonomi af ..." with no ÅRL/IFRS
   qualifier). The area statement should be read as controlling.
3. **Areas A and C apply to both**: date-consistency checks (FR4–8, 39, 42–44, 55,
   91) and audit-type/audit-report-conclusion checks (FR14–19, 24–30, 36, 37, 49–51,
   53, 58, 59, 65–67, 72, 73, 76, 84a–c, 85b–c, 89, 90, 92, 98) run against both ÅRL
   and IFRS-DK filings.
4. **FR3** (`fsa:ClassOfReportingEntity`) is explicitly `Taksonomier: alle (ÅRL)` —
   the regnskabsklasse field itself is an ÅRL-only concept; its enumerated values
   never include "IFRS."
5. **FR21/22/23** (Assets=Liabilities+Equity, non-negativity) are the one identity
   family that plausibly runs for both taxonomies: they live in Area Ø (no area-wide
   ÅRL restriction stated), and their `Anvendelse` lines carry no "(ÅRL)" qualifier,
   and they use the generic `BalanceSheet:Assets`/`BalanceSheet:LiabilitiesAndEquity`
   notation rather than an `fsa:`-prefixed QName — which is the document's only hint
   of a taxonomy-agnostic element reference anywhere. This is an inference from
   internal consistency of the document's own labeling convention, not a directly
   stated fact — the document never says outright "FR21 applies to IFRS."
6. **FR81** (language tag) is the only rule giving separate effective-taxonomy dates
   for ÅRL vs. IFRS explicitly in one line: *"fra og med taksonomi af 10.01.2017
   (ÅRL) og 12.20.2017 (IFRS)"* — confirming ÅRL and IFRS-DK taxonomies are versioned
   and released on independent tracks with different effective dates.
7. **FR82 vs. FR83**: the inline-XBRL mandate is literally two parallel rules, one
   for IFRS (FR82) and one for ÅRL (FR83) — same mechanism, taxonomy-specific rule
   IDs. Both are flagged inactive in this version of the document.
8. **Area I (net-revenue supplementary annex, FR93–97, 99) is ÅRL-only**
   (`Entrypoints: alle ÅRL`), including the specific entrypoint name
   `entryDKGAAPRequiredInformation` (FR99). This mechanism does not apply to IFRS-DK
   filers at all per this document.

**`ExcludingBalanceSheetIncomeStatement` entrypoint (ESEF):** zero occurrences.
Nothing in this document describes it, its relationship to ESEF, or any control tied
to it. Given point 1 above, this is consistent — ESEF is out of scope for this whole
document by its own foreword.

---

## 8. What a reader can safely replicate as sanity checks

### Safe to assert as guaranteed at ERST filing time (FEJL, blocking)
These held at submission for the filing to have been accepted at all:

- **For ÅRL-taxonomy reports** (fsa:-tagged), in the default/no-dimension context or
  the `ConsolidatedMember`-only context, per currency:
  - `fsa:ProfitLoss` is present (FR9)
  - `fsa:Equity` is present (FR10)
  - Assets = LiabilitiesAndEquity (FR21)
  - Assets ≥ 0, LiabilitiesAndEquity ≥ 0 (FR22, FR23)
  - if `fsa:Equity` ≠ 0, at least one other balance-sheet field is non-empty (FR34)
  - the same five checks above also hold for the **comparative** period's figures
    (FR57)
  - in the account-form ("kontoform") balance sheet presentation specifically:
    `fsa:Assets`, `fsa:Provisions`, `fsa:LiabilitiesOtherThanProvisions` and their
    sub-items are ≥ 0, within ±1000 (FR62); `fsa:Assets` and sub-items ≤ balance sum
    (FR63); `fsa:LiabilitiesOtherThanProvisions` ≤ balance sum − Equity, within
    ±1000, DKK only (FR74b)
  - period end date ≥ period start date; general-meeting date > period end and ≤
    filing date; approval date > period end and ≤ filing date (FR4–8)
  - regnskabsklasse C/D filings have statutory audit (can't be opted out) (FR89)

- **For IFRS-DK-taxonomy reports**, only the Area A (dates) and Area C (audit) FEJL
  rules are confirmed applicable per the explicit area statements. Of the
  arithmetic-identity rules, only **FR21/22/23 (Assets = LiabilitiesAndEquity,
  both ≥ 0)** are plausibly enforced (§7 point 5) — and even that is an inference,
  not a directly stated fact. **Do not assume** ProfitLoss-must-be-filled,
  Equity-must-be-filled, the account-form non-negativity/ceiling checks, or the
  comparative-year identity checks (FR9, FR10, FR34, FR57, FR62–64, FR74a/b,
  FR77a/b) are guaranteed for IFRS-DK filings — the document says Area B, which
  contains all of them, explicitly excludes IFRS.

### Only heuristics — treat as advisory, not guaranteed (ADVIS)
Do **not** hard-fail a reader/validator on these; ERST itself lets filings through
with these unresolved:
- FR74a, FR77a, FR77b — provisions/long-/short-term liabilities ≤ balance sum − equity
- FR64 — non-negativity in the long/short-term-split account-form presentation
- FR41 — tax expense present when profit > 1000 kr
- FR56 — resultatdisponering present when |profit| > 1000 kr
- FR71 — no negative personnel-cost line items
- FR54 — registered capital matches CVR (±1000 kr)
- FR32 — cash-flow statement present (class C/D) or an explanation for its absence
- FR40, FR44, FR47, FR51, FR61, FR66, FR67, FR70, FR72, FR75, FR84a–c, FR85b–c, FR90,
  FR93–97 — assorted disclosure/consistency advisories, all explicitly non-blocking

### Everything else the document is silent on
- No coverage of `ifrs-full:`/`ifrs-dk:` element names, IFRS-DK consolidated/separate
  dimension mechanics, or ESEF's `ExcludingBalanceSheetIncomeStatement` entrypoint.
- No coverage of related-entity/subsidiary/ownership-percentage facts at all.
- No general rounding/decimals/precision policy beyond the specific ±1000 kr
  tolerances named on individual rules.
