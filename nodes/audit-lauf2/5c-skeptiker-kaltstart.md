# Teil 5c - Skeptiker zu 5a (Kaltstart K01-K12) und 5b (Betrieb B01-B17)

Stand 13.11.2026. Auftrag: Bauliste angreifen, nicht bestaetigen. Gelesen: 5a, 5b,
REIHENFOLGE, CHRONIK (1, 3), MECHANIKEN; Spielcode `reference/v301/src`
(`NetscriptFunctions/Extra.ts`, `Exploits/*`, `Script/RamCalculations.ts`,
`Netscript/RamCostGenerator.ts`, `Prestige.ts`, `PlayerObject*.ts`), `src/lib/route.js`,
`src/route.json`, `src/registry.json`, `src/guard.js`, `src/lib/leiter.js`,
`sync/instanz.js`, `sync/backup.js`, `sync/bridge.js`, `doku/schlupfloecher.md`,
`doku/ram-messung-2026-09-04.json`, Git-Verlauf von `src/autopilot.js`.
Nichts ausgefuehrt, nichts geaendert. Urteile: HAELT / FALSCH / UNSICHER.

## 0. Kurzurteil

- **5a/5b sind im Kern richtig diagnostiziert** (Kern passt nicht in 8 GB, Route beginnt bei
  BN10, Bruecke weist ein neues Spiel ab, kein SF4-Gate) - die Zahlen halten.
- **Die Bauliste ist zu gross.** K05 (L), K06, K07, K08, K11 (voll) sind Einmalposten fuer
  die ersten 1-3 Stunden bzw. 30-46 Stunden von BN1.1 oder koennen nicht vorab gebaut, nur im
  Lauf gemessen werden. Die Summe "8-12 Tage" in 5a ist ausserdem **arithmetisch falsch**:
  die eigenen Teilspannen ergeben 9-17 Tage (2-3 + 3-5 + 3-6 + 1-3), mit K05b 6-11 (nicht 5-7).
- **K04 ist keine ausgeloeste Exploit-Flagge, aber derselbe Kniff, den das Spiel "Bypass"
  nennt.** Das ist eine Grenzfrage des Besitzers (wie die drei vom 13.11.), keine des Bots.
- **K02/B02 sind derselbe Posten** (doppelt gelistet) und das gefaehrlichste Bauteil: falsch
  gebaut, wird die Sicherungskette selbst zum Datenverlust (Abschnitt 3).
- **Neuer Fund, in keiner Liste: `src/exploit.js`, `exploit2.js`, `exploit3.js`** (Zweck:
  "Source-File -1 einsammeln") liegen in `src/` und gehen per `pushAll` in jedes Spiel, auch
  in den frischen Lauf-2-Stand. Dazu `hacktimer.js`/`timerzwang.js` (Abschnitt 2e).

## 1. Praemisse: lohnt vollautomatisches BN1.1 -> BN4.3?

**Urteil: FALSCH fuer BN1.1 (K05 streichen), HAELT fuer ab BN4.1 (dort laeuft der Kern ohnehin).**

Beleg und Rechnung:

1. **BN1.1 kommt in Lauf 2 genau einmal vor.** Danach hat jeder Knoten SF1 und damit home 32 GB
   (`Prestige.ts:241-252`: SF9>=2 -> 128, SF1>0 -> 32, sonst 8; `PlayerObjectGeneralMethods.ts:70`
   Startwert `maxRam: 8`). Alles, was nur den 8-GB-Zustand und die SF4-lose Welt bedient, wird
   nach BN1.1 nie wieder gebraucht - ausser BN1.2/1.3, aber dort gilt SF4.3 und 32 GB, also
   Kern-Betrieb. K03, K05, K06, K07 sowie der BN1.1-Zweck von K04 sind Einmalposten.
2. **Kosten K05:** L = 3-6 Arbeitstage, Risiko "hoch", Test "nur Ebene 3" (5a selbst). Dazu
   K06 (M), K03 (M), K07 (S), K11-Anteil: zusammen etwa **6-11 Arbeitstage** fuer einen Lauf, der
   46 h (Lauf 1) bzw. laut Modell 24-50 h dauert.
3. **Nutzen K05:** Die Wanduhr von BN1.1 ist spielbegrenzt (Hacking 3000, Red Pill, 100 Mrd fuer
   Daedalus). Lauf 1: BN1.1 46 h, BN1.2 20 h, BN1.3 13 h (CHRONIK 3) - der Sprung 46 -> 20 kommt
   aus SF1/SF-Gewinn und Reife, nicht aus Handarbeit. Ein ungetesteter Autopilot beim ersten
   Mal faehrt nicht schneller als 46 h; realistisch spart er hoechstens einige Stunden
   Begleitung. Und er faellt beim ersten Fehler (Fokus, Einbau) auf Handarbeit zurueck - genau
   wie Lauf 1 ("Neubau am laufenden Knoten", C9).
