# Skeptikerrunde 5 — 04.09.2026

Drei Prüfer auf die Arbeit des Tages: den Stummzähler der Vertragskette (R27),
den Umbau am Modul-Lader (R29) und den ersten Test der Brücke (R23).

Angriffswinkel getrennt vergeben: **Prämisse** (ist das überhaupt das
Richtige?), **Fehlermodi im Alltagsbetrieb** (was bricht nach zwei Wochen?),
**inhaltliche Substanz** (stimmen Zahlen, Logik, Annahmen?).

Der zweite Prüfer hat dabei einen Schaden gefunden, den **dieser Bau selbst
angerichtet hatte** — nicht im Code, sondern in den Daten. Das ist der
wichtigste Befund des Tages.

---

## Prämisse — der Stummzähler

| Nr | Befund | Stand |
|---|---|---|
| P-B1 | `stummeRunden` in `contracts.js` kann nie über 1 steigen. Die Registry startet das Gewerk ohne `--loop` (`"args": []`), ohne die Angabe endet die Schleife nach EINEM Durchlauf, und der Zähler war prozesslokal. Die Schwelle im Kern liegt bei 3 — die Normalbetriebs-Hälfte war tot geboren. | **BEHOBEN** — der Vorstand wird gelesen, wie in `cdump.js` |
| P-B2 | `data/cdump-stand.json` wird nie gelöscht und ohne Altersprüfung gelesen. `cdump.js` läuft nur im Kaltstart; nach dem ersten gekauften Rechner kann **nichts** den Zähler je wieder auf 0 setzen. Ein einziger Klemmzustand hätte `contracts_silent_rounds` für den Rest der Route eingefroren — in jedem weiteren BitNode. Dazu: `contract_stumm` stand auf `bleibt: true` und hätte im 60er-Ringpuffer die `jump`-Einträge verdrängt, aus denen drei andere Abnahme-KPIs gerechnet werden. | **BEHOBEN** — Altersprüfung (6 h), beide Dateien in der Räumliste von `boot.js`, `bleibt: false` |
| P-W1 | Ein `telemetryFile` in der Registry macht ein Gewerk für S1 sichtbar. Beide Vertragsgewerke sind **kurzlebige Einmalläufer**: ihre Datei bleibt nur frisch, solange der Kern sie nachstartet. „Kern tot" und „Telemetrie alt" sind für sie dasselbe Ereignis — der Wächter hätte es als Schuld des Gewerks gelesen und Fehlstrafen erzeugt, auf einer Zahl mit Soll 0, die die Bedingung fürs Scharfstellen ist. Und der Eintrag kauft nichts: der Kern liest die Datei über ihren Literalpfad. | **BEHOBEN** — `telemetryFile` wieder `null`, Standdateien bleiben |
| P-W2 | Es liest niemand. Kein Treffer für `contracts_silent_rounds` oder `contract_stumm` außerhalb der schreibenden Dateien. Ein Befund, den niemand abholt, ist genauso stumm wie einer, den niemand schreibt. | **BEHOBEN** — `tools/checkin.js` meldet die vier Soll-0-Zahlen und die Eingriffe |
| P-W3 | `zaehler.gefunden` wird **vor** allen Filtern hochgezählt. Ein korrekt gesperrter Typ erzeugt dauerhaft „gefunden > 0, gelöst 0", obwohl die Sperre das Richtige tut. Der präzise Auslöser lag schon in der Datei: `gruende["Gegenprobe fehlgeschlagen"]`. | **BEHOBEN** — beide Gewerke lösen jetzt auf die abgelehnte Gegenprobe aus |
| P-W4 | Der billigere Weg stand seit Phase B im Plan und ist nie gebaut worden: je gelöstem Vertrag `{ts,host,file,type,payout}` in den Ereignisstrom. Damit wäre „Bestand steigt, Zufluss null" direkt messbar — selbstlöschend, ohne prozessübergreifende Datei. `contract_stock_usd` hat bis heute keinen Schreiber. | **OFFEN** — gehört zu C.8, nicht zu R27 |
| P-K1 | Zwei **verschiedene** `nodes/BAU-2026-09/ARCHITEKTUR.md` unter demselben Pfad: der Hauptbaum führt 1.751 Zeilen, der Bauzweig 1.260 aus der Zeit des Abzweigs. Der Generator liest die des Hauptbaums. Der Prüfer hätte daraus beinahe einen Fehlbefund gemacht. | **BEHOBEN** — Warnbanner in der veralteten Fassung |
| P-K2 | Keine der beiden Standdateien ist ein Herzschlag-v2-Block. `state: "done"` wäre für einen Einmalläufer der Lehrbuchfall. | **OFFEN, klein** |

