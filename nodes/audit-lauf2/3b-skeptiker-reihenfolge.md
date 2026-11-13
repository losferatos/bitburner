# Teil 3b - Skeptiker zu 3a (Reihenfolge Lauf 2)

Stand 13.11.2026 (Systemzeit 07:10). Gegenstand: `3a-reihenfolge.md`, `3a-modell.mjs`. Gelesen: CHRONIK, `chronik.json`, MECHANIKEN,
`2b-sf-modell.json`, 2c, 1d (Abschn. 2 und 3c), 1b (Auszuege), `nodes/ROUTE.md`, `AUDIT-ROADMAP-PRUEFUNG-2026-10.md`,
`LABYRINTH-MACHBARKEIT-2026-10.md`, `DARKNET-NEBENGEWERK-2026-11-02.md`, `GRAFTING.md` (Abschn. "Warum nicht gegraftet werden darf"),
Spielquelle `reference/v301/src`, Bot-Code `src/` und `doku/ram-budget.md` (nur gelesen).

**Ausgefuehrt:** im Projekt nur `node 3a-modell.mjs` und `node 3a-modell.mjs full` - beide reproduzieren die Zahlen in 3a exakt.
Eigene Rechnung im Scratchpad `C:\Users\erche\AppData\Local\Temp\claude\0f034fb3ad50e625\feee1757-fe7d-46ac-8a39-80b39fc941eb\scratchpad\audit3b\`:
`mod.mjs` = Kopie von `3a-modell.mjs` mit drei abschaltbaren Zusatztermen (alle 0 = Original, Eichung unveraendert, Zusatzterme im Fit
herausgerechnet), `ana1.mjs`-`ana4.mjs` (Mitte-Rechnung und Monte-Carlo mit 300 Ziehungen, gleiche Parameterziehung wie 3a):

| Term | Bedeutung | Werte in den Proben |
|---|---|---|
| `gSim` | Graft-Gewinn (und seine Ueberdeckung omega der SF1/6/7/14-Kanaele) in V2-Laeufen **ohne SF7.3** mal gSim | 1 (3a) / 0,5 / 0 |
| `s41v2`, `s41v1` | Aufschlag bei SF4.1 ausserhalb BN4 (Singularity x16): V2 + h je Lauf, V1 x(1+s); SF4.2 ein Drittel | 0 (3a) / 1 h, 10 % / 2 h, 20 % |
| `k9v1` | V1-Lauf ohne SF9.2 (home 32 statt 128 GB) x(1+k) | 0 (3a) / 20 % |

Szenarien: **S0** = 3a; **S1** gSim 0; **S3** SF4.1-Aufschlag 2 h / 20 %; **S5** S1+S3+k9v1; **S6** mild (gSim 0,5, 1 h / 10 %).
Die Zusatzwerte sind **Empfindlichkeitsproben, keine Schaetzungen**: Sie zeigen, ob eine Empfehlung kippt, sobald ein nicht modellierter,
im Quellcode belegter Mechanismus ueberhaupt etwas kostet.

---

## 0. Kurzurteil

1. Die Rechnung von 3a ist fehlerfrei nachgebaut; **die Schluesse sind staerker als das Modell**. "Trifft je Knoten" ist fuer die in-sample-
   und Leave-one-out-Spalte eine algebraische Identitaet; die einzige echte Probe (Hold-out Stufe 3) verfehlt 9 von 14 Knoten um mehr als 15 %.
2. **Die Empfehlung h1 (V1-Block 1.2/1.3/5.x vor BN6.1) kippt**, sobald SF4.1 etwas kostet: von -9 h (P(besser) 100 %) auf +14 h (10 %).
   Das Modell kennt den x16-Zustand nicht - `pi4` greift nur bei SF4 = 0, h1 erzeugt aber 12 Laeufe bei SF4.1.
3. **Reife I = 1 ist nicht identifiziert**: 100 der 101 effektiven Unreife-Stunden von Lauf 1 liegen auf genau den SF-armen Laeufen, deren
   Zustand in Lauf 2 wiederkehrt; der heutige Bot ist in diesen Zustaenden nie gelaufen (Kern passt nicht in 8 GB, `exit.js` 519 GB bei SF4.1,
   SF5-Rueckfaelle ausdruecklich "kein Normalbetrieb").
4. **Simulacrum (SF7.3) ist entscheidungsrelevant, nicht Beiwerk.** Ohne Simulacrum haelt der Bot bei jedem Graft den Bladeburner-Motor an,
   und sein eigener Graftplan verlangt vorher das Simulacrum fuer 450 Mrd - in den meisten Knoten vor BN7 innerhalb eines Laufs unbezahlbar.
   Dann ist "BN7 direkt nach BN6.1" um rund 55 h besser als Route 1, mehr als jede 3a-Variante; gilt 3a's Annahme, ist es 20 h schlechter.
5. **"Labyrinth groesster Einzelhebel, ca. 130 E": FALSCH.** 130 E ist die Groesse von BN15, nicht die Ersparnis; die zitierten 10-35 h je Lauf
   sind seit 07.10. widerrufen; V1b (52-111 h) liegt ueber dem inzwischen gemessenen V2 (34-36 Online-h je Lauf).
6. **Der groesste Hebel ist nicht die Reihenfolge, sondern die Offline-Verwertung**: 70-190 Wanduhr-h bei q = 0,25 (C5/C4), gegen 9-44 h aus
   der Reihenfolge. Ungeeicht, aber mit einem Messinstrument, das das Spiel schon liefert (`bladeburner.getBonusTime`).
7. Verbote: "BN4.1 vor BN6.1" **haelt** (staerker als modelliert), "Stufen am Stueck" und "BN8 ans Ende" **halten als Richtung**,
   "BN10/BN9 sofort" ist eine Folge der Modellform (Gewinn x Folgelaeufe), Groesse +47..+147 h ungeeicht.

---

## Winkel 1 - Praemisse: ist "Reihenfolge" die richtige Frage?

**Befund.** 3a sagt selbst: Reihenfolge-Gewinne 9-44 h, innerhalb der Modellunsicherheit. Trotzdem endet der Bericht mit einer Reihenfolge-
Empfehlung und listet die groesseren Fragen nur als "nicht modelliert". Die Reihenfolge zaehlt in Lauf 2 nur fuer die **ersten rund zehn
Laeufe** - dort bestimmt sie, in welchen SF-Zustaenden der Bot laufen muss (Winkel 3/4). Ab Platz ~12 ist sie Rauschen. Die Fragen mit
groesserem Hebel:

### 1.1 V1b-Labyrinth in BN15 - kein Hebel, ein Verlust

- 3a Abschn. 1: "groesster Einzelhebel ausserhalb des Modells (BN15 x3 = rund 130 E; V1b geschaetzt 10-35 h je Lauf, AUDIT-ROADMAP)".
- `LABYRINTH-MACHBARKEIT-2026-10.md` Abschn. 6.1: "Die August-Rechnung (10-35 h) liess die Hacking-Wand weg." Neues Band V1b **52-111 h je Lauf**,
  Obergrenze unbelegt. Die Wand: Hacking 6.000 bei Level-Mult 0,6, noetiger Spieler-Mult 15-17, dafuer 5e10-5,8e11 EXP = **8-100x die gesamte
  EXP von BN5.3** (5,93e9); erreicht hat der Bot Mult 15 einmal (BN12.2, Augpreise x1,04), BN15 hat x3.
- Der damalige Vergleichsmassstab war V2 105-178 h (ungeeichte Simulation). **Gemessen** wurde danach: BN15 V2 35,5 / 36,0 / 33,7 Online-h,
  100,6 / 42,3 / 33,7 W; 3a selbst rechnet Lauf 2 mit 44 / 43 / 43 E (149 W fuer BN15 x3).
- Damit V1b - V2 = +9 bis +68 h je Lauf in der guenstigsten Lesart (Uhr in LABYRINTH nicht angegeben; die BN5.3-Analogie 46,8 h ist Wanduhr
  bei 19,3 Online-h), ueber BN15 x3 **+30 bis +200 h Verlust**, in Wanduhr mehr (V1-Offline zaehlt nicht). Dazu ~24 Raetselloeser, Navigator,
  Neuaufbau nach jedem Einbau. Das Nebengewerk ohne Red Pill bringt 1-5 h je Lauf (DARKNET-NEBENGEWERK, Urteil "nicht bauen").

**Urteil 1.1: FALSCH.** V1b aus der Hebelliste streichen; BN15 bleibt V2.

### 1.2 V1 statt V2 in weiteren Knoten (BN2/BN3/BN11 ...) - nur BN4 ist ein Kandidat

Noetiger Spieler-Hacking-Mult, um den Weltdaemon mit der EXP-Menge eines guten V1-Laufs (BN5.3: 5,93e9, also 32 ln(EXP) - 200 = 520) zu
erreichen: Ziel-Level / (520 x HackingLevelMultiplier). Werte aus `BitNode/BitNode.tsx:572-1120`.

| Knoten | Ziel-Level (3000 x WD) | LevelMult | noetiger Spieler-Mult | Geldbremsen |
|---|---:|---:|---:|---|
| BN1 (Referenz) | 3.000 | 1 | 5,8 | - |
| BN5 | 4.500 | 1 | 8,7 (BN5.3 hatte 12) | ScriptHackMoney 0,15, AugGeld 2 |
| **BN4** | 9.000 | 1 | **17,3** | ScriptHack 0,2, MaxMoney 0,11, AugGeld 1 - **Lauf 1 hat BN4.1 so gefahren (48,6 W)** |
| BN11 | 4.500 | 0,6 | 14,4 | MaxMoney 0,01, AugGeld 2 |
| BN3 | 6.000 | 0,8 | 14,4 | MaxMoney 0,04, ScriptHack 0,2, AugGeld 3, AugRuf 3 |
| BN2 | 15.000 | 0,8 | 36 | MaxMoney 0,08 |
| BN6/7/10 | 6.000 | 0,35 | 33 | - |
| BN9 | 6.000 | 0,5 | 23 | HackExpGain 0,05 |
| BN13 / BN14 | 9.000 / 15.000 | 0,25 / 0,4 | 69 / 72 | - |

**Urteil 1.2:** Die Beschraenkung des Modells auf V1 in BN1/4/5/8/12 **haelt**. V1 in BN2/BN3/BN11 ist kein Hebel (Mult 14-36 bei einem
Hundertstel bis Fuenfundzwanzigstel des Hackgelds). Offen ist nur BN4 (1.4).

### 1.3 Offline-Verwertung - der groesste Hebel, nicht modelliert als Stellgroesse

**Mechanik (Quelle).** Offline gespeicherte Bladeburner-Zeit verfaellt nicht: `engine.tsx:332` legt sie in `storedCycles`, `Bladeburner.ts:1376-1380`
spielt sie online mit bis zu 5 s je Sekunde nach (Aktion, Ausdauer, Zaehlerwachstum alle mit). Spielerarbeit laeuft offline voll (`engine.tsx:282`).
Eine Gutschrift von nur ~50 % (CHRONIK Abschn. 2) ist also keine Spielgrenze, sondern Verhalten des Bots im Nachholbetrieb (V59: Vorrat leert sich,
Sleeves stehen) oder ein Messartefakt. V1: Erfahrung offline nur fuer Skripte mit >= 4 h Laufzeit (`ScriptHelpers.ts:27-60`, C4).

**Rechnung (3a-Modell, Route 1, Eichung mit c2 = 0,5 unveraendert; V2-Anteil E 1.118, V1-Anteil E 216):**

| q | V2: c2 0,5 -> 0,7 / 0,9 | V1: c1 0 -> 0,5 / 0,8 |
|---|---|---|
| 0,10 | -25 / -48 W | -13 / -20 W |
| **0,25** | **-69 / -131 W** | **-42 / -61 W** |
| 0,40 | -127 / -233 W | -89 / -125 W |

Bei q = 0,25 zusammen **70-190 W**, gegen 9-44 h aus der Reihenfolge. Nebenbei: 3a's 1.565 W setzen q = 0,25 voraus; mit dem Lauf-1-Wert
q = 0,368 waeren es rund 1.710 W - Erics Verhalten allein ist so gross wie alle Bot-Hebel zusammen.

**Eichstatus: ungeeicht.** c2 stammt aus 8 Luecken mit 0-100 % Streuung. Liegt das wahre c2 schon bei 0,9, ist der Hebel ~0 (dann sind aber die
B-Werte verschoben, nicht die Rangfolge). **Messbar ohne Lauf-Kosten:** `ns.bladeburner.getBonusTime()` (`NetscriptFunctions/Bladeburner.ts:367`)
bei jedem Wiederverbinden protokollieren, dazu Rang je verbrauchter Bonussekunde gegen Rang je Echtzeitsekunde. Achtung "Rate oder Bestand": jede
Rangrate nach einer Nacht ist zum Teil Abbau des Bonusvorrats - auch die Graft-Messung (1.5) muss Bonusphasen ausschliessen.

**Urteil 1.3: HAELT** als Befund "Offline > Reihenfolge"; Zahl ungeeicht, Messauftrag fuer den ersten V2-Lauf.

### 1.4 BN4 in V1 plus SF4.3 vor dem V1-Block (Variante K4)

`1.1 4.1 4.2 4.3 1.2 1.3 5.1 5.2 5.3 6.1 10x3 9x3 12x3 2x3 3x3 11x3 6x2 7x3 14x3 13x3 15x3 8x3` (BN4.2/4.3 in V1, Singularity in BN4 ohne Aufschlag).
Zwei Effekte zugleich: BN4 in V1 (B 17,9 gegen 44,6 in V2) und **SF4.3 ab Lauf 5** statt ab Lauf 17 (h1) bzw. 10 (Route 1).

| Monte-Carlo, Differenz zu Route 1 (P10/P50/P90, P(besser)) | S0 | S1 | S3 | S5 | S6 |
|---|---|---|---|---|---|
| h1 (3a-Empfehlung) | -22/-9/-4, 100 % | -52/-17/-7, 100 % | 0/**+14**/20, **10 %** | -12/**+21**/35, 26 % | -23/-2/6, 63 % |
| K4 | -47/-12/31, 63 % | -64/-32/6, 85 % | -61/-26/18, 76 % | -64/-32/8, 84 % | -62/-29/13, 81 % |

Empfindlichkeit auf B(BN4,V1) (Mitte): K4 bleibt besser bis B x1,25 (S0) bzw. x1,5 (S3); bei x2 verliert K4 26-38 h.
Gegen die faire Basis "Route 1 mit freier BN4-Wahl" (3a's eigene Empfehlung) ist K4 **nur dann** besser, wenn SF4.1 kostet (S3: K4 - h1 = -24 h,
88 %); wiegt dagegen "V1 ohne 128 GB home" schwerer (k9v1 20 %), ist h1 mit spaetem BN4-V1 um 19 h besser. Beides ungeeicht - den Ausschlag gibt
die Technik (Winkel 3/4): K4 schickt den Bot ab Lauf 5 in den RAM-Zustand, in dem sein heutiger Code gelaufen ist.

**Urteil 1.4: UNSICHER, aber besser begruendet als h1.** Messbar in Lauf 2 selbst: BN4.1 hat denselben SF-Zustand wie in Lauf 1 (SF1.1) und liefert
B(BN4,V1) direkt (Winkel 4).

### 1.5 Simulacrum und BN7-Position - ein ungemessener +-55-h-Schalter

- Ohne `The Blade's Simulacrum` bricht jede Arbeit die Bladeburner-Aktion ab (`Bladeburner.ts:177-179`, `:1356-1366`); der Bot haelt deshalb bei
  jedem Graft den Motor an (`src/blade.js:4596-4665`, "Graft laeuft ohne Simulacrum - Motor haelt still"). Sein Graftplan setzt **NMI, dann
  Simulacrum (450 Mrd) als Paar mit der ersten Kampf-Aug** vor den Rest (`nodes/GRAFTING.md`, Abschn. Reihenfolge).
