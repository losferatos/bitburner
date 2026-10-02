# Projekt: Metadaten-Tracker für Trumps Postingverhalten auf Truth Social

## Ziel
Ich will das **Postingverhalten** von @realDonaldTrump auf Truth Social (https://truthsocial.com/@realDonaldTrump) erfassen und in einem lokalen Dashboard nach Mustern durchsuchen: Tageszeiten, Frequenz, Serien, Formatmix, Retruth-Verhalten, Engagement, Duplikate, Löschungen.

Es geht **ausschließlich um Metadaten**. Inhalte von Posts oder Kommentaren werden **nicht** analysiert, klassifiziert, zusammengefasst oder dauerhaft gespeichert (siehe „Datenschutz-Regel“).

Baue das komplette Projekt: Crawler, Datenbank, Dashboard, Tests, README. Speichere diesen Prompt unverändert als `SPEC.md` im Repo. Er dient später als Referenz für ein Code-Review.

## Rahmenbedingungen
- Läuft auf meinem **Windows-PC** (Heim-IP). Kein Server, kein Dauerbetrieb.
- Ich starte den Crawl **manuell, etwa einmal täglich**. Manchmal öfter, manchmal tagelang gar nicht. Start per Doppelklick (.bat) oder CLI.
- Stack-Vorschlag (Abweichungen nur mit Begründung): Python 3.12+, SQLite, `curl_cffi` (Browser-Impersonation), Playwright als Fallback, Streamlit + Plotly fürs Dashboard, pytest. Abhängigkeiten über `uv` oder venv + requirements.txt.
- Dashboard-Oberfläche auf **Deutsch**.
- Datenquelle: **nur Truth Social direkt**, keine Drittarchive.

## Zugriff & Cloudflare
Die Seite steht hinter Cloudflare. Truth Social ist ein Mastodon-Fork. Die Web-App lädt ihre Daten vermutlich über eine Mastodon-kompatible JSON-API, z. B. `/api/v1/accounts/lookup?acct=realDonaldTrump`, `/api/v1/accounts/{id}/statuses` (Pagination über `max_id`) und `/api/v1/statuses/{id}`. **Prüfe das zuerst.** Nichts davon ist garantiert.

1. **Zuerst ein Spike**, bevor du den Rest baust: Finde heraus, welcher Zugriffsweg von meinem Rechner aus zuverlässig funktioniert, und dokumentiere das Ergebnis in `docs/zugriff.md`. Reihenfolge:
   a) JSON-API per `curl_cffi` mit Chrome-Impersonation.
   b) Playwright mit echtem Chrome/Edge (sichtbares Fenster, persistentes Profil). Dabei die JSON-Antworten der Web-App aus dem Netzwerkverkehr abgreifen, statt HTML zu parsen.
   c) HTML-Parsing nur als letzte Option. Die Post-Zeit steht z. B. in `<time title="02. Okt. 2026, 4:01 PM">`, ist dort aber lokalisiert und ohne klare Zeitzone. `created_at` aus der API (UTC) ist klar vorzuziehen.
2. Zeigt Cloudflare eine Challenge, die ein Mensch lösen muss: Browserfenster öffnen, mich lösen lassen, danach die Session (Cookies) im persistenten Profil wiederverwenden. **Keine** CAPTCHA-Lösedienste, keine Proxy-Rotation.
3. Schonend crawlen: wenige Requests pro Lauf, zufällige Pausen (z. B. 2–6 s), keine Parallelität. Bei Block, 429 oder Challenge: sauber abbrechen, klar melden, bis dahin gesammelte Daten speichern, nicht weiter anfragen.
4. Logge im Spike, welche Felder die API pro Post tatsächlich liefert (nur Feldnamen, keine Inhalte), und richte die Erfassung danach aus. Truth Social hat eigene Erweiterungen (z. B. Quotes), die vom Standard-Mastodon abweichen können.

## Was pro Post erfasst wird
**Identität & Zeit**
- Status-ID, Post-URL, `created_at` (UTC, sekundengenau), Zeitpunkt des ersten Sehens durch den Crawler.
- Gespeichert wird immer in UTC. Die Anzeige im Dashboard ist umschaltbar zwischen **America/New_York** und **Europe/Berlin**, mit korrekter Sommerzeit.

**Typ**
- Retruth (Reblog) oder eigener Post. Zusätzlich: Quote (zitiert einen anderen Post) und Reply (Antwort an sich selbst = Thread, oder an jemand anderen).
- Bei Retruths: Zeitpunkt des Retruths und Zeitpunkt des Originals speichern, daraus die **Retruth-Latenz**. Retruth eines eigenen Posts ist ein eigener Fall.
- Gepinnt ja/nein. Gepinnte Posts dürfen die Erkennung neuer Posts nicht stören.

