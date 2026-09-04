# Abnahme Stufe B — 12 h live ohne Eingriff

**Angelegt: 04.09.2026, 16:10. Noch nicht begonnen.**
Kriterien aus `nodes/AUFTRAG-BAU-2026-09.md`, Abschnitt 10.

Diese Datei ist die **Messvorschrift**, nicht das Ergebnis. Sie liegt bereit,
damit beim Start der Stufe B niemand mehr überlegen muss, was gemessen wird —
und damit die Kriterien nicht nachträglich zu dem passen, was herausgekommen
ist. Die Ergebnisspalten füllt der Lauf.

---

## Wann die Uhr startet

**Start = `date` nach der letzten Einspielung.** Nicht nach dem Merge, nicht
nach dem Commit — nach dem letzten Schreibvorgang, der das Spiel erreicht hat.

Der Hot-Swap (Auftrag 9) steht davor. Solange `tools/hotswap.js --pruefen`
rote Punkte meldet, beginnt Stufe B nicht.

```bash
date                                   # der Startzeitpunkt, wörtlich notieren
node tools/hotswap.js --pruefen        # muss vollständig grün sein
```

**Ein Eingriff ist jede Änderung, die das Live-Spiel erreicht:** Hot-Swap,
`pushFile`, `deleteFile`, `task.txt`, `reload.txt`, Neustart der Brücke.
Greifst du ein, beginnt die Uhr neu.

**Arbeit ohne Live-Berührung läuft weiter und ist ausdrücklich erwünscht:**
Gewerke im Worktree, Ebene-0/1/2-Tests, Prüfstand, Skeptikerläufe, Doku,
Memory, diese Dateien. Sie berührt `manual_actions` nicht.

---

## Die Kriterien

| # | Kriterium | Soll | Messbefehl | Ergebnis |
|---|---|---|---|---|
| B1 | `manual_actions` | **0** | `cat data/manual-actions.json` — Einträge nach dem Startzeitpunkt | |
| B2 | Sprossen ≥ 2 | **0** | `cat data/penalties.json` | |
| B3 | Fehlstrafen (`false_kill_count`) | **0** | `node tools/checkin.js` | |
| B4 | `negative_balance_min` | **0** | `node tools/checkin.js` | |
| B5 | Kein Werkzeug über Frischegrenze bei tickender Engine | keins | `node tools/lage.js` | |
| B6 | Brücke ohne Ausfall **oder** Selbstheilung binnen 60 s | — | `grep -c "Bruecke gestartet" data/bridge.log` | |
| B7 | `T2` (Rang-Verdopplungszeit) | ≤ 2 × Soll nach 3.3 | `node tools/checkin.js` | |
| B8 | `rank_rate_per_motor_h` | **> 0** | `node tools/checkin.js` | |
| B9 | `chaos_city` | **< 50** | `node tools/checkin.js` | |
| B10 | Sicherungen stündlich grün | 12 Stück | `tail -14 backups/INDEX.tsv` | |
| B11 | Eine Nacht mit verdecktem Tab: S4 erkannt, **nicht** bestraft | — | `data/events.json`, Art `blocked`/`note` | |
| B12 | Beim Sichtbarwerden keine S2-Fehlstrafe durch Nachholen | 0 | `data/penalties.json` | |

### Was ausdrücklich NICHT gilt

`next_blackop_chance ≥ 0,35` gilt **nur, wenn `getNextBlackOp()` freigeschaltet
ist** — die erste Operation verlangt 2.500 Rang (`BlackOperations.ts:11`).

**Der Rang ist zu Beginn der Stufe B neu zu messen.** Er wächst während des
Baus weiter, und ein Kriterium gegen eine Zahl von gestern ist keins. Gemessen
04.09. 15:04: **1.990,4** (aus `PlayerSave.data.bladeburner.data.rank`, siehe
`tools/wiederherstellung.js`). Am 03.09. 23:58 waren es 596 — in gut 15
Stunden also mehr als eine Verdreifachung. Die 2.500 sind damit in Reichweite,
aber am Starttag noch nicht sicher erreicht; bis dahin treten B8 und B9 an die
Stelle von `next_blackop_chance`.

```bash
node tools/wiederherstellung.js | grep "Bladeburner-Rang"
```

---

## Was ein Brückenausfall bedeutet

**Er ist kein `manual_action` und setzt die 12-h-Uhr nicht zurück** (Auftrag
5.4). Er erzeugt einen Befund.

Solange der Autostart-Eintrag im Startmenü fehlt — Erics Handgriff —, gilt die
abgekoppelte Schleifenfassung von `sync/bridge-start.cmd` als gleichwertig.
Ihr Selbstneustart ist zweimal nachgewiesen (04.09. 14:18:10 → 6 s, 15:04:20 →
7 s). **Das Protokoll hält fest, welche Variante lief.**

---

## Die Zweit-Tab-Sperre im Blick behalten

Neu seit dem 04.09.: Meldet sich eine zweite RFA-Verbindung, **während die
bestehende noch antwortet**, sperrt die Brücke jeden Schreibweg ins Spiel und
sichert alle fünf Minuten unter dem Anlass `race`.

Für Stufe B heißt das zweierlei:

1. **Steht die Sperre, ist der Lauf unterbrochen** — nicht wegen eines
   Eingriffs, sondern weil ein zweiter Tab lief. Das ist ein Befund und ein
   Grund, die Uhr neu zu starten, nachdem geklärt ist, was los war.
2. **Die Sperre aufzuheben ist ein Eingriff** (sie zu setzen nicht). Vorher
   `totalPlaytime` in `backups/INDEX.tsv` prüfen: sinkt sie irgendwo, hat ein
   zweiter Stand geschrieben.

```bash
ls -la data/zweittab-alarm.json 2>/dev/null || echo "keine Sperre"
cut -f1,2 backups/INDEX.tsv | tail -20
```

---

## Der Ablauf

1. `date` notieren, Startzeit ist verbindlich.
2. Alle 60 Minuten: `node tools/checkin.js`, Ergebnis in die Tabelle.
3. Nach 12 Stunden: alle zwölf Zeilen füllen, Urteil schreiben.
4. Fällt ein Kriterium: **kein Handgriff.** Beobachten bis zur Selbstheilung
   oder bis ein Rollback-Auslöser nach Auftrag 9 greift. Befund → Code und
   Test → Uhr beginnt neu.

Die Wartephase nach Auftrag 13 gilt: es wird nicht dagesessen. Was ohne
Live-Berührung geht, läuft weiter.
