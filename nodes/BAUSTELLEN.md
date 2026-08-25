# Offene Baustellen

**Diese Datei ist die Arbeitsliste des Vorankommens-Loops.** Sie existiert, weil
Befunde sonst in Prosa verschwinden: Am 24.08.2026 sind drei von fuenf
Pruefbefunden untergegangen, weil sie in einem Fliesstext standen statt in einer
Liste, die man abhaken kann.

Regeln:
- **Ein Arbeitspunkt ist eine Zeile, die mit `### ` beginnt.** Nur solche Zeilen
  zaehlen. Steht unter einer Ueberschrift keine `### `-Zeile, ist der Abschnitt
  leer - Erklaerungen und Fliesstext sind keine Arbeit.
- **`## Sofort` hat Vorrang vor `## Offen`**, ohne Abwaegung. Dort tragen der
  Reportloop und die Wache ein, was sie kaputt vorfinden aber nicht selbst
  beheben. Abgeraeumtes wandert nach "Erledigt".
- **Die Reihenfolge in der Datei IST die Rangfolge.** Nicht neu bewerten, nicht
  umsortieren. Ein Punkt, dessen Ueberschrift mit "Wartet bis <Uhrzeit>"
  beginnt, wird uebersprungen statt angefangen.
- Ein Punkt je Lauf. Wer fuenf Punkte gleichzeitig anfaengt, schliesst keinen.
- Erledigtes wird nach unten verschoben, nicht geloescht - der Verlauf ist die
  Begruendung fuer das, was heute steht.
- Was hier nicht steht, wird nicht bearbeitet. Neue Befunde kommen zuerst hierher.

---

## Sofort

### blade.js stand 23 Minuten in der Regenerationskammer fest (20:42)
Gemessen: `data/blade.json` trug um 20:42 noch den Zeitstempel 20:19:16, Aktion
`General/Hyperbolic Regeneration Chamber`, Ausdauer 27/53. Der Rang stand seit
20:27 unveraendert bei 102 (+4 in 24 Minuten statt der vorher gemessenen 0,8
je Minute). Der Strategiepruefer meldete dabei SPUR - er haelt die Kammer fuer
eine legitime Aktion und misst ihre Sollrate mit null.
Erwartet: Die Ausdauer regeneriert passiv rund 1,2 je Minute
(`Bladeburner.ts:1382`, 0,0085 * agi^0,17). In 23 Minuten haette sie von 27 auf
das Maximum von 53 steigen muessen; die Weiter-Schwelle (60 Prozent = 31,9)
waere nach vier Minuten erreicht gewesen.
Gemessen ist sie in dieser Zeit nur von 27 auf 29 gestiegen - der Zustand war
faktisch eingefroren.
Eingriff 20:43: `WERKZEUG blade.js` ueber den Reload-Kanal. Danach sofort
`Contracts/Retirement` bei Ausdauer 29/53. Der Neustart hat also geholfen, die
URSACHE ist damit nicht gefunden.
Verdacht: Die Hysterese-Schleife in `src/blade.js` (der `continue`-Zweig mit
`ausdauerKnapp || hpKnapp`, geaendert am 25.08. um 20:02). Sie wartet auf
`ns.bladeburner.nextUpdate()` und schreibt in diesem Zweig keine Telemetrie -
ein Haenger dort ist von aussen nicht von normalem Ruhen zu unterscheiden.
Zweiter Verdacht: `HP_WEITER = 0,95` haelt den Bot in der Ruhe, solange die
Trefferpunkte nicht fast voll sind.
Zu tun: In den Ruhe-Zweig eine Telemetriezeile schreiben (dann altert
blade.json nicht mehr und der Haenger wird sichtbar), und die HP-Schwelle
gegen die tatsaechlichen Werte pruefen.

### Der Pruefer haelt die Regenerationskammer fuer Fortschritt (20:42)
Gemessen: URTEIL SPUR bei +4 Rang in 24 Minuten, waehrend der Motor
durchgehend `General/Hyperbolic Regeneration Chamber` fuhr.
Erwartet: Eine Ruhephase von mehr als zehn Minuten ist keine Spur, sondern ein
Befund - erst recht, wenn der Traeger dabei stillsteht.
Verdacht: `sollRate()` in `tools/strategie-check.js` gibt fuer General-Aktionen
eine Sollrate nahe null zurueck und erklaert damit jeden Stillstand fuer
erwartungsgemaess. `stecktInLeerlauf()` greift erst nach 40 Minuten.

