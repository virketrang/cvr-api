# Erhvervsstyrelsen XBRL technical framework — reading notes for a fact-reading parser

Sources read in full:
- **TR2022** = "Oversigt over kontroller af tekniske regler ved indsendelse af digitale årsrapporter", Erhvervsstyrelsen, marts 2022, v2.0 (Danish; 64 PDF pages / ~1833 txt lines)
- **ARCH** = "The Danish Commerce and Companies Agency XBRL Taxonomy Framework Architecture", draft v0.9, 2012-10-01 (English; 33 PDF pages / ~1502 txt lines)
- **IFRSEXT** = "Vejledning vedr. udarbejdelse af udvidelse af den danske IFRS-taksonomi", Erhvervsstyrelsen, december 2014, v1.0 (Danish; ~202 txt lines)

Important caveat up front: **ARCH is an 0.9 draft dated 2012-10-01**, written when the framework had 8 components (gsd, arr, mrv, sob, fsa, dst, tax, eogs) and IFRS was only "anticipated" (§11: *"it was decided that the DCCA taxonomies … should follow the architecture of the IFRS taxonomy … the plan to allow for reporting according to the IFRS taxonomy for D-class companies in the future"*). It predates the actual ifrs-dk namespace, the `ExcludingBalanceSheetIncomeStatement` entry-point family, and ESEF/inline XBRL entirely. TR2022 is current (2022) and does mention ESEF rules (TR13–TR17) and IFRS in passing, but is a flat list of technical/hard validation rules, not an architecture description. IFRSEXT is narrowly about company-authored *extensions* to the Danish IFRS taxonomy, not about the IFRS-DK taxonomy's own structure. **None of the three documents contain**: the actual list of IFRS-DK entry-point names, the QName `ifrs-full:ConsolidatedAndSeparateFinancialStatementsAxis`, an explicit `gsd:ConsolidatedSoloDimension`/`ConsolidatedMember`/`SoloMember` QName triad, the `ExcludingBalanceSheetIncomeStatement` entry-point suffix, a `ClassOfReportingEntity` element, or a `TypeOfReportingEntity` element (only a `typeOfReportingEntityItemType` *data type* is named, with no element instance shown). These gaps are called out explicitly below rather than guessed at.

---

## 1. Taxonomy architecture

### Modules / components (ARCH §3–4.3)
ARCH (2012, 8-component state) names these components, each a 3-letter folder + namespace prefix:
- **gsd** – "general and submission data (generelle indberetningsdata mv)": submission, reporting entity and report metadata (period, submitter/reporting entity registration, auditors, financial institutions, law firms, board members).
- **arr** – "approved auditor's reports (revisor erklæring)": content of the Danish Executive Order on Approved Auditor's Reports.
- **mrv** – "management's review (ledelses beretning)".
- **sob** – "statement of boards": Statement by executive/supervisory boards under the Annual Accounts Act.
- **fsa** – "financial statements (Resultat opgørelse og balance)": balance sheet (account + report form), income statement (by nature + by function), proposed distribution of results, cash flow statement, statement of changes in equity, and disclosures (true and fair view, going concern, accounting policies, assets, liabilities, provisions, equity, income statement, related parties, other).
- **dst** – Statistics Denmark extension concepts.
- **tax** – Danish tax authority (SKAT) concepts submitted with the annual accounts for tax settlement.
- **eogs** – concepts submittable to the agency (then "Erhvervs- og Selskabsstyrelsen") other than annual accounts.
- **cmn** – "common constructs and definitions reused across the entire framework", declared in `cmn.xsd` + `cmn_lab-en/da.xml`, `cmn_gla-en/da.xml`, `cmn_def.xml`. Per ARCH §4.2.1 this is explicitly where the Consolidated/Solo dimension lives: *"They also contain definition and relations for dimension used for distinguishing between the solo and consolidated data that is applied to every concept within the framework (regardless of the component, hence described as a common construct)."*
- **tch** (`tch.xsd`) – purely technical constructs (imports XBRL 2.1, XBRL Dimensions 1.0, Generic Link/Label specs, XBRL data-type registry, `preferredLabel` custom extension attribute). Not a reporting module.

ARCH does **not** list `ifrs-dk` as a component — it only anticipates the future integration (§11). The `ifrs-dk` namespace only appears in **IFRSEXT**, as a fact in an example import (see §6/§7 below), confirming the prefix but not describing its internal modularization.

