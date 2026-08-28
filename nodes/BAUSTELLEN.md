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
- **Ein neuer Punkt wird NACH der `---`-Trennlinie eingesetzt, nie per Suche
  nach `## Sofort` oder `## Offen`.** Beide Zeichenketten stehen auch in diesem
  Regelkopf, und eine Suche trifft die erste Fundstelle - also den Fliesstext.
  Am 28.08.2026 hat das die Datei zerlegt: Drei Eintraege landeten mitten im
  Kopf, zwei Abschnittsueberschriften existierten doppelt, und ein bereits
  abgeraeumter Punkt stand wieder in der Liste. Aufgefallen ist es erst zwei
  Laeufe spaeter. Wer die Datei per Skript aendert, prueft danach
  `grep -n "^## \|^### " nodes/BAUSTELLEN.md` - die Gliederung muss lauten:
  ein `## Sofort`, ein `## Offen, nach Dringlichkeit`, ein `## Erledigt`.
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

### Diplomacy frisst 28,7 Prozent der Zeit fuer einen Schaden, den es nicht gibt (13:33)

Gemessen: `data/aktionen.txt`, alle Abschnitte ab 13:05 (14,7 protokollierte
          Minuten):

              Operations/Assassination   10,5 min   71,3 %   12.626 Rang
              General/Diplomacy           4,2 min   28,7 %        0 Rang

          Raid kam nicht mehr vor - der Chaos-Zuschlag von 13:00 wirkt. Das
          Chaos steigt jetzt **exogen**: `randomEvent` alle 240 bis 600
          Sekunden, davon 20 Prozent Synthoid-Riots mit `+1` Zaehlwert und
          `+5 bis +20 %` (`Bladeburner.ts:679-684`), Stadt zufaellig aus
          sechs. Das trifft die eigene Stadt rund alle 35 Minuten und kostet
          bei Charisma 309 (Diplomacy -1,603 % je 60 s) rund 7,3 Minuten
          Aufraeumen - also etwa ein Fuenftel der Zeit, und der Rest ist die
          Streuung von Assassination (`-5 bis +5 %`, `:859`).

Erwartet: **Null Minuten Diplomacy.** Chaos schadet nur ueber
          `difficulty *= sqrt(1 + chaos - 50)` (`Actions/Operation.ts:52-61`),
          und die Erfolgschance ist `Math.min(1, competence/difficulty)`
          (`Actions/Action.ts:196`) - sie klemmt. Solange sie klemmt, ist der
          Chaos-Aufschlag **wirkungslos**, und jede Minute Diplomacy ist
          bezahlter Leerlauf.

          Der Beleg, dass die Reserve gross ist: In Sector-12 stand das Chaos
          um 12:40 bei **101,67** - Faktor 7,26 auf die Schwierigkeit - und
          Raid trotzdem bei **0,997** (`data/bbspann.json`, Block `staedte`).
          In New Tokyo stehen bei Chaos um 50 alle sechs Operationen und alle
          drei Vertraege auf **1,000**.

Verdacht: `src/blade.js`, `CHAOS_EIN = 50` / `CHAOS_AUS = 47`. Die Schwellen
          sind absolut gesetzt, obwohl der Schaden relativ ist. Sauber waere,
          `chaosAufraeumen` erst einzuschalten, wenn das Chaos eine Aktion
          tatsaechlich unter ihre Schwelle drueckt - messbar daran, dass
          `s.min` der besten Aktion unter `SICHER_OPERATION` faellt. Solange
          die beste Aktion bei 1,000 steht, wird nicht aufgeraeumt.

          Zweitlinie, falls die Schwelle doch gebraucht wird: Ein Stadtwechsel
          kostet nichts und setzt das Chaos-Konto auf das der neuen Stadt -
          Diplomacy ist die teuerste aller Moeglichkeiten, das Chaos
          loszuwerden.

Dringlichkeit: **hoch.** 28,7 Prozent der Leitgroesse, bei einem Restweg von
          185.215 Rang und einer gemessenen Rate von 858/min sind das rund
          62 Minuten reiner Leerlauf bis zum Knotenausgang.

**Geaendert 13:40, Wirkung noch nicht vollstaendig gemessen.** `chaosAufraeumen`
schaltet jetzt nur noch ein, wenn das Chaos ueber `CHAOS_EIN` liegt **und**
keine Operation ueber `SICHER_OPERATION` und kein Vertrag ueber
`SICHER_VERTRAG` steht - und es schaltet sofort ab, sobald wieder etwas fahrbar
ist. Die Fundstellen sind nachgeschlagen und decken den ganzen Effekt ab: Chaos
kommt im Bladeburner-Quellcode ausser beim passiven Abbau (`:1397`) und den
`changeChaosBy*`-Setzern **nur** in `Action.ts:96` und `Operation.ts:54` vor;
Black Ops sind immun (`BlackOperation.ts:59-61` gibt fest 1 zurueck).

