# Spielstand-Schutz und Wiederherstellung

**Diese Datei ist für Eric geschrieben, nicht für Claude.** Sie beschreibt, was zu
tun ist, wenn der Bitburner-Spielstand beschädigt ist oder verloren scheint.
Geklickt wird ausschließlich von Eric. Claude liest vor und prüft.

Stand 04.09.2026. Spielstand-Kennung `197f4d61481686`, BitNode 10 Lauf 2.

---

## 1 Der Grundsatz

Es gibt genau **einen** echten Spielstand. Er liegt in der IndexedDB des Opera-Tabs
unter `https://bitburner-official.github.io/`, Datenbank `bitburnerSave`, Store
`savestring`, Schlüssel `save`. Alles andere ist eine Kopie.

Kopien sind an **einem** Merkmal erkennbar: dem Remote-API-Port in ihren Einstellungen.

| | Live | Testkopie |
|---|---|---|
| RFA-Port | **12525** | 12526 |
| Dashboard | 8795 | 8796 |
| Herkunft | `bitburner-official.github.io` | `http://localhost:8799` |
| Sicherungen | `LIVE_…` | `TEST_…` |

Die Kennung `197f4d61481686` steht in **beiden** — sie wird beim Kopieren mitgenommen
und trennt deshalb nichts. Wer eine Datei prüfen will, prüft den Port.

---

## 2 Wo die Sicherungen liegen

```
C:\Users\erche\bitburner-backups\          <- der Ort, der zählt
C:\Users\erche\Desktop\claude_projecto\bitburner\backups\   <- nur Spiegel
```

Der erste Ort liegt **außerhalb** des Projektordners. Das ist Absicht: `backups/` steht
in `.gitignore` und liegt im selben Arbeitsbaum wie die Git-Worktrees. Ein einziges
`git clean -xdf` würde den Spiegel löschen. Deshalb ist `git clean` in diesem Repo
in jeder Variante verboten.

Jede Datei heißt
`LIVE_197f4d61481686_BN<knoten>L<lauf>_<datum>T<zeit>_<anlass>.json.gz`
und ist im **Importformat des Spiels** — gzip, unentpackt einzuspielen.

`INDEX.tsv` in beiden Ordnern führt je Datei Prüfsumme, Kennung, Spielzeit, Knoten,
Lauf und Anlass. Die Spalte `totalPlaytime` ist der wichtigste Wert: **sie muss von
Zeile zu Zeile steigen.** Sinkt sie, hat eine zweite Instanz mitgeschrieben.

Aufbewahrung: `pre-jump`, `pre-install` und `emergency` werden **nie** gelöscht.
`hourly` 48 Stück, `pre-hotswap` 20, `manual` 30, `connect` 10.

---

## 3 Ist überhaupt etwas kaputt? — erst messen

Bevor irgendetwas wiederhergestellt wird, diese drei Befehle. Sie ändern nichts.

```bash
curl.exe -s http://127.0.0.1:8795/api/state
```

In PowerShell **zwingend `curl.exe` mit Endung** — `curl` allein ist dort ein Alias auf
`Invoke-WebRequest` und bricht nicht-interaktiv ab.

Interessant sind vier Felder: `connected`, `verified`, `bitNode`/`lauf` und
`backupAgeMin`. Steht `verified` auf `false`, hat die Brücke die Verbindung **nicht**
als den erwarteten Spielstand erkannt und schreibt nichts hinein — das ist der
Schutzzustand, nicht der Fehlerzustand.

```bash
node tools/backup-check.js "C:\Users\erche\bitburner-backups\<datei>" --expect-id 197f4d61481686 --expect-port 12525
```

Grün heißt: diese Sicherung ist vollständig, lesbar und stammt vom Live-Stand.

```bash
node tools/checkin.js
```

---

## 4 Wiederherstellung — nur bei Katastrophe, nur von Hand

Diese acht Schritte in **genau dieser Reihenfolge**. Jeder hat einen Grund.

### (1) Brücke beenden

```bash
node -e "const p=require('C:/Users/erche/Desktop/claude_projecto/bitburner/data/bridge.pid');console.log(p.pid)"
```
Dann das Fenster der Neustartschleife schließen **und** den Prozess beenden.

**Grund:** Die Brücke schiebt beim Verbinden den Inhalt von `src/` ins Spiel. Läuft
sie weiter, überschreibt sie den gerade wiederhergestellten Stand mit dem aktuellen
Code — möglicherweise mit genau dem Code, der den Schaden verursacht hat.