4. **Begleitaufwand halbautomatisch (K05b):** BN1.1 mit `task.js`/Terminal: grob 8-12 Besuche
   (alle 2-4 h waehrend Eric wach ist) a 10-20 Minuten = **3-4 Stunden Sitzungszeit**, dazu
   rund 50 Handgriffe (TOR/Knacker, home 2x, 5 Faktionen, 6 Backdoors, 4-6 Einbauten, Red Pill,
   w0r1d_d43m0n, BitVerse -> BN4). Das sind etwa **1:20 bis 1:30** zu den Baukosten.
5. **K05b ist aber nicht "0" (5a, Tabelle).** Zwei verdeckte Kosten:
   - `task.js` -> `data/task.txt` -> Kern (`bn4net.js:1098`): der Kern braucht 10,8 GB und laeuft
     erst ab home 16 GB (Waechter erst ab 32). Auf 8 GB gibt es **keinen** Weg fuer `task.js`.
     Die ersten 1-3 Stunden (Geld fuer 4,2 M home-RAM) brauchen also einen Startpfad <= 8 GB
     **oder Erics Hand**. Guenstig: der Autopilot vom 19.08. (`git show 7ebf2a4:src/autopilot.js`,
     Initialcommit) hat BN1.1 in Lauf 1 auf 8 GB getragen - **wiederverwenden statt K03 neu
     schreiben** (UNSICHER: seine heutige RAM-Groesse ist nicht gemessen, Memory nennt ~6,5 GB).
   - Der Kern in BN1.1 braucht das SF4-Gate K09, sonst Neustartschleifen (Abschnitt 4,
     Belegstelle `reg.js`: kein `singularity`-Gate, nur RAM-Faktor).
6. **K08 ("BN4.1 V1 erstes Einkommen"):** laesst sich nicht vorab bauen, nur messen. 5a gibt es
   selbst zu ("ungeprueft", Abschnitt 6). Nicht vorab investieren; im Lauf messen.
7. **Realer Wert der Automatisierung** liegt ab BN4.1 (Kern + Waechter + bn4rep + exit laufen
   ohne Eingriff) - und dort ist der Bau schon in K01/K02/K09 enthalten.

Empfehlung: BN1.1 halbautomatisch (Startskript aus Git <= 8 GB, ab 16/32 GB Kern + `task.js`,
Besuche durch /bb), K05/K06/K07/K08 nicht bauen. Das spart rund 6-9 Arbeitstage.

## 2. Regelkonflikte

### 2a. K04: loest `globalThis["docu"+"ment"]` den Exploit "Bypass" aus?

**Urteil: Die Flagge wird NICHT ausgeloest (HAELT als technische Aussage). Der Kniff ist aber
sachlich dasselbe, was das Spiel "Bypass" nennt - UNSICHER, ob er unter die Vorgabe faellt.**

Belege (Spielcode):

- Einzige Stelle, die `Exploit.Bypass` vergibt: `NetscriptFunctions/Extra.ts:21-37`, Funktion
  `ns.bypass(doc)`. Sie setzt ein Wegwerf-Feld auf dem uebergebenen und auf dem echten
  `document` und vergibt die Flagge nur, wenn `ctx.workerScript.scriptRef.ramUsage ===
  RamCostConstants.Base` (1,6 GB). `bypass` kostet 0 GB (`RamCostGenerator.ts:661`).
- `RamCalculations.ts:185-192`: 25 GB (`RamCostConstants.Dom`) werden nur gebucht, wenn der
  woertliche Bezeichner `document` oder `window` in der Referenzkarte steht. Ein Zugriff ueber
  `globalThis["docu"+"ment"]` taucht dort nicht auf. Die Flagge entsteht dadurch **nicht**: kein
  `ns.bypass`-Aufruf. Die K04-Werkzeuge (homeram, buyaugs, ... mit `ns.*`-Aufrufen) koennten
  die 1,6-GB-Bedingung nie erfuellen, selbst wenn sie `ns.bypass` riefen.
- `Exploit.ts:33`: die Beschreibung der Flagge lautet woertlich "by circumventing the ram cost
  of document". Das Umgehen der 25 GB ist also genau die Handlung, die das Spiel als
  "Exploit" einordnet - es merkt sie nur nur dann, wenn man `ns.bypass` aufruft.

Auf der Seite des Besitzers (`doku/schlupfloecher.md:1326-1329`): der fruehere Pruefer folgerte,
das Spiel "belohne" den DOM-Weg, also sei er "nicht als Betrug gewertet". Das ist ein
Fehlschluss: `ns.bypass` vergibt eine Source-File **-1** ("by finding ways to break the game",
`Exploit.ts:1-11`), also gerade eine Auszeichnung fuer einen Regelbruch.

**Fakt, den 5a nicht nennt:** der Kniff steckt **schon im laufenden Bot**: `guard.js:452`
(Waechter), `darkweb.js:53`, `popups.js:48`, `wakelock.js:71`, `bn4net.js:3889` (Kommentar),
`audiocheck.js`. K04 erweitert also keine neue Praxis, sondern dehnt sie auf acht weitere
Werkzeuge aus. Wuerde der Besitzer den Kniff ausschliessen, ginge Waechter von 6,1 auf ~31 GB -
das waere kein K04-Problem, sondern ein Umbau des Kerns.

**Regelkonformer Weg zum selben Ziel (geprueft):**

