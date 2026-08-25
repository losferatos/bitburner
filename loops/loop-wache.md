# Loop 1: Wache

*Alles ab der nächsten Zeile ist der Prompt und wird wörtlich an CronCreate übergeben.*

BITBURNER-WACHE (Loop 1 von 3). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

Führe genau das aus:

```
cd /c/Users/erche/Desktop/claude_projecto/bitburner && node tools/strategie-check.js
```

Die letzte Zeile ist das Urteil. Handle danach:

- URTEIL: SPUR — Alles in Ordnung. **Gib NICHTS im Chat aus.** Antworte mit einem einzigen kurzen Satz und beende den Turn. Keine Zahlen, keine Zusammenfassung.

- URTEIL: BLIND — Die Lage ist nicht messbar. Prüfe in dieser Reihenfolge:
  1. Brücke tot? `curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:8795/api/wache` — bei 000 neu starten mit `node sync/bridge.js > "$TEMP/bridge.log" 2>&1 &`, 5 s warten, erneut prüfen.
  2. Brücke lebt, aber bn4net-Telemetrie ist alt? Dann steht der Motor im Spiel. Das kann von außen NICHT repariert werden — der einzige Startkanal (data/task.txt) wird von bn4net selbst gelesen. Dann: `~/.claude/notify.sh --title "Bitburner" --tag warning --priority high "Bot steht - bitte 'run boot.js' im Spielterminal eintippen"` und im Chat in zwei Zeilen sagen, was Eric tun soll.

- URTEIL: STOERUNG — Der Bot hat data/hilfe.txt geschrieben. Lies den Text, behebe die Ursache im Code wenn möglich, leere danach hilfe.txt über die Brücke (pushFile mit leerem content). Melde in max. 3 Stichpunkten.

- URTEIL: STAGNATION — Der Träger bewegt sich nicht. Das ist der Fall, für den dieser Loop existiert. Diagnostiziere selbst:
  - `curl -s -m 8 -G "http://localhost:8795/api/rpc" --data-urlencode "method=pushFile" --data-urlencode "filename=data/task.txt" --data-urlencode 'content=["ps.js"]' --data-urlencode "server=home"`, 22 s warten, dann data/ps.json lesen — welche Werkzeuge laufen, welche fehlen?
  - Vergleiche gegen die Phase aus dem Prüfer. In BitNode 6 gilt: solange inBladeburner false ist, MUSS bbtrain.js laufen und die Arbeit muss ein Gym in Sector-12 sein. Danach trägt blade.js.
  - Ein Werkzeug neu starten: pushFile nach data/reload.txt mit Inhalt `WERKZEUG <name>`.
  - Greife in den Code ein, wenn die Ursache dort liegt. Committen und pushen ist ausdrücklich erlaubt und erwünscht.
  - Melde in max. 4 Stichpunkten: Befund, Ursache, Eingriff, Erwartung.

Regeln: Systemzeit per `date`, nie schätzen. Keine Augmentierungen von Hand kaufen. NIEMALS einen zweiten Tab auf bitburner-official.github.io öffnen. Kein b1tflum3, kein Destroy-Knopf. Keine Wall of Text — Eric will Stichpunkte.
