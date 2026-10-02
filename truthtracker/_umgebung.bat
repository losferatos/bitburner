@echo off
rem Richtet beim ersten Aufruf die virtuelle Python-Umgebung ein und installiert die
rem Abhaengigkeiten. Spaeter wird nur nachinstalliert, wenn sich requirements.txt aendert.
rem Wird von run_*.bat mit "call" aufgerufen und setzt VENV_PY.

set "TT_ORDNER=%~dp0"
set "VENV_PY=%TT_ORDNER%.venv\Scripts\python.exe"
set "PYTHONPATH=%TT_ORDNER%src"
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

if exist "%VENV_PY%" goto :pruefe_version

echo Erster Start: lege die Python-Umgebung an (dauert ein paar Minuten) ...
where py >nul 2>nul
if not errorlevel 1 (
    py -3 -m venv "%TT_ORDNER%.venv"
) else (
    python -m venv "%TT_ORDNER%.venv"
)
if not exist "%VENV_PY%" (
    echo.
    echo FEHLER: Python wurde nicht gefunden. Bitte Python 3.12 oder neuer von
    echo https://www.python.org/downloads/windows/ installieren ^(Haken bei "Add python.exe to PATH"^)
    echo und danach erneut starten.
    exit /b 1
)

:pruefe_version
"%VENV_PY%" -c "import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)"
if errorlevel 1 (
    echo.
    echo FEHLER: Die Umgebung nutzt eine Python-Version unter 3.12.
    echo Bitte Python 3.12 oder neuer installieren und den Ordner .venv loeschen.
    exit /b 1
)

fc /b "%TT_ORDNER%requirements.txt" "%TT_ORDNER%.venv\requirements.installiert" >nul 2>nul
if not errorlevel 1 goto :fertig

echo Installiere Abhaengigkeiten ...
"%VENV_PY%" -m pip install --disable-pip-version-check -q -r "%TT_ORDNER%requirements.txt"
if errorlevel 1 (
    echo.
    echo FEHLER: Die Abhaengigkeiten liessen sich nicht installieren. Internetverbindung pruefen.
    exit /b 1
)
copy /y "%TT_ORDNER%requirements.txt" "%TT_ORDNER%.venv\requirements.installiert" >nul

:fertig
exit /b 0
