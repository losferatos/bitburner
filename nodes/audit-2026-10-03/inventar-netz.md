# Audit 03.10.2026 - Bereich NETZ: Coding Contracts, Infiltration, DarkNet

Pruefer NETZ, Stand 03.10.2026 17:37 (Systemzeit). Grundlage: Spielquelle 3.0.2
(`reference/bitburner-src/src`), Bot `src/` (live, nicht geaendert), Spielstaende
`backups/*BN2L1_2026-10-03T09-59*` und `*T17-17*` (BN2.1, 5,3 h bzw. 12,6 h im Knoten).
Vorgaenger: `nodes/audit-2026-09-26/5-nebensysteme.md:118-123` (Vertraege),
`doku/schlupfloecher.md` V4 / 4.10 / A6 und `nodes/vorbereitung-2026-09-03/R3.md:41`
(Infiltration "nicht automatisierbar"), `nodes/BAUSTELLEN.md:2672-2679` (Labyrinth V1b),
`nodes/ERLEDIGT.md:1190-1193` (Labyrinth BN10). Querbezug: `inventar-fakt.md` (FAKT-1/3),
`inventar-hash.md` (HASH-7), `inventar-gang.md`, `inventar-aug.md` (AUG-3 Simulacrum),
`inventar-infra.md` (offene Frage 1 DarkNet).

Rechner (alle `tools/audit/`, Ausgaben unten in Abschnitt 4):

- `netz-save.mjs` - Kennwerte des Bereichs aus einem Spielstand (Vertraege im Netz, Geldquellen, DarknetSave, InfiltrationsSave).
- `netz-calc.mjs` - A: Vertragslohn (geeicht 45/45), B: Infiltration je Ort und BN, C: DarkNet ohne SF15.
- `netz-infil.mjs` - Infiltration im V2: Ertrag am besten machbaren Ort, Aug-Zyklus mit Infiltrationsruf/-geld, Rangelastizitaet.
- `netz-lab.mjs` - Skill-Formel geeicht (6/6), Charisma-Bedarf der Labyrinth-Labore in BN15.

## Kurzfassung

- **Coding Contracts: OPTIMAL.** `lib/loeser.js` loest alle 30 Typen aus `CodingContract/Enums.ts:1-32` (per Skript gegengeprueft: fehlend 0, ueberzaehlig 0); die 3.0.1->3.0.2-Unterschiede in `contracts/*.ts` betreffen nur Beschreibungstexte. Belohnung ist nicht waehlbar (`ContractGenerator.ts:179-190`). Lohnformel gegen jede GELOEST-Zeile des Spielprotokolls geeicht: **45/45 exakt**. Kein Rueckstau in irgendeiner BN2-Sicherung.
- **Korrektur an FAKT-3/HASH-7:** Ein Vertrag ist im Mittel **2.058 Faktionsruf + 26,5 Mio $** wert (BN2), nicht 2.646 x 41 %. Die "41 %" in `inventar-fakt.md` 4.4 sind zur Haelfte ein Rechenfehler (Firmenzweig ohne Job drittelt zweimal, 1/9 statt 1/3, `PlayerObjectGeneralMethods.ts:511,540-552`) und zur Haelfte Zufall der Erzeugung (16 statt 23,8 erwartete Vertraege, p = 0,06). Hash-Vertraege unterliegen dem Erzeugungszufall nicht: 39 Stueck je 12 h = **~80.000 Ruf + 1,0 Mrd $**, nicht 42.800.
- **Infiltration: NICHT GENUTZT, und der groesste Hebel dieses Bereichs (NETZ-1, P1).** Das fruehere Urteil "nicht automatisierbar" (`doku/schlupfloecher.md` V4, `R3.md:41`) prueft nur den `keydown`-Weg. **Neue Fundstelle:** die Minispiel-Modelle nehmen ein einfaches Objekt (`InfiltrationStage.ts:5-16`), und `state`/`stage` haengen als React-Props am Stufenbaustein (`InfiltrationRoot.tsx:134`) - `state.stage.onKey({...})` umgeht den `isTrusted`-Waechter (`InfiltrationRoot.tsx:73-77`) vollstaendig, genau wie der Bot es mit `props.onClick({isTrusted:true})` schon tut (`src/darkweb.js:190-200`, `src/join.js`). In BN2 bei heutigen Werten (Sector-12, Carmichael, kein Reisen): **392.000 Ruf/h** (x80 des Vertragsrufs) **oder 20,6 Mrd $/h** (x4,9 des Hacking-Einkommens), ohne faction_rep-/FWRG-Daempfung und parallel zur Bladeburner-Aktion (`Bladeburner.ts:1353-1366` bricht nur bei `currentWork` ab). Naechster Einbauzyklus: Kampfmass **x1,93 statt x1,26** mit ~1,1 h Infiltration (Mitglieder wie jetzt) bzw. x2,6-3,25 mit Syndicate. **Entscheidung fuer Eric:** Auftrag §12 (`nodes/AUFTRAG-BAU-2026-09.md:346`) verbietet "synthetischen Tastendruck in der Infiltration" - die dort genannte Begruendung (Hospitalisierung) trifft den Modellweg nicht, das Spiel sagt aber ausdruecklich "Do not try to automate infiltration!" (`Infiltration.ts:149`).
- **DarkNet ausserhalb BN15: NICHT GENUTZT, richtig so (NETZ-3, P3).** Kein Labyrinth und keine Red Pill ohne BN15/SF15 (`labyrinth.ts:486-497`, `NetworkGenerator.ts:250-251`) - die Formulierung in `inventar-infra.md` offene Frage 1 ("in allen Knoten ausser BN8/BN12 die Red Pill") stimmt nur mit SF15. Ertrag ohne SF15 hoechstens 0,14-0,48 Mrd/h in BN2 (3-12 % des Hacking-Einkommens), Aufwand XL (Passwortloeser).
- **RISIKO BN15 V1b (NETZ-4):** Die Red Pill liegt in BN15 im fuenften Labor (EternalLab) und verlangt **Charisma 3.000** (`labyrinth.ts:74-80`). Mit Aug-Charisma-Mult x2 sind das 4,5e16 Erfahrung (unerreichbar), mit x4 4,8e9 (~250 h Phishing mit 1.000 Faeden). Der geplante "V1b-Hinweis" braucht eine eigene Charisma-Aug-Strategie, sonst ist er tot.
- **RISIKO BN8 (NETZ-5):** Mit SF15 (Route: BN15 vor BN8) ist das DarkNet in BN8 gratis (`Prestige.ts:238-240`), und `promoteStock` hebt die Volatilitaet des Zielwerts bis x4 (`effects.ts:218-223`, `StockMarket.ts:268`). `boerse.js` kennt das nicht. Ungerechnet.