**Format** (bei Retruths bezogen auf den retruthed Inhalt)
- Kategorien: nur Text · nur Medien · Medien + Text · nur Link · Text + Link · leer/sonstiges. Lege die Regeln so fest, dass sich die Kategorien gegenseitig ausschließen, und dokumentiere sie.
- Anzahl Medien je Art (Bild, Video, GIF). Videodauer und Abmessungen, sofern in den Metadaten vorhanden.

**Text-Metadaten** (keine Inhalte)
- Zeichenanzahl des sichtbaren Texts (HTML entfernt, Entities dekodiert, gezählt als Graphem-Cluster), zusätzlich die Zeichenanzahl ohne URLs.
- Anzahl URLs, Domains externer Links, Anzahl Mentions, Anzahl Hashtags, Link-Vorschaukarte ja/nein.

**Engagement**
- Replies, Retruths, Likes, plus weitere Zähler, falls die API sie liefert.
- Bei Retruths die Zähler des Retruths selbst und die des Originals getrennt speichern.

**Quelle bei Retruths, Quotes und Replies** (nur Account-Metadaten)
- Account-ID, Handle, Anzeigename, Verifiziert-Status, Followerzahl zum Zeitpunkt der Erfassung, ob es Trump selbst ist.

## 24h-Messlogik für Engagement
- Für jeden Post, der beim Lauf **jünger als 24 h** ist, erzeugt der Lauf einen Snapshot: Zähler, Messzeitpunkt und **Alter des Posts beim Messen in Stunden**.
- Ab 24 h Alter wird ein Post nicht mehr aktualisiert, er ist eingefroren. Sieht der Crawler einen Post zum ersten Mal, wenn er schon ≥ 24 h alt ist, gibt es genau einen Snapshot mit diesem Alter.
- Der „finale Wert“ eines Posts ist sein letzter Snapshot. Das Alter dieser Messung wird **immer** mitgeführt und im Dashboard angezeigt („gemessen nach 17,3 h“).
- Alle Snapshots bleiben erhalten. Bei mehreren Messungen ergeben sich daraus Wachstumskurven.
- Engagement-Vergleiche im Dashboard nur mit Filter bzw. Gruppen nach Messalter (z. B. nur Messungen zwischen 18 und 24 h). Optional eine klar beschriftete normierte Größe „pro Stunde seit Post“.
- Backfill-Posts (siehe unten) als „Endstand nach X Tagen“ markieren und standardmäßig aus Engagement-Vergleichen ausschließen.

## Duplikat-Erkennung (14 Tage)
Frage: Hat er in den 14 Tagen vor diesem Post **exakt das Gleiche** schon gepostet oder retruthed?
- Inhalts-Fingerabdruck = Hash des normalisierten Texts (HTML entfernt, Unicode NFC, Whitespace zusammengefasst) + sortierte Hashes der Medien.
- Getrennt ausweisen:
  1. Gleicher Original-Post erneut retruthed (gleiche Original-ID).
  2. Identischer Fingerabdruck aus Text und Medien, egal ob eigener Post oder Retruth.
  3. Nur Text identisch bzw. nur Medien identisch.
  4. Medien wahrscheinlich identisch: Server kodieren hochgeladene Medien oft neu, daher scheitern byte-genaue Hashes bei erneutem Hochladen. Zusätzlich einen perzeptuellen Hash (z. B. pHash) von Bildern bzw. vom Video-Vorschaubild berechnen, kombiniert mit Dauer und Abmessungen. Als eigene Kategorie führen, nicht mit „exakt“ vermischen.
- Leerer Text zählt nicht als Text-Duplikat.
- Gespeichert werden: Duplikat ja/nein, Art, ID des früheren Posts, zeitlicher Abstand.

## Löschungen & Edits
- Bei jedem Lauf werden Posts der letzten N Tage (konfigurierbar, Standard 7) gezielt per ID geprüft, wenn sie im abgedeckten Zeitfenster der aktuellen Abfrage fehlen. Nur bei eindeutigem „nicht gefunden“ als gelöscht markieren, mit Zeitfenster (zuletzt gesehen / erstmals vermisst). Pagination-Grenzen, Netzwerkfehler oder Blocks dürfen keine falschen Löschungen erzeugen.
- Edits über ein Feld wie `edited_at` (falls vorhanden) oder über einen geänderten Inhalts-Fingerabdruck erkennen. Gespeichert werden Zeitpunkt und Anzahl der Edits, nicht der Inhalt.

## Account-Werte
Pro Lauf ein Snapshot von Trumps Account: Follower, Following, Gesamtzahl Posts. Im Dashboard als Zeitreihe.

