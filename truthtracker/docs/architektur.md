# Architektur

Dieses Dokument legt die Module, ihre Schnittstellen und die fachlichen Regeln fest. Die
Begründungen einzelner Entscheidungen stehen in [entscheidungen.md](entscheidungen.md), das
Ergebnis des Zugriffs-Spikes in [zugriff.md](zugriff.md).

## Überblick

```
run_crawl.bat ─► python -m truthtracker crawl
                   │
                   ├─ konfig.py        config.toml lesen und prüfen
                   ├─ transport.py     HTTP: curl_cffi oder echter Browser (CDP), Pausen, Abbruch
                   │    ├─ cloudflare.py   Antwort einordnen (ok / Challenge / 429 / 404 …)
                   │    └─ browser.py      Opera/Chrome/Edge mit eigenem Profil starten, aufräumen
                   ├─ crawler.py       Ablauf eines Laufs (Konto → Posts → Snapshots → Duplikate → Löschungen)
                   │    ├─ klassifikation.py  API-Objekt → PostDaten (nur Metadaten)
                   │    │    ├─ text.py       sichtbarer Text, Grapheme, URLs, Hashes
                   │    │    └─ medien.py     Download in den Speicher, SHA-256, pHash
                   │    ├─ duplikate.py      Duplikat-Fälle 1–4 im 14-Tage-Fenster
                   │    └─ db.py             SQLite-Schema und Zugriffe
                   └─ temp.py          Temp-Ordner, Aufräumen nach Absturz

run_dashboard.bat ─► streamlit run src/truthtracker/dashboard/app.py
                   ├─ auswertung.py    reine pandas-Funktionen (testbar)
                   └─ dashboard/app.py Streamlit-Oberfläche (Deutsch)

run_pruefung.bat ─► python -m truthtracker pruefen   (pruefung.py: Inhaltsreste suchen)
run_spike.bat    ─► python -m truthtracker.spike     (Zugriffs-Spike)
```

Alle Zeitpunkte sind in Python `datetime` mit Zeitzone UTC und in der DB Text
`YYYY-MM-DDTHH:MM:SSZ` (`zeit.utc_text`). Anzeige in New York oder Berlin über `zoneinfo`.

## Datenfluss und Datenschutz

1. `transport` holt JSON (Inhalte nur im Speicher).
2. `klassifikation.extrahiere` macht daraus ein `PostDaten`-Objekt. Es enthält **nur**
   Metadaten: IDs, Post-URL, Zeiten, Zahlen, Hashes, Link-Domains, Account-Metadaten.
   Texte, HTML, Medien-URLs, Alt-Texte, Kartentitel verlassen `klassifikation` nie.
3. `medien.MedienErfasser` lädt Bilder bzw. Vorschaubilder **in den Speicher**, berechnet
   SHA-256 und pHash und verwirft die Bytes. Es wird nichts auf die Platte geschrieben.
   Videodateien werden nie geladen, nur ihr Vorschaubild.
4. `db` speichert `PostDaten`. Die DB läuft mit `secure_delete`.
5. Logs enthalten nur IDs, Zähler, Statuscodes und feste deutsche Meldungen.

## Zugriff

* Logged-out. Timeline: `GET /api/v1/accounts/{id}/statuses?exclude_replies=true&with_muted=true&limit=40[&max_id=…]`.
  Ohne Login verlangt der Server `exclude_replies=true` (sonst 401). Antworten an sich
  selbst (Threads) bleiben enthalten, Antworten an andere fehlen. Option
  `[zugriff] replies_anderer` versucht `exclude_replies=false`; gibt der Server 401, fällt der
  Lauf auf `true` zurück und merkt sich das.
* Gepinnte Posts: `GET …/statuses?pinned=true&with_muted=true` (eine Seite, kein Link-Header).
* Konto: `GET /api/v1/accounts/lookup?acct=realDonaldTrump`.
* Einzelabruf (Löschprüfung): `GET /api/v1/statuses/{id}`. Logged-out liefert der Server für
  Replies 401 → Ergebnis „unklar“, nie „gelöscht“.
* Gelöscht ist ein Post nur bei **404 mit JSON-Fehlerkörper** (`{"error": "Record not found", …}`).
* Werbung (`sponsored: true` oder fremde `account.id` in der Timeline) wird übersprungen.
* Zähler können `-1` sein (Platzhalter). Negative Zähler werden als „unbekannt“ (`None`) gespeichert.
* `signature`, `next_status`, `favourited`, `reblogged`, `muted`, `bookmarked`, `reaction` sind
  abruf- bzw. betrachterbezogen und fließen nirgends ein.

