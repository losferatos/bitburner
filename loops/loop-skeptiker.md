# Loop 6: Skeptiker

*Der Prompt beginnt bei der ersten Zeile, die mit `BITBURNER-` anfaengt.*

BITBURNER-SKEPTIKER (Loop 6 von 6). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

**LAUTLOS-SCHALTER — als Allererstes pruefen.** Fuehre `test -f data/lautlos && echo LAUTLOS` aus. Kommt `LAUTLOS`, gibst du in diesem Lauf **nichts im Chat aus**: kein Bericht, kein Stichpunkt, kein Wort, keine Zahl. Du arbeitest ganz normal weiter — alle Befunde gehen in die Dateien und Commits. Per ntfy meldest du dann nur, was keinen Aufschub duldet.

Die fuenf anderen Loops **bauen**. Dieser Loop ist der einzige, der fragt:
**Stimmt eigentlich, was die anderen gestern gebaut haben?**

## Warum es diesen Loop gibt

Am 30.08.2026 wurden zwischen 07:00 und 13:00 sechs Aenderungen am laufenden
Bot eingebaut, jede mit einer Messung "verifiziert". Eine spaetere
Skeptiker-Runde fand in zwoelf Minuten:

- Eine Zeitpruefung mass **Echtzeit** gegen eine Aktion, die in **Spielzeit**
  laeuft. Bei gedrosseltem Tab wirkungslos; nach einer Offline-Nacht haette
  die Engine 25-fach nachgeholt und einen Kennwert von 25 auf ueber 1000
  getrieben — der Knoten waere praktisch tot gewesen.
- Ein neuer Rueckfall verfehlte seine Abschlussbedingung um **eine Sekunde**,
  jedes Mal: Abschluss bei 61 s, eigener Takt 60 s. Er lieferte null und war
  schlechter als der Zustand davor.
- Vier von vier eigenen Rechnungen waren falsch — sequenzielle Mutation
  uebersehen, Additivitaet nicht geprueft, aehnliche Feldnamen verwechselt,
  Umgebungsmultiplikator vergessen.

Alle sechs Aenderungen galten als "klein" und bekamen deshalb keinen
Skeptiker. **Die Einstufung war der Fehler, nicht die Zeilenzahl.**

Und der Grund, warum dieser Loop mit **Subagenten** arbeitet und nicht selbst
prueft: Wer eine Aenderung geschrieben hat, prueft sie mit denselben
Annahmen, aus denen der Fehler entstand. Ein Subagent startet ohne diesen
Kontext. Das ist nicht Bequemlichkeit, das ist der Wirkmechanismus.

## Ablauf

**1. Was ist seit dem letzten Lauf passiert?**

```
date
cd /c/Users/erche/Desktop/claude_projecto/bitburner
cat data/skeptiker-stand.txt 2>/dev/null || echo "(erster Lauf)"
git log --oneline --stat "$(cat data/skeptiker-stand.txt 2>/dev/null || echo 'HEAD~10')..HEAD" -- src/ tools/
```

Interessant sind **nur Aenderungen an Code, der unbeaufsichtigt weiterlaeuft**
— also alles unter `src/`, dazu `tools/wache.js` und `tools/aufsicht.js`.
Aenderungen an `nodes/*.md` sind Dokumentation und nicht dein Thema; die
prueft der Kursloop, wenn er die Zahlen benutzt.

Ist seit dem letzten Lauf nichts an diesen Dateien geaendert worden: nichts
tun, Stand fortschreiben, Turn beenden. Ein Skeptiker ohne Angriffsziel ist
kein Skeptiker.

**2. Drei Subagenten, drei getrennte Angriffswinkel.**

Starte sie **parallel** in einem Zug. Jeder bekommt: die geaenderten
Codestellen (Datei und Zeilen aus `git show`), den Auftrag **Schwachstellen
zu finden statt zu bestaetigen**, und den Hinweis, dass der vollstaendige
Spielquellcode unter `reference/bitburner-src/src/` liegt (v3.0.2).

**Jedem Subagenten ausdruecklich mitgeben: nichts schreiben.** Kein
`pushFile`, keine Aenderung an Projektdateien, kein Eingriff ins laufende
Spiel. Nur lesen, rechnen, berichten.

*Winkel A — Die Rechnung.* Jede Zahl in der Aenderung und in ihrem Kommentar
gegen den Quellcode nachrechnen. **Die Formel als ausfuehrbaren Code
nachbauen und gegen einen unabhaengig bekannten Wert eichen** (ein Feld aus
dem Spielstand, eine gemessene Dauer) — erst dann gilt sie. Besonders pruefen:
Lesen zwei aufeinanderfolgende Aufrufe denselben oder den schon veraenderten
Zustand? Sind zwei Raten Alternativen oder kumulativ? Ist ein aehnlich
benanntes Feld verwechselt worden? Fehlt ein Multiplikator der laufenden
Umgebung (in Bitburner: `BitNode/BitNode.tsx`, der `case` des aktuellen
Knotens)?

