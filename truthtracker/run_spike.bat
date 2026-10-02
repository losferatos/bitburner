@echo off
rem Zugriffs-Spike: prueft, welcher Weg zu Truth Social von diesem Rechner aus funktioniert.
rem Schreibt einen Bericht nach docs\zugriff-messungen\ (nur Feldnamen und Statuscodes).
setlocal
cd /d "%~dp0"
call "%~dp0_umgebung.bat"
if errorlevel 1 goto :ende

"%VENV_PY%" -m truthtracker.spike %*

:ende
echo.
pause
endlocal
