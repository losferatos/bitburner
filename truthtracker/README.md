# Truth-Social-Metadaten-Tracker

Erfasst das **Postingverhalten** von @realDonaldTrump auf Truth Social und zeigt es in einem
lokalen Dashboard: Tageszeiten, Frequenz, Serien, Formatmix, Retruths, Engagement, Duplikate,
Löschungen und Edits. Es werden **nur Metadaten** gespeichert. Texte und Medien werden während
eines Laufs im Speicher ausgewertet (Zeichenzahl, Hashes) und danach verworfen.

Vorgaben: [SPEC.md](SPEC.md) · Aufbau: [docs/architektur.md](docs/architektur.md) ·
Zugriffsweg: [docs/zugriff.md](docs/zugriff.md) · Entscheidungen: [docs/entscheidungen.md](docs/entscheidungen.md)

> **Stand:** Alles ist gebaut und gegen einen lokalen API-Nachbau getestet. Der Zugriffs-Spike und
> ein echter Lauf gegen truthsocial.com stehen noch aus: Die Entwicklungsumgebung durfte
> truthsocial.com nicht erreichen. Bitte als Erstes `run_spike.bat` und danach `run_crawl.bat`
> ausführen (siehe „Erster Lauf“).

## Installation (Windows)

1. **Python 3.12 oder neuer** installieren: https://www.python.org/downloads/windows/ – im
   Installer den Haken bei „Add python.exe to PATH“ setzen.
2. **Browser:** Opera, Chrome oder Edge (Edge ist bei Windows dabei). Der Tracker nutzt ein
   **eigenes** Profil unter `laufzeit\browser-profil`; dein normales Browserprofil bleibt unberührt.
3. Diesen Ordner (`truthtracker`) an einen festen Ort legen, z. B. `C:\Tools\truthtracker`.
   Ein Ordner ohne Cloud-Synchronisation ist besser (OneDrive sperrt manchmal Dateien).
4. Beim ersten Doppelklick auf eine der `.bat`-Dateien wird `.venv` angelegt und alles
   installiert (einige Minuten, Internet nötig). Danach geht es sofort los.

Nur wenn kein Browser gefunden wird: in `config.toml` unter `[zugriff]` bei `browser` den Pfad zur
`.exe` eintragen, und zwar in **einfachen** Anführungszeichen, z. B.
`browser = 'C:\Users\Name\AppData\Local\Programs\Opera\opera.exe'` (in doppelten
Anführungszeichen gelten die Backslashes als Steuerzeichen).

## Die Startdateien

