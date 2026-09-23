' Startet die Bruecke (sync/bridge.js --instance LIVE) bei der Anmeldung -
' unsichtbar und nur, wenn noch keine laeuft.
'
' WARUM (23.09.2026): Die Bruecke startete nach einem Rechner-Neustart nicht
' von selbst. An diesem Tag dreimal (Windows-Update 02:29, Neustarts 08:22 und
' 09:25) - jedes Mal lief der Bot im Spiel weiter, aber ohne Sicherungen und
' ohne Fernkanal, bis /bb die Bruecke von Hand startete. Der alte Autostart
' Bitburner-Aufsicht.cmd startete die abgeloeste tools/wache.js mit und ist
' weg; dieser hier startet NUR die Bruecke.
'
' Eingerichtet als Kopie im Autostart-Ordner des Benutzers
' (%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup). Entfernen: die
' Kopie dort loeschen.

Option Explicit
Dim wmi, procs, p, shell, dir, tmp
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set procs = wmi.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name='node.exe'")
For Each p In procs
  If Not IsNull(p.CommandLine) Then
    If InStr(p.CommandLine, "sync/bridge.js") > 0 Or InStr(p.CommandLine, "sync\bridge.js") > 0 Then
      WScript.Quit 0
    End If
  End If
Next

Set shell = CreateObject("WScript.Shell")
dir = "C:\Users\erche\Desktop\claude_projecto\bitburner"
tmp = shell.ExpandEnvironmentStrings("%TEMP%")
shell.CurrentDirectory = dir
' 0 = kein Fenster, False = nicht warten
shell.Run "cmd /c node sync/bridge.js --instance LIVE > """ & tmp & "\bridge.log"" 2> """ & tmp & "\bridge.err.log""", 0, False
