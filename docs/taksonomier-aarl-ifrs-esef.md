# Taksonomier for danske årsrapporter: ÅRL, IFRS-DK og ESEF

Referencedokument for IFRS/ESEF-støtten i `/api/annual-reports`. Skrevet 30. september 2026 på baggrund af implementeringsvejledningerne, taksonomipakkerne og indsendelsesbekendtgørelsen. Hvor et udsagn bygger på egne målinger i registret i stedet for dokumentation, står det udtrykkeligt.

Detaljerede læsenotater pr. kilde ligger i [research/](research/).

## 1. Kilder og deres status

| Kilde | Version | Læst | Bemærkning |
| --- | --- | --- | --- |
| Indsendelsesbekendtgørelsen, BEK nr. 859 af 18/06/2025 | i kraft 1. juli 2025 | ja, §§ 14–23 og 35 | retsinformation.dk |
| Erhvervsstyrelsen: Teknisk vejledning, indberetning med ESEF-taksonomien | v1.1, 18. marts 2021 | ja, hele | kun via Internet Archive; erhvervsstyrelsen.dk afviser automatiske kald |
| Erhvervsstyrelsen: Taksonomier, aktuelle | 14. juli 2025 | ja | via Internet Archive |
| Erhvervsstyrelsen: Kontroller af tekniske regler | v2.0, marts 2022 | ja, hele | 64 sider |
| Erhvervsstyrelsen: Kontroller af forretningsregler | v2.1, marts 2022 | ja, hele | 153 sider, omfatter ÅRL og IFRS-DK, ikke ESEF |
| Erhvervsstyrelsen: Kontroller af fremskudte forretningsregler (formulas) | v1.0, marts 2023 | ja | 7 regler, alle advis |
| Erhvervsstyrelsen: XBRL Taxonomy Framework Architecture | v1.0, 1. okt. 2015 og udkast 0.9, 2012 | ja, begge | engelsk |
| Erhvervsstyrelsen: Vejledning om udvidelse af den danske IFRS-taksonomi | 2014 | ja | 6 sider |
| Erhvervsstyrelsen: Oversigt og vejledning til revisorer, IFRS-taksonomien illustreret | 2013-12-20 | delvist | kun genskabt fra afskåret arkivkopi |
| Erhvervsstyrelsen: Oversigt og vejledning til revisorer, ÅRL-taksonomien illustreret | 2014 | delvist | samme |
| Erhvervsstyrelsen: Eksempelregnskab med ESEF (Det gode aktieselskab) | 2020 | ja, hele | iXBRL plus udvidelsespakke |
| ESMA: ESEF Reporting Manual, ESMA32-60-254 | opdateret okt. 2025 | ja, hele | 59 sider |
| ESMA: ESEF XBRL Taxonomy Documentation | 2019 og 2024 | ja, begge | |
| ESMA: ESEF validation rules | 2022 | ja | regneark |
| Taksonomipakker: ÅRL 2025-10-01, IFRS-DK 2013–2022, ESEF 2022/2024/2025 | | ja, inspiceret | Yeti (CoreFiling) og ESMA |

Ikke tilgængelige: Erhvervsstyrelsens arkitekturdokument for IFRS-DK (2014), siden "Om IFRS taksonomien" og RTS-forordningens bilag II i tekstform. De to første er døde links; arkivkopierne er afskåret ved 1 MB.

## 2. Retsgrundlag og hvem der bruger hvad

Indsendelsesbekendtgørelsen fra juni 2025 gælder for indberetninger fra 1. juli 2025 (§ 35). De afgørende bestemmelser:

