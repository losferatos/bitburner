@echo off
rem Fuehrt alle automatischen Tests aus (synthetische Daten, kein Zugriff auf Truth Social).
setlocal
cd /d "%~dp0"
call "%~dp0_umgebung.bat"
if errorlevel 1 goto :ende

"%VENV_PY%" -m pytest %*

:ende
echo.
pause
endlocal
