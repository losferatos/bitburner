# Audit 03.10.2026 - Bereich CORP: Corporation

Stand 2026-10-03 11:09 (Systemzeit). Pruefer CORP. Nichts an `src/` geaendert,
Spiel nicht angefasst, keine git-Operation. Eigene Dateien:

- `tools/audit/corp-formeln.mjs` - Corp-Formeln 1:1 aus dem Quellcode (Kosten,
  Bewertung, Kurs, Anteilsverkauf, Dividende, Investorenangebot, Platzgrenze der
  Produktion). `--eich` vergleicht gegen die Sollwerte der spieleigenen Testsuite.
- `tools/audit/corp-cashout.mjs` - Monte Carlo (feste Saat) des START-Zyklus einer
  Corp ohne Geschaeft: Gruendung, Boersengang, Kursanstieg, Verkauf.
- `tools/audit/corp-agri.mjs` - Erwartungswert-Modell Agriculture in BN3 (UNGEEICHT).
- `tools/audit/corp-v2geld.mjs` + `corp-save.mjs` - Geldfluss der V2-Laeufe aus den
  Spielstaenden (gemessen) und Hochrechnung fuer BN3 ohne Corp.

Grundlage: `LIVE_..._BN2L1_2026-10-03T09-59_pre-hotswap` (BN2.1, 5,29 h) sowie die
V2-Staende BN4.3 (pre-install 14.09.), BN9.2/BN9.3 (pre-jump), BN10.3 (pre-install).

## Kurzfassung

1. **Der Bot hat null Corp-Code** (verifiziert: `grep -ri corporation src/*.js
   src/lib/*.js` = 0 Treffer; nur `src/lib/bitnodes.json` fuehrt die drei
   BN-Multiplikatoren, niemand liest sie). In BN2 ist das richtig (kein SF3,
   `PlayerObjectCorporationMethods.ts:8-10`). **BN3.1-3.3 sind die naechsten drei
   Laeufe der Route - und BN3 ist der Knoten, in dem die Corp gratis ist.**
2. **NICHT GENUTZT, P1, Aufwand S - "Seed-Auszahlung":** In BN3 kostet die Gruendung
   mit Seed-Kapital nichts (`helpers.ts:76-78`, `Actions.ts:64-66`), die Corp hat
   150 Mrd in der Kasse (`Corporation.ts:41`), der Spieler haelt 1 Mrd von 1,5 Mrd
   Anteilen (`PlayerObjectCorporationMethods.ts:26-29`). Boersengang mit 0 neuen
   Anteilen, dann Verkauf fast aller eigenen Anteile: **104,4 Mrd $ an den Spieler
   nach ~32 min** (97,4 Mrd schon nach 3,3 min), gerechnet mit dem nachgebauten
   START-Zyklus, analytisch gegengeprueft (104,3 Mrd). Drei bis vier ns-Aufrufe,
   61,6-71,6 GB. Das ist **1,6x das hochgerechnete Hackeinkommen eines ganzen
   52-h-BN3-Laufs** (65,6 Mrd, obere Schranke). Die Anteile ueberleben jeden
   Einbau - die Summe ist eine Reserve, die man vor jedem Augmentierungskauf
   abrufen kann.
3. **NICHT GENUTZT, P2, Aufwand L - Agriculture + Investorenrunde 1 + Boersengang:**
   Modell (ungeeicht, aus dem Seed finanziert): Gewinn 2,7-4,1 Mio $/s, Auszahlung
   an den Spieler **~434 Mrd nach 3 h**, ~700 Mrd nach 24 h, ~1,0 Bio nach 48 h -
   also +330 Mrd gegen die reine Seed-Auszahlung. Braucht ~20 Corp-Funktionen
   (~370 GB als ein Skript, aufteilbar).
4. **Produktphase (Tobacco o. ae.) nicht gerechnet** - das ist der eigentliche
   Geldmotor der Corp; P3 / XL, braucht eine eigene Simulation.
5. **"SF3 ueberall" bringt der Route nichts.** Ausserhalb BN3 kostet die Gruendung
   150 Mrd vom Spieler, und alle Restknoten druecken die Bewertung (BN11 0,1,
   BN6/7/15 0,2, BN14 0,4, BN13 0,001; BN8 Corp gesperrt). Seed-Auszahlung dort:
   **-80 bis -150 Mrd netto**. Dividenden sind ueberall wertlos (x^0,85 in BN3 = 2-5 %
   des Gewinns, x^0,75 = unter 1 %, x^0,25 in BN13/15 = 0). Ein Corp-Gewerk gehoert
   auf BN3 begrenzt.
6. Nebenbei bestaetigt: die volle Corp-API kostet **960 GB** (38 Aktionen x 20 GB +
   20 Info x 10 GB + 5 freie; `RamCostGenerator.ts:13-14,475-542`) - der in
   `AUDIT-ROADMAP-2026-08-24.md` Abschnitt 3 Nr. 7 als "nicht nachgezaehlt"
   gefuehrte Wert stimmt.

