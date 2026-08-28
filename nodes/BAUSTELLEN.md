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
- **Erledigtes wandert nach `nodes/ERLEDIGT.md`, nicht nach unten** (seit
  27.08.2026, 18:35). Es wird nie geloescht - der Verlauf ist die Begruendung
  fuer das, was heute steht -, aber er gehoert nicht in die Arbeitsliste: Sie
  stand bei 1.777 Zeilen, davon 81 Prozent Archiv, und das Read-Werkzeug
  schneidet bei 2.000 stumm ab. Im Archiv wird **gegrept, nicht gelesen**:
  `grep -n -A12 "<stichwort>" nodes/ERLEDIGT.md`.
- Was hier nicht steht, wird nicht bearbeitet. Neue Befunde kommen zuerst hierher.
- **Ein alter Zeitstempel ist KEIN Stillstand.** Mehrere Skripte steigen vor
  ihrer Telemetriezeile aus der Runde aus und arbeiten trotzdem einwandfrei.
  Die Lebenszeichen stehen woanders und sind bedingungslos:
  `data/hb-rep.txt` fuer `bn4rep.js` (Puls), `data/rep-ziel.txt` fuer sein
  aktuelles Ziel samt Rangliste, `data/wache-zustand.json` fuer den Waechter.
  `data/bn4rep.json` und `data/ps.json` sind Momentaufnahmen, keine Pulse.
  *In der Nacht zum 28.08. hat diese Falle einen Sofort-Punkt erzeugt, der
  komplett falsch war - die Warnung stand seit dem 24.08. in `bn4rep.js:389`,
  nur nicht dort, wo jemand sie sucht.*
- **Die Loops entscheiden selbst. "Wartet bis Eric" ist kein Ablageort fuer
  unbequeme Entscheidungen** (Eric, 26.08.2026, 16:05). Aus einer belegten
  Erkenntnis wird ein **unmittelbarer Arbeitsauftrag**, nicht ein Wartestatus.
  Wer eine Zahl gemessen hat, die eine Aenderung rechtfertigt, setzt sie um und
  misst nach - und nimmt sie zurueck, wenn sie nicht traegt.
  **Seit dem 27.08.2026, 05:00 ohne Ausnahme.** Eric hat den Vorbehalt fuer
  `src/bn4net.js` und `src/boot.js` aufgehoben - mit der Auflage, dort **jede
  Aenderung einzeln zu committen**, damit sie sich einzeln zurueckdrehen
  laesst. Sein Ziel: "Ich will das Projekt hier nahezu vollstaendig durch
  Loops laufen und entscheiden lassen, so dass ich eigentlich nicht noetig
  bin."
  **Die Reihenfolge der BitNodes bleibt unangetastet** - nicht als Vorbehalt,
  sondern weil sie feststeht (Fables Analyse,
  `nodes/AUDIT-ROADMAP-2026-08-24.md`). Auch Eric will dort nicht mehr
  dazwischenfunken.
  *Anlass: Der Raid-Befund vom 26.08. stand vier Laeufe lang auf "Wartet bis
  Eric entscheidet", obwohl jede Zahl dafuer gemessen war. Das kostete den
  groessten offenen Hebel des Knotens einen halben Nachmittag.*

---

## Sofort

keine

## Offen, nach Dringlichkeit

### Source-File -1: die letzten vier Exploits (Stand 28.08., 07:45 - 7 von 11)

Eingesammelt: `UndocumentedFunctionCall`, `INeedARainbow`, `Bypass`
(`src/exploit.js`), `TimeCompression` (`src/exploit2.js`), `TrueRecursion`
und `N00dles` (`src/exploit3.js`). `PrototypeTampering` haengt am
15-Minuten-Zeitgeber und sollte kurz nach 07:57 fallen - nachsehen mit
`node tools/lage.js | grep Exploits`.

**Der Ertrag ist bewusst klein**: `applyExploits.ts` multipliziert alle
Multiplikatoren mit `1,001^n`. Von 7 auf 11 sind das 1,007 auf 1,011, also
**+0,4 %**. Dafuer permanent und ueber jeden Reset hinweg - bei 45 geplanten
Laeufen ist das kein Nichts, aber es hat keine Dringlichkeit.

**1. `YoureNotMeantToAccessThis` - im ausgelieferten Spiel NICHT erreichbar.**
`ns.openDevMenu()` oeffnet nur den April-Scherz (`Extra.ts:19` zeigt auf
`Apr1Events`, `ui/Apr1.tsx:41`). Den Exploit vergibt `DevMenuRoot`
(`DevMenu.tsx:41-43`), und dorthin fuehrt einzig der Sidebar-Eintrag unter
`process.env.NODE_ENV === "development"` (`SidebarRoot.tsx:436`). Ohne
Zugriff auf das `Router`-Modul aus der Seite heraus gibt es keinen Weg.
**Nur ueber React-Interna (Fiber-Baum nach dem Router absuchen) - fragil,
lohnt fuer 0,1 Prozent nicht.**

**2. `Unclickable` - loesbar, braucht aber einen ECHTEN Mausklick.**
`Exploits/Unclickable.tsx:11` prueft `event.isTrusted`, und
`element.click()` aus einem Skript ist unwahr. Der Rest ist geloest:

    const getComputedStyle = window.getComputedStyle;   // Zeile 5, beim Laden
                                                        // des Moduls gefangen

