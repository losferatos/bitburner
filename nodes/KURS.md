# Kurs

**Die Leitgröße, aus dem Quellcode hergeleitet.** Der Optimierloop liest den
obersten Eintrag und richtet sich danach; alle anderen Loops arbeiten darauf
zu. Geschrieben wird hier nur vom Kursloop (`loops/loop-kurs.md`, alle 12 h).

**Warum die Datei existiert:** Bis zum 27.08.2026 bekam der Optimierloop seine
Leitgröße im Prompt vorgeschrieben und las zur Bestätigung `nodes/HEBEL.md` —
wo derselbe Satz stand. Er las als Quelle seine eigene Ausgabe. Die Größe war
zufällig richtig, wurde aber nie hergeleitet und deshalb auch nie
durchgerechnet: Optimiert wurde auf den nächsten Meilenstein statt auf den
Ausgang. Diese Datei bricht den Kreis, indem sie nur aus
`reference/bitburner-src/` gespeist wird.

**Wie man einen Eintrag herleitet**, wenn der Kursloop nicht gelaufen ist:

1. `NetscriptFunctions/Singularity.ts`, `destroyW0r1dD43m0n` — was genau muss
   erfüllt sein? Es gibt meist **mehrere** Wege; alle durchrechnen.
2. `BitNode/BitNode.tsx` — die Multiplikatoren des Knotens. Sie entscheiden,
   welcher Weg überhaupt in Frage kommt.
3. Den Engpass **absolut** beziffern (X von Y), und abziehen, was unterwegs
   ohnehin anfällt.
4. Prüfen, ob die Rate sich selbst beschleunigt — eine lineare Fortschreibung
   ist fast immer falsch.

---

## 29.08., 07:15 - BitNode 10, die Strecke NACH dem Tor

Geschrieben vom Vorankommensloop. Der Eintrag von 21:45 beziffert Tor 1 (die
vier Kampfwerte auf 100) und hoert dort auf. Was danach kommt, stand bisher
nur als Baustellenpunkt (03:45) und nirgends im Kurs - also fuhr der Bot auf
eine Strecke zu, deren Laenge er nicht kannte.

**Aus dem Quellcode gelesen, nicht gemessen:**

    Bladeburner/data/BlackOperations.ts   21 Black Ops
                                          max reqdRank   400.000
                                          Summe rankGain 113.660
    BitNode/BitNode.tsx, case 10          BladeburnerRank 0,8
    Bladeburner/Formulas.ts:8-26          Gewinn * Multiplikator,
                                          VERLUST ohne Multiplikator,
                                          reqdRank fest

**Netto-Strecke bis Daedalus (der letzte Black Op, reqdRank 400.000):**

    BitNode 10   400.000 - 113.660 * 0,8 = **309.072 Rang**
    BitNode 6    400.000 - 113.660       =   286.340 Rang

Also **+7,9 Prozent Netto-Strecke** gegenueber BitNode 6 - und weil auch die
laufende Rangrate mit 0,8 skaliert, **+25 Prozent Zeitbedarf** bei gleicher
Aktionsrate. Die BitNode-6-Erfahrung aus `nodes/ROUTE.md` (71-148 h) wird
damit zu **89-185 h** fuer diesen Knoten.

**Was das fuer die Fahrweise heisst - und was ausdruecklich NICHT:**

Die Feuerschwelle fuer Black Ops bleibt bei 0,35. Sie wurde am 28.08. um
16:00 nicht aus einem Erwartungswert hergeleitet, sondern aus der Zeit:
Rangverlust ist kein Bestandsverlust, weil `changeRank` gegen `maxRank`
vergibt und `maxRank` nie faellt (`Bladeburner.ts:1273,1283-1291`). Die
Kosten eines Fehlschlags sind `T_op + L / (m * Rangrate)`; in diesem Knoten
wird dieser Posten um ein Viertel teurer - bei Daedalus von 5,4 auf 6,8
Minuten. Dem stehen 78 bis 86 Minuten gegenueber, die Warten auf eine hoehere
Chance kosten wuerde. 1,4 Minuten gegen achtzig: die 0,35 bleiben richtig.

Leitgroesse bis Tor 1: unveraendert der **Kampfwert-Tiefstand** (66 von 100
um 07:07). Danach: **Bladeburner-Rang, 0 von 400.000**, Netto-Strecke
309.072.

