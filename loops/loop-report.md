# Loop 3: der Stundenreport

*Seit dem 29.08.2026, 10:25 auf Erics ausdrueckliche Ansage radikal gekuerzt:
„so detaillierte Zwischenberichte interessieren mich nicht. Stelle saemtliche
outputs in dieser Session ab, und reporte einfach nur die ETA bis zum naechsten
Bitnode reset und die Angabe, was der naechste sein wird. 1x die Stunde reicht
- sonst nichts."*

BITBURNER-REPORT (Loop 3 von 5). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

**Dieser Loop ist die EINZIGE Ausnahme vom Lautlos-Schalter.** `data/lautlos`
liegt dauerhaft; Loop 1, 2, 4 und 5 schweigen deshalb vollstaendig. Du gibst
trotzdem aus - aber nur die zwei Zeilen unten.

**1. Messen** (Systemzeit per `date`, nie schaetzen):

```
date
cd /c/Users/erche/Desktop/claude_projecto/bitburner && node tools/strategie-check.js
head -60 nodes/KURS.md
```

Die ETA steht in `nodes/KURS.md` im obersten Eintrag. Ist sie aelter als zwei
Stunden oder passt sie nicht zum aktuellen Traegerwert, rechne sie neu:

- **Phase „Tor zur Division"**: Restsumme der vier Kampfwerte aus
  `data/bblage.json` (ueber die Bruecke lesen), geteilt durch die gemessene
  Erfahrungsrate. Bedarf je Wert: `exp(100) = e^((100/(m*0,4)+200)/32) - 534,6`
  mit m = dem jeweiligen Aug-Multiplikator.
- **Phase Bladeburner-Rang**: Restrang aus `nodes/KURS.md` durch die
  geglaettete Rangrate (mindestens 45 Minuten Fenster, `data/blade.json`).

Die ETA ist die Zeit bis zum **naechsten BitNode-Reset**, also bis der Knoten
abgeschlossen ist - nicht bis zum naechsten Zwischenschritt.

**2. Der naechste Knoten** steht in `nodes/AUDIT-ROADMAP-2026-08-24.md`,
Abschnitt „2. Empfohlene Reihenfolge". Die Reihenfolge ist fest. Stand
29.08.2026: BitNode 10 laeuft als Lauf 1 von 3 (Plaetze 3-5), der naechste
Reset fuehrt also **wieder nach BitNode 10**, Lauf 2 von 3.

**3. Ausgeben - genau zwei Zeilen, nichts sonst:**

```
ETA <BitNode-Wechsel>: <Spanne oder Zeitpunkt>
Danach: BitNode <n> (Lauf <x> von 3)
```

Keine Ueberschrift, kein Rueckblick, keine Lage, keine Ziele, keine Erklaerung,
kein Kommentar zur eigenen Arbeit. Wenn sich seit der letzten Stunde nichts
Nennenswertes geaendert hat, sind es trotzdem dieselben zwei Zeilen - Eric
will sie stuendlich sehen, nicht nur bei Aenderungen.

**Ausnahme, und nur diese:** Ein BitNode-Wechsel oder ein Reset gehoert in die
Ausgabe, mit einer dritten Zeile. Danach wieder zwei.

**4. Befunde gehen in die Dateien, nicht in den Chat.** Faellt etwas auf, das
nicht stimmt, trag es in `nodes/BAUSTELLEN.md` unter `## Sofort` ein (Befund,
gemessene Zahl, erwarteter Wert, Verdacht auf die Fundstelle) und committe nur
diese Datei. Im Chat steht davon nichts.

**Echte Katastrophen gehen per ntfy**, nicht in den Chat:
`~/.claude/notify.sh --title "Bitburner" --tag rotating_light --priority high "<kurzer Betreff>"`.
Katastrophe heisst: Der Bot steht und kommt ohne Eric nicht wieder hoch, der
Pruefer ist abgestuerzt, oder ein Lauf ist verloren. Nicht: eine gefallene
Rate, ein Werkzeug das neu gestartet werden musste, ein neuer Befund.

**Hintergrundtasks legen die Loops still.** Ein schwebender
`run_in_background`-Task oder Monitor blockiert ALLE Cron-Jobs der Sitzung bis
zu seinem Ende; verpasste Feuerungen verfallen. Warteschleifen nur mit harter
Grenze und unter 120 s, Monitor nie `persistent: true`.

Regeln: Keine Augmentierungen von Hand kaufen. NIEMALS einen zweiten Tab auf
bitburner-official.github.io oeffnen. Kein b1tflum3, kein Destroy-Knopf.
