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

## Was er kosten darf

Der Loop laeuft **alle sechs Stunden**, nicht haeufiger, und startet in den
meisten Laeufen **gar keinen** Subagenten - weil nichts Ungepruftes da ist.
Das ist Absicht: Die erste Fassung sah drei Agenten alle zwei Stunden vor,
das waeren bei den heute gemessenen Agentengroessen rund **fuenf Millionen
Token am Tag** gewesen. Erics Einwand vom 30.08.: zu teuer.

Die Rechnung jetzt: vier Laeufe am Tag, davon vielleicht einer mit einem
eng beauftragten Agenten auf einen konkreten Diff - Groessenordnung 50.000
bis 80.000 Token. **Unter 100.000 am Tag statt fuenf Millionen.**

Wer das teurer macht, muss es begruenden. Der Loop ist ein Netz, keine
Qualitaetssicherung: Die eigentliche Pruefung passiert beim Bauen, und dort
darf sie kosten, weil sie gezielt ist.

## Ablauf

**1. Gibt es ueberhaupt etwas zu pruefen?**

```
date
cd /c/Users/erche/Desktop/claude_projecto/bitburner
cat data/skeptiker-stand.txt 2>/dev/null || echo "(erster Lauf)"
git log --format="%h %s" "$(cat data/skeptiker-stand.txt 2>/dev/null || echo HEAD~20)..HEAD" -- src/ tools/wache.js tools/aufsicht.js
```

**Zwei Filter, und beide sind streng — der Loop soll billig sein:**

- **Nur Code, der unbeaufsichtigt weiterlaeuft.** Also `src/` sowie
  `tools/wache.js` und `tools/aufsicht.js`. Alles andere ist nicht sein
  Thema: `nodes/*.md` ist Dokumentation, die uebrigen `tools/` laufen nur,
  wenn jemand sie aufruft.
- **Nur Commits ohne `[skeptiker]` in der Betreffzeile.** Wer eine Aenderung
  baut und dabei schon einen Skeptiker angesetzt hat, schreibt `[skeptiker]`
  in den Commit-Betreff. Dieser Loop ueberspringt solche Commits — er ist
  das Netz fuer **Vergessenes**, nicht die zweite Instanz fuer Geprueftes.

Bleibt danach nichts uebrig: **Stand fortschreiben, Turn beenden, keinen
Subagenten starten.** Das ist der Normalfall und soll es sein.

**2. EIN Subagent, drei Winkel, enger Auftrag.**

Nicht drei Agenten — einer. Und er bekommt den **konkreten Diff**
(`git show <hash> -- src/`), nicht den Auftrag, sich selbst umzusehen. Ein
breit beauftragter Pruefagent kostet leicht 200.000 Token; einer, der eine
Handvoll geaenderter Zeilen gegen den Quellcode haelt, kostet einen Bruchteil.

*Warum trotzdem ein Subagent und nicht du selbst:* Wer eine Aenderung
geschrieben hat, prueft sie mit denselben Annahmen, aus denen der Fehler
entstand. Der fremde Blick ist der Wirkmechanismus. Aber ein fremder Blick
auf zwanzig Zeilen genuegt dafuer.

**Der Auftrag an ihn — woertlich diese drei Winkel, in dieser Reihenfolge:**

*A — Die Rechnung.* Jede Zahl in der Aenderung und in ihrem Kommentar gegen
den Quellcode (`reference/bitburner-src/src/`, v3.0.2) nachrechnen. **Die
Formel als ausfuehrbaren Code nachbauen und gegen einen unabhaengig
bekannten Wert eichen** — erst dann gilt sie. Besonders: Lesen zwei
aufeinanderfolgende Aufrufe denselben oder den schon veraenderten Zustand?
Sind zwei Raten Alternativen oder kumulativ? Ist ein aehnlich benanntes Feld
verwechselt worden? Fehlt ein Multiplikator des aktuellen BitNode
(`BitNode/BitNode.tsx`)?

*B — Zeit und Takt.* Welche Uhr misst die Aenderung, und laeuft die
beobachtete Sache in derselben? Was bei gedrosseltem Tab (die Engine
verarbeitet dann hoechstens 5 Spielsekunden je Tick), was beim Nachholen nach
Offline-Zeit (bis 25-fach), was nach einem Neustart? Und: Kollidiert ein
neuer Takt mit einer fremden Abschlussbedingung — wird etwas neu gesetzt,
kurz bevor es fertig geworden waere?

*C — Der Zustand.* Was tut die Aenderung, wenn ihre Daten veraltet oder leer
sind? Vorrat null, HP null, Puffer voll, Rueckgabewert `true` ohne Wirkung.
Und: Ist die Zahl, mit der die Aenderung begruendet wurde, ueberhaupt eine
Rate — oder speist sie sich aus einem Vorrat, der sich erschoepft?

**Dem Subagenten ausdruecklich mitgeben: nichts schreiben.** Kein
`pushFile`, keine Aenderung an Projektdateien, kein Eingriff ins laufende
Spiel. Nur lesen, rechnen, berichten. Und: nur belegte Einwaende, keine
Bedenken ins Blaue.

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
