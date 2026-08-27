# Loop 5: Kurs

*Alles ab der nächsten Zeile ist der Prompt und wird wörtlich an CronCreate übergeben.*

BITBURNER-KURS (Loop 5 von 5). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

Die vier anderen Loops arbeiten alle auf einer Zeitskala von 20 Minuten bis 3 Stunden. Das Projekt läuft auf hunderte Stunden. Dieser Loop ist der einzige, der **nach oben** schaut: Fahren wir überhaupt in die richtige Richtung, und wie weit ist es noch?

**Er entscheidet nichts am Motor und repariert nichts.** Er setzt den Kurs, an dem sich der Optimierloop ausrichtet. Wenn du dich in `src/` wiederfindest, bist du im falschen Loop.

## Warum es diesen Loop gibt

Am 27.08.2026 stellte sich heraus, dass der Ausgang aus BitNode 6 Bladeburner-Rang **400.000** verlangt, während der Stand nach 50 Stunden bei 6.910 lag — also 1,7 Prozent. Die Zahl stand seit dem ersten Tag in `reference/bitburner-src/src/Bladeburner/data/BlackOperations.ts`. Sie musste nie gemessen werden, nur gelesen. Sechs Stunden Loop-Arbeit waren vorher in Mikro-Optimierungen geflossen, weil kein Loop den Auftrag hatte, die Frage zu stellen.

Die Ursache war ein Zirkelschluss: Der Optimierloop bekam seine Leitgröße im Prompt vorgeschrieben und las zur Bestätigung `nodes/HEBEL.md` — wo derselbe Satz stand. **Deshalb liest dieser Loop `nodes/HEBEL.md` NICHT.** Er leitet jedes Mal neu aus dem Quellcode her. Das ist keine Umständlichkeit, das ist der ganze Zweck.

## Ablauf

**1. Die Ausgangsbedingung des Knotens aus dem Quellcode herleiten.**

```
date
cd /c/Users/erche/Desktop/claude_projecto/bitburner && node tools/strategie-check.js
cat nodes/KURS.md 2>/dev/null || echo "(erster Lauf)"
```

Dann im Quellcode nachschlagen — **nicht aus dem Gedächtnis, nicht aus Projektdateien.** Der vollständige Spielcode liegt unter `reference/bitburner-src/src/` (v3.0.2).

Für den aktuellen BitNode zu beantworten:
- **Was genau muss geschehen, damit der Knoten abgeschlossen ist?** Ausgangspunkt ist `NetscriptFunctions/Singularity.ts` (`destroyW0r1dD43m0n`) und `BitNode/BitNode.tsx` für die Multiplikatoren des Knotens. Es gibt oft **mehrere** Wege — prüfe sie alle und rechne sie durch, statt den erstbesten zu nehmen.
- **Welche Zahl ist dabei der Engpass, und wie weit ist sie entfernt?** Absolut, nicht relativ: nicht „wir sind schneller geworden", sondern „X von Y, also Z Prozent".
- **Was zählt bereits auf das Ziel ein, das noch nicht mitgerechnet ist?** Am 27.08. lagen 73.660 Rang allein in den `rankGain`-Werten der ersten zwanzig Black Ops — 18 Prozent der Strecke waren doppelt gezählt.

**2. Die Restzeit rechnen — und die Annahme dahinter offenlegen.**

Eine lineare Fortschreibung ist fast immer falsch. Prüfe, ob die Rate sich selbst beschleunigt: In BitNode 6 erzeugt der Rang über `skillPoints = floor(maxRank/3)` (`Bladeburner/data/Constants.ts`) bei **linear** steigenden Fähigkeitskosten (`Bladeburner/Skill.ts:37-41`) eine Rückkopplung, also `dR/dt ~ R^a` mit a zwischen 0,4 und 0,6 statt a = 0. Der Unterschied betrug am 27.08. **Faktor 4** (443 gegen 104 Stunden).

Nimm die eigene Messreihe als Gegenprobe: Wenn die Rate über den bisherigen Verlauf um Faktor 6 gestiegen ist, ist a = 0 widerlegt, ohne dass man den Exponenten kennen muss.

**3. Genau drei Entscheidungen — mehr gibt es hier nicht.**

- **Weiterfahren.** Der Kurs stimmt, die ETA sinkt. Nichts zu tun.
- **Zwischenschritt einlegen.** Ein Reset, eine Augmentierungsrunde, ein Verfahrenswechsel innerhalb des Knotens. Das muss **gerechnet** sein: Was überlebt den Schritt, was kostet er, was bringt er? In BitNode 6 überleben Rang, Fähigkeitspunkte, Fähigkeits- und Aktionsstufen einen Einbau vollständig (`Prestige.ts:153-154` ruft nur `resetAction()` + `joinFaction()`), nur die Kampfwerte fallen — und die kommen mit besseren Multiplikatoren um Faktor 17 schneller zurück, weil die Stufe multiplikativ im Multiplikator, aber nur logarithmisch in der Erfahrung ist (`PersonObjects/formulas/skill.ts:13`).
- **Der Knoten wird falsch gefahren.** Ein anderer Weg zum Ausgang ist billiger. Das ist die seltenste, aber teuerste Entscheidung — belege sie mit beiden Rechnungen nebeneinander.

