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

### Der Einbau kam 50 Minuten nach dem Divisionsbeitritt und kostet 8 h (29.08., 19:45)

Befund:   Um kurz nach 19:05 hat `bn4rep.js:1150` Augmentierungen eingebaut -
          50 Minuten nach dem Beitritt zur Bladeburner-Division um 18:14:36.
          Kampfwerte 100/100/100/100 fielen auf 1, der Rang 17 blieb.

Gemessen um 19:38, Multiplikatoren aus dem laufenden Stand zurueckgerechnet
(`m = level / (32*ln(exp+534,6) - 200)`, `PersonObjects/formulas/skill.ts:13`):

    Stat  m neu    m alt    Zuwachs   Rest bis 100
    str   0,5600   0,5143     +9 %      2,75 h
    def   0,5599   0,5142     +9 %      2,75 h
    dex   0,7769   0,5936    +31 %      0,53 h
    agi   0,5901   0,5398     +9 %      2,03 h
                                        ------
                                        8,06 h

**Die Kosten sind belegt, der Nutzen noch nicht.** 8,06 Stunden Gym, in denen
der Bot keinen Rang sammelt - bei der am 29.08. gemessenen Rate von rund
40 Rang/h waeren das gut 320 Rang. Dagegen stehen +9 Prozent auf drei
Kampf-Multiplikatoren, und Kampfwerte gehen nach `nodes/KURS.md` (10:20) nur
stark gedaempft in den Rang ein: 100 -> 300 bringt +46 Prozent Rang.

Die Zeile `Einbau vor dem Divisionsbeitritt = nie` im Abschnitt
`## ENTSCHIEDEN` deckt diesen Fall **nicht** ab - sie endet mit dem Beitritt,
obwohl ihre Begruendung (Prestige setzt die Kampfwerte auf 1) danach
unveraendert gilt. Das ist eine Luecke in der Regel, kein Regelbruch.

**Naechster Schritt, nicht in diesem Lauf:** Auflisten, welche
Augmentierungen tatsaechlich eingebaut wurden (`data/bn4rep.json` oder
`ns.singularity.getOwnedAugmentations`), und ihren Nutzen gegen die 8,06 h
rechnen. Erst danach laesst sich entscheiden, ob die Regel auf "kein Einbau,
solange der Kampfwert-Tiefstand ueber X liegt" erweitert gehoert - eine
Sperre ohne diese Gegenrechnung waere geraten.

### Skill-Abdeckung ist auf das BN6-Spaetspiel geeicht, nicht auf BN10 (29.08., 18:55)

Befund, nicht behoben - der Lauf wurde fuer Erics Token-Pause abgebrochen.

`ABDECKUNG` in `src/blade.js:737-740` wurde am 28.08. um 14:45 von der
Aktionsmischung auf **Black Ops** umgestellt. Damals war das richtig: Rang
248.930 von 400.000, die Black-Op-Chance war der Engpass. Digital Observer
bekam dadurch `abdeckung: 1.0` (trifft 12 von 12 Black Ops), Tracer steht
gar nicht in `DYNAMISCH` und damit hinter allen sechs sortierten.

**Jetzt ist die Lage umgekehrt.** Stand 18:52: Rang 10 von 400.000, erste
Black Op bei 2.500, Aktion `Contracts/Retirement` mit **Chance 0,239**.
Gekauft wurden Digital Observer 1 und Hyperdrive 1 - Digital Observer wirkt
ueber `SuccessChanceOperation` (`data/Skills.ts:31-36`) und damit auf
**keine einzige** Aktion, die der Bot gerade faehrt. Tracer
(`SuccessChanceContract: 4`, baseCost 2, `data/Skills.ts:38-43`) steht auf
Stufe 0.

Nutzen je Punkt in der aktuellen Phase:

    Tracer            St.0  Preis 2  +4 % auf Kontrakte   Abdeckung 1,00  2,00
    Digital Observer  St.1  Preis 4  +4 % auf Operationen Abdeckung ~0    ~0
    Hyperdrive        St.1  Preis 4  +10 % Erfahrung, wirkt nur ueber
                                     Kampfwerte (Exponent 0,04-0,8)

**Vorschlag** (ungeprueft): Tracer in `DYNAMISCH` aufnehmen und die
Abdeckung an die Naehe zur ersten Black Op binden statt sie fest auf 1,0 zu
setzen - `blackOpArbeit[name]` in Zeile 910 tut das bereits fuer einen Teil
der Faehigkeiten. Erwartung: Kontraktchance von 0,239 auf 0,249 je
Tracer-Stufe, bei Stufe 3 rund +12 % Rangrate.

### Dieselbe Waechter-Falle stand an zwei Stellen - eine blieb 3 Tage stehen (17:15)

