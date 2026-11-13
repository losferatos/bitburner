# Teil 2c - Skeptiker zu 2a/2b (Mechaniken, Geld, SF)

Stand 13.11.2026. Gegenstand: `2a-geld-ruf.md`, `2b-fortschritt-sf.md`, `2b-sf-modell.json`, Kontext `CHRONIK.md`.
Quelle: `reference/v301/src` (nur Tag v3.0.1), gelesen. Eigene Rechner (nur Scratchpad, nichts im Projekt ausgefuehrt ausser Node-Skripten dort):
`...\scratchpad\audit2c\cas2.mjs` (Marktsim der 2a-Pruefer, andere Seeds, anderes Startgeld) und `...\scratchpad\audit2c\seed.mjs`
(Roulette-Seed-Erkennung mit der exakten Spiellogik inkl. Haus-Neuwurf). Kein Browser, kein Netz, nichts aus `tools/`, `src/`, `sync/`.

Kurzurteil: Das Casino fuer BN8 **haelt** und ist der einzige Hebel mit geeichter Stundenwirkung. Die Zahlen fuer Boerse/Infiltration/Grafting
in V2 haengen alle an einer ungeeichten Umrechnung "Geld -> Rang-Stunden" und sind um Faktor 3-5 zu hoch, wenn man sie addiert.

---

## Winkel 1 - Widerspruch Boerse in V2 (2a: 26/80/325 gegen 2b: 0/6/17)

**Befund.** Beide Zahlen sind Summen ueber alle V2-Knoten, aber keine ist eine Messung, und 2b ist nicht aus eigener Rechnung entstanden.
- 2a (Abschnitt 8, `hours.mjs`): Summe ueber 11 Knoten x 3 Stufen = 880 Online-h, g-Werte nach Knotenklasse als "Urteil".
- 2b: Die Zahl steht nur in `2b-sf-modell.json` unter `nutzen_boerse_in_V2_gesamt` {0, 6, 17} mit dem Hinweis "BOERSE-1: 100 Mrd 17,5 h frueher in BN2".
  Das **17 ist der alte, von 2a selbst verworfene BN2-Einzelwert (-17,5 h)**, als Summe ueber alle V2 umetikettiert. In der Kurzfassung (Punkt 2) steht dieselbe
  Zahl unter der Ueberschrift "eff. Stunden je V2-Lauf" - Gesamt oder je Lauf ist also in 2b selbst widerspruechlich. Bei "je Lauf" waere es x33 = 200 h.
- Einheit: 2a rechnet Online-h, 2b effektive V2-h (online + 0,5 x offline; Summe der 26 Laeufe = rund 966 eff. h, `Tabelle M`). Beide Berichte sind nicht direkt vergleichbar.

**Was haelt.** Die Geldseite: Ich habe `cas2.mjs` mit anderen Seeds (901-916) laufen lassen; sie reproduziert 2a (Abschnitt 2) - der Markt-Code ist das Original, gegen vier reale BN8-Zyklen geeicht.
**Was nicht haelt.** Die Umrechnung in Stunden. 2a rechnet auch fuer Knoten, die es selbst als "nicht geldbegrenzt" einstuft, positive Boersen-Stunden (BN15 3,6; BN2 2,6; BN10 7,4; BN4 7,8),
weil jede Klasse eine Elastizitaet > 0 bekommt. Das ist ein Widerspruch zu 2a Abschnitt 2 ("NICHT in BN2 und BN15 Engpass").

**Urteil: 2a-Zahl FALSCH (zu hoch, ca. Faktor 3-5), 2b-Zahl FALSCH (falsches Etikett, 17 ist ein Altwert); keine der beiden haelt.**
Eigene Spanne siehe Winkel 2 (Boerse in V2, alle Knoten, Online-h: **0 / 15 / 80**, nicht additiv zu Casino und Infiltration).

---

## Winkel 2 - Umrechnung Geld -> Rang-Stunden; ist Geld in V2 der Engpass?

**Befund.**
1. 2a: Stunden = (1 - 1/g) x (T - t0). g (Faktor der Rangrate nach dem Anlauf) ist laut 2a "Urteil, keine Messung" (Klassen S/M/R, 1,05-2,5).
   Die Formel unterstellt, dass jeder Geldzuwachs die **gesamte** Rangrate hebt. In einem Bladeburner-Knoten ist das nicht begruendet: Rang entsteht aus Aktionen/Stunde x Erfolgschance
   (Vorphase) bzw. Black-Op-Zeit (Endphase); Geld wirkt nur ueber Augs, Grafts, Simulacrum, home-RAM.