- **§ 17, stk. 2.** Regnskab Special kræver XBRL 2.1 og Inline XBRL 1.1 i en taksonomi fastsat af styrelsen. Inline XBRL-filen omdannes af Regnskab Special til en eller flere XBRL-filer, som indberettes sammen med Inline XBRL-filen. Det er forklaringen på, at hver indberetning i registret har både xhtml og xml.
- **§ 17, stk. 3.** Virksomheder, der udarbejder årsregnskab og/eller koncernregnskab efter IFRS, skal indberette én Inline XBRL-fil, som både anvender ÅRL-taksonomien og ESEF-taksonomien. Det gælder alle IFRS-aflæggere, ikke kun børsnoterede.
- **§ 20.** IFRS-aflæggere kan nøjes med at opmærke revisorerklæring, totalindkomstopgørelse med resultatopgørelse, balance, pengestrømsopgørelse og en række redegørelser.
- **§ 21.** Virksomheder med koncernregnskab efter IFRS er fritaget for at indberette moderselskabets årsregnskab i den strukturerede del. Moderselskabets regnskab skal kun være med i den læsbare del.
- **§ 23.** Manglende poster i taksonomien løses ved at bruge en bredere post eller, når IFRS kræver det, ved en udvidelse af taksonomien.

Erhvervsstyrelsens side "Taksonomier, aktuelle" siger det direkte: "IFRS taksonomien er blevet udfaset, da Indsendelsesbekendtgørelsen BEK nr 859 af 18/06/2025 kræver at IFRS regnskaber skal indberettes med ÅRL-taksonomien plus ESEF taksonomien." Samme side: kravet om Inline XBRL for alle årsrapporter gælder fra balancedato 1. januar 2025.

Konsekvens for API'et:

| Periode | IFRS-aflæggere indberetter | Hvor tallene ligger |
| --- | --- | --- |
| Regnskabsår 2013–2019 | IFRS-DK i almindelig XBRL, evt. med selskabsudvidelse | AARSRAPPORT-xml |
| Regnskabsår 2020–2024 | Børsnoterede: ESEF plus ÅRL-stub. Øvrige: IFRS-DK (udfases) | AARSRAPPORT_ESEF-xml, henholdsvis AARSRAPPORT-xml |
| Indberettet efter 1. juli 2025 | Alle: ESEF plus ÅRL-stub | AARSRAPPORT_ESEF-xml |

IFRS-DK er altså et historisk spor, der skal understøttes for gamle år. ESEF er det fremadrettede spor for alle IFRS-aflæggere. Finansielle virksomheder under Finanstilsynet afleverer fortsat PDF og er uden for rækkevidde.

## 3. Hvad en indberetning består af

Erhvervsstyrelsens ESEF-vejledning fastlægger arbejdsdelingen mellem de to taksonomier i én Inline XBRL-fil:

| ESEF-taksonomien | ÅRL-taksonomien via det særlige indgangspunkt |
| --- | --- |
| Primære finansielle opgørelser: resultatopgørelse, anden totalindkomst, balance, pengestrømsopgørelse | Generelle oplysninger: CVR-nr., regnskabsperiode, navn, adresse |
| | Tekstelementer: revisorerklæring, redegørelser, ledelsesberetning |

Vejledningens pkt. 33: elementer fra ÅRL-taksonomien skal have `target="DKGAAP"`. Regnskab Special splitter derefter Inline XBRL-filen i to XBRL-filer efter target. Det er verificeret på styrelsens eget eksempelregnskab og på Vestas 2024:

- **AARSRAPPORT, application/xml.** Target DKGAAP. schemaRef til `entryDanishGAAPExcludingBalanceSheetIncomeStatementIncludingManagementsReview<ÅÅÅÅ>1001.xsd`. Indeholder gsd, arr, mrv, sob, esg og en håndfuld fsa-begreber via `fsa/8EE_pre.xml` (antal ansatte, regnskabsklasse, tekster om regnskabspraksis). Ingen balance- eller resultattal.
- **AARSRAPPORT_ESEF, application/xml.** Standardtarget. schemaRef til selskabets egen udvidelse, fx `xbrl.vestas.com/2024-12-31/VWS-2024-12-31.xsd`. Almindelig `xbrli:xbrl` med alle ifrs-full-tal. Ingen gsd-begreber, så regnskabsperioden må hentes fra registrets indeks eller fra stubben.
- **AARSRAPPORT, application/xhtml+xml.** Selve Inline XBRL-filen med begge schemaRefs. Op til 75 MB. Unødvendig, når de to xml-filer findes.
- **ESEF_EXTENSION, application/zip.** Selskabets udvidelsespakke efter styrelsens struktur (pkt. 1–29 i vejledningen). Indgangspunktet må kun importere `esef_cor.xsd`.