Gemessen: Am 29.08. um 16:28 kam die ntfy-Meldung "Notnagel-Kontingent
          erschoepft - Loops stehen", **waehrend alle fuenf Loops liefen**.
          `data/ziele.md` stand auf 10:08, `data/verlauf-strategie.json` war
          frisch. Der Notnagel hatte ab 11:23 **30 headless-Laeufe** gefeuert,
          rund 6,50 USD, alle wirkungslos.

Ursache:  `tools/aufsicht.js:129` erkannte lebende Loops an `data/ziele.md`.
          Die schrieb der **alte** Reportloop alle 30 Minuten; seit seiner
          Kuerzung auf zwei Zeilen am 29.08. um 10:25 schreibt er sie nicht
          mehr. Behoben 16:53, Ausloeser ist jetzt
          `data/verlauf-strategie.json` (schreibt der Pruefer bei jedem Lauf).

**Der eigentliche Befund ist nicht der Bug, sondern seine Wiederholung.**
Genau dieselbe Falle stand in `tools/wache.js` und wurde dort am **26.08. um
01:15** behoben - mit derselben Begruendung, demselben Ersatz und dem
ausdruecklichen Satz "Ein Fehlalarm aus dem Alarmwerkzeug selbst ist die
teuerste Sorte". `aufsicht.js` blieb dabei unberuehrt und lief drei Tage
weiter mit dem alten Signal. Das ist das Muster vom 25.08. (`bn4life`, dann
`bn4rep`): behoben wurde der Einzelfall, nicht die Klasse.

Geprueft und **kein Befund**: Es gibt genau drei Frischepruefungen im Repo
(`grep -n mtimeMs tools/*.js src/*.js`). Die dritte, `aufsicht.js:218` auf
`data/wache-zustand.json`, ist richtig - der Waechter schreibt diese Datei
selbst, sie ist sein eigenes Lebenszeichen und kein Nebenprodukt.

**Regel, die daraus folgt:** Ein Waechter haengt an einer Datei, die der
ueberwachte Vorgang **selbst** schreibt - nie an einem Nebenprodukt, das ein
anderer Loop beilaeufig mitfuehrt. Wer ein Ausgabeformat aendert, greppt
vorher nach dem Dateinamen: `grep -rn "<datei>" tools/ src/ sync/`.

Dringlichkeit: niedrig - beide Fundstellen sind behoben. Der Eintrag steht
hier, damit die naechste Formataenderung die Frage stellt.

**Der Uebergang um 18:04 ist vorgeprueft (15:45) - er traegt.**

    bbtrain.js:257-272   endet nicht nach dem Beitritt, sondern geht in eine
                         Warteschleife (`drin && tief >= ZIEL` -> sleep 60 s).
                         Kein zweiter Beitrittsversuch, kein hilfe.txt-Sturm.
                         Verlassen wird sie nur, wenn die Kampfwerte fallen -
                         also nach einem Augmentierungs-Einbau.
    blade.js:569-573     wartet im 30-s-Takt und uebernimmt sofort.
    sleeve.js:85,157     prueft im 60-s-Takt, stellt also spaetestens eine
                         Minute nach dem Beitritt auf Kontrakte um.

**Neuer Befund dabei: Kontrakte sind ein gemeinsamer Topf.** Der Nachschub
betraegt `count += seconds * growthFunction() / 480`
(`Bladeburner.ts:1387`, `Constants.ts:39`) mit `growthFunction` = 0,5 bis 7,5
(`data/Contracts.ts:40`), im Mittel 4,0 - also **30 Kontrakte je Stunde und
Art**, 90 fuer alle drei zusammen.

Dagegen der erwartete Verbrauch: Spieler rund 62 Aktionen/h (10,5 s je Aktion
bei 18 Prozent Arbeitsanteil), Sleeve rund 340/h (10,6 s, durchgehend). Zusammen
**etwa 400 gegen 90** - der Vorrat wird geleert, und zwar binnen der ersten
Stunde.

Das ist **nicht automatisch schlecht**: Sind die Kontrakte leer, weicht der
Spieler auf Operationen aus, und die bringen mehr Rang je Aktion. Schlecht
waere erst, wenn auch die Operationen leerlaufen und `beste()` auf Training
oder Diplomacy zurueckfaellt - dann kostet der Sleeve mehr, als er bringt.

**Messvorschrift fuer die erste Stunde nach dem Beitritt** (ersetzt die
bisherige Gym-gegen-Kontrakte-Messung, die ohne zweiten Sleeve ohnehin nicht
vergleichbar waere):

  1. `data/sleeve.json` zeigt `contract:Tracking`.
  2. Rangrate der ersten Stunde gegen die gerechneten 6,6/h (Spieler allein)
     bzw. 31,8/h (mit Sleeve).
  3. **`data/blade.json` auf die Aktionsverteilung ansehen.** Faellt der
     Spieler auf `Training` oder `Diplomacy` durch, ist der Topf leer und der
     Sleeve gehoert auf eine Kontraktart beschraenkt, die blade.js meidet.