Was gemessen ist: Die drei neuen Telemetriefelder in `data/blade.json` stehen
und liefern - **13:42:51 `chaos 39.84, fahrbar true, aufraeumen false`**. Ohne
sie liesse sich "es wird nicht aufgeraeumt" nicht von "es gab nichts
aufzuraeumen" unterscheiden.

Was **nicht** gemessen ist: Genau dieser Fall - und bis 15:45 war er auch
gar nicht messbar. `chaosStand` und `fahrbarStand` wurden erst tief in
`waehle()` gesetzt, im Block hinter `if (SPIEL_CHAOS_AN)`. Faellt die Wahl
vorher auf eine Black Op, kehrt `waehle()` vorher zurueck. Gemessen 15:38
waehrend Operation Annihilus: `chaos null, fahrbar null` - seit dem Neustart
um 15:25 war der Block kein einziges Mal erreicht worden. Je besser der Motor
laeuft, desto weniger war zu sehen.

**Geaendert 15:45:** `chaosMessen()` laeuft jetzt am Kopf von `waehle()`, vor
jeder Verzweigung, und fuehrt zusaetzlich eine Hochwassermarke `chaosMax` -
den hoechsten Chaosstand, der je bei `fahrbar: true` und `aufraeumen: false`
gemessen wurde. Damit muss niemand mehr den richtigen Augenblick treffen.

Verifiziert 15:39 bis 15:41, waehrend Operation Ultron lief:
`chaos 33.82, fahrbar true, aufraeumen false, chaosMax 33.82` - vorher stand
dort dreimal `null`. Die **Messluecke** ist damit geschlossen.

Der Punkt selbst bleibt offen: `chaosMax` steht bei 33,82 und muss ueber 50
steigen, bevor die Regel bewiesen ist. Das laeuft jetzt von allein mit; der
naechste Lauf liest nur noch die eine Zahl.
---

## Offen, nach Dringlichkeit

### Die Abdeckung wiegt jetzt nach Arbeit - Wirkung noch nicht gemessen (15:25)

Geaendert 15:25 in `src/blade.js`, Wirkung noch nicht gemessen.

Gemessen 15:21, aus erster Hand ueber `blackOpChance()` (neu in
`data/blade.json` als `boChancen`):

    Operation Morpheus     1,0000      Operation Centurion   0,1456
    Operation Ion Storm    1,0000      Operation Vindictus   0,1359
    Operation Annihilus    0,9727      Operation Daedalus    0,1274
    Operation Ultron       0,7490

Die drei rechts sind die Mauer, und **keine von ihnen ist `isKill` oder
`isStealth`**. Die alte Abdeckung (Short-Circuit 0,58, Cloak 0,17) hat
Punkte dorthin geleitet, wo sie auf der Mauer nichts bewirken. Neu wiegt jede
offene Black Op mit `ln(0,90 / Chance)` - dem multiplikativen Rest bis zur
Feuerschwelle. Damit tragen Centurion, Vindictus und Daedalus je 1,955 und
Ultron 0,184, waehrend alles bei 1,00 auf null faellt; Short-Circuit und Cloak
sinken rechnerisch auf rund 0,03.

Erwartet: Digital Observer, Blade's Intuition, Reaper und Evasive System
steigen, Short-Circuit (62) und Cloak (44) bleiben stehen.

Warum noch nicht gemessen: Skillpunkte entstehen nur bei Rangzuwachs
(`Bladeburner.ts:1283-1291`), und der Rang kommt bei Black Ops als
Einmalbetrag am Ende. Zwischen 15:22 und 15:23 lief Operation Morpheus, es
wurde kein einziger Punkt ausgegeben. Der naechste Lauf liest die Stufen
gegen die oben notierten und haakt ab oder dreht zurueck.


### `data/wache-zustand.json` speichert den Verlauf rueckwaerts (15:05)

Gemessen 15:04: `verlauf` hat 40 Punkte, davon sind **39 von 39 Uebergaengen
absteigend** - der neueste Eintrag steht vorn (erster ts 13:03 / Rang 281.027,
letzter 11:05 / Rang 114.698).

