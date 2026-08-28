# Erledigte Baustellen

**Das Archiv zu `nodes/BAUSTELLEN.md`.** Hier steht, was abgeraeumt wurde -
mit der Nachmessung, die es belegt. Neueste Eintraege stehen oben.

**Wozu es getrennt liegt (27.08.2026, 18:35):** Die Arbeitsliste stand bei
1.777 Zeilen, davon 81 Prozent Erledigtes, und wuchs um rund 500 Zeilen am Tag.
Das Read-Werkzeug liest 2.000 Zeilen und schneidet den Rest stumm ab - und
zwar am unteren Ende, also beim juengsten Erledigten. Genau dort schaut die
Regel "Gab es das schon einmal?" nach. Die Wiederholungsbremse waere ohne
Fehlermeldung ausgefallen, und Symptome waeren ein zweites Mal geflickt worden.

**Wie man hier sucht:** Nicht die ganze Datei lesen - das kostet Tokens ohne
Ertrag. Gezielt greppen, mit dem Stichwort des eigenen Befunds:

```bash
grep -n -A12 "<stichwort>" nodes/ERLEDIGT.md
```

Findet sich ein aehnlicher Fall, wurde beim ersten Mal ein Symptom behoben und
nicht die Ursache. Dann gehoert der **strukturelle** Punkt nach `## Offen` in
die Arbeitsliste, statt den Einzelfall erneut zu flicken.

---

### `tools/rueckstand.js` misst nur in einer Bladeburner-Division (erledigt 28.08., 18:10)

Seit dem Wechsel nach BitNode 10 um 17:05 kam nur noch "Nicht in der Division -
kein Rueckstand messbar" - ausgerechnet fuer die Stoerung, die laut Reportloop
kein anderes Werkzeug sieht.

**Die Erwartung im Auftrag war falsch, und das Nachschlagen hat es gezeigt.**
Dort stand, `storedCycles` sei "eine Eigenschaft der Spielengine". Ist es
nicht: Es gibt den Wert nur auf Teilsystemen mit eigener Sekundenschleife -
`Bladeburner.ts:105`, `Corporation.ts:58`, ebenso Gang und Stanek. Ein
knotenunabhaengiges Gegenstueck existiert nicht.

Was es gibt, ist besser. `totalPlaytime` (`PlayerObject.ts:74`) waechst nur in
`updateGame`, also nur wenn die Engine wirklich tickt. Der Rueckstand ist damit
kein Vorrat mehr, den man ausliest, sondern ein Verhaeltnis ueber zwei
Messungen:

    tempo = (Spielzeit jetzt - Spielzeit vorher) / (Uhrzeit jetzt - Uhrzeit vorher)

1,00 heisst: Das Spiel laeuft so schnell wie die Uhr. Ein gedrosselter Tab
bekommt eine Weckung je Minute statt fuenf je Sekunde und faellt weit darunter.
Dieselbe Stoerung, aber in jedem BitNode messbar.

