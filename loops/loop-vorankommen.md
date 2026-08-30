# Loop 2: Vorankommen

*Alles ab der nächsten Zeile ist der Prompt und wird wörtlich an CronCreate übergeben.*

BITBURNER-VORANKOMMEN (Loop 2 von 6). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

**LAUTLOS-SCHALTER — als Allererstes pruefen.** Fuehre `test -f data/lautlos && echo LAUTLOS` aus. Kommt `LAUTLOS`, gibst du in diesem Lauf **nichts im Chat aus**: kein Bericht, kein Stichpunkt, kein Wort, keine Zahl. Du arbeitest ganz normal weiter — alle Befunde und Ergebnisse gehen in die Dateien (`nodes/BAUSTELLEN.md`, `nodes/KURS.md`, `nodes/HEBEL.md`, Commits), nicht in den Chat. Per ntfy meldest du dann nur noch, was keinen Aufschub duldet: Bot steht, Pruefer abgestuerzt, BitNode-Wechsel oder Reset. Alles andere wartet bis zum Morgen. Der Schalter ist Erics Nachtruhe; die Datei wird geloescht, wenn er sich meldet.

Loop 1 bewacht den laufenden Betrieb, Loop 3 berichtet. DIESER Loop bringt das Projekt voran. Ziel des Projekts: alle 15 BitNodes bis Level 3. **In welchem Knoten der Lauf gerade steht und wie sein Ausgang aussieht, steht in `nodes/KURS.md`** — lies das, statt es aus diesem Prompt zu nehmen. Bis zum 28.08.2026 stand hier fest „aktuell BitNode 6“; nach dem Wechsel nach BitNode 10 um 17:05 war der Satz falsch, und ein Prompt, der die Lage behauptet statt sie zu lesen, veraltet bei jedem Knotenwechsel erneut.

Arbeite so:

1. Lies `nodes/BAUSTELLEN.md`. Das ist die verbindliche Arbeitsliste.
2. **Ein Arbeitspunkt ist eine Zeile, die mit `### ` beginnt** — nur solche zählen. Steht unter `## Sofort` keine `### `-Zeile, ist der Abschnitt leer.
   Steht dort eine, ist das dein Punkt. Ohne Abwägung, ohne Reihenfolgediskussion — dort tragen Reportloop und Wache ein, was sie kaputt vorgefunden, aber nicht selbst behoben haben. Sind es mehrere, nimm den obersten.
   Sonst: den obersten `### `-Punkt aus `## Offen`, dessen Überschrift nicht mit „Wartet bis" beginnt. **Die Reihenfolge in der Datei IST die Rangfolge** — nicht neu bewerten, nicht umsortieren.
**Vorher `## ENTSCHIEDEN` im Kopf von `nodes/BAUSTELLEN.md` lesen.** Dort
steht, was bereits belegt entschieden ist - mit Zahl und Fundstelle. Wer
eine dieser Sachen aendern will, braucht eine **neue Messung oder eine neue
Fundstelle**, nicht ein neues Argument. Sonst entsteht Fehler-Ping-Pong:
heute einbauen, was vorgestern evidenzbasiert entfernt wurde (Erics Ansage
vom 29.08.2026).

3. Arbeite ihn ab oder bring ihn ein Stück weiter. Konkrete Arbeit heißt: messen, Code ändern, im Spiel prüfen — nicht planen.

   **Nachschlagen schlägt messen.** Der vollständige Spielquellcode liegt unter `reference/bitburner-src/src/` (v3.0.2). Wo eine Zahl dort steht, wird sie gelesen, nicht über ein Zeitfenster geschätzt — das ist schneller und verlässlicher. Am 27.08. kostete die umgekehrte Reihenfolge einen ganzen Tag: Die 400.000 Rang des Knotenausgangs standen in `Bladeburner/data/BlackOperations.ts`, während vier Loops auf Telemetrie optimierten. Bewährte Pfade: `Bladeburner/`, `Bladeburner/data/`, `BitNode/BitNode.tsx`, `PersonObjects/formulas/`, `Formulas.ts`.

   **Eine Vermutung über dieses Spiel ist meistens falsch.** Fünf Minuten `grep` sind billiger als drei Stunden Messen — und billiger als ein Eintrag, der später zurückgenommen werden muss. Am 27.08. wurden vier eigene Rechenfehler auf diese Weise gefunden, drei davon in bereits geschriebenen Befunden.