Erwartet: Wer `verlauf[0]` als aeltesten und `verlauf[n-1]` als neuesten
Punkt liest - so steht es im Reportloop-Prompt ("Nimm den Verlauf aus
`data/wache-zustand.json` ueber mindestens 45 Minuten") - bekommt ein
negatives `dt` und damit eine erfundene Rate. Genau das ist im Report um
15:03 passiert: erste Rechnung ergab "1419/min ueber -117 min".

Verdacht: `tools/wache.js:296` fuehrt die Liste per unshift. Kein Werkzeug im
Repo bricht daran (geprueft: kein Leser ausser dem Report), es ist eine Falle
fuer Menschen und Loops. Zwei Wege: entweder beim Schreiben sortieren, oder
eine Zeile im Loop-Prompt und im Dateikopf, dass die Liste neueste-zuerst ist.


### `blade.js` verliert beim Neustart den offenen Abschnitt (14:03)

Gemessen: `data/aktionen.txt` endet um **13:19:44** und hat seither nichts mehr
          geschrieben - 43 Minuten Luecke, obwohl der Motor durchgehend lief
          (Rang 154.848 um 13:40 auf 188.713 um 14:03).

Erwartet: Ein Abschnitt je Aktionswechsel. Die Luecke deckt sich exakt mit den
          beiden `WERKZEUG blade.js`-Neustarts um 13:40 und 13:41: Ein
          Abschnitt wird erst beim Wechsel geschlossen, und ein Neustart wirft
          den offenen weg.

Verdacht: `src/blade.js`, `abschnitt`/`schliesseAbschnitt`. Der Abschnitt lebt
          nur im Speicher. Sauber waere, ihn beim Start aus `data/blade.json`
          zu rekonstruieren oder ihn periodisch statt nur beim Wechsel zu
          schreiben.

Dringlichkeit: **niedrig fuer den Betrieb, mittel fuer die Messung.** Der Bot
          verliert nichts, aber genau die Datei, aus der die Loops den
          Zeitanteil je Aktion lesen, ist nach jedem Eingriff blind - und
          Eingriffe sind der Moment, in dem gemessen werden muesste. Der
          Diplomacy-Anteil nach 13:35 liess sich deshalb nur indirekt belegen
          (`aufraeumen: false` in `data/blade.json`, Chaos faellt ohne
          Diplomacy von 39,84 auf 37,50).

### `beste()` preist das Chaos, aber nicht die Bevoelkerung (12:55)

Gemessen: New Tokyo popEst **1.532 Mio um 11:03 -> 223 Mio um 12:40**.
          Chongqing stand um 11:10 bei **0**. Beides waren Staedte, in denen
          der Motor laenger Raid gefahren hat.

Erwartet: Die Bevoelkerung ist eine endliche, gemeinsam genutzte Ressource.
          Sie geht ueber `getPopulationSuccessFactor = (pop/1e9)^0,7`
          (`Actions/Action.ts:88-92`) in die Erfolgschance JEDER Aktion ausser
          Black Ops ein. Wer sie verbraucht, verteuert alles andere - und zwar
          dauerhaft, denn Nachwuchs kommt nur ueber `randomEvent` alle 240 bis
          600 Sekunden mit 25 Prozent Wahrscheinlichkeit
          (`Bladeburner.ts:601-694`).

          Die Verbrauchsraten je Erfolg stehen in `Bladeburner.ts:806-861`:

              Raid                    -1 %      der Bevoelkerung, -1 Gemeinde
              Stealth Retirement      -0,5 %
              Sting Operation         -0,1 %
              Assassination           -1 Kopf
              Bounty Hunter / Retire. -1 Kopf

          Bei 1e9 Einwohnern sind das 10 Mio gegen 1. **Faktor zehn
          Millionen** - und `beste()` sieht davon nichts.

Verdacht: `src/blade.js`, `beste()`. Der Chaos-Zuschlag von 03:42 rechnet die
          Folgekosten einer Aktion bereits in ihre Dauer ein
          (`CHAOS_JE_LAUF`). Fuer die Bevoelkerung fehlt das Gegenstueck. Ein
          sauberer Zuschlag waere: Wieviel Rang je Minute verliert der Motor
          dauerhaft, wenn `pop` um `x` faellt? Ueber `(pop/1e9)^0,7` ist die
          Ableitung bezifferbar, die verbleibende Laufzeit des Knotens auch
          (`nodes/KURS.md`).

Dringlichkeit: mittel. Seit dem Wegfall des Raid-Vorrangs (12:51) waehlt
          `beste()` fast immer Assassination, und die kostet einen Kopf. Der
          Fehler ist damit entschaerft, aber nicht behoben - er schlaegt wieder
          zu, sobald Raid einmal auf der Chaos-Rechnung gewinnt.

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
