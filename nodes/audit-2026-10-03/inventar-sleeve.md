# Inventar SLEEVE - Vollstaendigkeits-Audit 03.10.2026

Pruefer: Bereich Sleeves (Aufgaben, Sleeve-Augs, Schock/Sync/Memory, Covenant).
Stand: Spielstaende BN2L1 03.10.2026 05:33-09:59 (`backups/LIVE_197f4d61481686_BN2L1_*`),
Spielquelle 3.0.2 `reference/bitburner-src/src/`, Bot `src/` auf master (nur gelesen).
Bericht geschrieben 2026-10-03 11:12 (Systemzeit).

Rechner (alle nur lesend, geeicht, Ausgabe unten):
- `tools/audit/sleeve-save.mjs` - Dekoder: Sleeves, Karma, Bladeburner, Textdateien von home aus dem Spielstand.
- `tools/audit/sleeve-bb.mjs` - Formeln (Chance, Dauer, Rang, Gym, Schock, Infiltrate, Trupp, Karma) + 4 Eichungen.
- `tools/audit/sleeve-lp.mjs [stand]` - Zuteilung der 3 Sleeves als kleines LP ueber Spielerzeit, Ausdauer, Raid-Vorrat, Chaos + 2 Eichungen.

## Kurzfazit

- Der groesste Sleeve-Hebel in V2 ist NICHT der Sleeve selbst, sondern der Vorrat und das Chaos der Spieler-Operation: ein Infiltrate-Sleeve (+30 Raids/h, keine Werte noetig) und zwei Diplomacy-Sleeves (Raid-Chaos) schlagen jede Vertragsbelegung deutlich.
- SLEEVE-2: Infiltrate ist hinter Kampfwert 40 gesperrt. In BN2L1 standen die Sleeves ~4 h bei 2-7 % Lerngeschwindigkeit (Schock 93-98) im Gym, waehrend der Spieler ohne Raid-Vorrat lief (gemessen 17 statt 37 Raids/h). Gerechnet +130-190 Rang/h (Erwartungswert) im Hungerfenster.
- SLEEVE-1: Die D5-Infiltrate-Regel ist halb tot: ein Sleeve, der schon einen Vertrag faehrt, wird nie umgesetzt (Spielstand 09:33: Bounty Hunter + Tracking, waehrend der Raid-Vorrat bei 3,7 stand), und das Signal `istAktion` ist genau dann aus, wenn der Vorrat leer ist (Spieler faehrt Retirement oder ruht).
- SLEEVE-3: Diplomacy per Sleeve ist ungenutzt. Ab Chaos 50 (BN2L1 erreicht es 09:59) kostet jeder Raid den Spieler ~2,3 min Diplomacy. Zuteilung 1 Infiltrate + 2 Diplomacy: 328 statt 211 Rang/h der heutigen Belegung (LP, Chaosmodell geeicht).
- Covenant (Sleeve-Kauf, Memory) geht nur in BN10 und ist auf der Restroute NICHT ANWENDBAR; Sleeve-Augs, Schockerholung und Sync sind in V2 wertlos, sobald die Sleeves ohnehin keine Werte brauchen.

## Tabelle 1 - Feature-Inventar aus dem Quellcode

| # | Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag/Hebel |
|---|---|---|---|---|
| 1 | Anzahl Sleeves | `PersonObjects/Sleeve/SleeveCovenantPurchases.tsx:58-73` (`min(3, SF10 + (BN10?1:0)) + sleevesFromCovenant`) | alle (SF10.3: 3) | 3 parallele Koerper; Spielstand: 3, `sleevesFromCovenant` 0 |
| 2 | Covenant: Sleeve kaufen | `SleeveCovenantPurchases.tsx:13-56`, `NetscriptFunctions/Sleeve.ts:24-28, 304-311` | **nur BN10** (`bitNodeN !== 10` wirft) | 4.-8. Sleeve, 10^n * 10 Bio $ |
| 3 | Covenant: Memory | `SleeveCovenantPurchases.tsx:86-123`, `Sleeve.ts:197-213`, `NetscriptFunctions/Sleeve.ts:312-322` | **nur BN10** | Sync-Start nach Knotenwechsel = memory (`Sleeve.ts:253`) |
| 4 | API-Zugang | `NetscriptFunctions/Sleeve.ts:51-58` (`canAccessBitNodeFeature(10)`) | alle mit SF10 | 4 GB je Funktion |
| 5 | Schock | `Sleeve.ts:173-175` (Bonus (100-s)/100), `:263-275` (-0,0001*intBonus je Zyklus bei jeder Arbeit), `:559-573` (+0,5 je HP-Tod) | alle | skaliert JEDE Erfahrung und jeden Ruf des Sleeves, NICHT Geld, NICHT Bladeburner-Rang |
| 6 | Shock Recovery | `Work/SleeveRecoveryWork.ts:12-18` (+0,0002*intBonus je Zyklus, also 3-fach) | alle | 100 -> 0 in 18,2 h (int 24) |
| 7 | Synchronize | `Work/SleeveSynchroWork.ts:13-19` (0,0002*intBonus(Spieler-int,0,5) je Zyklus) | alle | 1 -> 100 in 26 h (Spieler-int 153) |
| 8 | Erfahrungsteilung | `Work/Work.ts:17-25` | alle | Spieler bekommt Sleeve-Exp * sync/100; bei sync 1 % praktisch null |
| 9 | Zustand ueber Einbau | `PlayerObjectGeneralMethods.ts:118-120` (nur Aufgabe neu), `:143-155` (Knotenwechsel: `Sleeve.prestige`, `Sleeve.ts:228-256`) | alle | Exp, Schock, Sync, Augs ueberleben jeden Spieler-Einbau; nur der Knotenwechsel nullt |
| 10 | Verbrechen | `Work/SleeveCrimeWork.ts:37-54`, `Crime/Crime.ts:120-136` | alle | Geld x CrimeMoney (BN2/11: 3, BN3 0,25, BN8 0); Karma x **sync**; Kills **nicht** sync-skaliert |
| 11 | Faktionsarbeit | `Work/SleeveFactionWork.ts:35-52`, `NetscriptFunctions/Sleeve.ts:141-174` | alle | Ruf x Schockbonus; je Faktion nur ein Sleeve |
| 12 | Firmenarbeit | `Work/SleeveCompanyWork.ts:40-48` | alle (BN8: CompanyWorkMoney 0) | Firmenruf + Lohn x Schockbonus |
| 13 | Uni/Gym | `Work/SleeveClassWork.ts:31-42`, `Work/Formulas.ts:108-121`, Powerhouse expMult 10 (`LocationsMetadata.ts:322-327`) | alle (Stadt muss passen) | 10 exp/s x Schockbonus; kostet Geld |
| 14 | Reisen | `Sleeve.ts:542-548` | alle | nur fuer Gym/Uni-Stadt |
| 15 | BB Vertraege | `Work/SleeveBladeburnerWork.ts:41-61`, `Bladeburner.ts:889-1010` | V2 (Spieler in Division) | voller Rang an den Spieler (nicht schockskaliert); keine Ausdauer (`:919`); Fehlschlag kostet HP -> Tod -> Schock +0,5; -1 Karma je Kill-Erfolg (`:968-970`) |
| 16 | BB Infiltrate Synthoids | `Work/SleeveInfiltrateWork.ts:7-28`, `Bladeburner.ts:1251-1263` | V2 | je 60 s +N^-0,5/2 auf JEDEN Vertrag und JEDE Operation; N=1/2/3: +30/+42/+52 je h und Art; keine Werte noetig, kein Schaden |
| 17 | BB Support main sleeve | `Work/SleeveSupportWork.ts:8-20`, `Bladeburner.ts:745-751, 786-789`, `TeamCasualties.ts:52-57` | V2 | +1 Trupp sofort, Verluste treffen zuerst Menschen, Sleeves halten teamSize >= sleeveSize (unsterblich) |
| 18 | BB Recruitment | `data/GeneralActions.ts:22-31`, `Bladeburner.ts:1152-1184` | V2 | Mann je 298 s (cha 2) mit Chance cha^0,45/(Menschen+1) |
| 19 | BB Diplomacy | `Bladeburner.ts:735-743, 1185-1196`, Dauer 60 s (`GeneralActions.ts:37-39`) | V2 | Chaos der BB-Stadt x(1 - (cha^0,045 + cha/1000)/100) je 60 s; cha 2: -1,03 %/min |
| 20 | BB Field Analysis | `Bladeburner.ts:1122-1151`, `Formulas.ts:12-14` | V2 | flach 0,1 x BladeburnerRank je 30 s = 12 Rang/h x BN-Faktor, popEst genauer |
| 21 | BB Training | `Bladeburner.ts:1092-1121` | V2 | +0,04 staminaBonus je 30 s, kostet aber SPIELER-Ausdauer 0,1425 je 30 s (`:1093`, ohne isPlayer-Riegel) |
| 22 | BB Hyperbolic Regen | `Bladeburner.ts:1197-1218` | V2 | +1 % maxStamina des SPIELERS je 60 s |
| 23 | Sleeve-Augs | `Sleeve.ts:90-171` (Liste), `:348-400` (Kauf), `:215-225` (jeder Einbau nullt alle Exp), `NetscriptFunctions/Sleeve.ts:214-270` | alle | Voraussetzung Schock 0 (`:356-361`); nur hack/Kampf/cha/exp/rep/crime/work-Mults, keine bladeburner_*; Preis = baseCost |
| 24 | Gang-Augs fuer Sleeves | `Sleeve.ts:132-146` | nur mit Gang | mit Gang alle Augs der Gang-Faktion |
| 25 | Karma-Pfad | `SleeveCrimeWork.ts:46`, `PlayerObjectGangMethods.ts:12-30` | BN2: Gang ohne Karma; sonst -54.000 | Sleeve-Karma = crime.karma x sync |
| 26 | Kill-Zaehler | `SleeveCrimeWork.ts:47`, `Faction/FactionInfo.tsx:561-599` | alle | Speakers for the Dead 30 Kills, Dark Army 5; BB-Kills zaehlen nicht |
| 27 | BN-Kampf-LevelMultiplier | `Person.ts:76-130`, `BitNode.tsx:994-997, 1056-1059, 1090-1093` | BN13/15 0,7, BN14 0,5 | Sleeve-Gym bis Kampfwert 40: 3,9 / 5,6 / 8,4 h |
| 28 | Option disableSleeveExpAndAugmentation | `Work/Formulas.ts:24-36`, `Sleeve.ts:348-354` | nur Challenge-Optionen | - |