`transport.Transport` (Protokoll):

```python
class Transport(Protocol):
    weg: str                                   # "curl" oder "browser"
    def hole_json(self, pfad: str, params: dict | None = None) -> cloudflare.Bewertung: ...
    def hole_bytes(self, url: str) -> bytes: ...   # für Medien; wirft medien.MedienFehler
    def schliessen(self) -> None: ...
```

`hole_json` pausiert zufällig (`[pausen] api_*`) vor jeder Anfrage außer der ersten, zählt
Anfragen und wirft `transport.Abbruch(bewertung)` bei Challenge, Block, Geoblock, 429 und
403. 401 („Login nötig“) betrifft nur die einzelne Abfrage. Im Modus `auto` wird bei einer Challenge
einmalig auf den Browser gewechselt: Er startet normal (fester DevTools-Port, eigenes Profil) mit der
Konto-Abfrage als Startseite; solange Cloudflare prüft, werden nur Tab-Titel über `/json/list`
gelesen; erst nach der Freigabe verbindet sich Playwright, schaltet den Cache ab, sperrt Bilder und
Videos, und der Lauf geht per `fetch` aus der Seite weiter. `hole_bytes` prüft Status,
`Content-Type` und `Content-Length`, bevor es eine Antwort liest.

## Klassifikation (Regeln)

`klassifikation.extrahiere(status, *, trump_id, medien, gepinnte_ids, basis_url) -> PostDaten`

**Inhaltsquelle:** bei Retruths das `reblog`-Objekt, sonst der Status selbst. Format, Text-
Metadaten, Medien, Quote- und Reply-Merkmale beziehen sich auf die Inhaltsquelle.

**Typ:** `reblog` vorhanden → `retruth`; ist `reblog.account.id == trump_id` → `selbst_retruth`;
sonst `eigen`. `ist_quote`: Inhaltsquelle hat `quote_id` oder `quote`. `ist_reply`:
Inhaltsquelle hat `in_reply_to_id`; `reply_art = "thread"`, wenn `in_reply_to_account_id` gleich
dem Autor der Inhaltsquelle ist, sonst `"fremd"`. `typ_detail` (Filter im Dashboard):
Retruth-Arten vor Reply vor Quote vor eigenem Post.

**Retruth:** `original_id = reblog.id`, `original_created_at = reblog.created_at`,
`retruth_latenz_s = created_at − original_created_at` (Sekunden, ganzzahlig).

**URL:** immer in der Form `{basis_url}/@{name}/{id}`: aus `url`, ersatzweise `uri`
(`/users/{name}/statuses/{id}`), wenn der Host truthsocial.com bzw. die Basis ist und die ID passt;
sonst lokaler Handle plus ID. Bei Retruths zuerst das Original (die Seite des retruthed Posts), dann
der Retruth selbst. Fremde (föderierte) Adressen werden nie übernommen. Ohne Handle bleibt sie leer.

**Gepinnt:** Ist die Liste der gepinnten Posts bekannt, `True` genau für ihre IDs, sonst `False`.
Ohne Liste `True` nur bei `pinned: true`, sonst `None` (unbekannt, denn `pinned` ist ausgeloggt immer
`false`); die DB behält dann den bisherigen Wert.

**Revision:** Feld `version` des Status (Zahl ≥ 1 oder Ziffernfolge) → `PostDaten.revision`. Die DB
zählt Edits als Maximum aus beobachteten Edits und `revision − 1`.

**Zähler:** `replies_count`, `reblogs_count`, `favourites_count` → `Zaehler.replies/retruths/likes`.
Alle weiteren ganzzahligen Felder auf oberster Ebene, die auf `_count` enden (z. B.
`upvotes_count`, `downvotes_count`, `quotes_count`), → `Zaehler.weitere`. Negative Werte → `None`
bzw. weglassen. Bei Retruths: `zaehler` aus dem Wrapper, `zaehler_original` aus `reblog`.

**Quell-Accounts** (`QuellKonto`, nur Metadaten):
* `retruth`: `reblog.account`.
* `quote`: `quote.account`, falls eingebettet; sonst nur bekannt, dass es ein Quote ist (Eintrag
  mit `konto_id=None`).
* `reply`: `in_reply_to.account`, falls eingebettet; sonst `in_reply_to_account_id` plus Handle
  aus `mentions` (Eintrag mit `id == in_reply_to_account_id`). `-99` in `mentions[].id` ist ein
  Platzhalter und keine Konto-ID.
