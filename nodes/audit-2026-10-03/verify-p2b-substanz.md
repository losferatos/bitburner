# P2b Skeptiker SUBSTANZ: Gegenpruefung von verify-p2b-gang.md (A) und verify-p2b-geldwert.md (B)

Stand 2026-10-04 09:50 (Systemzeit). Rolle: Skeptiker Substanz (Zahlen, Formeln, Annahmen).
Streng lesend: `src/` und `reference/` unveraendert, Spiel nur ueber `getFile` / `getSaveFile`
(Instanz LIVE) gelesen, nichts committet. Geschrieben: `tools/audit/gang-p2b-gegen.mjs`,
`tools/audit/gang-p2b-frisch.mjs` und diese Datei.

Benennung: A nennt das naechste Tor (19:13) "Tor 1", B nennt dasselbe Tor "Tor 2" (B zaehlt das
07:04-Tor mit). Hier: **Tor 19:13**.

## Urteil

| Bericht | Urteil | Kern |
|---|---|---|
| A Gang-Strategie | **TEILWEISE** | Formeln und Dynamik halten (unabhaengig nachgebaut, Eichung auf neue Daten erweitert). Die Empfehlung "S1+S3 bauen" steht auf BN2.1-Zahlen fuer ein Tor, das nicht mehr kommt; fuer BN2.2/2.3 fehlt die Rechnung, und die R-Regel ist dort falsch. |
| B Geldwert am Tor | **TEILWEISE** | "BN2.1: nichts bauen" haelt und ist durch Live-Daten staerker belegt. Die Stunden fuer frische Knoten (+1,0 bis +1,9 h je Knoten, +2,3 h fuer die Vorkaeufe) kommen aus einem Modell, dessen Grundzeit 2,5- bis 4,4-mal zu lang ist; die "Obergrenze 4,05 M$/s" ist keine. |

## 1. Was nachgerechnet wurde

### 1a Unabhaengiger Nachbau der Kernformeln (`gang-p2b-gegen.mjs`)

Ohne Import aus `gang-formulas.mjs` oder einem `gang-p2b-*`-Rechner, direkt aus der Quelle:
Geld `formulas.ts:56-73`, Respekt `:15-31`, Wanted `:33-54`, Stufe `GangMember.ts:70-85`,
Ausruestung `GangMember.ts:343-350` + `upgrades.ts:34-160`, Rabatt `Gang.ts:407-416`, Raten
`Gang.ts:125-168`, Aufgaben `tasks.ts:259-335`. Die Abschrift wird beim Lauf gegen den
Quelltext geprueft (0 Abweichungen). BN2: `GangSoftcap` in `BitNode.tsx:569-592` nicht gesetzt,
Vorgabe 1 (`BitNodeMultipliers.ts:91`); `Player.gainMoney` ohne Faktor (`Gang.ts:168`).

Eichung gegen Werte, die das Spiel selbst gerechnet hat:

| Stand | Stufen neu gegen gespeichert (12 x 6) | Respekt/Zyklus neu gegen `respectGainRate` | Wanted/Zyklus gegen `wantedGainRate` |
|---|---|---|---|
| 03:17 / 04:17 / 07:05 pre-install | Summe Abw. 0 | 0,0000 % | 0,0000 % |
| 05:17 / 06:17 | 0 | +0,027 % / +0,013 % | -0,025 % / -0,015 % |
| 07:17 / 08:17 | 0 | +0,054 % / +0,011 % | -0,067 % / -0,018 % |
| 09:17 / **Live 09:34 (neu)** | 0 | **0,0000 % / 0,0000 %** | **0,0000 % / 0,0000 %** |