Naechste Pruefung: Sobald `inBladeburner` true meldet, die tatsaechliche
Rangrate ueber 45 Minuten glaetten und die 89-185 h damit ersetzen. Die
Spanne stammt aus BitNode 6 und ist nur hochgerechnet.

---

## 28.08., 21:45 - BitNode 10 (KORREKTUR des Eintrags von 19:20)

Geschrieben vom Vorankommensloop, weil der Eintrag von 19:20 eine Leitgroesse
gesetzt hat, die einer Nachrechnung nicht standhaelt. Eine falsche Leitgroesse
kostet vier Loops zwoelf Stunden - das kann nicht bis 6:44 warten.

**Was 19:20 richtig war:** Der Multiplikator steht in `calculateSkill` vor
der Klammer, die Erfahrung im Logarithmus. Ein Kampf-Multiplikator von 2,0
statt 1,26 senkt den Bedarf von 1.019.268 auf 100.868 Erfahrung.

**Was fehlte:** der Preis. Zwei Posten, beide inzwischen gemessen.

  1. **Reputation.** Sie kostet Zeit, und zwar in derselben Waehrung: Der
     Spieler bringt bei Feldarbeit 29,6 Reputation je Minute
     (`reputation.ts:40-52` mit den heutigen Werten), waehrend sein
     Erfahrungsgewinn von 10 auf 5,04 je Sekunde faellt.
  2. **Welche Werte gehoben werden.** Von den zehn erreichbaren
     Kampf-Augmentierungen hebt **genau eine** str und def (Combat Rib I,
     Slum Snakes, 15.000 Reputation). Der Rest wirkt auf dex und agi - und
     das Tor ist der NIEDRIGSTE Wert.

Durchgerechnet mit gemessenen Raten (Details in `nodes/ERLEDIGT.md`, 21:45):

    Weg 3  nur Gym                                    **18,6 h**
    Weg 2  Feldarbeit bis Combat Rib I, Einbau, Gym    20,3 h
    Weg 1  Augmented Targeting I                       kein Gewinn

Engpass:           **Kampfwert-Tiefstand 66 von 100** - in Erfahrung 31.000
                   von 252.817 je Wert, also 12,3 %.

Restweg:           4 x (252.817 - 31.000) = **887.268 Erfahrung**.

Rate:              **13,25 je Sekunde** (Spieler 10 im Gym, Sleeve 3,25 ueber
                   `sync/100`). Gemessen 19:14 bis 19:16 und 20:57.

ETA:               **18,6 h fuer Tor 1.** Vorlauf 19:20: 21,8 h ohne
                   Zwischenschritt, 2,2 h mit - der zweite Wert war falsch.

Entscheidung:      **Weiterfahren.** Der Bot macht bereits das Richtige:
                   Spieler und Sleeve trainieren, niemand jagt Reputation.
                   Der Zwischenschritt von 19:20 wird zurueckgenommen.

Leitgroesse:       **Kampfwert-Tiefstand, jetzt 66 von 100.** NICHT
                   `mults.strength` - dieser Wert steht bis Tor 1 still, und
                   das ist richtig so.

Naechste Pruefung: Steigt der Tiefstand um mindestens 3 je halbe Stunde
                   (13,25/s auf vier Werte, logarithmische Kurve), traegt der
                   Weg. Bleibt er stehen, ist das Gym aus.

---

## 28.08., 19:20 - BitNode 10

Ausgangsbedingung: unveraendert gegenueber 18:55 - **21 Black Operations**
                   (`Singularity.ts:1148-1164`), Weg A (Hacking 6.000) bleibt
                   rechnerisch tot.

Engpass:           **Kampfwert-Tiefstand 42 von 100** = 42 %, Tor 1 zum
                   Bladeburner-Beitritt
                   (`NetscriptFunctions/Bladeburner.ts:356`). Gemessen in
                   Erfahrung ist der Stand schlechter als er aussieht: 6.723
                   von 254.817 je Wert, also **2,6 Prozent** - die Levelkurve
                   ist logarithmisch, die ersten 42 Level sind fast geschenkt.

Restweg:           4 x 254.817 minus rund 27.750 verdient = **991.500
                   Erfahrung**.

