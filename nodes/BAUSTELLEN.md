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

### Die Sollrate im Pruefer ignoriert die Erfolgswahrscheinlichkeit (18:21)
Gemessen: 0,15 Rang je Minute ueber 20 Minuten, Aktion `Contracts/Retirement`,
Erfolgschance min 0,493. Der Pruefer erwartet 1,7 und meldet STAGNATION.
Erwartet: Retirement gibt rankGain 0,6 - aber nur bei Erfolg. Bei knapp der
Haelfte sind das effektiv rund 0,3 je Durchlauf. Die gemessenen 0,15 sind damit
plausibel, der Motor arbeitet korrekt.
Verdacht: `tools/strategie-check.js`, Funktion `sollRate()`. Die Tabelle nennt
Bruttowerte aus dem Quellcode und rechnet die Erfolgschance nicht ein. Fuer
Tracking (0,678) faellt das kaum auf, fuer Retirement (0,493) um Faktor zwei.
Zu tun: `blade.js` schreibt die Erfolgschance der laufenden Aktion nach
`data/blade.json`; `sollRate()` multipliziert damit. Zwei Dateien, deshalb hier
eingetragen statt im Wachelauf erledigt.

### Der Bitburner-Tab laeuft gedrosselt (17:47, WIEDER AUFGETRETEN 18:30)
Nachtrag 18:30: Nach Erics Klick um 17:58 lief der Tab wieder mit 5,3 Runden je
Minute. Um 18:30 steht er erneut bei 1,00. Der Klick hilft also nur, solange der
Tab im Vordergrund bleibt - der Weckton von wakelock.js traegt nicht. Damit ist
das kein einmaliger Zwischenfall, sondern ein Dauerzustand, der jeden
Nachtlauf um Faktor fuenf verkuerzt.
Nachtrag 18:53: unveraendert, 0,90 Runden je Minute.

### Der Bitburner-Tab laeuft gedrosselt (Erstbefund 17:47)
Gemessen: Eine Motorrunde in 61 Sekunden (`bn4net.json.runde` 121 -> 122 zwischen
17:46:11 und 17:47:12). Normal sind vier bis sechs je Minute.
Erwartet: 4-6 Runden je Minute. Faktor 5 auf ALLES - Geld, Kampfwerte,
Bladeburner-Rang, jede Aktionsdauer.
Verdacht: `src/wakelock.js` laeuft (steht in der Prozessliste), aber sein
unhoerbarer 19,5-kHz-Ton kommt nicht an. Nach einem Reload steht der
AudioContext auf "suspended", weil Browser Tonausgabe ohne Nutzerinteraktion
blockieren. Das Skript merkt davon nichts und meldet nichts.
Behebbar nur durch einen Klick in den Tab - Eric am 25.08. um 17:48 informiert.
Zu tun, unabhaengig davon: wakelock.js soll `ctx.state` pruefen, `resume()`
versuchen und den Zustand nach `data/wakelock.txt` schreiben, damit der Ausfall
messbar wird statt nur spuerbar.

### tools/wache.js misst noch den Traeger des vorigen Knotens (17:30)
Gemessen: `data/wache-zustand.json` fuehrt als Verlauf ausschliesslich
`hacking`, `geld` und `homeRam` - zuletzt `{"hacking":103,"geld":683838024}`.
Die Stillstandspruefung und die Meldezeile (`tools/wache.js:258, :262-263, :538`)
haengen an diesen Werten.
Erwartet: In BitNode 6 traegt der Bladeburner-Rang, nicht das Hackniveau. Beide
gemessenen Groessen steigen durch bn4net von selbst weiter, auch wenn die
Division vollstaendig stillsteht - der Waechter wuerde also genau den Stillstand
verschweigen, gegen den er gebaut ist.
Verdacht: Fundstelle klar (siehe oben). Es ist derselbe Fehler, gegen den
`tools/strategie-check.js` am 25.08. gebaut wurde - nur eine Ebene tiefer, im
dauerhafteren Bauteil: Der Waechter ist das einzige Stueck, das ohne
Claude-Sitzung laeuft und aufs Handy meldet.
Gefunden nicht von einem Loop, sondern von einem Skeptiker-Subagenten beim
Pruefen eines ganz anderen Entwurfs. Das ist selbst ein Befund.

---

## Offen, nach Dringlichkeit

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