Damit ist das Lesen der Mitglieder aus den Backups (Fallenliste "Mitgliederstaerke falsch
gelesen") ausgeschlossen: die gespeicherten Stufen entstehen exakt aus exp, mult, asc_points.

Ergebnisse des Nachbaus (alle 12 Mitglieder, Territorium 1/7, Wanted-Strafe aus dem Stand):

| Stand | Human Trafficking $/s (Mrd/h) | volle w/a/v/r-Ausruestung | Preis voller Satz alle 12 (Rabatt) | Territorium 0,32 | Ausr. + 0,32 |
|---|---|---|---|---|---|
| 07:17 | 2,77 Mio (9,96) | x1,911 | 3,34 Mrd (3,50) | x4,51 | x8,86 |
| 08:17 | 3,97 Mio (14,29) | x1,828 | 1,99 Mrd (5,89) | x4,57 | x8,58 |
| 09:17 | 4,47 Mio (16,08) | x1,810 | 1,21 Mrd (9,65) | x4,60 | x8,53 |
| Live 09:34 | 4,56 Mio (16,42) | x1,807 | 1,09 Mrd (10,76) | x4,60 | x8,52 |

Gegen die Berichte:
- A Ausruestungsfaktor x1,83 (14,06 -> 25,75 Mrd/h): **bestaetigt** (x1,81-1,83). A "2,08 Mrd bei Rabatt 5,62": exakt der Stand 07:05 (2,078 / 5,631).
- A "HT der 12 jetzt 14,06 Mrd/h" (08:49): Nachbau 14,29 (08:17) bzw. 16,08 (09:17), interpoliert ~15,2 -> A rund **7 % zu niedrig** (Auswirkung auf die Sim keine, sie rechnet direkt).
- B "Human Trafficking 4.051.289 $/s" (08:24) und "Terrorism 4977 Respekt/s": passt (3,97 Mio bzw. 4.883 um 08:17, steigend).
- Mult-Produkte A (hack 1,71, str 3,51, def 3,63, dex 1,49, agi 2,64, cha 1,46): bestaetigt.

### 1b Die Rechner selbst ausgefuehrt, auf NEUEN Daten

- `gang-p2b-calib.mjs --livefile <Live 09:34>`: Kette D (03:17 -> Einbau -> 09:34, 6,28 h, ein Lauf) Respekt +0,023 %, Ruf +0,026 %, Wanted +0,008 %, 42 Aufstiege = Log. A/B/C/F wie berichtet. Echte Stichprobe ausserhalb von A (Stand 09:34 gab es bei A nicht).
- `gang-p2b-sim.mjs scen` ab 09:34 (Tor 19:13 in 9,66 h): S1 293,4 Mrd, S3 505,5 Mrd Gang-Geld, Runde x7,41 / x8,39 - reproduziert A (301/519 ab 08:49, 0,7 h mehr Zeit).
- **Neu: Eichung ab der Gruendung** (`gang-p2b-frisch.mjs`, Abschnitt K). A eicht erst ab 03:17. Gestartet mit 0 Mitgliedern, respect 1, wanted 1 (`Gang.ts:64-88`), echtem Regler, Gruendung 01:01:41 (gang.json `lastCreateAt`), faction_rep 1,3683, Favor 0:

| Backup | Alter h | Mitglieder Mod/echt | Respekt Abw. | Ruf Abw. | Summe str Mod/echt |
|---|---|---|---|---|---|
| 01:17 / 02:17 | 0,26 / 1,26 | 3/3, 3/3 | 0 | 0 | 225/225, 1350/1350 |
| 03:17 | 2,26 | 11/11 | +0,18 % | +0,18 % | 2920/2911 |
| 04:17 | 3,26 | 12/12 | +0,05 % | +0,05 % | 6647/6642 |
| 05:17 | 4,26 | 12/12 | +0,16 % | +0,04 % | 9223/9192 |
| 06:17 | 5,27 | 12/12 | +0,05 % | +0,04 % | 13118/13118 |
| 07:05 | 6,06 | 12/12 | +0,03 % | +0,03 % | 14079/14079 |

Der Motor traegt also auch einen Lauf ab Gruendung - die Grundlage fuer die Rechnung des
frischen Knotens in Abschnitt 3.

## 2. Befunde (Statusliste)

### S1 [hoch] A: die BN2.1-Begruendung ist ueberholt - das Tor 19:13 kommt nicht mehr, und selbst dort reicht S0
- Behauptung A: S1/S3 bringen x7,42/x8,41 statt x4,81 am Tor 19:13 und senken "G noetig" von 1,87 auf 1,22/1,08 ("Sicherheit").
- Live (`data/blade.json`, Spielstand): Rang 100.983 (08:24) -> 179.480 (09:17) -> 199.062 (09:34, 16/21 Black Ops) -> **236.657 (09:49, 17/21, naechste Ultron Chance 1,0)**; 09:34-09:49 = 154.000 Rang/h, 08:24-09:34 = 84.200 Rang/h (Spielzeit). Daedalus-Chance 0,109 (08:53) -> 0,192 (09:30) -> 0,275 (09:49). Bis 400.000 fehlen 163.000 Rang; Tor 19:13 wird nur erreicht, wenn die Rate fuer 9,4 h unter ~17.000/h faellt.
- A's eigener Rechner mit der Blade-Lage 09:30 (`scen`, Schnappschuss 09:34): **G noetig am Tor S0 0,99**, S1 0,64, S3 0,57 - alle 5 offenen Ops ohne weiteres Wachstum frei schon mit S0. A's Kennzahl ist in 41 min von 1,87 auf 0,99 gefallen.
- Zusatz: "G noetig" rechnet mit Schwelle 0,90 fuer alle Ops; ab Rang 400.000 gilt der Boden 0,35/0,40 (`blade.js:541-543`, `:2349-2360`, ggf. hoeher durch `einsatzSchwelle`). Die Kennzahl war fuer die letzten drei Ops also eher zu hoch.
- Folge: Fuer BN2.1 hat jeder Gang-Umbau den Wert 0 h. A's Zahlen sind richtig gerechnet, beantworten aber eine Frage, die sich nicht mehr stellt.

### S2 [hoch] A: fuer BN2.2/2.3 gibt es keine Rechnung, und die BN2.1-Zahlen uebertragen sich nicht
- A's x7,42 / x8,41 stammen aus einer reifen Gang (12 starke Mitglieder ab Start), Favor 155 (Ruf x2,55) und 9,7-10,4 h Geldphase. Im frischen Knoten: Favor 0, Gang ab Null, Tor nach ~13-14 h Gang-Alter.
- Nachgerechnet (Abschnitt 3, geeichter Motor ab Gruendung): S0 x3,21, **S1 x5,13-5,83, S3 x5,96-6,51** (Tor bei 13 / 14 h Gang-Alter). Der Hebel ist real, aber kleiner als in A's Tabelle (dort x4,81 -> x7,42 / x8,41).

### S3 [mittel] A: die R-Regel "1,02 x hoechster Rufbedarf" ist fuer frische Knoten falsch, A's Frisch-Tabelle ist nicht reproduzierbar
- A: "R fuer andere Knoten = 1,02 x max(repReq) ... BN2: R_SCHALT = 1_657_500"; Frisch-Tabelle: bei 400 Mrd x6,87 (1,25 Mio) gegen x7,53 (1,625 Mio).
- Mit A's eigenem `torRound` (echter Planer), nichts besessen, Stufen 19:01: maxRep der Runde **1,25 Mio bei jedem Budget 50-1200 Mrd (Typhoon) und 50-600 Mrd (Red Dragon)**; 1,625 Mio erst ab 1200 Mrd Red Dragon. Keine der drei Eingabevarianten (19:01 Reaper 7/Evasive 6; 19:01 51/52; Stufen jetzt 51/52) liefert A's Tabelle (z. B. 400 Mrd: x7,90 / x8,81 / x9,13, jeweils 1,25 = 1,625). Die Tabelle ist mit den gelieferten Skripten nicht nachzurechnen (`cmdRound` rechnet nur mit dem heutigen Besitz).
- Kosten im frischen Knoten: R 1,6575 statt 1,275 Mio verschiebt den Wechsel von 8,62 h auf 9,65 h: S1 x4,76 statt x5,13 (Tor 13 h) bzw. x5,13 statt x5,83 (14 h); bei S3 klein (x5,90 statt x5,96).
- Richtig: R = 1,02 x maxRep der Runde, die der Planer mit dem erwarteten Torbudget plant. BN2.2/2.3: **1,275 Mio**; BN2.1 (Bionic Spine besessen): 1,6575 Mio.

### S4 [hoch] B: das Stundenmodell fuer frische Knoten ist an der falschen Rate geeicht - Stunden ~2- bis 3-fach zu hoch
- B uebernimmt `freshNodeSaving` (G01-Substanz-Pruefer): "geeicht auf BN2.1 22:17 (Rang 7178, 435 Rang/h)".
- Das Modell braucht mit k = 1 fuer 7.178 -> 25.000 Rang **12,5 / 16,9 / 21,8 h** (min/mittel/max ueber das Band). Beobachtet: 7.178 (22:17) -> 24.930 (03:17) = **5,0 h**. Stuendliche Raten aus den Backups: 21:17-22:17 +435, dann +1.598, +3.237, +5.220, +2.125, +5.572 Rang/h. Die 435/h sind die letzte Stunde des Wiederaufbaus (Tor 19:01 + 3,1 h laut B), nicht die Arbeitsrate.
- Gegenrechnung mit der beobachteten Strecke Tor 19:01 -> Rang 25.000 (8,27 h) und der tatsaechlichen Runde 19:01 (k_obs x1,189, A's `opRatios`, Typhoon), T(k) = T_fix + (8,27 - T_fix) x (k_obs/k)^beta, T_fix 0 / 3,1 h, beta 0,8-1,25:
  - B "36 -> 83 Mrd bringt +1,6 h": Gegenrechnung **+0,5 bis +0,8 h**.
  - B "Vorkaeufe kosteten +2,3 h" (x2,01 gegen x2,82): **+0,8 bis +1,5 h**.
  - B "Respekt bis 1,25 Mio, dann Geld: +1,0 bis +1,9 h je Knoten": mit der echten Dynamik (S1, Abschnitt 3) **+0,7 bis +1,2 h** (B's Modell sagt fuer dieselbe Runde +1,7 bis +2,6 h).
- Beide Rechnungen zaehlen nur bis Rang 25.000; die Wirkung danach (bis zum zweiten Tor) rechnet keiner.

### S5 [mittel] B: "Obergrenze 4,05 M$/s, 1e7 nicht erreichbar" ist ein Momentwert, keine Grenze
- Nachbau: 4,56 M$/s schon um 09:34 (unter Terrorism, +0,5 M$/s je Stunde); volle Ausruestung x1,81 -> 8,24 M$/s fuer 1,09 Mrd.
- Geeichte Dynamik im frischen Knoten, am Tor: S1 32,8 Mrd/h = **9,1 M$/s**, S3 56,9 Mrd/h = **15,8 M$/s**. A's BN2.1-Sim: S3 67 Mrd/h bei Tor 19:13.
- Folge: B's Zeilen "1e7 ... nicht erreichbar" in 5E sind falsch beschriftet; 5G (konstant 4,05 M$/s, keine Ausruestung) unterschaetzt das Geld: +63 Mrd gegen **+98 Mrd** (S1, Tor 13 h) bzw. +179 Mrd (S3).

### S6 [mittel] Beide: Ausruestung in der RESPEKT-Phase nicht betrachtet
- Ausruestung multipliziert die Stufe direkt (`GangMember.ts:78-85`); Terrorism gewichtet str/def/dex je 20 %. Nachbau (03:17-07:05): volle w/a/v/r-Ausruestung hebt Terrorism-Respekt und damit Faktionsruf um **x2,61 bis x3,25**; nur die Stuecke bis 25 Mio Grundpreis (130 Mio je Mitglied, 0,28-1,12 Mrd fuer alle) um x1,33-1,45.
- A's S3 kauft nur in der Geldphase (`equipRound` braucht `baseMoney > 0`), gang.js gar nicht.
- Frischer Knoten (S5, ab Gang-Alter 3 h bzw. 5 h): R 1,275 Mio nach **5,98 h / 6,63 h statt 8,62 h**, Gang-Geld am Tor 279 / 257 Mrd (13 h) gegen 179 (S3), k x6,57 / x6,51 gegen x5,96. Ausgabe in der Respekt-Phase 5,4-7,9 Mrd.
- Vorbehalt: diese Ausgabe faellt in die Zeit, in der der Bot in BN2.1 Zyklus 1 seine Rechner kaufte (Server -1,6 Mrd bei Knoten +3,9 h, -22,5 Mrd bei +12,6 h); die Konkurrenz um das fruehe Geld ist nicht modelliert. Kein Bauauftrag ohne diese Pruefung.

### S7 [niedrig] A: Abnahme "am Tor erstes Stueck Graphene Bionic Spine Upgrade, n >= 11 bei Kasse >= 300 Mrd" gilt nur in BN2.1
- Im frischen Knoten plant der Planer bis 600-1200 Mrd ohne dieses Stueck (S3). Als feste Abnahme wuerde es in BN2.2 einen Fehlalarm ausloesen.

### S8 [niedrig] A: RAM-Bedarf
- `purchaseEquipment` 4 GB + `getEquipmentCost` 2 GB stimmen (`RamCostGenerator.ts:290-293`); wird der Typ ueber die API gefiltert ("nicht Augmentation"), kommt `getEquipmentType` mit 2 GB dazu (+8 statt +6 GB). Mit fest eingetragenen Namen bleibt es bei +6.

### S9 [niedrig] B: der Anfang des Ausgangsbands ist schon ueberholt, die Aussage haelt
- B ab 09:17: Rang 400.000 zwischen 10:18 und 12:10, Ausgang 10:23-12:33. Live 09:49 Rang 236.657 und 154.000 Rang/h: 400.000 gegen 10:55 bei dieser Rate; die letzten drei Ops brauchen danach Chance >= 0,35-0,40 (jetzt 0,27-0,31, in 19 min x1,43). "Ausgang vor dem Tor 19:13" ist damit klar belegt, staerker als B es konnte.

## 3. Frischer Knoten BN2.2/2.3 (`gang-p2b-frisch.mjs`, Abschnitte F und H)

Annahmen: faction_rep 1,3281 (BN2.1 03.10. 05:33 und 19:01, NFG 3 aus SF12), Favor 0, Gang ab
Knoten +0,5 h, Bot-Kasse linear 36 Mrd bis Knoten +14,3 h (BN2.1 Zyklus 1 netto, B Abschnitt 4),
Tor bei Gang-Alter 13 h bzw. 14 h. Runde: echter Planer, nichts besessen, Operation Typhoon,
Stufen und Reaper 7 / Evasive 6 aus dem Spielstand 19:01 (Analogon des ersten Tors).

| Strategie | R erreicht (Gang-Alter) | Gang-Geld bis Tor 13 / 14 h | Kasse am Tor | k Tor 13 / 14 h | Ruf am Tor (13 h) |
|---|---|---|---|---|---|
| S0 gebaut | - | 0 / 0 | 34,0 / 36,5 Mrd | x3,21 / x3,21 | 3,23 Mio (das 2,5-fache des Bedarfs) |
| S1 R 1,275 Mio | 8,62 h | 98 / 133 Mrd | 132 / 169 | **x5,13 / x5,83** | 1,53 Mio |
| S1 R 1,6575 Mio (A's Regel) | 9,65 h | 79 / 113 | 113 / 149 | x4,76 / x5,13 | 1,87 Mio |
| S3 R 1,275 Mio | 8,62 h | 179 / 237 (Ausr. 3,97) | 209 / 270 | **x5,96 / x6,51** | 1,75 Mio |
| S5 R 1,275, Ausr. ab 3 h | 5,98 h | 279 / 341 (Ausr. 7,9 + 4,0) | 301 / 366 | x6,57 / x7,53 | 2,01 Mio |
| S5 R 1,275, Ausr. ab 5 h | 6,63 h | 257 / 318 (5,4 + 3,5) | 282 / 346 | x6,51 / x7,53 | 1,96 Mio |

Der Ruf-Bedarf der Runde ist in allen Zeilen 1,25 Mio (maxRep), auch bei 366 Mrd.

Stunden bis Rang 25.000 nach dem Tor, gegen S0 (Tor 13 h / 14 h):

| Strategie | B's Modell (mittel) | Gegenrechnung an der beobachteten Strecke |
|---|---|---|
| S1 R 1,275 | +2,26 / +2,75 h | **+0,66 bis +1,17 / +0,79 bis +1,42 h** |
| S3 R 1,275 | +2,83 / +3,14 h | **+0,80 bis +1,46 / +0,88 bis +1,61 h** |
| S5 | +3,17 / +3,60 h | +0,88 bis +1,63 / +0,98 bis +1,85 h |

Grundzeit S0 (Tor -> 25k) nach der Gegenrechnung 3,1 h (T_fix 0) bzw. 5,0 h (T_fix 3,1 h).

## 4. Korrigierte Empfehlung

1. **BN2.1: nichts fuer den Ausgang bauen.** Der Ausgang kommt deutlich vor dem Tor 19:13 (S1, S9). Wird gang.js vor dem Sprung trotzdem geaendert, dann nur, weil der Rest von BN2.1 die einzige kostenlose Gelegenheit ist, die Geldformel live zu eichen: Ruf 1,98 Mio liegt ueber jedem Bedarf, Respekt hat keinen Abnehmer mehr. Abnahme dann: `getGangInformation().moneyGainRate` gegen `gang-p2b-gegen.mjs` auf demselben Spielstand, Abweichung <= 1 % (nicht A's feste 0,9 Mio/Zyklus - der Nachbau gibt um 09:34 genau 0,912 Mio/Zyklus fuer alle 12, Mitglieder im Training druecken das).
2. **BN2.2/2.3: S1 + S3 bauen, mit R = 1,02 x maxRep der geplanten Torrunde** (BN2 frisch: 1,275 Mio), nicht A's 1,6575 Mio. Erwartung am ersten Tor: k x5,96-6,51 statt x3,21; das sind nach der Gegenrechnung **etwa +0,8 bis +1,6 h je Knoten bis Rang 25.000**, nicht +2,3 bis +3,6 h. Wirkung danach nicht gerechnet.
3. **Ausruestung in der Respekt-Phase (S5)** als naechsten Kandidaten pruefen, nicht im ersten Bau: R 2,6 h frueher und k +0,10 bis +0,15 ln gegen S3, aber 5-8 Mrd Ausgabe in der Aufbauzeit, in der der Bot sonst Rechner kauft.
4. **Abnahme am Tor knotenneutral:** erstes Stueck = erstes Stueck von `torRunde.plan`, nicht "Graphene Bionic Spine Upgrade".
5. **B's Stundenzahlen (5D/5E/5G, "+2,3 h Vorkaeufe") nicht fuer Entscheidungen verwenden**, bis das Phase-1-Modell auf die Rate nach dem Wiederaufbau geeicht ist.
6. Der Bau laeuft unbeaufsichtigt weiter, also eigener Skeptiker-Lauf vor dem Commit (globale Regel).

## 5. Gepruefte Fallen ohne Befund

- **Fundstellen**: Stichproben A/B (`Gang.ts:99-121, 125-169, 144-155, 210-216, 281-303, 392-393`, `GangMember.ts:308-319`, `formulas.ts:56-73`, `Prestige.ts:130-143`, `Action.ts:169-196`, `RamCostGenerator.ts:274-304`) stimmen.
- **BN2-Multiplikatoren**: `GangSoftcap` 1, `AugmentationMoneyCost`/`RepCost` 1; kein Knotenfaktor auf Gang-Geld oder -Respekt. B rechnet Spielerstufen mit 534,6 (`skill.ts:13`) und Hacking x0,8 - richtig; die Gang nutzt 534,5 (`GangMember.ts:71`) - im Nachbau beachtet.
- **Echtzeit gegen Spielzeit / Bonuszeit**: `storedCycles` 7 (< 10, `Constants.ts:29`), Bladeburner `storedCycles` 3; Rangraten hier aus Spielzeit (pt). Keine Bonuszeit in den Raten.
- **Ausruestung nach Aufstieg weg**: A's `ascendMember` loescht `upgrades`, baut die Mults aus den Mitglieds-Augs neu (`GangMember.ts:308-319`) - korrekt.
- **Andere-Gangs-Macht**: A's Monte Carlo ab Gruendung trifft 09:34 im Band (groesste 388 gegen P90 395, zweite 241 gegen P10-P90 225-294). Die Black Hand faellt schneller als A's Median (332 um 08:49, 241 um 09:34) - betrifft nur S2, das A ohnehin nicht empfiehlt.
- **Geldabfluss vor dem Tor**: im Gang-Modus meldet bn4rep die Kosten der geplanten Runde als Ruecklage (`bn4rep.js:1589-1592, 2284-2291`), die sechs Abnehmer bekommen nur den Rest ueber dem Plan; live 09:34 Plan 16,31 Mrd gegen Konto 17,13 Mrd. Das Gang-Geld bleibt also weitgehend fuer das Tor - nicht gemessen bei 30-60 Mrd/h Zufluss.

## 6. Offen

- Geld-Absolutwert: weiter nur Formel und Pipeline geeicht (jetzt doppelt, unabhaengig); live erst nach einem Wechsel auf Human Trafficking messbar (Empfehlung 1).
- Frischer Knoten: Torzeitpunkt (13-15 h), Basisgeld 36 Mrd und Gang-Start +0,5 h sind EIN Analogon (BN2.1 Zyklus 1). Mit Kaufaufschub und Gang-Ruecklage koennte der Bot frueh weniger Rechner kaufen und am Tor weniger als 36 Mrd haben - nicht gerechnet.
- Stunden: beide Rechnungen nur bis Rang 25.000; die Gegenrechnung setzt Rangrate ~ Competence^beta ueber die ganze Strecke an.
- S5: Konkurrenz um das fruehe Geld (Server) nicht modelliert.

## 7. Dateien und Aufrufe

- `node tools/audit/gang-p2b-gegen.mjs [spielstand.json.gz ...] [--live]` - unabhaengiger Nachbau + Eichung (Abschnitt 1a)
- `node tools/audit/gang-p2b-frisch.mjs [--only K|F|H] [--gate 13,14] [--eqh 3,5]` - Eichung ab Gruendung, frischer Knoten, Stunden (Abschnitte 1b, 3)
- Nachgefahren: `gang-p2b-calib.mjs --livefile <09:34> --log <gang-log.txt>`, `gang-p2b-sim.mjs scen --snap <09:34> --blade <09:30>`