### Namespace pattern and versioning
- ARCH §6.1 (Table 1): namespaces are constructed as `http://xbrl.dcca.dk/{3-letter component}` — no date or version embedded in the namespace URI itself: *"Version information is NOT defined on any of the namespaces, roleURIs or any other XBRL technical construct."* (ARCH §13). Table: `arr`→`http://xbrl.dcca.dk/arr`, `cmn`→`http://xbrl.dcca.dk/cmn`, `dst`→`http://xbrl.dcca.dk/dst`, `fsa`→`http://xbrl.dcca.dk/fsa`, `gsd`→`http://xbrl.dcca.dk/gsd`, `mrv`→`http://xbrl.dcca.dk/mrv`, `sob`→`http://xbrl.dcca.dk/sob`, `tax`→`http://xbrl.dcca.dk/tax`, `eogs`→`http://xbrl.dcca.dk/eogs`.
- The IFRSEXT example import instead shows an `ifrs-dk` namespace that **does** carry a date: `xsd:import namespace="http://xbrl.dcca.dk/ifrs-dk/entry01-ifrs-dk_2014-12-20"` with `schemaLocation="http://archprod.service.eogs.dk/taxonomy/20131220/ifrs/entry-ifrs-dk_01_IS-ByNature_SFP-CurrentNoncurrent_OCI-BeforeTax_CF-IndirectMethod_2014-12-20.xsd"`. This is the only place any of the three docs shows a concrete `ifrs-dk` entry-point filename, and it already encodes structural choices in the filename itself: `IS-ByNature` (income statement by nature), `SFP-CurrentNoncurrent` (statement of financial position, current/non-current classification), `OCI-BeforeTax` (other comprehensive income presented before tax), `CF-IndirectMethod` (cash flow statement, indirect method). This strongly implies IFRS-DK entry points, like ÅRL ones, encode presentation-format choices in the entry-point name — but no other IFRS-DK entry point name is given anywhere in these docs, so the **full IFRS-DK entry-point catalogue (including any "ExcludingBalanceSheetIncomeStatement" variant) is not documented in the provided material** and must be sourced from the actual current taxonomy package.
- Versioning mechanism (ARCH §4.1, §13): files live under `{root URL}/{yyyymmdd}/{optional 3-letter component}/{file name}`, root URL = `http://archprod.service.eogs.dk/taxonomy/`. Each file also embeds an `officialURI` processing instruction (e.g. `<?officialURI http://archprod.service.eogs.dk/taxonomy/20121001/fsa/fsa.xsd?>`) and a `taxonomy-version` processing instruction with a three-part dotted version, e.g. `<?taxonomy-version 1.4.0?>`, where: first digit = "significant change in business requirements … or technical aspects", second digit = "a change that requires a change in mapping (e.g. new concept is added)", third digit = "changes that do not require remappings (improvements … or minor technical bug … unrelated to element names and assignment of dimensional information)".
- **TH01** (TR2022, hard rule, phase 0) enforces this at the transport level: *"Første schemaRef='<...>' begynder ikke med 'http://archprod.service.eogs.dk/taxonomy/' eller er ikke en absolut URI."* — the first `schemaRef` in the instance must be an absolute URI under that exact root, or the instance cannot even be recognized ("Uden en korrekt angivelse af schemaref er Erhvervsstyrelsen ikke i stand til at identificere hvilket entrypoint og Taksonomi, der anvendes").
- **TH02**: *"Entrypoint i schemaRef='<...>' kan ikke anvendes"* — the entry point must be one Erhvervsstyrelsen recognizes (i.e. a closed, enumerated set of entry-point schema files — you cannot invent your own).
- **TH10**: the instance may contain **exactly one** `schemaRef` and must not contain `linkbaseRef`, `roleRef` or `arcroleRef` directly — *"Taksonomien skal identificeres via en schemaref til et entrypoint"* — meaning the entire DTS (data type structure) is pinned by that single schemaRef; a reader can safely resolve the whole taxonomy graph from it.
- ARCH §14.1 states the corollary for authors: *"Instance documents must reference … one of the entry schema files … it is disallowed that an instance document submitted to the DCCA refers any extension taxonomy"* — this is for the **base ÅRL taxonomies**, which ARCH says are explicitly non-extensible (§12: *"it was decided that the DCCA taxonomies for the current coverage of the information requirements will not be extensible. This means that instance documents submitted to the DCCA must not contain any extension concept."*). IFRSEXT (2014) is the later, narrower carve-out that *does* allow extension, but only for the IFRS taxonomy and only via a very constrained company-extension mechanism (see §7 below) — i.e. extension is opt-in and taxonomy-specific, not a general ÅRL feature.

### Entry points — what the name encodes (ARCH §4.2.3, §4.3)
- *"Entry points are schema files referring to linkbases defined in components folders or to cross-component linkbase files. These are the schema files that are referenced from instance documents (reports) filed by reporting entities. They allow classifying submitted reports in terms of reported components (e.g. including/excluding statistics and/or tax, applied variants of income statement/balance sheet, etc.)."* — i.e. the entry point choice itself is business-meaningful metadata: which optional components (mrv, sob, arr, dst, tax) are included, and which presentation variant of the balance sheet/income statement was chosen.
- *"The name of the entry point files start with the word entry followed by a camel-case description of its content and a publication date in format yyyymmdd. Entry points are the only files that contain dates in their names"* — so a filename like `entryDanishGAAPBalanceSheetAccountFormIncomeStatementByFunctionIncludingManagementsReviewStatisticsAndTax20121001.xsd` decodes as: **BalanceSheetAccountForm** (kontoform vs. `BalanceSheetReportForm`/beretningsform) + **IncomeStatementByFunction** (vs. `IncomeStatementByNature`) + **IncludingManagementsReviewStatisticsAndTax** (mrv + dst + tax bundled in) + date `20121001`.
- The 2012-era catalogue (ARCH §4.3) had exactly these entry points:
  1. `entryDanishGAAPBalanceSheetAccountFormIncomeStatementByFunctionIncludingManagementsReviewStatisticsAndTax20121001.xsd`
  2. `entryDanishGAAPBalanceSheetReportFormIncomeStatementByFunctionIncludingManagementsReviewStatisticsAndTax20121001.xsd`
  3. `entryDanishGAAPBalanceSheetReportFormIncomeStatementByNatureIncludingManagementsReviewStatisticsAndTax20121001.xsd`
  4. `entryDanishGAAPBalanceSheetAccountFormIncomeStatementByNatureIncludingManagementsReviewStatisticsAndTax20121001.xsd`
  5. `entryStatementExemptionNotToPresentAnnualReport20121001.xsd` (gsd only, for exemption declarations)
  6. `entryStatementOnRevenueLimitSpecifiedInActOnRetailSalesFromStoresEtc20121001.xsd` (gsd only)
  7. `entryAll.xsd` — union of everything, explicitly **not** a filing entry point: *"NOTE: This entry point IS NOT meant for reporting – only for accession the taxonomy."*
  - Each of these bundles every optional component ("Including...ReviewStatisticsAndTax") — there is no 2012-era "excluding" variant shown, so the **`ExcludingBalanceSheetIncomeStatement` naming pattern the task asked about is not present in ARCH**; it must be a later addition (post-2012, likely tied to IFRS-DK filings where the balance sheet/income statement live in a *separate* ESEF/IFRS instance and the ÅRL instance carries only gsd/mrv/sob/arr/dst/tax — consistent with IFRSEXT's framing that companies "uanset regnskabsklasse" file under the IFRS taxonomy). This inference is architecturally plausible given TR2022's phrase *"Indsendelser af årsregnskaber efter IFRS i dag ved anvendelse af 'IFRS taksonomien'"* (Forord) and IFRSEXT's identical framing, but **neither document actually shows or names an `ExcludingBalanceSheetIncomeStatement` entry point**, so its exact semantics (which gsd fields still travel with it, whether it's mandatory alongside an IFRS/ESEF instance) is not verifiable from these sources.