## 1. Feature-Inventar aus dem Quellcode

Pfade relativ zu `reference/bitburner-src/src/`. Restroute: BN2, 3, 11, 6, 7, 14, 13, 15 (V2), BN8 (V1).

### 1a Coding Contracts

| # | Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag/Hebel |
|---|---|---|---|---|
| C1 | Erzeugung: 3 Versuche je 10 min Spielzeit, p = 100/(399+e^(0,0012 n)) ~ 0,25; offline nachgeholt | `engine.tsx:151,204-207,268`; `CodingContract/ContractGenerator.ts:16-70` | alle | ~4,5 Vertraege/h (Zaehler wird auf 3000 GESETZT, nicht addiert - im gedrosselten Tab gehen je Takt bis 299 Zyklen verloren) |
| C2 | Ort: zufaelliger Nicht-Kauf-`Server` (kein home, kein w0r1d_d43m0n, kein DarknetServer) | `ContractGenerator.ts:192-204` | alle | per Breitensuche ab home vollstaendig erreichbar |
| C3 | 30 Typen, Schwierigkeit 1-10, Obergrenze 2xSF-Summe+1 | `CodingContract/Enums.ts:1-32`, `contracts/*.ts`, `ContractGenerator.ts:83-86,172-177` | alle | SF-Summe 19 -> alle Typen, E[d] = 4,233 |
| C4 | Belohnungstyp FR/FRA/CR/M gleichverteilt, M nur wenn CodingContractMoney > 0 | `ContractGenerator.ts:179-190` | BN8: M faellt weg | nicht waehlbar |
| C5 | Lohn: FR 2.500 d/3 an EINE Hacking-Faktion, FRA 2.500 d/3 geteilt, CR ohne Job -> FR/FRA mit 1/9, M 75 Mio d/3 x CodingContractMoney; Ruf direkt auf `playerReputation` (kein faction_rep) | `PersonObjects/Player/PlayerObjectGeneralMethods.ts:501-567`, `Constants.ts:91-93` | CodingContractMoney: BN11 0,25, BN13 0,4, BN8 0, sonst 1 | je Vertrag 2.058 Ruf + 26,5 Mio $ (BN2) |
| C6 | Versuche, Selbstzerstoerung bei 0 | `NetscriptFunctions/CodingContract.ts:28-87` (`:65`), `Contract.ts:105` | alle | ein Fehlversuch kann einen Vertrag kosten |
| C7 | ns-API: attempt 10, getContract 15, getContractType/getData/getDescription 5, getNumTriesRemaining/createDummyContract 2, getContractTypes 0 GB | `Netscript/RamCostGenerator.ts:387-396`, `CodingContract.ts:90-142` | alle | RAM |
| C8 | Hash "Generate Coding Contract", 25 x Stufe Hashes, gleiche Verteilung wie C4 | `Hacknet/data/HashUpgradesMetadata.tsx:108-114`, `HacknetHelpers.tsx:556-560` | SF9 (vorhanden) | +1 Vertrag je Kauf, unabhaengig vom Erzeugungszufall |
| C9 | DarkNet-CCT aus Phishing-Caches (`.d.cache`), Lohnfaktor 1/2, 10-min-Abkuehlung, Vertrag liegt AUF dem Darknet-Server | `DarkNet/effects/cacheFiles.ts:59-63,88-108`, `effects.ts:296-299` | nur mit DarkNet | klein |
| C10 | Einbau loescht alle Netzserver samt Vertraegen | `Prestige.ts:73-74` | alle | Verlust hoechstens ein Takt |

### 1b Infiltration

| # | Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag/Hebel |
|---|---|---|---|---|
| I1 | 35 Orte mit `infiltrationData` (maxClearanceLevel, startingSecurityLevel) | `Locations/data/LocationsMetadata.ts` (z. B. Carmichael `:246-254`) | alle, kein SF, keine BN-Option schaltet sie ab | Ortwahl |
| I2 | Start: Knopf "Infiltrate Company" (isTrusted-Pruefung am Handler-Argument), Intro "Start" (keine Pruefung); `goToLocation` (SF4) fuehrt zur Ortsseite | `Locations/ui/CompanyLocation.tsx:61-67,148`, `Infiltration/ui/Intro.tsx:83,206`, `NetscriptFunctions/Singularity.ts:213-234` | alle (SF4 vorhanden) | Weg A wie `src/darkweb.js:190-200` |
| I3 | Schwierigkeit = sec - (str+def+dex+agi+cha)^0,9/250 - int/1600; >= 3,5 = sofortiger Tod | `Infiltration/formulas/game.ts:4,41-57`, `Infiltration/Infiltration.ts:95-111` | alle; BN-Stat-Mults verschieben die Schwelle | Carmichael ab Summe > 495 |
| I4 | 8 Minispiele, Stufe = Countdown 3 x 300 ms + Spiel; nur Slash (Wachphase ~2,9 s - Fenster) und Minesweeper (2 s Merkphase) erzwingen Wartezeit | `Infiltration.ts:25-34,194-203`, `model/CountdownModel.ts:10`, `model/SlashModel.ts:50-52`, `model/MinesweeperModel.ts:102` | alle | Lauf L15 ~30 s |
| I5 | Modelle nehmen `KeyboardLikeEvent` (einfaches Objekt), Loesung steht im Modell (answer, left, choices, code, grid/answers, minefield, wires) | `Infiltration/InfiltrationStage.ts:1-16`, `model/*.ts` (`onKey`) | alle | **automatisierbar ohne Tastaturereignis** |
| I6 | Tastatur-Waechter: untrusted `keydown` -> Tod ("Do not try to automate infiltration!") | `Infiltration/ui/InfiltrationRoot.tsx:73-77`, `Infiltration.ts:139-151` | alle | Falle nur fuer den Ereignisweg |
| I7 | `state` und `stage` als Props am Stufenbaustein; `updateEvent` meldet jeden Stufenwechsel synchron | `InfiltrationRoot.tsx:84,134`, `Infiltration.ts:68,159-192` | alle | ereignisgetriebene Loesung ohne Polling (Slash-Fenster 250 ms) |
| I8 | Fehlschlag: Schaden sec x 3 (WKS x0,5); Hospitalisierung bricht die Infiltration ab | `Infiltration/utils.ts:34-36`, `Infiltration.ts:82-88,152-155` | alle | HP-Max ~28 -> 2 Fehler = Abbruch |
| I9 | Lohn "Sell": (r+1)^2 sec^3 x Nachfrage x 3.000 x L x 1,01^L x InfiltrationMoney (WKS x1,5) | `Infiltration/formulas/victory.ts:8-26`, `ui/Victory.tsx:71-74` | InfiltrationMoney: BN2 3, BN11 2,5, BN6/7/14 0,75, BN3/13/15 1, BN8 0 | Carmichael BN2: 183 Mio/Lauf |
| I10 | Lohn "Trade": (r+1)^1,1 sec^1,1 x Balance x Nachfrage x 30 x L x 1,005^L x InfiltrationRep (WKS x1,2); `Factions[f].playerReputation += rep` - **kein faction_rep, kein FactionWorkRepGain**; nur Faktionen mit Arbeit im Dropdown | `victory.ts:28-63`, `Victory.tsx:76-83,118-119`, `Faction/FactionInfo.tsx:110-112` | InfiltrationRep: BN11 2,5, sonst 1 (BN8 1!) | Carmichael: 3.490 Ruf/Lauf |
| I11 | Marktnachfrage 1 - 0,001 f^2, f klingt mit tau 50 s (Wanduhr) ab, +L je Lauf, Stempel = Laufbeginn | `formulas/game.ts:5-39`, `Victory.tsx:42-45` | alle | Gleichgewicht bei Dauerbetrieb ~0,72 |
| I12 | Shadows of Anarchy: Einladung nach jedem Sieg, SoA-Ruf je Lauf (sec/maxSec x 5.000 x (0,8+0,05(L-5)) x Nachfrage x (1+Favor/100)), keepOnInstall | `Victory.tsx:89-94`, `victory.ts:65-86`, `FactionInfo.tsx:795-815` | alle | Carmichael 1.280 SoA-Ruf/Lauf |
| I13 | 9 SoA-Augs: 1 Mio $ x 7^k, 1e4 Ruf x 1,3^k; zaehlen NICHT in die x1,9-Treppe; WKSharmonizer x1,5 Geld / x1,2 Ruf / x2 SoA-Ruf | `Augmentation/AugmentationHelpers.ts:17-37,141-154`, `Constants.ts:100-101` | alle; BN8: Daedalus-Zaehler (`FactionJoinCondition.ts:115-131` zaehlt installierte Augs) | billiger Infiltrationsverstaerker; Daedalus-Fueller ohne Treppe |
| I14 | Infiltration ist keine `currentWork`: Bladeburner-Aktion laeuft weiter; `isBusy()` liefert waehrenddessen true | `Bladeburner/Bladeburner.ts:1353-1366`, `Singularity.ts:558-561` | V2 | parallel zum Rang, keine Spielerzeit |
| I15 | ns.infiltration: getPossibleLocations 0 GB, getInfiltration (Werte bei Nachfrage 1) | `NetscriptFunctions/Infiltration.ts:18-84`, `RamCostGenerator.ts:381-384` | alle | Eichquelle fuer die Formeln |

### 1c DarkNet

| # | Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag/Hebel |
|---|---|---|---|---|
| D1 | Zugang DarkscapeNavigator: 50 Mio (darkweb) bzw. 30 Mio (Shadowed Walkway); verfaellt beim Einbau; frei mit BN15 oder SF15 | `DarkNet/Constants.ts:6-8`, `DarkWeb/DarkWebItems.ts:15-19`, `Locations/ui/SpecialLocation.tsx:396-410`, `DarkNet/utils/darknetAuthUtils.ts:6-8`, `Prestige.ts:100-102,238-240` | alle; ab SF15 (nach BN15) gratis, also in BN8 | Eintritt |
| D2 | Netz: Tiefe 5 ohne Vollzugang, darkweb wird DarknetServer mit 16 GB und Admin | `labyrinth.ts:486-497`, `DarkNet/controllers/NetworkGenerator.ts:68-111` | alle | Skript-RAM klein |
| D3 | Anmeldung/Erkundung: authenticate, connectToSession, heartbleed, probe, getServerDetails (Passwortmodelle) | `NetscriptFunctions/Darknet.ts:96-340,384-416`, `DarkNet/controllers/ServerGenerator.ts` | alle mit Zugang | Voraussetzung fuer D4-D6, Aufwand gross |
| D4 | Caches (`openCache`): Geld 1,2^d x 1e7 x (200+cha)/200 x crime_money x dnet_money x DarknetMoneyMultiplier (SF15.3 x1,5); Programme bis Formulas; WSE/TIX/4S-Daten; Gratisaktien; Hinweisdateien; Karma -(d+1) | `Darknet.ts:301-320`, `DarkNet/effects/cacheFiles.ts:45-195` | DarknetMoneyMultiplier: BN3 0,4, BN13 0,1, BN8 0, sonst 1 | 18-37 Mio je Cache (BN2, d 0-4) |
| D5 | Phishing: Versuch alle 10 s x 400/(400+cha); Geld 500 x ... x Faeden (winzig); Cache-Chance 0,5 % x Faeden, 3-min-Abkuehlung; cha-Erfahrung 50 x Faeden | `DarkNet/effects/phishing.ts:12-73`, `Darknet.ts:614-621` | wie D4 | Cache-Quelle; einzige skalierbare cha-Quelle |
| D6 | promoteStock: Ladung + Faeden x (500+cha)/500, Volatilitaet x(1 + (1-e^-0,001c) + 2(1-e^-0,00015c)) <= 4, Abklingen x0,4 je Marktzyklus; braucht TIX-API | `Darknet.ts:584-612`, `DarkNet/effects/effects.ts:218-231`, `StockMarket/StockMarket.ts:235,268` | alle mit Zugang; relevant BN8 | Amplitude des Zielwerts |
| D7 | Labyrinth: nur BN15/SF15; 6 Augs (agi/dex/str/def x1,06-1,1, cha, dnet_money), je Labor ein Einbau (prueft installierte Augs); TRP in BN15 im 5. Labor (EternalLab, cha 3.000), sonst 7. Labor (cha 4.000), nie in BN8/BN12 | `DarkNet/effects/labyrinth.ts:37-107,403-512`, `NetworkGenerator.ts:235-260`, `cacheFiles.ts:197-207`, `BitNode.tsx:786,954` | BN15 (V1b), mit SF15 auch BN8 (ohne TRP) | V1b-Ausgang, kleine Kampf-Mults |
| D8 | Labyrinth-Augs landen direkt in der Warteschlange und zaehlen in die x1,9-Treppe | `cacheFiles.ts:202`, `AugmentationHelpers.ts:29-37` | wie D7 | Preisfalle |
| D9 | Netzpflege: Stasis-Link, Migration, freezeServer, memoryReallocation, unleashStormSeed, Instabilitaet | `Darknet.ts:220-239,341-382,418-575,623-633` | mit Zugang | kein direkter Ertrag |
| D10 | Prestige setzt den DarkNet-Zustand (Ladungen, Server) zurueck | `Prestige.ts:76` | alle | jede Investition je Zyklus neu |

## 2. Abdeckungsmatrix

| # | Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil |
|---|---|---|---|---|---|
| 1 | Vertraege loesen, 30 Typen | `src/contracts.js:276-512`, `src/lib/loeser.js:49-1555` (30 Eintraege), Registry `contracts.js --loop 300` (Phase normal, Werkbank) | alle, ab Kaltstartende | OPTIMAL | 30/30, woertliche getAnswer-Abschriften, Gegenprobe `verify` vor jedem Versuch; kein Rueckstau in 7 BN2-Sicherungen |
| 2 | Kaltstartkette cdump/csolve | `src/cdump.js`, `src/csolve.js:56-140`, Registry `phase: kaltstart` | Kaltstart (ruht: home startet mit 128 GB > `HOME_KALTSTART_GB` 64, `src/bn4net.js:644-651`) | OPTIMAL | contracts.js laeuft ab Minute 1 (BN2.1: 04:43); rotiert ueber `data/cantwort.json`; die liegengebliebene Altdatei (stormtech, mindestens seit der BN12-Sicherung 04:42; csolve lief zuletzt 19.09.) raeumt csolve beim naechsten Kaltstart selbst (`csolve.js:86-91,141`) |
| 3 | Versuchsschutz/Notbremse/Kanarienvogel | `src/contracts.js:206-225,336-390,430-448` | alle | OPTIMAL | richtig, 0 Ablehnungen seit Wochen |
| 4 | Belohnungswahl | - | - | NICHT ANWENDBAR | wird bei Erzeugung gewuerfelt (`ContractGenerator.ts:179-190`) |
| 5 | Firmenzweig (Job) | kein Job im V2 (`src/bn4rep.js:716,749-754`, FAKT) | V2 | OPTIMAL | ohne Job 1/9-Faktionsruf statt wertlosem Firmenruf |
| 6 | Takt und Verlust beim Einbau | 5-min-Schleife | alle | OPTIMAL | Verlust <= 1 Takt (~0,4 Vertraege) |
| 7 | Hash -> Vertrag | `src/hashes.js` (verkauft) | V2 | NICHT GENUTZT | FAKT-3/HASH-7; Wert hier korrigiert (NETZ-2) |
| 8 | DarkNet-CCT | - | - | NICHT ANWENDBAR | kein DarkNet; Vertraege laegen auf Darknet-Servern, die die Breitensuche nicht sieht |
| 9 | createDummyContract/getDescription | - | - | NICHT ANWENDBAR | kein Ertrag |
| 10 | Infiltration durchfuehren | fehlt (Seitenwaechter erkennen sie nur: `src/buyaugs.js:935`, `src/homeram.js:366`, `src/join.js:317`, `src/keepalive.js:184`) | - | NICHT GENUTZT | NETZ-1 |
| 11 | Trade -> Faktionsruf | fehlt | - | NICHT GENUTZT | NETZ-1 (x80 Vertragsruf in BN2) |
| 12 | Sell -> Geld | fehlt | - | NICHT GENUTZT | NETZ-1 (x4,9 Hacking in BN2) |
| 13 | Nachfrage-Taktung | fehlt | - | NICHT GENUTZT | Teil NETZ-1 |
| 14 | SoA + WKSharmonizer, SoA-Augs als Daedalus-Fueller | fehlt (bn4life nimmt jede Einladung an, `src/bn4life.js:274-291`) | - | NICHT GENUTZT | Teil NETZ-1 (V2: WKS; BN8: Fueller ohne Treppe) |
| 15 | ns.infiltration Info-API | fehlt | - | NICHT GENUTZT | kein eigener Ertrag, aber Eichquelle (NETZ-1 calc_spec) |
| 16 | Infiltrationsseite erkennen | `src/buyaugs.js:935`, `src/homeram.js:362-366`, `src/join.js:317`, `src/keepalive.js:184` | alle | OPTIMAL | DOM-Werkzeuge weichen aus |
| 17 | DarkscapeNavigator | fehlt (`src/darkweb.js` kauft nur Portprogramme) | - | NICHT GENUTZT | vertretbar, NETZ-3 |
| 18 | Caches | fehlt | - | NICHT GENUTZT | NETZ-3 |
| 19 | Phishing | fehlt | - | NICHT GENUTZT | NETZ-3 (und Charisma fuer NETZ-4) |
| 20 | Darknet-RAM | fehlt | - | NICHT GENUTZT | 0,02-0,34 TB gegen 92 TB Netz: bedeutungslos |
| 21 | promoteStock | fehlt (`src/boerse.js` ohne dnet) | BN8 | NICHT GENUTZT | NETZ-5 |
| 22 | Labyrinth/TRP | fehlt; geplant `nodes/BAUSTELLEN.md:2672-2679` | BN15 | NICHT ANWENDBAR (vor BN15) | NETZ-4 RISIKO |
| 23 | Labyrinth-Augs in der Treppe | `src/buyaugs.js:200-208,1130-1140` liest die Warteschlange aus der UI | BN15/SF15 | OPTIMAL | q wird richtig gezaehlt |
| 24 | Netzpflege (D9) | fehlt | - | NICHT ANWENDBAR | kein Ertrag ohne Netznutzung |
| 25 | Karma aus Caches | fehlt | - | NICHT ANWENDBAR | -(d+1) je Cache, gegen -54.000 Gang-Schwelle bedeutungslos |