Rate:              **13 Erfahrung je Sekunde**, gemessen ueber ein
                   76-Sekunden-Fenster der SPIELZEIT (zwei Spielstaende,
                   19:14 und 19:16). Davon 10/s auf den gerade trainierten
                   Wert, der Rest aus den Shoplifts des Sleeves.

ETA:               **21,8 h fuer Tor 1 allein**, wenn nichts geaendert wird.
                   Vorlauf 18:55: "noch nicht messbar".

**Und genau deshalb ist die Entscheidung nicht "weiterfahren".**

`calculateSkill` ist `floor(mult * (32*ln(exp+534,6) - 200))`
(`PersonObjects/formulas/skill.ts:13`). Der Multiplikator steht **vor** der
Klammer, die Erfahrung **im Logarithmus** - ein besserer Multiplikator ist
also exponentiell mehr wert als mehr Training:

    mults.kampf   Erfahrung je Wert fuer 100    x4        bei 13/s
      1,26 (jetzt)          254.817          1.019.268     21,8 h
      1,50                   94.153            376.610      8,0 h
      1,75                   44.459            177.838      3,8 h
      2,00                   25.217            100.868      2,2 h
      2,50                   11.255             45.021      1,0 h

**Von 1,26 auf 2,00 spart 19,6 Stunden.** Das ist mehr, als eine
Augmentierungsrunde kosten kann - Geld steht bei 67 Mio und waechst, das Netz
bei 43 von 72.

Der Einbau setzt die Kampferfahrung auf null zurueck. Das ist hier kein
Einwand, sondern der Punkt: Die 100.868 Erfahrung DANACH sind ein Zehntel der
1.019.268 davor.

Entscheidung:      **Zwischenschritt: eine Kampf-Augmentierungsrunde vor dem
                   Beitritt.** Ziel ist `mults.strength/defense/dexterity/
                   agility` >= 2,0. Nicht weiterfahren - 21,8 Stunden Gym
                   gegen 2,2 sind kein Abwaegen mehr.

                   Zu beachten: BitNode 10 verteuert das
                   (`AugmentationMoneyCost` **5**, `AugmentationRepCost`
                   **2**, `BitNode.tsx` case 10). Welche Faktion und welche
                   Stuecke - das rechnet der Vorankommensloop; als Auftrag
                   eingetragen.

Leitgroesse:       **Kampf-Multiplikator `mults.strength` (und die drei
                   Geschwister), jetzt 1,2616, Ziel 2,0.** NICHT die
                   Erfahrung je Sekunde - die zu verdoppeln spart 11 Stunden,
                   den Multiplikator auf 2,0 zu bringen spart 19,6.

Naechste Pruefung: Steht `mults.strength` beim naechsten Lauf noch bei
                   1,2616, hat die Augmentierungsrunde nicht begonnen. Dann
                   ist die ETA fuer Tor 1 unveraendert 21,8 h - und das waere
                   das zweite Mal in Folge, also ein Fall fuer die
                   Abbruchregel.

---

## 28.08., 18:55 - BitNode 10

Geschrieben vom Optimierloop, nicht vom Kursloop: Der Eintrag darueber galt
noch fuer BitNode 6, und ein Kurs fuer den falschen Knoten ist schlechter als
keiner. Der Knoten wurde um 17:05 gewechselt.

Ausgangsbedingung: **Zwei Wege, ODER-verknuepft**
                   (`NetscriptFunctions/Singularity.ts:1148-1164`):
                   Hacking >= `wd.requiredHackingSkill` **mit** Root-Zugang,
                   ODER `numBlackOpsComplete >= 21`.
                   `WorldDaemonDifficulty` ist in BitNode 10 **2**
                   (`BitNode.tsx`, case 10), das Hackziel also **6.000**.

Das Modell ist geeicht: `calculateSkill` = `floor(mult * (32*ln(exp+534,6)
- 200))` (`PersonObjects/formulas/skill.ts:13`), wobei `mult` das Produkt
aus dem Spielermultiplikator und dem Knotenfaktor ist
(`Person.ts:62`). Mit `mults.hacking` 1,2616 und
`HackingLevelMultiplier` 0,35 ergibt das aus 42.542 Erfahrung **Level 62** -
gemessen 62. Fuer die Kampfwerte (Faktor 0,4) rechnet es 29 gegen gemessene 29.

