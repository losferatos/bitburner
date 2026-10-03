# Inventar STGO - Stanek's Gift (CotMG) und IPvGO

Pruefer: Vollstaendigkeits-Audit 03.10.2026 (Systemzeit 11:03), streng lesend.
Spielquellcode: `reference/bitburner-src/src` (3.0.2). Spielstand: BN2.1, 5,3 h.
Rechner: `tools/audit/stgo-save-scan.mjs`, `stgo-probe.mjs`, `stgo-blade.mjs`
(geeicht), `stgo-go.mjs`, `stgo-stanek.mjs`, `stgo-gain.mjs`.

## Kurzurteil

- **Der Bot nutzt keines der beiden Systeme** (grep `src/`: kein `ns.go`, kein
  `ns.stanek`; nur Datentabellen und Hinweistexte, siehe Matrix). Kein Spielstand
  hat je eine Go-Partie oder ein Stanek-Fragment gesehen (`stgo-save-scan.mjs`:
  21 Staende, alle `go.stats = {}`, `fragments = 0`).
- **IPvGO ist in JEDEM BitNode ohne SF zugaenglich** (keine Pruefung in
  `NetscriptFunctions/Go.ts:43-133`, kein BitNode-Schalter) und kostet keine
  Spielerzeit. Der Tetrads-Bonus multipliziert die Kampf-Stufen-Multiplikatoren -
  genau die Groesse, an der V2 haengt. Geeichte Kette: +20 % Stufen-Mult =
  Typhoon-Chance x1,14 = so viel wie 2,3-mal die bisherige Kampf-Exp. In BN14
  (GoPower 4) und mit SF14 (x2) wird daraus ein Vielfaches. Groesster Hebel
  dieses Bereichs, aber Spielstaerke eines einfachen Skripts ungemessen.
- **Stanek lohnt in BN13 klar** (Kampf-Fragment Break-even bei 3 Faeden,
  bei 1.000 Faeden Chance x1,45) und in BN15 knapp. **Schlummernde Falle:**
  Mit SF7.3 (kommt vor BN13 auf der Route) sperrt der Bladeburner-Beitritt in
  `bbtrain.js:350` die Gabe fuer den ganzen Lauf, ebenso jeder Aug-Kauf
  (`bn4rep.js:1595/1740`, `kampfaugs.js:183`) und jedes fertige Graft
  (`graft.js:216`) vor `acceptGift`.
- Das "Entscheidungstor" fuer Stanek/Go (AUDIT-BAUSTELLEN-2026-09-06.md:265 L44,
  ARCHITEKTUR.md:1813-1814 O8/O9) steht in keiner Arbeitsliste
  (`BAUSTELLEN.md` grep leer). "Nur nach Messung" ist damit faktisch "nie".

---

## Tabelle 1 - Feature-Inventar aus dem Quellcode

Fundstellen relativ zu `reference/bitburner-src/src/`.

| # | Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag/Hebel |
|---|---|---|---|---|
| G1 | ns.go Spielzugang (resetBoardState/makeMove/passTurn/opponentNextTurn/getBoardState/getGameState) | `NetscriptFunctions/Go.ts:43-82`, `NetscriptFunctions.ts:153`; UI CIA Sector-12/DefComm New Tokyo `Locations/ui/SpecialLocation.tsx:466-475`; keine BitNode-Option (`bitNodeOptions` kennt nur disable* fuer Bladeburner/Corp/Gang/Hacknet/Sleeve) | **alle**, ohne SF | Voraussetzung fuer G2-G9; keine Spielerzeit, Echtzeit des Tabs |
| G2 | Bonus Tetrads: str/def/dex/agi (Stufen-Mult) | `Go/effects/effect.ts:82-87`, bonusPower 0,7 `Go/Constants.ts:244-251` | alle | V2: Black-Op-/Op-/Vertrags-Chance, Beitrittstor, maxStamina (effAgi^0,8, `Bladeburner.ts:1327-1333`) |
| G3 | Bonus Daedalus: faction_rep + company_rep | `effect.ts:88-91`, power 1,1 `Constants.ts:252-259` | alle | Rep fuer Aug-Kaeufe |
| G4 | Bonus Netburners: hacknet_node_money | `effect.ts:73-75`, power 1,3, komi 1,5 (leichteste KI) `Constants.ts:220-227` | alle | Hash-Rate -> "Exchange for Bladeburner Rank" (`Hacknet/data/HashUpgradesMetadata.tsx:90-98`, Bot nutzt es `hashes.js:96`) |
| G5 | Bonus Black Hand: hacking_money | `effect.ts:79-81`, power 0,9 | alle | Geld aus Hacking |
| G6 | Bonus Illuminati: hacking_speed; 5x5 gegen Illuminati Schwierigkeit x8 | `effect.ts:92-94`, `effect.ts:132-135` | alle | Hacking-Tempo |
| G7 | Bonus Slum Snakes: crime_success | `effect.ts:76-78` | alle | Verbrechen, go.cheat-Chance (`netscriptGoImplementation.ts:561-567`) |
| G8 | Gegner w0r1d_d43m0n: hacking (Stufe), power 2, 19x19 | `effect.ts:95-97`, `netscriptGoImplementation.ts:359-361` (nur mit installierter TRP), `Go.ts:160-168` | jeder BN nach TRP-Einbau (Route: BN8 V1) | Hacking-Stufe nach TRP |
| G9 | Effektformel `1 + ln(n+1)(n+1)^0,3 * 0,002 * power * GoPower * SF14` | `effect.ts:16-22` | alle | logarithmisch-potenziell in nodePower |
| G10 | GoPower 4 | `BitNode/BitNode.tsx:1042`; sonst 1 `BitNodeMultipliers.ts:97` | **BN14** | Bonus x4 |
| G11 | SF14: Bonus x2 (jede Stufe), maxRep 200k/300k/400k | `effect.ts:18`, `effect.ts:30-44`, Text `BitNode.tsx:490-509` | nach BN14.1: BN14.2/3, BN13, BN15, BN8 | Bonus x2 |
| G12 | nodePower-Zuwachs auch bei Niederlage (x0,5), Schwierigkeit (komi+0,5)/4, Serien-Multiplikator bis x3 / Durststrecke bis x5 | `Go/boardAnalysis/scoring.ts:86-91`, `effect.ts:119-135` | alle | Auch ein schwaches Skript sammelt Bestand |
| G13 | Favor aus Siegesserien: je 2. Serien-Sieg maxRep/200 Rep als Favor, sofort, nur als Mitglied | `scoring.ts:67-79`, `Faction/formulas/favor.ts` | alle | +81 Favor (SF14.0) bis +143 (SF14.3) je Faktion und Knoten |
| G14 | go.cheat.* | `netscriptGoImplementation.ts:487-497` (SF14.2+ oder BN14 mit SF14.1), Chance `:561-567` | ab BN14.2 | hoehere Siegquote |
| G15 | Analyse-Helfer (getValidMoves 8 GB, getChains/getLiberties/getControlledEmptyNodes 16 GB) | `NetscriptFunctions/Go.ts:83-133`, RAM `Netscript/RamCostGenerator.ts:303-336` | alle | Zugwahl |
| R1 | Reset: Einbau loescht nodePower/Siege/Serien (Rep-Zaehler bleibt), Knotenwechsel loescht alles | `Go/Go.ts:160-190`, `Prestige.ts:70, 209` | alle | Bonus ist BESTAND je Einbauzyklus |
| R2 | KI-Takt in Echtzeit: waitCycle 200 ms (40 ms nur mit Offline-Vorrat) | `Go/boardAnalysis/goAI.ts:877-883`, `Go.ts:196-200`, Offline-Speicher nur `engine.tsx:335` | alle | verdeckter Tab ohne Entdrosselung = ~0 Ertrag |
| R3 | Go-Mults nur auf Player, nicht auf Sleeves; Neuberechnung am Partieende | `effect.ts:59-63`, `scoring.ts:97-98`, `PlayerObjectAugmentationMethods.ts:8-25` | alle | - |
| S1 | acceptGift (2 GB): tritt der Kirche bei, installiert Genesis | `NetscriptFunctions/Stanek.ts:120-144`, `RamCostGenerator.ts:73`; keine Reise noetig | BN13; mit SF13 jeder BN (`PlayerObjectGeneralMethods.ts:603-605`, `BitNodeUtils.ts:17-19`) | Voraussetzung S3-S8 |
| S2 | Genesis-Malus 0,9 auf alle Stufen/Exp/Rep/Hacking | `Augmentation/Augmentations.ts:1593-1630` | wie S1 | -10 % |
| S3 | Annahme-Sperre: jede installierte ODER gekaufte Nicht-NFG-Aug; SF7.3 legt Blade's Simulacrum beim Divisionsbeitritt direkt in `augmentations`; Graft ebenso | `CotMG/Helper.tsx:59-74`, `PersonObjects/Player/PlayerObjectBladeburnerMethods.ts:14-19`, `Work/GraftingWork.tsx:51`, Hinweis `ScriptEditor/NetscriptDefinitions.d.ts:4026-4028`, `BitNode.tsx:469-471` | BN13/15 nach SF7.3 | irreversibel je Lauf |
| S4 | Gittergroesse `base = 9 + ExtraSize + SF13`, w = floor(base/2+1), h = floor(base/2+0,6), min 2x3 | `CotMG/StaneksGift.ts:22-31` | BN13: 6x5 / 6x6 / 7x6; BN15 (SF13.3): 6x5; BN8: 2x3 | Platz fuer Fragmente |
| S5 | Kampf-Fragmente str (T), def (L), dex (L), agi (S), je power 2, Stufe UND Exp | `CotMG/Fragment.ts:149-187`, Wirkung `StaneksGift.ts:155-170` | wie S1 | V2-Kernhebel |
| S6 | Bladeburner-Fragment (S, power 0,4): max stamina, stamina gain, analysis, success chance | `Fragment.ts:249-257`, `StaneksGift.ts:195-200` | wie S1 | Chance linear, Ausdauer |
| S7 | Booster (1,1 je angrenzendem Booster, nur Bonusteil) | `Fragment.ts:259-373`, `StaneksGift.ts:64-81` | wie S1 | +10 % auf den Bonus |
| S8 | Laden: 1 s je Aufruf (200 ms im Bonus), Faeden x Kernbonus, highestCharge/numCharge; Wirkung `1 + ln(T+1)/60 * ((N+1)/5)^0,07 * power * boost * PowerMult` | `NetscriptFunctions/Stanek.ts:32-57`, `StaneksGift.ts:33-62`, `CotMG/formulas/effect.ts:3-12`; RAM 0,4 + 1,6 = 2,0 GB/Faden; jeder Rechner (keine Host-Pruefung) | wie S1 | logarithmisch in Faeden |
| S9 | StaneksGiftPowerMultiplier / ExtraSize | `BitNode.tsx` BN13 :1033-1034 (2/+1), BN15 :1113-1114 (0,7/-2), BN8 :792 (Extra -99, Power 1) | Route: BN13, BN15, BN8 | Hebelgroesse |
| S10 | Kirchen-Rep je Ladung `faction_rep * T^0,95 * (favor+100)/1000` -> Awakening (1e6 Rep, Malus 0,95), Serenity (1e8, kein Malus) | `StaneksGift.ts:41-42`, `Augmentations.ts:1631-1700` | wie S1 | Malus weg |
| S11 | ZOE (1e12 $): Sleeves bekommen Stanek-Mults x3/(n+2) | `Augmentations.ts:2077-2090`, `Sleeve.ts:164-168`, `StaneksGift.ts:206-227` | wie S1 | Sleeve-Chance |
| S12 | Uebrige Fragmente: Hacking (S/Z, 1), HackingSpeed (T, 1,3), HackingMoney (I, 2), HackingGrow (J, 0,5), HacknetMoney (I, 1), HacknetCost (O, 2), Rep (J, 0,5), WorkMoney (J, 10), Crime (L, 2), Charisma (S, 3) | `Fragment.ts:97-247` | wie S1 | fuer V2 Platzkonkurrenz |
| R4 | Einbau loescht Ladungen (Fragmente bleiben), Knotenwechsel leert Gitter; Genesis bleibt ueber Einbauten | `StaneksGift.ts:229-236`, `Prestige.ts:125, 344` | wie S1 | nach jedem Einbau neu laden |
| R5 | BN13-Start: Geld = TravelCost | `Prestige.ts:341-343` | BN13 | API braucht keine Reise |
| R6 | Kirchenmitgliedschaft wird bei Einbau gehalten | `Prestige.ts:184-191` | wie S1 | - |