- **TH14** (TR2022) constrains `gsd:InformationOnTypeOfSubmittedReport` (report classification, independent of entry point) to one of: *Årsrapport, Likvidationsregnskab, Regnskabsstatistik, Halvårsrapport, Delårsrapport, Selskabsselvangivelse, Erklæring om undtagelse fra aflæggelse årsrapport* "eller tilsvarende engelske betegnelser" — and **TR04** gives the actual English equivalents accepted (only for taxonomy version `20140701`): *Annual report, Interim report (6 months), Interim report (other than 6 months), Liquidation accounts* (note: `Regnskabsstatistik`, `Selskabsselvangivelse`, and the exemption declaration have no English form listed in TR04, so presumably only the Danish token is valid for those in machine terms — the docs don't confirm either way).

### How IFRS-DK reuses the ÅRL modules
- ARCH §11 (*"Relation to other taxonomies"*): the ÅRL/DCCA taxonomy was **designed in anticipation of** aligning with IFRS taxonomy architecture specifically so a *future* IFRS taxonomy for D-class companies could share modelling techniques — *"It is highly undesired that there are two or more taxonomies operating in a single reporting environment that use different modelling techniques."* But it also flags departures: *"Nevertheless the DCCA taxonomy framework contains also a number of departures from the rules set out by the IFRS taxonomy architecture … partly related to extensibility issue but also results from specific requirements not addressed by the IFRS taxonomy (e.g. tax and statistics reporting)."*
- IFRSEXT confirms gsd is shared: the extension entry point imports an `ifrs-dk` entry schema (which brings in the IFRS/ifrs-dk concepts), and separately the surrounding TR2022 rules (TH03–TH17, TM12–TM33 — all "Anvendelse: Alle entrypoints") apply uniformly across **both** ÅRL and IFRS entry points, meaning **gsd is the shared, mandatory, cross-taxonomy metadata layer** — the same CVR/period/report-type/entity-name fields must appear regardless of whether the balance sheet content is ÅRL/fsa or IFRS-DK/ifrs-full. This is the clearest, best-evidenced statement in the sources about "how IFRS-DK reuses the ÅRL modules": it reuses **gsd** (and by extension arr/mrv/sob/dst/tax, since those also key off gsd) as common submission/entity/period/auditor/board metadata, while the balance sheet/income statement concepts themselves come from the IFRS/ifrs-dk namespace, not fsa. Neither document, however, gives a structural diagram or rule that explicitly enumerates *which* fsa-equivalent concepts IFRS-DK reuses vs. replaces with `ifrs-full:*`/`ifrs-dk:*` concepts — that mapping is not in scope of any of the three docs.

---

## 2. Dimensions

ARCH §10 states scale: *"Currently it defines 17 explicit dimensions and 21 typed dimensions (whose values are defined by reporting entities in instance documents)."* This is the 2012 gsd/arr/mrv/sob/fsa/dst/tax/eogs/cmn state — **no per-dimension enumeration/table is included in ARCH**; it only describes the *categories* of typed dimensions and the *mechanism* for explicit dimensions, not a full names list. So the request to "list every dimension/axis" cannot be satisfied element-by-element from these documents — only the general design is documented, as follows.

### General mechanism (ARCH §10, §6.2.3)
- Container: *"The designated container for dimensional information in instance documents is scenario element as indicated on definition arcs with `http://xbrl.org/int/dim/arcrole/all` arcrole … The taxonomy does not contain any arc with `http://xbrl.org/int/dim/arcrole/notAll`. Every hypercube is closed (`@closed="true"`)."* — i.e. every hypercube in this framework is closed, so for a reader: a context's dimensional members are fully enumerable from the taxonomy (no "open" hypercubes admitting arbitrary members), and dimensional info always lives in `<xbrli:scenario>`, never `<xbrli:segment>` (segment is explicitly disallowed — see TH15 below).
- Naming convention (ARCH §6.2.3): hypercube items end in `Hypercube` (e.g. `DetailsOnTreasurySharesHoldHypercube`), dimension items end in `Dimension` (e.g. `ManagementCategoryDimension`), explicit domain members end in `Member` (e.g. `PlantAndMachineryMember`). Typed-dimension typed domains are named `{content}Identifier` (e.g. `memberOfBoardIdentifier`), always with XML Schema type `string`.

### Default members (ARCH §10.1)
- *"The taxonomy defines a default member for each explicit dimension. This is important information due to the fact that default members must not be declared in instance documents."* All default-member relationships are collected in one extended link, `@roleURI="http://xbrl.dcca.dk/role/900.01/DimensionDefaultMembers"`. Practical implication for a reader: **a context with no explicit member for a given dimension is implicitly at that dimension's default member** — you must resolve the taxonomy's `900.01` link to know what "absent" means for each dimension, it is not a universal convention (e.g. not always "false"/"none"/"total").

### Consolidated/Solo (ARCH §10.2) — the key point for the task
Direct quote, in full because it is load-bearing: *"The DCCA taxonomy is applicable for consolidated reports (which include figures and other information for both, a group and a parent) and solo reports containing data of a single entity. This distinction has been modelled using XBRL dimension Consolidated/Solo that is defined in CMN (common) component of the framework and is applied to every reportable concept (in every hypercube). There are no distinct files, extended link roles, whatsoever indicating which information is reportable only on solo and which on consolidated basis. Moreover the taxonomy may define superfluous information in this area. Therefore it is responsibility of reporting entities to provide valid information in this regard in instance documents. A single XBRL instance document can contain solo as well as consolidated data."*
- **Exact QName is not given** — ARCH only calls it "XBRL dimension Consolidated/Solo … defined in CMN"; it never spells out `cmn:ConsolidatedSoloDimension`/`ConsolidatedMember`/`SoloMember` as literal element names (those are presumably the real names in the live taxonomy given the CamelCase+`Dimension`/`Member` convention described in §6.2.3, but that convention only tells us the *pattern*, not that these are the actual chosen labels — treat as a reasonable but unverified inference).
- Since it's a **default-member-bearing explicit dimension applied to every concept**, and per §10.1 "default members must not be declared in instance documents," **the practical reading rule for an ÅRL fact with no Consolidated/Solo member in its context is: it is at the dimension's default member** — and per §900.01's stated purpose, a reader must consult that specific default-members link to know whether the default is Solo or Consolidated (ARCH does not state which one it is; it explicitly disclaims that there's any structural way to tell from context alone: *"There are no distinct files, extended link roles, whatsoever indicating which information is reportable only on solo and which on consolidated basis... it is responsibility of reporting entities to provide valid information."*). **This is a real, documented ambiguity** a reader must resolve by loading the actual default-member linkbase, not something inferable from the architecture doc alone.
- Nothing in these three documents addresses the IFRS-DK/ESEF equivalent (`ifrs-full:ConsolidatedAndSeparateFinancialStatementsAxis` or similar) or states whether IFRS-DK reuses the same `cmn` Consolidated/Solo dimension or a different one. The task's premise that IFRS-DK might use an `ifrs-full` axis instead is **not confirmed or denied by any of the three source documents** — this needs to be verified against the live ifrs-dk schema, not these texts.

### Typed dimensions (ARCH §10.3, §6.2.3)
Listed categories of what typed dimensions are used to identify (this is the closest thing to an enumeration ARCH provides — it's a bulleted list of *purposes*, not QNames):
> "In particular, they are used to identify:
> • members of executive and supervisory boards, and liquidator
> • auditors performing audit, review or assurance engagement, performers of internal audit and other of statements
> • other statements
> • shareholders,
> • related entities,
> • classes of shares,
> • key figures or financial ratios,
> • other components of cash flows,
> • other operating income,
> • operating segments and geographical markets,
> • transactions,
> • loans raised against debt instruments or claims."

This maps to the task's list (board members, auditors, related entities, cash-flow components) but again with **no QNames** — ARCH gives a worked example instead: operating-segment/geographic-market disclosure uses three primary items (Revenue, Name of operating segment, Name of geographical segment) tied to a hypercube containing "Identification of operating segment" and "Identification of geographical market" typed dimensions; each fact set sharing one segment must carry the *same* typed-domain "key" value (e.g. `x2` for "Både"/"Boats" in ARCH's Table 3 example), regardless of other dimensions present in that context. Mechanically: *"In an instance document typed domain must be instantiated as a unique 'key' value linking facts that have something in common."* For a reader, this means: to group facts belonging to "the same board member" or "the same related entity," match on the typed-dimension's string value, not on any structural nesting.

