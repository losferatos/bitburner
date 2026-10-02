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
    editiert; das ist kein Verhalten Trumps. Erkannt wird ein Edit an geändertem `edited_at` oder
    geändertem Inhalts-Fingerabdruck (Zeile in `edits`). `edit_anzahl` ist das Maximum aus den
    beobachteten Edits und `version − 1` (Truth Social zählt Revisionen im Feld `version`); so zählen
    auch mehrere Edits zwischen zwei Läufen und Edits vor dem ersten Sehen.

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
    Vergleich die Datei braucht; Videos und GIFs: nur das Vorschaubild. `medien.py` fragt nie eine
    Adresse an, die (vereinheitlicht verglichen) die der Mediendatei selbst ist (`url`, `remote_url`,
    `text_url`), und keine mit Video- oder Audioendung. Der Transport liest eine Antwort erst, nachdem
    Status, `Content-Type` (`image/*`) und `Content-Length` geprüft sind; im Browser werden
    Videoströme blockiert. Ein Medium wird nur einmal geladen (Cache nach Medien-ID).
30. **SQLite mit `secure_delete`**, damit gelöschte Daten nicht in freien Seiten liegen bleiben.
31. **Logs nur mit IDs und Zählern;** Logmeldungen von Fremdbibliotheken (die URLs enthalten
    könnten) sind auf „Fehler“ gedrosselt.
32. **Keine Drittquellen.** Die Recherche fand öffentliche Archive (CNN, trumpstruth.org); SPEC
    verlangt Truth Social direkt, daher ungenutzt.

## Text und Klassifikation

33. **Sichtbarer Text:** Leerraum am Rand jedes Absatzes und jeder Zeile zählt nicht, leere Absätze
    entfallen, Absätze sind durch genau eine Leerzeile getrennt, jedes `<br>` zählt einzeln. `div`,
    `blockquote`, `pre`, Listen und Überschriften trennen wie `<p>`, `<li>` wie `<br>`; `script`,
    `style`, `template` sind unsichtbar. So hängt die Zeichenzahl nicht vom HTML-Quelltext ab.
34. **Links auf das zitierte Original eines Quotes** (auch der Mastodon-Fallback `RE: …`, auch als
    nackte URL, erkannt über URL oder Status-ID) gehören weder zu den URLs noch zum sichtbaren Text.
    Sonst wäre ein leeres Quote „nur Text“ statt „leer/sonstiges“.
35. **Mention vs. Link:** Ohne Klasse `mention`/`hashtag` gilt ein Link auf Truth Social nur bei einer
    Profilseite (`/@name`) als Mention; ein Link auf einen Post (`/@name/123`) ist eine URL (ohne
    externe Domain). Links ohne `href` oder ohne sichtbaren Text zählen nicht.
36. **Nackte URLs:** Satzzeichen am Ende (auch typografische, CJK-Satzzeichen) gehören nicht dazu,
    eine schließende Klammer nur ohne öffnendes Gegenstück.
37. **`zeichen_ohne_urls`:** Leerraum wird nur an der Nahtstelle einer entfernten URL zu einem
    Leerzeichen; eine Zeile nur aus URLs fällt samt Umbruch weg. Ohne URLs gilt
    `zeichen == zeichen_ohne_urls`.
38. **Link-Domains** nur als echte Hosts (mit Punkt und Buchstaben- oder Punycode-TLD, oder IPv4),
    IDN in Punycode. Ein Wort hinter `http://` ist keine Domain; so kann über das Domain-Feld kein
    Freitext in die DB gelangen.
39. **Post-URL** nur in der Form `https://truthsocial.com/@name/ID` (aus `url`, ersatzweise `uri`, dann
    Handle + ID). Fremde (föderierte) Adressen werden nicht übernommen, sie können Titel im Pfad
    tragen. Ohne Handle bleibt die URL leer.
40. **Strenge Eingabeprüfung:** IDs nur als Ziffern (1 bis 2⁶³−1), Handles nur `[A-Za-z0-9_]` mit
    optionalem `@domain`, Sichtbarkeit nur aus der bekannten Liste, Anzeigenamen einzeilig, höchstens
    100 Zeichen und ohne HTML/URLs (sonst nicht gespeichert). Kaputte UTF-16-Surrogate werden zu
    U+FFFD. Ein fehlerhafter Post wird übersprungen, nie wird ein Inhalt in einer Fehlermeldung
    weitergegeben (der HTML-Parser fällt bei Fehlern auf bloßes Tag-Entfernen zurück).
41. **`reply_art = fremd`,** wenn das Ziel-Konto unbekannt ist: „Thread“ verlangt nachgewiesene
    Gleichheit mit dem Autor.
42. **Gepinnt ohne Pinned-Liste** ist „unbekannt“ (nur `pinned: true` ergibt ja), weil `pinned`
    ausgeloggt immer `false` ist; die DB behält dann den bisherigen Stand.

## Medien und pHash

43. **pHash selbst implementiert** (Pillow + numpy, DCT-II 32×32, obere 8×8 Koeffizienten, Median),
    ohne `imagehash`/`scipy`: weniger Abhängigkeiten unter Windows. Koeffizienten werden auf 6
    Nachkommastellen gerundet, damit der Hash auf jedem Rechner bitgleich ist.
44. **Bildformate** nur JPEG, PNG, GIF, WEBP, AVIF, BMP (keine Ghostscript- oder Altformat-Parser);
    Grenze 40 Megapixel gegen Dekompressionsbomben; Transparenz auf Weiß, 16-Bit-Graustufen korrekt
    auf 8 Bit; EXIF-Drehung wird angewendet, kaputtes EXIF ignoriert.