- *Parameter von einem anderen Skript*: **geht nicht und kostet auch nichts "gratis"**. Skripte
  teilen keine Objekte; `join.js` (Kopf, Zeile 80ff.) bekommt `doc` als Funktionsparameter vom
  Aufrufer (`hand.js:1146` `doc: document`) - dort steht der woertliche Bezeichner, und der
  Aufrufer zahlt die 25 GB. Das ist ehrlich verbucht, kein Umweg. Auch `ramOverride` (Option von
  `ns.exec`/`run`) ist nach `schlupfloecher.md:1264` derselbe Weg (der Spieltext nennt ihn dort
  selbst den "einfachsten" fuer `ns.bypass`): gleiche Einstufung wie der String-Kniff.
- *Ehrlich bezahlt*: die Oberflaechenwerkzeuge mit woertlichem `document` (homeram 30,4 GB,
  buyaugs 28,9, install 28,3, backdoor 29,5, work 27,7, bitverse 27,3, joinfac 30,8) laufen auf
  gemieteten 32-GB-Servern (55.000 $/GB, 32 GB = 1,76 M, `5a` Abschnitt 2), in BN4 ab dem ersten
  Mietrechner. `task.js` startet sie dort; der Kern waehlt die Werkbank.
- *In BN1.1 vor dem ersten 32-GB-Server*: Eric kauft home-RAM selbst (Alpha Enterprises, 2 Klicks:
  1,01 M + 3,19 M) und die Programme per `darkweb.js` (existiert, 2,65 GB, nutzt den Kniff) oder
  per Hand im Darkweb. Kein neuer Code.

