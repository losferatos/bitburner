# Robustheitspruefung FLUSS - Datenfluss des Bots (Audit 04.10.2026)

Auftrag: alle Dateien/Ports/Felder, die `src/` schreibt und liest, plus was `sync/`
(Bruecke), `tools/` und `dashboard/` lesen und schreiben, gegeneinander stellen:
geschrieben und nie gelesen (toter Kanal wie `truppAnfrage`), gelesen und nie
geschrieben (Leser wartet ewig, Standardwert greift still), Telemetrie-Felder ohne
Leser, Formatbrueche.

Stand der Messung: Systemzeit 04.10.2026 13:08-13:41 (Bericht 13:41), Spielstand
`LIVE_197f4d61481686_BN2L2_2026-10-04T13-17_hourly.json.gz` (BN2.2, 173 Textdateien
auf home), Bot-Stand master (P0/P1/P2/P2c/P2d live).

Die vollstaendige Tabelle `Datei | Schreiber Datei:Zeile | Leser Datei:Zeile` erzeugt
`tools/audit/datenfluss.mjs`; sie liegt generiert in
`nodes/audit-2026-10-03/robust-fluss-tabelle.md` (341 Zeilen, nicht von Hand
gepflegt). Dieser Bericht wertet sie aus und widerspricht ihr, wo sie irrt.

## 1. Kurzfazit

- Der Datenfluss des **autonomen Kerns** ist sauber: 82 von 190 Spiel-Dateien haben
  Schreiber UND Leser; von den 17 Telemetriedateien der Registry liegen 15 im Spiel und
  tragen alle das Zeitfeld, das der Leser erwartet (`zeit`/`ts`/`wall`); 14 sind frisch,
  `csolve.json` ist alt (csolve.js `until-done`, laeuft nicht), `boerse.json` und
  `graftauto.json` fehlen aus erklaerbarem Grund (BN8-Gewerk; Zuender gesperrt). Kein
  `ns.write` ohne Modus (Standard `"a"` haengt an, `NetscriptFunctions.ts:1039`), kein
  Anhaengen an JSON.
- **Kein Befund hat einen direkten Ertrag in Rang/h, Rep/h oder $/h.** Was die
  Untersuchung findet, ist Beobachtbarkeit und Hebel-Wirkung der **Beobachtungs- und
  Bedienwerkzeuge**: ein Ereignisstrom, der seine eigene Zusage bricht (FLUSS-1), ein
  Notruf, ein Sperrkassen-Hebel und eine Gleichstands-Zahl, die auf nichts zeigen
  (FLUSS-3/4/5), ein klebender Bruecken-Alarm (FLUSS-7).
- **Der einzige Befund mit Prioritaet P2: FLUSS-1.** `data/events.json` besteht (Stand
  04.10.) zu 98 % aus einer einzigen Figur-Konflikt-Notiz, die Aufbewahrungszusage der Klasse
  `bleibt` wird von vier Fremdschreibern gebrochen, und die Wochen-Kennzahl
  `ladder_rungs_ge3_per_week` kann in keinem der 25 Tagesstaende auch nur 5 Tage
  sehen.
- **Offene Frage mit moeglichem Ertragsbezug: FLUSS-2** (Figur ohne gueltige
  Vergabe, 1-95 Meldungen/h seit 05.09.). Ursache nicht geklaert, Uebergabe an
  Bladeburner-/Orchestrierungs-Pruefer mit Messvorschrift.
- Nicht geprueft wurden Formatbrueche **innerhalb** der Spielobjekte (z. B. Felder
  von `ns.getPlayer()`); das ist Sache der Bereichsberichte.

## 2. Methode und Eichung

Werkzeuge (alle unter `tools/audit/`, nur lesend gegen `src/`):

| Werkzeug | Zweck |
|---|---|
| `datenfluss.mjs` + `datenfluss-lib.mjs` | AST-Analyse (acorn): jede Stelle mit `ns.write/read/fileExists/rm/scp/mv/ls/exec` und jeder Port-Aufruf in `src/`, `rpc getFile/pushFile` und `fs.*` in `sync/`+`tools/`. Dateinamen werden als Konstante aufgeloest (const-Tabellen, Vorlagen, for-of, Importe, Funktionsrueckgaben); Funktionen, die einen Parameter bis `ns.write/read` durchreichen (`lib/hostdatei.js` u. a.), werden als Wrapper erkannt, ihre Aufrufer zaehlen als Schreiber/Leser (Fixpunkt). `--felder`: Schluessel der geschriebenen Objekte gegen die verfolgten Zugriffe der Leser. `--spielstand`: Abgleich mit den Dateien auf home im Spielstand. |
| `fluss-save.mjs` | liest die Textdateien von home aus einem Spielstand (`--zeige <datei>`) |
| `fluss-frische.mjs` | prueft je Registry-Telemetriedatei Zeitfeld und Alter gegen `freshnessMs` |
| `fluss-registry.mjs` / `fluss-libs.mjs` | Registry-Felder ohne Leser; `needsLibs` gegen die echten Importe |
| `fluss-events.mjs`, `fluss-events2.mjs`, `fluss-events3.mjs` | Ereignisstrom ueber alle Tagesstaende (Arten, Texte, Spannen, Schreiber) |
| `fluss-ps.mjs` | welches Skript auf welchem Server laeuft (Wirte) |
| `fluss-dashboard.mjs` | Felder, die `dashboard/index.html` liest, gegen den Spielstand |
| `fluss-writemode.mjs` | `ns.write` ohne Modus-Argument |

Eichung (jeder "kein Fund" ist nur so viel wert wie diese Proben):

- **Selbstprobe `datenfluss.mjs --selbstprobe`: 9 von 9 ok.** Eingebaut sind ein toter
  Kanal (const + `ns.write`), ein blinder Leser, eine for-of-Liste, ein Wrapper mit
  Vorlagenname und ein totes Feld in einem per Variable geschriebenen Objekt -
  alle werden gefunden.
