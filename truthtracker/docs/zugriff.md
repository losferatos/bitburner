# Zugriff auf Truth Social: Spike-Ergebnis

Stand: 02.10.2026. Dieses Dokument hält fest, welcher Zugriffsweg gewählt ist und warum,
was belegt ist und was noch auf deinem Rechner gemessen werden muss.

## Kurzfassung

| Weg | Status | Einsatz im Crawler |
|---|---|---|
| a) JSON-API per `curl_cffi` (Chrome-Impersonation) | Laut Recherche von Heim-IPs funktionsfähig; aus Rechenzentren meist Cloudflare-403. **Auf deinem PC noch nicht gemessen.** | Standard (`[zugriff] weg = "auto"` beginnt hier) |
| b) Echter Browser (Opera → Chrome → Edge), eigenes Profil, sichtbar | Mechanik getestet (Chromium, simulierte Challenge); live noch nicht gemessen | Automatischer Wechsel bei Cloudflare-Prüfung; du löst sie im Fenster |
| c) HTML-Parsing | nicht gebaut | nicht nötig, solange a oder b JSON liefert |

**Offen:** Der Live-Spike und ein echter Lauf gegen truthsocial.com. Aus der Cloud-Umgebung,
in der dieser Code entstanden ist, war der Host gesperrt (Proxy: `CONNECT 403` für
`truthsocial.com:443`). Ein Messergebnis aus einem Rechenzentrum wäre für deine Heim-IP
ohnehin nicht aussagekräftig gewesen. Bitte `run_spike.bat` ausführen. Der Bericht landet unter
`docs/zugriff-messungen/` und enthält nur Statuscodes, Feldnamen und Zählwerte. Danach diesen
Abschnitt mit dem Ergebnis aktualisieren (siehe unten „Messung auf dem Heim-PC“).

## Was belegt ist (Recherche in öffentlichen Repos, Stand 2026-09/10)

Quellen: der veröffentlichte Truth-Social-Servercode (Mastodon-Fork, Spiegel `milesmcc/truthsocial`,
Stand 2025-05), Soapbox (Web-Frontend), aktive Tracker-Projekte (`hemmendinger/political-social-media`,
`stanfordio/truthbrush` bzw. `w2rc/truthbrush`, `travisbrown/truthsocial`, `stiles/trump-truth-social-archive`
und Fork `aristotle-tek`), alle per `git clone` gelesen. Keine Inhalte übernommen.

**Endpunkte und Parameter**

* `GET /api/v1/accounts/lookup?acct=realDonaldTrump` → Account inkl. `followers_count`,
  `following_count`, `statuses_count`, `verified`. Konto-ID `107780257626128497`.
* `GET /api/v1/accounts/{id}/statuses` mit `max_id`, `limit` (Standard 20, laut Code höchstens 40;
  live wurde `limit=40` mit 20 Einträgen beantwortet), `exclude_replies`, `only_media`, `pinned`.
  Sortierung nach ID absteigend. `min_id` wird live offenbar ignoriert; der Crawler nutzt nur
  `max_id` und erkennt das Ende an einer leeren Seite, nie an der Seitengröße. Eine leere Seite
  gilt aber nur dann als Anfang der Timeline, wenn das zur Postzahl des Kontos passt; sonst ist sie
  ein Fehler, und die Lücke darunter bleibt offen (Entscheidung 67).
* Die Lese-API weicht live vom veröffentlichten Rails-Code ab (Fehlertexte im Stil von Go/GORM,
  andere Limits, zusätzliche Felder). Der Code dient nur als Indiz; maßgeblich sind Live-Belege.
* **Laut Code ohne Login nur mit `exclude_replies=true`** (oder `only_media`/`pinned`), sonst HTTP 401
  (`{"error":"This method requires an authenticated user"}`). `exclude_replies=true` lässt
  Antworten an sich selbst (Threads) drin. Live haben zwei Projekte auch mit
  `exclude_replies=false` bzw. ganz ohne Filter 200 bekommen; in 180 so geholten Posts war trotzdem
  kein Reply an andere. Der Crawler probiert es höchstens wöchentlich (`replies_anderer = "auto"`),
  fällt bei 401 sofort zurück und merkt sich das Ergebnis.
* Trumps Account-Objekt hat live `unauth_visibility: true`: Er ist ausgeloggt abrufbar.
* Gepinnte Posts: `…/statuses?pinned=true&with_muted=true` (so lädt sie die Web-App), eine Seite.
* `GET /api/v1/statuses/{id}`: ohne Login nur für Posts, die **kein** Reply sind (sonst 401).
  Gelöscht (oder für Dritte verborgen): HTTP 404 mit JSON-Fehler; live (11.09.2026, gelöschter
  Retruth) `{"error":"record not found"}`, laut Code
  `{"error_message":"Record not found","error_code":"NOT_FOUND","error":"Record not found"}`.
  Der Crawler verlangt 404 plus JSON-Objekt mit `error`. Ein nackter Text-404 (z. B.
  „404 page not found“ einer unbekannten Route) zählt nicht.