**Weg A - Hacking auf 6.000.** Der Knotenfaktor 0,35 macht das Ziel zu einer
reinen Frage des Augmentierungs-Multiplikators:

    mults.hacking    benoetigte Erfahrung fuer Level 6.000
      1,26 (jetzt)   2,3e187
      5              1,8e49
     10              9,6e25
     20              2,2e14
     40              339.456.229      <- erst hier realistisch

Zum Vergleich der eigene BitNode-5-Lauf: Dort stand `HackingLevelMultiplier`
auf **1,0**, und Level 4.500 verlangte bei mult 20 nur 585.568 Erfahrung. Der
Unterschied ist nicht die Erfahrung, sondern der Faktor 0,35 - er verschiebt
den ganzen Bedarf um Zehnerpotenzen. Weg A verlangt also **zuerst einen
Augmentierungs-Multiplikator um 40**, und BitNode 10 verteuert genau das:
`AugmentationMoneyCost` **5**, `AugmentationRepCost` **2**.

**Weg B - 21 Black Operations.** Zwei Tore:

    Tor 1  Beitritt: alle vier Kampfwerte >= 100
           (`NetscriptFunctions/Bladeburner.ts:356`).
           Bei Kampffaktor 0,4 sind das **252.822 Erfahrung je Wert**
           gegen 2.613 heute. In BitNode 6 waren es 5.633 - also das
           **45-fache**, aber es ist Gym-Zeit und Geld, beides vorhanden.

    Tor 2  Daedalus, `reqdRank` **400.000**
           (`Bladeburner/data/BlackOperations.ts:708`). Die Schwelle ist
           knotenunabhaengig; gedaempft wird der ERTRAG:
           `BladeburnerRank` **0,8** multipliziert jeden Rangzuwachs
           (`Bladeburner/Formulas.ts:13, 22, 25`). 400.000 Rang kosten hier
           also so viel Arbeit wie 500.000 in BitNode 6.

Engpass:           **Weg B, und darin zuerst Tor 1.** Kampfwert-Tiefstand
                   **27 von 100**. Weg A ist nicht verworfen, sondern
                   nachgelagert: Er wuerde denselben Augmentierungsaufbau
                   verlangen, den Weg B ohnehin unterwegs mitnimmt, und dann
                   noch einen Multiplikator um 40 obendrauf.

Restweg:           Tor 1: 4 x 252.822 Erfahrung, davon 2.287 bis 2.708
                   verdient - also praktisch der volle Weg.
                   Tor 2: 400.000 Rang bei Faktor 0,8, plus die
                   Skillpunkte fuer die Black-Op-Chancen. In BitNode 6
                   brauchte Daedalus allein **84.441 Skillpunkte = 253.323
                   Rang** (siehe nodes/ERLEDIGT.md, 15:25) - bei niedrigeren
                   Kampfwerten hier eher mehr.

Rate:              Noch nicht messbar. Der Knoten ist 110 Minuten alt, die
                   Kampfwerte steigen gerade erst (27 bis 29), und ein
                   Gym-Lauf hat noch nicht stattgefunden.

Was daraus folgt fuer die anderen Loops:
  1. **`bbtrain.js` ist das naechste Werkzeug**, nicht `blade.js`. Solange
     der Tiefstand unter 100 liegt, traegt das Training.
  2. Der Sleeve gehoert perspektivisch ins Gym oder auf Bladeburner-Support -
     seine Erfahrung faellt beim Spieler mit `sync/100` an
     (`Sleeve/Work/Work.ts:22`), in BitNode 10 mindestens 25 Prozent.
  3. Geld ist in dieser Phase **kein** Engpass (55 Mio bei 42 von 71
     Rechnern), Rechenzeit auch nicht. Zeit ist es.

---

## 28.08., 07:15 - BitNode 6

Ausgangsbedingung: **21 Black Operations.** `destroyW0r1dD43m0n` prueft
                   `numBlackOpsComplete >= numberOfBlackOperations`
                   (`NetscriptFunctions/Singularity.ts:1154-1158`); die letzte
                   (Daedalus) verlangt `reqdRank` **400.000**
                   (`Bladeburner/data/BlackOperations.ts:708`).
                   Der zweite Weg - Hacking >= `wd.requiredHackingSkill`
                   (6.000) MIT `hasAdminRights` - bleibt verworfen: bei
                   `HackingLevelMultiplier` 0,35 verlangt
                   `level = floor(mult*(32*ln(exp)-200))` ein `exp` von e^184.

