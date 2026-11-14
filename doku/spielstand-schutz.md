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

---

## 9 Lauf-2-Uebergabe: ein neuer Spielstand (Z1, ab 14.11.2026)

Die Bruecke weist ein frisches Spiel ab, und das ist richtig: es hat einen neuen
identifier (wird beim Anlegen des Spielstands gewuerfelt) und Minuten Spielzeit
gegen ueber 2.000 h Anker. Genau so sieht auch ein verlorenes Browserprofil aus.
Deshalb gibt es den Wechsel nur **von Hand, mit ausdruecklichem identifier**, ueber
genau ein Werkzeug: `tools/lauf2-uebergabe.js`. Die Bruecke schaltet nie selbst um.

### Was sich geaendert hat

- Der identifier steht nicht mehr nur im Code, sondern optional in
  `sync/identitaet.json` (versioniert, Epoche `lauf2`, identifier, Startanker).
  **Fehlt die Datei, gilt `197f4d61481686` wie bisher** - alles laeuft bitgleich.
- Ist die Datei da, aber kaputt, startet die LIVE-Bruecke **nicht** (kein stiller
  Rueckfall auf Lauf 1). Nur das Werkzeug schreibt sie.
- In einer Epoche sehen Rueckwaertssprung-Anker, Rotation und Sicherungsalter nur
  Dateien `LIVE_<identifier>_...` dieser Epoche. Ein Lauf-1-Heartbeat oder eine
  Lauf-1-Indexzeile wird nie zum Anker des neuen Spiels.
- Die Riegel bleiben voll: identifier-Pruefung gegen den neuen Wert,
  Rueckwaertssprung > 60 s gegen den Anker der neuen Epoche, Port.

### Ablauf (Claude liest vor, Eric klickt)

1. **Letzten Lauf-1-Stand sichern**, solange das alte Spiel noch laeuft:
   `node tools/backup.js --anlass emergency` (wird nie rotiert).
2. **Neues Spiel anlegen.** OFFEN, Erics Entscheidung: im selben Profil
   ("Delete Save" - widerspricht Abschnitt 6, der Lauf-1-Stand lebt dann nur noch
   in der Sicherungskette) oder in einem eigenen Browserprofil (Lauf-1-Stand bleibt
   im alten Profil; dort keinen Tab mehr offen lassen - kein zweiter Tab).
3. Im neuen Spiel einmal setzen: `RemoteFileApiPort` 12525 (Vorgabe ist 0 = keine
   Verbindung), Autosave, **`AutoexecScript coldstart.js`** (nicht `boot.js`: auf
   8 GB home passt `coldstart.js` neben `boot.js` nicht, und auf 16 GB beendete
   `boot.js` es nach fuenf Minuten - Skeptiker 14.11.2026. `coldstart.js` startet
   ab 32 GB selbst `boot.js`, ist also fuer ganz Lauf 2 richtig).
4. Das neue Spiel verbindet sich und wird abgewiesen. In `## Sofort` bzw.
   `data/bridge.log` steht `identifier <NEU> statt 197f4d61481686` und, seit dem
   Zusammenbau, `Spielstand BN<n> Lauf <l>, <m> SF, Spielzeit <t> ms`. Gegenlesen:
   BN1, Lauf 1, 0 SF, Spielzeit wenige Minuten. Das Werkzeug zeigt es im
   Trockenlauf an und warnt, wenn es nicht passt.
5. **Bruecke beenden - samt Neustartschleife** (`bridge-start.cmd`), sonst startet
   sie mitten in der Uebergabe neu und laedt die alte Identitaet (das Werkzeug
   warnt am Ende, wenn wieder eine laeuft).
6. Trockenlauf: `node tools/lauf2-uebergabe.js --pin <NEU>`
   Prueft: Bruecke aus (bridge.pid, Ports 12525/8795), `<NEU>` im Brueckenprotokoll
   als abgewiesen gesehen (Tippfehlerschutz), Lauf-1-Kette in beiden Ablagen
   (sha256 jeder Datei gegen INDEX.tsv, juengste Sicherung entpackt und gelesen).
   Zeigt den juengsten gesicherten Stand und dessen Alter.
