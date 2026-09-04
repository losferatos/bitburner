# Leichen aus dem Spiel — entfernt am 04.09.2026, 16:33

Diese 19 Dateien lagen auf `home` im laufenden Spiel, ohne dass es sie in
`bitburner/src` noch gab. Sie stammen aus früheren Sitzungen. **Ihr Inhalt
ist hier gesichert, bevor sie gelöscht wurden** — jede Datei liegt als Kopie
neben dieser Datei, Schrägstriche im Pfad durch `_` ersetzt.

Zurück ins Spiel käme jede von ihnen mit einem `pushFile` über das Dashboard.
Nichts ist verloren.

## Wie geprüft wurde, dass sie weg dürfen

| Prüfung | Ergebnis |
|---|---|
| exakte Nennung in `src/*.js` (`"name"` oder `'name'`) | **keine einzige** |
| Engine-Sperre gegen laufende Skripte | 19 Löschungen, 19 Erfolge ⇒ keine lief |
| `mtime` im Spiel | 1,9 bis 12,0 Tage alt, keine heute berührt |
| Inhalt vor dem Löschen gesichert | **19 von 19** |
| Gegenprobe nach dem Löschen | 0 Treffer, 271 → 252 Dateien |

**Die Frage „lief eine davon noch?" ist gegenstandslos — und der Beweis lag
die ganze Zeit vor mir.** Ein Skeptiker hat es gefunden:

```
reference/v301/src/Server/BaseServer.ts:190
  if (this.isRunning(path))
    return { res: false, msg: "Cannot delete a script that is currently running!" };
```

Der RFA-Weg geht genau dort durch (`RemoteFileAPI/MessageHandlers.ts:143-147`
macht aus `res:false` eine Fehlerantwort). **Die Engine löscht ein laufendes
Skript nicht.** Und die Gegenprobe steht schon oben: 271 → 252 sind exakt 19
erfolgreiche Löschungen. Wäre eine gelaufen, wären es 18 gewesen.

Ich hatte den Beweis in der Hand und habe ihn nicht erkannt — stattdessen
stand hier ein besorgter Absatz über eine Gefahr, die es nicht gibt. Der Satz
„ein laufendes Skript überlebt das Löschen seiner Datei" war schlicht falsch:
das Löschen findet gar nicht erst statt.

**Die Regel für künftige Aufräumaktionen:** `deleteFile` ist gegen laufende
Skripte engineseitig gesperrt. Wer 19 Löschungen absetzt und 19 Erfolge
zurückbekommt, hat damit auch bewiesen, dass keine davon lief.

Die Sicherung der Inhalte war trotzdem richtig — nur aus einem anderen Grund:
gegen die Möglichkeit, dass eine der Dateien später doch gebraucht wird.

## Das Prüfkriterium war zu eng — zwei sind keine Leichen

Geprüft wurde „existiert nicht mehr in `bitburner/src`". **`kick.js` und
`unkick.js` existieren sehr wohl** — unter `tools/einmal/`, angelegt am
02.09.2026, also zwei Tage alt. Sie sind in `nodes/BAUSTELLEN.md:236,269` als
Handwerkzeuge des Kaltstarts dokumentiert.

Nachgeprüft: `tools/einmal/kick.js` ist **byte-identisch** mit der
Rettungskopie. Schaden also keiner — die Dateien liegen weiter im Repo, und
ihr Weg ins Spiel führt ohnehin über `data/task.txt`, nicht über den Watcher.
Aber das Kriterium hätte auch scharf danebengreifen können.

**Für das nächste Mal:** gegen den **ganzen Baum** prüfen, nicht nur gegen
`src/`. `tools/einmal/` ist genau der Ordner für „liegt absichtlich nicht in
src".

## Die drei bemerkenswerten

- **`src/sleeve.js`** (12.821 Zeichen) und **`src/wbgrow.js`** (2.468) — mit
  falschem Pfad-Präfix `src/` ins Spiel geschoben. Sie lagen also **doppelt**
  neben den richtigen `sleeve.js` / `wbgrow.js`. Die Fassung von
  `src/sleeve.js` im Spiel war vom 28.08. und rund 9 KB kleiner als die
  aktuelle — ein alter Stand unter einem Namen, den niemand ansieht.