2. 2b: Zeitverschiebung ln(f)/g mit g = 0,05-0,20/h, Faktor-4-Spanne, ebenfalls ungeeicht.
3. **BN15 liest sich in 2a und 2b gegensaetzlich.** 2a: Online-Zeit 35,5 / 36,0 / 34,0 h trotz Graft x69 und Go -> kein Effekt. 2b: effektive Zeit 68 / 39 / 34 h -> Halbierung.
   Der Unterschied ist allein die Gutschrift der 65 Offline-Stunden in BN15.1 (50 % ungeeicht, Streuung 0-100 %). Eine Gleichung, zwei Unbekannte (Offline-Gutschrift c und Graft-Effekt):
   Bei c = 0 hat Graft nichts gebracht, bei c = 0,55 gleicht es die Halbierung aus. Das Gegenindiz **entscheidet nichts**, es beweist weder 2a noch 2b.
   Zusatz aus 2b selbst: Rang 10.000 erreichten 15.2 und 15.3 in 31,8 und 21,9 Online-h, 15.1 (ohne Graft/Go) in 14,3 h - in Online-Stunden war die Vorphase mit Graft **langsamer**.
4. Was Geld in V2 konkret kauft (aus 2a/2b, am Quelltext geprueft): Augs (x AugGeld), Grafts (baseCost x 3, ohne Knotenfaktor), home-RAM, Hospital-Rest, Spenden (Favor-Schwelle 150).
   Bladeburner-Skills kosten SP, nicht Geld. Ob eine Geldbindung vorliegt, zeigt der Kontostand am Stufenende (0,1-3 Mrd) **nicht** - ein Bot, der alles ausgibt, hat immer ein leeres Konto.
   Messbar bindet Geld nur dort, wo die Einnahmen kleiner sind als der Graftplan (80 Mrd erste acht, 415 Mrd voll): BN3, 6, 11, 13, 14 (0,35-1,9 Mrd/h gegen Stufen von 15-45 Online-h = 10-40 Mrd je Stufe).
   In BN7/9/4/2/15/10 (Einnahmen 2-78 Mrd/h) bindet es nach den eigenen Daten kaum.

**Eigene Spanne (Urteil, UNGEEICHT).** Geld loest sich in Stunden nur ueber die Grafts auf. Rechnet man das Graftmodell von 2b (kurz 2/4/6, lang 8/15/25 je Lauf) fuer die fuenf geldarmen Knoten
(BN3 3, BN6 2, BN11 3, BN14 3 = 11 kurze, BN13 3 lange Laeufe): 48 / 91 / 147 eff. h, davon haengt ohne Boerse/Casino etwa ein Viertel nicht am Geld (die ersten ~2-3 billigen Grafts), also 36 / 68 / 110.
Mit dem BN15-Gegenindiz als 50-%-Abschlag (Graft-Wirkung selbst unbelegt): **alle drei Geldquellen zusammen (Casino + Boerse + Infiltration-Geld) in allen V2: 0 / 35 / 110 Online-h.**
Das ist ein **Deckel fuer die Summe**, nicht je Mechanik: Ist das Geldproblem einmal geloest, sind die anderen Quellen wertlos. 2a addiert "alle drei" auf 65 / 147 / 459, das ist in Mitte und hoch jeweils rund Faktor 4 zu viel.
Verteilung der Mitte: Boerse ~15 (kein UI-Risiko, geeichte Geldseite), Casino ~8 (V2: 10 Mrd je Einbau als Startkapital und TIX-Bruecke), Infiltration-Geld ~12 und Infiltration-Ruf separat (Winkel 5).

**Urteil: g-Werte UNSICHER bis FALSCH (nicht geeicht, Gegenindiz nicht entscheidend); 2a-Summe FALSCH (Faktor ca. 4); eigene Spanne 0 / 35 / 110 UNGEEICHT.**
Wichtig fuer den Bauplan: Die Ersparnis ist nicht ueber Ablation zwischen Laeufen messbar (2b: Rauschboden ~3 h, CV 5-39 %, jede Wirkung < 5 h unsichtbar).
Messbar ist nur eine **Ereignisstudie innerhalb eines Laufs** (Rang-/Chancenrate in den 3 h vor und nach dem Graft- bzw. Augkauf, Chance der naechsten Black Op als Zwischengroesse).

---

## Winkel 3 - Grafting rueckblickend 220 h (120-360)

**Nachgerechnet.** Die Zahl ist keine Rechnung: in `audit2b/mech.js` steht sie als Konstante `{laeufe:25, lo:120, mid:220, hi:360}`.
Rekonstruktion aus den Je-Lauf-Werten von 2b (kurz BN2/3/6/11/14, lang BN4/7/9/13/15), Laeufe 04.09.-07.11. aus Tabelle M:
kurz 3+3+2+3+3 = 14 Laeufe, lang 2+3+3+3+1 = 12 Laeufe (26, nicht 25): 14 x (2/4/6) + 12 x (8/15/25) = **124 / 236 / 384**. Die 220 ist also eine reine Multiplikation der geschaetzten Je-Lauf-Mitte,
ohne Knotenzeit-Eichung. Relativ zu den rund 966 eff. h dieser 26 Laeufe: 12 % / 24 % / 40 % - ein Viertel der ganzen V2-Laufzeit durch ein einziges Gewerk.

