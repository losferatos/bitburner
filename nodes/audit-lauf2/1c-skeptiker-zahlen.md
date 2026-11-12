# Teil 1c - Skeptiker: Zahlen und Methode von 1a/1b

Stand: 12.11.2026 20:0xZ (Systemzeit). Nur lesend: `backups/INDEX.tsv`, `data/dashboard-history.json`, `data/bridge.log`,
`doku/rangkurve-*.json`, Spielquellcode `reference/v301/src`. Eigene Rechenhilfen (nur Lesen) liegen im Scratchpad
`audit1c/` (rec.js, dh*.js, gapcls.js, g2.js, ins.js, pt.js, lnr.js). Nichts im Projekt ausgefuehrt oder geaendert.

Urteile: HAELT / FALSCH / UNSICHER. Kurzfassung steht am Ende (Abschnitt 7: Korrekturliste).

## Winkel 1 - Ist Online-Zeit die richtige Uhr?

### 1.1 Was das Spiel mit Offline-Zeit tut (Quellcode)

Beim Laden: `timeOffline = jetzt - Player.lastUpdate` (`engine.tsx:257-264`), `numCyclesOffline = floor(timeOffline/200 ms)`.
`totalPlaytime += time` (`engine.tsx:344-350`) - deshalb ist `totalPlaytime` Wanduhr (Eichung unten). Was gutgeschrieben wird:

| Bereich | Offline-Behandlung | Beleg | Folge |
|---|---|---|---|
| **Bladeburner (V2)** | `storeCycles(numCyclesOffline)`: `storedCycles += n`, **ohne Obergrenze** (nur Untergrenze 0) | `engine.tsx:332`, `Bladeburner.ts:275-277` | Rueckstand bleibt voll erhalten |
| | Abbau in `process()`: je Aufruf hoechstens **5 s** (`Math.min(seconds, 5)`), `process()` alle 5 Zyklen = 1 s Realzeit | `Bladeburner.ts:1377-1380`, `engine.tsx:150,198-205` | Aufholen mit Faktor 5, netto +4 s je Realsekunde; 8 h offline = 2 h online zum Abbau |
| | `processAction(seconds)` addiert nur auf die **laufende Aktion**; Black Ops werden nicht wiederholt (`if (action.type != BlackOp) startAction`); Aktion nicht verfuegbar (Vorrat `count < 1`) -> `resetAction()` (Leerlauf); Stamina <= 0 -> `resetAction()` | `Bladeburner.ts:1296-1315`, `1301`, `1371-1375` | Gutschrift gilt nur, solange die zuletzt gestartete Aktion weiterlaeuft |
| **Sleeves** | `process(numCyclesOffline)`: `storedCycles += n`, Abbau je Aufruf `min(stored, 15)` | `Sleeve.ts:263-274`, `engine.tsx:341` | Gutschrift voll, Aufholen mit Faktor 15 |
| **Spieler-Arbeit** (Gym, Fraktionsarbeit) | `Player.processWork(numCyclesOffline)` 1:1, wenn `currentWork !== null` | `engine.tsx:279-283`, `Work/FactionWork.tsx:48-56` | Rufe/Kampf-Exp laufen offline mit |
| **Hacking-Skripte (V1)** | nur fuer zum Speicherzeitpunkt **laufende** Skripte: Geld = `onlineMoneyMade/playtimeSinceLastAug * t * 0,75`; Exp = `confidence * onlineExpGained/onlineRunningTime * t` mit `confidence = min(1, onlineRunningTime/14400)`; grow/weaken halber Online-Zaehler | `ScriptHelpers.ts:14-98`, `Constants.ts:22`, `NetscriptWorker.ts:215-262` | Gutschrift haengt an der Bauart des Bots (langlebiger Dauer-Hack-Faden ja, kurzlebige Batch-Worker kaum) |
| Gang, Go, Darknet, Stanek, Corp | Gang `process(numCyclesOffline)`; Corp/Go/Darknet `storeCycles` | `engine.tsx:326-338` | Corp/Go: Bonuszeit |

**Was nicht passiert:** Kein Bot-Code laeuft (Einbauen, Augs/Skills kaufen, Aktion wechseln, Black Op starten, Aug-Reset).
Die Gutschrift setzt die zuletzt laufende Aktion fort.

### 1.2 Urteil zur Uhr

