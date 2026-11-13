# Teil 5a - Kaltstart Lauf 2 (BN1.1 -> BN4.1 -> BN4.2 -> BN4.3 -> BN1.2)

Stand 13.11.2026 07:27. Geprueft: kann der heutige Bot aus einem frischen Spielstand
(BN1.1, keine Source-Files, home 8 GB, kein Geld) die ersten Knoten nach Regel R1 tragen?
Gelesen: `src/` (nur lesen), `reference/v301/src`, `tools/`, `doku/`, die Audit-Dateien
aus dem Auftrag. Gerechnet mit `tools/ram.js` (Nachbau von `RamCalculations.ts`, gegen
114 Live-Werte geeicht) und einer eigenen Nachbildung der Registry-Auswahl
(`...\scratchpad\audit5a\sim.mjs`, liest nur `src/`, schreibt nichts). Nichts ausgefuehrt,
was die Bruecke oder das Spiel beruehrt. `node tools/test-kaltstart-budget.js` lief
(rein lokal): 24 gruen - aber siehe Abschnitt 4, was das nicht beweist.

## 0. Kurzurteil

**Der heutige Bot kann Lauf 2 nicht tragen - er startet in BN1.1 gar nicht.** Drei Dinge
tragen den Anlauf nicht: (a) es gibt kein Programm, das auf 8 GB laeuft und Geld verdient
(Kern 10,8 GB + Waechter 6,1 GB + boot.js 5,5 GB), (b) es gibt keinen Lebensautomaten ohne
Singularity (alles, was Faktionen/Augmentierungen/home-Ausbau/Ausgang macht, ist
Singularity oder ein 27-30-GB-Oberflaechenwerkzeug fuer Handbetrieb), (c) die Bruecke
verweigert einem frischen Spielstand jede Schreibung (Anker und Identifier aus Lauf 1).
Ab BN4.1 (home 32 GB, Singularity in BN4 zum Grundpreis) ist die Lage deutlich besser:
Kern, Waechter, Wachhalter und Vertragsloeser passen, die Gewerke sind registriert -
aber **kein einziger Bot-Lauf hat BN4 im V1-Verfahren (Hacking 9000, Geld 100 Mrd fuer
Daedalus) oder irgendeinen Knoten ohne SF5/SF6/SF10 gesehen**.

## 1. Phasen-Tabelle

home-Groessen: BN1.1 = 8 GB (`Prestige.ts:241-252`: SF9>=2 -> 128, SF1>0 -> 32, sonst 8;
frischer Spielstand hat SF1 = 0). Mit SF1.1 aus BN1.1 hat BN4.1 32 GB und jeder spaetere
Knoten bis SF9.2 ebenfalls. SF4-Faktor: in BN4 selbst 1, sonst bei SF4<=1 16 (auch bei 0 -
der Rechner bucht statisch), SF4.2 -> 4, SF4.3 -> 1 (`RamCostGenerator.ts:82-96`).
Singularity-Aufruf wirft ohne SF4 ausserhalb BN4 (`NetscriptHelpers.tsx:388-396`).