**Probleme.**
1. Keine Eichung der Knotenzeit (2b gibt das selbst zu); einzige Messung ist BN15.1->.3 und konfundiert (Winkel 2 Punkt 3).
2. **Doppelzaehlung/Ueberschneidung mit den SF-Effekten.** SF1/6/7/14, Go, NFG, Int wirken (2b D6) auf dieselbe Chance-Vorphase. Der Graft hebt die Chance der ersten Black Op von 4,3 % auf 98,7 % in 4 h;
   sobald die Chance gesaettigt ist, sind die Chancenfaktoren der SF in diesem Lauf wertlos. Die SF-Mitten (SF1.1 1,4 + SF6 0,7 + SF7 0,8 + SF14 2,0 + ... ~5 h je Lauf, auf 26 Laeufe ~130 h)
   duerfen daher in Laeufen mit fruehem Graft nicht noch einmal gezaehlt werden. In der Rangliste sind SF6/SF7/SF14 unter "Graft aktiv" bei ~0 zu setzen.
3. Einheitenmix: Graft in eff. V2-h, 2a in Online-h.
4. Geld: Der Graftplan (415 Mrd) ist in 5 der 11 V2-Knoten nicht bezahlbar (2a Abschnitt 2), also gilt die 220 nur, wenn die Geldfrage mitgeloest wird - der Wert kann nicht zugleich dem Graft und der Boerse gutgeschrieben werden.
5. Der Graft blockiert den Spieler (Fokusarbeit 10 h fuer die ersten acht), ausser SF7.3 (Simulacrum). In Knoten mit Stufen von 15-24 h ist das 40-60 % der Stufe.

**Urteil: Rechnung 220 UNSICHER (Multiplikation, ungeeicht; Mitte nach unten ziehen, 0 / 110 / 360 als Spanne mit 50-%-Abschlag fuer die Unbelegtheit). Prioritaet fuer Lauf 2: HAELT, aber aus anderem Grund:**
Das Gewerk ist gebaut (`graftauto.js`), die Chancenkette ist geeicht (98-99 % gegen Spielwerte, Chance 5e-5), der einzige Hebel, der die Chance-Vorphase direkt angreift. Es braucht SF10.1 (BN10 ist der teuerste Knoten, ~186 Online-h).
Die Prioritaet gilt also fuer die **Messung** (erste V2-Laeufe nach SF10.1: Ereignisstudie), nicht fuer weiteren Bau.

---

## Winkel 4 - Casino BN8 "11,8 h je Stufe" (wird JETZT gebaut)

**Mechanik gegen Quelltext (alles gelesen, nichts angenommen).**
| Behauptung 2a | Beleg | Urteil |
|---|---|---|
| Gewinn wird mit `gainMoney(n,"casino")` gebucht, ohne Knotenfaktor | `Casino/Game.ts:9-14`; `gainMoney` -> `recordMoneySource` (`PlayerObjectGeneralMethods.ts:216-223`) | HAELT |
| Sperre `Player.getCasinoWinnings() > 10e9` | `Game.ts:5,13-14`; `getCasinoWinnings` = `moneySourceA.casino` (`...:599-600`) | HAELT. **Netto**: Verluste buchen mit negativem Vorzeichen (`win(-investment)`), die Summe zaehlt Gewinn minus Verlust |
| `moneySourceA` leert sich bei jedem Einbau | `prestigeAugmentation` ruft `moneySourceA.reset()` (Zeile 128); `prestigeSourceFile` ruft `prestigeAugmentation` auf | HAELT; 10,0-10,4 Mrd je Einbau, nicht je Knoten. Das `casino`-Feld ist in `MoneySourceTracker` vorhanden |
| Einsatz max 1e7, Einzelzahl zahlt 36x, Haus wuerfelt Spielergewinn in 10 % der Faelle neu | `Roulette.tsx:11-12,100-107,149-154` | HAELT (Gewinn = Einsatz x 36 netto, `gain = investment * payout`, kein Einsatz-Rueckfluss) |
| Seed = `(ms/1000) % 30000` beim Einhaengen der Komponente | `RNG.ts:45-51`, `Roulette.tsx:105` (`useState(new WHRNG(new Date().getTime()))`) | HAELT; Seed ist eine Kommazahl (ms/1000), Nachbau muss in JS-Fliesskommaarithmetik laufen |
| 1,6 s je Spin | `Roulette.tsx:176` (`setTimeout(..., 1600)`) | HAELT |
| Klick-Schutz `trusted()` | `Casino/utils.ts` prueft `event.isTrusted` | Umgehung ueber React-Props-onClick mit `{isTrusted:true}` (Trick aus `src/join.js`) - **im Spiel fuer Roulette noch nie probiert** |

