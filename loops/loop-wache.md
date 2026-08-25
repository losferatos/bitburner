# Loop 1: Wache

*Alles ab der nächsten Zeile ist der Prompt und wird wörtlich an CronCreate übergeben.*

BITBURNER-WACHE (Loop 1 von 3). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

Führe genau das aus:

```
cd /c/Users/erche/Desktop/claude_projecto/bitburner && node tools/strategie-check.js
```

**Zwei Dinge vorweg, sonst diagnostizierst du das Falsche:**

- Ein Rückgabewert ungleich 0 ist **normal**. Er bedeutet nur „Urteil nicht SPUR", nicht „Werkzeug defekt".
- Endet die Ausgabe **nicht** auf einer Zeile `URTEIL: <wort>`, ist der **Prüfer** kaputt, nicht der Bot. Dann: `~/.claude/notify.sh --title "Bitburner" --tag rotating_light "Strategiepruefer abgestuerzt"`, zwei Zeilen im Chat, und **nichts im Spiel anfassen**. Wenn der letzte Commit an `tools/strategie-check.js` erkennbar die Ursache ist (`git log -1 --stat tools/strategie-check.js`), nimm ihn zurück.

**Dateien im Spiel liegen NICHT auf der Platte.** `data/ps.json`, `data/bblage.json`, `data/blade.json`, `data/hilfe.txt` und `data/task.txt` existieren nur im Spiel-Dateisystem. Ein `cat data/ps.json` schlägt fehl, obwohl alles läuft. Gelesen wird ausschließlich so:

```
curl -s -m 8 -G "http://localhost:8795/api/rpc" --data-urlencode "method=getFile" --data-urlencode "filename=data/ps.json" --data-urlencode "server=home"
```

Auf der Platte liegen nur `data/verlauf-strategie.json`, `data/ziele.md` und `data/wache-zustand.json`.

Handle nach dem Urteil:

**URTEIL: SPUR** — Antworte mit genau einem Wort: `SPUR.` Nichts sonst. Keine Zahlen, keine Zusammenfassung, keine Erklärung. Dann Turn beenden.

**URTEIL: RESET** — Der Träger ist gefallen: Augmentierungs-Einbau oder BitNode-Wechsel. Das ist **kein Fehler**, aber der Wiederanlauf gehört geprüft, denn genau dort ist er am 25.08.2026 dreimal still gescheitert.
  - `ps.js` über den Auftragskanal anstoßen (siehe unten), dann prüfen: Läuft `bn4net.js`? Laufen die Werkzeuge?
  - Fehlt etwas, das laufen müsste: `pushFile` nach `data/reload.txt` mit `WERKZEUG <name>`.
  - Läuft **bn4net selbst** nicht, kann von außen nichts getan werden — der einzige Startkanal wird von bn4net gelesen. Dann `~/.claude/notify.sh --title "Bitburner" --tag warning --priority high "Nach Reset steht der Motor - bitte 'run boot.js' im Spielterminal eintippen"`.
  - Melde in max. 3 Stichpunkten. Bei einem BitNode-Wechsel gehört die neue Knotennummer dazu — das ist eine der wenigen Meldungen, die Eric jederzeit sehen will.

**URTEIL: BLIND** — Die Lage ist nicht messbar. Der Reihe nach:
  1. `curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:8795/api/wache` — bei `000` die Brücke starten: `node sync/bridge.js > "$TEMP/bridge.log" 2>&1 &`, 5 s warten, erneut prüfen. **Hilft es, beginne von vorn mit dem Prüflauf** — nicht den Turn beenden.
  2. Brücke antwortet, aber die Telemetrie ist alt: Dann steht der Motor im Spiel, oder das Spiel ist gar nicht offen. Beides ist von außen nicht reparierbar. `~/.claude/notify.sh --title "Bitburner" --tag warning --priority high "Bot steht - Spiel offen? Sonst 'run boot.js' im Spielterminal"` und zwei Zeilen im Chat, was Eric tun soll.
  3. Hilft der Brücken-Neustart nicht: dieselbe Push-Meldung, zwei Zeilen, Turn beenden. **Nie ohne Meldung aufgeben** — BLIND heißt, dass niemand sonst etwas merkt.

**URTEIL: STOERUNG** — Der Bot hat `data/hilfe.txt` geschrieben. Lies den Text, behebe die Ursache im Code wenn möglich, leere danach `hilfe.txt` über die Brücke (`pushFile` mit leerem `content`). Melde in max. 3 Stichpunkten.

**URTEIL: STAGNATION** — Der Träger kommt nicht voran. Diagnostiziere, aber **halte dich an die Grenzen weiter unten** — du läufst möglicherweise nachts, unbeaufsichtigt, und 23 andere Läufe vor und nach dir sehen dasselbe Bild.
  - Auftragskanal prüfen, bevor du ihn belegst — er hat genau einen Leser und wird beim Lesen geleert. Erst `getFile data/task.txt` lesen; kommt etwas anderes als eine leere Zeichenkette zurück, läuft gerade ein fremder Auftrag: diesen Schritt überspringen und ohne `ps.js` weiterarbeiten.
  - Ist er frei: `pushFile` nach `data/task.txt` mit Inhalt `["ps.js"]`, **26 s** warten, dann `data/ps.json` lesen (Befehl oben). Welche Werkzeuge laufen, welche fehlen?
  - In BitNode 6 gilt: solange `inBladeburner` false ist, muss `bbtrain.js` laufen und die Arbeit ein Gym in Sector-12 sein. Danach trägt `blade.js`.
  - Ein Werkzeug neu starten: `pushFile` nach `data/reload.txt` mit `WERKZEUG <name>`.

  **Grenzen für einen Eingriff — sie gelten ohne Ausnahme:**
  - Höchstens **eine Datei** und höchstens **30 geänderte Zeilen** je Lauf.
  - `src/bn4net.js` und `src/boot.js` nie ohne Erics ausdrückliche Freigabe. Das sind Motor und Wiederanlauf; ein Fehler dort kostet den ganzen Lauf.
  - Vor dem Commit `node tools/strategie-check.js` erneut ausführen. Wird das Urteil schlechter oder verschwindet die `URTEIL:`-Zeile: `git checkout -- <datei>` und stattdessen einen Auftrag eintragen.
  - Findest du in **zehn Minuten** keine belegte Ursache: nichts ändern. Auftrag eintragen, Turn beenden. Raten ist teurer als Warten.
  - **Was du nicht selbst behebst, wird ein Auftrag.** Oben in `nodes/BAUSTELLEN.md` unter `## Sofort` eintragen — Befund, gemessene Zahl, erwarteter Wert, Verdacht auf die Fundstelle. Steht dort schon ein Punkt mit demselben Befund, ergänze nur Messung und Uhrzeit; kein zweiter Eintrag. Ein Befund, der nur im Chat steht, ist verloren.
  - Melde in max. 4 Stichpunkten: Befund, Ursache, Eingriff, Erwartung.

**Git** — drei Loops schreiben in dieselben Dateien:
- Nur anfassen, was du selbst geändert hast: `git add <pfad>`, **nie** `git add -A`.
- Vor dem Push `git pull --rebase`. Bei einem Konflikt in `nodes/BAUSTELLEN.md` gilt: **beide Abschnitte behalten**, nichts verwerfen.

Regeln: Systemzeit per `date`, nie schätzen. Keine Augmentierungen von Hand kaufen. NIEMALS einen zweiten Tab auf bitburner-official.github.io öffnen. Kein b1tflum3, kein Destroy-Knopf. Keine Wall of Text — Eric will Stichpunkte.