| Phase | Zustand | Was automatisch passieren muss | Wer tut es heute | Luecke |
|---|---|---|---|---|
| **P0 BN1.1 Start** (0 - ~1 h) | home 8, $1k, Hacking 1, nur NUKE | Skript starten (Handstart ist noetig), n00dles & Co. rooten, Arbeiter auf alle gerooteten Rechner, Hacking-XP | niemand: `boot.js` (5,5) startet nur `bn4net.js` (10,8), das nie passt (`boot.js:273-290`); nach 5 min killt boot.js alles ausser Schonliste (`:186-216`) und wartet weiter | **K03/K07**: Startpfad <= 8 GB fehlt. `bn4start.js` ist Singularity (78,5 GB bei SF4=0) und reserviert 16 GB auf home (`bn4start.js:97`) |
| **P1 TOR + Knacker** | Geld wachst; TOR 200k, BruteSSH 500k, FTP 1,5M, SMTP 5M, Worm 30M, SQL 250M | Terminal-Kaeufe per DOM | `darkweb.js` (2,65 GB, DOM-Trick, passt) - aber nur wenn jemand es startet; in der Registry ist es `kaltstart`, der Kern startet es nicht (Kern fehlt) | nur der Start; Werkzeug selbst ok |
| **P2 home 8 -> 16 -> 32** | Kosten 1,01 M / 3,19 M (naechste 10,08 M); BN1-Mult 1 | Oberflaechenkauf (kein Netscript-Weg ohne SF4) | `homeram.js` = 30,4 GB (direktes `document` = 25 GB) - passt auf keinen Rechner dieser Phase (Mietrechner 32 GB = 1,76 M) | **K04**: DOM-Werkzeuge ohne 25-GB-Aufschlag |
| **P3 Faktionen (CyberSec, NiteSec, Black Hand, BitRunners, Daedalus)** | Einladungen erfordern Backdoors/Skill; Daedalus: 30 Augs, **100 Mrd**, Hacking 2500 (`FactionInfo.tsx:138-149`) | backdoor (Terminal), Join (React-Props-Trick), Arbeit (`work.js`), Fokus-Handling | `backdoor.js` 29,5 / `joinfac.js` 30,8 / `work.js` 27,7 GB, alle nur per `tools/task.js` von aussen (Bruecke + Claude) | **K05**: kein Entscheider; `autopilot.js` (34,2 GB, Altbestand) beauftragt nur darkweb/joinfac/work/backdoor/contracts (`autopilot.js:503-651`), nicht Augs, nicht Einbau, nicht Ausgang |
| **P4 Augs kaufen + einbauen** (>= 4 Einbauten in Lauf 1) | 30 Augs, Red Pill (Daedalus-Rep 2,5 M) | buyaugs planen/kaufen, Install, danach alles neu starten | `buyaugs.js` 28,9 / `install.js` 28,3 GB (Hand); Wiederanlauf: `keepalive.js` (54 GB BN4 / 84 SF4.1) startet **`autopilot.js`**, nicht `boot.js` (`keepalive.js:198-206`) | **K05/K06**: Entscheider + Wiederanlauf fuer `boot.js` |
| **P5 Ausgang BN1.1** | w0r1d_d43m0n am Netz (nach Red Pill), Hacking 3000, 5 Ports | Backdoor, BitVerse-Auswahl BN4 per Klick, danach `boot.js` im neuen Knoten | `bitverse.js` 27,3 GB (Hand); `exit.js` geht NICHT (Singularity, 520 GB bei SF4=0 statisch, wirft); `backdoor.js:25` lehnt w0r1d_d43m0n bewusst ab; die UI-Route hat keinen Rueckruf (`destroyW0r1dD43m0n(cb)` ist der einzige, `Singularity.ts:1153-1161`; Autoexec nur beim Seiten-Laden, `NetscriptWorker.ts:225-256`) | **K06**: Seitenagent muss `boot.js` nach der Wahl starten |
| **P6 BN4.1** (home 32, SF1.1, SF4 0 - Singularity ok) | Hack-Geld 2,25 % (0,1125 x 0,2), Crime 20 %, XP 0,4, WD 9000 | V1: Geld (Vertraege, Verbrechen), TOR/Knacker, erster Mietrechner, Faktionen, Augs, Einbauten, Red Pill, Hacking 9000, Ausgang per `exit.js` (40,25 GB, braucht 64-GB-Wirt) | Kern (10,8) + Waechter (6,1) + Wachhalter (2,25) + `cdump.js` (12,65) = 31,8 von 32; `darkweb`, `shop`, `ausgang` warten auf die Rotation von cdump/csolve (Sim: 0,20 GB frei). `bn4life` (23,95) / `bn4rep` (73,1) sind `normal`-Phase und `werkbank` | **K08**: erstes Einkommen und erster 32-GB-Mietrechner ungeprueft; V1-in-BN4 nie gefahren |
| **P7 BN4.2 / BN4.3** | SF4.1 / SF4.2 (in BN4 Faktor 1), home 32, sonst leer | wie P6, jetzt mit SF4>=1; Route: **V1** (kein SF6/7/10 fuer V2) | wie P6 | Route-Eintraege 4.2/4.3 stehen heute als V2 (`route.json`); V2 geht ohne SF6/SF7 nicht |
| **P8 BN1.2** | SF4.3 (Faktor 1), SF1.1, home 32 | wie P6, BN1-Multiplikatoren (Hack-Geld voll) | wie P6 | nur die Route |

