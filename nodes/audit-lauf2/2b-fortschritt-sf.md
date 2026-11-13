# Teil 2b - Fortschritts-Mechaniken und Source-File-Wirkungen

Stand 12.11.2026 (Systemzeit des Rechners 21:06 beim Start). Spielquelle: `reference/v301/src` (Tag v3.0.1).
Maschinenlesbar: `nodes/audit-lauf2/2b-sf-modell.json` (Eingabe fuer Teil 3). Alle Rechner liegen im
Scratchpad (`.../scratchpad/audit2b/`: `sfmod.js`, `bbmodel.js`, `cf1.js`, `cf2.js`, `bofloor.js`, `gocal.js`, `v1cf.js`,
`tables.js`, `build.js`); nichts aus `tools/`, `sync/`, `src/` wurde ausgefuehrt, kein Netz, kein Browser.

## 0. Kurzfassung (fuer das Reihenfolge-Modell)

1. **Groesster belegter Folgenutzen: SF1** (Stufe 1 gibt den Grossteil). Geeicht ist die Wirkung auf die
   Multiplikatoren (exakt), die Chancen-/Ausdauerketten (exakt/5e-5) und die V1-Hackstufe (-14..-23 % ohne SF1). In Knotenzeit gerechnet:
   V2 +0,7 / +1,4 / +2,7 h (lo/mid/hi) je Lauf allein fuer SF1.1, kumuliert SF1.3 1,1 / 2,3 / 4,6 h; dazu 32 GB statt 8 GB home.
   **Wichtigster Hebel mit groesstem Hebelarm aber UNGEEICHT: SF10.1 (Graft-API)**: Zuender 2-6 h in kurzen, 8-25 h in langen V2-Laeufen.
2. **Die drei groessten Mechanik-Hebel** (eff. Stunden je V2-Lauf, Mitte): (a) Grafting 4 h kurz / 15 h lang
   (Chance-/Aktionszeit-Kette geeicht, Knotenzeit nicht; Messindiz BN15.1->.3: eff. 68 -> 34 h, konfundiert); (b) IPvGO 2,0 h ohne SF14,
   +2,0 h mit SF14, in BN14 +5 h (Formel geeicht auf 1e-6, Spielstaerke gemessen, Knotenzeit nicht); (c) Boerse in V2 0-17 h
   (Mitte 6, Marktmodell bitgleich, Knotenzeit nicht, haengt am Geldabfluss). Sleeves 1-3 h, Hash->Rang 1,6-20 h (BN13/15), SF-Summe der Chancen-Kanaele ~5 h.
3. **Was die Laufzeitdaten NICHT trennen koennen:** jeden SF-Effekt unter ca. 5 h je Lauf. Gleiche V2-Knoten streuen
   mit CV 5-39 % (2-18 h; BN4.2 gegen 4.3, wo SF4 wirkungslos ist: 40,4 gegen 43,1 h = Rauschboden ~3 h).
   SF-Stufen, Bot-Reife, Offline-Gutschrift (V2 ~50 %), Go und Graft kamen fast immer gleichzeitig.
4. **Zwei Befunde, die Teil 3 wissen muss:** (i) Die Vorphase (Rang bis 10.000) ist chance-begrenzt und dauert 43-90 % (Mitte ~50 %)
   der Online-Zeit; Chancenfaktoren wirken nur dort und saettigen, die Kanaele sind NICHT additiv (Obergrenze = Vorphasenlaenge).
   (ii) Die 21 Black Ops haben eine Zeituntergrenze von 21-22 h bei statFac 1,3 und Overclock 0, ~1,5 h bei OC 90 und statFac 4 -
   Overclock-/Agilitaets-Aufbau (Graft!) entscheidet die Endphase, nicht die SF.

## 1. Eichung (was geeicht ist und woran)

