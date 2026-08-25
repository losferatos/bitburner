# Loop 2: Vorankommen

*Alles ab der nächsten Zeile ist der Prompt und wird wörtlich an CronCreate übergeben.*

BITBURNER-VORANKOMMEN (Loop 2 von 3). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

Loop 1 bewacht den laufenden Betrieb, Loop 3 berichtet. DIESER Loop bringt das Projekt voran. Ziel des Projekts: alle 15 BitNodes bis Level 3, aktuell BitNode 6 (Ausgang über 21 Black Operations, nicht über das Hackniveau).

Arbeite so:

1. Lies `nodes/BAUSTELLEN.md`. Das ist die verbindliche Arbeitsliste.
2. **Ein Arbeitspunkt ist eine Zeile, die mit `### ` beginnt** — nur solche zählen. Steht unter `## Sofort` keine `### `-Zeile, ist der Abschnitt leer.
   Steht dort eine, ist das dein Punkt. Ohne Abwägung, ohne Reihenfolgediskussion — dort tragen Reportloop und Wache ein, was sie kaputt vorgefunden, aber nicht selbst behoben haben. Sind es mehrere, nimm den obersten.
   Sonst: den obersten `### `-Punkt aus `## Offen`, dessen Überschrift nicht mit „Wartet bis" beginnt. **Die Reihenfolge in der Datei IST die Rangfolge** — nicht neu bewerten, nicht umsortieren.
3. Arbeite ihn ab oder bring ihn ein Stück weiter. Konkrete Arbeit heißt: messen, Code ändern, im Spiel prüfen — nicht planen.
4. **Bevor du einen Punkt abhakst, zwei Fragen:**
   - *Ist es wirklich behoben?* Nach Erledigt wandert nur, was eine Zeile `Verifiziert: <Zahl> um <HH:MM>` trägt — eine Messung nach der Änderung, nicht die Änderung selbst. Ein Punkt, den du geändert, aber nicht nachgemessen hast, bleibt stehen und bekommt die Zeile `Geaendert <HH:MM>, Wirkung noch nicht gemessen`. Am 25.08. wurde ein Sofort-Punkt vier Minuten nach dem Eintrag abgehakt, während die Zahl unverändert danebenstand.
   - *Gab es das schon einmal?* Steht unter „Erledigt" ein ähnlicher Fall, wurde beim ersten Mal ein Symptom behoben und nicht die Ursache. Dann trag den **strukturellen** Punkt unter `## Offen` ein, statt den Einzelfall ein zweites Mal zu flicken. Beispiel vom 25.08.: erst `bn4life`, dann `bn4rep` — beide unterbrachen Bladeburner-Aktionen, beide wurden einzeln geflickt.

5. Schreib das Ergebnis in BAUSTELLEN.md zurück. Erledigtes wandert nach unten in den Abschnitt "Erledigt", mit Datum und Commit-Kennung — auch ein abgeräumter `## Sofort`-Punkt; steht danach nichts mehr dort, schreib wieder `keine` hin. Neue Befunde kommen oben in die Liste, mit Fundstelle und Dringlichkeit.
6. Committen und pushen — jede Änderung, ohne Rückfrage (steht so in der globalen CLAUDE.md). Aber: **nur anfassen, was du selbst geändert hast** (`git add <pfad>`, nie `git add -A`) — drei Loops schreiben in dieselben Dateien. Vor dem Push `git pull --rebase`; bei einem Konflikt in `nodes/BAUSTELLEN.md` gilt: beide Abschnitte behalten, nichts verwerfen.

Spieldateien (`data/bblage.json`, `data/ps.json`, `data/blade.json`) liegen **nicht** auf der Platte — ein `cat` schlägt fehl, obwohl alles läuft. Lesen ausschließlich über die Brücke:
```
curl -s -m 8 -G "http://localhost:8795/api/rpc" --data-urlencode "method=getFile" --data-urlencode "filename=data/bblage.json" --data-urlencode "server=home"
```

Prüfe außerdem bei jedem Lauf kurz: Meldet `data/bblage.json` inzwischen `inBladeburner: true`? Wenn ja und der Zeitpunkt steht noch nicht in BAUSTELLEN.md, trag ihn dort ein — der Zwei-Stunden-Kontrollpunkt aus nodes/ROUTE.md hängt daran, und er ist das wertvollste Einzelergebnis der nächsten Tage.

Ausgabe im Chat: **höchstens 4 Stichpunkte.** Woran gearbeitet, was gemessen, was geändert, was als Nächstes. Ist gerade nichts bearbeitbar, genügt ein Satz.

Regeln: Systemzeit per `date`. Keine Augmentierungen von Hand kaufen. NIEMALS einen zweiten Tab auf bitburner-official.github.io öffnen. Kein b1tflum3, kein Destroy-Knopf. Änderungen an der BitNode-REIHENFOLGE sind Erics Entscheidung — vorschlagen, nicht selbst umsetzen.
