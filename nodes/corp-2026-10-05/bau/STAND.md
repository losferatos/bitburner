# Nachtrag 06.10.2026 17:31 - corp-e2c (Zerlegung <= 51,6 GB nach dem ersten Einbau)

| Skript | RAM |
|---|---|
| corp.js | 55,1 GB (ohne getProduct/getInvestmentOffer) |
| corp-tick.js | 51,6 GB |
| corp-tickp.js | 51,6 GB |
| corp-act-cash.js | 51,6 GB |
| corp-tickb.js | 31,6 GB |
| corp-act-fin.js | 31,6 GB |
| corp-act-new.js | 21,6 GB |
| corp-act-bribe.js | 21,6 GB |
| alle anderen Kinder | 41,6 GB |

Neu: lib/corptick.js (Takt-Logik), corp-act-{size,wh,rs,new,bribe}.js. Rundenzahl/Angebot aus getCorporation (investorShares minus Seed, valuation x Anteil x Faktor). Uhr nach Zustandsverlust aus data/corp.json.
Etappe-3-Stand (e3b-Schnittstelle) ist enthalten und hinter {"etappe":3}; dort offen: Test "Neustart nach IPO mit Zustandsverlust" FAIL, F5-Rotlauf schlug nicht an.

# Nachtrag 06.10.2026 17:05 - Version corp-e3-2026-10-06, 24-h-Laeufe Etappe 3

CORP_VERSION auf corp-e3-2026-10-06 gehoben (einzige Code-Aenderung seit dem E3-Bericht).

24-h-Laeufe mit {"etappe":3} (tests/out/G3_s*.json, je 0 Fehler, alle Pruefbedingungen gruen):

| Saat | Einbau | Boersengang | Verkaeufe | Erloes |
|---|---|---|---|---|
| s1 | 12 h | 9,2 h | 15 | 5,8e16 |
| s2 | ohne | 9,5 h | 15 | 7,0e16 |
| s3 | 10,5 / 14 / 20 h | 9,1 h | 15 | 6,2e16 |

- Zuendung: 9,5 h in allen drei Saaten, Kalibrierfehler 0.
- Ruf: Sector-12 501-504k, Aevum 202k, Bladeburners 0.
- Ab ~20 h ist 1 Anteil mehr wert als der Bedarf: der Mindestverkauf ist 1 Anteil, der Erloes uebersteigt den Bedarf dann um x4-x1000. Gewollt, harmlos.

# Nachtrag 06.10.2026 17:03 - Etappe 2b (Skeptiker-Fixes) und Etappe 3

## Etappe 2b (Version corp-e2b-2026-10-06)
Skeptiker-Fixes F1-F6, rot/gruen in `tests/etappe2.sh`; Bericht an den Koordinator 16:52.

| Saat | Runde 2 | Runde 3 | Runde 4 | Zuendung |
|---|---|---|---|---|
| s1 | 421 Mrd | 1,09 Bio | 26,3 Bio | 9,5 h |
| s2 | 416 Mrd | 950 Mrd | 23,2 Bio | 9,5 h |
| s3 | 423 Mrd | 1,18 Bio | 36,9 Bio | 9,5 h |

24-h-Laeufe, 0 Fehler, 3,1-3,6 exec je Zyklus.

## Etappe 3 (im selben Code, nur mit data/corp-config.txt {"etappe":3})

| Teil | Regel |
|---|---|
| Zuendung | Minimum der letzten 30 Zyklusbewertungen >= 1e15 (`igniteV`), nach Runde 4. `ipoEarly` erlaubt den Boersengang schon nach Runde 3, wenn Geld angefordert ist. |
| Boersengang | goPublic(0) und Verkauf im selben Einmal-Skript (corp-act-cash.js, 71,6 GB). Vergleich privat/oeffentlich steht im Log und in fin.ipo. |
| Ziel | Frische Anforderung data/corp-geld.txt `{"betrag","ts","von"}` (2 h gueltig) ersetzt die Vorgabe; dazu immer mindestens data/geldbedarf.txt. Vorgabe ohne Anforderung: bn4rep.json preis x Summe 1,9^k (k = offen, hoechstens 10) + `graftGeld`, gedeckelt `defaultCap` (1e15). |
| Verkauf | Verkauft wird (Ziel - Spielergeld) x 1,1 ab 1e9. Je Verkauf hoechstens `maxPart` 10 % der Anteile; `keepFrac` 5 % bleiben; Sperre 1 h ergibt stuendliche Tranchen. |
| Vorhersage | Exakt nachgebautes calculateShareSale samt Zaehler bis zur Preisstufe, den corp.js selbst mitfuehrt. |
| Bestechung | Erst nach dem ersten Verkauf; Bewertung >= 1e14 und Kasse >= `bribeMinFunds` (1e15). Je Durchgang hoechstens `bribeShare` 5 % der Kasse, je Faktion offenJeFaktion.fehlt x 1e9 x 1,02, dieselbe Faktion fruehestens nach 20 min, nie Bladeburners. |