### (2) Prüfen, dass genau EIN Bitburner-Tab offen ist

Alle Fenster durchsehen, auch minimierte, auch in anderen Browsern.

**Grund:** Zwei Tabs derselben Herkunft teilen sich eine IndexedDB ohne jede Sperre.
Beide speichern alle 60 Sekunden, der letzte Schreiber gewinnt. Eine Wiederherstellung
im einen Tab wird vom anderen binnen einer Minute überschrieben.

### (3) Options → Export Game

Auch wenn der jetzige Stand kaputt aussieht.

**Grund:** Der kaputte Stand ist möglicherweise weniger kaputt als gedacht, und nach
dem Import ist er unwiederbringlich weg. Diese Datei kostet zehn Sekunden.

### (4) Die Sicherung prüfen, bevor sie eingespielt wird

```bash
node tools/backup-check.js "<pfad zur datei>" --expect-id 197f4d61481686 --expect-port 12525
```

**Grün ist Voraussetzung.** Rot heißt: eine andere Datei nehmen.

Das Werkzeug zeigt Knoten, Lauf, Spielzeit, Hacking, Geld, Augmentierungen und
Bladeburner-Rang. Diese Zahlen mit dem vergleichen, was zuletzt richtig war.

### (5) Options → Import Game → die `.json.gz` **unentpackt** wählen

**Grund:** Das Spiel erwartet genau dieses Format. Eine von Hand entpackte `.json`
weist es ab.

### (6) Auf der Vergleichsseite prüfen

Das Spiel zeigt jetzt den alten und den neuen Stand nebeneinander. Prüfen:
Kennung, `lastSave`, BitNode, Spielzeit.

**Bei jedem Zweifel „Go back".** Das stellt den Autosave wieder her und ändert nichts.

### (7) Bestätigen, Reload abwarten, dann erst die Brücke starten

```bash
sync\bridge-start.cmd
```

Danach gegenprüfen:

```bash
curl.exe -s http://127.0.0.1:8795/api/state
```

`verified` muss `true` werden, und Knoten/Lauf müssen zur eingespielten Datei passen.

**Achtung, ein Sonderfall:** Der Wachhund der Brücke lehnt eine Verbindung ab, deren
`totalPlaytime` mehr als 60 Sekunden **hinter** dem zuletzt gelesenen Wert liegt.
Nach einer bewussten Wiederherstellung ist genau das der Fall — die Ablehnung ist
dann richtig und trotzdem unerwünscht. Abhilfe: `data\bridge-heartbeat.json` löschen,
bevor die Brücke startet. Dann hat sie keinen Vergleichswert und akzeptiert den Stand.

### (8) Wenn die Recovery-Seite erscheint

Das Spiel zeigt eine eigene Seite mit zwei Knöpfen. Auf ihr gilt:

- **Zuerst** die automatisch heruntergeladene Datei `RECOVERY_BITBURNER_*.json.gz`
  aus dem Downloads-Ordner in Sicherheit bringen.
- Dann eine **ältere** Sicherung importieren.
- **Niemals „Delete Save".** Der Knopf steht auf derselben Seite und löscht die
  Datenbank vollständig.

---

## 5 Der Browser-Umzug — die einzige erlaubte Ausnahme

Ein Wechsel von Opera zu Chrome oder Edge mit abgeschalteter Hintergrund-Drosselung
ist der größte Einzelhebel des Projekts: er verkürzt die verbleibende Spielzeit
**von 3 bis 12 Monaten auf etwa 6 bis 11 Wochen**, weil ein verdeckter Tab heute nur
eine Rechenrunde je Minute bekommt.

Es ist gleichzeitig der einzige Fall, in dem auf dem Live-Stand ein Import stattfindet.
Er ist Erics Handgriff, und die Reihenfolge ist zwingend:

1. Brücke beenden.
2. Im Opera-Tab: Options → Export Game.
3. `node tools/backup-check.js <datei> --expect-id 197f4d61481686 --expect-port 12525` — grün.
4. **Opera-Tab schließen. Erst danach den neuen Browser starten.**
5. Im neuen Browser importieren, auf der Vergleichsseite prüfen.
6. Brücke starten, `/api/state` prüfen.
7. Den Opera-Tab nie wieder öffnen.

**Warum Schritt 4 die ganze Sache trägt:** Laufen beide gleichzeitig, sind es zwei
Instanzen derselben Herkunft ohne Sperre, beide mit Autosave, beide auf Port 12525.
Danach ist nicht mehr bestimmbar, welcher Stand der echte ist.

