# P2b-B: Was ist ein Dollar am Tor wert?

Stand 2026-10-04 (Systemzeit 08:2x bis 09:xx, Live-Snapshot 08:24:25). Pruefer: Subagent
P2b Aufgabe B. Streng lesend: `src/` unveraendert, nichts committet, im Spiel nur
`getFile`/`getSaveFile` gelesen (`instance=LIVE`). Geschrieben nur `tools/audit/gang-p2b-*.mjs`
und diese Datei.

Rechner (alle in `tools/audit/`):

| Datei | Inhalt |
|---|---|
| `gang-p2b-geldwert.mjs` | Hauptprogramm, Abschnitte 1-6 (`--abschnitt N`, `--live [s]`, `--backtest <Spielstand>`) |
| `gang-p2b-lib.mjs` | Helfer: **importiert die echte `waehleTorRunde`** aus `src/lib/einbau.js` (rein, ohne ns), Kandidatenbau wie `bn4rep.js:831-844, 1661-1670`, Strahlsuche als Gegenprobe |
| `gang-p2b-stunden.mjs` | Vorwaertsrechnung BN2.1 und das Frisch-Knoten-Modell des G01-Substanz-Pruefers (unveraendert uebernommen) |
| `gang-p2b-snapshot.mjs` | Live-Messwerte 08:24:25 (Stufen, exp, Mults, Fertigkeiten, Gang-Mitglieder) und die Bot-Soll-Werte `boChancen` |

Gesamtlauf: `node tools/audit/gang-p2b-geldwert.mjs` (unter 3 s; `--live 120` misst das Einkommen zusaetzlich 120 s lang).

## Kurzurteil

| Frage | Ergebnis | Art |
|---|---|---|
| Stimmt die Rundenwahl-Nachrechnung? | Ja, an **fuenf** unabhaengigen Werten geeicht (Abschnitt 1): Preisformel auf 1e-14, die sieben tatsaechlich gekauften Stuecke, Live-Telemetrie 08:19 auf den Dollar (6.017.688.000), zwei Log-Planzeilen (625,80m und 4,02b) | GEEICHT |
| Was brachte die Runde 07:04? | Geld am Tor **<= 74,54 Mrd** (Konto 4,34 + Ausgabe 70,20), gekauft 7 Stuecke fuer 70,200 Mrd, Competence **x1,616**. Mit x2/x5/x10/x100 des Geldes: x1,800 / x2,111 / x2,441 / x3,068 | GERECHNET |
| Was haben die fuenf Vorkaeufe gekostet? | Preisfaktor 1,9^5 = 24,76 auf die Runde: dasselbe Gesamtgeld (92,5 Mrd) haette **x2,819** statt der tatsaechlichen **x2,012** gebracht = **Faktor 1,40** Competence | GERECHNET |
| Wert eines Dollars (frischer Knoten, Ruf >= 1,25 Mio, q0 = 0) | Grenzertrag **0,067 ln je Mrd bei 5-10 Mrd, 0,014 bei 10-40, 0,0046 bei 40-75, 0,0031 bei 75-150, 0,0017 bei 150-300, 0,0004 bei 600-1200 Mrd**. Kein Wendepunkt, aber jedes Verdoppeln bringt nur noch ~+0,25 ln (x1,3) | GERECHNET |
| Wert in Stunden, **BN2.1 Tor 2** | **0 h.** Der Ausgang liegt in allen gerechneten Szenarien bei +2,3 bis +5,7 h ab 08:24 (10:45-14:05 Uhr; neu gerechnet ab 09:17: Ausgang 10:23-12:33, Rang 400.000 zwischen 10:18 und 12:10), Tor 2 oeffnet fruehestens bei +10,8 h (~19:15). Selbst ein Rangwachstum von nur 15 % des beobachteten reicht | GERECHNET + ANGENOMMEN (Rang) |
| Was war die Runde 07:04 fuer den Ausgang von BN2.1 wert? | **0,27 bis 1,05 h** (Untergrenze) fuer 70,2 Mrd | GERECHNET + ANGENOMMEN (Rang) |
| Wert in Stunden, **BN2.2/2.3 erstes Tor** | Aus 36 Mrd: +47 Mrd (= 1e6 $/s ueber 13 h) bringen **+1,6 h (1,2-1,8)**; aus 75 Mrd **+0,7 h (0,5-0,8)**. Staerkere Stroeme sind mit dem heutigen Gang gar nicht erreichbar (Obergrenze **4,05 M$/s**) | GESCHAETZT (Modell des Vorpruefers) |
| Bester Weg zu mehr Geld am Tor | **Respekt-Modus (Terrorism) bis Ruf 1,25 Mio, danach Human Trafficking**: +63 Mrd am Tor, **+1,0 bis +1,9 h je frischem Knoten** (Spanne 0,8-2,2) | GERECHNET + GESCHAETZT |
| Andere Senken | Nur Cloud-RAM am Knotenanfang hat Rueckfluss (Amortisation 18-19 min, Obergrenze ~2,7 Mrd). NFG am Tor ist schon ab Stufe +1 schlechter als das letzte Rundenstueck; Grafts sind je Mrd 5-9x besser als der Grenzertrag der Runde jenseits von 50 Mrd, kosten aber 1-1,6 h Spielerzeit je Graft (Stunden-Ertrag nicht gerechnet) | GERECHNET |

## 1. Eichung (Soll = unabhaengig bekannter Wert, Ist = Rechner)

Ausgabe von `node tools/audit/gang-p2b-geldwert.mjs --abschnitt 1`.