Tests (`tests/etappe3.sh`), alle wie erwartet:

| Test | Ergebnis |
|---|---|
| Z Glaettung | mit Fix min30 1,2e15; ohne Fix IPO bei 10,0 h auf einer Spitze, min30 5e13 |
| R Bestechung nach Verkauf | rot ohne Fix, gruen mit Fix |
| K Vorhersage | ohne Fix bis 110 % daneben, mit Fix 0 |
| A Anforderung | 2e13 ab 13 h: Verkaeufe 13,2/14,2 h je 22 Bio, danach wieder die Vorgabe |
| E Einbau 11,6 h + 13,3 h | 9 Tranchen, 0 Fehler |
| B Bladeburners | 0 Ruf; das Spiel lehnt ohnehin ab |

# Corp-Gewerk BN3, Stand 06.10.2026 16:22 (Systemzeit)

## Nachtrag 16:22: Pruefungen Etappe 2 GRUEN (tests/etappe2.sh)

Pruefungen:
- Uebergang live -> Etappe 2: Schalter bei 1,5 h, mit und ohne Neustart mit altem Zustandsformat. Ergebnis wie ohne Schalter, 0 Fehler. Live-Commit a28ed02 ist dateigleich mit bau/src (vor den Aenderungen von 16:20).
- Neustart vor Runde 2 (3,0005-3,05 h): Runde 2 bringt 322 statt 393 Mrd; Zuendung 11 h wie ohne Neustart.
- Neustart vor Runde 4 (9,06-9,1 h): ohne Einbusse, 16,1 Bio.

Saaten mit aktuellem Code (24 h, tests/out/E2F_s*.json):

| Saat | Runde 2 | Runde 3 | Runde 4 | Zuendung (V >= 1e15) | 24 h | Fehler |
|---|---|---|---|---|---|---|
| s1 | 393 Mrd | 640 Mrd | 16,1 Bio | 11 h | V 4e103 | 0 |
| s2 | 388 Mrd | 887 Mrd | 18,6 Bio | 9,5 h | V 6e103 | 0 |
| s3 | 392 Mrd | 632 Mrd | 11,8 Bio | 10,5 h | V 5e103 | 0 |

Referenz C4B_KF: Zuendung 10-12 h, Runde 4 bringt 23-134 Bio.

Neue Aenderungen in bau/src/corp.js (16:20, NICHT live):
- Tee/Feier im Ausgabenstopp erst ab 15 Punkten Abfall statt 2.
- Nach jedem Start 11 beobachtete Zyklen bis zur naechsten Rundenannahme.


Pause auf Ansage (Rechner geht aus). Es laeuft kein Simulatorlauf mehr. Die Laeufe von 06:2x hat
der Ruhezustand beendet; nur Saat 1 jeder Variante ist fertig geworden.

## Etappe 1: LIVE
Commit a28ed02, eingespielt, Corp gegruendet 16:12:56, corp.js auf fulcrumtech.
Skeptiker-Fixes B1/E2/E3 sind drin, Nachweis rot/gruen mit `tests/skeptiker-e1.sh`:

| Test | Ohne Fix | Mit Fix |
|---|---|---|
| T1 Ausgabenstopp | Stillstand, fundingRound 0 | Runde 1 bei 0,75 h mit 131 Mrd |
| T2 Zustandsverlust | Runde 2 als "Runde 1" angenommen | korrekt bei Runde 1 |
| T3 Herzschlag | 1 frischer Block | 10 frische Bloecke |

## Etappe 2: Code fertig in bau/src, gesperrt per Schalter
Freischalten mit `data/corp-config.txt` = `{"etappe":2}`. Die Datei wird alle 30 Zyklen gelesen.
Ohne die Datei verhaelt sich der Bot wie Etappe 1.

