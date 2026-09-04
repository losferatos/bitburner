# Skeptikerrunde 3 (04.09.2026, nachmittags) - Befundliste

Zwei Pruefer auf die Commits C.7 bis C.15. Der Substanz-Pruefer hat die 30
Vertragsloeser gegen den echten Annahmeweg des Spiels gefahren (6.000
Instanzen, 30 von 30 richtig) und den RAM-Nachbau Regel fuer Regel gegen
`RamCalculations.ts` geprueft - beides haelt vollstaendig. Was nicht haelt,
steht hier.

| Nr | Quelle | Schwere | Befund | Stand |
|----|--------|---------|--------|-------|
| C1 | Substanz 1 | BLOCKIEREND | `cdump.js` stirbt an einem BigInt, sobald ein Square-Root-Vertrag im Netz liegt (`JSON.stringify` auf `getData`). Weder cdump.json noch cantwort.json werden geschrieben - die Kaltstart-Geldkette ist dauerhaft tot. Der Ersetzer aus `contracts.js:101` ging beim Herausloesen der Loeser verloren | **BEHOBEN** |
| C2 | Substanz 2 | HOCH | `graftwahl.js` wartete auf 300 Bio. fuer Violet Congruity, bevor ueberhaupt gegraftet wird. Die Begruendung war falsch: `applyEntropy` rechnet ueber `reapplyAllAugmentations` jedes Mal neu, das Endergebnis ist reihenfolgeunabhaengig. Und der Rest des Plans kostet 0,42 Bio. | **BEHOBEN** |
| C3 | Substanz 3 | MITTEL | `graftplan.json` enthielt `LuminCloaking-V2` ohne V1. `getGraftableAugmentations` filtert Voraussetzungen NICHT, `graftAugmentation` gibt still `false` zurueck - Endlosschleife am Planende. Nach jedem Sprung sind alle Augmentierungen weg (`prestigeSourceFile`) | **BEHOBEN** |
| C4 | Substanz 4 | MITTEL | `verify` ist fuer 20 von 30 Loesertypen `solve(data) === answer`, also tautologisch. Die Autonomiebegruendung in `cdump.js` traegt nur fuer die anderen zehn | offen |
| C5 | Substanz 5 | KLEIN | `ram.js`: "`./lib/x.js` funktioniert im Spiel NICHT" ist falsch; `loeseModul` ignoriert das Basismodul (derzeit folgenlos, keine Datei nutzt `./`) | offen |
| C6 | Substanz 6 | KLEIN | `csolve.js` misst 12,85 GB, der eigene Kopfkommentar sagt 12,25 (es fehlt `ns.scp`). Damit passt es mit exakt 0,00 GB Reserve neben Kern, Waechter und Wachhalter | offen |
| C7 | Substanz 7a | WICHTIG | Der Kaltstart-Budgettest laesst `boot.js` (5,50 GB) aus der Belegung. In der ersten Kernrunde sind nur 7,35 GB frei, nicht 12,85 - `cdump.js` passt dort noch nicht | offen |
| B1 | Fehlermodi | BLOCKIEREND | `data/portknacker-komplett.txt` ueberlebt jeden Reset, die Portknacker nicht (`prestigeHomeComputer` leert `programs`). `darkweb.js` laeuft nach dem ersten vollstaendigen Satz in ALLEN ~40 Restlaeufen nie wieder - und es ist die einzige kaltstartfaehige Knackerquelle | offen |
| B2 | Fehlermodi | BLOCKIEREND | Der Figur-Lease betraegt 15 min, jeder Graft dauert 17 bis 90 min, und niemand erneuert ihn: `graft.js` beendet sich nach dem Start. Die Figur geht mitten im Graft an den naechsten Antragsteller. Dass noch kein Geld verbrannt ist, liegt an den handgepflegten Bremsen in vier Dateien - genau denen, die C.11 abloesen sollte | offen |
| W1 | Fehlermodi | WICHTIG | `sprosseFuer("S1")` liefert immer Sprosse 1; die Eskalation zaehlt `s.sprosse` hoch, findet aber keine passende mehr und landet nach 15 min Guard-Zeit in EXHAUSTED. Sprosse 2 feuert NIE - damit ist die ganze C.9-Maschinerie tot (Wirtsperren, `blocked-hosts.json`, der Ausweichzweig im Kern) | offen |
| W2 | Fehlermodi | WICHTIG | `wirkungGruen` prueft die EXISTENZ der Telemetriedatei, nicht ihre Frische. Gruen ist es also genau dann, wenn eskaliert werden muesste | offen |
| W3 | Fehlermodi | WICHTIG | `cdump.js` und `darkweb.js` werden in JEDER Kernrunde neu gestartet - 41 Starts in 41 Runden gemessen. Beide sind Einmallaeufer, aber `restartPolicy` hat keinen Leser. Jeder cdump-Neustart erschlaegt eine Arbeiterart auf home | offen |
| W4 | Fehlermodi | WICHTIG | Sechs Registry-Felder haben keinen Leser: `hostRule`, `scpToHome`, `restartPolicy`, `maxInstances`, `evictRank`, `needsFigure`. Folge u.a.: `cdump.js` schreibt `cantwort.json` ohne `scp` nach home - auf einem Ausweichwirt stirbt die Rotation lautlos | offen |
| W5 | Fehlermodi | WICHTIG | Der ns-Mock gibt jedem Skript pauschal 2,4 GB und bucht beim exec nichts ab. `test-kern-c789.js` prueft damit eine Welt, in der Speicher nichts kostet - der Zweig, um den es geht, ist kaum erreichbar | offen |
| W6 | Fehlermodi | WICHTIG | Kern und Waechter definieren "Phase" verschieden. Mit gekauftem Rechner und home auf 32 GB ueberwacht der Waechter ein Gewerk, das der Kern absichtlich nicht startet -> Fehlstrafe, und `false_penalty_count = 0` ist Abnahmebedingung | offen |
| W7 | Fehlermodi | WICHTIG | `csolve.js` schreibt keinen Herzschlag v2 (kein `state`, kein `playtime`). Die Skips fuer wait/done/blocked greifen nicht, S1 faellt bis zur Wanduhr durch | offen |
| W8 | Fehlermodi | WICHTIG | `graftauto.js` ist der einzige Geldausgeber, der `data/geldbedarf.txt` nicht abzieht - es kann das Geld fressen, das `bn4rep.js` fuer Augmentierungen zurueckgelegt hat | offen |
| W9 | Fehlermodi | WICHTIG | Ein toter Figur-Besitzer haelt die Figur 15 min. Und `ANTRAG_TTL_MS` (60 s) ist nicht groesser als der Takt der Antragsteller - im gedrosselten Tab sind ihre Antraege oefter abgelaufen als nicht | offen |
| W10 | Fehlermodi | WICHTIG | `data/guard-modus.txt` schreibt niemand; der Waechter faellt auf `observe` zurueck. Die ganze C.9/C.10-Maschine protokolliert nur. Der Commit-Betreff "die Strafleiter ist scharf" stimmt fuer den ausgelieferten Zustand nicht | offen |
| W11 | Fehlermodi | WICHTIG | `figwatch.js` (223 Zeilen, die dritte Schicht von C.11) ist an nichts angeschlossen - nicht in der Registry, nirgends gestartet. `figure_conflict` bleibt aus dem falschen Grund 0 | offen |
| K1 | Fehlermodi | KLEIN | `shop.js`: ein vom Spiel abgelehnter Kauf setzt weder `erledigt` noch `wartetAufGeld` -> `state: "work"`, das Gewerk beendet sich nie und haelt 7 GB | offen |
| K2 | Fehlermodi | KLEIN | `data/blocked-hosts.json` steht in keiner Raeumliste; ein neuer `werk-N` kann bis zu eine Stunde nach dem Sprung eine Sperre erben, die einem geloeschten Rechner galt | offen |
| K3 | Fehlermodi | KLEIN | `parkLage()` verwirft die Tabelle nur am `lastNodeReset`, aber `prestigeAugmentation` loescht die Mietrechner ebenfalls - 4 bis 5 min Geisterpark nach jedem Einbau | offen |
| K4 | Fehlermodi | KLEIN | `data/events.json` wird von drei Stellen per lesen-aendern-schreiben gefuehrt; gleichzeitige Runden verlieren Eintraege - und dort wohnen `graft_aborted` und `figure_conflict` | offen |
| K5 | Fehlermodi | KLEIN | `shop.js` merkt sich ueber den Neustart nur ERFOLGREICHE Auftraege; ein auf Geld wartender ueberlebt den Augmentierungs-Einbau und wird danach ausgefuehrt | offen |

## Was ausdruecklich haelt

- Der RAM-Nachbau: alle Regeln aus `RamCalculations.ts` korrekt uebernommen,
  113 von 114 Live-Messwerten exakt. Die eine Abweichung ist eine unabhaengige
  Bestaetigung: die Differenz betraegt exakt 32,00 GB = `singularity.connect`
  bei SF4.1.
- Die 30 Vertragsloeser: 6.000 Instanzen ueber den echten Annahmeweg des
  Spiels, 30 von 30 Typen richtig, null Ausnahmen.
- Die BitNode-Multiplikatoren, die Budgetarithmetik, die Uhren-Einheiten,
  S2 vergleicht sich nicht mit sich selbst, S4/S5 speisen die Leiter nicht
  mehr, die Prioritaetsinversion ist fuer ihren Anlassfall behoben.