Zaehlung (25 Zeilen): OPTIMAL 7, GENUTZT-SUBOPTIMAL 0, GENUTZT-TOT 0, NICHT GENUTZT 12, NICHT ANWENDBAR 6.

## 3. Befunde

### NETZ-1 (NICHT_GENUTZT, P1) - Infiltration als Ruf- und Geldquelle im V2; automatisierbar ueber die Modelle, nicht ueber Tasten

- **Bot:** fehlt. Es gibt nur Seitenwaechter, die eine laufende Infiltration erkennen und ausweichen (`src/buyaugs.js:935`, `src/homeram.js:366`, `src/join.js:317`, `src/keepalive.js:184`). Frueheres Urteil "unmoeglich ohne trusted keydown, nur CDP" (`nodes/vorbereitung-2026-09-03/R3.md:41`, `doku/schlupfloecher.md` V4 und 4.10); der Bauauftrag schliesst "synthetischen Tastendruck in der Infiltration" aus (`nodes/AUFTRAG-BAU-2026-09.md:346`, Begruendung: hospitalisiert).
- **Spiel (neue Fundstelle):** Der Waechter sitzt nur am `document`-Listener (`InfiltrationRoot.tsx:73-77`). Die Modelle selbst pruefen nichts: `onKey(event: KeyboardLikeEvent)` mit `key/altKey/ctrlKey/metaKey/shiftKey` (`InfiltrationStage.ts:5-16`; z. B. `SlashModel.ts:30-38`), und `state`/`stage` stehen als Props am Stufenbaustein (`InfiltrationRoot.tsx:134`) - erreichbar ueber die Fiber-Kette, die der Bot schon nutzt (`src/buyaugs.js:791-794`). Jede Stufenaenderung feuert `state.updateEvent` synchron aus dem Spieltimer (`Infiltration.ts:159-192`, `SlashModel.ts:52-58`): ein Abonnent loest Slash im 250-ms-Fenster ohne Polling. Start: `goToLocation` (SF4, `Singularity.ts:213-234`), Knopf ueber `props.onClick({isTrusted:true})` (`CompanyLocation.tsx:61-67`, Muster `src/darkweb.js:190-200`), Intro-Start ohne Pruefung (`Intro.tsx:83,206`). Victory-Knoepfe ohne Pruefung (`Victory.tsx:71-83,126-138`).
- **Ertrag (BN2.1, Werte 09:59 und 17:17, `netz-calc.mjs`/`netz-infil.mjs`):** Carmichael Security (Sector-12, sec 4,66, L15, Schwierigkeit 2,94; kein Reisen): Lauf 30,5 s, Periode 32 s, Nachfrage 0,72 -> **392.000 Ruf/h** ODER **20,6 Mrd $/h**; SysCore (Volhaven) 430.000 Ruf/h bzw. 23,9 Mrd $/h. Gegen den gemessenen Vertragsruf 4.932-5.360/h (x73-80) und das Hacking-Einkommen 4,2 Mrd/h (x4,9). Empfindlichkeit: halbe Steuergeschwindigkeit + 12 s Gemeinkosten -> noch 258.000 Ruf/h bzw. 14,3 Mrd/h (SysCore).
- **Wirkung im Einbauzyklus (`netz-infil.mjs` Teil 2, Annahmen wie `fakt-v2.mjs`: 35 Mrd/12 h, Bladeburners-Ruf 13.000):** Referenz ohne Infiltration x1,26 (4 Stuecke, reproduziert FAKT "Ist" exakt). Mit Infiltration und heutigen Mitgliedschaften: **12 Stuecke, x1,93**, Rufzeit 0,46 h + ~0,65 h Geldzeit. Mit Syndicate (Kampf 200): x2,60 (2 h), x3,05 (6 h), x3,25 (9,6 h). Rangelastizitaet im Bladeburner-Modell (`tools/bbrank/sim.mjs`) bleibt ~1 bis Faktor 3,5 (x1,26 -> x1,27; x2,2 -> x2,20; x3,5 -> x3,44). Rang/h nach dem naechsten Einbau also **x1,53** (Mitglieder wie jetzt) bis **x2,6** (mit Syndicate).
- **In Stunden (GESCHAETZT):** Bei 10-16 h Restlauf nach dem ersten Einbau eines BN2-Laufs (Rahmen aus FAKT-1) **3,5-5,5 h je Lauf** ohne Beitrittsaenderung, 5-10 h mit Syndicate; spaetere Zyklen verstaerken. Dazu Geld fuer das Simulacrum (150 Mrd Basis, AUG-3) in ~7 h statt nie. Uebertrag: BN3 (AugmentationRepCost 3 und MoneyCost 3, `BitNode.tsx:593-626`; Hacking-Geld dort x0,04 Servergeld) besonders stark; BN11 Ruf und Geld x2,5; BN6/7/14 Geld x0,75, Ruf x1; BN13/15 x1; BN8 nur Ruf (TRP-Ruf 2,5 Mio in ~6,4 h) plus SoA-Augs als Daedalus-Zaehler ausserhalb der x1,9-Treppe.
- **Zusammenspiel Gang (BN2):** Beide loesen die Rufgrenze; die Gang nur in BN2 (ausserhalb Karma -54.000, `inventar-gang.md`), die Infiltration in allen acht V2-Knoten. Das Infiltrationsgeld bleibt auch mit Gang ein eigener Hebel (Geld wird bindend, sobald Ruf frei ist: 12 Stuecke kosten 48 Mrd, 14 mit Syndicate 185 Mrd).
- **Bauhinweise (Fallen):** `blade.js:4363` ruft `hospitalize()` - das bricht eine laufende Infiltration ab (`Infiltration.ts:82-88`); `isBusy()` ist waehrenddessen true (`Singularity.ts:558-561`); jede Seitennavigation eines anderen Werkzeugs bricht ab (`InfiltrationRoot.tsx:65-67`); nach jedem Einbau Summe(Kampf+cha) > 495 abwarten (sonst Tod beim Start, `Infiltration.ts:97-108`); `document` kostet 25 GB RAM, Trick aus `src/join.js` (Parameter statt Bezeichner); Uhren: Laufzeit und Nachfrage laufen in Wanduhr (`performance.now`, `Date.now`), offline gibt es keine Infiltration und nichts nachzuholen; der erste Lauf nach einer Pause hat Nachfrage ~1 (Bestand, keine Rate) - die Rechnung nimmt das Gleichgewicht 0,72.
- **Entscheidungsregel fuer den Bau:** Ruf zuerst fuer die Schwellen der geplanten Stuecke (je Faktion nur bis zur hoechsten Schwelle; Ruf ist Schwelle, keine Waehrung), Rest verkaufen; Trade nur an Faktionen mit Arbeit (`Victory.tsx:118-119`), Bladeburners geht nicht.
- **known_before:** `doku/schlupfloecher.md` V4/4.10/A6, `nodes/vorbereitung-2026-09-03/R3.md:41`, `nodes/AUFTRAG-BAU-2026-09.md:346`. Neu: Modellweg (Fundstelle oben) und Ertrag bei heutigen Werten (4.10 rechnete mit Startwerten, nur Noodle Bar machbar, 1,5 Mio/Runde).