- **V2-Knoten:** "Offline kostet nichts" ist mechanisch **moeglich, aber nicht garantiert** - 1b M2 ("voll gutgeschrieben")
  ist als Aussage ueber die Mechanik **richtig** (Ursprung: die Projektnotiz ERLEDIGT.md um Z.5858 hat dieselben Zeilen schon
  zitiert), als Aussage ueber die **Praxis des Bots UNSICHER**. Undichte Stellen (alle belegt oben): Aktion nicht verfuegbar,
  Stamina 0, Black-Op-Phase (nach einer Black Op Leerlauf), kein Skillkauf/Einbau/Moduswechsel offline.
- **V1-Knoten:** "Offline = kein Fortschritt" (1b M2/V49) **HAELT empirisch** in guter Naeherung (Online-Stunden je Knoten fast
  konstant bei stark schwankender Wanduhr: BN1 L2/L3 11,8/12,7 h bei 19,5/12,7 h Wanduhr; BN5 L2/L3 19,9/19,3 h bei 19,9/46,8 h;
  BN12 L1-L3 12,0/12,3/13,7 h bei 48,8/24,2/32,3 h). Aber **nicht exakt null**: im Quellcode laufen Skriptgutschrift, Faktionsarbeit
  und Hacknet offline mit; in BN8.1 steigt das Hacking-Level ueber die drei Luecken mit +3 / +84 / +207 Stufen
  (`dashboard-history.json`, 10.11. 05:08-15:00, 11.11. 05:01-16:06, 11.11. 19:51-12.11. 03:38) gegen Online-Raten von 8-72 Stufen/h,
  also grob 0 bis 40 Prozent Gutschrift. V49 ist damit **Obergrenze** des V1-Verlusts, nicht "belegt".

### 1.3 Eichung der V2-Gutschrift an den Daten (Rang nach Luecken, dashboard-history)

Im Fenster 29.10.-12.11. (V2: BN13.2, BN15.1, BN15.2) hat jede Offline-Luecke einen **Rangschub nach dem Wiederverbinden**, wie er bei
5-fachem Abbau zu erwarten ist, z. B. BN15.1 05.-06.11.: Luecke 20:05-05:07 (9,0 h), Rang 22.477 -> 22.711 am Luecken-Ende,
dann +3.943 in 26 min, 30.817 nach 51 min (Vorrate: Rate vorher 872/h). Pro Ereignis geschaetzte "gutgeschriebene Stunden"
(Rangzuwachs ueber Luecke + Abbauzeit durch Vorrate, geteilt durch die Rate der 2 h davor; grobes Verfahren, Rate nicht stationaer):

| Luecke ab (UTC) | Luecke h | gutgeschrieben h (grob) |
|---|---:|---:|
| 10-30 19:48 (BN13.2) | 10,0 | 2,7 |
| 11-02 19:28 (BN15.1) | 7,2 | 7,9 |
| 11-03 04:51 | 10,7 | 7,0 |
| 11-03 19:26 | 8,6 | 0,0 (Vertraege, Chance 0,45, Rang flach) |
| 11-04 05:16 | 13,2 | Ausreisser (39) |
| 11-04 20:31 | 7,9 | 0,2 |
| 11-05 20:05 | 9,0 | 6,3 |
| 11-08 02:44 (BN15.2) | 6,0 | Ausreisser (26) |