**Folgerung fuer die Bauliste:** K04 hat keinen zwingenden Anteil. Eric muss **eine** Ja/Nein-
Frage beantworten ("Der Bot darf `globalThis["document"]` benutzen, um die 25-GB-Rechnung des
Spiels zu umgehen - heute im Waechter, im Kern und in vier Werkzeugen. Ja/Nein, auch fuer weitere
Werkzeuge?"). Bis dahin K04 nicht bauen. Fuer die Antwort "Nein" ist der Kern selbst betroffen
und muss gesondert bewertet werden (Waechter-Redesign).

### 2b. Weitere Exploit-Ausloeser, gegen die Vorgabe geprueft (Spielcode)

| Exploit | Ausloeser | Beruehrt die Bauliste? |
|---|---|---|
| Bypass | nur `ns.bypass(doc)` bei RAM exakt 1,6 (`Extra.ts:32`) | nein, solange `exploit.js` nie laeuft (2e) |
| UndocumentedFunctionCall | `ns.exploit()` (`Extra.ts:20`) | `exploit.js:35` |
| INeedARainbow | `ns.rainbow(...)` (`Extra.ts:53-58`) | `exploit.js:36` |
| TimeCompression | `Exploits/loops.ts:15-30`: ein 15-s-Timer feuert < 500 ms nach dem Vorgaenger | **Gefahr durch `hacktimer.js`** (2e) |
| PrototypeTampering | `loops.ts:4-13`: `(55).toExponential() !== "5.5e+1"` alle 15 min | `exploit2.js` (verbiegt es absichtlich) |
| Unclickable | echter Klick auf `display:none` (`Unclickable.tsx:11`) | `exploit3.js` (Kopf nutzt `D`/`W`) |
| YoureNotMeantToAccessThis | Dev-Menue oeffnet sich (`DevMenu.tsx:44`) | **K11**: Dev-Build-Menue (2d) |
| N00dles, TrueRecursion, RealityAlteration | Nudeln mit SF, Arcade-Wirt, Debugger | nicht beruehrt |
| EditSaveFile | Spielstand editieren | **K02/B02 nicht schreiben an der Spielstand-Datei** (3b) |
| `join.js` (`__reactProps`-Aufruf mit `isTrusted:true`) | kein Eintrag in `Exploit.ts` | keine Flagge; umgeht aber die Handbedienungs-Sperre `acceptInvitation` (`FactionsRoot.tsx:88-94`) - Grenzfall fuer den Besitzer, im Bestand seit August |

### 2c. Weitere Regeln der Besitzer-Vorgaben

- **Kein zweiter Tab**: K06 (`relaunch.js` im Seitenkontext) und K11 (Dev-Build) sind
  ungefaehrlich, wenn K11 ein **eigener** Browser-Prozess/-Profil ist (`pruefstand/browser`,
  TEST-Rolle 12526). Die Regel gilt dann nicht fuer den Live-Tab; ausdruecklich in K11
  festhalten: nie `localhost:12525`, nie der Live-Tab.
- **Infiltration**: nirgends in K/B enthalten. HAELT.
- **Bot entscheidet Strategie selbst**: K05b (Mensch fuehrt BN1.1) verstoesst nicht - die
  Strategie entscheidet die Sitzung, Eric klickt nur. Aber: jede Frage "Ja/Nein" an Eric
  (2a) ist eine Grenzfrage, keine Strategiefrage, also zulaessig.

### 2d. K11: Dev-Menue und YoureNotMeantToAccessThis

K11 nutzt das Dev-Menue des Dev-Builds (Geld, home-RAM, SF-Stufen, Zeitsprung). Das Oeffnen
des Menues vergibt `YoureNotMeantToAccessThis` (`DevMenu.tsx:43-45`) - **im Pruefstand-Spielstand,
nicht im Live-Stand**. Das haelt nur, wenn Pruefstand-Staende nie nach LIVE gelangen: der
Lauf-2-Spielstand ist im echten Spiel frisch anzulegen, **nicht** aus dem Pruefstand zu klonen
oder zu importieren. In K11 als harte Zeile festhalten. Ausserdem: "Zeitsprung" des Dev-Menues
darf nicht mit der Timerkette von `loops.ts` (TimeCompression) in demselben Spielstand
zusammenfallen - im Wegwerf-Stand egal.

### 2e. `exploit*.js` und `hacktimer.js` in `src/` (neu, in keiner Liste)

- `src/exploit.js`, `exploit2.js`, `exploit3.js`: ausdrueckliche "Source-File -1 einsammeln"-
  Skripte (`exploit.js:1-30`: ruft `ns.exploit()`, `ns.rainbow("noodles")`, `ns.bypass(...)`).
  `collectScripts` (`sync/bridge.js:1041`) schiebt alles in `src/` ins Spiel. Der Kern startet sie
  nicht (nicht in `registry.json`, nicht in `bn4net.js`/`boot.js`/`guard.js`; nur Tests/
  `archivliste.js` kennen den Namen), aber sie liegen im frischen Lauf-2-home und widersprechen
  dem Besitzerwort "Exploits nicht".
- `hacktimer.js` ersetzt `window.setTimeout` durch Worker-Timer und **feuert beim Zurueckschalten
  alle offenen Rueckrufe sofort** (Kopf, Sicherung 3). Der Rueckruf der Spielkette
  `minute()` (`loops.ts:20-27`) wuerde dann < 500 ms nach dem Vorgaenger laufen = Ausloeser fuer
  `TimeCompression`. Laeuft nur mit `--scharf` von Hand, ist also nicht aktiv - aber ein
  Werkzeug im Bestand, das die Flagge zufaellig vergeben kann.
- Fix: `exploit*.js`, `hacktimer.js`, `timerzwang.js`, `sonde.js` aus `src/` nach `archiv/` (S,
  eine Stunde, vorher `tools/test-verbote.js`/`archivliste.js` auf Namensverweise pruefen).

## 3. Fehlermodi

### 3a. K02/B02 - wie kann die Epochen-Aenderung den Schutz aushebeln?

Der Schutz (`sync/bridge.js:1747-1830`, `sync/backup.js:240-262`, `sync/instanz.js:47`):
Pruefung (1) Port, (2) Rueckwaertssprung > 60 s gegen Anker (Heartbeat, ersatzweise
`INDEX.tsv`), (3) fester `LIVE_IDENTIFIER`. Dazu `rotiere()` (`backup.js:356-394`): loescht
Dateien je Anlass-Deckel und Budget, Praefix `LIVE_`.

Szenarien, in denen K02 falsch gebaut Schaden macht (alle Belege aus dem Code):

1. **Auto-Erkennung als Ausloeser** ("neuer identifier + totalPlaytime ~ 0 = neues Spiel -> Epoche
   wechseln"). Dann ist genau der Fall, vor dem der Schutz steht, *der Auftrag*: geht das
   Browser-Profil verloren (Cache geleert, IndexedDB weg, anderes Profil), startet das Spiel
   frisch mit zufaelligem identifier (`PlayerObject.ts:160`: `cyrb53("I-"+Zeit+userAgent+
   Fenstergroesse+Zufall)`). Die Bruecke wuerde pushen und rotieren, und der Lauf-1-Stand
   (rund 2.000 h) waere nur noch ueber die Kette zu retten - die zu dem Zeitpunkt rotiert wird.
   **Regel: der Wechsel darf nie aus beobachtetem Spielzustand folgen.**
2. **Gemeinsames Praefix/Verzeichnis.** Neue Sicherungen heissen weiter `LIVE_*` im selben Ort;
   `rotiere()` kappt je Anlass und je Budget (`BACKUP_BUDGET_BYTES`), sortiert nach Alter - die
   aeltesten, also **Lauf-1-Dateien, fliegen zuerst raus**. Die letzten Lauf-1-Sicherungen
   (`pre-jump`, `pre-install` sind nur gegen das Budget, nicht gegen die Deckel geschuetzt;
   `hourly`/`connect`/`race` haben Deckel) waeren nach wenigen Tagen Lauf 2 weg.
   **Regel: die Lauf-1-Kette wird vor dem ersten Lauf-2-Schreibvorgang aus dem rotierenden
   Pfad herausgenommen** (eigener Ordner, eigener Praefix, von `rotiere` nicht gelesen, in
   Primaer UND Spiegel - `BACKUP_PRIMAER`/`BACKUP_SPIEGEL`).
3. **Anker an drei Stellen.** Der Anker kommt aus (a) Speicher der Bruecke, (b) Heartbeat-Datei,
   (c) letzte Zeile `INDEX.tsv` (`bridge.js:1771-1788`). Wird nur (a) zurueckgesetzt, liest ein
   **Brueckenneustart** (zehn Tode seit 12.09.!) den Lauf-1-Wert wieder aus (b)/(c) und weist das
   Lauf-2-Spiel mit "Rueckwaertssprung 2.000 h" ab - nach Tagen, nicht sofort. Das ist der
   typische "bricht nach zwei Wochen" - Fehler. **Regel: Epoche steht im Index selbst (eine
   Epochenzeile oder Epochennummer im Dateinamen), die Ankersuche liest nur die aktuelle
   Epoche; Test mit Brueckenneustart nach dem Wechsel.**
4. **Identifier per "naechster Verbindung gewinnt".** Ein noch offener Lauf-1-Tab (anderer
   identifier) oder ein dritter Fremdstand koennte sich vor dem neuen Spiel verbinden und als
   Lauf 2 festgeschrieben werden. **Regel: die Festlegung ist ein Mensch-Befehl mit Argument**
   (`--pin <identifier>`), der identifier wird dem Eintrag "Fremde Spielverbindung abgewiesen"
   (steht schon in `## Sofort`) entnommen und vom Menschen gegen die angezeigten Kennwerte
   (BN1, Lauf 1, totalPlaytime wenige Minuten, keine SF) geprueft.
5. **Einmalig und gerichtet.** Der Wechsel braucht eine Markerdatei, die er beim Verbrauch
   loescht, und **verlangt, dass die Lauf-1-Kette archiviert und lesbar bestaetigt ist** (Kontrolle:
   letzte Lauf-1-Sicherung dekomprimiert und `lesenKennwerte` gruen, BN = letzter bekannter).
   Ohne Marker bleibt jedes Fremdspiel abgewiesen - auch ein frisches.
6. **Port und Autoexec im frischen Spiel.** Das frische Spiel hat kein `remoteFileApiPort`
   (Pruefung 1 faellt durch) und kein Autoexec; beides von Hand setzen und in der Anleitung
   benennen (5b nennt Autoexec nur nebenbei).
7. **`pushAll` ins frische Spiel schiebt `src/` komplett** (`collectScripts`): auch die
   Altlasten aus 2e. Und die lokalen `data/*` aus Lauf 1 (Spiegel aus dem Spiel) duerfen nicht
   wieder hineinfliessen (B04 verschiebt `data/` nach `lauf1/`, richtig - aber das gehoert in
   **denselben** Schritt wie der Epochenwechsel, nicht in einen Skill-Text).

Vorschlag fuer die Bauform (kleiner als "Epochenmechanismus"): **kein allgemeines Feature, ein
einmaliges, aus der Hand ausgeloestes Skript** `sync/lauf2-uebergabe.js`: (1) letzte Lauf-1-
Sicherung erzwingen und pruefen, (2) `backups/` und `data/` nach `*-lauf1/` verschieben,
(3) neuen, leeren Satz anlegen, (4) `--pin <identifier>` schreiben, (5) Marker. Tests: vorhandene
`tools/test-bruecke.js` (MOCK-Rolle) um "Lauf-1-Stand wird nach der Uebergabe weiter abgewiesen",
"frisches Spiel ohne Marker wird abgewiesen" und "Brueckenneustart nach Uebergabe nimmt Lauf 2 an"
erweitern. Aufwand M (1-1,5 Tage), gleich K02 - aber mit den sieben Randbedingungen.

**Haelt K02 so wie in 5a beschrieben ("zuruecksetzbar, explizit, nie still")?** UNSICHER: Wort
"zuruecksetzbar" bleibt unscharf; die Sicherungskette darf **nichts zuruecksetzen, sondern nur
neu beginnen**.

### 3b. B06-B08 - verdecken befristete Sperren und ablaufende Alarme echte Sperren?

- **B06 ("blocked befristen"):** `guard.js:1004` und `leiter.js:168` nehmen `blocked` aus der
  Frischepruefung aus, weil ein Werkzeug, das ehrlich `blocked` meldet, "kann nicht, nicht: tut
  nicht" ist. Befristet man das, zaehlt eine **legitim lange Sperre** (V1 wartet 20 h auf 100 Mrd
  fuer Daedalus; Einbau wartet auf Reputation; `install-sperre.txt` mit `bis`) als Stillstand und
  speist die **Strafleiter** (Neustart des Werkzeugs, ggf. Kill von Arbeitern, Fokusverlust -> 20 %
  Reputationsverlust, `5a` K05-Risiko). Ein Fehlalarm der Leiter ist teurer als eine stille
  Sperre. Richtig: **nur Anzeige**, nie Steuerung - in `checkin.js` den Grund (`locked`,
  `BLOCKGRUENDE`) und das Alter der Sperre ausgeben; der Waechter bleibt unveraendert. Das ist
  dann B07-light, B06 als Waechteraenderung entfaellt.
- **B07** ("Einbau faellig, aber nichts passiert"): sinnvoll, nur im `checkin.js` (lesen, nicht
  steuern); Bedingung "Geld+Ruf reichen" muss die **Uhr** benennen (Spielzeit/Wanduhr), sonst
  Muster 4.
- **B08 (Alarme mit Ablauf):** drei Gefahren. (a) **Zeitablauf** auf Schutzalarme
  ("Autosave steht", "Fremde Spielverbindung abgewiesen", "Kein pushAll", "Bruecke ohne
  Sicherung", Zweit-Tab-Sperre) verdeckt eine echte Stoerung, wenn niemand hinsieht - ein
  Alarm darf nur durch eine positive Messung enden (frischer `lastSave`, gruene Sicherung), nie
  durch Zeit. (b) **Klassifizieren** ("Tab zu/verdeckt vs. Schreibfehler") ist ein Raten ueber
  eine Ursache, die das Werkzeug nicht sieht (5b selbst: Ursache am 12.11. "nicht geklaert");
  Fehleinstufung "verdeckt" versteckt einen echten IndexedDB-Fehler - ein Ausschluss gilt nur,
  wenn das Werkzeug den Fall anzeigen koennte (Besitzer-Regel). (c) **Die Bruecke editiert
  `BAUSTELLEN.md`** (1.300 Zeilen, von Menschen und Sitzungen gleichzeitig bearbeitet, in Git)
  automatisch: Lese-Schreib-Wettlauf, verlorene Handaenderungen, schmutziger Baum. Richtig:
  eine maschinenbesitzte Datei (`data/alarme.json`) mit Zeitstempel/Ursache; `BAUSTELLEN.md`
  enthaelt nur den Zeiger. Die 811 Zeilen "auf Null bringen" ist Handarbeit/ein Einmallauf,
  kein Feature.

## 4. Substanz: RAM-Zahlen und Route

| Behauptung | Urteil | Beleg |
|---|---|---|
| home 8 GB in BN1.1 | HAELT | `PlayerObjectGeneralMethods.ts:70` `maxRam: 8` (neues Spiel); `Prestige.ts:245-252` setzt bei Knotenwechsel 128/32/8 nach SF9>=2 / SF1>0 / sonst |
| 32 GB mit SF1 | HAELT | `Prestige.ts:248-249`; auch BN1.2 (SF1.1) und alle spaeteren Knoten bis SF9.2 |
| Der Wert gilt nur beim Knotenwechsel | HAELT, praezisieren | Einbau (`prestigeAugmentation`) setzt home-RAM nicht zurueck; 5a P2 ist einmalig, kein Einbau-Zyklus |
| Singularity wirft ohne SF4 ausserhalb BN4 | HAELT | `NetscriptHelpers.tsx:388-396` `canAccessBitNodeFeature(4)` |
| SF4-Faktor 16 bei SF4<=1 (auch 0), 4 bei SF4.2, 1 bei SF4.3, in BN4 immer 1 | HAELT | `RamCostGenerator.ts:82-96` |
| Kern 10,8 / Waechter 6,1 / boot 5,5 | HAELT (Registry, Messung 09.10.) | `registry.json` `bn4net.js` ramBaseGb 10,8 (live41 = lokal41 = 10,8), `guard.js` 6,1, `boot.js` 5,5 |
| "Kern 17,75" in REIHENFOLGE.md (Teil 3), `doku/ram-budget.md` | VERALTET | Stand 04.09.; heutige Messung 10,8 (`ram-messung-2026-09-04.json`, bn4net `gemessenAm 2026-10-09`, Quelle `startdiag.js` im Spiel). REIHENFOLGE Abschnitt 4 ("bn4net 17,75 + boot 5,5") ist veraltet, 5a hat recht |
| Spitze 22,4 GB mit boot | HAELT | 10,8 + 6,1 + 5,5 |
| 31,8 von 32 mit cdump | HAELT | 10,8 + 6,1 + 2,25 + 12,65 = 31,80 |
| exit.js 520,25 (SF4=0) / 40,25 (BN4, SF4.3) | HAELT | linear: b = 8,25, Singularity-Anteil 32 -> 8,25 + 16*32 = 520,25 |
| bn4rep 1006,1 / 73,1 | HAELT | 10,9 + 16*62,2 = 1006,1; 10,9 + 62,2 = 73,1 |
| ausgang.js 8,15 > 8 GB | HAELT | registry 8,15 |
| Mietrechner 32 GB = 1,76 M | UNSICHER | 55.000 $/GB x 32 = 1,76 M rechnet 5a selbst; Faktor (BN4 `CloudServerCost`, Softcap 1,2) nicht nachgerechnet |
| Kern braucht min. 16 GB | UNSICHER | 10,8 + 5,2 Luft; der Kern startet aber Arbeiter (1,8 GB): bei 16 GB 2 Arbeiter; boot.js mit 5,5 (resident) + Kern 10,8 = 16,3 > 16 - boot muss sich beenden/`ns.spawn` nutzen |

**`route.json` beginnt bei BN10 L2 - HAELT** (`src/route.json`, erster Eintrag `node 10, level 2`).
Folge, exakt nachgerechnet gegen `src/lib/route.js:44-77` (`planeRoute`):

- BN1.1, SF = {}: `lauf` = erster Eintrag mit `node 1` und `0 < level` = **BN1 L2 (V1)**; `ziel`
  = erster Eintrag mit `nachDiesemLauf(n) < level` = **BN10 L2 (V2)** (nicht BN4!). Ein
  `zielErlaubt(..., 4)` lehnt BN4 ab (`route.js:140-149`: "NICHT der naechste Routeneintrag").
  In BN1.1 laeuft `ausgang.js` ohnehin nicht (8,15 GB, Singularity), die Folge trifft also nur
  den manuellen Weg: dass Eric den BitVerse-Sprung per Oberflaeche macht, ist vom Routencode
  unabhaengig.
- **BN4.1 (SF={1:1})**: `lauf` = **BN4 L2 (V2)** (es gibt keinen BN4-L1-Eintrag) - der Bot
  waehlt Bladeburner (V2), die API fehlt ohne SF6/SF7, `blade.js` startet und wirft (5a A15).
  `ziel` = BN10 L2 -> `ausgang.js` bereitet den falschen Sprung vor.
- Daraus: Praefix noetig: `4 L1 V1`, `4 L2 V1`, `4 L3 V1`, ggf. `1 L1 V1` (BN1.1). Eintraege fuer
  `1 L2`/`1 L3` existieren schon (V1). Danach die Route-1-Reihenfolge - die die Entscheidung
  **nach BN4.3** (REIHENFOLGE R1 endet dort) **noch nicht** enthaelt: der Rest ist spaetestens
  ~150 h nach Start (3 x BN4) noetig, nicht davor.
- Die Regel "Route unveraenderlich" (`route.js:26-32`) ist durch die Lauf-2-Aenderung ausdruecklich
  aufzuheben (im Dateikopf, `stand`, Commit-Text) - sonst bleibt der Widerspruch fuer den naechsten
  Leser. `tools/test-route.js` (40/39 fest) ableiten, wie K01 sagt.

**5a-Zahlen, die falsch sind:**

- Gesamtaufwand "8-12 Tage" aus den Teilspannen (siehe 0.). Die kleinen Posten alleine
  (K01, K02, K07, K09, K10, K12 "2-3 Tage") haengen an K02 (M, 0,5-1,5 d) und K10 (S-M): realistisch
  3-4 Tage.
- K03-Aufwand M ist zu hoch, wenn der Autopilot aus dem Initialcommit wiederverwendet wird (S).
- K10: "Sim `sim.mjs` als Vorlage" ist ein Skript im Scratchpad der Pruefer, nicht im Repo.

## 5. Gemeinsame Rangliste K01-K12 + B01-B17 (+ neue Posten X1-X3)

Aufwand: S = bis ~3 h, M = 0,5-1,5 d, L = >= 2 d. "Zwingend" = ohne das startet Lauf 2 nicht
oder es entsteht Schaden. Doppelte Posten sind zusammengefasst.

### Zwingend vor Lauf 2

| Rang | Posten | Inhalt | Aufwand |
|---|---|---|---|
| 1 | **Z1 = K02 + B02 + Teil von B04** | Einmalige, handausgeloeste Lauf-2-Uebergabe der Bruecke (Abschnitt 3a): Lauf-1-Kette archivieren und pruefen, `data/` nach `lauf1/`, neuer Satz, `--pin <identifier>`, Marker, kein automatischer Wechsel, Anker nur aus aktueller Epoche; Tests inkl. Brueckenneustart | M (1-1,5 d) |
| 2 | **X1** (neu) | `exploit.js`, `exploit2.js`, `exploit3.js`, `hacktimer.js`, `timerzwang.js`, `sonde.js` aus `src/` nach `archiv/`; vorher `test-verbote`/`archivliste` pruefen | S (1 h) |
| 3 | **X2** (neu) | Eine Ja/Nein-Frage an Eric zum `globalThis["document"]`-Kniff (2a) - ohne Antwort K04 nicht bauen; Eric entscheidet auch `join.js`-isTrusted | 0 h Bau |
| 4 | **K01-min** | Route-Praefix (`4 L1..L3 V1`, ggf. `1 L1 V1`), `route.js`-Kopf und `test-route.js` auf die neue Datei ableiten; Rest der Route erst vor Ende BN4.3 | S |
| 5 | **K09** | SF4-Gate in `lib/reg.js` (Eintraege mit `singularity:true` gelten ohne SF4 ausserhalb BN4 nicht) + gleiche Pruefung in `guard.js`/`strategie-check`; Test `ownedSF {4:0}, node 1` | S |
| 6 | **Z6 = K03-reuse + Hand-Protokoll** | Startskript <= 8 GB aus `git show 7ebf2a4:src/autopilot.js` (RAM messen!) oder Hand-Anleitung (1 Seite: Port/Autoexec/home 16 und 32/Darkweb/Reihenfolge, boot.js **nicht** als Autoexec vor 32 GB, `Kern` ab 16/32 GB per Hand starten) | S (0,5 d) |
| 7 | **B10-min** | `skills/README.md` richtigstellen (aktiver Ort `~/.claude/skills/bb`), `skills/bb.md` nicht mehr als Kopiervorlage - sonst ueberschreibt der Satz "hier aendern, dann kopieren" den Arbeitsauftrag-Skill | S (20 min) |

### Sinnvoll (vor oder waehrend der ersten Knoten)

| Rang | Posten | Anmerkung | Aufwand |
|---|---|---|---|
| 8 | K10-min + B03 (doppelt) | Budgettest mit `HOME_GB` 16/32 und SF-Stand aus Lage; kein eigener 8-GB-Zweig, wenn Z6 per Hand | S-M |
| 9 | K11 klein (Ebene 3, 0,5 d) | Nur: frischer Dev-Build-Spielstand, Z1-Uebergabe gegen TEST-Rolle, Startskript auf 8 GB, Kern ab 16/32. Keine Dev-Build-Staende nach LIVE | 0,5 d |
| 10 | B07 (nur `checkin.js`, nur Anzeige) + BN4-V1-Zeile | "Einbau faellig/steht" + `BLOCKIERT`-Grund; keine Waechteraenderung | M |
| 11 | B01, B09 | Verwaisungs-Gate, `MESSLUECKEN`/`ENTSCHIEDEN` bereinigen - verhindert, dass Lauf-2-Tests unbemerkt nicht laufen | S + S |
| 12 | B05 | WMI startet `bridge-start.cmd` (Neustartschleife) - die Bruecke stirbt weiter, Sicherungsluecke ist Betriebsrisiko; vorher klaeren, dass RC 2/3 sie wirklich beenden | S |
| 13 | B08 (umgebaut) | `data/alarme.json` maschinenbesitzt, Schutzalarme nur per positiver Messung beenden, `## Sofort` einmal von Hand bereinigen | M |
| 14 | K12 (nur A11 `exit.js`-Kopf, A12 Zahlen) | Irrefuehrende Kommentare mit konkreten RAM-Zahlen (`bn4net.js:54-61`: "22,8/42,45") | S |
| 15 | B04-Rest | Skill-Text "Neuer Lauf" (Kurzfassung der Uebergabe aus Z1) | S |
| 16 | K04 | **nur falls Eric X2 mit Ja beantwortet**, sonst Werkzeuge auf gemieteten 32-GB-Servern unveraendert | M |

### Streichen / zurueckstellen (nicht vor Lauf 2)

| Posten | Grund |
|---|---|
| **K05** | Einmalposten, L, hoch riskant, nur Ebene 3 testbar; K05b ist guenstiger (Abschnitt 1) |
| **K06** | Fuer 4-6 Einbauten in BN1.1; ab BN4.1 uebernimmt `installAugmentations(cb)`; in BN1.1 einmal `run boot.js` per Hand pro Einbau |
| **K07** | Ersetzt durch die Regel "boot.js erst ab 32 GB als Autoexec"; `ausgang.js` 8,15 > 8 GB ist in BN1.1 egal (Ausgang nur per UI) |
| **K08 (vorab bauen)** | Nicht vorab messbar; im Lauf messen (CHRONIK: Lauf-1-BN4.1 48,6 h mit altem Bot). Nur falls die ersten 12 h in BN4.1 ohne Einkommen bleiben -> dann bauen |
| **K11 gross** (1-3 d) | Beobachtung von K05/K06/K08 entfaellt mit ihnen |
| **B06** (als Waechter-/Leiter-Aenderung) | Fehlalarm der Strafleiter bei legitimen Sperren; ersetzt durch Anzeige in B07 |
| **B11** (voller Umfang) | Verschieben von ~25 Altbetriebsdateien ist Ordnung, kein Lauf-2-Voraussetzung; Ausnahme X1. `autostart-einrichten.cmd` (gegen Erics Entscheidung vom 23.09./03.11.) trotzdem in 10 min nach `archiv/` |
| B12, B13, B15 | Klassenabsicherung, nuetzlich nach den ersten Laeufen |
| B14, B16, B17 | Ordnungsarbeiten, jederzeit; `git branch -D`/History nie ohne Eric (B16) |

### Aufwand

- Zwingend (Z1, X1, X2, K01-min, K09, Z6, B10-min): **ca. 2,5-3 Arbeitstage**.
- Sinnvoll (Rang 8-16 ohne K04): **ca. 2-3 Arbeitstage**.
- Original (5a 9-17 d + 5b ca. 5 d = 14-22 d) -> gekuerzt **4,5-6 d** plus ein Bau
  von K08, falls BN4.1 es erzwingt.

## 6. Was ich nicht geprueft habe / Grenzen

- Nichts im Spiel oder im Dev-Build ausgefuehrt; die RAM-Groesse des Initial-Autopiloten und
  die tatsaechlichen 8-GB-Moeglichkeiten sind daher nicht gemessen (Rechenwerkzeug
  `tools/ram.js` nicht benutzt, Auftrag verbot es). Die Eichwerte stammen aus
  `doku/ram-messung-2026-09-04.json`.
- Die Mietserverpreise (55.000 $/GB, Softcap 1,2) wurden nicht gegen `CloudServer*` nachgerechnet.
- Ob `acceptInvitation`/`isTrusted` (`join.js`) unter "keine Exploits" faellt, ist eine
  Auslegungsfrage des Besitzers; im Spielcode steht dafuer keine Flagge.
- `hacktimer.js`: ob das Nachfeuern wirklich < 500 ms an den `minute()`-Rueckruf trifft, ist aus
  Kopf und `loops.ts` gelesen, nicht gemessen; es ist ein Risiko, kein Beleg fuer ein Ereignis.