| Datei | Zweck |
|---|---|
| `run_spike.bat` | Zugriffs-Spike: prüft, ob und wie Truth Social von diesem Rechner aus erreichbar ist |
| `run_crawl.bat` | Ein Lauf: neue Posts, Engagement, Duplikate, Löschungen |
| `run_dashboard.bat` | Dashboard im Browser öffnen (meist http://localhost:8501; ist der Port belegt, nimmt Streamlit den nächsten freien und nennt ihn im Fenster) |
| `run_pruefung.bat` | Prüft DB, Logs, Temp-Ordner und Browserprofil auf Inhaltsreste |
| `run_tests.bat` | Alle automatischen Tests |

Alles geht auch auf der Kommandozeile: `python -m truthtracker crawl|pruefen|spike|dashboard|export`
(mit aktivierter `.venv`, aus diesem Ordner, `set PYTHONPATH=src`).

## Erster Lauf

1. **Spike:** `run_spike.bat` doppelklicken. Er probiert zuerst den direkten Weg (curl_cffi),
   dann den Browser. Öffnet sich ein Browserfenster mit einer Cloudflare-Prüfung („Bestätigen Sie,
   dass Sie ein Mensch sind“), dort lösen; das Skript wartet bis zu 5 Minuten. Dauer insgesamt etwa
   3–4 Minuten. Ergebnis: `docs\zugriff-messungen\messung-<Zeit>.md` (nur Statuscodes, Feldnamen,
   Zählwerte). Steht dort bei „Empfehlung“ `a` oder `b2`, funktioniert der Zugriff.
2. **Erster Crawl:** `run_crawl.bat`. Der erste Lauf holt Posts **vier Wochen zurück** (Backfill,
   einstellbar). Bei etwa 25 Posts pro Tag sind das rund 700 Posts: ungefähr 20–35 Timeline-Seiten
   plus Bilder, mit den schonenden Pausen etwa **10–20 Minuten**. Bricht der Lauf ab (z. B. 429), ist
   das Gesammelte gespeichert; der nächste Lauf macht an der Lücke weiter.
3. **Prüfung:** `run_pruefung.bat` sollte „keine Inhaltsreste gefunden“ melden.
4. Bitte die Werte aus Schritt 1 und 2 (Anfragen, Dauer, Ergebnis) in `docs/zugriff.md` unter
   „Messung auf dem Heim-PC“ eintragen.

## Tägliche Nutzung

* `run_crawl.bat` doppelklicken, etwa einmal am Tag. Öfter oder seltener ist kein Problem:
  - Posts, die jünger als 24 h sind, bekommen bei jedem Lauf einen neuen Engagement-Snapshot;
    ab 24 h ist ein Post eingefroren.
  - Nach mehreren Tagen Pause werden alle verpassten Posts nachgeholt.
  - Zwei Läufe direkt hintereinander erzeugen keine doppelten Posts. Ein zweiter Start, während
    noch ein Lauf läuft (z. B. Doppelklick), fragt nichts an und meldet „Kein Lauf gestartet“.
* Für die Wachstumskurve im Reiter „Engagement“ braucht ein Post mindestens zwei Messungen unter
  24 h, also an manchen Tagen zwei Läufe im Abstand einiger Stunden.
* Ein Lauf dauert meist **3–5 Minuten** (Pausen von 10–15 s zwischen den Anfragen). Am Ende steht
  eine Zusammenfassung: Anfragen, neue Posts, Snapshots, Löschungen, Edits, Duplikate.
* Dashboard: `run_dashboard.bat` (siehe unten). Es liest die Datenbank nur und kann parallel
  offen bleiben.
* Export: im Dashboard (Reiter „Tabelle“, CSV-Knopf) oder `python -m truthtracker export`
  (schreibt nach `exporte\`).

## Dashboard

Seitenleiste (gilt für alle Reiter): Zeitraum, Zeitzone (New York oder Berlin, Sommerzeit
korrekt), Post-Typ, Format, Serien-Schwelle X Minuten, Messalter-Bereich für Engagement (Standard
18–24 h), „Backfill einbeziehen“ (aus), „Gelöschte einbeziehen“ (an).

| Reiter | Inhalt |
|---|---|
| Überblick | Posts pro Tag gestapelt nach Typ, Anteil Retruths vs. eigene Posts im Zeitverlauf |
| Tageszeiten | Heatmap Wochentag × Stunde |
| Abstände & Serien | Verteilung der Abstände, Posting-Serien (Anzahl, Länge, Uhrzeit), längste Pause je Tag |
| Formate | Formatmix im Zeitverlauf, Verteilung der Zeichenanzahl |
| Engagement | Replies/Retruths/Likes (und weitere Zähler) nach Typ, Format, Uhrzeit – je Post die späteste Messung im gewählten Messalter-Bereich; nach Format und Uhrzeit Retruths nur über die Reihe „Original“; optional „pro Stunde seit Post“; Wachstumskurve aus eigenen Posts mit mindestens zwei Messungen unter 24 h (braucht mehrere Läufe am Tag) |
| Retruth-Quellen | Top-Accounts, Anteil Selbst-Retruths, Retruth-Latenz |
| Duplikate | Rate, Art, zeitlicher Abstand, alle Treffer mit Zusatz (z. B. „Medien wahrscheinlich gleich“) |
| Löschungen & Edits | Anzahl, Zeit bis zur Löschung (als Intervall zwischen „zuletzt gesehen“ und „erstmals vermisst“), Edits |
| Account | Follower, Following, Postzahl als Zeitreihe |
| Tabelle | alle Posts mit allen Metadaten (u. a. Medien je Art, Abmessungen, Videodauer), Link zum Post, CSV-Export |
| Läufe | Laufprotokoll: Start, Ende, Anfragen, neue/aktualisierte Posts, Fehler, Cloudflare |

Das Messalter steht überall dabei („gemessen nach 17,3 h“); Backfill-Posts heißen „Endstand nach
X Tagen“ und sind standardmäßig aus Engagement-Vergleichen ausgeschlossen. Ausgewertet wird der
Erfassungsbereich (Backfill-Grenze bis letzter Lauf); ältere Posts (etwa ein alter gepinnter)
stehen nur in der Tabelle.

**CSV** (für deutsches Excel): UTF-8 mit BOM, Semikolon, Dezimalkomma, IDs als Text (sonst rundet
Excel die 18-stelligen IDs), Texte mit `= + - @` am Anfang mit Apostroph davor (Formelschutz).
Spalten wie in der Tabelle; Medien als Anzahl je Art, „Abmessungen“ (z. B. 1200×800, 720×1280) und
„Videodauer (s)“ (Summe der Videos, leer, wenn eine Dauer fehlt). Keine Medien-URLs.

## Was ein Lauf tut

0. Laufsperre nehmen (nie zwei Läufe gleichzeitig), Temp-Ordner und Browserprofil aufräumen.
1. Konto-Snapshot (Follower, Following, Postzahl).
2. Gepinnte Posts holen.
3. Timeline von oben paginieren, bis der zuletzt bekannte Post erreicht ist **und** die letzten
   7 Tage abgedeckt sind; Lücken früherer Läufe füllen. Zeigt Cloudflare beim Laden eines Bildes
   eine Prüfung, ein 429 oder eine Sperre, wird die laufende Seite zu Ende gespeichert und der Lauf
   beendet.
4. Snapshots nach der 24h-Regel, Bilder bzw. Vorschaubilder hashen (im Speicher).
5. Duplikate im 14-Tage-Fenster bewerten.
6. Posts der letzten 7 Tage, die fehlen, einzeln prüfen (nur „404 nicht gefunden“ zählt als gelöscht).
7. Laufprotokoll in der Datenbank (Reiter „Läufe“ im Dashboard).

## Konfiguration

`config.toml` (kommentiert). Die wichtigsten Werte:

| Abschnitt | Schlüssel | Standard | Bedeutung |
|---|---|---|---|
| `[konto]` | `handle` | `realDonaldTrump` | Account |
| `[zugriff]` | `weg` | `auto` | `auto`: direkt, bei Cloudflare-Prüfung Browser; `curl`; `browser` |
| `[zugriff]` | `browser` | `auto` | Opera → Opera GX → Chrome → Edge, oder Pfad |
| `[zugriff]` | `replies_anderer` | `auto` | Antworten an andere (ausgeloggt meist nicht abrufbar) |
| `[pausen]` | `api_min_s` / `api_max_s` | 10 / 15 | zufällige Pause vor jeder Anfrage |
| `[erfassung]` | `backfill_wochen` | 4 | erster Lauf |
| `[erfassung]` | `loeschpruefung_tage` | 7 | Lösch-Fenster |
| `[erfassung]` | `duplikat_fenster_tage` | 14 | Duplikat-Fenster |
| `[erfassung]` | `snapshot_grenze_h` | 24 | Engagement-Messung bis zu diesem Alter |
| `[dashboard]` | `zeitzone` | `Europe/Berlin` | Standard der Anzeige (umschaltbar) |

## Fehlerfälle und Lösungen

| Meldung | Bedeutung | Was tun |
|---|---|---|
| „Cloudflare-Prüfung im Browserfenster …“ | Cloudflare will einen Menschen sehen | Im geöffneten Fenster die Prüfung lösen. Der Lauf wartet 5 Minuten. |
| „Abbruch: Cloudflare verlangt eine Browser-Prüfung“ | Prüfung nicht rechtzeitig gelöst, oder `weg = "curl"` | Lauf erneut starten und die Prüfung lösen; `weg = "auto"` lassen. |
| „Abbruch: Zu viele Anfragen (HTTP 429)“ | Rate-Limit | 15–60 Minuten warten, dann erneut. Kommt es öfter: `api_min_s`/`api_max_s` erhöhen (z. B. 15/25). |
| „Abbruch: Cloudflare hat die Anfrage blockiert“ | IP oder Browser gesperrt | Später erneut; anderes Netz (z. B. Handy-Hotspot) probieren; in `config.toml` einen anderen Browser wählen (`edge`). Keine Proxy-Dienste. |
| „Abbruch beim Medienabruf: …“ | Cloudflare-Prüfung, 429 oder Sperre beim Laden eines Bildes | Wie die Zeilen darüber; Gesammeltes ist gespeichert, fehlende Bild-Hashes holt ein späterer Lauf nach. |
| „Kein Lauf gestartet. Es läuft bereits ein Lauf …“ | Ein anderes Fenster mit `run_crawl.bat` oder `run_spike.bat` läuft noch | Dort warten, bis es fertig ist. |
| „Timeline-Seite leer, obwohl ältere Posts existieren müssten“ | Truth Social liefert ausgeloggt ab einer gewissen Tiefe nichts mehr | Nichts; der nächste Lauf versucht die Lücke erneut. Bleibt es dauerhaft, `backfill_wochen` verkleinern. |
| „Truth Social hat in diesem Lauf keine Anfrage beantwortet“ | Netzwerk- oder Serverstörung | Internetverbindung prüfen, später erneut starten. |
| „Das Browserfenster des Trackers wurde geschlossen …“ | Fenster während des Laufs geschlossen | Erneut starten und das Fenster offen lassen, bis der Lauf fertig ist. |
| „Der Tracker-Browser läuft noch; sein Profil wurde nicht aufgeräumt“ | Ein Tracker-Fenster ist noch offen | Fenster schließen; der nächste Lauf räumt das Profil beim Start auf. |
| „in deiner Region nicht verfügbar“ | Regionssperre | Ohne VPN nicht lösbar; SPEC sieht keine Umgehung vor. |
| „Kein Browser gefunden“ | Opera/Chrome/Edge nicht an den üblichen Orten | Pfad zur `.exe` in `config.toml` unter `[zugriff] browser` eintragen. |
| „Das Tracker-Browserprofil ist noch geöffnet“ | Ein Fenster des Trackers ist offen | Fenster schließen, erneut starten. |
| Prüfung im Browser kreist endlos | Cloudflare erkennt Automatisierung | Fenster schließen, `laufzeit\browser-profil` löschen, erneut starten; anderen Browser probieren (`browser = "edge"` oder `"chrome"`). |
| „Antworten an andere sind ohne Login nicht abrufbar“ | Normal, nur Information | Nichts. Threads (Antworten an sich selbst) werden erfasst. |
| „Fehler in der Konfiguration“ | Tippfehler in `config.toml` | Meldung nennt Abschnitt und Schlüssel. Bei „Windows-Pfade bitte in einfache Anführungszeichen setzen“: Pfad wie oben unter „Installation“ schreiben. |
| Python nicht gefunden | Python fehlt oder nicht im PATH | Python 3.12+ installieren (Haken bei PATH), `.venv` löschen, erneut starten. |

Logs: `laufzeit\logs\crawl-<Datum>.log` (nur IDs und Zählwerte).

## Datenschutz und Prüfung auf Inhaltsreste

* Datenbank, Logs, Exporte und Dashboard enthalten keine Texte, keine Medien, keine Medien-URLs,
  keine Kommentare – nur IDs, Post-URLs, Zeiten, Zahlen, Hashes, Link-Domains, Account-Metadaten.
* Medien werden nur in den Speicher geladen; bei Videos nur das Vorschaubild.
* Das Browserprofil behält nur Cookies und Einstellungen; Cache, Verlauf und Sitzungen werden zu
  Beginn jedes Laufs (auch eines Laufs ohne Browser) und nach jedem Browser-Lauf gelöscht.
* **`run_pruefung.bat`** prüft Datenbank (jede Spalte nach einer Positivliste und die Rohdatei),
  Logs, Temp-Ordner, Browserprofil (nur Cookies und Einstellungsdateien erlaubt; deren Werte werden
  auf HTML, Truth-Social-Medien-URLs und lange Freitexte geprüft), Exporte und Spike-Berichte. Ergebnis: „keine Inhaltsreste
  gefunden“ (Exit-Code 0), Funde mit Ort und Art (1) oder „Prüfung nicht möglich“ (2). Der Bericht
  nennt nie den gefundenen Inhalt selbst.
* **Eigene Stichprobe:** In einer Eingabeaufforderung im Ordner `run_pruefung.bat --abfragen`
  ausführen, z. B. den Text eines echten Posts einfügen (Absätze sind erlaubt: jede Zeile ist eine
  eigene Stichprobe, Leerzeilen und Zeilen unter 4 Zeichen werden übersprungen) und die Eingabe mit
  **Strg+Z, dann Eingabe** abschließen. Keine der Zeilen darf irgendwo gefunden werden.
  (`--marker "Text"` geht auch, landet aber im Befehlsverlauf; `--marker-datei datei.txt` liest
  eine Stichprobe je Zeile.)
* Nach einem abgestürzten Lauf sind Funde im Temp-Ordner oder Browserprofil möglich; der nächste
  Lauf räumt sie beim Start weg, auch wenn er ohne Browser auskommt. Läuft das Tracker-Fenster
  dann noch, sagt das Laufprotokoll, dass das Profil nicht aufgeräumt wurde.

## Tests

`run_tests.bat` (oder `python -m pytest` mit `PYTHONPATH=src`). Alle Fixtures sind synthetisch.
Die Tests laufen gegen einen lokalen Nachbau der Truth-Social-API (`tests/fake_truthsocial.py`),
Browser-Tests mit einem Chromium, falls vorhanden.
