# Gegenpruefung G03 - Doppelbestellung blockiert Park-Ausbau 600 s (INFRA-1, HACK-2)

Winkel: Substanz und Betrieb. Stand 2026-10-04 13:39 (Systemzeit). Streng lesend:
`src/` unveraendert, Spiel nicht angefasst, nichts committet. Bot master `f1bee88`,
Spielquelle 3.0.2. Neu gegenueber den Befundberichten: die Spielstaende **nach dem
Einbau 03.10. 19:01**, **nach dem Einbau 04.10. 07:05** und **BN2.2 bis 13:17** -
drei weitere Fenster, in denen der Defekt unabhaengig nachgemessen werden kann.

Rechner (alle nur lesend, `tools/audit/`):

| Datei | Was |
|---|---|
| `verify-g03-lib.mjs` | Lader: alle BN2-Staende, Ringpuffer-Logs zusammengefuehrt, Ereignisse, Geld, Ruecklage, Park |
| `verify-g03-gaps.mjs` | Bestellungen, Ergebnisse, Doppelbestellungen, Abstaende, Geld/(2 x Kosten) je Bestellung (`-v`, `-amort`) |
| `verify-g03-yield.mjs` | Ertrag je GB*s je Intervall, Uhr-Eichung Spielzeit/Wanduhr, Bot-Telemetrie grenz/effFlotte |
| `verify-g03-sim.mjs` | Regelkreis-Simulation Kern (10,005 s) + shop (30 s) + Werkzeugstarter, Varianten V0 / F1 / F2 / F3 / F3b / F4 / F12 |
| `verify-g03-cf.mjs` | Gegenlauf "dieselben Ausbauten ohne Sperre" je Fenster, mit Ruecklage und Amortisationspruefung, 3 Eichungen |
| `verify-g03-b256.mjs` | B-Teil von INFRA-1 (21 weitere Ausbauten bis 25 x 256) |
| `verify-g03-bn22.mjs` | B-Teil mit Geld-Rueckkopplung fuer BN2.2 (W4) und BN2.1 nach Einbau (W3) |
| `verify-g03-scan.mjs` | Verbreitung der Signatur `kostet -0.0m` ueber alle Staende |

## Urteil

**BESTAETIGT** (INFRA-1) / **TEILWEISE** (HACK-2). Der Defekt ist echt, laeuft in
diesem Moment in BN2.2 weiter, hat jedes Gegenargument bestanden und kostet in
langen Knoten deutlich mehr als berichtet. Falsch sind drei Nebenbehauptungen,
und die dritte ist bauentscheidend:

- **Haelt:** Mechanismus an jeder Fundstelle (Abschnitt 2), Simulation reproduziert
  die gemessene Zykluszeit auf 0,7 s (630,3 gegen Median 631), 123 ausgefuehrte Ausbauten (244 Bestellungen) in
  vier Fenstern, 91-100 % aller Abstaende liegen im Band 620-642 s. Gegenlauf
  W1 reproduziert INFRA-1 (3,76 Mrd $ bei 40-s-Takt, 3,81 bei 20 s; Bericht 3,81).
  Seit 04.09.2026 (C.7, `dcc7e63`) im Spiel, Signatur in 62 von 69 Staenden mit
  Ausbauzeilen (BN1, 2, 4, 5, 10, 12).
- **Haelt nicht - "mindestens 3,8 Mrd":** 3,8 ist der **Mittelwert** des A-Teils bei
  Durchschnittsertrag, kein Mindestwert. Streng (Grenzertrag 0,6 x Durchschnitt)
  2,3 Mrd. Der Gesamteffekt (A + B) ist groesser: 12,7 Mrd (Band 7,6-12,7).
- **Haelt nicht - Fix "jeder Punkt allein loest es" (HACK-2):** Der dritte Punkt
  ("der Kern bestellt in der Ergebnisrunde nichts") loest **nichts** (Simulation F4:
  640 s statt 630 s). Der zweite/vierte Punkt ("Kern traegt ergebnis.gb in parkRam
  ein") wirkt nur, wenn er NACH `auftragOffen()` (Z.1280) erfolgt - `parkRam` wird
  schon in Z.1276 gebaut (Simulation F3: 630 s, F3b: 10-20 s).
- **Haelt nicht - BN14/15 "350 Ausbauten = 61 h statt 3,9 h":** Hochrechnung auf
  2^20 GB je Rechner ohne Kapazitaetsbremse des Kerns; realistisch bei ~100 Schritten
  17,5 h gegen 1,1 h. Nicht gemessen.
- **Nicht addierbar:** INFRA-1 und HACK-2 sind **derselbe** Defekt. Die Summen (12,7
  und 5-8 Mrd) duerfen in der Statusliste nicht zusammengezaehlt werden; ein Bau-Punkt.

## 1. Eichung (Soll = Spiel/Spielstand, Ist = eigene Rechnung)

| Groesse | Soll | Ist | |
|---|---|---|---|
| Cloud-Preisformel gegen `data/preise.json` (vom Spiel geschrieben, BN2.2 13:17, 20 Groessen) | Spiel | Formel `r*55000*1,3^max(0,log2 r-6)` | max. rel. Abw. **0** |
| Ausbaukosten gegen Logzeile "rund X m" (123 Ausbauten) | Log (auf 0,1 m gerundet) | Formel (cost(to)-cost(from)) | max. 2,27 % (nur 1,76 m -> "1,8m"), sonst < 1 % |
| Zykluszeit zwischen zwei Ausbauten | Median **631 s** (W1 621-939, W2 621-2524*, W3 630-632, W4 631) | Simulation V0: **630,3 s** (min 630,3 / max 640,0) | OK, Abw. 0,7 s |
| Bestellungen je ausgefuehrtem Ausbau | BN2.1 03.10. 04:58-17:17: 66 Bestellungen fuer 33 Ausbauten, 33 Doppel = **2,00** (alle Fenster: 244 Bestellungen, 121 Doppel) | Simulation V0: **2,00** | OK |
| Anteil der Abstaende im Band 620-642 s | W1 96 %, W2 91 %, W3 100 %, W4 93 % | Simulation 100 % | OK; *die Ausreisser in W2 (871/1263/1893/2524 s) sind Vielfache von 631 s = verlorene Logzeilen, keine echten Pausen |
| Park-Rekonstruktion aus Log-Ausbauten gegen `purchasedRamTotal` | Spielstand | Log | W3 5/5 exakt, W4 3/3 exakt, W1 4/7 (Abw. 64-128 GB), W2 2/12 (bis -11 %: Ringpuffer ueberschrieben) |
| Uhr: Spielzeit gegen Wanduhr zwischen zwei Staenden | 1,000 | 1,000 (0,97-1,05 bei Kurzintervallen) | OK; die 600-s-Haltefrist (Wanduhr) = Spielzeit |
| Gegenlauf W1 (INFRA-1) | 3,81 Mrd $ / letzter Ausbau 05:25 / 1,83e7 GB*s | 3,76 (40 s) bzw. 3,81 (20 s) / 05:25:35 / 1,83e7 | OK |
| B-Teil W1 (21 x 128->256) | 8,93 Mrd $ | 8,91 Mrd $ | OK |

## 2. Mechanismus (Datei:Zeile) und Live-Belege

1. `src/shop.js:165-174` schreibt `data/preise.json` samt `park` am Rundenanfang, also
   VOR der Ausfuehrung (`:176-268`). Nach dem Ausbau (`:254`) steht der alte Park
   in der Datei; der Prozess beendet sich sofort (`:309-322`, `runden >= 2`), schreibt also
   nichts nach (im Log sichtbar: jede Bestell-/Ergebnis-Runde startet eine neue
   `shop.js`-pid).
2. `src/bn4net.js:254-272` `auftragOffen()` meldet das Ergebnis und gibt den Weg frei;
   `:1274-1280` baut `pl`/`parkRam` aus `preise.json` (alt) und ruft DANACH `auftragOffen()`;
   `:1452-1454` waehlt den kleinsten Rechner der **Sicht** - das ist wieder der soeben
   ausgebaute (stabile Sortierung, erster kleinster) - und bestellt (`:1523`).
3. `src/shop.js:250-265`: `getServerUpgradeCost(ziel, gb)` liefert -1 (`Cloud.ts:94-103`,
   `ServerPurchases.ts:50-51`: Ziel nicht groesser), `kosten > 0` ist falsch, der
   Zweig `:259-264` setzt `wartetAufGeld`; `erledigt.add` und `meldeErgebnis` kommen nie.
4. `src/bn4net.js:258-261, 270`: ohne Ergebnis zur neuen id gilt der Auftrag 600 s als offen.
   Erst danach bestellt der Kern wieder - gegen die inzwischen frische Tabelle (der
   wartende Shop schreibt sie alle 30 s), also einen echten Ausbau.

Zykluszeit = 600 s Haltefrist + Shop-Tick (~29,7 s, der Tick liegt phasenstarr eine halbe
Minute nach der Bestellung) + Kern-Runde (~0,6 s) = 630,3 s. Das reproduziert die Simulation
ohne freien Parameter.

Live-Belege, unabhaengig von den Befundberichten:

| Fenster | Ausbauten | Abstaende im Band 620-642 s | Median | Geld/(2 x Kosten) bei Bestellung (kleinster Wert) |
|---|---|---|---|---|
| W1 BN2.1 03.10. 04:58-09:59 | 29 | 27 von 28 | 631 | 19,7 |
| W2 BN2.1 03.10. 19:01 - 04.10. 07:05 | 55 (+~8 verloren) | 48 von 53 (Rest = Vielfache) | 631 | 22,3 |
| W3 BN2.1 04.10. 07:05-10:38 | 20 | 19 von 19 | 631 | 36,1 |
| W4 BN2.2 04.10. 10:38-13:17 | 15 | 13 von 14 (ein Ausreisser 20 s: Ausbau ueber den Pfad "Werkzeug wartet" direkt vor dem ersten regulaeren) | 631 | 12-30 (Geld vor 11:17 nur interpoliert) |

W4 ist **nach** den Fixes P0/P1/P2c/P2d und mit Gang: der Defekt laeuft heute. Beispiel
aus `data/bn4net-log.txt`: `11:04:43 werk-0: 64 -> 128 bestellt` / `11:05:13 erledigt (werk-0)` /
`11:05:13 werk-0: 64 -> 128 bestellt` ... naechster echter Ausbau `11:15:14`. Letzter
Spielstand 13:17: Park 2496 GB (12 x 128, 13 x 64), Konto 2,76 Mrd $, Ruecklage 0,17 Mrd.

**Ausgeschlossene Alternativerklaerungen** (jeweils mit einem Werkzeug, das den Fall
haette zeigen koennen):

- *Geld bremst:* Geld/(2 x Kosten) >= 19 (W1-W3, ohne Ruecklage) bzw. >= 12 (W4) bei jeder der 244 Bestellungen; waere Geld
  der Engpass, laegen die Abstaende ueber 642 s, nicht bei 631. Nicht der Fall.
- *Amortisationsdeckel bremst:* Jede Bestellung ist durch die Regel gegangen
  (`amort` W1 177-1042 s bei Deckel 600 bzw. frueh 1800, W4 204-425 s und 1005 s fuer den ersten 32->64 bei Deckel 1800); die Regel bremst zwischen den
  Bestellungen nicht, sonst waeren die Abstaende zufaellig statt konstant.
- *Ruecklage bremst:* An keinem Bestellzeitpunkt war sie bindend (jede Bestellung ging durch, Abstaende auch
  in W3/W4 mit grosser Ruecklage 630-632 s). Ob sie im Gegenlauf bindet, haengt von der Zeit ab: W1 immer 0,
  W2 0 bis 00:17 (der Gegenlauf ist nach ~50 min durch), W3 ab ~08:20 gross, W4 bis 13:17 klein (4-170 Mio).
  Linear zwischen Stunden-Staenden interpolierte Ruecklage ist grob (springt) - das Ergebnis haengt in W1, W2, W4
  nicht davon ab (identische Zahlen mit/ohne), in W3 kostet sie 0,3 Mrd. (Abschnitt 5, Punkt 4.)
- *Es ist die absichtliche 10-min-Haltefrist:* Mit frischer Sicht (F2, F3b) faellt der Zyklus
  auf 10-20 s, die Frist wird nie erreicht - sie ist nur der Rettungsanker fuer einen
  toten Shop, nicht der Takt.

## 3. Zahlen

### A-Teil: dieselben ausgefuehrten Ausbauten ohne Sperre (`verify-g03-cf.mjs`)

Geldregel `2 x Kosten <= Geld - Ruecklage` (bn4net.js:1513), Amortisationspruefung des Kerns
im Gegenlauf (Bot-Grenzertrag zu den Zeitpunkten), Takt 40 s (= Zyklus von F1, Simulation),
Ertrag je GB*s je Intervall gemessen (Zuwachs `moneySourceB.hacking` / Spielzeit / mittlerer
RAM; Rate, nicht Bestand).

| Fenster | Dauer | Ausbauten | Ertrag $/GB*s | Gewinn | je Stunde |
|---|---|---|---|---|---|
| W1 BN2.1 | 5,28 h | 29 | 190-222 | **3,76 Mrd $** (Takt 20 s 3,81; Takt 90 s 3,47) | 0,71 (+15 % der 24,5 Mrd) |
| W2 BN2.1 nach Einbau | 12,07 h | 55 (+~8 verloren, daher konservativ) | 128-249 | **32,3-33,7 Mrd $** | 2,7-2,8 |
| W3 BN2.1 nach Einbau | 3,55 h | 20 | 115-295 | 1,0 Mrd $ (mit Ruecklage; 1,3 ohne) | 0,28 |
| W4 BN2.2 (bis 13:17) | 2,64 h | 15 | 95-117 | 0,29 Mrd $ | 0,11 |

Anlauf-Verzoegerung neuer RAM (900 s, 1800 s) aendert W1 um < 2 %. Takt 20/40/90 s: 3,81 / 3,76 / 3,47.

### B-Teil: was der Kern mit seinen eigenen Regeln zusaetzlich bauen wuerde

- **W1, bis 25 x 256** (INFRA-1 "Fortsetzung"): 8,91 Mrd $ bei Durchschnittsertrag, 5,35 bei
  0,6 x. A + B = **12,7 Mrd $** (7,6 bei 0,6 x) in 5,3 h = 1,4-2,4 Mrd $/h gegen 4,6 Mrd $/h Ist.
- **HACK-2 "25 x 256 statt Ist":** +2688 GB (6400 gegen 3712) x 162-208 $/GB*s =
  **+1,57 bis +2,01 Mrd $/h**. 1,57 (Segmentmodell, r = 0,653) ist der vorsichtige Wert;
  der gemessene Durchschnitt in W1 liegt bei 190-222. Beide stuetzen die Groessenordnung.
- **BN2.2 jetzt** (`verify-g03-bn22.mjs`, Geld-Rueckkopplung, Ruecklage real, Bot-Regel
  Deckel 1800, gemessener Ertrag 95-117 $/GB*s): Gegenlauf-Park 25 x 256 ist 11:30
  erreicht, 25 x 512 um ~12:00.

  | Obergrenze je Rechner | Mehrertrag bis 13:17 (Ertragsfaktor 1,0 / 0,5) | Rate jetzt Mrd $/h (1,0 / 0,5) | Ist-Rate letzte Stunde |
  |---|---|---|---|
  | 256 GB | 3,3 / 1,6 Mrd $ | +1,64 / +0,82 | 2,40 |
  | 512 GB | 7,5 / 3,7 Mrd $ | +4,34 / +2,17 | 2,40 |
  | 1024 GB | 14,6 / 6,6 Mrd $ | +9,75 / +4,88 | 2,40 |

  Die Kapazitaetsbremse des Kerns ist nicht nachgebaut (ohne Obergrenze liefe das Modell auf
  122.880 GB davon, unsinnig); 512 ist belegt: in W2 hat der Kern selbst bei 16 TB Gesamt-RAM noch
  256->512 mit amort 269-278 s bestellt (`verify-g03-gaps.mjs -amort`). **Kein Wert fuer 1024 oder
  mehr empfehlen.**
- **W3 mit Ruecklage** (BN2.1 nach Einbau 07:05): 25 x 256 +9,0 Mrd $ in 3,55 h, 25 x 512 +22 Mrd
  (Faktor 1,0; ungeeicht).

### Wie belastbar ist "Durchschnittsertrag = Grenzertrag"?

Das ist die einzige ungeeichte Annahme. Befunde: (a) Bot-Telemetrie `grenz` ist fast immer
**ueber** dem Durchschnitt fuer die ersten GB (BN2.1 09:59: 338 / 295 / 193 gegen effFlotte 227;
BN2.2 13:17: 434 / 245 / 111 gegen 300) und faellt erst bei +16 TB unter ihn; (b) W2: Park +7,3 TB
(2,4 -> 9,7 TB) hob den Ertrag je GB von 128 auf 249 - Level (+76) und Park sind verknuepft,
aber der Ertrag je GB fiel nirgends; (c) *aber* gemessen/Modell ist in jungen Knoten klein (BN2.2
0,34-0,42, BN2.1 nach Einbau 0,45-0,64, W1 ~1,0) - der Bot **ueberschaetzt** die Amortisation
in den ersten Stunden um den Faktor 2-3, ohne dass das den Befund aendert (Deckel 1800 s heisst real
bis ~75 min bei >= 12 h Einbausperre). Regressions-Versuch ueber alle Intervalle verworfen
(Anlauf-Intervalle, RAM/Level/Anlauf kollinear, b = -2,6 = Unsinn). Deshalb Band
0,5-1,0 x Durchschnitt und Basis GERECHNET_GEEICHT nur fuer den A-Teil.

Gesamtwirkung auf das Knotenende (h) ist **nicht gerechnet**: Geld wirkt ueber Torrunde ->
Kampfwerte -> Rang (ETA Rang 400.000 laut `ausgang.json` > 600 h); das ist eine andere Kette
und gehoert in die Torfrequenz-Pruefung. Alternativverwendung des Geldes vor dem Tor: keine
(Konto 2,76 Mrd $ liegt brach, Ruecklage 0,17 Mrd), der Ertrag ist netto.

## 4. Fix-Varianten in der Regelkreis-Simulation (`verify-g03-sim.mjs`)

3 Stunden, 25 Rechner 64 -> 1024 GB, 40 Laeufe je Variante. Ausbauten je 3 h begrenzt durch
die Obergrenze (100).

| Variante | Aenderung | Abstand zwischen Ausbauten (s) min / Median / max | Bestellungen je Ausbau |
|---|---|---|---|
| V0 | Ist | 630,3 / 630,3 / 640,0 (18 Ausbauten in 3 h) | 2,00 |
| F1 | shop meldet `kosten <= 0` als erledigt | 30,3 / **40,0** / 40,0 | 2,00 |
| F2 | shop schreibt `preise.json` nach der Ausfuehrung neu (vor dem Ergebnis) | 0,3 / **10,0** / 30,0 | 1,00 |
| F3 | Kern traegt Nachtrag in `auftragOffen()` ein, Sicht (`parkRam`) schon vorher gebaut | 630,3 / 630,3 / 640,0 | 2,00 - **wirkungslos** |
| F3b | Kern fuehrt die Sicht erst NACH `auftragOffen()` zusammen | 0,3 / 10,0 / 30,0 | 1,00 |
| F4 | Kern bestellt in der Ergebnisrunde nichts | 640,3 / 640,3 / 650,0 | 2,00 - **wirkungslos** |
| F12 | F1 + F2 | 0,3 / 10,0 / 30,0 | 1,00 |

Grund fuer F4: der Shop beendet sich nach dem Auftrag (`runden >= 2`), `preise.json` bleibt bis zum
naechsten Shop-Start alt; die uebersprungene Runde aendert die Sicht nicht, die naechste bestellt
denselben Rechner. Der Bericht (HACK-2) behauptet, jeder der drei Punkte loese es allein.

Einfluss des Zyklus auf den Gewinn (BN2.2, Cap 512): Takt 10 s 7,85 Mrd, 20 s 7,83, **40 s 7,51**,
90 s 4,89. F1 (40 s) genuegt, hat aber wenig Reserve gegen Verzoegerungen; F12 gibt Spielraum.

## 5. Fehlermodi der Loesung im unbeaufsichtigten Betrieb

Welche Uhr / Stillstand / Rate-Bestand: Haltefrist und Shop-Takt sind Wanduhr = Spielzeit (1,000).
Nach Rechner-Stillstand oder Reload liegt ein alter Auftrag in `kaufauftrag.json`; V0 fuehrt ihn
womoeglich aus oder haelt 600 s, F1/F12 verwerfen ihn in einer Runde - besser als heute.

1. **Log-Flut.** F1 allein: 4 Zeilen je ~40 s in `bn4net-log` (Ringpuffer; die Stunden-Saves
   decken schon heute W2 nur zu ~89 % ab). Folge: Audit-Rechner und /bb verlieren Zeilen. F12 halbiert es.
2. **shop.js (7,00 GB) startet alle 10-40 s statt alle 630 s.** Findet der Starter auf home keine 7 GB,
   raeumt er Arbeiter (Rangfolge share zuerst, hack zuletzt) - bei knappem home (Kaltstart 32-128 GB)
   ginge fliegende Arbeit verloren. BN2.2: `homeFrei` 126 GB, kein Problem; der Ausbaupfad beginnt
   erst nach 25 Kaeufen (home dann >= 128 GB, `reserveHome`). In BN9 (Limit 0) kein Park, nicht betroffen.
3. **Mehr Ausgaben in der ersten Stunde.** 25 x 512 kostet 1,46 Mrd $ (25 x (61,87 - 3,52 Mio)),
   Amortisation real 20-40 min. Konkurrenz um dasselbe `geldFrei`: gang.js (Geldmodus, Ausruestung),
   homegrow, hashes. Der Kern darf nur `Geld - Ruecklage` ausgeben (`bn4net.js:1272`).
4. **Ruecklage frisst die Amortisation (Wechselwirkung P1/P2d).** `gateBedarf = plan.cost` (bn4rep.js:1689)
   ist "was die beste Runde mit dem Geld JETZT kaufen wuerde", also ~ Geld: W3 hatte Konto 6,08 Mrd
   und Ruecklage 6,02 Mrd (08:17), 28,25 / 28,21 Mrd (10:38). Dann bleiben 43 Mio - 2,3 Mrd `geldFrei`,
   Schritte 256->512 (2 x 38,1 Mio) und tiefer fallen durch, obwohl sie sich in 6-10 min bezahlen. Der
   Gewinn des Fixes konzentriert sich deshalb auf die erste(n) Stunde(n) nach Einbau/Sprung (Ruecklage noch 0
   bis klein). Eigener Folgebefund, nicht G03: kurze-Amortisations-Investitionen duerfen die Ruecklage
   unterlaufen, wenn sie sich vor dem Tor bezahlen.
5. **Kapazitaetsbremse mit Verzoegerung.** `ueberschussMerker` (bn4net.js:1493) stammt aus der Vorrunde;
   bei 10-s-Zyklus kann der Kern 1-3 Schritte (je <= 256-512 GB) ueber den Bedarf hinausschiessen. Begrenzt.
6. **Werkbank = groesster Rechner** (`bn4net.js:1560-1563`). Park-Rechner mit 1024 GB koennen Werkbank
   werden; laufende Werkzeuge werden nicht umgezogen (Laufpruefung netzweit), nur neue starten dort. Kein Kill.
7. **Modell ueberschaetzt in jungen Knoten** (gemessen/Modell 0,34-0,64): im V1-Knoten mit 20-97-min-Zyklen und
   Deckel 600 s wird die reale Amortisation bis ~25 min lang. Die Sperre war dort eine ungewollte Bremse; mit dem
   Fix gilt die Regel allein. Vor BN8 (V1, Einbau alle 20-97 min) die reale Amortisation pruefen.
8. **Latente zweite Verklemmung:** `getServerUpgradeCost` liefert `Infinity`, wenn `gb > limitRam` (kein -1);
   `kosten > 0 && kosten <= geld` ist falsch -> "warte auf Geld". Der Kern bestellt nie ueber `maxGb`, aber der
   Fix sollte `!Number.isFinite(kosten)` mit abfangen.

## 6. Bauvorgabe

Eine Datei, kein Kern-Eingriff, kein Kern-Neustart: **`src/shop.js`**.

1. Preistabellen-Block (`:149-174`) in eine Funktion `schreibePreise(jetzt)` ziehen. Gleiche `ns.cloud.*`-Aufrufe,
   Statik-RAM bleibt 7,00 GB. Aufruf wie bisher am Rundenanfang UND nach jeder Ausfuehrung (Kauf, Ausbau, Ablehnung),
   **immer vor `meldeErgebnis`**.
2. Ausbau-Zweig (`:249-266`): drei Faelle statt zwei:
   - `kosten > 0 && Number.isFinite(kosten) && kosten <= geld` -> wie bisher, danach `schreibePreise`, dann Ergebnis.
   - `!(kosten > 0) || !Number.isFinite(kosten)` (-1, Ausnahme -> 0, Infinity) -> `erledigt.add`;
     Ziel-RAM `ns.getServerMaxRam(ziel) >= gb` ? Ergebnis `erfolg: true, "schon"` : `erfolg: false, "abgelehnt"`; vorher `schreibePreise`.
   - sonst (`kosten > geld`) -> `wartetAufGeld` wie bisher.
3. **Nicht bauen:** "Kern bestellt in der Ergebnisrunde nichts" (F4, wirkungslos). Falls der Kern zusaetzlich nachfuehren
   soll: Eintrag NACH `auftragOffen()` (Z.1280) in die Sicht, nicht in `parkRam` (Z.1276), und verwerfen, sobald
   `preise.json.ts` juenger als das Ergebnis ist.
4. Tests: neu `tools/test-shop-ausbau.js` mit Mock-ns (Muster `test-kern-c789.js`): (a) Ziel-RAM == gb -> Ergebnis
   in Runde 1, `state: "wait"`, Prozess endet in Runde 2; (b) bezahlbarer Ausbau -> `preise.json.park[ziel].ram == gb`
   und `preise.ts >= ergebnis.ts`; (c) zu wenig Geld -> `blocked/money` bleibt (Regression); (d) `Infinity`/Ausnahme ->
   erfolg:false, kein Haenger; (e) Kauf mit vollem Park -> `park_voll` unveraendert. Referenz der Zykluszeit:
   `node tools/audit/verify-g03-sim.mjs` (V0 630 s, F12 ~20 s).
5. Einspielen: `shop.js` laeuft auf Abruf; der alte Prozess beendet sich nach seinem naechsten Auftrag, der naechste
   Start nimmt den neuen Code. Fuer sofortige Wirkung den Shop einmal beenden - der Kern startet ihn binnen 10 s (offener Auftrag).
6. **Skeptiker-Pflicht:** laeuft unbeaufsichtigt (Ausbau-Pipeline), also Skeptiker vor "fertig", `[skeptiker]` im Commit.
7. Abnahme live (BN2.2 nach Einspielen, sonst nach naechstem Einbau/Sprung): Median-Abstand der Ausbau-"erledigt"-Zeilen
   <= 60 s (Soll gegen 631 s), keine `kostet -0.0m`-Zeile mehr in `shop-log`, Park >= 25 x 256 binnen 30 min (Geld
   vorausgesetzt), <= 2 "bestellt"-Zeilen je Ausbau (F12: 1). Rollback: `git revert` auf `shop.js`, keine Migration.

## 7. Was nicht gerechnet wurde / offen

- Wirkung auf das Knotenende (h): nicht gerechnet (Geld -> Torrunde -> Kampfwerte -> Rang).
- Grenzertrag ueber 25 x 512 hinaus; echter Wert erst nach dem Fix messbar (Kapazitaetsbremse `kapFreiGb` 16,9 TB
  in BN2.2 laut Telemetrie, Modell nicht nachgebaut).
- Verworfene Zeitlinie (G02): Staende 03.10. 17:16-18:39 tragen `lastSave` 08:32:54Z; sie gehen in keine Zahl dieses
  Berichts ein (W1 endet 09:59, W2 beginnt mit dem Einbau 19:01).
- BN8 (V1, Boerse): Sperrfrage INFRA-5 bleibt zurueckgestellt.