### NETZ-2 (NICHT_GENUTZT, P3) - Korrektur des Vertragswerts in FAKT-3/HASH-7

- **Bot:** `src/hashes.js` verkauft Hashes; "Generate Coding Contract" 0 Kaeufe (FAKT-3).
- **Spiel:** Lohn `PlayerObjectGeneralMethods.ts:501-567`. Der Firmenzweig ohne Job ruft die Funktion mit dem schon gedrittelten Faktor erneut auf und drittelt ein zweites Mal (`:511`, `:540-552`) - **sequenzielle Mutation**: CR bringt 2.500 d/9, nicht 2.500 d/3.
- **Gerechnet und geeicht (`netz-calc.mjs` A):** 45/45 GELOEST-Zeilen in `data/contracts.txt` (BN2-Fenster) exakt. Erwartung je Vertrag (BN2) = d x (833 + 833 + 278 + 0)/4 = **2.058 Ruf** und 26,5 Mio $ (E[d] = 4,233). FAKT 4.4 nutzte 0,75 x 2.500 x 4,23/3 = 11.900/h; richtig ist 9.260/h. Gemessen 4.932/h (09:59) = 53 %, 5.360/h (17:17) = 58 % - der Rest ist Erzeugung (16 Vertraege statt 23,8 erwartet, P(X<=16) = 0,061; 45 statt 56,6, P = 0,067) und Typmischung (mehr Geldvertraege), kein Loeserverlust (kein Rueckstau in sieben Sicherungen).
- **Folge fuer FAKT-3:** Hash-Vertraege werden ohne Erzeugungswurf angelegt (`HacknetHelpers.tsx:556-560`) - fuer sie gilt die volle Erwartung: 39 Vertraege je 12 h = **~80.000 Ruf + 1,03 Mrd $** statt 42.800 Ruf. Mit NETZ-1 wird das nachrangig (392.000 Ruf/h).
- **known_before:** `inventar-fakt.md` FAKT-3 und 4.4, `inventar-hash.md` HASH-7.

### NETZ-3 (NICHT_GENUTZT, P3) - DarkNet ausserhalb BN15: kleiner Ertrag, grosser Aufwand - nicht bauen

- **Bot:** 0 Treffer fuer `ns.dnet`/`dnet.` in `src/`; `src/darkweb.js` kauft nur Portprogramme.
- **Spiel:** Ohne Vollzugang Tiefe 5, kein Labor (`labyrinth.ts:486-497`, `NetworkGenerator.ts:250-251`). Caches `cacheFiles.ts:45-195`, Phishing `phishing.ts:12-73`, Zugang 50 Mio je Zyklus (`Prestige.ts:76`, Programm geht beim Einbau verloren).
- **Gerechnet (`netz-calc.mjs` C, ungeeicht - kein Spielstand hat DarkNet-Ertrag):** BN2 Cache-Geldzweig 17,9-37,0 Mio (d 0-4); nur darkweb (4 Faeden): hoechstens 0,14 Mrd/h; 18 geknackte Server (336 GB, 93 Faeden): hoechstens 0,48 Mrd/h = 3-12 % des Hacking-Einkommens. Uebrige Cache-Gaben ohne V2-Wert (Programme hat der Bot, WSE/TIX/4S nur fuer BN8, Gratisaktien klein).
- **Urteil:** Nichtnutzung vertretbar; Passwortloeser fuer alle Modelle sind XL. Nicht wieder aufmachen ohne neue Messung.
- **Querbezug:** `inventar-infra.md` offene Frage 1 - die Red Pill aus dem Labyrinth gibt es nur mit BN15/SF15; ohne SF15 existiert kein Labor-Server.

