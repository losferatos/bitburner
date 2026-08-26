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

*Alle drei Punkte tragen "Wartet bis" und werden vom Vorankommens-Loop
uebersprungen - nicht weil sie unwichtig waeren, sondern weil sie an ein
Ereignis gebunden sind, das noch nicht eingetreten ist. Zwei brauchen den
naechsten Augmentierungs-Einbau als Pruefstein, einer Erics Freigabe fuer
`src/bn4net.js`. Ohne diese Kennzeichnung stuende jeder Lauf vor derselben
Wand, statt die Liste weiter abzuarbeiten (gekennzeichnet 26.08., 00:44).*

### Wartet bis zum naechsten Einbau: Das Guthaben war negativ, -1,58 Millionen (22:18)
Gemessen: `data/bn4net.json` meldet `geld -1576559.02`, der Strategiepruefer
zeigt "Geld -2m". Netz 13 von 70 gerootet, der Wiederaufbau nach dem Einbau
laeuft also noch.
Erwartet: Nie unter null. Ein negatives Guthaben blockiert in Bitburner jeden
weiteren Kauf - Portprogramme, Server, Augmentierungen -, und genau die
braucht der Wiederaufbau.
Ursache **gefunden 22:46**: Es trainierten ZWEI Skripte gleichzeitig im
Powerhouse Gym. Neben `bbtrain.js` (Ziel 100) lief `joinrun.js` (Ziel 80) mit
derselben Aufgabe und einer anderen Reihenfolge. joinrun prueft zwar, ob
bereits trainiert wird - aber nur auf GENAU die Uebung, die es selbst will.
Trainierte die Figur "agi" und joinrun wollte "str", startete es trotzdem,
bbtrain schaltete zurueck, und jeder Wechsel kostete Gym-Gebuehren.
Dazu passt der Stadtstreit: joinrun reist absichtlich nach Ishima (Zeile 87,
Stadtbedingung fuer Tetrads und Tian Di Hui), bn4life nach Aevum
(`bn4life.js:208`), bbtrain zurueck nach Sector-12 - jede Reise kostet 200.000.
Das erklaert den Befund von 21:47 und 22:43 gleich mit; beide Eintraege sind
hier aufgegangen.
**Geaendert 22:46 in `src/joinrun.js`, Wirkung noch nicht gemessen:** Laeuft
irgendein Kurs, laesst joinrun die Finger davon und wartet, bis die Werte da
sind. Nachzumessen beim naechsten Augmentierungs-Einbau - nur dann laufen
beide Skripte gleichzeitig. Zu pruefen ist dann: Bleibt das Guthaben ueber
null, und steigen die Kampfwerte ohne Ruckeln?
Offen bleibt die Frage, ob ein Training bei leerem Konto ueberhaupt starten
darf. Bladeburner-Training ist gratis (Bladeburner.ts:1091-1105) und hebt die
Kampfwerte ebenfalls - langsamer, aber ohne Schulden.

### Wartet bis Eric bn4net freigibt: Nach einem Einbau starten die Werkzeuge nicht nach (22:03)
Gemessen 22:01, kurz nach einem Einbau (Kampfwerte auf 1, Netz 13/70, Geld 1m):
`data/ps.json` fuehrt nur bn4net, bn4life, joinrun, popups und contracts.
**Es fehlen blade.js, bbtrain.js, wakelock.js, homegrow.js, bn4rep.js und
bn4door.js** - darunter der Motor des Knotens und der Tonanker.
Erwartet: bn4net startet fehlende Werkzeuge in seiner Runde selbst nach.
Es liegt NICHT am Platz: `data/werkbank.json` meldet um 22:03 auf home
1024 GB gesamt, **253,1 GB frei**, 339,7 nach Raeumung. blade braucht 47,75,
bbtrain 94,75, wakelock 34,25 - alle drei zusammen passen.
Verdacht: Die Nachstart-Logik in `src/bn4net.js` (die `fehlend`-Liste um
Zeile 2576). Sie hat in den zwanzig Minuten nach dem Einbau nichts gestartet.
Der Reload-Kanal hilft hier nicht: `WERKZEUG <name>` **killt nur** (bn4net.js
:532-545) und verlaesst sich aufs Nachstarten - laeuft das Werkzeug gar nicht,
trifft der Befehl ins Leere.
Eingriff 22:05: wakelock, bbtrain und blade einzeln ueber den Auftragskanal
gestartet (`["wakelock.js"]` in data/task.txt). Danach laufen alle drei.
Zu tun: Entweder die Nachstart-Logik reparieren (bn4net, braucht Erics
Freigabe) oder dem Reload-Kanal ein "starte, falls nicht laufend" geben.
Dies ist der vierte stille Fehlschlag des Wiederanlaufs an einem Tag.

