VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "AppWorkbook"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

Public Sub AddCompany(formData As Object, Optional IsBatch As Boolean = False)
    On Error GoTo ErrorHandler
    Stack.Push "AppWorkbook.AddCompany()"
    
    Dim targetSheet As Worksheet
    Dim copyName As String
    Dim rowInfo As CompanyRowInfo
    
    rowInfo = Company.findFirstEmptyRow()
    
    If rowInfo.ROW_NUMBER = 0 Then GoTo CleanExit
    
    If formData("isParent") Then
        copyName = "Værdiansættelse - v001"
    Else
        If rowInfo.UUID = "" Then GoTo CleanExit
        copyName = "Værdiansættelse - " & rowInfo.UUID
    End If

    Set targetSheet = Valuation.createSheet(copyName, formData("isParent"))
    If targetSheet Is Nothing Then GoTo CleanExit

    Company.AddCompany rowInfo.ROW_NUMBER, formData, copyName, formData("isParent")

    Valuation.LinkCompanyInformation targetSheet, rowInfo.ROW_NUMBER, formData("isParent")
    If Not formData("isParent") Then
        Valuation.LinkSubsidiaryToParent rowInfo.ROW_NUMBER, formData, copyName
    End If
    
    If Not IsBatch Then SmartArt.refreshCorporateStructureDiagrams

    If Not IsBatch Then PassiveAssetTest.AdjustSuccessionColumns

CleanExit:
    Stack.Pop
    Exit Sub
    
