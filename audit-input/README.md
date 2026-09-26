# Eingaben fuer die Cloud-Pruefung (Audit 26.09.2026)

Nur fuer die Skeptiker-Laeufe in einer Cloud-Sitzung; lokal liegen diese
Dateien gitignored unter backups/ und data/.

- backups/: echte Spielstaende (gzip JSON). Dekodieren: save.data.PlayerSave ist
  ein JSON-String, dessen .data der Spieler ist; AllServersSave analog (Server,
  Dateien auf home inkl. bn4rep-log.txt, einbau.json, rep-ziel.txt).
  - BN1L3 00-23 pre-install: Vorfall "vorzeitiger Einbau" (Bericht 3#3)
  - BN5L2 16-57 pre-install: Vorfall "Neuralstimulator unbezahlbar" (3#3)
  - BN5L2 19-03 pre-install + 19-04 hourly: frisch nach Einbau (fuer B2 grow-Zeit)
  - BN5L2 18-04 hourly: Mitte des Zyklus
- bridge.log: Brueckenprotokoll (Offline-Fenster: "Spielverbindung getrennt"/"Spiel verbunden").
- INDEX.tsv: Auszug backups/INDEX.tsv fuer BN1L2, BN1L3, BN5L2.
- modelle/: Rechenskripte der Pruefer (geeicht). Enthalten teils absolute
  Windows-Pfade - vor Gebrauch auf audit-input/ umbiegen.
- Spielquelle 3.0.2: nicht im Repo; holen mit
  git clone --depth 1 --branch v3.0.2 https://github.com/bitburner-official/bitburner-src reference/bitburner-src
  (falls der Tag fehlt: Standardbranch, Version in package.json pruefen).
