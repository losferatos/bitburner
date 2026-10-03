# Audit "vollstaendig" 03.10.2026 - Bereich SING

Singularity-Rest, Base-API-Rest, RAM-Kosten/SF4, Orchestrierung, Sprung
(`destroyW0r1dD43m0n`), Ausgang. Pruefer SING (zweiter Lauf, der erste brach
am Nutzungslimit ab), 03.10.2026 17:42 Systemzeit. Streng lesend: `src/`
unveraendert (master 0cc5a80), Spiel nicht angefasst, nichts committet.
Spielquellcode 3.0.2 (`reference/bitburner-src/src/`), Vergleich 3.0.1
(`reference/v301/src/`). Spielstaende `backups/*BN2L1*` (03.10. 03:33 - 15:17
UTC, BN2.1, 12,6 h im Knoten) plus die Sprungstaende BN9L2 ... BN12L3.

Nicht wiederholt (stehen in anderen Berichten): Fokus/Faktionsarbeit (FAKT,
A1), Krankenhaus/Kammer (BLADE-4), Graft/NMI (AUG), Export-Bonus (PLAYER),
Portprogramme/home-Ausbau/createProgram (INFRA), Hacking-Maschine (HACK).

## Kurzfazit

- **Sprung und Ausgang sind gesund.** Beide Tueren (21 Black Ops ODER
  w0r1d_d43m0n) sind gebaut, gegen die Route geprueft und live belegt
  (V2: BN9L2->L3, BN9L3->BN1; V1: BN12L3->BN2 heute 02:41 UTC, Rueckruf
  `boot.js` nach 1,0 min, alle Werkzeuge nach 1,5 min).
- **Grosse Luecke: Intelligenz.** Der Terminalbefehl `hack` gibt je Erfolg
  `4*log10(exp)` Int-Erfahrung (`Terminal/commands/hack.ts:78-80`), das
  Singularity-`manualHack` nur 0,005 (`NetscriptHelpers.tsx:658`). Gerechnet:
  **14.744 Int-exp/h** auf dem Ofenziel joesguns gegen **17,7/h** passiv heute
  - Faktor 830. Int ist dauerhaft (SF5) und hebt die Bladeburner-Rangrate der
  besten Aktion um **+4,7 % nach 10 h, +12,3 % nach 100 h** Farmbetrieb
  (geeichte BLADE-Formeln). Der Bot nutzt es nicht (SING-1).
- Zwei Telemetriefehler im Sprungumfeld: `jump_latency_min` steht seit 07:46
  auf **305,56 min** statt 1,01 (SING-2); die V2-Restzeit in `ausgang.json`
  heisst "untere Schranke", ist aber um Faktor ~100 zu lang (SING-3).
- `manualHack`/`connect` als Int-Quelle: nein (4,4 bzw. 0 Int-exp/h).
  `getMoneySources` fuer Telemetrie: nicht noetig, die stuendlichen
  Sicherungen tragen `moneySourceA/B`. SF4.3 macht Singularity in allen
  Restknoten x1 - keine RAM-Falle mehr.

## Rechner und Eichung

| Rechner | Was | Eichung Soll | Eichung Ist |
|---|---|---|---|
| `tools/audit/sing-int.mjs` E1 | Int-Stufe aus Int-Exp (`PersonObjects/formulas/skill.ts:7-15`, mult 1, `Person.ts:185-188`) | `skills.intelligence` in allen 10 BN2L1-Staenden (153) | 153, max. Abweichung 0 |
| `sing-int.mjs` E2 | `calculateHackingTime` (`Hacking.ts:60-79`) | `ns.getWeakenTime` = 4 x hackTime, als `args[3]` in den laufenden `worker/weaken.js` (Stand 17:17), joesguns auf Mindestsicherheit 5: **16.490 ms** | **16.489,5 ms** (0,5 ms, Rundung) |
| `sing-int.mjs` E3 | Typhoon-Chance ueber `blade-formeln.mjs` (BLADE, dort an 8 Staenden geeicht) | `data/blade.json` boChancen Stand 17:17: **0,1019** | **0,1019** |
| `sing-int.mjs` | Terminal-hack Int/s je Ziel, manualHack Int/s, Restroute je Knoten, Rang/min gegen Int | - (Int je Terminal-hack nie beobachtet: der Bot hat ihn nie ausgefuehrt) | siehe unten |
| `tools/audit/sing-undef.mjs` | unaufgeloeste Namen ohne Deklaration in der Datei (Tippfehler, vergessener Import - die Luecke neben `test-scope-tot.js`) | Selbstprobe: vergessener Import MUSS gefunden werden | gefunden (`liesVonHome:3`); `src/`: **0 Funde in 140 Dateien** |
| `tools/audit/sing-save.mjs` | Kennwerte je Spielstand (Int, Export-Bonus, Fokus, Faktionen, Geldquellen), Textdateien von home (`--txt`) | - | Mitgliedschaft jetzt aus `player.factions` (vorher immer 0) |

Die Kette fuer SING-1: Int-Stufe (E1), Hackzeit (E2) und Bladeburner-Chance
(E3) sind geeicht. Die Int-Menge je Terminal-hack ist direkt aus dem
Quelltext uebernommen, aber ungeeicht - es gibt keinen beobachteten Wert.
Deshalb `GERECHNET_UNGEEICHT`.

---

## Tabelle 1 - Feature-Inventar aus dem Quellcode

Pfade relativ zu `reference/bitburner-src/src/`. "alle" = alle Knoten der
Restroute (BN2, 3, 11, 6, 7, 14, 13, 15, 8); Singularity braucht SF4 (4.3
vorhanden), `getBitNodeMultipliers` SF5 (5.3 vorhanden).

| # | Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag/Hebel |
|---|---|---|---|---|
| S1 | `getOwnedSourceFiles` | `NetscriptFunctions/Singularity.ts:93-99`, 5 GB (`Netscript/RamCostGenerator.ts:202`) | alle | SF-Stand; gleichwertig `getResetInfo().ownedSF` fuer 1 GB |
| S2 | `getCurrentServer` | `Singularity.ts:460-465` | alle | Terminalstandort |
| S3 | `connect` | `Singularity.ts:472-485`, `Server/ServerHelpers.ts:265-288` (nur Nachbar, Backdoor oder eigener Rechner) | alle | Voraussetzung fuer `installBackdoor`/`manualHack`, setzt den Terminalstandort; keine Int-Erfahrung |
| S4 | `cat` | `Singularity.ts:466-471` | alle | kein Ertrag |
| S5 | `manualHack` | `Singularity.ts:486-490`, `Netscript/NetscriptHelpers.tsx:590-676` | alle | volle Hackzeit, Int +0,005 je Erfolg (`:658`), Geld x ManualHackMoney (BN8: 0), setzt bei Erfolg die Backdoor (`:671-676`) |
| S6 | `installBackdoor` | `Singularity.ts:491-532` (Dauer hackTime/4, `:498`) | alle | Faktionseinladungen (`Faction/FactionJoinCondition.ts:48-55`), 10 % Rabatt auf Kurse/Gym des Ortes (`Work/Formulas.ts:103`), direkte Verbindung (`ServerHelpers.ts:276`); auf w0r1d_d43m0n: BitVerse-Seite statt Sprung (`:525-527`) |
| S7 | `isFocused` / `setFocus` | `Singularity.ts:533-553`; Strafe x0,8 `PersonObjects/Player/PlayerObjectGeneralMethods.ts:622-628` | alle | Fokus nur fuer Faktion/Firma/Crime/Programm/Graft (`Work/*.ts focusPenalty`); **ClassWork (Gym) ohne Strafe**, Bladeburner ist keine Arbeit |
| S8 | `hospitalize` | `Singularity.ts:554-557` | V2 | HP voll gegen Geld (BLADE) |
| S9 | `isBusy` | `Singularity.ts:558-561` | alle | true auch auf Infiltration- und BitVerse-Seite |
| S10 | `stopAction` | `Singularity.ts:562-567` | alle | Arbeit beenden (`finishWork(true)`) |
| S11 | `goToLocation` / `travelToCity` Int | `Singularity.ts:213-234, 374-395` | alle | Int +3e-5 je Aufruf - nichts |
| S12 | `b1tflum3` | `Singularity.ts:1106-1123` | alle | Knotenwechsel OHNE Source-File - nie (Auftrag: nicht anfassen) |
| S13 | `destroyW0r1dD43m0n(nextBN, cb, opts)` | `Singularity.ts:1124-1176`; `RedPill.tsx:52-97`; `Prestige.ts:200-361` | alle | Knoten abschliessen, SF +1, Folgeknoten betreten; Tuer A: Hacking >= requiredHackingSkill UND Root (`:1148-1153`), Tuer B: `numBlackOpsComplete >= 21` (`:1154-1160`), ODER-Pruefung `:1161`; ohne nextBN -> BitVerse-Seite (`:1168-1171`, neu in 3.0.2) |
| S14 | Rueckrufskript nach Reset | `Singularity.ts:59-76` (nur home, nur wenn RAM frei, 1 Faden, ohne Argumente), `:1173-1175` (500 ms) | alle | einziger Weg, im neuen Knoten etwas zu starten |
| S15 | `getCurrentWork` | `Singularity.ts:1177-1181` (0,5 GB) | alle | Arbeitslage |
| S16 | `getSaveData` | `Singularity.ts:1182-1192` (1 GB) | alle | Spielstand als Bytes im Skript - kein Weg auf die Platte ausser ueber eine Spieldatei |
| S17 | `exportGame` / `hasExportGameBonus` | `Singularity.ts:1193-1204`, `ExportBonus.tsx` | alle | Bereich PLAYER |
| S18 | `getUnlockedAchievements` | `Singularity.ts:1205-1208` | alle | keine Spielwirkung |
| S19 | `installAugmentations(cb)` / `softReset(cb)` Rueckruf | `Singularity.ts:185-211` | alle | wie S14 nach Einbau |
| B1 | `getResetInfo` | `NetscriptFunctions.ts:1440-1454` (1 GB, `RamCostGenerator.ts:664`) | alle | Knoten, Resets, ownedSF, ownedAugs, bitNodeOptions |
| B2 | `getBitNodeMultipliers(n, lvl)` | `NetscriptFunctions.ts:874-885` (4 GB `RamCostGenerator.ts:616`, SF5) | alle | Mults JEDES Knotens und jeder Stufe, nicht nur des aktuellen |
| B3 | `getMoneySources` | `NetscriptFunctions.ts:1391-1394` (1 GB, `RamCostGenerator.ts:662`) | alle | Geldquellen seit Einbau/Knoten (dieselben Felder wie `moneySourceA/B` im Spielstand) |
| B4 | `getPlayer` | `NetscriptFunctions.ts:1371-1390` (0,5 GB) | alle | Werte, Mults, Faktionen |
| B5 | `getRunningScript` / `self` | `NetscriptFunctions.ts:1192-1201, 655` | alle | Prozessdaten |
| B6 | `ramOverride` | `NetscriptFunctions.ts:1202-1224` (0 GB) | alle | eigene RAM-Reservierung zur Laufzeit senken, nie unter den schon dynamisch verbrauchten Wert |
| B7 | `getFunctionRamCost` | `NetscriptFunctions.ts:1455-1461` (0 GB) | alle | RAM je Funktion im laufenden Spiel abfragen |
| B8 | `flags`, `atExit` | `NetscriptFunctions.ts:1479, 1395-1399` (0 GB) | alle | Komfort / Aufraeumen |
| B9 | `ns.ui.*` (alias, renderPage, getGameInfo ...) | `NetscriptFunctions/UserInterface.tsx:42-288` (0 GB, `createConnectLink` 5 GB) | alle | Oberflaeche; `alias` kann eine Befehlskette unter einem Namen ablegen |
| B10 | `serverExists` / Hostauflosung | `NetscriptFunctions.ts:1009-1013`, `NetscriptHelpers.tsx:554-570` | alle | ein Server ohne Netzanschluss (w0r1d_d43m0n vor Red Pill) existiert fuer jede ns-Funktion nicht -> kein Root vor Red Pill |
| R1 | SF4-Rabatt | `RamCostGenerator.ts:82-96` | alle | SF4.3: Faktor 1 (BN4 nicht mehr auf der Route) |
| R2 | RAM-Neuberechnung beim Sprung | `Prestige.ts:232-233` | alle | wegen SF4-Abhaengigkeit; bei SF4.3 ohne Wirkung |
| I1 | **Terminalbefehl `hack`** | `Terminal/commands/hack.ts:38-99` (Dauer hackTime/4, Int `4*log10(exp)` je Erfolg bei exp > 1), Kette `Terminal/Terminal.ts:288-320` (3.0.2 wartet je Aktion, 3.0.1 nicht: `v301/src/Terminal/Terminal.ts:681-693`), Aktion als setTimeout `:176-209`, nur Strg+C/Prestige brechen ab (`:316, 329`, `Terminal/ui/TerminalInput.tsx:215-216, 247`) | alle (Int braucht SF5: `Person.ts:185`) | **bis 16.489 Int-exp/h** (BN2-Stand), auf w0r1d_d43m0n BitVerse-Seite (`hack.ts:48-51`) |
| I2 | Int dauerhaft | `Person.ts:149-190` (persistentIntelligenceData), `PlayerObjectGeneralMethods.ts:138-140` | alle | Int bleibt ueber Einbau und Sprung |
| I3 | Int aus Singularity-Aufrufen | `Singularity.ts:182, 207` (je 15), `:766` (7,5), `:587, 621` (3), `:412, 452, 232, 390` (<0,01) | alle | klein: 100 Augkaeufe = 1.500 Int-exp |
| I4 | Int aus Aktionen | Bladeburner `Bladeburner.ts:719-729` (BaseIntGain 0,003, `data/Constants.ts:34`), Programm `Work/CreateProgramWork.ts:76-81` (0,1/s), Graft `Work/GraftingWork.tsx:85-90`, Knotenabschluss +300 (`Prestige.ts:353-356`, nur mit SF5 und nicht per flume) | alle | gemessen 17,7 Int-exp/h im BN2-Betrieb |
| I5 | Int-Wirkung | `PersonObjects/formulas/intelligence.ts:1-3`; Hackchance/-zeit `Hacking.ts:22, 77`; Bladeburner-Kompetenz `Bladeburner/Actions/Action.ts:172-175` (Gewicht + Bonus 0,75); Field Analysis `Bladeburner.ts:1124-1128`; share Gewicht 2 (`NetworkShare/Share.ts`) | alle | siehe SING-1 |
| J1 | Knoteneintritt | `Prestige.ts:241-249` (home 128 GB bei SF9>=2, 1 Kern), `:293-295` (BN8 250 Mio $), `:341-343` (BN13 200.000 $), `RedPill.tsx:91-95` (BN6: Cinematic-Seite), `Prestige.ts:346-351` (BN15: Darknet-Handbuch) | Sprung | Kaltstartlage |
| J2 | `bitNodeOptions` | `BitNode/BitNodeUtils.ts:30-82`, `RedPill.tsx:71-78` | Sprung | nur Einschraenkungen/Overrides, KEIN Mehrertrag (SF wird unbedingt vergeben, `RedPill.tsx:65-67`) |
| O1 | Autoexec beim Laden | Spieleinstellung `AutoexecScript` (Audit 26.09. #6) | alle | boot.js laeuft bei JEDEM Seitenladen, nicht nur nach Reset |
| O2 | Prestige toetet alle Skripte | `RedPill.tsx:62`, `Prestige.ts:203` | Sprung, Einbau | Rueckruf (S14) ist Pflicht |

## Tabelle 2 - Abdeckungsmatrix

| # | Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil |
|---|---|---|---|---|---|
| S1 | getOwnedSourceFiles | - (stattdessen `getResetInfo().ownedSF`, `src/ausgang.js:203-206`, `src/exit.js:80-82`) | alle | OPTIMAL | 1 GB statt 5 GB, gleicher Inhalt (`Singularity.ts:93-99` = `NetscriptFunctions.ts:1445-1449`) |
| S2 | getCurrentServer | `src/bn4door.js:130` | Aufbau | OPTIMAL | Erfolgspruefung nach connect |
| S3 | connect | `src/bn4door.js:124-131, 138, 167` | Aufbau | OPTIMAL | Pfad per BFS, danach immer zurueck nach home; als Int-Quelle wertlos (kein Int-Aufruf in `ServerHelpers.ts:265-288`) |
| S4 | cat | - | - | NICHT ANWENDBAR | kein Ertrag |
| S5 | manualHack | - | - | NICHT ANWENDBAR | 4,4 Int-exp/h je Skript (joesguns) gegen 14.744 Int-exp/h Terminal-hack; als RAM-Variante in SING-1 |
| S6 | installBackdoor | `src/bn4door.js:69-71, 137`; WD gesperrt `:63-71`, `src/backdoor.js:31-34` | alle, ab Knotenanfang | OPTIMAL | 11 Ziele, w0r1d_d43m0n ausgenommen (F1, d4439a7); kostet keine Spielerzeit |
| S7 | isFocused/setFocus | `src/bn4rep.js:2563-2571`, `src/lib/einbau.js:373-404` | V1 (+ V2-Faktionsarbeit) | OPTIMAL | Bereich FAKT/A1; Gym (ClassWork) braucht keinen Fokus - richtig, dass bbtrain nicht fokussiert |
| S8 | hospitalize | `src/blade.js:4349-4367` | V2 | OPTIMAL | BLADE (BLADE-4 betrifft den Geldriegel, nicht den Aufruf) |
| S9 | isBusy | - (stattdessen getCurrentWork) | - | NICHT ANWENDBAR | getCurrentWork liefert mehr |
| S10 | stopAction | `src/bbtrain.js:285, 348`, `src/joinrun.js:167, 289` | V2-Training, Beitritt | OPTIMAL | Graft-Schutz vorhanden (`bbtrain.js:298, 348`) |
| S11 | goToLocation/travel Int | `src/exploit3.js:80, 100` (Einmalwerkzeug) | - | NICHT ANWENDBAR | Int 3e-5 je Aufruf |
| S12 | b1tflum3 | - | - | NICHT ANWENDBAR | gibt kein SF; nicht anfassen |
| S13 | destroyW0r1dD43m0n | `src/exit.js:137` (Black Ops), `:188` (Hacking); Ziel gegen Route `:70-94`, `src/lib/route.js` (planeRoute/zielErlaubt); Tuer-Erkennung `src/ausgang.js:249-278` | Sprung | OPTIMAL | nextBN immer gesetzt (sonst BitVerse, `Singularity.ts:1168-1171`), keine Optionen (= Standard), live belegt BN9L2->L3, BN9L3->BN1 (V2), BN12L3->BN2 (V1) |
| S14 | Rueckruf boot.js | `src/exit.js:129-133, 180-184` (boot.js muss auf home liegen), `src/boot.js` | Sprung, Kaltstart | OPTIMAL | BN12L3->BN2: jump 02:41:23, boot 02:42:24 UTC (davon 58 s Handschlag), Kern + 17 Werkzeuge bis 04:43:54 Ortszeit (`data/bn4net-log.txt` im Stand 05:33) |
| S15 | getCurrentWork | 18 Aufrufe, z. B. `src/blade.js:294`, `src/bbtrain.js:150, 283, 295` | alle | OPTIMAL | - |
| S16 | getSaveData | - | - | NICHT ANWENDBAR | Sicherung laeuft ueber Bruecke bzw. `exportGame`-Rueckfall (`src/export.js:224`); Bytes im Skript kommen nicht auf die Platte |
| S17 | exportGame | `src/export.js:224` | alle | (PLAYER) | nicht hier bewertet |
| S18 | getUnlockedAchievements | - | - | NICHT ANWENDBAR | keine Spielwirkung |
| S19 | installAugmentations("boot.js") | `src/bn4rep.js:1722`, `src/punish.js:415` | Einbau | OPTIMAL | Rueckruf gesetzt |
| B1 | getResetInfo | `src/ausgang.js:203`, `src/exit.js:80`, `src/bn4net.js:4732`, `src/boot.js:160` | alle | OPTIMAL | - |
| B2 | getBitNodeMultipliers | `src/blade.js:803`, `src/bn4rep.js:207, 653`, `src/joinrun.js:80` | alle | OPTIMAL | sonst statische `src/lib/bitnodes.json` (Audit 26.09. B6) |
| B3 | getMoneySources | `src/geld.js:29` (Handwerkzeug) | - | NICHT ANWENDBAR | stuendliche Sicherungen tragen `moneySourceA/B` (`tools/audit/sing-save.mjs`); kein Steuersignal haengt daran |
| B4 | getPlayer | viele, z. B. `src/exit.js:147` | alle | OPTIMAL | - |
| B5 | getRunningScript | - | - | NICHT ANWENDBAR | ps/isRunning genuegen |
| B6 | ramOverride | - | - | NICHT ANWENDBAR | blade.js (100,35 GB) lief nach dem Sprung nach 1,5 min auf I.I.I.I; home 4 TB im BN2-Stand - RAM der Werkzeuge ist kein Engpass |
| B7 | getFunctionRamCost | - | - | NICHT ANWENDBAR | nur Werkzeugkette (Audit 26.09. I#7 test-ram) |
| B8 | flags/atExit | `src/hacktimer.js:251`, `src/geld.js:25` | - | OPTIMAL | - |
| B9 | ns.ui | Fenster in Altwerkzeugen | - | NICHT ANWENDBAR | `ui.alias` waere fuer SING-1 nuetzlich |
| B10 | serverExists-Semantik | `src/ausgang.js:255`, `src/exit.js:141` | Ausgang | OPTIMAL | "am Netz" = existiert fuer ns (`NetscriptHelpers.tsx:557-562`) - Kommentar `exit.js:18-21` stimmt |
| R1 | SF4-Rabatt | Registry-Formel `src/lib/reg.js:251-259` | alle | GENUTZT-SUBOPTIMAL | bekannt 26.09. 6#10: `(Map)[4]` ist undefined -> Faktor 16 in `wartetGb`; nur Telemetrie, nichts Neues |
| R2 | RAM-Neuberechnung | - | Sprung | NICHT ANWENDBAR | SF4.3: unveraendert |
| I1 | Terminal-hack (Int) | - | - | **NICHT GENUTZT** | **SING-1** |
| I2 | Int dauerhaft | - (passiv) | alle | NICHT ANWENDBAR | - |
| I3 | Int aus Singularity | passiv ueber Kaeufe/Einbauten | alle | NICHT ANWENDBAR | 15 je Augkauf, gegen SING-1 vernachlaessigbar |
| I4 | Int aus Aktionen | passiv (Bladeburner, Einbau) | alle | NICHT ANWENDBAR | 17,7/h gemessen; createProgram 360/h bindet die Figur (INFRA) |
| I5 | Int-Wirkung | `src/lib/calc.js` (Hackchance/-zeit mit Int), BLADE-Formeln im Bot | alle | OPTIMAL | Int wird gelesen, nur nicht vermehrt |
| J1 | Knoteneintritt | `src/boot.js:52-171`, `src/popups.js:135-160` (Cinematic "Continue"), Dialoge per Escape | Sprung | OPTIMAL | BN6-Cinematic und Eintrittsdialoge (BN13, BN15) werden abgeraeumt |
| J2 | bitNodeOptions | `src/ausgang.js:209-214` (nur Hinweis) | Sprung | NICHT ANWENDBAR | kein Ertrag moeglich |
| O1 | boot.js bei jedem Laden | `src/boot.js:52-53, 128-147` | alle | GENUTZT-SUBOPTIMAL | bekannt E5; neuer Beleg 15:16 UTC: Seitenladen meldet "Wiederanlauf im neuen BitNode" und loescht rep-modus/geldbedarf/preise/kaufauftrag/kaufergebnis/contracts. Gegenprobe: die 18,16 Mrd $ der Folgeminute gingen in Augs (Warteschlange 7 -> 11), nicht in Rechner - kein Schaden belegt |
| O2 | Prestige-Kill | `src/boot.js` + exit/bn4rep-Rueckruf | Sprung, Einbau | OPTIMAL | - |
| A1 | Ausgang-Takt | `src/ausgang.js:192-905` (60 s, Handschlag <= 90 s, Wirtwahl Hacknet zuerst) | Endspiel | OPTIMAL | Tuer offen -> Sprung in <= 2,5 min |
| A2 | V2-Restzeit | `src/ausgang.js:333-370`, `src/lib/eta.js:182-203` | V2 | GENUTZT-SUBOPTIMAL | **SING-3** (nur Telemetrie) |
| A3 | Sprunglatenz-Kennzahl | `src/bn4net.js:4733-4767` | Sprung | GENUTZT-SUBOPTIMAL | **SING-2** (nur Telemetrie) |

Zaehlung (43 Zeilen): OPTIMAL 20, GENUTZT-SUBOPTIMAL 4 (R1, O1, A2, A3),
NICHT GENUTZT 1 (I1), GENUTZT-TOT 0, NICHT ANWENDBAR 17, ausserhalb (PLAYER) 1.

---

## Befunde

### SING-1 (NICHT_GENUTZT, P1) Int-Erfahrung ueber den Terminalbefehl `hack` - 830-fache Int-Rate, dauerhaft

- **Spiel:** `Terminal/commands/hack.ts:38-80`: Dauer `calculateHackingTime/4`,
  bei Erfolg `Player.gainIntelligenceExp(4 * Math.log10(expGainedOnSuccess))`
  (nur exp > 1; Geld 0 -> exp/4, `:66-68`). Dagegen `manualHack`
  (`NetscriptHelpers.tsx:614-658`): volle Hackzeit, Int **0,005** je Erfolg.
  Int ist dauerhaft (`Person.ts:185-188`, persistentIntelligenceData) und
  wirkt auf Hackzeit/-chance (`Hacking.ts:22, 77`), Bladeburner-Kompetenz
  (`Action.ts:172-175`: Gewicht `intelligence` je Aktion plus Faktor
  `1 + 0,75*int^0,8/600`), share (Gewicht 2), Graftzeit, Crime-Chance.
- **Warum es im Betrieb geht (3.0.2):** `Terminal.executeCommands` wartet je
  Befehl auf das Ende der Aktion (`Terminal/Terminal.ts:300-307`) - eine
  einzige Eingabe `connect joesguns; hack; hack; ...` laeuft also
  hintereinander ab. Die Aktion ist ein `setTimeout` (`:176-209`), abgebrochen
  wird nur per Strg+C (`TerminalInput.tsx:215-216`) oder Prestige
  (`Terminal.ts:329`) - **ein Seitenwechsel bricht die Kette nicht ab**. Die
  Eingabe selbst braucht kurz die Terminalseite; der Bot kann das schon
  (`src/darkweb.js:219-230`, `globalThis["document"]` kostet 0 GB wie in
  `src/popups.js`). Bladeburner ist keine `currentWork` und laeuft unabhaengig
  von der Seite (Spielstand 09:33: Raid laeuft, `currentWork` null,
  `focus` false; Pause nur bei echter Arbeit, `Bladeburner.ts:1353-1354`); Gym (ClassWork) hat keine Fokusstrafe - in V2 kostet die
  Terminalseite also nichts. In 3.0.1 (`v301/src/Terminal/Terminal.ts:681-693`)
  wartet die Kette nicht; dann je Befehl eine Eingabe (Overhead geschaetzt
  +25 % Zeit je hack). Welche Version laeuft, klaert der VERSION-Pruefer
  (`VersionSave` 51 in beiden).
- **Bot:** nutzt weder Terminal-hack noch manualHack (grep `manualHack`,
  `"hack"`-Terminaleingaben: 0). Int waechst nur passiv.
- **Gerechnet (`sing-int.mjs`, Stand 17:17, hacking 408, Int 153,
  hacking_speed/exp 1,514):**

  | Ziel | t je hack | Int je hack | Int-exp/h |
  |---|---|---|---|
  | foodnstuff (Sicherheit 3) | 0,837 s | 3,83 | 16.489 |
  | **joesguns (Ofenziel, Geld wird nachgewachsen)** | 1,031 s | 4,22 | **14.744** |
  | joesguns mit Geld 0 (exp/4) | 1,031 s | 1,79 | 6.331 |
  | manualHack auf joesguns, je Skript | 4,12 s | 0,005 | 4,4 |
  | heute passiv (BN2L1, 11,7 h Spielzeit) | - | - | **17,7** |
  | heute passiv ueber alle Sicherungen (712 h) | - | - | 69,1 |

  Restroute, gleicher Spielerstand (Knotenmults `BitNode/BitNode.tsx`
  Zeilen 595, 690-703, 724-737, 885-899, 993-1016, 1044-1054, 1087-1098):
  BN2/3 16.489, BN11 8.791, BN6/7 3.844, BN14 2.991 (HackingSpeed 0,3),
  BN13 1.667 (HackExpGain 0,1), BN15 8.385, BN8 20.162 Int-exp/h.
  Nach jedem Sprung beginnt das Hacklevel bei 1 - die Rate steigt mit der
  Hacking-Rampe des Kerns (erste Stunden kleiner).
- **Wert (Rang/min der besten Aktion, Dauerrate mit Ausdauer und Kammer,
  geeichte BLADE-Formeln, sonst Spielstand 17:17):**

  | Farmdauer | Int | Kampfwerte heute | Kampfwerte x3 |
  |---|---|---|---|
  | 0 | 153 | 16,78 Rang/min | 44,50 |
  | 10 h | 192 | x1,047 | x1,028 |
  | 50 h | 235 | x1,099 | x1,058 |
  | 100 h | 255 | x1,123 | x1,072 |
  | 300 h | 290 | x1,164 | x1,096 |

  Dazu Hackzeit x1,017 (10 h) bis x1,056 (300 h), share x1,03 bis x1,10.
  Kampfwerte am Ende der bisherigen V2-Laeufe lagen bei 200-570
  (`bn67-kurven.mjs`), also x1 bis x3 von heute - der Gewinn gilt den
  groessten Teil eines V2-Knotens, solange die Chancen unter 1 liegen.
- **Ertrag gegen die beste Alternative (passiv):** V2-Laeufe dauerten 46-106 h
  (BN4L2 45,9; BN9L3 53,6; BN9L2 81,7; BN10L3 91,8; BN9L1 100,8; BN10L2
  105,9 - `bn67-kurven.mjs`). Bei +5 bis +12 % Rangrate in der
  chancebegrenzten Haelfte eines Knotens sind das **2-4 h je V2-Lauf, 45-100 h
  ueber die 24 V2-Laeufe der Restroute** (GESCHAETZT fuer die Uebersetzung in
  Stunden; der Faktor je Int-Stand ist gerechnet). Weil Int bleibt, startet
  jeder spaetere Knoten schon mit Int 250-330.
- **Alternative ohne DOM:** viele 1-Faden-Skripte mit `manualHack`
  (1,6 + 2 GB = 3,6 GB je Skript bei SF4.3): 1.240 Int-exp/h je TB, also
  ~12 TB fuer die Rate EINES Terminals, plus Sicherheitsanstieg 0,002 je
  Erfolg (weaken noetig) und `Engine.checkCounters()` je Erfolg
  (`NetscriptHelpers.tsx:671-676`). Nur als Zusatz, wenn Speicher brachliegt.
- **Fallen beim Bau:** (1) nie auf w0r1d_d43m0n (`hack.ts:48-51` - dieselbe
  BitVerse-Falle wie F1); (2) `bn4door.js:124-138` verbindet das Terminal
  woanders hin und zurueck nach home - danach endet die Kette mit
  "Cannot hack your own machines" (harmlos, neu ansetzen); (3) Eingabe ist
  gesperrt, solange eine Aktion laeuft (`TerminalInput.tsx:442`) - erst
  nach Kettenende neu tippen; (4) `darkweb.js` tippt ebenfalls ins Terminal;
  (5) in V1 kurz Fokus verlieren, `bn4rep.js:2563-2571` holt ihn zurueck
  (Strafe x0,8 fuer Sekunden); (6) versteckter Tab drosselt auch diese
  Timer (wie die Engine selbst - `wakelock.js`/`hacktimer.js`-Thema).
- **Fix-Skizze:** kleines Gewerk `intfarm.js` (0 GB DOM ueber
  `globalThis["document"]`, Registry "alle"), alle 60 s: laeuft keine
  Terminalaktion und ist die Figur nicht im V1-Rufmodus kritisch -> Terminal
  oeffnen, `home; connect <expZiel>; hack; ... (N = 1.800, ~30 min)` absenden,
  Fokus zuruecklassen. Ziel aus `data/bn4net.json` `expZiel`, nie
  w0r1d_d43m0n. Telemetrie: Int-exp je Stunde (`ns.getPlayer().exp.intelligence`).
  Skeptiker Pflicht (laeuft unbeaufsichtigt, DOM).

### SING-2 (FEHLER, P3) `jump_latency_min` wird von jedem Kernneustart binnen 6 h nach dem Sprung ueberschrieben

- **Bot:** `src/bn4net.js:4733-4767` friert die Kennzahl beim ersten Boot
  JEDES Prozesslebens ein und misst gegen den letzten `jump`, solange er
  weniger als 6 h zurueckliegt. Der Kommentar `:4744-4753` (Skeptiker R13)
  wollte genau das verhindern, die 6-h-Klausel laesst es wieder zu.
- **Beleg:** Ereignisstrom im Stand 17:17: `jump` 02:41:23 UTC, `boot`
  02:42:24 (echte Latenz **1,01 min**, so in `kpi.json` des Stands 05:33),
  Kernneustart beim Einspielen 07:46:57 -> `kpi.json` seit 07:46 und bis
  jetzt **305,56 min** = 07:46:57 - 02:41:23. `tools/checkin.js:761` zeigt
  das als "Sprung 305,6 min" (Soll <= 2).
- **Spiel:** Ein Sprung toetet alle Skripte (`RedPill.tsx:62`), der Rueckruf
  kommt nach 500 ms (`Singularity.ts:1173-1175`) - der erste Boot nach dem
  Sprung liegt also immer binnen Sekunden bis Minuten nach `lastNodeReset`.
- **Fix:** Nur messen, wenn `bootWall - lastNodeReset < 5 min` (derselbe
  Test wie `boot.js:160`) oder wenn zwischen dem `jump` und jetzt kein
  anderes `boot` im Strom steht. Steuert nichts, verfaelscht nur den /bb.

### SING-3 (FEHLER, P3) V2-Restzeit in `ausgang.json` heisst "untere Schranke", ist aber eine Ueberschaetzung um Faktor ~100

- **Bot:** `src/ausgang.js:333-370` schreibt fuer den Bladeburner-Weg eine
  lineare Fortschreibung der juengsten Rangrate (`lib/eta.js:182-203`) gegen
  `lib/blackops.json hoechsterRang` und begruendet "IMMER zu kurz ... UNTERE
  Schranke" (`:349-354, 364-367`).
- **Beleg:** Stand 17:17: `eta_min` **397.830 min = 6.630 h** bei Rang 2.191
  nach 12,6 h. Die bisherigen V2-Laeufe brauchten 46-106 h insgesamt
  (`bn67-kurven.mjs`). Die Rangrate waechst im Lauf um Faktoren 100-5.000
  (Gedaechtnis "bitburner-eta-lehre", 04.09.: in `checkin.js` behoben, in
  `ausgang.js` nicht) - die Fortschreibung ist eine OBERE Schranke.
- **Folge heute:** keine Steuerung, weil `eta_sicher` im V2 immer false ist
  und `lib/endspurt.js:140-147` sowie `lib/graftwahl.js:176-177` unsichere
  Werte ignorieren. Risiko: wer den Kommentar glaubt und die Zahl als
  "mindestens so lange" verwendet (z. B. fuer langfristige Kaeufe kurz vor
  dem Ausgang), entscheidet falsch herum.
- **Fix:** Kommentar und `eta_quelle` auf "obere Schranke, unbrauchbar"
  korrigieren oder die V2-Restzeit aus der Referenzkurve vorheriger Laeufe
  schaetzen (wie in `tools/checkin.js`).

---

## Antworten auf das "Besondere Augenmerk"

- **manualHack/connect als Int-Quelle?** `connect`: 0 (`ServerHelpers.ts`,
  `Terminal.connectToServer` ohne Int). `manualHack`: 0,005 je Erfolg =
  4,4 Int-exp/h je Skript - nur ueber Tausende Skripte relevant. Die echte
  Quelle ist der Terminalbefehl `hack` (SING-1).
- **getMoneySources fuer Telemetrie?** Nicht noetig. Die Sicherungen tragen
  die identischen Felder stuendlich (`moneySourceA`), `sing-save.mjs` liest
  sie. Beispiel BN2L1 seit Knotenstart: hacking +52,8 Mrd, hacknet +4,57,
  Vertraege +1,48, Krankenhaus -4,71, Rechner -22,5, Augs -28,4 Mrd. Das
  Krankenhaus-Thema liegt bei BLADE-4.
- **Sprungablauf je V1/V2:** `ausgang.js` prueft jede Minute BEIDE Tueren
  (`:249-278`), unabhaengig vom Verfahren - richtig, weil das Spiel ODER
  prueft (`Singularity.ts:1161`). Ziel aus `route.json`, doppelt geprueft
  (`ausgang.js` planeRoute, `exit.js:70-94` zielErlaubt). Black-Ops-Tuer
  braucht keinen Netzanschluss von w0r1d_d43m0n (`Singularity.ts:1144-1161`
  holt ihn per GetServer). Hacking-Tuer braucht Red Pill, weil jede
  ns-Funktion einen Server ohne Netzanschluss als ungueltig ablehnt
  (`NetscriptHelpers.tsx:557-569`) - `nuke` vor Red Pill wirft. Rueckruf
  `boot.js` mit Pruefung, dass er auf home liegt. Der neue 3.0.2-Zweig
  "nextBN null -> BitVerse" (`Singularity.ts:1168-1171`) wird nie betreten,
  weil `exit.js` immer ein Ziel uebergibt.
- **Kaltstart nach dem Sprung:** live BN12L3 -> BN2.1: home 128 GB
  (`Prestige.ts:241-242`), boot 1,0 min nach dem Sprung, bn4net, bn4life,
  guard sofort, bn4door auf joesguns ausgewichen, blade.js und bn4rep nach
  1,5 min auf I.I.I.I, erster Rechner nach 30 s. Rang 68 nach 51 min. Die
  Eintrittsseiten der kommenden Knoten (BN6 Cinematic, BN13/BN15 Dialoge)
  raeumt `popups.js:135-160` ab. Knotenspezifische Kaltstartfragen (BN3 Geld,
  BN8 Boerse, BN15 V1b) liegen bei den BN-Pruefern.
- **RAM/SF4:** SF4.3 -> Faktor 1 in allen Restknoten (`RamCostGenerator.ts:82-96`).
  `exit.js` (40,25 GB) braucht nur am Ausgang Platz; die dreistufige Wirtwahl
  (`ausgang.js:487-560`) ist seit BN9 belegt.

## Geprueft, in Ordnung (mit Werkzeug, das den Fehler zeigen koennte)

- **Undeklarierte Namen in `src/`:** `sing-undef.mjs` - Selbstprobe findet
  den vergessenen Import, `src/` hat 0 Funde (140 Dateien). Zusammen mit
  `tools/test-scope-tot.js` (0 Funde, eigene Selbstprobe) ist die Klasse
  "ReferenceError im try/catch verschluckt" fuer beide Varianten
  ausgeschlossen.
- **Entfernte API-Funktionen** (`NetscriptFunctions.ts:1486-1566`,
  `setRemovedFunctions` in Singularity/Sleeve/Gang/Formulas/Corporation):
  einziger Aufruf `ns.formatNumber` in `src/torprobe.js:23` (Probe, kein
  Betrieb).
- **3.0.1 gegen 3.0.2:** `Bladeburner/data/BlackOperations.ts` nur
  Textaenderungen - `lib/blackops.json` (aus v301 erzeugt) bleibt gueltig.
  `destroyW0r1dD43m0n` bekam den nullbaren nextBN-Zweig - fuer `exit.js`
  folgenlos.
- **BitVerse-Selbstheilung:** Laege das Spiel je wieder auf der
  BitVerse-Seite (F1-Muster), waere `wd.backdoorInstalled` schon gesetzt und
  die Hackingtuer offen; `ausgang.js` -> `exit.js` springt dann trotzdem
  regulaer (`destroyW0r1dD43m0n` prueft keine Seite). Solange Skripte laufen.

## Offene Fragen

- Welche Spielversion laeuft live (3.0.1 oder 3.0.2)? Davon haengt ab, ob
  SING-1 als eine Befehlskette oder als Einzelbefehle gebaut wird.
- Die Uebersetzung "Rangrate +x % -> Knoten -y h" braucht eine Knotensimulation
  (calc_spec bei SING-1). Erst danach P1 bestaetigen oder auf P2 senken.
- Zwischen 10:32 und 17:16 Ortszeit war alle Telemetrie 404 min alt
  (`data/guard-log.txt`), das Spiel also aus oder eingefroren; Rang 1.734 ->
  2.191 in 7,3 h Spielzeit. Ursache ausserhalb dieses Bereichs (Bruecke/PC).
