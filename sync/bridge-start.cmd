@echo off
setlocal
REM ===========================================================================
REM  Neustartschleife fuer die Bitburner-Bruecke (LIVE), mit Obergrenze.
REM
REM  WARUM ES DIESE DATEI GIBT (04.09.2026)
REM  Die Bruecke ist der einzige Prozess ausserhalb des Spiels. Sie sichert den
REM  Spielstand, sie schiebt Code nach, sie faellt die Urteile. Am 03.09.2026
REM  starb sie zweimal an einem Tag, und seit dem Entfernen des alten
REM  Autostarts am 02.09. gab es niemanden, der sie wieder anwarf: der Bot lief
REM  weiter, aber ohne Sicherung und ohne Aussensicht.
REM
REM  Diese Schleife ist bewusst das Einfachste, was funktioniert. Kein
REM  Aufseher-Skript, kein headless-claude, keine Push-Nachrichten - die drei
REM  haben in diesem Projekt jeweils mehr Schaden angerichtet als verhindert
REM  (ein Fehlausloeser kostete 6,50 USD an einem Tag).
REM
REM  OBERGRENZE (B05, 14.11.2026)
REM  Hoechstens BRIDGE_START_MAX Neustarts je Stunde (Vorgabe 5). Der Zaehler
REM  steht in sync\neustart-grenze.js, nicht hier: Batch kann keine Uhrzeiten
REM  rechnen, ohne vom Landesformat abzuhaengen. Ist die Grenze erreicht, ENDET
REM  die Schleife und schreibt data\bridge-start-gestoppt.txt - die Bruecke ist
REM  dann AUS und das ist sichtbar. Eine Bruecke, die jede Minute stirbt, hat
REM  einen Fehler, den ein zwoelfter Neustart nicht behebt.
REM  Anders einstellen: vor dem Start  set BRIDGE_START_MAX=8
REM  Das Protokoll steht in data\bridge-start.log (ISO-Zeit, Tab, Text).
REM
REM  KEIN AUTOSTART. Eric hat den Eintrag in den Windows-Autostart abgelehnt
REM  (23.09. und 03.11.2026). Diese Datei startet nichts von selbst; sie wird
REM  von Hand oder per WMI gestartet:
REM    Start-Process -FilePath sync\bridge-start.cmd -WindowStyle Minimized
REM    cmd /c sync\bridge-start.cmd            (WMI Win32_Process.Create)
REM  Sie ueberlebt keine Abmeldung und keinen Rechnerneustart, aber jeden
REM  Absturz der Bruecke - bis zur Obergrenze.
REM
REM  Beenden: das Fenster schliessen. Unter WMI (ohne Fenster): den cmd.exe und
REM  seinen node-Kindprozess beenden.
REM  Die Wartezeit steht als ping, nicht als timeout: timeout bricht ohne
REM  Konsole sofort ab (WMI-Start), und die Schleife drehte dann ohne Pause.
REM ===========================================================================

cd /d "%~dp0.."
if "%BRIDGE_START_MAX%"=="" set BRIDGE_START_MAX=5

echo.
echo   Bitburner-Bruecke  [LIVE]  - Neustartschleife, hoechstens %BRIDGE_START_MAX% Neustarts je Stunde
echo.
node sync\neustart-grenze.js --start

:schleife
REM Die Ausgabe der Bruecke geht nach %TEMP%\bridge-live.log (nicht nach data\:
REM ein offenes Handle dort blockiert das Verschieben von data\ in der
REM Lauf-2-Uebergabe). Unter WMI gibt es keine Konsole - ohne Umleitung waeren
REM Startfehler (Exit 3) und ihre Gruende nirgends lesbar (Skeptiker 14.11.2026).
node sync\bridge.js --instance LIVE >> "%TEMP%\bridge-live.log" 2>&1
set RC=%ERRORLEVEL%
node sync\neustart-grenze.js --log "Bruecke beendet mit Code %RC%"

if "%RC%"=="2" goto :portbelegt
if "%RC%"=="3" goto :startfehler

node sync\neustart-grenze.js --max %BRIDGE_START_MAX%
if not "%ERRORLEVEL%"=="0" goto :grenze

echo.
echo   Bruecke beendet mit Code %RC% - Neustart in 10 Sekunden.
echo.
ping -n 11 127.0.0.1 > nul
goto :schleife

:portbelegt
echo.
echo   Port belegt - es laeuft bereits eine Bruecke. Diese Schleife endet.
echo.
node sync\neustart-grenze.js --log "Schleife endet: Port belegt, es laeuft schon eine Bruecke"
goto :ende

:startfehler
echo.
echo   Startfehler - Rolle oder Pfad. Kein Neuversuch: sonst liefe die
echo   Schleife endlos gegen denselben Konfigurationsfehler.
echo.
node sync\neustart-grenze.js --gestoppt "Startfehler (Exit 3): Rolle oder Pfad stimmen nicht, siehe %TEMP%\bridge-live.log"
goto :ende

:grenze
echo.
echo   Obergrenze erreicht oder Zaehler nicht lesbar - die Schleife endet.
echo   Die Bruecke ist AUS. Grund: data\bridge-start-gestoppt.txt
echo.

:ende
endlocal