### NETZ-4 (RISIKO, P3) - BN15 V1b: die Red Pill im Labyrinth verlangt Charisma 3.000

- **Bot:** geplant als "Wartet bis BitNode 15: Darknet-Labyrinth-Gewerk (V1b)" (`nodes/BAUSTELLEN.md:2672-2679`: je Labor ein Einbauzyklus, ~24 Raetselloeser) - ohne Charisma-Betrachtung. ERLEDIGT (`nodes/ERLEDIGT.md:1190-1193`) erklaerte den Weg fuer BN10 (FinalLab cha 4.000, CharismaLevelMultiplier 0,4) fuer tot; BN15 ist dort nicht gerechnet.
- **Spiel:** Labore 300/600/1.500/2.500/3.000 cha (`labyrinth.ts:37-80`); in BN15 TRP im EternalLab (`:419-422,449-452`); Anmeldung nur mit `requiredCharismaSkill` (`NetworkGenerator.ts:258`); BN15 CharismaLevelMultiplier 1,1 (`BitNode.tsx:1094`).
- **Gerechnet und geeicht (`netz-lab.mjs`):** Skill-Formel `skill.ts:7-15` gegen sechs Werte des Spielstands 17:17 exakt (6/6). Benoetigte Charisma-Erfahrung fuer 3.000 bei Grundmult 1,328: Aug-Mult x1 3,8e30, x2 4,5e16, x4 4,8e9, x22,5 (alle kaeuflichen cha-Augs) 8,4e3. Phishing liefert ~1,9e6 exp/h je 100 Faeden (cha 600).
- **Folge:** Ohne gezielten Charisma-Aufbau (Aug-Mult >= ~6-8: SmartJaw x1,5, Enhanced Social Interaction x1,6, Neotra x1,55, nextSENS x1,2 ... - Firmenfaktionen, in BN15 Geldkosten x3) ist V1b in BN15 unerreichbar, und die Lab-Kette braucht zusaetzlich vier Einbauzyklen davor.
- **known_before:** `nodes/BAUSTELLEN.md:1737-1740` (5. statt 6. Labor), `:2672-2679`.

### NETZ-5 (NICHT_GENUTZT/RISIKO, P3) - BN8: promoteStock und SF15 fuer boerse.js ungenutzt

- **Bot:** `src/boerse.js` ohne DarkNet (grep 0).
- **Spiel:** Route BN15 vor BN8 -> SF15 vorhanden -> DarkNet in BN8 gratis bei Knoteneintritt (`Prestige.ts:238-240`, `darknetAuthUtils.ts:6-8`). `promoteStock` (`Darknet.ts:584-612`) laedt c um Faeden x (500+cha)/500 je ~8 s x 600/(600+cha); Volatilitaet x(1 + (1-e^-0,001c) + 2(1-e^-0,00015c)), Abklingen x0,4 je Marktzyklus (`StockMarket.ts:235`), wirkt auf die Preisbewegung (`:268`). Muss auf einem Darknet-Server laufen (`expectRunningOnDarknetServer`); darkweb hat 16 GB (4 Faeden), mehr nur ueber geknackte Darknet-Server. DarknetMoneyMultiplier 0 in BN8 betrifft das nicht.
- **Ertrag:** ungerechnet. 4 Faeden -> Gleichgewicht c ~440 -> x1,48; 100 Faeden -> x~3,5 (Ueberschlag, needs_calc). Ob mehr Amplitude den Manipulationsgewinn hebt, gehoert ins Boersenmodell (`tools/audit/boerse-sim.mjs`).
- **known_before:** `nodes/BAUSTELLEN.md:2592-2601` ("Nuetzlich, aber kein Hebel, den man vor dem Bot bauen muesste") - neu ist die SF15-Gratisfreischaltung durch die feste Route.

## 4. Rechnungen mit Eichung

### 4.1 Vertragslohn - GERECHNET_GEEICHT (`node tools/audit/netz-calc.mjs BN2L1_2026-10-03T17-17`)

```
Eichung gegen data/contracts.txt (BN2-Fenster): 45/45 Zeilen exakt
  gemessen: 45 Vertraege in 12.58 h = 3.58/h; Ruf 67.459 k (5.360 k/h), Geld 1.475 Mrd (117.207 Mio/h)
  Formel-Erwartung: 4.50 Vertraege/h
  BN2: E[d]=4.233  je Vertrag Ruf 2.058 k, Geld 26.458 Mio  -> je h Ruf 9.260 k, Geld 119.063 Mio
  BN11: ... Geld 6.615 Mio; BN13: Geld 10.583 Mio; BN8: Ruf 2.744 k, Geld 0
```
Stand 09:59: 16/16 exakt, 16 Vertraege in 5,29 h. Rueckstau (Vertraege im Netz) in allen sieben BN2-Sicherungen 05:33-17:16: 0. Luecke 10:31-17:16 im Protokoll = Spiel ohne Bruecke (keine Sicherungen in dem Fenster), die 28 offline erzeugten Vertraege wurden um 17:16:44 in einem Durchlauf geloest.

### 4.2 Infiltration - GERECHNET_UNGEEICHT (`node tools/audit/netz-infil.mjs`)

