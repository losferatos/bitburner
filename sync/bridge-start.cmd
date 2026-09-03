@echo off
REM ===========================================================================
REM  Neustartschleife fuer die Bitburner-Bruecke (LIVE).
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
REM  EINTRAGEN IN DEN AUTOSTART ist Erics Handgriff, nicht der von Claude:
REM    %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\
REM  Eine Verknuepfung auf DIESE Datei genuegt. schtasks braucht Administrator.
REM
REM  Solange der Eintrag fehlt, laeuft diese Datei abgekoppelt per
REM    Start-Process -FilePath sync\bridge-start.cmd -WindowStyle Minimized
REM  Sie ueberlebt dann zwar keine Abmeldung, aber jeden Absturz der Bruecke.
REM ===========================================================================

cd /d "%~dp0.."

echo.
echo   Bitburner-Bruecke  [LIVE]  - Neustartschleife
echo   Beenden: dieses Fenster schliessen
echo.

:schleife
node sync\bridge.js --instance LIVE
set RC=%ERRORLEVEL%

if "%RC%"=="2" (
  echo.
  echo   Port belegt - es laeuft bereits eine Bruecke. Diese Schleife endet.
  echo.
  goto :ende
)
if "%RC%"=="3" (
  echo.
  echo   Startfehler ^(Rolle oder Pfad^). Kein Neuversuch - sonst laeuft die
  echo   Schleife endlos gegen denselben Konfigurationsfehler.
  echo.
  goto :ende
)

echo.
echo   Bruecke beendet mit Code %RC% - Neustart in 10 Sekunden.
echo.
timeout /t 10 /nobreak > nul
goto :schleife

:ende
