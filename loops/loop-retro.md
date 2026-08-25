# Loop 4: Retrospektive

*Alles ab der nächsten Zeile ist der Prompt und wird wörtlich an CronCreate übergeben.*

BITBURNER-RETRO (Loop 4 von 4). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

Die anderen drei Loops prüfen den **Bot**. Dieser prüft die **Loops**.

Er existiert wegen eines Befunds vom 25.08.2026: An diesem Nachmittag wurden vier echte Fehler behoben — aber zwei davon hat Eric gemeldet, nicht ein Loop. Die sich sekündlich wiederholenden Spieldialoge kamen im Weltbild des Prüfers schlicht nicht vor, weil er den Rang misst und keine Dialoge. **Ein Loop findet nur, wonach er sucht.** Wenn niemand die Suchmuster erweitert, fängt die Automatik für immer genau die Fehlerarten, die sie am ersten Tag kannte.

Deine Datengrundlage — sie liegt vollständig in Dateien, du brauchst kein Gedächtnis:

```bash
cd /c/Users/erche/Desktop/claude_projecto/bitburner
date
git log --since="1 day ago" --format="%h %ad %s" --date=format:"%d.%m %H:%M"
sed -n '/## Erledigt/,$p' nodes/BAUSTELLEN.md
cat nodes/RETRO.md
node -e "const v=require('fs').readFileSync('data/verlauf-strategie.json','utf8');const p=JSON.parse(v).punkte.slice(-30);console.log(p.map(x=>new Date(x.zeit).toTimeString().slice(0,5)+' '+x.traeger+'='+x.wert).join('\n'))"
```

Beantworte damit **genau drei Fragen** und handle nach jeder:

**1. Welcher Fehler wurde von einem Menschen gemeldet statt von einem Loop?**
Suche in `nodes/BAUSTELLEN.md` und in den Commit-Texten nach Formulierungen wie „Eric meldete", „Popups", „ist mir aufgefallen". Für jeden solchen Fall: Welche messbare Größe hätte ihn verraten? Ergänze `tools/strategie-check.js` um genau diese Prüfung. Das ist der wichtigste Schritt dieses Loops — jede solche Ergänzung macht die Automatik dauerhaft ein Stück eigenständiger.

**2. Welcher Befund kam mehr als einmal?**
Zweimal derselbe Fehler an verschiedenen Stellen heißt: Es wurde ein Symptom behoben, nicht die Ursache. Beispiel vom 25.08.: Erst `bn4life`, dann `bn4rep` — beide unterbrachen Bladeburner-Aktionen, beide wurden einzeln geflickt. Die Ursache dahinter (mehrere Skripte greifen ungeregelt auf dieselbe Spielfigur zu) blieb unangetastet. Findest du so ein Muster, trag es in `nodes/BAUSTELLEN.md` unter `## Offen` ein — als *strukturellen* Punkt, nicht als weiteren Einzelfall.

**3. Welcher Loop hat danebengelegen?**
Hat ein Loop „alles gut" gemeldet, während etwas stillstand? Hat er etwas gemeldet, das gar kein Problem war? Beides ist ein Fehler im Prompt oder im Prüfer, nicht im Bot. Ändere die betroffene Datei in `loops/` — und lege den zugehörigen Cron-Job neu an, sonst läuft die alte Fassung weiter:
- `CronList` → den Job finden, dessen Prompt mit dem passenden `BITBURNER-`-Wort beginnt
- `CronDelete` mit seiner ID
- `CronCreate` mit dem Dateiinhalt ab der ersten `BITBURNER-`-Zeile, gleicher cron-Ausdruck, `recurring: true`

**Sicherungen — das hier ist ein Loop, der Loops ändert:**
- **Höchstens EINE Änderung je Lauf.** Lieber drei Läufe für drei Verbesserungen als ein Lauf, nach dem niemand mehr weiß, welche gewirkt hat.
- **Diesen Loop selbst nie ändern.** Wer sich selbst umschreibt, hat keinen festen Punkt mehr.
- **Nie einen Loop ersatzlos löschen.**
- **Immer committen und pushen** — das ist die Rücknahmemöglichkeit.
- Findest du nichts zu verbessern, ist das ein gültiges Ergebnis. Schreib es hin und ändere nichts. Eine erfundene Verbesserung ist schlechter als keine.

**Protokoll:** Häng das Ergebnis unten an `nodes/RETRO.md` an — Datum, die drei Antworten in je ein bis zwei Sätzen, und was du geändert hast. Diese Datei ist das Gedächtnis der Automatik über ihre eigene Entwicklung; ohne sie prüft der nächste Lauf dieselben Dinge noch einmal.

**Ausgabe im Chat: höchstens 3 Stichpunkte.** Was gefunden, was geändert, was bewusst nicht.

Regeln: Systemzeit per `date`, nie schätzen. Keine Augmentierungen von Hand kaufen. NIEMALS einen zweiten Tab auf bitburner-official.github.io öffnen. Kein b1tflum3, kein Destroy-Knopf. Änderungen an der BitNode-Reihenfolge sind Erics Entscheidung — vorschlagen, nicht umsetzen.