Inventar: 15 Go-Features + 3 Go-Randbedingungen, 12 Stanek-Features + 3
Stanek-Randbedingungen = **33 Zeilen**.

---

## Tabelle 2 - Abdeckungsmatrix

Bot-Grep: `ns.go`, `ns.stanek`, `acceptGift`, `GoPower`, `StaneksGift` in
`src/*.js` und `src/lib/*.js` - **keine Laufzeitnutzung**. Fundstellen, die
das Thema nur beruehren: `src/buyaugs.js:414-416` (Stanek-Augs als Datenzeilen),
`src/lib/hackaugs.js:22-23, 82-84, 254-256` (Multiplikator-Tabelle),
`src/kampfaugs.js:56-60` (bewusst ausgeschlossen), `src/cheap.js:39`
(Faktionsliste), `src/joinplan.js:39` (Hinweistext), `src/lib/bitnodes.json:35,
57-58, 382 ...` (Werte ohne Leser).

| Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil |
|---|---|---|---|---|
| G1 Go-Zugang | fehlt | - | NICHT GENUTZT | Basis fuer STGO-1 |
| G2 Tetrads | fehlt | - | NICHT GENUTZT | STGO-1, groesster Hebel des Bereichs |
| G10/G11 GoPower 4, SF14 x2 | fehlt (`bitnodes.json:382` ohne Leser) | - | NICHT GENUTZT | STGO-1 (BN14, danach BN13/15) |
| G3 Daedalus | fehlt | - | NICHT GENUTZT | STGO-4 (P3) |
| G4 Netburners | fehlt | - | NICHT GENUTZT | STGO-4 (P3), leichteste KI |
| G13 Favor aus Serien | fehlt | - | NICHT GENUTZT | STGO-4 (P3) |
| G5 Black Hand | fehlt | - | NICHT GENUTZT | kein Befund: Geld ist in V2 kein Engpass, BN8 ScriptHackMoneyGain 0 |
| G6 Illuminati | fehlt | - | NICHT GENUTZT | kein Befund: hacking_speed nur fuer Geld/V1 |
| G8 w0r1d_d43m0n | fehlt | - | NICHT GENUTZT | STGO-5 (P3, BN8) |
| G7 Slum Snakes | fehlt | - | NICHT ANWENDBAR | crime_success ohne Routenertrag |
| G14 go.cheat | fehlt | - | NICHT ANWENDBAR | erst BN14.2; dann Teil von STGO-1 |
| S1/S2 acceptGift + Genesis | fehlt | - | NICHT GENUTZT | STGO-3 (BN13, BN15); bis BN13 NICHT ANWENDBAR (`canAccessBitNodeFeature(13)`) |
| S3 Annahme-Sperre | `bbtrain.js:350` (Beitritt), `bn4rep.js:1595, 1740`, `kampfaugs.js:183` (Kaeufe), `graft.js:216` (Graft) - alle ohne Stanek-Riegel | V2-Kaltstart | (RISIKO) | STGO-2 |
| S5 Kampf-Fragmente | fehlt | - | NICHT GENUTZT | STGO-3 |
| S6 Bladeburner-Fragment | fehlt | - | NICHT GENUTZT | STGO-3 |
| S7 Booster | fehlt | - | NICHT GENUTZT | STGO-3 (6x5: ein Booster beruehrt alle 5 Kernfragmente) |
| S10 Awakening/Serenity | `buyaugs.js:415-416` kennt sie, aber ohne Laden keine Kirchen-Rep | - | NICHT GENUTZT | STGO-3 |
| S11 ZOE | fehlt | - | NICHT GENUTZT | kein Befund: 3e12 $ fuer 3 Sleeves, Wirkung x0,6 je Sleeve |
| S12 uebrige Fragmente | fehlt | - | NICHT ANWENDBAR | V2 braucht den Platz fuer S5/S6 |
| Stanek in BN8 (2x3) | fehlt | - | NICHT ANWENDBAR | V1, ein Fragment, netto ~+8 % Hacking-Stufe, Genesis kostet -10 % auf alles andere |

