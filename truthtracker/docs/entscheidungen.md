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
    werden gelöscht: zu Beginn jedes Laufs, unabhängig vom Zugriffsweg (so holt auch ein Lauf ohne
    Browser die Reste eines abgestürzten Browser-Laufs nach), und nach jedem Browser-Lauf. Läuft der
    Tracker-Browser noch, bleibt das Profil unangetastet, und das Laufprotokoll sagt es.
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
17. **Cloudflare auf dem Medienweg beendet den Lauf, an der Seitengrenze.** Challenge, 429,
    Cloudflare-Block oder Regionssperre beim Laden eines Bildes stoppen sofort alle weiteren
    Medienabrufe. Die laufende Seite wird ohne weitere Anfrage zu Ende gespeichert, dann bricht der
    Lauf vor der nächsten API-Anfrage ab (SPEC Zugriff 3; Status „abgebrochen“, Meldung „Abbruch beim
    Medienabruf …“). Der Medien-Host liegt in derselben Cloudflare-Zone; eine Hürde dort betrifft
    denselben Client. Ein schlichter 403 ohne Cloudflare-Merkmale (Objektspeicher: `AccessDenied`)
    betrifft nur das eine Medium und zählt nicht als Sperre.
18. **Ein Netzwerk- oder 5xx-Fehler auf einer Timeline-Seite wird einmal wiederholt**, danach endet
    die Pagination für diesen Lauf (Abdeckung bis zur letzten guten Seite). Challenge, Block, 403
    und 429 werden nie wiederholt. Das Medien-Nachladen endet beim ersten Netzwerk- oder 5xx-Fehler,
    die Löschprüfung nach zweien in Folge. Hat in einem Lauf keine einzige Anfrage eine Antwort
    bekommen, endet er mit Status „Fehler“ statt „erfolgreich“.

## Erfassung

19. **Retruth-URL = URL des Originals.** Ein Retruth hat keine eigene Seite; der Link in der
    Tabelle führt zum retruthed Post.
20. **Gepinnt-Status über `pinned=true`** (eine Anfrage pro Lauf), weil das Feld `pinned` ausgeloggt
    unzuverlässig ist. Gepinnte Posts zählen auf der ersten Seite nicht für die Stopp-Entscheidung,
    da sie dort außer der Reihe stehen können; auf Folgeseiten stehen sie an ihrer zeitlichen Stelle.
21. **Zähler `-1` → unbekannt.** Truth Social nutzt `-1` als Platzhalter. Weitere Zähler
    (`upvotes_count`, `downvotes_count`, `quotes_count` …) werden als JSON mitgespeichert.
22. **Snapshot-Zeitpunkt = Eingang der Antwort** (nach Pause und eventueller Wiederholung). Jede Seite
    wird sofort gespeichert, inklusive Snapshot und Zwischenstand der Laufzähler. So bleibt bei einem
    Abbruch alles Gesammelte erhalten.
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
    Alter. Backfill nur auf Wunsch und dann mit Warnung. Welche Messung je Post zählt und wie
    Retruths nach Format und Uhrzeit eingehen, regeln Nr. 77 und 78.
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

## Robustheit (nach dem Review)

66. **Laufsperre** (`laufzeit/crawl.lock`): Ein zweiter Start, ob Crawl oder Spike, fragt nichts an,
    fasst weder Datenbank noch Temp-Ordner an und meldet „Kein Lauf gestartet“ (Exit-Code 3). Die
    Sperre hält das Betriebssystem auf der offenen Datei; ein Absturz gibt sie frei.
67. **Leere Timeline-Seite ≠ Anfang der Timeline.** Truth Social liefert ausgeloggt ab einer gewissen
    Tiefe mitunter leere Seiten. Als Anfang gilt eine leere Seite nur, wenn unterhalb keine bekannten,
    nicht gelöschten Posts liegen und die Datenbank bis auf 5 alle Posts kennt, die der Lookup
    (`statuses_count`) nennt. Sonst: Fehler im Protokoll, die Abdeckung endet an der letzten vollen
    Seite, in diesem Lauf keine weiteren Lückenversuche; der nächste Lauf versucht es erneut.