### hacktimer.js laeuft nicht mehr, weil es in keiner Startliste steht (20:28)
Gemessen: `data/ps.json` um 20:28 fuehrt blade, bbtrain, wakelock, sonde,
homegrow, bn4door, bn4rep, contracts, popups, bn4life, bn4net - aber kein
hacktimer.js. Um 20:16 lief es noch (`data/hacktimer.json` wurde geschrieben).
Erwartet: Es laeuft dauerhaft, wie wakelock.js und popups.js auch.
Verdacht: Der Reload-Kanal beendet ein Werkzeug, und die Liste WERKZEUGE in
`src/bn4net.js` (ab Zeile 241) startet es neu. Steht es dort nicht - und
hacktimer steht nicht dort -, bleibt es nach dem Reload einfach tot. Derselbe
Mechanismus wuerde es nach jedem Augmentierungs-Einbau verlieren.
Zu tun: Eintrag in WERKZEUGE. Das ist eine Aenderung an bn4net.js und braucht
deshalb Erics Freigabe; bis dahin ist der Patch nur von Hand startbar
(`["hacktimer.js"]` ueber data/task.txt).

### data/blade.json war um 20:27 acht Minuten alt (20:27)
Gemessen: `zeit` 1787681956153 = 20:19:16, gelesen um 20:27:20. blade.js lief
laut ps.json die ganze Zeit (pid 33788 auf werk-0).
Erwartet: Die Datei wird bei jeder Aktionswahl geschrieben; bei Aktionsdauern
von rund 30 Sekunden waeren das hoechstens ein bis zwei Minuten Abstand.
Verdacht: `src/blade.js:360` schreibt nur im Zweig, der eine NEUE Aktion
startet. Bleibt die Aktion dieselbe (hier durchgehend die
Regenerationskammer), wartet die Schleife auf `nextUpdate()` und schreibt
nicht - die Telemetrie altert, obwohl alles laeuft. Fuer den Pruefer und die
Wache sieht das aus wie ein stehender Motor, sobald eine Ruhephase laenger
dauert.


---

## Offen, nach Dringlichkeit

### Worker-Timer-Ersatz gegen die Drosselung (flag-freier Weg)

Die Timer-Drosselung trifft nur den Haupt-Thread. Der Codepfad fuer
Worker-Timer haengt an `BlinkSchedulerWorkerThrottling`, und das Merkmal ist
standardmaessig **aus** (der Pfad traegt im Chromium-Quelltext den Kommentar
"if this feature is ever revived"). Dedicated-Worker-Timer laufen also
ungedrosselt, und die Zustellung per `postMessage` ist keine Timer-Warteschlange.

Bitburner ist dafuer ideal gebaut: Sowohl der Engine-Loop als auch **alle**
Netscript-Wartezeiten (`netscriptDelay` in `NetscriptHelpers.tsx`) greifen
`window.setTimeout` bei JEDEM Aufruf dynamisch ab. Ein nachtraeglich
eingehaengter Ersatz wirkt damit sofort auf Engine und alle laufenden Skripte,
ohne Neustart des Spiels.

Zu tun: `window.setTimeout` und `setInterval` in der Seite durch eine
Worker-getriebene Fassung ersetzen (HackTimer-Prinzip), am besten als
eigenstaendiges Werkzeug neben `src/wakelock.js`. `src/sonde.js` misst bereits
beide Seiten - solange dort `haupt.median` gross und `worker.median` klein ist,
ist der Weg fuer diesen Browser belegt.

Grenze: Ebene 3 (Prozessprioritaet, EcoQoS) bleibt bestehen; die drosselt
Rechenleistung, nicht den Takt. Gegen das Einfrieren von Tabs durch den
Energiesparmodus hilft der Worker ebenfalls nicht.

Ausfuehrlich in `doku/drosselung.md`, Abschnitt 5.

