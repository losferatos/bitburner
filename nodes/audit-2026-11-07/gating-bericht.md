# Gating-Audit Knoten-/SF-Sperren (07.11.2026, nur lesend)

Live-Lage BN15.2 (V2), Motor ~22,6 h. Konto 250,7 Mrd. Registry live: gilt 20 / running 20 / absent 0 / degraded 0.
Format: Fundstelle | Sperre | betrifft 15 / 8 | begruendet? | Einstufung | Wirkung

## A. FEHLER / hoher Hebel

1. graftauto.js (registry.json:395 requiresFile graftplan.json; data/nicht-schieben.txt Zeile graftplan.json)
   - Sperre: Zuender-Datei graftplan.json wird absichtlich NICHT ins Spiel geschoben (Entscheidung 04./06.09., "450 Mrd beim Start weg"). Live: weder graftplan.json noch data/graftauto.json auf home; data/graft.json zuletzt 31.08.
   - Betrifft 15 (laeuft nicht). 8 nicht relevant (V2-Gewerk).
   - Begruendet? NEIN durch Quellcode. Grafting kostet baseCost x 3 ohne BitNode-Aufschlag und ohne Ruf (GraftableAugmentation.ts:20-22; kein currentNodeMults in PersonObjects/Grafting). Zugang canAccessGrafting = Feature 10 (PlayerObjectGeneralMethods.ts:577), SF10.3 da. Bladeburner-Sonderstuecke graftbar ab Mitgliedschaft (GraftingHelpers.ts:11-18). Die 450-Mrd-Sorge stammt aus knapper Geldlage; jetzt liegen 250 Mrd unbenutzt.
   - Einstufung: FEHLER (alte Handentscheidung nie neu bewertet; AUDIT-BAUSTELLEN-2026-09-06 L7/L34, AUDIT-PERFEKT C1 "sobald der Zuender faellt").
   - Wirkung: gross. Live next_blackop_chance 0,101, chance 0,637, Rang 1647; eigene Doku (graftauto.js Kopf) nennt Faktor 10-20 auf den Rangweg. Geld ist in BN15 derzeit der Posten ohne Wirkung.
   - Vor dem Zuenden beachten: Werkbank-RAM idle nur 2,4 % (kpi idle_ram_pct); graftauto 16,75 GB + graft.js, evictRank 11. Kommentar "getOwnedAugmentations 80 GB bei SF4.1" ist veraltet (SF4.3: 5 GB), kein Hindernis.

## B. pruefen

2. corp.js (registry knoten [3]; corp.js:111 currentNode !== 3 -> done/not_executable; lib/corpgeld.js:35 CORP_MONEY_NODES=[3]; bn4life.js:119 SYNDICATE_TRIP_NODES=[3]; bn4rep.js:1735)
   - 15: Quellcode erlaubt Corp (helpers.ts:30-44 verlangt nur CorporationSoftcap >= 0,15, BN15 hat 0,4; Gruendung ausserhalb BN3 nur selbstfinanziert 150 Mrd, helpers.ts:63-68; maxDivisions 20*0,4=8, Corporation.ts:38; Bewertung x0,2, :223). Zugang SF3 (PlayerObjectCorporationMethods.ts:8), API-Unlocks bei SF3.3 automatisch (:20).
   - 8: Softcap 0 -> gesperrt (BitNode.tsx case 8) = begruendet.
   - Einstufung 15: pruefen, kein FEHLER. Die Sperre ist "unwirtschaftlich", nicht "unmoeglich"; Kommentar in corp.js sagt das ehrlich. Corp-Geld hat in BN15 keinen Abnehmer, solange Graften aus ist (A1); BN3-Kette "Corp-Geld -> graften" ist zurueckgestellt (BAUSTELLEN 605). Erst nach A1 neu bewerten; 55 GB RAM jetzt nicht frei.

3. go.js nur Gegner Tetrads (OPPONENT, goLohnt)
   - 8: aus mit Begruendung "Kampfwerte tragen dort nichts" - stimmt fuer Tetrads, die anderen Gegner wurden nie betrachtet: Daedalus = faction_rep/company_rep (bonusPower 1,1), Illuminati = hack/grow/weaken schneller (0,7), w0r1d_d43m0n = Hacking-Level (2) (Go/Constants.ts, effects/effect.ts:77-92). Bonus bei n=2000 mit SF14: 1+ln(2001)*2001^0,3*0,002*pw*2 = ca. +33 % Ruf bzw. +21 % Hackspeed (gerechnet, nicht geeicht).
   - Einstufung: pruefen (niedrig-mittel; BN8 = Hackingweg, Ruf fuer Hacking-Augs). Braucht anderen Gegner/Komi (KOMI 5,5 fest) und 20 GB RAM.
   - 15: Tetrads richtig, Gewerk laeuft jetzt (data/go.json knoten 15 frisch). Erste Lesung zeigte noch knoten 13 (Datei 5 Tage alt), eine Minute spaeter knoten 15: die Aenderung hat gegriffen.

4. gang.js (registry [2], V2; data/gang-an.txt "Gang in BN2")
   - 15: ausserhalb BN2 verlangt Gang SF2 (da, Stufe 3) UND Karma <= -54000 (PlayerObjectGangMethods.ts:12-30, Gang/data/Constants.ts:27). Kein Gewerk baut Karma auf (Sleeves fahren Kontrakte). BN15 GangUniqueAugs 0,3.
   - 8: GangSoftcap/UniqueAugs 0 -> begruendet.
   - Einstufung: ok bis pruefen-gering, kein Hebel fuer 15.