| Was | Soll | Ist | Abweichung |
|---|---|---|---|
| 1a Preisformel `Grundpreis x 1,9^(q0+i)`, teuerste zuerst, q0 = 5, die 7 gekauften Stuecke | `moneySourceA.augmentations` 07:05 minus 06:17 = **70,2000 Mrd** | 70,2000 Mrd | -2e-14 % |
| 1a BN2-Preismultiplikatoren | `AugmentationMoneyCost` in `BitNode.tsx` case 2 nicht gesetzt -> Vorgabe 1 (`BitNodeMultipliers.ts`); `AugmentationRepCost` ebenso; SF11 = 0 -> Faktor 1,9 | wie im Bot (`gatePriceStep(0)`) | - |
| 1b Rundenwahl 07:04 (q0 = 5, Ruf 0,49 Mio, Archangel, Reaper/Evasive 30/30) | gekauft: Bionic Arms, Bionic Spine, Augmented Targeting III, DermaForce, HemoRecirculator, INFRARET, LuminCloaking-V1 | **dieselbe Menge**, solange das Geld am Tor in [70,20; 74,40] Mrd liegt; Kosten 70,2000 Mrd | Menge gleich |
| 1c Rundenwahl 08:19:11 gegen `data/bn4rep.json` -> `torRunde.plan` (Geld 6.376.212.743, q0 = 0) | n 5, Kosten **6.017.688.000**, Zuwachs 1,697, erstes `Graphene Bionic Arms Upgrade`, 31 Kandidaten | n 5, Kosten **6.017.688.000**, Zuwachs 1,6975, gleiches erstes, 31 Kandidaten | 0 $ |
| 1c' Bot-Log 07:35 | "3 Stuecke fuer $625.80m, Competence x1.20 (Archangel)" | 3 Stuecke, Kosten 625,80m, Zuwachs x1,200 | 0 |
| 1c' Bot-Log 08:05 | "6 Stuecke fuer $4.02b, Competence x1.35 (Red Dragon)" | 6 Stuecke, 4016,64m, x1,352 | 0 (Zustand dazwischen aus zwei Staenden interpoliert - nur die Kostenzahl ist hart) |
| 1d Black-Op-Chance (`Action.ts:169-196`) gegen `blade.json` `boChancen` 08:24:25 (12 Werte, im Rechner) | z. B. Deckard 0,7790, Daedalus 0,0596 | identisch auf 4 Stellen | <= 4e-5 |
| 1d' dasselbe um 08:53:09 mit frischem Live-Spielstand und frischer Telemetrie (Scratch-Lauf, 9 Werte, nicht im Rechner) | Shoulder 0,5901, Daedalus 0,1087 | gleich | <= 1e-4 |
| 1e Stufe aus exp (`skill.ts`, BN2 Hacking x0,8), 5 Werte; Skillpunkte `floor((maxRank-3)/3+1)` | 439/473/965/374/336; 33.660 | gleich | 0 |
| 1e' Mults des Einbaus 07:05 -> 07:17: Produkt der 12 Stuecke x 1 NFG-Stufe | str 1,86558, def 2,00908, dex 2,91030, agi 1,36983, bbChance 1,11364 | gleich | <= 1e-14 |
| 1f Gang-Formeln gegen den Live-Gang (12 Mitglieder, Terrorism) | Respekt je Zyklus 995,345; Wanted 0,4989 | 995,346; 0,4989 | 1e-6 |
| 1f Faktionsruf je Spielsekunde | gemessen 232,7 (08:21-08:24) | 233,6 | 0,4 % (Fenstermittel gegen Momentwert) |
| 1g Bot-Tabellen gegen Spielquelle 3.0.2 | `BLACKOP_DATEN` (blade.js), `lib/blackops.json`, `COMBAT_AUGS` (hackaugs.js) | 0 Abweichungen | - |

**Rate gegen Bestand (Auftragshinweis).** Der Gang laeuft in Spielzeit gleich Wanduhr: `data/gang.json`
`playtime` und `ts` liefen im Fenster 08:21:13-08:24:57 beide 226,0 s; `storedCycles` des Gangs stand bei 9 (unter der
Verarbeitungsschwelle von 10, `Gang.ts:99-121`). Die 190-233 Ruf/s sind der Momentwert bei Favor 155; sie blaehen sich nicht
durch gestaute Zyklen auf. **Achtung fuer Fresh-Knoten:** Die Rufrate haengt am Favor (`1 + favor/100`, `Gang.ts:144-155`). Heute 2,55;
ein frischer Knoten hat bis zum ersten Einbau Favor 0, also nur 91,7 Ruf/s bei gleichen Mitgliedern.

## 2. Geld am Tor -> Competence-Zuwachs der Runde

Zuwachs = Verhaeltnis der Black-Op-Competence nach/vor der Runde (Gewichte der naechsten Black Op, effektive Stufen mit Reaper/Evasive,
Erfolgschance-Faktor) - **genau die Zielgroesse der Rundenwahl des Bots**. Zahlen aus `--abschnitt 2`.

### 2A Der Zustand 07:04 wie er war (q0 = 5, Ruf 0,49 Mio, Archangel) - Basis "heute" = 74,4 Mrd

| Geld am Tor | Mrd | Stuecke | Kosten Mrd | Zuwachs (Bot, gierig) | ln | Strahlsuche |
|---|---|---|---|---|---|---|
| x0,1 | 7,4 | 3 | 5,66 | x1,205 | 0,186 | x1,205 |
| x0,25 | 18,6 | 4 | 13,38 | x1,327 | 0,283 | x1,362 |
| x0,5 | 37,2 | 5 | 32,23 | x1,510 | 0,412 | x1,510 |
| **x1 (tatsaechlich)** | **74,4** | **7** | **70,20** | **x1,616** | 0,480 | x1,693 |
| x2 | 148,9 | 8 | 142,67 | x1,800 | 0,588 | x1,822 |
| x5 | 372,2 | 9 | 334,06 | x2,111 | 0,747 | x2,126 |
| x10 | 744,4 | 10 | 702,80 | x2,441 | 0,893 | x2,441 |
| x100 | 7444,1 | 13 | 5149,82 | x3,068 | 1,121 | x3,132 |

