# BN13.1 Rang-Rueckstand - Bericht 28.10.2026 06:40

**Urteil: Nicht "BN13 ist eben langsam", sondern eine konkrete Fehlsteuerung. Die Stadtwahl sitzt in New Tokyo fest (Raid-Chance 0,21 statt 0,30), weil die Feinwahl nur Staedte mit >= 55 Gemeinden sieht. `src/` unberuehrt; Kandidat steht in `blade.js` neben diesem Bericht.** Skeptiker-Lauf steht aus (Pflicht vor dem Einbau, kein `[skeptiker]`-Marker).

## 0. Eichung (alles unten rechnet damit)
- `modell.cjs` baut `Action.getSuccessChance`, `getActionTime`, `completeAction` nach (reference/bitburner-src; Gegenprobe: reference/v301 unterscheidet sich in Bladeburner/ nur in Texten und einer Klemme in Skill.ts).
- `eichen.cjs` gegen Spielstand 06:15 und `data/blade.json` (live per `getFile`, nur lesend): **Typhoon 0,1361 (Soll 0,136)**, **Raid-9-Zeit 86 s (Soll 86000 ms)**, Ausdauer 167/167 (Soll 168). Rueckrechnung der "Spanne": min = (2*real - est)*r = 0,069 (blade.json: 0,069-0,085).
- Ketten-Gegenprobe der Simulation (`sim.cjs`): vom 03:15-Stand 3 h vorwaerts, Modell 1440 (Ausnutzung 0,70) gegen **gemessen 1453**.

## 1. Befund 1 (Gewicht ~ 70 %): Stadtwahl klemmt in New Tokyo
- Die gemeldeten "8,5 %" sind **nicht die echte Chance**: `blade.js:5171` schreibt `spanne(...).min` (Untergrenze der Spanne) nach blade.json. Echte Raid-Stufe-9-Chance im Spielstand: **0,212** (est 0,307). `beste()` rechnet korrekt mit `spanneGenau` (exakt ueber den Typhoon-Trick). Raid ist also NICHT bei 8,5 % gewaehlt worden.
- Raid Stufe 9 je Stadt (Spielstand 06:15, `lage.cjs`): New Tokyo 0,212 (Bev. 0,78 Mrd, Chaos 45) | Aevum 0,210 | Chongqing 0,182 | Sector-12 0,261 | Ishima 0,272 | **Volhaven 0,295** (1,25 Mrd, Chaos 4,7).
- Ertrag je Raid = c*53,05 - (1-c)*5,36 (Verlust 2,5*1,1^8, **nicht** durch den BN-Faktor 0,45 gekuerzt): NT **7,05** (295 Rang/h), Volhaven **11,90** (498/h), Ishima 10,5, Sector-12 9,9. +69 % je Raid.
- Ursache im Code: `feinWahl(feinHier, fein, RUNDREISE_MIN_COMMS)` (blade.js:3259) verlangt Ziel-Gemeinden >= **55**; in BN13 liegen nur NT (68) und Aevum (80) darueber. Die anderen vier (21/23/44/48) sind unsichtbar. `STADT_VORSPRUNG = 2` (Wert pop/Chaosfaktor) greift bei 1,6 nicht. Belegt durch `test-feinwahl.cjs`: alte Fassung gibt in NT `null`, neue `Volhaven`.
- Verstaerker: Jeder Raid senkt die Bevoelkerung (-0,75..-1 %, `Bladeburner.ts:818-836`; Erfolg zusaetzlich -1 Gemeinde); sie waechst nicht nach (Zufallsereignisse im Mittel null). In NT allein faellt die Chance im Modell von 0,21 auf 0,13. Passt zur gemessenen Rate **216 -> 177 -> 151 -> 108 -> 154 Rang/h** (Stunden 7-11).
- Folge-Verzerrung: NT steht bei Chaos 45, daher schlaegt `beste()` einen Chaos-Zuschlag von ~97 s + 20 s Bevoelkerungszuschlag auf Raid (86 s -> 203 s). Ergebnis im Protokoll: "Vertrag (Ertrag 4,87 vor Operation Raid 4,25)" - Bounty Hunter schlaegt Raid, obwohl real **Raid 180 Rang/h, Bounty Hunter 114/h** (data/aktionen.txt, 92 bzw. 74 Abschnitte). In einer Stadt mit Chaos < 40 faellt der Zuschlag weg und Raid gewinnt von selbst.
- Rechnung "BN14.3 vs BN13.1" bei gleichem Alter (h9): BN14.3 27 Raids/h, Chance 0,55-0,89, Stufe 11 -> ~1.500 Rang/h; BN13.1 14-33 Raids/h, Chance 0,21, Stufe 9. Erwartungswert je Raid 55 gegen 7: Faktor 7,9 = Chance (3,2) x Belohnung (1,6: Rangfaktor 0,6/0,45 und Stufe). Die Chance traegt das meiste; sie ist bei BN14.3 durch Go-Macht 4 (Kampfmult 6-9 gegen 2,2-3,4 hier, nodePower 165k, K = 0,7*2*GoPower) und durch fruehere Skillpunkte (mehr Rang) hoeher - das ist BN-Struktur und nicht zu beheben, die Stadtwahl schon.