**Was in BN1.1 ohne Singularity geht:** nur Netscript-Kern (rooten, Arbeiter, Mietrechner
via `ns.cloud`, Vertraege) und Oberflaeche. Der Kern selbst braucht kein Singularity
(`registry.json`: `singularity:false`, 10,8 GB). Oberflaechen-Wege des Bots: Terminal
(`darkweb.js`, `hand.js`, `backdoor.js`), Tastatur-Navigation (Alt+W/T/F), React-Props-Klick
(`join.js` - `isTrusted`-Umgehung), Escape-Popups (`popups.js`), Faktionsarbeit
(`work.js`), Kaeufe (`buyaugs.js`, `buyone.js`), Einbau (`install.js`), BitVerse
(`bitverse.js`), home-RAM (`homeram.js`). **Alle ausser `darkweb.js` und `popups.js`
kosten 25 GB fuer das nackte Wort `document`** (`ram.js --einzeln`: je 25 GB Posten
`document`) und sind Handwerkzeuge (`tools/task.js` -> `data/task.txt` -> Kern; dort
nur, wenn `bn4life` nicht laeuft, `bn4net.js:1098`).
**Was fehlt:** ein Entscheider fuer diese Werkzeuge ohne Singularity, ein Wiederanlauf
fuer `boot.js` im Seitenkontext, ein Startpfad <= 8 GB.

## 2. RAM-Rechnung

Alle Zahlen `tools/ram.js` (BN4: `--bn=4`, BN1.1: `--sf4=1` ist dasselbe wie SF4=0 -
statischer Faktor 16; BN1.2: SF4.3).

| Skript | BN1.1 (SF4=0) | BN4.x | BN1.2 (SF4.3) | resident? |
|---|---:|---:|---:|---|
| boot.js | 5,5 | 5,5 | 5,5 | nur Start, beendet sich |
| bn4net.js (Kern) | 10,8 | 10,8 | 10,8 | ja |
| guard.js | 6,1 | 6,1 | 6,1 | ja |
| wakelock.js | 2,25 | 2,25 | 2,25 | ja |
| cdump.js / csolve.js | 12,65 / 12,85 | dto. | dto. | Rotation, je einer |
| darkweb.js | 2,65 | 2,65 | 2,65 | auf Abruf |
| shop.js | 7,0 | 7,0 | 7,0 | auf Abruf |
| ausgang.js | **8,15** (> 8 GB home) | 8,15 | 8,15 | ja |
| popups.js | 3,95 | 3,95 | 3,95 | ja (nur `normal`) |
| exit.js | 520,25 | 40,25 | 40,25 | Sprung |
| bn4life.js | 293,95 | 23,95 | 23,95 | Werkbank |
| bn4rep.js | 1006,1 | 73,1 | 73,1 | Werkbank |
| homegrow.js | 148,5 | 13,5 | 13,5 | Werkbank |
| figwatch.js / export.js | 12,85 / 19,35 | 5,35 / 4,35 | dto. | Werkbank / any |
| bn4door.js | 100,5 | 10,5 | 10,5 | Werkbank |
| homeram / buyaugs / install / backdoor / work / bitverse | 30,4 / 28,9 / 28,3 / 29,5 / 27,7 / 27,3 | dto. | dto. | Hand |
| autopilot.js (Altbestand) | 34,2 | 34,2 | 34,2 | Altbestand, passt nicht auf 8/16/32 |

Passt der Kern? (Registry-Auswahl nachgebildet wie in `test-kaltstart-budget.js`,
Reservierungsregel inklusive; `sim.mjs`):

- **home 8 GB (BN1.1):** nichts aus der Auswahl startet. Kern 10,8 > 8; auch ohne boot.js
  (Spitze 22,4 GB). Nur Arbeiter (1,75-1,8 GB), `darkweb.js`, `popups.js`, `wakelock.js`
  passen einzeln. Der Kern verlangt mindestens **16 GB** (10,8 + 5,2 Luft; der Waechter
  6,1 passt dort nicht) und erst **32 GB** fuer Kern + Waechter + Wachhalter + cdump.
  Kosten bis dahin: 1,01 M + 3,19 M = 4,2 M (nur per Oberflaeche, sonst nicht kaufbar).
