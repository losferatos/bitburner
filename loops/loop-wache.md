# Loop 1: Wache

*Alles ab der nächsten Zeile ist der Prompt und wird wörtlich an CronCreate übergeben.*

BITBURNER-WACHE (Loop 1 von 6). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

**LAUTLOS-SCHALTER — als Allererstes pruefen.** Fuehre `test -f data/lautlos && echo LAUTLOS` aus. Kommt `LAUTLOS`, gibst du in diesem Lauf **nichts im Chat aus**: kein Bericht, kein Stichpunkt, kein Wort, keine Zahl. Du arbeitest ganz normal weiter — alle Befunde und Ergebnisse gehen in die Dateien (`nodes/BAUSTELLEN.md`, `nodes/KURS.md`, `nodes/HEBEL.md`, Commits), nicht in den Chat. Per ntfy meldest du dann nur noch, was keinen Aufschub duldet: Bot steht, Pruefer abgestuerzt, BitNode-Wechsel oder Reset. Alles andere wartet bis zum Morgen. Der Schalter ist Erics Nachtruhe; die Datei wird geloescht, wenn er sich meldet.

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
  - Fehlt etwas, das laufen muesste: **`pushFile` nach `data/task.txt` mit `["<dateiname>.js"]`** - das ist der Startweg. **Nicht `WERKZEUG`:** Der reload-Kanal ist ein KILL (`src/bn4net.js:566-597`), er sucht laufende Instanzen und beendet sie. Laeuft nichts, meldet er `"traf NICHTS - laeuft es ueberhaupt?"` und startet **nichts**. Am 29.08. um 14:14 wurde so 90 Minuten lang ein toter Sleeve "neu gestartet", bis der Auftragskanal es in zwei Minuten loeste.
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
  - In den Kampfknoten (6, 7, 10) gilt: solange `inBladeburner` false ist, muss `bbtrain.js` laufen und die Arbeit ein Gym in Sector-12 sein. Danach trägt `blade.js`.
  - Ein Werkzeug neu starten: `pushFile` nach `data/reload.txt` mit `WERKZEUG <dateiname>.js` — **die Endung gehoert dazu** (der Kanal vergleicht gegen `pr.filename`; seit 27.08. 19:46 wird sie zwar ergaenzt, aber schreib sie hin). **Ein Neustart ist kein Nachweis** — ob die Änderung greift, sieht man nur an der Zahl, die sie ändern sollte. Und der Nachstart nach dem Kill ist **nicht garantiert**: Er haengt an `if (werkbank)`, und nach einem Augmentierungs-Einbau gibt es keine. Nach jedem `WERKZEUG` deshalb nachsehen, ob es wirklich wieder laeuft - im Zweifel `data/bn4net-log.txt` ueber die Bruecke lesen, dort steht jede Entscheidung des Motors.

  **Grenzen für einen Eingriff — sie gelten ohne Ausnahme:**
  - Höchstens **eine Datei** und höchstens **30 geänderte Zeilen** je Lauf.
  - `src/bn4net.js` und `src/boot.js` sind seit dem 27.08.2026 freigegeben, bleiben aber Motor und Wiederanlauf: **einzeln committen**, kleine Schritte, nach jeder Änderung `node tools/strategie-check.js`. Ein Fehler dort kostet den ganzen Lauf.
  - Vor dem Commit `node tools/strategie-check.js` erneut ausführen. Wird das Urteil schlechter oder verschwindet die `URTEIL:`-Zeile: `git checkout -- <datei>` und stattdessen einen Auftrag eintragen.
  - Findest du in **zehn Minuten** keine belegte Ursache: nichts ändern. Auftrag eintragen, Turn beenden. Raten ist teurer als Warten.
  - **Was du nicht selbst behebst, wird ein Auftrag.** Oben in `nodes/BAUSTELLEN.md` unter `## Sofort` eintragen — Befund, gemessene Zahl, erwarteter Wert, Verdacht auf die Fundstelle. Steht dort schon ein Punkt mit demselben Befund, ergänze nur Messung und Uhrzeit; kein zweiter Eintrag. Ein Befund, der nur im Chat steht, ist verloren.
**DREI FRAGEN, BEVOR EINE AENDERUNG AN `src/` ALS FERTIG GILT (30.08.2026).**
Code unter `src/` laeuft unbeaufsichtigt weiter. Eine Messung danach zeigt nur
den **Normalfall** - sie reicht nicht:

1. **Welche Uhr?** Misst der Code dieselbe Zeit, in der die beobachtete Sache
   laeuft? Echtzeit gegen Spielzeit, eigener Takt gegen fremde
   Abschlussbedingung. Am 30.08. verfehlte ein Rueckfall sein Ziel um **eine
   Sekunde** (Abschluss bei 61 s, eigener Takt 60 s) - jedes Mal, unendlich
   oft, ohne dass irgendetwas es meldete.
2. **Was bei Stillstand und Nachholen?** Gedrosselter Tab (die Engine
   verarbeitet dann hoechstens 5 Spielsekunden je Tick), Offline-Nachholen
   (bis 25-fach), Werkzeug neu gestartet, Datei aelter als der Takt. Greift
   die Aenderung dann noch, zu oft, oder gar nicht? Am 30.08. haette eine
   Zeitpruefung nach einer Offline-Nacht 25 Aktionen statt einer durchgelassen
   und das Stadtchaos von 25 auf ueber 1000 getrieben.
3. **Rate oder Bestand?** Speist sich die Zahl, mit der du die Aenderung
   begruendest, aus einem Vorrat, der sich erschoepft? Am 30.08. stand die
   Leitgroesse des Knotens acht Stunden lang auf einem Wert, der in Wahrheit
   das Leerraeumen eines ueber Nacht gewachsenen Lagers war.

Kannst du eine der drei nicht beantworten, schreib
`Geaendert <HH:MM>, Randfaelle ungeprueft` statt `Verifiziert`. Der
Skeptikerloop (Loop 6, alle zwei Stunden) nimmt sie sich dann vor - das ist
kein Makel, sondern der vorgesehene Weg.

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
