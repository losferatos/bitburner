# Gegenpruefung G10 (BLADE-1) - Stadtwahl haelt ausgebrannte Stadt

Pruefer: Gegenpruefer G10, Winkel Substanz + Betrieb, Systemzeit 04.10.2026 13:37.
Streng lesend: `src/` unveraendert, Spiel nicht angefasst, nichts committet. Quelle
Spiel 3.0.2 (`reference/bitburner-src/src/Bladeburner/`), Bot master (blade.js nach
ce6262d; die Zeilen im Inventar sind seit dem 04.10. um 44 verschoben).
Rechner: `tools/audit/verify-g10-*.mjs` (zehn Dateien, Liste unten). Rechenlast 1 Kern.

## URTEIL: TEILWEISE

Der Mechanismus haelt, und er ist haeufiger und teurer als im Inventar gezeigt. Nicht
haelt die Zahl "+450 Rang/h" als Dauerwert und die Fix-Skizze ohne Schutzregeln.

| Teilbehauptung | Urteil | Kern |
|---|---|---|
| Raid-Fehlschlag senkt pop, nicht popEst; Chance haengt an der wahren pop | BESTAETIGT | Quelle + zwei Spielstand-Eichungen (E1, E3) |
| Bot-Regel (popEst/Chaosfaktor, Vorsprung 2) haelt die Division in der schlechten Stadt | BESTAETIGT, haeufiger als gedacht | 63 Staende aus 9 V2-Laeufen, Live-Lage BN2.2 |
| Wechsel kostet seit D2 nichts | BESTAETIGT mit Bedingungen | Quelle, Protokoll, Praezedenz `bbspann.js`; D2 nur bei offener Black Op und sicherem r |
| "+450 Rang/h" in BN2.1 | TEILWEISE | Momentaufnahme x Obergrenze 42,7 Versuche/h; geeicht dynamisch +35 ... +335 Rang/h (nur Raid) |
| "Regel war schon wirksam, nur zu spaet" (Auftrag G10) | BESTAETIGT fuer BN2.1, FALSCH fuer BN2.2 | siehe Abschnitt 4 |
| Fix-Skizze | TEILWEISE | 6 Luecken, Bauvorgabe unten |

## 1. Eichung (Soll = Spielstand, Ist = Nachbau)

Formel-Nachbau `blade-formeln.mjs` (aus Action.ts, vom Inventar), hier erneut gegen
echte Werte gehalten (`verify-g10-eichung.mjs`):

| Wert | Soll | Ist |
|---|---|---|
| Typhoon-Chance BN2.1 09:59 | 0,0867 | 0,0868 |
| Typhoon-Chance BN2.2 12:17 | 0,0306 | 0,0306 |
| Raid L1 s.min BN2.2 12:17 (Sector-12, r 0,9987) | 0,077 | 0,0769 |
| Raid L2 s.min BN2.2 13:17 (Sector-12, r 0,7453; Zweig `low *= r`) | 0,051 | 0,0514 |
| Raid-Rang BN2.1 ganzer Knoten (Summe Protokoll gegen Zaehler x 55 x 1,1^(L-1) - Fehlschlaege x 2,5 x 1,1^(L-1)) | 28.131 | 28.435 (+1,1 %) |

Monte-Carlo der Stadtdynamik `verify-g10-stadtsim.mjs` (Quelle: `Bladeburner.ts`
completeOperation, randomEvent, `City.ts`, `LevelableAction.ts`), 2000 Laeufe:

| Eichung | Soll | Ist (Median, 10-90 %) |
|---|---|---|
| E1 Sector-12 BN2.1 05:33 -> 09:59, 129 Versuche: popEst | 899 Mio | 906 Mio (872-935) |
| E1 pop | 587 Mio | 448 Mio (279-686) |
| E1 Gemeinden | 41 | 40 (39-42) |
| E1 Chaos (Ereignis-Aufschlag, Rauschen) | 49,1 | 67,2 (45-119); ohne Ereignisse 49,4 |
| E2 Streuung pop ungenutzter Staedte (RMS ln, 4,4 h) | 0,367 | 0,324 |
| E3 Sector-12 BN2.2 11:17 -> 13:17, 49 Versuche: popEst | 780 Mio | 772 Mio (765-780) |
| E3 pop | 582 Mio | 711 Mio (527-975) |
| E3 Gemeinden | 136 | 135 |
| E4 Versuche bis zum ersten Wechsel der Bot-Regel (Start 05:33) | 129-136 | 134 (110-150) |

