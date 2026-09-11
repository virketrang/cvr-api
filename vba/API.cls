VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "API"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

Function getRateOfReturnOnCapital() As Double
    On Error GoTo ErrorHandler
    Stack.Push "API.getRateOfReturnOnCapital()"
    
    Dim apiResponse As Variant
    Dim rateOfReturn As Double
    Dim value As String
    
    Set apiResponse = HTTPClient.Fetch("/api/rate-of-return-on-capital")
    
    If apiResponse Is Nothing Then
        Toast.Show "API'en returnerede ingen data for kapitalafkastsatsen.", "bottom-right", "error", 8
        GoTo CleanExit
    End If
    
    If Not IsObject(apiResponse) Or Not apiResponse.Exists("value") Then
         Toast.Show "Fejl: API-svaret er ikke det forventede objekt {value, year}.", "bottom-right", "error", 8
        GoTo CleanExit
    End If
    
    value = CStr(apiResponse("value"))
    
    If Not IsNumeric(value) Then
        Toast.Show "Fejl: 'value'-feltet indeholder ikke et tal: " & value, "bottom-right", "error", 8
        GoTo CleanExit
    End If
    
    rateOfReturn = CDbl(Replace(value, ".", Application.DecimalSeparator))
    
    getRateOfReturnOnCapital = rateOfReturn
    
CleanExit:
  Stack.Pop
  Exit Function

ErrorHandler:
  If Error.handle("API.getRateOfReturnOnCapital()", Err.description, Err.number, Erl) Then Resume CleanExit
End Function

' Den kapitalafkastsats, der var den senest offentliggjorte på overdragelsesdatoen
' (boafgiftslovens § 12 a). Returnerer satsen som decimalbrøk (fx 0.04 for 4 %)
' eller Null, hvis API'en ikke kunne svare — så 0 % ikke forveksles med en fejl.
' Viser serverens forbehold (fx at registret mangler den nyeste sats) som toast.
Function getRateOfReturnOnCapitalAtDate(ByVal transferDate As Date) As Variant
    On Error GoTo ErrorHandler
    Stack.Push "API.getRateOfReturnOnCapitalAtDate()"

    Dim apiResponse As Variant
    Dim value As String

    getRateOfReturnOnCapitalAtDate = Null

    Set apiResponse = HTTPClient.Fetch("/api/rate-of-return-on-capital/" & Format$(transferDate, "yyyy-mm-dd"))

    If apiResponse Is Nothing Then
        ' HTTPClient har allerede vist serverens fejlbesked (fx dato før registrets start).
        GoTo CleanExit
    End If

    If Not IsObject(apiResponse) Or Not apiResponse.Exists("value") Then
        Toast.Show "Fejl: API-svaret er ikke det forventede objekt {value, year, publishedAt, ...}.", "bottom-right", "error", 8
        GoTo CleanExit
    End If

    value = CStr(apiResponse("value"))

    If Not IsNumeric(value) Then
        Toast.Show "Fejl: 'value'-feltet indeholder ikke et tal: " & value, "bottom-right", "error", 8
        GoTo CleanExit
    End If

    If apiResponse.Exists("warning") Then
        If Not IsNull(apiResponse("warning")) Then
            Toast.Show CStr(apiResponse("warning")), "bottom-right", "warning", 12
        End If
    End If

    getRateOfReturnOnCapitalAtDate = CDbl(Replace(value, ".", Application.DecimalSeparator))

CleanExit:
  Stack.Pop
  Exit Function

ErrorHandler:
  If Error.handle("API.getRateOfReturnOnCapitalAtDate()", Err.description, Err.number, Erl) Then Resume CleanExit
End Function

Function getAPIVersion() As String
    On Error GoTo ErrorHandler
    Stack.Push "API.getAPIVersion()"
    
    Dim response As Variant
    
    Set response = HTTPClient.Fetch("/api/version")
    
    If response Is Nothing Then
        Toast.Show "Fejl: API'en returnerede ingen data eller en HTTP-fejl.", "bottom-right", "error", 8
        GoTo CleanExit
    End If
    
    If Not IsObject(response) Or Not response.Exists("version") Then
        Toast.Show "Fejl: API-svaret er ikke det forventede objekt eller mangler 'version'-nøglen.", "bottom-right", "error", 8
        GoTo CleanExit
    End If
    
    getAPIVersion = CStr(response("version"))
    
CleanExit:
  Stack.Pop
  Exit Function

ErrorHandler:
  If Error.handle("API.getAPIVersion()", Err.description, Err.number, Erl) Then Resume CleanExit
End Function

Function getCorporateGroup(cvr As String) As Object
    On Error GoTo ErrorHandler
    Stack.Push "API.getCorporateGroup()"

    Dim corporateGroupResponse As Object

    Set corporateGroupResponse = HTTPClient.Fetch("/api/corporate-groups/" & cvr & "/flattened")

    If corporateGroupResponse Is Nothing Then
        MsgBox "Fejl: Kunne ikke hente et gyldigt svar fra API'en for virksomhedsgruppen. Kontroller CVR-nummeret og netværksforbindelsen.", _
               vbCritical, "API Fejl"
        GoTo CleanExit
    End If

    If Not (IsObject(corporateGroupResponse) And TypeName(corporateGroupResponse) = "Collection") Then
        MsgBox "Fejl: API-svaret er ikke den forventede liste af virksomhedsobjekter.", _
               vbExclamation, "API Fejl: Uventet format"
        GoTo CleanExit
    End If

    Set getCorporateGroup = corporateGroupResponse

CleanExit:
  Stack.Pop
  Exit Function

ErrorHandler:
  If Error.handle("API.getCorporateGroup()", Err.description, Err.number, Erl) Then Resume CleanExit
End Function

' Sends the complete project request (formData + Settings-sheet configuration)
' to the server and returns the fully resolved project model. All business
' rules run server-side; the workbook only renders the response.
Public Function ResolveProject(ByVal body As String) As Object
    On Error GoTo ErrorHandler
    Stack.Push "API.ResolveProject()"

    Dim response As Object

    Set response = HTTPClient.Fetch("/api/project-resolutions", 240, HTTP_POST, body)

    If response Is Nothing Then
        ' HTTPClient har allerede vist en fejl-toast med serverens besked.
        GoTo CleanExit
    End If

    If Not IsObject(response) Or Not response.Exists("companies") Then
        Toast.Show "Fejl: API-svaret er ikke det forventede projektobjekt (mangler 'companies').", _
                   "bottom-right", "error", 8
        GoTo CleanExit
    End If

    Set ResolveProject = response

CleanExit:
    Stack.Pop
    Exit Function

ErrorHandler:
    If Error.handle("API.ResolveProject()", Err.description, Err.number, Erl) Then Resume CleanExit
End Function
