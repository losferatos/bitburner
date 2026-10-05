# Corporation in BN3 (Spiel 3.0.1) - optimale Strategie nach Spielergeld(t)

Stand 06.10.2026 00:05 (Systemzeit). Nichts an `src/` geaendert, keine Commits.
Quellbelege: `reference/v301/src/...` (die gespielte Version 3.0.1) mit Zeile.
Alle Zahlen dieser Datei stammen aus der **echten Spielquelle**, unveraendert unter
Jest ausgefuehrt (Abschnitt 2) - nicht aus nachgebauten Formeln.

## Kurzfassung

**Spielergeld, wenn zum Zeitpunkt t verkauft wird** (t ab Gruendung der Corp; einmaliger
Verkauf; Median ueber 3-6 Saaten, in Klammern min-max; Mrd = 1e9, Bio = 1e12; "bot-tauglich" = Treiber ohne
Spielinterna, Abschnitt 2.3):

| Kandidat | 0,5 h | 1 h | 2 h | 3 h | 6 h | 12 h | 24 h | RAM | Bau |
|---|---|---|---|---|---|---|---|---|---|
| A Seed-Auszahlung | 98 Mrd (104 Mrd ab 33 min) | 104 Mrd | 104 Mrd | 104 Mrd | 104 Mrd | 104 Mrd | 104 Mrd | 62 GB | S |
| B Agri ohne Runde, bot-tauglich (4 Saaten) | 304 Mrd | 307 Mrd | 307 Mrd | 307 Mrd | 311 Mrd | 330 Mrd | 334 Mrd | ~320 GB | M |
| B Agri + Runde 1 (Suchtreiber) | 389 Mrd | 504 Mrd | 509 Mrd | 515 Mrd | 528 Mrd | 599 Mrd | 692 Mrd | ~380 GB | M |
| **C Produkte, 4 Runden, bot-tauglich (C4B_KF, 6 Saaten)** | 304 Mrd | 271 Mrd | 274 Mrd | 277 Mrd | 2,8 Bio (1,0-6,7) | **1e21 (5e16-4e22)** | **5e22 (3e22-1e23)** | ~600 GB, teilbar | L-XL |
| C dasselbe, Runde 4 schon bei 6 h (C4A_KF, 5 Saaten) | 304 Mrd | 271 Mrd | 274 Mrd | 283 Mrd | 0,86 Bio | 2e18 (17 Bio-6e20) | 5e22 | dto. | L-XL |
| C nur 3 Runden, Spieler behaelt 20 % (C3B_KF) | 305 Mrd | 272 Mrd | 289 Mrd | 277 Mrd | 2,8 Bio (2,1-6,7) | 98 Bio (66 Bio-3e16), Zuendung 11-14 h | 2e23 | dto. | L-XL |
| C mit exakter TA2-Preisformel (Obergrenze) | 388 Mrd | 381 Mrd | 472 Mrd | 581 Mrd | 12 Bio | 5e93 | 5e102 | dto. | XL |
| C nur 2 Runden (C2B) | 388 Mrd | 381 Mrd | 472 Mrd | 581 Mrd | 1,4 Bio | 4,0 Bio | 2e17 (8e14-6e19) | dto. | L |
| D Teilverkauf 50 % direkt nach Runde 4 (D4B_K) | wie C | | | | 11 Bio | 0,2 Bio..2e15 | 3e21 | dto. | L |

Werte ab ~1e15 sind praktisch "unbegrenzt": In den C-Laeufen zuendet die
Produkt-Werbe-Rueckkopplung bei C4B_KF in 6/6 Saaten **zwischen 10 und 12 h** (C4A_KF:
10-16 h; Spielergeld >= 1e15 als Kriterium) (Gewinn 1e6/s -> 1e16/s in ~3 h),
danach liegt die Bewertung bei 1e19-1e23 (bot-taugliche Preisregel) bzw. am
Spielende-Deckel ~1e98/s Gewinn (exakte Preisformel; deckt sich mit der Spieldoku
"endgame of Tobacco ~1e98/s", `Documentation/doc/en/advanced/corporation/industry-supply-chain.md:20`).

