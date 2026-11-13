# Teil 2 - Mechaniken: was lag brach, was bringt es in Lauf 2?

Stand 13.11.2026. Ergebnis von Teil 2 des Plans `nodes/AUDIT-LAUF2-2026-11.md`.
Zusammengefuehrt aus `2a-geld-ruf.md` (Geld/Ruf), `2b-fortschritt-sf.md` +
`2b-sf-modell.json` (Fortschritt, SF-Wirkungen, Knotenmultiplikatoren) und
`2c-skeptiker-mechaniken.md`. Wo der Skeptiker widerspricht, gilt sein Wert.

Erics Entscheidungen vom 13.11.2026: Casino-Roulette erlaubt; Infiltration
erst messen (Bauverbot bleibt bis dahin); Lauf 2 startet frisch (BN1.1, keine SF).

## 1. Rangliste der Hebel fuer Lauf 2 (nach Skeptiker)

Stunden als niedrig / Mitte / hoch, Online-Stunden ueber alle Laeufe, in denen
die Mechanik wirkt. "Geeicht" heisst: Formel gegen Spielstaende oder
Spielquelle bitgleich nachgebaut. Die Umrechnung Geld -> Rang-Stunden ist in
keinem Fall geeicht.

| Rang | Mechanik | Nutzen Lauf 2 (h) | Eichung | Entscheidung |
|---|---|---|---|---|
| 1 | **Casino-Roulette in BN8** | 11-13 je Stufe, 33-39 fuer BN8 x3 | Marktmodell gegen 4 echte BN8-Zyklen; Vorhersage bitgleich gegen RNG.ts; im Spiel gemessen (10,05 Mrd in 51 s) | **gebaut 13.11.2026**, laeuft ab BN8.2 |
| 2 | Geldquellen in V2 zusammen (Boerse, Casino als Startkapital, ggf. Infiltration) | 0 / 35 / 110 | Geldseite ja, Rang-Wirkung nein | Boerse in V2 und Casino als Startkapital bauen, aber zuerst messen (Ereignisstudie, siehe 3) |
| 3 | Grafting-Zuender ab dem ersten V2-Lauf mit SF10 | 0 / 110 / 360 | Preis, Zeit, Chancenkette ja; Knotenzeit nein | gebaut; in Lauf 2 von Anfang an an, Wirkung messen |
| 4 | Infiltration (Ruf, falls Ruf bindet) | 0 / 25 / 150 | Formel ja, Spiel nein | **Messprotokoll** in `2c-skeptiker-mechaniken.md` (Winkel 5); Bau erst, wenn alle drei Schwellen halten |
| 4b | Infiltration (Geld) | 0 / 12 / 60 | wie oben | Geld ODER Ruf je Sieg, nicht beides |
| 5 | IPvGO in jedem Knoten | rund 2 je Lauf ohne SF14 | Effekt 1e-6 | gebaut; SF14 vor BN13/BN15 |
| 6 | SF1/SF6/SF7/SF14-Kanaele | je Lauf 0,4-2 | Mults ja | nicht additiv; mit fruehem Graft nahe 0 |
| 7 | Sleeves, Hash -> Rang, Intelligence, NeuroFlux | klein | Raten ja | nicht anfassen |
| - | Gang ausserhalb BN2, Corp ausserhalb BN3, Hash -> Contracts, Firmenarbeit, Stanek | 0 | - | nicht bauen |

## 2. Was gefallen ist

- Boerse in V2: 2a "26 / 80 / 325 h" und 2b "0 / 6 / 17 h" fallen beide; haltbar ist 0 / 15 / 80 (ungeeicht).
- Infiltration: 2a "44 / 110 / 410 h" rechnete Geld und Ruf parallel; je Sieg gibt es eines von beiden.
- Grafting rueckblickend "220 h": eine Hochrechnung der Je-Lauf-Mitte; haltbar 0 / 110 / 360.
- GANG-3 (BN15 -20 bis -40 h): Karmaernte kostet 13-18 h, faellt.
- BOERSE-1 (-17,5 h in BN2): Geldseite haelt, Stundenzahl verglich Geldzeit mit Laufzeit.

## 3. Der wichtigste Messauftrag fuer Lauf 2

Ob Geld in Bladeburner-Knoten ueberhaupt der Engpass ist, weiss niemand. Das
Gegenindiz BN15 (35 / 36 / 34 Online-h trotz Graft und Go) spricht dagegen,
haengt aber an der ungeeichten 50-%-Offline-Gutschrift. Deshalb in Lauf 2
**eine Ereignisstudie innerhalb eines Laufs**: in einem geldarmen V2-Knoten
(BN13 oder BN3) Rangrate vor und nach einer Geldspritze (Casino 10 Mrd,
Boerse) gegenueberstellen. Erst danach werden Boerse und Infiltration fuer V2
gebaut.

## 4. Fuer Teil 3 (Reihenfolge)

- SF-Wirkungen je Stufe und Knotenmultiplikatoren: `2b-sf-modell.json`.
- SF1 hat den groessten belegten Folgenutzen (32 GB home, Multiplikatoren),
  Grenznutzen je Stufe fallend (1,4 / 0,6 / 0,3 h Mitte je V2-Lauf).
- SF2, SF3, SF13, SF15 haben praktisch keinen Folgenutzen - ihre Knoten sind
  in der Reihenfolge frei.
- SF4 ist Voraussetzung (ohne SF4 keine Singularity ausserhalb BN4), SF10.1
  ebenfalls (Graft-API); kein Stundenwert.
- SF6 oder SF7 schalten die Bladeburner-API frei.
- Die Vorphase (Rang bis 10.000) ist chance-begrenzt und dauert 43-90 % der
  Online-Zeit; die 21 Black Ops haben eine Untergrenze von 21-22 h bei
  schwachen Werten, rund 1,5 h bei starken.
- Was die Daten nicht trennen: jeden SF-Effekt unter etwa 5 h je Lauf
  (Rauschboden rund 3 h; SF-Stufen, Bot-Reife, Graft und Go kamen gleichzeitig).
