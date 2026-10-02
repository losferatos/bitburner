@echo off
rem Dashboard: oeffnet die Auswertungen im Browser (meist http://localhost:8501; ist der
rem Port belegt, nimmt Streamlit den naechsten freien und nennt die Adresse unten im Fenster).
rem Liest die Datenbank nur und darf offen bleiben, waehrend ein Crawl laeuft.
rem Beenden: dieses Fenster schliessen oder Strg+C druecken.
setlocal
cd /d "%~dp0"
call "%~dp0_umgebung.bat"
if errorlevel 1 goto :ende

"%VENV_PY%" -m streamlit run src\truthtracker\dashboard\app.py --browser.gatherUsageStats false %*

:ende
echo.
pause
endlocal
