@echo off
REM ===========================================================================
REM  Baut Bitburner v3.0.1 als ENTWICKLUNGSSTAND fuer den Pruefstand.
REM
REM  Warum ein zweiter Build: der Entwicklungsstand traegt globalThis.Bitburner
REM  und das Dev-Menue (DevMenu.tsx). Damit werden die Fixtures der Testmatrix
REM  gebaut - Geld, home-RAM, Source-File-Stufen, Sleeve-Zahl, Zeitsprung.
REM  Ohne diese Griffe liesse sich ein Kaltstart auf 32 GB oder ein BitNode 8
REM  mit 250 Mio Startgeld nur erspielen, nicht herstellen.
REM
REM  Die Ausgabe landet im SELBEN dist-Ordner wie der Produktionsstand. Deshalb
REM  wird der Produktionsstand vorher zur Seite gelegt und hinterher
REM  zurueckgeholt: zwei Origins (8799 prod, 8798 dev) brauchen zwei Baeume,
REM  sonst zeigen beide Ports denselben Stand und die Trennung ist nur
REM  behauptet.
REM ===========================================================================

cd /d "%~dp0..\reference\v301"

if not exist "..\v301-dev" mkdir "..\v301-dev"

echo [%TIME%] Produktionsstand sichern
if exist dist-prod rmdir /s /q dist-prod
if exist dist ren dist dist-prod
if exist index.html copy index.html index-prod.html > nul

echo [%TIME%] webpack development beginnt
call npx webpack --mode development
if errorlevel 1 (
  echo [%TIME%] FEHLER webpack development - Produktionsstand wird zurueckgeholt
  if exist dist rmdir /s /q dist
  if exist dist-prod ren dist-prod dist
  if exist index-prod.html move /y index-prod.html index.html > nul
  exit /b 2
)

echo [%TIME%] Entwicklungsstand nach ..\v301-dev verschieben
if exist "..\v301-dev\dist" rmdir /s /q "..\v301-dev\dist"
move dist "..\v301-dev\dist" > nul
copy index.html "..\v301-dev\index.html" > nul

echo [%TIME%] Produktionsstand zurueckholen
if exist dist-prod ren dist-prod dist
if exist index-prod.html move /y index-prod.html index.html > nul

echo [%TIME%] FERTIG - dev unter reference\v301-dev, prod unter reference\v301
exit /b 0