5. boerse.js (V1, knoten [8])
   - 15: Handel ohne SF8 nur Long (StockMarket.ts:151-204 verlangt BN8 oder SF8 >= 2/3 fuer Short/Orders); Geld ist kein Engpass -> ok.
   - 8: korrekt freigegeben. pruefen-gering: boerse.js nutzt keine Shorts (grep leer), in BN8 gilt bitNodeN===8, Short/Limit/Stop sofort erlaubt ohne SF8. Moeglicher Mehrertrag, nicht belegt.

## C. ok / begruendet

6. hashes.js:139 knoten === 8 sperrt: HacknetNodeMoney 0 (BitNode.tsx case 8; Hacknet/formulas/HacknetServers.ts:16). 15: laeuft (hashes.json frisch, kapazitaet 320, rate 0,014 H/s).
7. hacknet.js / lib/hackaugs.js:395 hacknetNachEinbau = knoten===9: keine Flotte in 15. Begruendet in nodes/HASH-RANG-2026-10.md (1 Mrd -> 0,48 H/s in BN15; Hash-Rang <= 0,65 h Offset selbst bei 10 Mrd). Mit 250 Mrd nicht neu gerechnet, aber die Rechnung deckelt den Nutzen. ok.
8. lib/hackaugs.js:434 hashRangAnlauf = 13/14/15: 15 enthalten (HacknetHelpers.tsx:539-546). ok.
9. blade.js/bbtrain.js V1-Filter (bn4net.js:4002-4016, 4220): in BN8 aus, begruendet durch BladeburnerRank 0 (BitNode.tsx case 8). 15: beide laufen (blade.json, bbtrain.json frisch).
10. sleeve.js:396 OHNE_VERBRECHENSGELD=[8] (CrimeMoney 0) begruendet. Sleeveanzahl 3 = min(3, SF10) (SleeveCovenantPurchases.tsx:68), sleeve.json anzahl 3. "grund arm" betrifft nur den Gym-Zweig (sleeve.js:1084), Aufgaben contract/infiltrate laufen.
11. homeram.js:288-291 (BN3/10 1,5; BN9 5; BN12 1,02^n) = BitNode.tsx:607/814/853/946; 15 und 8 Faktor 1. ok.
12. bn4rep.js:216 WD_DIFFICULTY (15:2, 8:1), lib/einbau.js:56/72 Daedalus-Schwelle: werden live per getBitNodeMultipliers gelesen (SF5 da), Tabelle nur Rueckfall. lib/bitnodes.json fuer 8 und 15 gegen BitNode.tsx verglichen: gleich. ok.
13. Stanek (kein Gewerk): nodes/bau-2026-10-27-stanek/BERICHT.md "lohnt nicht" (kalibriert). BN15 ExtraSize -2, Power 0,7; BN8 -99. ok.
14. cdump/csolve/darkweb/sleevecrime (phase kaltstart): laufen in "normal" nicht - gewollt (bn4net.js phaseJetzt: kein Park und home <= 64 GB). data/cantwort.json (49 Tage alt) wird im naechsten Kaltstart von csolve verbraucht (csolve.js:153). ok.
15. data/keine-hacknet.txt = "0": inert (lib/reg.js:61-64 verlangt n>0 und n===Knoten). Nur Datei-Rest.
16. lib/gocheat.js:24 sf14===3-Bonus: SF14.3 vorhanden. ok.

## D. SF-Stand-Annahmen
- lib/reg.js:274-275 ramBedarf: (lage.ownedSF||{})[4] auf eine Map liefert undefined -> sf4=0 -> Faktor 16 statt 1 (SF4.3). Nur KPI-Feld wartetGb (reg.js:251), kein Startentscheid (bn4net nutzt echte RAM-Werte); live wartetGb 0. Einstufung: veraltet, kosmetisch.
- Kommentare mit SF4.1-Preisen (graftauto.js, sleeve.js, gang.js) sind historisch; im Code haengt nur reg.js oben an der SF4-Stufe.
- SF9.3-Gratisserver, SF10 (3 Sleeves), SF14 (Go x2, Cheat), SF5 (getBitNodeMultipliers), SF11 (bn4rep.js:1845, Map korrekt) sind aktuell umgesetzt.

## E. Telemetrie BN15.2 (Alter in s)
Frisch: bn4net 2, watchdog 2, hashes 2, shop 23, ausgang 54 (Takt 30 s), blade ~0, bbtrain ~0, figwatch 3, sleeve 32, bn4life ~0, bn4rep 5, bn4door 15, export 96 (Takt 300 s), go frisch.
Fehlt/alt und erklaert: graftauto (fehlt, A1), boerse (nur BN8), gang 33 Tage (nur BN2), corp 29 Tage (nur BN3), csolve 49 Tage (Kaltstart).
Ohne Telemetriedatei, kein Beleg moeglich: contracts.js, popups.js, hacknet.js, homegrow.js - Registry-KPI running 20/20 widerspricht nicht.
Nebenbefund: kpi eta_min 398444, eta_sicher false (Hinweis, nicht Gegenstand).

## Fazit
Eine echte weitere Sperre: graftauto.js (A1) - nicht an den Knoten gebunden, sondern an eine alte Handentscheidung; in BN15 mit 250 Mrd Idle-Geld klarer Kandidat. Alle Knotenlisten ausser dem schon behobenen go.js sind quellcode- oder wirtschaftlich begruendet (Corp, Gang). Offen zum Pruefen: Go-Gegner in BN8, Shorts in BN8, Corp in BN15 (erst nach A1).
