# Alarmliste und Neustartschleife der Bruecke (B08, B05)

Stand 14.11.2026. Code: `sync/alarmliste.js` (Regeln, reines Modul),
`sync/bridge.js` (Haken, Abschnitt "Alarmliste"), `tools/alarme.js`
(Anzeige, Beenden von Hand, einmaliges Aufraeumen), `sync/neustart-grenze.js`
und `sync/bridge-start.cmd` (Neustartschleife). Test: `tools/test-alarme.js`.

## 1. Warum

`## Sofort` in `nodes/BAUSTELLEN.md` war ein Archiv: Auto-Alarme ohne Ablauf,
dieselbe Meldung alle sechs Stunden und nach jedem Brueckenneustart neu,
"Telemetrie veraltet" vom 08.11. stand am 12.11. noch da. Ein Kanal, in dem
alles stehen bleibt, wird nicht mehr gelesen, und dann faellt der echte Alarm
mit durch.

## 2. data/alarme.json

Der Zustand steht in einer Datei, nicht im Speicher der Bruecke. Je Alarm:
Schluessel (dieselbe Ursache = derselbe Alarm, auch bei anderer Zahl im
Titel), Beginn, letzte Wiederholung, Anzahl, Klasse, Messung, Ende.

| Klasse | Beispiele | Endet |
|---|---|---|
| `zustand` | Tab nicht verbunden, Telemetrie veraltet, Autosave steht | Messung, oder 24 h ohne Wiederholung |
| `vorfall` | Base64-Klartext; jeder unbekannte Titel (7 Tage) | Ablauf |
| `schutz` | Sicherung rot, fremdes Spiel abgewiesen, Zweit-Tab, Schub verweigert/verworfen, Master-Riegel blind, Verbindung ohne Anker, Ausgang blockiert | **nur Messung, oder von Hand mit Beleg.** Zeit allein nie. |

Ein Schutzalarm hat kein Ablaufdatum. Ein Schutzalarm, der nach 24 h still
verschwindet, ist ein abgeschalteter Riegel.

### Messungen (Haken in `sync/bridge.js`, `alarmMessung(name, beleg)`)

Eine Messung ohne Beleg (Text, was gemessen wurde) beendet nichts.

| Messung | gemessen wo | beendet |
|---|---|---|
| `sicherung-gruen` | `sichereJetzt` nach gruener Sicherung | Sicherung ausgefallen/abgelehnt, Kein pushAll, Sicherung vor Codeschub fehlgeschlagen, Bruecke ohne Sicherung |
| `socket-verifiziert` | `verifiziereSocket`, identifier und Anker stimmen | Socket abgewiesen, Fremde Spielverbindung, Verifikation fehlgeschlagen, Freigabe verweigert |
| `verbindung-mit-anker` | dasselbe, nur wenn ein Anker vorlag | Verbindung ohne Anker angenommen |
| `schub-ok` | Ende von `schiebeStapel`: etwas ging durch UND Rueckstau (`schub-offen.json`) ist leer | Schub verweigert (Grosser / nicht in master), Schub verworfen |
| `zweittab-frei` | Urteilstakt: `zweittab-alarm.json` nicht mehr da (fail-closed: unlesbar = nicht frei) | Zweite RFA-Verbindung, Schub verweigert - Zweit-Tab-Sperre |
| `master-index-ok` | `ladeMasterIndex`: git liefert wieder Dateien | Master-Riegel blind |
| `tab-verbunden`, `telemetrie-frisch` (<= 5 min), `autosave-frisch` (<= 2 min) | Urteilstakt (60 s) | die jeweiligen Zustandsalarme |

`Ausgang blockiert` kommt aus dem Spiel und hat keine Bruecken-Messung: nur
`node tools/alarme.js --beende <id> --beleg "<was gemessen wurde>"`.

## 3. Verhalten in `## Sofort`

