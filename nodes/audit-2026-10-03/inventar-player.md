# Inventar PLAYER - Spielermechanik (Audit "vollstaendig" 03.10.2026)

Bereich: Kriminalitaet, Karma, Intelligenz, Gym/Uni, Reisen, Krankenhaus,
Exploits, Export-Bonus, Achievements, Casino, Meilensteine.
Stand: Spielstaende BN2.1 03.10. 17:16/17:17 (12,6 h im Knoten), Spielquelle
3.0.2 unter `reference/bitburner-src/src/`. Bericht 17:40 (Systemzeit).
Fortsetzung eines abgebrochenen Laufs: `tools/audit/player-save.mjs` lag schon
vor (Mitgliedschaftsfeld repariert), alles andere ist neu.

Nicht wiederholt (dort steht es): Krankenhauskosten-Obergrenze im Op-Riegel
(BLADE-4), Simulacrum-Parallelarbeit (BLADE-6), Kills fuer Speakers/Dark Army
(FAKT-4), Favor im V2 (FAKT-6), Gang-Karma ausserhalb BN2 (GANG-3),
Gym-Hash fuer Sleeves (HASH-6), Sleeve-Verbrechen und BN8-Shoplift (SLEEVE),
Corp-Seed in BN3 (CORP-1), Programme/Darkweb (INFRA), Infiltration (NETZ).

## 0. Rechner und Eichung

| Rechner | Inhalt | Eichung (Soll / Ist) |
|---|---|---|
| `tools/audit/player-save.mjs` | Dekoder Spielerkennwerte; Mitgliedschaft jetzt aus `Player.factions` (FactionsSave hat kein isMember) | - |
| `tools/audit/player-crime.mjs` | `Crime.successRate` (Crime.ts:120-136), `calculateCrimeWorkStats` (Work/Formulas.ts:58-79), Fokus/Fehlschlag (CrimeWork.ts:56-86), alle 12 Verbrechen, bn4life-Leiter gegen Optimum, Restroute | `moneySourceA.crime` BN2.1 = **2.031.923,9247235279 $**; Formel je fokussiertem Shoplift 59.762,46837422144 $ -> Quotient **33,99999999999998** (Rest 1e-9 $, relativ 5e-16). Die Geldformel inkl. `mults.crime_money` 1,32805 ist damit exakt bestaetigt. Einschraenkung: die Ganzzahligkeit allein unterscheidet CrimeMoney 3 nicht von 1 (102 statt 34 Erfolge); der Faktor 3 steht in `BitNode.tsx:579`. -> GERECHNET_GEEICHT |
| `tools/audit/player-int.mjs` | `calculateSkill` (skill.ts:7-15), `intBonus` (intelligence.ts:1-3), Int-Exp je Lauf, Grenzwert einer Stufe | `calculateSkill(exp.intelligence)` == `skills.intelligence` in **199 von 199** Staenden (BN10L2 bis BN2L1). -> GEEICHT |
| `tools/audit/player-export.mjs` | Export-Bonus-Abholungen aus allen Staenden, Wert von +1 Favor | Stand 17:17: genau eine Abholung seit Knotenbeginn (02:42Z -> 15:16:43Z), **alle 9 Mitgliedsfaktionen Favor 1** - bestaetigt "+1 je Mitgliedsfaktion" (ExportBonus.tsx:16-18). -> GEEICHT |
| `tools/audit/player-casino.mjs` | WHRNG (RNG.ts:38-63) und Roulette (Roulette.tsx:141-176) nachgebaut, Spins bis zur 10-Mrd-Sperre; Hacking-Einkommen und Einbauzyklen je Lauf aus den Staenden | Geldanker gemessen: BN2.1 `moneySourceA.hacking` 52,81 Mrd / 12,58 h = **4,20 Mrd/h**. Roulette selbst UNGEEICHT (kein Casinospiel im Spielstand). |
| `tools/audit/player-casino-wert.mjs` | +Budget je Zyklus im Augmodell des FAKT-Pruefers (`fakt-v2.mjs simulateBudget`) | UNGEEICHT (Modell FAKT, Elastizitaet Rang/Kampfmass ~1 aus `fakt-rang.mjs`) |

## 1. Feature-Inventar aus dem Quellcode

| # | Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag/Hebel |
|---|---|---|---|---|
| 1 | Spieler-Verbrechen `commitCrime` | `NetscriptFunctions/Singularity.ts:1004-1028`, `Crime/Crime.ts:106-118`, `Work/CrimeWork.ts:35-86` | alle (SF4) | Geld x `CrimeMoney` (BN2/BN11 3, BN3 0,25, BN6/7/14 0,75, BN13 0,4, BN8 0), Kampf-Exp, Karma, Kills |
| 2 | Erfolgschance | `Crime/Crime.ts:120-136` | alle; BN14 `CrimeSuccessRate` 0,4 (`BitNode.tsx:1052`) | (Summe w x Skill + 0,025 x Int)/975/diff x crime_success x intBonus |
| 3 | Ertrag je Erfolg, Fokus, Fehlschlag | `Work/Formulas.ts:58-79`, `Work/CrimeWork.ts:64-84`, `PlayerObjectGeneralMethods.ts:622-628` | alle | Fehlschlag Exp/4, Karma/4, kein Geld; ohne Fokus x0,8 auf Geld, Exp UND Karma |
| 4 | Verbrechensdaten (12 Arten) | `Crime/Crimes.ts:5-261` | alle | Heist 120 Mio/600 s diff 18; Homicide 45k/3 s, 1 Kill, 3 Karma; Int-Exp bei Rob/Larceny/Bond/GTA/Kidnap/Assassination/Heist |
| 5 | `getCrimeChance`, `getCrimeStats`, `formulas.work.crimeGains/crimeSuccessChance` | `Singularity.ts:1030-1060` | alle | nur Auskunft |
| 6 | Karma: Quellen | `CrimeWork.ts:84`, `Sleeve/Work/SleeveCrimeWork.ts:46`, `Bladeburner.ts:964-969, 1043-1049` | alle | V2 liefert Karma nebenbei (BN2.1 -182 nach 12,6 h) |
| 7 | Karma: Verbrauch | `PlayerObjectGangMethods.ts:12-30` (Gang, BN2 ohne Schwelle), `Faction/FactionInfo.tsx` (Slum Snakes -9, Tetrads -18, Silhouette -22, Speakers/Dark Army -45, Syndicate -90) | alle | Faktionszugang, Gang |
| 8 | Karma-Reset | `PlayerObjectGeneralMethods.ts:143-145` (nur Knotenwechsel) | alle | ueberlebt Einbauten |
| 9 | Kills | `CrimeWork.ts:72`; Reset bei jedem Einbau `PlayerObjectGeneralMethods.ts:83` | alle | Speakers 30, Dark Army 5 |
| 10 | Int-Exp-Quellen | `Singularity.ts:182` (Augkauf 15), `:207` (Einbau 15), `:766` (Beitritt 7,5), `:587/:621` (home 3), `:412/:452/:232/:390` (winzig), `Prestige.ts:353-356` (BN-Abschluss 300), `CrimeWork.ts:73`, `Bladeburner.ts:705-733, 1137`, `CreateProgramWork.ts:79-81` (0,1/s), `GraftingWork.tsx:86-89` (0,005/s), `ClassWork` Uni 0,01/Zyklus, `NetscriptHelpers.tsx:658` (manualHack 0,005) | nur mit SF5 oder in BN5 (`Person.ts:176-190`) | siehe Abschnitt 6.2 |
| 11 | Int-Wirkung | `Hacking.ts:22,77` (w 1), `NetworkShare/Share.ts:24` (w 2), `reputation.ts:16-51` (w 1 + Summand), `Bladeburner/Actions/Action.ts:175` (w 0,75), `Crime.ts:128-133`, `GraftingHelpers.ts:24`, `CreateProgramWork.ts:62` (w 3), `Programs.ts:27`, `Infiltration/formulas/game.ts:42`, `SleeveSynchroWork.ts:16` (Spieler-Int w 0,5), `CompanyPosition.ts:170` | alle | Int 153: x1,093 Hacking/Ruf, x1,070 Bladeburner, x1,187 share |
| 12 | Int-Persistenz | `Person.ts:149-174`, `persistentIntelligenceData` | alle | ueberlebt Einbau und Knotenwechsel |
| 13 | Gym `gymWorkout` | `Singularity.ts:295-372`, `Work/ClassWork.tsx:53-73,104-109`, `Work/Formulas.ts:100-121` | alle | 1 Exp/s x Ortsfaktor x Hash-Mult x mults.x_exp; kein Fokusmalus (applyWorkStats ohne focusPenalty) |
| 14 | Gym-Orte | `Locations/data/LocationsMetadata.ts:38-40,105-107,294-296,324-326,376-378` | alle | Powerhouse (S12) exp 10 / Kosten 20 x 120 $/s; Snap 5; Millenium 4; Crush 2; Iron 1; Backdoor -10 % Kosten (`Formulas.ts:100-105`) |
| 15 | Universitaet `universityCourse` | `Singularity.ts:235-293`, `ClassWork.tsx:23-52` | alle | Algorithms 4 hackExp, Leadership 4 chaExp, je 0,01 Int/Zyklus; ZB/Volhaven exp 4 |
| 16 | `ClassGymExpGain` | nur `BitNodeMultipliers.ts:28` definiert, nirgends angewandt | - | wirkungslos (BN4/12/13 drosseln das Gym NICHT) |
| 17 | Reisen `travelToCity` | `Singularity.ts:374-395`, `Constants.ts:28` | alle | 200.000 $, Int 3e-5 |
| 18 | `goToLocation` | `Singularity.ts:213-234` | alle | Ortsseite (Casino, Arcade, Nudelbar) |
| 19 | Schaden/Krankenhaus | `PlayerObjectGeneralMethods.ts:266-290`, `Hospital/Hospital.ts:4-18`, `Singularity.ts:554-557` | alle | Kosten min(10 % Geld, (max - current) x 1e5), current nach Schaden auch negativ; Geld < 0 -> gratis |
| 20 | HP und Bladeburner | `Bladeburner/Actions/Action.ts:169-200` (kein HP-Term), Kammer `Bladeburner.ts:1197-1202` (+2 HP, +1 % Ausdauer je 60 s) | V2 | HP hat KEINE Wirkung auf den Erfolg |
| 21 | Exploits (SF-1) | `Exploits/Exploit.ts:14-30` (11 Stueck), `applyExploits.ts:4-40` (x1,001^n auf ~27 Mults, x0,999^n Hacknet-Kosten) | alle, dauerhaft (nie zurueckgesetzt) | 7 -> 11: +0,40 % |
| 22 | Exploit-Ausloeser | `NetscriptFunctions/Extra.ts:18-59` (exploit, bypass, alterReality, rainbow, openDevMenu=April-Scherz), `Exploits/loops.ts` (Tampering, TimeCompression), `Exploits/Unclickable.tsx:7-12`, `DevMenu.tsx:41-43`, Arcade/Nudelbar | alle | je +0,1 % |
| 23 | Export-Bonus | `ExportBonus.tsx:6-21`, `SaveObject.ts:239-251`, `Singularity.ts:1193-1204` | alle; Wanduhr 24 h | +1 Favor in JEDER Mitgliedsfaktion; Favor bleibt bis Knotenende (`Faction.ts:68-84`) |
| 24 | Favor-Wirkung | `reputation.ts:8-14` (Arbeit x(1+F/100)), `FactionHelpers.tsx:132-170` (Passiv min(0,1; F/1000+0,01)), `Bladeburner/Formulas.ts:46-49` (Bladeburners-Ruf x(1+F/100)) | Passiv ausser BN2 | +1 Favor bei F 0: +1 % Arbeit/BB-Ruf, +10 % Passivruf |
| 25 | Achievements | `Achievements/Achievements.ts`, `Electron.tsx:218-223` | - | keine Spielwirkung (nur Steam/Anzeige) |
| 26 | Casino | `Casino/Game.ts:4-19` (10 Mrd, `moneySourceA.casino`), `PlayerObjectGeneralMethods.ts:128,599-601` (Reset bei JEDEM Einbau), `Casino/Roulette.tsx:12,100-176`, `RNG.ts:38-63`, `Casino/utils.ts:3-8` (isTrusted) | alle, Aevum | bis ~10,1 Mrd je Einbauzyklus, OHNE BN-Faktor |
| 27 | Casino-Varianten | `SlotMachine.tsx:138-141` (1 Mio, WHRNG(totalPlaytime)), `Blackjack.tsx:16` (100 Mio, lodash-Mischen), `CoinFlip.tsx:13` (10.000 $) | alle | Roulette am ergiebigsten |
| 28 | Meilensteine | `Milestones/*`, `ui/GameRoot.tsx:391-392` | - | nur Anzeige |
| 29 | BN13-Start mit Reisegeld | `Prestige.ts:341-343` | BN13 | 200.000 $ |
| 30 | BN8-Startgeld je Zyklus | `Prestige.ts:38,158-160` | BN8 | 250 Mio |
| 31 | Programme bauen (Int-Quelle) | `Work/CreateProgramWork.ts:62,79-81` | alle | 0,1 Int-Exp/s, Programme sonst gekauft (INFRA) |
| 32 | Simulacrum-Parallelarbeit (Verbrechen/Gym neben BB) | `Bladeburner.ts:1354` | V2 | Querverweis BLADE-6 |

## 2. Abdeckungsmatrix

| Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil |
|---|---|---|---|---|
| 1 Spieler-Verbrechen | `src/bn4life.js:534-606` (nur ohne Division `:579-582`, ohne rep-modus `:556-559`, Figur PRIO 50) | alle; praktisch nur Kaltstart vor Faktionsarbeit bzw. vor Divisionsbeitritt | GENUTZT-SUBOPTIMAL | BN2.1: 34 Shoplifts = 2,03 Mio $ (geeicht) in rund 70 s. Kein Befund: Leerlauf der Figur ist fast null |
| 2 Verbrechenswahl | `src/bn4life.js:24-37, 535-537` (Leiter 40/117 aus BN4, ohne Int/crime_success) | wie 1 | GENUTZT-SUBOPTIMAL | gegen Optimum 15-46 % weniger $/s (Heist ab Kampf ~20 vorne); absolut < 1 min je Lauf -> kein Befund |
| 5 Crime-Auskunft/Formulas | fehlt (fest verdrahtet) | - | OPTIMAL | spart RAM, Formel reicht |
| 3 Fokus | `bn4life.js:600` (`commitCrime(..., true)`), `bbtrain.js:331` (Gym `false`, Gym hat keinen Fokusmalus) | alle | OPTIMAL | Fokusverlust durch DOM-Skripte: Audit 26.09. A1 |
| 6-8 Karma | kein Farmen; V2-Karma aus BB-Toetungen, V1 aus Leerlauf-Verbrechen/Sleeves | alle | OPTIMAL | V1-Laeufe: -8 nach 0,3 h, -29..-41 nach 4-10 h, Slum Snakes + Tetrads beigetreten (BN1L2, BN5L2, BN12L1-3); Syndicate -90 in V2 von selbst |
| 9 Kills | Homicide nur in der Leiter | - | NICHT GENUTZT | -> FAKT-4 |
| 7 Gang-Karma (Gang ausserhalb BN2) | fehlt | - | NICHT GENUTZT | -> GANG-3 |
| 10 Int-Quellen | kein Farmen | alle | OPTIMAL | +10 Stufen = 20.876 Exp = 58 h createProgram fuer +0,34 % BB-Erfolg (6.2) |
| 11 Int-Wirkung | `lib/calc.js:114-116` (Hacking), `blade.js` blackOpChance | alle | OPTIMAL | (HACK/BLADE) |
| 12 Int-Persistenz | - | alle | OPTIMAL | 199/199 Staende |
| 13-14 Gym | `src/bbtrain.js:56-74, 203-335` (Powerhouse, schwaechster Wert zuerst, 60-s-Takt, ab 5 Mio), `blade.js:1440-1452`, `joinrun.js:252-260` | V2 vor Beitritt / nach Einbau; V1 joinrun | OPTIMAL | bester Ort; Reihenfolge gleichgueltig (gleiche Rate je Wert); BN2.1 Beitritt nach 23 min (`data/bbjoin.txt`) |
| 15 Universitaet | fehlt; Begruendung `src/bn4rep.js:289-298` | - | OPTIMAL | Charisma-Studium 12 h fuer +11 % Firmenrate verworfen; Hacking-Exp kommt aus dem Netz |
| 16 ClassGymExpGain | `src/bn4rep.js:296-298` (bekannt) | - | NICHT ANWENDBAR | wirkungslos im Spiel |
| 17 Reisen | `bbtrain.js:217`, `bn4life.js:306`, `joinrun.js:252,312`, `graft.js:154`, `exploit3.js:71,118` | alle | OPTIMAL | Stadtwahl im V2: FAKT-2 |
| 18 goToLocation | `exploit3.js:80,100` | einmalig | OPTIMAL | - |
| 19 Krankenhaus explizit | `blade.js:4349-4367` (ab HP < 75 % und Geld > 10 Mio) | V2 | OPTIMAL | kostenneutral: Kosten sind linear im Schaden, ob jetzt oder beim naechsten Auto-Krankenhaus bezahlt; Op-Riegel-Fehler: BLADE-4 |
| 20 HP-Ruhe in der Kammer | `blade.js:2524-2527` (HP < 50 %), `:4372-4381` (ruhen bis 75 %) | V2, nur bei Geld <= 10 Mio | GENUTZT-SUBOPTIMAL | HP wirkt nicht auf den Erfolg (Action.ts:169-200); in 902 Abschnitten `data/aktionen.txt` (21.09.-03.10.) **0 mal** gegriffen -> kein Befund |
| 21 Exploits (7) | `src/exploit.js:35-37`, `src/exploit2.js:76-113`, `src/exploit3.js:71-118` | einmalig | OPTIMAL | dauerhaft im Stand |
| 21/22 fehlende 4 Exploits | `exploit2.js:54-66` (Begruendungen), BAUSTELLEN 2684-2800 | - | NICHT GENUTZT | **PLAYER-2** |
| 23 Export-Bonus | `src/export.js:42-46, 180-232` (nur bei Bruecke > 90 min ohne Sicherung), `src/exportbonus.js` (nur per tools/task.js) | alle | GENUTZT-SUBOPTIMAL | **PLAYER-3** |
| 25 Achievements | - | - | NICHT ANWENDBAR | keine Spielwirkung |
| 26-27 Casino | fehlt | - | NICHT GENUTZT | **PLAYER-1** |
| 28 Meilensteine | - | - | NICHT ANWENDBAR | nur Anzeige |
| 29-30 BN13-/BN8-Startgeld | - | BN13/BN8 | NICHT ANWENDBAR | Kontext fuer PLAYER-1 |
| 31 Programme bauen | fehlt (gekauft) | - | OPTIMAL | als Int-Quelle nicht lohnend |
| 32 Verbrechen als V2-Geldquelle (Spielerzeit) | bewusst nicht (`bn4life.js:563-582`) | V2 | OPTIMAL | BN2: bestes Verbrechen 0,29 Mrd/h = 7 % des Hackings gegen 100 % der Rangzeit; parallel nur mit Simulacrum (BLADE-6) |

Zaehlung (26 Zeilen): OPTIMAL 14, GENUTZT-SUBOPTIMAL 4 (1, 2, 20, 23), NICHT GENUTZT 4 (Kills, Gang-Karma, Exploits, Casino - zwei davon Querverweise auf FAKT-4/GANG-3), TOT 0, NICHT ANWENDBAR 4 (16, 25, 28, 29/30).

## 3. Befunde

### PLAYER-1 (NICHT_GENUTZT, P2) - Casino-Roulette: bis 10 Mrd $ je Einbauzyklus, ohne BN-Faktor

- **Spiel:** Die Sperre prueft `moneySourceA.casino > 10e9` (`Casino/Game.ts:4,13-19`,
  `PlayerObjectGeneralMethods.ts:599-601`), und `moneySourceA` wird bei JEDEM Einbau
  geleert (`:128`; beim Knotenwechsel ueber `prestigeSourceFile` -> `prestigeAugmentation`).
  `win(n)` bucht `gainMoney(n, "casino")` OHNE BitNode-Multiplikator. Roulette: Einsatz bis
  1e7, Einzelzahl zahlt 36x (`Roulette.tsx:12,100-107`), Generator `WHRNG(new Date().getTime())`
  beim Mount (`:110`, `RNG.ts:45-51`) - wer den Mount ausloest, kennt den Seed auf die
  Millisekunde; nach einem Spielergewinn wuerfelt das Haus mit 10 % neu, deterministisch
  bis zur Niete (`:149-154`), die Nachfuehrung bleibt also exakt.
- **Klicksperre:** `trusted()` prueft nur `event.isTrusted` (`Casino/utils.ts:3-8`). Der Bot
  umgeht genau diese Pruefung schon im Betrieb: `__reactProps$...onClick({isTrusted: true})`
  (`src/join.js:20-40, 97-101`, `src/darkweb.js:190-195`, `src/popups.js:112-117`).
- **Bot:** fehlt.
- **Bekannt:** `doku/schlupfloecher.md:1038-1074` (A8) hat das Casino "gestrichen", weil
  10 Mrd damals **61 s** Einkommen waren (BN1, 164,8 Mio $/s). Das ist die Neubewertung
  fuer die Restroute mit gemessenen Zahlen, nicht dasselbe Argument noch einmal.
- **Gerechnet (`player-casino.mjs`):** Seed bekannt -> Median 31-33 Spins, hoechstens 40,
  reine Spielzeit **~0,9 min** bis > 10 Mrd (200 Laeufe, Start 5e4-1e7 $).
  Gemessene Hacking-Einnahmen je Lauf: BN2.1 4,20 Mrd/h, BN4 3,3-3,6, BN9 **0,01**, BN10
  13,6 Mrd/h; Einbauzyklen je V2-Lauf **3-8** (BN4L3 8, BN9L2/3 5, BN10L2 4).
  Grob skaliert (ServerMaxMoney x ScriptHackMoney gegen BN2): BN3 ~0,42 Mrd/h
  (10 Mrd = 24 h Hacking, Augs x3), BN11 ~0,52 Mrd/h (19 h, Augs x2), BN8 0 (nur Boerse,
  Startgeld 250 Mio je Zyklus, `Prestige.ts:38,158-160` -> 10 Mrd = 40-faches Startkapital).
- **Gerechnet (`player-casino-wert.mjs`, FAKT-Zyklusmodell):** In BN2 bindet Geld erst unter
  ~10 Mrd je 12-h-Zyklus - bei 35 Mrd/Zyklus bringt das Casino in BN2 **nichts** (Ruf bindet).
  Bei 2-3 Mrd BN2-Aequivalent (BN3: ~5-10 Mrd Zyklusgeld / AugmentationMoneyCost 3) hebt
  +3,3 Mrd Aequivalent das Kampfmass um ln 0,074-0,076 = **~+8 % Rang/h im Folgezyklus**
  (alle drei Faktionsszenarien). Mit CORP-1 (104 Mrd Seed-Auszahlung in BN3) faellt der
  erste BN3-Zyklus weg, die Folgezyklen bleiben geldarm.
- **Ertrag:** GERECHNET_UNGEEICHT ~+8 % Rang/h je geldarmem BN3-Zyklus (~2-3 h je
  BN3-Lauf, wenn ein Lauf ~30 h dauert), BN2/BN6/BN7/BN14/BN15 ~0; BN8: needs_calc mit dem
  Boersenmodell (Kapital x40 je Zyklus).
- **Aufwand L:** Reise nach Aevum (200k), `goToLocation("Iker Molina Casino")`, Roulette-Tab,
  Mount-Zeit nehmen, Seed aus den ersten 1-2 angezeigten Zahlen festnageln, Einsatzfeld per
  nativem Setter, Klick per `__reactProps`, Haus-Neuwurf nachfuehren, "cheater"-Dialog
  wegklicken (popups.js), Rueckreise. Laeuft neben Bladeburner (Navigation ist keine Arbeit,
  `Bladeburner.ts:1354`).
- **Offen (Eric):** Schon in A8 gestellt und nie beantwortet - will er das Casino ueberhaupt?
  Ohne Ja nicht bauen.

### PLAYER-2 (NICHT_GENUTZT, P3) - Vier Exploits fehlen, drei davon sind mit vorhandenen Mitteln erreichbar

- **Stand:** 7 von 11 (`Exploits/Exploit.ts:14-30`; Spielstand: UndocumentedFunctionCall,
  INeedARainbow, Bypass, TimeCompression, TrueRecursion, N00dles, PrototypeTampering - seit
  29.08. unveraendert). Es fehlen Unclickable, YoureNotMeantToAccessThis, RealityAlteration,
  EditSaveFile.
- **Neue Fundstellen gegen den Entscheid 29.08. (BAUSTELLEN.md:2709-2800, "drei endgueltig"):**
  1. **Unclickable:** Der Handler liest nur `event.target` (muss ein Element mit berechnetem
     `display:none` und `visibility:hidden` sein) und `event.isTrusted`
     (`Unclickable.tsx:7-12`). `#unclickable` hat beides als Inline-Stil (`:15`) und haengt
     immer in `GameRoot` (`ui/GameRoot.tsx:558`). Also
     `__reactProps$(#unclickable).onClick({ target: el, isTrusted: true })` - dieselbe Technik,
     die `src/join.js` seit Wochen fuer den Beitrittsknopf benutzt. `exploit2.js:63` und
     BAUSTELLEN 2727 ("braucht einen ECHTEN Mausklick") stammen aus der Zeit vor dieser Technik.
     Aufwand S.
  2. **YoureNotMeantToAccessThis:** `DevMenuRoot` gibt den Exploit im ersten `useEffect`
     (`DevMenu.tsx:41-43`), sobald `Page.DevMenu` ("Dev", `ui/Enums.ts:22`) gerendert wird.
     Die Seitenliste ist ein React-State in `GameRoot` (`ui/GameRoot.tsx:177`,
     `setPages`). `src/join.js:104-108` hat schon den Fiber-Zugriff (`__reactFiber$`); ueber
     den Hook-Zustand der GameRoot-Fiber kommt man an `setPages`. Aufwand M, bruechig, aber
     einmalig.
  3. **EditSaveFile:** ENTSCHIEDEN-Tabelle Zeile 32: "nein, erst beim naechsten Reset". Seit
     dem 29.08. gab es mindestens 13 Knotenwechsel (BN10L3 ... BN2L1) - keiner wurde genutzt.
     Das ist ein liegengebliebener Beschluss, keine neue Abwaegung. Braucht einen
     beaufsichtigten Moment (Import ueber die Oberflaeche), Aufwand S.
  4. **RealityAlteration:** bleibt nur ueber einen Debugger-Haltepunkt (CDP) erreichbar.
- **Ertrag:** je Exploit x1,001 auf rund 27 Multiplikatoren (`applyExploits.ts:4-40`, im
  AUG-Bereich `aug-mults.mjs` exakt geeicht), dauerhaft. V2-Restroute (~700 h,
  Rang-Elastizitaet ~1 auf die Kampfwerte) ~0,7 h je Exploit; in BN8 (V1) zusaetzlich ~1,7 %
  weniger Hacking-Erfahrung je Exploit am Zielpunkt (Exponentenwirkung, L/(32m) ~17,
  `doku/schlupfloecher.md:1184-1199`). GESCHAETZT ~1,5 h je Exploit, ~4 h fuer die drei
  erreichbaren.
- **known_before:** BAUSTELLEN.md:2684-2800; `doku/schlupfloecher.md:1224-1240` (dort
  EditSaveFile "von Eric ausgeschlossen" - widerspricht der ENTSCHIEDEN-Zeile, siehe offene Fragen).

### PLAYER-3 (SUBOPTIMAL, P3) - Export-Bonus nur als Nebenwirkung einer Brueckenpanne

- **Bot:** `src/export.js:180-200` exportiert nur, wenn `lastVerifiedBackup` aelter als 90 min
  ist; der Kommentar `:43-46` nennt den Bonus ausdruecklich "keinen Grund fuer haeufigere
  Aufrufe". `src/exportbonus.js` laeuft nur per Auftrag (Downloads-Datei als Grund, `:19-23`).
- **Spiel:** +1 Favor in jeder Mitgliedsfaktion alle 24 h Wanduhr (`ExportBonus.tsx:6-21`),
  ausgeloest von `ns.singularity.exportGame()` (`SaveObject.ts:239-241`);
  `hasExportGameBonus()` sagt, ob er faellig ist (`Singularity.ts:1201-1204`). Favor bleibt bis
  zum Knotenende (`Faction.ts:68-84`).
- **Gemessen (`player-export.mjs`):** 17 Abholungen in 44 Tagen (20.08.-03.10.) = **38 %**;
  Abstaende 26-364 h, aufsummiert **28 verschenkte Tage**. Der Zeitpunkt haengt am Zufall der
  Brueckenpanne, nicht an der Zahl der Mitgliedschaften (nach einem Einbau sind es 0 - ein
  Bonus dann ist ganz verloren).
- **Wert je Abholung:** BN2 nur Bladeburners-Ruf +1 % (`Bladeburner/Formulas.ts:46-49`; andere
  Faktionen ohne Wert, FAKT-6). In allen anderen Restknoten Passivruf je Mitgliedsfaktion
  **+10 %** bei Favor 0 (+6,7 % bei 5, +3,3 % bei 20; `FactionHelpers.tsx:157`), Arbeitsruf
  +1 % (BN8 V1).
- **Ertrag:** GESCHAETZT klein (Passivruf ist 1 % der Arbeitsrate je Faktion; bei 7
  Faktionen ~+80 rep/h je Abholung bei Favor 0). Aufwand S: in export.js zusaetzlich
  exportieren, wenn `hasExportGameBonus()` und die Mitgliederzahl hoch ist (z. B. am
  Einbau-Handschlag vor dem Reset). Preis: eine ~660-KB-Datei je Tag im Downloads-Ordner -
  der Entscheid gegen die Datei war bewusst, deshalb nur mit Erics Ja.

## 4. Antworten auf die Schwerpunktfragen

- **Exploits:** 7 von 11. Erreichbar mit vorhandener Technik: Unclickable (S), DevMenu (M),
  EditSaveFile (beim naechsten beaufsichtigten Reset). Nur per CDP: RealityAlteration.
- **Export-Bonus taeglich?** Nein - 38 % der Tage, nur bei Brueckenpannen (PLAYER-3).
- **Intelligenz:** Int 153 (Exp 63.025, `calculateSkill` 199/199 geeicht). Wirkung x1,093
  Hacking-Chance/-Zeit und Faktionsruf, x1,070 Bladeburner-Erfolg, x1,187 share. Eine Stufe
  kostet jetzt ~2.000 Exp (+0,045 % bzw. +0,034 %); +10 Stufen = 20.876 Exp = 58 h
  createProgram oder 116 h Universitaet. Natuerlicher Zufluss 18-219 Exp/h (V1 mehr: Augkaeufe
  und Einbauten je 15, Beitritte 7,5), dazu 300 je Knotenende. Farmen lohnt nicht - OPTIMAL.
- **Karma:** Der Bot braucht kein Karma-Farmen. V2 liefert Syndicate (-90) nebenbei
  (BN2.1 -182), V1-Laeufe erreichen -9/-18 binnen 0,3-10 h aus Leerlauf-Verbrechen/Sleeves
  (alle V1-Laeufe hatten Slum Snakes und Tetrads). Kills und Gang ausserhalb BN2: FAKT-4, GANG-3.
- **Verbrechen in BN2 (CrimeMoney 3):** Bestes Verbrechen am heutigen Stand Heist
  0,29 Mrd/h fokussiert (0,23 unfokussiert) = 7 % des gemessenen Hackings (4,20 Mrd/h), gegen
  100 % der Rangzeit - nicht lohnend. In BN11 (CrimeMoney 3, ServerMaxMoney 0,01) laege es bei
  ~56 % des grob skalierten Hackings (Querverweis Knotenpruefer BN3-11; fuer Sleeves
  SLEEVE-Bereich).
- **Casino als Fruehgeld:** Grenze 10 Mrd je Einbauzyklus (nicht je Spielstand), ~0,9 min
  Spielzeit mit bekanntem Seed; Wert stark knotenabhaengig (PLAYER-1).

## 5. Was ich NICHT aendern wuerde

- Die Verbrechensleiter in `bn4life.js:537`: 15-46 % unter dem Optimum, aber die Figur ist
  praktisch nie frei (BN2.1: ~70 s Verbrechen). Kein Umbau.
- Die HP-Ruhe in der Kammer (`blade.js:2524-2527`): sachlich ohne Wirkung, aber in 902
  Abschnitten nie ausgeloest, weil das Krankenhaus ab 10 Mio $ vorher greift.
- Das explizite Krankenhaus (`blade.js:4360-4367`): kostenneutral (linear im Schaden).
- Gym/bbtrain: richtiger Ort, richtige Regel.

## 6. Rechnungen

### 6.1 Verbrechen (`node tools/audit/player-crime.mjs --file 2026-10-03T17-16`)

Eichung: siehe Abschnitt 0 (34,000 Shoplift-Ertraege, Rest 1e-9 $).
Stand BN2.1: hack 407, str/def/dex/agi 198/185/186/186, cha 69, int 153, crime_money =
crime_success 1,3281.

| Verbrechen | Chance | $/s fokussiert | Mio $/h unfok. | Kampf-Exp/s | Int-Exp/h |
|---|---|---|---|---|---|
| Heist | 0,102 | 81.400 | 234 | 1,41 | 4,0 |
| Homicide | 1,000 | 59.762 | 172 | 3,82 | 0 |
| Deal Drugs | 1,000 | 47.810 | 138 | 1,43 | 0 |
| Bond Forgery | 0,764 | 45.685 | 132 | 0,59 | 27,5 |
| Mug | 1,000 | 35.857 | 103 | 4,30 | 0 |
| Shoplift | 1,000 | 29.881 | 86 | 2,87 | 0 |

Leiter gegen Optimum (gleiche Kampfwerte, Int/mults wie Stand): Kampf 20 -19 %, 60 -24 %,
100 -38 %, 150 -16 %, 300 -46 % (Heist ist ab ~20 vorne).

### 6.2 Intelligenz (`node tools/audit/player-int.mjs`)

Int-Exp je Lauf (Spielzeit): BN10L2 38/h, BN10L3 142, BN4L2 54, BN4L3 46, BN9L1-3 34-74,
BN1L2/3 142/219, BN5L2/3 142/62, BN12L1-3 52-121, BN2L1 18 (noch kein Einbau).
Bis Stufe 154: 176 Exp; bis 163: 20.876 Exp (33 % des Bestands).

### 6.3 Casino (`player-casino.mjs`, `player-casino-wert.mjs`)

Spins bis > 10 Mrd (Median/Max): Start 5e4 33/40, 1e6 32/39, 1e7 31/39.
FAKT-Modell, Ist-Faktionen: 2 Mrd -> ln 0,100, 5 Mrd -> 0,173, >= 8 Mrd -> 0,232 (Deckel
durch Ruf). S12/NiteSec/TDH: 3 Mrd 0,215, 5 Mrd 0,289, >= 10 Mrd 0,347.
Mit Syndicate: 2-3 Mrd 0,334, 5 Mrd 0,410, 8-15 Mrd 0,483, >= 25 Mrd 0,542.

### 6.4 Export-Bonus (`player-export.mjs`)

Abstaende der Abholungen (h): 364, 29, 89, 47, 62, 59, 36, 29, 45, 26, 72, 47, 34, 36, 36, 48.
Wert +1 Favor: Favor 0 -> Arbeit/BB-Ruf +1,00 %, Passiv +10,0 %; Favor 5 -> +0,95 % / +6,7 %;
Favor 20 -> +0,83 % / +3,3 %.

## 7. Querverweise (Belege aus diesem Bereich fuer andere)

- BLADE-4: zwischen den Staenden 17:16 und 17:17 stieg `hospitalization` um 131,2 Mio $ bei
  hpMax 28 und 21,1 Mrd Konto -> ein Schaden von rund 1.312 HP in einer Minute; die Kosten
  sind linear im Schaden, die Obergrenze `hp.max x 1e5` im Op-Riegel ist falsch. BN2.1 gesamt
  jetzt 4,71 Mrd (9 % der Hacking-Einnahmen).
- BLADE-6: neben Bladeburner mit Simulacrum waere in BN2/BN11 Heist (0,29 Mrd/h) die
  Geldoption, Faktionsarbeit die Rufoption; in BN2 bindet laut FAKT-Modell der Ruf.
- Knotenpruefer BN3-11: in BN11 ist Spieler- und Sleeve-Verbrechen (CrimeMoney 3) gegen
  ServerMaxMoney 0,01 eine ernsthafte Geldquelle; in BN3 sind Casino und CORP-1 die einzigen
  grossen Geldhebel.

## 8. Offene Fragen

1. Casino (PLAYER-1): Will Eric RNG-Vorhersage plus Attrappen-Klick am Roulette? Die Frage
   steht seit `doku/schlupfloecher.md` A8 offen; ohne Ja nicht bauen.
2. EditSaveFile: `doku/schlupfloecher.md:1238` sagt "von Eric ausgeschlossen", die
   ENTSCHIEDEN-Tabelle (BAUSTELLEN.md:32) sagt "erst beim naechsten Reset". Was gilt?
3. Unclickable/DevMenu ueber React-Interna (PLAYER-2): Das Spiel laedt ausdruecklich dazu ein
   (`Exploits/Exploit.ts:1-11, 25-28`) - sieht Eric das als zulaessig?
4. Export-Bonus (PLAYER-3): Ist eine ~660-KB-Datei je Tag im Downloads-Ordner hinnehmbar?
5. BN3-Zyklusgeld nach CORP-1: Ist Geld in den BN3-Folgezyklen ueberhaupt bindend (Passivruf
   macht mehr Stuecke verfuegbar)? Davon haengt der Wert von PLAYER-1 ab - Sache des
   BN3-11-Knotenpruefers zusammen mit CORP.