**Seed-Vorhersage (meine Pruefung, `seed.mjs`).** Der Bot braucht die Mount-Zeit nicht zu kennen. Er spielt 4-6 Sonden (Einsatz klein, Einzelzahl), liest die angezeigte Zahl und
streicht aus der Kandidatenliste alle ms-Seeds, die sie nicht erzeugen. Je Zahl fallen 5,2 Bit weg (log2 37), das Fenster +-3 s (6.001 Kandidaten) ist nach 4 Sonden eindeutig, der ganze Raum (3e7 ms-Werte) nach 6 -
in JS in unter 2 s durchsuchbar. Der Haus-Neuwurf stoert nicht: der Nachbau zieht bis zur ersten Zahl ungleich der Wette und trifft exakt (Gruppe der Zahlen vor ihr sind alle gleich der Wette).
Simulation (300 Laeufe je Zeile, exakte Spiellogik, Neuwurf mit Math.random, Startgeld 3e8):

| Fenster | Sonden | Seed eindeutig + 10 Mrd erreicht | Spins Median / P90 |
|---|---|---|---|
| +-300 ms | 6 | 300 / 300 | 37 / 40 |
| +-3000 ms | 6 | 300 / 300 | 37 / 40 |
| +-3000 ms | 5 | 300 / 300 | 36 / 39 |
| +-3000 ms | 4 | 300 / 300 | 35 / 37 |
| +-3000 ms | 3 | 40 / 300 (260 nicht eindeutig) | - |

Fazit: Mindestens 4 Sonden, besser 6. **Spinzahl 37 statt 32** (2a hatte die Sonden nicht), also rund 28 Gewinne + 3 Neuwuerfe + 6 Sonden, bei 1,6 s plus UI-Latenz etwa 80-100 s je Einbau. Auszahlung 10,05-10,36 Mrd.
(2a nannte "9 % der Laeufe zerfielen" - das ist ein Artefakt des Modells: Startgeld 1e6 und Einsatz min(1e7, Geld); mit den 0,25 Mrd nach dem Einbau tritt das nicht auf.)

**Zeitgewinn gegen den Boersen-Exponentialverlauf (meine Wiederholung `cas2.mjs`, 16 Seeds, andere als 2a, Startgeld 10,61 gegen 0,25 Mrd, Median [P10-P90], Online-h bis Schwelle).**
| Runde | Schwelle | ohne | mit Casino | Gewinn | 2a |
|---|---|---|---|---|---|
| R1 (4S bei 45 Mrd) | 300 Mrd | 11,7 [9,8-12,7] | 6,0 [4,9-6,8] | 5,7 h | 5,5 h |
| R2 (4S da) | 1 Bio | 9,3 [8,6-10,1] | 5,5 [4,7-6,2] | 3,8 h | 3,1 h |
| R3 (4S da) | 2,3 Bio | 10,9 [9,7-11,4] | 7,0 [6,2-7,9] | 3,9 h | 3,2 h |
Summe 13,4 h je Stufe (2a 11,8 h). Verdopplungen: log2(10,6/0,25) = 5,4; mit Verdopplungszeit ~1,0 h ohne 4S und 0,7 h mit 4S ergibt das 5,4 h bzw. 3,8 h - die Rechnung ist ohne das Simulationsmodell nachvollziehbar.
Die Luecke komprimiert sich bis 2,3 Bio nicht (3,8 h bei 1 Bio, 3,9 h bei 2,3 Bio), weil `maxShares` und der Kursdruck im Original-Marktcode drinstecken.

**Verbleibende Annahmen (alle am Bot, nicht an der Rechnung).**
- Floor: Hacking 2500 nach 4,6 h (R3) und Hacking 3000 (0,2-0,8 h) laufen parallel; R3 mit Casino endet bei 7,0 h, also weiter geldbegrenzt - die Untergrenze 8 h je Stufe in 2a ist eine eigene Schaetzung.
- R1 und R2 sind rein geldbegrenzt (BN8-ROUTE: 9,5/9,4/9,3 h), der Gewinn also tatsaechlich Wanduhr/Online-Zeit der Stufe.
- Gewinn fuer **Lauf 1**: nur die noch nicht begonnenen Runden (BN8.1 ist durch, BN8.2 laeuft). Die "24-36 h" in 2a Abschnitt 8 gelten fuer Lauf 2 mit drei vollen Stufen, nicht fuer die Rest-Stufen jetzt: BN8.2 (ab laufender Runde) + BN8.3 = realistisch 15-22 h.
- Online-Pflicht: 1,6-s-`setTimeout` in einem verdeckten Browser-Tab wird gedrosselt (nach 5 Minuten bis 1 Auslosung je Minute moeglich); das Casino laeuft nur im sichtbaren Tab/online - vor dem Bau messen, wie lange 37 Spins im Hintergrund brauchen.
- Der Dialog "Alright cheater" ist modal: nach dem Limit muss er geschlossen werden, sonst blockiert er die Oberflaeche fuer die Navigation.
- Betriebsgeld: das 10,4-Mrd-Startkapital braucht die TIX-Freischaltung; in BN8 mit SF8 gratis, sonst 5 Mrd (Bruecke).
- Handelsregel: auf 0,25 Mrd Start abgestimmt, 50 % je Titel bei 10 Mrd Kapital; die Sim enthaelt Kursdruck und `maxShares`, aber das Verhalten des Bots bei der ersten Bestellung grosser Positionen ist ungetestet.

