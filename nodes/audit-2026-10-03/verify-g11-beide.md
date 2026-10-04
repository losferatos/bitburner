# Gegenpruefung G11 - BLADE-2 (Datamancer/Tracer-Skillbewertung), Winkel Substanz und Betrieb

Pruefer: Gegenpruefer G11, 04.10.2026 (Systemzeit 13:10 bei Start). Streng lesend: `src/` unveraendert, Spiel und
Bruecke nicht angefasst, nichts committet. Grundlage: Bot-Stand master `f1bee88`, Spielquellcode 3.0.2
(`reference/bitburner-src/src/`), Spielstaende `backups/*BN2L1*` (33 Staende, 03.10. 05:33 bis 04.10. 10:38) und
`*BN2L2*` (4 Staende). Zeitangaben lokal (UTC+2), Aktionsprotokoll in UTC (umgerechnet).

Behauptung (BLADE-2): Datamancer (schaetzNot aus roher Spanne) und Tracer (Abdeckung fest 1,0) binden 34 % der
Skillpunkte fast wirkungslos; bei gleichen 578 SP Typhoon-Chance 0,0868 -> 0,1206, Dauer-Rangrate 5,23 -> 7,91 Rang/min.

## Urteil: TEILWEISE

| Teil der Behauptung | Urteil | Kern |
|---|---|---|
| Mechanismus (schaetzNot roh, Tracer 1,0) steuert die Kaeufe | BESTAETIGT | Nachbau der Kaufregel trifft die tatsaechlichen Stufen aller 33 Staende (Datamancer 0 -> 50, Tracer 2 -> 31) |
| Datamancer ist im Betrieb wirkungslos | BESTAETIGT | 0 Field Analysis / Investigation / Undercover in 20,9 protokollierten Knotenstunden; Tracking-Tropfen vernachlaessigbar |
| Tracer "fast wirkungslos" | TEILWEISE | 09:59 ja (Vertraege 4-5 % des Rangs), aber 19:00-22:00 kamen 98 / 58 / 100 % des Spielerrangs aus Vertraegen; ab 22:00 dann 0 % |
| 34 % der SP | BESTAETIGT fuer 09:59 (33,9 %) | ueber den Knoten 20-40 %, bei 03:17 (Typhoon-Tor) 29 %; netto verschwendet ~26 % (Tracer holte in der Vertragsphase ~250 SP zurueck) |
| Typhoon 0,0868 -> 0,1206 (x1,39), Rang/min x1,51 | WIDERLEGT als Ertrag des Fixes | Rechnung reproduziert (x1,388), ist aber die Obergrenze einer freien Neuverteilung. Mit der Kaufregel des Bots: x1,12 (nur Datamancer) bis x1,23 (mit Tracer-Messung); Rang +25..+45/h statt +160/h |
| "rund 2,9 h frueher Typhoon" | WIDERLEGT | Der Vorsprung schmilzt bis 03:17 auf x1,00 (die freien SP laufen ab ~23:00 in Overclock); Feuerzeit-Gewinn 0 h +- 0,2 h |
| Fix-Skizze "schaetzNot auf spanneGenau" | UNZUREICHEND | wirkt nur, wenn D2 aufloest; bei r <= 0,371 bzw. Chance <= 0,5 (7 von 32 Staenden, 7 von 17 nach 20:00) bleibt schaetzNot bei 0,8-1,0, Datamancer wird weiter gekauft |

Korrigierter Ertrag (absolut): Typhoon-Chance bei 578 SP 0,0868 -> 0,0974 (nur Datamancer) bzw. 0,1063 (mit
Tracer-Messung); Rang +25..+45/h (supply-begrenzt, 09:59); Typhoon-Feuerzeit +-0 h; Knotenende -0,1..-0,3 h
(GESCHAETZT, nur die Kette nach Typhoon). Prioritaet damit P3 statt P1, aber billig und ungefaehrlich.

## Rechner (alle unter `tools/audit/`, Praefix `verify-g11-`)

| Datei | Zweck |
|---|---|
| `verify-g11-lib.mjs` | eigener Nachbau der Black-Op-Chance und der Skillkosten, Skills.ts und BlackOperations.ts werden aus dem Spielquelltext GEPARST (nicht abgetippt) |
| `verify-g11-eichung.mjs` | Eichung des Nachbaus gegen `boChancen` in `data/blade.json` jedes Staendes und gegen die SP-Buchhaltung |
| `verify-g11-faktor.mjs` | statische Gegenentwuerfe (gierig nach d ln Chance / Preis) - reproduziert die Zahl der Behauptung |
| `verify-g11-botregel.mjs` | Nachbau von `relNutzen` + `faehigkeitenKaufen` auf EINEM Stand (Regelwerte je SP) |
| `verify-g11-sim.mjs` | zeitaufgeloeste Kaufregel ueber den ganzen Knoten, Varianten bot / fixDM / fixBoth / fix0 / fixDMreal / fixBothReal |
| `verify-g11-auswertung.mjs`, `verify-g11-zeit.mjs` | Tabellen und Umrechnung in Feuerzeiten |
| `verify-g11-schaetznot.mjs`, `verify-g11-unaufgeloest.mjs`, `verify-g11-geschlossen.mjs` | Verhalten von `spanneGenau`/`chanceAusR` auf den Staenden |
| `verify-g11-ranganteil.mjs`, `verify-g11-vertragsanteil.mjs`, `verify-g11-bolog.mjs`, `verify-g11-kette.mjs`, `verify-g11-zeitreihe.mjs`, `verify-g11-rang.mjs` | Rangherkunft, Aktionsmischung, Black-Op-Kette, Skill-Zeitreihe, Rang je Versuch |

Ausgaben der Simulation liegen als `nodes/audit-2026-10-03/verify-g11-sim-{log,const_0.1,const_1}.json`.

## Eichung (Soll = Spielstand, Ist = Nachbau)

1. **Chance der naechsten Black Op** (Soll = `boChancen` aus `data/blade.json` im Stand, 4 Nachkommastellen):
   35 von 36 Staenden mit |Ist-Soll| <= 1,6e-4 (Rundung; der Stand BN2.2 13:17 kam waehrend der Pruefung hinzu: 0,0478 / 0,0478). Beispiele: 09:59 Typhoon 0,0867 / 0,0868; 20:17 0,2237 /
   0,2237; 03:17 0,8116 / 0,8116; BN2L2 12:15 0,0305 / 0,0305. Ausreisser 04.10. 08:17 (Operation K 0,915 / 0,866):
   `blade.json` ist dort aelter als der Stand, waehrend die Kampfwerte explodieren (maxStamina 425 -> 1030 -> 2470);
   kein Formelfehler (Nachbarstaende sauber).
2. **SP-Buchhaltung**: Summe der Stufenkosten (Skill.ts:37-81, BN2 Faktor 1) + offene Punkte = `totalSkillPoints`:
   Differenz 0 in allen 37 Staenden.
3. **Kaufregel des Bots** (der eigentliche Pruefstein): Nachbau von `relNutzen`/`faehigkeitenKaufen`, gespeist mit der
   SP-Zufuhr je Stand, Ausdauer-Luft aus dem Aktionsprotokoll. Soll = tatsaechliche Stufen im Stand, Ist = Nachbau:

   | Stand | Soll (Spielstand) | Ist (Nachbau `bot`) |
   |---|---|---|
   | 07:33 (222 SP) | D3 T6 O0 BI5 DO6 SC6 R3 ES2 C2 CE3 H3 | identisch |
   | 08:33 (422 SP) | D10 T8 BI6 DO8 SC7 R4 ES3 C3 CE4 H4 | identisch |
   | 09:59 (578 SP) | D12 T9 BI7 DO10 SC8 R4 ES4 C4 CE5 H5 | D13 T9 BI7 DO10 SC8 R4 ES4 C3 CE4 H5 |
   | 20:17 (1.902 SP) | D27 T16 O8 BI14 DO16 SC14 R8 ES8 C6 CE8 H9 | D27 T16 O4 BI14 DO17 SC14 R8 ES9 C6 CE8 H8 |
   | 23:17 (2.925 SP) | D30 T20 O15 BI18 DO20 SC17 R12 ES13 C8 CE9 H9 | D30 T20 O15 BI18 DO21 SC17 R12 ES13 C8 CE8 H8 |
   | 03:17 (8.310 SP) | D50 T31 O53 BI27 DO31 SC24 R20 ES21 C14 CE9 H11 | identisch, CE8 |

   (D Datamancer, T Tracer, O Overclock, BI Blade's Intuition, DO Digital Observer, SC Short-Circuit, R Reaper,
   ES Evasive System, C Cloak, CE Cyber's Edge, H Hyperdrive.) Chance der naechsten Black Op, Nachbau gegen Ist:
   0,94 .. 1,09 in 32 von 33 Staenden (nur der letzte Stand 0,80, dort kommen SP aus anderer Quelle).
   Das ist die Grundlage, auf der die Gegenfaelle unten gelten: Die Regel ist verstanden, nicht geraten.
4. **Loch in D2**: Raid L17 bei r = 0,186 (06:17): Soll `chance` 0,000 (Spiel-API, 3 Stellen), Ist 0,0003 - der Fall
   `s.min` ~ 0 existiert in den Spielstaenden.

## Pruefung im Einzelnen

### 1. Mechanismus - bestaetigt, und genauer als berichtet

* `relNutzen("Datamancer")` = 500/(100+5L) x `schaetzNot()` (`src/blade.js:1182-1213`); `schaetzNot` nimmt das
  Maximum von `max-min` der ROHEN `spanne()` ueber alle 6 Operationen + 3 Vertraege (`:1354-1368`).
* `relNutzen("Tracer")` laeuft ueber den allgemeinen Zweig (`:1314-1319`) mit `abdeckung: 1.0` (`:1060`); `blackOpArbeit`
  hat keinen Schluessel "Tracer" (`:2600-2607`), also immer 1,0. Dazu der `klemmFaktor` (`:1475`), der die Chance der
  naechsten Black Op und einer Operation sondiert - fuer eine Vertragsfaehigkeit die falsche Sonde.
* Regelwert je SP bei 09:59 (Nachbau, luft 0,06): **Tracer 0,1401 (Platz 1)**, BI 0,1377, SC 0,1328, R 0,1310,
  Datamancer 0,1282, ES 0,1278, DO 0,1242. Tracer steht also nicht am Rand, sondern ganz vorn; die Zahlen der
  Behauptung (schaetzNot 0,615, DM 0,128 gegen BI 0,138) sind richtig.
* Bei 07:33 greift schaetzNot erst bei 0,28 (breiteste rohe Spanne 0,35): Datamancer 0 -> 3 -> 10 folgt der Spanne.

### 2. Datamancer ist wirkungslos - bestaetigt

* Spiel: `SuccessChanceEstimate` wird nur an vier Stellen gelesen: Investigation (`Bladeburner.ts:806`), Undercover
  (`:815`), Tracking (`:875`), Field Analysis (`:1140`).
* Aktionsprotokoll BN2.1 (352 Abschnitte, 20,9 h): kein `Field Analysis`, keine `Investigation`, keine `Undercover`,
  kein `Sting`. BN2.2 bisher (2,2 h): ebenfalls keine. Das Werkzeug koennte den Fall zeigen (es protokolliert jede
  Aktion mit Namen). **Einschraenkung:** das Protokoll hat eine Luecke 03.10. ca. 11:00-18:00 lokal (der Rang bewegt
  sich dort nur um 457); der Ausschluss gilt fuer die protokollierten Stunden.
* Tracking-Vertraege (Spieler und Sleeves) heben popEst um `random(100..1000) x Datamancer-Mult` Einwohner
  (`City.ts:35-45`, `improvePopulationEstimateByCount`); der Abstand popEst/pop liegt bei 3e8. Wirkung ~0,1 %.
* Beachte `City.ts:47-60`: Field Analysis schrumpft popEst um den Faktor 1/(1+eff/100) je Lauf (eff ~4 %). Ohne
  Datamancer sind es 4 %, mit 12 Stufen 6,4 % - Datamancer waere dort nur ein Beschleuniger, kein Freischalter.

### 3. Tracer - die Behauptung "fast wirkungslos" ist ein Momentbild

Rangherkunft aus dem Aktionsprotokoll (Spielerabschnitte, `verify-g11-vertragsanteil.mjs`) und aus den
Erfolgszaehlern der Staende (Spieler + Sleeves, `verify-g11-ranganteil.mjs`):

| Stunde (lokal) | Zeitanteil Vertraege | Ranganteil Vertraege (Spieler) | Rang in der Stunde |
|---|---|---|---|
| 07:00 / 08:00 / 09:00 / 10:00 | 21 / 31 / 11 / 27 % | 4 / 24 / 3 / 5 % | 610 / 235 / 478 / 442 |
| 19:00 | 57 % | **98 %** | 913 |
| 20:00 | 37 % | **58 %** | 1.185 |
| 21:00 | 84 % | **100 %** | 382 |
| 22:00 bis 10:00 (Rest des Knotens) | 0 % | 0 % | 1.621 .. 227.178 |

* In der Vertragsphase 19:00-22:00 (Raid-Vorrat leer, Retirement L26-36) lag Retirement bei p ~ 0,95 nur dank
  Tracer 14-16 (ohne: p ~ 0,58-0,61). Verlust ohne Tracer ca. 750 Rang = ~250 SP; Tracer hatte bis 22:17 358 SP
  gekostet. Die Anlage war also bis 22:00 fast ausgeglichen (nicht "fast nichts"); die weiteren 680 SP bis 03:17 und
  ~15.000 SP danach (Tracer 31 -> 125) brachten nichts, weil der Vertragsanteil auf 0 % fiel.
* Sleeves: Vertragsrang in den drei Intervallen 09:19-09:59 nur 7-19 % des Gesamtrangs; ihre Vertragschance steigt mit Tracer
  (`Action.ts:170-182` ueber die Bladeburner-Instanz des Spielers), zaehlt aber im Protokoll nicht mit - der
  vorgeschlagene Messwert aus `data/aktionen.txt` unterschaetzt den Vertragsanteil (Sleeve-Rang landet im
  Abschnitt, in dem der Spieler gerade etwas anderes tut).
* Die Fix-Skizze (Abdeckung = Vertragsanteil) ist die richtige Richtung: In der Simulation (`fixBoth`) bleibt Tracer in
  der Vertragsphase bei 19, sinkt aber sonst auf 5 statt 11 bzw. 31.

### 4. Die Zahl x1,39 / x1,51 - reproduziert, aber falsche Frage

* Reproduktion (`verify-g11-faktor.mjs`, mein Nachbau, Ziel nur ln Chance): freie Neuverteilung aller SP ausser
  Hyperdrive auf die Chance-Faehigkeiten: x1,388 (Behauptung 1,390 mit Ratenterm). Nur Datamancer frei: x1,172
  (Behauptung 1,172). Datamancer + Tracer frei: x1,319.
* Aber: die freie Neuverteilung verschiebt auch Cloak (4 -> 0) und Cyber's Edge (5 -> 2), was der Fix nicht tut.
  Cloak wirkt auf Assassination und Stealth Retirement (zusammen 33 % der Knotenzeit) und Zero/Shoulder/Morpheus;
  das Ziel der Behauptung (Typhoon + Raid/Retirement) kennt das nicht.
* Was der Fix wirklich bewirkt, ist das, was die Kaufregel des Bots mit den frei gewordenen SP macht. Das ist
  gerechnet (Nachbau geeicht, siehe oben): Chance der naechsten Black Op, Verhaeltnis Variante / Regel ohne Fix:

| Stand | SP | luft | schaetzNot roh -> nach Fix | fixDM (idealer D2) | fixDMreal (Fix wie vorgeschlagen) | fixBoth (ideal) | fixBothReal |
|---|---|---|---|---|---|---|---|
| 08:33 | 422 | 0,07 | 0,60 -> 0 | 1,07 | 1,07 | 1,23 | 1,23 |
| **09:59** | **578** | 0,08 | 0,62 -> 0 | **1,12** | 1,12 | **1,23** | 1,23 |
| 17:16 | 731 | 0,04 | 0,16 -> 0 | 1,09 | 1,09 | 1,22 | 1,22 |
| 19:01 | 1.296 | 0,11 | 0,89 -> 0 | 1,15 | 1,15 | 1,37 | 1,37 |
| 20:17 | 1.902 | 0,12 | 0,94 -> **0,80** | 1,17 | **1,03** | 1,14 | 1,12 |
| 21:17 | 2.247 | 0,31 | 1,00 -> **0,90** | 1,25 | **1,02** | 1,25 | 1,04 |
| 23:17 | 2.925 | 1,00 | 0,51 -> 0 | 1,16 | 1,00 | 1,20 | 1,02 |
| 00:17 | 4.004 | 1,00 | 0,77 -> 0 | 1,18 | 1,06 | 1,25 | 1,18 |
| 02:17 | 6.452 | 1,00 | 1,00 -> **1,00** | 1,10 | 1,00 | 1,10 | 1,06 |
| **03:17** | **8.310** | 1,00 | 1,00 -> **1,00** | **1,00** | 1,00 | **1,00** | 1,00 |
| 06:17 | 14.502 | 0,08 | 1,00 -> 0 | 1,13 | 1,09 | 1,28 | 1,18 |
| 09:17 | 59.826 | 0,27 | 0,65 -> 0 | 1,20 | 1,15 | 1,31 | 1,25 |

  Bei 578 SP: Typhoon 0,0868 -> **0,0974** (nur Datamancer) bzw. **0,1063** (mit Tracer-Messung), nicht 0,1206.
* **Warum der Vorsprung schmilzt (der Kern der Korrektur):** Nach ~23:00 steht die Ausdauer nicht mehr am Anschlag
  (`ausdauerLuft` = 1, Hoechstausdauer 174 bei 23:17, 244 bei 03:17, 5.852 bei 10:38), und Overclock (Wert 100/(99-L) x luft) konkurriert mit den
  Chance-Faehigkeiten ueber nahezu gleiche Werte je SP (03:17: O 0,0282, R 0,0277, BI 0,0276, ES 0,0276, D 0,0270,
  SC/DO/T 0,0267). Die Kaufregel gleicht Grenznutzen aus: die Chance-Faehigkeiten stehen im Fix-Lauf bei 03:17 auf
  denselben Stufen wie im Ist-Lauf (BI27 DO31 SC24 R20 ES21 C14), die frei gewordenen ~2.400 SP gehen in Overclock
  (68-74 statt 53). Datamancer und Tracer verdraengen langfristig Overclock, nicht die Chance. Overclock hebt die
  Black-Op-Chance nicht (Erfahrung je Abschluss ~ Aktionsdauer, `Bladeburner.ts:699-729` `getActionStats`:
  `time x BaseStatGain x difficultyMult`; Erfahrung je Stunde ist von Overclock unabhaengig).
* Gegenprobe der Annahme: mit konstanter luft 1,0 reproduziert der Nachbau 03:17 ebenfalls (Chance Nachbau/Ist 1,00),
  mit konstanter luft 0,1 nicht (1,26) - die Ausdauerstatistik aus dem Protokoll ist also die richtige Eingangsgroesse.

### 5. Rang je Stunde - das Raid-Modell der Behauptung ist vorratsfrei, die Wirklichkeit nicht

* Raid-Vorrat 07:33: 0,7; 08:33: 0,7; 09:33: 3,7; 09:59: 9,6 (Naturzuwachs 2,1/480 s = 15,75/h,
  `LevelableAction` growthFunction, `Bladeburner.ts:1387-1390`). Bei Vorratsgrenze zaehlt der Erwartungswert JE
  VERSUCH, nicht die Rate je Zeit (Rate gegen Bestand).
* `verify-g11-rang.mjs` (09:59, Raid L5, Sector-12): Raid p 0,1399 -> 0,1566 (fixDM) -> 0,1709 (fixBoth); EV je
  Versuch 8,12 -> 9,53 -> 10,73 Rang; vorratsbegrenzt 128 -> 150 -> 169 Rang/h. Retirement-Rueckfall p 0,765 -> 0,863
  (+13 %). Summe **+25..+45 Rang/h** (+14..+26 % gegen das 175-Rang/h-Modell des Berichts), nicht +160/h.
* Die "+2,7 Rang/min" gelten nur bei freiem Vorrat (Dauer-Rangrate x1,51).

### 6. Zeitgewinn - nicht 2,9 h

* Modell (`verify-g11-zeit.mjs`): gemessene Typhoon-Bahn (ln Chance 02:17 -> 03:17 +0,133/h), Verhaeltnis Variante/Regel
  je Stand. Das Verhaeltnis ist 03:17 = 1,00, die Chance erreicht 0,90 daher zur selben Zeit (Modell 04:03, real
  gefeuert 03:40): **0,00 h frueher** in allen vier Varianten.
* Die 2,9 h der Behauptung entstehen aus x1,39 (09:59-Wert) / g = 0,115/h. Das Verhaeltnis gilt aber nicht bis zum
  Tor (siehe Punkt 4). Nur wenn die frei gewordenen SP zwingend in Chance-Faehigkeiten gelenkt wuerden (statische
  Variante B, 03:17: x1,86), kaeme man auf ~2,9 h - das ist eine ANDERE Aenderung (Overclock bis Typhoon sperren), und ob
  sie sich lohnt, haengt an Overclocks Rang->SP-Rueckfluss (53 Stufen ~2.090 SP, bei ~1.100-1.900 SP/h Rangzufluss
  00:17-03:17 durch kuerzere Aktionen vermutlich selbst SP-neutral bis -positiv). Offene Frage, nicht Teil von BLADE-2.
* Kette nach Typhoon (Zero..Ultron 06:11-09:52 lokal): Chancen wachsen dort mit ln-Rate ~1,2-1,5/h (Ultron 0,18 ->
  0,63 in 1 h); ein Faktor 1,15-1,3 (Tabelle, 05:17-09:17) verschiebt eine einzelne Chance-Schwelle um ~0,1-0,2 h;
  die letzten drei Black Ops warten ohnehin auf Rang 400.000 (Centurion feuerte 10:25 lokal bei Rang 400.019). Knotenende **-0,1..-0,3 h (GESCHAETZT)**, ca.
  0,5-1 % der 29,9 Knotenstunden.

### 7. Der vorgeschlagene Fix loest nur einen Teil - Loch in D2 bei r <= 0,371

* `chanceAusR` (`src/blade.js:2449-2454`): bei r < 1 und `s.min == 0` Rueckgabe `null`; `spanneGenau` (`:2474`) faellt
  dann auf die ROHE Spanne zurueck. `s.min` ist 0, wenn `(2 real - est) x r <= 0`, also bei `est >= 2 real`
  (r^-0,7 >= 2 <=> r <= 0,3715) oder wenn est an der 1 klemmt und real <= 0,5.
* `verify-g11-schaetznot.mjs` (Nachbau der Funktionskette, Soll/Ist fuer `s.min`: siehe Eichung 4): 7 von 32
  Staenden mit offener Black Op bleiben unaufgeloest, alle nach 20:00 (7 von 17): 03.10. 20:17, 21:17 und 04.10.
  02:17, 03:17, 04:17, 05:17, 07:05; schaetzNot nach dem Fix dort 0,80-1,00. Es genuegt EINE unaufloesbare, fuer
  Entscheidungen scheinbar irrelevante Aktion (z. B. Raid mit wahrer Chance 0,24-0,50), weil `schaetzNot` das Maximum
  ueber alle neun Aktionen nimmt - auch ueber solche mit Vorrat 0 oder die der Bot nie waehlt.
* Folge (`fixDMreal`): Datamancer wird in genau der SP-reichen Spaetphase weitergekauft (Stufe 23 bei 20:17, 29 bei
  21:17-01:17, 46 bei 02:17, 50 bei 03:17; Ist 27 / 29-31 / 43-47 / 50); der Fix schrumpft von x1,25 auf x1,02
  (21:17) bzw. x1,00 (02:17).
* Teillosung: geschlossene Form fuer `s.min == 0 und s.max < 1`: wahre Chance = `s.max x r^0,7` (denn `s.max == est`);
  `verify-g11-geschlossen.mjs`: 7 Faelle, max |Form - Nachbau| = 1,1e-16. Die uebrigen 6 Faelle (est auf 1 geklemmt,
  Paar [0,1]) sind aus dem Paar nicht loesbar. Deshalb ist die robuste Loesung nicht "schaetzNot genauer", sondern das
  Tor an die tatsaechliche Nutzung von Field Analysis zu haengen (Bauvorgabe unten).

### 8. Fehlermodi des vorgeschlagenen Fixes im unbeaufsichtigten Betrieb

1. **Stilles Null durch try/catch**: `schaetzNot` steht in einem `try { } catch { return 0 }` (`:1354-1368`).
   `spanneGenau` liegt 1.100 Zeilen weiter unten (`:2474`); dieselbe Falle hat `klemmFaktor` seit D2 bis zum 03.10.
   auf 1 gehalten. Ein ReferenceError wuerde Datamancer lautlos auf 0 setzen - hier harmlos, aber unbeobachtbar.
   `tools/test-scope-tot.js` laufen lassen, schaetzNot (und das neue Tor) in `blade.json` ausgeben.
2. **Kosten**: `faehigkeitenKaufen` sortiert die elf Eintraege mit `wert(b) - wert(a)`; jeder Vergleich ruft
   `relNutzen`; schaetzNot via `spanneGenau` waeren ~30 Vergleiche x 9 Aktionen x je ~10 `ns.bladeburner`-Aufrufe je
   Kaufversuch. Tragbar, aber vermeidbar (Tor ohne ns-Aufrufe, 5-Minuten-Cache wie `kostenAktualisieren`).
3. **Tracer-Messwert**: `data/aktionen.txt` ist ein Spieler-Protokoll (Rang der Sleeve-Vertraege steckt in fremden
   Abschnitten), faengt erst an zu zaehlen, wenn Abschnitte da sind (Knotenstart: 0 %), und haengt mindestens 5 min
   (Aktualisierungstakt) plus Fensterlaenge hinterher. BN2.2 begann mit 13 % Tracking im ersten Zeitfenster (Raid-Vorrat
   leer). Boden 0,10 statt 0,02; Fenster = juengste 300 Abschnitte wie `kostenAktualisieren`, nur Abschnitte nach
   `nodeReset`.
4. **Senke Overclock**: wer die SP aus Datamancer/Tracer holt, bekommt sie nicht zwingend als Chance zurueck
   (Punkt 4). Das ist kein Fehler des Fixes, aber der Grund, warum die Erwartung "frueher Typhoon" nicht aufgeht.
5. **Abhaengigkeit von BLADE-1**: Je laenger die Division in einer Stadt mit r << 1 bleibt, desto groesser der
   unaufloesbare Anteil. Wird BLADE-1 (Stadtwahl nach wahrer Pop) gebaut, schrumpft er.
6. **Einbau-Tor (AUG-4)** liest `skillLevels.reaper/evasive` aus `blade.json` (`src/bn4rep.js:1680`,
   `src/lib/einbau.js:702`): mehr SP in Chance-Faehigkeiten heben beide leicht - Richtung unkritisch.

## Bauvorgabe (nicht gebaut, `src/` unveraendert)

Datei `src/blade.js`; vor dem Einspielen `node tools/test-scope-tot.js` und ein Nachbau-Lauf von
`tools/audit/verify-g11-sim.mjs` mit den neuen Eingangsgroessen.

1. **Datamancer an Field-Analysis-Nutzung haengen** (statt `schaetzNot()`), `:1182-1213`:
   `return (100 * 5 / (100 + 5 * stufe)) * faTor();` mit `faTor() = faAnteil >= 0.05 ? 1 : 0`, wobei `faAnteil` der
   Zeitanteil von `General/Field Analysis` an den juengsten 300 Abschnitten (nur `von >= knotenStempel`) ist, berechnet
   in `kostenAktualisieren` (`:1992`, gleiche Datei, gleicher 5-Minuten-Takt, kein zusaetzlicher ns-Aufruf).
   Begruendung: unabhaengig von D2-Luecken (7/31 Staende), ohne `ns`-Kosten; faellt FA je wieder an (D2 unsicher),
   wird Datamancer von selbst wieder gekauft. `schaetzNot` und `SPANNE_ZU_BREIT`-Pfad bleiben fuer die FA-Regel (`:3809`).
2. **Tracer-Abdeckung messen**, `:1060` und `:1314-1319`: `abd = (name === "Tracer") ? max(0.10, vertragsAnteil) : ...`,
   `vertragsAnteil` = Summe positiver `rangBis - rangVon` der Abschnitte `Contracts/*` / Summe aller, gleiche
   Datengrundlage wie 1. Der `klemmFaktor()` (Sonde: Black Op + Operation) passt fuer Tracer nicht; eine Vertrags-Sonde
   (beste offene Vertragsart < 0,999) waere richtig - in der Simulation blieb der Faktor fuer Tracer unveraendert
   (ungeprueft, Wirkung klein).
3. **Telemetrie**: `faAnteil`, `vertragsAnteil`, `schaetzNot` roh in `data/blade.json`, damit ein stilles Null sichtbar ist.
4. **Optional, nur wenn die Spanne weiterhin gebraucht wird**: in `chanceAusR` den Fall `r < 1, s.min == 0, s.max < 1`
   mit `s.max * Math.pow(r, 0.7)` beantworten (geschlossene Form, auf 1e-16 geeicht); der Rest ([0,1]) bleibt null.
5. **Abnahme in BN2.2/2.3**: nach ~10 Knotenstunden Datamancer <= 3, Tracer 5-11 ausser in Vertragsphasen;
   Chance-Faehigkeiten (BI+DO+SC) um ~10-20 % hoeher als im Vergleichspunkt BN2.1 bei gleichen SP (BN2.1 09:59: BI7
   DO10 SC8); Rang/h in der Raid-Mangelphase +25..+45. Erwartung NICHT: frueherer Typhoon.

## Beifund (nicht Teil von BLADE-2, ungeprueft ueber die Zahlen hinaus)

* **D2-Loch trifft Entscheidungen, nicht nur schaetzNot**: `beste()` rechnet `netto = rang x s.min - verlust x (1 - s.min)`
  (`src/blade.js:3440`). Bei unaufgeloesten Paaren ist `s.min = 0`, Raid wird mit p = 0 bewertet. Nachbau
  (`verify-g11-unaufgeloest.mjs`): 02:17 Raid L14 wahr p 0,50, EV 90 Rang/Versuch, Vorrat 768; 03:17 L15 0,50 / 99 /
  802; 04:17 L16 0,41 / 89 / 859 (Assassination L11 0,46 / 67 / 967); 05:17 L16 0,45 / 98 / 918; 07:05 L18 0,50 / 132 /
  960. Ob der Bot dort tatsaechlich auf Raid verzichtete, zeigt das Protokoll nur indirekt (Raid-Zeitanteil in den
  zugehoerigen Stunden 0-44 %); eine eigene Pruefung (Befund "BLADE-X: Raid bei r <= 0,37 als p = 0 bewertet") lohnt.
  Die geschlossene Form hilft bei Raid nicht (Paar [0,1]); noetig waere der Operationsnachbau (`AKTIONEN`-Tabelle) im Bot.

## Grenzen und was NICHT geprueft wurde

* Kein dynamisches Modell der Erfahrungs-/Rang-Rueckkopplung (Overclock -> Rang -> SP -> Chance). Der Zeitgewinn ueber die
  Kette (-0,1..-0,3 h) ist geschaetzt; die Chancenfaktoren, SP-Anteile, Rang je Versuch und die Kaufregel sind gerechnet
  und an Spielstandwerten geeicht.
* Die Simulation nimmt je Intervall den Spielerzustand des Endstands (Kampfwerte, Staedte, Vorraete); der Unaufgeloest-
  Anteil (7 von 31) stammt aus stuendlichen Staenden und kann in der Zeit anders liegen.
* Nicht gerechnet: BN3/11/6/7/14/13/15. Qualitativ: BN7/14/13 Skillkosten x2, BN15 x3, Rangfaktor 0,6/0,45/0,2
  (`BitNode.tsx:750-751, 1027-1028, 1072-1073, 1108-1109`) - dort bleiben die SP knapp, der Knoten verbringt mehr Zeit im
  Fruehregime (luft klein, Verhaeltnis 1,1-1,4 gilt laenger), der Nutzen waere relativ groesser (GESCHAETZT).
* Sleeve-Vertragswirkung von Tracer nur aus dem Stand 09:33-09:59 abgeleitet (~7 % des Rangs).

## Reproduktion

    node tools/audit/verify-g11-eichung.mjs BN2L
    node tools/audit/verify-g11-faktor.mjs BN2L1 next
    node tools/audit/verify-g11-botregel.mjs BN2L1_2026-10-03T09-59 -
    node tools/audit/verify-g11-sim.mjs log 0.02 && node tools/audit/verify-g11-auswertung.mjs log
    node tools/audit/verify-g11-zeit.mjs log
    node tools/audit/verify-g11-schaetznot.mjs BN2L
    node tools/audit/verify-g11-rang.mjs
