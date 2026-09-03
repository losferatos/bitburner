@echo off
REM ===========================================================================
REM  Baut Bitburner v3.0.1 fuer den Pruefstand.
REM
REM  reference/v301 ist ein Git-Checkout auf Tag v3.0.1 (Commit 3162fd2) und
REM  MUSS einer bleiben: webpack.config.js ruft `git rev-parse` und scheitert
REM  ohne .git-Verzeichnis.
REM
REM  Zwei getrennte Baustaende, weil sie zwei Zwecke haben:
REM    production  -> Port 8799, verhaelt sich wie das echte Spiel
REM    development -> Port 8798, hat globalThis.Bitburner und das Dev-Menue
REM                   (Geld, RAM, SF-Level, Sleeves, Time skip) - damit werden
REM                   die Fixtures der Testmatrix gebaut
REM
REM  Zwei Origins bedeuten zwei getrennte IndexedDBs. Das ist der Grund fuer die
REM  Trennung: ein Testlauf darf den Datenbestand des anderen nicht sehen.
REM
REM  CPU-Deckel: Eric hat am 05.08.2026 darum gebeten, rechenintensive Laeufe auf
REM  etwa 4 von 12 Kernen zu begrenzen - sonst dreht der Luefter hoch. Der
REM  Aufrufer setzt Affinitaet und Prioritaet, siehe pruefstand/build-start.ps1.
REM ===========================================================================

cd /d "%~dp0..\reference\v301"

echo [%TIME%] npm ci beginnt
call npm ci --no-audit --no-fund
if errorlevel 1 (
  echo [%TIME%] FEHLER npm ci
  exit /b 1
)
echo [%TIME%] npm ci fertig

echo [%TIME%] webpack production beginnt
call npx webpack --mode production
if errorlevel 1 (
  echo [%TIME%] FEHLER webpack production
  exit /b 2
)
echo [%TIME%] webpack production fertig

echo [%TIME%] ALLES FERTIG
exit /b 0