Stand 25.08., 20:20: **gebaut und im Spiel** (`src/hacktimer.js`, dazu
`src/timerzwang.js` als Schalter fuer die Pruefung). Der Selbsttest laeuft
durch, der Patch haengt sich nur bei verstecktem Tab ein und hat einen Waechter
ueber den Originaltimer als Notbremse. Belegt ist auch die Voraussetzung:
`data/sonde.json` meldete um 20:25 bei minimiertem Fenster `worker.median` 5 ms.

Was fehlt: eine Messung des Patches im gedrosselten Zustand. Die ist seit dem
Pegelfix nicht mehr herstellbar, weil der Tab nicht mehr gedrosselt wird - der
Patch ist damit **Rueckfallebene**, nicht Tagesgeschaeft.

Ausserdem offen: `hacktimer.js` steht nicht in der Liste WERKZEUGE in
`src/bn4net.js` (dort ab Zeile 241) und ueberlebt deshalb keinen
Augmentierungs-Einbau. Das Eintragen braucht Erics Freigabe, weil bn4net der
Motor ist.

**Dringlichkeit:** niedrig, seit der Tonanker traegt. Wieder hoch, sobald die
Rundenrate im verdeckten Zustand erneut einbricht.



### Nichts verhindert einen zweiten Waechterprozess

Gemessen 19:43: **zwei** `node tools/wache.js` liefen gleichzeitig (PID 24464 und
19744). Beide schreiben dieselbe Datei `data/wache-zustand.json` - und in ihr
stehen die Meldesperren (`gemeldet`, `stufe`, `seit`). Wer zuletzt schreibt,
gewinnt: Ein Prozess kann die Sperre des anderen ueberschreiben, sodass derselbe
Alarm zweimal aufs Handy geht, oder eine Entwarnung eine noch bestehende
Stoerung aus dem Zustand loescht.

Entstanden ist es vermutlich durch den Startpfad in `/bb-loops`: Der prueft das
**Alter** von `data/wache-zustand.json` und startet neu, wenn sie alt ist. Laeuft
aber bereits ein Waechter, ist die Datei frisch UND der zweite Start passiert
trotzdem, wenn die Pruefung uebersprungen oder von Hand gestartet wurde.

Zu tun: Eine Sperrdatei (`data/wache.pid`) beim Start schreiben, beim Start
pruefen, ob der dort genannte Prozess noch lebt, und sich sonst beenden.
Beide Prozesse wurden 19:44 beendet, einer neu gestartet - das ist die
Symptombehandlung, nicht die Ursache.

**Dringlichkeit:** mittel. Es beschaedigt still die Meldelogik des einzigen
Bauteils, das ohne Claude-Sitzung laeuft.



### Die Erwartungswerte des Pruefers sind geschaetzt, nicht gemessen

Zweimal an einem Nachmittag hat `sollRate()` in `tools/strategie-check.js` einen
Fehlalarm erzeugt, beide Male aus derselben Wurzel: Die Zahlen stammen aus einer
Ueberschlagsrechnung am Spielquellcode, nicht aus dem eigenen Messverlauf.
- 17:00: eine feste Rate von 29 je Minute, aus einem Zwei-Stunden-Ziel geteilt
- 18:21: Bruttoertraege ohne die Erfolgswahrscheinlichkeit

Beide Male wurde die Formel nachgebessert. Beide Male blieb sie eine Schaetzung.

`data/verlauf-strategie.json` enthaelt inzwischen zu jedem Messpunkt Zeit, Wert,
Aktion und Urteil - damit liesse sich die tatsaechliche Rate je Aktionsart aus
dem eigenen Lauf ableiten, statt sie zu raten. Ein gleitender Median ueber die
letzten Stunden je Aktion waere selbstkalibrierend und ginge nicht mehr daneben,
wenn sich Aktionslevel oder Faehigkeiten aendern.

**Dringlichkeit:** mittel. Ein Fehlalarm ist teurer als er aussieht - er schickt
die Wache in ihre Diagnosebranche und stumpft ihre Meldungen ab.


### blade.js hat kein Gegenmittel gegen leere Vertragsvorraete