* Felder: `id`, `acct` (Handle), `display_name`, `verified`, `followers_count` (negativ → `None`),
  `ist_trump = (id == trump_id)`.

**Text** (`text.analysiere`, Eingabe: `content`-HTML der Inhaltsquelle):
* Sichtbarer Text: HTML entfernen; `<p>` = Absatz (Leerzeile), `<br>` = Zeilenumbruch; Entities
  dekodieren; Elemente mit Klasse `quote-inline` (Quote-Fallback „RE: …“) entfernen; Spannen mit
  `invisible`/`ellipsis` bleiben vollständig (der Link zählt mit seiner ganzen URL). Leerraum am Rand
  jedes Absatzes und jeder Zeile entfällt, leere Absätze entfallen. `div`, `blockquote`, `pre`,
  Listen und Überschriften trennen wie `<p>`, `<li>` wie `<br>`; `script`, `style`, `template` sind
  unsichtbar.
* `zeichen`: Graphem-Cluster (`regex`, `\X`) des sichtbaren Texts, Zeilenumbrüche zählen mit.
* URLs: jedes `<a href>` mit sichtbarem Text, das kein Mention- oder Hashtag-Link ist (Klasse
  `mention`/`hashtag`, oder auf einem eigenen Host eine Profilseite `/@name` bzw. `/tags/…`), plus
  nackte `http(s)://`-URLs im Text (ohne Satzzeichen am Ende). Ein Link auf einen Truth-Social-Post
  (`/@name/<id>`) ist eine URL ohne externe Domain. Links auf das zitierte Original eines Quotes
  (erkannt über URL oder Status-ID, Vergleich ohne Schema, `www.`, Fragment, Schrägstrich am Ende)
  gehören wie der `quote-inline`-Fallback weder zu den URLs noch zum sichtbaren Text.
* `zeichen_ohne_urls`: sichtbarer Text ohne die URL-Texte; Leerraum an der Nahtstelle einer
  entfernten URL wird zu einem Leerzeichen, eine Zeile nur aus URLs entfällt samt Umbruch; als
  Grapheme gezählt. Ohne URLs ist `zeichen_ohne_urls == zeichen`.
* `link_domains`: Hosts der URLs ohne `www.`, kleingeschrieben, IDN als Punycode, nur echte Hosts
  (mit Punkt und Buchstaben-TLD oder IPv4), ohne truthsocial.com und dessen Subdomains, sortiert,
  ohne Dubletten.
* `n_mentions`: Mention-Links im HTML; enthält das HTML keine, die Einträge von `mentions` (ohne
  den Platzhalter `-99`).
* `n_hashtags`: Hashtag-Links im HTML; enthält das HTML keine, die Länge von `tags`.
* `text_hash`: SHA-256 (hex) des normalisierten Texts: sichtbarer Text, Unicode NFC, jede Folge
  von Leerraum (inkl. Zeilenumbrüchen) zu einem Leerzeichen, getrimmt. Leerer Text → `None`.

**Format** (schließen sich aus; „Text“ = sichtbarer Text inkl. URLs, „Text ohne URLs“ = ohne):

| Bedingung | Format |
|---|---|
| Medien vorhanden, Text nicht leer | `medien_text` |
| Medien vorhanden, Text leer | `nur_medien` |
| keine Medien, Link vorhanden, Text ohne URLs leer | `nur_link` |
| keine Medien, Link vorhanden, Text ohne URLs nicht leer | `text_link` |
| keine Medien, kein Link, Text nicht leer | `nur_text` |
| sonst (kein Text, keine Medien, kein Link, z. B. Umfrage, leeres Quote) | `leer_sonstiges` |

„Link vorhanden“ = mindestens eine URL (siehe oben) oder eine Vorschaukarte (`card`).

**Medien:** `image` → Bild, `video` und `tv` → Video, `gifv` → GIF, `audio` → Audio,
sonst → sonstig. Abmessungen und Dauer aus `meta.original.width/height/duration`.