Fruehere Bewertung: `AUDIT-ROADMAP-2026-08-24.md:89` sagt fuer den Block BN2/BN3
"Corporation bleibt draussen (Startkapital $150 Mrd ausserhalb BN3; API 10/20 GB je
Aufruf)". Die Begruendung trifft BN2 und alle Knoten mit SF3 - **aber nicht BN3
selbst**: dort gibt es Seed-Kapital und die Warehouse-/Office-API gratis
(`PlayerObjectCorporationMethods.ts:21-24`). Steht nicht in "ENTSCHIEDEN"
(`BAUSTELLEN.md:8-45`); neue Fundstellen und Rechnung siehe unten.

---

## 1. Feature-Inventar (aus dem Quellcode, ohne Blick auf den Bot)

Pfade relativ zu `reference/bitburner-src/src/`. "BN3" heisst: ohne SF3 nur dort
(`canAccessBitNodeFeature(3)` = `bitNodeN === 3 || SF3 > 0`, `BitNode/BitNodeUtils.ts:17-19`).

| # | Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag/Hebel |
|---|---|---|---|---|
| F1 | Gruendung mit Seed-Kapital | `Corporation/helpers.ts:66-88`, `Corporation/Actions.ts:34-68`, `PersonObjects/Player/PlayerObjectCorporationMethods.ts:12-30` | nur BN3 (Seed ausserhalb BN3: `helpers.ts:76-78` -> Fehler, `Actions.ts:44-46` wirft) | 150 Mrd Corp-Kasse gratis; Investoren +500 Mio Anteile |
| F2 | Gruendung selbstfinanziert | `helpers.ts:83-88` (150 Mrd), `Actions.ts:54-63` | BN3 und jeder Knoten mit SF3; BN8 gesperrt (`helpers.ts:79-81`, Softcap 0 < 0,15) | 150 Mrd Spieler -> Corp-Kasse; Spieler 100 % Anteile |
| F3 | Neugruendung (restart, 50 Mrd) | `helpers.ts:83-88` | nur UI (`createCorporation(...,false)` in `NetscriptFunctions/Corporation.ts:617-625`) | keiner fuer den Bot |
| F4 | Warehouse-/Office-API frei | `PlayerObjectCorporationMethods.ts:21-24`; sonst Unlock je 50 Mrd `data/CorporationUnlocks.ts:66-74` | gratis in BN3 und mit SF3.3 | ohne sie keine Produktion per Skript |
| F5 | Divisionen (14 Industrien) | `Actions.ts:70-97`, `data/IndustryData.ts` (Agriculture 40 Mrd, Tobacco 20 Mrd ...), Limit `Corporation.ts:38` | BN3 (Divisions 1); Restknoten 0,4-0,9 | Grundlage jedes Gewinns |
| F6 | Staedte/Bueros | `Actions.ts:122-135` (4 Mrd) | wie F5 | Produktion je Buero; Bewertung x1,008 je Buero/Lager (`Corporation.ts:211,219`) |
| F7 | Lager kaufen/ausbauen | `Actions.ts:406-431` (5 Mrd; 1e9*1,07^(L+1)), Groesse `Warehouse.ts:76` | wie F5 | Platz fuer Boost-Materialien |
| F8 | Angestellte + Jobs | `OfficeSpace.ts:137-172` (Produktivitaet), `Division.ts:968-993` (Produktion), NS `setJobAssignment` | wie F5 | Produktion ~ (ops^0,4 + eng^0,3) * Mgmt-Faktor |
| F9 | Buerogroesse | `helpers.ts:107-114` | wie F5 | mehr Koepfe, unterlinear |
| F10 | Tee/Party (Energie/Moral) | `Actions.ts:384-404`, `OfficeSpace.ts:80-110` | wie F5 | haelt prodBase = Moral*Energie/1e4 bei 1; ab 9 Koepfen ohne Praktikanten faellt sie (perfMult 0,998) |
| F11 | Boost-Materialien (Immobilien, Hardware, Roboter, KI-Kerne) | `Division.ts:123-137` | wie F5 | Produktions-Mult = Summe ueber ALLE Lager von Stadtmult^0,73 - wirkt auf jedes Buero |
| F12 | Materialhandel (buyMaterial, bulkPurchase, sellMaterial MAX/MP) | `Actions.ts:270-346`, Verkauf `Division.ts:259-462` | wie F5 | Umsatz; Verkaufsdeckel = Qualitaet*Markt*Business*Werbung |
| F13 | Smart Supply (25 Mrd) | `Division.ts:471-552`, `data/CorporationUnlocks.ts:22-29` | wie F5 | Einkauf automatisch, aequivalent zu buyMaterial je Zyklus |
| F14 | Export zwischen Divisionen (20 Mrd) | `Division.ts:705-783`, `Actions.ts:524-578` | wie F5 | Vorprodukte intern (Agriculture -> Tobacco) |
| F15 | Produkte | `Actions.ts:440-480`, `Product.ts:105-218`, `Division.ts:797-930` | wie F5 | Preis = Herstellkosten*5 + Aufschlag aus Rating/Markup - der grosse Hebel |
| F16 | Forschung (RP, research) | RP-Zuwachs `Division.ts:456-462` (4x je Marktzyklus), Baum `ResearchMap.ts` | wie F5 | Produktions-/Lager-/Verkaufs-Mults, Automatik |
| F17 | Market-TA.I/II | `Division.ts:354-380`, NS `:420-460` | wie F5 (Forschung 20k/50k RP) | optimaler Verkaufspreis |
| F18 | Werbung (AdVert) | `Division.ts:952-966`, Faktor `:1001-1016` | wie F5 | ohne Werbung Verkaufsdeckel x0,02 (`ratioFac` 0,01) |
| F19 | Levelbare Upgrades (9) | `data/CorporationUpgrades.ts`, `Corporation.ts:407-438` | wie F5 | Smart Factories +3 %, Smart Storage +10 % ... |
| F20 | Market Research/Data (je 5 Mrd) | `data/CorporationUnlocks.ts:32-47`, NS `getMaterial` | wie F5 | nur Anzeige von demand/competition |
| F21 | Shady Accounting / Government Partnership | `Corporation.ts:375-400` (Tribut -0,05/-0,1), Preise 500 Bio / 2 Brd | wie F5 | Dividende weniger besteuert |
| F22 | Investorenrunden 1-4 | `Corporation.ts:333-352`, `Actions.ts:191-209`, `data/Constants.ts` (10/35/25/20 % x 3/2/2/1,5) | wie F5; nur privat | Corp-Kasse (nicht Spieler) |
| F23 | Bewertung privat/oeffentlich | `Corporation.ts:198-235` | x CorporationValuation | bestimmt F22 und F25 |
| F24 | Boersengang | `Actions.ts:145-160` | wie F5 | Voraussetzung fuer F25/F28; beendet F22 |
| F25 | Anteile verkaufen | `Actions.ts:348-361` (`Player.gainMoney`), `Corporation.ts:285-322`; Sperre 1 h `data/Constants.ts` (18e3 Zyklen) | wie F5 | **einziger ergiebiger Weg zu Spielergeld** |
| F26 | Anteile zurueckkaufen | `Actions.ts:363-375` (1,1x Kurs) | wie F5 | keine Arbitrage |
| F27 | Neue Anteile ausgeben | `Actions.ts:162-189` (max 20 %, Sperre 4 h x total/1e9) | wie F5 | nur Corp-Kasse |
| F28 | Dividenden | `Corporation.ts:160-170, 189-196`, `Actions.ts:137-143` | Tribut = 1 - Softcap + 0,15 (`Corporation.ts:54`) | Spieler bekommt x^(1-Tribut) |
| F29 | Bestechung | `Actions.ts:612-654` (Bewertung >= 1e14, 1 Ruf je 1 Mrd, nur Faktionen mit Arbeit) | wie F5 | Ruf; Bladeburners nicht bestechbar (`Faction/FactionInfo.tsx:698-710`) |
| F30 | Division verkaufen | `Actions.ts:99-120`, `Division.ts:139-148` | wie F5 | halbe Anschaffung zurueck |
| F31 | Produktionslimits | `Actions.ts:580-594` | wie F5 | Steuerung, kein Ertrag |
| F32 | Takt (nextUpdate) / Bonuszeit | `Corporation.ts:109-187`, `engine.tsx:111-113, 330`, NS `getBonusTime`/`nextUpdate` | wie F5 | Zustandstakt 2 s; Offline-Zeit wird mit 10x nachgeholt |
| F33 | Corp ueberlebt Augmentierungs-Einbau | `PlayerObjectGeneralMethods.ts:80-140` (kein Reset), Reset nur `:159,169` (prestigeSourceFile) | alle | Anteile = Reserve ueber Einbauten |
| F34 | Hash: Sell for Corporation Funds | `Hacknet/data/HashUpgradesMetadata.tsx:24-38`, `HacknetHelpers.tsx:474-481` | mit Corp | 1 Mrd Corp-Kasse je 100*(L+1) Hashes |
| F35 | Hash: Exchange for Corporation Research | `HashUpgradesMetadata.tsx:81-89`, `HacknetHelpers.tsx:529-537` | mit Corp | 1000 RP je Division |
| F36 | SF3-Bonus | `SourceFile/applySourceFile.ts:62-72` | nach BN3.1 ueberall | Charisma und work_money +8/12/14 % |
| F37 | BN-Multiplikatoren Corp* | `BitNode/BitNodeMultipliers.ts:43-49`, `BitNode/BitNode.tsx:563ff` | BN3 alle 1; BN2 Soft 0,9; BN6/7 Val 0,2; BN11 0,1; BN13 0,001/0,4; BN14 0,4; BN15 0,2/0,4; BN8 0/0 | siehe Abschnitt 5 |
| F38 | Info-/Konstantenfunktionen | NS `getConstants` (0 GB), `getIndustryData`, `getMaterialData`, `get*Cost` | wie F5 | Planung |