## Ablauf eines Laufs
- Reihenfolge: Account-Snapshot → neue Posts holen (paginieren bis zum zuletzt bekannten Post plus kleine Überlappung) → Snapshots für Posts unter 24 h → Duplikat-Check → Lösch- und Edit-Check → Laufprotokoll.
- **Lücken:** Habe ich mehrere Tage nicht gecrawlt, werden alle verpassten Posts nachgeholt.
- **Erster Lauf:** Backfill einige Wochen zurück (Standard 4, konfigurierbar). Backfill-Posts markieren.
- **Idempotent:** Zwei Läufe direkt hintereinander erzeugen keine doppelten Posts, nur neue Snapshots für junge Posts.
- Laufprotokoll in der DB: Start, Ende, Anzahl Requests, neue/aktualisierte Posts, Fehler, Cloudflare-Blocks.
- Konfiguration in einer Datei (z. B. `config.toml`): Account, Backfill-Wochen, Pausen, Fenster für Lösch-Check und Duplikate.

## Datenschutz-Regel: Inhalte nur temporär
- Texte und Medien dürfen **während eines Laufs vorübergehend** verarbeitet werden (im Speicher oder in einem Temp-Ordner), um Zeichenzahl, Hashes und perzeptuelle Hashes zu berechnen.
- Danach werden sie **gelöscht**, auch nach einem Absturz: `try/finally` plus Aufräumen beim nächsten Start.
- DB, Logs, Exporte und Dashboard enthalten **keine** Texte, Mediendateien, Medien-URLs oder Kommentare. Erlaubt sind IDs, Post-URLs, Zahlen, Hashes, Link-Domains und Account-Metadaten.
- Auch der Browser-Cache (Playwright-Profil) darf keine Seiteninhalte oder Medien dauerhaft halten: Cache deaktivieren oder nach dem Lauf leeren, nur Cookies und Session behalten.
- Kommentare anderer Nutzer werden nicht abgerufen, nur die Zähler.
- Medien nur so weit herunterladen, wie es für den Hash nötig ist. Bei Videos nur das Vorschaubild, nicht die Videodatei.
- Test-Fixtures: synthetisch, nur mit der Struktur echter API-Antworten und erfundenem Text. Keine echten Inhalte ins Repo.
- Keine Funktion analysiert Inhalte: keine Themen, keine Stimmung, keine Keywords, kein NLP.

## Dashboard (Streamlit, lokal, Deutsch)
Start per Doppelklick (.bat). Globale Filter: Zeitraum, Zeitzone (ET/Berlin), Post-Typ, Format.
Mindestens:
- Posts pro Tag (gestapelt nach Typ), Anteil Retruths vs. eigene Posts im Zeitverlauf.
- Heatmap Wochentag × Stunde.
- Verteilung der Abstände zwischen Posts. **Posting-Serien** (Posts mit weniger als X Minuten Abstand, X einstellbar): Anzahl, Länge, Uhrzeit. Längste tägliche Pausen.
- Formatmix im Zeitverlauf, Verteilung der Zeichenanzahl.
- Engagement nach Typ, Format und Uhrzeit, nur mit Messalter-Filter (siehe oben).
- Retruth-Quellen: Top-Accounts, Anteil Selbst-Retruths, Retruth-Latenz.
- Duplikate: Rate, Art, zeitlicher Abstand.
- Löschungen und Edits: Anzahl, Zeit bis zur Löschung.
- Account-Werte als Zeitreihe.
- Tabelle aller Posts (nur Metadaten) mit Link zum Original, CSV-Export.

## Lieferumfang & Definition of Done
- Lauffähig unter Windows. README mit Installation, erstem Lauf, täglicher Nutzung, Fehlerfällen und Lösungen bei Cloudflare-Problemen.
- `run_crawl.bat` und `run_dashboard.bat`.
- pytest-Tests mindestens für: Typ- und Format-Klassifikation, Zeichenzählung, 24h-Snapshot- und Freeze-Logik, Duplikat-Fälle 1–4, Lösch-Erkennung ohne falsche Treffer, Nachholen von Lücken, Idempotenz, Zeitzonen inkl. Sommerzeit-Wechsel, „keine Inhalte in der DB“.
- Ein echter Lauf gegen die Live-Seite war erfolgreich. Dokumentiere Anzahl Requests und Dauer.
- Ein Prüfskript, das DB, Logs, Temp-Ordner und Browser-Cache auf Inhaltsreste untersucht.
- `SPEC.md` (dieser Prompt), `docs/zugriff.md` (Spike-Ergebnis) und `docs/entscheidungen.md` im Repo.

## Arbeitsweise
- Mach zuerst den Zugriffs-Spike. Funktioniert kein Weg zuverlässig, hör auf und berichte mir mit Optionen, statt Platzhalter zu bauen.
- Triff kleinere Entscheidungen selbst und dokumentiere sie in `docs/entscheidungen.md`. Frag nur, wenn etwas die Ziele oben grundsätzlich verändert.
- Keine Stubs und keine TODO-Platzhalter im fertigen Stand.