Zaehlung (Featurezeilen ohne Randbedingungen): OPTIMAL 0, SUBOPTIMAL 0,
TOT 0, NICHT GENUTZT 15, NICHT ANWENDBAR 4.

---

## Befunde

### STGO-1 - IPvGO-Tetrads ungenutzt in allen V2-Knoten (BN14 x4, danach x2) - NICHT_GENUTZT, P1

- **Bot:** fehlt (kein `ns.go` in `src/`).
- **Spiel:** Zugang ohne SF und ohne Faktion (`NetscriptFunctions/Go.ts:43-82`,
  `netscriptGoImplementation.ts:354-373` prueft nur Brettgroesse und TRP fuer
  w0r1d_d43m0n). Tetrads multipliziert `mults.strength/defense/dexterity/agility`
  (`effect.ts:82-87`), die gehen linear in die Stufe (`formulas/skill.ts:7-16`)
  und mit ^0,8 in die competence (`Bladeburner/Actions/Action.ts:169-196`).
  nodePower waechst auch bei Niederlagen (`scoring.ts:86-91`, x0,5). Reset bei
  jedem Einbau (`Go.ts:160-183`) - in V2 sind Einbauzyklen lang (INDEX.tsv:
  BN9 3-4, BN10 3 Einbauten in 54-104 h).
