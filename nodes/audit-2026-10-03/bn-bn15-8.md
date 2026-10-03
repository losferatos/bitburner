# BN15 und BN8 - Pruefbericht Gruppe BN15-8 (Audit 03.10.2026)

Pruefer: Vollstaendigkeits-Audit, Gruppe BN15-8 (BN15.1-15.3 V2, BN8.1-8.3 V1).
Systemzeit beim Schreiben: 03.10.2026 17:39. Streng lesend: `src/` unveraendert,
Spiel nicht beruehrt. Spielquelle 3.0.2 `reference/bitburner-src/src/`.

Rechner: `tools/audit/bn15-8-calc.mjs` (neu, Teile A-D). Wiederverwendet und
geprueft: `tools/audit/boerse-sim.mjs` (Marktmodell, Tick gegen
`StockMarket/StockMarket.ts:239-320` Zeile fuer Zeile verglichen),
`boerse-szenarien.mjs`, `boerse-bargeld.mjs`, `boerse-4skauf.mjs`,
`bn67-kurven.mjs` (Rangkurven-Leser). Ein Bereichsbericht BOERSE existiert
nicht - die Ergebnisse dieser Rechner stehen deshalb hier.

## Kurzurteil

- **BN15: V2 ist moeglich und der einzige realistische Weg.** BladeburnerRank
  0,2 > 0 (Beitritt nur bei 0 gesperrt, `NetscriptFunctions/Bladeburner.ts:339-342`),
  Ausgang ueber 21 Black Ops ohne Red Pill (`NetscriptFunctions/Singularity.ts:1154-1161`).
  Der klassische V1 ist gesperrt (Daedalus fuehrt dort keine Red Pill,
  `Faction/FactionHelpers.tsx:204-207`). **V1b (Labyrinth) scheitert nicht am
  Labyrinth, sondern an Hacking 6000 bei HackingLevelMultiplier 0,6**: geeicht
  gegen 7 Spielstaende braucht das `mults.hacking` >= 14,3; keiner der sechs
  bisherigen V1-Endstaende kaeme in BN15 ueber 5305 (BN15-1).
- **BN15 ist der teuerste Block der Restroute**: aus den gemessenen V2-Laeufen
  (Rohrang-Verschiebung) rund 70-140 h je Lauf (GESCHAETZT, Rechnung C). Der
  Bot ist dafuer bereit: Knotenfaktor, Skillpreis, unskalierter Rangverlust
  werden live gelesen (`src/blade.js:804, 1543, 1578, 2281, 3099-3106`).
  Hebel liegen bei den knotenunabhaengigen Quellen (Go, Stanek, Hash-Rang,
  Gang) - die stehen schon in STGO-1/STGO-3/HASH-2/inventar-gang.
- **BN8: der Bot ist NICHT bereit, und die Luecke ist groesser als C6.**
  Neu: `bn4rep` sieht nur Bargeld und in BN8 kein Einkommen; `boerse.js` haelt
  im Median 0,01 % des Vermoegens bar. Damit ist `naechstesUnbezahlbar` immer
  wahr und der Einbau feuert ab 3 wartenden Stuecken - jedes Mal mit dem
  ganzen Depot, das `prestigeAugmentation` ersatzlos loescht (BN8-1, BN8-2).
  Dazu 4S-Kauf 7,1 h zu spaet (BN8-3), Handelsregel 5 h je Zyklus langsamer
  als die beste Alternative (BN8-4), Schliess-Mechanik ohne Schreiber (BN8-5).
- `src/lib/bitnodes.json` stimmt fuer BN8 und BN15 in allen 54 Feldern mit
  der ausgefuehrten Quelle ueberein (Eichung A). Die Route (`src/route.json:40-45`,
  `tools/test-route.js` gruen, 39 Spruenge) ist in Ordnung.

## Eichung (Soll = Spielstand/Quelle, Ist = Nachbau)

| Groesse | Soll | Ist | Rechner |
|---|---|---|---|
| BN8 Multiplikatoren (54 Felder) | `BitNode.tsx:764-793`, ausgefuehrt | `src/lib/bitnodes.json:189` identisch | `bn15-8-calc.mjs A` |
| BN15 Multiplikatoren (54 Felder) | `BitNode.tsx:1085-1117`, ausgefuehrt | `src/lib/bitnodes.json:411` identisch | A |
| Hacking-Stufe BN2L1 (HLM 0,8) | 408 | 408 | B |
| BN1L3 / BN5L3 / BN5L2 (HLM 1) | 4966 / 6224 / 4149 | 4966 / 6224 / 4149 | B |
| BN12L1 / L2 / L3 (HLM 0,9804 / 0,9612 / 0,9423) | 6071 / 8498 / 7102 | 6071 / 8498 / 7102 | B |
| Marktmodell: Anteil Aufwaertsticks gegen mittlere Vorhersage | 0,49759 | 0,49688 | `boerse-sim.mjs --eich` |
| Marktkapazitaet bei Start = 0,2 x Summe marketCap | 5,43 Bio | 5,42 Bio | `--eich` |

Das Marktmodell ist intern geeicht (Konstanten aus `StockMarket/data/Constants.ts`
gelesen, Metadaten aus `InitStockMetadata.ts` geparst), aber NICHT gegen einen
echten Handelsverlauf: kein Spielstand hat je ein initialisiertes Depot
(`boerse-save.mjs`: `init=false`, `pos=0` in allen Staenden). Alle Boersenzahlen
sind daher GERECHNET_UNGEEICHT.

