# Skeptikerrunde 2 (04.09.2026) - Befundliste

Zwei Pruefer: Fehlermodi (18 Befunde) und Substanz (11 Befunde, davon 3
blockierend). Diese Liste wird abgehakt, nicht in Prosa beantwortet.

| Nr | Quelle | Schwere | Befund | Stand |
|----|--------|---------|--------|-------|
| B1 | Substanz 1 | BLOCKIEREND | shop.js precondition `requiresFile: data/buy-request.json` - Datei schreibt niemand; selbst mit dem richtigen Namen waere es ein Deadlock | offen |
| B2 | beide | BLOCKIEREND | guard.js wird von niemandem gestartet; Kern filtert ihn raus, boot.js ruft ihn nie auf | offen |
| B3 | Substanz 3 | BLOCKIEREND | kaufauftrag.json wird nie geloescht, `erledigt` lebt nur im Prozess -> Doppelkauf nach jedem shop-Neustart | offen |
| B4 | Fehlermodi 3 | BLOCKIEREND | Kern prueft `d.zeit`; 8 von 20 Telemetriedateien haben gar keinen Schreiber, weitere schreiben `ts`/`wall` -> Kern erschlaegt seine eigenen Werkzeuge im 10-Minuten-Takt | offen |
| B5 | Fehlermodi 3 | BLOCKIEREND | telemetryFile in registry.json ist teils erfunden - der Generator prueft nicht, ob es einen Schreiber gibt | offen |
| B6 | Substanz 8 | WICHTIG | drei falsche ramBaseGb: shop 7,60 statt 7,00; guard 6,10 statt 3,85; bn4net 10,75 statt 10,80 | offen |
| B7 | Substanz 7 | WICHTIG | shop.js meldet `state: "work"`, waehrend es auf Geld wartet | offen |
| B8 | Fehlermodi 4 | BLOCKIEREND | WERKZEUGE/regLage einmal beim Kernstart gebaut -> nach einem Knotensprung fehlt blade.js fuer die Prozesslebensdauer; `phase: "normal"` fest verdrahtet | offen |
| B9 | Fehlermodi 6 | BLOCKIEREND | S1 misst `motorTimeMs`, das kein echtes Werkzeug schreibt -> Sprosse feuert dauerhaft fuer jedes Werkzeug | offen |
| B10 | Fehlermodi 7 | BLOCKIEREND | S4 kaskadiert auf Ziel "umgebung", das nie gruen verifizieren kann -> Leiter laeuft in EXHAUSTED | offen |
| B11 | Fehlermodi 15 | WICHTIG | preise.json ueberlebt den Knotenwechsel -> Geisterrechner, falsche Preise, Kaltstart-Leiter uebersprungen | offen |
| B12 | Fehlermodi 14 | WICHTIG | data/kpi.json und data/events.json haben keinen Schreiber; lib/kpi.js und lib/events.js importiert niemand -> S2 und S5 strukturell tot | offen |
| B13 | Substanz 9 | WICHTIG | test-route.js ist im Branch rot: src/ausgang.js importiert "lib/route.js", was Node nicht aufloest | offen |
| B14 | Substanz 9 | WICHTIG | die 20 Testdateien liegen auf master, nicht im Branch - der Pruefer sah 6 und hielt die Belege fuer erfunden | offen |
| B15 | Substanz 11 | KLEIN | calc.growThreads ruft growthLogPerThread ohne bnGrowthRate -> falsch in BN2/3/11 (Nutzer: lib/batch.js, autopilot.js) | offen |
| B16 | Substanz 10 | KLEIN | 13 von 29 Zahlen in Kommentaren und Commit-Texten falsch (cloud-Familie 3,85 statt 4,00; getServerUpgradeCost 0,10 statt 0,25; "ein Auftrag je zehn Sekunden"; die 28-GB-Behauptung) | offen |
| B17 | Fehlermodi 10 | WICHTIG | shop.js-Kopfkommentar verspricht das Loeschen des Auftrags - der Code tut es nicht (Doku luegt) | offen |
| B18 | Substanz 11 | KLEIN | lib/bitnodes.json: BN12 ist leer und nirgends als Sonderfall vermerkt (SF12-abhaengige Multiplikatoren) | offen |