68. **Abdeckung nach gesehenen IDs, nicht nach der PC-Uhr.** Der oberste Bereich endet in der
    Datenbank bei der größten gesehenen Post-ID; der nächste Lauf paginiert bis zu ihr (Überlappung).
    Für die Löschprüfung des laufenden Laufs reicht er bis ganz oben, denn Seite 1 zeigt immer die
    neuesten Posts. Eine vorgehende PC-Uhr kann so keinen ID-Bereich als erfasst markieren, den der
    Server noch gar nicht hatte. Das 14-Tage-Duplikat-Fenster eines Posts endet beim Post selbst (nur
    frühere Posts zählen), daher ist es auch für den neuesten Post vollständig.
69. **Browser: Die Startseite zählt als Anfrage und wird bewertet.** Nach dem Anhängen wird das schon
    geladene Dokument ohne neue Anfrage geprüft (Status aus der Navigation-Timing-API): 429, Sperre oder
    403 beenden den Lauf sofort. Der erste `fetch` danach bekommt die normale Pause; beim Wechsel aus
    `auto` liegt auch vor dem Browserstart eine Pause.
70. **Sperrseiten im Browser nach HTTP-Status, nicht nach Seitentext.** Ein Dokument mit 2xx ist nie
    eine Sperre; Textmarker gelten nur bei Fehlerstatus oder einer erkennbaren Cloudflare-Fehlerseite.
    So lösen Post-Texte wie „you have been blocked“ keinen Abbruch aus. Cloudflares Klartextsperren
    („error code: 1005“ bis „1012“, „1020“) zählen als Block, „1015“ als Rate-Limit.
71. **Zweite Prüfung mitten im Lauf:** Playwright trennt sich vom Browser, der Mensch löst die Prüfung,
    der Lauf wartet wie beim Start über die Tab-Titel und hängt sich danach wieder an. Höchstens einmal
    pro Lauf; kreist die Prüfung, endet der Lauf.
72. **Browserfenster geschlossen:** Das Warten endet sofort mit klarer Meldung (Status „Fehler“), statt
    bis zur Wartezeit zu laufen. Ist Playwright gerade nicht angehängt, verbindet sich der Tracker zum
    Schließen kurz per CDP, damit der Browser seine Cookies sauber schreibt.
73. **Beenden des Browsers** gilt erst als gelungen, wenn der DevTools-Port zu, der echte
    Browserprozess (bei Opera nicht der Launcher, der sofort endet) weg und das Profil frei ist. Unter
    Windows prüft der Tracker Prozesse über die Prozess-API statt über `tasklist`-Text, dessen Codepage
    und Sprache vom System abhängen. Das Aufräumen hängt nie davon ab, dass das Beenden gelingt.
74. **Retruth ohne Original** (`reblog: null`, weil das Original gelöscht oder ausgeloggt verborgen
    ist) bleibt ein Retruth mit bisherigem Stand: kein Umklassifizieren zum eigenen Post, kein
    Phantom-Edit.
75. **Abgestürzte Läufe** behalten die Zähler und als Ende den letzten Zwischenstand (nach jeder Seite
    gespeichert), nicht den Start des nächsten Laufs.
76. **Windows-Pfade in `config.toml`** in einfachen Anführungszeichen (TOML-Literalstring). Bei einem
    Escape-Fehler nennt die Fehlermeldung genau das.

## Dashboard (nach dem Review)

77. **Engagement je Post aus der spätesten Messung im Messalter-Bereich**, nicht aus dem letzten
    Snapshot überhaupt. Bei mehreren Läufen am Tag hat ein Post mehrere Messungen unter 24 h; „0–6 h“
    vergleicht dann die frühe Messung. Zähler, Original-Zähler, Messalter und Alter des Originals
    stammen aus derselben Messung. Reicht der Bereich bis 24 h oder darüber, ist das immer der letzte
    Snapshot (ab 24 h wird nicht mehr gemessen). Backfill-Posts (nur auf Wunsch) gehen mit ihrem
    einzigen Snapshot ein.
