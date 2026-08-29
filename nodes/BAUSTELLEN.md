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
- **Diese Datei wird mit `tools/liste.js` bearbeitet, nicht von Hand
  geschnitten** (seit 28.08.2026, 23:18):

      node tools/liste.js                                  Abschnitte + Punkte
      node tools/liste.js --sofort-leeren [--vermerk "..."]
      node tools/liste.js --eintragen sofort|offen --datei <pfad>
      node tools/liste.js --erledigen "<anfang>" --datei <pfad>

  Es grenzt Abschnitte ueber Zeilennummern ab, erkennt eine Ueberschrift nur
  NACH der ersten `---`-Trennlinie, und schreibt nur, wenn die Gliederung
  danach unveraendert ist - sonst bleibt der alte Stand stehen. Der Eintrags-
  text kommt aus einer Datei, damit Umlaute und Backticks die Shell ueberleben.

  *Warum es das Werkzeug gibt:* Eine Suche nach `## Sofort` oder `## Offen`
  trifft die erste Fundstelle - also den Fliesstext in diesem Regelkopf, wo
  beide Zeichenketten ebenfalls stehen. Am 28.08.2026 hat das die Datei
  zweimal zerlegt (14:08 und 22:47): Eintraege landeten mitten im Kopf,
  Abschnittsueberschriften existierten doppelt, ein abgeraeumter Punkt stand
  wieder in der Liste. Beide Male stand die Warnung davor **hier**. Ein
  Hinweis in dem Text, den man gerade umschreibt, wird nicht gelesen.

  Wer die Datei doch von Hand aendert, prueft danach `node tools/liste.js` -
  die Gliederung muss lauten: ein `## Sofort`, ein
  `## Offen, nach Dringlichkeit`, ein `## Erledigt`.
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

### bn4rep hat in BitNode 10 vor dem Beitritt eingebaut - 6,6 Stunden verloren (04:15)

Gemessen: Um 04:15 meldete der Pruefer RESET: Kampfwert-Tiefstand von 88 auf 1,
          Netz 85 auf 8, Geld 0. Kein Knotenwechsel - `knoten.json` zeigt
          weiter 10, aber `augReset` ist neu (04:15:31), `playtimeSinceLastAug`
          0,07 h. Acht Augmentierungen wurden eingebaut:

              Wired Reflexes, Augmented Targeting I, Cranial Signal
              Processors Gen I, Speech Processor, Nuoptimal Nootropic,
              ADR-V1 Pheromone, Speech Enhancement, NeuroFlux Governor

          Neue Multiplikatoren: str/def 1,2870 (vorher 1,2616), dex 1,4864,
          agi 1,3513.

Bilanz:   Der Tiefstand haengt an str/def, und die stiegen nur um 2 Prozent.
          Bedarf fuer Level 100 faellt damit von 252.795 auf **223.740**
          Erfahrung (`calculateSkill` umgestellt, m_eff = 1,2870 * 0,4).
          Verloren sind die 119.865 Erfahrung, die um 04:15 bei Tiefstand 88
          standen.

              Ersparnis   29.055 Erfahrung
              Verlust    119.865
              netto      **-90.810 Erfahrung = 6,6 Stunden** bei 230/min

          Das ist genau die Rechnung vom 28.08., 22:52 (`nodes/ERLEDIGT.md`):
          Gym allein schlaegt die Augmentierungsrunde, und der Abstand waechst
          mit jeder Gym-Stunde. Der Bot hat die schlechtere Option gewaehlt.

