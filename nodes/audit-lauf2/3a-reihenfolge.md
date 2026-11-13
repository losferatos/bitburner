# Teil 3a - Reihenfolge der 45 Laeufe in Lauf 2: Modell, Eichung, Varianten

Stand 13.11.2026. Modell: `3a-modell.mjs` (gleicher Ordner; `node 3a-modell.mjs` = Eichung und Mitte-Rechnung in 5 s,
`node 3a-modell.mjs full` = Monte-Carlo, Ablation, Anfangsfolgen in 30 s). Reine Rechnung auf `chronik.json` und
`2b-sf-modell.json`, nichts ausgefuehrt ausser diesem Skript. Alle Stundenangaben Mitte-Parameter, wenn nichts anderes steht;
Spannen = P10/P90 einer Monte-Carlo-Rechnung ueber alle ungeeichten Parameter (500-600 Ziehungen, Eichung je Ziehung neu).

## 0. Ergebnis in sieben Saetzen

1. **Das Modell trifft Lauf 1 nur dort, wo es darf.** Summe und je Knoten ja (in-sample 0,9 % Summe, hoechstens 4,9 % je Knoten;
   Leave-one-out je Knoten hoechstens 7,3 %), **je einzelnem Lauf nein** (Leave-one-out Median 17,6 %, P90 48 %; nur 18 von 41 Laeufen
   innerhalb 15 %). Die in-sample-Treffer sind keine Pruefung: 15 Knotenwerte sind auf 43 Laeufe gefittet. Die Reihenfolge-Abhaengigkeit
   selbst ist nicht geeicht, weil es nur eine beobachtete Reihenfolge gibt.
2. **Route 1 (unveraendert) kostet in Lauf 2 rund 1.565 Wanduhr-Stunden** (E 1.334 effektive, online 1.174; q = 0,25 Offline-Anteil),
   Spanne P10/P90 **1.277 / 1.790 h**. Lauf 1 waren rund 2.100. Die 25 % kommen aus Reife des Bots (-103 E), Go (-64), Graft (-68),
   Casino in BN8 (-36) und weniger Offline-Zeit; alle vier Posten sind Annahmen aus Teil 2, nicht aus diesem Modell.
3. **Die Reihenfolge ist ein Effekt zweiter Ordnung.** Mit abgeschalteten SF-Gewinnen und Kaltstart-Zuschlaegen sind alle Varianten
   **exakt gleich lang** (Ablation, Abschn. 5). Reihenfolge-Unterschiede entstehen nur aus Gewinn-je-spaeterem-Lauf (SF-Gewinne aus 2b,
   unter 5 h je Lauf nicht messbar) und aus drei geratenen Zuschlaegen.
4. **Was robust schlecht ist:** BN10 und BN9 verschieben (+30 bis +170 h, in 93-100 % der Ziehungen schlechter), BN8 vor die
   SF-Basis (+43 bis +158 h), Stufen verteilen statt am Stueck (+140 h), BN6 vor BN4 bei unbekanntem SF4-Zuschlag (0 bis +40 h).
   **Die Reife-Frage aus C1 entfaellt:** In Lauf 2 ist der Bot von Anfang an reif, das spricht nicht mehr fuer spaeteres BN10/BN9.
5. **Beste Variante:** V1-Block vorziehen (BN1 L2/L3 und BN5 L1-L3 vor BN6.1), sonst Route 1, BN4 L2/L3 frei nach Zeit waehlen
   (Abschn. 7). Gewinn **-25 h Wanduhr (P10/P90 -60/-6)**, rund 1,6 %. Mit gebauter Boerse in V2 zusaetzlich BN8 hinter BN11
   (weitere -29 h). Die reine Modell-Suche findet -44 h (-79/-5), davon rund -32 h aus "BN4 durchgehend in V1" auf Basis eines einzigen,
   imputierten Messwerts.
6. **Der Gewinn liegt innerhalb der Modellunsicherheit.** 1,6-3 % gegen einen Summenfehler der Eichung von rund 2 % (Hold-out,
   30 h), Rauschboden 5 h je Lauf (Teil 2) und eine absolute Spanne von +-17 %. Das Vorzeichen halten alle Ziehungen (98 %),
   weil die Varianten paarweise gleiche Parameter sehen - das ist modell-intern, keine Messung.