**Empfehlung: C** (Agri -> Runde 1 -> sofort Tobacco + Export -> Runde 2 -> Runde 3 ->
Runde 4, Dummy-Divisionen vor Runde 3/4, eigener Market-TA2, Anteile **halten bis zur
Zuendung**, dann IPO und Verkauf auf einen Schlag). **Kein IPO vor Runde 4**, ausser die
Entscheidungsregel (Abschnitt 5) sagt B. A ist von B klar geschlagen (0,1 gegen
0,3-0,4 Bio nach 30 min) und lohnt nur, wenn keine ~320 GB RAM frei sind.

## 1. Zugang in BN3 ohne SF3

| Aussage | Beleg |
|---|---|
| Corp-Zugang = BN3 oder SF3 | `PersonObjects/Player/PlayerObjectCorporationMethods.ts:8-10`, `BitNode/BitNodeUtils.ts` canAccessBitNodeFeature |
| Seed-Gruendung nur in BN3, sonst Fehler | `Corporation/helpers.ts:30-44` (UseSeedMoneyOutsideBN3), `Corporation/Actions.ts:41-44` |
| Seed kostet nichts, Kasse 150 Mrd | `Corporation/Actions.ts:63-65`, `Corporation/Corporation.ts:41` |
| Seed: 500 Mio Anteile an den Staat, Spieler 1 Mrd von 1,5 Mrd | `PlayerObjectCorporationMethods.ts:26-29` |
| Warehouse- und Office-API in BN3 gratis freigeschaltet | `PlayerObjectCorporationMethods.ts:21-24` (`bitNodeN === 3`) |
| `createCorporation(name, selfFund = true)` - Vorgabe ist selbst bezahlen! | `NetscriptFunctions/Corporation.ts:629-631` |
| RAM: Info 10 GB, Aktion 20 GB, `hasCorporation`/`canCreateCorporation`/`getConstants`/`getBonusTime`/`nextUpdate` 0 GB | `Netscript/RamCostGenerator.ts:13-14, 79, 466-542` |
| Divisionsgrenze 20 (BN3 Mult 1) | `Corporation/Corporation.ts:38` |

Gemessen im Simulator (Spielcode): `createCorporation("Corp", false)` in BN3 ohne SF3 ->
true, Fonds 150 Mrd, Anteile 1,5 Mrd/1 Mrd, Unlocks `Warehouse API`, `Office API`.

## 2. Methode

### 2.1 Simulator = echte Spielquelle

`nodes/corp-2026-10-05/sim/` startet die Spielquelle 3.0.1 (`reference/v301`, nur
gelesen) unter der spieleigenen Jest-Umgebung (`test/jest/Utilities.ts`), gruendet die
Corp per `getNS().corporation` in BN3 und laesst `Corporation.process()` laufen: je
Corp-Zustand `storeCycles(10)` + `process()` = 2 s Spielzeit, wie `engine.tsx:111-114`.
Bewertung, Kurs, Investorenangebote, Anteilsverkauf, Produktion, Produkte, Forschung,
Werbung - alles ist der Originalcode. Der Treiber (`corpsim.ts`) spielt nur das Bot-Skript:
er handelt vor jedem Zustand (wie ein Skript, das auf `nextUpdate()` wartet) und
ruft ausschliesslich `ns.corporation.*` (gezaehlt fuer den RAM-Plan).

Liquidationswert zum Zeitpunkt t: Abzweig (Spielstand-JSON wie beim Speichern),
Dummy-Divisionen soweit lohnend, 11 Zyklen ohne Langfrist-Ausgabe, dann das Bessere von
(a) `goPublic(0)` + sofort `sellShares(alle-1)` und (b) `goPublic(0)`, 11 Zyklen warten,
verkaufen. Der Hauptlauf geht danach unveraendert weiter.

### 2.2 Eichung der Aussagen, mit denen argumentiert wird (`sim/kalib.test.ts`)

