# Statusliste BAUSTELLEN.md — Stand 06.09.2026, 09:13

**Nachtrag 10:35 aus eigener Pruefung (nicht aus dem Agentenlauf):** L21 ist bestaetigt und
praeziser: Die Figur macht seit 05:50 dauerhaft `General/Recruitment`, `figwatch.js` zaehlt
575 Konflikte "niemand hat die Figur, sie tut aber bladeburner", `blade.js` beantragt
Vindictus (Chance 0,717) im 30-s-Takt, jeder Antrag traegt `nodeReset: 0` und wird vom
Kern verworfen. Ursache ist `src/lib/figurns.js:53-54,66-67`: prueft die Datei auf home,
liest dann lokal - auf der Werkbank leer. Die Reparaturbibliothek `lib/hostdatei.js`
existiert und ist bereits in `needsLibs` von blade.js eingetragen. Der Rang waechst nur
durch Sleeve 0 (Bounty Hunter); die zwei letzten Black Ops fallen so nie. Der Waechter
steht auf SUSPECT/Sprosse 5 und ist dort ohne `punish-scharf.txt` gesperrt - er tut
nichts Gefaehrliches, aber auch nichts Nuetzliches.


**Anlass:** Die Bau-Sitzung vom 03.–05.09. (142 Commits, Zweig `bau-2026-09` vollstaendig in master) ist beendet und wird nicht fortgesetzt; der neue Bot ist seit 04.09. abends im Spiel. Die Arbeitsliste `nodes/BAUSTELLEN.md` hat 45 Punkte, die meisten vom 30.08.–02.09., also **vor** diesem Umbau. Jeder Punkt wurde gegen Repo, Commits und das laufende Spiel geprueft, jedes Urteil von einem zweiten Agenten angegriffen.

**Zaehlung nach Gegenpruefung** (37 Sachurteile; die Punkte 3–10 sind wortgleiche Doppel von Nr. 1 und zaehlen mit ihm):

| Urteil | Anzahl |
|---|---|
| ERLEDIGT | 10 |
| TEILWEISE | 14 |
| OFFEN | 8 |
| OBSOLET | 2 |
| IRRIG | 3 |

**Dringlichkeit der 37 Punkte:** vor dem Sprung 9 · in Lauf 3 4 · spaeter 9 · keine 15.

**Zusaetzlich 44 Luecken** — Dinge, die belegt offen sind und in BAUSTELLEN.md **gar nicht vorkommen**: 19 davon vor dem Sprung, 17 in Lauf 3, 8 spaeter. Nach Zusammenlegen offensichtlicher Doppel bleiben 14 vor dem Sprung.

**Zwei Saetze vorweg, weil sie alles andere ueberlagern:**
- Der Bot fuehrt seit **06.09. 05:50** keine Bladeburner-Aktion mehr aus (L21). Zwei Black Ops sind das einzige Tor zum Sprung — dort passiert seit ueber vier Stunden nichts, und es sieht von aussen gesund aus.
- Der einzige Meldeweg vom Spiel zu Dir (`## Sofort`) ist seit **04.09. 19:41 tot** (L25/L31). Vier Meldungen sind bereits verloren. Solange das steht, kann `tools/liste.js` auch nichts abhaken — **alle Aufraeumarbeiten an dieser Datei haengen daran.**

---

## Vor dem Sprung

### Punkte aus der Liste (9)

**Nr. 2 — Bruecke ohne Sicherung, Spielstand liegt in Downloads** · TEILWEISE
- Die genannte Ursache ist behoben (fdd11b6, 04.09. 19:18), aber der brueckenfreie Ersatzweg meldet Erfolg, ohne eine Datei abzulegen: in der Nacht zwei Exporte (23:42, 00:42), im Downloads-Ordner nichts aus dieser Nacht.
- Alten Eintrag streichen, an seine Stelle den haerteren Befund setzen: `exportGame` kehrt zurueck, es entsteht keine Datei — die Rueckfallsicherung ist unbewiesen.
- Beleg: `data/sofort.json` (RPC 09:32:15) zwei Eintraege `export.js#bruecke-ohne-sicherung`; `backups/INDEX.tsv` Luecke 22:08:03 → 00:42:51; Downloads enthaelt nur `bitburnerSave_1788539487_BN10x2.json.gz` vom 04.09. 18:31.

**Nr. 15 — Kampftraining lief mit 1/19 der Gym-Rate, Ursache unbekannt** · TEILWEISE
- Baulich eingezaeunt (Figur-Vergabepunkt, b8a94bc 04.09. 08:14), die Ursache aber nie bestaetigt, und die Abnahmemessung steht live auf dem Kopf: `figure_conflict` 454.
- Umformulieren zu einer Kaltstart-Pruefung fuer Lauf 3 (erstes Gym-Fenster gegen 106.000 exp/h messen) und mit C.11 zusammenlegen; vorher muss die Flutung von `events.json` weg.
- Beleg: `STATUS.json:76` „Offen: figure_conflict = 0 ueber 12 h"; `data/figwatch.json` (RPC 09:27) figure_conflict 454, besitzer null; `data/events.json` 400/400 Eintraege mit demselben Text.

**Nr. 17 — Kaltstart in BN10: erster Mietrechner kostet das Fuenffache** · TEILWEISE
- Der Sicherheitsfaktor steht seit 1302cd6 auf 1,0 und die Preise kommen jetzt live aus `data/preise.json` — die woertliche Restforderung „Kommentar auf BN10-Zahlen" ist unerfuellt: acht Zeilen ueber dem Code steht weiterhin „der Sicherheitsfaktor faellt auf 1,25".
- Den Kommentarblock `src/bn4net.js:1145-1163` auf BN10-Zahlen ziehen (zwei Minuten, keine Verhaltensaenderung), Punkt bis nach dem Kaltstart offen lassen.
- Beleg: `src/bn4net.js:1171` `faktor = kaltstart ? 1.0 : 4` gegen `:1161`; `data/preise.json` (RPC 09:26:41, 9 s alt) 32 GB = 8.800.000 $; `BEFUNDE.md:636-637` fuehrt L.1 als „nie im Zielzustand gelaufen".

**Nr. 18 — checkin.js: URTEIL ANLAUF erkennt keinen Stillstand** · OFFEN
- Der Zweig ist seit dem Bezugspunkt byteweise unveraendert, und ein Vergleich gegen den Vorbesuch ist datenseitig unmoeglich (Stand-Punkt speichert weder gerootet noch homeRam noch Werkbank; alle 8 ANLAUF-Punkte haben `rang: null` und `spielzeit: null`).
- Vor dem Sprung nachziehen: Betriebsbild vor die fruehen Returns holen und `bn4net.playtime` + gerootet/homeRam/Werkbank in den Stand-Punkt aufnehmen.
- Beleg: `tools/checkin.js:386-400` und `:825-833`; `git diff 355d06c..HEAD -- tools/checkin.js` enthaelt die Stelle nicht; `data/checkin.json` 8 Punkte ANLAUF.

**Nr. 20 — tools/tor.js liest veraltete Telemetrie** · OFFEN
- `data/bblage.json` ist 36,8 h alt (`rang: 5837` gegen live 413.430), hat seit dem Umbau keinen Starter mehr und wird beim Sprung nicht geraeumt; tor.js prueft das Alter nirgends.
- Mit Nr. 34 zu einem Punkt zusammenlegen: erst Frischepruefung plus Anstoss ueber `data/task.txt` wie in `strategie-check.js:109-116`, dann die Bedingung in Zeile 86 lockern.
- Beleg: `tools/tor.js:80-89`; RPC `data/bblage.json` 09:40:57 → zeit 04.09. 20:45:32; `bblage.js` fehlt in `src/registry.json`.