- **Rechnung (geeicht, `stgo-blade.mjs`):** Stufen aus exp*mult reproduzieren
  den Spielstand exakt (str 194, def/dex/agi 181, hacking 372 mit BN2-LM 0,8,
  cha 57); Typhoon-Chance gerechnet 0,0868 gegen 0,0867 in `data/blade.json`
  und 0,087 in `data/kpi.json` desselben Spielstands (0,5 s Abstand).
  Stufen-Mult +10/+20/+31/+50 % -> Typhoon-Chance x1,070/1,138/1,212/1,337,
  entspricht x1,5/2,3/3,7/8,3 der bisherigen Kampf-Exp.
- **Rechnung (ungeeicht, `stgo-go.mjs`):** Bonus bei nodePower 1.000/10.000/
  100.000: normal +7,7/20,4/51 %; BN14 +31/82/204 %; mit SF14 +15/41/102 %.
  Spielstaerke GESCHAETZT (7x7, 20-30 s je Partie aus 4-7 waitCycle a 200 ms je
  KI-Zug, Siegquote 0,15-0,6): Mittel ueber 12 h normal +22..38 %, BN14
  +89..151 %, SF14 +45..75 %.
- **Ertrag gegen beste Alternative (nichts tun):** Beitrittstor BN14
  (3,09 h Gym allein, Kampf-LM 0,5) -40..-65 % = 1,2-2,0 h je Lauf. Vorphase:
  untere Klammer aus der GEMESSENEN Wachstumsrate von ln(Typhoon-Chance) in
  BN2.1 (0,135-0,162 je h, `stgo-gain.mjs`): 0,6-1,4 h je normalem Lauf;
  obere Klammer aus BN10-Rangkurve (Vorphase 46,6 von 69,7 h): 1,6-3,1 h je
  normalem Lauf, 5,8-8,6 h je BN14-Lauf, 4,4-6,9 h je BN13/15-Lauf.
  **Route (23 V2-Laeufe): rund 23-110 h.** Kosten: 14-18 GB RAM (makeMove 4,
  getBoardState 4, getValidMoves 8, Basis 1,6), keine Spielerzeit, keine Figur.
- **Konfidenz:** Mechanik belegt, Kette geeicht; Spielstaerke und h-Umrechnung
  GESCHAETZT.
- **Vorgehen:** Erst messen (das ist das alte Tor O9): einfaches Go-Skript in
  einer Klon-Sitzung gegen Tetrads 7x7 und 5x5, `ns.go.analysis.getStats()`
  stuendlich protokollieren (nodePower/h, Siegquote, s/Partie), sichtbarer und
  verdeckter Tab getrennt. Dann Registry-Dienst, der ab Knotenstart laeuft.
