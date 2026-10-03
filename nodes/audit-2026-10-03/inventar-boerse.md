# Inventar BOERSE - Vollstaendigkeits-Audit 03.10.2026

Stand: Systemzeit 2026-10-03 17:37. Spielstand `LIVE_197f4d61481686_BN2L1_2026-10-03T17-17_hourly`
(BN2.1, 12,58 h seit Einbau). Spielquelle 3.0.2 unter `reference/bitburner-src/src/`, Bot `src/`
(nur gelesen). Rechner unter `tools/audit/boerse-*.mjs` (Liste und Eichstand in Abschnitt 4).
Fortsetzung eines abgebrochenen Laufs: `boerse-sim.mjs`, `boerse-szenarien.mjs`,
`boerse-4skauf.mjs`, `boerse-bargeld.mjs`, `boerse-save.mjs` lagen vor und wurden
wiederverwendet; neu sind `boerse-orig.mjs`, `boerse-eich.mjs`, `boerse-v2.mjs`,
`boerse-bn8.mjs`, `boerse-push.mjs`, `boerse-stall.mjs`.

## Kurzfazit

- **Die Boerse ist in den V2-Knoten die groesste ungenutzte Geldquelle.** Kursgewinne laufen
  ueber `Player.gainMoney(gains, "stock")` (`StockMarket/BuyingAndSelling.tsx:173,362`) ohne
  jeden BitNode-Multiplikator - waehrend Hackgeld in BN2/3/11/13 durch `ServerMaxMoney`
  und `ScriptHackMoney` auf 1-8 % gedrueckt ist. Fuer den Skripthandel genuegt die TIX-API
  (5 Mrd, fester Preis); das WSE-Konto braucht man nicht. Gerechnet mit dem bitgleich
  geeichten Marktmodell und dem gemessenen BN2.1-Hackeinkommen (4,2 Mrd/h): **100 Mrd nach
  6,4 h statt 23,9 h, 417,5 Mrd (ganzer Graftplan) nach 7,8-10,3 h statt ~99 h, 1 Bio nach
  8,8-12,4 h** (Knotenstart bei 0 $). Der Bot handelt nur in BN8 (`src/registry.json:342-345`).
- **E3 ist damit neu zu bewerten:** Der letzte Audit schaetzte die Boerse als V1-Beiwerk
  (1-1,5 % des Hackeinkommens, ohne Zinseszins). In V2 bringt sie im 12-h-Fenster das 5- bis
  100-fache dessen, was das Hacken allein bringt (BN2: 1,3-5,3 Bio gegen 50 Mrd; BN11-artig:
  62 gegen 12 Mrd). Der Wert haengt am Geldabfluss (Grafting AUG-1, Einbaurunde, Gang).
- **boerse.js ist fuer BN8 nicht bereit (C6, neue Belege):** (a) es gibt keinen Geldweg vom
  Depot zu Augmentierungen, Spenden und der Daedalus-Bedingung "100 Mrd BARgeld" -
  `BARBESTAND 0,15` haelt rechnerisch und im Nachbau ~0,03 % Bargeld; (b) der
  Schliess-Haken `data/boerse-schliessen.txt` hat keinen Schreiber und zielt auf den Sprung
  statt auf den Einbau; (c) die Handelsregel (nur Long, 25 % je Aktie, Rang nach Forecast)
  braucht je Einbauzyklus ~4,6 h laenger bis 1 Bio als die beste Regel mit Leerverkauf;
  (d) die Kurssteuerung per `grow(host, {stock:true})` fehlt - grob geschaetzt ein
  Faktor 10-100 auf das Vermoegen nach 6 h.
- Kein einziger der 200 Spielstaende hatte je Boersenzugang (`boerse-save.mjs`, das
  Werkzeug liest `hasWseAccount/hasTixApiAccess/has4S*` und `StockMarketSave.lastUpdate`,
  kann den Fall also zeigen). Eine Eichung gegen einen Spielstandwert ist deshalb
  unmoeglich; geeicht wurde gegen den **Originalquelltext** (20.000 Ticks, 3 Seeds,
  bitgleich) und die **Spiel-eigenen Unittests** (101 Sollwerte, 0 Abweichungen).

---

## 1. Feature-Inventar (aus dem Spielquellcode)

Pfade relativ zu `reference/bitburner-src/src/`. Restroute BN2, 3, 11, 6, 7, 14, 13, 15 (V2),
BN8 (V1). SF8 fehlt und kommt erst nach dem Routenende.

| # | Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag/Hebel |
|---|---|---|---|---|
| F1 | WSE-Konto `purchaseWseAccount` 200 Mio | `NetscriptFunctions/StockMarket.ts:297-315`, `StockMarket/data/Constants.ts` | alle; BN8 frei (`Prestige.ts:161-164,296-299`) | nur fuer Oberflaeche und 4S-Anzeige; Skripthandel braucht es NICHT (`checkTixApiAccess` :41-45 prueft nur TIX) |
| F2 | TIX-API `purchaseTixApi` 5 Mrd, legt den Markt frisch an | `NetscriptFunctions/StockMarket.ts:316-334`, `StockMarketCosts.ts:15-17` | alle, fester Preis ohne BN-Mult; BN8 frei | Pflicht fuer jedes `ns.stock.*` |
| F3 | 4S-Marktdaten (Anzeige) 1 Mrd x `FourSigmaMarketDataCost` | `:248-273`, `StockMarketCosts.ts:3-5` | alle | nur Oberflaeche, fuer Skripte wertlos |
| F4 | 4S-TIX-API 25 Mrd x `FourSigmaMarketDataApiCost` | `:274-296`, `StockMarketCosts.ts:7-9`, `BitNode/BitNode.tsx:743-744 (BN7 x2), 906-907 (BN11 x4), 1020-1021 (BN13 x10)` | alle; BN2/3/6/14/15/8 25 Mrd, BN7 50, BN11 100, BN13 250 | liefert `getForecast`/`getVolatility` = wahre Aufwaertswahrscheinlichkeit |
| F5 | Zugaenge ueberleben den Einbau, fallen beim Knotenwechsel | `PersonObjects/Player/PlayerObjectGeneralMethods.ts:162-166` (nur `prestigeSourceFile`) | alle | 5 Mrd/4S einmal je Knoten |
| F6 | Markt wird bei JEDEM Einbau und Knotenwechsel neu angelegt, Positionen weg; Geld auf 1.000 (BN8: 250 Mio) | `Prestige.ts:158-170` (Einbau), `:293-323` (Knoten), `PlayerObjectGeneralMethods.ts:102` | alle | Depot muss VOR der Einbaurunde zu Bargeld werden |
| F7 | Takt: 1 Kursschritt je 6 s; gespeicherte Zyklen (offline/gedrosselt) werden mit hoechstens 1 Schritt je 4 s Wanduhr nachgeholt | `StockMarket.ts:238-256`, `engine.tsx:99-102,320-324`, `data/Constants.ts` | alle | 600 Schritte/h, nachholend bis 900/h |
| F8 | Kursprozess: Preis x(1+av) oder /(1+av), av = v x mv/100 (v je Schritt fuer ALLE Aktien gleich), Aufwaertschance (50 +- otlkMag)/100, Weichdeckel bei `cap` | `StockMarket.ts:264-305`, `Stock.ts:139` | alle | erwarteter Log-Ertrag je Schritt (2f-1) x E[ln(1+av)]; ECP/MGCP f = 0,69, mv 0,4-0,5 % |
| F9 | Forecast-Dynamik: otlkMag wandert zum Ziel `otlkMagForecast` (Chance bis 0,95), Zyklus alle 75 Schritte kippt b UND Ziel mit 45 % | `Stock.ts:174-239`, `StockMarket.ts:223-236,307-316` | alle | Richtung haelt im Mittel ~167 Schritte; 32 von 33 Aktien starten bullish (`InitStockMetadata.ts`) |
| F10 | Long kaufen/verkaufen, Kommission 100k je Auftrag, Spread 0,1-2 % (`InitStockMetadata.ts`), hoechstens 20 % der Aktien (Long+Short) | `BuyingAndSelling.tsx:40-205`, `StockMarketHelpers.ts:15-61`, `Stock.ts:144-150,224-232` | alle | Markttiefe zu Beginn 5,42 Bio $ (`boerse-sim.mjs --eich`) |
| F11 | Leerverkauf `buyShort/sellShort` | `NetscriptFunctions/StockMarket.ts:156-175`, Waechter `:46-53` | NUR BN8 (SF8.2 fehlt) | verdoppelt die Gelegenheiten |
| F12 | Limit-/Stop-Orders `placeOrder/cancelOrder/getOrders`, vom Spiel je Schritt ausgefuehrt | `:176-226`, `StockMarket.ts:293-305`, `OrderProcessing.tsx` | NUR BN8 | Stop-Sell schuetzt das Depot auch bei totem Skript |
| F13 | Eigener Handel drueckt otlkMag Richtung 50 (0,006 je `shareTxForMovement`, nicht unter 5) | `StockMarketHelpers.ts:70-109`, `Stock.ts:246-265` | alle | begrenzt die Positionsgroesse je Aktie |
| F14 | Lesefunktionen getPrice/Ask/Bid/Position/MaxShares/PurchaseCost/SaleGain/Organization/Symbols (2 GB je Name) | `NetscriptFunctions/StockMarket.ts:61-138`, `Netscript/RamCostGenerator.ts:124-155` | alle mit TIX | Grundlage jeder Regel |
| F15 | `getForecast`/`getVolatility` | `:227-247` | mit 4S-API | ersetzt die Schaetzung |
| F16 | `nextUpdate()` (0 GB), `getBonusTime()` | `:335-344` | alle mit TIX | Takt genau auf den Kursschritt |
| F17 | Kurssteuerung `grow(host,{stock:true})` hebt, `hack(...,{stock:true})` senkt `otlkMagForecast` um 0,1 mit p = bewegter Anteil an moneyMax, EIN Wurf je Aufruf | `NetscriptFunctions.ts:301-303`, `Netscript/NetscriptHelpers.tsx:396-418,668-670`, `StockMarket/PlayerInfluencing.ts:24-61` | alle, ohne TIX-Pruefung | steuert die Richtung gehaltener Aktien |
| F18 | Firmenarbeit (Spieler/Sleeve) hebt das Ziel um 0,001 x Leistung mit p = 0,002 je Zyklus | `PlayerInfluencing.ts:70-86`, `Work/CompanyWork.tsx:49`, `Sleeve/Work/SleeveCompanyWork.ts:47` | alle | vernachlaessigbar |
| F19 | Darknet `promoteStock`: Volatilitaet x bis 4 (`1+(1-e^-0,001c)+2(1-e^-0,00015c)`), Ladungen x0,4 je Zyklus | `NetscriptFunctions/Darknet.ts:583-611`, `DarkNet/effects/effects.ts:218-229`, `DarkNet/utils/darknetAuthUtils.ts:6-8` | mit TIX und Darkscape bzw. BN15 | mehr Ertrag je Schritt auf gehaltenen Aktien |
| F20 | BN8: 250 Mio Startgeld bei jedem Einbau, WSE+TIX frei, alle anderen Geldquellen 0, Spenden ab Favor 0 | `Prestige.ts:38,158-164`, `BitNode/BitNode.tsx:764-793` | BN8 | Boerse ist die einzige Geldquelle; Ruf = Geld |
| F21 | Kursgewinne ohne BN-Multiplikator | `BuyingAndSelling.tsx:173,362` (`gainMoney(..,"stock")`) | alle | relativ am staerksten, wo Hackgeld schwach ist |
| F22 | Daedalus verlangt 100 Mrd BARgeld | `Faction/FactionInfo.tsx:143`, `Faction/FactionJoinCondition.ts:134-143` (`p.money`) | alle; BN8 entscheidend | Depot zaehlt nicht |
| F23 | Spenden: Ruf = $/1e6 x faction_rep x FactionWorkRepGain | `Faction/formulas/donation.ts:8-18` | ab Favor-Schwelle; BN8 ab 0 | Red Pill (2,5 Mio Ruf, `Augmentations.ts:1954`) = ~2,5 Bio $ in BN8 |
| F24 | SF8: L1 WSE+TIX dauerhaft, L2 Shorts, L3 Orders, Hack-Wachstum +12/18/21 % | `BitNode/BitNode.tsx:301-310` | nach BN8 (Routenende) | fuer die Route bedeutungslos |
| F25 | `bitNodeOptions.disable4SData` | `NetscriptFunctions/StockMarket.ts:249,275`, `BitNode/BitNodeUtils.ts:38` | Herausforderungsoption, Standard aus | - |