| # | Pruefung gegen den Spielcode | Ergebnis |
|---|---|---|
| K1 | Seed-Auszahlung (Audit CORP-1: 104,4 Mrd nach 32 min; Falle IPO sofort 317 min) | **104,5 Mrd nach 31,3 min**; Falle: Kurs erst nach **326 min** am Ziel. IPO nach 100 s + sofort verkaufen: nur 41,8 Mrd (private Bewertung 60 Mrd) |
| K2 | Erloes = V * g(f), g(f) = 0,5 f + 2/3 f^1,5 | Abweichung **0,05 % / 0,06 % / 0,10 %** bei f = 2/3, 0,6, 0,367 |
| K3 | Langfrist-Ausgabe X senkt assetDelta im naechsten START um 2X/10 | gemessen -0,400 Mrd/s bei X = 2 Mrd, erwartet -0,400 (`Corporation.ts:92` `Math.abs`). **Die Spieldoku (`financial-statement.md`) schreibt `totalAssets += amt` - das ist falsch fuer 3.0.1** |
| K4 | Dummy-Division (Restaurant, 6 Bueros + 6 Lager) | Zyklusbewertung exakt (10e9 + F/3) * 1,0079741^12 = x1,100 |
| K5 | Offline-Nachholen | 1 h offline = 1800 Zustaende, abgearbeitet in 1999 Ticks = **6,7 min** (1 Zustand je Tick statt je 10 Ticks) |
| K6 | Einbau / Knotenwechsel | `prestigeAugmentation()`: Corp und Anteile unveraendert, Spielergeld 1262; `prestigeSourceFile()`: Corp weg |
| K7 | Bestechung | Bewertung < 1e14: abgelehnt; >= 1e14: angenommen; Bladeburners: abgelehnt |
| - | Spieldoku: Tobacco-Endspiel ~1e98/s | Simulator (exakte TA2-Formel) erreicht 3,8e95/s nach 20 h, 7,6e97/s nach 24 h |

### 2.3 Was am Treiber Annahme ist

- **Preis (entscheidend):** "exact" rechnet den TA2-Preis aus Spielinterna
  (`Division.ts:363-389`) - das kann ein Bot nicht, weil `getProduct` kein `markup`
  liefert (`NetscriptFunctions/Corporation.ts:254-281`). "lagK" (bot-tauglich, Doku
  `optimal-selling-price-market-ta2.md`): K = verkauft * (Preis - MP)^2 aus dem
  Vorzyklus, Preis = MP + 1,05 * sqrt(K / Lager*10). Ergebnis: gleiche Zuendzeit, aber
  Plateau ~1e22 statt 1e98-Deckel. Die Kurzfassung nennt deshalb "KF" als Hauptzeile.
- **Agri-Ausbau:** "Suchtreiber" probiert Kandidaten in Abzweigen (nicht bot-tauglich);
  "fix" (KF, B_fix) ist eine feste Regel (Smart Storage 2, Smart Factories 13, 6 Werbung,
  Rest Boosts, danach billigstes von SF/Werbung/Lager). Die feste Regel kostet bis Runde 1
  ~20 % Bewertung (Runde 1: 131 statt 165 Mrd).
- **Produktphase:** Heuristik nach Spieldoku (`general-advice.md`): Wilson wenn <= 20 %
  der Mittel, Werbung 15 %, Hauptbuero (Aevum) +15 bei <= 40 %, Corp-Upgrades je <= 5 %,
  Nebenbueros bis 60 % des Hauptbueros mit Produktionsmischung, Agri waechst mit dem
  Pflanzenbedarf, Chemical opportunistisch. Forschung erst bei RP >= 2x Kosten.
  **Das ist kein Optimum** - alle C-Zahlen sind Untergrenzen fuer diesen Treiber.
  Allein die Aufteilung der Mittel verschob die Zuendung zwischen ~10 h und >24 h.
- Exporte: Menge je Zyklus = Bedarf des Abnehmers minus Lager (cancel + export je
  Zyklus). Die Doku-Formel `(IPROD+IINV/10)*(-1)` laeuft nicht an (Falle F11).

## 3. Kandidaten im Einzelnen

### A - Seed-Auszahlung (Audit CORP-1) - bestaetigt, aber geschlagen
Gruenden, nach >= 100 s `goPublic(0)`, ~30 min warten bis Kurs = Ziel, verkaufen:
**104,5 Mrd nach 31 min** (K1). Verkauf direkt nach IPO nur 41,8 Mrd (private
Bewertung 10e9 + 150e9/3 = 60 Mrd, `Corporation.ts:214`). RAM 61,6 GB (3 Aktionen),
risikoarm. Danach ist der Spieleranteil weg, und das IPO beendet die Investorenrunden
(`Corporation.ts:333-343`, `Actions.ts:190-197`) - **A schliesst C fuer diesen Lauf aus.**