7. Ausfuehren: `node tools/lauf2-uebergabe.js --pin <NEU> --ausfuehren`
   - `LIVE_*` und `INDEX.tsv` in **beiden** Ablagen nach `<ablage>\lauf1\`
     (dort liest sie weder die Rotation noch die Ankersuche), dazu `ARCHIV.json`;
     fremde Dateien (`MANUELL_...`, `save-...`) bleiben liegen;
   - `data\` nach `data\lauf1\` (als Ganzes umbenannt - haelt ein anderer Prozess
     eine Datei offen, schlaegt es fehl, bevor etwas bewegt ist);
   - `data/nicht-schieben.txt` (die Sperrliste, getrackte Konfiguration) wird aus dem
     Archiv in das NEUE `data/` zurueckkopiert: sonst schiebt `pushAll` ins frische
     Spiel, was in Lauf 1 gesperrt war - namentlich `graftplan.json`, den Zuender fuer
     rund 450 Mrd. (Erics Entscheidung, nicht die der Uebergabe). Ob `graftplan.json`
     in Lauf 2 ueberhaupt ins Spiel soll, entscheidet Eric;
   - **zuletzt** `sync/identitaet.json` (atomar). Erst ab hier gilt das neue Spiel.
   Bricht es mittendrin ab, ist nichts verloren (die Bruecke prueft weiter gegen den
   alten identifier); erneuter Aufruf setzt fort.
8. **Epochen-Leser und Epochendatei.** Das Werkzeug lehnt LIVE ab, solange
   `src/ausgang.js` und `src/exit.js` die Epoche nicht lesen (`leseEpoche`/`ladeRoute`,
   Hindernis, Exit 2). Mit Lauf-2-Route: `src/epoche.json` mit `{"epoche": "lauf2"}`
   anlegen und committen - ohne diese Datei faehrt der Bot die Route von Lauf 1.
   `git add sync/identitaet.json src/epoche.json` und committen (das Werkzeug
   committet nicht). `git status` darf kein ` D data/...` zeigen (sonst nicht `add -A`).
9. Bruecke starten. Im Protokoll muss `Identitaet: Epoche lauf2, identifier <NEU>`
   stehen und danach `Verifiziert in ...`.

Exit 0 = erledigt bzw. Trockenlauf ohne Hindernis, 2 = abgelehnt (nichts
veraendert), 1 = Aufruf-/unerwarteter Fehler. Nur wenn `data/bridge.log` fehlt:
`--ohne-sichtung` (Startanker dann 0).

### Rueckweg von Lauf 2 nach Lauf 1 (nur dokumentiert, nicht getestet)

Es gibt keinen Schalter. Wer zurueck muss (die Uebergabe war voreilig, das neue Spiel
ist verloren): Bruecke samt Neustartschleife beenden, `sync/identitaet.json`
umbenennen (dann gilt wieder `197f4d61481686`), die Dateien aus `<ablage>\lauf1\`
zurueck in die Ablagen verschieben (`LIVE_...` und `INDEX.tsv`; die
`LIVE_<neu>_`-Dateien der Epoche vorher in einen eigenen Ordner legen, sie tragen
sonst denselben Praefix), `data\lauf1\` an die Stelle von `data\` stellen (das neue
`data\` vorher wegschieben), `src/epoche.json` entfernen und committen.
Danach `bridge.log` und Heartbeat gegenlesen: ohne Heartbeat und Indexzeile fehlt der
Rueckwaertssprung-Anker und die Bruecke meldet `Verbindung ohne Anker`.

### Lauf-1-Sicherungen nach der Uebergabe

Sie liegen unter `C:\Users\erche\bitburner-backups\lauf1\` (Spiegel
`backups\lauf1\`). Pruefen wie gewohnt, mit dem Index des Archivs:

```bash
node tools/backup-check.js <datei> --expect-id 197f4d61481686 --expect-port 12525 \
  --index C:\Users\erche\bitburner-backups\lauf1\INDEX.tsv
```

### Pruefstand

`--instance TEST` arbeitet auf `pruefstand/data`, `pruefstand/backups` und schreibt
`pruefstand/identitaet-test.json`; die TEST-Bruecke liest sie mit
`--identitaet pruefstand/identitaet-test.json` (fuer LIVE gesperrt). Tests:
`node tools/test-lauf2-uebergabe.js` (Wegwerfordner, MOCK-Bruecke),
`node tools/test-backup.js` (Epochenpraefix in `sichere()`).