Zweimal an einem Nachmittag ist der Motor in "General/Training" gelandet, beide
Male mit demselben Muster: keine Aktion ueber der Schwelle, also Rueckfall auf
etwas, das keinen Rang bringt. Um 17:00 war die Schwelle zu hoch (0,80), um
18:12 war der Vorrat leer (Tracking offen 0,4 bei Stufe 10). Beide Male wurde
die Schwelle gesenkt - das ist Symptombehandlung.

Die Ursache liegt tiefer: Vertraege und Operationen haben endliche Zahlen und
wachsen nur langsam nach (Bladeburner.ts:1387-1390), waehrend Chaos mit jedem
Einsatz steigt und passiv fast nicht faellt (0,0001/s, Bladeburner.ts:1397).
Das Spiel hat dafuer zwei Werkzeuge, die `blade.js` nicht kennt:
- **Incite Violence** fuellt die Vorraete sprunghaft auf (Bladeburner.ts:1221-1224)
- **Diplomacy** senkt das Chaos (Bladeburner.ts:1185-1195)

Ohne beide bleibt jede Schwellensenkung ein Aufschub: Irgendwann ist auch der
letzte Vertrag leer, und dann faellt der Motor wieder in Training. Zu tun: beide
Aktionen in die Auswahl aufnehmen - Incite Violence, wenn die Summe der offenen
Vertragszahlen unter einen Schwellwert faellt, Diplomacy, wenn das Chaos der
Arbeitsstadt eine Grenze ueberschreitet.

**Dringlichkeit:** hoch. Es ist die Ursache hinter zwei bereits behobenen
Symptomen, und sie tritt garantiert wieder auf.


### 1. Der V2-Kontrollpunkt ist nie gemessen worden

`nodes/ROUTE.md` Abschnitt 4 erklaert ihn fuer bindend: **Rang nach zwei Stunden
in BitNode 6 mindestens 6.000 mit Raid, mindestens 3.500 ohne.** Die gesamte
Reihenfolge ab Platz 3 steht auf einer Simulation, die nie gegen einen echten
Lauf geprueft wurde.

**Der Beitritt steht seit dem 25.08.2026 zwischen 16:20 und 16:29** (um 16:19:55
war der Kampfwert-Tiefstand noch 98, um 16:29:23 meldete `bblage.json`
`inBladeburner: true` bei Rang 0). Genauer laesst er sich nicht mehr eingrenzen:
bbtrain schrieb `data/bbjoin.txt` lokal auf die Werkbank statt nach home - das
ist inzwischen behoben, half aber fuer diesen Beitritt nicht mehr.

**Der Kontrollpunkt faellt damit auf 18:30 Uhr.** Zu messen ist dann der Rang
aus `data/blade.json` gegen die Schwelle aus ROUTE.md: mindestens 6.000 mit
Raid, mindestens 3.500 ohne. Das Ergebnis gehoert nach ROUTE.md.

Zwischenstand 16:29: Rang 0, Ausdauer 41/41, Aktion "Field Analysis" (die
Erfolgsschaetzungen sind noch zu unscharf fuer einen Vertrag), naechste Black Op
"Operation Typhoon" ab Rang 2.500.

**Dringlichkeit:** hoch. Es ist das wertvollste Einzelergebnis der naechsten
Tage - an ihm haengt die gesamte Reihenfolge ab Platz 3.

### 2. Der Erfahrungsofen (Befund B1 aus dem Bot-Audit)

Der Umbau wurde am 25.08. per `git checkout` zurueckgenommen, weil die
Skeptiker-Runde vier Konstruktionsfehler fand: Das "Ventil" mass Fragmentierung
statt Bedarf, hebelte die Kaufbremse aus, vertrat den Stapelbetrieb gar nicht
und hatte eine katastrophale Kill-Granularitaet.

`src/worker/expfarm.js` liegt fertig und unverdrahtet im Baum (1,75 GB je Faden
statt 1,80 beim Einwegarbeiter). Was fehlt, ist die Zuteilung:
- Ofenbudget aus den Bedarfen DERSELBEN Runde ableiten, nicht aus der vorigen
- Raeumen nach dem share-Muster (bn4net.js:1565)
- Lease im Arbeiter gegen Waisen
- `ramJeSkript` um `worker/expfarm.js` ergaenzen
- danach den Einweg-Pfad (bn4net.js ~1596-1622) streichen