*Winkel B — Zeit und Takt.* Welche Uhr misst die Aenderung, und laeuft die
beobachtete Sache in derselben? Was passiert bei gedrosseltem Hintergrundtab
(die Engine verarbeitet dann hoechstens 5 Spielsekunden je Tick), was beim
Nachholen nach Offline-Zeit (bis zu 25-fach), was nach einem Neustart des
Werkzeugs? Greift die Aenderung dann noch, greift sie zu oft, oder gar nicht?
Und: Kollidiert ein neuer Takt mit einer fremden Abschlussbedingung — wird
etwas neu gesetzt, kurz bevor es fertig geworden waere?

*Winkel C — Der Zustand.* Was tut die Aenderung, wenn die Daten, auf die sie
sich stuetzt, veraltet oder leer sind? Vorrat null, HP null, Puffer voll,
Datei aelter als der Takt, Rueckgabewert `true` ohne dass etwas passiert ist.
Und die Gegenfrage: Ist die **gemessene Zahl**, mit der die Aenderung
begruendet wurde, ueberhaupt eine Rate — oder speist sie sich aus einem
Vorrat, der sich erschoepft?

**3. Synthetisieren, nicht durchreichen.**

Nur die Einwaende, die standhalten, mit eigener Einschaetzung. Sag ausdruecklich,
welche du **nicht** uebernimmst und warum. Ein Subagent, der drei Bedenken ins
Blaue formuliert, ist so nutzlos wie einer, der zustimmt.

**4. Handeln — und zwar nach Schadensklasse.**

- **Belegter Fehler, der unbeaufsichtigt Schaden anrichtet** (Endlosschleife,
  Kennwert ausser Kontrolle, etwas laeuft nie fertig): **sofort beheben**.
  Grenzen wie bei den anderen Loops — hoechstens eine Datei, hoechstens 30
  geaenderte Zeilen, `node --check`, danach `node tools/strategie-check.js`,
  einzeln committen. Kannst du es nicht in dieser Groesse beheben, **nimm die
  Aenderung zurueck** (`git revert <commit>`) und trag den Grund ein. Im
  Zweifel gilt der alte Zustand — er lief nachweislich.
- **Belegter Fehler ohne unmittelbaren Schaden** (falsche Zahl in einem
  Kommentar, zu hohe Schwelle, ungenutzte Variable): Eintrag oben in
  `nodes/BAUSTELLEN.md` unter `## Sofort`, mit Fundstelle und der richtigen
  Zahl. Nicht selbst anfassen — das ist Arbeit fuer den Vorankommensloop.
- **Verdacht ohne Beleg:** verwerfen. Nicht eintragen. Eine Liste von
  Bedenken, die niemand pruefen kann, macht die Arbeitsliste unbrauchbar.

**5. Stand fortschreiben.**

```
git rev-parse HEAD > data/skeptiker-stand.txt
```

**Erst nachdem** deine eigenen Commits durch sind — sonst prueft der naechste
Lauf deine Korrektur nicht mit.

**6. Committen und pushen.** Nur was du selbst geaendert hast
(`git add <pfad>`, nie `git add -A`). Vor dem Push `git pull --rebase`.

## Ausgabe

**Hoechstens 3 Stichpunkte:** was geprueft wurde (Anzahl Aenderungen), was
gefunden wurde, was daraus folgte. Haelt alles, genuegt ein Satz — und das
ist ein gutes Ergebnis, kein langweiliges.

Bei `data/lautlos` gibst du gar nichts aus. **Ausnahme:** Ein Fehler, den du
zurueckgenommen hast, geht per ntfy raus — Eric muss wissen, wenn eine
Aenderung wieder verschwunden ist.

## Was dieser Loop NICHT tut

- **Selbst pruefen statt Subagenten schicken.** Der ganze Zweck ist der
  fremde Blick. Wer selbst nachrechnet, wiederholt die Annahmen des Autors.
- **Neue Hebel suchen.** Das ist der Optimierloop. Dieser hier greift nur an,
  was schon gebaut wurde.
- **Dokumentation pruefen.** `nodes/*.md` ist nicht sein Thema.
- **Bedenken sammeln.** Was nicht belegt ist, wird verworfen, nicht notiert.

**Hintergrundtasks legen die Loops still.** Ein schwebender
`run_in_background`-Task oder Monitor blockiert ALLE Cron-Jobs der Sitzung bis
zu seinem Ende; verpasste Feuerungen verfallen. Subagenten sind davon nicht
betroffen und ausdruecklich erwuenscht — Warteschleifen und Monitore nicht.

Regeln: Systemzeit per `date`, nie schaetzen. Keine Augmentierungen von Hand
kaufen. NIEMALS einen zweiten Tab auf bitburner-official.github.io oeffnen.
Kein b1tflum3, kein Destroy-Knopf.
