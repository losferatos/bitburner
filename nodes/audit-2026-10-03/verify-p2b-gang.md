# P2b: Gang-Strategie-Rechner (Geld, Ruf, Territorium, Ausruestung) - BN2.1, Slum Snakes live

Stand 2026-10-04 09:00 (Systemzeit). Pruefer: Subagent A (Paket P2b). Streng lesend: `src/`
unveraendert, Spiel nur ueber `getFile` / `getSaveFile` gelesen, nichts committet. Spielquelle 3.0.2.

Eigene Dateien: `tools/audit/gang-p2b-sim.mjs` (Rechner), `gang-p2b-calib.mjs` (Eichung),
`gang-p2b-live.mjs` (Schnappschuss aus Backup/Live), `gang-p2b-income.mjs` (Einkommen nach Quelle).
Aufgebaut auf `gang-formulas.mjs` (Einzelformeln, `gang-check.mjs`: 86.360 Vergleiche, 0 Abweichungen).

## Kurzurteil

1. **Die Gang-Dynamik ist jetzt an der echten Gang geeicht, nicht mehr "ungeeicht".** Mit dem ECHTEN Regler
   (`src/gang.js` per data-URL geladen) und den echten Mitgliederwerten aus den Backups reproduziert der Rechner
   Respekt, Faktionsruf und Wanted ueber 1-5 Stunden auf 0,00-0,04 %, alle 42 Aufstiege seit 03:17 (Zahl je Stunde gleich dem Log,
   Mitgliederstufen auf eine Stufe genau), den Einbau-Schritt (Favor 154,6826 exakt) und eine **ungesehene** 32-min-Vorhersage
   (08:12 -> 08:44) auf 0,03 %. Die Torrunde (echter Planer `waehleTorRunde`) trifft den Live-Plan des Bots auf den Dollar.
2. **Der heutige Regler (S0) laesst 10 von 11 Stunden Gang-Kapazitaet liegen.** Ruf R fuer die Torrunde ist
   **1.625.000 (Graphene Bionic Spine Upgrade) + 2 % = 1.657.500** und liegt bei ~09:11 vor; die restlichen ~10 h
   bis Tor 1 (19:13) erzeugt Terrorism nur Ruf, den niemand braucht (~17 Mio bei Tor 1 gegen 1,66 Mio Bedarf).
3. **S1 (Terrorism bis R, danach Human Trafficking) ist der grosse, billige Hebel:** 301 Mrd Gang-Geld bis Tor 1
   (30 Mrd/h im Mittel), Torrunde x7,42 statt x4,81, "G noetig" fuer ALLE offenen Black Ops 1,22 statt 1,87.
   Null Todesfaelle (konstruktiv), keine neue API. Der Geld-Absolutwert ist erst nach dem Umschalten messbar (Abnahme Abschnitt 8).
4. **S3 (S1 + Ausruestung Waffen/Ruestung/Fahrzeuge/Rootkits) ist der zweite, ebenfalls billige Hebel:** 4,4 Mrd
   Ausgabe, Geld x1,72 (52 Mrd/h im Mittel, 519 Mrd bis Tor 1), x8,41, G noetig 1,08. Die Begruendung "keine
   Ausruestung, weil das Geld die Augs brauchen" (Kopf von `gang.js`) ist widerlegt: 2,08 Mrd fuer die volle Ausruestung
   aller 12, Amortisation 9-15 min.
5. **Territorium (S2) ist rechenbar und wirkt stark** (Gang-Geld x3 gegenueber S3, 0 Tote in 20 Laeufen bei
   Kriegsabteilung k=6), **aber fuer den Torrunden-Wert nicht noetig:** der Planer saettigt (Preisfaktor 1,9 je Stueck),
   G noetig sinkt nur von 1,08 auf 0,92. Empfehlung: nicht bauen; als Stufe 2 erst nach S1+S3 und nur, wenn G sich als
   zu klein erweist.
6. **Reglerwerte (S4) sind fuer den Torrunden-Wert egal:** Training 300-700 aendert das Geld um < 0,3 %, Aufstiegsschwelle
   1,2/1,5 statt 1,3/2 bringt +18-23 % Geld, aber nur +2 % Competence. Gebaute Werte lassen.
7. **Was am Ende zaehlt, ist nicht das Geld, sondern "G noetig" und der Takt des Tors.** G (Competence-Wachstum aus
   anderen Quellen bis Tor 1) laeuft gerade sehr schnell (Daedalus-Chance 0,078 -> 0,102 in 13 min). Bei G >= 1,87 reicht
   schon S0; die Gang-Strategien kaufen Sicherheit (Faktor 1,5-1,7 weniger G noetig) und - wichtiger - machen eine fruehere
   Runde bezahlbar (Abschnitt 7). **Achtung:** der Parallelbericht `verify-p2b-geldwert.md` (Aufgabe B) rechnet den BN2.1-Ausgang auf +2,3 bis +5,7 h ab 08:24 -
   liegt er VOR Tor 1, hat der Umbau fuer BN2.1 selbst keinen Wert; der Nutzen liegt dann in BN2.2/2.3 (frischer Knoten, kompetenzbegrenzt). Das habe ich nicht nachgerechnet.

## 1. Eichung (Soll/Ist) - `node tools/audit/gang-p2b-calib.mjs --livefile <live.json> --log <gang-log.txt>`

