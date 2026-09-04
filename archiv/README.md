# archiv/ — was hier liegt und warum es nicht weg ist

Dieser Ordner ist **kein Papierkorb**. Er ist die Stelle, an die Dateien
wandern, die im Alltag nicht mehr im Weg stehen sollen, deren Inhalt aber
weiter zählt: gemessene Zahlen, gelöste Probleme, ein bewährter Vorgänger.

Gelöscht wird hier nichts. Wer etwas sucht, findet es — nur nicht mehr
zwischen den Dateien, die täglich angefasst werden.

## Die Regel

**`archiv/` liegt neben `src/`, nie darin.** Die Brücke (`sync/bridge.js`)
schiebt alles unter `src/` ins laufende Spiel, rekursiv. Ein `src/archiv/`
hätte also genau die Dateien ins Spiel geschoben, die gerade ausgemustert
wurden. Seit dem 04.09.2026 überspringt `collectScripts()` einen Ordner
namens `archiv` zusätzlich — das ist der zweite Riegel, nicht der erste.

## Was schon hier liegt

### `entwurf/` (41 Dateien, verschoben am 04.09.2026)

Die Vorgängerstände des Bots, aus der Zeit vor `bn4net.js`: mehrere
Generationen `autopilot.js`, die Vertrags- und Augmentierungs-Prototypen mit
ihren eigenen Prüfgeschirren (`pruefung.mjs`, `gameshim.mjs`), und die
Rollback-Fassungen.

Zehn davon sind byte-identisch mit einer heutigen `src/`-Datei, acht weitere
sind Dubletten innerhalb des Ordners. Der Rest sind eigenständige, ältere
Stände — deshalb wandert der Ordner als Ganzes und wird nicht ausgedünnt:
welcher der fünf `autopilot.js`-Stände welchen Fehler behob, steht nirgends
sonst.

**Zwei Dateien darin sind ausdrücklich keine Entwürfe**, sondern
Messprotokolle mit Zahlen, die nirgends sonst stehen:

- `entwurf/uebernahme.md` — Hacking 219, 45 von 95 Rechnern, 506 GB, $373/s
- `entwurf/batching-bericht.md`

Dazu `entwurf/robust/bericht.md` und `entwurf/final/uebernahme.md`. Wer eine
dieser Zahlen braucht, sucht hier, nicht in `nodes/`.

**Weiter gebraucht wird `entwurf/join/join.js`:** `doku/join-problem.md`
führt sie als die fertige Funktion für das Beitritts-Problem (`isTrusted`
blockt den Knopf), und die Messung dazu steht in `entwurf/join/probe.js`.
Beide sind Wissen, kein Abfall — sie liegen hier, weil sie nicht im Spiel
laufen, nicht weil sie erledigt wären.

## Was hier NICHT liegt, obwohl es nach Kandidat aussah

Die 62 unregistrierten Dateien unter `src/` (Auftrag 6.1, Liste in
`nodes/BAU-2026-09/ARCHIV-KANDIDATEN.md`). Zwei Kritiker haben am 04.09.2026
davon abgeraten, sie **jetzt** zu bewegen, und beide Gründe stehen:

1. **Der Hot-Swap steht noch aus.** Eine Massenbewegung in `src/` unmittelbar
   davor vergiftet die Fehlersuche: klemmt danach etwas, ist die erste Frage
   „lag es am Archivieren?" — und diese Frage kostet mehr, als das Aufräumen
   einbringt.
2. **Die Brücke hat keinen Löschpfad.** Alle 62 liegen bereits im Spiel und
   bleiben dort. Nach dem Verschieben hätte der Spielstand Code, dessen
   Quelle nur noch hier liegt — ein Zustand, den es vorher nicht gab. Das
   Aufräumen im Spiel (`deleteFile`) ist ein eigener Handgriff und gehört in
   denselben Arbeitsgang.

Dazu kam ein handfester Beinahe-Fehler: Auf der ersten Kandidatenliste
standen `punish.js` (Sprosse 5 der Strafleiter, vom Kern per `fileExists`
geprüft und bei Fehlen **stillschweigend als erledigt abgehakt**),
`lib/bitnodes.json`, `lib/blackops.json` und `graftplan.json` — allesamt
Dateien, die lebender Code **liest** statt ausführt, und die der Grep deshalb
nicht sah. Der Indikator „unregistriert und kein `exec`-Aufrufer" ist für
dieses Projekt zu grob: Handwerkzeuge werden über `data/task.txt` gestartet
und haben per Bauform nie einen Aufrufer.