- **home 32 GB (BN4.1 / 4.2 / 4.3 / 1.2):** laeuft Kern 10,8 + Waechter 6,1 + wakelock 2,25
  + cdump 12,65 = 31,8; frei 0,20. `darkweb.js` (2,65) bekommt die Reservierung und wartet,
  bis cdump endet (es endet nach einem Durchlauf, Rotation mit csolve); `shop.js` (7) und
  `ausgang.js` (8,15) kommen nur durch dieselben Lueckenfenster. In der ersten Runde mit
  boot.js daneben: 7,35 frei, nichts startet (vom Test so gewollt). `bn4life` (23,95),
  `bn4rep` (73,1), `homegrow` (13,5), `exit.js` (40,25) passen **nie** auf home 32 neben dem
  Kern - sie brauchen Mietrechner >= 32 / 128 / 16 / 64 GB (1,76 M / 7,0 M / ... bei
  55.000 $/GB, BN4 `CloudServerCost` 1, Softcap 1,2; Leiter verlangt das Doppelte bis
  Vierfache, `bn4net.js:1294-1328`).
- **Schlanke Varianten, die fehlen:** (1) BN1.1-Starter <= 5 GB ohne Singularity, (2) die
  Oberflaechenwerkzeuge mit dem `globalThis["docu"+"ment"]`-Griff (bewaehrt in
  `darkweb.js:54`, `popups.js`, `wakelock.js`, `bn4net.js`): `homeram` 5,4, `buyaugs` 3,9,
  `install` 3,3, `backdoor` 4,5, `work` 2,7, `bitverse` 2,3, `joinfac` 5,8, `hand` 4,4 GB
  (jeweils Rechnung minus 25), (3) in BN4 ohne Sleeves/Hacknet/SF5 ein schlanker
  Verbrechenslaeufer neben dem Kern (bn4life braucht 23,95; frei sind 0,2-12,85).

## 3. Annahmen aus Lauf 1 im Code (Datei:Zeile)

Hinweis: nur zwei dieser Stellen sind Fehler im Ablauf (A1-A3, A9-A11); die uebrigen sind
Kommentare oder Konstanten, die in Lauf 2 falsch werden.

