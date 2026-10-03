# Audit "vollstaendig" 03.10.2026 - Gruppe BN2 (BN2.1, 2.2, 2.3)

Pruefer: Subagent BN2 (Fortsetzung nach Abbruch am Nutzungslimit), Stand
2026-10-03 17:40 (Systemzeit). Streng lesend: `src/` unveraendert, Spiel nicht
angefasst, nichts committet. Spielquelle 3.0.2 `reference/bitburner-src/src/`,
Bot master 0cc5a80. Spielstaende `backups/LIVE_197f4d61481686_BN2L1_*`
(05:33 bis 17:17), Vergleich BN4L2/BN4L3/BN9L3.

Rechner: **`tools/audit/bn2-knoten.mjs`** (neu, sechs Abschnitte, Aufruf
`node tools/audit/bn2-knoten.mjs [--abschnitt N]`), wiederverwendet
`bn2-verlauf.mjs`, `bn67-kurven.mjs`, `bn1413-runs.mjs`, `blade-lage.mjs`,
`blade-aktionen.mjs`, `sing-save.mjs`, `aug-data.mjs`.

Die Bereichsberichte `inventar-{gang,blade,fakt,aug,hash,sleeve,stgo}.md`
decken die Einzelhebel bereits ab. Dieser Bericht ergaenzt sie um die
Knotensicht, die Live-Lage um 17:17 und drei neue Punkte; er wiederholt sie
nicht.

## Kurzfazit

- **V1 ist in BN2 tot, V2 der einzige Weg.** w0r1d_d43m0n verlangt 15.000
  (3000 x `WorldDaemonDifficulty` 5, `Server/ServerHelpers.ts:422-424`);
  bei `HackingLevelMultiplier` 0,8 braucht das selbst mit Hacking-Mult 20
  noch 2,7e15 Erfahrung (43 Jahre bei 2e6/s), heute 6e170. Geeicht.
- **Der Engpass in BN2 ist Ruf, nicht Geld** (Passivruf 0, Arbeitsruf x0,5,
  im V2 keine Faktionsarbeit). Live 17:16: 21,1 Mrd $ auf dem Konto, 26
  offene Augs warten auf Ruf, 4 davon bei Slum Snakes, die in BN2 ohne Gang
  **nie** Ruf bekommen. Der Hebel gegen genau diesen Engpass - Gang (GANG-1)
  und Graft (AUG-1) - fehlt. Siehe BN2-3.
- **Live-Fehler BN2-1:** Das Geld, das keinen Ruf findet, floss 17:16-17:17
  in drei Hacknet-Augs (HASH-4). Geeicht: 12,46 Mrd $ Mehrkosten = 48 % aller
  Aug-Ausgaben seit 09:59, und beim jetzt anstehenden Einbau 1 statt 5
  NFG-Stufen.
- **BN2-2 (neu):** Der Wiederaufbau nach einem Einbau laeuft im Gym, auch wenn
  Bonuszeit aussteht. Das Gym laeuft in Echtzeit, die Division verbraucht
  die Bonuszeit dabei ohne Aktion. Mit Bonus ist Bladeburner-Training zweimal
  so schnell wie das Gym und verbrennt nichts. In BN2 24 min je Fall, in
  BN13/14/15 Stunden.
- **Prognose BN2.1** (Analogie, geschaetzt): Rang 2.000 nach 5,6 h effektiver
  Knotenzeit gegen 15,2 h (BN4.3) und 24,9 h (BN9.3). Mit den Restlaufzeiten
  dieser Laeufe ab 2.000 ergeben sich **34-42 h effektiv bis Knotenende**,
  ohne neue Hebel und ohne Abschlag fuer die schwaechere Aug-Versorgung.
- **SF2 bringt der restlichen V2-Route praktisch nichts:** Charisma-Gewicht
  aller 21 Black Ops ist 0, Vertraege +0,5 bis 1,6 %. Wert hat SF2 nur ueber
  die Gang ausserhalb BN2 (Karma -54.000, GANG-3), und dafuer genuegt SF2.1.

## 1. Lage BN2.1 um 17:17 - was tut der Bot?

| Groesse | Wert | Quelle |
|---|---|---|
| Spielzeit im Knoten | 12,58 h, davon **6,73 h offline** (lastSave 10:32:54, Kernstart 17:16:44) | Spielstand, `data/events.json` |
| Bonuszeit Bladeburner | 6,68 h ausstehend -> **effektiv 5,90 h** | `storedCycles` 120.290 |
| Rang / maxRank | 2.185 / 2.194, 0 Black Ops, 731 SP | Spielstand |
| Typhoon | Rang 2.500 noetig, Chance 0,102 (Schwelle 0,90) | `data/blade.json` |
| Aktionsmix 05:06-10:32 | Raid 62 % (9,7 Rang/min), Kammer 24 %, Retirement 13,5 % | `blade-aktionen.mjs` |
| Stadt | Ishima (Sector-12 seit Chaos 60 verlassen) | Spielstand |
| Sleeves | 1x Bounty Hunter, 2x Infiltrate, Schock 97-100 | Spielstand |
| Geld | 21,1 Mrd (17:16) -> 2,96 Mrd (17:17) | moneySourceA |
| Warteschlange | 11 Stuecke, davon 3 Hacknet (NIC, CPU, Cache) | Spielstand |
| Einbau | `gesperrt: false` (Sperre seit 12,0 h totalPlaytime offen, davon 6,73 h offline) - Einbau steht unmittelbar bevor | `data/einbau.json`, `data/einbau-uhr.json` |
| bn4rep-Ziel | **Hacknet Node Kernel**, Wert 1 (nur Zaehlplatz), Preis 46,6 Mrd bei q=11 | `data/bn4rep.json` |
| Faktionsruf | NiteSec 16.405, Sector-12 14.183, Aevum/CyberSec 9.183, Netburners/TDH 6.893, Black Hand 4.719, **Slum Snakes 0**, Bladeburners 6.644 | FactionsSave |
| Offene Augs | 26: Bladeburners 13 (fehlt 55.860), Slum Snakes 4 (fehlt 22.500), Netburners 2, TDH 1, Black Hand 1 | `data/bn4rep.json` `offenJeFaktion` |

Eichung Offline-Luecke: 08:32:54Z bis 15:16:44Z = 6,731 h gegen
`storedCycles` 6,728 h (Abschnitt 4). Die Luecke ist kein Botfehler, das
Spiel war zu. Die Bonuszeit holt den Rang nach dem Laden mit dem Fuenffachen
nach (`Bladeburner.ts:1375-1378`).

## 2. Multiplikatoren und Sonderregeln BN2.1-2.3

`BitNode.tsx` case 2 (`:569-591`) haengt nicht von der Stufe ab. BN2.1, 2.2
und 2.3 sind deshalb identisch, nur die eigene SF2-Stufe steigt (Abschnitt 5).

### 2a. Gesetzte Multiplikatoren (Eichung: 14/14 gleich `src/lib/bitnodes.json`, Standardtabelle 54/54)

| Multiplikator | Wert | Wirkung | Bot beruecksichtigt? (Datei:Zeile) | Urteil |
|---|---|---|---|---|
| HackingLevelMultiplier | 0,8 | Level x0,8 (`skill.ts:7-15`) | Level live (`ns.getHackingLevel`), Ziel aus Server `src/bn4rep.js:197-210` | OPTIMAL |
| ServerGrowthRate | 0,8 | grow schwaecher | `src/bn4net.js:130-152` aus bitnodes.json | OPTIMAL |
| ServerMaxMoney | 0,08 | Beute klein, Rangfolge der Ziele gleich | live `getServerMaxMoney` | OPTIMAL |
| ServerStartingMoney | 0,4 | Vorbereitung laenger | live | OPTIMAL |
| CloudServerSoftcap | 1,3 | grosse Rechner teurer | Preise live `src/shop.js` -> `data/preise.json` | OPTIMAL |
| CrimeMoney | 3 | Verbrechensgeld x3 (`Work/Formulas.ts:73`) | im V2 kein Verbrechen; Geld bindet in BN2 nicht | OPTIMAL (nicht nutzen) |
| FactionPassiveRepGain | **0** | kein Passivruf (`FactionHelpers.tsx:132-170`) | nicht beruecksichtigt: Beitrittspolitik (FAKT-1), kein ruffreier Kanal | SUBOPTIMAL -> BN2-3 |
| FactionWorkRepGain | 0,5 | Arbeits-/Spendenruf halb | `src/bn4rep.js:185` `FACTION_REP_GAIN {2: 0.5}`, Spende live | OPTIMAL |
| CorporationSoftcap / Divisions | 0,9 / 0,9 | - | kein SF3 | NICHT ANWENDBAR |
| InfiltrationMoney | 3 | Infiltrationsgeld x3 (`Infiltration/formulas/victory.ts:8-26`) | Infiltration ausgeschlossen (`nodes/AUFTRAG-BAU-2026-09.md:346`) | NICHT GENUTZT (entschieden) |
| StaneksGiftPowerMultiplier / ExtraSize | 2 / -6 | - | kein SF13 | NICHT ANWENDBAR |
| WorldDaemonDifficulty | 5 | w0r1d_d43m0n 15.000 | `src/bn4rep.js:195` `{2: 5}`, `src/ausgang.js:259-270` live | OPTIMAL (V1 unerreichbar) |

Handtabellen gegen alle 15 Knoten (Abschnitt 1): `FACTION_REP_GAIN` 15/15 und
`WD_DIFFICULTY` 15/15 gleich `BitNode.tsx`.

### 2b. Sonderregeln BN2

| Regel | Quelle | Bot | Urteil |
|---|---|---|---|
| Gang ohne Karmaschwelle | `PersonObjects/Player/PlayerObjectGangMethods.ts:16-17` | kein `ns.gang` in `src/` | NICHT GENUTZT -> GANG-1, BN2-3 |
| Gang-Faktion fuehrt The Red Pill | `Faction/FactionHelpers.tsx:180-183` | TRP ist Ausgangsschluessel in jedem Knoten (`src/bn4rep.js:1207-1212,1272,1370`) | NICHT ANWENDBAR (V1 tot); Falle bei Gang -> GANG-2 |
| Kein Offline-Faktionsruf, Offline-Vertraege schon | `engine.tsx:284` (`bitNodeN !== 2`), `engine.tsx:258` | `contracts.js` loest nach dem Laden (Ruf +41.000 zwischen 09:59 und 17:16) | OPTIMAL |

### 2c. Standardwerte, die in BN2 wirken

| Multiplikator | BN2 | Bot | Urteil |
|---|---|---|---|
| BladeburnerRank / SkillCost | 1 / 1 | `src/blade.js:802-804` live | OPTIMAL |
| Kampf-LevelMultiplier | 1 | `src/kampfaugs.js:241-246` live | OPTIMAL |
| HacknetNodeMoney | 1 | `src/hacknet.js:150-154` nur BN9 | NICHT GENUTZT (HASH-2, klein) |
| AugmentationMoneyCost / RepCost | 1 / 1 | Preise live | OPTIMAL |
| GangSoftcap / GangUniqueAugs | 1 / 1 (volles Angebot, 98 Augs) | keine Gang | NICHT GENUTZT (GANG-1) |
| DaedalusAugsRequirement | 30 | `zaehlplatzWert` gibt im V2 jedem Stueck +1 (`src/bn4rep.js:2014,2076`) | SUBOPTIMAL (Nebenpunkt zu BN2-1, nur Zielanzeige) |
| CodingContractMoney / Vertraege als Rufquelle | 1 | Hash -> Vertrag nie (`src/hashes.js`) | NICHT GENUTZT (HASH-7, FAKT-3) |
| GoPower | 1 | kein `ns.go` | NICHT GENUTZT (STGO-1/4; Daedalus-Gegner hebt `faction_rep` und damit Bladeburners-Ruf, in BN2 wertvoller als anderswo) |

### 2d. SF2 nach dem Abschluss (fuer die Restroute)

| Wirkung | Quelle | Wert fuer V2 | Urteil |
|---|---|---|---|
| crime_money, crime_success x1,24/1,36/1,42 | `SourceFile/applySourceFile.ts:50-61` | kein Verbrechen im V2 | NICHT ANWENDBAR |
| charisma x1,24/1,36/1,42 | dito | Black Ops 0,00 %, Retirement/Bounty Hunter +0,5/0,8/0,9 %, Tracking +0,9/1,4/1,6 % Kompetenz (Abschnitt 5) | NICHT ANWENDBAR |
| Gang ausserhalb BN2 bei Karma <= -54.000 | `PlayerObjectGangMethods.ts:19-27` | nur ueber GANG-3 (BN15 -20 bis -40 h, BN11 0 bis -10 h; BN13/BN8 wertlos) | NICHT GENUTZT (GANG-3) |

Weitere SF2-Tore gibt es nicht (grep `activeSourceFileLvl(2)` /
`canAccessBitNodeFeature(2)`: nur Gang und Achievements).

### 2e. Phasen im Knoten

| Phase | Was der Bot in BN2 tut | Beleg | Urteil |
|---|---|---|---|
| Sprung in BN2.x | `planeRoute` (2,1) -> (2,2) -> (2,3) -> (3,1); Tuer Black Ops (`Singularity.ts:1154-1161`) | `src/route.json`, `src/ausgang.js:250-278`, in BN4/9/10 erprobt | OPTIMAL |
| Kaltstart | TOR +20 s, 25 Rechner nach 16 min, home 1 TB nach 2 h, Beitritt < 0,85 h | `inventar-infra.md`; Rang 68 bei 0,85 h | OPTIMAL |
| Aufbau | Raid-lastig; Stadt, Skills, Sleeves suboptimal | BLADE-1/2/3, SLEEVE-2/3 | SUBOPTIMAL |
| Einbauzyklus | Sperre 12 h totalPlaytime; Kaeufe ohne Rufquelle; Junk-Augs | `src/lib/endspurt.js:322-332`; BN2-1, BN2-2, AUG-5 | SUBOPTIMAL |
| Endspiel | Black-Op-Schwelle 0,90 / 0,35 | ENTSCHIEDEN | OPTIMAL |
| Telemetrie | Check-in-ETA linear (keine BN2-Kurve) | `tools/checkin.js:621-631` | SUBOPTIMAL -> BN2-4 |

Inventar: 35 Zeilen (14 + 3 + 8 + 3 + 7). OPTIMAL 15, SUBOPTIMAL 6,
NICHT GENUTZT 7, NICHT ANWENDBAR 7, TOT 0.

## 3. Schnellster Weg zum Knotenende

**V1:** Abschnitt 2 des Rechners. Bedarf fuer 15.000 bei Hacking-Mult m
(vor x0,8): m=1,51 (heute) 6e170, m=10 1,5e28, m=20 2,7e15, m=30 1,6e11
Erfahrung. BN5.2 kam mit Mult 9,04 und 1,4e8 Erfahrung auf 4.500. Dazu kommt:
Ruf fuer m=20 gibt es in BN2 nicht (Passivruf 0). **Unerreichbar.**

**V2** ist der einzige Ausgang. Die Rangkurven, effektive Zeit = Spielzeit
minus ausstehende Bonuszeit (Abschnitt 6):

| Lauf | 500 | 1.000 | 2.000 | 2.500 | 5.000 | 10.000 | 25.000 | 100.000 | 400.000 | Dauer |
|---|---|---|---|---|---|---|---|---|---|---|
| BN2.1 | 2,4 | 3,5 | **5,6** | - | - | - | - | - | - | laeuft |
| BN4.3 | 9,8 | 11,9 | 15,2 | 16,0 | 18,4 | 20,8 | 29,6 | 35,9 | - | 51,4 h |
| BN9.3 | 18,5 | 22,7 | 24,9 | 25,6 | 28,4 | 34,1 | 41,6 | 46,7 | 51,9 | 53,7 h |

BN4.2 ist zwischen 25,7 h und 41,7 h ohne lokalen Stuetzpunkt und darum
nicht verwertbar. Rest ab Rang 2.000: BN4.3 36,2 h, BN9.3 28,8 h. Fuer BN2.1
folgt daraus ein **Knotenende bei 34-42 h effektiver Zeit (GESCHAETZT)**. Der
Vorsprung kommt von den SF (SF1.3, SF5.3, SF12.3) und vom neueren Bot.
Dagegen steht die schwaechere Aug-Versorgung: BN4.3 hatte bei 14,5 h 16 Augs
eingebaut, BN2.1 hat bei 5,9 h effektiv 1, und nach jedem Einbau faellt jeder
Nicht-BB-Ruf ohne Passivrate auf 0. Die Zahl ist darum eher die Untergrenze.

**Was dem Bot fuer den schnellsten V2-Weg in BN2 fehlt** (Ertrag aus den
Bereichsberichten, je Lauf, in BN2-Gewichtung):

| Rang | Hebel | Ertrag | Basis | Bericht |
|---|---|---|---|---|
| 1 | Gang (Kampfgang Slum Snakes) - einziger Rufkanal ohne Spielerzeit, volles Angebot, TRP-Falle vorher schliessen | 10-25 h | GESCHAETZT | GANG-1, GANG-2 |
| 2 | Grafting - ruffrei, ab dem 2. Stueck je Zyklus billiger als Kauf | Rang/h x2,3-7 nach ~12 h Grafting | GERECHNET_UNGEEICHT | AUG-1/2/3 |
| 3 | Stadtwahl nach wahrer pop | +450 Rang/h im Aufbau | GERECHNET_GEEICHT | BLADE-1 |
| 4 | Skillverteilung (Datamancer/Tracer) | Typhoon 2,9 h frueher | GERECHNET_GEEICHT | BLADE-2 |
| 5 | IPvGO Tetrads (+ Daedalus fuer `faction_rep`) | 0,6-3,1 h | GERECHNET_UNGEEICHT | STGO-1/4 |
| 6 | Rufpolitik: Beitritte, Hash -> Vertraege | 1,1-1,7 h | GERECHNET_UNGEEICHT | FAKT-1/3, HASH-7 |
| 7 | Sleeves Infiltrate ohne Kampftor, Diplomacy | ~1 h | GERECHNET_GEEICHT (Teile) | BLADE-3, SLEEVE-2/3 |
| 8 | Hacknet-Augs aus dem V2-Filter | 4 NFG-Stufen je Zyklus, ~0,4 h | GERECHNET_GEEICHT (Geld) | BN2-1 / HASH-4 |
| 9 | Wiederaufbau mit Bonus per BB-Training | 24 min je Fall | GERECHNET_UNGEEICHT | BN2-2 |

Hebel 1 und 2 zielen beide auf den Ruf-Engpass und ueberlappen sich. Mit
Gang kauft man ueber die Gang-Faktion billiger (1x Grundpreis x 1,9^q). Graft
kostet 3x, wird aber ab q >= 2 billiger und braucht keinen Ruf, dafuer
Spielerzeit ohne Simulacrum. Der Rest ist Feinarbeit am Bladeburner-Motor.

## 4. Befunde

### BN2-1 (FEHLER, P1, live) Hacknet-Augs im Kampfknoten - jetzt gekauft, Schaden geeicht

- **Bot:** `src/bn4rep.js:655-660` (`mitHashes` = SF9 vorhanden),
  `:672` (V2-Filter), `src/lib/hackaugs.js:346-350` (Hacknet-Augs gelten
  mit Hashes als nuetzlich). Verdiente Stuecke werden sofort gekauft (AUG-4).
- **Spiel:** Preis `base x 1,9^q` (`Augmentation/AugmentationHelpers.ts:29-37`,
  `:155-158`), NFG `750k x 1,14^L x 1,9^q` (`:133-138`,
  `Augmentation.ts:240-247`). Nach dem Einbau gibt es ausserhalb BN9 keine
  Hacknet-Server, auf die die Stuecke wirken koennten (HASH-4).
- **Gemessen (Abschnitt 3, Soll = `moneySourceA.augmentations`):**
  09:59 -> 17:16: Soll 7,7508 Mrd, Ist 7,7508 Mrd (ORION q=4 7,168,
  Augmented Targeting I q=5 0,371, **NIC q=6 0,212**).
  17:16 -> 17:17: Soll 18,1621 Mrd, Ist 18,1621 Mrd (Neurotrainer II q=7
  4,022, Augmented Targeting II q=8 7,218, **CPU q=9 3,550, Cache q=10
  3,372**). Dieselben fuenf echten Stuecke haetten ohne die Hacknet-Stuecke
  13,46 statt 25,91 Mrd gekostet: **12,46 Mrd Mehrkosten (48 %)**.
- **Folge beim jetzt anstehenden Einbau:** Die NFG-Schleife
  (`src/bn4rep.js:1655-1691`) kauft mit 2,96 Mrd bei q=11 **1 Stufe**. Ohne
  die Hacknet-Stuecke und mit den 12,46 Mrd zurueck waeren es bei q=8
  **5 Stufen**. 4 Stufen sind x1,04 auf alle Kampf- und Exp-Mults, im
  Kompetenzmodell (Elastizitaet ~1, FAKT/`fakt-rang.mjs`) rund +3,5 % Rang/h
  fuer den naechsten Zyklus von mindestens 12 h, also ~0,4 h Knotenzeit
  (der Stundenwert ist geschaetzt).
- **Nebenpunkt Zaehlplatz:** Im V2 bekommt jedes Stueck +1 fuer die
  Daedalus-Zaehlung (`src/bn4rep.js:2014,2076`, `src/lib/einbau.js:94-96`),
  die im V2 nichts bedeutet. Deshalb steht der Hacknet Kernel (Wert genau 1,
  Preis 46,6 Mrd) um 17:17 als `ziel` an der Spitze. Fuer Kauf und Einbau
  zaehlt das nicht: der Kauf haengt am Filter, der Einbaugrund rechnet ohne
  Zaehlplatz (`:830-847`). Es ist also nur eine irrefuehrende Anzeige.
- **Fix:** wie HASH-4: `mitHashes` nur in BN9 oder nur, wenn nach dem Einbau
  Hacknet-Server existieren. Dazu den Zaehlplatz im V2 auf 0 setzen. Aufwand
  S. Trifft BN2.2/2.3 und jeden V2-Knoten der Restroute (SF9.3 ist ueberall
  da).
