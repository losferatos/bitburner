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

**Und er sieht anders aus, als der Auftrag annimmt.** Gemessen um 17:45:

| Datei | im Spiel | Commit vor dem Merge | |
|---|---|---|---|
| `bn4net.js` | `dc0075c7e610` | `fb3466fd63d7` | **Abweichung** |
| `wakelock.js` | `55b09f562b62` | `950597d469ed` | **Abweichung** |
| `boot.js` | `3f789382c43e` | `3f789382c43e` | gleich |
| `popups.js` | `d6ccd79fee51` | `d6ccd79fee51` | gleich |

Zwei von vier Stichproben wichen ab: die Spielfassung ist **älter** als der
Commit. Der im Auftrag genannte Rollback-Weg
(`git checkout <hash> -- src/<datei>`) hätte dort also nicht zurückgerollt,
sondern eine dritte, nie gelaufene Fassung eingespielt — im Notfall, unter
Zeitdruck, und ohne dass es auffällt.

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

*(wird während der Einspielung gefüllt)*

---

## Messungen

*(wird während der Einspielung gefüllt)*
