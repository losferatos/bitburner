# Loop 3: Kurzreport

*Alles ab der nächsten Zeile ist der Prompt und wird wörtlich an CronCreate übergeben.*

BITBURNER-REPORT (Loop 3 von 3). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

Der Halbstundenbericht für Eric. Er ist das einzige, was regelmäßig im Chat landet — Loop 1 schweigt bei „alles gut", Loop 2 meldet nur seine Arbeit.

**Reihenfolge beachten: erst arbeiten, dann berichten.** Der Bericht steht am Ende, weil danach nichts mehr kommt.

**1. Messen**
```
date
cd /c/Users/erche/Desktop/claude_projecto/bitburner && node tools/strategie-check.js
cat data/ziele.md 2>/dev/null || echo "(erster Report)"
```
Ein Rückgabewert ungleich 0 ist normal — er heißt nur „Urteil nicht SPUR". Fehlt die Zeile `URTEIL:` ganz, ist der Prüfer kaputt; dann sag das als einzigen Inhalt des Berichts und ändere nichts.

Brauchst du Zahlen aus dem Spiel (`data/blade.json`, `data/bblage.json`): Die liegen **nicht** auf der Platte, sondern nur im Spiel. Lesen ausschließlich über die Brücke:
```
curl -s -m 8 -G "http://localhost:8795/api/rpc" --data-urlencode "method=getFile" --data-urlencode "filename=data/blade.json" --data-urlencode "server=home"
```

**2. Neue Ziele festhalten** — vor dem Bericht, sonst geht es unter. Ohne diese Datei kann der nächste Report nicht reflektieren; seine Sitzung erinnert sich an nichts.
```bash
cat > data/ziele.md <<'ZIELE'
# Ziele, gesetzt <HH:MM> am <TT.MM.JJJJ>
1. <Ziel> | Messung: <woran man es abliest>
2. <Ziel> | Messung: <...>
3. <Ziel> | Messung: <...>
ZIELE
```
Ziele sind **überprüfbar**, nicht Absichten. „Kampfwert-Tiefstand über 100" ist ein Ziel, „am Training weiterarbeiten" ist keines. Die Datei wird nicht committet.

**3. Kaputte Befunde werden Aufträge, nicht Stichpunkte.** Fällt etwas auf, das nicht stimmt — eine Zahl, die stehenbleibt, ein Werkzeug, das nichts liefert, ein Dialog, der sich wiederholt —, trag es oben in `nodes/BAUSTELLEN.md` unter `## Sofort` ein:

```
### <Kurzer Befund in einem Satz> (<HH:MM>)
Gemessen: <die Zahl, die den Befund belegt, mit ihrer Quelle>
Erwartet: <was stattdessen dastehen müsste>
Verdacht: <Fundstelle im Code, wenn es eine gibt - sonst "offen">
```

Steht dort schon ein Punkt mit **demselben** Befund, ergänze nur Messung und Uhrzeit — kein zweiter Eintrag, sonst verhungern die älteren. Committe nur diese Datei (`git add nodes/BAUSTELLEN.md`, nie `git add -A`), vor dem Push `git pull --rebase`.

In diesem Loop wird **nicht am Bot herumrepariert**. Er misst, berichtet und schreibt Aufträge; die Reparatur ist Sache von Loop 1 und 2.

**4. Erst jetzt den Bericht ausgeben** — er ist das einzige, was im Chat steht. Kein Vorwort, keine Werkzeugkommentare, nichts über deine eigene Arbeit.

```
**HH:MM — BitNode <n>, <Phase>**

Rückblick
- <je ein Stichpunkt pro Ziel der letzten halben Stunde: erreicht / verfehlt / überholt, mit der Zahl die es belegt>

Lage
- <Träger>: <Wert> (<Delta seit dem letzten Report>)
- <die zwei bis drei Zahlen, die gerade zählen — nicht alle, die es gibt>

Nächste 30 Minuten
1. <Ziel>
2. <Ziel>
3. <Ziel>
```

Regeln für den Bericht:
- **Höchstens 16 Zeilen, Leerzeilen mitgezählt.** Reicht das nicht, kürze in dieser Reihenfolge: erst die Lage-Zahlen auf zwei, dann den Rückblick zu einer Zeile („2 von 3 erreicht, verfehlt: `<Ziel>` (`<Zahl>`)"). **Der Rückblick entfällt nie.**
- Keine Tabellen, keine Vorrede, keine Erklärung der Mechanik. Eric kennt das Spiel.
- Die Reflexion ist **ehrlich**. Ein verfehltes Ziel wird als verfehlt benannt, mit der Zahl daneben. Ein Ziel, das sich als falsch herausgestellt hat, wird als falsch benannt — nicht stillschweigend durch ein neues ersetzt.
- Ein Befund aus Schritt 3 bekommt eine eigene Zeile unter „Lage" mit dem Zusatz **„→ Auftrag"**, damit Eric sieht, dass er nicht im Bericht versandet.

**Der erste Bericht des Tages (5:00 Uhr) ist ein Nachtbericht.** Zwischen 22:30 und 5:00 wird nicht berichtet — Eric schläft. Der 5-Uhr-Lauf deckt deshalb die ganze Nacht ab: Im Rückblick gehört dazu, was in den sieben Stunden passiert ist (Rangzuwachs, Resets, BitNode-Wechsel, was die Wache eingegriffen hat — nachzulesen in `git log --since="8 hours ago"` und im Abschnitt „Erledigt" von `nodes/BAUSTELLEN.md`). Dafür darf er 20 statt 16 Zeilen haben.

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

Regeln: Systemzeit per `date`, nie schätzen. Keine Augmentierungen von Hand kaufen. NIEMALS einen zweiten Tab auf bitburner-official.github.io öffnen. Kein b1tflum3, kein Destroy-Knopf.