## 2. Abdeckungsmatrix

| # | Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil |
|---|---|---|---|---|---|
| F1 | WSE-Konto | `src/stockaccess.js:50-55` (DOM-Kauf, nicht in Registry) | nie | OPTIMAL | richtig, dass das Live-System es nicht kauft |
| F2 | TIX-API | fehlt (`ns.stock.purchaseTixApi` 0 Treffer in `src/`) | BN8 frei, sonst nie | NICHT GENUTZT | Kern von BOERSE-1 |
| F3 | 4S-Anzeige | `src/stockaccess.js:53`; `src/boerse.js:50` kauft bewusst nicht | nie | OPTIMAL | |
| F4 | 4S-TIX-API | `src/boerse.js:178-193` | BN8 | GENUTZT-SUBOPTIMAL (harmlos) | Kauf haengt am Bargeld >= 26 Mrd: im Nachbau 7,1 h (3,2-10,0) nach Erreichen von 26 Mrd Vermoegen; kostet aber kein Vermoegen (Tabelle 4.4, "bot" gegen "bot+4S-Verm") |
| F5 | Zugang ueberlebt Einbau | `src/stockaccess.js:1-10` (richtig erkannt), `src/boerse.js` merkt 4S je Lauf | BN8 | OPTIMAL | |
| F6 | Markt-Reset bei Einbau | `src/boerse.js:52-55,156-170` - nur fuer den SPRUNG gedacht, Datei ohne Schreiber | BN8 | GENUTZT-TOT | BOERSE-2 |
| F7 | Takt | `src/boerse.js:64,307` `ns.sleep(6000)` | BN8 | GENUTZT-SUBOPTIMAL (klein) | `nextUpdate()` waere taktgenau; beim Nachholen (4 s) faellt jeder dritte Schritt aus der Historie |
| F8/F9 | Kursmodell / Schaetzung | `src/boerse.js:342-355` (Anteil Aufwaertsschritte, 40 Schritte) | BN8 vor 4S | OPTIMAL (Schaetzer) | Schaetzer erwartungstreu; die Regel darum herum ist es nicht (BOERSE-3) |
| F10 | Long | `src/boerse.js:221-265` | BN8 | GENUTZT-SUBOPTIMAL | 25 % je Aktie, Rang nach f statt (2f-1)xmv, Bargeldreserve wirkungslos (BOERSE-2/3) |
| F11 | Leerverkauf | fehlt in `src/boerse.js`; `src/stocks.js:83,150` (Altwerkzeug, wirft ausserhalb BN8) | BN8 | NICHT GENUTZT | Teil BOERSE-3 |
| F12 | Limit/Stop | fehlt | BN8 | NICHT GENUTZT | BOERSE-6 (Stop-Sell als Stillstandsschutz) |
| F13 | Eigener Kursdruck | nicht modelliert (`src/boerse.js:254-257` begrenzt nur auf maxShares) | BN8 | GENUTZT-SUBOPTIMAL (klein) | im Nachbau mitgerechnet; bei 25 % je Aktie kaum bindend |
| F14 | Lesefunktionen | `src/boerse.js:124,198,222,256,271` | BN8 | OPTIMAL | |
| F15 | getForecast | `src/boerse.js:205-208` | BN8 nach 4S | OPTIMAL | |
| F16 | nextUpdate | fehlt | - | NICHT GENUTZT | klein, in BOERSE-3 |
| F17 | grow/hack {stock:true} | fehlt (0 Treffer `stock:` in `src/worker/`) | - | NICHT GENUTZT | BOERSE-4; bekannt (BAUSTELLEN 2564-2585, inventar-hack #15) |
| F18 | Firmenarbeit | - | - | NICHT ANWENDBAR | Wirkung vernachlaessigbar |
| F19 | promoteStock | fehlt | - | NICHT GENUTZT | BOERSE-7, P3 |
| F20 | BN8-Sonderregeln | `src/route.json:43-45` (`braucht: boerse.js`), `src/registry.json:337-360`, `src/ausgang.js:396-397` | BN8 | GENUTZT-SUBOPTIMAL | Route laeuft in BN8 ein, weil die Datei liegt; Gewerk nicht bereit (C6) |
| F21 | kein BN-Mult auf Kursgewinne | Registry `knoten: [8]` (`src/registry.json:342-345`), `src/lib/reg.js:143-146` | nur BN8 | NICHT GENUTZT | BOERSE-1 |
| F22 | Daedalus-Bargeld | `src/bn4rep.js` liest nur `getServerMoneyAvailable("home")` (:604, :1739, :1819), kennt kein Depot | BN8 | NICHT GENUTZT (Kopplung fehlt) | BOERSE-2 |
| F23 | Spenden | `src/bn4rep.js` (Spendenlogik vorhanden, Favor-Schwelle live laut 1-bitnode-regeln.md:65) | alle | GENUTZT, in BN8 ohne Bargeld | BOERSE-2 |
| F24 | SF8 | - | - | NICHT ANWENDBAR | nach Routenende |
| F25 | disable4SData | - | - | NICHT ANWENDBAR | Standard aus |

Zaehlung ueber 25 Features: OPTIMAL 7 (F1, F3, F5, F8, F9, F14, F15), GENUTZT-SUBOPTIMAL 6
(F4, F7, F10, F13, F20, F23), GENUTZT-TOT 1 (F6), NICHT GENUTZT 8 (F2, F11, F12, F16, F17, F19,
F21, F22), NICHT ANWENDBAR 3 (F18, F24, F25). Altwerkzeuge siehe BOERSE-5.

---

## 3. Befunde

### BOERSE-1 [NICHT_GENUTZT, P1] Kein Aktienhandel in V2-Knoten - die einzige Geldquelle ohne BN-Abschlag bleibt liegen

- **Bot:** `src/registry.json:342-345` (`boerse.js`: `verfahren V1`, `knoten [8]`), `src/lib/reg.js:143-158`
  laesst es nur in BN8 zu. `ns.stock.purchaseTixApi` wird nirgends gerufen; `src/stockaccess.js`
  (DOM, 31,2 Mrd fuer alle vier Posten) und `src/stocks.js` (braucht 4S) sind Handwerkzeuge
  ohne Registry-Eintrag.
- **Spiel:** Kursgewinne ohne Multiplikator (`StockMarket/BuyingAndSelling.tsx:173,362`); TIX reicht
  fuer den Handel (`NetscriptFunctions/StockMarket.ts:41-45,139-155,316-334`), kein WSE-Konto
  noetig; TIX 5 Mrd fest, 4S-API 25 Mrd x Mult (BN7 2, BN11 4, BN13 10). Zugaenge ueberleben
  Einbauten (`PlayerObjectGeneralMethods.ts:162-166`), der Markt nicht (`Prestige.ts:166-170`).
  Hackgeld-Abschlag dagegen: BN2 ServerMaxMoney 0,08 (`BitNode.tsx:574`), BN3 0,04 x
  ScriptHackMoney 0,2 (:598,609), BN11 0,01 (:888), BN13 0,3375 x 0,2 (:1002,1009).
- **Rechnung** (`boerse-v2.mjs`, Markt bitgleich zum Original, 12 Seeds, Start bei 0 $,
  Hackeinkommen H laeuft je Schritt zu, nur Long):

  | Knoten (Annahme) | Strategie | TIX / 4S bei | h bis 100 Mrd | h bis 417,5 Mrd | h bis 1 Bio | Vermoegen 12 h |
  |---|---|---|---|---|---|---|
  | BN2, H = 4,2 Mrd/h GEMESSEN | ohne Boerse | - | 23,9 | ~99 | ~238 | 50 Mrd |
  | | TIX + Historie | 1,4 h | 6,4 [5,1-9,3] | 10,3 [7,2-12,2] | 12,4 [9,0-16,1] | 1,31 Bio |
  | | TIX, Historie, 4S aus Gewinn | 1,4 / 4,4 h | 6,4 [5,3-8,2] | 7,8 [6,4-10,1] | 8,8 [7,1-11,9] | 5,32 Bio |
  | | sofort TIX+4S (30 Mrd sparen) | 7,4 h | 10,3 | 12,1 | 13,1 | 0,48 Bio |
  | BN11-artig, H = 1 Mrd/h, 4S 100 Mrd | TIX + Historie | 6,0 h | 13,5 | 17,6 | 20,6 | 62 Mrd |
  | | ... 4S aus Gewinn | 6,0 / 13,9 h | 13,5 | 16,3 | 17,3 | 48 Mrd |
  | BN13-artig, H = 1 Mrd/h, 4S 250 Mrd | TIX + Historie | 6,0 h | 13,5 | 17,6 | 20,6 | 62 Mrd |

  H = 4,2 Mrd/h ist aus dem Spielstand gerechnet: `moneySourceA.hacking` 52,8 Mrd /
  `playtimeSinceLastAug` 12,58 h (17:17); die Werte fuer BN11/BN13 sind Annahmen
  (Hackgeld-Faktor x BN2-Einkommen), sie verschieben nur den TIX-Zeitpunkt (6 Mrd / H).
  Faustregel aus allen Laeufen: **ab TIX-Kauf rund 5 h bis 100 Mrd, 9 h bis 417 Mrd,
  11 h bis 1 Bio**, unabhaengig vom Knoten. 4S lohnt sich ab ~1 Bio, vorher kaum.
- **Gegen die beste Alternative:** Fuer die ersten Mrd schlaegt der Rechnerpark die Boerse
  (INFRA-3: +3,7-7,1 Mrd/h fuer 1,1-2,2 Mrd = Amortisation < 1 h, die Boerse waechst mit
  ~x1,5-1,7 je Stunde). Die Boerse ist der Abfluss fuer alles, was der Park nicht mehr
  sinnvoll aufnimmt (heute 9,4-21 Mrd Bargeld liegen in BN2.1 stundenlang, 17:16 21,1 Mrd).
  Gang-Geld in BN2 (inventar-gang: 17 Mrd/h nach 8 h) ist eine echte Alternative - beide
  schliessen sich nicht aus.
- **Was das Geld in V2 kauft:** Graftplan 417,5 Mrd fuer competence x28,8, die ersten acht
  Grafts 79,5 Mrd fuer x5,15 (inventar-aug AUG-1); Simulacrum 150-450 Mrd (AUG-3);
  Einbaurunde (inventar-gang: "Geld ist in BN2 der zweite Engpass"). Ohne einen dieser
  Abfluesse ist der Ertrag nur Kontostand - BOERSE-1 ist ein Hebel FUER AUG-1/AUG-3.
- **Randbedingungen fuer den Bau** (aus dem Quellcode und `boerse-stall.mjs`):
  (1) vor jeder Einbaurunde alles verkaufen - `Prestige.ts:166-170` loescht das Depot, und
  bn4rep/graftauto sehen nur Bargeld; (2) ein stehender Haendler blutet: Depot nach 4 h
  Stillstand im Median x1,10, aber 10-%-Quantil x0,70, schlechtester x0,32 (Stop-Orders gibt
  es ausserhalb BN8 nicht, `NetscriptFunctions/StockMarket.ts:183`); (3) Trockenlauf zuerst:
  TIX kaufen (5 Mrd, ~1,2 h BN2-Einkommen), 1-2 h Papierhandel - das liefert die erste
  Eichung gegen den echten Markt (E3 "Trockenmodus zuerst" bleibt richtig).
- **Ertrag:** BN2: 100 Mrd 17,5 h frueher, 417,5 Mrd ~89 h frueher, je V2-Lauf; in Rang
  umgerechnet erst mit dem AUG-1-Rangmodell (needs_calc). GERECHNET_UNGEEICHT (Formeln
  bitgleich zum Original, kein Spielstand mit Boerse).
- **known_before:** E3 (`nodes/AUDIT-PERFEKT-2026-09-26.md:55`, `nodes/audit-2026-09-26/5-nebensysteme.md:82-90`):
  dort als V1-Nebenertrag 1-1,5 % des Hackeinkommens bei festem Kapital bewertet. Neue
  Bewertung: der Zinseszins fehlte, und der Hebel liegt in V2, nicht in V1.

### BOERSE-2 [FEHLER, P2, BN8] boerse.js haelt kein Bargeld und hat keinen Weg zur Einbaurunde - Augs, Spenden und Daedalus verhungern

- **Bot:** `src/boerse.js:93-101` verspricht "Wie viel Geld liegen bleibt. NICHT NULL"; die Kaufschleife
  `:239-265` rechnet `frei` je Kandidat neu aus dem schrumpfenden Bargeld (85 % davon), und
  jede Runde legt 85 % des Restes erneut an - geometrisch gegen null. `src/bn4rep.js:604,1739,1819`
  kauft und spendet nur aus `getServerMoneyAvailable("home")`, kennt kein Depot. Der Schliess-Haken
  `src/boerse.js:161-170` liest `data/boerse-schliessen.txt`; einen Schreiber gibt es nicht
  (Grep ueber `src/` und `tools/`: nur der Leser und `tools/test-boerse.js:129-130`, das prueft
  nur, DASS boerse.js die Datei liest - es kann den fehlenden Schreiber nicht zeigen). Der
  Kommentar `:52-55` nennt `Prestige.ts:171` und den Knotenwechsel; geloescht wird das Depot
  aber schon bei JEDEM Einbau (`Prestige.ts:166-170`), und beim Sprung ist ohnehin alles
  Geld weg (`PlayerObjectGeneralMethods.ts:102`).
- **Spiel:** Daedalus will `p.money >= 100e9` (`Faction/FactionJoinCondition.ts:134-143`,
  `Faction/FactionInfo.tsx:143`); Spenden ziehen Bargeld (`Faction/formulas/donation.ts:20-33`);
  BN8 setzt das Geld bei jedem Einbau auf 250 Mio (`Prestige.ts:158-160`).
- **Rechnung** (`boerse-bargeld.mjs`, Nachbau `boerse.js:151-308`, 6 Seeds, 16 h ab 250 Mio):
  Bargeldanteil am Vermoegen nach der Runde Median **0,03 %** (Historienphase) bzw. 0,01 %
  (4S-Phase); Bargeld >= 100 Mrd bei Vermoegen >= 100 Mrd: **0,0 %** der Runden vor 4S,
  20,8 % mit 4S (nur weil die Markttiefe voll ist).
- **Folge:** In BN8 kann bn4rep weder Augs kaufen noch spenden, bis der Markt zufaellig
  ueberlaeuft, und die Daedalus-Einladung haengt am Zufall. Der V1-Ausgang in BN8 braucht
  30 Augs, 100 Mrd bar, Red Pill 2,5 Mio Ruf = ~2,5 Bio Spende.
- **Fix-Richtung:** Ein Handschlag "Einbaurunde": bn4rep (oder ein Planer) legt eine
  Anfrage, boerse.js verkauft alles und meldet den Erloes, dann Kauf/Spende/Einbau; dazu
  eine Daedalus-Liquidation, sobald 30 Augs und Hacking 2500 stehen und das Vermoegen >=
  100 Mrd ist. Den toten Sprung-Haken streichen. Gilt gleich fuer BOERSE-1.
- **Ertrag:** ohne Fix steht BN8 (3 Laeufe) praktisch still bis zum Marktueberlauf;
  GERECHNET_UNGEEICHT (Bargeldanteil), die Stillstandszeit GESCHAETZT.
- **known_before:** C6 (`nodes/AUDIT-PERFEKT-2026-09-26.md:40`, `nodes/audit-2026-09-26/1-bitnode-regeln.md:17-23`)
  beschreibt die Kaltstartleiter, nicht den Bargeldweg - neue Fundstelle.

### BOERSE-3 [SUBOPTIMAL, P2, BN8] Handelsregel von boerse.js: nur Long, 25 % je Aktie, Rang nach Forecast - je Zyklus ~4,6 h langsamer bis 1 Bio

- **Bot:** `src/boerse.js:81-82` (Kauf >= 0,575, Verkauf < 0,5), `:91` (25 % je Aktie), `:241-244`
  (Sortierung nach `vorhersage`, nicht nach erwartetem Ertrag), kein `buyShort` obwohl in BN8
  frei (`NetscriptFunctions/StockMarket.ts:47`, von `tools/test-boerse.js:182` sogar
  festgestellt), `:307` `ns.sleep(6000)` statt `ns.stock.nextUpdate()`.
- **Spiel:** erwarteter Ertrag je Schritt (2f-1) x E[av], E[av] = mv/200 (`StockMarket.ts:264-279`);
  Shorts und Orders in BN8 frei (`:46-53`).
- **Rechnung** (`boerse-bn8.mjs`, 10 Seeds, Start 250 Mio, frischer Markt):

  | Regel | 4S gekauft | h bis 26 Mrd | 100 Mrd | 1 Bio | 2,5 Bio | 10 Bio |
  |---|---|---|---|---|---|---|
  | boerse.js wie gebaut | 20,9 h | 13,6 | 17,8 | 22,6 | 24,6 | 30,3 |
  | dto., 4S schon bei 26 Mrd VERMOEGEN | 13,6 h | 18,4 | 20,7 | 24,9 | 26,6 | 30,3 |
  | Historie L+S, 4S bei 26 Mrd, dann (2f-1)xmv L+S | 11,2 h | 13,8 | 15,7 | **17,9** | 19,1 | **21,4** |
  | Folgezyklus mit 4S: boerse.js-Regel | - | 7,3 | 9,3 | 13,7 | 15,4 | 20,0 |
  | Folgezyklus mit 4S: (2f-1)xmv L+S | - | 5,3 | 6,8 | **9,1** | 10,6 | **14,6** |

  Der spaete 4S-Kauf (F4) kostet nichts - die Historie verzinst bis dahin weiter. Was kostet,
  ist die Regel: erster Zyklus -4,7 h bis 1 Bio, -8,9 h bis 10 Bio; jeder Folgezyklus
  -4,6 h bis 1 Bio, -5,4 h bis 10 Bio. Mit der C6-Leiter (Start 39 Mio statt 250 Mio)
  zusaetzlich +8,0 h im ersten Zyklus (bot 30,6 h bis 1 Bio) und +3,3 h je Folgezyklus.
- **Ertrag:** ~4,6 h je BN8-Einbauzyklus; bei geschaetzt 3-4 Zyklen je Lauf und 3 Laeufen
  ~40-55 h Routenzeit. GERECHNET_UNGEEICHT (Zykluszahl GESCHAETZT).
- **known_before:** BAUSTELLEN 2534-2670 (Bauplan "Shorts und Limit-Orders frei",
  Positionsgroesse an `shareTxForMovement`) - im Bau vom 04.09. nicht umgesetzt; neu ist die
  Rechnung.

### BOERSE-4 [NICHT_GENUTZT, P2, BN8 (V2 mit BOERSE-1)] Kurssteuerung per grow(host, {stock:true}) fehlt - in BN8 der eigentliche Hebel

- **Bot:** kein `stock:` in `src/worker/*.js` (inventar-hack #15). `boerse.js` setzt die Richtung
  nicht, es raet sie.
- **Spiel:** `NetscriptFunctions.ts:301-303`, `PlayerInfluencing.ts:47-61` (+0,1 auf
  `otlkMagForecast`, p = `moneyGrown/moneyMax` je AUFRUF); `Stock.ts:235-239` (Zielabstand
  treibt otlkMag mit bis 0,95); fuer otlkMag <= 1 wandert er sogar um 1 je Schritt
  (`StockMarket.ts:307-316`). Ein voller Server liefert p = 0 (BAUSTELLEN 1718-1726) - es
  braucht Hack ohne Flag und Grow mit Flag. Hackgeld ist in BN8 0, Hack-EXP nicht.
- **Rechnung** (`boerse-push.mjs`, r = erfolgreiche +0,1-Schritte je Kursschritt auf bis zu 3
  gehaltene Aktien; Servers-zu-Aktie-Zuordnung und Batcher-Takt NICHT modelliert):
  mit 4S ab 250 Mio nach 6 h: r=0 **0,28 Bio**, r=0,5 20,8 Bio, r=1 48,7 Bio; ohne 4S:
  r=0 **3,8 Mrd**, r=0,5 169 Mrd, r=1 1,95 Bio.
- **Ertrag:** Groessenordnung x10-x500 auf das Vermoegen nach 6 h in BN8; GESCHAETZT.
- **known_before:** BAUSTELLEN 2564-2585 ("Der Bot muss den Forecast nicht schaetzen, er setzt
  ihn"), inventar-hack #15 ("nur BN8 relevant"). Neu: Groessenordnung gerechnet; mit BOERSE-1
  auch in V2 relevant, weil der Batcher dort ohnehin waechst.

### BOERSE-5 [TOT, P3] Drei Boersen-Altwerkzeuge ohne Aufrufer, eines mit falscher Zugangslogik

- **Bot:** `src/stocks.js` (208 Z., braucht 4S, ruft `sellShort` - wirft ausserhalb BN8,
  BAUSTELLEN 1732-1735), `src/stockaccess.js` (130 Z., kauft per DOM alle vier Posten fuer
  31,2 Mrd und behauptet `:12-13`, die spaeteren seien ohne die frueheren gesperrt),
  `src/probe2.js` (DOM-Diagnose). Kein Eintrag in `src/registry.json`, kein Live-Aufrufer.
- **Spiel:** `purchaseTixApi` und `purchase4SMarketDataTixApi` pruefen kein WSE-Konto
  (`NetscriptFunctions/StockMarket.ts:274-296,316-334`); fuer Skripte sind WSE (200 Mio) und
  4S-Anzeige (1 Mrd) verlorenes Geld. Ein Kauf per `ns.stock.purchaseTixApi()` kostet 2,5 GB
  RAM statt DOM-Klicks.
- **Ertrag:** keiner, Aufraeumen; verhindert, dass BOERSE-1 auf `stockaccess.js` aufsetzt
  (1,2 Mrd je Knoten zu viel). Nicht in INFRA-6 enthalten (dort homeram/bn4start/invest/wbgrow/kerne).

### BOERSE-6 [NICHT_GENUTZT, P3, BN8] Stop-Sell-Orders als Stillstandsschutz

- **Bot:** keine `placeOrder`-Aufrufe.
- **Spiel:** Orders werden vom Spiel selbst je Kursschritt abgearbeitet (`StockMarket.ts:293-305`),
  auch wenn kein Skript laeuft; in BN8 ohne SF8 frei (`NetscriptFunctions/StockMarket.ts:47,183`).
- **Rechnung** (`boerse-stall.mjs`, 40 Seeds, 4S-Haendler eingefroren): nach 1 h Stillstand
  10-%-Quantil x0,92, schlechtester x0,57; nach 8 h x0,69 / x0,27.
- **Ertrag:** Absicherung gegen die bekannte Bruecken-/Skriptsterblichkeit
  (`bitburner-bruecke-stirbt`), GERECHNET_UNGEEICHT. In V2 nicht verfuegbar - dort muss der
  Waechter den Haendler neu starten (restartPolicy `always` gibt es schon).

### BOERSE-7 [NICHT_GENUTZT, P3, BN15/alle mit Darkscape] promoteStock hebt die Volatilitaet gehaltener Aktien

- **Spiel:** `NetscriptFunctions/Darknet.ts:583-611` (Ladung = Threads x (500+cha)/500, Dauer
  8 s x 600/(600+cha)), `DarkNet/effects/effects.ts:218-229` (Mult bis 4, je Zyklus x0,4),
  Zugang BN15 oder Darkscape (`DarkNet/utils/darknetAuthUtils.ts:6-8`), Skript muss auf einem
  Darknet-Server laufen.
- **Ertrag:** erwarteter Log-Ertrag je Schritt waechst linear mit av, also bis x4 auf
  gehaltenen Aktien; wegen x0,4 je 7,5 min Dauerbetrieb noetig. GESCHAETZT, needs_calc.

---

## 4. Rechnungen und Eichung

### 4.1 Rechner

| Datei | Was | Eichung |
|---|---|---|
| `boerse-save.mjs` | Boersenzugang und Markt aus allen Spielstaenden | 200/200 Staende: `acc=----`, `init=false` - nie Zugang |
| `boerse-orig.mjs` | ORIGINAL `Stock.ts`, `StockMarketHelpers.ts`, `StockMarket.ts:223-327` per `stripTypeScriptTypes` ausfuehrbar | - |
| `boerse-sim.mjs` | Nachbau Markt + Konto + Strategien (boerse.js Zeile fuer Zeile, Rang (2f-1)xmv, Historie) | gegen Original und Unittests, siehe 4.2 |
| `boerse-eich.mjs` | Eichung | 104 bestanden, 0 abweichend |
| `boerse-szenarien.mjs` | Festkapital-Szenarien A-E | ueber sim |
| `boerse-v2.mjs` | V2 mit Hackeinkommen, TIX/4S-Zeitpunkt | H aus Spielstand (4,2 Mrd/h) |
| `boerse-bn8.mjs` | BN8: boerse.js gegen Korrekturen | ueber sim |
| `boerse-4skauf.mjs`, `boerse-bargeld.mjs` | 4S-Kaufzeitpunkt, Bargeldanteil von boerse.js | ueber sim |
| `boerse-push.mjs` | Groessenordnung grow-Steuerung | NICHT geeicht (Modell der Zuordnung fehlt) |
| `boerse-stall.mjs` | Depotverlauf bei stehendem Haendler | ueber sim |

### 4.2 Eichung (`node tools/audit/boerse-eich.mjs`)

```
(1) Unittest-Sollwerte und Kostenformeln: 101 gleich, 0 abweichend
(2) Seed 11 ohne Handel : erste Abweichung KEINE | max. rel. Kursdifferenz 0 | Probe ECP Original 14342.550361383834 Nachbau 14342.550361383834 | Zyklen 267
(2) Seed 12 mit Kursdruck-Paketen : erste Abweichung KEINE | max. rel. Kursdifferenz 0 | Probe ECP Original 10749.7276871148 Nachbau 10749.7276871148 | Zyklen 266
(2) Seed 13 mit Kursdruck-Paketen : erste Abweichung KEINE | max. rel. Kursdifferenz 0 | Probe ECP Original 22724.855756081095 Nachbau 22724.855756081095 | Zyklen 266
(3) mittlerer Log-Ertrag je Aktie und Tick: gemessen -5.6013e-6  Formel -4.3613e-6
GESAMT: 104 bestanden, 0 abweichend
```

(1) Sollwerte aus `reference/bitburner-src/test/jest/StockMarket.test.ts:41-51,164-376,532-735`
(getForecastIncreaseChance 12 Faelle, flipForecastForecast 7, influenceForecast*,
cycleForecast, Kursdruck je Paket, Kauf-/Verkaufs-/Short-Kosten), je gegen Original UND Nachbau.
(2) 20.000 Kursschritte (= 33 h, 266 Zyklen), alle 33 Aktien, Preis/otlkMag/Ziel/b/Zaehler
bitgleich, auch mit eingestreuten Kursdruck-Paketen. (3) nur Plausibilitaet (Marktmittel ~0).
**Was die Eichung NICHT abdeckt:** die Strategien selbst (sie sind Nachbau, keine
Spielmechanik), Bot-Takt gegen Kursschritt (Sim: genau 1 Runde je Schritt), Orders (Stub),
Darknet-Mult (=1). Fuer eine Eichung gegen das laufende Spiel siehe needs_calc BOERSE-1.

### 4.3 Festkapital (Szenario A, 6 Seeds, 4S, nur Long, frischer Markt)

```
opt-4S-L K=10B   1h: 25.56B   3h: 306.08B   6h: 2.06T   12h: 12.36T
opt-4S-L K=100B  1h: 278.90B  3h: 1.66T     6h: 6.36T   12h: 15.47T
boerse.js 4S K=10B   1h: 19.46B 3h: 65.63B  6h: 440.09B 12h: 6.73T
B) ohne 4S, K=10B: boerse.js-Historie 6h 124.70B, 12h 758.33B; hist w=40 e=0,1 6h 363.78B, 12h 2.66T
```

### 4.4 BN8 und Bargeld

```
boerse-4skauf (8 Seeds): Verzoegerung Kauf gegen 26-Mrd-Vermoegen Median 7.08 h, min 3.22, max 9.96
boerse-bargeld: 4S-Phase Bargeld/Vermoegen Median 0.01 %, Historienphase 0.03 %;
  Bargeld >= 100 Mrd bei Vermoegen >= 100 Mrd: 4S 20.8 %, Historie 0.0 % der Runden
Szenario E (ohne 4S, 250 Mio): boerse.js bis 26 Mrd 12.3 h [11.8-16.0]; Historie L+S w=40 8.2 h [7.1-12.0]
```

### 4.5 Uhr, Stillstand, Bestand

- **Welche Uhr:** Kursschritte laufen auf Spielzyklen, aber mit Wanduhr-Sperre 4 s
  (`StockMarket.ts:245-252`); der Spielmotor laeuft auf `window.setTimeout` (`engine.tsx:437`).
  Ein gedrosselter Tab bremst Markt und Bot gleich; gespeicherte Zyklen holt der Markt mit
  1,5-facher Rate nach (4 s statt 6 s). Hackeinkommen H laeuft in Spielzeit - im Nachbau
  gleichgesetzt.
- **Stillstand:** siehe BOERSE-6 (Depot treibt; Median steigt, Schwanz bis x0,27 in 8 h).
- **Rate oder Bestand:** Boersenertrag ist Zinseszins auf den Bestand, keine Rate. Eine
  "$/h aus der Boerse" in einer Telemetrie waere nur fuer ein festes Depot aussagekraeftig;
  nach jedem Einbau beginnt der Bestand bei (fast) null.

---

## 5. Offene Punkte aus dem letzten Audit

- **E3 (Boerse in V1 ungenutzt, Trockenmodus zuerst):** neu bewertet -> BOERSE-1. V1 betrifft
  auf der Restroute nur noch BN8; der Hebel liegt in den 23 V2-Laeufen. Trockenmodus bleibt der
  richtige erste Schritt, braucht aber den TIX-Kauf (5 Mrd), weil schon `getPrice` TIX
  verlangt (`NetscriptFunctions/StockMarket.ts:65-71`).
- **C6 (BN8 ungeschuetzt):** bleibt offen und waechst: zur Kaltstartleiter (1-bitnode-regeln.md#2,
  INFRA-5; gerechnet: +8 h im ersten Zyklus, +3,3 h je Folgezyklus) kommen BOERSE-2 (kein
  Bargeldweg), BOERSE-3 (Regel) und BOERSE-4 (keine Steuerung). `src/ausgang.js:396-397`
  laesst den Sprung nach BN8 zu, sobald `boerse.js` auf home liegt - das tut es seit 04.09.
  Die Route faehrt also in einen Knoten, dessen Gewerk dort stehen wuerde.

## 6. Nicht als Befund (geprueft)

- 4S-Anzeige und WSE nicht zu kaufen ist richtig (`src/boerse.js:50`).
- `schaetzung()` (`src/boerse.js:342-355`) ist erwartungstreu; Fenster 40 liegt nahe am
  besten getesteten (w=20/40/75, Szenario B).
- Firmenarbeit als Kurshebel (F18): 0,001 x Leistung mit p=0,002 je Zyklus - vernachlaessigbar.
- Hack ohne `{stock:true}` beeinflusst keine Kurse (`NetscriptHelpers.tsx:668-670`) - der
  heutige Batcher schadet einem Depot also nicht.

## 7. Offene Rechnungen (needs_calc)

- **BOERSE-1 Eichung am echten Markt:** in BN2 TIX kaufen (5 Mrd), 2 h nur lesen
  (`getPrice` je `nextUpdate`, 1.200 Schritte x 33 Aktien) und Papierhandel mit der Regel
  "Historie w=40, e=0,1, Long". Soll/Ist: Anteil Aufwaertsschritte je Aktie gegen
  `boerse-sim.mjs` (Erwartung ~0,497 Marktmittel, ECP/MGCP ~0,6-0,69 in bullishen Phasen),
  Papiervermoegen nach 2 h gegen den Median aus `boerse-v2.mjs` (Startkapital gleich).
  Danach Rang: Geldverlauf aus `boerse-v2.mjs` in das AUG-1-Rangmodell
  (`Bladeburner/Actions/Action.ts:105-122,169-196`, geeicht gegen BN9.3/BN2.1) einspeisen.
- **BOERSE-4 Steuerung:** Zuordnung Server -> Aktie aus `Server/data/servers.ts`
  (`organizationName` = Schluessel in `StockMarket`), erreichbare Hackstufe je Knoten,
  grow-Aufrufe je Kursschritt aus dem Batcher-Takt (`src/bn4net.js`), p = Hackanteil;
  dann `boerse-push.mjs` mit diesem r je Aktie statt pauschal.
- **BOERSE-7 promoteStock:** Ladung je Thread und Zeit aus `Darknet.ts:583-611`, Zerfall x0,4
  je 75 Schritte, Mult aus `effects.ts:218-222` in `boerse-sim.mjs` (`vol = mv x mult`) -
  Mehrertrag gegen RAM auf Darknet-Servern.
