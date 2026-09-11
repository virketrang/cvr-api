Attribute VB_Name = "SettingsPayload"
Option Explicit

' Serializes the Settings-sheet configuration into the `settings` object the
' server's POST /api/project-resolutions endpoint expects. The Settings sheet
' remains the source of truth for taxonomy tables, thresholds and lookups —
' the server just computes with whatever this sends.

Public Function Build() As Object
    On Error GoTo ErrorHandler
    Stack.Push "SettingsPayload.Build"

    Dim s As Object: Set s = CreateObject("Scripting.Dictionary")

    s.Add "corporateTaxRate", Settings.CorporateTaxRate
    s.Add "minVotingRights", Settings.MinVotingRights
    s.Add "minIndirectOwnership", Settings.MinIndirectOwnership
    s.Add "maximumNumberOfCompanies", Settings.MaximumNumberOfCompanies
    s.Add "maxPassiveAssetTestCompanies", Settings.MaxPassiveAssetTestCompanies

    Dim modes As Object: Set modes = CreateObject("Scripting.Dictionary")
    modes.Add "noCalculation", Settings.GetNoCalculationValue
    modes.Add "dateOfTransfer", Settings.GetDateOfTransferValue
    modes.Add "oneYear", Settings.Get1YearValue
    modes.Add "twoYear", Settings.Get2YearValue
    modes.Add "threeYear", Settings.Get3YearValue
    s.Add "successionModes", modes

    Dim lookups As Object: Set lookups = CreateObject("Scripting.Dictionary")
    lookups.Add "oneYear", RangeToNumbers(Settings.ReportingPeriods1Year)
    lookups.Add "twoYear", RangeToNumbers(Settings.ReportingPeriods2Year)
    lookups.Add "threeYear", RangeToNumbers(Settings.ReportingPeriods3Year)
    s.Add "reportingPeriodsLookup", lookups

    s.Add "currencies", BuildCurrencies()

    Dim formLabels As Object: Set formLabels = CreateObject("Scripting.Dictionary")
    formLabels.Add "limitedLiabilityCompany", Settings.LimitedLiabilityCompany
    formLabels.Add "soleProprietorship", Settings.SoleProprietorship
    s.Add "corporateFormLabels", formLabels

    s.Add "assetTaxonomy", BuildAssetTaxonomy()
    s.Add "financialIncomeTaxonomy", BuildFinancialIncomeTaxonomy()

    Set Build = s

CleanExit:
    Stack.Pop
    Exit Function

ErrorHandler:
    If Error.handle("SettingsPayload.Build", Err.description, Err.number, Erl) Then Resume CleanExit
End Function

Private Function RangeToNumbers(rng As Range) As Collection
    Dim result As New Collection
    Dim cell As Range
    For Each cell In rng.Columns(1).cells
        If IsNumeric(cell.value) Then result.Add CDbl(cell.value)
    Next cell
    Set RangeToNumbers = result
End Function

Private Function BuildCurrencies() As Collection
    Dim result As New Collection

    Dim codes As Variant: codes = Settings.CurrencyCodes
    Dim names As Variant: names = Settings.CurrencyNames
    Dim symbols As Variant: symbols = Settings.CurrencySymbols

    Dim i As Long
    For i = 1 To UBound(codes, 1)
        Dim code As String: code = Trim$(CStr(codes(i, 1)))
        If Len(code) > 0 Then
            Dim entry As Object: Set entry = CreateObject("Scripting.Dictionary")
            entry.Add "code", code
            entry.Add "name", Trim$(CStr(names(i, 1)))
            entry.Add "symbol", Trim$(CStr(symbols(i, 1)))
            result.Add entry
        End If
    Next i

    Set BuildCurrencies = result
End Function

Private Function BuildAssetTaxonomy() As Collection
    Dim result As New Collection

    Dim data As Variant
    data = Sheets.Settings.Range("ASSET_TAXONOMY_TREE").value

    Dim i As Long
    For i = 1 To UBound(data, 1)
        Dim concept As String: concept = Trim$(CStr(data(i, 1)))
        If Len(concept) > 0 Then
            Dim row As Object: Set row = CreateObject("Scripting.Dictionary")
            row.Add "concept", concept
            row.Add "label", Trim$(CStr(data(i, 2)))
            row.Add "parent", Trim$(CStr(data(i, 3)))
            row.Add "passiveClassification", Trim$(CStr(data(i, 4)))
            row.Add "includeInPassiveTest", (Trim$(UCase$(CStr(data(i, 5)))) = "JA")
            row.Add "passiveNote", Trim$(CStr(data(i, 6)))
            row.Add "valuationClassification", Trim$(CStr(data(i, 7)))

            Dim dist As Double: dist = 1
            If IsNumeric(data(i, 8)) Then dist = CDbl(data(i, 8))
            row.Add "distributionKey", dist

            row.Add "valuationNote", Trim$(CStr(data(i, 9)))
            result.Add row
        End If
    Next i

    Set BuildAssetTaxonomy = result
End Function

Private Function BuildFinancialIncomeTaxonomy() As Collection
    Dim result As New Collection

    Dim data As Variant
    data = Sheets.Settings.Range("FINANCIAL_INCOME_TAXONOMY").value

    Dim i As Long
    For i = 1 To UBound(data, 1)
        Dim concept As String: concept = Trim$(CStr(data(i, 1)))
        If Len(concept) > 0 Then
            Dim row As Object: Set row = CreateObject("Scripting.Dictionary")
            row.Add "concept", concept
            row.Add "label", Trim$(CStr(data(i, 2)))
            row.Add "classification", Trim$(CStr(data(i, 3)))
            row.Add "includeInPassiveTest", (Trim$(UCase$(CStr(data(i, 4)))) = "JA")
            row.Add "note", Trim$(CStr(data(i, 5)))
            result.Add row
        End If
    Next i

    Set BuildFinancialIncomeTaxonomy = result
End Function