---

## Alltagsbetrieb — Lader und Brückentest

| Nr | Befund | Stand |
|---|---|---|
| A-B1 | **Der Brückentest machte die TEST-Instanz unbrauchbar.** Er muss oberhalb des vorhandenen Ankers arbeiten; jede verifizierte Verbindung schreibt eine Sicherung in denselben Index, und der Anker steigt mit. Gemessen: von 369 auf **6.800 Stunden** nach wenigen Läufen. Eine echte Spielstandskopie wäre ab da dauerhaft als Rückwärtssprung abgelehnt worden — `rotiere()` löscht Dateien, keine Indexzeilen. | **BEHOBEN** — dritte Rolle `MOCK` mit eigenem Ablageort und Präfix; die 39 synthetischen Indexzeilen und 9 Dateien wurden entfernt, der Anker steht wieder auf 368,9 h |
| A-B2 | Der Abschnitt „zweite Verbindung" prüfte nicht, was er behauptet: die erste Verbindung war gar nicht verifiziert (Spielzeit unter dem Anker des vorigen Abschnitts). Die drei Proben wurden trotzdem grün, weil der Zweig nur an `readyState` hängt. Kostete zusätzlich 25 s Wartefrist, die ablaufen **musste**. | **BEHOBEN** — Zeitstaffel je Abschnitt, plus eine Probe, dass die erste Verbindung verifiziert ist |
| A-B3 | Der einzige Riegel, der `.mock-*`-Dateien aus Erics Spiel hält, war ungeprüft — und hing an einer Endung, die der Lader frei wählt. Wer sie eines Tages auf `.js` ändert, schiebt Wegwerfdateien ins laufende Spiel. | **BEHOBEN** — `NIE_SCHIEBEN` (Punktdateien) in `collectScripts` **und** im Watcher, plus eine Probe mit zwei Ködern |
| A-W1 | Ein harter Abbruch lässt Kopien liegen; danach sind sechs Ebene-2-Tests rot, ohne dass am geprüften Code etwas fehlt. | **BEHOBEN** — der Lader räumt beim Start Leichen toter Prozesse weg (`process.kill(pid, 0)`), die eigenen bleiben |
| A-W2 | Die R29-Probe „zwei Läufe gleichzeitig" lief **nicht** gleichzeitig: `execFileSync` blockiert die Event-Loop, der zweite Prozess startete exakt, wenn der erste endete. Die Kollision konnte per Konstruktion nicht auftreten. | **BEHOBEN** — `execFile` + `Promise.all` |
| A-W3 | `dateiName` hat Minutenauflösung und keine Unterscheidung. Zwei Sicherungen derselben Minute überschreiben einander, der Index bekommt zwei Zeilen mit verschiedenen Prüfsummen auf **eine** Datei. **Das gilt auch für LIVE.** | **BEHOBEN** — beim ersten freien Namen wird `-2`, `-3` … angehängt |
| A-W4 | Bei einer Ausnahme räumte der Brückentest nichts weg: bis zu sechs Ordner `pruefstand/t-*` (nicht in `.gitignore`) und mehrere Brückenprozesse. | **BEHOBEN** — `process.on("exit")` und SIGINT, dazu die Muster in `.gitignore` |
| A-W5 | `spawn("node", …)` ohne `error`-Zuhörer: bei ENOENT feuert `exit` nie, der Test hängt unbegrenzt. Und `test-alles.js` gab `execFile` **kein** `timeout` — eine hängende Datei hängt die ganze Suite. | **BEHOBEN** — `process.execPath`, `error`-Zuhörer, 180 s Frist in der Suite |
| A-W6 | `heimatOrdner` nimmt den ersten `src` von unten und fällt bei keinem still auf das alte Verhalten zurück. Ein Klon unter `D:\src\bitburner` kippt alle Ebene-2-Tests auf einmal. | **BEHOBEN** — der Rückfall meldet sich; der Zwei-`src`-Fall bleibt bewusst so (der nächste gewinnt) |
| A-K3 | Der Portriegel prüfte nur `RFA_PORT === 12525 \|\| DASHBOARD_PORT === 8795` — die Kreuzfälle kamen durch und wurden nur durch `EADDRINUSE` gestoppt, also nur, solange LIVE läuft. | **BEHOBEN** — gilt für jede Nicht-LIVE-Rolle und für beide Ports |
| A-K2 | Die Portlücke zwischen `listen(0)` und der Bindung durch die Brücke: 300 Paare gemessen, 0 Wiederholungen. Praktisch kein Problem. | **kein Befund** |

