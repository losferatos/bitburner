# Loop 4: Optimieren

*Alles ab der nächsten Zeile ist der Prompt und wird wörtlich an CronCreate übergeben.*

BITBURNER-OPTIMIEREN (Loop 4 von 6). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

**LAUTLOS-SCHALTER — als Allererstes pruefen.** Fuehre `test -f data/lautlos && echo LAUTLOS` aus. Kommt `LAUTLOS`, gibst du in diesem Lauf **nichts im Chat aus**: kein Bericht, kein Stichpunkt, kein Wort, keine Zahl. Du arbeitest ganz normal weiter — alle Befunde und Ergebnisse gehen in die Dateien (`nodes/BAUSTELLEN.md`, `nodes/KURS.md`, `nodes/HEBEL.md`, Commits), nicht in den Chat. Per ntfy meldest du dann nur noch, was keinen Aufschub duldet: Bot steht, Pruefer abgestuerzt, BitNode-Wechsel oder Reset. Alles andere wartet bis zum Morgen. Der Schalter ist Erics Nachtruhe; die Datei wird geloescht, wenn er sich meldet.

Die anderen drei Loops halten den Betrieb: Loop 1 greift bei Störungen ein, Loop 2 arbeitet gemeldete Befunde ab, Loop 3 berichtet. Alle drei sind **reaktiv** — sie machen den Bot wieder heil, nicht besser.

Dieser Loop ist der einzige, der fragt: **Was begrenzt uns gerade, und lässt sich das heben?** Ziel des Projekts sind 45 Läufe durch 15 BitNodes. Bei dieser Länge zahlt sich jeder Faktor vielfach aus — und jede Stunde, die niemand nach ihm sucht, ist verschenkt.

## Ablauf

**1. Den Engpass finden — nicht das Naheliegende.**

```
date
cd /c/Users/erche/Desktop/claude_projecto/bitburner && node tools/strategie-check.js
head -60 nodes/HEBEL.md          # nur die offenen Eintraege, nicht das Archiv
cat nodes/KURS.md 2>/dev/null || echo "(kein Kurs gesetzt - siehe Schritt 1)"
```

Spieldateien liegen **nicht** auf der Platte, sondern nur im Spiel. Lesen über die Brücke:
```
curl -s -m 8 -G "http://localhost:8795/api/rpc" --data-urlencode "method=getFile" --data-urlencode "filename=data/blade.json" --data-urlencode "server=home"
```
Nützlich sind je nach Phase `data/blade.json`, `data/bblage.json`, `data/bn4net.json`, `data/bbspann.json` und `data/werkbank.json`. Die letzten beiden musst du über den Auftragskanal anstoßen (`pushFile` nach `data/task.txt` mit `["bbspann.js"]`, 26 s warten) — vorher prüfen, ob der Kanal frei ist, er hat genau einen Leser. Bequemer: `node tools/spann.js` macht das in einem Aufruf.

Die Leitfrage: **Welche Zahl bringt den Knoten näher an seinen Ausgang, und was begrenzt sie gerade?**

**Die Leitgröße wird NICHT vorgegeben — sie steht in `nodes/KURS.md`, wo der Kursloop sie aus dem Quellcode hergeleitet hat.** Lies sie von dort. Fehlt die Datei oder ist ihr Eintrag älter als 24 Stunden, leite sie selbst her (die Anleitung steht in der Datei) und schreib sie hin, bevor du irgendetwas optimierst.

*Warum das so streng steht:* Bis zum 27.08.2026 stand hier der Satz „In BitNode 6 ist das der Bladeburner-Rang", und Schritt 1 ließ `nodes/HEBEL.md` einlesen — wo derselbe Satz stand. Der Loop las als Quelle seine eigene Ausgabe. Die Größe war zufällig richtig, aber weil sie nie **hergeleitet** wurde, wurde sie auch nie **durchgerechnet**: Optimiert wurde auf den nächsten Meilenstein (Typhoon, Rang 2.500) statt auf den Ausgang (Daedalus, 400.000). Sechs Stunden Loop-Arbeit flossen in Feinheiten, während die Kernfrage ungestellt blieb — und der Befund kam am Ende durch Zufall.

