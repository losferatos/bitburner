# Teil 4 - Bot-Entscheidungen je Gewerk

Stand 13.11.2026. Aus `4a-gewerke.md` (Pruefer) und `4b-skeptiker-gewerke.md`
(Skeptiker). Es gilt der Skeptiker-Wert.

## 1. Kernergebnis

**Die Gewerke entscheiden weitgehend richtig.** Der groesste Befund des
Pruefers - die Einbaufrist von 12 h als Taktgeber, 0 bis 250 h - faellt: Die
Rangrate haengt am Rang, nicht an der Zahl der Einbauten (gleicher Rang im
selben Lauf, gleiche Rate ueber die Stufen), jeder Einbau kostet 1-3 h
Erholung, und Einbauzahl und Laufzeit haengen nicht zusammen (BN15: 6, 3, 2
Einbauten bei 35,5 / 36,0 / 33,7 Online-h). Bladeburner-Aktionswahl,
Black-Op-Schwelle, Skillkauf, NeuroFlux, Kauffilter, Spenden, Faktionswahl:
kein belegbarer Fehler.

## 2. Liste fuer den Bauplan

| Nr | Befund | Nutzen Lauf 2 (online-h) | Entscheidung |
|---|---|---|---|
| G50 | Kernkauf ohne Ertragspruefung (`homegrow.js:108`): BN9.1 gab 63,75 Mrd fuer Kerne aus bei 0,68 Mrd Hackertrag | 0 / 1 / 5 | **bauen** (klein, kein Gegenrisiko) |
| G20 | V1-Offline: Einbau nicht in die 4 h vor einer Offline-Phase legen (bn4net.js startet neu und verliert die 4-h-Zuversicht) | 2 / 5 / 10 | bauen, niedrige Prioritaet |
| G60 | BN3.3: Corp blieb privat, Tobacco-Umsatz 2.700-fach unter BN3.2; Fix 0a14f22 lag schon davor | 0 / 6 / 11 | **messen**: Corp-Kaltstart-Test, Ursache klaeren |
| G01 | Einbaufrist 12 h | -10 / 0 / +15 | **messen** (einen Einbau in einem V2-Knoten verschieben); Frist nicht kuerzen |
| G21 | V1-Fruehphase: 60-70 % der Online-Zeit bei Hacking unter 1.000 | 0 / ? / 36 | **messen** (RAM, Geld oder Ziele?) |
| G40 | Sleeve-Vertragswahl nach Vorrat statt Rang je Stunde | 0 / 1 / 5 | messen |
| G02 | Kaufreihenfolge ohne Gang | 0 / 1 / 3 | messen (Ereignisstudie, MECHANIKEN 3) |
| - | Reaper/Evasive ohne Klemmfaktor (binden ~32 % der Skillpunkte); Hands of Midas nie gekauft | nicht bezifferbar | messen |
| G13 | Bladeburner offline | 0 | verworfen (Spielcode: voll gutgeschrieben) |
| G03, G01-Wanduhr | Interlock, Frist offline | 0 | verworfen |

## 3. Die drei Ausreisser aus Teil 1 (C10)

- **BN7.3** ist in Wanduhr kein Ausreisser (75 / 62 / 67 h). Offen bleibt
  eine halb so schnelle Vorphase (Rang 1.482 gegen 3.393 nach 12,4 h,
  Raid-Quote 12 % gegen 20-22 %).
- **BN3.3** dauerte 35,9 h (nicht 46); Ursache ist der Corp-Ausfall (G60).
- **BN13.2** liegt online (36,6 h) zwischen den Nachbarn; der Ausreisser ist
  die Wanduhr (24 h Luecken).

## 4. Fazit fuer Lauf 2

Die Gewerke tragen. Gebaut werden nur kleine Dinge (G50, G20); der Rest sind
Messauftraege, die in Lauf 2 nebenher laufen. Die Zeit liegt nicht in
Fehlentscheidungen der Gewerke, sondern in der Knotendauer und im Kaltstart
(Teil 3, Abschnitt 4).
