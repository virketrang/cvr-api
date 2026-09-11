VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Valuation"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

' ============================================================================
' RENDERING (replaces AutoComplete/PopulateAdjustedEquity/PopulateCapitalised-
' Earnings). The server resolved every value, formula component and note; this
' only writes them into the sheet's named ranges.
' ============================================================================

Public Sub Render(company As Object, ValuationSheet As Worksheet)
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.Render()"

    Dim valuation As Object: Set valuation = company("valuation")

    Dim note As Object
    For Each note In valuation("notes")
        AppWorkbook.RenderNote ValuationSheet, note
    Next note

    If Not IsNull(valuation("property")) Then
        RenderProperty ValuationSheet, valuation("property")
    End If

    Dim yr As Object
    For Each yr In valuation("years")
        RenderYear ValuationSheet, yr
    Next yr

CleanExit:
    On Error Resume Next
    Stack.Pop
    Exit Sub

ErrorHandler:
    If Error.handle("Valuation.Render()", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Private Sub RenderProperty(ValuationSheet As Worksheet, prop As Object)
    Dim propertyRow As Long
    propertyRow = ValuationSheet.Range("PROPERTY_1_ADDRESS").Row
    ValuationSheet.Rows(propertyRow).EntireRow.Hidden = False

    ValuationSheet.Range("PROPERTY_1_ADDRESS").value = prop("address")
    ValuationSheet.Range("PROPERTY_1_REMARKS").value = prop("remarks")
    ValuationSheet.Range("PROPERTY_1_OWNERSHIP_SHARE").value = prop("ownershipShare")
    ValuationSheet.Range("PROPERTY_1_YEAR_1_BASIS_OF_VALUATION").value = prop("basisOfValuation")
    ValuationSheet.Range("PROPERTY_1_YEAR_2_BASIS_OF_VALUATION").value = prop("basisOfValuation")
    ValuationSheet.Range("PROPERTY_1_YEAR_3_BASIS_OF_VALUATION").value = prop("basisOfValuation")

    Dim slotKey As Variant
    For Each slotKey In prop("valuationsBySlot").Keys
        ValuationSheet.Range("PROPERTY_1_YEAR_" & slotKey & "_VALUATION").value = prop("valuationsBySlot")(slotKey)
    Next slotKey
End Sub

Private Sub RenderYear(ValuationSheet As Worksheet, yr As Object)
    Dim n As String: n = CStr(CLng(yr("slot")))

    ValuationSheet.Range("YEAR_" & n & "_START_DATE").value = yr("startDate")
    ValuationSheet.Range("YEAR_" & n & "_END_DATE").value = yr("endDate")

    If Not IsNull(yr("exchangeRate")) Then
        ValuationSheet.Range("YEAR_" & n & "_EXCHANGE_RATE").value = yr("exchangeRate")
    End If

    ValuationSheet.Range("YEAR_" & n & "_CURRENCY").value = yr("currencyName")

    If Not IsNull(yr("adjustedEquity")) Then
        Dim ae As Object: Set ae = yr("adjustedEquity")

        WriteAccount ValuationSheet, "YEAR_" & n & "_EQUITY", ae("equity")
        WriteAccount ValuationSheet, "YEAR_" & n & "_INTANGIBLE_ASSETS", ae("intangibleAssets")

        If Not IsNull(ae("landAndBuildings")) Then
            ValuationSheet.Range("YEAR_" & n & "_LAND_AND_BUILDINGS").value = ae("landAndBuildings")
        End If

        ValuationSheet.Range("YEAR_" & n & "_SHARES_IN_SUBSIDIARIES").value = _
            Formula.FromComponents(ae("sharesInSubsidiaries"), "+")

        WriteAccount ValuationSheet, "YEAR_" & n & "_PROPOSED_DIVIDENTS", ae("proposedDividends")
    End If

    If Not IsNull(yr("capitalisedEarnings")) Then
        Dim ce As Object: Set ce = yr("capitalisedEarnings")

        WriteAccount ValuationSheet, "YEAR_" & n & "_ASSETS", ce("assets")
        WriteAccount ValuationSheet, "YEAR_" & n & "_GOODWILL", ce("goodwill")
        WriteAccount ValuationSheet, "YEAR_" & n & "_CASH_AND_CASH_EQUIVALENTS", ce("cashAndCashEquivalents")
        WriteAccount ValuationSheet, "YEAR_" & n & "_DEPOSITS", ce("deposits")
        WriteAccount ValuationSheet, "YEAR_" & n & "_REVENUE", ce("revenue")
        WriteAccount ValuationSheet, "YEAR_" & n & "_PROFIT_LOSS_BEFORE_TAX", ce("profitLossBeforeTax")
        WriteAccount ValuationSheet, "YEAR_" & n & "_EXTRAORDINARY_INCOME", ce("extraordinaryIncome")
        WriteAccount ValuationSheet, "YEAR_" & n & "_EXTRAORDINARY_EXPENSES", ce("extraordinaryExpenses")
        WriteAccount ValuationSheet, "YEAR_" & n & "_DEPRECIATION_OF_INTANGIBLE_ASSETS", ce("depreciationOfIntangibleAssets")

        ValuationSheet.Range("YEAR_" & n & "_UNLISTED_SHARES").value = _
            Formula.FromComponents(ce("unlistedShares"), "+")

        ValuationSheet.Range("YEAR_" & n & "_FINANCIAL_INCOME").value = _
            Formula.FromComponents(ce("financialIncome"), "+")
        ValuationSheet.Range("YEAR_" & n & "_FINANCIAL_EXPENSES").value = _
            Formula.FromComponents(ce("financialExpenses"), "+")

        ValuationSheet.Range("YEAR_" & n & "_FINANCIAL_INSTRUMENTS").FormulaLocal = _
            Formula.FromComponents(ce("financialInstruments"), "+")

        Dim nonOpFull As String, nonOpPartial As String
        nonOpFull = Formula.FromComponents(ce("otherNonOperatingAssets")("full"), "+")
        nonOpPartial = Formula.FromComponents(ce("otherNonOperatingAssets")("half"), "+", "0,5")
        ValuationSheet.Range("YEAR_" & n & "_OTHER_NON_OPERATING_ASSETS").FormulaLocal = _
            Formula.Combine(nonOpFull, nonOpPartial)

        ValuationSheet.Range("YEAR_" & n & "_INTERCOMPANY_RECEIVABLES").value = _
            Formula.FromComponents(ce("intercompanyReceivables"), "+")
    End If
End Sub

' Writes a resolved account ({concept, value} or JSON null) to a named range.
Private Sub WriteAccount(ws As Worksheet, ByVal rangeName As String, account As Variant)
    If IsNull(account) Or IsEmpty(account) Then Exit Sub
    ws.Range(rangeName).value = account("value")
End Sub

Public Function findFirstEmptySubsidiaryRow(ByVal wsParent As Worksheet) As Long
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.findFirstEmptySubsidiaryRow()"
    
    Dim checkCell As Range
    Dim rowCounter As Long
    rowCounter = 1
    
    wsParent.Calculate
    
    For Each checkCell In wsParent.Range("SUBSIDIARIES_NAME").Columns(1).cells
        If checkCell.Formula = "" Then
            findFirstEmptySubsidiaryRow = rowCounter
            Exit Function
        End If
        rowCounter = rowCounter + 1
    Next checkCell
    
    findFirstEmptySubsidiaryRow = 0
    
CleanExit:
    On Error Resume Next
    Stack.Pop
    Exit Function
    
ErrorHandler:
    If Error.handle("Valuation.findFirstEmptySubsidiaryRow()", Err.description, Err.number, Erl) Then Resume CleanExit
End Function

Public Function createSheet(copyName As String, isParent As Boolean) As Worksheet
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.createSheet"
    
    Dim templateName As String
    Dim response As VbMsgBoxResult
    Dim targetSheet As Worksheet
    
    templateName = IIf(isParent, "Værdiansættelse - moderselskab", "Værdiansættelse - datterselskab")

    If Not Sheets.SheetExists(templateName) Then
        Err.Raise 91, "Valuation.createSheet", "Skabelon-arket '" & templateName & "' blev ikke fundet i projektet."
    End If

   If Sheets.SheetExists(copyName) Then
       response = MsgBox("Ark for dette selskab eksisterer allerede (" & copyName & ")." & vbCrLf & _
                          "Ønsker du at overskrive?", vbYesNo + vbQuestion, "Ark findes allerede")
        
       If response = vbNo Then GoTo CleanExit
        
      Application.DisplayAlerts = False
      ThisWorkbook.Sheets(copyName).Delete
      Application.DisplayAlerts = True
   End If
    
   ThisWorkbook.Sheets(templateName).Copy after:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.count)
   Set targetSheet = ThisWorkbook.Sheets(ThisWorkbook.Sheets.count)
    
   On Error Resume Next
   targetSheet.name = copyName
   If Err.number <> 0 Then
       Dim errDesc As String: errDesc = Err.description
       On Error GoTo ErrorHandler
       Err.Raise 1004, "Valuation.createSheet", "Kunne ikke omdøbe ark til '" & copyName & "'. Tjek for ulovlige tegn. (" & errDesc & ")"
   End If
   On Error GoTo ErrorHandler
    
    Set createSheet = targetSheet
    
