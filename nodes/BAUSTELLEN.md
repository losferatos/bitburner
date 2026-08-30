# Offene Baustellen

**Diese Datei ist die Arbeitsliste des Vorankommens-Loops.** Sie existiert, weil
Befunde sonst in Prosa verschwinden: Am 24.08.2026 sind drei von fuenf
Pruefbefunden untergegangen, weil sie in einem Fliesstext standen statt in einer
Liste, die man abhaken kann.

## ENTSCHIEDEN - nicht wieder aufmachen

**Vor jeder Aenderung diese Liste lesen.** Wer etwas aendern will, das hier
steht, braucht eine **neue Messung oder eine neue Fundstelle** - nicht ein
neues Argument. Steht beides nicht zur Verfuegung, wird nicht angefasst.

*Warum die Liste existiert (29.08.2026, 09:00, auf Erics Ansage):* Die
Begruendungen lagen verstreut in `nodes/HEBEL.md` und `nodes/ERLEDIGT.md` und
wurden nur gefunden, wenn jemand zufaellig danach greppte. Zweimal binnen
24 Stunden wurde eine erledigte Frage neu aufgerollt und erst beim
Nachrechnen wieder verworfen - die Feuerschwelle um 03:45 und Raid mehrfach.
Beide Male ging es gut, aber Nachrechnen ist Zufall, kein Mechanismus.

| Entschieden | Wert | Beleg | Wann |
|---|---|---|---|
| Feuerschwelle Black Ops | **0,35**, nicht 0,90 | Rangverlust ist Zeit, kein Bestand (`Bladeburner.ts:1273,1283-1291`); Kosten `T_op + L/(m*Rangrate)` = 6,8 min gegen 80 min Warten | 28.08. 16:00, bestaetigt 29.08. 03:55 und 07:20 |
| Bevoelkerungs-Horizont in `beste()` | **1 Stunde**, nicht die Restlaufzeit | Black Ops ignorieren pop (`BlackOperation.ts:55`), Chance bei 1 gedeckelt (`Action.ts:195`), Ereignisse driftfrei (-0,0016/Ereignis) | 29.08. 08:20 |
| Einbau vor dem Divisionsbeitritt | **nie** | Prestige setzt Kampfwerte auf 1; am 29.08. 04:15 kostete es netto 90.810 Erfahrung = 6,6 h | 25.08., erzwungen 29.08. 04:25 und 06:20 |
| Augmentierungsrunde vor Tor 1 | **verworfen** | Gym allein 18,6 h gegen 20,3 h; nur Combat Rib I hebt str/def, der Rest wirkt auf dex/agi | 28.08. 22:52 |
| Sleeve: sync hochziehen | **verworfen** | 20,2 h Stillstand = 236.285 Erfahrung, mehr als der ganze Restweg | 29.08. 06:55 |
| Gym und Bladeburner parallel | **unmoeglich** | gemessen und per `git revert` zurueckgenommen | 28.08. 07:34 |
| Ausgang aus BitNode 10 | **nur Bladeburner** | Hacking-Weg braucht Level 6.000 = 10^175 Erfahrung | 29.08. 07:20 |
| Reihenfolge der BitNodes | **fest** | `nodes/AUDIT-ROADMAP-2026-08-24.md` | 24.08. |
| Kampfknoten-Bedingung | **`BLADE_KNOTEN`**, nie eine Nummer im Code | derselbe Fehler an sieben Stellen; die 10 fehlte ueberall | 29.08. 09:15 |
| EditSaveFile im laufenden Spiel | **nein**, erst beim naechsten Reset | Remote-API kann Spielstaende nur lesen; IndexedDB-Schreiben riskiert den ganzen Lauf fuer 0,1 % | 29.08. 09:45 |
| Beitritt zur Division | **sofort bei Kampfwert 100** | Kampfwerte 100 -> 300 bringen nur +46 % Rang nach 10 h, kosten aber Tage Gym (Simulation 29.08., `nodes/KURS.md` 10:20) | 29.08. 10:20 |
| Verbrechen statt Gym zum Kampftraining | **verworfen** | Gym Powerhouse 10 exp/s in einem Stat gegen bestenfalls 3,0 exp/s ueber alle vier (Mug 12 exp/4 s, Heist 1800/600 s); BN10 hat keinen Gym-Malus, nur `CrimeMoney: 0,5` | 29.08. 13:25 |

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
  `## Offen, nach Dringlichkeit

*Der Beitritt selbst ist geprueft und braucht keinen Punkt (29.08., 11:15).*
*`bbtrain.js:257-272` haelt bei ZIEL 100 an, ruft `stopAction()` und dann*
*`joinBladeburnerDivision()`; bei Ablehnung schreibt es `data/hilfe.txt`, was*
*der Pruefer als STOERUNG meldet. Der Beitrittszeitpunkt geht nach*
*`data/bbjoin.txt` und wird nach home kopiert - wichtig, weil bbtrain auf der*
*Werkbank laeuft. Alle vier Spielbedingungen (`NetscriptFunctions/Bladeburner.ts:335-352`)*
*sind erfuellt: `disableBladeburner` ist false (Spielstand 11:14),*
*`BladeburnerRank` ist 0,8 und damit ungleich 0, `Player.bladeburner` ist noch*
*null, und die vier Kampfwerte stehen bei 86-87 von 100.*
`, ein `## Erledigt`.
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