**Urteil: HAELT.** Korrigierte Zahl: **11-13 h je Stufe** (mein Median 13,4, 2a 11,8; P10-P90 je Runde +-1 h), Eichung: Marktseite geeicht, Mechanik am Quelltext, Spiellauf nie probiert.
Fuer den Bau: 6 Sonden, nicht auf die Taktzeit des Mounts verlassen, Fenster +-3000 ms, Neuwurf-Synchronisation per "ziehen bis zur ersten Zahl ungleich Wette", Einsatz zuerst 1e7 nur wenn Geld >= 1e7, nach dem Limit Dialog schliessen,
jeder Einbau neu. Test im Spiel: erste Probe mit 6 Sonden und 3 Gewinnspins, Abbruch, dann voller Lauf.

---

## Winkel 5 - Infiltration 44 / 110 / 410 h

**Befund (ausser dem, was 2a schon erkannt hat).**
1. **Geld und Ruf sind Alternativen je Lauf, nicht gleichzeitig.** `Victory.tsx:75-82,121-134`: "Sell" -> `gainMoney(moneyGain,"infiltration")`, "Trade" -> `Factions[f].playerReputation += repGain`; je Sieg nur eines (plus extra SoA-Ruf nur bei Mitgliedschaft).
   2a und die Rangliste schreiben "14-44 Mrd/h und 280-1.300 k Ruf/h" nebeneinander und rechnen den Nutzen aus beidem; die Summe der beiden Nutzen ist nicht erreichbar. Ruf braucht ausserdem eine Fraktion mit `offersWork()` (Dropdown).
2. Formeln stimmen: ich habe BN13.2 h12 (Omnia, Sec 6,0, L22, Summe 1.692, Reward-Deckel 3) nachgerechnet: 2,3e8 $/Lauf, 6,8k Ruf/Lauf, Laufzeit 6 + 1,73 x 22 = 44 s, Nachfrage ~0,8 -> 18,8 Mrd/h und 556 k Ruf/h; 2a: 17,6 Mrd und 526 k. **HAELT** (Quelltext gegen Quelltext).
3. Die Laufzeit je Ebene 1,73 s ist plausibel und ableitbar: jede Ebene durchlaeuft einen `CountdownModel` 3 x 300 ms (0,9 s, `CountdownModel.ts:8-14`, `Infiltration.ts:130-136`), dazu Slash (Warten 1,5-4,75 s), Minesweeper (2 s Merkphase, `MinesweeperModel.ts:102`),
   die uebrigen sieben Spiele sofort loesbar. Mittel ~0,9 + 0,8 = 1,7 s. Das ist ein **Mindestwert bei perfektem Bot**; Bot-Latenz, Hospital und Fehlversuche kommen oben drauf (2a: x1,5 -> Geld/h x0,7-0,8).
4. **Nachfrage:** 2a unterstellt "Gleichgewicht ~2/3". Ich habe das fuer Carmichael-Groesse (L15, Periode 32 s) nachgerechnet: Nachfrage vor dem Sieg 0,72; fuer NWO (L50, 92 s) 0,91. Haelt.
5. **BN8:** InfilGeld 0, Ruf voll. In BN8 gibt es kein Kampftraining (Summe Kampf+Cha niedrig, vermutlich < 300): erreichbar sind nur Orte mit Sec <= ~3,6 (Noodle Bar, JoesGuns, NetLink, Omega, Alpha, CompuTek). Dort liefert ein Lauf bei L10 ~2,4k Ruf je 23 s,
   nach Nachfrage ~265 k Ruf/h; 2,5 Mio Ruf (Red Pill) brauchen dann ~9-10 h, nicht 5-6 h (2a). Gegenwert 2,5 Mio Ruf = 1,9 Bio $ = bei Casino-Start 7 h Boerse. **Infiltration in BN8 bringt nichts mehr, sobald das Casino laeuft.**
6. **Unausgesprochene Hauptluecke:** Die 44/110/410 h erben die g-Unsicherheit aus Winkel 2 (alle Geld/Ruf -> Rang-Stunden). Die eigentlichen Unbekannten sind weniger "wie viele Mrd/h" (Formel steht), sondern "kauft Ruf oder Geld in V2 Stunden".
   Ruf ist in V2 der Kandidat fuer echte Bindung (Aug-Freischaltung, Faktionsarbeit in V2 gesperrt, 500 k+ Ruf/h gegen 8-12 k aus Firmenarbeit), und zwar unabhaengig vom Geld.