Zehnfaches Geld (744 Mrd) haette gegenueber dem tatsaechlichen Geld nur **x1,51** mehr Competence gebracht (2,441 / 1,616) -
Verdopplung +11 %, Verfuenffachung +31 %. Grund: Jedes Stueck verteuert alle billigeren um den Faktor 1,9, die Reihenfolge ist
"teuerste zuerst" (jede neue teure Aug schiebt alle billigeren eine Stufe hoch).

Die gierige Wahl liegt im Mittel 1-5 % unter der Strahlsuche (Breite 40, gleiche Kosten- und Zielfunktion): bei x1 4,8 % (x1,616 gegen
x1,693), bei x2 1,2 %, sonst 0-3 %. Das sind <= 0,05 ln - **kein Bauanlass**.

### 2B Dieselbe Lage ohne die fuenf Vorkaeufe (q0 = 0, Geld = Konto + 18,09 Mrd)

| Geld am Tor | Mrd | Stuecke | Zuwachs gegen "nichts gekauft" |
|---|---|---|---|
| x1 + 18,1 | 92,5 | 12 | **x2,819** (Strahl x2,834) |
| x0,25 + 18,1 | 36,7 | 10 | x2,504 |
| x0,5 + 18,1 | 55,3 | 11 | x2,695 |
| x2 + 18,1 | 167,0 | 13 | x2,996 |
| x5 + 18,1 | 390,3 | 14 | x3,236 |
| x10 + 18,1 | 762,5 | 15 | x3,560 |
| x100 + 18,1 | 7462,2 | 19 | x4,502 |

Die zwoelf tatsaechlichen Stuecke (5 Vorkaeufe + 7 Runde) brachten zusammen **x2,012 fuer 88,29 Mrd**; dasselbe Geld ohne Vorkaeufe **x2,819**.
Verlust durch den Preisfaktor 1,9^5: **x1,401 = ln 0,337**.

2E (Preisstufe): Gesamtgeld 92,5 Mrd, davon q0 der fuenf Vorkaeufe vorher (in der besten Reihenfolge, teuerste zuerst - die fuenf haetten so
9,93 statt der tatsaechlichen 18,09 Mrd gekostet): q0 = 0: x2,819, 1: x2,773, 2: x2,543, 3: x2,406, 4: x2,242, 5: x2,042.

### 2C Frischer Knoten (BN2.2/2.3), erstes Tor ~13 h nach Knotenstart

Analogon: Spielstand BN2.1 03.10. 19:01 (Kampfwerte 213/205/205/205, Hacking 383, Reaper 7, Evasive 6), keine Augs installiert, q0 = 0,
nur die Gang-Faktion hat Ruf, Gewichte Operation Typhoon. Zuwachs (Stuecke) je Geld und Ruf:

| Ruf \ Geld Mrd | 5 | 10 | 20 | 40 | 75 | 150 | 300 | 600 | 1200 |
|---|---|---|---|---|---|---|---|---|---|
| 0,10 Mio | x1,59 (9) | x1,68 (10) | x1,79 (11) | x1,89 (12) | x2,03 (13) | x2,11 (14) | x2,18 (15) | x2,31 (16) | x2,36 (17) |
| 0,25 Mio | x1,63 (9) | x1,73 (10) | x1,87 (11) | x2,10 (12) | x2,22 (13) | x2,40 (14) | x2,54 (15) | x2,67 (16) | x2,78 (17) |
| 0,50 Mio | x1,63 (9) | x1,84 (9) | x2,00 (11) | x2,52 (11) | x2,79 (12) | x3,02 (14) | x3,53 (15) | x3,78 (16) | x4,03 (17) |
| 0,75 Mio | x1,63 (9) | x1,95 (9) | x2,24 (10) | x2,70 (11) | x3,35 (12) | x3,92 (13) | x4,51 (14) | x5,01 (16) | x6,14 (16) |
| **1,25 Mio** | x1,63 (9) | x2,27 (9) | x2,61 (10) | x3,45 (11) | x4,05 (12) | x5,13 (13) | x6,57 (15) | x8,46 (16) | x10,82 (17) |
| 2,5 Mio / 5 Mio | gleich wie 1,25 Mio | | | | | | | | |

Grenzertrag bei ausreichendem Ruf (ln je Mrd): 5 Mrd: ln 0,488; 10: 0,821 (0,067/Mrd); 20: 0,961 (0,014); 40: 1,239 (0,014);
75: 1,399 (0,0046); 150: 1,635 (0,0031); 300: 1,883 (0,0017); 600: 2,135 (0,0008); 1200: 2,381 (0,0004); 2400: 2,670 (0,0002).
Saettigung (unbegrenztes Geld, Ruf 1e9): x93 mit allen 36 Stuecken fuer 2,1e17 $ - fuer jedes erreichbare Geld irrelevant.

**Rufbedarf (2F).** Hoechster Ruf-Bedarf aller Kampfstuecke ohne The Red Pill: 1,625 Mio (Graphene Bionic Spine Upgrade, wird erst ab ~1860 Mrd
gekauft). Bis 1200 Mrd Geld reicht **1,25 Mio** (SPTN-97, wird ab **8 Mrd** gekauft: x1,75 auf alle vier Kampfwerte und x1,15 Hacking).
Weitere Schwellen: Graphene Bone Lacings und CordiARC 1,125 Mio (gekauft ab 47/49 Mrd), NEMEAN 0,875 Mio (ab 170 Mrd), Synthetic Heart 0,75 Mio
(ab 43 Mrd), Photosynthetic Cells 0,5625 Mio (ab 22 Mrd), Bionic Arms 62,5k (ab 2 Mrd), DermaForce 15k (ab 1 Mrd).

