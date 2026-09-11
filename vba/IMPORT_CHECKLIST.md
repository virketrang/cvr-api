# VBA-importtjekliste — flytning af forretningslogik til serveren

Denne mappe indeholder de omskrevne VBA-moduler til "Konsolideret beregningsark".
Efter importen er arbejdsgangen: guiden indsamler input → **ét kald** til
`POST /api/project-resolutions` (formData + hele Indstillinger-konfigurationen) →
VBA'en renderer serverens færdigberegnede model ind i arkene. Al forretningslogik
(taksonomi, kontovalg med fallback, fortegnsopdeling, ejerandels- og
kvalifikationsregler, noter) ligger nu på serveren.

## Forudsætninger

- Serveren skal køre en version med `/api/project-resolutions` (deploy fra denne
  gren først) — ellers fejler projektoprettelse med 404.
- Ingen navngivne områder ændres; alle eksisterende named ranges genbruges.

## Trin

1. **Tag en sikkerhedskopi** af `.xlsm`-filen før du rører noget.
2. Åbn VBA-editoren (Alt+F11) og **eksportér** de moduler du erstatter, som
   ekstra backup.
3. **Fjern** disse moduler (højreklik → Remove, "No" til eksport hvis du allerede
   har backup):
   - `Taxonomy` (logikken ligger nu i serverens `taxonomy-engine.ts`)
   - `Report` (nu `account.ts` på serveren)
   - `Formula`, `Valuation`, `PassiveAssetTest`, `AppWorkbook`, `API` (erstattes)
4. **Importér** filerne fra denne mappe (File → Import File…):
   - `Formula.cls` (beholder Link/Reset/Combine; `Create` er erstattet af
     `FromComponents`, som bygger "=a+b"-formlerne af serverens komponentlister)
   - `API.cls` (ny `ResolveProject`; `GetAnnualReports` er fjernet — batch-kaldet
     sker nu server-side inde i project-resolutions)
   - `Valuation.cls` (`AutoComplete`/`Populate*` erstattet af `Render`; alle
     ark-/konsoliderings-/eksport-rutiner er uændrede)
   - `PassiveAssetTest.cls` (`AutoComplete`/`Insert*` erstattet af `Render`;
     Adjust/Reset/Export uændrede)
   - `AppWorkbook.cls` (`CreateWorkbook` er omskrevet til request → render-løkke;
     ny `RenderNote`; alle øvrige rutiner uændrede)
   - `SettingsPayload.bas` (nyt modul: serialiserer Indstillinger-arket til
     requestens `settings`-objekt)
5. **Tests.bas**: slet `test_BalanceSheetCompleteness` (findes nu som servertest
   i `taxonomy-engine.test.ts`). Tilføj evt. denne integrationstest:

   ```vb
   Public Sub test_ResolveProject_RejectsInvalidBody()
       On Error GoTo ErrorHandler
       Stack.Push "Tests.test_ResolveProject_RejectsInvalidBody()"

       ' Et tomt body skal afvises af serveren (INVALID_INPUT), ikke give 500.
       Dim response As Object
       Set response = API.ResolveProject("{}")
       Test.assertTrue response Is Nothing, "invalid body returns Nothing (server rejected it)"

   CleanExit:
       Stack.Pop
       Exit Sub
   ErrorHandler:
       If Error.handle("Tests.test_ResolveProject_RejectsInvalidBody()", Err.description, Err.number, Erl) Then Resume CleanExit
   End Sub
   ```

6. **NewProjectForm (valgfrit)**: Guiden kan sende sit hidtidige payload uændret —
   serveren ignorerer `indirectOwnership` og genberegner den selv. Kædemultipli-
   kationen i guidens JavaScript (`addExactOwnershipPercentages`) er derfor
   redundant og kan slankes ved at slette while-løkken (linjerne der bygger
   `indirectOwn` ud fra `currentParent`) og sende
   `ownershipPercentage: { directOwnership: directOwn }` i begge grene.
   Det er en ren oprydning — funktionelt ændrer det intet.
7. **Compile-tjek**: Debug → Compile VBAProject. Der må ikke være referencer til
   `Taxonomy`, `Report`, `Formula.Create`, `Valuation.AutoComplete`,
   `PassiveAssetTest.AutoComplete` eller `API.GetAnnualReports` tilbage.
8. Kør testene fra Indstillinger-formularens testkører.
9. **Røgtest**: Opret et projekt for et kendt CVR (fx en lille koncern) mod
   serveren og sammenlign arkene med en før-migrations-kopi af projektmappen.
10. **Version-bump ved cutover**: sæt `VERSION`-cellen på Indstillinger-arket og
    serverens `API_VERSION` (miljøvariabel) til samme nye version, og deploy
    serveren samtidig med at den nye projektmappe distribueres. Gamle
    projektmapper bliver ved med at virke (de gamle endpoints er uændrede) og
    får opdateringsprompten via versionstjekket.

## Bevidste adfærdsafvigelser (godkendt i migrationen)

- **Balancekomplethedstjek**: Den gamle `Taxonomy.CheckBalanceCompleteness`
  sammenlignede aktiver-i-alt mod leaf-summen via en fejlbehæftet reference, så
  netop dét deltjek aldrig kørte. Serveren udfører tjekket korrekt og returnerer
  resultatet som `warnings` (kode `BALANCE_INCOMPLETE`) — vises nu som toasts.
- **Selskaber med manglende data**: Hvor VBA'en før fejlede på selskaber med
  `null` i direkte ejerandel eller selskabsform (fejldialog + spring selskabet
  over), behandler serveren dem nu roligt: ejerandel `null` → 0 % i oversigten,
  manglende selskabsform → tom etiket.
- **Konsolideringsflueben**: Guidens "Konsolidér"-flueben blev aldrig skrevet til
  Selskabsoversigten i batch-oprettelsen (altid "NEJ"). Det er bevaret for
  paritet; guidens valg ligger i svarfeltet `consolidateRequested`, så det er
  nemt at aktivere senere.
- **Bevarede særheder**: "INDTAST VALUTAKURS"-noten for et ikke-DKK
  værdiansættelsesår lander fortsat på Successionsopgørelsens notesfelt (indekseret
  efter koncern-position), og en "GØR PLADS"-forskydning koster fortsat både
  årsplads 1 og den ældste årsrapport — begge nøjagtigt som før.