- **known_before:** `inventar-hash.md` HASH-4 (derselbe Tag, Mechanik ohne
  Live-Kauf). Neu sind der tatsaechliche Kauf, der geeichte Schaden und die
  NFG-Folge.

### BN2-2 (SUBOPTIMAL, P2) Wiederaufbau mit ausstehender Bonuszeit: das Gym verbrennt sie, Bladeburner-Training waere doppelt so schnell

- **Bot:** Nach einem Einbau weicht `src/blade.js:4244-4260` bei Tiefstand
  < 100 an `bbtrain.js` (Powerhouse Gym). Die Begruendung
  `src/bbtrain.js:115-121` ("BB-Training ... ohne den Ortsmultiplikator
  Faktor 10") gilt nur ohne Bonus. Die Einbausperre
  `src/lib/endspurt.js:322-332` zaehlt in totalPlaytime, und eine
  Offline-Nacht verbraucht sie (`src/bn4rep.js:985-993`, bewusst
  hingenommen). Damit faellt der Einbau systematisch auf den Moment nach dem
  Laden, in dem die Bonuszeit am groessten ist. BN2.1 heute: Sperre offen
  nach 12,2 h, davon 6,73 h offline, Bonus 6,68 h.
- **Spiel:** `Bladeburner.process` baut `storedCycles` mit 5 s je Echtsekunde
  ab, auch ohne Aktion (`Bladeburner/Bladeburner.ts:1353-1378`; Gym-Arbeit
  setzt die Aktion zurueck, `:1354-1366`). Das Gym laeuft in Echtzeit
  (`Work/Formulas.ts:108-121`, Powerhouse `expMult` 10,
  `Locations/data/LocationsMetadata.ts:324-326`, ein Wert zur Zeit).
  BB-Training gibt 30 x `X_exp` auf alle vier Werte je 30 s
  (`Bladeburner.ts:1092-1103`) und laeuft mit Bonus fuenfmal so schnell.
- **Rechnung** (Abschnitt 4b, Mults nach dem anstehenden Einbau = heute x
  Warteschlange): Bedarf fuer 100: str/def/agi je 3.591, dex 1.621
  Erfahrung, exp-Mult 1,814.
  - Gym: 11,4 min echt (passt zu AUG-5: 12 min). Die BB-Zeit ohne Aktion
    betraegt 56,9 min, davon 45,5 min verbrannter Bonus.
  - BB-Training ohne Bonus: 33 min, das Gym ist dann 2,9x schneller.
  - BB-Training mit Bonus: 6,6 min echt bzw. 33 min BB-Zeit, kein Brand.
  - **Ersparnis 24 min BB-Zeit je Einbau mit Bonus in BN2.** Bei Gym-Phasen
    von Stunden (BN13/BN15 LevelMult 0,7, BN14 0,5, frueh im Lauf mit kleinen
    Mults) verbrennt das Gym die ganze Bonuszeit.
- **Wie oft:** 7 von 32 V2-Einbauten in den Spielstaenden fielen in
  Bonuszeit von 5,2-16,5 h (BN10L3 15,0 und 5,2, BN4L2 9,1, BN4L3 13,1, BN9L1
  16,5 und 6,2, BN2L1 6,7). Seit der Rechner nur noch ~5,5 h am Tag laeuft
  (`nodes/ERLEDIGT.md:5833-5852`), wird das der Normalfall.
- **Gegenweg geprueft:** "Einbau verschieben, bis der Bonus abgebaut ist"
  kostet (g-1) x Bonus Rangzeit. Gleichstand ist bei Gym = (g-1)/4 x Bonus,
  bei g=1,2 also bei 0,33 h Gym. In BN2 ist Sofort-Einbau damit richtig. Der
  richtige Fix ist das Training waehrend des Bonus, nicht der Aufschub.
- **Fix-Skizze:** Im Rebuild-Zweig `getBonusTime()` (0 GB) lesen. Ist der
  Bonus groesser als ~5 min, faehrt blade.js "Training", statt an bbtrain zu
  weichen. Erst ohne Bonus geht es ins Gym. Aufwand S.
  ENTSCHIEDEN "Gym und Bladeburner parallel unmoeglich" bleibt unberuehrt, es
  ist eine Entweder-oder-Wahl.
- **known_before:** `src/bn4rep.js:985-993` (Skeptiker Runde 3, Befund 3:
  Sperre durch Offline geschwaecht), `src/bbtrain.js:115-121`. Neu sind der
  Bonusbrand und die Umkehr der Rangfolge Gym gegen Training mit Bonus.
- **needs_calc:** ja, siehe calc_spec (Gym-Dauer je Knoten, Eichung am
  anstehenden BN2.1-Einbau).

### BN2-3 (NICHT_GENUTZT, P1, Knotensynthese) BN2 ist rufgebunden - der Bot hat keinen ruffreien Aug-Kanal

- **Bot:** kein `ns.gang` in `src/`; Grafting abgeschaltet
  (`data/nicht-schieben.txt` Zuender `graftplan.json`). Im V2 keine
  Faktionsarbeit (`src/bn4rep.js:496,2475`).
- **Spiel:** `BitNode.tsx:581-582` (Passiv 0, Arbeit 0,5);
  `Faction/FactionHelpers.tsx:132-170` (Passivruf), `:172-200`
  (Gang-Faktion mit vollem Angebot); `PlayerObjectGangMethods.ts:16-17`;
  `Gang/Gang.ts:144-155` (Ruf aus Respekt, ohne `FactionWorkRepGain`).
- **Neue Belege (Live 17:16/17:17):** 21,1 Mrd $ lagen ohne Verwendung, 26
  verdiente Augs warteten auf Ruf. Slum Snakes haelt 4 Kampf-Augs (fehlt
  22.500 Ruf) und bekommt in BN2 nie Ruf: keine Hacking-Arbeit, also keine
  Vertraege, und keinen Passivruf. Ohne Gang sind die 4 fuer alle drei
  BN2-Laeufe unerreichbar. Das freie Geld ging stattdessen in Junk (BN2-1).
  Nach dem Einbau faellt jeder Nicht-BB-Ruf auf 0, und es waechst nur ein
  Zufluss von ~4.900 Ruf/h aus Vertraegen nach (FAKT-1).
- **Bewertung:** Fuer BN2 ist das der Kernbefund. Die Gang ist Hebel 1, das
  Graften Hebel 2. Beide stehen als Erics Entscheidung aus
  (`nodes/AUFTRAG-BAU-2026-09.md:155,346` "Gang nicht bauen", Graft-Zuender).
  Voraussetzung fuer die Gang ist GANG-2 (TRP-Falle).
- **Ertrag:** GESCHAETZT 10-25 h je BN2-Lauf (GANG-1), dazu Grafting.
  Basis ohne Hebel 34-42 h effektiv (Abschnitt 3).
- **known_before:** `inventar-gang.md` GANG-1/2, `inventar-aug.md` AUG-1,
  `inventar-fakt.md` FAKT-1. Neu sind die Live-Belege und die Knotenprognose.

### BN2-4 (SUBOPTIMAL, P3) Check-in-ETA fuer BN2 linear: 1.484 h "AUF KURS"

- **Werkzeug:** `tools/checkin.js:621-631`. Ohne `doku/rangkurve-bn2.json`
  (es gibt nur bn6 und bn10) wird linear fortgeschrieben, `data/checkin.json`
  10:12: `etaSpielstunden` 1.484, `etaQuelle` "linear". Der Text warnt zwar,
  das Urteil lautet trotzdem "AUF KURS".
- **Spiel:** Der Rang je Aktion haengt nicht am Rang
  (`Bladeburner/Formulas.ts:9-28`). Die Rate waechst ueber Stufen und
  Operationen um Groessenordnungen (ETA-Lehre).
- **Fix:** Fuer Knoten ohne eigene Kurve die Kurve des naechsten
  vergleichbaren Laufs nehmen (gleicher `BladeburnerRank`, Kampf-LevelMult):
  BN4.3 und BN9.3 aus `backups/` ueber `tools/rangkurve-bauen.js`. Ergebnis
  fuer BN2.1: 34-42 h. Gilt ebenso fuer BN3, BN11, BN7, BN14, BN13 und BN15.
  Aufwand S. Betrifft nur die Telemetrie, nicht das Verhalten.

## 5. Geprueft, kein Befund

- `src/lib/bitnodes.json` BN2 und Standardtabelle: 0 Abweichungen gegen
  3.0.2. `FACTION_REP_GAIN` und `WD_DIFFICULTY` stimmen fuer alle 15 Knoten.
- Hacking-Formel gegen Spielstand: Soll 372 / 408, Ist 372 / 408.
- Ausgang: `src/ausgang.js:250-278` prueft beide Tueren wie das Spiel
  (`Singularity.ts:1148-1161`); Route BN2.1 -> 2.2 -> 2.3 -> BN3.1 korrekt
  (`src/route.json`).
- Daedalus in BN2 V2: Einladung braucht Hacking 2.500 oder Kampf 1.500
  (V2-Laeufe endeten bei 216-730), TRP ueber Daedalus also praktisch nie.
  Der Weg ueber die Gang ist GANG-2.
- Einbau jetzt (12,6 h, Bonus 6,7 h): Sofort-Einbau schlaegt den Aufschub in
  BN2 (BN2-2, Gegenweg). Gewinnschwelle ~14 h (AUG-5) - bei 34-42 h
  Knotendauer bleibt genug Rest.
- Corporation (kein SF3), Stanek (kein SF13): in BN2.1-2.3 nicht anwendbar.
  BN3 bringt SF3 erst danach.
- Infiltration (InfiltrationMoney 3, Ruf ohne `FactionWorkRepGain`): in BN2
  relativ am wertvollsten, bleibt aber ausgeschlossen (ENTSCHIEDEN im
  Auftrag). Nur auf Erics Ansage neu aufmachen.

## 6. Rechnungen (Ausgabe `node tools/audit/bn2-knoten.mjs`, gekuerzt)

    === 1. ===  14 gesetzte Felder, Abweichungen 0; Standardtabelle 54 Felder, Abweichungen 0
      FACTION_REP_GAIN 15 Knoten -> Abweichungen 0;  WD_DIFFICULTY 15 Knoten -> Abweichungen 0
    === 2. ===  OK 09:59 Soll 372 / Ist 372;  OK 17:17 Soll 408 / Ist 408
      Hacking 15.000: m 1,514 -> 6,2e170;  m 10 -> 1,45e28;  m 20 -> 2,74e15 (43 Jahre bei 2e6/s)
    === 3. ===  09:59->17:16 Soll 7,7508 / Ist 7,7508 Mrd OK;  17:16->17:17 Soll 18,1621 / Ist 18,1621 Mrd OK
      Mehrkosten Hacknet 12,46 Mrd (48 %);  NFG bei 2,96 Mrd: q=11 1 Stufe | q=8 + 12,46 Mrd 5 Stufen
    === 4. ===  Offline 6,731 h gegen storedCycles 6,728 h OK;  Sperre 12,20 h (6,73 h offline, 5,47 h BB)
    === 4b. === Gym 11,4 min echt, BB-Zeit ohne Aktion 56,9 min (45,5 min Bonus verbrannt);
      BB-Training mit Bonus 6,6 min echt / 33 min BB-Zeit -> Ersparnis 24 min
    === 5. ===  SF2.1/2.2/2.3: Retirement +0,52/0,77/0,90 %, Tracking +0,91/1,37/1,59 %, Black Ops 0 %
    === 6. ===  Rang 2.000: BN2.1 5,6 h | BN4.3 15,2 h | BN9.3 24,9 h (effektiv)

Eichstand: Abschnitte 1-4 sind gegen Spielstand- oder Quellwerte geeicht
(exakt). 4b nutzt die geeichte Skill-Formel und die Preis-/Mult-Daten aus
`aug-data.mjs` (in `aug-mults.mjs` gegen 6 Spielstaende exakt). Die
Gym-Dauer selbst ist noch nicht gegen einen echten Wiederaufbau geeicht;
das geht am anstehenden Einbau ueber `data/einbau-uhr.json`. Abschnitt 6
misst, die Prognose daraus ist geschaetzt.

## 7. Offene Fragen an Eric

1. Gang in BN2.1 noch gruenden (Ruf 1,25 Mio nach 8,6-11,2 h ab Gruendung,
   bei ~30 h Restlauf lohnt es noch) oder erst ab BN2.2? Das Bauverbot in
   `AUFTRAG-BAU-2026-09.md:155,346` steht dagegen. Vorher GANG-2 schliessen.
2. Grafting-Zuender (`graftplan.json`) fuer BN2: Hier wirkt er staerker als
   in jedem Knoten mit Passivruf, weil er den Ruf-Engpass umgeht.
3. Fuer den Praemissen-Skeptiker: SF2.2 und SF2.3 bringen der restlichen
   V2-Route ~0 (Abschnitt 2d). BN2.2/2.3 hinter BN7 gelegt (SF7.3:
   `bladeburner_success_chance` x1,14, `applySourceFile.ts` case 7) waeren je
   grob 10 % schneller (geschaetzt, Elastizitaet ~1). Die Reihenfolge ist
   ENTSCHIEDEN, hier steht nur die Zahl.