Målt i registret (30. september 2026): 2.199 indberetninger fra 679 selskaber har AARSRAPPORT_ESEF; 4.707 indberetninger fra 737 selskaber har en IFRS_EXTENSION-pakke fra IFRS-DK-tiden.

## 4. De tre taksonomiers arkitektur

### ÅRL (DKGAAP)

- **Namespaces er udaterede**: `http://xbrl.dcca.dk/fsa`, `/gsd`, `/arr`, `/mrv`, `/sob`, `/cmn`, `/dst`, `/tax`. Arkitekturdokumentet § 13: version findes ikke i namespaces. Versionen aflæses kun af indgangspunktets filnavn (`…20251001.xsd`) eller processing instruction `taxonomy-version`.
- **Indgangspunktets navn koder opstillingen**: kontoform/beretningsform/kontoform opdelt på kort- og langfristet, arts-/funktionsopdelt resultatopgørelse. Dertil `ExcludingBalanceSheetIncomeStatement…` til IFRS-aflæggere og `entryDKGAAPRequiredInformation` til den supplerende omsætningsindberetning. Siden 2025-pakken er også Finanstilsynets (`entryDFSA…`) og undervisningsministeriets (`entryUVM…`) indgangspunkter i samme pakke.
- **Ikke udvidelig**: instanser må ikke indeholde udvidelsesbegreber (arkitektur § 12). Teknisk regel TH10: præcis én schemaRef.
- **Alle monetære begreber har `xbrli:balance`** (arkitektur 2015 § 14.4). Der findes ingen calculation-linkbase og ingen formel-linkbase med totaler.
- 1.217 begreber, heraf 1.074 i fsa (2015-tal).

### IFRS-DK

- Bygger på IFRS Foundations ifrs-full 2014-03-05 for alle versioner 2014–2022; 2013-versionen på IFRS 2011. Kernen `ifrs-dk-cor_<dato>.xsd` i namespace `http://xbrl.dcca.dk/ifrs-dk-cor_<dato>` med 227 danske tilføjelser, fx `CurrentReceivablesFromSubsidaries` (stavefejlen er taksonomiens), `NonCurrentPayablesToSubsidiariesAndShareholdersAndManagement`, `LoansToSubsidiaries`, `GainsLossesFromSubsidiariesJointVenturesAndAssociates`, `NetSales`, `GrossResult`, `ExternalExpenses`.
- Genbruger ÅRL-modulerne gsd, arr, mrv, sob og cmn til stamdata, erklæringer og beretning.
- 16 indgangspunkter pr. version, nummereret 01–16 efter artsopdelt/funktionsopdelt, kort-/langfristet eller likviditetsorden, anden totalindkomst før/efter skat og indirekte (01–08) eller direkte (09–16) pengestrømsopgørelse. Versioner: 2013, 2014, 2016, 2017, 2019, 2020, 2021 og 2022 (alle 20. december).
- Udvidelser tilladt efter styrelsens vejledning fra 2014: fire bogstavers præfiks, seks faste filer, må kun tilføje "facts" og "abstracts", aldrig fjerne eller flytte eksisterende felter (regel 16). Udvidelsens indgangspunkt importerer ét af de 16 nummererede.
- Danske labels findes i pakkerne (`lab_ifrs-dk-da_<dato>.xml`), og ifrs-full-kernen har `xbrli:balance` på 1.556 af 3.896 elementer.

### ESEF

- **Namespaces er daterede**: `https://www.esma.europa.eu/taxonomy/<dato>/esef_cor`. Versioner 2017-03-31, 2019-03-27, 2020-03-16, 2021-03-24, 2022-03-24, 2024-03-27 og 2025-03-27 (IFRS 18, ny indgang). Ingen 2023-version.
- To indgangspunkter: `esef_cor.xsd`, som udstederens udvidelse importerer, og `esef_all.xsd` med alle linkbases til gennemsyn. 2025-pakken har kun `esef_cor.xsd`.
- ESMA-pakkerne indeholder ikke ifrs-full. De importerer `https://xbrl.ifrs.org/taxonomy/<dato>/full_ifrs/full_ifrs-cor_<dato>.xsd`, som kan hentes direkte. Dertil LEI-taksonomien og `technical.xsd`.
- Udvidelser er obligatoriske i praksis, og hver årsrapport har sin egen taksonomi. Udvidelser til de primære opgørelser skal forankres til kernebegreber via arcrole `wider-narrower` (Reporting Manual 1.4.1), undtagen subtotaler. Man må ikke lave en udvidelse, der duplikerer et kernebegreb (1.4.1). Derfor er totaler som `Assets`, `Equity`, `Liabilities` og `ProfitLoss` i praksis altid ifrs-full-begreber.
- Rollen `[000000] Tags that must be applied if corresponding information is present` i `esef_all-pre.xml` er den maskinlæsbare udgave af bilag II. I 2024-pakken indeholder den 457 elementer, herunder `NameOfReportingEntityOrOtherMeansOfIdentification`, `DomicileOfEntity`, `LegalFormOfEntity`, `CountryOfIncorporation`, `AddressOfRegisteredOfficeOfEntity`, `PrincipalPlaceOfBusiness`, `NameOfParentEntity` og `NameOfUltimateParentOfGroup`. Balancens og resultatopgørelsens totaler står ikke på listen; de er omfattet af det generelle krav om at opmærke alle tal i de primære opgørelser.
- Version pr. regnskabsår er fastsat i RTS'en, ikke i manualen. Målt i registret: regnskabsår 2020 bruger 2019-03-27, 2021 bruger 2020-03-16, 2022 bruger 2021-03-24, 2023 og 2024 bruger 2022-03-24, 2025 bruger 2024-03-27.

## 5. Kontekster og dimensioner

Dette er det punkt, hvor de tre taksonomier adskiller sig mest, og hvor en læser tager fejl, hvis den antager ÅRL-konventionen overalt.

### Solo og koncern

| | ÅRL | IFRS-DK og ESEF |
| --- | --- | --- |
| Dimension | `cmn:ConsolidatedSoloDimension` | `ifrs-full:ConsolidatedAndSeparateFinancialStatementsAxis` |
| Medlemmer | `cmn:ConsolidatedMember`, `cmn:SoloMember` | `ifrs-full:ConsolidatedMember`, `ifrs-full:SeparateMember` |
| Standardmedlem (må ikke angives eksplicit) | `SoloMember` | `ConsolidatedMember` |
| Et tal uden dimension er | moderselskabets | koncernens |

Standardmedlemmerne er aflæst i pakkerne: ÅRL 2025 (dimension-default-arc til `SoloMember` i definitions-linkbaserne, fx `mrv/221mrv_def.xml`) og ifrs-full 2014 `dim_full_ifrs_2014-03-05_role-990000.xml` (til `ConsolidatedMember`). ESEF importerer ifrs-full og ændrer ikke standardmedlemmer (Reporting Manual 3.4.3).