ErrorHandler:
    If Error.handle("AppWorkbook.AddCompany()", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub RemoveCompany()
    On Error GoTo ErrorHandler
    Stack.Push "AppWorkbook.RemoveCompany"
    AppWorkbook.ToggleOptimization False

    Dim shp As Shape: Set shp = ActiveSheet.Shapes(Application.Caller)
    Dim idx As Long: idx = shp.topLeftCell.Row - Sheets.CompanyOverview.Range("COMPANY_NAMES").Row + 1
    
    If Trim$(Company.nameAt(idx)) = "" Then GoTo CleanExit

    Dim f As RemoveCompanyForm
    Set f = New RemoveCompanyForm
    f.Display idx
    Unload f
    Set f = Nothing

CleanExit:
    Application.DisplayAlerts = True
    AppWorkbook.ToggleOptimization True
    Stack.Pop
    Exit Sub
ErrorHandler:
    Application.DisplayAlerts = True
    If Error.handle("AppWorkbook.RemoveCompany", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub PerformCompanyRemoval(ByVal idx As Long)
    On Error GoTo ErrorHandler
    Stack.Push "AppWorkbook.PerformCompanyRemoval"
    AppWorkbook.ToggleOptimization False

    Dim childName As String: childName = Company.nameAt(idx)
    Dim ownerName As String: ownerName = Company.ownerAt(idx)
    If Trim$(childName) = "" Then GoTo CleanExit

    Dim targets As Collection
    If Company.hasChildren(childName) Then
        Set targets = Company.subtreeIndices(childName)
    Else
        Set targets = New Collection
        targets.Add idx
    End If

    Dim parentSheet As Worksheet
    Set parentSheet = Sheets.byNameOrNothing(Company.findParentSheetName(ownerName))
    If Not parentSheet Is Nothing Then Valuation.UnlinkSubsidiaryFromParent parentSheet, childName

    Dim t As Variant
    For Each t In targets
        Company.purgeCompany CLng(t)
    Next t

    If Not parentSheet Is Nothing Then Valuation.RebuildParentConsolidation parentSheet
    SmartArt.refreshCorporateStructureDiagrams
    PassiveAssetTest.AdjustSuccessionColumns

CleanExit:
    Application.DisplayAlerts = True
    AppWorkbook.ToggleOptimization True
    Stack.Pop
    Exit Sub
ErrorHandler:
    Application.DisplayAlerts = True
    If Error.handle("AppWorkbook.PerformCompanyRemoval", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub DeleteEntireProject()
    On Error GoTo ErrorHandler
    Stack.Push "AppWorkbook.DeleteEntireProject"

    AppWorkbook.ResetWorkbook Settings.PassiveAssetTest

    Toast.Show "Projektet er slettet.", "bottom-right", "success", 6

CleanExit:
    Stack.Pop
    Exit Sub
ErrorHandler:
    If Error.handle("AppWorkbook.DeleteEntireProject", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub ResetWorkbook(ByVal successionPeriod As String, Optional frm As Object, Optional IsBatch As Boolean = False, Optional startValue As Double = 0, Optional endValue As Double = 100)
    On Error GoTo ErrorHandler
    Stack.Push "AppWorkbook.ResetWorkbook"
    
    If Not IsBatch Then AppWorkbook.ToggleOptimization False

    Dim span As Double: span = endValue - startValue
    
    If Not frm Is Nothing Then Form.UpdateLoadingBar frm, startValue + span * 0.02, "Nulstiller selskabsoversigten..."
    Company.resetCompanyOverview successionPeriod, True

    If Not frm Is Nothing Then Form.UpdateLoadingBar frm, startValue + span * 0.1, "Nulstiller successionsopgørelsen..."
    PassiveAssetTest.ResetSheet True, frm, startValue + span * 0.1, startValue + span * 0.5

    If Not frm Is Nothing Then Form.UpdateLoadingBar frm, startValue + span * 0.5, "Nulstiller værdiansættelser..."
    Valuation.ModifySheets ResetOrDeleteAction.Delete, frm, True, startValue + span * 0.5, endValue
    
    Sheets.PassiveAssetTest.Visible = xlSheetVeryHidden
    
CleanExit:
    If Not IsBatch Then AppWorkbook.ToggleOptimization True
    Stack.Pop
    Exit Sub
ErrorHandler:
    If Error.handle("AppWorkbook.ResetCompany", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub CreateWorkbook(frm As Object, formData As Object)
    On Error GoTo ErrorHandler
    Stack.Push "AppWorkbook.CreateWorkbook"

    AppWorkbook.ToggleOptimization False

    Dim successionPeriod As String: successionPeriod = formData("successionPeriod")

    Settings.PassiveAssetTest = successionPeriod
    Settings.CurrencyFormat = formData("currencyCode")

    AppWorkbook.ResetWorkbook successionPeriod, frm, True, 0, 40

    Form.UpdateLoadingBar frm, 45, "Sender projektdata til serveren..."

    ' Serveren udfoerer alle forretningsregler (kvalifikation, vaerdiansaettelses-
    ' input, passiv-aktiv-test, noter). Requesten indeholder formData fra guiden
    ' plus konfigurationen fra Indstillinger-arket.
    Dim request As Object: Set request = CreateObject("Scripting.Dictionary")
    request.Add "formData", formData
    request.Add "settings", SettingsPayload.Build()

    Dim response As Object
    Set response = API.ResolveProject(JsonConverter.ConvertToJson(request))
    If response Is Nothing Then GoTo CleanExit

    Form.UpdateLoadingBar frm, 55, "Udfylder ark..."

    Dim infoItem As Object
    For Each infoItem In response("excludedCompanies")
        Toast.Show infoItem("name") & ": " & infoItem("reason"), "bottom-right", "warning", 8
    Next infoItem
    For Each infoItem In response("warnings")
        Toast.Show infoItem("message"), "bottom-right", "warning", 10
    Next infoItem

    Dim companies As Object: Set companies = response("companies")
    Dim total As Long: total = companies.count
    Dim processed As Long: processed = 0
    Dim percentStep As Double: percentStep = IIf(total > 0, 40 / total, 40)

    Dim company As Object
    Dim companyData As Object
    Dim ValuationSheet As Worksheet
    Dim searchCell As Range
    Dim targetRowIndex As Long
    Dim UUID As String

    For Each company In companies
        On Error GoTo CompanyError

        processed = processed + 1
        Form.UpdateLoadingBar frm, 55 + percentStep * processed, _
            "Udfylder " & company("name") & " (" & processed & "/" & total & ")..."

        ' Selskabsoversigt-raekke + kopiering af vaerdiansaettelsesark + links
        ' (uaendret klient-rendering; alle vaerdier kommer fra serveren).
        Set companyData = CreateObject("Scripting.Dictionary")
        companyData.Add "isParent", company("isParent")
        companyData.Add "name", company("overviewRow")("name")
        companyData.Add "cvr", company("overviewRow")("cvr")
        companyData.Add "corporateForm", company("overviewRow")("corporateForm")
        companyData.Add "owner", company("overviewRow")("owner")
        companyData.Add "reportingPeriods", company("overviewRow")("reportingPeriods")
        companyData.Add "taxRate", company("overviewRow")("taxRate")
        companyData.Add "directOwnership", company("overviewRow")("directOwnershipPercent")

        AppWorkbook.AddCompany companyData, True

        targetRowIndex = 0
        For Each searchCell In CompanySheet.Range("COMPANY_NAMES")
            If searchCell.value = company("name") Then
                targetRowIndex = searchCell.Row - CompanySheet.Range("COMPANY_NAMES").Row + 1
                Exit For
            End If
        Next searchCell

        If targetRowIndex = 0 Then GoTo NextCompany

        UUID = CompanySheet.Range("COMPANY_UUIDS").cells(targetRowIndex, 1).value

        Set ValuationSheet = Nothing
        If company("isParent") Then
            Set ValuationSheet = ThisWorkbook.Sheets("Værdiansættelse - v001")
        Else
            Set ValuationSheet = ThisWorkbook.Sheets("Værdiansættelse - " & UUID)
        End If

        If ValuationSheet Is Nothing Then
            MsgBox "Advarsel: Ark 'Værdiansættelse - " & UUID & "' blev ikke fundet for CVR: " & company("cvr"), vbExclamation, "Ark Mangler"
            GoTo NextCompany
        End If

        ValuationSheet.Visible = xlSheetVisible
        Valuation.Render company, ValuationSheet
        Valuation.AdjustSheet ValuationSheet, CLng(company("index")), successionPeriod

        If Not IsNull(company("passiveAssetTest")) Then
            PassiveAssetTest.Render company, successionPeriod, Utilities.NzVal(formData("dateOfTransfer"), "")
        End If

NextCompany:
    Next company
    On Error GoTo ErrorHandler

    If response("successionMode") <> "NO_CALCULATION" Then
        Form.UpdateLoadingBar frm, 96, "Justerer successionsopgørelsen..."
        PassiveAssetTest.AdjustSheet CLng(response("numberOfPassiveTestCompanies")), successionPeriod
    Else
        Sheets.PassiveAssetTest.Visible = xlSheetVeryHidden
    End If

    Form.UpdateLoadingBar frm, 98, "Opdaterer koncerndiagrammer..."
    SmartArt.refreshCorporateStructureDiagrams

    Form.UpdateLoadingBar frm, 100, "Færdig"
    GoTo CleanExit

CompanyError:
    If Error.handle("Render_Loop_" & company("name"), Err.description, Err.number, Erl) Then
        Resume CleanExit
    Else
        Resume NextCompany
    End If

ErrorHandler:
    If Error.handle("AppWorkbook.CreateWorkbook", Err.description, Err.number, Erl) Then Resume CleanExit

CleanExit:
    AppWorkbook.ToggleOptimization True
    Unload frm
    Stack.Pop
    Exit Sub
End Sub

' Places a server-resolved note ({text, fit, sheet, notepad}) on the right
' sheet. "PASSIVE_ASSET_TEST" always targets Successionsopgørelsen; everything
' else goes to the sheet the caller is rendering.
Public Sub RenderNote(defaultSheet As Worksheet, note As Object)
    On Error GoTo ErrorHandler
    Stack.Push "AppWorkbook.RenderNote"

    Dim target As Worksheet
    If note("sheet") = "PASSIVE_ASSET_TEST" Then
        Set target = Sheets.PassiveAssetTest
    Else
        Set target = defaultSheet
    End If

    AppWorkbook.AddNote target, CStr(note("notepad")), CStr(note("text")), CBool(note("fit"))

CleanExit:
    Stack.Pop
    Exit Sub

ErrorHandler:
    If Error.handle("AppWorkbook.RenderNote", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Function VerifyRateOfReturnOnCapital()
    On Error GoTo ErrorHandler
    Stack.Push "AppWorkbook.VerifyRateOfReturnOnCapital"
    
    Dim apiRateOfReturnOnCapital As Double
    
    apiRateOfReturnOnCapital = API.getRateOfReturnOnCapital() * 100
    
    If apiRateOfReturnOnCapital <> Settings.RateOfReturnOnCapital Then
        Settings.RateOfReturnOnCapital = apiRateOfReturnOnCapital
        Toast.Show "Ny kapitalafkastsats hentet: " & _
                   Format$(apiRateOfReturnOnCapital, "0.00") & " %. Regnearket er opdateret.", _
                   "bottom-right", "info", 8
    End If
    
CleanExit:
    Stack.Pop
    Exit Function

ErrorHandler:
    If Error.handle("AppWorkbook.VerifyRateOfReturnOnCapital", Err.description, Err.number, Erl) Then Resume CleanExit
End Function

Public Function VerifyVersion()
    On Error GoTo ErrorHandler
    Stack.Push "AppWorkbook.VerifyVersion"
    
    Dim apiVersion As String
    Dim workbookVersion As String
    
    workbookVersion = Settings.version
    
    apiVersion = API.getAPIVersion()
        
    If apiVersion <> workbookVersion Then
        MsgBox "Der er en nyere version." & vbCrLf & _
            "Seneste version: " & apiVersion & vbCrLf & _
            "Din version: " & workbookVersion & vbCrLf & vbCrLf & _
            "Du kan finde den seneste version på sag 036428-0278 under mappen: ""Værdiansættelse""", vbInformation, "Opdatering tilgængelig"
    End If
    
CleanExit:
    Stack.Pop
    Exit Function
ErrorHandler:
    If Error.handle("AppWorkbook.VerifyVersion", Err.description, Err.number, Erl) Then Resume CleanExit
End Function

Public Sub ToggleOptimization(ByVal TurnOn As Boolean)
    On Error GoTo ErrorHandler
    Stack.Push "AppWorkbook.ToggleOptimization"
    
    Application.ScreenUpdating = TurnOn
    Application.EnableEvents = TurnOn
    Application.Calculation = IIf(TurnOn, xlCalculationAutomatic, xlCalculationManual)
    
    If TurnOn Then Application.StatusBar = False Else Application.StatusBar = "Arbejder, vent venligst..."
    
CleanExit:
    Stack.Pop
    Exit Sub
ErrorHandler:
    If Error.handle("AppWorkbook.ToggleOptimization", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Public Sub AddNote(sheet As Worksheet, ByVal notepadName As String, note As String, Optional fit As Boolean = False)
    On Error GoTo ErrorHandler
    Stack.Push "AppWorkbook.AddNote"
    
    Dim rng As Range
    Dim targetCell As Range
    Dim r As Long, c As Long
    Dim findCheck As Range
    Dim mergeRng As Range
    
    On Error Resume Next
    Set rng = sheet.Range(notepadName)
    On Error GoTo 0

    If rng Is Nothing Then
        MsgBox "Named range '" & notepadName & "' not found on sheet " & sheet.name, vbExclamation
        Exit Sub
    End If
    
    Set findCheck = rng.Find(What:=note, LookIn:=xlValues, LookAt:=xlWhole, SearchOrder:=xlByRows, MatchCase:=False)
    
    If Not findCheck Is Nothing Then
        Exit Sub
    End If

    c = 1
    
    Do While c <= rng.Columns.count
        r = 1
        Do While r <= rng.Rows.count
            Set targetCell = rng.cells(r, c)
        
            If IsEmpty(targetCell.value) Or Trim(targetCell.value) = "" Then
                GoTo CellFound
            End If
            
            r = r + targetCell.MergeArea.Rows.count
        Loop
        
        c = c + rng.cells(1, c).MergeArea.Columns.count
        Set targetCell = Nothing
    Loop

CellFound:
    If Not targetCell Is Nothing Then
        targetCell.value = note
        
        If fit = True Then
            Set mergeRng = targetCell.MergeArea
            
            If targetCell.MergeCells Then
                With mergeRng
                    .UnMerge
                    .WrapText = True
                    .HorizontalAlignment = xlGeneral
                End With
                
                targetCell.EntireRow.autofit
                
                With mergeRng
                    .Merge
                    .HorizontalAlignment = xlCenter
                    .VerticalAlignment = xlCenter
                End With
            Else
                With targetCell
                    .WrapText = True
                    .HorizontalAlignment = xlCenter
                    .VerticalAlignment = xlCenter
                    .EntireRow.autofit
                End With
            End If
        End If
    Else
        MsgBox "All notepad areas in '" & notepadName & "' are full!", vbInformation
    End If
    
CleanExit:
    Stack.Pop
    Exit Sub
ErrorHandler:
    If Error.handle("AppWorkbook.AddNote", Err.description, Err.number, Erl) Then Resume CleanExit
End Sub

Sub AddShortcuts()
    Application.OnKey "^+a", "AddDevNumbers"
    Application.OnKey "^+r", "RemoveDevNumbers"
End Sub