### `ausdauerLuft()` misst den Fuellstand, nicht die Knappheit (11:45)

Gemessen: Nicht am Bot - am Code, vor dem Ernstfall. `blade.js:966-972`
          bildet `ausdauerLuft()` aus `(jetzt/max - 0,5)/0,4`, also aus dem
          **momentanen Fuellstand**. Cyber's Edge wird mit
          `(1 - ausdauerLuft())` gewichtet (`:831`), Overclock umgekehrt.

Erwartet: Die Groesse, die zaehlt, ist nicht der Fuellstand, sondern der
          **Arbeitsanteil** R/V - und der liegt nach dem Beitritt bei 18
          Prozent (Rechnung im Hebel-Eintrag von 10:00). Er ist konstant,
          waehrend der Fuellstand im Ausdauerzyklus zwischen voll und leer
          pendelt. Damit schwankt der bewertete Nutzen von Cyber's Edge
          zwischen 0 und voll, obwohl die Knappheit sich nicht aendert.

          Besonders am Anfang: Direkt nach dem Beitritt ist die Ausdauer
          **voll**, also Luft = 1 und Cyber's Edge = 0 - bewertet als
          wertlos, obwohl es dann die wichtigste Faehigkeit des Knotens ist.
          Der Fehler ist ein Transient (nach wenigen Aktionen faellt der
          Fuellstand), und in den ersten Minuten gibt es kaum Punkte zu
          verteilen - deshalb kein Sofort-Punkt.

Verdacht: `src/blade.js:966` und die beiden Gewichtungen bei `:831` und im
          Overclock-Zweig darunter.

**Nicht vor dem Beitritt anfassen.** Ein Eingriff in die Kaufsortierung
wenige Stunden vor dem Ernstfall ist genau die Sorte Aenderung, die am
29.08. um 04:15 teuer war. Stattdessen messen, sobald `blade.js` traegt:

    node tools/spann.js        # schreibt data/bbspann.json

Dort stehen Stufe und Nutzen je Faehigkeit. Steht Cyber's Edge nach zwei
Stunden noch auf Stufe 0, waehrend andere gekauft wurden, ist der Befund
belegt und der Umbau faellig - dann mit dem gemessenen Arbeitsanteil als
Gewicht statt des Fuellstands. Steht es vorn, war die Sorge unbegruendet und
dieser Punkt wird mit der Messung geschlossen.

Dringlichkeit: mittel, aber erst ab dem Beitritt messbar.

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

**Die Logik ist jetzt bewiesen, die Wirkung im Spiel noch nicht (29.08.,
07:45).** Warten war unnoetig: Der Wiederanlaufblock ist reines Datei-Handeln
und laesst sich ohne Bladeburner pruefen. Isolierter Testlauf mit einem
ns-Stub (`merkeOffen` + Wiederanlauf woertlich uebernommen), vier Faelle:

    1  Abschnitt 5 min alt, Neustart   nachgetragen, abgebrochen: true,
                                       rangVon 1000, rangBis 1250,
                                       Ausdauer und Aktion erhalten   OK
    2  Abschnitt 4 s alt               verworfen (unter 10 s)         OK
    3  kaputter Rest in der Datei      Start ueberlebt, nichts        OK
                                       geschrieben
    4  kein offener Abschnitt          nichts geschrieben             OK

**Dabei ein echter Fehler gefunden und behoben:** Der Wiederanlauf-Zweig
schrieb `data/aktionen.txt`, kopierte sie aber **nicht nach home** - anders
als `schliesseAbschnitt`, das genau dafuer ein `ns.scp` hat. Laeuft `blade.js`
nicht auf home, waere die nachgetragene Zeile dort gelandet, wo sie niemand
liest. Das ist kein theoretischer Fall: `bn4net` verteilt Werkzeuge auf andere
Server, `sleeve.js` lief am 29.08. auf fulcrumtech. Behoben mit denselben drei
Zeilen wie im Schliessen-Pfad; `node --check` sauber, Pruefer 07:45 SPUR, im
Spiel angekommen (`getFile blade.js`), `WERKZEUG blade.js` gesetzt.

Nebenbefund, bewusst nicht behoben: Bei einem kaputten Rest bleibt
`data/bladeoffen.txt` mit dem Muell stehen, statt geleert zu werden. Schaden
entsteht keiner - der Block faengt den Parse-Fehler ab, und die erste Runde
ueberschreibt die Datei ohnehin.