| Pruefung | Soll (Spielstand) | Ist (Modell) | Abweichung |
|---|---|---|---|
| A. Momentanrate Respekt/Zyklus, 7 Staende mit Arbeit (03:17..Live; 01:17/02:17 haben Rate 0), echte Mitgliederwerte | `gang.respectGainRate` | `respectGain` aus `gang-formulas.mjs` | <= 0,067 % (Rest = ein Erfahrungsschritt nach dem Gewinn); 03:17 und 04:17 exakt |
| A. Wanted/Zyklus | `gang.wantedGainRate` | `wantedGain` | <= 0,067 % |
| B. Stundenspruenge 03:17>04:17, 04:17>05:17, 05:17>06:17, 06:17>07:05, 07:17>08:44 (Respekt, Rep, Wanted am Ende) | echt | echter Regler, Anfangszustand = Spielstand | 0,000 % in allen fuenf; Mitgliederstufen str: 0 Stufen Abweichung |
| B. Aufstiege je Stunde 03:17..06:17 | Log: 19 / 13 / 1 / 0 | Modell: 19 / 13 / 1 / 0 | gleich |
| C. Einbau 07:05 -> 07:17: Favor aus 509.596 Ruf | 154,6826 | `repToFavor(favorToRep(0)+rep)` | 0,0000 % |
| C. Rep nach 721 s, Respekt, Wanted, Aufstiege | 103.670 / 11.608.873 / 40.246 / 7 | 103.662 / 11.608.784 / 40.246 / 7 | -0,008 % / -0,001 % / 0 / 0 |
| D. Kette 03:17 -> Einbau -> Live 08:44 (5,45 h, ein Lauf, nichts nachgestellt) | Respekt 31.725.224, Rep 1.219.290, Wanted 54.622, 42 Aufstiege | 31.735.554 / 1.219.770 / 54.627 / 42 | +0,033 % / +0,039 % / +0,009 % / 0 |
| **Ausser Stichprobe**: Vorhersage 08:12:52 -> 08:44:36 aus dem Zustand von 08:12 | echt | Modell | Respekt +0,033 %, Rep +0,040 %, Wanted +0,009 % |
| E. Orchestrator-Messpunkte 07:32:56 / 07:34:41 (Respekt, Rep) | 13.310.568 / 269.539; 13.714.121 / 288.477 | 13.302.378 / 269.154; 13.705.840 / 288.089 | -0,06 % / -0,14 %: gang.json ist eine Runde (bis 2 s, ~8.200 Respekt) aelter als sein Zeitstempel |
| E. Uhr: gang.json Wanduhr gegen `playtime` | 2.032.060 ms | 2.032.000 ms | 60 ms -> **keine Bonuszeit, Wanduhr = Spielzeit** (storedCycles 6) |
| F. lokale Reglernachbildung gegen die echte `planTasks` (252 Zustaende, 210 mit Vigilante) | - | - | 0 Abweichungen; Aufstiegsentscheidung 89 Zustaende, 0 |
| G. NPC-Macht (Monte Carlo N=400 seit der Gruendung) | groesste/zweitgroesste NPC-Macht 400,2 / 332,0 | P10/P50/P90 = 345/382/437 und 281/321/357 | im Band; gleiche Zahl NPC-Gangs mit Territorium (3) im Band |
| G. NPC-Macht stundenweise (7 Intervalle x Macht und Territorium der zwei Grossen) | echt | MC N=300 | alle |z| <= 1,86 |
| G. **Ausser Stichprobe**: Vorhersage +0,5 h (Median) | SftD 400,2 / BH 332,0 (+0,53 h) | 385 [363..413] / 331 [312..351] | im Band |
| H. Torrunden-Planer gegen den Live-Plan des Bots (08:09: Geld 4,66 Mrd, Ruf 720.916) | n 5, 4.192.688.000 $, gain 1,439, erst nextSENS | n 5, 4.192.688.000 $, 1,439, erst nextSENS | identisch (Kandidatenzahl 28 gegen 29: Bot zaehlt ein Stueck mehr) |

Die gemessene Fehlerquelle, die zuerst auftrat: die Faktionsruf-Rate sprang beim Einbau um 1,0 % (faction_rep 1,3683 -> 1,3820, NeuroFlux-Stufen).
Der Rechner multipliziert `faction_rep` je Einbau mit 1,0100 (aus diesen zwei Staenden gemessen); damit ist C auf -0,008 %.

**Was die Eichung NICHT zeigt:** Geldaufgaben liefen in der echten Gang noch nie (`moneyGainRate` 0 in allen Staenden). Die Geldformel
(`formulas.ts:56-73`) ist 86.360-fach gegen den Originalquelltext geprueft und laeuft durch dieselbe Pipeline wie der
Respekt (`Gang.ts:125-169`, dort live bestaetigt) - aber ein Absolutwert in $/s ist erst nach dem Umschalten messbar (Abnahme in Abschnitt 8).
Territorium/Krieg ist nur gegen die Quelle, nicht gegen die echte Gang geeicht (die Gang war nie im Krieg); die NPC-Seite ist statistisch geeicht (G).

## 2. Annahmen und feste Randwerte