4. **Bevor du einen Punkt abhakst, zwei Fragen:**
   - *Ist es wirklich behoben?* Nach Erledigt wandert nur, was eine Zeile `Verifiziert: <Zahl> um <HH:MM>` trägt — eine Messung nach der Änderung, nicht die Änderung selbst. Ein Punkt, den du geändert, aber nicht nachgemessen hast, bleibt stehen und bekommt die Zeile `Geaendert <HH:MM>, Wirkung noch nicht gemessen`. Am 25.08. wurde ein Sofort-Punkt vier Minuten nach dem Eintrag abgehakt, während die Zahl unverändert danebenstand.
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

   - *Gab es das schon einmal?* Sieh in `nodes/ERLEDIGT.md` nach — **gezielt greppen, nicht lesen**: `grep -n -A12 "<stichwort>" nodes/ERLEDIGT.md`. Die Datei ist das Archiv (seit 27.08. ausgelagert, weil die Arbeitsliste sonst die 2.000-Zeilen-Grenze des Lesewerkzeugs gerissen hätte). Findet sich ein ähnlicher Fall, wurde beim ersten Mal ein Symptom behoben und nicht die Ursache. Dann trag den **strukturellen** Punkt unter `## Offen` ein, statt den Einzelfall ein zweites Mal zu flicken. Beispiel vom 25.08.: erst `bn4life`, dann `bn4rep` — beide unterbrachen Bladeburner-Aktionen, beide wurden einzeln geflickt.

5. Schreib das Ergebnis zurück. **Erledigtes wandert nach `nodes/ERLEDIGT.md`** — oben hinein, mit Datum und Commit-Kennung — auch ein abgeräumter `## Sofort`-Punkt; steht danach nichts mehr dort, schreib wieder `keine` hin. Neue Befunde kommen oben in die Liste, mit Fundstelle und Dringlichkeit.
6. Committen und pushen — jede Änderung, ohne Rückfrage (steht so in der globalen CLAUDE.md). Aber: **nur anfassen, was du selbst geändert hast** (`git add <pfad>`, nie `git add -A`) — drei Loops schreiben in dieselben Dateien. Vor dem Push `git pull --rebase`; bei einem Konflikt in `nodes/BAUSTELLEN.md` gilt: beide Abschnitte behalten, nichts verwerfen.

Spieldateien (`data/bblage.json`, `data/ps.json`, `data/blade.json`) liegen **nicht** auf der Platte — ein `cat` schlägt fehl, obwohl alles läuft. Lesen ausschließlich über die Brücke:
```
curl -s -m 8 -G "http://localhost:8795/api/rpc" --data-urlencode "method=getFile" --data-urlencode "filename=data/bblage.json" --data-urlencode "server=home"
```

Prüfe außerdem bei jedem Lauf kurz: Meldet `data/bblage.json` inzwischen `inBladeburner: true`? Wenn ja und der Zeitpunkt steht noch nicht in BAUSTELLEN.md, trag ihn dort ein — der Zwei-Stunden-Kontrollpunkt aus nodes/ROUTE.md hängt daran, und er ist das wertvollste Einzelergebnis der nächsten Tage.

Ausgabe im Chat: **höchstens 4 Stichpunkte.** Woran gearbeitet, was gemessen, was geändert, was als Nächstes. Ist gerade nichts bearbeitbar, genügt ein Satz.

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

Regeln: Systemzeit per `date`. Keine Augmentierungen von Hand kaufen. NIEMALS einen zweiten Tab auf bitburner-official.github.io öffnen. Kein b1tflum3, kein Destroy-Knopf. Die BitNode-Reihenfolge steht fest (Fables Analyse, `nodes/AUDIT-ROADMAP-2026-08-24.md`) und wird nicht geändert — auch nicht vorgeschlagen.