* Rate-Limit: laut Code 300 Anfragen pro 5 Minuten und IP; **live ohne Login aber etwa 5–6 Anfragen
  pro Minute**, dann 429 (mal mit, mal ohne `Retry-After`), nach rund 60 s wieder frei. Daher
  10–15 s Pause zwischen Anfragen.
* Werbung kann laut Code in die Account-Timeline gemischt werden (`sponsored: true`, fremder
  Account); in 180 live geholten Posts kam keine vor. Der Crawler überspringt sie trotzdem.

**Felder eines Status (live beobachtet, 2026-09, unauthentifiziert)**

`bookmarked, card, content, created_at, downvotes_count, editable, edited_at, embedded_announcement,
emojis, favourited, favourites_count, group, id, in_reply_to, in_reply_to_account_id, in_reply_to_id,
language, media_attachments, mentions, muted, next_status, pinned, poll, quote, quote_id, reaction,
reblog, reblogged, reblogs_count, replies_count, sensitive, signature, spoiler_text, sponsored, tags,
title, upvotes_count, uri, url, version, visibility, votable` plus `account`.
Truth-Social-Eigenheiten, die der Crawler berücksichtigt:

* `quote`/`quote_id`: Quotes (eingebettetes Status-Objekt mit Account).
* `in_reply_to`: eingebettetes Ziel eines Replies, Zähler dort `-1` (Platzhalter).
* Zähler können generell `-1` sein → als „unbekannt“ gespeichert.
* `upvotes_count`/`downvotes_count` → als weitere Zähler gespeichert.
* `edited_at`, `editable`, `version` → Edit-Erkennung über `edited_at` und Inhalts-Fingerabdruck;
  `version` zählt die Revisionen (`"1"` unbearbeitet, `"2"` nach einem Edit) und wird für die
  Edit-Anzahl genutzt. `editable` wird nach etwa 24 h `false`.
* `pinned` ist ausgeloggt in der Timeline immer `false`; gepinnte Posts kommen aus `pinned=true`.
* Reblog-Wrapper haben eigene, kleine Zähler; die des Originals stehen unter `reblog.*`.
* `signature` (enthält den Abrufzeitpunkt), `next_status` (nur bei Videos: nächster Eintrag eines
  Video-Feeds), `favourited`, `reblogged`, `muted`, `bookmarked`, `reaction` sind abruf- bzw.
  betrachterbezogen und werden ignoriert.
* Medien: `type` ∈ `image, video, gifv, audio, unknown, tv`; Abmessungen und Dauer unter
  `meta.original.width/height/duration` (in 37 von 37 Videos dort, nie unter `meta.duration`);
  `preview_url` ist bei Videos ein Standbild; `processing` ist normalerweise `complete`.

**Cloudflare**

* Von Rechenzentrums-IPs (GitHub-Runner, Cloud-Server) kommt durchgehend Cloudflare-403. Vom
  Heim-Desktop kam am 11.09.2026 sogar mit Python-`urllib` sofort 200; andere melden für Heim-IPs
  403 ohne Impersonation, `curl_cffi` mit `chrome` bzw. `safari` ging. Das hängt vermutlich am
  IP-Ruf; die Client-Matrix des Spikes klärt es für deinen Anschluss.
* truthbrush musste das Impersonate-Ziel mehrfach anheben (chrome120 → chrome146). Der Crawler
  nutzt das generische Ziel `chrome` (neueste Fassung der installierten `curl_cffi`).
* Ein automatisierter Chromium mit `navigator.webdriver = true` lässt Cloudflares Prüfung endlos
  kreisen (auf truthsocial.com beobachtet). Chromium setzt das u. a. bei `--remote-debugging-port=0`
  und beim Start durch Playwright. Deshalb startet der Tracker den Browser selbst mit festem Port
  und verbindet sich erst nach der Prüfung.
* Geoblocking ist nur für die Ukraine belegt; für Deutschland gibt es Indizien für Erreichbarkeit
  (Traffic-Statistiken), aber keinen direkten Test.
* `cf_clearance` ist an User-Agent und IP gebunden; deshalb läuft nach einer gelösten Prüfung der
  ganze Lauf im Browser weiter, statt Cookies in `curl_cffi` zu übertragen.

## Wie der Spike misst

`run_spike.bat` (Modul `truthtracker.spike`) hält dieselbe Laufsperre wie der Crawler: Läuft
schon ein Crawl oder Spike, meldet er das, fragt nichts an, fasst Temp-Ordner und Profil nicht an,
schreibt keinen Bericht und endet mit Exit-Code 3. Er prüft:

* **Weg a (höchstens 15 Anfragen):** Client-Matrix mit 4 Lookups (urllib, curl_cffi
  chrome/safari/firefox), dann Lookup, bis zu 5 Timeline-Seiten
  (`exclude_replies=true&with_muted=true&limit=40`), gepinnte Posts, ein Einzelabruf, eine Probe mit
  `exclude_replies=false` und eine „nicht gefunden“-Probe mit einer ID von 2020 (vor dem Start von
  Truth Social, kann nicht existieren). Zuletzt ein Bild, aber nur, wenn die Stichprobe eines hat,
  das der Crawler laden würde: genau die Adresse, die er hasht, nie eine Videodatei; Status,
  `Content-Type` und Größe werden vor dem Lesen geprüft. 14 Pausen von 10–15 s.
* Zwischen Weg a und Weg b: eine Pause von 10–15 s.
* **Weg b (6 eigene Anfragen):** Opera (sonst Chrome, sonst Edge) mit eigenem Profil
  `laufzeit/browser-profil`, sichtbar. Startseite ist wie beim Crawler die Konto-Abfrage (JSON);
  während einer Cloudflare-Prüfung hängt sich nichts an. Erst danach verbindet sich Playwright,
  schaltet den Cache ab und sperrt Bilder und Videos für den ganzen Browser. b1: Profilseite öffnen
  und mitschneiden, welche API-Pfade die Web-App lädt. b2: Lookup, 2 Timeline-Seiten und die
  „nicht gefunden“-Probe per `fetch` aus der Seite. 5 Pausen von 10–15 s. Nach dem Lauf bleiben im
  Profil nur Cookies und Einstellungen, auch wenn das Beenden des Browsers scheitert.
* **Anfragen ehrlich gezählt:** Die eigenen Anfragen der Web-App an Truth Social zählen mit und
  stehen im Bericht getrennt (`webapp_anfragen`: API, sonstige, andere Hosts); gesperrte Medien
  stehen unter `medien_gesperrt` und gehen nie raus. Nicht zählbar sind `/favicon.ico` und Anfragen
  während einer Prüfung vor dem Anhängen (`hinweis_anfragen`). Insgesamt höchstens 21 eigene
  Anfragen plus die der Web-App, 20 Pausen (200–300 s).
* **429 und Prüfungen:** Ein 429 in Weg a beendet ihn sofort, Weg b startet dann nicht
  (`uebersprungen_ratelimit`); frühestens 15 Minuten später mit `run_spike.bat --nur b` nachholen.
  Bekommt die Web-App in b1 ein 429, eine Prüfung oder eine Sperre, oder zeigt die Profilseite
  selbst eine Prüfung, endet Weg b dort (`profilseite_webapp` bzw. `profilseite`), bevor eine eigene
  Anfrage folgt. Sperrseiten erkennt der Spike am HTTP-Status, nicht am Seitentext; Post-Texte mit
  „you have been blocked“ lösen nichts aus.
* **Dauer:** etwa 4–6 Minuten ohne Prüfung, dazu die Zeit zum Lösen einer Prüfung (höchstens
  5 Minuten). `--nur a` etwa 2,5–4 Minuten, `--nur b` etwa 1–2 Minuten.
* Bericht: Statuscodes, ausgewählte Kopfzeilen (Rate-Limit, Cloudflare-Merkmale, nur
  Cookie-*Namen*), Feldkatalog (Pfade, Typen, Häufigkeiten), Seitengrößen, Ordnung, gepinnte
  Positionen, Zeitspannen, Anfragezahlen (`anfragen_gesamt`). Keine Inhalte.

## Messung auf dem Heim-PC

**Status: ausstehend.** Der Spike und der erste echte Lauf können nur auf deinem Rechner laufen; aus
der Entwicklungsumgebung war truthsocial.com gesperrt (siehe oben). Bis zu dieser Messung gilt der
Tracker als **nicht abgenommen**: Die Definition of Done verlangt einen erfolgreichen echten Lauf mit
dokumentierter Anzahl Requests und Dauer.

Was hier nach `run_spike.bat` und `run_crawl.bat` hineingehört (alles steht im Spike-Bericht unter
`docs/zugriff-messungen/` bzw. im Reiter „Läufe“ des Dashboards):

* Datum, Ergebnis Weg a / Weg b, Empfehlung des Spikes, Anzahl Anfragen, Dauer.
* Ob `exclude_replies=false` ohne Login ging (`probe_mit_replies`).
* Abweichungen im Feldkatalog gegenüber der Liste oben (dann den Crawler anpassen).
* Erster Crawl: Status, Anfragen (API und Medien), Dauer, neue Posts, Zugriffsweg.