**Quellen, in dieser Reihenfolge — der Quellcode zuerst:**
1. **`reference/bitburner-src/src/`** — der Spielquellcode. Er liegt vollständig vor (v3.0.2), also wird **nachgeschlagen statt gemessen**, wo immer eine Zahl dort steht. `grep` ist schneller als jede Messreihe, und eine Konstante aus `data/` ist verlässlicher als ein 45-Minuten-Fenster. Bewährt: `Bladeburner/`, `Bladeburner/data/`, `BitNode/BitNode.tsx`, `Hacking.ts`, `Formulas.ts`, `PersonObjects/formulas/`.
2. `doku/formeln-*.md` und `doku/auffaellige-werte.md` — was daran schon verstanden ist.
3. Die Telemetrie — was der Bot tatsächlich tut. Sie sagt, **ob** die Rechnung stimmt, nicht **was** richtig wäre.

**Diese Reihenfolge ist die eigentliche Regel dieses Loops.** Eric am 27.08.2026: *„Dadurch dass uns der Source Code vorliegt, kann ich keinesfalls akzeptieren, wenn wir nicht JEDERZEIT die optimalste Strategie fahren. Wir können buchstäblich nachschauen und rechnen, wann was exakt perfekt die richtige Entscheidung ist."* Belegt am selben Tag: Die 400.000 Rang standen seit dem ersten Tag in `Bladeburner/data/BlackOperations.ts` — sie mussten nie gemessen werden, nur gelesen.

**Ein gesetzter Parameter ist ein Befund.** Findest du in `src/*.js` eine Zahl, für die im Quellcode eine berechenbare Antwort steht — eine Schwelle, ein Deckel, eine feste Reihenfolge —, dann ist das ein Hebel, auch wenn gerade nichts kaputt aussieht. Am 27.08. wurden so 30 freie Parameter allein in `blade.js` gefunden, von denen mindestens acht exakt lösbar sind. Zwei Beispiele, was das wert war: Die Black-Op-Chance wurde an `s.min` entschieden — einer Zahl, die bei Black Ops **reines Bevölkerungsrauschen** ist (`Actions/BlackOperation.ts:55-61`). Und Digital Observer stand auf Stufe 1, obwohl er als einzige Chance-Fähigkeit **alle 21** Black Ops trifft (`Actions/BlackOperation.ts:69`).

**Vorher `## ENTSCHIEDEN` im Kopf von `nodes/BAUSTELLEN.md` lesen.** Dort
steht, was bereits belegt entschieden ist - mit Zahl und Fundstelle. Wer
eine dieser Sachen aendern will, braucht eine **neue Messung oder eine neue
Fundstelle**, nicht ein neues Argument. Sonst entsteht Fehler-Ping-Pong:
heute einbauen, was vorgestern evidenzbasiert entfernt wurde (Erics Ansage
vom 29.08.2026).

**2. Eine Hypothese formulieren, die eine Zahl nennt.**

„Wenn ich X ändere, steigt Y von <jetzt> auf mindestens <erwartet>." Ohne beide Zahlen keine Änderung — sonst lässt sich hinterher nicht sagen, ob es gewirkt hat.

Prüfe die Hypothese am Quellcode, bevor du sie umsetzt. Die meisten Vermutungen über dieses Spiel sind falsch, und eine widerlegte Hypothese kostet fünf Minuten Lesen statt drei Stunden Messen.

**3. Umsetzen — mit denselben Grenzen wie die Wache.**

- Höchstens **eine Datei** je Lauf.
- `src/bn4net.js` und `src/boot.js` sind seit dem 27.08.2026 freigegeben, bleiben aber Motor und Wiederanlauf: **einzeln committen**, kleine Schritte, nach jeder Änderung `node tools/strategie-check.js`. Ein Fehler dort kostet den ganzen Lauf.
- Nach jeder Änderung an `tools/strategie-check.js`: `node tools/strategie-check.js` ausführen. Endet die Ausgabe nicht auf `URTEIL:`, sofort `git checkout --` und nichts committen.
- Werkzeug im Spiel neu starten: `pushFile` nach `data/reload.txt` mit `WERKZEUG <dateiname>.js` — **die Endung gehoert dazu** (der Kanal vergleicht gegen `pr.filename`; seit 27.08. 19:46 wird sie zwar ergaenzt, aber schreib sie hin). **Danach nachsehen, ob die Änderung auch greift** — am 27.08. um 18:55 wurde ein Hebel eingebaut, neu gestartet, und die Wirkung blieb aus; erst eine Stunde später fiel auf, dass die Kaufreihenfolge ihn übersprang.
- Findest du in **fünfzehn Minuten** keinen belegten Hebel: nichts ändern. Schreib in HEBEL.md, was du geprüft und verworfen hast, und beende den Turn. Das ist ein gültiges Ergebnis — eine erfundene Optimierung ist schlechter als keine.