### ns.corporation (63 Funktionen, `Netscript/RamCostGenerator.ts:475-542`)

- 0 GB: `hasCorporation`, `canCreateCorporation`, `getConstants`, `getBonusTime`, `nextUpdate`.
- 10 GB (20 Info): `hasUnlock`, `getUnlockCost`, `getUpgradeLevel`, `getUpgradeLevelCost`,
  `getInvestmentOffer`, `getIndustryData`, `getMaterialData`, `getCorporation`, `getDivision`,
  `getWarehouse`, `getProduct`, `getMaterial`, `getUpgradeWarehouseCost`, `hasWarehouse`,
  `getOffice`, `getHireAdVertCost`, `getHireAdVertCount`, `getResearchCost`, `hasResearched`,
  `getOfficeSizeUpgradeCost`.
- 20 GB (38 Aktionen): `createCorporation`, `acceptInvestmentOffer`, `goPublic`, `bribe`,
  `expandIndustry`, `expandCity`, `purchaseUnlock`, `levelUpgrade`, `issueDividends`,
  `issueNewShares`, `buyBackShares`, `sellShares`, `sellDivision`, `sellMaterial`, `sellProduct`,
  `discontinueProduct`, `setSmartSupply`, `setSmartSupplyOption`, `buyMaterial`, `bulkPurchase`,
  `setMaterialMarketTA1/2`, `setProductMarketTA1/2`, `exportMaterial`, `cancelExportMaterial`,
  `purchaseWarehouse`, `upgradeWarehouse`, `makeProduct`, `limitMaterialProduction`,
  `limitProductProduction`, `hireEmployee`, `upgradeOfficeSize`, `throwParty`, `buyTea`,
  `hireAdVert`, `research`, `setJobAssignment`.
