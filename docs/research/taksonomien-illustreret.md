# Notes: "Taksonomien Illustreret" guides (IFRS-DK 2013 and ÅRL) — read for IFRS-DK → ÅRL conversion

Source files (recovered from truncated/garbled PDF text-stream extraction; Danish prose is intact but glued together, with PDF operator noise like `T*`, `ET`, `Q`, stray `0`, and words merged without spaces — e.g. "Materielleaktiver" for "Materielle aktiver"):

- `ifrsdk_vejledning_revisorer_2013.txt` — "IFRS Taksonomien Illustreret" (Erhvervsstyrelsen, Dec 2013), 137 "pages"/lines, ~300k chars.
- `aarl_vejledning_revisorer.txt` — "ÅRL Taksonomien Illustreret", 77 "pages"/lines, ~238k chars.
- `ifrsdk_eksempelregnskab_2014.txt` — Erhvervsstyrelsen's illustrative IFRS annual report for "ABC A/S" (short, clean text — read in full).

**Important caveat that applies to the whole note:** neither guide's recovered text contains a single namespace‑prefixed XBRL QName (no `ifrs-full:...`, `ifrs-dk:...`, or `fsa:...` string appears anywhere — verified by exhaustive grep over both files, 0 hits). What the guides print, per element, is: a **human‑readable element label** (mostly Danish, a handful of un‑translated English labels — see §2), a **format code** (`Text`, `X instant`, `X duration`, `X.XX`, `Shares`, `yyyy-mm-dd`, `Table`, `Axis`, `Member`), and a **reference** (IAS/IFRS/IFRIC paragraph + effective date + eIFRS URL for IFRS‑DK; ÅRL paragraph + "Bilag 2, Skema n" + Skat felt‑nr. + DST‑kode for ÅRL). Wherever the task asks for "exact QNames," I give the exact printed label instead and say explicitly that no QName is present in the source. Danish labels are reconstructed by closing the word-splits (e.g. "Materielleaktiverialt" → "Materielle aktiver i alt"); anywhere the split is genuinely ambiguous I mark it "(?)".

Also: the bracketed five-digit "[nnn.nn]" section numbers the task description mentions ([000.00], [102.00], [200.00], [310.00]/[320.00]...) do **not** survive in this extraction — grepped for `[0-9]{3}\.[0-9]{2}`, `[0-9]{5,6}`, and the literal substring `000` across the whole IFRS-DK file: zero hits. They were almost certainly rendered as separate, positioned PDF text objects (running heads/sidebar numbers) that this content-stream extraction dropped. The guide's own prose (quoted in §1) confirms such numbers exist and what they mean, but their values for specific sections are not visible in the recovered text. This is flagged as "not observed" rather than invented.

---

## 1. How the guides explain the structure

