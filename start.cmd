@echo off
REM ---------------------------------------------------------------------------
REM  Bitburner-Bruecke starten - nach jedem Rechnerneustart einmal ausfuehren.
REM
REM  WAS DIESE DATEI TUT UND WAS NICHT
REM
REM  Sie startet EIN Ding: die Bruecke, in einer Neustartschleife
REM  (sync\bridge-start.cmd). Skripte ins Spiel schieben, Spielstand sichern,
REM  Auftraege absetzen, Dashboard auf Port 8795.
REM
REM  DER WAECHTER IST WEG (04.09.2026, Auftrag 12).
REM
REM  `tools/wache.js` wurde hier bis heute mitgestartet. Der Auftrag verbietet
REM  ihn namentlich, und der Grund steht in der Erfahrung: eine Wache, die
REM  Freigaben anfordert und Push-Nachrichten schickt, hat in diesem Projekt
REM  mehr Schaden angerichtet als verhindert - ein Fehlausloeser kostete an
REM  einem Tag 6,50 USD, und der ntfy-Kanal ist seit dem 31.08.2026 auf Erics
REM  ausdrueckliche Ansage dauerhaft abgeschaltet.
REM
REM  An seine Stelle tritt der Waechter IM SPIEL (`src/guard.js`) - er sieht
REM  mehr, kostet nichts und kann handeln statt nur zu rufen. Und die
REM  Neustartschleife faengt genau den Fall ab, fuer den die alte Wache
REM  gebaut war: eine gestorbene Bruecke.
REM
REM  Das SPIEL selbst braucht beides nicht. Bitburner laeuft im Browser, und
REM  beim Laden der Seite stellt die Engine alle laufenden Skripte selbst
REM  wieder her (NetscriptWorker.ts:218 loadAllRunningScripts) und verrechnet
REM  dabei die Offline-Zeit. Der Autopilot laeuft also von allein weiter,
REM  sobald der Tab offen ist - die Bruecke ist zum Zusehen, Sichern und
REM  Eingreifen da, nicht zum Spielen.
REM
REM  REIHENFOLGE NACH EINEM NEUSTART
REM    1. Diese Datei starten (oder den Autostart-Eintrag, siehe unten).
REM    2. Bitburner im Browser oeffnen.
REM  Die Bruecke wartet, bis sich das Spiel meldet; sie prueft die Verbindung,
REM  sichert einmal und schiebt erst dann.
REM
REM  DAUERHAFT: eine Verknuepfung auf sync\bridge-start.cmd in
REM    %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\
REM  Das ist Erics Handgriff - schtasks braucht Administrator.
REM ---------------------------------------------------------------------------

cd /d "%~dp0"

call sync\bridge-start.cmd