**Empfindlichkeit gegen den Zustand am Tor (2G, Ruf 3 Mio):** Kampfwerte x0,5 / x1 / x2 / x4 aendern den Zuwachs bei 36 Mrd nur zwischen x3,06 und x3,37
(+-5 %); Reaper/Evasive 30/30 statt 7/6 heben ihn auf x3,55 (+10 %); Hacking x0,5 / x2 +-1-2 %. Die Kurve ist also kaum vom
Analogon abhaengig.

### 2D BN2.1 jetzt (q0 = 0, Live 08:24, Ruf bis Tor 2 ~8 Mio, Deckard)

5 Mrd: x1,625 (4 Stuecke); 10 Mrd: x1,997; 25: x2,855; 50: x4,156; 75: x4,716; 150: x6,043; 400: x7,413; 1000: x9,280. Das ist der Zuwachs, den Tor 2
bringen WUERDE - er wird in 5 mit dem Ausgang verrechnet und ist dort wertlos.

## 3. Rueckblick: die Runde vom 04.10. 07:04

- Konto 07:05 **4,34 Mrd**, Ausgabe der Runde **70,200 Mrd**, Geld am Tor also <= 74,54 Mrd; die Rundenwahl liefert dieselben 7 Stuecke fuer jedes
  Geld in [70,20; 74,40] Mrd.
- Davor lagen 5 Stuecke in der Warteschlange (18,09 Mrd, gekauft vor dem Kaufaufschub, bn4rep-Neustart 01:09), danach 12. Der Einbau 07:05 hat
  zusaetzlich **eine** NFG-Stufe gekauft (3,64 Mrd; Konto danach 0,03 Mrd).
- Mults der sieben Stuecke: str x1,615, def x1,739, dex x2,309, agi x1,304, Chance x1,000; der fuenf Vorkaeufe: str/def x1,144, dex x1,248, agi x1,040,
  Chance x1,114.
- Competence der Runde x1,616 (Archangel-Gewichte, effektive Stufen). Mit x2/x5/x10/x100 des Geldes: x1,800 / x2,111 / x2,441 / x3,068 (Tabelle 2A).
  Menge bei x2: zusaetzlich Bionic Legs; x5: nextSENS, SmartSonar; x10: HyperSight; x100: BLADE-51b Unibeam, Hyperion V2, The Black Hand.
- **Die Runde war durch die Vorkaeufe klein, nicht durch das Geld**: 2B (ohne Vorkaeufe) x2,819 gegen x2,012.

## 4. Einkommen des Spielers ohne Gang (Spielzeit)

Quelle `moneySourceB` (kumuliert seit Knotenstart), Differenzen je **Spielstunde** (`playtimeSinceLastBitnode`), `--abschnitt 4`:

| Fenster | Hacking Mrd/h | Sleeves | Krankenhaus | Summe positiv |
|---|---|---|---|---|
| Zyklus 2 Stunde 1 (19:17-20:17) | 3,87 | 0 | -0,08 | 4,31 |
| Stunde 5 (23:17-00:17) | 5,71 | 0 | -0,74 | 5,81 |
| Stunde 8 (02:17-03:17) | 9,36 | 0,01 | -0,39 | 9,40 |
| Stunde 11 (05:17-06:17) | 13,11 | 0,14 | -1,07 | 13,28 |
| letzte 48 min vor Einbau | 14,72 | 0,27 | -0,63 | 15,02 |
| **Mittel Zyklus 2 (11 h)** | **7,69 = 2,14 M$/s** | 0,04 | -0,45 | 7,93 |
| Zyklus 3 Stunde 1 (07:17-08:17) | 3,12 | **3,25** | -0,05 | 6,37 |

- **Die Rate waechst im Zyklus von 3,9 auf 15 Mrd/h** (Flotte, Hacking-Stufe) und faellt beim Einbau zurueck; es ist kein Lager, das sich
  leert. Der Zyklusmittelwert (2,14 M$/s) ist NICHT die Rate am Tor (4,09 M$/s in den letzten 48 min).
- **Zwei Live-Paare** (`--live`, nur `getSaveFile`; Spielzeit = Wanduhr in beiden): 08:36-08:39 (150,6 s Spielzeit): Hacking **1,72 M$/s (6,2 Mrd/h)**, Sleeves **1,46 M$/s (5,25 Mrd/h)**,
  Konto netto 3,14 M$/s. 09:19-09:23 (240,4 s): Hacking **2,20 M$/s (7,9 Mrd/h)**, Sleeves **0,36 M$/s (1,3 Mrd/h)**, Server -0,02, Konto netto **2,53 M$/s**.
  Die Sleeves (Bladeburner-Vertraege Retirement/Bounty Hunter; 762 und 518 Aufgaben, Stand 08:43) verdienen **klumpig** (0,36 bis 1,46 M$/s) - im Zyklus 2 fast nichts. Das gehoert nicht zum Gang.
  Einkommen des Spielers ohne Gang heute also **2,5 bis 3,1 M$/s netto** (Zyklus 3, Stunde 2-3), Konto 17,2 Mrd um 09:23.
- Geld am Tor Zyklus 2 (moneySourceA 07:05): Einnahmen 99,48 Mrd (Hacking 96,45 + Sleeves 0,80 + Hacknet 0,25 + Vertraege 1,15 + Bladeburner 0,84), Ausgaben Server 1,09,
  Krankenhaus 5,47, sonstiges 0,29, Augmentierungen 88,29 -> Konto 4,34 + 88,29 Aug-Ausgaben = **92,6 Mrd verfuegbar**, wenn nichts vorher gekauft worden waere (Tabelle 2B rechnet mit 92,5).
- Frischer Knoten (Zyklus 1 BN2.1, 14,3 h): Einnahmen 65,8 Mrd, Server -22,5 (Aufbau!), Krankenhaus -7,0 -> **36,0 Mrd** am Tor (15,6 Konto + 20,4 Aug-Ausgaben).

