# Audit 03.10.2026 - Bereich AUG (Augmentierungen, NeuroFlux, Einbau, Grafting, Prestige)

Stand: Spielstand `LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap` (BN2.1,
5,29 h im Knoten, Rang 1.734, 9,38 Mrd, 1 Aug installiert = NFG@3 aus SF12.3,
4 wartend: Wired Reflexes, Neurotrainer I, EsperTech Eyewear, EMS-4). Quellcode
3.0.2 unter `reference/bitburner-src/src/`. Bot `src/` Stand `0cc5a80`.
Systemzeit beim Schreiben: 2026-10-03 11:09.

Rechner (alle unter `tools/audit/`, nur lesend):

| Datei | Was | Eichung |
|---|---|---|
| `aug-save.mjs` | Spielstand dekodieren (Spieler, Faktionen, home-Dateien) | - |
| `aug-data.mjs` | 136 Augs direkt aus `Augmentations.ts`/`Enums.ts` (Preis, Ruf, Mults, Vorbedingungen) | ueber `aug-mults.mjs` |
| `aug-mults.mjs` | Spielermults = Augs (NFG level-mal) x SF x Exploits x Entropie | 6 Spielstaende (BN2.1, BN5.3, BN9.3, BN10.3, 2x BN12.3, bis 54 Augs): **alle Kampf-, Hack-, Bladeburner- und Ruf-Mults exakt (Abw. < 1e-9)**; nur `charisma` (-12,5 %, Versionsunterschied, schon in `nodes/GRAFTING.md` belegt) und `dnet_money` (NFG wirkt im laufenden Spiel nicht darauf) weichen ab |
| `aug-order.mjs` | Preistreppe, Reihenfolge, NFG-Stufen je Budget | gezahlte Summe der 4 Stuecke **2,491975 Mrd = moneySourceA.augmentations exakt**; Simulacrum bei q=4 **1.954,815 Mrd = bn4rep.json `teuerstesVerdiente` exakt** |
| `aug-graft.mjs` | Graft-Preis/-Zeit, competence je Graft MIT Entropie, Plan kumulativ, gierige Alternative | Graft-Zeit gegen Telemetrie BN10 (30./31.08.): Simulacrum 845.690 ms und Graphene Bionic Legs 51,36 min (gemessen 51,3) mit EINEM Int-Bonus (Int 96) - beide exakt; Stufen gegen Spielstand exakt |
| `aug-einbau-v2.mjs` | Gewinnschwelle eines Einbaus im Kampfknoten | sechs Skills aus Exp/Mult exakt nachgerechnet; Exp-Zuwachs und Rangrate aus zwei Spielstaenden (08:33 -> 09:59) |
| `aug-simulacrum.mjs` | Gym parallel zur Bladeburner-Aktion, Wiederaufbauzeit je Knoten | wie oben |

**Grenze aller Rangzahlen:** competence (`Action.ts:169-196`) ist geeicht, die
Umrechnung competence -> Rang/h nicht. Ich rechne `Rang/h ~ competence^k`. k=1,2
folgt aus der Stufenoekonomie der Operationen (bei Chance an der Schwelle
`L-1 = ln(c/(p*base))/ln(difficultyFac)`, Rang/s ~ `(rewardFac/difficultyFac)^(L-1)`:
Assassination ln(1,14/1,06)/ln(1,06) = 1,25, Sting 1,31, Raid 1,17, Bounty Hunter 1,08;
`data/Operations.ts:190-202`, `data/Contracts.ts:44-53`). Binden Zaehlerstaende
oder die Stufenfreischaltung (`maxLevel`), ist k kleiner - deshalb alle Rangzahlen
mit k=0,5 und k=1,2 als Spanne. Ein geeichtes Rangmodell ist Sache des
Bladeburner-Bereichs (needs_calc in den Befunden).

---

## 1. Feature-Inventar aus dem Quellcode

BN-Kuerzel Restroute: 2, 3, 11, 6, 7, 14, 13, 15 = V2 (Bladeburner), 8 = V1.
SF-Stand: SF1.3 SF4.3 SF5.3 SF6.1 SF9.3 SF10.3 SF12.3.

| # | Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag / Hebel |
|---|---|---|---|---|
| 1 | `purchaseAugmentation`: Mitglied, Faktion fuehrt Stueck, nicht besessen (NFG ausgenommen), Vorbedingung, Geld, Ruf | `Faction/FactionHelpers.tsx:60-130`, `NetscriptFunctions/Singularity.ts:169-183` | alle (SF4) | Stueck in die Warteschlange, wirkt erst nach Einbau |
| 2 | Preistreppe: jeder wartende Nicht-SoA-Eintrag x1,9 auf jeden weiteren Kauf (auch NFG-Stufen zaehlen einzeln) | `Augmentation/AugmentationHelpers.ts:29-37,127-161`, `Constants.ts:41` | alle | Reihenfolge "teuerste zuerst" ist optimal; jeder Platz verteuert alles Folgende |
| 3 | SF11-Rabatt auf die Treppe: 1,9 x [1; 0,96; 0,94; 0,93] | `AugmentationHelpers.ts:30` | ab BN11.2: 1,824 / 1,786 / 1,767 | Treppe flacher in 6, 7, 14, 13, 15, 8 |
| 4 | `AugmentationMoneyCost` / `AugmentationRepCost` | `AugmentationHelpers.ts:156-158`, `BitNode/BitNode.tsx` | BN3 Geld x3 Ruf x3 (:613-614), BN7 x3 (:739), BN11 x2 (:901), BN14 x1,5 (:1061), BN15 x3 (:1100); BN2/6/13/8 x1 | Kauf in 3/7/15 dreimal so teuer - Graften nicht (Nr. 19) |
| 5 | Vorbedingungen gelten mit WARTENDEM Vorgaenger | `FactionHelpers.tsx:56-58,88-95`, `PersonObjects/Person.ts:233-241` | alle | Kette in einem Zyklus kaufbar |
| 6 | NeuroFlux Governor: unbegrenzt, je Stufe x1,01000262 auf fast alle Mults (nicht bladeburner_*), Ruf 500 x 1,14^L x RepCost, Geld 750k x 1,14^L x MoneyCost x Treppe; nicht bei Bladeburners/SoA/Church | `Augmentations.ts:1159-1201`, `AugmentationHelpers.ts:133-139`, `Augmentation.ts:237-246`, `Constants.ts:36` | alle | einziger reiner Geld-Mult; je Stufe Preis x2,166 (1,14 x 1,9) |
| 7 | SF12: NFG-Stufen = SF12-Stufe beim Knotenstart geschenkt | `Prestige.ts:255-261` | alle (SF12.3 -> NFG@3) | gratis x1,0303 |
| 8 | `installAugmentations(cb)`: nur mit Warteschlange >= 1, Rueckrufskript | `Singularity.ts:196-210`, `AugmentationHelpers.ts:69-115` | alle | einziger Weg, gekaufte Stuecke wirksam zu machen |
| 9 | `softReset(cb)`: Prestige ohne Warteschlangenpflicht (baut Wartendes trotzdem ein) | `Singularity.ts:185-195` | alle | nur Favor-Ernte ohne Augs - im V2 ohne Ertrag |
| 10 | Prestige: alle sechs Skills -> 1, Exp -> 0 (Startexp fuer Stufe 1) | `PlayerObjectGeneralMethods.ts:80-99`, `Prestige.ts:43-52,198` | alle | HAUPTKOSTEN im V2: Kampfwerte weg |
| 11 | Prestige: Geld -> 1000 + Donations (1.262), gekaufte Server weg, home-RAM/Kerne bleiben | `PlayerObjectGeneralMethods.ts:102,108`, `Prestige.ts:72-80` | alle | Restgeld verfaellt |
| 12 | Prestige: Faktionsruf -> Favor, Ruf 0, Mitgliedschaft weg (ausser keepOnInstall-Einladungen) | `Faction/Faction.ts:77-85`, `Prestige.ts:61-67,104-121` | alle | Favor hebt Arbeits- UND Passivrate (`FactionHelpers.tsx:157`: min(0,1; favor/1000+0,01)) |
| 13 | Prestige Bladeburner: nur `resetAction` + Wiederbeitritt (Rang >= 25), Rang/Faehigkeiten bleiben; Bladeburners-Ruf aber 0 (Nr. 12) | `Bladeburner.ts:259-263`, `Prestige.ts:152-155` | V2 | BB-Augs nach jedem Einbau erst wieder ueber neuen Rang erreichbar |
| 14 | Prestige: alle Hacknet-Server und Hash-Upgrades weg; der SF9.3-Gratisserver (L100/10 Kerne/Cache 5) kommt NUR beim Knotenwechsel | `PlayerObjectGeneralMethods.ts:130-131`, `Hacknet/HashManager.ts:80-88`, `Prestige.ts:328-339` | alle mit SF9 | Einbaukosten im V2 (Hashes -> Rang); Hash-Tauschzaehler fallen auf 0 (Tausch wieder billig) |
| 15 | Prestige: Sleeves werden auf Schockerholung/Sync gesetzt (Auftrag weg) | `PlayerObjectGeneralMethods.ts:122` | alle | Neuzuteilung noetig |
| 16 | Prestige: Entropie, Karma, Gang, Int, home-RAM bleiben | `Prestige.ts:127-144`, `PlayerObjectGeneralMethods.ts:143-175` | alle | Entropie gilt bis zum Knotenende |
| 17 | Startgeld/Programme aus installierten Augs (CashRoot 1 Mio + BruteSSH, Neurolink, PCMatrix) | `Prestige.ts:85-92`, `Augmentations.ts:320-326,1204-1216,1406-1421` | alle | klein |
| 18 | Formulas.exe nach jedem Einbau (SF5) | `Prestige.ts:93-95` | alle | gratis |
| 19 | Grafting: Zugang BN10 oder SF10; New Tokyo; Preis baseCost x 3 (KEIN BN-Aufschlag, KEINE Treppe, KEIN Ruf); Zeit ((1 h x log2(max(Summe Mults!=1;1)) + 30 min)/2) / (1+Int^0,8/600) / Fokusfaktor | `PlayerObjectGeneralMethods.ts:577-579`, `NetscriptFunctions/Grafting.ts:17-95`, `PersonObjects/Grafting/GraftableAugmentation.ts:20-30`, `GraftingHelpers.ts:23-30`, `Work/GraftingWork.tsx:40-46`, `Constants.ts:96-97` | alle (SF10.3) | Kampf-Augs ohne Ruf und ohne Einbau |
| 20 | Graft wirkt SOFORT (`applyAugmentation`), kein Reset, zaehlt als installiert | `GraftingWork.tsx:48-64` | alle | kein Wiederaufbau - der eigentliche V2-Hebel |
| 21 | Entropie: je Graft alle Mults x0,98 (auch bladeburner_*), Kosten-Mults /0,98 | `GraftingWork.tsx:61-64`, `Grafting/EntropyAccumulation.ts:6-47`, `Constants.ts:104` | alle | begrenzt den Nutzen kleiner Grafts |
| 22 | violet Congruity Implant: nur graftbar (150 Bio), loescht Entropie | `Augmentations.ts:391-399`, `AugmentationHelpers.ts:45-49` | alle | auf der Route unbezahlbar |
| 23 | Bladeburner-Sonderaugs graftbar, solange Mitglied der Bladeburners | `GraftingHelpers.ts:7-21` | V2 | Tesla/Hyperion/Vangelis ohne Ruf |
| 24 | The Blade's Simulacrum: Bladeburner-Aktion UND Spielerarbeit gleichzeitig | `Bladeburner.ts:178-180,1354-1360`, `Augmentations.ts:284-296` (1.250 Ruf, 150 Mrd) | V2 | Arbeitskanal (Gym, Faktion, Graft) neben dem Rang |
| 25 | SF7.3 schenkt das Simulacrum beim Divisionsbeitritt (installiert) | `PlayerObjectBladeburnerMethods.ts:13-19`, `BitNode.tsx:271` | ab BN14 (nach 7.3): 14, 13, 15 | gratis |
| 26 | Neuroreceptor Management Implant: keine Fokusstrafe (sonst x0,8 auf Arbeit UND Graft) | `PlayerObjectGeneralMethods.ts:622-628`, `Constants.ts:87`, `Augmentations.ts:1230-1240` | alle | Graft/Arbeit ohne Fokus voll |
| 27 | Bladeburner-Faktionsaugs (isSpecial): Ruf aus Rang | `Augmentations.ts:190-296,536-548,711-726,779-793,950-975,1000-1014,1348-1361,1980-2000` | V2 | bladeburner_success_chance bis x1,1, Ausdauer |
| 28 | Kampf-Augs (str/def/dex/agi und _exp) in Faktionskatalogen | `Augmentations.ts` (36 Stueck, `tools/audit/aug-data.mjs`) | alle | competence |
| 29 | Abfragen: `getAugmentationStats/Prereq/Price/RepReq/BasePrice/Factions/FromFaction`, `getOwnedAugmentations(true/false)` (NFG-Stufen wartend je ein Eintrag) | `Singularity.ts:79-168` | alle | Entscheidungsgrundlage |
| 30 | Gang-Faktion fuehrt fast alle Nicht-Sonderaugs, in BN2 zusaetzlich The Red Pill | `FactionHelpers.tsx:172-202`, `Singularity.ts:100-127` | BN2 (ohne Karmaschwelle), sonst ab SF2 | Bereich GANG |
| 31 | BN15: Daedalus fuehrt keine Red Pill | `FactionHelpers.tsx:204-207` | BN15 | V2-Route, ohne Belang |
| 32 | Daedalus-Schwelle (installierte Stuecke, NFG einmal): 30, BN6/7 35, BN15 20 | `BitNode.tsx:714,756,1106` | V1 | nur BN8 |
| 33 | The Red Pill haengt w0r1d_d43m0n erst nach dem Einbau ans Netz | `Prestige.ts:173-181` | V1 | nur BN8 |
| 34 | Sleeve-Augs: nur Nicht-Sonderaugs mit relevanten Mults, Preis = baseCost (keine Treppe, kein BN-Aufschlag), Sleeve-Exp -> 0, Schock muss 0 sein, ueberleben Spieler-Einbauten | `PersonObjects/Sleeve/Sleeve.ts:90-170,213-224,228-256,348-400`, `NetscriptFunctions/Sleeve.ts:225-270` | alle (SF10) | Bereich SLEEVE |
| 35 | Stanek-Augs (Genesis x0,9; Awakening/Serenity RELATIV 0,95/0,9 und 1/0,95); Church-Bann ausserhalb BN13 sobald ein Nicht-NFG-Aug installiert | `Augmentations.ts:1593-1706`, `Prestige.ts:183-190` | BN13 | Bereich STANEK |
| 36 | SoA-Augs (Infiltration): eigene Preisformel 7^n, zaehlen nicht zur Treppe | `AugmentationHelpers.ts:17-37,141-154` | alle | Bereich Infiltration |
| 37 | Unstable Circadian Modulator: Zufallsbonus (u. a. Kampf x1,25 + Exp x2), bei jedem Prestige neu | `Augmentation/CircadianModulator.ts`, `Prestige.ts:116` | alle (Speakers, 362.500 Ruf) | im V2 ausser Reichweite |
| 38 | Rang -> Bladeburners-Ruf = 2 x Rang x faction_rep x (1+Favor/100) | `Bladeburner/Formulas.ts:46-48` | V2 | Favor der Bladeburners waechst je Einbau |
| 39 | Passivruf je Faktion ~ Arbeitsrate x min(0,1; favor/1000+0,01) x FactionPassiveRepGain | `FactionHelpers.tsx:132-170` | BN2: 0 (`BitNode.tsx:581`), sonst 1 | im V2 die einzige Rufquelle neben Vertraegen |
| 40 | Int-Exp aus Kauf/Einbau/Graft | `Singularity.ts:180,207`, `GraftingWork.tsx:85-90` | alle | klein |

