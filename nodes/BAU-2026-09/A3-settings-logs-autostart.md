# A3 — Todesursache der Brücke, Autoexec und Autostart

Aufgenommen 04.09.2026, 01:37–01:49 Ortszeit (`date`:
`Fri Sep 4 01:37:29 2026` bis `Fri Sep 4 01:48:49 2026`).
Nur gelesen; nichts in `src/`, nichts im Spiel, nichts an Erics Rechner
verändert. Die vollständige Einstellungsaufnahme liegt in
`doku/settings.md`.

---

## 1. Todesursache der Brücke am 03.09.2026 — **keine Spur, und zwar aus einem
##    nachweisbaren Grund**

### Das Ergebnis zuerst

**Die Logs geben die Ursache nicht her, und sie konnten es nie.** Das ist kein
Suchversagen, sondern ein Befund mit Beleg: zum Zeitpunkt der beiden Ausfälle
existierte **keine Logdatei**, und die eine Datei, die es heute gibt, wurde von
dem Neustart, der auf die Ausfälle folgte, **selbst überschrieben**.

Damit ist die Prämisse des Exit-Fangs (Auftrag 1.6 / 183) bestätigt, nicht
vermutet.

### Beleg 1 — die alte Brücke schrieb überhaupt keine Datei

`data/bridge.log` bekam erst heute einen Schreiber. Er kam mit Commit
`f6a61e5` („Bruecke sichert, bevor sie schreibt: Wachhund, Port-Lock,
Schreibschranke", **2026-09-04 01:32:30 +0200**):

- `sync/bridge.js:226` `const LOGDATEI = path.join(DATA_DIR, "bridge.log")`
- `sync/bridge.js:228-241` `schreibeLogZeile()`, aufgerufen aus `log()` (`:251`)

Die Vorgängerfassung (`git show fa66944:sync/bridge.js`) enthält weder
`bridge.log` noch `appendFile` noch `createWriteStream` noch `LOGDATEI` —
`grep` findet nichts. Ihr `log()` tat genau drei Dinge:

```
state.log.push(entry);                       // Ringpuffer, 400 Einträge
if (state.log.length > 400) state.log.splice(...);
console.log(stamp + " " + mark + " " + message);
broadcast({ type: "log", entry });
```

**Der Ringpuffer starb mit dem Prozess** — genau in dem Moment, in dem man ihn
gebraucht hätte. Das Dashboard zeigte ihn, aber nur solange die Brücke lebte.

### Beleg 2 — der obere Teil von `bridge.log` ist umgeleitete Konsolenausgabe,
### und die Umleitung hat die Datei geleert

`data/bridge.log` besteht heute aus zwei ineinandergeschriebenen Formaten:

| Bereich | Format | Herkunft |
|---|---|---|
| Anfang bis `23:08:45` | Leerzeile, Banner `=== Bitburner Autopilot: Bridge ===`, dann `HH:MM:SS␣␣␣␣Text` | **STDOUT der alten Brücke**, per Shell-Umleitung in die Datei |
| ab `2026-09-03T23:25:28.545Z` | `<ISO>\t<level>\t<Text>` | `schreibeLogZeile()` der neuen Brücke |

Der Banner ist der Beweis: `console.log("\n=== Bitburner Autopilot: Bridge ===")`
steht in `git show fa66944:sync/bridge.js` in Zeile 430 und **fehlt in der
heutigen Fassung vollständig** (`grep -n "Autopilot: Bridge" sync/bridge.js`
→ exit 1). Er kann also nur über `>` in die Datei gelangt sein.

Und eine Umleitung mit `>` **leert die Zieldatei**. Die Zeitstempel passen auf
die Sekunde:

- `data/bridge-err.log`: **0 Bytes**, mtime **2026-09-03 15:28:31.585 +0200**
- erste Zeile in `bridge.log`: `13:28:32␣␣␣␣Beobachte src/ auf Aenderungen`

Das ist derselbe Augenblick: die alte `log()`-Funktion stempelte mit
`entry.at.slice(11, 19)`, also **UTC**; 13:28:32 UTC = 15:28:32 Ortszeit.
Deckungsgleich mit `nodes/vorbereitung-2026-09-03/entwurf-2.md:22`
(„Sie läuft seit 15:28:32 wieder").

**Folge: alles, was vor dem 03.09.2026 15:28:31 in diesen beiden Dateien stand
— und damit beide Todesfälle — wurde von dem Neustart überschrieben, der auf
sie folgte.** `bridge-err.log` ist seither 0 Bytes geblieben (nachgemessen
01:48 Uhr: immer noch 0), also hat auch die überlebende Instanz nie etwas nach
stderr geschrieben.

### Beleg 3 — es gibt keine zweite, unabhängige Quelle

Alle in Frage kommenden Mitschriften enden **vor** dem 03.09.:

| Datei | letzte Zeile / mtime | Deckung für 03.09.? |
|---|---|---|
| `data/aufsicht.log` | `2026-09-02 19:05:08`, mtime 19:05:11 | nein — Aufsicht am 02.09. abends beendet |
| `data/wache.log` | `[19:05:34]`, mtime 2026-09-02 19:05:34 | nein |
| `data/wache.pid` | mtime 2026-09-02 16:04:35 | nein |
| `data/bridge-alarm.json` | existiert nicht | nein (Alarmschreiber ist von heute, `bridge.js:255-267`) |
| `backups/INDEX.tsv` | erste Zeile `2026-09-03T23:13:42.496Z` (= 04.09. 01:13 Ortszeit) | nein — das Sicherungswerk ist jünger als die Ausfälle |
| `data/notnagel.json` | `{"tag":"2026-09-02", …}` | nein |

Vor heute gab es genau **eine** Sicherung überhaupt
(`backups/save-2026-08-28-0740-vor-exploits.json.gz`, 28.08.), was den
Kopfkommentar von `sync/backup.js:5-9` bestätigt.

### Beleg 4 — auch mit dem neuen Logschreiber bleibt eine Lücke

Das ist der Teil, der über die gestellte Frage hinausgeht und mir wichtiger
erscheint als die Rekonstruktion des Vergangenen.

`sync/bridge.js` hat heute **zwei** Ausnahmefänger und sonst nichts:

```
1429  process.on("uncaughtException", ...)   -> fatal-Zeile + exit(1)
1434  process.on("unhandledRejection", ...)  -> fatal-Zeile + exit(1)
```

`grep -c "SIGINT\|SIGTERM\|beforeExit\|process.on(\"exit\")" sync/bridge.js`
→ **0**.

**Ein geordneter Tod hinterlässt weiterhin keine Zeile.** Heute Nacht dreimal
live beobachtet: die Brücke wurde um 23:31:48Z, 23:45:09Z und 23:46:41Z jeweils
neu geboren (`data/bridge.log`), und **vor keiner dieser Geburten steht ein
Abschied**. `taskkill`, Fensterschließen, Strg+C, Abmeldung, Windows-Neustart,
Speichermangel und Stromausfall sehen im Log alle identisch aus — nämlich genau
so, wie die beiden Ausfälle vom 03.09. aussahen.

Konkret nicht unterscheidbar bleibt:

- gewollter Neustart durch die Bausitzung ↔ Absturz
- Absturz des Prozesses ↔ Absturz des ganzen Rechners
- Ende der `bridge-start.cmd`-Schleife ↔ Ende nur der Brücke

Was die neue Fassung dagegen **wohl** sichtbar macht: eine unbehandelte
Ausnahme (`fatal`-Zeile), ein belegter Port (`exit(2)`, `bridge.js:1208-1214`
und `:1311-1316`), ein Rollen-/Pfadfehler (`exit(3)`, `:110-154`).

**Vorschlag (nicht gebaut, gehört in die Befundliste):** ein
`process.on("SIGINT"/"SIGTERM"/"exit")`, das eine einzige Zeile
`ende <signal|code>` schreibt. Drei Zeilen Code, und der Unterschied zwischen
„jemand hat sie beendet" und „sie ist gestorben" ist von da an im Log lesbar.
Zusätzlich in derselben Kerbe: ein `start`-Eintrag mit PID und Startzeit als
allererste Zeile — heute steht die PID nur in `data/bridge.pid`, das bei jeder
Geburt überschrieben wird.

### Nachtrag: eine dritte, ebenfalls unerklärte Beendigung

Der überlebende Prozess vom 03.09. 15:28 schrieb seine letzte Zeile um
`23:08:45` UTC (= 04.09. 01:08:45 Ortszeit). Die neue Brücke meldet sich um
`23:25:28.545Z` (01:25:28). Dazwischen liegen **16,7 Minuten ohne Erklärung im
Log** — vermutlich das Ende der alten Fassung im Zuge des heutigen Umbaus (2 s
vor der ersten neuen Zeile steht ein `pre-hotswap`-Backup, `INDEX.tsv`
`2026-09-03T23:25:26.385Z`), aber eben nur vermutlich. Genau das ist der Punkt
aus Beleg 4.

---

## 2. Autoexec und Autostart — beide Widersprüche aufgelöst

### 2a) Der Widerspruch Memory ↔ `BAUSTELLEN.md:137-140`

**Das Memory hat recht. `BAUSTELLEN.md` ist eine nicht gestrichene Altlast.**

`nodes/BAUSTELLEN.md:137-140` (in HEAD identisch, also nicht durch die heutige
Bearbeitung entstanden):

```
- **Zwei Handgriffe von Eric:** Autoexec im Spiel auf `boot.js` (Options ->
  System) - sonst startet nach einem Neuladen ohne laufende Skripte nichts;
  und `Bitburner-Aufsicht.cmd` aus dem Windows-Autostart nehmen (startet
  wache/aufsicht, die Werkzeuge doppelt starten).
```

Gemessen dagegen:

| Prüfpunkt | Messung | Quelle |
|---|---|---|
| `SettingsSave.AutoexecScript` | **`"boot.js"`** | `getSaveFile` über die Brücke, Antwort `2026-09-03T23:37:28.957Z` (= 04.09. 01:37:29) |
| Autostart-Ordner des Benutzers | **leer bis auf `desktop.ini`** (174 B, 14.09.2025) | `ls` auf `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup` |
| mtime dieses Ordners | **2026-09-02 19:07:46 +0200** | `stat` |

Beide Handgriffe sind also erledigt — und die Zeitstempel erzählen die
Geschichte lückenlos:

- `data/aufsicht.log`, **letzte Zeile überhaupt**, `2026-09-02 19:05:08`:
  „OFFEN: Autoexec ist leer. Ein Handgriff im Spiel schliesst die letzte Luecke
  der Selbstheilung…" — dieselbe Meldung steht davor alle zehn Minuten
  (17:54:56, 18:04:56, 18:14:59, 18:25:00, 18:35:02, 18:45:03, 18:55:07,
  19:05:08). Danach bricht die Datei ab.
- Ordner-mtime **19:07:46** — der Eintrag `Bitburner-Aufsicht.cmd` wurde
  entfernt.
- Memory `bitburner-audit-autonomie.md`, Eintrag **„02.09.2026, 19:10 – Erics
  Handgriffe erledigt und verifiziert"**.

Zwischen 19:05 und 19:10 hat Eric beides gemacht; die Aufsicht war da schon
tot und konnte ihre eigene Meldung nicht mehr zurücknehmen. **Wer heute nur
`aufsicht.log` liest, hält „Autoexec ist leer" für den aktuellen Stand — die
Datei ist zwei Tage alt und friert ihren letzten Irrtum ein.**

Der Auftragstext (Zeile 56) nennt die Fundstelle `BAUSTELLEN.md:137-140`
korrekt; die Zeilennummern stimmen bis heute.

**Zu tun:** die vier Zeilen in `BAUSTELLEN.md` als erledigt streichen. Solange
sie stehen, wird der Widerspruch bei jeder Sitzung neu aufgemacht — genau das
ist gerade passiert.

### 2b) Reste von `Bitburner-Aufsicht.cmd` und anderen Startern

**Es startet nichts mehr von allein.** Vier voneinander unabhängige Prüfungen:

| Ort | Ergebnis |
|---|---|
| `%APPDATA%\…\Programs\Startup` | nur `desktop.ini` |
| `%ProgramData%\…\Programs\StartUp` | nur `ROCCAT Swarm Monitor.lnk` und `desktop.ini` |
| `HKCU\…\CurrentVersion\Run` | 12 Einträge (Steam, Epic, Docker, Opera …), **kein Bitburner** |
| `HKLM\…\CurrentVersion\Run` | 5 Einträge (SecurityHealth, IAStorIcon, Realtek, Macrium, KeePass), **kein Bitburner** |
| Aufgabenplanung (`schtasks /query /v`) | kein Treffer auf `bitburner`/`bruecke`/`aufsicht`/`wache`/`bridge` (die Treffer auf „wacheck" sind Microsoft-Office-Aufgaben) |
| laufende `node.exe` | 8 MCP-Prozesse (Opera, Spotify) plus **genau eine** Brücke: `node sync\bridge.js --instance LIVE`, PID 10636, gestartet 04.09.2026 01:46:41. Kein `wache.js`, kein `aufsicht.js`, kein `nightshift.js`. |

**Die `.cmd`-Dateien im Projekt** (`find … -name "*.cmd"`, ohne
`node_modules`/`reference`) — fünf Stück:

| Datei | Startet was | Urteil |
|---|---|---|
| `sync/bridge-start.cmd` | `node sync\bridge.js --instance LIVE` in einer Endlosschleife mit 10 s Pause; bricht bei RC 2 (Port belegt) und RC 3 (Konfigurationsfehler) ab | **Der gewollte Starter.** Kopf auf 04.09.2026 datiert, entstanden in diesem Bau. Der Autostart-Eintrag darauf ist ausdrücklich Erics Handgriff (`bridge-start.cmd:17-22`), und der fehlt heute noch. |
| `start.cmd` | `start "Bitburner-Waechter" /min cmd /c "timeout /t 10 & node tools\wache.js"` **und** `node sync\bridge.js` | **Remnant mit Wirkung.** Ein Doppelklick zieht `tools/wache.js` in einem eigenen Fenster hoch — die Betriebsart, die am 31.08. abgeschafft wurde und die der Auftrag ausdrücklich verbietet (345: „Kein `tools/aufsicht.js`, `tools/wache.js`"). Auftrag 182 sieht das Ersetzen von `start.cmd` durch `bridge-start.cmd` vor; **das ist noch nicht geschehen**, die Datei steht unverändert (mtime 24.08. 19:56). |
| `tools/autostart-einrichten.cmd` | schreibt `%APPDATA%\…\Startup\Bitburner-Aufsicht.cmd` mit dem Inhalt `start "" /min node tools\aufsicht.js --dauer` | **Der schärfste Rest.** Die Datei, die den am 02.09. entfernten Eintrag erzeugt hat, liegt unverändert im Projekt (mtime 24.08.). Sie läuft nicht von selbst, aber ein einziger Doppelklick stellt den entfernten Zustand wieder her — und zwar mit `aufsicht.js`, das laut Auftrag 345 nicht mehr betrieben werden darf. |
| `nacht.cmd` | `node tools\nightshift.js` | **Remnant.** `nightshift/*` ist nach Auftrag 345 nicht mehr zu betreiben. Läuft nicht, startet aber auf Doppelklick. |
| `pruefstand/build-v301.cmd` | Bau des Prüfstands | in Ordnung, gehört zum laufenden Bau (noch nicht committet: `git status` zeigt `?? pruefstand/build-v301.cmd`) |

**Bewertung.** Die Frage „gibt es noch Reste" ist mit **ja** zu beantworten,
aber nicht dort, wo man sie vermutet: der Autostart-*Eintrag* ist sauber weg
und an keiner der fünf geprüften Stellen wiedergekommen. Was liegen geblieben
ist, sind **drei Doppelklick-Fallen im Projektordner selbst** —
`tools/autostart-einrichten.cmd` (stellt den Eintrag wieder her), `start.cmd`
(startet den abgeschafften Wächter mit) und `nacht.cmd` (startet die
Nachtsteuerung). Keine davon läuft; jede davon widerspricht der neuen
Betriebsart, und `start.cmd` ist die wahrscheinlichste, weil sie seit Wochen
*der* Weg war, die Brücke zu starten, und in `README.md` und mehreren
Doku-Dateien so beschrieben steht.

**Vorschlag (nicht ausgeführt — Löschen ist eine Bauentscheidung, keine
Messung):**

1. `start.cmd` durch einen Zweizeiler ersetzen, der auf
   `sync\bridge-start.cmd` verweist, statt `wache.js` zu starten.
2. `tools/autostart-einrichten.cmd` entweder löschen oder auf
   `sync\bridge-start.cmd` umschreiben — solange sie auf `aufsicht.js` zeigt,
   ist sie eine geladene Waffe.
3. `nacht.cmd` löschen oder mit einem Abbruchhinweis versehen.
4. Erst danach Eric den Autostart-Handgriff für `bridge-start.cmd` vorlegen —
   sonst legt er womöglich die falsche `.cmd` in den Ordner.

---

## 3. Was aus `doku/settings.md` hierher gehört

Drei Punkte aus der Einstellungsaufnahme sind Befunde gegen den Auftragstext
und stehen dort ausführlich:

- **`SaveGameOnBeforeUnload` existiert in v3.0.1 nicht.** Der Auftrag verlangt
  seine Beurteilung; `grep -rn "SaveGameOnBeforeUnload" reference/v301/src/`
  liefert exit 1. Es gibt nur den festverdrahteten Handler
  `index.tsx:53-58`, und der **speichert nicht**, sondern zeigt nur einen
  Dialog — und auch das nur, wenn das Spiel nicht unter `file://` läuft.
- **Es gibt kein `*SecurityLevel`-Feld in den Einstellungen.**
  `grep -rn "SecurityLevel" reference/v301/src/Settings/` → exit 1.
- **`SaveGameOnFileSave` betrifft die Brücke nicht**, sondern nur den
  Skripteditor im Spiel (`ScriptEditor/ui/utils.ts:97`). `pushFile` schreibt
  nur in den Hauptspeicher (`MessageHandlers.ts:88-99`) — ein Hot-Swap ist bis
  zum nächsten Autosave nicht persistent.

Die vier Vorbedingungen des autonomen Betriebs stehen heute alle richtig:
`RemoteFileApiPort 12525`, `AutoexecScript "boot.js"`, `AutosaveInterval 60`,
`ExcludeRunningScriptsFromSave false`.