Moderselskabstal i IFRS-indberetninger er frivillige. RTS'en kræver kun opmærkning af koncernregnskabet (Reporting Manual 4.1.1), bekendtgørelsens § 21 fritager moderselskabet, og Erhvervsstyrelsens ESEF-vejledning pkt. 30 anbefaler blot, at udstedere, der medtager moderselskabstal, udvider dimensionen med `ifrs-full:SeparateMember` under `ConsolidatedMember`. Styrelsens eksempelregnskab gør præcis det: `c7` uden dimension er koncern, `c7_solo` med `SeparateMember` er moder. Målt i registret har 21 af 47 IFRS-DK-instanser og 19 af 70 ESEF-instanser moderselskabstal. I 67 af 70 ESEF-tilfælde er ÅRL-stubben tom for tal, og xhtml-filen indeholder ingen `SeparateMember`, så tallene findes ikke andre steder.

Ét selskab i stikprøven (SimCorp 2024) aflægger moderselskabet efter ÅRL i en fuld ÅRL-fil og koncernen i ESEF-filen. Det er lovligt og skal kunne flettes til én rapport.

### Kontekstregler

- **Enhedsidentifikation.** ÅRL: scheme `http://www.dcca.dk/cvr` (teknisk regel TR02), Grønland `http://www.dcca.dk/glregnr`. ESEF: LEI med scheme `http://standards.iso.org/iso/17442` (Reporting Manual 2.1.1). Styrelsen accepterer begge i ÅRL-stubben (TR14). Alle kontekster i én fil har samme identifikation (TR09, con_IdentifierValueMustBeIdentical).
- **Dimensioner ligger altid i `xbrli:scenario`**, aldrig `xbrli:segment` (TH15, Reporting Manual 2.1.3). Alle ÅRL-hypercubes er lukkede.
- **Datoer** er `yyyy-mm-dd` uden tid (TH07, TR13). Primoinstanter i ESEF dateres 31. december året før, ikke 1. januar (Reporting Manual 2.1.2).
- **Tekst- og datofelter** i ÅRL får hele regnskabsperioden som kontekst, også godkendelsesdatoen (arkitektur § 6.2.1).
- **Flydende regnskabsår.** Siden ÅRL 2019 kan `gsd:ReportingPeriodStartDate` og `EndDate` forekomme to gange: uden dimension (den regnskabsmæssige periode) og med `TypeOfReportingPeriodDimension = RegisteredReportingPeriodDeviatingFromReportedReportingPeriodDueArbitraryDatesMember` (den i CVR registrerede periode). Kun den første må bruges til kontekster (TR05/TR06). Vores udtræk tager i dag første forekomst uden at se på dimensionen; det bør rettes uafhængigt af IFRS-arbejdet.
- **Afrundingsdimension.** ÅRL 2024 tilføjede `ReportedValueOtherRenderingOfReportedValueDimension` til alle finansielle afsnit, så samme post kan opgives med to afrundinger. Styrelsen kontrollerer, at tal uden dimensionen er entydige. Læseren skal foretrække tal uden dimension.
- **Typede dimensioner** bruges i ÅRL til nærtstående parter (`fsa:IdentificationOfRelatedEntityDimension`), ledelsesmedlemmer, revisorer og pengestrømskomponenter. ESMA fraråder typede dimensioner i udvidelser (3.2.3).
- **Dubletter.** ESEF tillader konsistente dubletter med forskellig præcision (2.2.4), og formel-linkbasen viser, at samme økonomiske tal ofte er opmærket både som eget begreb og som generelt begreb plus dimensionsmedlem. Læseren skal dedublere på begreb, kontekst og enhed og tage den højeste `decimals`.

## 6. Enheder, decimaler og fortegn