Kein Spielstand enthaelt eine Infiltration (`InfiltrationsSave` floors 0, lastChangeTimestamp 0; `moneySourceA.infiltration` 0) - die Formeln sind woertlich aus `formulas/game.ts`/`victory.ts`, die Spielerwerte aus dem Stand.
```
Summe Kampf+cha 794; machbare Orte 11/35
  VolhavenSysCoreSecurities sec 4.77 L18 diff 3.05: Lauf 35.4 s, Periode 37 s, Nachfrage 0.730
     je Lauf: Ruf 4.42 k ODER Geld 245.72 Mio (BN2 x3); SoA-Ruf 1.48 k
     je Stunde: Ruf 430.18 k ODER Geld 23.91 Mrd
  Sector12CarmichaelSecurity sec 4.66 L15 diff 2.94: Lauf 30.5 s, Periode 32 s, Nachfrage 0.720
     je Lauf: Ruf 3.49 k ODER Geld 182.72 Mio (BN2 x3); SoA-Ruf 1.28 k
     je Stunde: Ruf 392.43 k ODER Geld 20.56 Mrd
  Schwelle Summe(str,def,dex,agi,cha) fuer Carmichael: > 495
REFERENZ ohne Infiltration: 4 Stuecke, ln 0.232 (x1.26), Geld 7.45 Mrd
Mitglieder wie jetzt, Infiltration 2 h: 12 Stuecke, ln 0.657 (x1.93), Rufzeit 0.46 h, Preis 48.30 Mrd
+ The Syndicate 2 / 6 / 9.6 h: x2.60 / x3.05 / x3.25 (Rufzeit 0.41-2.27 h, Preis 66-185 Mrd)
Rang in 10 h je Kampffaktor: x1.26 -> x1.27, x1.72 -> x1.73, x2.2 -> x2.20, x2.8 -> x2.77, x3.5 -> x3.44
```
Zeitmodell eines Laufs: 0,9 s Countdown je Stufe, Slash Mittel (2.875 - Fenster)/1000 + 0,05 s, Minesweeper 2 s, sechs Spiele 0,2 s, 6 s Gemeinkosten je Lauf; Nachfrage im Gleichgewicht f = L q/(1-q), q = e^(-T/50 s). Die Aug-Wahl probiert vier Gier-Ordnungen (Preistreppe macht die Wahl reihenfolgeabhaengig) und ist eine Untergrenze. Rangmodell: Gegenprobe -19 % gegen real (`fakt-rang.mjs`), Verhaeltnisse belastbar, Absolutwerte nicht.

### 4.3 Skill-Formel und Labyrinth - GERECHNET_GEEICHT (`node tools/audit/netz-lab.mjs`)

```
hacking 408, strength 198, defense 186, dexterity 186, agility 186, charisma 69: Formel = Spielstand (6/6)
Charisma-Augs 32, Produkt aller kaeuflichen x22.51
Benoetigte cha-Erfahrung BN15:   Augs x1     x2       x4       x22.5
  NormalLab 300                   3.2e5      1.2e4    2.0e3    1.5e2
  CruelLab 600                    1.9e8      3.2e5    1.2e4    3.8e2
  MercilessLab 1500               4.5e16     4.8e9    1.6e6    1.6e3
  UberLab 2500                    8.7e25     2.1e14   3.3e8    5.0e3
  EternalLab 3000 (TRP)           3.8e30     4.5e16   4.8e9    8.4e3
Phishing 100 Faeden bei cha 600: ~1.9e6 exp/h
```

### 4.4 Infiltration je BN der Restroute (Carmichael, Werte BN2.1 17:17, Gleichgewicht)

| BN | Geld/h | Ruf/h | Bemerkung |
|---|---|---|---|
| 2 | 20,6 Mrd | 392.000 | FWRG 0,5 und Passivruf 0 treffen den Trade nicht |
| 3 | 6,9 Mrd | 392.000 | AugmentationRepCost 3, MoneyCost 3 |
| 11 | 17,1 Mrd | 981.000 | InfiltrationMoney/Rep 2,5 |
| 6, 7, 14 | 5,1 Mrd | 392.000 | InfiltrationMoney 0,75 |
| 13, 15 | 6,9 Mrd | 392.000 | - |
| 8 | 0 | 392.000 | Ruf fuer Daedalus/TRP, SoA-Fueller |

Stat-Level-Mults der Knoten verschieben die Machbarkeit (Summe > 495 fuer Carmichael); die Tabelle gilt fuer V2-Werte wie heute.

## 5. Geprueft, kein Befund

- Vertragstypen 3.0.1 -> 3.0.2: nur Beschreibungen geaendert (`diff reference/v301/src/CodingContract`), `getAnswer`/`solver` gleich.
- `data/cantwort.json` liegt mindestens seit der BN12-Sicherung 03.10. 04:42 (stormtech, Total Ways to Sum II; csolve lief zuletzt 19.09.) - harmlos: csolve faengt den Wurf von `attempt` auf einen fehlenden Vertrag (`csolve.js:86-91`) und raeumt die Datei am Ende (`:141`); in BN2.1 lief ab 04:43 sofort `contracts.js`.
- Erzeugungsdefizit (3,0-3,6 statt 4,5 Vertraege/h): kein Bot-Hebel; Zaehler-Reset `engine.tsx:204-207` kostet im gedrosselten Tab im Mittel ~5 %, der Rest ist Zufall (p ~0,06).
- DarkNet-Augs in der Preistreppe: `buyaugs.js:1130-1140` zaehlt sie ueber die UI-Warteschlange.

## 6. Offene Fragen

1. **Eric:** Soll Infiltration automatisiert werden? Bauauftrag §12 verbietet den Tastenweg mit Begruendung Hospitalisierung; der Modellweg loest diese Begruendung auf, das Spiel erklaert Automatik aber ausdruecklich fuer unerwuenscht (`Infiltration.ts:145-151`). Der Bot umgeht `isTrusted` schon an anderen Stellen (`darkweb.js`, `join.js`, `buyaugs.js`).
2. Eichung NETZ-1: ein lesender Probelauf `ns.infiltration.getInfiltration("Carmichael Security")` gegen `netz-calc.mjs` (Werte bei Nachfrage 1) - kann nur ein Bot-Skript, nicht der Pruefer.
3. V1b BN15: welche Charisma-Augs sind dort im V2-Verlauf erreichbar (Firmenfaktionen, Geld x3)? Ohne Aug-Mult >= 6-8 ist der Labyrinth-Plan tot.
4. BN8: Wirkung der Volatilitaet x1,5-3,5 auf den Manipulationsgewinn (boerse-sim).