### B - Agriculture, IPO + sofort verkaufen
6 Staedte, Bueros 4, Boosts, Smart Factories/Storage, Werbung, eigener Einkauf:
Gewinn 1,2-1,6 Mio/s, private Bewertung ~315.000 s * Gewinn
(`Corporation.ts:214-216`) -> 430-550 Mrd -> **0,30-0,39 Bio nach 30 min**, danach
flach (Agri ist absatzgedeckelt: Absatz ~ Qualitaet * Werbung * Business,
`Division.ts:425-432`; ueber der Grenze bringt Mehrproduktion nichts). Mit Runde 1
(0,5 h, +131-165 Mrd Kasse fuer 10 % Anteile) 0,5-0,69 Bio. Schliesst C ebenfalls aus.

### C - Produktphase (Tobacco) - der Geldmotor, und er ist automatisierbar
Ablauf im Simulator (C4B_KF): Agri (0 h) -> Runde 1 bei 0,5 h (131 Mrd) -> Export +
Tobacco (6 Staedte, Hauptbuero 15) -> Runde 2 bei 2,5 h (~400 Mrd, Spieler 36,7 %)
-> Runde 3 bei 4,5 h (0,9-1,3 Bio, Spieler 20 %) -> Runde 4 bei 8,5-9 h (23-134 Bio,
Spieler 6,7 %). **Das Geld aus Runde 4 loest die Zuendung aus** (3 Saaten, Verlauf in
`sim/out/C4B_KF_s*.json`): Gewinn 1e8/s (8 h) -> 6e10-7e11/s (10 h) -> 1e16-5e17/s
(12 h); bestes Produktrating 7e3 -> 1e6-7e6; Werbe-Bekanntheit 5e2 -> 1e11-7e14 (12 h)
-> 5e18 (14 h); Wilson 6 -> 26-30, Werbung 55 -> 310-370, Hauptbuero 75 -> 540-675.
Mit Runde 4 schon bei 6 h (C4A_KF) zuendet es ~1-2 h frueher (10 h: Median 390 Bio).
Spielergeld bei Verkauf: 2,8 Bio (6 h), 8,9 Bio (8 h), 2e16 (10 h), 3e21 (12 h).

Warum Runden trotz Verwaesserung: g(6,7 %) = 0,045 gegen g(66,7 %) = 0,696 (Faktor
15,5), aber die Runden finanzieren die Zuendung; 2 Runden zuenden in 24 h nicht
sicher (C2B), 3 Runden (C3A_K) ~2-3 h spaeter als 4.