## BN15 - The Secrets of the Dark Net

### Multiplikatoren (`BitNode/BitNode.tsx:1085-1117`, Stufe 1-3 identisch)

| Multiplikator | Wert | Wirkung | Bot beruecksichtigt? (Datei:Zeile) | Urteil |
|---|---|---|---|---|
| HackingLevelMultiplier | 0,6 | Stufe = floor(m x HLM x (32 ln(exp+534,6) - 200)) (`PersonObjects/formulas/skill.ts:7-15`, `Person.ts:62`) | V2: ohne Belang; V1b: BN15-1 | NICHT ANWENDBAR (V2) |
| HackingSpeedMultiplier | 0,6 | hack/grow/weaken-Zeiten / 0,6 | live ueber `ns.getHackTime` u. a. in `src/bn4net.js` | OPTIMAL |
| Str/Def/Dex/AgilityLevelMultiplier | je 0,7 | Kampfstufe x 0,7 (besser als BN9 0,45 / BN10 0,4) | `src/kampfaugs.js:244-246` live; `src/bbtrain.js` trainiert auf Stufe | OPTIMAL (4 Zeilen) |
| CharismaLevelMultiplier | 1,1 | nur Darknet/Firmen | - | NICHT ANWENDBAR |
| ServerMaxMoney / ServerStartingMoney | 0,8 / 0,5 | Hackgeld; V2 nicht bindend | Serverwerte live | OPTIMAL (2 Zeilen) |
| ServerStartingSecurity | 1,5 | Vorbereitung | `src/lib/bitnodes.json` + live | OPTIMAL |
| AugmentationMoneyCost | 3 | Aug-Preise x3 | live `src/bn4rep.js:675-676, 1565-1568` | OPTIMAL |
| CorporationValuation / Softcap / Divisions | 0,2 / 0,4 / 0,4 | Corp schwach | keine Corp (inventar-corp) | NICHT ANWENDBAR (3 Zeilen) |
| DaedalusAugsRequirement | 20 | Daedalus ohne Red Pill | live `src/joinrun.js:89`, `src/lib/einbau.js:63-70`; Fuellstueck AUG-6 | SUBOPTIMAL (AUG-6, bekannt) |
| BladeburnerRank | 0,2 | Rang je Aktion x0,2 (`Bladeburner/Formulas.ts:9-28`), Verlust NICHT (`:30-44`), reqdRank 400.000 NICHT (`data/BlackOperations.ts:705-708`) | `src/blade.js:804` live; Black-Op-Schwelle `:2281`, Op-Verlust `:3099-3106` | OPTIMAL |
| BladeburnerSkillCost | 3 | Skillpreis x3 (`Bladeburner/Skill.ts:70-80`) | Preis live `src/blade.js:1543, 1578`; Verteilung BLADE-2 | OPTIMAL |
| GangUniqueAugs | 0,3 | Gang-Sortiment beschnitten | keine Gang (inventar-gang) | NICHT GENUTZT (inventar-gang) |
| StaneksGiftPowerMultiplier / ExtraSize | 0,7 / -2 | Gabe 6x5 mit SF13.3 | kein Stanek | NICHT GENUTZT (STGO-3, 2 Zeilen) |
| WorldDaemonDifficulty | 2 | WD-Stufe 6000 (`Server/ServerHelpers.ts:422-424`) | `src/exit.js`/`src/ausgang.js` lesen `requiredHackingSkill` live | OPTIMAL |

### Sonderregeln BN15

| Regel | Quelle | Bot | Urteil |
|---|---|---|---|
| Daedalus fuehrt keine Red Pill | `Faction/FactionHelpers.tsx:204-207` | Route V2 (`src/route.json:40-42`) | NICHT ANWENDBAR |
| Red Pill aus dem Labyrinth: 5. Labor nach 4 EINGEBAUTEN Labor-Augs (`DarkNet/effects/labyrinth.ts:403-430, 432-456`), Belohnung wird gequeued (`DarkNet/effects/cacheFiles.ts:197-207`), cha-Vorgabe nur weich (Zeitfaktor, `DarkNet/effects/effects.ts:60-98`) | s. links | kein `ns.dnet` in `src/` | NICHT GENUTZT - **BN15-1: lohnt nicht** |
| TOR + DarkscapeNavigator gratis, `darkweb` wird zum DarknetServer (`DarkNet/controllers/NetworkGenerator.ts:52-90`, `Prestige.ts:99-101, 238-240`), `ns.scan` blendet ihn aus (`NetscriptFunctions.ts:187`) | s. links | `src/darkweb.js:99` prueft TOR ueber `ns.scan` | SUBOPTIMAL (BN15-2) |
| Darknet mutiert doppelt so schnell (`DarkNet/utils/darknetNetworkUtils.ts:9-14`) | | - | NICHT ANWENDBAR |
| Darknet-Handbuch als Dialog in BN15.1 (`Prestige.ts:346-351`) | | `src/popups.js` schliesst Dialoge | OPTIMAL |
| V2-Ausgang 21 Black Ops, Rang 400.000 unskaliert | `Singularity.ts:1154-1161`, `BlackOperations.ts:708` | `src/ausgang.js`, `src/lib/route.js` | OPTIMAL |
| Rangverlust unskaliert, Fehlschlag relativ x5 teurer | `Bladeburner/Formulas.ts:30-44` | `src/blade.js:2281, 3099-3106` | OPTIMAL |
| Hash-Rang traegt den Knotenfaktor NICHT | `Hacknet/HacknetHelpers.tsx:544` -> `Bladeburner/Bladeburner.ts:1265-1273` (changeRank ohne BladeburnerRank) | `src/hashes.js` kauft Rang; Umfang HASH-2 | OPTIMAL (Ausbau HASH-2) |

