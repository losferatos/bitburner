# Skeptikerrunde 4 (04.09.2026, mittags) — Befundliste

Vier Prüfer auf C.16 bis C.19, getrennte Winkel: Prämisse, Fehlermodi im
Alltagsbetrieb, inhaltliche Substanz, Tauglichkeit der Tests.

**Drei Prüfer haben unabhängig denselben blockierenden Befund gefunden**: die
Sprosse-5-Kette aus C.19 endet eine Station vor dem Ziel. Das ist die
Fehlerklasse, gegen die C.19 selbst antritt — eine Ebene tiefer.

| Nr | Quelle | Schwere | Befund | Stand |
|----|--------|---------|--------|-------|
| R1 | 3 von 4 | BLOCKIEREND | `punish.js` liest den Auftrag aus `data/penalty-order.json` — **kein Schreiber im ganzen Baum**. Der Wächter schreibt `watchdog.json.orders` in einem Schema, das kein einziges Feld teilt (`sprosse` statt `rung`, ohne `s2MotorMs`, `wirkungslos`, `nodeReset`). Die ganze C.19-Kette läuft an, protokolliert "executed" und tut nichts | offen |
| R2 | 3 von 4 | BLOCKIEREND | `data/aug-queue.json` (Vorbedingung 4) hat ebenfalls keinen Schreiber. `bn4rep.js` führt die Zahl in `data/einbau.json` unter `wartend` | offen |
| R3 | 2 von 4 | BLOCKIEREND | Die Eskalation nimmt die nächste **gebaute** Sprosse ohne Rücksicht auf `ausloeser`. Seit Sprosse 5 gebaut ist, führt jedes Signal nach Sprosse 3 zu einem Augmentierungs-Einbau — der wahrscheinlichste Fall ist ein Werkzeug, das nicht in 32 GB passt, und ein Einbau macht genau das schlimmer | offen |
| R4 | 2 von 4 | BLOCKIEREND | Der Wächter schreibt `result: "executed"` **vor** der Ausführung, und `punish.js` liest genau dieses Protokoll für seinen Knotendeckel. Die erste Auslösung im Knoten verbrennt damit das Kontingent, auch wenn `punish.js` verweigert hat | offen |
| R5 | 2 von 4 | BLOCKIEREND | `wirkungGruen` kennt nur `ziel === "kern"` und Registry-Einträge. S2 trägt `ziel: "fortschritt"` — die Prüfung ist strukturell rot, danach EXHAUSTED, und `freigeben()` (der ausdrücklich gebaute Ausgang) hat keinen Aufrufer und ist in `guard.js` nicht einmal importiert | offen |
| R6 | Tests | BLOCKIEREND | `Total Number of Primes`: `if (hi - lo > 60000) return true` — das Spiel erzeugt Spannen von **mindestens** 100.000 (`TotalPrimesInRange.ts:20-22`). Die Gegenprobe nimmt bei **100 %** der echten Verträge jede Antwort an. Gemessen: 6 von 6 Müllantworten akzeptiert | offen |
| R7 | Tests | BLOCKIEREND | `Find All Valid Math Expressions`: `if (ziffern.length > 10) return true` — das Spiel erzeugt 4 bis 12 Ziffern. Gemessen über 245 Generatorinstanzen: 72 nahmen eine gekürzte Antwort an, bei 11 und 12 Ziffern sogar die leere Liste | offen |
| R8 | Tests | BLOCKIEREND | Die C.7-Platzreservierung wird nur gegen eine **Nachbildung** im Test geprüft; `test-kaltstart-budget.js` importiert `bn4net.js` gar nicht, und `test-kern-c789.js` gibt home 1 TB. Der echte Code läuft nie unter Knappheit | offen |
| R9 | Prämisse | WICHTIG | Ein Einbau in einem V2-Knoten setzt alle Kampfwerte auf 1 (`PlayerObjectGeneralMethods.ts:86-100`), der Bladeburner-Rang bleibt. Die Erfolgswahrscheinlichkeit bricht zusammen, Fehlschläge ziehen Rang ab — Sprosse 5 erzeugt in 33 von 40 Routeneinträgen genau den Zustand, den sie heilen soll | offen |
| R10 | Prämisse | WICHTIG | Billigere Antworten auf S2, die die Leiter nicht kennt: Kampfwerte-Training erzwingen, Trupp/Stadt/Chaos wechseln, Aktionsmischung zurücksetzen, `blade.js` neu starten. Alle reversibel, Minuten statt 3,1 h | offen |
| R11 | Prämisse | WICHTIG | `false_penalty_count`, `manual_actions`, `false_kill_count`, `wirt_fehlt_count`, `queued_augs_at_jump`, `negative_balance_min`, `bridge_restarts` haben **keinen Schreiber**. Alle Soll-0-Kennzahlen sind null per Konstruktion — die Vorbedingung fürs Scharfstellen war nie messbar | offen |
| R12 | Prämisse | WICHTIG | Ein globaler Schalter für die ganze Leiter. Sprosse 1 und 2 sind billig und reversibel, 3 und 5 nicht. Es gibt keine Möglichkeit, die unteren scharf und die oberen in Beobachtung zu halten | offen |
| R13 | 3 von 4 | WICHTIG | `jump_latency_min` nimmt das **jüngste** `boot`, und `boot` entsteht je Prozessleben, nicht je Sprung. Nach dem ersten Kernneustart misst sie "Zeit seit dem Sprung" — gerechnet: 1,50 min direkt danach, 540 min nach einem Neustart 9 h später | offen |
| R14 | 2 von 4 | WICHTIG | `boot_latency_min` misst Runde 1 → Runde 6 desselben Prozesses (`runde % 6`), also das Abtastraster. Bei sichtbarem Tab ~0,8 min, im verdeckten Tab 5–6 min gegen ein Soll von ≤ 5 — sie fällt in genau dem Zustand durch, den Stufe B verlangt. Und der Ausfall, für den sie da ist (der Kern startet gar nicht), macht sie `null`, nicht rot | offen |
| R15 | 2 von 4 | WICHTIG | Das Feld `uhr` der Sprossen hat keinen Leser: `schritt()` misst alles in Wächterzeit. Sprosse 5 deklariert `uhr: "motor"` und `karenzMs: 6h` — ausgeführt werden 6 h Wanduhr. **Und `test-sprosse5-kette.js` prüft genau dieses Feld** — ein Test auf eine Deklaration, nicht auf ein Verhalten | offen |
| R16 | Prämisse | WICHTIG | `wakelock.js` steht mit `killSafe: true` in der Registry, Sprosse 3 verschont nur `killSafe === false` plus Notliste. Sprosse 3 feuert, wenn der Kern tot ist — und nur der Kern startet den Wachhalter zurück | offen |
| R17 | Fehlermodi | WICHTIG | `letzteAusfuehrung` und `gesperrt` sind prozesslokale Maps. Nach einem Wächter-Neustart (Normalfall, `restartPolicy: always`) fällt die C.16-Reparatur der Wirkungsprüfung still auf ihr altes, fehlerhaftes Verhalten zurück | offen |
| R18 | Fehlermodi | WICHTIG | Der Kommentar im Kern behauptet eine Knotenprüfung des Auftrags ("aus DIESEM Knoten"), die es nicht gibt — und der Auftrag trägt kein `nodeReset`, mit dem eine möglich wäre. Ein Auftrag überlebt den Sprung | offen |
| R19 | Fehlermodi | WICHTIG | Der Trockenlauf ist unbeobachtbar: `data/punish.json` liest niemand, `punish.js` steht in keiner Registry. Und der Kommentar "tools/ liest orders so" stimmt nicht — null Treffer | offen |
| R20 | Tests | WICHTIG | Im Ebene-2-Kerntest steht die Wanduhr still: 400 Runden, Δwall = 0. Jeder wanduhrabhängige Zweig ist eingefroren, u. a. der 5-Minuten-Verfall der Reservierung | offen |
| R21 | Tests | WICHTIG | Der Mock kennt `ns.scriptKill`, `ns.exit` und `ns.share` nicht — acht Aufrufstellen im Kern, darunter der Werkzeug-Neustart (Sprosse 1) und der Selbstbeender für den Hot-Swap. Diese Pfade sind beweisbar unerreicht | offen |
| R22 | Tests | WICHTIG | Der Mock-`exec` verlangt kein Root, das Spiel schon (`NetscriptWorker.ts:280`). Genau an der Stelle, an der die Arbeiterverteilung entschieden wird | offen |
| R23 | Tests | WICHTIG | Für die Brücke gibt es keinen einzigen Test, obwohl Auftrag 6.1 ihn namentlich verlangt (Reconnect, Backup vor pushAll, Wachhund, EADDRINUSE, zweite Verbindung). Steht **nicht** in der Lückenliste | offen |
| R24 | Tests | WICHTIG | Die Lückenliste ist Prosa, kein Tor: `test-alles.js` beendet mit Exit 0 bei neun offenen Punkten. Und drei Einträge sind Zustandsbeschreibungen, die sich durch Messen nie leeren lassen — das Kriterium "Liste leer" erzeugt Druck zum Streichen | offen |
| R25 | Fehlermodi | KLEIN | `kernPhaseFrisch` prüft nur die Wanduhr-Frische, nicht die Knotenidentität. Im Fenster zwischen 10-min-Karenz und 15-min-Frist liest der Wächter den toten Kern des **vorigen** Knotens | offen |
| R26 | Fehlermodi | KLEIN | Der Kern protokolliert "passt auf keinen Wirt" ungedrosselt (jede Runde, 15 min lang), und die Doppelstart-Sperre für `punish.js` sucht nur auf home, gestartet wird aber auf dem größten Wirt | offen |
| R27 | Fehlermodi | KLEIN | Ein zu strenges `verify` verstummt lautlos: `contracts.js` überspringt still, und weder `contracts.js` noch `cdump.js` haben eine `telemetryFile` | offen |
| R28 | Tests | KLEIN | Zwei Proben, die nie rot werden können: `pruefe("es beendet sich sofort", true)` und ein `pruefe(..., true)` in einem `if`, das bei falsy ganz entfällt | offen |
| R29 | Tests | KLEIN | Der Lader trägt keinen Cache-Buster und keinen PID-Anteil in den transitiven `.mjs`-Kopien — zwei gleichzeitige Testläufe löschen einander die Kopien | offen |
| R30 | Prämisse | KLEIN | Das Kaltstart-Tor prüft nicht, was sein Kommentar behauptet: "die Spitze so, dass noch ein Arbeiter Platz hat" wird nur gedruckt (33,45 von 32), geprüft wird `spitze <= 32` | offen |