**DREI FRAGEN, BEVOR EINE AENDERUNG AN `src/` ALS FERTIG GILT (30.08.2026).**
Code unter `src/` laeuft unbeaufsichtigt weiter. Eine Messung danach zeigt nur
den **Normalfall** - sie reicht nicht:

1. **Welche Uhr?** Misst der Code dieselbe Zeit, in der die beobachtete Sache
   laeuft? Echtzeit gegen Spielzeit, eigener Takt gegen fremde
   Abschlussbedingung. Am 30.08. verfehlte ein Rueckfall sein Ziel um **eine
   Sekunde** (Abschluss bei 61 s, eigener Takt 60 s) - jedes Mal, unendlich
   oft, ohne dass irgendetwas es meldete.
2. **Was bei Stillstand und Nachholen?** Gedrosselter Tab (die Engine
   verarbeitet dann hoechstens 5 Spielsekunden je Tick), Offline-Nachholen
   (bis 25-fach), Werkzeug neu gestartet, Datei aelter als der Takt. Greift
   die Aenderung dann noch, zu oft, oder gar nicht? Am 30.08. haette eine
   Zeitpruefung nach einer Offline-Nacht 25 Aktionen statt einer durchgelassen
   und das Stadtchaos von 25 auf ueber 1000 getrieben.
3. **Rate oder Bestand?** Speist sich die Zahl, mit der du die Aenderung
   begruendest, aus einem Vorrat, der sich erschoepft? Am 30.08. stand die
   Leitgroesse des Knotens acht Stunden lang auf einem Wert, der in Wahrheit
   das Leerraeumen eines ueber Nacht gewachsenen Lagers war.

Kannst du eine der drei nicht beantworten, schreib
`Geaendert <HH:MM>, Randfaelle ungeprueft` statt `Verifiziert`. Der
Skeptikerloop (Loop 6, alle zwei Stunden) nimmt sie sich dann vor - das ist
kein Makel, sondern der vorgesehene Weg.

**4. Protokollieren — das ist der Teil, der diesen Loop von Bastelei trennt.**

Trag den Hebel oben in `nodes/HEBEL.md` ein:

```
### <Was geändert wurde> (<TT.MM.>, <HH:MM>)
Engpass: <welche Zahl begrenzt, und woran man das sieht>
Hypothese: <Y steigt von A auf mindestens B, weil ...>
Beleg: <Fundstelle im Spielquellcode oder in doku/>
Vorher: <Zahl> um <HH:MM>
Nachher: (offen — nächster Lauf misst)
Commit: <kennung>
```

**Beim nächsten Lauf zuerst die offenen Einträge nachmessen**, bevor du einen neuen Hebel suchst — aber **höchstens zwei Läufe hintereinander am selben Thema**. Am 27.08. gingen drei Läufe in Folge an denselben Fähigkeitsplan (12:52, 13:19, 15:53), weil jeder Eintrag eine offene Nachmessung hinterließ. Das ist ein Gradient, keine Suche. Steht ein Thema zum dritten Mal an, trag die Nachmessung als Auftrag in `nodes/BAUSTELLEN.md` und such woanders. Ist die Zahl nicht gestiegen, trag das ein und nimm die Änderung zurück (`git revert`). Der Eintrag bleibt stehen: Eine widerlegte Hypothese verhindert, dass jemand dieselbe in zwei Wochen noch einmal probiert.

**Miss geglättet.** Die Rangrate schwankt mit dem Ausdauerzyklus; ein 30-Minuten-Fenster misst dessen Phase, nicht die Rate. Nimm den Verlauf aus `data/wache-zustand.json` über mindestens 45 Minuten. Am 26.08. um 21:07 hat ein Fenstervergleich eine Scheindivergenz erzeugt, und um 23:50 wurde eine Änderung an einer Fenstermessung zurückgedreht.

