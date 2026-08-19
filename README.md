# Bitburner Autopilot

Ein autonom spielender Bot fuer [Bitburner](https://bitburner-official.github.io/) v3.0.1
(Webversion, BitNode 1). Die Skripte laufen im Spiel, die Bruecke auf diesem Rechner
schiebt sie hinein und holt den Zustand heraus.

## Warum das erlaubt ist

Bitburner ist ein reines Einzelspieler-Spiel, quelloffen (Apache 2.0 mit Commons Clause)
und laeuft vollstaendig im Browser — kein Server, keine Konten, keine Ranglisten, kein
Anti-Cheat. Skripte zu schreiben **ist** das Spielprinzip; die Steam-Beschreibung wirbt
ausdruecklich damit. Die Remote API, ueber die dieses Projekt arbeitet, ist die dafuer
vorgesehene Schnittstelle, und die offizielle Dokumentation listet externe Werkzeuge auf.

## Starten

```
npm install
node sync/bridge.js
```

Dann im Spiel: `Options` → `Remote API`, Hostname `localhost`, Port `12525`, `Connect`.
Eine Wiederverbindungsverzoegerung von 5 Sekunden eintragen — dann findet das Spiel nach
einem Neustart der Bruecke von selbst zurueck.

Danach im Spielterminal einmalig `run autopilot.js`. Ab da haelt sich das System selbst
am Leben.

- **Bruecke und Dashboard:** http://localhost:8795/
- **Lagebericht auf der Kommandozeile:** `node tools/status.js --kauf --netz`
- **Oberflaechen-Fahrplaene:** `node tools/ui.js` (zeigt alle Aufgaben)

## Aufbau

| Ort | Zweck |
|---|---|
| `sync/bridge.js` | Ein Prozess, zwei Aufgaben: Remote-API-Server auf **12525** (das Spiel verbindet sich dorthin) und Dashboard auf **8795**. Schiebt `src/` bei jeder Aenderung ins Spiel, holt Telemetrie heraus, bietet unter `/api/rpc` einen Diagnosedraht. |
| `src/autopilot.js` | Das Gehirn im Spiel. Knackt Rechner, verteilt Arbeiter, waehlt Ziele, zeigt alles in einem Fenster im Spiel. |
| `src/invest.js` | Der Verwalter. Kauft und vergroessert Rechner, betreut das Hacknet und startet den Autopiloten wieder, wenn der sich beendet hat. |
| `src/lib/calc.js` | Die Spielformeln, aus dem Quellcode nachgebaut. Kostet 0 GB, waehrend `Formulas.exe` im Spiel 5 Milliarden kostet. |
| `src/worker/*.js` | Ein-Zweck-Arbeiter (hack/grow/weaken), bewusst winzig — jede zusaetzliche Funktion wuerde tausende Threads verteuern. |
| `doku/` | Aus dem Spielquellcode extrahierte Formeln und Strategie, jede Zahl mit Quellverweis. |
| `tools/` | Lagebericht und Oberflaechen-Fahrplaene fuer die Aufgaben, die kein Skript erledigen kann. |

## Zwei Dinge, die man wissen muss

**Ohne Source File 4 gibt es keine Singularity-API.** Kein Skript kann Programme kaufen,
Faktionen beitreten, arbeiten oder Augmentations installieren. Das geht ausschliesslich
ueber die Oberflaeche — `tools/ui.js` haelt dafuer die genauen Klickfolgen bereit.

**Sechs Schaltflaechen pruefen `event.isTrusted`** und verwerfen programmatische Klicks
kommentarlos, darunter `Join!`, `Create program` und `Work`. Dort helfen nur echte
Eingabeereignisse. Details in `doku/oberflaeche.md`.

## Selbstaktualisierung

Autopilot und Verwalter vergleichen ihren eigenen Quelltext mit dem, was auf `home`
liegt. Trifft eine neue Fassung ein, beendet sich der Prozess, und der jeweils andere
startet ihn neu. Eine Aenderung an `src/` ist damit rund fuenf Sekunden spaeter im Spiel
wirksam, ohne dass jemand eine Terminaleingabe absetzen muss.