Nebenbefund zur Rechengrundlage: Die NFG-Wirkung ist im laufenden Spiel exakt die
der Referenz (x1,0100026 je Stufe). Der Restfaktor x1,00702 auf allen Mults in
jedem Spielstand ist **SF-1 mit 7 Exploits** (`Exploits/applyExploits.ts:4-40`,
1,001^7; `p.exploits` = UndocumentedFunctionCall, INeedARainbow, Bypass,
TimeCompression, TrueRecursion, N00dles, PrototypeTampering). Die Notiz
`nodes/ERLEDIGT.md:1195-1199` ("NeuroFlux gibt 1,0198 je Stufe ... Referenzquellcode
weicht ab ... ueber 60 Stufen Faktor 2,4") ist damit falsch.

---

## 2. Abdeckungsmatrix

| # | Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil |
|---|---|---|---|---|---|
| 1 | Kauf | `src/bn4rep.js:1737-1745` | alle, jede Runde | OPTIMAL | Ausfuehrung korrekt; Auswahl/Zeitpunkt siehe 2 |
| 2 | Preistreppe/Reihenfolge | `src/bn4rep.js:1737` (absteigend nur je 15-s-Runde) | alle | SUBOPTIMAL | kauft ueber den Zyklus billig zuerst (AUG-4) |
| 3 | SF11-Rabatt | Preise live (`bn4rep.js:675-676`) | ab BN11.2 | OPTIMAL | nichts hart verdrahtet im Live-Pfad (1,9 nur in `buyaugs.js`, nicht in der Registry) |
| 4 | BN-Kostenmults | Preise live | alle | OPTIMAL | - |
| 5 | Vorbedingungen | Kauf schlaegt bei fehlendem Vorgaenger still fehl, naechste Runde klappt es (`bn4rep.js:1740`); H2-Fueller prueft (`:1577-1578`) | alle | OPTIMAL | - |
| 6 | NFG | `src/bn4rep.js:1655-1691` (nur im Einbaublock, nach allem anderen) | alle | OPTIMAL | im V2 richtig: zuletzt, Geld als Grenze (BN2.1: 8 Stufen fuer 6,0 Mrd) |
| 7 | SF12-Geschenk | - (passiv) | alle | NICHT ANWENDBAR | keine Entscheidung |
| 8 | Einbau | `src/bn4rep.js:1370-1376,1722` | alle; V2 nach Beitritt + `kampfEinbauSperre` | SUBOPTIMAL | Ausloeser ohne Nutzen/Preis-Rechnung (AUG-5) |
| 9 | softReset | - (`punish.js:206` bewusst nicht gebaut) | - | NICHT ANWENDBAR | im V2 nur Kosten |
| 10 | Skills-Reset | Sperren `src/bn4rep.js:933-943,1007-1038`, `src/lib/endspurt.js:322-332` | V2 | SUBOPTIMAL | Schranke statt Rechnung (AUG-5) |
| 11 | Geld/Server-Reset | Ausgangs-Interlock `src/lib/endspurt.js:249-288` | alle | OPTIMAL | - |
| 12 | Favor aus Ruf | `src/bn4rep.js:1112-1142` (`favorLohnt`) | alle | SUBOPTIMAL | rechnet die ARBEITSrate, im V2 wird nicht gearbeitet; Passivrate (Nr. 39) nicht modelliert |
| 13 | Bladeburner-Prestige | `src/blade.js` setzt die Aktion neu | V2 | OPTIMAL | - |
| 14 | Hacknet-Reset beim Einbau | - (Einbauentscheidung kennt es nicht) | V2 mit SF9 | SUBOPTIMAL | Kostenposten fehlt (AUG-5) |
| 15 | Sleeve-Reset | `src/sleeve.js` (30-s-Takt) | alle | OPTIMAL | - |
| 16 | Entropie bleibt | - | nur mit Grafting | NICHT ANWENDBAR | Grafting aus |
| 17 | Startgeld/Programme | - (passiv) | alle | NICHT ANWENDBAR | - |
| 18 | Formulas.exe | - (passiv) | alle | NICHT ANWENDBAR | - (darkweb ueberspringt vorhandene) |
| 19 | Grafting | `src/graftauto.js` (Registry `src/registry.json:366`, V2, `requiresFile: graftplan.json`), Zuender in `data/nicht-schieben.txt:28` | NIRGENDS (Datei liegt nicht auf home, Spielstand 09:59) | NICHT GENUTZT | groesster ungenutzter Hebel (AUG-1) |
| 20 | Graft ohne Reset | wie 19 | - | NICHT GENUTZT | AUG-1 |
| 21 | Entropie | `src/graftplan.json` (Reihenfolge ohne Entropie-/Restzeit-Stopp) | - | NICHT GENUTZT | Plan mit Nettoverlust-Schwanz (AUG-2) |
| 22 | Congruity | `src/graftplan.json` "vorzug", `src/lib/graftwahl.js:94-123` | - | NICHT ANWENDBAR | 150 Bio unerreichbar, blockiert richtigerweise nicht |
| 23 | BB-Augs graftbar | im Plan | - | NICHT GENUTZT | AUG-1 |
| 24 | Simulacrum | Kauf nur zufaellig (`kampfknotenNuetzlich` true, `src/lib/hackaugs.js:347`; `combatNutzen` 0, `istEinbauWertvoll` false); Wirkung nur fuer den Graft-Riegel genutzt (`src/blade.js:3935`, `src/graft.js:51-57`) | V2 | NICHT GENUTZT | Arbeitskanal bleibt leer (AUG-3) |
| 25 | SF7.3-Geschenk | wie 24 | 14, 13, 15 | NICHT GENUTZT | AUG-3 |
| 26 | NMI | nicht im Plan, `fokusEntscheidung` nur V1 (`src/lib/einbau.js:397-404`) | - | NICHT GENUTZT | Graft mit `focus=true` (`src/graft.js:216`); klein |
| 27 | BB-Faktionsaugs kaufen | `src/bn4rep.js:672` + Kaufschleife | V2 | SUBOPTIMAL | Treppe (AUG-4); Kauf statt Graft (AUG-1) |
| 28 | Kampf-Augs kaufen/bewerten | `src/lib/hackaugs.js:204-312` | V2 | SUBOPTIMAL | Tabelle stimmt mit dem Quellcode (Diff 0 fuer alle kaufbaren), Bewertung grob (AUG-7) |
| 29 | Abfragen | `src/bn4rep.js:600-601,675-676,1318,1577` | alle | OPTIMAL | - |
| 30 | Gang-Katalog | - (kein ns.gang) | BN2 | NICHT GENUTZT | Bereich GANG |
| 31 | BN15 ohne TRP | - | 15 | NICHT ANWENDBAR | V2 |
| 32 | Daedalus-Schwelle | `src/lib/einbau.js:69-96,120-123`, `src/bn4rep.js:1552-1608` | V1; Fueller laeuft auch im V2 | OPTIMAL | V1 richtig; V2-Rest siehe AUG-6 |
| 33 | Red Pill | `src/bn4rep.js:1272`, `src/lib/einbau.js:200-202` | V1 | NICHT ANWENDBAR | V2-Route; BN8 spaeter |
| 34 | Sleeve-Augs | fehlt (grep `purchaseSleeveAug` 0 Treffer) | - | NICHT GENUTZT | Schock-Huerde, Bereich SLEEVE (AUG-8) |
| 35 | Stanek-Augs | `src/lib/hackaugs.js:254-256` (falsche Werte) | 13 | NICHT ANWENDBAR | Bereich STANEK; Tabellenfehler in AUG-7 |
| 36 | SoA-Augs | - | - | NICHT GENUTZT | Bereich Infiltration |
| 37 | Circadian Modulator | - | - | NICHT ANWENDBAR | 362.500 Ruf im V2 ausser Reichweite |
| 38 | Rang -> Ruf | - (passiv) | V2 | OPTIMAL | - |
| 39 | Passivruf/Favor | `src/bn4rep.js:2199-2218` (Messung schlaegt Formel) | V2 | SUBOPTIMAL | im V2 ist die gemessene Rate richtig (A9 betrifft nur V1); Favor-Wert fuer den Passivruf im Einbau-Ausloeser nicht modelliert (Teil AUG-5) |
| 40 | Int-Exp | - (passiv) | alle | NICHT ANWENDBAR | - |

Zaehlung: OPTIMAL 12, SUBOPTIMAL 8, NICHT GENUTZT 10, NICHT ANWENDBAR 10, TOT 0.
Toten Code habe ich in diesem Bereich nicht gefunden: der V2-Zweig von bn4rep
(Kandidatenfilter, Sperren, Einbau) ist erreichbar und im Spielstand 09:59 belegt
(`data/einbau.json`: `kampfknoten true, wiederaufbauHilfe true, kampfZuFrueh true`;
`data/bn4rep.json` mit V2-gefilterter Rangliste).

---

## 3. Befunde

### AUG-1 [NICHT_GENUTZT, P1] Grafting ist im Kampfknoten abgeschaltet - der groesste Aug-Hebel aller 23 V2-Laeufe

- **Bot:** `src/registry.json:366` (graftauto V2, `precondition.requiresFile: graftplan.json`),
  `data/nicht-schieben.txt:28` (Zuender, "Erics Entscheidung", seit 04.09.2026),
  `src/graftauto.js:100-115` (ohne Plan: `state done`). Im Spielstand 09:59 liegt
  `graftplan.json` nicht auf home; Entropie 0 in allen V2-Laeufen seit BN10.1
  (BN10.2: 0, BN9.3: 0).
- **Spiel:** Nr. 19-21, 23 oben. Kernpunkt `GraftingWork.tsx:48-64`: Wirkung sofort,
  KEIN Einbau, also kein Kampfwert-Reset - genau die Kosten, die im V2 jeden Kauf
  teuer machen. Preis `baseCost x 3` ohne Treppe, ohne Ruf, ohne `AugmentationMoneyCost`.
- **Rechnung** (`aug-graft.mjs`, Stand 09:59, Int 153, competence geeicht):
  - SPTN-97: 14,63 Mrd, 1,61 h, competence **x1,443** (inkl. Entropie). Amortisation
    der Rangpause (ohne Simulacrum steht der Motor, `blade.js:3935`): **2,9 h (k=1,2)
    bis 8,0 h (k=0,5)** bei 330 Rang/h.
  - Die ersten 8 Plan-Grafts: **x5,15** competence in 10,0 h Graftzeit fuer 79,5 Mrd
    (BN2.1-Einkommen 6,4 Mrd/h: rund 12 h Einkommen). Rang/h x2,3 (k=0,5) bis x7,1 (k=1,2).
  - Geld-Gleichstand Graft gegen Kauf: `3 = 1,9^q x AugmentationMoneyCost`. BN2/6/13:
    ab dem 2. Stueck eines Zyklus (q*=1,7; mit SF11.3 1,9), BN14: q*=1,2, BN11: q*=0,6,
    **BN3/7/15: immer** (q*=0). Dazu entfallen Ruf und Wiederaufbau.
- **Bewertung:** Kein Fehler im Code, sondern eine offene Entscheidung, die seit einem
  Monat in jedem V2-Knoten Zeit kostet. Vor dem Zuenden muessen AUG-2 (Planschwanz,
  Stoppregel) und die Simulacrum-Frage (AUG-3) erledigt sein.
- **Ertrag:** Rang/h x2,3-7 nach rund 12 h Grafting je V2-Lauf (GERECHNET_UNGEEICHT:
  competence geeicht, Rangmodell nicht). Auf 23 V2-Laeufe (BN9.3 dauerte 53,6 h)
  ist das der groesste Posten dieses Bereichs.
- **calc_spec:** Rangmodell aus `Bladeburner/Actions/Action.ts:105-122,169-196`,
  `Bladeburner.ts` (Stufenfreischaltung `maxLevel`, Zaehlerwachstum, Ausdauer
  `:1318-1330`) mit der Aktionswahl von `blade.js`; eichen gegen den Rangverlauf
  BN9.3 (Rang 781 @21,9 h, 4.454 @27,5 h, 24.184 @41,4 h, 623.300 @53,6 h) und
  BN2.1 (329 Rang/h zwischen 08:33 und 09:59). Dann Knotenzeit mit/ohne Graftplan.

### AUG-2 [RISIKO, P2] `graftplan.json` bewertet weder Entropie noch Restlaufzeit - Schwanz mit Nettoverlust, 42 h Graftzeit ohne Stopp

- **Bot:** `src/graftplan.json` (39 Eintraege, hergeleitet 30.08. in BN10), Auswahl
  `src/lib/graftwahl.js:76-140` (erster offener Eintrag, nur Geld- und
  Sprungzeit-Pruefung `passtInDieZeit`), kein Simulacrum, kein NMI im Plan.
- **Spiel:** `EntropyAccumulation.ts:6-47` (x0,98 auf ALLE Mults, auch
  `bladeburner_stamina_gain`/`max_stamina`/`success_chance`), `Prestige.ts:127-128`
  (Entropie ueberlebt Einbauten).
- **Rechnung** (`aug-graft.mjs`, Plan der Reihe nach auf dem BN2.1-Stand):
  - Gesamt 42,2 h (fokussiert; ohne Fokus /0,8 = 52,8 h), 417,5 Mrd, competence x28,8.
  - **LuminCloaking-V1: Grenzfaktor x0,968 (Nettoverlust).** Die letzten fuenf
    Eintraege (Vangelis Virus, Vangelis 3.0, Power Recirculation Core, Lumin V1/V2)
    kosten 6,7 h Graftzeit fuer zusammen x0,986 - netto negativ. Ohne Simulacrum
    sind das 6,7 h ohne Rang zu einem Zeitpunkt, an dem die Rangrate am hoechsten ist.
  - Endstand Entropie 39 (x0,455): `bladeburner_stamina_gain` x0,497,
    `bladeburner_max_stamina` x0,478, `bladeburner_success_chance` x0,805 - in der
    competence-Zahl steckt die Ausdauer NICHT; der Ausdauerverlust wirkt zusaetzlich
    auf den Aktionsdurchsatz.
  - Gierige Alternative (Grenzfaktor^k je Stunde, Stopp bei Nettoverlust) bricht vor
    Lumin V1 ab; die Plan-Reihenfolge der ersten ~30 ist nahe am gierigen Optimum.
- **Fix-Richtung:** je Graft `Grenzfaktor^k - 1 > Graftzeit x Rangrate / (Rangrate x
  Restzeit)` verlangen (ohne Simulacrum), sonst Stopp; Lumin V1/V2 und Vangelis 1
  streichen; Simulacrum als Kandidat mit eigener Rechnung (AUG-3).
- **Ertrag:** vermeidet bis 6,7 h Rangpause + 1,4 % competence je V2-Lauf, sobald
  AUG-1 gezuendet wird (GERECHNET_UNGEEICHT).

### AUG-3 [NICHT_GENUTZT, P2] The Blade's Simulacrum wird weder gezielt beschafft noch genutzt - ab BN14 ist es geschenkt und der Arbeitskanal bleibt leer

- **Bot:** `src/bn4rep.js:496` (`bladeSperreArbeit = bladeburnerTraegtHier` - Faktionsarbeit
  im V2 immer aus, ohne Blick auf das Simulacrum), `src/blade.js:4183-4206` (Gym-Zweig
  `continue` OHNE Bladeburner-Aktion, auch mit Simulacrum; `gymGreifen` stoppt die Aktion
  bedingungslos, `src/blade.js:1451`), `src/lib/hackaugs.js:347`
  (Simulacrum nur "nuetzlich", `combatNutzen` 0, `istEinbauWertvoll` false in
  `src/lib/einbau.js:334-339`) - gekauft wird es nur, wenn es zufaellig bezahlbar ist.
- **Spiel:** `Bladeburner.ts:178-180,1354-1360` (nur OHNE Simulacrum schliessen sich
  Aktion und Arbeit aus), `PlayerObjectBladeburnerMethods.ts:13-19` (SF7.3: installiert
  beim Beitritt). Gym-Exp `Work/Formulas.ts:108-121`: 10/s x str_exp-Mult in Powerhouse,
  ClassGymExpGain wird nicht angewandt.
- **ENTSCHIEDEN-Bezug:** "Gym und Bladeburner parallel: unmoeglich" (BAUSTELLEN Z. 28) ist
  ohne Simulacrum gemessen (`nodes/HEBEL.md` zur Ruecknahme 9703d3c nennt das Simulacrum
  selbst als den Schluessel). Neue Fundstelle: `PlayerObjectBladeburnerMethods.ts:13-19` -
  ab BN14 ist die Bedingung in 9 Laeufen automatisch erfuellt.
- **Rechnung** (`aug-simulacrum.mjs`):
  - Bladeburner-Exp heute 5.238/h je Wert (gemessen 08:33-09:59), Gym reihum parallel
    +12.909/h je Wert -> Exp-Zuwachs **x3,46**, competence nach 10-40 h **x1,13** ->
    Rang/h **x1,06 (k=0,5) bis x1,16 (k=1,2)**.
  - Wiederaufbau bis Tiefstand 100 nach jedem Einbau (heute ohne Rang): BN2/3/6/7/11
    19 min, BN13/15 52 min, **BN14 185 min** - mit Simulacrum parallel zur Aktion.
  - Beschaffung vor SF7.3: Kauf 150 Mrd x 1,9^q x AugMoneyCost (BN3/7 x3 = 450 Mrd),
    Graft 450 Mrd / 13,7 min. Im BN2.1-Stand steht es durch die vier Kleinstuecke bei
    1.955 Mrd (AUG-4).
- **Ertrag:** +6-16 % Rang/h in BN14/13/15 (9 Laeufe) plus 0,3-3 h je Einbau
  (GERECHNET_UNGEEICHT). Vor BN14 haengt der Wert an AUG-1 (Grafting ohne Rangpause).
- **calc_spec:** Rangmodell wie AUG-1; zusaetzlich: lohnt der Simulacrum-Kauf/-Graft
  in BN2/3/11/6/7 gegen dieselben Mrd in Kampf-Grafts? Eingaben: Einkommen je Knoten
  (BN2.1 6,4 Mrd/h aus moneySourceA), Graftzeit des Plans, Rangrate.

### AUG-4 [SUBOPTIMAL, P2] Kampfknoten: verdiente Stuecke werden sofort gekauft - die Treppe macht teure V2-Stuecke unerreichbar (A8 mit V2-Zahlen)

- **Bot:** `src/bn4rep.js:1737-1745` (absteigend nur innerhalb einer Runde, kauft alles
  Verdiente und Bezahlbare), Filter `src/bn4rep.js:672` /
  `src/lib/hackaugs.js:346-350` (jedes Stueck mit `combatNutzen > 0`, Hacknet-Stuecke mit
  SF9, ohne Wert je Warteschlangenplatz).
- **Spiel:** `AugmentationHelpers.ts:32-37,156-158`; Kaufen bringt vor dem Einbau nichts
  (wirkt erst installiert), also ist "alles im Einbaublock, teuerste zuerst" schwach
  dominant (Ruf und Geld bleiben bis zum Einbau stehen).
- **Rechnung** (`aug-order.mjs`, geeicht exakt):
  - BN2.1: Wired Reflexes (0,85 h) -> Neurotrainer I -> EsperTech -> EMS-4 = **2,49 Mrd
    statt 0,62 Mrd (x4,02)**. Im heutigen Stand ohne Folge: die NFG-Schleife bekommt in
    beiden Faellen 8 Stufen (naechste kostet 7,0 Mrd).
  - Simulacrum (verdient, 5.405 Bladeburners-Ruf >= 1.250): **1.955 Mrd statt 150 Mrd**.
  - Beispiel naechster Zyklus: werden Hyperion V2, INTERLINKED, Blade's Runners, Energy
    Shielding (Grundpreis 5,5-8,25 Mrd) im Zyklus verdient, kosten sie hinter den vier
    Kleinstuecken das 13-fache (q=4) - mit ~70 Mrd Zyklusbudget sind dann 1-2 statt 4
    kaufbar. competence-Unterschied der beiden Sets x1,168 gegen x1,093 (rund +7 %).
- **known_before:** A8 (`nodes/AUDIT-PERFEKT-2026-09-26.md`, 3#8). Neu: im V2 ist der
  Schaden nicht der Geldbetrag, sondern der Ausschluss der teuren Bladeburner-Stuecke
  und des Simulacrum; mit Grafting (AUG-1) sollten Kampfstuecke ab q* ohnehin gegraftet
  statt gekauft werden.
- **Ertrag:** bis ~+7 % competence je Einbauzyklus im V2 (GESCHAETZT, haengt am Ruf-
  verlauf der Bladeburners).

### AUG-5 [SUBOPTIMAL, P2] Einbau im Kampfknoten: Schranken statt Nutzen-Preis-Rechnung; Gewinnschwelle ~14 h, Endspurt-Sperre nur 186 min

- **Bot:** Ausloeser `src/bn4rep.js:1370-1376`; V2-Sperren `:933-943` (Beitritt),
  `:1007-1038` + `src/lib/endspurt.js:322-332` (Aufbau < 100 oder < max(12 h, 2 x Aufbau)
  seit dessen Ende), `:1306-1330` (`wiederaufbauHilfe`), Gruende `lueckeZuGross`
  (`:1202-1205`, Hackarbeits-Formel, obwohl im V2 nicht gearbeitet wird), `favorLohnt`
  (`:1112-1142`, Arbeitsrate), Endspurt `src/lib/endspurt.js:241,249-288`
  (`WIEDERAUFBAU_MIN` 186, greift im V2 nur bei sicherer ETA).
- **Spiel:** Nr. 10-15 oben.
- **Rechnung** (`aug-einbau-v2.mjs`, Stufen exakt geeicht, Rang k=1,2):
  Einbau jetzt mit den 4 wartenden + 8 NFG-Stufen (str/def x1,083, dex x1,194,
  agi x1,137, Exp x1,191, bb x1,061): Gym-Phase 12 min, Rangrueckstand groesster bei
  4 h (-239 Rang), **Gewinnschwelle 13,8 h** (k=1: 14,4 h); nach 48 h +2.069 Rang
  (+10 %). **Ohne die NFG-Stufen: 39,5 h.** Nicht im Modell und alle zu Lasten des
  Einbaus: der SF9.3-Gratisserver (0,48 Hash/s = die ganze Hash-Produktion in BN2.1)
  ist nach dem ersten Einbau fuer den Rest des Knotens weg (`Prestige.ts:328-339` nur
  beim Knotenwechsel); niedrigere Aktionsstufen nach dem Einbau liefern weniger Exp je
  Aktion; Bladeburners-Ruf faellt auf 0.
- **Bewertung:** Die 12-h-Schranke liegt zufaellig nahe der Gewinnschwelle, aber (1) ein
  Einbau in den letzten ~14 h eines V2-Knotens kostet Rang, und die Endspurt-Sperre
  (186 min, nur bei sicherer ETA) faengt das nicht; (2) ein Einbau mit 3 Kleinstuecken
  ohne NFG (BN2 nach dem ersten Einbau: Ruf 0, kein Passivruf `BitNode.tsx:581`) braucht
  ~40 h; (3) die Gruende `lueckeZuGross`/`favorLohnt` sind V1-Heuristiken ohne Bezug zum
  Rang.
- **known_before:** BAUSTELLEN "Der Einbau-Ausloeser in `bn4rep.js` kennt seinen Preis
  nicht (30.08., 15:45)" - offen; `kampfEinbauSperre` (22.09.) ist dort selbst als
  "Schranke, keine gerechnete Optimalstelle" beschrieben. Neu: Gewinnschwelle mit
  BN2.1-Zahlen, NFG-Abhaengigkeit, Hacknet-Posten.
- **Ertrag:** je V2-Lauf 0,5-2 h (falscher spaeter Einbau vermieden bzw. frueherer
  guter Einbau), GERECHNET_UNGEEICHT.
- **calc_spec:** `aug-einbau-v2.mjs` mit dem Rangmodell aus AUG-1 statt `competence^k`;
  Exp je Aktion aus `Bladeburner.ts` (completeAction, `difficultyMultiplier`) statt
  konstanter Rate; eichen gegen die Einbauten BN9.3 (16:21, 20:38, 14:19, 04:17 mit
  den jeweils folgenden Spielstaenden).

### AUG-6 [RISIKO, P3] Daedalus-Fuellstueck laeuft auch im Kampfknoten - in BN15 (Schwelle 20) verteuert es die NFG-Schleife

- **Bot:** `src/bn4rep.js:1552-1608` (kein V2-Tor; Kandidaten aus ALLEN Faktionskatalogen,
  nicht `kampfknotenNuetzlich`-gefiltert), `src/lib/einbau.js:120-123,146-155`.
- **Spiel:** Daedalus nur fuer V1 (`BitNode.tsx:1106`: BN15 = 20). Das Fuellstueck wird
  VOR der NFG-Schleife gekauft (`:1595` vor `:1662`) und macht jede NFG-Stufe x1,9 teurer.
- **Folge:** Landet ein V2-Einbau in BN15 bei 19 verschiedenen Stuecken, kauft der Bot das
  billigste verdiente Stueck beliebiger Art (z. B. ein Hackstueck) und verliert rund
  0,85 NFG-Stufen (log(1,9)/log(2,166)) - etwa -0,85 % auf alle Kampfwerte.
  BN9.3 endete mit 27 installierten, die Lage ist erreichbar.
- **Fix:** Fuellblock nur, wenn `!bladeburnerTraegtHier()`.
- **Ertrag:** klein, ~1 % Kampfwerte in betroffenen BN15-Zyklen (GESCHAETZT).

### AUG-7 [SUBOPTIMAL, P3] `combatNutzen` grob: Abklingexponent 0,9 statt 0,8, Stanek-Werte absolut statt relativ

- **Bot:** `src/lib/hackaugs.js:294` (`Math.pow(f, 0.9)`), `:254-256` (Stanek Awakening
  0,95, Serenity 1).
- **Spiel:** alle 21 Black Ops `decays.strength..agility = 0,8`
  (`data/BlackOperations.ts`, z. B. Typhoon :24-31, Daedalus :721-728); Operationen 0,8-0,91.
  `Augmentations.ts:1631-1706`: Awakening/Serenity sind RELATIV (0,95/0,9 = x1,0556 und
  1/0,95 = x1,0526), nicht absolut. COMBAT_AUGS stimmt sonst fuer alle kaufbaren Stuecke
  exakt mit dem Quellcode (Diff in `tools/audit/aug-data.mjs`-Abgleich: 0).
- **Folge:** Stat-Stuecke gegen `bladeburner_success_chance` um ~10 % ueberbewertet;
  Stanek-Stufen 2/3 in BN13 als 0 bzw. Malus gelesen. Wirkung auf die Wahl klein, weil
  ohnehin fast alles Verdiente gekauft wird (AUG-4).
- **Ertrag:** < 1 % (GESCHAETZT).

### AUG-8 [NICHT_GENUTZT, P3] Sleeve-Augs werden nie gekauft

- **Bot:** fehlt (`purchaseSleeveAug` / `getSleevePurchasableAugs`: 0 Treffer in `src/`).
- **Spiel:** `Sleeve.ts:392-400` Preis = baseCost (keine Treppe, kein BN-Aufschlag),
  `:213-224` sofort installiert (Sleeve-Exp -> 0), `:228-256` nur beim Knotenwechsel
  zurueckgesetzt (ueberlebt Spieler-Einbauten), `:356-361` **Schock muss 0 sein**.
  Im Spielstand 09:59: Schock 100 / 98,5 / 99,3.
- **Bewertung:** haengt an der Sleeve-Schock-Frage (BAUSTELLEN "Sleeve-Shock steht nach
  dem Einbau auf 99,9 - Recovery lohnt trotzdem nicht", 30.08.); im V2 tragen Sleeves
  Rang (Vertraege/Infiltration) mit eigenen Kampfwerten. Bereich SLEEVE.
- **calc_spec:** Sleeve-competence mit und ohne Kampf-Augs (Grundpreise 2,5 Mio-5 Mrd,
  `aug-data.mjs`) gegen die Zeit fuer Schock 100 -> 0 (`SleeveRecoveryWork`), eichen gegen
  Sleeve-Rangbeitrag aus den BN9.3-Spielstaenden.

---

## 4. Offene Punkte aus dem letzten Audit (A8, A9, E7, E8)

- **A8** (Kaufreihenfolge): neue Bewertung fuer V2 in AUG-4 (geeichte Zahlen). Im V1
  unveraendert offen.
- **A9** (Passivrate ersetzt Arbeitsformel): im V2 ist die gemessene Rate die RICHTIGE,
  weil nicht gearbeitet wird (`bn4rep.js:496`). A9 betrifft nur noch BN8 (V1) - dort vor
  dem Knoten neu ansetzen. Keine neue Messung.
- **E7** (Restgeld beim Einbau): V2-Zahl BN2.1: NFG-Schleife gibt 6,0 von 9,38 Mrd aus,
  **3,38 Mrd (36 %) verfallen**. Sinnvolle Senke im V2 waere ein Graft vor dem Einbau
  (bleibt erhalten) - nur mit AUG-1. Sonst unveraendert "erst messen".
- **E8** (levelNutzen bis Red Pill): reiner V1-Punkt, auf der Route nur BN8. Nicht neu bewertet.

## 5. Eichungsausgaben (Soll/Ist)

```
aug-mults.mjs (6 Spielstaende)
  BN2.1  09:59  1 Aug  : max. Abw. nur dnet_money (+3,03 %), sonst 0
  BN9.3  pre-jump 27 Augs: charisma -12,5 %, dnet_money +13,8 %, sonst 0
  BN10.3 pre-install 19 Augs: charisma -12,5 %, dnet_money +24,5 %, sonst 0
  BN12.3 2x pre-install: dnet_money +2,0 %, sonst 0
  BN5.3  pre-jump 54 Augs: charisma -22,6 %, dnet_money +98,7 %, sonst 0
aug-order.mjs
  EICHUNG 1  gezahlt laut moneySourceA: 2.491975 Mrd   nachgerechnet: 2.491975 Mrd   Abw 0
  EICHUNG 2  Simulacrum q=4: nachgerechnet 1954.815 Mrd   bn4rep.json 1954.815 Mrd   Abw 0
aug-graft.mjs
  Graft-Zeit (Int 96): Simulacrum 845690 ms (Telemetrie 845690), Graphene Legs 51,36 min (Telemetrie 51,3)
  strength-Mult 1,434299 vs Spielstand 1,434299
aug-einbau-v2.mjs
  Stufen hacking 372/372, strength 194/194, defense 181/181, dexterity 181/181, agility 181/181, charisma 57/57
  Exp-Zuwachs 08:33->09:59 (1,44 h): 5.238-5.240 je Wert/h, Rang 329/h
```