Mechanik der Zuendung (Quellen): Produkt-Absatzpreis TA2 = MP + Markupgrenze *
sqrt(D'/s) mit Markupgrenze = effRating/markup (`Division.ts:322, 385`), markup =
100/(adv * qualitaet^0,65 * busmgt) (`Product.ts:195-197`); D' enthaelt den
Werbefaktor (Bekanntheit^0,2 * Beliebtheit^0,2)^0,85 (`Division.ts:1027-1038`), und
jede Werbung multipliziert die Bekanntheit mit 1,005 * Wilson-Mult
(`Division.ts:979-988`) - Werbung kostet 1,06^n (`Division.ts:975-977`), waechst aber
mit Wilson exponentiell zurueck. Deckel: Bekanntheit 1,8e308 (`Division.ts:982`).

### D - Mischformen
- **Teilverkauf vor Runde 4 ist ausgeschlossen:** Verkauf braucht IPO, IPO beendet die
  Runden (`helpers.ts:99`, `Corporation.ts:337`).
- **Teilverkauf direkt nach Runde 4** (D4A_K/D4B_K, 50 %): 1,6-4,7 Bio bei 6,3 h bzw.
  7,6-462 Bio bei 8,8 h - Liquiditaet fuer den ersten Einbau. Preis: der Rest bringt
  spaeter nur ~1/10-1/50 dessen, was C bringt (3e21 statt 3e22 bei 24 h). Grund: nach
  dem IPO zaehlt die **oeffentliche** Bewertung (Fonds + 85.000 s * Delta statt
  10e9 + Fonds/3 + 315.000 s * Delta, `Corporation.ts:209/214-216`), und der Kurs steigt
  nur ~0,5 %/Zyklus = x6/h (`Corporation.ts:264-274`) - in der Zuendphase waechst V um
  x1000 in 2 h, der Kurs haengt hinterher.
- **Verkaufssperre** 1 h (`Constants.ts:50`, `helpers.ts:100-101`), "alle" verboten
  (`helpers.ts:97`), max. 1e14 je Verkauf (`helpers.ts:98`).
- **Neue Anteile** bringen nur der Corp Geld (`Actions.ts:161-188`); Rueckkauf mit
  10 % Aufschlag aus Spielergeld (`Corporation.ts:327-331`) - keine Arbitrage.

### E - weitere Wege Corp -> Spieler
- **Dividenden:** Spieler bekommt (Rate * Gewinn * 10 * Anteil)^0,85 je Zyklus
  (`Corporation.ts:189-196`, Tribut 0,15 in BN3 `:54`). Vor der Zuendung wertlos; nach
  der Zuendung ein **laufender Geldstrom** fuer spaetere Einbauten, wenn man einen
  Restanteil behaelt (z. B. 1 % von 1,5 Mrd Anteilen bei 1e17/s Gewinn: (1e16)^0,85
  ~ 4e13 je 10 s).
- **Bestechung existiert in 3.0.1** (`Actions.ts:633-675`): aus der CORP-Kasse,
  1 Ruf je 1e9 (`Constants.ts:62`), nur ab Bewertung 1e14 (`:61`), nur Fraktionen mit
  Arbeit - Bladeburners nein (`Faction/FactionInfo.tsx:698-713`, K7). C4B_KF (6 Saaten):
  Bewertung >= 1e14 ab 8-10 h; Kasse/1e9 = kaufbarer Ruf: 12 h 4e4-1e10, 14 h 4e9-5e11,
  24 h ~2e12. Vor dem Plateau kostet jede Bestechung Wachstum; danach praktisch frei.
- Spende aus Spielergeld (Gunst >= 75 in BN3, `BitNode.tsx:617`) ist 1000x billiger je
  Ruf als Bestechung - sobald Gunst da ist.
- Kein anderer Weg (keine Geld-Ueberweisung Corp -> Spieler; Doku `faq.md`).

## 4. Persistenz und Takt

- **Einbau:** Corp, Anteile, Fonds bleiben (K6; `PlayerObjectGeneralMethods.ts:80-142`
  ohne Corp-Reset); Spielergeld faellt auf 1.000 (`:102`). Die Corp waechst ueber alle
  Einbauten eines BN3-Laufs weiter. **Alle Skripte sterben beim Einbau**
  (`Prestige.ts:57`): Preise/Exporte/Tee stehen dann still (F8).
- **Knotenwechsel:** Corp geloescht (`PlayerObjectGeneralMethods.ts:143-169`, K6). Jeder
  BN3.x-Lauf beginnt von vorn (Seed wieder gratis) - und braucht wieder ~10-14 h bis
  zur Zuendung.
- **Takt:** 1 Zustand je Engine-Tick (`engine.tsx:111-114`, `Corporation.ts:109-117`);
  Marktzyklus 10 s. Offline-Zeit wird gespeichert (`engine.tsx:329`) und mit 1 Zustand
  je Tick (= 10-fach) abgearbeitet (K5). **Gedrosselter Hintergrundtab** (1 Wake/min):
  `updateGame(diff)` ruft `process()` nur EINMAL (`engine.tsx:415-441`) -> die Corp
  laeuft mit 1/30 Tempo, der Rest wird Bonuszeit. Kontrolle: `getBonusTime()` (0 GB).

## 5. Empfehlung und Entscheidungsregel

1. **Bei jedem BN3.x-Start sofort** `createCorporation(name, false)` und Plan C starten.
2. **Kein IPO, solange Runde 4 aussteht.** Ausnahme (dann B statt C): der BN3-Lauf endet
   voraussichtlich in < ~12 h, oder der Bot braucht vor ~8 h dringend Geld und kann
   nicht warten - dann Agri bauen, nach >= 30 min IPO + sofort verkaufen (0,3-0,4 Bio).
   A nur, wenn keine ~320 GB fuer B frei sind.
3. Runden: 1 bei 0,5 h; 2 bei ~2-2,5 h; 3 sobald 2 Produkte fertig (~4-4,5 h); 4 bei
   ~8,5-9 h (3 Produkte fertig). Runde 4 schon bei 6 h bringt nur 1,0-4,6 statt 6,8-134 Bio
   und zuendete in 1 von 5 Saaten erst bei 16 h. Jeweils **11 Zyklen vorher keine Langfrist-Ausgabe**
   (F3) und Dummy-Divisionen bauen, wenn 0,1*V > 55 Mrd/3.
4. Nach Runde 4 optional Teilverkauf (<= 50 %) fuer den naechsten Einbau.
5. **Zuendung erkennen:** Bewertung >= ~1e15 oder Gewinn >= 1e12/s. Dann vor dem
   naechsten Augmentierungskauf IPO + sofort den Hauptteil verkaufen (private
   Bewertung!), Rest als Dividendenquelle halten. Ab Bewertung 1e14 Bestechung fuer
   Augmentierungs-Ruf.
6. Vor dem Knotenwechsel ist nichts zu retten - Geld und Corp verfallen ohnehin.

## 6. RAM-Plan

Simulator-Treiber nutzt 29 Funktionen = **531,6 GB** in einem Skript (ohne Getter, die
ein Bot zusaetzlich braucht). Aufteilung fuer den Bot (Werkbank-Server, home 128 GB
reicht nur fuer A und das Finanzskript):

| Skript | Funktionen | RAM |
|---|---|---|
| corp-takt (je Zustand, `nextUpdate` 0 GB) | sellMaterial, sellProduct, buyMaterial, exportMaterial, cancelExportMaterial, limitProductProduction, buyTea, throwParty + getCorporation, getDivision, getOffice, getWarehouse, getMaterial, getProduct | 8x20 + 6x10 + 1,6 = **221,6 GB** |
| corp-bau (alle ~5 Zyklen, startet/endet) | expandIndustry, expandCity, purchaseWarehouse, upgradeWarehouse, upgradeOfficeSize, hireEmployee, setJobAssignment, levelUpgrade, purchaseUnlock, hireAdVert, research, makeProduct, discontinueProduct + 6-8 Getter (Kosten, getResearchCost ...) | 13x20 + ~8x10 + 1,6 = **~342 GB** |
| corp-finanz (selten) | createCorporation, getInvestmentOffer, acceptInvestmentOffer, goPublic, sellShares, bribe, getCorporation | 5x20 + 2x10 + 1,6 = **121,6 GB** |
| nur A | createCorporation, goPublic, sellShares (+ getCorporation) | 61,6 (71,6) GB |

Spaeter (RP >= ~150k) kann corp-takt schrumpfen: Smart Supply (25 Mrd), Market-TA.II
(Forschung 5k+20k+50k RP), Export-Formeln und Praktikanten laufen im Spiel ohne Skript.

## 7. Fallenliste (alle im Code belegt, F2/F3/F5/F11/F12 im Simulator gemessen)

- F1 `createCorporation` ohne `false` will 150 Mrd vom Spieler (`NetscriptFunctions/Corporation.ts:631`).
- F2 IPO vor dem ersten START-Zyklus: Kurs 0,01, Ziel erst nach 326 min (K1, `Corporation.ts:271-273`).
- F3 Langfrist-Ausgabe (Buero, Lager-Ausbau, Upgrades, Produkt, `FundsSource.ts:3-13`) in den 10 Zyklen vor Runde/Verkauf: assetDelta -2X/10 im naechsten Zyklus (K3), Bewertung = Mittel aus 10 Zyklen (`Corporation.ts:226-232`). Werbung, Divisionen, Material zaehlen als kurzfristig.
- F4 IPO beendet Investorenrunden (`Corporation.ts:333-343`).
- F5 Nach dem IPO gilt die oeffentliche Bewertung; beim profitablen Unternehmen ist sie ~3,7x kleiner. Verkauf im SELBEN Moment wie das IPO nutzt noch die private Durchschnittsbewertung. Beim Seed ohne Geschaeft umgekehrt (30 min warten, K1).
- F6 Kurs folgt dem Ziel nur ~0,5 %/Zyklus (`Corporation.ts:264-274`) - Tranchen nach dem IPO in der Wachstumsphase sind stark entwertet.
- F7 Spielergeld weg beim Einbau (`PlayerObjectGeneralMethods.ts:102`) - verkaufen direkt vor dem Kauf.
- F8 Skripttod (Einbau, Bruecke): Zahlenpreise, Produktionslimits, Exporte frieren ein; Energie/Moral fallen ab 9 Koepfen ohne Praktikanten mit x0,998/Zyklus (`OfficeSpace.ts:78-85`) = halbiert in ~1 h. Gegenmittel: Praktikanten >= 1/9, Smart Supply, TA2-Forschung sobald RP reicht, Skript nach Einbau sofort neu starten.
- F9 Lager voll mit Boostmaterial -> Produktion steht (`Division.ts:607-611, 882-886`). Im Simulator passiert: Gewinn fiel 12 h -> 16 h von 8 Mrd/s auf 0,5 Mrd/s, bis Platzreserve = 2x Zyklusdurchfluss eingebaut war.
- F10 Marktware hat Qualitaet 1 und verduennt den Lagerbestand (`Division.ts:571`); fuer Tobacco deckelt das das effektive Rating auf (1+Qualitaet)*sqrt(Rating) (`Division.ts:901-930`). Tobacco-Pflanzen nur aus Agri.
- F11 Doku-Exportformel `(IPROD+IINV/10)*(-1)` laeuft nicht an (Abnehmer ohne Vorrat verbraucht 0 -> bekommt 0); gemessen: Tobacco-Produktion blieb bei 0.
- F12 Tee/Party je Zyklus: 500k je Kopf (`Constants.ts:51`) - bei 72 Koepfen 2,4 Mio/s, mehr als der Agri-Gewinn. Nur unter Schwelle kaufen.
- F13 Bewertung >= 1e14 fuer Bestechung; Bladeburners nie (K7).
- F14 Hintergrundtab gedrosselt -> Corp 1/30 Tempo (Abschnitt 4).
- F15 Max. 20 Divisionen (Dummies), max. 3 Produkte (+2 per Forschung, `Division.ts:44-53`).

## 8. Gerechnet vs geschaetzt; Pruefung der Vorarbeit

GERECHNET (Spielcode ausgefuehrt): alle Tabellenwerte, Rundenangebote, Zuendzeiten,
K1-K7. Streuung ueber 3 Saaten (Zufall: Mitarbeiterwerte, Markt, Kurs).
TREIBERABHAENGIG (Untergrenze, nicht Optimum): B, C, D. Die Aufteilung der Mittel
allein verschob die Zuendung um > 10 h; ein besserer Bot zuendet frueher.
GESCHAETZT / nicht gerechnet: Wirkung auf die Laufdauer eines BN3-Laufs (Ruf, Black Ops);
Treue einer echten Bot-Umsetzung (1-Zyklus-Verzug der Preise ist mit "lagK" erfasst,
Skriptlaufzeiten nicht); RAM der Getter (+/- 30 GB).

Vorarbeit `nodes/audit-2026-10-03/inventar-corp.md`:
- CORP-1 bestaetigt (104,5 Mrd/31 min; Falle 326 min). Aber: A ist kein "Reservetopf vor jedem Einbau" - es gibt nur EINEN Anteilsblock, und das IPO beendet die Runden.
- CORP-2 Groessenordnung bestaetigt (B 0,3-0,7 Bio). Audit-Annahme "Auszahlung nach 3 h ~434 Mrd" liegt im Band.
- CORP-3 jetzt gerechnet: nicht "needs_calc", sondern der beherrschende Kandidat ab ~10 h.
- CORP-4 (c) bestaetigt und verschaerft: 2X ist Code, die Spieldoku ist an der Stelle falsch.
- Zeilennummern im Audit beziehen sich auf `bitburner-src` (3.0.2); hier `v301`. Unterschied der Corp-Dateien nur Preis-/Mengenparser (eval -> expr-eval), Mechanik gleich (`diff -r`).
- Neu gegenueber dem Audit: Verkauf am IPO-Moment nutzt die private Bewertung (315.000 s statt 85.000 s Gewinn); Dummy-Divisionen bis x6,7; Kursnachlauf entwertet Tranchen nach dem IPO.

## 9. Dateien

- `sim/corpsim.ts` Treiber + Liquidation; `sim/run.test.ts` Szenarien; `sim/kalib.test.ts` K1-K7;
  `sim/auswertung.mjs` Tabelle; `sim/out/*.json` Rohdaten (Ergebnisse, Ereignisse, Verlauf je 0,5 h); `sim/jest.config.cjs`.
- Aufruf (aus `reference/v301`):
  `CORP_SCEN=C4B_KF CORP_SEEDS=1,2,3 node node_modules/jest/bin/jest.js -c ../../nodes/corp-2026-10-05/sim/jest.config.cjs -i run.test`
  (erster Lauf ~2 min Transpilieren, danach ~40 s je 24-h-Lauf, 1 Kern).
