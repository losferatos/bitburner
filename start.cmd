@echo off
REM ---------------------------------------------------------------------------
REM  Bitburner-Bruecke und Waechter starten - nach jedem Rechnerneustart einmal
REM  ausfuehren.
REM
REM  WAS DIESE DATEI TUT UND WAS NICHT
REM
REM  Sie startet ZWEI Dinge:
REM    sync/bridge.js   die Bruecke - Skripte ins Spiel schieben, Spielstand
REM                     lesen, Auftraege absetzen, Dashboard auf Port 8795
REM    tools/wache.js   den Waechter - schaut alle drei Minuten nach dem Bot,
REM                     schweigt wenn alles laeuft, schickt bei einer Stoerung
REM                     eine ntfy-Nachricht aufs Handy
REM
REM  Das SPIEL selbst braucht beides nicht. Bitburner laeuft im Browser, und
REM  beim Laden der Seite stellt die Engine alle laufenden Skripte selbst
REM  wieder her (NetscriptWorker.ts:218 loadAllRunningScripts) und verrechnet
REM  dabei die Offline-Zeit. Der Autopilot laeuft also von allein weiter,
REM  sobald der Tab offen ist - die Bruecke ist zum Zusehen und Eingreifen da,
REM  nicht zum Spielen.
REM
REM  REIHENFOLGE NACH EINEM NEUSTART
REM    1. Bitburner-Tab im Browser oeffnen  -> Spiel laeuft weiter
REM    2. Diese Datei doppelklicken         -> Steuerung und Waechter sind da
REM    3. http://localhost:8795 aufmachen   -> nachsehen, ob alles steht
REM ---------------------------------------------------------------------------

cd /d "%~dp0"

echo.
echo   Bitburner
echo   ---------
echo   RFA-Server:  Port 12525  (das Spiel verbindet sich hierher)
echo   Dashboard:   http://localhost:8795
echo   Waechter:    eigenes Fenster, meldet Stoerungen per ntfy
echo.
echo   Fenster offen lassen. Zum Beenden: Strg+C.
echo.

REM  Der Waechter kommt in ein EIGENES Fenster und laeuft unabhaengig weiter.
REM
REM  Er wird bewusst NICHT mitbeendet, wenn dieses Fenster zugeht. Ein
REM  Waechter, der zusammen mit dem stirbt, was er bewachen soll, ist genau
REM  die blinde Wache, die am 20.08.2026 fuenf Stunden Stillstand nicht
REM  bemerkt hat. Der Preis dafuer: Wer die Bruecke absichtlich beendet,
REM  bekommt rund sechs Minuten spaeter eine Push-Nachricht "Bruecke
REM  antwortet nicht". Das ist gewollt - lieber eine erwartbare Meldung zuviel
REM  als eine echte Stoerung zuwenig. Den Waechter beendet man ueber sein
REM  eigenes Fenster.
REM
REM  Die zehn Sekunden Vorlauf geben der Bruecke Zeit, den Port zu oeffnen -
REM  sonst prueft der Waechter einmal ins Leere. Ein Fehlalarm entstuende
REM  daraus zwar nicht (dafuer braucht es zwei Pruefungen in Folge), aber eine
REM  irrefuehrende Zeile im Wachfenster.
start "Bitburner-Waechter" /min cmd /c "timeout /t 10 /nobreak >nul & node tools\wache.js"

node sync\bridge.js

REM Faellt die Bruecke aus, bleibt das Fenster stehen, damit die Fehlermeldung
REM lesbar ist. Ein Fenster, das sich sofort schliesst, verschweigt den Grund.
echo.
echo   Die Bruecke hat sich beendet. Meldung oben lesen.
echo   Der Waechter laeuft in seinem eigenen Fenster weiter und meldet das
echo   gleich per Push. Wer das nicht will, schliesst auch dieses Fenster.
pause