## 2. Rechnung: Rang mit und ohne Fix (sim.cjs, Ausnutzung 0,70, geeicht)
Erwartungswerte, Start 06:15 (Rang 1.453, Stufe Raid 9). `status` = New Tokyo fest; `bestcity` = je Aktion die Stadt mit der besten echten Chance (Bevoelkerungsverbrauch, Gemeinden, Skillkauf, Stufen, Kampfwerte mitgerechnet; Chaos < 50 folgenlos, Sleeves halten es).
| Strategie | h1 | h4 | h8 | h12 | h24 | h48 |
|---|---|---|---|---|---|---|
| status | 1.644 | 1.987 | 2.264 | 2.558 | 3.491 | 5.542 |
| **bestcity** | 1.792 | 2.902 | 4.935 | 7.773 | 26.386 | 71.229 |
| bestcity + 3 Sleeves als Trupp (+7 % Chance) | 1.830 | 3.101 | 5.439 | 8.883 | 34.657 | 79.690 |
| status + Gym statt Sicherheitsarbeit | 1.646 | 2.008 | 2.290 | 2.594 | 3.557 | 5.649 |
| bestcity + Einbau der 6 wartenden Augs bei h1,3 | 1.792 | 2.488 | 4.131 | 6.739 | 27.411 | 76.820 |
- Rate jetzt ~110-150/h (Modell status ~130 -> 60/h). Mit Fix ~360/h in den ersten 4 h, 1.000+/h ab h8. 400k erreicht `bestcity` im Modell bei ~h100 (status: nie in sinnvoller Zeit). **Die Spaetwerte sind Modell, nicht gemessen** (Zinseszins ueber Stufen/Skillpunkte, Raid-Vorrat von 284 Gemeinden ist bei h~20 aufgebraucht, danach tragen andere Aktionen). Belastbar sind die ersten 8-12 h.

