@echo off
rem Ein Crawl-Lauf: holt neue Posts, misst Engagement, prueft Duplikate und Loeschungen.
rem Zeigt Cloudflare eine Pruefung, oeffnet sich ein Browserfenster: dort loesen.
setlocal
cd /d "%~dp0"
call "%~dp0_umgebung.bat"
if errorlevel 1 goto :ende

"%VENV_PY%" -m truthtracker crawl %*

:ende
echo.
pause
endlocal
