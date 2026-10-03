# Audit 03.10.2026 - Bereich HACK (Hacking-Maschine)

Pruefer HACK, Stand 03.10.2026 11:06 (Systemzeit). Datenbasis: Spielstaende
`backups/LIVE_197f4d61481686_BN2L1_2026-10-03T05-33 ... T09-59` (BN2.1, 0,85 bis
5,29 h im Knoten, Level 257 -> 372) plus zum Gegencheck BN12L1-L3. Spielquelle
`reference/bitburner-src/src` (3.0.2). Bot: `src/` auf master (0cc5a80), nur gelesen.

Nicht wiederholt (steht im Audit 26.09., Bericht `audit-2026-09-26/2-hacking-engine.md`
und Statusliste `AUDIT-PERFEKT-2026-09-26.md`): B1 Sicherheit-100-Ziele, B2 Ofen als
Dauerlaeufer, B5 Stapelziele nach Durchsatz, B6/H1 BN12-Tabelle und ServerWeakenRate,
B7 Nullfenster, C6 BN8-Schutz, E1 Hashes, E2 share-Deckel. Wo ich einen dieser Punkte
beruehre, steht es mit neuem Beleg und `known_before` dabei.

## 0. Rechner und Eichung

Alle Rechner liegen in `tools/audit/` und lesen nur. Die Formeln der Zielwahl sind die
des Bots (`src/lib/calc.js`), deren Treue zum Spiel im Spielstand selbst belegt ist:
`data/calccheck.txt` (BN2-Stand) vergleicht `hackChance`, `hackPercent`, `growThreads`
gegen `ns.formulas` - Abweichung 0,000 % auf zehn Zielen.

| Rechner | Was | Eichung Soll | Eichung Ist |
|---|---|---|---|
| `hack-save.mjs` | Spielstand dekodieren (Server, Prozesse, Textdateien) | - | - |
| `hack-verlauf.mjs` | share-Faeden, Arbeit, Einkommen je Stand | - | - |
| `hack-eich.mjs` | Level aus Exp (`skill.ts:7-15`, mult x 0,8) | 372 | 372 |
| `hack-eich.mjs` | home-Kern 1->2 (`PlayerObjectServerMethods.ts:42-44`) | moneySourceA.servers 08:33->09:19: 7,523 Mrd (davon 4 Parkschritte a 5,6 Mio) | 7,500 Mrd |
| `hack-eich.mjs` | Mietrechner-Ausbau BN2 (`ServerPurchases.ts:22-40`, Softcap 1,3) | Bot-Log "14.6m" / "5.6m" | 14,64 / 5,63 Mio |
| `hack-marge.mjs` | Stapelgroesse je Ziel (`calc.js:712-727`) | Telemetrie stapelGb 54 / 50 / 38 | 53,65 / 50,15 / 37,60 |
| `hack-park.mjs` | Gesamteinnahme aus Segmentmodell (targetMetrics/batchThroughput) | gemessen 1.734.000 $/s (moneySourceA.hacking 09:33->09:59, 1580 s Spielzeit) | Modell 2.654.523 $/s -> Realisierungsquote r = 0,653 (ein Parameter) |
| `hack-park.mjs` | Grenzeffizienz bei Ist-Belegung | Bot-Telemetrie `effFlotte` 227 $/GB*s | 224 $/GB*s (Modell x r) |
| `hack-park.mjs` | Amortisation Schritt 128->256 (Bot-Regel grenzErtrag) | Bot-Log 09:57:29 "amortisiert in 339 s" | 333 s |
| `hack-kerne.mjs` | grow/weaken-Faeden je Wirt x Kerne | (Messung am Stand) | - |
| `hack-prep.mjs` | prepSec/Rang je Geldziel (`targetMetrics`/`targetRank`) | the-hub unberuehrt im Stand (Sicherheit 44 = Start, Fuellung 0,20) | prepSec 1653 s > prepMaxSec 1200 -> Rang 0 |
| `hack-fleiter.mjs` | $/GB je Stapel ueber F_LEITER | - | f=0,05 2,5-6 % besser als f=0,02 (klein, kein Befund) |
| `hack-knoten.mjs` | Hackertrag je Restroutenknoten, gleicher Spieler | - | BN2 1,00 / BN3 0,17 / BN11 0,05 / BN6 1,60 / BN7 1,51 / BN13 0,82 / BN14 1,47 / BN15 4,00 / BN8 0 |

Grenzen: r ist EIN Faktor fuer Stapel und offene Mischung zusammen (das Audit 26.09.
fand fuer die offene Mischung allein ~0,53). Die Szenarien unten setzen voraus, dass
zusaetzlicher Speicher im Schnitt so realisiert wie der vorhandene. Das ist die
Hauptunsicherheit aller $-Zahlen; die Richtung ist in jedem Befund unabhaengig davon.

## 1. Feature-Inventar (aus dem Spielquellcode)

Restroute: BN2.1-2.3, 3, 11, 6.2-6.3, 7, 14, 13, 15 (alle V2), BN8 (V1).
Multiplikatoren aus `BitNode/BitNode.tsx` (BN2 :569-591, BN3 :593-625, BN6 :688-720,
BN7 :722-762, BN8 :764-793, BN11 :883-916, BN13 :991-1038, BN14 :1040-1083,
BN15 :1085-1117); `src/lib/bitnodes.json` stimmt fuer diese Knoten (geprueft).

| # | Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag/Hebel |
|---|---|---|---|---|
| 1 | hack: Beuteanteil `percentMoneyHacked` | `Hacking.ts:44-57` | alle; ScriptHackMoney BN3 0,2 / BN6 0,75 / BN7 0,5 / BN13 0,2 / BN14 0,3 / BN8 0,3 | $ je Faden linear |
| 2 | hack: Erfolgschance | `Hacking.ts:9-24` | alle | Fehlschlag: kein Geld, 1/4 Exp |
| 3 | hack: Gutschrift `ScriptHackMoneyGain` | `Netscript/NetscriptHelpers.tsx:645-648` | BN8 = 0 | BN8: Hacken bringt 0 $ |
| 4 | hack: Sicherheit +0,002 x min(Faeden, ceil(1/p)), nur bei Erfolg | `NetscriptHelpers.tsx:621-667` | alle | Stapelplanung |
| 5 | Exp je Faden 3+0,3*baseDifficulty (x hacking_exp x HackExpGain); leer gehackt/Fehlschlag 1/4 | `Hacking.ts:30-38`, `NetscriptHelpers.tsx:617-641` | alle; baseDifficulty = Startsicherheit x ServerStartingSecurity (BN6/7/14/15 1,5, BN13 3) | Level |
| 6 | Laufzeiten hack/grow/weaken = 1 : 3,2 : 4, beim Aufruf fest | `Hacking.ts:60-94`, `NetscriptFunctions.ts:264,325` | HackingSpeedMultiplier BN14 0,3 / BN15 0,6 | $/GB*s, Stapelkalender |
| 7 | grow: log-Wachstum x ServerGrowthRate x hacking_grow x Kernbonus, +1 $/Faden, Deckel moneyMax | `Server/formulas/grow.ts:102-152` | ServerGrowthRate BN2 0,8 / BN3 0,2 / BN11 0,2 | grow-Faeden je Beute |
| 8 | grow: Sicherheit +0,004 je GENUTZTEM Zyklus, nichts wenn Geld unveraendert | `Server/ServerHelpers.ts:204-224` | alle | grow auf vollem Ziel ist sicherheitsneutral |
| 9 | weaken: 0,05 x Faeden x Kernbonus x ServerWeakenRate | `ServerHelpers.ts:320-323`, `NetscriptFunctions.ts:344-378` | BN11 x2 | Vorbereitung/Stapel |
| 10 | Kernbonus 1+(k-1)/16 auf grow, weaken, share (nicht hack) | `ServerHelpers.ts:315-318`, `Share.ts:21-24` | alle | bis x1,8125 je Faden |
| 11 | Weltserver haben Kerne: zufaellig in [ceil(layer/2), layer] | `ServerHelpers.ts:401-405` | alle | BN2-Stand: fulcrumtech 11, omnitek 12, blade 12, powerhouse 13 Kerne |
| 12 | home-Kerne kaufen: 1e9 x 7,5^Kerne | `PlayerObjectServerMethods.ts:42-44` | alle (Reset je Knoten) | Kernbonus auf home |
| 13 | share(): 10 s, effektive Faeden = Faeden x intBonus(int,2) x Kernbonus, Bonus 1+ln/25 | `NetworkShare/Share.ts:21-49`, `NetscriptFunctions.ts:385-393` | alle | NUR Faktionsarbeit: hacking voll, security/field nur der hacking+int-Teil (`reputation.ts:16-52`); Sleeves ebenso (`SleeveFactionWork.ts:36`); Passivruf (`FactionHelpers.tsx:132-170`, BN2 = 0); NICHT Firmenarbeit (`Work/Formulas.ts:124-158`) |
| 14 | HGW-Optionen threads / stock / additionalMsec | `NetscriptHelpers.tsx:396-418` | alle | Taktung (additionalMsec), Boerse (stock) |
| 15 | stock-Option: grow hebt, hack senkt `otlkMagForecast` um 0,1 mit p = Geldaenderung/moneyMax | `StockMarket/PlayerInfluencing.ts:24-61` | wertvoll nur mit Depot; BN8 einziger Geldhebel ausser Boerse | BN8 |
| 16 | hackAnalyze*/growthAnalyze*/weakenAnalyze (je 1 GB) | `NetscriptFunctions.ts:197-246,295-323,380-384`, `RamCostGenerator.ts:569-581` | alle | Planung (RAM-Preis) |
| 17 | Formulas-API 0 GB, Formulas.exe 5 Mrd (Darkweb) / Level 1000 / bleibt mit SF5 | `RamCostGenerator.ts:680-708`, `DarkWebItems.ts:20`, `Programs.ts:308-320` | alle (SF5.3 vorhanden: gratis) | exakte Planung ohne RAM |
| 18 | getHackTime/getGrowTime/getWeakenTime (0,05 GB) | `RamCostGenerator.ts:649-651` | alle | Selbstmessung im Arbeiter |
| 19 | Skript-RAM: Basis 1,6; hack 0,1; grow/weaken 0,15; share 2,4 | `RamCostGenerator.ts:16-20,575` | alle | Faeden je GB |
| 20 | exec/scp, Netscript-Ports (0 GB, unbegrenzt) | `RamCostGenerator.ts:599-643`, `Constants.ts:38` | alle | Infrastruktur |
| 21 | Portprogramme + NUKE, TOR (Darkweb oder createProgram) | `DarkWeb/DarkWebItems.ts`, `Programs/Programs.ts` | alle | Root |
| 22 | Mietrechner kaufen/aufruesten: r x 55000 x CloudServerCost x Softcap^(log2 r-6); Upgrade = Differenz; weg bei Einbau | `Server/ServerPurchases.ts:22-62`, `NetscriptFunctions/Cloud.ts:94-103` (Upgrade-Kosten -1 bei ungueltiger Groesse) | Softcap BN2 1,3 / BN3 1,3 + Cost 2 / BN6,7,11 2 / BN13 1,6 / BN8 4 | Netz-RAM |
| 23 | home-RAM: ram x 32000 x 1,58^log2(ram) x HomeComputerRamCost; bleibt bei Einbau | `PlayerObjectServerMethods.ts:30-40` | BN3 x1,5 | Netz-RAM, Werkzeugplatz |
| 24 | Hacknet-Server als Wirte (RAM drueckt Hashrate) | `Hacknet/HacknetServer.ts` | SF9 | (bewusst nicht als Wirt) |
| 25 | Hash: Reduce Minimum Security / Increase Maximum Money (je 2 %, 50 x Stufe Hashes, bis Einbau) | `Hacknet/data/HashUpgradesMetadata.tsx:41-61`, `Server.ts:111-134` | SF9 | Zielwert (Schnittstelle Nebensysteme, E1) |
| 26 | Backdoor: Faktionseinladungen, Direktverbindung, Firmenruf-Bedarf x0,75, Kurs 10 % billiger; Dauer hackTime/4 | `FactionJoinCondition.ts:48-55`, `Company/utils.ts:15-19`, `Work/Formulas.ts:99-104`, `Singularity.ts:491-530` | alle | Progression (kein Hackertrag) |
| 27 | manualHack (Singularity): ManualHackMoney, Int-Exp 0,005, setzt Backdoor | `Singularity.ts:486-490`, `NetscriptHelpers.tsx:649-676` | alle | vernachlaessigbar |
| 28 | Offline-Produktion: Hackgeld x OfflineHackingIncome, grow 0,5x, Exp x Konfidenz | `engine.tsx:265-276`, `Script/ScriptHelpers.ts:14-90` | alle | nur bei geschlossenem Spiel |
| 29 | Intelligenz: chance/Zeit x intBonus(int,1), share x intBonus(int,2) | `PersonObjects/formulas/intelligence.ts:1-3` | alle | +9 % / +19 % bei Int 153 |
| 30 | Startzustand Server: moneyAvail = base x SSM, moneyMax = 25 x base x SMM, Sicherheit x SSS (Deckel 100), min = round(real/3) | `Server/Server.ts:74-83` | Fuellung beim Start: BN2/3 0,20, BN11 0,40, BN6/7 0,10, BN13 0,09, BN14 0,029, BN15 0,025 | Vorbereitungsaufwand |
| 31 | Hacking-Level aus Exp, HackingLevelMultiplier | `PersonObjects/formulas/skill.ts:7-15` | BN2/3 0,8, BN6/7 0,35, BN11/15 0,6, BN13 0,25, BN14 0,4 | erreichbare Ziele |
| 32 | Hacking in V2 fuer Bladeburner: Black-Op/Op-Gewichte hacking 0,05-0,25 (Abklang 0,6-0,85), Field Analysis hacking^0,3 | `Bladeburner/data/BlackOperations.ts:16-25`, `Operations.ts:22-215`, `Bladeburner.ts:1123-1128` | V2 | klein (s. 4.6) |
| 33 | Darknet-Server: per hack nicht angreifbar (`getNormalServer`), eigene Mechanik | `NetscriptHelpers.tsx:577-589`, `Hacking.ts:61` | SF15/BN15 (V1b) | ausserhalb dieses Bereichs |
| 34 | Einkommensmessung getTotalScriptIncome/moneySources | `NetscriptFunctions.ts` | alle | Telemetrie |