Both guides open with an almost word-for-word identical "Introduktion" / "Således læses [IFRS/ÅRL] Taksonomien Illustreret" section. Reconstructed IFRS-DK version (ÅRL's is the same template with "IFRS" replaced by "ÅRL"):

> "IFRS Taksonomien Illustreret angiver taksonomiens hierarki og elementer og det dertil påkrævede format såsom tekst, beløbsværdi osv. Herudover angives regnskabsregler og paragraffer. Taksonomien omfatter alle informationer af årsrapporten, herunder virksomhedsoplysninger, beskrivelse af anvendt regnskabspraksis, ledelsesberetning, påtegninger, noter, resultatopgørelse, balance osv."

Column explanation (identical wording in both guides, only "IFRS"/"ÅRL" swapped):

- **Første kolonne – Hierarki**: "Den første kolonne repræsenterer hierarkiet i [IFRS/ÅRL] taksonomien: Overskrifterne i kolonnen repræsenterer navnet på en regnskabskomponent. Foran hver kolonneoverskrift er angivet et femcifret nummer i firkantede parenteser, som har en værdi mellem [og]. Disse numre er generiske og giver visning samt sorteringsfunktionalitet — de er ikke relateret til [IFRS/ÅRL] eller anden regnskabsregulering. Rækkerne under overskriftskolonnen repræsenterer de elementer, som tilhører denne komponent."
  - i.e. the guides themselves say the bracketed numbers are pure display/sort keys with no accounting meaning — confirming the task's premise that a `[000.00]`/`[102.00]`/`[200.00]` numbering scheme exists, even though the actual digits are not recoverable from this text.
- **Anden kolonne – Oplysningsformat** ("format"), with the literal legend list (identical in both guides):
  - `Text` — "Angiver at oplysningsformatet er en tekst."
  - `yyyy-mm-dd` — "...en dato."
  - `X` — "...en monetær værdi."
  - `X.XX` — "...en decimal værdi."
  - `Shares` — "...et antal aktier."
  - `Table` — "Angiver begyndelsen af en todimensional oplysning."
  - `Axis` — "Angiver en akse på en todimensional oplysning."
  - `Member` — "Angiver et medlem på en akse."
  - `X duration` — "...en monetær værdi for en periode."
  - `X instant` — "...en monetær værdi for en bestemt dato."
- **Tredje kolonne – Reference**: "Den tredje kolonne indikerer referencen til elementet." — in practice this is the law/standard paragraph citation, not a QName.

Sections identifiable in reading order (IFRS-DK file), reconstructed from headings actually found in the text (not from the lost bracket numbers):

1. **Indsendelsesoplysninger** ("Information om indsendelse, rapporttype og regnskabsaflæggende virksomhed") — submitter/filer info, report-type, reporting entity, entity address, bank, lawyer.
2. **Informationer om revisor** ("Information om revisor") — auditor identity, then a large block of **Revisors erklæringer** (auditor's report variants: full audit ("Revisionspåtegning"), extended review ("Erklæring om udvidet gennemgang"), review ("Erklæring om gennemgang/review"), other assurance and non-assurance reports), each tagged with §-references to "Erklæringsbekendtgørelsen."
3. **Ledelsesberetning** (Management commentary) — headed explicitly "Ledelsesberetning MC 2011-01-01 Framework for the presentation of management commentary" (IFRS Practice Statement "Management Commentary," referenced as standard type `MC`), then items like "Oplysning om arten af forretningsvirksomhed" (MC §24a), "...ledelsens målsætning og strategi..." (§24b), "...virksomhedens væsentligste aktiver, trusler og relationer" (§24c), "...driftsresultat og forventninger til fremtiden" (§24d).
4. **Ledelsespåtegning** — board/management signatures, incl. dissent disclosures ("Beskrivelse af uenighed om årsrapporten for medlem af direktionen/bestyrelsen"), ÅRL §10(1)-referenced even inside the IFRS-DK guide (management-statement rules come from ÅRL, not IFRS).
5. **Hoved- og nøgletal** (financial highlights / ratios) — "Afkastningsgrad," "Soliditetsgrad," "Solvensgrad," "Forrentning af egenkapitalen," "Afkast af investeret kapital," "Finansiel gearing," "Nettoomsætning pr. medarbejder," all format `X.XX duration` and referenced only to **"Erhvervs- og Selskabsstyrelsen Praksis"** (i.e. Danish administrative practice, not an IAS/IFRS paragraph) — a strong signal these are ifrs-dk/Danish "common practice" additions rather than ifrs-full concepts.
6. **Primary statements**, each wrapped in a **"Fælles table"** ("common table") carrying the dimension `Koncernregnskaber og årsregnskaber axis` (see §3) — offered in the following variant pairs:
   - Statement of financial position — **classified (current/non-current)** version, immediately followed by a **second, separate** "Opgørelse af finansiel stilling efter likviditetsorden" (statement of financial position in order of liquidity), reusing largely the same line items.
   - Income statement — **"Funktionsopdelt Resultatopgørelse"** (by function) and **"Artsopdelt Resultatopgørelse"** (by nature), as two separate, parallel statements.
   - **"Indtjening pr. aktie"** (EPS, IAS 33) as its own sub-section under the income statement, with its own dimension `Ordinære aktieklasser axis` / `Ordinære aktier member`.
   - **Statement of comprehensive income** — headed **"Totalindkomstopgørelse, Øvrige totalindkomstkomponenter præsenteret med fradrag af skat"** (OCI presented net of tax); the wording implies a parallel "...præsenteret før skat" (gross-of-tax, with separate tax reclassification lines) variant exists in the taxonomy, consistent with IAS 1's alternative presentation, though the "before tax" heading text itself was not found verbatim in the recovered pages (see §2 OCI subsection for what *was* found).
   - Cash flow statement — **"Direkte Pengestrømsopgørelse"** and **"Indirekte Pengestrømsopgørelse"** as two separate, explicitly labelled statements.
   - **Statement of changes in equity** ("Egenkapitalopgørelse"), ending in "Egenkapital ultimo."
   - A niche **"Opgørelse over nettoaktiver som er disponible for ydelser"** (IAS 26 — net assets available for benefits, i.e. pension/employee-benefit-plan reporting) appears as the very last statement in the file — an IFRS-DK statement type with no ÅRL counterpart at all.
7. The file ends mid-note (IAS 26 disclosures) at line 137; a further notes section (property/intangible movement schedules, financial instruments, related parties, segments, subsequent events, etc.) evidently exists in the full taxonomy but is not present in this recovered excerpt beyond what is embedded in the primary statements themselves (see §4).

ÅRL guide mirrors the same intro/column-legend template and the same "Fælles table" pattern, but its dimension for consolidated/separate is worded differently (§3), and its "Indsendelsesoplysninger" section (fully read) additionally covers **"Informationom revisor," "Informationom likvidator," "Informationom medlemmer af direktionen/bestyrelsen," "Information til Danmarks statistik (DST)"** — i.e. the ÅRL taxonomy explicitly wires the same submission block into Danmarks Statistik reporting via a `DST` common table (with a `Tilbagemelding DST`/"ønsker gratis statistik" opt-in flag and named DST contact-person elements `DST KNAVN`, `DST KEPOST`, `DST KTLF`, `DST KLTLF`). No equivalent DST wiring was found anywhere in the IFRS-DK file (0 hits for "DST" or "Danmarks Statistik" in ifrsdk file — see §7).

---

## 2. IFRS-DK: statement sections and line-item labels

All formats below are as printed (`X instant` = monetary, point-in-time; `X duration` = monetary, period; `X.XX duration` = ratio/decimal). Legal references are IAS/IFRS paragraph citations as printed (e.g. "IAS 1.54(c)"); most items carry two near-duplicate reference blocks for taxonomy versions dated 2011-03-25 and 2011-06-01 — collapsed here to one citation.

### Statement of financial position (current/non-current)

**Assets**

- Property, plant and equipment breakdown: "Grunde og bygninger," "Produktionsanlæg og maskiner," "Driftsmidler i alt," "Inventar og installationer i alt," "Kontorudstyr," "Byggeri under opførelse," "Andre materielle aktiver," **"Materielle aktiver i alt"** — IAS 16.37(e)/73(e), IAS 1.54(a).
- **"Investeringsejendomme"** (Investment property) — IAS 1.54(b), IAS 40.76/79(d).
- Intangibles/goodwill group header **"Immaterielle aktiver og goodwill"**:
  - "Immaterielle aktiver bortset fra goodwill" sub-group: Varemærker, Rettigheder, "Immaterielle efterforsknings- og vurderingsaktiver," Copyrights/patenter, Computersoftware, "Opskrifter, formler, modeller, design og prototyper," "Immaterielle aktiver under udvikling" (Udviklingsprojekter, incl. "Udviklingsprojekter under opførelse," "It-udviklingsprojekter under opførelse"), Koncessioner, "Licenser og franchiseaftaler i alt," "Andre immaterielle aktiver i alt" (incl. "Kunderelationer," "Knowhow," "Distributionsnetværk"), **"Immaterielle aktiver bortset fra goodwill i alt"** — IAS 1.54(c), IAS 38.119/118(e).
  - **"Goodwill"** X instant — IAS 1.54(c), IAS 36.134(a)/135(a), **IFRS 3.B67(d)**.
  - **"Immaterielle aktiver og goodwill i alt"** X instant — IAS 1.55.
- **"Investeringer behandlet regnskabsmæssigt efter indre værdis metode"** (Investments accounted for using the equity method) — IAS 1.54(e), IFRS 8.24(a).
- Group header **"Investeringer i dattervirksomheder, joint ventures og associerede virksomheder"**:
  - **"Investeringer i dattervirksomheder"** X instant — **IAS 27.38** (the separate-financial-statements paragraph of IAS 27).
  - **"Investeringer i joint ventures"** X instant — IAS 27.38.
  - **"Investeringer i associerede virksomheder"** X instant — IAS 27.38.
  - "Investeringer i porteføljevirksomheder" X instant, "Andre investeringer" X instant — **no IAS/IFRS reference printed**, i.e. these read as ifrs-dk Danish additions layered onto the IAS 27.38 group.
  - **"Investeringer i dattervirksomheder, joint ventures og associerede virksomheder i alt"** X instant — IAS 1.55.
- **"Langfristede tilgodehavender hos nærtstående parter"** (non-current receivables from related parties):
  - **"Langfristede tilgodehavender hos datterselskaber"** X instant — the "receivables from group enterprises" line.
  - "Langfristede tilgodehavender hos associerede virksomheder," "Langfristede tilgodehavender hos joint ventures," "Langfristet ansvarlig lånekapital," **"...i alt"** — IAS 1.78(b).
  - Plus "Langfristede tilgodehavender fra salg," "Langfristede leasing forudbetalinger," Deposita, "Langfristede varebeholdninger" — all IAS 1.54/78(b)/(g).
- "Værdipapirer" (securities) block: "Afledte finansielle instrumenter," "Andre aktieinvesteringer," "Langfristede kapitalandele," "Langfristede derivater," "Langfristede børsnoterede aktier," "Langfristede obligationer," **"Værdipapirer i alt"**; plus IFRS 7-referenced fair-value/AFS/held-to-maturity/loans-and-receivables/amortised-cost categorisations (all "Effective/Expiry date 2013-01-01" — the IFRS 9 transition tagging), rolling up to **"Langfristede finansielle aktiver i alt"** X instant — IFRS 7.25.
- **"Udskudte skatteaktiver"** (Deferred tax assets) X instant — IAS 12.81(g)(i), IAS 1.54(o)/56.
- "Langfristede aktuelle skatteaktiver" (long-term current tax assets) — IAS 1.54(n).
- **"Langfristede aktiver i alt"** (Total non-current assets) X instant — IAS 1.66.
- **Current assets** ("Kortfristede aktiver"): inventory categories (Råvarer, Handelsvarer, Produktionsomkostninger, Varer under fremstilling, Færdigvarer, "Varebeholdninger i alt" — IAS 2.37, IAS 1.54(g)/68), then "Tilgodehavender fra salg og tjenesteydelser i alt," "Entreprisekontrakter i alt," **"Kortfristede tilgodehavender hos datterselskaber"** / "...hos associerede virksomheder" / "...hos joint ventures" / **"...i alt"** (current receivables from group/associated/JV — IAS 1.78(b)), "Andre kortfristede tilgodehavender i alt," "Kortfristede aktuelle skatteaktiver," "Kortfristede biologiske aktiver," the mirrored IFRS 7 fair-value/AFS/HTM/loans categorisation → **"Kortfristede finansielle aktiver i alt"** (IFRS 7.25).
  - **"Likvide beholdninger"** (Cash and cash equivalents): "Kontanter," "Indestående hos kreditinstitutter," "Andre anfordringsindskud," "Indeståender," "Indestående på sikringskonto," **"Likvider i alt"** (IAS 7.45); plus a separate "Likvide værdipapirer" sub-block (short-term deposits/investments classified as cash equivalents), **"Likvide værdipapirer i alt"**; then "Andre likvide beholdninger," and the roll-up **"Likvide beholdninger i alt"** X instant — **IAS 1.54(i)**, IAS 7.45.
  - Assets held for sale (IFRS 5.38) roll into **"Kortfristede aktiver i alt"** (Total current assets) X instant — IAS 1.66.
- **"Aktiver i alt"** (Total assets) X instant — IAS 1.55, plus IAS 28.37(b)/(i) and IFRS 8.28(c)/23 (segment reconciliation references).

**Equity and liabilities**

- Header **"Egenkapital og forpligtelser"** → **"Egenkapital"**:
  - **"Virksomhedskapital"** → **"Aktiekapital/anpartskapital/fondskapital"** (share/partnership/foundation capital) X instant — IAS 1.78(e).
  - **"Overført resultat"** → "Overført resultat, moderselskab," **"Overført resultat i alt"** — IAS 1.78(e)/IG6.
  - **"Overkurs ved emission"** (Share premium) X instant — IAS 1.78(e).
  - **"Egne aktier"** ("Reserve for egne aktier," "Beholdning egne aktier," "Egne aktier i alt") — IAS 1.78(e), IAS 32.34.
  - "Andre kapitalandele" X instant.
  - **"Andre reserver"**: "Reserve for valutakursregulering," "Reserver for sikringstransaktioner" (+ "Dagsværdi af sikringsinstrumenter," "Valutakursreguleringer vedrørende sikringstransaktioner," "...i alt"), "Reserve for aktuarmæssige gevinster/tab," "Reserve for værdipapirer disponible for salg i alt," "Foreslået udbytte," "Udbytte til udlodning," **"Andre reserver i alt"** — IAS 1.78(e).
  - **"Egenkapital, der kan henføres til ejerne i modervirksomheden"** (Equity attributable to owners of the parent) X instant — **IAS 1.54(r)**.
  - **"Minoritetsinteresser"** (Non-controlling interests) X instant — **IAS 1.54(q)**.
  - "Diverse egenkapital": "Kapitalreserver," "Yderligere indbetalt kapital," "Akkumuleret øvrig totalindkomst," "...i alt," plus "Anden virksomhedskapital."
  - **"Egenkapital i alt"** (Total equity) X instant — IAS 1.55/78(e), IFRS 1.24(a)/32(a)(i).
- **"Forpligtelser"** (Liabilities):
  - **"Langfristede forpligtelser"** (Non-current liabilities):
    - **"Langfristede hensatte forpligtelser"** (non-current provisions): personaleydelser, garantiforpligtelser, omstrukturering, retssager, tabsgivende kontrakter, afvikling/reetablering/genopretning, tilbagebetalinger, "Diverse andre hensatte forpligtelser" — each with IAS 37 illustrative-example anchors — rolling to **"Langfristede hensatte forpligtelser i alt"** X instant — **IAS 1.54(l)**.
    - **"Lån"**: "Langfristet lånoptagelse" (Obligationslån, Andre lån, i alt) + "Kortfristede lån og kortfristet del af langfristede lån" → **"Lån i alt"** X instant — IAS 1.55.
    - **"Langfristede gældsforpligtelser til nærtstående parter"**: **"Gæld til moderselskab"**, **"Gæld til datterselskaber"** X instant (the "payables to group enterprises" line), "Gæld til joint ventures," "Gæld til associerede virksomheder," **"...i alt"** — IAS 1.78.
    - "Kreditinstitutter" (Real kreditinstitutter, Andre kreditinstitutter, Bankgæld, Prioritetsgæld, i alt), deferred income, and the IFRS 7 fair-value/amortised-cost/leasing categorisation of financial liabilities.
    - **"Udskudte skatteforpligtelser"** (Deferred tax liabilities) X instant — **IAS 12.81(g)(i)**, IAS 1.54(o)/56.
    - **"Langfristede forpligtelser i alt"** (Total non-current liabilities) X instant — **IAS 1.69**.
  - **"Kortfristede forpligtelser"** (Current liabilities), mirroring the non-current structure: current provisions, "Kortfristet leverandørgæld," **"Kortfristede gældsforpligtelser til nærtstående parter"** (Gæld til moderselskab/datterselskaber/associerede virksomheder/joint ventures, i alt), **"Skyldig skat"** (Current tax payable) X instant — IAS 1.54(n), assets/liabilities held for sale (IFRS 5.38), rolling to **"Kortfristede forpligtelser i alt"** X instant — **IAS 1.69**.
  - **"Forpligtelser i alt"** (Total liabilities) X instant — IAS 1.55.
- **"Egenkapital og forpligtelser i alt"** (Total equity and liabilities) X instant — IAS 1.55.

### Statement of financial position in order of liquidity

Immediately follows, under its own heading "Opgørelse af finansiel stilling efter likviditetsorden" → "Finansiel stilling" → "Aktiver" → "Materielle aktiver" — largely re-presents the same PP&E/intangible/financial-asset element set (Grunde, Bygninger, "Grunde og bygninger i alt," Transportmidler, Maskiner, Produktionsanlæg, Containere, Driftsmateriel, Inventar og installationer, Kontorudstyr, "Materielle efterforsknings- og vurderingsaktiver i alt") — the guide gives no separate, distinctly-worded item set for this variant; it is presented as a re-ordering of the same catalogue rather than a materially different one.

### Income statement — by function ("Funktionsopdelt Resultatopgørelse")

- **"Omsætning"** / **"Nettoomsætning"** (Revenue) X duration — IAS 18.35(b), IAS 1.82(a)/102/103.
- **"Produktionsomkostninger"** (Cost of sales) X duration.
- "Driftsomkostninger," **"Vareforbrug"** X duration — IAS 1.99/103.
- **"Bruttoresultat"** (Gross profit) X duration — IAS 1.103.
- "Forsknings- og udviklingsomkostninger," **"Andre indtægter"** (Other income) X duration — IAS 1.102/103.
- **"Distributionsomkostninger"** (Distribution costs) X duration, "Salgsomkostninger" — IAS 1.99/103.
- **"Administrationsomkostninger"** (Administrative expenses) X duration — IAS 1.99/103.
- "Andre omkostninger," "Andre gevinster/tab" X duration — IAS 1.102/103.
- "Særlige poster" (Særlig indkomst / Særlige omkostninger / i alt).
- **"Resultat af primær drift (EBIT)"** X duration — IAS 32.IE33 (confirmed verbatim, incl. "(EBIT)", in the example report too).
- **"Finansielle indtægter"** (Finance income) X duration — **IAS 1.85**.
- **"Finansielle omkostninger"** (Finance costs) X duration — **IAS 1.82(b)**.
- **"Andel af resultat i associerede virksomheder og joint ventures, som regnskabsmæssigt er behandlet efter indre værdis metode"** (Share of profit of equity-accounted associates/JVs) X duration — IAS 1.82(c).
- Group **"Resultat i datterselskaber, Joint Ventures og associerede"**: **"Resultat i datterselskaber"**, **"Resultat i associerede virksomheder"**, **"Resultat i joint ventures"**, **"...i alt"** X duration — this is the "income from investments in subsidiaries/associates" line family. Plus "Anden indtægt/udgift fra dattervirksomheder, fælles kontrollerede virksomheder og associerede virksomheder" X duration — IAS 1.85.
- **"Årets resultat før skat af fortsættende aktiviteter"** (Profit before tax, continuing operations) X duration — IAS 1.102/103.
- **"Tax expense (income), continuing operations"** X duration — printed in **English**, one of the rare un-Danished labels found — IAS 12.79/81(c)(i,ii), IAS 1.82(d).
- **"Årets resultat af fortsættende aktiviteter"** X duration — IAS 1.82(f).
- "Skat af årets resultat af ophørte aktiviteter," **"Årets resultat af ophørte aktiviteter"** X duration — IAS 1.82(e), IFRS 5.33(a).
- **"Årets resultat"** (Profit for the year) X duration — **IAS 1.106(d)(i)**, 82(f).
- "Udbytte klassificeret som omkostning" — IAS 32.40.
- **"Årets resultat fordelt på"**: **"Årets resultat som kan henføres til ejerne af modervirksomheden"** X duration — IAS 1.83(a)(ii); **"Årets resultat som kan henføres til minoritetsinteresser"** X duration — IAS 1.83(a)(i).
- **"Indtjening pr. aktie"** (EPS, IAS 33.66), dimensioned by `Ordinære aktieklasser axis`/`Ordinære aktier member`: "Indtjening/tab per aktie fra fortsættende aktiviteter" (IAS 33.66) / "...fra ophørte aktiviteter" (IAS 33.68) / "...i alt" (IAS 33.66), each X.XX duration, plus the "Udvandet" (diluted) equivalents.

### Income statement — by nature ("Artsopdelt Resultatopgørelse")

Same header-to-EBIT skeleton restated with by-nature cost lines instead of by-function ones:

- **"Omsætning"** / **"Nettoomsætning"**, "Direkte omkostninger," "Andre indtægter" (IAS 1.102/103).
- **"Forøgelse/reduktion i lagre af færdigvarer og varer under fremstilling"** (Change in inventories of finished goods and WIP) — IAS 1.99/102.
- "Andet arbejde udført af virksomheden og indregnet i balancen" (own work capitalised).
- **"Råvarer og hjælpematerialer"** (Raw materials and consumables used) — IAS 1.99/102.
- **"Bruttoresultat"** X duration — IAS 1.103.
- **"Personaleomkostninger"** (Staff costs) X duration — **IAS 1.102/99/104**.
- **"Afskrivninger og amortisering"**: "Afskrivninger" (Depreciation), "Amortisering" (Amortisation), **"...i alt"** X duration — IAS 1.102/99/104, IFRS 8.23(e)/28(e).
- "Tilbageførsel af tab ved værdiforringelse (nedskrivning) indregnet i resultatet" (Reversal of impairment loss).
- "Andre omkostninger," "Andre gevinster/tab" (IAS 1.102/103) → same **"Resultat af primær drift (EBIT)"** → finance income/costs → equity-method share of profit → **"Resultat i datterselskaber/associerede/joint ventures"** as in the by-function statement (identical wording, identical references) — confirming both statements converge to the same non-operating and below-the-line structure.

### OCI (statement of comprehensive income)

Confirmed heading: **"Totalindkomstopgørelse, Øvrige totalindkomstkomponenter præsenteret med fradrag af skat"** (net-of-tax presentation), starting from "Årets resultat" and then **"Øvrig totalindkomst"** → **"Elementer af øvrig totalindkomst efter skat"**:
- "Valutakursdifferencer ved omregning" → "Gevinst/tab på valutakursdifferencer ved omregning efter skat" X duration — IAS 1.91(a).
- "Omklassifikationsregler på valutakursdifferencer ved omregning efter skat" — IAS 1.92, IAS 21.48.
- "Reserve for gevinst/tab på valutakursregulering," "Tilbageførsel af valutakursgevinst/tab."
- Further down: **"Totalindkomst der kan henføres til ejerne i modervirksomheden"** X duration — IAS 1.83(b)(ii)/106(a); **"Totalindkomst der kan henføres til minoritetsinteresser"** X duration — IAS 1.83(b)(i)/106(a); "Totalindkomst der kan henføres til foreningens medlemmer" (for cooperative/association entities).
- The "before tax" (gross) OCI variant is implied by the heading's contrast ("...præsenteret med fradrag af skat" only makes sense if a "...præsenteret før skat" sibling exists) but its own heading text was not found verbatim in the recovered pages — flagged as **not directly observed**, only inferred.

### Cash flow statement

Two fully separate, explicitly headed statements:
- **"Direkte Pengestrømsopgørelse"**: "Indbetalinger fra salg af varer og tjenesteydelser" (IAS 7.14(a)), "Indbetalinger fra royalties, honorarer, provisioner og anden omsætning" (IAS 7.14(b)), "Indbetalinger vedrørende kontrakter indgået med handel for øje" (IAS 7.14(g)), insurance-specific inflows (IAS 7.14(e)), etc.
- **"Indirekte Pengestrømsopgørelse"**: starts from **"Resultat af primær drift (EBIT)"**, then "Regulering af årets resultat" → "Resultat fra datterselskaber, joint ventures og associerede virksomheder," "Pengestrøm fra driftsaktivitet før ændring i driftskapital," "Gevinst/tab på arbejdskapital/driftskapital," "Pengestrømme fra drift før skat," "Regulering af omkostninger til indkomstskat" (IAS 7.35), "Regulering af finansielle omkostninger/indtægter" (IAS 7.20(c)).
- Financing-activities section includes **"Gevinst/udgift af ændringer i ejerandelen i en dattervirksomhed, der ikke medfører tab af bestemmende indflydelse"** X duration — IAS 7.42A/42B (transactions with NCI holders that don't change control) — another explicit "group enterprise" element.

### Statement of changes in equity

"Stigning gennem andre bidrag fra ejere" / "Fald gennem andre udlodninger til ejere" (IAS 1.106(d)(iii)), "Stigning/fald gennem overførsel og andre ændringer, egenkapital" (IAS 1.106(d)), "...gennem transaktioner af egne aktier" (IAS 1.109), **"Stigning/fald gennem ændringer i ejerandele i dattervirksomheder, der ikke medfører tab af bestemmende indflydelse"** (IAS 1.106(d)(iii)), "Forøgelse/reduktion igennem aktiebaseret vederlæggelse," **"Total stigning/fald i egenkapital"** (IAS 1.106(d)), **"Egenkapital ultimo"** X instant — IAS 1.55/78(e).

---

## 3. Consolidated vs separate figures, dimensions, facts without dimensions

**IFRS-DK** wires nearly every statement/section to a **"Fælles table"** ("common table") carrying:

> `Koncernregnskaber og årsregnskaber axis` — reference **IAS 27.4** — with members `Koncernregnskab member` (Consolidated financial statements) and `Årsregnskab member` (Separate/annual financial statements), both referenced to **IAS 27, "Disclosure"** section.

This axis appears verbatim, repeatedly, immediately before/after major statement headings (Indsendelsesoplysninger, Revisors erklæringer, Ledelsespåtegning, the by-function and by-nature income statements, EPS, the OCI statement, both cash flow statements, and the equity/liquidity-order balance sheet) — meaning essentially the whole primary-statement catalogue can be tagged either as `Koncernregnskab` (Group) or `Årsregnskab` (Parent/separate) values of the same axis, i.e. one taxonomy element set serves both, disambiguated by the dimension member rather than by separate elements. IAS 27.38 — cited specifically on the "Investeringer i dattervirksomheder/joint ventures/associerede virksomheder" line items — is the paragraph governing how investments in subsidiaries/JVs/associates are measured **in separate financial statements**, confirming those balance-sheet lines are the parent-only (cost/IFRS 9) carrying values, contrasted with consolidation/equity-method figures used when the `Koncernregnskab` member applies.

The guide's own prose does not explicitly define what a fact with **no** dimensional qualification means (i.e. it never states "undimensioned = X"); this was not found in the recovered pages and should be treated as **not covered** rather than assumed.

**ÅRL** uses a differently-named but structurally analogous dimension, found attached to the equity-movement table and elsewhere:

> `Konsolideret/Ikke konsolideret axis` with members `Konsolideret member` / `Ikke konsolideret member`.

So a converter must not assume the member/axis names travel across taxonomies: IFRS-DK's pair is `Koncernregnskab`/`Årsregnskab` (grounded in IAS 27.4), ÅRL's is `Konsolideret`/`Ikke konsolideret` (grounded in ÅRL/Erhvervsstyrelsen practice, no IAS citation). Both, however, use the same generic "Fælles table" packaging pattern, and ÅRL additionally piggybacks a `DST` "Fælles table" (with its own `Konsolideret/Ikke konsolideret axis` instance) onto the Danmarks Statistik reporting block specifically.

---

## 4. Related entities / subsidiaries / group-structure disclosures

**What the guides do show**, in both taxonomies, are the *transactional* group-relationship line items woven into the primary statements:

- IFRS-DK: **"Investeringer i dattervirksomheder"**, "...i joint ventures", "...i associerede virksomheder" (IAS 27.38); **"Langfristede/Kortfristede tilgodehavender hos datterselskaber/associerede virksomheder/joint ventures"**; **"Gæld til moderselskab/datterselskaber/associerede virksomheder/joint ventures"** (langfristet and kortfristet); **"Resultat i datterselskaber/associerede virksomheder/joint ventures"**; "Anden indtægt/udgift fra dattervirksomheder, fælles kontrollerede virksomheder og associerede virksomheder"; the IAS 7.42A/42B NCI-transaction cash-flow line; the IAS 1.106(d)(iii) NCI-ownership-change equity-statement line; and **"Minoritetsinteresser"** (NCI) itself as a distinct equity line (IAS 1.54(q)).
- ÅRL: the direct vocabulary counterpart is **"tilknyttede virksomheder"** (a defined ÅRL term for group/affiliated enterprises — parent + subsidiaries + fellow subsidiaries — broader than "dattervirksomhed"), e.g. **"Kapitalandele i tilknyttede virksomheder, langfristede"**, **"Langfristede tilgodehavender hos tilknyttede virksomheder"**, **"Kapitalandele i associerede virksomheder, langfristede"**, **"Gæld til tilknyttede virksomheder, langfristede"**, **"Gæld til associerede virksomheder, langfristede"**, **"Selskabsskat skyldig til tilknyttede virksomheder, langfristet"** — all referenced to "Årsregnskabsloven Bilag 2, Skema 1/Skema 2." ÅRL also uses "Minoritetsinteresser" (same word, found at multiple points in the equity section).

**What was not found** in either recovered text: a dedicated **master-data note** listing individual group entities by name, CVR-number, domicile/country and ownership/voting percentage (the kind of disclosure IFRS 12 "Disclosure of Interests in Other Entities" requires, or ÅRL §73's "oplysning om dattervirksomheder og associerede virksomheder, herunder navn, hjemsted, ejerandel"). Grep for "Navn på dattervirksomhed," "ejerandel," "stemmerettighed," "hjemsted" (beyond the reporting entity's own domicile field) returned no matches of that kind in either file. The IFRS-DK file's extraction ends (line 137) inside an IAS 26 pension-plan statement, i.e. it appears to stop before reaching (or never included) the detailed notes section where such a subsidiary-listing note would live. **This should be treated as "not covered by the recovered text," not as evidence the taxonomies lack such a note** — general knowledge of IFRS 12/ÅRL §73 strongly suggests such notes exist in the full taxonomies, but this guide excerpt does not document their element names.

---

## 5. Units, scaling, decimals, signs

**Neither guide's narrative text discusses XBRL numeric conventions** (unit references, the `decimals` attribute, scaling factor) — grep for "tusind" and "decimals" returns **zero hits** in both files. This is expected: those are instance-document/XBRL-technical mechanics, not something an illustrated structural guide narrates in prose; **explicitly not covered**.

What *is* observable, from the fully-read `ifrsdk_eksempelregnskab_2014.txt` (the actual example report, not the guide):

- Column headers state the scale explicitly in text: **"t.kr."** (thousand DKK / "tusinde kroner") under both the current-year and prior-year columns, e.g. the totalindkomstopgørelse header shows "Note 2012 2011" over "t.kr. t.kr."
- **Negative values are shown in parentheses**, not with a leading minus sign, e.g. `Produktionsomkostninger (87.891) (91.773)`, `Finansielle omkostninger (4.957) (6.023)`, `Skat af årets resultat af fortsættende aktiviteter (11.564) (11.799)`.
- Danish thousands-separator convention (`.` as thousands separator, e.g. `140.918`) and comma as decimal separator for per-share figures (`0,72`, `0,67`).
- Zero comparatives are printed as plain `0` (e.g. "Aktiver bestemt for salg 22.336 0"), not blank.
- The example report is presented as **"Koncernens ..."** (the Group's) statements throughout — i.e. this particular example uses the `Koncernregnskab` member of the consolidated/separate axis, not the parent-only view.

---

## 6. Mandatory elements, reporting class, type-of-report

- **IFRS-DK is scoped to a single ÅRL reporting class.** Found verbatim in the intro: "Denne version af IFRS Taksonomien Illustreret afspejler den danske taksonomi for **regnskabsklasse D** som er baseret på IFRS taksonomien ... inklusiv Common practice udvidelser." I.e. the whole IFRS-DK taxonomy exists only for regnskabsklasse D filers (roughly: listed/large companies applying full IFRS) — class is not a variable tag inside the taxonomy, it's baked into which taxonomy is used.
- **ÅRL, by contrast, carries reporting class as an explicit element**: found in the ÅRL file, **"Information om virksomhedens regnskabsklasse"** (text), referenced to **Årsregnskabsloven §53(1)**, plus a further "regnskabsklasse" element referenced to **§7** and Erhvervsstyrelsen §12(2) — i.e. one ÅRL taxonomy spans multiple classes (B/C/D) and the filer declares which class applies via this element. This is a structural asymmetry a converter must account for (see §7).
- **Type-of-report element**: found in the IFRS-DK "Indsendelsesoplysninger" section — **"Informationen om den indsendte rapports type"** ("Information on the type of the submitted report") sits right after the `Koncernregnskab`/`Årsregnskab` common table, alongside "Indsendende virksomheds CVR-nr.," "Regnskabsperiodens start-/slutdato," "Dato for godkendelse af årsrapporten." No explicit enumerated value list (e.g. "Årsrapport"/"Delårsrapport") was recoverable from the text — only the element's existence and position.
- **Mandatory vs optional elements**: neither guide's prose states which elements are mandatory ("obligatorisk") vs optional in general terms — the one place the word "obligatorisk" appears is inside an element label itself ("...som obligatorisk måles til dagsværdi...", an IFRS 9 classification concept, not a taxonomy-mandatory flag). **Explicitly not covered**: no general statement of "these N elements are mandatory for every filer" was found in either file.

---

## 7. Differences a converter from IFRS-DK to ÅRL must handle

Concrete, text-grounded differences (not general IFRS/ÅRL GAAP knowledge — each bullet ties back to what's actually printed in the two guides):

1. **Different consolidated/separate dimension vocabulary.** IFRS-DK: `Koncernregnskaber og årsregnskaber axis` / `Koncernregnskab member` / `Årsregnskab member` (grounded in IAS 27.4). ÅRL: `Konsolideret/Ikke konsolideret axis` / `Konsolideret member` / `Ikke konsolideret member` (no IAS citation, Danish administrative practice). A converter must map member-to-member, not assume shared names.
2. **IFRS-DK offers parallel statement *presentations* that ÅRL does not mirror one-for-one**: two full income statements (by function *and* by nature) and two full balance-sheet orderings (classified *and* liquidity-order) exist side by side in IFRS-DK as alternative, complete statements: a converter must pick one IFRS-DK presentation as the mapping source (by-function is closest to ÅRL's "Skema 5"-style cost grouping seen in the ÅRL income-statement excerpt) and ignore/discard the other, rather than trying to reconcile both into ÅRL's single schedule.
3. **Different vocabulary for the same group-company concept**: IFRS-DK uses "dattervirksomheder"/"datterselskaber" (subsidiaries) as the operative term throughout balance sheet, income statement and cash flow; ÅRL uses the broader legal term **"tilknyttede virksomheder"** for the equivalent group-company lines (investments, receivables, payables). A converter matching on label text alone (rather than semantic mapping) will miss this pairing.
4. **Deferred tax is modelled differently.** IFRS-DK carries **"Udskudte skatteforpligtelser"** as its own line under a "Langfristede aktuelle skatteforpligtelser" grouping, separate from the provisions ("Hensatte forpligtelser") block (IAS 12.81(g)(i)). ÅRL instead nests it *inside* provisions: **"Hensættelser til udskudt skat"** X instant, printed directly alongside "Hensættelser til pensioner og lignende forpligtelser" and "Andre hensatte forpligtelser" under the single **"Hensatte forpligtelser"** total (ÅRL §47(1)). A converter must re-bucket IFRS-DK's separate deferred-tax liability into ÅRL's provisions total (or vice versa) rather than assuming a 1:1 line.
5. **Reference/traceability model differs.** Every IFRS-DK line carries IAS/IFRS paragraph + eIFRS URL references only. Every ÅRL line instead carries **Årsregnskabsloven paragraph + "Bilag 2, Skema n" + often a Skat (tax return) felt-nr. + a Danmarks Statistik (DST) code** (e.g. "DST 34 GRBY" for Grunde og bygninger, "Skat feltnr. 120" for Varebeholdning). IFRS-DK elements carry **no** DST/Skat cross-references anywhere in the recovered text (0 hits) — meaning ÅRL facts are pre-wired to Danish tax/statistics reporting and IFRS-DK facts are not; a converter cannot inherit DST/Skat field mappings from an IFRS-DK source fact, it must derive them independently via the ÅRL target concept.
6. **Equity componentisation is structured differently.** IFRS-DK models equity reserves mostly as **distinct elements** (Andre reserver → Reserve for valutakursregulering, Reserver for sikringstransaktioner, Reserve for aktuarmæssige gevinster/tab, Reserve for værdipapirer disponible for salg, each with its own concept). ÅRL instead models most equity components as **members of one dimension**, `Typer af egenkapital axis` (members: "Registreret kapital mv.," "Overkurs ved emission," "Reserve for opskrivninger," "Reserve for nettoopskrivning efter indre værdis metode," "Reserve for egne kapitalandele," "Reserve for udlån og sikkerhedsstillelse," "Øvrige lovpligtige reserver," "Vedtægtsmæssige reserver," "Reserve for biologiske aktiver," "Øvrige reserver," "Overført resultat," "Foreslået udbytte indregnet under egenkapitalen," etc.), applied against just two base concepts (**"Egenkapital, primo"** / **"Egenkapital, ultimo"**, ÅRL §19(1)/§25/§56(2)(1)/§52(2)(4)/§87a). A converter must turn IFRS-DK's per-concept reserve breakdown into ÅRL's per-member breakdown of a single roll-forward concept.
7. **Share capital terminology**: IFRS-DK "Aktiekapital/anpartskapital/fondskapital" vs ÅRL **"Registreret kapital mv."** — different label, same economic line; many ÅRL equity/reserve members are marked "Erhvervs- og Selskabsstyrelsen Praksis" (practice-based, no statutory §) the same way IFRS-DK's "Investeringer i porteføljevirksomheder" and the nøgletal ratios are marked "Erhvervs- og Selskabsstyrelsen Praksis" rather than an IAS/IFRS §-reference — both taxonomies have a visible "extension/common-practice" layer identifiable by the *absence* of a standard/law paragraph citation, which is the most reliable textual signal (in this recovered format) for "not core ifrs-full" / "not core §-mandated ÅRL."
8. **Reporting-class handling is inverted.** IFRS-DK *is* the regnskabsklasse-D taxonomy (class is fixed by taxonomy choice, no in-instance class tag found). ÅRL is one taxonomy spanning classes, with class asserted via its own **"Information om virksomhedens regnskabsklasse"** element (§53(1)). A converter mapping IFRS-DK facts into the ÅRL structure must independently set/derive the ÅRL regnskabsklasse element (IFRS-DK filers are, by construction, class D) — this is not something to copy from a source fact, since IFRS-DK has no analogous element to copy from.
9. **Statement inventory mismatch.** IFRS-DK includes statement types with seemingly no ÅRL counterpart at all in the recovered text: a formal IAS 33 EPS section (dimensioned by share class) and the IAS 26 "net assets available for benefits" statement. Neither "Indtjening pr. aktie" nor an IAS-26-style pension-fund statement was found anywhere in the ÅRL file (not grepped for directly beyond general scan, but no such heading turned up in the sections read). A converter should treat these as IFRS-DK-only outputs with no ÅRL target field, rather than force-mapping them.
10. **DST/Danmarks Statistik wiring exists only on the ÅRL side.** The ÅRL "Indsendelsesoplysninger" table includes a dedicated `DST` common table with an opt-in flag ("Tilbagemelding DST," "Ønsker gratis statistik DST TBM") and named statistics-contact elements (DST KNAVN/KEPOST/KTLF/KLTLF). No equivalent was found in IFRS-DK's submission block — confirming IFRS-DK filings are not, per this taxonomy, wired to the DST free-statistics-feedback mechanism the way ÅRL filings are.

---

## What was explicitly *not* found / not covered in the recovered text

- The `[nnn.nn]` bracketed section-numbering values themselves (§1).
- A "before tax" OCI statement heading verbatim (only inferred from the "after tax" heading's wording) (§2).
- A dedicated subsidiary/associate master-data note (names, CVR, domicile, ownership %) in either taxonomy (§4).
- Any discussion of XBRL units, the `decimals` attribute, or scaling factors in the guides' own prose (§5) — only recoverable from the separate example report's "t.kr." column headers.
- A general statement of which elements are mandatory for every filer (§6).
- Any namespace-prefixed QName (`ifrs-full:`, `ifrs-dk:`, `fsa:`) anywhere in either recovered file (stated up front, applies throughout).