CleanExit:
    On Error Resume Next
    Application.DisplayAlerts = True
    Stack.Pop
    Exit Function

ErrorHandler:
    If Error.handle("Valuation.createSheet", Err.description, Err.number, Erl) Then
        Resume CleanExit
    Else
        Resume Next
    End If
End Function

Public Sub LinkCompanyInformation(ByVal targetSheet As Worksheet, ByVal targetRowIndex As Long, isParent As Boolean)
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.LinkCompanyInformation"

    Dim ovName As String: ovName = "'Selskabsoversigt'!"
    Dim src As Worksheet: Set src = ThisWorkbook.Sheets("Selskabsoversigt")

    With targetSheet
        .Range("COMPANY_NAME").Formula = Formula.Link(ovName, src.Range("COMPANY_NAMES"), targetRowIndex)
        .Range("COMPANY_CVR").Formula = Formula.Link(ovName, src.Range("COMPANY_CVRS"), targetRowIndex)
        .Range("COMPANY_CORPORATE_FORM").Formula = Formula.Link(ovName, src.Range("COMPANY_CORPORATE_FORMS"), targetRowIndex)
        .Range("COMPANY_OWNER").Formula = Formula.Link(ovName, src.Range("COMPANY_OWNERS"), targetRowIndex)

        .Range("COMPANY_REPORTING_PERIODS").Formula = Formula.Link(ovName, src.Range("COMPANY_REPORTING_PERIODS"), targetRowIndex)
        .Range("COMPANY_CORPORATE_TAX_RATE").Formula = Formula.Link(ovName, src.Range("COMPANY_CORPORATE_TAX_RATES"), targetRowIndex)

        .Range("COMPANY_DIRECT_OWNERSHIP").Formula = Formula.Link(ovName, src.Range("COMPANY_DIRECT_OWNERSHIPS"), targetRowIndex)
        .Range("COMPANY_INDIRECT_OWNERSHIP").Formula = Formula.Link(ovName, src.Range("COMPANY_INDIRECT_OWNERSHIPS"), targetRowIndex)

        If Not isParent Then
            .Range("CONSOLIDATE").Formula = Formula.Link(ovName, src.Range("COMPANY_CONSOLIDATED"), targetRowIndex - 1)
        End If
    End With

