# HWGW-Stapelbetrieb fuer den Autopiloten

Entwurf vom 19.08.2026. Liegt bewusst unter `entwurf/` und nicht unter `src/` —
dort haengt der Auto-Sync dran, ein halb uebernommener Umbau wuerde die
laufende Flotte mitreissen.

---

## 1. Kurzfassung

| | |
|---|---|
| **Empfehlung** | Volles HWGW. Die "einfachere Zwischenstufe" ist nicht einfacher, sondern nur schlechter und instabiler. |
| **Erwarteter Ertragsfaktor** | **10- bis 20-fach**, je nach Ziel. In der Simulation auf `phantasy` bei 21 TB: 0.39 → 17.9 m\$/s. Gemessener Ist-Ertrag der ganzen Flotte: 1.06 m\$/s. |
| **RAM-Kosten** | **−0.40 GB.** Der Autopilot wird von 7.55 GB auf **7.15 GB** *kleiner*. `lib/batch.js` kostet 0 GB, die Arbeiter bleiben bei 1.70 / 1.75 / 1.75 GB. |
| **Groesstes Risiko** | Eine Laufzeit, die aus der falschen Sicherheitsstufe gerechnet wird. Der Fehler wirkt sich selbst verstaerkend aus und raeumt ein Ziel binnen Minuten leer — er faellt nicht sanft ab, er kippt. |

---

## 2. Warum ueberhaupt: die Messung

### Der Ist-Zustand ist nicht "unrund", er ist blind fuer den Speicher

Ueber die Bruecke im Sekundentakt gemessen, 121 Sekunden am 19.08.2026:

```
Ertrag (Untergrenze, nur positive Kontostandsspruenge)   1.06 m$/s
Flotte zu diesem Zeitpunkt                              ~10.7 TB
```

Waehrend der Arbeit an diesem Entwurf ist die Flotte weitergewachsen. Der
Stand am Ende:

```
Gesamtspeicher   167 876 GB
davon belegt      17 644 GB   (10.5 %)
frei             150 232 GB   (89.5 %)
im Flug: 475 hack, 8364 grow, 1245 weaken
```

**Neun Zehntel der Flotte stehen still.** Das ist kein Bruchteilsproblem und
auch kein Fragmentierungsproblem — es ist ein Bauprinzip: die heutige Logik
bestellt je Ziel nur den *Fehlbetrag* (`gewuenschteThreads − busy`). Ist der
einmal unterwegs, bestellt sie eine ganze weaken-Zeit lang nichts mehr. Je Ziel
und Zyklus laeuft also genau eine Welle. Zwei bis drei Minuten Wartezeit auf
ihre Landung sind der Normalfall.

Ein zweiter Beleg aus derselben Messung: das Verhaeltnis der Threads ist
**475 hack zu 8364 grow**, also 1:17.6. In einem korrekt bemessenen Stapel auf
`phantasy` liegt es bei 1:2.0. Der Speicher, der arbeitet, arbeitet also
ueberwiegend am Nachwachsen, nicht am Verdienen.

Die Simulation reproduziert genau das: die nachgebaute heutige Strategie
liefert 0.16 m\$/s (`harakiri-sushi`) bzw. 0.39 m\$/s (`phantasy`) — **und zwar
unveraendert bei 1 TB wie bei 50 TB**, mit 1 % Speicherauslastung. Das deckt
sich mit der Wirklichkeit (1.06 m\$/s ueber acht bis vierzehn Ziele verteilt)
und ist der beste Beleg dafuer, dass das Modell trifft.

### Was HWGW dagegen bringt

Ereignissimulation, 2 Stunden Spielzeit je Lauf, alle Wirkungen exakt nach
`reference/v301` nachgebaut (inklusive der Sicherheitsdeckel, der additiven
1 \$ je grow-Thread, der Erfolgswahrscheinlichkeit und der Kappung des
hack-Sicherheitszuwachses auf `ceil(1/pct)` Threads). Ertrag in m\$/s bei
21 380 GB:

| Ziel | heute | Fliessarbeit ohne Zeitsteuerung | HWGW |
|---|---|---|---|
| `phantasy` (600 m\$) | 0.39 | 4.75 | **17.9** |
| `harakiri-sushi` (100 m\$) | 0.16 | 0.14 | **10.5** |
| `joesguns` (62 m\$) | — | — | **7.2** |

Die Skalierung mit dem Speicher (HWGW, jeweils bestes f):

| | 4 TB | 10 TB | 21 TB | 50 TB | 100 TB |
|---|---|---|---|---|---|
| `phantasy` | 3.9 | 9.5 | 19.5 | 26.0 | 33.8 |
| `harakiri-sushi` | 2.3 | 5.6 | 10.1 | 11.6 | 11.8 |

Man sieht die Saettigung: **ein einzelnes Ziel kann nur begrenzt viel Speicher
binden.** Zwischen zwei Stapeln muessen vier Landungen Platz haben, in eine
weaken-Zeit passen also nur `tWeaken/(4·gap)` Stapel. Bei 164 TB Flotte ist
Breite (viele Ziele) daher genauso wichtig wie Tiefe — deshalb `MAX_TARGETS = 60`
(Argus' Wert, uebernommen) und zwei Vergabedurchgaenge.

### Warum die "einfachere Zwischenstufe" ausscheidet

Getestet wurde die naheliegende Alternative: **feste Mischung aus hack, grow
und weaken, dauerhaft im Fluss gehalten, ohne jede Zeitsteuerung.** Rueckkopplung
ueber das Guthaben, grow und weaken mit 20–50 % Aufschlag ueberbestellt.

Das Ergebnis ist unangenehm eindeutig:

- Sie liefert bestenfalls **ein Viertel bis ein Drittel** von HWGW.
- Sie ist **nicht stabil**. Bei `harakiri-sushi` kippte sie in mehreren
  Parametrierungen ganz weg (Guthaben faellt auf 0), bei `phantasy` schwankte
  der Ertrag zwischen 4.4 und 6.9 m\$/s je nach Zeitschrittweite der
  Simulation — ein Zeichen dafuer, dass das Verhalten am Regler haengt und
  nicht an der Physik.
- Der Grund ist strukturell: hack lebt nur ein Viertel so lang wie weaken.
  Wer nach freiem Speicher nachbestellt statt nach Sollbestand im Flug,
  ueberrepraesentiert hack um den Faktor 4 und raeumt das Ziel leer. Wer es
  richtig macht, braucht bereits die halbe Buchfuehrung von HWGW.
- Und sie ist nicht einmal robuster: bei einem 30-Sekunden-Aussetzer der
  Steuerung je zwei Minuten verlor die Fliessarbeit 20 %, HWGW 4 %.

**Der Mehraufwand von HWGW gegenueber der Zwischenstufe sind rund 60 Zeilen**
(Landekalender und Termindisziplin). Dafuer bekommt man den drei- bis
zehnfachen Ertrag und ein System, das sich selbst korrigiert statt sich
selbst aufzuschaukeln. Die Zwischenstufe zu bauen waere die schlechtere
Entscheidung, nicht die vorsichtigere.

### Was NICHT gebaut wurde: JIT

Getestet wurde auch die Ausbaustufe, in der jeder Auftrag erst kurz vor seinem
eigenen Start losgeschickt wird (statt alle vier gleichzeitig mit
`additionalMsec` aufgefuellt). Theoretisch spart das Speicher — ein hack
belegt dann `tHack` statt `tWeaken`.

In der Simulation bringt es **nichts** (19.7 statt 19.5 m\$/s). Der Grund:
wer einen Auftrag vormerkt statt zu starten, muss seinen Speicher trotzdem
reservieren, sonst ist der Platz spaeter weg und der Stapel bricht auseinander.
Reservieren und Belegen kosten dasselbe. JIT lohnt sich also erst, wenn man
bereit ist, kaputte Stapel in Kauf zu nehmen — und genau das ist der Fehler,
den man nicht machen darf. **Bewusst weggelassen.**

---

## 3. Was geaendert wurde

| Datei | Art |
|---|---|
| `entwurf/lib/batch.js` | **neu**, 0 GB. Stapelplanung, Anteilswahl, Platzierung. |
| `entwurf/autopilot.js` | ersetzt `src/autopilot.js`. **7.15 GB** (vorher 7.55). |
| `entwurf/worker/{hack,grow,weaken}.js` | ersetzen `src/worker/*`. Unveraendert 1.70 / 1.75 / 1.75 GB. |

### 3.1 Die Arbeiter rechnen ihre Verzoegerung selbst

Bisher: `args = [ziel, verzoegerungMs]`, die Steuerung gibt die Verzoegerung vor.
Neu: `args = [ziel, verzoegerungMs, landeZeit, aktionsDauerMs, kennung]`, der
Arbeiter rechnet `verzoegerung = landeZeit − Date.now() − aktionsDauer` im
Moment seines eigenen Starts.

Warum: zwischen `ns.exec` und der ersten Zeile des Arbeiters liegt eine
unbekannte, schwankende Zeit — das Spiel muss das Modul uebersetzen und
einreihen (`NetscriptWorker.ts`, `createAndAddWorkerScript` startet
`startNetscript2Script` asynchron). Gibt die Steuerung die Verzoegerung vor,
geht diese Schwankung ungefiltert in den Landezeitpunkt ein. So ist sie
herausgekuerzt.

`Date.now()` und `ns.args` kosten kein RAM — **gemessen**, die Arbeiter sind
weiterhin exakt 1.70 / 1.75 / 1.75 GB gross.

Die Aenderung ist **abwaertskompatibel**: fehlen `args[2]`/`args[3]`, faellt
der Arbeiter auf `args[1]` zurueck. Ein alter Autopilot kann die neuen
Arbeiter also weiterbenutzen.

### 3.2 Der Landekalender steht in `ns.ps`, nicht im Speicher

Der spaeteste bereits vergebene Landetermin je Ziel wird **jede Runde aus den
Argumenten der laufenden Arbeiter neu gelesen** (`proc.args[2]`).

Das ist die wichtigste Bauentscheidung am ganzen Entwurf. Der Autopilot
beendet sich bei jeder neuen Fassung selbst — eine Variable im Speicher oder
eine Datei waere danach weg oder veraltet, und ein Stapel, der auf einen
vergessenen Termin gesetzt wird, landet mitten in einen fremden Stapel hinein.
So dagegen laufen die Arbeiter ueber den Neustart hinweg, ihre Termine stehen
weiter in `ns.ps`, und die neue Fassung setzt die Kette genau dort fort.
Vorbereitungsauftraege bekommen `landeZeit = 0` und werden vom Kalender
ignoriert.

### 3.3 Zwei verschiedene Sicherheitsstufen in einer Rechnung

- **Threadzahlen** bei `secMin` — dort landen die Auftraege, dort wirken sie.
- **Laufzeiten** bei der **frisch abgelesenen aktuellen** Sicherheit — denn das
  Spiel bestimmt die Dauer einmalig beim Aufruf
  (`NetscriptFunctions.ts:277`, `NetscriptHelpers.tsx:544`).

Siehe Abschnitt 5.1 — das ist der Punkt, an dem das Verfahren steht und faellt.

### 3.4 Alles-oder-nichts bei der Platzierung

`placeOps` plant erst die vollstaendige Belegung fuer alle vier Auftraege gegen
eine Kopie der freien Speicherkarte und meldet `null`, wenn auch nur einer
nicht unterkommt. Erst danach wird `ns.exec` aufgerufen — und zwar **der hack
zuletzt**. Scheitert unterwegs doch ein `exec`, fehlt hoechstens die Beute;
ein hack ohne zugehoerigen grow kann nicht entstehen.

Muss der hack auf mehrere Rechner aufgeteilt werden, wird der Stapel **einmal
nachgerechnet**: zwei Bloecke a 10 % nehmen zusammen 19 %, nicht 20 %, weil der
zweite auf ein bereits verkleinertes Guthaben wirkt. Ohne die Korrektur legt
grow blind zu viel nach.

### 3.5 Zustandsautomat je Ziel

`prep` → `batch` → (bei Drift) `drain` → `prep`.

- Der Aufstieg nach `batch` verlangt `sec ≤ secMin + 0.001`, `money ≥ 99.9 %`
  **und keinen grow mehr im Flug**. Die alte Toleranz (3 Sicherheitspunkte,
  90 % Guthaben) war fuer den Stapelbetrieb viel zu lose; die Vorbereitung
  arbeitet jetzt bis exakt auf `secMin` und `moneyMax`.
- Die Vorbereitung wird **vor** den Stapeln bedient. Ihr Bedarf ist endlich,
  der Bedarf der Stapel ist unbegrenzt — umgekehrt bereitete der Bot nie
  wieder ein Ziel vor.
- Die Drifterkennung schaut auf das **Minimum ueber 30 Sekunden**, nicht auf
  den Mittelwert: im gesunden Betrieb faellt die Sicherheit nach jedem Stapel
  exakt auf `secMin` zurueck. Liegt selbst der beste Moment der letzten halben
  Minute mehr als 1.0 darueber, oder das Guthaben unter `(1−f)·0.5`, wird das
  Ziel angehalten, laeuft aus und wird neu vorbereitet.

### 3.6 Nebenbefund: 0.40 GB auf `home` waren verschenkt

Bitburners RAM-Rechner (`src/Script/RamCalculations.ts`) laeuft ueber den
Syntaxbaum und bucht **jeden Bezeichner**, dessen Name auf eine NS-Funktion
passt — auch `plan.hack`, obwohl `plan` kein `ns` ist:

```ts
Identifier: (node, st) => { ...; addRef(st.key, node.name); },
MemberExpression: (node, st, walkDeeper) => {
  node.object && walkDeeper(node.object, st);
  node.property && walkDeeper(node.property, st);   // <- hier
},
```

Der bisherige `src/autopilot.js` hatte Objektfelder `busy.hack`, `busy.grow`,
`busy.weaken` — und bezahlte dafuer 0.10 + 0.15 + 0.15 = **0.40 GB** von acht.
Im Entwurf heissen sie `hackT`, `growT`, `weakenT`.

Ueber den Diagnosedraht Bezeichner fuer Bezeichner nachgemessen; Objekt-
schluessel in Literalen (`{ hack: 0 }`) kosten nichts, Zugriffe (`o.hack`)
schon. Weitere Fallen derselben Art, die einem hier begegnen koennen:
`probe` (0.20 — es gibt `ns.darknet.probe`), `scan` (0.20), `share` (2.40),
`exec` (1.30), `kill` (0.50).

**Diesen Fund kann man auch ohne den Rest uebernehmen** — er ist eine reine
Umbenennung und bringt 0.40 GB Luft auf einem 8-GB-Rechner.

### 3.7 Importpfade

Gemessen, nicht geraten: Bitburner loest Importangaben **ohne fuehrenden
Punkt vom Wurzelverzeichnis** auf, nicht vom Ordner der importierenden Datei.
Aus `lib/` heraus geht daher `"lib/calc"`, `"/lib/calc"` und `"./calc"` —
aber **nicht** `"calc"`. Ein falscher Pfad faellt nicht beim Start auf, sondern
macht das Skript unauswertbar ("Cannot calculate RAM usage of an invalid
script").

---

## 4. Die eingebauten Annahmen

1. **Kernbonus wird ignoriert.** `ns.getServer().cpuCores` kostet 2 GB, das ist
   auf `home` nicht bezahlbar. Gerechnet wird mit einem Kern. Auf Rechnern mit
   mehr Kernen wirken grow und weaken dadurch *staerker* als geplant — das ist
   die sichere Richtung (Ueberbestellung, kein Fehlbetrag).
2. **BitNode-Multiplikatoren sind 1** (BN1). Steht so schon in `lib/calc.js`.
3. **Eine Runde dauert ungefaehr eine Sekunde.** Die Anzeige "rechnerisch
   x \$/s" teilt den Geldwert der eingeplanten Stapel durch die Rundenzahl.
   Bei stark verlangsamten Runden wird diese *Anzeige* falsch — die Stapel
   selbst nicht, die haengen an `Date.now()`.
4. **Der Wachstumswert `serverGrowth` ist ueber die Zeit konstant.** Gilt im
   Spiel.
5. **`gap = 400 ms` ist mehr als die tatsaechliche Streuung der Landungen.**
   Das ist die einzige Annahme, die im Betrieb nachgeprueft werden muss —
   siehe 5.2. In der Simulation ueberstand 400 ms eine Streuung von 300 ms
   unbeschadet.
6. **Ein fehlgeschlagener hack ist harmlos.** Nachgelesen in
   `NetscriptHelpers.tsx`: bei Misserfolg wird weder Geld genommen noch
   Sicherheit erzeugt. Der zugehoerige grow laeuft dann ins Leere (Deckel bei
   `moneyMax`), der weaken ebenso (Deckel bei `minDifficulty`). Bei
   `phantasy` misslingt rund jeder dritte hack — das ist im Ertrag
   eingerechnet, nicht ignoriert.

---

## 5. Was schiefgehen kann, und woran man es merkt

### 5.1 Die Laufzeit aus der falschen Sicherheitsstufe (das Hauptrisiko)

**Der Mechanismus.** Ein Stapel hebt die Sicherheit kurzzeitig an: der hack um
`0.002·threads`, der grow um `0.004·threads`. Startet in diesem Fenster ein
Auftrag, ist seine wirkliche Laufzeit laenger als die bei `secMin` gerechnete.
Die Groessenordnung ist nicht klein:

```
Fehler ≈ 50 · reqSkill · Δsec / (skill + 50)   Sekunden
```

Fuer `phantasy` (reqSkill 100, skill 222) bei Δsec = 0.73 sind das **13 Sekunden**
— bei einem geplanten Abstand von 0.4 Sekunden. Und der Fehler treibt sich
selbst: ein zu spaeter weaken laesst die Sicherheit oben, der naechste Auftrag
wird noch langsamer.

**Gemessen in der Simulation** (mit der Laufzeitrechnung genau so nachgebaut wie
im Spiel):

| Ziel | mit `secMin` gerechnet | mit Ist-Sicherheit gerechnet |
|---|---|---|
| `phantasy` f=0.2, gap 400 ms | 16.33 m\$/s | **17.25** |
| `phantasy` f=0.4, gap 100 ms | 6.21 m\$/s | **15.67** |
| `harakiri-sushi` f=0.2, gap 100 ms | 0.76 m\$/s | **10.53** |
| `harakiri-sushi` f=0.5, gap 100 ms | 0.14 m\$/s | **9.12** |

Mittlerer Terminversatz vorher 6–14 Sekunden, Spitzen bis 85 Sekunden. Nachher
**exakt 0**.

**Die Gegenmassnahme steckt an zwei Stellen**, beide sind noetig:

1. `batch.opTimes()` liest `ns.getServerSecurityLevel` **unmittelbar vor jedem
   Stapel** neu und rechnet die drei Laufzeiten daraus.
2. Der fruehestmoegliche Landetermin wird aus **derselben** Laufzeit bestimmt.
   Wer hier mit `secMin` rechnet, setzt einen Termin, den ein bei erhoehter
   Sicherheit gestarteter Auftrag gar nicht halten *kann* — `additionalMsec`
   waere negativ, das Spiel deckelt auf 0 (`NetscriptHelpers.tsx:363`), der
   Auftrag landet zu spaet. Genau daraus entstanden die 85 Sekunden.

**Erkennen:** Im Fenster steht "rechnerisch x \$/s". Bleibt der tatsaechliche
Zuwachs dauerhaft deutlich darunter, landen Stapel falsch. Zweites Zeichen: die
Sicherheitsspalte eines Stapelziels steht dauerhaft ueber `secMin` (in der
Anzeige rot statt gruen). Der Wert wandert auch in die Telemetrie
(`batching.expectedPerSec`), laesst sich also von aussen mitschreiben.

### 5.2 Zu kleiner Landeabstand

Die Simulation zeigt: unterhalb der tatsaechlichen Streuung faellt der Ertrag
**nicht sanft ab, er kippt.** Bei 300 ms Streuung und 100 ms Abstand ging das
Guthaben von `harakiri-sushi` auf 0 %, bei 400 ms Abstand blieb es bei 94.5 %.

| Abstand | ohne Streuung | mit 300 ms Streuung |
|---|---|---|
| 100 ms | 10.8 m\$/s | **0.5** |
| 200 ms | 10.8 m\$/s | 8.6 |
| 400 ms | 6.7 m\$/s | **6.8** |
| 800 ms | 4.2 m\$/s | 4.2 |

`GAP_MS = 400` ist deshalb bewusst konservativ gewaehlt und kostet gegenueber
dem theoretischen Optimum rund 10 %. **Wer ihn senken will, misst vorher die
tatsaechliche Streuung** — die Landungen haengen an `window.setTimeout`
(`NetscriptHelpers.tsx:419`), und wie punktgenau der Browser das bei ein paar
tausend laufenden Skripten bedient, ist von aussen nicht vorhersagbar.

### 5.3 Weggeschaltete Registerkarte

Chrome drosselt `setTimeout` in unsichtbaren Registerkarten. Weil die Landung
aber am absoluten Zeitpunkt haengt und nicht an einer Kette von Wartezeiten,
verschiebt eine Drosselung alle Auftraege eines Stapels gemeinsam — die
Reihenfolge bleibt. Was leidet, ist der Durchsatz, nicht die Richtigkeit.
Die Drifterkennung faengt den Rest.

### 5.4 Zu wenig weaken

`WEAKEN_MARGIN = 1.5` ist Absicht. Ueberzaehlige weaken-Threads sind wirkungslos
(Deckel bei `minDifficulty`, `Server.ts:91`), zu wenige lassen nach jedem
Stapel einen Rest stehen, der sich ueber hunderte Stapel aufschaukelt. Der
Aufschlag kostet 5–7 % des Stapels. **Nicht heruntersetzen, um Speicher zu
sparen** — das ist an der falschen Stelle gespart.

### 5.5 Speicherverteilung zwischen den Zielen

Der erste Durchgang verteilt nach Ertrag gewichtet, der zweite gibt den Rest
weiter. Nicht optimal: die Ertragskurve je Ziel ist gekruemmt, konzentrieren
waere bei kleiner Flotte besser. Bei 164 TB ist das gegenstandslos, weil kein
einzelnes Ziel so viel binden kann. **Beobachten**, wenn die Flotte je stark
schrumpft (Augmentierungs-Reset).

### 5.6 Umstellung im laufenden Betrieb

Die Arbeiter sind abwaertskompatibel, der Autopilot ist es nicht (er erwartet
`args[2]` als Landetermin). **Reihenfolge beim Uebernehmen:**

1. Erst `src/worker/*.js` — der alte Autopilot arbeitet damit unveraendert
   weiter (`landeZeit = 0` wird nicht gesetzt, `args[1]` greift).
2. Etwa fuenf Sekunden warten, bis der Sync durch ist.
3. Dann `src/lib/batch.js`.
4. Zuletzt `src/autopilot.js`. Er startet sich selbst neu und liefert in
   Runde 1 alle Arbeiter neu aus.

Beim Neustart laufen noch Arbeiter der alten Fassung. Die haben `landeZeit = 0`
und werden vom Kalender ignoriert — sie gehen als Vorbereitung durch und
beenden sich von selbst. Alle Ziele starten in `prep`, der erste Stapel kommt
also erst nach einer vollstaendigen Vorbereitung. **Fuer ein bis drei Minuten
faellt der Ertrag daher ab, bevor er steigt.** Das ist normal, kein Fehler.

### 5.7 Stand der Vorlage

Der Entwurf ist ein vollstaendiger Ersatz fuer `src/autopilot.js` auf dem Stand
von rund 20:55. Seither hat Argus dort drei Konstanten geaendert (Commits
`d4b6a37` und `feedce1`): `MAX_TARGETS` 8 → 60, `PREP_TARGETS` 4 → 40,
`HACK_FRACTION` 0.1 → 0.4. **Die ersten beiden sind uebernommen**, die dritte
ist gegenstandslos — der Beuteanteil wird jetzt je Ziel aus dem Speicherbudget
bestimmt (`chooseFraction`), nicht mehr fest vorgegeben. Andere Dateien
(`invest.js`, `nightshift/`, `tools/reserve.js`) sind nicht beruehrt.
**Vor der Uebernahme trotzdem `git log -- src/autopilot.js` pruefen**, ob
seither noch etwas dazugekommen ist.

### 5.8 Was noch nicht getestet ist

Die Zahlen in diesem Bericht stammen aus einer Simulation, die aus
`reference/v301` nachgebaut wurde — nicht aus einem Lauf im Spiel. Sie trifft
den heutigen Zustand gut (0.16/0.39 m\$/s simuliert gegen 1.06 m\$/s gemessen
ueber acht bis vierzehn Ziele), aber sie ist kein Ersatz fuer eine Stunde
Beobachtung. **Vorschlag: nach der Uebernahme eine halbe Stunde mitschreiben**
(`node tools/status.js` oder die Bruecke im Sekundentakt) und den
tatsaechlichen Zuwachs gegen `batching.expectedPerSec` halten. Weichen die
beiden um mehr als ein Drittel ab, stimmt etwas mit der Termindisziplin nicht,
und 5.1 ist die erste Stelle zum Nachsehen.

---

## 6. Stellschrauben

| Konstante | Wert | Wirkung |
|---|---|---|
| `GAP_MS` | 400 | Abstand der Landungen. Kleiner = mehr Ertrag, weniger Reserve. Nicht ohne Messung senken. |
| `SLACK_MS` | 200 | Vorlauf, damit der letzte weaken nicht schon ueberfaellig startet. |
| `LEAD_MS` | 1200 | Wie weit vor dem Starttermin ein Stapel losgeschickt werden darf. Etwas mehr als eine Runde. |
| `WEAKEN_MARGIN` | 1.5 | Aufschlag auf beide Ausgleichsauftraege. Siehe 5.4. |
| `FRACTION_MIN/MAX` | 0.01 / 0.5 | Grenzen fuer den Beuteanteil. Ueber 0.5 wird es in jedem geprueften Fall schlechter. |
| `DRIFT_WINDOW` / `DRIFT_SEC` | 30 / 1.0 | Empfindlichkeit der Drifterkennung. |
| `MAX_TARGETS` / `PREP_TARGETS` | 60 / 40 | Breite. Von Argus' Stand `07fa272` uebernommen; wirkt als "alle lohnenden Ziele". |
| `MAX_BATCHES_PER_ROUND` / `MAX_BATCHES_TOTAL` | 12 / 80 | Anlaufbremse. Ohne sie kaeme man bei 60 Zielen auf mehrere tausend `exec` in einer Sekunde. |

---

## 7. Nachtrag vom 20.08.2026 (Pruefung vor der Uebernahme)

Der Entwurf ist geprueft und **veraendert** worden. Die Fassung in
`entwurf/autopilot.js` entspricht ab jetzt nicht mehr Punkt fuer Punkt dem,
was oben steht. Massgeblich ist `entwurf/uebernahme.md`.

Was sich geaendert hat und warum:

1. **Abschnitt 5.7 ist ueberholt.** `MAX_TARGETS = 60` und `PREP_TARGETS = 40`
   sind seit der Nacht zum 20.08. keine festen Zahlen mehr, sondern
   Obergrenzen; wirksam ist `floor(ramTotal/2000)` bzw. `floor(ramTotal/4000)`.
   Der Entwurf hatte die alten festen Werte uebernommen und damit eine
   Korrektur rueckgaengig gemacht, die fuenf Stunden Stillstand gekostet hat.
   Ebenso `HACK_FRACTION`: der Wert steht wieder bei 0.1 und wird im
   Wellenbetrieb (siehe 4.) auch wieder gebraucht.

2. **Die Vorbereitung in Abschnitt 3.5 war die gefaehrlichste Stelle.** Sie
   bemisst den Sicherheitsausgleich fuer die GEPLANTEN grow-Faeden und
   verteilt ihn VOR ihnen. Bei einem Ziel bei 4 % Guthaben sind das 2303
   grow-Faeden, deren Ausgleich 184 weaken-Faeden = 322 GB braucht - mehr als
   ein Netz nach dem Reset ueberhaupt hat. Nachgerechnet mit den Formeln aus
   `reference/v301`: bei 116 GB steht das Ziel nach 90 Minuten immer noch bei
   4.0 %. Ersetzt durch drei Durchgaenge (echter Ueberschuss, gedeckeltes
   grow, Ausgleich fuer die tatsaechlich gestarteten Faeden).

3. **Die Reihenfolge "Vorbereitung vor Stapeln" ist umgedreht.** Das Argument
   in 3.5 ("der Bedarf der Vorbereitung ist endlich") gilt nur, solange dieser
   endliche Bedarf auch erfuellbar ist. Jetzt: Stapel zuerst, und die
   Vorbereitung bekommt dafuer 25 % des freien Speichers reserviert.

4. **Neu, und der wichtigste Befund der Pruefung: der Stapelbetrieb ist
   unterhalb von rund 350 GB Gesamtspeicher SCHLECHTER als der alte
   Wellenbetrieb** - bei 116 GB um den Faktor 0.6, bei 64 GB um 0.4. Grund ist
   dieselbe Speicherbindung, mit der Abschnitt 2 den Verzicht auf JIT
   begruendet: jeder Auftrag haelt seinen Speicher bis zu seiner Landung, auch
   der hack, der nur ein Viertel der weaken-Zeit braucht. Bei 21 TB ist das
   gleichgueltig, bei 116 GB ist es der Engpass. Der Autopilot schaltet
   deshalb unter `BATCH_MIN_RAM = 400` selbsttaetig auf Wellen zurueck.

5. **Die Faktorangabe "10 bis 20" gilt fuer grosse Flotten.** Auf dem Netz vom
   20.08. (506 GB) sagt dieselbe Rechnung Faktor 1.5 bis 3.

`lib/batch.js` und die drei Arbeiter sind unveraendert geblieben. Die
Terminrechnung aus zwei Sicherheitsstufen (3.3 / 5.1), der Landekalender aus
`ns.ps` (3.2), die Alles-oder-nichts-Platzierung (3.4) und `GAP_MS = 400`
haben die Pruefung ohne Einwand bestanden - das ist der tragende Teil des
Entwurfs, und er ist gut.
