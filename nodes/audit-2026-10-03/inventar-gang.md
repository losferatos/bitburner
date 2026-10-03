# Inventar GANG - Vollstaendigkeits-Audit 03.10.2026

Stand: 2026-10-03 11:11 (Systemzeit), Spielstand `LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz`
(BN2.1, 5,29 h im Knoten). Spielquelle 3.0.2 unter `reference/bitburner-src/src/`.
Rechner unter `tools/audit/gang-*.mjs` (Liste und Eichstand in Abschnitt 4).

## Kurzfazit

- Der Bot nutzt die Gang ueberhaupt nicht: `grep ns.gang|createGang` in `src/` = 0 Treffer;
  einziger Gang-Bezug ist ein Etikett in `src/augcount.js:37`. Alle 25 Gang-Features sind
  NICHT GENUTZT oder NICHT ANWENDBAR, kein Code ist TOT.
- **Neu gegenueber allen frueheren Papieren:** In BN2 ist die Gang ein **V2-Hebel**, nicht nur
  ein V1-Beschleuniger. Die Gang-Faktion verkauft in BN2 alle 36 nicht-speziellen Kampf-Augs (35 davon heute nicht im Besitz)
  (SPTN-97, Graphene Bone Lacings, NEMEAN, CordiARC, Xanipher, Synthetic Heart, ...), die der Bot
  in V2-Laeufen nie erreicht (heute kaufbar: 0). Die Bladeburner-Augs sind dagegen (bis auf
  Glibness Enhancement) `isSpecial` und **nicht** im Gang-Angebot.
- Gerechnet (Formeln wortgleich gegen den Originalquelltext geprueft, Dynamik ungeeicht):
  Kampfgang Slum Snakes erreicht 1,25 Mio Faktions-Rep nach 8,6-11,2 h ab Gruendung; eine
  Einbaurunde fuer 20/100 Mrd hebt die Black-Op-Competence um x2,9/x5,1 und die Rang/h im
  geeichten Bladeburner-Modell um x3,2-3,6 / x4,6-7,1. Geschaetzt: **10-25 h je BN2-Lauf,
  zusammen ca. 40-65 h** ueber BN2.1-2.3. Kosten: keine Spielerzeit, ~20-35 GB RAM.
- **Falle vor dem Bau (RISIKO, P1):** Mit Gang bietet die Gang-Faktion in BN2 The Red Pill an.
  `bn4rep` stuft TRP in jedem Knoten als Ausgangsschluessel ein, kauft es, erzwingt den Einbau
  und sperrt danach jeden weiteren Einbau im Knoten (`src/bn4rep.js:1207,1272,1370`,
  `src/lib/hackaugs.js:347`).
- Nach SF2 ausserhalb BN2: Karma -54.000 kostet 14-17 h Spielerzeit (natuerliches V2-Karma
  gemessen nur -68 bis -95 je Stunde). Lohnt nur in langen Knoten mit `GangSoftcap 1`
  (BN15, evtl. BN11); BN13 (0,3) und BN8 (0) nie.

## 1. Feature-Inventar (aus dem Quellcode)

Pfade relativ zu `reference/bitburner-src/src/`.

| # | Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag/Hebel |
|---|---|---|---|---|
| 1 | Zugang/Gruendung (`ns.gang.createGang`, 1 GB) | `PersonObjects/Player/PlayerObjectGangMethods.ts:12-30` (BN2: sofort `success`, :16-17; sonst SF2 + Karma <= -54.000, :19-27), `Gang/helpers.ts:6-26` (Mitglied der Faktion, eine der 7 Gang-Faktionen), `NetscriptFunctions/Gang.ts:41-52`, `Gang/data/Constants.ts:27` | BN2 frei; mit SF2 ueberall ausser `disableGang`; BN8 formal moeglich, aber `GangSoftcap 0` | Schaltet alles Folgende frei; Gruendung setzt die Faktions-Rep auf 0 (`PlayerObjectGangMethods.ts:67`) und ist bis Knotenende endgueltig |
| 2 | Gangtyp Kampf/Hacking | `NetscriptFunctions/Gang.ts:49` (NiteSec, Black Hand = Hacking), `Gang/Gang.ts:419-427` (Aufgabenfilter) | wie 1 | Kampfgang: Terrorism hat Territoriums-Exponent 2 (`Gang/data/tasks.ts:315-335`) -> bei 1/7 Territorium Faktor 2,04 statt 0,143 (Cyberterrorism); Sim: 1,25 Mio Rep 8,6 h (Kampf) gegen 13,1 h (Hacking) |
| 3 | Rekrutierung | `Gang/Gang.ts:305-354`, `Gang/data/Constants.ts:6-11` (3 frei, Basis 5, max 12); `recruitMember` 2 GB, `canRecruitMember`/`getRecruitsAvailable`/`respectForNextRecruit` je 1 GB | wie 1 | 12. Mitglied ab 5^9 = 1,95 Mio Respekt; Sim: 12 Mitglieder nach ~4 h |
| 4 | Aufgaben (23 Stueck) | `Gang/data/tasks.ts:33-398`; `setMemberTask` 2 GB, `getTaskNames` 0, `getTaskStats` 1 | wie 1 | Respekt-, Geld-, Wanted-, Trainingsaufgaben |
| 5 | Respekt -> Faktions-Rep der Gang-Faktion | `Gang/Gang.ts:144-155`: `rep += faction_rep * respekt * (1+favor/100) / 75` | wie 1 | Einzige Rep-Quelle ohne Spielerzeit; Sim nach Reife 0,35-1,4 Mio Rep/h |
| 6 | Gang-Geld | `Gang/Gang.ts:168` (`gainMoney(..., "gang")`), `Gang/formulas/formulas.ts:56-73` | wie 1, skaliert mit `GangSoftcap` (nicht mit `CrimeMoney`) | Sim Geldmodus BN2: 17 Mrd/h nach 8 h, 44 Mrd/h nach 16 h, 100 Mrd/h nach 30 h; BN2.1 Hacking heute ~4,6 Mrd/h Schnitt |
| 7 | Wanted-Stufe und Abzug | `Gang/formulas/formulas.ts:11-13,33-54`, `Gang/Gang.ts:157-167` (Justice-Faktor 0,999 je Mitglied und Schritt) | wie 1 | Abzug `respekt/(respekt+wanted)` auf Respekt und Geld; Vigilante/Ethical Hacking senken |
| 8 | Training/Erfahrung | `Gang/GangMember.ts:141-226` | wie 1 | Train Combat 1,05 exp/Zyklus je Kampfwert, Hacking 2,05, Charisma 0,43 (x Asc-Mult) |
| 9 | Aufstieg (Ascension) | `Gang/GangMember.ts:234-341`, `Gang/formulas/formulas.ts:75-81`, `Gang/Gang.ts:390-404`; `ascendMember` 4 GB, `getAscensionResult` 2 | wie 1 | Mult `sqrt(punkte/2000)`; kostet den Respekt des Mitglieds, nicht die schon gutgeschriebene Rep |
| 10 | Ausruestung und Mitglieds-Augs | `Gang/data/upgrades.ts:34-227` (32 Stueck, 1 Mio - 50 Mrd), Rabatt `Gang/Gang.ts:406-416`; `purchaseEquipment` 4 GB, `getEquipmentCost/Type/Stats` je 2, `getEquipmentNames` 0 | wie 1 | Werte x1,04-1,7; konkurriert um das Geld der Spieler-Augs; in der Sim bewusst weggelassen (konservativ) |
| 11 | Territorium, Macht, Clash | `Gang/Gang.ts:173-303`, `Gang/AllGangs.ts:11-77`, `Gang/data/power.ts`; `setTerritoryWarfare` 2, `getChanceToWinClash` 4, `getAllGangInformation` 2 | wie 1 | Mehr Territorium hebt Respekt/Geld stark (Terrorism Exponent 2, Penalty-Exponent 0,83 -> 1,0); Tod von Mitgliedern im Clash (`:281-303`) |
| 12 | Territoriums-Exponenten der Aufgaben | `Gang/formulas/formulas.ts:26,44,68`, `Gang/data/tasks.ts` (`territory`) | wie 1 | siehe 2 und 11 |
| 13 | Bonuszeit/Takt | `Gang/Gang.ts:99-121` (10 Zyklen online, bis 25 im Nachholen), `engine.tsx:105,327`; `getBonusTime` 0, `nextUpdate` 0 GB | wie 1 | Offline-Zeit geht nicht verloren (wird 2,5-fach nachgeholt) |
| 14 | Info-Funktionen | `NetscriptFunctions/Gang.ts:53-165`; `getGangInformation`/`getMemberInformation` je 2, `getMemberNames` 1, `inGang`/`renameMember` 0 | wie 1 | Steuerungsgrundlage |
| 15 | `ns.formulas.gang.*` | `NetscriptFunctions/Formulas.ts:332-357`, RAM 0 (`Netscript/RamCostGenerator.ts:725-731`) | mit Formulas.exe (SF5.3 vorhanden) | Aufgabenwahl ohne Probieren, 0 GB |
| 16 | Gang-Faktion als Aug-Quelle | `Faction/FactionHelpers.tsx:172-200` (alle `!isSpecial` ausser Congruity; BN2 + TRP :180-183; Ein-Faktion-Augs nur mit `rng() >= 1-GangUniqueAugs`, Saat `BN<n>.<SF-Stufe>`), `NetscriptFunctions/Singularity.ts:105-125` | BN2 vollstaendig (98 Augs inkl. TRP); sonst nach `GangUniqueAugs` (exakte Listen in 4.3) | In BN2 alle 36 nicht-speziellen Kampf-Augs ohne jede Faktionsarbeit (Tabelle 4.4); Bladeburner-Augs sind `isSpecial` und fehlen |
| 17 | Favor der Gang-Faktion ueber Einbauten | `Faction/Faction.ts:77-83`, `Faction/formulas/favor.ts:12-24`, `Gang/Gang.ts:152` | wie 1 | Nach 1,25 Mio Rep Favor 199 -> naechste Runde Rep x2,99; nach 2,5 Mio Favor 233 -> x3,33 |
| 18 | Sleeve-Augs ueber die Gang-Faktion | `PersonObjects/Sleeve/Sleeve.ts:132-146` | wie 1 | Sleeves koennen Gang-Augs kaufen, aber nur bei Schock 0 (heute ~99) |
| 19 | Sperren der Gang-Faktion | keine Arbeit `NetscriptFunctions/Singularity.ts:777-779,859-860`, keine Spende `:903-904`, keine Sleeve-Arbeit `NetscriptFunctions/Sleeve.ts:166-169` (wirft!), `Sleeve/Work/SleeveFactionWork.ts:46`, keine Passiv-Rep `Faction/FactionHelpers.tsx:150-152`, `engine.tsx:293-294` | wie 1 | Nebenbedingung: Gang nur mit einer Faktion gruenden, die sonst nichts liefert (Slum Snakes, Rep 0) |
| 20 | Einbau-Wechselwirkung | `Prestige.ts:130-143` (Asc-Punkte x0,95, Faktion wieder beitreten), Gang endet erst beim Knotenwechsel (`PersonObjects/Player/PlayerObjectGeneralMethods.ts:157-158`) | wie 1 | Asc-Mult je Einbau x~0,975; Rep der Gang-Faktion faellt mit dem Einbau auf 0 (`Faction.ts:79-81`), Respekt bleibt |
| 21 | BN-Multiplikatoren `GangSoftcap`/`GangUniqueAugs` | `BitNode/BitNodeMultipliers.ts:90-94`, je `case` in `BitNode/BitNode.tsx` (BN2 1/1, BN3 0,9/0,5, BN11 1/0,75, BN6 und BN7 0,7/0,2, BN14 0,7/0,4, BN13 0,3/0,1, BN15 1/0,3, BN8 0/0) | Route | Softcap ist Exponent auf Respekt und Geld (`formulas.ts:27,71`); bei 0 ergibt `pow(x,0)` genau 1 Respekt je Zyklus und Mitglied |
| 22 | SF2-Passivwirkung | `BitNode/BitNode.tsx:95-105` (Crime-Erfolg/-Geld, Charisma +24/36/42 %) | ab SF2.1 ueberall | Wirkt automatisch |
| 23 | Karma-Quellen (fuer Gang ausserhalb BN2) | Spieler-Verbrechen `Work/CrimeWork.ts:68-84` (Homicide 3 s, 3 Karma, `Crime/Crimes.ts:139-160`), Sleeve-Verbrechen x sync/100 `PersonObjects/Sleeve/Work/SleeveCrimeWork.ts:46` (sync = memory = 1 nach Eintritt, `Sleeve.ts:253`), Bladeburner-Toetungsaktionen -1 / Black Op -15 `Bladeburner/Bladeburner.ts:964-969,1043-1049` (auch fuer Sleeves), Darknet-Caches -(Schwierigkeit+1) `DarkNet/effects/cacheFiles.ts:46-48` | alle | Spieler-Homicide ~0,8-1,0 Karma/s; Sleeves bei sync 1 % praktisch null |
| 24 | The Red Pill ueber die Gang-Faktion | `Faction/FactionHelpers.tsx:180-183` | nur BN2 | V1-Tuer offen, aber w0r1d_d43m0n braucht Hacking 3000 x 5 = 15.000 (`WorldDaemonDifficulty 5`, `HackingLevelMultiplier 0,8`) - unerreichbar |
| 25 | Gang in BN8 | `BitNode/BitNode.tsx` case 8 (`GangSoftcap 0`, `GangUniqueAugs 0`), Spende an Gang-Faktion gesperrt (`Singularity.ts:903`) | BN8 | ~1 Respekt/Zyklus/Mitglied -> ~3.000-4.300 Rep/h, Geld ~60 $/s; wertlos |

**Inventar: 25 Features.**

## 2. Abdeckungsmatrix

| # | Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil |
|---|---|---|---|---|---|
| 1 | Gruendung | fehlt (0 Treffer `ns.gang`/`createGang` in `src/`) | nie | NICHT GENUTZT | Befund GANG-1 (BN2), GANG-3 (spaeter) |
| 2 | Gangtyp | fehlt | nie | NICHT GENUTZT | Kampfgang Slum Snakes ist die richtige Wahl (4.2); NiteSec/Black Hand wuerden 8.114/872 Rep nullen |
| 3 | Rekrutierung | fehlt | nie | NICHT GENUTZT | Teil von GANG-1 |
| 4 | Aufgaben | fehlt | nie | NICHT GENUTZT | Teil von GANG-1 |
| 5 | Respekt -> Rep | fehlt | nie | NICHT GENUTZT | Kern von GANG-1 |
| 6 | Gang-Geld | fehlt | nie | NICHT GENUTZT | Teil von GANG-1 (Geld ist in BN2 der zweite Engpass der Einbaurunde) |
| 7 | Wanted | fehlt | nie | NICHT GENUTZT | Teil von GANG-1 |
| 8 | Training | fehlt | nie | NICHT GENUTZT | Teil von GANG-1 |
| 9 | Aufstieg | fehlt | nie | NICHT GENUTZT | Teil von GANG-1; Raster 4.2: Aufstieg auch in der Arbeitsphase (Schwelle 2) verdoppelt die Rep nach 30 h |
| 10 | Ausruestung | fehlt | nie | NICHT GENUTZT | Teil von GANG-1, nachrangig (Geld fuer Spieler-Augs wichtiger) |
| 11 | Territorium | fehlt | nie | NICHT GENUTZT | Zweite Ausbaustufe von GANG-1, nicht gerechnet (needs_calc) |
| 12 | Territoriums-Exponenten | fehlt | nie | NICHT GENUTZT | wie 11 |
| 13 | Bonuszeit/Takt | fehlt | nie | NICHT GENUTZT | nur Werkzeug |
| 14 | Info-Funktionen | fehlt | nie | NICHT GENUTZT | nur Werkzeug |
| 15 | formulas.gang | fehlt | nie | NICHT GENUTZT | 0 GB, fuer den Regler empfohlen |
| 16 | Gang-Faktion als Aug-Quelle | indirekt vorhanden: `src/bn4rep.js:668-678` sammelt Kandidaten aus `getAugmentationsFromFaction` jeder Faktion, `src/lib/hackaugs.js:204-312` bewertet alle 57 kampfrelevanten Augs (fehlen nur 5 nicht kaufbare Spezial-Augs) | wuerde mit Gang sofort greifen | NICHT GENUTZT | Bewertung und Kauf waeren bereit - mit der TRP-Falle (GANG-2) |
| 17 | Favor-Zinseszins | fehlt | nie | NICHT GENUTZT | Teil von GANG-1 (Einbau-Taktung) |
| 18 | Sleeve-Augs ueber Gang | fehlt (kein `purchaseSleeveAug` in `src/`) | - | NICHT ANWENDBAR | Schock ~99 in BN2.1, Sleeve-Augs erst bei Schock 0; Sleeve-Bereich |
| 19 | Sperren der Gang-Faktion | Bot-Pfade fangen ab: `src/bn4rep.js:1677,1788,2414` (`donateToFaction` -> false), `src/bn4rep.js:2497` (`workForFaction` -> false), `src/sleeve.js:486` (`setToFactionWork` in try/catch) | - | NICHT ANWENDBAR | Nebenbedingung, heute gefahrlos |
| 20 | Einbau-Wechselwirkung | - | - | NICHT ANWENDBAR | relevant erst mit Gang (Einbau-Taktung GANG-1) |
| 21 | Gang-BN-Multiplikatoren | Daten vorhanden `src/lib/bitnodes.json` (stimmen mit `BitNode.tsx` ueberein), kein Leser | - | NICHT GENUTZT | fuer GANG-3 noetig |
| 22 | SF2-Passivwirkung | - | ab SF2.1 automatisch | NICHT ANWENDBAR | keine Entscheidung |
| 23 | Karma-Quellen | BB-Karma faellt nebenbei an (Toetungsvertraege von Spieler und Sleeves), kein gezieltes Karma-Farmen | V2-Laeufe | NICHT GENUTZT | Befund GANG-3 |
| 24 | TRP ueber Gang (V1) | `src/bn4rep.js:159-160` behandelt TRP als Ausgangsschluessel in jedem Knoten | - | NICHT ANWENDBAR | V1 in BN2 unerreichbar (ROADMAP-KORREKTUR, bestaetigt); aber Befund GANG-2 (Falle) |
| 25 | Gang in BN8 | - | - | NICHT ANWENDBAR | `GangSoftcap 0` |