CleanExit:
    On Error Resume Next
    Stack.Pop
    Exit Sub
ErrorHandler:
    If Error.handle("Valuation.LinkCompanyInformation", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub LinkSubsidiaryToParent(targetRowIndex As Long, formData As Object, copyName As String)
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.LinkSubsidiaryToParent"

    Dim parentSheetName As String: parentSheetName = Company.findParentSheetName(formData("owner"))

    If parentSheetName = "" Or Not Sheets.SheetExists(parentSheetName) Then GoTo CleanExit

    Dim wsParent As Worksheet: Set wsParent = ThisWorkbook.Sheets(parentSheetName)
    Dim subRowIndex As Long: subRowIndex = findFirstEmptySubsidiaryRow(wsParent)

    If subRowIndex = 0 Then
        MsgBox "Ingen ledige rækker i datter-listen på " & parentSheetName, vbCritical
        GoTo CleanExit
    End If

    Dim ovName As String: ovName = "'Selskabsoversigt'!"
    Dim ownershipCellAddr As String

    With wsParent
        .Range("SUBSIDIARIES_NAME").cells(subRowIndex, 1).EntireRow.Hidden = False

        .Range("SUBSIDIARIES_NAME").cells(subRowIndex, 1).Formula = Formula.Link(ovName, CompanySheet.Range("COMPANY_NAMES"), targetRowIndex)
        .Range("SUBSIDIARIES_CVR").cells(subRowIndex, 1).Formula = Formula.Link(ovName, CompanySheet.Range("COMPANY_CVRS"), targetRowIndex)

        ownershipCellAddr = .Range("SUBSIDIARIES_DIRECT_OWNERSHIP").cells(subRowIndex, 1).Address(False, False)

        .Range("SUBSIDIARIES_DIRECT_OWNERSHIP").cells(subRowIndex, 1).Formula = Formula.Link(ovName, CompanySheet.Range("COMPANY_DIRECT_OWNERSHIPS"), targetRowIndex, "0", "/100")
        .Range("SUBSIDIARIES_YEAR_1_VALUATION").cells(subRowIndex, 1).Formula = Formula.Link(ovName, CompanySheet.Range("COMPANY_YEAR_1_VALUATION"), targetRowIndex, "0", "*" & ownershipCellAddr)
        .Range("SUBSIDIARIES_YEAR_2_VALUATION").cells(subRowIndex, 1).Formula = Formula.Link(ovName, CompanySheet.Range("COMPANY_YEAR_2_VALUATION"), targetRowIndex, "0", "*" & ownershipCellAddr)
        .Range("SUBSIDIARIES_YEAR_3_VALUATION").cells(subRowIndex, 1).Formula = Formula.Link(ovName, CompanySheet.Range("COMPANY_YEAR_3_VALUATION"), targetRowIndex, "0", "*" & ownershipCellAddr)

        UpdateParentConsolidation wsParent, targetRowIndex, subRowIndex, ownershipCellAddr
    End With

CleanExit:
    On Error Resume Next
    Stack.Pop
    Exit Sub
ErrorHandler:
    If Error.handle("Valuation.LinkSubsidiaryToParent", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Private Sub UpdateParentConsolidation(wsParent As Worksheet, tRow As Long, sRow As Long, ownAddr As String)
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.UpdateParentConsolidation"
    
    Dim i As Integer
    Dim ovName As String: ovName = "'Selskabsoversigt'!"
    Dim consCell As String: consCell = ovName & CompanySheet.Range("COMPANY_CONSOLIDATED").cells(tRow - 1, 1).Address
    Dim dataCell As String
    Dim term As String

    For i = 1 To 7
        dataCell = ovName & CompanySheet.Range("COMPANY_YEAR_" & i & "_ADJUSTED_OPERATION_INCOME").cells(tRow, 1).Address

        term = " + IF(" & consCell & "=""JA"", " & dataCell & "*" & ownAddr & ", 0)"
        wsParent.Range("YEAR_" & i & "_ADJUSTED_OPERATION_INCOME").Formula = wsParent.Range("YEAR_" & i & "_ADJUSTED_OPERATION_INCOME").Formula & term
        
        dataCell = ovName & CompanySheet.Range("COMPANY_YEAR_" & i & "_ADJUSTED_REVENUE").cells(tRow, 1).Address
        term = " + IF(" & consCell & "=""JA"", " & dataCell & "*" & ownAddr & ", 0)"
        wsParent.Range("YEAR_" & i & "_ADJUSTED_REVENUE").Formula = wsParent.Range("YEAR_" & i & "_ADJUSTED_REVENUE").Formula & term
        
        dataCell = ovName & CompanySheet.Range("COMPANY_YEAR_" & i & "_INVESTED_CAPITAL").cells(tRow, 1).Address
        term = " + IF(" & consCell & "=""JA"", " & dataCell & "*" & ownAddr & ", 0)"
        wsParent.Range("YEAR_" & i & "_INVESTED_CAPITAL").Formula = wsParent.Range("YEAR_" & i & "_INVESTED_CAPITAL").Formula & term
    Next i

    For i = 1 To 3
        dataCell = ovName & CompanySheet.Range("COMPANY_YEAR_" & i & "_OPERATING_ASSETS").cells(tRow, 1).Address
        term = " + IF(" & consCell & "=""JA"", " & dataCell & "*" & ownAddr & ", 0)"
        
        wsParent.Range("THREE_YEAR_OPERATING_ASSETS_YEAR_" & i).Formula = wsParent.Range("THREE_YEAR_OPERATING_ASSETS_YEAR_" & i).Formula & term
        If i <= 2 Then wsParent.Range("TWO_YEAR_OPERATING_ASSETS_YEAR_" & i).Formula = wsParent.Range("TWO_YEAR_OPERATING_ASSETS_YEAR_" & i).Formula & term
        If i = 1 Then wsParent.Range("ONE_YEAR_OPERATING_ASSETS_YEAR_1").Formula = wsParent.Range("ONE_YEAR_OPERATING_ASSETS_YEAR_1").Formula & term
    Next i

CleanExit:
    On Error Resume Next
    Stack.Pop
    Exit Sub
ErrorHandler:
    If Error.handle("Valuation.UpdateParentConsolidation", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub UnlinkSubsidiaryFromParent(parentSheet As Worksheet, ByVal childName As String)
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.UnlinkSubsidiaryFromParent"

    parentSheet.Calculate
    Dim cell As Range, k As Long, found As Long
    k = 1: found = 0
    For Each cell In parentSheet.Range("SUBSIDIARIES_NAME").Columns(1).cells
        If CStr(cell.value) = childName Then found = k: Exit For
        k = k + 1
    Next cell
    If found = 0 Then GoTo CleanExit                                  ' not linked here

    Dim blockNames As Variant
    blockNames = Array("SUBSIDIARIES_NAME", "SUBSIDIARIES_CVR", "SUBSIDIARIES_DIRECT_OWNERSHIP", _
                       "SUBSIDIARIES_YEAR_1_VALUATION", "SUBSIDIARIES_YEAR_2_VALUATION", "SUBSIDIARIES_YEAR_3_VALUATION")

    Dim addrs() As String
    ReDim addrs(LBound(blockNames) To UBound(blockNames))
    Dim i As Long
    For i = LBound(blockNames) To UBound(blockNames)
        addrs(i) = parentSheet.Range(CStr(blockNames(i))).cells(found, 1).Address(False, False)
    Next i

    Utilities.ApplyRangeChanges parentSheet, addrs

    parentSheet.Range("SUBSIDIARIES_NAME").cells(found, 1).EntireRow.Hidden = True  ' re-hide the freed slot

CleanExit:
    On Error Resume Next
    Stack.Pop
    Exit Sub
ErrorHandler:
    If Error.handle("Valuation.UnlinkSubsidiaryFromParent", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub RebuildParentConsolidation(parentSheet As Worksheet)
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.RebuildParentConsolidation"

    ' Reset from the template that MATCHES this parent's layout.
    ' Only the ultimate parent (v001) uses the moderselskab template; every other
    ' parent is a subsidiary built from the datterselskab template, whose base
    ' formulas sit one row up. Using the wrong template shifts the cell references.
    Dim tmplName As String
    If parentSheet.name = "Værdiansættelse - v001" Then
        tmplName = "Værdiansættelse - moderselskab"
    Else
        tmplName = "Værdiansættelse - datterselskab"
    End If

    Dim tmpl As Worksheet: Set tmpl = Sheets.byNameOrNothing(tmplName)
    If tmpl Is Nothing Then GoTo CleanExit

    Dim i As Long
    For i = 1 To 7
        Formula.Reset parentSheet, tmpl, "YEAR_" & i & "_ADJUSTED_OPERATION_INCOME"
        Formula.Reset parentSheet, tmpl, "YEAR_" & i & "_ADJUSTED_REVENUE"
        Formula.Reset parentSheet, tmpl, "YEAR_" & i & "_INVESTED_CAPITAL"
    Next i
    For i = 1 To 3
        Formula.Reset parentSheet, tmpl, "THREE_YEAR_OPERATING_ASSETS_YEAR_" & i
        If i <= 2 Then Formula.Reset parentSheet, tmpl, "TWO_YEAR_OPERATING_ASSETS_YEAR_" & i
        If i = 1 Then Formula.Reset parentSheet, tmpl, "ONE_YEAR_OPERATING_ASSETS_YEAR_1"
    Next i

    parentSheet.Calculate
    Dim cell As Range, s As Long: s = 1
    For Each cell In parentSheet.Range("SUBSIDIARIES_NAME").Columns(1).cells
        If cell.Formula <> "" Then
            Dim childIdx As Long: childIdx = Company.indexOfName(CStr(cell.value))
            If childIdx > 0 Then
                Dim ownAddr As String
                ownAddr = parentSheet.Range("SUBSIDIARIES_DIRECT_OWNERSHIP").cells(s, 1).Address(False, False)
                UpdateParentConsolidation parentSheet, childIdx, s, ownAddr
            End If
        End If
        s = s + 1
    Next cell

CleanExit:
    On Error Resume Next
    Stack.Pop
    Exit Sub
ErrorHandler:
    If Error.handle("Valuation.RebuildParentConsolidation", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub AdjustSheet(ValuationSheet As Worksheet, currentCompany As Long, ByVal successionPeriod As String)
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.AdjustSheet"
    
    Dim comparePeriod As String: comparePeriod = Trim(UCase(successionPeriod))
    
    Dim group1 As Variant, group2 As Variant, group3 As Variant
    group1 = Array("OPERATING_ASSETS_1_YEARS", _
                   "EARNINGS_BEFORE_CAPITALIZATION_1", "REVENUE_GROWTH_1", "AVERAGE_RETURN_1", _
                   "LIFETIME_1", "CAPITALIZATION_FACTOR_1", "CAPITALIZED_EARNINGS_1", "DISCOUNTING_1", "SUM_1")
                   
    group2 = Array("OPERATING_ASSETS_2_YEARS", _
                   "EARNINGS_BEFORE_CAPITALIZATION_2", "REVENUE_GROWTH_2", "AVERAGE_RETURN_2", _
                   "LIFETIME_2", "CAPITALIZATION_FACTOR_2", "CAPITALIZED_EARNINGS_2", "DISCOUNTING_2", "SUM_2")
                   
    group3 = Array("OPERATING_ASSETS_3_YEARS", _
                   "EARNINGS_BEFORE_CAPITALIZATION_3", "REVENUE_GROWTH_3", "AVERAGE_RETURN_3", _
                   "LIFETIME_3", "CAPITALIZATION_FACTOR_3", "CAPITALIZED_EARNINGS_3", "DISCOUNTING_3", "SUM_3")

    Utilities.HideRange ValuationSheet, Array("SUBSIDIARIES"), HideType.HIDE_ROWS
    Utilities.HideRange ValuationSheet, Array("PROPERTIES"), HideType.HIDE_ROWS

    Select Case Trim(UCase(successionPeriod))
        Case Settings.GetNoCalculationValue, Settings.GetDateOfTransferValue, Settings.Get1YearValue
            Utilities.HideRange ValuationSheet, group2, HideType.HIDE_ROWS
            Utilities.HideRange ValuationSheet, group3, HideType.HIDE_ROWS
            Utilities.HideRange ValuationSheet, Array("YEAR_2"), HideType.HIDE_COLUMNS
            Utilities.HideRange ValuationSheet, Array("YEAR_3"), HideType.HIDE_COLUMNS
            Utilities.HideRange ValuationSheet, Array("YEAR_2_WEIGHTING", "YEAR_3_WEIGHTING"), HideType.HIDE_ROWS
            Utilities.HideRange ValuationSheet, Array("YEAR_2_WEIGHTED_RESULT", "YEAR_3_WEIGHTED_RESULT"), HideType.HIDE_ROWS
        Case Settings.Get2YearValue
            Utilities.HideRange ValuationSheet, group3, HideType.HIDE_ROWS
            Utilities.HideRange ValuationSheet, Array("YEAR_3"), HideType.HIDE_COLUMNS
            Utilities.HideRange ValuationSheet, Array("YEAR_3_WEIGHTED_RESULT"), HideType.HIDE_ROWS
        Case Settings.Get3YearValue
            Utilities.HideRange ValuationSheet, group1, HideType.HIDE_ROWS
            Utilities.HideRange ValuationSheet, group2, HideType.HIDE_ROWS
        Case Else
            Err.Raise vbObjectError + ErrorCode.InvariantViolated, _
                      "Valuation.AdjustSheet", _
                      "Ukendt passiv-aktiv-test tilstand: '" & comparePeriod & "'. " & _
                      "Forventede en af de fem PASSIVE_ASSET_TEST-værdier fra Indstillinger. " & _
                      "Ingen rækker blev skjult — arket ville være vist forkert."
    End Select

CleanExit:
    On Error Resume Next
    Stack.Pop
    Exit Sub
ErrorHandler:
    If Error.handle("Valuation.AdjustSheet", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub ModifySheets(action As ResetOrDeleteAction, Optional ByRef frm As Object, Optional IsBatch As Boolean = False, Optional startValue As Double = 50, Optional endValue As Double = 100)
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.modifySheets"
    If Not IsBatch Then AppWorkbook.ToggleOptimization False
    Application.DisplayAlerts = False

    Dim ws As Worksheet
    Dim sheetsToProcess As New Collection
    For Each ws In ThisWorkbook.Worksheets
        If ws.name Like "Værdiansættelse - v###" Then
            Select Case action
                Case ResetOrDeleteAction.Delete
                    sheetsToProcess.Add ws
                Case ResetOrDeleteAction.Reset
                    If ws.Visible <> xlSheetVeryHidden Then sheetsToProcess.Add ws
            End Select
        End If
    Next ws

    Dim total As Long: total = sheetsToProcess.count
    Dim percentStep As Double
    If total > 0 Then percentStep = (endValue - startValue) / total

    Dim processed As Long
    Dim currentPercent As Double: currentPercent = startValue

    For Each ws In sheetsToProcess
        processed = processed + 1

        Select Case action
            Case ResetOrDeleteAction.Delete: ws.Delete
            Case ResetOrDeleteAction.Reset:  ResetSheet ws
        End Select

        If Not frm Is Nothing Then
            currentPercent = currentPercent + percentStep
            Form.UpdateLoadingBar frm, currentPercent, "Nulstiller ark... (" & processed & "/" & total & ")"
        End If
    Next ws

CleanExit:
    On Error Resume Next
    Application.DisplayAlerts = True
    If Not IsBatch Then AppWorkbook.ToggleOptimization True
    Stack.Pop
    Exit Sub
ErrorHandler:
    If Error.handle("Valuation.modifySheets", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub ResetSheet(ByVal ws As Worksheet)
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.ResetSheet"
    
    Dim ranges As Variant: ranges = Array("REGULERET_EGENKAPITAL", "BEMÆRKNINGER", "DOSMERSEDDEL", _
                                         "KAPITALISERET_MERINDTJENING_1", "KAPITALISERET_MERINDTJENING_2", _
                                         "KAPITALISERET_MERINDTJENING_3", "UDSKUDT_SKAT", "PROPERTY", _
                                         "YEAR_1_DEFERRED_TAX", "YEAR_2_DEFERRED_TAX", "YEAR_3_DEFERRED_TAX")
    
    If ws.name <> "Værdiansættelse - v001" Then
        ws.Range("KONSOLIDERING").value = "NEJ"
    End If
    
    ws.Range("AFKRYDSNINGSSKEMA").value = False

    Utilities.ApplyRangeChanges ws, ranges

    ws.Columns.Hidden = False
    ws.Rows.Hidden = False
    ws.Range("PROPERTIES").EntireRow.Hidden = True
    
    ws.Visible = xlSheetVeryHidden

CleanExit:
    On Error Resume Next
    Stack.Pop
    Exit Sub

ErrorHandler:
    If Error.handle("Valuation.ResetSheet", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub AddProperty()
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.addProperty"
    
    Dim PROPERTY_AREA As Range
    Dim omraade As Range
    Dim række As Range
    Dim fundet As Boolean
    
    fundet = False
    Set PROPERTY_AREA = ActiveSheet.Range("PROPERTY_AREA")

    
    If PROPERTY_AREA Is Nothing Then
        MsgBox "Navngivet område 'PROPERTY_AREA' blev ikke fundet på dette ark.", vbCritical ' should be toast
    End If
    
    For Each omraade In PROPERTY_AREA.Areas
        For Each række In omraade.Rows
            If række.Hidden = True Then
                række.Hidden = False
                fundet = True
                GoTo foundRow
            End If
        Next række
    Next omraade
foundRow:
    If Not fundet Then
        MsgBox "Der blev ikke fundet nogen skjulte rækker i PROPERTY_AREA.", vbInformation
    End If
    
CleanExit:
    On Error Resume Next
    Stack.Pop
    Exit Sub

ErrorHandler:
    If Error.handle("Valuation.addProperty", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub
Public Sub DeleteProperty()
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.deleteProperty"
    
    AppWorkbook.ToggleOptimization False
    
    Dim callingShape As Shape
    Dim targetRow As Long
    
    Set callingShape = ActiveSheet.Shapes(Application.Caller)
    
    If callingShape Is Nothing Then
        MsgBox "Makroen blev ikke udløst af en figur, eller figurens navn kunne ikke findes.", vbExclamation, "Fejl i udførelse" ' Change to a toast message
        GoTo CleanExit
    End If
    
    targetRow = callingShape.topLeftCell.Row
    
    Utilities.ApplyRangeChanges ActiveSheet, Array("AC" & targetRow & ":BM" & targetRow, "BO" & targetRow & ":BW" & targetRow, "BY" & targetRow & ":CG" & targetRow)
        
    ActiveSheet.Rows(targetRow).Hidden = True

CleanExit:
    On Error Resume Next
    AppWorkbook.ToggleOptimization True
    Stack.Pop
    Exit Sub

ErrorHandler:
    If Error.handle("Valuation.deleteProperty", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub Export(ByVal exportFormat As String)
    On Error GoTo ErrorHandler
    Stack.Push "Valuation.Export"

    Dim ws As Worksheet
    Dim fileSaveName As Variant
    Dim sheetArray() As String
    Dim i As Long, count As Long

    Dim exportSheet As Worksheet
    Set exportSheet = ThisWorkbook.Sheets("Værdiansættelse - eksport")

    If exportFormat = "PDF" Then
        fileSaveName = Application.GetSaveAsFilename( _
            InitialFileName:=IIf(Trim(Company.parentCompanyName) <> "", Company.parentCompanyName & "- værdiansættelse.pdf", "Værdiansættelse.pdf"), _
            FileFilter:="PDF Files (*.pdf), *.pdf", _
            title:="Gem alle værdiansættelser som PDF")
        If fileSaveName = False Then GoTo CleanExit
    End If

    Application.ScreenUpdating = False

    ' --- export sheet is page 1..2, placed FIRST ---
    exportSheet.Visible = xlSheetVisible
    exportSheet.Move Before:=Sheets.Settings
    With exportSheet.PageSetup
        .PrintArea = "PAGE_1,PAGE_2"
        .Orientation = xlLandscape
        .Zoom = False
        .FitToPagesWide = 1
        .FitToPagesTall = False
        .CenterHorizontally = True
    End With
    exportSheet.ResetAllPageBreaks
    On Error Resume Next
    exportSheet.HPageBreaks.Add Before:=exportSheet.Range("PAGE_2")   ' force the page split between the two named pages
    On Error GoTo ErrorHandler

    ReDim sheetArray(0)
    sheetArray(0) = exportSheet.name
    count = 1

    ' --- then every visible v### valuation sheet ---
    For i = 1 To Settings.MaximumNumberOfCompanies
        Dim sheetName As String
        sheetName = "Værdiansættelse - v" & VBA.Format(i, "000")   ' see note below
        Set ws = Nothing
        On Error Resume Next
        Set ws = ThisWorkbook.Sheets(sheetName)
        On Error GoTo 0

        If Not ws Is Nothing Then
            If ws.Visible = xlSheetVisible Then
                ReDim Preserve sheetArray(count)
                sheetArray(count) = ws.name
                count = count + 1

                With ws.PageSetup
                    .PrintArea = "PrintArea1,PrintArea2,PrintArea3,PrintArea4,PrintArea5,PrintArea6"
                    .Orientation = xlLandscape
                    .Zoom = False
                    .CenterHorizontally = True
                    .CenterVertically = True
                    .FitToPagesWide = 1
                    .FitToPagesTall = False
                    .PrintTitleRows = ""
                End With

                ws.ResetAllPageBreaks
                On Error Resume Next
                ws.HPageBreaks.Add Before:=ws.Range("PrintArea2")
                ws.HPageBreaks.Add Before:=ws.Range("PrintArea3")
                ws.HPageBreaks.Add Before:=ws.Range("PrintArea4")
                ws.HPageBreaks.Add Before:=ws.Range("PrintArea5")
                ws.HPageBreaks.Add Before:=ws.Range("PrintArea6")
                On Error GoTo 0
            End If
        End If
        Set ws = Nothing
    Next i

    Application.ScreenUpdating = True
    DoEvents

    Dim targetSheets As Object
    Set targetSheets = ThisWorkbook.Sheets(sheetArray)

    On Error Resume Next
    If exportFormat = "PDF" Then
        targetSheets.Select
        ActiveSheet.ExportAsFixedFormat Type:=xlTypePDF, fileName:=fileSaveName, _
            Quality:=xlQualityStandard, IncludeDocProperties:=True, _
            IgnorePrintAreas:=False, OpenAfterPublish:=True
    ElseIf exportFormat = "PRINT" Then
        targetSheets.PrintOut Preview:=True, Collate:=True, IgnorePrintAreas:=False
    End If
    If Err.number <> 0 Then
        MsgBox "Fejl (" & Err.number & "): " & Err.description & vbCrLf & _
               "Sker ved: " & IIf(exportFormat = "PDF", "PDF Export", "Print Preview"), vbCritical
        Err.Clear
    End If
    On Error GoTo 0

    ThisWorkbook.Sheets(sheetArray(0)).Select

CleanExit:
    On Error Resume Next
    exportSheet.Visible = xlSheetVeryHidden
    Application.ScreenUpdating = True
    AppWorkbook.ToggleOptimization True
    Stack.Pop
    Exit Sub

ErrorHandler:
    Application.ScreenUpdating = True
    If Error.handle("Valuation.Export", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub
