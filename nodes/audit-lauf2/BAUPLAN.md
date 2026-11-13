# Teil 6 - Bauplan fuer Lauf 2 (zur Abnahme durch Eric)

Stand 13.11.2026. Synthese aus Teil 1-5 (`CHRONIK.md`, `MECHANIKEN.md`,
`REIHENFOLGE.md`, `GEWERKE.md`, `5a`/`5b`/`5c`). Jede Zeile hat einen
Skeptiker hinter sich. Bauzeitpunkt: nach BN8.3 (was `src/` beruehrt, geht
sofort ins laufende Spiel).

## 0. Die drei Saetze

1. **Die Route war richtig, die Gewerke tragen.** Belegte Bot-Fehler kosteten
   rund 33 h von 2.043; eine andere Knotenreihenfolge bringt nichts Messbares.
2. **Mechaniken lagen brach** (Boerse 82 Tage, Graft-Zuender 64 Tage,
   Infiltration nie) - das Casino fuer BN8 ist schon gebaut, der Rest wird in
   Lauf 2 erst gemessen, dann gebaut.
3. **Das eigentliche Risiko ist der Kaltstart:** Der heutige Bot startet aus
   einem frischen Spielstand nicht. Zwingend sind rund 2,5-3 Arbeitstage Bau.

## 1. Schon gebaut (13.11.2026)

| Was | Wirkung | Beleg |
|---|---|---|
| Casino-Roulette in BN8 (`casino.js`) | 11-13 h je BN8-Stufe | 10,05 Mrd in 51 s gemessen; Commit 13cea15 |
| `test-casino.js` in der Gesamtsuite | - | dc79410 |

## 2. Zwingend vor Lauf 2 (ca. 2,5-3 Arbeitstage)

| Nr | Posten | Warum | Aufwand |
|---|---|---|---|
| Z1 | **Lauf-2-Uebergabe der Bruecke**: einmaliges, von Hand ausgeloestes Skript mit `--pin <identifier>`, Lauf-1-Sicherungskette archivieren und pruefen, `data/` nach `lauf1/`, neuer Anker. Nie automatisch aus beobachtetem Zustand (ein Profilverlust sieht aus wie ein neues Spiel) | Die Bruecke weist ein neues Spiel heute ab (fester Identifier, Rueckwaertssprung-Schutz) | 1-1,5 d |
| X1 | ~~Exploit-Skripte archivieren~~ **entfaellt** (Eric 13.11.: "alles ist erlaubt bei Bitburner"). Stattdessen: `exploit*.js` und `hacktimer.js` pruefen, ob sie im frischen Stand gezielt und ohne Nebenwirkung laufen; Nutzen von SF -1 rechnen | Exploits sind erlaubt; offen ist nur ihr Wert | 1-2 h |
| K01 | Route-Anfang fuer Lauf 2: BN1.1, BN4.1-4.3 als V1 (Regel R1); Rest der Route vor Ende BN4.3 | `route.json` beginnt bei BN10.2, BN1.1 bekaeme Ziel BN10 | 2-3 h |
| K09 | SF4-Riegel in der Registry: Singularity-Gewerke starten ohne SF4 ausserhalb BN4 nicht | Sonst starten sie in BN1.1 und werfen | 2-3 h |
| Z6 | Startpfad bis 8 GB home: alten Autopiloten aus dem ersten Commit (7ebf2a4) wiederverwenden (RAM messen) oder eine Hand-Anleitung fuer BN1.1 (eine Seite); Kern erst ab 16/32 GB | Kern 10,8 + Waechter 6,1 + boot 5,5 GB passen nicht in 8 GB | 0,5 d |
| B10 | Skill-Ablage richtigstellen: `skills/bb.md` im Repo ist der Stand vom 31.08. und widerspricht dem aktiven `/bb` | Ein "hier aendern, dann kopieren" ueberschriebe den aktiven Skill | 20 min |

**BN1.1 laeuft halbautomatisch** (Claude-Sitzung begleitet, rund 3-4 h
Sitzungszeit), nicht vollautomatisch: der Vollautomat (K05) waere ein
Einmalposten von 6-11 Tagen, der nur einmal im Lauf gebraucht wird.
Ab BN4.1 traegt die Automatik.

## 3. Sinnvoll (vor oder waehrend der ersten Knoten, ca. 2-3 Arbeitstage)

| Nr | Posten | Aufwand |
|---|---|---|
| K10/B03 | Budgettest und Mock auf Lauf-2-Lagen (home 16/32, SF-Stand aus der Route) | S-M |
| K11 | Kleiner Kaltstartlauf im Dev-Build (frischer Stand, Uebergabe Z1, Startpfad); nie Dev-Build-Staende nach LIVE | 0,5 d |
| B07 | `checkin.js` zeigt "Einbau faellig/steht" und den Sperrgrund (nur Anzeige) | M |
| B01/B09 | Suite: Pflicht, dass jeder `test-*.js` eingetragen ist (12 von 106 fehlten); veraltete Messluecken bereinigen | S |
| B05 | Bruecke ueber die Neustartschleife `bridge-start.cmd` starten (sie stirbt weiter still) | S |
| B08 | Alarme in einer maschinengefuehrten Datei, Schutzalarme nur per Messung beenden; `## Sofort` einmal bereinigen | M |
| G50 | Kernkauf nur mit Ertragspruefung (`homegrow.js`) | S |
| G20 | Einbau in V1 nicht kurz vor eine Offline-Phase legen | S |

## 4. Messauftraege fuer Lauf 2 (laufen nebenher, entscheiden spaetere Bauten)

| Messung | Entscheidet | Wo |
|---|---|---|
| Ereignisstudie Geld in V2: Rangrate vor/nach einer Geldspritze | ob Boerse und Casino in Bladeburner-Knoten gebaut werden (0 / 35 / 110 h) | BN13 oder BN3 |
| Infiltration nach Messprotokoll (`2c`, Winkel 5) | ob Infiltration gebaut wird (Erics Entscheidung) | geldarmer V2-Knoten |
| Graft mit/ohne Simulacrum | BN7-Position (+20 bis -56 h) | BN10.1 |
| Einkommen in BN4.1 als V1 | ob ein schlanker Startlaeufer noetig ist | BN4.1 |
| `getBonusTime()` mitschreiben | belegt die volle V2-Offline-Gutschrift | erster V2-Lauf |
| Einbaufrist (G01), V1-Fruehphase (G21), BN3-Corp (G60), Sleeve-Vertraege (G40) | kleine Gewerk-Bauten | jeweiliger Knoten |

## 5. Regeln fuer die Route (Teil 3)

BN1.1 -> BN4.1 -> BN4.2/4.3 (V1); Stufen eines Knotens am Stueck; BN10 und BN9
nicht nach hinten; BN8 zuletzt; kein V1b-Labyrinth in BN15; kein V1 in
weiteren V2-Knoten; ab Platz ~12 Route 1 unveraendert.

## 6. Gestrichen

Vollautomat BN1.1 (K05, K06, K07), Vorab-Bau BN4.1 (K08), grosser
Kaltstart-Pruefstand (K11 gross), Waechter-Befristung von Sperren (B06),
Labyrinth, V1 in weiteren Knoten, Gang/Corp ausserhalb BN2/BN3, Stanek,
Einbaufrist kuerzen, Offline-Pflege in V2 (wird voll gutgeschrieben).

## 7. Frage an Eric (X2) - beantwortet 13.11.2026

**Antwort: "alles ist erlaubt bei Bitburner".** Der `document`-Umweg bleibt;
damit sind auch Exploits und die Infiltrations-Automatik erlaubt (das
Bauverbot aus AUFTRAG-BAU Z.346 ist aufgehoben). Infiltration wird trotzdem
erst gemessen - aus Wertgruenden. Unveraendert bleiben die Schutzregeln fuer
den Spielstand (kein zweiter Tab, b1tflum3/Destroy nicht von Hand, kein
Handsprung, keine Augs von Hand).

Die urspruengliche Frage:

Mehrere Werkzeuge (`guard.js`, `darkweb.js`, `popups.js`, `wakelock.js`, der
Kern) holen das Dokument ueber `globalThis` statt ueber den Bezeichner
`document` und sparen so dessen 25 GB RAM. Das loest im Spiel **keinen**
Exploit-Erfolg aus (der kommt nur ueber `ns.bypass`, Extra.ts:32), ist aber
genau das, was das Spiel als "circumventing the ram cost of document"
beschreibt. Ohne den Kniff laufen diese Werkzeuge in Lauf 2 auf gemieteten
32-GB-Rechnern statt auf home. Erlaubt oder nicht?

## 8. Memory und Skills (aus 5b, nach BN8.3)

Rund 7 von 29 Bitburner-Notizen sind veraltet (u. a. `bitburner`,
`bitburner-werkzeuge`, `bitburner-nachtlauf`, `bitburner-roadmap`), rund 9
gehoeren als Technikbefund ins Repo. Die Skills `bitburner` und `bb-loops`
beschreiben die Betriebsart vom August. Bereinigung als eigener Schritt nach
BN8.3, zusammen mit dem Lauf-2-Start-Skill (B04).