## Was ausdrücklich hält

- **Die Trennung "der Wächter beauftragt, der Kern führt aus"** ist aus der
  Arithmetik belegt und richtig — `punish.js` kostet 83,35 GB bei SF4.1, der
  Wächter hat 6,10.
- **Die acht Vorbedingungen** von Sprosse 5 sind sauber aus dem Quelltext
  belegt, keine ist überflüssig.
- **Der Schwere-0-Riegel** für S4 und S5 verhindert belegbar die
  EXHAUSTED-Kette, die ein verdecktes Fenster sonst nach einer Stunde
  ausgelöst hätte.
- **Die Uhrenkaskade in S1** ist in der richtigen Reihenfolge und schließt die
  Fehlmeldung im verdeckten Tab tatsächlich aus.
- **Der Guard-Deckel von 120 s** ist mit der gemessenen Drosselung richtig
  bemessen; eine kleinere Zahl hätte jede Nachtrunde verworfen.
- **Die 15-Minuten-Verfallsfrist der `orders`** ist bewusst in der Wanduhr
  geführt — nach einer Offline-Nacht ist der Zettel garantiert abgelaufen, also
  in der sicheren Richtung.
- **Die Verschiebung der vier Dateien in die unbedingte Räumliste** (K2/K5) ist
  durch `Prestige.ts:55-75` gedeckt.
- **`markeVeraltet`** ist die richtige Bauform: die Sperre prüft der, der sie
  auswertet, nicht das Gewerk, das sie stilllegt.
- **`test-motor-ebene2.js`** ist der substanzielle Teil der Suite: er trennt die
  Uhren wirklich und prüft numerisch statt auf Vorhandensein.
- **Die Tautologie-Erkennung** in `test-loeser-verify.js` ist eine echte
  Strukturprüfung, und die 28 nicht kurzgeschlossenen Lösertypen lehnen die
  Verfälschungen sauber ab.
- **Der Mock** trifft an mehreren nachgeprüften Stellen das Spiel exakt: die
  `read`/`fileExists`-Asymmetrie, `scp` bei Teilausfall, `getServerMaxRam` für
  unbekannte Wirte, der SF4-Faktor.