**Nr. 24 — Graft-Treiber weiterlaufen lassen, ein Stueck je Lauf** · TEILWEISE
- Das Betriebsrezept (task.js/graftnext.js) ist tot, der Treiber ist nach innen gewandert (`graftauto.js`, fcd51bb) — aber ohne Zuender: seit 31.08. 03:03 wurde kein Stueck mehr gegraftet, im ganzen laufenden Knoten keines.
- Auf eine Frage eindampfen: `graftplan.json` ins Spiel legen ja/nein. **Entscheidung vor den Sprung, Datei erst nach dem Kaltstart von Lauf 3** — jetzt gelegt startet sie binnen 60 s einen Graft und bremst die letzten zwei Black Ops.
- Beleg: `data/graft.json` (RPC 09:32) zeit 31.08. 03:03:11; `getFileNames` home 09:31:52 ohne `graftplan.json`; `AUFTRAG-BAU-2026-09.md:151` Faktor 10–20 auf den Rangweg.

**Nr. 27 — Der Einbau-Ausloeser in bn4rep.js kennt seinen Preis nicht** · OFFEN
- `MINDEST_WARTESCHLANGE = 3` ist weiterhin eine reine Stueckzahl ohne Preisterm; der gebaute Preisterm `WIEDERAUFBAU_MIN = 186` haengt an `eta_sicher`, und das ist auf dem Bladeburner-Weg konstruktionsbedingt nie wahr.
- Offen lassen, aber die Kostenzahl korrigieren (gemessen rund 1 h Wiederaufbau, kein Rangverlust) und an den offenen V2-ETA-Befund haengen; vor dem Sprung genuegt ein von Hand gelegtes `data/install-sperre.txt`.
- Beleg: `src/bn4rep.js:331` und `:1092-1097`; `src/lib/endspurt.js:241,279`; `data/ausgang.json` (09:38) `eta_min:0, eta_sicher:false`; vier Einbauten in 27 h laut `backups/INDEX.tsv`.

**Nr. 34 — tools/tor.js steigt in der Division aus, obwohl es dort gebraucht wird** · OFFEN
- Unveraendert, kein Ersatz gebaut, und die beiden Kennzahlen, die die Frage beantworten wuerden (`t_gate`, `t_rebuild_h`), haben keinen Schreiber und stehen live auf null.
- Mit Nr. 20 zusammenlegen und **vor** dem Sprung erledigen — die reine Einzeilen-Aenderung an Zeile 86 macht die Lage schlechter, nicht besser.
- Beleg: `tools/tor.js:86-89`; `tools/checkin.js:391-396` verweist woertlich auf tor.js; `src/lib/kpi.js:124,136` ohne Schreiber; `data/kpi.json` (09:43) beide null.

**Nr. 45 — Source-File -1: die letzten vier Exploits** · TEILWEISE
- Bestand stimmt (7 von 11, beide Sperren nachgemessen zu), aber der Schlusssatz terminiert einen Spielstand-Eingriff ausdruecklich auf „den naechsten BitNode-Wechsel" — mit einer Risikoannahme, die falsch ist: fuenf Source Files und 423 h Spielzeit ueberleben den Wechsel.
- Den Bestandsteil schliessen und den Schlusssatz **vor** dem Sprung streichen, ersetzt durch den Verweis auf `AUFTRAG-BAU-2026-09.md:277,280` (Import/IndexedDB entschieden nein).
- Beleg: RPC `getSaveFile` 09:52:46 (7 Exploits, SF [1,1][4,1][5,1][6,1][10,1]); Opera Port 9222 HTTP 000 (09:53); `sync/bridge.js:874-885` nur lesende Methoden.

### Luecken, die in der Liste fehlen (14 nach Zusammenlegung)

**L21 — blade.js startet seit 05:50 keine Aktion mehr; die Black Ops stehen still**
- Der Waechter hat blade.js um 05:50 beendet, der Kern hat es auf der Werkbank neu gestartet, dort bekommt es die Figur nicht mehr; die Engine wiederholt seither stumm `General/Recruitment`. Der Rang waechst nur noch aus Sleeve 0.
- **Das ist der wichtigste Punkt der ganzen Liste.** Erst hier hinsehen, dann alles andere.
- Beleg: `data/aktionen.txt` letzter Abschnitt endet 05:50:10 mit `abgebrochen:true`; `data/figure.txt` owner null bei seq 4562/4600/4627; `data/guard-log.txt` 05:50:10 „blade.js auf home beendet"; figure_conflict 530 → 544 in 7 min.

**L22 — src/lib/figurns.js liest data/bn4net.json lokal (Fehlerklasse vom 04.09.)**
- `knotenStempel`/`motorzeit` pruefen die Datei auf home und lesen dann die lokale Kopie — auf jedem Rechner ausser home also nichts; live traegt der Antrag `nodeReset:0`. Das ist die direkte Ursache von L21 und trifft alle acht Gewerke, die figurns importieren.
- Auf `lib/hostdatei.js` umstellen. Nebenwirkung: solange das steht, zuendet auch `graftauto.js` nicht, wenn `graftplan.json` gelegt wird.
- Beleg: `src/lib/figurns.js:53-57,66-72`; `data/figure-request-blade.js.json` nodeReset 0 / motorTimeMs 0 gegen `data/bn4net.json` nodeReset 1788271154961; Wirkung `src/lib/figur.js:121-127,243-246`.

**L2/L23 — Die Strafleiter steht auf Sprosse 5 und kommt dort nicht mehr weg**
- Ziel `fortschritt` steht seit 06:35 auf SUSPECT/Sprosse 5; ein weggefallenes Signal fuehrt nicht zurueck nach HEALTHY, die Karenz laeuft im Hintergrund weiter (5,01 h von 6 h verbraucht). Sprosse 4a ist nicht gebaut, Sprosse 5 traegt nur mit `punish-scharf.txt` — die Leiter ist am Ende ihres Wegs.
- Rueckweg nach HEALTHY bei ausbleibendem Signal bauen, bevor `punish-scharf.txt` je gelegt wird (Sprosse 5 = Soft-Reset per Einbau).
- Beleg: `data/watchdog.json` (10:04) sprosse 5, seitUhr 122419579; `src/lib/leiter.js:374-540`; `STATUS.json` C.12 offen; `data/punish-scharf.txt` liegt nicht im Spiel.

