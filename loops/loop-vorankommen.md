# Loop 2: Vorankommen

*Alles ab der nächsten Zeile ist der Prompt und wird wörtlich an CronCreate übergeben.*

BITBURNER-VORANKOMMEN (Loop 2 von 3). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

Loop 1 bewacht den laufenden Betrieb, Loop 3 berichtet. DIESER Loop bringt das Projekt voran. Ziel des Projekts: alle 15 BitNodes bis Level 3, aktuell BitNode 6 (Ausgang über 21 Black Operations, nicht über das Hackniveau).

Arbeite so:

1. Lies `nodes/BAUSTELLEN.md`. Das ist die verbindliche Arbeitsliste.
2. **Steht unter `## Sofort` etwas anderes als das Wort `keine`, ist das dein Punkt.** Ohne Abwägung, ohne Reihenfolgediskussion — dort tragen der Reportloop und die Wache ein, was sie kaputt vorgefunden, aber nicht selbst behoben haben. Sind es mehrere, nimm den obersten.
   Sonst: Nimm **genau EINEN** Punkt aus `## Offen` — den dringlichsten, der jetzt bearbeitbar ist. Ein Punkt, der auf ein Ereignis wartet (z. B. der Zwei-Stunden-Kontrollpunkt wartet auf seinen Zeitpunkt), wird übersprungen, nicht angefangen.
3. Arbeite ihn ab oder bring ihn ein Stück weiter. Konkrete Arbeit heißt: messen, Code ändern, im Spiel prüfen — nicht planen.
4. Schreib das Ergebnis in BAUSTELLEN.md zurück. Erledigtes wandert nach unten in den Abschnitt "Erledigt", mit Datum und Commit-Kennung — auch ein abgeräumter `## Sofort`-Punkt; steht danach nichts mehr dort, schreib wieder `keine` hin. Neue Befunde kommen oben in die Liste, mit Fundstelle und Dringlichkeit.
5. Committen und pushen — jede Änderung, ohne Rückfrage (steht so in der globalen CLAUDE.md).

Prüfe außerdem bei jedem Lauf kurz: Meldet `data/bblage.json` inzwischen `inBladeburner: true`? Wenn ja und der Zeitpunkt steht noch nicht in BAUSTELLEN.md, trag ihn dort ein — der Zwei-Stunden-Kontrollpunkt aus nodes/ROUTE.md hängt daran, und er ist das wertvollste Einzelergebnis der nächsten Tage.

Ausgabe im Chat: **höchstens 4 Stichpunkte.** Woran gearbeitet, was gemessen, was geändert, was als Nächstes. Ist gerade nichts bearbeitbar, genügt ein Satz.

Regeln: Systemzeit per `date`. Keine Augmentierungen von Hand kaufen. NIEMALS einen zweiten Tab auf bitburner-official.github.io öffnen. Kein b1tflum3, kein Destroy-Knopf. Änderungen an der BitNode-REIHENFOLGE sind Erics Entscheidung — vorschlagen, nicht selbst umsetzen.
