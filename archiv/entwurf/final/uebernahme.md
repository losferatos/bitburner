# Zusammengefuehrte Fassung - Uebernahme

Stand 20.08.2026, 06:40. Diese Fassung fuehrt **beide** Entwuerfe zusammen:

- `entwurf/autopilot.js` + `entwurf/lib/batch.js` + `entwurf/worker/*` (HWGW-Stapel)
- `entwurf/robust/*` (sieben Robustheitsbefunde nach dem Totalausfall)

Alle vier Korrekturen vom 20.08. sind erhalten. Nichts committet, nichts nach
`src/` geschrieben.

---

## 1. Wichtig zuerst: `src/autopilot.js` ist ein bewegtes Ziel

Waehrend dieser Zusammenfuehrung wurde `src/autopilot.js` **viermal**
weitergeschrieben (06:18, 06:19, 06:36, 06:37). Die Zusammenfuehrung ist auf
den Stand von **06:37:41** aufgesetzt:

```
md5 der Grundlage   b7046d485f44aa2a4f758e0913c367c7
Kopie davon         entwurf/final/basis/autopilot.js
```

Alles aus diesem Stand ist enthalten: die Hand samt Pulswache und
Einkaeufer-Ausweichen, `factionPaths` mit Zehn-Runden-Puffer, die
Selbstbeendigung nach 40 Runden ohne Verwalter.

**Vor dem ersten Kopierbefehl pruefen, ob seither noch etwas dazugekommen ist:**

```powershell
fc.exe entwurf\final\basis\autopilot.js src\autopilot.js
```

Meldet das einen Unterschied, hat jemand nach 06:37:41 weitergeschrieben. Dann
diese Aenderung **erst in `entwurf/final/autopilot.js` nachziehen** - sonst
loescht die Uebernahme sie.

---

## 2. Die Widersprueche und wie sie entschieden sind

| # | Streitpunkt | Entwurf A (Stapel) | Entwurf B (robust) | Entscheidung |
|---|---|---|---|---|
| 1 | Erntanteil | `chooseFraction`: kleinstes f, das das RAM-Budget fuellt, begrenzt durch die Kalenderdichte `tWeaken/(4*gap)` | `pickHackFraction`: groesstes f, dessen VOLLER Zyklus ins Budget passt (0.02 bis 0.4) | **Beide, je Betriebsart.** Sie loesen verschiedene Aufgaben: A rechnet mit Stapeln, die vier Auftraege gleichzeitig halten und deren Zahl der Kalender begrenzt; B rechnet mit einem Wellenzyklus, der nacheinander laeuft. Im Stapelbetrieb gilt A, im Wellenbetrieb B. Die feste `HACK_FRACTION = 0.1` aus beiden Vorlagen entfaellt ganz. |
| 2 | Sicherheitsschwelle | Stapel verlangen `secMin + 0.001` und 99.9 % Guthaben | `secTolerance(s) = max(1, secMin*0.1)` statt fester 3 | **Beide, je Betriebsart.** Kein echter Widerspruch: A beschreibt die Vorbedingung fuer einen Stapel, B den Massstab fuer Erntereife im Wellenbetrieb. |
| 3 | Sperrkasse aus einem frueheren Leben | (nicht behandelt) | auf `Guthaben * 0.5` deckeln | **Keins von beidem.** Die Deckelung haette die Sperrkasse als Werkzeug zerstoert: sie ist das Sparbuch fuer Augmentierungen (der Nachtdienst setzt 4 Mrd) - beim Sparen liegt der Betrag naturgemaess dauerhaft ueber dem halben Guthaben, der Verwalter haette die andere Haelfte verbaut und das Sparziel nie erreicht. Ebenso waere `node tools/reserve.js 1e12` als Messbremse wirkungslos geworden. Stattdessen: **unterhalb von 200 000 Dollar (Preis des TOR-Routers) wird eine Sperre ganz ignoriert.** Darunter gibt es nichts, wofuer sich sparen liesse. Oberhalb gilt sie unveraendert. Nach dem Reset (1262 Dollar) ist der Verwalter damit sofort handlungsfaehig - besser als mit der Deckelung, die ihm 631 Dollar gelassen haette, zu wenig fuer den 1000-Dollar-Knoten. |
| 4 | Vorbereitung vor oder nach der Ernte | erst Vorbereitung (Urfassung), dann umgedreht mit `PREP_RESERVE = 0.25` | Ernte zuerst (Korrektur 4) | **Ernte zuerst.** Im Stapelbetrieb zusaetzlich `PREP_RESERVE`, im Wellenbetrieb nicht noetig: eine Erntewelle bestellt nur den Fehlbetrag eines Zyklus und kann den Speicher gar nicht leerraeumen. |
| 5 | Feldnamen `busy.hack` | umbenannt in `hackT/growT/weakenT`, spart 0.40 GB | unveraendert | **Umbenannt.** Der Befund stimmt (`Script/RamCalculations.ts`, Besucher `Identifier` und `MemberExpression` buchen jeden Bezeichner, der auf eine ns-Funktion passt). Die Telemetrie schreibt trotzdem weiter `busy: {hack, grow, weaken}` - Schluessel in Objektliteralen kosten nichts, nur Zugriffe. Dashboard und Bruecke bleiben unveraendert. |

