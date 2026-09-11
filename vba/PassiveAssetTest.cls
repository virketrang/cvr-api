VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "PassiveAssetTest"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

' ============================================================================
' RENDERING (replaces AutoComplete/InsertAssets/InsertIncome). The server
' resolved the transfer-date block, the report-years and every line item and
' note; this only places them on the Successionsopgørelse sheet.
' ============================================================================

Public Sub Render(company As Object, ByVal successionPeriod As String, ByVal dateOfTransfer As String)
    On Error GoTo ErrorHandler
    Stack.Push "PassiveAssetTest.Render()"

    Sheets.PassiveAssetTest.Visible = IIf(successionPeriod <> Settings.GetNoCalculationValue, xlSheetVisible, xlSheetVeryHidden)

    If IsDate(dateOfTransfer) Then Sheets.PassiveAssetTest.Range("DATE_OF_TRANSFER").value = CDate(dateOfTransfer)

    Dim pat As Object: Set pat = company("passiveAssetTest")
    Dim companySlot As Long: companySlot = CLng(company("passiveCompanySlot"))

    Dim note As Object
    For Each note In pat("notes")
        AppWorkbook.RenderNote Sheets.PassiveAssetTest, note
    Next note

    If Not IsNull(pat("dateOfTransfer")) Then
        Dim dot As Object: Set dot = pat("dateOfTransfer")

        Sheets.PassiveAssetTest.Range("DATE_OF_TRANSFER_DATE_OF_VALUATION_" & companySlot).value = dot("dateOfValuation")

        If Not IsNull(dot("exchangeRate")) Then
            Sheets.PassiveAssetTest.Range("DATE_OF_TRANSFER_EXCHANGE_RATE_" & companySlot).value = dot("exchangeRate")
        End If

        Sheets.PassiveAssetTest.Range("DATE_OF_TRANSFER_CURRENCY_NAME_" & companySlot).value = dot("currencyName")

        WriteAccount "DATE_OF_TRANSFER_TOTAL_ASSETS_" & companySlot, dot("totalAssets")

        InsertAssetItems "DATE_OF_TRANSFER", companySlot, dot("assets")

        Sheets.PassiveAssetTest.Range("DATE_OF_TRANSFER_BOOK_VALUE_OF_SHARES_IN_SUBSIDIARIES_" & companySlot).value = _
            Formula.FromComponents(dot("bookValueOfSharesInSubsidiaries"), "+")
    End If

    Dim yr As Object
    For Each yr In pat("years")
        Dim n As String: n = CStr(CLng(yr("slot")))

        Sheets.PassiveAssetTest.Range("YEAR_" & n & "_START_DATE_" & companySlot).value = yr("startDate")
        Sheets.PassiveAssetTest.Range("YEAR_" & n & "_END_DATE_" & companySlot).value = yr("endDate")

        If Not IsNull(yr("exchangeRate")) Then
            Sheets.PassiveAssetTest.Range("YEAR_" & n & "_EXCHANGE_RATE_" & companySlot).value = yr("exchangeRate")
        End If

        Sheets.PassiveAssetTest.Range("YEAR_" & n & "_CURRENCY_NAME_" & companySlot).value = yr("currencyName")

        WriteAccount "YEAR_" & n & "_TOTAL_ASSETS_" & companySlot, yr("totalAssets")

        Sheets.PassiveAssetTest.Range("YEAR_" & n & "_REVENUE_" & companySlot).value = _
            Formula.FromComponents(yr("revenue"), "+")

        InsertAssetItems "YEAR_" & n, companySlot, yr("assets")
        InsertIncomeItems CLng(yr("slot")), companySlot, yr("income")

        Sheets.PassiveAssetTest.Range("YEAR_" & n & "_BOOK_VALUE_OF_SHARES_IN_SUBSIDIARIES_" & companySlot).value = _
            Formula.FromComponents(yr("bookValueOfSharesInSubsidiaries"), "+")
        Sheets.PassiveAssetTest.Range("YEAR_" & n & "_BOOK_VALUE_OF_INCOME_FROM_SUBSIDIARIES_" & companySlot).value = _
            Formula.FromComponents(yr("incomeFromSubsidiaries"), "+")
    Next yr

