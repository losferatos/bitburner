# Teil 2a - Geld- und Ruf-Mechaniken: was brachlag oder zu spaet kam (Lauf 2)

Stand 12.11.2026. Auftrag C6/C7 aus `CHRONIK.md`. Spielquelle: `reference/v301/src` (Tag v3.0.1).
Nur gelesen und in `scratchpad/audit2a/` gerechnet, nichts im Projekt ausser dieser Datei veraendert,
nichts aus `tools/`, `src/`, `sync/` ausgefuehrt, kein Browser, keine Netzzugriffe.

Eigene Rechner (alle in `C:\Users\erche\AppData\Local\Temp\claude\0f034fb3ad50e625\feee1757-fe7d-46ac-8a39-80b39fc941eb\scratchpad\audit2a\`):

| Datei | Was | Eichung |
|---|---|---|
| `mkt.mjs` + `sim.mjs` | der ORIGINAL-Quelltext des Aktienmarkts (`Stock.ts`, `StockMarketHelpers.ts`, `StockMarket.ts`, `InitStockMetadata.ts`, v3.0.1) per `stripTypeScriptTypes` ausfuehrbar gemacht, Handelsregel nach `src/lib/handel.js` (Rang (2f-1)*mv, max. 50 % je Titel, Kursfilter ohne 4S) | gegen 4 reale BN8-Zyklen aus `backups/` (Abschnitt 1) |
| `bnmult.mjs` | liest alle 15 Knotenmultiplikatoren aus `BitNode.tsx` v3.0.1 (`bnmult.json`) | gegen Handliste, Abschnitt 0 |
| `infil.mjs`, `infil2/3/4.mjs` | Infiltrationsformeln (`victory.ts`, `game.ts`) mit Knotenfaktoren und echten Kampfwerten aus den Staenden | gegen die dokumentierten Werte von `netz-calc.mjs` (4 Stellen), NICHT gegen das Spiel |
| `casino.mjs` | `WHRNG` + Roulette (`RNG.ts`, `Roulette.tsx`) | gegen die dokumentierte Spinzahl (31-33), NICHT gegen das Spiel |
| `scan.mjs`, `income.mjs`, `bn8.mjs`, `bn15.mjs`, `sl.mjs` | Einnahmen/Ausgaben je Knoten, BN8-Depotverlauf, BN15-Raenge, Sleeve-Sync aus den Staenden | direkte Messung |
| `hours.mjs` | Stundenmodell (Abschnitt 8) | UNGEEICHT |

## 0. Knotenmultiplikatoren (aus `BitNode.tsx` v3.0.1 gezogen, nicht abgeschrieben)

| BN | AugGeld | AugRuf | BladeRang | InfilGeld | InfilRuf | HackGeld (ServerMaxMoney x ScriptHackMoney) | GangSoftcap | GangUniqueAugs | Favor-Schwelle |
|---|---|---|---|---|---|---|---|---|---|
| 2 | 1 | 1 | 1 | 3 | 1 | 0,08 | 1 | 1 | 150 |
| 3 | 3 | 3 | 1 | 1 | 1 | 0,04 x 0,2 | 0,9 | 0,5 | 75 |
| 4 | 1 | 1 | 1 | 1 | 1 | 0,1125 x 0,2 | 1 | 0,5 | 150 |
| 6 | 1 | 1 | 1 | 0,75 | 1 | 0,2 x 0,75 | 0,7 | 0,2 | 150 |
| 7 | 3 | 1 | 0,6 | 0,75 | 1 | 0,2 x 0,5 | 0,7 | 0,2 | 150 |
| 8 | 1 | 1 | 0 | 0 | 1 | - (nur Boerse) | 0 | 0 | 0 |
| 9 | 1 | 1 | 0,9 | 1 | 1 | 0,01 x 0,1 | 0,8 | 0,25 | 150 |
| 10 | 5 | 2 | 0,8 | 0,5 | 1 | 1 x 0,5 | 0,9 | 0,25 | 150 |
| 11 | 2 | 1 | 1 | 2,5 | 2,5 | 0,01 x 1 | 1 | 0,75 | 150 |
| 13 | 1 | 1 | 0,45 | 1 | 1 | 0,3375 x 0,2 | 0,3 | 0,1 | 150 |
| 14 | 1,5 | 1 | 0,6 | 0,75 | 1 | 0,7 x 0,3 | 0,7 | 0,4 | 150 |
| 15 | 3 | 1 | 0,2 | 1 | 1 | 0,8 x 1 | 1 | 0,3 | 150 |

v3.0.1 gegen den spaeteren Quellstand (`reference/bitburner-src`) verglichen: `BitNode.tsx` nur Textaenderungen,
`StockMarket.ts` ein Aufraeumschritt in `deleteStockMarket`, `Gang/data/tasks.ts` nur Typen, `Infiltration` nur das
WireCutting-Modell und Farbdarstellung (VERS-3 bleibt offen). Die Mechaniken dieser Datei sind in beiden Staenden gleich.

## 1. Tabelle

Uhr: **Online-Stunden** (Spielzeit, in der der Bot wirklich Aktionen ausfuehrt). Alle vier Hebel laufen nur online (Roulette,
Infiltration, Handelsschleife brauchen die Oberflaeche bzw. einen 6-s-Takt). Fuer V2 in Wanduhr: Faktor 1,2 (BN7) bis 1,8 (BN9)
laut `CHRONIK.md` Abschnitt 3, grob 1,4. Spanne = (niedrig / Mitte mit halber Elastizitaet / hoch), Begruendung Abschnitt 8.

| Mechanik | verfuegbar ab | vom Bot genutzt ab | Wirkung (Formel, Datei:Zeile) | Nutzen Lauf 2 (Online-h, alle V2-Knoten zusammen; BN8 gesondert) | geeicht? | Bauaufwand | Empfehlung |
|---|---|---|---|---|---|---|---|
| **Casino-Roulette (PLAYER-1)** | jeder Knoten, kein SF; Reise nach Aevum 200 k$ | nie | `win()` bucht `gainMoney(n,"casino")` ohne Knotenfaktor (`Casino/Game.ts:9-14`); Sperre bei `moneySourceA.casino > 10e9`, `moneySourceA` leert sich bei JEDEM Einbau (`PlayerObjectGeneralMethods.ts:128`); Roulette Einsatz max 1e7, Einzelzahl 36x (`Roulette.tsx:11-12,100-107`), Seed `(ms/1000)%30000` (`RNG.ts:45-51`), Haus wuerfelt bei Spielergewinn mit 10 % neu (`Roulette.tsx:149-154`), 1,6 s je Spin (`:176`) -> **10,36 Mrd je Einbauzyklus**, Median 32 Spins = 1-2 min | **BN8: 11,8 h je Stufe (R1 5,5 + R2 3,1 + R3 3,2), 3 Stufen = 24-36 h**; V2: 7 / 32 / 157 (alle Knoten), Haupterbe BN13, BN14, BN11, BN7 | Boerse-Teil ja (Abschnitt 2), Roulette-Spielverlauf NEIN (kein Stand hat je Casino-Geld, `moneySourceA.casino` ueberall 0) | L (Navigation, React-Props-Klick wie `src/join.js`, Seed aus erstem Ergebnis festnageln) | **bauen, zuerst in BN8 und als Startkapital fuer Boerse (TIX)**; Eric-Frage aus A8 ("will er das Casino?") offen |
| **Boerse in V2 (BOERSE-1)** | TIX 5 Mrd fest (`StockMarketCosts.ts:15-17`), kein WSE noetig (`NetscriptFunctions/StockMarket.ts:317-335`); mit SF8 >= 1 gratis bei jedem Einbau und Knotenstart (`Prestige.ts:161-164`, `canAccessBitNodeFeature`) | nur BN8, seit 10.11. (Registry `knoten [8]`) | Kursgewinne ohne Knotenfaktor (`BuyingAndSelling.tsx:173,362`); Markt wird bei jedem Einbau neu angelegt (`Prestige.ts:166-170`), TIX bleibt; Preisprozess `StockMarket.ts:239-316` | 26 / **80** / 325 (alle V2); Geldseite geeicht: nach TIX 100 Mrd in 5,5 h, 400 Mrd in 8,5 h, 1 Bio in 10,5 h (Median, Start 5,4 Mrd) | **Geldseite ja**: Marktcode im Original, Wachstumsrate gegen 4 reale BN8-Zyklen auf ~10 % genau (Abschnitt 2). **Stundenseite nein** | M (`boerse.js` + `lib/handel.js` laufen schon; Registry-Knotenliste, TIX-Kauf, Einbau-Abverkauf, Nacht-/Stillstandsregel) | **bauen**, aber erst die Stundenwirkung messen (Abschnitt 8): ein geldarmer Knoten (BN13/BN11), eine Stufe mit, eine ohne |
| **Infiltration (NETZ-1)** | alle Knoten, kein SF; Schwelle Summe(Kampf+cha) > ~500 fuer Carmichael, ~950 fuer VitaLife, ~1.200 Omnia, ~2.700 NWO | nie | Geld `(r+1)^2 sec^3 Nachfrage 3000 L 1,01^L InfilGeld` (`victory.ts:8-26`), Ruf `(r+1)^1,1 sec^1,1 Balance Nachfrage 30 L 1,005^L InfilRuf`, **direkt auf `playerReputation`, ohne faction_rep/FWRG** (`victory.ts:28-63`, `Victory.tsx:76-83`); keine `currentWork`, Bladeburner laeuft weiter (`Bladeburner.ts:1353-1366`); Stats im Lauf 2 aus den Staenden: 14-44 Mrd/h und 280-1.300 k Ruf/h ab Stunde ~12 | 44 / **110** / 410 (alle V2); BN8: nur Ruf (Red Pill 2,5 Mio in ~5-6 h statt 1,4-1,9 Bio $ = ~1,5-2 h Boerse je Stufe, 5 h hoch) | **Formeln ja (4 Stellen gegen `netz-calc.mjs`), Spiel NEIN** (kein Stand hat eine Infiltration); Laufzeit je Stufe (1,73 s) ist ein Modell | L (Fiber-Zugriff auf `state.stage.onKey`, 8 Minispiele, Wachen gegen Seitennavigation und `hospitalize()`) | **bauen** (groesster Einzelhebel nach Geldkette), aber Eric-Entscheidung zu Auftrag §12 und "Do not try to automate infiltration!" (`Infiltration.ts:149`) |
| Gang ausserhalb BN2 (GANG-3) | SF2 + Karma <= -54.000 (`PlayerObjectGangMethods.ts:19-27`, `Gang/data/Constants.ts:27`) | nie (BN2 seit 04.10.) | Karma nur ueber Verbrechen: Homicide 3 Karma / 3 s (`Crimes.ts` homicide), Sleeve-Karma x `sync/100` (`SleeveCrimeWork.ts:47`), `sync` steht in JEDEM Stand bei 1 | **0 bis -15** (negativ in BN11, BN3, BN6, BN7, BN13, BN14; ~0 in BN15) | Karmarate ja (aus Quellcode, Sync aus 6 Staenden); Gangnutzen ungeeicht | M | **nicht bauen** |
| Corporation ausserhalb BN3 | SF3 + Gruendung selbstfinanziert 150 Mrd (`Corporation/helpers.ts`, Prior) | nie (BN3 seit 06.10.) | Bewertung x CorporationValuation (BN15 0,2, BN6/7 0,2, BN11 0,1, BN13 0,001), Dividenden x Softcap | **0** (Prior: Bestechungsschwelle 1e14 in keinem Knoten in 36 h) | Prior: Formeln gegen BN3-Log 4,6e-7 (`AUDIT-ROADMAP-PRUEFUNG-2026-10.md`); von mir NICHT nachgerechnet | XL | **nicht bauen** |
| Hash -> Coding Contracts (HASH-7) | Hacknet-Hashes (SF9); 25 x (Stufe+1) Hashes (`HashUpgradesMetadata.tsx:108-114`) | nie | je Vertrag 2.058 Ruf + 26,5 Mio $ (BN2), nur an Hacking-Faktionen (`PlayerObjectGeneralMethods.ts:501-567`) | BN9: 0-3 (nur wenn Infiltration fehlt); sonst 0 (Hashrate in 13/14/15 ~50-1.300 H/h) | Lohnformel 45/45 gegen Spielprotokoll (Prior); Hashrate aus Staenden | S | **nicht bauen**, wenn Infiltration kommt |
| Hash -> Bladeburner-Rang/SP | wie oben; Rang 100 je 250 x (L+1), SP 10 je 250 x (L+1) | seit 19.09. klein in BN13/14/15 | `HacknetHelpers.tsx:539-546` | 0,04 h (Untergrenze) bis ~1-20 h je Lauf (Prior, ungeeicht) | Preise ja, Wirkung nein | - | so lassen |
| Firmenarbeit / Firmenfaktionen | alle | nie (Faktionsarbeit in V2 gesperrt) | BN2 Firma 8-12 k Ruf/h gegen 300 k Firmenruf (Prior, `Work/Formulas.ts` geeicht -0,22 %) | 0 | Prior geeicht | S | **nicht bauen** (Infiltration 20-100x) |
| Spenden | Favor-Schwelle 150 (BN3 75, BN8 0), `repFromDonation = $/1e6 x faction_rep x FWRG` (`donation.ts:8-18`); Favor 150 = 462.490 Ruf in EINER Faktion (`favor.ts`) | BN8 | - | BN8 schon abgedeckt; V2: 0 (Ruf bindet nach Infiltration nicht mehr) | Favorformel Prior geeicht | - | kein neuer Bau |
| Coding Contracts (Belohnungen) | alle | seit 08/2026 | 4,5/h erwartet, 3,6/h gemessen; 2.058 Ruf + 26,5 Mio $ (BN2) | 0 | Prior 45/45 | - | nichts zu tun |

## 2. Boerse: Rechenweg und Eichung

**Marktmodell.** Der Originalquelltext wird ausgefuehrt (`mkt.mjs`), nicht abgeschrieben: Preisprozess `StockMarket.ts:239-316`,
Forecast-Dynamik `Stock.ts`, Kosten und Kursdruck `StockMarketHelpers.ts`. Der Handel (Long, Rang (2f-1) x mv, Einstieg
f-0,5 >= 0,05 mit 4S bzw. 0,03 mit Filter, hoechstens 50 % des Vermoegens je Titel, Provision 100 k) ist `lib/handel.js` nachgebaut,
der Bayes-Filter ohne 4S ist dessen `filterSchritt` 1:1.

**Eichung gegen echte Staende (unabhaengig bekannt).** `backups/LIVE_*BN8L1/L2*` enthalten Depotwerte (`StockMarketSave`) im
Stundentakt. Vier Zyklen (alle mit der Handelsregel vom 10.11.):

| Zyklus (real) | Start | Messpunkte real (h nach Start: Vermoegen) | Sim Median (Start gleich) | Urteil |
|---|---|---|---|---|
| BN8.1 nach Einbau 22:01 (4S) | 0,32 Mrd | 1,0 h: 1,17 / 2,0: 3,28 / 3,0: 10,5 / 4,0: 20,4 / 5,0: 44,8 / 6,0: 120 | 1 Mrd 1,1 h / 3 Mrd 2,2 / 10 Mrd 3,3 / 30 Mrd 4,3 / 100 Mrd 5,6 | innerhalb ~10 % |
| BN8.1 nach Einbau 18:06 (4S) | 0,38 Mrd | 1,0: 1,18 / 2,0: 3,28 (danach Nachtluecke) | wie oben | passt |
| BN8.1 nach Einbau 08:23 (4S) | 0,27 Mrd | 1,0: 0,44 / 2,0: 0,96 / 3,0: 4,1 / 3,6: 14,3 | 10 Mrd bei 3,3 h (P10-P90 2,7-3,9) | im oberen Streubereich, noch passend |
| BN8.2 Start (ohne 4S) | 0,13 Mrd | 4,1 h: 1,57 / 6,1: 10,1 / 7,1: 20,8 / 8,1: 23,8 | ohne 4S, 0,3 Mrd Start: 10 Mrd bei 5,9 h (4,7-6,9), also bei 0,13 Mrd ~6,4 h | passt |

Querprobe: `nodes/audit-2026-11-07/BN8-ROUTE.md` nennt "Runde 1 bei 300 Mrd: 11,5 h"; meine Sim ohne Casino, 0,25 Mrd Start,
4S-Kauf bei 45 Mrd: 11,4 h (P10-P90 8,8-13,9). Gleiche Zahl aus unabhaengigem Code.

Was die Eichung NICHT abdeckt: Shorts und Orders (SF8.2/8.3), Nacht- und Stillstandsverhalten, jede Wirkung in einem V2-Knoten
(es gibt in keinem V2-Stand ein Depot). Der Markt-Code ist in allen Knoten derselbe, deshalb ist die Geldseite uebertragbar.

**Kapitalverlauf je Zyklus in V2 (40 Seeds, ohne 4S, nur Long, Median [P10-P90], Mrd $):**

| Stunden ab Handelsbeginn | 2 | 4 | 6 | 8 | 10 | 12 |
|---|---|---|---|---|---|---|
| Folgezyklus, Start 10,4 Mrd (Casino, TIX schon da) | 26 [18-43] | 74 [38-155] | 194 [80-412] | 460 [219-922] | 890 [506-1.771] | 1.583 [702-3.458] |
| erster Zyklus, Start 5,4 Mrd (Casino - TIX) | 14 [10-23] | 41 [24-85] | 122 [60-213] | 289 [125-664] | 603 [312-1.493] | 1.206 [615-3.077] |
| ohne Casino, 1 Mrd nach TIX aus Hackgeld | 2,7 [1,8-4,3] | 8,5 [4,6-19,6] | 30 [12-77] | 106 [32-310] | 271 [83-829] | 597 [190-1.619] |

Zum Vergleich die gemessenen V2-Einnahmen (`income.mjs`, alle Quellen je Knotenstunde): BN3 0,5-1,9 Mrd/h, BN6 0,5, BN11 0,4-0,5,
BN13 0,35-0,67, BN14 0,6-1,3 (gesamte Stufe 12-30 Mrd), BN7 2-4,6, BN9 2,4-5,2 (fast nur Hashes), BN4 4, BN2 6,5-28, BN15 19-78.
Der geplante Graftplan (415 Mrd, `graftplan-rechnung.txt`) ist in BN3/6/11/13/14 ohne neue Quelle nie bezahlbar, in BN7/9/4 ~100 h Einkommen.
Grafting kostet `baseCost x 3` ohne Knotenfaktor (`GraftableAugmentation.ts:20-22`), Augs kosten x AugGeld (BN10 5, BN3/7/15 3):
Geld in Grafts ist dort relativ billig.

**Was Geld in einem Bladeburner-Knoten kauft:** Bladeburner-Skills kosten SP, nicht Geld; Geld wirkt nur ueber (a) Augs (x AugGeld, 1,9^n
Preistreppe), (b) Grafts (415 Mrd fuer Kampf x69, 31 h seriell, laeuft mit Simulacrum neben Bladeburner), (c) Simulacrum (SF7.3 schenkt es),
(d) home-RAM, (e) Spenden. Geld ist der Engpass in BN3, 6, 11, 13, 14 (Einnahmen ~ Augausgaben, Stand am Stufenende 0,1-3 Mrd) und
teilweise in BN7/9/4 (Konto beim Einbau 0,04-0,7 Mrd laut Prior); NICHT in BN2 (21 Mrd lagen untaetig) und BN15 (250-2.300 Mrd lagen).

**Offline-Risiko.** Der Markt laeuft weiter, der Haendler nicht. Real: BN8.1 18:06-Zyklus lag nachts 8,6 h ohne Handel (3,3 -> 8,2 Mrd), der 22:01-Zyklus
7,6 h -> 19,5 h dagegen 124 -> 952 Mrd (stehendes Depot im Bullenmarkt). Prior `boerse-stall.mjs`: nach 4 h Stillstand P10 x0,70, schlechtester x0,32.
Regel fuer den Bau: vor jedem erkennbaren Ausfall (Nachtfenster, Einbau) alles in Bargeld.

## 3. Infiltration: Rechenweg

Formeln: `Infiltration/formulas/victory.ts`, `game.ts`, `Infiltration.ts` (alle v3.0.1). Nachbau `infil.mjs`. Eichwert: das Prior-Werkzeug
`netz-calc.mjs` fuer Carmichael (BN2, Summe 794, int 153, Lauf 32 s): Geld 182,72 Mio/Lauf, Ruf 3.490, Nachfrage 0,72, SoA 1.280.
Mein Nachbau: 182,7 / 3.488 / 0,720 / 1.281; SysCore 245,7 / 4.421 gegen 245,72 / 4.420. Das prueft Quelltext gegen Quelltext,
**nicht gegen das Spiel**: kein Stand enthaelt eine Infiltration (`InfiltrationsSave` floors 0, `moneySourceA.infiltration` 0).

Neu gegenueber dem Prior (der rechnete nur Carmichael und SysCore): **der beste Ort waechst mit den Kampfwerten.** Schwelle je Ort
= Summe(str,def,dex,agi,cha)^0,9/250 + int/1600 > sec - 3,5. Aus den echten Staenden (`infil4.mjs`, Laufzeit 6 + 1,73 L s, Nachfrage im Gleichgewicht):

| Stufe, Knotenstunde | Summe Kampf+cha | bester Ort | Geld/h | Ruf/h |
|---|---|---|---|---|
| BN13.2 h12 | 1.692 | Omnia | 17,6 Mrd | 526 k |
| BN13.2 h48 | 3.103 | NWO (L50) | 87 Mrd | 996 k |
| BN11.2 h13 | 1.081 | VitaLife | 37 Mrd (x2,5 Knoten) | 1.316 k |
| BN3.2 h9 | 884 | Storm | 13,6 Mrd | 495 k |
| BN9.2 h73 | 1.003 | VitaLife | 14,7 Mrd | 509 k |
| BN14.1 h13 | 1.805 | Omnia | 13,2 Mrd (x0,75) | 526 k |
| BN7.2 h12 | 1.056 | VitaLife | 11 Mrd | 509 k |
| BN2.1 h14 | 897 | Storm | 41 Mrd (x3) | 495 k |
| BN15.1 h39 | 2.084 | Helios | 28 Mrd | 514 k |

Das Prior-Urteil "x73-80 des Vertragsrufs" (392 k gegen 4,9-5,4 k Ruf/h) **stimmt** formal (Carmichael), ist aber zu niedrig: ab Summe ~1.000
liegt der Ruf bei 500-1.300 k/h (x100-250). Das Geld (14-44 Mrd/h ab Stunde ~12) ist 10-50x die gemessenen Hackeinnahmen der geldarmen Knoten.
Ruf ist unvermultipliziert und wirkt wie Spende: Favor 150 = 462.490 Ruf in einer Faktion = ~1 h Infiltration.
BN8: InfilGeld 0, aber Ruf voll (InfilRuf 1): Red Pill 2,5 Mio Ruf in ~5-6 h statt 1,4-1,9 Bio $.

Unsicherheit der Laufzeit: das Modell nimmt 1,73 s je Ebene (Carmichael 32 s). Mit Faktor 1,5 laenger: Geld/h x0,7-0,8 (`infil2.mjs`, Spalte "x1.5").
Ueber Ebene 50 steigt die Schwierigkeit um +L/50 (`Infiltration.ts:91`), Fenster werden enger; Slash/Minesweeper erzwingen Wartezeit.

Machbarkeit (am Quelltext geprueft): Der Tastaturwaechter sitzt nur am `document`-Listener (`InfiltrationRoot.tsx:73-77`), die Modelle
(`InfiltrationStage.ts:5-16`, `SlashModel.ts:30-38`) nehmen ein einfaches Objekt. Wer `state.stage.onKey({key,altKey,...})` ueber die React-Props ruft,
umgeht `isTrusted`; Victory-Knoepfe haben keine Pruefung (`Victory.tsx:60-70`). Risiken: `blade.js` ruft `hospitalize()` (bricht ab),
jede Seitennavigation bricht ab (`InfiltrationRoot.tsx:63-67`), `document`-Zugriff 25 GB RAM (Trick aus `src/join.js`), Tod beim Start bei Schwierigkeit >= 3,5
(`Infiltration.ts:95-103`), Fehlschlag kostet HP (Max ~28). Nicht automatisiert wuerde ein menschlicher Spieler dasselbe tun - der Bot muss nur
die Entscheidung "Modellweg statt Tastenweg" treffen lassen.

## 4. Gang ausserhalb BN2 (GANG-3)

Karma-Schwelle -54.000 (`Gang/data/Constants.ts:27`). Natuerliches Karma der V2-Staende am Stufenende: -2.500 bis -7.200 (`scan.mjs`).
Fehlend ~47.000-52.000. Homicide: 3 Karma je 3 s, Erfolg 1 ab Kampf ~190 (`Crime.ts:120-135`): 3.600 Karma/h fokussiert, 2.880 unfokussiert
(`BaseFocusBonus 0,8`, `Constants.ts:87`) -> **13-18 h Spielerzeit**, in denen ohne Simulacrum keine Bladeburner-Aktion laeuft
(`Bladeburner.ts:1353-1366`). Sleeves: Karma x `sync/100`, `sync` = 1 in allen sechs gepruefte Staenden (BN2L3, BN7L3, BN9L3, BN11L3, BN13L2, BN15L3),
Synchronisieren +0,001 %/s je Sleeve (`SleeveSynchroWork.ts`) = ~27 h je Sleeve bis 100, und `sync` faellt beim Einbau zurueck
(`Sleeve.ts:253`). Memory kaufen geht nur in BN10 (`SleeveCovenantPurchases.tsx:90`). Das Prior-Urteil "Sleeves helfen nicht" stimmt.

Nutzen der Gang je Knoten haengt an `GangSoftcap` (Potenz auf Geld und Respekt, `formulas.ts:27,71`) und `GangUniqueAugs`: BN13 0,3/0,1 und BN7/6 0,7/0,2
tragen kaum, BN15 und BN11 (Softcap 1) tragen voll. Aber: BN11 hat Stufen von 18-24 Online-Stunden - die Karmaernte (13-18 h) frisst die Stufe; BN15
hat Geld und Ruf nicht als Engpass (Abschnitt 8, Gegenindiz). Mit Simulacrum (SF7.3) liefe die Karmaernte nebenher, aber der Nutzen bleibt klein.
**GANG-3 "BN15 -20..-40 h" faellt.** Einzige Ausnahme zum spaeteren Neubewerten: BN4 (Softcap 1) mit Simulacrum - nicht gerechnet.

## 5. Corporation ausserhalb BN3

Das Prior-Urteil (`AUDIT-ROADMAP-PRUEFUNG-2026-10.md` Abschnitt 2: Simulator auf Spielquelle, Formeln gegen das BN3-Log 4,6e-7)
sagt: ausserhalb BN3 faellt "ein Faktor ~1.000 im Vermoegenszuwachs" zur Bestechungsschwelle 1e14 in 36 h. Ich habe das NICHT neu gerechnet,
sondern nur geprueft, ob die neuen Geldquellen die Begruendung aendern: Casino/Boerse/Infiltration liefern 150 Mrd Startkapital - aber der
fehlende Faktor liegt im Wachstum der Corp (Bewertungs- und Dividendenfaktoren BN15 0,2/0,4, BN11 0,1, BN13 0,001; Gruendung
selbstfinanziert, Seed nur in BN3), nicht im Startkapital. Urteil bleibt: nicht bauen. Neu zu pruefen nur, wenn ein Knoten mit
CorporationValuation >= 0,5 UND langer Laufzeit und SF3 auftaucht (BN9 0,5, BN10 0,5: kurze Einnahmequelle? nicht gerechnet).

## 6. Hashes, Contracts, Firmen, Spenden

* **Hashrate ausserhalb BN9 ist klein**: BN15 ~0,014 H/s (`gating-bericht.md`), BN13/14 aehnlich; BN9 selbst 13.900 H/h (aus `moneySourceB.hacknet`
  351 Mrd / (1e6/4) / 101 h). In BN9 bringt Verkauf 41,7 Mrd je 12-h-Zyklus; derselbe Zyklus in Vertraege waere 116 Vertraege (25(n+1) je Stueck,
  Stufen laufen je Einbau auf 0) = 239 k Ruf + 3,1 Mrd. Wer Ruf ueber Infiltration hat, verkauft die Hashes.
* **Hash -> Rang/SP** (250(L+1) je 100 Rang bzw. 10 SP, `HashUpgradesMetadata.tsx:90-106`): schon klein gebaut, Wirkung nicht gemessen; Untergrenze 0,04 h,
  Spanne laut `nodes/HASH-RANG-2026-10.md` 1-20 h je Lauf (ungeeicht, Rangmodell fuer BN10 3-4x zu schnell). Nicht ausbauen.
* **Hash -> Firmen-Favor** (+5 Favor je 200(L+1) Hashes, bis Knotenwechsel): wirkt nur auf Firmenarbeit, siehe naechster Punkt - ohne Wert.
* **Firmenarbeit**: BN2 8-12 k Ruf/h (Formel geeicht -0,22 % an Clarke, `inventar-fakt.md` 4.2); Firmenfaktionen verlangen 300-400 k Firmenruf (~27 h).
  Gegen 500-1.300 k Ruf/h der Infiltration chancenlos, und sie braucht den Spieler.
* **Coding Contracts**: Erzeugung 3 Versuche je 10 Spielminuten, 4,5/h erwartet, gemessen 3,6/h (45 in 12,6 h, p = 0,06 fuer das Defizit); Belohnung
  nicht waehlbar. Keine Luecke.
* **Spenden**: nur BN8 (Favor 0) ist ein eigener Hebel und dort schon im Bot. In V2 braucht Spenden Favor 150 (BN3 75) in einer Arbeitsfaktion und
  wuerde Geld in Ruf wandeln; sobald Infiltration steht, bindet Ruf nicht mehr.

## 7. Fruehere Befunde: was haelt, was faellt

| Befund | Urteil | Begruendung |
|---|---|---|
| BOERSE-1 (-17,5 h in BN2) | **Geldseite haelt, Stundenzahl faellt** | geeichtes Modell: 100 Mrd nach 5,5 h (Prior 6,4), 1 Bio nach 10,5 h (Prior 12,4). Aber "-17,5 h" verglich Geld-Zeit mit Hackgeld-Zeit, nicht Laufzeit; in BN2 liegen 21 Mrd untaetig (Ruf bindet, Gang gebaut), Laufzeit-Nutzen dort 0,5-13 h (Mitte 2,6), Hauptnutzen in BN3/6/11/13/14/7/9 |
| BOERSE-3 (Handelsregel BN8) | erledigt 10.11. | im Bot; meine Sim reproduziert die dortigen Zeiten |
| BOERSE-4 (grow-Steuerung `stock:true`) | ungeprueft | UNGEEICHT im Prior (Zuordnung Server->Aktie fehlt); ich habe nichts dazu gerechnet |
| BOERSE-6 (Stop-Orders) | in V2 unmoeglich | Orders brauchen BN8 oder SF8.3 (`NetscriptFunctions/StockMarket.ts:183`) |
| NETZ-1 (x73-80 Vertragsruf) | **haelt, zu niedrig** | Formeln nachgebaut (4 Stellen); mit mittleren Kampfwerten x100-250; Spiel-Eichung steht aus |
| NETZ-2 (Vertragswert 2.058 Ruf + 26,5 Mio $) | haelt | Prior 45/45 am Spielprotokoll |
| NETZ-3 (DarkNet ausserhalb BN15) | nicht angefasst | |
| GANG-3 (BN15 -20..-40 h) | **faellt** | Karmaernte 13-18 h Spielerzeit, Sleeve-Sync 1 %, BN15/BN11 koennen sie nicht bezahlen (Abschnitt 4) |
| PLAYER-1 (Casino bis 10 Mrd je Zyklus) | **haelt, unterschaetzt** | Prior bewertete nur BN3 (~2-3 h); der groessere Wert ist BN8 (11,8 h je Stufe) und Startkapital fuer die Boerse in jedem V2-Knoten |
| HASH-7 (Contracts aus Hashes) | haelt formal, **nachrangig** | nur BN9, 239 k Ruf je Zyklus gegen 41,7 Mrd Verkauf; Infiltration schlaegt es um 2 Groessenordnungen |
| CORP-Seed (BN3) und "Faktor ~1.000" | nicht neu geprueft, Urteil bleibt | siehe Abschnitt 5 |

## 8. Wie die Stunden entstanden (und warum sie unsicher sind)

Modell (`hours.mjs`, UNGEEICHT): je Stufe gespart = (1 - 1/g) x max(0, T - t0). T = Online-Stunden der Stufe (`CHRONIK.md` Abschnitt 3; ohne Messung 0,65 x Wanduhr:
BN4.1, BN6.1, BN10.1/10.2), t0 = Anlaufzeit (6 / 10 / 14 h), g = Faktor der Rangrate nach dem Anlauf. Es folgt der Elastizitaet ~1 aus
`tools/bbrank/sim.mjs` (Prior: Gegenprobe -19 % gegen real; Kampfmass x1,26 -> x1,53-2,6 durch Infiltration, `netz-infil.mjs`). Knotenklassen: **geldarm** BN3/6/11/13/14
(g niedrig/mittel/hoch Casino 1,05/1,2/1,4, Boerse 1,1/1,4/2,0, Infiltration 1,15/1,5/2,2, alle 1,25/1,8/2,5), **mittel** BN2/4/7/9 (Casino 1,0-1,2, Boerse 1,05-1,6,
Infiltration 1,1-2,0, alle 1,15-2,3), **reich** BN10/15 (Casino 1,0-1,1, Boerse 1,0-1,3, Infiltration 1,0-1,5, alle 1,0-1,6). Die g-Werte sind Urteil, keine Messung.

**Gegenindiz, das die Mitte nach unten zieht.** BN15.1 hatte weder Graft noch Go, BN15.2 bekam Kampf x69 (Graftplan) und +32 % Kampfwerte durch Go, BN15.3 volles
Graft/Go: Online-Zeit 35 / 36 / 34 h (`CHRONIK.md`). Kampfstaerke allein hat die BN15-Stufenzeit also nicht merklich verkuerzt (BladeburnerRank 0,2: der Rangzufluss
haengt an der Zahl der Aktionen, nicht an der Chance). Deshalb ist die **Mitte mit halber Elastizitaet** gerechnet: g_eff = 1 + (g - 1)/2. Die Untergrenze 0 bleibt moeglich.

Ergebnis (Online-h Lauf 2, ueber alle drei Stufen; niedrig / Mitte halbe Elastizitaet / hoch):

| Knoten | online gesamt | Casino | Boerse | Infiltration | alle drei zusammen (nicht additiv) |
|---|---|---|---|---|---|
| BN2 | 53 | 0-1/0,9/6 | 1/2,6/13 | 1/3,8/18 | 1,4 / 5,0 / 20 |
| BN3 | 39 | 0/1,1/6 | 1/2,0/11 | 1/2,4/12 | 1,0 / 3,4 / 13 |
| BN4 | ~100 | 0/2,7/14 | 3/7,8/31 | 5/11,7/41 | 7,6 / 15 / 46 |
| BN6 | ~53 | 1/2,2/10 | 2/4,0/18 | 2/4,8/19 | 3,2 / 6,9 / 21 |
| BN7 | 167 | 0/5,3/25 | 6/15/56 | 11/23/75 | 16 / 30 / 84 |
| BN9 | 131 | 0/3,9/19 | 4/11/42 | 8/17/57 | 12 / 22 / 64 |
| BN10 | ~186 | 0/1,5/15 | 0/7,4/39 | 0/11/56 | 0 / 14 / 63 |
| BN11 | 65 | 1/3,2/13 | 2/5,8/24 | 3/7,0/26 | 4,6 / 10 / 28 |
| BN13 | 107 | 3/7,0/25 | 6/13/45 | 9/15/49 | 13 / 22 / 53 |
| BN14 | 74 | 2/4,0/16 | 3/7,3/28 | 4/8,8/31 | 6,4 / 12,6 / 34 |
| BN15 | 105 | 0/0,7/8 | 0/3,6/20 | 0/5,2/29 | 0 / 6,8 / 33 |
| **Summe V2** | 880 | 7 / 32 / 157 | 26 / 80 / 325 | 44 / 110 / 410 | **65 / 147 / 459** |
| BN8 (3 Stufen, V1) | 3 x 30,5 | **Casino 24-36** (R1 5,5 + R2 3,1 + R3 3,2 je Stufe, Sim) | schon gebaut | Red Pill-Ruf 1,5-5 je Stufe | - |

Die BN8-Zahl ist die belastbarste der Tabelle: sie beruht auf der geeichten Marktsim (Abschnitt 2) und `BN8-ROUTE.md` ("Route in allen drei Runden vom GELD begrenzt").
Einzelwerte aus `cas.mjs` (Median, 30 Seeds): Runde 1 bis 300 Mrd 11,4 h ohne Casino, 5,9 h mit (Start 10,65 Mrd); Runde 2/3 bis 1 Bio 8,7 h gegen 5,6 h, bis 2,3 Bio 10,3 h gegen 7,1 h.
Nicht-Geld-Anteile der Route (Hacking-Stufe 2500 nach 4,6 h, w0r1d_d43m0n 3000) laufen parallel; deshalb Untergrenze 8 h je Stufe.

Wanduhr fuer V2: Online-h x 1,2-1,8. Casino, Boerse und Infiltration laufen offline nicht; die V2-Gutschrift von Bladeburner (grob 50 %) ist davon unberuehrt.

## 9. Empfehlung (Reihenfolge nach Hebel und Sicherheit)

1. **Casino + TIX-Kauf + Boerse als Kette** (`boerse.js` ist da). Zuerst BN8 (24-36 h, geeicht), dann V2-Knoten mit Geldmangel (BN13, BN14, BN11, BN3, BN6) und BN7/BN9. Mit SF8 >= 1 entfaellt der TIX-Kauf (5 Mrd/Knotenstart). Reihenfolgehinweis fuer C1: wer BN8.1 frueh faehrt, hat die Boerse in jedem folgenden Knoten kostenlos und mit SF8.2 Shorts.
2. **Infiltration** ueber die Modelle, nicht ueber Tasten: groesster Ruf- UND Geldhebel parallel zu Bladeburner. Erst Spielmessung (ein Dutzend Laeufe in einem Knoten, Zeit je Ebene, Fehlerquote), dann ausbauen. Eric-Entscheidung noetig.
3. Nicht bauen: Gang ausserhalb BN2, Corporation ausserhalb BN3, Hash->Contracts (ausser BN9 ohne Infiltration), Firmenarbeit, weitere Hash->Rang-Kaeufe.
4. **Vor jedem Bau die Stundenwirkung messen**: ein geldarmer Knoten (z. B. BN13 oder BN11), Stufe A mit Casino+Boerse, Stufe B ohne; Rangkurve und Kampfmass je Stunde protokollieren. Die BN15-Daten sprechen dafuer, dass die Mitte der Tabelle eher zu hoch als zu niedrig ist.

## 10. Unsicherheiten

* **Stundenwirkung in V2 ist ungeeicht** (Abschnitt 8). Die Geldseite ist stark gestuetzt, die Umrechnung Geld/Ruf -> Rangrate nicht. BN15.1-15.3 ist ein Gegenindiz.
* **Infiltration**: keine Spielmessung; Laufzeit je Ebene, Anzahl der Fehlversuche und Kosten durch Krankenhaus unbekannt; Stats im Lauf 2 aus den Staenden von Lauf 1 genommen (der neue Bot kann anders trainieren).
* **Casino**: Seed aus der Mount-Zeit festzunageln ist am Quelltext moeglich (Median 32 Spins in `casino.mjs`; mein Nachbau synchronisiert nach Haus-Neuwurf grob, 9 % der Laeufe zerfielen im Modell dadurch, ein echter Bot liest mehrere Ergebnisse), im Spiel nie probiert. Dialog "Alright cheater" ist Teil des Spiels, die Quelle nennt Seed-Manipulation selbst (`RNG.ts:8-10`, `Roulette.tsx:146`).
* **Boerse**: Eichung nur an BN8 (vier Zyklen); in V2 Long-only, 6-s-Takt vorausgesetzt (gedrosselter Tab holt mit 4 s nach, Prior). Betriebskapital (2 %) und RAM-Kaeufe aus dem Depot sind im Modell nicht abgezogen. Ausfallrisiko nachts: P10 x0,7 nach 4 h Stillstand (Prior).
* **Stufenzeiten**: BN4.1, BN6.1, BN10.1/2 ohne Online-Messung, mit 0,65 x Wanduhr angesetzt.
* **Klassen und g-Werte** sind Urteil. Veraendert man die Klasseneinteilung (z. B. BN7 geldarm), springen die Zahlen um 20-40 h.
* **Corp** nicht nachgerechnet, nur auf die neue Frage hin geprueft.
