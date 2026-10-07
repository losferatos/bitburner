# Labyrinth V1b in BN15 - Kaufplan-Rechnung zur Hacking-Wand (07.10.2026)

Offene Frage aus `nodes/LABYRINTH-MACHBARKEIT-2026-10.md` (Urteil dort: "plausibel, nicht belegt"):
Erreicht der Bot in BN15 den Hacking-Mult 15-17, den Level 6.000 (3.000 x WorldDaemonDifficulty 2) bei
HackingLevelMultiplier 0,6 verlangt, und wann? Rechnung: `nodes/labyrinth-machbarkeit-2026-10/kaufplan.mjs`
(liest Spielquelle 3.0.2 und `backups/`, schreibt nichts, Laufzeit ~12 s). Kein Skeptiker-Lauf.

## Urteil: NICHT BAUEN

- **Geldzeit bis zur Wand in BN15: 56-180 h, Median 139 h** (12 Annahme-Ecken, 2 weitere kommen in 400 h
  gar nicht an). Dazu kommen der Nicht-Geld-Anteil der V1-Laeufe und das Darknet.
  **V1b je Lauf: Band 49-243 h, Mitte ~160 h.** V2 liegt bei 105-178 h.
- Unter 60 h kommt V1b nur in der einen Ecke, in der alles zugleich guenstig ist: Geld nicht zeitgebunden,
  EXP schnell, Einkommenskurve doppelt so hoch wie gemessen, Darknet voll parallel, Modell 7 h zu langsam
  (wie bei BN1.2). Schon die Mitte liegt im V2-Band. **"Klar schneller" ist das nicht** - das Kriterium
  aus dem Machbarkeitsbericht greift. Dazu kommt das Baurisiko (~24 Raetselloeser, Navigator, nur in BN15
  testbar), das V2 nicht hat.
- **Warum es so viel laenger dauert als V1 in BN1/5/12 (13-40 h):** Nicht die Preise. Die gleichen
  Bedingungen wie BN12.2, nur mit Wand 6.000, ergeben 9,8 h Geldzeit. Der Grund ist der **Level-Mult 0,6**:
  Die Geldexplosion der V1-Laeufe haengt am Hacking-*Level* (ab ~3.000: >= 1e14/h, ab ~5.000: ~1e15/h). Dafuer
  braucht BN15 einen Mult von 8,2 bzw. 13,6, BN12 nur 5,0 bzw. 8,4. Der Bot muss sich in BN15 also mit
  1e11-1e13/h die Mults kaufen, die ihm in BN12 schon das grosse Einkommen gebracht haetten. Dazu
  HackingSpeed 0,6, also langsamere Operationen und langsamere EXP.

## 1. Eichung

| Formel | Quelle | Eichung |
|---|---|---|
| Preiskette: Grundpreis x AugMoney x (1,9 x SF11-Rabatt)^Kaeufe, NFG x 1,14^Stufe | `AugmentationHelpers.ts:29-37, 129-160`, Konstanten aus `Constants.ts:36,41` gelesen | **122/122 Spielstaende exakt** gegen `moneySourceA.augmentations` (alle pre-install/pre-jump, alle Knoten inkl. BN10 mit AugMoney 5), Ketten bis 20 Kaeufe |
| Kaeufe nach dem Snapshot | Differenz der eingebauten Augs zweier Spielstaende | passen ins Kontogeld (Anteil 0,3-1,0, wie bei gieriger NFG-Leiter x2,17 zu erwarten) - Endphasen-Zyklen sind **geldgebunden** |
| Hacking-Mult = SF1/SF5-Basis x Aug-Mults x NFG^Stufe x 1,001^Exploits | `applySourceFile.ts:14-90`, `applyExploits.ts:16` | **87 Spielstaende BN1/5/12, groesste rel. Abweichung 1,6e-15** |
| SF11-Rabatt (Kettenbasis 1,767 statt 1,9) | `AugmentationHelpers.ts:30` | nur Quelle - es gibt keinen Spielstand mit SF11 |
| Einkommen je Stunde ueber dem Hacking-Level, EXP je Stunde ueber dem Mult | 59 bzw. 67 Bot-Zyklen aus BN1/5/12, isotone Regression in log10 | empirisch, **Streuung ~Faktor 10** je Level |
| Gesamtmodell | Rueckrechnung der V1-Laeufe | Modell-Geldzeit gegen echte Online-Zeit: BN1.2 20,2/13,1 h, BN1.3 13,5/12,7 h, BN12.1-3 8,0/40,2, 8,1/21,8, 8,1/24,1 h. Rest **-7 bis +32 h** = Ruf, Einladungen, Daedalus-Schwelle, Leerlauf. Das Modell trifft Laufzeiten nur auf Faktor ~2-5 |

## 2. Stand beim BN15-Eintritt

- SF laut `src/route.json`: SF1.3, SF5.3, SF11.3, SF12.3, SF13.3, SF14.3 (alles vor BN15). Hacking-Basis
  1,28 x 1,14 x 1,001^7 = **1,469**, dazu 3 geschenkte NFG-Stufen (SF12.3, `Prestige.ts:256`).
- BN15-Faktoren (aus `BitNode.tsx` gelesen): AugMoney 3, AugRep 1, HackingLevel 0,6, HackingSpeed 0,6,
  ServerMaxMoney 0,8, HackExpGain 1. **Kettenbasis 1,767** (SF11.3).