### Die Nachfuellphase kostet 17 Minuten am Stueck - ungemessen (30.08., 07:42)

Gemessen: Ab **07:24** faellt die Rangrate von rund 280 auf **20 bis 60
          Rang/h** und bleibt dort (Waechterreihe, 3-Minuten-Takt):

              07:18  304   339 Rang/h
              07:21  318   280
              07:24  330   240
              07:27  333    60   <- Bruch
              07:30  336    60
              07:33  337    20
              07:36  340    60

Ursache:  **Kein Fehler.** `data/blade.json` um 07:39: `aktion =
          General/Incite Violence`, `grund = Vertragsvorrat leer`. Die
          Diagnose bestaetigt es - alle drei Kontraktarten unter 1:
          Tracking 0,75, Bounty Hunter 0,16, Retirement 0,42. Incite Violence
          fuellt Vertraege und Operationen auf einen Schlag auf
          (`Bladeburner.ts:1219-1225`, 180 Wachstumsschritte), dauert 60 s
          und bringt **0 Rang**.

          Geprueft und verworfen: Der `some`-Test in `src/blade.js:2745`
          (`VERTRAEGE.some((name) => offen(V, name) < 3)`) sieht nach einem
          Fehlausloeser aus, weil er auf EINEN leeren Vertrag feuert, obwohl
          der Kommentar "und zwar der beste" sagt. Hier greift er zu Recht -
          es sind alle drei leer. **Nicht anfassen** ohne einen Fall, in dem
          der beste Vertrag nachweislich Vorrat hat.

          Ebenfalls geprueft: `sleevediag` meldete um 07:39 `task: null`, also
          Sleeve idle. Das ist eine Momentaufnahme waehrend der leeren Minute
          (`SleeveBladeburnerWork.process:44-47` stoppt bei `count < 1`);
          `data/sleeve.json` um 07:40:56 zeigt ihn wieder auf
          `contract:Bounty Hunter`. **Selbstheilend, kein Fehler.**

Erwartet: Offen ist nicht das Ob, sondern das **Wieviel**. Der Einbruch dauert
          jetzt schon 17 Minuten - das sind rund **70 Rang Verlust** gegenueber
          dem Trend. Wiederholt sich das stuendlich, kostet es ueber die
          ETA von 77 h (`nodes/KURS.md`, 30.08. 07:20) einen zweistelligen
          Prozentsatz.

          Zu messen: (1) Wie lang ist eine Nachfuellphase wirklich, von der
          ersten Incite-Violence-Minute bis zur wiederhergestellten Rate?
          (2) In welchem Abstand kommt sie? (3) Reicht **ein** Durchlauf, oder
          feuert der Zweig mehrfach hintereinander? Quelle ist
          `data/aktionen.txt` ueber die Bruecke - dort steht jeder Abschnitt
          mit `grund`.

          Erst mit diesen drei Zahlen laesst sich beurteilen, ob ein frueherer
          Ausloeser (Nachfuellen bei Vorrat 10 statt 3, waehrend die
          Kontrakte noch laufen) etwas bringt oder nur Chaos kostet.
          `chaos = 7,71` bei `chaosMax = 7,7` - die Grenze von 25 aus
          `blade.js:2746` ist weit weg, Spielraum ist da.