- Ein offener Alarm wird nur EINMAL eingetragen. Wiederholungen zaehlen in
  `alarme.json` (`anzahl`, `zuletzt`), nicht alle 6 h und nicht nach jedem
  Neustart (das waren die 811 Zeilen).
- Der Eintrag traegt eine Fussnote: Alarm-ID, Klasse, Beginn, wie er endet.
- Endet der Alarm, nimmt die Bruecke den Eintrag heraus
  (`tools/liste.js --erledigen` -> `nodes/ERLEDIGT.md`, mit Ende und Beleg).
  Schon von Hand erledigt oder nicht eindeutig: nur eine Warnung im Log.
- Faellt `alarme.json` aus (nicht lesbar), gilt der alte Sechs-Stunden-Weg.
  Eine kaputte Datei wird nach `alarme.json.kaputt-<ms>` beiseitegelegt, nie
  ueberschrieben.
- Der Einzelplatz `state.alarm` (Dashboard, Check-in, `bridge-alarm.json`)
  bleibt; er erlischt jetzt zusaetzlich, wenn die Messung seinen Alarm beendet.
  `/api/state` bekommt das Feld `alarme` (offene, additiv). Das Spiel bekommt
  nichts Neues.

## 4. tools/alarme.js

```
node tools/alarme.js --zeige
node tools/alarme.js --beende <id|schluessel> --beleg "<mind. 12 Zeichen>"
node tools/alarme.js --bereinigen              # Trockenlauf, schreibt nichts
node tools/alarme.js --bereinigen --ausfuehren # einmal, auf der echten Liste
        [--messung <name>=<beleg>] [--wurzel d] [--data d] [--sofort-ordner d]
```

`--bereinigen` raeumt den Altbestand: ERLEDIGT/UEBERHOLT/ENTSCHIEDEN-markierte
Punkte, Momentaufnahmen (Zustand) und aeltere Wiederholungen derselben
Schutz-Ursache gehen nach `ERLEDIGT.md`; der juengste Schutzalarm je Ursache
bleibt und wird in `alarme.json` gefuehrt; von Hand geschriebene Punkte
bleiben (sie brauchen eine Entscheidung). Archiv zuerst, Strukturpruefung wie
`tools/liste.js`, Sicherungskopie der Liste unter `data/alarme-bereinigung/`.
**Die LIVE-`BAUSTELLEN.md` im Hauptbaum nur nach dem Merge und mit Eric
anfassen** - im Worktree nur gegen Kopien testen (so macht es der Test).

## 5. Neustartschleife (B05)

`sync/bridge-start.cmd` startet `node sync\bridge.js --instance LIVE` nach
jedem Absturz neu, **hoechstens `BRIDGE_START_MAX` Neustarts je Stunde**
(Vorgabe 5; `set BRIDGE_START_MAX=8` vor dem Start). Der Zaehler steht in
`sync/neustart-grenze.js`; Protokoll `data/bridge-start.log`. Bei Erreichen der
Grenze (oder wenn der Zaehler nicht lesbar ist) endet die Schleife und schreibt
`data/bridge-start-gestoppt.txt`: die Bruecke ist dann AUS und das ist sichtbar.
Exit 2 (Port belegt) und 3 (Startfehler) beenden die Schleife wie bisher.

**Kein Autostart** (Eric 23.09. und 03.11.). Start von Hand oder per WMI:
`cmd /c sync\bridge-start.cmd` statt `node sync/bridge.js` (Skill /bb und
Memory-Notiz `bitburner-bruecke-stirbt` entsprechend anpassen). Die Wartezeit
steht als `ping`, nicht `timeout`: unter WMI gibt es keine Konsole, `timeout`
bricht dann sofort ab. Die Datei wurde im Bau NIE ausgefuehrt; der Test prueft
sie nur statisch (CRLF, Sprungziele, Reihenfolge, kein Autostart-Eintrag), die
Zaehllogik laeuft als Node-Test.