- Ein NFG-Zyklus mit 10 Stufen kostet in BN15 das **1,37-fache** von BN12.2 (AugMoney 3/1,04, gemildert
  durch den SF11-Rabatt). Die Preise allein machen den Weg also nur maessig teurer.

## 3. Kaufplan

Kaufliste = was der Bot in BN12.2 eingebaut hat (52 Augs ohne NFG, darunter 16 Hacking-Augs: BitWire,
Cranial Signal Processors I-III und V, CRTX42-AA, Embedded Netburner mit Core/V2/V3, Enhanced Myelin,
The Black Hand, Neural Accelerator, Power Recirculation Core, Artificial Bio-neural, BitRunners Neurolink;
Hacking-Produkt x4,38). Danach traegt nur noch NeuroFlux.

| Ziel-Mult | NFG-Stufe | Hacking-EXP nach dem letzten Einbau | EXP-Farm |
|---|---|---|---|
| 15 | 86 | 5,8e11 | 1,9-2,8 h |
| 16 | 92 | 1,6e11 | 0,5-0,7 h |
| 17 | 98 | 5,0e10 | ~0,2 h |

Mit der Kaufliste steht der Mult bei 6,44. Die BN12.2-Endstufe NFG 85 reicht fuer Mult 15. Ein letzter
Zyklus mit 10 NFG-Stufen ab Stufe 85 kostet in BN15 **2,2e14**, ab Stufe 90 **4,2e14**. In BN12.2 kam so ein
Betrag in einer Stunde herein; in BN15 erreicht der Bot dieses Einkommen erst ab Mult ~13,6.

Die Simulation kauft gierig (Liste, dann NFG mit Spende fuer den Ruf), Zyklen fester Laenge 0,5-12 h,
die beste gewinnt. Ergebnis: **11-14 Einbauten, End-Mult 14-16,7, NFG 78-96, Zyklen 4-12 h.** Ohne den
SF11-Rabatt wuerde es nur ~4 % laenger dauern (Median 145 statt 139 h) - der Rabatt rettet hier nichts.

## 4. Annahmen und Band

| Groesse | Band | Begruendung |
|---|---|---|
| Geldfaktor f gegen die Kurve | 0,50-0,83 | ServerMaxMoney 0,8 statt ~0,96; HackingSpeed 0,6 wirkt voll, wenn das Einkommen zeitgebunden ist (RAM knapp), sonst nicht |
| EXP-Faktor | 0,42-0,60 | HackingSpeed 0,6, dazu langsamere Ops bei niedrigerem Level |
| Einkommenskurve | x0,5-x2 | Streuung der gemessenen Zyklen |
| Nicht-Geld-Anteil | -7 bis +32 h, in BN15 x1,0-1,6 | Rueckrechnung (Abschnitt 1); Ruf aus Hacking-Arbeit skaliert mit dem Level (0,6/0,96) |
| Darknet | 1,8-10,8 h | Machbarkeitsbericht Abschnitt 5 (ungeeicht); untere Grenze rechnet es parallel zu den Geldzyklen |
| Todzeit je Zyklus | 0,33 h | 0,2 h aus den Laeufen / HackingSpeed 0,6 |

**Welche Uhr:** Alles in Knotenstunden (Spielzeit), verglichen mit Online-Stunden der V1-Laeufe (Abschnitt 4.1
des Pruefberichts). Offline-Zeit ist nicht drin; sie verlaengert V1b wie V2.

## 5. Nicht gerechnete Hebel (koennten das Urteil drehen)

Nur diese Hebel koennten den Mult ohne NFG-Leiter heben. Jeder braucht eine eigene Rechnung, bevor V1b
wieder auf den Tisch kommt:

- **IPvGO gegen den Gegner w0r1d_d43m0n** multipliziert `mults.hacking` (`Go/effects/effect.ts:96`);
  SF14.3 verstaerkt die Go-Effekte. BN14 kommt vor BN15 - dort laesst sich messen, wie viel der Bot erspielt.
- **Stanek's Gift** (SF13.3, in BN15 Power 0,7, Groesse -2) hat Hacking-Fragmente.
- **Firmenfraktionen**: nextSENS, OmniTek InfoLoad, Xanipher, SPTN-97, PC-DNI-Reihe, zusammen ~x3. Sie
  brauchen Firmenruf, und den kann man nicht spenden. QLink (x1,75) braucht Illuminati mit Kampfwerten 1.200.
- **Einkommen ausserhalb von Hacking**: Hashes (Hacknet in BN15 voll, SF9.3) und Corp (Bewertung 0,2) stecken
  nicht in der Kurve.

## 6. Folgen

1. **Kein Labyrinth-Gewerk.** BN15 bleibt in `src/route.json` auf V2. Befund B11 ist damit entschieden:
   V1b ist nicht klar schneller.
2. Soll die Frage wieder aufgemacht werden, dann nur ueber Abschnitt 5: Go-Hackingbonus in BN14 messen
   und Stanek beziffern. Erst wenn beide zusammen den Ziel-Mult um x1,5 oder mehr guenstiger machen, lohnt
   eine neue Rechnung. Das hiesse rund 40 NFG-Stufen weniger und die Geldexplosion ab Mult ~5,5 statt 8.
