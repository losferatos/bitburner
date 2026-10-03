# Audit 03.10.2026 - Bereich HASH: Hacknet-Server und Hashes

Stand 2026-10-03 11:06 (Systemzeit). Pruefer HASH. Nichts an `src/` geaendert,
Spiel nicht angefasst. Eigene Dateien:

- `tools/audit/hash-save.mjs` - liest Flotte, Hash-Stufen, Mults, Geldquellen und
  `data/hashes.json` aus `backups/*.json.gz` (Zeitreihe je Lauf).
- `tools/audit/hash-calc.mjs` - Formeln 1:1 aus `Hacknet/formulas/HacknetServers.ts`,
  `HashUpgrade.ts`, `HashUpgradesMetadata.tsx`, Vertragslohn aus
  `PlayerObjectGeneralMethods.ts:501-567`; Eichung gegen BN2L1 09:59 (siehe Abschnitt R1).

Grundlage: Spielstand `LIVE_..._BN2L1_2026-10-03T09-59_pre-hotswap` (BN2.1, 5,29 h,
noch KEIN Einbau in diesem Knoten: `playtimeSinceLastAug == playtimeSinceLastBitnode`),
dazu alle BN2L1-, BN9L1-3-, BN12L3- und BN5L3-Staende fuer Verlauf und Gegenproben.

## Kurzfassung

1. **FEHLER (live in BN2.1): Der Rangtausch steht seit ~08:00 still.** Stufe 6 kostet
   1500 Hashes, der Speicher fasst 1280. hashes.js meldet `bedarfKapazitaet: 1500`,
   aber der Cache-Ausbau in hacknet.js steht HINTER der Sperre "nur BitNode 9"
   (`src/hacknet.js:154` vor `:168`). Seit 08:33 gingen 2536 Hashes (634 Mio $) in den
   Verkauf statt in 1 Rangstufe. Betrifft den ersten Zyklus JEDES V2-Knotens der
   Restroute. Fix: 10-117 Mio $ Cache. Absoluter Ertrag klein (Hash-Rang = +100 Rang/h
   gegen gemessene 329 Aktionsrang/h jetzt, in Knotenzeit Minuten), aber ein Defekt.
2. **FEHLER (live in BN2.1): Hacknet-Augmentierungen stehen auf Platz 2, 3 und 5 der
   bn4rep-Zielliste**, weil `mitHashes` = "SF9 vorhanden" (`src/bn4rep.js:654-660`,
   `src/lib/hackaugs.js:345-350`). Ausserhalb BN9 wirken sie nie: ein Stueck wirkt erst
   nach dem Einbau, und dann ist der SF9.3-Server weg und hacknet.js kauft keinen neuen.
   Sie kosten Geld, verteuern jedes Folgestueck um 1,9 (`Constants.ts:41`) und zaehlen
   zur Mindestwarteschlange 3 fuer den Einbau (`src/bn4rep.js:603,1259`).
3. **Hash-Rang ist in V2 absolut ein kleiner Hebel.** Rang je Stufe kostet 250*(L+1)
   Hashes (quadratisch, je Einbau zurueckgesetzt), die Aktionsrangrate haengt nicht am
   Rang (`Bladeburner/Formulas.ts:9-28`). +700 Hash-Rang im ersten Zyklus verkuerzen
   BN2 nach dem Offset-Modell um ~1 min. Die eigentlich interessanten Hash-Verwendungen
   in V2 sind **Ruf ueber Coding Contracts** (10 Vertraege = 20.600 Faktionsruf + 265 Mio $
   fuer 1375 Hashes, geeicht) und **Gym fuer Sleeves** - beide ungenutzt, Wert in Rang/h
   nicht gerechnet (needs_calc).
4. **E1 (MaxMoney in V1) ist fuer die Restroute gegenstandslos:** einziger V1-Knoten ist
   BN8, dort `HacknetNodeMoney 0` und `ScriptHackMoneyGain 0`. Die E1-Logik gehoert in
   den V2-Verkaufszweig (Geld knapp), dort aber nur P3.
5. Ausbau des Gratis-Servers ist in BN2/BN15 (`HacknetNodeMoney 1`) fast geschenkt:
   31,7 Mio $ RAM -> Rate x1,40, Amortisation < 0,6 h selbst bei Verkaufspreis (geeicht).

## R1 Eichung (Ausgabe `node tools/audit/hash-calc.mjs`, Abschnitt 1)