Engpass:           Bladeburner-Rang. **80.706 von 400.000 = 20,2 %.**
                   Aussagekraeftiger ist der Anteil an der ARBEIT, weil die
                   Black Ops sich selbst mitfinanzieren: Von den 400.000 kommen
                   **73.660** aus den `rankGain`-Werten der ersten zwanzig
                   Operationen, es bleiben also **326.340** aus gewoehnlichen
                   Aktionen. Davon sind 79.796 verdient - **24,5 %.**

Restweg:           **246.544 netto.** 400.000 minus 80.706 Rang minus die
                   **72.750**, die die Black Ops 8 bis 20 unterwegs noch selbst
                   einbringen (aus der Tabelle erzeugt, nicht geschaetzt).

Rate:              **226,5 Rang je Minute**, geglaettet ueber **229 Minuten**
                   (`data/verlauf-strategie.json`, 03:25-07:14, 28.876 auf
                   80.706). Das Fenster schliesst den Augmentierungs-Einbau von
                   05:53 samt Wiederaufbau **ein** - genau deshalb ist es das
                   richtige. Zum Vergleich, dieselbe Reihe:

                       229 min   226,5/min   (mit Einbau)
                       132 min   224,6/min   (mit Einbau)
                        41 min    34,5/min   (nur Wiederaufbau)
                       Nacht     442,0/min   (nur Spitzenphase)

                   **Eine Rate ohne Einbaupause ueberschaetzt den Fortschritt
                   um Faktor 8.** Die 442 der Nacht sind keine Reisegeschwindig-
                   keit, sondern eine Momentaufnahme zwischen zwei Einbauten.