### Phasen in BN15 (V2)

- **Kaltstart**: Geld 1.000 $; `darkweb.js` meldet bis 200 k "Noch kein TOR",
  obwohl TOR steht, und geht danach den DOM-Weg (BN15-2). Kein Stillstand.
- **Aufbau**: Gym-Tor bei Kampf-LM 0,7 kurz (knoten.md: 17 Mio Gymkosten). Ab
  SF13.3 (BN13 liegt vor BN15) greift die Stanek-Reihenfolgefalle STGO-2 auch
  hier: Beitritt vor `acceptGift` sperrt die Gabe.
- **Einbauzyklus**: Augs x3 (live), Daedalus 20 (AUG-6).
- **Endspiel**: Black-Op-Schwellen mit Knotenfaktor gerechnet (`blade.js:2281`).
- **Sprung**: Route BN15 -> BN15 -> BN15 -> BN8, `braucht boerse.js` liegt.

## BN8 - Ghost of Wall Street

### Multiplikatoren (`BitNode/BitNode.tsx:764-793`, Stufe 1-3 identisch)

| Multiplikator | Wert | Wirkung | Bot beruecksichtigt? (Datei:Zeile) | Urteil |
|---|---|---|---|---|
| CloudServerSoftcap | 4 | Mietrechner > 64 GB x4^(log2 r - 6) (`Server/ServerPurchases.ts:22-62`) | Preise live (`src/shop.js`), aber keine BN8-Phase | SUBOPTIMAL (C6, INFRA-5, BN8-6) |
| CompanyWorkMoney | 0 | Firmenarbeit ohne Lohn | Firmenarbeit nur fuer Ruf | OPTIMAL |
| CrimeMoney | 0 | Verbrechen 0 $ | `src/sleeve.js:368, 440`; Kaltstart-Shoplift SLEEVE-6 | SUBOPTIMAL (SLEEVE-6, bekannt) |
| HacknetNodeMoney | 0 | keine Hashes | `src/hashes.js:138` beendet sich | OPTIMAL |
| ManualHackMoney | 0 | | Bot hackt nicht von Hand | NICHT ANWENDBAR |
| ScriptHackMoney | 0,3 | Server verliert Geld (Treiber fuer `{stock:true}`) | `src/bn4net.js:150` | OPTIMAL |
| ScriptHackMoneyGain | 0 | Spieler bekommt 0 $ (`Netscript/NetscriptHelpers.tsx:648-654`); `getTotalScriptIncome` = 0 (`NetscriptFunctions.ts:1240-1252`) | NICHT gelesen (`src/bn4net.js:150-152`); Folge in `src/bn4rep.js:611-613` (BN8-1) | SUBOPTIMAL (C6 + BN8-1) |
| CodingContractMoney | 0 | Geldtyp faellt weg | Typ steht im Vertrag | NICHT ANWENDBAR |
| FavorToDonateToFaction | 0 | Spenden ab Favor 0 | live `getFavorToDonate` (`src/bn4rep.js:1125, 1154-1158`), Spende `:1677, 1788, 2414` | OPTIMAL (Bargeld fehlt: BN8-2) |
| InfiltrationMoney | 0 | | keine Infiltration | NICHT ANWENDBAR |
| CorporationValuation / Softcap / Divisions | 0 / 0 / 0 | Corp gesperrt | keine Corp | NICHT ANWENDBAR (3 Zeilen) |
| BladeburnerRank | 0 | Beitritt gesperrt (`NetscriptFunctions/Bladeburner.ts:339-342`) | `src/bn4net.js:3921` startet blade/bbtrain in V1 nicht | OPTIMAL |
| DarknetLabyrinthRewardsTheRedPill | 0 | kein Labyrinth-TRP (`labyrinth.ts:404`) | - | NICHT ANWENDBAR |
| DarknetMoneyMultiplier | 0 | Caches ohne Geld (`cacheFiles.ts:59-66, 110-122`) | - | NICHT ANWENDBAR |
| GangSoftcap / GangUniqueAugs | 0 / 0 | Gang wertlos | keine Gang | NICHT ANWENDBAR (2 Zeilen) |
| StaneksGiftExtraSize | -99 | Gabe 2x3 | - | NICHT ANWENDBAR (STGO-Matrix) |

### Sonderregeln BN8