Ein spaeteres Ueberschreiben von `window.getComputedStyle` greift also nicht.
**Aber die zurueckgegebene `CSSStyleDeclaration` gehorcht ihrem Prototyp** -
werden dort die Lesefunktionen fuer `display` und `visibility` auf "none"
und "hidden" festgenagelt, darf das Element in Wahrheit sichtbar und
anklickbar sein. Also: Prototyp verbiegen, `#unclickable` per Inline-Stil
gross und sichtbar machen, klicken lassen, alles zuruecksetzen.

Der Klick selbst geht entweder per CDP (`Input.dispatchMouseEvent` erzeugt
vertrauenswuerdige Ereignisse) ueber die Opera-Verbindung - oder Eric klickt
einmal hin. **Vorsicht:** `<Unclickable/>` haengt in `GameRoot`
(`ui/GameRoot.tsx:558`) und wird oft neu gezeichnet; React setzt den
Inline-Stil dann zurueck. Der Stil muss also kurz vor dem Klick gesetzt
werden.

**3. `RealityAlteration` - braucht den Debugger, nichts anderes.**

    let x = false;
    const recur = function (depth) { if (depth === 0) return; x = !x; recur(depth - 1); };
    recur(2);                          // zwei Umschaltungen -> x bleibt false
    if (x) giveExploit(RealityAlteration);

`x` ist eine Abschlussvariable, `recur` ruft sich ueber den eigenen Namen
auf, und `depth === 0` wie `depth - 1` sind strikte Operationen auf
Zahl-Primitiven - an keiner Stelle greift ein Prototyp. Der Kommentar der
Entwickler sagt es selbst: "a variable that is guaranteed to be false **(and
doesn't use prototypes)**". Der Weg ist ein Haltepunkt in `alterReality` und
`Debugger.setVariableValue` - per CDP machbar, von einem Skript aus nicht.

**4. `EditSaveFile` - kein Ausloeser im Spiel, nur der Spielstand selbst.**
Ausser der Achievement-Pruefung kommt der Name nirgends vor. Er entsteht
allein dadurch, dass `"EditSaveFile"` in der Exploit-Liste des Standes steht.
Also: exportieren, entpacken, Eintrag setzen, packen, importieren. **Nur mit
Sicherung und nicht im laufenden Betrieb** - eine Sicherung liegt seit 07:37
unter `backups/` (nicht im Repo, siehe `.gitignore`).

**Dringlichkeit: niedrig.** Nichts davon bewegt den Knotenausgang. Der Punkt
steht hier, damit die Arbeit von heute frueh nicht verlorengeht.

### Die Black-Op-Schwelle muss zum Ende hin steigen - ab Nr. 18 ist ein Fehlschlag ruinoes

Gefunden vom Kursloop am 28.08., 07:15, beim Erzeugen der Black-Op-Tabelle aus
`Bladeburner/data/BlackOperations.ts`. Der `rankLoss` waechst am Ende
dramatisch, waehrend `blade.js` mit einer festen Schwelle arbeitet:

    Nr  Operation           reqdRank   rankGain   rankLoss
     8  Red Dragon            25.000        500         50
    18  Ultron               250.000     10.000      2.000
    19  Centurion            300.000     15.000      5.000
    20  Vindictus            350.000     20.000     20.000   <- Verlust = Gewinn
    21  Daedalus             400.000     40.000     10.000

**Bei Vindictus kostet ein Fehlschlag genau so viel Rang, wie ein Erfolg
einbringt.** Ein Fehlschlag dort wirft den Lauf um eine volle Operation zurueck
- rund anderthalb Stunden bei der aktuellen Rate.

`blade.js` hat zwei Schwellen (`SICHER_BLACKOP` = 0,90 und
`SICHER_BLACKOP_OHNE_RAID` = 0,40) und waehlt zwischen ihnen nach dem
**Raid-Vorrat**, nicht nach dem Einsatz. Bei Red Dragon ist 0,40 vertretbar
(50 Rang Verlust gegen 500 Gewinn). Bei Vindictus waere sie fahrlaessig.

Erwartet: Die Schwelle sollte aus dem Einsatz folgen statt aus dem Vorrat -
etwa so, dass der Rang-Erwartungswert `p*rankGain - (1-p)*rankLoss` positiv
bleibt, mit Sicherheitsabstand. Fuer Vindictus (Gewinn = Verlust) hiesse das
p > 0,5 als harte Untergrenze, praktisch eher 0,9.

Verdacht: `src/blade.js`, `blackOpSchwelle()` (Zeile ~1196) und die
Konstanten bei Zeile 246.

**Nicht dringend, aber terminiert**: Es trifft ab Rang 250.000, also bei
80.706 noch nicht - aber die ETA dafuer liegt bei rund 12 Stunden.

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

---

## Erledigt

Ausgelagert nach [`nodes/ERLEDIGT.md`](ERLEDIGT.md) - dort steht das Archiv
mit allen Nachmessungen, neueste zuerst.

**Ein abgeraeumter Punkt wandert dorthin, nicht hierher.** Oben in die Datei,
mit Datum und der Zeile `Verifiziert: <Zahl> um <HH:MM>`.

**Vor dem Anlegen eines neuen Punktes dort nachsehen** - aber gezielt, nicht
durch Volllesung:

```bash
grep -n -A12 "<stichwort>" nodes/ERLEDIGT.md
```
