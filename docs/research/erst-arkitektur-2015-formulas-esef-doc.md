# Notes: DCCA/ÅRL XBRL Architecture, ERST Formulas, and ESEF Taxonomy — for an instance-document reader

Sources:
- **AARL** = "The Danish Business Authority XBRL Taxonomy Framework Architecture", v1.0, 2015-10-01 (32 pp, English). Describes the **ÅRL/DCCA taxonomy** used for Danish GAAP annual reports (fsa/gsd/arr/mrv/sob/cmn/dst/tax/eogs).
- **FRM** = "Kontroller af fremskudte forretningsregler (formulas) ved indsendelse af digitale årsrapporter", Erhvervsstyrelsen, March 2023, v1.0 (11 pp, Danish). Covers only ÅRL-taxonomy submissions (explicitly excludes DK-IFRS/ESEF: *"Dette dokument omfatter kun indberetninger foretaget på baggrund af ÅRL-taksonomien"*).
- **ESEF** = ESMA "ESEF XBRL Taxonomy Documentation", 20 December 2019, ESMA32-60-534 (10 pp, English). Covers the **ESEF taxonomy** (IFRS-based), a different framework from ÅRL/DCCA.

Where a document does not state something, that is flagged explicitly rather than inferred.

---

## 1. Architecture (AARL §3, §4, §6.1, §6.3)

### Modules / components (AARL §3)
The framework diagram (Fig 1) defines eight components, each a three-letter abbreviation:
- **GSD** — general and submission data (*generelle indberetningsdata*): submission/reporting-entity data, report period, auditors, financial institutions, law firms, executive/supervisory board members.
- **ARR** — approved auditor's reports (*revisor erklæring*).
- **MRV** — management's review (*ledelses beretning*).
- **SOB** — statement of boards.
- **FSA** — financial statements (*Resultat opgørelse og balance*): balance sheet (account/report form), income statement (by nature/function), proposed distribution of results, cash flow statement, statement of changes in equity, disclosures.
- **DST** — Statistics Denmark extension concepts.
- **TAX** — Danish tax authority (SKAT) extension concepts.
- **EOGS** — Erhvervs- og Selskabsstyrelsen, concepts submittable outside annual accounts.
- **CMN** — common constructs/definitions reused across the framework (not in the Fig-1 list of "components" but declared alongside them in the folder structure per §4.2.1); notably declares the container for dimension-default-member relations and **the solo/consolidated dimension applied to every concept in the framework**.
- A ninth technical file **tch.xsd** holds pure technical constructs (imports of XBRL 2.1, XBRL Dimensions 1.0, Generic Link, Generic Label, DTR numeric/nonNumeric types, custom `preferredLabel` attribute for definition arcs) — not a reporting component.

§3: *"It is expected that the framework in future is closely coordinated with the Danish extension of the IFRS taxonomy."* (i.e., ties to IFRS were anticipated even in 2015.)

### Namespaces (AARL §6.1) — **undated**
> "Namespaces in this framework are constructed using the base part `http://xbrl.dcca.dk/` followed by a three letter identification of a component of a framework."

Table 1 gives exact namespace URIs, all **without a date component**:

| Prefix | Namespace |
| --- | --- |
| arr | http://xbrl.dcca.dk/arr |
| cmn | http://xbrl.dcca.dk/cmn |
| dst | http://xbrl.dcca.dk/dst |
| fsa | http://xbrl.dcca.dk/fsa |
| gsd | http://xbrl.dcca.dk/gsd |
| mrv | http://xbrl.dcca.dk/mrv |
| sob | http://xbrl.dcca.dk/sob |
| tax | http://xbrl.dcca.dk/tax |
| eogs | http://xbrl.dcca.dk/eogs |

This is confirmed by §13 (Versions): *"Version information is NOT defined on any of the namespaces, roleURIs or any other XBRL technical construct."* Versioning instead lives in (a) the **folder path date** (`{root URL}/{yyyymmdd}/...`, root URL = `http://archprod.service.eogs.dk/taxonomy/`), (b) an `officialURI` processing instruction embedded per file, and (c) a three-part `<?taxonomy-version 1.6.0?>` processing instruction (first digit = business/technical breaking change, second = mapping-affecting change e.g. new concept, third = non-remapping change e.g. label/hierarchy fix). **Practical implication for a reader: namespace URI alone does not tell you which taxonomy year/version an instance uses — you must read the `schemaRef` target (entry-point filename, which does carry a date) or the processing instructions.**