- **Bekannt vorher:** AUDIT-BAUSTELLEN-2026-09-06.md:265 (L44: Go-Tor fehlt),
  ARCHITEKTUR.md:1814 (O9), AUDIT-ROADMAP-2026-08-24.md:93 ("GoPower 4 als
  Bonus"), 1-bitnode-regeln.md:72 (nur Daedalus-Rep erwaehnt). Neu: der
  Tetrads-Hebel auf V2 mit geeichter Kette und Zahlen; das Tor steht in keiner
  Arbeitsliste.

### STGO-2 - Stanek-Reihenfolgefalle in BN13/BN15: Beitritt, Kauf oder Graft vor acceptGift sperrt die Gabe fuer den Lauf - RISIKO, P2

- **Bot:** `src/bbtrain.js:350` `joinBladeburnerDivision()` ohne Pruefung;
  Kaeufe `src/bn4rep.js:1595, 1740`, `src/kampfaugs.js:183`; Graft
  `src/graft.js:216`. Kein Aufruf von `ns.stanek.acceptGift` irgendwo.
- **Spiel:** `CotMG/Helper.tsx:59-74` lehnt ab, sobald `augmentations` ODER
  `queuedAugmentations` eine Nicht-NFG-Aug enthalten. SF7.3 schiebt Blade's
  Simulacrum beim Beitritt direkt in `augmentations`
  (`PlayerObjectBladeburnerMethods.ts:14-19`), fertige Grafts ebenso
  (`Work/GraftingWork.tsx:51`). Spielhinweis `NetscriptDefinitions.d.ts:4026-4028`.
  Route: BN7.1-7.3 liegt vor BN13 -> SF7.3 ist dann aktiv.
- **Folge:** Ohne Riegel ist STGO-3 in jedem BN13-/BN15-Lauf verloren, sobald
  bbtrain beitritt oder bn4rep das erste Stueck kauft (bei BN13-Startgeld
  200.000 $ = TravelCost, `Prestige.ts:341-343`, ist das erste Stueck spaet;
  der Beitritt bei Kampf 100 ist der wahrscheinliche Ausloeser).
- **Fix:** In BN13 und (mit SF13) BN15 vor allem anderen `ns.stanek.acceptGift()`
  (2 GB, keine Reise); Beitritt/Kauf/Graft erst danach. Gilt nicht fuer BN8
  (siehe Matrix).
- **Ertrag:** Voraussetzung fuer STGO-3; selbst 0.
- **Bekannt vorher:** BAU-2026-09/A4-bitnodes.md:1024-1162 (Teil 5, Mechanik
  vollstaendig belegt), ARCHITEKTUR.md:1813 (O8). Neu: die vier konkreten
  Bot-Stellen ohne Riegel und der Graft-Pfad.

### STGO-3 - Stanek in BN13 (und BN15) ungenutzt - NICHT_GENUTZT, P2

- **Bot:** fehlt.
- **Spiel:** Gitter BN13.1 6x5, BN13.2 6x6, BN13.3 7x6, BN15 mit SF13.3 6x5
  (`StaneksGift.ts:22-31`). Der V2-Satz str/def/dex/agi/blade passt in 6x5 mit
  einem Booster, der alle fuenf beruehrt (Vollsuche `stgo-stanek.mjs`:
  `str@(0,0)r0 def@(0,3)r0 dex@(3,0)r0 agi@(3,3)r0 blade@(0,1)r1 boost100@(2,1)r3`).
- **Rechnung (`stgo-stanek.mjs`, Formel ungeeicht, Kette geeicht):** Kampf-
  Fragment netto nach Genesis 0,9 bei 30/250/1.000/5.000 Faeden (N = 200
  Ladungen): BN13 x1,167/1,329/1,437/1,562, BN15 x0,993/1,050/1,088/1,132;
  Break-even BN13 3 Faeden, BN15 39 Faeden. Typhoon-Chance mit Blade-Fragment:
  BN13 x1,18/1,34/1,45/1,58, BN15 x1,02/1,07/1,10/1,15. Awakening (1e6 Rep)
  nach 2,4 h bei 250 Faeden je Fragment, 0,7 h bei 1.000.
  RAM ist in V2 kein Engpass: BN2.1 nach 5,3 h 4,7 TB (2.350 Faeden),
  BN10.2 nach 57 h 128 TB home + 7,8 PB.
- **Ertrag:** gemessene Klammer 2,3-2,8 h je BN13-Lauf (k 1,45), Modell
  6,7-8,5 h; BN15 0,5-2,6 h. **Route 8-33 h.** Zusaetzlich Beitrittstor
  BN13 (0,86 h Gym allein) -55..-68 %, weil die Fragmente auch die Exp
  multiplizieren, und Ausdauer (Blade-Fragment auf max/gain, Kammer war 55-63 %
  der Vorphase, 4-bladeburner.md:220-222) - nicht gerechnet.
- **Bekannt vorher:** A4-bitnodes.md:1150-1156 ("Nutzenfrage offen"),
  AUDIT-ROADMAP-2026-08-24.md:94, ROUTE.md:89. Die Roadmap-Begruendung
  "Kirchenbeitritt ausserhalb gesperrt, sobald andere Augs installiert,
  Prestige.ts:184-190" ist ueberholt: A4 Teil 5.3 zeigt, dass das `isBanned`-
  Flag nicht der Riegel ist; Stanek gilt in BN15 und BN8 weiter.

### STGO-4 - Go-Nebenertraege: Favor aus Siegesserien, Daedalus-Rep, Netburners-Hashes - NICHT_GENUTZT, P3

- **Spiel:** je zweitem Serien-Sieg maxRep/200 Rep als Favor, sofort
  (`scoring.ts:67-79`), Deckel je Faktion und Knoten 100k Rep = +81,3 Favor
  (SF14.3: 400k = +143,1). Netburners (komi 1,5, nicht "smart",
  `goAI.ts:247-262`) ist fuer ein einfaches Skript der sichere Gegner:
  3 h bei Siegquote 0,9 fuellen den Deckel (+81 Favor) und geben +46 % Hacknet.
- **Ertrag:** GESCHAETZT, klein gegen STGO-1; Rep ist in V2 nur fuer Aug-Kaeufe
  relevant, die Hash->Rang-Kette kostet steigend (`Hacknet/HashUpgrade.ts:72-82`,
  Stufe L kostet 250*(L+1) Hashes).
- **needs_calc:** Rep-Engpass je V2-Einbauzyklus aus bn4rep-Protokoll.

### STGO-5 - w0r1d_d43m0n-Gegner in BN8 nach TRP ungenutzt - NICHT_GENUTZT, P3

- **Spiel:** nur mit installierter TRP (`netscriptGoImplementation.ts:359-361`),
  power 2 auf hacking (`effect.ts:95-97`); in BN8 gilt SF14 (x2): bei nodePower
  1.000 schon +44 %. Nach dem TRP-Einbau gibt es keinen Einbau mehr - der
  Bestand bleibt.
- **Ertrag:** haengt an der Zeit zwischen TRP-Einbau und Hacking-Schwelle
  in BN8; ungemessen.
- **Bekannt vorher:** bn4/BEFUNDE.md:37 (I13), bn4/INVENTUR-ERGEBNIS.md:160-167.
  Neu: SF14-Verdopplung, BN8 als einziger verbleibender V1-Knoten.

### STGO-6 - Go-Ertrag haengt an ungedrosselten Echtzeit-Timern - RISIKO, P3 (Bauauflage fuer STGO-1)

- **Spiel:** jede KI-Antwort wartet 4-7 x `sleep(200)` per `setTimeout`
  (`goAI.ts:176-212, 877-883`); nachgeholt wird nur Offline-Zeit beim Laden
  (`Go.ts:196-200`, `engine.tsx:335`), nicht Drosselzeit im laufenden Tab.
- **Folge:** im verdeckten Tab mit 1 Wake/min dauert ein KI-Zug Minuten -
  Ertrag praktisch 0, still. `wakelock.js` laeuft laut Spielstand
  (`data/wakelock.txt` "running"), `hacktimer.js` ist aus
  (`data/hacktimer.json` vom 25.08., `aktiv:false`).
- **Auflage:** Der Go-Dienst misst nodePower/h selbst (getStats) und meldet
  Stillstand; ein Ausschluss "Go bringt nichts" ist nur gueltig, wenn der Tab
  in der Messung ungedrosselt war.

---

## Rechnungen mit Eichung

### Eichung (stgo-blade.mjs, Spielstand BN2L1 2026-10-03 09:59)

```
Eichung Stufe strength   Spielstand 194  gerechnet 194  OK
Eichung Stufe defense    Spielstand 181  gerechnet 181  OK
Eichung Stufe dexterity  Spielstand 181  gerechnet 181  OK
Eichung Stufe agility    Spielstand 181  gerechnet 181  OK
Eichung Stufe hacking    Spielstand 372  gerechnet 372  OK   (BN2 HackingLevelMultiplier 0,8, BitNode.tsx:571)
Eichung Stufe charisma   Spielstand 57   gerechnet 57   OK
Eichung Typhoon-Chance: gerechnet 0.0868  blade.json 0.0867  kpi 0.087  Abw. 0.08 %
```

Die Chance ist aus dem Quellcode (`Action.ts:169-196`, `Skills.ts`,
`BlackOperations.ts:7-32`, `intelligence.ts`, `Bladeburner.ts:167-169`)
nachgebaut, nicht aus blade.js abgeschrieben. Gegenwert ist die
Bot-Telemetrie im selben Spielstand; deren Formel ist im Audit 26.09.
(4-bladeburner.md:250-253) gegen Action.ts bestaetigt.

### Empfindlichkeit (geeicht)

```
f=1.10  str 214  chance x1.070   entspricht x1.53 Kampf-Exp
f=1.20  str 233  chance x1.138   entspricht x2.33 Kampf-Exp
f=1.31  str 254  chance x1.212   entspricht x3.69 Kampf-Exp
f=1.50  str 291  chance x1.337   entspricht x8.27 Kampf-Exp
Beitrittstor 4x100 (aug-mult 1,434):
  BN2/3/6/7/11/8 LM 1    16.169 Exp = 0,31 h   f1.2 -34 %  f1.5 -58 %
  BN13/BN15     LM 0,7   44.436 Exp = 0,86 h   f1.2 -42 %  f1.5 -68 %
  BN14          LM 0,5  159.614 Exp = 3,09 h   f1.2 -52 %  f1.5 -78 %
```

### Gemessene Wachstumsrate (geeichte Kette ueber 8 Spielstaende BN2.1)

```
h 0.85 -> 0.0294 | 1.85 -> 0.0449 | 2.85 -> 0.0584 | 3.85 -> 0.0715 | 5.29 -> 0.0868
d ln(Chance)/dt = 0.162/h (2.85-5.29 h), 0.135/h (3.85-5.29 h)
```

### Go-Formel (ungeeicht - kein Spielstand mit Go)

```
                         100     1000    3000    10000   30000   100000
Tetrads normal          2.6%     7.7%   12.4%    20.4%   31.8%    51.0%
Tetrads BN14 (x4)      10.3%    30.7%   49.5%    81.7%  127.2%   203.9%
Tetrads mit SF14        5.2%    15.4%   24.8%    40.9%   63.6%   101.9%
w0r1d_d43m0n mit SF14  14.7%    43.9%   70.7%   116.8%  181.7%   291.3%
```

### Stanek (ungeeicht - kein Spielstand mit Stanek)

```
BN13.1 6x5 | BN13.2 6x6 | BN13.3 7x6 | BN15(SF13.3) 6x5 | BN8(SF13.3) 2x3
Kampf netto BN13 (30/250/1000/5000 Faeden): x1.167 x1.329 x1.437 x1.562
Typhoon-Chance BN13: x1.182 x1.341 x1.451 x1.581 ; BN15: x1.016 x1.070 x1.105 x1.148
Break-even gegen Genesis: BN13 3 Faeden, BN15 39 Faeden
```

### Stunden (stgo-gain.mjs, GESCHAETZT)

```
Go Tetrads normal   13 Laeufe: 0,6-3,1 h je Lauf
Go Tetrads BN14      3 Laeufe: 2,2-8,6 h je Lauf (+1,2-2,0 h Beitrittstor)
Go Tetrads SF14 x2   6 Laeufe (BN13, BN15): 1,4-6,9 h je Lauf
Stanek BN13          3 Laeufe: 2,3-8,5 h je Lauf
Stanek BN15          3 Laeufe: 0,5-2,6 h je Lauf
Summe Route grob: 30-140 h (Go 23-110, Stanek 8-33)
```

Was hier NICHT geeicht ist und warum: die Go-Effektformel und die Stanek-
Wirkformel (kein Spielstand hat je Go oder Stanek), die Spielstaerke eines
einfachen Go-Skripts, und die Umrechnung competence-Faktor -> Stunden (das
Modell nimmt log-lineares Wachstum an; die gemessene BN2-Rate ist die untere
Klammer).

---

## Offene Fragen / needs_calc

1. Spielstaerke eines einfachen Go-Skripts gegen Tetrads/Netburners/Daedalus
   auf 5x5 und 7x7: nodePower/h, Siegquote, Sekunden je Partie - nur in einem
   Klon messbar (das Spiel nicht anfassen).
2. Stundenwirkung eines statischen competence-Faktors: Vorphasen-Modell aus
   `data/aktionen.txt` + `doku/rangkurve-bn10.json`/`bn6.json` mit Stufen- und
   Skillverlauf, Ausdauer (Kammeranteil) eingeschlossen.
3. BN13-Kaltstart: verkraftet der Bot eine installierte Genesis-Aug in
   `getOwnedAugmentations(false)` (z. B. `bn4rep.js:601, 1555`,
   `daedalus.js:23`)? Nicht geprueft, weil es noch keinen Stanek-Code gibt.