- **Eichung am echten Fall `--eichung-alt`:** der Stand vor Commit fe3b013 wird per
  `git show` (nur lesend) in ein Temp-Verzeichnis gelegt und durch die Feldanalyse
  geschickt; `truppAnfrage` in `data/blade.json` muss als "NUR im Schreiber"
  auftauchen. **Ergebnis: gefunden** (`nurSchreiber: blackOpRang, boEndspiel,
  boSchwelle, chaosMax, fahrbar, hp, rangHoch, truppAnfrage`).
- **Abgleich gegen den Spielstand** (`--spielstand`): jede Datei der Tabelle wird auf
  Existenz auf home geprueft, bei JSON jedes statisch gefundene Feld gegen die
  tatsaechlichen Schluessel. Das deckt Schreiber auf, die nie laufen ("nicht im
  Spiel"), und Leser, die ein Feld erwarten, das es live nicht gibt.
- **Dashboard-Probe:** ein erfundener Zugriff `net.zzzNiemandSchreibtDas` wird als
  FEHLT gemeldet; alle 29 echten Zugriffe des Dashboards sind im Spielstand vorhanden.
- **Ereignisstrom-Eichung:** Summe der Textgruppen = Zahl der Eintraege in 25 von 25
  Staenden; als unabhaengiger Sollwert dienen die 15 Knotenwechsel laut
  `backups/INDEX.tsv`, gegen Median 1 `jump`-Eintrag im Strom.
- **Eichung gegen die Spielquelle:** `scp(files, destination, source?)`, Quelle ist
  der aktuelle Server (`NetscriptDefinitions.d.ts:8262-8265`); `ns.write` Standard
  `"a"` (`NetscriptFunctions.ts:1039`); `ns.read` liest immer lokal
  (`NetscriptFunctions.ts:1076-1078`); ein Augmentierungs-Einbau loescht alle Server
  ausser home (`Prestige.ts:73-74`, Knotenwechsel `Prestige.ts:221`).

Zahlen der Analyse: 141 Skriptdateien in `src/`, 70 Host-Dateien (`sync/`, `tools/`),
72 Wrapper-Eintraege, 752 Spiel-Stellen, 394 Host-Stellen; 16 Spiel- und 19
Host-Stellen mit nicht aufloesbarem Namen (Registry-`telemetryFile`, `ns.ls`-Muster,
Handwerkzeuge - einzeln gesichtet). Live-relevant sind nur die Registry-Schleifen
`guard.js:417` und `bn4net.js:5113` (Namen aus `registry.json`, gesondert geprueft,
siehe `fluss-frische.mjs`) und das Antragsmuster `data/figure-request-{?}.json`
(Schreiber `lib/figurns.js:111`, Leser `bn4net.js:4497-4499` per `ns.ls`, ueber das
Namensmuster zugeordnet).

## 3. Ergebnis der Tabelle

190 Spiel-Dateien (ohne Skripte, mit Namensmustern):

| Klasse | Zahl | Bewertung |
|---|---|---|
| Schreiber und Leser | 82 | Kanal in Ordnung (Ausnahmen unten: events.json, reserve.txt) |
| nur geschrieben | 95 | 27 von Live-Skripten, 68 von Handwerkzeugen (nicht im Live-Satz, siehe 3.1) |
| nur gelesen | 10 | 8 Schalter/Uebersteuerungen, 1 vestigial, 1 tot (3.2) |
| Rest (nur ls/rm/scp) | 3 | ohne Belang |

"Live-Satz" = Wurzeln `boot.js`, `bn4net.js`, `guard.js`, `ausgang.js`, `exit.js` plus
jeder Registry-Eintrag, dazu jede Zeichenkette, die ein Skript des Satzes als
Skriptnamen enthaelt (absichtlich ueberschaetzt: ein Skript ausserhalb des Satzes wird
sicher nicht autonom gestartet). 40 Skripte; im Spielstand laufen 19 Nicht-Arbeiter-
Skripte (Registry-Zaehlwerk `kpi.registry`: 20 gelten, 20 laufen - ein Eintrag ist
`worker/weaken.js`).

### 3.1 Geschrieben, nie gelesen

**Handwerkzeuge (68 Dateien):** Ausgaben von Einmalwerkzeugen (`probe*.js`, `*check.js`,
`kill*.js`, ...), gelesen von Menschen. Das ist kein toter Kanal, sondern das Ziel
"Mensch liest die Datei". Auffaellig nur: `data/telemetry.txt` (3,9 KB, Schreiber
`telemetry.js`/`autopilot.js:1945`, beide nicht mehr gestartet) und `data/stat.json`
- Altlasten ohne Pflege.

**Live-Skripte (27 Dateien), einzeln gesichtet:**

| Datei | Schreiber | Zweck |
|---|---|---|
| `bn4net-log.txt`, `bn4life-log.txt`, `bn4rep-log.txt`, `bn4door-log.txt`, `gang-log.txt`, `shop-log.txt`, `figwatch-log.txt`, `guard-log.txt`, `graftauto-log.txt`, `boerse-log.txt`, `cdump-log.txt` | je Gewerk | Protokoll fuer Menschen (gedeckelt auf 40-300 Zeilen); lesbar ueber `hole`-Werkzeuge |
| `hacknet.txt`, `homegrow.txt`, `darkweb.txt`, `joinrun.txt`, `netburn.txt`, `csolve.txt`, `wakelock.txt`, `popups-wache.txt`, `boot.txt` | je Gewerk | dasselbe |
| `rep-ziel.txt` | `bn4rep.js:2951` | Rangliste der Faktions-Ziele, Diagnose (744 B) |
| `bbjoin.txt` | `bbtrain.js:352` | Zeitstempel des Divisionsbeitritts; sein einziger Zweck war der Zwei-Stunden-Kontrollpunkt aus `nodes/ROUTE.md`, den heute niemand mehr liest (13 B) |
| `fertig.txt` | `ausgang.js:235` | Marker "Route abgearbeitet"; die Information steht auch in `ausgang.json.fertig` |
| `cdump.json` | `cdump.js:165` | Telemetrie ohne Registry-Eintrag (`telemetryFile: null`) |
| `popups-beitritt.txt` | `popups.js:221` | **nur Anhaengen** (14,2 KB, wachsend, nie gekuerzt); Wachstum ~45 B je angenommener Einladung, ohne Folgen |
| `punish.json` | `punish.js:99` | nicht im Spiel: Sprosse 5 lief nie (siehe 3.2, `punish-scharf.txt`) |

Es ist **kein einziger Anfrage-/Signal-Kanal darunter** (die Klasse von
`truppAnfrage`). Alle Dateien, in die ein Gewerk "etwas fuer ein anderes Gewerk"
schreibt, haben einen Leser.

### 3.2 Gelesen, nie geschrieben

| Datei | Leser | Urteil |
|---|---|---|
| `batch-ziele.txt` | `bn4net.js:1968` | Uebersteuerung fuer Messungen ("0" schaltet Stapelbetrieb ab); Vorgabe steht im Code. Absicht |
| `bn4-stop.txt` | `bn4net.js:979,1017`, `bn4life.js:130,224`, `boot.js:57` | Notbremse von Hand. Absicht |
| `boerse-schliessen.txt` | `boerse.js:161` | Schalter von Hand. Absicht |
| `guard-observe.txt` | `boot.js:251`, `guard.js:295` | Schalter (Beobachtungsmodus). Absicht |
| `gang-an.txt` | `bn4rep.js:2287`, `gang.js:1055`, Registry `requiresFile` | Freigabeschalter; **liegt im Spiel (131 B)**, Gang laeuft. Absicht |
| `gang-geld-aus.txt` | `gang.js:1249` | Notschalter Geldmodus. Absicht |
| `punish-scharf.txt` | `bn4net.js:4599` | schaltet Sprosse 5 (automatischer Einbau bei Stillstand) von Trockenlauf auf scharf; **nie angelegt, `punish.json` nie geschrieben** - die letzte Waechter-Sprosse ist dauerhaft stumm. Entscheidung, kein Fehler |
| `exit-ziel.txt` | `boot.js:166` | vestigial: steht nur in der Aufraeumliste (`boot.js:147`: "hat keinen Schreiber mehr") |
| `brain.txt` | `telemetry.js:43-45` | Altlast des Autopiloten |
| **`hilfe.txt`** | Dashboard, `tools/wache.js:735`, `tools/checkin.js:159`, `tools/strategie-check.js:444`, `boot.js:116` | **tot, siehe FLUSS-3** |

### 3.3 Felder ohne Leser (JSON, 72 Dateien, 757 Felder)

134 Felder tragen "NUR im Schreiber" (kein Eigenschaftszugriff und kein Schluessel
in einer anderen Datei). Gesichtet fuer die Live-Dateien: **alles Anzeige-Telemetrie
fuer Menschen und Schleifen** ohne Entscheidungsbezug (`einbau.json: mindest,
kampfknoten, gangHold, spendenAusnahme` - bn4rep.js:1520 nennt den Zweck selbst:
"damit ein Loop sie ohne Auftragskanal lesen kann"; `bn4net.json: expZiel, mischung,
motorStunden, shareFaeden, stapel, werkbankReserve, zieleAnzahl, batchModus`;
`gang.json: recruits, territory, warfare, wanted, taskCounts`;
`export.json: bridgeAlterMs, exportiertJetzt, saeumig`;
`boerse.json: bar, beste, erloesBeimSchliessen, hat4S`). Kein Feld hat die Gestalt
einer Anfrage an ein anderes Gewerk.

Der einzige bekannte Fall der Klasse, `blade.json.truppAnfrage`, ist seit fe3b013
gelesen; die Eichung findet ihn im alten Stand (Abschnitt 2).

### 3.4 Formatbrueche (Leser erwartet, was kein Schreiber schreibt)

Die Analyse meldet je Datei die gelesenen, aber nie geschriebenen Schluessel: 17
Dateien mit Meldung. **15 sind Fehlalarme** (Leser-Variable wird in derselben Funktion
fuer ein anderes Objekt wiederverwendet, z. B. `bn4net.js:1505`; `{fehlt, wert}`-Huellen
von `spielJson` in `tools/hotswap.js`; Marker, die das Werkzeug selbst setzt -
`bblage.json.__kanalBelegt` stammt aus `tools/strategie-check.js:106`; bedingte
Fehlerfelder wie `ausgang.json.wirtFehlt/notExecutable`; neue P2d-Felder von
`gang.json`, die der Stand 12:17 noch nicht tragen konnte). Echt sind **drei Felder in
zwei Dateien**:

| Leser | erwartetes Feld | Schreiber | Befund |
|---|---|---|---|
| `punish.js:256` | `bbtrain.json.trainiert` | `bbtrain.js:91` schreibt `{zeit, host}` | tot; `punish.js:293-296` weiss es selbst, `kampfAufbau` deckt den Fall - **FLUSS-11** |
| `tools/checkin.js:597-599` | `bn4net.json.spielzeitImKnoten`, `bericht.spielzeitImKnotenH` | niemand | **FLUSS-5** |
| `tools/bn4.js:76` | `bn4net.json.ausbauKosten` | niemand | Zeile "naechster Ausbau" zeigt immer `-`; **FLUSS-5** |

Geprueft und in Ordnung: `gang.json` Zeitstempel (Schreiber `ts`/`wall`, Leser
`[tel.ts, tel.wall]` in `lib/einbau.js:1133` und `[ts, wall, zeit]` in
`tools/lib/gangzeile.js:71`); `strategie-check.js:835,873` liest `knoten.json.kampf`,
das der Live-Schreiber `bn4rep.js:711` nicht schreibt - die Kette
`(ks.kampf) || (net.kampf)` faengt es ab (`bn4net.json.kampf` existiert,
`bn4net.js:4453`).

### 3.5 Wirte: wo die Skripte wirklich laufen

`fluss-ps.mjs` am Stand 13:17:

| Server | Skripte |
|---|---|
| home | guard, bn4net, bn4life, wakelock, popups, hashes, ausgang, bbtrain, sleeve, figwatch, export, shop |
| netlink | blade.js |
| foodnstuff | hacknet.js |
| sigma-cosmetics | homegrow.js |
| joesguns | bn4door.js |
| silver-helix | gang.js |
| werk-0 | contracts.js --loop 300 |
| werk-1 | bn4rep.js |

7 der 19 Werkzeuge laufen fremd. Fuer jeden Kanal heisst das: `ns.read` liest nur
lokal, `ns.write` schreibt nur lokal, ein Einbau loescht die Fremdserver samt Dateien.
Die Wirtepruefung (35 Treffer vor Sichtung) reduziert sich nach Sichtung auf **einen
echten** (FLUSS-10); der Rest sind `boot.js`/`autopilot.js` (laufen auf home, lesen
mit `fileExists(.., "home")`) und Dateien, die per `ns.scp(.., "home", hier)`
zurueckkopiert werden, was die Analyse bei Zweiargument-Aufrufen teils nicht sieht.
Bestaetigt am Spielstand: `gang.json` (silver-helix) 2 s alt auf home, `blade.json`
(netlink) 6 s, `bn4rep.json` (werk-1) 7 s, `bn4door.json` (joesguns) 11 s - die
Rueckkopie funktioniert.

### 3.6 Host-Seite (52 Dateien/Muster)

22 mit Schreiber und Leser. 18 nur geschrieben: 8 Sicherungs-Muster (von
`sync/backup.js` per Verzeichnisliste gelesen), Protokolle, `bridge.pid`, `tor.json`
- und `bridge-alarm.json` (FLUSS-7). 12 nur gelesen: menschengepflegte Dokumente und
`nicht-schieben.txt`, `zweittab-alarm.json` (entsteht per `.tmp` + `rename`,
`sync/bridge.js:546-551` - Fehlalarm der Analyse) und **`watchdog.json`
(`sync/bridge.js:2390`, FLUSS-6)**.

### 3.7 Argumentvertrag `exec/run/spawn` gegen `ns.args`

12 Abweichungen von 33 Aufrufen. 8 davon sind Absicht: Arbeiter nehmen 5 Argumente
(`ziel, verzoegerungMs, landeZeit, aktionsDauerMs, kennung`, Kopf von
`worker/weaken.js`), das fuenfte ist eine Kennung zur Unterscheidung der Instanzen und
wird nicht gelesen. `xp.js:140` uebergibt 3 Argumente, das dritte (`"xp-..."`) wird
von `Number()` zu `NaN` und faellt in den Rueckfall - harmlos. **Echt: `bn4start.js:116`
(FLUSS-9).**

### 3.8 Ports

Drei Port-Aufrufe in `src/`, alle in `autopilot.js:656-657` und `invest.js:83`
(Handwerkzeuge). Der Live-Bot benutzt keine Ports.

## 4. Befunde

Prioritaeten: P1 = beeinflusst Rang/Rep/Geld oder Spielstand, P2 = Beweis-/
Steuerungswert, P3 = Pflege. Kein Befund ist P1.

### FLUSS-1 (P2, FEHLER) - Der Ereignisstrom bricht seine eigene Zusage

**Beleg.** `lib/events.js:56-71` erklaert `jump`, `install`, `penalty`, `gate` zur
Klasse `bleibt` (bis zu 60 Eintraege ueberleben jede Kuerzung, `beschneiden`,
`lib/events.js:118-131`). Daraus rechnet `bn4net.js:5150-5152`
`ladder_rungs_ge3_per_week` ("Sprossen ab 3 in den letzten sieben Tagen") und
`bn4net.js:5155-5172` `queued_augs_at_jump`. Vier Schreiber kuerzen den Strom aber
selbst und kennen die Klasse nicht:

- `figwatch.js:221` `while (length > 400) shift()` (schneidet vom Ende der Zeitachse,
  also genau die alten `jump`-Eintraege),
- `graftauto.js:444` dasselbe,
- `punish.js:134` dasselbe mit 460,
- `popups.js:288-289` `slice(-200)` - und `popups.js:286` setzt `bleibt: true` als
  Feld am Eintrag, das `lib/events.js` gar nicht liest (Einstufung nur ueber
  `ARTEN[art].bleibt`; `blocked` ist dort `bleibt: false`).

Dazu hat `gate` **keinen Schreiber** (die Zeichenkette `"gate"` kommt in `src/` nicht
vor; die `ereignis(...)`-Aufrufe des Kerns, `guard.js:264,663`, `ausgang.js`,
`export.js`, `boerse.js` benutzen nur `boot`, `jump`, `install`, `contract_stumm`,
`penalty`, `blocked`, `note`), und `install` wird nur in dem Fall geschrieben, den der Code selbst fuer
unmoeglich haelt (`bn4net.js:4770-4781`: "Ein Reset MITTEN im Prozessleben kann es
nicht geben"); `bn4rep.js`, das den Einbau ausloest, importiert `lib/events.js` nicht.
Echte Einbauten tauchen im Strom nie auf.

**Messung** (`fluss-events.mjs`, `fluss-events3.mjs`, 25 Tagesstaende seit 05.09.):
im Stand 04.10. 13:17 besteht der Strom aus 396 `note`, 3 `boot`, **1 `jump`**; von den
396 Notizen sind **393 dieselbe Meldung** ("Figur-Konflikt: niemand hat die Figur,
sie tut aber bladeburner"). Die Notiz kommt aus `figwatch.js:144-160` alle zwei Runden
(`TAKT_MS = 15000`, `verdacht` wird nach der Meldung geloescht und in der naechsten
Runde neu gesetzt): Median-Abstand **30,015 s** (Soll aus dem Code: 2 x 15 s). Rate
29,4/h; der 400er-Puffer fuellt sich in 13,4 h. Anteil der Figur-Konflikt-Notizen
(die zwei haeufigsten Texte zusammen) an allen Eintraegen: **70-99 % in 25 von 25
Staenden**.

**Eichung.** Summe der Textgruppen = Eintragszahl in 25 von 25 Staenden. Sollwert
unabhaengig: `backups/INDEX.tsv` zaehlt **15** Knotenwechsel zwischen erstem und
letztem Stand; im Strom stehen davon Median 1 (an 10 von 25 Staenden 0, Maximum 7 am
22./23.09.). Spanne
des Stroms (erster bis letzter Eintrag) je Stand: Median **16,9 h**, Maximum **106,5 h**;
kein einziger Stand reicht an die 168 h der Wochenkennzahl. In den
Hackingknoten BN1/BN5/BN12 (24.09.-02.10.) deckt der Strom nur **3,8-6,2 h**.

**Wirkung.** `ladder_rungs_ge3_per_week = 0` kann nie "keine Strafe diese Woche"
heissen; die Zahl sieht im Schnitt 10 % der Woche. Der Kommentar `bn4net.js:5146-5149`
("der Deckel des Ringpuffers kann die Zahl nur nach UNTEN verfaelschen ... ein
Ueberlauf faellt an den 60 selbst auf") gilt nur, wenn alle Schreiber
`lib/events.js` benutzen. Der Abnahmegrundsatz "false_penalty_count = 0 ist
Abnahmebedingung" wird durch eine Kennzahl gestuetzt, die ihr Fenster nicht
hat. Zusaetzlich verdraengt die Notiz-Flut jede echte Information (`error`, `blocked`,
`contract_stumm`, `note: Waechter hat bn4net.js neu gestartet`) binnen 13 h.
`jump_latency_min` ist **nicht** betroffen: sie wird beim Boot eingefroren
(`bn4net.js:4746-4768`).

**Ertrag/Aufwand.** Kein Rang/h. Aufwand S: `figwatch.js:203-223`, `graftauto.js:425-446`,
`punish.js:112-138`, `popups.js:270-292` ueber `evLaden/evAnhaengen` von
`lib/events.js` laufen lassen (`lib/events.js` steht heute in keiner der vier
`needsLibs`: figwatch.js, graftauto.js, popups.js; punish.js steht nicht in der
Registry und wird mit eigener Liste kopiert, `bn4net.js:4638` - nachtragen; die
Bibliothek enthaelt keinen ns-Aufruf, kostet also keinen Speicher), die
Figur-Konflikt-Meldung nach Schluessel
(Besitzer|vergeben|tatsaechlich) auf eine je 10 min drosseln, `gate`/`install` an die
Stellen setzen, die sie meinen (Torrunde-Kauf in `bn4rep.js`, vor
`installAugmentations`). Test: `tools/test-*` fuer den Strom mit einem Fremdschreiber.

### FLUSS-2 (P3, RISIKO, needs_calc) - Die Figur arbeitet oft ohne gueltige Vergabe

Das Symptom hinter FLUSS-1: `pruefeHandlung` (`lib/figur.js:323-337`) meldet
"niemand hat die Figur", wenn `vergabeGilt` (`lib/figur.js:265-271`) falsch ist,
waehrend die Figur arbeitet. Die Staende zeigen es in **jedem Knoten**: 1-95
Meldungen/h seit 05.09. (BN10: 3-21/h; BN4: 1-20/h; BN9: 2-26/h; BN1/BN5/BN12
Faktionsarbeit: 10-95/h; BN2: 10-29/h). In BN2.1 (03.10. 19:39Z - 04.10. 08:37Z) sind es 393 Meldungen x
30 s = **3,3 h von 13,4 h** (24 %), verteilt auf Raid (144), Assassination (138),
Stealth Retirement (72), Retirement (39), mit Haeufungen 21-00 Uhr und um 02 Uhr UTC
(Auswertung der Zeitstempel im Strom, 30-s-Raster). Im laufenden BN2.2 steht die
Vergabe gueltig (`figure.txt`: owner `blade.js`, action `bladeburner`, `leaseBis`
11:29:35Z bei Stand 11:17Z) und `figwatch.json` meldet `stimmt: true`,
`figure_conflict: 1`.

Die zweite Sorte "vergeben fuer bladeburner, tatsaechlich gym" (echtes Wegnehmen)
war 05.-23.09. mit 0,9-28/h verbreitet und taucht ab 24.09. nicht mehr unter den
haeufigsten auf.

**Ursache nicht geklaert.** Moegliche Pfade: `blade.js` erneuert den Antrag nur beim
Start einer Aktion (`blade.js:4570`), nicht waehrend sie laeuft; Antrags-TTL 150 s
(`lib/figur.js:124`) gegen Aktionsdauer; Kern-Rundenabstand im verdeckten Tab. Das
Wegnehmen durch `bbtrain.js` kostet Rang; ein Kampf um die Figur mit dem kuenftigen
Grafting-Zuender (AUG-1) kostet im schlimmsten Fall einen laufenden Graft.

**Messvorschrift (needs_calc).** (1) Je Knoten aus den Tagesstaenden: Zahl der
"niemand hat die Figur"-Notizen x 30 s / Knotendauer = Luecken-Anteil. (2) Im laufenden
Knoten `data/figure.txt` (`leaseBis`, `seq`, `wall`) sekundengenau mit
`blade.json.abschnitt`/`aktion` ueber 2 h loggen und die Luecken gegen Aktionsstart und
-ende legen. (3) Pruefen, ob in den Luecken die Figur den Besitzer wechselt
(`seq`-Spruenge). Uebergabe an die Pruefer Bladeburner/Orchestrierung.

### FLUSS-3 (P3, TOT) - Der Notruf `data/hilfe.txt` hat Leser, aber seit 02.09. keinen Schreiber

`bn4rep.js:583-586`: "Hier stand `rufeMenschen` ... Seit dem 02.09.2026 hat er keinen
Aufrufer mehr"; `bn4rep.js:598` loescht die Datei beim Start. Gelesen wird sie weiter
von `dashboard/index.html:256` (Zeile "Notruf", zeigt "still"), `tools/wache.js:735`
(Befund `hilfe`), `tools/checkin.js:159,255-258` (Absatz "Der Bot hat data/hilfe.txt
geschrieben"), `tools/strategie-check.js:444` und `boot.js:116,139`. Im Spielstand: nicht
vorhanden, erwartungsgemaess.

**Wirkung.** Kein autonomes Skript kann um Hilfe rufen; jede Anzeige "Notruf: still"
ist eine falsche Beruhigung. Der von Erics Regel (kein ntfy, Meldungen nach
`nodes/BAUSTELLEN.md` `## Sofort`) vorgesehene Ersatzkanal existiert
(`data/sofort.json` -> Bruecke -> `nodes/BAU-2026-09/sofort/*.md`,
`sync/bridge.js:2177`), hat aber nur zwei Schreiber: `ausgang.js:675` und
`export.js:279`.

**Aufwand S:** entweder die vier Leser und die Dashboard-Zeile entfernen oder in
`lib/hostdatei.js` eine `sofort(ns, titel, text)` bauen (Muster `export.js:262-279`)
und fuer die Faelle nutzen, in denen der Bot allein nicht weiterkommt
(`EXHAUSTED`, Handschlag verweigert > 1 h, Gang nicht gegruendet nach 6 h).

### FLUSS-4 (P3, TOT) - Der Sperrkassen-Hebel `tools/reserve.js` wirkt auf nichts Lebendes

`tools/reserve.js` ("Sperrkasse setzen", Kopf: "Der Verwalter im Spiel setzt jeden
freien Dollar sofort in Speicher um ... Dieses Werkzeug legt einen Betrag fest, den er
nicht anruehrt") schreibt `data/reserve.txt`. Leser: `autopilot.js:394-395` (laeuft
nicht, Altsystem) und `stocks.js:128-129` (Handwerkzeug, nur BN8). Alle **lebenden
Ausgeber** lesen `data/geldbedarf.txt` (`bn4net.js:1272-1273` Serverkauf,
`homegrow.js:77-78`, `hacknet.js:135`, `bn4life.js:345`, `graftauto.js:337`,
`gang.js:1325`), und die hat **genau einen Schreiber**: `bn4rep.js:2385-2386`.


**Wirkung.** Wer in einer /bb-Sitzung `node tools/reserve.js 30e6` ruft, um Geld fuer
eine Gang-/Torrunde festzuhalten, bekommt keine Wirkung und keine Meldung (die Datei
liegt auf home, 1 B). Kein Skill und keine Notiz in `nodes/*.md` erwaehnt das Werkzeug.
Zusatzrisiko: `geldbedarf.txt` hat keinen Zeitstempel; bleibt `bn4rep.js` haengen, steht
der letzte Betrag stehen (der Boot loescht ihn, `boot.js:116`, die Telemetrie-Aufsicht
startet bn4rep nach 1800 s neu).

**Aufwand S:** Werkzeug streichen oder `max(geldbedarf, reserve)` an den sechs Stellen
(ein Helfer in `lib/endspurt.js:337`).

### FLUSS-5 (P3, TOT) - "Die eigentlich wichtige Zahl" im /bb-Check ist tot

`tools/lib/rangkurve.js:189-210` `vergleichMitReferenz` ("DAS IST DIE EIGENTLICH
WICHTIGE ZAHL ... Der Skeptiker fand am 04.09., dass die Funktion zwar gebaut, aber
nirgends aufgerufen war. Sie ist jetzt in checkin.js angeschlossen") bekommt ihre
Eingabe `hSeitKnoten` aus `netz.spielzeitImKnoten` oder `bericht.spielzeitImKnotenH`
(`tools/checkin.js:597-599`). **Beide Felder schreibt niemand** (`grep` in `src/`,
`tools/`, `sync/`: nur dieser Leser). `hSeitKnoten` ist damit immer `null`, der
Zweig `checkin.js:600-613` (Gleichstand, Urteil `ZAEH` bei > 1,5) laeuft nie. Zweiter
Fall derselben Art: `tools/bn4.js:76` liest `netz.ausbauKosten` (nie geschrieben, Zeile
"naechster Ausbau" ohne Wert).

**Reichweite.** Referenzkurven gibt es nur fuer BN6 und BN10 (`doku/rangkurve-bn6.json`,
`-bn10.json`); fuer BN2 liefert `restzeitAusKurve` ohnehin `null` und `checkin.js`
faellt auf die lineare Schaetzung zurueck (`checkin.js:623-634`). Der Fund wird mit BN6
(Restroute, Platz 4) wirksam.

**Quelle fuer den Fix vorhanden.** `data/kpi.json.motorTimeSinceNodeMs` = 5.881.164 ms
(1,634 h) gegen `erzeugtAm - nodeReset` = 5.882.511 ms - bis auf 1,3 s gleich, weil
der Knoten ohne Pause lief. **Aber Uhr pruefen:** die Referenzkurve ist in
`totalPlaytime`-Differenzen gebaut (`tools/rangkurve-bauen.js:52,137-139`), Motorzeit
zaehlt Offline-Zeit nicht mit. Richtig waere `totalPlaytime` beim Knotenstart in
`data/knoten.json` festzuhalten (`bn4rep.js:711-716` schreibt dort schon `nodeReset`)
und die Differenz zu bilden. Aufwand S.

### FLUSS-6 (P3, TOT) - Der Dashboard-Endpunkt `/api/wache` liest eine Datei, die es nie gibt

`sync/bridge.js:2388-2398` liefert `data/watchdog.json` aus dem **Host**-Ordner
(`DATA_DIR`); dort legt sie niemand ab (`ls data/`: nicht vorhanden). Die Zustandsdatei
des Host-Waechters heisst `data/wache-zustand.json` (`tools/wache.js:32`, Felder
`letztePruefung`/`offeneBefunde` in `:1116-1117`). Das Dashboard
(`dashboard/index.html:192-208`) zeigt deshalb dauerhaft "Waechter: laeuft nicht".
Heute stimmt die Anzeige zufaellig (`wache.js` schreibt seit 02.09.2026 19:05 nicht
mehr, `data/wache.log` mtime), aber sie wuerde auch bei laufendem Waechter nicht
umspringen. Der Fusstext (`dashboard/index.html:338`) behauptet weiter, der Waechter
"meldet Stoerungen von selbst aufs Handy" - seit 31.08. aus. Aufwand S: Dateiname
korrigieren, Fusstext streichen.

### FLUSS-7 (P3, FEHLER) - Der Bruecken-Alarm klebt, seine Datei hat keinen Leser

`alarm()` (`sync/bridge.js:858-870`) setzt `state.alarm` und schreibt
`data/bridge-alarm.json`; **es gibt keine Stelle, die `state.alarm` je zuruecksetzt**
(`grep "state.alarm ="`: nur Zeile 860). Die Datei hat keinen Leser (`bridge.js` laedt
sie beim Start nicht, `checkin.js:694` erwaehnt sie nur im Kommentar). Live gemessen
(GET `/api/state`, 04.10. 13:35): `alarm = {at: "2026-10-03T16:17:42Z", titel:
"Sicherung ausgefallen (hourly)", text: "HTTP 502"}` bei `backupAgeMin = 17,1` - seit
20,8 h laufen die Sicherungen wieder (INDEX.tsv: 16:39Z, 16:45Z, 17:01Z, 17:17Z, dann
stuendlich), der Alarm steht trotzdem. `tools/checkin.js:826` druckt ihn bei jedem /bb als
"ALARM: ..." (und `data/bridge.json` traegt ihn ins Spiel, wo ihn niemand liest -
im Spiel wird nur `lastVerifiedBackup` ausgewertet, `bn4net.js:5090-5096`,
`lib/handschlag.js:208-214`). Ein klebender Alarm wird nach dem dritten Mal ueberlesen;
das ist die Befuerchtung, die `nodes/BAU-2026-09/sofort/erledigt-autosave-fehlalarm.md`
selbst formuliert. Aufwand S: bei der naechsten gruenen Sicherung
(`bridge.js:1871`) `state.alarm = null` und die Datei loeschen.

### FLUSS-8 (P3, TOT) - Der KPI-Kontrakt fuehrt 23 Felder ohne Schreiber

`tools/kpi-luecken.js` (04.09., Skeptiker Runde 4 R11) meldet es seit Wochen: 23 Felder aus `lib/kpi.js`
`FELDER` haben keinen Schreiber und bleiben in `data/kpi.json` `null`
(`motorTimeSinceAugMs`, `workbench_wait_h`, `bridge_restarts`, `blocked_dialog`,
`wasted_money_at_jump`, `t_workbench`, `contract_stock_usd`, `t_gate`, `mult_product`,
`favor_target_pct`, `t_rebuild_h`, `T2_h`, `work_share`, `vorrat_deckung`,
`rang_je_vorratseinheit`, `comms_rest`, `hp_max`, `hp_loss_fail`, `chaos_city`,
`exp_rate_eff`, `v1_stage`, `bn8_phase`, `bestwertStatus`). Mehrere tragen Sollwerte
(`chaos_city` 50, `t_rebuild_h` 3,1, `vorrat_deckung` 0,5, `graft_busy_pct` 100): "eine
Abnahmebedingung darauf kann nicht scheitern". `tools/checkin.js` liest nur eine Handvoll davon (`jump_latency_min`,
`boot_latency_min`, `ladder_rungs_ge3_per_week`, `idle_ram_pct`, `exhausted`, die
Soll-0-Zaehler, `traeger`).
Nicht in `BAUSTELLEN.md` gefuehrt. Aufwand S zum Streichen (Wanderung beim Laden
beachten, `lib/kpi.js` Kopf), M zum Bauen.

### FLUSS-9 (P3, RISIKO) - `bn4start.js` uebergibt `Date.now()` als Verzoegerung

`bn4start.js:116`: `ns.exec(skript, host, faeden, ziel, Date.now())`. Die Arbeiter
lesen `ns.args[1]` als `verzoegerungMs` (`worker/weaken.js:20-34`, ebenso `grow.js`,
`hack.js`): `landeZeit = Number(undefined) = NaN` -> kein Termin, `ms = args[1] =
1,79e12`, gedeckelt auf `1e9` ms = **11,6 Tage** `additionalMsec` (das Spiel lehnt mehr ab,
`Netscript/NetscriptHelpers.tsx:416-417`; die Wartezeit der Aktion waechst um
`additionalMsec / 1000` Sekunden, `NetscriptFunctions.ts:345`). Wer den als
"KALTSTART" beschriebenen Notbehelf (`BAUSTELLEN.md:128-162`, `doku/ram-budget.md:119`)
von Hand startet, parkt jeden Arbeiter fuer Tage. Das Skript hat keinen Aufrufer in
`src/`, `tools/` oder der Registry (Starter-Klasse KEINER). Aufwand S: Argument
entfernen oder das Skript loeschen.

### FLUSS-10 (P3, RISIKO) - `bn4life.js:512` legt den Wiederholungsauftrag nur lokal ab

Beim Rueckstellen eines nicht startbaren Auftrags schreibt `bn4life.js:512`
`ns.write("data/task.txt", roh, "w")` **lokal**; das Leeren der home-Datei davor
(`:370`) geht korrekt ueber `nachHome`. Laeuft `bn4life.js` auf einem Fremdwirt
(Registry `hostRule: werkbank`; heute home), fragt die naechste Runde
`fileExists("data/task.txt", "home")`, holt die geleerte home-Datei per `scp` ueber die
lokale Rueckstellung und verliert den Auftrag still. Selten (Auftrag ohne Platz plus
Fremdwirt), aber der einzige echte Treffer der Wirtepruefung. Aufwand S: `nachHome`
benutzen.

### FLUSS-11 (P3, TOT) - Konfiguration ohne Wirkung

- `punish.js:256`: `bbtrain.trainiert` wird nie geschrieben (`bbtrain.js:91` schreibt
  `{zeit, host}`); `punish.js:293-296` kommentiert es selbst, die Bedingung steht
  trotzdem.
- Registry-Felder ohne Leser in `src/` (`fluss-registry.mjs`): `evictRank` (das
  Raeumen folgt der festen `RAEUM_REIHENFOLGE`, `bn4net.js:466`), `maxInstances`,
  `needsFigure`, `scpToHome`, `ramMeasuredAt`, `ramHeuteGb`. Ein Mensch, der `evictRank`
  aendert, steuert nichts.
- `needsLibs` von `hacknet.js` ist leer, obwohl es `lib/hackaugs.js` importiert
  (`hacknet.js:1`, `fluss-libs.mjs`). Heute **abgedeckt** durch die feste Liste
  `BIBLIOTHEKEN = ["lib/hackaugs.js"]` (`bn4net.js:809`, kopiert bei jedem Start
  `:4297`); fehlt sie dort eines Tages, scheitert `hacknet.js` nach dem naechsten Einbau
  mit `exec = 0`.

## 5. Geprueft und in Ordnung (Negativbefunde mit Eichung)

- **Telemetrie-Frische:** die 15 im Spiel vorhandenen Registry-Telemetriedateien tragen
  `zeit`/`ts`/`wall` (`fluss-frische.mjs`, Eichung: `bn4net.json` Alter 0 s); 14 frisch,
  `csolve.json` alt weil `until-done`; `boerse.json` fehlt (nur BN8) und
  `graftauto.json` fehlt, weil `nicht-schieben.txt` den Zuender `graftplan.json` bewusst
  sperrt (Erics Freigabe laut `STAND.md` steht aus).
- **Dashboard-Felder:** `net`/`rep`/`job` (29 Zugriffe) alle im Spielstand vorhanden
  (`fluss-dashboard.mjs`, Selbstprobe ok).
- **Schreibmodus:** 0 `ns.write` mit weniger als drei Argumenten; die 7 Anhaenge
  betreffen nur `.txt`-Protokolle, keine JSON-Datei.
- **Wirt-Kopien:** die Wrapper in `lib/hostdatei.js` und ihre Handkopien
  (`ausgang.js:132`, `bn4rep.js:487`, `figwatch.js:52`, `graftauto.js:93`,
  `guard.js:76`, `hacknet.js:48`, `shop.js:102`, `lib/endspurt.js:55`) pruefen alle
  `fileExists(.., "home")` vor dem `scp`; sie lesen bei fehlgeschlagenem `scp`
  einen lokalen Altbestand (Fallstrick 2 in `lib/hostdatei.js`), aber `scp` einer
  vorhandenen home-Datei schlaegt praktisch nie fehl. Kein Befund, nur Hinweis.
- **Aufraeumliste `boot.js:96-172`** deckt die lauf- und knotengebundenen Dateien; die
  neue `torrunde-wait.json` ist nicht darin, aber `gangBonusWait`
  (`lib/einbau.js:940-944`) setzt nach `GATE_ROUND_GAP_MS` frisch an.
- **`route.json`:** alle vier Schluessel (`node`, `level`, `verfahren`, `braucht`) haben
  Leser.
- **Zwei Schreiber im selben Postfach:** `install-sperre.txt` traegt zwei Formate (JSON
  `{ts, reason, bis}` und `FIRMENPHASE <Firma>|<ms>`); beide Leser (`bn4rep.js:926,
  1085, 2459`) behandeln beide (`roh.startsWith("{")`). Die Firmenphase kommt nur in
  Hackingknoten vor.
- **Port-/Mehrfachleser:** `data/task.txt` hat zwei Leser (`bn4net.js:1073`,
  `bn4life.js:369`), `bn4net` uebernimmt nur, wenn `bn4life` tot ist
  (`bn4net.js:1062-1072`).

## 6. Offene Fragen

1. FLUSS-2: Ursache der Vergabeluecken (Messvorschrift oben). Gehoert zu den
   Pruefern Bladeburner/Orchestrierung.
2. FLUSS-1: soll `gate` ein echtes Ereignis werden ("Torrunde gekauft")? Es waere die
   beste Zeitreihe, um die offene Frage "Torfrequenz: zwei halbe Runden gegen eine"
   (STAND.md, P2b) nach dem Fakt zu messen.
3. FLUSS-5: Referenzkurven fuer BN2/7/13/14/15 gibt es nicht; dort bleibt der
   /bb-Check auf der linearen Schaetzung, die er selbst als "KEIN Termin" ausweist.
4. FLUSS-4: ob die Sperrkasse als Hebel fuer Eric gewollt ist oder sterben darf.

## 7. Wiederholen

```
node tools/audit/datenfluss.mjs --selbstprobe --eichung-alt --felder --spielstand --md nodes/audit-2026-10-03/robust-fluss-tabelle.md
node tools/audit/fluss-frische.mjs
node tools/audit/fluss-events.mjs ; node tools/audit/fluss-events2.mjs ; node tools/audit/fluss-events3.mjs
node tools/audit/fluss-ps.mjs ; node tools/audit/fluss-dashboard.mjs ; node tools/audit/fluss-writemode.mjs
node tools/audit/fluss-registry.mjs ; node tools/audit/fluss-libs.mjs
node tools/kpi-luecken.js
```

Alle Werkzeuge lesen nur; `src/`, das Spiel und die Bruecke werden nicht veraendert
(einziger Bruecken-Zugriff: ein GET `/api/state` fuer FLUSS-7).