popEst und Gemeinden treffen auf 1 %, die Zufallsgroessen (pop, Chaos) liegen
innerhalb des 10-90-%-Bandes. E4 ist die wichtigste: das Modell der Bot-Regel
reproduziert den echten Wechselzeitpunkt (Chaos 51, nach ~134 Versuchen).

## 2. Was am Inventar haelt (mit Fundstelle)

- **Quelle:** Raid-Erfolg `changePopulationByPercentage(-1, changeEstEqually: true)`,
  Fehlschlag `-0,5 ... -1 %` mit `changeEstEqually: false` (`Bladeburner.ts` completeOperation
  Raid). `getPopulationSuccessFactor` nutzt `est` nur fuer die Anzeige, `attempt()` die wahre
  pop (`Action.ts:88-92`). E1/E3 bestaetigen das: popEst faellt nur mit den Erfolgen.
- **Wechsel kostet nichts:** `switchCity` setzt nur `bladeburner.city` (`NetscriptFunctions/
  Bladeburner.ts:314-319`); `this.city` wird sonst nirgends geschrieben, keine Zeit, kein Rang,
  keine Ausdauer. Die Spielerstadt ist ein anderes Feld (Spielstand BN2.2 12:17: Spieler in
  Ishima, Division in Sector-12). Protokoll BN2.1: der Wechsel Sector-12 -> Ishima fiel um
  10:22; die erste Aktion danach war ein 617-s-Raid-Block mit +422 Rang (`verify-g10-wechsellog.mjs`),
  keine Field Analysis, kein Leerlauf.
- **D2 greift fuer Fremdstaedte nach Probewechsel:** `getActionEstimatedSuccessChance` hat keine
  Verfuegbarkeitspruefung (`NetscriptFunctions/Bladeburner.ts:138-142`), `getNextBlackOp` liefert
  die naechste Op auch bei zu niedrigem Rang. Die Spanne einer Black Op ist `[real*r, real]` (r<1)
  bzw. `[real, min(1, real*r)]` (r>=1), `Action.ts:144-167`.
- **Der Befund ist keine Momentaufnahme des 09:59:** `verify-g10-snapshots.mjs` bewertet jeden
  Stand mit aktiver Division nach `(pop/1e9)^0,7 / Chaosfaktor` (proportional zur Chance jeder
  Nicht-Black-Op-Aktion). Verhaeltnis beste Stadt nach wahrer pop gegen aktuelle Stadt, 63 Staende
  aus BN2, BN4, BN9, BN10: Mittel x1,83, Median x1,40, 10 % x1,00, 90 % x2,65; Anteil > 1,2: 63 %,
  > 1,5: 41 %. Die Bot-Regel haette nur in 2 von 63 Staenden gewechselt.
- **Live BN2.2 13:17:** Sector-12 pop 582 Mio (Faktor 0,68, Chaos 0,0), Volhaven 1540 Mio (1,35),
  Neu Tokyo 1462, Ishima 1408, Chongqing 1397, Aevum 887. Vorteil x1,98 fuer Volhaven. Bot-Regel:
  Aevum popEst 1486 Mio gegen Sector-12 780 Mio = 1,905 < 2, kein Wechsel. Stand 12:17 (Sector-12
  noch 815 Mio): Raid L1 p 0,077 (EV 1,93 je Versuch) in Sector-12 gegen 0,114 (EV 4,04) in
  Volhaven; um 13:17 steht Raid L2 in Sector-12 nur noch bei s.min 0,051.

## 3. Was nicht haelt - Korrektur der Zahl

### 3a. "+450 Rang/h" ist Momentaufnahme mal Obergrenze

Inventar: EV je Versuch 8,12 -> 18,88 (reproduziert, `blade-stadt.mjs`: p 0,140/0,268, Gewinn
80,5, Verlust 3,66) mal 42,7 Versuche/h. 42,7 = 3600/77 x 0,914 ist die Taktgrenze bei
UNBEGRENZTEM Vorrat. Gemessen (Zaehler ok+fehl je Stand): 37/h (05:33-06:33), 33/h, 25/h
(Vorrat leer), 21/h; BN2.2 49 Versuche in 2 h = 24,5/h. Bei Vorratsbindung (Raid waechst
2,1/480 s = 15,75/h) sind es 16/h. Rate gegen Bestand: die 42,7 stammen aus dem Bestand.
Ausserdem steht der Vergleich am Ende des Burns von Sector-12; der Durchschnitt ueber den
Knoten ist ein anderer.

Dynamische Rechnung (`verify-g10-stadtsim.mjs`, geeicht wie oben), Zufallsstart wie
City-Konstruktor, Division startet in Sector-12, nur Raid, Kompetenz waechst mit g 0,23/h
(BN2.1: K von 0,082 auf 0,242 in 4,4 h; BN2.2 live bisher 0,38/h):

| Versuche/h | Mittel Std 1-3 | Mittel Std 1-6 | Mittel Std 1-10 | relativ (Std 1-10) |
|---|---|---|---|---|
| 16 (Vorrat gebunden) | +32 Rang/h | +80 | +177 | +60 % |
| 25 (BN2.2 gemessen) | +57 | +137 | +238 | +53 % |
| 40 (Obergrenze) | +112 | +216 | +335 | +51 % |

Reiner Raid, Vergleich Fix-Regel gegen Bot-Regel. Die Spitzenwerte spaeter in der Phase
(+300 ... +450/h) liegen im Bereich der Inventarzahl, der Dauerwert nicht. Ohne
Kompetenzwachstum (K konstant) ist der Absolutwert kleiner (+20 ... +87/h), relativ
+40 ... +175 %.

### 3b. Fuer das LAUFENDE BN2.2 gilt mehr, weil der Start ungluecklich ist

`verify-g10-livestart.mjs`: echter Zustand 13:17 (Sector-12 582 Mio gegen vier Staedte > 1,3 Mrd),
K aus den Staenden 0,0634 / 0,0889 / 0,1365, Raid L2. Gewinn Fix gegen Bot je Stunde (Mittel
ueber die naechsten 3 / 6 / 10 h), g 0,23:

| Versuche/h | Std 1-3 | Std 1-6 | Std 1-10 |
|---|---|---|---|
| 16 | +148 | +223 | +434 |
| 25 | +228 | +339 | +601 |
| 40 | +354 | +500 | +666 |

Bei K konstant: +100 ... +250 Rang/h. Das ist die Groessenordnung des Inventars - fuer diesen
Moment, nicht fuer jeden Knoten.

### 3c. Rang ist nicht Knotenzeit

Die Spielstaende zeigen: Typhoon-Chance 0,357 (23:17) -> 0,811 (03:17) bei Rang 8,8k -> 24,9k,
also Chance ~ Rang^0,79 (SP = Rang/3 kaufen die Chance-Faehigkeiten). Die Phase bis zur ersten
Black Op ist rang-gebunden, die Endphase nicht: Assassination lief ab 08:17 mit 203 -> 469 Erfolgen
bei 62 Fehlschlaegen (p~1, Aevum pop 373 Mio, r 0,30), da ist die Stadt egal.

Umrechnung auf Knotenzeit (GESCHAETZT, zwei unabhaengige Wege):
(1) BN2.1 Phase B (23:17-07:17 Ortszeit): der Bot lag in Volhaven bei pop 111-421 Mio, Chongqing und
Neu Tokyo hatten 720-930 Mio (Vorteil x2,0-3,0). Die Raid-Chance stand bei ~0,63 (ok 90 / fehl 53),
die bessere Stadt haette sie an die Klemme 1 gebracht, also bis +50 %. Rang in dem Fenster: Raid
20.600, Assassination 14.500, Stealth Retirement 4.500 (Summe 40.000 von 8.800 -> 50.800). Nur Raid
+50 % = +10.300 Rang (x1,20 am Fensterende), mit Assassination (p 0,65 -> 0,95) +17.000 (x1,33).
Bei dem echten Wachstum 0,25/h (Verdopplung ~2,8 h) sind das 0,7-1,1 h.
(2) Zwei-Phasen-Simulation (Raid dann Assassination, `verify-g10-stadtsim.mjs`): Rang am Ende
+42 % / +21 % / +17 % fuer Raid-Dauer 6 / 10 / 14 h; mit 0,25/h (Phase B) bis 0,7/h (Phase C):
0,3-1,4 h.
(3) Gegenprobe ueber die Chance: Chance ~ Rang^0,79 (gemessen 23:17-03:17); +20-33 % Rang = x1,16-1,25
Chance, die Schwelle 0,9 faellt statt gegen 03:45 gegen ~02:55.
**Korrigierter Ertrag: ~1 h je V2-Knoten (0,6 - 1,5 h), das sind 2-4 % von 34-42 h.** Bei ~20
V2-Knoten der Restroute 12-30 h.

### 3d. Einwand "Reserve" geprueft und nicht tragend

Die gleichmaessige Abnutzung laesst keine frische Reservestadt fuer spaeter: Beste Stadt am
Ende der Raid-Phase Bot 1,67 gegen Fix 1,20 (H 10). In der Zwei-Phasen-Simulation bleibt der
Fix trotzdem vorn (Rang am Ende +17 ... +42 %). Grund: Phase C hat p ~ 1, die Reserve zahlt
dort nichts.

## 4. Live-Lage: war die Regel schon wirksam, nur zu spaet?

**BN2.1: ja.** Die Regel feuerte bei Chaos ~51 nach ~134 Versuchen (E4: Sim 134, echt 129-136).
Die bevoelkerungsbewusste Regel (Vorsprung 1,2) haette bei 07:33 (Vorteil x1,32), spaetestens
08:33 (x1,84) gewechselt, ca. 2,8 h frueher. In der Zwischenzeit 09:57-10:22 lief der Motor
25 min Retirement und Kammer im Wechsel (Bot-Bewertung "Ertrag 2,34 vor Raid 2,15"): 37 Rang in
25 min; direkt nach dem Wechsel 422 Rang in 617 s. Das Muster wiederholte sich: Ishima
(Pop 436-658 Mio, Chaos 47-49) gegen Volhaven 1,06-1,19 Mrd (x1,4-1,9) ueber ~4 h, mit 57 min
Diplomacy; Volhaven (pop 111-421 Mio, x2,0-3,0) ueber ~7 h.

**BN2.2: nein.** Dort startet Chaos bei 0 und bleibt bei 0 (`changeChaosByPercentage` mit 0 ist 0;
nur Aufruhr-Ereignisse setzen +1). Sector-12 steht nach 49 Raids bei Chaos 0,0. Der Chaos-Ausloeser
der Bot-Regel ist damit tot, es bleibt nur das popEst-Verhaeltnis > 2, und das fiele auf Aevum
(popEst 1486 Mio veraltet, wahre pop 887 Mio, zweitschlechteste Stadt). Erwartet bei ~6 weiteren
Erfolgen, rund 3 h.

## 5. Gegenargumente, die ich gesucht habe

| Einwand | Ergebnis |
|---|---|
| Wechsel hat versteckte Kosten (Reise, Rang) | nein, Quelle und Protokoll |
| D2 gilt nur fuer die aktuelle Stadt | stimmt; Probewechsel noetig, atomar machbar (Praezedenz `bbspann.js:330-394`) |
| r aus der Black-Op-Spanne nicht immer bestimmbar | Fall r>=1 mit `boReal*r >= 1` unsicher. Frueh im Knoten (boReal 0,03-0,15) nie, spaet ja - dort p~1, egal |
| Vorrat, nicht Chance, bindet | stimmt in Vorrats-Phasen (A 16): Gewinn +32 ... +177 statt +335 |
| Gleichmaessiger Verbrauch zerstoert die Reserve | geprueft, siehe 3d, nicht tragend |
| Rauschen im gemessenen r | robust bis +-20 % (Gewinn 64 gegen 65 %), +-40 % noch 58 % |
| Vorsprung 1,2 flattert | Wechsel je 10 h: Marge 1,0 -> 78, 1,05 -> 17, 1,2 -> 7, 1,5 -> 3,7. Gewinn Marge 1,2: +65 %, Marge 1,5: +62 %. Keine Flattergefahr ab 1,1 |
| Chaos-Kosten bleiben beim Wechsel haengen | im Wert enthalten (`faktor(chaos)`); Diplomacy-Zeit des Bots (57 min im Beispiel) entfaellt eher |

Nicht nachgerechnet: Sleeve-Vertrags-Faktor "x1,9" und "Retirement p 0,765 -> 1,0" aus dem
Inventar (Retirement p ist in den 09:59-Zahlen reproduziert: 0,765 / 1,0).

## 6. Fehlermodi der Loesung im unbeaufsichtigten Betrieb

`waehle()` laeuft in JEDEM Tick (`blade.js:4428`, nach `nextUpdate()`), nicht je Aktion.

1. **Probe nicht atomar:** ein Fehler zwischen `switchCity(Fremdstadt)` und Rueckkehr laesst die
   Division verstellt, eine laufende Raid schliesst dann in der falschen Stadt ab (die Aktion
   wertet beim ABSCHLUSS in `getCurrentCity()`, `Bladeburner.ts` completeAction). `try/finally`,
   kein `await` dazwischen, Pruefung am Rundenende `getCity() === hier`.
2. **`spanne()` verschluckt Fehler** und liefert `{min:0,max:0}` (`blade.js:877-883`): daraus
   folgt r = 0, pop = 0, und die aktuelle Stadt sieht leer aus - Flucht in eine beliebige Stadt
   bei einem einmaligen API-Fehler. `bo.max > 0` und r > 0,05 verlangen, sonst "unbekannt".
3. **`rAusBlackOp` unsicher:** r = 1/boReal (Untergrenze) oder r = 1 (Standard) darf nicht als
   Punktwert fuer die AKTUELLE Stadt gelten. Unbekannt -> keine Entscheidung, alte Regel.
4. **Alte Regeln kollidieren:** popEst-Regel (Vorsprung 2, `blade.js:2788-2825`) und Rundreise
   (`:2827-2850`) wuerden nach der neuen Entscheidung in die popEst-schlechtere Stadt zurueck-
   springen. Nur ausfuehren, wenn die neue Regel keine Lage hat.
5. **Gemeinden:** Raid braucht comms >= 1 (`Operation.ts:63-68`). Ohne Filter wechselt die neue
   Regel in eine pop-reiche Stadt mit 0 Gemeinden, die Rundreise zurueck: Pendeln. Wert 0 bei
   comms < `RAID_VORRAT_MIN` (3).
6. **Stumm:** die Probe darf wie die toten Black-Op-Aufrufe vom 03.10. nicht still scheitern.
   Zaehler `probeOk`, `probeFehler`, `letzterWechsel` in `blade.json`, `/bb`-Zeile.
7. **Echtzeit gegen Spielzeit:** keine Zeitfrist, keine `Date.now()`-Schwelle in der Regel;
   Entscheidung je Tick aus Zustand. Beim Offline-Nachholen laufen mehr Ticks, nicht andere.
8. **Aktion wird beim Wechsel neu gewaehlt:** gleiche Aktion -> `gleich`, Fortschritt bleibt, die
   Raid schliesst in der neuen Stadt ab. Andere Aktion -> `startAction`, Fortschritt (hoechstens
   ein Durchlauf, <= 77 s) verloren. Bei Vorsprung 1,2 und 7 Wechseln je 10 h vernachlaessigbar.
9. **RAM:** keine neue NS-Funktion (`switchCity`, `getCityEstimatedPopulation`,
   `getActionEstimatedSuccessChance`, `getNextBlackOp` sind schon im Skript).
10. **Gleichzeitige Skripte:** Netscript ist zwischen zwei `await` synchron, eine Probe ohne
    `await` ist atomar (so auch `bbspann.js:319-322` begruendet).

## 7. Bauvorgabe

Datei `src/blade.js`, Block bei `STADT_VORSPRUNG` (`:2788`), Aufwand S (~70 Zeilen + Test).

```
// vor waehle(), nach rAusBlackOp/spanneGenau (Zeile ~2478), reine Entscheidung testbar:
const waehleStadt = (lage, hier, marge) => ...   // rein, ohne ns
const stadtLage = () => {                         // synchron, ohne await
  const hier = ns.bladeburner.getCity();
  const bo = ns.bladeburner.getNextBlackOp();     // null -> return null
  const boReal = blackOpChance(bo.name);          // stadtunabhaengig, einmal je Runde
  // boReal nicht endlich oder <= 0 -> return null
  try {
    for (const stadt of STAEDTE) {
      if (ns.bladeburner.getCity() !== stadt) ns.bladeburner.switchCity(stadt);
      const sp = spanne(B, bo.name);              // Pruefung bo.max > 0
      const rr = rAusBlackOp(sp, boReal);
      lage[stadt] = { sicher: rr.sicher && rr.r > 0.05, r: rr.r,
        pop: rr.r * ns.bladeburner.getCityEstimatedPopulation(stadt),
        chaos: ns.bladeburner.getCityChaos(stadt),
        comms: ns.bladeburner.getCityCommunities(stadt) };
    }
  } finally { ns.bladeburner.switchCity(hier); }
};
```

Regeln:
- Wert = `(pop/1e9)^0,7 / faktor(chaos)`, 0 bei comms < 3. Faktor wie Spiel: Chaos > 50 -> sqrt(1+chaos-50).
- Wechsel, wenn Wert(beste) > 1,2 x Wert(hier). Beste nur unter Staedten mit `sicher`, ausser
  Untergrenze schlaegt schon die Marge. Aktuelle Stadt unsicher oder Lage null -> alte Regel
  unveraendert (Rueckfall, nie Ersatz ohne Daten).
- Hat die neue Regel eine Lage (Wechsel oder Bleiben), laufen popEst-Regel und Rundreise NICHT.
- Rundreise-Konstante `RUNDREISE_MIN_COMMS` bleibt fuer den Rueckfall.
- Danach `chaosMessen()` (steht ohnehin bei `:2943` nach den Stadtbloecken).
- Telemetrie `stadtWahl: {hier, beste, vorteil, sicher, probeOk, probeFehler, wechsel, letzterWechselRang}` in `blade.json`, `/bb` zeigt Vorteil und Fehlerzaehler.
- Nicht anfassen: ENTSCHIEDEN "Bevoelkerungs-Horizont 1 Stunde", `popErwartet`.

Tests (neu `tools/test-stadtwahl.js`, danach `node tools/test-alles.js`, `node tools/test-scope-tot.js`):
1. Stub-ns mit sechs Staedten und der Spielformel fuer die Black-Op-Spanne: Entscheidung gleich der
   Simulation `verify-g10-stadtsim.mjs` (pop12c); Probe stellt die Stadt IMMER zurueck, auch wenn
   `getActionEstimatedSuccessChance` in der dritten Stadt wirft.
2. `getNextBlackOp` null, `boReal` 0 oder NaN, Spanne `{0,0}`, unsicheres r der aktuellen Stadt ->
   kein Wechsel, Zaehler `probeFehler` steigt.
3. comms 0 in der pop-reichsten Stadt -> nicht gewaehlt, kein Pendeln gegen die Rundreise.
4. Zwei fast gleiche Staedte (Verhaeltnis 1,1) -> 100 Runden, 0 Wechsel; Verhaeltnis 1,3 -> 1 Wechsel.
5. Temporale Totzone: Funktion vor der ersten Verwendung aus `waehle()` initialisiert (der Fehler vom 03.10.).

Abnahme live (BN2.2, `/bb`): `probeFehler` 0 nach 30 min; erster Wechsel innerhalb 10 min nach dem
Einspielen (Sector-12 -> Volhaven/Neu Tokyo, Vorteil x1,98); `s.min` der Raid in der neuen Stadt
innerhalb 10 % der Vorhersage `K x (pop/1e9)^0,7 / 1,045^(L-1)`; kein `getCity() !== hier` nach der
Probe. Pruefstand: `data/blade.json` und `data/aktionen.txt` (Stadt je Abschnitt ergaenzen).

## 8. Rechner (alle unter `tools/audit/`, lesend)

| Datei | Zweck |
|---|---|
| `verify-g10-eichung.mjs` | Formel-Eichung (Typhoon, Raid s.min), Live-Tabelle BN2.2, Bot-Regel-Check |
| `verify-g10-stadtsim.mjs` | Monte-Carlo Stadtdynamik, Eichung E1-E4, Vergleich Bot/Fix, Vorsprung-Sweep, Rauschen, Reserve, zwei Phasen |
| `verify-g10-livestart.mjs` | Prognose ab dem echten BN2.2-Stand, K-Wachstum |
| `verify-g10-snapshots.mjs` | Chancenvorteil beste/aktuelle Stadt in 63 Staenden |
| `verify-g10-zeitreihe.mjs` | Staedte je Stand (pop, popEst, Chaos, comms, Zaehler) |
| `verify-g10-aktionen.mjs`, `verify-g10-wechsellog.mjs` | Aktionsprotokoll in Fenstern, um den Wechsel |
| `verify-g10-evgeeicht.mjs` | Ertragsmodell gegen realisierten Raid-Rang |
| `verify-g10-knotenlauf.mjs`, `verify-g10-ops.mjs` | Rang-/Level-/Black-Op-Verlauf BN2.1 |

Ausgabe der Simulation: Scratchpad `g10-stadtsim-n2000.txt` (nicht im Repo).