Inhalt:
- Chemical nach Runde 2.
- Tobacco-Produkte nach corpsim productTick (Anteile SH_B): Wilson, Werbung, Hauptbuero +15, Upgrades, Nebenbueros 60 %, Agri/Chem mitziehen, Boosts.
- Forschung mit Market-TA.I/II zuerst; danach setzt corp-tickp.js setProductMarketTA2, das Spiel rechnet den Preis.
- Vorher Produktpreis "lagK" als "MP+x", nur aus getProduct.
- Produktionsgrenze nur bei Lager > 80 %.
- Exporte als stehende Ausdruecke "X-IINV/10"; neu gesetzt nur bei > 10 % Aenderung; gebucht erst nach Erfolg.
- Runden 2-4 nach ROUND_HOURS [0.5, 2.5, 4.5, 8.5], dazu roundReady (Runde 2: RP Agri 700/Chem 390 oder +0,5 h; Runden 3/4: 2/3 fertige Produkte oder +1 h).
- F3-Stopp und Restaurant-Dummies vor Runden.

Neue Skripte (RAM aus Spielrechner = tools/ram.js):

| Skript | RAM |
|---|---|
| corp-tickp.js | 71,6 GB |
| corp-act-prod.js | 41,6 GB |
| corp-act-route.js | 41,6 GB |
| corp.js | 75,1 GB |

Stellschrauben in corp-config.txt:

| Schluessel | Wirkung |
|---|---|
| maxRound | letzte anzunehmende Runde |
| roundHours | Rundenzeitpunkte |
| roundMin | Mindestbetraege je Runde |
| shares | Anteile je Ausgabeposten |
| taMult | RP-Faktor fuer Market-TA |
| researchMult | RP-Faktor fuer sonstige Forschung |
| supRatio | Nebenbueros relativ zum Hauptbuero |
| chem | Chemical an/aus |
| dummies | Dummy-Divisionen an/aus |
| r2rp | RP-Bedingung vor Runde 2 an/aus |
| noFix | NUR fuer Tests |

## Getestet (24 h, NUR Saat 1, tests/out/E2A_s1.json, E2B_s1.json)

E2A = Vorgabe, E2B = `r2rp:false`.

| | Runden | Bewertung 10 h | Bewertung 12 h | 24 h | Fehler |
|---|---|---|---|---|---|
| E2A | 0,5 h 129 Mrd; 3,0 h 393 Mrd; 4,65 h 640 Mrd; 9,08 h 16,0 Bio | 7e14 | 6,9e17 | Gewinn 6e97/s (TA2-Deckel) | 0 |
| E2B | 2,5 h 320 Mrd; 4,5 h 592 Mrd; 9,08 h 7,7 Bio | 2,2e14 | 8,7e13 | 1,4e98/s | 0 |

Referenz C4B_KF (Saat 1): Runde 2 = 396 Mrd bei 2,5 h, Runde 4 = 23,4 Bio bei 8,5 h, Zuendung 10-12 h.

Lesart:
- Die Zuendung liegt im Rahmen.
- Durch TA.II im Spiel erreicht der Bot den 1e98-Deckel statt des lagK-Plateaus (~1e22).
- Die Runde-2-Regel mit RP-Bedingung (E2A) verschiebt Runde 2 auf 3,0 h und bringt trotzdem mehr.

## Offen / naechster Schritt
1. Saaten 2 und 3 fuer E2A neu rechnen (die vorhandenen s2/s3-Dateien stammen aus altem Code, 06:14):
   `CORP_TAG=E2A CORP_CFG='{"etappe":2}' CORP_SEEDS=1,2,3 CORP_HOURS=24 node node_modules/jest/bin/jest.js -c ../../nodes/corp-2026-10-05/bau/tests/jest.config.cjs -i botsim` (aus reference/v301, je Saat ~1-2 min).
2. Neustart-Probe Etappe 2: CORP_RESTART=2.4,2.6 (im Stopp vor Runde 2) und 8.9,9.0.
3. Pruefen, dass die live eingespielte Etappe 1 nahtlos in Etappe 2 uebergeht: Zustand ohne research/routes/seen; die Felder werden im Planner mit ??= gesetzt.
4. Dann Bericht an den Koordinator. Danach Etappe 3: Zuendung, IPO + Verkauf nach Bedarf, Tranchen, Bestechung.
5. Weiter offen aus der Skeptiker-Runde E1: (4) Platz nach Einbau, (9) Praktikanten, (11) Host-Cache.

Hinweis: Der Koordinator hat in corp.js TELEMETRY_PATH ergaenzt; bau/src/corp.js ist gleichgezogen.