- Summe aller: 38*20 + 20*10 = **960 GB** (+1,6 Basis). SF4 senkt davon nichts.
- Bot-Nutzung: **keine einzige**.

## 2. Abdeckungsmatrix

| # | Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil |
|---|---|---|---|---|---|
| F1 | Seed-Gruendung | fehlt | - | NICHT GENUTZT | BN3 Kaltstart: 150 Mrd gratis -> Befund CORP-1 |
| F2 | selbstfinanziert | fehlt | - | NICHT ANWENDBAR | auf allen Restknoten netto -80 bis -150 Mrd (Abschnitt 5) |
| F3 | Neugruendung | fehlt | - | NICHT ANWENDBAR | NS kann nicht neu gruenden |
| F4 | API-Freischaltung | fehlt | - | NICHT ANWENDBAR | in BN3 automatisch |
| F5-F13 | Divisionen, Bueros, Lager, Angestellte, Groesse, Tee/Party, Boosts, Handel, Smart Supply | fehlt | - | NICHT GENUTZT | Agriculture-Geschaeft -> CORP-2 |
| F14-F17 | Export, Produkte, Forschung, Market-TA | fehlt | - | NICHT GENUTZT | Produktphase -> CORP-3 (nicht gerechnet) |
| F18, F19 | Werbung, Upgrades | fehlt | - | NICHT GENUTZT | Teil von CORP-2 |
| F20 | Market Research/Data | fehlt | - | NICHT ANWENDBAR | reine Anzeige |
| F21 | Shady/Government | fehlt | - | NICHT ANWENDBAR | 500 Bio / 2 Brd; Modell erreicht 1,6 Bio Bewertung in 48 h |
| F22 | Investorenrunden | fehlt | - | NICHT GENUTZT | Teil von CORP-2 (Runde 1 = 281 Mrd Corp-Kasse im Modell) |
| F23 | Bewertung | fehlt | - | NICHT ANWENDBAR | Mechanik, keine Aktion; Fallen siehe CORP-4 |
| F24, F25 | Boersengang, Anteilsverkauf | fehlt | - | NICHT GENUTZT | Kern von CORP-1 |
| F26, F27 | Rueckkauf, neue Anteile | fehlt | - | NICHT ANWENDBAR | 1,1x Rueckkaufpreis; neue Anteile senken den Wert der Spieleranteile leicht |
| F28 | Dividenden | fehlt | - | NICHT ANWENDBAR | BN3 2,2-5,5 % des Gewinns, Restknoten < 1 % bzw. 0 (gerechnet) |
| F29 | Bestechung | fehlt | - | NICHT ANWENDBAR | Schwelle 1e14 Bewertung; Bladeburners nicht bestechbar |
| F30, F31 | Division verkaufen, Limits | fehlt | - | NICHT ANWENDBAR | kein Ertrag |
| F32 | Takt/Bonuszeit | fehlt | - | NICHT GENUTZT | Taktgeber eines CORP-2-Gewerks |
| F33 | Corp ueberlebt Einbau | fehlt | - | NICHT ANWENDBAR | Mechanik; macht CORP-1 zur Reserve |
| F34, F35 | Hash -> Corp | `src/hashes.js:95-96` kennt nur Verkauf und Rang | V2 | NICHT ANWENDBAR | nach der Seed-Auszahlung ist Corp-Kasse fuer den Spieler 0 wert; Forschung nur in Produktphase (deckt sich mit `inventar-hash.md` H2/H7) |
| F36 | SF3-Bonus | - (passiv) | nach BN3.1 | NICHT ANWENDBAR | wirkt ohne Bot; fuer V2 bedeutungslos |
| F37 | BN-Multiplikatoren | `src/lib/bitnodes.json:17-19` (erzeugt, ungelesen) | - | NICHT ANWENDBAR | Werte stimmen mit `BitNode.tsx` |
| F38 | Info-Funktionen | fehlt | - | NICHT ANWENDBAR | nur mit Gewerk |