## 3. Weitere Fragen
- **Fehlschlag Raid:** Rang -5,4 (4,4-5,7 gemessen), Schaden 50*dm(1138)=8,95 -> 447 (+-10 %) gegen HP 48 -> **jedes Mal Krankenhaus**, Kosten min(10 % des Bargelds, (48+447)*100k) = ~12 Mio bei 121 Mio Bargeld (moneyLost 2,9 Mrd, 530 Mal); Chaos +1..5 % der Stadt; Bevoelkerung -0,75..-1 %.
- **Niedrigere Stufe / andere Aktion:** Raid L1 344 Rang/h, L9 295/h in NT (+17 %), aber -19 % je Gemeinde und Stufenwachstum faellt weg: kein Gewinn (`stufe.cjs`). Je Stunde (NT, unbegrenzt): Raid 295, Bounty Hunter 134, Retirement 100, Tracking 78, Undercover 78, Stealth Ret. 61, Investigation 56, Sting 26, Assassination 6.
- **Zaehlerlage:** Ohne Sleeves gaebe es 30 (Vertraege) / 15,75 (Raid) Zaehler/h. Eine infiltrierende Sleeve gibt +0,5/min auf JEDE Aktion (`Bladeburner.ts:1245`), daher gemessen 62 bzw. 49 je Stunde; der Spieler ist zeitbegrenzt, nicht zaehlerbegrenzt (Raid-Vorrat 77 und steigend).
- **Kampfwerte 387-402 nach 11 h:** Stufe = 0,7 (BN13) x Go-adjustierter Mult x (32 ln(Exp+534) - 200), also logarithmisch; Exp ~10k/h je Wert (Modell 9,5k stimmt). Gym Powerhouse (10 x 1,514 exp/s auf einen Wert, reihum 3,8 je Wert = 13,6k/h) gegen Sicherheitsarbeit (1,136/s = 4,1k/h): 3,3x mehr Exp, im Modell aber nur +2 % Rang nach 24 h. **Kein Hebel**; `ClassGymExpGain` wird im Spielcode gar nicht ausgewertet (kein Gym-Malus in BN13).
- **Sleeves:** Kampfwerte 40, Sync 1, Schock 83-100, HP 14. Eine macht Infiltrate (gut, s.o.), eine Diplomacy in NT (ueberfluessig, sobald der Bot in einer Stadt mit niedrigem Chaos sitzt), eine Vertraege mit ~14 % Erfolg - die verbrauchen dabei geteilte Vertragszaehler (Tracking +68 Fehlschlaege/h). Kleiner Posten (~10-15 Rang/h), nicht gebaut.
- **Einbau der 6 wartenden Augs:** Sperre = max(12 h, 2 x Wiederaufbaudauer) seit "Kampfwerte >= 100" (`lib/endspurt.js:346`); `data/einbau-uhr.json`: fertig bei 5.969.293.800 ms, jetzt ~6.008e9 = 10,7 h -> **Einbau frei um ~07:50**. Wirkung (str/def x1,1, dex x1,386, agi x1,10, Exp x1,1): Wiederaufbau ~3 h mit schwaecheren Werten, Gewinn erst ab h~22 (+4 %). Weder zu spaet noch ein Hebel; Sperre nicht anfassen.
- **HP max 48:** `hp.max = 10 + Defense/10` (kein BN-Faktor), BN13 aendert hier nichts; ein Fehlschlag trifft immer.
- **Datamancer 6** (66 von 435 Punkten, 15 %): nicht bewertet; `relNutzen` haengt an `schaetzNot()`. Randbefund.
- BN13-Sonderwerte aus `BitNode.tsx`: BladeburnerRank 0,45, BladeburnerSkillCost x2, alle Kampf-Levelmult 0,7, GoPower 1 (BN14: 4, Level 0,5, Rang 0,6).

## 4. Fix (Kandidat, nicht eingebaut): `nodes/bau-2026-10-28-bn13rang/blade.js`
Diff gegen `src/blade.js` (nur diese drei Stellen):
1. neue Konstante `FEIN_MIN_COMMS = 12` (neben `FEIN_VORSPRUNG`);
2. Aufruf in `waehle()` (Stadtblock): `feinWahl(feinHier, fein, FEIN_MIN_COMMS)` statt `RUNDREISE_MIN_COMMS`;
3. `feinWahl`: ist `hier.comms < RAID_VORRAT_MIN` (ausgeraeumt), zaehlt jedes Ziel mit >= 12 Gemeinden ohne Vorsprung - sonst bliebe die Figur in der leeren Stadt mit der besten Bevoelkerung haengen.
Test: `node nodes/bau-2026-10-28-bn13rang/test-feinwahl.cjs` (6 Faelle gruen, inkl. Gegenprobe der alten Fassung). Einbau: `src/blade.js` ersetzen (CRLF bleibt), die Bruecke schiebt es in 400 ms live.

## 5. Risiken / offen
- Raid-Vorrat (284 Gemeinden gesamt, ~37k Rang) wird frueher verbraucht; die Endspiel-Schwellen (`RAID_VORRAT_GESAMT_MIN`, `blackOpSchwelle`) lesen ihn - vor dem Einbau pruefen, ob das ab h~20 Black-Op-Schwellen verschiebt.
- Chaos steigt in den neuen Staedten um 3 % je Raid (von ~5: ~75 Raids bis 47); die vorhandene Aufraeumlogik und Sleeve-Diplomacy muessen das tragen; Stadtwechsel waehrend Diplomacy ist bereits gesperrt (`chaosAufraeumen`).
- Hospitalkosten (10 % des Bargelds je Fehlschlag) bleiben; mit hoeherer Chance je Raid weniger Fehlschlaege.
- Simulation: Zufallsereignisse der Bevoelkerung (+-8-24 %) im Mittel null gesetzt, Ausnutzung 0,70 aus einer Gegenprobe (3 h), Spaetphase ungeeicht.
- Dateien: `modell.cjs`, `eichen.cjs`, `lage.cjs`, `stufe.cjs`, `sim.cjs` (Aufruf `EFF=0.7 node sim.cjs <save.json> <status|bestcity|bestcity_team|gym|bestcity_install> 48`), `serie.cjs`/`vergleich.cjs`/`mults.cjs`/`aktionen*.cjs` (Messungen aus Sicherungen und data/aktionen.txt), `vgl14.cjs`.