7. Risiken am Bau: jede synthetische Tastatur -> `onFailure({automated:true})` toetet den Spieler (`InfiltrationRoot.tsx:73-77`), also nur ueber `state.stage.onKey(...)` per React-Props; Seitenwechsel bricht ab (`:63-67`); Tod beim Start ab Schwierigkeit 3,5 (`Infiltration.ts:95-103`).

**Urteil: Formeln HAELT; Stunden 44/110/410 UNSICHER, nach Anpassung (Geld XOR Ruf, Deckel mit Geldquellen gemeinsam): 0 / 25 / 150 Online-h fuer alle V2, davon Ruf-Anteil UNGEEICHT.**
Reihung: kostet L (acht Minispiele, Fiber-Zugriff, Eric-Entscheidung zu §12), wirkt nur, wenn Ruf oder Geld in V2 wirklich bindet - darum **nach** der Boerse.

### Messprotokoll Infiltration (Lauf 2)
Ziel: die Entscheidung "bauen/nicht bauen" und "Geld oder Ruf" faellt aus drei Zahlen, nicht aus der Formel.
- **Knoten/Zeitpunkt.** Ein V2-Knoten mit InfilGeld = InfilRuf = 1 und geldarm (BN13 oder BN3), nicht BN11 (x2,5 verfaelscht) und nicht BN2 (x3 Geld). Frueh in einer Stufe (nach Kampfwert-Aufbau, Summe Kampf+cha >= 900), Bladeburner laeuft normal.
- **Ort.** Zwei Orte: A mit Startschwierigkeit 1,5-2,5 (z. B. Carmichael bei Summe ~800), B bester erreichbarer Ort (Differenz 2,5-3,0, z. B. Omnia/VitaLife). Nie ueber 3,0 beim ersten Mal.
- **Umfang.** 12 volle Laeufe je Ort (24 Laeufe, ~15-30 Minuten), davon je 6 "Sell", 6 "Trade" (Trade an eine Faktion mit Arbeit).
- **Je Ebene protokollieren:** Minispiel-Nr, Dauer vom `onSuccess` zum naechsten `onSuccess` (ms), Ergebnis (+/-), HP-Verlust.
- **Je Lauf:** Wanduhr Start-Klick bis Victory-Klick, ausgezahlter Betrag ($ oder Ruf), `InfiltrationState.floors` und `calculateMarketDemandMultiplier` zum Auszahlzeitpunkt, HP vor/nach, Fehlebenen.
- **Wirkung auf Bladeburner:** Rang/h und Aktionen/h in den 30 Minuten vor, waehrend, nach den Laeufen (Kontrolle). Bricht eine laufende Bladeburner-Aktion ab (Stamina, `Bladeburner.ts:1353-1366`)?
- **Schwellen (Bau erst, wenn alle erfuellt):**
  1. mittlere Zeit je Ebene <= 3,0 s (Modell 1,7; 3,0 entspricht Geld/h x0,55 des Modells) **und** Fehlerquote <= 3 % der Ebenen **und** kein Krankenhaus in 24 Laeufen;
  2. gemessene Auszahlung je Lauf innerhalb +-10 % der Formel (sonst Formel/Modell falsch: dann Abbruch);
  3. Bladeburner-Rang/h waehrend der Infiltration >= 90 % der Kontrolle.
- **Entscheidung Geld oder Ruf** faellt nicht hier, sondern aus der Ereignisstudie (Winkel 2): Wenn der naechste Aug-Kauf in V2 am Ruf haengt (Ruf < Bedarf, Geld da), "Trade"; haengt er am Geld, "Sell"; haengt er an keinem, Infiltration verwerfen.
- **Abbruch sofort**, wenn Auszahlung < 50 % der Formel oder Bladeburner-Rang/h < 70 %.

---

## Winkel 6 - SF-Wirkungen (Stichprobe gegen Quelltext)

Alle Abfragen von `sourceFileLvl`/`activeSourceFileLvl`/`canAccessBitNodeFeature` im Spielquelltext durchgegangen (ca. 40 Fundstellen ausserhalb von UI, Achievements, DevMenu).

