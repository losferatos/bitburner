### Autosave steht

**FEHLALARM DER BRUECKE, behoben am 04.09.2026 01:45.** Das Autosave stand nie.

Der Eintrag entstand um 01:37 aus dem Urteil (c) der neu gebauten Bruecke und ist
ein Konstruktionsfehler, den ein Skeptiker-Lauf noch am selben Abend fand:

Das Urteil verglich `state.lastSaveAt` gegen die aktuelle Uhrzeit und schlug bei
mehr als fuenf Minuten Differenz an. `state.lastSaveAt` wird aber nur alle **zehn**
Minuten aufgefrischt (`pruefeLastSave`, Takt `SAVE_ALTER_MS`). Die Schwelle war
also kleiner als der Auffrischtakt: das Urteil musste auf einem kerngesunden Spiel
feuern, garantiert, alle sechs Stunden.

Es ist derselbe Fehler wie beim alten `lastTelemetryAt`, nur spiegelverkehrt.
Dort log der Zeitstempel des Abrufs statt des Inhalts, weshalb das Urteil
„Tab eingefroren" nie ausloesen konnte. Hier loeste es immer aus. Beide vergiften
denselben Kanal, den fuer echte Notfaelle: eine Zeile unter `## Sofort`, die
regelmaessig grundlos erscheint, wird nach dem dritten Mal ueberlesen.

**Behoben:** Das Alter wird jetzt gegen den Zeitpunkt der Messung gerechnet
(`state.lastSaveGemessenAm`), nicht gegen die aktuelle Uhrzeit. Damit misst das
Urteil, was es messen soll — wie alt der letzte Speichervorgang **zum Zeitpunkt
der Beobachtung** war.

Gegenprobe zum Zustand an diesem Abend: `lastSave` lag bei jeder Messung unter
einer Minute hinter der Beobachtung, `AutosaveInterval` steht auf 60, und das
Spiel hat zwischen 01:04 und 01:45 durchgehend gespeichert (nachweisbar an sieben
Sicherungen mit monoton steigender `totalPlaytime`).