**Nachtrag 23:16 - die Folge ist abgefangen, die Ursache nicht.**
`tools/wache.js` startet jetzt selbst nach. Der residente Waechter war bisher
reine Beobachtung; er meldet aufs Handy und konnte nichts tun. Genau das hat
heute vier Mal Stunden gekostet, und nachts haette es bis zum Morgen gedauert.

Geprueft werden die beiden Werkzeuge, deren Telemetrie ihr Lebenszeichen ist:
`blade.js` ueber `data/blade.json` (der Motor des Knotens - seit 22:16 schreibt
er in JEDEM Zweig) und `wakelock.js` ueber `data/wakelock.txt` (der Tonanker;
ohne ihn drosselt der Browser auf ein Timer-Aufwachen je Minute). Aelter als
zehn Minuten heisst: laeuft nicht mehr. Dann schickt der Waechter
`["<name>"]` in den Auftragskanal - vorher pruefend, ob der frei ist, denn er
hat genau einen Leser und gehoert sonst einem Loop. Hoechstens ein Versuch je
Werkzeug und Viertelstunde.

**Verifiziert 23:15:** `data/wakelock.txt` von Hand auf einen 15 Minuten alten
Zeitstempel gesetzt, danach `node tools/wache.js --einmal`. Ergebnis:
"Nachgestartet: wakelock.js (Telemetrie war 15 min alt)", und um 23:15:08
meldete das Werkzeug seinen Start. Der Folgelauf ist wieder still.

Nicht geprueft wird `bbtrain.js` - es schreibt nur bei Ereignissen, ein Alter
sagt dort nichts. Und die URSACHE bleibt offen: Warum bn4net nach einem Einbau
zwanzig Minuten lang nichts nachstartet, obwohl Platz da ist, steht weiter
oben und braucht Erics Freigabe fuer eine Aenderung am Motor.

**Nachtrag 22:16 - der Reload-Kanal ist derzeit eine Falle.** Ein
`WERKZEUG blade.js` um 22:15 hat blade.js beendet, und nichts hat es
zurueckgeholt: Um 22:16 fehlte es in `data/ps.json`. Wer den Kanal benutzt,
legt das Werkzeug also still, statt es neu zu starten. Bis das behoben ist,
gilt: **Werkzeuge ueber den Auftragskanal starten** (`["blade.js"]` in
data/task.txt), nicht ueber den Reload-Kanal. Das gehoert auch in die
Loop-Prompts, die den Reload-Kanal bisher als Standardweg nennen.

### Wartet bis zum naechsten Einbau: Erkennt der Pruefer ihn jetzt? (22:01)
Gemessen: URTEIL SPUR bei Kampfwerten 1/1/1/1, Netz 13/70 und 1m Guthaben -
alles Zeichen eines frischen Einbaus.
Erwartet: RESET. Danach gehoert der Wiederanlauf geprueft, und genau der ist
diesmal wieder stillgeschwiegen gescheitert (siehe Punkt darueber).
Verdacht: `tools/strategie-check.js` erkennt RESET am Rueckgang des TRAEGERS.
In BitNode 6 ist der Traeger der Bladeburner-Rang - und der ueberlebt einen
Augmentierungs-Einbau, er faellt nur beim BitNode-Wechsel. Der Einbau ist
deshalb fuer diesen Pruefer unsichtbar.
**Geaendert 23:47, Wirkung noch nicht gemessen:** Der Pruefer meldet RESET,
wenn die Phase von etwas anderem auf "Wiederaufbau nach Einbau" wechselt. Das
tritt genau einmal je Einbau auf, und danach betritt die Wache ihren
RESET-Zweig und prueft den Wiederanlauf - genau das, was um 22:01 gefehlt hat.

Eine Falle steckte im ersten Entwurf: Als Vergleich diente `frueher`, und das
ist nach TRAEGER gefiltert. Nach einem Einbau enthaelt die Liste nur Punkte
aus der VORIGEN Wiederaufbauphase, deren Phase dieselbe ist - der Wechsel
waere unsichtbar geblieben. Verglichen wird jetzt mit dem letzten Messpunkt
des Knotens, unabhaengig vom Traeger.