Inventar: 34 Features.

## 2. Abdeckungsmatrix

Phasen: K = Kaltstart, A = Aufbau, Z = Einbauzyklus, E = Endspiel, S = Sprung.

| # | Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil |
|---|---|---|---|---|---|
| 1,2,7,9 | Beute, Chance, grow, weaken | `src/lib/calc.js:135-178,203-297` (Formeln), `src/bn4net.js:1816-1850` (kennzahlen -> targetMetrics) | alle, K-E | OPTIMAL | calccheck 0,000 %; BN-Mult. aus `lib/bitnodes.json` (`bn4net.js:129-154`) |
| 3 | ScriptHackMoneyGain | nicht gelesen (`bn4net.js:150-152` liest nur SHM, GR, WR) | BN8 | NICHT GENUTZT | bekannt C6, keine neue Fundstelle |
| 4,8 | Sicherheitszuwaechse | `bn4net.js:1785-1790`, `calc.js:720-721` | alle | OPTIMAL | |
| 5,10-Zielwahl | Erfahrungsziel nach (3+0,3 base)/hackTime(min) | `bn4net.js:1858-1863` | alle | OPTIMAL | BN2 waehlt joesguns (1,5 % vor foodnstuff bei SSS 1, nachgerechnet); BN6/7/13/14/15 foodnstuff |
| 5-Ofen | Erfahrungsofen `worker/expfarm.js` (weaken) | `src/worker/expfarm.js:69`, `bn4net.js:3485-3491` | Ueberschuss, alle | GENUTZT-SUBOPTIMAL | HACK-7: grow auf vollem, nicht gehacktem Ziel +25 % |
| 6 | Laufzeiten | `ns.getHackTime` in `bn4net.js:2135-2139`, `worker/hack.js:52-71` | alle | OPTIMAL | Selbstmessung kostet 0,05 GB/Faden = 2,9 % (bekannt 2#7) |
| 10,11 | Kernbonus (Weltserver, home) | bewusst ignoriert: `bn4net.js:2390-2409`, Platzierung `bn4net.js:5357-5389` | alle | GENUTZT-SUBOPTIMAL | HACK-3 |
| 12 | home-Kerne | `src/homegrow.js:88-98` | alle, A-E | GENUTZT-SUBOPTIMAL | HACK-5 (kauft Wirkung, die der Kern nicht nutzt) |
| 13 | share | `bn4net.js:2167-2244, 2601-2665`; Schalter `data/rep-modus.txt` aus `bn4rep.js:2431`, `:1900`, `joinrun.js:98` | alle; laeuft in V2 dauernd | FEHLER | HACK-1 |
| 14 | additionalMsec | `worker/hack.js:52`, grow/weaken analog | alle | OPTIMAL | |
| 15 | stock-Option | nicht genutzt (kein `{stock:true}` in `src/`) | nur BN8 relevant | NICHT GENUTZT | bekannt (BAUSTELLEN.md:2533ff "Boersen-Bot fuer BitNode 8", AUDIT-BAUSTELLEN-2026-09-06 Nr. 43); kein neuer Beleg, kein Befund |
| 16 | Analyse-Familie | ersetzt durch calc.js (0 GB), `bn4net.js:1816-1850` | alle | OPTIMAL | RAM gespart, Treue belegt |
| 17 | Formulas-API | nur `calccheck.js` (Pruefwerkzeug) | alle | OPTIMAL | Formulas.exe kommt mit SF5 gratis (im BN2-Stand vorhanden, `other`-Ausgabe 287,8 Mio = nur Knacker+TOR); eigene Formeln gleichwertig |
| 19 | Skript-RAM | `bn4net.js:1742-1748` (getScriptRam) | alle | OPTIMAL | |
| 20 | exec/scp/Ports | `bn4net.js` (49x exec, 171x scp im Baum) | alle | OPTIMAL | |
| 21 | Portprogramme/TOR | `darkweb.js:66-89`, `bn4life.js:340-358`, `bn4net.js:3694ff` | K/A | OPTIMAL | Zeitpunkt bekannt (B#9) |
| 22 | Mietrechner | Entscheidung `bn4net.js:1261-1543`, Ausfuehrung `src/shop.js:146-268` | alle, K-E | FEHLER + SUBOPTIMAL | HACK-2 (Auftrags-Verklemmung), HACK-4 (Deckel 600 s in V2) |
| 23 | home-RAM | `homegrow.js:100-124` | alle | GENUTZT-SUBOPTIMAL | in HACK-5 (kein Preisvergleich zum Park) |
| 24 | Hacknet als Wirt | ausgeschlossen `bn4net.js:898-903` | SF9 | OPTIMAL | |
| 25 | Hash-Zielupgrades | `hashes.js` verkauft ("Sell for Money", BN2-Stand) | SF9 | NICHT GENUTZT | bekannt E1; Schnittstelle, s. offene Fragen |
| 26 | Backdoor | `bn4door.js:63-70` | alle | OPTIMAL | Firmenserver drin (x0,75 Firmenruf) |
| 27 | manualHack | nicht genutzt | - | NICHT ANWENDBAR | kein Ertrag |
| 28 | Offline | - | - | NICHT ANWENDBAR | Spiel laeuft durch |
| 29 | Intelligenz | `calc.js:114-116` (Gewicht 1 fuer chance/Zeit korrekt) | alle | OPTIMAL | |
| 30 | Startzustand/Vorbereitung | `calc.js:459-497` (prepSec) | alle, K/S | GENUTZT-SUBOPTIMAL | HACK-4 (Horizont 1800 s / prepMax 1200 s in V2) |
| 31 | Level | Zielfilter `bn4net.js:1857` | alle | OPTIMAL | |
| 32 | Hacking fuer Bladeburner | kein Gewerk wertet es | V2 | NICHT ANWENDBAR (klein) | 4.6: 372->450 Level = +0,7 % Assassination-Kompetenz |
| 33 | Darknet | - | BN15 | NICHT ANWENDBAR | V1b, eigenes Gewerk |
| 34 | Einkommensmessung | `bn4net.js` (7x getTotalScriptIncome) | alle | OPTIMAL | |

Zaehlung (29 Matrixzeilen): OPTIMAL 15, GENUTZT-SUBOPTIMAL 5, FEHLER 2 (share, Park),
NICHT GENUTZT 3, NICHT ANWENDBAR 4, GENUTZT-TOT 0 (`tools/test-scope-tot.js`: 0 Funde,
Selbstprobe gruen - das Werkzeug kann den Fall melden).

## 3. Befunde

### HACK-1 (FEHLER, P1) share laeuft in V2-Knoten dauernd - ohne einen einzigen Abnehmer

- **Bot:** `src/bn4net.js:2167-2172` schaltet share ein, solange `data/rep-modus.txt`
  juenger als 120 s ist; Deckel 12 % des Netzes (`:2239-2243`). `src/bn4rep.js:2431`
  schreibt diese Datei in JEDER Runde, VOR der Pruefung `bladeSperreArbeit()`
  (`:2475`) - in einem Bladeburner-Knoten also immer, obwohl dort nie fuer eine
  Faktion gearbeitet wird (`bn4rep.js:496`, Log "Faktionsarbeit ausgesetzt").
  Gleiche Wirkung: Firmenphase `bn4rep.js:1900`, Gym-Lauf `joinrun.js:98` ("JOINRUN").
  Der Arbeiter selbst sagt "darf nur eingesetzt werden, wenn genau das der Fall ist"
  (`src/worker/share.js:9-10`).
- **Spiel:** share wirkt nur ueber `calculateCurrentShareBonus()` in der
  Faktionsarbeitsformel (`PersonObjects/formulas/reputation.ts:16-52`) - fuer den
  Spieler (`Work/FactionWork.tsx:39`), Sleeves (`SleeveFactionWork.ts:36`) und den
  Passivruf (`Faction/FactionHelpers.tsx:132-170`). BN2 hat `FactionPassiveRepGain: 0`
  (`BitNode.tsx:581`, Abbruch `FactionHelpers.tsx:134`). Firmenarbeit kennt share nicht
  (`Work/Formulas.ts:124-158`).
- **Beleg im Spielstand:** alle acht BN2-Staende: `currentWork: null`, 105 -> 265
  share-Faeden (11,8-12,0 % des Netzes), Sleeves auf Bounty Hunter/infiltrate
  (`data/sleeve.json`, Sleeve-Faktionsarbeit gibt es nur im Hackingweg,
  `sleeve.js:225-232`). `data/rep-modus.txt` = "Sector-12|1791014379527", 4 s vor
  `lastUpdate`, waehrend `data/bn4rep-log.txt` "Faktionsarbeit ausgesetzt" meldet.
  672 der 1060 share-GB liegen auf home.
- **Folge, gerechnet (`hack-park.mjs`, geeicht, s. 0.):** 1060 GB an die Geldziele
  = +231.590 $/s = **+0,83 Mrd $/h (+13,4 % der Hackeinnahme)** im BN2-Stand.
  Andere V2-Knoten: Passivruf existiert dort, share hebt ihn aber nur um 12 % von
  1 % der Arbeitsrate je Faktion (favorMult 0,01 bei Favor 0) - rund 120 Ruf/h ueber
  neun Faktionen, gegen denselben Speicher.
- **Fix:** share nur bei echtem Abnehmer: Spieler in FactionWork ODER ein Sleeve in
  Faktionsarbeit (`data/sleeve.json`). bn4rep schreibt die Datei erst nach
  erfolgreichem `workForFaction`/`arbeitetSchon`; die Bremse fuer bn4life bekommt eine
  eigene Datei (zwei Vertraege, ein Schalter - wie beim Handschlag).

### HACK-2 (FEHLER, P1) Der Rechnerpark waechst nur um EINEN Schritt je 10 Minuten - Auftrags-Verklemmung zwischen Kern und shop.js

- **Ablauf (deterministisch):** `src/shop.js:165-174` schreibt `data/preise.json`
  (Parkgroessen) VOR der Ausfuehrung des Auftrags. Nach dem Ausbau liest der Kern das
  Ergebnis (`bn4net.js:254-272`, Auftrag erledigt), sieht in derselben Runde den
  veralteten Park (`bn4net.js:1274-1276, 1451-1464`) und bestellt fuer DENSELBEN
  Rechner denselben Ausbau noch einmal. shop.js fragt `getServerUpgradeCost` - das
  Spiel liefert -1, weil die Zielgroesse nicht groesser ist (`Cloud.ts:94-103`,
  `ServerPurchases.ts:50-51`) - und behandelt das als "warte auf Geld"
  (`shop.js:253-264`), markiert den Auftrag nie als erledigt. Der Kern haelt den
  Auftrag 600 s fuer offen (`bn4net.js:258-261`) und bestellt solange nichts.
- **Beleg:** BN2-Logs 05:08 bis 09:57: genau ein Ausbau alle 10:00-10:30 min, jeweils
  gefolgt von "Auftrag ... erledigt (werk-N)" und sofort "werk-N: ... bestellt" fuer
  denselben Rechner; `data/shop-log.txt` "Ausbau werk-13 auf 128 GB kostet -0.0m -
  warte auf Geld"; `data/shop.json` state "blocked", reason "money" bei 9,4 Mrd auf
  dem Konto. Park 1792 GB (05:33) -> 3712 GB (09:59), jeder Schritt laut Bot in
  281-400 s amortisiert. Dasselbe Muster in 16 von 23 BN12-Staenden mit Ausbauzeilen
  (`kostet -0.0m` in `data/shop-log.txt`).
- **Folge, gerechnet:** Nach der eigenen Regel des Bots (Deckel 600 s) waeren 128->256
  (Modell 333 s) und 256->512 (592 s) sofort gefallen. Park 25x256 statt Ist:
  **+1,57 Mrd $/h (+25 %)**, Richtung 25x512: +5,25 Mrd $/h (+84 %), Kosten 0,37 bzw.
  1,32 Mrd bei 9,4 Mrd Konto. Ueber BN2 bisher (Defizit ~3.700 GB ueber ~3,5 h bei
  ~0,6 Mio $/s Grenzwert) rund 5-8 Mrd $ entgangen (~30 % der bisherigen
  Hackeinnahme, Schaetzung). Trifft jeden Knotenstart und jeden Wiederaufbau nach
  einem Einbau, sobald alle 25 Plaetze belegt sind (Kauf-Auftraege sind nicht
  betroffen).
- **Fix (S, jeder Punkt allein loest es):** shop.js meldet `kosten <= 0` als
  erledigt/gescheitert ("ziel_nicht_groesser"); oder preise.json NACH dem Auftrag
  schreiben; oder der Kern traegt `ergebnis.gb` fuer `ergebnis.ergebnis` sofort in
  `parkRam` ein bzw. bestellt in der Ergebnisrunde nichts.

### HACK-3 (SUBOPTIMAL, P2) Kerne der Wirte werden verschenkt - in V2 ist Speicher der Engpass

- **Bot:** Faedenzahlen mit cores=1 (`bn4net.js:2390-2409` "sichere Annahme"; Stapel
  `:2960-2968`), Platzierung kernblind (`platziere`, `bn4net.js:5357-5389`: kleinster
  passender Wirt). Der eigene Kommentar nennt die Bedingung fuer den Umbau: "Erst wenn
  das Netz wirklich ausgelastet ist" - im BN2-Stand ist es: `ueberschussGb` 0,
  `idle_ram_pct` 0, `restGb` 1.
- **Spiel (neue Fundstelle):** Weltserver bekommen beim Erzeugen
  `getRandomIntInclusive(ceil(layer/2), layer)` Kerne (`ServerHelpers.ts:401-405`) -
  im BN2-Stand fulcrumtech 11 (1024 GB), omnitek 12 (512 GB), blade 12, titan-labs 11,
  powerhouse 13; 4.960 GB Mehrkern-RAM mit mittlerem Bonus 1,37. grow/weaken lesen die
  Kerne des AUSFUEHRENDEN Wirts (`NetscriptFunctions.ts:288, 359`; share `:388`).
- **Folge, gerechnet (`hack-kerne.mjs` + `hack-park.mjs`):** Bei heutiger Platzierung
  sind 810,6 GB grow/weaken-Faeden reine Ueberdeckung (9,15 % des Netzes) ->
  **+0,64 Mrd $/h (+10,3 %)**. Mit kernbewusster Platzierung (grow/weaken zuerst auf
  die Mehrkern-Wirte, hack auf die einkernigen werk-*) braucht die heutige
  grow/weaken-Last ~3.660 statt 5.420 GB -> +1.756 GB -> **+1,34 Mrd $/h (+21,5 %)**.
  BN12L3 zum Vergleich: 41.540 GB = 7,55 % des Netzes (dort ging Ueberschuss an den
  Ofen).
- **known_before:** Audit 26.09. 2#5 (nur home-Kerne, "heute folgenlos, weil Speicher
  nicht der Engpass"). Neu: Weltserver-Kerne und der gemessene RAM-Engpass in V2.
- **Fix:** Faeden je Platzierung als ceil(n/Kernbonus(wirt)) fuer grow/weaken;
  `platziere` sortiert grow/weaken auf hohe Kerne, hack auf Kern 1.

### HACK-4 (SUBOPTIMAL, P2) bn4net rechnet in V2 mit dem V1-Einbautakt: Parkdeckel 600 s und Zielhorizont 30 min

- **Bot:** `bn4net.js:1515` `amortDeckel = wartend >= 2 ? 600 : 1800` - "Einbau nah".
  `bn4net.js:1695` `ZIELWAHL = { horizonSec: 1800, prepMaxSec: 1200 }`, begruendet mit
  den 20-97-min-Zyklen von BN5L2. In V2 sperrt `kampfEinbauSperre`
  (`src/lib/endspurt.js:322-333`, `KAMPF_EINBAU_MIN_MS = 12 h`) jeden Einbau fuer
  mindestens 12 h; BN2-Stand: 4 Augs wartend, kein Einbau in 5,3 h.
- **Folge, gerechnet:** (a) Park: Schritt 512->1024 amortisiert im Modell in 812 s
  (real/r 1243 s) - bei 12 h Restzeit eindeutig lohnend, vom 600-s-Deckel gesperrt.
  25x512 statt 25x256: weitere **+3,7 Mrd $/h** (Szenario E minus D, +59 %). Wirkt erst
  nach HACK-2. (b) Ziele: the-hub (Modell 427 $/GB*s, viertbestes Ziel, 1666 GB
  Kapazitaet), johnson-ortho und crush-fitness haben prepSec 1653/1440/1204 s >
  prepMaxSec -> Rang 0 (`hack-prep.mjs`); the-hub steht seit Erreichen von Level 304
  (~2 h) unberuehrt (Sicherheit 44, Fuellung 0,20) und bliebe es bis Level ~530
  (prepSec ~ 1/(Level+50)). Gegen das schwaechste belegte Segment: **+0,33-0,71
  Mrd $/h (+5-11 %)**, GERECHNET_UNGEEICHT (welches Segment verdraengt wird, ist
  angenommen).
- **Fix:** Horizont aus der erwarteten Zeit bis zum naechsten Einbau (in V2:
  Restsperre aus `kampfEinbauSperre`), daraus amortDeckel und horizonSec/prepMaxSec.

### HACK-5 (SUBOPTIMAL, P2) homegrow kauft home-Kerne fuer Milliarden, deren Wirkung niemand nutzt

- **Bot:** `src/homegrow.js:88-98` kauft den naechsten Kern, sobald Konto > 1,2 x Preis
  (Deckel 3e13 = bis Kern 6). Begruendung im Kopf: "home traegt rund 98 Prozent aller
  Faeden" (Spaetphase V1). Der Kern plant aber mit cores=1 (HACK-3), der Bonus ist
  also Ueberdeckung.
- **Beleg:** `data/homegrow.txt` 08:36:52 "home-Kerne auf 2" - 7,500 Mrd (Formel) gegen
  7,523 Mrd Sprung in `moneySourceA.servers` (geeicht). Auf home liefen danach 672 GB
  share und 5,4 GB weaken: der Kern hob nur den share-Bonus - der in BN2 keinen
  Abnehmer hat (HACK-1). Naechster Kern: 56,25 Mrd.
- **Folge:** 7,5 Mrd fuer ~0 Ertrag = 1,2 h der gesamten Hackeinnahme; dieselbe Summe
  haette den Park auf 25x1024 gebracht (3,8 Mrd, Szenario F +7,9 Mrd $/h). Selbst mit
  HACK-3 bringt Kern 2 auf home nur 6,25 % auf home-grow/weaken (~35 GB) ->
  Amortisation > 200 h. Dazu home-RAM ohne Preisvergleich (`homegrow.js:117`):
  1024->2048 GB kostet 3,18 Mrd (3,1 Mio $/GB), der Park 256->512 0,95 Mrd fuer
  6.400 GB (149 k$/GB) - Faktor 21 je GB; der Vorteil "ueberlebt den Einbau" traegt
  bei >= 12 h Einbauabstand in V2 nicht.
- **Fix:** Kern nur kaufen, wenn bn4net Kerne einrechnet UND Amortisation < Horizont;
  home-RAM gegen den naechsten Parkschritt in $/GB stellen.

### HACK-6 (SUBOPTIMAL, P3) Feste Stapel-Aufschlaege kosten 10 % Stapelspeicher - jetzt, wo Speicher knapp ist

- **Bot:** `bn4net.js:2777,2789` (WEAKEN_MARGIN 1,5, GROW_MARGIN 1,15), dieselben
  Werte in `lib/calc.js:654-655`.
- **Gerechnet (`hack-marge.mjs`, Stapelgroesse gegen Telemetrie geeicht):** omega-net
  53,65 -> 48,25 GB (1,02/1,1), silver-helix 50,15 -> 44,75, phantasy 37,6 -> 35,8;
  von 5.999 GB Stapelspeicher werden 599 GB frei -> rund **+0,47 Mrd $/h (+7,5 %)**.
  Leveldrift in BN2: ~10 Level/h bei Level 372, ueber tWeaken 123 s +0,36 Level -
  weit unter dem, was 15 % decken.
- **known_before:** Audit 26.09. 2#5 ("Wirkung erst nach 1/2 relevant"). Neu: BN2
  ist speichergebunden, der Punkt ist jetzt wirksam.

### HACK-7 (SUBOPTIMAL, P3) Erfahrungsofen mit weaken statt grow - der Einwand gegen grow gilt nicht mehr

- **Bot:** `src/worker/expfarm.js:39-51,69` (weaken), Begruendung: die Wartungswelle
  hackte das Ziel leer, grow hob dann die Sicherheit (skeptiker-B S-1).
- **Neu:** Seit 26.09. bekommt das Erfahrungsziel ausser im Ein-Ziel-Fall NUR weaken
  (`bn4net.js:2124-2125`) - niemand hackt es mehr. Ein einmal vollgewachsenes Ziel
  bleibt voll; grow auf vollem Ziel ist sicherheitsneutral (`ServerHelpers.ts:208-214`:
  Fortify nur bei Geldaenderung). grow dauert 3,2 statt 4 hackTime (`Hacking.ts:84,91`)
  bei gleichem RAM (0,15 GB, `RamCostGenerator.ts:577,580`) -> **+25 % exp/s des
  Ofens**, exakt aus den Formeln (GERECHNET_UNGEEICHT, keine Messgroesse noetig).
- **Wo es zaehlt:** BN8 (V1, Ausgang Level 3000, kein Hackgeld - der Ofen ist dort der
  Motor) und speicherreiche Phasen in BN3/BN11, wo Hacken 17 bzw. 5 % des
  BN2-Ertrags bringt (`hack-knoten.mjs`) und Ueberschuss entsteht.
- **known_before:** Audit 26.09. 2#1, skeptiker-B S-1.

## 4. Rechnungen (Ausgaben)

### 4.1 Grenzertrag Netz-RAM, BN2-Stand 09:59 (`node tools/audit/hack-park.mjs <09-59> 1734000`)

```
Stand: Level 372 Netz 8860 GB, Geldarbeiter 6745 GB, share 1060 GB
Modell bei Ist-Belegung: 2654523 $/s; gemessen 1734000 $/s -> Realisierungsquote r = 0.653
Grenzeffizienz bei Ist (Modell x r): 224 $/GB*s        [Bot effFlotte: 227]
A share frei                       +  1060 GB -> +231590 $/s = +0.83 Mrd $/h (+13.4 %)
B Kerne, heutige Platzierung       +   811 GB -> +178429 $/s = +0.64 Mrd $/h (+10.3 %)
C Kerne + kernbewusste Platzierung +  1756 GB -> +372346 $/s = +1.34 Mrd $/h (+21.5 %)
D Park 25x256 statt Ist            +  2688 GB -> +437215 $/s = +1.57 Mrd $/h (+25.2 %)
E Park 25x512 statt Ist            +  9088 GB -> +1458897 $/s = +5.25 Mrd $/h (+84.1 %)
F Park 25x1024 statt Ist           + 21888 GB -> +2196560 $/s = +7.91 Mrd $/h (+126.7 %)
Stufe 128->256 bei Park 3712:  14.6 Mio, 114.4 k$/GB, Amortisation Modell 333 s, real 510 s  [Bot-Log 339 s]
Stufe 256->512 bei Park 6400:  38.1 Mio, 148.7 k$/GB, Amortisation Modell 592 s, real 907 s
Stufe 512->1024 bei Park 12800: 99.0 Mio, 193.3 k$/GB, Amortisation Modell 812 s, real 1243 s
Stufe 1024->2048 bei Park 25600: 257.4 Mio, 251.3 k$/GB, Amortisation Modell 1816 s, real 2780 s
```

### 4.2 Kerne (`hack-kerne.mjs`, Auszug BN2 09:59)

```
fulcrumtech 11 Kerne x1.625 1024 GB, grow/weaken 597.6 GB, Ueberdeckung 229.8 GB
omnitek     12 Kerne x1.6875 512 GB, grow/weaken 392.4 GB, Ueberdeckung 159.9 GB
... Summe: grow+weaken 5419.8 GB, hack 1324.8, share 1060
davon bei kernbewusster Planung frei: 810.6 GB = 9.15 % des Netzes
Mehrkern-RAM 4960 GB, mittlerer Bonus 1.3726; BN12L3: 41539.5 GB = 7.55 %
```

### 4.3 Verklemmung (Logauszug BN2, `hack-save.mjs --files=data/bn4net-log.txt`)

```
05:08:36 werk-0: 64 -> 128 GB bestellt ... amortisiert in 1042 s.
05:08:56 Auftrag ...-120: erledigt (werk-0)
05:08:56 werk-0: 64 -> 128 GB bestellt ...          <- derselbe Rechner noch einmal
05:18:57 werk-1: 64 -> 128 GB bestellt ... 400 s.   <- erst nach 600 s Auftragsfrist
... (alle 10:00-10:30 min, bis 09:57:59 werk-3: 128 -> 256)
shop-log 07:30:06 "Ausbau werk-13 auf 128 GB kostet -0.0m - warte auf Geld."
```

Park je Stand: 05:33 1792 GB (22x64, 3x128), 06:33 2176, 07:33 2496, 08:33 2880,
09:19 3136, 09:33 3328, 09:59 3712 (21x128, 4x256); Konto 0,22 / 2,41 / 4,80 /
8,63 / 5,83 / 7,08 / 9,38 Mrd.

### 4.4 Vorbereitung/Rang (`hack-prep.mjs`, BN2 09:59)

```
host         sec  min fill steadyEff kap  prepSec rang
the-hub      44.0 15  0.20 427       1666 1653    0
johnson-ortho 51.0 17 0.20 216       1484 1440    0
crush-fitness 37.0 12 0.20 155       1787 1204    0
```

### 4.5 Hackertrag der Restroute (`hack-knoten.mjs`, gleicher Spieler, 6745 GB, offenes Modell)

BN2 1,00 | BN3 0,17 | BN11 0,05 | BN6 1,60 | BN7 1,51 | BN13 0,82 | BN14 1,47 | BN15 4,00 | BN8 0.
Die Rangfolge der Ziele aendert ServerMaxMoney NICHT (alle Server gleich skaliert,
Faeden je Anteil unveraendert) - die Zielwahl ist dagegen robust. Was sich aendert,
ist der Wert von RAM gegen andere Verwendungen: in BN3/BN11 faellt Hack-RAM auf
5-17 % - dort wird der Ofen (HACK-7) und die Frage "Geld aus Hacken oder aus
Verbrechen/Bladeburner" (Orchestrierung) wichtiger.

### 4.6 Hacking-Erfahrung in V2 (Bladeburner-Wert, Quelle `Action.ts:169-200`)

Assassination: Gewicht hacking 0,1, Abklang 0,6. Kompetenz im BN2-Stand ~60,6
(hacking 3,48). Level 372 -> 450 (5,7e7 statt 7,8e6 Exp, Faktor 7) = +0,42 = +0,7 %.
Erfahrung hat in V2 also fast nur ueber die Hackgeschwindigkeit Wert; der 180-Faden-
Ofen (324 GB, 3,7 % RAM, ~114 exp/s von 587 exp/s gesamt) ist dort vertretbar, kein
Befund.

## 5. Geprueft, in Ordnung

- calc.js gegen Spiel (calccheck 0,000 %), Level- und Preisformeln (Tabelle 0.).
- BN-Multiplikatoren der Restroute in `lib/bitnodes.json` = `BitNode.tsx`.
- Erfahrungsziel: joesguns bei SSS 1 (1,5 % vor foodnstuff), foodnstuff bei SSS 1,5/3.
- F_LEITER bei Speicher-Engpass: f=0,05 waere 2,5-6 % besser je GB als f=0,02 - unter
  der Befundschwelle.
- Anlauf-Gate gegen Flottenschnitt (B6 vom 24.08.): in V2 mit RAM-Engpass richtig
  (iron-gym 191 < Grenzwert 224).
- Formulas.exe: mit SF5 gratis vorhanden, Bot nutzt eigene 0-GB-Formeln - gleichwertig.
- Hacknet-Server keine Wirte (Hashrate), Backdoors inkl. Firmenserver.
- Kein toter Code im Bereich (`tools/test-scope-tot.js` 0 Funde, Selbstprobe gruen).
