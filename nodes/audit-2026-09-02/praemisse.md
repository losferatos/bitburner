# Audit: Prämisse und Architektur — „45 Läufe ohne Menschen"

Stand 02.09.2026, 17:07 (Systemzeit). Winkel: nicht „ist der Code korrekt",
sondern „ist das die richtige Bauform für 41 Restläufe ohne Eingriff".
Alle RAM-Zahlen aus `scratchpad/ramcalc.js` (Nachbau von
`RamCostGenerator.ts`, geeicht: `boot.js` 4,00 GB gegen die 4,0 aus
`data/boot.txt` exakt; `homegrow.js` 148,5 gegen 149 aus dem bn4net-Log).

---

## Befunde

### K1 — Der Ausgang wohnt im Skript, das am seltensten läuft, und startet auf dem Rechner, auf dem er nicht passt
Schwere: KRITISCH
Beleg: `src/bn4rep.js:891` (Bedingung nur `EXIT_KEY`), `:929`
`ns.exec("exit.js", "home", 1, ziel)`. `exit.js` kostet außerhalb BN4 mit
SF4.1 **519,25 GB** (`destroyW0r1dD43m0n` = SF4Cost(32) → 512, dazu
`getNextBlackOp` 2, `getServer` 2, Portknacker 0,25, `getPlayer` 0,5, Rest;
`ramcalc.js`). home hat in BN10 L2 seit 06:02 512 GB, 128,75 frei
(`data/bn4net.json`: `homeRam 512, homeFrei 128.75`). bn4rep.js selbst
(848,3 GB) ist laut `data/bn4net-log.txt` von 16:12 bis 16:57 in jeder
Runde „fehlend" und wartet auf einen 1024-GB-Rechner (BN10: 412 Mio × 4 =
1,65 Mrd, `BAUSTELLEN.md` Sofort).
Was passiert: Selbst wenn die Red-Pill-Bedingung um den Black-Ops-Weg
ergänzt wird (heutiger Befund 1), gibt `exec` auf home 0 zurück, solange
home < ~540 GB (519,25 + bn4net 16,25 + Reserve). Dann `rufeMenschen`
(:933) — und den liest im Spiel niemand (siehe H2). Zustand: Daedalus
gefallen → Bot wartet ewig. Kosten: der ganze Restlauf, in jedem der zwei
verbleibenden 16×-Knoten (BN10 L2, L3) sicher, in allen weiteren Knoten
dann, wenn home zufällig kleiner als exit.js ist (SF4.3: 39,25 GB — dann
meist unkritisch).
Was der Bot stattdessen tun müsste: Die Ausgangsentscheidung aus bn4rep.js
herauslösen in ein eigenes, singularityfreies `ausgang.js` (nachgerechnet
**10,75 GB**: `getResetInfo` 1, `getNextBlackOp` 2, `getServer` 2, `exec`
1,3, `scriptKill` 1, Rest), das in `WERKZEUGE` ganz oben steht, beide Wege
prüft (`inBladeburner() && getNextBlackOp() === null` ODER
`serverExists(WD) && hacking >= requiredHackingSkill`) und exit.js auf dem
Wirt mit dem meisten freien Speicher startet — mit Arbeiter-Räumung, wie
`bn4net.js:450-480` es für `data/task.txt` schon kann. Kein Rückgabewert 0
darf in einen Notruf münden; er mündet in die nächste Runde.

### K2 — Es gibt keine maschinenlesbare Route; das Ziel schreibt ein Mensch, und der Wächter verbietet 27 der 40 Übergänge
Schwere: KRITISCH
Beleg: `data/exit-ziel.txt` enthält `10` (live gelesen), geschrieben nur
per `pushFile` von außen — in `src/` und `tools/` gibt es **keinen
Schreiber** (grep `exit-ziel` trifft nur Leser in bn4rep.js:906-914 und
Prosa). Die Reihenfolge existiert ausschließlich als Markdown-Tabelle
(`nodes/AUDIT-ROADMAP-2026-08-24.md` §2, `nodes/ROUTE.md` §3);
`data/ziele.md` ist ein Tagesziel-Protokoll vom 29.08., keine Route.
`bn4rep.js:907`: `zielRoh < 1 || zielRoh > 13 || zielRoh === eigenerKnoten`
→ Notruf. Die Route verlangt **25** Übergänge in denselben Knoten (BN10 L2→L3
1, BN4 1, BN9 2, BN1 1, BN5 1, BN12 2, BN2 2, BN3 2, BN11 2, BN6 1, BN7 2,
BN14 2, BN13 2, BN15 2, BN8 2 — nachgezählt an `ROUTE.md` §3) und 6
Übergänge **nach** BN14/BN15, die `> 13` abweist (4 davon zugleich
Selbstsprünge). Zusammen 27 der 40 verbleibenden Sprünge. Der nächste fällige Übergang (BN10 L2 → BN10 L3) ist bereits
einer davon.
Was passiert: Der Bot kann ohne Menschen weder wissen, wohin, noch darf er
dorthin. Jeder Übergang kostet einen Besuch; unter der Prämisse: Stillstand
bis zum nächsten `/bb` — bei „alle paar Tage" pro Übergang 1-3 Tage ×
41 = 40-120 Kalendertage reine Wartezeit, mehr als die Spielzeit selbst.
Was der Bot stattdessen tun müsste: `data/route.json` auf home (Textdateien
auf home überleben den Knotenwechsel — `ServerHelpers.ts:226-239` räumt nur
`programs` und `messages`; `data/exit-ziel.txt` hat es heute bewiesen).
Entwurf und Auswertung in Abschnitt „Frage 3". Der Selbstsprung-Guard wird
ersetzt durch: *Sprung in Knoten n ist erlaubt, wenn der erste offene
Routeneintrag n heißt* — nicht durch „n ≠ eigener Knoten".