| Groesse | Soll (Spielstand) | Ist (Formel) | Abweichung |
|---|---|---|---|
| hashRate hacknet-server-0 (L100 C10 RAM2) | 0.4814411330033169 | 0.4814411330033169 | 0 |
| hashRate hacknet-server-1..4 (L1-2 C1 RAM2) | 0.003438865235737977 / 0.001719432617868989 | identisch | 0 |
| hashRate Server 0 um 05:33 (RAM 1) | 0.4499449841152494 | 0.4499449841152494 | 0 |
| moneySourceA.hacknet_expenses (netburn.js-Kaeufe) | 5.415.093,24 $ | 4.493.075 Kauf + 594.851 RAM + 327.168 Level = 5.415.093,24 $ | -9e-10 |
| Hash-Bilanz | erzeugt 9182,8821 | 4*1357 Verkauf + 3750 Rang (Stufen 0-4) + 4,8821 Vorrat | 0,0000 |
| Kapazitaet | 1280 | 32*2^5 + 4*32*2^1 = 1280 | 0 |
| naechster Rangpreis | hashes.json bedarfKapazitaet 1500 | 250*(5+1) = 1500 | 0 |
| Vertragslohn Faktion | contracts.txt "2500 ... Aevum" (Array Jumping Game II, d=3) | 2500*3/3 = 2500 | 0 |
| Vertragslohn Firma ohne Job | contracts.txt "833.3333333333333 ... The Black Hand" (Unique Paths I, d=3) | 2500*3/9 = 833,333 (Rekursion teilt nochmal durch 3) | 0 |
| Vertragslohn Geld | moneySourceA.codingcontract 75.000.000 | 75e6*3/3 | 0 |

Eingesetzte Spielstandwerte: `mults.hacknet_node_money` 1,6069463718401764 (SF9.3 = x1,21
aus `applySourceFile.ts:133-147` mal Augs), alle Kostenmults 0,5948507837417389,
BN2 `HacknetNodeMoney` = 1 (in `BitNode.tsx:568-591` nicht gesetzt).

Aktionsrangrate BN2.1, gemessen: Rang 1260 (3,85 h) -> 1734 (5,29 h) bei konstant 5
Hash-Stufen = **329 Rang/h** reine Aktion; 07:33 -> 08:33: 493/h.

## Tabelle 1 - Feature-Inventar aus dem Spielquellcode

