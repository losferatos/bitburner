@echo off
REM ---------------------------------------------------------------------------
REM  Die Aufsicht in den Autostart legen - einmal ausfuehren, dann nie wieder.
REM
REM  WOZU
REM
REM  Bis zum 27.08.2026 haing der ganze Aufbau an einem Doppelklick: Nach jedem
REM  Rechnerneustart musste jemand start.cmd starten, sonst liefen weder
REM  Bruecke noch Waechter. Eine Fremdpruefung hat an dem Tag die Frage
REM  gestellt, die vorher niemand gestellt hatte - wer repariert das System,
REM  wenn es nachts um drei bricht? - und die Antwort war: niemand.
REM
REM  Diese Datei legt eine Verknuepfung in den Autostart-Ordner. Von da an
REM  startet Windows beim Anmelden `tools/aufsicht.js --dauer`, und das prueft
REM  alle zehn Minuten, ob Bruecke, Waechter und Spiel-Tab leben - und stellt
REM  sie her, wenn nicht.
REM
REM  WARUM NICHT DIE AUFGABENPLANUNG
REM
REM  `Register-ScheduledTask` verlangt Adminrechte, die hier nicht da sind, und
REM  `schtasks` wird vom Berechtigungsfilter geblockt. Der Autostart-Ordner
REM  gehoert dem Benutzer und braucht keins von beidem. Er feuert nur beim
REM  Anmelden statt alle zehn Minuten - deshalb bringt das Skript seine
REM  Wiederholung selbst mit.
REM
REM  WAS ER NICHT TUT
REM
REM  Die Claude-Loops startet er NICHT. Die brauchen eine Sitzung und ein
REM  Kontingent; das bleibt eine bewusste Entscheidung von Eric. Und einen
REM  Bitburner-Tab oeffnet er nur, wenn nachweislich keiner offen ist - zwei
REM  Tabs auf demselben Spielstand ueberschreiben sich gegenseitig.
REM ---------------------------------------------------------------------------

setlocal
set "PROJEKT=%~dp0.."
for %%I in ("%PROJEKT%") do set "PROJEKT=%%~fI"
set "ZIEL=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Bitburner-Aufsicht.cmd"

echo.
echo   Projektordner : %PROJEKT%
echo   Autostart     : %ZIEL%
echo.

REM Ein kleines Startskript statt einer .lnk-Verknuepfung: Es laesst sich
REM lesen, versionieren und von Hand aufrufen, und es braucht kein
REM Skripting-Objekt zum Anlegen.
>  "%ZIEL%" echo @echo off
>> "%ZIEL%" echo REM Automatisch erzeugt von tools/autostart-einrichten.cmd
>> "%ZIEL%" echo REM Startet die Bitburner-Aufsicht im Dauerlauf, unsichtbar.
>> "%ZIEL%" echo cd /d "%PROJEKT%"
>> "%ZIEL%" echo start "" /min node tools\aufsicht.js --dauer

if exist "%ZIEL%" (
  echo   OK - eingerichtet. Ab dem naechsten Anmelden laeuft die Aufsicht.
  echo.
  echo   Jetzt sofort starten? Dann diese Zeile ausfuehren:
  echo     start "" /min node "%PROJEKT%\tools\aufsicht.js" --dauer
  echo.
  echo   Wieder entfernen: die Datei loeschen.
  echo     del "%ZIEL%"
) else (
  echo   FEHLGESCHLAGEN - der Autostart-Ordner war nicht beschreibbar.
)
echo.
endlocal
