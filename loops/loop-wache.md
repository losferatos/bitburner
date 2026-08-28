# Loop 1: Wache

*Alles ab der nächsten Zeile ist der Prompt und wird wörtlich an CronCreate übergeben.*

BITBURNER-WACHE (Loop 1 von 5). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

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

Auf der Platte liegen `data/verlauf-strategie.json`, `data/ziele.md`, `data/wache-zustand.json` und `data/rueckstand.json`.

Handle nach dem Urteil:

**URTEIL: SPUR** — **Gib nichts aus und beende den Turn.** Kein Wort, kein Zeichen, keine Zahl, keine Zusammenfassung. Bis zum 28.08.2026 stand hier `SPUR.` als Lebenszeichen; Eric hat es an dem Tag abbestellt, weil der Lauf inzwischen autonom genug ist. Alle anderen Urteile melden wie unten beschrieben — das Schweigen gilt ausschliesslich fuer SPUR.

**URTEIL: RESET** — Der Träger ist gefallen: Augmentierungs-Einbau oder BitNode-Wechsel. Das ist **kein Fehler**, aber der Wiederanlauf gehört geprüft, denn genau dort ist er am 25.08.2026 dreimal still gescheitert.
  - `ps.js` über den Auftragskanal anstoßen (siehe unten), dann prüfen: Läuft `bn4net.js`? Laufen die Werkzeuge?
  - Fehlt etwas, das laufen müsste: `pushFile` nach `data/reload.txt` mit `WERKZEUG <dateiname>.js` — **die Endung gehoert dazu** (der Kanal vergleicht gegen `pr.filename`; seit 27.08. 19:46 wird sie zwar ergaenzt, aber schreib sie hin).
  - Läuft **bn4net selbst** nicht, kann von außen nichts getan werden — der einzige Startkanal wird von bn4net gelesen. Dann `~/.claude/notify.sh --title "Bitburner" --tag warning --priority high "Nach Reset steht der Motor - bitte 'run boot.js' im Spielterminal eintippen"`.
  - Melde in max. 3 Stichpunkten. Bei einem BitNode-Wechsel gehört die neue Knotennummer dazu — das ist eine der wenigen Meldungen, die Eric jederzeit sehen will. **Und der Kurs ist danach ungültig:** Trag in `nodes/BAUSTELLEN.md` unter `## Sofort` ein, dass `nodes/KURS.md` für den neuen Knoten neu hergeleitet werden muss — die Ausgangsbedingung ist je BitNode eine andere.

**URTEIL: BLIND** — Die Lage ist nicht messbar. Der Reihe nach:
  1. `node tools/aufsicht.js` — es prüft und startet Brücke und Wächter, wenn sie fehlen, und ist idempotent. **Hilft es, beginne von vorn mit dem Prüflauf** — nicht den Turn beenden.
  2. Brücke antwortet, aber die Telemetrie ist alt: Dann steht der Motor im Spiel, oder das Spiel ist gar nicht offen. Beides ist von außen nicht reparierbar. `~/.claude/notify.sh --title "Bitburner" --tag warning --priority high "Bot steht - Spiel offen? Sonst 'run boot.js' im Spielterminal"` und zwei Zeilen im Chat, was Eric tun soll.
  3. Hilft der Brücken-Neustart nicht: dieselbe Push-Meldung, zwei Zeilen, Turn beenden. **Nie ohne Meldung aufgeben** — BLIND heißt, dass niemand sonst etwas merkt.

**URTEIL: STOERUNG** — Der Bot hat `data/hilfe.txt` geschrieben. Lies den Text, behebe die Ursache im Code wenn möglich, leere danach `hilfe.txt` über die Brücke (`pushFile` mit leerem `content`). Melde in max. 3 Stichpunkten.

**URTEIL: STAGNATION** — Der Träger kommt nicht voran. Diagnostiziere, aber **halte dich an die Grenzen weiter unten** — du läufst möglicherweise nachts, unbeaufsichtigt, und 23 andere Läufe vor und nach dir sehen dasselbe Bild.
  - **Erst die harmloseste Ursache ausschließen:** `node tools/rueckstand.js`. Hängt das Spiel der Uhr hinterher (Tab gedrosselt, Rechner war aus), ist der Träger nicht stehengeblieben — er wird gerade nachgeholt. Das ist kein Fall für einen Eingriff.
  - Auftragskanal prüfen, bevor du ihn belegst — er hat genau einen Leser und wird beim Lesen geleert. Erst `getFile data/task.txt` lesen; kommt etwas anderes als eine leere Zeichenkette zurück, läuft gerade ein fremder Auftrag: diesen Schritt überspringen und ohne `ps.js` weiterarbeiten.
  - Ist er frei: `pushFile` nach `data/task.txt` mit Inhalt `["ps.js"]`, **26 s** warten, dann `data/ps.json` lesen (Befehl oben). Welche Werkzeuge laufen, welche fehlen?
  - **Vorher den Zeitstempel prüfen.** `data/ps.json` ist eine Momentaufnahme, kein Dauerlauf — `src/ps.js` schreibt einmal und endet. Ist `zeit` älter als zwei Minuten, hat dein Auftrag den Kanal nicht erreicht (er hat mehrere Schreiber, darunter `tools/wache.js` alle drei Minuten, alle ohne Sperre). Dann liest du einen alten Stand und diagnostizierst „Werkzeug X läuft nicht", während alles läuft. Am 27.08. um 18:05 war die Datei **3 Stunden 25 Minuten** alt. Im Zweifel: keinen Neustart auslösen, sondern einen Auftrag eintragen.
  - In BitNode 6 gilt: solange `inBladeburner` false ist, muss `bbtrain.js` laufen und die Arbeit ein Gym in Sector-12 sein. Danach trägt `blade.js`.
  - Ein Werkzeug neu starten: `pushFile` nach `data/reload.txt` mit `WERKZEUG <dateiname>.js` — **die Endung gehoert dazu** (der Kanal vergleicht gegen `pr.filename`; seit 27.08. 19:46 wird sie zwar ergaenzt, aber schreib sie hin). **Ein Neustart ist kein Nachweis** — ob die Änderung greift, sieht man nur an der Zahl, die sie ändern sollte.

  **Grenzen für einen Eingriff — sie gelten ohne Ausnahme:**
  - Höchstens **eine Datei** und höchstens **30 geänderte Zeilen** je Lauf.
  - `src/bn4net.js` und `src/boot.js` sind seit dem 27.08.2026 freigegeben, bleiben aber Motor und Wiederanlauf: **einzeln committen**, kleine Schritte, nach jeder Änderung `node tools/strategie-check.js`. Ein Fehler dort kostet den ganzen Lauf.
  - Vor dem Commit `node tools/strategie-check.js` erneut ausführen. Wird das Urteil schlechter oder verschwindet die `URTEIL:`-Zeile: `git checkout -- <datei>` und stattdessen einen Auftrag eintragen.
  - Findest du in **zehn Minuten** keine belegte Ursache: nichts ändern. Auftrag eintragen, Turn beenden. Raten ist teurer als Warten.
  - **Was du nicht selbst behebst, wird ein Auftrag.** Oben in `nodes/BAUSTELLEN.md` unter `## Sofort` eintragen — Befund, gemessene Zahl, erwarteter Wert, Verdacht auf die Fundstelle. Steht dort schon ein Punkt mit demselben Befund, ergänze nur Messung und Uhrzeit; kein zweiter Eintrag. Ein Befund, der nur im Chat steht, ist verloren.
  - Melde in max. 4 Stichpunkten: Befund, Ursache, Eingriff, Erwartung.

