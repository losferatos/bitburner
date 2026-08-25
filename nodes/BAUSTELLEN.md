# Offene Baustellen

**Diese Datei ist die Arbeitsliste des Vorankommens-Loops.** Sie existiert, weil
Befunde sonst in Prosa verschwinden: Am 24.08.2026 sind drei von fuenf
Pruefbefunden untergegangen, weil sie in einem Fliesstext standen statt in einer
Liste, die man abhaken kann.

Regeln:
- Ein Punkt je Lauf. Wer fuenf Punkte gleichzeitig anfaengt, schliesst keinen.
- Erledigtes wird nach unten verschoben, nicht geloescht - der Verlauf ist die
  Begruendung fuer das, was heute steht.
- Was hier nicht steht, wird nicht bearbeitet. Neue Befunde kommen zuerst hierher.

---

## Offen, nach Dringlichkeit

### 1. bn4rep.js laeuft nicht (seit dem Einbau am 25.08. um 05:50)

Stand 25.08. 16:10: Das Werkzeug steht in der Liste (bn4net.js:296), es gibt
keinen Fehlstart, und die Werkbank werk-0 haelt 2.207 GB Reserve - trotzdem
laeuft es nirgends. bn4rep braucht 768,25 GB.

Vermutung, nicht gemessen: `frei()` auf werk-0 liegt unter 768 GB, weil Arbeiter
den Platz belegen, und der Raeumblock (bn4net.js:2598-2615) raeumt nur fuer das
ERSTE fehlende Werkzeug und bricht dann ab (`break`). Steht ein kleineres
Werkzeug vor bn4rep in der Liste, wird fuer das geraeumt und bn4rep bleibt
liegen.

Zu tun: Im Spiel-Log nach der Zeile "bn4rep.js wartet: werk-0 hat X von 768.2 GB
frei" suchen (sie wird alle zehn Runden geschrieben). Bestaetigt sie die
Vermutung, den Raeumblock so aendern, dass er das GROESSTE fehlende Werkzeug
bedient statt des ersten.

**Dringlichkeit:** mittel. In BitNode 6 ist der Traeger Bladeburner, nicht
Reputation - aber ohne bn4rep gibt es keine Augmentierungen, und die
Kampfwert-Multiplikatoren daraus verkuerzen jeden weiteren Trainingslauf.

### 2. Der V2-Kontrollpunkt ist nie gemessen worden

`nodes/ROUTE.md` Abschnitt 4 erklaert ihn fuer bindend: **Rang nach zwei Stunden
in BitNode 6 mindestens 6.000 mit Raid, mindestens 3.500 ohne.** Die gesamte
Reihenfolge ab Platz 3 steht auf einer Simulation, die nie gegen einen echten
Lauf geprueft wurde.

Zu tun: Sobald `data/bblage.json` `inBladeburner: true` meldet, den Zeitpunkt
festhalten und zwei Stunden spaeter den Rang gegen die Schwelle halten. Das
Ergebnis gehoert nach ROUTE.md, nicht in den Chat.

**Dringlichkeit:** hoch, sobald der Beitritt steht. Es ist das wertvollste
Einzelergebnis der naechsten Tage.

### 3. Der Erfahrungsofen (Befund B1 aus dem Bot-Audit)

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

### 4. Boersen-Bot fuer BitNode 8

BitNode 8 steht ganz am Ende der Route (Platz 42-44) und ist der einzige Knoten
ohne Bladeburner, Gang, Corporation und Skript-Hackgeld. Reputation ist dort
eine reine Geldfrage - und Geld kommt nur aus dem Aktienmarkt. Den Bot gibt es
noch nicht.

**Dringlichkeit:** niedrig, aber nicht null: Er ist die einzige Voraussetzung
auf der ganzen Route, die noch gar nicht existiert.

### 5. Darknet-Labyrinth-Gewerk (V1b)

`labyrinth.ts:424-427` legt The Red Pill ins sechste Darknet-Labor, aber nur bei
`hasFullDarknetAccess()` - also in BitNode 15 oder mit SF15. Jeder
Augmentierungs-Einbau wuerfelt das Darknet neu (Prestige.ts:76), es braucht also
je Labor einen Einbauzyklus und rund 24 Raetselloeser.

**Dringlichkeit:** niedrig. Erst vor BitNode 15 relevant.

---

## Erledigt

### bbtrain trainierte nur str, waehrend def/dex/agi auf 1 standen (25.08.)
Behoben in 19c324d. Stadt und Studio werden jetzt in der Trainingsschleife
geprueft statt einmal davor. Wirkung nach acht Minuten: str 107, def 37, dex 43,
agi 15.