Zaehlung: NICHT GENUTZT 19, NICHT ANWENDBAR 6, OPTIMAL 0, SUBOPTIMAL 0, TOT 0.

## 3. Befunde

### GANG-1 (NICHT_GENUTZT, P1): Keine Gang in BN2.1-2.3 - die einzige Quelle der starken Kampf-Augs im V2-Lauf bleibt liegen

- **Bot:** fehlt. `src/` enthaelt keinen Aufruf von `ns.gang`.
- **Spiel:** `PersonObjects/Player/PlayerObjectGangMethods.ts:16-17` (BN2 ohne Karma),
  `Faction/FactionHelpers.tsx:172-200` (Gang-Faktion verkauft alle nicht-speziellen Augs; BN2
  `GangUniqueAugs 1` -> nichts wird ausgewuerfelt), `Gang/Gang.ts:144-155` (Rep aus Respekt).
- **Warum es zaehlt:** In BN2 gilt `FactionWorkRepGain 0,5` und `FactionPassiveRepGain 0`
  (`BitNode/BitNode.tsx` case 2), und der Spieler faehrt Bladeburner (Faktionsarbeit ist dort
  gesperrt, `src/bn4rep.js:2459-2470`). Gemessen in BN2.1: alle sieben Nicht-BB-Faktionen
  zusammen 26.000 Rep in 5,3 h; mit dem heutigen Rep-Stand ist **keine einzige** weitere
  Kampf-Aug kaufbar (`tools/audit/gang-round.mjs`, Abschnitt "Ohne Gang"). Fruehere V2-Laeufe
  endeten bei Kampf-Mults ~1,8 (str) / 2,4-2,6 (dex) (BN4L2, BN9L2, BN10L3).
