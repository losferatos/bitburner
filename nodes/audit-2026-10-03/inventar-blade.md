# Audit "vollstaendig" 03.10.2026 - Bereich BLADE (Bladeburner)

Pruefer: Subagent BLADE, 03.10.2026 11:11 (Systemzeit). Streng lesend: `src/`
unveraendert, Spiel nicht angefasst, nichts committet. Grundlage: Spielquellcode
3.0.2 (`reference/bitburner-src/src/`), Bot-Stand master 0cc5a80, Spielstaende
`backups/*BN2L1*` (03.10. 05:33 - 09:59, BN2.1, 5,3 h im Knoten).

Rechner (alle unter `tools/audit/`):

| Datei | Zweck |
|---|---|
| `blade-lage.mjs` | Spielstand dekodieren: Division, Staedte, Vorraete, Skills, Sleeves, `data/blade.json`, `data/aktionen.txt` vom home |
| `blade-formeln.mjs` | Nachbau `getSuccessChance`, `getSuccessRange`, `getActionTime`, `maxStamina`, Regeneration, Rang, Krankenhaus |
| `blade-eichung.mjs` | Eichung gegen 8 BN2L1-Spielstaende (Tabelle unten) |
| `blade-aktionen.mjs` | Zeit-/Ranganteile je Aktion aus dem Aktionsprotokoll |
| `blade-stadt.mjs` | wahre Chancen und Rangraten je Stadt (Befund BLADE-1) |
| `blade-skills.mjs`, `blade-skillmix.mjs` | Skillverteilung gegen gierige Alternative (Befund BLADE-2) |
| `blade-sleevevertrag.mjs` | Sleeve-Vertrag gegen Field Analysis |
| `blade-hashsp.mjs` | Hash-Tausch Rang gegen Skillpunkte |

## Eichung (Soll = Spielstand / Spiel-API, Ist = Nachbau)

`node tools/audit/blade-eichung.mjs` - Soll fuer `s.min` ist das Feld `chance` in
`data/blade.json` = `getActionEstimatedSuccessChance()[0]` der laufenden Aktion
(Spiel-API, auf 3 Stellen gerundet), fuer die Zeit `actionTimeToComplete`, fuer
die Ausdauer `bladeburner.maxStamina` aus dem Spielstand.

| Stand | maxStamina Soll / Ist | Aktion | Zeit Soll / Ist | s.min Soll / Ist |
|---|---|---|---|---|
| 05:33 | 48,481030 / 48,481030 | Raid L1 | 67 / 67 | 0,088 / 0,0875 |
| 07:33 | 66,421111 / 66,421111 | Retirement L3 | 18 / 18 | 0,578 / 0,5780 |
| 08:33 | 75,097183 / 75,097183 | Retirement L8 | 20 / 20 | 0,326 / 0,3264 |
| 09:19 | 79,829982 / 79,829982 | Raid L5 | 77 / 77 | 0,076 / 0,0757 |
| 09:33 | 80,567445 / 80,567445 | Raid L5 | 77 / 77 | 0,046 / 0,0456 |
| 09:46 | 81,670488 / 81,670488 | Raid L5 | 77 / 77 | 0,038 / 0,0385 |
| 09:59 | 84,302595 / 84,302595 | (Kammer) | - | - |

Maximale Abweichung: maxStamina 0, Zeit 0, s.min 0,00046 (unter der Rundung
0,0005), Typhoon-Chance gegen `boChancen` 0,00007. Zusaetzlich: Sleeve-Chance
Bounty Hunter L7 gerechnet 0,153, gemessen 10 Erfolge in 58 Versuchen (0,172,
Standardfehler 0,047) zwischen 09:33 und 09:59. Damit gelten alle Chancen-,
Zeit- und Ausdauerzahlen unten als GERECHNET_GEEICHT.

## Lage BN2.1 (Spielstand 09:59)

Rang 1.734, 578 SP, 0 Black Ops, Typhoon-Chance 0,0868 gegen Schwelle 0,90.
Division in Sector-12: pop 587 Mio, popEst 899 Mio (r = 0,654), Chaos 49,1,
41 Gemeinden. Zeitanteile seit Knotenstart (`blade-aktionen.mjs`, 4,8 h):
Raid 65,9 % (1.530 Rang), Kammer 22,9 %, Retirement 11,2 %; keine Field
Analysis, keine Investigation/Undercover. Raid-Vorrat 07:33-09:20 bei 0,74
(leer). Sleeves 05:33-08:33 im Gym (Schock 98 -> 93), ab 09:33 Vertraege bzw.
Infiltrate, Schock wieder 99-100.

---

## Tabelle 1 - Feature-Inventar aus dem Quellcode

BN-Spalte: "V2" = alle V2-Knoten der Restroute (BN2, 3, 11, 6, 7, 14, 13, 15);
Division per SF6 (vorhanden) oder BN6/7, nicht in BN8 (`BladeburnerRank` 0,
`NetscriptFunctions/Bladeburner.ts:339-342`). Rang-/Skillkosten-Faktoren:
BN2/3/6/11 1/1, BN7 0,6/2, BN14 0,6/2, BN13 0,45/2, BN15 0,2/3
(`BitNode/BitNode.tsx:750-751, 1027-1028, 1072-1073, 1108-1109`).

| # | Feature | Wo im Quellcode | Wirkt in | Ertrag / Hebel |
|---|---|---|---|---|
| 1 | Division beitreten | `NetscriptFunctions/Bladeburner.ts:330-364` | V2 | Kampfwerte 100, Tor zu allem |
| 2 | Faktion Bladeburners | `Faction/FactionInfo.tsx:698-708` (Einladung ab Rang 25), `Bladeburner.ts:265-273` | V2 | Augs, Simulacrum |
| 3 | Rang -> Faktionsruf | `Formulas.ts:46-49`, `Bladeburner.ts:1275-1280` | V2 | 2 x Rang x faction_rep x (1+Favor/100) |
| 4 | Skillpunkte aus maxRank | `Bladeburner.ts:1282-1291`, `Constants.ts:47` | V2 | 1 SP je 3 Rang, maxRank faellt nie |
| 5-7 | Vertraege Tracking / Bounty Hunter / Retirement | `data/Contracts.ts:8-110`, `Bladeburner.ts:866-887` | V2 | Rang 0,3/0,9/0,6 x rewardFac^(L-1), kein rankLoss |
| 8 | Vertragsgeld | `Bladeburner.ts:933-941` | V2 | 250k x rewardFac^(L-1) x Midas |
| 9-14 | Operationen Investigation, Undercover, Sting, Raid, Stealth Ret., Assassination | `data/Operations.ts:9-226`, `Bladeburner.ts:791-864` | V2 | Rang 2,2-55, rankLoss, Pop-/Chaos-/comms-Effekte |
| 15 | 21 Black Ops | `data/BlackOperations.ts`, `Actions/BlackOperation.ts:44-69` | V2 | Knotenausgang; Pop/Chaos = 1; Zeit x1,5 |
| 16 | Aktionsstufen, autoLevel, setActionLevel | `LevelableAction.ts:49-64`, `Bladeburner.ts:1004-1006`, NS `:209-225` | V2 | Schwierigkeit diffFac^(L-1), Ertrag rewardFac^(L-1) |
| 17 | Erfolgsspanne / wahre Chance | `Actions/Action.ts:144-196` | V2 | Spanne deterministisch aus r = pop/popEst |
| 18 | Aktionsdauer | `Actions/Action.ts:105-122` | V2 | statFac(effAgi, effDex), Overclock |
| 19 | Aktionsvorrat | `Bladeburner.ts:1385-1391`, `Constants.ts:39` | V2 | Wachstum growth/480 je s, global (nicht je Stadt) |
| 20 | Incite Violence | `Bladeburner.ts:1219-1235` | V2 | +180 s Wachstum auf jede Art, Chaos alle Staedte +10 +c/log10(c) |
| 21 | Field Analysis | `Bladeburner.ts:1122-1151`, `Formulas.ts:12-13` | V2 | 0,1 x BBRank Rang je 30 s, Schaetzung, keine Ausdauer |
| 22 | Training | `Bladeburner.ts:1092-1121` | V2 | 30 exp je Kampfwert / 30 s, staminaBonus +0,04 |
| 23 | Recruitment | `data/GeneralActions.ts:22-36`, `Bladeburner.ts:1152-1184` | V2 | Trupp +1, Chance cha^0,45/(Menschen+1) |
| 24 | Diplomacy | `Bladeburner.ts:735-743, 1185-1196` | V2 | Chaos -(cha^0,045+cha/1000) % je 60 s |
| 25 | Regenerationskammer | `Bladeburner.ts:1197-1218` | V2 | +1 % maxStamina je 60 s, +2 HP |
| 26 | Stadtwahl `switchCity` | NS `Bladeburner.ts:314-319` | V2 | Feldsetzen, kostenlos, auch mitten in einer Aktion |
| 27 | Chaos | `Actions/Action.ts:94-103`, `Bladeburner.ts:1393-1399` | V2 | ueber 50 Schwierigkeit x sqrt(1+c-50); passiv -0,36/h |
| 28 | Bevoelkerung | `Actions/Action.ts:88-92`, `Bladeburner.ts:830-843` | V2 | (pop/1e9)^0,7 auf competence; Raid-Fehlschlag senkt pop, NICHT popEst |
| 29 | Gemeinden (comms) | `data/Operations.ts:147-150`, `Bladeburner.ts:836` | V2 | Raid braucht comms >= 1 je Stadt |
| 30 | Zufallsereignisse | `Bladeburner.ts:601-697, 1401-1407` | V2 | exogen |
| 31 | Ausdauerstrafe | `Bladeburner.ts:167-169` | V2 | unter 50 % linear auf competence (auch fuer Sleeves) |
| 32 | Hoechstausdauer, Regeneration | `Bladeburner.ts:1317-1343` | V2 | effAgi^0,8 + staminaBonus; (0,0085+max/70000) x effAgi^0,17 |
| 33 | Schaden / Krankenhaus | `Bladeburner.ts:981-988`, `Hospital/Hospital.ts:4-18`, `PlayerObjectGeneralMethods.ts:266-290` | V2 | Kosten min(10 % Geld, (max - hp + Schaden) x 1e5) |
| 34 | Trupp und Verluste | `Actions/Operation.ts:96-98`, `Actions/TeamCasualties.ts:29-62` | V2 | (n+1)^0,05; Black Op min. 1 Toter |
| 35 | Sleeve "Support main sleeve" | `Bladeburner.ts:745-751`, `Sleeve/Work/SleeveSupportWork.ts:8-20`, `TeamCasualties.ts:52-58` | V2 | +1 Truppgroesse sofort; Tod = Schock +0,5, Trupp faellt nie unter Sleeve-Zahl |
| 36 | Sleeve Recruitment | `Sleeve.ts:505-511` | V2 | wie 23, mit Sleeve-Charisma |
| 37 | Sleeve Vertraege | `Sleeve/Work/SleeveBladeburnerWork.ts:41-61` | V2 | Spielerrang, keine Spielerausdauer |
| 38 | Sleeve Infiltrate | `Sleeve/Work/SleeveInfiltrateWork.ts:16-28`, `Bladeburner.ts:1251-1263` | V2 | je Abschluss k^-0,5/2 auf JEDE Art, statunabhaengig |
| 39 | Sleeve FA/Diplomacy/Kammer/Training | `Sleeve.ts:488-524`, `Bladeburner.ts:1092-1218` | V2 | Training/Kammer wirken auf SPIELER-Ausdauer |
| 40 | Sleeve-Schock durch Vertragsfehlschlag | `Sleeve.ts:559-570`, `Sleeve/Work/Work.ts:17-25`, `SleeveClassWork.ts:32` | V2 | Tod = +0,5 Schock; alle Sleeve-Exp x (100-Schock)/100 |
| 41 | Skills BI, DO, SC, Cloak | `data/Skills.ts:5-36`, `Bladeburner.ts:774-784` | V2 | multiplikativ auf competence |
| 42 | Skill Tracer | `data/Skills.ts:37-43` | V2 | nur Vertraege |
| 43 | Skill Datamancer | `data/Skills.ts:73-83`, `Bladeburner.ts:803-820, 872-877, 1139-1141` | V2 | nur Schaetzgenauigkeit (FA, Investigation, Undercover, Tracking) |
| 44 | Skills Reaper / Evasive | `data/Skills.ts:54-72` | V2 | Kampfwerte effektiv, Chance UND Dauer |
| 45 | Skill Overclock | `data/Skills.ts:44-53` | V2 | Dauer -1 %/Stufe, max 90 |
| 46 | Skill Cyber's Edge | `data/Skills.ts:84-90` | V2 | Hoechstausdauer und Regeneration +2 % |
| 47 | Skill Hyperdrive | `data/Skills.ts:98-104`, `Bladeburner.ts:704-733` | V2 | Exp aus Aktionen +10 % |
| 48 | Skill Hands of Midas | `data/Skills.ts:91-97` | V2 | Vertragsgeld +10 % |
| 49 | Skillkauf in Mengen | `Skill.ts:37-81`, NS `:239-257` | V2 | count-Parameter |
| 50 | Bonuszeit | `Bladeburner.ts:275-277, 1374-1378`, NS `:365-368` | V2 | gespeicherte Zyklen, 5 s je Engine-Tick |
| 51 | nextUpdate | NS `:369-374` | V2 | Wecken je Division-Tick |
| 52 | Konsolen-Automatik | `Bladeburner.ts:428-526, 1411-1419` | V2 | nur UI |
| 53 | The Blade's Simulacrum | `Augmentation/Augmentations.ts:284-297`, `Bladeburner.ts:178-180, 1354` | V2 | Bladeburner UND andere Arbeit gleichzeitig |
| 54 | Augs mit bladeburner_* | `Augmentations.ts:190-283, 536-546, 950-975, 1972-1998` | V2 | Chance, Ausdauer, Analyse |
| 55 | Hash: Rang | `Hacknet/data/HashUpgradesMetadata.tsx:90-98`, `HacknetHelpers.tsx:539-545` | V2 mit SF9 | 100 Rang (+33 SP) je 250 x (Stufe+1) |
| 56 | Hash: Skillpunkte | `HashUpgradesMetadata.tsx:99-107`, `HacknetHelpers.tsx:547-554`, `HashUpgrade.ts:71-81` | V2 mit SF9 | 10 SP je 250 x (eigene Stufe+1) |
| 57 | Stanek-Fragment Bladeburner | `CotMG/Fragment.ts:249-257`, `CotMG/StaneksGift.ts:195-199` | BN13 (SF13) | Chance/Ausdauer/Analyse x Ladung |
| 58 | SF7 | `SourceFile/applySourceFile.ts:110-122` | nach BN7 | bladeburner_* +8/+12/+14 % |
| 59 | BN-Faktoren | `Formulas.ts:9-44`, `Skill.ts:37-81` | V2 | Rang auf Gewinn, nicht auf Verlust |
| 60 | Rang-/Ruf-API (getActionRankGain ...) | NS `:157-208` | V2 | Komfort |
| 61 | Karma aus Toetungen | `Bladeburner.ts:968-970, 1048-1050` | V2 | -1 / -15 |
| 62 | Int-Exp aus Aktionen | `Bladeburner.ts:719-729` | V2 | Nebenprodukt |

## Tabelle 2 - Abdeckungsmatrix

Phasen: K = Kaltstart/Anlauf vor Beitritt, A = Aufbau (vor Typhoon), E =
Einbauzyklus, S = Endspiel (Rang >= Daedalus-Schranke), alle = A/E/S.

| # | Feature | Bot Datei:Zeile | aktiv | Kategorie | Urteil |
|---|---|---|---|---|---|
| 1 | Beitritt | `bbtrain.js:350`, Warten `blade.js:809-848` | K | OPTIMAL | ENTSCHIEDEN (sofort bei 100) |
| 2 | Faktion | `bn4life.js:276-290` (Einladungen) | A | OPTIMAL | Einladung ab Rang 25, 30-s-Takt |
| 3, 4 | Ruf, SP | automatisch | alle | OPTIMAL | - |
| 5-7 | Vertraege | `blade.js:3116-3415, 3612-3618, 3649-3655` | alle | OPTIMAL | Ertrag je Minute, D2-Chance |
| 8 | Vertragsgeld | - | - | NICHT ANWENDBAR | 0,4 Mio je Erfolg gegen Hackeinkommen |
| 9-11, 13, 14 | Operationen | `blade.js:3611` | alle | OPTIMAL | Ertragsvergleich (D4) |
| 12 | Raid | `blade.js:3601-3611` | A | SUBOPTIMAL | Geldkosten falsch begrenzt -> BLADE-4 |
| 15 | Black Ops | `blade.js:2576-2672, 4507-4521` | alle | OPTIMAL | Fix 03.10. haelt; Schwelle ENTSCHIEDEN |
| 16 | Stufen | autoLevel (Spielvorgabe) | alle | OPTIMAL | Raid L1 je Zeit +3,7 %, aber L5 je Vorrat +14 % (Vorrat bindet) |
| 17 | wahre Chance | `blade.js:2386-2433` (D2); Gym-Zweig `:4008-4021` roh | alle | SUBOPTIMAL | Gym-Zweig ohne D2 -> BLADE-7 |
| 18 | Dauer | `getActionTime` in `beste()` `:3153` | alle | OPTIMAL | - |
| 19 | Vorrat | `sleeve.js:710-725, 768, 849-852` | A | SUBOPTIMAL | Infiltrate hinter Kampfwert 40 -> BLADE-3 |
| 20 | Incite | `blade.js:3724-3759, 4479-4489` | selten | OPTIMAL | Ertrag klein, Chaos in allen Staedten (siehe unten) |
| 21 | Field Analysis | `blade.js:2665-2668, 3789-3809` | selten | OPTIMAL | seit D2 fast tot, richtig so |
| 22 | Training | `blade.js:3813, 4317` | K/E | OPTIMAL | Rueckfall |
| 23 | Recruitment Spieler | nie (D1, `blade.js:3047-3064`) | - | OPTIMAL | - |
| 24 | Diplomacy | `blade.js:2943` | A | OPTIMAL | Aufraeumen (mit Stadtwechsel meist unnoetig) |
| 25 | Kammer | `blade.js:2520-2523, 4369-4382` | alle | SUBOPTIMAL | richtig in BN2.1, falsch nur in Niedrigraten-Phasen -> BLADE-8 |
| 26 | Stadtwahl | `blade.js:2744-2806` | alle | SUBOPTIMAL | popEst statt pop -> BLADE-1 |
| 27 | Chaos | `blade.js:107-108, 2892-2946, 3190-3271` | alle | OPTIMAL | fuer gegebene Stadt richtig |
| 28 | Bevoelkerung | `blade.js:3315-3358` (1-h-Horizont, ENTSCHIEDEN) | alle | SUBOPTIMAL | Schaden bleibt, weil nie gewechselt wird -> BLADE-1 |
| 29 | comms | `blade.js:2783-2806` | A | OPTIMAL | - |
| 30 | Ereignisse | - | - | NICHT ANWENDBAR | exogen |
| 31 | Ausdauerstrafe | `blade.js:614-615` | alle | OPTIMAL | Band 51/56 % |
| 32 | staminaBonus | nicht gezielt | - | OPTIMAL | Training statt Kammer zahlt sich nicht aus (0,044 max je 30 s) |
| 33 | Krankenhaus | `blade.js:4360-4367` | alle | OPTIMAL | HP-Seite; Risikoseite BLADE-4 |
| 34 | Trupp | `blade.js:2452-2516, 4507-4521` | A/S | OPTIMAL | seit 03.10. erreichbar |
| 35 | Support main sleeve | - (`sleeve.js:69-70`) | - | NICHT GENUTZT | -> BLADE-5 |
| 36 | Sleeve Recruitment | `sleeve.js:134-170, 754-767` | A/S | OPTIMAL | - |
| 37 | Sleeve Vertraege | `sleeve.js:776-828` | alle | OPTIMAL | ~0,5 Rang/min je Sleeve > FA 0,2 (`blade-sleevevertrag.mjs`) |
| 38 | Sleeve Infiltrate | `sleeve.js:710-725, 849-852` | A/S | SUBOPTIMAL | -> BLADE-3 |
| 39 | Sleeve FA/Dipl./Kammer/Training | - | - | OPTIMAL | Sleeve-Training kostet SPIELER-Ausdauer (`Bladeburner.ts:1093` ohne isPlayer) |
| 40 | Sleeve-Schock | - | alle | SUBOPTIMAL | Teil von BLADE-3 |
| 41 | BI/DO/SC/Cloak | `blade.js:1027-1042, 1295-1300, 2536-2572` | alle | OPTIMAL | Abdeckung ueber Black-Op-Arbeit |
| 42 | Tracer | `blade.js:1041` (Abdeckung fest 1,0) | alle | SUBOPTIMAL | -> BLADE-2 |
| 43 | Datamancer | `blade.js:1163-1194, 1335-1350` | alle | SUBOPTIMAL | -> BLADE-2 |
| 44 | Reaper/Evasive | `blade.js:1059-1162` (D3) | alle | OPTIMAL | - |
| 45 | Overclock | `blade.js:1222-1294` | alle | OPTIMAL | Daempfung zu stark (wahr ~31 % bei Ausdauerbindung), gierig kauft es trotzdem nicht |
| 46 | Cyber's Edge | `blade.js:1195-1221` | alle | OPTIMAL | leicht ueberbewertet (1,73 % statt ~1,25 %) |
| 47 | Hyperdrive | `blade.js:1045-1058` | alle | OPTIMAL | Audit 26.09. |
| 48 | Hands of Midas | nicht im Plan | - | NICHT ANWENDBAR | Vertragsgeld trivial |
| 49 | Mengenkauf | `blade.js:1573-1595` (einzeln, rekursiv) | alle | OPTIMAL | - |
| 50 | Bonuszeit | - | - | NICHT ANWENDBAR | wird automatisch abgebaut; Entscheidungen haengen an nextUpdate/Spielzeit |
| 51 | nextUpdate | `blade.js:3958, 4379, 4587` | alle | OPTIMAL | - |
| 52 | Konsole | - | - | NICHT ANWENDBAR | - |
| 53 | Simulacrum | `blade.js:3930-3960` (nur Graft-Riegel), `lib/figur.js:53-61` | E | GENUTZT-TOT | Parallelarbeit nie genutzt -> BLADE-6 |
| 54 | Augs | `lib/hackaugs.js:345-350`, `buyaugs.js:316-435` | E | OPTIMAL | Bereich Progression |
| 55 | Hash Rang | `hashes.js:96, 241-261` | alle | OPTIMAL | - |
| 56 | Hash SP | - | - | NICHT GENUTZT | Begruendung "gleiche Preise" falsch, Ertrag aber nur +2-5 % der Hash-SP, kein Befund |
| 57 | Stanek Bladeburner | - | BN13 | NICHT GENUTZT | Bereich Nebensysteme (kein ns.stanek im Bot) |
| 58 | SF7 | Route | - | NICHT ANWENDBAR | - |
| 59 | BN-Faktoren | `blade.js:802-804, 2281, 3394-3395` | alle | OPTIMAL | - |
| 60 | Rang-API | - | - | NICHT ANWENDBAR | eigene Tabellen, geeicht |
| 61, 62 | Karma, Int | - | - | NICHT ANWENDBAR | - |

Zaehlung: OPTIMAL 39, SUBOPTIMAL 10, TOT 1, NICHT GENUTZT 3, NICHT ANWENDBAR 9
(62 Features).

Scope-/Erreichbarkeitspruefung: `node tools/test-scope-tot.js` 6 gruen, 0 rot
(kein Name ausserhalb seines Scopes in `src/`). Alle 30 in `blade.js`
benutzten `ns.bladeburner`-Funktionen existieren in
`NetscriptFunctions/Bladeburner.ts`; alle Aktions-, Stadt- und Skillnamen
stimmen mit `Bladeburner/Enums.ts` ueberein. Zeitliche Totzone: alle aus
Closures gerufenen `const`-Funktionen (`blackOpChance`, `spanneGenau`,
`ausdauerLuft`, `schaetzNot`) sind vor dem ersten Aufruf aus der
Hauptschleife (`blade.js:3865`) initialisiert. Kein toter Aufruf gefunden.

---

## Befunde

### BLADE-1 (P1, SUBOPTIMAL) Stadtwahl nach popEst haelt die Division in einer ausgebrannten Stadt - nach D2 kostet ein Wechsel nichts mehr

- **Bot:** `src/blade.js:2758-2780` (Wert = popEst / Chaosfaktor,
  Vorsprung 2), `:2783-2806` (Rundreise nur bei comms < 3 und Ziel >= 55).
  Begruendung der hohen Schwellen `:204-227`: nach einem Wechsel sei die
  Schaetzung "ungepflegt", s.min = 0, 110 min Field Analysis.
- **Spiel:** Raid-Fehlschlag senkt `pop`, aber NICHT `popEst`
  (`Bladeburner.ts:838-843`, `changeEstEqually: false`); die Chance haengt an
  der WAHREN pop (`Actions/Action.ts:88-92`, `est` nur fuer die Anzeige).
  `switchCity` setzt nur ein Feld (`NetscriptFunctions/Bladeburner.ts:314-319`).
  Seit D2 rechnet der Bot die wahre Chance in jeder Stadt aus dem
  Black-Op-Paar (`blade.js:2386-2433`) - das Argument "ungepflegte
  Schaetzung" ist erledigt; die wahre pop einer Stadt ist r x popEst, r aus
  `rAusBlackOp` nach einem Probewechsel.
- **Messung BN2.1 09:59** (`blade-stadt.mjs`, Formeln geeicht):

      Stadt       pop    popEst  Chaos  PopFaktor  Raid p  EV/Versuch  Dauer-Rang/min
      Sector-12   587M   899M    49,1   0,689      0,140    8,12        5,78   <- Division
      Volhaven   1485M  1424M     0,6   1,319      0,268   18,88       13,44
      Ishima     1251M  1546M     0,8   1,170      0,238   16,34       11,63

  Bot-Regel sieht Ishima 1546M gegen 899M = 1,72 < 2 -> kein Wechsel; wahr
  waere Volhaven 1485M gegen 587M = 2,53. Sector-12 ist vom eigenen Raid
  zerstoert: pop 1.107M (05:33) -> 587M, Chaos 1,1 -> 49,1. Ab Chaos 50 greift
  der Aufraeumzuschlag (`blade.js:3256-3271`): Bot-eigene Bewertung jetzt
  Raid 2,14 gegen Retirement 2,35 Rang/min - die beste Aktion des Knotens
  faellt in Sector-12 praktisch weg.
- **Ertrag:** Raid ist vorratsbegrenzt (~42 Versuche/h). EV je Versuch +10,76
  -> **+450 Rang/h** allein aus Raid, dazu Retirement p 0,765 -> 1,0 und
  Sleeve-Vertraege x1,9 (Spieler-Rangrate BN2.1 bisher 180-590/h). Gilt in
  jedem V2-Knoten vor dem Endspiel, solange Chancen < 1 sind.
- **known_before:** BAUSTELLEN Zeile 1952 "Stadtwahl nach Proben" mit der
  Auflage "erst bauen, wenn eine Messung zeigt, dass der Bot in einer
  schlechten Stadt festsitzt" - diese Messung liegt jetzt vor; Audit 26.09.
  4#2 (Fix-Vorschlag). Neu: Quantifizierung und dass D2 die Wechselkosten
  beseitigt hat.