Zaehlung: 38 Features; NICHT GENUTZT 20 (F1, F5-F19, F22, F24, F25, F32), NICHT
ANWENDBAR 18, OPTIMAL 0, SUBOPTIMAL 0, TOT 0.

## 3. Befunde

### CORP-1 - NICHT GENUTZT - BN3 Seed-Auszahlung (P1, Aufwand S)

- **Bot:** fehlt (kein `ns.corporation` in `src/`).
- **Spiel:** Seed nur in BN3 und gratis (`Corporation/helpers.ts:76-78`, `Actions.ts:64-66`),
  Kasse 150 Mrd (`Corporation.ts:41`), Seed-Anteile (`PlayerObjectCorporationMethods.ts:26-29`),
  Bewertung oeffentlich = funds + 85e3*assetDelta (`Corporation.ts:198-224`, oeffentlich `:209`, privat `:214`),
  Zielkurs `(0,5 + sqrt(Anteil)) * Bewertung / Anteile` (`:251-262`),
  Boersengang setzt den Kurs auf den Zielkurs der GEMITTELTEN Bewertung (`Actions.ts:145-160`),
  Verkauf: Kurs folgt dem Zielkurs in 0,5-%-Schritten je 1 Mio Anteile (`Corporation.ts:285-322`),
  Erloes direkt an den Spieler (`Actions.ts:359`), kein Tribut.
- **Ablauf:** `createCorporation(name, false)` -> 10 Marktzyklen warten (100 s, Bewertungsliste
  voll mit privat 60 Mrd) -> `goPublic(0)` -> 10 weitere Zyklen -> sofort verkaufen (97,4 Mrd)
  oder ~30 min warten, bis der Kurs (+0,5 %/Zyklus, `:264-274`) den Zielkurs erreicht (104,4 Mrd).
  `sellShares(999e6)` (alle verkaufen ist verboten, `helpers.ts:131`).
- **Rechnung** (`corp-cashout.mjs`, 400 Laeufe, Saat fest):

      BN3, Seed (gratis)             Verkauf nach 32.0 min (p05 30.0 / p95 34.0)  netto 104.4 Mrd
      BN3, Seed, Verkauf ohne Warten Verkauf nach  3.3 min                         netto  97.4 Mrd
      BN3, Seed, IPO sofort (FALLE)  Verkauf nach 316.8 min                        netto 104.4 Mrd
      Gegenprobe analytisch (Integral des Zielkurses): 104.3 Mrd

- **Gegen die beste Alternative** (`corp-v2geld.mjs`): BN3 hat den zweitschlechtesten
  Kaufkraft-Index der Route, (ServerMaxMoney*ScriptHackMoney)/AugmentationMoneyCost =
  0,0027 (BN2 0,08, BN4 0,0225, nur BN9 0,001 ist schlechter, und BN9 hatte Hacknet als
  Geldquelle). Hochgerechnet aus BN4.3 (gemessen 184,5 Mrd Hack in 51,7 h, gleiches
  ScriptHackMoney 0,2): **BN3 ~65,6 Mrd je 52 h, obere Schranke** (ServerGrowthRate 0,2
  nicht eingerechnet), bei Augs x3 nur ~21,9 Mrd BN4-Kaufkraft gegen 149 Mrd
  Augs-Ausgabe in BN4.3. Gegenprobe BN2.1: 4,6 Mrd/h x 0,1 = 0,5 Mrd/h. Die
  Seed-Auszahlung bringt das 1,6-fache eines ganzen Laufs - in Minute 32.