- **Was die Gang liefert:** 1,25 Mio Rep (SPTN-97, Hydroflame) nach 8,6 h (bester Regler) bis
  11,2 h (einfacher Regler) ab Gruendung; 2,5 Mio nach 11,7-17,6 h. Eine Einbaurunde mit
  q0 = 0 fuer 20/50/100 Mrd: Black-Op-Competence x2,87/x3,90/x5,14; Rang/h im geeichten
  Modell x3,2-3,6 (20 Mrd) bzw. x4,6-7,1 (100 Mrd). Zum Vergleich der typische Endstand ohne
  Gang (Kampf x1,8): x1,6-1,7.
- **Gewinn:** GESCHAETZT 10-25 h je BN2-Lauf (BN2.1 eher 10-15 h, weil die Gang erst ab h~5,5
  laeuft und 4 Augs warten -> Preisfaktor 1,9^4 = 13; BN2.2/2.3 Gruendung ab h~2, Slum Snakes
  war in BN2.1 bei h1,85 beigetreten), zusammen ca. 40-65 h. Kosten: keine Spielerzeit, kein
  Pflichtgeld (Ausruestung optional), ~20 GB RAM (Minimalregler) bis ~35 GB (mit Ausruestung
  und Territorium); home hat 1.024 GB.
- **Bauvorgaben aus den Rechnungen:** Kampfgang mit **Slum Snakes** (Rep heute 0, nichts geht
  verloren; NiteSec-Gruendung naehme 8.114 Rep). Regler: Training bis gewichtete Stufe ~500,
  Aufstieg ab Faktor 1,3 im Training und ab 2 in der Arbeit, Terrorism als Respektaufgabe,
  Vigilante nur wenn wanted > 1 und Abzug < 0,95. Kauf-Taktung: Gang-Augs teuerste zuerst,
  Voraussetzungen davor, und moeglichst mit leerer Warteschlange (q0 = 0); die Rep der
  Gang-Faktion faellt beim Einbau auf 0, wird aber zu Favor (x3 auf die Folgerunde).
- **Vorher bekannt:** `nodes/AUFTRAG-BAU-2026-09.md:155,346` ("Nicht bauen: Gang ... kein Ertrag
  fuer den Ausgang"), `nodes/ROUTE.md:84` und `nodes/AUDIT-ROADMAP-2026-08-24.md:89` (Gang nur als
  V1-Rueckfall in BN2 dokumentieren), `nodes/ROADMAP.md:337-361` (V3 = Beschleuniger fuer V1).
  **Neue Fundstelle:** Kampf-Augs der Gang-Faktion als V2-Hebel; dass 17 der 18
  Bladeburner-Augs `isSpecial` sind (`Augmentation/Augmentations.ts`; Ausnahme Glibness
  Enhancement ohne Kampfwert) und deshalb fehlen, die 36 anderen Kampf-Augs aber nicht, stand
  bisher nirgends.
- **needs_calc:** ja (siehe calc_spec in der strukturierten Antwort): die Kette Gang-Rep ->
  Einbaurunde -> Rang-Verlauf ueber den ganzen Lauf ist nicht dynamisch gerechnet.

### GANG-2 (RISIKO, P1, Voraussetzung fuer GANG-1): Mit Gang kauft bn4rep in BN2 The Red Pill und sperrt danach jeden Einbau