### Rules for whether dimensions may/must appear (TR2022 hard rules)
- **TH05**: *"gsd-context indeholder komplekse elementer i dimensions, segmenter eller har ikke en lukket periode"* — the gsd-context (the one carrying `gsd:IdentificationNumberCvrOfReportingEntity`) must not carry any dimensional/segment complexity and must have a closed (non-forever) period: *"Erhvervsstyrelsens taksonomi anvender ikke XBRL-funktionaliteten 'Segment'."*
- **TH15**: *"Context må ikke have segmenter"* — *no* context anywhere in the instance may use `<xbrli:segment>` (only `<xbrli:scenario>`, consistent with ARCH §10's statement that dimensional info always lives in scenario).
- **TR05/TR06**: `gsd:ReportingPeriodStartDate`/`EndDate` must specifically carry the **default** `TypeOfReportingPeriodDimension` member to be checked against the CVR context's period dates — implying `TypeOfReportingPeriodDimension` is a real, named dimension in gsd with at least one non-default member, used for reporting *deviating* period dates (confirmed by **TM32/TM33**, which separately require uniqueness of `gsd:ReportingPeriodStartDate`/`EndDate` when tagged with the specific member `RegisteredReportingPeriodDeviatingFromReportedReportingPeriodDueArbitraryDatesMember` on `TypeOfReportingPeriodDimension` — i.e. companies with irregular/arbitrary fiscal-year dates get a second, dimensioned pair of start/end-date facts alongside the "official" registered ones).
- **TC01/TC02**: dimensions that identify natural persons (board members etc.) must never carry a CPR (Danish personal ID) number as the context `id`, nor as the typed-dimension member value itself — *"Der må ikke anvendes CPR nummer i typedMember i context der identificerer personer"* — Erhvervsstyrelsen strips/rejects CPR data before redistribution to third parties, except to other authorities.

---

## 3. Contexts and periods

### Entity identifier scheme
- **TR02** (hard-ish TR, phase 3): `gsd:IdentificationNumberCvrOfReportingEntity`'s context entity identifier **scheme** must be the absolute URI `http://www.dcca.dk/cvr`; if `gsd:IdentificationNumberGreenlandRegnrOfReportingEntity` is used instead, the scheme must be `http://www.dcca.dk/glregnr`.
- **TR03**: the context entity **identifier value** must equal the fact's own reported value (CVR number or Greenland reg. no.) — i.e. `<xbrli:identifier scheme="http://www.dcca.dk/cvr">12345678</xbrli:identifier>` must match the text content of the `gsd:IdentificationNumberCvrOfReportingEntity` fact itself. Typical errors cited: *"context entity identifier er opmærket med mellemrum eller CVR-numrets tal (xx xx xx xx)"* (spaces in the number) or using a placeholder string instead of the real CVR.
- **TH03**: either the CVR number or the Greenland reg. no. field must be present and have a value (mutually one-of).
- **TH11**: both must **not** be present simultaneously — CVR and Greenland-regnr are mutually exclusive.
- **TH04**: all facts for CVR-nr./Greenland-regnr must share the same value, context entity, and period — i.e. there is exactly one canonical identifying context in the whole instance.
- **TR01**: *every* gsd fact must share the same context entity + period as `gsd:IdentificationNumberCvrOfReportingEntity`'s context — "For at få ensartede data i XBRL-filen skal alle data i afsnittet 'Information om indsendelse, rapporttype og regnskabsaflæggende virksomhed' (kaldes GSD), henvise til samme CVR-nummer og periode." A noted real-world failure mode: *"Dele af det indberettede er opmærket som koncern, mens andet er opmærket på moderen"* (part of the filing tagged at group/consolidated level, part at parent-only level) — this breaks TH03/TM12/TM15/TM17/TM19/TM21/TM25/TM29, all of which list this exact failure mode as a typical error, confirming that **the gsd block (CVR, report type, period dates, entity name, submitter info, meeting/approval date) must all resolve to one single (implicitly default-dimensioned) context**, not split across Solo/Consolidated variants.
- **TR09**: *"Der skal benyttes samme værdi i identifier scheme"* — across the **entire instance**, all contexts must use the same identifier scheme and value (not just the gsd contexts) — *"Såfremt antallet af forskellige værdier for 'identifier' i 'entity'-elementet er større end 1, skal kontrollen reagere."* So one instance = one entity identifier scheme + value throughout, even across dimensioned contexts for related parties etc. (the *typed-dimension member*, not the context identifier, is what varies for e.g. per-board-member facts).
- ESEF-specific, **TR14**: for InlineXBRL/ESEF filings specifically, all contexts must share the same entity identifier scheme, and that scheme must be **either** `http://standards.iso.org/iso/17442` (LEI) **or** `http://www.dcca.dk/cvr` (not restricted to CVR only, unlike the base gsd rule). **TR15**: if the LEI scheme is used, all context identifiers must equal `gsd:LegalEntityIdentifierOfReportingEntity`'s value; if the CVR scheme, they must equal `gsd:IdentificationNumberCvrOfReportingEntity`'s value. This confirms `gsd:LegalEntityIdentifierOfReportingEntity` is a real gsd element used specifically for ESEF/LEI-identified filers.

### Period conventions
- **TH06**: the CVR-identifying context's period must be a bounded duration, never `forever`.
- **TH07** / **TR07**: all gsd dates (and, by TR07, all `gsd:*` date-typed facts generally) must be `yyyy-MM-dd` with **no time and no timezone**, e.g. `2013-12-31`.
- **TR13** (ESEF-specific): same `yyyy-MM-dd`-no-timezone rule, restated explicitly for ESEF/InlineXBRL contexts.
- **TR05/TR06**: `gsd:ReportingPeriodStartDate` / `gsd:ReportingPeriodEndDate` (with the *default* `TypeOfReportingPeriodDimension` member) must literally equal the `startDate`/`endDate` of the canonical CVR context's period — this is the load-bearing rule that lets a reader trust the *instant/duration in the CVR context* as the ground truth for "what period is this report for," cross-checked against the two explicit gsd date facts.
- ARCH §6.2.1 on period type semantics: *"periodType is either instant for these concepts that are reported at a point of time (as of specified date) or duration for concepts representing flows and changes"*; when in doubt the taxonomy defaults an item's periodType to `duration` (footnote 11: this is because "it is always possible to indicate a moment in time using two identical dates … while it is not possible to describe a period of time using just a single date" — same convention as the IFRS taxonomy). For **textual/date-valued concepts** specifically, ARCH says the start/end dates on the context should be the report's own boundary dates, e.g. a Q3 2010 report's textual facts get context dates 2010-07-01/2010-09-30; a fiscal-year-starting-June annual report's date-valued facts (Reporting period end date, Reporting period start date, Date of approval of report) get context dates 2009-07-01/2010-06-30 — i.e. even "instant-like" metadata (approval date) is periodType=duration with the full fiscal year as its context period, not periodType=instant at the specific approval date. **This is an important, non-obvious quirk for a reader**: don't assume a "date" fact has an instant context just because its value looks like a point in time.
- Comparative/prior-year periods: ARCH mentions only in passing, under the 1217-concept count footnote, that dimensional application plus *"request for previous period information (beginning balance)"* multiplies possible records past 5000 — confirming prior-year/opening-balance figures are modelled via **repeated contexts with different periods for the same concept**, not a dedicated "prior year" dimension. **Neither ARCH nor TR2022 gives an explicit rule enumerating how many comparative periods are mandatory or which specific concepts require them** — that detail is not present in these sources.
- **TH08/TH09**: generic "not valid XBRL"/"not valid XML" catch-alls, informational for a reader in that these should never appear if the source was validated against an ERST taxonomy already — i.e. a reader can generally assume basic XML/XBRL well-formedness if the file passed ERST intake.

---

## 4. Units, decimals, scale, sign, nil

### Precision / scale (ARCH §14.3) — the only documented statement on this topic
Full quote: *"Precision of reported monetary figures (i.e. information if the amount is in kroner or thousands/millions of kroner or with øre decimal places) is set in instance document for each tag by a reporting entity. This is for the reason, that is it a reporting entity that knows how accurate are the numbers that it reports. Information about this accuracy is reflected using `@decimals` or `@precision` attributes as described in the XBRL 2.1 Specification. It is therefore possible, that an entity reports in an instance document the same information twice: in thousands (with `@decimals="-3"`) and in kroner (with `@decimals="0"`). This approach however is not recommended as it hinders comparability of data and may lead to inconsistencies (two or more different values representing a single fact). Therefore, each fact must be tagged only once with reference to the ISO 4217 currency code and appropriate accuracy. It is the role of a user interface or rendering application to display the numbers properly (i.e. in millions, thousands, etc.)."*
- **Key takeaways for a reader**: (1) there is **no fixed scale convention** ("i tusinder" is not mandated) — filers choose `@decimals` freely per fact (commonly `-3` for thousands, `0` for whole kroner, possibly positive for øre), so a reader must read `@decimals` on every numeric fact rather than assume a document-wide scale. (2) The taxonomy allows but discourages both `@decimals` and `@precision` — a reader should handle whichever attribute is present (XBRL 2.1 allows only one or the other per fact, never both). (3) Currency is via **ISO 4217** currency codes in the `<xbrli:unit>` measure (e.g. `iso4217:DKK`), consistent with standard XBRL; ARCH's footnote 28 also notes it would technically be possible to define a custom unit measure like `<xbrli:measure>mu:thousandDKK</xbrli:measure>`, but that "would require change of the data type of items to different than monetary" — implying the DCCA taxonomy's monetary items are typed `monetaryItemType` and thus **must** use a currency-only unit measure, not a custom scaled unit; scaling is exclusively a `@decimals` concern, never a unit concern.
- **No explicit rule was found in TR2022** constraining *which* currencies are acceptable (DKK vs EUR vs other) or requiring a single currency per instance — TR2022's TR08/TR10/TR19 duplicate-fact rules do list "samme valuta" (same currency) as one of the conditions for two facts counting as "the same fact," implying multiple currencies *can* coexist for logically different facts in one instance, but nothing mandates or restricts which currencies. This should be verified against the live taxonomy/schema rather than assumed.

### Sign / balance convention (ARCH §14.4)
Full quote, because the exact wording matters for a reader building parity logic: *"According to section 6.2.1 of this document, the DCCA taxonomy currently does not use the `@balance` attribute. Neither it uses specific data types such as `nonNegativeMonetaryItemType` or `nonPositiveMonetaryItemType` to restrict the values of facts. It also does not document any mathematical relationships between concepts in the calculation linkbase. Nevertheless, it is still expected that the values of monetary items are reported as positive figures when appearing in the natural accounting balance of a concept that they represent. It means that costs/expenses are reported as positive figures and subtracted from revenues/income. Similar approach should be applied for cash flows (inflows and outflows) and changes during the period (increases/decreases). If a concept can have a positive as well as a negative value then its label describes how to report such information by indicating in round brackets the expected character of the minus sign."* Worked examples given: "Profit (loss)" — profit positive, loss negative; "Adjustments for decrease (increase) in working capital" — the label's bracketed alternative ("increase") is the one that should be tagged with a minus sign.
- **Practical implication for a reader**: sign cannot be inferred structurally (no `@balance`, no calculation linkbase enforced) — it is convention-by-label only. A parser must either (a) trust that filers followed the "natural balance, positive" convention and the bracketed-alternative-gets-minus-sign convention, or (b) maintain its own per-concept sign-normalization table, since **XBRL technical validation does not enforce sign correctness** at all (confirmed indirectly: TR2022 has no rule checking sign correctness of fsa/ifrs facts — only TR08 checks that the *same* fact-identity doesn't have conflicting signs across duplicate tags, which is a consistency check, not a correctness check).

### Nil facts
**Not discussed in any of the three documents** beyond ARCH §6.2 noting all concepts are `@nillable="true"` and therefore "can be reported as nilled (`@xsi:nil="true"`)" — no rule anywhere states when nil is required/forbidden, nor how a reader should distinguish "nil" from "not reported" semantically. Treat as undocumented in these sources.

### Duplicate/consistency rules relevant to numeric facts (TR2022)
- **TR08** (phase 3, hard error): *"Samme numeriske fakta må ikke optræde med forskelligt fortegn"* (the same numeric fact must not appear with different signs). "Same" is defined precisely: same field name, same period, same dimensions (**including same identifier in a typed dimension**), same currency — *and* this check fires "selvom context er forskellig" (even if the XBRL context element itself differs, i.e. it's a semantic-identity check, not an XML-identity check). "Numeric" is defined as: `unit` is populated.
- **TR10**: mirror rule for **text** facts — same field/period/dimensions/`xml:lang` must not have different textual content, applies "selvom context er forskellig," and "tekstindhold" (textual) is defined as: `unit` is **not** populated.
- **TR19** (BUVM entrypoints — i.e. presumably annual-accounts-related, "Anvendelse: Alle BUVM entrypoints"): identical "samme fakta må ikke have forskelligt indhold" rule combining both, listing the 5 sameness criteria as: 1) samme feltnavn, 2) samme periode, 3) samme dimensioner (inkl. typed-dimension identifier), 4) samme sprog (xml:lang), 5) samme valuta.