- **Skala er pr. fakta** i alle tre taksonomier. "I tusinder" er ikke et flag, men udtrykkes ved `decimals="-3"`. Ingen af taksonomierne bruger skalerede enheder; enheden er altid en ISO 4217-kode (arkitektur § 14.3, Reporting Manual 1.7.1).
- ESEF kræver `decimals` og forbyder `precision` (2.2.1). I den afledte xml-fil er `scale` allerede indregnet i værdien.
- **Fortegn.** Omkostninger indberettes positivt i XBRL-filen (forretningsregel FR71), og både ÅRL og ifrs-full bærer `xbrli:balance`, så retning følger begrebets naturlige saldo. Enkelte begreber uden balance kan være både positive og negative, fx nettopengestrømme. Regnskab Basis vender fortegnet på omkostninger ved indtastning, hvilket forklarer negative omkostninger i nogle ÅRL-filer.
- Streger og tomme celler opmærkes typisk som `0` i ESEF (2.2.5). Nul er derfor ikke det samme som "ikke oplyst".
- Procenter i ESEF er decimalbrøker med enhed `pure` (2.2.2).

## 7. Hvilke kontroller garanterer struktur

Det er vigtigt, fordi det afgør, hvad API'ets egen validering kan antage.

- **Erhvervsstyrelsens forretningsregler dækker ÅRL og IFRS-DK, ikke ESEF.** Område B med kravene om, at resultat, egenkapital og balance er udfyldt, gælder udtrykkeligt kun ÅRL. Kun FR21–FR23 (aktiver = passiver, begge ikke-negative, alle FEJL) er formuleret taksonomineutralt og gælder sandsynligvis også IFRS-DK. Kontrollen ser kun på tal uden dimension eller med koncerndimensionen, og sammenligningen sker pr. valuta og pr. solo/koncern.
- **Formel-linkbasen** fra 2023 har syv regler, alle advis, ingen om totaler. ÅRL har ingen calculation-linkbase.
- **ESEF** har en calculation-linkbase (`esef_all-cal.xml`) og 443 IFRS-afledte formelkontroller, men de fleste er advarsler for at undgå automatisk afvisning (taksonomidokumentation 3.4.6).

Konklusion: intet af det nuværende valideringsregister kan slækkes, og reglerne må gates på standard. Aktiver = passiver kan antages for ÅRL. For IFRS skal balancen kontrolleres, ikke antages.

## 8. Begreber til mapningen

### Balance og resultat

ifrs-full-begreber, der fandtes i samtlige 16 målte IFRS-instanser fra 2019–2025: `Assets`, `NoncurrentAssets`, `CurrentAssets`, `Inventories`, `CurrentTradeReceivables`, `Equity`, `EquityAndLiabilities`, `NoncurrentLiabilities`, `CurrentLiabilities`, `TradeAndOtherCurrentPayablesToTradeSuppliers`, `ProfitLoss`, `ProfitLossBeforeTax`, `IncomeTaxExpenseContinuingOperations`, `ComprehensiveIncome` og de tre pengestrømstotaler. I 14–15 af 16: `Revenue`, `Liabilities`, `CashAndCashEquivalents`, `PropertyPlantAndEquipment`, `IntangibleAssetsAndGoodwill`, `DeferredTaxAssets`, `DeferredTaxLiabilities`, `FinanceIncome`, `FinanceCosts`. `GrossProfit` og `CostOfSales` findes kun i funktionsopdelte opgørelser (10–12 af 16).

Kapitalandele, som passiv-testen har brug for, findes i ifrs-full 2014 og frem: `InvestmentsInSubsidiaries` (kun i separate regnskaber), `InvestmentsInAssociates`, `InvestmentsInJointVentures`, `InvestmentsInSubsidiariesJointVenturesAndAssociates`, `InvestmentAccountedForUsingEquityMethod`, `NoncurrentInvestmentsOtherThanInvestmentsAccountedForUsingEquityMethod`, `OtherNoncurrentFinancialAssets`, `OtherCurrentFinancialAssets`, `CurrentInvestments`, `NoncurrentReceivablesDueFromRelatedParties`, `NoncurrentPayablesToRelatedParties`. IFRS-DK tilføjer de danske tilgodehavender og gæld til tilknyttede virksomheder nævnt i afsnit 4.