### H1 — Das Verfahren V1/V2 steht nicht in der Route, sondern als Liste der nativen Bladeburner-Knoten im Code
Schwere: HOCH
Beleg: `src/bn4rep.js:70` `BLADE_KNOTEN = [6, 7, 10]`, `bladeburnerTraegtHier()`
steuert Einbausperre (:713-732) und Ausgangslogik. `nodes/ROUTE.md` §3:
V2 ist Träger in BN4 L2/L3, BN9 ×3, BN2 ×3, BN3 ×3, BN11 ×3, BN13 ×3,
BN14 ×3, BN15 ×3 — **22 der 41 Restläufe in Knoten außerhalb der Liste**.
Bladeburner ist dort per SF6.1 verfügbar (`canAccessBladeburner`), und
`bbtrain.js` + `blade.js` stehen bedingungslos in `WERKZEUGE`
(`bn4net.js:251-262`) — sie treten also bei, während bn4rep den Knoten als
Hackingknoten behandelt.
Was passiert: In BN4 L2 (Position 6, in vier Läufen) baut bn4rep ein,
sobald die Warteschlange voll ist. Ein Einbau setzt die Kampfwerte auf 1
(`BAUSTELLEN.md` ENTSCHIEDEN: gemessen 90.810 Erfahrung = 6,6 h je Einbau
am 29.08.). blade.js findet keine Aktion über der Schwelle, bbtrain
trainiert neu, bn4rep baut wieder ein. Je Lauf mehrere Einbauten × 6,6 h.
Dazu greift die Red-Pill-Ausgangslogik, obwohl der Knoten über Black Ops
verlassen werden soll (→ K1).
Was der Bot stattdessen tun müsste: `verfahren` je Routeneintrag
(„V1"/„V2"/„V1b"), von `ausgang.js` einmal je Runde als
`data/verfahren.txt` abgelegt; bn4rep, blade, bbtrain, sleeve lesen das
statt `currentNode` zu raten. Bei V1-Läufen darf bbtrain gar nicht erst
starten (spart 95 GB Werkbank und das Beitrittstor).

### H2 — Das Notruf-Modell ist unter der Prämisse ein Stillstands-Modell: fünf Rufe, kein Hörer im Spiel
Schwere: HOCH
Beleg: `rufeMenschen`/`data/hilfe.txt` an `bn4rep.js:910, 928, 933`,
`bbtrain.js:202, 317`; `boot.js:126` („Hier muss ein Mensch nachsehen",
danach `return`). Leser: `tools/wache.js:735` (abgeschaltet 31.08.),
`tools/checkin.js:107` (nur wenn ein Mensch `/bb` startet). Im Spiel liest
die Datei niemand; bn4rep löscht sie beim Start (:367).
Was passiert: Jeder Rufort ist eine Endlosschleife ohne Ausweg (bn4rep:
`await ns.sleep(15000); continue;`) oder ein Abbruch (boot.js nach 240 ×
5 s = 20 min). Beispiel boot.js: Kann bn4net 20 Minuten nicht starten
(z. B. weil ein liegengebliebenes Skript home belegt), gibt das einzige
Skript auf, das den neuen Knoten anwerfen kann — der Knoten ist tot, bis
jemand `run boot.js` tippt.
Was der Bot stattdessen tun müsste: Jeden Rufort in eine Entscheidung
umbauen: (1) Ziel unbrauchbar → Route (K2); (2) exit.js fehlt auf home →
`scp` von der Werkbank, sonst weiter versuchen; (3) exec 0 → anderer Wirt
(K1); (4) bbtrain kein Gym → in der aktuellen Stadt jedes Studio nehmen,
`GYM`-Tabelle vervollständigen; (5) Beitritt abgelehnt → Werte neu messen
und weitertrainieren (macht die Schleife ohnehin, der Ruf ist Lärm);
(6) boot.js → nie aufgeben, notfalls fremde Skripte auf home killen. Der
Notrufkanal darf bleiben — als Protokoll, nicht als Wartebedingung.

### H3 — Die Singularity-Kosten sind kein Architekturproblem, sondern ein Routenproblem; Zerlegung hilft nicht, und der Kaltstart hängt an 1,9 GB
Schwere: HOCH (für genau einen weiteren Lauf), danach NIEDRIG
Beleg (gerechnet, `ramcalc.js`): Ein Skript mit **genau einem**
Singularity-Aufruf kostet außerhalb BN4 mit SF4.1 **33,60 GB** (Fn1:
1,6 + 2×16), Fn2 **49,60**, Fn3 **81,60**, `stopAction` 17,60. Das frische
home hat 32 GB (`Prestige.ts:246-252`: 128 nur ab SF9.2, sonst 32 bei SF1,
sonst 8). **Kein einziges Singularity-Skript passt auf ein frisches home**,
egal wie klein. Die Basiswerte im Auftrag (1/2/3 GB) sind falsch — es sind
2/3/5 (`RamCostConstants` Z. 55-57).
Routenlage: Position 3-5 BN10 (16×), 6-7 BN4 (in BN4 ×1, `SF4Cost`
Z. 82-96), ab Position 8 mit SF4.3 überall ×1. Es gibt also **einen einzigen
weiteren 16×-Kaltstart** (BN10 L3) und zwei 16×-Ausgänge (BN10 L2, L3).
Was passiert: Ein Umbau in Einzelaufruf-Skripte kostet zwei Steuerskripte
(bn4rep 1.972 Z., bn4life) und bringt genau einen Lauf; er beseitigt den
Kaltstart nicht, weil auch das kleinste Skript den Mietrechner braucht.
Der echte Kaltstart-Hebel ist ein anderer: `contracts.js` (17,65 GB) passt
neben `bn4net.js` (16,25) um **1,9 GB nicht** auf home (33,9 > 32). Heute
06:02 lösten 24 liegengebliebene Verträge **+86 Mio** (`BAUSTELLEN.md`,
`CodingContractMoney 0.5` in BN10, `BitNode.tsx:844ff`), der erste
Mietrechner kostet 8,8 Mio. Verträge entstehen 3 Versuche je 10 min, auch
offline (`Engine.tsx:267`); die Hackrate im Kaltstart lag bei ~350 $/s =
1,26 Mio/h gegen ~6 Mio/h aus Verträgen.
Was der Bot stattdessen tun müsste: **Nicht zerlegen.** Stattdessen bn4net
um ≥ 2 GB verschlanken (`ns.getServer` 2 GB → Einzelabfragen à 0,05-0,1;
`scriptKill` 1,0 und `kill` 0,5 auf eines) oder contracts.js um 2 GB, damit
der Vertragslöser ab Sekunde 1 auf home läuft; Leiterfaktor 1,0 im
Kaltstart (heutiger Befund 2). Und die Reihenfolge nicht antasten — sie ist
das, was die Architektur trägt.

### H4 — Das Betriebsmodell „Tab nur, wenn Eric sitzt" passt nicht zu 1.100-1.900 h; Skripte machen offline nichts
Schwere: HOCH
Beleg: `Engine.tsx:277` `loadAllRunningScripts()` — Skripte laufen offline
**nicht**, sie bekommen `offlineHackingIncome = Ø-Hackrate × Offlinezeit ×
0,75` (Z. 270-275, `Constants.ts:22`), sonst nichts. Bladeburner legt die
Zeit als `storedCycles` ab (`Engine.tsx:332`, `Bladeburner.ts:276` ohne
Deckel) und holt **höchstens 5 Spielsekunden je Realsekunde** nach
(`Bladeburner.ts:1377-1379`); Sleeves 15 Zyklen je Zyklus (`Sleeve.ts:268`,
15×); Spielerarbeit wird beim Laden in einem Zug abgearbeitet
(`Engine.tsx:280-282`). `tools/rueckstand.js:5-25`: Gleichgewicht bei
**4,8 h Vordergrund-Tab je Tag**, Erics Fenster 5,5 h, 42 min Puffer;
verdeckter Tab (1 Timer/min) senkt den Abbau um Faktor 12.
Gemessen: BN10 L1 brauchte 94,9 h Kalender für ~52 h Spielzeit ab Beitritt
(`BAUSTELLEN.md` KURS-Eintrag; Faktor 1,8).
Was passiert: Alles, was der Bot *entscheidet* — Rechner kaufen, Augs
kaufen, Einbau, Aktion wählen, Ausgang — passiert nur im Fenster. Für die
30 V2-Läufe zählt Bladeburner-Zeit ≈ 24 h/Tag, solange 4,8 h Vordergrund
eingehalten werden; ein kurzer Tag, und der Rückstand wächst unbegrenzt.
Für die 11 V1-Läufe (BN1, BN5, BN12, BN8) tragen Skripte den Fortschritt:
dort gilt 24/5,5 = Faktor 4,4 auf die Kalenderzeit. Grob: 1.100-1.900 h
Spielzeit → 2.000-3.400 h Kalender bei Faktor 1,8, also **3-5 Monate**,
bei schlechterer Tab-Disziplin ein Jahr. „Autonom" heißt im heutigen
Modell: autonom in 5,5 von 24 Stunden.
Was der Bot stattdessen tun müsste: Das ist keine Code-, sondern eine
Laufzeitentscheidung, die aber die Bauform bestimmt. Zwei Wege: (a) die
Electron-Fassung des Spiels setzt `backgroundThrottling: false`
(`reference/v301/electron/gameWindow.js:26,63`) — kein wakelock, kein
Vordergrundzwang, gleicher Quellcode inkl. Remote-API; (b) ein eigenes,
dauerhaft sichtbares Browserprofil auf einem Zweitbildschirm. Die Wahl
gehört Eric; ohne sie bleibt jede Rechnung mit „Spielzeit" eine untere
Kante.

### M1 — Die Brücke schreibt zurück, was in `src/` liegt — und macht Eingriffe im Spiel still rückgängig
Schwere: MITTEL
Beleg: `sync/bridge.js:185-215` `fs.watch` auf `src/` mit `pushFile`
(entprellt). Heute 06:01 wurde `tools/einmal/sleeve-stub.js` als
`sleeve.js` ins Spiel geschoben (Repo unverändert); um 16:39 hatte die
Brücke das Original zurückgeschoben, die Sleeves waren wieder im Gym
(`BAUSTELLEN.md` Sofort, Stand 16:39).
Was passiert: Unter der Prämisse ist die Brücke nur für Codeänderungen da —
dann ist das Verhalten richtig. Solange aber Not-Stubs über sie laufen,
gilt: Jeder Stub hat die Lebensdauer bis zum nächsten Schreibzugriff auf
`src/`, und niemand erfährt davon. Kosten: heute −18,5 Mio in 5 min beim
ersten Mal; beim zweiten Mal wäre es unbemerkt geblieben.
Was der Bot stattdessen tun müsste: Nichts im Bot — die Regel gehört in die
Werkzeuge: Not-Stubs nur als Dateien im Repo (`src/`), nie als Fremdkörper
im Spiel. Und `data/reload.txt` mit `WERKZEUG <name>` bleibt der einzige
Kanal, der ein Werkzeug anhält.

### M2 — boot.js ist der einzige Rückruf und gibt nach 20 Minuten auf
Schwere: MITTEL
Beleg: `src/boot.js:88` `for (let runde = 0; runde < 240; runde++)`, `:125-126`
Abbruch mit Menschenruf. Kommentar `bn4rep.js:1168-1182`: der Rückruf
schlug am 25.08. lautlos fehl, „alle Skripte tot, kein Callback".
Was passiert: Der eine Fall, in dem bn4net 20 min nicht startet, ist genau
der, in dem der Rückruf gebraucht wird (home belegt durch ein Skript, das
den Reset überlebt hat — `runningScriptMap` wird bei Prestige geprüft, aber
`data/task.txt`-Aufträge aus der Zeit vor dem Sprung können sofort wieder
starten, boot.js räumt nur `reload.txt`, nicht `task.txt`).
Was der Bot stattdessen tun müsste: Endlosschleife statt 240 Runden;
`data/task.txt` in die Aufräumliste (`boot.js:75-80`); wenn home nach
5 min nicht frei wird, alles außer sich selbst auf home killen.

### N1 — `tools/task.js` ist der dokumentierte Startweg für exit.js — und der einzige, der heute funktioniert
Schwere: NIEDRIG (Symptom von K1/K2, hier nur als Abhängigkeit notiert)
Beleg: `skills/bb.md` §3 Schritt 3, `tools/task.js:32` → `data/task.txt` →
`bn4net.js:437` (nur wenn `bn4life` kein frisches Lebenszeichen hat) oder
bn4life. `data/exit.txt` von 15:59 gestern zeigt genau diesen Weg.
Was passiert: Stirbt Claude/der Rechner/die Brücke, gibt es keinen
Startweg für den Ausgang. Der Bot hängt an einem Werkzeug, das außerhalb
des Spiels läuft.
Was der Bot stattdessen tun müsste: Mit K1 erledigt. `task.txt` bleibt als
Wartungskanal.

---

## Antworten auf die sechs Fragen

### Frage 1 — Inventar der Menschenstellen

Einordnung: (a) kann der Bot mit Route + Zustand selbst entscheiden;
(b) echte Unumkehrbarkeit > 10 h; (c) Bequemlichkeit.

| Stelle | Was ein Mensch heute tut | (a) | (b) | (c) | Urteil |
|---|---|---|---|---|---|
| `bn4rep.js:907-916` Zielknoten unbrauchbar/eigener Knoten | schreibt `data/exit-ziel.txt` per pushFile | ja, `getResetInfo().ownedSF` + `route.json` | ja — falscher Sprung = Lauf doppelt (25-50 h) — **aber der Bot kann es prüfen**: „Ziel ist erster offener Routeneintrag" ist schärfer als „Ziel ≠ eigener Knoten" | — | ersetzen (K2) |
| `bn4rep.js:891` Ausgang nur bei Red Pill | startet exit.js per task.js | ja, `getNextBlackOp()===null` | nein | — | ersetzen (K1) |
| `bn4rep.js:918-928` exit.js fehlt auf home | pushFile | ja (scp von Werkbank) | nein | ja | ersetzen |
| `bn4rep.js:929-935` exec gab 0 | task.js auf anderem Wirt | ja (Wirtwahl + Räumen wie bn4net:450-480) | nein | — | ersetzen (K1) |
| `bn4rep.js:70` `BLADE_KNOTEN` | ändert die Liste je Knoten | ja, `verfahren` aus Route | nein, aber 6,6 h je Fehleinbau | — | ersetzen (H1) |
| `bbtrain.js:202` kein Gym in Stadt | — (Schleife läuft weiter, trainiert aber nicht) | ja | nein | — | Rückfall bauen |
| `bbtrain.js:317` Beitritt abgelehnt | — (Werkzeugliste startet neu) | ja | nein | ja | Ruf streichen |
| `boot.js:125` 20-min-Abbruch | tippt `run boot.js` | ja (nie aufgeben) | nein | — | ersetzen (M2) |
| `bn4net.js:596` „mit task.js selbst starten" | kauft Rechner von Hand (heute 05:55 `kick.js`) | ja (Leiter 1,0; contracts auf home) | nein | — | H3 |
| `bn4net.js:640-651` Kaltstart-Leiter 1,25 × 8,8 Mio | Kickstart | ja | nein | ja | heutiger Befund 2 |
| `sleeve.js:316` Gym ohne Geldprüfung | Notstopp per Stub | ja (`GYM_MIN_GELD`) | nein (−18 Mio, Stunden) | — | heutiger Befund 3 |
| `data/reload.txt`, `data/task.txt`, `data/bn4-stop.txt`, `data/install-sperre.txt`, `data/batch-ziele.txt` | Wartungskanäle von außen | — | — | ja | behalten, keine Wartebedingung |
| `skills/bb.md` §3.2 „Eric das Ziel nennen und bestätigen lassen" | Freigabe je Übergang | ja (K2) | s. o. | — | streichen, sobald route.json steht |
| `skills/bb.md` §3.3 `node tools/task.js exit.js` | Auslösen | ja (K1) | — | — | streichen |
| `skills/bb.md` §3.4 Nachsehen, ob er drüben angelaufen ist | Kontrolle | teils: `ausgang.js` kann nach dem Sprung nichts mehr tun, boot.js protokolliert | — | ja | behalten als Lesen |
| `skills/bb.md` §3.5 KURS.md neu herleiten | Doku | nein (Doku) | — | ja | entfällt mit Route |
| `skills/bb.md` §4 „eintragen, nicht reparieren" + Skeptiker-Verabredung | jede Reparatur | nein — Codeänderung bleibt Menschenarbeit | — | — | bleibt; das ist die einzige legitime Menschenstelle |
| `tools/wache.js`, `tools/aufsicht.js`, `tools/nightshift.js` (ntfy, Reset „von Hand") | abgeschaltet/alt | — | — | — | Altlast, nicht Teil der Prämisse |

Die KI behält sich in `bb.md` genau drei Entscheidungen vor: Zielknoten
bestätigen lassen, Ausgang auslösen, Kurs neu herleiten. Alle drei sind mit
K1+K2 hinfällig. Übrig bleibt: Codeänderungen (mit Skeptiker) — das ist
unter der Prämisse erlaubt, weil es kein *Eingriff in den Lauf* ist.

### Frage 2 — Singularity-RAM als Architekturfrage

Gerechnet (`ramcalc.js`, geeicht auf zwei unabhängige Messwerte):

| | SF4.1 außerhalb BN4 | SF4.2 | SF4.3 / in BN4 |
|---|---|---|---|
| 1 Aufruf Fn1 (purchaseTor, travel, gym) | 33,60 | 9,60 | 3,60 |
| 1 Aufruf Fn2 (joinFaction, workForFaction) | 49,60 | 13,60 | 4,60 |
| 1 Aufruf Fn3 (purchaseAug, install, crime) | 81,60 | 21,60 | 6,60 |
| exit.js | 519,25 | 135,25 | 39,25 |
| vorgeschlagenes ausgang.js (singularityfrei) | 10,75 | 10,75 | 10,75 |
| frisches home | 32 (128 ab SF9.2) | | |

Antwort: **Die Bauform „ein großes Skript je Aufgabe" ist tragfähig — aber
nur wegen der Route.** Zerlegung beseitigt den Kaltstart nicht (33,6 > 32),
und ab Position 8 ist das Problem weg. Was die Bauform wirklich kostet, ist
die *Dauerbelegung*: bn4rep (848 GB) wartet in BN10 auf einen 1024-GB-
Rechner und läuft deshalb die halbe Laufzeit nicht — und in ihm sitzt heute
der Ausgang (K1). Die richtige Zerlegung ist eine einzige: **die
Entscheidungen, die den Lauf abschließen, aus den Singularity-Skripten
heraus in ein 11-GB-Skript**, nicht die Aufteilung aller Aufrufe.

### Frage 3 — Die Route als Datei

Vorschlag `data/route.json` auf home (überlebt den Sprung wie
`exit-ziel.txt`):

```json
{ "stand": "2026-09-02",
  "route": [
    { "node": 10, "level": 2, "verfahren": "V2" },
    { "node": 10, "level": 3, "verfahren": "V2" },
    { "node": 4,  "level": 2, "verfahren": "V2" },
    { "node": 4,  "level": 3, "verfahren": "V2" },
    { "node": 9,  "level": 1, "verfahren": "V2" },
    { "node": 9,  "level": 2, "verfahren": "V2" },
    { "node": 9,  "level": 3, "verfahren": "V2" },
    { "node": 1,  "level": 2, "verfahren": "V1" },
    { "node": 1,  "level": 3, "verfahren": "V1" },
    { "node": 5,  "level": 2, "verfahren": "V1" },
    { "node": 5,  "level": 3, "verfahren": "V1" },
    { "node": 12, "level": 1, "verfahren": "V1" }, { "node": 12, "level": 2, "verfahren": "V1" }, { "node": 12, "level": 3, "verfahren": "V1" },
    { "node": 2,  "level": 1, "verfahren": "V2" }, { "node": 2,  "level": 2, "verfahren": "V2" }, { "node": 2,  "level": 3, "verfahren": "V2" },
    { "node": 3,  "level": 1, "verfahren": "V2" }, { "node": 3,  "level": 2, "verfahren": "V2" }, { "node": 3,  "level": 3, "verfahren": "V2" },
    { "node": 11, "level": 1, "verfahren": "V2" }, { "node": 11, "level": 2, "verfahren": "V2" }, { "node": 11, "level": 3, "verfahren": "V2" },
    { "node": 6,  "level": 2, "verfahren": "V2" }, { "node": 6,  "level": 3, "verfahren": "V2" },
    { "node": 7,  "level": 1, "verfahren": "V2" }, { "node": 7,  "level": 2, "verfahren": "V2" }, { "node": 7,  "level": 3, "verfahren": "V2" },
    { "node": 14, "level": 1, "verfahren": "V2" }, { "node": 14, "level": 2, "verfahren": "V2" }, { "node": 14, "level": 3, "verfahren": "V2" },
    { "node": 13, "level": 1, "verfahren": "V2" }, { "node": 13, "level": 2, "verfahren": "V2" }, { "node": 13, "level": 3, "verfahren": "V2" },
    { "node": 15, "level": 1, "verfahren": "V1b" }, { "node": 15, "level": 2, "verfahren": "V2" }, { "node": 15, "level": 3, "verfahren": "V2" },
    { "node": 8,  "level": 1, "verfahren": "V1", "braucht": "stocks" }, { "node": 8, "level": 2, "verfahren": "V1", "braucht": "stocks" }, { "node": 8, "level": 3, "verfahren": "V1", "braucht": "stocks" }
  ] }
```

Auswertung in `ausgang.js`, je Runde (60 s), ohne Zustandsdatei außer der
Route selbst:

1. `info = ns.getResetInfo()` (1 GB): `cur = info.currentNode`,
   `sf = info.ownedSF` (Map Knoten → Stufe; `NetscriptDefinitions.d.ts:104`).
2. `stufeNachDiesemLauf(n) = (sf.get(n) ?? 0) + (n === cur ? 1 : 0)`.
3. **Dieser Lauf** = erster Eintrag mit `e.node === cur` und
   `(sf.get(cur) ?? 0) < e.level` → liefert `verfahren`, wird als
   `data/verfahren.txt` abgelegt (H1).
4. **Ziel** = erster Eintrag mit `stufeNachDiesemLauf(e.node) < e.level`.
   Probe am Live-Zustand: BN10, sf(10)=1 → (10,2): 2<2 nein; (10,3): 2<3
   **ja → Ziel 10**. Nach dem Sprung sf(10)=2, cur=10: (10,3): 3<3 nein;
   (4,2): 1<2 ja → Ziel 4. Kein Selbstsprung-Guard mehr nötig — die
   Rechnung schließt einen verschenkten Lauf konstruktiv aus. Kein Eintrag
   übrig → `data/fertig.txt`, kein Sprung.
5. Ausgangsbedingung je `verfahren`: V2 `inBladeburner() && getNextBlackOp()
   === null`; V1 `serverExists(WD) && getServer(WD).requiredHackingSkill <=
   getPlayer().skills.hacking` (Root holt exit.js selbst); V1b wie V1
   (Red Pill kommt aus dem Labor). `braucht` unerfüllt → protokollieren,
   nicht springen.
6. Erfüllt → exit.js auf dem Wirt mit dem meisten freien Speicher
   (Arbeiter räumen), `exec` 0 → nächste Runde.

Die Datei ist die einzige Stelle, an der ein Mensch die Reihenfolge ändert.
Die Prosa-Tabellen bleiben Begründung, nicht Quelle.

### Frage 4 — Außenwerkzeuge

| Werkzeug | Bot hängt daran? | Wo |
|---|---|---|
| `sync/bridge.js` | nein für den Lauf, ja für Code — und ja im Fehlerfall: einziger Weg für `exit-ziel.txt`, Stubs (M1) | `pushFile`-Aufrufe in tools/firma, graftnext, hand, nightshift, reserve, spann, strategie-check, wache |
| `tools/task.js` | ja: dokumentierter und faktisch einziger Ausgangsweg (N1) | `bb.md` §3.3, `bn4net.js:437` |
| `tools/checkin.js` | nein (liest nur) — aber es ist der einzige Hörer für `hilfe.txt` (H2) | `:107, :154` |
| `tools/save.js` | nein (liest IndexedDB) | — |
| Zustandsdateien auf der Festplatte (`data/*.json` im Repo) | nein — alle Bot-Zustände liegen im Spiel auf home/Werkbank | `data/checkin.json`, `verlauf-strategie.json` sind Beobachterzustand |
| Von außen geschriebene Spieldateien ohne Schreiber in `src/` | `exit-ziel.txt` (**Pflicht**, K2); `batch-ziele.txt`, `workfaction.txt`, `install-frei.txt`, `bladeoffen.txt`, `reserve.txt` (optional/Altlast) | grep-Vergleich Leser/Schreiber |

Ergebnis: Genau eine Pflichtabhängigkeit nach außen (`exit-ziel.txt` +
`task.js` für den Ausgang). Alles andere ist Wartung oder Beobachtung.

### Frage 5 — Betriebsmodell
Siehe H4. Kurz: Skripte 0 % offline; Bladeburner 5× Nachholen, Gleichgewicht
4,8 h Vordergrund/Tag; Sleeves 15×; Arbeit vollständig. Entscheidungen des
Bots nur im Fenster. 1.100-1.900 h Spielzeit ≈ 3-5 Monate Kalender bei
Faktor 1,8 (BN10 L1 gemessen), bis zu einem Jahr bei Tab-Disziplin unter
4,8 h. Electron-Fassung ohne Drosselung ist der eine Hebel, der die
Rechnung auf 46-79 Tage bringt (24 h/Tag).

### Frage 6 — Die drei Bauentscheidungen, die ich neu treffen würde

1. **Ausgang und Route aus bn4rep.js herauslösen** (K1, K2, H1):
   `ausgang.js` (10,75 GB, singularityfrei, ganz oben in `WERKZEUGE`) +
   `data/route.json`. Ersetzt Red-Pill-Bedingung, Selbstsprung-Guard,
   `exit-ziel.txt`, `BLADE_KNOTEN`, Home-only-exec und die drei
   Vorbehalte in `bb.md`. Kosten: ~150-200 Zeilen neu, ~60 Zeilen in bn4rep
   raus, Skeptiker-Lauf, ein Test des Sprungs BN10 L2→L3 (steht ohnehin an).
   Ertrag: alle 40 Übergänge ohne Menschen; 22 V2-Läufe ohne Fehleinbauten.
2. **Vom Notruf- zum Rückfallmodell** (H2, M2, heutige Befunde 2-3): jede
   `rufeMenschen`-Stelle bekommt eine Handlung, boot.js gibt nie auf, die
   Kaltstart-Leiter und contracts.js auf home (H3: 2 GB in bn4net finden).
   Kosten: klein, verteilt; Ertrag: der 13,5-h-Stillstand von gestern
   Nacht kommt nicht wieder, und kein Zustand wartet auf `/bb`.
3. **Laufzeit statt Browser-Tab** (H4): Electron-Fassung mit
   `backgroundThrottling: false` oder dauerhaft sichtbares Profil.
   Kosten: Umzug des Spielstands (Export/Import), `tools/save.js` verliert
   die IndexedDB-Abkürzung — unter der Prämisse entbehrlich. Ertrag: Faktor
   2-4 auf die Kalenderzeit, wakelock.js und rueckstand.js werden überflüssig.
   Diese Entscheidung ist Erics, nicht die des Bots.

Was ich **nicht** ändern würde: die Bauform „großes Skript je Aufgabe"
(Zerlegung bringt einen Lauf und kostet zwei Steuerskripte), die
Reihenfolge der Route (sie ist der Grund, warum die RAM-Frage sich selbst
löst), boot.js als 4-GB-Rückruf und die Werkzeugliste als Wiederanlauf.

---

## Was ich geprüft und für tragfähig befunden habe

- Wiederanlaufkette `destroyW0r1dD43m0n(ziel, "boot.js")` → boot.js →
  bn4net → `WERKZEUGE`: gestern 15:59 real gelaufen (`data/exit.txt`,
  `data/boot.txt`), Skripte und `data/*.txt` überleben den Sprung
  (`ServerHelpers.ts:226-239`, `Prestige.ts:236-237` setzt nur `ramUsage`
  zurück). Eine Routendatei auf home ist damit sicher.
- `exit.js` prüft beide Wege korrekt gegen `Singularity.ts:1153-1180`
  (Black Ops ODER Level+Root; Server muss nicht am Netz sein); akzeptiert
  1-15.
- home nach dem Sprung ist mit SF1 immer 32 GB (`Prestige.ts:246-252`); der
  8-GB-Fall kann nicht eintreten. bn4net (16,25) + boot (4,0) passen immer.
- RAM-Modell: `boot.js` 4,00 GB exakt getroffen, `homegrow.js` 148,5 gegen
  149 — die Zahlen in H3/K1 sind auf ±1 GB belastbar.
- Offline-Mechanik ist genau so, wie `tools/rueckstand.js` sie beschreibt
  (`Bladeburner.ts:1377-1379` max 5 Ticks, `Sleeve.ts:268` min(…,15)).
- Die Route macht die Singularity-Frage ab Position 8 gegenstandslos —
  vorausgesetzt, sie wird eingehalten.

## Was ich nicht prüfen konnte

- Den gemessenen RAM-Wert von `exit.js` im Spiel (kein `getScriptRam` über
  die Brücke; 519,25 ist gerechnet). Auch nicht, auf welchem Wirt exit.js
  gestern lief — das Log des alten Knotens ist weg.
- Ob die Electron-Fassung die Remote-File-API identisch anbietet (gleicher
  Quellbaum, aber nicht ausprobiert) und ob der Spielstand verlustfrei
  wandert.
- Ob `Player.processWork(numCyclesOffline)` intern gedeckelt ist
  (Engine ruft es in einem Zug; die Work-Klassen habe ich nicht gelesen).
- Ob sich in bn4net wirklich 1,9 GB sparen lassen, ohne Funktion zu
  verlieren (`ns.share`, `getServer`, `kill`/`scriptKill` in der
  Aufrufliste — ob alle live sind oder nur in Kommentaren stehen, verlangt
  `getScriptRam` nach dem Umbau).
- Die Kosten der `GYM`-Tabelle in bbtrain (welche Städte fehlen) und den
  bn4life-gegen-bbtrain-Konflikt (heutiger Befund 4) — nicht mein Winkel.