| Regel | Quelle | Bot | Urteil |
|---|---|---|---|
| Geld = 250 Mio bei Knotenstart UND bei JEDEM Einbau (ueberschreibt, addiert nicht) | `Prestige.ts:158-160, 293-295` | `bn4rep` kennt das nicht | FEHLER (BN8-1) |
| Markt bei JEDEM Einbau neu, Positionen ohne Auszahlung weg | `Prestige.ts:166-171`, `StockMarket/StockMarket.ts:187-209` | Depot-Riegel nur in `src/punish.js:310-319`, nicht im Regelpfad `src/bn4rep.js:1370-1376, 1722` | FEHLER (BN8-1) |
| WSE + TIX gratis | `Prestige.ts:161-164` | `src/boerse.js:124` | OPTIMAL |
| 4S-API ueberlebt Einbauten (Ruecksetzen nur in `prestigeSourceFile`) | `PersonObjects/Player/PlayerObjectGeneralMethods.ts:163-166` | `src/boerse.js:178-193` kauft einmal, aber spaet | SUBOPTIMAL (BN8-3) |
| Shorts und Limit-/Stop-Orders im Knoten frei | `NetscriptFunctions/StockMarket.ts:46-53` | nur Long | NICHT GENUTZT (bekannt Nr. 43; BN8-4: Shorts allein bringen fast nichts) |
| Daedalus verlangt 100 Mrd BARGELD | `Faction/FactionInfo.tsx:138-149`, `Faction/FactionJoinCondition.ts:134-145` | `src/boerse.js:240-249` haelt ~0 bar | FEHLER (BN8-2) |
| Einkommen 0 | `NetscriptFunctions.ts:1240-1252` | `src/bn4rep.js:611-613` Horizontregel | FEHLER (BN8-1) |
| 4S-Daten nie aus Darknet-Caches in BN8 | `DarkNet/effects/cacheFiles.ts:189` | - | NICHT ANWENDBAR |
| Kurs steuern per `grow/hack {stock:true}` | `StockMarket/PlayerInfluencing.ts:24-61` | kein `{stock:true}` in `src/` | NICHT GENUTZT (bekannt Nr. 43, `BAUSTELLEN.md:2535ff`) |
| Grafting ohne Einbau (SF10) | `PersonObjects/Player/PlayerObjectGeneralMethods.ts:577-579`, `GraftableAugmentation.ts:20-29` | `graftauto.js` nur V2 (`src/registry.json`) | NICHT GENUTZT - offen (Entropie, s. Offene Fragen) |
| Depot schliessen vor dem Sprung | `src/boerse.js:52-55, 161-170` | `data/boerse-schliessen.txt` hat keinen Schreiber | TOT (BN8-5) |

### Phasen in BN8 (V1)

- **Kaltstart (jeder Zyklus, nicht nur Knotenstart)**: 250 Mio. Die Leiter
  (`bn4net.js`) kauft ohne BN8-Phase (C6); Rechnung D: kostet je Zyklus
  +3,3 h (boerse.js-Regel) bzw. +1,2 h (beste Regel) bis 1 Bio.
- **Aufbau**: Phase 1 ohne 4S, Kaufregel am Bargeld (BN8-3).
- **Einbauzyklus**: Falle BN8-1 - Einbau ab 3 Stuecken mit vollem Depot.
- **Endspiel**: Daedalus braucht 100 Mrd bar (BN8-2), Red Pill 2,5 Mio Ruf =
  2,5e12/faction_rep $ Spende; nach dem TRP-Einbau 250 Mio, aber TOR +
  5 Portknacker kosten 287 Mio (`src/darkweb.js:66-71`) - mit ~0 Bargeld
  wartet `bn4life` auf Kassen-Ausreisser.
- **Sprung**: BN8.3 ist der letzte Routeneintrag; Route "abgearbeitet".

## Source-Files: was BN15 und BN8 der Restroute bringen

| SF | Wirkung | Quelle | Wert fuer die Route |
|---|---|---|---|
| SF15.1 | TOR + Darkscape bei jedem Start, volles Darknet ueberall | `Prestige.ts:99-101, 238-240`, `DarkNet/effects/effects.ts:301` | nur BN8: Caches liefern Programme und Gratis-Aktien, KEIN Geld, KEINE 4S-Daten, KEINE Red Pill (`cacheFiles.ts:59-66, 189`; `BitNode.tsx:786`). Klein, NICHT GENUTZT |
| SF15.2 | Charisma -> Firmenlohn/-ruf | `Work/Formulas.ts:133` | BN8 Firmenlohn 0 - NICHT ANWENDBAR. (Die 20 % Auth-Tempo greifen laut Code erst bei SF15.3: `effects.ts:80` prueft `> 2`.) |
| SF15.3 | +0,1 x cha in Hacking-Faktionsarbeit, +0,3 x cha Security | `PersonObjects/formulas/reputation.ts:16-58` | automatisch, ~1-3 % Ruf in BN8 - OPTIMAL ohne Zutun |
| SF8.1-8.3 | WSE/TIX dauerhaft, Shorts, Limit-Orders ausserhalb BN8; hacking_grow +12/18/21 % | `BitNode.tsx:299-315`, `SourceFile/applySourceFile.ts:123-131` | Route endet mit BN8.3 - NICHT ANWENDBAR (4 Zeilen) |

Fuer BN8 zaehlen die frueheren SF: SF11.3 (Aug-Kette 1,9 x 0,93 = 1,767,
`Augmentation/AugmentationHelpers.ts:29-31`), SF10 (Grafting, Sleeves), SF4/5,
SF14.3 (Go: Daedalus-Bonus hebt faction_rep, in BN8 = billigerer Ruf, STGO-4).

Zaehlung der Inventarzeilen (Mehrfachzeilen einzeln): BN15 29, BN8 30, SF 7 =
**66**. OPTIMAL 23, SUBOPTIMAL/FEHLER 10, TOT 1, NICHT GENUTZT 8,
NICHT ANWENDBAR 24.