**Medien-Hash:** Bilder: SHA-256 und pHash der Originaldatei (`url`, nur ohne `url` die
`preview_url`; scheitert der Download des Originals, wird nicht auf die Vorschau ausgewichen).
Video, GIF, sonstige: SHA-256 und pHash des Vorschaubilds (`preview_url`); eine Vorschauadresse, die
vereinheitlicht der Datei selbst entspricht (`url`, `remote_url`, `text_url`) oder auf eine Video-/
Audioendung endet, wird nicht geladen (`uebersprungen`). Der exakte Vergleichsschlüssel enthält bei
Video/GIF zusätzlich Dauer und Abmessungen (`MedienDaten.exakt_schluessel`). Audio und Medien ohne
Vorschaubild: kein Hash (`uebersprungen`, Schlüssel `art:ohne-hash:<medien_id>`, ohne ID
`art:ohne-hash:<inhalts_id>:<position>`). Leere Antworten und Antworten, die mit `<`, `{` oder `[`
beginnen, sind Download-Fehler. Cache nach `medien_id` in `medien_cache`: dasselbe Medium wird nie
zweimal geladen. `medien_hash` = SHA-256 über die sortierten Schlüssel aller Medien (mit `\n`
verbunden; Positionen 0-basiert); fehlt einer (Status `offen`/`fehler`), ist `medien_hash = None` und
`medien_vollstaendig = False`.

**Fingerabdruck:** SHA-256 über `t=<text_hash>|m=<medien_hash>|q=<quote_id>` (fehlende Teile als
leere Zeichenkette); `None`, wenn Text und Medien leer sind oder die Medien unvollständig.

## 24h-Messlogik

`db.snapshot_speichern(post, lauf_id, gemessen, grenze_h)`: Alter < 24 h → Snapshot bei jedem
Lauf (einer pro Lauf, `UNIQUE(post_id, lauf_id)`). Alter ≥ 24 h → nur, wenn es noch keinen gibt
(erstmals gesehen). Danach `eingefroren = 1`. Finaler Wert = letzter Snapshot (View
`post_final`). `backfill = 1` für Posts, die vor dem Start des allerersten Laufs erstellt wurden
und beim ersten Sehen schon ≥ 24 h alt waren („Endstand nach X Tagen“).

## Pagination, Lücken, Abdeckung

Tabelle `abdeckung` hält ID-Bereiche `[von, bis]`, die lückenlos paginiert wurden. Ein Lauf:

1. **Oben anfangen** (ohne `max_id`) und Seite für Seite (`max_id` = kleinste nicht gepinnte ID
   der Seite) nach unten gehen, bis **beides** erreicht ist: (a) der oberste bekannte Bereich
   (Überlappung mit bekannten Posts) und (b) die Untergrenze des Lösch-Fensters (jetzt − N Tage).
   Beim ersten Lauf: bis zur Backfill-Grenze (jetzt − 4 Wochen, in `meta` gemerkt).
2. **Lücken füllen:** Zwischen bekannten Bereichen (z. B. nach einem abgebrochenen Lauf) und
   bis zur Backfill-Grenze wird mit `max_id = Bereich.von` weiter paginiert, bis der nächste
   Bereich erreicht ist.
3. Eine leere Seite bedeutet „Anfang der Timeline erreicht“.
4. Gepinnte Posts (aus der Pinned-Liste oder `pinned: true`) zählen nicht für Stopp- und
   Überlappungsentscheidungen; sie werden nur gespeichert/aktualisiert.
5. Notbremse: `max_seiten_pro_lauf`.

## Löschungen und Edits

* Kandidaten: bekannte, nicht gelöschte Posts der letzten N Tage (Standard 7), deren ID im
  **in diesem Lauf lückenlos abgerufenen** Bereich liegt und die dort fehlen. Bei
  `exclude_replies=true` werden Replies an andere nicht als Kandidaten gezählt.
* Jeder Kandidat wird per Einzelabruf geprüft: 404 + JSON-Fehler → gelöscht
  (`loeschung_bestaetigt_utc`, `vermisst_seit_utc` = erstes Fehlen); 200 → vorhanden;
  alles andere → „unklar“ (`vermisst_seit_utc` gesetzt, nicht gelöscht). Challenge/429 →
  Lauf bricht ab, keine weiteren Prüfungen.
* Bricht die Pagination ab, gilt nur der bis dahin lückenlos abgerufene Bereich.
* Taucht ein als gelöscht markierter Post wieder auf, wird die Markierung entfernt.
* Edits (nur eigene Posts, keine Retruths): geändertes `edited_at` oder geänderter Text-Hash
  bzw. (bei vollständigen Medien) Medien-Hash → Zeile in `edits`. `edit_anzahl` = Maximum aus
  beobachteten Edits und `version − 1`. Ist ein Post schon beim ersten Sehen bearbeitet
  (`edited_at` gesetzt), gibt es eine `edits`-Zeile mit dem Zeitpunkt aus `edited_at`.