Ursache:  `src/bn4rep.js` hatte an **drei** Stellen `n === 6 || n === 7`, die
          10 fehlte ueberall:

              683   Beitritts-Sperre ("KEIN EINBAU VOR DEM DIVISIONSBEITRITT")
              904   Spendenrecht-Ausnahme an der Mindestwarteschlange vorbei
             1396   Kampfgewicht in der Augmentierungsbewertung

          Die Sperre von Zeile 683 haette den Einbau verhindert - ihr Kommentar
          beschreibt exakt diesen Fall ("ein Einbau setzt genau die Kampfwerte
          auf 1 zurueck"), nur galt sie fuer den falschen Knoten.

Behoben:  Alle drei Stellen um `|| n === 10` ergaenzt, `bn4rep.js` per
          `WERKZEUG bn4rep.js` neu gestartet - **verifiziert 04:22, neue PID
          46** (vorher 20). Der laufende Prozess trug sonst weiter die alte
          Fassung; genau diese Falle hat um 03:14 schon `blade.js` betroffen.

Verifiziert: `node tools/strategie-check.js` um 04:21 - URTEIL SPUR, der
          Wiederanlauf nach dem Einbau ist vollstaendig (alle elf Werkzeuge
          laufen auf home). Dass die Sperre jetzt greift, zeigt sich erst beim
          naechsten Einbauversuch; bis zum Beitritt darf keiner mehr kommen.

**Fuenfte Fundstelle, aus derselben Familie (29.08., 06:20).** `bn4rep.js`
hob die Blade-Sperre selbst wieder auf: Nach `let gesperrt = bladeSperre;`
folgte `if (lockInhalt) { gesperrt = ... }` als **Zuweisung**. Ein
abgelaufenes Firmenschloss setzte `gesperrt` damit auf false, obwohl der
Divisionsbeitritt noch aussteht - genau der Einbau, der um 04:15 6,6 Stunden
gekostet hat, waere so ein zweites Mal moeglich gewesen. Aktuell existierte
`data/install-sperre.txt` nicht, die Falle war also scharf, aber ungezuendet.
Behoben mit `gesperrt = bladeSperre || lockGilt;` - die beiden Sperren sind
unabhaengig, es reicht, wenn eine greift. Das Loeschen des abgelaufenen
Schlosses bleibt erhalten.

Verifiziert: `node --check` sauber; Pruefer 06:13 URTEIL SPUR, rc 0; die neue
Zeile steht in der Spielfassung (`getFile bn4rep.js`), `bn4rep.js` neu
gestartet - **PID 14843** (vorher 46), belegt in `data/ps.json` um 06:15:21.
Wahrheitstafel isoliert nachgerechnet: blade=true + Schloss abgelaufen gibt
jetzt true (vorher false), die drei uebrigen Faelle unveraendert.

**Die Suche nach weiteren Stellen ist gelaufen** (05:12,
`grep -rn "=== 6" src/ tools/`). Vier Fundstellen insgesamt, alle behoben:

    tools/strategie-check.js:856   04:18   blade.json wurde verworfen
    src/bn4rep.js  683, 904, 1396  04:25   Einbausperre griff nicht
    tools/wache.js:780             04:45   Motor wurde nicht ueberwacht
    tools/strategie-check.js:492   05:15   fehlender Steckbrief kein BLIND

Der letzte Fund ist derselbe Fehler in der Gegenrichtung: Ein fehlender
Bladeburner-Steckbrief loeste in BitNode 10 nie BLIND aus - vor dem Beitritt
richtig, danach ein stiller Ausfall von `bblage.js`. Das Kriterium ist jetzt
nicht mehr der Knoten, sondern ob die Division existieren MUESSTE: Ab
Kampfwert-Tiefstand 100 verlangt das Spiel nichts weiter
(`NetscriptFunctions/Bladeburner.ts:356`), also muss sie stehen. Das behebt
nebenbei denselben Fehler in BitNode 6 und 7, wo vor dem Beitritt bisher
faelschlich BLIND gemeldet wurde.

**Die Lehre fuer die Liste:** Der Knoten ist der falsche Traeger fuer solche
Bedingungen. Richtig ist die Eigenschaft, um die es geht - "traegt Bladeburner
hier?" oder "muesste die Division stehen?". Wer nach dem naechsten
Knotenwechsel wieder eine Nummer in eine Bedingung schreibt, baut denselben
Fehler ein fuenftes Mal.

Verifiziert: `node --check` sauber, `node tools/strategie-check.js` um 05:16
URTEIL SPUR, Rueckgabewert 0, Traeger unveraendert.

*Der Punkt "Kampf-Augmentierungen vor dem Bladeburner-Beitritt" (19:20) ist am
28.08. um 22:52 abgeraeumt worden - nicht umgesetzt, sondern zu Ende gerechnet
und verworfen. Die Rechnung steht in `nodes/ERLEDIGT.md`. Kurz: Tor 1 zaehlt
den NIEDRIGSTEN Kampfwert, und von den erreichbaren Stuecken hebt genau eines
die Staerke (Combat Rib I, 15.000 Rep in BitNode 10). Die billigen drei kosten
Reputation, ohne den Tiefstand um einen Punkt zu bewegen. Gemessen 22:43: Gym
allein 14,7 h, Augmentierungsrunde 23,5 h - und der Abstand waechst mit jeder
Gym-Stunde, weil der Einbau die inzwischen erarbeitete Erfahrung vernichtet.*


---

## Offen, nach Dringlichkeit

### BitNode 10 verlangt 25 Prozent mehr Rangarbeit als BitNode 6 (03:45)

Gemessen: Aus dem Quellcode gelesen, nicht aus Telemetrie.
          `Bladeburner/Formulas.ts:8-26`:

              calculateActionRankGain  ... * currentNodeMults.BladeburnerRank
              calculateActionRankLoss  ... KEIN BitNode-Multiplikator
              reqdRank (BlackOperations.ts)  fest, kein Multiplikator

          In BitNode 10 steht `BladeburnerRank: 0.8` (`BitNode.tsx`, case 10).
          Der Gewinn faellt also um ein Fuenftel, der **Verlust bleibt**, und
          das Ziel bleibt: max `reqdRank` 400.000, Summe aller 21 `rankGain`
          113.660.

Erwartet: Die Rechnung aus `nodes/KURS.md` uebernimmt bisher die BitNode-6-
          Zahlen. Richtig ist fuer diesen Knoten:

              Netto-Strecke  400.000 - 113.660 * 0.8 = 309.072 Rang
                             (in BitNode 6 waren es 286.340)
              Zeitbedarf     bei gleicher Aktionsrate **+25 %**

**KORREKTUR 03:55 (Optimierlauf), noch vor der Umsetzung.** Der erste Entwurf
dieses Punkts wollte aus derselben Asymmetrie eine neue Feuerschwelle fuer
Black Ops ableiten - ueber den Erwartungswert `p * G * 0,8 - (1-p) * L` mit
Break-even `L / (L + 0,8 G)`. **Das Modell ist falsch, und es haette den
groessten Hebel des Vortags kaputtgemacht.**

Rangverlust ist kein Verlust, sondern Zeit: `changeRank` vergibt Skillpunkte
gegen `maxRank`, und `maxRank` faellt nie (`Bladeburner.ts:1273,1283-1291`).
Ein Fehlschlag kostet also **keinen** Skillpunkt, er verzoegert nur die
`reqdRank`-Freigabe - genau die Begruendung, mit der die Schwelle am 28.08. um
16:00 von 0,90 auf 0,35 gesenkt wurde (`nodes/HEBEL.md`). Die richtige
Rechnung steht in Minuten:

    Kosten eines Fehlschlags = T_op + L / (m * Rangrate)

In BitNode 10 wird dieser Posten mit `m = 0,8` um ein Viertel teurer: bei
Daedalus (L 10.000, Rate 1.846/min in BitNode 6) von 5,4 auf 6,8 Minuten. Dem
stehen die **78 bis 86 Minuten** gegenueber, die Warten auf eine hoehere Chance
am 28.08. gekostet haette. Die Verschiebung betraegt also 1,4 Minuten gegen
achtzig - **die 0,35 bleiben richtig, auch in diesem Knoten.**

Verdacht: keiner mehr an der Schwelle. Was bleibt, ist der Wunsch, sie
          herzuleiten statt zu setzen - dann aber ueber die Zeitrechnung oben,
          nicht ueber den Erwartungswert.

Dringlichkeit: mittel, aber zeitkritisch: Der Beitritt steht in rund vier
          Stunden an (Tiefstand 87 um 03:39), und danach traegt `blade.js` den
          Knoten. Vor dem ersten Black Op geprueft, kostet es nichts; danach
          kostet jede falsche Entscheidung Rang.

### Wartet bis SF9: Hash-Upgrades sind eine ungenutzte Waehrung fuer Kampfknoten

Gemessen: Spielstand 29.08. um 00:58 - `sourceFiles {1,4,5,6}`, kein SF9,
          `hashManager` mit capacity 0 und allen Upgrades auf 0. In diesem
          Knoten ist die Sache also tot; der Eintrag ist fuer die Route.

Erwartet: `Hacknet/data/HashUpgradesMetadata.tsx` fuehrt drei Upgrades, die
          direkt auf unsere Engpaesse zielen:

              Improve Gym Training           50 Hashes  ->  +20 % Gym-Erfahrung
              Exchange for Bladeburner Rank 250 Hashes  ->  100 Rang
              Exchange for Bladeburner SP   250 Hashes  ->   10 Faehigkeitspunkte

          Die ersten beiden Groessen sind genau die, an denen ein Kampfknoten
          haengt: Tor 1 ist Gym-Erfahrung, Tor 2 sind 400.000 Rang. Das
          Gym-Upgrade haelt ausserdem bis zum naechsten Augmentierungs-Einbau,
          ist also je Lauf einmal zu kaufen und wirkt durchgehend.

Verdacht: Kein Fehler, eine fehlende Route. Hashes entstehen nur auf
          Hacknet-SERVERN, und die verlangen SF9. Zu klaeren, sobald BitNode 9
          gefahren ist: Wieviele Hashes je Minute traegt eine gekaufte
          Serverflotte, und wie verhaelt sich das zu 250 Hashes je 100 Rang?
          Bei 400.000 Rang waeren das 1 Mio Hashes - die Zahl entscheidet, ob
          es ein Hebel oder eine Randnotiz ist.

Dringlichkeit: niedrig, aber nicht vergessen. Die BitNode-Reihenfolge steht
          fest; dieser Punkt wird geprueft, wenn SF9 vorliegt.

### Wartet bis BitNode 7: Diplomacy frisst 28,7 Prozent der Zeit fuer einen Schaden, den es nicht gibt (13:33)

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

Der Punkt selbst bleibt offen - **und er ist in BitNode 6 nicht mehr zu
schliessen.** Gemessen 16:08: `chaosMax 34.52` nach 43 Minuten Laufzeit der
Marke. Das Chaos steigt in der eigenen Stadt nur durch `randomEvent`
(alle 240-600 s, davon 20 Prozent Riots, Stadt zufaellig aus sechs -
`Bladeburner.ts:107, 679-684`), also rund alle 35 Minuten um 5 bis 20
Prozent; von 34,5 auf ueber 50 waeren das mehrere Stunden. Der Knoten endet
vorher: Rang 400.234 um 16:10, Centurion laeuft, danach zwei Aktionen.

**Beim BitNode-Wechsel ist die Bladeburner-Division weg** (Prestige), und mit
ihr das Chaos-Konto. Der Nachweis muss deshalb in **BitNode 7** gefuehrt
werden - dem zweiten Kampfknoten der Route. `chaosMax` steht dafuer bereit
und braucht dort nur abgelesen zu werden.

Der Punkt wandert damit nach `## Offen`; er ist nicht erledigt, aber in
diesem Knoten nicht mehr bearbeitbar.

---

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

**Geaendert 28.08. um 23:47, Wirkung noch nicht gemessen.** `src/blade.js`
haelt den offenen Abschnitt jetzt je Runde in `data/bladeoffen.txt` fest und
traegt ihn beim Start als abgeschlossenen Abschnitt nach - mit `abgebrochen:
true`, damit die Auswertung ihn unterscheiden kann. Ein Neustart kostet damit
hoechstens einen Durchlauf statt des ganzen Abschnitts. Im Spiel angekommen
(Pruefung ueber die Bruecke, 23:48).

**Nachmessen laesst sich das erst, wenn `blade.js` wieder laeuft** - also nach
dem Bladeburner-Beitritt, ETA rund 5 h (Tiefstand 86 um 03:12). Pruefung dann:
`blade.js` per `WERKZEUG blade.js` neu starten und in `data/aktionen.txt`
nachsehen, ob eine Zeile mit `abgebrochen: true` erscheint, deren `bis`
hoechstens eine Runde vor dem Neustart liegt. Erscheint keine, ist der
Wiederanlaufblock tot.

**Wichtig, um 03:14 beinahe verpasst:** Der laufende `blade.js`-Prozess hatte
noch den Code vom Knotenstart (17:05, PID 30) - beide Nachtaenderungen lagen
zwar als Datei im Spiel, aber nicht im laufenden Prozess. Beim Beitritt waere
der Motor mit dem alten Stand losgelaufen und die Nachmessungen haetten ins
Leere gezeigt. Per `WERKZEUG blade.js` neu gestartet, **verifiziert um 03:15:
neue PID 47894**. Genau diese Falle steht seit dem 27.08., 18:55 im
Optimierloop-Prompt; sie greift auch, wenn zwischen Aenderung und Wirkung
Stunden liegen.

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

**Geaendert 29.08. um 00:55, Wirkung noch nicht gemessen.** `beste()` rechnet
den Bevoelkerungsverbrauch jetzt als Zeitzuschlag ein, analog zum
Chaos-Zuschlag von 03:42:

    dF/F = 0,7 * dp/p     (aus `(pop/1e9)^0,7`, `Actions/Action.ts:88-92`)
    Zuschlag = 0,7 * r * HORIZONT

mit r aus `Bladeburner.ts:823-853` (Raid 1 %, Stealth Retirement 0,5 %, Sting
0,1 %) und HORIZONT = **eine Stunde**. Raid bekommt damit 25 Sekunden auf eine
Dauer von rund 59 - also gut 40 Prozent.

**Der Horizont ist bewusst zu klein.** Rechnerisch richtig waere die
Restlaufzeit des Knotens, und die betraegt Stunden bis Tage; mit ihr wuerde
jede prozentuale Aktion faktisch gesperrt. Das mag sogar stimmen - Raid stand
am 28.08. schon ohne diesen Zuschlag bei 123 Rang/min gegen 1.097 fuer
Assassination -, aber eine Sperre, die niemand gemessen hat, ist keine
Verbesserung. Eine Stunde ist die Zeitskala, auf der der Motor ohnehin misst.

**Offen bleibt der Horizont.** Nachzumessen, sobald `blade.js` laeuft (nach dem
Bladeburner-Beitritt, ETA rund 13 h): Waehlt der Motor Raid noch, und wenn ja,
faellt danach `popEst` der Stadt? Bleibt popEst ueber einer Stunde stabil, kann
der Horizont bleiben; faellt es weiter, gehoert er hochgesetzt - dann aber mit
der Rangrate als Beleg, nicht mit der Rechnung allein.

### Wartet bis V1-Knoten: Der Erfahrungsofen (Befund B1 aus dem Bot-Audit)

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

**Grundlage gelegt 29.08. um 01:50: `doku/formeln-boerse.md`.** Die Mechanik
ist jetzt aus `StockMarket/` gelesen statt vermutet. Die drei Zahlen, an denen
der Bot haengt:

- **Zyklus 7,5 Minuten** (`TicksPerCycle: 75` a 6 s). Jede Aktie kippt dabei
  mit 45 Prozent ihre Richtung. Ein Schaetzfenster laenger als ein Zyklus
  mittelt ueber den Wechsel und liefert systematisch 50 Prozent - also nichts.
- **Ohne 4S ist die Richtung kaum messbar.** `chc = (50 ± otlkMag)/100` mit
  otlkMag zwischen 1 und 10; der Standardfehler eines Anteils aus n Ticks ist
  `0,5/sqrt(n)`, ein Signal von 5 Punkten braucht also n = 100 Ticks = 10
  Minuten - laenger als der Zyklus. Die 4S-API (25 Mrd) ist damit kein Luxus,
  sondern der Unterschied zwischen Rechnen und Raten.
- **Provision 100.000 je Richtung**, unabhaengig von der Groesse. Bei einem
  Prozent erwartetem Gewinn deckt erst ein Einsatz von 20 Mio die Gebuehr.

**Nicht gekauft, nichts ausgegeben.** Der Zugang kostet 5 Mrd (TIX) plus 25 Mrd
(4S-API); der Spielstand hatte um 01:43 vier Mrd, und in diesem Knoten traegt
Geld den Fortschritt ohnehin nicht - der Traeger ist die Kampferfahrung. Ein
Kauf hier waere nur fuer einen Test, und beim Knotenwechsel ist er wieder weg.

**Nachgelegt 29.08. um 02:20 - und es kippt die Bauart des Bots.**
`PlayerInfluencing.ts` war als Randnotiz vermerkt und ist der Hauptweg:

- `ns.grow(host, {stock: true})` hebt das Forecast-ZIEL `otlkMagForecast` einer
  Aktie um 0,1, `ns.hack(..., {stock: true})` senkt es - mit einer
  Wahrscheinlichkeit gleich dem bewegten Anteil des Servergeldes.
- Der Forecast wandert je Tick auf dieses Ziel zu, mit bis zu **95 Prozent**
  Wahrscheinlichkeit (`getForecastIncreaseChance`, `Stock.ts:235-239`).
- Ein WSE-Konto wird dabei **nicht** geprueft, nur die `stock`-Option des
  Aufrufs (`validateHGWOptions`, `NetscriptFunctions.ts:411`).

**Der Bot muss den Forecast also nicht schaetzen, er setzt ihn.** Damit ist die
4S-API (25 Mrd) ein Komfortkauf statt eines Nadeloehrs - die Rechnung aus
`doku/formeln-boerse.md` Abschnitt 4 gilt nur noch fuer einen rein
beobachtenden Bot.

**Und fuer BitNode 8 geht es auf.** Dort ist `ScriptHackMoneyGain: 0` - Hacken
bringt dem Spieler nichts -, aber `ScriptHackMoney: 0.3` ist nicht null: Dem
Server wird weiterhin Geld entnommen, und genau diese Menge treibt die
Manipulation. Im einzigen Knoten ohne Einnahmequelle bleibt das Hacknetz die
Einnahmequelle, nur ueber den Umweg des Kurses.

Grenze: `stockMarketCycle` kippt alle 7,5 Minuten mit 45 Prozent auch das Ziel
(`flipForecastForecast`: `100 - otlkMagForecast`). Aufbau und Haltedauer
muessen in einen Zyklus passen.

Offen bleibt: der Darknet-Volatilitaetsmultiplikator und die Frage, ob
Limit-Orders mehr koennen als Marktorders.

### Wartet bis BitNode 15: Darknet-Labyrinth-Gewerk (V1b)

`labyrinth.ts:424-427` legt The Red Pill ins sechste Darknet-Labor, aber nur bei
`hasFullDarknetAccess()` - also in BitNode 15 oder mit SF15. Jeder
Augmentierungs-Einbau wuerfelt das Darknet neu (Prestige.ts:76), es braucht also
je Labor einen Einbauzyklus und rund 24 Raetselloeser.

**Dringlichkeit:** niedrig. Erst vor BitNode 15 relevant.

---

### Source-File -1: die letzten vier Exploits (Stand 29.08., 02:45 - 7 von 11)

Eingesammelt: `UndocumentedFunctionCall`, `INeedARainbow`, `Bypass`
(`src/exploit.js`), `TimeCompression` (`src/exploit2.js`), `TrueRecursion`
und `N00dles` (`src/exploit3.js`). `PrototypeTampering` haengt am
15-Minuten-Zeitgeber und sollte kurz nach 07:57 fallen - nachsehen mit
`node tools/lage.js | grep Exploits`.

**Der Ertrag ist bewusst klein**: `applyExploits.ts` multipliziert alle
Multiplikatoren mit `1,001^n`. Von 7 auf 11 sind das 1,007 auf 1,011, also
**+0,4 %**. Dafuer permanent und ueber jeden Reset hinweg - bei 45 geplanten
Laeufen ist das kein Nichts, aber es hat keine Dringlichkeit.

**Nachgemessen 29.08. um 02:44** (`node tools/lage.js | grep Exploits`):
`PrototypeTampering` **ist da** - der Zeitgeber ist wie erwartet gefallen. Die
Liste steht jetzt bei sieben:

    UndocumentedFunctionCall, INeedARainbow, Bypass, TimeCompression,
    TrueRecursion, N00dles, PrototypeTampering

Damit ist alles eingesammelt, was ein Skript allein erreichen kann. Die
verbleibenden vier brauchen etwas, das kein Loop hat: zwei einen echten
Mausklick beziehungsweise den Debugger ueber die Opera-Verbindung
(`Unclickable`, `RealityAlteration`), einer ist im ausgelieferten Spiel gar
nicht erreichbar (`YoureNotMeantToAccessThis`), und `EditSaveFile` verlangt,
den Spielstand zu exportieren, zu veraendern und zurueckzuspielen.

**`EditSaveFile` wird nachts nicht angefasst.** Der Ertrag ist 0,1 Prozent auf
alle Multiplikatoren; der Einsatz ist ein Import ueber einen laufenden Bot,
der jeden Fortschritt seit dem Export verwirft. Das gehoert in einen Moment
mit Aufsicht, nicht in einen unbeaufsichtigten Nachtlauf - so steht es auch
schon im Absatz darueber ("nur mit Sicherung und nicht im laufenden Betrieb").

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