## 5. Von der Competence zu den Stunden

### 5A BN2.1: Ausgang gegen Tor 2 (Vorwaertsrechnung ab 08:24)

Stand: Rang 100.983, 9 von 21 Black Ops (Deckard offen), 1,31 h seit dem Einbau. Tor 2 oeffnet fruehestens **+10,82 h** (`data/einbau-uhr.json`: Ende
des Wiederaufbaus 3.933.518.800 + max(12 h, 2 x 8,1 min) gegen totalPlaytime 3.937.761.200; ~19:16).

Das Modell: Stufen aus exp (exp-Raten = Messung 08:17-08:24: str/def 105.808, dex/agi 208.061 je Stunde), Fertigkeiten aus Skillpunkten
(= Rang/3), Black-Op-Chancen mit dem eichten `Action.ts`-Nachbau, Kette in Spielreihenfolge mit den Schwellen des Bots (0,90 bis Rang 400k, danach 0,40;
`blade.js` `blackOpSchwelle`), Dauer je Versuch aus `getActionTime` x1,5 / Chance. **Der Rang ist eine ANNAHME** `Rang0 x exp(gamma t)`: Aktionsstufen, Raid-Vorrat und
Ausdauer sind nicht nachgebaut. Beobachteter Rangverlauf (Spielstaende und `blade.json`): 50.836 (07:17), 91.134 (08:17), 100.983 (08:24:25), 127.404 (08:43), 138.566 (08:52:46), 150.034 (08:58:27), 179.480 (09:17), 179.522 (09:17:56) - Log-Wachstumsrate gamma 0,62/h (07:17-08:24), 0,90/h (08:17-08:24), 0,84/h (08:53-08:58), 0,55/h (08:58-09:17); absolut ~70-120k Rang/h.

| gamma | exp-Rate | Fertigkeiten | Rang 400k | Ausgang | vor Tor 2 (+10,8 h) |
|---|---|---|---|---|---|
| 0,28/h (BN4.3/BN9.3) | jetzt | sqrt | +4,9 h | **+5,5 h** | ja |
| 0,28/h | Zyklus-2-Mittel (6x kleiner) | sqrt | +4,9 h | **+5,7 h** | ja |
| 0,50/h | jetzt | sqrt / greedy | +2,8 h | +3,4 h / +2,8 h | ja |
| 0,80/h | jetzt | sqrt / greedy | +1,7 h | +2,3 h / +1,8 h | ja |

Spaetester Ausgang in 12 Szenarien: **+5,7 h = ca. 14:05 Uhr**. Rueckpruefung 5H: die Rechnung ist eher zu langsam als zu schnell (nach 0,89 h 12 statt 14 Black Ops). Kritische Rangwachstumsrate (schlechteste Annahmen): **0,137/h**, also 15 % der beobachteten
0,90/h und 49 % der Rate frueherer Knoten. **Folge: Tor 2 wird in BN2.1 nie gebraucht, und Geld dafuer ist wertlos.** Falls der Ausgang bis 19:16 wider Erwarten nicht erledigt ist, schuetzt `einbauErlaubt` den Knoten nur bei "Ausgang offen" oder sicherer Restzeit < 186 min
(`lib/endspurt.js`) - ein Einbau mit Wiederaufbau waere dann der Verlust, nicht der Gewinn.

Rueckpruefung der Rechnung (5H, `--backtest <Spielstand>`): vom Snapshot 08:24 mit dem beobachteten Rang bis zu einem spaeteren Stand, berechnet gegen gemessen.
Nach 0,48 h (Live 08:53:09) und nach 0,886 h (Backup 09:17, Rang 100.983 -> 179.480, beobachtetes gamma 0,65/h):

| Groesse | Spielstand 0,48 h | sqrt | greedy | Spielstand 0,886 h | sqrt | greedy |
|---|---|---|---|---|---|---|
| Stufe str / dex | 515 / 1073 | 495 / 1065 | 495 / 1065 | 557 / 1140 | 526 / 1121 | 526 / 1121 |
| Reaper / Evasive | 80 / 81 | 70 / 71 | 67 / 68 | 100 / 103 | 79 / 81 | 85 / 85 |
| Blade's Intuition / Digital Observer | 60 / 63 | 57 / 62 | 85 / 89 | 68 / 71 | 65 / 70 | 104 / 108 |
| Chance Daedalus | 0,1087 | 0,0907 (-17 %) | 0,1497 (+38 %) | 0,1713 | 0,1268 (-26 %) | 0,2632 (+54 %) |
| Black Ops erledigt | 12 | - | - | 14 | 12 | 16 |

Die Wirklichkeit liegt zwischen den beiden Fertigkeitenregeln, naeher an "sqrt" (der vorsichtigen). Der Bot kauft mehr Reaper/Evasive und weniger Blade's Intuition/Digital Observer,
als "greedy" annimmt. Die exp-Rate des Snapshots unterschaetzt die Stufen um 2-6 % (die Rate steigt mit den Aktionsstufen). Die Aussage "Ausgang vor Tor 2" gilt fuer beide Regeln und
ist damit nicht von der Fertigkeitenwahl abhaengig.

**Neu gerechnet ab 09:17** (Rang 179.480, 14 Black Ops, Tor 2 in 9,9 h = 19:13, exp-Raten 08:17-09:17: str 165.271, dex 243.632 je Stunde; `--von 2026-10-04T09-17_hourly --vorher 2026-10-04T08-17_hourly`):

| gamma | Fertigkeiten | Rang 400k | Ausgang |
|---|---|---|---|
| 0,28/h | sqrt / greedy | +2,9 h = 12:10 | +3,3 h = 12:33 / +3,0 h = 12:15 |
| 0,5/h | sqrt / greedy | +1,6 h = 10:54 | +2,0 h = 11:17 / +1,7 h = 10:59 |
| 0,8/h | sqrt / greedy | +1,0 h = 10:18 | +1,4 h = 10:40 / +1,1 h = 10:23 |

### 5B Was die Runde 07:04 fuer BN2.1 wert war (Mults der 7 Stuecke herausgerechnet, gleiches gamma)

| gamma, Fertigkeiten | mit Runde | ohne Runde | gespart |
|---|---|---|---|
| 0,28, sqrt | +5,52 h | +6,57 h | **1,05 h** |
| 0,28, greedy | +5,00 h | +5,27 h | 0,27 h |
| 0,5, sqrt | +3,36 h | +4,08 h | 0,72 h |
| 0,5, greedy | +2,84 h | +3,16 h | 0,32 h |
| 0,8, sqrt | +2,29 h | +2,79 h | 0,50 h |
| 0,8, greedy | +1,82 h | +2,11 h | 0,29 h |

Untergrenze (der Rang waechst in Wahrheit mit besseren Kampfwerten schneller): **16 bis 63 min fuer 70,2 Mrd**, also 0,23 bis 0,90 Minuten je Mrd.

### 5C Ein spaetes Tor in BN2.1 (falls der Ausgang doch spaeter kaeme)

Kampf-Mults sofort um k^(1/0,8): k = x1,2 spart 0,11-0,15 h, x1,6 0,26-0,30 h, x2 0,33-0,45 h, x3 0,51-0,56 h, x5 0,53-0,58 h, **x10 0,54-0,59 h**.
Saettigung bei ~0,6 h: der Ausgang haengt am Rang 400.000 (Endspiel), nicht mehr an der Chance. Ein Wiederaufbau ist dabei NICHT abgezogen -
er wuerde den Gewinn auffressen.

### 5D Frischer Knoten: gesparte Stunden bis Rang 25k/30k (Modell des G01-Substanz-Pruefers)

`verify-g01-substanz-phase1.mjs` unveraendert uebernommen (Parameterband a 0,42-0,57, gs 0,042-0,08, beta 0,8-1,25), auf eine k-Reihe gelegt. **GESCHAETZT, nicht
geeicht**, ohne Kappung bei Chance 1 - oberhalb k ~ 4 ist es eine obere Schranke:

| k | bis 25k min / Mittel / max | bis 30k |
|---|---|---|
| x1,5 | 2,9 / 3,8 / 4,9 h | 3,2 / 4,1 / 5,3 |
| x2 | 4,8 / 6,2 / 7,8 | 5,3 / 6,8 / 8,5 |
| x3 | 7,2 / 8,9 / 10,8 | 7,8 / 9,8 / 12,0 |
| x4 | 8,5 / 10,5 / 12,6 | 9,2 / 11,6 / 14,1 |
| x6 | 9,7 / 12,2 / 14,6 | 10,6 / 13,5 / 16,6 |
| x10 | 10,7 / 13,7 / 16,6 | 11,7 / 15,3 / 19,0 |

Die Ersparnis waechst etwa mit ln(k) und flacht ab (+3,2 h von x4 auf x10, im Mittel).

### 5E Stunden je zusaetzlichem Gang-Dollar-Strom (frischer Knoten, erstes Tor 13 h, Ruf 3 Mio, q0 = 0)

Obergrenze des heutigen Gangs: **4,05 M$/s** (12 Mitglieder, Stufen 08:24, alle auf Human Trafficking, Territorium 1/7; `moneyGain` geeicht ueber
dieselben Formeln, die `respectGainRate` auf 6 Stellen treffen).

| Basis am Tor | Strom | +Geld | Geld | Stuecke | k | h bis 25k (min/Mittel/max) | zusaetzlich gespart |
|---|---|---|---|---|---|---|---|
| 36 Mrd | 0 | 0 | 36 | 11 | x3,21 | 7,6 / 9,3 / 11,3 | - |
| | 1e6 $/s | 47 | 83 | 12 | x4,36 | 8,8 / 10,9 / 13,0 | **+1,6 h (1,2-1,8)** |
| | 2e6 | 94 | 130 | 13 | x5,13 | 9,3 / 11,6 / 13,8 | +2,3 h (1,7-2,6) |
| | 4e6 | 187 | 223 | 14 | x5,96 | 9,7 / 12,1 / 14,5 | +2,8 h (2,1-3,3) |
| | 1e7 | 468 | 504 | 15 | x8,40 | 10,4 / 13,2 / 16,0 | +3,9 h (2,8-4,7), nicht erreichbar |
| | 1e8 | 4680 | 4716 | 19 | x17,13 | 11,3 / 14,7 / 18,2 | +5,4 h, nicht erreichbar, Modell ueber Gueltigkeit |
| | 1e9 | 46800 | 46836 | 22 | x40,73 | 11,7 / 15,6 / 19,7 | +6,3 h, dito |
| 75 Mrd | 0 | 0 | 75 | 12 | x4,05 | 8,5 / 10,5 / 12,6 | - |
| | 1e6 | 47 | 122 | 13 | x4,76 | 9,1 / 11,2 / 13,5 | **+0,7 h (0,5-0,8)** |
| | 2e6 | 94 | 169 | 13 | x5,83 | 9,6 / 12,1 / 14,4 | +1,5 h (1,1-1,8) |
| | 4e6 | 187 | 262 | 14 | x6,51 | 9,9 / 12,4 / 14,9 | +1,9 h (1,4-2,3) |
| | 1e7 / 1e8 / 1e9 | | | | | | +2,7 / +4,2 / +5,1 h, nicht erreichbar |