| # | Feature | Wo im Quellcode | Wirkt in welchen BN (Restroute) | Ertrag/Hebel |
|---|---|---|---|---|
| 1 | Hacknet-Server statt Nodes | `Hacknet/HacknetHelpers.tsx:34-36` (`canAccessBitNodeFeature(9)`, `BitNodeUtils.ts:17-19`) | ueberall (SF9.3) | Hashes statt Geld |
| 2 | Server kaufen | `HacknetHelpers.tsx:38-63`, `formulas/HacknetServers.ts:112-118` (50k*3,2^(n-1)*Mult, max 20) | alle ausser BN8 (Rate 0) | Basisrate 0,001*Level |
| 3 | Level | `formulas/HacknetServers.ts:4-17` (Rate linear), `:19-38` (Kosten 1,1^L) | wie 2 | Rate ~ Level |
| 4 | RAM | `:4-17` (x1,07 je Verdopplung), `:40-65` (Kosten 1,4^n) | wie 2 | +7 % je Stufe, billig |
| 5 | Kerne | `:4-17` (1+(c-1)/5), `:67-88` (1,55^c) | wie 2 | +20 % Basis je Kern |
| 6 | Cache | `HacknetServer.ts:121-123` (32*2^c), `formulas/HacknetServers.ts:90-110` (10 Mio*1,85^(c-1), OHNE Kostenmult) | wie 2 | Speicher; Voraussetzung fuer teure Stufen |
| 7 | Ueberlauf-Autoverkauf | `HacknetHelpers.tsx:419-429` | wie 2 | volle Hashes -> 1 Mio $ je 4 |
| 8 | Hacknet-Server als Skript-Wirt | `formulas/HacknetServers.ts:15` (ramRatio), `HacknetServer.ts:116-119` | wie 2 | RAM-Nutzung senkt Rate linear |
| 9 | SF9.3-Gratisserver bei Knoteneintritt | `Prestige.ts:327-339` (L100 C10 Cache5 RAM1), weg bei jedem Einbau `PlayerObjectGeneralMethods.ts:130-131` | alle (BN8 Rate 0) | 0,45 H/s bei HN-Mult 1 |
| 10 | SF9-Multiplikatoren | `SourceFile/applySourceFile.ts:133-147` | alle | Rate x1,21, Kosten x0,79 |
| 11 | Hacknet-Augs (Netburners) | `Augmentation/Augmentations.ts:853-905` | alle, wirken erst nach Einbau | Rate x1,1-1,45 je Stueck |
| 12 | Einbau loescht Server + Stufen | `PlayerObjectGeneralMethods.ts:130-131`, `HashManager.ts:80-88` | alle | Stufenpreise starten neu bei 0 |
| 13 | ns.hacknet Lese-/Kauf-API | `NetscriptFunctions/Hacknet.ts:53-223` | alle | - |
| 14 | ns.formulas.hacknetServers | `NetscriptFunctions/Formulas.ts` (Formulas.exe ab SF5, `Prestige.ts:90-92`) | alle | Planung ohne Kauf |
| 15 | Hacknet Nodes (ohne Server) | `HacknetHelpers.tsx:64-82` | keiner (SF9 vorhanden) | - |
| H1 | Sell for Money | `HashUpgradesMetadata.tsx:9-24` (fest 4 H = 1 Mio) | alle | 0,25 Mio $/Hash |
| H2 | Sell for Corporation Funds | `:25-39`, Wirkung `HacknetHelpers.tsx:474-481` | nur mit Corp (BN3!) | 1 Mrd Corp-Geld je 100*(L+1) |
| H3 | Reduce Minimum Security | `:40-49`, `HacknetHelpers.tsx:482-499`, `Server.ts:111-120` | ScriptHackMoney>0 | -2 % minSec -> ~+2 % Batchdurchsatz |
| H4 | Increase Maximum Money | `:50-62`, `HacknetHelpers.tsx:500-520`, `Server.ts:126-134` | ScriptHackMoney>0 | +2 % Ertrag des Ziels |
| H5 | Improve Studying | `:63-71`, `HashManager.ts:46-50`, `Work/Formulas.ts:113` | alle | +20 % Uni-EXP additiv |
| H6 | Improve Gym Training | `:72-80`, `HashManager.ts:53-57`, `Work/Formulas.ts:113`; gilt auch fuer Sleeves `Sleeve/Work/SleeveClassWork.ts:32` | alle | +20 % Gym-EXP additiv (Spieler UND Sleeves) |
| H7 | Exchange for Corporation Research | `:81-89`, `HacknetHelpers.tsx:529-538` | nur mit Corp | 1000 Forschung je Division |
| H8 | Exchange for Bladeburner Rank | `:90-98`, `HacknetHelpers.tsx:539-546` -> `Bladeburner.ts:1265-1291` | V2 | 100 Rang + 33 SP + 200*faction_rep Bladeburner-Ruf; **ohne** BN-Multiplikator `BladeburnerRank` (der wirkt nur in `Bladeburner/Formulas.ts:13-25`) |
| H9 | Exchange for Bladeburner SP | `:99-107`, `HacknetHelpers.tsx:547-554` | V2 | 10 SP je 250*(L+1) |
| H10 | Generate Coding Contract | `:108-114`, `HacknetHelpers.tsx:556-561`, `ContractGenerator.ts:72-91,179-190`, Lohn `PlayerObjectGeneralMethods.ts:501-567` | alle (BN8/BN11/BN13 Geldanteil x0/0,25/0,4) | 26,5 Mio $ + 2058 Faktionsruf je Vertrag (BN2) |
| H11 | Company Favor | `:115-121`, `HacknetHelpers.tsx:562-567` | alle | +5 Favor bis Knotenende |
| M | BN-Multiplikatoren | `BitNode/BitNode.tsx:563-1123` | HacknetNodeMoney: BN2 1, BN3 0,25, BN11 0,1, BN6 0,2, BN7 0,2, BN14 0,25, BN13 0,4, BN15 1, BN8 0. BladeburnerRank (wirkt NICHT auf H8): BN7/14 0,6, BN13 0,45, BN15 0,2, BN8 0. CodingContractMoney: BN11 0,25, BN13 0,4, BN8 0 | skaliert Rate bzw. Wert |

Inventar: 26 Positionen (15 Mechaniken + 11 Upgrades).

## Tabelle 2 - Abdeckungsmatrix

| # | Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil |
|---|---|---|---|---|---|
| 1 | Server-Modus erkennen | `src/hashes.js:179`, `src/hacknet.js:79` (`maxNumNodes()===20`) | alle | OPTIMAL | richtig |
| 2 | Server kaufen | `src/hacknet.js:86-89,187-190` (nur BN9); `src/netburn.js:41-44` via `src/bn4life.js:228-241` (nach jedem Einbau, Netburners-Beitritt) | BN9; sonst nur netburn (5 Stueck je Zyklus) | GENUTZT-SUBOPTIMAL | fuer Hashes nur BN9; netburn kauft fuer den Beitritt (98,8 Mio $/Zyklus, amortisiert sich in BN2 per Autoverkauf in 0,6 h, BN11 6,1 h) |
| 3 | Level | `src/hacknet.js:200-201` (BN9), `src/netburn.js:55` | BN9 / netburn | GENUTZT (BN9) | ausserhalb BN9 zu Recht nicht (L100->101 = 4,1 Mrd) |
| 4 | RAM | `src/hacknet.js:139` (Wirt), `:196-197` (BN9), `src/netburn.js:56` | BN9 | NICHT GENUTZT ausserhalb BN9 | HASH-2: 5 RAM-Stufen 31,7 Mio $ -> x1,40 |
| 5 | Kerne | `src/hacknet.js:198-199` (BN9) | BN9 | NICHT GENUTZT ausserhalb BN9 | HASH-2 |
| 6 | Cache | `src/hacknet.js:168-186` hinter `:154` | nur BN9 | GENUTZT-TOT ausserhalb BN9 | HASH-1 (live) |
| 7 | Ueberlauf-Autoverkauf | implizit; hashes.js verkauft alle 10 s (`src/hashes.js:246-251`) | alle | OPTIMAL | nach Einbau verkauft das Spiel die netburn-Hashes selbst |
| 8 | Hacknet als Skript-Wirt | ausgeschlossen `src/bn4net.js:904`, `src/bn4start.js:104` | alle | OPTIMAL | richtig (ramRatio) |
| 9 | SF9.3-Gratisserver | `src/hashes.js:176-270` | erster Zyklus jedes Knotens | GENUTZT-SUBOPTIMAL | genutzt, aber Cache/RAM nicht ausgebaut (HASH-1/2) |
| 10 | SF9-Mults | passiv | alle | NICHT ANWENDBAR | keine Entscheidung |
| 11 | Hacknet-Augs | `src/bn4rep.js:654-672`, `src/lib/hackaugs.js:337-350` | alle V2 mit SF9 | GENUTZT-SUBOPTIMAL (FEHLER) | HASH-4: in V2 ausserhalb BN9 wertlos, stehen aber auf der Zielliste |
| 12 | Einbau-Reset | `src/hashes.js:192`, `src/hacknet.js:94-111` (Marker), `src/hashes.js:265-270` (rangAusHashes je augReset) | alle | GENUTZT-SUBOPTIMAL | Marker sperrt auch die spaeter gekaufte netburn-Flotte (HASH-3); Restbestand verfaellt beim Einbau (max. < 250*(L+1), Kleinbetrag) |
| 13 | ns.hacknet-API | hashes.js/hacknet.js | alle | OPTIMAL | Stufe aus `hashCost` statt `getHashUpgradeLevel` (spart 0,5 GB), korrekt |
| 14 | formulas.hacknetServers | - | - | NICHT ANWENDBAR | Preise kommen direkt aus der API |
| 15 | Hacknet Nodes | - | - | NICHT ANWENDBAR | SF9 vorhanden |
| H1 | Sell for Money | `src/hashes.js:246-251` | alle | OPTIMAL als Rueckfall | in V2 bei knappem Geld schlechter als H4 (HASH-5) |
| H2 | Corp Funds | - | - | NICHT ANWENDBAR | kein Corp-Modul (Briefing: 0 Dateien) |
| H3 | Reduce Minimum Security | - | - | NICHT GENUTZT | HASH-5 (zusammen mit H4, eigener Stufenzaehler) |
| H4 | Increase Maximum Money | - | - | NICHT GENUTZT | HASH-5; E1-Empfehlung (V1) auf der Restroute gegenstandslos |
| H5 | Improve Studying | - | - | NICHT ANWENDBAR | Bot nutzt keine Uni (`src/sleeve.js:311-316`) |
| H6 | Improve Gym Training | `src/hashes.js:228-237,255-257` | V2 vor Division / Kampfaufbau (Spieler) | GENUTZT-SUBOPTIMAL | Sleeve-Gym ignoriert (HASH-6); `restAnteil` m=0,6 und 36.000 s sind BN9-Werte (`:102,:150`), in BN2 (StrengthLevelMultiplier 1) zu hoch - praktisch folgenlos, weil ausserhalb BN9 nach Zyklus 1 keine Hashes mehr fliessen |
| H7 | Corp Research | - | - | NICHT ANWENDBAR | kein Corp-Modul |
| H8 | Exchange for Bladeburner Rank | `src/hashes.js:240-261` | V2, in Division, Geld-Ruecklage > 1 Mrd | GENUTZT-TOT ab Stufe 5 (ausserhalb BN9) | HASH-1 |
| H9 | Exchange for Bladeburner SP | - (vom Skeptiker 23.09. gekippt) | - | OPTIMAL | Rang dominiert (100 Rang + 33 SP gegen 10 SP bei gleichem Preis); Restbestand-Mischung bringt +5-12 % SP, vernachlaessigbar |
| H10 | Generate Coding Contract | - | - | NICHT GENUTZT | HASH-7 (V2, Ruf) |
| H11 | Company Favor | - | - | NICHT ANWENDBAR | keine Firmenarbeit in V2 (`src/bn4rep.js:716`), BN8 ohne Hashes |
| M | BN-Multiplikatoren | Regel "nur BN9" `src/hacknet.js:150-154` statt `HacknetNodeMoney` | alle | GENUTZT-SUBOPTIMAL | Begruendung "anderswo bringt Hacking das Tausendfache" stimmt fuer BN5 (0,2), nicht fuer BN2/BN15 (1,0): BN2-Hacking 6,4 Mrd/h gegen Gratisserver 0,44 Mrd/h = Faktor 15 |