7. **Empfehlung: Route 1 behalten, mit V1-Block vorn.** Es gibt keinen Umbau, der mehr als die Messunsicherheit bringt; die einzigen
   belastbaren Aussagen sind die Verbote in Satz 4.

## 1. Modell

**Einheit.** E = effektive Knotenstunden: V1 = Online-Stunden, V2 = online + c2 x offline (c2 = 0,5 Mitte, 0,2-0,9; die Gutschrift
ist ungeeicht, CHRONIK Abschn. 2). Wanduhr = E / (1 - q + c2 q) fuer V2 und E / (1 - q) fuer V1; q = Offline-Anteil der Wanduhr
(Lauf 1: 0,37 gesamt, 0,20 in der 2. Oktoberhaelfte; Lauf 2 Mitte 0,25, Spanne 0,10-0,40).

**Je Lauf (Knoten n, Stufe k):**

- V2: `E = max(0,35 B, B[n] x (pi4 falls kein SF4) - G)`
- V1: `E = B[n] x fV1(SF)`; BN8 zusaetzlich `- Casino (12 h)` und `x (1 + k8 x (1 - S8))`, S8 = mittlere SF-Stufe von SF1/5/9/10/11/12
- `B[n]` = Knotenwert ohne SF-Gewinn, **aus Lauf 1 gefittet** (Log-Mittel aller Laeufe des Knotens, V1/V2 getrennt, BN4 hat beide),
  nach Abzug der Gewinne G (V2) bzw. fV1 (V1) und Division durch die Unreife I
- `G` = Stunden-Gewinn aus `2b-sf-modell.json` (Grenznutzen je SF-Stufe, lo/mid/hi), Kaltstart-Gewinne (SF1 32 GB home, SF9.2/9.3),
  Sleeves (min(3, SF10 + [in BN10]) x 0,7), Grafting (ab SF10.1 oder in BN10; 2/7,5 h je kurzem/langem Knoten nach dem
  50-%-Abschlag aus 2c, lo = 0), Go ohne SF14 (2 h), Boerse/SF8 nur bei `stocksV2`. **Graft ueberdeckt die Chance-Kanaele von
  SF1/6/7/14 zu 70 %** (omega, 2c Winkel 3, "nahe 0").
- `fV1 = 1 + k1 (1 - SF1-Anteil) + k5 (1 - SF5-Anteil)`, mal pi4v1 ohne SF4
- Unreife `I(d) = 1 + a exp(-d/tau)`, **je Verfahren** (V1-Code seit 19.08., V2-Code seit BN6.1 24.08.). In Lauf 2 ist I = 1.
- Nebenbedingungen: V2 erst mit SF6 oder SF7 (ausser in BN6/BN7 selbst); V1-Knoten sind 1, 4, 5, 8, 12 (die Knoten, in denen Lauf 1 V1 fuhr,
  plus BN4 mit freier Wahl); Stufen eines Knotens steigen; BN1.1 ist der feste Anfang.

**Herkunft der Parameter.**

| Parameter | Mitte (lo-hi) | Status |
|---|---|---|
| B je Knoten (16 Werte) | aus Lauf 1 | **gemessen** (Online-Zeit ab 03.09.; 6 Laeufe vorher imputiert, s. Abschn. 2) |
| SF-Gewinne G | 2b-Tabellen | **ungeeicht**, unter 5 h je Lauf nicht messbar (2b, 2c) |
| Offline-Gutschrift c2 | 0,5 (0,2-0,9) | **ungeeicht**, 8 Luecken, Streuung 0-100 % |
| Unreife a1/a2, tau | 0,3 / 1,0, 10 / 5 d | **Prior**: ergibt 135 Wanduhr-h in Lauf 1 (CHRONIK: 33 belegt + BN6.1 <= 56 + BN10.2 21,5 + Spannen = 60-160) |
| Erststufen-Aufschlag p1 | 0,03 | gefittet, **nicht nachweisbar** (Erststufe ist Rauschen wie jede Stufe); rho (Rest in Lauf 2) 0,5 |
| Kaltstart k1 / k5 / k8 | 0,25 / 0,10 / 1,0 | **geraten** (v1cf.js: Hack-Stufe -14..-23 %, Umrechnung in Zeit offen) |
| SF4-Zuschlag pi4 (V2) / pi4v1 | 1,2 / 1,1 | **geraten**; kein V2-Lauf ohne SF4 je gefahren |
| Offline-Anteil q | 0,25 (0,10-0,40) | Verhalten von Eric, nicht Modell |
| Gewinn-Hebel u (alle G gemeinsam) | 0,5 (0-1) | lo/mid/hi aus 2b, komonoton gezogen plus Jitter |

**Was fehlt:** SF7.3 Simulacrum, SF4.2/4.3 (RAM), Int-Anhaeufung, Stanek, Infiltration, Hash->Rang im Einzelnen, Einbau-Sperren,
V1b (Labyrinth) in BN15, V1/V2-Wahl ausser BN4. Das Labyrinth ist der groesste Einzelhebel ausserhalb des Modells (BN15 x3 =
rund 130 E; V1b geschaetzt 10-35 h je Lauf, AUDIT-ROADMAP).

## 2. Eichung gegen Lauf 1

Soll = `chronik.json` (E je Lauf; fehlende Online-Zeit imputiert mit Online/Wanduhr = 0,63 fuer V1, 0,78 fuer V2). **Imputiert sind 6 Laeufe:
BN1.1, BN4.1, BN5.1, BN6.1, BN10.1, BN10.2 - dort ist das "Ist" selbst ein Modellwert.** BN8.2 laeuft noch und ist ausgenommen.
"LOO" = Leave-one-out: der Lauf wird weggelassen, B neu gefittet, der Lauf vorhergesagt (Summe je Knoten; ohne Knoten mit einem
einzigen Lauf je Verfahren). "Hold-out" = alle dritten Stufen gemeinsam weggelassen und aus Stufe 1/2 vorhergesagt.

| Knoten | Laeufe (imputiert) | Ist E | Modell E | in-sample | LOO | Hold-out Stufe 3 |
|---|---|---:|---:|---:|---:|---:|
| BN1 | 3 (1) | 53,6 | 51,0 | -4,9 % | -7,3 % | +3,9 % |
| BN2 | 3 | 59,0 | 57,7 | -2,1 % | -2,9 % | +46,7 % |
| BN3 | 3 | 59,8 | 58,4 | -2,4 % | -0,2 % | -43,0 % |
| BN4 | 3 (1) | 114,1 | 114,1 | 0,0 % | +0,3 % | -11,6 % |
| BN5 | 3 (1) | 56,9 | 57,7 | +1,5 % | +6,1 % | -21,1 % |
| BN6 | 3 (1) | 117,9 | 115,6 | -1,9 % | -3,1 % | -1,0 % |
| BN7 | 3 | 186,2 | 185,6 | -0,3 % | -0,2 % | -15,4 % |
| BN8 | 1 | 31,6 | 31,6 | 0,0 % | n/a | - |
| BN9 | 3 | 185,0 | 183,5 | -0,8 % | -1,0 % | +29,4 % |
| BN10 | 3 (2) | 237,6 | 238,9 | +0,6 % | +3,7 % | -12,9 % |
| BN11 | 3 | 74,3 | 74,1 | -0,2 % | +0,3 % | -17,8 % |
| BN12 | 3 | 37,9 | 37,8 | -0,2 % | +0,3 % | -13,2 % |
| BN13 | 3 | 123,4 | 121,4 | -1,6 % | -1,5 % | +55,2 % |
| BN14 | 3 | 80,8 | 80,2 | -0,8 % | -1,4 % | +19,8 % |
| BN15 | 3 | 140,8 | 136,4 | -3,2 % | -4,0 % | +43,3 % |
| **Summe** | 43 | **1.558,8** | **1.544,0** | **-0,9 %** | | **+2,1 %** (457,7 -> 467,4) |

- **Je Lauf:** LOO Median 17,6 %, P90 47,9 %, 18/41 innerhalb 15 % (nur gemessene Laeufe, n = 36: Median 16,4 %, P90 44,6 %).
  Das ist die Streuung gleicher Knoten aus 2b (CV 5-39 %); ein Lauf ist nicht besser vorhersagbar.
- **Wanduhr:** mit konstantem q = 0,368 (Lauf 1 gemessen) -3,3 % auf die Summe (1.967 gegen 2.035); je Knoten -43 % (BN12) bis +13 %.
  Die Knotenfehler sind Erics Offline-Muster (BN12 lief fast nur nachts), nicht Modellfehler.
- **Urteil:** Die Vorgabe "Ist-Lauf auf etwa 15 %" ist **fuer Summe und je Knoten erfuellt, fuer einzelne Laeufe verfehlt.** Das genuegt fuer
  Absolutwerte auf Knotenebene und nicht fuer die Aussage "Reihenfolge X ist um 2 % besser". Der Hold-out der dritten Stufe zeigt,
  dass Stufen-Trends nicht systematisch sind: BN2, BN13, BN15 und BN9 waren in Stufe 3 deutlich schneller als aus Stufe 1/2 erwartet (Modell +30 bis +55 %),
  BN3 deutlich langsamer (-43 %); gepoolt gleicht sich das auf +2,1 % aus.

**Reife von SF/Mechanik trennen (Lauf 1 -> Lauf 2, Route 1, Mitte, E):**

| Schritt | E | Schritt |
|---|---:|---:|
| Lauf 1 modelliert (Unreife, Go ab 27.10., Graft ab 07.11., Casino aus) | 1.605 | |
| Bot reif (I = 1), sonst Lauf-1-Stand | 1.502 | -103 |
| + Go von Anfang an | 1.438 | -64 |
| + Graft ab SF10.1/BN10 | 1.370 | -68 |
| + Casino in BN8 | 1.334 | -36 |

Die Unreife ist ein Prior (Spanne a1/a2 = 0,1/0,4 bis 0,6/2,0: Route 1 in Lauf 2 dann 1.606 bis 1.445 Wanduhr). **Die Daten identifizieren
sie nicht**: BN6.1 war dreimal so langsam wie BN6.2/6.3, aber zugleich erster V2-Lauf und ohne drei SF. Entscheidend fuer die Reihenfolge:
**Reife wirkt in Lauf 2 auf jede Position gleich (I = 1) und verschiebt keine Rangfolge.** Sie war in Lauf 1 ein Argument, lange Knoten spaeter zu
fahren; in Lauf 2 gibt es das Argument nicht mehr.

## 3. Lauf 2 Route 1

E 1.334, online 1.174, Wanduhr 1.565 (Mitte). Monte-Carlo: **Wanduhr P10/P50/P90 1.277 / 1.548 / 1.790, online P50 1.159.**
Treiber (Rangkorrelation): Gewinn-Hebel u -0,77, Offline-Anteil q +0,49, V2-Unreife a2 -0,18. Raster Offline-Gutschrift c2 x q
(Mitte sonst): Wanduhr 1.320 (c2 0,2, q 0,1) bis 1.822 (c2 0,2, q 0,4); online 1.011-1.373.

Je Knoten (E / Wanduhr, Mitte): BN1 45/60, BN2 51/59, BN3 52/60, BN4 88/105, BN5 53/71, BN6 75/85, BN7 165/188, BN8 56/75, BN9 157/179,
BN10 163/186, BN11 68/78, BN12 37/50, BN13 113/130, BN14 81/92, BN15 131/149.

## 4. Varianten (paarweise gegen Route 1; Wanduhr, Monte-Carlo 500 Ziehungen)

Differenz = Variante minus Route 1 (negativ = schneller), P10/P50/P90; P(besser) = Anteil der Ziehungen, in denen die Variante schneller ist.

| Variante | Wanduhr P50 | Differenz zu Route 1 | P(besser) |
|---|---:|---|---:|
| **a** Route 1 unveraendert (BN4.1 V1, BN4.2/3 V2) | 1.548 | - | - |
| b1 BN10+BN9 hinter BN11/BN6.2/3, vor BN7 | 1.658 | +11 / +77 / +261 | 4 % |
| b2 BN10+BN9 ganz spaet (vor BN8) | 1.796 | +14 / +172 / +661 | 7 % |
| b3 nur BN9 spaet | 1.614 | +6 / +30 / +175 | 0 % |
| b4 nur BN10 spaet | 1.593 | +5 / +44 / +74 | 6 % |
| c1 BN8 direkt nach BN6.1 | 1.709 | +83 / +158 / +293 | 0 % |
| c2 BN8 nach BN10 | 1.682 | +70 / +132 / +243 | 0 % |
| c3 BN8 nach BN10+BN9+BN4+BN1/5 | 1.596 | +22 / +45 / +85 | 0 % |
| c4 BN8 nach BN11 (ohne Boerse in V2: kein Effekt) | 1.548 | 0 / 0 / 0 | 25 % |
| d1 Stufen gruppiert (3 am Stueck) | 1.545 | -46 / -1 / +61 | 51 % |
| d2 Stufen verteilt (alle L1, dann L2, dann L3) | 1.713 | +65 / +140 / +346 | 0 % |
| e2 Anfang 1 5 4 6 | 1.552 | -1 / +1 / +5 | 29 % |
| e3 Anfang 1 6 4 5 (V2 vor SF4) | 1.582 | +8 / +33 / +62 | 4 % |
| e4 Anfang 1 6 5 4 | 1.585 | +10 / +36 / +64 | 4 % |
| e5 Anfang 1 4 6 5 | 1.549 | 0 / +1 / +2 | 0 % |
| e6 Anfang 1 5 6 4 | 1.585 | +10 / +35 / +63 | 4 % |
| e7 Anfang 1 6, dann BN10 (BN4/5 spaeter) | 1.627 | +22 / +69 / +150 | 2 % |
| h1 V1-Block vorn: 1 4 1x2 5x3 6 ... | 1.539 | **-23 / -9 / -4** | 100 % |
| h2 nur SF1.2/1.3 vorgezogen | 1.545 | -8 / -4 / -2 | 99 % |
| h3 BN14 vor BN7 (SF7.3 Simulacrum nicht modelliert!) | 1.547 | -5 / -2 / -1 | 96 % |
| h4 h1 + BN14 nach BN9 (dito) | 1.532 | -33 / -16 / -5 | 97 % |
| g1 Route 1, BN4 durchgehend V1 | 1.528 | -46 / -9 / +1 | 60 % |
| **f** Modellsuche (Mitte, 6 Starts, Einfuegen) | 1.498 | **-79 / -44 / -5** | 93 % |

**Familie BN4 frei (V1 wo billiger):** Basis "a, BN4 frei" = -12 h (-52/+1, 63 %). Darauf h1 = **-25 h (-60/-6, 98 %)**; e3 +9; e7 +53;
b1 +63; d1 +11.

**Familie Boerse in V2 gebaut (SF8 wirkt in V2):** c1 +90, c2 +74, c3 +3, **c4 (BN8 hinter BN11) -29 (-56/-4, 95 %)**. Ohne Boerse in V2
ist BN8 an jeder Stelle hinter der SF-Basis gleich gut (c4 = a) und davor schlechter.

**Suche je Szenario (Route 1 -> bestes Ergebnis, Wanduhr):** SF-Gewinne klein -71 h, mittel -50, gross -11; q 0,10 -50, q 0,40 -47;
mit Boerse in V2 -94; Kaltstart-Zuschlaege aus -38; SF-Gewinne aus -46. Die gefundene Reihenfolge wechselt mit dem Szenario; stabil sind
nur: BN1 L2/L3 und BN5 frueh, BN4 in V1, BN6.1 danach, BN10 und BN9 sofort, BN14 vor BN13/15, BN8 nie vor BN10/9/11.

## 5. Ablation: was erzeugt die Unterschiede (Wanduhr-Differenz zu Route 1, Mitte)

| Modell | b1 | b2 | c1 | c3 | d2 | e3 | h1 | f |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| alles an (Route 1 = 1.565) | +67 | +147 | +144 | +41 | +102 | +33 | -10 | -50 |
| SF-Gewinne aus (1.678) | 0 | 0 | +137 | +39 | +56 | +28 | -1 | -46 |
| Graft aus (u = 0; 1.707) | -1 | -16 | +140 | +40 | +64 | +30 | -3 | -55 |
| Kaltstart-Zuschlaege aus (1.550) | +67 | +147 | 0 | 0 | +45 | +14 | -10 | -35 |
| beides aus (1.665) | 0 | 0 | 0 | 0 | 0 | +13 | 0 | -32 |
| nur k8 aus (BN8-Zuschlag) | +67 | +147 | +18 | 0 | +56 | +33 | -10 | -50 |
| nur pi4 aus | +67 | +147 | +143 | +41 | +102 | +14 | -10 | -45 |

Lesart:
- **b1/b2 (BN10/BN9 spaeter)** schlechter **nur ueber SF-Gewinne**, zu zwei Dritteln Graft: ohne Gewinne exakt 0, mit Graft lo sogar -16
  (BN10 spaet kostet dann nichts). Der Graft-Gewinn ist nie gemessen (2c: 0/110/360). Wer ihm nicht traut, hat keinen Grund fuer BN10 zuerst,
  aber auch keinen, BN10 zu schieben: in Lauf 2 ist der Bot reif, ein Verschieben gewinnt nichts.
- **BN8 frueh (c1-c3)** schlechter **nur ueber den geratenen Zuschlag k8** (ohne ihn +18 / 0); BN8 hat keinen Gewinn fuer die Folgeknoten
  ausser mit Boerse in V2. BN8 zuletzt ist die sichere Wahl, BN8 mittendrin lohnt erst, wenn die Boerse in V2 laeuft.
- **f -32 bleibt, wenn alles andere aus ist:** das ist "BN4 durchgehend V1" (`bn4`-Regel), kein SF-Effekt. B(BN4, V1) stammt aus **einem** Lauf
  (BN4.1, Online imputiert 0,63 x 48,6 h Wanduhr, unreifer Bot); B(BN4, V2) aus zwei. Messen, nicht glauben: BN4 L2 in V1 fahren.
- **e3 (BN6 vor BN4)** kostet 14 h schon bei pi4 = 1, weil BN4.1 dann nur noch in V2 faehrt (Regelartefakt); mit freier BN4-Wahl 0,6 h bei pi4 = 1,
  8 h bei 1,2, 20 h bei 1,5, 40 h bei 2,0.

## 6. Reihenfolge-Prinzip im Modell (warum die Gewinne so klein sind)

Gesamtzeit = Summe aller B - Summe (Gewinn eines SF x Anzahl spaeterer Laeufe, die ihn nutzen). Die Dauer des Laufs, der den SF liefert,
**geht nicht in die Rechnung ein**: es zaehlt nur, welcher Gewinn je Folgelauf am groessten ist. Rangfolge der Gewinne (Mitte, je V2-Lauf):
SF10.1 (Graft 2 bzw. 7,5 + Sleeve 0,7), SF14.1 (2,0), SF1.1 (1,4 x 0,3 unter Graft), SF9.3 (1,6 + 0,3), SF7.1/SF6.1 (0,8/0,7 x 0,3), SF8
(nur mit Boerse). Das ist Route 1: BN6.1 (V2 oeffnen), BN10, BN9. Der Spielraum der Reihenfolge ist deshalb genau die Summe dieser 1-8-h-Gewinne
x 20-40 Folgelaeufe, und davon steckt die Haelfte in den ersten drei Plaetzen der Route.

## 7. Kaltstart: die ersten 5-8 Laeufe

**Harte Voraussetzungen (aus Teil 2 und Spielcode):**
- **BN1.1 ist der feste Anfang** (frisches Spiel). Im Spielcode (`BitverseRoot.tsx`) habe ich keine Freischaltkette der BitNodes gefunden; nicht vollstaendig geprueft.
- **V2 geht erst mit SF6 oder SF7 oder in BN6/BN7 selbst.** Vorher bleiben V1-Knoten (BN1, 4, 5, 12, 8). BN6 (Rangfaktor 1,0, B = 34 E ohne Gewinn) ist der
  billigste Weg zu V2, BN7 (0,6, Skill x2, B = 72 E) ungeeignet als erster V2-Lauf.