- **`lib/combataugs.js`** (8.950) — war einmal ein Import von `bn4rep.js`
  (Commit `08d07be`). Heute nennt ihn nur noch ein Kommentar, und
  `src/lib/hackaugs.js:194` hält ausdrücklich fest, dass der Inhalt dorthin
  gewandert ist.

## Die vollständige Liste

```
augtest.js        coreprobe.js      kick.js           lib/combataugs.js
parkprobe.js      psdiag.js         rammess.js        ramprobe.js
ramtest.js        rpdiag.js         sfprobe.js        skilltest.js
sleeveinfo.js     spieler.js        src/sleeve.js     src/wbgrow.js
synctest.js       unkick.js         wachestat.js
```

## Zurückgenommen: `data/ps.json` ist NICHT kaputt

In der ersten Fassung dieser Datei stand hier ein „Nebenbefund": der
Prozessspiegel sei seit 72 Stunden nicht geschrieben worden, `ps.js` also
vermutlich gestorben. **Das war falsch, und ich nehme es zurück.**

`src/ps.js` ist ein **Einmalskript** (25 Zeilen, kein `while`, kein `sleep`):
es läuft einmal, schreibt `data/ps.json`, beendet sich. Gestartet wird es über
`data/task.txt`. Das Alter der Datei ist also das Alter der letzten Diagnose,
nicht die Laufzeit eines Ausfalls — und dass `ps.js` in dem Spiegel als
„laufend" steht, ist trivial: es sieht sich selbst, während es misst.

Ich habe aus einer Zahl einen Defekt gemacht, ohne die Datei zu lesen, die sie
erzeugt. Das ist dieselbe Fehlerklasse wie die zurückgenommene E.2-Triage vom
selben Tag — eine Behauptung, die eine Prüfung ersetzt.

**Was davon stehen bleibt, und es ist der wichtigere Teil:** Als ich löschte,
hatte ich **keinen aktuellen Prozessspiegel**. Der einzige, den es gab, war
drei Tage alt. Die Aussage „keine der 19 lief" ist damit nicht belegt, sondern
plausibel — und CLAUDE.md sagt dazu: *„Ein Ausschluss ist nur gültig, wenn das
benutzte Werkzeug den ausgeschlossenen Fall überhaupt anzeigen könnte."*
Genau deshalb wurde jede Datei vorher gesichert; die Rettung ersetzt den
Nachweis nicht, aber sie macht den Fehlerfall billig.

**Für das nächste Mal:** vor einer Löschaktion im Spiel erst
`node tools/task.js "ps.js"` absetzen und `data/ps.json` frisch lesen. Ein
Einmalskript liefert nur dann eine Aussage über die Gegenwart, wenn man es in
der Gegenwart startet.

## Nachgeholt: der Nachweis, 16:47

Genau das habe ich dann getan — und dabei fiel auf, **warum** es vorher nicht
ging: `tools/task.js` war seit Commit `f6a61e5` kaputt. Die Brücke verlangt
seither `instance=LIVE` für jede schreibende Methode, und acht Werkzeuge
schickten den Parameter nicht mit. Darunter `task.js` und `hand.js` — laut
`doku/kontrakte.md:341` „die einzigen Wege, von außen etwas im Spiel zu
bewirken". Der externe Reparaturweg war stillgelegt, ohne dass es jemandem
aufgefallen wäre.

Nach der Korrektur, frischer Spiegel (0,78 min alt):

```
home      bn4net.js  bn4life.js  blade.js  bbtrain.js  sleeve.js
          homegrow.js  contracts.js  bn4rep.js  bn4door.js
iron-gym  ausgang.js  wakelock.js  popups.js
werk-1    ps.js
```

**Keine der 19 gelöschten Dateien läuft.** Der Ausschluss ist damit gemessen
statt plausibel — nachträglich, aber gemessen. Und der Bot arbeitet mit
dreizehn Gewerken auf drei Rechnern normal weiter.