**Git** — fünf Loops schreiben in dieselben Dateien:
- Nur anfassen, was du selbst geändert hast: `git add <pfad>`, **nie** `git add -A`.
- Vor dem Push `git pull --rebase`. Bei einem Konflikt in `nodes/BAUSTELLEN.md` gilt: **beide Abschnitte behalten**, nichts verwerfen.

**Hintergrundtasks legen die Loops still — harte Regel, experimentell belegt.**
Ein schwebender Hintergrundtask (`run_in_background`-Bash oder Monitor)
blockiert ALLE Cron-Jobs der Sitzung bis zu seinem Ende, und verpasste
Feuerungen verfallen ersatzlos. Das `timeout` gilt fuer Hintergrund-Bash
NICHT - dort gibt es keine Obergrenze. In der Nacht zum 26.08. hat das die
Loops zwei Stunden stillgelegt: Eine `until`-Warteschleife wartete auf eine
Datei, die es nie geben konnte, und lief 2h56m. Die erste Feuerung kam 45
Sekunden nach dem Kill des Prozesses.
Deshalb:
- Warteschleifen IMMER mit harter Grenze: `for i in $(seq 1 20); do ...;
  sleep 30; done` statt `until <bedingung>`. Eine Bedingung, die nie eintritt,
  wird so zum begrenzten Fehlschlag statt zur Endlosblockade.
- Monitor nur mit knappem `timeout_ms`, **nie** `persistent: true`.
- Wirklich lange Wartearbeit gar nicht als verfolgten Task starten, sondern
  abgekoppelt (`nohup`, `Start-Process`) mit Datei-Polling durch die Loops.
- Vor dem Turn-Ende pruefen, ob ein Task zurueckbleibt. Hilfe:
  `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter
  \"Name='bash.exe'\" | Select-Object ProcessId,CreationDate"` - alles aelter
  als eine halbe Stunde ist verdaechtig.

**Die Loops entscheiden selbst - seit dem 27.08.2026 ohne Ausnahme.**
Aus einer belegten Erkenntnis wird ein **unmittelbarer Arbeitsauftrag**, kein
Wartestatus: Wer eine Zahl gemessen hat, die eine Aenderung rechtfertigt,
setzt sie um, misst nach und nimmt sie zurueck, wenn sie nicht traegt.
"Wartet bis Eric" ist kein Ablageort fuer unbequeme Entscheidungen (seine
Ansage vom 26.08.2026, 16:05, nachdem der groesste offene Hebel des Knotens
vier Laeufe lang dort gelegen hatte).

**`src/bn4net.js` und `src/boot.js` sind seit dem 27.08.2026, 05:00
freigegeben.** Eric hat den Vorbehalt aufgehoben, mit einer Auflage:
**jede Aenderung dort einzeln committen**, damit sie sich einzeln zurueckdrehen
laesst. Sie bleiben Motor und Wiederanlauf - ein Fehler dort kostet den ganzen
Lauf -, also gilt dort besonders: kleine Schritte, nach jeder Aenderung
`node tools/strategie-check.js`, und im Zweifel die vorsichtigere Fassung.

**Die Reihenfolge der BitNodes steht fest und wird von niemandem geaendert** -
weder von Eric noch von den Loops. Sie ist das Ergebnis von Fables Analyse
(`nodes/AUDIT-ROADMAP-2026-08-24.md`). Wer einen Grund zu haben glaubt, sie
anzufassen, traegt ihn in `nodes/BAUSTELLEN.md` ein und faehrt weiter.

Regeln: Systemzeit per `date`, nie schätzen. Keine Augmentierungen von Hand kaufen. NIEMALS einen zweiten Tab auf bitburner-official.github.io öffnen. Kein b1tflum3, kein Destroy-Knopf. Keine Wall of Text — Eric will Stichpunkte.
