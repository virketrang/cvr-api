VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Formula"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

Public Sub Reset(dest As Worksheet, src As Worksheet, ByVal nm As String)
    dest.Range(nm).Formula = src.Range(nm).Formula
End Sub

Public Function Link(ByVal ovName As String, ByVal src As Range, ByVal rowIdx As Long, Optional ByVal fallback As String = """""", Optional ByVal suffix As String = "") As String
    Link = "=IFERROR(" & ovName & src.cells(rowIdx, 1).Address & "," & fallback & ")" & suffix
End Function

Public Function Combine(ByVal f1 As String, ByVal f2 As String) As String
    Dim a As String: a = f1
    Dim b As String: b = f2
    If Left(a, 1) = "=" Then a = Mid(a, 2)
    If Left(b, 1) = "=" Then b = Mid(b, 2)

    If a <> "" And b <> "" Then
        Combine = "=" & a & "+" & b
    ElseIf a <> "" Then
        Combine = "=" & a
    ElseIf b <> "" Then
        Combine = "=" & b
    Else
        Combine = ""
    End If
End Function

' Rebuilds the visible "=a+b"-formula from the component list the server returns
' (each component is a Dictionary with "concept", "label" and "value"). This is
' the client half of the old Formula.Create: the server decides WHICH values are
' summed; this only renders them, with the same Abs/parenthesis/factor rules.
Public Function FromComponents( _
    components As Object, _
    operation As String, _
    Optional ByVal factor As String = "1", _
    Optional ByVal absolute As Boolean = True _
) As String
    On Error GoTo ErrorHandler
    Stack.Push "Formula.FromComponents"

    FromComponents = ""

    If components Is Nothing Then GoTo CleanExit

    Dim parts() As String
    Dim count As Long: count = -1
    Dim component As Object

    For Each component In components
        Dim v As Double: v = CDbl(component("value"))
        If v <> 0 Then
            count = count + 1
            ReDim Preserve parts(0 To count)

            If absolute Then
                parts(count) = CStr(Abs(v))
            ElseIf v < 0 Then
                parts(count) = "(" & CStr(v) & ")"
            Else
                parts(count) = CStr(v)
            End If
        End If
    Next component

    If count = -1 Then GoTo CleanExit

    Dim body As String
    If count = 0 Then
        body = parts(0)
    Else
        body = Join(parts, operation)
    End If

    If factor <> "1" Then
        FromComponents = "=(" & body & ")*" & Replace(CStr(factor), ".", ",")
    Else
        FromComponents = "=" & body
    End If

CleanExit:
    Stack.Pop
    Exit Function

ErrorHandler:
    If Error.handle("Formula.FromComponents", Err.description, Err.number, Erl) Then Resume CleanExit
End Function