- **Warum Geld im V2-Lauf zaehlt (gemessen):** Augs-Ausgabe / Einnahmen = 71 % (BN4.3),
  73 % (BN10.3), 41-53 % (BN9.2/9.3 mit Hacknet); bei jedem pre-install-Stand lag
  das Konto nahe 0 (BN4.3 0,13 Mrd, BN10.3 0,51 Mrd). Kampf-Mults am Laufende: BN4.3
  2,25-2,98 bei 149 Mrd Augs, BN9.3 1,57-2,28 bei 69 Mrd, BN2.1 heute 1,43 (nur SF).
  Rangrate ~ Kampfwert^0,92 im Bereich p<1 (`tools/bbrank/hebel.mjs` Teil C: x2 -> 1,90).
- **Ertrag:** +104,4 Mrd $ je BN3-Lauf, x3 = 313 Mrd ($ GERECHNET_UNGEEICHT: Formeln
  exakt nachgebaut, Kostenteil gegen Jest geeicht, aber kein Spielstand mit Corp).
  Zeit bis Knotenende: **GESCHAETZT 3-8 h je BN3-Lauf** (Kampf-Mult am Laufende grob
  1,3 statt 1,1 nach den zwei Messpunkten BN9.3/BN4.3, Rangrate +15-20 %) - die
  Stundenzahl ist nicht gerechnet, siehe offene Frage 1.
- **Einschraenkungen:** In BN3 ist auch der Ruf x3 (`BitNode.tsx` case 3
  AugmentationRepCost 3); ob Geld oder Ruf den Augs-Kauf begrenzt, ist fuer BN3 nicht
  gemessen. Spendenschwelle ist dort halbiert (FavorToDonateToFaction 0,5 -> 75),
  Spende = Geld/1e6 * faction_rep (`Faction/formulas/donation.ts:9`) - ab Favor 75
  wird das Geld zu Ruf.
- **Fix-Skizze:** kleines Einmal-Gewerk nur fuer `getResetInfo().currentNode === 3`:
  gruenden (selfFund **false**), nach >= 100 s `goPublic(0)`, Anteile halten; vor
  jedem Augmentierungskauf (bn4rep/kampfaugs) eine Tranche verkaufen, spaetestens
  vor dem Einbau den Rest. RAM 21,6 GB je Einzelskript oder 61,6 GB zusammen.

### CORP-2 - NICHT GENUTZT - BN3 Agriculture + Investorenrunde 1 + Boersengang (P2, Aufwand L)

- **Bot:** fehlt. **Spiel:** F5-F13, F18, F19, F22-F25 (Fundstellen Tabelle 1).
- **Modell** (`corp-agri.mjs`, Erwartungswerte, Formeln 1:1; Werte der Angestellten 75,
  Moral/Energie 100, Basis-Marktwerte, keine Forschung). Grundausbau 86 Mrd (Division
  40 + 5 Bueros + 5 Lager + 1 Werbung), dann gieriger Ausbau nach dP/$ mit der
  Bedingung `dP*(85e3 s + Restzeit) > Kosten`:

      A) Seed in Agriculture: Buero 6, Lagerstufe 3, SmartStorage 2, Boost 14,5 Mrd
         Produktion 82,2/s je Buero, M=29,9, Gewinn 2,67 Mio/s = 9,6 Mrd/h
         Bewertung privat 937 Mrd -> Runde 1 = 281 Mrd (fuer 100 Mio Anteile)
      B) Runde 1 nach 2 h, Gewinn stuendlich wieder angelegt, IPO + Verkauf nach T:
         T= 3 h: Gewinn 4,07 Mio/s, Auszahlung an den Spieler ~434 Mrd
         T=24 h: Gewinn 4,79 Mio/s, Auszahlung ~700 Mrd
         T=48 h: Gewinn 5,18 Mio/s, Auszahlung ~1,00 Bio

  Selbstpruefung der Zahlen: 6 Koepfe (3 ops/1 eng/1 bus/1 mgmt) -> 1,147/s je Buero x
  6*29,9^0,73 = 82,2/s; Verkaufsdeckel Plants 93,3/s, Food 85,3/s (knapp nicht bindend);
  Gewinn je Stadt 82,2*(3000+5000-2550) = 448 k$/s.
- **Ertrag:** +330 Mrd gegen CORP-1 nach 3 h, +600 Mrd nach 24 h je BN3-Lauf
  (GERECHNET_UNGEEICHT; Agriculture allein ist eher die Untergrenze dessen, was
  eine Corp kann, das Modell innerhalb Agriculture eher eine Obergrenze).
- **Kosten/Risiko:** ~20 Corp-Funktionen (~370 GB in einem Skript, als Phasen-Skripte
  aufteilbar), laeuft unbeaufsichtigt ueber Stunden -> Skeptiker-Pflicht; Fallen CORP-4.