**Der scp-Fix von 07:45 war nicht theoretisch (geprueft 10:45).** `blade.js`
laeuft in diesem Knoten **auf fulcrumtech, nicht auf home** (`data/ps.json`
um 10:42, PID 31355; ebenso `sleeve.js` 9629 und `bn4rep.js` 44917). Ohne das
ergaenzte `ns.scp` waere die nachgetragene Abschnittszeile also mit Sicherheit
dort gelandet, wo sie niemand liest - nicht nur im Ausnahmefall.

Mitgeprueft und **kein Befund**: Die Datei auf fulcrumtech traegt den Stand
vom letzten Neustart (07:47), die Kommentaraenderung von 09:12 fehlt dort. Das
ist folgenlos - `bn4net.js:2796` kopiert vor **jedem** `ns.exec` frisch von
home (`ns.scp([datei, ...BIBLIOTHEKEN], wirt, "home")`), ein Neustart holt
die aktuelle Fassung also immer nach. Die einzige echte Luecke bleibt der
dokumentierte Fall ohne Werkbank: dann startet gar nichts nach.

**Was weiter aussteht:** der Nachweis im laufenden Betrieb, also nach dem
Beitritt (ETA 18:15). Pruefung unveraendert: `WERKZEUG blade.js` und dann in
`data/aktionen.txt` nach einer Zeile mit `abgebrochen: true` sehen.

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

**Die Horizontfrage ist beantwortet - aus dem Quellcode, ohne auf den Betrieb
zu warten (29.08., 08:20). Der Horizont von einer Stunde bleibt.**

Der Eintrag von 00:55 nannte die Restlaufzeit des Knotens als "rechnerisch
richtigen" Horizont und den 1-Stunden-Wert als Notbehelf. Das ist falsch
herum: Die Restlaufzeit waere die richtige Groesse nur, wenn ein
Bevoelkerungsverlust die gesamte kuenftige Produktion proportional daempft.
Drei Fundstellen zeigen, dass er das nicht tut.

1. **Black Ops ignorieren die Bevoelkerung vollstaendig.**
   `Actions/BlackOperation.ts:55-57`: `getPopulationSuccessFactor()` gibt
   fest **1** zurueck. Der Knotenausgang laeuft ueber 21 Black Ops - auf ihn
   wirkt ein Raid gar nicht.

2. **Die Erfolgschance ist bei 1 gedeckelt.**
   `Actions/Action.ts:195`: `return Math.min(1, competence / difficulty)`.
   Wo die Chance gesaettigt ist, kostet ein Bevoelkerungsverlust nichts - er
   frisst nur die Reserve auf. Der Schaden setzt erst ein, wenn die Reserve
   aufgebraucht ist, und das ist keine lineare Funktion der Zeit.

3. **Die Bevoelkerung erholt sich nicht, aber sie faellt auch nicht weiter.**
   `Bladeburner.ts:600-694`, alle Ereignisse sind **prozentual**
   (`sourceCity.pop * percentage`); `BasePopGrowth` ist 100 Koepfe
   (`data/Constants.ts:36`) und bei Millionen bedeutungslos. Erwartete
   Log-Drift je Ereignis, ueber die Zweige gerechnet:

       +5 %  Gemeinde neu      0,05 * ln(1,15)  = +0,0070
       +20 % mehr Synthoiden   0,20 * ln(1,16)  = +0,0297
       -20 % weniger           0,20 * ln(0,86)  = -0,0302
       -5 %  Abwanderung       0,05 * ln(0,85)  = -0,0081
                                          Summe   -0,0016

   Also praktisch **driftfrei**. Ein Verlust ist damit weder dauerhaft im
   Sinne einer wachsenden Wunde noch heilt er von selbst - er ist ein
   Niveausprung in einem Random Walk.

Zusammen heisst das: Der Zuschlag soll die Aktion verteuern, nicht sperren.
Mit der Restlaufzeit (89-185 h laut `nodes/KURS.md`) bekaeme schon Sting mit
seinen 0,1 Prozent einen Zuschlag von ueber vier Minuten auf eine
30-Sekunden-Aktion - eine Sperre, die nach 1. und 2. gar nicht gerechtfertigt
ist. Eine Stunde ist die Zeitskala, auf der der Motor misst, und sie liegt
zwischen den beiden Fehlern. **Der Horizont bleibt, jetzt mit Begruendung.**

Was offen bleibt, ist kleiner als gedacht: die Betriebsmessung, ob `beste()`
Raid ueberhaupt noch waehlt. Sie entscheidet nichts mehr am Horizont, sondern
belegt nur, dass der Zuschlag rechnerisch dort ankommt, wo er soll.


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
