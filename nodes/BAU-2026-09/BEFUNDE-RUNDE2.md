# Skeptikerrunde 2 (04.09.2026) - Befundliste

Zwei Pruefer: Fehlermodi (18 Befunde) und Substanz (11 Befunde, davon 3
blockierend). Diese Liste wird abgehakt, nicht in Prosa beantwortet.

| Nr | Quelle | Schwere | Befund | Stand |
|----|--------|---------|--------|-------|
| B1 | Substanz 1 | BLOCKIEREND | shop.js precondition `requiresFile: data/buy-request.json` - Datei schreibt niemand; selbst mit dem richtigen Namen waere es ein Deadlock | **BEHOBEN** |
| B2 | beide | BLOCKIEREND | guard.js wird von niemandem gestartet; Kern filtert ihn raus, boot.js ruft ihn nie auf | **BEHOBEN** |
| B3 | Substanz 3 | BLOCKIEREND | kaufauftrag.json wird nie geloescht, `erledigt` lebt nur im Prozess -> Doppelkauf nach jedem shop-Neustart | **BEHOBEN** |
| B4 | Fehlermodi 3 | BLOCKIEREND | Kern prueft `d.zeit`; 8 von 20 Telemetriedateien haben gar keinen Schreiber, weitere schreiben `ts`/`wall` -> Kern erschlaegt seine eigenen Werkzeuge im 10-Minuten-Takt | **BEHOBEN** |
| B5 | Fehlermodi 3 | BLOCKIEREND | telemetryFile in registry.json ist teils erfunden - der Generator prueft nicht, ob es einen Schreiber gibt | **BEHOBEN** |
| B6 | Substanz 8 | WICHTIG | drei falsche ramBaseGb: shop 7,60 statt 7,00; guard 6,10 statt 3,85; bn4net 10,75 statt 10,80 | **BEHOBEN** |
| B7 | Substanz 7 | WICHTIG | shop.js meldet `state: "work"`, waehrend es auf Geld wartet | **BEHOBEN** |
| B8 | Fehlermodi 4 | BLOCKIEREND | WERKZEUGE/regLage einmal beim Kernstart gebaut -> nach einem Knotensprung fehlt blade.js fuer die Prozesslebensdauer; `phase: "normal"` fest verdrahtet | **BEHOBEN** |
| B9 | Fehlermodi 6 | BLOCKIEREND | S1 misst `motorTimeMs`, das kein echtes Werkzeug schreibt -> Sprosse feuert dauerhaft fuer jedes Werkzeug | **BEHOBEN** |
| B10 | Fehlermodi 7 | BLOCKIEREND | S4 kaskadiert auf Ziel "umgebung", das nie gruen verifizieren kann -> Leiter laeuft in EXHAUSTED | **BEHOBEN** |
| B11 | Fehlermodi 15 | WICHTIG | preise.json ueberlebt den Knotenwechsel -> Geisterrechner, falsche Preise, Kaltstart-Leiter uebersprungen | **BEHOBEN** |
| B12 | Fehlermodi 14 | WICHTIG | data/kpi.json und data/events.json haben keinen Schreiber; lib/kpi.js und lib/events.js importiert niemand -> S2 und S5 strukturell tot | **BEHOBEN** |
| B13 | Substanz 9 | WICHTIG | test-route.js ist im Branch rot | **HINFAELLIG** - der Pruefer lief gegen den Worktree, wo nur die 6 alten Tests liegen. Aus dem Hauptbaum heraus ist er gruen (39 Spruenge, Folge stimmt). |
| B14 | Substanz 9 | WICHTIG | die 20 Testdateien liegen auf master, nicht im Branch - der Pruefer sah 6 und hielt die Belege fuer erfunden | offen |
| B15 | Substanz 11 | KLEIN | calc.growThreads ruft growthLogPerThread ohne bnGrowthRate -> falsch in BN2/3/11 (Nutzer: lib/batch.js, autopilot.js) | offen |
| B16 | Substanz 10 | KLEIN | 13 von 29 Zahlen in Kommentaren und Commit-Texten falsch (cloud-Familie 3,85 statt 4,00; getServerUpgradeCost 0,10 statt 0,25; "ein Auftrag je zehn Sekunden"; die 28-GB-Behauptung) | **BEHOBEN** |
| B17 | Fehlermodi 10 | WICHTIG | shop.js-Kopfkommentar verspricht das Loeschen des Auftrags - der Code tut es nicht (Doku luegt) | **BEHOBEN** |
| B18 | Substanz 11 | KLEIN | lib/bitnodes.json: BN12 ist leer und nirgends als Sonderfall vermerkt (SF12-abhaengige Multiplikatoren) | offen |

## Stand 04.09.2026

14 von 18 behoben, 1 hinfaellig. Offen: B14 (Testbaum), B15
(calc.growThreads ohne bnGrowthRate), B18 (BN12 in bitnodes.json).

Zusaetzlich in derselben Runde gebaut, weil die Befunde es verlangt haben:

- `tools/ram.js` + `tools/ramkosten.js` - der RAM-Rechner. Ohne ihn waeren die
  drei falschen Werte aus B6 durch drei neue geratene ersetzt worden. Geeicht
  gegen 113 von 114 Live-Messwerten.
- `tools/syntax.js` - die Stufe unter allen Tests. Zwei Syntaxfehler an einem
  Nachmittag, beide im Spiel still.
- Die Schreiberpruefung in `tools/registry-bauen.js` - sie hat B5 beim ersten
  Lauf selbst gefunden.