### CORP-3 - NICHT GENUTZT - Produktphase (Tobacco o. ae.), Export, Forschung, Market-TA.II (P3, Aufwand XL)

- **Spiel:** Produkte `Product.ts:105-218` (Qualitaet aus Arbeitsanteilen, Markup
  `100/(advMult*(q+0,001)^0,65*busmgt)`), Verkauf `Division.ts:268-320` (marketPrice =
  Herstellkosten*5, markupLimit = effectiveRating/markup, `:318`), TA.II `:354-380`.
- Nicht gerechnet: Der Produktpreis skaliert ueber Rating und Werbung, nicht ueber
  Lagerplatz - die Obergrenze ist mit Agriculture nicht vergleichbar. Ohne eigene
  Simulation keine Zahl. needs_calc.

### CORP-4 - RISIKO - Fallen fuer jedes kuenftige Corp-Gewerk in BN3 (P2, Aufwand S)

Gilt, sobald CORP-1 oder CORP-2 gebaut wird; im Code belegt, (a) und (e) gerechnet.

- (a) **Boersengang vor dem ersten START-Zyklus:** `valuation` ist 0 (`valuationsList [0]`,
  `Corporation.ts:65-66`), also Kurs 0 -> geklemmt auf 0,01 (`:270-272`) und steigt nur
  ~0,5 %/Zyklus. Gerechnet: **Verkauf erst nach 317 min statt 32 min** (`corp-cashout.mjs`).
- (b) **`createCorporation` hat selfFund = true als Vorgabe** (`NetscriptFunctions/Corporation.ts:617`).
  In BN3 ohne 150 Mrd auf dem Konto liefert das stumm `false`; ausserhalb BN3 wirft
  Seed (`Actions.ts:44-46`).
- (c) **Investitionen in den 10 Zyklen vor Angebot oder Verkauf:** "langfristige"
  Ausgaben (office, warehouse, upgrades, product development, `data/FundsSource.ts:3-13`)
  erhoehen `totalAssets` um den Betrag (`Corporation.ts:82-95`); beim naechsten START wird
  daraus `previousTotalAssets` (`:234-248`) - assetDelta faellt nach Code-Lesung um 2X/10 s.
  Privat entfaellt der Wachstumsterm, oeffentlich faellt die Zyklusbewertung bis auf
  die 10-Mrd-Untergrenze; gemittelt wird ueber 10 Zyklen (`:226-235`). Nicht im Spiel gemessen.
- (d) **Spielergeld faellt beim Einbau auf 1.000 $** (`PlayerObjectGeneralMethods.ts:102`),
  die Corp und die Anteile nicht (F33). Verkaufen erst direkt vor dem Augmentierungskauf.
- (e) **Verkaufssperre 1 h** (`data/Constants.ts` sellSharesCooldown 18e3, `helpers.ts:134-135`);
  **Boersengang beendet die Investorenrunden** (`Corporation.ts:333-340`). CORP-1 und
  CORP-2 schliessen sich deshalb in derselben Corp teilweise aus: erst Runde 1, dann IPO.
- (f) **Takt:** Die Corp laeuft in Spielzyklen und holt Offline-Zeit 10-fach nach
  (`Corporation.ts:109-117`, `engine.tsx:330`). Ein Gewerk sollte auf `nextUpdate()`
  warten, nicht auf Wanduhr-Sleeps.

## 4. Rechnungen und Eichung

**`corp-formeln.mjs --eich`** - Soll = Testsuite des Spiels, Ist = Nachbau:

| Pruefung | Soll-Quelle | Werte | Ergebnis |
|---|---|---|---|
| `calculateUpgradeCost` (9 Upgrades x 15 Stufenpaare) | `test/jest/__snapshots__/Corporation.test.ts.snap` | 135 | 135/135 **exakt** (Zeichenkette gleich) |
| `calculateOfficeSizeUpgradeCost` | `test/jest/Corporation.test.ts:122-140` (z. B. 3->+3 = 4.360.000.000, 9->+150 = 4.222.227.371.834,145) | 9 | 9/9 innerhalb 0,05 |
| Produktions-Platzgrenze Agriculture (Wasser/Chemikalien/Pflanzen/Nahrung/Restplatz) | `test/jest/Corporation.test.ts:383-420` limitMaterialProduction 3/4 (Restplatz 67 bzw. 15) | 10 | 10/10 **exakt** |
| Anteilssumme Seed | `Corporation.test.ts:152-158` | 1 | OK |
| **Summe** | | **155** | **155 OK, 0 FEHLER** |

Nicht geeicht werden konnte (kein Spielstand mit Corporation, SF3 fehlt): Bewertung,
Kursverlauf, Anteilsverkauf, Investorenangebot, Dividende, Agriculture-Produktion im
Zeitverlauf. Gegenprobe statt Eichung: Monte Carlo und Integral des Zielkurses stimmen
fuer die Seed-Auszahlung auf 0,1 Mrd ueberein (104,4 / 104,3).