Nachzumessen beim naechsten Augmentierungs-Einbau: Kommt genau ein
`URTEIL: RESET`, und bleibt es danach bei SPUR? Ein Versuch, den Fall mit
praeparierten Kampfwerten in `data/bblage.json` herbeizufuehren, ist
gescheitert - `frischerSteckbrief()` erneuert die Datei selbst, sobald sie alt
wirkt, und ueberschreibt die Praeparation.

---

## Offen, nach Dringlichkeit

### Der Motor steht drei Viertel der Zeit in der Regenerationskammer

Gemessen 26.08. um 06:47 ueber `tools/ratencheck.js`: **161 von 222 Minuten -
72,5 Prozent - in `General/Hyperbolic Regeneration Chamber`.** Die Arbeitszeit
bringt 1,4 bis 2,0 Rang je Minute, ueber alles bleiben **0,475**.

Faellt die Kammerzeit von 72 auf 30 Prozent, verdreifacht sich die Rate. Das
ist der groesste Einzelhebel des Knotens - groesser als jede Feinarbeit an der
Aktionsauswahl. Bei Rang 327 von 2.500 fuer die erste Black Op entscheidet er
ueber Tage.

Der Ruhegrund steht in der Telemetrie und ist fast immer derselbe:
`"grund": "ruht bis HP 17"`. Es sind die TREFFERPUNKTE, nicht die Ausdauer -
das Maximum liegt bei 22 bis 23, jeder misslungene Vertrag kostet welche, und
die Kammer heilt nur 2 je Durchlauf (`Bladeburner.ts:1198`).

Ansaetze, in der Reihenfolge ihrer Wucht:
1. **Mehr Trefferpunkte.** Sie haengen an Defense (`Player.hp.max`); bbtrain
   traniert nur bis Kampfwert 100 und hoert dann auf. Ein hoeherer Zielwert
   waere ein dauerhafter Gewinn statt einer Symptombehandlung.
2. **Weniger Schaden.** Der Schaden je Misserfolg haengt an der Schwierigkeit
   der Aktion. Ein sichererer Vertrag mit etwas weniger Ertrag koennte netto
   gewinnen, wenn er die Kammerzeit halbiert - das ist rechenbar, sobald
   `data/aktionen.txt` genug Abschnitte je Aktion hat.
3. **Die HP-Schwelle senken.** Sie steht auf 50/75 Prozent. Weiter zu arbeiten
   heisst mehr Erfolge je Stunde, aber auch das Risiko, im Krankenhaus zu
   landen (Zeit- und Geldverlust). Vorher pruefen, was ein Krankenhausaufenthalt
   tatsaechlich kostet.

**Verifiziert 07:15 - der groesste Teil ist gehoben.** Seit dem
Krankenhaus-Hebel von 06:55 (`nodes/HEBEL.md`):

    bis 06:55   229,0 min gesamt, 166,0 in der Kammer (72,5 %)  ->  0,484/min
    ab  06:55    18,1 min gesamt,   6,1 in der Kammer (33,5 %)  ->  1,118/min

Faktor 2,3 auf die Rangrate. Ansatz 1 (mehr Trefferpunkte) wurde dabei
verworfen, bevor er umgesetzt wurde: Bei doppeltem Maximum verdoppelt sich die
Ruhezeit mit, der Anteil bleibt gleich.

**Was bleibt, ist ein anderer Engpass.** Die verbliebenen 33,5 Prozent sind
Ausdauer-Ruhe, nicht Trefferpunkte - dagegen hilft kein Krankenhaus. Die
Ausdauer regeneriert passiv rund 1,2 je Minute (`Bladeburner.ts:1382`), die
Kammer verdoppelt das. Ansaetze:
- **Die Hoechstausdauer heben.** Sie haengt an den Kampfwerten
  (`calculateMaxStamina`), und anders als bei den Trefferpunkten wirkt das
  hier: Eine groessere Reserve heisst laengere Arbeitsphasen bei gleicher
  Regeneration je Minute.
- **Die Faehigkeit "Reaper"** hebt die effektiven Kampfwerte um 2 Prozent je
  Stufe und damit mittelbar die Hoechstausdauer.
- **Weniger Ausdauerverbrauch:** `BaseStaminaLoss * difficultyMultiplier`
  (`Bladeburner.ts:921`) - schwierigere Aktionen kosten mehr. Auch das ist ein
  Tausch, der sich rechnen laesst, sobald genug Abschnitte je Aktion vorliegen.

**Dringlichkeit:** mittel, seit der Krankenhaus-Hebel greift. Vorher war es die
einzige Zahl, die den Knoten um Tage verkuerzen konnte.


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