| Nr | Stelle | Annahme | Wirkung in Lauf 2 |
|---|---|---|---|
| A1 | `src/boot.js:20,27` ; `:273-290` | home 32 GB, bn4net passt; Warteschleife ohne Alternative | auf 8 GB wartet boot.js ewig, killt nach 5 min alles (`:186-216`) |
| A2 | `src/route.json:5` (erster Eintrag BN10 L2), `tools/test-route.js:40,79,82` (40 Eintraege / 39 Spruenge) | Lauf 1 hat BN1.1-BN9.3 hinter sich | `planeRoute` aus BN1 mit SF=0 liefert Lauf = BN1 **L2** (kein L1-Eintrag) und Ziel = **BN10** L2; `exit.js` lehnt BN4 ab (`lib/route.js` zielErlaubt) |
| A3 | `tools/test-kaltstart-budget.js` Zeile um `standVorEintrag` (`sf = {1:1,4:1,5:1,6:1,10:1}`), `HOME_GB = 32`, `startlage(4,"V2")` | SF-Stand "04.09.2026 gemessen", BN4 nur als V2, nie home 8/16 | keine Lauf-2-Lage ist abgedeckt (Abschnitt 4) |
| A4 | `src/lib/reg.js:150-198` (`gilt`) | kein SF4-Gate: SF-Bestand geht nur in den RAM-Faktor (`:274`), nicht in die Auswahl | in BN1.1 starten Singularity-Gewerke (`figwatch` 12,85, `export` 19,35, `bn4door` 100,5, `bn4life` 293,95, `homegrow` 148,5) auf Mietrechnern, sobald einer gross genug ist, und werfen bei der ersten Singularity-Funktion (`NetscriptHelpers.tsx:389`) - Neustartschleife (`restartPolicy: always`), Strafleiter des Waechters. Nicht gefahren, Verdacht |
| A5 | `src/registry.json` bn4life/bn4rep/homegrow (`phase: normal`, `hostRule: werkbank`) und `bn4net.js:1036-1050` (bn4life "laeuft immer auf home") | Werkbank existiert; Kommentar und Registry widersprechen sich | in BN4.1-Kaltstart laufen weder Verbrechen noch Faktionsbeitritt noch Augkauf, bis ein 32-GB-Mietrechner (1,76 M) steht |
| A6 | `src/bn4net.js:668-675` (`HOME_KALTSTART_GB = 64`), `src/guard.js:393` | Kaltstart = home <= 64 oder kein Park | stimmt fuer Lauf 2; BN1.1 8/16 GB laeuft ebenfalls "kaltstart" - dort laeuft aber nichts (A1) |
| A7 | `src/bn4rep.js:225` ("SF5 ist vorhanden"), `:240`, `:901`; `src/joinrun.js:89`; `src/blade.js:850`; `src/kampfaugs.js:244` | `getBitNodeMultipliers` verfuegbar, Rueckfalltabelle nur "Fehlerfall" | Lauf 2 hat bis SF5 nie SF5: Rueckfaelle sind Normalfall. Tabellen: `WD_DIFFICULTY[4]=3` ok, `FACTION_REP_GAIN[4]=0,75` ok (`bn4rep.js:218,228`), `DAEDALUS_SCHWELLE_FALLBACK` ohne BN4/BN1 = 30 ok. Gelesen, nicht gefahren |
| A8 | `src/bn4net.js:150-175` | liest Knotenmultiplikatoren aus `lib/bitnodes.json`, nicht aus dem Spiel | unabhaengig von SF5, ok - Pluspunkt |
| A9 | `src/keepalive.js:198-206` | Wiederanlauf startet `autopilot.js` (34,2 GB) per Terminal | passt weder auf 8/16/32 noch ist es der heutige Kern; `boot.js` fehlt |
| A10 | `src/darkweb.js:112` | Spieler steht in Sector-12 | gilt im frischen Spiel; nach Reisen in Lauf nicht - Lauf 1 hat es nie gestoert |
| A11 | `src/exit.js:12-16,24-25`; `src/ausgang.js:11,35,419-470` | Ausgang = Singularity `destroyW0r1dD43m0n`; "Black Ops nicht gebaut" (Kopf veraltet) | in BN1.1 unmoeglich; ab BN4.1 ok, aber `exit.js` 40,25 GB braucht 64-GB-Wirt neben dem Park |
| A12 | `src/bn4net.js:54-61,432-471` (Kommentare) | "bn4life 22,8 / 42,45 GB passen nicht" - Zahlen aus Lauf 1 | irrefuehrend, sachlich fuer BN4 neu zu rechnen (23,95 / 73,1) |
| A13 | `tools/mock/ns.js:60-76` | Mock bucht SF4-Faktor fest 16, kein SF4-Throw, `bn4net` Faktor in BN4 nicht modelliert; Registry-Dateien ohne Eintrag (homeram, join, buyaugs ...) haben keine Groesse | Ebene-2-Tests koennen SF4=0/2/3 und BN4 nicht stellen |
| A14 | Sleeves: `registry.json` sleeve.js (`verfahren: alle`), `sleevecrime.js:48-56` | SF10 vorhanden; Marker `keine-sleeves.txt` | sleevecrime faengt es sauber ab (Marker); `sleeve.js` hat nur `try/catch` je Aufruf (`sleeve.js:234,460,514,534`) - nicht gefahren ohne SF10, wirft vermutlich nicht, belegt aber 31,85 GB-Reservierung |
| A15 | Bladeburner: `registry.json` blade.js `V2`; `bn4net.js:4104` (`!(verfahrenV1 && blade/bbtrain)`) | Bladeburner nur in V2-Knoten | **haelt**, solange BN4.x/BN1.x als V1 in der Route stehen; stehen sie als V2 (so heute 4.2/4.3), startet blade.js ohne SF6/7 und wirft |
| A16 | Hashes/Hacknet: `registry.json` `requiresFeature 9`, `bn4net.js:3997-4107` | Marker `keine-hacknet.txt` | haelt: Feature 9 wird aus `getResetInfo` abgeleitet (`reg.js:119-147`), ohne SF9 startet `hashes.js` nicht |
| A17 | `src/boot.js:226-233` | `getScriptRam` > frei -> warten; Notliste `boot/guard/ausgang` | ausgang.js 8,15 > 8 GB home: auf 8 GB nie startbar, also keine Routenlogik/ kein Ausgang-Wachhund in BN1.1 |
| A18 | Bruecke `sync/instanz.js:47,62`, `sync/bridge.js:1747-1830` | LIVE-Identifier fest, Anker = letzte `totalPlaytime` aus Heartbeat/INDEX.tsv, Rueckwaertssprung > 60 s und fremder Identifier -> "Socket abgewiesen, NICHTS geschrieben" | **Ein neues Spiel wird abgewiesen** (Identifier neu, `totalPlaytime` ~0 gegen > 2.000 h): `pushAll` unterbleibt, kein Skript kommt ins Spiel. Zweiter Fund neben dem Kaltstart selbst |
| A19 | `src/lib/route.js:60-63`, `src/ausgang.js:213-218` | `ownedSF` aus `getResetInfo` | haelt fuer SF=0 (leere Map -> 0), `route_state` korrekt |

