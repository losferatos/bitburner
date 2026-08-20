@echo off
REM ---------------------------------------------------------------------------
REM  Die Nachtsteuerung - vor dem Schlafengehen doppelklicken.
REM
REM  WAS SIE TUT
REM
REM  Sie haelt die Faktionsarbeit dort, wo die naechste fehlende
REM  Augmentierung am fruehesten faellt, und laesst kaufen, sobald eine in
REM  Reichweite kommt. Ohne sie sammelt der Bot Reputation bei EINER Faktion,
REM  bis dort alles abgedeckt ist - und arbeitet danach stundenlang ins Leere.
REM
REM  WAS SIE NICHT TUT
REM
REM  Keinen Reset, kein NeuroFlux. Beides von Hand. Der Reset hat sieben
REM  Schritte, und das Aktiendepot muss vorher liquidiert werden, sonst ist es
REM  ersatzlos weg.
REM
REM  VORAUSSETZUNG: Die Bruecke muss laufen (start.cmd) und der Bitburner-Tab
REM  muss offen sein. Ohne beides passiert nichts - sie meldet das dann auch.
REM
REM  Das Fenster offen lassen. Zum Beenden: Strg+C.
REM ---------------------------------------------------------------------------

cd /d "%~dp0"

echo.
echo   Bitburner-Nachtsteuerung
echo   ------------------------
echo   Sie wechselt die Arbeitsfaktion und kauft Augmentierungen.
echo   Protokoll: nightshift\log\
echo.

node tools\nightshift.js

echo.
echo   Die Nachtsteuerung hat sich beendet. Meldung oben lesen.
pause