- **SF4 (Singularity):** In BN4 selbst ist Singularity auch ohne SF4 verfuegbar (ROADMAP 6.1); ausserhalb kostet jede Funktion das 16-Fache,
  der Bot geht dann ueber die Oberflaeche (DOM). **Kein V2-Lauf ohne SF4 wurde je gefahren**, pi4 ist reine Schaetzung. Kosten von "BN6 vor BN4":
  0,6 / 8 / 20 / 40 h bei pi4 = 1 / 1,2 / 1,5 / 2,0. Gegen die Versicherung BN4.1 (V1, rund 24 E = 32 Wanduhr) als Lauf 2 ist das nicht entscheidbar
  und nicht teurer: **BN4.1 als zweiter Lauf**, so wie Lauf 1.
- **SF1:** 32 GB home ab Knotenstart (8 -> 32 GB = 4,2 Mio $ x Knotenfaktor), Multiplikatoren auf V1 und V2. BN1.2/1.3 sind mit rund 15/14 E die
  billigsten Laeufe des ganzen Plans und heben V1-Laeufe wie BN5/BN12/BN8 (k1 geraten).
- **SF5:** Int und Mult 8/12/14 %; BN5.1-5.3 (17-18 E) sind ebenfalls V1.
- **SF10** (Graft-API, Sleeves) und **SF9** (home 128 GB, Hash) brauchen V2-Laeufe und kommen direkt nach BN6.1.

**Beam-Suche ueber die ersten 9 Plaetze (Mitte, Rest nach Suchergebnis):** die besten Anfaenge sind alle gleichwertig innerhalb 1 h und haben dieselbe Gestalt:
`1.1 4.1 1.2 1.3 5.1 5.2 5.3 ...` (V1-Block), danach BN6.1. Mit dem Rest nach Route 1: `1 4 1 5 1 4 4 6 14` (1.532 h) gegen Route 1 (1.565 h).
Empfindlichkeit der V1-Vorziehung: -9,8 / -10,3 / -11,0 / -12,4 h bei k1 = 0 / 0,25 / 0,5 / 1,0; der Gewinn bleibt also auch ohne geratenen V1-Zuschlag (SF1/SF5-
Gewinne und Kaltstart in V2).

**Empfohlene ersten acht Laeufe (Modell, E / Wanduhr kumuliert, Mitte):**
`1.1 (18/24) -> 4.1 (24/56) -> 1.2 (15/76) -> 1.3 (14/94) -> 5.1 (18/118) -> 5.2 (17/140) -> 5.3 (16/162) -> 6.1 (29/196)`; erster Laeufe-Block also rund 8 Tage
Wanduhr bei q = 0,25, danach beginnt V2 mit BN10.

## 8. Empfohlene Reihenfolge fuer Lauf 2

```
1.1 4.1 1.2 1.3 5.1 5.2 5.3 6.1 10.1 10.2 10.3 9.1 9.2 9.3 4.2 4.3 12.1 12.2 12.3
2.1 2.2 2.3 3.1 3.2 3.3 11.1 11.2 11.3 6.2 6.3 7.1 7.2 7.3 14.1 14.2 14.3
13.1 13.2 13.3 15.1 15.2 15.3 8.1 8.2 8.3
```
(= Variante h1; im Skript `VARIANTS['h1 ...']`). Gegen Route 1: **-9 h** (P10/P90 -23/-4) bei BN4 wie Lauf 1, **-25 h** (-60/-6) mit BN4 L2/L3 nach
Zeit frei in V1 oder V2. Rund 1,0-1,6 % der Wanduhr. Wird die Boerse in V2 gebaut, **BN8.1-8.3 hinter BN11** (c4) statt am Ende: -29 h weiter (-56/-4).