- 450 Mrd sind in den Knoten vor BN7 innerhalb eines Laufs kaum erreichbar: Einnahmen BN3 0,5-1,9, BN6 0,5, BN11 0,4-0,5, BN9 2,4-5,2, BN4 4 Mrd/h
  (2a, Abschn. 2) gegen Stufen von 15-50 Online-h. SF7.3 schenkt das Simulacrum beim Divisionsbeitritt (`PlayerObjectBladeburnerMethods.ts:14-19`).
- Der einzige gemessene Graft-Effekt (BN15.3: Black-Op-Chance 4,3 -> 98,7 % in 4 h) lief **mit** SF7.3. 3a rechnet den Graft-Gewinn (2 / 7,5 h je Lauf)
  ab SF10.1 voll - in Route 1/h1 sind das 21-24 V2-Laeufe **ohne** Simulacrum.

| Mitte, Differenz zu Route 1 | S0 (3a) | S2 (gSim 0,5) | S1 (gSim 0) |
|---|---:|---:|---:|
| Route 1 absolut | 1.565 | 1.600 | 1.635 |
| B7 `1 4 1x2 5x3 6 7x3 10x3 9x3 4x2 12x3 2x3 3x3 11x3 6x2 14x3 13x3 15x3 8x3` | +18 | -17 | **-52** |
| B7k (= K4 mit BN7 direkt nach BN6.1) | +10 | -25 | **-60** |
| MC B7k (P10/P50/P90) | -37/+20/152 | | -108/-56/-8 (93 %) |

Simulacrum erlaubt ausserdem Faktionsarbeit parallel zur Bladeburner-Aktion (bn4rep.js, Befund B5) - das ist in keiner Zahl oben enthalten, der
Wert von SF7.3 ist eher hoeher.

**Urteil 1.5:** 3a's Satz "BN7 vor BN14/13/15 bleibt ... kein Grund" ist **zu kurz**. Die Position von BN7 (Platz ~8 oder ~30) ist die groesste
Reihenfolge-Frage, die es gibt, und sie haengt an einer ungemessenen Groesse. Messbar im ersten Lauf mit Graft-Zugang (BN10.1).

### 1.6 Einbau-Taktik

Gehoert zu Teil 4 (Einbau-Zeitpunkt). Hier nur der Groessenvergleich: Einzelvorfaelle der Einbauregeln in Lauf 1 (V19/V20 Einbau vor Beitritt
6,6 W; V35 Einbau in BN9 ca. 20 h) liegen jeder fuer sich in der Groessenordnung des h1-Gewinns. Nicht gerechnet.

**Urteil Winkel 1: FALSCH in der Gewichtung.** "Reihenfolge" ist fuer Lauf 2 nur in den ersten ~10 Laeufen eine Frage, und dort wegen der
SF-Zustaende (SF4.3, SF7.3), nicht wegen der SF-Gewinne aus 2b. Groesser sind Offline-Verwertung (70-190 W) und die Simulacrum-Frage (+-55 W).

---

## Winkel 2 - Modellgueltigkeit

### 2.1 Was die Eichung prueft

- **In-sample und Leave-one-out je Knoten sind (fast) Identitaeten.** B je Knoten ist das geometrische Mittel seiner Laeufe. Bei drei Laeufen ist
  die Summe der drei LOO-Vorhersagen die Summe der geometrischen Mittel der drei Paare - jeder Lauf steckt in zwei Paaren mit Gewicht 1/2, also
  ist die Summe bis auf "geometrisch statt arithmetisch" (immer negativ) und die G-/I-Bereinigung gleich der Ist-Summe. Daher die Spalte -7,3 bis
  +6,1 %. Das ist keine Aussage ueber Vorhersagekraft.
- **Die einzige echte Probe ist der Hold-out der dritten Stufen**, und er prueft genau, was die Reihenfolge braucht (gleicher Knoten, anderer
  SF-Stand): BN2 +46,7, BN3 -43,0, BN5 -21,1, BN7 -15,4, BN9 +29,4, BN11 -17,8, BN13 +55,2, BN14 +19,8, BN15 +43,3 % - **9 von 14 Knoten
  ausserhalb 15 %**. Die +2,1 % in der Summe sind Ausloeschung.
- **Alles Ordnungsrelevante ist kollinear.** Die 6 imputierten Laeufe (1.1, 4.1, 5.1, 6.1, 10.1, 10.2) sind die SF-aermsten, die fruehesten
  (hoechste Unreife) und die mit dem alten Bot. Datum, SF-Zustand, Imputation und Bot-Stand lassen sich nicht trennen.

**Urteil 2.1:** "Das Modell trifft je Knoten" **FALSCH** als Aussage ueber Vorhersagekraft; **haelt** fuer die Summe.

### 2.2 Die Verbote einzeln

**(a) BN10/BN9 nicht nach hinten (+30..+170 h).**
- Modell: ohne SF-Gewinne exakt 0 (3a-Ablation), zu zwei Dritteln Graft. Mit "Graft lo" wird b2 sogar -16 - 3a Abschn. 9 "bei verschwindenden
  Gewinnen neutral" stimmt also nicht.
- Daten Lauf 1: In Online-Stunden ist kein SF9-/SF10-Effekt sichtbar: BN9 34,2 / 49,8 / 46,6 Online-h mit SF9 0/1/2; BN10 95 / 117 / 97 W
  mit 1/2/3 Sleeves. Die fallende E-Reihe von BN9 (69 / 66 / 51) entsteht erst durch die 50-%-Offline-Annahme.
- Mit gSim 0 (1.5) faellt der Abschlag auf b1 +47, b2 +76 (MC P50; 3a: +77/+172), P(besser) 0 % - die **Richtung bleibt** (Sleeves, 128 GB home,
  Hash->Rang sind Mechanik), die Groesse ist ungeeicht.
- **Urteil: Richtung HAELT, "belastbar" FALSCH.** Die "93-100 % der Ziehungen" folgen aus der Modellform (Gewinn x Zahl der Folgelaeufe), nicht aus Daten.

**(b) BN8 nicht vor die SF-Basis (+43..+158 h).** Nur ueber den geratenen Zuschlag k8 (ohne ihn +18/0). Mechanik: In BN8 gibt es Geld nur aus der
Boerse (ScriptHackMoneyGain 0, CrimeMoney 0, HacknetNodeMoney 0, `BitNode.tsx:770-790`); 30 Augs fuer Daedalus machen **SF11** (Preistreppe 1,9 ->
~1,77, beim 30. Aug rund Faktor 9) und SF1/SF5/SF12 (Hacking 3.000) mechanisch wichtig, SF9/SF10 kaum - k8 gewichtet alle sechs gleich. Daten: BN8 lief
nur mit allen SF. **Urteil: HAELT als Regel** (BN8 am Ende kostet im Modell nichts), die Stundenzahl ist **unbelegt**.

**(c) Stufen am Stueck (+140 h).** Gut die Haelfte ist ein Artefakt: In d2 stehen BN8.1/8.2 in Runde 1/2 und zahlen k8. Mit BN8 am Ende
(`d2b`, Rest verteilt): Mitte +48, MC P50 +27 bis +85 je nach Szenario. Daten: In Lauf 1 gab es keine verteilte Folge. **Urteil: Richtung HAELT,
Zahl FALSCH** (~50 statt 140).

**(d) BN6 nicht vor BN4 (0-40 h ueber pi4).** Quelle: Ohne SF4 wirft ausserhalb BN4 **jeder** Singularity-Aufruf (`NetscriptHelpers.tsx:388-396`);
der x16-Preis gilt fuer SF4.1 (`RamCostGenerator.ts:82-96`). Der Bot verlaesst Knoten ueber `destroyW0r1dD43m0n` mit `boot.js` als Rueckruf
(`src/exit.js:12-16`) - ohne SF4 also kein autonomer Ausgang, kein Wiederanlauf, Augkauf/Einbau/Faktion nur ueber die Oberflaeche. Ein V2-Lauf
ohne SF4 wurde nie gefahren. **Urteil: HAELT, im Modell unterschaetzt.**

**(e) Fehlendes Verbot:** "keine vermeidbaren Laeufe ausserhalb BN4 bei SF4.1". h1 verletzt es zwoelfmal (1.2, 1.3, 5.1-5.3, 6.1, 10.x, 9.x),
Route 1 fuenfmal (5.1, 6.1, 10.x), K4 keinmal (4.2/4.3 laufen in BN4 selbst, ab Lauf 5 gilt SF4.3; nur BN1.1 ist ganz ohne SF4).

### 2.3 Die "98 % Vorzeichen"

Die gepaarte Monte-Carlo-Rechnung zeigt nur Konsistenz bei abgeschalteten fehlenden Termen. Mit dem SF4.1-Term faellt P(besser) fuer h1 von
100 % auf 10 % (S3) bzw. 26 % (S5); fuer B7k steigt es von 35 % auf 93 % (S1). Die Rangfolge der Varianten wird von Termen bestimmt, die nicht
im Modell sind.

**Urteil Winkel 2: UNSICHER bis FALSCH.** Die Summe haelt, die Knotenebene nicht; von den Verboten haelt (d) sicher, (b) und (c) als Richtung, (a)
als Richtung ohne belastbare Groesse.

---

## Winkel 3 - Reifefaktor I = 1

### 3.1 Unreife und SF-Armut sind in Lauf 1 dasselbe

Unreife je Lauf (3a-Prior, Mitte; eff-h / Wanduhr-h): 1.1 6,7/10,6 - 4.1 6,1/9,6 - 5.1 3,0/4,7 - **6.1 35,8/45,9 - 10.1 23,5/30,1 - 10.2 15,8/20,3** -
10.3 5,4/7,2 - 4.2 1,4 - 9.1 1,1. **100,1 von 101 eff-h liegen auf Laeufen mit SF4 <= 1 (ausserhalb BN4) oder SF9 < 2.** CHRONIK fuehrt BN10.2 selbst
als "21,5 h Kaltstart und volles home" - das ist eine Kostenfolge des Zustands (V27: erster Mietrechner 5x Preis bei 32 GB home; V28: `bn4rep.js`
26 h ohne Platz, es ist bei SF4.1 850 GB gross), nicht nur Unerfahrenheit. Die ersten sieben Laeufe von Route 1 kosten im 3a-Modell **303 W**, in
Lauf 1 **523 W**: Der Plan bucht 220 W Verbesserung auf genau die Laeufe, die der heutige Bot in diesem Zustand nie gefahren hat.

### 3.2 Zustaende, in denen der heutige Bot nie gelaufen ist

| Zustand | Laeufe in h1 | Beleg (Code/Quelle) | zuletzt so gelaufen |
|---|---|---|---|
| home 8 GB, keine Singularity | 1.1 | Kern `bn4net.js` 17,75 GB + `boot.js` 5,5 GB > 8 GB (`doku/ram-budget.md:152,172`, Kaltstart-Budget Abschn. 3 rechnet mit 32 GB); `boot.js:20` "home ist auf 32 GB"; Ausgang nur per Oberflaeche (`bitverse.js` 27 GB), danach kein Rueckruf-Neustart | 19.-21.08., August-Bot ueber Bruecke |
| V1 bei SF4.1 (x16) | 1.2, 1.3, 5.1, 5.2, 5.3 | `bn4rep.js` 850,75 GB, `exit.js` 519,25, `cheap.js` 306,75 (`ram-budget.md:95-100`); jeder Einbau loescht den Rechnerpark, V1-Laeufe hatten 9-13 Einbauten | BN5.1, 23.-24.08., vor dem Neubau |
| V2 bei SF4.1 | 6.1, 10.x, 9.x (Route 1: 6.1, 10.x) | `blade.js` 174 GB statt 99 | BN10.2-Rest und 10.3 bis 10.09., Bot-Stand von damals |
| ohne SF5 | 1.1, 4.x, 1.2, 1.3 | `getBitNodeMultipliers` wirft (`NetscriptFunctions.ts:917`); Bot faellt auf Tabellen zurueck, ausdruecklich "Rueckfall fuer einen Fehlerfall, kein Normalbetrieb (SF5 ist vorhanden)" (`bn4rep.js:225`) | BN4.1, 21.-23.08. |
| V2 mit Graft ohne Simulacrum | h1 Platz 9-32 | Motor steht waehrend jedes Grafts (`blade.js:4596-4665`); Zuender 04.09.-07.11. zurueckgehalten | nie in groesserem Umfang |
| Routenlogik fuer die ersten Spruenge | 1.1 -> ... -> 10.1 | `src/route.json` beginnt bei BN10.2; `test-route.js` prueft nur die reine Funktion | nie |