Mitgenommen: Der Aufholblock ("4,8 h Rechnerzeit am Tag, danach wird jede
Offline-Stunde aufgeholt") gehoert zu Bladeburners `storedCycles`-Abbau
(`Bladeburner.ts:1375-1378`) und gilt fuer die neue Messung nicht -
`totalPlaytime` holt nichts auf. Er steht jetzt nur noch, solange eine Division
existiert; sonst waere er eine Beruhigung, die nichts deckt.

Verifiziert 18:10 in BitNode 10, zwei Laeufe:
  18:08  "Erste Messung dieser Reihe (Spielzeit 215,6 h)"
  18:10  "Tempo 1.000, Rueckstand 0.0 min"  und  "Tempo 0.999"

---

### Der Sleeve in BitNode 10 tut nichts (erledigt 28.08., 17:55)

Es gab im ganzen Repo kein Sleeve-Skript - der Sleeve stand seit dem
Knotenwechsel um 17:05 still. Neu: `src/sleeve.js`.

**Shoplift, nicht Mug.** Aus `Crime/Crimes.ts:6-62`:

    Verbrechen    Dauer     Geld    Schwierigkeit   Geld je Sekunde
    Shoplift      2,0 s   15.000        0,05             7.500
    Mug           4,0 s   36.000        0,20             9.000
    Rob Store    60,0 s  400.000        0,20             6.667

Mug sieht besser aus, ist aber viermal so schwer, und ein frischer Sleeve hat
Kampfwerte um 1. Bruttoertrag zaehlt nur, wenn die Aktion gelingt.

**Speicher war der eigentliche Gegner.** Jede Sleeve-Funktion kostet 4 GB
(`RamCostGenerator.ts:51, 398-421`), und Bitburner summiert je VERSCHIEDENER
Funktion. Die erste Fassung nutzte drei (getNumSleeves, getTask,
setToCommitCrime) und kam auf rund 13,6 GB - sie startete um 17:52 nicht, weil
auf home nur 9,2 GB frei waren und die gerooteten Server in dieser Phase noch
kleiner sind. Die zweite Fassung nutzt genau eine Funktion
(`setToCommitCrime`, rund 6,3 GB gesamt) und setzt das Verbrechen dafuer bei
jedem Takt neu; bei 60 s Takt und 2 s Verbrechen kostet der Abbruch unter vier
Prozent.

**Verifiziert 17:50, Geldverlauf aus `bn4net.json`:**

    17:48:54   711.248
    17:49:14   718.748     +7.500
    17:50:04   726.248     +7.500

Exakt 7.500 je Schritt - das sind Shoplifts 15.000 mal `CrimeMoney: 0,5`
(`BitNode.tsx`, case 10). Das Geld kommt beim Spieler an
(`Sleeve/Work/Work.ts:19`, `Player.gainMoney(..., "sleeves")`).

**Nebenbefund, der eine frueher gegebene Auskunft korrigiert:** Der Spieler
bekommt die Erfahrung des Sleeves sehr wohl mit - `Work.ts:22` ruft
`applyWorkStatsExp(Player, shockedStats, mult * sync)`. Sie ist mit
`sync/100` gedaempft (in BitNode 10 mindestens 25 Prozent), aber sie faellt
nicht weg.

Offen bleibt die stufenweise Auswahl nach Kampfwerten - sie braucht
`ns.sleeve.getSleeve` und damit 4 GB mehr, als heute frei sind.

---

### Der Traeger-Wert kam aus einer toten Quelle (erledigt 28.08., 17:40)

`traeger()` las das Hackniveau aus `data/bn4rep.json`. Die Datei ueberlebt den
Knotenwechsel auf home, `bn4rep.js` nicht - es ist voller Singularity-Aufrufe
und passt ausserhalb von BitNode 4 nicht auf ein frisches home mit 32 GB.
Gemessen 17:32, eine halbe Stunde nach dem Wechsel nach BitNode 10: "Hackniveau
= 100 von 6000" aus einer Datei vom 25.08., waehrend `bn4net.json` frisch 16
auswies. Eine Zahl, die sich nie bewegt, ist per Definition stagnierend - der
Pruefer haette ab jetzt bei jedem Lauf Alarm geschlagen und echten Fortschritt
verdeckt.

Behoben: `traeger()` nimmt jetzt `net.hacking` aus `bn4net.json` (bn4net.js
startet `boot.js` nach jedem Wechsel als erstes und ist singularityfrei).
`zielLevel` bleibt bei bn4rep.json, gilt aber nur noch, wenn
`rep.knoten === knoten`. Dieselbe Frischepruefung wie bei den beiden
Fehlalarmen von 17:30.

Mitgenommen: Die Geldanzeige stand ebenfalls nur im Bladeburner-Steckbrief und
meldete in BitNode 10 "Geld ?" - sie faellt jetzt auf `net.geld` zurueck.

Verifiziert 17:40, drei Laeufe hintereinander:
  17:38  Hackniveau = 33, RESET (der Sprung von der alten 100 auf die echte 33)
  17:39  Hackniveau = 34, "Fortschritt: +1 in 1 min", Geld 1m, URTEIL SPUR

---

### `data/wache-zustand.json` speichert den Verlauf rueckwaerts (erledigt 28.08., 16:42)

`tools/wache.js:961` haengt den neuen Messpunkt per `unshift` VORN an. Wer
die Liste von aussen liest und `verlauf[0]` fuer den aeltesten Punkt haelt,
bekommt ein negatives `dt`; am 28.08. um 15:03 kam so "1.419 Rang je Minute
ueber -117 Minuten" heraus.

**Nicht umsortiert, sondern entkoppelt.** Die Reihenfolge ist tragend: Der
einzige Leser (`tools/wache.js:391`) suchte den juengsten Eintrag, der
mindestens fuenf Minuten alt ist, per `.find()` - und das ist nur richtig,
solange neueste-zuerst gilt. Ein Umsortieren haette dort still den AELTESTEN
Eintrag geliefert und die Rundenrate ueber zwei Stunden statt ueber fuenf
Minuten gemessen. Der Fehler waere also vom Report in die Stillstandserkennung
gewandert.

Stattdessen drei Eingriffe:
1. Der Leser sucht jetzt ausdruecklich das Maximum von `ts`
   (`filter` + `reduce`) und haengt nicht mehr an der Reihenfolge.
2. Die Schreibstelle traegt die Zusage "neueste zuerst" als Kommentar, mit dem
   Vorfall von 15:03 als Begruendung.
3. `loops/loop-report.md` warnt an der Stelle, an der die Rangrate verlangt
   wird ("Erst sortieren").

Verifiziert 16:41, alter gegen neuen Leser an derselben Liste: bei
neueste-zuerst liefern beide Runde 90; an der umgedrehten Liste liefert der
alte Leser Runde 10 (falsch), der neue Runde 90 (richtig).

---


### Die Abdeckung wiegt nach Arbeit statt nach Anzahl (erledigt 28.08., 16:15)

Kurz: Short-Circuit und Cloak wirken auf Centurion, Vindictus und Daedalus
nicht - keine der drei ist `isKill` oder `isStealth`. Die alte Abdeckung
(0,58 / 0,17, gezaehlt ueber alle offenen Black Ops) leitete Punkte dorthin.
Neu wiegt jede offene Black Op mit `ln(0,90 / Chance)`.

**Verifiziert 16:08, 43 Minuten nach der Aenderung um 15:25:**

    Faehigkeit           15:25   16:08   Wirkt auf Daedalus
    Digital Observer        81     104    ja
    Blade's Intuition       78      99    ja
    Evasive System          79      93    ja
    Reaper                  76      90    ja
    Short-Circuit           62      62    nein   <- steht still
    Cloak                   44      44    nein   <- steht still

Genau die vier, die auf der Mauer wirken, sind gestiegen; die beiden anderen
haben keinen einzigen Punkt mehr bekommen. Daedalus stieg im selben Fenster
von 0,1274 auf 0,3543.

---


### Der Rang bleibt die Leitgroesse - auch nach 400.000 (erledigt 28.08., 15:25)

Die offene Frage des Sofort-Punkts war: Muss `beste()` umschalten, sobald der
Rang reicht - von "Rang je Minute" auf "Kampferfahrung je Minute"? Die Antwort
steht im Quellcode und lautet **nein**, aus drei unabhaengigen Gruenden.

**1. Der Rang hoert nie auf zu zahlen.** `changeRank` vergibt Skillpunkte im
festen Verhaeltnis `RanksPerSkillPoint: 3` (`Bladeburner.ts:1283-1291`,
`data/Constants.ts:47`) - ohne Obergrenze, ohne Sattigung. Bei 1.500 Rang je
Minute sind das **500 Skillpunkte je Minute**, dauerhaft. Der Rang ist nicht
das Ziel, sondern die Quelle.

**2. Erfahrung je Minute haengt gar nicht an der Aktionsdauer.**
`getActionStats` rechnet
`unweightedGain = time * BaseStatGain * successMult * difficultyMult`
(`Bladeburner.ts:718`). Die Zeit steht als **Faktor** darin, also kuerzt sie
sich aus "Erfahrung je Minute" heraus. Eine kuerzere Aktion bringt kein
bisschen mehr Erfahrung je Zeit - nur die Schwierigkeit zaehlt
(`difficultyMult = diff^0,28 + diff/650`). Die Vermutung im Sofort-Punkt,
Assassination mit 38 s koenne von einer kuerzeren Aktion geschlagen werden,
war damit von vornherein gegenstandslos.

**3. Kampfwerte wachsen logarithmisch, Faehigkeiten linear.**
`calculateSkill` ist `floor(mult * (32*ln(exp+534,6) - 200))`. Aus
str 387 bei 813.888 Erfahrung folgt `mult` = 1,643. Fuer den Wert 1.990, den
die alte Rechnung verlangte, braeuchte es `e^44,1` = **1,4e19** Erfahrung -
das 1,7e13-fache des heutigen Stands. Dieser Weg existiert nicht.

**Was stattdessen traegt, mit Zahlen.** Gemessen 15:21 aus erster Hand:
Daedalus steht bei Chance **0,1274**, es fehlt Faktor **7,06**. Ein gieriger
Ausbau der vier Faehigkeiten, die auf Daedalus ueberhaupt wirken - Blade's
Intuition, Digital Observer, Reaper, Evasive System, alle mit `costInc` 2,1 -
erreicht 0,90 bei den Stufen 178 / 181 / 146 / 139 und kostet **84.441
Skillpunkte = 253.323 Rang = 2,8 Stunden** bei der heutigen Rate. Der Rang ist
also nicht in einer Stunde erledigt, sondern traegt den Rest des Knotens.

**Zurueckgenommen wird ausserdem die Zahl 0,220** aus dem Sofort-Punkt. Sie
stammte aus einer Hochrechnung ueber Deckards gemeldete Chance; der gemeldete
Bereich ist fuer Black Ops aber unbrauchbar (siehe den Kommentar in
`blackOpChance`). Der wahre Wert ist 0,1274.

Erledigt in `src/blade.js` (Kommentarblock bei `CHANCE_SKILLS`) und
`data/blade.json` (neues Feld `boChancen`).

---


### Der Einbauzeitpunkt preist den Wiederaufbau nicht ein (erledigt 28.08., 13:15)

Der Punkt verlangte eine Bedingung, die in den Kampfknoten fragt: **Wieviel
Rang je Minute gebe ich auf, und wie lange?** Sie steht jetzt in
`src/bn4rep.js`, in zwei Stufen.

**Stufe 1 (10:12, Commit `d7cb290`):** Der Spendenrecht-Zweig darf in BitNode 6
und 7 nicht mehr an der Mindestwarteschlange vorbei. Genau daran lag der Einbau
vom 05:53, der **ein einziges Stueck** einbaute und 3 h 49 min Wiederaufbau
kostete.

**Stufe 2 (13:15, dieser Lauf):** Ein Einbau im Kampfknoten verlangt jetzt, dass
mindestens ein wartendes Stueck den Wiederaufbau ueberhaupt **verkuerzt**.
Verkuerzen kann das nur, wer auf die Kampfwerte oder die Ausdauer wirkt -
`strength`, `defense`, `dexterity`, `agility` samt `_exp`,
`bladeburner_max_stamina`, `bladeburner_stamina_gain`. Alles andere zahlt die
Pause, ohne sie zu verkuerzen.

Warum das kein theoretischer Punkt ist: In der Warteschlange liegt
`Hyperion Plasma Cannon V2`, und sein **einziger** Multiplikator ist
`bladeburner_success_chance: 1.08`
(`Augmentation/Augmentations.ts:964-974`). Die Erfolgschancen stehen aber schon
bei 1,000 - alle sechs Operationen und alle drei Vertraege
(`data/bbspann.json`, 12:56), weil `getSuccessChance` mit
`Math.min(1, competence/difficulty)` klemmt (`Actions/Action.ts:196`). Die acht
Prozent wirken damit nur auf Black Ops und heben die naechste (Deckard) von
0,719 auf 0,777 - weiterhin unter der Feuerschwelle 0,90. Dafuer waeren bei der
Rate von 13:02 (354 Rang/min ueber 49 Minuten) rund **81.000 Rang** Pause zu
zahlen, gut ein Drittel des Restwegs von 214.361.

**Verifiziert: `wiederaufbauHilfe: false` um 13:10** (`data/einbau.json`, sechs
Messungen im 15-Sekunden-Takt). Das Gate liest `getAugmentationStats` fuer jedes
wartende Stueck aus dem laufenden Spiel und stuft die tatsaechliche
Warteschlange korrekt als nutzlos fuer den Wiederaufbau ein.

**Was NICHT bewiesen ist, und das gehoert dazu:** Keine der beiden Sperren hat
bisher einen Einbau tatsaechlich verhindert, weil keine ihrer
Ausloesebedingungen eingetreten ist - `spendenrechtFaellig` war den ganzen Tag
`false`, und `wartend` steht bei 1 gegen eine Mindestwarteschlange von 3. Beide
Zustaende stehen in `data/einbau.json` (`gesperrt`, `gesperrtOhneHilfe`), damit
der Nachweis kommt, wenn der Fall eintritt. Bei einem Fehler in der
`getAugmentationStats`-Abfrage faellt das Gate bewusst auf `true` zurueck: Eine
Sperre, die aus einem Fehler heraus greift, waere schlimmer als ein Einbau
zuviel.

Zwei Annahmen aus dem urspruenglichen Punkt bleiben widerlegt: Der Einbau
ruiniert die Bevoelkerungsschaetzung **nicht**
(`Bladeburner.prestigeAugmentation()` macht nur `resetAction()` +
`joinFaction()`, `Bladeburner.ts:259-263`), und der Wiederaufbau dauerte nicht,
bis die Kampfwerte reichten, sondern bis die Schaetzung reichte.

Commit: siehe `git log src/bn4rep.js`.

---

### Raid bietet 1.378 Rang je Minute - real sind es 124 (erledigt 28.08., 12:51)

Der Verlust lag **nicht** bei der Ausdauer, wie der Punkt vermutete, sondern bei
Diplomacy - und die Ursache war ein Zweig in `waehle()`, der Raid zurueckgab,
BEVOR `beste()` ueberhaupt gefragt wurde. Er umging damit genau die Rechnung,
die den Chaos-Zuschlag enthaelt.

Gemessen 12:38 aus `data/aktionen.txt` (50 Abschnitte, 125 protokollierte
Minuten von 08:12 bis 12:35):

    General/Diplomacy                    71,0 min   56,8 %       0 Rang
    Contracts/Bounty Hunter              13,1 min   10,4 %   2.061
    Contracts/Tracking                   12,3 min    9,8 %     618
    Operations/Stealth Retirement        11,3 min    9,0 %   4.209
    Operations/Raid                       7,9 min    6,3 %  10.124
    General/Hyperbolic Regeneration       2,8 min    2,3 %       0
    Black Operations/Operation K          2,4 min    1,9 %     746
    General/Field Analysis                2,3 min    1,9 %       0
    Black Operations/Red Dragon           2,0 min    1,6 %     469

**Die Ausdauerkammer war 2,3 Prozent.** Damit ist der im Punkt vorgeschlagene
Ansatz widerlegt: Die Spalten `arbeitsanteil` und `zyklusrate` in
`data/bbspann.json` rechnen mit der Ersatzregeneration 2,3/min
(`regenerationQuelle: "Vorgabe"`) und ueberschaetzen den Ausdauerdruck um mehr
als das Zwanzigfache - die Ausdauer stand um 12:40 bei 949 von 949. Sie taugen
als Auswahlkriterium nicht und werden weiterhin nicht benutzt.

Die uebersprungene Rechnung, mit `data/bbspann.json` von 12:40 (alle Chancen
bei 1,000):

    Raid           Stufe 17   252,7 Rang je Lauf,  11 s
                   Chaos +1 bis +5 % (`Bladeburner.ts:844`), im Mittel 3 %.
                   Diplomacy senkt bei Charisma 309 um 1,603 % je 60 s
                   (`:735-743`), macht 1,87 Laeufe = 112 s.
                   -> 252,7 Rang je 123 s = **123 Rang/min**
    Assassination  Stufe 20   530,4 Rang je Lauf,  29 s
                   Chaos -5 bis +5 % (`:859`), im Mittel **null**.
                   -> **1.097 Rang/min**, Faktor 8,9

Der zweite Posten wiegt schwerer als der erste: Raid nimmt der Stadt je Erfolg
**ein Prozent der Bevoelkerung** (`:831-834`) und eine Gemeinde, Assassination
genau **einen Kopf** (`:855-858`). Die Bevoelkerung geht ueber `(pop/1e9)^0,7`
in jede Erfolgschance ein. Raid frisst also die Grundlage aller anderen
Aktionen - dieselbe Ursache, an der heute frueh Chongqing gestorben ist
(popEst 0 um 11:10) und an der New Tokyo gerade starb: **1.532 Mio um 11:03,
223 Mio um 12:40.** Deshalb war auch Stealth Retirement nicht mehr waehlbar
(`SR_POP_MIN` 0,8e9), und der Motor fiel auf Diplomacy zurueck.

Aenderung: Der Raid-Vorrangzweig ist ersatzlos gestrichen. Raid steht in
`OPERATIONEN` und wird von `beste()` mitbewertet, Chaos-Zuschlag inklusive -
gewinnt es dort, kommt es weiter dran (und tat es um 12:49:18 auch einmal).

**Verifiziert: 857 Rang/min um 12:51** (102.082 um 12:47:25 auf 105.366 um
12:51:15, 230 s, `data/blade.json` im 15-Sekunden-Takt). Vorher lagen die
geglaetteten Fenster bei 118,4/min (61 min) und 130,7/min (121 min). **Faktor
6,6.** In diesen vier Minuten lief kein einziger Diplomacy-Lauf.

Fallstrick, der zwei Minuten gekostet hat: Die Bruecke schiebt `src/`
automatisch nach, aber `blade.js` lief unveraendert weiter - um 12:46 stand
noch "Raid, Chance 1.000" als Grund, ein String aus dem geloeschten Zweig.
Erst `pushFile data/reload.txt` mit `WERKZEUG blade.js` hat den Prozess
ersetzt. **Ein Dateiabgleich ist kein Neustart.**

Commit: siehe `git log src/blade.js`.

---

### WIDERLEGT: Die Black-Op-Schwelle 0,90 ist richtig (28.08., 12:12)

Der Sofort-Punkt von 12:05 behauptete, `blackOpSchwelle()` blockiere Operation
K unnoetig: Erwartungswert +664 Rang je Versuch, Break-even bei p* = 0,074,
und trotzdem Schwelle 0,90. **Die Rechnung war unvollstaendig - es fehlte
genau der Posten, den ich der alten Fassung vorgeworfen hatte: die ZEIT.**

**Die Aktionsdauer, hergeleitet statt geschaetzt** (`Actions/Action.ts:105-121`):

    baseTime = difficulty / DifficultyToTimeFactor(10)
    baseTime = baseTime * skillFac / statFac
    Ergebnis * getActionTimePenalty()          (bei Black Ops 1,5)

`statFac` laesst sich aus einer gemessenen Aktion rueckrechnen. Raid steht auf
Stufe 14, also `difficulty` = 800 x 1,045^13 = 1.418, `baseTime` = 141,8 s -
gemessen sind **10 s** (`bbspann.js`, 12:08). Mit `skillFac` = 0,10
(Overclock 90) folgt `statFac` = **1,418**.

Fuer Operation K (`baseDifficulty` 15.000, Black Ops sind einstufig):

    baseTime  = 1.500 s
    x 0,10 / 1,418 = 105,8 s
    x 1,5 (Black-Op-Aufschlag) = **158,7 s = 2,6 Minuten**

    Ertrag = (0,895 x 750 - 0,105 x 60) / 2,6 min = **256 Rang/min**

**Die Alternative bringt 1.378.** Raid steht bei 1.378,5 Rang je Minute, und
der Motor kann sie fahren (Spanne `min 1`). Die Schwelle 0,90 kostet also
keinen einzigen Rang - sie haelt den Motor bei der **besseren** Aktion.

**Was die Schwelle sehr wohl kostet, ist Knotenfortschritt** (8 von 21 Black
Ops). Aber der Ausgang verlangt Rang 400.000 fuer Daedalus, und solange der
Rang das Nadeloehr ist, ist Rang machen und die Black Op spaeter mit hoeherer
Chance fahren die richtige Reihenfolge.

**Die Lehre, und sie trifft mich zweimal am selben Tag:** Um 07:49 habe ich
der alten Schwelle vorgeworfen, nur den Gewinn zu zaehlen. Um 12:05 habe ich
denselben Fehler gemacht - Erwartungswert je VERSUCH gerechnet statt je
ZEIT, und die Alternative gar nicht angesehen. Eine Rate ohne Nenner ist
keine Rate.

**Der Befund, der dabei herausfiel, ist der groessere** und steht jetzt oben
in `## Sofort`: Raid bietet 1.378 Rang/min, die tatsaechliche Rate ist 124.
Faktor 11.

<details><summary>Der urspruengliche Eintrag</summary>

### Die Black-Op-Schwelle nimmt das Maximum - die Raid-Zahl blockiert die Rechnung (12:05)

Gemessen: Operation K haengt seit **11:03** knapp unter der Schwelle:

              11:03  Chance 0,856     11:33  0,889
              11:11  0,858            12:03  **0,894**   Schwelle 0,90

          Eine Stunde lang fast dran, und die Kampfwerte steigen kaum noch
          (272 auf 273 in zwanzig Minuten). Aus eigener Kraft kommt sie nicht
          mehr ueber 0,90.

Erwartet: Sie sollte laengst gefahren werden. Operation K hat `rankGain` 750
          und `rankLoss` 60 (`BlackOperations.ts`). Bei Chance 0,894:

              0,894 x 750  -  0,106 x 60  =  **+664 Rang je Versuch**

          Der Break-even liegt bei p* = 60/810 = **0,074**. Die Aktion ist
          also seit Stunden hoch profitabel und wird von einer Zahl
          aufgehalten, die mit ihr nichts zu tun hat.

Verdacht: `src/blade.js`, `blackOpSchwelle()`. Sie gibt
          `Math.max(vorrat, einsatzSchwelle(name))` zurueck. `einsatzSchwelle`
          rechnet richtig - fuer Operation K ergaebe sie
          `p* + 0,25 = 0,324`. Aber `vorrat` ist bei vollem Raid-Bestand
          pauschal `SICHER_BLACKOP` = 0,90, und das Maximum gewinnt.

          **Die Rechnung von 07:49 wirkt damit nur nach oben, nie nach
          unten.** Sie sollte Vindictus schuetzen (dort `rankLoss` = `rankGain`,
          Schwelle 0,75) - und tut das auch. Aber sie kann eine zu hohe
          pauschale Schwelle nicht korrigieren, und genau das waere hier
          richtig.

          Sauber waere, die einsatzabhaengige Schwelle die **fuehrende** zu
          machen und den Raid-Vorrat nur noch als Untergrenze zu benutzen -
          oder ihn ganz zu streichen. Ein Raid-Vorrat sagt nichts darueber
          aus, ob eine Black Op sich lohnt; er war ein Ersatzmass aus der
          Zeit, als niemand `rankGain` gegen `rankLoss` gerechnet hat.

Dringlichkeit: **hoch.** Operation K bringt 750 Rang und schaltet Deckard
          frei; sie liegt seit einer Stunde brach.

</details>

---

### Der Gym-Zweig kennt jetzt die Black Ops - und der Verdacht war trotzdem falsch (28.08., 11:41)

Der Sofort-Punkt von 09:03 meldete: `spann.js` zeigte Operation Red Dragon mit
Chance **0,905 - 1,000**, die Untergrenze also ueber `SICHER_BLACKOP` (0,90) -
und der Motor stand im Gym, ohne die Black Op geprueft zu haben.

**Die Ursache war echt und ist behoben** (Commit `a5c46d0`): Der Gym-Zweig
steht vor `waehle()` und entschied allein an `lohntSich`, das nur
`OPERATIONEN` und `VERTRAEGE` kannte. Der Black-Op-Zweig steht als Punkt 2 in
`waehle()` und wurde im Gym-Fall nie erreicht. `lohntSich` prueft jetzt auch
die naechste Black Op, mit der **gerechneten** Chance und `blackOpSchwelle()`
- also derselben Zahl und derselben Schwelle wie `waehle()`.

**Der Verdacht selbst war aber falsch, und das ist der lehrreiche Teil.** Nach
dem Einbau der Pruefung waehlte der Motor weiter das Gym. Damit ist belegt,
dass Red Dragons **gerechnete** Chance zu diesem Zeitpunkt unter 0,90 lag -
die 0,905 der Schaetzung waren Bevoelkerungsrauschen, genau wie es der
Kommentar in `blade.js` seit dem 27.08. sagt
(`Actions/BlackOperation.ts:55-61`: `getPopulationSuccessFactor` gibt bei
Black Ops fest 1 zurueck, die Spanne ist ein Anzeigeartefakt).

**Verifiziert 09:55:** Operation Red Dragon ist gefallen, nachdem die
Sackgasse von 09:42 aufgeloest war - 8 von 21 Black Operations, Rang 82.299
auf 82.770. Der Zweig hat also seither mindestens einmal richtig entschieden.

**Was daraus fuer die Fehlersuche folgt:** Eine Schaetzspanne ist kein Beweis.
Wer aus `s.min` auf "haette fahren koennen" schliesst, muss vorher pruefen, ob
`s.min` fuer diese Aktionsart ueberhaupt etwas bedeutet.

Commits: `a5c46d0`, Sackgasse `5809d76`

<details><summary>Der urspruengliche Eintrag</summary>

### Der Gym-Zweig kennt die Black Ops nicht - Red Dragon koennte fahrbar sein (09:03)

Gemessen: `node tools/spann.js` um 09:03:

              Naechste Black Op  Operation Red Dragon (Rang 25.000, erfuellt)
              Chance             **0,905 - 1,000**, Spanne 0,095

          Die Untergrenze der Schaetzung liegt damit **ueber** `SICHER_BLACKOP`
          (0,90). Gleichzeitig steht `data/blade.json` auf `"Gym/str"`,
          Grund "nichts ueber Schwelle" - der Motor hat die Black Op gar nicht
          erst geprueft.

Erwartet: Der Bot sollte Red Dragon starten. Sie bringt `rankGain` 500
          (`BlackOperations.ts:254`) und ist die achte von 21 - der Restweg
          haengt an ihr.

Verdacht: **Mein eigener Eingriff von 08:40**, `src/blade.js`, Gym-Zweig in
          der Hauptschleife. Er steht **vor** `waehle()` und entscheidet
          allein an `lohntSich` - und `lohntSich` prueft nur `OPERATIONEN`
          (gegen 0,85) und `VERTRAEGE` (gegen 0,45). **Black Ops kommen darin
          nicht vor.** Der Black-Op-Zweig steht als Punkt 2 in `waehle()`,
          und `waehle()` wird im Gym-Fall nie erreicht.

          Damit gilt: Sobald die naechste Black Op fahrbar wird, waehrend
          keine Operation und kein Vertrag ueber ihrer Schwelle liegt, bleibt
          der Bot im Gym haengen. Genau dieser Zustand liegt jetzt vor.

          Der Fix ist klein: `lohntSich` um die naechste Black Op ergaenzen,
          mit derselben gerechneten Chance und derselben Schwelle, die
          `waehle()` benutzt (`blackOpChance()` gegen `blackOpSchwelle(name)`,
          nicht `s.min` - die Spanne ist bei Black Ops
          Bevoelkerungsrauschen, `Actions/BlackOperation.ts:55-61`).

**Dieselbe Fehlerform zum dritten Mal heute:** Eine Regel prueft ihre
Voraussetzung nicht vollstaendig. 07:49 wich blade.js an bbtrain, das gar
nicht uebernahm; 08:03 lief Field Analysis, ohne zu fragen, ob sie etwas
aufschliesst; jetzt entscheidet der Gym-Zweig ueber "nichts zu tun", ohne die
wichtigste Aktion des Knotens anzusehen. **Wer eine Abkuerzung vor die
Hauptlogik legt, muss deren Vorbedingungen mitnehmen.**

Dringlichkeit: **hoch.** Rangrate 0,0/min ueber 30 Minuten.

</details>

---

### Chongqing war ausgebrannt - popEst 0, und der Motor sass darin fest (28.08., 11:12)

Der Punkt fragte, was ein Stadtwechsel kostet. Die Antwort war eine andere und
eine bessere: **Die Stadt, in der der Motor sass, war tot.**

Gemessen 11:03 (`src/bbspann.js`), alle sechs Staedte:

    Stadt        Chaos   Faktor   breiteste Spanne   popEst    Wert
    Chongqing    52,83     1,96              0,797        0       0   <- hier
    New Tokyo   106,39     7,58              0,144  1.532 Mio     202
    Sector-12    73,03     4,90              0,144    976 Mio     199
    Volhaven    205,69    12,52              0,797  1.577 Mio     126
    Aevum        88,13     6,26              0,050    748 Mio     119
    Ishima      134,34     9,24              0,270    810 Mio      88

**Chongqings geschaetzte Bevoelkerung war null.** Der Motor sass dort, weil
das Chaos am niedrigsten war - aber das Chaos ist niedrig, WEIL nichts mehr
los ist. Die Stadt war leergeraeumt.

**Und sie war nicht heilbar.** `getSuccessRange` rechnet
`r = city.pop / city.popEst`; bei 0 wird daraus NaN, der Code setzt `r = 0`,
und `low *= r` macht `s.min` **immer null** (`Actions/Action.ts`). Damit ist
JEDE Operation und JEDER Vertrag unfahrbar, unabhaengig von Kampfwerten,
Faehigkeiten und Ausdauer.

Field Analysis kommt dagegen nicht an - und das ist der Grund, warum sie
heute frueh eine Stunde lang nichts gebracht hat:

    improvePopulationEstimateByPercentage(p):        (City.ts:46-58)
      popEst = (popEst + p) * (1 + p/100)

Bei `p` = 1,25 waechst das aus der Null heraus um **1,27 je Durchlauf** und
verdoppelt sich alle 56. Von dort auf eine Milliarde sind rund **1.700
Durchlaeufe, also 14 Stunden**. Die Regel, die um 08:14 einen Deckel von zehn
Minuten bekam und um 09:42 auf 45 erhoeht wurde, haette also in keiner Fassung
gereicht - das Problem war nie die Dauer.

**Die neue Regel** bewertet jede Stadt mit Bevoelkerung geteilt durch den
Chaos-Faktor `sqrt(1 + chaos - 50)` (`Actions/Action.ts:94-101`) und wechselt
bei doppeltem Vorsprung. `getCityEstimatedPopulation` und `getCityChaos` gehen
fuer FREMDE Staedte, es braucht also keinen Probewechsel.

**Verifiziert 11:12**, zwei Minuten nach dem Neustart:

    Division                New Tokyo (Wert 202)
    data/blade.json         "Operations/Stealth Retirement Operation",
                            Stufe 11, Chance 1,000
    Rangrate                +955 in 3 Minuten = **318/min**
    davor                   57,8/min ueber 30 Minuten

Das ist die erste fahrbare Operation seit dem Einbau um 05:53 - und der beste
Wert seit der Nacht.

**Was der Punkt richtig geahnt und falsch benannt hat:** Er sprach von einer
"ungepflegten Schaetzung nach einem Stadtwechsel". Der Wechsel war nicht die
Ursache; die leergeraeumte Stadt war es. Die Rundreise hat den Motor dorthin
gebracht, weil sie nach Raid-Vorrat waehlt - und Raid ist genau die Aktion,
die eine Stadt leerraeumt (`Bladeburner.ts:836`, jeder Erfolg verbraucht eine
Gemeinde und senkt die Bevoelkerung). **Die Rundreise hat sich ihre eigene
Sackgasse gebaut.** Dass ihre Schwelle um 10:42 von 10 auf 55 Gemeinden stieg,
war deshalb richtig, aber aus dem falschen Grund.

Commit: `e22bc89`

<details><summary>Der urspruengliche Eintrag</summary>

### Der Stadtwechsel der Division bringt eine unbrauchbare Schaetzung mit

Gefunden am 28.08., 10:10. Die Division stand am Morgen in **Chongqing**,
und dort war die Bevoelkerungsschaetzung nie gepflegt: Gemessen 09:40
(`src/bbspann.js`) standen **alle sechs** Operationen bei [0,000 - 1,000].
Der Motor entscheidet an `s.min` und fand deshalb 87 Minuten lang nichts zu
tun.

Die Schaetzung ist **je Stadt** gespeichert und ueberlebt einen
Augmentierungs-Einbau (`Bladeburner.prestigeAugmentation()` fasst die Staedte
nicht an). Wer die Stadt wechselt, aktiviert also eine Schaetzung, an der
niemand gearbeitet hat - und zahlt mit der Zeit, die Field Analysis braucht,
um sie wieder scharf zu bekommen.

Gewechselt wird an zwei Stellen:
    `src/blade.js:1554`    die Raid-Rundreise, nach `comms` je Stadt
    `src/bbspann.js:266`   das Messwerkzeug (kehrt bei :324 zurueck)

**Die Rundreise rechnet den Schaetzungsverlust nicht mit.** Sie vergleicht
allein den Raid-Vorrat. Sauber waere, die Kosten des Wechsels zu beziffern -
die Zeit bis zur brauchbaren Schaetzung mal die entgangene Rangrate - und sie
gegen den Gewinn an `comms` zu stellen.

**`bbspann.js` ist unschuldig - geprueft 10:38.** `switchCity` setzt
ausschliesslich `bladeburner.city` (`NetscriptFunctions/Bladeburner.ts:314-319`),
es fasst weder `popEst` noch sonst etwas an. Das Messwerkzeug veraendert den
Messgegenstand nicht.

**Teilerledigt 10:42: `RUNDREISE_MIN_COMMS` von 10 auf 55.** Die alte Schwelle
zaehlte nur den Gewinn. Die Rechnung jetzt vollstaendig:

    Gewinn je Gemeinde   Raid rankGain 55 x rewardFac 1,1^13 (Stufe 14) = 190
    Kosten je Wechsel    45 min Field Analysis x 226 Rang/min        = 10.170
    Break-even                                                   54 Gemeinden

Das schaltet die Rundreise in der Praxis fast ab - und das ist die ehrliche
Folgerung: Bei den zuletzt gemessenen Bestaenden (Aevum 49, Ishima 42,
Volhaven 17) war sie schon immer defizitaer, nur hat es niemand ausgerechnet.

**DER GROESSERE HEBEL LIEGT NOCH OFFEN, und die Zahlen dafuer stehen schon da.**
`data/bbspann.json` misst die Schaetzungsguete JEDER Stadt (10:38-Messung von
09:40):

    Sector-12   alle Spannen 0,000   perfekt scharf   Chaos 67,42
    Aevum       0,006 bis 0,016      sehr scharf      Chaos 88,31
    Volhaven    0,54 bis 0,78        schlecht
    Chongqing   alle bei [0,000-1,000]                <- hier stand die Division

**Der Motor haette nicht eine Stunde schaerfen muessen, er haette wechseln
koennen** - `switchCity` kostet null Sekunden. Die Stadtwahl kennt aber nur
den Raid-Vorrat und (an anderer Stelle) das Chaos, nicht die Schaetzungsguete.

Was dafuer noch zu klaeren ist: Der Wechsel muss Chaos UND Schaetzung
gegeneinander abwaegen - Sector-12 ist scharf, hat aber Chaos 67, und ueber 50
schlaegt `sqrt(1+chaos-50)` auf die Schwierigkeit jeder Aktion
(`Actions/Action.ts:94-101`). Ein halbgarer Wechsel waere schlimmer als
keiner. Die Probe selbst ist billig: kurz hinwechseln, `spanne()` lesen,
zurueckwechseln - ohne `await` dazwischen, sonst rechnet das Spiel eine
Aktion in der falschen Stadt ab.

Dringlichkeit: mittel-hoch. Der Fall kostet ein bis zwei Stunden je Wechsel.

</details>

---

### blade.js fuehrt das Gym jetzt selbst - Faktor 13,5 auf den Wiederaufbau (28.08., 08:42)

**Verifiziert 08:42 ueber 89 Sekunden**, unmittelbar nach dem Neustart:

    Kampfwert-Tiefstand (def)   228 -> 230   in 89 s   =  1,35/min
    davor, Bladeburner-Training 223 -> 225   in 20 min =  0,10/min
                                                       ** Faktor 13,5 **

`data/blade.json` meldet `"aktion":"Gym/def"`, Grund "nichts ueber Schwelle,
Powerhouse statt Bladeburner-Training (Tiefstand 227)". Die Pruefzeile zeigt
"Arbeit def @ Powerhouse Gym".

**Der Weg dahin ging ueber einen eigenen Irrtum, und der gehoert dazu.**

  07:00  Gym-Hebel eingebaut, Begruendung: der Arbeitskanal laufe **parallel**
         zur Bladeburner-Aktion. Falsch. `Bladeburner.ts:178-180` ruft in
         `startAction()` ein `Player.finishWork(true)`, und `process()`
         bricht umgekehrt die Bladeburner-Aktion ab, sobald `currentWork`
         gesetzt ist (`:1353-1360`) - beides nur ohne
         `The Blade's Simulacrum`.
  07:34  Zurueckgenommen (`9703d3c`), kein Messwert hatte sich bewegt.
  08:33  Nachgemessen im Zustand nach dem Einbau: Der Motor faehrt
         `General/Training`, die Rangrate steht bei **0,1 je Minute** ueber
         44 Minuten.

Damit dreht sich die Rechnung. Der Ausschluss ist real, aber der Einsatz ist
es auch: Solange nichts ueber seiner Schwelle liegt, ist die
Bladeburner-Aktion **0,1 Rang je Minute** wert. Dafuer den zehnfachen
Erfahrungssatz aufzugeben waere teuer - andersherum ist es billig. Das Gym ist
hier kein Parallelbetrieb, sondern ein **Tausch**.

**Warum blade.js es selbst tut und nicht bbtrain.** Eine Uebergabe zwischen
zwei Skripten ist an genau dieser Stelle zweimal gescheitert: am 28.08. um
01:33 haben sich beide die Figur im Minutentakt weggenommen, um 07:49 hat
keines von beiden gearbeitet. Wer weicht, muss wissen, dass jemand uebernimmt
- am sichersten weiss man das, wenn man selbst uebernimmt. Der
`!lohntSich`-Zweig ist damit zurueck, aber mit einem Uebernehmer.

**Drei Bedingungen, jede aus einem frueheren Schaden:**
- Konto ueber 5 Millionen. Das Powerhouse kostet 2.400 je Sekunde und prueft
  den Kontostand nicht - am 27.08. stand das Konto deshalb bei -3 Millionen.
- Fremde Arbeit hat Vorrang. Laeuft etwas anderes als unsere Gym-Einheit im
  Arbeitskanal (bn4rep arbeitet fuer Faktionen), wird nichts angefasst.
- Schlaegt das Gym fehl - Konto leer, fremde Arbeit, Reise misslungen -,
  laeuft der Motor normal weiter und faellt auf Bladeburner-Training zurueck.
  Besser langsam als gar nicht.

**Was offen bleibt:** Der Tausch ist eine Notloesung fuer den Wiederaufbau.
Sauber waere `The Blade's Simulacrum` (repCost 1.250, moneyCost 1,5e11,
`Augmentations.ts:284-297`) - damit laufen beide gleichzeitig. Reputation ist
kein Thema, Geld ist das Tor: 3,9 Mrd bei rund 3 Mrd je Stunde.

Commit: `(siehe git log)`

<details><summary>Der urspruengliche Eintrag</summary>

### Das Gym ist im Wiederaufbau der bessere Tausch - als ERSATZ, nicht parallel (08:33)

Gemessen: `data/blade.json` steht seit dem Deckel-Eingriff auf
          `General/Training`, Grund "zu schwach" - das ist die richtige
          Aktion, aber die langsame. Ueber 44 Minuten:

              Rangrate                 0,1/min   (44 min, geglaettet)
              Rangrate 4-h-Mittel    163,1/min
              Kampfwert-Tiefstand      225, plus rund 0,2/min

          Bladeburner-Training gibt 30 Erfahrung je 30 Sekunden auf alle vier
          Werte (`Bladeburner.ts:1091-1105`), also Ortsmultiplikator **1**.
          Das Powerhouse Gym in Sector-12 hat **10** (`LocationsMetadata.ts`).

Erwartet: **Der Verzicht kostet derzeit 0,1 Rang je Minute.** Genau das ist
          der Punkt: Am 07:34 wurde der Gym-Hebel zurueckgenommen, weil
          `Bladeburner.ts:178-180` und `:1353-1360` beweisen, dass Arbeit und
          Bladeburner sich ohne `The Blade's Simulacrum` ausschliessen. Die
          Ruecknahme war richtig - die Begruendung "laeuft parallel" war
          falsch. Aber im Zustand "blade.js faehrt ohnehin nur Training" ist
          das Gym kein Parallelbetrieb mehr, sondern ein **Ersatz** - und der
          rechnet sich: Faktor 10 auf die Kampferfahrung gegen 0,1 Rang je
          Minute.

Verdacht: Kein Fehler im Code, sondern eine fehlende Regel. Sauber waere:
          Waehlt `waehle()` `General/Training` (Grund "zu schwach"), soll
          `blade.js` die Figur an bbtrain abgeben - dieselbe Weiche wie bei
          `tiefstand < BBTRAIN_ZIEL`, nur mit dem Training-Fall als zweitem
          Ausloeser. Und `bbtrain.js` muss dann auch oberhalb von `ZIEL`
          trainieren, was der zurueckgenommene Commit `41fa473` schon konnte.

          **Vorsicht, das ist der Sackgassen-Kandidat:** Beide Skripte duerfen
          nicht wieder anfangen, sich die Figur gegenseitig wegzunehmen (das
          war der Vorfall vom 28.08., 01:33). Die Uebergabe braucht genau eine
          Richtung: blade.js weicht, bbtrain uebernimmt, und blade.js kommt
          erst zurueck, wenn wieder eine Aktion ueber ihrer Schwelle liegt.

Dringlichkeit: **hoch.** Es ist der einzige Posten, der die ETA gerade
          bestimmt - 0,1 statt 163 Rang je Minute.

**Der langfristige Ausweg steht schon fest und ist kaufbar:**
`The Blade's Simulacrum` (repCost 1.250, moneyCost 1,5e11,
`Augmentations.ts:284-297`) hebt den Ausschluss auf. Geld ist das Tor: 3,8
Mrd bei rund 3 Mrd je Stunde, also gut 50 Stunden - zu lang, um darauf zu
warten, aber ein Kandidat fuer die naechste Augmentierungsrunde.

</details>

---

### Field Analysis gedeckelt - der Motor trainiert wieder (28.08., 08:33)

Der Sofort-Punkt von 08:03 ist nachgemessen und erledigt.

**Verifiziert 08:33:** `data/blade.json` steht auf
`"aktion":"General/Training"`, Grund "zu schwach" - der Zehn-Minuten-Deckel
von 08:14 hat gegriffen, wie vorhergesagt. Vorher lief Field Analysis von
07:52 bis 08:24 durch, 32 Minuten fuer sechs Rang.

Zwei Aenderungen trugen (Commit `6bd4d98`):

1. **Freigabe-Bedingung statt Spannenbreite.** Field Analysis laeuft nur noch,
   wenn das Schaerfen eine Aktion aufschliesst
   (`s.max >= schwelle && s.min < schwelle`). Verifiziert schon um 08:09 am
   Grund-Text: "Schaetzung verdeckt Investigation (0.00-1.00 gegen 0.85)".

2. **Deckel nach der Uhr, nicht nach Durchlaeufen.** `waehle()` wird je
   Aktualisierung gerufen, nicht je Aktionsdurchlauf - ein Zaehler haette die
   Schleifenfrequenz gemessen. Zehn Minuten am Stueck, danach dreissig Minuten
   Sperre gegen das Pendeln.

**Warum die Freigabe-Bedingung allein nicht gereicht haette**, und das ist der
eigentliche Fund: Bei schlechter Bevoelkerungsschaetzung liefert
`getSuccessRange` fuer **jede** Aktion [0,00-1,00] - `low = real - diff`
klemmt auf 0, sobald `diff` groesser als `real` ist
(`Actions/Action.ts`). Die Bedingung ist dann immer wahr, und die Regel
bindet sich selbst nicht. Dazu ist das Schaerfen langsam:
`eff = 0,04*hacking^0,3 + 0,04*int^0,9 + 0,02*cha^0,3`
(`Bladeburner.ts:1122-1131`), und in BitNode 6 mit
`HackingLevelMultiplier` 0,35 ist der Hacking-Summand klein.

**Was der Eingriff NICHT geloest hat:** Der Motor trainiert jetzt, aber mit
Ortsmultiplikator 1 statt der 10 des Powerhouse Gym. Die Rangrate steht bei
0,1/min. Das ist der Nachfolgepunkt oben in `## Sofort`.

<details><summary>Der urspruengliche Eintrag</summary>

### Field Analysis blockiert den Wiederaufbau - 12 Minuten bei 0,2 Rang je Minute (08:03)

Gemessen: `data/blade.json` steht seit **07:52** auf
          `General/Field Analysis`, Grund "Schaetzung unsicher". Der Rang
          bewegte sich in dieser Zeit von 82.293 auf 82.295 -
          **+2 in 12 Minuten**, also 0,17/min. Die geglaettete 45-Minuten-Rate
          ist dadurch auf **12,0/min** gefallen (`data/verlauf-strategie.json`),
          gegen 218,6/min im Vier-Stunden-Mittel.

Erwartet: Waehrend eines Wiederaufbaus nach einem Einbau ist nicht die
          Schaetzung der Engpass, sondern die Kampfwerte. Bladeburner-Training
          (gratis, `Bladeburner.ts:1091-1105`, hebt alle vier Werte) traegt
          dort mehr als Field Analysis - die bringt `rankGain` 0,1 und
          **keine** Kampferfahrung. Der Motor sollte also Training fahren,
          solange die Kampfwerte unter dem liegen, was die erreichte
          Aktionsstufe verlangt.

Verdacht: `src/blade.js:1959-1966`, Regel 4 in `waehle()`:

              for (const name of [...OPERATIONEN, ...VERTRAEGE]) {
                const s = spanne(...);
                if (s.max - s.min > SPANNE_ZU_BREIT) return Field Analysis;
              }

          `SPANNE_ZU_BREIT` = 0,10 (`blade.js:257`). Die Regel steht **vor**
          dem Training-Rueckfall und kennt keine Gegenrechnung: Sie fragt, ob
          die Schaetzung unscharf ist, nicht, ob das Schaerfen sich gegen die
          Alternative lohnt.

          **Die Regel konvergiert immerhin** - die Spanne der naechsten
          Black Op fiel von 0,220 (07:08) auf 0,117 (08:03), die Chance stieg
          von 0,780 auf 0,883. Sie ist also nicht kaputt, nur teuer. Ein
          Abbruch nach fester Zeit oder ein Vergleich `Rang je Minute mit
          geschaerfter Schaetzung` gegen `Rang je Minute mit Training` waere
          die saubere Loesung.

          **Zusammenhang:** Der Zustand wurde durch den Fix von 07:53 erst
          sichtbar (vorher stand dort `General/keine`, also Leerlauf). Der Fix
          war richtig, deckt aber die naechste Schicht auf.

**Geaendert 08:14, Wirkung noch nicht gemessen** (Commit `6bd4d98`). Zwei
Aenderungen an Regel 4:

1. Sie fragt jetzt, ob das Schaerfen eine Aktion FREIGIBT
   (`s.max >= schwelle && s.min < schwelle`), statt nur nach der Breite der
   Spanne. **Verifiziert 08:09**: Der Grund lautet seither
   "Schaetzung verdeckt Investigation (0.00-1.00 gegen 0.85)".

2. Das allein bindet nicht: Bei schlechter Bevoelkerungsschaetzung liefert
   `getSuccessRange` fuer JEDE Aktion [0,00-1,00] (`Actions/Action.ts`:
   `low = real - diff` klemmt auf 0), die Bedingung ist dann immer wahr.
   Deshalb ein Deckel nach der Uhr - zehn Minuten am Stueck, danach dreissig
   Minuten Sperre. **Der Deckel greift fruehestens 10 Minuten nach dem
   Neustart von 08:14, also gegen 08:24. Das ist die offene Nachmessung:
   Steht `data/blade.json` dann auf `General/Training`?**

</details>

---

### Zwei Fehler in blade.js: die Schwelle ignorierte den Einsatz, die Weiche fuehrte ins Nichts (28.08., 07:53)

**1. Die Black-Op-Schwelle folgte dem Raid-Vorrat statt dem Einsatz.**

`blackOpSchwelle()` waehlte zwischen 0,90 und 0,40, und zwar danach, wieviel
Raid-Vorrat noch da ist - die Ueberlegung war: ist die Alternative schwach,
lohnt das Risiko. Fuer die fruehen Operationen stimmt das. Fuer die spaeten
nicht, denn `rankLoss` waechst schneller als `rankGain`:

    Nr  Operation      rankGain   rankLoss   p*      neue Schwelle
     8  Red Dragon          500         50   0,091        0,34
    18  Ultron           10.000      2.000   0,167        0,42
    19  Centurion        15.000      5.000   0,250        0,50
    20  Vindictus        20.000     20.000   0,500        0,75
    21  Daedalus         40.000     10.000   0,200        0,45

Bei **Vindictus** kostet ein Fehlschlag genau so viel Rang wie ein Erfolg
einbringt. Mit 0,40 waere der Erwartungswert dort **negativ**: 0,4 x 20.000
minus 0,6 x 20.000 = -4.000 je Versuch, bei 226 Rang je Minute rund achtzehn
Minuten. Der Bot haette sich in einer Schleife selbst zurueckgeworfen.

Die Untergrenze ist jetzt `p* + 0,25` mit `p* = rankLoss/(rankGain+rankLoss)`.
Der Abstand deckt den Posten ab, den die reine Rangrechnung uebersieht: die
**Zeit**, denn Black Ops haben `getActionTimePenalty()` 1,5
(`Actions/BlackOperation.ts:51-53`). Die Tabelle ist aus
`BlackOperations.ts` **erzeugt**, nicht abgetippt.

**Verifiziert 07:49** durch Nachrechnen aller 21 Werte; im Spiel aendert sich
vor Nr. 19 nichts, weil die Raid-Schwelle dort hoeher liegt. Commit `e6eb5dc`.

**2. Die Weiche fuehrte ins Nichts - und das war der eigentliche Fund.**

Beim Neustart nach Aenderung 1 meldete `data/blade.json`:

    "aktion": "General/keine"
    "grund":  "weicht bbtrain, Kampfwerte 223, nichts ueber Schwelle"

`blade.js:2041` wich der Figur, sobald `tiefstand < 100 || !lohntSich`. Der
Zweig `!lohntSich` (keine Operation ueber 0,85, kein Vertrag ueber 0,45)
stammt vom 28.08., 01:52 und ruht auf der Annahme, bbtrain uebernehme dann.
**Es uebernimmt nicht.** `bbtrain.js` ist ein Beitrittstor: Es trainiert bis
`ZIEL` (Vorgabe 100, `bbtrain.js:45`) und parkt danach. Der Zweig trifft
also genau dann zu, wenn der Wiederaufbau nach einem Einbau laeuft und die
Kampfwerte laengst ueber 100 stehen.

Gemessen 07:49, 1 h 56 min nach dem Einbau: Tiefstand 223, bbtrain geparkt,
blade.js gewichen. **Niemand hat gearbeitet** - 25 Rang je Minute gegen 226,5
im Vier-Stunden-Mittel. Zwei Skripte, die einander die Figur ueberlassen, und
die Figur stand still.

Die Weiche greift jetzt nur noch bei `tiefstand < BBTRAIN_ZIEL`, also wenn
bbtrain wirklich uebernimmt. Damit ist die gesamte Rueckfallkette in
`waehle()` wieder erreichbar, die der Zweig kurzgeschlossen hatte.

**Verifiziert 07:52**, unmittelbar nach dem Neustart:

    vorher    "General/keine"           - Leerlauf
    nachher   "General/Field Analysis"  - Grund "Schaetzung unsicher"

Field Analysis ist hier die richtige Wahl und begrenzt sich selbst: Sie laeuft
nur, solange irgendwo `s.max - s.min > SPANNE_ZU_BREIT` gilt
(`blade.js:1959-1966`), und genau das schliesst sie. Der Rangertrag ist dabei
klein (+1 in 2 Minuten) - **die Wirkung auf die Rangrate misst der naechste
Lauf**, sie ist noch offen.

**Die Lehre, und sie ist dieselbe wie um 07:34:** Beide Fehler entstanden
dadurch, dass eine Regel ihre eigene Voraussetzung nicht geprueft hat. Die
Schwelle prueft den Vorrat und nicht den Einsatz; die Weiche prueft, ob es
sich lohnt, und nicht, ob jemand uebernimmt. Beide Male stand die Antwort
zwei `grep` entfernt.

<details><summary>Der urspruengliche Eintrag zur Schwelle</summary>

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

</details>

---

### Typhoon-Punkt abgeraeumt: die Praemisse ist tot, der Auftrag darin erledigt (28.08., 07:10)

Der oberste Punkt der Arbeitsliste fragte, ob **Operation Typhoon** ueberhaupt
fahrbar sei - Chance 0,035 bis 0,038, und fuer 50 Prozent brauche es Faktor
19,6 in den Kampfwerten. Beides ist ueberholt:

    Typhoon gefallen      27.08., 19:51
    Black Ops gefallen    7 von 21
    naechste              Operation Red Dragon, Chance 0,780-1,000
    Rang                  80.593 von 400.000 = 20,1 %

**Die Frage war richtig gestellt und ist beantwortet.** Der Punkt hatte
korrekt hergeleitet, dass der Rang nicht in die Black-Op-Chance eingeht
(`competence / baseDifficulty`, Stadtwerte und Chaos zaehlen nicht) und dass
Rang 2500 kein Ausgang, sondern ein Zwischenschritt ist. Der Ausgang laeuft
ueber mehrere Augmentierungsrunden im selben Knoten - genau das ist seither
zweimal passiert (01:25 mit 25 Augmentierungen, 05:53).

**Der eingebettete Auftrag ist ebenfalls erledigt**, und zwar am selben Tag,
an dem er geschrieben wurde. Er lautete: "Eine Kampfwert-Liste analog zu
`lib/hackaugs.js` anlegen und `bn4rep.js` in den Kampfknoten (6 und 7)
danach priorisieren lassen."

    src/lib/hackaugs.js:204   COMBAT_AUGS - die Kampfwert-Liste
    src/lib/hackaugs.js:288   combatNutzen(name)
    src/bn4rep.js:1232-1242   KAMPF_GEWICHT = 10, nur fuer Knoten 6 und 7

Die Liste liegt in `hackaugs.js` statt in einer eigenen Datei, und das ist
Absicht: `bn4net.js` fuehrt die Dateiliste, ein zweites Modul haette dort
nachgetragen werden muessen (Kommentar `hackaugs.js:194`).

**Verifiziert 07:08** an der laufenden Rangliste (`data/rep-ziel.txt`): Ganz
oben stehen `Vangelis Virus 3.0` (Guete 0,0236) und
`BLADE-51b Tesla Armor: Omnibeam Upgrade`, darunter mit `Combat Rib I` und
`LuminCloaking-V2 Skin Implant` zwei reine Kampfstuecke aus einer
Nicht-Hacking-Faktion. Vor dem Kampfterm haetten die dort nicht gestanden -
sie setzen keinen einzigen Hacking- oder Reputationsmultiplikator und waeren
mit Guetezahl 0 durchgefallen.

**Nebenbefund, beruhigend:** Der Gym-Hebel von 07:00 schickt die Figur nach
Sector-12, die Bladeburner-Division arbeitet aber weiter in **Chongqing**
(`tools/spann.js`, 07:08). Spielerstadt und Bladeburner-Stadt sind
unabhaengig - die Reise ins Powerhouse Gym stoert die laufenden Aktionen
nicht.

<details><summary>Der urspruengliche Eintrag</summary>

### Operation Typhoon ist mit Rang 2500 erreichbar, aber nicht fahrbar

**Alle drei Messauftraege sind erledigt (27.08., 01:20) - und die Antwort ist
beruhigender als der Befund klang.**

**1. Kampfwerte aus Bladeburner-Arbeit: 0,159 dex je Minute.** Gemessen aus
den Pruefausgaben, 20:07 (dex 181) gegen 01:15 (dex 230), 308 Minuten. Fuer
dex 4.400 waeren das **434 Stunden** - auf diesem Weg unerreichbar.

**2. Gym scheidet ebenfalls aus, und zwar rechnerisch.** Die Erfahrungskurve
ist `exp = e^((lvl/mult + 200)/32) - 534,6`
(`PersonObjects/formulas/skill.ts:17-19`). Bei `mults.dexterity` = 1,834
braeuchte dex 4.400 einen Exponenten von rund `(2.399+200)/32 = 81` - eine
Zahl jenseits jeder Spielzeit.

**3. Der Fehlschlag-Versuch ist strikt defizitaer** (schon 01:05 gerechnet):
`rankLoss` 10 gegen `rankGain` 50, bei 3,7 Prozent Chance im Mittel 27
Versuche je Erfolg - also 270 Rang Verlust gegen 50 Gewinn.

**Der Ausweg stand die ganze Zeit im Multiplikator.** `calculateSkill` ist
`floor(mult * (32*ln(exp + 534,6) - 200))` - der Multiplikator wirkt **direkt
auf das Ergebnis**, nicht auf die Erfahrung. Gemessen 01:15: `mults.dexterity`
steht bei **1,834**, str und def bei 1,260, agi bei 1,389, bei 14
installierten Augmentierungen. Die Basis hinter dex 230 ist also 125 - mit
einem Multiplikator von 20 waeren daraus 2.508, mit 35 rund 4.390.

**Damit ist die Route richtig und nur die Erwartung war falsch.** Rang 2500 ist
kein Ausgang, sondern ein Zwischenschritt; die Black Ops kommen nach mehreren
Augmentierungs-Zyklen im selben Knoten. Genau das tut der Bot bereits -
`bn4rep` sammelt Reputation, `bn4net` baut aus, und um 16:31 lief der erste
Einbau dieses Laufs.

**Was daraus folgt, ohne Umbau:** Die Bladeburner-Augmentierungen selbst sind
schwach (`bladeburner_success_chance` 1,02 bis 1,06,
`Augmentation/Augmentations.ts:203,215,228`; nur eine gibt x2). Der Hebel sind
die **Kampfwert-Multiplikatoren**.

**Und genau die sieht der Bot nicht (geprueft 27.08., 01:50).** `bn4rep.js`
waehlt Faktion und Zielaugmentierung ueber `levelNutzen`/`hackNutzen` aus
`lib/hackaugs.js` - und dessen Kopfkommentar sagt es selbst: die Liste enthaelt
"alle Augmentierungen, die mindestens einen **Hacking- oder
Reputations-Multiplikator** setzen". Kampfwert-Augmentierungen kommen darin
**gar nicht vor**. In einem Knoten, dessen Traeger der Bladeburner-Rang ist und
dessen Ausgang an den Kampfwerten haengt, priorisiert der Reputationsmotor also
ausschliesslich nach Hacking.

Was dabei liegen bleibt, aus `Augmentations.ts` gezaehlt - 17 Augmentierungen
setzen mindestens drei Kampfwerte, die staerksten:

    Augmentierung          Produkt   repCost   je Wert
    SPTN-97                   9,38   1,25e6    1,75
    CordiARC Reactor          3,32   1,125e6   1,35
    Photosynthetic Cells      2,74   5,625e5   1,40 (str/def/agi)
    nextSENS / Xanipher       2,07   4,375e5   1,20
    Bionic Spine              1,75   4,5e4     1,15

Zum Vergleich: `mults.dexterity` steht heute bei **1,834**. Allein SPTN-97
wuerde ihn auf 3,21 heben - dex 230 wuerde damit zu rund 402, und die
Typhoon-Chance von 0,037 auf grob 0,075 steigen.

**Auftrag, eigener Lauf:** Eine Kampfwert-Liste analog zu `lib/hackaugs.js`
anlegen und `bn4rep.js` in den Kampfknoten (6 und 7) danach priorisieren
lassen. Zwei Dateien, deshalb nicht in diesem Lauf. **Vorher zu klaeren:** ob
`bn4rep` ueberhaupt kauft oder nur freischaltet, und wie die Nachtsteuerung
(`nacht.cmd`) die Auswahl trifft - sonst wird an der falschen Stelle
umgebaut.

**Dringlichkeit: hoch.** Es ist die Frage, ob der Knoten ueberhaupt auf dem
eingeschlagenen Weg endet.

Gemessen 27.08., 00:57: Die Erfolgschance von Operation Typhoon liegt bei
**0,035 bis 0,038** - unveraendert gegenueber 15:46 (0,035 bis 0,042), obwohl
sich der Rang von 745 auf 1528 verdoppelt hat. Der Grund steht in HEBEL.md
(01:05): **Der Rang geht nicht in die Chance ein.** Black Ops ignorieren
Stadtwerte und Chaos, ihre Schwierigkeit ist die feste `baseDifficulty` 2000,
und die Chance ist `competence / 2000` mit
`competence = SUMME weights[stat] * effSkill^0,9`.

Fuer 50 Prozent braucht es **Faktor 19,6 in den Kampfwerten** - dex von 224
auf rund 4.400. Ueber Faehigkeiten ist das nicht zu holen (Reaper 2 Prozent je
Stufe, Evasive System 4 auf dex/agi; Stufe 50 in beiden braechte x3,5).

**Zu messen, bevor irgendetwas entschieden wird:**
1. Wie schnell wachsen die Kampfwerte aus Bladeburner-Arbeit? Aus
   `data/aktionen.txt` laesst sich das nicht ablesen - es braucht zwei
   Messpunkte der Kampfwerte mit Zeitstempel. Der Strategiepruefer schreibt
   sie bereits in `data/verlauf-strategie.json`.
2. Was kostet dieselbe Steigerung im Gym? Powerhouse Gym kostet 2.400 Dollar
   je Sekunde, das Guthaben liegt bei 18,7 Milliarden - Geld ist hier nicht
   der Engpass, Zeit ist es.
3. Was bringt ein Fehlschlag-Versuch? `rankLoss` 10, `hpLoss` 100
   (`data/BlackOperations.ts:12-14`). Bei 3,7 Prozent Chance kostet ein
   Erfolg im Mittel 27 Versuche, also 270 Rang und 2.700 HP-Schaden - gegen
   `rankGain` 50. **Das ist strikt defizitaer**, Typhoon auf gut Glueck zu
   versuchen scheidet damit aus.

**Erst danach ist die Route zu bewerten** - und eine Aenderung an der
Reihenfolge der BitNodes waere Erics Entscheidung, kein Loop-Beschluss.

</details>

---

### Der Rangstillstand nach dem Einbau ist richtig - zwei Verdachte geprueft (28.08., 06:47)

Um 06:37 stand der Rang seit zwanzig Minuten fast still (+154), und
`data/blade.json` meldete `General/Hyperbolic Regeneration Chamber`,
"ruht bis Ausdauer 375" bei 346 von 670. Zwei Verdachte lagen nahe, **beide
sind widerlegt**.

**(1) "Die Stufensteuerung ist ein ungenutzter Hebel."** `autoLevel` setzt
nach jeder Aktion `level = maxLevel` (`Bladeburner.ts:1004`) - der Motor
faehrt also immer die schwerste Stufe, auch wenn die Kampfwerte im Keller
sind. Gemessen 06:45 (`src/stufentest.js`, Assassination):

    Stufe   Chance   Zeit   rep     Ertrag je Sekunde
       20    0,230    31 s  5.060         **37,5**
       16    0,291    25 s  2.996           34,9
       13    0,346    21 s  2.022           33,3
        1    0,697    11 s    420           26,6

**Die hoechste Stufe gewinnt**, selbst bei einer Chance von 0,23. Der Grund
steht in den Konstanten: `rewardFac` 1,14 gegen `difficultyFac` 1,06 - der
Ertrag waechst schneller als Dauer und Schwierigkeit. `autoLevel` ist
richtig, und eine Stufensteuerung waere ein Verlust.

**(2) "`SICHER_OPERATION` = 0,85 ist zu hoch, der Motor ruht statt zu
arbeiten."** Bei Stufe 20 und Chance 0,23 waere der Rang-Erwartungswert
positiv (0,23 x 531 minus 0,77 x 48 = 85 je Lauf). Das uebersieht aber den
eigentlichen Preis - **den Schaden**:

    hpLoss: 5                                      (data/Operations.ts:204)
    damage = hpLoss * difficultyMultiplier          (Bladeburner.ts:982)

Bei Stufe 20 ist `difficulty` = 1500 x 1,06^19 = 4.541 und
`diffMult = difficulty^0,28 + difficulty/650` = 17,62. Der Schaden je
Fehlschlag betraegt damit **88 HP** - und der Spieler hat um 06:37 genau
**27**. Jeder einzelne Fehlschlag bedeutet Krankenhaus, bei Chance 0,23 also
in drei von vier Versuchen.

**Die Schwelle 0,85 ist damit exakt richtig.** Der Motor ruht nicht aus
Vorsicht, sondern weil Arbeiten hier teurer waere als Warten. Der
Rangstillstand ist der Preis des Einbaus von 05:53, kein Defekt.

**Was das fuer den naechsten Einbau heisst:** Die Wiederaufbauphase dauert,
solange die Kampfwerte unter dem liegen, was die erreichte Aktionsstufe
verlangt - und die Stufe ueberlebt den Einbau, die Kampfwerte nicht. Je
weiter der Knoten fortschreitet, desto laenger wird diese Pause. Das ist
kein Fehler, aber es gehoert in die ETA.

---

### Der WERKZEUG-Kanal versprach einen Neustart, den es nicht gab (28.08., 06:15)

**Die Ursache steht in `bn4net.js` und ist strukturell.** Der Kanal killt in
Abschnitt 1 (`:546-563`); den Neustart erledigt Abschnitt 2c - und der haengt
an `if (werkbank)`. Die Werkbank ist der groesste **gekaufte** Rechner, und
**nach einem Augmentierungs-Einbau sind die gekauften Rechner weg**. In genau
der Phase, in der die Werkzeuge am noetigsten sind, startet also nichts nach.

Am 28.08. um 05:54, nach dem zweiten Einbau der Nacht: zwei `bbtrain.js`
(PID 21 und 29), ein `WERKZEUG bbtrain.js` beendete beide, und zwei Minuten
lang trainierte niemand - bei Kampfwerten auf 1. Behoben um 05:57 mit
`node tools/task.js bbtrain.js`, danach genau eine Instanz (PID 74) und
"Arbeit dex @ Powerhouse Gym".

**Was NICHT geaendert wurde, und warum.** Der naheliegende Fix waere, fehlende
Werkzeuge auf `home` nachzustarten. Das ist falsch: Die Werkzeuge liegen auf
der Werkbank, **weil** sie in ein frisches home mit 32 GB nicht passen -
`blade.js` allein ist groesser als der Rest -, und bn4net wuerde sich den
eigenen Speicher wegnehmen. Der Motor darf sich nicht selbst gefaehrden, um
einen Fall abzudecken, den ein Mensch ausgeloest hat.

Denn das war es: Im Normalbetrieb killt niemand Werkzeuge nach einem Einbau,
und `boot.js` startet nach dem Prestige ohnehin alles neu. Die Luecke ist
echt, aber selten - und der reale Schaden waren zwei Minuten.

**Geaendert wurde deshalb nur die Meldung**, die die Fehlannahme erzeugt hat.
Sie sagt jetzt, woran der Neustart haengt:

    name + ": N Instanz(en) beendet - ACHTUNG: keine Werkbank, es startet
    NICHTS nach. Mit 'node tools/task.js <name>' selbst starten."

Verifiziert: `node --check src/bn4net.js` sauber,
`node tools/strategie-check.js` weiterhin `URTEIL: SPUR` bei +8.408 Rang in
28 Minuten. Die Aenderung ist einzeln committet, wie es fuer den Motor gilt.

**Nebenbefund, schon vom Motor abgedeckt:** Die zwei `bbtrain.js`-Instanzen
haette `bn4net.js` selbst aufgeraeumt - die Entdopplung in Abschnitt 2c ist
netzweit und steht bewusst **vor** der Werkbank-Pruefung (Kommentar vom
23.08.). Ich war nur schneller.

<details><summary>Der urspruengliche Eintrag</summary>

### WERKZEUG <name> beendet, startet aber nicht neu (05:56)

Gemessen: Nach dem Reset um 05:53 liefen **zwei** `bbtrain.js`-Instanzen
(PID 21 und 29, `data/ps.json` 05:54). Ein `WERKZEUG bbtrain.js` ueber
`data/reload.txt` hat beide beendet - und **keine** neu gestartet. Zwei
Minuten lang lief kein Training, waehrend die Kampfwerte auf 1 standen.

Erwartet: Der Kanal meldet selbst "beendet, startet gleich neu"
(`src/bn4net.js`, WERKZEUG-Zweig). Entweder stimmt die Meldung nicht, oder
der Neustart haengt an einer Bedingung, die hier nicht griff.

Verdacht: `src/bn4net.js`, der Block ab `if (b.startsWith("WERKZEUG "))`.
Moeglich ist, dass der Neustart nur fuer Skripte gilt, die in einer festen
Liste stehen, und `bbtrain.js` dort fehlt - es wird sonst von `boot.js`
gestartet, nicht vom Motor.

Behoben von Hand um 05:57: `node tools/task.js bbtrain.js`, danach genau eine
Instanz (PID 74) und "Arbeit dex @ Powerhouse Gym". **Der Fehler in der
Meldung bleibt** - beim naechsten Mal verlaesst sich jemand darauf.

</details>

---

### Der Faehigkeitsplan ist dynamisch - VERIFIZIERT, letzter Deckel gefallen (28.08., 05:41)

Der Punkt vom 27.08. verlangte, `SKILL_PLAN` durch einen Vergleich nach
**Nutzen je Punkt** zu ersetzen. Von den zehn Faehigkeiten stehen jetzt
**neun** in `DYNAMISCH`; die letzte, Tracer, hat einen begruendeten Deckel
(`SuccessChanceContract`, und die Vertragschancen klemmen bei 1,00).

**Der heutige Zugewinn: Cyber's Edge.** Es stand bei Deckel 5 und war das
fehlende Gegenstueck zu Overclock:

    Overclock       ActionTime -1 je Stufe   kuerzere Aktionen, mehr Verbrauch
    Cyber's Edge    Stamina    +2 je Stufe   mehr Vorrat UND mehr Nachschub

Der `Stamina`-Multiplikator wirkt **doppelt**: `calculateMaxStamina` nimmt
ihn, und `calculateStaminaGainPerSecond` nimmt ihn ein zweites Mal
(`Bladeburner.ts:1322`) - dort steht ausserdem `maxStamina / 70000` im
Summanden, den er gerade gehoben hat.

**Beide sind gegenlaeufig an dieselbe Messung gekoppelt** (`ausdauerLuft()`):
Was den einen daempft, weckt den anderen. Damit regelt sich das Paar selbst -
Overclock treibt die Aktionen schneller, bis die Ausdauer knapp wird, dann
faellt sein Nutzen und der von Cyber's Edge steigt, bis wieder Luft da ist.

**Verifiziert 05:40 ueber vier Messungen in 72 Sekunden:**

    Cyber's Edge   Stufe  5 -> 10 -> 14 -> 17
    max Ausdauer     295   ->  538 -> 575 -> 602

**Die Ausdauer band also tatsaechlich schon** - der Fuellstand lag bei 54
Prozent, nicht bei den 69 von 04:41. Der Daempfer von 04:11 hat damit zum
ersten Mal gegriffen, und zwar in beide Richtungen gleichzeitig.

Die Rangrate steigt weiter: **633,9 je Minute ueber 20 Minuten**, 451,6 im
45-Minuten-Fenster, Kammeranteil weiterhin null (30 Minuten nur
Assassination).

**Was der alte Eintrag richtig sah:** Die Kosten steigen linear mit der Stufe
(`Skill.ts:37-41`), der Nutzen je Stufe bleibt konstant - der Nutzen je
Punkt faellt also monoton, und die beste Faehigkeit wandert. Ein Plan mit
festen Zahlen ist ab dem Moment falsch, in dem eine `Infinity`-Faehigkeit
teurer wird als eine gedeckelte. Genau das war heute Nacht viermal der Fall.

<details><summary>Der urspruengliche Eintrag</summary>

### Der Faehigkeitsplan hat feste Deckel - er veraltet zwangslaeufig

**Zweimal am 27.08. lag eine deutlich bessere Faehigkeit gedeckelt daneben**,
waehrend die `Infinity`-Eintraege alle Punkte auffrassen:

    12:52   Hyperdrive       Stufe 0, 1 Punkt      1,451 % je Punkt
    13:19   Short-Circuit    Stufe 12, 27 Punkte   0,122
            Blade's Intuition Stufe 25, 56 Punkte  0,031   <- bekam alles

Die Ursache ist strukturell: Die Kosten steigen **linear** mit der Stufe
(`(baseCost + level * costInc) * mult`, `Bladeburner/Skill.ts:37-41`), der
Nutzen je Stufe bleibt konstant - also faellt der Nutzen je Punkt monoton, und
die beste Faehigkeit wandert im Lauf des Knotens. Ein Plan mit festen Zahlen
kann das nicht abbilden; er ist ab dem Moment falsch, in dem eine
`Infinity`-Faehigkeit teurer wird als eine gedeckelte.

**Der Fix:** `SKILL_PLAN` durch einen Vergleich ersetzen, der bei jedem Kauf
den **relativen Nutzen je Punkt** rechnet und die beste Faehigkeit nimmt.
Relativ, nicht absolut - die Multiplikatoren verrechnen sich multiplikativ, ein
Prozentpunkt auf 1,66 ist mehr wert als auf 2,65. Die Daten dafuer liegen
bereits vor: `ns.bladeburner.getSkillUpgradeCost` und die Tabelle in
`data/Skills.ts`.

**GEAENDERT 13:49, Wirkung noch nicht gemessen.** Die drei Faehigkeiten, deren
Wirkung auf die Black-Op-Chance gerechnet ist - **Hyperdrive, Short-Circuit,
Blade's Intuition** -, werden vor jedem Kauf nach relativem Nutzen je Punkt
sortiert und tauschen ihre Planplaetze untereinander. Deckel und alle uebrigen
Eintraege bleiben unangetastet; wer am Deckel steht, faellt auf -1 und wandert
nach hinten.

Verifiziert ist bisher nur, dass nichts bricht: nach dem Neustart um 13:49
Rang 5.024, Aktion `Contracts/Tracking`, `URTEIL: SPUR`.

**Nachzumessen:** Bei 26 Punkten und Preis 27 muss der Motor jetzt auf
**Short-Circuit** sparen (0,122 je Punkt) statt auf Blade's Intuition (0,031).
Ablesen an der Stufe in `data/bbspann.json` - steigt Short-Circuit ueber 12,
traegt die Sortierung. Steigt stattdessen Blade's Intuition ueber 25, greift
sie nicht und der Commit gehoert zurueckgedreht.

**Was offen bleibt:** Die neun uebrigen Faehigkeiten stehen weiter in fester
Folge, weil ihre Wirkung auf den Traeger nicht gerechnet ist. Digital Observer
trifft nur Operations, Cloak nur Stealth, Hands of Midas nur Geld - fuer sie
braucht es erst eine Umrechnung in Prozent Black-Op-Chance, bevor sie in den
Vergleich duerfen.

**Achtung bei der Umsetzung:** Nicht jede Faehigkeit wirkt auf den Traeger.
Digital Observer trifft nur Operations, Cloak nur Stealth, Hands of Midas nur
Geld - Typhoon ist `isKill`, also zaehlen Blade's Intuition (alle),
Short-Circuit (kill) und ueber die Erfahrung Hyperdrive. Ein blinder
Nutzen-je-Punkt-Vergleich ueber alle zwoelf Faehigkeiten kauft sonst Unsinn.

</details>

---

### Die Augmentierungsrunde ist gelaufen - VERIFIZIERT (28.08., 05:08)

Der Punkt fragte, **wann** der Einbau faellt. Er ist am **28.08. um 01:25**
gefallen, ausgeloest von `bn4rep.js` ohne jeden Eingriff von aussen. Der
Wacheloop hat ihn als `URTEIL: RESET` erkannt und den Wiederanlauf geprueft:
alle elf Skripte mit frischen PIDs, `boot.js` hatte gegriffen.

**Verifiziert 05:08** aus dem Spielstand:

    eingebaut 25 Augmentierungen, Warteschlange 1
    str 1,597   def 1,597   dex 2,325   agi 1,677
    bladeburner_success_chance 1,278   bladeburner_analysis 1,328
    bladeburner_stamina_gain 1,040

**Die Kernaussage des Punktes hat gehalten:** "Der Bladeburner-Fortschritt
ueberlebt den Einbau fast vollstaendig." Gemessen 01:39, 14 Minuten nach dem
Prestige: Rang 22.867 unveraendert, Assassination Stufe 9, Raid 12, Stealth
Retirement 10, Overclock 30 - nur die Kampfwerte fielen auf 101 bis 121.

**Und der Wiederaufbau war schnell, wie vorhergesagt:**

    01:33   str  96  def  96  dex 101  agi  83
    05:03   str 228  def 228  dex 405  agi 287

Dreieinhalb Stunden fuer das Vierfache - die Multiplikatoren tragen genau so,
wie es der Eintrag aus `PersonObjects/formulas/skill.ts:13` hergeleitet
hatte.

**Was der Punkt NICHT vorhergesehen hat:** Die Rangrate stieg in derselben
Nacht von 53,4 auf **442,9 je Minute** - aber nicht wegen des Einbaus. Die
drei Hebel dahinter waren Assassination als Rangfahrzeug (23:42), Overclock
in der Faehigkeitssortierung (00:58) und die Chaos-Folgekosten in der
Aktionsbewertung (03:42). Der Einbau lieferte die Kampfwerte, auf denen sie
alle aufsetzen, aber die Zuordnung "Einbau bringt Faktor X" waere falsch.

**Der offene Teil (2) - "was liefert `bn4net` an Geld je Stunde" - ist
entfallen.** Er sollte entscheiden helfen, wann der Einbau faellt. Diese
Entscheidung trifft `bn4rep.js` selbst, und sie hat sie richtig getroffen:
Geld steht um 05:08 wieder bei 2,66 Mrd, ein Stueck liegt schon in der
Warteschlange. Der Kreislauf laeuft ohne Zutun.

<details><summary>Der urspruengliche Eintrag</summary>

### Der groesste ungehobene Hebel: eine Augmentierungsrunde - Engpass ist GELD (18:13)

**Der Bladeburner-Fortschritt ueberlebt den Einbau fast vollstaendig.**
`Prestige.ts:153-154` ruft `Bladeburner.prestigeAugmentation()
(`Bladeburner.ts:259-263`), und das macht **nur** `resetAction()` +
`joinFaction()`. Rang, `skillPoints`, Fertigkeitsstufen und Aktionsstufen
bleiben stehen. Es fallen allein die Kampfwerte.

**Und die kommen ueberproportional schneller zurueck.** Die Kampfstufe ist
*multiplikativ* im Augmentierungs-Multiplikator, aber nur *logarithmisch* in
der Erfahrung (`PersonObjects/formulas/skill.ts:13`). Stufe 1.000 bei
mult 1,0 verlangt `exp = e^37,5 = 1,9e16`; bei mult 1,1 genuegt
`exp = e^34,6 = 1,1e15` - **17-mal weniger, also rund 6 Prozent der bisherigen
Trainingszeit**. Der Wiederaufbau kostet Stunden, die Decke steigt dauerhaft.

**Reputation ist kein Engpass, Geld ist einer.** Bei Rang 6.910 sind
mindestens 13.820 Bladeburner-Reputation verdient (`RankToFactionRepFactor 2`).
Die Preise:

    INTERLINKED     25.000 Rep   $5,5 Mrd   (Erfahrung auf alle vier Werte)
    Golem Serum     31.250 Rep   $11 Mrd    (str/def/dex/agi je x1,07)
    Omnibeam        62.500 Rep   $27,5 Mrd  (+10 % Erfolgschance)

Kontostand um 18:00: **2,5 Milliarden**. Damit ist die Zielsetzung der Loops
unvollstaendig: Sie optimieren Rangrate, aber der Hebel mit dem groessten
Dauerertrag haengt am Geld - und Geld steht in keinem Ziel der letzten sechs
Berichte.

Zu tun: (1) Die drei Augmentierungen gegen ihre Wirkung auf die Rangrate
rechnen, nicht schaetzen. (2) Pruefen, was `bn4net` an Geld je Stunde liefert
und ob sich das heben laesst (BN6 hat `ScriptHackMoney 0,75`, also nur leicht
gedaempft). (3) Erst dann entscheiden, wann der Einbau faellt.

</details>

---

### Overclock steht auf 90 - die Rechnung stimmte, die Folgerung nicht (28.08., 04:41)

**Die Ausdauerrechnung von 03:56 war richtig.** Overclock ist inzwischen am
Maximum (Stufe **90**, gemessen 04:37), Assassination steht auf Stufe 15 mit
einer Dauer von **24 Sekunden** - und der Fuellstand ist wie vorhergesagt
gefallen:

    03:51   Overclock 69   Ausdauer 231,0 / 243,9  =  95 %
    04:37   Overclock 90   Ausdauer 195,2 / 283,7  =  69 %

**Die Folgerung "dann wird Overclock wertlos" ist dagegen widerlegt.** Die
Rangrate ist im selben Zeitraum von **83,3 auf 347 je Minute** gestiegen.

Der Grund steht in `Bladeburner.ts:1317-1325`, und er fehlte in meiner
Rechnung: Die Regeneration enthaelt `maxStamina / MaxStaminaToGainFactor`
und den Faktor `effAgility^0,17`. **Beide wachsen mit den Kampfwerten mit** -
und die steigen gerade schnell, weil der Einbau von 01:25 die
Multiplikatoren gehoben hat. Gemessen ueber sechs Punkte in zwei Minuten:

    Ausdauer 193/284 -> 192/287 -> 190/294 -> 187/294 -> 188/295

Die absolute Ausdauer bleibt bei rund 190 stehen, waehrend das Maximum
waechst. **Das ist ein Gleichgewicht, kein Absturz** - die Kammer lief in
keiner der sechs Messungen, durchgehend Assassination.

**Der Daempfer bleibt trotzdem drin.** Er kostet nichts, solange die Ausdauer
Luft hat (Faktor 1,0 ueber 90 Prozent), und er ist die Versicherung fuer den
Fall, dass die Regeneration einmal nicht mitwaechst - nach einem BitNode-
Wechsel etwa, wenn Overclock wieder bei null anfaengt und die Kampfwerte
ebenfalls. Eine Sicherung, die im Normalbetrieb nicht auffaellt, ist nicht
falsch, nur weil der Ernstfall diesmal ausblieb.

**Die Lehre:** Ich habe zwei Groessen als fest angenommen, die beide
mitwachsen - `maxStamina` und `effAgility`. Eine Rechnung, die einen Teil
des Systems einfriert, sagt zuverlaessig den Zusammenbruch voraus. Der Blick
in `calculateStaminaGainPerSecond` haette fuenf Minuten gekostet und stand
in derselben Datei wie die Verlustzeile, die ich nachgeschlagen hatte.

<details><summary>Der urspruengliche Eintrag</summary>

### Overclock hat eine harte Grenze, und sie ist die Ausdauer (03:56)

Gemessen: Overclock steht um 03:51 auf **Stufe 69** von 90 und ist der
staerkste laufende Hebel - die Rangrate sprang im kurzen Fenster auf 190,5
je Minute. Die Ausdauer steht dabei aber schon bei **231,0 von 243,9**, und
`tools/spann.js` meldet die Regeneration als "2.3/min (Vorgabe)" statt
gemessen: Es hat keine Kammerphase mehr gesehen.

Erwartet: Genau das kippt bald, und der Grund steht im Quellcode.
**Der Ausdauerverlust faellt je AKTION an, die Regeneration je SEKUNDE:**

    this.stamina -= BaseStaminaLoss * difficultyMultiplier   (Bladeburner.ts:921, :1019)
    BaseStaminaLoss: 0.285                                   (Constants.ts:5)
    StaminaGainPerSecond: 0.0085                             (Constants.ts:4)

Overclock halbiert die Aktionsdauer - also verdoppelt es den Verbrauch je
Minute, waehrend der Gewinn gleich bleibt. Gerechnet fuer Assassination auf
Stufe 12 (`difficulty` = 1500 x 1,06^11 = 2.846,
`diffMult = difficulty^0,28 + difficulty/650` = 9,49 + 4,38 = **13,87**,
`Constants.ts:15-16`):

    Verlust je Aktion            0,285 x 13,87  =  3,95 Ausdauer
    Dauer bei Overclock 69       rund 48 s      ->  4,94 je Minute
    Dauer bei Overclock 90       rund 15,5 s    -> 15,3 je Minute
    Regeneration (Anzeige)                          2,3 je Minute

**Bei Stufe 69 fehlt schon der Faktor 2, bei 90 waere es Faktor 6,6.** Die
Kammer muesste den Rest auffangen - und Kammerzeit ist Zeit ohne Rang. Ab
einem Punkt frisst Overclock mehr, als es bringt.

Verdacht auf die Fundstelle: `src/blade.js`, `relNutzen` fuer Overclock.
Der Zweig gibt `100 / (99 - stufe)` zurueck und kennt die Ausdauer nicht.
Er muesste den Zuwachs mit dem Anteil verrechnen, der davon in der Kammer
wieder verlorengeht.

**Geaendert 04:11, Wirkung noch nicht gemessen.** Der Daempfer steht in
`relNutzen` fuer Overclock: Faellt der Ausdauer-Fuellstand unter 90 Prozent,
sinkt der ausgewiesene Nutzen linear gegen null bei 50 Prozent. Er misst
damit die Groesse, die kippt, statt eine Stufe zu raten.

**Er greift noch nicht - und das ist richtig so.** Gemessen 04:11 ueber fuenf
Punkte in 90 Sekunden: Ausdauer **234,9 bis 238,6 von 247,6** (95 Prozent,
steigend), Kammeranteil weiterhin null. Bei 95 Prozent ist der Faktor 1,0,
der Nutzen also unveraendert. Overclock steht bei **75** und wartet nur auf
Punkte (Stufe 76 kostet 109, vorhanden waren 17).

Die Rechnung dahinter, die den Daempfer rechtfertigt: **Rang je
Ausdauerpunkt ist konstant** - beides haengt an der Aktion, nicht an der
Zeit. Sobald die Ausdauer bindet, ist die Rangrate
`(Rang je Aktion / Verlust je Aktion) x Regeneration`, und darin kommt die
Dauer nicht mehr vor. Overclock kuerzt sich dann vollstaendig heraus.

Zu messen bleibt: ob der Fuellstand faellt, wenn Overclock weiter steigt.
Bei Stufe 90 waeren es rechnerisch 13,1 Ausdauer je Minute gegen rund 4,4
Regeneration.

Zu tun: (1) Den Kammeranteil messen, **bevor** gedeckelt wird - die
Stichproben aus `data/verlauf-strategie.json` zeigen ihn in den letzten
zwei Stunden mit **null Prozent**, die Rechnung sagt also mehr voraus als
bisher eingetreten ist. Erst wenn er steigt, ist der Deckel faellig.
(2) Die Regeneration wirklich messen statt die Vorgabe zu nehmen - sie
haengt an `bladeburner_stamina_gain` und den Augmentierungen des Einbaus
von 01:25.
(3) Nicht vorschnell deckeln: Overclock ist gerade der beste Kauf je Punkt,
und ein Deckel auf eine ungerechnete Vermutung hin waere teurer als der
Kammeranteil.

</details>

---

### Der Ausgang aus BitNode 6: von 182 auf 64 Stunden (28.08., 03:10)

Die Phasenrechnung von 23:12 ist ueberholt - und zwar von der Aenderung, die
sie selbst ausgeloest hat. Sie kam auf **182 Stunden**, weil sie fuer die
Zeit nach dem Raid-Vorrat mit Stealth Retirement und 25,4 Rang/min rechnete.
Genau dort steht heute Assassination.

**Gemessen 03:08, ueber zwei Fenster:**

    45-Minuten-Fenster    78,2 Rang/min
    60-Minuten-Fenster    77,6
    Rang                  28.062

Die Rate ist stabil - das 90-Minuten-Fenster liegt mit 59,6 nur deshalb
darunter, weil es noch in die Wiederaufbauphase nach dem Einbau um 01:25
hineinreicht.

**Die neue Rechnung:**

    Restweg brutto            400.000 - 28.062  =  371.938
    davon aus Black Ops       73.660 minus die vier gefallenen (285)
                                                =   73.375
    aus Aktionen zu holen                       =  298.563

    bei 78 Rang/min                             =  3.828 min  =  63,8 h
    plus 17 Black Ops, im Mittel 800 s bei p 0,9 =            =   4,2 h
    ------------------------------------------------------------------
    Gesamt                                                    rund 68 h

**Und das ist die konservative Zahl**, weil sie zwei laufende
Beschleunigungen ignoriert:

  - Die **Assassination-Stufe** waechst mit 7,55 Prozent je Stufe netto
    (`rewardFac` 1,14 gegen `difficultyFac` 1,06) und steht erst bei 11.
  - **Overclock** steht bei 30 von maximal 90. Voll ausgebaut waere die
    Aktionsdauer `(100-90)/(100-30)` = Faktor **0,143**, die Rate also
    siebenmal so hoch. Die noetigen rund 5.000 Faehigkeitspunkte kommen aus
    dem Rang selbst (`skillPoints = floor(maxRank/3)`).

**Der Raid-Vorrat ist als Engpass erledigt.** Er war der Grund fuer die 182
Stunden - Assassination verbraucht keine Gemeinden, nur eine Person je Lauf
(`Bladeburner.ts:857`). Die 361 Gemeinden bleiben als Reserve liegen.

Fuer `nodes/KURS.md` beim naechsten Kurslauf: ETA **rund 64 bis 68 Stunden**
statt 71 bis 148, Leitgroesse unveraendert Bladeburner-Rang je Minute.

<details><summary>Der urspruengliche Eintrag mit der 182-Stunden-Rechnung</summary>

### Der Ausgang aus BitNode 6: 319.430 Rang netto (17:51, korrigiert 18:13, ETA neu gerechnet 23:12)

**Nachtrag 23:12 - die ETA ist zweiphasig, und das stand hier nicht.** Die
alte Spanne von 80 bis 180 Stunden ruht auf einem Exponenten `a` zwischen
0,3 und 0,6, also auf der Annahme, der Rang beschleunige sich selbst. Diese
Annahme ist heute **groesstenteils ausgereizt**: Die Selbstbeschleunigung
lief ueber die Erfolgschance, und Raid steht bei **1,0 bis 1,0** (gemessen
21:40). Weitere Faehigkeitspunkte aendern dort nichts mehr.

Ein aus der eigenen Messreihe geschaetztes `a` waere zudem wertlos: Die
Regression ueber 25 Stundenfenster ergibt 1,29, aber ein grosser Teil des
Anstiegs kommt von den Strategieaenderungen dieses Abends (Stealth
Retirement 20:42, Black-Op-Schwelle 21:55), nicht vom Rang. **Wer die eigene
Optimierarbeit als Naturgesetz misst, rechnet sich reich.**

Die belastbare Rechnung ist stattdessen eine Phasenrechnung:

    Phase 1, Raid-Zyklus     53,4 Rang/min gemessen ueber 63 min
                             361 Gemeinden Vorrat, 1 je Zyklus a 190 s
                             = 19,1 Stunden, 60.648 Rang
                             Ende bei Rang rund 77.400

    Phase 2, ohne Raid       Stealth Retirement 25,4 Rang/min
                             Restweg 322.632, davon 73.375 aus den
                             verbleibenden Black Ops
                             = 249.257 / 25,4 = 163 Stunden

    Gesamt                   rund 182 Stunden

**Das ist am oberen Rand der alten Spanne, nicht in ihrer Mitte.** Und der
Grund steht ganz woanders als vermutet: nicht in der Chance, sondern im
**endlichen Raid-Vorrat**. `Incite Violence` hilft nicht - es erhoeht nur
`count` der Vertraege und Operationen (`Bladeburner.ts:1219-1225`), nicht
`comms`.

Wie Phase 2 tatsaechlich aussehen sollte, steht im Punkt darueber
(Assassination).


**Erstmals vollstaendig gemessen** (`src/blackops.js` schreibt
`data/blackops.json`). Rang 6.910 zum Messzeitpunkt, alle 21 Black Ops:

     1. Typhoon        Rang   2.500   Chance 0,278-0,305    196 s
     2. Zero           Rang   5.000   Chance 0,086-0,094    244 s
     3. X              Rang   7.500   Chance 0,186-0,203    293 s
     5. Ares           Rang  12.500   Chance 0,133-0,146    488 s
    10. Deckard        Rang  40.000   Chance 0,032-0,035  1.952 s
    15. Morpheus       Rang 150.000   Chance 0,006-0,007  4.391 s
    21. Daedalus       Rang 400.000   Chance 0,003-0,003  7.807 s

Die Rangschwellen sind gegen `reference/bitburner-src/src/Bladeburner/data/
BlackOperations.ts` geprueft und stimmen exakt. BN6 setzt keinen
`BladeburnerRank`-Multiplikator.

**Der Rang ist der Engpass, nicht die Chance.** Das haelt. Aber drei Zahlen im
urspruenglichen Eintrag waren falsch; sie sind hier ersetzt:

**(1) Die Strecke ist kuerzer als 400.000.** Die ersten zwanzig Black Ops
liefern zusammen **73.660 Rang** (`rankGain` 50 bis 20.000, nachgerechnet).
Netto bleiben **319.430** statt 393.090 - 18 Prozent der Strecke waren
doppelt gezaehlt.

**(2) Die 418 Stunden waren eine unzulaessige lineare Fortschreibung.** Der
Rang erzeugt seine eigene Beschleunigung: `skillPoints = floor(maxRank/3)`
(`Constants.ts:47`), und weil die Fertigkeitskosten LINEAR steigen
(`Skill.ts:37-41`), waechst die Stufe mit `sqrt(Punkte)`, also mit
`sqrt(Rang)`. Damit gilt `dR/dt ~ R^a` mit a zwischen 0,4 und 0,6 statt a = 0.
Mit `t = R1/(rate*(1-a)) * ((R2/R1)^(1-a) - 1)`:

    a = 0,3  ->  179 h        a = 0,5  ->  103 h
    a = 0,44 ->  121 h        a = 0,6  ->   79 h
    a = 0    ->  443 h   <- die alte Zahl

**Die eigene Messreihe widerlegt a = 0**: 6.910 Rang in rund 50 Stunden
Knotenlaufzeit sind 2,3 je Minute im Mittel gegen 14,8 jetzt - Faktor 6.
**Massgeblich sind 80-180 Stunden, Mitte rund 120.** Nicht die Aktionsstufen
sind der Motor (`rewardFac/difficultyFac^2` ist bei Bounty Hunter 1,003, also
fast neutral), sondern die Fertigkeitspunkte.

**(3) "43.000 Versuche" bei Chance 0,003 war Faktor 130 daneben.** Der
Erwartungswert ist `1/p = 333` Versuche. Die Aussage, die spaeten Black Ops
seien mit heutigen Kampfwerten nicht fahrbar, bleibt trotzdem richtig -
333 Versuche zu 7.807 Sekunden sind 722 Stunden.

**Der Hackweg ist geprueft und faellt aus.** `destroyW0r1dD43m0n` akzeptiert
Hacking >= 6.000 (`requiredHackingSkill 3000` x `WorldDaemonDifficulty 2`)
ODER 21 Black Ops (`Singularity.ts:1148-1160`). Aber `level = floor(mult *
(32*ln(exp) - 200))` mit `mult = 0,35 * Aug-Mult` (BN6:
`HackingLevelMultiplier 0,35`) verlangt bei Aug-Mult 3 ein `exp` von e^184 -
unerreichbar. Erst ab Hacking-Multiplikator 25-30 wird es rechnerisch
moeglich. Dazu verlangt Daedalus in BN6 **35 Augmentierungen** statt 30
(`DaedalusAugsRequirement`). Black Ops bleiben der Weg.

</details>

---

### Der Assassination-Aufbau traegt - BEIDE PRUEFPUNKTE BESTANDEN (28.08., 02:38)

**Pruefpunkt 1, die Stufe steigt.** Verifiziert ueber vier Messungen:

    00:07  Stufe  5   Dauer 116 s
    01:11  Stufe  8
    02:08  Stufe 10   Chance 1,000
    02:38  Stufe 11   Dauer 102 s

Das Kriterium war Stufe 6 nach einer Stunde. Der Einbau um 01:25 hat den
Aufbau nicht zurueckgeworfen - `prestigeAugmentation()` laesst die
Aktionsstufen stehen (`Bladeburner.ts:259-263`), gemessen 01:39 mit
Assassination 9, Raid 12, Stealth Retirement 10.

**Pruefpunkt 2, die Rangrate.** Das Kriterium waren 53,4 Rang/min - die Rate
des Raid-Zyklus, den Assassination ersetzen sollte:

    seit 02:05 (nach der Diplomacy-Phase)   **78,8 Rang/min** ueber 20 min
    45-Minuten-Fenster                        69,6
    Raid-Zyklus zum Vergleich (21:56-23:39)   52,7

**Plus 49 Prozent gegenueber dem Raid-Zyklus** - die Hypothese von 23:42
hatte 56,9 bei Stufe 11 vorhergesagt und ist damit uebertroffen.

**Der Grund fuer die Uebererfuellung ist der zweite Hebel:** Die Dauer steht
bei Stufe 11 auf **102 Sekunden** statt der gerechneten 173. Overclock ist
seit 00:58 in der dynamischen Sortierung und stand um 01:39 bereits auf
Stufe 30 - das sind 30 Prozent weniger Aktionszeit
(`ActionTime: -1` je Stufe, `data/Skills.ts:44-53`). Die beiden Hebel
multiplizieren sich: mehr Rang je Aktion, weniger Zeit je Aktion.

Theoretisch sind es `44 x 1,14^10` = 163 Rang je 102 Sekunden = **95,9 je
Minute**; die gemessenen 78,8 enthalten Kammer, Vertraege und die
Chaos-Phasen.

**Das Ziel Stufe 12 bleibt richtig.** Danach schaltet die Anlaufregel ab und
`beste()` uebernimmt - und waehlt Assassination weiter, weil es dann den
besten Ertrag hat. Die Stufe steigt also von allein weiter, mit 7,55 Prozent
netto je Stufe (`rewardFac` 1,14 gegen `difficultyFac` 1,06).

<details><summary>Der urspruengliche Eintrag</summary>

### Nachmessen: traegt der Assassination-Aufbau? (23:42)

Gemessen: Seit 23:39 laeuft `Operations/Assassination` mit dem Grund
"Stufenaufbau 1/12". Der Aufbau dauert rund **3,5 Stunden** (96 Erfolge),
waehrend die Rangrate unter dem Raid-Zyklus liegt.

Erwartet: Ab Stufe 11 schlaegt Assassination den Raid-Zyklus (56,9 gegen
53,4 Rang/min), ab Stufe 12 sind es 61,2. Zu pruefen ist beides:

  1. **Die Stufe steigt wirklich.** `getActionMaxLevel` waechst nur bei
     Erfolgen (`Bladeburner.ts:944`). Bleibt sie stehen, greift die Regel
     nicht - dann faehrt der Motor 3,5 Stunden die schlechteste Aktion.
     Abbruch, wenn die Stufe nach einer Stunde unter 6 liegt.
  2. **Die Rangrate nach dem Aufbau**, geglaettet ueber 45 Minuten. Liegt
     sie unter 53,4, wird `ASSASSIN_AUFBAU` auf `false` gesetzt und der
     Eintrag als widerlegt vermerkt.

**Zwischenstand 00:07 - Pruefpunkt 1 ist bestanden.** `data/blade.json`
meldet `"grund":"Stufenaufbau 5/12"` und `"stufe":5` nach 28 Minuten - das
Kriterium war Stufe 6 nach einer Stunde. Die Dauer steht bei **116 s** gegen
121 s aus der Rechnung (96 x 1,06^4); die Abweichung nach unten kommt von den
gestiegenen Kampfwerten, die in `statFac` eingehen (`Action.ts:112-117`).

Die Rangrate liegt bei **30,4/min** seit 23:39 - wie erwartet unter den 53,4
des Raid-Zyklus, das ist der Preis des Aufbaus. Pruefpunkt 2 (Rate nach dem
Aufbau) steht noch aus; Stufe 12 ist gegen 02:30 zu erwarten.

Verdacht auf eine Schwachstelle: Die Chance faellt mit der Stufe
(`difficultyFac` 1,06, bei Stufe 12 das 2,01fache). Bei Stufe 1 stand sie
auf 1,000 - wo sie unter `SICHER_OPERATION` = 0,85 faellt, hoert der Aufbau
von selbst auf, und dann ist die erreichte Stufe die Antwort auf die Frage,
wie weit es ueberhaupt geht.

</details>

---

### WIDERLEGT: Die Chaos-Hysterese hatte recht, mein Verdacht nicht (28.08., 02:10)

Um 01:57 stand hier der Verdacht, die Chaos-Hysterese blockiere den
Wiederaufbau: Der Motor fuhr nach dem Einbau durchgehend Diplomacy, waehrend
das Powerhouse Gym mit `expMult` 10 die Kampfwerte haette heben koennen.
**Nachgerechnet ist Diplomacy dort die klar bessere Aktion.**

Die Formel steht in `Actions/Action.ts:169-196`:

    difficulty *= this.getChaosSuccessFactor(inst)
    return Math.min(1, competence / difficulty)

und der Faktor ist `sqrt(1 + chaos - 50)` ab Chaos 50
(`Action.ts:94-100`, `ChaosThreshold` 50 in `Constants.ts:31`). Bei den
gemessenen **58,3** sind das **3,05** auf die Schwierigkeit.

Damit steht der Vergleich:

    Diplomacy   Chaos 58,3 -> 47   14 Laeufe = 14 Minuten
                Chance danach mal 3,05

    Gym         dieselbe Wirkung ueber die Kampfwerte braucht
                3,05^(1/0,8) = Faktor 3,95, also 120 -> 474
                das sind Stunden, nicht Minuten

**Verifiziert 02:08, ohne jeden Eingriff:** `data/blade.json` meldet
`"aktion":"Operations/Assassination"`, `"grund":"Stufenaufbau 10/12
(Chance 1.000)"`. Die Chance sprang von 0,354 auf 1,000, sobald das Chaos
unter der Schwelle war - genau um den gerechneten Faktor. Der Rang stieg in
derselben Zeit von 22.867 auf 23.628.

**Die Lehre:** Ich habe eine Aktion, die "null Rang gibt", fuer wertlos
gehalten, ohne ihren Multiplikator auf alles Uebrige zu rechnen. Diplomacy
verdient nichts - es macht alles andere dreimal wahrscheinlicher. Wer nur
den direkten Ertrag misst, sieht solche Aktionen nie.

**Was von der Aenderung um 01:52 bleibt:** Die Weichen-Regel prueft jetzt
zusaetzlich, ob ueberhaupt eine Operation oder ein Vertrag ueber ihrer
Schwelle liegt. Sie greift in dieser Lage nicht - und das ist richtig so.
Sie bleibt als Abdeckung fuer den Fall, dass auch Diplomacy nichts mehr
bringt: Chaos schon unter 47, Kampfwerte trotzdem zu schwach. Harmlos und
enger als die alte `tiefstand < 100`.

<details><summary>Der widerlegte Eintrag von 01:57</summary>

### Die Chaos-Hysterese hat Vorrang vor allem - auch vor dem Wiederaufbau (01:57)

Gemessen: Nach dem Einbau um 01:25 faehrt der Motor durchgehend
`General/Diplomacy` bei Chaos 58,3 - fuenf Messungen im Abstand von 20
Sekunden, alle gleich. Kampfwerte 101/105/121/101, Chancen
(`src/astufe.js`, 01:39): Assassination 0,354, Raid 0,230, Stealth
Retirement 0,561 - alle unter `SICHER_OPERATION` 0,85.

Erwartet: In der Wiederaufbauphase gehoert die Figur ins **Powerhouse Gym**.
Es hebt den Kampfwert-Tiefstand mit `expMult` 10 (`bbtrain.js:50`), waehrend
Diplomacy **null Rang und null Erfahrung** gibt. Bladeburner-Training waere
mit 30 exp je 30 s auf alle vier (`Bladeburner.ts:1092-1103`) immer noch
zehnmal langsamer als das Gym.

**Was um 01:52 eingebaut wurde und warum es nicht reicht:** Die Weichen-Regel
in `blade.js` prueft jetzt nicht mehr nur `tiefstand < 100` (nach einem
Prestige mit hohen Multiplikatoren ist das binnen Minuten wieder erfuellt),
sondern auch, ob ueberhaupt eine Operation oder ein Vertrag ueber seiner
Schwelle liegt. **Sie greift trotzdem nicht** - offenbar steht mindestens ein
Vertrag ueber `SICHER_VERTRAG` = 0,45, also gilt die Arbeit als lohnend.

Und genau dann schlaegt die naechste Regel zu: `waehle()` prueft die
Chaos-Hysterese (`CHAOS_EIN` 50 / `CHAOS_AUS` 47) **vor** der Vertragswahl
und faehrt Diplomacy, bis das Chaos unter 47 liegt. Von 58,3 aus sind das bei
rund 1,5 Prozent je Lauf etwa **14 Minuten ohne jeden Ertrag** - und ohne
Gym, weil die laufende Bladeburner-Aktion die Gym-Arbeit blockiert.

Verdacht auf die Fundstelle: `src/blade.js`, der Block `if (SPIEL_CHAOS_AN)`
in `waehle()`. Die Hysterese ist fuer den Normalbetrieb richtig - dort kostet
Chaos ueber 50 den Faktor `sqrt(1+chaos-50)` auf die Schwierigkeit
(`getChaosSuccessFactor`), bei 58,3 also 3,05. Im Wiederaufbau ist der
Kampfwert aber der viel groessere Hebel, und Diplomacy blockiert das Mittel,
das ihn hebt.

Zu tun: (1) Entscheiden, ob die Chaos-Phase im Wiederaufbau ausgesetzt wird -
gerechnet, nicht geschaetzt: Chaos-Faktor 3,05 gegen den Erfahrungsgewinn von
14 Minuten Gym. (2) Falls ja, die Weichen-Regel VOR die Chaos-Pruefung
ziehen, nicht nur die Bedingung erweitern.

</details>

---

### Chance-Faehigkeiten werden gedaempft, wenn die Chance klemmt - VERIFIZIERT (28.08., 01:14)

`getSuccessChance` klemmt bei 1,00 (`Actions/Action.ts`). Steht eine Aktion
dort, verpufft jeder weitere competence-Zuwachs. `relNutzen` hat das bis
01:10 nicht gewusst und den prozentualen Zuwachs voll angerechnet - deshalb
kaufte der Motor um 00:54 Blade's Intuition auf Stufe 45 fuer **95 Punkte**,
mit einem ausgewiesenen Nutzen von 1,293 Prozent. Der wahre Nutzen war null:
Raid stand bei 1,0 bis 1,0 (21:40), Assassination bei 1,000.

**Kein pauschales Abschalten, sondern eine Messung.** Bei Black Ops klemmt es
nicht - Operation Ares stand um 00:53 bei 0,758 bis 1,000, und dort wirken
diese Faehigkeiten voll. Wer sie generell abwertet, laesst genau die
verhungern, die den Knotenausgang tragen.

`klemmFaktor()` in `src/blade.js` nimmt deshalb zwei Sonden - die naechste
Black Op und die beste laufende Operation - und gibt den Anteil derer
zurueck, die noch unter 0,999 stehen. Bei Ares offen und Assassination
geklemmt sind das **0,5**. Untergrenze 0,05, damit die Faehigkeiten wieder
anziehen koennen, wenn eine schwere Black Op ansteht.

**Verifiziert 01:14, ueber sechs Messungen in zwei Minuten:**

    Blade's Intuition   45  ->  45   (kein Kauf mehr)
    Overclock           16  ->  23   (sieben Kaeufe)

Vor der Aenderung war es umgekehrt: Blade's Intuition stieg, Overclock stand.
Der Motor laeuft unveraendert weiter (Assassination-Stufenaufbau 8 von 12).

Und die Rangrate zieht an: **58,7 Rang/min** im Fenster 01:07 bis 01:14
(`strategie-check`) gegen 38,1 waehrend des Aufbaus seit 23:39. Das ist ein
kurzes Fenster und enthaelt beide Hebel - Overclock und die gestiegene
Assassination-Stufe -, die Trennung misst der naechste Optimierlauf.

<details><summary>Der urspruengliche Eintrag</summary>

### relNutzen rechnet Chance-Faehigkeiten voll an, obwohl die Chance bei 1,00 klemmt (00:58)

Gemessen: Raid steht bei **1,0 bis 1,0** (21:40), Assassination bei
**1,000** (00:53). Trotzdem gibt `relNutzen` in `src/blade.js` fuer
Blade's Intuition auf Stufe 44 einen Nutzen von 1,293 Prozent aus und
kaufte sie um 00:54 auf Stufe 45 - fuer 95 Punkte.

Erwartet: Der Nutzen einer Chance-Faehigkeit ist **null**, sobald die
Aktionen, auf die sie wirkt, bei 1,00 stehen. `getSuccessChance` klemmt dort
(`Actions/Action.ts`), jeder weitere competence-Zuwachs verpufft.

Verdacht: `src/blade.js`, `relNutzen` und `CHANCE_SKILLS`. Die Abdeckung
ist als feste Zahl hinterlegt (`abdeckung: 1.0` fuer Blade's Intuition), sie
muesste stattdessen die Aktionen zaehlen, deren Chance **noch nicht** klemmt.

Vorsicht bei der Umsetzung: Fuer **Black Ops** gilt die Klemme nicht - Ares
stand um 00:53 bei 0,758 bis 1,000. Eine Faehigkeit, die dort wirkt (Digital
Observer trifft alle 21), behaelt ihren Wert. Der Fix ist also kein
Abschalten, sondern eine Abdeckung, die misst statt zu raten.

</details>

---

### WIDERLEGT: bn4rep.js ist nicht tot - drei eigene Fehlalarme in Folge (28.08., 00:52)

Der Sofort-Punkt von 00:11 war falsch, und die beiden Verdachtsmomente, die
daraus folgten, ebenfalls. Alle drei sind gemessen und entkraeftet.

**(1) "bn4rep.js schreibt seit 55 Stunden nicht."** Gemessen 00:38:
`data/hb-rep.txt` ist **22 Sekunden** alt, `data/rep-ziel.txt` nennt das
aktuelle Ziel "Nanofiber Weave" samt vollstaendiger Rangliste. Das Skript
arbeitet.

`data/bn4rep.json` taugt nicht als Lebenszeichen - und das steht seit dem
24.08. im Code, in `bn4rep.js:389`: Das Skript steigt an mindestens vier
Stellen vor der Telemetriezeile aus der Runde aus (Firmenphase, nichts mehr
zu kaufen, Ausgangsphase, leere Zielliste). Genau davor warnt der Kommentar,
und genau in die Falle bin ich gelaufen. **Die Warnung stand nicht dort, wo
jemand sie sucht** - deshalb steht sie jetzt oben in den Regeln dieser Datei.

**(2) "I.N.T.E.R.L.I.N.K.E.D fehlt in der Bewertungstabelle."** Sie heisst im
Spiel mit Punkten (`Augmentation/Enums.ts`), mein `grep` suchte nach
"INTERLINKED". Ein Abgleich aller **19** Bladeburner-Augmentierungen aus
`Augmentations.ts` gegen `COMBAT_AUGS` in `src/lib/hackaugs.js` ergibt:
**keine einzige fehlt**, bei der `combatNutzen` groesser null waere.

**(3) "Die Geldreserve von 888 Mrd blockiert die teuren Stuecke."** Umgekehrt:
`bn4rep.js:996` **schreibt** `data/geldbedarf.txt`, und `bn4net.js:578`
sowie `bn4life.js:246` **lesen** ihn als Tabu-Betrag. Es ist ein Kanal von
der Augmentierungsplanung an den Serverkauf, keine Sperre gegen sie.

**Was tatsaechlich laeuft:** 22 Augmentierungen eingebaut, **zwei in der
Warteschlange** (BLADE-51b Tesla Armor: IPU Upgrade, Vangelis Virus), 71.851
Bladeburner-Reputation, Favor 26,8, Geld 7,76 Mrd. Von den 17
Bladeburner-Augmentierungen sind 5 eingebaut und 12 offen.

**Die Lehre, und sie ist teurer als die drei Fehlalarme:** Ein Zeitstempel
belegt, wann zuletzt geschrieben wurde - nicht, ob gearbeitet wird. Wer
daraus auf Stillstand schliesst, diagnostiziert die Datei statt des
Programms. Die Gegenprobe kostet einen Aufruf: erst den Puls lesen, dann
urteilen.

<details><summary>Der falsche Sofort-Punkt von 00:11</summary>

### bn4rep.js laeuft, schreibt aber seit 55 Stunden nicht mehr (00:11)

Gemessen: `data/ps.json` um 00:09 zeigt `bn4rep.js` als PID 26 - der
Prozess lebt. Aber `data/bn4rep.json` traegt den Zeitstempel
1787670308432 = **25.08. um 17:05**, also **55 Stunden alt**.

Erwartet: Die Datei wird in jeder Runde neu geschrieben. Ein Prozess, der
laeuft und nichts schreibt, haengt in einem Zweig ohne Rueckweg.

Der Inhalt bestaetigt, wie alt er ist:

    hacking 100, multHacking 1,387, repGesamt 9.562
    faktionen: Aevum, Sector-12, Slum Snakes, CyberSec
    ziel: "Cranial Signal Processors - Gen II" (CyberSec)

**Bladeburners steht nicht in der Faktionsliste** - dabei sind dort bei Rang
19.327 rund 38.654 Reputation verdient
(`RankToFactionRepFactor 2`). Die gesamte Augmentierungsplanung laeuft
also an der einzigen Faktion vorbei, die in diesem Knoten etwas beitraegt.

Verdacht auf die Fundstelle: `src/bn4rep.js:1093` haelt selbst fest, dass
"jede Arbeit die laufende Bladeburner-Aktion abbricht". Wahrscheinlich
wartet das Skript auf eine Faktionsarbeit, die `blade.js` ihm in jeder
Runde wieder wegnimmt - eine Warteschleife ohne Ausgang. Zu pruefen ist
auch die `bladeSperre` bei `:651`, die aber greifen duerfte, weil
`inBladeburner()` heute true ist.

**Warum das dringend ist:** Geld steht bei **6,07 Mrd**, INTERLINKED kostet
5,5. Der groesste Dauerhebel des Knotens ist finanzierbar, und der
Automatismus, der ihn ziehen soll, ist seit zwei Tagen blind.

**Und eine Abwaegung gehoert dazu, bevor jemand den Einbau ausloest:** Ein
Prestige setzt die Kampfwerte zurueck (`Prestige.ts`), Rang und
Aktionsstufen bleiben (`Bladeburner.ts:259-263`). Der laufende
Assassination-Aufbau (Stufe 5 von 12 um 00:07) wuerde dadurch abbrechen -
seine Chance faellt unter `SICHER_OPERATION`, bis die Kampfwerte wieder
stehen. Der Einbau gehoert also **nach** den Aufbau, nicht mitten hinein.


### Wartet bis Eric: zwei Handgriffe im Spiel (19:45, belegt 20:45)

**Belegt, nicht vermutet:** `Settings.AutoexecScript` steht im Spielstand auf
`""` - gelesen 20:45 ueber `getSaveFile` (`save.data.SettingsSave`), also
ohne Browser. Von aussen ist das Feld nicht setzbar: Die Remote File API kennt
`getSaveFile`, aber kein Gegenstueck zum Schreiben, und keine ns-Funktion
fasst `Settings` an. Der Punkt ist deshalb kein Loop-Auftrag, sondern eine
Eric-Sache - die Ueberschrift sagt das jetzt, damit er den Loop nicht jeden
Lauf blockiert.

Beide sind Ein-Klick-Sachen fuer Eric und von aussen nicht setzbar. Die
Aufsicht prueft sie und erinnert daran, statt dass sie jemand vergisst.

**1. Autoexec auf `boot.js`** — Options -> System -> "Autoexec Script + Args".
`Settings.AutoexecScript` wird beim Laden der Seite auf `home` gestartet
(`NetscriptWorker.ts:185-253`). Damit heilt sich der Bot nach jedem
Seitenladen selbst. Risikofrei, weil `boot.js` idempotent ist — es prueft
`ns.ps("home")`, bevor es etwas startet (`boot.js:86,118`).

Was ohne diesen Schalter NICHT gedeckt ist — und nur das:

    Rechnerneustart        gedeckt: die Engine stellt laufende Skripte
                           selbst wieder her (loadAllRunningScripts)
    geplanter Einbau       gedeckt: bn4rep.js:960 ruft
                           installAugmentations("boot.js")
    alles tot, kein Reset   NUR ueber Autoexec

**Damit korrigiere ich meine eigene Darstellung von 19:44:** Das Loch ist
kleiner, als ich es genannt hatte. Der Rechnerneustart ist kein Fall — die
Engine startet die laufenden Skripte aus dem Spielstand neu. Es bleibt der
Totalausfall ohne Prestige.

**2. Opera mit `--remote-debugging-port=9222`.** Port 9222 ist zu. Solange
das so ist, kann kein Skript pruefen, ob der Spiel-Tab lebt, und keine
Sitzung im Notfall etwas im Spielterminal eintippen. Das ist der letzte
Punkt, an dem das System einen Menschen braucht — aber ein seltener: Er
greift nur, wenn Autoexec (Punkt 1) und der Einbau-Rueckruf beide versagen.

</details>

---

### Der Assassination-Aufbau laeuft - EINGEBAUT und verifiziert (27.08., 23:42)

**Verifiziert 23:39:** `data/blade.json` meldet
`"aktion":"Operations/Assassination"` mit dem Grund
`"Stufenaufbau 1/12 (Chance 1.000)"`. Die Regel greift.

**Zuerst die Korrektur meiner eigenen Rechnung von 23:12.** Dort stand,
Assassination brachte auf Stufe 9 "125 Rang je 96 Sekunden = 78,5 Rang je
Minute". Das ist falsch: Die **Dauer waechst mit der Schwierigkeit**, und
zwar linear (`Action.ts:105-121`: `baseTime = difficulty /
DifficultyToTimeFactor`, `difficulty = baseDifficulty x difficultyFac^(level-1)`).
Bei Stufe 9 stehen 153 Sekunden statt 96, macht **49,2 Rang je Minute** -
unter dem Raid-Zyklus, nicht darueber.

**Was nach der Korrektur bleibt, traegt trotzdem** - es steht in zwei
Konstanten je Operation:

    Aktion         rewardFac  difficultyFac  netto je Stufe
    Raid                1,10          1,045          1,0526
    Stealth Ret.        1,11          1,050          1,0571
    Assassination       1,14          1,060          1,0755

Assassination hat das beste Verhaeltnis und waechst deshalb mit **7,55
Prozent je Stufe**, waehrend Raid nur 5,26 schafft. Von der Basisrate 27,5
Rang/min (Stufe 1, gemessen 20:41):

    Stufe 11   56,9   ->  schlaegt den Raid-Zyklus (53,4)
    Stufe 12   61,2
    Stufe 15   76,4
    Stufe 20  110,0   ->  und weiter, ohne Deckel

**Der Aufbau ist fast umsonst.** 96 Erfolge bis Stufe 12
(`ceil(0,5 x n x (2 x 2,5 + n - 1))`, `LevelableAction.ts:54-56`,
`OperationSuccessesPerLevel` 2,5) bei im Mittel 130 Sekunden sind 3,5
Stunden. Dabei entsteht selbst Rang - im Mittel 42 je Minute gegen 53,4 des
Raid-Zyklus. **Nettokosten rund 2.700 Rang** gegen die 163 Stunden Stealth
Retirement, die sonst nach dem Raid-Vorrat drohen.

**Warum der Motor es nicht von allein tat:** `beste()` rechnet den Ertrag
bei der aktuellen Stufe (`blade.js`, `RANG_JE_ERFOLG` x
`REWARD_FAC^(stufe-1)` / Dauer). Eine Aktion mit Aufbaukosten gewinnt in
einer Momentaufnahme nie - sie braucht eine Regel, die den Aufbau als
Investition behandelt. Das ist derselbe Denkfehler wie bei den
Faehigkeitsdeckeln um 20:33: Eine Sortierung nach Grenznutzen sieht nur den
naechsten Schritt.

Die Nachmessung steht als eigener Punkt in `nodes/BAUSTELLEN.md`.

<details><summary>Der Eintrag von 23:12, mit dem Rechenfehler</summary>

### Assassination ist das einzige unbegrenzte Rangfahrzeug - und es steht auf Stufe 1 (23:12)

Gemessen: `getActionCurrentLevel("Operations", "Assassination")` = **1**,
Chance **0,999 bis 1,000**, Dauer 96 s (`src/sr.js` um 20:41 und
`src/trupp.js` um 21:40). Der Motor hat es nie gefahren, weil Raid bei
Stufe 9 mehr Rang je Minute gibt.

Erwartet: **Assassination schlaegt den Raid-Zyklus, sobald es Stufe 9
erreicht** - und der Aufbau kostet 94 Minuten.

Die Zahlen aus `data/Operations.ts` und `Actions/LevelableAction.ts`:

    Aktion         rankGain  rewardFac  Dauer   Vorrat        Chaos
    Raid                 55       1,10   73 s   361 comms     +3 %
    Assassination        44       1,14   96 s   unbegrenzt    -5..+5 %
    Stealth Ret.         22       1,11   78 s   unbegrenzt    -2 %

**`rewardFac` 1,14 ist der hoechste im Spiel.** Bei Stufe 9 gibt
Assassination `44 x 1,14^8` = **125 Rang** je 96 Sekunden = 78,5 Rang je
Minute - und zwar **ohne Begleitaktion**, weil sein Chaos-Effekt im Mittel
null ist (`getRandomIntInclusive(-5, 5)`, `Bladeburner.ts:859`).

Der Raid-Zyklus kommt dagegen nur auf **53,4 Rang/min**, weil jeder Raid 1,5
Stealth Retirements zum Chaos-Ausgleich braucht. **Assassination ist also
schon heute die bessere Aktion - sobald die Stufe steht.**

Der Aufbau ist billig:
`getSuccessesNeededForNextLevel = ceil(0,5 x maxLevel x (2 x 2,5 + maxLevel - 1))`
(`LevelableAction.ts:54-56`, `OperationSuccessesPerLevel` 2,5,
`Constants.ts:45`):

    Stufe  9   ->   59 Erfolge kumuliert  =  94 min
    Stufe 12   ->   96                    = 154 min
    Stufe 15   ->  143                    = 229 min

Der Verbrauch ist vernachlaessigbar: `changePopulationByCount(-1)`
(`Bladeburner.ts:857`) - **eine einzige Person je Lauf**, gegen die 0,5
Prozent, die Stealth Retirement kostet.

Verdacht auf die Stellschraube: `SICHER_OPERATION` = 0,85 in
`src/blade.js` und die Nutzenrechnung in `beste()`, die nach Rang je
Minute bei der **aktuellen** Stufe sortiert. Sie sieht Assassination auf
Stufe 1 mit 27,5 Rang/min und waehlt Raid - eine Aktion mit Aufbaukosten
gewinnt in einer Momentaufnahme nie. Es braucht eine Anlaufregel: erst 59
Erfolge Assassination, dann vergleichen.

Zu tun: (1) Die Aufbauphase in `blade.js` einbauen, mit Abbruch, wenn die
Chance unter `SICHER_OPERATION` faellt (`difficultyFac` 1,06 hebt die
Schwierigkeit bei Stufe 9 auf das 1,59fache). (2) Nach dem Aufbau die
Rangrate ueber 45 Minuten messen und gegen die 53,4 des Raid-Zyklus halten.
(3) Traegt es, ist der Punkt "Phase 2" der ETA-Rechnung hinfaellig - dann
gibt es kein Rangloch nach dem Raid-Vorrat.

</details>

---

### Die Rueckstandsmessung laeuft - VERIFIZIERT, und die Praemisse ist entfallen (27.08., 22:40)

Der Punkt hatte drei Auftraege. Zwei sind erledigt, der dritte ist keiner
mehr.

**(1) `rueckstand.js` gehoert in den Reportloop.** Erledigt und
nachgezaehlt: Der Aufruf steht in `loops/loop-report.md` (einmal) und in
`loops/loop-wache.md` (zweimal - dort ist er der erste Schritt bei
STAGNATION, weil ein aufholendes Spiel wie ein stehendes aussieht).

**Verifiziert 22:38** an der Messreihe selbst (`data/rueckstand.json`):

    von 18:49 bis 22:38 - 3,8 Stunden, 9 Punkte
    storedCycles: 8, 7, 6, 8, 6, 7, 5, 4, 7
    Maximum 8 Zyklen = 0,03 Minuten Rueckstand

Kein Trend, keine Drosselung. Die Reihe schwankt um 6,5 und liegt damit
dort, wo ein durchlaufender Tab sie erwarten laesst.

**(2) "Nach drei Tagen entscheiden, ob 5,5 Stunden reichen" - die Frage
stellt sich nicht mehr.** Eric hat am 27.08. entschieden, den Rechner
durchlaufen zu lassen ("egal alles bleibt wie es ist"), nachdem die Kosten
bei 27 Cent je kWh gerechnet waren. Damit ist die Gleichgewichtsrechnung
`T_on * 4 = 24 - T_on` -> 4,8 h gegenstandslos: Bei 24 Stunden Laufzeit
gibt es keine Offline-Zeit aufzuholen. **Die Rechnung war richtig, ihre
Voraussetzung ist weggefallen.**

**(3) "Waechst der Rueckstand, ist die Drosselung der erste Verdacht."**
Das bleibt gueltig und ist der eigentliche Grund, warum die Messreihe
weiterlaeuft. Ein verdeckter Tab bekommt eine Timer-Weckung je Minute
(`doku/drosselung.md`), und dann faellt der Abbau von 5 s/s auf 5 s/min -
Faktor zwoelf. Das ist die einzige Stoerung, die kein anderes Werkzeug
sieht, und sie kann jeden Tag eintreten, an dem jemand den Tab in den
Hintergrund schiebt. Die Ueberwachung steht, der Auftrag ist erledigt.

<details><summary>Der urspruengliche Eintrag</summary>

### Der Rechner laeuft nur 5,5 von 24 Stunden - die Schwelle liegt bei 4,8 (18:52)

**Gemessen um 18:49: `storedCycles` = 8, Rueckstand 0,0 Minuten.** Der Tab ist
also nicht gedrosselt und es haengt nichts hinterher. Das ist der Ausgangswert
einer Messreihe, kein Entwarnungssignal - der Rechner lief bisher durch.

Eric hat kein Homeoffice; der Rechner laeuft kuenftig etwa **15:30 bis 21:00**.
Bitburner verliert dadurch keinen Bladeburner-Rang: `engine.tsx:333` legt die
Offline-Zeit vollstaendig als `storedCycles` zur Seite (`Bladeburner.ts:275`,
`clampInteger(..., 0)` - keine Obergrenze), und `process()` arbeitet sie mit
hoechstens fuenf Spielsekunden je Aufruf ab (`Bladeburner.ts:1375-1378`), einmal
je Realsekunde (`engine.tsx:150,201` plus `MilliPerCycle 200`).

    Abbau je Realstunde = 5 h Spielzeit, davon 1 h "neu"  ->  netto 4 h
    Gleichgewicht:  T_on * 4 = 24 - T_on   ->   T_on = 4,8 h am Tag

**5,5 Stunden liegen darueber - aber der Puffer sind 42 Minuten.** Ein
kuerzerer Tag, und der Rest bleibt stehen und summiert sich. Ausserdem gehen
4,6 der 5,5 Stunden fuers Aufholen drauf; in dieser Zeit laeuft das Spiel
fuenffach beschleunigt, waehrend die Claude-Loops in Echtzeit takten - die
Strategie entscheidet also fuenfmal traeger, als das Spiel laeuft.

**Der zweite Weg unter die Schwelle ist die Tab-Drosselung.** Ein verdeckter
Tab bekommt eine Timer-Weckung je Minute (`doku/drosselung.md`), dann faellt
der Abbau von 5 s/s auf 5 s/min - Faktor zwoelf. Damit reicht auch ein
durchlaufender Rechner nicht mehr.

Werkzeug dafuer ist neu: `node tools/rueckstand.js` liest `storedCycles` aus
dem Spielstand (die API kennt es nicht), schreibt es nach
`data/rueckstand.json` fort und meldet den Trend je Stunde. Es gehoert in den
Reportloop, damit aus der Rechnung oben eine Messreihe wird.

Zu tun: (1) Den Aufruf in den Reportloop aufnehmen. (2) Nach drei Tagen
entscheiden, ob 5,5 Stunden reichen - **an der Messreihe, nicht an dieser
Rechnung**. (3) Waechst der Rueckstand, ist die Drosselung der erste Verdacht,
nicht die Rechnerzeit.

</details>

---

### Die Black-Op-Schwelle faellt zurueck, wenn Raid ausgeht - VERIFIZIERT (27.08., 22:12)

Die 0,90 von 21:55 ruhen auf einer Annahme: dass Raid mit 98,3 Rang je
Minute die bessere Verwendung der Zeit ist. `blackOpSchwelle()` in
`src/blade.js` prueft diese Annahme jetzt bei jeder Entscheidung, statt sie
vorauszusetzen - liegt der Vorrat ueber alle sechs Staedte unter
`RAID_VORRAT_GESAMT_MIN` = 20, faellt die Schwelle auf 0,40 zurueck.

**Verifiziert 22:11** (`src/vorrat.js`, ein Aufruf ueber den Auftragskanal):

    Sector-12 2 | Aevum 49 | Volhaven 17 | Chongqing 128 | New Tokyo 122
    Ishima 43   |   gesamt 361   |   Fehler: keine   |   Schwelle 0,90

Die Messung prueft genau die Stelle, die stillschweigend kippen koennte:
Antwortet `getCityCommunities` fuer auch nur eine Stadt nicht, faellt die
Summe und mit ihr die Schwelle - ohne dass es jemand merkt. Alle sechs
antworten.

**Der Vorrat ist praktisch endlich.** `randomEvent()` laeuft alle 240 bis 600
Spielsekunden (`Bladeburner.ts:1402-1406`), und nur 5 Prozent davon sind
"New Synthoid Community" (`:613-615`). Das sind **0,43 Gemeinden je Stunde**
gegen einen Verbrauch von rund 19 - der Vorrat von 361 haelt etwa **19
Stunden**, dann greift der Rueckfall. Ohne ihn waere der Bot in eine Falle
gelaufen: warten auf eine Chance, die er sich ohne Raid nur noch aus
Vertraegen erarbeiten kann, bei 8,7 Rang je Minute statt 98.

Nebenbei sichtbar geworden: Nach dem Neustart um 22:12 stand der Fortschritt
bei **+558 Rang in 7 Minuten = 79,7/min** gegen 24,4 im 45-Minuten-Fenster
davor. Das Fenster ist zu kurz fuer eine Aussage - der naechste Optimierlauf
misst es geglaettet -, aber die Richtung stimmt mit der Hypothese von 21:55
ueberein.

<details><summary>Der urspruengliche Eintrag</summary>

### Die Black-Op-Schwelle 0,90 braucht einen Rueckfall, wenn Raid ausgeht (21:55)

Gemessen: `SICHER_BLACKOP` steht seit 21:55 auf 0,90 statt 0,40, weil Raid
mit 98,3 Rang/min die bessere Alternative ist (Rechnung in
`nodes/HEBEL.md`). Das gilt nur, **solange es Raid-Gemeinden gibt**: 384
ueber alle sechs Staedte, rund 45.000 Rang.

Erwartet: Sind sie aufgebraucht, ist Raid keine Alternative mehr, und die
Schwelle gehoert zurueck auf 0,40 - sonst wartet der Motor auf eine Chance,
die er sich nicht mehr erarbeiten kann, und faehrt nur noch Contracts.

Verdacht: Kein Fehler, eine fehlende Regel. In `src/blade.js` gehoert die
Schwelle dynamisch: `const schwelle = raidVorratGesamt() > 20 ? 0.90 : 0.40`.
Der Vorrat laesst sich mit `getCityCommunities` ueber `STAEDTE` summieren -
die Schleife steht schon in Block 2a.

</details>

---

### Der Trupp steht bei 6 - VERIFIZIERT, und Raid ist rehabilitiert (27.08., 21:40)

**Verifiziert 21:40** (`src/trupp.js`, ein Aufruf ueber den Auftragskanal):

    trupp 6   bonus 1,1022   raid [1,0 | 1,0]   Chongqing 135 comms, Chaos 48,2
    naechste Black Op: Operation Ares, Chance 0,390 - 0,604

Damit sind beide Teilauftraege des Punktes beantwortet:

**(1) Die Regel traegt.** `TRUPP_ZIEL = 6` ist erreicht, der Bonus betraegt
**+10,2 Prozent** auf die competence jeder Operation und jeder Black Op.
Gerechnet war +9,4 - die Abweichung kommt daher, dass die Rechnung mit fuenf
Mitgliedern kalkuliert hatte.

**Die Zielgroesse 6 bleibt richtig.** Zwei weitere Mitglieder braeuchten
zweimal 206 Sekunden und braechten `(9/7)^0,05` = **+1,26 Prozent**. Bei
Operation Ares waeren das 0,390 statt 0,385 - die knapp sieben Minuten sind
anderswo mehr wert. Der Exponent 0,05 ist zu flach, als dass sich Tiefe
lohnt.

Was den Trupp am Leben haelt, ist die Regel selbst:
`BlackOperation.getMinimumCasualties()` gibt 1 zurueck
(`Actions/BlackOperation.ts:63-65`), nach jeder Black Op ist er also bei 5
und wird wieder aufgefuellt. Bei 17 verbleibenden Black Ops sind das rund 58
Minuten Rekrutierung insgesamt - gegen einen Bonus, der auf alle 17 wirkt.

**(2) Raid ist rehabilitiert - und zwar vollstaendig.** Gemessene Chance
**1,0 bis 1,0** bei Stufe 9. Die alte Ablehnung in `blade.js`
("`SICHER_OPERATION` 0,85 schliesst die gesamte Aktionsklasse aus, alle
sechs Operationen liegen zwischen 0,04 und 0,19", 26.08. um 16:20) galt bei
Charisma 27 und ohne Trupp. Heute steht Raid am Anschlag, faehrt als
Hauptaktion und hat in Chongqing noch 135 Gemeinden Vorrat.

<details><summary>Der urspruengliche Eintrag</summary>

### Der Bot rekrutiert nie ein Team - +9,4 Prozent auf jede Black Op fuer 24 Minuten (19:57, durchgerechnet 19:50)

Gemessen: `teamCount` ist 0 (`src/chance.js`, 18:19). Kein Skript in `src/`
ruft `setTeamSize` oder faehrt `General/Recruitment` - null Treffer im grep.

Beleg: `operationTeamSuccessBonus = (teamCount + 1)^0,05`
(`Actions/Operation.ts:96-98`) gilt fuer Operationen **und Black Ops** -
multiplikativ auf die competence, also auf die volle Reststrecke von 20
Black Ops.

**Charisma ist 264, nicht 27.** Damit ist `charisma^0,45 = 12,29`, und die
Rekrutierungschance `charisma^0,45/(teamSize+1)` (`data/GeneralActions.ts:
29-31`) steht **bis elf Mitglieder auf 1,00** - jeder Versuch sitzt. Erst
darueber faellt sie. Die urspruengliche Schaetzung von 3,8 Stunden ging von
Charisma 27 aus und war um Faktor vier zu pessimistisch.

Durchgerechnet, Dauer 285 s je Versuch:

    bis  5 Mitglieder   5 Versuche   0,40 h   Bonus  +9,4 %    23,7 %/h
    bis 11              11           0,87 h         +13,2 %     8,1 %/h
    bis 15              15           1,22 h         +14,9 %     4,7 %/h
    bis 20              23           1,80 h         +16,4 %     2,7 %/h
    bis 30              43           3,44 h         +18,7 %     1,2 %/h

**Der Grenznutzen bricht nach fuenf Mitgliedern um Faktor drei ein**, weil der
Exponent 0,05 extrem flach ist. Die ersten 24 Minuten bringen 9,4 Prozent,
die naechsten drei Stunden zusammen nur noch 9,3.

**Zielgroesse ist also 5 bis 8, nicht 20.** Und das haelt sich leicht selbst:
`BlackOperation.getMinimumCasualties()` gibt 1 zurueck
(`Actions/BlackOperation.ts:63-65`), aber solange die Chance auf 1,00 steht,
kostet jeder Ersatz genau einen Versuch - knapp fuenf Minuten.

**Der eigentliche Preis daneben:** `Raid` hat in `data/bbspann.json` einen
Ertrag von **66,3 Rang je Minute** gemessen - gegen 18 bis 32, die der Motor
gerade faehrt. Raid verlangt ein Team und Bevoelkerung in der Stadt. Ob es
mit fuenf Mitgliedern fahrbar wird, ist die Frage, die diesen Punkt vom
netten Bonus zum groessten Hebel des Knotens macht. Die frueheren
Raid-Rechnungen in `nodes/HEBEL.md` gingen alle von Charisma 27 aus und
gehoeren mit 264 neu aufgemacht.

Zu tun: (1) In `blade.js` eine Regel, die `General/Recruitment` faehrt,
solange `getTeamSize` unter 6 liegt - aber nur, wenn keine Black Op ansteht
und die Ausdauer nicht knapp ist. (2) Danach messen, ob `Raid` seine
Mindestchance erreicht, und die alte Ablehnung mit den neuen Zahlen
pruefen.

</details>

---

### Das Autonomieloch ist geschlossen - VERIFIZIERT (27.08., 21:12)

**Die Kostenfrage ist beantwortet, und zwar gemessen statt geschaetzt.** Zwei
`claude -p`-Laeufe mit `loops/loop-wache.md` ueber `--output-format json`:

    Lauf 1   0,2162 USD   10,4 s   Ergebnis "SPUR."
    Lauf 2   0,2188 USD   10,3 s   Ergebnis "SPUR."

Der zweite Lauf ist die eigentliche Antwort: `cache_creation` 17.791 gegen
`cache_read` 66.697 - **jede headless-Sitzung zahlt ihren Kaltstart voll**,
der Cache der vorigen hilft ihr nicht. Als Dauerbetrieb waeren das allein fuer
die Wache 72 x 0,217 = **15,60 USD am Tag**, mit allen fuenf Loops grob 60 bis
150. Damit ist Punkt (2) des alten Eintrags entschieden: **Die Aufsicht
uebernimmt den Takt NICHT.** Das waere das Gegenteil von "tokenoekonomisch".

**Was stattdessen gebaut wurde: ein Notnagel** (`tools/aufsicht.js`,
Funktion `notnagel()`). Er feuert nur, wenn die Loops nachweislich stehen,
und haelt den Bot dann in Bewegung, statt ihn eine Nacht lang stehenzulassen -
24 Wachelaeufe kosten 5,20 USD.

Drei Sicherungen gegen einen schleichenden Dauerbetrieb:

  1. Ausloeser ist `data/ziele.md` aelter als **75 Minuten**. Der Reportloop
     schreibt sie alle 30 - drei verpasste Laeufe sind der Beweis, dass
     niemand mehr taktet.
  2. Mindestens **20 Minuten** zwischen zwei Laeufen (der Dauerlauf der
     Aufsicht taktet alle 10).
  3. Hartes Tageskontingent von **30 Laeufen** in `data/notnagel.json`. Ist
     es erschoepft, geht **eine** ntfy-Meldung raus und danach ist Ruhe.

**Verifiziert 21:12 im Ernstfall, nicht nur syntaktisch:** `data/ziele.md`
auf 90 Minuten zurueckdatiert, dann `node tools/aufsicht.js`. Ausgabe
"Loops stehen seit 90 min - headless-Wachelauf (1 von 30 heute)", Laufzeit
16 s, `data/notnagel.json` mit `{"laeufe":1}` angelegt. Danach
zurueckgesetzt und der Dauerlauf-Prozess mit der neuen Fassung neu gestartet
(PID 11504).

Ein Detail, das beim Bauen Zeit gekostet hat: Der Prompt geht ueber **stdin**
an `claude -p`, nicht als Argument. Er ist 10 KB lang und enthaelt
Anfuehrungszeichen, Backslashes und Zeilenumbrueche - auf der Kommandozeile
waere jedes davon eine eigene Fehlerquelle.

<details><summary>Der urspruengliche Eintrag</summary>

### Das letzte Autonomieloch: Cron-Jobs sterben mit der Sitzung (20:05)

Gemessen: `CronCreate` meldet bei jedem Job "session-only (not written to
disk, dies when Claude exits)" und "auto-expires after 7 days". Beides
zusammen heisst: **spaetestens nach sieben Tagen stehen alle fuenf Loops**,
auch wenn nichts abstuerzt.

Was heute abgedeckt ist: `tools/wache.js:464-469` erkennt stehende Loops am
Alter von `data/ziele.md` und meldet per ntfy "In Claude Code /bb-loops
aufrufen". Das ist eine Meldung an einen Menschen, keine Selbstheilung.

**Warum `claude -p` das NICHT einfach loest:** Eine headless-Sitzung endet
nach ihrem Prompt, und ihre Cron-Jobs sterben mit ihr. Sie kann also keine
Loops fuer spaeter setzen. Der einzige Weg waere, den Takt selbst zu
uebernehmen: Die Aufsicht ruft alle 20 bzw. 30 Minuten `claude -p` mit dem
jeweiligen Loop-Prompt auf, jeder Aufruf ist dann ein Loop-Lauf. Technisch
traegt das - die Prompts lesen ihren Zustand ohnehin aus Dateien und
brauchen keinen Sitzungskontext.

**Der Preis, der es zur Entscheidung macht:** rund 160 headless-Sitzungen am
Tag statt Turns in einer bestehenden. Eric hat "tokenoekonomisch" verlangt,
und ob das eine Verbesserung oder eine Verschlechterung ist, haengt daran,
was ein Kaltstart gegen einen Turn im warmen Kontext kostet. **Das ist
gemessen zu beantworten, nicht geschaetzt** - ein einzelner `claude -p`-Lauf
mit dem Wache-Prompt und ein Blick auf den Verbrauch genuegen.

Zu tun: (1) Einen `claude -p`-Lauf mit `loops/loop-wache.md` fahren und die
Kosten messen. (2) Erst danach entscheiden, ob die Aufsicht den Takt
uebernimmt. (3) Bis dahin bleibt die ntfy-Meldung der Rueckfall - sie
funktioniert, sie braucht nur einen Menschen.

</details>

---

### Die Raid-Rundreise laeuft - VERIFIZIERT (27.08., 20:45)

**Verifiziert 20:45: Der Bot steht in Chongqing.** Sector-12 war auf 4
Gemeinden herunter, die Regel aus `blade.js` (Block 2a, eingebaut 20:40) hat
bei `RAID_VORRAT_MIN = 3` gegriffen und in die Stadt mit dem groessten Vorrat
gewechselt - 138 Gemeinden. Kein Eingriff von aussen noetig, der Wechsel kam
aus dem Motor.

Gemessen dabei (`src/srtest.js`, 20:45):

    Stadt Chongqing   pop 1,641e9   chaos 66,28

Die Chaos-Hysterese hat wie vorgesehen uebernommen und faehrt die Stadt
herunter - die beiden Regeln kollidieren nicht.

Neu gerechnet mit Raid Stufe 9 (118 statt 97 Rang) und Charisma 287:
**43.976 Rang fuer 202 Minuten Diplomacy** statt der urspruenglich
veranschlagten 37.248.

<details><summary>Der urspruengliche Eintrag</summary>

### Die Raid-Rundreise: 37.248 Rang liegen in den Gemeinden anderer Staedte (20:15, gerechnet 20:23)

Beim Nachrechnen von Raid gefunden. Jede Stadt hat einen eigenen Vorrat an
Synthoid-Gemeinden (`comms`), und jeder erfolgreiche Raid verbraucht genau
eine (`Bladeburner.ts:836`). Aus dem Spielstand um 20:14:

    Stadt         pop     chaos   comms   Raid-Rang (x97)
    Sector-12     1,019e9  48,9      15             1.455
    Chongqing     2,516e9  66,5     138            13.386
    New Tokyo     2,948e9  73,8     123            11.931
    Aevum         1,907e9  86,4      49             4.753
    Ishima        1,903e9 109,3      42             4.074
    Volhaven      0,830e9 132,9      17             1.649
    ------------------------------------------------------
    gesamt                          384            37.248

**37.248 Rang sind 11,8 Prozent des Restwegs von 317.000** - und sie liegen
in einem Vorrat, den der Bot bisher gar nicht angefasst hat, weil er die
Stadt nie wechselt.

**Chaos ist der einzige Grund, warum die anderen Staedte heute unbrauchbar
sind.** `getChaosSuccessFactor` schlaegt ab Chaos 50 mit `sqrt(1+chaos-50)`
auf die Schwierigkeit; bei Chongqing sind das Faktor 4,18. Und das laesst
sich billig aufloesen: `Diplomacy` senkt das Chaos um
`charisma^0,045 + charisma/1000` **Prozent** je Lauf
(`Bladeburner.ts:735-743`), bei Charisma 264 also **1,549 Prozent**, und ein
Lauf dauert fest **60 Sekunden** (`data/GeneralActions.ts:39`).

    Chongqing  Chaos 66,5 -> 49   20 Laeufe = 20 Minuten
    New Tokyo  Chaos 73,8 -> 49   27 Laeufe = 27 Minuten
    Aevum      Chaos 86,4 -> 49   37 Laeufe = 37 Minuten

**Chongqing: 13.386 Rang fuer 20 Minuten Diplomacy.** Bei 30 Rang je Minute
normaler Arbeit entspricht das 446 Minuten - **Faktor 22**.

**Was NICHT traegt, obwohl es zuerst so aussah:** Die Bevoelkerung wirkt
ueber `(pop/1e9)^0,7` auf die competence, und Chongqing haette dort 1,908
gegen 1,013 - also +88 Prozent. Das bringt aber fast nichts, weil
`getSuccessChance` bei **1 klemmt** und die Vertraege und Operationen dort
ohnehin schon stehen (Raid 0,919, Investigation 0,981). Und auf Black Ops
wirkt die Bevoelkerung gar nicht (`BlackOperation.ts:55-61` gibt fest 1
zurueck). **Der Wert liegt allein im comms-Vorrat, nicht in der competence.**

Zu tun: (1) Eine Rundreise-Regel in `blade.js`: Ist `comms` in der aktuellen
Stadt aufgebraucht, in die Stadt mit dem groessten Vorrat wechseln
(`switchCity` ist ein reines Feldsetzen und kostet null Sekunden), dort das
Chaos per Diplomacy unter 50 druecken, dann Raid fahren. (2) Die
Reihenfolge nach `comms/Diplomacy-Minuten` sortieren - Chongqing (6,9 Rang
je Diplomacy-Sekunde) vor New Tokyo (7,4)... beide vor Aevum (2,1). (3)
Aufpassen, dass die Regel nicht mit der bestehenden Chaos-Hysterese
(`CHAOS_EIN 50`, `CHAOS_AUS 47`) kollidiert - die ist fuer die aktuelle
Stadt gedacht und wuerde beim Wechsel dasselbe tun wollen.

</details>

---

### Die Black-Op-Schwelle 0,40 hat getragen - BESTAETIGT (27.08., 19:51)

**Verifiziert: Operation Typhoon ist bestanden.** Um 19:51 meldete
`tools/spann.js` als naechste Black Op **Operation Zero** statt Typhoon - die
erste von 21 ist gefallen.

Die Schwelle stand seit 12:49 auf 0,40 statt 0,80. Gefeuert hat sie, sobald
der Motor die Chance **rechnete** statt `s.min` zu nehmen: Die gerechnete Zahl
stand bei 0,375, waehrend `s.min` nur 0,336 zeigte. Ohne die Rechnung haette
der Motor noch gewartet.

Die zwei Pruefpunkte aus dem Eintrag von 12:50:

1. **Kosten je Fehlschlag?** Nicht beobachtet - es gab keinen Fehlschlag. Die
   Korrektur von 17:51 bleibt gueltig: Der Deckel liegt bei
   `fehlendeHP * 100.000`, also bei 29 Hoechst-HP rund 2,9 Millionen, nicht
   115 oder 360.
2. **Rang unter 5.000 gefallen?** Nein. Er stand um 19:51 bei 10.092 und ist
   seither weiter gestiegen. Operation Zero verlangt 5.000 - der Rang war nie
   in der Naehe.

Der naechste Schritt aus dem alten Eintrag - Schwelle auf 0,30 - ist damit
**nicht** faellig: Die Schwelle ist nicht mehr der begrenzende Faktor, die
Chance ist es. Operation Zero steht bei 0,236 und ist `isStealth`; dort wirkt
Cloak, nicht Short-Circuit.

<details><summary>Der urspruengliche Eintrag</summary>

### Nachmessen: traegt die Black-Op-Schwelle 0,40? (12:50)
Gemessen: Typhoon-Chance min **0,116**, Mitte 0,1305 um 12:41 (`data/bbspann.json`).
Nachtrag 16:19 (`node tools/spann.js`): Chance **0,212 - 0,212, die Schaetzspanne ist ZU**. Um 15:51 stand dort noch 0,133 / 0,186. Field Analysis hat ihre Arbeit getan; der Motor rechnet ab jetzt mit einer exakten Zahl statt mit einer Untergrenze.
Damit ist die Lage klar: Der Rang ist mit **5845 gegen 2500** um mehr als das Doppelte uebererfuellt und war nie der Engpass. Der Engpass ist die Chance, und die haengt allein an den Kampfwerten. Von 0,116 (12:41) auf 0,212 (16:19) sind **+0,096 in 3,6 Stunden** - linear fortgeschrieben faellt 0,40 gegen **23:00**, was die 12-Stunden-Schaetzung von 12:50 bestaetigt. Die Schwelle steht seit 12:49 auf **0,40** statt 0,80 (`blade.js:143`), weil die alte Begruendung eine Fehlrechnung war - siehe den Commit und `nodes/HEBEL.md`.
Erwartet: Die Schwelle darf **jetzt noch nicht feuern**. Verifiziert um 12:49: Motor waehlt `Contracts/Bounty Hunter`, `URTEIL: SPUR`. Bei der gemessenen Steigerung (Faktor 1,25 je 2,5 Stunden) wird 0,40 in **rund 12 Stunden** erreicht, also gegen Mitternacht.
**KORREKTUR 17:51: Die Kostenannahme war um Faktor 40 zu hoch.** Ein
Fehlschlag kostet `min(Geld * 0,1, fehlendeHP * 100.000)`, und der ZWEITE Term
deckelt: Die Hoechstgrenze der Trefferpunkte steht bei **29**
(`data/blade.json`, 17:47), also **maximal 2,9 Millionen** - nicht 115 und
nicht 360. Dieselbe Formel steht in `nodes/HEBEL.md` beim
Krankenhaus-statt-Kammer-Hebel richtig gerechnet und mit 1,2 Millionen
GEMESSEN; beim Black-Op-Eintrag wurde nur der erste Term eingesetzt. Damit ist
auch das Abbruchkriterium unten wertlos: 150 Millionen koennen nie eintreten.

Der Grund fuer eine hohe Schwelle ist ein anderer und staerker: **die
Opportunitaetsrate.** Typhoon bringt bei Chance 0,29 und 196 Sekunden Dauer
`(0,29*50 - 0,71*10)/3,27 = 2,3 Rang je Minute`, waehrend die laufende Arbeit
**15,67** liefert. Rangmaessig lohnt Typhoon bei keiner erreichbaren Chance -
es ist ein Pflichtschritt zum Freischalten, kein Ertragsschritt. Genau deshalb
bleibt 0,40 richtig: Es geht nur darum, keine Zeit in Fehlversuchen zu
verbrennen (bei 0,40 sind es 8,2 Minuten je Black Op, bei 0,80 noch 4,1 - der
Unterschied ueber 21 Stueck ist gut eine Stunde, das Warten auf 0,80 kostet
ein Vielfaches).

Zu pruefen bleibt, sobald sie feuert: **(1)** Bleiben die Kosten bei rund 2,9
Millionen? **(2)** Faellt der Rang unter 5.000 zurueck? Operation Zero
verlangt genau das.
Abbruchkriterium (neu gefasst 17:51): Kostet ein Fehlschlag mehr als 10 Millionen oder faellt der Rang um mehr als 100, gehoert die Schwelle auf 0,80 zurueck. Traegt sie, bleibt es bei 0,40 - tiefer zu gehen bringt nichts, weil der Zeitgewinn gegen die Fehlversuche laeuft.

## Offen, nach Dringlichkeit

</details>

---

### Prompt-Drift zwischen Datei und Job - BEHOBEN (27.08., 19:22-19:45)

**Verifiziert: `grep -c Ausdauerzyklus loops/*.md` liefert jetzt 1 fuer
loop-report.md und loop-optimieren.md, vorher 0 in allen vier Dateien.** Alle
fuenf Cron-Jobs wurden danach aus den Dateien neu gesetzt (CronList um 19:34:
0ff850cd Wache, 0dab30a5 Vorankommen, 2fc6fe81 Report, dc588542 Optimieren,
9869e40d Kurs).

Der laufende Reportloop enthielt einen Absatz zur geglaetteten Rangmessung,
der in `loops/` nirgends stand. Beim naechsten Wiederaufsetzen waere er still
verlorengegangen - eine Lehre aus einer Scheindivergenz vom 26.08.

Die Regel steht jetzt im Skill `bb-loops`: **erst die Datei aendern, dann den
Job aus der Datei neu setzen** - nie umgekehrt.

<details><summary>Der urspruengliche Eintrag</summary>

### Die versionierten Loop-Prompts weichen von den laufenden Jobs ab (19:22)
Gemessen: Der aktive Reportloop enthaelt einen Absatz "Die Rangrate gehoert geglaettet gemessen ... Der Ausdauerzyklus ist laenger als ein 30-Minuten-Fenster". In `loops/loop-report.md` stand er **nicht** - `grep -c Ausdauerzyklus` lieferte 0 in allen vier Dateien. Dasselbe beim Optimierloop ("Miss geglaettet").
Erwartet: Die Dateien in `loops/` sind die Wahrheit. Der Skill `/bb-loops` setzt die Cron-Jobs **woertlich aus ihnen** neu auf.
Verdacht: Eine Prompt-Regel wurde direkt beim `CronCreate` ergaenzt, ohne die Datei nachzuziehen. Behoben 19:22 durch Rueckuebertragen beider Absaetze.
**Folgenschwer, weil es still ist:** Cron-Jobs sterben mit der Sitzung. Beim Wiederaufsetzen aus `loops/` gehen alle Regeln verloren, die nur im laufenden Job stehen - und niemand merkt es, weil der Bot weiterlaeuft. Genau die Glaettungsregel war eine Lehre aus einer Scheindivergenz vom 26.08.
**Strukturell, nicht einmalig:** Solange Prompts von Hand an CronCreate gehen koennen, driften Datei und Job wieder auseinander. Die Regel lautet ab jetzt: **erst die Datei aendern, dann den Job aus der Datei neu setzen** - nie umgekehrt.

</details>

---

### Der WERKZEUG-Kanal traf ins Leere - BEHOBEN (27.08., 19:46)

**Verifiziert: `blade.js` lief unter PID 7004 mit altem Code, obwohl der
Kanal fuenfmal bedient wurde. Nach `WERKZEUG blade.js` startete es als
PID 40117 neu, und Digital Observer stieg binnen zwei Minuten von Stufe 1
auf 4 - um 19:51 stand er auf 6.**

**Das ist die Ursache hinter zwei Sofort-Punkten**, die beide danach von
selbst verschwanden:

- *Digital Observer bleibt auf Stufe 1 (19:13).* Der Hebel war richtig
  gerechnet - `src/skillcheck.js` (neu) hat die Sortierwerte im Spiel
  nachgerechnet: Digital Observer 0,4231 gegen Blade's Intuition 0,0239,
  Faktor 17,7, und bezahlbar. Die Sortierung war nie das Problem; der neue
  Code lief nur nicht.
- *Die Geldrate ist auf 1,3 Mio/min eingebrochen (19:13).* Um 19:38 stand sie
  wieder bei **27,8 Mio/min** ueber 45 Minuten, Konto 3,96 Mrd. Der Einbruch
  war voruebergehend - vermutlich eine Einkaufsphase von `bn4net`. Kein
  Fehler, aber die Messung bleibt im Reportloop.

**Die Ursache:** `bn4net.js` vergleicht gegen `pr.filename`, und das ist
`"blade.js"`, nicht `"blade"`. Ein Befehl ohne Endung leerte die Datei,
schrieb `"0 Instanz(en) beendet, startet gleich neu"` - was sich wie ein
Erfolg liest - und tat nichts.

**Was das gekostet hat:** einen ganzen Nachmittag. Drei Aenderungen an
`blade.js` waren eingebaut, committet und "neu gestartet": die gerechnete
Black-Op-Chance (18:26), der Digital-Observer-Hebel (18:55) und dessen
Nachbesserung. Alle drei liefen nicht. Sichtbar wurde es erst durch einen
PID-Vergleich ueber fuenf Versuche.

**Behoben in `src/bn4net.js`:** Die Endung wird jetzt ergaenzt statt
verlangt, und der Kanal meldet ausdruecklich, wenn er nichts getroffen hat.

**Und sofort belohnt:** Um 19:51 ist die naechste Black Op **Operation Zero**
statt Typhoon - **Operation Typhoon ist bestanden**, die erste von 21. Genau
das, was die gerechnete Chance ermoeglichen sollte: Sie stand bei 0,375,
waehrend `s.min` noch 0,336 meldete.

<details><summary>Die urspruenglichen Eintraege</summary>

### Digital Observer bleibt auf Stufe 1, obwohl er im Plan vorn steht (19:13)
Gemessen um 19:10: **21 Faehigkeitspunkte verfuegbar, Digital Observer Stufe 1 (Preis 4)**, waehrend Blade's Intuition seit 18:52 von 26 auf **29** gestiegen ist (Preis 64). Um 18:57 lagen sogar 56 Punkte da.
Erwartet: Digital Observer wird zuerst gekauft. Er wurde um 18:55 in `DYNAMISCH` aufgenommen UND im `SKILL_PLAN` vor `Blade's Intuition` gesetzt; sein Nutzen je Punkt liegt bei 0,423 gegen 0,031 - Faktor 13,8 (Rechnung in `nodes/HEBEL.md`). Die neue Fassung IST im Spiel (`getFile blade.js` findet "abdeckung") und `data/reload.txt` wurde geleert, der Neustart lief also.
Verdacht: die Umsortierung in `faehigkeitenKaufen()` (`src/blade.js`, Block "Die drei dynamischen Eintraege an ihren Planplaetzen neu ordnen"). Zwei Kandidaten: **(1)** Die Bedingung `plaetze.length === DYNAMISCH.length` schlaegt fehl, seit `DYNAMISCH` sechs statt fuenf Eintraege hat - dann findet gar keine Sortierung statt und der Plan wirkt in seiner Rohreihenfolge. **(2)** `relNutzen("Digital Observer")` liefert 0, weil ein frueherer Zweig der Funktion greift, bevor `CHANCE_SKILLS` gelesen wird.
**Zuerst pruefen, nicht raten:** Ein Probelauf, der `relNutzen` und `getSkillUpgradeCost` fuer alle sechs dynamischen Eintraege ausgibt, entscheidet zwischen beiden in einer Minute.

### Die Geldrate ist von 22,9 auf 1,3 Mio je Minute eingebrochen (19:13)
Gemessen: `data/wache-zustand.json`, 45-Minuten-Fenster 18:26 bis 19:11: **1,3 Mio/min**. Im Fenster davor (17:53 bis 18:38) waren es **22,9**. Der Kontostand faellt: 3.507 Mio um 18:40, **3.182** um 19:10.
Erwartet: rund 23 Mio je Minute, so wie den ganzen Nachmittag ueber.
Verdacht: **offen.** Zwei Moeglichkeiten, beide pruefbar: (1) `bn4net` kauft gerade Server oder Speicher - dann ist der Rueckgang eine Investition und kein Fehler, ablesbar an `data/bn4net.json` und der Netzzeile des Pruefers (steht seit Stunden auf 66/95). (2) Die Hackschleife steht. **Wichtig, weil Geld der Engpass der Augmentierungsrunde ist** (INTERLINKED 5,5 Mrd, Golem Serum 11 Mrd) - und weil eine Nacht mit ausgeschaltetem Rechner ohnehin nur 75 Prozent des Lebensdurchschnitts einbringt.

</details>

---

### `s.min` bei Black Ops - BEHOBEN (27.08., 18:26)

**Verifiziert um 18:19 im Spiel** (`src/chance.js`, neu, schreibt
`data/chance.json`):

    API-Paar   min 0,2955   max 0,3064
    gerechnet             0,3064   <- deckungsgleich mit max, vier Stellen

Damit ist die Theorie belegt: Bei Black Ops gibt `getPopulationSuccessFactor()`
fest 1 zurueck (`Actions/BlackOperation.ts:55-61`), also ist `est === real` und
`diff = 0` - und trotzdem multipliziert `getSuccessRange` den Minimalwert mit
`city.pop/city.popEst`. Der wahre Wert ist deshalb immer einer der beiden
Randwerte; bei `r < 1` ist es `max`, und genau das kam heraus.

`blade.js` baut die Formel seit 18:26 nach (`Actions/Action.ts:169-196`) und
entscheidet an der gerechneten Zahl. Fehlen die Aktionsdaten - eingetragen ist
bisher nur Typhoon -, faellt es auf `min` zurueck, also auf die vorsichtige
Seite. Mitabgeschaltet: die Field-Analysis-Regel von 09:19 fuer Black Ops, die
auf derselben Fehlannahme ruhte und fuer 0,2 Rang je Minute statt 8,7 nur die
bessere Anzeige kaufte.

**Was noch aussteht** ist nicht dieser Punkt, sondern der Nachmesspunkt zur
Schwelle 0,40: Ob der Motor frueher feuert, zeigt sich erst, wenn die Chance
dort ankommt (18:41 stand sie bei 0,336).

<details><summary>Der urspruengliche Eintrag</summary>

### `s.min` ist bei Black Ops Bevoelkerungsrauschen - der Motor gated auf einer Zufallszahl (18:17)
Gemessen: Typhoon meldete heute 0,212 exakt (16:19), dann 0,239-0,269 (17:41), dann 0,286-0,295 (18:15). Die Spanne geht auf und zu, ohne dass sich an der Sache etwas aendert.
Erwartet: Bei Black Ops gibt es GAR KEINE Schaetzunsicherheit. `Actions/BlackOperation.ts:55-61`: `getPopulationSuccessFactor()` und `getChaosSuccessFactor()` geben beide fest **1** zurueck. Damit ist in `getSuccessRange` (`Actions/Action.ts:144-167`) `est === real`, also `diff = 0`, also `low = high = real` - und trotzdem wird danach `low *= r` mit `r = city.pop / city.popEst` gerechnet. Die Spanne stammt allein aus der Bevoelkerungsschaetzung, die auf Black Ops nicht wirkt.
Verdacht: `src/blade.js:687-712` gated `SICHER_BLACKOP` auf genau diesem `s.min`. `popEst` startet bei `pop*(rand+0,5)` (`City.ts:23`), kann also bis zu **1,5-fach** zu hoch stehen - dann sieht der Motor **zwei Drittel** der wahren Chance. Der wahre Wert ist immer einer der beiden Randwerte: bei `r < 1` ist es `s.max`, bei `r >= 1` ist es `s.min`.
**Die wahre Chance ist exakt berechenbar** - alle Eingaben sind ueber die API lesbar (Kampfwerte, `getSkillLevel`, `getStamina`, `teamCount`, `baseDifficulty` fest 2000 fuer Typhoon; Formel in `Actions/Action.ts:169-196`). Zu tun: die Chance rechnen statt schaetzen lassen, dann gegen `SICHER_BLACKOP` pruefen.
**Folgenschwer ueber den Motor hinaus:** Der Reportloop hat um 17:42 die aufgehende Spanne als "die Kampfwerte steigen schneller als die Schaetzung nachkommt" gedeutet und darauf ein Ziel gesetzt. Das war Rauschen als Fortschrittsmass. Jedes Ziel auf `s.min` oder der Spannenmitte ist wertlos, bis dieser Punkt behoben ist.

</details>

---

## Erledigt

### Kammeranteil und Erfahrungsrate - BEHOBEN und NACHGEMESSEN (27.08., 17:20)

**Verifiziert ueber 70,6 Minuten (16:06-17:17, `data/aktionen.txt`, 25
Eintraege) und ein 9,7-Minuten-Fenster fuer die Erfahrung:**

    Kammeranteil      31,1 %  ->   9,1 %   (Kriterium: unter 25 %)
    Tracking          25,1 %  ->   0,0 %   (Kriterium: gegen null)
    Erfahrung def     84      -> 122,6 exp/min  (Kriterium: ueber 110)
    Rangrate                     10,01 je Minute ueber 70,6 min

Alle drei Kriterien aus dem Eintrag von 14:19 erfuellt. Die Rechnung stimmte:
Der fehlende `rewardFac^(stufe-1)` liess den Motor Tracking statt Bounty
Hunter fahren; Tracking verbraucht 4,92 Ausdauer je Minute gegen 2,46 bei
Bounty Hunter, bei einer Regeneration von 3,1 - der Motor musste den Verlust
anschliessend in der Kammer nachholen.

Die Mischung sieht jetzt so aus: Bounty Hunter 31,3 %, Investigation 23,0 %,
Diplomacy 15,6 %, Undercover Operation 10,6 %, Raid 10,3 %, Kammer 9,1 %. Der
Motor ist auf **Operationen** umgestiegen - zusammen 43,9 Prozent, wo vorher
nur Vertraege liefen.

**Nebenbefund, kein neuer Punkt:** Diplomacy ist mit 15,6 Prozent der
groesste Posten ohne Traegerertrag (`Bladeburner.ts:1187-1198`: senkt nur das
Chaos, kein Rang, keine Kampferfahrung). Das ist bekannt und gewollt - siehe
den Eintrag zum Diplomacy-Hebel vom 26.08., 15:26; die enge Hysterese wurde am
27.08. geprueft und als richtig bestaetigt (`nodes/HEBEL.md`).

**Der Hyperdrive-Eintrag bleibt entlastet:** Sein Abbruchkriterium lag bei 110
exp/min, gemessen sind 122,6. Die 84 von 14:10 waren durch den Leerlauf
verdorben, nicht durch den Hebel.

<details><summary>Der urspruengliche Eintrag</summary>

### Kammeranteil auf 31 Prozent gestiegen, Erfahrungsrate zurueck auf Vor-Hyperdrive-Niveau (14:14)
Gemessen: `data/bblage.json`, `kampfExp.def` 45.209 (13:40) auf 47.735 (14:10) - **84 exp/min**. Das ist exakt der Wert von vor dem Hyperdrive-Hebel, obwohl der Erfahrungsfaktor seit 13:17 bei 1,7 steht. Die Aktionsmischung aus `data/aktionen.txt` im selben Fenster (87 Prozent erfasst):
    Hyperbolic Regeneration Chamber   560 s   **31,1 %**   (zuvor 18 bis 23)
    Contracts/Tracking                452 s   25,1 %
    Contracts/Retirement              385 s   21,4 %
    Contracts/Bounty Hunter           162 s    9,0 %
Erwartet: Bei Hyperdrive Stufe 7 rund **142 exp/min**, so wie um 13:10 gemessen. Kammeranteil um 20 Prozent.
Verdacht: **zwei Ursachen, beide plausibel, keine belegt.** (1) Der Kammeranteil ist um die Haelfte gestiegen - die Ausdauer reicht nicht mehr. Zu pruefen an `data/bbspann.json` (`ausdauer`, `regeneration`) ueber mehrere Punkte; die Hoechstausdauer waechst mit den Kampfwerten, der Verbrauch faellt aber JE AKTION an (`Bladeburner.ts:921`), und kuerzere Aktionen heissen mehr Aktionen. (2) **Tracking ist `isStealth`, nicht `isKill`** - es profitiert weder von Short-Circuit noch traegt es viel Kampferfahrung, weil seine Gewichte auf hacking und charisma liegen (`data/Contracts.ts`). Ein Viertel der Zeit floss also in eine Aktion, die den Traeger kaum bewegt. Warum sie gewaehlt wurde, ist zu klaeren - Bounty Hunter stand bei nur 9 Prozent, sein Vorrat duerfte leer sein.
**URSACHE GEFUNDEN UND BEHOBEN 14:19 - beide Verdachte haengen zusammen.**
`RANG_JE_ERFOLG` in `blade.js` fuehrte die **Basiswerte** des Rangertrags. Der
tatsaechliche Gewinn waechst aber mit der Aktionsstufe
(`rankGain * rewardFac^(level-1)`). Weil die Basiswerte ungefaehr proportional
zur Dauer sind, kamen ohne diesen Faktor **alle drei Vertraege auf denselben
Ertrag je Minute** - die Auswahl entschied nach Rauschen. Gemessen 14:17:

    Tracking        Stufe 39   1,041^38 = 4,62   ->  4,63 je Minute
    Retirement      Stufe 30   1,065^29 = 6,08   ->  6,26
    Bounty Hunter   Stufe 28   1,085^27 = 8,90   ->  8,90

Und damit erklaert sich auch der Kammeranteil: Bounty Hunter verbraucht
**2,46 Ausdauer je Minute**, Tracking **4,92** - bei einer Regeneration von
**3,113**. Mit Bounty Hunter braucht es fast keine Kammer, mit Tracking laeuft
die Ausdauer leer. Der Motor fuhr also die schlechtere Aktion und musste den
Verlust anschliessend in der Kammer nachholen.

**Geaendert 14:19** (`blade.js`, in `beste()`): `rewardFac^(stufe-1)` wird
eingerechnet, die Faktoren aus `data/Contracts.ts` und `data/Operations.ts`.
Verifiziert um 14:19 nach dem Neustart: Der Motor waehlt
`Contracts/Bounty Hunter`, Rang 5.177, `URTEIL: SPUR`.

**Wirkung noch nicht gemessen.** Nachzumessen im naechsten vollen
30-Minuten-Fenster: Kammeranteil muss von 31,1 Prozent deutlich fallen,
Tracking von 25,1 gegen null, und die Erfahrungsrate zurueck ueber 110
exp/min. Bleibt der Kammeranteil ueber 25 Prozent, war die Rechnung falsch.

**Damit ist auch der Hyperdrive-Eintrag entlastet:** Sein Abbruchkriterium
(unter 110 exp/min) war formal verletzt, aber die 84 waren durch den Leerlauf
verdorben, nicht durch den Hebel - um 13:10 wurden mit demselben Faktor 142
gemessen. Kein Revert.

</details>

### Der falsche STAGNATION-Alarm nach dem Einbau - BEHOBEN (27.08., 16:49)

**Verifiziert: Die alte Fassung liess beim ersten Lauf nach dem Einbau zwei
Punkte von 03:51 stehen und kam damit auf eine Stillstandsuhr von exakt
649 Minuten - genau die Zahl, die um 14:40 gemeldet wurde. Die neue Fassung
laesst null Punkte stehen.** Nachgestellt in `tools/test-stillstandsuhr.js`,
`node tools/strategie-check.js` danach unveraendert `URTEIL: SPUR`.

Der Fix von 04:00 suchte den Phasenwechsel im **gespeicherten** Verlauf. Beim
ersten Lauf nach einem Einbau steht dort aber noch kein Punkt der neuen
Wiederaufbauphase - der aktuelle Messpunkt wird erst danach angehaengt.
Gefunden wurde deshalb der Beginn der VORIGEN Wiederaufbauphase, und genau
deren Punkte blieben stehen. Sie stehen ebenfalls auf 1, also findet die Suche
nach dem letzten NIEDRIGEREN Punkt keinen, faellt auf den aeltesten zurueck
und zaehlt von damals durch. Der Fix half also erst ab dem zweiten Lauf - und
im ersten schickt die Meldung die Wache in den Eingriffsmodus, waehrend
`bbtrain` planmaessig hochtrainiert.

Neu: Steht der letzte gespeicherte Punkt in einer anderen Phase, beginnt die
Wiederaufbauphase JETZT und `frueher` wird geleert (`strategie-check.js:490`).

**Der Fehler kam zum zweiten Mal zurueck, deshalb liegt jetzt ein Test
daneben.** `tools/test-stillstandsuhr.js` haelt beide echten Faelle fest
(erster und zweiter Lauf nach dem Einbau) plus die Gegenprobe, dass ein
laufender Wiederaufbau vollstaendig erhalten bleibt. Vier Faelle, laeuft in
einer Sekunde, kein Spiel noetig - wer die Uhr anfasst, faehrt ihn vorher.

### Die Erfolgsspannen waren nur umstaendlich lesbar - BEHOBEN (27.08., 16:19)

**Verifiziert: `node tools/spann.js` um 16:19:27 - Chance 0,212 exakt, alle
zwoelf Faehigkeitsstufen, Ausdauer 72,4/121,3. Ein Befehl statt vier.**

Der Reportloop hatte um 16:12 eingetragen, `data/bbspann.json` stehe still und
der Chancenmesser sei tot. **Die Diagnose war falsch.** `src/bbspann.js` hat
gar keine Schleife (Zeile 11 ff.) - es ist eine Momentaufnahme, die einmal
schreibt und endet, gestartet ueber `data/task.txt`. Die Datei war 21 Minuten
alt, weil sie seit 15:51 niemand angefordert hatte. Auch der zweite Beleg trug
nicht: `"stadt":"Sector-12"` neben Aevum in `bblage.json` ist kein Widerspruch,
sondern der Unterschied zwischen dem Aufenthaltsort des Spielers und der Stadt,
in der die Division arbeitet.

Was daran ECHT war: Die Typhoon-Chance und die Faehigkeitsstufen sind nur hier
ablesbar, beide stehen in offenen Nachmesspunkten - und um an sie
heranzukommen, musste man von Hand einen Auftrag nach `data/task.txt` schieben,
pollen und die Antwort aus der JSON-Maskierung der Bruecke schaelen. Vier
Schritte fuer eine Zahl, die zwei Loops regelmaessig brauchen. Genau deshalb
stand sie stundenlang veraltet da und wurde als Absturz missdeutet.

`tools/spann.js` macht daraus einen Befehl: Auftrag schieben, auf einen neuen
Zeitstempel warten (harte Grenze 60 s), die drei Zahlen ausgeben, die zaehlen.
Bewusst **kein Selbstlaeufer** - `data/task.txt` ist ein einzelner Platz mit
einem Leser, den sich drei Loops teilen; ein Wecker darin wuerde ihnen den
Kanal wegnehmen.

### bbtrain liess die Gym-Arbeit bei leerem Konto weiterlaufen - BEHOBEN (27.08., 15:48)

**Verifiziert: Tiefstand 88 auf 139 in 29 Minuten, Konto 1,5 auf 20 Millionen.**
Beide Zahlen waren vorher festgefahren.

Die `GYM_MIN_GELD`-Sperre machte nur `continue`. Das unterlaesst den NEUSTART,
beendet aber die bereits laufende Gym-Arbeit nicht - sie laeuft im Spiel
weiter, auf dem Wert, der beim letzten erfolgreichen Durchlauf der niedrigste
war, und zieht dabei weiter Geld.

Nach dem Einbau um 14:40 lag das Konto von der ersten Sekunde an unter der
Schwelle, jede Runde lief also ins `continue`. Die dex-Arbeit aus der Runde
davor blieb stehen:

    14:52   dex 250   agi  88   Konto  6,0 Mio   Arbeit dex
    15:10   dex 289   agi  88   Konto  1,5 Mio   Arbeit dex
    15:19   dex 308   agi  88   Konto  3,6 Mio   Arbeit dex   <- Fix greift
    15:40   dex 319   agi 150   Konto 13,1 Mio   Arbeit keine
    15:47   dex 323   agi 162   Konto 20,0 Mio   Arbeit keine

**Der Zustand kostete doppelt**: In 18 Minuten kein einziger Punkt auf dem
Tiefstand, waehrend dex - schon dreimal so hoch - um 39 weiterstieg, und
gleichzeitig floss das Geld ins Gym ab, das der Wiederaufbau braucht.

**Geaendert 15:18** (`src/bbtrain.js`): Liegt das Konto unter der Schwelle,
wird eine laufende **CLASS**-Arbeit gestoppt. Eine Bladeburner-Aktion bleibt
unberuehrt.

**Die Auswahl war nie falsch.** `bbtrain.js:145-151` nimmt korrekt den
niedrigsten Wert - sie kam nur nie zum Zug, weil die Runde vorher abbrach.
Der erste Verdacht ("trainiert den hoechsten statt den niedrigsten") war ein
Symptom, nicht die Ursache.

**Lehre, allgemein:** Eine Sperre, die nur den Start unterlaesst, haelt nichts
an, was schon laeuft. Wo `continue` einen Zustand verhindern soll, gehoert
geprueft, ob der Zustand nicht bereits besteht - im Spiel laufen Arbeiten
weiter, auch wenn das Skript sie nicht mehr anfasst.

### bn4rep auf Kampfwerte umgestellt - VERIFIZIERT am Einbau (27.08., 14:51)

**Verifiziert: der dex-Multiplikator stieg von 1,986 auf 2,325, also +17,1
Prozent.** Der Einbau von 03:48, der noch ohne den Kampfterm lief, brachte
1,834 auf 1,986 - **+8,3 Prozent**. Der Kampfterm hat die Steigerung also
**mehr als verdoppelt (Faktor 2,06)**, und damit ist `KAMPF_GEWICHT = 10`
belegt. Kein Grund, es zu senken.

Gemessen um 14:49 aus dem Spielstand (drei Augmentierungen eingebaut, 19 auf
22 installiert):

    Kampf-Mult       str 1,597   def 1,597   dex 2,325   agi 1,677
    Erfahrung        durchgehend 1,609
    Bladeburner      chance 1,205   ausdauer 1,000   regen 1,040   analyse 1,050

Alle vier Kampfwerte sind bewegt, nicht nur einer - das war der Zweck der
Gewichtung `0,25 je Wert` in `combatNutzen`. Der Term
`bladeburner_success_chance` steht bei 1,205 und wirkt ungedaempft auf die
Black-Op-Chance.

**Ablesbar wurde das erst durch eine Werkzeugaenderung**: `tools/save.js` gab
nur die Hacking-Multiplikatoren aus. Seit 14:49 stehen die Kampf- und
Bladeburner-Multiplikatoren daneben - ohne sie liess sich nach einem Einbau
nicht pruefen, ob der Reputationsmotor das Richtige gekauft hat.

**Der Weg dorthin, zum Nachlesen:** 02:25 Guetezahl analysiert (SPTN-97 bekam
denselben Wert wie ein wertloses Stueck) - 02:48 Hacking-Weg als chancenlos
belegt (2,44 x 10^148 Erfahrung fuer Hacking 6000) - 03:25 die Liste der 60
Kampf-Augmentierungen gebaut - 04:10 `combatNutzen` in `einzelWert` - 07:56
am gewaehlten Ziel verifiziert (ORION-MKIV statt Cranial Signal Processors) -
08:53 die ganze Rangliste umgestellt - 10:17 gekauft - **14:51 am Einbau
gemessen.**

### Die Reputationsrate wird gemessen statt gerechnet - VERIFIZIERT (27.08., 12:18)

**Verifiziert um 12:18: alle drei Faktionen unter 1,5 Prozent Abweichung.**
Gegenprobe ueber 30 Minuten (Faktionsreputation um 11:47 gegen 12:17) gegen
das, was der Motor in Zeile 3 von `data/rep-ziel.txt` selbst angibt:

    Aevum          real 29,3   Motor 29,7   +1,3 %
    Slum Snakes    real  3,0   Motor  3,0    0,0 %
    Bladeburners   real 25,6   Motor 25,4   -0,9 %

Zum Vergleich der Ausgangszustand: Die Formel (`bn4rep.js:1329`) sagte fuer
dieselben drei **169,1 | 150,4 | 104,2** - Faktor 4 bis 50 daneben, weil sie
Faktionsarbeit unterstellt, die in BitNode 6 gar nicht stattfindet.

**Der Weg dahin ging ueber einen Fehlschlag**, und der gehoert festgehalten:
Die erste Fassung (09:50) zog den Messpunkt bei jeder Uebernahme nach und
bildete die Rate immer ueber genau 300 Sekunden. Nachgemessen um 11:47 stand
Bladeburners bei 39,4 statt real 24,4 und Aevum bei 20 statt 40,1 - **in
entgegengesetzte Richtungen**, also Rauschen. Slum Snakes traf schon damals
exakt; daran war zu sehen, dass der Mechanismus stimmt und nur das Fenster zu
kurz war. Seit 11:49 bleibt der erste Messpunkt als **Anker** stehen, das
Fenster waechst mit der Laufzeit, und bei fallender Reputation (Einbau) wird
neu geankert.

**Lehre:** Ein verfehltes Abbruchkriterium heisst nicht automatisch Revert.
Zeigen die Abweichungen in verschiedene Richtungen und trifft ein Fall exakt,
ist der Mechanismus richtig und die Parametrierung falsch. Ein Revert haette
hier den sicher falschen Wert wiederhergestellt.

Zweite Lehre, fuer die Erwartungsbaender: Mein Band "Aevum 35 bis 45" stammte
aus dem Fenster 09:47-11:47. Die Aevum-Rate ist seither selbst auf 29,3
gesunken - **das Band war veraltet, nicht die Messung**. Was zaehlt, ist die
Uebereinstimmung zwischen Motor und frisch gemessener Wirklichkeit, nicht ein
Band aus einer aelteren Messung.

### Die Kampferfahrungsrate faellt - GEKLAERT, zwei getrennte Ursachen (27.08., 11:19)

**Verifiziert um 11:19: der Wirkungsgrad ist konstant 1,59 bis 1,62**, sobald
man richtig misst. Die gemeldete Reihe 135 -> 80 -> 65 exp/min hat zwei
verschiedene Ursachen, und **keine davon ist ein Fehler im Bot**.

**Ursache 1 (Fenster 2 -> 3): Diplomacy.** Im Fenster 10:40-11:10 lief
`General/Diplomacy` **300 Sekunden, also 16,7 Prozent der Spanne**.
`Bladeburner.ts:1187-1198` zeigt: Diplomacy senkt nur das Chaos - **kein Rang,
keine Kampferfahrung**. Genau deshalb fielen diesmal BEIDE Traeger zugleich
(Rang von 7,4 auf 5,0 je Minute). Der Kammeranteil war es nicht, der liegt
ueber alle drei Fenster stabil bei 18 bis 23 Prozent.

Das ist gewolltes Verhalten: Der Diplomacy-Hebel vom 26.08., 15:26 hat die
Tracking-Chance von 0,36 auf 0,801 gehoben, Faktor 2,24. Fuenf Minuten kosten
rund 43 Rang und 330 def-Erfahrung - der Tausch ist gemessen und bleibt.

**Ursache 2 (Fenster 1 -> 2): ein Messartefakt, und zwar meines.** Die erste
Auswertung filterte mit `von >= a && bis <= b` und warf damit jeden Eintrag
weg, der ueber eine Fenstergrenze ragt. Anteilig gerechnet steht Fenster 2 bei
**100 Prozent** erfasster Zeit, Fenster 3 bei 97 - und dort stimmt die Rechnung:

    Fenster 2   roh 2.421   gemessen 3.845   Verhaeltnis 1,588
    Fenster 3   roh 1.204   gemessen 1.956   Verhaeltnis 1,624
    Fenster 1   roh 2.183   gemessen 6.468   Verhaeltnis 2,96   <- Ausreisser

Das Verhaeltnis ist `person.mults.defense_exp`, und es ist konstant. **Fenster 1
ist der Ausreisser, nicht Fenster 2** - dort fehlen 282 Sekunden im Protokoll,
in denen etwas deutlich Schwereres lief (rund 6,6 roh je Sekunde, das waere eine
Operation). Die Zahl 135 exp/min war also nie die normale Rate.

**Lehre fuer die Zielsetzung**: Halbstundenziele auf der Erfahrungsrate muessen
den Anteil der General-Aktionen einrechnen. Diplomacy und Hyperbolic
Regeneration Chamber nehmen zusammen bis zu 40 Prozent der Spanne, und beide
liefern null Erfahrung. Die belastbare Rate ist die aus Fenster 2 und 3.

Keine Aenderung am Code - es gab nichts zu beheben.

### Die Typhoon-Chance rauscht - URSACHE GEKLAERT (27.08., 09:21)

**Verifiziert: es ist nicht die Chance, es ist die Bevoelkerungsschaetzung.**
Der Beleg ist, dass **alle** Aktionen gleichzeitig aufgehen, nicht nur die
Black Op. Gemessen um 08:11 gegen 09:11, dieselbe Stadt (Sector-12):

    Tracking          1,000 / 1,000  (Spanne 0)   ->  0,803 / 1,000  (0,197)
    Bounty Hunter     1,000 / 1,000  (Spanne 0)   ->  0,803 / 1,000  (0,197)
    Investigation     -                           ->  0,337 / 0,587  (0,249)
    Operation Typhoon 0,088 / 0,094  (0,006)      ->  0,086 / 0,107  (0,021)

Eine Chance, die faellt, waere ein Einzelbefund. Vier Aktionen, die binnen
einer Stunde synchron unscharf werden, sind ein Schaetzfehler - `popEst` der
Stadt verrottet, solange niemand Field Analysis faehrt.

**Damit war die Zielsetzung von 08:45 doppelt falsch:** Erst wurde `max` als
Indikator genommen (widerlegt um 08:22), dann `min` - und `min` ist bei
verrottender Schaetzung genauso wenig ein Fortschrittsmass. Der wahre Wert
liegt in der Mitte: 0,0965 statt der abgelesenen 0,086, also **12 Prozent
pessimistischer als noetig**.

**Geaendert 09:19** (`blade.js`, direkt nach der Black-Op-Pruefung): Wenn
`s.max >= SICHER_BLACKOP && s.min < SICHER_BLACKOP`, faehrt der Motor Field
Analysis - dann und nur dann steht ausschliesslich die Unschaerfe zwischen
ihm und dem Knotenausgang.

Field Analysis dauerhaft einzustreuen waere teuer und wurde deshalb
**verworfen**: 0,2 Rang je Minute gegen 8,7 bei Bounty Hunter, Faktor 43. Die
scharfe Schaetzung bringt keinen Rang, sie kauft nur einen frueheren Versuch -
bei 12 Prozent und einer Wachstumsrate von 0,003 je Minute rund 38 Minuten.
Das lohnt einmal kurz vor dem Versuch, nicht stuendlich.

**Wirkung noch nicht gemessen** - die Regel kann erst greifen, wenn `max` die
Schwelle 0,80 erreicht (steht bei 0,107). Verifiziert ist bisher nur, dass sie
nicht faelschlich feuert: nach dem Neustart um 09:20 waehlte der Motor
`Contracts/Retirement`, Grund "Vertrag", `URTEIL: SPUR`.

### Black-Op-Chance stagniert - WIDERLEGT (27.08., 08:22)

**Verifiziert: min 0,091 um 08:21**, gegen 0,088 um 08:12 und 0,088 um 07:41.
Die untere Schaetzgrenze steigt monoton, der Traeger arbeitet.

Der Befund von 08:12 war ein Artefakt der **schrumpfenden Schaetzspanne**.
`getActionEstimatedSuccessChance` liefert ein Intervall, und das engt sich mit
laufender Erfahrung ein:

| Zeit  | min   | max   | Spanne |
|-------|-------|-------|--------|
| 06:10 | 0,062 | 0,075 | 0,013  |
| 07:41 | 0,088 | 0,099 | 0,011  |
| 08:12 | 0,088 | 0,094 | 0,006  |
| 08:21 | 0,091 | 0,097 | 0,006  |

Die Obergrenze fiel von 0,099 auf 0,094, weil die Schaetzung praeziser wurde -
nicht, weil die Chance sank. Wer `max` als Fortschrittsmass nimmt, misst die
Genauigkeit der Schaetzung, nicht den Fortschritt.

**Lehre fuer die Zielsetzung: der Indikator ist `min`, nie `max` und nie die
Mitte.** `blade.js:600` macht es bereits richtig (`if (s.min >= SICHER_BLACKOP)`),
die Zielsetzung des Reportloops um 07:40 nicht - sie schrieb die Spanne hin und
las die falsche Haelfte. Kein Codeeingriff noetig.

**Nebenbefund, die wertvollste Zahl des Laufs:** min stieg von 0,062 (06:10) auf
0,091 (08:21), also Faktor 1,468 in 131 Minuten - exponentiell 0,00294 je Minute.
Haelt die Rate, ist die Schwelle 0,80 in **rund 12 Stunden** erreicht
(ln(0,80/0,091) / 0,00294 = 739 min). Die Rate wird abflachen, weil die
Erfahrungskurve exponentiell im Level ist; die 12 Stunden sind die Untergrenze,
nicht die Prognose. Nachmessen: min um 12:00 - liegt es unter 0,20, flacht die
Kurve schon ab.

**Ausdauer scheidet als Ursache aus**: Die Strafe ist min(1, stamina/(0,5*max))
(Bladeburner.ts:167-169, zitiert in blade.js:146). Bei 64,5 von 115,5 ist
0,5*max = 57,75 - die Strafe steht bei allen drei Messungen auf 1.

### Der Pruefer erkennt den Einbau (27.08., 07:20)

**Verifiziert: `URTEIL: RESET` um 03:48**, unmittelbar nach dem Einbau, mit
Phase "Wiederaufbau nach Einbau" und Traeger "Kampfwert-Tiefstand = 1 von
100". Zweite Bestaetigung nach dem Einbau vom 26.08., 16:31 - der Punkt
verlangte genau diese Wiederholung, weil eine einzelne Beobachtung noch kein
Nachweis ist.

**Ein Folgefehler kam dabei ans Licht und ist behoben:** Vier Minuten nach dem
Einbau meldete der Pruefer `STAGNATION: Kampfwert-Tiefstand steht seit 681 min
auf 1`, waehrend bbtrain gerade trainierte. Die Stillstandsuhr zaehlte ueber
den Einbau hinweg, weil der Traeger dort nicht faellt, sondern **wechselt**
(Bladeburner-Rang zu Kampfwert-Tiefstand) und der Rueckgangszweig nur auf
Fallen reagiert. Behoben um 04:00, verifiziert: 681 min auf 3 min bei
unveraenderter Lage. Eigener Eintrag in HEBEL.md.

### Das Guthaben war negativ - Gym auf Pump (27.08., 06:55)

**Der Punkt wartete auf den naechsten Einbau. Der war am 27.08. um 03:48, und
das Ergebnis ist eindeutig: Das Guthaben ging wieder ins Minus.** Gemessen um
04:45, knapp eine Stunde nach dem Einbau: **-3 Millionen**.

**Die Aenderung vom 26.08., 22:46 an `joinrun.js` hat gehalten** - zwei
gleichzeitige Trainer gab es diesmal nicht. Sie war nur nicht die Ursache,
sondern ein Verstaerker: Diesmal lief `bbtrain.js` ueberhaupt nicht (siehe den
Wiederanlauf-Punkt), und `joinrun` trainierte allein. Das Konto fiel trotzdem.

**Die eigentliche Ursache stand als letzter Satz im alten Eintrag:** "Offen
bleibt die Frage, ob ein Training bei leerem Konto ueberhaupt starten darf."
Sie durfte. Das Powerhouse Gym kostet **2.400 Dollar je Sekunde**, und weder
die Oberflaeche noch `applyWorkStats` pruefen den Kontostand
(`Work/ClassWork.tsx:22-73`; `gainMoney` hat keinen Boden,
`PlayerObjectGeneralMethods.ts:216-224`).

**Geaendert 06:52 in `src/bbtrain.js`:** Unter **5 Millionen** wird kein Gym
mehr gestartet. Der Ausweg kostet nichts - findet `blade.js` keine Aktion
ueber seinen Schwellen, und mit Kampfwerten um 1 findet es keine, faellt es
von selbst auf Bladeburner-Training durch. Das ist gratis
(`Bladeburner.ts:1091-1105`) und hebt dieselben Werte, nur ohne den
Ortsmultiplikator des Gyms.

**Verifiziert: `URTEIL: SPUR` unveraendert nach der Aenderung um 06:55.** Die
eigentliche Probe faellt beim naechsten Einbau - dann steht in
`data/bblage.json`, ob das Guthaben ueber null bleibt. Der Punkt wandert
trotzdem nach Erledigt: Die Frage, die ihn offen hielt, ist beantwortet, und
die Antwort ist eingebaut.

### Nach einem Einbau starten die Werkzeuge nicht nach (27.08., 06:22)

**Verifiziert: alle zwoelf Werkzeuge laufen um 06:22**, nach einem
Selbstneustart von bn4net, `URTEIL: SPUR`. Der Punkt stand seit dem 25.08.,
22:03 - vier stille Fehlschlaege des Wiederanlaufs an drei Tagen.

**Die Ursache ist eine Zeile:** `if (fehlend.length && werkbank !== "home")`
im Raeumblock (`bn4net.js:2598`).

Die Kette dahinter:
1. Nach einem Einbau sind alle gekauften Rechner weg (`Prestige.ts:73`), also
   wird **home zur Werkbank** (`bn4net.js:770-778`).
2. Der Startcode prueft
   `werkbankMoeglich = freiAuf(werkbank) + arbeiterGbAuf(werkbank)` und
   **wartet**, wenn das Werkzeug dort theoretisch passen wuerde - in der
   Annahme, der Raeumblock habe inzwischen Arbeiter geraeumt.
3. Auf home hat er das nie getan. Also wartete ein Werkzeug, das auf home
   passen wuerde, endlos auf Platz, den niemand schafft.

**Gemessen:** `bbtrain.js` (94,75 GB) lief am 27.08. von 03:48 bis 04:18
nicht, waehrend home **2048 GB** hatte - vollstaendig mit Arbeitern belegt.
Dasselbe Muster am 26.08. um 16:36 mit `blade.js`, am 25.08. dreimal.

**Warum es so lange unentdeckt blieb:** Jeder Fehlschlag sah anders aus - mal
fehlte blade, mal bbtrain, mal sechs Werkzeuge auf einmal -, und jedes Mal
half ein Handstart. Der gemeinsame Nenner war unsichtbar, weil er nur nach
einem Einbau auftritt und sich von selbst aufloest, sobald wieder ein
gekaufter Rechner ueber 20 GB steht.

**Die zweite Aenderung desselben Morgens, dieselbe Wurzel:** Um 06:10 wurde
`ausweichwirt()` repariert, das home mit einer Begruendung aus der 64-GB-Zeit
ausschloss. Beide Stellen behandelten home als Sonderfall, den es seit dem
Ausbau auf 2048 GB nicht mehr gibt.

**Ohne Erics Freigabe von 05:00 waere das nicht behoben worden** - der Punkt
hiess seit dem 25.08. "Wartet bis Eric bn4net freigibt" und wurde von jedem
Loop uebersprungen.

### bn4rep fand keinen Platz, weil home pauschal ausgeschlossen war (27.08., 06:12)

**Verifiziert: `bn4rep.js` laeuft auf home um 06:12**, alle zwoelf Werkzeuge
stehen. Erste Aenderung an `bn4net.js` nach der Freigabe.

Der Waechter meldete um 06:00 per Push "bn4rep.js hat keinen Platz" - die neue
Meldung mit Grund, die seit 20:50 im Waechter steht. Sie hat funktioniert wie
gedacht: Eric sah den Grund, nicht nur den Ausfall.

**Der Grund war eine veraltete Begruendung im Code.** `ausweichwirt()` in
`bn4net.js` schloss home aus, "ein 768-GB-Werkzeug haette dort ohnehin nie
Platz". Das stimmte, als home 64 GB hatte. Heute hat es **2048**.

Gemessen um 06:05: Werkbank ist `millenium-fitness` mit **256 GB**, bn4rep
braucht 768,3. Ein Ausbau auf 1024 GB kostet **897,6 Milliarden** gegen 1,9
Milliarden Guthaben - `CloudServerSoftcap: 2` (`BitNode.tsx:702`) macht
Serverplatz in diesem Knoten unbezahlbar. **Ueber Server war der Platz nicht
zu bekommen**, ueber home schon: 2048 GB, davon 512 Reserve.

**Geaendert:** Statt des Tabus eine Rechnung - freier Platz plus raeumbare
Arbeiter minus `reserveHome()`. Reicht es nicht, faellt home wie jeder andere
Rechner durch die Pruefung, aus Mangel statt aus Prinzip.

**Die Lehre, und sie betrifft mehr als diese Zeile:** Der Ausschluss war
einmal richtig und ist mit dem Ausbau von home falsch geworden, ohne dass
irgendetwas kaputtging - er hat nur still ein Werkzeug ausgesperrt. **Eine
Begruendung, die eine Zahl nennt, gehoert nachgerechnet, wenn sich die Zahl
aendert.** Genau dasselbe Muster steckte in der 84,5-Millionen-Rechnung von
17:55 und in der Pauschale 1,7 des Pruefers.

### Ein Server-Ausbau kurz vor einem Einbau verbrennt das Geld doppelt (27.08., 04:50)

Gemessen: Um 04:06 habe ich `werk-0` von 1024 auf 2048 GB ausgebaut, fuer
**2,703 Milliarden**. Um 04:08 meldete der Pruefer `URTEIL: RESET` - ein
Augmentierungs-Einbau, Kampfwerte auf 1, Netz 13/70, Guthaben 1 Million.
**Gekaufte Rechner ueberleben einen Einbau nicht** (`Prestige.ts:73`, steht so
schon im Kommentar von `bn4net.js:530`). Der Ausbau war damit zwei Minuten
lang nuetzlich.

Erwartet: Vor einem Kauf in Milliardenhoehe gehoert geprueft, ob ein Einbau
ansteht. Die Anzeichen waren da - 28,9 Milliarden Guthaben und ein
Reputationsmotor, der seit Stunden sammelt.

Verdacht: keine Codestelle, ein Verfahrensfehler von mir.

**Geaendert 27.08., 04:20, Wirkung noch nicht gemessen.** `src/wbgrow.js`
summiert jetzt vor dem Ausbau die Preise aller Augmentierungen, deren
Reputationsschwelle bereits erreicht ist, und lehnt ab, wenn diese Summe die
Ausbaukosten uebersteigt. Der Grund wird in `data/wbgrow.txt` geschrieben,
statt still zu scheitern.

**Der Testlauf um 04:21 lief ins Leere und bestaetigt dabei den Befund:**
`"Keine gekauften Rechner."` - der Einbau von 03:48 hat sie alle geloescht.
Die 2,703 Milliarden von 03:46 sind damit belegt verloren.

**Zweiter Test um 04:47, mit 16 wieder gekauften Servern - und er foerdert
etwas Groesseres zutage.** Die neue Augmentierungspruefung wurde erneut nicht
erreicht, weil der Fuenftel-Test davor blockiert:

    Ziel 1024 GB   897.600m gegen 14.340m Guthaben
    Ziel  128 GB    10.560m gegen 14.340m Guthaben

**Ein Ausbau von 64 auf 128 GB kostet 10,56 Milliarden.** Der Grund steht in
`BitNode.tsx:702`: `CloudServerSoftcap: 2`. Serverkosten sind in BitNode 6
quadratisch gedaempft, und der Park ist damit praktisch unbezahlbar.

**Damit ist mein Vorwurf an `bn4net` vom 17:55 endgueltig unbegruendet** - er
lautete, der Motor kaufe Arbeiterserver, lasse die Werkbank aber auf
Startgroesse stehen. Der Motor rechnet richtig; die Werkbank auszubauen kostet
in diesem Knoten mehr, als sie einbringt. Das war schon die erste Korrektur um
20:30 (84,5 Millionen waren eine BitNode-1-Rechnung), aber die Groessenordnung
war auch dann noch zu klein.

**Die Vorpruefung bleibt drin und ist richtig platziert.** Mein Fehler von
03:46 kam nicht durch den Fuenftel-Test - 2,703 Milliarden lagen unter einem
Fuenftel von 28,9 Milliarden. Genau diese Luecke schliesst sie. Dass sie in
BitNode 6 nie zum Zuge kommt, liegt am Softcap, nicht an ihr.

**Der Punkt wandert damit nach Erledigt** - nicht weil die Pruefung gemessen
waere, sondern weil die Ursache eine andere ist als gedacht und der Auftrag
damit beantwortet.


### Die Gegenmittel gegen leere Vertragsvorraete sind eingebaut (27.08., 00:50)

**Verifiziert: kein einziger Training-Abschnitt in 483 gemessenen Abschnitten
ueber 464 Minuten** (`tools/ratencheck.js`, 00:48). Genau das war das Symptom,
das den Punkt ausgeloest hat - zweimal am 25.08. fiel der Motor auf
"General/Training" durch, weil keine Aktion ueber der Schwelle lag.

Beide geforderten Werkzeuge stehen in `blade.js`:
- **Diplomacy** seit 26.08., 15:26 (`SPIEL_CHAOS_AN`, `CHAOS_EIN 50`,
  `blade.js:93-95,692`) - schaltet ein, sobald das Chaos die Schwelle des
  Spiels ueberschreitet, ab der alle Chancen mit `sqrt(1 + chaos - 50)`
  faellt.
- **Incite Violence** seit 26.08., 10:49 (`blade.js:872`, Grund
  "Vertragsvorrat leer").

**Der ehrliche Rest: Incite Violence hat nie ausgeloest** und ist am 26.08. um
18:55 in HEBEL.md als heute schaedlich eingetragen worden - der Block greift
nur unter Chaos 25, und Incite selbst hebt das Chaos um 10 plus
`chaos/log10(chaos)`. Er bleibt stehen, weil er in einem Knoten mit niedrigem
Chaos richtig ist.

**Warum das Symptom trotzdem verschwunden ist:** Nicht durch die Gegenmittel,
sondern weil die Chancen gestiegen sind. Gemessen 00:47: Tracking ist mit 0,6
offenen Auftraegen weiterhin leergespielt, aber Bounty Hunter hat **686,5** und
Retirement **493,0**, und ihre Chancen liegen bei 0,462 und 0,546 - beide ueber
`SICHER_VERTRAG` 0,45. Der Faehigkeitsumbau vom 18:52 hat den Punkt praktisch
miterledigt.

**Was das fuer den naechsten Einbau heisst:** Fallen die Kampfwerte wieder auf
1, rutschen die Chancen unter die Schwelle, und dann traegt allein der
Notvertrag-Zweig ("Vertrag unter Schwelle, lohnt trotzdem"). Der ist seit dem
25.08. drin und hat am 26.08. gehalten - der Motor fuhr Bounty Hunter mit 0,308
statt in Training zu fallen.

### Die Erwartungswerte des Pruefers rechnen jetzt mit rankGain und Dauer (27.08., 00:20)

**Verifiziert: `URTEIL: SPUR` unveraendert nach dem Umbau um 00:20**, und die
Formel trifft die Messung. Retirement, Stufe 21, Chance 0,647, Dauer 26 s:
`0,6 * 1,065^20 * 0,647 / 0,4333 min` = **3,19** gegen gemessene **2,938** -
eine Abweichung von 8 Prozent, gedeckt durch Rangverluste bei Misserfolgen und
die Zufallsstreuung `addOffset(gain, 10)`.

Der Punkt lief seit dem 25.08. und hatte zwei Fehlalarme zur Ursache. Er ist in
mehreren Schritten abgearbeitet worden; die letzten beiden:

**1. Die Pauschale 1,7 war zufaellig Bounty Hunter.** Gegen 406 gemessene
Abschnitte (`ratencheck.js`, 26.08. 23:18):

    Aktion                    gemessen   Pauschale   rankGain/Dauer
    Contracts/Tracking           3,438       5,45           3,21
    Contracts/Retirement         2,938       3,91           3,19
    Contracts/Bounty Hunter      2,279       2,50           2,48

`rankGain` ist 0,3 / 0,9 / 0,6 (`data/Contracts.ts:19,53,86`), die Dauer
18 / 32 / 26 Sekunden. 1,7 entspricht ungefaehr `0,9 / 0,53 min` - genau
Bounty Hunter, und bei Tracking 59 Prozent daneben.

**2. Umgesetzt in zwei Laeufen, eine Datei je Lauf.** Erst meldet `blade.js`
die Aktionsdauer aus `getActionTime` mit (26.08., 23:30; verifiziert
`"stufe":21,"dauer":26000`), dann rechnet `sollRate()` damit
(27.08., 00:20). Fehlt die Dauer - aeltere `blade.js` -, bleibt die Pauschale
als Rueckfall stehen, damit ein Versionsunterschied keinen Fehlalarm ausloest.
Operationen sind mitgenommen: rankGain 2,2 bis 55 aus `data/Operations.ts`.

**Was offen bleibt und anderswo steht:** Der urspruengliche Plan - die Raten
selbstkalibrierend aus dem eigenen Verlauf ableiten - ist am 26.08. um 02:15
widerlegt worden (die Aufloesung des Messverlaufs ordnet den Zuwachs der
Aktion zu, die zufaellig zum Messpunkt lief). Stattdessen ist die Formel jetzt
richtig, und `ratencheck.js` liefert die Gegenprobe aus echten Abschnitten.

### Das Springen zwischen Vertraegen ist kein Fehler - Hysterese widerlegt (26.08., 23:50)

**Verifiziert: 1,58 Rang je Minute gegen 1,76 vorher**, gemessen ueber 48
Minuten aus `data/wache-zustand.json` (1364 um 22:55 auf 1440 um 23:45).
Erwartet waren gut 6 Prozent mehr; gemessen sind **10 Prozent weniger**. Die
Aenderung ist um 23:50 zurueckgenommen.

Der Punkt kam aus der Messung vom 14:44: 43 Wechsel zwischen Vertraegen
verwerfen 160 von 1.983 Sekunden, weil jeder Wechsel `actionTimeCurrent` auf
0 setzt (`Bladeburner.ts:187`). Das Vormessen um 22:45 bestaetigte auch den
Grund fuer das Springen - der Abstand zwischen den beiden besten Vertraegen
liegt bei 11 Prozent, die Schaetzunsicherheit bei Bounty Hunter dagegen bei
41 Prozent relativ (min 0,508, max 0,862).

Eingebaut war daraufhin eine Hysterese auf der ZEIT: Ein Durchlauf, der zu
mehr als einem Viertel gelaufen war, wurde zu Ende gefahren.

**Der Denkfehler - und er ist der eigentliche Ertrag dieses Punktes:** Der
Ertragsunterschied zwischen den Aktionen ist groesser als die verworfene
Zeit. Gemessen ueber 406 Abschnitte (`ratencheck.js`, 23:18) bringt Tracking
**3,438** Rang je Arbeitsminute, Bounty Hunter **2,279** - **51 Prozent**
Unterschied. Wer einen Wechsel um bis zu drei Viertel eines Durchlaufs
aufschiebt, sitzt genau so lange auf der schlechteren Aktion. Die 8 Prozent
verworfene Zeit sind billiger als das.

**Damit ist das Springen als richtig erwiesen**, nicht nur als hinnehmbar: Es
ist die Antwort auf schwankende Schaetzungen, und jede Verzoegerung kostet
mehr, als sie spart. Der Kommentarblock in `blade.js` haelt das fest, damit
niemand dieselbe Hysterese ein zweites Mal einbaut.

### Der Kammeranteil ist geklaert - er ist Zyklusgeometrie (26.08., 22:15)

**Verifiziert: Kammeranteil 67 Prozent, gerechnet und im Spiel bestaetigt um
21:45.** Fuenf Stichproben im 15-Sekunden-Takt zeigten den vollstaendigen
Zyklus: zwei Kammerproben bei 37 und 38 von 68, dann drei Arbeitsproben bei
39, 38, 37.

Der Punkt lief seit dem 26.08. frueh unter dem Titel "die Rechnung erklaert
nur zwei Drittel davon". Sie erklaert jetzt alles:

- Das Ruheband ist `AUSDAUER_RUHE 0,51` bis `AUSDAUER_WEITER 0,56`
  (`blade.js:150`), bei Hoechstausdauer 68 also **3,4 Punkte breit**.
- Eine Vertragsaktion kostet rund 1,4 Ausdauer - **zwei bis drei Aktionen**,
  dann ist das Band durchlaufen.
- Regeneration 2,3 je Minute: **1,5 Minuten Auffuellen gegen 45 Sekunden
  Arbeit** = 67 Prozent Kammeranteil.

Damit ist auch die "Luecke" zwischen gerechneter Zyklusrate und gemessener
Rangrate erklaert - `bbspann` unterstellt einen hoeheren Arbeitsanteil.

**Drei Griffe sind geprueft und verworfen**, jeder mit Zahl:
1. *Bandbreite aendern* - am 07:46 versucht, widerlegt: Die Spanne ist
   symmetrisch, der Kammeranteil stieg von 50,1 auf 60,7 Prozent (HEBEL.md).
2. *Chancenschaetzung als Ursache* - widerlegt um 17:50: `popEst/pop` liegt
   bei 0,835, die Schaetzung ist pessimistisch, nicht optimistisch.
3. *Tab-Drosselung* - widerlegt um 17:50: Wanduhr 1.789.027 ms gegen
   Spielzeit 1.789.000 ms.

**Der bleibende Satz:** Der Kammeranteil ist **strukturell**. Er faellt nur
ueber das Verhaeltnis Regeneration zu Verbrauch je Minute, nicht ueber
Umsortieren, Schwellen oder Auswahllogik. Der wirksame Weg fuehrt am
Kammeranteil vorbei - **Ertrag JE Aktion heben**, und genau das tut der
Faehigkeitsplan seit 18:52.

Der einzige noch behebbare Rest - die Wechsel zwischen Vertraegen - steht als
eigener Punkt unter `## Offen`.

### Der Waechter meldet fehlenden Speicher als Ausfall (26.08., 20:50)

**Verifiziert: Waechter laeuft mit der neuen Pruefung seit 20:47:22** (PID
14576, Sperrdatei des Vorgaengers uebernommen, erste Runde ohne Fehler).

Ausgeloest von einem Fehlalarm um 17:45:33: Stufe 2, "bn4rep.js meldet sich
seit 63 min nicht mehr". Der Grund war Speicher, nicht Absturz - die Werkbank
`werk-0` hatte 512 GB, `bn4rep.js` braucht 768,3.

**Die Ursache war ein Test am falschen Rechner.** `tools/wache.js:462` prueft
`homeRam <= 128` - der Kaltstart-Test aus der Zeit, als die Werkbank noch home
war. Er greift heute nie, weil home 2048 GB hat, waehrend die Werkbank ein
gekaufter Rechner ist.

**Nicht stumm geschaltet, sondern unterschieden** - nach Erics Einwand vom
26.08., 17:52: *"kann Letzteres nicht auch ein Fehler sein?"* Er hat recht:
Kein Platz IST ein Fehler, wenn Geld fuer einen Ausbau da ist. Deshalb:

- Neue Funktion `groessterRechnerGb()` liest den groessten Rechner ausser home
  aus dem Spielstand - **nur im Verdachtsfall**, denn der Save ist mehrere
  Megabyte gross und der Waechter laeuft alle drei Minuten.
- Die Meldung nennt jetzt den Grund: "bn4rep.js hat keinen Platz: groesste
  Maschine 512 GB, gebraucht 768,3 GB. Guthaben 6713m - Ausbau pruefen."
- Sie **eskaliert nicht** (`keineEskalation`): einmal melden, dann Ruhe. Ein
  Alarm, der sich alle zwanzig Minuten wiederholt, entwertet den Kanal.

**Die zwei Nebenbaustellen dieses Punktes sind ebenfalls erledigt:** Der
Sync-Verdacht war ein eigener Lesefehler (im Spiel fehlt das `src/`-Praefix),
und `wbgrow.js` startete nicht, weil drei ns-Funktionen in Bitburner 3.0.0
entfernt sind. Beides steht in eigenen Eintraegen weiter unten.

### Der Faehigkeitsplan kaufte die teuerste Stufe im Feld statt der billigsten Wirkung (26.08., 18:52)

**Verifiziert: Bounty-Hunter-Chance 0,322 -> 0,348 um 18:52**, nach einem
einzigen Kauf fuer 2 Punkte. Tracer stieg von Stufe 0 auf 1, die offenen
Punkte fielen von 21 auf 1.

Eingetragen um 18:37 als "21 Faehigkeitspunkte liegen ungenutzt herum". Der
Verdacht lautete "SKILL_PLAN haengt an einem Deckel" - falsch. Der Motor
sparte voellig korrekt, nur auf das Falscheste im Feld.

**Der Fehler liegt in der Kostenformel, die niemand nachgesehen hatte.** Die
Kosten sind **linear**, nicht exponentiell:
`(baseCost + level * costInc) * mult` (`Bladeburner/Skill.ts:37-41`). Gemessen
18:45 aus `data/bbspann.json`, Nutzen je Punkt bei der jeweiligen Stufe:

    Faehigkeit          Stufe  Preis  Wirkung           je Punkt
    Short-Circuit           0      2  +5,5% Retirement     2,75
    Tracer                  0      2  +4%   Contracts      2,00
    Evasive System          0      2  +4%   dex/agi        2,00
    Reaper                  0      2  +2%   Kampfwerte     1,00
    Digital Observer        1      4  +4%   Operations     0,98
    Blade's Intuition      10     24  +3%   alles          0,125  <- wurde gekauft

Blade's Intuition stand auf Platz 2 mit `Infinity` und frass damit jeden
Punkt, waehrend sechs Faehigkeiten auf Stufe 0 lagen, die je Punkt das
**Sechzehn- bis Zweiundzwanzigfache** liefern.

**Die Deckel sind gerechnet, nicht geraten.** Blade's Intuition liefert bei
Stufe n `3/(3+2,1n)`, Tracer bei Stufe m `4/(2+2,1m)`; gleich sind sie bei
`m = (6 + 8,4n)/6,3`, fuer n=10 also m = 14,3. Neue Reihenfolge: Cyber's Edge
5, **Tracer 14, Short-Circuit 12, Evasive System 12, Reaper 8**, dann Blade's
Intuition, Digital Observer, Cloak, Overclock 90.

**Lehre: Eine Prioritaetenliste ohne Preise ist eine Vermutung.** Der Plan
wurde am 25.08. um 17:20 schon einmal repariert ("kaufte das Billigste statt
des Wichtigsten") - und dabei ins andere Extrem gedreht. Richtig ist keins von
beidem, sondern **Wirkung je Punkt**, und die haengt an der Stufe.

### Raid ist verworfen - Charisma 27 macht ihn zum Verlustgeschaeft (26.08., 17:20)

**Verifiziert: Charisma 27 um 17:15**, gemessen aus dem Spielstand
(`tools/save.js`-Ladeweg, `p.skills.charisma`), 409 Erfahrung,
`mults.charisma` 1,557.

Der Punkt stand seit 16:05 unter `## Sofort` und verlangte eine 30-Minuten-
Messung mit einer Zielrate von 2,5. Diese Messung findet nicht statt, weil die
Rechnung sie vorwegnimmt - und das ist ein Ergebnis, kein Ausweichen.

Raid erzeugt selbst das Chaos, das ihn ausbremst
(`city.changeChaosByPercentage(getRandomIntInclusive(1, 5))` je Durchlauf,
unabhaengig von Erfolg, `Bladeburner.ts:846`): im Mittel **+3,21 Prozent je
Minute**. Dagegen haelt nur Diplomacy, und deren Wirkung haengt allein am
Charisma (`charisma^0,045 + charisma/1000` Prozent je Minute,
`Bladeburner.ts:737-745`). Beides ist prozentual, das Verhaeltnis damit
chaos-unabhaengig, und der Raid-Anteil im Gleichgewicht betraegt
`D / (D + 3,21)`.

    Charisma   noetige Exp   D/min   Anteil   effektive Zyklusrate
          27    3,6 x 10^2   1,187    27,0%                  1,02  <- ist
         100    3,3 x 10^3   1,330    29,3%                  1,11
         300    2,1 x 10^5   1,593    33,2%                  1,26
         440    3,5 x 10^6   1,755    35,3%                  1,34  <- gleichstand
       1.200    1,5 x 10^13  2,576    44,5%                  1,69

Tracking liefert **1,339**. Raid liegt bei **1,02** - er ist nicht nur nicht
besser, er ist ein Drittel schlechter, und dazu kaemen rund 37 Millionen je
Minute an Krankenhausrechnungen.

**Damit ist auch der Charisma-Hebel erledigt**, der um 16:50 als eigener
Offen-Punkt eingetragen wurde. Der Gleichstand kaeme bei Charisma 440, wofuer
3,5 Millionen Erfahrung noetig sind - das 8.700-fache des Vorhandenen. Bei
geschaetzten 20 Erfahrung je Sekunde am Leadership-Kurs sind das rund 49
Stunden ohne Rangzuwachs; dieselben 49 Stunden Tracking bringen rund 3.900
Rang, mehr als die 1.592 bis Operation Typhoon. **Charisma-Training ist strikt
schlechter.** Die Erfahrungskurve `exp = e^((lvl/mult + 200)/32) - 534,6`
(`PersonObjects/formulas/skill.ts:17-19`) macht jede dreistellige Zielmarke
teuer und jede vierstellige unerreichbar.

**Geaendert:** `RAID_AN = false` in `src/blade.js`. Bedingungslogik und
Charisma-Schwelle bleiben stehen - ein spaeterer Knoten kann mit hohem
Charisma starten, dann genuegt `true`.

**Was die Episode gekostet hat:** Die Erwartung "Faktor 3,4" stand seit 13:22
in dieser Datei und hat vier Loop-Laeufe lang als groesster offener Hebel
gegolten. Sie war brutto gerechnet - ohne die Gegenkraft, die die Aktion
selbst erzeugt. **Lehre: Wenn eine Aktion einen Zustand veraendert, gehoert
die Rueckwirkung dieses Zustands in dieselbe Rechnung**, sonst misst man den
ersten Zug eines Regelkreises und haelt ihn fuer den Dauerzustand.

### Der Stadtwechsel-Hebel ist geprueft und verworfen (26.08., 15:55)

Eingetragen um 15:28 mit **hoher** Dringlichkeit und der Zahl "Faktor 2,35".
Gemessen 27 Minuten spaeter: **Der Hebel existiert praktisch nicht.**

Um die Staedte ueberhaupt vergleichen zu koennen, misst `src/bbspann.js` jetzt
alle sechs durch. Das geht, weil `switchCity` nur `bladeburner.city` setzt
(`NetscriptFunctions/Bladeburner.ts:314-319`) und Netscript zwischen zwei
`await` synchron laeuft: Die Schleife enthaelt keines, der Rundgang ist damit
atomar, und am Ende steht die Division wieder in ihrer Stadt.

    Stadt        Chaos  Guete   Tracking   Raid     Operation Typhoon
    Chongqing    27,36  1,415   0,7712     0,1148   0,0331
    Volhaven     43,29  1,375   0,8539     0,1271   0,0349
    New Tokyo    25,91  1,348   0,8368     0,1245   0,0349
    Sector-12    46,91  1,331   0,8265     0,1230   0,0349   <- Arbeitsstadt
    Ishima       39,61  0,863   0,5359     0,0798   0,0349
    Aevum        37,38  0,816   0,5068     0,0754   0,0349

**Drei Befunde, jeder fuer sich das Gegenteil der Erwartung:**

1. **Die Black Op ist in allen Staedten gleich** (0,0349, Chongqing 0,0331).
   Fuer die Aktion, an der der Ausgang des Knotens haengt, ist die Stadtwahl
   ohne Wirkung.
2. **Bei Raid liegt Volhaven 3 Prozent vor Sector-12**, Chongqing sogar
   darunter. Kein Hebel, sondern Rauschen.
3. **Die Guete-Formel ist widerlegt.** Chongqing hat die hoechste Guete
   (1,415) und die niedrigste Tracking-Chance der vier guten Staedte. Der
   Grund ist `popEst` gegen `pop`: Die Formel rechnet mit der Schaetzung, die
   Chance mit der Wahrheit. Die Zahl bleibt in `bbspann.json` stehen, aber mit
   einer Warnung im Code - **wer die Stadt waehlt, waehlt nach `proben`.**

**Warum der Faktor 2,35 trotzdem richtig gemessen war:** Er galt um 14:49, als
Sector-12 bei Chaos 53,89 stand. Diplomacy hat das seit 15:26 auf 46,9
gedrueckt, und damit ist der Faktor `sqrt(1 + chaos - 50)` auf exakt 1
zurueckgefallen. **Der Stadtwechsel waere ein Ausweichen vor einem Problem
gewesen, das inzwischen an der Wurzel behoben ist.**

Die Befuerchtung aus dem Auftrag - in einer fremden Stadt sei die Schaetzung
so unscharf, dass der Motor in Field Analysis landet - ist ebenfalls
widerlegt: Die Tracking-Spannen liegen in den vier guten Staedten zwischen
0,107 und 0,174, Chongqing hat sogar die schmalste.

**Was bleibt:** Die Messung selbst. Sollte das Chaos einer Stadt je wieder
davonlaufen, waehrend Diplomacy nicht hinterherkommt, steht die Grundlage fuer
einen Wechsel jetzt in `data/bbspann.json` - je Stadt, je Aktion, mit Spanne.


### Chaos ueber 50 halbierte alle Erfolgschancen - Diplomacy fehlte (26.08., 15:26)

Gemessen 14:49: Sector-12 stand bei Chaos **53,89**, und die Erfolgschancen
waren gegenueber 13:22 auf die Haelfte gefallen - Tracking 0,778 auf 0,357,
Retirement 0,468 auf 0,219, Bounty Hunter 0,388 auf 0,182. Die Rangrate fiel
von 0,841 auf 0,625 je Minute.

Ursache am Quellcode belegt: `Actions/Action.ts:94-101`. Ueber
`ChaosThreshold` (50) wird die SCHWIERIGKEIT mit `sqrt(1 + (chaos - 50))`
multipliziert, hier `sqrt(4,89) = 2,21`. Der gemessene Faktor war 2,18. Unter
50 ist der Faktor exakt 1 - der Schaden setzt schlagartig ein und verschwindet
ebenso schlagartig.

**Das war eine Vorhersage, kein Rueckschluss.** Der Faktor 2,21 stand in
`nodes/BAUSTELLEN.md`, bevor die Gegenmassnahme lief; die Messung danach hat
ihn bestaetigt.

Behoben in `src/blade.js`: Steigt das Chaos der Arbeitsstadt ueber 50, faehrt
der Motor `Diplomacy`, bis es unter 47 liegt. Die Pruefung steht **vor** der
Aktionswahl - der Wert, den `beste()` vergleicht, ist bei hohem Chaos bereits
verdorben, wer erst waehlt und dann aufraeumt, waehlt auf Basis halbierter
Zahlen.

Diplomacy senkt das Chaos prozentual um `charisma^0,045 + charisma/1000`
(`Bladeburner.ts:735-743`), dauert 60 Sekunden und kostet **keine Ausdauer**
(`data/GeneralActions.ts:37-44`). Die Hysterese ist knapp (ein ab 50, aus bei
47), weil die Senkung prozentual und damit langsam ist - von 50 auf 40 waeren
es siebzehn Durchlaeufe.

**Verifiziert 15:26, durchgehend beobachtet:**

    15:16:23   Chaos 53,8   General/Diplomacy startet
    15:21:14   Chaos 50,0
    15:25:47   Chaos 47,3
    15:26:07   Contracts/Tracking, **chance 0,801**

Zehn Minuten Diplomacy, danach **Tracking-Chance 0,801 gegen 0,357** - Faktor
2,24 gegen den vorhergesagten 2,21. Gemessene Senkung rund 0,76 Chaospunkte je
Durchlauf, also 1,4 Prozent.

Damit ist zugleich der Diplomacy-Teil des Offen-Punkts "blade.js hat kein
Gegenmittel gegen leere Vertragsvorraete" erledigt. Dort stand er als
nachrangig, weil "Chaos unter 50 nutzlos" ist - genau diese Bedingung war
gekippt, und niemand hat den Eintrag daraufhin noch einmal angesehen. Die
Lehre steht als eigener Punkt nicht da, gehoert aber hierher: **Eine
Verwerfung mit Bedingung muss die Bedingung mitpruefen.**


### Die Zyklusrate rechnete mit einer festen Regeneration (26.08., 14:20)

`src/bbspann.js` teilte durch R = 2,3 - eine feste Zahl aus der Messung vom
12:21. Genau die veraltet: Cyber's Edge hebt `getSkillMult(Stamina)`, und der
steckt in `calculateStaminaGainPerSecond` (`Bladeburner.ts:1317-1325`).
Gemessen ueber die Kammerphasen in `data/aktionen.txt`:

    vor 12:21, Cyber's Edge Stufe 0   R = 2,068   (53 Phasen, 108 min)
    ab  13:33, Cyber's Edge Stufe 5   R = 2,313   (11 Phasen,  23 min)

Das sind **11,8 Prozent mehr Regeneration** - fuenf Stufen zu je zwei Prozent
plus das Wachstum der Agility. Damit ist der Cyber's-Edge-Hebel von 12:22 zum
zweiten Mal belegt, diesmal an der Groesse, auf die er wirkt.

Ein fester Wert haette die Zyklusrate ab jetzt systematisch zu niedrig
gerechnet, und zwar **zugunsten der langen Aktionen** - also in die Richtung,
in die die Auswertung ohnehin schon zeigt. Das ist der gefaehrliche Fall: ein
Messfehler, der die eigene These stuetzt.

Behoben: `bbspann.js` liest die juengsten Kammerphasen aus `data/aktionen.txt`
und leitet R daraus ab. Die Kammer ist die einzige Aktion, in der die Ausdauer
nur steigt, also ist die Differenz je Minute genau R. Rueckwaerts gelesen, bis
20 Minuten zusammen sind, Phasen unter 30 Sekunden verworfen (die gemeldete
Ausdauer ist gerundet, bei kurzen Phasen ist der Rundungsfehler groesser als
das Signal). Die Datei fuehrt `regeneration` und `regenerationQuelle` mit.

**Verifiziert 14:20:** `R = 2.312 (gemessen ueber 10 Kammerphasen, 20.6 min)` -
deckt sich mit der unabhaengigen Rechnung ausserhalb des Spiels (2,313).


### Der Faehigkeitsplan hatte den zweiten Platz falsch besetzt (26.08., 13:18)

**Der Eintrag von 12:22 hatte die Praemisse verkehrt herum, gemessen 12:47.**
Dort stand die Sorge, `Blade's Intuition` mit Deckel `Infinity` koenne Punkte
lautlos verschlingen, sobald seine Erfolgschance bei 1,0 klemmt. Gemessen ist
das Gegenteil: **Operation Typhoon, die naechste Black Op, steht bei einer
Erfolgschance von 0,025.** Die Chancen-Faehigkeiten wirken laut
`Actions/Action.ts:184-187` auch auf Black Ops - Blade's Intuition ist also
von "ausgereizt" so weit entfernt wie moeglich, und `Infinity` ist dort richtig.

Dafuer stand ein echter Fehler daneben: **Overclock auf Stufe 14, Blade's
Intuition auf Stufe 0.** Die vierzehn Stufen haben kumulativ rund 169 Punkte
gekostet (`Summe(3 + 1,4*i)`, i = 0..13), in eine Faehigkeit, deren Wirkung im
Ausdauer-Engpass mit 0,4444 gegen 0,4445 beziffert ist. Auf Platz 2 haette
Overclock sich das sofort zurueckgeholt, sobald Cyber's Edge am Deckel steht -
naechste Stufe 23 Punkte gegen 3 Punkte fuer Blade's Intuition Stufe 1.

**Geaendert 12:48 in `src/blade.js`, Wirkung noch nicht gemessen:** Overclock
steht jetzt als letzter Eintrag im `SKILL_PLAN`, die Chancen-Faehigkeiten
davor. Der Deckel 90 bleibt - faellt der Ausdauerengpass je weg, ist die
Faehigkeit wieder etwas wert.

**Verifiziert 13:18: Blade's Intuition Stufe 1 um 13:18.** Cyber's Edge steht
auf Stufe 5 (Deckel), Hoechstausdauer 78. Der erste Kauf nach dem Deckel war
Blade's Intuition, **nicht** Overclock (das unveraendert auf Stufe 14 steht,
naechste Stufe 23 Punkte). Damit ist die Umsortierung wirksam und der Punkt
kann nach Erledigt.

**Urspruenglich nachzumessen, sobald Cyber's Edge Stufe 5 erreicht** (Deckel; naechste Stufe
kostet 13 Punkte, um 12:54 lagen 10 bereit): Der naechste Kauf muss
**Blade's Intuition Stufe 1** sein, nicht Overclock Stufe 15. Beobachtbar ist
das erst dann - solange Cyber's Edge unter seinem Deckel steht, bleibt der Plan
ohnehin dort stehen, und die Umsortierung dahinter ist von aussen unsichtbar.

Die Sicherung, die im Eintrag von 12:22 gefordert wurde - beim Sparziel
pruefen, ob die Faehigkeit ueberhaupt noch etwas bewegt - ist **bewusst nicht
gebaut worden.** Sie wuerde bei den heutigen Zahlen nie ausloesen und liesse
sich deshalb auch nicht pruefen; ungetesteter Code, der nie laeuft, ist eine
Last und keine Absicherung. Wieder aufnehmen, wenn eine Chance tatsaechlich
1,0 erreicht.



### Der Faehigkeitsplan kaufte Overclock, das im Ausdauer-Engpass nichts bringt (26.08., 12:22)

Gemessen 11:45: 14 Faehigkeitspunkte lagen da, `Overclock` stand auf Platz 1 des
`SKILL_PLAN` und `Cyber's Edge` stand ueberhaupt nicht darin - die urspruengliche
Notiz sprach von "Platz 10", tatsaechlich hatte der Plan nur acht Eintraege.

**Die Verwerfung von Overclock ist schaerfer ausgefallen als der Befund
annahm.** Dort stand "rund 1 Prozent". Nachgerechnet am Quellcode ist es
naeher an null: Der Ausdauerverlust faellt **je Aktion** an, nicht je Zeit
(`Bladeburner.ts:921`, `BaseStaminaLoss * difficultyMultiplier`). Eine um ein
Prozent kuerzere Aktion heisst also ein Prozent mehr Durchlaeufe je Minute UND
ein Prozent mehr Verbrauch je Minute - der Ausdauerengpass zieht den Gewinn
sofort wieder ein. Mit V = 2,7 und R = 1,2 je Minute:

    ohne Overclock   Arbeit S/1,5000   Ruhe S/1,2   Rate 0,4444 * g/T
    mit  Overclock   Arbeit S/1,5273   Ruhe S/1,2   Rate 0,4445 * g/T

Overclock ist damit nicht "schwaecher als Cyber's Edge", sondern in diesem
Regime wirkungslos. Es zahlt sich erst aus, wenn die Ausdauer nicht mehr klemmt.

Geaendert in `src/blade.js`: `Cyber's Edge` auf Platz 1 mit **Deckel 5**,
Overclock auf Platz 2 mit unveraendertem Deckel 90. Der Deckel ist Absicht -
die Kosten sind `1 + 3 * Stufe` und damit kumulativ quadratisch (5 Stufen = 35
Punkte, 8 Stufen = 92), der Nutzen linear.

Bestaetigt am Quellcode, weil die Wirkung an genau einer Stelle haengt:
`getSkillMult(Stamina)` steckt in **beiden** Formeln - `calculateMaxStamina`
(`Bladeburner.ts:1327-1343`) und `calculateStaminaGainPerSecond`
(`:1317-1325`). Die Ruhezeit S/R bleibt deshalb gleich, die Arbeitszeit
S/(V-R) waechst ueberproportional.

**Verifiziert 12:21, drei Messungen:**
- **Hoechstausdauer 70 -> 74** (+5,7 Prozent). Drei Stufen zu je 2 Prozent
  ergeben 6 Prozent - das ist die Wirkung selbst, nicht ihre Ankuendigung.
- **Punkte 21 -> 9**, also 12 ausgegeben: genau `1 + 4 + 7` fuer die Stufen 1
  bis 3. Die vierte kostet 10 und wird angespart.
- **Regeneration in der Kammer 2,3 je Minute** (37 -> 41 Ausdauer in 104 s);
  vorher gemessen waren 2,04.

Baseline fuer die Rangrate, gemessen 12:18 ueber `tools/ratencheck.js` vor der
Aenderung: **0,649 Rang je Minute** ueber 541 Minuten, davon 340,1 Minuten
(62,9 Prozent) in der Regenerationskammer. Der Vergleichswert gehoert in den
naechsten Optimierungslauf - erwartet werden rund sechs Prozent mehr, und das
ist wenig genug, dass es eine ordentliche Messdauer braucht.

Nebenbefund: `General/Incite Violence` steht mit **2 Abschnitten** im
Ratencheck. Die Aktion hat also inzwischen ausgeloest - der Vermerk "hat noch
nie ausgeloest" beim Vorratspunkt ist ueberholt.


### Sieben Milliarden auf einen Schlag - kein Leck, ein Kauf (26.08., 08:50)
Gemessen im Verlauf: 07:55 noch 8,98 Mrd, 08:15 nur 1,87 Mrd - **7,11
Milliarden in einem Schritt.** Danach stieg das Guthaben sofort wieder normal
(+0,38 Mrd in zwanzig Minuten). Ein einmaliger Kauf also, kein laufendes Leck.

**Damit ist der Krankenhaus-Hebel von 06:55 entlastet.** Er kostet
`min(Guthaben * 0,1, fehlendeHP * 100.000)`, bei 23 Trefferpunkten hoechstens
2,3 Millionen je Heilung - und er wuerde KONTINUIERLICH kosten, nicht in einem
Sprung. Das Guthaben waechst seither ungestoert.

Nicht der Grund waren auch die vier gekauften Server `werk-1` bis `werk-4`
(`data/werkbank.json`, je 128 GB): Bei rund 55.000 je GB sind das etwa 28
Millionen zusammen.

Gemessen mit dem neuen `src/augcheck.js` (liest `getOwnedAugmentations`):
elf eingebaute Augmentierungen, **eine wartende** (Cranial Signal Processors -
Gen II, Grundpreis 0,12 Mrd). Der bezahlte Preis liegt hoeher - jede weitere
Augmentierung im selben Zyklus kostet das 1,9-fache -, aber Faktor 58 waere
viel. Der wahrscheinlichste Rest ist eine **Spende an eine Faktion**:
`bn4rep.js` fuehrt eine `spendenSchwelle` und kauft Reputation gegen Geld,
und Spenden tauchen in keinem Inventar auf.

**Restunsicherheit bleibt.** Endgueltig bewiesen ist es nicht - `bn4rep.json`
stand seit gestern 17:05 still, und das ist KEIN Defekt: Das Skript steigt an
mehreren Stellen aus der Runde aus, bevor es seine Telemetrie schreibt (der
Kommentar bei `bn4rep.js:357-363` sagt es selbst). Wer die Frage abschliessend
klaeren will, muss bn4rep an diesen Ausstiegen protokollieren lassen.


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