78. **Nach Format und Uhrzeit Retruths nur über die Reihe „Original“.** Die Zähler eines Retruths
    selbst sind fast immer 0; gemischt mit eigenen Posts drückten sie den Median einer Format- oder
    Stundengruppe gegen 0. Die erste Reihe heißt dort „Eigene Posts“ (inkl. Quotes und Replies); die
    Zähler der Retruths selbst stehen nur in der Auswertung nach Post-Typ („Post selbst“).
79. **Wachstumskurve nur aus Posts mit mindestens zwei Messungen unter 24 h, je Post normiert.** Mit
    einem Lauf am Tag hat jeder Post eine Messung; ein Median verschiedener Posts je Alter zeigte nur
    die Tageszeit der Posts. Jeder Post wird auf seine letzte Messung unter 24 h bezogen (= 100 %), je
    voller Stunde zählt der Median dieser Anteile (zwei Messungen eines Posts in derselben Stunde: die
    spätere). Nur eigene Posts ohne Backfill; Posts mit letztem Wert 0 haben keinen Bezugswert. Ohne
    Posts mit mehreren Messungen zeigt das Dashboard einen Hinweis statt einer Kurve; „pro Stunde seit
    Post“ gilt für die Kurve nicht.
80. **Unbekannte Zähler zählen nicht als verglichen.** Posts, bei denen weder der eigene noch der
    Original-Zähler der gewählten Kennzahl bekannt ist (Platzhalter `-1`, Feld fehlt), fehlen in
    Kacheln, Grafiken und Tabelle und stehen unter „Nicht dabei“.
81. **Medien-Metadaten in Tabelle und CSV:** „Abmessungen“ = Breite×Höhe aller Medien mit bekannten
    Abmessungen in Post-Reihenfolge, mit „, “ getrennt (ein „;“ müsste im Semikolon-CSV maskiert
    werden); „Videodauer (s)“ = Summe der Videos (ohne GIFs), leer, wenn einem Video die Dauer fehlt,
    damit keine Teilsumme wie die ganze Länge aussieht. Keine Medien-URLs.

## Prüfskript (nach dem Review)

82. **Einstellungsdateien des Browserprofils** (`Preferences`, `Local State` …) werden als JSON gelesen;
    jeder Wert und jeder Schlüssel wird auf HTML und Freitext geprüft, in Strings eingebettetes JSON
    wird ausgepackt. Von der Freitext-Regel ausgenommen sind Werte ohne Leerraum (Base64, Hashes,
    Pfade) und die Manifeste eingebauter Erweiterungen, sonst meldete schon ein frisches Profil Funde.
    Gemeldet werden Datei und Schlüsselpfad, nie der Wert.
83. **`--abfragen` liest bis Strg+Z (Windows) bzw. Strg+D**, nicht bis zur ersten Leerzeile: Ein
    eingefügter Post mit Absätzen landete sonst zum Teil in der Eingabeaufforderung. Jede Zeile ist eine
    Stichprobe, Leerzeilen und Zeilen unter 4 Zeichen werden übersprungen; danach wird der
    Konsolen-Eingabepuffer geleert.

## Spike (nach dem Review)

84. **Der Spike folgt denselben Regeln wie der Crawler:** Laufsperre, Startseite = Konto-Abfrage
    (die Web-App lädt erst, wenn Cache aus und Medien gesperrt sind), Sperrseiten nach HTTP-Status,
    Medienprobe nur mit der Adresse, die der Crawler hasht. Nach einem 429 in Weg a startet Weg b
    nicht (`--nur b` später). Zeigt die Profilseite in b1 eine Prüfung oder bekommt die Web-App ein
    429, endet Weg b sofort statt zu warten: Mit angehängtem Playwright würde die Prüfung kreisen.
85. **Anfragen der Web-App zählen mit.** Der Bericht weist sie getrennt von den eigenen aus; gesperrte
    Medien gehen nie raus und stehen unter `medien_gesperrt`.
