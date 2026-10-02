@echo off
rem Prueft Datenbank, Logs, Temp-Ordner, Browserprofil, Exporte und Spike-Berichte auf Inhaltsreste.
rem Der Bericht nennt nur Ort und Art eines Fundes, nie den Inhalt selbst.
rem Eigene Stichprobe (z. B. ein Satz aus einem echten Post): run_pruefung.bat --abfragen
setlocal
cd /d "%~dp0"
call "%~dp0_umgebung.bat"
if errorlevel 1 goto :ende

"%VENV_PY%" -m truthtracker.pruefung %*

:ende
echo.
pause
endlocal