Dringlichkeit: mittel. Kein Defekt, aber der erste gemessene Ratenverlust im
          Vollbetrieb - und der Optimierloop hat gerade keinen groesseren.

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

**Beide offenen Fragen sind beantwortet (29.08., 08:50), aus dem Quellcode.**

**1. Der Darknet-Volatilitaetsmultiplikator ist gedeckelt bei 4.**
`DarkNet/effects/effects.ts:218-222`:

    mult(c) = 1 + (1 - e^(-0,001 c)) + 2 * (1 - e^(-0,00015 c))

mit c = `DarknetState.stockPromotions[symbol]`. Fuer c gegen unendlich laeuft
das gegen **4**, und die Haelfte des Wegs (Faktor 2,5) liegt bei rund 4.600
Ladungen. Er wirkt an **genau einer** Stelle: `StockMarket.ts:268`,
`const volatility = stock.mv * getDarknetVolatilityMult(stock.symbol)` - also
auf die **Preisbewegung**, nicht auf die Manipulation. Fuer den Bot heisst
das: mehr Amplitude je Tick, gleiche Steuerbarkeit. Nuetzlich, aber kein
Hebel, den man vor dem Bot bauen muesste.

**2. Limit-Orders koennen mehr - und sie sind in BitNode 8 gratis dabei.**
`NetscriptFunctions/StockMarket.ts:183` verlangt `checkSFAccess(ctx, 3)`, und
der Wachhund lautet (Zeile 47):

    if (Player.bitNodeN !== 8 && Player.activeSourceFileLvl(8) < sfLevel)

**Im Knoten selbst greift die Sperre nie.** In BitNode 8 stehen damit ohne
jedes Source-File offen: Shorts (Level 2, Zeilen 160/170) und Limit-/
Stop-Orders (Level 3, Zeilen 183/195/205). Der Bot darf also von Anfang an mit
dem vollen Werkzeugkasten rechnen - die bisherige Annahme, er muesse mit
Marktorders auskommen, war zu vorsichtig.

**3. Nebenbefund, der die Positionsgroesse begrenzt.** Der eigene Handel
schiebt den Forecast gegen einen: `StockMarketHelpers.ts:86` und `:106` rufen
`influenceForecastForecast(forecastChange * (stock.mv / 100))` - je Paket, das
eine Preisbewegung ausloest. Wer zu gross kauft, verdirbt sich das Ziel, das
er per `grow(host, {stock:true})` gerade aufgebaut hat. Die Positionsgroesse
gehoert also an `shareTxForMovement` gekoppelt, nicht ans verfuegbare Geld.

Damit ist die Vorarbeit fuer den Bot abgeschlossen; was fehlt, ist der Bot
selbst - und der wird erst in BitNode 8 gebraucht (Route Platz 42-44).


**Bestandsaufnahme und zwei Korrekturen (30.08., 00:55).**

**1. "Den Bot gibt es noch nicht" stimmt nur halb.** Im Baum liegen
`src/stocks.js` (208 Zeilen) und `src/stockaccess.js` (130 Zeilen). Der
vorhandene Bot ist aber ein **beobachtender**: Er entscheidet ueber
`ns.stock.getForecast`, und das wirft ohne 4S-Daten
(`NetscriptFunctions/StockMarket.ts:237-241`, `if (!Player.has4SDataTixApi)
throw`). In BitNode 8 ist er damit erst nach dem 25-Mrd-Kauf lauffaehig. Was
fehlt, ist der **manipulierende** Bot - und der braucht `getForecast` gar
nicht, weil er die Richtung selbst setzt.