## Tabelle 2 - Abdeckungsmatrix

| Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil |
|---|---|---|---|---|
| 1 Anzahl | `src/sleeve.js:209` (MAX = 3), `:505` | alle | OPTIMAL | 3 = min(3, SF10.3), Covenant 0 |
| 2 Covenant-Sleeve | - | - | NICHT ANWENDBAR | nur BN10, BN10 nicht auf der Restroute |
| 3 Covenant-Memory | - | - | NICHT ANWENDBAR | nur BN10 |
| 4 API/RAM | `src/registry.json:451-470` (31,85 GB), `src/sleevecrime.js` (7,65 GB) | alle | OPTIMAL | |
| 5 Schock | nur gelesen (`src/sleeve.js:433, 553`) | alle | OPTIMAL (Folge s. SLEEVE-2) | Vertragstode halten den Schock in V2 bei 99,96 (Spielstand), Werte frieren bei 40 ein - egal, wenn die Sleeves keine Werte brauchen |
| 6 Recovery | nicht gesetzt (`src/sleeve.js:337-345`, bewusst RAM) | V1: nur stehenlassen | OPTIMAL (V2) / bekannt (V1) | V2: Recovery zuerst spart nur ~1 h bis Kampfwert 40 (Rechnung 7), wird mit SLEEVE-2 gegenstandslos |
| 7 Sync | - | - | OPTIMAL | ENTSCHIEDEN "sync hochziehen verworfen" haelt; Begruendung in BAUSTELLEN 22.09 korrigiert (s. unten) |
| 8 Exp-Teilung | - | - | OPTIMAL | sync 1 % |
| 9 Einbau-Reset | `src/sleeve.js:347-351, 620-625` (Kommentar korrekt) | alle | GENUTZT-SUBOPTIMAL | nach jedem Einbau landen die Sleeves auf Vertraegen und bleiben dort (SLEEVE-1) |
| 10 Verbrechen | `src/sleeve.js:253-263, 901-918` (V1), `:919-930` (V2-Rueckfall), `src/sleevecrime.js:22-66` (Kaltstart) | V1, Kaltstart alle | OPTIMAL / RISIKO BN8 | V1-Wahl rechnet wie `Crime.ts:120-136`; Kaltstart-Shoplift in BN8 bringt 0 $ (SLEEVE-6) |
| 11 Faktionsarbeit | `src/sleeve.js:391-497` | nur V1 (`hackingweg`) | OPTIMAL (V2 wertlos: Ruf x 0,0004) | V1-Luecken stehen in BAUSTELLEN ("Sleeve-Faktionswahl verfeinern") |
| 12 Firmenarbeit | - | - | OPTIMAL | in V2 ohne Rangwert, in BN8 CompanyWorkMoney 0 |
| 13 Gym | `src/sleeve.js:883-900` | V2 vor Beitritt und unter Kampfwert 40 | GENUTZT-SUBOPTIMAL | SLEEVE-2 |
| 14 Reisen | - | - | OPTIMAL | Sleeves starten in Sector-12 (`Sleeve.ts:248`), Powerhouse dort |
| 15 BB Vertraege | `src/sleeve.js:726-733, 768-829` | V2 ab Kampfwert 40 | GENUTZT-SUBOPTIMAL | klebt (SLEEVE-1); Chance/Dauer geeicht: 29-34 Rang/h je Sleeve bei Kampfwert 40 |
| 16 BB Infiltrate | `src/sleeve.js:710-725, 749-751, 849-852` | V2 ab Kampfwert 40, nur wenn die Spieler-Aktion gerade eine knappe Operation ist | GENUTZT-SUBOPTIMAL | SLEEVE-1, SLEEVE-2 |
| 17 BB Support | - (`src/sleeve.js:69-70` nennt es bewusst nicht) | - | NICHT GENUTZT | SLEEVE-4 (klein) |
| 18 BB Recruitment | `src/sleeve.js:107-170, 509-543, 759-767` | V2, Trupp-Anfrage von blade.js | GENUTZT (OPTIMAL bis auf SLEEVE-4) | Rechnung 03.10. mit Skeptiker |
| 19 BB Diplomacy | - | - | NICHT GENUTZT | SLEEVE-3 |
| 20 BB Field Analysis | - | - | OPTIMAL (Nichtnutzung) | 12 Rang/h flat < Vertrag 29-34 < Infiltrate/Diplomacy |
| 21 BB Training | - | - | OPTIMAL (Nichtnutzung) | kostet 17 Spieler-Ausdauer/h je Sleeve, bringt +5,2 maxStamina/h; Ausgleich erst nach ~9 h, Alternative >100 Rang/h |
| 22 BB Regen-Kammer | - | - | OPTIMAL (Nichtnutzung) | LP: Kammer ~ Vertrag (398 gegen 397 Rang/h ohne Chaos), unter Chaos schlechter als Diplomacy |
| 23 Sleeve-Augs | - (verboten seit 29.08., ERLEDIGT.md 2862-2900) | - | NICHT ANWENDBAR (V2) | Schock 0 in V2 unerreichbar (Vertragstode) und wertlos (Infiltrate/Diplomacy brauchen keine Werte) |
| 24 Gang-Augs | - | - | NICHT ANWENDBAR | keine Gang |
| 25 Karma | - | - | NICHT ANWENDBAR (BN2) / offene Frage | Gang-Pruefer |
| 26 Kills | - | - | offene Frage | Progressions-Pruefer |
| 27 Kampf-LevelMult | indirekt `src/sleeve.js:626` (fester Wert 40) | BN13/14/15 | RISIKO, in SLEEVE-2 enthalten | Gym-Phase 5,6 / 8,4 h |
| 28 Challenge-Option | - | - | NICHT ANWENDBAR | |
| 29 Telemetrie | `src/sleeve.js:883-891, 933-936` | V2 | GENUTZT-FEHLER | SLEEVE-5 |