| Groesse | Gegen was | Ergebnis |
|---|---|---|
| SF-Mults SF1 (L1,2,3), SF5 (L1,2,3), SF6 (L1), SF9 (L2,3) + Exploits (7) | 6 Staende ohne installierte Augs (`calib2`), alle 29 Mult-Felder | Abweichung **0,0** (bitgleich) |
| SF2/3/7/8/11-Mults | kein Stand ohne Aug-Einfluss mit diesen SF | **UNGEEICHT** (gleicher Codepfad, Werte = Beschreibung `BitNode.tsx`) |
| Skill-Level = floor(mult x BN-Level-Mult x (32 ln(exp+534,6) - 200)) | 33 V2-Staende x 6 Skills (`cf1`), 9 V1-Staende | Abweichung **0** |
| maxStamina (Agilitaet^0,8, Cyber's Edge, SF7/Aug-Mult) | 7 Staende BN15.3 (`calib1`) | gleich auf 4 Nachkommastellen |
| Black-Op-Chance (21 Ops, Gewichte/Decays/Skills/Team/Int) | `boChancen` des Bots im selben Stand, 7 Staende | max. Abw. **5e-5** (Rundung); Einschraenkung: Vergleichswert ist der unabhaengige Nachbau des Bots, nicht die Spiel-API |
| Go-Effekt `1 + ln(n+1)(n+1)^0,3 0,002 Power GoPower (SF14?2:1)` | 7 Staendepaare BN15.2/15.3 (`gocal`) | Abweichung **1e-6**; SF14-Faktor 2 bestaetigt |
| V1-Hackstufe mit/ohne SF | 9 Staende | Rekonstruktion exakt; Gegenfall ist Rechnung, nicht Messung |
| **Zeitverschiebung = ln(f)/g** (Chancenfaktor f, Wachstumsrate g der ln(Chance)) | g in BN2.1 gemessen 0,135-0,162 /h (Altaudit); eigene Wand-Fits ueber 15 Knoten 0,02-0,2 /h | **UNGEEICHT**: g-Spanne 0,05-0,20 /h; Gegenstimme Stanek-Modell (geeicht 8/11 Laeufen) deutlich kleiner |
| effektive V2-Stunden = online + 0,5 x offline | 8 Luecken (Teil 1) | **UNGEEICHT** (50 %, Streuung 0-100 %) |
| Graft-Preis/-Zeit | 98/99 und 96/99 gegen Spielwerte (`nodes/GRAFTING.md`) | geeicht; Knotenzeit **UNGEEICHT** |

## A. SF-Wirkungstabelle (Stufe 1/2/3)

Nutzen = effektive Knotenstunden je spaeteren Lauf der genannten Art, **zusaetzlich zur Vorstufe**, Spanne lo/mid/hi
(g = 0,20/0,10/0,05 je h). Chancenfaktor f gerechnet an vier echten Staenden (BN4.2, 7.1, 13.1, 14.1 nach ~12 h; Streuung der Faktoren < 1 %),
Gegenfall = gleiche Spielzeit ohne diese SF (Exp skaliert mit dem Exp-Mult). Die Kanaele (SF1, 6, 7, 14, Go, Graft, NFG, Int) wirken auf dieselbe
chance-begrenzte Vorphase und **addieren sich nicht** - Deckel: Vorphase (~50 % von T_V2).

| SF | Stufe 1 | Stufe 2 | Stufe 3 | Quelle | Wirkt auf | V2-Kette (f Chance; Ausdauer) | Nutzen h/Lauf L1 | +L2 | +L3 | geeicht |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | alle ~26 Mults x1,16; home 32 GB | x1,24 | x1,28 | `applySourceFile.ts:15-48`, `Prestige.ts:246-250` | V1, V2, Kaltstart, Geld, Ruf | f 1,147 / 1,221 / 1,257; maxSt x1,15/1,23/1,27; Aktionszeit x1,01-1,02 | V2 0,7 / 1,4 / 2,7; V1 (gesamt L1-3) 0,5 / 1,5 / 3; Kaltstart 0,1-0,5 | V2 0,3 / 0,6 / 1,3 | V2 0,15 / 0,3 / 0,6 | ja (Mult) |
| 2 | crime_money/-success, Charisma x1,24 | x1,36 | x1,42; (Gang woanders: Karma <= -54.000) | `applySourceFile.ts:50-62`, `PlayerObjectGangMethods.ts:12-30` | Kaltstart (Verbrechen), Gang | f ~1,00 (Charisma-Gewicht 0 bei Raid/Assassination) | 0 / 0,05 / 0,2 | ~0 | ~0 | nein |
| 3 | Charisma, work_money x1,08 | x1,12 | x1,14 + Corp-Voll-API | `applySourceFile.ts:63-75`, `PlayerObjectCorporationMethods.ts:21` | nichts messbar | f ~1,00 | 0 / 0 / 0,1 | 0 | 0 | nein |
| 4 | Singularity-RAM x16 | x4 | x1 | `RamCostGenerator.ts:82-97` | RAM-Schwelle der Autonomie | bn4rep 1006 / 260 / 73 GB; alle 10 Singularity-Skripte 1921 / 617 / 291 GB (`registry.json`); BN4 selbst immer x1 | **keine Stundenzahl: Schwelle** | | | Formel ja, Skript-RAM Registry |
| 5 | Hack-Mults x1,08 + Int dauerhaft + Formulas.exe + 300 Int-Exp je Knotenstart | x1,12 | x1,14 | `applySourceFile.ts:77-93`, `Person.ts:149-190`, `Prestige.ts:363-365` | V1; Int (alle) | V2 f 1,002-1,003; V1 Stufe -8..-12 % ohne SF5 | V2 (Int) 0,1 / 0,5 / 1,5; V1 0,2 / 0,6 / 1,2 | V1 0,1 / 0,3 / 0,6 | V1 0,05 / 0,15 / 0,3 | ja (Mult) |
| 6 | Kampf-Stufe+Exp x1,08, Division ueberall | x1,12 | x1,14 | `applySourceFile.ts:95-114` | V2 | f 1,072 / 1,107 / 1,125; maxSt x1,08/1,12/1,14 | 0,35 / 0,7 / 1,4 | 0,16 / 0,3 / 0,6 | 0,08 / 0,2 / 0,3 | ja (Mult L1) |
| 7 | bladeburner_chance/maxStamina/staminaGain/analysis x1,08 | x1,12 | x1,14 + Simulacrum bei Beitritt | `applySourceFile.ts:116-129`, `PlayerObjectBladeburnerMethods.ts:14-19` | V2 | f 1,08 / 1,12 / 1,14; maxSt x1,08/1,12/1,14; Gain x1,09/1,14/1,17 | 0,4 / 0,8 / 1,5 (Chance allein; Ausdauer extra) | 0,2 / 0,4 / 0,7 | 0,1 / 0,2 / 0,35 (+ Graft/Arbeit parallel) | nein (Wirkungskette ja) |
| 8 | WSE+TIX gratis; hacking_grow x1,12 | Leerverkauf; x1,18 | Limit/Stop; x1,21 | `applySourceFile.ts:131-143`, `StockMarket.ts:151-205`, `Prestige.ts:305-308` | Geld | - | 0 / 0,8 / 2 | 0 / 1 / 4 | 0 / 0,2 / 1 | Boersenmodell bitgleich, Zeit nein |
| 9 | Hacknet-Server frei; Hacknet x1,12 | home 128 GB am Start; x1,18 | Gratis-Server (Stufe 100, 10 Kerne) je Knotenwechsel; x1,21 | `applySourceFile.ts:145-160`, `Prestige.ts:245-251,337-348` | Kaltstart, V2 (Hash->Rang) | Gratisserver 0,48 H/s (BN13: 45 k$/s Gegenwert) | 0 / 0,2 / 1 | Kaltstart 0,2 / 0,4 / 0,7 | Kaltstart 0,1 / 0,3 / 0,6; Hash-Rang 0,04 / 1,6 / 20 (BN13/15) | Mults ja; Zeit nein |
| 10 | 1 Sleeve + Sleeve-API + **Graft-API** | 2 Sleeves | 3 Sleeves | `SleeveCovenantPurchases.tsx:58-73`, `PlayerObjectGeneralMethods.ts:577-579` | V2 | siehe Tabelle B (Graft, Sleeves) | 3 / 8 / 15 (Graft + 1 Sleeve) | 0,3 / 0,7 / 1 | 0,3 / 0,7 / 1 | Preise ja; Zeit nein |
| 11 | company x1,32; Augpreis-Treppe 1,9 -> 1,824 | x1,48; 1,786 | x1,56; 1,767 | `applySourceFile.ts:166-178`, `AugmentationHelpers.ts:29-31` | Geld (Augkauf) | Gesamtpreis von 6 Augs je Zyklus x0,85/0,78/0,75; 12 Augs x0,67/0,55/0,49; 30 x0,32/0,18/0,13 | 0,1 / 0,3 / 0,8 | 0,05 / 0,15 / 0,4 | 0,02 / 0,05 / 0,15 | Summe gerechnet |
| 12 | NFG-Start 1 (x1,0100 auf 26 Mults, nicht BB) | 2 | 3 (x1,0303) | `Prestige.ts:264-271` | alle | f 1,009 je Stufe | 0,05 / 0,1 / 0,2 je Stufe | | | NFG exakt (Teil 2 vom 03.10.) |
| 13 | Stanek-Gitter +1 Zelle | +2 | +3 | `StaneksGift.ts:22-31` | nur Stanek (verworfen) | - | 0 / 0,2 / 1 | | | Stanek-Modell bitgleich |
| 14 | Go-Bonus x2 (jeder Gegner), Favor-Deckel 200k | go.cheat-API, 300k | +25 % Cheat-Chance, 400k | `Go/effects/effect.ts:14-47`, `netscriptGoImplementation.ts:486-567` | V2 (Tetrads), V1 (Daedalus, ungenutzt) | Tetrads bei nodePower 1e5: x1,51 -> x2,02; f(3e4) = 1,217 | 1,0 / 2,0 / 3,9 | 0,1 / 0,5 / 1 (cheat: +20-30 % NodePower je Aktion, gemessen) | 0 / 0,1 / 0,3 | ja (Effekt 1e-6) |
| 15 | TOR+Darkscape ab Start, volles Darkweb | Charisma -> Firma x1,018 (c=135), Auth -20 % | Charisma -> Hacking-Ruf (+~1 %), Cache +50 % | `DarkNet/effects/effects.ts:80,105-110`, `Work/Formulas.ts:130-134`, `reputation.ts:54-60` | nichts | f ~1,00 | 0 / 0,05 / 0,2 | ~0 | ~0 | Formel |

**Art des Laufs, der profitiert** (Kurzform fuer Teil 3): V1 (BN1/5/8/12): SF1, SF5, (SF8/SF14 ungenutzt); V2: SF1, 6, 7, 14, 10, 9.3, 11, 12, Int(5), Boerse(8); Kaltstart: SF1 (32 GB), SF9.2/9.3, SF2; Geld: SF8, SF11, SF1, SF9; Ruf: SF1 (faction_rep x1,28),
Go-Daedalus; Rang: Hash (SF9.3), Sleeves/Graft ueber Chance. **SF2, 3, 13, 15 haben praktisch keinen Folgenutzen** (nur das Ziel "alle auf 3"): ihre Knoten
koennen frei nach Schwierigkeit gelegt werden. BN15 (BB-Rang 0,2, Skillpreis 3) und BN7/9/10 sind die schweren Laeufe: spaet, wenn SF1/6/7/10/14 und Graft/Go da sind.

### A.1 Messung aus dem echten Lauf (vorher/nachher) - und ehrlich: wo die Daten nicht trennen

Effektive V2-Stunden (online + 0,5 x Offline) und SF-Stand siehe Tabelle M am Ende. Vergleiche, die moeglich sind:

| Vergleich | Was sich aenderte | eff. h | Lesart |
|---|---|---|---|
| BN4.2 -> BN4.3 | SF4 (in BN4 immer x1, also wirkungslos), Bot wenig | 40,4 -> 43,1 | **Rauschboden ~3 h** |
| BN6.2 -> BN6.3 | SF6 L1 -> L2 (+4 % Chance) | 22,3 -> 24,0 | nicht nachweisbar |
| BN7.1 -> .2 -> .3 | SF7 0 -> 1 -> 2 (+8 %, +12 %, Ausdauer) | 63,9 -> 54,8 -> 67,5 | nicht nachweisbar (Teil 1 C10 offen) |
| BN9.1 -> .2 -> .3 | SF9 1 -> 2 (128 GB), 2 -> 3 (Gratisserver in BN9 immer) | 69,1 -> 65,8 -> 50,1 | -19 h insgesamt, nicht von Bot-Lernen trennbar |
| BN2.1 -> .2 -> .3 | SF2 (~0), Gang gebaut | 26,5 -> 17,9 -> 14,5 | Gang/Bot, nicht SF |
| BN3.1 -> .2 -> .3 | SF3 (~0) | 14,6 -> 17,8 -> 27,4 | steigt trotz "mehr SF": Rauschen/Corp |
| BN13.1 -> .2 -> .3 | SF13 (~0), Go, bn13rang | 45,2 -> 48,8 -> 29,4 | Go/Rang-Fix, nicht SF |
| BN15.1 -> .2 -> .3 | Go (ab ~24 h in .2), Graft (ab ~25 h in .2, ab ~8 h in .3), SF15 L1/L2 | 68,0 -> 39,1 -> 33,7 | groesster Sprung; Go+Graft vermutet, aber 65 h Offline in .1 (Gutschrift ungeeicht) |
| V1: BN1.1 -> 1.2 -> 1.3 | SF1.0 -> 1 -> 2 (+ SF4/5/6/9/10 sprunghaft) | >=25 -> 11,8 -> 12,7 online | nicht trennbar |

Online-Rangkurven (nur 13.2 bis 15.3 vorhanden, `dashboard-history.json`, online h bis Rang 1.000 / 10.000 / 30.000 / 100.000 / Ende):
13.2 1,8 / 14,9 / 25,7 / 31,8 / 32,3; 13.3 4,8 / 14,5 / 20,2 / 26,5 / 28,9; 15.1 6,8 / 14,3 / 30,4 / 33,1 / 33,6; 15.2 16,2 / 31,8 / 32,9 / 35,0 / 35,3; 15.3 9,1 / 21,9 / 29,0 / 32,9 / 33,2.
Online-Zeit allein taeuscht in 15.1 (65 h Offline mit teilweiser Gutschrift): 15.3 war bei Rang 10.000 spaeter als 15.1 (21,9 gegen 14,3 online h),
holte aber ueber die Wanduhr auf. Dasselbe Bild: Vorphase 43-90 % der Online-Zeit.

**Sleeves** (Task-Hinweis "Sleeve 2 ab 06.09., Sleeve 3 ab 09.09."): laut Spielstaenden hatte BN10.2 (ab 01.09.) 2, BN10.3 (ab 06.09.) 3 Sleeves
(`min(3, SF10 + 1 in BN10)`). Laufzeiten 10.1 / 10.2 / 10.3 (V2): 94,9 / 116,5 / 97,3 h Wanduhr, 48 h online nur in .3: **keine Trennung moeglich**
(Sleeve-Code und Zuordnung kamen im selben Zeitraum, Teil 1 C2).

**SF4.2/4.3, SF9.2/9.3:** nur als RAM-/Autonomie-Schwellen belegbar, nicht als Laufzeit: Teil 1 C9 (Bot bis 02.09. in keinem Uebergang autonom).

## B. Mechaniken

Spalten: Mechanik | verfuegbar ab | vom Bot genutzt ab | Wirkung (Formel, Datei:Zeile) | Nutzen in Lauf 2 in h (lo/mid/hi, Uhr = eff. V2-h je Lauf) | geeicht | Bauaufwand | Empfehlung.

| Mechanik | verfuegbar ab | Bot ab | Wirkung | Nutzen Lauf 2 (h) | geeicht | Aufwand | Empfehlung |
|---|---|---|---|---|---|---|---|
| **Grafting (Zuender)** | SF10>=1 oder BN10 (BN10.1, 28.08.) | Code 30.08.; Zuender 04.09.-07.11. zurueckgehalten (64 Tage); gezuendet 07.11. 18:32 (BN15.2) | Preis baseCost x 3, ohne BN-Aufschlag/Ruf/Treppe (`GraftableAugmentation.ts:21`); sofort, kein Reset (`GraftingWork.tsx:48-64`); Entropie 0,98^n auf ALLE Mults inkl. bladeburner_* (`EntropyAccumulation.ts:6-47`); Zeit ((1 h x log2(Summe Mults!=1) + 30 min)/2)/(1+Int^0,8/600)/Fokus (0,8 ohne NMI); Plan 40 Grafts 415 Mrd 31 h, Kampf x69; erste 8: 80 Mrd, 10 h, competence x5,15; **gemessen BN15.3: strength-Mult 18 -> 431 (inkl. Go), Chance Operation Tyrell 4,3 % -> 98,7 % in 4 h (16:00-20:00 am 09.11.), Entropie 23** | kurze V2 (BN2/3/6/11/14): 2 / 4 / 6; lange (BN4/7/9/13/15): 8 / 15 / 25. **Retrospektiv 04.09.-07.11. (25 V2-Laeufe): 120 / 220 / 360 h** | Preis/Zeit/Chance ja; Knotenzeit nein (Indiz BN15.1->.3 68 -> 34 h, konfundiert) | gebaut (`graftauto.js`); offen: Congruity-Entscheid, Planstopp (AUG-2), Geld | ab erstem V2-Lauf mit SF10.1; SF10.1 frueh; zuerst die ~8 guenstigen (80 Mrd), Plan-Tail (Vangelis, Lumin) streichen; mit SF7.3 laeuft blade.js neben dem Graft |
| **Sleeves** | BN10.1 (1), Anzahl min(3, SF10 + [BN10]) | `sleeve.js` ab BN10; Infiltrate nur halb, Diplomacy nie | Vertraege 29-34 Rang/h je Sleeve (Kampf 40); Infiltrate +30/42/52 Raid-Vorrat je h (`SleeveInfiltrateWork.ts:7-28`, `Bladeburner.ts:1251-1263`); Diplomacy -1,03 %/min Chaos; LP 1 Infiltrate + 2 Diplomacy 328 Rang/h gegen 211 (+55 %); Schock skaliert Sleeve-Exp/-Ruf, nicht BB-Rang; Gym bis Kampf 40: 3,9/5,6/8,4 h (BN-LM 1/0,7/0,5) | alle drei 1 / 2 / 3; je Sleeve 0,3 / 0,7 / 1 | Raten/Chaos ja (inventar-sleeve), Knotenzeit nein | klein (SLEEVE-1/2/3) | Infiltrate/Diplomacy ohne Kampfwert-Schwelle; Sleeve-Augs nie; Covenant nur BN10 (nicht auf Route) |
| **IPvGO** | Spielstart (kein SF); go.cheat SF14.2 | go.js 27.10. (BN13/14); BN15 07.11. | effect = 1 + ln(n+1)(n+1)^0,3 x 0,002 x Power x GoPower x (SF14>=1 ? 2 : 1) (`effect.ts:19-24`); Tetrads (0,7) Kampf, Daedalus (1,1) Ruf, Black Hand (0,9) Hackgeld, Illuminati (0,7) Tempo, w0r1d_d43m0n (2,0) Hack-Stufe, Netburners 1,3, Slum Snakes 1,2; nodePower +15,6 k/h (BN15.3 gemessen), Reset je Einbau; Tetrads 1e5: x1,51 / x2,02 (SF14) / BN14 x3,04 / x5,08. Gegner-Tabelle in JSON `go` | ohne SF14 gegen kein Go: 0,8 / 2,0 / 4,8; SF14-Zuschlag 1,0 / 2,0 / 3,9; BN14-Zuschlag 2 / 5 / 9 | Effekt ja (1e-6), Spielstaerke gemessen (592:4), Knotenzeit nein | gebaut | Go ab BN1; SF14 vor BN13/15; Gegner je Knoten (Daedalus in V1/BN8, w0r1d_d43m0n nach TRP ungeprueft) |
| **Stanek** | BN13.1 (27.10.), SF13 | nie (verworfen 27.10.) | Genesis x0,9 auf Hack/Kampf/Ruf/Geld (nicht BB); Kampf netto x1,13 (H16) .. x1,5; Gitter 30/36/42/49; Wirkung `1 + ln(H+1)/60 ((n+1)/5)^0,07 Power Boost 2` | -1 / 0,5 / 2 (Modell: -0,6..-3,8 % bis Rang 400k = 0,3-1,7 h; minus Genesis-Hackgeld -25..-35 % geschaetzt) | Formel bitgleich; Rangmodell 8/11; Zeit nein | hoch | **Verwerfen bestaetigt** (<= 2 %). Neu pruefen nur bei BN13.1: Rang < 2.000 bei h12 UND Chance < 0,5 (BN13.3 lag 0,25-0,53 bis h12) |
| **Intelligence** | SF5>=1 oder BN5 (sonst Int = 0, `Person.ts:154-159`) | Nebenprodukt seit 24.08. | Skill = floor(32 ln(exp+534,6) - 200) (exakt); Bonus 1 + w Int^0,8/600: BB-Chance w 0,75, Hack/Ruf 1, Graftzeit, Share 2; persistent ueber Einbau und Knoten; Quellen: BN-Abschluss 300 (nur mit SF5), Aug-Kauf/Einbau 15, Beitritt 7,5, BB-Aktion 0,003 x t x diffMult x 0,1. Bot: 112 k Exp in 44 Laeufen = Int 172; Exp fuer Int 50/76/100/118/152/172 = 1,9 k/5,0 k/11,3 k/20,2 k/59,3 k/111,3 k | Int 50: 0,3 / 0,6; Int 118: 0,6 / 1,1; Int 172: 0,7 / 1,5 (lo ... hi, mid ~0,3/0,6/0,7) | Formel ja | keiner | SF5.1 frueh (sonst verfaellt Int-Exp); kein gezieltes Farmen (< 1 h/Lauf) |
| **Darknet / Labyrinth / SF15** | BN15.1 02.11.; SF15.1 06.11. | Nebengewerk verworfen 02.11. | SF15.2/3: Charisma 135 -> x1,018 Firma, +~1 % Hack-Ruf; Labyrinth-TRP nur BN15; DarknetMoney je BN (C3) | 0 / 0,05 / 0,3 | Formel | hoch | nicht bauen; BN15 spaet |
| **Bladeburner Skills/Ops (Luecken)** | Division ab Kampf 100 | blade.js 25.08. | **Black-Op-Zeituntergrenze** = Summe baseDifficulty/10 x 1,5 x (1-0,01 OC)/statFac = 21-22 h bei statFac 1,2-1,3, OC 0; ~1,5 h bei OC 90, statFac 4 (statFac = 0,5(agi^0,04 + dex^0,035 + agi/1e4 + dex/1e4), `Action.ts:105-122`). Overclock 90 = 5.877 SP x Skillpreis (BN15 17.631 SP = 52.900 Rang). 15.1: OC 0-9 bis h65; 15.3 mit Graft statFac 5 bei h26 | 0 / 1 / 3 | Formel (statFac aus Staenden), Dauer nicht gemessen | klein | kein Umbau; Overclock-Vorrang in BN7/13/14/15 (Skillpreis >= 2) pruefen |
| **NeuroFlux / SF12** | ab Faktion; SF12 gibt Start | seit Beginn | je Stufe x1,01000262 auf 26 Mults (nicht BB); Kosten x2,166 je Stufe (1,14 x 1,9); SF12.3 = x1,0303 gratis | 0,14 / 0,27 / 0,55 | exakt (< 1e-9) | keiner | keine Aenderung; SF12 nicht weiter levelln (BN12 +2 %/Stufe) |
| **Besondere Augs** | je Faktion | kauft nach Plan | Ruf: BigD x2, SmartJaw x1,25, ADR2 x1,2, SNA/Shadows Simulacrum x1,15, ADR1 x1,1, PCMatrix x1,078; BB-Chance: Omnibeam x1,10, Unibeam/Hyperion V2 x1,08, V1/Energy Shielding x1,06, Power Cells/Vangelis 3.0 x1,05; INTERLINKED maxSt x1,10; Simulacrum (Arbeit parallel), NMI (kein Fokusmalus), violet Congruity (150 Bio, Entropie 0); BB-Augs graftbar. Werte v301; im laufenden Spiel weichen 3 Augs ab | in Grafting enthalten | Tabelle v301; GRAFTING.md | - | BB-Augs graften statt kaufen; Ruf-Verstaerker nur in V1 mit Ruf-Engpass |


## C. BitNode-Multiplikatoren je Knoten (Datenbasis fuer Teil 3)

Quelle: `reference/v301/src/BitNode/BitNode.tsx:570-1119` (`getBitNodeMultipliers`), Vorgabewerte `BitNodeMultipliers.ts`. Die Funktion wurde
**ausgefuehrt** (Quelltext herausgeschnitten, nicht abgeschrieben: `bnmults.js`). Eichung der sechs **Level-Multiplikatoren** (Hacking, Staerke,
Defense, Dexterity, Agility, Charisma): Skill-Rekonstruktion in 258 Staenden x 6 Skills = 1.548 Pruefungen aller 15 Knoten, **0 Abweichungen**.
Alle anderen Spalten (Geld, Ruf, Preise, Corp, Gang, Go, Stanek) sind Quellwerte, **nicht** gegen den laufenden Spielstand geprueft
(das Altaudit verglich `src/lib/bitnodes.json` mit 3.0.2: 0 Abweichungen; v3.0.1 und 3.0.2 unterscheiden sich u. a. in BN13 `CharismaLevelMultiplier`
0,7 nur in 3.0.2). Nur BN12 haengt von der Stufe ab (`1,02^Stufe`; die Funktion bekommt `SF12-Stufe + 1`, also Stufe 1..3 fuer die drei Laeufe).

Die Zahl ist der Multiplikator auf die jeweilige Groesse; "." = Vorgabewert (1; Daedalus-Augs 30; Stanek-Groesse 0).
BB-Rang gilt nur auf Gewinn (`Formulas.ts:9-44`), Skillpreis auf jeden SP-Kauf (`Skill.ts:37-81`). `ClassGymExpGain` ist im Spiel TOT (nirgends angewandt).
Corp/Gang-Spalten wirken nur, wo der Bot das Gewerk nutzt (BN2 Gang; sonst nicht).

### C1 Bladeburner, Level, Augs, Ruf

| BN | BB-Rang | BB-Skillpreis | Hack-Lvl | Str-Lvl | Def-Lvl | Dex-Lvl | Agi-Lvl | Cha-Lvl | Aug-Geld | Aug-Ruf | Fakt-Arbeit-Ruf | Fakt-Passivruf | Daedalus-Augs | WDD | Hack-Exp |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BN1 | . | . | . | . | . | . | . | . | . | . | . | . | . | . | . |
| BN2 | . | . | 0.8 | . | . | . | . | . | . | . | 0.5 | 0 | . | 5 | . |
| BN3 | . | . | 0.8 | . | . | . | . | . | 3 | 3 | . | . | . | 2 | . |
| BN4 | . | . | . | . | . | . | . | . | . | . | 0.75 | . | . | 3 | 0.4 |
| BN5 | . | . | . | . | . | . | . | . | 2 | . | . | . | . | 1.5 | 0.5 |
| BN6 | . | . | 0.35 | . | . | . | . | . | . | . | . | . | 35 | 2 | 0.25 |
| BN7 | 0.6 | 2 | 0.35 | . | . | . | . | . | 3 | . | . | . | 35 | 2 | 0.25 |
| BN8 | 0 | . | . | . | . | . | . | . | . | . | . | . | . | . | . |
| BN9 | 0.9 | 1.2 | 0.5 | 0.45 | 0.45 | 0.45 | 0.45 | 0.45 | . | . | . | . | . | 2 | 0.05 |
| BN10 | 0.8 | . | 0.35 | 0.4 | 0.4 | 0.4 | 0.4 | 0.4 | 5 | 2 | . | . | . | 2 | . |
| BN11 | . | . | 0.6 | . | . | . | . | . | 2 | . | . | . | . | 1.5 | 0.5 |
| BN12 (Stufe 3) | 0.9423 | 1.0612 | 0.9423 | 0.9423 | 0.9423 | 0.9423 | 0.9423 | 0.9423 | 1.0612 | 1.0612 | 0.9423 | 0.9423 | 31 | 1.0612 | 0.9423 |
| BN13 | 0.45 | 2 | 0.25 | 0.7 | 0.7 | 0.7 | 0.7 | . | . | . | 0.6 | . | . | 3 | 0.1 |
| BN14 | 0.6 | 2 | 0.4 | 0.5 | 0.5 | 0.5 | 0.5 | . | 1.5 | . | 0.2 | . | . | 5 | . |
| BN15 | 0.2 | 3 | 0.6 | 0.7 | 0.7 | 0.7 | 0.7 | 1.1 | 3 | . | . | . | 20 | 2 | . |

### C2 Server, Geld, Hacknet

| BN | Skript-Hackgeld | Hackgeld-Gain | Manuell-Hackgeld | Server-MaxGeld | Server-Startgeld | Wachstum | Weaken | Start-Sec | Hack-Tempo | Heim-RAM-Preis | Cloud-Preis | Cloud-Limit | Cloud-MaxRAM | Cloud-Softcap | Hacknet-Geld |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BN1 | . | . | . | . | . | . | . | . | . | . | . | . | . | . | . |
| BN2 | . | . | . | 0.08 | 0.4 | 0.8 | . | . | . | . | . | . | . | 1.3 | . |
| BN3 | 0.2 | . | . | 0.04 | 0.2 | 0.2 | . | . | . | 1.5 | 2 | . | . | 1.3 | 0.25 |
| BN4 | 0.2 | . | . | 0.1125 | 0.75 | . | . | . | . | . | . | . | . | 1.2 | 0.05 |
| BN5 | 0.15 | . | . | . | 0.5 | . | . | 2 | . | . | . | . | . | 1.2 | 0.2 |
| BN6 | 0.75 | . | . | 0.2 | 0.5 | . | . | 1.5 | . | . | . | . | . | 2 | 0.2 |
| BN7 | 0.5 | . | . | 0.2 | 0.5 | . | . | 1.5 | . | . | . | . | . | 2 | 0.2 |
| BN8 | 0.3 | 0 | 0 | . | . | . | . | . | . | . | . | . | . | 4 | 0 |
| BN9 | 0.1 | . | . | 0.01 | 0.1 | . | . | 2.5 | . | 5 | . | 0 | . | . | . |
| BN10 | 0.5 | . | 0.5 | . | . | . | . | . | . | 1.5 | 5 | 0.6 | 0.5 | 1.1 | 0.5 |
| BN11 | . | . | . | 0.01 | 0.1 | 0.2 | 2 | . | . | . | . | . | . | 2 | 0.1 |
| BN12 (Stufe 3) | 0.9423 | . | 0.9423 | 0.888 | 0.9423 | 0.9423 | 0.9423 | 1.5 | . | 1.0612 | 1.0612 | 0.9423 | 0.9423 | 1.0612 | 0.9423 |
| BN13 | 0.2 | . | . | 0.3375 | 0.75 | . | . | 3 | . | . | . | . | . | 1.6 | 0.4 |
| BN14 | 0.3 | . | . | 0.7 | 0.5 | . | . | 1.5 | 0.3 | . | . | . | . | . | 0.25 |
| BN15 | . | . | . | 0.8 | 0.5 | . | . | 1.5 | 0.6 | . | . | . | . | . | . |

### C3 Nebengeld, Boerse, Darknet

| BN | Contract-Geld | Firma-Geld | Firma-Ruf | Firma-Exp | Verbrechen-Geld | Verbrechen-Exp | Verbrechen-Chance | Infiltr-Geld | Infiltr-Ruf | 4S-Daten | 4S-API | Gym-Exp (TOT) | Spende-Favor | Darknet-Geld | Labyrinth-TRP |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BN1 | . | . | . | . | . | . | . | . | . | . | . | . | . | . | . |
| BN2 | . | . | . | . | 3 | . | . | 3 | . | . | . | . | . | . | . |
| BN3 | . | 0.25 | . | . | 0.25 | . | . | . | . | . | . | . | 0.5 | 0.4 | . |
| BN4 | . | 0.1 | . | 0.5 | 0.2 | 0.5 | . | . | . | . | . | 0.5 | . | 0.4 | . |
| BN5 | . | . | . | . | 0.5 | . | . | 1.5 | 1.5 | . | . | . | . | 0.7 | . |
| BN6 | . | 0.5 | . | . | 0.75 | . | . | 0.75 | . | . | . | . | . | . | . |
| BN7 | . | 0.5 | . | . | 0.75 | . | . | 0.75 | . | 2 | 2 | . | . | . | . |
| BN8 | 0 | 0 | . | . | 0 | . | . | 0 | . | . | . | . | 0 | 0 | 0 |
| BN9 | . | . | . | . | 0.5 | . | . | . | . | 5 | 4 | . | . | 0.05 | . |
| BN10 | 0.5 | 0.5 | . | . | 0.5 | . | . | 0.5 | . | . | . | . | . | 0.4 | . |
| BN11 | 0.25 | 0.5 | . | . | 3 | . | . | 2.5 | 2.5 | 4 | 4 | . | . | . | . |
| BN12 (Stufe 3) | 0.9423 | 0.9423 | . | 0.9423 | 0.9423 | 0.9423 | . | 0.9423 | 0.9423 | 1.0612 | 1.0612 | 0.9423 | 1.0612 | 0.9423 | . |
| BN13 | 0.4 | 0.4 | . | 0.5 | 0.4 | 0.5 | . | . | . | 10 | 10 | 0.5 | . | 0.1 | . |
| BN14 | . | . | 0.2 | . | 0.75 | . | 0.4 | 0.75 | . | . | . | . | . | . | . |
| BN15 | . | . | . | . | . | . | . | . | . | . | . | . | . | . | . |

### C4 Corp, Gang, Go, Stanek

| BN | Corp-Wert | Corp-Softcap | Corp-Divisionen | Gang-Softcap | Gang-Augs | GoPower | Stanek-Power | Stanek-Groesse |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BN1 | . | . | . | . | . | . | . | . |
| BN2 | . | 0.9 | 0.9 | . | . | . | 2 | -6 |
| BN3 | . | . | . | 0.9 | 0.5 | . | 0.75 | -2 |
| BN4 | . | . | . | . | 0.5 | . | 1.5 | . |
| BN5 | 0.75 | . | 0.75 | . | 0.5 | . | 1.3 | . |
| BN6 | 0.2 | 0.9 | 0.8 | 0.7 | 0.2 | . | 0.5 | 2 |
| BN7 | 0.2 | 0.9 | 0.8 | 0.7 | 0.2 | . | 0.9 | -1 |
| BN8 | 0 | 0 | 0 | 0 | 0 | . | . | -99 |
| BN9 | 0.5 | 0.75 | 0.8 | 0.8 | 0.25 | . | 0.5 | 2 |
| BN10 | 0.5 | 0.9 | 0.9 | 0.9 | 0.25 | . | 0.75 | -3 |
| BN11 | 0.1 | 0.9 | 0.9 | . | 0.75 | . | . | . |
| BN12 (Stufe 3) | 0.9423 | 0.8 | 0.5 | 0.8 | 0.9423 | . | 1.0612 | 1.0612 |
| BN13 | 0.001 | 0.4 | 0.4 | 0.3 | 0.1 | . | 2 | 1 |
| BN14 | 0.4 | 0.9 | 0.8 | 0.7 | 0.4 | 4 | 0.5 | -1 |
| BN15 | 0.2 | 0.4 | 0.4 | . | 0.3 | . | 0.7 | -2 |

("." = Vorgabewert 1, Daedalus-Augs 30, Stanek-Groesse 0.)

BN12 je Stufe (1,02^Stufe): S1: Hack-Lvl 0.9804, Aug-Geld 1.02, BB-Rang 0.9804, Skillpreis 1.02, WDD 1.02 | S2: Hack-Lvl 0.9612, Aug-Geld 1.0404, BB-Rang 0.9612, Skillpreis 1.0404, WDD 1.0404 | S3: Hack-Lvl 0.9423, Aug-Geld 1.0612, BB-Rang 0.9423, Skillpreis 1.0612, WDD 1.0612 | S4: Hack-Lvl 0.9238, Aug-Geld 1.0824, BB-Rang 0.9238, Skillpreis 1.0824, WDD 1.0824

### Overclock-90-Preis je Knoten (Skill.ts:37-81: Summe (3 + 1,4 L) x BladeburnerSkillCost)

| BN | Skillpreis | Skillpunkte | Rang dafuer (3 Rang je SP) |
|---|---:|---:|---:|
| BN1 | 1 | 5877 | 17631 |
| BN2 | 1 | 5877 | 17631 |
| BN3 | 1 | 5877 | 17631 |
| BN4 | 1 | 5877 | 17631 |
| BN5 | 1 | 5877 | 17631 |
| BN6 | 1 | 5877 | 17631 |
| BN7 | 2 | 11754 | 35262 |
| BN8 | 1 | 5877 | 17631 |
| BN9 | 1.2 | 7052 | 21157 |
| BN10 | 1 | 5877 | 17631 |
| BN11 | 1 | 5877 | 17631 |
| BN12 | 1.02 | 5995 | 17984 |
| BN13 | 2 | 11754 | 35262 |
| BN14 | 2 | 11754 | 35262 |
| BN15 | 3 | 17631 | 52893 |

## D. Folgerungen fuer das Reihenfolge-Modell (Teil 3) - Hypothesen, keine Beschluesse

1. **Vorziehen lohnt (hoher Hebel je Stufe-1):** SF1 (alle Laeufe, dazu 32 GB home), SF5.1 (sonst verfaellt Int-Exp, Int-Bonus waechst nur mit Sammelzeit),
   SF4.2/4.3 (Bot-RAM: bn4rep 1006 -> 260 -> 73 GB; BN4 selbst ist x1 und kann als Bot-Probelauf dienen), SF10.1 (Graft-API ist der groesste, ungeeichte Hebel),
   SF14.1 vor BN13/BN15 (verdoppelt jeden Go-Bonus). Danach sinkt der Grenznutzen je Stufe stark (SF1: 0,7 / 0,3 / 0,15 h je V2-Lauf, SF6/SF7 analog).
2. **Spaet fahren:** schwere V2-Laeufe mit kleinem BB-Rang oder grossen Faktoren (BN15: Rang 0,2, Skillpreis 3; BN7: 0,6 / 2, Augs x3; BN9: Level 0,45, Heim-RAM x5;
   BN10: Augs x5, Cloud x5; BN13: Rang 0,45, Hack-Level 0,25), weil dort jede Chance-/Graft-/Go-Verbesserung am meisten Stunden spart (lange Vorphase).
3. **Frei nach Schwierigkeit legbar:** BN2, 3, 13, 15 (SF2/3/13/15 ohne Folgenutzen). BN8 (V1, Boerse): SF8.1 spart nur WSE/TIX; Boerse in V2 braucht keinen SF8 fuer Long (TIX-API 5 Mrd kaufbar).
4. **Kaltstart-Hebel** (je Knotenwechsel, einmalig): SF9.2 (128 GB) 0,2-0,7 h, SF9.3 (Gratis-Server) 0,1-0,6 h, SF1 0,1-0,5 h - jeweils mal ~40 Knotenstarts; klein, aber ueber alle Laeufe.
5. **Uhr:** V2 = Wanduhr mit ~50 % Offline-Gutschrift (Tabelle M); V1 = Online-Zeit. Die Zeitverschiebungen oben sind **Online-/effektive Stunden der Vorphase**, nicht Wanduhr.
6. **Nicht additiv:** Alle Chancen-Kanaele (SF1, 6, 7, 14, Go, Graft, NFG, Int) wirken in derselben chance-begrenzten Vorphase (43-90 %, Mitte ~50 % der Online-Zeit). Summe nie ueber Vorphasenlaenge x (1 - 1/f_gesamt). Beispiel: f_gesamt aus SF1.3 x SF6.3 x SF7.3 x Go(SF14) ~ 1,26 x 1,13 x 1,14 x 1,22 = 1,96, ln = 0,67; bei g = 0,10 sind das 6,7 h, bei g = 0,05 13,5 h
   (Deckel: Vorphase 15-30 h).
7. **Messen vor Entscheiden:** C2/C10 aus Teil 1 bleiben offen. Sinnvoller Test im Lauf 2: BN4.x-Paare (SF4 wirkungslos) als **Nullprobe** (Rauschboden ~3 h) und je Knoten nur EINE Aenderung je Lauf.

## M. Effektive Laufzeiten (Eingabe fuer Teil 3; V2: online + 0,5 x offline, UNGEEICHT)

Streuung gleicher V2-Knoten (eff. h): BN2 26,5/17,9/14,5 (CV 0,32); BN3 14,6/17,8/27,4 (0,33); BN4 40,4/43,1 (0,05); BN6 22,3/24,0 (0,05); BN7 63,9/54,8/67,5 (0,11);
BN9 69,1/65,8/50,1 (0,16); BN11 23,4/23,5/27,4 (0,09); BN13 45,2/48,8/29,4 (0,25); BN14 34,4/24,1/22,3 (0,24); BN15 68,0/39,1/33,7 (0,39).

| Lauf | Verf. | Wanduhr h | online h | eff. V2-h (online + 0,5 x Offline) | SF bei Start |
|---|---|---:|---:|---:|---|
| 1.1 | V1 | 46.13 | ? | - |  |
| 4.1 | V1 | 48.59 | ? | - | 1:1 |
| 5.1 | V1 | 28.06 | ? | - | 1:1 4:1 |
| 6.1 | V2 | 91.72 | ? | - | 1:1 4:1 5:1 |
| 10.1 | V2 | 94.9 | ? | - | 1:1 4:1 5:1 6:1 |
| 10.2 | V2 | 116.54 | ? | - | 1:1 4:1 5:1 6:1 10:1 |
| 10.3 | V2 | 97.34 | 48.04 | 72.7 | 1:1 4:1 5:1 6:1 10:2 |
| 4.2 | V2 | 47.18 | 33.57 | 40.4 | 1:1 4:1 5:1 6:1 10:3 |
| 4.3 | V2 | 52 | 34.19 | 43.1 | 1:1 4:2 5:1 6:1 10:3 |
| 9.1 | V2 | 104.11 | 34.15 | 69.1 | 1:1 4:3 5:1 6:1 10:3 |
| 9.2 | V2 | 81.72 | 49.8 | 65.8 | 1:1 4:3 5:1 6:1 9:1 10:3 |
| 9.3 | V2 | 53.57 | 46.58 | 50.1 | 1:1 4:3 5:1 6:1 9:2 10:3 |
| 1.2 | V1 | 19.54 | 11.82 | - | 1:1 4:3 5:1 6:1 9:3 10:3 |
| 1.3 | V1 | 12.69 | 12.69 | - | 1:2 4:3 5:1 6:1 9:3 10:3 |
| 5.2 | V1 | 19.93 | 19.93 | - | 1:3 4:3 5:1 6:1 9:3 10:3 |
| 5.3 | V1 | 46.77 | 19.27 | - | 1:3 4:3 5:2 6:1 9:3 10:3 |
| 12.1 | V1 | 48.8 | 11.97 | - | 1:3 4:3 5:3 6:1 9:3 10:3 |
| 12.2 | V1 | 24.24 | 12.25 | - | 1:3 4:3 5:3 6:1 9:3 10:3 12:1 |
| 12.3 | V1 | 32.3 | 13.66 | - | 1:3 4:3 5:3 6:1 9:3 10:3 12:2 |
| 2.1 | V2 | 29.94 | 23.15 | 26.5 | 1:3 4:3 5:3 6:1 9:3 10:3 12:3 |
| 2.2 | V2 | 20.44 | 15.43 | 17.9 | 1:3 2:1 4:3 5:3 6:1 9:3 10:3 12:3 |
| 2.3 | V2 | 14.5 | 14.5 | 14.5 | 1:3 2:2 4:3 5:3 6:1 9:3 10:3 12:3 |
| 3.1 | V2 | 21.72 | 7.41 | 14.6 | 1:3 2:3 4:3 5:3 6:1 9:3 10:3 12:3 |
| 3.2 | V2 | 22.74 | 12.92 | 17.8 | 1:3 2:3 3:1 4:3 5:3 6:1 9:3 10:3 12:3 |
| 3.3 | V2 | 35.92 | 18.91 | 27.4 | 1:3 2:3 3:2 4:3 5:3 6:1 9:3 10:3 12:3 |
| 11.1 | V2 | 28.51 | 18.28 | 23.4 | 1:3 2:3 3:3 4:3 5:3 6:1 9:3 10:3 12:3 |
| 11.2 | V2 | 23.54 | 23.54 | 23.5 | 1:3 2:3 3:3 4:3 5:3 6:1 9:3 10:3 11:1 12:3 |
| 11.3 | V2 | 32.24 | 22.5 | 27.4 | 1:3 2:3 3:3 4:3 5:3 6:1 9:3 10:3 11:2 12:3 |
| 6.2 | V2 | 35.5 | 9.12 | 22.3 | 1:3 2:3 3:3 4:3 5:3 6:1 9:3 10:3 11:3 12:3 |
| 6.3 | V2 | 34.12 | 13.88 | 24 | 1:3 2:3 3:3 4:3 5:3 6:2 9:3 10:3 11:3 12:3 |
| 7.1 | V2 | 75.06 | 52.83 | 63.9 | 1:3 2:3 3:3 4:3 5:3 6:3 9:3 10:3 11:3 12:3 |
| 7.2 | V2 | 62.34 | 47.24 | 54.8 | 1:3 2:3 3:3 4:3 5:3 6:3 7:1 9:3 10:3 11:3 12:3 |
| 7.3 | V2 | 67.46 | 67.46 | 67.5 | 1:3 2:3 3:3 4:3 5:3 6:3 7:2 9:3 10:3 11:3 12:3 |
| 14.1 | V2 | 37.4 | 31.34 | 34.4 | 1:3 2:3 3:3 4:3 5:3 6:3 7:3 9:3 10:3 11:3 12:3 |
| 14.2 | V2 | 27.56 | 20.7 | 24.1 | 1:3 2:3 3:3 4:3 5:3 6:3 7:3 9:3 10:3 11:3 12:3 14:1 |
| 14.3 | V2 | 22.3 | 22.3 | 22.3 | 1:3 2:3 3:3 4:3 5:3 6:3 7:3 9:3 10:3 11:3 12:3 14:2 |
| 13.1 | V2 | 49 | 41.34 | 45.2 | 1:3 2:3 3:3 4:3 5:3 6:3 7:3 9:3 10:3 11:3 12:3 14:3 |
| 13.2 | V2 | 60.99 | 36.63 | 48.8 | 1:3 2:3 3:3 4:3 5:3 6:3 7:3 9:3 10:3 11:3 12:3 13:1 14:3 |
| 13.3 | V2 | 29.44 | 29.44 | 29.4 | 1:3 2:3 3:3 4:3 5:3 6:3 7:3 9:3 10:3 11:3 12:3 13:2 14:3 |
| 15.1 | V2 | 100.58 | 35.47 | 68 | 1:3 2:3 3:3 4:3 5:3 6:3 7:3 9:3 10:3 11:3 12:3 13:3 14:3 |
| 15.2 | V2 | 42.26 | 35.96 | 39.1 | 1:3 2:3 3:3 4:3 5:3 6:3 7:3 9:3 10:3 11:3 12:3 13:3 14:3 15:1 |
| 15.3 | V2 | 33.71 | 33.71 | 33.7 | 1:3 2:3 3:3 4:3 5:3 6:3 7:3 9:3 10:3 11:3 12:3 13:3 14:3 15:2 |
| 8.1 | V1 | 61.08 | 31.56 | - | 1:3 2:3 3:3 4:3 5:3 6:3 7:3 9:3 10:3 11:3 12:3 13:3 14:3 15:3 |
| 8.2 | V1 | 8.65 | 8.65 | - | 1:3 2:3 3:3 4:3 5:3 6:3 7:3 8:1 9:3 10:3 11:3 12:3 13:3 14:3 15:3 |

## U. Unsicherheiten und Grenzen

- **Groesste Einzelunsicherheit: g** (Wachstumsrate von ln(Chance) je Stunde). BN2.1 gemessen 0,135-0,162 /h; meine Wand-Fits ueber 15 V2-Knoten 0,02-0,20 /h (Median ~0,06, Wand
  enthaelt Offline; Chance im Fit = Typhoon ohne Pop/Chaos). Alle Stundenangaben der Chancen-Kanaele skalieren mit 1/g (Faktor 4 Spanne).
- **Saettigung:** Die Kanaele addieren sich nicht (Abschnitt D6); das Stanek-Modell (am 27.10. geeicht in 8 von 11 Laeufen) kommt mit 0,3-1,7 h je +13-50 % Kampfwerte auf die untere Seite meiner Spanne.
- **Effektive V2-Stunden** (online + 0,5 x offline): die 50 % sind ein Plausibilitaetstest an 8 Luecken (Teil 1), keine Eichung; 15.1 (65 h Offline) und 10.3 (25 h) haengen davon ab.
- **Vorphasenanteil** 43-90 % aus nur 5 Laeufen (Online-Rangkurven 13.2-15.3, `dashboard-history.json` deckt nur 29.10.-12.11. ab); lokale `backups/` enthalten 258 von 1.539 Indexzeilen (nur Stichproben).
- **Grafting, Sleeves, Boerse, Hash->Rang in Knotenzeit** sind Modellwerte (Spannen aus AUG-1, SLEEVE-1..3, BOERSE-1, HASH-RANG), Teilketten geeicht, die Umrechnung Chance -> Rang/h -> Knotenzeit nicht.
  Die einzige Messung ist BN15.1 -> .2 -> .3 und konfundiert (Go, Graft, SF15, Offline-Gutschrift, Bot-Lernen).
- **SF2/3/7/8/11-Mult-Formeln** ungeeicht (kein Stand ohne Aug-Einfluss mit diesen SF); Codepfad identisch zu SF1/5/6/9, Werte stimmen mit den Beschreibungstexten.
- **v301 gegen laufendes Spiel:** drei Augs weichen ab (Synthetic Heart charisma, DermaForce, Illustrated Primer, laut `nodes/GRAFTING.md`); BN13-Charisma-Level-Mult 0,7 nur in 3.0.2. Die Skill-Rekonstruktion (0 Abweichungen in 1.548 Pruefungen) zeigt, dass die **Level-Mults** des laufenden Spiels mit v301 uebereinstimmen.
- **Sleeve-Anzahl:** Der Auftrag nannte "Sleeve 2 ab ca. 06.09., Sleeve 3 ab ca. 09.09."; die Spielstaende zeigen 2 Sleeves in BN10.2 (ab 01.09.) und 3 in BN10.3 (ab 06.09.).
- **V1-Zeitwirkung** von SF1/SF5 (0,5-3 h) beruht auf einer Stufen-Gegenrechnung (exakt) und einer groben Steigung der Endphase (V1-Kurven springen in der letzten Stunde von ~1.400 auf 4.600-8.500); nicht gemessen.
- **Nicht untersucht** (Teil 2a/4): Infiltration, Corp, Gang ausserhalb BN2, Casino, Hash->Contracts, Einbau-Takt; Daedalus-Go in V1 und w0r1d_d43m0n sind nur als offene Moeglichkeit erwaehnt.

## Dateien

- `nodes/audit-lauf2/2b-fortschritt-sf.md` (dieser Bericht), `nodes/audit-lauf2/2b-sf-modell.json` (Modell: `sf`, `knoten`, `mechaniken`, `go`, `intBonus`, `homeRamKosten`, `overclock90`, `messdaten`, `v2_primitiven_je_sf_stufe_gegenfall_ohne_sf`).
- Rechner (Scratchpad `.../0f034fb3ad50e625/feee1757-fe7d-46ac-8a39-80b39fc941eb/scratchpad/audit2b/`): `sfmod.js` (applySourceFile + Exploits), `bnmults.js`, `bbmodel.js` (Chance/Ausdauer), `cf1.js`, `cf2.js` (Chancenfaktoren je SF),
  `calib1.js`, `calib2.js`, `gocal.js`, `lvlcheck.js` (Eichungen), `bofloor.js`, `gslope.js`, `v1cf.js`, `tables.js`, `build.js`.