| SF | Quelle | Pruefung gegen 2b |
|---|---|---|
| SF1 | `applySourceFile.ts:15-48` (16/24/28 %, alle 26 Mults; `Prestige.ts:246-250` 32 GB) | HAELT; auffaellig: SF1 hebt **nicht** `bladeburner_*`, nur Kampfstufen/Exp und faction_rep - Wirkung in V2 ueber die Stufen |
| SF2 | `applySourceFile.ts:50-62`, `PlayerObjectGangMethods.ts:19-27` (Karma) | HAELT |
| SF3 | `applySourceFile.ts:63-75`, `PlayerObjectCorporationMethods.ts:21` | HAELT (Stufe 3 = volle API) |
| SF4 | `RamCostGenerator.ts:82-97` (x16/x4/x1), `NetscriptHelpers.tsx:389` (ohne SF4 oder BN4 gar keine Singularity-API) | HAELT; 2b nennt die RAM-Schwelle, die "kein Zugriff ohne SF4" gehoert als eigener Punkt in die Rangliste der **Voraussetzungen** |
| SF5 | `applySourceFile.ts:77-93`, `Person.ts:154,185`, `Prestige.ts:93,277,363` | HAELT (Int null ohne SF5/BN5, 300 Int-Exp je Knotenstart) |
| SF6 | `applySourceFile.ts:95-114` (Kampf-Level/-Exp, nicht BB); `NetscriptFunctions/Bladeburner.ts:35` und `PlayerObjectBladeburnerMethods.ts:7` geben BB-Zugang auch mit **SF6** | HAELT; Ergaenzung: SF6 *oder* SF7 gibt den Bladeburner-API-Zugang - fuer Lauf 2 relevant, wenn BN6/BN7 vor dem Rest gefahren werden |
| SF7 | `applySourceFile.ts:116-129`, `PlayerObjectBladeburnerMethods.ts:14-19` (Simulacrum bei Stufe 3) | HAELT |
| SF8 | `applySourceFile.ts:131-143` (nur `hacking_grow`), `Prestige.ts:164,305` (WSE+TIX gratis bei Einbau und Knotenstart), `NetscriptFunctions/StockMarket.ts:151-205` (SF8 > 1: Shorts, > 2: Orders) | HAELT |
| SF9 | `Prestige.ts:245-251` (128 GB ab Stufe 2), `:337-348` (Gratis-Hacknet-Server ab Stufe 3 oder in BN9) | HAELT |
| SF10 | `SleeveCovenantPurchases.tsx:58-73`, `PlayerObjectGeneralMethods.ts:577-579` (Graft-API) | HAELT |
| SF11 | `AugmentationHelpers.ts:29-31` (1,9 x [1, 0,96, 0,94, 0,93]), `Work/Formulas.ts:132` (Firmenruf) | HAELT |
| SF12 | `Prestige.ts:264-271` (NFG-Stufen) | HAELT |
| SF13 | `StaneksGift.ts:23` (+Stufe Zellen) | HAELT |
| SF14 | `Go/effects/effect.ts:18,31`, `netscriptGoImplementation.ts:488-489,564` (Cheat ab SF14 >= 2, +25 % nur Stufe 3) | HAELT |
| SF15 | `Work/Formulas.ts:133`, `effects.ts:80` (**`> 2`**, also Stufe 3, nicht 2), `cacheFiles.ts:91`, `reputation.ts:55` | 2b Tabelle A Zeile 15: "Auth -20 %" steht bei Stufe 2, der Code gibt es erst bei Stufe 3 (Beiwerk, wirkungslos fuer den Bau) |

**Gefundene Luecken (alle ohne Folge fuer die Rangliste):**
- `CodingContract/ContractGenerator.ts:83`: Vertragsschwierigkeit `maxDif = 2 x Summe aller SF-Stufen + 1` - am Anfang von Lauf 2 (Summe klein) nur leichte Vertragstypen; 2a "Coding Contracts nichts zu tun" gilt am Ende, nicht am Anfang.
- `Go/boardAnalysis/goAI.ts:886`: Red Pill + SF1 schaltet eine Go-Gegnerbedingung (w0r1d_d43m0n) - bei 2b nur als "ungeprueft" erwaehnt.
- `Faction/FactionHelpers.tsx:185` nutzt BN-Stufe als RNG-Seed (Faktionsentdeckung), irrelevant.

**Urteil: HAELT.** "SF1 groesster belegter Folgenutzen, SF2/3/13/15 praktisch keiner" stimmt am Quelltext (SF2: Gang, SF3: Corp-Zugang, SF13: Stanek, SF15: Darknet; alles verworfene Gewerke). Zwei kleine Korrekturen (SF15 Auth-Stufe, SF6 gibt BB-API-Zugang). Die Folgenutzen in Stunden sind wie in 2b selbst vermerkt nicht trennbar (Rauschboden ~3 h) - das ist ein Messproblem, kein Quellcodefehler.
Wichtigste inhaltliche Folge: **Mults und Preise sind geeicht, Stunden nicht** - SF1/6/7/14-Werte in Stunden bleiben UNGEEICHT und ueberschneiden sich mit dem Graft (Winkel 3).

---

## Bereinigte Rangliste der Hebel fuer Lauf 2

Uhr: Online-Stunden, soweit nicht anders vermerkt. "Eichstatus": geeicht = gegen Original-Code oder echte Staende nachgerechnet; Urteil = Annahme.
Mechaniken, die dasselbe Problem (Geld/Ruf bindet?) loesen, sind **nicht additiv**; die Spannen sind je Mechanik, die Summe der drei Geldquellen steht unter Nr. 2.

