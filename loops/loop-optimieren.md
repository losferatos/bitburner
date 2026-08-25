# Loop 4: Optimieren

*Alles ab der nächsten Zeile ist der Prompt und wird wörtlich an CronCreate übergeben.*

BITBURNER-OPTIMIEREN (Loop 4 von 4). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

Die anderen drei Loops halten den Betrieb: Loop 1 greift bei Störungen ein, Loop 2 arbeitet gemeldete Befunde ab, Loop 3 berichtet. Alle drei sind **reaktiv** — sie machen den Bot wieder heil, nicht besser.

Dieser Loop ist der einzige, der fragt: **Was begrenzt uns gerade, und lässt sich das heben?** Ziel des Projekts sind 45 Läufe durch 15 BitNodes. Bei dieser Länge zahlt sich jeder Faktor vielfach aus — und jede Stunde, die niemand nach ihm sucht, ist verschenkt.

## Ablauf

**1. Den Engpass finden — nicht das Naheliegende.**

```
date
cd /c/Users/erche/Desktop/claude_projecto/bitburner && node tools/strategie-check.js
cat nodes/HEBEL.md
```

Spieldateien liegen **nicht** auf der Platte, sondern nur im Spiel. Lesen über die Brücke:
```
curl -s -m 8 -G "http://localhost:8795/api/rpc" --data-urlencode "method=getFile" --data-urlencode "filename=data/blade.json" --data-urlencode "server=home"
```
Nützlich sind je nach Phase `data/blade.json`, `data/bblage.json`, `data/bn4net.json`, `data/bbspann.json` und `data/werkbank.json`. Die letzten beiden musst du über den Auftragskanal anstoßen (`pushFile` nach `data/task.txt` mit `["bbspann.js"]`, 26 s warten) — vorher prüfen, ob der Kanal frei ist, er hat genau einen Leser.

Die Leitfrage: **Welche Zahl bringt den Knoten näher an seinen Ausgang, und was begrenzt sie gerade?** In BitNode 6 ist das der Bladeburner-Rang. Eine Verbesserung der Hackrate wäre dort messbar richtig und strategisch wertlos.

Quellen, in dieser Reihenfolge:
1. Die Telemetrie — was der Bot tatsächlich tut
2. `doku/formeln-*.md` und `doku/auffaellige-werte.md` — was daran schon verstanden ist
3. `reference/bitburner-src/src/` — der Spielquellcode, wenn die Doku schweigt. Dort stehen die echten Formeln; grep ist schneller als raten. Beispiele, die sich bewährt haben: `Bladeburner/`, `Hacking.ts`, `Formulas.ts`, `Server/`, `PersonObjects/`.

**2. Eine Hypothese formulieren, die eine Zahl nennt.**

„Wenn ich X ändere, steigt Y von <jetzt> auf mindestens <erwartet>." Ohne beide Zahlen keine Änderung — sonst lässt sich hinterher nicht sagen, ob es gewirkt hat.

Prüfe die Hypothese am Quellcode, bevor du sie umsetzt. Die meisten Vermutungen über dieses Spiel sind falsch, und eine widerlegte Hypothese kostet fünf Minuten Lesen statt drei Stunden Messen.

**3. Umsetzen — mit denselben Grenzen wie die Wache.**

- Höchstens **eine Datei** je Lauf.
- `src/bn4net.js` und `src/boot.js` nie ohne Erics ausdrückliche Freigabe. Das sind Motor und Wiederanlauf; ein Fehler dort kostet den ganzen Lauf.
- Nach jeder Änderung an `tools/strategie-check.js`: `node tools/strategie-check.js` ausführen. Endet die Ausgabe nicht auf `URTEIL:`, sofort `git checkout --` und nichts committen.
- Werkzeug im Spiel neu starten: `pushFile` nach `data/reload.txt` mit `WERKZEUG <name>`.
- Findest du in **fünfzehn Minuten** keinen belegten Hebel: nichts ändern. Schreib in HEBEL.md, was du geprüft und verworfen hast, und beende den Turn. Das ist ein gültiges Ergebnis — eine erfundene Optimierung ist schlechter als keine.

**4. Protokollieren — das ist der Teil, der diesen Loop von Bastelei trennt.**

Trag den Hebel oben in `nodes/HEBEL.md` ein:

```
### <Was geändert wurde> (<TT.MM.>, <HH:MM>)
Engpass: <welche Zahl begrenzt, und woran man das sieht>
Hypothese: <Y steigt von A auf mindestens B, weil ...>
Beleg: <Fundstelle im Spielquellcode oder in doku/>
Vorher: <Zahl> um <HH:MM>
Nachher: (offen — nächster Lauf misst)
Commit: <kennung>
```

**Beim nächsten Lauf zuerst die offenen Einträge nachmessen**, bevor du einen neuen Hebel suchst. Ist die Zahl nicht gestiegen, trag das ein und nimm die Änderung zurück (`git revert`). Der Eintrag bleibt stehen: Eine widerlegte Hypothese verhindert, dass jemand dieselbe in zwei Wochen noch einmal probiert.

**5. Committen und pushen.** Nur was du selbst geändert hast (`git add <pfad>`, nie `git add -A`) — vier Loops schreiben in dieselben Dateien. Vor dem Push `git pull --rebase`.

## Ausgabe

**Höchstens 3 Stichpunkte:** welcher Engpass, welche Änderung mit welcher erwarteten Zahl, was der letzte Hebel gebracht hat. Läuft der Lauf ohne Änderung aus, genügt ein Satz.

Nachts (23–5 Uhr) arbeitest du normal weiter, gibst aber nichts im Chat aus außer einer Zeile — Eric liest es am Morgen im Protokoll.

Regeln: Systemzeit per `date`, nie schätzen. Keine Augmentierungen von Hand kaufen. NIEMALS einen zweiten Tab auf bitburner-official.github.io öffnen. Kein b1tflum3, kein Destroy-Knopf. Änderungen an der BitNode-Reihenfolge sind Erics Entscheidung — vorschlagen, nicht umsetzen.
