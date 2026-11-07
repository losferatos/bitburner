# Audit "ungenutzte Mechaniken" - BN8 (Stufen 1-3, V1) - 07.11.2026

Nur lesend. Rechenskripte (nur im Scratchpad): `audit/bn8/sim.js` (Nachbau von `StockMarket.ts` processStockPrices + `Stock.ts`
+ Transaktions-Forecast-Bewegung), `meta.js` (parst `InitStockMetadata.ts`), `exp1-3.js`, `augs.js`.

WICHTIG VORAB: Es gibt schon einen BN8-Audit vom 03.10.: `nodes/audit-2026-10-03/bn-bn15-8.md` (BN8-1 bis BN8-6).
`src/boerse.js` ist seit 04.09. unveraendert, `bn4rep.js` kennt kein Depot, `grep boerse src/` findet ausser `punish.js` keinen Bezug,
und `BAUSTELLEN.md` fuehrt BN8-1..6 NICHT als Punkte. Diese Befunde sind also noch offen und werden hier nur bestaetigt, nicht neu gezaehlt.
Neu in diesem Bericht: Befund 2 (Darknet-promoteStock), Befund 3 (Go/Daedalus quantifiziert), Befund 4 (Go/w0r1d), Befund 5 (Grafting-Ersatz fuer die Einbauleiter), plus die Eichung.

## Eichung (bevor argumentiert wird)

- Sim gegen Closed-Form: mittlere Log-Rendite je Tick fuer b=true, otlkMag 19 (p=0,69), mv 0,45: Sim 0,0008547, analytisch (2p-1)*E[av]=0,000855. OK.
- Sim gegen den frueheren Audit (unabhaengiger Code, `boerse-sim.mjs`): Phase 1 ohne 4S, bot-Regel, 250 Mio -> 26 Mrd.
  Frueher 12,6 h (11,8-16,1); hier Median 12,7 h (24 Seeds, p25 11,2 / p75 13,3) und 11,7-13,1 h in drei weiteren Laeufen. Deckt sich.
- Go-Formel `CalculateEffect` (`Go/effects/effect.ts:16-22`) nachgebaut: Doku go.js BN14.1 n=500 +22 % -> Nachbau 22,5 %; n=2000 +42 % -> 41,6 %;
  Live BN13 laut go.js-Kommentar +90,6 % bei n=74.000 (Tetrads 0,7, SF14 x2, GoPower 1) -> Nachbau 90,7 %. Geeicht gegen einen Spielstandswert.
- Skill-Formel `calculateSkill` (`PersonObjects/formulas/skill.ts:12`): exp=0 -> Level 1, stimmt mit Spiel.
- Nicht geeicht: Darknet-Wirkung (Befund 2) ist nur die Formel `getDarknetVolatilityMult` (`DarkNet/effects/effects.ts:197-201`) im Sim; kein Spielstandswert vorhanden.

## BN8-Multiplikatoren (BitNode.tsx:770-799) - was lebt, was tot ist

Nur diese Felder weichen vom Standard 1 ab: CloudServerSoftcap 4; CompanyWorkMoney 0; CrimeMoney 0; HacknetNodeMoney 0; ManualHackMoney 0;
ScriptHackMoney 0,3; ScriptHackMoneyGain 0; CodingContractMoney 0; FavorToDonateToFaction 0; InfiltrationMoney 0; CorporationValuation 0;
CorporationSoftcap 0; CorporationDivisions 0; BladeburnerRank 0; DarknetLabyrinthRewardsTheRedPill 0; DarknetMoneyMultiplier 0; GangSoftcap 0;
GangUniqueAugs 0; StaneksGiftExtraSize -99. Alle anderen (HackingLevelMultiplier, FactionWorkRepGain, AugmentationRepCost/-MoneyCost,
WorldDaemonDifficulty, DaedalusAugsRequirement=30) = 1/Standard. Lebend: Aktien (einzige Geldquelle), Spenden ab Favor 0, Hacking-Exp aus Skripten,
Faktionsrep per Arbeit, Grafting (Flatpreis), Go.

## Befundliste (sortiert nach geschaetztem Zeitgewinn, BN8.1-8.3 zusammen)

### 1. Bekannt/offen (Audit 03.10., hier nur Bestaetigung + eigene Zahl): Boersenregel und Einbauzyklus
| | |
|---|---|
| Mechanik | `boerse.js` Handelsregel; Kapital je Aktie; Einbau mit Depot |
| Beleg Quellcode | `StockMarket.ts` processStockPrices (Drift je Tick = (2f-1)*E[av], E[av]=0,5*mv/100); Transaktionen verschieben nur Forecast (`StockMarketHelpers.ts` processTransactionForecastMovement), kein direkter Preisimpact; `Prestige.ts` setzt bei jedem Einbau Geld=250 Mio und initStockMarket; 4S-API ueberlebt Einbauten (nur `prestigeSourceFile` setzt zurueck, `PlayerObjectGeneralMethods.ts:163-166`) |
| Bot tut | `boerse.js:74-91` Historie 40, Kauf ab 0,575, Verkauf <0,5, 25 % je Aktie, 15 % Reserve (laut Audit BN8-2 wirkt die Reserve nicht), nur Long, `bn4rep` sieht nur Bargeld |
| Gewinn | Eigene Sim (24 Seeds, Phase 1 bis 26 Mrd): aktuell 12,7 h; hist30 12,1; Kauf >=0,65 12,1; **share 1,0: 10,9 h; share 1,0 + Reserve 0,02 + hist30: 9,2 h (Median, im Folgelauf 11,7 -> 9,2)** = -2,5 bis -3 h in Phase 1. Shorts: 12,7 h = 12,7 h, also kein Hebel (bestaetigt BN8-4). Einbau-Falle BN8-1 (+70-100 h je Lauf laut Audit) und 4S-Kauf nach Vermoegen (BN8-3) bleiben die grossen Posten; ich habe sie nicht neu gerechnet. |
| Aufwand/Risiko | klein (Parameter in boerse.js) / BN8-1 mittel |
| Sicherheit | mittel (Sim geeicht, aber nicht gegen echten BN8-Lauf; Bot hat BN8 nie gespielt) |

### 2. NEU: Darknet `promoteStock` hebt die Volatilitaet - Faktor auf die Rendite jeder Position
| | |
|---|---|
| Mechanik | `ns.dnet.promoteStock(symbol)` -> `DarknetState.stockPromotions[symbol]`; in jedem Tick `volatility = stock.mv * getDarknetVolatilityMult(symbol)` |
| Beleg Quellcode | `NetscriptFunctions/Darknet.ts:581-606` (Wartezeit `max(8000*600/(600+cha),200)` ms, Ladung `threads*(500+cha)/500`, nur auf einem Darknet-Server lauffaehig `expectRunningOnDarknetServer`); `DarkNet/effects/effects.ts:197-201`: Mult = 1 + (1-e^(-0,001c)) + 2(1-e^(-0,00015c)), Maximum 4; Verfall x0,4 je 75-Tick-Zyklus (`StockMarket.ts` stockMarketCycle -> `scaleDarknetVolatilityIncreases(0.4)`); `StockMarket.ts:~255` nutzt es in processStockPrices; Zugang: `darknetAuthUtils.ts:6-8` - SF15 reicht (canAccessBitNodeFeature(15)), kein Darkscape noetig |
| Bot tut | nichts. Kein `dnet`-Gewerk in `src/` (nur Erwaehnungen), `grep "promoteStock"` leer |
| Gewinn | Drift = (2f-1)*0,5*mv*Mult/100, also linear in Mult. Sim (`exp3.js`, 20 Seeds): Mult 2 auf die 10 groessten Titel: 26 Mrd nach **6,7 h statt 11,7 h**, 1 Bio nach **11,9 h statt 19,7 h**; Mult 2 auf alle 33: 4,7 h / 7,5 h; Mult 3 alle: 2,9 h / 4,2 h. Realistisch Mult ~2 (c ~1150 Ladungen je Titel) auf wenige Titel: -4 bis -5 h Phase 1 je Lauf und -3 bis -4 h je Folgezyklus => grob **-8 bis -12 h je BN8-Stufe, -25 bis -35 h Route**. Unterhalt: ~690 Ladungen je 7,5 min je Titel, also ca. 1,5 Ladungen/s je Titel. |
| Aufwand/Risiko | HOCH: Skript muss auf einem erreichten Darknet-Server laufen (Auth-Minispiele, Instabilitaet/Timeouts, `offlineServerHandling`), RAM der `dnet`-Funktionen ungemessen, Charisma-Wert unbekannt, kein vorhandener Darknet-Code. Fehlermodus: Server weg/Neustart nach Einbau, dann stillt der Effekt. |
| Sicherheit | niedrig-mittel (Formel aus Quelle, Sim ungeeicht gegen Spiel; Aufwand/Machbarkeit der Serverkette ungeprueft) |

### 3. NEU/quantifiziert: Go gegen Daedalus (faction_rep) in BN8
| | |
|---|---|
| Mechanik | Node Power gegen "Daedalus" -> `mults.faction_rep` und `company_rep` x effect; `repFromDonation` multipliziert mit `person.mults.faction_rep` |
| Beleg Quellcode | `Go/effects/effect.ts:16-22` (Basis 0,002, bonusPower Daedalus 1,1 aus `Go/Constants.ts`, SF14>0 verdoppelt, GoPower in BN8 = 1), `:84-101` calculateMults; `Faction/formulas/donation.ts:7-9` |
| Bot tut | `go.js:125` `GO_NODES=[14,13,15]`, Gegner fest "Tetrads" (`go.js:145`) - in BN8 laeuft Go nicht. (Audit 10/03 nennt STGO-4, aber ohne Zahl.) |
| Gewinn | Nachbau, SF14.3: n=500 +17,7 %; 1000 +24,2 %; 2000 +32,7 %; 5000 +48,2 %; n=74.000 (wie live BN13-Tetrads) **+143 %**. TRP-Spende = 2,5e12/(m*(1+g)): bei m=2,0 und g=0,33 statt 0 => ~1250 G -> ~940 G (-310 G); bei g=1,43 => -730 G. In Zeit: im 1-Bio-Bereich verdoppelt sich das Vermoegen in ~1,3-1,9 h (Sim: 500G->1T in 1,3 h), also **-0,6 bis -1,5 h je Stufe nur fuer die TRP-Spende**, dazu der Rep-Teil jeder Aug-Spende der Stufe: grob **-1 bis -3 h je Stufe, -3 bis -9 h Route**. Node Power wird bei jedem Einbau 0 (`go.js:33`), muss je Zyklus neu aufgebaut werden (n=2000 ~ 20-30 Siege 7x7 laut go.js-Rechnung). m (faction_rep-Mult) ist nicht gemessen - Annahme 1,5-2,5. |
| Aufwand/Risiko | klein: `GO_NODES` + `OPPONENT` knotenabhaengig ("Daedalus" in BN8). Risiko: Werkbank-RAM neben `boerse.js` (21 GB), Niederlagenserie halbiert Node Power je Spiel. |
| Sicherheit | mittel (Formel geeicht; m und Zeitwert grob) |

### 4. NEU: Go gegen w0r1d_d43m0n nach dem TRP-Einbau (Hacking-Level fuer den Ausgang)
| | |
|---|---|
| Mechanik | `mults.hacking` x effect (bonusPower 2); Gegner erst nach installierter Red Pill waehlbar |
| Beleg Quellcode | `effect.ts:94-96`; `netscriptGoImplementation.ts:359` (verlangt TRP); `boardState.ts:26-30` (Brett erzwungen 19x19, Spezialform), `getHandicap` 7 Vorgabesteine, Komi 9,5 (`Constants.ts`); `Go.ts` prestigeAugmentation nullt Node Power |
| Bot tut | nichts; go.js kennt nur Tetrads |
| Gewinn | Nachbau SF14.3: n=500 +32 %; 2000 +60 %; 5000 +88 %; 74.000 +129 %. Erfahrung fuer Level 3000: exp = e^((3000/M+200)/32)-534,6; ein Faktor 1,6 auf M senkt den noetigen exp-Wert um 80x (M=8), 350x (M=6), 6600x (M=4). Die End-Kletterpartie nach dem TRP-Einbau (Exp-Reset auf Level 1, `Prestige.ts:44`) koennte damit von Stunden auf deutlich weniger schrumpfen - wenn Siege moeglich sind. Nicht in Stunden beziffert: M des Bots am Ende und die Exp-Rate stehen nicht in meiner Hand, Siegchance vs. komi 9,5 auf 19x19 mit 7 Vorgabesteinen ist ungemessen (go.js testet nur 7x7 gegen Tetrads). |
| Aufwand/Risiko | mittel-hoch (19x19-MCTS, Zeit je Partie; Punktzahl je Sieg gross: ~100 Punkte x Schwierigkeit 2,5 = 250-750 Node Power je Sieg, also wenige Siege reichen) |
| Sicherheit | niedrig (Wirkung rechnerisch sicher, Machbarkeit offen). Auch fuer BN1/5/12-Endphasen gedacht, nicht nur BN8. |

### 5. NEU: Grafting statt Einbauleiter fuer die 30 Pflicht-Augs (Daedalus-Einladung)
| | |
|---|---|
| Mechanik | `haveAugmentations(30)` zaehlt `p.augmentations.length` (installiert, auch gegraftet); Grafting kostet `baseCost*3`, KEINE Rep, KEINEN Queue-Aufschlag, kein Einbau, kein Reset |
| Beleg Quellcode | `Faction/FactionJoinCondition.ts:123-130` (zaehlt `augmentations`, NFG als ein Eintrag), `DaedalusAugsRequirement=30` unveraendert in BN8; `PersonObjects/Grafting/GraftableAugmentation.ts:20-30`, `Constants.ts:96-97`; Kauf dagegen `AugmentationHelpers.ts:29-31,157` (1,9*0,93 hoch Warteschlange); TRP nicht graftbar (`GraftingHelpers.ts`) |
| Bot tut | `graftauto.js` nur `V2`/`normal` (registry) mit kampflastigem `graftplan.json`; in BN8 (V1) kein Grafting, die 30 Augs kommen ueber Kauf+Einbau-Zyklen (Audit BN8-1: 3-4 grosse bzw. bis ~10 kleine Zyklen) |
| Gewinn | `augs.js` (parst `Augmentations.ts`, grob!): 97 graftbare Augs; die 30 mit bestem Zeit/Geld-Kompromiss kosten ~12 G und ~18 h seriell (Zeit je Aug (1h*log2(Summe Mults)+30min)/2, Intelligenz-Bonus bei Int 170 nur +10 %); die 30 nach Zeit sortiert ~14 h. Kauf von 30 Augs in EINEM Stapel (Preis*1,767^i) waere ~2,7e15 $, also unmoeglich - deshalb die Leiter. Grafting laeuft neben der Boerse (Skript), braucht den Spieler aber exklusiv. Ersatz fuer 2-3 der Leiter-Zyklen (je 8-17 h bis 1 Bio): **-15 bis -40 h je Stufe, -45 bis -120 h Route (sehr unsicher)**. |
| Aufwand/Risiko | hoch: Plan fuer Hacking-Augs, Reise New Tokyo, Entropie (`graftplan.json` kennt sie, violet Congruity zuerst), Hacking >= 2500 fuer die Daedalus-Einladung bleibt (installierte Hacking-Augs fehlen dann evtl.), TRP-Einbau bleibt mindestens ein Einbau. |
| Sicherheit | niedrig (Parse grob, Kopplung mit Hacking-2500-Tor und Rep nicht durchgerechnet; als Befund, nicht als Empfehlung zum Umplanen) |

## Frage 3: Registry-Gating und harte Knotenpruefungen gegen Knoten 8

- Alles `knoten:"alle"`: bn4net, guard, wakelock, cdump/csolve, darkweb, sleevecrime, hashes (precondition requiresFeature 9), shop, ausgang, weaken-Worker, figwatch, bbtrain, sleeve, hacknet, bn4life, homegrow, contracts, export, popups, bn4rep, bn4door.
- Knoten-eingeschraenkt: `boerse.js [8]/V1` (laeuft nur in BN8, richtig); `gang.js [2]/V2`; `corp.js [3]`; `go.js [14,13,15]` (BN8 fehlt -> Befund 3); `blade.js` und `graftauto.js` nur `V2` (BN8 = V1, daher aus; richtig fuer blade, Befund 5 fuer graftauto).
- Harte Pruefungen in BN8 geprueft: `hashes.js:139` sperrt BN8 (richtig, Hashes = 0); `hacknet.js` kauft nur nach `hacknetNachEinbau(knoten)` (nur BN9), im BN8 nur RAM fuer `exit.js` (richtig); `sleeve.js:396` `OHNE_VERBRECHENSGELD=[8]` (richtig).
- Geschlossene Fehlerklasse "Gewerk faehrt in BN8 nicht an": kein weiteres Gewerk gefunden, das in BN8 fehlt, obwohl es dort etwas braechte, ausser go.js (Befund 3/4) und graftauto.js (Befund 5). Werkzeug waere in der Lage gewesen, es zu zeigen: die Registry-Tabelle ist vollstaendig geparst (`node -e` ueber `registry.json`).

## Geprueft, lohnt nicht / tot in BN8

- Hacknet/Hashes (Sell for Money, Exchange for Corp, Improve Studying ...): HacknetNodeMoney 0 -> `calculateHashGainRate` 0 (`Hacknet/formulas/HacknetServers.ts:16`); tot, Bot sperrt richtig.
- Gang: GangSoftcap 0 macht den Exponenten 0, `pow(x,0)=1` -> Geld und Respekt je Aufgabe nur 1 (`Gang/formulas/formulas.ts:27,71`); GangUniqueAugs 0 (`FactionHelpers.tsx:197`); Gang-Fraktion bringt keine TRP. Tot.
- Corporation: CorporationDivisions 0 (`Corporation.ts:38`), Softcap <0,15 versteckt Gruendung (`SpecialLocation.tsx:398`, `Corporation/helpers.ts:40`). Tot.
- Coding Contracts: Geldbelohnung nicht angeboten (`ContractGenerator.ts:186`), nur Rep (Faktion/alle/Firma) - `contracts.js` laeuft unveraendert weiter und liefert etwas Faktionsrep; kein Umbau noetig.
- Infiltration: InfiltrationMoney 0 (`Infiltration/formulas/victory.ts:24`); der Rep-Tausch hat keinen BN-Mult und bliebe nutzbar, ist aber nur per UI/DOM spielbar und im Bot nicht vorhanden; nicht beziffert, nicht empfohlen.
- Crime/Firmenarbeit/Manuelles Hacken: 0 (Work/Formulas.ts:73,138). Skript-Hack: Spielergeld 0 (ScriptHackMoneyGain 0), liefert nur Exp und Kursbewegung.
- Stanek: Groesse 9-99+SF13 < 0 (`CotMG/StaneksGift.ts:23`, `Constants.ts BaseSize 9`). Unbenutzbar.
- Bladeburner/V2: BladeburnerRank 0 -> Raenge nur 0 (`Bladeburner/Formulas.ts:13-25`), Beitritt/Ort versteckt (`SpecialLocation.tsx:106`). V2 in BN8 unmoeglich (nur Befund).
- Darknet: DarknetMoneyMultiplier 0, 4S-Cache in BN8 ausgeschlossen (`cacheFiles.ts:165`), Labyrinth-TRP 0 (BitNode 786). Nur promoteStock (Befund 2) bleibt.
- Short-Verkauf und Limit-/Stop-Orders: ohne SF8 in BN8 frei (`NetscriptFunctions/StockMarket.ts:151,163,178,192,204`). Shorts bringen in der Sim nichts (12,7 h gegen 12,7 h); Orders bringen nur Tick-genaue Ausfuehrung statt 6-s-Abfrage - gering.
- `grow {stock:true}`: verschiebt Forecast-Forecast um 0,1 mit Wahrscheinlichkeit moneyGrown/moneyMax (`PlayerInfluencing.ts:24-61`, `NetscriptFunctions.ts:306` - in dieser Fassung steht der Einfluss nur im grow-Pfad, nicht im Hack-Pfad). Wirkung klein gegen Befund 2, RAM-Kosten fuer Skripte; nicht verfolgt.
- Intelligenz: bei Int ~170 nur +10 % Graftingtempo (`graftingIntBonus`); kein Hebel.
- Stufe-3-SF8 (Shorts/Orders anderswo): Route endet mit BN8.3, nicht anwendbar (Audit-Vorarbeit).
- Daedalus-Spende ab Favor 0: `ns.getFavorToDonate()` liefert 0 (`NetscriptFunctions.ts:1415`), `bn4rep.js:1391,1420` liest die Schwelle live; Bot nutzt es korrekt (Spendenrecht-Logik). Kein Befund.