### Entry points (AARL §4.2.3, §4.3)
> "The name of the entry point files start with the word `entry` followed by a camel-case description of its content and a publication date in format yyyymmdd. Entry points are the only files that contain dates in their names."

Six entry points are listed for the 2015-10-01 taxonomy (§4.3), each a combination of: balance-sheet form (account form / report form / account-by-current-and-long-term form) × income-statement form (by function / by nature) × the fixed bundle {GSD, ARR, MRV, SOB, proposed distribution, cash flow statement, statement of changes in equity (long+short), disclosures, DST info, TAX info}. Example full name:
`entryDanishGAAPBalanceSheetAccountFormIncomeStatementByFunctionIncludingManagementsReviewStatisticsAndTax20151001.xsd`
Plus `entryAll.xsd`, explicitly **not for reporting**: *"NOTE: This entry point IS NOT meant for reporting – only for accession the taxonomy."*

**The document does NOT mention "Required information" or "ExcludingBalanceSheet" entry points at all.** These are not part of the 2015-10-01 taxonomy structure as described here; if such entry points exist in the codebase's ERST instances, they were introduced in a later taxonomy year not covered by this architecture document (the document only describes the framework's *architecture*, not a specific year's file list beyond the 2015-10-01 example).

Section 4.2.3 also floats a "modules manager" for building custom entry points, noted as "under consideration" (i.e., not implemented as of 2015).

### Role/linkbase numbering (AARL §6.3, §7)
Every `roleType` carries a number component `NNN.NN` in its `@roleURI`, `definition` label, and generic labels:
- **First 3 digits** = information-set/component identifier:
  - `000` GSD, `001` DST, `002` TAX, `1{XX}` ARR, `200` MRV, `300` SOB, `40{X}/50{X}/600/700/80{X}` FSA, `1{XXX}` EOGS, `9{XX}` reserved for **general domains of dimensions**.
- **Last 2 digits** = subset-of-relations identifier: `00` for general/detailed information sets (the ones a reader browses first); `01, 02, …` for detailing hypercubes or general dimension domains.
- roleURI pattern: `http://xbrl.dcca.dk/role/{NNN.NN}/{CamelCaseDescription}` (add `/Details` for the "detailed information set" variant, or `/Hypercube/{GeneralSetName}/{DetailDescription}` for detailing hypercubes). Example: `http://xbrl.dcca.dk/role/802.00/DisclosureOfAssets`, and `http://xbrl.dcca.dk/role/802.02/Hypercube/DisclosureOfAssets/DetailsOnReconciliationOfChangesInIntangibleAssets`.

So `000.00`≈GSD general set, `102.00`-style ≈ ARR, `210.00`-style would not literally occur — MRV is fixed at `200`, not `2XX` — worth double-checking against actual instance data since the document's examples center on FSA `40X/50X/600/700/80X` and `802.00`/`805.00`/`805.01`/`805.02`/`900.01` are the only concrete numbers given in the text.

Discovery mechanism (§7): browse starts at a `00` extended link (general info set); a definition-linkbase arc's `@targetRole` points from an abstract item to a hypercube's own extended link (non-`00` suffix), and further `@targetRole` chains from there to the `9{XX}` general-domain role listing the dimension's members. Fig 4 in the source shows this three-hop chain.

---

## 2. Dimensions (AARL §6.2.3, §10)

- The 2015 taxonomy defines **17 explicit dimensions and 21 typed dimensions** (§10, opening sentence).
- Dimensional information in instance documents is carried in the **`scenario`** element (arcrole `http://xbrl.org/int/dim/arcrole/all`; no `notAll` arcs exist; **every hypercube is `@closed="true"`**) — §10.
- Naming convention (§6.2.3): hypercubes end in `Hypercube`, dimensions end in `Dimension`, domain members end in `Member`, all `@abstract="true"`, `@periodType="duration"`, `@dataType="stringItemType"` (domain-member items use `domainItemType`). Typed-domain names end in `Identifier` (e.g. `memberOfBoardIdentifier`); typed-domain `@dataType` is always XML Schema `string`.

### Default members (§10.1)
> "The taxonomy defines a default member for each explicit dimension. This is important information due to the fact that **default members must not be declared in instance documents**."

All default-member relations are collected in one extended link role: `http://xbrl.dcca.dk/role/900.01/DimensionDefaultMembers`. **A fact reported without an explicit-dimension member present in its context is implicitly assigned that dimension's default member** — this is the standard XBRL dimensions-default-value semantics, confirmed by the document's emphasis that defaults must *not* appear explicitly.