Die Zeile 1e7 bis 1e9 ist **kein Planwert**: mit dem heutigen Gang gibt es sie nicht, und das Modell ist dort ausserhalb seiner Eichung (Chance 1 kappt).
Der Verlauf zeigt die abnehmenden Ertraege: bei 1e6 / 2e6 / 4e6 $/s sind 25 / 37 / 44 % (Basis 36 Mrd) bzw. 14 / 29 / 37 % (Basis 75 Mrd) der Modell-Obergrenze (1e9 $/s) erreicht; jede Verdopplung des Stroms bringt +0,5 bis +0,8 h.

### 5F Tauschkurs Respekt <-> Geld im Gang (12 Mitglieder, Stufen 08:24)

| Aufgabe | Respekt/s | Ruf/s Favor 0 | Ruf/s Favor 155 | Geld $/s | Wanted/s |
|---|---|---|---|---|---|
| Terrorism | 4977 | 91,7 | 233,6 | 0 | 2,49 |
| Human Trafficking | 590 | 10,9 | 27,7 | **4.051.289** | 1,58 |
| Traffick Illegal Arms | 42 | 0,8 | 2,0 | 2.336.374 | 0,49 |

Terrorism -> Human Trafficking: 81 Ruf/s weniger (Favor 0) gegen 4,05 M$/s mehr = **1 Ruf kostet im Gang 50.124 $** (mit Favor 155: 19.681 $).

Wert eines Rufpunkts am Tor (frischer Knoten): (d ln k / d Ruf) / (d ln k / d Geld):

| Geld am Tor | Ruf 0,25-0,75 Mio | Ruf 0,75-1,25 Mio | Ruf 1,25-3 Mio |
|---|---|---|---|
| 36 Mrd | 55.202 $ (1,1x Tauschkurs) | 76.512 $ (1,5x) | 0 |
| 75 Mrd | 262.109 $ (5,2x) | 120.919 $ (2,4x) | 0 |
| 150 Mrd | 590.829 $ (11,8x) | 326.208 $ (6,5x) | 0 |

Unter 1,25 Mio Ruf ist ein Rufpunkt mehr wert als die Dollar, die der Gang dafuer abgeben muesste (knapp bei 36 Mrd, deutlich ab 75 Mrd); darueber ist er wertlos.

### 5G Die Kombination: Respekt bis 1,25 Mio, dann Geld

Gemessene Ruf-Kurve des echten Gangs (gegruendet 04.10. 01:01:41, Favor 0 bis zum Einbau): 12,6k (2,3 h), 56k (3,3 h), 141k (4,3 h), 329k (5,3 h), 510k (6,07 h).
Extrapolation: 1,25 Mio nach **~8,7 h** (Rate waechst ~+40k/h je Stunde; Simulation des Vorpruefers 8,5 h). Bis zum Tor bei 13 h bleiben 4,3 h:
4,05 M$/s x 4,3 h = **63 Mrd** zusaetzlich; der Ruf waechst in dieser Zeit mit 11/s weiter und liegt am Tor bei ~1,42 Mio (genug).

| Basis | Geld am Tor | Stuecke | k | h bis 25k | gegen Basis |
|---|---|---|---|---|---|
| 36 Mrd | 99 Mrd | 12 | x4,71 | 9,0 / 11,2 / 13,4 | **+1,9 h (1,4-2,2)** |
| 75 Mrd | 138 Mrd | 13 | x5,13 | 9,3 / 11,6 / 13,8 | **+1,0 h (0,8-1,2)** |

## 6. Andere Geldsenken in V2 (nur gerechnete)

- **6a NFG am Tor** (Preis 750.000 x 1,14^Stufe x 1,9^wartende, +1,000262 auf Hacking/Kampf je Stufe, nicht auf die Erfolgschance): im Zustand nach der Runde 07:04 (q = 12)
  kostet Stufe +1 **3,64 Mrd** fuer ln 0,0080 (0,00219 ln je Mrd); +2: 7,89 (kum. 11,54, 0,00138); +3: 17,09 (0,00083); +4: 37,03 (0,00049). Das letzte Rundenstueck
  (LuminCloaking-V1) kostete 5,82 Mrd fuer ln 0,0272 (0,00467 ln je Mrd). NFG +1 ist mit 0,0022 ln je Mrd schon halb so gut wie das letzte Rundenstueck, ab +2 weniger als ein Drittel; die Restgeld-Kaeufe des Bots (07:05: eine Stufe) sind richtig, ein Bauanlass besteht nicht.
- **6b Graft** (Preis 3 x Grundpreis ohne Warteschlangenfaktor, Zeit nach `GraftableAugmentation.ts`, Entropie -2 % auf alle Mults): auf dem Stand 08:17 zum Beispiel
  SPTN-97 x1,480 fuer 14,63 Mrd in 1,61 h (0,0268 ln je Mrd), Graphene Bionic Arms Upgrade x1,310 fuer 11,25 Mrd in 1,09 h (0,0240), Graphene Bionic Spine Upgrade
  x1,380 fuer 18,00 Mrd in 1,45 h. Je Mrd **5-9x besser als der Grenzertrag der Runde jenseits von 50 Mrd** (0,024-0,027 gegen 0,003-0,005 ln je Mrd); begrenzt durch Spielerzeit (1-1,6 h je Graft) und Entropie.
  Ein Stunden-Ertrag ist NICHT gerechnet (AUG-1/2 im Audit). Im Gate wuerde SPTN-97 an Position 12 rund 10,8 Bio kosten.
- **6c Cloud-RAM** (`tools/audit/infra-deckel.mjs`, Ausgabe uebernommen, nicht neu gerechnet): Deckel 600 s -> 1800 s bringt +3,67 bis +7,09 Mrd/h fuer 1,14-2,15 Mrd
  einmalig, Amortisation der Differenz 18-19 min; die freie Aufnahme der Geldziele (17.854 GB) begrenzt die Senke auf ~2,7 Mrd. Gehoert an den Knotenanfang.