### 3.3 `k !== 6 && k !== 7` und die Klasse dahinter

Die konkrete Knotenliste ist **behoben**: `bn4rep.js:130-160` liest das Verfahren aus der Route (`data/verfahren.txt`), Rueckfall V2. Die Klasse
"Annahme aus einem anderen Zustand" lebt aber in Kommentaren und Konstanten weiter, die in Lauf 2 falsch werden: `boot.js:20` (32 GB home),
`bn4rep.js:225` (SF5 vorhanden), `doku/ram-budget.md` (Kaltstart-Budget gegen 32 GB), `exit.js:24-25` (Kopfkommentar "Black Ops nicht gebaut,
SF6/SF7 gibt es nicht", veraltet).

### 3.4 Was ein neuer Zustand kostet

Lauf 1: V05 (BN6.1-Kaltstart) 2 W, V27/V28 (BN10.2) bis 21,5 W, V31 (BN4.2) ~1 W, Muster 2 "Kaltstart nie im Zielzustand getestet" mindestens
10 Vorfaelle. Grob 1-20 W je erstmals erreichtem Zustand, solange er nicht vorher im Pruefstand (`tools/mock/`) lief. **Jede Umordnung, die
neue Zustaende erzeugt, zahlt diesen Preis; das Modell kennt ihn nicht.** h1 fuegt gegenueber Route 1 die Klasse "V1 bei SF4.1" (5 Laeufe) hinzu,
K4 entfernt beide SF4.1-Klassen ganz.

**Urteil Winkel 3: FALSCH** als pauschale Annahme. Haltbar ist I = 1 nur fuer Zustaende, die der heutige Bot in Lauf 1 gefahren hat (SF4.3,
>= 32 GB, SF5, Simulacrum beim Graften). Fuer alle anderen ist I unbekannt, Rahmen bis zum Lauf-1-Wert: **Absolutplan +0 bis +135 W**.
Die "Reife-Frage aus C1" entfaellt nicht, sie heisst in Lauf 2 "SF-Zustands-Frage": Wann kommen SF4.3, SF7.3, SF9.2?

---

## Winkel 4 - Kaltstart (erste Laeufe)

| Aussage in 3a | Quelle | Urteil |
|---|---|---|
| BN1.1 ist der feste Anfang | `RedPill.tsx:52-90` (keine Freischaltkette), `Singularity.ts:1155-1157` (nur gueltige Knotennummer) | HAELT |
| SF1: 32 GB home ab Knotenstart | `Prestige.ts:245-251`: SF9 >= 2 -> 128, SF1 > 0 -> 32, sonst **8** | HAELT |
| "ausserhalb [BN4] kostet jede Funktion das 16-Fache" | Ohne SF4: Aufruf wirft (`NetscriptHelpers.tsx:388-396`). x16 gilt bei SF4 <= 1, also **auch mit SF4.1** (`RamCostGenerator.ts:82-96`) | **FALSCH im Detail, wichtig in der Wirkung**: der x16-Zustand ist SF4.1 und im Modell kostenlos |
| V2 erst mit SF6/SF7 oder in BN6/BN7 | `PlayerObjectBladeburnerMethods.ts:6-8`, `NetscriptFunctions/Bladeburner.ts:34-36` | HAELT |
| BN4.1 als zweiter Lauf | Singularity in BN4 ohne SF4 und ohne Aufschlag | HAELT, staerker als pi4 sagt (ohne SF4 kein autonomer Ausgang, `exit.js:12-16`) |
| BN1.1 kostet 18 E / 24 W | Lauf 1: 46 W; heutiger Kern passt nicht in 8 GB | **UNSICHER**: realistisch 24-50 W, braucht einen Startpfad <= ~6 GB (Teil 5) |
| V1-Block 1.2/1.3/5.1-5.3 vor BN6.1 | 5 V1-Laeufe bei SF4.1 und 32 GB home, `bn4rep.js` 850 GB nach jedem der 9-13 Einbauten neu zu beherbergen | **UNSICHER, schlechter begruendet als K4** (1.4) |
| SF5 nicht erwaehnt | `getBitNodeMultipliers` braucht SF5/BN5 (`NetscriptFunctions.ts:917`) | Luecke; Rueckfaelle vorhanden, aber als Fehlerfall gebaut |
| Simulacrum nicht modelliert | SF7.3 beim Beitritt (`PlayerObjectBladeburnerMethods.ts:14-19`), sonst Kauf 150 Mrd x AugGeld oder Graft 450 Mrd | Luecke mit +-55 W (1.5) |

**Was ich statt h1 vorschlage (Kaltstart):**
`1.1` (Handstart, eigener Startpfad <= 8 GB, Ausgang per Oberflaeche) -> `4.1` (Handstart oder Bruecke nach dem Oberflaechen-Ausgang; **misst
B(BN4,V1)** im selben SF-Zustand wie Lauf 1) -> **Entscheidungsregel**: BN4.1 online <= ~30 h (1,25x Modell) -> `4.2 4.3` sofort in V1; >= ~36 h ->
4.2/4.3 spaeter (V2 nach BN6.1, Route-1-Platz) -> `1.2 1.3 5.1 5.2 5.3` (V1, ab hier SF4.3: `exit.js` 39 GB, `bn4rep.js` 63 GB, autonome Spruenge) ->
`6.1` -> `10.1` (**Graft-Ereignisstudie ohne Simulacrum**, Bonusphasen ausgeschlossen) -> Entscheidung `10.2` oder `7.1`.

**Urteil Winkel 4: teilweise FALSCH.** 1.1 -> 4.1 haelt; der V1-Block vor SF4.3 ist die schwaechste Stelle der Empfehlung.

---

## Was fuer Lauf 2 wirklich entschieden werden muss

| Nr | Entscheidung | Wirkung (Wanduhr-h) | Eichstatus | Wann / wie |
|---|---|---|---|---|
| 1 | **Offline-Verwertung**: Bonuszeit in V2 (C5), langlebige Erfahrungsarbeiter in V1 (C4) | **70-190** bei q 0,25 (Reihenfolge: 9-44) | ungeeicht (c2 aus 8 Luecken, 0-100 %); Mechanik aus der Quelle belegt | erster V2-Lauf: `getBonusTime` protokollieren; bauen, wenn gemessenes c2 < 0,8 |
| 2 | **Kaltstart-Abdeckung** der SF-armen Zustaende (Teil 5): Startpfad <= 8 GB, Oberflaechen-Ausgang BN1.1, V1/V2 bei SF4.1, ohne SF5 | Risiko **+0 bis +135** auf den Absolutplan; 1-20 je ungetestetem Zustand (Lauf 1) | aus Lauf 1 nicht identifizierbar | vor dem Start jeden Zustand der ersten ~10 Laeufe im Pruefstand fahren |
| 3 | **BN7-Position gegen Graft ohne Simulacrum** | **+20 bis -56** (B7k gegen Route 1) | Graft vor SF7.3 nie gemessen | Ereignisstudie in BN10.1, Entscheidung vor BN10.2 |
| 4 | **SF4.3 vor den V1-Block (K4)** mit Messregel an BN4.1 | **-12 bis -32** (P50) gegen Route 1; gegen h1 +-20 je nach unbekanntem Aufschlag | B(BN4,V1) aus 1 imputierten Lauf; SF4.1-Kosten ungeeicht | BN4.1 selbst |
| 5 | Verbote festschreiben: BN4.1 vor BN6.1; BN10/BN9 nicht ans Ende; Stufen am Stueck; BN8 am Ende (vor BN11 nur mit gemessener Boerse in V2) | +47..+147 / ~+50 / 0 | Richtung Mechanik, Groesse ungeeicht | jetzt |
| 6 | **Nicht** entscheiden bzw. streichen: Feinordnung ab Platz ~12 (Rauschen); V1b-Labyrinth (Verlust +30..+200); V1 in BN2/3/6/7/9/10/11/13/14/15 | - | - | streichen |

## Was ich nicht aendere und was offen bleibt

- 3a's Modellcode enthaelt keinen Rechenfehler; die SF-Gewinne aus 2b habe ich uebernommen (2c hat sie geprueft).
- Meine drei Zusatzterme sind Proben, keine Messungen. Ich habe weder die SF4.1-Kosten noch den Graft ohne Simulacrum noch c2 gemessen.
- Bot-Code gelesen, nicht ausgefuehrt; RAM-Zahlen aus der Messung vom 04.09. (`ram-budget.md`), Dateien sind seither gewachsen.
- Einbau-Taktik (Teil 4) und die Boerse in V2 (2c: erst Ereignisstudie) nicht bewertet.
- Die Empfehlung "Route 1 behalten" aus 3a halte ich fuer vertretbarer als h1; K4 ist besser begruendet, aber an eine Messregel gebunden.