- **Fix-Skizze:** je Runde fuer jede Stadt Probewechsel, r aus dem
  Black-Op-Paar, pop = r x popEst; Wert = (pop/1e9)^0,7 / Chaosfaktor mit
  Aufraeumkosten fuer Raid; Vorsprung klein (z. B. 1,2), da Wechsel gratis.
  Danach in die Ausgangsstadt zurueck oder bleiben. Die ENTSCHIEDEN-Zeile
  "Bevoelkerungs-Horizont 1 h" wird damit nicht angefasst - der Schaden
  wird durch Wechsel statt durch Zuschlag begrenzt.

### BLADE-2 (P1, SUBOPTIMAL) Skillbewertung: Datamancer und Tracer binden 34 % der Skillpunkte fuer fast nichts

- **Bot:** `relNutzen` Datamancer `blade.js:1163-1194` = 5/(1+0,05L) x
  `schaetzNot()`; `schaetzNot` `:1335-1350` misst die ROHE Spanne
  (`spanne()`), nicht die seit D2 aufgeloeste (`spanneGenau`). Tracer
  `:1032-1041` mit fester Abdeckung 1,0 ("der Sleeve liefert den GESAMTEN
  Rang", Lage vom 29.08.).
- **Spiel:** Datamancer wirkt nur auf die Schaetzung
  (`data/Skills.ts:73-83`; Verwendung `Bladeburner.ts:803-820, 872-877,
  1139-1141`: Investigation, Undercover, Tracking, Field Analysis). Keine
  dieser Aktionen faehrt der Spieler in BN2.1 (Aktionsprotokoll: 0 Abschnitte),
  und die Entscheidungen laufen seit D2 ueber die wahre Chance. Tracer wirkt
  nur auf Vertraege (`Actions/Contract.ts:30-32`); in BN2.1 kommen 88 % des
  Rangs aus Raid (Operation), Typhoon ist keine Vertragsaktion.
- **Messung:** Datamancer 0 (06:33) -> 3 (07:33) -> 10 (08:33) -> 12 (09:59)
  (102 SP), Tracer 9 (94 SP) - zusammen 196 von 578 SP. Bot-Sicht 09:59:
  schaetzNot 0,615, Datamancer 0,128/SP gegen Blade's Intuition 0,138/SP -
  praktisch gleichauf, darum wird er laufend mitgekauft; Kosten steigen nur
  um 1 je Stufe (`costInc 1`), der Effekt bleibt also ueber den ganzen Knoten.
- **Rechnung** (`blade-skillmix.mjs`, gierige Verteilung derselben 578 SP,
  Hyperdrive fest, Ziel ln(Typhoon-Chance) + ln(Dauer-Rangrate)):

      Bot     DO10 Tr9 SC8 BI7 CE5 ES4 R4 Cl4 Dm12 Hy5
      gierig  SC13 DO12 BI9 ES6 R6 CE2 Hy5
      Typhoon-Chance   0,0868 -> 0,1206   x1,39
      Dauer-Rang/min   5,23   -> 7,91     x1,51  (Raid-Anteil 0,6: x1,46)

  Nur Datamancer umverteilt (`blade-skills.mjs`): Typhoon x1,17, Raid-Rang
  x1,25. Bei gemessenem Chancenwachstum g ~ 0,115/h (`sleeve.js:73-79`) sind
  x1,39 rund **2,9 h frueher Typhoon**; Rangrate **+2,7 Rang/min (~+160/h)**.
- **Fix-Skizze:** `schaetzNot` auf `spanneGenau` umstellen (dann ~0, solange
  aufloesbar); Tracer-Abdeckung = Anteil der Vertraege am Rang (Spieler plus
  Sleeves, aus `data/aktionen.txt` wie `kostenAktualisieren`).
- **known_before:** BAUSTELLEN 1869 ff. Punkt 3 (Abdeckungen nach Aktionsmix);
  Datamancer-Effekt nach D2 neu.

### BLADE-3 (P2, SUBOPTIMAL) Sleeves infiltrieren erst ab Kampfwert 40 - der Raid-Vorrat verhungert, die Sleeves trainieren mit Schock 95 fuer fast nichts

- **Bot:** `sleeve.js:768` (`sleeveKampf >= KONTRAKT_MIN_KAMPF` umschliesst
  Vertraege UND Infiltrate), Ausloeser `:712-725` nur, wenn die LAUFENDE
  Aktion des Spielers eine Operation ist (`istAktion`).
- **Spiel:** Infiltrate ist statunabhaengig, fest 61 s
  (`SleeveInfiltrateWork.ts:16-28`), +k^-0,5/2 auf jede Art
  (`Bladeburner.ts:1251-1263`). Sleeve-Exp (auch Gym) x (100-Schock)/100
  (`Work.ts:17-25`, `SleeveClassWork.ts:32`); jeder Vertragsfehlschlag mit
  Schaden >= Sleeve-HP ist ein "Tod" mit Schock +0,5 (`Sleeve.ts:559-570`).
- **Messung BN2.1:** Sleeves 05:33-08:33 im Gym, Schock 98,4 -> 93,0, Kampf
  3 -> 38 (Exp-Faktor 0,02-0,07). Raid-Vorrat 07:33 und 08:33 bei 0,74 (leer),
  Spielerrangrate 08:33-09:33 nur 180/h. Ab 09:33 Vertraege: Schock 92,9 ->
  99,96 binnen einer Stunde. Wird Raid leer, faehrt der Spieler Retirement,
  `istAktion` ist dann ein Vertrag, und der Ausloeser greift nicht mehr - er
  sperrt genau dann, wenn der Vorrat leer ist.
- **Rechnung:** natuerliches Raid-Wachstum 2,1/480 s = 15,75/h, Spielerbedarf
  bei Arbeitsanteil 0,914 = 42,7/h; zwei Sleeves auf Infiltrate +41,7/h,
  drei +51/h. Vorratsbegrenzt in Sector-12: 15,75 x 8,12 + Rest Retirement
  1,18/min = ~175 Rang/h gegen ~347 Rang/h unbegrenzt -> **+~170 Rang/h**
  waehrend des Mangels (BN2.1 ~2,5 h = ~+430 Rang); mit BLADE-1 in Volhaven
  (EV 18,88) ~+400 Rang/h.
- **Fix-Skizze:** Infiltrate ohne Kampfwert-Tor; Ausloeser an "Vorrat der
  besten Operation" statt an der laufenden Aktion; zwei Sleeves genuegen
  (dritter: Vertraege oder Gym).
- **known_before:** Audit 26.09. 4#5 / D5 (Infiltrate gebaut, Tor und
  Ausloeser nicht betrachtet).