Lesart: In 4 von 8 Faellen etwa voll, in 2 von 8 ~0, 2 Ausreisser (Black-Op-Sprung). Ohne Ausreisser ~21 von 43 h = **grob 50 Prozent,
Streuung 0-100 Prozent**. Das ist **keine Eichung, nur ein Plausibilitaetstest**; er widerspricht beiden Extremen ("alles
verloren" und "alles gutgeschrieben"). Folge fuer die Entscheidung: V2-Offline-Luecken (488 W Wanduhr) kosten **etwa die Haelfte
bis nichts**, nicht "0 bis 488" bei gleicher Wahrscheinlichkeit; 1b V50 sollte die Mitte (~240 W Wanduhr, grob) nennen.

### 1.4 Gegenprobe-Zirkel in 1a (FALSCH als Beleg)

1a Abschnitt 1 "Gegenprobe: dashboard-history zeigt 16 Luecken = 125,6 h; INDEX-Methode 125,3 h" ist **zirkulaer**: das Dashboard-Verlauf
wird von derselben Bruecke (`sync/bridge.js:151`, `createHistory`) geschrieben; sie sieht nur, solange das Spiel antwortet. Beide Messungen
zeigen "Bruecke ohne Spiel", nicht "Spiel aus". Eine **unabhaengige** Uhr steht im selben Verlauf: `motor` (Motorzeit,
`src/lib/motorzeit.js`: zaehlt nur Takte, in denen der Bot wirklich lief). Ueber die 17 Luecken > 0,4 h (126,3 h) laeuft `motor`
nur 3,5 h weiter (11-04 05:16-18:26: 2,14 h; 11-11 05:01-16:06: 0,62 h; Rest je 0,0-0,1 h). Das heisst: **2,8 Prozent** der
"Offline"-Luecken sind in Wahrheit Spiel-lief-bei-toter-Bruecke. Die Mitte der Spanne trifft also nicht "auf 0,3 h", sondern
unterschaetzt Online um ~3,5 h / 126 h.

## Winkel 2 - Online-Messung selbst

**Nachgerechnet:** alle 44 Laeufe aus `INDEX.tsv` (Luecke > 70 min = offline, minus 30 min). Ergebnis: **Arithmetik stimmt**,
Abweichungen gegen `chronik.json.onlineH` je Lauf <= 0,01 h (rec.js), einzige Ausnahme BN8.2 (8,4 h statt 8,65 h: 1a rechnet bis
12.11. 19:41Z, die letzte Zeile ist frueher; belanglos). Stichprobe (Wanduhr/online): BN10.3 97,3/48,0, BN4.2 47,2/33,6, BN9.1 104,1/34,2,
BN7.2 62,3/47,2, BN12.1 48,8/12,0, BN15.1 100,6/35,5 - alle exakt reproduziert.

**Beginn/Ende:** Unabhaengig geprueft (nicht aus 1a-Methode): `nodeReset` im `dashboard-history.json` fuer 7 Laeufe (BN13.2, 13.3, 15.1, 15.2,
15.3, 8.1, 8.2) gegen `chronik.json.start`: **Differenz 0,0 s in allen 7**. Aus den Saves selbst (`lastNodeReset`): BN1.2 und BN8.1
gegen chronik: ms-genau. (Die uebrigen Hourly-Dateien sind rotiert; Saves existieren nur noch fuer einen Teil.)
`ts - totalPlaytime` ueber **alle 1.539 Indexzeilen** konstant (Spreizung 64 s, 19.08. 16:35:00-16:36:04Z); kein einziges Paar mit
`|d pt - d Wanduhr| > 2 min`. Urteil: **HAELT** (auch die Aussage "Spiel schreibt Offline-Zeit voll gut").

**Hourly-Takt:** Hourly-Abstand median 60,0 min (p10/p90 60,0/60,0); Abstandsverteilung zwischen Zeilen: 840 Paare 55-65 min, nur
2 Paare 65-70, 4 Paare 70-90, 3 Paare 90-130 min, 5 Paare 130-300, 64 Paare > 300 min. Der 70-min-Schwellwert trennt sauber (kaum Zeilen
im Zwischenbereich). Urteil Schwelle: **HAELT**.

**Tote Bruecke bei laufendem Spiel:** 76 Luecken (635,1 h roh). Klassifikation gegen `data/bridge.log` (ohne die Zeilen an den Luecken-Raendern):
38 Luecken (288,9 h) enthalten "Spielverbindung getrennt" (Spiel/Tab zu bei lebender Bruecke), 7 (47,0 h) haben Bruecken-Logzeilen ohne
"getrennt" (Bruecke lebt, Spiel stumm), **31 (299,2 h) sind log-stumm** (Bruecke tot: Rechner aus oder Bruecke gestorben).
Beleg fuer Fehlzaehlung (Spiel lief, Bruecke tot oder ohne Sicherung):
- Kurze Luecken < 3 h: 9 Stueck, 16,3 h roh (11,8 h nach Abzug) - das sind Tages-Bruecken-Tode bzw. Neuverbindungen, kaum Rechner-aus.
  Namentlich: 09-05 20:08 (2,6 h), 09-21 (2,0), 09-23 (1,3), 09-24 (1,4, Brueckentod laut 1b V33), 09-30 (2,8), 10-15 (1,7), 10-27 (1,4), 10-30 (1,9), 11-11 (1,2).
- `motor`-Gegenprobe oben: 2,8 Prozent der Luecken-Stunden sind Spielzeit.
- Drei lange Abend-Luecken ab ~17-21 Uhr UTC (09-08 16:46 21,8 h; 09-14 17:45 20,2 h; 09-15 20:55 17,2 h = 59,2 h roh) sind
  Verdachtsfaelle fuer "Bruecke tot, Rechner nachts an" (1b V33); ohne `motor` vor dem 29.10. nicht entscheidbar.
- **Verbindungs-Verzug:** Die Neuverbindung braucht laut Projektnotiz einen Klick (Options -> Remote API -> Connect); die erste
  Zeile nach einer Luecke ist `connect`, nicht "Spiel gestartet". Spielzeit vor dem Klick zaehlt als offline.

**Schluss Winkel 2:** Der Fehler ist **einseitig**: Online wird unterschaetzt, nie ueberschaetzt (die Methode kann keine Offline-Zeit als
online zaehlen). Realistische Grenzen: Mitte 1.079 h plus 12 h (kurze Luecken) bis plus ~17 h (2,8 Prozent der 597 h Offline) = **1.090-1.100 h**;
Spanne 1.041-1.117 h ist zu schmal nach oben (grosser Ausreisser nur, wenn die drei Abend-Luecken Spiel enthalten: bis ~1.150 h).
Die Aussage "Online 64 Prozent der Wanduhr" ist robust (65 Prozent).

## Winkel 3 - Doppelzaehlung und Bestand/Rate in 1b (Top-10 nachgerechnet)

| # | 1b-Zahl | Nachrechnung | Urteil |
|---|---|---|---|
| 1 | V49 **138 W** V1-Offline (7,3+29,0+38,8+13,0+19,6+30,4) | Das sind **rohe** Luecken. Nach der Methode von 1a (Luecke minus 0,5 h) sind es BN1.2 7,7 + BN5.3 27,5 + BN12 67,3 + BN8.1 29,5 = **132,0 W**. Ausserdem V1-Offline ist nicht null (1.2) | FALSCH (zu hoch um 6 W); Obergrenze, nicht "belegt" |
| 2 | V13 BN6.1 **<= 56 W** Lernkurve | 91,7 - 35,6 = 56,1; Rahmen, enthaelt SF6.1/SF4.3/SF10.3/Graft/Sleeves und (unbekannt) Offline-Anteile von BN6.1 (Online dort nicht messbar). BN6.2 selbst war 74 Prozent offline | HAELT als Rahmen; **gehoert nicht in eine Verlust-Rangliste** (Stufe 1 ist laut 1a Abschn. 6.1 meist die teuerste) |
| 3 | V43/V45 BN15.1 **59-67 W** (100,7 gegen 41,8/34,0) | **Fast die gesamte Differenz ist Offline-Luecke:** BN15.1 hat 65,1 h Offline, BN15.2 6,3 h, BN15.3 0 h -> Luecken-Differenz 58,8 / 65,1 W von 58,3 / 66,9 W Wanduhr-Differenz. **Online-Stunden: 35,5 / 36,0 / 33,7** (fast gleich) | **FALSCH als Verlustzahl** fuer Graft/Go; richtig: "Wanduhr-Differenz = Offline-Luecken; Online-Zeit nicht schneller". Ob Graft/Go etwas brachten, haengt an der Uhrfrage (1.3): nach "Wanduhr" ja viel, nach "Online" nahezu nichts |
| 4 | V28/V27 BN10.2 **21,5 W** (116,5 - ca. 95) | BN10.1 hat keine Online-Messung; 21,5 hat Rahmen-Charakter | UNSICHER (Vergleichslauf ohne Messung) |
| 5 | V35 BN9.1 **ca. 20 S** | Quelle: "Weg bis 100 dauert ~20 h", geschaetzt; 1b fuehrt es unter der "belegten" Gesamtsumme 72 h (51+20+0,9+0,5) | FALSCH als "belegt"; **Schaetzung** |
| 6 | V42 BN2.1 **8,4 W** | 29,9 - 14,5 (Wanduhr 15,4) minus V41 (7,3). In Online-Stunden: 23,1 - 14,5 = 8,6; die V41-Luecke ist in 1a die einzige Luecke (6,8 h nach Abzug): stimmig | HAELT |
| 7 | V30 BN10.3 **10,5-12,5 S** Stillstand | Die "10,5 Stunden reiner Spielzeit" 05:38->16:06 (Ortszeit) sind **exakt die Nacht-Luecke**: Index 03:43 -> 14:04 UTC (Luecke 10,36 h, `totalPlaytime` +37.309.600 ms = Wanduhr). Die Quelle (`BAUSTELLEN.md` Z.714) misst um 16:06 Ortszeit = 14:06 UTC, also 2 Minuten nach dem Wiederverbinden; der Einbau mit SF4.3 lief um 16:21 Ortszeit (+17 min). Hinzu: `lastSave` war um 14:05 UTC 589 min alt (Z.708-711 selbst) = Spiel war aus. **Real verlorene Online-Zeit: ca. 0,5-1 h** (Stillstand 03:48-04:16 UTC plus 17 min nach Reconnect). Was verloren geht, ist hoechstens die **entwertete Offline-Gutschrift** (Gym 1:1), nicht 10,5 Spielstunden | FALSCH (um Faktor ~10-20) |
| 8 | V32 BN4.2 **10 S** Gym-Teufelskreis | Einbau 02:27 UTC; Luecke 04:15-13:32 UTC (9,3 h) liegt zu **8,3 von 10 h** darin; 13:33 neuer pre-install (Fix). Online-Anteil ca. 1,8 h | FALSCH als "10 S"; real ~1,8 h online + entwertete Offline-Gutschrift |
| 9 | V20 BN10.1 **<= 11,4 S** | Obergrenze, BN10.1 ohne Online-Messung | UNSICHER |
| 10 | V41 BN2.1 **7,3 W** Tab-Freeze | Luecke 07:59 -> 15:16 UTC stimmt (7,3 h); beim Neustart ist das Spiel vom Save 08:32:54 geladen und bucht ~6,7 h Offline-Zeit **gut** (Spielmechanik 1.1) - der echte Verlust liegt zwischen ~0,6 h (Gutschrift voll) und 7,3 h | UNSICHER (obere Grenze) |

**Auswirkung auf die BOTFEHLER-Summe 1b Abschn. 2:** "belegt ca. 51 h" setzt sich aus V30 (10,5) und V32 (10) mit zusammen 20,5 h zusammen,
die Nacht-Luecken sind. Korrigiert: 51,45 - 10,5 - 10,0 + ~0,8 + ~1,8 = **ca. 33,5 h** (Spanne 33-51). Die "belegte Gesamtsumme 72 h"
faellt auf **~35 h belegt** (33,5 + 0,9 + 0,5); V35 (20 h Schaetzung) bleibt getrennt als unbelegt. Der Anteil "5-7 Prozent der Wanduhr" wird zu "~2-3 Prozent".

**Doppelzaehlung:** die von 1b ausgewiesenen Vermeidungen (V27/V28, V07/V13, V41 in V42, V48 in V49) sind korrekt. Nicht erkannt:
(a) V30/V32 sind **Luecken-Stunden** (siehe oben), also Doppelzaehlung gegen die M1-Luecken, nur nicht gegen V49 (BN10.3/BN4.2 sind V2);
(b) V43/V45 BN15.1 und V50 ueberlappen zu ~65 h (Offline-Luecke ist in beiden). 1b erwaehnt das in "Doppelzaehlung 3", rechnet aber 59-67 W
weiter in die Rangliste Platz 3.

**Bestand statt Rate:** die V30-Messung "Geld $1.262 auf den Dollar identisch nach 10,5 h" ist die Zahl **einer Offline-Nacht**: Das Spiel hat in dieser
Zeit nicht gerechnet, es hat nur die Zeit gutgeschrieben (Bonuszeit, Hacking-Exp aus Worker-Resten). Das ist genau die Verwechslung "Uhr = Wanduhr,
Spiel = aus" aus der Eichung der Memory-Regel (`motor` wurde dafuer gebaut). Was zaehlt: 17 Minuten echte Stillstandszeit.

## Winkel 4 - BN7: 205 h Wanduhr, 52,8/47,2/67,5 h online

**Befund: Das war ueberwiegend Spielmechanik, und es war vor dem Lauf schon gerechnet. 1b U5 ("ungeklaert", +100-140 W Rahmen) ist verfehlt.**

1. **BN7-Multiplikatoren** (`BitNode.tsx:728-769`): `BladeburnerRank 0,6`, `BladeburnerSkillCost 2`, `HackingLevelMultiplier 0,35`,
   `ServerMaxMoney 0,2`, `ScriptHackMoney 0,5`, `HackExpGain 0,25`, `AugmentationMoneyCost 3`, `CompanyWorkMoney 0,5`, `HacknetNodeMoney 0,2`.
   Zum Vergleich BN14 (gleiche Rang/Skill-Werte): `AugmentationMoneyCost 1,5`, `ServerMaxMoney 0,7`, Kampf 0,5 (BitNode.tsx case 14).
   Rang je Black Op skaliert mit 0,6 (`Formulas.ts:24-25`): Black Ops tragen statt 73.660 nur 44.196 Rang bei (`audit-2026-10-03/bn-bn6-7.md` Tab. 2);
   das "Zaehlwerk" ist **1,82x (rein) bis 3,63x (mit Skill-Rueckkopplung)** BN6 (gleiche Quelle, "BN7 (= BN14)").
2. **Die Erwartung "22-34 h" (`AUDIT-ROADMAP-PRUEFUNG-2026-10.md` Z.183) ist ein ungeeichtes Modell** (Z.174-176 selbst: HackingLevelMultiplier,
   SkillCost, AugMoney "fehlen im Modell"). Das Audit vom **03.10.** (zwei Wochen vor BN7.1) rechnete geeicht **83-163 h, Mitte ~120 h je BN7-Lauf**
   (`bn-bn6-7.md` Zeilen 29-35, 201-204). Ist: **75,1 / 62,3 / 67,5 h Wanduhr** - **unter** der 03.10.-Spanne, nicht darueber.
3. **Kurve (rangkurve-bn7.json, Lauf 2):** 5k bei 20,3 h, 20k bei 33,2 h, 100k bei 57,4 h, 483k bei 62,3 h (jeweils seit Knotenstart). BN6.2: 12,6 / 20,3 / 26,0 / 27,5 h.
   Verhaeltnis BN7.2/BN6.2: 20k x1,64, Ziel x2,3 - **liegt in der Klammer 1,82-3,63** (Ziel). BN14.2 (gleiche Rang/Skill-Werte): 18,5 h bis 20k, 27,6 h Ziel.
4. **Warum BN14 trotz gleicher Faktoren ~2x schneller war als BN7:** BN14 laeuft nach BN7.3 mit SF7.3 (Simulacrum, Bladeburner-Mults x1,14 auf jede Chance),
   AugMoney 1,5 statt 3, ServerMaxMoney 0,7 statt 0,2, SF11/13/14/3-Stand, Bot-Stand vom 24.10. (Stadtwahl nach Wert, Simulacrum-Parallel).
   Das ist **Mechanik des Knotens + Bestand an Source-Files**, kein Bot-Verlust in BN7.
5. **Bot-Anteil (belegt, klein):** `94394bb` Assassination fehlte in BN7.1; Stadtwahl nach `popEst` (spaeter gefixt); Raid in Sector-12 unsichtbar. Keine Stundenzahl belegt.
6. **Offener Punkt (echt):** BN7.3 hat **67,5 h Online** (durchgehend online, keine Luecke) gegen BN7.1 52,8 h und BN7.2 47,2 h - **langsamer, obwohl SF7.1/7.2 und SF6.3 dazugekommen sind**. Nicht aufgeklaert; gehoert als Einzelfrage in die Lauf-2-Planung (keine Messdaten ausser Sicherungen, `rangkurve-bn7.json` enthaelt nur Lauf 2).

**Urteil Winkel 4:** 1b U5/V46 **FALSCH** als "+100-140 W Verlust gegen Erwartung": die Erwartung war nie belastbar und wurde am 03.10. widerrufen;
Rahmenwert gehoert nicht in die Verlustliste. BN7 ist **Mechanik (unvermeidlich) mit Rest-Frage BN7.3**. Fuer die Knotenreihenfolge 2027:
BN7 nach 62-75 h Wanduhr / 47-67 h Online einplanen, **nicht nach 22-34 h**.

## Winkel 5 - Einbau-Zaehlung

Test: Anzahl `pre-install`-Zeilen je Lauf gegen `chronik.json.installs` (ins.js): Summe Einbauten 169 gegen 170 pre-install-Zeilen insgesamt (die Methoden
unterscheiden sich lauf-weise um +-1-2: Wiederholversuche, abgeleiteter letzter Einbau). Je exakt markiertem Lauf ist `installs = pre-install-Zeilen - 1`
(BN5.3 14->13, BN12.1 10->9, BN12.2 12->11, BN12.3 10->9, BN3.1 2->1, BN11.3 3->2, BN7.2 5->4, BN15.3 3->2), jeweils mit pre-jump-Sicherung: das ist
konsistent mit "letzte pre-install-Zeile = Sprung-Vorbereitung" und mit den unterscheidbaren `lastAugReset`-Werten. Fuer Laeufe ohne pre-jump (BN10.2 +2, BN10.3 +1,
BN4.2/4.3 +1, BN9.1 +1) sind die Zahlen als Untergrenzen markiert. **HAELT**; Einschraenkung: Einbauten zwischen zwei Hourly-Sicherungen ohne pre-install-Zeile (Bruecke tot) fehlen systematisch - Summe ist Untergrenze (bei 9 bekannten Brueckentoden bis ~+5 gesamt).

## 5. Weitere Befunde (nicht angefragt, entscheidungsrelevant)

1. **1a/1b nennen zwei Online-Summen:** 1a 1.079 h (Luecke minus 30 min), 1b M1 ~1.050 h (rohe Luecken >= 2 h, 626 W). Differenz = 70 Luecken x 0,5 h ~ 35 h. Vereinheitlichen.
2. **Die Planzahlen in 1a Abschn. 5 ("Plan vermutlich Online-/Spielzeit")** sind nach 1.1 nicht beantwortbar, solange V2 teils Wanduhr (Gutschrift) und V1 Online-Zeit ist.
   **Fuer 2027 gilt je Verfahren eine andere Uhr:** V2 nach Wanduhr (mit Abschlag fuer entwertete Gutschrift, grob 0-50 Prozent), V1 nach Online-Stunden.
3. **Gleichgewichtsgrenze V2:** Abbau 4 s/s netto, also hoechstens 80 Prozent Offline-Anteil voll einloesbar (ERLEDIGT Z.5858: 4,8 h/Tag). Hoechster gemessener Offline-Anteil in V2:
   BN6.2 74 Prozent, BN9.1 67 Prozent (< 80): die Grenze wurde nirgends gerissen; aber der **Rest-Rueckstand beim Sprung** (nicht abgebaut) ist verloren und nicht gemessen.
4. **Das V2-Nachlauf-Muster ist vom Bot nicht pflegebar:** In der Black-Op-Phase (die steilste Rangphase: BN7.2 100k -> 483k in ~5 h) ist die Gutschrift auf **eine** Black Op begrenzt
   (`Bladeburner.ts:1313`); ein Rechner, der dort ausgeht, bremst genau die wertvollste Phase.

## 6. Kurzurteile je Winkel

| Winkel | Urteil |
|---|---|
| 1 Uhr | **UNSICHER fuer V2** (Mechanik belegt, Praxis ~50 Prozent Gutschrift, Streuung 0-100), **HAELT fuer V1** (~Online-Stunden, nicht exakt null); 1a-Gegenprobe zirkulaer = **FALSCH als Beleg** |
| 2 Messung | Arithmetik **HAELT**; Beginn/Ende **HAELT** (7/7 gegen nodeReset); Methode **einseitig unterschaetzt Online** (+12..+17 h, bis +60 h moeglich) |
| 3 Doppelzaehlung | V30, V32, V35, V49, V43(BN15.1) **FALSCH/unbelegt**; BOTFEHLER belegt 51 -> ~33,5 h |
| 4 BN7 | **Mechanik** (Faktor 1,6-2,3 gegen BN6.2, in der 03.10.-Klammer); U5 FALSCH; offen BN7.3 |
| 5 Einbauten | **HAELT** (Untergrenze) |

## 7. Korrekturen an chronik.json / 1a / 1b (konkrete Werte)

**chronik.json / 1a**
1. `onlineH`-Spalten bleiben (rechnerisch korrekt); Summe Online **1.079 h -> Mitte 1.090 h, Spanne 1.041-1.150 h** (einseitig nach oben; Begruendung: kurze Luecken < 3 h = Bruecken-Tode, motor-Gegenprobe 2,8 Prozent, Verbindungsverzug).
2. 1a Abschn. 1 "Gegenprobe ... 0,3 h" streichen oder ersetzen durch: "Dashboard-Verlauf ist selbst Bruecken-Messung (zirkulaer); unabhaengige Uhr `motor`: 3,5 h Spiel-lief von 126,3 h Luecken (2,8 Prozent)".
3. 1a Abschn. 7.2 ergaenzen: Online wird nie ueber-, nur unterschaetzt.
4. BN8.2 online: 8,4 h (bis letzte Indexzeile) statt 8,65 h, oder die Bis-Zeit nennen.
5. Neues Feld je Lauf: `offlineGaps` (Anzahl, Luecken < 3 h) fuer V2-Gutschriftsbetrachtung; Offline-Anteil nicht als "Verlust" lesen.
6. Abschn. 5 (Plan gegen Ist): jede Zeile auf **zwei** Spalten fuehren (Wanduhr und Online), nicht nur beschreiben, dass die Uhr der Planzahl unbekannt sei.

**1b**
7. M1: Online **1.079 h** (nicht 1.050 h); Luecken 597 h netto (635 h roh, 76 Luecken > 70 min; 70 Luecken >= 2 h = 626 h roh).
8. M2/V50/U1 umformulieren: "V2: Offline wird als Bonuszeit gutgeschrieben (belegt Quellcode), in der Praxis grob 50 Prozent (Spanne 0-100) eingeloest (8 Ereignisse); V1: ~Online-Stunden". V50: **~240 W Wanduhr grob** statt "0-488 W".
9. V49: **132 W** (statt 138 W), Obergrenze; Namen: BN12.x 67,3 (statt 71,4), BN8.1 29,5, BN5.3 27,5, BN1.2 7,7.
10. V30: **0,5-1 h** real (statt 10,5-12,5 S); Kategorie BOTFEHLER bleibt (Fehler real), Stundenzahl falsch. Fuer 2027 relevant: Fehlerklasse "Stillstand ueber Nacht entwertet Gutschrift", nicht "10 h Verlust".
11. V32: **~1,8 h online** (+ entwertete Gutschrift) statt 10 S.
12. V35: **unbelegt** (Schaetzung der Quelle), aus der "belegten" Summe nehmen.
13. V41: Obergrenze 7,3 W; real zwischen 0,6 und 7,3 (Neustart bucht 6,7 h gut).
14. V43/V45 BN15.1 + Top-10 Platz 3: "Wanduhr-Differenz 58,3-66,9 W, davon **58,8-65,1 W Offline-Luecken-Differenz**; Online-Zeit 35,5/36,0/33,7 h". Verlustzahl fuer Graft/Go: **nicht belegt**; nach Online-Zeit ~0, nach Wanduhr bis ~58 W.
15. V46/U5 (BN7): Erwartung 22-34 h **widerrufen** (03.10.-Audit: 83-163 h, Mitte ~120 h); Ist 62-75 W / 47-67 online **innerhalb bis unter** der geeichten Spanne; BN7 **nicht** als Verlust fuehren. Offene Einzelfrage: BN7.3 (67,5 h online > BN7.1 52,8 h).
16. BOTFEHLER belegt **~33,5 h** (statt ~51 h); belegte Gesamtsumme **~35 h** (statt ~72 h); Anteil an Wanduhr ~2-3 Prozent (statt 5-7 Prozent). Top-10 neu ordnen: V49 (132 W, Obergrenze), V13 (Rahmen), V28/V27 (21,5 W Rahmen), V35 (Schaetzung), V42 (8,4 W), V20 (<= 11,4 S, Obergrenze), V41 (Obergrenze) - V30 und V32 aus den Plaetzen 7/8 streichen.
17. 1b Abschn. 5 Muster 5/6 ("Zeitbasis/Uhr falsch", "Bestand statt Rate") gilt **fuer 1b selbst**: V30 und V32 sind Fehlzaehlung von Nacht-Luecken als Spielzeit. Als Lehre fuer die Lauf-2-Planung festhalten.

## 8. Was ich nicht pruefen konnte

- `lastNodeReset`/`lastAugReset` direkt: die meisten Hourly-Saves sind rotiert (nur 258 Saves vorhanden, Stichprobe 2 Starts exakt); Beginn/Ende ueber `nodeReset` der Dashboardhistorie nur ab 29.10.
- Die V2-Gutschrift pro Luecke ist eine Naeherung (Rate nicht stationaer); eine saubere Eichung braeuchte ein Paar Saves unmittelbar vor/nach einer Luecke mit gleicher Aktion (in `backups/` nur fuer wenige Faelle vorhanden).
- BN7.3-Langsamkeit: keine Rangkurve fuer Lauf 3.