- Nicht gerechnet: Hacknet/Hashes (G02: der Einbau loescht die Server), Spenden (Gang-Faktion: Ruf kommt aus dem Gang), Gang-Ausruestung (`gang.js` laesst sie bewusst aus).

## 7. Was daraus folgt

1. **BN2.1: nichts bauen, Tor 2 nicht einplanen.** Der Ausgang liegt in jedem gerechneten Szenario bei +2,3 bis +5,7 h (10:45-14:05 Uhr), Tor 2 oeffnet 19:16. Geld
   hat dafuer keinen Wert. Pruefen: Rang 400.000 laut Neuberechnung ab 09:17 zwischen 10:18 und 12:10 Uhr, danach die Rest-Black-Ops (Ausgang 10:23-12:33); faellt gamma unter ~0,14/h, neu rechnen (`--von`).
2. **Frische Knoten (BN2.2/2.3): der Kaufaufschub von Beginn an ist die groesste Einzelschraube** - die fuenf Vorkaeufe haben Faktor 1,40 Competence gekostet
   (nach dem Modell 5D: 6,2 h bei x2,01 gegen 8,5 h bei x2,82 = **+2,3 h, Spanne 2,0-2,6**). Er ist gebaut; zu pruefen bleibt, dass im frischen Knoten zwischen Knotenstart und `createGang` nichts gekauft wird (in BN2.1 lagen die fuenf Vorkaeufe VOR der Gang-Gruendung; im frischen Knoten gibt es in den ersten Minuten noch keinen Ruf, also kaum Anlass - nicht nachgemessen).
3. **Gang-Regler: Respekt bis Slum-Snakes-Ruf 1,25 Mio, danach Human Trafficking** (Ausloeser nicht die Zeit, sondern der Ruf: `rep >= 1,25 Mio - 11/s x Restzeit`).
   Bringt am ersten Tor +63 Mrd und damit +1,0 bis +1,9 h je Knoten (Spanne 0,8-2,2), zwei Knoten also etwa +2 bis +4 h. Grenzen: GESCHAETZT, nicht
   in einer Gang-Simulation mit Geldmodus geprueft (die Mitglieder-Stufen waehrend Human Trafficking wachsen anders: Gewichte hack 30/dex 30/cha 30, nicht Kampf).
4. **Strom-Obergrenze 4,05 M$/s** mit den heutigen Mitgliedern; 1e7, 1e8, 1e9 $/s sind keine Planwerte. 1e6 $/s dauerhaft (3 von 12 Mitgliedern auf Human Trafficking) kostet
   ueber 13 h rund 0,95 Mio Ruf (20 Ruf/s) und ist deshalb schlechter als die Kombination in 3.
5. **Planer:** NFG-Kandidaten und die Strahlsuche bringen <= 5 % (<= 0,05 ln) - nicht bauen.
6. **Cloud-RAM-Deckel** am Knotenanfang (INFRA-3) ist die einzige Senke mit schneller Rendite; Gang-Geld braucht dafuer niemand.

## 8. Was nicht haelt und was offen bleibt

- **Der Rang in 5A ist angenommen, nicht gerechnet.** Die Aussage "Ausgang vor Tor 2" ruht auf gamma >= 0,137/h; beobachtet sind 0,55-0,90/h, in BN4.3/BN9.3 0,27-0,28/h.
  Nicht gerechnet: Teamverluste bei Fehlschlag, Ausdauerstrafe (Chance mit voller Ausdauer), Raid-Vorrat. Die Rueckpruefung 5H trifft die Chance auf -17 %/+38 % (nach 0,48 h) und -26 %/+54 % (nach 0,89 h) - die Rechnung ist ein Band, kein Punkt.
- **5D/5E (frischer Knoten) sind ein Modell des Vorpruefers, hier nur neu aufgelegt.** Es ist nur auf BN2.1 22:17 geeicht (Rang 7178, 435 Rang/h) und nicht auf die neue Lage
  (Rang ~4k am Tor, Gang-Runde). Bei k > 4 ohne Kappung. Die Zahlen +0,7 bis +1,9 h je Knoten haben realistisch +-50 %.
- Das erste Tor eines frischen Knotens kommt nach `max(12 h, 2 x Wiederaufbau)` ab Ende des Wiederaufbaus (in BN2.1 3,1 h gemessen, `kampfEinbauSperre`): 13-15 h, nicht
  genau 13. Basisgeld 36 Mrd (Zyklus 1 BN2.1) ist EIN Wert; Zyklus 2 hatte 92,5 Mrd.
- Fresh-Analogon: andere Faktionen ohne Ruf angenommen (vorsichtig); `BLADE-51b`-Stuecke aus den Bladeburners fehlen deshalb (<= +4 % je Stueck).
- Gang-Geldmodus nicht dynamisch gerechnet (Stufenwachstum der Mitglieder in Human Trafficking, Aufstiege, Wanted); die Obergrenze 4,05 M$/s ist der Momentwert der heutigen
  Mitglieder.
- Der Ruf-Bedarf von 1,25 Mio gilt fuer Geld bis ~1200 Mrd; ueber 1860 Mrd kaeme Graphene Bionic Spine Upgrade (1,625 Mio) dazu.
- Das Einkommen der Sleeves (0,36 bis 1,46 M$/s, klumpig) ist nur gemessen, nicht erklaert.
- Ob die Mitglieder eines frischen Gangs nach 8,7 h Stufen wie die heutigen nach 7,4 h haben (und damit 4,05 M$/s hergeben), ist plausibel (gleicher Code), aber nicht gemessen.
- Nicht verifiziert: dass der Bot im Gate wirklich die Rundenwahl-Eingaben liefert, die ich nachbaue (Telemetrie-Treffer 1c belegt es fuer q0 = 0 und 08:19).