Zaehlung: OPTIMAL 7 (1, 7, 8, 13, H1, H9, plus 3 als "zu Recht nicht"), GENUTZT-SUBOPTIMAL 6 (2, 9, 11, 12, H6, M),
GENUTZT-TOT 2 (6, H8), NICHT GENUTZT 5 (4, 5, H3, H4, H10), NICHT ANWENDBAR 7 (10, 14, 15, H2, H5, H7, H11).

## Befunde

### HASH-1 FEHLER P2 - Cache-Ausbau fuer den Rangtausch ist ausserhalb BN9 unerreichbar (live in BN2.1)

- **Bot:** `src/hashes.js:241-245` setzt `bedarfKapazitaet`, wenn `hashCost(RANG) > hashCapacity()`, und
  verkauft dann. Der Leser `src/hacknet.js:168-186` (2a, "CACHE FUER DEN RANGTAUSCH") steht hinter
  `src/hacknet.js:154` `if (knoten !== 9) { await ns.sleep(TAKT_MS); continue; }`. So seit dem Einbau
  in bfa41ce (23.09.); der Test `tools/test-hacknet-ebene2.js:126-130` ("ausserhalb von BitNode 9:
  nichts", mit `bedarfKapazitaet: 750`) schreibt den Fehler fest.
- **Spiel:** Stufe L kostet 250*(L+1) am Stueck (`HashUpgrade.ts:72-81`), `HashManager.upgrade`
  verlangt den ganzen Preis im Speicher (`HashManager.ts:131-147`), Speicher = Summe 32*2^cache
  (`HacknetServer.ts:121-123`, `HacknetHelpers.tsx:434-464`). Cache-Kosten ohne Kostenmult
  (`formulas/HacknetServers.ts:90-110`).
- **Beleg im Spielstand (09:59):** `Exchange for Bladeburner Rank` Stufe 5, `hashes.json`
  `{"art":"Sell for Money","bedarfKapazitaet":1500}`, Kapazitaet 1280. Verkaufsstufen 723 (08:33)
  -> 1357 (09:59): 2536 Hashes = 634 Mio $ verkauft statt 1 Rangstufe (100 Rang, 33 SP). Ohne die
  4 netburn-Server (Speicher 1024) blockiert der Gratisserver allein schon ab Stufe 4 (1250).
- **Ertrag (geeicht):** Rate 0,49 H/s, ab Stufe 5: Rest-T 1 h -> +100 Rang/+33 SP, 4 h -> +300/+100,
  10 h -> +700/+233 gegen 0. Das sind +20-30 % der gemessenen Aktionsrangrate 329-493/h in
  dieser Phase. In Knotenzeit (Offset-Modell, `hash-calc.mjs` Abschnitt 10): 700 Rang / ~55.000
  Rang/h Endrate = ~1 min; SP-Zinseszins frueh nicht gerechnet. Kosten des Fixes: 4x Cache 1->2 =
  40 Mio $ oder Server 0 Cache 5->6 = 117 Mio $ (+1024).
- **Umfang:** S - den Block 2a vor die BN9-Sperre ziehen (nur Cache, nur mit frischer
  `bedarfKapazitaet` aus diesem Knoten), Test 4 umdrehen. Pflicht-Skeptiker (laeuft unbeaufsichtigt).
- known_before: `nodes/BAUSTELLEN.md:539` (ERLEDIGT 23.09. "Rangtausch mit Cache-Ausbau") - galt nur in BN9.

### HASH-4 FEHLER P1 - Hacknet-Augs gelten in V2 ausserhalb BN9 als nuetzlich (live in BN2.1)

- **Bot:** `src/bn4rep.js:654-660` `mitHashes = kaufKnoten === 9 || SF9 > 0` -> mit SF9.3 immer wahr;
  `src/lib/hackaugs.js:345-350` laesst damit alle fuenf `HACKNET_AUGS` durch den Kampfknoten-Filter
  (`src/bn4rep.js:672`). Der Kommentar `src/lib/hackaugs.js:329-331` begruendet es mit
  "hashes.js tauscht Hashes in jedem V2-Knoten in Rang".
- **Spiel:** Ein Stueck wirkt erst beim Einbau (`AugmentationHelpers.ts` applyAugmentation beim
  Install). Der Einbau loescht alle Hacknet-Server (`PlayerObjectGeneralMethods.ts:130-131`), der
  SF9.3-Server kommt nur beim Knotenwechsel (`Prestige.ts:327-339`), und ausserhalb BN9 kauft
  hacknet.js keinen neuen (`src/hacknet.js:94-111`). Es bleibt nur die netburn-Flotte
  (5 Server L21, 0,18 H/s in BN2, Hashes laufen in den Autoverkauf) - NIC x1,1 waeren dort
  +16 Mio $/h. Jedes gekaufte Stueck hebt den Preis aller weiteren im Zyklus um 1,9
  (`AugmentationHelpers.ts:29-37`, `Constants.ts:41`) und zaehlt in `wartend`
  (`src/bn4rep.js:603`) gegen `MINDEST_WARTESCHLANGE 3` (`src/bn4rep.js:360,1259`).
- **Beleg:** `data/bn4rep.json` im Spielstand 09:59: `rangliste` = Augmented Targeting I,
  **Hacknet Node NIC**, **Hacknet Node Cache**, ORION-MKIV Shoulder, **Hacknet Node CPU** (Werte
  1/2/3 = reiner Zaehlplatz). Netburners-Ruf 1379, NIC braucht 1875 (`Augmentations.ts:896`).
- **Ertrag (geschaetzt):** bei 4 wartenden + Augmented Targeting I kosteten NIC/Cache/CPU
  4,5/5,5/11 Mio * 1,9^5/^6/^7 = 111 + 259 + 985 Mio = ~1,35 Mrd $, danach jedes Kampfstueck x6,86;
  dazu ein moeglicher Einbau mit nur 1-2 echten Stuecken (jeder Einbau im Kampfknoten kostet
  Stunden Wiederaufbau, `src/bn4rep.js:1234-1252`). Je Zyklus, in dem Netburners-Ruf reicht.
- **Umfang:** S - `mitHashes` nur in BN9 (oder: nur wenn nach einem Einbau Hacknet-Server gekauft
  werden). Gehoert zusammen mit HASH-7 (Vertraege heben auch Netburners-Ruf und machen die Falle
  wahrscheinlicher). Querverweis Progression: `zaehlplatzWert` (`src/lib/einbau.js:94-96`) gibt
  in V2 jedem Stueck Wert 1 fuer Daedalus, das in V2 keine Rolle spielt.

### HASH-7 NICHT_GENUTZT P2 - Coding Contracts aus Hashes in V2 bei Ruf-Engpass

- **Bot:** kein Aufruf von `Generate Coding Contract` (grep `src/`: 0 Treffer). `contracts.js`
  loest alle 30 Typen (`src/contracts.js:20-60`) und findet erzeugte Vertraege auf jedem Server.
- **Spiel:** 25*(L+1) Hashes je Vertrag, eigener Stufenzaehler (`HashUpgradesMetadata.tsx:108-114`).
  Problemtyp gleichverteilt ueber alle 30 (maxDif = 2*19+1 = 39, `ContractGenerator.ts:84-86`),
  mittlere Schwierigkeit 4,233; Lohnart gleichverteilt (`:179-190`); Ruf geht direkt, ohne Mults,
  an Faktionen mit Hacking-Arbeit (`PlayerObjectGeneralMethods.ts:514-536`).
- **Rechnung (geeicht, Abschnitt 6):** je Vertrag 26,5 Mio $ + 2058 Ruf (294 je Hacking-Faktion bei 7).
  1375 Hashes = 10 Vertraege = **265 Mio $ + 20.600 Ruf (2.940 je Faktion)** gegen 0 Rang (ab Stufe 5)
  bzw. 200 Rang (ab Stufe 0). 7057 Hashes = 23 Vertraege = 609 Mio $ + 47.300 Ruf gegen 300 Rang.
- **Lage BN2.1:** Geld liegt (9,4 Mrd, `geldbedarf` 0), Ruf fehlt: NiteSec 1.886, Sector-12 4.247
  (`offenJeFaktion` in `data/bn4rep.json`). Natuerlicher Vertragsruf je nicht bearbeiteter Faktion
  ~92/h (Sector-12 4279 -> 4503 in 2,44 h); 10 Hash-Vertraege bringen das 30-fache in 47 min.
- **Ertrag in Rang/h: nicht gerechnet** (needs_calc). Gegen den Hash-Rang (Minuten) duerfte es
  gewinnen, sobald ein Kampfstueck einer Hacking-Faktion am Ruf haengt.
- known_before: `nodes/BAUSTELLEN.md:543` (ENTSCHIEDEN 24.09., Nebenbefund a, V1/Geldwert: "gleichauf"),
  `:547` (offen seit 19.09.). Neue Bewertung: in V2 zaehlt Ruf, nicht Geld.

### HASH-2 NICHT_GENUTZT P3 - Gratisserver und netburn-Flotte werden ausserhalb BN9 nicht ausgebaut

- **Bot:** `src/hacknet.js:150-154` "NUR in BitNode 9 ... anderswo bringt Hacking das Tausendfache".
- **Rechnung (geeicht, Abschnitt 3):** BN2, Gratisserver L100 C10 RAM2: RAM 2->64 kostet 31,7 Mio $
  -> 0,481 auf 0,675 H/s (x1,40), jede Stufe amortisiert < 0,6 h selbst zum Verkaufspreis;
  100 Mio -> x1,50 (0,29 h); 300 Mio -> x1,82 (0,68 h); 1 Mrd -> x2,29 (1,73 h). Fuer Rang gilt
  Wurzel-Gesetz: x1,5 Rate = x1,22 Hash-Rang. BN2 und BN15 (HN 1,0) voll, BN13 (0,4) 2,5x
  schlechter, BN3/14 (0,25) 4x, BN6/7 (0,2) 5x, BN11 (0,1) 10x. Die Grenze "Tausendfache" stimmt
  in BN2 nicht: Hacking 6,4 Mrd/h (moneySourceA 15,2 -> 24,5 Mrd in 1,44 h) gegen 0,44 Mrd/h.
- **Ertrag absolut:** zum Verkaufspreis +175-560 Mio $/h im ersten Zyklus; ob Geld in V2 bindet,
  ist offen (BN2.1: nein). In BN15 ist Hash-Rang 5x mehr Aktionsrang wert (BladeburnerRank 0,2
  wirkt nicht auf H8): 1 Mrd Flotte -> 1500 Rang in 8 h = 7500 Aktionsrang-Aequivalent,
  Offset ~8 min je Zyklus.
- **Umfang:** S (nur RAM/Kerne des Gratisservers mit Amortisationsregel gegen `HacknetNodeMoney`
  aus `ns.getBitNodeMultipliers()` statt Knotennummer).

### HASH-3 NICHT_GENUTZT P3 - hashes.js sperrt sich nach dem ersten Einbau, obwohl netburn.js 5 Server nachkauft

- **Bot:** `src/hashes.js:192` und `src/hacknet.js:94-111` setzen `data/keine-hacknet.txt`, sobald
  ausserhalb BN9 die Kapazitaet 0 ist - das ist direkt nach jedem Einbau so. Danach kauft
  `src/bn4life.js:228-241` -> `src/netburn.js:41-58` fuenf Server (Level-Summe 105, Cache 1 = 320
  Speicher). `src/bn4net.js:3922` startet hashes.js in diesem Knoten nie wieder.
- **Beleg:** BN5L3 und BN12L3 ab dem ersten Einbau durchgehend 5 Server, Kapazitaet 320, keine
  Hash-Stufe (`node tools/audit/hash-save.mjs BN12L3 BN5L3`). E1 hielt diese Server faelschlich fuer
  "manuell oder vor C3" - sie sind netburn.js.
- **Ertrag (geschaetzt):** BN2 0,18 H/s. Passt in 320: Gym-Stufen 0-5 (50..300) -> x2,2 Gym fuer
  Spieler UND Sleeves im Wiederaufbau nach 1050 Hashes (1,6 h); Rang nur Stufe 0 (250).
  Wiederaufbau BN2 ~0,5-1 h (Spieler 1 -> 119 in < 0,85 h am Knotenstart), in BN13/14/15
  (Kampf-Mults 0,7/0,5/0,7) laenger. Groessenordnung 10-30 min je Einbau, nicht gerechnet.
- **Umfang:** S (Marker nur, wenn nach X min immer noch kein Server existiert; `restAnteil`-Konstanten
  dann knotenabhaengig machen).

### HASH-5 SUBOPTIMAL P3 - Verkaufszweig in V2 statt Increase Maximum Money / Reduce Minimum Security

- **Bot:** `src/hashes.js:246` `art = VERKAUF`, wenn kein Gym und kein Rang (vor der Division, oder
  `geld - ruecklage <= 1 Mrd`, oder HASH-1).
- **Spiel/Rechnung (Abschnitt 7, ungeeicht in der Linearitaetsannahme aus E1):** BN2, staerkstes
  Stapelziel omega-net 1,6 Mio $/s (`data/bn4net.json` im Save): T=1 h 562 Mio $ Mehrertrag gegen
  441 Mio $ Verkauf, T=2 h 1,73 Mrd gegen 0,88 Mrd, T=4 h 5,26 Mrd gegen 1,76 Mrd. MinSec hat einen
  eigenen Stufenzaehler (50*(L+1)) und wirkt aehnlich (-2 % Zeit, `Hacking.ts:60-80`).
- **Einschraenkung:** lohnt nur, solange Geld bindet; in BN2.1 lag das Geld. Zielwechsel verliert
  die Stufen (E1).
- known_before: E1 (`nodes/audit-2026-09-26/E1-hashes-urteil.md`, `nodes/AUDIT-PERFEKT-2026-09-26.md:53`) -
  neue Bewertung: fuer V1 gegenstandslos (Restroute-V1 nur BN8: `HacknetNodeMoney 0`,
  `ScriptHackMoneyGain 0`, `BitNode.tsx:764-793`), hier fuer den V2-Verkaufszweig.

### HASH-6 SUBOPTIMAL P3 - Improve Gym Training ignoriert das Sleeve-Gym

- **Bot:** `src/hashes.js:229` kauft Gym nur fuer den Spieler (`v2 && (!inDivision || aufbau)`).
  `src/sleeve.js:892-899` schickt die Sleeves ins Powerhouse Gym.
- **Spiel:** `Work/Formulas.ts:113-117` (hashMult), von `Sleeve/Work/SleeveClassWork.ts:32` benutzt.
- **Beleg:** BN2.1 05:33-08:33 alle drei Sleeves im Gym (Kampfwerte 4 -> 39, Schock 93-98),
  `Improve Gym Training` die ganze Zeit Stufe 0; Hashes gingen in Verkauf und Rang.
- **Ertrag:** 6 Stufen = 1050 Hashes (~0,6 Rangstufe) -> Gym-EXP x2,2 fuer 3 Sleeves. Wert der
  frueheren Sleeve-Bladeburner-Arbeit nicht gerechnet (needs_calc).

## Nicht als Befund, aber festgehalten

- **Hash-Rang-Wert in Knotenzeit:** Offset-Modell (Rangrate kennt den Spielerrang nicht,
  `Bladeburner/Formulas.ts:9-28`; `tools/lib/rangkurve.js` Kopf): BN9L3-Endrate 49.351 Rang/h
  (24.184 @ 41,43 h -> 623.300 @ 53,57 h). +700 Hash-Rang in BN2 = 0,8 min, +2600 in BN15 = 14 min.
  Der SP-Anteil (1 SP je 3 Rang, `Bladeburner.ts:1283-1291`) wirkt frueh staerker (in BN2.1 sind
  167 der 578 SP aus Hashes = 29 %), ist aber nicht gerechnet.
- **SP-Tausch:** richtig ungenutzt. Rang liefert bei gleichem Preis 100 Rang + 33 SP gegen 10 SP.
  SP-optimale Mischung (Abschnitt 5) bringt +5-12 % SP aus dem Restbestand, ohne Rangverlust.
- **Hash-Restbestand beim Einbau** verfaellt (`HashManager.ts:80-88`); maximal knapp eine Stufe.
- **netburn.js** kostet 98,8 Mio $ je Zyklus (geeicht ueber dieselben Formeln) und amortisiert sich
  in BN2/BN15 ueber den Autoverkauf in 0,6 h, BN13 1,5 h, BN3/14 2,4 h, BN6/7 3,0 h, BN11 6,1 h.
  Der Netburners-Beitritt selbst bringt in V2 ausserhalb BN9 nur die Hacknet-Augs (HASH-4).
- **BN8:** hashes.js beendet sich sofort (`src/hashes.js:138`); hacknet.js laeuft im ersten Zyklus
  10,45 GB lang leer (Gratisserver mit Rate 0 haelt `kapazitaet > 0`), bis zum ersten Einbau.
  Gleiches Leerlaufen in jedem V2-Knoten ausser BN9 (`src/hacknet.js:154`) - mit HASH-1/2 bekaeme
  es eine Aufgabe.
- **BN3 / Corporation:** H2 (1 Mrd Corp-Geld je 100*(L+1), Stufe 0 = 40x Verkaufswert) und H7 waeren
  in BN3 der klassische Beschleuniger - nur mit Corp-Modul, das es nicht gibt.

## Rechnungen

Alle Zahlen: `node tools/audit/hash-calc.mjs` (Abschnitte 1-10), Zeitreihen:
`node tools/audit/hash-save.mjs BN2L1 BN9L3 BN12L3 BN5L3`. Geeicht: Rate, Ausbaukosten,
Hash-Bilanz, Kapazitaet, Stufenpreis, Vertragslohn (alle exakt). Ungeeicht: Linearitaet
Ertrag ~ moneyMax (aus E1 uebernommen), r_Ende fuer BN2/BN15 (aus BN9L3 skaliert).