**Stand 26.08., 02:15: Der geplante Umbau ist widerlegt, bevor er begann.**
`tools/ratencheck.js` (neu) rechnet die tatsaechlichen Raten je Aktion aus dem
Verlauf. Ergebnis ueber 73 Messpunkte:

    Aktion                                  n   median      max   Null%
    General/Hyperbolic Regeneration Chamber 16    0.072    1.032      50
    Contracts/Retirement                     6    0.000    0.308      67
    General/Training                         2    0.151    0.200       0

Contracts/Retirement zeigt einen Median von **null** - waehrend der Rang im
selben Zeitraum nachweislich um rund 0,5 je Minute gestiegen ist. Die Zahlen
sind also nicht die Wahrheit, gegen die man die Formel haelt, sondern selbst
ein Artefakt.

Der Grund ist die Aufloesung: Ein Verlaufspunkt traegt die Aktion, die im
MOMENT der Messung lief; der Zuwachs davor stammt aus zwanzig Minuten, in
denen der Motor mehrfach gewechselt hat. Die Rate landet bei der Aktion, die
zufaellig zum Messpunkt lief - und das ist zur Haelfte die Kammer, die
naturgemaess null bringt.

**Zu tun, in dieser Reihenfolge:**
1. ~~`blade.js` protokolliert bei JEDEM Aktionswechsel Rang und Zeit.~~
   **Erledigt 26.08., 03:01.** Beim Wechsel wird der abgeschlossene Abschnitt
   nach `data/aktionen.txt` geschrieben: von, bis, Aktion, Grund, Rang davor
   und danach - mit dem UNGERUNDETEN Rang, anders als im Messverlauf.
   Abschnitte unter zehn Sekunden gelten als Umschaltzucken und entfallen.
   *Verifiziert 03:01:*

       Contracts/Tracking        42 s   Rang 221,855 -> 222,530   (0,96/min)
       Contracts/Bounty Hunter   22 s   Rang 222,530 -> 222,530   (Misserfolg)

   Die Endung ist `.txt`, nicht `.jsonl`: Bitburner laesst nur wenige
   Dateiendungen zu und weist alles andere mit "Invalid file extension" ab.
2. ~~`tools/ratencheck.js` gegen diese Datei laufen lassen.~~
   **Erledigt 26.08., 05:47.** Das Werkzeug holt die Datei ueber die Bruecke
   und rechnet gewichtet (Summe Rang durch Summe Zeit), nicht als Median
   einzelner Abschnitte. Die Erfolgsquote faellt dabei gratis ab: Der Anteil
   der Abschnitte mit Rangzuwachs ist die GEZAEHLTE Erfolgswahrscheinlichkeit.
   Ergebnis ueber 84 Abschnitte (164 Minuten):

       Aktion                                    n     min  Rang/min  Erfolg
       Contracts/Tracking                       31    19,9     1,994     84%
       Contracts/Retirement                      2     1,3     1,547     50%
       Contracts/Bounty Hunter                  28    21,2     1,469     64%
       General/Hyperbolic Regeneration Chamber  23   122,0     0,000      0%

