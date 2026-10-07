# Hash-Rang im Anlauf (Befund B7) - Rechnung und Urteil, 07.10.2026

Werkzeuge: `tools/hashrang-rechnung.mjs` (Teil a), `tools/hashrang-sp.mjs` (Teil b, `eich`/`kalib` = Eichlaeufe),
Test `tools/test-hashrang.js`.

## Eichung (Teil a, alles gruen)
Rate Gratisserver 0,4814411330033169 H/s und Stummel 0,0034388652357379 (BN2L1-Spielstand 03.10.), Rangpreis Stufe 5 = 1500,
1.000 Rang = 13.750 Hashes, 10.000 Rang = 1.262.500 Hashes (Auftragsangaben **bestaetigt**: 250*(L+1) je 100 Rang, quadratisch).
Je Einbau fallen die Stufen auf 0 zurueck (`HashManager.prestige`), der Rang bleibt.

## Zahlen
- BN15: Rangfaktor 0,2, HacknetNodeMoney 1, Skillpreis x3. BN13: 0,45 / 0,4 / x2 (BitNode.tsx:1112, :1031, :1012).
- Gratisserver (L100, 10 Kerne, RAM 2, Cache 5; Prestige.ts:338-346), nur im ersten Zyklus: BN15 ca. 0,36 H/s (1.300 H/h),
  BN13 ca. 0,145 H/s. Nach dem ersten Einbau nur netburn-Stummel (gemessen 0,03 H/s) - dort lohnt nichts.
- Ein neuer Hacknet-Ausbau aus dem Nichts lohnt nicht: 1 Mrd $ -> 0,48 H/s (BN15), Hash-Rang <= 0,65 h Offset selbst bei
  10 Mrd (Teil a, untere Schranke = Rang / Endrate 11.000 Rang/h in BN15, 24.700 in BN13).
- Kosten des Tauschs: Stufe k = 62,5*k Mio $ Verkaufswert (4 H = 1 Mio $). Stufen 1-4 (400 Rang, +133 SP) = 2.500 H = 625 Mio $,
  passen in Cache 1024. Stufen 5-8 brauchen Cache 6 (117 Mio) und kosten zusammen 1,74 Mrd fuer dieselben 400 Rang.

## Wert in Stunden (Teil b, Rangmodell tools/bbrank, Kaltstart, SP-Vorsprung D/3)
- Eichfall Rangfaktor 1 (BN2-Kurve getroffen): 1.000 Hash-Rang = ca. 4 h Vorsprung, bleibt bis zum Ende bestehen.
- BN15/BN13: Modell zeigt 28-63 h fuer 1.000 Rang - **ungeeicht** (BN10 liegt im Modell 3-4x zu schnell), Rang kommt im Modell
  sofort statt tropfend, gebauter Bereich (400 Rang) ist nicht simuliert. Ehrliche Spanne fuer 400 Rang: **ca. 1-20 h je
  Lauf, Mitte unsicher**; Untergrenze (nur Offset) 0,04 h.

## Urteil
Nicht abgebrochen, aber klein gebaut: BN13/BN15, V2, in der Division, Konto unter 1 Mrd -> Hashes in Rang bis Stufenpreis 1000
(4 Stufen), Rest Verkauf. Kein Cache-Kauf, kein Geld ausgegeben, hacknet.js unveraendert, RAM unveraendert (5,95 / 10,45 GB).
Grund fuer die Verkleinerung (Skeptiker): Stufen 5-8 kosten das Dreifache je Rang und liegen ausserhalb jeder Eichung.
Risiko: Hashes des ersten Zyklus gehen nicht ins Geld (625 Mio $ in BN15, ca. 250 Mio in BN13 mit 0,4er Faktor).
Nach der ersten BN15/BN13-Messung (Rangkurve) die Eichung f=0,45/0,2 nachholen und den Deckel neu setzen.