Zaehlung (29 Zeilen): OPTIMAL 13 (1, 4-8, 10-12, 14, 20-22; Zeile 10 mit RISIKO BN8), GENUTZT-SUBOPTIMAL 7 (9, 13, 15, 16, 18 klein, 27 als Teil von SLEEVE-2, 29 Telemetrie-Fehler), NICHT GENUTZT 3 (17, 19, 26 offen), GENUTZT-TOT 0 (Scope-Pruefer `tools/test-scope-tot.js`: 0 Funde in src/, Lauf 03.10.), NICHT ANWENDBAR 6 (2, 3, 23, 24, 25, 28).

## Befunde

### SLEEVE-1 (FEHLER, P1) - D5-Infiltrate greift nur bei freien Sleeves, und sein Signal ist aus, wenn der Vorrat leer ist

- **Bot:** `src/sleeve.js:726-753` markiert jeden laufenden Vertrag (und jedes Infiltrate) als `laeuftSchon`; die Knappheitsregel steht erst danach (`:768-775`) und greift nur fuer `!laeuftSchon`. Der Kommentar `:707-709` verspricht "geht JEDER Sleeve auf Infiltrate". Das Signal `knappeOperation` (`:710-725`) liest `blade.json.istAktion` (`src/blade.js:1737`) und ist nur gesetzt, solange der Spieler GERADE eine Operation faehrt.
- **Spiel:** Vertragsarbeit endet nur bei Vorrat < 1 (`Work/SleeveBladeburnerWork.ts:44-47`); Infiltrate wirkt auf jede Operation (`Bladeburner.ts:1251-1263`); ein Einbau stoppt die BB-Aktion des Spielers (`Prestige.ts:152-155`) und setzt die Sleeves auf Recovery (`PlayerObjectGeneralMethods.ts:120`).
- **Beleg im Spielstand:** 09:33 `istAktion: Operations/Raid`, Raid-Vorrat 3,7, Sleeve 0 auf Bounty Hunter (Vorrat 135), Sleeve 2 auf Tracking. 07:33 und 08:33: Raid-Vorrat 0,7, `istAktion: Contracts/Retirement` - das Signal waere auch bei Kampfwert 40 aus gewesen. 09:59: Spieler in der Kammer, Signal aus. Sleeve 0 faehrt seit ~08:40 (98 Abschluesse bis 09:19) durchgehend Bounty Hunter (Konsole 09:40-09:59: 33 Fehlschlaege, 9 Erfolge; jeder dritte Fehlschlag "Sleeve was shocked").
- **Folge:** (a) Raid-Phase: kurz (Sleeves fallen ins Infiltrate, sobald ihr Vertrag leer ist; 09:19 lag die Belegung I1 V2 mit 397 Rang/h nahe am Optimum 398). (b) Op-Phase, nach jedem Einbau: alle drei Sleeves auf Vertraegen, waehrend der Spieler stundenlang im Gym wiederaufbaut und danach Assassination verbraucht (BN10: 160-200/h gegen 7,9/h Nachwuchs, Audit 4#5). Die Vertraege tragen dann den Infiltrate-Zuwachs der Vorstunden (+52 je h und Art) und halten die Sleeves 2-6 h fest.
- **Ertrag:** je Stunde, die drei Sleeves in der Op-Phase auf Vertraegen statt auf Infiltrate verbringen, fehlen ~52 Assassinations ~ 26.000 Rang (Audit-4-Raten: ~510 Rang Vorsprung je Lauf) ~ 0,3 h Spielerrate (85.000 Rang/h); geschaetzt 0,6-1,8 h Knotenzeit je Einbau in der Op-Phase. GESCHAETZT (Op-Phase in V2 seit D5 noch nicht beobachtet).
- **Fix-Richtung:** Infiltrate-Entscheidung vor die `laeuftSchon`-Pruefung; Signal aus `blade.js` liefern lassen ("beste Operation ist vorratsgebunden", unabhaengig von der momentanen Aktion), nicht aus `istAktion`.

### SLEEVE-2 (SUBOPTIMAL, P1) - Infiltrate steht hinter Kampfwert 40; die Sleeves trainieren 4-8 h mit 2-7 % Tempo

- **Bot:** `src/sleeve.js:768` (`sleeveKampf >= KONTRAKT_MIN_KAMPF`) umschliesst Vertraege UND den Infiltrate-Rueckfall (`:849-852`); darunter Gym (`:883-900`).
- **Spiel:** Infiltrate braucht keine Werte und nimmt keinen Schaden (`Work/SleeveInfiltrateWork.ts:20-28`); Gym-Exp ist schockskaliert (`Work/SleeveClassWork.ts:31-33`), Schock nach Knotenwechsel 100 (`Sleeve.ts:251`).
- **Beleg:** BN2L1: Sleeves im Gym bis ~09:00 (Kampfwert 4 -> 14 -> 27 -> 39), Schock 98,4 -> 92,9. Raid-Vorrat 39,3 (05:33) -> 17,8 -> 0,7 (07:33) -> 0,7 (08:33). Spieler-Raids 37/h solange Vorrat da war, 16-17/h im Hunger (Konsole 07:29-08:33: ein Raid alle ~3,8 min = natuerlicher Nachwuchs 15,75/h, dazwischen 51 Retirement und 23 Kammerminuten).
- **Ertrag:** LP (Zeit/Ausdauer geeicht, s. Rechnung 9): Spieler allein 124 (07:33) bzw. 134 (08:33) Rang/h Erwartungswert; mit 2 Infiltrate + 1 Kammer 310 bzw. 308, mit 3 Infiltrate 266 (08:33). **+130-190 Rang/h** im Hungerfenster (BN2L1 ~06:50-09:00, ~2,2 h: +300-400 Rang Erwartungswert, ~+40 % des Erwartungsrangs zu diesem Zeitpunkt). In BN13/15 dauert die Gym-Phase 5,6 h, in BN14 8,4 h (Rechnung 7). Umrechnung in Knotenzeit geschaetzt ~1 h je V2-Lauf. Rechnungsteile GERECHNET_GEEICHT, Zeitumrechnung geschaetzt.
- **Fix-Richtung:** Infiltrate (und Diplomacy, SLEEVE-3) ab Beitritt ohne Kampfwert-Schwelle; das Gym nur noch, wenn keine Operation vorratsgebunden ist und Vertraege das Beste waeren.

### SLEEVE-3 (NICHT_GENUTZT, P1) - Diplomacy per Sleeve gegen das Raid-Chaos

- **Bot:** fehlt. `src/sleeve.js:655-668` kennt waehrend `aufraeumen` nur Tracking und Infiltrate; aufgeraeumt wird vom Spieler (`src/blade.js:107-108, 2900-2901`, Hysterese 50/47).
- **Spiel:** Raid multipliziert das Chaos mit 1+U(1..5) % je Lauf, Erfolg oder nicht (`Bladeburner.ts:830-842`); ueber 50 steigt die Schwierigkeit aller Aktionen mit sqrt(1+chaos-50) (`Actions/Action.ts:94-101`); Sleeve-Diplomacy senkt das Chaos der BB-Stadt um 1,03 %/min bei Charisma 2 (`Bladeburner.ts:735-743, 1185-1196`), ohne Werte, ohne Schaden.
- **Beleg:** Chaos Sector-12 2,5 -> 6,3 -> 11,4 -> 23,0 -> 29,1 -> 38,3 -> 49,1 (06:33-09:59), vom Modell aus den Raid-Zaehlern nachgerechnet (Rechnung 10). Ab 50 kostet jeder Raid den Spieler ~2,3 min Diplomacy (ln 1,03 / ln(1/0,9874)).
- **Ertrag (LP mit Chaos-Gleichgewicht, Stand 09:19):** 1 Infiltrate + 2 Diplomacy **328 Rang/h**; heutige Belegung 2 Infiltrate + 1 Vertrag 211, 1 Infiltrate + 2 Vertraege 245, 3 Vertraege 270. **+117 Rang/h** gegen die heutige Belegung (+55 %), +58 gegen 3 Vertraege. GERECHNET_GEEICHT (Chaos, Raid-Chance, Ausdauer, Infiltrate, Aktivitaetsmix je einzeln gegen Spielstand geeicht; das LP nimmt einen optimal handelnden Spieler an).
- Ohne Diplomacy ist Infiltrate im Chaos-Regime sogar schaedlich (211 < 270): mehr Raids erzeugen mehr Aufraeumarbeit fuer den Spieler.

### SLEEVE-4 (NICHT_GENUTZT, P3) - "Support main sleeve" statt Recruitment fuer chance-gebundene Black Ops

- **Bot:** `src/sleeve.js:69-70` (bewusst kein Support), Rekrutierer `:134-170, 759-767`.
- **Spiel:** Support gibt sofort +1 Trupp (`Work/SleeveSupportWork.ts:8-13`, `Bladeburner.ts:745-751`); Black-Op-Verluste treffen erst Menschen, Sleeves halten den Trupp (`TeamCasualties.ts:52-57`), Recruitment-Chance zaehlt Sleeves nicht mit (`GeneralActions.ts:28-29`).
- **Ertrag:** Feuerzeit bei Luecke gleichverteilt bis ln(1,2), g = 0,115/h (Bot-Messung): 1 Rekrutierer (cha 2) 21,6 min, Support 3 18,6 min, Support 2 + 1 Rekrutierer 14,5 min -> **~7 min je chance-gebundener Black Op**, dazu kein Nachrekrutieren nach Verlusten. GERECHNET_UNGEEICHT (Rekrutierung in BN2L1 noch nicht beobachtet). Kosten: die Support-Sleeves fehlen solange bei Infiltrate/Diplomacy.

### SLEEVE-5 (FEHLER, P3) - Telemetrie meldet "arm" fuer jeden beschaeftigten Sleeve

- **Bot:** `gymGeldReicht` wird nur gerechnet, wenn `!ok` (`src/sleeve.js:883-891`); `grund` (`:934`) setzt "arm", sobald `gymGeldReicht` false ist - also fuer jeden Sleeve auf Vertrag/Infiltrate.
- **Beleg:** Spielstand 09:19-09:59: alle drei Sleeves `grund: arm` bei 5,8-9,4 Mrd $ Konto.
- **Ertrag:** kein Rang; Fehldiagnoserisiko beim /bb-Besuch (`tools/checkin.js:166` liest die Datei). Aufwand S.

### SLEEVE-6 (RISIKO, P3, BN8) - Kaltstart-Shoplift bringt in BN8 0 $ und verdraengt die Schockerholung

- **Bot:** `src/sleevecrime.js:25, 47-48` setzt Shoplift in allen Knoten (`src/registry.json:174-197`: knoten "alle", phase "kaltstart").
- **Spiel:** BN8 `CrimeMoney: 0` (`BitNode.tsx:769`); das Spiel setzt die Sleeves nach Knotenwechsel und Einbau auf Recovery (`PlayerObjectGeneralMethods.ts:120`), Recovery baut 3-fach ab (`SleeveRecoveryWork.ts:13-16`).
- **Bekannt:** BAUSTELLEN "Sleeve-Faktionswahl verfeinern" (27.09., dritter Punkt bewusst hingenommen: ~200 statt ~411 Rep/h je Sleeve ueber 12 h). Neu: in BN8 entfaellt der Geldgrund ganz - dort ist der Tausch reiner Verlust (~+200 Rep/h je Sleeve, 3 Sleeves, 12 h ~ 7.000 Rep). GERECHNET_UNGEEICHT (Zahlen aus `tools/sleeve-rechnung.js`). Fix: `knoten` ohne 8 oder `OHNE_VERBRECHENSGELD` auch in sleevecrime.js; vor BN8 (zusammen mit C6).

## Rechnungen und Eichung (Soll/Ist)

Alle Zahlen aus `node tools/audit/sleeve-bb.mjs` und `node tools/audit/sleeve-lp.mjs [07-33_hourly|08-33_hourly]`.

1. **Gym + Schockabbau** (06:33 -> 07:33, 3.600,4 s, alle drei Sleeves im Powerhouse):
   Schockabbau Soll 1,8288 / 1,8406 / 1,8353, Ist 1,8291 / 1,8409 / 1,8356.
   Kampf-Exp Soll 1.546,9 / 1.556,9 / 1.552,4, Ist 1.548,7 / 1.558,7 / 1.554,2 (Rest = Sync-Anteil der anderen Sleeves).
2. **Sleeve-Vertraege** (Chance `Action.ts:169-199`, Dauer `:104-121`):
   Tracking Sleeve 2 09:19->09:33, 60 Versuche: Erfolge Soll 16,0 +- 3,4, Ist 18; Dauer Soll 13/14 s, Ist 13,62 s.
   Bounty Hunter Sleeve 0 09:19->09:33, 31 Versuche: Soll 4,8 +- 2,0, Ist 4; Dauer Soll 26/27 s, Ist 26,36 s.
   Bounty Hunter Sleeve 0 09:33->09:59, 58 Versuche: Soll 8,4 +- 2,7, Ist 10; Dauer Soll 27/28 s, Ist 27,25 s.
3. **Spieler-Raid**: 09:19->09:59 27 Versuche, Erfolge Soll 3,5 +- 1,8, Ist 5; ueber 05:33-09:59 124 Versuche Soll ~16,7, Ist 19. Dauer Soll 77 s = blade.json 77.000 ms. Rang je Erfolg Soll 80,53 (Konsole 75,1-86,3, addOffset +-10 %), Verlust 3,66 (Konsole 3,48-4,01).
4. **Infiltrate-Zufluss**: Raid-Vorrat 09:46 -> 09:59 (765,6 s, 2 Sleeves): Soll 4,0 + 9,02 + 3,35 - 7 = 9,41, Ist 9,59.
5. **Je Sleeve bei Kampfwert 40 (09:19)**: Tracking 33-34, Retirement 30-31, Bounty Hunter 29-30 Rang/h; Field Analysis 12,0. Bei Kampfwert 26 (07:33): 19-21 Rang/h.
6. **Trupp**: Rekrutierer cha 2: Mann 1..6 nach 5,0 / 12,2 / 23,1 / 37,7 / 55,9 / 77,7 min; Feuerzeiten s. SLEEVE-4.
7. **Gym bis Kampfwert 40** (4 Werte, Schock ab 100): LevelMult 1: 3,93 h (Ist BN2L1 ~4,3 h inkl. Start nach sleevecrime), mit 1,15 h Recovery zuerst 2,93 h; 0,7: 5,57 / 4,15 h; 0,5: 8,38 / 6,24 h.
8. **Karma/Kills**: Homicide Sleeve Kampf 40: p 0,21, Karma 7,6/h bei sync 1 % (756/h bei 100 %), Kills 252/h (nicht sync-skaliert). BB-Kill-Aktionen -1 Karma je Erfolg, keine Kills (Spielstand: kills 0, Karma -145).
9. **LP-Eichung Spieler allein** (Raid nur natuerlicher Nachwuchs): Soll 15,8 Raids/h, 49,9-50,6 Retirement/h, 23,7-26,4 Kammerminuten/h; Ist 07:33-08:33 17 Raids, 51 Retirement, 23 Kammerminuten. Passive Ausdauer Soll 0,02546/s, Ist 0,02543/s (08:30:25 -> 08:31:25, Kammer 0,747 abgezogen).
10. **Chaos-Eichung** (Raid x E[ln(1+U(1..5)/100)], Bounty +0,02, Retirement +0,04): Soll/Ist 7,02/6,27 | 11,45/11,43 | 20,21/22,96 | 30,01/29,07 | 39,13/38,30 | 48,70/49,10.
11. **LP-Ergebnis 09:19** (Rang/h, I=Infiltrate, K=Kammer, V=Vertrag, D=Diplomacy):
    ohne Chaosbindung I1K1V1 398, I1V2 397, I2K1 367, I2V1 362, I3 328, V3 270, Spieler allein 166;
    mit Chaosbindung I1D2 328, I1V1D1 291, V3 270, I1V2 245, I2V1 211, I3 176.

## Korrekturen an bestehenden Notizen

- `nodes/BAUSTELLEN.md:2175` (Nachtrag 22.09.): "JEDER Einbau setzt Shock auf 100 und Sync auf Memory zurueck (Sleeve.ts:251-253)" ist falsch. `Sleeve.prestige()` wird nur aus `prestigeSourceFile` gerufen (`PlayerObjectGeneralMethods.ts:148`); der Einbau ruft nur `recalculateNumberOfOwnedSleeves` und setzt die Aufgabe (`:118-120`). `src/sleeve.js:347-351, 620-625` sagt das schon richtig (Backup-Beleg 27.09.). Das Urteil "Sync/Recovery lohnt nicht" bleibt (44 h je Sleeve gegen 22-50 h Knoten), nur die Begruendung war falsch. ENTSCHIEDEN wird nicht angefasst.
- `nodes/AUDIT-ROADMAP-2026-08-24.md:140-142` Punkt 9 ("dass Sleeve-Verbrechen das Spieler-Karma anteilig fuellen, nicht nachgewiesen"): nachgewiesen, `SleeveCrimeWork.ts:46` `Player.karma -= crime.karma * sleeve.syncBonus()` - bei sync 1 % praktisch nichts.

## Bewusst kein Befund

- Sleeve-Augs, Recovery, Sync, Memory: in V2 wertlos, sobald Infiltrate/Diplomacy die Aufgaben sind (keine Wertabhaengigkeit); Covenant nur BN10.
- Field Analysis, Training, Kammer per Sleeve: gerechnet dominiert (Tabelle 2).
- Vertragswahl nach Vorrat (`src/sleeve.js:788-792`): Rang/s je Vertrag liegt bei p < 1 fast stufenunabhaengig (rewardFac/difficultyFac^2 ~ 1), die Wahl nach Vorrat ist richtig.
- Der alte V2-Rueckfall `sleeveMin < 40 ? Shoplift : Mug` (`src/sleeve.js:925-927`) greift nur bei leerem Konto in V2 - selten, nicht gerechnet.
- Stadtwahl von blade.js (Sector-12 587 Mio gegen Volhaven 1.485 Mio Bevoelkerung = Raid-Chance x1,92 ueber `(pop/1e9)^0,7`): Bladeburner-Bereich, nur als offene Frage.

## Offene Fragen (fuer andere Pruefer)

- Gang ausserhalb BN2: Karma -54.000 kommt praktisch nur vom Spieler (Homicide ~16 h solo); Sleeves bringen bei sync 1 % 7,6 Karma/h. Ein Gang-Plan fuer V2-Knoten muesste Sync (26 h) einrechnen.
- Kill-Bedingungen Speakers for the Dead (30) / The Dark Army (5): ein Sleeve auf Homicide erfuellt sie in Minuten (Kills nicht sync-skaliert); ob die Kampf-Augs dieser Faktionen in V2 gebraucht werden, ist Progressionsfrage.
- Stadtwahl und Raid als Hauptoperation in BN2 (blade.js `wert()` nutzt popEst linear): Bladeburner-Pruefer.
- Optimale Zahl der Diplomacy-Sleeves haengt an der Raid-Rate des Spielers: ~21 Raids/h je Diplomacy-Sleeve halten das Chaos (ln 0,0104*60 / ln 1,03).