## 4. Pruefstand

| Was | Deckt | Deckt nicht |
|---|---|---|
| `tools/test-kaltstart-budget.js` (Ebene 0) | Registry-Auswahl + Platzreservierung nachgebildet, 32 GB, BN10/BN9/BN4 je V2/V1 gemischt, Route-Zeilen 1-8 | home 8/16; SF-Stand als Konstante (A3); BN1.1; BN4 als V1; die Oberflaechenwerkzeuge (nicht in der Registry); dass cdump/csolve die Fenster fuer darkweb/shop tatsaechlich freigeben (statisch); Einkommen |
| `tools/mock/ns.js` + 30 Ebene-2-Tests | Abfolge ueber Runden, steuerbare Zeit, Platzbuchung, Bladeburner-/Sleeve-Mocks, `home 8 GB` nur in `test-guard-ebene2.js:451,498` (Waechter allein) | keine Wirtschaft, kein SF4-Throw, SF4-Faktor starr 16 (A13), kein `document`; kein Test faehrt den Kern auf 8/16/32 mit leerem SF-Stand und BN4 |
| `tools/test-route.js` | `planeRoute` ueber 40 Eintraege | jede andere Route (Zahlen fest, A2) |
| Ebene 3 (`pruefstand/`, Dev-Build 8798, TEST-Rolle 12526, Dev-Menue: Geld, home-RAM, SF-Stufen, Sleeve-Zahl, Zeitsprung - `pruefstand/build-v301-dev.cmd:1-12`) | **vorhanden, aber nie fuer einen Kaltstart gefahren**: die Messluecke steht offen in `tools/test-alles.js:551` ("EBENE 3, KALTSTART") | alles Oberflaechen-Verhalten (BitVerse, Join, Install, Wiederanlauf) ist nur dort pruefbar |
| `tools/klon.js` | patcht den Port einer LIVE-Sicherung | erzeugt keinen frischen Spielstand und setzt keine SF; das geht nur ueber den Dev-Build (neuer Spielstand im Browser-Profil `pruefstand/browser` + Dev-Menue) |

Ergebnis: **es gibt keinen Test, der den Bot gegen einen frischen Spielstand faehrt.**
Der Budgettest rechnet die 32-GB-Lage (und die auch nur mit Lauf-1-SF-Stand); alles
darunter und alle Oberflaechenwege sind unabgesichert.

## 5. Bauliste

Aufwand: S = bis ~3 h, M = 0,5-1,5 Tage, L = >= 2 Tage. "Test" = was ein Spielstand-Test
im Pruefstand absichern kann (Ebene 2 = Mock, Ebene 3 = Dev-Build-Instanz mit
Dev-Menue).