---

## 5. Mandatory metadata elements (technical validation a reader can rely on)

TR2022's hard rules (TH*) and metadata rules (TM*) give a reliable, enumerable list of gsd elements that **must** exist, be unique, and be internally consistent in *every* accepted filing regardless of entry point ("Anvendelse: Alle entrypoints" on essentially all of these). Exact element QNames as given in the document:

| Rule | Element | Requirement |
| --- | --- | --- |
| TH03/TM12 | `gsd:IdentificationNumberCvrOfReportingEntity` **or** `gsd:IdentificationNumberGreenlandRegnrOfReportingEntity` | one of the two must be present with a value |
| TH11 | (same pair) | must **not** both be present |
| TH04/TM13/TM14 | (same pair) | must be unique (single value) and consistent (same entity/period) everywhere used |
| TR02 | `gsd:IdentificationNumberCvrOfReportingEntity` / `gsd:IdentificationNumberGreenlandRegnrOfReportingEntity` | context entity scheme must be `http://www.dcca.dk/cvr` / `http://www.dcca.dk/glregnr` respectively |
| TR03 | (same pair) | context entity identifier value must equal the fact's own value |
| TH06 | (same pair) | context period must be bounded, not `forever` |
| TH07/TR07 | (same pair, and gsd dates generally) | `yyyy-MM-dd`, no time/timezone |
| TH13/TM15/TM16 | `gsd:InformationOnTypeOfSubmittedReport` | must be present, must be unique |
| TH14/TR04 | `gsd:InformationOnTypeOfSubmittedReport` | value constrained to enumerated report types (see §1 above) |
| TH17 | `gsd:InformationOnTypeOfSubmittedReport` | for entry point `entryDKGAAPRequiredInformation` specifically, value must literally be `"Påkrævet information"` |
| TH13/TM17/TM18 | `gsd:ReportingPeriodStartDate` (with default `TypeOfReportingPeriodDimension`) | must be present, unique |
| TR05 | (same) | must equal context `startDate` of the CVR context |
| TH13/TM19/TM20 | `gsd:ReportingPeriodEndDate` (with default `TypeOfReportingPeriodDimension`) | must be present, unique |
| TR06 | (same) | must equal context `endDate` of the CVR context |
| TM32/TM33 | `gsd:ReportingPeriodStartDate`/`EndDate` (with `RegisteredReportingPeriodDeviatingFromReportedReportingPeriodDueArbitraryDatesMember` on `TypeOfReportingPeriodDimension`) | must be unique when present (optional — only for arbitrary/irregular fiscal years) |
| TH13 | `gsd:NameOfReportingEntity` | must be present (TH13 wording); **TM21/TM22** separately require present + unique |
| TM23/TM24 | `gsd:NameOfSubmittingEnterprise` | must be present, unique |
| TM25/TM26 | `gsd:AddressOfSubmittingEnterpriseStreetAndNumber` | must be present, unique |
| TM27/TM28 | `gsd:AddressOfSubmittingEnterprisePostcodeAndTown` | must be present, unique |
| TM29 | `gsd:DateOfGeneralMeeting` **or** `gsd:DateOfApprovalOfReport` | one of the two must be present |
| TM30 | `gsd:DateOfGeneralMeeting` | must be unique if present |
| TM31 | `gsd:DateOfApprovalOfReport` | must be unique if present |
| TR15 | `gsd:LegalEntityIdentifierOfReportingEntity` | (ESEF only) must equal context identifier value when LEI scheme used |
| TH13 (selskabsselvangivelser) | `tax:FiscalYear` | required specifically for company tax-return filings, per TH13's "For selskabsselvagivelser er: tax:FiscalYear" |

Note: the task's expected element names `TypeOfSubmittedReport` and `ClassOfReportingEntity` **do not appear** in TR2022 — the real element is `gsd:InformationOnTypeOfSubmittedReport`, and no `ClassOfReportingEntity` element is named anywhere in the three sources (ARCH names only a `classOfEntityItemType` *data type* in its data-type catalogue, §6.2.1, with no concrete element shown using it). A reader should not assume `ClassOfReportingEntity` exists as an element name without checking the live schema.

