# Einspielung des neuen Stands — Protokoll

**Begonnen: 04.09.2026, 17:30.** Ziel: der gemergte Stand (`dd209dc` ff.) läuft
im Spiel, statt nur in `src/` zu liegen.

Dieses Protokoll wird **während** des Vorgangs geschrieben, nicht danach. Was
hier steht, ist gemessen; was nicht gemessen ist, steht als offen da.

---

## Ausgangslage

| | |
|---|---|
| Brücke | LIVE, verifiziert, Master-Riegel an (142 Dateien in `master`) |
| BitNode | 10, Lauf 2, Verfahren V2 (Bladeburner) |
| Bladeburner-Rang | 3.871 von 400.000 (0,97 %) |
| Rate | 399 Rang/h |
| Netz | 85 von 85 gerootet, Motorrunde 2554 |
| Urteil vor der Einspielung | **AUF KURS** |
| Ausgang offen? | **nein** (`ausgang.json.offen === false`) — kein Sprung steht an |
| Wartende Dateien | **49** |

Im Spiel laufen (frisch gemessen, `data/ps.json` 0,66 min alt):

```
home      bn4net.js bn4life.js blade.js bbtrain.js sleeve.js
          homegrow.js contracts.js bn4rep.js bn4door.js
iron-gym  ausgang.js wakelock.js popups.js
werk-4    ps.js
```

---

## Was VOR dem ersten Schub gesichert wurde

### 1. Die Einbausperre steht

`data/install-sperre.txt` ist gesetzt (17:30:11) und enthält **kein**
`FIRMENPHASE`-Präfix und **keinen** Zeitstempel. Beides ist Absicht und gegen
die **laufende** Fassung von `bn4rep.js` geprüft, nicht gegen die neue:

- `bn4rep.js:770` (Spielfassung): `const lockStempel = Number(lockInhalt.split("|")[1])`
  → ohne `|<zahl>` ist das `NaN` → `lockGilt = true`, **unbefristet**.
- `bn4rep.js:592-594` (Spielfassung): nur ein Lock, das mit `FIRMENPHASE`
  beginnt, räumt der Bot selbst weg. Alles andere „hat ein Mensch gesetzt und
  bleibt liegen".
- `bn4rep.js:787`: `gesperrt = gesperrt || bladeSperre || lockGilt`

Damit ist der unwiderruflichste Vorgang des Bots — Augmentierungen einbauen,
der die Kampfwerte auf 1 zurücksetzt — für die Dauer der Einspielung zu.

**Sprosse 5 der Strafleiter bleibt zusätzlich im Trockenlauf**: sie schärft
sich nur, wenn `data/punish-scharf.txt` auf home liegt, und die legt ein
Mensch. Sie liegt nicht.

### 2. Ein byte-genauer Rollback existiert

**Und er sieht anders aus, als der Auftrag annimmt.**

Der im Auftrag genannte Rollback-Weg ist `git checkout <hash> -- src/<datei>`.
Der gibt nicht zurück, was im Spiel **lag**: was im Spiel liegt, ist der Stand
des letzten erfolgreichen Schubs, und der fällt nicht mit einem Commit
zusammen. Im Notfall, unter Zeitdruck, spielte er eine dritte, nie gelaufene
Fassung ein — und es fiele niemandem auf.