**L24 — S2 bestraft ein Verhalten, das in ENTSCHIEDEN steht**
- Feuerschwelle 0,35 fuer Black Ops ist eine bewusste Entscheidung und erzeugt planmaessig Rangeinbrueche von 15.000; genau darauf springt S2 („Traeger seit 45 min nicht gewachsen") an. Beide Bauteile stammen aus derselben Sitzung und wissen nichts voneinander — daraus entstand heute Nacht die ganze Kette bis L21.
- S2 gegen Black-Op-Fehlversuche blind machen (oder den Rangverlust als erwartet buchen), sonst wiederholt es sich bei jedem Versuch; Deckel ist 3 Kills in 6 h.
- Beleg: `BAUSTELLEN.md:23`; `data/aktionen.txt` Vindictus 05:12–05:23 −15.651 Rang und 05:37–05:48 −15.419; `data/guard-log.txt` 05:05:08 S2, 05:50:10 Sprosse 4.5.

**L25/L31 — Der Meldeweg vom Spiel nach `## Sofort` ist seit 04.09. 19:41 tot**
- `tools/liste.js` nimmt die erste `---`-Zeile als Kopfende; die steht seit 5bdd005 nicht mehr vor `## Sofort`, sondern in Zeile 763. Das Werkzeug sieht nur noch `## Erledigt` mit 0 Punkten, jeder Eintragsversuch der Bruecke scheitert und wird geschluckt. Vier Meldungen sind verloren, zwei liegen unverfolgt in `nodes/BAU-2026-09/sofort/`.
- **Zuerst reparieren** — Trennlinie vor `## Sofort` wiederherstellen. Ohne das laesst sich kein einziger Punkt dieser Liste mit dem vorgesehenen Werkzeug abhaken.
- Beleg: `data/bridge.log:1355,1400,1494,1502` „Abschnitt 'Sofort' nicht gefunden. Vorhanden: Erledigt"; `tools/liste.js:52-55`; Lauf `node tools/liste.js` heute: „Regelkopf: Zeile 1 bis 763".

**L3 — Die Einbausperre ist verschwunden, und es wurde eingebaut**
- Das Einspielprotokoll fuehrt `data/install-sperre.txt` als unbefristet stehenden Schutz; sie liegt nicht mehr im Spiel, und um 01:55:06 hat ein `installAugmentations` stattgefunden. Wer sie geraeumt hat, ist aus Repo und Spiel nicht ersichtlich.
- Klaeren, bevor der Sprung kommt — sonst ist unklar, ob der Riegel beim naechsten Mal greift.
- Beleg: `getFileNames` home 10:07:56 ohne `install-sperre.txt`; `data/kpi.json` augReset 1788652506369; `EINSPIELUNG-2026-09-04.md:388-403`.

**L1 — Die gesamte Testsuite prueft den Bau-Worktree, nicht den Code im Spiel**
- `ladeAusBeiden` stellt `../bitburner-bau/src` vor `./src`; der Worktree steht 15 Commits hinter master, 15 Dateien unterscheiden sich inhaltlich, und `src/lib/hostdatei.js` fehlt dort ganz — ausgerechnet die Reparatur der Fehlerklasse aus L22.
- Vorrang umdrehen oder den Worktree entfernen (siehe L42), sonst belegt jedes gruene Testergebnis seit 04.09. 17:45 den falschen Baum.
- Beleg: `tools/mock/lader.js:244-256`; `git worktree list` → 74d4418 [bau-2026-09]; `tools/kpi-luecken.js` druckt seine Quelle als `...\bitburner-bau\src\lib\kpi.js`.

**L5 — 24 Kennzahlen der Abnahmetafel haben keinen Schreiber**
- Das eigene Werkzeug sagt es woertlich: „eine Abnahmebedingung darauf kann nicht scheitern und ist deshalb keine". Betroffen sind unter anderem `t_workbench` (C10), `t_gate` (C12), `T2_h` (B7), `chaos_city` (B9), `t_rebuild_h`, `vorrat_deckung`.
- Vor dem Sprung mindestens `t_workbench` und `t_gate` einen Schreiber geben — das sind die Kaltstart-Kennzahlen von Lauf 3.
- Beleg: `node tools/kpi-luecken.js` „24 Feld(er) ohne Schreiber"; `data/kpi.json` (10:08) alle genannten null.

**L4 — Abnahme-Kriterium C9 misst gegen eine Datei, die niemand schreibt**
- `ABNAHME-C.md:47` nennt als Messbefehl `data/registry-lauf.json`; dieser Dateiname kommt im ganzen Repo genau einmal vor — in dieser Zeile. Im Spiel existiert die Datei nicht.
- Kriterium vor dem Sprung umschreiben; es gibt keinen zweiten Sprung in diesem Knoten.
- Beleg: `grep -rn 'registry-lauf' src/ tools/ sync/ doku/ nodes/` → ein Treffer; RPC 10:07 „File does not exist".

**L6/L36 — Stufe B der Abnahme hat nie begonnen**
- `ABNAHME-B.md` ist bis heute nur die Messvorschrift mit leerer Ergebnisspalte; die 12 h ununterbrochener Live-Betrieb sind nie gelaufen, weil der Spiel-Tab vom 04.09. 20:26 bis 06.09. 00:42 nicht verbunden war. Ein Lauf ab jetzt wuerde das Kriterium „Sprossen ≥ 2: 0" bereits reissen (Sprosse 4,5 heute 05:50).
- Entscheiden: Stufe B vor dem Sprung nachholen oder ausdruecklich fallenlassen — der Umbau gilt sonst als abgenommen, ohne es zu sein. (Ein Pruefer hat den Punkt als „in Lauf 3" eingestuft; ich stufe ihn hoch, weil der Sprung die Messbasis wegnimmt.)
- Beleg: `ABNAHME-B.md:3`; `nodes/BAU-2026-09/sofort/2026-09-05T20-46-02-342Z-bruecke.md`; `data/penalties.json` Sprosse 4,5.

**L7/L34 — graftauto.js liegt tot im Spiel und wartet auf eine Entscheidung**
- Gebaut, getestet, eingespielt — und ohne Zuender: `graftplan.json` liegt nicht im Spiel, `data/graftauto.json` existiert nicht. Die Entscheidung (rund 450 Mrd, beim Start weg, bei Abbruch nicht zurueck) steht seit 04.09. offen und in keiner Liste. Inzwischen ist das Fenster praktisch zu: Rang 429.877 gegen Schwelle 400.000, die Endspurt-Regel verbietet Grafts, deren Restzeit die Restzeit bis zum Ausgang uebersteigt.
- Bewusst fuer Lauf 2 verwerfen und in Lauf 3 neu stellen — nicht offen liegenlassen. Vorher L22 fixen, sonst zuendet das Gewerk auch dann nicht.
- Beleg: `EINSPIELUNG-2026-09-04.md:174-183`; `data/kpi.json` (10:08) traeger rang 429.877; `data/nicht-schieben.txt:28`.

**L9/L32 — Die Bruecke hat keinen Autostart, und ein ungesicherter Stand liegt in Downloads**
- Im Autostart-Ordner steht nur `desktop.ini`; die Bruecke laeuft heute nur, weil die Schleifenfassung von Hand gestartet wurde. Zusaetzlich liegt seit 06.09. 00:43 ein Spielstand ausserhalb der Sicherungskette, dessen Entstehungsgrund niemand nachgesehen hat (siehe Nr. 2).
- Verknuepfung auf `sync/bridge-start.cmd` in den Autostart legen — Dein Handgriff, und ohne ihn ueberlebt die Sicherungskette keinen Neustart.
- Beleg: Listing `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup` (06.09.); `sync/bridge-start.cmd:18-25`; `ABNAHME-A.md` Abschnitt 8.

**L33 — Das Bruecken-Urteil „Spiel-Tab nicht verbunden" nennt den falschen Zeitpunkt**
- Der Code rechnet mit `connectedSince`, und der wird beim Trennen nicht zurueckgesetzt: die Schwelle misst die Dauer der vorigen Verbindung, der genannte Zeitpunkt ist der Verbindungsbeginn. Die Meldung behauptete ein 26-Stunden-Loch, real waren es zweieinhalb Stunden — und der Zusatz „Der Bot steht still" war ebenfalls falsch (totalPlaytime wuchs 1:1 weiter).
- Reparieren, bevor der Sprung Meldungen erzeugt: ein Kanal, der uebertreibt, wird nicht mehr gelesen.
- Beleg: `sync/bridge.js:2191-2199` gegen close-Handler `:2730-2733`; `~/bitburner-backups/INDEX.tsv` stuendlich bis 05.09. 20:08:03Z.

**L35 — Ob die Strafe vom 06.09. 05:50 berechtigt war, ist nicht nachweisbar**
- Es gibt keine gespeicherte Rangreihe, und `false_penalty_count` zaehlt konstruktionsbedingt nur Sprossen, die „ins Leere griffen" — eine S2-Fehlausloesung gegen ein laufendes Werkzeug kann es nicht anzeigen. Das Stufe-B-Kriterium „Fehlstrafen 0" ist mit einem Werkzeug belegt, das den ausgeschlossenen Fall nicht sehen kann.
- Mindestens eine Rangreihe mitschreiben — billig, und ohne sie ist jede Waechter-Abnahme wertlos.
- Beleg: `data/penalties.json` Eintrag wall 1788666610544; `src/guard.js:466-478` (Regex auf „laeuft nirgends").

**L8 — Der Kanarienvogel auf der TEST-Instanz fehlt; die Hot-Swap-Checkliste bleibt rot**
- `hotswap.js --pruefen` meldet vier rote Punkte und verweigert statt zu warnen; die Einspielung vom 04.09. ist deshalb an der Checkliste vorbei gefahren worden, und das Protokoll sagt das auch so. Gehoert zusammen mit L16 (Import nie geprueft) erledigt — beides braucht dieselbe zweite Spielinstanz.
- Entweder eine TEST-Instanz oeffnen oder die Checkliste ehrlich abruesten; ein Riegel, den man beim ersten Ernstfall umgeht, wird beim zweiten nicht mehr gefragt.
- Beleg: `EINSPIELUNG-2026-09-04.md:120-147,388-392`; `ABNAHME-A.md` Abschnitt „Was Stufe A ausdruecklich NICHT belegt".

---

## In Lauf 3

### Punkte aus der Liste (4)

**Nr. 23 — Vier Restbefunde aus dem ersten Skeptiker-Lauf** · TEILWEISE
- Drei Teilbefunde sind sauber erledigt, aber der wichtigste ist durch den Umbau **regressiert**: zwischen die letzte Graftpruefung und `installAugmentations` hat der 04.09. einen `await handschlag(...)` gesetzt — das beanstandete Fenster ist von 3,5 s auf bis zu 90 s gewachsen, Faktor 26, ohne erneute GRAFTING-Pruefung danach.
- Punkt auf diesen einen Rest eindampfen (GRAFTING-Test nach dem Handschlag wiederholen, zwei Zeilen); harmlos nur, solange `graftplan.json` nicht im Spiel liegt.
- Beleg: `src/bn4rep.js:1219-1227` / `:1266` / `:1279`; `src/lib/handschlag.js:62` WARTE_MAX_MS = 90000.

**Nr. 30 — Operationen freigeben: drei echte Fehler dabei** · TEILWEISE
- Teil A erledigt; B und C stehen woertlich unveraendert, und C ist nicht mehr folgenlos: am 04.09. lief zwischen 19:56 und 22:20 ein durchgehender Operationsblock, in dem der Vertragszweig kein einziges Mal gefragt wurde.
- B und C sind eine Arbeit an `beste()`; die Zahlen 0,959 %/0,503 % streichen (sie gelten fuer die verworfene Schwelle 0,30, nicht fuer die stehende 0,85).
- Beleg: `src/blade.js:2481-2482` und `:2825-2829`; `data/aktionen.txt` Undercover 23 Laeufe / 120,1 min, alle grund „Operation".

**Nr. 35 — tools/rueckstand.js kann einen Spielausfall nicht sehen** · OFFEN
- Unveraendert, und schaerfer verwendet als frueher: `skills/bb.md:68` schickt beim Urteil STEHT als **erstes** zu diesem Werkzeug — das nach einem Ausfall mit Neuladen konstruktionsbedingt „Tempo 1,000" meldet.
- Mindestloesung: Vorbehalt in `skills/bb.md:68` eintragen oder auf die Wanduhr-Luecke im Bruecken-Heartbeat verweisen; kein Umbau noetig.
- Beleg: `tools/rueckstand.js:111`; `reference/v301/src/engine.tsx:344,349`; alle 22 Intervalle in `data/checkin.json` seit 03.09. bei Tempo 1,000, auch ueber den Verbindungsabriss.

**Nr. 38 — Sleeve stand still, weil die Vorratsschwelle keinen Abschluss ueberlebt** · TEILWEISE
- Der Fix ist intakt und der Infiltrate-Rueckfall heute live belegt (Sleeve 1 durchgehend `infiltrate`, acht Stunden nach dem Einbau); offen ist nur die zweite Haelfte — ob der Vorrat danach wieder steigt, liest niemand.
- Im Kaltstart von Lauf 3 einmal eine Stunde `data/sleeve.json` beobachten; wenn die Frage wirklich beantwortet werden soll, braucht `vorrat_deckung` einen Schreiber (siehe L5).
- Beleg: `src/sleeve.js:302,327`; RPC `data/sleeve.json` 09:42–09:47; `data/sleevediag.json` steht seit 30.08. 09:56 still.

### Luecken (17)

- **L26 — `verifiedAt` wird angelegt und nie geschrieben.** Die Wirkungspruefung laeuft und aendert den Leiterzustand, schreibt das Ergebnis aber nicht nach `penalties.json` zurueck; damit sagt der einzige Strafbeleg, *dass* gestraft wurde, nicht *ob* es half. Beleg: `src/guard.js:395`, einziger Treffer im ganzen Baum.
- **L27 — shop.js haengt an einem unerfuellbaren Auftrag und meldet Geldmangel** bei 17,26 Bio auf dem Konto: `getServerUpgradeCost` gibt −1 zurueck, wenn die Zielgroesse schon erreicht ist, shop.js liest jede Zahl ≤ 0 als „kein Geld". Im Kaltstart kauft genau dieses Gewerk den ersten Mietrechner. Beleg: `data/shop.json` state blocked/`money`; `src/shop.js:250-265`.
- **L28 — `registry.absent` kann nie 0 werden:** Registry und Kern widersprechen sich bei `hacknet.js` (kein `forbidsFile`, aber `data/keine-hacknet.txt` liegt) — dauerhaft absent:1 mit 9,45 GB angeblich wartendem Speicher. Eine dauerrote Kennzahl wird nicht mehr gelesen. Beleg: `src/registry.json` hacknet.js precondition {}; `src/bn4net.js:3348`.
- **L29 — blade.json meldet den Wunsch als Tat:** das Feld `aktion` stammt aus der gewaehlten, nicht aus der laufenden Aktion — deshalb sah ein blockiertes blade.js heute frueh wie ein arbeitendes aus. Faelscht genau die Anzeige, an der L21 zuerst haette auffallen muessen. Beleg: `src/blade.js:3580` gegen `data/figwatch.json`.
- **L30 — `figure_conflict` steht in keiner KPI:** figwatch zaehlt korrekt in die eigene Telemetrie, die niemand liest; die Abnahme C.11 („= 0 ueber 12 h") ist so nicht pruefbar. Beleg: einziger Treffer `src/figwatch.js:179`; `data/kpi.json` kennt das Feld nicht.
- **L10 — `ns.scp` wirft nicht, sondern gibt false zurueck** — von rund 20 Aufrufstellen prueft nur `src/ausgang.js:646` den Rueckgabewert. Genau ein Bibliotheksproblem hat beim Einspielen `ausgang.js` 30 Minuten totgelegt, und es sah nach Erfolg aus. Beleg: `BEFUNDE.md:790-798`.
- **L12 — Vertragsertraege gehen nicht in den Ereignisstrom** (`contract_stock_usd` ohne Schreiber): im Kaltstart ist der Vertragsertrag die Geldquelle, und ohne diesen einen Eintrag laesst sich „Loeser, Annahme oder Auszahlung?" nicht unterscheiden. Beleg: `BEFUNDE-RUNDE5.md` P-W4; `src/lib/kpi.js:114`.
- **L15 — Die Kammerphase kostet rund 12,4 Rang je Stunde** (108 s Dauer, 60 s Gutschrift): bewusst nicht gebaut, weil die Messung fehlt — und die Messung war der Stufe B zugewiesen, die nie stattfand. Das ist ein **Messauftrag**, kein Bauauftrag. Beleg: `BEFUNDE.md:424-438`.
- **L16 — Der Ladeweg des Spielstands ist geprueft, der Import selbst nie.** 41 Sicherungen nuetzen nichts, wenn der letzte Schritt scheitert; braucht dieselbe TEST-Instanz wie L8. Beleg: `ABNAHME-A.md` Abschnitt 7.
- **L13 — `doku/kontrakte.md:339` widerspricht Abschnitt 4.11** beim Raeumen von `data/sofort.json`; die Bau-Sitzung hat es selbst notiert und nicht korrigiert.
- **L14 — Die Bauunterlagen sind eingefroren und behaupten das Gegenteil des Standes:** `STATUS.json` steht auf 04.09. 13:20 mit 13 von 15 Positionen „NICHT live", `BEFUNDE.md` fuehrt bereits Gebautes als offen, `ARCHITEKTUR.md` warnt vor einer Hauptbaum-Fassung, die es seit dem Merge nicht getrennt gibt. Das sind die drei Dateien, in die man zuerst schaut.
- **L37 — Memory nicht nachgetragen:** `bitburner-strafleiter.md` fehlt ganz, die drei nachzutragenden Dateien tragen Daten vor dem Umbau. Genau dieser Fall ist heute eingetreten.
- **L38 — Der `/bitburner`-Skill beschreibt die alte Bauform** („BitNode 1, keine Source Files", `tools/task.js` als Weg ins Spiel) — und triggert laut eigener Beschreibung, bevor jemand `src/` anfasst.
- **L39 — README nennt `node sync/bridge.js`,** was heute sofort mit „ABBRUCH: --instance fehlt" abbricht.
- **L40 — Der Browser-Umzug wurde nie vorgelegt** und auch nicht, wie vom Auftrag vorgesehen, ersatzweise nach `## Sofort` gelegt: Faktor 1,8–4,4 auf die Kalenderzeit, aus 1.100–1.900 Motorstunden werden 46–79 Tage. Groesster Ertrag der ganzen Liste, null Schaden.
- **L41 — `BEFUNDE.md` hat zwei nie gefuellte Platzhalter** (A–J aus dem Autonomie-Audit, S aus `## Sofort`) — also genau das Urteil, nach dem Du heute fragst; die Stufe-A-Pruefung konnte sie nicht sehen, weil sie nur `###`-Statuszeilen zaehlt.
- **L36** siehe oben unter „Vor dem Sprung" (Stufe B).

---

## Erledigt — abhaken

| Nr | Titel | Beleg | Warum weg |
|---|---|---|---|
| 1 (+3–10) | Grosser Schub verweigert, neunmal wortgleich | RPC 06.09. 09:26:37: 142 von 143 src-Dateien byte-gleich im Spiel; Fix bc5243d | Rueckstau am 04.09. abgearbeitet, Ursache im Code behoben, Deckel bleibt gewollt scharf |
| 11 | bn4rep.js laeuft seit 26 h nicht | Commit 1302cd6 (02.09. 18:52) + augReset 06.09. 01:55:06 | Ausbauzweig fuer wartende Werkzeuge gebaut, autonomer Einbau live bewiesen |
| 12 | ausgang.js + route.json (Umbau I.1) | `data/ausgang.json` 09:25 route_state open, exit_abgelehnt 0; `test-route.js` 39/39 | Kopf gilt, alle drei Restposten geschlossen |
| 13 | AUDIT VOLLE AUTONOMIE liegt vor | 9160c75 (02.09. 17:57) + 1302cd6 | Der einzige konkrete Auftrag war 37 min spaeter ausgefuehrt |
| 14 | sleeve.js schickt Sleeves ohne Geldpruefung ins Gym | `src/sleeve.js:360-368`, 22 Proben gruen | Geldboden strenger als gefordert, im Kaltstart arithmetisch unerreichbar |
| 16 | Kaltstart-Kickstart vom 02.09. | `src/bn4net.js:1171` faktor 1,0, live im Spiel | Protokollnotiz ohne Auftrag; Hinweis im Spiel erfuellt |
| 22 | Bot erkennt den Black-Ops-Ausgang nicht | `data/ausgang.json` status „BlackOps offen: Operation Vindictus" | Tuer wird ODER-geprueft wie in der Engine, Selbstsprung-Riegel ausgebaut |
| 26 | `reference/` ist nicht das laufende Spiel | 91 Spiel-Augs gegen `reference/v301`: 0 Abweichungen | Es wurde die falsche von zwei Referenzkopien gelesen; die Konsequenz ist gebaut |
| 28 | CHANCE_SKILLS-Aenderung zurueckgenommen | `src/blade.js:806-819` unveraendert, letzter Commit 29.08. | Protokoll einer nie eingebauten Aenderung |
| 39 | Bladeburner-Augs ungenutzt, mit 0,00 bewertet | `tools/save.js` 09:44: chance-Mult 1,916 = luekenlos alle 13 Stuecke | Bewertung sitzt in bn4rep/hackaugs, nicht in den genannten Dateien |

Zwei Fussnoten beim Abhaken: bei Nr. 12 den Eintrag „KURS.md gilt fuer Lauf 1" **nicht** miterledigen (siehe Strittig), und bei Nr. 39 vermerken, dass `tools/augplan.js:114-117` und `src/buyaugs.js:513` bladeburner-Werte weiterhin mit null bewerten.

---

## Obsolet oder irrig — streichen

- **Nr. 19 — KURS.md gilt noch fuer BN10 Lauf 1** · OBSOLET. Die Arbeit wurde nie gemacht (die Datei haengt unveraendert am 30.08.), aber ihr Adressat ist verbraucht: Lauf 2 ist bei Rang 425.013 gegen Schwelle 400.000 praktisch zu Ende. Beim Streichen den Bedarf nicht mitstreichen — `T2_h`, `work_share`, `vorrat_deckung` sind live null.
- **Nr. 25 — Assassination-Weg, 63 Stunden, Graftpaket maximal** · OBSOLET. Wegrechnung fuer Lauf 1; das Rangziel ist in Lauf 2 **ohne einen einzigen Graft** uebertroffen worden, und der Graftplan ist durch `src/graftplan.json` (39 andere Stuecke) ersetzt.
- **Nr. 21 — Spielanteil wird systematisch zu hoch geschaetzt** · IRRIG. Genau die geforderte Langfenster-Messung liefert 100,0 % ueber 135,93 h, 18 von 18 Werten ≥ 99,8 % — inklusive eines Nachtfensters und der Tage ohne Bruecke. Es gibt nichts zu reparieren.
- **Nr. 37 — Sleeve-Shock steht nach dem Einbau auf 99,9** · IRRIG. `shock = 100` steht nur in `Sleeve.prestige()`, aufgerufen allein beim **Knotenwechsel**; nach dem Einbau von 01:55 stand Sleeve 1 acht Stunden spaeter auf 38,87, aus 100 waeren hoechstens 56 erreichbar. Beim Streichen die Ursachenzeile richtigstellen — und den Restsatz als eigenen kleinen Punkt neu anlegen: Sleeve-Todesrate unter Kontraktlast ungemessen, Schwelle 3,64 Tode/h, `data/sleeve.json` fuehrt weder HP noch Shock.
- **Nr. 41 — Diplomacy frisst 28,7 % der Zeit** · IRRIG. Gemessen sind ueber 47,6 h **0,49 %**; die zugrunde liegende Regel wurde am 30.08. gebaut, als Fehler gemessen (ein Drittel Rangrate) und um 17:59 zurueckgenommen. Der Punkt traegt „Dringlichkeit: hoch" — wer ihn abarbeitet, baut den Fehler ein zweites Mal ein. Zusaetzlich den ueberholten Kommentarblock `src/blade.js:2586-2626` als ueberholt kennzeichnen.

---

## Bleibt offen, spaeter

- **Nr. 29 — `blackOpArbeit` behaelt seinen letzten Wert bei 21/21.** Mechanismus stimmt, Folge ist vernachlaessigbar (Fenster ≤ 60 s, danach loescht der Sprung die Division ohnehin); Dringlichkeit keine — als Einzeiler mitnehmen, wenn blade.js ohnehin angefasst wird.
- **Nr. 31 — Elf Fehler in der eigenen Dokumentation.** Sieben stehen unveraendert; kein Gewerk rechnet mit den Zahlen, aber zwei sind in den Auftragstext gewandert (`AUFTRAG:151` Hash-Festpreis, Faktor 2000 daneben; `AUFTRAG:155` verweist fuer die Forecast-Steuerung auf genau die falsche Passage).
- **Nr. 32 — tools/augplan.js rechnet die BitNode-Multiplikatoren nicht.** Der Bot ist nicht betroffen; das Werkzeug meldet in BN10 „KAUFBAR" bei halber Rep-Schwelle und einem Fuenftel des Preises. Strategie-Haelfte streichen, Werkzeugfehler mit Nr. 39 zusammenlegen.
- **Nr. 33 — Field Analysis statt Regenerationskammer, +80 %.** Kopf ist widerlegt (gemessen 19,2 % Kammer statt 77 %, Umschlagpunkt 1,84 gegen 137–1.010 Rang/min), drei Teilbefunde sind per Commit erledigt; uebrig bleiben drei Zahlendreher.
- **Nr. 36 — Zwischen Chaos 25 und 50 gibt es kein Zurueck.** Teil 1 erledigt (Riegel steht auf 19); **die Zeile „Deckel von 25 auf 23" muss weg** — sie wuerde den geprueften Fix umkehren.
- **Nr. 40 — Hash-Upgrades ab SF9.** Ein Drittel gebaut, aber das Registry-Gate `requiresFeature: 9` laeuft ins Leere (niemand baut `lage.features`) — in BN9 startet `hashes.js` nie, lautlos. Faellig vor Routenposition 5.
- **Nr. 42 — Erfahrungsofen (Befund B1).** Unveraendert, alle vier Teilaufgaben offen; greift erst ab BN1 Lauf 2 (Routenposition 8), dann Faktor 2–3 auf die EXP-Rate.
- **Nr. 43 — Boersen-Bot fuer BN8.** Gebaut ist der beobachtende Bot; nicht gebaut ist genau der manipulierende Teil, der den Punkt ausgezeichnet hat (kein `{stock:true}`, keine Shorts, keine `bn8_phase`). Routenposition 38.
- **Nr. 44 — Darknet-Labyrinth (BN15).** Gewerk existiert nicht, blockiert aber nichts (BN15 steht auf V2 ohne `braucht`). Zwei Zahlen im Text sind falsch: BN15-Zweig ist `labyrinth.ts:419-422`, die Red Pill faellt im **fuenften** Labor — das steht seit 30.08. als Skeptiker-Befund daneben.

---

## Fehlt in der Liste

Die 8 Luecken mit Dringlichkeit „spaeter" (die uebrigen 36 stehen oben unter „Vor dem Sprung" bzw. „In Lauf 3"):

- **L11 — `calc.growThreads` rechnet ohne den BitNode-Wachstumsfaktor.** Der Parameter steht in der Signatur, keine der vier Aufrufstellen uebergibt ihn; in BN3 und BN11 (Faktor 0,2) plant der Bot mit dem Fuenffachen der Wirkung. Von der Bau-Sitzung selbst als offen gefuehrt (B15).
- **L17 — Der Dateibeobachter feuert ohne Inhaltsaenderung.** Entschaerft durch den Hash-Vergleich, Ursache unbekannt — seit 04.09. aber mit `--src-dir` erstmals ohne Dein Spiel untersuchbar. Die neun Schub-Meldungen in `## Sofort` sind die sichtbare Spitze davon.
- **L18 — Inventur der 136 `data/`-Dateien auf home steht aus.** Heute 300 Eintraege; war der nie gelaufenen Stufe B zugewiesen. `data/ps.json` war heute schon 36 h alt und stand trotzdem als Beleg zur Verfuegung.
- **L19 — `doku/ram-budget.md` fuehrt exit.js mit 519,25 GB, gemessen 520,25.** Die Wirt-Kaufregel aendert sich dadurch nicht — falsche Zahlen in Dokumenten sind in diesem Projekt aber schon zweimal zu falschen Entscheidungen geworden.
- **L20 — Die beiden Vertrags-Standdateien sind kein Herzschlag-v2-Block.** Von der Sitzung selbst als klein eingestuft; letzter Rest einer sonst abgehakten Runde.
- **L42 — Der Bauzweig-Worktree `bitburner-bau` steht noch** (74d4418, vollstaendig in master). Haelt eine zweite `src/`-Kopie auf der Platte — und ist zugleich die Ursache von L1. `git worktree remove` plus Zweig loeschen; `git clean` ist in diesem Repo in jeder Variante verboten.
- **L43 — Das Bauprotokoll endet mit Phase C.** Fuer D bis G gibt es keinen Eintrag, obwohl die Arbeit erkennbar geleistet wurde — deshalb laesst sich der Stand der letzten zwei Bautage nur aus vier Dateien zusammensuchen.
- **L44 — Stanek-Klaerung und Go-Entscheidungstor fehlen vollstaendig.** Beide waren ausdruecklich als benannte Tore beauftragt, damit aus „nur nach Messung" kein „nie" wird. BN13 liegt auf Routenposition 32–34, BN14 auf 29.

---

## Strittig

**Nr. 19 — KURS.md.** Pruefer: ERLEDIGT, weil der Adressat entfallen ist und Ziel/Verfahren jetzt maschinell aus `route.json` kommen. Gegenpruefer: OBSOLET, weil die verlangte Arbeit nie gemacht wurde — die Datei haengt unveraendert am 30.08., und die maschinelle Nachfolgegroesse fuer „Rate und Restweg" liefert live nichts (`T2_h`, `work_share`, `t_gate` null). **Entscheidung: OBSOLET.** ERLEDIGT wuerde Dich spaeter einen hergeleiteten Lauf-2-Kurs suchen lassen, den es nie gab.

**Nr. 26 — `reference/`.** Pruefer: IRRIG, weil nicht `reference/` abweicht, sondern die falsche von zwei Kopien gelesen wurde. Gegenpruefer: ERLEDIGT — die Messung vom 30.08. war richtig (Synthetic Heart 1,3 gegen gelesene 1,15), nur die Ueberschrift war falsch, und die abgeleitete Konsequenz („Multiplikatoren live holen") steht gebaut in `src/bbgraft.js:44-51`. **Entscheidung: ERLEDIGT.** Fuer die Liste dieselbe Folge (streichen), fuer das Gedaechtnis nicht.

**Nr. 22 — Black-Ops-Ausgang.** Beide: ERLEDIGT. Uneins bei der Dringlichkeit — Pruefer „vor dem Sprung" (wegen der Beobachtung beim ersten autonomen Sprung), Gegenpruefer „keine", weil an dem Punkt kein Handgriff mehr offen ist und die Beobachtung bereits als `STATUS.json` Stufe C gefuehrt wird. **Entscheidung: keine.** Ein erledigter Punkt mit „vor dem Sprung" erzeugt genau die Verwirrung, die dieses Audit abstellen soll.

**Nr. 37 — Sleeve-Shock.** Beide: IRRIG. Uneins bei der Dringlichkeit — Pruefer „keine", Gegenpruefer „spaeter", weil der im Punkt woertlich enthaltene Restsatz (Sleeve-Todesrate, „Dringlichkeit mittel") sonst mitgestrichen wird und durch die Beweisfuehrung sogar wichtiger geworden ist: `takeDamage` ist die einzig verbliebene Erklaerung fuer den Sprung 82,2 → 99,9 vom 30.08. **Entscheidung: spaeter**, als eigener neuer Punkt.

**Nr. 1 — Schub verweigert.** Beide: ERLEDIGT. Der Gegenpruefer widerspricht aber der **Empfehlung**: `node tools/liste.js --erledigen` ist nicht ausfuehrbar, weil das Werkzeug `## Sofort` seit dem 04.09. nicht mehr sieht (L25). Und er dreht die Risikoeinschaetzung um: der Meldekanal ist nicht bedroht, er ist tot. **Entscheidung: Gegenpruefer.** Erst L25 reparieren, dann abhaken.

**Nr. 12 — ausgang.js + route.json.** Beide: ERLEDIGT. Der Pruefer will zwei weitere Sofort-Eintraege mitabhaken; der Gegenpruefer haelt nur einen davon fuer gedeckt („Black-Ops-Ausgang", live belegt), nicht „KURS.md gilt fuer Lauf 1" — der verlangt mehr, als Punkt 12 abdeckt. **Entscheidung: Gegenpruefer**, KURS.md eigenstaendig behandeln (siehe Nr. 19). Zusaetzlich hat er einen nirgends gebuchten Fehler in `ausgang.js:517-533` gefunden: Stufe 2 der Wirts-Eskalation schreibt JSON in `data/geldbedarf.txt`, einen Kanal, den vier Leser als nackte Zahl parsen — Ergebnis NaN → 0, was die Augmentierungs-Ruecklage loescht. Faellig vor BN9, nicht vor dem Sprung.

**Nr. 16 — Kickstart.** Beide: ERLEDIGT. Der Gegenpruefer widerspricht der Begruendung: der Nachbareintrag (Nr. 17) ist **nicht** vollstaendig gebaut, seine Mindestforderung (Kommentar auf BN10-Zahlen) steht offen. **Entscheidung: Gegenpruefer** — beim Zusammenlegen der beiden Punkte darf der Restposten nicht mit wegfallen.

---

## Strukturelles — was mit BAUSTELLEN.md selbst geschehen soll

**1. Zuerst: `tools/liste.js` wieder sehend machen.** Die erste `---`-Zeile steht in Zeile 763 statt vor `## Sofort` (Zeile 99). Bis das repariert ist, sieht das Werkzeug nur `## Erledigt` mit 0 Punkten, die Bruecke kann nichts eintragen, und **kein Punkt dieser Liste laesst sich auf dem vorgesehenen Weg abhaken**. Getreten hat das Commit 5bdd005 (04.09. 19:52) mit seinen 77 Loeschungen. Derselbe Commit hat in Zeile 38 einen mitten im Wort abbrechenden Regelpunkt hinterlassen (`- **\`## Sofort`) — mitreparieren.

**2. Neun wortgleiche Doppel entfernen.** Nr. 1 und 3–10 sind derselbe Schub-Alarm, neunmal (BAUSTELLEN.md:101, 113, 121, 129, 137, 145, 153, 161, 169) — 36 % des Abschnitts `## Sofort` sind erledigtes Rauschen. Die Commit-Nachricht von 5bdd005 behauptet, acht davon entfernt zu haben; der Diff zeigt vier **Zugaenge** und keinen Abgang.

**3. Weitere Doppelfuehrungen zusammenlegen:**
- Nr. 20 und Nr. 34 beschreiben dieselbe Codezeile (`tools/tor.js:86`) — ein Eingriff erledigt beide.
- Nr. 32 und Nr. 39 ueberschneiden sich im GEWICHT-Fehler von `tools/augplan.js:114-117`.
- Nr. 28 und Nr. 29 betreffen dieselbe Region in blade.js; Nr. 28 ist erledigt, Nr. 29 der Rest.
- Nr. 36 steht ein zweites Mal als Skeptiker-Befund Nr. 5 in Zeile 1183.
- Nr. 16 und Nr. 17 gehoeren zusammen (Kaltstart), Nr. 44 und der Skeptiker-Befund Nr. 8 in Zeile 999-1003 ebenfalls.

**4. Zwei unverfolgte Meldungen einsortieren.** In `nodes/BAU-2026-09/sofort/` liegen zwei Dateien, die `git status` als `??` fuehrt und die nie in der Liste angekommen sind: „Spiel-Tab nicht verbunden" (05.09. 20:46) und „Bruecke ohne Sicherung" (05.09. 22:43). Beide gehoeren nach `## Sofort` — nach Schritt 1.

**5. Worktree aufloesen.** `bitburner-bau` (74d4418) ist vollstaendig in master und hat keine Aufgabe mehr, haelt aber eine zweite `src/`-Kopie und faelscht ueber `ladeAusBeiden` die gesamte Testsuite (L1/L42). `git worktree remove` plus Zweig loeschen — nie `git clean`.

**6. Danach die Liste dritteln.** Nach diesem Audit bleiben von 45 Punkten: 10 abhaken, 5 streichen, 9 nach „spaeter", 4 nach „in Lauf 3", 9 vor dem Sprung. Der Abschnitt `## Sofort` sollte danach nur noch die 9 Vor-dem-Sprung-Punkte und die 14 dazugehoerigen Luecken enthalten — alles andere gehoert nach `## Offen` oder nach `nodes/ERLEDIGT.md`.

**7. Und der Grund, warum es so weit kam:** `BEFUNDE.md` hat zwei nie gefuellte Platzhalter (Abschnitte „A–J" und „S"), genau dort haette das Punkt-fuer-Punkt-Urteil der Bau-Sitzung ueber diese 45 Eintraege stehen sollen. Die Stufe-A-Abnahme hat „ohne stilles OFFEN" trotzdem gebucht, weil ihr Zaehler nur `###`-Statuszeilen sieht und leere `##`-Abschnitte durch das Raster fallen.

---

## Anhang: alle 45 Punkte

| Nr | Titel (gekuerzt) | Urteil | Dringlichkeit | Beleg |
|---|---|---|---|---|
| 1 | Grosser Schub verweigert (51 Dateien) | ERLEDIGT | keine | RPC 09:26:37: 142/143 byte-gleich; Fix bc5243d |
| 2 | Bruecke ohne Sicherung, Stand in Downloads | TEILWEISE | vor dem Sprung | `data/sofort.json` 2x export-Alarm, Downloads leer |
| 3 | Schub verweigert (50 Dateien) — wortgleich zu 1 | ERLEDIGT | keine | BAUSTELLEN.md:113 |
| 4 | Schub verweigert (49) — wortgleich zu 1 | ERLEDIGT | keine | BAUSTELLEN.md:121 |
| 5 | Schub verweigert (49) — wortgleich zu 1 | ERLEDIGT | keine | BAUSTELLEN.md:129 |
| 6 | Schub verweigert (49) — wortgleich zu 1 | ERLEDIGT | keine | BAUSTELLEN.md:137 |
| 7 | Schub verweigert (49) — wortgleich zu 1 | ERLEDIGT | keine | BAUSTELLEN.md:145 |
| 8 | Schub verweigert (47) — wortgleich zu 1 | ERLEDIGT | keine | BAUSTELLEN.md:153 |
| 9 | Schub verweigert (42) — wortgleich zu 1 | ERLEDIGT | keine | BAUSTELLEN.md:161 |
| 10 | Schub verweigert (41) — wortgleich zu 1 | ERLEDIGT | keine | BAUSTELLEN.md:169 |
| 11 | bn4rep.js laeuft seit 26 h nicht | ERLEDIGT | keine | 1302cd6; augReset 06.09. 01:55:06 |
| 12 | ausgang.js + route.json (I.1) | ERLEDIGT | keine | `data/ausgang.json` route_state open; test-route 39/39 |
| 13 | AUDIT VOLLE AUTONOMIE liegt vor | ERLEDIGT | keine | 9160c75 + 1302cd6 |
| 14 | Sleeve-Gym ohne Geldpruefung | ERLEDIGT | keine | `src/sleeve.js:360-368`; 22 Proben gruen |
| 15 | Kampftraining 1/19 der Gym-Rate | TEILWEISE | vor dem Sprung | `figwatch.json` figure_conflict 454; STATUS C.11 |
| 16 | Kaltstart-Kickstart 02.09. | ERLEDIGT | keine | `bn4net.js:1171` faktor 1,0, live |
| 17 | Kaltstart BN10, fuenffacher Preis | TEILWEISE | vor dem Sprung | `bn4net.js:1145-1163` gegen `:1171`; BEFUNDE L.1 |
| 18 | checkin.js: ANLAUF sieht keinen Stillstand | OFFEN | vor dem Sprung | `checkin.js:386-400,825-833`; 8x ANLAUF mit null |
| 19 | KURS.md gilt fuer Lauf 1 | OBSOLET | keine | KURS.md unveraendert seit 8fc8777; Rang 425.013/400.000 |
| 20 | tor.js liest veraltete Telemetrie | OFFEN | vor dem Sprung | `bblage.json` 36,8 h alt, rang 5837 |
| 21 | Spielanteil zu hoch geschaetzt | IRRIG | keine | 135,93 h Fenster = 100,0 %; 18/18 ≥ 99,8 % |
| 22 | Black-Ops-Ausgang nicht erkannt | ERLEDIGT | keine | `ausgang.json` status „BlackOps offen" |
| 23 | Vier Restbefunde Skeptiker-Lauf 1 | TEILWEISE | in Lauf 3 | `bn4rep.js:1266` Handschlag; WARTE_MAX_MS 90000 |
| 24 | Graft-Treiber je Lauf weiterlaufen | TEILWEISE | vor dem Sprung | `graft.json` 31.08. 03:03; graftplan.json fehlt |
| 25 | Assassination-Weg, 63 h, Graftpaket maximal | OBSOLET | keine | Rangziel ohne Graft erreicht; graftplan.json ersetzt |
| 26 | `reference/` ist nicht das Spiel | ERLEDIGT | keine | 91 Augs gegen v301: 0 Abweichungen |
| 27 | Einbau-Ausloeser kennt seinen Preis nicht | OFFEN | vor dem Sprung | `bn4rep.js:331,1092-1097`; endspurt.js:279 inert |
| 28 | CHANCE_SKILLS zurueckgenommen | ERLEDIGT | keine | `blade.js:806-819` unveraendert seit 29.08. |
| 29 | blackOpArbeit behaelt letzten Wert | OFFEN | keine | `blade.js:1936-1938`; Fenster ≤ 60 s |
| 30 | Operationen freigeben, drei Fehler | TEILWEISE | in Lauf 3 | `blade.js:2481,2825`; Operationsblock 04.09. 19:56–22:20 |
| 31 | Elf Fehler in der Doku | TEILWEISE | spaeter | AUFTRAG:151 Hash-Festpreis; AUFTRAG:155 falsche Passage |
| 32 | augplan.js ohne BitNode-Multiplikatoren | TEILWEISE | spaeter | Lauf 09:43:37: CRTX42-AA „KAUFBAR" bei halber Schwelle |
| 33 | Field Analysis statt Kammer, +80 % | TEILWEISE | spaeter | 47,6 h gemessen: Kammer 19,2 %, Field Analysis 0,1 % |
| 34 | tor.js steigt in der Division aus | OFFEN | vor dem Sprung | `tor.js:86-89`; `t_gate`/`t_rebuild_h` ohne Schreiber |
| 35 | rueckstand.js sieht keinen Spielausfall | OFFEN | in Lauf 3 | `rueckstand.js:111`; engine.tsx:344,349 |
| 36 | Chaos 25–50 ohne Rueckweg | TEILWEISE | spaeter | Riegel steht auf 19 (e8d5f9d); `chaos_city` null |
| 37 | Sleeve-Shock 99,9 nach Einbau | IRRIG | spaeter | Sleeve 1 nach 8,06 h auf 38,87; prestige() nur bei Knotenwechsel |
| 38 | Sleeve-Vorratsschwelle ueberlebt Abschluss nicht | TEILWEISE | in Lauf 3 | `sleeve.js:302,327`; live `infiltrate` |
| 39 | Bladeburner-Augs mit 0,00 bewertet | ERLEDIGT | keine | chance-Mult 1,916 = alle 13 Stuecke |
| 40 | Hash-Upgrades ab SF9 | TEILWEISE | spaeter | `requiresFeature: 9` ohne `lage.features` |
| 41 | Diplomacy frisst 28,7 % der Zeit | IRRIG | keine | 47,6 h: 12,0 min = 0,49 %; f912f25/8442728 |
| 42 | Erfahrungsofen (B1) | OFFEN | spaeter | `bn4net.js:428` ohne expfarm; kein `ns.exec` |
| 43 | Boersen-Bot fuer BN8 | TEILWEISE | spaeter | boerse.js gebaut (3c43c7d); kein `{stock:true}` |
| 44 | Darknet-Labyrinth (BN15) | OFFEN | spaeter | kein `ns.dnet` in src/; labyrinth.ts:419-422 |
| 45 | Source-File -1, letzte vier Exploits | TEILWEISE | vor dem Sprung | 7 Exploits (RPC 09:52:46); Port 9222 HTTP 000 |