Der neue Browser braucht diese Startoptionen:

```
--disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding
```

Bis Schritt 6 grün ist, bleiben alle Eingriffe am Spiel gesperrt.

---

## 6 Was niemals getan wird

- Kein zweiter Tab auf `bitburner-official.github.io`, in keinem Browser.
- Kein automatisierter Import auf den Live-Stand.
- Kein direktes Schreiben in die IndexedDB des Live-Spiels.
- Kein „Delete Save", kein Löschen der Site-Daten.
- Keine Änderung an `AutosaveInterval`, `ExcludeRunningScriptsFromSave`,
  `AutoexecScript` oder `RemoteFileApiPort` im Live-Spiel. Drei davon sind
  Voraussetzung dafür, dass der Bot sich nach einem Einfrieren selbst neu laden kann.
- Kein `git clean` im Projektordner, in keiner Variante.
- In der Live-Arbeitskopie kein `merge`, `switch`, `checkout <zweig>`, `reset --hard`,
  `stash`, `rebase`, `revert`. Jeder dieser Befehle schreibt `src/` in einem Zug neu,
  und die Brücke schiebt den ganzen Satz binnen 400 Millisekunden ins laufende Spiel.
  Erlaubt ist `git checkout <hash> -- <einzelne datei>` nach frischer Sicherung.

---

## 7 Was die Brücke von sich aus tut

Seit dem 04.09.2026 sichert sie selbst, und zwar bevor sie schreibt:

| Anlass | Wann |
|---|---|
| `connect` | bei jeder neuen Spielverbindung, **vor** der ersten Übertragung |
| `hourly` | stündlich |
| `pre-hotswap` | vor jedem Codeschub, höchstens alle 10 Minuten |
| `pre-jump` / `pre-install` | auf Handschlag des Skripts im Spiel |
| `emergency` | bei Verdacht auf Recovery-Modus |
| `race` | alle 5 Minuten, solange die Zweit-Tab-Sperre steht (siehe 8) |

**Schlägt eine Sicherung fehl, wird nicht geschrieben.** Der Bot läuft dann mit dem
Code weiter, den er schon hat. Das ist kein Stillstand, nur kein Fortschritt — und es
ist der richtige Kompromiss, weil ein verlorener Spielstand Tage kostet und ein
verzögerter Codeschub Minuten.

Fällt die Brücke ganz aus, exportiert der Bot selbst: er prüft das Alter der letzten
Sicherung, und ist sie älter als 90 Minuten, legt er einmal je Stunde eine Kopie im
Downloads-Ordner ab.

## 8 Die Zweit-Tab-Sperre

Meldet sich eine zweite RFA-Verbindung, **während die bestehende noch
antwortet**, laufen zwei Spiele auf demselben Spielstand. Beide sichern alle
60 Sekunden in dieselbe IndexedDB, und der letzte Schreiber gewinnt — das ist
der Weg, auf dem ein Spielstand verschwindet, ohne dass etwas abstürzt.

Die Brücke schreibt dann `data/zweittab-alarm.json`, und solange diese Datei
liegt:

- geht **nichts** ins Spiel — kein Codeschub, kein `pushAll` beim Verbinden,
  kein Rückkanal, kein `tools/task.js` / `hand.js` / `nightshift.js`. Der
  Riegel sitzt in `pushFile`, also in der einen Engstelle, durch die jeder
  Schreibweg läuft. Einzige Ausnahme: `data/backup-ok.txt`, die Antwort des
  Handschlags — ohne sie wartete der Bot vor jedem Einbau ins Leere;
- wird alle fünf Minuten gesichert, unter dem Anlass `race`.

**Aufgehoben wird sie nur von Hand** (Datei löschen; ein Brückenneustart ist
nicht nötig und wäre selbst ein Eingriff). Vorher klären, ob wirklich ein
zweiter Tab lief: sinkt `totalPlaytime` in `backups/INDEX.tsv` irgendwo, hat
ein zweiter Stand geschrieben.

**Ein Reconnect setzt sie NICHT.** Schweigt die alte Verbindung auf die
Rückfrage, ist sie tot — Standby-Rückkehr, Tab-Discard, Seitenneuladen. Das
ist der häufigste Vorgang im System, und eine Sperre, die nur ein Mensch
aufheben kann, gehört nicht an den häufigsten harmlosen Fall. Damit tote
Sockets überhaupt verschwinden, hält die Brücke seit dem 04.09.2026 ein
Ping/Pong (30 s, zwei verpasste Pongs → `terminate()`).