45. **Fehlerseiten sind keine Medien:** Leere Antworten oder solche, die mit `<`, `{` oder `[`
    beginnen, gelten als Download-Fehler. Sonst bekämen alle Medien hinter einer Fehlerseite denselben
    Hash.
46. **Kein Ausweichen auf die Vorschau**, wenn das Original eines Bildes nicht lädt: Der Hash käme aus
    einer anderen Datei. Der Status bleibt „Fehler“, ein späterer Lauf versucht es erneut.
47. **Medien ohne Hash** (Audio, keine Vorschau) werden über ihre Medien-ID verglichen; ohne ID gilt
    ein Medium nur als gleich mit sich selbst (Inhalts-ID + Position).

## Duplikate

48. **Ein Paar, eine Kategorie:** Zwei Retruths desselben Originals sind nur Fall 1, nicht zusätzlich
    2, 3 oder 4. Für 2–4 wird dann der nächste frühere Post mit anderer Inhalts-ID gesucht.
49. **Quote-Ziel:** Der Fingerabdruck enthält die `quote_id`. Gleicher Text (bzw. gleiche Medien) mit
    anderem Quote-Ziel ist daher nicht „exakt“, sondern „nur Text“ (bzw. „nur Medien“) mit Zusatz
    „anderes Quote-Ziel“.
50. **„Nur Text“ mit wahrscheinlich gleichen Medien:** Lädt Trump dasselbe Bild neu hoch, sind die
    Medien nicht byte-gleich. Die Rangfolge (3a vor 4) bleibt, die Zeile bekommt aber den Zusatz
    „Medien wahrscheinlich gleich (pHash-Abstand n)“, den das Dashboard anzeigt.
51. **Fall 4** sucht eine echte 1:1-Zuordnung der Medien mit dem kleinsten größten pHash-Abstand
    (Engpass-Zuordnung), Kandidaten über einen Block-Index der 64 Bits; Seitenverhältnis-Toleranz
    symmetrisch.
52. **Vollständigkeit:** Ein Post zählt für die Duplikat-Rate nur, wenn die 14 Tage davor lückenlos
    erfasst sind und seine eigenen Medien gehasht sind. Fehlende Hashes *früherer* Posts zählen nicht,
    sonst nähme ein einziger dauerhaft gescheiterter Download 14 Tage aus der Rate.
53. **Nachholen:** Noch nie bewertete Posts werden bei jedem Lauf bewertet; ändert sich an einem Post,
    was verglichen wird, gilt er wieder als unbewertet. So überlebt die Duplikat-Prüfung auch einen
    Absturz mitten im Lauf.

## Dashboard

54. **Erfassungsbereich:** Auswertungen nutzen nur Posts ab der Backfill-Grenze bis zum letzten Lauf.
    Ältere Posts (z. B. ein alter gepinnter) stehen nur in der Tabelle und im CSV (Spalte „Vor Beginn
    der Erfassung“); sie würden Frequenz und Abstände verfälschen.
55. **Zeiten:** Abstände, Pausen, Serien in echter Zeit (UTC-Differenz), Kalendertage in der gewählten
    Zone. Die längste Pause gehört zu dem Tag, an dem sie endet. Eine Serie sind mindestens zwei Posts
    mit jeweils strikt weniger als X Minuten Abstand.
56. **Posts pro Tag** teilt durch erfasste Tage; angeschnittene Randtage zählen anteilig (inkl.
    23/25-Stunden-Tagen bei Zeitumstellung).
57. **Engagement:** Median als Balken, Mittelwert im Tooltip. Die Reihe „Original“ (Retruths) zählt nur,
    wenn auch das Original beim Messen im Messalter-Bereich lag; „pro Stunde“ teilt durch dessen
    Alter. Backfill nur auf Wunsch und dann mit Warnung.
58. **Duplikat-Rate** nur mit vollständigem 14-Tage-Fenster als Nenner; Verteilungen zählen je Post die
    stärkste Art.
59. **CSV für deutsches Excel:** UTF-8 mit BOM, Semikolon, Dezimalkomma, IDs als Text (`="…"`, sonst
    rundet Excel 18-stellige IDs), Formel-Schutz für Texte mit `= + - @`.
60. **Farben:** feste Palette je Typ/Format/Art (Farbe folgt der Kategorie, nicht dem Rang), helle und
    dunkle Variante; Streamlit nur unter `localhost`, ohne Telemetrie, ohne festen Port (weicht bei
    belegtem Port aus).

## Prüfskript

61. **Positivlisten je Spalte** statt Inhaltssuche: Zeitstempel, IDs, Hashes, Kennwörter, Post-URLs,
    Domains, Zählernamen. Unbekannte Spalten dürfen nur solche Werte enthalten; jeder BLOB ist ein Fund.
62. **Freitext-Regel:** Eine Zeile/Zelle mit mehr als 8 Wörtern, die in keinem Meldungstext des
    Trackers vorkommen, gilt als Inhaltsrest. Wörter mit Ziffern oder Unterstrich zählen nicht. Kurze
    Posts findet die Regel nicht; dafür gibt es Stichproben (`--abfragen`, `--marker-datei`).
63. **Rohdatei-Suche** in DB, `-wal`, `-shm`, `-journal` (blockweise, kein mmap, damit ein
    gleichzeitiger Crawl unter Windows nicht blockiert); kurze HTML-Muster zählen nur mit druckbarem
    Text daneben.
64. **Nur lesend:** ohne `-wal` mit `immutable=1`, damit die Prüfung keine Dateien anlegt.
65. **Exit-Codes** 0 sauber, 1 Funde, 2 Prüfung nicht möglich. Ungeprüft ist nicht sauber: Nicht
    lesbare Orte sind Funde. Der Bericht nennt nie den Fund selbst, nur Ort, Art, Länge.