**Dringlichkeit:** niedrig in BitNode 6 - der Ofen beschleunigt den
Hacking-Weg, und der traegt diesen Knoten nicht. Vor dem naechsten V1-Knoten
wieder hochstufen.

### 3. Boersen-Bot fuer BitNode 8

BitNode 8 steht ganz am Ende der Route (Platz 42-44) und ist der einzige Knoten
ohne Bladeburner, Gang, Corporation und Skript-Hackgeld. Reputation ist dort
eine reine Geldfrage - und Geld kommt nur aus dem Aktienmarkt. Den Bot gibt es
noch nicht.

**Dringlichkeit:** niedrig, aber nicht null: Er ist die einzige Voraussetzung
auf der ganzen Route, die noch gar nicht existiert.

### 4. Darknet-Labyrinth-Gewerk (V1b)

`labyrinth.ts:424-427` legt The Red Pill ins sechste Darknet-Labor, aber nur bei
`hasFullDarknetAccess()` - also in BitNode 15 oder mit SF15. Jeder
Augmentierungs-Einbau wuerfelt das Darknet neu (Prestige.ts:76), es braucht also
je Labor einen Einbauzyklus und rund 24 Raetselloeser.

**Dringlichkeit:** niedrig. Erst vor BitNode 15 relevant.

---

## Erledigt

### Der Bitburner-Tab lief gedrosselt - der Tonanker war zu leise (25.08., 20:25)

Gemessen am 17:47 und ueber Stunden: eine Motorrunde je Minute statt vier bis
sechs, sobald das Fenster verdeckt war. Zwei Verdaechtige wurden geprueft und
verworfen: der Tonanker lief nachweislich (`ctx.state === "running"`), und eine
zweite, audio-resistente Drosselung fuer verdeckte Fenster gibt es nicht.

Die Ursache lag im Pegel. Chromium entscheidet die Hoerbarkeit an der
gemessenen LEISTUNG des Stroms gegen -72,247 dBFS; fuer einen Sinus liegt die
Leistung 3 dB unter der Amplitude. Der bisherige Wert 0,0005 ergab -69,0 dBFS -
3,2 dB Reserve, ein Grenzfall, der mit Ausgabegeraet oder Mixerpfad kippt. Das
erklaert, warum derselbe Kniff am 21.08. wirkte und am 25.08. nicht.

Behoben 20:03 in `src/wakelock.js`: Verstaerkung 0,01 (-43,0 dBFS, 29 dB
Reserve), dazu wird `ctx.sampleRate` mitgeloggt.

**Verifiziert 20:23-20:25 bei MINIMIERTEM Fenster: 12 Motorrunden in 120
Sekunden, also 6,0 je Minute** - der volle Wert. `data/sonde.json` meldete
dabei `sichtbarkeit: hidden` und 0 Bilder je Sekunde, `data/wakelock.txt`
meldete `running|48000`. Vorher lag die Rate im selben Zustand bei 0,93.

Damit ist der Faktor sechs zurueck, ohne dass Eric Opera neu starten muss. Die
Flags aus `doku/drosselung.md` Abschnitt 4 bleiben die dauerhaftere Loesung -
der Ton haengt an einer Einstufung, die der Browser jederzeit anders treffen
kann.

Die vollstaendige Mechanik steht in `doku/drosselung.md`.


### tools/wache.js misst jetzt den Traeger des Knotens (25.08., 19:44)
Gemessen 17:30: Der Waechter fuehrte als Verlauf nur `hacking`, `geld` und
`homeRam`. Beide steigen in BitNode 6 durch bn4net von selbst weiter, auch wenn
die Bladeburner-Division vollstaendig stillsteht - der Waechter haette genau den
Stillstand verschwiegen, gegen den er gebaut ist. Gefunden von einem
Skeptiker-Subagenten, nicht von einem Loop.