### Other hard/technical rules relevant to a reader (not metadata-element-specific)
- **TH01/TH02/TH10**: schemaRef must be a single, absolute, recognized entry-point URI under the fixed root; no other linkbase/role/arcrole refs allowed directly in the instance.
- **TH05/TH15**: no `<xbrli:segment>` use anywhere; gsd context specifically must have no dimensional complexity and a closed period.
- **TH16/TR11/TR12/TR16/TR17**: InlineXBRL-specific structural rules — must parse as valid XHTML (TH16); no external image references, Base64 only (TR11); no executable code (script/Java applets/Flash/VBScript etc., TR12); must carry at least one `xml:lang` (TR16); must not use HTML `<base>` or `xml:base` (TR17).
- **TH09/TH08**: basic XML/XBRL well-formedness (should not occur post-validation).
- **TR09/TR14**: single consistent entity-identifier scheme across the whole instance (general rule TR09; ESEF-specific restatement + the two allowed schemes in TR14).
- **TR18** (Advis/notice, not an error): a resubmission is rejected/queued if a prior filing for the same entity is still mid-processing, unless it's an "omgørelse" (restatement) — informative for understanding why a CVR might temporarily have two pending filings.
- **CPR protection (TC01–TC03)**: no CPR numbers may appear in context `id`, in typed-dimension member values, or in context refs for CPR-bearing concepts — Erhvervsstyrelsen otherwise cannot strip CPR data before redistributing to non-authority third parties. Relevant if the API ever surfaces raw context IDs or typed-dimension values from person-identifying disclosures (board members, auditors) — these fields could theoretically leak CPR-shaped strings if filers made this exact validation error, so defensive handling (not assuming absence of PII) may be prudent.

---

## 6. What an IFRS filer must submit — **largely not covered by these documents**

None of the three source documents state the concrete submission rule the task asks about (ÅRL "ExcludingBalanceSheet" instance + IFRS-DK/ESEF instance combination, which file carries which facts, whether parent/moderselskab figures must be tagged). What can be pieced together, with explicit confidence levels:

- **Confirmed**: IFRS filers use a distinct "IFRS taksonomien," separate from "ÅRL taksonomien," both fetchable from Erhvervsstyrelsen (TR2022 Forord: *"Indsendelser af årsregnskaber efter årsregnskabsloven sker i dag ved anvendelse af 'ÅRL taksonomien' … Tilsvarende sker indsendelser af årsregnskaber efter IFRS i dag ved anvendelse af 'IFRS taksonomien' … Dette dokument omfatter begge typer af taksonomier."* — confirming TR2022's rules apply to both taxonomies equally). IFRSEXT Forord adds the timeline: IFRS taxonomy first published 2011-12-20, revised 2013-12-20 and 2014-12-20; mandatory XBRL filing for IFRS filers ("uanset regnskabsklasse", i.e. regardless of accounting class) from balance dates after 31/12/2013.
- **Confirmed**: gsd (and the cross-cutting TR2022 rules keyed on gsd) apply identically to IFRS filings — same CVR/period/report-type/name requirements (see §5). This strongly implies gsd, and by extension arr/mrv/sob (which reuse gsd), are common infrastructure regardless of whether the balance sheet is ÅRL/fsa-tagged or IFRS/ifrs-dk-tagged.
- **Not confirmed anywhere in these documents**: whether a single instance document carries both the gsd/mrv/sob/arr metadata **and** the IFRS balance sheet/income statement facts together (single-instance model), or whether Erhvervsstyrelsen requires **two separate instances** — one under an "ExcludingBalanceSheetIncomeStatement"-style ÅRL entry point carrying only gsd/mrv/sob/arr/dst/tax, and a second, separate ESEF/IFRS-DK instance carrying the actual financial statements. The task's premise of this split is plausible (it would explain why an "ExcludingBalanceSheetIncomeStatement" entry-point family would need to exist at all) but **it is not stated, shown, or even implied explicitly by ARCH, TR2022, or IFRSEXT** — this is a real gap and should be verified against the current (post-2022) entry-point catalogue and/or Erhvervsstyrelsen's IFRS filing guidance directly, not inferred from these three documents.
- **Not confirmed**: whether parent-company (moderselskab) figures must additionally be tagged for IFRS/consolidated filers. Neither "moderselskab" nor "parent company" appears anywhere in TR2022 or ARCH (confirmed by direct search of both files); IFRSEXT doesn't address it either (it is purely about the extension-taxonomy authoring mechanics). The closest related evidence is ARCH §10.2's statement that a single instance "can contain solo as well as consolidated data" via the Consolidated/Solo dimension (see §2 above) — suggesting parent/solo figures, if reported, would be the "Solo"-member-dimensioned version of the *same* concepts rather than separate elements, but there is no rule anywhere mandating that parent figures actually be present for a consolidated/IFRS filer.

**Bottom line: section 6 of the task cannot be substantively answered from the three provided documents.** This should be flagged back rather than guessed at in code — the actual current ERST IFRS/ESEF filing manual (not among the three files given here) is needed to confirm the instance-splitting and parent-tagging rules before building parser assumptions around them.

---

## 7. Extension taxonomy rules (IFRSEXT — this section IS well covered)

IFRSEXT is short (202 lines) but explicit and rule-numbered (1–16). Key points, since this is the one section fully documented in the sources:

### Purpose and scope-limiting rationale
*"Et centralt mål med digitalisering af årsrapporterne er, at det skal være nemt for slutbrugere at sammenligne årsrapporter og deres indhold... Hvis det fortsat skal være muligt sammenligne årsrapporter, så er det vigtigt at udvidelserne sker indenfor snævre rammer..."* — extensions are allowed **only** for the Danish IFRS taxonomy (not ÅRL, which per ARCH §12 disallows extensions outright), and only within a narrow, fixed structure: *"Afvigelserne fra denne struktur vil betyde at styrelsens modtagelsessystem ikke kan modtage og validere årsrapporten, der derfor vil blive afvist"* (deviation from the structure means outright rejection, not a warning).

### File/package naming (rules 1–4)
- Every file, the containing folder, and the zip itself must start with a **4-letter company-chosen prefix** ("xxxx", example uses `ABCD`), referencing the company name.
- The entry point must carry a **date in `yyyymmdd` format**; the date needn't match the accounting period (a company can reuse its extension across multiple future filings), but must be **unique to that company** — *"Datoen skal være unik for selskabet der således ikke må offentliggøres 2 taksonomier med samme dato."*
- Fixed file/folder naming pattern, exactly 6 possible files inside one folder:
  - Folder: `xxxx_yyyymmdd`
  - Entry point: `xxxx_entry_yyyymmdd.xsd`
  - Definition linkbase: `xxxx_def.xml`
  - Presentation linkbase: `xxxx_pre.xml`
  - Label linkbase: `xxxx_lab.xml`
  - Reference linkbase: `xxxx_ref.xml`
  - Calculation linkbase: `xxxx_cal.xml` — explicitly noted *"(erhvervsstyrelsen anvender IKKE selv denne!)"* (Erhvervsstyrelsen itself does not use/consume this file even if present) — **a reader can safely ignore any calculation linkbase entirely**.
- The zip must **not** bundle Erhvervsstyrelsen's own taxonomy files — only a reference/import to them (rule 4).

### Entry point rules (rules 5–8)
- Exactly one entry-point file allowed, and it cannot be omitted if extending.
- Must declare a `targetNamespace` chosen by the company (example: `http://www.AaaBbbCccDdd_fuldnavn.dk/xbrl/`).
- Must **import one of Erhvervsstyrelsen's own numbered, dated entry points** — *"kun de nummererede og datede entrypoint i Erhvervsstyrelsens taksonomi må anvende – pt. Nummer 0 til 16"* (only entry points numbered 0–16, as of this 2014 document, may be imported as the base). Worked example import:
  ```
  <xsd:import
    namespace="http://xbrl.dcca.dk/ifrs-dk/entry01-ifrs-dk_2014-12-20"
    schemaLocation="http://archprod.service.eogs.dk/taxonomy/20131220/ifrs/entry-ifrs-dk_01_IS-ByNature_SFP-CurrentNoncurrent_OCI-BeforeTax_CF-IndirectMethod_2014-12-20.xsd"
  />
  ```
- New elements the company wants to add **must be placed directly in the entry-point schema file** itself (not in a separate schema). Worked example of a new monetary element:
  ```xml
  <xsd:element
       name="ExtraElement"
       id="ABCD_ExtraElement"
       type="xbrli:monetaryItemType"
       substitutionGroup="xbrli:item"
       nillable="true"
       xbrli:balance="debit"
       xbrli:periodType="instant"
  />
  ```
  Note this example **does** use `xbrli:balance="debit"` on the extension element — a contrast with ARCH §14.4's statement that the base DCCA/ÅRL taxonomy "does not use the `@balance` attribute" at all; IFRS-DK extensions apparently may (or are expected to) use `@balance` even though the base ÅRL taxonomy doesn't. This is a genuine, documented divergence worth encoding in any parser that special-cases sign handling by taxonomy.
- Instances using the extension must reference a specific extension-namespaced schemaRef location: `http://archprod.service.eogs.dk/taxonomy/extension/xxxx_yyyymmdd/xxxx_entry_yyyymmdd.xsd` (i.e. `.../taxonomy/extension/{folder}/{entrypoint filename}`) — **this is a different URL root/pattern than TH01's required `http://archprod.service.eogs.dk/taxonomy/` prefix for non-extended filings**, so a reader's schemaRef-based entry-point classification logic needs to special-case the `/taxonomy/extension/` path as "this instance uses a company IFRS extension" rather than treating it as an unrecognized/invalid entry point.

### Linkbase rules (rules 9–13)
- Definition linkbase: exactly one file, technically optional but required in practice for ERST submissions; **must only be used to place the new extension elements**, nothing else.
- Presentation linkbase: same — exactly one file, same "only for new elements" restriction.
- Label linkbase: exactly one file; every new element must have **at minimum a Danish label**; English label "anbefales" (recommended, not required).
- Reference linkbase: exactly one file, optional, recommended if applicable ("hvis muligt").
- Calculation linkbase: exactly one file, Erhvervsstyrelsen recommends **omitting it entirely**; if included, should place all monetary elements in it, but again — not consumed by Erhvervsstyrelsen.
- Every one of these five/six linkbases is restricted to **only** containing the extension's own new elements — none of them may touch, reorganize, or redefine base-taxonomy content.

### What may be extended — and the critical "totals" answer (rules 14–16)
- Rule 14: *"Udvidelser må kun ske med 'facts' og 'abstracts'."* (Extensions may only add facts/items and abstract organizing concepts.)
- Rule 15: extensions **must not** include:
  a. Extended link roles
  b. Tuples, Parts, or Groups
  c. **Hypercubes, Dimensions or Members**
  — i.e. a company extension can add new line items, but **cannot** define new dimensional breakdowns or new members of existing dimensions (including, presumably, no new Consolidated/Solo-style members).
- Rule 16, the direct answer to "can extensions replace core elements for totals": **"Det er ikke tilladt at fjerne eller ændre eksisterende felter fra taksonomien, herunder må placeringen heller ikke ændres."** — It is not permitted to remove or change existing fields from the taxonomy, including that their placement may not be changed either. **This explicitly forbids extensions from replacing or repositioning any core/base concept, including totals** — a company cannot redefine what a taxonomy total means or substitute its own total concept for the standard one; it can only *add* net-new facts/abstracts alongside the untouched base structure. For a reader: any concept in the `ifrs-dk`/base-IFRS namespace can be trusted to retain its official meaning and position even in an extended filing; only genuinely novel, clearly-namespaced (`{4-letter prefix}:*`) elements represent company-specific additions, and those additions are guaranteed to never collide with or override a standard total.

---

## Summary of the most important unresolved items for the IFRS/ESEF implementation

1. **No confirmed IFRS-DK entry-point catalogue** (including whether/how an `ExcludingBalanceSheetIncomeStatement`-style entry point exists) — none of the three documents names one. Must be sourced from the live taxonomy.
2. **No confirmed IFRS-DK dimension for Consolidated/Solo** — ARCH only documents the ÅRL/`cmn` "Consolidated/Solo" dimension (exact QName not given, default member not stated — must be resolved via the `900.01` default-members linkbase in the live taxonomy) and is silent on whether IFRS-DK reuses it or uses an `ifrs-full` axis.
3. **No confirmed two-instance (ÅRL-metadata-only + IFRS/ESEF-financials) submission model**, nor any parent-company/moderselskab tagging requirement — genuinely absent from all three sources, not just under-detailed.
4. **Scale/decimals**: confirmed no fixed convention — must read `@decimals`/`@precision` per fact; ISO 4217 currency in the unit measure; no scaled custom units for monetary items.
5. **Sign**: confirmed no `@balance` attribute and no calculation-linkbase enforcement in the base taxonomy — sign is label-convention-only and not validated by Erhvervsstyrelsen's technical rules, **except** IFRS extension elements *do* apparently carry `@balance` per IFRSEXT's example, a genuine divergence worth handling explicitly.
6. **Extensions cannot touch totals or core concepts** — confirmed and unambiguous (IFRSEXT rule 16): safe to treat any standard (non-4-letter-prefixed) concept's meaning/position as stable even under a company IFRS extension.