**5. Committen und pushen.** Nur was du selbst geändert hast (`git add <pfad>`, nie `git add -A`) — fünf Loops schreiben in dieselben Dateien. Vor dem Push `git pull --rebase`.

## Ausgabe

**Höchstens 3 Stichpunkte:** welcher Engpass, welche Änderung mit welcher erwarteten Zahl, was der letzte Hebel gebracht hat. Läuft der Lauf ohne Änderung aus, genügt ein Satz.

Nachts (23–5 Uhr) arbeitest du normal weiter, gibst aber nichts im Chat aus außer einer Zeile — Eric liest es am Morgen im Protokoll.

**Hintergrundtasks legen die Loops still — harte Regel, experimentell belegt.**
Ein schwebender Hintergrundtask (`run_in_background`-Bash oder Monitor)
blockiert ALLE Cron-Jobs der Sitzung bis zu seinem Ende, und verpasste
Feuerungen verfallen ersatzlos. Das `timeout` gilt fuer Hintergrund-Bash
NICHT - dort gibt es keine Obergrenze. In der Nacht zum 26.08. hat das die
Loops zwei Stunden stillgelegt: Eine `until`-Warteschleife wartete auf eine
Datei, die es nie geben konnte, und lief 2h56m. Die erste Feuerung kam 45
Sekunden nach dem Kill des Prozesses.
Deshalb:
- Warteschleifen IMMER mit harter Grenze: `for i in $(seq 1 20); do ...;
  sleep 30; done` statt `until <bedingung>`. Eine Bedingung, die nie eintritt,
  wird so zum begrenzten Fehlschlag statt zur Endlosblockade.
- Monitor nur mit knappem `timeout_ms`, **nie** `persistent: true`.
- Wirklich lange Wartearbeit gar nicht als verfolgten Task starten, sondern
  abgekoppelt (`nohup`, `Start-Process`) mit Datei-Polling durch die Loops.
- Vor dem Turn-Ende pruefen, ob ein Task zurueckbleibt. Hilfe:
  `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter
  \"Name='bash.exe'\" | Select-Object ProcessId,CreationDate"` - alles aelter
  als eine halbe Stunde ist verdaechtig.

**Die Loops entscheiden selbst - seit dem 27.08.2026 ohne Ausnahme.**
Aus einer belegten Erkenntnis wird ein **unmittelbarer Arbeitsauftrag**, kein
Wartestatus: Wer eine Zahl gemessen hat, die eine Aenderung rechtfertigt,
setzt sie um, misst nach und nimmt sie zurueck, wenn sie nicht traegt.
"Wartet bis Eric" ist kein Ablageort fuer unbequeme Entscheidungen (seine
Ansage vom 26.08.2026, 16:05, nachdem der groesste offene Hebel des Knotens
vier Laeufe lang dort gelegen hatte).

**`src/bn4net.js` und `src/boot.js` sind seit dem 27.08.2026, 05:00
freigegeben.** Eric hat den Vorbehalt aufgehoben, mit einer Auflage:
**jede Aenderung dort einzeln committen**, damit sie sich einzeln zurueckdrehen
laesst. Sie bleiben Motor und Wiederanlauf - ein Fehler dort kostet den ganzen
Lauf -, also gilt dort besonders: kleine Schritte, nach jeder Aenderung
`node tools/strategie-check.js`, und im Zweifel die vorsichtigere Fassung.

**Die Reihenfolge der BitNodes steht fest und wird von niemandem geaendert** -
weder von Eric noch von den Loops. Sie ist das Ergebnis von Fables Analyse
(`nodes/AUDIT-ROADMAP-2026-08-24.md`). Wer einen Grund zu haben glaubt, sie
anzufassen, traegt ihn in `nodes/BAUSTELLEN.md` ein und faehrt weiter.

Regeln: Systemzeit per `date`, nie schätzen. Keine Augmentierungen von Hand kaufen. NIEMALS einen zweiten Tab auf bitburner-official.github.io öffnen. Kein b1tflum3, kein Destroy-Knopf. Die BitNode-Reihenfolge steht fest (Fables Analyse, `nodes/AUDIT-ROADMAP-2026-08-24.md`) und wird nicht geändert — auch nicht vorgeschlagen.