**Die BitNode-REIHENFOLGE ist davon nicht berührt.** Sie steht durch Fables Analyse fest (`nodes/AUDIT-ROADMAP-2026-08-24.md`) und wird von niemandem geändert, auch nicht von diesem Loop. Hier geht es allein darum, **wie** der aktuelle Knoten gefahren wird, nicht welcher als nächstes kommt.

**4. `nodes/KURS.md` fortschreiben.** Neuer Eintrag oben, alte bleiben stehen — der Vergleich der ETAs über die Läufe ist der eigentliche Wert dieser Datei.

```
## <TT.MM.>, <HH:MM> - BitNode <n>

Ausgangsbedingung: <was genau erfüllt sein muss, mit Fundstelle>
Engpass:           <die Zahl, absolut: X von Y = Z %>
Restweg:           <netto, nach Abzug dessen, was unterwegs anfällt>
Rate:              <gemessen, über welches Fenster>
ETA:               <Spanne mit Exponent> | Vorlauf: <ETA des letzten Eintrags>
Leitgröße:         <die eine Zahl, auf die der Optimierloop optimiert>
Entscheidung:      weiterfahren | Zwischenschritt: <welcher> | Kurswechsel: <welcher>
Nächste Prüfung:   <woran man beim nächsten Lauf erkennt, ob es trägt>
```

Die Zeile **Leitgröße** ist die wichtigste: Der Optimierloop liest sie und richtet sich danach. Steht dort etwas Falsches, arbeiten vier Loops zwölf Stunden lang in die falsche Richtung. Schreib sie so, dass sie eine Zahl nennt, nicht eine Absicht — „Bladeburner-Rang je Minute" ist eine Leitgröße, „effizienter werden" ist keine.

**5. Die Abbruchregel.** Steigt die ETA **zweimal in Folge**, ist der Knoten falsch gefahren, nicht langsam. Dann ist die Entscheidung nicht „weiterfahren", sondern eine der beiden anderen — und wenn keine davon rechnerisch trägt, gehört das als Befund oben in `nodes/BAUSTELLEN.md` unter `## Sofort`, damit der Vorankommensloop es aufgreift.

**6. Committen und pushen.** Nur `nodes/KURS.md` und was du sonst selbst geändert hast (`git add <pfad>`, nie `git add -A`). Vor dem Push `git pull --rebase`.

## Ausgabe

**Höchstens 5 Stichpunkte:** Ausgangsbedingung, Engpass mit absoluter Zahl, ETA gegen die des Vorlaufs, Entscheidung, Leitgröße für die nächsten zwölf Stunden. Zwischen 22:30 und 5:00 gibst du nichts im Chat aus — Eric liest es morgens in `nodes/KURS.md`.

## Was dieser Loop NICHT tut

- **`nodes/HEBEL.md` lesen.** Das ist die Ausgabe des Optimierloops. Wer sie als Quelle nimmt, wird zu einem zweiten Optimierloop und der Zirkelschluss ist wieder da.
- **`src/` anfassen.** Kein Motor, keine Werkzeuge, keine Skripte im Spiel. Wenn du einen Fehler findest, ist er ein Eintrag in `nodes/BAUSTELLEN.md`.
- **Die BitNode-Reihenfolge bewerten.** Sie steht fest.
- **Raten.** Findest du die Ausgangsbedingung im Quellcode nicht, schreib das hin und lass die Leitgröße des Vorlaufs stehen. Ein falscher Kurs ist teurer als ein alter.

**Hintergrundtasks legen die Loops still.** Ein schwebender `run_in_background`-Task oder Monitor blockiert ALLE Cron-Jobs der Sitzung bis zu seinem Ende; verpasste Feuerungen verfallen. Das `timeout` gilt im Hintergrund NICHT. Deshalb: Warteschleifen nur mit harter Grenze (`for i in $(seq 1 20); do ...; sleep 30; done`, nie `until`), Monitor nur mit knappem `timeout_ms` und nie `persistent: true`, und vor dem Turn-Ende prüfen, ob ein Task zurückbleibt.

Regeln: Systemzeit per `date`, nie schätzen. Keine Augmentierungen von Hand kaufen. NIEMALS einen zweiten Tab auf bitburner-official.github.io öffnen. Kein b1tflum3, kein Destroy-Knopf.
