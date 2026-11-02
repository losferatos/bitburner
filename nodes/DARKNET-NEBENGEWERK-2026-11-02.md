# Darknet-Nebengewerk in BN15 - Entscheidungsvorlage (02.11.2026, 15:30)

Frage: Verkuerzt ein Darknet-NEBENgewerk (ohne Red-Pill-Ziel) den BN15-Ausgang ueber V2? Kein Code im Bot, nichts in `src/` geaendert.
Rechner und Rohdaten: Scratchpad `C:\Users\erche\AppData\Local\Temp\claude\C--Users-erche-Desktop-claude-projecto\feee1757-fe7d-46ac-8a39-80b39fc941eb\scratchpad\darknet\`
(`geld.mjs`, `netz.mjs`, `cha.mjs`, `stat.mjs`, `stat2.mjs`, `geldgebunden.mjs`, `ersparnis.mjs`, `scan.mjs`, `runs.mjs`).

## Urteil: NICHT BAUEN

- **Gesamtersparnis je BN15-Lauf: realistisch 1-5 h, Obergrenze ~10 h** - bei einer V2-Dauer von 55-178 h also 1-5 %, im besten Fall 7 %.
  Die zwei Ertragswege: Lab-Augs (Kampfwerte) 1-8 h gebrutto, Cache-Geld 0,5-3,5 h (mit Saettigung der Kaufliste).
- Kosten: ~24 Raetselloeser (16 schon fuer Lab 1), Netz-Navigator, Luftspalt-Uebergang ab Tiefe 9, Maze-Suche, Charisma-Farm auf dem RAM-Pool,
  Neuaufbau nach JEDEM Einbau (4-14 Mal je Lauf). Testbar nur teilweise ausserhalb BN15 (Tiefe-5-Netz, 14 von 24 Modellen).
- **Kein Hebel fuer die Engpassphase**: die rangtragenden Aktionen (Raid, Stealth Retirement, Assassination, Black Ops) haben Charisma-Gewicht 0.
- Keine Teilvariante lohnt: die billigste (nur Lab 1 = The Broken Wings) spart 0,9-3,7 h bei vollem Loeser-Aufwand.

## 1. Ertrag

### 1a. Geld aus dem Darknet

Fundstellen: Cache-Chance `effects.ts:35-36` (0,1 x 1,05^d je Server, nur beim ersten erfolgreichen Auth; nicht im Labor); Belohnungsliste
`cacheFiles.ts:70-78` (4 Eintraege, 1 davon Geld; Rueckfall auf Geld nur wenn Programme/WSE/TIX/4S, Hinweisdateien oder Aktien erschoepft sind);
Betrag `cacheFiles.ts:110-122`:
`1,2^d x 1e7 x (200+cha)/200 x [SF15.3: 1,5] x crime_money x dnet_money x DarknetMoneyMultiplier`.
BN15 setzt `DarknetMoneyMultiplier` nicht (Standard 1; `BitNode.tsx:1085-1117`), BN13 hat 0,1, BN3 0,4. `crime_money` aus den Staenden: 1,9 (Zyklus 1) bis 3,6 (spaet).
Phishing (`phishing.ts:25-59`): 500 x crime_money x (0,1+0,05 x Tiefe) je Treffer, Chance 5 % x crime_success - Cent-Betraege, kein Hebel.
Netzgroesse `NetworkGenerator.ts:101` und `Enums.ts:5-10`: D x 8 x 0,6 - 10 (+10 Auffuellen) Server, Schwierigkeit gleichverteilt 0..D-1
(`NetworkMovement.ts:194`). D = Tiefe des AKTUELLEN Labs (`labyrinth.ts:393-396, 432-473`): 7 / 12 / 19 / 23 / 29 je nach installierten Lab-Augs.

Erwarteter Geldertrag je Netz (Rechner `netz.mjs`, crime_money 2,5, Geldanteil q = 0,25 bis 0,5; erreichbar = Charisma >= mittlere Server-Anforderung
`DarknetServerOptions.ts:70-72`):

| Stufe (Lab-Tiefe) | cha 300 | cha 600 | cha 1500 | cha 3000 |
|---|---|---|---|---|
| 1 Normal (7) | 1-2e8 | 2-4e8 | 4-8e8 | 8e8-1,5e9 |
| 2 Cruel (12) | 3-5e8 | 0,9-1,8e9 | 1,9-3,8e9 | 4-7e9 |
| 3 Merciless (19) | - | 0,9-1,8e9 | 1-2e10 | 2-4e10 |
| 4 Uber (23) | - | - | 1-2e10 | 5e10-1e11 |
| 5 Eternal (29) | - | - | 2-4e10 | 2-5e11 |

Charisma jenseits ~1500 ist praktisch unerreichbar (siehe 3a), Stufen 4-5 fallen damit weg. Realistisch: Stufe 1 ~1e8, Stufe 2 ~1-4e9, Stufe 3 (wenn Cha 1500) ~1-2e10.
Nach dem Einbau wird das Netz neu gewuerfelt (`Prestige.ts:76`) - der Ertrag gilt je Zyklus, nicht je Lauf. Einbauten je Lauf: BN13.3 2 in 29 h, BN13.1/13.2 3 in 49/61 h,
BN7 4-5 in 62-75 h (Abstand 12-20 h; Sperre `endspurt.js:344-346`, 12 h oder 2 x Wiederaufbau). BN15: T/12,5 = 4 / 8 / 14 Einbauten bei T = 55 / 105 / 178 h.

### 1b. Lab-Augs - zaehlen sie fuer V2?

`Augmentations.ts:1851-1952`: Broken Wings agi x1,10 / cha 1,05 / dnet_money 1,3; Boots dex x1,06 / cha 1,06 / Auth x0,8; Hammer str x1,10 / cha 1,07 / dnet 1,1;
Staff def x1,10 / cha_exp 1,1 / dnet 1,1; Law cha 1,09; Sword hacking 1,1 (nutzlos fuer V2). Alle kosten 0 $ (Cache-Belohnung, `cacheFiles.ts:195-207`).
Reihenfolge BN15: BW, Boots, Hammer, Staff, dann EternalLab = Red Pill (`labyrinth.ts:403-430`) - je Lab ein Einbau-Zyklus, naechstes Lab erst nach INSTALLIERTER Vorgaenger-Aug.

Wirkung auf den Ranggewinn (Rechner `stat2.mjs`, Formeln aus `tools/audit/blade-formeln.mjs`, Stuetzstellen = 28 BN13.3-Staende, Rate der real gewaehlten Aktion):

| Lab-Aug | Zuwachs Rang/h |
|---|---|
| BW (agi) | +2,7 % |
| Boots (dex) | +1,8 % |
| Hammer (str) | +1,6 bis 2,0 % |
| Staff (def) | +1,6 bis 2,0 % |
| alle vier | +7,9 % (nur Anlauf/Mittelphase: +9,0 %) |

Charisma selbst hilft nicht: `cha.mjs` (28 Staende) - Raid, Stealth Retirement, Assassination und alle Black Ops haben Charisma-Gewicht 0 (`blade-formeln.mjs:16-38`). Charisma 1000/2500
hebt nur Vertraege/Investigation/Undercover/Sting, und die stehen ab Knotenstunde ~10 schon bei p = 1. Nach einem Einbau (Cha und Kampfwerte auf ~1) hilft es kurz, ist aber nicht der Engpass.

**Warteschlangen-Falle (wichtig):** `getGenericAugmentationPriceMultiplier` (`AugmentationHelpers.ts:29-37`) zaehlt JEDE gequeuete Aug, also auch die kostenlose Lab-Aug. Ist sie vor den
Kaeufen des Zyklus in der Warteschlange, kostet jedes weitere Stueck x1,767 (1,9 x SF11.3-Faktor 0,93). Im geldgebundenen Zyklus (siehe 2) heisst das exakt: ein kaufbares Stueck weniger
(Rechnung: n' = n - 1). Ein typisches gekauftes Stueck bringt +4,8 % Kampfmult (Median Sprung je Aug in BN2/3/7/11, `scan.mjs` + Auswertung), also ~+4,3 % Rate; BW +2,7 % -
die Lab-Aug waere dann ein Minus. Sie darf erst NACH den Kaeufen des Zyklus gequeued werden - das verlangt Abstimmung mit `bn4rep.js` (Einbau warten, bis das Labor fertig ist, mit Abbruchfrist).

## 2. Uebersetzung in Rangtempo: ist Geld der Engpass?

Telemetrie: 43 Einbauten in V2-Laeufen (BN2, 3, 6, 7, 11, 13, 14; `geldgebunden.mjs`, Daten `backups/`), Kontostand beim Einbau gegen die im Zyklus ausgegebene Summe.
Schwelle: Kontostand >= 0,767 x ausgegeben hiesse, das naechste Stueck (Kette 1,767) waere noch bezahlbar gewesen.
- Geldgebunden/knapp: **27 von 43** (AugMoney-3-Knoten BN3/BN7: 10 von 19; BN13/14: 8 von 13).
- Nicht geldgebunden: 16 von 43 (Konto blieb ueber der Schwelle: dort limitieren Ruf, Kaufliste oder Sperre).
- Der **Einbauzeitpunkt** ist NICHT geldgebunden: er folgt der 12-h-Sperre (BN13.3: Einbau bei 12,4 und 25,2 h, Abstand 12,8 h; Ausgang 4,2 h nach dem zweiten). Mehr Geld macht den Einbau also nicht frueher,
  sondern nur grosser (mehr Stuecke je Einbau).
- Beispiel BN13.3: zweiter Einbau mit 5,6e9 ausgegeben (6 Stuecke), danach Rang 117k -> 440k in 4,2 h. Der Ausgang haengt an der Einbau-Qualitaet, nicht an einem Geldschwellwert.

Wert zusaetzlichen Geldes: mit r = 1,767 bringt Zusatzgeld dM bei Ausgabe S genau ln(1 + dM/S) / ln(r) Stuecke (`ersparnis.mjs`):

| dM | S = 5e9 | S = 1,5e10 | S = 4e10 |
|---|---|---|---|
| 1e8 | 0,03 | 0,01 | 0,00 |
| 1e9 | 0,32 | 0,11 | 0,04 |
| 4e9 | 1,03 | 0,42 | 0,17 |
| 1,5e10 | 2,44 | 1,22 | 0,56 |

Gemessene Ausgabe je Zyklus in AugMoney-3-Knoten (BN7/BN3): 2e8 bis 6e10, Mitte ~7e9. Stufe 1 (1e8) ist also wertlos, Stufe 2 (1-4e9) bringt 0,1-0,5 Stueck, nur Stufe 3 mit Cha 1500 (1-2e10) bringt ~1.
Das wirkt nur im geldgebundenen Zyklus (Anteil 10/19 = 53 % in AugMoney-3-Knoten) und nur bis die Kaufliste gesaettigt ist (BN7: 16-17 Augs nach 62-75 h; danach kauft Geld nur NFG-Stufen a 1 %).

## 3. Kosten

### 3a. Charisma ist das Tor, und es setzt sich bei jedem Einbau zurueck
- Harte Tore: Lab-Eintritt Cha >= 300/600/1500/2500/3000 (`labyrinth.ts:243-248`), `heartbleed` Cha >= Server-Anforderung (`Darknet.ts:263`). Server-Anforderung = (d/Labtiefe)^1,5 x Lab-Cha x 0,85 + Varianz (-d bis +2d).
- Cha-EXP je Level: Level = Mult x 1,1 x (32 ln(EXP+534,6) - 200). Bei Gesamtmult 1,8: Cha 600 braucht 1,8e7 EXP; bei 3,0: Cha 1500 braucht ~8e8; Cha 2500 braucht 1e13 und mehr (nicht erreichbar).
  Die Cha-Mults der V2-Laeufe: 1,6-3,3 (BN13.3 Ende 2,76). Damit sind realistisch **Lab 1-3** (BW, Boots, Hammer); Staff/Red Pill/Law/Sword nicht.
- Farm: `authenticate("darkweb", "")` von home aus: 0,7 EXP je Thread-Versuch, Dauer 850 x 100/(cha+150) / (1 + 0,2 (t-1)) ms (`effects.ts:60-98, 116-132`) -> ~13 EXP/s/GB bei 100 Threads, ~63 bei 500.
  Cha 600: ~385 GB-h (2 h auf 200 GB). Cha 1500 (8e8 EXP): ~3,5 h auf 1 TB - bei 1,9 TB Gesamtpool (BN13.3) die halbe Pool-RAM fuer 3,5 h JEDEN Zyklus, die dem Geld-/EXP-Betrieb fehlt.
  Die Farm ist nur mit grossen Thread-Zahlen brauchbar; die Machbarkeitsstudie vom 07.10. rechnete mit 32-256 TB home - V2 hat die nicht.
- **Hacking-Anforderung: keine.** `grep skills.hacking` ueber `src/DarkNet/` und `NetscriptFunctions/Darknet.ts` findet nichts. HackingLevelMultiplier 0,6 ist fuer das Nebengewerk irrelevant
  (er toetet nur V1b, Hacking 6000). Ebenso gibt es keine Konkurrenz um die Spielerfigur: dnet laeuft als Skript, nicht als Aktion.

### 3b. RAM
- Je Crawler-Skript: Basis 1,6 + authenticate 0,4 + heartbleed 0,6 + openCache 2 + probe 0,2 + connectToSession 0,05 + getServerDetails 0,1 = ~5-7 GB (`RamCostGenerator.ts:238-263`); labreport/labradar 0 GB.
- Darknet-Server haben 16 GB x 2^floor(d/6) x {0,5..1,4} minus blockedRam (`DarknetServerOptions.ts:206-211`, `ramblock.ts:97-110`), also 1-2 Skripte je Server. Das ist **eigener RAM, kein home-/Mietrechner-RAM**.
  Nur die Charisma-Farm (3a) und der Start auf `darkweb` (16 GB) beruehren den Bot-Pool.

### 3c. Aufwand und Risiko
- 24 Modelle (`ServerGenerator.ts:18-43`): Stufe 1 Netz (Schwierigkeit <= 6) braucht 16, Stufe 2 (bis 11) 24, davon 2 nur in BN15 (KingOfTheHill, SpiceLevel). Ausserhalb BN15 testbar: Tiefe-5-Netz fuer 50 Mio (`labyrinth.ts:486-497`), 14 Modelle.
- Ab Tiefe 9 trennen Luftspalt-Reihen (alle 8 Reihen, `Enums.ts:6`, `darknetNetworkUtils.ts:103`) das Netz - Stufe 2+ braucht einen Uebergang; der Machbarkeitsbericht ist hier nur "Stasis-Links".
- Das Netz mutiert (30 s je Reihe in BN15, `Enums.ts:11`), Timeouts, Server gehen offline; jeder Versuch ist ein Timer - in einem verdeckten Tab (1 Wake/min, Memory `browser-tab-drosselung`) wuerde jeder Versuch Minuten kosten.
- Kopplung an `bn4rep.js`: Lab-Aug erst nach den Kaeufen queuen, Einbau nur mit Wartefrist - jede Verzoegerung ueber die 12-h-Sperre hinaus kostet Lauf-Stunden.
- Jeder Einbau rollt das Netz neu und setzt Cha zurueck: nichts ueberlebt, alles wird 4-14 Mal neu gemacht.

## 4. Ersparnis je BN15-Lauf (Stunden, `ersparnis.mjs`)

Annahmen: Einbauten alle 12,5 bis 15 h, Lab k wird beim k-ten Einbau wirksam, Rate-Zuwachs ab dann bei einem Anteil von 0,85 der Restzeit (Erfolgschance < 1, aus den Staenden).
Drei V2-Dauern: 55 h (BN13.3 grob skaliert, UNGEEICHT), 105 und 178 h (Vorgabe).

| Lab-Stand (realistischer Teil gefettet) | T=55 | T=105 | T=178 |
|---|---|---|---|
| nur BW (Cha 300) | 0,9 | 2,0-2,1 | 3,6-3,7 |
| **BW + Boots (Cha 600)** | 1,3-1,4 | 3,1-3,3 | 5,9-6,0 |
| **BW + Boots + Hammer (Cha 1500)** | 1,4-1,7 | 4,0-4,3 | 7,9-8,1 |
| alle vier (Cha 2500, unerreichbar) | 1,4-1,7 | 4,7-5,1 | 9,6-10,0 |

Cache-Geld mit Saettigungsgrenze (Horizont 75 h): Stufe 2 / Cha 600: 0,2-0,5 h; Stufe 2 / Cha 1500: 0,8-1,8 h; Stufe 3 / Cha 1500: 0,9-3,5 h. Ohne Saettigungsgrenze (unrealistisch) bis 28 h bei T=178.

**Abzuege:** (a) Warteschlangen-Falle, falls die Lab-Aug zu frueh gequeued wird (siehe 1b: Netto-Effekt von BW +0,4 %, Boots/Hammer negativ); (b) Charisma-Farm nimmt Pool-RAM; (c) Mess-Unschaerfe der Kaufwirkung.
**Summe, ehrlich:** realistisch 1-5 h, Obergrenze (Lab 1-3 plus Stufe-3-Geld, alles gelingt, keine Abzuege) ~10-12 h. Nicht beide Hebel addieren sich voll: dieselbe Kampfwertwirkung, dieselbe Saettigung.

## 5. BN15.2 / BN15.3 / dauerhaft

- SF15.1 kommt mit dem Abschluss von BN15.1, unabhaengig vom Nebengewerk (schaltet Labs ausserhalb BN15 frei, `effects.ts:301`).
- SF15.2: Auth x0,8 (`effects.ts:80`) und Cha-Bonus auf Firmenarbeit (`Work/Formulas.ts:133`); SF15.3: Cache-Geld x1,5 (`cacheFiles.ts:111`), Cha-Anteil an Fraktionsarbeit-Ruf (`reputation.ts:55`).
  Fuer V2 zaehlt davon nur die x1,5 auf Cache-Geld: sie heben Abschnitt 1a/4 um ~50 %, also ~+0,5-1,5 h in BN15.3. Kein Grund, davor zu bauen.
- Dauerhaft ohne Nebengewerk: nichts verfaellt. Das Labyrinth ist nur ueber SF15.1 ausserhalb BN15 verfuegbar; in V2-Knoten ist die Red Pill wertlos, in V1-Knoten kommt sie aus Daedalus.

## Eichung

| Formel | Quelle | Eichung |
|---|---|---|
| Cache-Geld `getMoneyReward` | `cacheFiles.ts:110-122` | Quelle per `stripTypeScriptTypes` AUSGEFUEHRT und mit Nachbau verglichen: 240 Gitterpunkte, max. rel. Abweichung 0 |
| Auth-Zeit `calculateAuthenticationTime` | `effects.ts:60-98` | Quelle ausgefuehrt: Abweichung 2,2e-16; unabhaengiger Wert: AUDIT-ROADMAP-2026-08-24 "EternalLab cha 3200, 1 Thread ~4,1 s" -> 4,09 s |
| `getMultiplierFromCharisma` | `effects.ts:106-112` | Quellkommentar "~1,2 bei 2000, ~1,6 bei 10000" -> 1,211 / 1,630 |
| Bladeburner-Formeln (Erfolgschance, Aktionszeit, maxStamina) | `tools/audit/blade-formeln.mjs` | gegen 28 BN13.3-Staende (`cha.mjs`): p_min max. Abweichung 4,6e-4 (n=28), Aktionszeit max. 1 s (n=28), maxStamina max. 2,2 % (zwei Staende), sonst exakt |
| Preiskette (Faktor 1,9 x 0,93) | `AugmentationHelpers.ts:29-37`; geeicht im Kaufplan vom 07.10. (122/122 Staende) | uebernommen |
| Darknet-Wert im Spielstand | - | **nicht eichbar**: `moneySource.darknet` ist in allen 167 gelesenen Staenden 0. Cache-Chance, Belohnungsanteil und Cha-Farmrate sind nur Quelle, nie gemessen |

## Unsicherheiten

1. **V2-Dauer in BN15 ist selbst unsicher.** Die Vorgabe 105-178 h stammt aus aelteren Modellen; skaliert man den neuen Bot (BN13.3: 29 h bei Rang 0,45) grob, kaemen 50-70 h heraus (UNGEEICHT; Rang 0,2 und Skillkosten x3 verlaengern die Anlaufphase). Je kuerzer T, desto kleiner jede Ersparnis (Spalte T=55).
2. **Cache-Ertrag nie gemessen.** Annahmen: q = 0,25 bis 0,5 (Rueckfaelle auf Geld unbekannt, Programme nach Einbau evtl. weg), Server je Schwierigkeit ~4,8, crime_money 2,5. Ein Faktor 2-3 in jede Richtung ist moeglich.
3. **Wirkung eines gekauften Stuecks** (4,8 % Kampfmult, ~4,3 % Rate) stammt aus Spruengen vor/nach dem Einbau; BN13/14-Zeilen zeigten Faktoren < 1 (vermutlich Stanek/Entropie, nicht geklaert) und wurden nicht verwendet. Elastizitaet 0,9 aus 28 Staenden eines Knotens.
4. **Rate-Zuwachs der Lab-Augs** misst nur die real gewaehlte Aktion bei fester Wahl; der Bot koennte mit besseren Werten andere Aktionen frueher freigeben (Mehrertrag, hier nicht gerechnet) oder Raid frueher verlassen. Staemme aus BN13 (Rang 0,45/Skill x2), nicht BN15.
5. **Cha-Farm-Rate und RAM** sind aus der Quellformel gerechnet, nicht gelaufen; Timer-Boden (4 ms), Drosselung verdeckter Tabs und die Zahl gleichzeitig nutzbarer Threads koennen sie um Groessenordnungen aendern - in beide Richtungen. Cha 1500 in einem Zyklus ist eine Annahme.
6. **Anteil geldgebundener Einbauten** (53-63 %) ist aus Kontostand/ausgegeben abgeleitet; ein kleiner Kontostand kann auch "Liste leer" heissen. Es fehlt der direkte Nachweis ("naechstes Stueck war zu teuer").
7. **Luftspalt-Uebergang, Mutation, Offline-Server:** nicht durchgerechnet; fuer Stufe 2+ koennten sie die Erreichbarkeit von Tiefe > 8 stark kuerzen und damit die Geldzahlen von Stufe 2/3 senken.
8. **Nicht untersucht:** Stock-/CCT-/Programm-Belohnungen der Caches (kleiner Zusatznutzen, z. B. 4S/WSE ohne Kauf; in V2 kein Boersengeschaeft), Wirkung der Lab-Aug "Boots" (Auth x0,8) auf die Farm, NeuroFlux-Level aus dem BonusLab (8. Lab, Cha 4000, unerreichbar).

## Empfehlung

Nicht bauen und die Zeit in Hebel stecken, die den Rang direkt treffen. Wiederaufnahme nur, wenn (a) eine Messung im Tiefe-5-Netz (50 Mio, ausserhalb BN15) zeigt, dass Cha-EXP je GB-h und Cache-Geld um Faktor >= 5 ueber den Annahmen liegen, UND (b) die gemessene V2-Dauer in BN15.1 bei >= 120 h liegt. Bis dahin: BN15.1 normal laufen lassen, `moneySource.darknet` bleibt 0.