- **Bot:** `src/lib/hackaugs.js:347` laesst TRP auch im Kampfknoten als nuetzlich durch;
  `src/bn4rep.js:159-160` gibt ihm den Wert 10 (hoechster), `:668-678` sammelt es aus jeder
  Faktion; `:1272` `redPillWartet` erzwingt danach den Einbau unabhaengig von der Warteschlange;
  `:1207-1212` `ausgangSteht` = TRP eingebaut, und `:1370` `if (!ausgangSteht && ...)` ist das
  einzige Einbautor -> kein Einbau mehr im Knoten. Die Annahme steht im Kommentar
  `src/bn4rep.js:1269-1271` ("Red Pill kommt nur ueber Daedalus, also nie in den 30
  Bladeburner-Laeufen") und `:1405-1407`.
- **Spiel:** `Faction/FactionHelpers.tsx:180-183` - in BN2 verkauft die Gang-Faktion TRP
  (Rep 2,5 Mio, Preis 0). TRP zaehlt als wartende Aug in `1,9^q`
  (`Augmentation/AugmentationHelpers.ts:32-37`) und verteuert jede Folge-Aug der Runde um x1,9.
- **Ablauf:** Gang-Rep erreicht 2,5 Mio nach 11,7-17,6 h ab Gruendung (Sim) -> Kauf -> Einbau
  beim naechsten freien Tor -> ab dann kann der Bot in BN2 keine Gang-Augs mehr einbauen.
  w0r1d_d43m0n ist dann zwar am Netz, aber bei Hacking 15.000 nie zu knacken.
- **Gewinn:** schuetzt den Ertrag aus GANG-1 (alle Runden nach dem TRP-Kauf). Aufwand S: TRP nur
  im Verfahren V1 als Kandidat zulassen (oder ausdruecklich aus der Gang-Faktion in V2 filtern).
- **Ausserhalb einer Gang folgenlos** (TRP gibt es sonst nur ueber Daedalus). Trifft aber auch
  den Fall, dass Eric von Hand eine Gang gruendet.

### GANG-3 (NICHT_GENUTZT, P2): Gang nach SF2 in den spaeteren V2-Knoten - Karma -54.000 nicht gerechnet

- **Bot:** fehlt (kein Karma-Farmen, keine Gang).
- **Spiel:** `PersonObjects/Player/PlayerObjectGangMethods.ts:19-27`, `Gang/data/Constants.ts:27`;
  Karmaquellen siehe Feature 23.
- **Kosten gemessen:** natuerliches Karma der V2-Laeufe aus den Spielstaenden: BN4L2 -4.372 bei
  45,9 h (-95/h), BN9L2 -6.808 bei 81,0 h (-84/h), BN10L2 -7.244 bei 105,9 h (-68/h). Es fehlen
  also ~47.000-50.000. Spieler-Homicide (3 s, 3 Karma, Erfolg bei Kampfwerten 100 ~0,75, ab ~190
  sicher; ohne Fokus x0,8 `Constants.ts:87`) -> 14-17 h Spielerzeit, in denen keine
  Bladeburner-Aktion laeuft. Sleeves helfen nicht: Karma x sync/100, sync = 1 nach Eintritt.
- **Nutzen gerechnet (ungeeicht):** Zeit bis 1,25 Mio Rep ab Gruendung: Softcap 1 (BN11, BN15)
  8,6 h; 0,9 (BN3) 10,4 h, dort aber Rep-Kosten x3; 0,7 (BN6/7/14) 16,2 h; 0,3 (BN13) nie
  (437k erst nach 29 h). Das exakte Gang-Angebot je Knoten und Stufe steht in 4.3; ueberall
  bleiben die Mehr-Faktionen-Augs (Synthetic Heart, NEMEAN, Synfibril, Graphene Bone Lacings,
  Graphene Bionic Legs/Spine), es fehlen je nach Saat SPTN-97, CordiARC, Xanipher usw.
- **Gewinn:** GESCHAETZT: BN15 (langer V2-Lauf, `BladeburnerRank 0,2`) grob -20 bis -40 h je Lauf
  netto, BN11 0 bis -10 h, BN3 unklar (Rep und Geld x3/x3), BN6/7/14 neutral bis negativ, BN13
  und BN8 negativ. Entscheiden erst mit einem Laufmodell (calc_spec).
- **Vorher bekannt:** `nodes/ROADMAP.md:469` (V1 mit V3-Gang, sofern SF2 und Softcap >= 0,8 - fuer
  V1-Knoten gedacht, die erledigt sind). Neu: V2-Sicht und exakte Angebotslisten.

## 4. Rechnungen mit Eichung

Alle Rechner unter `tools/audit/`, Aufruf mit `node tools/audit/<name>.mjs`.

### 4.1 Abschreibpruefung und Eichung

| Rechner | Was | Ergebnis |
|---|---|---|
| `gang-check.mjs` | fuehrt `Gang/formulas/formulas.ts`, `Gang/data/tasks.ts` und `GangMember.calculateSkill` **im Original** (Node-Typ-Stripping) aus und vergleicht mit `gang-formulas.mjs` ueber Zufallseingaben und Softcaps 1/0,9/0,7/0,3/0 | **86.360 Vergleiche, 0 Abweichungen** (Abschreibpruefung, keine Spielstand-Eichung - es gibt in keinem Backup eine Gang, `AllGangsSave` ist leer) |
| Fertigkeitsformel (Person, Konstante 534,6) gegen BN2.1-Spielstand | hack exp 7.822.051, mult 1,51398 x 0,8 / str 35.439 x 1,43430 / def 26.214 / cha 1.493 x 1,32805 | Soll 372/194/181/57, Ist 372/194/181/57 - **OK** |
| `gang-bbhebel.mjs` maxStamina (Bladeburner-Modell `tools/bbrank/bbmodel.mjs`, schon in `eich.mjs` gegen BN10 geeicht) | gegen BN2.1-Spielstand | Modell 84,302595 / Spielstand 84,302595 - **OK** |
| `faction_rep`-Mult fuer die Rep-Umrechnung | aus dem Spielstand | 1,3280548527604765 |
| Natuerliche Karmarate V2 | aus den Spielstaenden (Abschnitt GANG-3) | gemessen |

Die Gang-Dynamik (Wachstum ueber Stunden) ist damit **GERECHNET_UNGEEICHT**: jede Einzelformel
trifft den Spielcode exakt, die Steuerung ist ein eigener Regler, und eine echte Gang zum
Gegenmessen gibt es nicht.

### 4.2 Gang-Simulation BN2 (`gang-sim.mjs`, `gang-scen.mjs`)

Motor wie `Gang.ts:99-169` (10 Zyklen je Schritt), Territorium fest 1/7 (ohne Warfare keine
Clashes mit der eigenen Gang), keine Ausruestung, `faction_rep` 1,328, Favor 0. Stunden ab Gruendung:

| Szenario | 100k | 437,5k | 750k | 1,25M | 1,625M | 2,5M | Rep nach 30 h |
|---|---|---|---|---|---|---|---|
| BN2 Kampfgang, bester Regler (Training bis 500, Aufstieg 1,3 / Arbeit 2) | 4,0 | 5,8 | 7,1 | 8,6 | 9,6 | 11,7 | 19,76 Mio |
| BN2 Kampfgang, einfacher Regler (300 / 1,6 / kein Aufstieg in Arbeit) | 4,0 | 6,5 | 8,4 | 11,2 | 13,2 | 17,6 | 5,16 Mio |
| BN2 Hackinggang, bester von 16 Reglern | 4,5 | 8,1 | 10,2 | 13,1 | 14,7 | 17,7 | 7,37 Mio |
| GangSoftcap 0,9 (BN3) | 4,4 | 6,8 | 8,3 | 10,4 | 11,8 | 14,2 | 11,47 Mio |
| GangSoftcap 1 (BN11, BN15) | 4,0 | 5,8 | 7,1 | 8,6 | 9,6 | 11,7 | 19,76 Mio |
| GangSoftcap 0,7 (BN6, BN7, BN14) | 5,4 | 9,6 | 12,6 | 16,2 | 18,6 | 23,9 | 3,89 Mio |
| GangSoftcap 0,3 (BN13) | 11,5 | 29,1 | - | - | - | - | 0,46 Mio |

Geldmodus (Respekt bis 12 Mitglieder, dann Geldaufgaben), BN2: 48,8 Mrd nach 8 h (Rate 17,4 Mrd/h),
131,5 Mrd nach 12 h (25,0), 282,5 Mrd nach 16 h (43,9), 466,8 Mrd nach 20 h (47,8), 1.123 Mrd nach
30 h (99,6) - und dabei noch 1,26 Mio Rep nach 20 h. Zum Vergleich BN2.1 heute (moneySource):
Hacking 24,5 Mrd in 5,3 h, Hacknet 1,4 Mrd; ausgegeben Server 9,2, Krankenhaus 4,5, Augs 2,5 Mrd.

Raster (60 Regler, 30 h): die besten zwolf liegen bei 8,6-10,0 h bis 1,25 Mio; Regler mit hoher
Aufstiegsschwelle (3) und kleinem Trainingsziel (100) kommen nie aus dem Anlauf.

### 4.3 Exaktes Angebot der Gang-Faktion je Knoten (`gang-augs.mjs`, `exactGangOffer`)

Nachbau von `FactionHelpers.tsx:172-200` mit `SFC32RNG` (wortgleich aus `Casino/RNG.ts:65-93`),
Reihenfolge = `AugmentationName`-Enum (`Augmentations.ts:2091`), Saat `BN<n>.<SF-Stufe vor dem
Lauf>`, Gang-Faktion Slum Snakes. Fehlende Top-Kampf-Augs (Kuerzel):

| Lauf | Angebot | fehlt |
|---|---|---|
| BN2.1-2.3 | 98 (inkl. TRP) | nichts |
| BN3.1 / 3.2 / 3.3 | 74 / 73 / 81 | CordiARC, Photosynthetic, Graphene-Arms, Bionic Arms, BrachiBlades, DermaForce / SPTN-97, Xanipher, Neotra, Photosynthetic, Graphene-Arms, nextSENS, Graphene-BrachiBlades, BrachiBlades, DermaForce / nur Neotra |
| BN11.1 / 11.2 / 11.3 | 91 / 87 / 87 | Xanipher, Neotra / SPTN-97, DermaForce / CordiARC, Photosynthetic, nextSENS, Bionic Arms, BrachiBlades |
| BN6.2 / 6.3 | 69 / 65 | 8 bzw. 9 der 11 Ein-Faktion-Augs |
| BN7.1-7.3 | 67 / 65 / 67 | 7-9 der 11 |
| BN14.1-14.3 | 66 / 70 / 74 | 5-9 der 11 |
| BN13.1-13.3 | 62 / 63 / 59 | 9-11 der 11 |
| BN15.1-15.3 | 66 / 68 / 75 | 6-9 der 11 |
| BN8.1 | 57 | alle 11 |

Ungeeicht (es gibt keine Gang, an der `getAugmentationsFromFaction` gegenpruefbar waere); die
Saat setzt voraus, dass keine `sourceFileOverrides` aktiv sind.

### 4.4 Einbaurunde und Black-Op-Competence (`gang-round.mjs`)

Preis `baseCost x 1,9^q x AugmentationMoneyCost` (`AugmentationHelpers.ts:155-158`, `:32-37`),
Competence nach `Actions/Action.ts:169-195` mit den Daedalus-Gewichten, Stufen aus dem Spielstand
(str 194, def/dex/agi 181, hack 372, int 153), gierige Auswahl nach Competence je Dollar mit
Voraussetzungen.

| Budget | q0 = 0 (nach einem Einbau) | q0 = 4 (heutige Warteschlange, Preis x13) |
|---|---|---|
| 20 Mrd | 9 Augs, x2,87 | 6 Augs, x1,43 |
| 50 Mrd | 11 Augs, x3,90 | 8 Augs, x1,57 |
| 100 Mrd | 12 Augs, x5,14 (SPTN-97 > Bone Lacings > NEMEAN > Neotra > ...) | 7 Augs, x2,16 |
| 500 Mrd | 14 Augs, x9,79 | 10 Augs, x3,31 |

Ohne Gang, heutiger Rep-Stand: **0** weitere Kampf-Augs kaufbar.
Spaetere Knoten (Besitz leer, q0 = 0, 100 Mrd nominal, Preis x AugmentationMoneyCost): BN3 x2,4-3,3,
BN11 x3,2-3,9, BN6 x3,9-4,9, BN7 x2,4-3,1, BN14 x3,1-3,9, BN13 x3,2-4,0, BN15 x2,6-3,1 (hier sind
die Grund-Augs, die der Bot ohnehin bekommt, mitgezaehlt - der Gang-Zuwachs ist kleiner).

### 4.5 Rang/h-Hebel (`gang-bbhebel.mjs`, Volhaven, BN2 `BladeburnerRank 1`)

| Kampfwerte | heutige Stufen | freie Stufe | ohne Raid (endlich) |
|---|---|---|---|
| heute | Raid L5 883 Rang/h | 891 | 420 |
| + Gang-Runde 20 Mrd | 2.859 (x3,24) | x3,38 | x3,64 |
| + Gang-Runde 100 Mrd | 4.026 (x4,56) | x6,32 | x7,08 |
| x1,8 (typisches Laufende ohne Gang) | 1.437 (x1,63) | x1,63 | x1,69 |

Statisch (keine Stufenleiter, keine Vorratsgrenzen) - die Verhaeltnisse sind belastbar, die
Absolutwerte nicht.

### 4.6 Ertragskette und was davon geschaetzt ist

1. Gang-Rep ueber der Zeit - gerechnet, ungeeicht (4.2).
2. Welche Augs fuer welches Geld - exakt aus dem Code (4.3, 4.4); Geld im Lauf ist die Unbekannte.
3. Rang/h-Faktor - geeichtes Modell, statisch (4.5).
4. Stunden bis Knotenende - **geschaetzt**: BN4-Laeufe (gleicher `BladeburnerRank 1`) dauerten
   46,7 und 50,8 h; mit Rang/h x3 ab h~14-17 schrumpft der Rest von ~33-37 h auf ~10-13 h zuzueglich
   Wiederaufbau (mit Mults x5 und mehr Minuten statt Stunden). Daraus 10-25 h je Lauf.

## 5. Geprueft, kein Befund

- **V1 ueber TRP der Gang in BN2:** bleibt unerreichbar (Hacking 15.000; `nodes/ROADMAP-KORREKTUR.md`
  Abschnitt a). Nicht wieder aufmachen.
- **Sperren der Gang-Faktion** werden von den heutigen Bot-Pfaden sauber abgefangen
  (`bn4rep` erhaelt false, `sleeve.js:486` faengt den Wurf von `setToFactionWork`).
- **Bewertungstabelle `COMBAT_AUGS`** (`src/lib/hackaugs.js:204`) kennt alle 52 kaufbaren
  kampfrelevanten Augs; es fehlen nur 5 nicht kaufbare (BigD, Darknet-Artefakte). Mit Gang waere
  die Bewertung sofort tragfaehig.
- **`src/lib/bitnodes.json`** fuehrt `GangSoftcap`/`GangUniqueAugs` korrekt (gegen `BitNode.tsx`).
- **BN8:** Gang wertlos (`GangSoftcap 0` -> 1 Respekt je Zyklus), Spende an die Gang-Faktion gesperrt.
- **ENTSCHIEDEN-Tabelle** (`nodes/BAUSTELLEN.md:20-33`) beruehrt die Gang nicht; "Verbrechen statt
  Gym verworfen" gilt fuer Kampftraining und bleibt, die Karma-Rechnung in GANG-3 rechnet die
  Verbrechensstunden deshalb voll als Verlust.

## 6. Offene Fragen

- `nodes/AUFTRAG-BAU-2026-09.md:155,346` verbietet ein Gang-Gewerk ("kein Ertrag fuer den Ausgang").
  Die neue Fundstelle (Kampf-Augs als V2-Hebel) widerspricht der Begruendung - neu entscheiden?
- BN2.1 laeuft (h~5,5, 4 Augs wartend). Gang jetzt gruenden (Ertrag ~10-15 h) oder erst ab BN2.2?
- Darf der Gang-Regler Geld fuer Ausruestung ausgeben, oder bleibt alles Geld den Spieler-Augs?
- `kampfEinbauSperre` (min 12 h, 2 x Aufbaudauer) ist auf schwache Mults geeicht; mit Gang-Augs
  ist der Wiederaufbau viel kuerzer - muss die Sperre fuer BN2 neu bemessen werden?