## Befunde

### BN8-1 (RISIKO, P1) Einbau-Falle: bn4rep baut in BN8 ab 3 wartenden Stuecken ein und vernichtet dabei das ganze Depot

- **Bot:** `src/bn4rep.js:604` `geld = getServerMoneyAvailable("home")` (nur
  Bargeld), `:611-613` Einkommen aus `getTotalScriptIncome()[1]`,
  `src/lib/einbau.js:228-231, 270-278`: `preis > max(4 x Konto, Konto + 600 s x Einkommen)`.
  `src/bn4rep.js:859-862` `naechstesUnbezahlbar`, `:360` `MINDEST_WARTESCHLANGE = 3`,
  `:1370-1376` Einbaubedingung, `:1722` `installAugmentations`. Torpruefung
  `src/lib/endspurt.js:249-288` kennt kein Depot. Nur die Notbremse
  `src/punish.js:310-319` prueft `data/boerse.json`.
- **Spiel:** Einkommen in BN8 = 0 (`NetscriptHelpers.tsx:648`,
  `NetscriptFunctions.ts:1240-1252`). Einbau setzt Geld auf 250 Mio
  (`Prestige.ts:158-160`, ueberschreibt) und legt den Markt neu an
  (`Prestige.ts:166-171`) - Positionen ohne Auszahlung weg.
- **Folge:** Mit `boerse.js` aktiv ist das Bargeld ~0 (BN8-2), das Einkommen 0,
  also ist jedes naechste Stueck "unbezahlbar". Sobald 3 Stuecke warten (aus
  Kassen-Ausreissern oder direkt nach dem Zyklusstart aus den 250 Mio),
  baut bn4rep ein - mit dem kompletten Depot. Statt ~3-5 grosser Zyklen je
  Lauf (12-17 h Boerse bis 1-5 Bio, Rechnung D) entstehen viele kleine
  Zyklen, deren Boersenwachstum jedes Mal verfaellt.
- **Ertrag (GESCHAETZT):** 30 Pflicht-Augs in Dreiergruppen = ~10 Zyklen statt
  ~3-4; +6 Zyklen x 12-17 h = **+70-100 h je BN8-Lauf**, im schlechten Fall
  Stillstand (Ruf faellt bei jedem Einbau, Spenden brauchen Bargeld).
- **Fix-Richtung (M):** ein gemeinsamer Ablauf "Einbau-Vorbereitung" in BN8:
  bn4rep fragt an, boerse.js liquidiert vollstaendig, bn4rep kauft
  Augs/NFG/spendet und investiert Rest in home-RAM (ueberlebt den Einbau),
  erst dann `installAugmentations`. Einbaugrund in BN8 am VERMOEGEN (Bargeld +
  Depot zum Geldkurs) statt am Bargeld messen. Achtung: ein blosser
  "kein Einbau mit Depot"-Riegel in bn4rep erzeugt den Gegenfehler
  (boerse.js haelt immer Posten -> nie Einbau).
- **known_before:** `nodes/ROADMAP.md:680-688` (7.6 "Depot leer" geplant),
  `nodes/AUFTRAG-BAU-2026-09.md:262` ("kein Einbau mit Graft/Depot"), E7
  (Restgeld). Neu: der Ausloesemechanismus (Bargeld ~0 + Einkommen 0 macht
  die Horizontregel dauerhaft wahr) und dass der Riegel nur in punish.js steht.

### BN8-2 (FEHLER, P1) boerse.js laesst kein Bargeld liegen - BARBESTAND 15 % wirkt nicht

- **Bot:** `src/boerse.js:96-101` verspricht "NICHT NULL", `:240`
  `einsetzbar = geld x 0,85`, Kaufschleife `:246-265` rechnet `frei` je
  Kandidat neu aus dem schrumpfenden Bargeld x 0,85 - nach 5-6 Kandidaten ist
  das Bargeld bei 0,15^k.
- **Spiel:** Daedalus-Einladung prueft `p.money >= 100e9`
  (`Faction/FactionInfo.tsx:143`, `FactionJoinCondition.ts:134-145`); Aug-Kauf,
  Spende, Programme, home-RAM zahlen nur aus Bargeld.
- **Rechnung (`boerse-bargeld.mjs`, 8 Seeds, GERECHNET_UNGEEICHT):** Bargeld/
  Vermoegen nach jeder Runde: Phase 1 Median 0,03 % (99 %-Quantil 1,12 %);
  mit 4S Median 0,01 % (90 %-Quantil 24 %). Runden mit Bargeld >= 100 Mrd bei
  Vermoegen >= 100 Mrd: Phase 1 **0,0 %**, mit 4S 24,7 %.
- **Folge:** bn4rep, bn4life (Programme: TOR + 5 Knacker = 287 Mio > 250 Mio
  Startgeld nach dem TRP-Einbau) und homegrow/shop (RAM fuer den
  Erfahrungsofen, Ziel Hacking 2500/3000) leben von Zufallsspitzen; ohne 4S
  keine Daedalus-Einladung.
- **Ertrag:** Voraussetzung fuer BN8-1; allein GESCHAETZT mehrere h je Zyklus
  (Kaeufe warten auf Spitzen). Fix S: Barreserve nach dem Bedarf aus
  `data/geldbedarf.txt` bzw. eine Liquidationsanfrage-Datei, Kaufschleife mit
  festem Budget `einsetzbar x ANTEIL` und Untergrenze `geld - reserve`.