Begruendung der einzelnen Abweichungen von Route 1:
1. **BN1 L2/L3 und BN5 L2/L3 nach vorn**, weil V1-Laeufe vor BN6.1 ohnehin die einzigen sind, die der Bot ohne V2 fahren kann, und SF1/SF5 alle 40
   Folgelaeufe etwas bringen. Das ist die Route-1-Regel "Beschleuniger zuerst", konsequent bis SF1.3/SF5.3 angewendet.
2. **BN10 und BN9 bleiben sofort hinter BN6.1.** Das Argument "spaeter, wenn der Bot reifer ist" faellt weg (I = 1 in Lauf 2). Verschieben kostet +30..+170 h.
3. **BN7 vor BN14/13/15 bleibt** (Simulacrum, SF7.3). Das Modell sieht BN14 vor BN7 um -2 h besser; da Simulacrum nicht modelliert ist, ist das kein Grund.
4. **Stufen am Stueck** (d1 = a): Verteilen kostet +140 h. Ein Vorteil des Verteilens ist weder in den Daten noch im Modell.
5. **BN8 bleibt am Ende**, ausser die Boerse laeuft in V2 (dann hinter BN11).

## 9. Liegt der Gewinn ueber der Modellunsicherheit?

**Nein.** Gewinn h1 -9 bis -25 h (0,6-1,6 %), Modellsuche -44 h (2,8 %). Dagegen: Summenfehler der Eichung (Hold-out) 2,1 % = 33 h; Rauschboden je Lauf 5 h x 45; absolute
Spanne P10/P90 +-17 %; die Gewinne selbst stecken in ungeeichten Termen (SF-Gewinne, k1/k5/pi4). Das Vorzeichen ist in 98 % der Ziehungen stabil, aber das ist
Modell-Konsistenz (gleiche Parameter in beiden Varianten), nicht Messung. **Belastbar** sind nur die Verbote (Abschn. 0 Satz 4); sie halten, weil sie in jedem
Szenario mit nichtverschwindenden SF-Gewinnen gelten und bei verschwindenden Gewinnen neutral sind.

## 10. Unsicherheiten und Messauftraege

1. **BN4 in V1:** B(BN4, V1) = 17,9 E aus einem imputierten Lauf (Online 0,63 x Wanduhr, unreifer Bot). Wert fuer die Empfehlung "BN4 frei": -12 h. Messen: BN4.2 in V1.
2. **SF-Gewinne:** Rangfolge der Gewinne ist unmessbar unter 5 h je Lauf (2b). Messbar nur als Ereignisstudie im Lauf (Teil 2 Abschn. 3, Graft vor/nach).
3. **pi4 (V2 ohne SF4):** nie gemessen. Wird "BN6 vor BN4" erwogen, einmal BN6.1 ohne SF4 fahren - kostet im Mittel 8 h, im schlechten Fall 40 h.
4. **Offline-Gutschrift c2 und Offline-Anteil q** bestimmen die Absolutzeit staerker als jede Reihenfolge (Raster Abschn. 3: 1.320-1.822 Wanduhr).
5. **Imputation:** 6 Lauf-1-Werte (BN1.1, 4.1, 5.1, 6.1, 10.1, 10.2) sind aus der Wanduhr geschaetzt; sie bestimmen B(BN4,V1), B(BN6), einen Teil von B(BN10).
6. **BN8.2/8.3** fehlen in der Eichung (BN8.2 laeuft); B(BN8) ist **ein** Lauf (31,6 h Online, Lauf 1, ohne Casino).
7. **Unreife-Prior** (135 Wanduhr-h, Rahmen 60-160): beeinflusst die Absolutzeit (1.445-1.606), nicht die Rangfolge.
8. **Nicht modelliert:** SF7.3, SF4.2/4.3, V1b in BN15, Einbau-Sperren, Stanek, Infiltration. Jeder dieser Punkte kann eine Variante um mehr bewegen als die Differenzen oben.
9. **Reihenfolge nicht an Lauf 1 geeicht:** Es gibt nur eine beobachtete Reihenfolge; die SF-Abhaengigkeit ist Annahme aus 2b, nicht Messung.