CleanExit:
    On Error Resume Next
    Stack.Pop
    Exit Sub

ErrorHandler:
    If Error.handle("PassiveAssetTest.Render()", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

' Places asset line items in the shared label/category grid: an existing label
' row is reused, otherwise the first empty row gets the label + category. Same
' row-matching the old InsertAssets used, but with server-resolved items.
Private Sub InsertAssetItems(ByVal section As String, ByVal companySlot As Long, items As Object)
    Dim nameRange As Range, catRange As Range, valRange As Range
    Set nameRange = Sheets.PassiveAssetTest.Range(section & "_ASSETS_NAMES")
    Set catRange = Sheets.PassiveAssetTest.Range(section & "_ASSETS_CATEGORIES")
    Set valRange = Sheets.PassiveAssetTest.Range(section & "_ASSETS_BOOK_VALUES_" & companySlot)

    Dim item As Object
    Dim i As Long, foundRow As Long

    For Each item In items
        foundRow = 0
        For i = 1 To nameRange.Rows.count
            If nameRange.cells(i, 1).value = item("label") Then
                foundRow = i
                Exit For
            ElseIf nameRange.cells(i, 1).value = "" Then
                nameRange.cells(i, 1).value = item("label")
                If Not IsNull(item("category")) Then catRange.cells(i, 1).value = item("category")
                foundRow = i
                Exit For
            End If
        Next i

        If foundRow > 0 Then valRange.cells(foundRow, 1).value = item("value")
    Next item
End Sub

Private Sub InsertIncomeItems(ByVal year As Long, ByVal companySlot As Long, items As Object)
    Dim nameRange As Range, valRange As Range
    Set nameRange = Sheets.PassiveAssetTest.Range("YEAR_" & year & "_INCOME_NAMES")
    Set valRange = Sheets.PassiveAssetTest.Range("YEAR_" & year & "_INCOME_BOOK_VALUES_" & companySlot)

    Dim item As Object
    Dim i As Long, foundRow As Long

    For Each item In items
        foundRow = 0
        For i = 1 To nameRange.Rows.count
            If nameRange.cells(i, 1).value = item("label") Then
                foundRow = i
                Exit For
            ElseIf nameRange.cells(i, 1).value = "" Then
                nameRange.cells(i, 1).value = item("label")
                foundRow = i
                Exit For
            End If
        Next i

        If foundRow > 0 Then valRange.cells(foundRow, 1).value = item("value")
    Next item
End Sub

Private Sub WriteAccount(ByVal rangeName As String, account As Variant)
    If IsNull(account) Or IsEmpty(account) Then Exit Sub
    Sheets.PassiveAssetTest.Range(rangeName).value = account("value")
End Sub

Public Sub AdjustSheet(numberOfCompanies As Long, ByVal successionPeriod As String)
    On Error GoTo ErrorHandler
    Stack.Push "PassiveAssetTest.AdjustSheet()"
    
    Dim maxCol As Long: maxCol = 5 + (Settings.MaxPassiveAssetTestCompanies * 6) - 1
    Dim lastVisibleCol As Long: lastVisibleCol = 5 + (numberOfCompanies * 6) - 1

    ' Un-hide the whole company band FIRST, so columns hidden by an earlier state
    ' (e.g. AdjustSuccessionColumns run mid-batch while calc was manual) are restored.
    Sheets.PassiveAssetTest.Range( _
        Sheets.PassiveAssetTest.cells(1, 5), _
        Sheets.PassiveAssetTest.cells(1, maxCol)).EntireColumn.Hidden = False

    If lastVisibleCol < maxCol Then
        Sheets.PassiveAssetTest.Range( _
            Sheets.PassiveAssetTest.cells(1, lastVisibleCol + 1), _
            Sheets.PassiveAssetTest.cells(1, maxCol)).EntireColumn.Hidden = True
    End If
    
    Select Case successionPeriod
        Case Settings.GetDateOfTransferValue
            Utilities.HideRange Sheets.PassiveAssetTest, Array( _
                "OVERVIEW_ASSET_CRITERIA_AVERAGE_CALC", "OVERVIEW_INCOME_CRITERIA_AVERAGE_CALC", _
                "OVERVIEW_2_ASSET_CRITERIA", "OVERVIEW_2_INCOME_CRITERIA", _
                "YEAR_1", "YEAR_2", "YEAR_3"), HideType.HIDE_ROWS

        Case Settings.Get1YearValue
            Utilities.HideRange Sheets.PassiveAssetTest, Array( _
                "OVERVIEW_ASSET_CRITERIA_YEAR_2", "OVERVIEW_ASSET_CRITERIA_YEAR_3", _
                "OVERVIEW_INCOME_CRITERIA_YEAR_2", "OVERVIEW_INCOME_CRITERIA_YEAR_3", _
                "OVERVIEW_2_ASSET_CRITERIA_YEAR_2", "OVERVIEW_2_ASSET_CRITERIA_YEAR_3", _
                "OVERVIEW_2_INCOME_CRITERIA_YEAR_2", "OVERVIEW_2_INCOME_CRITERIA_YEAR_3", _
                "YEAR_2", "YEAR_3"), HideType.HIDE_ROWS

        Case Settings.Get2YearValue
            Utilities.HideRange Sheets.PassiveAssetTest, Array( _
                "OVERVIEW_ASSET_CRITERIA_YEAR_3", "OVERVIEW_INCOME_CRITERIA_YEAR_3", _
                "OVERVIEW_2_ASSET_CRITERIA_YEAR_3", "OVERVIEW_2_INCOME_CRITERIA_YEAR_3", _
                "YEAR_3"), HideType.HIDE_ROWS

        Case Settings.Get3YearValue
    End Select
    
CleanExit:
    Stack.Pop
    Exit Sub

ErrorHandler:
    If Error.handle("PassiveAssetTest.AdjustSheet()", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub AdjustSuccessionColumns()
    On Error GoTo ErrorHandler
    Stack.Push "PassiveAssetTest.AdjustSuccessionColumns"

    If Settings.PassiveAssetTest = Settings.GetNoCalculationValue Then GoTo CleanExit

    Dim names As Variant:     names = CompanySheet.Range("COMPANY_NAMES").value
    Dim indirects As Variant: indirects = CompanySheet.Range("COMPANY_INDIRECT_OWNERSHIPS").value

    Dim threshold As Double: threshold = Settings.MinIndirectOwnership * 100
    Dim count As Long: count = 0
    
    Debug.Print "THRESHOLD: " & threshold

    Dim i As Long
    For i = 1 To UBound(names, 1)
        Dim nm As String: nm = Trim$(CStr(names(i, 1)))
        If Len(nm) > 0 Then
            Dim qualifies As Boolean: qualifies = (i = 1)
            If Not qualifies Then
                If IsNumeric(indirects(i, 1)) Then
                    If CDbl(indirects(i, 1)) >= threshold Then qualifies = True
                    Debug.Print indirects(i, 1)
                End If
            End If
            If qualifies Then count = count + 1
        End If
    Next i

    Debug.Print "COUNT: " & count

    Dim maxCol As Long: maxCol = 5 + (Settings.MaxPassiveAssetTestCompanies * 6) - 1
    Dim lastVisibleCol As Long: lastVisibleCol = 5 + (count * 6) - 1

    ' Un-hide the entire company band FIRST, so columns for companies 2..N that were hidden
    ' by a previous state get shown again. Then hide only the unused tail past the count.
    Sheets.PassiveAssetTest.Range( _
        Sheets.PassiveAssetTest.cells(1, 5), _
        Sheets.PassiveAssetTest.cells(1, maxCol)).EntireColumn.Hidden = False

    If lastVisibleCol < maxCol Then
        Sheets.PassiveAssetTest.Range( _
            Sheets.PassiveAssetTest.cells(1, lastVisibleCol + 1), _
            Sheets.PassiveAssetTest.cells(1, maxCol)).EntireColumn.Hidden = True
    End If

CleanExit:
    Stack.Pop
    Exit Sub
ErrorHandler:
    If Error.handle("PassiveAssetTest.AdjustSuccessionColumns", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub ResetSheet(Optional IsBatch As Boolean = False, Optional frm As Object, _
                      Optional ByVal startValue As Double = 0, Optional ByVal endValue As Double = 0)
    On Error GoTo ErrorHandler
    Stack.Push "PassiveAssetTest.ResetSheet()"

    If Not IsBatch Then AppWorkbook.ToggleOptimization False

    Dim i As Long, j As Long

    ' --- clear the shared/constant ranges once ---
    Dim constNames As Variant
    constNames = Array("DATE_OF_TRANSFER", "DOSMERSEDDEL", "DATE_OF_TRANSFER_ASSETS_NAMES", _
                       "DATE_OF_TRANSFER_ASSETS_CATEGORIES", "YEAR_1_ASSETS_NAMES", _
                       "YEAR_1_ASSETS_CATEGORIES", "YEAR_1_INCOME_NAMES", _
                       "YEAR_2_ASSETS_NAMES", "YEAR_2_ASSETS_CATEGORIES", _
                       "YEAR_2_INCOME_NAMES", "YEAR_3_ASSETS_NAMES", _
                       "YEAR_3_ASSETS_CATEGORIES", "YEAR_3_INCOME_NAMES")
    Utilities.ApplyRangeChanges Sheets.PassiveAssetTest, constNames

    ' --- clear the per-company ranges, company by company, reporting progress ---
    Dim total As Long: total = Settings.MaximumNumberOfCompanies
    Dim reportProgress As Boolean
    reportProgress = (Not frm Is Nothing) And (endValue > startValue) And (total > 0)
    Dim stepSize As Double
    If total > 0 Then stepSize = (endValue - startValue) / total

    Dim perCompany As Collection
    Dim arr() As String

    For j = 1 To total
        Set perCompany = New Collection
        perCompany.Add "DATE_OF_TRANSFER_CURRENCY_NAME_" & j
        perCompany.Add "DATE_OF_TRANSFER_EXCHANGE_RATE_" & j
        perCompany.Add "DATE_OF_TRANSFER_DATE_OF_VALUATION_" & j
        perCompany.Add "DATE_OF_TRANSFER_TOTAL_ASSETS_" & j
        perCompany.Add "DATE_OF_TRANSFER_ASSETS_BOOK_VALUES_" & j
        perCompany.Add "DATE_OF_TRANSFER_ASSETS_CORRECTIONS_" & j
        perCompany.Add "DATE_OF_TRANSFER_BOOK_VALUE_OF_SHARES_IN_SUBSIDIARIES_" & j

        For i = 1 To 3
            perCompany.Add "YEAR_" & i & "_CURRENCY_NAME_" & j
            perCompany.Add "YEAR_" & i & "_EXCHANGE_RATE_" & j
            perCompany.Add "YEAR_" & i & "_START_DATE_" & j
            perCompany.Add "YEAR_" & i & "_END_DATE_" & j
            perCompany.Add "YEAR_" & i & "_TOTAL_ASSETS_" & j
            perCompany.Add "YEAR_" & i & "_REVENUE_" & j
            perCompany.Add "YEAR_" & i & "_ASSETS_BOOK_VALUES_" & j
            perCompany.Add "YEAR_" & i & "_ASSETS_CORRECTIONS_" & j
            perCompany.Add "YEAR_" & i & "_INCOME_BOOK_VALUES_" & j
            perCompany.Add "YEAR_" & i & "_BOOK_VALUE_OF_INCOME_FROM_SUBSIDIARIES_" & j
            perCompany.Add "YEAR_" & i & "_BOOK_VALUE_OF_SHARES_IN_SUBSIDIARIES_" & j
        Next i

        ReDim arr(1 To perCompany.count)
        For i = 1 To perCompany.count
            arr(i) = perCompany(i)
        Next i
        Utilities.ApplyRangeChanges Sheets.PassiveAssetTest, arr

        If reportProgress Then
            If (j Mod 4 = 0) Or (j = total) Then
                Form.UpdateLoadingBar frm, startValue + stepSize * j, _
                    "Nulstiller successionsopgørelsen... (" & j & "/" & total & ")"
            End If
        End If
    Next j

    Utilities.ApplyRangeChanges Sheets.PassiveAssetTest, Array("INCLUDE_IN_PASSIVE_ASSET_TEST"), "JA"

    Sheets.PassiveAssetTest.Columns.Hidden = False
    Sheets.PassiveAssetTest.Rows.Hidden = False
    Sheets.PassiveAssetTest.Range("YEAR_1_HIDDEN_AREA").EntireRow.Hidden = True
    Sheets.PassiveAssetTest.Range("YEAR_2_HIDDEN_AREA").EntireRow.Hidden = True
    Sheets.PassiveAssetTest.Range("YEAR_3_HIDDEN_AREA").EntireRow.Hidden = True

CleanExit:
    On Error Resume Next
    If Not IsBatch Then AppWorkbook.ToggleOptimization True
    Stack.Pop
    Exit Sub

ErrorHandler:
    If Error.handle("PassiveAssetTest.ResetSheet()", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub Export(ByVal exportType As String)
    On Error GoTo ErrorHandler
    Stack.Push "PassiveAssetTest.Export()"

    Dim fileSaveName As Variant

    Dim exportSheet As Worksheet
    Set exportSheet = ThisWorkbook.Sheets("Successionsopgørelse - eksport")

    ' page 1 always; page 2 vs page 3 depends on transfer-date mode
    Dim isTransferDate As Boolean
    isTransferDate = (SettingsSheet.Range("PASSIVE_ASSET_TEST").value = _
                      SettingsSheet.Range("PASSIVE_ASSET_TEST_DATE_OF_TRANSFER").value)

    Dim exportPrintArea As String
    If isTransferDate Then
        exportPrintArea = "PAGE_1,PAGE_3"      ' transfer-date: show page 3, hide page 2
    Else
        exportPrintArea = "PAGE_1,PAGE_2"      ' otherwise: show page 2, hide page 3
    End If

    If exportType = "PDF" Then
        fileSaveName = Application.GetSaveAsFilename( _
            InitialFileName:=IIf(Trim(Company.parentCompanyName) <> "", Company.parentCompanyName & "- successionsopgørelse.pdf", "Successionsopgørelse.pdf"), _
            FileFilter:="PDF Files (*.pdf), *.pdf", _
            title:="Gem successionsopgørelsen som PDF")
        If fileSaveName = False Then GoTo AbortExit
    End If

    Application.ScreenUpdating = False

    ' --- prepare the export (cover) sheet ---
    exportSheet.Visible = xlSheetVisible
    exportSheet.Move Before:=Sheets.Settings
    With exportSheet.PageSetup
        .PrintArea = exportPrintArea
        .Orientation = xlLandscape
        .Zoom = False
        .FitToPagesWide = 1
        .FitToPagesTall = False
        .CenterHorizontally = True
    End With
    exportSheet.ResetAllPageBreaks
    On Error Resume Next
    If isTransferDate Then
        exportSheet.HPageBreaks.Add Before:=exportSheet.Range("PAGE_3")
    Else
        exportSheet.HPageBreaks.Add Before:=exportSheet.Range("PAGE_2")
    End If
    On Error GoTo ErrorHandler

    ' --- prepare the main Successionsopgørelse sheet (unchanged from before) ---
    Sheets.PassiveAssetTest.Range("ROWS_TO_HIDE_DURING_EXPORT").EntireRow.Hidden = True
    Sheets.PassiveAssetTest.Range("ROWS_TO_SHOW_DURING_EXPORT").EntireRow.Hidden = False
    Sheets.PassiveAssetTest.ResetAllPageBreaks
    With Sheets.PassiveAssetTest.PageSetup
        .PrintArea = "PRINT_AREA_1,PRINT_AREA_2,PRINT_AREA_3,PRINT_AREA_4,PRINT_AREA_5,PRINT_AREA_6,PRINT_AREA_7,PRINT_AREA_8,PRINT_AREA_9"
        .PrintTitleColumns = "$C:$D"
        .CenterHorizontally = True
        .CenterVertically = True
        .Orientation = xlPortrait
        .Zoom = False
        .FitToPagesTall = 1
        .FitToPagesWide = False
    End With
    On Error Resume Next
    Sheets.PassiveAssetTest.HPageBreaks.Add Before:=Sheets.PassiveAssetTest.Range("PRINT_AREA_2")
    Sheets.PassiveAssetTest.HPageBreaks.Add Before:=Sheets.PassiveAssetTest.Range("PRINT_AREA_3")
    Sheets.PassiveAssetTest.HPageBreaks.Add Before:=Sheets.PassiveAssetTest.Range("PRINT_AREA_4")
    Sheets.PassiveAssetTest.HPageBreaks.Add Before:=Sheets.PassiveAssetTest.Range("PRINT_AREA_5")
    Sheets.PassiveAssetTest.HPageBreaks.Add Before:=Sheets.PassiveAssetTest.Range("PRINT_AREA_6")
    Sheets.PassiveAssetTest.HPageBreaks.Add Before:=Sheets.PassiveAssetTest.Range("PRINT_AREA_7")
    Sheets.PassiveAssetTest.HPageBreaks.Add Before:=Sheets.PassiveAssetTest.Range("PRINT_AREA_8")
    Sheets.PassiveAssetTest.HPageBreaks.Add Before:=Sheets.PassiveAssetTest.Range("PRINT_AREA_9")
    On Error GoTo ErrorHandler

    ' --- export the export sheet FIRST, then the main sheet ---
    Dim targetSheets As Object
    Set targetSheets = ThisWorkbook.Sheets(Array(exportSheet.name, Sheets.PassiveAssetTest.name))

    Application.ScreenUpdating = True
    DoEvents

    On Error Resume Next
    If exportType = "PDF" Then
        targetSheets.Select
        ActiveSheet.ExportAsFixedFormat Type:=xlTypePDF, fileName:=fileSaveName, _
            Quality:=xlQualityStandard, IgnorePrintAreas:=False, OpenAfterPublish:=True
    ElseIf exportType = "PRINT" Then
        targetSheets.PrintOut Preview:=True, Collate:=True, IgnorePrintAreas:=False
    End If
    If Err.number <> 0 Then
        MsgBox "Fejl (" & Err.number & "): " & Err.description, vbCritical
        Err.Clear
    End If
    On Error GoTo 0

CleanExit:
    On Error Resume Next
    exportSheet.Visible = xlSheetVeryHidden
    Sheets.PassiveAssetTest.Range("ROWS_TO_HIDE_DURING_EXPORT").EntireRow.Hidden = False
    Sheets.PassiveAssetTest.Range("ROWS_TO_SHOW_DURING_EXPORT").EntireRow.Hidden = True
    Application.ScreenUpdating = True
    Stack.Pop
    Exit Sub

AbortExit:
    Stack.Pop
    Exit Sub

ErrorHandler:
    Application.ScreenUpdating = True
    If Error.handle("PassiveAssetTest.Export()", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub
