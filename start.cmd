@echo off
REM ---------------------------------------------------------------------------
REM  Bitburner-Bruecke starten - nach jedem Rechnerneustart einmal ausfuehren.
REM
REM  WAS DIESE DATEI TUT UND WAS NICHT
REM
REM  Sie startet NUR die Bruecke (sync/bridge.js). Die braucht es fuer die
REM  Steuerung von aussen: Skripte ins Spiel schieben, Spielstand lesen,
REM  Auftraege absetzen, das Dashboard auf Port 8795.
REM
REM  Das SPIEL selbst braucht sie nicht. Bitburner laeuft im Browser, und beim
REM  Laden der Seite stellt die Engine alle laufenden Skripte selbst wieder her
REM  (NetscriptWorker.ts:218 loadAllRunningScripts) und verrechnet dabei die
REM  Offline-Zeit. Der Autopilot laeuft also von allein weiter, sobald der Tab
REM  offen ist - die Bruecke ist zum Zusehen und Eingreifen da, nicht zum
REM  Spielen.
REM
REM  REIHENFOLGE NACH EINEM NEUSTART
REM    1. Bitburner-Tab im Browser oeffnen  -> Spiel laeuft weiter
REM    2. Diese Datei doppelklicken         -> Steuerung ist wieder da
REM    3. node tools/lage.js                -> nachsehen, ob alles steht
REM ---------------------------------------------------------------------------

cd /d "%~dp0"

echo.
echo   Bitburner-Bruecke
echo   -----------------
echo   RFA-Server:  Port 12525  (das Spiel verbindet sich hierher)
echo   Dashboard:   http://localhost:8795
echo.
echo   Fenster offen lassen. Zum Beenden: Strg+C.
echo.

node sync\bridge.js

REM Faellt die Bruecke aus, bleibt das Fenster stehen, damit die Fehlermeldung
REM lesbar ist. Ein Fenster, das sich sofort schliesst, verschweigt den Grund.
echo.
echo   Die Bruecke hat sich beendet. Meldung oben lesen.
pause