- **known_before:** - (E3 betraf BN5-Trockenmodus).

### BN8-3 (SUBOPTIMAL, P2) 4S-API-Kauf prueft Bargeld statt Vermoegen: 7,1 h zu spaet je BN8-Lauf

- **Bot:** `src/boerse.js:178-193` kauft bei `geld >= 26e9` zu Rundenbeginn;
  die Kaufschleife hat das Bargeld in der Vorrunde schon angelegt.
- **Spiel:** 25 Mrd x FourSigmaMarketDataApiCost 1 (`StockMarket/StockMarketCosts.ts:8-10`),
  Bedingung nur TIX-Zugang (`NetscriptFunctions/StockMarket.ts:274-296`); bleibt
  ueber alle Einbauten des Laufs.
- **Rechnung (`boerse-4skauf.mjs`, 8 Seeds):** Vermoegen erreicht 26 Mrd nach
  11,7-16,0 h, gekauft wird nach 14,9-25,1 h; Verzoegerung **Median 7,08 h
  (3,22-9,96)**, gekauft in 8 von 8 Laeufen (Vermoegen beim Kauf 41 Mrd - 2,5 Bio).
- **Ertrag:** ~7 h je BN8-Lauf, **~21 h Route** (GERECHNET_UNGEEICHT). Fix S:
  bei Vermoegen >= 25 Mrd + Puffer gezielt verkaufen und kaufen.

### BN8-4 (SUBOPTIMAL, P2) Handelsregel: 4-5 h je Einbauzyklus langsamer als die beste Regel - Shorts sind dabei nicht der Hebel

- **Bot:** `src/boerse.js:78-91` (Historie 40, Kauf ab 0,575, Verkauf unter 0,5,
  25 % je Aktie), Rangfolge nach Vorhersage `:244`.
- **Alternative (`boerse-sim.mjs` makeOptStrategy):** Rang nach erwartetem
  Ertrag (2f-1) x mv/200 (`StockMarket.ts:264-269`), Einstieg ab |f-0,5| >= 0,05,
  ganzes freies Kapital, Mindestposition 20 Mio.
- **Rechnung (GERECHNET_UNGEEICHT, 8 Seeds, frischer Markt je Zyklus):**

  | ab 250 Mio, mit 4S | 26 Mrd | 100 Mrd | 1 Bio | 5 Bio |
  |---|---|---|---|---|
  | boerse.js-Regel (Rechner D) | 7,3 h | 9,3 h | 13,7 h | 17,3 h |
  | opt Long+Short (D) | 5,3 h | 6,9 h | 9,4 h | 12,2 h |
  | opt nur Long (`boerse-szenarien.mjs D`) | 4,6 h | 5,9 h | 8,0 h | 11,0 h |

  Phase 1 ohne 4S bis 26 Mrd (`boerse-szenarien.mjs E`): boerse.js 12,6 h
  (11,8-16,1) gegen Historie w=40, Schwelle 0,1, Long+Short 8,2 h (7,1-18,1).
- **Ertrag:** je Zyklus **-4,3 h bis 1 Bio / -5,1 h bis 5 Bio**, einmal je Lauf
  -4,4 h in Phase 1. Bei 3-4 Zyklen je Lauf GESCHAETZT ~20 h je Lauf, ~60 h
  Route. Shorts allein: opt Long 8,0 h gegen Long+Short 8,2 h bis 1 Bio - der
  Gewinn kommt aus Rangfolge, Schwelle und Positionsgroesse, nicht aus Shorts.
- **known_before:** `nodes/ERLEDIGT.md:249, 356` (Nr. 43: keine Shorts, kein
  `{stock:true}`). Neu: Zahlen, und dass die Regel selbst der Hebel ist.

### BN8-5 (TOT, P3) data/boerse-schliessen.txt hat keinen Schreiber - und Schliessen vor dem Sprung waere wertlos

- **Bot:** `src/boerse.js:52-55` ("das ausgang.js legt"), `:161-170`; grep
  `boerse-schliessen` in `src/`, `tools/`, `sync/`: nur Leser und
  `tools/test-boerse.js:129-130`.
- **Spiel:** Beim Sprung setzt `prestigeSourceFile` das Geld ohnehin zurueck
  (`PlayerObjectGeneralMethods.ts:143-171`); das Schliessen gehoert vor den
  EINBAU (BN8-1), nicht vor den Sprung.
- **Ertrag:** 0 fuer sich; die tote Mechanik erweckt den Eindruck, das
  Depotproblem sei geloest. Fix S: Mechanik auf die Einbau-Vorbereitung
  umwidmen (BN8-1) oder streichen.

### BN8-6 (RISIKO, P2) C6 mit Zahl: die Kaltstart-Leiter greift in BN8 in JEDEM Einbauzyklus

- **Bot:** `src/bn4net.js:150-152` liest `ScriptHackMoney`, nicht
  `ScriptHackMoneyGain`; Leiter ohne BN8-Phase (C6), homegrow ohne Sperre
  (INFRA-5).
- **Spiel:** 250 Mio bei jedem Einbau (`Prestige.ts:158-160`), Leiter
  verbraucht laut `nodes/audit-2026-09-02/knoten.md:43` 211 Mio -> 39 Mio.