| Groesse | Wert | Quelle / Grund |
|---|---|---|
| Schnappschuss | pt 3.939.286.800 (08:49:51) | `gang-p2b-live.mjs`; Zustand ist fuer alle Strategien gleich, bis R erreicht ist |
| Tor 1 | pt 3.976.718.800 = 19:13:42 (in 10,40 h) | `data/einbau-uhr.json` fertig 3.933.518.800 + 12 h (`lib/endspurt.js` `KAMPF_EINBAU_MIN_MS`; 2 x Wiederaufbau 486,6 s = 16 min < 12 h) |
| Tor 2 | Tor 1 + 12,135 h = 07:22 am 05.10. | 12 h + gemessener Wiederaufbau 0,135 h |
| Ruf jetzt (08:44) | 1.219.290; Favor Slum Snakes 154,68 -> Faktor (1+Favor/100) = 2,5468; faction_rep 1,3820 | Spielstand |
| Bot-Einkommen (ohne Gang) | **7,2 Mrd/h netto, konstant (ANNAHME)** | letzter Zyklus: (87,5 Mrd Einnahmen - 6,2 Mrd Krankenhaus/Server/Sonstiges) / 11,27 h (`moneySourceA`); aktueller Zyklus bisher 5,25 Mrd/h brutto in 1,15 h |
| Kasse jetzt | 12,0 Mrd | Spielstand |
| Torrunde | `waehleTorRunde` aus `src/lib/einbau.js`, Gewichte OperationRedDragon (wie die Live-Telemetrie), Reaper 51 / Evasive 52, q0 = 0, Preisfaktor 1,9, SF11 = 0 | Live-Telemetrie `bn4rep.json` |
| Black-Op-Chancen | `data/blade.json` `boChancen` (Schaetzung des Bots) 08:36 und 08:49; Schwelle `boSchwelle` 0,9 | `Action.ts:157-195`: chance = min(1, Competence/Schwierigkeit), unterhalb der Kappung linear in jedem Faktor |
| Wachstum G | Faktor, den die Competence aus ANDEREN Quellen (Spielerstufen-Erfahrung, Bladeburner-Skills aus Skillpunkten = Rang/3, Einbau-Wiederaufbau) bis Tor 1 noch wachsen muss | "G noetig" = max ueber offene Ops von 0,9 / (Chance jetzt x Verhaeltnis der Runde) |

Das Bot-Einkommen ist die schwaechste Annahme (Rate, nicht Bestand: es ist die Rate des LETZTEN Zyklus, der aktuelle fuehrt
zu ~5 Mrd/h im ersten Stundenabschnitt). Empfindlichkeit (Kasse Tor 1 / G noetig Tor 1):

| Bot Mrd/h | S0: Kasse Tor 1 / G noetig Tor 1 / Tor 2 | S1 | S3 |
|---|---|---|---|
| 4 | 54 Mrd / 2,17 / 0,96 | 354 Mrd / 1,22 / 0,38 | 568 Mrd / 1,08 / 0,33 |
| **7,2** | **87 Mrd / 1,87 / 0,72** | **388 Mrd / 1,22 / 0,38** | **601 Mrd / 1,08 / 0,33** |
| 10 | 116 Mrd / 1,65 / 0,62 | 417 Mrd / 1,22 / 0,38 | 631 Mrd / 1,06 / 0,33 |

S0 haengt am Bot-Einkommen (G noetig 1,65-2,17), S1/S3 praktisch nicht - das Gang-Geld dominiert (Blade-Stand 08:49).

## 3. Welcher Faktionsruf R wird fuer die Torrunde gebraucht?

**R = 1.625.000 Ruf bei Slum Snakes** (`getFactionRep("Slum Snakes")`), gebraucht von **Graphene Bionic Spine Upgrade**
(Grundpreis 6,0 Mrd, Kampfmults x1,6 auf alle vier). Mit 2 % Reserve **R_schalt = 1.657.500**. Es ist das hoechste Ruf-Erfordernis
aller 28 noch nicht besessenen Kampfstuecke (The Red Pill mit 2,5 Mio ist nicht gewollt und nicht in der Zaehlung; Hydroflame Left Arm braucht 1,25 Mio Ruf, kostet aber 2,5 Bio $ und ist nie Kandidat).
Die Torrunde kauft es **ab einem Budget von ~50 Mrd** als erstes Stueck (teuerste zuerst) - auch die S0-Runde (79 Mrd) braucht 1,625 Mio.

Wirkung des Rufdeckels bei festem Budget 400 Mrd (Planer-Gewichte RedDragon, Blade-Stand 08:49):

| R | n | Kosten Mrd | Competence | G noetig |
|---|---|---|---|---|
| 750.000 | 11 | 359 | x4,05 | 2,24 |
| 1.125.000 | 12 | 341 | x4,18 | 2,15 |
| 1.250.000 | 12 | 350 | x5,90 | 1,53 |
| **1.625.000** | 12 | 354 | **x7,42** | **1,22** |
| 2.500.000 | 12 | 354 | x7,42 | 1,22 |

Ein "genug" bei 1,25 Mio kostet also ~30 % Competence. **Frischer Knoten (BN2.2/2.3, nichts besessen, Stufen niedrig):** dort waehlt der Planer die Spine Upgrade erst ab ~400 Mrd Budget:

| Budget | R-Deckel 750k | 1,25 Mio | 1,625 Mio | maxRep des Plans (ohne Deckel) |
|---|---|---|---|---|
| 40 Mrd | x2,62 | x3,48 | x3,48 | 1,25 Mio |
| 75 Mrd | x3,03 | x4,49 | x4,49 | 1,25 Mio |
| 150 Mrd | x3,53 | x5,09 | x5,09 | 1,25 Mio |
| 400 Mrd | x4,30 | x6,87 | **x7,53** | 1,625 Mio |

Bis ~150 Mrd Budget reichen also 1,25 Mio (so rechnet auch der Parallelbericht `verify-p2b-geldwert.md`); mit dem Geld von S1/S3 (>= 300 Mrd) werden 1,625 Mio gebraucht. Der Mehrruf kostet ~0,4 h Terrorism. Fuer spaetere Knoten gilt R = 1,02 x max(Rufbedarf der noch nicht
besessenen Kampfstuecke der Gang-Faktion ohne The Red Pill und ohne Stuecke > 100 Mrd Grundpreis) x `AugmentationRepCost` des Knotens
(BN2: 1). Nach Runde 1 ist die Menge kleiner: Runde 1 (S1) kauft Graphene Bionic Spine Upgrade, CordiARC, SPTN-97, Graphene Bionic Arms Upgrade,
HyperSight, nextSENS, The Black Hand, Bionic Legs, Power Recirculation Core, Nanofiber Weave, SmartSonar, LuminCloaking-V2 (S3 zusaetzlich Xanipher);
**R fuer Zyklus 2 sinkt damit auf 1.147.500** (Graphene Bone Lacings 1,125 Mio + 2 %). Der Rechner (`targetRep`) rechnet je Zyklus den dynamischen Wert.

**Wann ist R erreicht?** S0/S1/S3 gleich: **+0,36 h = 09:11** (Rate ~870.000 Ruf/h = 3.800-4.700 Respekt/s x 1,382 x 2,547 / 75).
In Zyklus 2 (Favor ~260-330): 0,5 h (S0) bis 1,6 h (S1) nach dem Einbau.

## 4. Strategien (24 h, Tor 1 und Tor 2)

Alle Zahlen absolut, Spielzeit, Anfangszustand = Spielstand 08:49:51. Gang-Geld = in `gang`-Aufgaben verdientes Geld bis Tor 1, ohne Bot-Einkommen.

| | R erreicht | Gang-Geld bis Tor 1 | Geld/h in der Geldphase (Mittel; kurz nach Umschalten -> bei Tor 1) | Kasse Tor 1 (mit Bot 87 Mrd) | Runde 1: n, Kosten, Competence | **G noetig Tor 1** | Tote | Runde 2 (Tor 2): Kasse, n, Competence | kum. Competence |
|---|---|---|---|---|---|---|---|---|---|
| **S0** gebaut (Terrorism/Vigilante) | 09:11 | 0 | 0 | 86,9 Mrd | 9, 78,7 Mrd, x4,81 | **1,87** | 0 | 95,5 Mrd, 8, x2,58 | x12,4 |
| **S1** Terrorism bis R, dann Human Trafficking | 09:11 | **301 Mrd** | 30 (16,7 -> 40,3) | 388 Mrd | 12, 354 Mrd, x7,42 | **1,22** | 0 | 875 Mrd, 11, x2,98 | x22,1 |
| S1m sofort alles Geld | 11:30 (nur ueber HT-Respekt!) | 309 Mrd | 30 | 396 Mrd | gleich S1 | 1,22 | 0 | 898 Mrd | x22,1 |
| **S3** S1 + Ausruestung w/a/v/r | 09:11 | **519 Mrd** (Ausruestung 4,37 Mrd) | 52 (30 -> 67) | 601 Mrd | 12, 522 Mrd, x8,41 | **1,08** | 0 | 1.555 Mrd, 12, x3,02 | x25,4 |
| S3g S3 + Mitglieder-Augmentierungen | 09:11 | 1.886 Mrd (Ausgabe 306 Mrd) | 189 | 1.667 Mrd | 15, 1.633 Mrd, x9,70 | 0,92 | 0 | 7.070 Mrd | x34,8 |
| S4a S1 + Aufstieg nach Arbeitsaufgabe | 09:11 | 332 Mrd | 33 | 419 Mrd | gleich S1 | 1,22 | 0 | 962 Mrd | x22,1 |
| S2 auf S1 (k=6, ab 0,5 h, Ziel 0,30) N=20 | 09:11 | 615 [544..653] Mrd | - | ~700 Mrd | - | 1,05 | 0 [0..1] | - | x25,4 |
| **S2 auf S3** (k=6, ab 0,5 h, Ziel 0,30) N=20 | 09:11 | **1.690 [1.603..1.732] Mrd** | - | ~1.780 Mrd (Seed 3: 1.784) | 15, 1.633 Mrd, x9,70 | **0,92** | 0 [0..0] | Seed 3: 3.109 Mrd, 10, x3,59 | x34,8 |

Tore: Tor 1 19:13, Tor 2 07:22 (05.10.). Bei Tor 2 haben S1/S3/S2 G noetig 0,33-0,38 (alle Ops frei auch ohne Wachstum), S0 0,72 (Bot 4 Mrd/h: 0,96).
Runde 1 (S1): Graphene Bionic Spine Upgrade zuerst (teuerste zuerst), dann CordiARC, SPTN-97, Graphene Bionic Arms Upgrade, HyperSight, nextSENS, The Black Hand,
Bionic Legs, Power Recirculation Core, Nanofiber Weave, SmartSonar, LuminCloaking-V2.

### Warum der Preisfaktor das Ergebnis dominiert

Competence gegen Budget (Planer RedDragon, Rufdeckel unbegrenzt, Blade-Stand 08:49):
10 Mrd x1,99 | 50 Mrd x4,16 | 80 Mrd x4,81 | 150 Mrd x6,03 | 400 Mrd x7,42 | 600 Mrd x8,41 | 1.200 Mrd x9,45 | 2.000 Mrd x10,42 | 5.000 Mrd x13,57 | 20.000 Mrd x16,21.
Jedes Stueck verteuert die folgenden um 1,9; ab ~12 Stuecken kostet eine Verdopplung des Budgets nur noch ~+10 % Competence.
Deshalb sind S1 (+0,43 ln gegenueber S0) und S3 (+0,12 ln gegenueber S1) die tragenden Schritte; S3g und S2 holen nur noch +0,14 / +0,14 ln.

### Zeit bis R, Geld/h, Tote - je Strategie

* S0/S1/S3: R 09:11. S1 schaltet dann um; Geld/h beginnt bei 16,7 Mrd/h (14,1 Mrd/h reiner HT-Wert der 12 Mitglieder jetzt, Wachstum durch Aufstiege)
  und waechst auf 40 Mrd/h bei Tor 1. S3 beginnt bei 30 Mrd/h (volle Ausruestung kostet 2,08 Mrd, Rabatt 5,62 bei 22 Mio Respekt) und endet bei 67 Mrd/h.
  Handrechnung: alle w/a/v/r-Stuecke = Faktoren hack x1,71, str x3,51, def x3,63, dex x1,49, agi x2,64, cha x1,46; Gang-HT-Geld/h 14,06 -> 25,75 Mrd (x1,83).
* Tote: S0/S1/S3/S3g = 0 **konstruktiv** (Tod nur bei Aufgabe "Territory Warfare" in einem Clash, `Gang.ts:281-303`; ohne Warfare
  `territoryClashChance` 0). Der Rechner kann Tote anzeigen (S2), die Null ist also kein Werkzeug-Artefakt.
* Wanted: S1 minimale Strafe 0,985 (Respekt sinkt bei Aufstiegen, `Gang.ts:392-393`), S3 0,989; Vigilante greift nicht.
* Beste Geldaufgabe: Human Trafficking fuer alle 12 in allen simulierten Zustaenden (jetzt 1,38 Mrd/h je starkem Mitglied; Traffick Illegal Arms 0,79; Armed Robbery 0,22; Rest < 0,15).

## 5. S2 Territorium (Monte Carlo, NPC-Zufall)

Mechanik (`Gang.ts:171-303`, im Rechner 1:1): jede Gang zieht je Update (20 s) einen Zufallsgegner; Clashes mit uns nur bei `territoryClashChance > 0`
(Warfare an; nach "aus" zerfaellt sie um 0,01 je Update = 33 min, danach ist das Territorium **sicher**). Gewinn je Sieg ~0,0001 x
(1 + ln(Macht/Gegnermacht)/ln 50) x (0,5..1,5). Unsere Macht waechst nur mit Mitgliedern auf "Territory Warfare": 0,015 x max(0,002, Territorium) x
Summe(Stufen)/95 je Update.

* **Die NPC-Lage kippt gerade zu unseren Gunsten:** seit Syndicate/NiteSec/Dark Army ausgeschieden sind, bleiben SftD (400) und Black Hand (332)
  im Dauerduell; die Quelle sagt voraus, dass ihre Macht FAELLT (Median 385/331 nach 0,5 h, 250/188 nach 4 h; Streuung gross, SftD P90 nach 12 h ~900,
  wenn Black Hand zusammenbricht). Das Echte bestaetigt die ersten 0,5 h (400/332 im Band).
* Verlauf (Beispiel S1-Basis, k=12, Seed 1, Zeiten ab Schnappschuss 08:12): Aufbau ab 1,25 h (alle 12 auf Territory Warfare), Macht 1 -> 339 nach 1,25 h,
  Warfare an bei Siegchance 0,53 (2,5 h), Territorium 0,143 -> 0,30 bei 6,0 h (3,5 h Krieg, Macht 1.382), keine Verluste. NPC-Macht fiel dabei auf SftD 65 / BH 26.
  Gang-Geld waehrend Aufbau und Krieg ~3 Mrd (die Kriegsabteilung verdient nichts), danach 19-40 Mrd/h.
* Ergebnisse (Median [P10..P90], N=20, Ziel 0,30, Stopp 9 h, Warfare ab Siegchance 0,5):

| Basis | k (Kriegsabteilung) | Gang-Geld bis Tor 1 | Territorium bei Tor 1 | Macht | Tote bis Tor 1 / Tor 2 | G noetig Tor 1 |
|---|---|---|---|---|---|---|
| S1 | 6 | 615 [544..653] Mrd | 0,316 | 854 | 0 [P90: 1] / 0 [P90: 1] | 1,05 |
| S1 | 12 (Start 1,2 h) | 594 [554..608] Mrd | 0,317 | 1.348 | 0 [P90: 1] | - |
| S1 | 6, Siegchance >= 0,65 (Start 1,2 h) | 625 [**280**..661] Mrd | 0,316 [0,240..0,319] | 1.012 | 0 | - |
| S1 | 12, Ziel 0,60 (Start 1,2 h) | 746 [605..804] Mrd | 0,547 | 4.225 | 0 [P90: 1] | - |
| S3 | 6 | **1.690 [1.603..1.732] Mrd** | 0,320 | 2.001 | 0 [0..0] / 0 | **0,92** |
| S3 | 12 (Start 1,2 h) | 1.524 [1.455..1.552] Mrd | 0,320 | 3.588 | 0 [0..0] | 1,23 (Blade 08:36) |
| S3 | 12, Ziel 1,0, Stopp 11 h | 67 [58..74] Mrd | 0,896 | 26.280 | 0 [P90: 1] | 1,93 |