### Ein Fehler, den beide Entwuerfe nicht hatten und der beim Zusammenfuegen entstanden waere

Die Rangfolge in Entwurf A trennt nach `phase === "prep"`. Beim Zusammenfuegen
lag es nahe, "alles ausser `batch`" zu schreiben - dann bekaeme aber auch ein
Ziel im Zustand `drain` weiter Auftraege. `drain` endet erst, wenn **nichts
mehr laeuft**; wer dort nachlegt, haelt das Ziel fuer immer im Auslaufen. Im
Code steht jetzt ausdruecklich `=== "prep"` mit Begruendung daneben.

---

## 3. Was die Fassung nach einem Reset tut - nachgerechnet

Die Lage: 116 GB, 8 Rechner, 1262 Dollar. Die 116 GB sind genau
`home 16 + n00dles 4 + 6 x 16` - die sieben Rechner der Ebene 1 plus home
(Werte aus `reference/v301/src/Server/data/servers.ts`, `moneyMax = 25 x
moneyAvailable`, `minDifficulty = round(hackDifficulty/3)`).

**Der Stapelbetrieb ist dort komplett abgeschaltet.** `ramTotal = 114 < 400`,
also `batchMode = false`: es laeuft ausschliesslich der Wellenzweig, der aus
dem laufenden `src/autopilot.js` stammt. Kein Kalender, keine Termindisziplin,
kein `GAP_MS` - genau die Teile, die nie im Spiel gemessen wurden, sind nach
einem Reset nicht aktiv.

Die Zahlen der Runde 1:

| Groesse | Wert | Folge |
|---|---|---|
| `ramTotal` | 114 GB | Wellenbetrieb |
| `maxTargets` | `max(2, floor(114/2000)) = 2` | zwei Ziele ernten |
| `prepTargets` | `max(1, floor(114/4000)) = 1` | EIN Ziel vorbereiten |
| tatsaechlich frei | rund 96 GB | home 6.45 (16 - 9.55 Autopilot - 2 Puffer), ein 16er traegt den Verwalter (10.75), Rest voll |
| `ramShare` | 114 / 1 bis 3 Ziele = 38 bis 114 GB | Budget je Ziel |
| Erntanteil n00dles | f = 0.05 bei 38 GB, f = 0.2 bei 114 GB | passt |
| Erntanteil joesguns | f = 0.02, Zyklus 66 GB > 38 GB Budget | wird mit `!` angezeigt und trotzdem gefahren |
| groesste grow-Bestellung | `floor(96 * 0.85 / 1.75) = 46` Faeden = 81 GB | passt; ihr Ausgleich 4 Faeden = 7 GB passt auch |

Der Punkt, an dem der Bot in der Nacht zum 20.08. stehen blieb: ein Ziel bei
4 % Guthaben braucht 4605 grow-Faeden; deren Ausgleich waere 8060 GB. Der
Deckel begrenzt die Bestellung auf 46 Faeden, und der Ausgleich wird **danach**
aus den 46 tatsaechlich gestarteten bemessen. Nichts blockiert.

**Simulation ueber 90 Minuten** (Wirkungen und Laufzeiten aus `reference/v301`
nachgebaut, Landungen ereignisgesteuert, Erfolgswahrscheinlichkeit
eingerechnet, Sicherheitszuwachs auch bei Misserfolg gebucht - also
pessimistisch):