**On the Consolidated/Solo dimension specifically (§10.2):** the document describes it only in prose, not by QName:
> "This distinction has been modelled using XBRL dimension Consolidated/Solo that is defined in CMN (common) component of the framework and is applied to every reportable concept (in every hypercube)."

It does **not** state the exact element names (e.g. `cmn:ConsolidatedSoloDimension`, `cmn:ConsolidatedMember`, `cmn:SoloMember`) anywhere in the text — those QNames are not given in this document; they would need to be confirmed against the actual `cmn.xsd`/dimension-default roleType content, not this architecture description. The document also does **not** state which member (Consolidated or Solo) is the default — only that a default exists per the general rule in §10.1, and that determining solo-vs-consolidated applicability of *content* is left to filers: *"There are no distinct files, extended link roles, whatsoever indicating which information is reportable only on solo and which on consolidated basis... it is responsibility of reporting entities to provide valid information in this regard... A single XBRL instance document can contain solo as well as consolidated data."*

### Typed dimensions (§10.3)
Used for: members of executive/supervisory boards and liquidator; auditors (audit/review/assurance) and internal-audit performers and other statement-makers; other statements; shareholders; related entities; classes of shares; key figures/financial ratios; **other components of cash flows**; other operating income; operating segments and geographical markets; transactions; loans raised against debt instruments or claims. (This matches the task's expectation of typed dimensions for related entities, board members, auditors, and cash-flow components.)

Mechanism: a typed dimension's typed domain is instantiated in-instance as a free-form "key" string that links facts sharing a common characteristic (worked example: `fsa:IdentificationOfOperatingSegmentDimension` / `fsa:IdentificationOfGeographicalMarketDimension`, each holding an arbitrary identifier like `x1`, `x2` used consistently to tie `Revenue`, `NameOfOperatingSegment`, `NameOfGeographicalMarket` facts together across a 2-D breakdown — see Table 3 and Code example 15 in the source for the full worked `<xbrldi:typedMember>` context XML).

**Not mentioned anywhere in AARL:** a 2024 `ReportedValueOtherRenderingOfReportedValueDimension`. This is a 2015 document describing a 2015-10-01 taxonomy snapshot; nothing about a 2024 dimension can be sourced from it — that would postdate the document by nearly a decade and must be verified elsewhere (e.g. the current ERST taxonomy release notes), not assumed.

**Extensibility note relevant to dimension-reading (§12):** *"it was decided that the DCCA taxonomies for the current coverage of the information requirements will not be extensible. This means that instance documents submitted to the DCCA must not contain any extension concept."* A reader therefore does not need to handle unknown extension namespaces for ÅRL filings (contrast with ESEF, §6 below, which is extension-friendly by design).

---

## 3. Contexts, periods, entity identifier (AARL §6.2.1, §10.3 code example, §14)

- **Instant vs duration** (§6.2.1): every reportable concept declares `@periodType` = `instant` (point-in-time concepts) or `duration` (flows/changes between two dates, or infinite). *"Where the period type is not obvious, the period type attribute is set to duration."* For **duration string/date concepts**, the start/end dates must reflect the actual boundary dates of the reporting period even though the concept is conceptually a single point — worked example given: a report covering Q3 2010 uses `startDate=2010-07-01`, `endDate=2010-09-30` for textual concepts; an annual report starting June 2009 uses `2009-07-01`/`2010-06-30` for date concepts like "Reporting period end date". This is explained as necessary because XBRL instants require *two identical dates* to represent a moment, while a true period needs distinct dates — the IFRS taxonomy uses the same convention (footnote 9).
- **Entity identifier / CVR scheme URI**: **not stated in this document.** The only place an identifier scheme appears is the illustrative Code example 15 context, which uses a placeholder `<xbrli:identifier scheme="http://scheme">entity identification</xbrli:identifier>` — not a real CVR scheme URI. `cvrItemType` is listed among custom data types (§6.2.1: *"custom DCCA item type; restriction of a stringItemType to a pattern of eight digits"*) but that is the item type used for CVR-number-valued **facts**, not the entity-identifier scheme used in `xbrli:context/xbrli:entity/xbrli:identifier`. **This document does not give the CVR scheme URI** — that must be sourced elsewhere (e.g. actual filed instances or a technical/submission-format guide not among the three documents reviewed).
- **Comparatives**: not explicitly discussed as a topic (no statement on how prior-year comparative contexts are structured or required). The only oblique reference is in §6.2.1's final sentence of that section: *"the number of possible to report records is much higher (5000+) as a result of application of XBRL dimensions... and request for previous period information (beginning balance)"* — confirming prior-period/beginning-balance data is anticipated by the taxonomy's concept count, but no rules on context construction for comparatives are given.
- **Nil facts**: §6.2.1 — *"All concepts are defined in item substitution group or derived from it... All concepts are nillable (`@nillable="true"`) hence, they can be reported as nilled (`@xsi:nil="true"`)."* So every concept, without exception, may be reported as `xsi:nil="true"` per the schema design (though whether a given filing rejects nil for mandatory-per-formula-rule concepts is a separate, formula-layer question — see §5 below).
- **String vs numeric items**: §6.2.1 lists the concrete data types in use: `stringItemType`, `monetaryItemType`, `decimalItemType`, `dateItemType`, `sharesItemType`, `anyURIItemType`, `booleanItemType`, `gYearItemType`, `integerItemType`, `percentItemType` (XBRL International Registry type), plus DCCA custom restricted types: `cvrItemType` (8 digits), `GLregnrItemType` (≤9 digits), `cprItemType` (9 digits), `pnrItemType` (10 digits), `submittedReportItemType`, `classOfEntityItemType`, `coverageOfAuditorsReportItemType`, `taxNominatorItemType`, `reasonForExemptionFromAdditionalAccountingInformationItemType`, `typeOfAuditorAssistanceItemType`, `typeOfReportingEntityItemType`, `countryIdentificationCodeItemType` (ISO 3166 A2), `ModifiedBasisForOpinionsItemType`, `ModifiedOpinionsItemType`, `participantNotPartOfRegisteredManagementType` — the last several are all enumerated (`tokenItemType` restrictions) with values named via L3C (Label CamelCase Concatenation) convention, matching a generic-label linkbase entry per enumeration value (Code examples 1–2 show `typeOfAuditorAssistanceItemType` declared in `tax.xsd` with Danish generic labels in `tax_gla-da.xml`).
- Total concept count (§6.2.1): **1217 reportable concepts** — 34 CMN, 56 GSD, 75 ARR, 54 MRV, 24 SOB, **1074 FSA**, 57 DST, 15 EOGS, 72 TAX — with 5000+ effective reportable records once dimensions are applied.

---

## 4. Units, decimals, precision, scaling, sign, nil, thousands (AARL §14.3, §14.4, §6.2.1)

- **Precision/scaling is filer-determined, per fact** (§14.3): *"Precision of reported monetary figures (i.e. information if the amount is in kroner or thousands/millions of kroner or with øre decimal places) is set in instance document for each tag by a reporting entity."* This is expressed via the standard XBRL **`@decimals`** (or `@precision`) attribute — e.g. `@decimals="-3"` for thousands, `@decimals="0"` for whole kroner — **not** via a custom scaled unit. The document explicitly discourages double-reporting the same fact at two scales: *"It is therefore possible, that an entity reports... the same information twice: in thousands... and in kroner... This approach however is not recommended as it hinders comparability of data and may lead to inconsistencies... each fact must be tagged only once with reference to the ISO 4217 currency code and appropriate accuracy."* **Practical implication for the reader: "i tusinder" (thousands) is not a separate flag to detect — it is simply reflected in the raw numeric value already being in that scale, disclosed via `@decimals`; the reader must read `@decimals` per fact to know the implied precision, and there is no guarantee of a uniform scale across all facts in one instance (though ERST discourages inconsistent double-tagging).** A footnote (26) notes it's technically *possible* to define a custom unit measure like `mu:thousandDKK`, but that would require changing the item's data type away from `monetaryItemType` — implying the DCCA taxonomy does **not** use that approach; standard ISO 4217 currency units + `@decimals` is the convention.
- **Units**: monetary items use `monetaryItemType` with ISO 4217 currency codes (only currency code stated as convention; no explicit statement restricting to DKK only, but that is the practical norm implied).
- **Sign / balance convention** (§14.4, referencing §6.2.1): *"the DCCA taxonomy uses the optional `@balance` attribute on all monetary items. Negated labels are in some cases build into the ordinary label in (), e.g. 'Gains (losses) from current value….'"* So sign handling follows standard XBRL debit/credit `@balance` semantics on every monetary item, supplemented in some presentation labels by a parenthetical negated-label convention rather than a separate negated concept.
- **Nil facts**: as above (§3) — all concepts are `@nillable="true"`, so `xsi:nil="true"` is valid schema-wise for any concept.
- The document stresses (§14.4 closing) that **XBRL is a data-description language, not a formatting language** — display/scaling presentation is out of scope of the taxonomy itself and is a rendering-application concern (inline XBRL or a consuming application), reinforcing that a reader must not assume any implicit display scaling beyond what `@decimals` states.

---

## 5. Calculation/formula rules (ERST Formulas document, March 2023, v1.0)

### Rule-type taxonomy (FRM, "Generelt om kontrollerne")
Rules are either:
- **E** — Existence assertion (checks whether selected fields are present), or
- **V** — Value assertion (checks the values given).

Each rule is classified by **Fase** (validation phase — errors surfaced together within a phase) and **Type**: either **Fejl** (error — *"indberetningen kan [ikke] fortsætte, hvis der findes 'fejl'"*, i.e. blocks submission) or **Advis** (warning — filer may proceed and submit anyway despite the warning; ERST's own text cautions filers to take warnings seriously but allows exceptions: *"Der kan dog være tale om særtilfælde, hvor adviseringen ikke er 100 pct. dækkende... I disse tilfælde skal adviseringen ignoreres, og indberetningen fortsættes."*).

The document states this is the **first release** of the document (§"Nye og ændrede regler": *"Ingenting – første udgivelse"* for both new and changed rules), and covers **only ÅRL-taxonomy (Danish GAAP)** filings for taxonomy years **2020, 2021, and 2022** (each rule's "Anvendelse" section states this range; none reference later taxonomy years, consistent with the document being frozen at March 2023).

### Full list of rules

| ID | Fase | Type | Identity/requirement asserted (element names) |
| --- | --- | --- | --- |
| `e101.0001` | 1 | **Advis** | `TypeOfAuditorAssistance` must be filled in. |
| `v101.0101` | 1 | **Advis** | If `TypeOfAuditorAssistance` = extended review, then both `TypeOfModifiedOpinionOnAuditedFinancialStatementsExtendedReview` and `TypeOfBasisForModifiedOpinionOnFinancialStatementsExtendedReview` must be filled in. |
| `v102.0101` | 1 | **Advis** | If `TypeOfAuditorAssistance` = audit opinion (revisionspåtegning), then both `TypeOfModifiedOpinionOnAuditedFinancialStatements` and `TypeOfBasisForModifiedOpinionOnAuditedFinancialStatements` must be filled in. |
| `v102.0102` | 1 | **Advis** | If `TypeOfAuditorAssistance` = review (review-erklæring), then `TypeOfModifiedOpinionOnAuditedFinancialStatementsReview` must be filled in. |
| `v300.0100` | 1 | **Advis** | If `NameOfEntityParticipantNotPartOfTheRegisteredManagementMemberOfExecutiveBoard` has a value, then `IdentificationNumberCVRofParticipantNotPartOfTheRegisteredManagementMemberOfExecutiveBoard` must also be filled in. **Fields removed from the 2022 taxonomy onward** — applies to taxonomy years 2020–2021 only.
| `v300.0101` | 1 | **Advis** | Same pattern for supervisory board: `NameOfEntityParticipantNotPartOfTheRegisteredManagementMemberOfSupervisoryBoard` → requires `IdentificationNumberCVRofParticipantNotPartOfTheRegisteredManagementMemberOfSupervisoryBoard`. Also removed from 2022 taxonomy onward.
| `v500.0100` | 1 | **Advis** | If both `GrossResult` (Bruttoresultat) and `GrossProfitLoss` (Bruttofortjeneste/-tab) are tagged, they should not have differing values — *"Begge mellemtotaler bør ikke forekomme i samme regnskab, og slet ikke med forskellige værdier"* (both are subtotals; `GrossProfitLoss` should only be used when a specific selected subset of income-statement lines is aggregated). |

**Every single rule documented here is Type = Advis (warning), Fase 1.** None is marked **Fejl** (error/blocking). No numeric **tolerance** value is given for any rule — none of the seven rules are numeric-tolerance arithmetic checks; they are either presence/completeness checks (existence, conditional-on-another-field completeness) or a same-value consistency check between two named subtotal elements (`GrossResult` vs `GrossProfitLoss`, exact-equality implied, no tolerance stated).

### What this means for arithmetic identities a reader can rely on
**None of the seven documented rules assert core arithmetic identities such as Assets = LiabilitiesAndEquity, that ProfitLoss ties to its components, or that any balance-sheet/income-statement subtotal sums correctly from its child line items.** The only subtotal-consistency rule present (`v500.0100`, GrossResult vs GrossProfitLoss) is (a) a warning, not a blocking error, and (b) an equality-between-two-alternate-subtotals check, not a validation that either subtotal correctly sums its constituent lines.

Additionally: the AARL architecture document (2015) states in footnote 25 that *"[additional instance-document characteristics] can be controlled by a formula linkbase that supports the taxonomy. Current version of the DCCA taxonomy does not contain such functionality though"* — i.e., as of 2015 there was no formula linkbase at all for the DCCA taxonomy, and §4.2.2 of AARL describes only **presentation** and **definition** (dimensional) linkbases as the standard per-component linkbases, plus an optional formula linkbase (which existed as a described-but-unused file type in 2015). AARL does **not** describe a **calculation linkbase** (XBRL 2.1 summation-item arcs) as part of the DCCA taxonomy's file set at all — in contrast to ESEF, which explicitly ships `esef_all-cal.xml` (§6 below). So even the traditional XBRL calculation-linkbase mechanism for verifying subtotal arithmetic is **not documented as present** in the DCCA/ÅRL taxonomy per AARL.

The FRM document's own foreword also signals that these seven "formula" rules are only part of ERST's total validation surface: *"Ud over disse kontroller har Erhvervsstyrelsen udarbejdet og implementeret en række kontroller i forbindelse med en række tekniske og andre forretningsmæssige regler. Disse samles i udgivelser magen til denne"* — i.e., there are **other ERST publications, not reviewed here**, covering "technical and other business rules" (which conceivably could include arithmetic/balance checks). **Conclusion: based strictly on these three documents, a reader must NOT assume Assets=LiabilitiesAndEquity, ProfitLoss ties, or any other core subtotal identity was validated/enforced at submission time.** Such identities may or may not be checked by other, undocumented-here ERST mechanisms; the FRM document does not establish that a filing would have been rejected for violating them, and AARL positively states the formula-linkbase mechanism was absent at the taxonomy's founding. A program reading these instances should therefore **independently validate/derive subtotals rather than trust that ERST enforced them**, and should tolerate encountering instances where e.g. Assets ≠ LiabilitiesAndEquity as reported.

---

## 6. ESEF Taxonomy structure (ESMA ESEF XBRL Taxonomy Documentation, 20 Dec 2019, §3)

This is a **separate, unrelated-in-file-structure taxonomy from ÅRL/DCCA** — relevant only if/when IFRS/ESEF instances are also being parsed (per the task's framing, this is exactly the intended new scope).

### General design (§3.1)
> "The ESEF Taxonomy includes minimum changes (extensions or customisations) compared to the IFRS Taxonomy prepared by the IFRS Foundation... the ESEF Taxonomy is flexible and it is intended to be used as a starting point for issuers to create their own taxonomies" — i.e., **extension is the norm**, unlike ÅRL/DCCA's closed, non-extensible model (AARL §12).

### XBRL specifications applied (§3.2)
XBRL 2.1, Dimensions 1.0, Generic Link 1.0, Generic Labels 1.0, **Formula 1.0**, Taxonomy Packages 1.0, LRR, DTR, Functions registry.

### Relation to other taxonomies (§3.3)
- **IFRS Taxonomy** (§3.3.1): ESEF imports the **FULL IFRS Taxonomy** (not IFRS for SMEs) — *"the taxonomy which applies to financial statements prepared in accordance with the full IFRS Standards."* ESEF **directly imports all FULL IFRS Taxonomy elements** and links to their English references/labels, but ESEF **customises** (does not directly import) the IFRS presentation/definition/calculation relationships.
- **LEI taxonomy** (§3.3.2): the XBRL International **LEI taxonomy** is imported so issuers can be identified/validated by Legal Entity Identifier, per the RTS on ESEF requirement.

### Namespace/version conventions — dated URIs (§3.4.1)
> "The root URI applied to folder path and XML namespaces is `http://www.esma.europa.eu/taxonomy` followed by a taxonomy version date (`{date}`) component in YYYY-MM-DD format."

This is the opposite convention from ÅRL/DCCA (undated namespaces + date only in folder/entry-point-filename): **ESEF namespaces are dated**, e.g. `esef_cor.xsd` elements live in namespace `http://www.esma.europa.eu/taxonomy/{date}/esef_cor` with canonical prefix `esef_cor` (§3.4.4). §3.5.2 confirms future releases are distinguished the same way: *"Taxonomy releases will be distinguished using a date component on the root folder and in the taxonomy namespace."* (The task's example `https://www.esma.europa.eu/taxonomy/2024-03-27/esef_cor` matches this dated-namespace pattern, though that specific 2024-03-27 date is not itself named in this 2019 document — the document only establishes the *convention*, current as of 2019 to the root `http://www.esma.europa.eu/taxonomy`.)

### File structure — esef_cor, esef_all, technical.xsd (§3.4.2–3.4.3, Table 1)
- **`technical.xsd`** (in `.../ext/` folder): declares data types, role types and other technical constructs used for XBRL validation; imported and applied throughout.
- **`esef_cor.xsd`** — the **preparer-facing entry point**:
  - Imports the IFRS core schema (`full_ifrs-cor_20YY-MM-DD.xsd`, i.e. FULL IFRS elements);
  - Links all FULL IFRS reference linkbase files (e.g. `ref_ias_1_20YY-MM-DD.xml`);
  - Imports the **LEI XBRL Taxonomy**;
  - Imports `technical.xsd`;
  - Defines ESEF **extension elements** (guidance elements, placeholders) and extended-link roles used in the referenced definition linkbase;
  - References a definition linkbase `esef_cor-dim.xml` and an assertions linkbase `esef_cor-for.xml`;
  - *"Serves as an entry point importing the necessary IFRS and ESEF Taxonomy content to be applied as a starting point for issuers' extension."*
- **`esef_all.xsd`** — the **browsing/reference entry point**: defines roles for ESEF linkbases documenting relationships; refers to `esef_all-pre.xml` (presentation), `esef_all-cal.xml` (**calculation**), `esef_all-def.xml` (definition), `esef_all-for.xml` (assertions). *"Serves as a reference entry point to be used by issuers' or the supporting software for browsing the content of the ESEF Taxonomy"* — **not** meant to be imported by issuer extensions (that's `esef_cor.xsd`'s job).
- Label files: `esef_cor-lab-{lg}.xml`, `esef_cor-gen-{lg}.xml`, `esef_all-gen-{lg}.xml` (`{lg}` = ISO 639-1 language code; all official EU languages provided for standard/documentation labels), referenced indirectly via Taxonomy Packages.
- `esef_cor-dim.xml` (referenced from `esef_cor.xsd`): **contains the extended link role defining default members for dimensions**, plus extended link roles that "prevent all non-abstract items from being reported (unless dimensionally qualified in the extension taxonomy) by linking them to a hypercube referring to an empty dimension for scenario and segment containers," and provides a **placeholder** to attach line-items-not-dimensionally-qualified in the preparer's own extension taxonomy.

### The "Consolidated and separate financial statement" axis (§3.4.5)
> "One of these [roles in `esef_cor.xsd`] in particular is applied to provide a placeholder ('Line items not dimensionally qualified placeholder') to attach in the preparer's extension taxonomy all line items used to tag data and not dimensionally qualified to a 'Line items not dimensionally qualified' hypercube linking to **'Consolidated (member)' of 'Consolidated and separate financial statement (axis)' dimension**."

So: **the document confirms the axis exists and names its default/placeholder member as "Consolidated (member)"** — i.e., **unqualified/undimensioned facts in an ESEF instance default to the Consolidated member of the Consolidated-and-separate-financial-statement axis.** The document gives the *concept* names in prose ("Consolidated and separate financial statement (axis)", "Consolidated (member)") but **does not give the formal QName** (e.g. `ifrs-full:ConsolidatedAndSeparateFinancialStatementsAxis` / `ifrs-full:ConsolidatedMember`) — those come from the underlying IFRS taxonomy itself, imported wholesale by `esef_cor.xsd`, not defined by ESMA's own files, and this document does not spell them out. No other members of that axis are named in this document (e.g. a "Separate" or "Parent" member is not mentioned).

### Anchoring
**The word "anchor"/"anchoring" does not appear anywhere in this 10-page document.** The document defers entirely to external material: *"For further information on the rationale of the choices made with regards to extensibility of the taxonomy and to the rules for creating and anchoring extensions, please refer to the Final Report on the RTS on ESEF (and in particular, Annex III) and to the ESEF Reporting Manual."* (§3.1). **This document does not describe anchoring rules at all** — that must be sourced from the RTS Final Report Annex III or the ESEF Reporting Manual, neither of which was provided for this review.

### Role URI pattern (§3.4.5)
> "the role URIs (apart from those used for technical purposes and in the formula linkbase) follow the pattern: `http://www.esma.europa.eu/xbrl/role/{cor/all}/{origin}_role-NNNNNN` where NNNNNN is a number used to support ordering display of ELRs and `{origin}` identifies the source standard or information requirement (e.g. `ias_10`, `ifrs_7`, `ifrs`, `esef`)."` Structurally analogous in purpose (ordering + source tagging) to AARL's `NNN.NN` scheme, but a different literal pattern (single incrementing number, source-standard prefix, vs. DCCA's fixed 3-digit-component + 2-digit-subset).

### Report/data quality checks — assertions (§3.4.6)
Two linkbase types cover arithmetic/consistency:
- **`esef_all-cal.xml`** — the **calculation linkbase**: *"Documentation of simple arithmetic relationships between elements (like subtraction or summation)... derived from the structures of the IFRS Taxonomy."* This is a genuine XBRL 2.1 calculation (summation-item) linkbase — something AARL/DCCA does **not** document having.
- **More complex checks** use XBRL **Formula Specification** assertions, defined in `esef_cor-for.xml` (referenced from `esef_cor.xsd`) and `esef_all-for.xml` (documentation-only, referenced from `esef_all.xsd`).
- **Severity**: *"To avoid automatic rejection of submitted reports due to assertion inconsistencies, **most checks are marked as warnings rather than errors**, using mechanisms defined by the XBRL Assertions Severity."* Each assertion carries a human-readable English error message per the Generic Messages spec.
- **Counts** (Table 2, ESEF-specific only): **10 existence assertions** (pattern `man_{formula_id}`, "Mandatory mark-up validations" — 10 of them per the table) and **18 value assertions**, broken down by pattern:
  - `con_{formula_id}` — **Context validations** (context/date-format/entity-identifier/segment-container rules) — **8** assertions.
  - `fac_{formula_id}` — **Fact and footnote validations** — **10** assertions.
  - `man_{formula_id}` — **Mandatory mark-up validations** (elements that must be tagged when the corresponding data is present) — **10** assertions.
  - (8+10+10 = 28 total in the table, though the narrative text states "10 existence assertions and 18 value assertions" = 28 as well — consistent totals, just two different groupings: E/V type vs. con/fac/man pattern.)
  - Additionally: **443 value assertions are derived from the IFRS taxonomy itself** (not ESEF-specific), and `esef_cor-for.xml` links **6 additional assertions from the imported LEI taxonomy**.
- Full documentation of all assertions is in a companion Excel file (ESMA32-60-537, not reviewed here), not in this document itself.

### Entry points (§3.4.7)
Exactly two:
- **`esef_cor.xsd`** — *"to be imported by preparers' extension schema files: it enables to discover definitions for all taxonomy concepts as well as the list of dimension default members and a placeholder to attach to a dedicated hypercube for primary items not dimensionally qualified in issuer's extension; it also references assertions that can be executed to ensure the quality of a report."*
- **`esef_all.xsd`** — *"to be used to view the full content of the taxonomy: it imports or refers to all ESEF Taxonomy files including all linkbases."*

### Development/updates (§3.5) and content (§3.6)
ESMA-specific customizations vs. FULL IFRS Taxonomy: fewer files; added guidance elements for browsing; an extended-link-role section identifying which elements must be used when corresponding data is present; technical constructs prohibiting reporting of any ESEF element unless used in a preparer's extension taxonomy; ESEF Reporting Manual–derived assertions; core taxonomy elements translated into all EU official languages. The rendered/output content of the ESEF presentation linkbase is codified in **Annex VI of Commission Delegated Regulation No. 2019/815** (as updated by 2019/2100) — i.e., the legally binding content reference is the EU regulation annex, not this document itself.

---

## Summary of explicit gaps (things the reviewed documents do NOT cover)

1. **CVR entity-identifier scheme URI** — not given anywhere in AARL (only a placeholder `http://scheme` in an illustrative code example).
2. **Exact QNames for `cmn:ConsolidatedSoloDimension`/`ConsolidatedMember`/`SoloMember`** and which one is the default — AARL describes the dimension only in prose, never by QName, and never states which member is default.
3. **"Required information" / "ExcludingBalanceSheet" entry points** — not mentioned in AARL at all; not part of the 2015-10-01 taxonomy snapshot the document describes.
4. **2024 `ReportedValueOtherRenderingOfReportedValueDimension`** — postdates this 2015 document; not sourceable from it.
5. **Comparative-period context construction rules** — no explicit rule given in AARL.
6. **Arithmetic/tolerance rules for core identities (Assets=LiabilitiesAndEquity, etc.)** — not covered by the FRM document's 7 rules (all Advis-level, none is a core-total check); AARL indicates no calculation linkbase and (as of 2015) no formula linkbase existed for DCCA at all. This cannot be relied upon as validated by ERST based on these three documents.
7. **ESEF anchoring rules** — explicitly deferred by the ESEF document to the RTS Final Report Annex III / ESEF Reporting Manual, neither reviewed here.
8. **Formal QName for the ESEF "Consolidated and separate financial statement" axis and its members (beyond "Consolidated (member)")** — named only in prose; other members of the axis besides Consolidated are not named in this document.