### BLADE-4 (P2, FEHLER) D4-Geldriegel rechnet mit einer falschen Obergrenze der Krankenhauskosten

- **Bot:** `blade.js:3591-3611`: "schlimmster Fall ... `hp.max *
  HOSPITAL_KOSTEN_JE_HP` - eine sichere Obergrenze (echte Kosten sind nie
  hoeher)"; `geldKnapp = geld*0,1 < hpMax*1e5`.
- **Spiel:** Schaden `hpLoss x diffMult` (`Bladeburner.ts:981-988`),
  `takeDamage` zieht ihn ab, BEVOR `hospitalize` die Kosten mit
  `(max - current) x 1e5` rechnet - `current` ist dann negativ
  (`PlayerObjectGeneralMethods.ts:266-284`, `Hospital.ts:4-10`). Kosten =
  min(10 % Geld, (max - hp + Schaden) x 1e5).
- **Rechnung:** Raid L5: Schaden ceil(50 x 8,296) = 415 HP -> 41,5 Mio statt
  <= 2,8 Mio (Faktor 15). Typhoon: 1.148 HP -> 114,8 Mio. Der Riegel greift
  erst unter 28 Mio Konto statt unter ~415 Mio. BN2.1: 132 Raid-Fehlschlaege
  = `moneyLost` 4,55 Mrd (`numHosp` 235, davon ~100 Sleeve-"Tode" mit je
  ~0,6 Mio Statistikwert ohne echte Abbuchung) gegen 9,38 Mrd Konto. Je
  Raid-Rang 4,4 Mio $ (Sector-12) bzw. 1,6 Mio $ (Volhaven).
- **Folge:** In geldarmen Phasen (nach Einbau, Knoten mit wenig Hackgeld wie
  BN14 ScriptHackMoney 0,3) frisst jeder Op-Fehlschlag 10 % des Kontos,
  waehrend der Bot den Fall fuer ausgeschlossen haelt.
- **needs_calc:** Wechselkurs Geld -> Rang in V2 (welche Aug haette das Geld
  gekauft, wieviel Chance bringt sie).

### BLADE-5 (P3, NICHT_GENUTZT) "Support main sleeve" statt Rekrutierung fuer den Black-Op-Trupp

- **Bot:** `sleeve.js:69-70` ("dieser Bot setzt keinen Sleeve auf Support"),
  Rekrutierer `:134-170, 754-767` (Charisma 2: 298 s je Versuch, Chance
  1,37/(n+1)).
- **Spiel:** Support macht teamSize sofort +1 (`SleeveSupportWork.ts:8-20`,
  `Bladeburner.ts:745-751`); Verluste treffen zuerst Menschen, Sleeves nur
  mit Schock +0,5, der Trupp faellt nie unter die Sleeve-Zahl
  (`TeamCasualties.ts:52-58`, `Sleeve.ts:559-570`). 3 Sleeves = 4^0,05 =
  +7,2 % ohne Wartezeit und ohne Nachrekrutieren nach jeder Op (min. 1 Toter,
  `BlackOperation.ts:63-65`).
- **Ertrag:** geschaetzt bis ~20 min je Black Op, bei der die Chance ohne
  Trupp knapp unter der Schwelle liegt (3 Mann bei Charisma 2: ~23 min).
  `blade.js` liest den Pool schon ueber `getTeamSize()` (`:2454`) - die
  Sleeves wuerden automatisch mitgezaehlt.

### BLADE-6 (P3, TOT) The Blade's Simulacrum: die Parallelarbeit wird nie genutzt

- **Bot:** Simulacrum nur als Graft-Riegel (`blade.js:3930-3960`); der
  Gym-Zweig stoppt die Bladeburner-Aktion (`:1451`), die Figurvergabe kennt
  nur einen Besitzer (`lib/figur.js:53-61`).
- **Spiel:** mit Simulacrum laufen Bladeburner und jede Arbeit gleichzeitig
  (`Bladeburner.ts:178-180, 1354`). Gym 10 exp/s je Wert (Powerhouse,
  `LocationsMetadata.ts:324-326`, `Work/Formulas.ts:108-121`) oder
  Faktionsarbeit liefen dann neben dem Rang.
- **needs_calc:** Kauf ist Sache von Progression (150 Mrd x Knotenfaktor x
  1,9^n, `Augmentations.ts:284-297`); hier: was BB+Gym parallel gegen BB allein
  je Stunde bringt.

### BLADE-7 (P3, SUBOPTIMAL) Gym-Zweig entscheidet mit der rohen Spanne und fester 0,85

- **Bot:** `blade.js:4008-4021` liest
  `getActionEstimatedSuccessChance(...)[0]` roh und prueft Operationen gegen
  SICHER_OPERATION 0,85; `waehle()` nutzt `spanneGenau` (D2) und bei
  ausreichendem Geld keine feste Op-Schwelle (D4, `:3611`) plus Notvertrag
  (`:3649-3655`).
- **Folge:** In Sector-12 (r 0,654) ist rohes s.min ~0,42 x wahre Chance;
  zwei Stellen entscheiden verschieden ueber dieselbe Lage. Heute rettet der
  Field-Analysis-Test (`:4076-4095`) den Fall zufaellig.
- **needs_calc:** Gym (10 exp/s) gegen Raid mit kleiner Chance in der Lage
  nach einem Einbau.

### BLADE-8 (P3, SUBOPTIMAL) Kammer oder Field Analysis haengt am Zustand - die offene BAUSTELLE ist so falsch

- **Formel:** Ausdauer bindet, wenn Verbrauch C > Regeneration R. Kammer
  besser als FA genau dann, wenn r_w x H/(C+H) > 0,2 x BBRank (r_w =
  Rang/min bei Arbeit, H = maxStamina/100 je min, `Bladeburner.ts:1197-1202`).
- **BN2.1:** Raid 6,32 x 0,843/2,683 = 1,99 > 0,2 -> Kammer +0,23 Rang/min
  besser; Retirement 0,41 > 0,2 -> Kammer +0,12 besser. Die Rechnung vom
  30.08. (Bounty Hunter p 0,44, ~0,4 Rang/min) lag unter der Grenze.
- **known_before:** BAUSTELLEN Zeile 1869 ("FA statt Kammer +80 %",
  unerledigt), Audit 26.09. 4#6. Neubewertung: fester Umbau auf FA waere
  jetzt ein Verlust; nur die Bedingung oben einbauen.

---

## Geprueft, in Ordnung (keine Befunde)

- **Black-Op-Fix 03.10.:** `blackOpChance`, `blackOpTruppLage`,
  `truppLageSetzen` liegen in `main`, Scope-Test gruen; Typhoon-Chance aus
  `blade.json` mit dem Nachbau auf 7e-5 gleich.
- **Aktionsstufe:** Raid L1 waere je Sekunde 3,7 % besser (Rangverlust und
  `ceil`), L5 aber je Vorratseinheit 14 % und je Ausdauer 7 % besser - bei
  bindendem Vorrat ist autoLevel richtig.
- **Overclock:** bei Ausdauerbindung wirkt 1 % Dauer nur ~0,31 % (Formel
  g(R+H)/(s+HT)); der Bot daempft staerker, die gierige Verteilung kauft
  Overclock in BN2.1 trotzdem nicht. Kein Befund.
- **Incite Violence:** +180 s Wachstum je Art (Raid +0,79, Assassination
  +0,39, Vertraege +1,5), Chaos aller Staedte ~0,7 -> ~21 -> ~52 - schon der
  zweite Lauf reisst die 50 ueberall, und er nimmt den Chaos-Spielraum, den
  BLADE-1 fuer Raid braucht. Seltener Einsatz ist richtig. Der Kommentar
  `blade.js:3665-3667` ("fuellt ALLE ... auf einen Schlag") ueberschaetzt die
  Wirkung, ohne Folgen fuer die Entscheidung.
- **Sleeve-Vertrag gegen FA:** Sleeves (Kampf 40, Schock ~100) 0,48-0,55
  Rang/min je Vertrag, FA 0,20 - Vertraege richtig; Wahl nach Vorrat statt
  Ertrag kostet nichts (alle drei gleichauf).
- **Hash-Tausch Skillpunkte:** die Skeptiker-Begruendung "gleiche Preise"
  ist falsch (eigene Stufe je Upgrade, `HashUpgrade.ts:71-81`), die
  Mischstrategie bringt aber nur +1,7 % (20.000 Hashes) bis +4,6 %
  (160.000) Hash-SP bei 100-200 Rang weniger (`blade-hashsp.mjs`). Kein Befund.
- **Bonuszeit:** BB baut gespeicherte Zyklen selbst ab (5 s je Tick,
  `Bladeburner.ts:1374-1378`); `blade.js` entscheidet je `nextUpdate` in
  Spielzeit, der Incite-Riegel misst in Spielzeit (`:4479-4489`). Die
  Wanduhr-Fristen (FA 45 min, Truppanfrage 5 min) betreffen nur seltene
  Zweige.
- **Faktionsbeitritt:** Einladung ab Rang 25 (`FactionInfo.tsx:708`),
  `bn4life.js:276-290` nimmt sie im 30-s-Takt an; BN2.1 05:33 Mitglied.

## Offene Fragen

- Wechselkurs Geld -> Rang in V2 (fuer BLADE-4 und Raid bei kleiner Chance).
- Lohnt in langen V2-Knoten eine Schockerholung der Sleeves (5,4/h statt
  1,83/h) vor dem Gym, oder bleiben sie dauerhaft auf statunabhaengigen
  Aufgaben (Infiltrate, Support, FA)?
- Wird das Simulacrum in V2 je gekauft (Progression)? Nur dann lohnt BLADE-6.
- BN13: Stanek-Fragment Bladeburner (+Chance/Ausdauer) ungenutzt - Bereich
  Nebensysteme.