| Hacking-Level | neue Fassung | heutiger `src`-Stand | erste Ernte |
|---|---|---|---|
| 1 | $3.63m | $3.51m | nach 158 s |
| 10 | $7.40m | $7.15m | nach 134 s |
| 50 | $12.94m | $12.49m | nach 81 s |
| 100 | $19.68m | $19.06m | nach 54 s |
| 230 | $37.26m | $35.98m | nach 29 s |

Mit zusaetzlich 20 GB fuer die Erfahrungsmuehle aendert sich das um weniger als
3 %. **In keinem Lauf wurde mehr Speicher bestellt als vorhanden** (Zaehler
`ueberbucht` blieb 0), und in keinem Lauf blieb die erste Ernte aus. Der
Gewinn von 3 bis 4 % kommt allein aus dem gewaehlten Erntanteil; er ist klein,
weil nach einem Reset ohnehin n00dles den Ton angibt. Wichtig ist nicht der
Gewinn, sondern dass die Fassung dort **nicht schlechter** ist.

Zusaetzlich ist die zusammengefuehrte Datei **selbst** gelaufen, gegen ein
nachgebautes `ns` (Trockenlauf ueber 40 Runden je Lage, beide Betriebsarten,
Level 1 bis 250, mit und ohne vorbereitete Ziele). Das faengt, was eine
Syntaxpruefung nicht sieht: Tippfehler, nicht definierte Namen, falsche
Feldzugriffe. Ergebnis: kein Laufzeitfehler, kein `exec`, das mehr Speicher
verlangt hat als der Rechner hatte, und in jeder Lage tatsaechlich abgesetzte
Auftraege - im kleinen Netz 31 grow und 3 weaken je Runde, im grossen ueber
40 Runden 5230 Ernte-, 19262 Wachstums- und 3898 Ausgleichsfaeden.

Skripte: `resetcheck.js`, `dryrun.js`, `batchcheck.js` im Arbeitsordner dieser
Sitzung. Nicht mitgeliefert, weil der Bot sie nicht braucht - die Zahlen stehen
hier, damit sie nachvollziehbar sind.

**Eine Beobachtung, die man kennen sollte:** Nach dem Reset liegen rund 37 der
96 nutzbaren GB brach. Grund ist `prepTargets = 1`: das einzige
Vorbereitungsziel ist n00dles, und das braucht wegen seines Wachstumswerts von
3000 nur 31 grow-Faeden, um von 4 % auf 100 % zu kommen. Das ist die gewollte
Wirkung von Korrektur 1 (Konzentration statt Breite) und **kein** neuer Fehler -
der heutige `src`-Stand verhaelt sich identisch. Wer das aendern will, aendert
den Teiler 4000, aber nicht ohne die Rechnung aus der Nacht zum 20.08. noch
einmal zu machen.

### Was nach einem Reset NICHT laeuft