**2. Die Zugangskosten sind falsch beziffert - in BitNode 8 ist der Handel
gratis.** Der Eintrag oben nennt "5 Mrd (TIX) plus 25 Mrd (4S-API)". Fuer
BitNode 8 gilt das nicht: `Prestige.ts:156-163` schenkt beides beim Betreten,

    if (Player.bitNodeN === 8) Player.money = BitNode8StartingMoney;   // 250 Mio
    if (canAccessBitNodeFeature(8)) {
      Player.hasWseAccount = true;
      Player.hasTixApiAccess = true;
    }

und `canAccessBitNodeFeature(8)` ist im Knoten selbst immer wahr
(`BitNode/BitNodeUtils.ts:17-19`). **Startkapital 250 Mio, TIX-API frei.**

**Das war die entscheidende Frage, und sie war offen.** In BitNode 8 stehen
saemtliche Geldquellen auf null (`BitNode.tsx:765-780`):

    CompanyWorkMoney 0   CrimeMoney 0        HacknetNodeMoney 0
    ManualHackMoney 0    ScriptHackMoneyGain 0   CodingContractMoney 0
    InfiltrationMoney 0  DarknetMoneyMultiplier 0

Waere die TIX-API zu kaufen, gaebe es keinen Weg, die 5 Mrd zu verdienen -
der Knoten waere verschlossen. Er ist es nicht, weil der Zugang zum Start
gehoert. `ScriptHackMoney: 0.3` bleibt dabei ungleich null: Dem Server wird
weiter Geld entnommen, was die Manipulation ueber `grow(host, {stock:true})`
antreibt, auch wenn der Spieler davon nichts bekommt.

**Damit steht die Bauart fest:** Startkapital 250 Mio, kein 4S, Richtung per
Hacknetz gesetzt, Positionsgroesse an `shareTxForMovement` gekoppelt
(Nebenbefund 3 oben), Shorts und Limit-Orders frei
(`checkSFAccess` greift in BN8 nie). Von `stocks.js` wiederverwendbar sind
Kauf-, Verkaufs- und Positionslogik; die Entscheidungsregel ueber
`getForecast` muss durch die eigene Manipulationsabsicht ersetzt werden.

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

**Entschieden 29.08., 09:45: alle vier bleiben liegen, drei davon endgueltig.**

Die Frage war, ob ein Loop wenigstens `EditSaveFile` allein schafft. Antwort:
nein - und der Beleg ist knapp. `RemoteFileAPI/MessageHandlers.ts` hat elf
Handler, darunter `getSaveFile` (Zeile 226), aber **kein Gegenstueck zum
Schreiben**. Der Spielstand ist ueber die Bruecke lesbar und nicht
schreibbar. Opera antwortet nicht auf Port 9222 (geprueft 09:43, HTTP 000),
also faellt auch der CDP-Weg weg - und mit ihm `Unclickable` und
`RealityAlteration`.

Bleibt ein dritter Weg, den ein Skript IM Spiel haette: IndexedDB direkt
schreiben und die Seite neu laden. **Wird nicht gemacht.** Der Ertrag ist
0,1 Prozent auf die Multiplikatoren; der Einsatz ist der laufende Spielstand
mit 237.533 Erfahrung, 85 Servern und dem halben Weg zum Divisionsbeitritt.
Ein Schreibfehler an dieser Stelle kostet den ganzen Lauf. Das Verhaeltnis
stimmt nicht, und zwar nicht knapp.

**Der richtige Moment dafuer ist ein Reset, der ohnehin kommt.** Beim
naechsten BitNode-Wechsel steht der Stand ohnehin auf Anfang - dann kostet
ein misslungener Versuch nichts. Bis dahin ruht der Punkt; er steht nicht
unter "Wartet bis Eric", weil hier nichts zu entscheiden ist, sondern eine
Gelegenheit abzuwarten.

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