## Duplikate (14 Tage)

`duplikate.aktualisiere_duplikate(con, konfig, betroffene_ids, jetzt)`. Für jeden Post P und
jeden früheren Post Q mit `P.t − 14 d ≤ Q.t < P.t` (gleiche Sekunde: kleinere ID ist früher):

| Paar-Kategorie (stärkste zuerst) | Bedingung |
|---|---|
| 1 `gleiches_original` | `inhalts_id(P) == inhalts_id(Q)` (Original-ID bei Retruths, sonst eigene ID) |
| 2 `exakt` | gleicher Fingerabdruck (nicht `None`) |
| 3a `nur_text` | gleicher `text_hash` (nicht `None`), Medien verschieden |
| 3b `nur_medien` | gleicher `medien_hash` (nicht `None`), Text verschieden |
| 4 `medien_aehnlich` | gleiche Medienzahl ≥ 1, jedes Medium hat ein Gegenstück gleicher Art mit pHash-Abstand ≤ 6, Dauer ±1 s, Seitenverhältnis ±2 %; nicht schon exakt gleich |

Je Kategorie wird der zeitlich nächste frühere Post gespeichert (`duplikate`), die stärkste
Kategorie bekommt `primaer = 1`. Zeit = `created_at` des Posts (bei Retruths die Retruth-Zeit).
Präzisierungen: Ein Paar mit gleicher Inhalts-ID zählt nur als Fall 1. Gleicher Text bzw. gleiche
Medien mit anderem Quote-Ziel ergibt 3a bzw. 3b mit `details.quote_verschieden` (bei gleichem Text
*und* gleichen Medien genau eine Zeile 3a mit `medien_gleich`). Erfüllt ein 3a-Paar zugleich Fall 4,
bekommt die 3a-Zeile `details.medien_aehnlich` und `phash_abstand_max`. Bei unvollständigen Medien
gilt 3a nur bei verschiedener Medienzahl oder verschiedenem Quote-Ziel.
`dup_abdeckung_vollstaendig` = 1, wenn die 14 Tage davor lückenlos in der DB liegen und der Post
selbst vollständig gehasht ist. Noch nie bewertete Posts (`dup_geprueft_utc` leer) werden bei jedem
Lauf bewertet; `db.post_speichern` leert das Feld, wenn sich Vergleichsrelevantes ändert.

## Dashboard

Streamlit, deutsch, nur lesender DB-Zugriff. Globale Filter in der Seitenleiste: Zeitraum,
Zeitzone (New York/Berlin), Post-Typ, Format, dazu Serien-Schwelle, Messalter-Bereich (Standard
18–24 h), Backfill (aus), Gelöschte (an). Engagement nur mit Messalter-Filter; Backfill
standardmäßig ausgeschlossen. Ausgewertet wird nur der Erfassungsbereich (Backfill-Grenze bis letzter
Lauf); ältere Posts stehen nur in der Tabelle. Alle Berechnungen in `auswertung.py` (getestet); die
fachlichen Definitionen (Abstände in echter Zeit, Serie strikt < X Minuten, Pause gehört zum Endtag,
Duplikat-Rate nur mit vollständigem Fenster, Löschzeit als Intervall) stehen im Docstring von
`auswertung.py`. Theme in `.streamlit/config.toml`, eine andere Konfiguration per Umgebungsvariable
`TRUTHTRACKER_CONFIG`.

## Prüfskript

`python -m truthtracker pruefen` (bzw. `run_pruefung.bat`) sucht in DB (Spalten nach Positivliste
je Spaltenname, Rohdatei inkl. `-wal`/`-shm`/`-journal`), Logs, Temp-Ordner, Browserprofil
(Positivliste `browser.im_profil_erlaubt`), Exporten und Spike-Berichten nach Inhaltsresten: HTML,
Medien-URLs, fremde URLs, Freitext (mehr als 8 Wörter, die in keinem Meldungstext des Trackers
vorkommen). Stichproben mit `--abfragen`, `--marker-datei`, `--marker`. Der Bericht nennt nie den
Fund selbst. Exit-Code 0 sauber, 1 Funde, 2 Prüfung nicht möglich. Neue Meldungstexte müssen als
Zeichenkette direkt an der Ausgabestelle stehen (`log.*`, `meldung`, `print`, `raise` …), damit ihre
Wörter zum bekannten Wortschatz zählen.