3. **Die Formel liegt um Faktor 5 bis 6 daneben - und der Grund ist gefunden.**
   Der Pruefer rechnet `rankGain * Chance / Dauer`, fuer Tracking also
   0,3 * 0,73 / 0,63 min = **0,35** je Minute. Gemessen sind es **1,994**.
   Es fehlt der Levelfaktor: `Bladeburner.ts:917` multipliziert den Ertrag mit
   `Math.pow(action.rewardFac, action.level - 1)`, und `rewardFac` ist
   standardmaessig 1,02 (`Actions/LevelableAction.ts:20`). Tracking stand am
   25.08. auf Stufe 14 - allein das erklaert einen Teil; die Faehigkeiten
   (Blade's Intuition, Overclock) kommen dazu.
   **Geaendert 26.08., 06:16, Wirkung noch nicht gemessen:**
   `blade.js` schreibt die Stufe der laufenden Aktion nach `data/blade.json`
   (`getActionCurrentLevel`, nur fuer Contracts und Operations - General-
   Aktionen haben keine). `sollRate()` multipliziert die Erwartung mit
   `rewardFac^(stufe-1)`; die Faktoren stehen je Aktion im Quellcode
   (Contracts.ts:18, 52, 85 - Tracking 1,041, Bounty Hunter 1,085,
   Retirement 1,065; Operations.ts:18, 52, 88, 123, 163, 201).
   Nachzumessen ist das erst, wenn der Motor wieder an einem Vertrag steht -
   bei der Messung um 06:16 ruhte er (`stufe: null`, Kammer).

   **Der Restfaktor ist erklaert (26.08., 06:45) - er war ein
   Auswertungsfehler, kein Spielgeheimnis.**
   Gemessen mit echtem Wert: `Contracts/Tracking`, **Stufe 24** (nicht 14),
   Chance 0,737. Damit rechnet die Formel
   0,3 * 1,041^23 = 0,756 Rang je Erfolg, mal 0,737 durch die AKTIONSdauer
   von 13 Sekunden = **2,57 Rang je Minute**. Gemessen sind 1,984 - eine
   Abweichung von 1,3, die durch Rangverluste bei Misserfolgen, die
   Zufallsstreuung (`addOffset(gain, 10)`) und die veraltete Dauermessung
   vollstaendig gedeckt ist.

   Der scheinbare Faktor 3,4 entstand, weil in der Rechnung die
   ABSCHNITTSdauer (36 s) statt der Aktionsdauer (13 s) stand. Ein Abschnitt
   laeuft, bis blade.js die Aktion wechselt, und enthaelt in der Regel
   mehrere Durchlaeufe - die "Erfolgsquote" in `ratencheck.js` ist deshalb der
   Anteil der Abschnitte mit Zuwachs, nicht die Erfolgschance je Versuch.
   Beides steht jetzt als Warnung im Werkzeug und in seiner Ausgabe.

4. **Der eigentliche Engpass steht daneben und ist groesser als alles andere:**
   Der Motor verbringt **122 von 164 Minuten - 74 Prozent - in der
   Regenerationskammer**. Die Arbeitszeit bringt 1,5 bis 2 Rang je Minute,
   ueber alles sind es 0,443. Faellt die Kammerzeit von 74 auf 30 Prozent,
   verdreifacht sich die Rate. Das gehoert in den Optimierungs-Loop, nicht
   hierher - siehe nodes/HEBEL.md.

Bis dahin bleibt die Formel die bessere Schaetzung: Sie ist wenigstens nicht
durch die Messmethode verfaelscht.

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

### Ein haengender Hintergrundtask legte die Loops zwei Stunden still (26.08., 06:02)

Gemessen: Von 03:02 bis 05:10 feuerte kein einziger der vier Cron-Loops. Die
Jobs existierten unveraendert (CronList um 05:10, Original-IDs), die Sitzung
lebte, es gab keinen Compact und keinen Standby - der residente Waechter
loggte luekenlos alle drei Minuten weiter, und der Bot lief durch (Rang 143
auf 296).

**Ursache, experimentell belegt** (drei Versuche in einer Fremdsitzung):
Ein schwebender Hintergrundtask blockiert ALLE Cron-Jobs der Sitzung bis zu
seinem Ende. Verpasste Feuerungen verfallen ersatzlos. Das `timeout`-Argument
gilt fuer Hintergrund-Bash **nicht** - dort gibt es keine Obergrenze; ein Test
mit `timeout: 15000` lief die vollen 45 Sekunden durch. Auch ein laufender
Monitor blockiert; `persistent: true` waere neben Cron-Loops fatal.

Ausloeser war eine eigene `until`-Warteschleife von 02:45, die auf
`data/aktionen.jsonl` wartete - eine Datei, die es nie geben konnte, weil
Bitburner die Endung ablehnt. Zwei bash-Prozesse liefen 2h56m.

**Im eigenen Transcript nachgeprueft, die Vorhersage trifft:**

    05:12:46  letzte Spur des manuellen /bb-loops
       -      Wache 05:13 faellig: nichts. 05:33: nichts. Report 05:30: nichts.
    05:41:05  Kill der haengenden Prozesse
    05:41:50  erste Cron-Feuerung, 45 Sekunden spaeter

**Behoben in drei Schritten:**
1. Die Regel steht in allen vier Loop-Prompts (`loops/loop-*.md`):
   Warteschleifen nur mit harter Grenze (`for i in $(seq 1 20)` statt
   `until`), Monitor nur mit knappem `timeout_ms` und nie `persistent`, lange
   Wartearbeit abgekoppelt starten.
2. Der Totmannschalter im Waechter greift ab **35 statt 60 Minuten** - der
   haeufigste Loop laeuft alle zwanzig. In der Nacht dauerte es 119 Minuten.
3. Die Meldung nennt jetzt die wahrscheinliche Ursache: alte bash-Prozesse mit
   PID und Alter. Sie taugen NICHT als eigener Alarm - die persistente
   Arbeits-Shell des Bash-Werkzeugs laeuft ebenfalls stundenlang und blockiert
   nichts -, zusammen mit einer stehenden Loop-Kette sind sie aber der
   entscheidende Hinweis.

**Verifiziert 06:03** gegen eine 40 Minuten alte Verlaufsdatei: "Die
Ueberwachungs-Loops melden sich seit 40 min nicht mehr ... Verdacht: 1 alte(r)
bash-Prozess(e), aeltester PID 23092 seit 848 min." Im Normalbetrieb still.


### Worker-Timer-Ersatz gegen die Drosselung (26.08., 01:45)
Gebaut als `src/hacktimer.js`, dazu `src/timerzwang.js` als Schalter. Er
haengt `window.setTimeout` an einen Web Worker, dessen Timer nicht gedrosselt
werden (der Codepfad haengt an `BlinkSchedulerWorkerThrottling`,
standardmaessig aus). Bitburner greift `window.setTimeout` bei jedem Aufruf
dynamisch ab, ein Patch wirkt also sofort auf Engine und alle ns-Wartezeiten.

**Er faehrt bewusst NICHT mit.** Am 25.08. hat er die gesamte Spielengine 52
Minuten angehalten: Er haengte sich beim Verstecken des Tabs ein und starb
kurz darauf, ohne `window.setTimeout` zurueckzugeben. Seit 21:19 raeumt
`ns.atExit` beim Skriptende auf, und eingehaengt wird nur mit `--scharf`.

**Gebraucht wird er nicht.** Verifiziert 01:45 ueber `data/sonde.json` bei
verstecktem Fenster: `sichtbarkeit hidden`, `haupt.median 5 ms`,
`worker.median 5 ms`, `stufe keine`. Der Tonanker traegt seit dem Pegelfix -
der Haupt-Thread laeuft so schnell wie der Worker.

Die Wirkung des Patches selbst bleibt ungemessen und wird es bleiben, solange
keine Drosselung mehr auftritt. Das ist der richtige Zustand: Er ist die
Rueckfallebene, nicht das Tagesgeschaeft. Bricht die Rundenrate wieder ein,
steht in `doku/drosselung.md` Abschnitt 5, was zu tun ist.

Nebenbefund, gleich mitbehoben: `sonde.js` stand seit dem Einbau um 22:01
still - dreieinhalb Stunden, ohne dass es auffiel, denn sie steht in keiner
Startliste des Spiels. Sie ist jetzt in der Nachstartliste von
`tools/wache.js`. Ausgerechnet das Messwerkzeug gegen die Drosselung war das
einzige, dessen Ausfall niemand bemerkt haette.


### Der Totmannschalter der Loops schlug nachts faelschlich an (26.08., 01:15)
Gemessen 00:45: Der Waechter meldete `loops` - "Die Ueberwachungs-Loops melden
sich seit X min nicht mehr". Nachts hat die Nachtruhe die Meldung geschluckt
("Nachtruhe - nicht gesendet: loops"), um 5:00 waere sie rausgegangen.
Ursache: Der Schalter hing am Alter von `data/ziele.md`, und die schreibt nur
der Reportloop - der planmaessig zwischen 22:30 und 5:00 pausiert. Jede Nacht
war die Datei stundenlang alt, obwohl Wache und Vorankommen weiterliefen.
Behoben: Der Schalter haengt jetzt an `data/verlauf-strategie.json`. Die
schreibt `tools/strategie-check.js` bei JEDEM Lauf, und den ruft jeder der
vier Loops als erstes auf - der haeufigste ist die Wache alle zwanzig Minuten.
Grenze deshalb 60 statt 90 Minuten: Das sind drei verpasste Laeufe und nicht
mehr mit Verspaetung zu erklaeren.
**Verifiziert 01:14 in beide Richtungen:** Mit frischer Datei meldet der
Waechter nichts mehr (vorher schlug er an). Nach `touch -d "70 minutes ago"`
meldet er "Die Ueberwachungs-Loops melden sich seit 70 min nicht mehr", und
ein einziger Prueferlauf raeumt den Befund wieder ab.


### Nichts verhinderte einen zweiten Waechterprozess (26.08., 00:45)
Gemessen 25.08. um 19:43: ZWEI `node tools/wache.js` liefen gleichzeitig
(PID 24464 und 19744). Beide schreiben `data/wache-zustand.json`, und dort
stehen die Meldesperren - wer zuletzt schreibt, gewinnt. Derselbe Alarm haette
zweimal aufs Handy gehen koennen, oder eine Entwarnung haette eine noch
bestehende Stoerung geloescht. Seit dem 25.08. greift der Waechter ausserdem
selbst ein und startet Werkzeuge nach; zwei davon wuerden sich Auftraege
ueberschreiben.
Behoben: `data/wache.pid` traegt die Prozesskennung. Beim Start prueft der
Waechter mit Signal 0, ob der dort genannte Prozess noch lebt, und beendet
sich dann selbst. Eine verwaiste Sperrdatei wird uebernommen. Die Datei steht
in `.gitignore` - reine Laufzeitinformation.
**Verifiziert 00:45:** Erster Start meldet "Waechter laeuft (PID 17372)" und
legt die Sperrdatei an; der zweite meldet "Es laeuft bereits ein Waechter
(PID 17372) - beende mich" und beendet sich.


### Der Pruefer hielt die Regenerationskammer fuer Fortschritt (26.08., 00:16)
Gemessen 20:42: URTEIL SPUR bei +4 Rang in 24 Minuten, waehrend der Motor
durchgehend in der Kammer stand.
Ursache: Eine Heuristik. Stand die Ausdauer unter 90 Prozent, galt die Kammer
als legitim - beliebig lange. Zwei Dinge stimmten daran nicht mehr: blade.js
arbeitet seit dem 25.08. schon ab 60 Prozent weiter (die 90 stammten aus der
alten Hysterese), und der Motor ruht inzwischen meist wegen der Trefferpunkte,
wobei die Ausdauer voll ist - die Ausnahme griff also ausgerechnet im
haeufigsten Fall nicht.
Behoben: Der Pruefer LIEST den Grund, statt ihn zu erraten. blade.js schreibt
ihn seit 20:46 mit ("ruht bis Ausdauer 33", "ruht bis HP 17"). Eine Ruhe mit
Grund darf 20 Minuten dauern, eine ohne weiterhin 40. Zwanzig Minuten sind
grosszuegig: Die Kammer heilt zwei Trefferpunkte je Durchlauf, die Ausdauer
regeneriert rund 1,2 je Minute passiv - beide Schwellen sind in wenigen
Minuten erreicht.
**Verifiziert 00:16** gegen einen praeparierten Verlauf mit 30 Minuten
unveraendertem Rang: `LEERLAUF: General/Hyperbolic Regeneration Chamber laeuft
(ruht bis HP 17), der Rang steht seit 30 min`, URTEIL STAGNATION. Der Grund
steht jetzt in der Meldung. Im Normalbetrieb unveraendert SPUR.


### blade.js schrieb in zwei von drei Zweigen keine Telemetrie (25.08., 22:16)

Zweimal an einem Abend derselbe Fehler an anderer Stelle: Ein Zweig der
Hauptschleife machte `continue`, ohne etwas zu schreiben.
- **Ruhe-Zweig** (20:42): kostete 23 Minuten Blindflug - von aussen war ein
  Haenger nicht von ruhigem Ruhen zu unterscheiden.
- **Weichen-Zweig** (22:13): erzeugte einen Fehlalarm ueber eine angeblich
  stehende Spielengine, waehrend sie nachweislich mit 29,2 s je halber Minute
  lief. Der Pruefer verglich zweimal dieselbe eingefrorene Datei.

Beim ersten Mal wurde der Einzelfall geflickt. Die Ursache ist die
Duplikation: Drei Zweige, drei getrennte `ns.write`-Bloecke, und jeder neue
Zweig faengt wieder bei null an.

Behoben strukturell: Eine Funktion `meldeLage(aktion, grund, chance)` holt
sich alles, was jeder Zustand gemeinsam hat - Rang, Punkte, Ausdauer,
Trefferpunkte, Spielzeit, naechste Black Op - selbst. Alle drei Zweige rufen
sie; im Code steht nur noch **ein** `ns.write("data/blade.json")`. Ein neuer
Zweig kann nichts mehr vergessen ausser dem Aufruf, und der faellt beim Lesen
auf.

**Verifiziert 22:17:** `"aktion":"General/keine","grund":"weicht bbtrain,
Kampfwerte 80","spielzeit":531709600,"hp":"18/18"` - der Zweig, der eben noch
stumm war, meldet vollstaendig.


### Die Spielengine stand 52 Minuten still (25.08., 20:27 bis 21:19)

Der groesste Ausfall des Tages, und der am schwersten zu sehende: Netscript
und die Spielengine sind ZWEI Schleifen. `updateGame` stand ab 20:27 still -
`totalPlaytime` unveraendert ueber 30 Sekunden Messdauer, Rang, Ausdauer und
Aktionsfortschritt eingefroren auf siebzehn Nachkommastellen -, waehrend
bn4net sechs Runden je Minute zaehlte und Hackgeld hereinkam. Jede vorhandene
Pruefung sah Normalbetrieb; der Strategiepruefer meldete 46 Minuten lang SPUR.

**Ursache: `src/hacktimer.js`, also eine eigene Aenderung von 20:15.** Es
haengte sich ein, sobald der Tab versteckt wurde (Eric minimierte um 20:20:48),
und starb kurz darauf, ohne `window.setTimeout` zurueckzugeben. Ein sterbendes
Netscript-Skript raeumt seine window-Patches nicht von allein auf; der
Engine-Loop plant sich per setTimeout neu, dieser eine Rueckruf ging verloren.

Zwei Verdaechtige wurden dabei ausgeschlossen: Der `startAction`-Vergleich in
`blade.js:365` stimmt (das Enum `BladeburnerActionType` traegt genau die Werte,
die blade.js verwendet), und die Tab-Drosselung war es auch nicht -
`data/sonde.json` meldete durchgehend Stufe "keine".

Behoben in drei Schritten:
1. **Neuladen des Tabs um 21:19** durch Eric. Von aussen ist das nicht
   machbar; die Push-Nachricht ging um 21:14 raus.
2. **`hacktimer.js` entschaerft** (21:19): `ns.atExit` gibt die Timer beim
   Skriptende zurueck, und eingehaengt wird nur noch mit `--scharf`. Ohne das
   Argument misst es und laesst window in Ruhe.
3. **Der Puls steht jetzt in der Telemetrie** (21:15 und 21:45): blade.js
   schreibt `spielzeit` in beiden Zweigen - auch im Ruhen, denn eine lange
   Ruhephase ist der Zustand, in dem eine stehende Engine am laengsten
   unentdeckt bliebe. `tools/strategie-check.js` wertet sie aus und meldet
   STAGNATION mit der einzigen Anweisung, die dann hilft.

**Verifiziert dreifach:**
- Engine laeuft: 21:20 Spielzeitzuwachs 34,8 s ueber 30 s Messdauer, Rang
  101,69326509516765 -> 103,23571126575352 in derselben halben Minute.
- Traeger holt auf: Rang 127 um 21:45, +25 in 26 Minuten.
- Der Pruefer erkennt den Fall: gegen einen praeparierten Verlauf mit
  gleichbleibender Spielzeit meldet er
  `DIE SPIELENGINE STEHT: Spielzeit waechst seit 6 min nur um 4.0 s statt um
  360 s ... Hilft nur ein Neuladen des Tabs (F5).` und URTEIL STAGNATION.

Damit miterledigt: der Eintrag "Die Bladeburner-Simulation ist eingefroren"
(20:49) - derselbe Vorgang, eine Ebene zu tief gesehen.

### blade.js stand 23 Minuten in der Regenerationskammer fest (25.08., 20:42)
Zwei Ursachen, beide behoben:
- `HP_WEITER` stand auf 0,95. Da jeder Vertrag Schaden macht, ist diese Marke
  im laufenden Betrieb kaum je erreichbar - einmal in der Ruhe, blieb der
  Motor haengen. Jetzt 0,75.
- Der Ruhe-Zweig schrieb keine Telemetrie. `data/blade.json` trug um 20:42
  noch den Zeitstempel 20:19, und von aussen war ein Haenger nicht von ruhigem
  Ruhen zu unterscheiden.
Ab 20:27 kam der Engine-Stillstand oben dazu, der den Rest der Zeit erklaert.
**Verifiziert 21:45:** `"hp":"10/22","spielzeit":529845400,"grund":"ruht bis
HP 17"` - die Datei altert nicht mehr, und der Ruhegrund steht dabei.
Damit miterledigt: "data/blade.json war um 20:27 acht Minuten alt".

### hacktimer.js stand in keiner Startliste (25.08., 21:19)
Der Befund von 20:28 war richtig, die Schlussfolgerung falsch: Das Werkzeug
gehoert NICHT in die Liste WERKZEUGE. Es hat wenige Minuten spaeter die
gesamte Spielengine angehalten (siehe oben). Seit 21:19 faehrt es nur noch mit
ausdruecklichem `--scharf` und raeumt beim Skriptende auf.
**Verifiziert 21:45:** Es laeuft nicht, und der Bot arbeitet - Rang 127.


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