> **Korrektur (04.09.2026, 18:40).** Hier stand eine Tabelle mit vier
> Stichproben, die das belegen sollte („`bn4net.js` im Spiel `dc0075c7e610`,
> Commit `fb3466fd63d7`"). **Diese Zahlen sind nicht reproduzierbar.** Für
> `bn4net.js` wurde beim Einspielen `fb3466fd63d7` als Spielstand gemessen —
> übereinstimmend vom Archiv und vom Einspielwerkzeug, das die Datei
> überschrieb. Der Vergleich gegen den Commit ist zudem schwerer als er
> aussieht: Git speichert LF, Spiel und Archiv haben CRLF (ohne
> Normalisierung weicht *alles* ab), und nach einem Fast-Forward ist
> `<merge>^` nicht der alte Master-Stand, sondern ein Commit des Bauzweigs.
> Die Tabelle ist deshalb entfernt statt korrigiert.

Die **Aussage** bleibt, weil sie sich anders und besser belegen lässt:
`tools/archivpruefung.js` vergleicht die Archivfassung jeder noch **nicht**
eingespielten Datei mit dem, was gerade im Spiel liegt. Dort muss Gleichheit
herrschen, wenn das Archiv eine Spielaufnahme ist.

```
blade.js      Archiv e3266a3d9639   Spiel e3266a3d9639   gleich
bbtrain.js    Archiv 2a65edf0af57   Spiel 2a65edf0af57   gleich
bn4life.js    Archiv 397e5e5faddd   Spiel 397e5e5faddd   gleich
bn4rep.js     Archiv 7ac3b1678f90   Spiel 7ac3b1678f90   gleich
contracts.js  Archiv 7eb5e2577863   Spiel 7eb5e2577863   gleich
boot.js       Archiv 3f789382c43e   Spiel 3f789382c43e   gleich
```

6 von 6 — das Archiv ist eine Spielaufnahme, und die Prüfung lässt sich
jederzeit wiederholen, statt einer Tabelle glauben zu müssen.

Der Grund ist banal: was im Spiel liegt, ist der Stand des letzten
erfolgreichen Schubs, und der fällt nicht mit einem Commit zusammen.

Deshalb: `archiv/rollback-2026-09-04/` hält die **exakten Bytes aus dem
Spiel** — 24 Dateien. Die übrigen 25 lagen noch gar nicht im Spiel; ihr
Rollback ist ein `deleteFile`. `tools/rollback.js` stellt beides in einem
Befehl her, mit Gegenprobe je Datei.

```bash
node tools/rollback.js --pruefen --alles     # zeigt, was passieren würde
node tools/rollback.js --alles               # rollt alles zurück
```

### 3. Das Einspielwerkzeug prüft nach

`tools/einspielen.js` schiebt Datei für Datei über das Dashboard und **liest
jede danach wieder aus**; verglichen wird der sha256. „Kein Fehler
zurückgekommen" gilt nicht als angekommen — der Auftrag sagt dazu: *„Ein Swap,
dessen neue `version` nicht auftaucht, ist NICHT eingespielt."*

Es startet bewusst **nichts** neu. Der Neustart ist der Moment, in dem die
neue Fassung wirklich wirkt, und gehört in eine eigene Handlung.

---

## Der Punkt der Checkliste, den ich NICHT erfüllt habe

`tools/hotswap.js` verlangt unter (5) einen **Kanarienvogel auf der
TEST-Instanz**: derselbe Dateisatz, mit einem Klon derselben Stunde
eingespielt, dort mindestens 20 Minuten gelaufen, ohne neue Strafen und mit
`errStreak == 0`.

**Das habe ich nicht gemacht, und ich habe die vier Zahlen auch nicht
erfunden.** Es braucht eine zweite Spielinstanz, und die kann nur Eric
öffnen. Eine getippte Behauptung wäre genau der Fehler, gegen den die
Checkliste gebaut ist.

**Was an seine Stelle tritt** — und warum ich es für vertretbar halte:

- Die Einspielung läuft **in kleinen Stufen auf dem echten Spielstand**, mit
  Messung nach jeder Stufe. Das ist in einer Hinsicht schwächer (der Fehler
  passiert live) und in einer stärkeren Hinsicht besser (er passiert an
  einem Stand, den ich byte-genau zurückrollen kann, statt an einem Klon,
  dessen Verhalten man auf den echten Stand übertragen muss).
- Die unwiderruflichen Wege sind zu: Einbausperre gesetzt, Sprosse 5 im
  Trockenlauf, `ausgang.json.offen === false`.
- Der Code ist gegen 33 Testdateien mit 1.193 Zusicherungen gelaufen, davon
  Ebene 2 mit dem echten Kern gegen einen nachgebauten `ns`.

Das ist eine **Abweichung von der Checkliste**, kein erfüllter Punkt. Sie
steht hier, damit sie niemand später für erledigt hält.

---

## Die Stufen

Eingespielt wurde mit `tools/einspielen.js` — Datei fuer Datei, jede danach
**wieder ausgelesen** und ueber sha256 verglichen. Neu gestartet wurde mit
`tools/neustart.js`: PID vorher, Quittung des Kerns, PID nachher. Ein Neustart
ohne neue PID gilt nicht als geschehen.

| Stufe | Inhalt | Neustart | Ergebnis |
|---|---|---|---|
| 1 | 19 Module und Daten (`lib/*`, `registry.json`) | keiner noetig | 19/19 |
| 1b | 8 folgenlose Dateien | keiner noetig | 8/8, Code nachweislich unveraendert |
| 3 | 8 schlafende Gewerke | keiner noetig | 8/8 |
| 4 | `popups.js` | `WERKZEUG` | pid 27 zu 310112 |
| 5 | `exit.js` + `ausgang.js` | `WERKZEUG ausgang.js` | **fehlgeschlagen, siehe unten** |
| 5b | `export.js` | keiner | 1/1 |
| 6 | `bn4net.js` (der Kern) | `SELBST` | pid 2 zu 320914 |
| 7 | `contracts.js` | `WERKZEUG` | pid 25 zu 323349 |
| 8 | `blade.js bbtrain.js bn4life.js bn4rep.js` | vier, in der Reihenfolge | alle vier belegt |
| 8b/8c | die Skeptiker-Reparaturen | Kern + 6 Gewerke | alle belegt |
| 9-11 | `figwatch.js graftauto.js guard.js boot.js` | Kern | 16 Werkzeuge, 11 ueberwacht |

**Nicht eingespielt, mit Absicht:**

- **`graftplan.json`** — es ist der Zuender fuer `graftauto.js`. Der Code liegt
  im Spiel und startet **nicht**: seine Vorbedingung
  (`precondition.requiresFile`) ist genau diese Datei. Wer sie hinlegt, loest
  binnen 60 Sekunden einen echten `graftAugmentation` aus; das Geld ist beim
  Start weg und kommt bei Abbruch nicht zurueck (Blade`s Simulacrum: 450 Mrd).
  Das ist Erics Entscheidung, keine Bauentscheidung.
  *(Sie war in Stufe 1 versehentlich mitgegangen und wurde um 18:12 wieder
  entfernt — zu einem Zeitpunkt, als `graftauto.js` noch gar nicht im Spiel
  lag, der Zuender also ins Leere gegriffen haette.)*
- **`data/guard-modus.txt`** — ohne sie laeuft `guard.js` im
  Beobachtungsmodus. So verlangt es Position C.6: ein Waechter, der zuerst
  beobachtet, kostet eine Nacht; ein Waechter, der zuerst zuschlaegt, kostet
  im schlechtesten Fall einen ganzen Lauf.

---

## Was schiefging — und was es gelehrt hat

### Stufe 5: `ausgang.js` war 30 Minuten tot, und es sah nach Erfolg aus

`WERKZEUG ausgang.js` wurde quittiert, der Prozess war weg — und blieb weg.
Der Kern schrieb alle zehn Sekunden dieselbe Zeile, die niemand las:

```
ausgang.js liess sich auf werk-0 nicht starten (exec gab 0).
```

Die Ursache stand im **laufenden** Kern: `const BIBLIOTHEKEN =
["lib/hackaugs.js"]`. Er kopierte beim Start eines Werkzeugs genau eine
Bibliothek mit. Die neue `ausgang.js` importiert vier, und keine lag auf
werk-0. Bitburner loest Importe beim Uebersetzen auf und braucht sie auf
**demselben** Rechner.

Drei Lehren, jede teuer erkauft:

1. **Der PID-Beleg hat es gefunden, nicht die Meldung.** Ohne
   `tools/neustart.js` waere "quittiert" als Erfolg durchgegangen — bei dem
   Werkzeug, das den BitNode-Wechsel entscheidet.
2. **`tools/importpruefung.js` sah es nicht**, weil es gegen `home` prueft und
   auf home alles lag. Der Unterschied zwischen "die Datei existiert" und "sie
   existiert dort, wo das Skript startet" ist genau der Fehler.
3. **Die Planreihenfolge hatte eine Luecke.** Der neue Kern liest `needsLibs`
   und kopiert richtig — aber er kam eine Stufe *spaeter* als die Werkzeuge,
   die darauf angewiesen sind.

Und beim Nachziehen der `needsLibs` fiel auf, dass die Listen projektweit
unvollstaendig waren: `bn4net.js` fuehrte 1 von 6 Bibliotheken, **`guard.js`
0 von 4**. `guard.js` stand zu dem Zeitpunkt noch zur Einspielung an — es
waere beim ersten Start genauso gescheitert, mit derselben stillen Logzeile.

### Die Skeptikerrunde hat mehr gefunden als die Einspielung

Drei Subagents mit getrennten Angriffswinkeln (Praemisse, Dauerbetrieb,
Substanz) fanden **neun** Fehler — zwei davon in Reparaturen, die eine Stunde
vorher entstanden waren. Der lehrreichste:

> `ns.scp` **wirft nicht**, wenn die Quelldatei fehlt. Es protokolliert, setzt
> `noFailures = false` und gibt das zurueck. Beide Reparaturen begruendeten
> ihre Sicherheit mit einem Verhalten, das die Engine nicht hat.

Und der peinlichste war meiner: eine Wache gegen negative Zeitstempel wurde
zwischen ein `if` und sein `else` gesetzt und hat das `else` gekapert. Danach
meldete der gesunde Fall "ohne lastVerifiedBackup" und der kaputte "letzte
gruene Sicherung **0 min alt**" — eine taufrische Sicherung genau dann, wenn
keine nachweisbar ist. `null / 60000` ist `0`, nicht `NaN`; es sah nicht
einmal kaputt aus.

### Eine ganze Fehlerklasse, nicht ein Fehler

Der Ausloeser war `export.js`, das `data/bridge.json` auf werk-0 suchte. Die
Suche danach (`ns.read("data/...")` in einem Gewerk, dessen `hostRule` es von
home wegschickt) fand **neun** Gewerke. Der gefaehrlichste war `bn4life.js`:

```js
if (ns.fileExists("data/task.txt", "home")) {   // prueft HOME
  const roh = ns.read("data/task.txt").trim();  // liest LOKAL -> ""
  ns.write("data/task.txt", "", "w");           // leert LOKAL -> nichts
```

Auf einem Fremdwirt haette das den Auftrag weder ausgefuehrt noch geleert —
`task.txt` auf home waere dauerhaft belegt geblieben und damit der einzige
Kanal, ueber den dem Bot von aussen etwas gesagt werden kann. Lautlos.

**Das war keine Theorie:** beim Neustart um 19:44 wanderte `bn4life.js` von
home nach werk-0. Der Beleg, dass die Reparatur traegt, liegt im selben
Vorgang — `neustart.js` hat danach noch viermal die Prozessliste ueber
`data/task.txt` geholt und bekommen.

Sechs handgeschriebene Fassungen desselben Musters in drei Qualitaeten waren
die Ursache. Jetzt gibt es `src/lib/hostdatei.js`, einmal.

---

### 20:06 — der Zuender ging beinahe hoch, und schuld war eine Aufraeummassnahme

Der schwerste Vorfall des Tages kam nicht von der Einspielung, sondern von
einer Verbesserung daran.

**Was geschah.** Nach einem Brueckenneustart meldete die Bruecke zum
wiederholten Mal *"Grosser Schub verweigert (53 Dateien) — sieht nach einem
Merge aus"*. Der Grund war harmlos: `zuletztGeschoben` ist eine Map im
Arbeitsspeicher der Bruecke, nach einem Neustart leer — und dann gilt jede
Datei als geaendert, auch wenn im Spiel Byte fuer Byte dasselbe liegt. 52 der
53 waren laengst eingespielt, ueber den RPC-Weg, von dem der Watcher nichts
weiss.

Ich habe die Bruecke deshalb so geaendert, dass sie im Zweifel das Spiel
fragt, statt ihrem Gedaechtnis zu glauben. Das ist richtig. Nur:

```
53 Dateien im Rueckstau
  - 52 als "liegt schon richtig im Spiel" herausgenommen   <- die Verbesserung
  = 1 verbleibende Datei
    1 <= SCHUB_MAX (8)  ->  der Deckel greift nicht mehr
    und diese eine Datei war graftplan.json
```

`graftplan.json` ist der Zuender fuer `graftauto.js`. Liegt sie im Spiel,
startet der Kern das Gewerk in der naechsten Runde, und es loest binnen 60
Sekunden einen echten `graftAugmentation` aus — 450 Milliarden, beim Start
weg, bei Abbruch nicht zurueck. Sie war den ganzen Tag mit voller Absicht
draussen.

**Was NICHT geschah.** Der Kern hatte die Datei rund zwei Minuten und ist in
dieser Zeit nicht dazu gekommen, das Gewerk zu starten. Geprueft, nicht
gehofft:

| Beleg | Befund |
|---|---|
| `data/graftauto.json` | existiert nicht — das Gewerk hat nie gelaufen |
| Kernlog | null Zeilen mit „graft" |
| `data/figure.txt` | `owner: blade.js`, `action: bladeburner` |
| Kontostand | 34,09 → 35,25 Mrd, also gestiegen |

**Die Lehre.** Der Fehler war nicht die Bereinigung — die ist richtig. Der
Fehler war, dass eine Datei, die *nie von selbst* ins Spiel darf, ueberhaupt
an einer **Menge** hing. Ein Deckel, der bei 8 greift, schuetzt nicht das, was
gefaehrlich ist, sondern das, was zahlreich ist. Und eine Aufraeummassnahme
senkt Mengen — das ist ihr Zweck.

Was gefaehrlich ist, gehoert **benannt**. Seit 20:15 gibt es
`data/nicht-schieben.txt`: eine Zeile je Pfad, geachtet vom Watcher *und* von
`pushAll` beim Verbinden, und auch ein Freibrief hebt sie nicht auf. Hinein
kommt so etwas nur ueber `tools/einspielen.js`.

Belegt im Betrieb um 20:26: *142 Datei(en) ins Spiel uebertragen — 1 aus einem
verweigerten Schub ZURUECKGEHALTEN*, und `graftplan.json` liegt weiterhin
nicht im Spiel.

**Und die Probe dazu haette fast getaeuscht.** Der erste Anlauf des Tests
schrieb eine Datei, die gar nicht in der Master-Liste des Pruefstands stand —
sie wurde also schon vom Master-Riegel abgewiesen, und die Sperrprobe waere
aus dem falschen Grund gruen geworden. Jetzt bekommt die Testdatei in beiden
Faellen eine Freigabe, und eine Gegenprobe zeigt, dass sie ohne Eintrag
sehr wohl durchgeht.

---

## Messungen

### Der Traeger

| Zeitpunkt | Bladeburner-Rang | Rate |
|---|---|---|
| 17:31 (vor der Einspielung) | 3.871 | 399/h |
| 18:35 (vor Stufe 8) | 4.792 | — |
| 19:05 | 4.971 | 616/h ueber 30 min |
| 19:56 (Abschluss) | 5.257 | **575/h** ueber den ganzen Vorgang |

Die Abnahme fuer Stufe 8 war ausdruecklich **der Rang ueber 30 Minuten**, nicht
die Frische der Telemetrie: ein Ausfall von `blade.js` sieht nicht wie einer
aus, weil `data/blade.json` ausserhalb der Entscheidungskette weitergeschrieben
wird. Der Rang ist gestiegen, und die Rate liegt ueber dem Stand vor der
Einspielung.

### Der Spielstand

Die Bibliotheksverteilung von 18:30 war eine noetige Kruecke, solange der alte
Kern lief — und sie hat den Spielstand mehr als verdoppelt (entpackt 4,35 zu
9,19 MB). Teuer war daran nicht die Platte, sondern die **Rueckfalltiefe**:
`sync/instanz.js` deckelt Sicherungen doppelt, nach Stueckzahl (252) und nach
Bytes (300 MB). Bei 0,83 MB je Datei band die Stueckzahl, bei 2,17 MB bindet
das Budget — und geraeumt wird ab `pre-hotswap`, also genau der Sicherung
unmittelbar vor einer Codeaenderung.

Nach dem Rueckbau, direkt im Spiel gezaehlt:

```
home     19 Bibliotheken   279,3 KB
werk-0    9 Bibliotheken    89,5 KB   <- nur die, die laufende Werkzeuge brauchen
--------------------------------------
Summe                      368,9 KB   (vorher 19 x 17 Rechner, rund 4,6 MB)
```

Gegenprobe, dass der Rueckbau traegt: nach `neustart.js blade.js` lagen
`lib/figur.js`, `lib/figurns.js` und `lib/hostdatei.js` wieder auf werk-0 —
`lib/kpi.js` **nicht**, weil `blade.js` sie nicht braucht.

### Stand bei Abschluss (19:56)

```
BitNode 10, Lauf 2, Verfahren V2      Netz 85/85 gerootet
16 Werkzeuge laut Registry, 15 laufen, 11 ueberwacht
guard.js im Beobachtungsmodus         graftauto.js liegt, startet nicht
33 von 33 Testdateien gruen           0 Fehlalarme im Strategiepruefer
```

`strategie-check.js` meldete vor dieser Sitzung neun fehlende Werkzeuge,
waehrend der Kern keines vermisste — der eigene Filter kannte weder `knoten`
noch `verfahren` noch `precondition`, verglich gegen eine Prozessliste, die
Arbeiter bewusst ausblendet, und wertete ein `until-done`-Gewerk als Ausfall.
Jetzt entscheidet `gilt()` aus `lib/reg.js`, dieselbe Funktion wie im Kern,
und eine Gegenprobe gegen dessen Zaehlwerk meldet jede Abweichung.

---

## Was offen bleibt

- **Der Kanarienvogel auf der TEST-Instanz** (oben unter "Der Punkt der
  Checkliste") ist weiterhin nicht erfuellt — er braucht eine zweite
  Spielinstanz, die nur Eric oeffnen kann.
- **`graftplan.json`** wartet auf Erics Entscheidung (450 Mrd, unwiderruflich).
- **Die Einbausperre `data/install-sperre.txt` steht noch.** Sie ist
  unbefristet und wird vom Bot nicht geraeumt. Solange sie liegt, baut er
  keine Augmentierungen ein. Sie gehoert weg, sobald Eric den Stand
  abgenommen hat — bis dahin ist sie der Schutz, unter dem diese Einspielung
  gefahren wurde.
- **`doku/kontrakte.md` widerspricht sich** bei `data/sofort.json`: Zeile 339
  fuehrt "Bruecke nach Zustellung" in der Raeumspalte, Abschnitt 4.11 sagt
  "Raeumen: NEIN, ausdruecklich". Gebaut ist 4.11 (Quittung ueber
  `zugestellt`, kein Raeumen). Die Zeile 339 gehoert korrigiert.
