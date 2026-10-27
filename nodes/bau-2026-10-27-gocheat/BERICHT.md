# go.cheat im IPvGO-Spieler (27.10.2026, BN13, SF14.3)

**Ergebnis: lohnt. +20 bis +30 % Node Power je Aktion (Zeitmass), Siegquote 92-98 % -> 98-100 %. Kandidat: `go.js` + `lib/gocheat.js` (gomcts.js unveraendert). RAM 11,25 -> 20,25 GB.**

## Belege aus dem Spielcode (`reference/bitburner-src/src`)
- Funktionen `go.cheat.*` (NetscriptFunctions/Go.ts:134-212): getCheatSuccessChance, getCheatCount, removeRouter, playTwoMoves, repairOfflineNode, destroyNode. Zugang: SF14 > 1 (netscriptGoImplementation.ts:487-497).
- RAM (Netscript/RamCostGenerator.ts:326-333): getCheatSuccessChance 1, getCheatCount 1, die vier Cheats je 8 GB.
- Chance (netscriptGoImplementation.ts:561-567): `clamp(0.6 * (0.7-0.02n)^n * crime_success + 0.25, 0, 1)`, n = bisherige Cheats der Partie (auch Fehlschlaege, :534-536); Bonus 0.25 NUR bei SF14 genau Stufe 3 (:565). Live crime_success = 1.886 (Spielstand 27.10.): n=0..5 -> 1,00 / 1,00 / 0,74 / 0,55 / 0,42 / 0,34. Also zwei sichere Cheats je Partie. Zufall ist gleichverteilt (WHRNG-Erstwert, 2 Mio Proben: P(r<=p)=p).
- Fehlschlag (:518-531): Zug verloren (wie Pass). Hat es in der Partie schon einen Cheat gegeben: zusaetzlich 10 % Auswurf = Partie sofort aus, Niederlage, Serie weg, KEINE Node Power (scoring.ts:101-111).
- Einfluss auf Belohnung: keiner direkt. Node Power = Schwarz-Punkte * 1,5 * Serienfaktor (scoring.ts:81-84); Cheats zaehlen nicht gegen sie. Ein Cheat ist EIN Zug (Gegner antwortet einmal), verlaengert die Partie nicht.
- Wirkung von playTwoMoves (:599-627, boardState.ts:234, boardAnalysis.ts:474): zwei Steine ohne Legalitaets-/Selbstmordpruefung, danach werden ALLE gegnerischen Ketten ohne Freiheit geschlagen. Zwei Steine auf die letzten zwei Freiheiten schlagen eine ganze Kette (auch eine lebende Gruppe mit zwei Einzelaugen) - mit normalen Zuegen unmoeglich. Tote Steine werden bei der Wertung nicht entfernt, deshalb ist das der grosse Hebel.

## Eichung (`node tools/test-gocheat.js`, `tools/goprobe/eich-cheat.mjs`)
- `cheatChance()` (lib/gocheat.js) gegen die Spielfunktion: 448 Faelle (SF 0-3 x 7 crime-Werte x n 0-15), Abweichung 0.
- Unabhaengige Werte: Tabelle im Quellkommentar (:549-559, +66/145/282/535/1027/4278/59854 %) stimmt (Chance 0,996-1,0 beim N-ten Cheat, Vorgaenger 1,0).
- Folgen im echten Spielcode: Fehlschlag ohne Vorgaenger = kein Auswurf; mit Vorgaenger + Wurf<0,1 = Partie aus, 1 Niederlage, 0 Node Power; `simulatePair` liefert dasselbe Brett wie das Spiel.
- Szenariotest (7x7, weisse 5er-Kette mit 2 Freiheiten): alte src/go.js ROT (spielt normal), neue gruen; ohne SF14, bei Chance < pMin und Zaehler 2 kein Cheat, kein Absturz. `test-gomcts.js` bleibt gruen (16).

## Messung (tools/goprobe/vergleich-cheat.sh, 4 Prozesse x 300 s, echte Gegner-KI, Serie startet bei 20, crime 1,886; Zeitmass = Aktionen = Gegnerantworten)
| Variante | Partien | Siege | Schwarz | NP/Aktion |
|---|---|---|---|---|
| alt (src/go.js), 2 Laeufe | 79 / 84 | 92 / 98 % | 35,5 / 35,2 | 5,15 +-0,19 / 5,33 +-0,12 |
| Cheat gain>=2 | 82 | 98 % | 38,5 | 6,30 +-0,17 |
| gain>=4 (60 s, klein) | 17 | 100 % | 38,1 | 7,12 +-0,26 |
| gain>=8 | 88 | 99 % | 39,3 | 6,56 +-0,15 |
| gain>=12 | 83 | 98 % | 39,4 | 6,17 +-0,15 |
| gain>=6 | 88 | 100 % | 39,4 | 6,72 +-0,09 |
| gain>=6 + endGain 1 (Kandidat) | 90 / 90 | 100 / 99 % | 40,3 / 39,8 | 6,81 +-0,11 / 6,47 +-0,13 |
| Eroeffnungs-Doppelzug | 88 | 100 % | 38,5 | 6,63 +-0,08 (nicht besser, verworfen) |
| 4 Cheats, pMin 0,5 | 99 | 99 % | 39,2 | 6,81 +-0,15 (21 Fehlschlaege, nicht besser, verworfen) |
Schwellen 2-12 liegen innerhalb der Streuung; Kandidat gesamt ca. 6,6 gegen 5,2 (+25 %). Schwarz-Punkte +4 (35,3 -> 39,8). Auswuerfe in der Messung: 0 (alle 167 Cheats erfolgreich, Chance 1,0).

## Empfehlung
Einbauen: `nodes/bau-2026-10-27-gocheat/go.js` nach `src/go.js`, `lib/gocheat.js` nach `src/lib/` (gomcts.js ist bytegleich). Spielt weiter wie bisher; zusaetzlich Doppelzug nur, wenn getCheatSuccessChance >= 0,97 und der Doppelzug mindestens 1 (nach der Suche) bzw. 6 Flaechenpunkte mehr bringt als der beste normale Zug; hoechstens 2 Cheats je Partie.

## Offene Risiken
- RAM +9 GB (playTwoMoves 8 + getCheatSuccessChance 1) -> 20,25 GB; RAM-Rechner tools/ram.js (Bezeichner `kill` im Code haette 0,5 GB gekostet, umbenannt). Passt das auf die Werkbank in BN13? Registry/ramBaseGb pruefen.
- Live-Chance haengt an crime_success (1,886 jetzt; faellt nach Aug-Reset moeglicherweise): pMin schuetzt, dann spielt der Bot wie alt.
- Zeitmass ist Aktionszahl, nicht Wanduhr; Cheats kosten keine Aktion extra, aber 2-3 ms Planung. Gedrosselter Tab ungetestet.
- getMoveHistory enthaelt Cheat-Bretter nicht (Ko-Pruefung nur im Baum, Sucher setzt nach Cheat neu auf) - kein Fehler gemessen.
- Ein Skeptiker-Lauf steht aus (Regel: laeuft unbeaufsichtigt) - kein `[skeptiker]` im Commit.