### Koncernstruktur i noter

| | ÅRL (fsa) | IFRS (ifrs-full) |
| --- | --- | --- |
| Dimension | `IdentificationOfRelatedEntityDimension` (typet), `TypeOfRelatedEntityDimension` | `SubsidiariesMember` under en subsidiaries-akse, `JointVenturesAxis` |
| Navn | `RelatedEntityName` | `NameOfSubsidiary`, `NameOfAssociate`, `NameOfJointVenture` |
| Identifikation | `IdentificationNumberCvrOfRelatedEntity`, P-nr., LEI | ingen CVR; `CountryOfIncorporationOrResidenceOfSubsidiary`, `PrincipalPlaceOfBusinessOfSubsidiary` |
| Ejerandel | `ShareHeldByEntityOrConsolidatedEnterprisesInRelatedEntity` | `ProportionOfOwnershipInterestInSubsidiary`, `…InAssociate`, `…InJointVenture` |
| Moder | | `NameOfParentEntity`, `NameOfUltimateParentOfGroup` (obligatoriske i ESEF) |

Ingen af Erhvervsstyrelsens kontroller vedrører nærtstående parter, så ejerandele er aldrig valideret ved indsendelsen.

### Hvad revisorvejledningerne tilføjer

De to udgaver af "Taksonomien Illustreret" viser labels, formater og lovhenvisninger, ikke QNames. Det, de tilføjer ud over pakkerne:

- IFRS-DK-taksonomien er skrevet til regnskabsklasse D. Regnskabsklassen er givet ved valget af taksonomi, hvor ÅRL har et eksplicit felt.
- Solo/koncern-aksen hedder i IFRS-DK "Koncernregnskaber og årsregnskaber" med medlemmerne "Koncernregnskab" og "Årsregnskab" (IAS 27.4). Linjerne "Investeringer i dattervirksomheder", "…i joint ventures" og "…i associerede virksomheder" henviser til IAS 27.38, som kun gælder separate regnskaber. De findes altså kun under moderselskabets medlem.
- IFRS-DK bruger "dattervirksomheder" og "nærtstående parter", hvor ÅRL bruger det bredere "tilknyttede virksomheder". Tilgodehavender og gæld til datterselskaber, moderselskab, joint ventures og associerede er egne linjer i IFRS-DK.
- Udskudt skat er egne linjer i IFRS-DK, men ligger under hensatte forpligtelser i ÅRL.
- Den funktionsopdelte IFRS-DK-resultatopgørelse ligger tættest på ÅRL's opstilling og er det bedste udgangspunkt for mapningen. Den artsopdelte har personaleomkostninger og afskrivninger som egne linjer og ender i samme struktur fra EBIT og ned.
- IFRS-DK har ingen DST- eller SKAT-felter; de findes kun i ÅRL.

## 9. Implementeringen (branch ifrs-esef-support, oktober 2026)

Punkterne nedenfor er gennemført sådan:

- Genkendelse: `XBRLDocument.getStandard()` i annual-report.utils.ts afgør ÅRL, IFRS-DK eller ESEF ud fra fakta-namespaces og markerer ÅRL-stubben som `generalDataOnly`.
- Mapning: annual-report.taxonomy.ifrs.ts lister IFRS-kandidater pr. ÅRL-nøgle; labels og fortegn genereres fra pakkerne af scripts/build-ifrs-concepts.ts til ifrs-concepts.json.
- Scope: samme kode læser begge dimensionsmodeller; IFRS-tal uden dimension lander under `consolidated`, `SeparateMember` på øverste niveau. Svaret har fået `standard`, `scope` og `soloStandard`.
- Samling pr. indberetning: `AnnualReportService.assembleFiling()` vælger ESEF-instansen, dropper stubben og fletter et eventuelt ÅRL-moderselskabsregnskab ind som solo-tal. Delårsrapporter og genindberetninger sorteres fra pr. regnskabsårets startdato.
- Koncernstruktur: ifrs-full's NameOfSubsidiary med ejerandel læses til `groupEntitiesFromNotes`.
- Validering: ÅRL-specifikke kontroller (BAL-002/003/004/005, RES-001/002/003/004, XCH-002) kører kun på ÅRL-rapporter. IFRS-rapporter får BAL-001, SGN, SRC, SCL, PER, XCH-001 og RES-005.
- Målt oktober 2026 på 38 tilfældige IFRS-aflæggere (387 rapporter): aktiver = passiver i 385, status success for alle, ingen udeladte dokumenter.
- Kendt begrænsning: en IFRS-aflægger uden koncernregnskab opmærker sine egne tal uden dimension, og de kan ikke skelnes fra koncerntal i instansen. De lander derfor under `consolidated` med scope "consolidated", medmindre selskabet har brugt SeparateMember.

Den oprindelige plan fra september følger.

## 9a. Hvad dokumenterne ændrer i den planlagte implementering

1. **ESEF er hovedsporet, IFRS-DK er historik.** Fra 1. juli 2025 indberetter alle IFRS-aflæggere ESEF plus ÅRL-stub. IFRS-DK-mapningen skal dække regnskabsår 2013–2024, men får ingen nye indberetninger.
2. **Genkendelse på namespace.** IFRS = ifrs-full-namespace fra xbrl.ifrs.org til stede. IFRS-DK = tillige `ifrs-dk-cor`. ESEF = tillige `esef_cor` eller schemaRef uden for archprod. ÅRL-listen bevares.
3. **Dokumentvalg og fletning.** Pr. indberetning: AARSRAPPORT_ESEF giver koncern og eventuelt moder; AARSRAPPORT-xml giver stamdata og, hvis den ikke er en stub, moderselskabets ÅRL-tal. Én rapport pr. indberetning, sammensat af begge.
4. **Regnskabsperiode for ESEF-filer** hentes fra registrets indeks eller ÅRL-stubben, ikke fra ifrs-full. Samtidig skal stubbens `gsd:ReportingPeriodStartDate` læses uden `TypeOfReportingPeriodDimension`.
5. **Scope vendes for IFRS.** Uden dimension = koncern, `SeparateMember` = solo. Svaret får `standard` og `scope`, og rapporter uden moderselskabstal markeres, i stedet for at de øverste opgørelser fyldes med koncerntal.
6. **Dedublering** på begreb, kontekst og enhed med højeste `decimals`, og bortfiltrering af alle dimensioner ud over solo/koncern, når statements bygges. Det gælder også ÅRL's nye afrundingsdimension.
7. **Fortegn og labels genereres** fra pakkerne: `xbrli:balance` fra ifrs-full-kernen og danske labels fra IFRS-DK- og ESEF-pakkerne.
8. **Validering gates på standard.** Aktiver = passiver forbliver en kontrol, ikke en antagelse, for IFRS.
9. **Udvidelsesbegreber ignoreres** i første omgang. Forankringsreglen betyder, at totalerne er kernebegreber. En senere udbygning kan følge `wider-narrower`-arcs i udvidelsens definitions-linkbase for at genfinde aggregater.

## 10. Kendte huller

- RTS-bilag II i tekstform og tabellen over taksonomiversion pr. regnskabsår. Erstattet af den maskinlæsbare rolle i `esef_all-pre.xml` og af målinger i registret.
- Arkitekturdokumentet for IFRS-DK 2014 og styrelsens side om IFRS-taksonomien er utilgængelige. Struktur og standardmedlemmer er i stedet aflæst direkte i pakkerne.
- Revisorvejledningerne til IFRS-DK og ÅRL er kun genskabt delvist fra en afskåret arkivkopi. Se læsenotatet for, hvad der kunne udledes.