* Territorium vervielfacht Geld (HT: (Territorium x 100)^1,5 / 100 und Exponent 0,2 x T + 0,8): von 0,143 auf 0,32: Gang-Geld x2,0 (S1-Basis) bis x3,3 (S3-Basis). Ein Krieg bis zur Vollenteignung
  (Ziel 1,0) ist vor Tor 1 ein Verlustgeschaeft (67 statt 519 Mrd), weil die Kriegsabteilung den ganzen Tag nichts verdient.
* Risiken: Tod eines Mitglieds kostet 5 % Gesamtrespekt plus seinen verdienten Respekt (30 Mio Respekt -> ~1,5 + bis 4 Mio) und seine Aufstiegspunkte
  (Ersatz startet bei Stufe 1; ~3 h Training); Wahrscheinlichkeit je Clash und Mitglied `0,01 (0,005 bei Sieg) / Verteidigung^0,6 x 0,35` = ~4e-5 bei Verteidigung ~1.800.
  Sieger-Seite: ein Ausreisser (P10 280 Mrd) entsteht, wenn der Krieg erst bei Siegchance 0,65 beginnt und SftD kurz davor aufdreht.
* **Nutzen fuer den Abschluss: klein** (G noetig 1,08 -> 0,92), Aufwand und Risiko (neue Aufgabe, `setTerritoryWarfare`, `getChanceToWinClash` 4 GB RAM,
  Kriegsabteilung, Abbruchregeln) hoch. Nicht bauen.

## 6. S4 Reglerwerte

Raster (Basis S1 und S3, 24 h, Ergebnis Gang-Geld bis Tor 1):

| trainUntil | ascTrain/ascWork | S1 Geld Mrd | S3 Geld Mrd | Aufstiege bis Tor 1 | minimale Strafe (S3) | Competence Runde 1 |
|---|---|---|---|---|---|---|
| 300 / 400 / 500 / 600 / 700 | 1,3/2 (gebaut) | 300,6 / 300,7 / 300,8 / 300,9 / 301,0 | 518,6 / 518,8 / 518,9 / 519,1 / 519,3 | 12 | 0,989 | x7,42 (S1) / x8,41 (S3) |
| egal | 1,2/2 | wie 1,3/2 | wie 1,3/2 | 12 | 0,989 | gleich |
| egal | 1,5/2,5 | 238 | 462 | 12 | 0,992 | S3 x8,41 |
| egal | 1,3/3 | 193 | 346 | 3 | 0,998 | S3 x7,42 |
| egal | 1,3/1,5 oder 1,2/1,5 | **354** (+18 %) | **637** (+23 %) | 35 (S1) / 36 (S3) | 0,968 (S1) / 0,978 (S3) | S1 x7,42 / S3 x8,59 |
| 500 | 1,3/1,3 | - | 687 (+32 %) | 57 | 0,936 | S3 x8,59 |
| 500 | 1,2/1,2 | - | 700 (+35 %) | 81 | **0,720** | S3 x8,59 |
| 500 | 1,1/1,1 | - | 670 | 163 | 0,720 | S3 x8,59 |

* trainUntil und ascTrain sind bedeutungslos (Training dauert nach einem Aufstieg Minuten). Nur `ASC_WORK` wirkt: je kleiner, desto mehr Geld - bis die
  Respekt-Verluste durch viele Aufstiege (jeder zieht den verdienten Respekt des Mitglieds ab) die Strafe unter 0,95 druecken (Vigilante greift ein).
* **Der Gewinn ist fuer die Torrunde wertlos**: +23 % Geld bedeuten Competence x8,41 -> x8,59 (+2 %), G noetig 1,08 -> ~1,05 (Tabelle `round`, Budget 800 Mrd).
  Keine Aenderung der gebauten 500 / 1,3 / 2.
* Geldbewusster Regler (Aufstiegsfaktor und Training nach den Gewichten von Human Trafficking statt Terrorism/Train Combat; S4a, S4m): +10-14 % Geld, gleiche Competence. Nicht lohnend.

## 7. Was das fuer den Abschluss heisst (und der eigentliche Hebel)

Die Black-Op-Kette ist der Engpass, nicht der Rang (Rang 134.775 am 08:49, +18.000 in 13 min; Daedalus braucht 400.000). Offene Ops 08:49:
Wallace 0,92, Orion 0,55, Hyron 0,56, Morpheus 0,57, Ion Storm 0,53, Annihilus 0,48, Ultron 0,37, **Centurion 0,116, Vindictus 0,108, Daedalus 0,102**.
Die letzten drei brauchen Competence x7,8-8,9 (0,9 / Chance).

"G noetig" = Wachstum aus anderen Quellen, das nach der Runde bei Tor 1 noch fehlt, damit alle Ops >= 0,9 haben:

| Strategie | Blade 08:36 (11 Ops) | Blade 08:49 (10 Ops) |
|---|---|---|
| S0 | 2,43 | 1,87 |
| S1 | 1,58 | 1,22 |
| S3 | 1,40 | 1,08 |
| S2 auf S3 / S3g | 1,2 / 1,23 | 0,92 / 0,92 |

* In 13 Minuten ist G noetig um den Faktor 1,30 gesunken (Reaper 68 -> 77, Evasive 69 -> 78; Skillpunkte = Rang/3, der Rang steigt gerade um ~80.000/h).
  Letzter Zyklus: Competence-Proxy (Operation Tyrell, Stufen x Reaper/Evasive x Erfolgsmult) 1,27 h -> 12,07 h = x2,03.
  Dieser Zyklus hat deutlich mehr Skillpunkte-Zufluss (Rang +350.000 bis 400.000 statt +45.000). **G ist die groesste Unbekannte** und nicht Teil der Gang-Rechnung.
* Heisst: S0 reicht bei Tor 1, sobald G >= 1,87 eintritt (08:36: 2,43, 13 min spaeter 1,87); ob das bis 19:13 passiert, ist offen, die Tendenz spricht dafuer. S1/S3 verschieben die Schwelle auf 1,22/1,08.
  Ihr Nutzen fuer BN2.1 ist damit **Sicherheit statt garantierte Stunden**; fuer BN2.2/2.3 (Rang klein, kompetenzbegrenzter Abschnitt 1,
  `verify-g01-substanz.md` Abschnitt 5) ist er deutlich groesser.
* **Der Takt des Tors ist die eigentliche Bremse.** Mit S3-Geld ist eine Runde schon frueh bezahlbar (Budget = Kasse zur Zeit, Stunden ab 08:50):

| ab Schnappschuss | S0 Kasse / Runde / G noetig | S1 | S3 |
|---|---|---|---|
| +2 h (10:50) | 26 Mrd / x2,86 / 3,15 | 54 Mrd / x4,16 / 2,17 | 74 Mrd / x4,71 / 1,91 |
| +3 h | 34 Mrd / x3,70 / 2,43 | 81 Mrd / x4,81 / 1,87 | 118 Mrd / x5,50 / 1,65 |
| +5 h | 48 Mrd / x4,10 / 2,19 | 147 Mrd / x5,99 / 1,50 | 225 Mrd / x6,99 / 1,30 |
| +8 h | 70 Mrd / x4,63 / 1,95 | 276 Mrd / x7,27 / 1,25 | 428 Mrd / x7,42 / 1,22 |
| +10,4 h (Tor 1) | 87 Mrd / x4,81 / 1,87 | 388 Mrd / x7,42 / 1,22 | 601 Mrd / x8,41 / 1,08 |

  S3 hat nach 3 h eine bessere Runde (x5,50), als S0 sie bei Tor 1 hat (x4,81), und nach 5 h G noetig 1,30. Ob ein frueheres Tor (statt `KAMPF_EINBAU_MIN_MS` = 12 h,
  geschrieben, als der Wiederaufbau Stunden dauerte; jetzt 486 s) sinnvoll ist, haengt an dem kurzfristigen Kampfwerte-Verlust des Einbaus (07:05 -> 07:17: str 307 -> 189; Competence-Proxy x2,68 vor dem Einbau, x2,30 nach 12 min,
  x6,85 nach 1,2 h - die neuen Augs liegen nach ~1 h klar ueber dem alten Stand) und ist NICHT gerechnet. Das ist ein eigener Auftrag - der Gewinn waeren Stunden, nicht Prozent.

## 8. Bauvorgabe fuer `gang.js` (Reihenfolge, Schwellen)

1. **Phasenschalter (stateless):** `rep = ns.singularity.getFactionRep(gangFaction)`; `rep < R_SCHALT` -> bisherige Logik (Train Combat bis 500, Terrorism, Vigilante);
   `rep >= R_SCHALT` -> Geldphase. BN2: `R_SCHALT = 1_657_500`. Ruf faellt nur durch den Einbau auf 0 (dann beginnt Zyklus 2 von selbst mit Terrorism).
   Fuer andere Knoten: `1,02 x max(repReq)` der noch nicht besessenen Kampfstuecke der Gang-Faktion ohne The Red Pill und ohne Stuecke > 100 Mrd Grundpreis,
   `x AugmentationRepCost`; oder aus `bn4rep.json` lesen (dort ein Feld `maxRepReq` ergaenzen).
   Wenn der Bau nach 09:11 landet, schaltet der erste Lauf sofort um.
2. **Geldphase, Arbeitende:** `Human Trafficking` (Fallback bei Stufe unter Schwelle: `Train Combat`). Training (500), Aufstieg (1,3 / 2), Wanted-Regler (Boden 0,95, nur wanted > 1) **unveraendert**.
3. **Ausruestung** (Waffen, Ruestung, Fahrzeuge, Rootkits; **nicht** Typ Augmentation): in der Geldphase jedes Stueck, das ein Mitglied noch nicht hat, kaufen,
   sobald `ns.getServerMoneyAvailable("home") >= ns.gang.getEquipmentCost(name)` (ein Sicherheitsabstand von 2x schadet nicht: 4,4 Mrd Gesamtausgabe); Preise aufsteigend;
   nach jedem Aufstieg (Ausruestung geht verloren, `GangMember.ts:308-319`) erneut. Getestet als S3s (kaufen sobald Geld >= Preis, ohne Amortisationsregel): gleiches Ergebnis wie die Amortisationsregel (519 Mrd, x8,41). RAM +6 GB (`purchaseEquipment` 4, `getEquipmentCost` 2; `Netscript/RamCostGenerator.ts:274-304`).