| Rang | Mechanik | Stunden-Spanne (lo / Mitte / hi) | Eichstatus | Empfehlung |
|---|---|---|---|---|
| 1 | **Casino in BN8** (3 Stufen Lauf 2: 3 x 3 Runden; Lauf 1: Reststufen) | je Stufe 11 / 12,5 / 13,5; Lauf 2 gesamt 33 / 37 / 40; Lauf 1 Rest ~15-22 | Markt geeicht (4 reale Zyklen +-10 %), Mechanik am Quelltext, Seed-Erkennung simuliert; Spiellauf nie probiert | **bauen jetzt**, 6 Sonden, Probelauf mit 3 Spins |
| 2 | Geldquellen Casino + Boerse + Infiltration-Geld in V2 **zusammen** (nicht je einzeln) | 0 / 35 / 110 (2a addiert 65 / 147 / 459) | Geldseite geeicht (Boerse), Stundenumrechnung ungeeicht | nur als **ein** Gewerk planen; Boerse zuerst (M), Casino als TIX-Bruecke (S), Infiltration zuletzt |
| 2a | - Boerse in V2 (alle Knoten) | 0 / 15 / 80 | s. o. | bauen nach dem Casino; geldarme Knoten BN13/BN11/BN3/BN6/BN14 zuerst, mit Messung innerhalb des Laufs |
| 2b | - Casino in V2 (10 Mrd je Einbau) | 0 / 8 / 40 | Mechanik wie Rang 1 | kostet nach BN8 nichts mehr; als Startkapital nutzen |
| 2c | - Infiltration (Geld) | 0 / 12 / 60 | Formel geeicht, Spiel nicht | erst nach Messprotokoll |
| 3 | Grafting (Zuender) in V2 | 0 / 110 / 360 (2b: 120 / 220 / 360) | Preis/Zeit/Chance geeicht, Knotenzeit nicht | gebaut; **messen** (Ereignisstudie), SF10.1 frueh; mit SF1/6/7/14 nicht doppelt zaehlen |
| 4 | Infiltration (Ruf, nicht Geld) | 0 / 25 / 150 (nur falls Ruf bindet, UNGEEICHT) | Formel geeicht, Spiel nicht | Messprotokoll, Eric-Entscheidung §12 |
| 5 | IPvGO (go.js in jedem Knoten) | 0,8 / 2 / 4,8 je Lauf ohne SF14 (2b) | Effekt 1e-6, Spielstaerke gemessen, Knotenzeit nein | gebaut, nicht anfassen; SF14 vor BN13/15 |
| 6 | SF1 (V2 je Lauf 0,7 / 1,4 / 2,7), SF6 (0,35 / 0,7 / 1,4), SF7 (0,4 / 0,8 / 1,5), SF14 (1,0 / 2,0 / 3,9) | zusammen **nicht additiv** (Deckel Vorphase); mit fruehem Graft ~0 | Mults geeicht, Stunden nicht | Reihenfolge nach Schwierigkeit, nicht nach diesen Stunden |
| 7 | Sleeves (1 / 2 / 3 je Lauf), Hash -> Rang (0,04-20), Int (0,3-1,5), NFG (0,14-0,55) | klein | Raten geeicht, Knotenzeit nicht | nicht anfassen |
| - | Gang ausserhalb BN2, Corp ausserhalb BN3, Hash -> Contracts, Firmenarbeit, Stanek | 0 | Prior + 2a/2b | nicht bauen (haelt) |

**Was faellt gegenueber 2a/2b:**
- 2a "Boerse 26 / 80 / 325" und "alle drei 65 / 147 / 459": faellt auf 0 / 35 / 110 (Summe) bzw. 0 / 15 / 80 (Boerse).
- 2b "Boerse 0 / 6 / 17": faellt (falsches Etikett, Altwert aus BN2).
- 2a "Infiltration 44 / 110 / 410": faellt auf 0 / 12 / 60 (Geld) und 0 / 25 / 150 (Ruf); beides ist "oder", nicht "und".
- 2b "Grafting 120 / 220 / 360": faellt auf 0 / 110 / 360, Prioritaet bleibt (gebaut, geeicht in der Chancenkette), aber als Messauftrag.
- 2a "Infiltration in BN8 1,5-5 h je Stufe": faellt auf 0 (Ruf-Rate ohne Kampfwerte zu klein, Casino loest das Geld).
- "SF1 groesster Folgenutzen": haelt (Mults geeicht), aber Stunden nicht von Rauschen trennbar.
- 2a "9 % der Casino-Laeufe zerfielen": Artefakt (Startgeld 1e6); real nicht.
- 2a "Spins 32": stimmt ohne Sonden, mit Sonden 37.