---

## Was nicht geändert wurde

- **P-W4** (Vertragserträge in den Ereignisstrom) ist richtig, gehört aber zu
  Position C.8 und nicht zu einem Stummzähler. Es steht auf der Liste.
- **Der Zwei-`src`-Fall** in `heimatOrdner`: der nächstgelegene gewinnt. Das
  ist in jedem realistischen Fall richtig, und der laute Rückfall macht den
  Rest erkennbar.
- **`git rm` der veralteten `ARCHITEKTUR.md` im Bauzweig**: sie gehört zur
  Geschichte des Zweigs. Ein Banner erklärt mehr als ein fehlendes Dokument.

---

## Substanz — stimmen Zahlen, Logik, Annahmen?

Der dritte Prüfer lief parallel zu den Reparaturen der beiden anderen und hat
vier Befunde „im Flug" geschlossen vorgefunden. Sie stehen unten nur zur
Kenntnis; die übrigen sind neu.

| Nr | Befund | Stand |
|---|---|---|
| S-B1 | Bestätigt P-B1 unabhängig — **und findet die Ursache dahinter**: der Registry fehlte `args: ["--loop","300"]` für `contracts.js`. Die eingebaute Rückfallliste im Kern hat es, die generierte Registry nicht. Ohne das Argument scannt das Gewerk je Prozessstart das ganze Netz und beendet sich; der Kern startet es in der nächsten Runde neu, und dabei gehen `gesperrteTypen` und `abgelehnteVertraege` jedes Mal verloren — die Notbremse nach zwei Ablehnungen wird unerreichbar. | **BEHOBEN** — das Argument steht wieder in ARCHITEKTUR 3.3, die Registry ist neu erzeugt |
| S-W1 | Die neuen Standdateien führen nur die Wanduhr (`ts`), keine Engine- oder Motorzeit. Die Uhrenkaskade von S1 überspringt den Wanduhr-Zweig im verdeckten Tab — also im Normalbetrieb dieses Bots. | **gegenstandslos geworden** — die Dateien sind seit P-W1 keine `telemetryFile` mehr; S1 sieht sie gar nicht. Bliebe der Eintrag, wäre der Befund richtig |
| S-W2 | `stummeRunden` maß nicht, was Kommentar und KPI-Hinweis behaupten: vier der acht `uebersprungen++`-Stellen sind **bewusste** Verzichte. Deckt sich mit P-W3. | **BEHOBEN** — Auslöser ist die abgelehnte Gegenprobe |
| S-W3 | `schreiberprobe`: **3 Falsch-Positive** (auskommentierte Schreibzeile, `beschreibe(…)` als Teilzeichenkette von `schreibe`, beschattete Konstante) und **5 Falsch-Negative** (`export const`, einfache Anführungszeichen, Leerzeichen vor dem Komma …). Die Falsch-Positiven sind die schlimmen: sie lassen genau den Fehler durch, gegen den das Modul gebaut ist. Der Kommentar „bewusst ohne Regex, kann sich am Escaping nicht vertun" trug nicht. | **BEHOBEN** — Kommentare werden entfernt, Wortgrenze vor dem Aufrufnamen, Beschattung erkannt, `export const` und beide Anführungszeichen erlaubt. Alle acht Fälle stehen jetzt als eigene Probe |
| S-W4 | Die Probe „bloße Erwähnung im Kommentar gilt nicht" bewies das nicht — sie ging nur grün, weil in ihrem Prosatext zufällig kein Aufruf stand. | **BEHOBEN** — echte auskommentierte Schreibzeile, plus Blockkommentar |
| S-W5 | `test-bruecke.js` prüfte die Reihenfolge Sicherung↔pushAll **nicht**: `iSave < iPush` ist nahezu tautologisch, weil das RFA-Protokoll immer mit `getSaveFile` beginnt. | **BEHOBEN** — verglichen werden jetzt die Protokollzeilen „Sicherung connect gruen" und „N Datei(en) ins Spiel uebertragen" |
| S-W6 | Der Test war **nicht deterministisch**: rot um 12:04/12:06/12:07/12:12, grün um 12:11/12:13. Ursache ist die Minutenauflösung der Sicherungsnamen — zwei Läufe innerhalb ~50 s kollidieren. Ein flackerndes Tor auf Abnahmestufe A. | **BEHOBEN** — deckt sich mit A-W3; der Namensgeber hängt jetzt `-2`, `-3` … an |
| S-W7 | `BEFUNDE-RUNDE4.md` und `STATUS.json` ließen R23, R27 und R29 als „offen" stehen, **in demselben Commit, der sie behob**. Dazu vier Zahlenfehler: ein Zeitstempel neun Stunden in der Zukunft, „28 von 28 Testdateien" statt 30, „sieben Messlücken" statt neun, „28 Proben" statt 42. | **BEHOBEN** — alle vier korrigiert, die drei Befunde abgehakt. Der Zeitstempel kam aus dem Kopf statt aus `date`; genau davor warnt die eigene CLAUDE.md |
| S-K2 | `evMerker.stummGemeldet` setzt sich nur bei exakt 0 zurück. | **als Absicht dokumentiert** — ein Befund je Kernprozess ist gewollt |
| S-K3 | Zwei Stellen in `cdump.js` widersprachen sich über den Wirt („sobald home voll ist" gegen `hostRule: "home"`, das seit heute wirklich bindet). Wäre die alte Aussage wahr, setzte ein Wirtwechsel die Zählung still zurück. | **BEHOBEN** — der Widerspruch ist aufgelöst, der tote Zweig als solcher benannt |
| S-K4 | Drei schwache Proben in `test-bruecke.js`: „auch sonst nichts Schreibendes" (kann nur rot werden, wenn die Vorgängerprobe rot ist), „mit Wanduhr UND Spielzeit" (`!== undefined` besteht auch bei `null`), „die Brücke startet" (vier sehr häufige Wörter). | **BEHOBEN** für die ersten beiden; die dritte bleibt als Vorbedingung stehen |
| S-K5 | In `test-lader.js` stand die Reste-Probe **vor** dem Wettlauf — also vor dem Abschnitt, der am ehesten Reste hinterlässt. Und eine Strukturprobe spannte über 120 Zeichen und traf damit auch Kommentare. | **BEHOBEN** — Reste-Probe ans Ende, Strukturprobe auf eine Zeile begrenzt |
| S-K1 | **Kein Befund:** RAM unverändert (12,65 / 17,65 / 10,80 GB, gegen `tools/ram.js` und `test-ram.js`), die 0,20 GB Luft im Kaltstart stehen. Die Entscheidung `ns.read` statt `ns.fileExists` ist gegen den Spielquelltext belegt richtig. | — |
| S-K6 | **Kein Befund:** Stichprobe über fünf als behoben markierte Runde-4-Befunde (R5, R10, R20, R24, R30) — alle fünf halten, inklusive Uhrenprüfung bei R5. | — |
| S-K7 | Die Stufe „getestet" ließ einen im Eintrag selbst benannten **offenen Pflichttest** zu; sie unterschied sich damit kaum von „gebaut". | **BEHOBEN** — die Definition in `STATUS.json` verlangt das jetzt ausdrücklich |

---

## Die Lehre des Tages

**Ein Test kann Schaden anrichten, den kein Test findet.** Der Brückentest war
korrekt gebaut, seine 28 Proben waren grün — und er hat dabei die TEST-Instanz
unbrauchbar gemacht, indem er synthetische Spielzeiten in denselben Index
schrieb wie echte Spielstandskopien. Gefunden hat das kein Testlauf, sondern
ein Prüfer mit der Frage „was bricht nach zwei Wochen?".

Dazu zwei kleinere, die dieselbe Form haben:

- **Eine Probe, die nicht rot werden kann, ist keine Probe** — dreimal an einem
  Tag (S-W5, S-W4, S-K4). Die Gegenfrage muss lauten: *welchen Fehler im
  geprüften Code fängt sie?* Lässt sich keiner konstruieren, ist sie Zierde.
- **Ein Zeitstempel aus dem Kopf ist falsch.** Neun Stunden daneben, in einer
  Datei, die den Fortschritt belegt. Die eigene CLAUDE.md sagt seit dem
  23.08.2026, dass die Systemzeit abzufragen ist.