4. **Nicht bauen:** `setTerritoryWarfare` (S2), Mitglieder-Augmentierungen (S3g: 306 Mrd Ausgabe fuer +0,14 ln), andere Reglerwerte (S4).
5. **Abnahme nach dem Umschalten** (`getGangInformation().moneyGainRate` ist je ZYKLUS, x5 = $/s):
   nach 15 min >= 0,9 Mio $/Zyklus (4,6 Mio $/s, 16,7 Mrd/h) ohne Ausruestung bzw. >= 1,6 Mio $/Zyklus (30 Mrd/h) mit Ausruestung; `penalty` >= 0,95; `errors.total` 0;
   Kassenzuwachs ~ Bot (7 Mrd/h) + Gang (16,7 bzw. 30 Mrd/h). Liegt der Wert um mehr als Faktor 2 darunter, ist die Geldformel falsch -> Schalter zurueck, S0.
6. **Am Tor:** erstes Stueck der Runde = Graphene Bionic Spine Upgrade (1,625 Mio Ruf) bei Budget >= 50 Mrd; `torRunde.plan.n` >= 11 bei Kasse >= 300 Mrd.

## 9. Was ich nicht pruefen konnte / wo ein Skeptiker ansetzen soll

* **Geld-Absolutwert** (siehe Abschnitt 1): nur Formel und Pipeline geeicht. Falls `moneyGain` in der echten Gang anders skaliert (z. B. unbekannter Knotenmultiplikator),
  verschiebt sich alles mit Geld; die Rufseite (S0, R, Zeit) bleibt.
* **Bot-Einkommen und Ruecklagenlogik:** das Gang-Geld fliesst in dieselbe Kasse, die hacknet/homegrow/graft/bn4net "ueber der Ruecklage" ausgeben. Konkurrenz um Geld ist
  nicht modelliert; in der Rechnung wird nur die Torrunde bezahlt (Kasse Tor 1 = Bot + Gang). Bei 387-601 Mrd Kasse ist das unkritisch, bei Ausgaben von > 100 Mrd/Zyklus nicht.
* **G** (oben): ein einziger vergleichbarer Zyklus und eine 13-min-Messung. G noetig ist daher als Schwelle angegeben, nicht als Vorhersage.
* **Chancen** sind die Schaetzung des Bots (`blackOpChance`, nicht der Spielwert); die Verhaeltnisrechnung folgt der Quelle (`Action.ts:157-195`), die Basiswerte nicht.
* **Planer-Gewichte:** die Runde wird fuer OperationRedDragon geplant, binden aber Centurion/Vindictus/Daedalus (Gewichte Typhoon-aehnlich). Test (`round`): Planer-Gewichte Daedalus
  statt RedDragon liefern bei jedem Budget dasselbe "G noetig" auf zwei Stellen (z. B. 1,22 bei 400 Mrd) - die Wahl der Gewichte spielt keine Rolle.
* **Tab-Drosselung / Nachholen:** unter einem gedrosselten Tab verarbeitet die Gang nur 25 von 300 Zyklen je Aufruf, der Rest liegt als Bonuszeit (`getBonusTime`); die Torrunde wartet darauf bis 30 min.
  Alle Raten hier sind Spielzeit; Wanduhr = Spielzeit nur, solange das Spiel ungedrosselt tickt (gemessen: 60 ms Differenz ueber 34 min).
* **Rate gegen Bestand:** "Respekt" ist hier ein Bestand, der durch Aufstiege sinkt (S1: 43 Mio -> 6,8 Mio bei 8 Aufstiegen), die Respekt-RATE bleibt; der Faktionsruf sinkt nie. Die "Ruf/h"-Zahlen sind
  Raten aus Arbeit, nicht ein abgebauter Vorrat.
* **Ausschluss "Tote = 0":** gueltig, weil der Rechner den Todesfall kennt (S2) und die Quelle ihn nur bei aktivem Krieg zulaesst.
* **Kein eigener Skeptiker-Lauf** (in dieser Sitzung stand kein Subagent-Werkzeug zur Verfuegung); die Angriffsflaechen stehen oben. Wer baut, sollte S1/S3 mit den Abnahmewerten aus Abschnitt 8 begleiten.

## 10. Dateien und Aufrufe

* `node tools/audit/gang-p2b-live.mjs --out snap.json` (Live) bzw. `--file backups/...json.gz`
* `node tools/audit/gang-p2b-calib.mjs --livefile snap.json --log gang-log.txt` (Eichung A-G)
* `node tools/audit/gang-p2b-sim.mjs scen --snap snap.json --blade blade.json --strats S0,S1,S3,S3g,S4a`
  (`round`, `grid --base S1|S3`, `war --base S1|S3 --n 20 --k 6,12 --engage 0.5 --target 0.3`)
* `node tools/audit/gang-p2b-income.mjs [backup...]` (Einkommen nach Quelle)