| Nr | Posten | Warum | Aufwand | Risiko | Test |
|---|---|---|---|---|---|
| **K01** | Route fuer Lauf 2: neue Eintraege 1.1, 4.1, 4.2, 4.3, 1.2 vorn (alle **V1**), Rest nach 3a; `test-route.js` (40/39) und `test-matrix`/`test-kaltstart` aus der Datei ableiten statt fest | A2: sonst Ziel BN10, V2 in BN4 ohne SF6 | S | niedrig; Route ist "unveraenderlich" (Regel in `lib/route.js`) - Aenderung ausdruecklich als Lauf-2-Epoche kennzeichnen | Ebene 0 (`test-route.js`) |
| **K02** | Bruecke "Lauf-2-Epoche": Identifier, Anker, Sicherungsindex und Backup-Kette fuer ein neues Spiel zuruecksetzbar (explizit, nie still), Alarm bleibt fuer Fremdspiele | A18: ohne das kommt kein Skript ins Spiel | M | **hoch** (die Bruecke ist der einzige Prozess, der Erics Spielstand anfasst; Riegel nicht aufweichen, nur einen benannten Epochenwechsel) | Ebene 0: `tools/test-bruecke.js` (MOCK) um "frischer Spielstand nach Epochenwechsel" und "Lauf-1-Stand wird weiter abgewiesen" erweitern |
| **K03** | `coldstart.js` (<= 5 GB, ohne Singularity, ohne `document`): rooten, Ziel waehlen, Arbeiter auf alle Rechner, startet `darkweb.js` bei Geld; Ablauf in `ausgang`-freiem Modus; uebernimmt ab 16/32 GB der Kern | A1/P0: nichts verdient Geld auf 8 GB | M | mittel (Arbeiterverteilung + Reserve; `bn4start.js` hat die Vorlage, aber Singularity und 16-GB-Reserve raus) | Ebene 2 (Mock home 8, SF leer) + Ebene 3 Dev-Build neuer Spielstand |
| **K04** | Oberflaechenwerkzeuge ohne 25-GB-Aufschlag: `globalThis["docu"+"ment"]` in `homeram`, `buyaugs`, `install`, `backdoor`, `work`, `joinfac`/`join`, `bitverse`, `hand`; `ram.js`-Sollwerte in die Registry | P2-P5: 25 GB sind in 8-32 GB nicht tragbar | M | mittel (mechanisch, aber Fokus/Seitenwechsel-Verhalten bleibt; `tools/test-ram-namen.js` pruefen) | `tools/ram.js --registry` (Groessen); Verhalten nur Ebene 3 |
| **K05** | `bn1life.js`: Entscheider ohne Singularity fuer BN1.1 - Reihenfolge darkweb -> home 16/32 (Geld > 2 x Preis) -> Backdoors -> Beitritt (CyberSec, NiteSec, Black Hand, BitRunners, Daedalus) -> Arbeit -> `buyaugs` -> Einbau (Sperre `install-sperre`) -> Red Pill -> w0r1d_d43m0n-Backdoor -> BitVerse 4. Daedalus-Tor: 100 Mrd + 30 Augs | P3-P5: heute ist das Handarbeit ueber `task.js` (Lauf 1: 46 h mit Claude am Rad) | **L** | hoch (Fokus-Sperren, Reputationsverlust 20 % bei Fokuswechsel, unwiederbringliche Einbauten) | nur Ebene 3 (Dev-Menue: Geld/home-RAM/Augs setzen, Teilstrecken einzeln); Entscheidungslogik als reine Funktion Ebene 0 |
| **K05b** | Alternative zu K05 (Rueckfall, kein Bau): BN1.1 wird von Eric/Claude mit den vorhandenen `task.js`-Werkzeugen gefahren, K04 liefert nur die kleineren Groessen; Ausgang per `bitverse.js 4` | spart L; entspricht "Handstart ... Ausgang per Oberflaeche" aus 3b | 0 | BN1.1 ist dann nicht autonom (46 h Lauf 1; Modell 24-50 h) | - |
| **K06** | Seitenagent `relaunch.js` (setInterval im Seitenkontext, 0 GB resident): startet `boot.js` nach Einbau und nach der BitVerse-Wahl, wenn nichts laeuft; ersetzt `keepalive.js` (startet `autopilot.js`); optional Autoexec auf `boot.js` stellen (nur bei Seiten-Laden) | P4/P5: Einbau und UI-Ausgang haben keinen Rueckruf (`Singularity.ts:1153-1161` nur fuer die API) | M | mittel (Terminal-Eingaben nehmen den Fokus; "im Zweifel nichts tun" wie `keepalive.js:28-60`) | Ebene 3 (Install im Dev-Build, Warten auf Neustart) |
| **K07** | `boot.js` Kaltstart-Zweig: bei home < 17 GB `coldstart.js` statt `bn4net.js`, Schonliste (`killSafe:false`) und Kommentar `:20` korrigieren; `ausgang.js` (8,15) auf <= 7,9 GB bringen oder im 8-GB-Modus aussetzen | A1, A17 | S | niedrig; Schonliste ist in der Registry | Ebene 2 (Mock home 8/16/32) |
| **K08** | BN4.1-Kaltstart (V1, ohne Sleeves/SF5/SF9): erstes Einkommen und erster 32-GB-Mietrechner belegen; ggf. schlanker Verbrechenslaeufer (`commitCrime`, ~8 GB) neben dem Kern statt auf bn4life zu warten; Leiter-Stufe fuer BN4 (`CloudServerSoftcap 1,2`, Hack-Geld 2,25 %) | P6: `bn4life` (Verbrechen) ist `normal`-Phase und braucht einen 24-GB-Mietrechner; davor nur Vertraege + 2,25 % Hack-Geld | M | hoch (V1 in BN4 nie mit dem heutigen Bot gefahren; Lauf-1-BN4.1: 48,6 h, alter Bot) | Ebene 3 (Dev-Menue: SF1=1, BN4) + Ebene 2 Mock BN4 V1 |
| **K09** | SF4-Gate in `lib/reg.js`: Gewerke mit `singularity:true` (nicht in BN4 ohne SF4) gelten nicht; gleiche Pruefung in `guard.js`/`strategie-check` | A4: Neustartschleifen in BN1.1 | S | niedrig; Registry-Feld existiert (`singularity`) | Ebene 0/2 (`test-registry.js`, neuer Fall `ownedSF {4:0}, node 1`) |
| **K10** | Pruefstand auf Lauf-2-Lagen: `test-kaltstart-budget.js` um home 8/16/32, SF aus der Route statt Konstante (A3), BN1.1/BN4.1-4.3/BN1.2 je V1, Oberflaechenwerkzeuge mit `ram.js`; `mock/ns.js`: SF4-Faktor aus Lage, SF4=0-Throw, BN4-Faktor; Sim `sim.mjs` als Vorlage | Abschnitt 4 | S-M | niedrig | Ebene 0/2 |
| **K11** | Ebene-3-Kaltstartlauf im Dev-Build (frischer Spielstand, TEST-Rolle): BN1.1 bis Einbau 1 (misst K03/K04/K06), danach Dev-Menue-Fixtures BN4.1 (SF1=1, home 32), BN4.2 (SF4=1), BN4.3 (SF4=2), BN1.2 (SF4=3); `t_workbench` gegen Knotenpreis messen | schliesst die offene Messluecke `test-alles.js:551`; K05/K06/K08 sind nur hier pruefbar | M-L (Wanduhr: 1-3 Tage Beobachtung) | mittel (Zeitsprung des Dev-Menues verfaelscht Wirtschaft; Rolle TEST strikt trennen) | selbst der Test |
| **K12** | Kommentare/Konstanten bereinigen: A5, A7, A11, A12 (SF5 "vorhanden", Kopf `exit.js`, `bn4net.js` 54-61, Registry `ramHeuteGb`) | verhindert falsche Annahmen beim naechsten Umbau | S | keines | `node tools/test-alles.js --schnell` |