ETA:               **13,3-18,1 h**, Mitte rund **15,4** (a = 0,6 / 0,44 / 0).
                   Vorlauf: **71-148 h**, Mitte 104. **Faktor 6,7 besser.**

                   Die Selbstbeschleunigung ist belegt, aber sie ist nicht
                   allein Rueckkopplung: 32,75/min bei Rang 9.083 gegen
                   442/min bei 51.000 waere a = 1,51 - das ist zu steil, weil
                   in dieser Zeit vier bewusste Hebel eingebaut wurden
                   (Assassination als Rangfahrzeug, Overclock, Chaos-
                   Folgekosten, Cyber's Edge). a = 0 bis 0,6 ist die
                   ehrliche Spanne.

Leitgroesse:       **Bladeburner-Rang je Minute, gemessen ueber mindestens
                   45 Minuten und EINSCHLIESSLICH der Wiederaufbaupausen nach
                   einem Einbau.** Der Zusatz ist neu und er ist der Kern
                   dieses Laufs: Wer nur die Spitzenphase misst, optimiert
                   gegen eine Zahl, die achtmal zu gross ist - und uebersieht
                   damit genau den Posten, der gerade der groesste ist.

Entscheidung:      **Weiterfahren.** Der Kurs stimmt, die ETA ist von 104 auf
                   15,4 Stunden gefallen. Kein Zwischenschritt noetig: Die
                   Augmentierungsrunde, die der Eintrag vom 27.08. vorbereiten
                   wollte, ist zweimal gelaufen (01:25 mit 25 Stueck, 05:53),
                   und der Bot loest sie selbst aus.

                   Der einzige verbliebene Bremsklotz ist die Wiederaufbau-
                   phase nach jedem Einbau. Sie wird mit jedem Einbau laenger,
                   weil die AKTIONSSTUFE ihn ueberlebt und die Kampfwerte
                   nicht - Assassination steht auf Stufe 20 und verlangt Werte,
                   die der Wiederaufbau erst wieder erreichen muss. Das ist
                   bereits als Hebel adressiert (07:00, Gym laeuft jetzt
                   parallel weiter), gehoert aber dauerhaft in die ETA.

Naechste Pruefung: Liegt die 45-Minuten-Rate wieder ueber 220/min, also ist der
                   Wiederaufbau vorbei? Faellt Operation Red Dragon (Nr. 8 von
                   21, `reqdRank` 25.000 laengst erfuellt, Chance zuletzt
                   0,780-1,000)? Und ist die ETA erneut gesunken - zweimal
                   steigend hiesse, der Knoten wird falsch gefahren.

---

## 27.08., 19:22 - BitNode 6

Ausgangsbedingung: **21 Black Operations**, die letzte (Daedalus) verlangt Rang
                   **400.000** (`Bladeburner/data/BlackOperations.ts`,
                   Freigabe über `destroyW0r1dD43m0n`,
                   `NetscriptFunctions/Singularity.ts:1148-1160`).
                   Der zweite Weg — Hacking ≥ 6.000
                   (`requiredHackingSkill 3000` × `WorldDaemonDifficulty 2`) —
                   ist **geprüft und verworfen**: bei
                   `HackingLevelMultiplier 0,35` verlangt
                   `level = floor(mult·(32·ln(exp) − 200))` ein `exp` von
                   e^184. Dazu 35 statt 30 Augmentierungen für Daedalus.

Engpass:           Bladeburner-Rang. **9.083 von 400.000 = 2,3 %**
                   (Stand 19:10). Nicht die Erfolgschance — der Rang für
                   Typhoon ist um Faktor 3,6 übererfüllt.

Restweg:           **317.257 netto.** Die ersten zwanzig Black Ops liefern
                   zusammen 73.660 Rang aus ihren eigenen `rankGain`-Werten;
                   die zählen mit und wurden vorher doppelt gerechnet.

Rate:              **32,75 Rang je Minute**, geglättet über 45 Minuten
                   (`data/wache-zustand.json`, 18:26–19:11). Über den ganzen
                   Knoten gemittelt waren es 2,3 — Faktor 14 Anstieg.

ETA:               **71–148 h**, Mitte rund 104 (a = 0,3 / 0,44 / 0,6).
                   | Vorlauf: (erster Eintrag)
                   Die Rate beschleunigt sich selbst: `skillPoints =
                   floor(maxRank/3)` bei linear steigenden Fähigkeitskosten
                   (`Bladeburner/Skill.ts:37-41`) heißt Stufe ~ √Rang, also
                   `dR/dt ~ R^a`. Eine lineare Fortschreibung (a = 0) ergäbe
                   443 h und ist durch die eigene Messreihe widerlegt.

Leitgröße:         **Bladeburner-Rang je Minute.** Jeder Hebel, der sie hebt,
                   zahlt direkt auf die 317.257 ein. Die Black-Op-Chance ist
                   ausdrücklich **nicht** die Leitgröße — sie ist über weite
                   Strecken unkritisch, weil der Rang der Engpass ist.
                   **Zweitgrößte:** Geld je Minute, weil es die
                   Augmentierungsrunde finanziert (siehe Entscheidung).

Entscheidung:      **Zwischenschritt vorbereiten: eine Augmentierungsrunde.**
                   In BitNode 6 überlebt der Bladeburner-Fortschritt einen
                   Einbau fast vollständig — `Prestige.ts:153-154` ruft
                   `Bladeburner.prestigeAugmentation()`
                   (`Bladeburner.ts:259-263`), und das macht **nur**
                   `resetAction()` + `joinFaction()`. Rang, `skillPoints`,
                   Fähigkeits- und Aktionsstufen bleiben stehen; es fallen
                   allein die Kampfwerte. Die kommen mit besseren
                   Multiplikatoren um **Faktor 17** schneller zurück, weil die
                   Stufe multiplikativ im Multiplikator, aber nur logarithmisch
                   in der Erfahrung steckt
                   (`PersonObjects/formulas/skill.ts:13`): Stufe 1.000 bei
                   mult 1,0 verlangt exp = e^37,5; bei mult 1,1 genügt e^34,6.
                   Reputation reicht (≥13.820 aus Rang 9.083 bei
                   `RankToFactionRepFactor 2`), **Geld ist der Engpass**:
                   INTERLINKED 5,5 Mrd, Golem Serum 11 Mrd, Omnibeam 27,5 Mrd
                   gegen einen Kontostand von 3,2 Mrd.

Nächste Prüfung:   Ist die ETA gesunken? Steht die Geldrate wieder über
                   10 Mio/min (um 19:11 war sie von 22,9 auf 1,3
                   eingebrochen, Ursache offen)? Reicht das Guthaben für die
                   erste Augmentierung?