`hand.js` kostet 29.35 GB. Der groesste Rechner hat dann 16 GB - die Hand
findet nirgends Platz und meldet das jetzt auch ("Fuer die Hand ist nirgends
Platz"). Sie startet von selbst, sobald der Verwalter einen 32-GB-Rechner
gekauft hat. Das ist kein Fehler dieser Fassung, es steht hier nur, damit
niemand danach sucht.

---

## 4. Uebernahme, Schritt fuer Schritt

Voraussetzung: Bruecke laeuft (`node sync/bridge.js`), Spiel verbunden.
**Die Reihenfolge ist nicht Geschmackssache.** Die Bruecke buendelt Aenderungen
mit 400 ms Verzoegerung; kommt `autopilot.js` vor `lib/batch.js` im Spiel an,
laesst er sich nicht auswerten ("Cannot calculate RAM usage of an invalid
script"), und der Verwalter startet fuenf Sekunden lang ins Leere.

### Schritt 0 - Sicherung und Grundmessung (5 Minuten)

```powershell
Copy-Item src\autopilot.js entwurf\final\rollback-autopilot.js -Force
fc.exe entwurf\final\basis\autopilot.js src\autopilot.js
```

Die Sicherung ist der Rollback-Stand. Die zweite Zeile muss "keine
Unterschiede" melden - sonst siehe Abschnitt 1.

```powershell
node tools/status.js
(Invoke-RestMethod http://localhost:8795/api/state).telemetry.player.money
```

Fuenf Minuten warten, Kontostand erneut ablesen, Differenz durch 300 =
**Basisrate in $/s**. Notieren. Vergleichswert vom 20.08. 06:20: rund
**37 000 $/s** bei 14 996 GB Netz und Level 250.

Die Sperrkasse fuer die Messung **nicht** setzen: `tools/reserve.js 1e12`
haelt zwar den Verwalter an, aber der gekaufte Speicher ist Teil dessen, was
gemessen werden soll. Stattdessen beide Laeufe mit laufendem Verwalter fahren.

### Schritt 1 - Arbeiter (unkritisch)

```powershell
Copy-Item entwurf\final\worker\*.js src\worker\ -Force
```

**10 Sekunden warten.** Die neuen Arbeiter sind abwaertskompatibel: fehlt
`args[2]` oder ist es keine Zahl, greift `args[1]`. Der laufende Autopilot
uebergibt dort eine Kennung wie `1787199526988-0` - `Number(...)` davon ist
`NaN`, der Rueckfall greift also sauber. Auf die Flotte kommen die neuen
Arbeiter erst beim Neustart in Schritt 3.

Pruefen: `telemetry.cycle` steigt weiter, keine neuen Eintraege "Fehler in
Runde".

### Schritt 2 - Bibliotheken

```powershell
Copy-Item entwurf\final\lib\calc.js src\lib\ -Force
Copy-Item entwurf\final\lib\batch.js src\lib\ -Force
```

**15 Sekunden warten.** Auch `lib/calc.js` ist abwaertskompatibel: die neuen
Parameter `costs` haben einen Vorgabewert, der alte Autopilot ruft weiter mit
drei Argumenten auf. `lib/batch.js` importiert er gar nicht.

Pruefen, dass beide Dateien wirklich im Spiel liegen:

```powershell
Invoke-RestMethod "http://localhost:8795/api/rpc?method=calculateRam&filename=lib/batch.js&server=home"
```

Erwartet: **1.6** - das ist die Grundlast, die jedes Skript hat; zum
Autopiloten steuert `lib/batch.js` nichts bei, weil es keine einzige
ns-Funktion aufruft (`lib/calc.js` misst sich zum Vergleich ebenso mit 1.6).
Kommt ein **Fehler**, **nicht weitergehen** - ohne `lib/batch.js` ist der neue
Autopilot nicht startbar.

### Schritt 3 - Autopilot

```powershell
Copy-Item entwurf\final\autopilot.js src\autopilot.js -Force
```

Ab hier laeuft die Uhr. Der alte Autopilot erkennt die neue Fassung binnen
einer Runde, beendet sich, der Verwalter startet die neue binnen 5 s.

**Sofort danach den Speicherbedarf messen** - das ist die einzige Pruefung, die
nicht warten darf:

```powershell
Invoke-RestMethod "http://localhost:8795/api/rpc?method=calculateRam&filename=autopilot.js&server=home"
```

Erwartet: **9.15**. Der heutige Stand kostet 9.55; die 0.40 GB Ersparnis kommt
aus der Umbenennung der `busy`-Felder. **Nicht gemessen, sondern hergeleitet** -
kommt stattdessen 9.55 heraus, ist das ebenfalls in Ordnung (dann greift die
Umbenennung nicht, sonst aendert sich nichts). Kommt ein **Fehler** oder ein
Wert **ueber 14**, sofort zurueckrollen: home hat 16 GB, und 2 GB davon sind
Puffer.

**Was in den ersten Minuten normal ist:** Alle Ziele beginnen in `prep`. Der
Stapelbetrieb setzt exakt 100 % Guthaben und Mindestsicherheit voraus - bei
den aktuellen 81 % auf `phantasy` dauert das ein bis drei Minuten. In dieser
Zeit faellt der Ertrag ab, bevor er steigt. Das ist kein Fehler.

### Schritt 4 - Wellenprobe (empfohlen, 10 Minuten)

Der Wellenzweig ist der, der nach dem naechsten Reset laeuft - und er laeuft
sonst nie, solange das Netz gross ist. Er gehoert also einmal im Spiel gesehen,
statt erst um vier Uhr morgens:

In `src/autopilot.js` voruebergehend `const BATCH_MIN_RAM = 400;` auf
`1e12` setzen, speichern, 10 Minuten laufen lassen, dann zurueckstellen.

Erwartet: in der Lage steht "Wellenbetrieb, Netz unter 1000000000000 GB", in
der Zielliste erscheint hinter "Im Einsatz" ein `f`-Wert je Ziel (bei diesem
Netz `f40.0%`), der Ertrag faellt auf einen Bruchteil, und `telemetry.cycle`
laeuft ohne Fehlermeldung durch. Genau **das** ist der Beweis, dass die
Reset-Lage nicht verklemmt. Danach zuruecksetzen nicht vergessen.

### Schritt 5 - Verwalter, Muehle, Nachtdienst (erst nach der 30-Minuten-Messung)

```powershell
Copy-Item entwurf\final\invest.js src\invest.js -Force
Copy-Item entwurf\final\xp.js src\xp.js -Force
```

**Getrennt vom Autopiloten uebernehmen**, damit eine Verschlechterung
zuzuordnen ist. Der Autopilot erkennt die neue Fassung des Verwalters selbst,
beendet den alten Prozess und startet den neuen.

`nightshift/agent.js` liegt **nicht** unter `src/` und wird nicht
mitsynchronisiert:

```powershell
Copy-Item entwurf\final\nightshift\agent.js nightshift\agent.js -Force
```

Wirksam wird das erst beim naechsten Start des Nachtdienstes - ein laufender
Prozess liest die Datei nicht neu.

---

## 5. Was nach Schritt 3 zu messen ist

| Zeitpunkt | Was pruefen | Sollwert |
|---|---|---|
| sofort | `calculateRam autopilot.js` | 9.15, hoechstens 9.55, nie ueber 14 |
| +60 s | `telemetry.cycle` steigt, `telemetry.events` ohne "Fehler in Runde" | Runden laufen |
| +3 min | `telemetry.events` enthaelt "ist vorbereitet - Stapelbetrieb beginnt" | mindestens ein Ziel im Stapel |
| +5 min | `telemetry.batching.active` | `true` (Netz ueber 400 GB) |
| +5 min | `telemetry.batching.expectedPerSec` | > 0 |
| +10 min | Kontostand-Differenz / 600 | mindestens die Basisrate aus Schritt 0 |
| +30 min | Kontostand-Differenz / 1800 | Rechnung sagt Faktor 1.5 bis 3 gegenueber der Basisrate |
| +30 min | Kontostand-Differenz / 1800 gegen `batching.expectedPerSec` | hoechstens Faktor 1.5 auseinander |
| +30 min | Sicherheitsspalte der Stapelziele im Spielfenster | gruen, `sec` gleich `secMin` |
| +30 min | `telemetry.targets[].hackFraction` | zwischen 0.01 und 0.5, nicht dauerhaft am Anschlag |

Alles in einem Aufruf:

```powershell
(Invoke-RestMethod http://localhost:8795/api/state).telemetry |
  Select-Object cycle, phase, reason,
    @{n="stapel";e={$_.batching.newBatches}},
    @{n="erwartet";e={$_.batching.expectedPerSec}},
    @{n="geld";e={$_.player.money}}
```

Die Groesse, auf die es ankommt, ist **`batching.expectedPerSec` gegen den
tatsaechlichen Kontozuwachs**. Klaffen die dauerhaft um mehr als Faktor 1.5
auseinander, landen Stapel in der falschen Reihenfolge - und das ist der eine
Fehler, der ein Ziel leerraeumt, statt nur langsamer zu sein.

---

## 6. Abbruchkriterien

Jede Zeile fuer sich genuegt. Nicht diskutieren, zurueckrollen.

| # | Wenn ... | ... dann |
|---|---|---|
| A | `calculateRam` auf `autopilot.js` gibt einen Fehler oder einen Wert ueber **14** | sofort zurueck |
| B | nach **2 Minuten** steigt `telemetry.cycle` nicht, oder in `events` steht wiederholt "Fehler in Runde" | sofort zurueck |
| C | nach **15 Minuten** hat kein Ziel den Stapelbetrieb erreicht UND kein `moneyPct` ist um mindestens 10 Punkte gestiegen | zurueck - das ist die Stillstandssignatur vom 20.08. |
| D | nach **30 Minuten** liegt der gemessene Kontozuwachs unter dem **1.2-fachen** der Basisrate | zurueck - die Rechnung sagt 1.5 bis 3 |
| E | ein Stapelziel steht laenger als **2 Minuten** bei `sec > secMin + 1`, und das wiederholt sich nach der automatischen Neuvorbereitung ein zweites Mal | zurueck - die Termindisziplin haelt nicht, `GAP_MS` ist zu klein |
| F | `moneyPct` eines Stapelziels faellt unter **30 %** und bleibt dort ueber 5 Minuten | zurueck - das Ziel blutet aus |
| G | in der Wellenprobe (Schritt 4) steht nach **3 Minuten** kein einziges Ziel auf "ernten" | zurueck - der Reset-Zweig traegt nicht, und das ist das wichtigste Kriterium ueberhaupt |

Fuer C, E und F gilt: die Drifterkennung faengt Einzelfaelle selbst ab
(`drain` -> `prep`, sichtbar als "laeuft aus der Reihe"). Erst die
**Wiederholung** ist das Signal.

---

## 7. Zurueckrollen

```powershell
Copy-Item entwurf\final\rollback-autopilot.js src\autopilot.js -Force
```

Das genuegt. Warum: die neuen Arbeiter sind abwaertskompatibel, die neue
`lib/calc.js` ebenfalls (alle neuen Parameter haben Vorgabewerte), und
`lib/batch.js` wird von der alten Fassung nicht importiert - es darf liegen
bleiben und kostet 0 GB.

Nach **60 Sekunden** pruefen:

```powershell
(Invoke-RestMethod http://localhost:8795/api/state).telemetry |
  Select-Object cycle, reason
```

Steht dort wieder "Ziel(e) werden abgeschoepft, ... vorbereitet" und steigt
`cycle`, ist der alte Stand zurueck. Aendert sich `cycle` nicht, im
Spielterminal `run autopilot.js` von Hand.

Wurde auch Schritt 5 schon gemacht, zusaetzlich:

```powershell
git checkout -- src/invest.js src/xp.js
```

(`nightshift/agent.js` ebenso - alle drei sind unveraendert im letzten Commit.)

---

## 8. Was offen bleibt

1. **`GAP_MS = 400` ist nie im Spiel gemessen worden**, nur simuliert. Das ist
   das groesste verbliebene Risiko des Stapelteils. Nicht senken, bevor die
   tatsaechliche Streuung der Landungen gemessen ist - unterhalb der echten
   Streuung kippt der Ertrag, er faellt nicht sanft ab.
2. **Der Speicherbedarf 9.15 GB ist hergeleitet, nicht gemessen.** Die
   Herleitung stuetzt sich darauf, dass `acorn-walk` bei einer Property ohne
   berechneten Schluessel nur den Wert besucht. Schlaegt sie fehl, bleibt es
   bei 9.55 - schaedlich ist das nicht.
3. **Die Schwelle `BATCH_MIN_RAM = 400` ist an EINEM Ziel gerechnet**
   (`harakiri-sushi`, Level 219). Mit mehreren gleichzeitigen Zielen
   verschiebt sie sich nach oben, weil die Wellen dann mehr Speicher
   auslasten. Wer sie genauer haben will, misst nach dem naechsten Reset beide
   Betriebsarten je eine halbe Stunde.
4. **`ramShare = ramTotal / active.length`** teilt den GESAMTEN Speicher, nicht
   den freien. Wenn ein Zyklus rechnerisch passt, heisst das nicht, dass
   gerade Platz frei ist. In der Praxis entschaerft sich das, weil die
   grow-Phase erst Runden nach der hack-Phase anfaellt.
5. **Der Schwellenwert 0.4 beim Darkweb-Rueckhalt** ist geraten. Zu frueh
   bremst er den Serverausbau, zu spaet kommt der Knacker nie.
6. **Die Sperrkasse gilt ab 200 000 Dollar wieder unverkuerzt.** Steht dort
   nach einem Reset noch eine Milliardenschwelle und raeumt der Nachtdienst
   sie nicht weg, hoert der Verwalter oberhalb dieser Grenze wieder auf zu
   kaufen. Der Autopilot sagt es dann einmal im Verlauf ("bindet das ganze
   Guthaben - der Einkauf ruht"), aber er ueberstimmt die Datei nicht. Das ist
   Absicht: eine Sperre, die sich selbst aufhebt, ist keine.
7. **Nichts davon lief im Spiel.** Syntax geprueft, Formeln nachgerechnet,
   Wellenzweig simuliert - aber der Bot laeuft weiter auf dem alten Stand.
