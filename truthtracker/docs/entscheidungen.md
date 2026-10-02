# Entscheidungen

Kleinere Entscheidungen, die SPEC.md offen lässt oder bei denen der Stack-Vorschlag abweicht,
jeweils mit Begründung. Reihenfolge grob nach Bereich.

## Rahmen und Aufbau

1. **Eigener Unterordner `truthtracker/`.** Das Repository enthält bereits ein anderes Projekt
   (Bitburner-Autopilot). Der Tracker liegt vollständig in `truthtracker/` mit eigener README,
   eigenen `.bat`-Dateien und eigener `.gitignore`; nichts außerhalb wurde verändert.
2. **venv + `requirements.txt` statt `uv`.** Ein Doppelklick auf eine `.bat` soll ohne zusätzliches
   Werkzeug funktionieren. `_umgebung.bat` legt beim ersten Start `.venv` mit dem Python-Launcher
   `py -3` an, prüft auf Python ≥ 3.12 und installiert nur neu, wenn sich `requirements.txt` ändert.
3. **`.bat`-Dateien mit CRLF und ASCII-Text** (`.gitattributes`), weil `cmd.exe` mit LF-Zeilenenden
   bei Sprungmarken stolpern kann und Umlaute in `echo` von der Codepage abhängen.
4. **Laufzeitdaten unter `laufzeit/`, Datenbank unter `daten/`**, beide in `.gitignore`.
5. **Kein Login.** SPEC nennt keinen Account; ein Login bräuchte Zugangsdaten und brächte
   Sicherheitsabfragen (`security_code_required`). Alles läuft ausgeloggt.

## Zugriff

6. **Der Spike konnte nicht aus der Entwicklungsumgebung laufen.** Dort war `truthsocial.com`
   per Proxy gesperrt. Statt anzuhalten (Arbeitsauftrag „autonom so viel wie möglich“), sind
   Spike-Werkzeug, Crawler und Tests gegen einen lokalen API-Nachbau gebaut, der die in
   öffentlichen Quellen belegte Struktur und Logik abbildet (siehe `zugriff.md`). Spike und echter
   Lauf auf dem Heim-PC stehen aus.
7. **Opera zuerst, dann Chrome, dann Edge** (`[zugriff] browser = "auto"`), auf Wunsch des Nutzers,
   der Opera als Hauptbrowser nutzt. **Eigenes Tracker-Profil, nie das Alltagsprofil:** Chromium
   erlaubt die Fernsteuerung des Standardprofils nicht mehr, der Alltagsbrowser müsste geschlossen
   sein, und die Datenschutz-Regel verlangt, nach jedem Lauf alles außer Cookies zu löschen.
8. **Browser normal starten, Playwright erst nach der Prüfung anhängen.** Der Browser startet als
   gewöhnliches Programm mit festem lokalen DevTools-Port (nicht Port 0: der schaltet
   `navigator.webdriver` ein) und der Konto-Abfrage als Startseite. Solange Cloudflare prüft, werden
   nur Tab-Titel über `http://127.0.0.1:<port>/json/list` gelesen; Playwright verbindet sich erst
   danach. So greift nichts in die Prüfung ein, die der Mensch löst. Keine Tarn-Patches, keine
   Lösedienste, keine Proxys.
9. **Im Browser ruft der Crawler die API per `fetch` aus der Seite auf**, statt die Web-App
   scrollen zu lassen und nur mitzuschneiden. Gleicher Netzwerkstapel und gleiche Cookies wie die
   Web-App, aber gezielte Pagination mit `max_id`, weniger Anfragen und keine Medien. Der Spike
   prüft beide Varianten (b1 Mitschnitt, b2 `fetch`).
10. **Bilder und Videos sind im Browser gesperrt** (Route-Abbruch für `image`/`media`, außer
    Cloudflare-Hosts) und der Cache ist per CDP abgeschaltet; der Festplatten-Cache liegt zusätzlich
    in einem Temp-Ordner, der nach dem Lauf gelöscht wird.
11. **Profil-Aufräumen per Positivliste:** Es bleiben nur `Cookies`, `Local State` (Schlüssel zur
    Cookie-Entschlüsselung unter Windows) und die Einstellungsdateien. Cache, Verlauf,
    Sitzungswiederherstellung (enthält Seitentitel), Local Storage, IndexedDB, Service Worker usw.
    werden gelöscht – vor und nach jedem Lauf.
12. **Nach einer Challenge läuft der ganze Lauf im Browser weiter.** `cf_clearance` ist an IP,
    User-Agent und Fingerabdruck gebunden; es in `curl_cffi` zu übertragen ist unsicher.
13. **`curl_cffi`-Ziel `chrome`** (neueste Chrome-Fassung der installierten Bibliothek). Feste Ziele
    veralten; truthbrush musste mehrfach nachziehen. Einstellbar in `config.toml`.
