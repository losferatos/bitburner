# Der Prüfstand

Stand 04.09.2026. Aufruf: `node tools/test-alles.js` (alle), `--schnell` (nur
die kurzen). Exit 0 heißt grün; Stufe A verlangt zusätzlich eine **leere
Lückenliste**, und die druckt derselbe Lauf am Ende aus.

## Die vier Ebenen

Der Prüfstand ist in Ebenen geteilt, weil jede etwas anderes kann und jede
etwas anderes **nicht** kann. Wer das vermischt, hält eine Ebene-0-Probe für
einen Beweis über das laufende Spiel.

| Ebene | Was läuft | Was sie beweist | Was sie nicht kann |
|---|---|---|---|
| **0** | reine Funktionen, ohne `ns` | Formeln, Automaten, Tabellen | nichts über Abläufe |
| **1** | Quelltext-Prüfungen (grep, AST) | Regeln über den Code selbst | nichts über Laufzeit |
| **2** | echter Bot-Code gegen einen `ns`-Mock | Abläufe über Runden, mit steuerbarer Zeit | keine Spielmechanik |
| **3** | echter Browser, echte Instanz | alles Übrige | braucht den Tab |

**Ebene 2 ist die Ebene, die lange fehlte.** Geprüft wurden nur reine
Funktionen und der echte Browser; dazwischen nichts. Der Motorzeit-Einbau, die
Registry-Auflösung und der Strafleiter-Automat liegen alle in dieser Lücke.

## Der ns-Mock

`tools/mock/ns.js`. Er bildet die **Schnittstelle** nach, nicht die Spiellogik:
er rechnet nicht, wie schnell ein Server wächst, und kennt keine
Bladeburner-Wahrscheinlichkeiten. Was der Code daraus macht, ist der
Prüfgegenstand.

**Die steuerbare Zeit ist der Punkt.** `mock.vor(8 * 3600000)` lässt acht
Stunden vergehen, ohne acht Stunden zu warten. Damit werden genau die Fälle
prüfbar, die im echten Betrieb Tage brauchen und deshalb nie geprüft werden:
eine Offline-Nacht, ein gedrosselter Tab, ein Nachholklumpen. Und beide Uhren
laufen getrennt — `wall` und `playtime` —, denn ihr Auseinanderlaufen **ist**
der Fall, den die Motorzeit erkennen muss.

**Seit dem 04.09.2026 kostet Speicher etwas.** Vorher gab `getScriptRam` jedem
Skript pauschal 2,4 GB und `exec` buchte nichts ab; alle Ebene-2-Tests prüften
damit eine Welt ohne Speichergrenze — ausgerechnet die zur Platzreservierung.
Jetzt kommen die Größen aus derselben `registry.json`, die auch der Kern liest,
mit SF4-Faktor 16 (sonst hält man ein 32-GB-home für geräumig: `bn4life.js`
misst 23,85 statt 293,85 GB). `exec` gibt bei Platzmangel `0` zurück, wie das
Spiel.

Wer einen Aspekt **ohne** Knappheit prüfen will, sagt es ausdrücklich:
`ramBuchen: false`, oder er nennt eigene Größen in `skriptRam`.

**Wo er rät, sagt er es**: jede nicht implementierte Funktion wirft mit einer
Meldung, die den Namen nennt. Ein stiller `undefined`-Rückgabewert wäre
schlimmer als ein Fehler — er fälscht das Ergebnis, statt es zu verhindern.

## Der Modul-Lader

`tools/mock/lader.js`. Bitburner löst Importe absolut ab home auf
(`import { x } from "lib/y.js"`); Node sucht dann ein Paket namens `lib`.
Deshalb liest der Lader die Datei, schreibt die **Importzeile** um, legt das
Ergebnis als Wegwerfdatei neben das Original und importiert von dort.

Zwei Eigenschaften, die er haben muss:

- **Er ändert nur die Importzeile.** Ein Lader, der den Prüfgegenstand
  verändert, prüft etwas anderes als das, was später läuft.
- **Er löst transitiv auf.** `graftauto.js` importiert `lib/figurns.js`, und das
  importiert `lib/figur.js` — beim zweiten Sprung fände Node wieder ein Paket
  namens `lib`. Bis zum 04.09. hatte kein lib-Modul eigene Importe; seither
  schon.

Die Kopien liegen neben den Originalen (damit die relativen Pfade stimmen) und
werden im `finally` alle wieder entfernt. Jeder Ebene-2-Test prüft am Ende, dass
kein `.mock-`-Rest in `src/` liegengeblieben ist — er ginge über die Brücke ins
laufende Spiel.

## Die Testdateien

28 Stück (Stand 04.09.2026). Die Liste mit einer Zeile je Datei, was sie deckt,
steht in `tools/test-alles.js` — dort und nicht hier, damit sie nicht
auseinanderläuft.

Vier davon sind besonders erwähnenswert:

- **`test-ram.js`** eicht den nachgebauten RAM-Rechner gegen 114 im Spiel
  gemessene Werte. 113 stimmen exakt; die eine Abweichung ist eine unabhängige
  Bestätigung — die Differenz beträgt genau 32,00 GB, also `singularity.connect`
  bei SF4.1.
- **`test-loeser-verify.js`** stellt den 30 Vertragslösern 219 **verfälschte**
  Antworten und verlangt, dass jede abgelehnt wird. Er liest zusätzlich den
  Quelltext daraufhin, ob eine Gegenprobe ihren eigenen Löser aufruft — das
  Kennzeichen der Tautologie, und das lässt sich nicht wegtesten, nur
  wegschreiben.
- **`test-kaltstart-budget.js`** rechnet die Startlage nach: was passt neben
  Kern, Wächter und Wachhalter auf ein 32-GB-home, und in welcher Reihenfolge.
- **`test-verbote.js`** prüft Regeln über den Code selbst (Ebene 1), etwa dass
  jedes figurberührende Gewerk vorher fragt.

## Der Klon und der Zeitraffer

`tools/klon.js` erzeugt aus dem Live-Spielstand einen Klon für die
TEST-Instanz. Die TEST-Instanz läuft auf einem **eigenen RFA-Port** (12526) und
einem eigenen Dashboard-Port (8796) — die Trennung hängt am Port, nicht am
Identifier, denn den erbt der Klon.

Die Brücke bricht ohne `--instance` ab. Es gibt keinen Standardwert; ein
versehentliches LIVE ist damit ausgeschlossen, und schreibende RPC-Methoden
verlangen `instance=<Rolle>` im Aufruf.

## Was der Prüfstand nicht kann

Die Lückenliste am Ende von `tools/test-alles.js` ist die verbindliche Fassung.
Sie nennt, was gemessen werden müsste und nicht gemessen ist — Ebene 3 im
Wesentlichen: ein echter Kaltstart auf 32 GB, die Vertragskette im Spiel, je
Sprosse ein provozierter Hänger, BitNode 8 und 9, Grafting über Stunden.

Ein grüner Lauf ist kein Beweis über das Spiel. Er ist ein Beweis, dass der
Code die Zustände richtig behandelt, die der Mock stellen kann.
