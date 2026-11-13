# Teil 3 - Reihenfolge fuer Lauf 2

Stand 13.11.2026. Aus `3a-reihenfolge.md` + `3a-modell.mjs` (Pruefer) und
`3b-skeptiker-reihenfolge.md` (Opus-Skeptiker). Wo beide widersprechen, gilt
der Skeptiker - ausser beim Offline-Hebel, siehe 3.

## 1. Kernergebnis

**Die Reihenfolge ist nicht die grosse Frage.** Umordnungen bringen im Modell
9-44 h, das liegt innerhalb seiner Unsicherheit. Die einzige echte Probe des
Modells (Hold-out der dritten Stufen) verfehlt 9 von 14 Knoten um mehr als
15 %. Ohne SF-Gewinne und drei geratene Kaltstart-Zuschlaege sind alle
Varianten gleich lang. Die Reihenfolge zaehlt nur in den ersten ~10 Laeufen,
und dort wegen der SF-Zustaende.

## 2. Was fuer Lauf 2 gilt

| Nr | Regel | Wirkung | Status |
|---|---|---|---|
| R1 | **BN1.1 -> BN4.1 als Anfang**, danach BN4.2/4.3 direkt (V1), damit SF4.3 ab Lauf 5 gilt | -12 bis -32 h (P50), P(besser) 63-85 % | Empfehlung; Messregel auf BN4.1 (B(BN4,V1) stammt aus einem imputierten Lauf) |
| R2 | Ohne SF4 wirft jeder Singularity-Aufruf ausserhalb BN4 - es gibt keinen autonomen Ausgang. BN4.1 also so frueh wie moeglich | Voraussetzung | Spielcode (NetscriptHelpers.tsx:389) |
| R3 | Stufen eines Knotens am Stueck fahren, nicht verteilen | ~50 h (nicht 140; die Haelfte war ein BN8-Artefakt) | Richtung haelt |
| R4 | BN8 ans Ende (in Lauf 1 belegt; mit Casino und Boerse) | unbelegt | Regel haelt |
| R5 | BN10 und BN9 nicht nach hinten schieben - das Argument "unreifer Bot" entfaellt in Lauf 2 | Richtung haelt, Groesse (47-147 h) ungeeicht | Regel |
| R6 | BN7-Position (SF7.3 Simulacrum) haengt an einer Messung: haengt der Graft-Gewinn am Simulacrum (ohne es haelt blade.js bei jedem Graft den Motor an, blade.js:4596-4665)? | "BN7 direkt nach BN6.1" +20 bis -56 h | **messen in BN10.1** |
| R7 | Kein V1b-Labyrinth in BN15 (52-111 h je Lauf gegen gemessene 34-36 Online-h V2) | sonst +30 bis +200 h | gestrichen |
| R8 | Kein V1 in weiteren V2-Knoten (BN2/3/11 ...): braeuchte Hacking-Mult 14-72, erreicht wurden hoechstens 15 | - | gestrichen |
| R9 | Feinordnung ab Platz ~12 ist Rauschen - Route 1 bleibt dort | - | - |

## 3. Der Offline-Hebel (3b Prioritaet 1) - widerlegt

3b nannte die Offline-Verwertung den groessten Hebel (70-190 h). Das setzt
voraus, dass Offline-Zeit verloren geht. Am Spielcode geprueft (13.11.):

- **V2 (Bladeburner):** `storeCycles` ohne Obergrenze (Bladeburner.ts:275);
  online werden je Sekunde bis zu 5 s abgearbeitet (Bladeburner.ts:1376-1380,
  engine.tsx:200-205). Offline-Zeit ist also **voll gutgeschrieben**, solange
  danach ein Viertel davon online folgt. Die "50 %" aus Teil 1 waren ein
  Artefakt des Messfensters (4b).
- **V1 (Hacking):** Die Erfahrung der Arbeiter geht an das langlebige
  Elternskript bn4net.js (NetscriptWorker.ts:158-163) und wird offline mit
  voller Rate gutgeschrieben, sobald es 4 h laeuft. Rest-Hebel 2-10 h
  (Einbau nicht kurz vor die Nacht legen).

Was bleibt: im ersten V2-Lauf von Lauf 2 `getBonusTime()` mitschreiben, um
die Gutschrift einmal zu belegen. Kein Bau.

## 4. Das eigentliche Risiko: der Kaltstart (an Teil 5)

Der heutige Bot ist in den SF-armen Zustaenden von Lauf 2 nie gelaufen
(100 der 101 Stunden Unreife aus Lauf 1 liegen genau dort):

- Der Kern passt nicht in 8 GB home (bn4net.js 17,75 + boot.js 5,5 GB).
- Bei SF4.1 (Singularity x16) braucht exit.js 519 GB, bn4rep.js 850 GB.
- Die Rueckfaelle ohne SF5 sind als "kein Normalbetrieb" gebaut.
- `src/route.json` beginnt erst bei BN10.2.
- Annahmen wie boot.js:20 ("home ist auf 32 GB") stammen aus Lauf 1.

Risiko ohne eigenen Kaltstart-Pruefstand: +0 bis +135 h Wanduhr.
