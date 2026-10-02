# Truth-Social-Metadaten-Tracker

Erfasst das **Postingverhalten** von @realDonaldTrump auf Truth Social (Zeiten, Typen,
Formate, Engagement, Duplikate, Löschungen), ausschließlich als Metadaten. Inhalte werden
nur während eines Laufs im Speicher verarbeitet und nie gespeichert. Vollständige Vorgaben:
[SPEC.md](SPEC.md).

> Stand: Zugriffs-Spike fertig. Crawler, Datenbank und Dashboard folgen in diesem Ordner.

## Zugriffs-Spike ausführen (Windows)

1. Python 3.12 oder neuer installieren (https://www.python.org/downloads/windows/, Haken bei
   „Add python.exe to PATH“).
2. `run_spike.bat` doppelklicken. Beim ersten Start wird eine virtuelle Umgebung angelegt.
3. Der Spike probiert erst den direkten Weg (curl_cffi), dann einen echten Browser
   (Opera, sonst Chrome, sonst Edge) mit eigenem Tracker-Profil. Zeigt Cloudflare dort eine
   Prüfung, im Browserfenster lösen; das Skript wartet bis zu 5 Minuten.
4. Ergebnis: `docs/zugriff-messungen/messung-<Zeitstempel>.md` (nur Statuscodes, Feldnamen
   und Zählwerte, keine Inhalte).