**`corp-v2geld.mjs`** (gemessen aus moneySourceB, Mrd $):

    Lauf                     h     Einnahmen  Hack    Hacknet  Sleeves  Augs   Augs/Einnahmen
    BN4.3 bis 17 Black Ops    51.7    208.8   184.5     0.0     14.1   149.0   71 %
    BN9.2 ganzer Lauf         81.7    422.9     0.6   357.1     55.7   173.2   41 %
    BN9.3 ganzer Lauf         53.6    129.2     0.4    93.9     27.8    68.9   53 %
    BN10.3 bis 19 Black Ops   91.8   1330.0  1245.5     0.0     79.0   969.0   73 %
    BN2.1 laufend              5.3     25.9    24.5     1.4     -0.0     2.5   10 %

**Dividende** (`cycleDividends`, Rate 100 %, Spieler 2/3): BN3 Gewinn 2,67e6/1e7/1e9 $/s
-> 5,45 / 4,47 / 2,24 % an den Spieler; BN6-artig (Softcap 0,9) 1,03 / 0,74 / 0,23 %;
BN13/15 (Softcap 0,4) praktisch 0.

## 5. Antworten auf die Leitfragen

- **BN3: lohnt der Bau?** Die Seed-Auszahlung (S) ja, ohne Zweifel: 104 Mrd fuer drei
  Aufrufe, gegen ~66 Mrd Hackeinkommen eines ganzen Laufs (obere Schranke). Agriculture
  (L) laut Modell +330-600 Mrd mehr je Lauf; ob die Stunden das tragen, haengt an der
  offenen Frage 1. Produktphase (XL) offen.
- **SF3 ueberall?** Nein. `corp-cashout.mjs` selbstfinanziert: BN6/7/15 -115 Mrd,
  BN11 -132,5 Mrd, BN13 -149,8 Mrd, BN14 -80 Mrd netto; BN8 gesperrt. Ein Geschaeft
  muesste dort erst 150 Mrd vom Spieler zurueckverdienen und kommt nur ueber
  Anteilsverkauf (x Valuation 0,001-0,4) zurueck - mit Agriculture-Massstab (Modell:
  434 Mrd nach 3 h bei Mult 1) bleibt in BN14 nach 3 h knapp +24 Mrd, in BN6/7/15
  ein Verlust. Hinweis fuer den Praemissen-Skeptiker: Mit Valuation 1 (BN1/BN2/BN3)
  waere selbst die reine Selbstfinanzierung +25 Mrd netto - BN2.2/2.3 liegen aber
  VOR SF3.
- **Welche Strategie ist automatisierbar?** Stufe 1 (CORP-1) trivial. Stufe 2
  (Agriculture, 6 Staedte, Boosts, Werbung, Runde 1, IPO) mit festen Regeln wie in
  `corp-agri.mjs` - keine Wahl unter Unsicherheit noetig ausser Kaufreihenfolge.
  Stufe 3 (Produkte) braucht Produktzyklen, TA.II-Forschung, Export - XL.
- **Ab wann zahlt sie sich aus?** CORP-1 ab Minute 3,3 (97 Mrd) bzw. 32 (104 Mrd),
  ohne Kosten. CORP-2 schlaegt CORP-1 im Modell ab ~2-3 h (Runde 1 bei 2 h,
  Auszahlung 434 Mrd bei 3 h).

## 6. Offene Fragen / nicht belegt

1. **Stunden je BN3-Lauf** aus zusaetzlichem Geld: braucht ein V2-Laufmodell
   (Rangrate aus `tools/bbrank/sim.mjs` x Kampf-Mult aus den je Einbauzyklus
   kaufbaren Augs unter BN3-Preisen x3/Ruf x3, Kostenkette x1,9), erst gegen BN4.3
   eichen (51,7 h, 149 Mrd Augs, Rang 209.728 bei 17 Black Ops), dann BN3 mit/ohne
   Corp rechnen.
2. Ob in BN3 Geld oder Ruf den Augs-Kauf begrenzt (Ruf x3, Spende ab Favor 75).
3. Agriculture-Modell gegen einen echten Corp-Stand eichen: im ersten BN3-Lauf nach
   dem Grundausbau `getDivision().lastCycleRevenue/Expenses` und `getCorporation().valuation`
   gegen `corp-agri.mjs` halten.
4. Der assetDelta-Doppelabzug bei langfristigen Ausgaben (CORP-4 c) ist Code-Lesung,
   nicht gemessen.
5. Praemisse V2 in BN3: Mit einer Produkt-Corp waere Geld fast unbegrenzt; ob V1 in
   BN3 (WorldDaemonDifficulty 2, Red Pill mit Ruf x3, Spende ab 75 Favor) dann
   schneller ist als V2, ist nicht gerechnet - Sache des Praemissen-Skeptikers.