- **Rechnung (Rechner D, mit 4S):** ab 39 statt 250 Mio bis 1 Bio: boerse.js-Regel
  17,0 statt 13,7 h (**+3,3 h je Zyklus**), opt 10,6 statt 9,4 h (+1,2 h).
  GERECHNET_UNGEEICHT; ob die Leiter das Rennen gegen boerse.js gewinnt, ist
  nicht gemessen.
- **known_before:** C6 (`nodes/AUDIT-PERFEKT-2026-09-26.md:40`), INFRA-5.
  Neu: dass es je Zyklus wiederkehrt und die Stundenzahl.

### BN15-1 (RISIKO, P2) Der V1b-Hinweis fuer BN15 rechnet mit einem Weg, der an Hacking 6000 bei HLM 0,6 scheitert

- **Bot/Plan:** `src/route.json:4` (Hinweis "BN15 vor dem Eintritt pruefen ...
  V1b"), `nodes/BAUSTELLEN.md:2678-2684` ("Wartet bis BitNode 15:
  Darknet-Labyrinth-Gewerk"), Bewertung `nodes/AUDIT-ROADMAP-2026-08-24.md:256-264`
  ("10-35 h gegen 94 h V2").
- **Spiel:** V1b = Red Pill aus dem 5. Labor einbauen, dann
  `destroyW0r1dD43m0n` mit Hacking >= 3000 x WDD 2 = 6000
  (`ServerHelpers.ts:422-424`, `Singularity.ts:1148-1153`) bei
  HackingLevelMultiplier 0,6 (`BitNode.tsx:1087`). Die Labor-Augs heben kein
  Hacking (`Augmentation/Augmentations.ts:1851-1952`: Charisma, dnet_money;
  erst The Sword +10 %, nach der Red Pill). Augs kosten x3.
- **Rechnung (GERECHNET_GEEICHT, Teil B):** Stufenformel gegen 7 Spielstaende
  exakt. Die sechs V1-Endstaende nach BN15 versetzt (gleiche exp und
  mults.hacking, HLM 0,6): BN1L3 2979, BN5L2 2489, BN5L3 3734, BN12L1 3715,
  BN12L3 4522, BN12L2 5305 - **keiner erreicht 6000**. Bei der hoechsten je
  gemessenen Erfahrungsrate (1,45e8 exp/s, BN12L2) x 0,6 (HackingSpeed) braucht
  6000 binnen 5 h `mults.hacking >= 14,32` (binnen 24 h >= 13,36). Erreicht
  wurde >= 14,3 einmal in sechs V1-Laeufen (BN12L2 15,0), in Knoten mit
  Aug-Preisfaktor <= 2.
- **Ertrag:** V1b ist in BN15 kein Kurzweg; das Labyrinth-Gewerk (~24
  Raetselloeser, Netz-Navigator, 5 Einbauzyklen) brachte keinen belegbaren
  Zeitvorteil gegen V2 (70-140 h, Rechnung C). Vermieden: ein XL-Gewerk ohne
  Ertrag. Fix S: Hinweis in route.json und den BAUSTELLEN-Eintrag auf "V2,
  V1b verworfen (Hacking 6000 bei HLM 0,6)" umstellen - mit Skeptiker.
- **known_before:** AUDIT-ROADMAP Nachtrag 24.08. (nennt "eff. 10.000" ohne
  Rechnung), `nodes/audit-2026-09-02/knoten.md:65-69`. Neu: geeichte Rechnung
  gegen echte Endstaende.

### BN15-2 (RISIKO, P3) darkweb.js erkennt TOR in BN15 (und in BN8 mit SF15) nicht

- **Bot:** `src/darkweb.js:99` `hatTor = ns.scan("home").includes("darkweb")`;
  sonst `:100-102` "Noch kein TOR" unter 200 k bzw. DOM-Weg ueber die
  Stadtkarte (`:103-200`).
- **Spiel:** Mit BN15/SF15 wird `darkweb` zum DarknetServer
  (`DarkNet/controllers/NetworkGenerator.ts:52-90`, aufgerufen bei jedem
  Start und Einbau, `Prestige.ts:99-101, 238-240`), und `ns.scan` ueberspringt
  DarknetServer (`NetscriptFunctions.ts:187`). `Player.hasTorRouter()` bleibt
  wahr (`PlayerObjectServerMethods.ts:14-16`).
- **Folge:** im Kaltstart jedes Zyklus wartet darkweb.js auf 200 k und geht
  dann den Klickweg (Fokusverlust, Klasse A1). Funktioniert ("Purchased" wird
  erkannt), kostet Minuten. In BN8 laeuft das bei jedem Einbau.
- **Ertrag:** GESCHAETZT wenige min je Zyklus. Fix S: `ns.hasTorRouter()`.

## Rechnungen

### C) BN15 auf dem Bladeburner-Weg (Rohrang-Verschiebung, `bn15-8-calc.mjs C`)

Modell: Rang = BladeburnerRank x Rohrang (`Bladeburner/Formulas.ts:9-28`),
Schwelle 400.000 unskaliert -> BN15 braucht Rohrang 2 Mio. Ein Referenzlauf
mit Faktor b haette fuer denselben Rohrang den Rang 2 Mio x b erreichen
muessen. Zusatzzeit = (2 Mio x b - 400.000) / gemessene Rate. Die Rangrate
haengt an der Aktionsstufe, nicht am Rang (`tools/lib/rangkurve.js`, Kopf),
deshalb ist die spaete Rate die richtige Groesse.

| Lauf | b / SC / Kampf-LM | Rang 400k bei | Rate Abheben / letzter Abschnitt | Zusatz-h fuer BN15 |
|---|---|---|---|---|
| BN9L2 | 0,9 / 1,2 / 0,45 | 74,9 h | 64,8k / 61,3k je h | 21,6 / 22,8 |
| BN9L3 | 0,9 / 1,2 / 0,45 | 51,9 h | 49,4k / 49,4k | 28,4 |
| BN4L2 | 1,0 / 1,0 / 1,0 | 45,7 h | 57,5k / 79,4k | 27,8 / 20,2 |
| BN10L3 | 0,8 / 1,0 / 0,4 | (lokal bis 384k) | 24,4k / 28,1k | 49,2 / 42,7 |
| BN10L2 | 0,8 / 1,0 / 0,4 | (lokal bis 250k) | 12,2k / 16,8k | 98,0 / 71,2 |

Lesart: Mit den drei gut belegten Laeufen ist BN15 = Referenzdauer (46-82 h)
+ 20-28 h = **66-110 h**; die duenn belegten BN10-Laeufe ziehen das obere Ende
auf ~140 h. Gegenlaeufig, nicht eingerechnet: Skillstufen bei gleichem Rang
x0,58-0,63 (Kosten x3, Stufen ~ Wurzel der Punkte, `Skill.ts:70-80`) gegen
Kampfstufen x1,56-1,75 (LM 0,7 statt 0,45/0,4). **GESCHAETZT 70-140 h je
BN15-Lauf, 210-420 h fuer 15.1-15.3** - der teuerste Block der Restroute.
Fruehere Schaetzungen: 94 h (Roadmap-Simulation), 75 h reine Rangzeit
(`knoten.md:67`) - im Rahmen.

### Ausgabe Rechner B (Auszug)

```
BN15 6000 binnen 1 h bei 8.69e+7 exp/s braucht mults.hacking >= 15.46
BN15 6000 binnen 5 h ...                                    >= 14.32
BN15 6000 binnen 24 h ...                                   >= 13.36
mults.hacking | BN8 3000 exp
            4 | 7.82e+12   (15 h bei 1,45e8 exp/s)
            6 | 3.16e+9    (trivial)
```

BN8 (HLM 1, WDD 1): Hacking 2500/3000 ist ab `mults.hacking` ~6 kein Thema -
dort bindet der Erfahrungsofen nur, solange RAM-Kaeufe am Bargeld haengen
(BN8-2).

## Bekannt und nicht wiederholt

C6 (bn4net liest ScriptHackMoneyGain nicht - hier nur mit Zahl, BN8-6), INFRA-5
(homegrow ohne BN8-Sperre), SLEEVE-6 (Shoplift in BN8), FAKT-7 (Fulcrum-
Begruendung), AUG-6 (Daedalus-Fuellstueck in BN15), STGO-1/-2/-3/-5 (Go,
Stanek-Falle in BN13/15, Stanek BN15, Go w0r1d_d43m0n BN8), HASH-2 (Hash-Rang
in BN15 x5 wert), inventar-gang (Gang in BN15 -20..-40 h), Nr. 43
(`{stock:true}`, Shorts).

## Offene Fragen und Rechenauftraege

1. **BN8-Laufmodell (needs_calc):** Zyklenzahl je Lauf aus Aug-Basispreisen
   (`Augmentation/Augmentations.ts`), Kette 1,767^k (`AugmentationHelpers.ts:29-37`),
   Spende rep = $/1e6 x faction_rep (`Faction/formulas/donation.ts`), Boersen-
   wachstum je Zyklus aus `boerse-sim.mjs`, Daedalus 30 Augs + 100 Mrd bar +
   Hacking 2500, TRP 2,5 Mio Ruf. Eichen: Aug-Preise gegen
   `getAugmentationPrice` eines BN5/BN12-Spielstands (BN5 x2 herausrechnen).
2. **Grafting in BN8 (needs_calc):** Graft kostet baseCost x 3 ohne Kette und
   ohne Einbau (`GraftableAugmentation.ts:20-29`), zaehlt fuer Daedalus
   (`Work/GraftingWork.tsx:51`), spart also Boersen-Neustarts - aber Entropie
   0,98^n auf alle Mults (`Constants.ts:103-104`) gefaehrdet Hacking 2500/3000
   (Teil B: unter mults.hacking ~4 braucht 3000 > 15 h). Rechnen: gemischte
   Strategie (k Grafts + Kaufzyklen) gegen reine Kaufzyklen.
3. **`{stock:true}` (needs_calc, bekannt Nr. 43):** Wirkung je grow-Aufruf
   +0,1 auf otlkMagForecast mit p = Zuwachs/moneyMax
   (`PlayerInfluencing.ts:44-61`); `boerse-sim.mjs` hat dafuer den Haken
   `market.push`. Lohnt sich die Steuerung gegen die reine 4S-Regel?
4. **BN15-V2-Dauer** belastbarer: dichtere Rangkurven der V2-Laeufe (Backups
   lokal nur stichprobenartig) und eine Aktionsstufen-Simulation mit
   `blade-formeln.mjs` bei b = 0,2, SC = 3, LM = 0,7.