Behoben in `tools/wache.js`: Frisches `data/blade.json` (juenger als 10 min)
gilt als Zeichen fuer einen Bladeburner-Knoten - damit braucht die Pruefung die
Knotennummer gar nicht. Der Rang wandert in den Messverlauf; steht er
45 Minuten unveraendert, faellt der neue Befund `traeger`. Ist der Tab gedrosselt,
schweigt er: Dann nennt der Tempobefund die Ursache, und zwei Nachrichten ueber
dieselbe Sache waeren Laerm.

Bewusst nicht die 2024 ausgebaute Hacking-Pruefung wiederbelebt (siehe Punkt 5
im Quelltext): Die scheiterte an "hat sich irgendetwas bewegt". Der Rang hat
genau eine Quelle - versiegt sie, ist der Knoten blockiert.

**Verifiziert um 19:44 auf zwei Wegen:** Im Normallauf meldet der Waechter
`still - Hacking 114, $2.1b, Rang 73` (der Traeger steht jetzt in der
Meldezeile), und gegen einen praeparierten Verlauf mit 50 Minuten Stillstand
faellt der Befund `Bladeburner-Rang steht seit 50 min bei 73`. Der residente
Prozess laeuft seit 19:44 mit dem neuen Code.


### Der Pruefer stuerzte beim Beenden ab, nach der Urteilszeile (25.08., 19:12)
Gemessen: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING),
file src/win/async.c, line 94` nach `URTEIL: SPUR`, bei etwa jedem dritten Lauf.
Ursache: `process.exit()` reisst Node mitten aus der Ereignisschleife, waehrend
noch Handles offen sind.
Behoben: `process.exitCode` statt `process.exit()` - derselbe Rueckgabewert,
aber Node schliesst seine Handles selbst. Alle fetch-Aufrufe sind awaited und
ihre Timeouts im finally geloescht, es bleibt nichts haengen.
Nicht kosmetisch: Der Wache-Prompt prueft, ob die Ausgabe auf `URTEIL:` endet,
und haelt den Pruefer sonst fuer kaputt - samt Push-Nachricht, obwohl alles
laeuft. Ein Fehlalarm aus dem Alarmwerkzeug selbst ist die teuerste Sorte.
**Verifiziert: fuenf Laeufe in Folge um 19:12, jeder endet auf der Urteilszeile;
Rueckgabewert 0 bei SPUR unveraendert.**

### Die Sollrate ignorierte die Erfolgswahrscheinlichkeit (25.08., 18:42)
Gemessen 18:21: 0,15 Rang je Minute bei `Contracts/Retirement` mit 0,493
Erfolgschance. Der Pruefer erwartete 1,7 - den Bruttoertrag laut Quellcode - und
meldete STAGNATION, obwohl der Motor genau das Richtige tat. rankGain 0,6 mal
knapp der Haelfte Erfolg sind effektiv rund 0,3 je Durchlauf.
Behoben in zwei Dateien: `blade.js` schreibt die Erfolgschance der laufenden
Aktion nach `data/blade.json`, `sollRate()` multipliziert damit. Fehlt das Feld,
wird konservativ mit 0,5 gerechnet.
**Verifiziert: `chance: 0.482` in blade.json und URTEIL SPUR um 18:42** (vorher
STAGNATION bei identischer Lage).

### blade.js fiel auf General/Training zurueck, weil Tracking leer war (25.08., 18:13)
Gemessen 18:12: Tracking offen 0,4 bei Stufe 10 (leergespielt), Retirement min
0,493 - sieben Tausendstel unter der Schwelle 0,50. Der Motor wartete auf nichts
und fuhr Training, das keinen Rang gibt. Chaos war 0, Overclock bereits auf
Stufe 2 - der Faehigkeitenkauf funktioniert also, der erste Verdacht war falsch.
Behoben: Vertragsschwelle 0,50 -> 0,45. Ein misslungener Vertrag kostet Zeit und
etwas Chaos, aber keinen Rang; verglichen wird nicht mit einem besseren Vertrag,
sondern mit Training, und das liefert garantiert null.
**Verifiziert: aktion "Contracts/Retirement" um 18:13** (vorher
"General/Training").
Die Ursache dahinter - endliche Vorraete ohne Gegenmittel - steht als
struktureller Punkt unter Offen.

### Der Faehigkeitenkauf kaufte das Billigste statt des Wichtigsten (25.08., 17:20)
Gemessen um 17:15, eine Dreiviertelstunde nach dem Beitritt: Overclock Stufe 0
(Plan-Platz 1), Blade's Intuition Stufe 0 (Plan-Platz 2), Digital Observer
Stufe 1 (Plan-Platz 3). Rang wuchs mit 0,24 je Minute.

Ursache: Die Kaufschleife stieg bei "zu teuer" mit `break` aus dem aktuellen
Skill aus und machte mit dem NAECHSTEN weiter. Der Kommentar darueber versprach
"strikt nach Plan, nicht nach Preis" - der Code tat das Gegenteil. Da Punkte
einzeln anfallen, konnte so systematisch nur das Billigste gekauft werden,
waehrend die beiden Faehigkeiten mit Wirkung auf JEDE Aktion auf null blieben.

Behoben: Beim ersten Eintrag stehenbleiben, der nicht am Deckel ist, und sparen
bis er bezahlbar ist. Ein Punkt, der eine Runde liegen bleibt, ist billiger als
einer, der im falschen Skill steckt - Faehigkeiten lassen sich nicht
zurueckgeben.

Offen geblieben und bewusst nicht angefasst: Die Ausdauer-Hysterese (ruhen ab
55 %, weiterarbeiten erst ab 90 %) kostet viel Zeit - um 17:15 lief
"Hyperbolic Regeneration Chamber" bei 31,6 von 43,8. Ob 90 % zu hoch gegriffen
ist, laesst sich erst nach dem Kontrollpunkt sinnvoll beurteilen; zwei
gleichzeitige Aenderungen waeren nicht mehr auseinanderzuhalten.

### bn4rep.js lief seit dem Einbau um 05:50 nicht (25.08., behoben 16:50)
Die Werkbank war strukturell zu klein geworden. Auf werk-0 (1.024 GB) lagen
blade 41,25 + bbtrain 94,75 + bn4life 293,8 + homegrow 148,5 + wakelock 34,25 +
bn4door 99,85 = 712,4 GB; fuer bn4rep mit 768,25 GB blieben 312,25 GB. Gestartet
wurde ausschliesslich auf der Werkbank, also gab es keinen zweiten Wirt - und
die Zeile "wartet" stand nur im Spiel-Log, das von aussen niemand liest.

Platz gab es durchaus: fulcrumtech haette nach dem Raeumen seiner Arbeiter
1.021 GB gehabt. Nur hat niemand dort nachgesehen.

Behoben: Jedes fehlende Werkzeug sucht sich jetzt selbst einen Wirt - erst die
Werkbank, und wenn es dort auch nach dem Raeumen nie passen kann, den Rechner
mit dem meisten Platz nach Raeumung. Gemessen 16:50: bn4rep laeuft auf
fulcrumtech.

Dazu neu: `src/werkbank.js` beantwortet die Frage "warum startet ein Werkzeug
nicht" in einer Datei statt im Spiel-Log.

### bn4life und blade.js stritten sekuendlich um die Figur (25.08., 16:25)
Unmittelbar nach dem Beitritt zur Division erschienen im Spiel sekuendlich
Dialoge "Your Bladeburner action was cancelled because you started doing
something else". Ursache: Eine Bladeburner-Aktion ist keine Arbeit im Sinne von
`getCurrentWork()` - die Funktion gibt dabei null zurueck. bn4life las das als
"die Figur hat nichts zu tun" und schob ein Verbrechen nach, was die
Bladeburner-Aktion abbrach; blade.js startete sie neu, bn4life schob wieder
nach. Beide Seiten liefen ins Leere.
Behoben: bn4life begeht keine Verbrechen mehr, solange `inBladeburner()` true
ist (0 GB, also gratis). In einem Knoten, dessen Ausgang ueber Black Operations
fuehrt, traegt Bladeburner - Verbrechen sind Beiwerk.

### bbtrain trainierte nur str, waehrend def/dex/agi auf 1 standen (25.08.)
Behoben in 19c324d. Stadt und Studio werden jetzt in der Trainingsschleife
geprueft statt einmal davor. Wirkung nach acht Minuten: str 107, def 37, dex 43,
agi 15.
