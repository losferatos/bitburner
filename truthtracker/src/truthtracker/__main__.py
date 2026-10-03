"""Kommandozeile: ``python -m truthtracker <befehl>``.

Befehle:
  crawl      einen Lauf ausführen (wie run_crawl.bat)
  pruefen    nach Inhaltsresten suchen (wie run_pruefung.bat)
  spike      Zugriffs-Spike (wie run_spike.bat)
  dashboard  Dashboard starten (wie run_dashboard.bat)
  export     alle Posts (nur Metadaten) als CSV nach exporte/ schreiben
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from truthtracker import pfade


def _crawl(argv: list[str]) -> int:
    from truthtracker import crawler, konfig, logbuch

    parser = argparse.ArgumentParser(prog="truthtracker crawl", description="Einen Crawl-Lauf ausführen.")
    parser.add_argument("--config", type=Path, help="Pfad zur config.toml (Standard: im Projektordner)")
    parser.add_argument("--weg", choices=["auto", "curl", "browser"], help="Zugriffsweg nur für diesen Lauf")
    parser.add_argument("--browser", help="Browser nur für diesen Lauf (opera, chrome, edge oder Pfad)")
    args = parser.parse_args(argv)
    try:
        einstellungen = konfig.lade(args.config)
    except konfig.KonfigFehler as fehler:
        print(f"Fehler in der Konfiguration: {fehler}")
        return 1
    if args.weg:
        einstellungen.zugriff.weg = args.weg
    if args.browser:
        einstellungen.zugriff.browser = args.browser
    logdatei = logbuch.richte_ein("crawl")
    print(f"Truth-Social-Tracker: Lauf startet (Konto @{einstellungen.konto.handle}, Weg {einstellungen.zugriff.weg}).")
    ergebnis = crawler.fuehre_lauf_aus(einstellungen)
    print()
    print(crawler.zusammenfassung(ergebnis))
    print(f"\nLog: {logdatei}")
    return {"ok": 0, "abgebrochen": 2, "bereits_aktiv": 3}.get(ergebnis.status, 1)


def _dashboard(argv: list[str]) -> int:
    app = Path(__file__).resolve().parent / "dashboard" / "app.py"
    befehl = [sys.executable, "-m", "streamlit", "run", str(app), "--browser.gatherUsageStats", "false", *argv]
    return subprocess.call(befehl, cwd=pfade.PROJEKT)


def _export(argv: list[str]) -> int:
    from datetime import UTC, datetime

    from truthtracker import auswertung, db, konfig

    parser = argparse.ArgumentParser(prog="truthtracker export", description="Posts (nur Metadaten) als CSV.")
    parser.add_argument("--config", type=Path)
    args = parser.parse_args(argv)
    einstellungen = konfig.lade(args.config)
    if not einstellungen.datenbank_pfad.exists():
        print("Noch keine Datenbank vorhanden. Erst einen Lauf mit run_crawl.bat ausführen.")
        return 1
    con = db.oeffne(einstellungen.datenbank_pfad, nur_lesen=True)
    try:
        daten = auswertung.lade_daten(con)
    finally:
        con.close()
    ordner = einstellungen.export_ordner
    ordner.mkdir(parents=True, exist_ok=True)
    datei = ordner / f"posts-{datetime.now(UTC):%Y%m%d-%H%M%S}.csv"
    datei.write_bytes(auswertung.csv_export(auswertung.posts_tabelle(daten.posts)))
    print(f"Export geschrieben: {datei}")
    return 0


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    befehl, rest = argv[0], argv[1:]
    if befehl == "crawl":
        return _crawl(rest)
    if befehl == "pruefen":
        from truthtracker import pruefung

        return pruefung.main(rest)
    if befehl == "spike":
        from truthtracker import spike

        return spike.main(rest)
    if befehl == "dashboard":
        return _dashboard(rest)
    if befehl == "export":
        return _export(rest)
    print(f"Unbekannter Befehl: {befehl}\n{__doc__}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