14. **Pausen 10–15 s statt 2–6 s.** Ohne Login wurden etwa 6 Anfragen pro Minute beobachtet, bevor
    429 kommt; SPEC verlangt bei 429 den Abbruch. 10–15 s bleiben sicher darunter. Ein täglicher Lauf
    dauert damit etwa 3–5 Minuten. Medienabrufe gehen an einen anderen Host und haben eigene,
    kürzere Pausen (1–3 s).
15. **`exclude_replies=true`.** Ohne Login gibt der Server die Timeline sonst mit 401 nicht heraus.
    Threads (Antworten an sich selbst) bleiben enthalten, Antworten an andere fehlen. Weil einzelne
    Beobachtungen auch ohne den Parameter 200 zeigten, probiert `replies_anderer = "auto"` das
    höchstens einmal pro Woche und merkt sich das Ergebnis.
16. **Werbung wird übersprungen** (`sponsored: true` oder fremder Account in Trumps Timeline).
17. **Medienabruf gesperrt ≠ Lauf abbrechen.** Eine Challenge oder ein 429 beim Laden eines Bildes
    stoppt alle weiteren Medienabrufe dieses Laufs, aber nicht die API-Abfragen (anderer Host). Die
    fehlenden Hashes holt ein späterer Lauf nach.
18. **Ein Netzwerk- oder 5xx-Fehler auf einer Timeline-Seite wird einmal wiederholt**, danach endet
    die Pagination für diesen Lauf (Abdeckung bis zur letzten guten Seite). Challenge, Block, 403
    und 429 werden nie wiederholt.

## Erfassung

19. **Retruth-URL = URL des Originals.** Ein Retruth hat keine eigene Seite; der Link in der
    Tabelle führt zum retruthed Post.
20. **Gepinnt-Status über `pinned=true`** (eine Anfrage pro Lauf), weil das Feld `pinned` ausgeloggt
    unzuverlässig ist. Gepinnte Posts zählen auf der ersten Seite nicht für die Stopp-Entscheidung,
    da sie dort außer der Reihe stehen können; auf Folgeseiten stehen sie an ihrer zeitlichen Stelle.
21. **Zähler `-1` → unbekannt.** Truth Social nutzt `-1` als Platzhalter. Weitere Zähler
    (`upvotes_count`, `downvotes_count`, `quotes_count` …) werden als JSON mitgespeichert.
22. **Snapshot-Zeitpunkt = Abrufzeit der Seite.** Jede Seite wird sofort gespeichert, inklusive
    Snapshot. So bleibt bei einem Abbruch alles Gesammelte erhalten.
23. **Backfill-Posts** sind Posts, die vor dem allerersten Lauf erstellt wurden und beim ersten
    Sehen schon mindestens 24 h alt waren. Posts, die nach dem ersten Lauf entstanden, aber wegen
    einer Lücke erst spät gesehen wurden, sind keine Backfill-Posts; ihr Messalter steht dabei
    („gemessen nach 50,2 h“) und der Messalter-Filter schließt sie aus Vergleichen aus.
24. **Edits nur bei eigenen Posts.** Bei Retruths ändert sich der Inhalt, wenn der fremde Autor
    editiert; das ist kein Verhalten Trumps. `edit_anzahl` zählt beobachtete Änderungen (geändertes
    `edited_at` oder geänderter Inhalts-Fingerabdruck); mehrere Edits zwischen zwei Läufen zählen als
    einer.

## Löschungen

25. **Jeder Lauf paginiert mindestens die letzten N Tage** (Standard 7). Nur so liegen alle Posts des
    Lösch-Fensters „im abgedeckten Zeitfenster der aktuellen Abfrage“, wie SPEC es verlangt. Das
    kostet bei rund 25 Posts pro Tag etwa 5–9 Seiten.
26. **„Gelöscht“ heißt „öffentlich nicht mehr abrufbar“.** Der Server antwortet auch für verborgene
    (moderierte) Posts mit 404; das lässt sich ausgeloggt nicht unterscheiden.
27. **Threads (Replies an sich selbst) lassen sich ausgeloggt nicht einzeln prüfen** (401). Fehlen
    sie, bleibt es bei „vermisst seit“, nie „gelöscht“.
28. **Höchstzahl Einzelabrufe pro Lauf** (`max_einzelabrufe_pro_lauf = 40`). Bei mehr Kandidaten
    werden die neuesten zuerst geprüft, der Rest im nächsten Lauf.

## Datenschutz

29. **Medien nur im Speicher**, nie auf der Platte. Bilder: Originaldatei, weil der exakte
    Vergleich die Datei braucht; Videos und GIFs: nur das Vorschaubild. Ein Medium wird nur einmal
    geladen (Cache nach Medien-ID).
30. **SQLite mit `secure_delete`**, damit gelöschte Daten nicht in freien Seiten liegen bleiben.
31. **Logs nur mit IDs und Zählern;** Logmeldungen von Fremdbibliotheken (die URLs enthalten
    könnten) sind auf „Fehler“ gedrosselt.
32. **Keine Drittquellen.** Die Recherche fand öffentliche Archive (CNN, trumpstruth.org); SPEC
    verlangt Truth Social direkt, daher ungenutzt.