Reihenfolge (Abhaengigkeit): K02 + K01 sofort (ohne sie nichts), K10 neben K09 (billig, sichert
alles Folgende), dann K03/K07, K04/K06, K08; K05 nur, wenn BN1.1 wirklich autonom sein soll
(sonst K05b); K11 begleitet jeden Schritt.

**Geschaetzter Gesamtaufwand:** K01, K02, K07, K09, K10, K12 zusammen ~2-3 Arbeitstage;
K03, K04, K06, K08 zusammen ~3-5 Tage; K05 weitere 3-6 Tage (entfaellt bei K05b);
K11 etwa 1-3 Tage Beobachtung und Nacharbeit. Summe **ca. 8-12 Arbeitstage** fuer autonomes
BN1.1 -> BN4.3, **ca. 5-7 Tage** mit K05b (BN1.1 von Hand).

## 6. Offene Messpunkte (nicht gebaut, nur benannt)

- Einkommen in BN4.1 vor dem ersten Mietrechner (Vertraege + 2,25 % Hack-Geld): ungemessen
  (A5/K08). Der Mietrechner 32 GB kostet 1,76 M; Doppeltes bis Vierfaches fordert die Leiter.
- Daedalus verlangt 100 Mrd Geld (`FactionInfo.tsx:143`); in BN4 mit Hack-Geld 2,25 % ist
  das die eigentliche V1-Huerde - Lauf 1 BN4.1 (V1, alter Bot) brauchte 48,6 h; die 17,9 h
  aus `3a` sind imputiert.
- Ob Singularity-Gewerke in BN1.1 wirklich in Neustartschleifen laufen (A4): aus dem Code
  gelesen, nicht gefahren.
- Ob die UI-Wahl in BitVerse den Seitenkontext erhaelt (`setInterval` ueberlebt): fuer den
  Einbau belegt (`keepalive.js:5-15`), fuer die BitVerse-Wahl nicht gemessen.
